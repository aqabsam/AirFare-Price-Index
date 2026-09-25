export type FlightSearchInput = {
  origin: string
  destination: string
  travelDate: string
  adults: number
}

export type FlightOffer = {
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

export type FlightSearchStatus =
  | 'duffel_success'
  | 'duffel_empty_with_fallback'
  | 'duffel_empty_no_fallback'
  | 'duffel_error_with_fallback'
  | 'duffel_error_no_fallback'

export type FlightSearchResult = {
  routeLabel: string
  airportLabel: string
  originLabel: string
  destinationLabel: string
  travelDate: string
  totalResults: number
  cheapestOffer: FlightOffer | null
  averagePrice: number
  offers: FlightOffer[]
  status: FlightSearchStatus
  message?: string
}
