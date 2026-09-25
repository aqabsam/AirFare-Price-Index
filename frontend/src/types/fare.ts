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
  baseFare?: number | null
  taxes?: number | null
  udf?: number | null
  convenienceFee?: number | null
  totalFare?: number | null
  currency: string
  seatsRemaining: number
  source: string
  sourceType: 'airline' | 'ota' | 'duffel' | 'demo' | 'aggregated'
  fareClass?: string | null
  collectionStage?: 'SCRAPER' | 'DUFFEL' | 'DEMO'
  soldOut?: boolean
  dataQualityScore?: number | null
  dataQualityStatus?: 'valid' | 'missing' | 'invalid' | 'outlier' | 'duplicate'
  rejectedReason?: string | null
  confidence: number
}
export type DataQualityResponse = {
  rawRecords: number | null
  rejectedRecords?: number
  averageQualityScore?: number | null
  qualityBySource?: Record<string, { records: number; averageScore: number | null }>
  cleanedRecords: number
  duplicateRecords: number
  outlierRecords: number
  missingFieldRecords: number
  soldOutRecords: number
  unknownAvailabilityRecords: number
  message: string
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

export type DgcaBacktestResponse = {
  available: boolean
  windowDays: number
  sampleCount: number
  mae: number | null
  rmse?: number | null
  mape: number | null
  correlation: number | null
  message: string
}

export type FareSnapshotsResponse = {
  snapshots: FareSnapshot[]
}

export type FareSummaryResponse = {
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
  base?: {
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

export type AirfareIndexResponse = {
  routeCount: number
  routes: FareRouteSummary[]
}

export type FareIndexHistoryResponse = {
  history: Array<{
    routeKey: string
    departureDate: string
    cheapestPrice: number
    averagePrice: number
    medianPrice: number
    airfareIndex: number
    calculatedAt: string
  }>
}

export type FareCollectionStatus = {
  status: 'idle' | 'running' | 'success' | 'error'
  trigger: 'startup' | 'scheduled' | 'manual'
  startedAt: string | null
  finishedAt: string | null
  sourceCount: number
  snapshotCount: number
  message: string | null
}

export type FareCollectionStatusResponse = {
  status: FareCollectionStatus
  snapshotCount: number
  routes: number
}

export type FareCollectionRunResponse = {
  ok: boolean
  status: FareCollectionStatus
  error?: string
}

export type FareExplorerResponse = {
  raw: FareSnapshot[]
  cleaned: FareSnapshot[]
  rejected: FareSnapshot[]
  indexHistory?: Array<{
    routeKey: string
    departureDate: string
    cheapestPrice: number
    averagePrice: number
    medianPrice: number
    airfareIndex: number
    calculatedAt: string
  }>
  collectionStatus: FareCollectionStatus
  collectionLogs: Array<{
    id: string
    startedAt: string
    finishedAt: string | null
    trigger: 'startup' | 'scheduled' | 'manual'
    status: 'running' | 'success' | 'error'
    source: string
    records: number
    message: string | null
  }>
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
