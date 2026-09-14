import { fareStore } from './fareStore.js'
import type {
  FareAnalyticsResponse,
  FareDailyIndexPoint,
  FareHeatmapCell,
  FareRouteSummary,
  FareSnapshot,
  FareTrendPoint,
} from '../types/fare.js'

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

function matchesFilters(snapshot: FareSnapshot, origin?: string, destination?: string, departureDate?: string) {
  if (origin && snapshot.origin !== origin.toUpperCase()) {
    return false
  }

  if (destination && snapshot.destination !== destination.toUpperCase()) {
    return false
  }

  if (departureDate && snapshot.departureDate !== departureDate) {
    return false
  }

  return true
}

function summarizeRoutes(snapshots: FareSnapshot[]): FareRouteSummary[] {
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
        airfareIndex: 100,
        currency: cheapest?.currency ?? 'INR',
        topCarrier: topCarrier?.airline ?? 'Unknown airline',
        lastCollectedAt: latest?.collectedAt ?? '',
      } satisfies FareRouteSummary
    })
    .sort((left, right) => left.routeKey.localeCompare(right.routeKey))
}

function withIndex(points: { price: number; [key: string]: unknown }[]) {
  const basePrice = Math.min(...points.map((point) => point.price).filter((price) => price > 0))
  if (!Number.isFinite(basePrice) || basePrice <= 0) {
    return points.map((point) => ({ ...point, airfareIndex: 100 }))
  }

  return points.map((point) => ({
    ...point,
    airfareIndex: Math.round((point.price / basePrice) * 100),
  }))
}

function buildTrendSeries(snapshots: FareSnapshot[]) {
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

      const cheapestPrices = [...routeGroups.values()].map((routeRecords) => {
        const cheapest = [...routeRecords].sort((left, right) => left.price - right.price)[0]
        return cheapest?.price ?? 0
      })

      const latest = [...records].sort((left, right) => right.collectedAt.localeCompare(left.collectedAt))[0]
      const label = `T+${bookingWindowDays}`

      return {
        collectionDate: label,
        bookingWindowDays,
        routeCount: routeGroups.size,
        cheapestPrice: positiveMin(cheapestPrices),
        averagePrice: Math.round(average(cheapestPrices.filter((price) => price > 0))),
        airfareIndex: 100,
        lastCollectedAt: latest?.collectedAt ?? '',
      } satisfies FareTrendPoint
    })
    .sort((left, right) => left.bookingWindowDays - right.bookingWindowDays)

  return withIndex(series.map((point) => ({ ...point, price: point.averagePrice }))).map((point, index) => ({
    collectionDate: series[index]?.collectionDate ?? '',
    bookingWindowDays: series[index]?.bookingWindowDays ?? 0,
    routeCount: series[index]?.routeCount ?? 0,
    cheapestPrice: series[index]?.cheapestPrice ?? 0,
    averagePrice: series[index]?.averagePrice ?? 0,
    airfareIndex: point.airfareIndex ?? 100,
    lastCollectedAt: series[index]?.lastCollectedAt ?? '',
  }))
}

function buildDailyIndex(snapshots: FareSnapshot[]) {
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

      const cheapestPrices = [...routeGroups.values()].map((routeRecords) => {
        const cheapest = [...routeRecords].sort((left, right) => left.price - right.price)[0]
        return cheapest?.price ?? 0
      })
      const latest = [...records].sort((left, right) => right.collectedAt.localeCompare(left.collectedAt))[0]

      return {
        collectionDate,
        routeCount: routeGroups.size,
        cheapestPrice: positiveMin(cheapestPrices),
        averagePrice: Math.round(average(cheapestPrices.filter((price) => price > 0))),
        airfareIndex: 100,
        lastCollectedAt: latest?.collectedAt ?? '',
      } satisfies FareDailyIndexPoint
    })
    .sort((left, right) => left.collectionDate.localeCompare(right.collectionDate))

  return withIndex(series.map((point) => ({ ...point, price: point.averagePrice }))).map((point, index) => ({
    collectionDate: series[index]?.collectionDate ?? '',
    routeCount: series[index]?.routeCount ?? 0,
    cheapestPrice: series[index]?.cheapestPrice ?? 0,
    averagePrice: series[index]?.averagePrice ?? 0,
    airfareIndex: point.airfareIndex ?? 100,
    lastCollectedAt: series[index]?.lastCollectedAt ?? '',
  }))
}

function buildHeatmap(snapshots: FareSnapshot[]): FareHeatmapCell[] {
  const summaries = summarizeRoutes(snapshots)
  return withIndex(summaries.map((summary) => ({ ...summary, price: summary.cheapestPrice }))).map((point, index) => {
    const summary = summaries[index]
    return {
      routeKey: summary.routeKey,
      origin: summary.origin,
      destination: summary.destination,
      departureDate: summary.departureDate,
      bookingWindowDays: summary.bookingWindowDays,
      cheapestPrice: summary.cheapestPrice,
      airfareIndex: point.airfareIndex ?? 100,
      topCarrier: summary.topCarrier,
      lastCollectedAt: summary.lastCollectedAt,
    }
  })
}

export function calculateRouteIndex(origin?: string, destination?: string, departureDate?: string) {
  const snapshots = fareStore
    .getSnapshots()
    .filter((snapshot) => matchesFilters(snapshot, origin, destination, departureDate))

  const summaries = summarizeRoutes(snapshots)
  if (!summaries.length) {
    return []
  }

  const cheapestPrice = Math.min(...summaries.map((summary) => summary.cheapestPrice).filter((price) => price > 0))
  if (!Number.isFinite(cheapestPrice) || cheapestPrice <= 0) {
    return summaries.map((summary) => ({ ...summary, airfareIndex: 100 }))
  }

  return summaries.map((summary) => ({
    ...summary,
    airfareIndex: Math.round((summary.cheapestPrice / cheapestPrice) * 100),
  }))
}

export function calculateFareAnalytics(origin?: string, destination?: string, departureDate?: string): FareAnalyticsResponse {
  const snapshots = fareStore
    .getSnapshots()
    .filter((snapshot) => matchesFilters(snapshot, origin, destination, departureDate))

  const summary = calculateRouteIndex(origin, destination, departureDate)
  const trends = buildTrendSeries(snapshots)
  const dailyIndex = buildDailyIndex(snapshots)
  const heatmap = buildHeatmap(snapshots)

  return {
    summary,
    trends,
    dailyIndex,
    heatmap,
  }
}
