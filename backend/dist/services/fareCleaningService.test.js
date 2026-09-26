import assert from 'node:assert/strict';
import test from 'node:test';
import { cleanFareSnapshots } from './fareCleaningService.js';
import { ADVANCE_WINDOWS } from './fareCollector.js';
function snapshot(id, price) {
    return {
        id,
        routeKey: 'PAT-BOM-2026-10-01',
        origin: 'PAT',
        destination: 'BOM',
        departureDate: '2026-10-01',
        collectedAt: '2026-09-01T00:00:00.000Z',
        airline: 'Test Air',
        airlineCode: 'TA',
        flightNumber: 'TA101',
        departureTime: '10:00',
        arrivalTime: '12:00',
        durationMinutes: 120,
        stops: 0,
        price,
        currency: 'INR',
        seatsRemaining: 2,
        source: 'test',
        sourceType: 'duffel',
        confidence: 1,
    };
}
test('cleaning deduplicates records and scores accepted records', () => {
    const result = cleanFareSnapshots([snapshot('one', 4000), snapshot('two', 4000)]);
    assert.equal(result.cleaned.length, 1);
    assert.equal(result.duplicateRecords, 1);
    assert.equal(result.cleaned[0]?.dataQualityStatus, 'valid');
    assert.equal(result.cleaned[0]?.dataQualityScore, 100);
});
test('cleaning rejects invalid and extreme fare records', () => {
    const result = cleanFareSnapshots([snapshot('one', 4000), snapshot('two', 4100), snapshot('three', 4200), snapshot('four', 50000)]);
    assert.equal(result.outlierRecords, 1);
    assert.equal(result.cleaned.length, 3);
    assert.equal(result.rejected.at(-1)?.dataQualityStatus, 'outlier');
});
test('collection supports the required advance windows', () => {
    assert.deepEqual([...ADVANCE_WINDOWS], [1, 7, 15, 30, 45]);
});
