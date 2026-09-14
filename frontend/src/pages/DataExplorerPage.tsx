import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { FileJson2, FileSpreadsheet, Filter, SlidersHorizontal, Table2 } from 'lucide-react'
import { fetchFareSnapshots } from '@/services/fareApi'
import { RouteFilterPanel, type RouteFilterValue } from '@/components/RouteFilterPanel'
import type { FareSnapshot } from '@/types/fare'

type DataExplorerPageProps = {
  theme: 'dark' | 'light'
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value)
}

function toTableRow(snapshot: FareSnapshot) {
  return {
    origin: snapshot.origin,
    destination: snapshot.destination,
    airline: snapshot.airline,
    date: snapshot.departureDate,
    fare: formatCurrency(snapshot.price),
  }
}

export function DataExplorerPage({ theme }: DataExplorerPageProps) {
  const [rows, setRows] = useState<FareSnapshot[]>([])
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

    async function loadRows() {
      setLoading(true)
      setError('')

      try {
        const data = await fetchFareSnapshots(appliedFilters)
        if (active) {
          setRows(data)
        }
      } catch (error) {
        if (active) {
          setError(error instanceof Error ? error.message : 'Unable to load fare data.')
        }
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    void loadRows()

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

  const filteredRows = useMemo(() => rows, [rows])

  const uniqueRoutes = new Set(rows.map((row) => row.routeKey)).size

  return (
    <section className={`py-10 ${theme === 'dark' ? 'bg-slate-950' : 'bg-slate-50'}`}>
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div
          className={`rounded-[32px] border shadow-[0_18px_60px_rgba(15,23,42,0.08)] ${
            theme === 'dark' ? 'border-white/10 bg-white/5 text-white' : 'border-slate-200/70 bg-white text-slate-950'
          }`}
        >
          <div className="grid gap-8 p-6 lg:grid-cols-[1fr_0.95fr] lg:p-8 xl:p-10">
            <div>
              <p className={`text-sm font-semibold tracking-[0.24em] uppercase ${theme === 'dark' ? 'text-teal-200' : 'text-teal-700'}`}>
                Data Explorer
              </p>
              <h1 className={`mt-3 text-4xl font-bold sm:text-5xl ${theme === 'dark' ? 'text-white' : 'text-slate-950'}`}>
                Fare records, filters, and download-ready views.
              </h1>
              <p className={`mt-4 max-w-2xl text-base leading-8 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>
                Explore the live fare snapshots stored by the backend, narrow them with simple filters, and review the
                same rows that feed search and analytics.
              </p>

              <div className="mt-6">
                <RouteFilterPanel
                  value={draftFilters}
                  onChange={setDraftFilters}
                  onSubmit={applyFilters}
                  onClear={clearFilters}
                  theme={theme}
                  submitLabel="Load route data"
                />
              </div>

              <div className="mt-6 flex flex-wrap gap-3">
                {['Route', 'Airline', 'Date', 'Price band', 'Stops'].map((item) => (
                  <span
                    key={item}
                    className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold ${
                      theme === 'dark' ? 'border-white/10 bg-white/5 text-white' : 'border-slate-200 bg-slate-50 text-slate-700'
                    }`}
                  >
                    <Filter size={14} />
                    {item}
                  </span>
                ))}
              </div>

              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                {[
                  { label: 'Visible rows', value: String(filteredRows.length) },
                  { label: 'Routes tracked', value: String(uniqueRoutes) },
                  { label: 'Export formats', value: 'CSV / JSON' },
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
                  </div>
                ))}
              </div>
            </div>

            <div
              className={`rounded-[28px] border p-5 ${
                theme === 'dark' ? 'border-white/10 bg-slate-950/60' : 'border-slate-200 bg-slate-50'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className={`text-sm font-semibold tracking-[0.22em] uppercase ${theme === 'dark' ? 'text-amber-200' : 'text-amber-700'}`}>
                    Export
                  </p>
                  <h2 className={`mt-2 text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-950'}`}>
                    Search and export the dataset snapshot
                  </h2>
                </div>
              </div>

              <label className="mt-5 block">
                <span className={`text-sm font-semibold ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>
                  Active route filters
                </span>
                <div className={`mt-2 rounded-2xl border px-4 py-3 text-sm ${theme === 'dark' ? 'border-white/10 bg-slate-900/80 text-slate-300' : 'border-slate-200 bg-white text-slate-700'}`}>
                  {appliedFilters.origin || appliedFilters.destination || appliedFilters.departureDate
                    ? `${appliedFilters.origin || 'Any'} → ${appliedFilters.destination || 'Any'} on ${appliedFilters.departureDate || 'any date'}`
                    : 'Showing the full collected dataset'}
                </div>
              </label>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {[
                  {
                    icon: FileSpreadsheet,
                    label: 'CSV export',
                    accent: 'from-emerald-400 to-teal-300',
                    textTone: 'text-emerald-700 dark:text-emerald-200',
                  },
                  {
                    icon: FileJson2,
                    label: 'JSON export',
                    accent: 'from-violet-500 to-fuchsia-400',
                    textTone: 'text-violet-700 dark:text-violet-200',
                  },
                ].map((item) => {
                  const Icon = item.icon
                  return (
                    <button
                      key={item.label}
                      type="button"
                      className={`flex items-center gap-3 rounded-2xl border px-4 py-4 text-left text-sm font-semibold transition hover:-translate-y-0.5 ${
                        theme === 'dark'
                          ? 'border-white/10 bg-white/5 text-white hover:bg-white/10'
                          : 'border-slate-200 bg-white text-slate-800 hover:bg-slate-50'
                      }`}
                    >
                      <span className={`grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-br ${item.accent} text-white shadow-sm`}>
                        <Icon size={16} />
                      </span>
                      <span className={`flex-1 ${item.textTone}`}>{item.label}</span>
                    </button>
                  )
                })}
              </div>

              <div className={`mt-5 rounded-[24px] border p-4 ${theme === 'dark' ? 'border-white/10 bg-slate-900/70' : 'border-slate-200 bg-white'}`}>
                <div className="flex items-center gap-3">
                  <SlidersHorizontal className={theme === 'dark' ? 'text-teal-200' : 'text-teal-700'} size={18} />
                  <p className={`text-sm font-semibold tracking-[0.18em] uppercase ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                    Quick filters
                  </p>
                </div>
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  {['Route corridor', 'Price range', 'Carrier', 'Travel date'].map((item) => (
                    <div
                      key={item}
                      className={`rounded-2xl border px-4 py-3 text-sm ${
                        theme === 'dark' ? 'border-white/10 bg-white/5 text-slate-200' : 'border-slate-200 bg-slate-50 text-slate-700'
                      }`}
                    >
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6">
          <div
            className={`rounded-[28px] border p-6 ${
              theme === 'dark' ? 'border-white/10 bg-white/5 text-white' : 'border-slate-200/70 bg-white text-slate-950'
            }`}
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className={`text-sm font-semibold tracking-[0.24em] uppercase ${theme === 'dark' ? 'text-teal-200' : 'text-teal-700'}`}>
                  Fare records
                </p>
                <h2 className={`mt-3 text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-950'}`}>
                  Table view of the current live snapshot.
                </h2>
              </div>
              <div
                className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold ${
                  theme === 'dark' ? 'border-white/10 bg-white/5 text-white' : 'border-slate-200 bg-slate-50 text-slate-700'
                }`}
              >
                <Table2 size={15} />
                Sorted by lowest fare
              </div>
            </div>

            {error ? (
              <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {error}
              </div>
            ) : null}

            <div className="mt-5 overflow-hidden rounded-[24px] border">
              <div
                className={`grid grid-cols-5 gap-3 px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] ${
                  theme === 'dark' ? 'border-white/10 bg-slate-900/80 text-slate-300' : 'border-slate-200 bg-slate-50 text-slate-500'
                }`}
              >
                <span>Origin</span>
                <span>Destination</span>
                <span>Airline</span>
                <span>Date</span>
                <span>Fare</span>
              </div>
              {loading ? (
                <div className={`px-4 py-8 text-sm ${theme === 'dark' ? 'bg-white/5 text-slate-300' : 'bg-white text-slate-600'}`}>
                  Loading fare records...
                </div>
              ) : filteredRows.length ? (
                filteredRows.slice(0, 12).map((row, index) => {
                  const item = toTableRow(row)
                  return (
                    <div
                      key={row.id}
                      className={`grid grid-cols-5 gap-3 px-4 py-4 text-sm ${
                        theme === 'dark'
                          ? index % 2 === 0
                            ? 'bg-white/5'
                            : 'bg-slate-950/40'
                          : index % 2 === 0
                            ? 'bg-white'
                            : 'bg-slate-50'
                      }`}
                    >
                      <span className="font-medium">{item.origin}</span>
                      <span className="font-medium">{item.destination}</span>
                      <span className="font-medium">{item.airline}</span>
                      <span className="font-medium">{item.date}</span>
                      <span className="font-medium">{item.fare}</span>
                    </div>
                  )
                })
              ) : (
                <div className={`px-4 py-8 text-sm ${theme === 'dark' ? 'bg-white/5 text-slate-300' : 'bg-white text-slate-600'}`}>
                  No fare records match the current filter.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
