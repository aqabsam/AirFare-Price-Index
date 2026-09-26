import { fareStore } from './fareStore.js'
import type {
  FareAnalyticsResponse,
  FareDailyIndexPoint,
  FareHeatmapCell,
  FarePeriodIndexPoint,
  FareRouteSummary,
  FareSourceComparison,
  FareSnapshot,
  FareTrendPoint,
} from '../types/fare.js'

const routeBasket = (process.env.AIRFARE_ROUTE_BASKET ?? '').split(',').map((route) => route.trim().toUpperCase()).filter(Boolean)
const INDEX_SCALE = Number(process.env.AIRFARE_INDEX_SCALE ?? '100')
const APPROVED_AIRLINES = new Set(['IndiGo', 'GoAir', 'Air India', 'Akasa Air', 'SpiceJet'])
const configuredWeights = (() => {
  try {
    const parsed = JSON.parse(process.env.DGCA_ROUTE_WEIGHTS ?? '{}') as Record<string, number>
    return Object.fromEntries(Object.entries(parsed).filter(([key, value]) => key && Number.isFinite(value) && value > 0).map(([key, value]) => [key.toUpperCase(), value]))
  } catch {
    return {}
  }
})()

function average(values: number[]) {
  if (!values.length) {
    return 0
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function median(values: number[]) {
  if (!values.length) {
    return 0
  }

  const sorted = [...values].sort((left, right) => left - right)
  const middle = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 1) {
    return sorted[middle] ?? 0
  }

  const lower = sorted[middle - 1] ?? 0
  const upper = sorted[middle] ?? 0
  return (lower + upper) / 2
}

function positiveMin(values: number[]) {
  const positiveValues = values.filter((value) => value > 0)
  return positiveValues.length ? Math.min(...positiveValues) : 0
}

function normalizeApprovedAirline(name: string, code: string) {
  const normalizedName = name.trim().toLowerCase().replace(/[^a-z]/g, '')
  const normalizedCode = code.trim().toUpperCase()

  if (normalizedCode === '6E' || normalizedName === 'indigo' || normalizedName === 'indigoairlines') return 'IndiGo'
  if (normalizedCode === 'G8' || normalizedName === 'goair' || normalizedName === 'gofirst') return 'GoAir'
  if (normalizedCode === 'AI' || normalizedName === 'airindia') return 'Air India'
  if (normalizedCode === 'QP' || normalizedName === 'akasa' || normalizedName === 'akasaair') return 'Akasa Air'
  if (normalizedCode === 'SG' || normalizedName === 'spicejet') return 'SpiceJet'
  return null
}

function matchesFilters(snapshot: FareSnapshot, origin?: string, destination?: string, departureDate?: string) {
  if (snapshot.sourceType === 'aggregated' || snapshot.sourceType === 'demo' || snapshot.price <= 0 || !normalizeApprovedAirline(snapshot.airline, snapshot.airlineCode)) {
    return false
  }

  if (origin && snapshot.origin !== origin.toUpperCase()) {
    return false
  }

  if (destination && snapshot.destination !== destination.toUpperCase()) {
    return false
  }

  if (departureDate && snapshot.departureDate !== departureDate) {
    return false
  }

  if (routeBasket.length && !routeBasket.includes(snapshot.routeKey.split('-').slice(0, 2).join('-'))) {
    return false
  }

  return true
}

function baselinePrice(snapshots: FareSnapshot[]) {
  const routePrices = new Map<string, number>()
  for (const snapshot of snapshots) {
    const current = routePrices.get(snapshot.routeKey)
    if (current === undefined || snapshot.price < current) {
      routePrices.set(snapshot.routeKey, snapshot.price)
    }
  }

  const weighted = [...routePrices.entries()].map(([routeKey, price]) => ({ price, weight: configuredWeights[routeKey.split('-').slice(0, 2).join('-')] ?? 1 }))
  const totalWeight = weighted.reduce((sum, item) => sum + item.weight, 0)
  return totalWeight ? weighted.reduce((sum, item) => sum + item.price * item.weight, 0) / totalWeight : 0
}

function indexForPrice(price: number, baseline: number) {
  return baseline > 0 && Number.isFinite(INDEX_SCALE) && INDEX_SCALE > 0 ? Math.round((price / baseline) * INDEX_SCALE) : null
}

function summarizeRoutes(snapshots: FareSnapshot[], baseline: number): FareRouteSummary[] {
  const grouped = new Map<string, FareSnapshot[]>()

  for (const snapshot of snapshots) {
    const existing = grouped.get(snapshot.routeKey)
    if (existing) {
      existing.push(snapshot)
    } else {
      grouped.set(snapshot.routeKey, [snapshot])
    }
  }

  return [...grouped.entries()]
    .map(([routeKey, records]) => {
      const cheapest = [...records].sort((left, right) => left.price - right.price)[0]
      const routePrices = records.map((record) => record.price)
      const topCarrier = [...records].sort((left, right) => right.confidence - left.confidence)[0]
      const latest = [...records].sort((left, right) => right.collectedAt.localeCompare(left.collectedAt))[0]
      const dates = [...new Set(records.map((record) => record.collectionDate ?? record.collectedAt.slice(0, 10)))].sort()
      const previousDate = dates.at(-2)
      const previousPrice = previousDate
        ? Math.min(...records.filter((record) => (record.collectionDate ?? record.collectedAt.slice(0, 10)) === previousDate).map((record) => record.price))
        : 0

      return {
        routeKey,
        origin: records[0]?.origin ?? '',
        destination: records[0]?.destination ?? '',
        departureDate: records[0]?.departureDate ?? '',
        bookingWindowDays: records[0]?.bookingWindowDays ?? 0,
        collectionDate: records[0]?.collectionDate ?? records[0]?.collectedAt?.slice(0, 10) ?? '',
        offerCount: records.length,
        cheapestPrice: cheapest?.price ?? 0,
        averagePrice: Math.round(average(routePrices)),
        medianPrice: Math.round(median(routePrices)),
        airfareIndex: cheapest ? indexForPrice(cheapest.price, baseline) : null,
        currency: cheapest?.currency ?? 'INR',
        topCarrier: topCarrier ? normalizeApprovedAirline(topCarrier.airline, topCarrier.airlineCode) ?? 'Unknown airline' : 'Unknown airline',
        lastCollectedAt: latest?.collectedAt ?? '',
        changePercent: previousPrice > 0 && cheapest ? Math.round(((cheapest.price - previousPrice) / previousPrice) * 10000) / 100 : null,
      } satisfies FareRouteSummary
    })
    .sort((left, right) => left.routeKey.localeCompare(right.routeKey))
}

function withIndex(points: { price: number; [key: string]: unknown }[], baseline: number) {
  return points.map((point) => ({
    ...point,
    airfareIndex: indexForPrice(point.price, baseline),
  }))
}

function buildTrendSeries(snapshots: FareSnapshot[], baseline: number) {
  const grouped = new Map<number, FareSnapshot[]>()

  for (const snapshot of snapshots) {
    const key = snapshot.bookingWindowDays ?? 0
    const existing = grouped.get(key)
    if (existing) {
      existing.push(snapshot)
    } else {
      grouped.set(key, [snapshot])
    }
  }

  const series = [...grouped.entries()]
    .map(([bookingWindowDays, records]) => {
      const routeGroups = new Map<string, FareSnapshot[]>()
      for (const record of records) {
        const existing = routeGroups.get(record.routeKey)
        if (existing) {
          existing.push(record)
        } else {
          routeGroups.set(record.routeKey, [record])
        }
      }

      const cheapestPrices = [...routeGroups.entries()].map(([routeKey, routeRecords]) => {
        const cheapest = [...routeRecords].sort((left, right) => left.price - right.price)[0]
        return { routeKey, price: cheapest?.price ?? 0 }
      })

      const latest = [...records].sort((left, right) => right.collectedAt.localeCompare(left.collectedAt))[0]
      const label = `T+${bookingWindowDays}`

      return {
        collectionDate: label,
        bookingWindowDays,
        routeCount: routeGroups.size,
        cheapestPrice: positiveMin(cheapestPrices.map((item) => item.price)),
        averagePrice: Math.round(average(cheapestPrices.filter((item) => item.price > 0).map((item) => item.price))),
        airfareIndex: null,
        percentageChange: null,
        elasticity: null,
        lastCollectedAt: latest?.collectedAt ?? '',
      } satisfies FareTrendPoint
    })
    .sort((left, right) => left.bookingWindowDays - right.bookingWindowDays)

  return withIndex(series.map((point) => ({ ...point, price: point.averagePrice })), baseline).map((point, index) => ({
    collectionDate: series[index]?.collectionDate ?? '',
    bookingWindowDays: series[index]?.bookingWindowDays ?? 0,
    routeCount: series[index]?.routeCount ?? 0,
    cheapestPrice: series[index]?.cheapestPrice ?? 0,
    averagePrice: series[index]?.averagePrice ?? 0,
    airfareIndex: point.airfareIndex,
    percentageChange: index > 0 && (series[index - 1]?.averagePrice ?? 0) > 0
      ? Math.round((((series[index]?.averagePrice ?? 0) - (series[index - 1]?.averagePrice ?? 0)) / (series[index - 1]?.averagePrice ?? 1)) * 10000) / 100
      : null,
    elasticity: index > 0 && (series[index - 1]?.averagePrice ?? 0) > 0
      ? Math.round(((((series[index]?.averagePrice ?? 0) - (series[index - 1]?.averagePrice ?? 0)) / (series[index - 1]?.averagePrice ?? 1)) / Math.max(0.01, ((series[index]?.bookingWindowDays ?? 0) - (series[index - 1]?.bookingWindowDays ?? 0)) / Math.max(1, series[index - 1]?.bookingWindowDays ?? 1))) * 100) / 100
      : null,
    lastCollectedAt: series[index]?.lastCollectedAt ?? '',
  }))
}

function buildDailyIndex(snapshots: FareSnapshot[], baseline: number) {
  const grouped = new Map<string, FareSnapshot[]>()

  for (const snapshot of snapshots) {
    const key = snapshot.collectionDate ?? snapshot.collectedAt.slice(0, 10)
    const existing = grouped.get(key)
    if (existing) {
      existing.push(snapshot)
    } else {
      grouped.set(key, [snapshot])
    }
  }

  const series = [...grouped.entries()]
    .map(([collectionDate, records]) => {
      const routeGroups = new Map<string, FareSnapshot[]>()
      for (const record of records) {
        const existing = routeGroups.get(record.routeKey)
        if (existing) {
          existing.push(record)
        } else {
          routeGroups.set(record.routeKey, [record])
        }
      }

      const cheapestPrices = [...routeGroups.entries()].map(([routeKey, routeRecords]) => {
        const cheapest = [...routeRecords].sort((left, right) => left.price - right.price)[0]
        return { routeKey, price: cheapest?.price ?? 0 }
      })
      const latest = [...records].sort((left, right) => right.collectedAt.localeCompare(left.collectedAt))[0]

      return {
        collectionDate,
        routeCount: routeGroups.size,
        cheapestPrice: positiveMin(cheapestPrices.map((item) => item.price)),
        averagePrice: Math.round(average(cheapestPrices.filter((item) => item.price > 0).map((item) => item.price))),
        airfareIndex: null,
        lastCollectedAt: latest?.collectedAt ?? '',
      } satisfies FareDailyIndexPoint
    })
    .sort((left, right) => left.collectionDate.localeCompare(right.collectionDate))

  return withIndex(series.map((point) => ({ ...point, price: point.averagePrice })), baseline).map((point, index) => ({
    collectionDate: series[index]?.collectionDate ?? '',
    routeCount: series[index]?.routeCount ?? 0,
    cheapestPrice: series[index]?.cheapestPrice ?? 0,
    averagePrice: series[index]?.averagePrice ?? 0,
    airfareIndex: point.airfareIndex,
    lastCollectedAt: series[index]?.lastCollectedAt ?? '',
  }))
}

function buildHeatmap(snapshots: FareSnapshot[], baseline: number): FareHeatmapCell[] {
  const summaries = summarizeRoutes(snapshots, baseline)
  return withIndex(summaries.map((summary) => ({ ...summary, price: summary.cheapestPrice })), baseline).map((point, index) => {
    const summary = summaries[index]
    return {
      routeKey: summary.routeKey,
      origin: summary.origin,
      destination: summary.destination,
      departureDate: summary.departureDate,
      bookingWindowDays: summary.bookingWindowDays,
      cheapestPrice: summary.cheapestPrice,
      airfareIndex: point.airfareIndex,
      topCarrier: summary.topCarrier,
      lastCollectedAt: summary.lastCollectedAt,
    }
  })
}

function periodStart(dateString: string, period: 'week' | 'month') {
  const date = new Date(`${dateString}T00:00:00Z`)
  if (!Number.isFinite(date.getTime())) return dateString
  if (period === 'month') return date.toISOString().slice(0, 7)
  const day = date.getUTCDay() || 7
  date.setUTCDate(date.getUTCDate() - day + 1)
  return date.toISOString().slice(0, 10)
}

function buildPeriodIndex(snapshots: FareSnapshot[], period: 'week' | 'month', baseline: number): FarePeriodIndexPoint[] {
  const grouped = new Map<string, FareSnapshot[]>()
  for (const snapshot of snapshots) {
    const key = periodStart(snapshot.collectionDate ?? snapshot.collectedAt.slice(0, 10), period)
    grouped.set(key, [...(grouped.get(key) ?? []), snapshot])
  }

  const points = [...grouped.entries()].map(([periodStartValue, records]) => {
    const routeGroups = new Map<string, FareSnapshot[]>()
    for (const record of records) routeGroups.set(record.routeKey, [...(routeGroups.get(record.routeKey) ?? []), record])
    const routeCheapest = [...routeGroups.entries()].map(([routeKey, route]) => ({ routeKey, price: Math.min(...route.map((record) => record.price)) }))
    const latest = [...records].sort((left, right) => right.collectedAt.localeCompare(left.collectedAt))[0]
    return {
      period,
      periodStart: periodStartValue,
      routeCount: routeGroups.size,
      cheapestPrice: positiveMin(routeCheapest.map((item) => item.price)),
      averagePrice: Math.round(average(routeCheapest.filter((item) => item.price > 0).map((item) => item.price))),
      airfareIndex: null,
      lastCollectedAt: latest?.collectedAt ?? '',
    }
  }).sort((left, right) => left.periodStart.localeCompare(right.periodStart))

  return withIndex(points.map((point) => ({ ...point, price: point.averagePrice })), baseline).map((point, index) => ({
    ...points[index],
    airfareIndex: point.airfareIndex,
    percentageChange: index > 0 && (points[index - 1]?.averagePrice ?? 0) > 0
      ? Math.round((((points[index]?.averagePrice ?? 0) - (points[index - 1]?.averagePrice ?? 0)) / (points[index - 1]?.averagePrice ?? 1)) * 10000) / 100
      : null,
  }))
}

function buildSourceComparison(snapshots: FareSnapshot[]): FareSourceComparison[] {
  const grouped = new Map<string, FareSnapshot[]>()
  for (const snapshot of snapshots) grouped.set(snapshot.sourceId ?? snapshot.source, [...(grouped.get(snapshot.sourceId ?? snapshot.source) ?? []), snapshot])
  const total = snapshots.length || 1
  return [...grouped.entries()].map(([sourceId, records]) => {
    const routeCount = new Set(records.map((record) => record.routeKey)).size
    return {
      sourceId,
      source: records[0]?.source ?? sourceId,
      sourceType: records[0]?.sourceType ?? 'aggregated',
      offerCount: records.length,
      routeCount,
      cheapestPrice: Math.min(...records.map((record) => record.price)),
      averagePrice: Math.round(average(records.map((record) => record.price))),
      sharePercent: Math.round((records.length / total) * 100),
    }
  }).sort((left, right) => left.cheapestPrice - right.cheapestPrice)
}

export function calculateRouteIndex(origin?: string, destination?: string, departureDate?: string) {
  const snapshots = fareStore
    .getSnapshots()
    .filter((snapshot) => matchesFilters(snapshot, origin, destination, departureDate))

  const baseline = baselinePrice(snapshots)
  const summaries = summarizeRoutes(snapshots, baseline)
  if (!summaries.length) {
    return []
  }

  return summaries
}

export function calculateFareAnalytics(origin?: string, destination?: string, departureDate?: string): FareAnalyticsResponse {
  const snapshots = fareStore
    .getSnapshots()
    .filter((snapshot) => matchesFilters(snapshot, origin, destination, departureDate))

  const baseline = baselinePrice(snapshots)
  const summary = summarizeRoutes(snapshots, baseline)
  const trends = buildTrendSeries(snapshots, baseline)
  const dailyIndex = buildDailyIndex(snapshots, baseline)
  const weeklyIndex = buildPeriodIndex(snapshots, 'week', baseline)
  const monthlyIndex = buildPeriodIndex(snapshots, 'month', baseline)
  const heatmap = buildHeatmap(snapshots, baseline)
  const sourceComparison = buildSourceComparison(snapshots)
  const basePeriod = dailyIndex[0]?.collectionDate ?? null
  const baseValue = dailyIndex[0]?.airfareIndex ?? null

  return {
    summary,
    trends,
    dailyIndex,
    weeklyIndex,
    monthlyIndex,
    heatmap,
    sourceComparison,
    base: {
      value: baseValue,
      period: basePeriod,
    },
    methodology: {
      basePeriod,
      routeBasket,
      routeWeights: configuredWeights,
      officialSources: ['airline', 'ota', 'duffel'],
    },
  }
}
