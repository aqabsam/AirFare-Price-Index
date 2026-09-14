export type FareSnapshot = {
  id: string
  routeKey: string
  origin: string
  destination: string
  departureDate: string
  bookingWindowDays?: number
  collectionDate?: string
  collectedAt: string
  sourceId?: string
  airline: string
  airlineCode: string
  flightNumber: string
  departureTime: string
  arrivalTime: string
  durationMinutes: number
  stops: number
  price: number
  currency: string
  seatsRemaining: number
  source: string
  sourceType: 'airline' | 'ota' | 'aggregated'
  confidence: number
}

export type FareRouteSummary = {
  routeKey: string
  origin: string
  destination: string
  departureDate: string
  bookingWindowDays: number
  collectionDate: string
  offerCount: number
  cheapestPrice: number
  averagePrice: number
  medianPrice: number
  airfareIndex: number
  currency: string
  topCarrier: string
  lastCollectedAt: string
}

export type FareTrendPoint = {
  collectionDate: string
  bookingWindowDays: number
  routeCount: number
  cheapestPrice: number
  averagePrice: number
  airfareIndex: number
  lastCollectedAt: string
}

export type FareHeatmapCell = {
  routeKey: string
  origin: string
  destination: string
  departureDate: string
  bookingWindowDays: number
  cheapestPrice: number
  airfareIndex: number
  topCarrier: string
  lastCollectedAt: string
}

export type FareDailyIndexPoint = {
  collectionDate: string
  routeCount: number
  cheapestPrice: number
  averagePrice: number
  airfareIndex: number
  lastCollectedAt: string
}

export type FareCatalogResponse = {
  snapshots: FareSnapshot[]
  summary: FareRouteSummary[]
}

export type FareAnalyticsResponse = {
  summary: FareRouteSummary[]
  trends: FareTrendPoint[]
  dailyIndex: FareDailyIndexPoint[]
  heatmap: FareHeatmapCell[]
}

export type FareSourceHealth = {
  id: string
  name: string
  sourceType: 'airline' | 'ota' | 'aggregated'
  kind: 'page' | 'api'
  url: string
  routeCount: number
  bookingWindows: number[]
  snapshotCount: number
  lastCollectedAt: string | null
  status: 'live' | 'stale' | 'empty'
}

export type FareSourceHealthResponse = {
  sources: FareSourceHealth[]
  liveCount: number
  staleCount: number
  emptyCount: number
}
