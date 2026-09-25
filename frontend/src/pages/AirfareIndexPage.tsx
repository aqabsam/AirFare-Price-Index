import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Activity,
  ArrowRight,
  BarChart3,
  Compass,
  Gauge,
  MapPinned,
  TrendingUp,
} from 'lucide-react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { RouteMap } from '@/components/RouteMap'
import { fetchAirfareIndex, fetchDgcaBacktest, fetchFareAnalytics, fetchFareIndexHistory, fetchFareSourceHealth } from '@/services/fareApi'
import type { DgcaBacktestResponse, FareAnalyticsResponse, FareIndexHistoryResponse, FareRouteSummary, FareSourceHealthResponse } from '@/types/fare'

type AirfareIndexPageProps = {
  theme: 'dark' | 'light'
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

const NO_VERIFIED_DATA = 'No verified fare data available'

type SearchRoute = {
  origin: string
  destination: string
}

function readSearchRoute(searchParams: URLSearchParams): SearchRoute | null {
  const origin = searchParams.get('origin')
  const destination = searchParams.get('destination')
  if (origin && destination) {
    return { origin, destination }
  }

  return null
}

function formatCurrency(value: number, currency = 'INR') {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(value)
}

function formatDelta(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '—'
  }

  const prefix = value > 0 ? '+' : ''
  return `${prefix}${value.toFixed(1)}%`
}

export function AirfareIndexPage({ theme }: AirfareIndexPageProps) {
  const [searchParams] = useSearchParams()
  const [routes, setRoutes] = useState<FareRouteSummary[]>([])
  const [analytics, setAnalytics] = useState<FareAnalyticsResponse>(emptyAnalytics)
  const [backtest, setBacktest] = useState<DgcaBacktestResponse | null>(null)
  const [sourceHealth, setSourceHealth] = useState<FareSourceHealthResponse | null>(null)
  const [indexHistory, setIndexHistory] = useState<FareIndexHistoryResponse['history']>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchRoute, setSearchRoute] = useState<SearchRoute | null>(() => readSearchRoute(searchParams))

  useEffect(() => {
    const syncSearchRoute = (event: Event) => {
      const route = (event as CustomEvent<SearchRoute>).detail
      setSearchRoute(route?.origin && route.destination ? route : readSearchRoute(searchParams))
    }
    window.addEventListener('airfare-route-change', syncSearchRoute)
    return () => window.removeEventListener('airfare-route-change', syncSearchRoute)
  }, [searchParams])

  useEffect(() => {
    let active = true

    async function loadIndex() {
      setLoading(true)
      setError('')

      try {
        const [indexPayload, analyticsPayload, backtestPayload, sourceHealthPayload, historyPayload] = await Promise.all([
          fetchAirfareIndex(),
          fetchFareAnalytics(),
          fetchDgcaBacktest(),
          fetchFareSourceHealth(),
          fetchFareIndexHistory(),
        ])
        if (!active) {
          return
        }

        setRoutes(indexPayload.routes ?? [])
        setAnalytics({
          summary: analyticsPayload.summary ?? [],
          trends: analyticsPayload.trends ?? [],
          dailyIndex: analyticsPayload.dailyIndex ?? [],
          weeklyIndex: analyticsPayload.weeklyIndex ?? [],
          monthlyIndex: analyticsPayload.monthlyIndex ?? [],
          heatmap: analyticsPayload.heatmap ?? [],
          sourceComparison: analyticsPayload.sourceComparison ?? [],
          base: analyticsPayload.base ?? { value: null, period: null },
          methodology: analyticsPayload.methodology,
        })
        setBacktest(backtestPayload)
        setSourceHealth(sourceHealthPayload)
        setIndexHistory(historyPayload.history ?? [])
      } catch (loadError) {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : 'Unable to load airfare market data.')
          setRoutes([])
          setAnalytics(emptyAnalytics)
          setBacktest(null)
          setSourceHealth(null)
          setIndexHistory([])
        }
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    const handleSync = () => {
      void loadIndex()
    }

    void loadIndex()
    window.addEventListener('fare-data-sync', handleSync)
    const refreshTimer = window.setInterval(() => {
      void loadIndex()
    }, 30000)

    return () => {
      active = false
      window.removeEventListener('fare-data-sync', handleSync)
      window.clearInterval(refreshTimer)
    }
  }, [])

  const sortedRoutes = useMemo(
    () => [...routes].sort((left, right) => (right.airfareIndex ?? Number.NEGATIVE_INFINITY) - (left.airfareIndex ?? Number.NEGATIVE_INFINITY)),
    [routes],
  )
  const currentRoute = sortedRoutes[0] ?? null
  const marketIndex = currentRoute?.airfareIndex ?? null
  const baseValue = analytics.base?.value ?? null
  const deltaFromBase = marketIndex !== null && baseValue !== null ? marketIndex - baseValue : null
  const totalRoutes = routes.length

  const trendData = useMemo(() => {
    const storedHistory = indexHistory.filter((point) => point.routeKey === 'MARKET').slice(-12)
    if (storedHistory.length) {
      return storedHistory.map((point) => ({ label: point.departureDate.slice(5), index: point.airfareIndex, average: point.averagePrice }))
    }

    if (analytics.dailyIndex.length) {
      return analytics.dailyIndex.slice(-12).map((point) => ({
        label: point.collectionDate.slice(5),
        index: point.airfareIndex,
        average: point.averagePrice,
      }))
    }

    if (analytics.trends.length) {
      return analytics.trends.slice(-12).map((point) => ({
        label: point.collectionDate || `T+${point.bookingWindowDays}`,
        index: point.airfareIndex,
        average: point.averagePrice,
      }))
    }

    return []
  }, [analytics, indexHistory])

  const distributionData = useMemo(
    () =>
      sortedRoutes.slice(0, 8).map((route) => ({
        route: `${route.origin}-${route.destination}`,
        index: route.airfareIndex,
        price: route.cheapestPrice,
      })),
    [sortedRoutes],
  )

  const movementRows = useMemo(
    () =>
      sortedRoutes.slice(0, 5).map((route) => ({
        route: `${route.origin} → ${route.destination}`,
        fare: route.cheapestPrice,
        currency: route.currency,
        index: route.airfareIndex,
        change: route.changePercent ?? null,
      })),
    [sortedRoutes],
  )

  const selectedRoute = searchRoute
    ? routes.find((route) => route.origin === searchRoute.origin.toUpperCase() && route.destination === searchRoute.destination.toUpperCase()) ?? currentRoute
    : currentRoute
  const mapRoute = selectedRoute ? { origin: selectedRoute.origin, destination: selectedRoute.destination } : { origin: 'PAT', destination: 'BOM' }
  const chartIndexValues = trendData.map((point) => Number(point.index)).filter((value) => Number.isFinite(value))
  const chartMinIndex = chartIndexValues.length ? Math.min(...chartIndexValues) : 0
  const chartMaxIndex = chartIndexValues.length ? Math.max(...chartIndexValues) : 0
  const latestPeriodValue = (period: 'daily' | 'weekly' | 'monthly') => {
    const values = period === 'daily' ? analytics.dailyIndex : period === 'weekly' ? analytics.weeklyIndex : analytics.monthlyIndex
    return values.at(-1)?.airfareIndex ?? null
  }

  return (
    <section className={`py-10 ${theme === 'dark' ? 'bg-slate-950' : 'bg-slate-50'}`}>
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        {error ? (
          <div className="mb-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 shadow-sm">
            {error}
          </div>
        ) : null}

        <div
          className={`overflow-hidden rounded-[32px] border shadow-[0_18px_60px_rgba(15,23,42,0.08)] ${
            theme === 'dark' ? 'border-white/10 bg-white/5 text-white' : 'border-slate-200/70 bg-white text-slate-950'
          }`}
        >
          <div className="grid gap-8 p-6 lg:grid-cols-[1.12fr_0.88fr] lg:p-8 xl:p-10">
            <div>
              <p className={`text-sm font-semibold tracking-[0.24em] uppercase ${theme === 'dark' ? 'text-teal-200' : 'text-teal-700'}`}>
                Airfare Index
              </p>
              <h1 className={`mt-3 text-4xl font-bold sm:text-5xl ${theme === 'dark' ? 'text-white' : 'text-slate-950'}`}>
                Market movement, route index, and live map from verified fare data.
              </h1>
              <p className={`mt-4 max-w-2xl text-base leading-8 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>
                Airfare values are derived from real backend collections and Duffel fallback responses only; they are never hard-coded or assembled from placeholder route data.
              </p>

              <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {[
                  {
                    label: 'Market index',
                    value: loading ? 'Collecting…' : marketIndex === null ? NO_VERIFIED_DATA : `${marketIndex}`,
                    tone: 'text-teal-400',
                    icon: Gauge,
                  },
                  {
                    label: 'Base index',
                    value: baseValue === null ? NO_VERIFIED_DATA : `${baseValue}`,
                    tone: 'text-sky-300',
                    icon: Activity,
                  },
                  {
                    label: 'Routes tracked',
                    value: loading ? '—' : String(totalRoutes),
                    tone: 'text-emerald-300',
                    icon: Compass,
                  },
                  {
                    label: 'Current fare',
                    value: currentRoute ? formatCurrency(currentRoute.cheapestPrice, currentRoute.currency) : NO_VERIFIED_DATA,
                    tone: 'text-amber-300',
                    icon: TrendingUp,
                  },
                ].map(({ label, value, tone, icon: Icon }) => (
                  <div
                    key={label}
                    className={`rounded-3xl border p-4 ${theme === 'dark' ? 'border-white/10 bg-slate-950/60' : 'border-slate-200 bg-slate-50'}`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className={`text-xs font-semibold uppercase tracking-[0.22em] ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                        {label}
                      </p>
                      <Icon size={16} className={theme === 'dark' ? 'text-teal-200' : 'text-teal-700'} />
                    </div>
                    <p className={`mt-2 text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-950'}`}>
                      {value}
                    </p>
                    <p className={`mt-1 text-sm font-medium ${tone}`}>Live market signal</p>
                  </div>
                ))}
              </div>

              <div className="mt-7 flex flex-wrap gap-3">
                <a
                  href="#trend"
                  className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition hover:-translate-y-0.5 ${
                    theme === 'dark'
                      ? 'bg-teal-300 text-slate-950 hover:shadow-lg hover:shadow-teal-300/20'
                      : 'bg-slate-950 text-white hover:shadow-lg hover:shadow-slate-400/20'
                  }`}
                >
                  View trend
                  <ArrowRight size={15} />
                </a>
                <a
                  href="#map"
                  className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition hover:-translate-y-0.5 ${
                    theme === 'dark'
                      ? 'border-white/10 bg-white/5 text-white hover:bg-white/10'
                      : 'border-slate-200 bg-white text-slate-800 hover:bg-slate-50'
                  }`}
                >
                  <MapPinned size={15} />
                  Route map
                </a>
              </div>
            </div>

            <div id="map" className={`rounded-[28px] border p-4 ${theme === 'dark' ? 'border-white/10 bg-slate-950/60' : 'border-slate-200 bg-slate-50'}`}>
              <RouteMap
                origin={mapRoute.origin}
                destination={mapRoute.destination}
                theme={theme}
                routeLabel={`${mapRoute.origin} → ${mapRoute.destination}`}
                airline={selectedRoute?.topCarrier}
                fare={selectedRoute ? formatCurrency(selectedRoute.cheapestPrice, selectedRoute.currency) : undefined}
              />
            </div>
          </div>
        </div>
         <div className="mt-6 grid gap-6 xl:grid-cols-2">
          <div
            id="trend"
            className={`rounded-[28px] border p-5 ${
              theme === 'dark' ? 'border-white/10 bg-white/5 text-white' : 'border-slate-200/70 bg-white text-slate-950'
            }`}
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className={`text-xs font-semibold uppercase tracking-[0.2em] ${theme === 'dark' ? 'text-teal-200' : 'text-teal-700'}`}>
                  Index trend line
                </p>
                <h3 className={`mt-2 text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-950'}`}>
                  Fare index over time
                </h3>
              </div>
              <BarChart3 size={18} className={theme === 'dark' ? 'text-teal-200' : 'text-teal-700'} />
            </div>

            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={theme === 'dark' ? '#334155' : '#e2e8f0'} />
                  <XAxis dataKey="label" stroke={theme === 'dark' ? '#cbd5e1' : '#475569'} tickLine={false} axisLine={false} />
                  <YAxis
                    domain={chartIndexValues.length ? [chartMinIndex, chartMaxIndex] : ['auto', 'auto']}
                    stroke={theme === 'dark' ? '#cbd5e1' : '#475569'}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    formatter={(value) => {
                      const numericValue = Array.isArray(value) ? Number(value[0] ?? 0) : Number(value ?? 0)
                      return [`${numericValue}`, 'Index']
                    }}
                    contentStyle={{
                      borderRadius: 14,
                      border: theme === 'dark' ? '1px solid rgba(148,163,184,0.25)' : '1px solid rgba(148,163,184,0.35)',
                      backgroundColor: theme === 'dark' ? '#020617' : '#f8fafc',
                    }}
                  />
                  <Line type="monotone" dataKey="index" stroke="#2dd4bf" strokeWidth={3} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div
            className={`rounded-[28px] border p-5 ${
              theme === 'dark' ? 'border-white/10 bg-white/5 text-white' : 'border-slate-200/70 bg-white text-slate-950'
            }`}
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className={`text-xs font-semibold uppercase tracking-[0.2em] ${theme === 'dark' ? 'text-amber-200' : 'text-amber-700'}`}>
                  Route index distribution
                </p>
                <h3 className={`mt-2 text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-950'}`}>
                  Current fare vs index by route
                </h3>
              </div>
            </div>

            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={distributionData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={theme === 'dark' ? '#334155' : '#e2e8f0'} vertical={false} />
                  <XAxis dataKey="route" stroke={theme === 'dark' ? '#cbd5e1' : '#475569'} tickLine={false} axisLine={false} angle={-18} textAnchor="end" height={70} />
                  <YAxis stroke={theme === 'dark' ? '#cbd5e1' : '#475569'} tickLine={false} axisLine={false} />
                  <Tooltip
                    formatter={(value) => {
                      const numericValue = Array.isArray(value) ? Number(value[0] ?? 0) : Number(value ?? 0)
                      return [`${numericValue}`, 'Index']
                    }}
                    contentStyle={{
                      borderRadius: 14,
                      border: theme === 'dark' ? '1px solid rgba(148,163,184,0.25)' : '1px solid rgba(148,163,184,0.35)',
                      backgroundColor: theme === 'dark' ? '#020617' : '#f8fafc',
                    }}
                  />
                  <Bar dataKey="index" fill="#fbbf24" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-3">
          {(['daily', 'weekly', 'monthly'] as const).map((period) => (
            <div key={period} className={`rounded-[28px] border p-5 ${theme === 'dark' ? 'border-white/10 bg-white/5 text-white' : 'border-slate-200/70 bg-white text-slate-950'}`}>
              <p className={`text-xs font-semibold uppercase tracking-[0.2em] ${theme === 'dark' ? 'text-teal-200' : 'text-teal-700'}`}>{period} index</p>
              <p className="mt-3 text-3xl font-bold">{latestPeriodValue(period) ?? NO_VERIFIED_DATA}</p>
              <p className={`mt-2 text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                {period === 'daily' ? analytics.dailyIndex.at(-1)?.collectionDate : period === 'weekly' ? analytics.weeklyIndex.at(-1)?.periodStart : analytics.monthlyIndex.at(-1)?.periodStart ?? 'No verified period data'}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-3">
          <div className={`rounded-[28px] border p-5 ${theme === 'dark' ? 'border-white/10 bg-white/5 text-white' : 'border-slate-200/70 bg-white text-slate-950'}`}>
            <p className={`text-xs font-semibold uppercase tracking-[0.2em] ${theme === 'dark' ? 'text-teal-200' : 'text-teal-700'}`}>Index methodology</p>
            <div className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between gap-3"><span>Base period</span><strong>{analytics.methodology?.basePeriod ?? analytics.base?.period ?? 'Unavailable'}</strong></div>
              <div className="flex justify-between gap-3"><span>Base index</span><strong>{baseValue ?? 'Unavailable'}</strong></div>
              <div className="flex justify-between gap-3"><span>Official sources</span><strong>{analytics.methodology?.officialSources.join(', ') ?? 'Unavailable'}</strong></div>
            </div>
            <p className={`mt-4 text-xs ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>Route basket: {analytics.methodology?.routeBasket.length ? analytics.methodology.routeBasket.join(', ') : 'All verified routes'}</p>
            <p className={`mt-2 text-xs ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>Weights: {Object.keys(analytics.methodology?.routeWeights ?? {}).length ? Object.entries(analytics.methodology?.routeWeights ?? {}).map(([route, weight]) => `${route} ${weight}`).join(', ') : 'Default equal weights'}</p>
          </div>

          <div className={`rounded-[28px] border p-5 ${theme === 'dark' ? 'border-white/10 bg-white/5 text-white' : 'border-slate-200/70 bg-white text-slate-950'}`}>
            <p className={`text-xs font-semibold uppercase tracking-[0.2em] ${theme === 'dark' ? 'text-amber-200' : 'text-amber-700'}`}>DGCA 30-day backtest</p>
            <p className="mt-3 text-xl font-bold">{backtest?.available ? 'Available' : 'Unavailable'}</p>
            <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
              {(['mae', 'rmse', 'mape', 'correlation'] as const).map((metric) => <div key={metric} className="flex justify-between gap-2"><span>{metric.toUpperCase()}</span><strong>{backtest?.[metric] ?? '—'}</strong></div>)}
            </div>
            <p className={`mt-3 text-xs ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>{backtest?.message ?? 'No benchmark response'}</p>
          </div>

          <div className={`rounded-[28px] border p-5 ${theme === 'dark' ? 'border-white/10 bg-white/5 text-white' : 'border-slate-200/70 bg-white text-slate-950'}`}>
            <p className={`text-xs font-semibold uppercase tracking-[0.2em] ${theme === 'dark' ? 'text-sky-200' : 'text-sky-700'}`}>Data/source status</p>
            <p className="mt-3 text-xl font-bold">{sourceHealth ? `${sourceHealth.liveCount} live sources` : 'Unavailable'}</p>
            <div className="mt-4 space-y-2 text-sm"><div className="flex justify-between"><span>Live</span><strong>{sourceHealth?.liveCount ?? '—'}</strong></div><div className="flex justify-between"><span>Stale</span><strong>{sourceHealth?.staleCount ?? '—'}</strong></div><div className="flex justify-between"><span>Empty</span><strong>{sourceHealth?.emptyCount ?? '—'}</strong></div></div>
          </div>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-3">
          <div className={`rounded-[28px] border p-5 ${theme === 'dark' ? 'border-white/10 bg-white/5 text-white' : 'border-slate-200/70 bg-white text-slate-950'}`}>
            <p className={`text-xs font-semibold uppercase tracking-[0.2em] ${theme === 'dark' ? 'text-teal-200' : 'text-teal-700'}`}>
              Base index vs current
            </p>
            <h3 className={`mt-2 text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-950'}`}>
              {loading ? 'Calculating…' : marketIndex === null ? NO_VERIFIED_DATA : `${marketIndex}`}
            </h3>
            <div className="mt-5 space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className={theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}>Base</span>
                <span className="font-semibold">{baseValue === null ? 'Unavailable' : baseValue}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className={theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}>Current</span>
                <span className="font-semibold">{marketIndex === null ? 'Unavailable' : marketIndex}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className={theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}>Delta</span>
                <span className={`font-semibold ${deltaFromBase === null ? (theme === 'dark' ? 'text-slate-400' : 'text-slate-500') : deltaFromBase >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {formatDelta(deltaFromBase)}
                </span>
              </div>
            </div>
            <div className="mt-6 h-3 rounded-full bg-slate-200/80 dark:bg-slate-800">
              <div
                className="h-3 rounded-full bg-gradient-to-r from-teal-400 to-amber-300"
                style={{ width: marketIndex === null || baseValue === null ? '0%' : `${Math.min(100, Math.max(0, (marketIndex / baseValue) * 100))}%` }}
              />
            </div>
          </div>

          <div className={`rounded-[28px] border p-5 ${theme === 'dark' ? 'border-white/10 bg-white/5 text-white' : 'border-slate-200/70 bg-white text-slate-950'}`}>
            <p className={`text-xs font-semibold uppercase tracking-[0.2em] ${theme === 'dark' ? 'text-amber-200' : 'text-amber-700'}`}>
              Route movement
            </p>
            <h3 className={`mt-2 text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-950'}`}>
              Top movements
            </h3>
            <div className="mt-5 space-y-3">
              {movementRows.length ? (
                movementRows.map((row) => (
                  <div key={row.route} className={`flex items-center justify-between rounded-2xl border px-3 py-3 ${theme === 'dark' ? 'border-white/10 bg-slate-950/50' : 'border-slate-200 bg-slate-50'}`}>
                    <div>
                      <p className="text-sm font-semibold">{row.route}</p>
                      <p className={`text-xs ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                        {formatCurrency(row.fare, row.currency)} fare
                      </p>
                    </div>
                    <span className={`text-sm font-semibold ${row.change === null ? (theme === 'dark' ? 'text-slate-400' : 'text-slate-500') : row.change >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {formatDelta(row.change)}
                    </span>
                  </div>
                ))
              ) : (
                <div className={`rounded-2xl border px-3 py-4 text-sm ${theme === 'dark' ? 'border-white/10 bg-slate-950/50 text-slate-300' : 'border-slate-200 bg-slate-50 text-slate-600'}`}>
                  {NO_VERIFIED_DATA}
                </div>
              )}
            </div>
          </div>

          <div className={`rounded-[28px] border p-5 ${theme === 'dark' ? 'border-white/10 bg-white/5 text-white' : 'border-slate-200/70 bg-white text-slate-950'}`}>
            <p className={`text-xs font-semibold uppercase tracking-[0.2em] ${theme === 'dark' ? 'text-teal-200' : 'text-teal-700'}`}>
              Current fare / index comparison
            </p>
            <h3 className={`mt-2 text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-950'}`}>
              {selectedRoute ? `${selectedRoute.origin} → ${selectedRoute.destination}` : 'Awaiting selection'}
            </h3>

            <div className="mt-5 h-52">
              {distributionData.length ? <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={distributionData}>
                  <defs>
                    <linearGradient id="fareGradient" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="5%" stopColor="#2dd4bf" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#2dd4bf" stopOpacity={0.12} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={theme === 'dark' ? '#334155' : '#e2e8f0'} />
                  <XAxis dataKey="route" stroke={theme === 'dark' ? '#cbd5e1' : '#475569'} tickLine={false} axisLine={false} />
                  <YAxis stroke={theme === 'dark' ? '#cbd5e1' : '#475569'} tickLine={false} axisLine={false} />
                  <Tooltip
                    formatter={(value, name) => {
                      const numericValue = Array.isArray(value) ? Number(value[0] ?? 0) : Number(value ?? 0)
                      return [numericValue, name === 'price' ? 'Fare' : 'Index']
                    }}
                    contentStyle={{
                      borderRadius: 14,
                      border: theme === 'dark' ? '1px solid rgba(148,163,184,0.25)' : '1px solid rgba(148,163,184,0.35)',
                      backgroundColor: theme === 'dark' ? '#020617' : '#f8fafc',
                    }}
                  />
                  <Area type="monotone" dataKey="index" stroke="#2dd4bf" fill="url(#fareGradient)" strokeWidth={2.5} />
                </AreaChart>
              </ResponsiveContainer> : <div className={`flex h-full items-center justify-center text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>{NO_VERIFIED_DATA}</div>}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}