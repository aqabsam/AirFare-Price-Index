import assert from 'node:assert/strict';
import test from 'node:test';
import { getCompatibleTestFareObservations } from './testFareFallbackService.js';
test('test fallback returns only eligible records matching exact route and departure date', async () => {
    const matches = await getCompatibleTestFareObservations({ origin: 'DEL', destination: 'BOM', travelDate: '2026-09-27' });
    assert.equal(matches.length, 1);
    assert.equal(matches[0]?.id, 'test-fallback:demo-001');
    assert.equal(matches[0]?.fare, 6050);
    assert.equal(matches[0]?.advancePurchaseDays, 1);
    assert.equal(matches[0]?.sourceType, 'test-fallback');
    assert.equal(matches[0]?.source, 'Reference/Test fallback');
    const wrongRoute = await getCompatibleTestFareObservations({ origin: 'HYD', destination: 'DEL', travelDate: '2026-09-27' });
    const matchingFutureDate = await getCompatibleTestFareObservations({ origin: 'DEL', destination: 'BOM', travelDate: '2026-10-03' });
    assert.deepEqual(wrongRoute, []);
    assert.equal(matchingFutureDate.length, 1);
    assert.equal(matchingFutureDate[0]?.id, 'test-fallback:demo-002');
});
