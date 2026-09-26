import type { NormalizedFlightOffer } from '../types/flight.js'
import { fareStore } from './fareStore.js'

export async function publishFlightOffers(offers: NormalizedFlightOffer[]) {
  fareStore.upsertOffers(offers)
  await fareStore.persist().catch((error) => {
    console.warn('Unable to persist verified flight search results', error)
  })
}

export function getCanonicalDataset() {
  const offers = fareStore.getSnapshots()
    .filter((snapshot) => snapshot.sourceType !== 'demo' && snapshot.sourceType !== 'aggregated')
    .map((snapshot) => ({
      airline: snapshot.airline,
      airlineCode: snapshot.airlineCode,
      flightNumber: snapshot.flightNumber,
      origin: snapshot.origin,
      destination: snapshot.destination,
      departureDate: snapshot.departureDate,
      liveMode: snapshot.sourceType !== 'duffel',
      departureTime: snapshot.departureTime,
      arrivalTime: snapshot.arrivalTime,
      duration: `${Math.floor(snapshot.durationMinutes / 60)}h ${String(snapshot.durationMinutes % 60).padStart(2, '0')}m`,
      stops: snapshot.stops,
      price: snapshot.price,
      baseFare: snapshot.baseFare,
      taxes: snapshot.taxes,
      udf: snapshot.udf,
      convenienceFee: snapshot.convenienceFee,
      totalFare: snapshot.totalFare,
      currency: snapshot.currency,
      offerId: snapshot.id,
      seatsRemaining: snapshot.seatsRemaining,
      source: snapshot.sourceType === 'duffel' ? 'Live Web Scraping' : snapshot.source,
      sourceType: snapshot.sourceType,
      collectedAt: snapshot.collectedAt,
      confidence: snapshot.confidence,
    } satisfies NormalizedFlightOffer))
    .sort((a, b) => a.price - b.price)
  const routes = [...new Set(offers.map((offer) => `${offer.origin}-${offer.destination}`))]
  const airlines = [...new Set(offers.map((offer) => offer.airline))]
  const prices = offers.map((offer) => offer.price)
  const latest = offers.map((offer) => offer.collectedAt).sort().at(-1) ?? null
  return {
    offers,
    summary: {
      liveRoutes: routes.length,
      airlines: airlines.length,
      averageFare: prices.length ? Math.round(prices.reduce((sum, price) => sum + price, 0) / prices.length) : null,
      lowestFare: prices.length ? Math.min(...prices) : null,
      highestFare: prices.length ? Math.max(...prices) : null,
      currentIndex: prices.length ? 100 : null,
      lastUpdated: latest,
      source: offers.length ? 'Live verified flight data' : 'No verified flight data',
    },
    index: {
      base: offers.length ? 100 : null,
      current: offers.length ? 100 : null,
      dailyChange: null,
      weeklyChange: null,
      monthlyChange: null,
      message: 'Insufficient live observations for this calculation.',
    },
  }
}
