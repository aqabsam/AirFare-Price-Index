import { chromium } from 'playwright';
import { loadFareSourceConfigs, renderFareSourceTemplate, } from '../config/fareSources.js';
import { loadTrackedRoutes } from '../data/trackedRoutes.js';
const DEFAULT_BOOKING_WINDOWS = [1, 7, 15, 30, 45];
const IST_TIME_ZONE = 'Asia/Kolkata';
function getTodayInIST() {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: IST_TIME_ZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).formatToParts(new Date());
    const year = parts.find((part) => part.type === 'year')?.value ?? '1970';
    const month = parts.find((part) => part.type === 'month')?.value ?? '01';
    const day = parts.find((part) => part.type === 'day')?.value ?? '01';
    return `${year}-${month}-${day}`;
}
function addDays(dateString, offset) {
    const value = new Date(`${dateString}T00:00:00Z`);
    value.setUTCDate(value.getUTCDate() + offset);
    return value.toISOString().slice(0, 10);
}
function deriveBookingWindowDays(collectionDate, departureDate) {
    const collection = new Date(`${collectionDate}T00:00:00Z`).getTime();
    const departure = new Date(`${departureDate}T00:00:00Z`).getTime();
    if (!Number.isFinite(collection) || !Number.isFinite(departure)) {
        return 0;
    }
    return Math.max(0, Math.round((departure - collection) / 86_400_000));
}
function deriveRouteKey(origin, destination, departureDate) {
    return `${origin.toUpperCase()}-${destination.toUpperCase()}-${departureDate}`;
}
function parseNumber(value, fallback = 0) {
    const parsed = Number(value.replace(/[^\d.-]/g, ''));
    return Number.isFinite(parsed) ? parsed : fallback;
}
function parseDurationMinutes(value) {
    const normalized = value.trim().toLowerCase();
    const hours = normalized.match(/(\d+(?:\.\d+)?)\s*h/)?.[1];
    const minutes = normalized.match(/(\d+)\s*m/)?.[1];
    if (hours || minutes) {
        return Math.round(Number(hours ?? 0) * 60 + Number(minutes ?? 0));
    }
    return parseNumber(normalized);
}
function parseStops(value) {
    const normalized = value.trim().toLowerCase();
    if (normalized.includes('non-stop') || normalized.includes('nonstop') || normalized.includes('direct')) {
        return 0;
    }
    return parseNumber(normalized);
}
function normalizeSnapshot(snapshot, sourceType) {
    const origin = (snapshot.origin ?? '').trim().toUpperCase();
    const destination = (snapshot.destination ?? '').trim().toUpperCase();
    const departureDate = (snapshot.departureDate ?? '').trim();
    const bookingWindowDays = Math.max(0, Math.round(snapshot.bookingWindowDays ?? 0));
    const collectionDate = (snapshot.collectionDate ?? snapshot.collectedAt ?? new Date().toISOString()).trim().slice(0, 10);
    const routeKey = (snapshot.routeKey ?? deriveRouteKey(origin || 'UNK', destination || 'UNK', departureDate || '1970-01-01'))
        .trim()
        .toUpperCase();
    return {
        id: snapshot.id.trim(),
        routeKey,
        origin,
        destination,
        departureDate,
        bookingWindowDays,
        collectionDate,
        collectedAt: snapshot.collectedAt ?? new Date().toISOString(),
        sourceId: snapshot.sourceId?.trim() || undefined,
        airline: (snapshot.airline ?? 'Unknown airline').trim(),
        airlineCode: (snapshot.airlineCode ?? 'XX').trim().toUpperCase(),
        flightNumber: (snapshot.flightNumber ?? 'XX0').trim(),
        departureTime: (snapshot.departureTime ?? '--:--').trim(),
        arrivalTime: (snapshot.arrivalTime ?? '--:--').trim(),
        durationMinutes: Math.max(0, Math.round(snapshot.durationMinutes ?? 0)),
        stops: Math.max(0, Math.round(snapshot.stops ?? 0)),
        price: Math.max(0, Math.round(snapshot.price ?? 0)),
        currency: (snapshot.currency ?? 'INR').trim().toUpperCase(),
        seatsRemaining: Math.max(0, Math.round(snapshot.seatsRemaining ?? 0)),
        source: (snapshot.source ?? 'Configured source').trim(),
        sourceType,
        confidence: Math.min(1, Math.max(0, Number(snapshot.confidence) || 0)),
    };
}
function fallbackSnapshotsForSource() {
    return [];
}
function expandSourceRoutes(source, collectionDate, routeFilter) {
    const windows = source.bookingWindows?.length ? source.bookingWindows : DEFAULT_BOOKING_WINDOWS;
    const baseRoutes = source.routes?.length ? source.routes : loadTrackedRoutes();
    const expanded = [];
    for (const route of baseRoutes) {
        const isRequestedRoute = route.origin.toUpperCase() === routeFilter?.origin.toUpperCase() &&
            route.destination.toUpperCase() === routeFilter?.destination.toUpperCase();
        if (routeFilter?.departureDate && isRequestedRoute) {
            expanded.push({
                origin: route.origin,
                destination: route.destination,
                departureDate: routeFilter.departureDate,
                bookingWindowDays: deriveBookingWindowDays(collectionDate, routeFilter.departureDate),
                collectionDate,
            });
            continue;
        }
        if (route.departureDate) {
            expanded.push({
                origin: route.origin,
                destination: route.destination,
                departureDate: route.departureDate,
                bookingWindowDays: typeof route.bookingWindowDays === 'number' && Number.isFinite(route.bookingWindowDays)
                    ? Math.max(0, Math.round(route.bookingWindowDays))
                    : deriveBookingWindowDays(collectionDate, route.departureDate),
                collectionDate,
            });
            continue;
        }
        for (const window of windows) {
            expanded.push({
                origin: route.origin,
                destination: route.destination,
                departureDate: addDays(collectionDate, window),
                bookingWindowDays: window,
                collectionDate,
            });
        }
    }
    return expanded;
}
function routeMatchesFilter(route, filter) {
    if (!filter) {
        return true;
    }
    if (route.origin.toUpperCase() !== filter.origin.toUpperCase()) {
        return false;
    }
    if (route.destination.toUpperCase() !== filter.destination.toUpperCase()) {
        return false;
    }
    if (filter.departureDate && route.departureDate !== filter.departureDate) {
        return false;
    }
    return true;
}
function matchesAny(value, patterns) {
    return patterns.some((pattern) => pattern.test(value));
}
async function fillFieldByHints(page, patterns, value) {
    const inputs = page.locator('input, textarea');
    const count = await inputs.count();
    for (let index = 0; index < count; index += 1) {
        const field = inputs.nth(index);
        try {
            const metadata = await field.evaluate((element) => ({
                placeholder: element.getAttribute('placeholder') ?? '',
                ariaLabel: element.getAttribute('aria-label') ?? '',
                name: element.getAttribute('name') ?? '',
                id: element.getAttribute('id') ?? '',
                type: element.getAttribute('type') ?? '',
                value: element?.value ?? '',
            }));
            const haystack = `${metadata.placeholder} ${metadata.ariaLabel} ${metadata.name} ${metadata.id} ${metadata.type}`.toLowerCase();
            if (!matchesAny(haystack, patterns)) {
                continue;
            }
            if (metadata.value && !['date', 'text', 'search', 'email', 'tel', 'number'].includes(metadata.type)) {
                continue;
            }
            await field.click({ force: true }).catch(() => undefined);
            await field.fill(value).catch(() => field.type(value, { delay: 20 }));
            return true;
        }
        catch {
            continue;
        }
    }
    return false;
}
async function clickButtonByHints(page, patterns) {
    const buttons = page.locator('button, [role="button"], input[type="submit"], input[type="button"]');
    const count = await buttons.count();
    for (let index = 0; index < count; index += 1) {
        const button = buttons.nth(index);
        try {
            const metadata = await button.evaluate((element) => ({
                text: (element.textContent ?? '').trim(),
                ariaLabel: element.getAttribute('aria-label') ?? '',
                title: element.getAttribute('title') ?? '',
                value: element?.value ?? '',
            }));
            const haystack = `${metadata.text} ${metadata.ariaLabel} ${metadata.title} ${metadata.value}`.toLowerCase();
            if (!matchesAny(haystack, patterns)) {
                continue;
            }
            await button.click({ force: true });
            return true;
        }
        catch {
            continue;
        }
    }
    return false;
}
async function prepareSearchForm(page, route) {
    await fillFieldByHints(page, [/from/i, /origin/i, /departing from/i, /departure airport/i], route.origin);
    await fillFieldByHints(page, [/to/i, /destination/i, /going to/i, /arrival airport/i], route.destination);
    await fillFieldByHints(page, [/date/i, /departure/i, /travel date/i, /journey date/i], route.departureDate ?? '');
    const clicked = await clickButtonByHints(page, [/search/i, /find flights/i, /show flights/i, /search flights/i, /book now/i, /go/i]);
    if (!clicked) {
        await page.keyboard.press('Enter').catch(() => undefined);
    }
    await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => undefined);
    await page.waitForTimeout(2_000);
}
function extractDataAttribute(card, selector) {
    if (!selector) {
        return '';
    }
    const dataAttrMatch = selector.trim().match(/^\[data-([a-z0-9-]+)\]$/i);
    if (dataAttrMatch?.[1]) {
        return card.getAttribute(`data-${dataAttrMatch[1]}`)?.trim() ?? '';
    }
    return '';
}
function extractText(card, selector) {
    if (!selector) {
        return '';
    }
    const matched = card.querySelector(selector);
    if (matched) {
        return (matched.textContent ?? matched.getAttribute('content') ?? '').trim();
    }
    return extractDataAttribute(card, selector);
}
function extractByPath(input, path) {
    if (!path) {
        return input;
    }
    const parts = path.replace(/^\$\.?/, '').split('.').filter(Boolean);
    let current = input;
    for (const part of parts) {
        if (current == null) {
            return undefined;
        }
        const match = part.match(/^([^[\]]+)(?:\[(\d+)\])?$/);
        if (!match) {
            return undefined;
        }
        const [, key, index] = match;
        current = current?.[key];
        if (index !== undefined) {
            current = current?.[Number(index)];
        }
    }
    return current;
}
function extractTextFromObject(item, selector) {
    if (!selector) {
        return '';
    }
    const value = extractByPath(item, selector);
    if (typeof value === 'string') {
        return value.trim();
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
        return String(value);
    }
    return '';
}
async function scrapePageSource(browser, source, route) {
    const resolvedUrl = renderFareSourceTemplate(source.url ?? '', route).trim();
    if (!resolvedUrl) {
        return fallbackSnapshotsForSource().map((snapshot) => normalizeSnapshot({ ...snapshot, bookingWindowDays: route.bookingWindowDays, collectionDate: route.collectionDate }, source.sourceType));
    }
    const page = await browser.newPage();
    try {
        await page.goto(resolvedUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 });
        await prepareSearchForm(page, route);
        const snapshots = await page.$$eval(source.selectors.card, (cards, selectors) => cards.map((card) => {
            const element = card;
            const read = (selector) => {
                if (!selector) {
                    return '';
                }
                const matched = element.querySelector(selector);
                if (matched) {
                    return (matched.textContent ?? matched.getAttribute('content') ?? '').trim();
                }
                const dataAttrMatch = selector.trim().match(/^\[data-([a-z0-9-]+)\]$/i);
                if (dataAttrMatch?.[1]) {
                    return element.getAttribute(`data-${dataAttrMatch[1]}`)?.trim() ?? '';
                }
                return '';
            };
            const id = read(selectors.id) || read(selectors.routeKey) || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
            return {
                id,
                routeKey: read(selectors.routeKey) || '',
                origin: read(selectors.origin),
                destination: read(selectors.destination),
                departureDate: read(selectors.departureDate),
                collectedAt: new Date().toISOString(),
                sourceId: source.id ?? source.name,
                airline: read(selectors.airline),
                airlineCode: read(selectors.airlineCode),
                flightNumber: read(selectors.flightNumber),
                departureTime: read(selectors.departureTime),
                arrivalTime: read(selectors.arrivalTime),
                durationMinutes: parseDurationMinutes(read(selectors.durationMinutes)),
                stops: parseStops(read(selectors.stops)),
                price: parseNumber(read(selectors.price)),
                currency: read(selectors.currency) || 'INR',
                seatsRemaining: parseNumber(read(selectors.seatsRemaining)),
                source: read(selectors.source) || '',
                sourceType: 'airline',
                confidence: Number(read(selectors.confidence) || '0.85'),
            };
        }), source.selectors);
        const normalized = snapshots
            .map((snapshot) => normalizeSnapshot({
            ...snapshot,
            bookingWindowDays: route.bookingWindowDays,
            collectionDate: route.collectionDate,
            origin: String(snapshot.origin || route.origin),
            destination: String(snapshot.destination || route.destination),
            departureDate: String(snapshot.departureDate || route.departureDate),
            routeKey: snapshot.routeKey ||
                deriveRouteKey(String(snapshot.origin ?? route.origin), String(snapshot.destination ?? route.destination), route.departureDate ?? addDays(route.collectionDate, route.bookingWindowDays || 0)),
        }, source.sourceType))
            .filter((snapshot) => Boolean(snapshot.origin && snapshot.destination && snapshot.departureDate && snapshot.price > 0));
        if (normalized.length) {
            return normalized;
        }
        return fallbackSnapshotsForSource().map((snapshot) => normalizeSnapshot({ ...snapshot, bookingWindowDays: route.bookingWindowDays, collectionDate: route.collectionDate }, source.sourceType));
    }
    catch {
        return fallbackSnapshotsForSource().map((snapshot) => normalizeSnapshot({ ...snapshot, bookingWindowDays: route.bookingWindowDays, collectionDate: route.collectionDate }, source.sourceType));
    }
    finally {
        await page.close();
    }
}
async function scrapeApiSource(source, route) {
    const resolvedUrl = renderFareSourceTemplate(source.url ?? '', route).trim();
    if (!resolvedUrl) {
        return fallbackSnapshotsForSource().map((snapshot) => normalizeSnapshot({ ...snapshot, bookingWindowDays: route.bookingWindowDays, collectionDate: route.collectionDate }, source.sourceType));
    }
    const method = source.method ?? 'GET';
    const headers = renderFareSourceTemplate(source.headers ?? {}, route);
    const body = method === 'POST' ? renderFareSourceTemplate(source.body ?? undefined, route) : undefined;
    const response = await fetch(resolvedUrl, {
        method,
        headers: {
            'Content-Type': 'application/json',
            ...headers,
        },
        body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!response.ok) {
        throw new Error(`API source ${source.name} failed with status ${response.status}`);
    }
    const contentType = response.headers.get('content-type') ?? '';
    const payload = contentType.includes('application/json') ? await response.json() : await response.text();
    const records = extractByPath(payload, source.responsePath) ?? payload;
    const items = Array.isArray(records) ? records : [];
    const fields = source.apiFields ?? {};
    const snapshots = items
        .map((item) => normalizeSnapshot({
        id: extractTextFromObject(item, fields.id) || `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        routeKey: extractTextFromObject(item, fields.routeKey),
        origin: extractTextFromObject(item, fields.origin) || route.origin,
        destination: extractTextFromObject(item, fields.destination) || route.destination,
        departureDate: extractTextFromObject(item, fields.departureDate) || route.departureDate,
        bookingWindowDays: route.bookingWindowDays,
        collectionDate: route.collectionDate,
        airline: extractTextFromObject(item, fields.airline),
        airlineCode: extractTextFromObject(item, fields.airlineCode),
        flightNumber: extractTextFromObject(item, fields.flightNumber),
        departureTime: extractTextFromObject(item, fields.departureTime),
        arrivalTime: extractTextFromObject(item, fields.arrivalTime),
        durationMinutes: parseDurationMinutes(extractTextFromObject(item, fields.durationMinutes)),
        stops: parseStops(extractTextFromObject(item, fields.stops)),
        price: parseNumber(extractTextFromObject(item, fields.price)),
        currency: extractTextFromObject(item, fields.currency) || 'INR',
        seatsRemaining: parseNumber(extractTextFromObject(item, fields.seatsRemaining)),
        source: extractTextFromObject(item, fields.source) || source.name,
        sourceId: source.id ?? source.name,
        sourceType: source.sourceType,
        confidence: Number(extractTextFromObject(item, fields.confidence) || '0.85'),
        collectedAt: new Date().toISOString(),
    }, source.sourceType))
        .filter((snapshot) => snapshot.origin && snapshot.destination && snapshot.departureDate && snapshot.price > 0);
    if (snapshots.length) {
        return snapshots;
    }
    return fallbackSnapshotsForSource().map((snapshot) => normalizeSnapshot({ ...snapshot, bookingWindowDays: route.bookingWindowDays, collectionDate: route.collectionDate }, source.sourceType));
}
async function scrapeConfiguredSource(browser, source, collectionDate, routeFilter) {
    const routes = expandSourceRoutes(source, collectionDate, routeFilter).filter((route) => routeMatchesFilter(route, routeFilter));
    const collected = await Promise.all(routes.map(async (route) => {
        if (source.kind === 'api') {
            return scrapeApiSource(source, route);
        }
        return scrapePageSource(browser, source, route);
    }));
    return collected.flat();
}
export async function collectFareSnapshots() {
    const sources = await loadFareSourceConfigs();
    if (!sources.length) {
        return [];
    }
    const browser = await chromium.launch({ headless: true });
    const collectionDate = getTodayInIST();
    try {
        const collected = await Promise.all(sources.map((source) => scrapeConfiguredSource(browser, source, collectionDate)));
        return collected.flat();
    }
    finally {
        await browser.close();
    }
}
export async function collectFareSnapshotsForRoute(route) {
    const sources = await loadFareSourceConfigs();
    if (!sources.length) {
        return [];
    }
    const browser = await chromium.launch({ headless: true });
    const collectionDate = getTodayInIST();
    try {
        const collected = await Promise.all(sources.map((source) => scrapeConfiguredSource(browser, source, collectionDate, route)));
        return collected.flat();
    }
    finally {
        await browser.close();
    }
}
