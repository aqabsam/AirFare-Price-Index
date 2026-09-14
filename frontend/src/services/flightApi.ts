import { airportDisplayLabel, findAirport } from '@/data/airports'
import type { FlightOffer, FlightSearchInput, FlightSearchResult } from '@/types/flight'
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL?.trim().replace(/\/$/, '') ?? ''

function buildApiUrl(path: string) {
  if (!API_BASE_URL) {
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

function dedupeOffersByAirline(offers: FlightOffer[]) {
  const cheapestByAirline = new Map<string, FlightOffer>()

  for (const offer of offers) {
    const key = offer.airlineCode.trim().toUpperCase() || offer.airline.trim().toLowerCase()
    const nextOffer = {
      ...offer,
      price: toINR(offer.price, offer.currency),
      currency: 'INR',
    }

    const current = cheapestByAirline.get(key)
    if (!current || nextOffer.price < current.price) {
      cheapestByAirline.set(key, nextOffer)
    }
  }

  return [...cheapestByAirline.values()].sort((left, right) => left.price - right.price)
}

export async function searchFlights(input: FlightSearchInput): Promise<FlightSearchResult> {
  const response = await fetch(buildApiUrl('/api/flights/search'), {
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
  })

  const payload = (await response.json().catch(() => null)) as { offers?: FlightOffer[]; error?: string } | null

  if (!response.ok) {
    throw new Error(payload?.error ?? 'Unable to search flights right now. Please try again.')
  }

  const offers = dedupeOffersByAirline(payload?.offers ?? [])
  const routeLabels = getRouteLabels(input)

  return {
    ...routeLabels,
    travelDate: input.travelDate,
    totalResults: offers.length,
    cheapestOffer: offers[0] ?? null,
    averagePrice: getAveragePrice(offers),
    offers,
  }
}
