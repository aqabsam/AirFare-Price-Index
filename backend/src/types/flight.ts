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
  baseFare?: number | null
  taxes?: number | null
  udf?: number | null
  convenienceFee?: number | null
  totalFare?: number | null
  currency: string
  offerId: string
  seatsRemaining: number
  source: string
  sourceType: 'airline' | 'ota' | 'duffel' | 'demo' | 'aggregated'
  collectedAt: string
  confidence: number
}

export type FlightSearchResponse = {
  offers: NormalizedFlightOffer[]
}
