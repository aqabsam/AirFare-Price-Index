import type { FlightSearchRequest, NormalizedFlightOffer } from '../types/flight.js'
import { searchDuffelOffers } from '../providers/duffel.js'
import { loadWebsiteScrapers } from '../scrapers/index.js'
import { collectFareSnapshotsForRoute } from './fareCollector.js'

const inFlightSearches = new Map<string, Promise<NormalizedFlightOffer[]>>()

function keyForSearch(input: FlightSearchRequest) {
  return `${input.origin.trim().toUpperCase()}|${input.destination.trim().toUpperCase()}|${input.departureDate.trim()}|${input.adults}`.toLowerCase()
}

function deduplicateOffers(offers: NormalizedFlightOffer[]) {
  const unique = new Map<string, NormalizedFlightOffer>()
  for (const offer of offers) {
    const identity = [
      offer.airlineCode || offer.airline,
      offer.flightNumber,
      offer.origin,
      offer.destination,
      offer.departureTime,
      offer.arrivalTime,
      offer.stops,
    ].join('|').toUpperCase()
    const current = unique.get(identity)
    if (!current || offer.price < current.price) unique.set(identity, offer)
  }
  return [...unique.values()].sort((left, right) => left.price - right.price)
}

export async function searchFlights(input: FlightSearchRequest): Promise<NormalizedFlightOffer[]> {
  const requestKey = keyForSearch(input)
  const existing = inFlightSearches.get(requestKey)
  if (existing) {
    return existing
  }

  const request = (async () => {
    const normalizedOrigin = input.origin.trim().toUpperCase()
    const normalizedDestination = input.destination.trim().toUpperCase()
    const normalizedDate = input.departureDate.trim()
    const exactRouteKey = `${normalizedOrigin}-${normalizedDestination}-${normalizedDate}`

    const configuredSources = loadWebsiteScrapers()
    let primaryError: string | null = null
    let liveSnapshots: ReturnType<typeof collectFareSnapshotsForRoute> extends Promise<infer T> ? T : never = []

    console.info(`[flight-search] PRIMARY SOURCES -> route=${normalizedOrigin}-${normalizedDestination}-${normalizedDate} available_sources=${configuredSources.length}`)

    try {
      liveSnapshots = (await collectFareSnapshotsForRoute({
        origin: input.origin,
        destination: input.destination,
        departureDate: input.departureDate,
        adults: input.adults,
      })).filter((snapshot) => snapshot.sourceType !== 'aggregated' && snapshot.sourceType !== 'demo')
    } catch (error) {
      primaryError = error instanceof Error ? error.message : 'primary source collection failed'
      console.warn(`[flight-search] PRIMARY SOURCES -> error=${primaryError}`)
      liveSnapshots = []
    }

    const routeSnapshots = liveSnapshots.filter((snapshot) => snapshot.routeKey === exactRouteKey)
    console.info(`[flight-search] PRIMARY SOURCES -> results=${routeSnapshots.length} error=${primaryError ?? 'none'}`)

    if (routeSnapshots.length) {
      const uniqueByFlight = new Map<string, (typeof routeSnapshots)[number]>()

      for (const snapshot of routeSnapshots) {
        const identity = [
          snapshot.airlineCode || snapshot.airline,
          snapshot.flightNumber,
          snapshot.origin,
          snapshot.destination,
          snapshot.departureDate,
          snapshot.departureTime,
          snapshot.arrivalTime,
          String(snapshot.stops),
        ].join('|').toUpperCase()

        const current = uniqueByFlight.get(identity)
        if (!current || snapshot.price < current.price) {
          uniqueByFlight.set(identity, snapshot)
        }
      }

      const uniqueSnapshots = [...uniqueByFlight.values()].sort((left, right) => left.price - right.price)

      return uniqueSnapshots.map((snapshot) => ({
        airline: snapshot.airline,
        airlineCode: snapshot.airlineCode,
        flightNumber: snapshot.flightNumber,
        origin: snapshot.origin,
        destination: snapshot.destination,
        departureTime: snapshot.departureTime,
        arrivalTime: snapshot.arrivalTime,
        duration: `${Math.floor(snapshot.durationMinutes / 60)}h ${String(snapshot.durationMinutes % 60).padStart(2, '0')}m`,
        stops: snapshot.stops,
        price: snapshot.price * input.adults,
        baseFare: snapshot.baseFare,
        taxes: snapshot.taxes,
        udf: snapshot.udf,
        convenienceFee: snapshot.convenienceFee,
        totalFare: snapshot.totalFare ?? snapshot.price,
        currency: snapshot.currency,
        offerId: snapshot.id,
        seatsRemaining: snapshot.seatsRemaining,
        source: snapshot.source,
        sourceType: snapshot.sourceType,
        collectedAt: snapshot.collectedAt,
        confidence: snapshot.confidence,
      }))
    }

    console.info(`[flight-search] DUFFEL FALLBACK -> called route=${normalizedOrigin}-${normalizedDestination}-${normalizedDate}`)
    try {
      const duffelOffers = await searchDuffelOffers(input)
      console.info(`[flight-search] DUFFEL FALLBACK -> valid_offers=${duffelOffers.length}`)
      if (duffelOffers.length) {
        return deduplicateOffers(duffelOffers)
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'duffel fallback failed'
      console.warn(`[flight-search] DUFFEL FALLBACK -> error=${message}`)
    }

    console.warn('[flight-search] No verified flights available for this search.')
    return []
  })()

  inFlightSearches.set(requestKey, request)

  try {
    return await request
  } finally {
    inFlightSearches.delete(requestKey)
  }
}
