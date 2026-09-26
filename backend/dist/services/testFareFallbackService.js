import { readFile } from 'node:fs/promises';
const FALLBACK_DATA_URL = new URL('../../test.json', import.meta.url);
function validIsoDate(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value))
        return false;
    const date = new Date(`${value}T00:00:00Z`);
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
export async function getCompatibleTestFareObservations(input) {
    const requestedOrigin = input.origin.trim().toUpperCase();
    const requestedDestination = input.destination.trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(requestedOrigin) || !/^[A-Z]{3}$/.test(requestedDestination) || !validIsoDate(input.travelDate))
        return [];
    let dataset;
    try {
        dataset = JSON.parse(await readFile(FALLBACK_DATA_URL, 'utf8'));
    }
    catch (error) {
        console.warn('[DATA SOURCE] Test fallback dataset unavailable:', error instanceof Error ? error.message : String(error));
        return [];
    }
    if (dataset.meta?.isDemo !== true || dataset.meta.dataOrigin !== 'demo' || !Array.isArray(dataset.fareObservations))
        return [];
    return dataset.fareObservations.flatMap((record) => {
        const origin = typeof record.origin === 'string' ? record.origin.trim().toUpperCase() : '';
        const destination = typeof record.destination === 'string' ? record.destination.trim().toUpperCase() : '';
        const fare = Number(record.totalFare);
        const currency = typeof record.currency === 'string' ? record.currency.trim().toUpperCase() : '';
        const collectionDate = record.collectionDate;
        const travelDate = record.travelDate;
        const airline = typeof record.airline === 'string' ? record.airline.trim() : '';
        const flightNumber = typeof record.flightNumber === 'string' ? record.flightNumber.trim() : '';
        if (record.dataOrigin !== 'demo' || record.validationStatus !== 'eligible' || record.availability !== 'AVAILABLE' ||
            origin !== requestedOrigin || destination !== requestedDestination || travelDate !== input.travelDate ||
            !validIsoDate(collectionDate) || !validIsoDate(travelDate) || !Number.isFinite(fare) || fare <= 0 ||
            !/^[A-Z]{3}$/.test(currency) || !airline || !flightNumber)
            return [];
        return [{
                id: `test-fallback:${String(record.id ?? `${origin}-${destination}-${travelDate}-${flightNumber}`)}`,
                origin,
                destination,
                collectionDate,
                travelDate,
                airline,
                flightNumber,
                departure: typeof record.departure === 'string' ? record.departure : null,
                arrival: typeof record.arrival === 'string' ? record.arrival : null,
                durationMinutes: Number.isFinite(Number(record.durationMinutes)) ? Number(record.durationMinutes) : null,
                stops: Number.isInteger(Number(record.stops)) && Number(record.stops) >= 0 ? Number(record.stops) : null,
                fare,
                currency,
                advancePurchaseDays: Number.isInteger(Number(record.advancePurchaseDays)) && Number(record.advancePurchaseDays) >= 0 ? Number(record.advancePurchaseDays) : null,
                source: 'Reference/Test fallback',
                sourceType: 'test-fallback',
            }];
    });
}
