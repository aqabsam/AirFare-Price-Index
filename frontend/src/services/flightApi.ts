import { airportDisplayLabel, findAirport } from '@/data/airports'
import type { FlightOffer, FlightSearchInput, FlightSearchResult, FlightSearchStatus } from '@/types/flight'
import { convertFareToINR } from '@/services/fareCalculations'
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL?.trim().replace(/\/$/, '') ?? ''
const SEARCH_TIMEOUT_MS = 300_000
const inFlightRequests = new Map<string, Promise<FlightSearchResult>>()

function searchRequestKey(input: FlightSearchInput) {
  return `${String(input.origin || '').trim().toLowerCase()}|${String(input.destination || '').trim().toLowerCase()}|${String(input.travelDate || '').trim()}|${input.adults || 1}`
}

function buildApiUrl(path: string) {
  if (import.meta.env.DEV || !API_BASE_URL) {
    return path
  }

  if (API_BASE_URL.startsWith('http://localhost') || API_BASE_URL.startsWith('http://127.0.0.1')) {
    return path
  }

  return `${API_BASE_URL}${path}`
}

// The backend returns stored fare snapshots in their source currency. We normalize
// display values to INR so the comparison table is easier to scan for this app's audience.

function toAirportCode(input: string) {
  const airport = findAirport(input)
  if (airport) {
    return airport.code
  }

  const normalized = input.trim().toUpperCase()
  if (/^[A-Z]{3}$/.test(normalized)) {
    return normalized
  }

  return normalized
}

function normalizeDepartureDate(value: string) {
  const departureDate = value.trim()
  const match = departureDate.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) {
    throw new Error('Choose a departure date in YYYY-MM-DD format.')
  }
  const [, yearText, monthText, dayText] = match
  const year = Number(yearText)
  const month = Number(monthText)
  const day = Number(dayText)
  const date = new Date(Date.UTC(year, month - 1, day))
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    throw new Error('Choose a valid departure date.')
  }
  return departureDate
}

function getRouteLabels(input: FlightSearchInput) {
  const origin = findAirport(input.origin)
  const destination = findAirport(input.destination)

  return {
    originLabel: origin ? airportDisplayLabel(origin) : input.origin,
    destinationLabel: destination ? airportDisplayLabel(destination) : input.destination,
    routeLabel:
      origin && destination ? `${origin.city} to ${destination.city}` : `${input.origin} to ${input.destination}`,
    airportLabel:
      origin && destination
        ? `${airportDisplayLabel(origin)} → ${airportDisplayLabel(destination)}`
        : 'Type an airport name or code to search.',
  }
}

function getAveragePrice(offers: FlightOffer[]) {
  if (!offers.length) {
    return 0
  }

  return Math.round(offers.reduce((sum, offer) => sum + offer.price, 0) / offers.length)
}

function toINR(price: number, currency: string) {
  return convertFareToINR(price, currency)
}

function buildFlightIdentity(offer: FlightOffer, travelDate: string) {
  const segmentIdentity = offer.segments?.map((segment) => [
    segment.airlineCode,
    segment.flightNumber,
    segment.origin,
    segment.destination,
    segment.departureDate,
    segment.departureTime,
    segment.arrivalDate,
    segment.arrivalTime,
  ].join(':')).join('~') ?? ''

  return [
    offer.airlineCode || offer.airline,
    offer.flightNumber.replace(/[^a-z0-9]/gi, ''),
    offer.origin,
    offer.destination,
    travelDate,
    offer.departureTime,
    offer.arrivalTime,
    offer.duration,
    offer.stops,
    segmentIdentity,
  ].join('|').toLowerCase()
}

function normalizeOffers(offers: FlightOffer[], travelDate: string) {
  const cheapestByItinerary = new Map<string, FlightOffer>()

  for (const offer of offers) {
    const sourceCurrency = offer.currency
    const normalizedOffer = {
      ...offer,
      price: toINR(offer.totalFare ?? offer.price, sourceCurrency),
      baseFare: offer.baseFare === null || offer.baseFare === undefined ? offer.baseFare : toINR(offer.baseFare, sourceCurrency),
      taxes: offer.taxes === null || offer.taxes === undefined ? offer.taxes : toINR(offer.taxes, sourceCurrency),
      udf: offer.udf === null || offer.udf === undefined ? offer.udf : toINR(offer.udf, sourceCurrency),
      convenienceFee: offer.convenienceFee === null || offer.convenienceFee === undefined ? offer.convenienceFee : toINR(offer.convenienceFee, sourceCurrency),
      totalFare: toINR(offer.totalFare ?? offer.price, sourceCurrency),
      currency: 'INR',
    }
    const itineraryKey = buildFlightIdentity(normalizedOffer, travelDate)

    const current = cheapestByItinerary.get(itineraryKey)
    if (!current || normalizedOffer.price < current.price) {
      cheapestByItinerary.set(itineraryKey, normalizedOffer)
    }
  }

  return [...cheapestByItinerary.values()].sort((left, right) => left.price - right.price)
}

export async function searchFlights(input: FlightSearchInput): Promise<FlightSearchResult> {
  const requestKey = searchRequestKey(input)
  const existing = inFlightRequests.get(requestKey)
  if (existing) {
    return existing
  }

  const request = (async () => {
    const origin = toAirportCode(input.origin)
    const destination = toAirportCode(input.destination)
    const departureDate = normalizeDepartureDate(input.travelDate)
    const controller = new AbortController()
    const timeoutId = window.setTimeout(() => controller.abort(), SEARCH_TIMEOUT_MS)
    const requestBody = {
      origin,
      destination,
      departureDate,
      adults: Number.isInteger(input.adults) ? input.adults : 1,
    }
    const requestUrl = buildApiUrl('/api/flights/search')

    console.info('[SEARCH] sending request', {
      url: requestUrl,
      method: 'POST',
      body: requestBody,
    })

    let response: Response
    try {
      response = await fetch(requestUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      })
      console.info('[SEARCH] response received', {
        url: requestUrl,
        status: response.status,
        ok: response.ok,
      })
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new Error('Flight search timed out. Please make sure the backend is running and try again.', { cause: error })
      }

      throw error
    } finally {
      window.clearTimeout(timeoutId)
    }

    const payload = (await response.json().catch(() => null)) as {
      offers?: FlightOffer[]
      error?: string
      message?: string
      status?: FlightSearchStatus
      details?: { fieldErrors?: Record<string, string[]>; formErrors?: string[] }
    } | null

    console.log('[UI SEARCH RESPONSE]', payload)

    if (!response.ok) {
      const validationMessages = [
        ...(payload?.details?.formErrors ?? []),
        ...Object.values(payload?.details?.fieldErrors ?? {}).flat(),
      ]
      throw new Error(validationMessages.length
        ? validationMessages.join(' ')
        : payload?.error ?? 'Unable to search flights right now. Please try again.')
    }

    const offers = normalizeOffers(payload?.offers ?? [], input.travelDate)
    console.log('[UI FLIGHTS COUNT]', offers.length)
    const routeLabels = getRouteLabels(input)

    return {
      ...routeLabels,
      travelDate: departureDate,
      totalResults: offers.length,
      cheapestOffer: offers[0] ?? null,
      averagePrice: getAveragePrice(offers),
      offers,
      status: payload?.status ?? (offers.length ? 'live_success' : 'no_results'),
      message: payload?.message,
    }
  })()

  inFlightRequests.set(requestKey, request)

  try {
    return await request
  } finally {
    inFlightRequests.delete(requestKey)
  }
}
