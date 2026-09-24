import type { FlightSearchRequest, NormalizedFlightOffer } from '../types/flight.js'

export class DuffelProviderError extends Error {
  statusCode: number

  constructor(message: string, statusCode = 502) {
    super(message)
    this.name = 'DuffelProviderError'
    this.statusCode = statusCode
  }
}

type DuffelCarrier = {
  name?: string | null
  iata_code?: string | null
}

type DuffelSegment = {
  operating_carrier?: DuffelCarrier | null
  marketing_carrier?: DuffelCarrier | null
  operating_carrier_flight_number?: string | null
  marketing_carrier_flight_number?: string | null
  flight_number?: string | null
  departing_at?: string | null
  arriving_at?: string | null
}

type DuffelSlice = {
  origin?: { iata_code?: string | null } | null
  destination?: { iata_code?: string | null } | null
  segments?: DuffelSegment[] | null
}

type DuffelOffer = {
  id?: string | null
  total_amount?: number | string | null
  total_currency?: string | null
  total_duration?: string | null
  slices?: DuffelSlice[] | null
}

type DuffelPayload = {
  data?: { offers?: DuffelOffer[] | null }
  offers?: DuffelOffer[] | null
  errors?: Array<{ message?: string | null; title?: string | null }>
}

function parseIsoDuration(duration: string | null | undefined): number | null {
  if (!duration) return null

  const isoMatch = duration.match(/^P(?:T)?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/i)
  if (isoMatch) {
    const hours = Number(isoMatch[1] ?? 0)
    const minutes = Number(isoMatch[2] ?? 0)
    const seconds = Number(isoMatch[3] ?? 0)
    return Math.max(0, Math.round(hours * 60 + minutes + seconds / 60))
  }

  const clockMatch = duration.match(/^(\d+):(\d{2}):(\d{2})$/)
  if (clockMatch) {
    const hours = Number(clockMatch[1])
    const minutes = Number(clockMatch[2])
    const seconds = Number(clockMatch[3])
    return Math.max(0, Math.round(hours * 60 + minutes + seconds / 60))
  }

  const minuteMatch = duration.match(/^(\d+)m$/i)
  if (minuteMatch) {
    return Number(minuteMatch[1])
  }

  return null
}

function formatDuration(minutes: number) {
  const hours = Math.floor(minutes / 60)
  const remainder = minutes % 60
  return `${hours}h ${String(remainder).padStart(2, '0')}m`
}

function formatClockTime(isoString: string | null | undefined) {
  if (!isoString) return '--:--'
  const clockMatch = isoString.match(/T(\d{2}:\d{2})/)
  return clockMatch ? clockMatch[1] : '--:--'
}

function calculateDuration(startIso: string | null | undefined, endIso: string | null | undefined, fallbackDuration: string | null | undefined) {
  if (startIso && endIso) {
    const start = new Date(startIso).getTime()
    const end = new Date(endIso).getTime()
    if (Number.isFinite(start) && Number.isFinite(end) && end >= start) {
      return formatDuration(Math.max(0, Math.round((end - start) / 60000)))
    }
  }

  const parsed = parseIsoDuration(fallbackDuration ?? null)
  return parsed !== null ? formatDuration(parsed) : '--'
}

function isBlockedAirlineName(value: string | null | undefined) {
  if (!value) return false
  const normalized = value.trim().toLowerCase()
  return (
    normalized.includes('duffel') ||
    normalized.includes('american express') ||
    normalized.includes('amex') ||
    normalized.includes('booking') ||
    normalized.includes('payment') ||
    normalized.includes('provider') ||
    normalized.includes('travel')
  )
}

function cleanAirlineCode(value: string | null | undefined) {
  if (!value) return ''
  const cleaned = value.trim().toUpperCase()
  return /^[A-Z0-9]{2,3}$/.test(cleaned) ? cleaned : ''
}

function normalizeFlightNumber(airlineCode: string, rawNumber: string | null | undefined) {
  if (rawNumber === undefined || rawNumber === null) return null

  const value = String(rawNumber).trim()
  if (!value) return null

  const merged = value.toUpperCase()
  if (/^[A-Z]{2,3}\d{1,5}$/.test(merged)) {
    return merged
  }

  if (/^\d{1,5}$/.test(merged) && airlineCode) {
    return `${airlineCode}${merged}`
  }

  return null
}

export function normalizeDuffelOffer(offer: DuffelOffer, requestedRoute: FlightSearchRequest): NormalizedFlightOffer | null {
  const slice = offer.slices?.[0]
  const segments = slice?.segments ?? []
  const firstSegment = segments[0]
  const lastSegment = segments[segments.length - 1] ?? firstSegment

  if (!slice || !firstSegment || !lastSegment) {
    return null
  }

  const carrier = firstSegment.operating_carrier ?? firstSegment.marketing_carrier ?? {}
  const airline = carrier.name?.trim() || 'Unknown airline'
  const airlineCode = cleanAirlineCode(carrier.iata_code)

  if (!airline || !airlineCode || isBlockedAirlineName(airline) || airlineCode === 'ZZ') {
    return null
  }

  const flightNumberValue = normalizeFlightNumber(
    airlineCode,
    firstSegment.operating_carrier_flight_number ?? firstSegment.marketing_carrier_flight_number ?? firstSegment.flight_number,
  )

  if (!flightNumberValue) {
    return null
  }

  const priceValue = Number(offer.total_amount)
  if (!Number.isFinite(priceValue) || priceValue <= 0) {
    return null
  }

  const routeOrigin = slice.origin?.iata_code?.trim().toUpperCase() || requestedRoute.origin.toUpperCase()
  const routeDestination = slice.destination?.iata_code?.trim().toUpperCase() || requestedRoute.destination.toUpperCase()

  if (routeOrigin !== requestedRoute.origin.trim().toUpperCase() || routeDestination !== requestedRoute.destination.trim().toUpperCase()) {
    return null
  }

  const requestedDate = requestedRoute.departureDate.trim()
  const departureDate = firstSegment.departing_at?.slice(0, 10)
  if (departureDate && departureDate !== requestedDate) {
    return null
  }

  return {
    airline,
    airlineCode,
    flightNumber: flightNumberValue,
    origin: routeOrigin,
    destination: routeDestination,
    departureTime: formatClockTime(firstSegment.departing_at),
    arrivalTime: formatClockTime(lastSegment.arriving_at),
    duration: calculateDuration(firstSegment.departing_at, lastSegment.arriving_at, offer.total_duration),
    stops: Math.max(0, segments.length - 1),
    price: priceValue,
    currency: (offer.total_currency ?? 'INR').trim().toUpperCase() || 'INR',
    offerId: offer.id?.trim() || `${airlineCode}-${flightNumberValue}`,
    seatsRemaining: 1,
    source: 'Duffel API',
    sourceType: 'duffel',
    collectedAt: new Date().toISOString(),
    confidence: 0.82,
    baseFare: priceValue,
    taxes: 0,
    udf: 0,
    convenienceFee: 0,
    totalFare: priceValue,
  }
}

export function getDuffelAccessToken() {
  return process.env.DUFFEL_ACCESS_TOKEN?.trim() || process.env.DUFFEL_API_KEY?.trim() || ''
}

export async function searchDuffelOffers(input: FlightSearchRequest): Promise<NormalizedFlightOffer[]> {
  const apiKey = getDuffelAccessToken()
  if (!apiKey) {
    throw new DuffelProviderError('DUFFEL_ACCESS_TOKEN or DUFFEL_API_KEY is not configured in backend/.env', 500)
  }

  const baseUrl = (process.env.DUFFEL_API_BASE_URL?.trim() || 'https://api.duffel.com').replace(/\/$/, '')
  const supplierTimeout = Number(process.env.DUFFEL_SUPPLIER_TIMEOUT_MS ?? '10000')
  const timeoutMs = Number.isFinite(supplierTimeout) && supplierTimeout > 0 ? supplierTimeout : 10000
  const controller = new AbortController()
  const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs + 1000)

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
    })

    const payload = (await response.json().catch(() => null)) as DuffelPayload | null
    if (!response.ok) {
      const firstError = payload?.errors?.[0]
      const message = firstError?.message || firstError?.title || `Duffel request failed with status ${response.status}`
      throw new DuffelProviderError(message, response.status)
    }

    const offers = payload?.data?.offers ?? payload?.offers ?? []

    return offers
      .map((offer) => normalizeDuffelOffer(offer, input))
      .filter((offer): offer is NormalizedFlightOffer => Boolean(offer))
      .sort((left, right) => left.price - right.price)
  } catch (error) {
    if (error instanceof DuffelProviderError) throw error
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new DuffelProviderError('Duffel request timed out before returning offers', 504)
    }
    throw new DuffelProviderError('Unable to fetch live flight offers from Duffel', 502)
  } finally {
    clearTimeout(timeoutHandle)
  }
}
