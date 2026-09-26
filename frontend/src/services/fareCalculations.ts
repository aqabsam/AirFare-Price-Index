import type {
  AirfareIndexResponse,
  DataQualityResponse,
  DgcaBacktestResponse,
  FareAnalyticsResponse,
  FareDailyIndexPoint,
  FareIndexHistoryResponse,
  FarePeriodIndexPoint,
  FareRouteSummary,
  FareSourceHealthResponse,
  FareSnapshot,
} from '@/types/fare'
import { normalizeAllowedAirline } from '@/services/airlineValidation'

const STALE_AFTER_MS = 12 * 60 * 60 * 1000
const CURRENCY_TO_INR: Record<string, number> = {
  INR: 1,
  USD: 95.4,
  EUR: 111.28,
  GBP: 130.06,
}

export function convertFareToINR(value: number, currency: string) {
  const rate = CURRENCY_TO_INR[currency.trim().toUpperCase()] ?? 1
  return Math.round(value * rate)
}

export type FareMetrics = {
  snapshots: FareSnapshot[]
  index: AirfareIndexResponse
  analytics: FareAnalyticsResponse
  quality: DataQualityResponse
  backtest: DgcaBacktestResponse
  sourceHealth: FareSourceHealthResponse
  history: FareIndexHistoryResponse['history']
}

function dateFor(snapshot: FareSnapshot) {
  const value = snapshot.collectionDate ?? snapshot.collectedAt.slice(0, 10)
  const timestamp = new Date(`${value}T00:00:00Z`).getTime()
  return Number.isFinite(timestamp) ? value : null
}

export function normalizeVerifiedSnapshots(snapshots: FareSnapshot[]) {
  const unique = new Map<string, FareSnapshot>()
  for (const snapshot of snapshots) {
    const airline = normalizeAllowedAirline(snapshot.airline, snapshot.airlineCode)
    if (!airline || !['airline', 'ota', 'duffel'].includes(snapshot.sourceType)) continue
    const collectionDate = dateFor(snapshot)
    if (!collectionDate || !Number.isFinite(snapshot.price) || snapshot.price <= 0) continue
    unique.set(snapshot.id, { ...snapshot, airline, collectionDate })
  }
  return [...unique.values()]
}

export function isSearchSnapshot(snapshot: FareSnapshot) {
  return snapshot.collectionStage === 'SEARCH' || /\|\d{4}-\d{2}-\d{2}T/.test(snapshot.id)
}

function routeBasketPrice(snapshots: FareSnapshot[]) {
  const routePrices = new Map<string, number>()
  for (const snapshot of snapshots) {
    const current = routePrices.get(snapshot.routeKey)
    if (current === undefined || snapshot.price < current) routePrices.set(snapshot.routeKey, snapshot.price)
  }
  const prices = [...routePrices.values()]
  return prices.length ? prices.reduce((sum, price) => sum + price, 0) / prices.length : 0
}

function periodStart(value: string, period: 'week' | 'month') {
  if (period === 'month') return value.slice(0, 7)
  const date = new Date(`${value}T00:00:00Z`)
  const day = date.getUTCDay() || 7
  date.setUTCDate(date.getUTCDate() - day + 1)
  return date.toISOString().slice(0, 10)
}

function indexPoint(snapshots: FareSnapshot[], baseline: number) {
  const basket = routeBasketPrice(snapshots)
  return baseline > 0 ? Number(((basket / baseline) * 100).toFixed(2)) : null
}

function median(values: number[]) {
  const sorted = [...values].sort((left, right) => left - right)
  const middle = Math.floor(sorted.length / 2)
  if (!sorted.length) return 0
  return sorted.length % 2 ? sorted[middle] ?? 0 : ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2
}

function buildRouteSummaries(snapshots: FareSnapshot[], baseline: number): FareRouteSummary[] {
  const groups = new Map<string, FareSnapshot[]>()
  for (const snapshot of snapshots) groups.set(snapshot.routeKey, [...(groups.get(snapshot.routeKey) ?? []), snapshot])

  return [...groups.entries()].map(([routeKey, records]) => {
    const dates = [...new Set(records.map(dateFor).filter((date): date is string => Boolean(date)))].sort()
    const currentDate = dates.at(-1) ?? ''
    const current = records.filter((record) => dateFor(record) === currentDate)
    const previousDate = dates.at(-2)
    const previousLowest = previousDate
      ? Math.min(...records.filter((record) => dateFor(record) === previousDate).map((record) => record.price))
      : null
    const prices = current.map((record) => record.price)
    const cheapestPrice = prices.length ? Math.min(...prices) : 0
    const latest = current.reduce((best, record) => record.collectedAt > best.collectedAt ? record : best, current[0] ?? records[0])
    const topCarrier = current.reduce((best, record) => record.confidence > best.confidence ? record : best, current[0] ?? records[0])

    return {
      routeKey,
      origin: records[0]?.origin ?? '',
      destination: records[0]?.destination ?? '',
      departureDate: records[0]?.departureDate ?? '',
      bookingWindowDays: latest?.bookingWindowDays ?? 0,
      collectionDate: currentDate,
      offerCount: current.length,
      cheapestPrice,
      averagePrice: prices.length ? Math.round(prices.reduce((sum, price) => sum + price, 0) / prices.length) : 0,
      medianPrice: Math.round(median(prices)),
      airfareIndex: cheapestPrice > 0 ? indexPoint([{ ...latest, price: cheapestPrice }], baseline) : null,
      currency: latest?.currency ?? 'INR',
      topCarrier: topCarrier?.airline ?? 'Unknown airline',
      lastCollectedAt: latest?.collectedAt ?? '',
      changePercent: previousLowest && previousLowest > 0 && cheapestPrice > 0
        ? Number((((cheapestPrice - previousLowest) / previousLowest) * 100).toFixed(2))
        : null,
    }
  }).sort((left, right) => left.routeKey.localeCompare(right.routeKey))
}

function buildDaily(snapshots: FareSnapshot[], baseline: number): FareDailyIndexPoint[] {
  const groups = new Map<string, FareSnapshot[]>()
  for (const snapshot of snapshots) {
    const date = dateFor(snapshot)
    if (date) groups.set(date, [...(groups.get(date) ?? []), snapshot])
  }
  return [...groups.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([collectionDate, records]) => ({
    collectionDate,
    routeCount: new Set(records.map((record) => record.routeKey)).size,
    cheapestPrice: Math.min(...records.map((record) => record.price)),
    averagePrice: Math.round(routeBasketPrice(records)),
    airfareIndex: indexPoint(records, baseline),
    lastCollectedAt: records.map((record) => record.collectedAt).sort().at(-1) ?? '',
  }))
}

function buildPeriods(snapshots: FareSnapshot[], baseline: number, period: 'week' | 'month'): FarePeriodIndexPoint[] {
  const groups = new Map<string, FareSnapshot[]>()
  for (const snapshot of snapshots) {
    const date = dateFor(snapshot)
    if (!date) continue
    const key = periodStart(date, period)
    groups.set(key, [...(groups.get(key) ?? []), snapshot])
  }
  return [...groups.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([periodStartValue, records], index, all) => {
    const currentAverage = routeBasketPrice(records)
    const previousRecords = all[index - 1]?.[1] ?? []
    const previousAverage = routeBasketPrice(previousRecords)
    return {
      period,
      periodStart: periodStartValue,
      routeCount: new Set(records.map((record) => record.routeKey)).size,
      cheapestPrice: Math.min(...records.map((record) => record.price)),
      averagePrice: Math.round(currentAverage),
      airfareIndex: indexPoint(records, baseline),
      percentageChange: previousAverage > 0 ? Number((((currentAverage - previousAverage) / previousAverage) * 100).toFixed(2)) : null,
      lastCollectedAt: records.map((record) => record.collectedAt).sort().at(-1) ?? '',
    }
  })
}

function calculateBacktest(snapshots: FareSnapshot[], windowDays: number): DgcaBacktestResponse {
  const dates = [...new Set(snapshots.map(dateFor).filter((date): date is string => Boolean(date)))].sort()
  const spanDays = dates.length > 1 ? (new Date(`${dates.at(-1)}T00:00:00Z`).getTime() - new Date(`${dates[0]}T00:00:00Z`).getTime()) / 86_400_000 : 0
  if (spanDays < windowDays) return { available: false, windowDays, sampleCount: 0, mae: null, rmse: null, mape: null, correlation: null, message: `At least ${windowDays} days of verified fare history are required for backtesting.` }

  const byRouteAndDate = new Map<string, number>()
  for (const snapshot of snapshots) {
    const date = dateFor(snapshot)
    if (!date) continue
    const key = `${snapshot.routeKey}|${date}`
    byRouteAndDate.set(key, Math.min(byRouteAndDate.get(key) ?? Number.POSITIVE_INFINITY, snapshot.price))
  }
  const actual: number[] = []
  const predicted: number[] = []
  for (const [key, value] of byRouteAndDate) {
    const separator = key.lastIndexOf('|')
    const routeKey = key.slice(0, separator)
    const date = key.slice(separator + 1)
    const previousDate = dates.filter((candidate) => candidate < date).at(-1)
    const previous = previousDate ? byRouteAndDate.get(`${routeKey}|${previousDate}`) : undefined
    if (previous && Number.isFinite(value)) {
      actual.push(value)
      predicted.push(previous)
    }
  }
  if (actual.length < 2) return { available: false, windowDays, sampleCount: actual.length, mae: null, rmse: null, mape: null, correlation: null, message: 'At least two matched route observations are required for backtesting.' }

  const errors = actual.map((value, index) => value - (predicted[index] ?? value))
  const mae = errors.reduce((sum, value) => sum + Math.abs(value), 0) / errors.length
  const rmse = Math.sqrt(errors.reduce((sum, value) => sum + value ** 2, 0) / errors.length)
  const mape = actual.reduce((sum, value, index) => sum + Math.abs(errors[index] ?? 0) / value * 100, 0) / actual.length
  const actualMean = actual.reduce((sum, value) => sum + value, 0) / actual.length
  const predictedMean = predicted.reduce((sum, value) => sum + value, 0) / predicted.length
  const numerator = actual.reduce((sum, value, index) => sum + (value - actualMean) * ((predicted[index] ?? 0) - predictedMean), 0)
  const denominator = Math.sqrt(actual.reduce((sum, value) => sum + (value - actualMean) ** 2, 0) * predicted.reduce((sum, value) => sum + (value - predictedMean) ** 2, 0))
  return { available: true, windowDays, sampleCount: actual.length, mae: Number(mae.toFixed(2)), rmse: Number(rmse.toFixed(2)), mape: Number(mape.toFixed(2)), correlation: denominator > 0 ? Number((numerator / denominator).toFixed(4)) : null, message: 'Backtest calculated from matched verified fare history using the previous observation as the prediction.' }
}

function buildQuality(rawSnapshots: FareSnapshot[], snapshots: FareSnapshot[]): DataQualityResponse {
  const averageScores = rawSnapshots.map((snapshot) => snapshot.dataQualityScore).filter((score): score is number => typeof score === 'number')
  const qualityBySource = Object.fromEntries([...new Set(rawSnapshots.map((snapshot) => snapshot.source))].map((source) => {
    const sourceRecords = rawSnapshots.filter((snapshot) => snapshot.source === source)
    const scores = sourceRecords.map((snapshot) => snapshot.dataQualityScore).filter((score): score is number => typeof score === 'number')
    return [source, { records: sourceRecords.length, averageScore: scores.length ? scores.reduce((sum, score) => sum + score, 0) / scores.length : null }]
  }))
  const duplicateRecords = Math.max(0, rawSnapshots.length - snapshots.length)
  const outlierRecords = rawSnapshots.filter((snapshot) => snapshot.dataQualityStatus === 'outlier').length
  const missingFieldRecords = rawSnapshots.filter((snapshot) => snapshot.dataQualityStatus === 'missing').length
  const soldOutRecords = rawSnapshots.filter((snapshot) => snapshot.soldOut || snapshot.seatsRemaining <= 0).length
  const unknownAvailabilityRecords = rawSnapshots.filter((snapshot) => !Number.isFinite(snapshot.seatsRemaining)).length
  return {
    rawRecords: rawSnapshots.length,
    rejectedRecords: outlierRecords + missingFieldRecords,
    averageQualityScore: averageScores.length ? averageScores.reduce((sum, score) => sum + score, 0) / averageScores.length : null,
    qualityBySource,
    cleanedRecords: snapshots.length,
    duplicateRecords,
    outlierRecords,
    missingFieldRecords,
    soldOutRecords,
    unknownAvailabilityRecords,
    message: `${snapshots.length} verified search records from ${rawSnapshots.length} search records.`,
  }
}

export function calculateFareMetrics(rawSnapshots: FareSnapshot[]): FareMetrics {
  const snapshots = normalizeVerifiedSnapshots(rawSnapshots)
  const dates = snapshots.map(dateFor).filter((date): date is string => Boolean(date)).sort()
  const baseline = routeBasketPrice(snapshots.filter((snapshot) => dateFor(snapshot) === dates[0]))
  const dailyIndex = buildDaily(snapshots, baseline)
  const weeklyIndex = buildPeriods(snapshots, baseline, 'week')
  const monthlyIndex = buildPeriods(snapshots, baseline, 'month')
  const summary = buildRouteSummaries(snapshots, baseline)
  const trends = dailyIndex.map((point, index) => ({
    collectionDate: point.collectionDate,
    bookingWindowDays: 0,
    routeCount: point.routeCount,
    cheapestPrice: point.cheapestPrice,
    averagePrice: point.averagePrice,
    airfareIndex: point.airfareIndex,
    percentageChange: index > 0 && (dailyIndex[index - 1]?.averagePrice ?? 0) > 0
      ? Number((((point.averagePrice - (dailyIndex[index - 1]?.averagePrice ?? 0)) / (dailyIndex[index - 1]?.averagePrice ?? 1)) * 100).toFixed(2))
      : null,
    elasticity: null,
    lastCollectedAt: point.lastCollectedAt,
  }))
  const officialSources = [...new Set(snapshots.map((snapshot) => snapshot.source).filter(Boolean))] as Array<'airline' | 'ota' | 'duffel'>
  const routeKeys = [...new Set(snapshots.map((snapshot) => snapshot.routeKey))]
  const sourceGroups = new Map<string, FareSnapshot[]>()
  for (const snapshot of snapshots) {
    sourceGroups.set(snapshot.source, [...(sourceGroups.get(snapshot.source) ?? []), snapshot])
  }
  const sources = [...sourceGroups.entries()].map(([source, records]) => {
    const latest = records.map((record) => record.collectedAt).sort().at(-1) ?? null
    const isStale = !latest || Date.now() - new Date(latest).getTime() > STALE_AFTER_MS
    const sourceType = records[0]?.sourceType === 'duffel' ? 'duffel' as const : records[0]?.sourceType === 'ota' ? 'ota' as const : 'airline' as const
    return {
      id: source,
      name: source,
      sourceType,
      kind: sourceType === 'duffel' ? 'api' as const : 'page' as const,
      url: '',
      routeCount: new Set(records.map((record) => record.routeKey)).size,
      bookingWindows: [...new Set(records.map((record) => record.bookingWindowDays ?? 0))],
      snapshotCount: records.length,
      lastCollectedAt: latest,
      status: isStale ? 'stale' as const : 'live' as const,
    }
  })
  const history = dailyIndex.map((point) => {
    const records = snapshots.filter((snapshot) => dateFor(snapshot) === point.collectionDate)
    return {
      routeKey: 'MARKET',
      departureDate: point.collectionDate,
      cheapestPrice: point.cheapestPrice,
      averagePrice: point.averagePrice,
      medianPrice: Math.round(median(records.map((record) => record.price))),
      airfareIndex: point.airfareIndex,
      calculatedAt: point.lastCollectedAt,
    }
  })
  const quality = buildQuality(rawSnapshots, snapshots)
  return {
    snapshots,
    index: { routeCount: summary.length, routes: summary },
    analytics: {
      summary,
      trends,
      dailyIndex,
      weeklyIndex,
      monthlyIndex,
      heatmap: summary.map((route) => ({ routeKey: route.routeKey, origin: route.origin, destination: route.destination, departureDate: route.departureDate, bookingWindowDays: route.bookingWindowDays, cheapestPrice: route.cheapestPrice, airfareIndex: route.airfareIndex, topCarrier: route.topCarrier, lastCollectedAt: route.lastCollectedAt })),
      sourceComparison: [...sourceGroups.entries()].map(([source, records]) => ({
        sourceId: source,
        source,
        sourceType: records[0]?.sourceType ?? 'airline',
        offerCount: records.length,
        routeCount: new Set(records.map((snapshot) => snapshot.routeKey)).size,
        cheapestPrice: Math.min(...records.map((snapshot) => snapshot.price)),
        averagePrice: Math.round(routeBasketPrice(records)),
        sharePercent: snapshots.length ? Math.round((records.length / snapshots.length) * 100) : 0,
      })),
      base: { value: baseline > 0 ? 100 : null, period: dates[0] ?? null },
      methodology: { basePeriod: dates[0] ?? null, routeBasket: routeKeys, routeWeights: Object.fromEntries(routeKeys.map((routeKey) => [routeKey, 1])), officialSources },
    },
    quality,
    backtest: calculateBacktest(snapshots, 30),
    sourceHealth: { sources, liveCount: sources.filter((source) => source.status === 'live').length, staleCount: sources.filter((source) => source.status === 'stale').length, emptyCount: sources.length ? 0 : 1 },
    history,
  }
}