export type FlightSearchRequest = {
  origin: string
  destination: string
  departureDate: string
  adults: number
}

export type NormalizedFlightOffer = {
  airline: string
  airlineCode: string
  flightNumber: string
  origin: string
  destination: string
  departureTime: string
  arrivalTime: string
  duration: string
  stops: number
  price: number
  currency: string
  offerId: string
  seatsRemaining: number
  source: string
  sourceType: 'airline' | 'ota' | 'aggregated'
  collectedAt: string
  confidence: number
}

export type FlightSearchResponse = {
  offers: NormalizedFlightOffer[]
}
