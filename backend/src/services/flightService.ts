import type { FlightSearchRequest, NormalizedFlightOffer } from '../types/flight.js'
import { collectFareSnapshotsForRoute } from './fareCollector.js'
import { fareStore, snapshotsToOffers } from './fareStore.js'

export async function searchFlights(input: FlightSearchRequest): Promise<NormalizedFlightOffer[]> {
  try {
    const liveSnapshots = await collectFareSnapshotsForRoute({
      origin: input.origin,
      destination: input.destination,
      departureDate: input.departureDate,
    })

    if (liveSnapshots.length) {
      const normalizedOrigin = input.origin.trim().toUpperCase()
      const normalizedDestination = input.destination.trim().toUpperCase()
      const normalizedDate = input.departureDate.trim()
      const exactRouteKey = `${normalizedOrigin}-${normalizedDestination}-${normalizedDate}`
      const routeSnapshots =
        liveSnapshots.filter((snapshot) => snapshot.routeKey === exactRouteKey).length > 0
          ? liveSnapshots.filter((snapshot) => snapshot.routeKey === exactRouteKey)
          : liveSnapshots.filter(
              (snapshot) => snapshot.origin === normalizedOrigin && snapshot.destination === normalizedDestination,
            )

      return snapshotsToOffers(routeSnapshots, input.adults)
    }
  } catch (error) {
    void error
  }

  return snapshotsToOffers(
    fareStore
      .getSnapshots()
      .filter(
        (snapshot) =>
          snapshot.origin === input.origin.trim().toUpperCase() &&
          snapshot.destination === input.destination.trim().toUpperCase() &&
          snapshot.departureDate === input.departureDate.trim(),
      ),
    input.adults,
  )
}
