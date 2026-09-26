export type FlightSearchRequest = {
  origin: string
  destination: string
  departureDate: string
  adults: number
}

export type NormalizedFlightSegment = {
  airline: string
  airlineCode: string
  marketingAirline: string | null
  marketingAirlineCode: string | null
  operatingAirline: string | null
  operatingAirlineCode: string | null
  carrierCountryCode: string | null
  logoUrl: string | null
  flightNumber: string
  origin: string
  destination: string
  departureDate: string
  departureTime: string
  arrivalDate: string
  arrivalTime: string
}

export type NormalizedFlightOffer = {
  airline: string
  airlineCode: string
  flightNumber: string
  segments?: NormalizedFlightSegment[]
  origin: string
  destination: string
  departureDate: string
  liveMode: boolean
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
  | 'live_success'
  | 'duffel_success'
  | 'duffel_empty_with_fallback'
  | 'duffel_empty_no_fallback'
  | 'duffel_error_with_fallback'
  | 'duffel_error_no_fallback'
  | 'no_results'

export type FlightSearchResponse = {
  offers: NormalizedFlightOffer[]
  status: FlightSearchStatus
  message?: string
  source?: 'Verified airline/OTA source' | 'Live Web Scraping' | 'Duffel API'
}
