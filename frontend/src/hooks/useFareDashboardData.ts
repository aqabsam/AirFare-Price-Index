import { useEffect, useMemo, useState } from 'react'
import { fetchFareSnapshots } from '@/services/fareApi'
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
import { filterAllowedSnapshots } from '@/services/airlineValidation'
import { calculateFareMetrics, convertFareToINR, isSearchSnapshot } from '@/services/fareCalculations'
import { useSearchState, type SearchedRoute } from '@/state/searchContext'

export type FareDashboardData = {
  index: AirfareIndexResponse
  analytics: FareAnalyticsResponse
  snapshots: FareSnapshot[]
  quality: DataQualityResponse
  backtest: DgcaBacktestResponse
  sourceHealth: FareSourceHealthResponse
  history: FareIndexHistoryResponse['history']
  explorer: FareExplorerResponse
  fetchedRecords: number
  validRecords: number
}

const emptyAnalytics: FareAnalyticsResponse = {
  summary: [],
  trends: [],
  dailyIndex: [],
  weeklyIndex: [],
  monthlyIndex: [],
  heatmap: [],
  sourceComparison: [],
  base: { value: null, period: null },
}

const emptySearchSnapshots: FareSnapshot[] = []

const emptyData: FareDashboardData = {
  index: { routeCount: 0, routes: [] },
  analytics: emptyAnalytics,
  snapshots: [],
  quality: { rawRecords: 0, cleanedRecords: 0, duplicateRecords: 0, outlierRecords: 0, missingFieldRecords: 0, soldOutRecords: 0, unknownAvailabilityRecords: 0, message: '' },
  backtest: { available: false, windowDays: 30, sampleCount: 0, mae: null, rmse: null, mape: null, correlation: null, message: '' },
  sourceHealth: { sources: [], liveCount: 0, staleCount: 0, emptyCount: 0 },
  history: [],
  explorer: {
    raw: [],
    cleaned: [],
    rejected: [],
    indexHistory: [],
    collectionStatus: { status: 'idle', trigger: 'manual', startedAt: null, finishedAt: null, sourceCount: 0, snapshotCount: 0, message: null },
    collectionLogs: [],
  },
  fetchedRecords: 0,
  validRecords: 0,
}

function mergeSnapshots(existing: FareSnapshot[], incoming: FareSnapshot[]) {
  const snapshotsById = new Map(existing.map((snapshot) => [snapshot.id, snapshot]))
  incoming.forEach((snapshot) => snapshotsById.set(snapshot.id, snapshot))
  return [...snapshotsById.values()]
}

function collectionDate(snapshot: FareSnapshot) {
  return snapshot.collectionDate ?? snapshot.collectedAt.slice(0, 10)
}

function daysBetween(startDate: string, endDate: string) {
  const start = new Date(`${startDate}T00:00:00Z`).getTime()
  const end = new Date(`${endDate}T00:00:00Z`).getTime()
  return Number.isFinite(start) && Number.isFinite(end) ? Math.round((end - start) / 86_400_000) : 0
}

function buildDashboardData(rawSnapshots: FareSnapshot[], searchContext: Pick<SearchedRoute, 'origin' | 'destination' | 'travelDate'> | null): FareDashboardData {
  if (!searchContext) return emptyData
  const now = new Date()
  const todayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const cutoff = new Date(todayUtc)
  cutoff.setUTCDate(cutoff.getUTCDate() - 29)
  const cutoffDate = cutoff.toISOString().slice(0, 10)
  const todayDate = todayUtc.toISOString().slice(0, 10)
  const routeSnapshots = rawSnapshots.filter((snapshot) =>
    snapshot.origin === searchContext.origin &&
    snapshot.destination === searchContext.destination &&
    snapshot.departureDate === searchContext.travelDate,
  )
  const searchRecords = filterAllowedSnapshots(routeSnapshots.filter((snapshot) =>
    isSearchSnapshot(snapshot) &&
    ['airline', 'ota', 'duffel'].includes(snapshot.sourceType) &&
    collectionDate(snapshot) >= cutoffDate &&
    collectionDate(snapshot) <= todayDate,
  ))
    .map((snapshot) => ({
      ...snapshot,
      bookingWindowDays: Math.max(0, daysBetween(collectionDate(snapshot), snapshot.departureDate)),
      price: convertFareToINR(snapshot.totalFare ?? snapshot.price, snapshot.currency),
      baseFare: snapshot.baseFare === null || snapshot.baseFare === undefined ? snapshot.baseFare : convertFareToINR(snapshot.baseFare, snapshot.currency),
      taxes: snapshot.taxes === null || snapshot.taxes === undefined ? snapshot.taxes : convertFareToINR(snapshot.taxes, snapshot.currency),
      udf: snapshot.udf === null || snapshot.udf === undefined ? snapshot.udf : convertFareToINR(snapshot.udf, snapshot.currency),
      convenienceFee: snapshot.convenienceFee === null || snapshot.convenienceFee === undefined ? snapshot.convenienceFee : convertFareToINR(snapshot.convenienceFee, snapshot.currency),
      totalFare: convertFareToINR(snapshot.totalFare ?? snapshot.price, snapshot.currency),
      currency: 'INR',
    }))
  const metrics = calculateFareMetrics(searchRecords)
  const collectionStatus = {
    status: metrics.snapshots.length ? 'success' as const : 'idle' as const,
    trigger: 'manual' as const,
    startedAt: null,
    finishedAt: null,
    sourceCount: metrics.sourceHealth.sources.length,
    snapshotCount: metrics.snapshots.length,
    message: metrics.snapshots.length ? 'Verified Flight Search records.' : null,
  }
  return {
    ...emptyData,
    index: metrics.index,
    analytics: metrics.analytics,
    snapshots: metrics.snapshots,
    quality: metrics.quality,
    backtest: metrics.backtest,
    sourceHealth: metrics.sourceHealth,
    history: metrics.history,
    explorer: {
      ...emptyData.explorer,
      raw: searchRecords,
      cleaned: metrics.snapshots,
      indexHistory: metrics.history,
      collectionStatus,
    },
    fetchedRecords: searchRecords.length,
    validRecords: metrics.snapshots.length,
  }
}

async function loadDashboardData(
  searchContext: Pick<SearchedRoute, 'origin' | 'destination' | 'travelDate'> | null,
  searchSnapshots: FareSnapshot[],
) {
  if (!searchContext) return { data: emptyData, error: '' }
  const storedSnapshots = await fetchFareSnapshots({
    origin: searchContext.origin,
    destination: searchContext.destination,
    departureDate: searchContext.travelDate,
  })
  const mergedSnapshots = mergeSnapshots(
    storedSnapshots.filter(isSearchSnapshot),
    searchSnapshots.filter(isSearchSnapshot),
  )
  const data = buildDashboardData(mergedSnapshots, searchContext)
  return { data, error: '' }
}

export function useFareDashboardData() {
  const search = useSearchState()
  const searchSnapshots = search.data?.snapshots ?? emptySearchSnapshots
  const currentSearch = search.data?.input
  const persistedSearch = search.searchedRoutes.at(-1)
  const searchContext = currentSearch ?? (persistedSearch ? {
    origin: persistedSearch.origin,
    destination: persistedSearch.destination,
    travelDate: persistedSearch.travelDate,
  } : null)
  const searchOrigin = searchContext?.origin ?? ''
  const searchDestination = searchContext?.destination ?? ''
  const travelDate = searchContext?.travelDate ?? ''
  const [state, setState] = useState<{ data: FareDashboardData | null; loading: boolean; error: string }>({ data: null, loading: true, error: '' })

  useEffect(() => {
    let active = true
    const context = searchOrigin && searchDestination && travelDate
      ? { origin: searchOrigin, destination: searchDestination, travelDate }
      : null
    loadDashboardData(context, searchSnapshots)
      .then((result) => {
        if (active) setState({ data: result.data, loading: false, error: result.error })
      })
      .catch(() => {
        if (active) {
          const data = buildDashboardData(searchSnapshots, context)
          setState({ data, loading: false, error: '' })
        }
      })

    return () => {
      active = false
    }
  }, [searchDestination, searchOrigin, searchSnapshots, travelDate])

  const data = useMemo(() => {
    const context = searchOrigin && searchDestination && travelDate
      ? { origin: searchOrigin, destination: searchDestination, travelDate }
      : null
    const priorContextSnapshots = (state.data?.snapshots ?? []).filter((snapshot) =>
      snapshot.origin === context?.origin && snapshot.destination === context?.destination && snapshot.departureDate === context?.travelDate,
    )
    const immediateSnapshots = mergeSnapshots(priorContextSnapshots, searchSnapshots)
    return immediateSnapshots.length ? buildDashboardData(immediateSnapshots, context) : state.data
  }, [searchDestination, searchOrigin, searchSnapshots, state.data, travelDate])

  return { ...state, data }
}