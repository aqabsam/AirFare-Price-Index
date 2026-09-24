import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fareStore } from './fareStore.js'

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

function correlation(actual: number[], predicted: number[]) {
  if (actual.length < 2 || predicted.length !== actual.length) return null
  const actualMean = actual.reduce((sum, value) => sum + value, 0) / actual.length
  const predictedMean = predicted.reduce((sum, value) => sum + value, 0) / predicted.length
  const numerator = actual.reduce((sum, value, index) => sum + (value - actualMean) * ((predicted[index] ?? 0) - predictedMean), 0)
  const actualVariance = actual.reduce((sum, value) => sum + (value - actualMean) ** 2, 0)
  const predictedVariance = predicted.reduce((sum, value) => sum + (value - predictedMean) ** 2, 0)
  const denominator = Math.sqrt(actualVariance * predictedVariance)
  return denominator > 0 ? Number((numerator / denominator).toFixed(4)) : null
}

export async function calculateDgcaBacktest(windowDays = 30): Promise<DgcaBacktestResponse> {
  const configuredPath = process.env.DGCA_BACKTEST_FILE?.trim()
  if (!configuredPath) {
    return { available: false, windowDays, sampleCount: 0, mae: null, rmse: null, mape: null, correlation: null, message: 'Configure DGCA_BACKTEST_FILE with an actual DGCA reference dataset.' }
  }

  let records: DgcaReferenceRecord[]
  try {
    const parsed = JSON.parse(await readFile(path.resolve(configuredPath), 'utf8')) as unknown
    records = Array.isArray(parsed) ? parsed as DgcaReferenceRecord[] : []
  } catch {
    return { available: false, windowDays, sampleCount: 0, mae: null, rmse: null, mape: null, correlation: null, message: 'DGCA reference dataset could not be read.' }
  }

  const snapshots = fareStore.getSnapshots()
  const actual: number[] = []
  const predicted: number[] = []
  for (const record of records) {
    const origin = record.origin?.trim().toUpperCase()
    const destination = record.destination?.trim().toUpperCase()
    const date = record.departureDate?.trim()
    const routeKey = record.routeKey?.trim().toUpperCase() || (origin && destination && date ? `${origin}-${destination}-${date}` : '')
    const actualFare = Number(record.actualFare ?? record.price)
    if (!routeKey || !Number.isFinite(actualFare) || actualFare <= 0) continue
    const candidates = snapshots.filter((snapshot) => snapshot.routeKey === routeKey)
    const prediction = candidates.length ? Math.min(...candidates.map((snapshot) => snapshot.price)) : 0
    if (prediction > 0) {
      actual.push(actualFare)
      predicted.push(prediction)
    }
  }

  if (!actual.length) {
    return { available: false, windowDays, sampleCount: 0, mae: null, rmse: null, mape: null, correlation: null, message: 'No DGCA records matched collected fare snapshots.' }
  }

  const dates = records.map((record) => record.departureDate).filter((date): date is string => Boolean(date)).sort()
  const spanDays = dates.length > 1 ? (new Date(`${dates.at(-1)}T00:00:00Z`).getTime() - new Date(`${dates[0]}T00:00:00Z`).getTime()) / 86_400_000 : 0
  if (spanDays < 30) {
    return { available: false, windowDays, sampleCount: actual.length, mae: null, rmse: null, mape: null, correlation: null, message: 'At least 30 days of DGCA/reference data are required for backtesting.' }
  }

  const absoluteErrors = actual.map((value, index) => Math.abs(value - (predicted[index] ?? 0)))
  const mae = absoluteErrors.reduce((sum, value) => sum + value, 0) / actual.length
  const rmse = Math.sqrt(actual.reduce((sum, value, index) => sum + (value - (predicted[index] ?? 0)) ** 2, 0) / actual.length)
  const mape = actual.reduce((sum, value, index) => sum + (Math.abs(value - (predicted[index] ?? 0)) / value) * 100, 0) / actual.length
  return {
    available: true,
    windowDays,
    sampleCount: actual.length,
    mae: Math.round(mae * 100) / 100,
    rmse: Math.round(rmse * 100) / 100,
    mape: Math.round(mape * 100) / 100,
    correlation: correlation(actual, predicted),
    message: 'Backtest calculated from matched DGCA reference records and collected fares.',
  }
}
