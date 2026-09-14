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
  currency: string
  offerId: string
  seatsRemaining: number
  source: string
  sourceType: 'airline' | 'ota' | 'aggregated'
  collectedAt: string
  confidence: number
}

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
}
