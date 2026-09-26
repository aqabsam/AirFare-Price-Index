const configuredSourceTimeout = Number(process.env.SCRAPER_TIMEOUT ?? '12000');
export const SOURCE_TIMEOUT_MS = Number.isFinite(configuredSourceTimeout)
    ? Math.min(12_000, Math.max(3_000, configuredSourceTimeout))
    : 12_000;
const IST_TIME_ZONE = 'Asia/Kolkata';
export const KNOWN_AIRLINES = [
    { name: 'Air India Express', code: 'IX', matchers: [/air[- ]?india express/i, /\bIX\b/i] },
    { name: 'Air India', code: 'AI', matchers: [/air[- ]?india\b(?! express)/i, /\bAI\b/i] },
    { name: 'IndiGo', code: '6E', matchers: [/indigo/i, /\b6E\b/i] },
    { name: 'SpiceJet', code: 'SG', matchers: [/spicejet/i, /\bSG\b/i] },
    { name: 'Akasa Air', code: 'QP', matchers: [/akasa(?: air)?/i, /\bQP\b/i] },
    { name: 'Alliance Air', code: '9I', matchers: [/alliance(?: air)?/i, /\b9I\b/i] },
    { name: 'Star Air', code: 'S5', matchers: [/star air/i, /\bS5\b/i] },
    { name: 'Vistara', code: 'UK', matchers: [/vistara/i, /\bUK\b/i] },
];
export function todayInIndia() {
    return new Intl.DateTimeFormat('en-CA', { timeZone: IST_TIME_ZONE }).format(new Date());
}
export function routeKey(input) {
    return `${input.origin}-${input.destination}-${input.departureDate}`.toUpperCase();
}
export function numberFrom(value) {
    const parsed = Number(value.replace(/[^\d.]/g, ''));
    return Number.isFinite(parsed) ? parsed : 0;
}
export function labeledAmount(value, labels) {
    const pattern = new RegExp(`(?:${labels.join('|')})\\s*[:\\-]?\\s*(?:₹|INR|Rs\\.?)?\\s*([\\d,]+(?:\\.\\d+)?)`, 'i');
    const match = value.match(pattern);
    return match?.[1] ? numberFrom(match[1]) : null;
}
export function durationFrom(value) {
    const hours = value.match(/(\d+(?:\.\d+)?)\s*h(?:r|ours?)?/i)?.[1];
    const minutes = value.match(/(\d+)\s*m(?:in|inutes?)?/i)?.[1];
    if (hours || minutes) {
        return Math.round(Number(hours ?? 0) * 60 + Number(minutes ?? 0));
    }
    return 0;
}
export function parseTimes(text) {
    const matches = [...text.matchAll(/\b([01]?\d|2[0-3]):([0-5]\d)(?:\s*(AM|PM))?\b/gi)];
    if (matches.length < 2)
        return null;
    function formatTime(m) {
        let hours = parseInt(m[1], 10);
        const minutes = m[2];
        const meridiem = m[3]?.toUpperCase();
        if (meridiem === 'PM' && hours < 12)
            hours += 12;
        if (meridiem === 'AM' && hours === 12)
            hours = 0;
        return `${String(hours).padStart(2, '0')}:${minutes}`;
    }
    return {
        departure: formatTime(matches[0]),
        arrival: formatTime(matches[1]),
    };
}
export function parseFlightNumber(text, expectedAirlineCode) {
    const expectedCode = expectedAirlineCode.trim().toUpperCase();
    if (!/^[A-Z0-9]{2,3}$/.test(expectedCode))
        return null;
    const pattern = /\b([A-Z0-9]{2,3})\s*-?\s*(\d{2,5})\b/gi;
    for (const match of text.matchAll(pattern)) {
        const code = match[1]?.toUpperCase();
        const digits = match[2];
        if (code === expectedCode && digits)
            return `${code}${digits}`;
    }
    return null;
}
export function parseAirline(text, fallbackAirline, fallbackCode) {
    for (const item of KNOWN_AIRLINES) {
        if (item.matchers.some((m) => m.test(text))) {
            return { airline: item.name, code: item.code };
        }
    }
    return {
        airline: fallbackAirline || 'Domestic Carrier',
        code: fallbackCode || 'XX',
    };
}
export function stopsFrom(value) {
    if (/non[- ]?stop|direct/i.test(value))
        return 0;
    const match = value.match(/(\d+)\s*stop/i);
    return match ? parseInt(match[1], 10) : null;
}
function matchesAny(value, patterns) {
    return patterns.some((pattern) => pattern.test(value));
}
async function fillByHints(page, patterns, value, fieldKind) {
    const fields = page.locator('input, textarea');
    for (let index = 0; index < await fields.count(); index += 1) {
        const field = fields.nth(index);
        const metadata = await field.evaluate((element) => ({
            placeholder: element.getAttribute('placeholder') ?? '',
            aria: element.getAttribute('aria-label') ?? '',
            name: element.getAttribute('name') ?? '',
            id: element.getAttribute('id') ?? '',
            type: element.getAttribute('type') ?? '',
        })).catch(() => null);
        if (!metadata)
            continue;
        const hintText = `${metadata.placeholder} ${metadata.aria} ${metadata.name} ${metadata.id}`.toLowerCase();
        const isDateField = metadata.type.toLowerCase() === 'date' || /calendar|journey date|travel date|departure date/i.test(hintText);
        if (fieldKind === 'origin' && (isDateField || /destination|arrival|\bto\b/i.test(hintText)))
            continue;
        if (fieldKind === 'destination' && (isDateField || /origin|\bfrom\b/i.test(hintText)))
            continue;
        if (fieldKind === 'date' && /origin|destination|\bfrom\b|\bto\b/i.test(hintText) && !isDateField)
            continue;
        if (!matchesAny(hintText, patterns))
            continue;
        await field.fill(value).catch(() => undefined);
        if (await field.inputValue().catch(() => '') === value)
            return true;
    }
    return false;
}
async function submitByHints(page, patterns) {
    const controls = page.locator('button, input[type="submit"], [role="button"]');
    for (let index = 0; index < await controls.count(); index += 1) {
        const control = controls.nth(index);
        const text = await control.innerText().catch(() => '');
        const aria = await control.getAttribute('aria-label').catch(() => '');
        if (matchesAny(`${text} ${aria}`.toLowerCase(), patterns)) {
            await control.click({ force: true }).catch(() => undefined);
            return true;
        }
    }
    await page.keyboard.press('Enter').then(() => true).catch(() => false);
}
function countRejection(rejectionCounts, reason) {
    if (rejectionCounts)
        rejectionCounts[reason] = (rejectionCounts[reason] ?? 0) + 1;
}
export function buildSnapshot(text, definition, input, index, rejectionCounts) {
    const reject = (reason) => {
        countRejection(rejectionCounts, reason);
        return null;
    };
    const times = parseTimes(text);
    if (!times)
        return reject('missing departure/arrival time');
    const priceMatch = text.match(/(?:₹|INR|Rs\.?)\s*([\d,]+(?:\.\d+)?)/i);
    if (!priceMatch)
        return reject('missing fare');
    const price = numberFrom(priceMatch[1] ?? '');
    if (!price || price <= 0)
        return reject('invalid fare');
    const durationMinutes = durationFrom(text);
    const stops = stopsFrom(text);
    if (!durationMinutes)
        return reject('missing or unparseable duration');
    if (stops === null)
        return reject('missing or unparseable stops');
    const baseFare = labeledAmount(text, ['base fare', 'base']);
    const taxes = labeledAmount(text, ['taxes', 'tax']);
    const udf = labeledAmount(text, ['udf', 'user development fee']);
    const convenienceFee = labeledAmount(text, ['convenience fee', 'convenience']);
    const { airline, code } = parseAirline(text, definition.airline, definition.airlineCode);
    const number = parseFlightNumber(text, definition.airlineCode ?? code);
    if (!number) {
        const candidate = text.match(/\b(?:6E|AI|IX|SG|QP|9I|S5|UK)\s*-?\s*\d{2,5}\b/i);
        return reject(candidate ? 'flight number carrier mismatch' : 'missing flight number');
    }
    const collectedAt = new Date().toISOString();
    return {
        id: `${definition.id}-${input.origin}-${input.destination}-${input.departureDate}-${index}`,
        routeKey: routeKey(input),
        origin: input.origin,
        destination: input.destination,
        departureDate: input.departureDate,
        bookingWindowDays: 0,
        collectionDate: todayInIndia(),
        collectedAt,
        sourceId: definition.id,
        airline: definition.airline ?? airline,
        airlineCode: definition.airlineCode ?? code,
        flightNumber: number,
        departureTime: times.departure,
        arrivalTime: times.arrival,
        durationMinutes,
        stops,
        price,
        baseFare,
        taxes,
        udf,
        convenienceFee,
        totalFare: price,
        currency: 'INR',
        seatsRemaining: 9,
        source: definition.name,
        collectionStage: 'SCRAPER',
        sourceType: definition.sourceType,
        confidence: 0.9,
    };
}
export async function scrapeWebsite(browser, definition, input) {
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
        viewport: { width: 1366, height: 768 },
        locale: 'en-US',
    }).catch(() => null);
    const page = context ? await context.newPage() : await browser.newPage();
    const networkResponses = [];
    let pageStatus = null;
    page.on('response', (response) => {
        const resourceType = response.request().resourceType();
        if (resourceType !== 'xhr' && resourceType !== 'fetch')
            return;
        try {
            networkResponses.push(`${response.status()} ${new URL(response.url()).pathname}`);
        }
        catch {
            networkResponses.push(`${response.status()} ${resourceType}`);
        }
    });
    try {
        const targetUrl = definition.buildSearchUrl ? definition.buildSearchUrl(input) : definition.url;
        const navigation = await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: SOURCE_TIMEOUT_MS });
        pageStatus = navigation?.status() ?? null;
        if (pageStatus !== null && pageStatus >= 400) {
            const target = new URL(targetUrl);
            throw new Error(`HTTP ${pageStatus} loading ${target.origin}${target.pathname}`);
        }
        if (!definition.buildSearchUrl) {
            const originFilled = await fillByHints(page, definition.hints.origin, input.origin, 'origin');
            const destinationFilled = await fillByHints(page, definition.hints.destination, input.destination, 'destination');
            const dateFilled = await fillByHints(page, definition.hints.date, input.departureDate, 'date');
            if (!originFilled || !destinationFilled || !dateFilled) {
                const missing = [!originFilled && 'origin', !destinationFilled && 'destination', !dateFilled && 'date'].filter(Boolean);
                throw new Error(`could not populate ${missing.join(', ')} search field${missing.length === 1 ? '' : 's'}`);
            }
            if (!await submitByHints(page, definition.hints.submit)) {
                throw new Error('could not find a search control');
            }
        }
        if (definition.extractSnapshots) {
            const extraction = await definition.extractSnapshots(page, definition, input);
            return { ...extraction, pageStatus, networkResponses: [...new Set(networkResponses)].slice(0, 20) };
        }
        const cardSelector = definition.cardSelectors.join(', ');
        await page.waitForSelector(cardSelector, { timeout: SOURCE_TIMEOUT_MS }).catch(() => undefined);
        const cards = page.locator(cardSelector);
        const count = await cards.count().catch(() => 0);
        const snapshots = [];
        const rejectionCounts = {};
        for (let index = 0; index < Math.min(count, 100); index += 1) {
            const text = await cards.nth(index).innerText().catch(() => '');
            const snapshot = buildSnapshot(text, definition, input, index, rejectionCounts);
            if (snapshot)
                snapshots.push(snapshot);
        }
        if (!count)
            rejectionCounts['no result cards found'] = 1;
        return {
            snapshots,
            candidateCount: count,
            rejectionCounts,
            pageStatus,
            networkResponses: [...new Set(networkResponses)].slice(0, 20),
        };
    }
    catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        console.warn(`[Scraper: ${definition.name}] Scrape warning: ${reason}`);
        if (networkResponses.length) {
            console.info(`[Scraper: ${definition.name}] XHR/fetch before failure: ${[...new Set(networkResponses)].slice(0, 20).join(' | ')}`);
        }
        throw error;
    }
    finally {
        await page.close().catch(() => undefined);
        if (context)
            await context.close().catch(() => undefined);
    }
}
