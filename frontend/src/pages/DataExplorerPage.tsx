import { useEffect, useMemo, useState } from 'react'
import { FileJson2, FileSpreadsheet, Filter, SlidersHorizontal, Table2 } from 'lucide-react'
import { fetchDataQuality, fetchFareExplorer } from '@/services/fareApi'
import type { DataQualityResponse, FareExplorerResponse, FareSnapshot } from '@/types/fare'

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
  const sourceStage = snapshot.collectionStage ?? (snapshot.sourceType === 'duffel' ? 'DUFFEL' : snapshot.sourceType === 'demo' || snapshot.sourceType === 'aggregated' ? 'DEMO' : 'SCRAPER')
  return {
    origin: snapshot.origin,
    destination: snapshot.destination,
    airline: snapshot.airline,
    date: snapshot.departureDate,
    fare: formatCurrency(snapshot.price),
    source: sourceStage,
    collectedAt: snapshot.collectedAt,
    baseFare: snapshot.baseFare === null || snapshot.baseFare === undefined ? '—' : formatCurrency(snapshot.baseFare),
    taxes: snapshot.taxes === null || snapshot.taxes === undefined ? '—' : formatCurrency(snapshot.taxes),
    fees: formatCurrency((snapshot.taxes ?? 0) + (snapshot.udf ?? 0) + (snapshot.convenienceFee ?? 0)),
    quality: snapshot.dataQualityScore === null || snapshot.dataQualityScore === undefined ? '—' : `${snapshot.dataQualityScore}%`,
  }
}
export function DataExplorerPage({ theme }: DataExplorerPageProps) {
  const [rows, setRows] = useState<FareSnapshot[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
    const [quality, setQuality] = useState<DataQualityResponse | null>(null)
    const [explorer, setExplorer] = useState<FareExplorerResponse | null>(null)
  const [routeFilter, setRouteFilter] = useState('')
  const [airlineFilter, setAirlineFilter] = useState('')
  const [dateFilter, setDateFilter] = useState('')
  const [maxPrice, setMaxPrice] = useState('')
  useEffect(() => {
    let active = true

    async function loadRows() {
      setLoading(true)
      setError('')

      try {
          const [explorerData, qualityData] = await Promise.all([fetchFareExplorer(), fetchDataQuality()])
        if (active) {
            setRows(explorerData.cleaned)
          setQuality(qualityData)
          setExplorer(explorerData)
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

    const handleSync = () => {
      void loadRows()
    }

    void loadRows()
    window.addEventListener('fare-data-sync', handleSync)
    const refreshTimer = window.setInterval(() => {
      void loadRows()
    }, 30000)

    return () => {
      active = false
      window.removeEventListener('fare-data-sync', handleSync)
      window.clearInterval(refreshTimer)
    }
  }, [])

  const filteredRows = useMemo(() => rows.filter((row) => {
    const route = `${row.origin}-${row.destination}`.toLowerCase()
    return (!routeFilter || route.includes(routeFilter.toLowerCase())) &&
      (!airlineFilter || row.airline.toLowerCase().includes(airlineFilter.toLowerCase())) &&
      (!dateFilter || row.departureDate === dateFilter) &&
      (!maxPrice || row.price <= Number(maxPrice))
  }), [airlineFilter, dateFilter, maxPrice, routeFilter, rows])

  const uniqueRoutes = new Set(rows.map((row) => row.routeKey)).size

  function downloadFile(format: 'csv' | 'json') {
    const payload = format === 'json'
      ? JSON.stringify(filteredRows, null, 2)
      : [
          'origin,destination,airline,flightNumber,departureDate,departureTime,arrivalTime,price,currency',
          ...filteredRows.map((row) => [row.origin, row.destination, row.airline, row.flightNumber, row.departureDate, row.departureTime, row.arrivalTime, row.price, row.currency].map((value) => `"${String(value).replaceAll('"', '""')}"`).join(',')),
        ].join('\n')
    const link = document.createElement('a')
    link.href = URL.createObjectURL(new Blob([payload], { type: format === 'json' ? 'application/json' : 'text/csv' }))
    link.download = `fare-snapshots.${format}`
    link.click()
    URL.revokeObjectURL(link.href)
     }

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
                  { label: 'Visible rows', value: rows.length ? String(filteredRows.length) : '—' },
                  { label: 'Routes tracked', value: rows.length ? String(uniqueRoutes) : '—' },
                  { label: 'Outliers', value: quality ? String(quality.outlierRecords) : '—' },
                  { label: 'Missing fields', value: quality ? String(quality.missingFieldRecords) : '—' },
                  { label: 'Rejected', value: explorer ? String(explorer.rejected.length) : '—' },
                  { label: 'Raw records', value: explorer ? String(explorer.raw.length) : '—' },
                  { label: 'Cleaned records', value: explorer ? String(explorer.cleaned.length) : '—' },
                  { label: 'Index history', value: explorer ? String(explorer.indexHistory?.length ?? 0) : '—' },
                  { label: 'Collection', value: explorer?.collectionStatus.status ?? '—' },
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
                  {rows.length ? `${filteredRows.length} of ${rows.length} collected records` : 'No collected data yet'}
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
                      onClick={() => downloadFile(item.label.startsWith('CSV') ? 'csv' : 'json')}
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
                  <input value={routeFilter} onChange={(event) => setRouteFilter(event.target.value)} placeholder="Route e.g. PAT-BOM" className="rounded-2xl border bg-transparent px-4 py-3 text-sm" />
                  <input value={airlineFilter} onChange={(event) => setAirlineFilter(event.target.value)} placeholder="Airline" className="rounded-2xl border bg-transparent px-4 py-3 text-sm" />
                  <input type="date" value={dateFilter} onChange={(event) => setDateFilter(event.target.value)} className="rounded-2xl border bg-transparent px-4 py-3 text-sm" />
                  <input type="number" min="0" value={maxPrice} onChange={(event) => setMaxPrice(event.target.value)} placeholder="Max price (INR)" className="rounded-2xl border bg-transparent px-4 py-3 text-sm" />
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
                className={`grid grid-cols-11 gap-3 px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] ${
                  theme === 'dark' ? 'border-white/10 bg-slate-900/80 text-slate-300' : 'border-slate-200 bg-slate-50 text-slate-500'
                }`}
              >
                <span>Origin</span>
                <span>Destination</span>
                <span>Airline</span>
                <span>Date</span>
                <span>Fare</span>
                <span>Source</span>
                <span>Collected</span>
                <span>Base fare</span>
                <span>Taxes</span>
                <span>Fees</span>
                <span>Quality</span>
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
                      className={`grid grid-cols-11 gap-3 px-4 py-4 text-sm ${
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
                      <span className="font-medium">{item.source}</span>
                      <span className="font-medium">{item.collectedAt}</span>
                      <span className="font-medium">{item.baseFare}</span>
                      <span className="font-medium">{item.taxes}</span>
                      <span className="font-medium">{item.fees}</span>
                      <span className="font-medium">{item.quality}</span>
                    </div>
                  )
                })
              ) : (
                <div className={`px-4 py-8 text-sm ${theme === 'dark' ? 'bg-white/5 text-slate-300' : 'bg-white text-slate-600'}`}>
                  {rows.length ? 'No fare records match the current filters.' : 'No collected data yet.'}
                </div>
              )}
            </div>
            {explorer?.rejected.length ? (
              <div className={`mt-5 rounded-2xl border p-4 text-sm ${theme === 'dark' ? 'border-rose-500/20 bg-rose-500/10 text-rose-100' : 'border-rose-200 bg-rose-50 text-rose-800'}`}>
                <p className="font-semibold">Rejected/outlier records: {explorer.rejected.length}</p>
                <p className="mt-1">{explorer.rejected.slice(0, 3).map((record) => `${record.id}: ${record.rejectedReason ?? record.dataQualityStatus ?? 'rejected'}`).join(' • ')}</p>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  )
}