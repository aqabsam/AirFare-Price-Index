import { airportDisplayLabel, findAirport } from '@/data/airports'
import type { FlightOffer, FlightSearchInput, FlightSearchResult, FlightSearchStatus } from '@/types/flight'
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL?.trim().replace(/\/$/, '') ?? ''
const SEARCH_TIMEOUT_MS = 300_000
const inFlightRequests = new Map<string, Promise<FlightSearchResult>>()

function searchRequestKey(input: FlightSearchInput) {
  return `${String(input.origin || '').trim().toLowerCase()}|${String(input.destination || '').trim().toLowerCase()}|${String(input.travelDate || '').trim()}|${input.adults || 1}`
}

function buildApiUrl(path: string) {
  if (!API_BASE_URL) {
    return path
  }

  if (API_BASE_URL.startsWith('http://localhost') || API_BASE_URL.startsWith('http://127.0.0.1')) {
    return path
  }

  return `${API_BASE_URL}${path}`
}

// The backend returns stored fare snapshots in their source currency. We normalize
// display values to INR so the comparison table is easier to scan for this app's audience.
const CURRENCY_TO_INR: Record<string, number> = {
  INR: 1,
  USD: 95.4,
  EUR: 111.28,
  GBP: 130.06,
}

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
  const rate = CURRENCY_TO_INR[currency.trim().toUpperCase()] ?? 1
  return Math.round(price * rate)
}

function buildFlightIdentity(offer: FlightOffer, travelDate: string) {
  return [
    offer.airlineCode || offer.airline,
    offer.flightNumber,
    offer.origin,
    offer.destination,
    travelDate,
    offer.departureTime,
    offer.arrivalTime,
    String(offer.stops),
  ].join('|').toLowerCase()
}

function normalizeOffers(offers: FlightOffer[], travelDate: string) {
  const cheapestByItinerary = new Map<string, FlightOffer>()

  for (const offer of offers) {
    const normalizedOffer = {
      ...offer,
      price: toINR(offer.price, offer.currency),
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
    const controller = new AbortController()
    const timeoutId = window.setTimeout(() => controller.abort(), SEARCH_TIMEOUT_MS)

    let response: Response
    try {
      response = await fetch(buildApiUrl('/api/flights/search'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          origin: toAirportCode(input.origin),
          destination: toAirportCode(input.destination),
          departureDate: input.travelDate,
          adults: input.adults,
        }),
        signal: controller.signal,
      })
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new Error('Flight search timed out. Please make sure the backend is running and try again.')
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
    } | null

    if (!response.ok) {
      throw new Error(payload?.error ?? 'Unable to search flights right now. Please try again.')
    }

    const offers = normalizeOffers(payload?.offers ?? [], input.travelDate)
    const routeLabels = getRouteLabels(input)

    return {
      ...routeLabels,
      travelDate: input.travelDate,
      totalResults: offers.length,
      cheapestOffer: offers[0] ?? null,
      averagePrice: getAveragePrice(offers),
      offers,
      status: payload?.status ?? (offers.length ? 'duffel_success' : 'duffel_empty_no_fallback'),
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
