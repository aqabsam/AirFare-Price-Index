import assert from 'node:assert/strict';
import test from 'node:test';
import { hasDuffelTestAccessToken, normalizeDuffelOffer, searchDuffelOffers } from '../providers/duffel.js';
import { canonicalizeScrapedOffer, deduplicateOffers, hasMatchingFlightCarrier, searchFlightsFromDuffel, timestampSearchOffers } from './flightService.js';
test('deduplicates identical schedules and keeps distinct arrival schedules', () => {
    const directOffer = {
        airline: 'Air India', airlineCode: 'AI', flightNumber: 'AI2472', origin: 'CCU', destination: 'DEL',
        departureDate: '2026-09-26', liveMode: true, departureTime: '08:00', arrivalTime: '10:10', duration: '2h 10m',
        stops: 0, price: 6200, currency: 'INR', offerId: 'direct-ai2472', seatsRemaining: 1,
        source: 'Air India website', sourceType: 'airline', collectedAt: '2026-09-26T02:00:00.000Z', confidence: 0.9,
    };
    const otaDuplicate = {
        ...directOffer,
        arrivalTime: '10:10',
        price: 5900,
        offerId: 'ota-ai2472',
        source: 'OTA listing',
        sourceType: 'ota',
        confidence: 0.8,
    };
    const differentArrival = { ...directOffer, arrivalTime: '10:35', offerId: 'direct-ai2472-later-arrival' };
    const differentDeparture = { ...directOffer, departureTime: '09:00', offerId: 'direct-ai2472-later' };
    const results = deduplicateOffers([otaDuplicate, directOffer, differentArrival, differentDeparture]);
    assert.equal(results.length, 3);
    assert.ok(results.some((offer) => offer.offerId === 'direct-ai2472' && offer.price === 6200));
    assert.ok(results.some((offer) => offer.offerId === 'direct-ai2472-later-arrival'));
    assert.ok(!results.some((offer) => offer.offerId === 'ota-ai2472'));
});
test('detects test-mode provider credentials so test fares are not included in live search', () => {
    const originalEnvironment = { ...process.env };
    try {
        process.env.DUFFEL_ACCESS_TOKEN = 'duffel_test_example';
        delete process.env.DUFFEL_API_KEY;
        assert.equal(hasDuffelTestAccessToken(), true);
        process.env.DUFFEL_ACCESS_TOKEN = 'duffel_live_example';
        assert.equal(hasDuffelTestAccessToken(), false);
    }
    finally {
        process.env = originalEnvironment;
    }
});
test('retains verified offers from every supported Indian airline when sources return them', () => {
    const airlineOffers = [
        ['IndiGo', '6E', '6E1234'],
        ['Air India', 'AI', 'AI1234'],
        ['Air India Express', 'IX', 'IX1234'],
        ['Akasa Air', 'QP', 'QP1234'],
        ['SpiceJet', 'SG', 'SG1234'],
        ['Alliance Air', '9I', '9I1234'],
        ['Star Air', 'S5', 'S51234'],
    ].map(([airline, airlineCode, flightNumber], index) => canonicalizeScrapedOffer({
        airline,
        airlineCode,
        flightNumber,
        origin: 'PAT',
        destination: 'BOM',
        departureDate: '2026-09-30',
        departureTime: `${String(8 + index).padStart(2, '0')}:00`,
        arrivalTime: `${String(10 + index).padStart(2, '0')}:00`,
        duration: '2h 00m',
        stops: 0,
        price: 4500 + index * 100,
        currency: 'INR',
        source: `${airline} direct source`,
        sourceType: 'airline',
        collectedAt: '2026-09-26T02:00:00.000Z',
        confidence: 0.9,
    })).filter((offer) => Boolean(offer));
    const results = deduplicateOffers(airlineOffers);
    assert.deepEqual(results.map((offer) => offer.airline), ['IndiGo', 'Air India', 'Air India Express', 'Akasa Air', 'SpiceJet', 'Alliance Air', 'Star Air']);
});
test('rejects a flight number whose prefix conflicts with the verified airline', () => {
    const offer = canonicalizeScrapedOffer({
        airline: 'IndiGo',
        airlineCode: '6E',
        flightNumber: 'BY201',
        origin: 'BOM',
        destination: 'HYD',
        departureDate: '2026-09-27',
        departureTime: '08:00',
        arrivalTime: '09:30',
        duration: '1h 30m',
        stops: 0,
        price: 5100,
        currency: 'INR',
        source: 'OTA result',
        sourceType: 'ota',
        confidence: 0.8,
    });
    assert.equal(offer, null);
});
test('rejects a provider offer whose flight number conflicts with its carrier code', () => {
    const mismatchedOffer = {
        airline: 'IndiGo', airlineCode: '6E', flightNumber: 'BY201', origin: 'BOM', destination: 'HYD',
        departureDate: '2026-09-27', liveMode: true, departureTime: '08:00', arrivalTime: '09:30', duration: '1h 30m',
        stops: 0, price: 5100, currency: 'INR', offerId: 'mismatched-carrier-flight', seatsRemaining: 1,
        source: 'Provider', sourceType: 'duffel', collectedAt: '2026-09-26T00:00:00.000Z', confidence: 0.8,
    };
    assert.equal(hasMatchingFlightCarrier(mismatchedOffer), false);
    assert.equal(hasMatchingFlightCarrier({ ...mismatchedOffer, flightNumber: '6E201' }), true);
});
test('timestamps all fares in one completed search as one collection observation', () => {
    const searchedAt = '2026-09-26T12:30:00.000Z';
    const offers = [
        { airline: 'IndiGo', airlineCode: '6E', flightNumber: '6E1234', origin: 'PAT', destination: 'BOM', departureDate: '2026-09-30', liveMode: true, departureTime: '08:00', arrivalTime: '10:00', duration: '2h 00m', stops: 0, price: 5000, currency: 'INR', offerId: 'indigo-1', seatsRemaining: 1, source: 'IndiGo', sourceType: 'airline', collectedAt: '2026-09-26T12:29:58.000Z', confidence: 0.9 },
        { airline: 'SpiceJet', airlineCode: 'SG', flightNumber: 'SG1234', origin: 'PAT', destination: 'BOM', departureDate: '2026-09-30', liveMode: true, departureTime: '09:00', arrivalTime: '11:00', duration: '2h 00m', stops: 0, price: 5200, currency: 'INR', offerId: 'spicejet-1', seatsRemaining: 1, source: 'SpiceJet', sourceType: 'airline', collectedAt: '2026-09-26T12:29:59.000Z', confidence: 0.9 },
    ];
    const observations = timestampSearchOffers(offers, searchedAt);
    assert.equal(new Set(observations.map((offer) => offer.collectedAt)).size, 1);
    assert.ok(observations.every((offer) => offer.collectedAt === searchedAt));
    assert.deepEqual(observations.map((offer) => offer.price), offers.map((offer) => offer.price));
});
test('normal Flight Search uses Duffel directly with the exact route, date, and passenger count', async () => {
    const originalAccessToken = process.env.DUFFEL_ACCESS_TOKEN;
    const originalApiKey = process.env.DUFFEL_API_KEY;
    process.env.DUFFEL_ACCESS_TOKEN = 'duffel_test_unit_test';
    delete process.env.DUFFEL_API_KEY;
    let requestedInput = '';
    const originalInfo = console.info;
    const infoMessages = [];
    console.info = (...values) => infoMessages.push(values.map(String).join(' '));
    try {
        const result = await searchFlightsFromDuffel({ origin: 'del', destination: 'blr', departureDate: '2026-09-26', adults: 1 }, async (input, onRawOfferCount, onOfferValidation) => {
            requestedInput = `${input.origin}-${input.destination}-${input.departureDate}-${input.adults}`;
            onRawOfferCount?.(1);
            const normalizedOffer = normalizeDuffelOffer({
                id: 'offer-secret-provider-id',
                total_amount: '5200',
                total_currency: 'INR',
                slices: [{
                        origin: { iata_code: 'DEL' },
                        destination: { iata_code: 'BLR' },
                        segments: [{
                                origin: { iata_code: 'DEL' },
                                destination: { iata_code: 'BLR' },
                                operating_carrier: { name: 'IndiGo', iata_code: '6E' },
                                operating_carrier_flight_number: '1234',
                                departing_at: '2026-09-26T08:00:00+05:30',
                                arriving_at: '2026-09-26T10:50:00+05:30',
                            }],
                    }],
            }, input);
            onOfferValidation?.({ validOffers: normalizedOffer ? 1 : 0, rejectedOffers: normalizedOffer ? 0 : 1, rejections: {} });
            return normalizedOffer ? [normalizedOffer] : [];
        });
        assert.equal(requestedInput, 'DEL-BLR-2026-09-26-1');
        assert.equal(result.status, 'live_success');
        assert.equal(result.offers.length, 1);
        assert.equal(result.offers[0]?.airline, 'IndiGo');
        assert.equal(result.offers[0]?.sourceType, 'airline');
        assert.equal(result.offers[0]?.liveMode, false);
        assert.equal(result.offers[0]?.offerId, 'DEL-BLR-2026-09-26-6E1234-08:00');
        assert.equal(result.offers[0]?.source, 'Verified flight offer');
        assert.equal(JSON.stringify(result).includes('offer-secret-provider-id'), false);
        assert.equal(JSON.stringify(result).toLowerCase().includes('duffel'), false);
        assert.ok(infoMessages.includes('[Flight Search] Live web scraping disabled'));
        assert.ok(infoMessages.includes('[Flight Search] Using Duffel API'));
        assert.ok(infoMessages.includes('[Duffel] Searching DEL-BLR for 2026-09-26, passengers=1'));
        assert.ok(infoMessages.includes('[Duffel] Raw offers: 1'));
        assert.ok(infoMessages.includes('[Duffel] Valid offers before airline filtering: 1'));
        assert.ok(infoMessages.includes('[Duffel] Rejected offers: 0'));
        assert.ok(infoMessages.includes('[Duffel] Verified offers: 1'));
        assert.ok(infoMessages.includes('[LIVE DATA] Source: Duffel API'));
        assert.ok(infoMessages.includes('[Flight Search] Final merged result count=1 source=duffel'));
    }
    finally {
        console.info = originalInfo;
        if (originalAccessToken === undefined)
            delete process.env.DUFFEL_ACCESS_TOKEN;
        else
            process.env.DUFFEL_ACCESS_TOKEN = originalAccessToken;
        if (originalApiKey === undefined)
            delete process.env.DUFFEL_API_KEY;
        else
            process.env.DUFFEL_API_KEY = originalApiKey;
    }
});
test('Duffel with zero verified offers returns the required empty message and live-data log', async () => {
    const originalAccessToken = process.env.DUFFEL_ACCESS_TOKEN;
    const originalApiKey = process.env.DUFFEL_API_KEY;
    process.env.DUFFEL_ACCESS_TOKEN = 'duffel_live_unit_test';
    delete process.env.DUFFEL_API_KEY;
    let duffelCalled = false;
    const originalInfo = console.info;
    const infoMessages = [];
    console.info = (...values) => infoMessages.push(values.map(String).join(' '));
    try {
        const result = await searchFlightsFromDuffel({ origin: 'DEL', destination: 'BLR', departureDate: '2026-09-26', adults: 1 }, async () => {
            duffelCalled = true;
            return [];
        });
        assert.deepEqual(result, {
            offers: [],
            status: 'no_results',
            message: 'No verified flights available for this search.',
        });
        assert.equal(duffelCalled, true);
        assert.ok(infoMessages.includes('[LIVE DATA] Source: Duffel API'));
        assert.ok(infoMessages.includes('[LIVE DATA] No verified Duffel offers available'));
    }
    finally {
        console.info = originalInfo;
        if (originalAccessToken === undefined)
            delete process.env.DUFFEL_ACCESS_TOKEN;
        else
            process.env.DUFFEL_ACCESS_TOKEN = originalAccessToken;
        if (originalApiKey === undefined)
            delete process.env.DUFFEL_API_KEY;
        else
            process.env.DUFFEL_API_KEY = originalApiKey;
    }
});
test('Duffel does not fabricate Go First from retired GoAir carrier data', async () => {
    const originalAccessToken = process.env.DUFFEL_ACCESS_TOKEN;
    process.env.DUFFEL_ACCESS_TOKEN = 'duffel_live_unit_test';
    try {
        const result = await searchFlightsFromDuffel({ origin: 'DEL', destination: 'BLR', departureDate: '2026-09-26', adults: 1 }, async () => [{
                airline: 'GoAir', airlineCode: 'G8', flightNumber: 'G81234', origin: 'DEL', destination: 'BLR',
                departureDate: '2026-09-26', liveMode: true, departureTime: '08:00', arrivalTime: '10:00',
                duration: '2h 00m', stops: 0, price: 5200, currency: 'INR', offerId: 'provider-id', seatsRemaining: 1,
                source: 'Duffel API', sourceType: 'duffel', collectedAt: '2026-09-26T02:00:00.000Z', confidence: 0.9,
            }]);
        assert.equal(result.offers.length, 0);
        assert.equal(result.status, 'no_results');
    }
    finally {
        if (originalAccessToken === undefined)
            delete process.env.DUFFEL_ACCESS_TOKEN;
        else
            process.env.DUFFEL_ACCESS_TOKEN = originalAccessToken;
    }
});
test('Duffel normalization rejects provider brands and keeps real airline data only', () => {
    assert.equal(normalizeDuffelOffer({
        id: 'offer-1',
        total_amount: '2450',
        total_currency: 'INR',
        total_duration: 'PT1H30M',
        slices: [{
                origin: { iata_code: 'PAT' },
                destination: { iata_code: 'BOM' },
                segments: [{
                        operating_carrier: { name: 'Duffel Airways', iata_code: 'ZZ' },
                        marketing_carrier: { name: 'Duffel Airways', iata_code: 'ZZ' },
                        operating_carrier_flight_number: '9',
                        departing_at: '2026-09-30T06:00:00+05:30',
                        arriving_at: '2026-09-30T07:30:00+05:30',
                    }],
            }],
    }, { origin: 'PAT', destination: 'BOM', departureDate: '2026-09-30', adults: 1 }), null);
    const realOffer = normalizeDuffelOffer({
        id: 'offer-2',
        total_amount: '4320',
        total_currency: 'INR',
        total_duration: 'PT2H15M',
        slices: [{
                origin: { iata_code: 'PAT' },
                destination: { iata_code: 'BOM' },
                segments: [{
                        origin: { iata_code: 'PAT' },
                        destination: { iata_code: 'BOM' },
                        operating_carrier: { name: 'IndiGo', iata_code: '6E' },
                        marketing_carrier: { name: 'IndiGo', iata_code: '6E' },
                        operating_carrier_flight_number: '2124',
                        departing_at: '2026-09-30T08:00:00+05:30',
                        arriving_at: '2026-09-30T10:15:00+05:30',
                    }],
            }],
    }, { origin: 'PAT', destination: 'BOM', departureDate: '2026-09-30', adults: 1 });
    assert.ok(realOffer);
    assert.equal(realOffer?.airline, 'IndiGo');
    assert.equal(realOffer?.airlineCode, '6E');
    assert.equal(realOffer?.flightNumber, '6E2124');
    assert.equal(realOffer?.sourceType, 'duffel');
});
test('Duffel normalization trusts recognized operating IATA codes and canonicalizes real carriers', () => {
    const carriers = [
        ['6E', 'IndiGo'],
        ['AI', 'Air India'],
        ['IX', 'Air India Express'],
        ['QP', 'Akasa Air'],
        ['SG', 'SpiceJet'],
    ];
    for (const [code, name] of carriers) {
        const offer = normalizeDuffelOffer({
            total_amount: '4800',
            total_currency: 'INR',
            slices: [{
                    origin: { iata_code: 'HYD' },
                    destination: { iata_code: 'BOM' },
                    segments: [{
                            origin: { iata_code: 'HYD' },
                            destination: { iata_code: 'BOM' },
                            operating_carrier: { name: 'Duffel supplied label', iata_code: code },
                            marketing_carrier: { name, iata_code: code },
                            operating_carrier_flight_number: '1234',
                            departing_at: '2026-09-26T08:00:00+05:30',
                            arriving_at: '2026-09-26T09:30:00+05:30',
                        }],
                }],
        }, { origin: 'HYD', destination: 'BOM', departureDate: '2026-09-26', adults: 1 });
        assert.ok(offer, `${code} should normalize`);
        assert.equal(offer.airline, name);
        assert.equal(offer.airlineCode, code);
        assert.equal(offer.flightNumber, `${code}1234`);
    }
});
test('Duffel rejects a foreign operating airline even when marketing airline is Indian', () => {
    const diagnostics = {
        missing_itinerary: 0, invalid_carrier: 0, blocked_carrier: 0, invalid_flight_number: 0,
        invalid_price: 0, invalid_currency: 0, invalid_schedule: 0, route_mismatch: 0, date_mismatch: 0,
    };
    const offer = normalizeDuffelOffer({
        total_amount: '4800',
        total_currency: 'INR',
        slices: [{
                origin: { iata_code: 'HYD' },
                destination: { iata_code: 'BOM' },
                segments: [{
                        operating_carrier: { name: 'Foreign Airline', iata_code: 'BA' },
                        marketing_carrier: { name: 'IndiGo', iata_code: '6E' },
                        operating_carrier_flight_number: '1234',
                        departing_at: '2026-09-26T08:00:00+05:30',
                        arriving_at: '2026-09-26T09:30:00+05:30',
                    }],
            }],
    }, { origin: 'HYD', destination: 'BOM', departureDate: '2026-09-26', adults: 1 }, diagnostics);
    assert.equal(offer, null);
    assert.equal(diagnostics.invalid_carrier, 1);
});
test('Duffel preserves every leg through final verification and rejects slice/segment route mismatches', async () => {
    const route = { origin: 'HYD', destination: 'BLR', departureDate: '2026-09-26', adults: 1 };
    const connection = normalizeDuffelOffer({
        id: 'ai2447-connection',
        total_amount: '7200',
        total_currency: 'INR',
        slices: [{
                origin: { iata_code: 'HYD' },
                destination: { iata_code: 'BLR' },
                segments: [
                    {
                        origin: { iata_code: 'HYD' },
                        destination: { iata_code: 'BOM' },
                        operating_carrier: { name: 'Air India', iata_code: 'AI' },
                        marketing_carrier: { name: 'Air India', iata_code: 'AI' },
                        operating_carrier_flight_number: '2447',
                        departing_at: '2026-09-26T17:25:00+05:30',
                        arriving_at: '2026-09-26T19:10:00+05:30',
                    },
                    {
                        origin: { iata_code: 'BOM' },
                        destination: { iata_code: 'BLR' },
                        operating_carrier: { name: 'Air India', iata_code: 'AI' },
                        marketing_carrier: { name: 'Air India', iata_code: 'AI' },
                        operating_carrier_flight_number: '640',
                        departing_at: '2026-09-26T23:45:00+05:30',
                        arriving_at: '2026-09-27T01:35:00+05:30',
                    },
                ],
            }],
    }, route);
    assert.ok(connection);
    assert.equal(connection.flightNumber, 'AI2447 / AI640');
    assert.equal(connection.departureTime, '17:25');
    assert.equal(connection.arrivalTime, '01:35');
    assert.equal(connection.duration, '8h 10m');
    assert.equal(connection.segments?.length, 2);
    assert.deepEqual(connection.segments?.map((segment) => `${segment.origin}-${segment.destination}`), ['HYD-BOM', 'BOM-BLR']);
    const originalAccessToken = process.env.DUFFEL_ACCESS_TOKEN;
    process.env.DUFFEL_ACCESS_TOKEN = 'duffel_live_unit_test';
    try {
        const result = await searchFlightsFromDuffel(route, async () => connection ? [connection] : []);
        assert.equal(result.offers.length, 1);
        assert.equal(result.offers[0]?.flightNumber, 'AI2447 / AI640');
        assert.equal(result.offers[0]?.arrivalTime, '01:35');
        assert.equal(result.offers[0]?.segments?.length, 2);
    }
    finally {
        if (originalAccessToken === undefined)
            delete process.env.DUFFEL_ACCESS_TOKEN;
        else
            process.env.DUFFEL_ACCESS_TOKEN = originalAccessToken;
    }
    const mismatched = normalizeDuffelOffer({
        total_amount: '5000',
        total_currency: 'INR',
        slices: [{
                origin: { iata_code: 'HYD' },
                destination: { iata_code: 'BLR' },
                segments: [{
                        origin: { iata_code: 'HYD' },
                        destination: { iata_code: 'BOM' },
                        operating_carrier: { name: 'Air India', iata_code: 'AI' },
                        operating_carrier_flight_number: '2447',
                        departing_at: '2026-09-26T17:25:00+05:30',
                        arriving_at: '2026-09-26T19:10:00+05:30',
                    }],
            }],
    }, route);
    assert.equal(mismatched, null);
});
test('Duffel logs raw carrier/segment fields and the exact rejected-offer reason', async () => {
    const originalEnvironment = { ...process.env };
    const originalFetch = globalThis.fetch;
    const originalInfo = console.info;
    const originalWarn = console.warn;
    const messages = [];
    process.env.DUFFEL_ACCESS_TOKEN = 'duffel_live_unit_test';
    process.env.DUFFEL_API_BASE_URL = 'https://duffel.test';
    console.info = (...values) => messages.push(values.map(String).join(' '));
    console.warn = (...values) => messages.push(values.map(String).join(' '));
    globalThis.fetch = (async () => new Response(JSON.stringify({ data: { offers: [
                {
                    id: 'valid-6e', total_amount: '4900', total_currency: 'INR',
                    slices: [{ origin: { iata_code: 'HYD' }, destination: { iata_code: 'BLR' }, segments: [{
                                    origin: { iata_code: 'HYD' }, destination: { iata_code: 'BLR' },
                                    marketing_carrier: { name: 'IndiGo', iata_code: '6E' }, operating_carrier: { name: 'IndiGo Airlines', iata_code: '6E' },
                                    marketing_carrier_flight_number: '1234', operating_carrier_flight_number: '1234',
                                    departing_at: '2026-09-26T08:00:00+05:30', arriving_at: '2026-09-26T09:30:00+05:30',
                                }] }],
                },
                {
                    id: 'wrong-ai-segment', total_amount: '5100', total_currency: 'INR',
                    slices: [{ origin: { iata_code: 'HYD' }, destination: { iata_code: 'BLR' }, segments: [{
                                    origin: { iata_code: 'HYD' }, destination: { iata_code: 'BOM' },
                                    marketing_carrier: { name: 'Air India', iata_code: 'AI' }, operating_carrier: { name: 'Air India', iata_code: 'AI' },
                                    marketing_carrier_flight_number: '2447', operating_carrier_flight_number: '2447',
                                    departing_at: '2026-09-26T17:25:00+05:30', arriving_at: '2026-09-26T19:10:00+05:30',
                                }] }],
                },
            ] } }), { status: 200 }));
    try {
        const offers = await searchDuffelOffers({ origin: 'HYD', destination: 'BLR', departureDate: '2026-09-26', adults: 1 });
        assert.equal(offers.length, 1);
        assert.equal(offers[0]?.airlineCode, '6E');
        assert.ok(messages.some((message) => message.includes('marketing=6E/IndiGo operating=6E/IndiGo Airlines') && message.includes('origin=HYD destination=BLR') && message.includes('total=4900 INR')));
        assert.ok(messages.some((message) => message.includes('[Duffel] RAW OFFERS BY CARRIER:')));
        assert.ok(messages.some((message) => message.includes('[Duffel] NORMALIZED OFFERS BY CARRIER: 6E/IndiGo=1')));
        assert.ok(messages.some((message) => message.includes('[Duffel] REJECTED OFFERS + EXACT REASON: route_mismatch=1')));
    }
    finally {
        globalThis.fetch = originalFetch;
        console.info = originalInfo;
        console.warn = originalWarn;
        process.env = originalEnvironment;
    }
});
test('HYD to BOM search verifies every requested Indian carrier and logs airline totals', async () => {
    const originalAccessToken = process.env.DUFFEL_ACCESS_TOKEN;
    process.env.DUFFEL_ACCESS_TOKEN = 'duffel_live_unit_test';
    const originalInfo = console.info;
    const infoMessages = [];
    console.info = (...values) => infoMessages.push(values.map(String).join(' '));
    const route = { origin: 'HYD', destination: 'BOM', departureDate: '2026-09-26', adults: 1 };
    const carriers = [
        ['6E', 'IndiGo'], ['AI', 'Air India'], ['IX', 'Air India Express'], ['QP', 'Akasa Air'], ['SG', 'SpiceJet'],
    ];
    try {
        const result = await searchFlightsFromDuffel(route, async (input, onRawOfferCount, onOfferValidation) => {
            const offers = carriers.map(([code, name], index) => normalizeDuffelOffer({
                id: `hyd-bom-${code}`,
                total_amount: String(4200 + index * 200),
                total_currency: 'INR',
                slices: [{
                        origin: { iata_code: 'HYD' },
                        destination: { iata_code: 'BOM' },
                        segments: [{
                                origin: { iata_code: 'HYD' },
                                destination: { iata_code: 'BOM' },
                                operating_carrier: { name, iata_code: code },
                                operating_carrier_flight_number: String(1200 + index),
                                departing_at: `2026-09-26T${String(8 + index).padStart(2, '0')}:00:00+05:30`,
                                arriving_at: `2026-09-26T${String(9 + index).padStart(2, '0')}:30:00+05:30`,
                            }],
                    }],
            }, input)).filter((offer) => Boolean(offer));
            onRawOfferCount?.(carriers.length);
            onOfferValidation?.({ validOffers: offers.length, rejectedOffers: 0, rejections: {} });
            return offers;
        });
        assert.equal(result.status, 'live_success');
        assert.deepEqual(new Set(result.offers.map((offer) => offer.airlineCode)), new Set(carriers.map(([code]) => code)));
        assert.ok(infoMessages.includes('[Duffel] Raw offers: 5'));
        assert.ok(infoMessages.includes('[Duffel] VERIFIED OFFERS BY CARRIER: 6E/IndiGo=1, AI/Air India=1, IX/Air India Express=1, QP/Akasa Air=1, SG/SpiceJet=1'));
        assert.ok(infoMessages.includes('[Flight Search] Final merged result count=5 source=duffel'));
    }
    finally {
        console.info = originalInfo;
        if (originalAccessToken === undefined)
            delete process.env.DUFFEL_ACCESS_TOKEN;
        else
            process.env.DUFFEL_ACCESS_TOKEN = originalAccessToken;
    }
});
test('Duffel normalization rejects offers without verified departure and arrival times', () => {
    const offer = normalizeDuffelOffer({
        id: 'offer-missing-schedule',
        total_amount: '4320',
        total_currency: 'INR',
        slices: [{
                origin: { iata_code: 'PAT' },
                destination: { iata_code: 'BOM' },
                segments: [{
                        operating_carrier: { name: 'IndiGo', iata_code: '6E' },
                        operating_carrier_flight_number: '2124',
                    }],
            }],
    }, { origin: 'PAT', destination: 'BOM', departureDate: '2026-09-30', adults: 1 });
    assert.equal(offer, null);
});
test('Duffel normalization accepts missing live_mode and segment route fields', () => {
    const offer = normalizeDuffelOffer({
        id: 'offer-segment-route',
        total_amount: '5100.50',
        total_currency: 'INR',
        slices: [{
                segments: [{
                        origin: { iata_code: 'MAA' },
                        destination: { iata_code: 'DEL' },
                        operating_carrier: { name: 'Air India', iata_code: 'AI' },
                        marketing_carrier: { name: 'Air India', iata_code: 'AI' },
                        operating_carrier_flight_number: '539',
                        departing_at: '2026-10-15T06:30:00+05:30',
                        arriving_at: '2026-10-15T09:20:00+05:30',
                    }],
            }],
    }, { origin: 'MAA', destination: 'DEL', departureDate: '2026-10-15', adults: 1 });
    assert.ok(offer);
    assert.equal(offer?.origin, 'MAA');
    assert.equal(offer?.destination, 'DEL');
    assert.equal(offer?.departureDate, '2026-10-15');
    assert.equal(offer?.flightNumber, 'AI539');
    assert.equal(offer?.liveMode, false);
    assert.equal(offer?.price, 5100.5);
});
test('Duffel normalization falls back to complete marketing carrier fields', () => {
    const offer = normalizeDuffelOffer({
        id: 'offer-marketing-fallback',
        total_amount: '4200',
        total_currency: 'INR',
        slices: [{
                origin: { iata_code: 'PAT' },
                destination: { iata_code: 'BOM' },
                segments: [{
                        origin: { iata_code: 'PAT' },
                        destination: { iata_code: 'BOM' },
                        operating_carrier: {},
                        marketing_carrier: { name: 'IndiGo', iata_code: '6E' },
                        operating_carrier_flight_number: 'invalid',
                        marketing_carrier_flight_number: '2124',
                        departing_at: '2026-10-15T08:00:00+05:30',
                        arriving_at: '2026-10-15T10:15:00+05:30',
                    }],
            }],
    }, { origin: 'PAT', destination: 'BOM', departureDate: '2026-10-15', adults: 1 });
    assert.ok(offer);
    assert.equal(offer?.airline, 'IndiGo');
    assert.equal(offer?.airlineCode, '6E');
    assert.equal(offer?.flightNumber, '6E2124');
});
