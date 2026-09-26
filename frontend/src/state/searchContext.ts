import { createContext, useContext } from 'react'
import type { FlightSearchInput, FlightSearchResult } from '@/types/flight'
import type {
  AirfareIndexResponse,
  DataQualityResponse,
  DgcaBacktestResponse,
  FareAnalyticsResponse,
  FareExplorerResponse,
  FareIndexHistoryResponse,
  FareSnapshot,
  FareSourceHealthResponse,
} from '@/types/fare'

export type SearchData = {
  input: FlightSearchInput
  result: FlightSearchResult
  index: AirfareIndexResponse
  allRoutes: AirfareIndexResponse['routes']
  analytics: FareAnalyticsResponse
  snapshots: FareSnapshot[]
  quality: DataQualityResponse
  backtest: DgcaBacktestResponse
  sourceHealth: FareSourceHealthResponse
  history: FareIndexHistoryResponse['history']
  explorer: FareExplorerResponse
}

export type SearchedRoute = {
  origin: string
  destination: string
  travelDate: string
  searchedAt: string
  offers: Array<Pick<FlightSearchResult['offers'][number], 'airline' | 'airlineCode' | 'flightNumber' | 'price' | 'currency' | 'source'>>
}

export type VerifiedFareObservation = {
  id: string
  origin: string
  destination: string
  travelDate: string
  collectedAt: string
  airline: string
  flightNumber: string
  fare: number
  currency: string
}

export type SearchStateValue = {
  data: SearchData | null
  fareHistoryObservations: VerifiedFareObservation[]
  searchedRoutes: SearchedRoute[]
  loading: boolean
  error: string
  executeSearch: (input: FlightSearchInput) => Promise<SearchData>
}

export const SearchStateContext = createContext<SearchStateValue | null>(null)

export function useSearchState() {
  const value = useContext(SearchStateContext)
  if (!value) {
    throw new Error('useSearchState must be used inside SearchStateProvider')
  }
  return value
}