import { loadTrackedRoutes } from '../data/trackedRoutes.js';
import { searchDuffelOffers } from '../providers/duffel.js';
const IST_TIME_ZONE = 'Asia/Kolkata';
export const ADVANCE_WINDOWS = [1, 7, 15, 30, 45];
const DUFFEL_RETRIES = Math.max(0, Number(process.env.DUFFEL_RETRIES ?? '2'));
const MAX_CONCURRENT_COLLECTIONS = 2;
function todayInIndia() {
    return new Intl.DateTimeFormat('en-CA', { timeZone: IST_TIME_ZONE }).format(new Date());
}
function addDays(date, days) {
    const value = new Date(`${date}T00:00:00Z`);
    value.setUTCDate(value.getUTCDate() + days);
    return value.toISOString().slice(0, 10);
}
function routeInput(route, collectionDate) {
    return {
        origin: route.origin,
        destination: route.destination,
        departureDate: route.departureDate ?? addDays(collectionDate, route.bookingWindowDays ?? 1),
        adults: route.adults ?? 1,
    };
}
function routeInputs(route, collectionDate) {
    if (route.departureDate || route.bookingWindowDays !== undefined) {
        return [routeInput(route, collectionDate)];
    }
    return ADVANCE_WINDOWS.map((bookingWindowDays) => routeInput({ ...route, bookingWindowDays }, collectionDate));
}
function flightKey(snapshot) {
    return [snapshot.routeKey, snapshot.airlineCode, snapshot.flightNumber, snapshot.departureTime].join('|').toUpperCase();
}
function cheapestUnique(snapshots) {
    const byFlight = new Map();
    for (const snapshot of snapshots) {
        const current = byFlight.get(flightKey(snapshot));
        if (!current || snapshot.price < current.price)
            byFlight.set(flightKey(snapshot), snapshot);
    }
    return [...byFlight.values()].sort((left, right) => left.price - right.price);
}
function offerToSnapshot(offer, input, sourceType = 'duffel') {
    const collectionDate = todayInIndia();
    return {
        id: `${offer.offerId}-${collectionDate}`,
        routeKey: `${offer.origin}-${offer.destination}-${input.departureDate}`,
        origin: offer.origin,
        destination: offer.destination,
        departureDate: input.departureDate,
        bookingWindowDays: Math.max(0, Math.round((new Date(`${input.departureDate}T00:00:00Z`).getTime() - new Date(`${collectionDate}T00:00:00Z`).getTime()) / 86_400_000)),
        collectionDate,
        collectedAt: offer.collectedAt,
        sourceId: sourceType,
        collectionStage: sourceType === 'duffel' ? 'DUFFEL' : 'DEMO',
        airline: offer.airline,
        airlineCode: offer.airlineCode,
        flightNumber: offer.flightNumber,
        departureTime: offer.departureTime,
        arrivalTime: offer.arrivalTime,
        durationMinutes: Number.parseInt(offer.duration, 10) * 60 + Number.parseInt(offer.duration.match(/(\d{2})m/)?.[1] ?? '0', 10),
        stops: offer.stops,
        price: offer.price,
        baseFare: offer.baseFare,
        taxes: offer.taxes,
        udf: offer.udf,
        convenienceFee: offer.convenienceFee,
        totalFare: offer.totalFare ?? offer.price,
        currency: offer.currency,
        seatsRemaining: offer.seatsRemaining,
        soldOut: offer.seatsRemaining <= 0,
        source: offer.source,
        sourceType,
        confidence: offer.confidence,
    };
}
async function collectDuffel(input) {
    for (let attempt = 0; attempt <= DUFFEL_RETRIES; attempt += 1) {
        try {
            return (await searchDuffelOffers(input)).map((offer) => offerToSnapshot(offer, input));
        }
        catch (error) {
            if (attempt === DUFFEL_RETRIES) {
                console.warn(`[duffel] FAILED route=${input.origin}-${input.destination}-${input.departureDate}: ${error instanceof Error ? error.message : String(error)}`);
            }
        }
    }
    return [];
}
async function mapWithConcurrency(items, worker) {
    const results = new Array(items.length);
    let cursor = 0;
    async function consume() {
        while (true) {
            const index = cursor;
            cursor += 1;
            if (index >= items.length)
                return;
            results[index] = await worker(items[index]);
        }
    }
    await Promise.all(Array.from({ length: Math.min(MAX_CONCURRENT_COLLECTIONS, items.length) }, () => consume()));
    return results;
}
async function collectForInputs(inputs) {
    const results = await mapWithConcurrency(inputs, async (input) => {
        const duffel = await collectDuffel(input);
        if (!duffel.length) {
            console.warn(`[Fare Collection] No verified Duffel offers for ${input.origin}-${input.destination}-${input.departureDate}`);
        }
        return duffel;
    });
    const collectionDate = todayInIndia();
    const snapshots = results.flat().map((snapshot) => {
        const departure = new Date(`${snapshot.departureDate}T00:00:00Z`).getTime();
        const collection = new Date(`${collectionDate}T00:00:00Z`).getTime();
        const bookingWindowDays = Number.isFinite(departure) && Number.isFinite(collection)
            ? Math.max(0, Math.round((departure - collection) / 86_400_000))
            : snapshot.bookingWindowDays ?? 0;
        return { ...snapshot, bookingWindowDays };
    });
    return cheapestUnique(snapshots);
}
export async function collectFareSnapshots() {
    const collectionDate = todayInIndia();
    return collectForInputs(loadTrackedRoutes().flatMap((route) => routeInputs(route, collectionDate)));
}
export async function collectFareSnapshotsForRoute(route) {
    const collectionDate = todayInIndia();
    return collectForInputs([routeInput(route, collectionDate)]);
}
