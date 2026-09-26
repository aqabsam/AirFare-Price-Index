export type FareSnapshot = {
  id: string
  routeKey: string
  origin: string
  destination: string
  departureDate: string
  bookingWindowDays?: number
  fareClass?: string | null
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
  baseFare?: number | null
  taxes?: number | null
  udf?: number | null
  convenienceFee?: number | null
  totalFare?: number | null
  currency: string
  seatsRemaining: number
  soldOut?: boolean
  source: string
  collectionStage?: 'SEARCH' | 'SCRAPER' | 'DUFFEL' | 'DEMO'
  sourceType: 'airline' | 'ota' | 'duffel' | 'demo' | 'aggregated'
  confidence: number
  dataQualityScore?: number | null
  dataQualityStatus?: 'valid' | 'missing' | 'invalid' | 'outlier' | 'duplicate'
  rejectedReason?: string | null
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
  airfareIndex: number | null
  currency: string
  topCarrier: string
  lastCollectedAt: string
  changePercent?: number | null
}

export type FareTrendPoint = {
  collectionDate: string
  bookingWindowDays: number
  routeCount: number
  cheapestPrice: number
  averagePrice: number
  airfareIndex: number | null
  percentageChange: number | null
  elasticity: number | null
  lastCollectedAt: string
}

export type FareHeatmapCell = {
  routeKey: string
  origin: string
  destination: string
  departureDate: string
  bookingWindowDays: number
  cheapestPrice: number
  airfareIndex: number | null
  topCarrier: string
  lastCollectedAt: string
}

export type FareDailyIndexPoint = {
  collectionDate: string
  routeCount: number
  cheapestPrice: number
  averagePrice: number
  airfareIndex: number | null
  lastCollectedAt: string
}

export type FarePeriodIndexPoint = {
  period: 'week' | 'month'
  periodStart: string
  routeCount: number
  cheapestPrice: number
  averagePrice: number
  airfareIndex: number | null
  percentageChange: number | null
  lastCollectedAt: string
}

export type FareSourceComparison = {
  sourceId: string
  source: string
  sourceType: 'airline' | 'ota' | 'duffel' | 'demo' | 'aggregated'
  offerCount: number
  routeCount: number
  cheapestPrice: number
  averagePrice: number
  sharePercent: number
}

export type FareCatalogResponse = {
  snapshots: FareSnapshot[]
  summary: FareRouteSummary[]
}

export type FareAnalyticsResponse = {
  summary: FareRouteSummary[]
  trends: FareTrendPoint[]
  dailyIndex: FareDailyIndexPoint[]
  weeklyIndex: FarePeriodIndexPoint[]
  monthlyIndex: FarePeriodIndexPoint[]
  heatmap: FareHeatmapCell[]
  sourceComparison: FareSourceComparison[]
  base: {
    value: number | null
    period: string | null
  }
  methodology?: {
    basePeriod: string | null
    routeBasket: string[]
    routeWeights: Record<string, number>
    officialSources: Array<'airline' | 'ota' | 'duffel'>
  }
}

export type FareSourceHealth = {
  id: string
  name: string
  sourceType: 'airline' | 'ota' | 'duffel' | 'demo' | 'aggregated'
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
