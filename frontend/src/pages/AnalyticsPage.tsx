import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { CalendarDays, Clock3, LineChart, MapPinned, TrendingUp } from 'lucide-react'
import { fetchFareAnalytics } from '@/services/fareApi'
import { RouteFilterPanel, type RouteFilterValue } from '@/components/RouteFilterPanel'
import type { FareAnalyticsResponse, FareDailyIndexPoint, FareTrendPoint } from '@/types/fare'

type AnalyticsPageProps = {
  theme: 'dark' | 'light'
}

const emptyAnalytics: FareAnalyticsResponse = {
  summary: [],
  trends: [],
  dailyIndex: [],
  heatmap: [],
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value)
}

function formatWindowLabel(days: number) {
  return `T+${days}`
}

function sortTrend(left: FareTrendPoint, right: FareTrendPoint) {
  return left.bookingWindowDays - right.bookingWindowDays
}

function sortDaily(left: FareDailyIndexPoint, right: FareDailyIndexPoint) {
  return left.collectionDate.localeCompare(right.collectionDate)
}

export function AnalyticsPage({ theme }: AnalyticsPageProps) {
  const [analytics, setAnalytics] = useState<FareAnalyticsResponse>(emptyAnalytics)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [draftFilters, setDraftFilters] = useState<RouteFilterValue>({
    origin: '',
    destination: '',
    departureDate: '',
  })
  const [appliedFilters, setAppliedFilters] = useState<RouteFilterValue>({
    origin: '',
    destination: '',
    departureDate: '',
  })

  useEffect(() => {
    let active = true

    async function loadAnalytics() {
      setLoading(true)
      setError('')

      try {
        const data = await fetchFareAnalytics(appliedFilters)
        if (active) {
          setAnalytics({
            summary: data.summary ?? [],
            trends: data.trends ?? [],
            dailyIndex: data.dailyIndex ?? [],
            heatmap: data.heatmap ?? [],
          })
        }
      } catch (error) {
        if (active) {
          setError(error instanceof Error ? error.message : 'Unable to load analytics data.')
          setAnalytics(emptyAnalytics)
        }
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    void loadAnalytics()

    return () => {
      active = false
    }
  }, [appliedFilters])

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setAppliedFilters(draftFilters)
  }

  function clearFilters() {
    const cleared = { origin: '', destination: '', departureDate: '' }
    setDraftFilters(cleared)
    setAppliedFilters(cleared)
  }

  const sortedSummary = useMemo(
    () => [...analytics.summary].sort((left, right) => left.airfareIndex - right.airfareIndex),
    [analytics.summary],
  )
  const topRoutes = useMemo(
    () => [...analytics.summary].sort((left, right) => left.cheapestPrice - right.cheapestPrice).slice(0, 6),
    [analytics.summary],
  )
  const sortedTrends = useMemo(() => [...analytics.trends].sort(sortTrend), [analytics.trends])
  const sortedDaily = useMemo(() => [...analytics.dailyIndex].sort(sortDaily), [analytics.dailyIndex])
  const heatmapCells = useMemo(
    () => [...analytics.heatmap].sort((left, right) => left.bookingWindowDays - right.bookingWindowDays || left.routeKey.localeCompare(right.routeKey)),
    [analytics.heatmap],
  )

  const cheapestRoute = topRoutes[0] ?? null
  const topCarrier = useMemo(() => {
    const counts = new Map<string, number>()
    for (const route of analytics.summary) {
      counts.set(route.topCarrier, (counts.get(route.topCarrier) ?? 0) + 1)
    }

    return [...counts.entries()].sort((left, right) => right[1] - left[1])[0]?.[0] ?? 'No carrier data'
  }, [analytics.summary])
  const averageCheapest = analytics.summary.length
    ? Math.round(analytics.summary.reduce((sum, route) => sum + route.cheapestPrice, 0) / analytics.summary.length)
    : 0
  const routeIndexAverage = analytics.summary.length
    ? Math.round(analytics.summary.reduce((sum, route) => sum + route.airfareIndex, 0) / analytics.summary.length)
    : 0
  const latestDaily = sortedDaily[sortedDaily.length - 1] ?? null

  return (
    <section className={`min-h-screen py-10 ${theme === 'dark' ? 'bg-slate-950' : 'bg-slate-50'}`}>
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div
          className={`rounded-[32px] border shadow-[0_18px_60px_rgba(15,23,42,0.08)] ${
            theme === 'dark' ? 'border-white/10 bg-white/5 text-white' : 'border-slate-200/70 bg-white text-slate-950'
          }`}
        >
          <div className="grid gap-8 p-5 sm:p-6 lg:grid-cols-[1.02fr_0.98fr] lg:p-8 xl:p-10">
            <div>
              <p className={`text-sm font-semibold uppercase tracking-[0.24em] ${theme === 'dark' ? 'text-teal-200' : 'text-teal-700'}`}>
                Analytics
              </p>
              <h1 className={`mt-3 text-3xl font-bold sm:text-4xl lg:text-5xl ${theme === 'dark' ? 'text-white' : 'text-slate-950'}`}>
                Live fare trends, daily index, and booking-window heatmaps.
              </h1>
              <p className={`mt-4 max-w-2xl text-base leading-8 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>
                This dashboard reads the same live-collected fares used by search, then compares `T+1`, `T+7`,
                `T+15`, `T+30`, and `T+45` so you can see how prices move over time.
              </p>

              <div className="mt-6">
                <RouteFilterPanel
                  value={draftFilters}
                  onChange={setDraftFilters}
                  onSubmit={applyFilters}
                  onClear={clearFilters}
                  theme={theme}
                  submitLabel="Apply route filters"
                />
              </div>

              <div className="mt-6 grid grid-cols-2 gap-4 xl:grid-cols-4">
                {[
                  { label: 'Tracked routes', value: String(analytics.summary.length) },
                  { label: 'Trend windows', value: String(analytics.trends.length) },
                  { label: 'Daily buckets', value: String(analytics.dailyIndex.length) },
                  { label: 'Carrier sample', value: `${new Set(analytics.summary.map((item) => item.topCarrier)).size} airlines` },
                ].map((item, index) => {
                  const icons = [MapPinned, LineChart, CalendarDays, TrendingUp]
                  const Icon = icons[index]

                  return (
                    <div
                      key={item.label}
                      className={`aspect-square w-full rounded-2xl border p-4 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg sm:p-5 ${
                        theme === 'dark'
                          ? 'border-white/10 bg-slate-900/80 hover:border-teal-300/30'
                          : 'border-slate-200 bg-white hover:border-teal-300/40'
                      }`}
                    >
                      <div className="flex h-full flex-col items-center justify-center text-center">
                        <div
                          className={`flex h-11 w-11 items-center justify-center rounded-xl ${
                            theme === 'dark' ? 'bg-teal-300 text-slate-950' : 'bg-slate-950 text-white'
                          }`}
                        >
                          <Icon size={17} strokeWidth={2} />
                        </div>
                        <p
                          className={`mt-4 text-[10px] font-semibold uppercase tracking-[0.12em] sm:text-xs ${
                            theme === 'dark' ? 'text-slate-400' : 'text-slate-500'
                          }`}
                        >
                          {item.label}
                        </p>
                        <p className={`mt-2 whitespace-nowrap text-xl font-bold sm:text-2xl ${theme === 'dark' ? 'text-white' : 'text-slate-950'}`}>
                          {item.value}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className={`rounded-[28px] border p-5 ${theme === 'dark' ? 'border-white/10 bg-slate-950/60' : 'border-slate-200 bg-slate-50'}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className={`text-sm font-semibold uppercase tracking-[0.22em] ${theme === 'dark' ? 'text-amber-200' : 'text-amber-700'}`}>
                    Booking windows
                  </p>
                  <h2 className={`mt-2 text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-950'}`}>
                    Fare movement across T+ windows
                  </h2>
                </div>
                <Clock3 className={theme === 'dark' ? 'text-teal-200' : 'text-teal-700'} />
              </div>

              {error ? (
                <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {error}
                </div>
              ) : null}

              <div className="mt-5 space-y-3">
                {loading ? (
                  <div className={`rounded-2xl border px-4 py-6 text-sm ${theme === 'dark' ? 'border-white/10 bg-white/5 text-slate-300' : 'border-slate-200 bg-white text-slate-600'}`}>
                    Loading live booking-window trends...
                  </div>
                ) : sortedTrends.length ? (
                  sortedTrends.map((point) => {
                    const maxValue = sortedTrends[0]?.averagePrice ?? point.averagePrice
                    const width = maxValue ? Math.max(16, Math.round((point.averagePrice / maxValue) * 100)) : 16

                    return (
                      <div
                        key={point.bookingWindowDays}
                        className={`rounded-2xl border px-4 py-4 ${theme === 'dark' ? 'border-white/10 bg-slate-900/70' : 'border-slate-200 bg-white'}`}
                      >
                        <div className="flex items-center justify-between gap-3 text-sm font-semibold">
                          <span>
                            {formatWindowLabel(point.bookingWindowDays)}
                          </span>
                          <span>{formatCurrency(point.averagePrice)}</span>
                        </div>
                        <div className="mt-3 h-2 rounded-full bg-slate-200/60 dark:bg-white/10">
                          <div
                            className="h-2 rounded-full bg-gradient-to-r from-teal-300 to-amber-200"
                            style={{ width: `${width}%` }}
                          />
                        </div>
                        <div className="mt-2 flex items-center justify-between text-xs uppercase tracking-[0.16em] text-slate-500">
                          <span>{point.routeCount} routes</span>
                          <span>Index {point.airfareIndex}</span>
                        </div>
                      </div>
                    )
                  })
                ) : (
                  <div className={`rounded-2xl border px-4 py-6 text-sm ${theme === 'dark' ? 'border-white/10 bg-white/5 text-slate-300' : 'border-slate-200 bg-white text-slate-600'}`}>
                    No live trend data found yet.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <div
            className={`rounded-[28px] border p-6 ${theme === 'dark' ? 'border-white/10 bg-white/5 text-white' : 'border-slate-200/70 bg-white text-slate-950'}`}
          >
            <p className={`text-sm font-semibold tracking-[0.24em] uppercase ${theme === 'dark' ? 'text-teal-200' : 'text-teal-700'}`}>
              Daily index
            </p>
            <h3 className={`mt-3 text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-950'}`}>
              Daily Airfare Price Index movement
            </h3>
            <div className="mt-5 space-y-3">
              {sortedDaily.length ? (
                sortedDaily.map((point) => (
                  <div
                    key={point.collectionDate}
                    className={`rounded-2xl border p-4 ${theme === 'dark' ? 'border-white/10 bg-slate-950/50' : 'border-slate-200 bg-slate-50'}`}
                  >
                    <div className="flex items-center justify-between gap-3 text-sm font-semibold">
                      <span>{point.collectionDate}</span>
                      <span>Index {point.airfareIndex}</span>
                    </div>
                    <div className="mt-2 grid gap-2 text-sm sm:grid-cols-3">
                      <span>{point.routeCount} routes</span>
                      <span>{formatCurrency(point.averagePrice)}</span>
                      <span>{point.lastCollectedAt ? new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(point.lastCollectedAt)) : 'Pending'}</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className={`rounded-2xl border px-4 py-6 text-sm ${theme === 'dark' ? 'border-white/10 bg-white/5 text-slate-300' : 'border-slate-200 bg-white text-slate-600'}`}>
                  No live daily index points found yet.
                </div>
              )}
            </div>
          </div>

          <div
            className={`rounded-[28px] border p-6 ${theme === 'dark' ? 'border-white/10 bg-white/5 text-white' : 'border-slate-200/70 bg-white text-slate-950'}`}
          >
            <p className={`text-sm font-semibold tracking-[0.24em] uppercase ${theme === 'dark' ? 'text-amber-200' : 'text-amber-700'}`}>
              Heatmap
            </p>
            <h3 className={`mt-3 text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-950'}`}>
              Live route and window price map
            </h3>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {heatmapCells.length ? (
                heatmapCells.map((cell) => {
                  const intensity = Math.min(100, Math.max(10, cell.airfareIndex))
                  return (
                    <div
                      key={cell.routeKey}
                      className={`rounded-2xl border p-4 transition-all duration-300 ${
                        theme === 'dark' ? 'border-white/10 bg-slate-950/50' : 'border-slate-200 bg-slate-50'
                      }`}
                    >
                      <div
                        className="h-2 rounded-full"
                        style={{
                          background: `linear-gradient(90deg, rgba(45,212,191,0.85), rgba(251,191,36,0.85))`,
                          width: `${intensity}%`,
                        }}
                      />
                      <div className="mt-3 flex items-center justify-between gap-3 text-sm font-semibold">
                        <span>{cell.origin} → {cell.destination}</span>
                        <span>{formatWindowLabel(cell.bookingWindowDays)}</span>
                      </div>
                      <div className="mt-2 text-sm text-slate-500">
                        <p>{cell.departureDate}</p>
                        <p className="mt-1">{cell.topCarrier}</p>
                        <p className="mt-1">{formatCurrency(cell.cheapestPrice)} | Index {cell.airfareIndex}</p>
                      </div>
                    </div>
                  )
                })
              ) : (
                <div className={`rounded-2xl border px-4 py-6 text-sm ${theme === 'dark' ? 'border-white/10 bg-white/5 text-slate-300' : 'border-slate-200 bg-white text-slate-600'}`}>
                  No heatmap data available yet.
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <div
            className={`rounded-[28px] border p-6 ${theme === 'dark' ? 'border-white/10 bg-white/5 text-white' : 'border-slate-200/70 bg-white text-slate-950'}`}
          >
            <p className={`text-sm font-semibold tracking-[0.24em] uppercase ${theme === 'dark' ? 'text-teal-200' : 'text-teal-700'}`}>
              Movement summary
            </p>
            <h3 className={`mt-3 text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-950'}`}>
              Route-level movement from the live collected dataset.
            </h3>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {[
                { label: 'Routes', value: String(analytics.summary.length) },
                { label: 'Average index', value: routeIndexAverage ? String(routeIndexAverage) : 'N/A' },
                { label: 'Top carrier', value: topCarrier },
              ].map((item) => (
                <div
                  key={item.label}
                  className={`rounded-2xl border p-4 ${theme === 'dark' ? 'border-white/10 bg-slate-950/50' : 'border-slate-200 bg-slate-50'}`}
                >
                  <p className={`text-xs font-semibold uppercase tracking-[0.18em] ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                    {item.label}
                  </p>
                  <p className={`mt-2 text-lg font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-950'}`}>
                    {item.value}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div
            className={`rounded-[28px] border p-6 ${theme === 'dark' ? 'border-white/10 bg-white/5 text-white' : 'border-slate-200/70 bg-white text-slate-950'}`}
          >
            <p className={`text-sm font-semibold tracking-[0.24em] uppercase ${theme === 'dark' ? 'text-amber-200' : 'text-amber-700'}`}>
              Cheapest fare
            </p>
            <h3 className={`mt-3 text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-950'}`}>
              {cheapestRoute ? `${cheapestRoute.origin} → ${cheapestRoute.destination}` : 'No route selected'}
            </h3>
            <p className={`mt-4 text-sm leading-7 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>
              {cheapestRoute
                ? `The current low sample is ${formatCurrency(cheapestRoute.cheapestPrice)} with index ${cheapestRoute.airfareIndex}. ${cheapestRoute.collectionDate ? `Collected on ${cheapestRoute.collectionDate}.` : ''}`
                : 'Select a route filter to see the latest live fare movement.'}
            </p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className={`rounded-2xl border p-4 ${theme === 'dark' ? 'border-white/10 bg-slate-950/50' : 'border-slate-200 bg-slate-50'}`}>
                <p className={`text-xs font-semibold uppercase tracking-[0.18em] ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                  Average fare
                </p>
                <p className="mt-2 text-lg font-bold">{averageCheapest ? formatCurrency(averageCheapest) : 'N/A'}</p>
              </div>
              <div className={`rounded-2xl border p-4 ${theme === 'dark' ? 'border-white/10 bg-slate-950/50' : 'border-slate-200 bg-slate-50'}`}>
                <p className={`text-xs font-semibold uppercase tracking-[0.18em] ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                  Latest daily index
                </p>
                <p className="mt-2 text-lg font-bold">{latestDaily ? String(latestDaily.airfareIndex) : 'N/A'}</p>
              </div>
            </div>
          </div>
        </div>

        <div className={`mt-6 rounded-[28px] border p-6 ${theme === 'dark' ? 'border-white/10 bg-white/5 text-white' : 'border-slate-200/70 bg-white text-slate-950'}`}>
          <p className={`text-sm font-semibold tracking-[0.24em] uppercase ${theme === 'dark' ? 'text-teal-200' : 'text-teal-700'}`}>
            Top routes
          </p>
          <h3 className={`mt-3 text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-950'}`}>
            Cheapest live fares in the current sample
          </h3>
          <div className="mt-5 overflow-hidden rounded-[24px] border">
            <table className={`min-w-full divide-y ${theme === 'dark' ? 'divide-slate-800 bg-slate-950' : 'divide-slate-200 bg-white'}`}>
              <thead className={`text-left text-sm ${theme === 'dark' ? 'bg-slate-900 text-slate-200' : 'bg-slate-950 text-slate-200'}`}>
                <tr>
                  <th className="px-5 py-4 font-semibold">Route</th>
                  <th className="px-5 py-4 font-semibold">Window</th>
                  <th className="px-5 py-4 font-semibold">Cheapest fare</th>
                  <th className="px-5 py-4 font-semibold">Index</th>
                  <th className="px-5 py-4 font-semibold">Carrier</th>
                </tr>
              </thead>
              <tbody className={theme === 'dark' ? 'divide-y divide-slate-800' : 'divide-y divide-slate-100'}>
                {sortedSummary.length ? (
                  sortedSummary.slice(0, 8).map((route) => (
                    <tr key={route.routeKey}>
                      <td className={`px-5 py-4 text-sm font-semibold ${theme === 'dark' ? 'text-slate-100' : 'text-slate-900'}`}>
                        {route.origin} → {route.destination}
                      </td>
                      <td className={`px-5 py-4 text-sm ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>
                        {formatWindowLabel(route.bookingWindowDays)}
                      </td>
                      <td className={`px-5 py-4 text-sm ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>
                        {formatCurrency(route.cheapestPrice)}
                      </td>
                      <td className={`px-5 py-4 text-sm ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>
                        {route.airfareIndex}
                      </td>
                      <td className={`px-5 py-4 text-sm ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>
                        {route.topCarrier}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="px-5 py-6 text-sm text-slate-500" colSpan={5}>
                      No live fare summaries found yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  )
}
