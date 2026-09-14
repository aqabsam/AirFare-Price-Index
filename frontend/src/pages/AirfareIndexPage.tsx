import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { ArrowRight, BarChart3, CalendarDays } from 'lucide-react'
import { fetchAirfareIndex } from '@/services/fareApi'
import { RouteFilterPanel, type RouteFilterValue } from '@/components/RouteFilterPanel'
import type { FareRouteSummary } from '@/types/fare'

type AirfareIndexPageProps = {
  theme: 'dark' | 'light'
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value)
}

export function AirfareIndexPage({ theme }: AirfareIndexPageProps) {
  const [routes, setRoutes] = useState<FareRouteSummary[]>([])
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

    async function loadIndex() {
      setLoading(true)
      setError('')

      try {
        const payload = await fetchAirfareIndex(appliedFilters)
        if (active) {
          setRoutes(payload.routes ?? [])
        }
      } catch (error) {
        if (active) {
          setError(error instanceof Error ? error.message : 'Unable to load airfare index.')
        }
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    void loadIndex()

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

  const sortedRoutes = useMemo(() => [...routes].sort((left, right) => right.airfareIndex - left.airfareIndex), [routes])
  const baseRoute = sortedRoutes[sortedRoutes.length - 1] ?? null
  const currentRoute = sortedRoutes[0] ?? null
  const maxIndex = Math.max(...sortedRoutes.map((route) => route.airfareIndex), 100)

  return (
    <section className={`py-10 ${theme === 'dark' ? 'bg-slate-950' : 'bg-slate-50'}`}>
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div
          className={`overflow-hidden rounded-[32px] border shadow-[0_18px_60px_rgba(15,23,42,0.08)] ${
            theme === 'dark' ? 'border-white/10 bg-white/5 text-white' : 'border-slate-200/70 bg-white text-slate-950'
          }`}
        >
          <div className="grid gap-8 p-6 lg:grid-cols-[1.05fr_0.95fr] lg:p-8 xl:p-10">
            <div>
              <p className={`text-sm font-semibold tracking-[0.24em] uppercase ${theme === 'dark' ? 'text-teal-200' : 'text-teal-700'}`}>
                Airfare Index
              </p>
              <h1 className={`mt-3 text-4xl font-bold sm:text-5xl ${theme === 'dark' ? 'text-white' : 'text-slate-950'}`}>
                Overall index, movement, and base-period comparison.
              </h1>
              <p className={`mt-4 max-w-2xl text-base leading-8 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>
                The index is calculated from the fares stored in the backend, so the chart and summary always reflect
                the current collected route sample.
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

              <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {[
                  { label: 'Index level', value: currentRoute ? String(currentRoute.airfareIndex) : 'N/A', tone: 'text-teal-400' },
                  { label: 'Base period', value: '100.0', tone: 'text-sky-300' },
                  { label: 'Sample routes', value: String(routes.length), tone: 'text-emerald-300' },
                  { label: 'Latest carrier', value: currentRoute?.topCarrier ?? 'N/A', tone: 'text-amber-300' },
                ].map((item) => (
                  <div
                    key={item.label}
                    className={`rounded-3xl border p-4 ${theme === 'dark' ? 'border-white/10 bg-slate-950/60' : 'border-slate-200 bg-slate-50'}`}
                  >
                    <p className={`text-xs font-semibold uppercase tracking-[0.22em] ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                      {item.label}
                    </p>
                    <p className={`mt-2 text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-950'}`}>
                      {item.value}
                    </p>
                    <p className={`mt-1 text-sm font-medium ${item.tone}`}>Headline metric</p>
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
                  href="#comparison"
                  className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition hover:-translate-y-0.5 ${
                    theme === 'dark'
                      ? 'border-white/10 bg-white/5 text-white hover:bg-white/10'
                      : 'border-slate-200 bg-white text-slate-800 hover:bg-slate-50'
                  }`}
                >
                  <CalendarDays size={15} />
                  Compare base period
                </a>
              </div>
            </div>

            <div className="grid gap-4">
              <div
                id="trend"
                className={`rounded-[28px] border p-5 ${
                  theme === 'dark' ? 'border-white/10 bg-slate-950/60' : 'border-slate-200 bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className={`text-sm font-semibold tracking-[0.22em] uppercase ${theme === 'dark' ? 'text-teal-200' : 'text-teal-700'}`}>
                      Trend line
                    </p>
                    <h2 className={`mt-2 text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-950'}`}>
                      Route index distribution
                    </h2>
                  </div>
                  <div className={`rounded-2xl px-3 py-2 text-sm font-semibold ${theme === 'dark' ? 'bg-teal-300/15 text-teal-100' : 'bg-teal-50 text-teal-800'}`}>
                    Current collected feed
                  </div>
                </div>

                {error ? (
                  <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                    {error}
                  </div>
                ) : null}

                <div className="mt-5 flex h-56 items-end gap-2 rounded-[24px] border px-4 py-5">
                  {(loading ? Array.from({ length: 12 }, (_, index) => index + 1) : sortedRoutes.map((route) => route.airfareIndex)).map((value, index) => (
                    <div key={`${index}-${value}`} className="flex h-full flex-1 flex-col justify-end">
                      <div
                        className={`rounded-t-2xl ${theme === 'dark' ? 'bg-gradient-to-t from-teal-300 to-amber-200' : 'bg-gradient-to-t from-teal-400 to-amber-300'}`}
                        style={{ height: `${Math.max(16, Math.round((Number(value) / maxIndex) * 100))}%` }}
                      />
                      <span className={`mt-2 text-center text-[10px] uppercase tracking-[0.14em] ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>
                        {sortedRoutes[index] ? `${sortedRoutes[index].origin}-${sortedRoutes[index].destination}` : `R${index + 1}`}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div
                id="comparison"
                className={`rounded-[28px] border p-5 ${
                  theme === 'dark' ? 'border-white/10 bg-slate-950/60' : 'border-slate-200 bg-slate-50'
                }`}
              >
                <p className={`text-sm font-semibold tracking-[0.22em] uppercase ${theme === 'dark' ? 'text-amber-200' : 'text-amber-700'}`}>
                  Base period
                </p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {[
                    { label: 'Base route', value: baseRoute ? `${baseRoute.origin} → ${baseRoute.destination}` : 'N/A' },
                    { label: 'Current route', value: currentRoute ? `${currentRoute.origin} → ${currentRoute.destination}` : 'N/A' },
                    { label: 'Current index', value: currentRoute ? String(currentRoute.airfareIndex) : 'N/A' },
                    { label: 'Current fare', value: currentRoute ? formatCurrency(currentRoute.cheapestPrice) : 'N/A' },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className={`rounded-2xl border px-4 py-4 ${
                        theme === 'dark' ? 'border-white/10 bg-white/5' : 'border-slate-200 bg-white'
                      }`}
                    >
                      <p className={`text-xs font-semibold uppercase tracking-[0.18em] ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                        {item.label}
                      </p>
                      <p className={`mt-2 text-xl font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-950'}`}>
                        {item.value}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <div
            className={`rounded-[28px] border p-6 ${
              theme === 'dark' ? 'border-white/10 bg-white/5 text-white' : 'border-slate-200/70 bg-white text-slate-950'
            }`}
          >
            <p className={`text-sm font-semibold tracking-[0.24em] uppercase ${theme === 'dark' ? 'text-teal-200' : 'text-teal-700'}`}>
              Movement summary
            </p>
            <h3 className={`mt-3 text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-950'}`}>
              Route movement across the current sample.
            </h3>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {[
                { label: 'Routes', value: String(routes.length) },
                { label: 'Above base', value: String(sortedRoutes.filter((route) => route.airfareIndex > 100).length) },
                { label: 'Below base', value: String(sortedRoutes.filter((route) => route.airfareIndex <= 100).length) },
              ].map((item) => (
                <div
                  key={item.label}
                  className={`rounded-2xl border p-4 ${theme === 'dark' ? 'border-white/10 bg-slate-950/50' : 'border-slate-200 bg-slate-50'}`}
                >
                  <p className={`text-xs font-semibold uppercase tracking-[0.18em] ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                    {item.label}
                  </p>
                  <p className={`mt-2 text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-950'}`}>
                    {item.value}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div
            className={`rounded-[28px] border p-6 ${
              theme === 'dark' ? 'border-white/10 bg-white/5 text-white' : 'border-slate-200/70 bg-white text-slate-950'
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className={`text-sm font-semibold tracking-[0.24em] uppercase ${theme === 'dark' ? 'text-amber-200' : 'text-amber-700'}`}>
                  Current route
                </p>
                <h3 className={`mt-3 text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-950'}`}>
                  {currentRoute ? `${currentRoute.origin} → ${currentRoute.destination}` : 'No route selected'}
                </h3>
              </div>
              <BarChart3 className={theme === 'dark' ? 'text-teal-200' : 'text-teal-700'} />
            </div>
            <p className={`mt-4 text-sm leading-7 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>
              {currentRoute
                ? `${currentRoute.topCarrier} leads the current collected sample at ${formatCurrency(currentRoute.cheapestPrice)}.`
                : 'Load data to see the current route summary.'}
            </p>
            <div className={`mt-5 rounded-[24px] border p-4 ${theme === 'dark' ? 'border-white/10 bg-slate-950/50' : 'border-slate-200 bg-slate-50'}`}>
              <div className="flex items-center justify-between text-sm">
                <span className={theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}>Base period</span>
                <span className={`font-semibold ${theme === 'dark' ? 'text-white' : 'text-slate-950'}`}>100.0</span>
              </div>
              <div className="mt-3 flex items-center justify-between text-sm">
                <span className={theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}>Current index</span>
                <span className={`font-semibold ${theme === 'dark' ? 'text-white' : 'text-slate-950'}`}>
                  {currentRoute ? currentRoute.airfareIndex : 'N/A'}
                </span>
              </div>
              <div className="mt-4 h-3 rounded-full bg-white/10">
                <div
                  className="h-3 rounded-full bg-gradient-to-r from-teal-300 to-amber-200"
                  style={{ width: `${currentRoute ? Math.min(100, Math.max(10, currentRoute.airfareIndex)) : 10}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
