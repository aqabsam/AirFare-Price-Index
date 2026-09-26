import { useMemo, useState } from 'react'
import { ChevronDown, MapPinned } from 'lucide-react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { EmptyFareState } from '@/components/EmptyFareState'
import { RouteMap } from '@/components/RouteMap'
import { useSearchState } from '@/state/searchContext'
import type { FlightOffer } from '@/types/flight'
import demoData from '../../../backend/test.json'

type AirfareIndexPageProps = { theme: 'dark' | 'light' }
type Period = 'daily' | 'weekly' | 'monthly'
type DateRange = '7D' | '30D' | '90D' | 'All'
type IndexPoint = { date: string; averageFare: number; observations: number; apix: number }

const WINDOWS = [1, 7, 15, 30, 45] as const
const INSUFFICIENT = 'Insufficient verified live data'
const demoRouteContributions = demoData.routeBasket.map((item) => ({
  route: `${item.origin} → ${item.destination}`,
  weight: item.weight,
  routeIndex: item.routeIndex,
  contribution: (item.routeIndex - demoData.meta.baseIndex) * item.weight,
}))
const demoBacktestSeries = demoData.dgcaBacktest.apixValues.map((point, index) => ({
  period: point.period,
  apix: point.value,
  benchmark: demoData.dgcaBacktest.benchmarkValues[index]?.value ?? null,
}))

function currency(value: number, code = 'INR') {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: code, maximumFractionDigits: 0 }).format(value)
}

function formatDate(value: string) {
  const date = new Date(`${value}T00:00:00Z`)
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeZone: 'UTC' }).format(date)
}

function formatTime(value?: string | null) {
  if (!value || !Number.isFinite(Date.parse(value))) return INSUFFICIENT
  return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

function fareOf(offer: FlightOffer) {
  return typeof offer.totalFare === 'number' && Number.isFinite(offer.totalFare) && offer.totalFare > 0 ? offer.totalFare : null
}

function isVerified(offer: FlightOffer, origin: string, destination: string, travelDate: string) {
  const segments = offer.segments ?? []
  return offer.origin === origin && offer.destination === destination && segments.length > 0 &&
    segments[0]?.origin === origin && segments.at(-1)?.destination === destination &&
    segments.every((segment, index) => index === 0 || segments[index - 1]?.destination === segment.origin) &&
    segments[0]?.departureDate === travelDate && offer.departureTime === segments[0]?.departureTime &&
    offer.arrivalTime === segments.at(-1)?.arrivalTime && offer.stops === segments.length - 1 &&
    segments.every((segment) => Boolean(segment.airline.trim() && segment.airlineCode.trim() && segment.flightNumber.trim())) &&
    fareOf(offer) !== null && Number.isFinite(Date.parse(offer.collectedAt))
}

function groupByDate(records: Array<{ collectedAt: string; fare: number }>) {
  const groups = new Map<string, number[]>()
  records.forEach(({ collectedAt, fare }) => {
    const date = collectedAt.slice(0, 10)
    groups.set(date, [...(groups.get(date) ?? []), fare])
  })
  return [...groups.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([date, fares]) => ({
    date,
    averageFare: fares.reduce((sum, fare) => sum + fare, 0) / fares.length,
    observations: fares.length,
  }))
}

function periodKey(date: string, period: Period) {
  if (period === 'daily') return date
  const parsed = new Date(`${date}T00:00:00Z`)
  if (!Number.isFinite(parsed.getTime())) return date
  if (period === 'monthly') return date.slice(0, 7)
  const day = parsed.getUTCDay() || 7
  parsed.setUTCDate(parsed.getUTCDate() - day + 1)
  return parsed.toISOString().slice(0, 10)
}

function aggregatePeriod(points: IndexPoint[], period: Period) {
  const groups = new Map<string, IndexPoint[]>()
  points.forEach((point) => {
    const key = periodKey(point.date, period)
    groups.set(key, [...(groups.get(key) ?? []), point])
  })
  return [...groups.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([date, values]) => {
    const observations = values.reduce((sum, point) => sum + point.observations, 0)
    const averageFare = values.reduce((sum, point) => sum + point.averageFare * point.observations, 0) / observations
    return { date, averageFare, observations, apix: values.reduce((sum, point) => sum + point.apix * point.observations, 0) / observations }
  })
}

function Section({ title, theme, children, action }: { title: string; theme: 'dark' | 'light'; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className={`my-4 min-w-0 rounded-[28px] border p-4 shadow-[0_18px_60px_rgba(15,23,42,0.06)] sm:p-5 lg:p-6 ${theme === 'dark' ? 'border-white/10 bg-white/[0.035]' : 'border-slate-200/80 bg-white'}`}>
      <div className={`mb-4 flex flex-wrap items-center justify-between gap-3 border-b pb-3 sm:mb-5 ${theme === 'dark' ? 'border-white/10' : 'border-slate-200'}`}>
        <h2 className={`text-lg font-bold sm:text-xl ${theme === 'dark' ? 'text-white' : 'text-slate-950'}`}>{title}</h2>
        {action}
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  )
}

function ChartTooltip({ active, payload, label, mode = 'index' }: { active?: boolean; payload?: Array<{ value?: number; payload?: IndexPoint }>; label?: string; mode?: 'index' | 'fare' }) {
  if (!active || !payload?.length) return null
  const point = payload[0]?.payload
  return (
    <div className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-lg">
      <p className="font-semibold">{label}</p>
      {mode === 'index' ? <p>APIx: {Number(payload[0]?.value).toFixed(1)}</p> : <p>Average fare: {currency(Number(payload[0]?.value))}</p>}
      <p>Verified observations: {point?.observations ?? 0}</p>
    </div>
  )
}

export function AirfareIndexPage({ theme }: AirfareIndexPageProps) {
  const { data, fareHistoryObservations } = useSearchState()
  const [dateRange, setDateRange] = useState<DateRange>('All')
  const [period, setPeriod] = useState<Period>('daily')
  const [selectedWindow, setSelectedWindow] = useState<number>(1)
  const input = data?.input
  const offers = useMemo(() => {
    if (!input || !data || !['live_success', 'duffel_success'].includes(data.result.status)) return []
    return data.result.offers.filter((offer) => isVerified(offer, input.origin, input.destination, input.travelDate))
  }, [data, input])

  if (!input || !offers.length || !data) return <EmptyFareState theme={theme} />

  const route = `${input.origin} → ${input.destination}`
  const routeObservations = fareHistoryObservations.filter((observation) =>
    observation.origin === input.origin && observation.destination === input.destination && observation.travelDate === input.travelDate &&
    Number.isFinite(Date.parse(observation.collectedAt)) && Number.isFinite(observation.fare) && observation.fare > 0,
  )
  const observationById = new Map(routeObservations.map((observation) => [observation.id, observation]))
  offers.forEach((offer) => {
    const fare = fareOf(offer)
    if (fare === null) return
    const id = `${input.origin}|${input.destination}|${input.travelDate}|${offer.offerId}|${offer.collectedAt}`
    observationById.set(id, { id, origin: input.origin, destination: input.destination, travelDate: input.travelDate, collectedAt: offer.collectedAt, airline: offer.airline, flightNumber: offer.flightNumber, fare, currency: offer.currency })
  })
  const observations = [...observationById.values()].sort((left, right) => left.collectedAt.localeCompare(right.collectedAt))
  const rawPoints = groupByDate(observations.map(({ collectedAt, fare }) => ({ collectedAt, fare })))
  const baselineFare = rawPoints[0]?.averageFare ?? null
  const dailyIndex: IndexPoint[] = baselineFare && baselineFare > 0
    ? rawPoints.map((point) => ({ ...point, apix: point.averageFare / baselineFare * 100 }))
    : []
  const periodPoints = aggregatePeriod(dailyIndex, period)
  const latestDate = dailyIndex.at(-1)?.date
  const rangeDays = dateRange === '7D' ? 7 : dateRange === '30D' ? 30 : dateRange === '90D' ? 90 : null
  const visiblePoints = rangeDays && latestDate
    ? periodPoints.filter((point) => (Date.parse(`${latestDate}T00:00:00Z`) - Date.parse(`${point.date}T00:00:00Z`)) / 86_400_000 < rangeDays)
    : periodPoints
  const currentApix = dailyIndex.at(-1)?.apix ?? null
  const previousDay = dailyIndex.length > 1 ? dailyIndex[dailyIndex.length - 2] : null
  const firstOfWeek = dailyIndex.find((point) => latestDate && (Date.parse(`${latestDate}T00:00:00Z`) - Date.parse(`${point.date}T00:00:00Z`)) / 86_400_000 <= 7)
  const firstOfMonth = dailyIndex.find((point) => latestDate && point.date.slice(0, 7) === latestDate.slice(0, 7))
  const percentChange = (from: IndexPoint | null | undefined, to: IndexPoint | undefined) => from && to && from.date !== to.date && from.apix > 0 ? (to.apix / from.apix - 1) * 100 : null
  const dailyChange = percentChange(previousDay, dailyIndex.at(-1))
  const weeklyChange = percentChange(firstOfWeek, dailyIndex.at(-1))
  const monthlyChange = percentChange(firstOfMonth, dailyIndex.at(-1))
  const latest = offers.reduce((value, offer) => offer.collectedAt > value ? offer.collectedAt : value, offers[0]!.collectedAt)
  const currencyCode = offers[0]?.currency ?? 'INR'
  const fares = offers.map(fareOf).filter((fare): fare is number => fare !== null)
  const windowObservations = observations.filter((observation) => {
    const travelDate = Date.parse(`${observation.travelDate}T00:00:00Z`)
    const collectionDate = Date.parse(`${observation.collectedAt.slice(0, 10)}T00:00:00Z`)
    return Number.isFinite(travelDate) && Number.isFinite(collectionDate) && (travelDate - collectionDate) / 86_400_000 === selectedWindow
  })
  const demoWindowObservations = demoData.fareObservations
    .filter((observation) => observation.advancePurchaseDays === selectedWindow && Number.isFinite(observation.totalFare))
    .map((observation) => ({
      id: observation.id,
      origin: observation.origin,
      destination: observation.destination,
      travelDate: observation.travelDate,
      collectedAt: `${observation.collectionDate}T12:00:00.000Z`,
      airline: observation.airline,
      flightNumber: observation.flightNumber,
      fare: observation.totalFare,
      currency: observation.currency,
    }))
  const isDemoWindow = windowObservations.length === 0
  const displayedWindowObservations = isDemoWindow ? demoWindowObservations : windowObservations
  const windowCurrencyCode = isDemoWindow ? 'INR' : currencyCode
  const windowFares = displayedWindowObservations.map((observation) => observation.fare).sort((left, right) => left - right)
  const averageWindowFare = windowFares.length ? windowFares.reduce((sum, fare) => sum + fare, 0) / windowFares.length : null
  const windowMedian = windowFares.length ? windowFares.length % 2 ? windowFares[Math.floor(windowFares.length / 2)] : ((windowFares[windowFares.length / 2 - 1] ?? 0) + (windowFares[windowFares.length / 2] ?? 0)) / 2 : null
  const routeIndex = currentApix
  const sourceGroups = new Map<string, FlightOffer[]>()
  offers.forEach((offer) => sourceGroups.set(offer.source, [...(sourceGroups.get(offer.source) ?? []), offer]))
  const quality = data.quality
  const shell = theme === 'dark' ? 'border-white/10 bg-slate-900/60' : 'border-slate-200 bg-white'
  const text = theme === 'dark' ? 'text-white' : 'text-slate-950'
  const muted = theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
  const gridColor = theme === 'dark' ? '#334155' : '#e2e8f0'
  const tickColor = theme === 'dark' ? '#cbd5e1' : '#475569'
  const tile = theme === 'dark' ? 'border-white/10 bg-slate-950/45' : 'border-slate-200 bg-slate-50'

  const kpis = [
    { label: 'Current APIx', value: currentApix === null ? INSUFFICIENT : currentApix.toFixed(1), detail: baselineFare ? `Base: 100 · ${formatDate(dailyIndex[0]!.date)}` : 'Base unavailable', primary: true },
    { label: 'Daily change', value: dailyChange === null ? `+${demoData.currentApiX.dailyChange.toFixed(1)}%` : `${dailyChange > 0 ? '+' : ''}${dailyChange.toFixed(1)}%`, detail: dailyChange === null ? 'Demo preview · from previous observed date' : 'From previous observed date' },
    { label: 'Weekly change', value: weeklyChange === null ? `${demoData.currentApiX.weeklyChange.toFixed(1)}%` : `${weeklyChange.toFixed(1)}%`, detail: weeklyChange === null ? 'Demo preview · from first observed week point' : 'From first observed week point' },
    { label: 'Monthly change', value: monthlyChange === null ? `${demoData.currentApiX.monthlyChange.toFixed(1)}%` : `${monthlyChange.toFixed(1)}%`, detail: monthlyChange === null ? 'Demo preview · current calendar month' : 'Current calendar month' },
    { label: 'Verified observations', value: observations.length.toLocaleString('en-IN'), detail: 'Actual verified fares' },
    { label: 'Routes in basket', value: new Set(observations.map((observation) => `${observation.origin}-${observation.destination}`)).size.toLocaleString('en-IN'), detail: 'Observed verified routes' },
  ]

  return (
    <main className={`min-h-screen py-6 sm:py-9 ${theme === 'dark' ? 'bg-slate-950' : 'bg-slate-50'}`}>
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className={`rounded-[32px] border p-4 shadow-[0_18px_60px_rgba(15,23,42,0.08)] sm:p-5 lg:p-7 ${theme === 'dark' ? 'border-white/10 bg-white/5' : 'border-slate-200/70 bg-white'}`}>
          <header className={`mb-5 border-b pb-5 ${theme === 'dark' ? 'border-white/10' : 'border-slate-200'}`}>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className={`text-xs font-bold uppercase tracking-[0.2em] ${theme === 'dark' ? 'text-teal-300' : 'text-teal-700'}`}>Market dashboard</p>
                <h1 className={`mt-2 text-3xl font-bold sm:text-4xl ${text}`}>Airfare Price Index</h1>
                <p className={`mt-2 text-base font-semibold ${muted}`}>{route} · {formatDate(input.travelDate)}</p>
              </div>
              <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold ${theme === 'dark' ? 'border-teal-300/30 bg-teal-300/10 text-teal-200' : 'border-teal-200 bg-teal-50 text-teal-700'}`}>
                <span className="h-2 w-2 rounded-full bg-emerald-500" /> Verified live search
              </span>
            </div>
          </header>

        <section aria-label="Index summary" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
          {kpis.map((item) => (
            <div key={item.label} className={`flex min-h-[140px] flex-col justify-between rounded-[26px] border p-4 shadow-sm transition-transform duration-200 hover:-translate-y-0.5 sm:p-5 ${item.primary ? `sm:col-span-2 lg:col-span-1 2xl:col-span-2 ${theme === 'dark' ? 'border-teal-300 bg-teal-300' : 'border-teal-400 bg-teal-200'}` : `${shell} ${theme === 'dark' ? 'bg-slate-900/60' : 'bg-slate-50'}`}`}>
              <p className={`text-[11px] font-semibold uppercase ${item.primary ? 'text-slate-800' : muted}`}>{item.label}</p>
              <p className={`mt-3 break-words font-bold tabular-nums ${item.primary ? 'text-4xl text-black sm:text-5xl' : `text-xl ${text}`}`}>{item.value}</p>
              <p className={`mt-2 text-xs ${item.primary ? 'text-slate-800' : muted}`}>{item.primary && latest ? `Last updated: ${formatTime(latest)}` : item.detail}</p>
            </div>
          ))}
        </section>

        <Section title="Airfare Price Index History" theme={theme} action={<div className="flex flex-wrap gap-1 rounded-lg border p-1"><div className="flex gap-1">{(['7D', '30D', '90D', 'All'] as const).map((range) => <button key={range} type="button" onClick={() => setDateRange(range)} className={`rounded-md px-2.5 py-1.5 text-xs font-semibold ${dateRange === range ? 'bg-teal-700 text-white' : muted}`}>{range}</button>)}</div><span className="mx-1 hidden w-px bg-slate-300 sm:block" /><div className="flex gap-1">{(['daily', 'weekly', 'monthly'] as const).map((value) => <button key={value} type="button" onClick={() => setPeriod(value)} className={`rounded-md px-2.5 py-1.5 text-xs font-semibold capitalize ${period === value ? 'bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-950' : muted}`}>{value}</button>)}</div></div>}>
          <div className={`rounded-[28px] border p-4 shadow-sm sm:p-5 ${theme === 'dark' ? 'border-white/10 bg-slate-900/60' : 'border-slate-200 bg-slate-50'}`}>
            <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
              <div><p className={`text-sm font-semibold ${muted}`}>Daily APIx · base 100</p><p className={`mt-1 text-xs ${muted}`}>{visiblePoints.length} observed period{visiblePoints.length === 1 ? '' : 's'} · no interpolated dates</p></div>
              <p className={`text-xs ${muted}`}>Base period: {dailyIndex[0] ? formatDate(dailyIndex[0].date) : INSUFFICIENT}</p>
            </div>
            {visiblePoints.length ? <div className="h-72 min-w-0 sm:h-96"><ResponsiveContainer width="100%" height="100%"><AreaChart data={visiblePoints} margin={{ top: 10, right: 12, bottom: 8, left: 8 }}><defs><linearGradient id="apix-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#0f766e" stopOpacity={0.28} /><stop offset="100%" stopColor="#0f766e" stopOpacity={0.02} /></linearGradient></defs><CartesianGrid stroke={gridColor} strokeDasharray="3 3" /><XAxis dataKey="date" tick={{ fill: tickColor, fontSize: 11 }} tickFormatter={(date: string) => date.slice(5)} /><YAxis domain={['auto', 'auto']} tick={{ fill: tickColor, fontSize: 11 }} /><ReferenceLine y={100} stroke="#d49b32" strokeDasharray="6 4" label={{ value: 'Base 100', fill: '#d49b32', position: 'insideTopRight', fontSize: 11 }} /><Tooltip content={<ChartTooltip />} cursor={{ stroke: '#0f766e', strokeDasharray: '4 4' }} /><Area type="monotone" dataKey="apix" name="APIx" stroke="#0f766e" strokeWidth={2.5} fill="url(#apix-fill)" activeDot={{ r: 6 }} /></AreaChart></ResponsiveContainer></div> : <p className={`grid h-72 place-items-center text-sm ${muted}`}>{INSUFFICIENT}</p>}
            {visiblePoints.length === 1 ? <p className={`mt-3 text-sm ${muted}`}>One actual collection date is available. More verified collections are needed to establish a trend.</p> : null}
          </div>
        </Section>

        <Section title="Representative Route Basket" theme={theme}>
          <div className={`overflow-x-auto rounded-[24px] border ${shell}`}>
            <table className={`w-full min-w-[760px] text-left text-sm ${text}`}>
              <thead className={theme === 'dark' ? 'bg-slate-800/80 text-slate-300' : 'bg-slate-100 text-slate-600'}><tr>{['Route', 'Weight', 'Current Fare', 'Route Index', 'Observations', 'Status'].map((label) => <th key={label} className="px-4 py-3 text-xs font-semibold uppercase">{label}</th>)}</tr></thead>
              <tbody><tr className={`border-t ${theme === 'dark' ? 'border-white/10' : 'border-slate-200'}`}><td className="px-4 py-4 font-semibold">{route}</td><td className={`px-4 py-4 ${muted}`}>Configurable route weights</td><td className="px-4 py-4">{fares.length ? currency(Math.min(...fares), currencyCode) : INSUFFICIENT}</td><td className="px-4 py-4">{routeIndex === null ? INSUFFICIENT : routeIndex.toFixed(1)}</td><td className="px-4 py-4">{observations.length}</td><td className="px-4 py-4"><span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-600">Verified</span></td></tr></tbody>
            </table>
          </div>
          <p className={`mt-2 text-xs ${muted}`}>Route weights are not presented as official; no validated configured weights are available.</p>
        </Section>

        <Section title="Route Contribution to APIx" theme={theme}>
          <div className={`rounded-[24px] border p-4 shadow-sm sm:p-5 ${theme === 'dark' ? 'border-white/10 bg-slate-900/60' : 'border-slate-200 bg-slate-50'}`}>
            <p className={`mb-3 text-xs font-semibold ${muted}`}>Demo preview · illustrative weighted index-point contribution · backend/test.json</p>
            <div className="h-[420px] min-w-0"><ResponsiveContainer width="100%" height="100%"><BarChart data={demoRouteContributions} layout="vertical" margin={{ top: 4, right: 16, bottom: 4, left: 8 }}><CartesianGrid stroke={gridColor} strokeDasharray="3 3" /><XAxis type="number" tick={{ fill: tickColor, fontSize: 10 }} tickFormatter={(value: number) => value.toFixed(1)} /><YAxis type="category" dataKey="route" width={82} tick={{ fill: tickColor, fontSize: 10 }} /><ReferenceLine x={0} stroke={tickColor} /><Tooltip formatter={(value) => [`${Number(value).toFixed(2)} index points`, 'Weighted contribution']} /><Bar dataKey="contribution" name="Contribution" fill="#0f766e" radius={[0, 3, 3, 0]} /></BarChart></ResponsiveContainer></div>
            <p className={`mt-3 text-xs ${muted}`}>Contribution = (route index - base index) x route weight. These illustrative weights are not official.</p>
          </div>
        </Section>

        <Section title="Fare Movement by Advance-Purchase Window" theme={theme} action={<div className="flex flex-wrap gap-1">{WINDOWS.map((windowDays) => <button key={windowDays} type="button" onClick={() => setSelectedWindow(windowDays)} className={`rounded-md border px-3 py-1.5 text-xs font-semibold ${selectedWindow === windowDays ? 'border-teal-700 bg-teal-700 text-white' : `${shell} ${muted}`}`}>T+{windowDays}</button>)}</div>}>
          <div className={`rounded-[28px] border p-4 shadow-sm sm:p-5 ${theme === 'dark' ? 'border-white/10 bg-slate-900/60' : 'border-slate-200 bg-slate-50'}`}>
            <p className={`mb-3 text-xs font-semibold ${muted}`}>{isDemoWindow ? 'Demo preview · sample fares from backend/test.json' : 'Verified live observations'}</p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">{[['Observations', String(displayedWindowObservations.length)], ['Average fare', averageWindowFare === null ? INSUFFICIENT : currency(averageWindowFare, windowCurrencyCode)], ['Median fare', windowMedian === null ? INSUFFICIENT : currency(windowMedian, windowCurrencyCode)], ['Minimum', windowFares.length ? currency(windowFares[0]!, windowCurrencyCode) : INSUFFICIENT], ['Maximum', windowFares.length ? currency(windowFares.at(-1)!, windowCurrencyCode) : INSUFFICIENT]].map(([label, value]) => <div key={label} className={`rounded-lg border p-3 ${tile}`}><p className={`text-[10px] font-semibold uppercase ${muted}`}>{label}</p><p className={`mt-2 break-words text-sm font-bold ${text}`}>{value}</p></div>)}</div>
            <div className="mt-4 h-64 min-w-0">{windowFares.length ? <ResponsiveContainer width="100%" height="100%"><ComposedChart data={displayedWindowObservations.map((observation) => ({ date: observation.collectedAt, fare: observation.fare }))}><CartesianGrid stroke={gridColor} strokeDasharray="3 3" /><XAxis dataKey="date" tick={{ fill: tickColor, fontSize: 10 }} tickFormatter={(date: string) => date.slice(5, 16)} /><YAxis tick={{ fill: tickColor, fontSize: 10 }} tickFormatter={(value: number) => currency(value, windowCurrencyCode)} /><Tooltip formatter={(value) => [currency(Number(value), windowCurrencyCode), isDemoWindow ? 'Demo fare' : 'Verified fare']} /><Bar dataKey="fare" fill="#d49b32" radius={[3, 3, 0, 0]} /><Line type="monotone" dataKey="fare" stroke="#0f766e" dot={{ r: 3 }} /></ComposedChart></ResponsiveContainer> : <div className={`grid h-full place-items-center rounded-lg border border-dashed px-4 text-center text-sm ${muted}`}>Insufficient observations for this window.</div>}</div>
          </div>
        </Section>

        <Section title="APIx vs DGCA Benchmark" theme={theme}>
          <div className={`rounded-[28px] border p-4 shadow-sm sm:p-5 ${theme === 'dark' ? 'border-white/10 bg-slate-900/60' : 'border-slate-200 bg-slate-50'}`}>
            <div className="flex flex-wrap gap-4 text-sm"><span className="inline-flex items-center gap-2"><i className="h-2.5 w-5 rounded bg-teal-700" />APIx</span><span className="inline-flex items-center gap-2"><i className="h-2.5 w-5 rounded bg-amber-500" />DGCA Benchmark</span></div>
            <p className={`mt-3 text-xs font-semibold ${muted}`}>Simulated demo backtest · backend/test.json</p>
            <div className="mt-2 h-64 min-w-0"><ResponsiveContainer width="100%" height="100%"><LineChart data={demoBacktestSeries} margin={{ top: 8, right: 16, bottom: 4, left: 4 }}><CartesianGrid stroke={gridColor} strokeDasharray="3 3" /><XAxis dataKey="period" tick={{ fill: tickColor, fontSize: 10 }} /><YAxis domain={['dataMin - 5', 'dataMax + 5']} tick={{ fill: tickColor, fontSize: 10 }} /><Tooltip formatter={(value, name) => [Number(value).toFixed(1), String(name)]} /><Line type="monotone" dataKey="apix" name="APIx demo" stroke="#0f766e" strokeWidth={2.5} dot={{ r: 4 }} /><Line type="monotone" dataKey="benchmark" name="DGCA benchmark demo" stroke="#d49b32" strokeWidth={2.5} dot={{ r: 4 }} /></LineChart></ResponsiveContainer></div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{[['MAE', `${demoData.dgcaBacktest.metrics.mae.toFixed(2)} index points`], ['RMSE', `${demoData.dgcaBacktest.metrics.rmse.toFixed(2)} index points`], ['MAPE', `${demoData.dgcaBacktest.metrics.mape.toFixed(2)}%`], ['Correlation', demoData.dgcaBacktest.metrics.correlation.toFixed(2)]].map(([label, value]) => <div key={label} className={`rounded-lg border p-3 ${tile}`}><p className={`text-[10px] font-semibold uppercase ${muted}`}>{label}</p><p className={`mt-2 text-lg font-bold ${text}`}>{value}</p></div>)}</div>
          </div>
        </Section>

        <Section title="Data Quality" theme={theme}>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{[['Raw records', quality.rawRecords], ['Cleaned records', quality.cleanedRecords], ['Eligible records', offers.length], ['Rejected records', quality.rejectedRecords ?? null], ['Duplicates', quality.duplicateRecords], ['Missing fields', quality.missingFieldRecords], ['Outliers', quality.outlierRecords], ['Sources', sourceGroups.size]].map(([label, value]) => <div key={String(label)} className={`rounded-2xl border p-4 shadow-sm ${theme === 'dark' ? 'border-white/10 bg-slate-900/60' : 'border-slate-200 bg-slate-50'}`}><p className={`text-2xl font-bold tabular-nums ${text}`}>{typeof value === 'number' ? value.toLocaleString('en-IN') : INSUFFICIENT}</p><p className={`mt-1 text-xs ${muted}`}>{label}</p></div>)}</div>
        </Section>

        <details className={`mb-6 rounded-[24px] border shadow-sm ${shell}`}>
          <summary className={`flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-4 font-semibold ${text}`}><span>Index Methodology</span><ChevronDown size={17} /></summary>
          <div className={`grid gap-3 border-t p-4 text-sm sm:grid-cols-2 ${theme === 'dark' ? 'border-white/10 text-slate-300' : 'border-slate-200 text-slate-700'}`}>
            <p><strong>Base period:</strong> {dailyIndex[0] ? formatDate(dailyIndex[0].date) : INSUFFICIENT}</p><p><strong>Base index:</strong> 100 for the first observed period</p>
            <p><strong>Route basket:</strong> {route}</p><p><strong>Route weights:</strong> Configurable; official weights unavailable</p>
            <p><strong>Fare eligibility:</strong> Positive verified total fare, exact requested route/date, connected segments and schedule</p><p><strong>Normalization:</strong> Display currency returned by the verified Flight Search result</p>
            <p><strong>Deduplication:</strong> Search offer identity retained from verified search observations</p><p><strong>Outliers:</strong> No additional index-specific treatment</p>
            <p><strong>Missing data:</strong> Not interpolated or imputed</p><p><strong>Cancelled/sold-out:</strong> Only offers returned as verified are included</p>
            <p><strong>Advance-purchase:</strong> Booking-window classification is unavailable in this search dataset</p><p><strong>Weighted index:</strong> Not calculated without validated route weights</p>
          </div>
        </details>

        <Section title="Verified Data Sources" theme={theme}>
          <div className={`overflow-x-auto rounded-[24px] border ${shell}`}><table className={`w-full min-w-[600px] text-left text-sm ${text}`}><thead className={theme === 'dark' ? 'bg-slate-800/80 text-slate-300' : 'bg-slate-100 text-slate-600'}><tr>{['Source', 'Observations', 'Last successful collection', 'Status'].map((label) => <th key={label} className="px-4 py-3 text-xs font-semibold uppercase">{label}</th>)}</tr></thead><tbody>{[...sourceGroups.entries()].map(([source, sourceOffers]) => <tr key={source} className={`border-t ${theme === 'dark' ? 'border-white/10' : 'border-slate-200'}`}><td className="px-4 py-3 font-semibold">{source}</td><td className="px-4 py-3">{sourceOffers.length}</td><td className="px-4 py-3">{formatTime(sourceOffers.map((offer) => offer.collectedAt).sort().at(-1))}</td><td className="px-4 py-3"><span className="rounded-full bg-emerald-500/10 px-2 py-1 text-xs font-semibold text-emerald-600">Verified</span></td></tr>)}</tbody></table></div>
        </Section>

        <Section title="Live Route Map" theme={theme}>
          <RouteMap origin={input.origin} destination={input.destination} theme={theme} routeLabel={`${route} · ${formatDate(input.travelDate)}`} airline={offers[0]?.airline} flightNumber={offers[0]?.flightNumber} fare={fares.length ? currency(Math.min(...fares), currencyCode) : undefined} travelDate={input.travelDate} searchedAt={latest} />
          <p className={`mt-3 flex items-center gap-2 text-sm ${muted}`}><MapPinned size={15} /> Map shows the searched origin and destination only.</p>
        </Section>
        </div>
      </div>
    </main>
  )
}
