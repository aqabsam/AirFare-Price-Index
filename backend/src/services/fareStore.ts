import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { Pool } from 'pg'
import { DEFAULT_FARE_SNAPSHOTS } from '../data/fareCatalog.js'
import type { NormalizedFlightOffer } from '../types/flight.js'
import type { FareCatalogResponse, FareRouteSummary, FareSnapshot } from '../types/fare.js'

const DATA_DIR = path.resolve(process.cwd(), 'data')
const DATA_FILE = path.join(DATA_DIR, 'fare-snapshots.json')
const DATABASE_URL = process.env.DATABASE_URL?.trim() || ''
const DATABASE_SSL = process.env.DATABASE_SSL?.trim().toLowerCase() === 'require'
const ALLOW_FILE_CACHE = process.env.FARE_ALLOW_FILE_CACHE?.trim().toLowerCase() === 'true'
const ALLOW_DEMO_DATA = process.env.FARE_ALLOW_DEMO_DATA?.trim().toLowerCase() === 'true'

type DbFareRow = {
  id: string
  route_key: string
  origin_code: string
  destination_code: string
  departure_date: string
  booking_window_days: number
  collection_date: string
  collected_at: string
  source_id?: string | null
  airline: string
  airline_code: string
  flight_number: string
  departure_time: string
  arrival_time: string
  duration_minutes: number
  stops: number
  price: number
  base_fare?: number | null
  taxes?: number | null
  udf?: number | null
  convenience_fee?: number | null
  total_fare?: number | null
  currency: string
  seats_remaining: number
  source: string
  source_type: FareSnapshot['sourceType']
  collection_stage?: FareSnapshot['collectionStage'] | null
  confidence: number
  fare_class?: string | null
  sold_out?: boolean | null
  data_quality_score?: number | null
  data_quality_status?: FareSnapshot['dataQualityStatus'] | null
  rejected_reason?: string | null
}

export type IndexSnapshotRecord = {
  routeKey: string
  departureDate: string
  cheapestPrice: number
  averagePrice: number
  medianPrice: number
  airfareIndex: number
  calculatedAt: string
}

type DbRawFareRow = {
  raw_record_key: string
  source: string
  route_key: string
  origin_code: string
  destination_code: string
  departure_date: string
  collected_at: string
  source_type: FareSnapshot['sourceType']
  collection_stage?: FareSnapshot['collectionStage'] | null
  payload: FareSnapshot
}

type DbRejectedFareRow = DbRawFareRow & {
  rejection_reason: string
  data_quality_status?: FareSnapshot['dataQualityStatus'] | null
  data_quality_score?: number | null
}

function formatDuration(minutes: number) {
  const hours = Math.floor(minutes / 60)
  const remainder = minutes % 60
  return `${hours}h ${String(remainder).padStart(2, '0')}m`
}

export function snapshotsToOffers(snapshots: FareSnapshot[], adults: number): NormalizedFlightOffer[] {
  return snapshots
    .filter((snapshot) => snapshot.seatsRemaining <= 0 || snapshot.seatsRemaining >= adults)
    .map((snapshot) => {
      const isManualReference = snapshot.sourceType === 'aggregated'

      return {
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
        source: isManualReference ? 'Manual/Reference Data' : snapshot.source,
        sourceType: snapshot.sourceType,
        collectedAt: snapshot.collectedAt,
        confidence: snapshot.confidence,
      }
    })
    .sort((left, right) => left.price - right.price)
}

function snapshotsToDemoOffers(snapshots: FareSnapshot[], adults: number): NormalizedFlightOffer[] {
  return snapshotsToOffers(snapshots, adults).map((offer) => ({
    ...offer,
    source: 'Demo data',
    sourceType: 'demo',
  }))
}

function average(values: number[]) {
  if (!values.length) {
    return 0
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function median(values: number[]) {
  if (!values.length) {
    return 0
  }

  const sorted = [...values].sort((left, right) => left - right)
  const middle = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 1) {
    return sorted[middle] ?? 0
  }

  const lower = sorted[middle - 1] ?? 0
  const upper = sorted[middle] ?? 0
  return (lower + upper) / 2
}

function routeKeyFrom(origin: string, destination: string, departureDate: string) {
  return `${origin.toUpperCase()}-${destination.toUpperCase()}-${departureDate}`
}

function normalizeSnapshot(snapshot: FareSnapshot): FareSnapshot {
  const collectionDate = (snapshot.collectionDate ?? snapshot.collectedAt ?? new Date().toISOString()).trim().slice(0, 10)
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
    collectionStage: snapshot.collectionStage ?? (snapshot.sourceType === 'duffel' ? 'DUFFEL' : snapshot.sourceType === 'demo' || snapshot.sourceType === 'aggregated' ? 'DEMO' : 'SCRAPER'),
    sourceType: snapshot.sourceType,
    confidence: Math.min(1, Math.max(0, Number(snapshot.confidence) || 0)),
    fareClass: snapshot.fareClass?.trim() || null,
    soldOut: snapshot.soldOut ?? snapshot.seatsRemaining <= 0,
    dataQualityScore: snapshot.dataQualityScore ?? null,
    dataQualityStatus: snapshot.dataQualityStatus ?? 'valid',
    rejectedReason: snapshot.rejectedReason ?? null,
  }
}

function computeSummary(snapshots: FareSnapshot[]): FareRouteSummary[] {
  const grouped = new Map<string, FareSnapshot[]>()

  for (const snapshot of snapshots) {
    const existing = grouped.get(snapshot.routeKey)
    if (existing) {
      existing.push(snapshot)
    } else {
      grouped.set(snapshot.routeKey, [snapshot])
    }
  }

  return [...grouped.entries()]
    .map(([routeKey, records]) => {
      const cheapest = [...records].sort((left, right) => left.price - right.price)[0]
      const routePrices = records.map((record) => record.price)
      const topCarrier = [...records].sort((left, right) => right.confidence - left.confidence)[0]
      const latest = [...records].sort((left, right) => right.collectedAt.localeCompare(left.collectedAt))[0]

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
      }
    })
    .sort((left, right) => left.routeKey.localeCompare(right.routeKey))
}

function snapshotToDbRow(snapshot: FareSnapshot) {
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
    snapshot.baseFare ?? null,
    snapshot.taxes ?? null,
    snapshot.udf ?? null,
    snapshot.convenienceFee ?? null,
    snapshot.totalFare ?? snapshot.price,
    snapshot.currency,
    snapshot.seatsRemaining,
    snapshot.source,
    snapshot.sourceType,
    snapshot.confidence,
    snapshot.fareClass ?? null,
    snapshot.soldOut ?? snapshot.seatsRemaining <= 0,
    snapshot.dataQualityScore ?? null,
    snapshot.dataQualityStatus ?? 'valid',
    snapshot.rejectedReason ?? null,
    snapshot.collectionStage ?? (snapshot.sourceType === 'duffel' ? 'DUFFEL' : snapshot.sourceType === 'demo' || snapshot.sourceType === 'aggregated' ? 'DEMO' : 'SCRAPER'),
  ]
}

class FareStore {
  private snapshots: FareSnapshot[] = []
  private rawSnapshots: FareSnapshot[] = []
  private rejectedSnapshots: FareSnapshot[] = []
  private indexHistory: IndexSnapshotRecord[] = []
  private pool: Pool | null = null

  private async getPool() {
    if (!DATABASE_URL) {
      return null
    }

    if (!this.pool) {
      this.pool = new Pool({
        connectionString: DATABASE_URL,
        ssl: DATABASE_SSL ? { rejectUnauthorized: false } : undefined,
      })
    }

    return this.pool
  }

  private async ensureSchema() {
    const pool = await this.getPool()
    if (!pool) {
      return
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
    `)
    await pool.query(`
      create table if not exists raw_fare_pages (
        id bigserial primary key,
        raw_record_key text not null unique,
        source text not null,
        route_key text not null,
        origin_code char(3) not null,
        destination_code char(3) not null,
        departure_date date not null,
        collected_at timestamptz not null,
        source_type text not null,
        collection_stage text,
        payload jsonb not null
      );
    `)
    await pool.query(`
      create table if not exists rejected_fares (
        raw_record_key text primary key,
        source text not null,
        route_key text not null,
        origin_code char(3) not null,
        destination_code char(3) not null,
        departure_date date not null,
        collected_at timestamptz not null,
        source_type text not null,
        collection_stage text,
        rejection_reason text not null,
        data_quality_status text,
        data_quality_score integer,
        payload jsonb not null
      );
    `)
    await pool.query(`
      create table if not exists airfare_index_snapshots (
        id bigserial primary key,
        snapshot_key text not null unique,
        route_key text not null,
        departure_date date not null,
        cheapest_price numeric(12, 2) not null,
        average_price numeric(12, 2) not null,
        median_price numeric(12, 2) not null,
        airfare_index numeric(12, 4) not null,
        calculated_at timestamptz not null
      );
    `)
    await pool.query('alter table raw_fare_pages add column if not exists raw_record_key text;')
    await pool.query('alter table raw_fare_pages add column if not exists source_type text;')
    await pool.query('alter table raw_fare_pages add column if not exists collection_stage text;')
    await pool.query('create unique index if not exists raw_fare_pages_record_key_idx on raw_fare_pages(raw_record_key);')
    await pool.query('alter table airfare_index_snapshots add column if not exists snapshot_key text;')
    await pool.query('alter table airfare_index_snapshots add column if not exists calculated_at timestamptz;')
    await pool.query('create unique index if not exists airfare_index_snapshots_key_idx on airfare_index_snapshots(snapshot_key);')
    await pool.query('create index if not exists normalized_fares_route_key_idx on normalized_fares(route_key);')
    await pool.query('create index if not exists normalized_fares_departure_date_idx on normalized_fares(departure_date);')
    await pool.query('alter table normalized_fares add column if not exists booking_window_days integer not null default 0;')
    await pool.query('alter table normalized_fares add column if not exists collection_date date not null default current_date;')
    await pool.query('alter table normalized_fares add column if not exists source_id text;')
    await pool.query('alter table normalized_fares add column if not exists base_fare integer;')
    await pool.query('alter table normalized_fares add column if not exists taxes integer;')
    await pool.query('alter table normalized_fares add column if not exists udf integer;')
    await pool.query('alter table normalized_fares add column if not exists convenience_fee integer;')
    await pool.query('alter table normalized_fares add column if not exists total_fare integer;')
    await pool.query('alter table normalized_fares add column if not exists fare_class text;')
    await pool.query('alter table normalized_fares add column if not exists sold_out boolean not null default false;')
    await pool.query('alter table normalized_fares add column if not exists data_quality_score integer;')
    await pool.query('alter table normalized_fares add column if not exists data_quality_status text;')
    await pool.query('alter table normalized_fares add column if not exists rejected_reason text;')
    await pool.query('alter table normalized_fares add column if not exists collection_stage text;')
  }

  private async loadFromDatabase() {
    const pool = await this.getPool()
    if (!pool) {
      return false
    }

    await this.ensureSchema()
    const result = await pool.query<DbFareRow>('select * from normalized_fares order by price asc, collected_at desc')

    if (!result.rows.length) {
      return false
    }

    this.snapshots = result.rows.map((row: DbFareRow) =>
      normalizeSnapshot({
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
        baseFare: row.base_fare,
        taxes: row.taxes,
        udf: row.udf,
        convenienceFee: row.convenience_fee,
        totalFare: row.total_fare,
        currency: row.currency,
        seatsRemaining: row.seats_remaining,
        source: row.source,
        sourceType: row.source_type,
        collectionStage: row.collection_stage ?? undefined,
        confidence: row.confidence,
        fareClass: row.fare_class,
        soldOut: row.sold_out ?? undefined,
        dataQualityScore: row.data_quality_score ?? undefined,
        dataQualityStatus: row.data_quality_status ?? undefined,
        rejectedReason: row.rejected_reason,
      }),
    )

    const rawResult = await pool.query<DbRawFareRow>('select * from raw_fare_pages order by collected_at desc')
    this.rawSnapshots = rawResult.rows.map((row) => normalizeSnapshot(row.payload))

    const rejectedResult = await pool.query<DbRejectedFareRow>('select * from rejected_fares order by collected_at desc')
    this.rejectedSnapshots = rejectedResult.rows.map((row) => normalizeSnapshot({
      ...row.payload,
      dataQualityStatus: row.data_quality_status ?? row.payload.dataQualityStatus,
      dataQualityScore: row.data_quality_score ?? row.payload.dataQualityScore,
      rejectedReason: row.rejection_reason,
    }))

    const historyResult = await pool.query<IndexSnapshotRecord>('select route_key as "routeKey", departure_date as "departureDate", cheapest_price as "cheapestPrice", average_price as "averagePrice", median_price as "medianPrice", airfare_index as "airfareIndex", calculated_at as "calculatedAt" from airfare_index_snapshots order by calculated_at desc')
    this.indexHistory = historyResult.rows

    return true
  }

  private async syncToDatabase(indexSnapshots: IndexSnapshotRecord[] = []) {
    const pool = await this.getPool()
    if (!pool) {
      return
    }

    await this.ensureSchema()
    const client = await pool.connect()
    try {
      await client.query('begin')
      for (const snapshot of this.snapshots) {
        await client.query(
          `
          insert into normalized_fares (
            id, route_key, origin_code, destination_code, departure_date, booking_window_days, collection_date, collected_at,
            source_id, airline, airline_code, flight_number, departure_time, arrival_time, duration_minutes,
            stops, price, base_fare, taxes, udf, convenience_fee, total_fare, currency, seats_remaining, source, source_type, confidence,
            fare_class, sold_out, data_quality_score, data_quality_status, rejected_reason, collection_stage
          ) values (
            $1, $2, $3, $4, $5, $6, $7, $8,
            $9, $10, $11, $12, $13, $14, $15,
            $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33
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
            base_fare = excluded.base_fare,
            taxes = excluded.taxes,
            udf = excluded.udf,
            convenience_fee = excluded.convenience_fee,
            total_fare = excluded.total_fare,
            currency = excluded.currency,
            seats_remaining = excluded.seats_remaining,
            source = excluded.source,
            source_type = excluded.source_type,
            confidence = excluded.confidence,
            fare_class = excluded.fare_class,
            sold_out = excluded.sold_out,
            data_quality_score = excluded.data_quality_score,
            data_quality_status = excluded.data_quality_status,
            rejected_reason = excluded.rejected_reason,
            collection_stage = excluded.collection_stage
        `,
          snapshotToDbRow(snapshot),
        )
      }
      for (const snapshot of this.rawSnapshots) {
        await client.query(
          `insert into raw_fare_pages (raw_record_key, source, route_key, origin_code, destination_code, departure_date, collected_at, source_type, collection_stage, payload)
           values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           on conflict (raw_record_key) do update set payload = excluded.payload, collected_at = excluded.collected_at`,
          [rawRecordKey(snapshot), snapshot.source, snapshot.routeKey, snapshot.origin, snapshot.destination, snapshot.departureDate, snapshot.collectedAt, snapshot.sourceType, snapshot.collectionStage, snapshot],
        )
      }
      for (const snapshot of this.rejectedSnapshots) {
        await client.query(
          `insert into rejected_fares (raw_record_key, source, route_key, origin_code, destination_code, departure_date, collected_at, source_type, collection_stage, rejection_reason, data_quality_status, data_quality_score, payload)
           values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
           on conflict (raw_record_key) do update set rejection_reason = excluded.rejection_reason, payload = excluded.payload`,
          [rawRecordKey(snapshot), snapshot.source, snapshot.routeKey, snapshot.origin, snapshot.destination, snapshot.departureDate, snapshot.collectedAt, snapshot.sourceType, snapshot.collectionStage, snapshot.rejectedReason ?? 'Rejected during cleaning', snapshot.dataQualityStatus, snapshot.dataQualityScore, snapshot],
        )
      }
      for (const snapshot of indexSnapshots) {
        const snapshotKey = `${snapshot.routeKey}|${snapshot.departureDate}|${snapshot.calculatedAt}`
        await client.query(
          `insert into airfare_index_snapshots (snapshot_key, route_key, departure_date, cheapest_price, average_price, median_price, airfare_index, calculated_at)
           values ($1, $2, $3, $4, $5, $6, $7, $8)
           on conflict (snapshot_key) do nothing`,
          [snapshotKey, snapshot.routeKey, snapshot.departureDate, snapshot.cheapestPrice, snapshot.averagePrice, snapshot.medianPrice, snapshot.airfareIndex, snapshot.calculatedAt],
        )
      }
      await client.query('commit')
    } catch (error) {
      await client.query('rollback')
      throw error
    } finally {
      client.release()
    }
  }

  private async persistToFile() {
    await mkdir(DATA_DIR, { recursive: true })
    const payload: FareCatalogResponse = {
      snapshots: this.snapshots,
      summary: computeSummary(this.snapshots),
    }
    await writeFile(DATA_FILE, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
  }

  async load() {
    const loadedFromDatabase = await this.loadFromDatabase().catch(() => false)
    if (loadedFromDatabase) {
      return
    }

    if (ALLOW_FILE_CACHE) {
      try {
        const raw = await readFile(DATA_FILE, 'utf8')
        const parsed = JSON.parse(raw) as FareCatalogResponse | FareSnapshot[]
        const snapshots = Array.isArray(parsed) ? parsed : parsed.snapshots
        if (Array.isArray(snapshots) && snapshots.length > 0) {
          this.snapshots = snapshots.map(normalizeSnapshot)
          this.rawSnapshots = [...this.snapshots]
          return
        }
      } catch {
        this.snapshots = []
      }
    }

    const fallbackSnapshots = ALLOW_DEMO_DATA && DEFAULT_FARE_SNAPSHOTS.length ? DEFAULT_FARE_SNAPSHOTS : []
    if (fallbackSnapshots.length > 0) {
      this.snapshots = fallbackSnapshots.map(normalizeSnapshot)
      this.rawSnapshots = [...this.snapshots]
    } else {
      this.snapshots = []
      this.rawSnapshots = []
    }

    await this.persist()
  }

  getSnapshots() {
    return [...this.snapshots]
  }

  getRawSnapshots() {
    return [...this.rawSnapshots]
  }

  getRejectedSnapshots() {
    return [...this.rejectedSnapshots]
  }

  getIndexHistory() {
    return [...this.indexHistory]
  }

  getSummaries(origin?: string, destination?: string, departureDate?: string) {
    const filtered = this.snapshots.filter((snapshot) => {
      if (snapshot.sourceType === 'aggregated') {
        return false
      }

      if (origin && snapshot.origin !== origin.toUpperCase()) {
        return false
      }

      if (destination && snapshot.destination !== destination.toUpperCase()) {
        return false
      }

      if (departureDate && snapshot.departureDate !== departureDate) {
        return false
      }

      return true
    })

    return computeSummary(filtered)
  }

  search(origin: string, destination: string, departureDate: string, adults: number): NormalizedFlightOffer[] {
    const normalizedOrigin = origin.trim().toUpperCase()
    const normalizedDestination = destination.trim().toUpperCase()
    const normalizedDate = departureDate.trim()
    const exactRouteKey = routeKeyFrom(normalizedOrigin, normalizedDestination, normalizedDate)

    const exactMatches = this.snapshots.filter((snapshot) => snapshot.routeKey === exactRouteKey)
    return snapshotsToOffers(exactMatches, adults)
  }

  searchDemo(origin: string, destination: string, departureDate: string, adults: number): NormalizedFlightOffer[] {
    const normalizedOrigin = origin.trim().toUpperCase()
    const normalizedDestination = destination.trim().toUpperCase()
    const normalizedDate = departureDate.trim()
    const exactRouteKey = routeKeyFrom(normalizedOrigin, normalizedDestination, normalizedDate)
    const exactMatches = this.snapshots.filter((snapshot) => snapshot.routeKey === exactRouteKey && snapshot.sourceType === 'aggregated')
    return snapshotsToDemoOffers(exactMatches, adults)
  }

  replaceSnapshots(snapshots: FareSnapshot[], rejectedSnapshots: FareSnapshot[] = [], rawSnapshots: FareSnapshot[] = snapshots) {
    this.snapshots = snapshots.map(normalizeSnapshot)
    this.rawSnapshots = rawSnapshots.map(normalizeSnapshot)
    this.rejectedSnapshots = rejectedSnapshots.map(normalizeSnapshot)
  }

  upsertSnapshots(snapshots: FareSnapshot[]) {
    const existing = new Map(this.snapshots.map((snapshot) => [snapshot.id, snapshot] as const))

    for (const snapshot of snapshots) {
      existing.set(snapshot.id, normalizeSnapshot(snapshot))
    }

    this.snapshots = [...existing.values()].sort((left, right) => left.id.localeCompare(right.id))
  }

  async persist(indexSnapshots: IndexSnapshotRecord[] = []) {
    this.indexHistory.push(...indexSnapshots)
    await this.persistToFile()
    await this.syncToDatabase(indexSnapshots).catch((error) => {
      console.warn('Skipping PostgreSQL sync for fare snapshots', error)
    })
  }
}

function rawRecordKey(snapshot: FareSnapshot) {
  return [snapshot.id, snapshot.routeKey, snapshot.collectedAt, snapshot.price].join('|')
}

export const fareStore = new FareStore()
