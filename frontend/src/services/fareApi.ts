import type {
  AirfareIndexResponse,
  FareAnalyticsResponse,
  FareCollectionRunResponse,
  FareCollectionStatusResponse,
  FareSourceHealthResponse,
  FareRouteSummary,
    DataQualityResponse,
    DgcaAnalyticsResponse,
  FareSnapshot,
  FareSnapshotsResponse,
  FareSummaryResponse,
  DgcaBacktestResponse,
  FareExplorerResponse,
  FareHistoryResponse,
  FareIndexHistoryResponse,
} from '@/types/fare'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL?.trim().replace(/\/$/, '') ?? ''
const API_TIMEOUT_MS = 8000

function buildApiUrl(path: string) {
  if (!API_BASE_URL) {
    return path
  }

  return `${API_BASE_URL}${path}`
}

async function getJson<T>(path: string): Promise<T> {
  let response: Response
  const controller = new AbortController()
  const timeoutId = window.setTimeout(() => controller.abort(), API_TIMEOUT_MS)
  try {
    response = await fetch(buildApiUrl(path), { signal: controller.signal })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('Fare data request timed out. Please try again.')
    }

    throw new Error('Fare data is temporarily unavailable. Please check the API connection and try again.')
  } finally {
    window.clearTimeout(timeoutId)
  }
  const payload = (await response.json().catch(() => null)) as T & { error?: string } | null

  if (!response.ok) {
    throw new Error(payload && typeof payload === 'object' && 'error' in payload && payload.error ? payload.error : 'Unable to load fare data right now.')
  }

  return payload as T
}

export async function fetchFareSnapshots(filters?: {
  origin?: string
  destination?: string
  departureDate?: string
}): Promise<FareSnapshot[]> {
  const search = new URLSearchParams()
  if (filters?.origin) {
    search.set('origin', filters.origin)
  }
  if (filters?.destination) {
    search.set('destination', filters.destination)
  }
  if (filters?.departureDate) {
    search.set('departureDate', filters.departureDate)
  }

  const suffix = search.toString() ? `?${search.toString()}` : ''
  const payload = await getJson<FareSnapshotsResponse>(`/api/fares/snapshots${suffix}`)
  return payload.snapshots ?? []
}

export async function fetchFareHistory(days = 30): Promise<FareHistoryResponse> {
  return getJson<FareHistoryResponse>(`/api/fares/history?days=${Math.min(30, Math.max(1, Math.round(days)))}`)
}

export async function fetchFareSummary(filters?: {
  origin?: string
  destination?: string
  departureDate?: string
}): Promise<FareRouteSummary[]> {
  const search = new URLSearchParams()
  if (filters?.origin) {
    search.set('origin', filters.origin)
  }
  if (filters?.destination) {
    search.set('destination', filters.destination)
  }
  if (filters?.departureDate) {
    search.set('departureDate', filters.departureDate)
  }

  const suffix = search.toString() ? `?${search.toString()}` : ''
  const payload = await getJson<FareSummaryResponse>(`/api/fares/summary${suffix}`)
  return payload.summary ?? []
}

export async function fetchAirfareIndex(filters?: {
  origin?: string
  destination?: string
  departureDate?: string
}): Promise<AirfareIndexResponse> {
  const search = new URLSearchParams()
  if (filters?.origin) {
    search.set('origin', filters.origin)
  }
  if (filters?.destination) {
    search.set('destination', filters.destination)
  }
  if (filters?.departureDate) {
    search.set('departureDate', filters.departureDate)
  }

  const suffix = search.toString() ? `?${search.toString()}` : ''
  return getJson<AirfareIndexResponse>(`/api/airfare-index${suffix}`)
}

export async function fetchFareAnalytics(filters?: {
  origin?: string
  destination?: string
  departureDate?: string
}): Promise<FareAnalyticsResponse> {
  const search = new URLSearchParams()
  if (filters?.origin) {
    search.set('origin', filters.origin)
  }
  if (filters?.destination) {
    search.set('destination', filters.destination)
  }
  if (filters?.departureDate) {
    search.set('departureDate', filters.departureDate)
  }

  const suffix = search.toString() ? `?${search.toString()}` : ''
  return getJson<FareAnalyticsResponse>(`/api/fares/analytics${suffix}`)
}

export async function fetchFareCollectionStatus(): Promise<FareCollectionStatusResponse> {
  return getJson<FareCollectionStatusResponse>('/api/admin/fare-collection/status')
}

export async function runFareCollection(): Promise<FareCollectionRunResponse> {
  const response = await fetch(buildApiUrl('/api/admin/fare-collection/run'), {
    method: 'POST',
  })
  const payload = (await response.json().catch(() => null)) as FareCollectionRunResponse | { error?: string } | null

  if (!response.ok) {
    throw new Error(payload && typeof payload === 'object' && 'error' in payload && payload.error ? payload.error : 'Unable to run fare collection right now.')
  }

  return payload as FareCollectionRunResponse
}

export async function fetchFareCollectionSnapshots() {
  const payload = await getJson<FareSnapshotsResponse>('/api/admin/fare-collection/snapshots')
  return payload.snapshots ?? []
}

export async function fetchFareSourceHealth(): Promise<FareSourceHealthResponse> {
  return getJson<FareSourceHealthResponse>('/api/admin/fare-sources/status')
}
export async function fetchDataQuality(): Promise<DataQualityResponse> {
  return getJson<DataQualityResponse>('/api/fares/data-quality')
}

export async function fetchDgcaBacktest(): Promise<DgcaBacktestResponse> {
  return getJson<DgcaBacktestResponse>('/api/fares/dgca-backtest?windowDays=30')
}

export async function fetchDgcaAnalytics(): Promise<DgcaAnalyticsResponse> {
  return getJson<DgcaAnalyticsResponse>('/api/dgca/analytics')
}

export async function fetchFareExplorer(): Promise<FareExplorerResponse> {
  return getJson<FareExplorerResponse>('/api/fares/explorer')
}

export async function fetchFareIndexHistory(): Promise<FareIndexHistoryResponse> {
  return getJson<FareIndexHistoryResponse>('/api/index/history')
}
