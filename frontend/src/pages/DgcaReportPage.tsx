import { useEffect, useMemo, useState } from 'react'
import { BarChart3, FileText } from 'lucide-react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { fetchDgcaAnalytics } from '@/services/fareApi'
import type { DgcaAnalyticsResponse } from '@/types/fare'

const INSUFFICIENT_DATA = 'Insufficient DGCA data available for this analysis.'
const EMPTY_DGCA_DATA: DgcaAnalyticsResponse = {
  available: false,
  source: 'DGCA-DATA.pdf',
  report: null,
  monthlyPassengerLoadFactors: [],
  fareObservations: [],
  fareAnalysisMessage: INSUFFICIENT_DATA,
}

type DgcaReportPageProps = {
  theme: 'dark' | 'light'
}

function formatMonth(value: string) {
  const [year, month] = value.split('-').map(Number)
  return new Intl.DateTimeFormat('en', { month: 'short', year: '2-digit', timeZone: 'UTC' })
    .format(new Date(Date.UTC(year, month - 1, 1)))
}

function InfoPanel({ title, theme }: { title: string; theme: 'dark' | 'light' }) {
  return (
    <section className={`min-w-0 border-t px-5 py-5 first:border-t-0 ${theme === 'dark' ? 'border-white/10' : 'border-slate-200'}`}>
      <h3 className="text-sm font-semibold">{title}</h3>
      <p className={`mt-2 text-sm leading-6 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>
        {INSUFFICIENT_DATA}
      </p>
      <p className={`mt-2 text-xs ${theme === 'dark' ? 'text-slate-500' : 'text-slate-500'}`}>
        Source: DGCA-DATA.pdf
      </p>
    </section>
  )
}

export function DgcaReportPage({ theme }: DgcaReportPageProps) {
  const [data, setData] = useState<DgcaAnalyticsResponse | null>(null)
  const [selectedAirline, setSelectedAirline] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    fetchDgcaAnalytics()
      .then((result) => {
        if (!active) return
        setData(result)
        setSelectedAirline(result.monthlyPassengerLoadFactors[0]?.airline ?? '')
      })
      .catch(() => {
        if (active) {
          setData(EMPTY_DGCA_DATA)
          setError(INSUFFICIENT_DATA)
        }
      })

    return () => {
      active = false
    }
  }, [])

  const observations = data?.monthlyPassengerLoadFactors ?? []
  const airlines = useMemo(() => [...new Set(observations.map((item) => item.airline))], [observations])
  const chartData = observations
    .filter((item) => item.airline === selectedAirline)
    .sort((left, right) => left.month.localeCompare(right.month))
    .map((item) => ({ month: item.month, label: formatMonth(item.month), percent: item.percent }))
  const months = [...new Set(observations.map((item) => item.month))].sort()

  return (
    <section className={`py-10 ${theme === 'dark' ? 'bg-slate-950 text-white' : 'bg-slate-50 text-slate-950'}`}>
      <div className="mx-auto w-full max-w-7xl space-y-6 px-4 sm:px-6 lg:px-8">
        <header className={`rounded-2xl border p-6 sm:p-8 ${theme === 'dark' ? 'border-white/10 bg-slate-900' : 'border-slate-200 bg-white'}`}>
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className={`text-xs font-semibold uppercase tracking-[0.18em] ${theme === 'dark' ? 'text-teal-200' : 'text-teal-700'}`}>
                DGCA historical analysis
              </p>
              <h1 className="mt-3 text-3xl font-bold">Domestic aviation report</h1>
              <p className={`mt-2 max-w-2xl text-sm leading-6 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>
                Historical observations are kept separate from current Flight Search offers.
              </p>
            </div>
            <div className={`inline-flex items-center gap-2 self-start rounded-lg border px-3 py-2 text-sm font-medium ${theme === 'dark' ? 'border-white/10 bg-slate-950 text-slate-200' : 'border-slate-200 bg-slate-50 text-slate-700'}`}>
              <FileText size={16} />
              Source: DGCA-DATA.pdf
            </div>
          </div>
          <div className={`mt-6 grid gap-4 border-t pt-5 sm:grid-cols-3 ${theme === 'dark' ? 'border-white/10' : 'border-slate-200'}`}>
            <div>
              <p className="text-xs text-slate-500">Reporting month</p>
              <p className="mt-1 font-semibold">{data?.report?.reportingMonthLabel ?? (data ? 'Unavailable' : 'Loading')}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Observed period</p>
              <p className="mt-1 font-semibold">{months.length ? `${formatMonth(months[0] ?? '')} – ${formatMonth(months.at(-1) ?? '')}` : INSUFFICIENT_DATA}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Actual traffic observations</p>
              <p className="mt-1 font-semibold">{observations.length || (data ? '0' : 'Loading')}</p>
            </div>
          </div>
          {error ? <p className="mt-4 text-sm text-amber-700 dark:text-amber-300">{error}</p> : null}
        </header>

        <section className={`rounded-2xl border p-5 sm:p-6 ${theme === 'dark' ? 'border-white/10 bg-slate-900' : 'border-slate-200 bg-white'}`}>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <BarChart3 size={18} className={theme === 'dark' ? 'text-teal-200' : 'text-teal-700'} />
                <p className="text-xs font-semibold uppercase tracking-[0.16em]">Passenger load factor</p>
              </div>
              <h2 className="mt-2 text-xl font-bold">Monthly airline observations</h2>
              <p className={`mt-1 text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
                The report contains monthly values from January through August 2026, not daily fare observations.
              </p>
            </div>
            {airlines.length ? (
              <label className="flex items-center gap-3 text-sm">
                <span className="text-slate-500">Airline</span>
                <select
                  value={selectedAirline}
                  onChange={(event) => setSelectedAirline(event.target.value)}
                  className={`min-w-44 rounded-lg border px-3 py-2 ${theme === 'dark' ? 'border-white/10 bg-slate-950 text-white' : 'border-slate-200 bg-white text-slate-900'}`}
                >
                  {airlines.map((airline) => <option key={airline} value={airline}>{airline}</option>)}
                </select>
              </label>
            ) : null}
          </div>
          {chartData.length ? (
            <div className="mt-5 h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 12, right: 16, left: 4, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 4" stroke={theme === 'dark' ? '#334155' : '#dbe3eb'} vertical={false} />
                  <XAxis dataKey="label" tick={{ fill: theme === 'dark' ? '#cbd5e1' : '#475569', fontSize: 12 }} />
                  <YAxis domain={[0, 100]} tickFormatter={(value) => `${value}%`} tick={{ fill: theme === 'dark' ? '#cbd5e1' : '#475569', fontSize: 12 }} />
                  <Tooltip formatter={(value) => [`${value}%`, 'Passenger load factor']} />
                  <Line type="linear" dataKey="percent" name="Passenger load factor" stroke="#0f9f91" strokeWidth={2.5} dot={{ r: 4 }} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className={`mt-5 rounded-lg border border-dashed p-6 text-center text-sm ${theme === 'dark' ? 'border-white/10 text-slate-400' : 'border-slate-300 text-slate-600'}`}>
              {INSUFFICIENT_DATA}
            </p>
          )}
          <p className={`mt-3 text-xs ${theme === 'dark' ? 'text-slate-500' : 'text-slate-500'}`}>Source: DGCA-DATA.pdf</p>
          {observations.length ? (
            <div className={`mt-4 overflow-x-auto rounded-lg border ${theme === 'dark' ? 'border-white/10' : 'border-slate-200'}`}>
              <table className="min-w-full text-left text-sm">
                <thead className={theme === 'dark' ? 'bg-slate-950 text-slate-300' : 'bg-slate-50 text-slate-600'}>
                  <tr>
                    <th className="px-4 py-3 font-semibold">Airline</th>
                    {months.map((month) => <th key={month} className="px-4 py-3 text-right font-semibold">{formatMonth(month)}</th>)}
                  </tr>
                </thead>
                <tbody className={theme === 'dark' ? 'divide-y divide-white/10' : 'divide-y divide-slate-100'}>
                  {airlines.map((airline) => (
                    <tr key={airline}>
                      <th className="px-4 py-3 font-medium">{airline}</th>
                      {months.map((month) => {
                        const observation = observations.find((item) => item.airline === airline && item.month === month)
                        return <td key={month} className="px-4 py-3 text-right tabular-nums">{observation ? `${observation.percent.toFixed(1)}%` : '—'}</td>
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </section>

        <section className={`overflow-hidden rounded-2xl border ${theme === 'dark' ? 'border-white/10 bg-slate-900' : 'border-slate-200 bg-white'}`}>
          <div className={`border-b px-5 py-4 ${theme === 'dark' ? 'border-white/10' : 'border-slate-200'}`}>
            <h2 className="text-lg font-bold">30-day fare analysis</h2>
            <p className={`mt-1 text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
              This PDF reports airline traffic and load factors; it does not provide dated route fares.
            </p>
          </div>
          <InfoPanel title="Price history · 30 days / Fare trend over time / Average price by date" theme={theme} />
          <InfoPanel title="30-day fare movement / Lowest / Highest / Average / Spread / Price change" theme={theme} />
          <InfoPanel title="DGCA fare benchmark / Backtest / Historical Airfare Index / Route-level fares" theme={theme} />
        </section>
      </div>
    </section>
  )
}