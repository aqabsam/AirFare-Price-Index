import { useEffect, useMemo, useState } from 'react'
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  CalendarDays,
  ChevronDown,
  CircleDollarSign,
  Clock3,
  Filter,
  Gauge,
  PlaneTakeoff,
  Route as RouteIcon,
  TrendingUp,
} from 'lucide-react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from 'recharts'
import { airlineDirectory } from '@/data/airlines'
import { fetchDataQuality, fetchDgcaBacktest, fetchFareAnalytics, fetchFareSnapshots } from '@/services/fareApi'
import type {
  DataQualityResponse,
  DgcaBacktestResponse,
  FareAnalyticsResponse,
  FareDailyIndexPoint,
  FareRouteSummary,
  FareSnapshot,
  FareTrendPoint,
} from '@/types/fare'

type AnalyticsPageProps = {
  theme: 'dark' | 'light'
}

type FilterState = {
  route: string
  airline: string
  date: string
  maxPrice: string
}

const emptyAnalytics: FareAnalyticsResponse = {
  summary: [],
  trends: [],
  dailyIndex: [],
  weeklyIndex: [],
  monthlyIndex: [],
  heatmap: [],
  sourceComparison: [],
}

const chartPalette = ['#2dd4bf', '#fbbf24', '#60a5fa', '#a78bfa', '#f472b6', '#f97316', '#34d399', '#f59e0b']
const fixedRouteOptions = [
  { value: 'all', label: 'All' },
  { value: 'CCU → PNQ', label: 'CCU→PNQ' },
  { value: 'DEL → BLR', label: 'DEL→BLR' },
  { value: 'HYD → COK', label: 'HYD→COK' },
  { value: 'PAT → BOM', label: 'PAT→BOM' },
]
const fixedAirlineOptions = [
  { value: 'all', label: 'All' },
  { value: 'Air India', label: 'Air India' },
  { value: 'Air India Express', label: 'Air India Express' },
  { value: 'Akasa Air', label: 'Akasa Air' },
  { value: 'IndiGo', label: 'IndiGo' },
  { value: 'SpiceJet', label: 'SpiceJet' },
]
const maxPriceOptions = [
  { value: 'all', label: 'Any' },
  { value: '2000', label: '₹2k' },
  { value: '4000', label: '₹4k' },
  { value: '6000', label: '₹6k' },
  { value: '8000', label: '₹8k' },
  { value: '12000', label: '₹12k' },
]

function formatDateKey(date: Date) {
  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60 * 1000)
  return offsetDate.toISOString().slice(0, 10)
}

function buildDateRange(startDate: string, endDate: string) {
  const start = new Date(`${startDate}T00:00:00`)
  const end = new Date(`${endDate}T00:00:00`)
  const dates: string[] = []

  for (let cursor = new Date(start); cursor <= end; cursor.setDate(cursor.getDate() + 1)) {
    dates.push(formatDateKey(cursor))
  }

  return dates
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value)
}

function formatPercent(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '—'
  }

  return `${value > 0 ? '+' : ''}${value.toFixed(1)}%`
}

function moneyTooltipFormatter(
  value: number | string | readonly (number | string)[] | undefined,
  label = 'Avg fare',
) {
  const numericValue = Array.isArray(value) ? Number(value[0] ?? 0) : Number(value ?? 0)
  return [formatCurrency(numericValue), label] as [string, string]
}

function average(values: number[]) {
  if (!values.length) {
    return 0
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function sortTrend(left: FareTrendPoint, right: FareTrendPoint) {
  return left.bookingWindowDays - right.bookingWindowDays
}

function sortDaily(left: FareDailyIndexPoint, right: FareDailyIndexPoint) {
  return left.collectionDate.localeCompare(right.collectionDate)
}

function calculateRegression(values: Array<{ x: number; y: number }>) {
  if (values.length < 2) {
    return []
  }

  const xs = values.map((item) => item.x)
  const ys = values.map((item) => item.y)
  const xMean = average(xs)
  const yMean = average(ys)
  const numerator = xs.reduce((sum, x, index) => sum + (x - xMean) * (ys[index] - yMean), 0)
  const denominator = xs.reduce((sum, x) => sum + (x - xMean) ** 2, 0)
  const slope = denominator === 0 ? 0 : numerator / denominator
  const intercept = yMean - slope * xMean

  return [...new Set(values.map((item) => item.x))]
    .sort((left, right) => left - right)
    .map((x) => ({ x, y: slope * x + intercept }))
}

export function AnalyticsPage({ theme }: AnalyticsPageProps) {
  const [analytics, setAnalytics] = useState<FareAnalyticsResponse>(emptyAnalytics)
  const [snapshots, setSnapshots] = useState<FareSnapshot[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [quality, setQuality] = useState<DataQualityResponse | null>(null)
  const [backtest, setBacktest] = useState<DgcaBacktestResponse | null>(null)
  const [filters, setFilters] = useState<FilterState>({ route: 'all', airline: 'all', date: 'all', maxPrice: 'all' })

  useEffect(() => {
    let active = true

    async function loadAnalytics() {
      setLoading(true)
      setError('')

      try {
        const [data, qualityData, backtestData, snapshotData] = await Promise.all([
          fetchFareAnalytics(),
          fetchDataQuality(),
          fetchDgcaBacktest(),
          fetchFareSnapshots(),
        ])

        if (active) {
          setAnalytics({
            summary: data.summary ?? [],
            trends: data.trends ?? [],
            dailyIndex: data.dailyIndex ?? [],
            weeklyIndex: data.weeklyIndex ?? [],
            monthlyIndex: data.monthlyIndex ?? [],
            heatmap: data.heatmap ?? [],
            sourceComparison: data.sourceComparison ?? [],
          })
          setSnapshots(snapshotData)
          setQuality(qualityData)
          setBacktest(backtestData)
        }
      } catch (loadError) {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : 'Unable to load analytics data.')
          setAnalytics(emptyAnalytics)
          setSnapshots([])
        }
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    const handleSync = () => {
      void loadAnalytics()
    }

    void loadAnalytics()
    window.addEventListener('fare-data-sync', handleSync)
    const refreshTimer = window.setInterval(() => {
      void loadAnalytics()
    }, 30000)

    return () => {
      active = false
      window.removeEventListener('fare-data-sync', handleSync)
      window.clearInterval(refreshTimer)
    }
  }, [])

  const routeOptions = useMemo(() => {
    const routeSet = new Set<string>([
      ...fixedRouteOptions.map((route) => route.value),
      ...snapshots.map((snapshot) => `${snapshot.origin} → ${snapshot.destination}`),
    ])

    return [{ value: 'all', label: 'All' }, ...[...routeSet].filter((route) => route !== 'all').sort().map((route) => ({ value: route, label: route }))]
  }, [snapshots])

  const airlineOptions = useMemo(
    () =>
      [...new Map(
        [...fixedAirlineOptions, ...[...new Set(snapshots.map((snapshot) => snapshot.airline))].sort().map((airline) => ({ value: airline, label: airline }))].map((option) => [option.value, option]),
      ).values()],
    [snapshots],
  )

  const dateOptions = useMemo(() => {
    const snapshotDates = [...new Set(snapshots.map((snapshot) => snapshot.departureDate))].sort((left, right) => left.localeCompare(right))
    const today = formatDateKey(new Date())

    if (!snapshotDates.length) {
      return [today]
    }

    const startDate = snapshotDates[0]
    const endDate = snapshotDates[snapshotDates.length - 1]
    const range = buildDateRange(startDate, endDate > today ? today : endDate)
    return [...new Set([...range, ...snapshotDates])].sort((left, right) => left.localeCompare(right))
  }, [snapshots])

  const normalizedRoute = routeOptions.some((option) => option.value === filters.route) ? filters.route : 'all'
  const normalizedAirline = airlineOptions.some((option) => option.value === filters.airline) ? filters.airline : 'all'
  const normalizedDate = filters.date === 'all' || dateOptions.includes(filters.date) ? filters.date : 'all'
  const normalizedMaxPrice = maxPriceOptions.some((option) => option.value === filters.maxPrice) ? filters.maxPrice : 'all'

  const effectiveFilters = {
    route: normalizedRoute,
    airline: normalizedAirline,
    date: normalizedDate,
    maxPrice: normalizedMaxPrice,
  }

  const filteredSnapshots = useMemo(() => {
    return snapshots.filter((snapshot) => {
      if (effectiveFilters.route !== 'all' && `${snapshot.origin} → ${snapshot.destination}` !== effectiveFilters.route) {
        return false
      }

      if (effectiveFilters.airline !== 'all' && snapshot.airline !== effectiveFilters.airline) {
        return false
      }

      if (effectiveFilters.date !== 'all' && snapshot.departureDate !== effectiveFilters.date) {
        return false
      }

      if (effectiveFilters.maxPrice !== 'all' && snapshot.price > Number(effectiveFilters.maxPrice)) {
        return false
      }

      return true
    })
  }, [snapshots, effectiveFilters])

  const summaryMetrics = useMemo(() => {
    const allPrices = filteredSnapshots.map((snapshot) => snapshot.price)
    const currentLowest = allPrices.length ? Math.min(...allPrices) : 0
    const currentHighest = allPrices.length ? Math.max(...allPrices) : 0
    const currentAverage = allPrices.length ? average(allPrices) : 0

    return {
      totalFlights: filteredSnapshots.length,
      routeCount: new Set(filteredSnapshots.map((snapshot) => `${snapshot.origin} → ${snapshot.destination}`)).size,
      airlineCount: new Set(filteredSnapshots.map((snapshot) => snapshot.airline)).size,
      currentLowest,
      currentHighest,
      currentAverage,
    }
  }, [filteredSnapshots])

  const trendSeries = useMemo(() => {
    if (filteredSnapshots.length) {
      const grouped = new Map<string, { date: string; avg: number; count: number }>()

      filteredSnapshots.forEach((snapshot) => {
        const existing = grouped.get(snapshot.departureDate) ?? { date: snapshot.departureDate, avg: 0, count: 0 }
        existing.avg += snapshot.price
        existing.count += 1
        grouped.set(snapshot.departureDate, existing)
      })

      return [...grouped.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([date, value]) => ({
        date,
        price: Math.round(value.avg / value.count),
      }))
    }

    return [...analytics.dailyIndex].sort(sortDaily).map((point) => ({
      date: point.collectionDate,
      price: point.averagePrice,
    }))
  }, [analytics.dailyIndex, filteredSnapshots])

  const lastTrendValue = trendSeries[trendSeries.length - 1]?.price ?? 0
  const firstTrendValue = trendSeries[0]?.price ?? lastTrendValue
  const priceChange = lastTrendValue - firstTrendValue
  const pricePercentChange = firstTrendValue ? (priceChange / firstTrendValue) * 100 : 0
  const hasData = filteredSnapshots.length > 0
  const noDataLabel = 'Not enough data'
  const noDateDataLabel = effectiveFilters.date !== 'all' && !hasData ? 'No data available' : noDataLabel

  const currentLowestLabel = hasData ? formatCurrency(summaryMetrics.currentLowest) : noDateDataLabel
  const currentAverageLabel = hasData ? formatCurrency(summaryMetrics.currentAverage) : noDateDataLabel
  const currentHighestLabel = hasData ? formatCurrency(summaryMetrics.currentHighest) : noDateDataLabel
  const priceDirection = priceChange >= 0 ? 'up' : 'down'
  const priceColorClass = priceDirection === 'up' ? 'text-rose-500' : 'text-emerald-500'

  const SharedSelect = ({
    label,
    value,
    name,
    options,
    icon: Icon,
  }: {
    label: string
    value: string
    name: string
    options: Array<{ value: string; label: string }>
    icon: typeof Filter
  }) => (
    <div className="flex min-w-0 items-center gap-3">
      <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ${theme === 'dark' ? 'bg-slate-800 text-slate-100' : 'bg-slate-100 text-slate-700'}`}>
        <Icon size={16} />
      </div>
      <div className="min-w-0 flex-1">
        <p className={`mb-1 text-[10px] uppercase tracking-[0.18em] ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>{label}</p>
        <div className="relative">
          <select
            value={value}
            name={name}
            onChange={(event) => setFilters((current) => ({ ...current, [name]: event.target.value }))}
            className={`w-full min-w-0 appearance-none rounded-2xl border px-3 py-2.5 pr-10 text-sm shadow-sm outline-none transition focus:ring-2 focus:ring-teal-400/40 ${theme === 'dark' ? 'border-white/10 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-900'}`}
          >
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <ChevronDown size={15} className={`pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`} />
        </div>
      </div>
    </div>
  )

  const routeComparison = useMemo(() => {
    const grouped = new Map<string, { route: string; average: number; flights: number }>()

    filteredSnapshots.forEach((snapshot) => {
      const route = `${snapshot.origin} → ${snapshot.destination}`
      const item = grouped.get(route) ?? { route, average: 0, flights: 0 }
      item.average += snapshot.price
      item.flights += 1
      grouped.set(route, item)
    })

    return [...grouped.values()]
      .map((item) => ({
        route: item.route,
        average: Math.round(item.average / item.flights),
      }))
      .sort((left, right) => left.average - right.average)
      .slice(0, 7)
  }, [filteredSnapshots])

  const airlineComparison = useMemo(() => {
    const grouped = new Map<string, { airline: string; average: number; flights: number }>()

    filteredSnapshots.forEach((snapshot) => {
      const item = grouped.get(snapshot.airline) ?? { airline: snapshot.airline, average: 0, flights: 0 }
      item.average += snapshot.price
      item.flights += 1
      grouped.set(snapshot.airline, item)
    })

    return [...grouped.values()]
      .map((item) => ({
        airline: item.airline,
        average: Math.round(item.average / item.flights),
        flights: item.flights,
      }))
      .sort((left, right) => left.average - right.average)
  }, [filteredSnapshots])

  const marketShare = useMemo(() => {
    const grouped = new Map<string, number>()

    filteredSnapshots.forEach((snapshot) => {
      grouped.set(snapshot.airline, (grouped.get(snapshot.airline) ?? 0) + 1)
    })

    return [...grouped.entries()]
      .map(([name, value]) => ({ name, value }))
      .sort((left, right) => right.value - left.value)
  }, [filteredSnapshots])

  const dateAverage = useMemo(() => {
    const grouped = new Map<string, { date: string; average: number; flights: number }>()

    filteredSnapshots.forEach((snapshot) => {
      const item = grouped.get(snapshot.departureDate) ?? { date: snapshot.departureDate, average: 0, flights: 0 }
      item.average += snapshot.price
      item.flights += 1
      grouped.set(snapshot.departureDate, item)
    })

    return [...grouped.values()]
      .map((item) => ({
        date: item.date,
        average: Math.round(item.average / item.flights),
        flights: item.flights,
      }))
      .sort((left, right) => left.date.localeCompare(right.date))
  }, [filteredSnapshots])

  const priceDistribution = useMemo(() => {
    const buckets = [
      { label: '₹0-2k', min: 0, max: 2000 },
      { label: '₹2k-4k', min: 2000, max: 4000 },
      { label: '₹4k-6k', min: 4000, max: 6000 },
      { label: '₹6k-8k', min: 6000, max: 8000 },
      { label: '₹8k+', min: 8000, max: Number.POSITIVE_INFINITY },
    ]

    return buckets.map((bucket) => ({
      name: bucket.label,
      count: filteredSnapshots.filter((snapshot) => snapshot.price >= bucket.min && snapshot.price < bucket.max).length,
    }))
  }, [filteredSnapshots])

  const durationScatter = useMemo(
    () =>
      filteredSnapshots.map((snapshot) => ({
        x: snapshot.durationMinutes,
        y: snapshot.price,
        z: snapshot.stops,
        airline: snapshot.airline,
        route: `${snapshot.origin} → ${snapshot.destination}`,
      })),
    [filteredSnapshots],
  )

  const regressionPlot = useMemo(() => calculateRegression(durationScatter), [durationScatter])

  const stopsVsPrice = useMemo(() => {
    const grouped = new Map<number, { stops: number; average: number; flights: number }>()

    filteredSnapshots.forEach((snapshot) => {
      const item = grouped.get(snapshot.stops) ?? { stops: snapshot.stops, average: 0, flights: 0 }
      item.average += snapshot.price
      item.flights += 1
      grouped.set(snapshot.stops, item)
    })

    return [...grouped.values()]
      .map((item) => ({
        stops: item.stops,
        price: Math.round(item.average / item.flights),
        flights: item.flights,
      }))
      .sort((left, right) => left.stops - right.stops)
  }, [filteredSnapshots])

  const topRouteSummary = useMemo(() => {
    if (!analytics.summary.length) {
      return [] as FareRouteSummary[]
    }

    return [...analytics.summary].sort((left, right) => left.cheapestPrice - right.cheapestPrice).slice(0, 5)
  }, [analytics.summary])

  const trendWindowSummary = useMemo(() => [...analytics.trends].sort(sortTrend), [analytics.trends])

  const renderNoData = (label = effectiveFilters.date !== 'all' ? 'No data available' : noDataLabel) => (
    <div className="grid h-full min-h-[220px] place-items-center rounded-2xl border border-dashed border-slate-300/80 px-4 text-center text-sm font-medium text-slate-500 dark:border-slate-700 dark:text-slate-400">
      {label}
    </div>
  )

  return (
    <section className={`min-h-screen py-10 ${theme === 'dark' ? 'bg-slate-950' : 'bg-slate-50'}`}>
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className={`rounded-[32px] border p-5 shadow-[0_18px_60px_rgba(15,23,42,0.08)] ${theme === 'dark' ? 'border-white/10 bg-white/5 text-white' : 'border-slate-200/70 bg-white text-slate-950'}`}>
          <div className="flex flex-col gap-5 xl:grid xl:grid-cols-[minmax(0,1fr)_auto] xl:items-start">
            <div>
              <p className={`text-sm font-semibold uppercase tracking-[0.24em] ${theme === 'dark' ? 'text-teal-200' : 'text-teal-700'}`}>
                Market dashboard
              </p>
              <h1 className={`mt-3 text-3xl font-bold sm:text-4xl ${theme === 'dark' ? 'text-white' : 'text-slate-950'}`}>
                Airfare price market dashboard
              </h1>
              <p className={`mt-3 max-w-2xl text-sm leading-7 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>
                Real market pricing from the live backend feed, with route, airline, date and price filters for a stock-like market view.
              </p>
            </div>

            <div className={`w-fit max-w-full justify-self-start rounded-full border px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] xl:justify-self-end ${theme === 'dark' ? 'border-teal-300/30 bg-teal-300/10 text-teal-200' : 'border-teal-200 bg-teal-50 text-teal-700'}`}>
              {loading ? 'Refreshing market feed' : 'Live market feed'}
            </div>

            <div className={`grid min-w-0 gap-3 rounded-[28px] border p-4 md:grid-cols-2 xl:col-span-2 xl:grid-cols-4 ${theme === 'dark' ? 'border-white/10 bg-slate-950/60' : 'border-slate-200 bg-slate-50'}`}>
              <SharedSelect label="Route" value={normalizedRoute} name="route" options={routeOptions} icon={Filter} />
              <SharedSelect label="Airline" value={normalizedAirline} name="airline" options={airlineOptions} icon={PlaneTakeoff} />
              <SharedSelect label="Date" value={normalizedDate} name="date" options={[{ value: 'all', label: 'All' }, ...dateOptions.map((date) => ({ value: date, label: date }))]} icon={CalendarDays} />
              <SharedSelect label="Max price" value={normalizedMaxPrice} name="maxPrice" options={maxPriceOptions} icon={CircleDollarSign} />
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            {[
              { label: 'Total flights', value: hasData ? summaryMetrics.totalFlights.toLocaleString() : noDataLabel, icon: BarChart3, accent: 'teal' },
              { label: 'Cheapest fare', value: currentLowestLabel, icon: ArrowDownRight, accent: 'green' },
              { label: 'Average fare', value: currentAverageLabel, icon: Activity, accent: 'amber' },
              { label: 'Highest fare', value: currentHighestLabel, icon: ArrowUpRight, accent: 'rose' },
              { label: 'Airlines', value: hasData ? String(summaryMetrics.airlineCount) : noDataLabel, icon: PlaneTakeoff, accent: 'violet' },
            ].map((item) => {
              const Icon = item.icon
              const tone = item.accent === 'teal' ? 'bg-teal-300 text-slate-950' : item.accent === 'green' ? 'bg-emerald-300 text-slate-950' : item.accent === 'amber' ? 'bg-amber-300 text-slate-950' : item.accent === 'rose' ? 'bg-rose-300 text-slate-950' : 'bg-violet-300 text-slate-950'

              return (
                <div key={item.label} className={`rounded-[26px] border p-4 ${theme === 'dark' ? 'border-white/10 bg-slate-900/60' : 'border-slate-200 bg-slate-50'}`}>
                  <div className="flex items-center justify-between">
                    <p className={`text-[10px] uppercase tracking-[0.2em] ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>{item.label}</p>
                    <div className={`grid h-10 w-10 place-items-center rounded-2xl ${tone}`}>
                      <Icon size={16} />
                    </div>
                  </div>
                  <p className={`mt-4 text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-950'}`}>{item.value}</p>
                </div>
              )
            })}
          </div>

          {error ? (
            <div className="mt-6 rounded-2xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
          ) : null}

          <div className="mt-6 grid gap-4 xl:grid-cols-[1.5fr_0.8fr]">
            <div className={`rounded-[28px] border p-5 ${theme === 'dark' ? 'border-white/10 bg-slate-900/60' : 'border-slate-200 bg-slate-50'}`}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className={`text-xs font-semibold uppercase tracking-[0.2em] ${theme === 'dark' ? 'text-teal-200' : 'text-teal-700'}`}>Price history</p>
                  <h2 className={`mt-2 text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-950'}`}>Fare trend over time</h2>
                </div>
                <div className={`rounded-full border px-3 py-1 text-sm font-semibold ${theme === 'dark' ? 'border-teal-300/30 bg-teal-300/10 text-teal-200' : 'border-teal-200 bg-teal-50 text-teal-700'}`}>
                  {formatPercent(pricePercentChange)}
                </div>
              </div>

              <div className="mt-4 h-72">
                {hasData ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={trendSeries} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#2dd4bf" stopOpacity={0.55} />
                          <stop offset="100%" stopColor="#2dd4bf" stopOpacity={0.03} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke={theme === 'dark' ? '#334155' : '#cbd5e1'} />
                      <XAxis dataKey="date" tick={{ fill: theme === 'dark' ? '#cbd5e1' : '#475569', fontSize: 12 }} axisLine={false} tickLine={false} />
                      <YAxis tickFormatter={(value) => `₹${Math.round(Number(value) / 1000)}k`} tick={{ fill: theme === 'dark' ? '#cbd5e1' : '#475569', fontSize: 12 }} axisLine={false} tickLine={false} />
                      <Tooltip
                        formatter={(value) => moneyTooltipFormatter(value)}
                        labelFormatter={(label) => `Date: ${label}`}
                        contentStyle={{
                          borderRadius: 16,
                          border: theme === 'dark' ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(15,23,42,0.08)',
                          background: theme === 'dark' ? '#020617' : '#ffffff',
                        }}
                      />
                      <Area type="monotone" dataKey="price" stroke="#2dd4bf" strokeWidth={3} fill="url(#priceGradient)" />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  renderNoData()
                )}
              </div>
            </div>

            <div className={`rounded-[28px] border p-5 ${theme === 'dark' ? 'border-white/10 bg-slate-900/60' : 'border-slate-200 bg-slate-50'}`}>
              <p className={`text-xs font-semibold uppercase tracking-[0.2em] ${theme === 'dark' ? 'text-amber-200' : 'text-amber-700'}`}>Price change</p>
              <h2 className={`mt-2 text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-950'}`}>Market movement</h2>

              <div className={`mt-5 rounded-[24px] border p-4 ${theme === 'dark' ? 'border-white/10 bg-slate-950/60' : 'border-slate-200 bg-white'}`}>
                <div className="flex items-center justify-between">
                  <span className={`text-sm ${theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>Change</span>
                  <span className={`text-lg font-bold ${priceColorClass}`}>{formatCurrency(priceChange)}</span>
                </div>
                <div className={`mt-2 flex items-center gap-2 ${priceColorClass}`}>
                  {priceChange >= 0 ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
                  <span className="text-sm font-semibold">{formatPercent(pricePercentChange)}</span>
                </div>
              </div>

              <div className="mt-5 space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className={theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}>Lowest fare</span>
                  <strong>{currentLowestLabel}</strong>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className={theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}>Highest fare</span>
                  <strong>{currentHighestLabel}</strong>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className={theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}>Average fare</span>
                  <strong>{currentAverageLabel}</strong>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className={theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}>Price spread</span>
                  <strong>{formatCurrency(summaryMetrics.currentHighest - summaryMetrics.currentLowest)}</strong>
                </div>
              </div>

              <div className={`mt-5 rounded-[20px] border p-3 text-xs ${theme === 'dark' ? 'border-white/10 bg-slate-950/60 text-slate-300' : 'border-slate-200 bg-white text-slate-600'}`}>
                <div className="flex items-center justify-between gap-3">
                  <span>Data quality</span>
                  <strong>{quality?.cleanedRecords ?? '—'}</strong>
                </div>
                <div className="mt-2 flex items-center justify-between gap-3">
                  <span>DGCA benchmark</span>
                  <strong>{backtest?.available ? 'Live' : 'Pending'}</strong>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            <div className={`rounded-[28px] border p-5 ${theme === 'dark' ? 'border-white/10 bg-slate-900/60' : 'border-slate-200 bg-slate-50'}`}>
              <div className="flex items-center gap-2">
                <BarChart3 className={theme === 'dark' ? 'text-teal-200' : 'text-teal-700'} size={18} />
                <h3 className={`text-lg font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-950'}`}>Airline-wise price comparison</h3>
              </div>
              <div className="mt-4 h-72">
                {hasData ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={airlineComparison.slice(0, 8)} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={theme === 'dark' ? '#334155' : '#cbd5e1'} />
                      <XAxis dataKey="airline" tick={{ fill: theme === 'dark' ? '#cbd5e1' : '#475569', fontSize: 11 }} angle={-18} textAnchor="end" interval={0} />
                      <YAxis tickFormatter={(value) => `₹${Math.round(Number(value) / 1000)}k`} tick={{ fill: theme === 'dark' ? '#cbd5e1' : '#475569', fontSize: 12 }} />
                      <Tooltip
                        formatter={(value) => moneyTooltipFormatter(value)}
                        contentStyle={{ borderRadius: 16, border: theme === 'dark' ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(15,23,42,0.08)', background: theme === 'dark' ? '#020617' : '#ffffff' }}
                      />
                      <Bar dataKey="average" radius={[8, 8, 0, 0]} fill="#2dd4bf" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                    renderNoData()
                )}
              </div>
            </div>

            <div className={`rounded-[28px] border p-5 ${theme === 'dark' ? 'border-white/10 bg-slate-900/60' : 'border-slate-200 bg-slate-50'}`}>
              <div className="flex items-center gap-2">
                <RouteIcon className={theme === 'dark' ? 'text-amber-200' : 'text-amber-700'} size={18} />
                <h3 className={`text-lg font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-950'}`}>Route-wise comparison</h3>
              </div>
              <div className="mt-4 h-72">
                {hasData ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={routeComparison} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={theme === 'dark' ? '#334155' : '#cbd5e1'} />
                      <XAxis dataKey="route" tick={{ fill: theme === 'dark' ? '#cbd5e1' : '#475569', fontSize: 11 }} angle={-18} textAnchor="end" interval={0} />
                      <YAxis tickFormatter={(value) => `₹${Math.round(Number(value) / 1000)}k`} tick={{ fill: theme === 'dark' ? '#cbd5e1' : '#475569', fontSize: 12 }} />
                      <Tooltip
                        formatter={(value) => moneyTooltipFormatter(value)}
                        contentStyle={{ borderRadius: 16, border: theme === 'dark' ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(15,23,42,0.08)', background: theme === 'dark' ? '#020617' : '#ffffff' }}
                      />
                      <Bar dataKey="average" radius={[8, 8, 0, 0]} fill="#fbbf24" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  renderNoData()
                )}
              </div>
            </div>

            <div className={`rounded-[28px] border p-5 ${theme === 'dark' ? 'border-white/10 bg-slate-900/60' : 'border-slate-200 bg-slate-50'}`}>
              <div className="flex items-center gap-2">
                <Gauge className={theme === 'dark' ? 'text-violet-200' : 'text-violet-700'} size={18} />
                <h3 className={`text-lg font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-950'}`}>Airline market share</h3>
              </div>
              <div className="mt-4 h-72">
                {hasData ? (
                  <div className="flex h-full flex-col gap-3">
                    <div className="h-48 min-h-0 flex-1">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={marketShare.slice(0, 6)} dataKey="value" nameKey="name" innerRadius={46} outerRadius={82} paddingAngle={2}>
                            {marketShare.slice(0, 6).map((entry, index) => (
                              <Cell key={entry.name} fill={chartPalette[index % chartPalette.length]} />
                            ))}
                          </Pie>
                          <Tooltip contentStyle={{ borderRadius: 16, border: theme === 'dark' ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(15,23,42,0.08)', background: theme === 'dark' ? '#020617' : '#ffffff' }} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {marketShare.slice(0, 6).map((entry) => {
                        const brand = airlineDirectory[entry.name] ?? { logoUrl: '', airline: entry.name, code: entry.name.slice(0, 2).toUpperCase() }
                        return (
                          <div key={entry.name} className={`inline-flex items-center gap-2 rounded-full border px-2 py-1 text-xs ${theme === 'dark' ? 'border-white/10 bg-slate-950/50 text-slate-200' : 'border-slate-200 bg-white text-slate-700'}`}>
                            <div className="h-5 w-5 overflow-hidden rounded-full bg-slate-100">
                              {brand.logoUrl ? <img src={brand.logoUrl} alt={`${entry.name} logo`} className="h-full w-full object-cover" loading="lazy" referrerPolicy="no-referrer" /> : <span className="grid h-full w-full place-items-center text-[8px] font-bold">{brand.code}</span>}
                            </div>
                            <span>{entry.name}</span>
                            <span className="text-[10px] opacity-70">{entry.value}</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ) : (
                  renderNoData()
                )}
              </div>
            </div>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <div className={`rounded-[28px] border p-5 ${theme === 'dark' ? 'border-white/10 bg-slate-900/60' : 'border-slate-200 bg-slate-50'}`}>
              <div className="flex items-center gap-2">
                <TrendingUp className={theme === 'dark' ? 'text-teal-200' : 'text-teal-700'} size={18} />
                <h3 className={`text-lg font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-950'}`}>Price distribution</h3>
              </div>
              <div className="mt-4 h-72">
                {hasData ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={priceDistribution} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={theme === 'dark' ? '#334155' : '#cbd5e1'} />
                      <XAxis dataKey="name" tick={{ fill: theme === 'dark' ? '#cbd5e1' : '#475569', fontSize: 12 }} />
                      <YAxis allowDecimals={false} tick={{ fill: theme === 'dark' ? '#cbd5e1' : '#475569', fontSize: 12 }} />
                      <Tooltip contentStyle={{ borderRadius: 16, border: theme === 'dark' ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(15,23,42,0.08)', background: theme === 'dark' ? '#020617' : '#ffffff' }} />
                      <Bar dataKey="count" radius={[8, 8, 0, 0]} fill="#60a5fa" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  renderNoData()
                )}
              </div>
            </div>

            <div className={`rounded-[28px] border p-5 ${theme === 'dark' ? 'border-white/10 bg-slate-900/60' : 'border-slate-200 bg-slate-50'}`}>
              <div className="flex items-center gap-2">
                <CalendarDays className={theme === 'dark' ? 'text-amber-200' : 'text-amber-700'} size={18} />
                <h3 className={`text-lg font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-950'}`}>Average price by date</h3>
              </div>
              <div className="mt-4 h-72">
                {hasData ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={dateAverage} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={theme === 'dark' ? '#334155' : '#cbd5e1'} />
                      <XAxis dataKey="date" tick={{ fill: theme === 'dark' ? '#cbd5e1' : '#475569', fontSize: 11 }} angle={-18} textAnchor="end" interval={0} />
                      <YAxis tickFormatter={(value) => `₹${Math.round(Number(value) / 1000)}k`} tick={{ fill: theme === 'dark' ? '#cbd5e1' : '#475569', fontSize: 12 }} />
                      <Tooltip
                        formatter={(value) => moneyTooltipFormatter(value)}
                        contentStyle={{ borderRadius: 16, border: theme === 'dark' ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(15,23,42,0.08)', background: theme === 'dark' ? '#020617' : '#ffffff' }}
                      />
                      <Line type="monotone" dataKey="average" stroke="#a78bfa" strokeWidth={3} dot={{ r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  renderNoData()
                )}
              </div>
            </div>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <div className={`rounded-[28px] border p-5 ${theme === 'dark' ? 'border-white/10 bg-slate-900/60' : 'border-slate-200 bg-slate-50'}`}>
              <div className="flex items-center gap-2">
                <Clock3 className={theme === 'dark' ? 'text-teal-200' : 'text-teal-700'} size={18} />
                <h3 className={`text-lg font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-950'}`}>Flight duration vs price</h3>
              </div>
              <div className="mt-4 h-72">
                {hasData ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <ScatterChart margin={{ top: 10, right: 15, left: 0, bottom: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={theme === 'dark' ? '#334155' : '#cbd5e1'} />
                      <XAxis type="number" dataKey="x" name="Duration" unit=" min" tick={{ fill: theme === 'dark' ? '#cbd5e1' : '#475569', fontSize: 12 }} />
                      <YAxis type="number" dataKey="y" name="Price" tickFormatter={(value) => `₹${Math.round(Number(value) / 1000)}k`} tick={{ fill: theme === 'dark' ? '#cbd5e1' : '#475569', fontSize: 12 }} />
                      <ZAxis range={[60, 360]} dataKey="z" />
                      <Tooltip
                        cursor={{ strokeDasharray: '3 3' }}
                        formatter={(value, name) => {
                          if (name === 'Price') {
                            return moneyTooltipFormatter(value, 'Price')
                          }

                          return [String(value ?? 0), 'Duration'] as [string, string]
                        }}
                        labelFormatter={(_, payload) => payload?.[0]?.payload?.route ?? 'Flight'}
                        contentStyle={{ borderRadius: 16, border: theme === 'dark' ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(15,23,42,0.08)', background: theme === 'dark' ? '#020617' : '#ffffff' }}
                      />
                      <Scatter data={durationScatter} fill="#2dd4bf" />
                    </ScatterChart>
                  </ResponsiveContainer>
                ) : (
                  renderNoData()
                )}
              </div>
            </div>

            <div className={`rounded-[28px] border p-5 ${theme === 'dark' ? 'border-white/10 bg-slate-900/60' : 'border-slate-200 bg-slate-50'}`}>
              <div className="flex items-center gap-2">
                <Activity className={theme === 'dark' ? 'text-violet-200' : 'text-violet-700'} size={18} />
                <h3 className={`text-lg font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-950'}`}>Stops vs price</h3>
              </div>
              <div className="mt-4 h-72">
                {hasData ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stopsVsPrice} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={theme === 'dark' ? '#334155' : '#cbd5e1'} />
                      <XAxis dataKey="stops" tick={{ fill: theme === 'dark' ? '#cbd5e1' : '#475569', fontSize: 12 }} />
                      <YAxis tickFormatter={(value) => `₹${Math.round(Number(value) / 1000)}k`} tick={{ fill: theme === 'dark' ? '#cbd5e1' : '#475569', fontSize: 12 }} />
                      <Tooltip formatter={(value) => moneyTooltipFormatter(value)} contentStyle={{ borderRadius: 16, border: theme === 'dark' ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(15,23,42,0.08)', background: theme === 'dark' ? '#020617' : '#ffffff' }} />
                      <Bar dataKey="price" radius={[8, 8, 0, 0]} fill="#a78bfa" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  renderNoData()
                )}
              </div>
            </div>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <div className={`rounded-[28px] border p-5 ${theme === 'dark' ? 'border-white/10 bg-slate-900/60' : 'border-slate-200 bg-slate-50'}`}>
              <div className="flex items-center gap-2">
                <TrendingUp className={theme === 'dark' ? 'text-amber-200' : 'text-amber-700'} size={18} />
                <h3 className={`text-lg font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-950'}`}>Regression trend</h3>
              </div>
              <div className="mt-4 h-72">
                {hasData ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={regressionPlot} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={theme === 'dark' ? '#334155' : '#cbd5e1'} />
                      <XAxis dataKey="x" tick={{ fill: theme === 'dark' ? '#cbd5e1' : '#475569', fontSize: 12 }} />
                      <YAxis tickFormatter={(value) => `₹${Math.round(Number(value) / 1000)}k`} tick={{ fill: theme === 'dark' ? '#cbd5e1' : '#475569', fontSize: 12 }} />
                      <Tooltip
                        formatter={(value) => moneyTooltipFormatter(value, 'Estimated fare')}
                        contentStyle={{ borderRadius: 16, border: theme === 'dark' ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(15,23,42,0.08)', background: theme === 'dark' ? '#020617' : '#ffffff' }}
                      />
                      <Line type="monotone" dataKey="y" stroke="#fbbf24" strokeWidth={3} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  renderNoData()
                )}
              </div>
            </div>

            <div className={`rounded-[28px] border p-5 ${theme === 'dark' ? 'border-white/10 bg-slate-900/60' : 'border-slate-200 bg-slate-50'}`}>
              <div className="flex items-center gap-2">
                <TrendingUp className={theme === 'dark' ? 'text-teal-200' : 'text-teal-700'} size={18} />
                <h3 className={`text-lg font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-950'}`}>Fare trend windows</h3>
              </div>
              <div className="mt-4 h-72">
                {hasData ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trendWindowSummary} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={theme === 'dark' ? '#334155' : '#cbd5e1'} />
                      <XAxis dataKey="bookingWindowDays" tick={{ fill: theme === 'dark' ? '#cbd5e1' : '#475569', fontSize: 12 }} />
                      <YAxis tickFormatter={(value) => `₹${Math.round(Number(value) / 1000)}k`} tick={{ fill: theme === 'dark' ? '#cbd5e1' : '#475569', fontSize: 12 }} />
                      <Tooltip formatter={(value) => moneyTooltipFormatter(value)} contentStyle={{ borderRadius: 16, border: theme === 'dark' ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(15,23,42,0.08)', background: theme === 'dark' ? '#020617' : '#ffffff' }} />
                      <Line type="monotone" dataKey="averagePrice" stroke="#2dd4bf" strokeWidth={3} dot={{ r: 4 }} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  renderNoData()
                )}
              </div>
              <div className="mt-4 grid grid-cols-5 gap-2 text-xs">
                {[1, 7, 15, 30, 45].map((windowDays) => {
                  const point = trendWindowSummary.find((item) => item.bookingWindowDays === windowDays)
                  return (
                    <div key={windowDays} className={`rounded-xl border px-2 py-2 text-center ${theme === 'dark' ? 'border-white/10 bg-slate-950/50' : 'border-slate-200 bg-white'}`}>
                      <p className="font-semibold">T+{windowDays}</p>
                      <p className={theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}>Elasticity</p>
                      <p className="mt-1 font-bold">{point?.elasticity ?? '—'}</p>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          <div className={`mt-6 rounded-[28px] border p-6 ${theme === 'dark' ? 'border-white/10 bg-white/5 text-white' : 'border-slate-200/70 bg-white text-slate-950'}`}>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className={`text-xs font-semibold uppercase tracking-[0.22em] ${theme === 'dark' ? 'text-teal-200' : 'text-teal-700'}`}>Live pricing</p>
                <h3 className={`mt-2 text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-950'}`}>Cheapest live fares</h3>
              </div>
              <div className={`rounded-full border px-3 py-1 text-sm ${theme === 'dark' ? 'border-white/10 bg-white/5 text-slate-300' : 'border-slate-200 bg-slate-50 text-slate-700'}`}>
                {summaryMetrics.totalFlights} flight offers in view
              </div>
            </div>

            <div className="mt-5 overflow-hidden rounded-[24px] border">
              <table className={`min-w-full divide-y ${theme === 'dark' ? 'divide-slate-800 bg-slate-950' : 'divide-slate-200 bg-white'}`}>
                <thead className={`text-left text-sm ${theme === 'dark' ? 'bg-slate-900 text-slate-200' : 'bg-slate-950 text-slate-200'}`}>
                  <tr>
                    <th className="px-5 py-4 font-semibold">Route</th>
                    <th className="px-5 py-4 font-semibold">Cheapest</th>
                    <th className="px-5 py-4 font-semibold">Average</th>
                    <th className="px-5 py-4 font-semibold">Flights</th>
                    <th className="px-5 py-4 font-semibold">Top carrier</th>
                  </tr>
                </thead>
                <tbody className={theme === 'dark' ? 'divide-y divide-slate-800' : 'divide-y divide-slate-100'}>
                  {topRouteSummary.length ? (
                    topRouteSummary.map((route) => (
                      <tr key={route.routeKey}>
                        <td className={`px-5 py-4 text-sm font-semibold ${theme === 'dark' ? 'text-slate-100' : 'text-slate-900'}`}>{route.origin} → {route.destination}</td>
                        <td className={`px-5 py-4 text-sm ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>{formatCurrency(route.cheapestPrice)}</td>
                        <td className={`px-5 py-4 text-sm ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>{formatCurrency(route.averagePrice)}</td>
                        <td className={`px-5 py-4 text-sm ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>{route.offerCount}</td>
                        <td className={`px-5 py-4 text-sm ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>{route.topCarrier}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td className="px-5 py-6 text-sm text-slate-500" colSpan={5}>No live fare summaries available for this filter set.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}