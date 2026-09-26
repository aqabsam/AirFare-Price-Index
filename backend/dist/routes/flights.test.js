import assert from 'node:assert/strict';
import test from 'node:test';
import { flightSearchSchema } from './flights.js';
const validRoutes = [
    ['PAT', 'BOM'],
    ['CCU', 'DEL'],
    ['DEL', 'BOM'],
    ['BOM', 'DEL'],
    ['HYD', 'COK'],
];
test('flight search accepts the requested valid Indian domestic routes', () => {
    for (const [origin, destination] of validRoutes) {
        const parsed = flightSearchSchema.safeParse({
            origin,
            destination,
            departureDate: '2026-09-27',
            adults: 1,
        });
        assert.equal(parsed.success, true, `${origin} -> ${destination} should be accepted`);
        if (parsed.success) {
            assert.deepEqual(parsed.data, { origin, destination, departureDate: '2026-09-27', adults: 1 });
        }
    }
});
test('flight search normalizes airport codes and accepts current and future dates', () => {
    const today = new Date().toISOString().slice(0, 10);
    const tomorrowDate = new Date(`${today}T00:00:00.000Z`);
    tomorrowDate.setUTCDate(tomorrowDate.getUTCDate() + 1);
    const tomorrow = tomorrowDate.toISOString().slice(0, 10);
    for (const departureDate of [today, tomorrow]) {
        const parsed = flightSearchSchema.safeParse({ origin: ' pat ', destination: ' bom ', departureDate });
        assert.equal(parsed.success, true, `date ${departureDate} should be accepted`);
        if (parsed.success)
            assert.equal(parsed.data.origin, 'PAT');
    }
});
test('flight search rejects unknown airports, identical airports, and invalid calendar dates', () => {
    assert.equal(flightSearchSchema.safeParse({ origin: 'XYZ', destination: 'BOM', departureDate: '2026-09-27', adults: 1 }).success, false);
    assert.equal(flightSearchSchema.safeParse({ origin: 'PAT', destination: 'PAT', departureDate: '2026-09-27', adults: 1 }).success, false);
    assert.equal(flightSearchSchema.safeParse({ origin: 'PAT', destination: 'BOM', departureDate: '2026-02-30', adults: 1 }).success, false);
    assert.equal(flightSearchSchema.safeParse({ origin: 'PAT', destination: 'BOM', departureDate: '27-09-2026', adults: 1 }).success, false);
});
