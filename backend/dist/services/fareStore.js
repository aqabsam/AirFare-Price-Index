import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Pool } from 'pg';
import { DEFAULT_FARE_SNAPSHOTS } from '../data/fareCatalog.js';
const DATA_DIR = path.resolve(process.cwd(), 'data');
const DATA_FILE = path.join(DATA_DIR, 'fare-snapshots.json');
const DATABASE_URL = process.env.DATABASE_URL?.trim() || '';
const DATABASE_SSL = process.env.DATABASE_SSL?.trim().toLowerCase() === 'require';
const ALLOW_FILE_CACHE = process.env.FARE_ALLOW_FILE_CACHE?.trim().toLowerCase() === 'true';
function formatDuration(minutes) {
    const hours = Math.floor(minutes / 60);
    const remainder = minutes % 60;
    return `${hours}h ${String(remainder).padStart(2, '0')}m`;
}
export function snapshotsToOffers(snapshots, adults) {
    return snapshots
        .filter((snapshot) => snapshot.seatsRemaining >= adults)
        .map((snapshot) => ({
        airline: snapshot.airline,
        airlineCode: snapshot.airlineCode,
        flightNumber: snapshot.flightNumber,
        origin: snapshot.origin,
        destination: snapshot.destination,
        departureTime: snapshot.departureTime,
        arrivalTime: snapshot.arrivalTime,
        duration: formatDuration(snapshot.durationMinutes),
        stops: snapshot.stops,
        price: snapshot.price * adults,
        currency: snapshot.currency,
        offerId: snapshot.id,
        seatsRemaining: snapshot.seatsRemaining,
        source: snapshot.source,
        sourceType: snapshot.sourceType,
        collectedAt: snapshot.collectedAt,
        confidence: snapshot.confidence,
    }))
        .sort((left, right) => left.price - right.price);
}
function average(values) {
    if (!values.length) {
        return 0;
    }
    return values.reduce((sum, value) => sum + value, 0) / values.length;
}
function median(values) {
    if (!values.length) {
        return 0;
    }
    const sorted = [...values].sort((left, right) => left - right);
    const middle = Math.floor(sorted.length / 2);
    if (sorted.length % 2 === 1) {
        return sorted[middle] ?? 0;
    }
    const lower = sorted[middle - 1] ?? 0;
    const upper = sorted[middle] ?? 0;
    return (lower + upper) / 2;
}
function routeKeyFrom(origin, destination, departureDate) {
    return `${origin.toUpperCase()}-${destination.toUpperCase()}-${departureDate}`;
}
function normalizeSnapshot(snapshot) {
    const collectionDate = (snapshot.collectionDate ?? snapshot.collectedAt ?? new Date().toISOString()).trim().slice(0, 10);
    return {
        ...snapshot,
        id: snapshot.id.trim(),
        routeKey: snapshot.routeKey.trim().toUpperCase(),
        origin: snapshot.origin.trim().toUpperCase(),
        destination: snapshot.destination.trim().toUpperCase(),
        departureDate: snapshot.departureDate.trim(),
        bookingWindowDays: Math.max(0, Math.round(snapshot.bookingWindowDays ?? 0)),
        collectionDate,
        collectedAt: snapshot.collectedAt,
        sourceId: snapshot.sourceId?.trim() || undefined,
        airline: snapshot.airline.trim(),
        airlineCode: snapshot.airlineCode.trim().toUpperCase(),
        flightNumber: snapshot.flightNumber.trim(),
        departureTime: snapshot.departureTime.trim(),
        arrivalTime: snapshot.arrivalTime.trim(),
        durationMinutes: Math.max(0, Math.round(snapshot.durationMinutes)),
        stops: Math.max(0, Math.round(snapshot.stops)),
        price: Math.max(0, Math.round(snapshot.price)),
        currency: snapshot.currency.trim().toUpperCase(),
        seatsRemaining: Math.max(0, Math.round(snapshot.seatsRemaining)),
        source: snapshot.source.trim(),
        sourceType: snapshot.sourceType,
        confidence: Math.min(1, Math.max(0, Number(snapshot.confidence) || 0)),
    };
}
function computeSummary(snapshots) {
    const grouped = new Map();
    for (const snapshot of snapshots) {
        const existing = grouped.get(snapshot.routeKey);
        if (existing) {
            existing.push(snapshot);
        }
        else {
            grouped.set(snapshot.routeKey, [snapshot]);
        }
    }
    return [...grouped.entries()]
        .map(([routeKey, records]) => {
        const cheapest = [...records].sort((left, right) => left.price - right.price)[0];
        const routePrices = records.map((record) => record.price);
        const topCarrier = [...records].sort((left, right) => right.confidence - left.confidence)[0];
        const latest = [...records].sort((left, right) => right.collectedAt.localeCompare(left.collectedAt))[0];
        return {
            routeKey,
            origin: records[0]?.origin ?? '',
            destination: records[0]?.destination ?? '',
            departureDate: records[0]?.departureDate ?? '',
            bookingWindowDays: records[0]?.bookingWindowDays ?? 0,
            collectionDate: records[0]?.collectionDate ?? records[0]?.collectedAt?.slice(0, 10) ?? '',
            offerCount: records.length,
            cheapestPrice: cheapest?.price ?? 0,
            averagePrice: Math.round(average(routePrices)),
            medianPrice: Math.round(median(routePrices)),
            airfareIndex: 100,
            currency: cheapest?.currency ?? 'INR',
            topCarrier: topCarrier?.airline ?? 'Unknown airline',
            lastCollectedAt: latest?.collectedAt ?? '',
        };
    })
        .sort((left, right) => left.routeKey.localeCompare(right.routeKey));
}
function snapshotToDbRow(snapshot) {
    return [
        snapshot.id,
        snapshot.routeKey,
        snapshot.origin,
        snapshot.destination,
        snapshot.departureDate,
        snapshot.bookingWindowDays ?? 0,
        snapshot.collectionDate ?? snapshot.collectedAt.slice(0, 10),
        snapshot.collectedAt,
        snapshot.sourceId ?? null,
        snapshot.airline,
        snapshot.airlineCode,
        snapshot.flightNumber,
        snapshot.departureTime,
        snapshot.arrivalTime,
        snapshot.durationMinutes,
        snapshot.stops,
        snapshot.price,
        snapshot.currency,
        snapshot.seatsRemaining,
        snapshot.source,
        snapshot.sourceType,
        snapshot.confidence,
    ];
}
class FareStore {
    snapshots = [];
    pool = null;
    async getPool() {
        if (!DATABASE_URL) {
            return null;
        }
        if (!this.pool) {
            this.pool = new Pool({
                connectionString: DATABASE_URL,
                ssl: DATABASE_SSL ? { rejectUnauthorized: false } : undefined,
            });
        }
        return this.pool;
    }
    async ensureSchema() {
        const pool = await this.getPool();
        if (!pool) {
            return;
        }
        await pool.query(`
      create table if not exists normalized_fares (
        id text primary key,
        route_key text not null,
        origin_code char(3) not null,
        destination_code char(3) not null,
        departure_date date not null,
        booking_window_days integer not null default 0,
        collection_date date not null default current_date,
        collected_at timestamptz not null,
        source_id text,
        airline text not null,
        airline_code text not null,
        flight_number text not null,
        departure_time text not null,
        arrival_time text not null,
        duration_minutes integer not null,
        stops integer not null,
        price integer not null,
        currency char(3) not null,
        seats_remaining integer not null,
        source text not null,
        source_type text not null,
        confidence double precision not null
      );
    `);
        await pool.query('create index if not exists normalized_fares_route_key_idx on normalized_fares(route_key);');
        await pool.query('create index if not exists normalized_fares_departure_date_idx on normalized_fares(departure_date);');
        await pool.query('alter table normalized_fares add column if not exists booking_window_days integer not null default 0;');
        await pool.query('alter table normalized_fares add column if not exists collection_date date not null default current_date;');
        await pool.query('alter table normalized_fares add column if not exists source_id text;');
    }
    async loadFromDatabase() {
        const pool = await this.getPool();
        if (!pool) {
            return false;
        }
        await this.ensureSchema();
        const result = await pool.query('select * from normalized_fares order by price asc, collected_at desc');
        if (!result.rows.length) {
            return false;
        }
        this.snapshots = result.rows.map((row) => normalizeSnapshot({
            id: row.id,
            routeKey: row.route_key,
            origin: row.origin_code,
            destination: row.destination_code,
            departureDate: row.departure_date,
            bookingWindowDays: row.booking_window_days ?? 0,
            collectionDate: row.collection_date ?? row.collected_at,
            collectedAt: row.collected_at,
            sourceId: row.source_id ?? undefined,
            airline: row.airline,
            airlineCode: row.airline_code,
            flightNumber: row.flight_number,
            departureTime: row.departure_time,
            arrivalTime: row.arrival_time,
            durationMinutes: row.duration_minutes,
            stops: row.stops,
            price: row.price,
            currency: row.currency,
            seatsRemaining: row.seats_remaining,
            source: row.source,
            sourceType: row.source_type,
            confidence: row.confidence,
        }));
        return true;
    }
    async syncToDatabase() {
        const pool = await this.getPool();
        if (!pool) {
            return;
        }
        await this.ensureSchema();
        const client = await pool.connect();
        try {
            await client.query('begin');
            for (const snapshot of this.snapshots) {
                await client.query(`
          insert into normalized_fares (
            id, route_key, origin_code, destination_code, departure_date, booking_window_days, collection_date, collected_at,
            source_id, airline, airline_code, flight_number, departure_time, arrival_time, duration_minutes,
            stops, price, currency, seats_remaining, source, source_type, confidence
          ) values (
            $1, $2, $3, $4, $5, $6, $7, $8,
            $9, $10, $11, $12, $13, $14, $15,
            $16, $17, $18, $19, $20, $21, $22
          )
          on conflict (id) do update set
            route_key = excluded.route_key,
            origin_code = excluded.origin_code,
            destination_code = excluded.destination_code,
            departure_date = excluded.departure_date,
            booking_window_days = excluded.booking_window_days,
            collection_date = excluded.collection_date,
            collected_at = excluded.collected_at,
            source_id = excluded.source_id,
            airline = excluded.airline,
            airline_code = excluded.airline_code,
            flight_number = excluded.flight_number,
            departure_time = excluded.departure_time,
            arrival_time = excluded.arrival_time,
            duration_minutes = excluded.duration_minutes,
            stops = excluded.stops,
            price = excluded.price,
            currency = excluded.currency,
            seats_remaining = excluded.seats_remaining,
            source = excluded.source,
            source_type = excluded.source_type,
            confidence = excluded.confidence
        `, snapshotToDbRow(snapshot));
            }
            await client.query('commit');
        }
        catch (error) {
            await client.query('rollback');
            throw error;
        }
        finally {
            client.release();
        }
    }
    async persistToFile() {
        await mkdir(DATA_DIR, { recursive: true });
        const payload = {
            snapshots: this.snapshots,
            summary: computeSummary(this.snapshots),
        };
        await writeFile(DATA_FILE, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
    }
    async load() {
        const loadedFromDatabase = await this.loadFromDatabase().catch(() => false);
        if (loadedFromDatabase) {
            return;
        }
        if (ALLOW_FILE_CACHE) {
            try {
                const raw = await readFile(DATA_FILE, 'utf8');
                const parsed = JSON.parse(raw);
                const snapshots = Array.isArray(parsed) ? parsed : parsed.snapshots;
                if (Array.isArray(snapshots) && snapshots.length > 0) {
                    this.snapshots = snapshots.map(normalizeSnapshot);
                }
            }
            catch {
                this.snapshots = [];
            }
        }
        else {
            this.snapshots = DEFAULT_FARE_SNAPSHOTS.map(normalizeSnapshot);
        }
        await this.persist();
    }
    getSnapshots() {
        return [...this.snapshots];
    }
    getSummaries(origin, destination, departureDate) {
        const filtered = this.snapshots.filter((snapshot) => {
            if (origin && snapshot.origin !== origin.toUpperCase()) {
                return false;
            }
            if (destination && snapshot.destination !== destination.toUpperCase()) {
                return false;
            }
            if (departureDate && snapshot.departureDate !== departureDate) {
                return false;
            }
            return true;
        });
        return computeSummary(filtered);
    }
    search(origin, destination, departureDate, adults) {
        const normalizedOrigin = origin.trim().toUpperCase();
        const normalizedDestination = destination.trim().toUpperCase();
        const normalizedDate = departureDate.trim();
        const exactRouteKey = routeKeyFrom(normalizedOrigin, normalizedDestination, normalizedDate);
        const exactMatches = this.snapshots.filter((snapshot) => snapshot.routeKey === exactRouteKey);
        const routeMatches = exactMatches.length > 0
            ? exactMatches
            : this.snapshots.filter((snapshot) => snapshot.origin === normalizedOrigin && snapshot.destination === normalizedDestination);
        return snapshotsToOffers(routeMatches, adults);
    }
    replaceSnapshots(snapshots) {
        this.snapshots = snapshots.map(normalizeSnapshot);
    }
    upsertSnapshots(snapshots) {
        const existing = new Map(this.snapshots.map((snapshot) => [snapshot.id, snapshot]));
        for (const snapshot of snapshots) {
            existing.set(snapshot.id, normalizeSnapshot(snapshot));
        }
        this.snapshots = [...existing.values()].sort((left, right) => left.id.localeCompare(right.id));
    }
    async persist() {
        await this.persistToFile();
        await this.syncToDatabase().catch((error) => {
            console.warn('Skipping PostgreSQL sync for fare snapshots', error);
        });
    }
}
export const fareStore = new FareStore();
