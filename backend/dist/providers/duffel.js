export class DuffelProviderError extends Error {
    statusCode;
    constructor(message, statusCode = 502) {
        super(message);
        this.name = 'DuffelProviderError';
        this.statusCode = statusCode;
    }
}
function parseIsoDuration(duration) {
    if (!duration) {
        return null;
    }
    const isoMatch = duration.match(/^P(?:T)?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/i);
    if (isoMatch) {
        const hours = Number(isoMatch[1] ?? 0);
        const minutes = Number(isoMatch[2] ?? 0);
        const seconds = Number(isoMatch[3] ?? 0);
        return Math.max(0, Math.round(hours * 60 + minutes + seconds / 60));
    }
    const clockMatch = duration.match(/^(\d+):(\d{2}):(\d{2})$/);
    if (clockMatch) {
        const hours = Number(clockMatch[1]);
        const minutes = Number(clockMatch[2]);
        const seconds = Number(clockMatch[3]);
        return Math.max(0, Math.round(hours * 60 + minutes + seconds / 60));
    }
    const minuteMatch = duration.match(/^(\d+)m$/i);
    if (minuteMatch) {
        return Number(minuteMatch[1]);
    }
    return null;
}
function formatDuration(minutes) {
    const hours = Math.floor(minutes / 60);
    const remaining = minutes % 60;
    return `${hours}h ${String(remaining).padStart(2, '0')}m`;
}
function formatClockTime(isoString) {
    if (!isoString) {
        return '--:--';
    }
    const clockMatch = isoString.match(/T(\d{2}:\d{2})/);
    if (clockMatch) {
        return clockMatch[1];
    }
    return '--:--';
}
function calculateDuration(startIso, endIso, fallbackDuration) {
    if (startIso && endIso) {
        const start = new Date(startIso).getTime();
        const end = new Date(endIso).getTime();
        if (Number.isFinite(start) && Number.isFinite(end) && end >= start) {
            return formatDuration(Math.max(0, Math.round((end - start) / 60000)));
        }
    }
    const parsed = parseIsoDuration(fallbackDuration);
    return parsed !== null ? formatDuration(parsed) : '--';
}
function normalizeFlightNumber(carrierCode, rawNumber, offerId) {
    if (rawNumber === undefined || rawNumber === null || rawNumber === '') {
        return carrierCode ? `${carrierCode}${offerId.slice(-3)}` : offerId;
    }
    const value = String(rawNumber).trim();
    if (!value) {
        return carrierCode ? `${carrierCode}${offerId.slice(-3)}` : offerId;
    }
    return carrierCode && !value.toUpperCase().startsWith(carrierCode.toUpperCase()) ? `${carrierCode}${value}` : value;
}
function toNumber(value) {
    if (typeof value === 'number') {
        return value;
    }
    if (typeof value === 'string') {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : 0;
    }
    return 0;
}
function normalizeOffer(offer, requestedRoute) {
    const slice = offer.slices?.[0];
    const segments = slice?.segments ?? [];
    const firstSegment = segments[0];
    const lastSegment = segments[segments.length - 1] ?? firstSegment;
    if (!slice || !firstSegment || !lastSegment) {
        return null;
    }
    const carrier = firstSegment.operating_carrier ?? firstSegment.marketing_carrier ?? {};
    const airline = carrier.name?.trim() || 'Unknown airline';
    const airlineCode = carrier.iata_code?.trim().toUpperCase() || 'XX';
    const offerId = offer.id?.trim() || '';
    return {
        airline,
        airlineCode,
        flightNumber: normalizeFlightNumber(airlineCode, firstSegment.operating_carrier_flight_number ??
            firstSegment.marketing_carrier_flight_number ??
            firstSegment.flight_number, offerId),
        origin: slice.origin?.iata_code?.trim().toUpperCase() || requestedRoute.origin,
        destination: slice.destination?.iata_code?.trim().toUpperCase() || requestedRoute.destination,
        departureTime: formatClockTime(firstSegment.departing_at),
        arrivalTime: formatClockTime(lastSegment.arriving_at),
        duration: calculateDuration(firstSegment.departing_at, lastSegment.arriving_at, offer.total_duration),
        stops: Math.max(0, segments.length - 1),
        price: toNumber(offer.total_amount),
        currency: offer.total_currency?.trim().toUpperCase() || 'INR',
        offerId,
    };
}
export async function searchDuffelOffers(input) {
    const apiKey = process.env.DUFFEL_API_KEY?.trim();
    if (!apiKey) {
        throw new DuffelProviderError('DUFFEL_API_KEY is not configured in backend/.env', 500);
    }
    const baseUrl = (process.env.DUFFEL_API_BASE_URL?.trim() || 'https://api.duffel.com').replace(/\/$/, '');
    const supplierTimeout = Number(process.env.DUFFEL_SUPPLIER_TIMEOUT_MS ?? '10000');
    const timeoutMs = Number.isFinite(supplierTimeout) && supplierTimeout > 0 ? supplierTimeout : 10000;
    const controller = new AbortController();
    const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs + 1000);
    try {
        const response = await fetch(`${baseUrl}/air/offer_requests?supplier_timeout=${timeoutMs}`, {
            method: 'POST',
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
                'Duffel-Version': 'v2',
                Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                data: {
                    cabin_class: 'economy',
                    slices: [
                        {
                            origin: input.origin,
                            destination: input.destination,
                            departure_date: input.departureDate,
                        },
                    ],
                    passengers: Array.from({ length: input.adults }, () => ({ type: 'adult' })),
                },
            }),
            signal: controller.signal,
        });
        const payload = (await response.json().catch(() => null));
        if (!response.ok) {
            const firstError = payload?.errors?.[0];
            const message = firstError?.message || firstError?.title || `Duffel request failed with status ${response.status}`;
            throw new DuffelProviderError(message, response.status);
        }
        const offers = payload?.data?.offers ?? payload?.offers ?? [];
        return offers
            .map((offer) => normalizeOffer(offer, input))
            .filter((offer) => Boolean(offer))
            .sort((left, right) => left.price - right.price);
    }
    catch (error) {
        if (error instanceof DuffelProviderError) {
            throw error;
        }
        if (error instanceof DOMException && error.name === 'AbortError') {
            throw new DuffelProviderError('Duffel request timed out before returning offers', 504);
        }
        throw new DuffelProviderError('Unable to fetch live flight offers from Duffel', 502);
    }
    finally {
        clearTimeout(timeoutHandle);
    }
}
