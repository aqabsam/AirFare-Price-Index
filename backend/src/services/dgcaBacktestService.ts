import { getDgcaAnalytics, INSUFFICIENT_DGCA_DATA_MESSAGE } from './dgcaAnalyticsService.js'

export type DgcaReferenceRecord = {
  routeKey?: string
  origin?: string
  destination?: string
  departureDate?: string
  price?: number
  actualFare?: number
}

export type DgcaBacktestResponse = {
  available: boolean
  windowDays: number
  sampleCount: number
  mae: number | null
  rmse: number | null
  mape: number | null
  correlation: number | null
  message: string
}

export async function calculateDgcaBacktest(windowDays = 30): Promise<DgcaBacktestResponse> {
  const dataset = await getDgcaAnalytics()
  return {
    available: false,
    windowDays,
    sampleCount: dataset.fareObservations.length,
    mae: null,
    rmse: null,
    mape: null,
    correlation: null,
    message: INSUFFICIENT_DGCA_DATA_MESSAGE,
  }
}
