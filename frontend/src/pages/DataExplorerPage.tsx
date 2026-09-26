import { useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, FileJson2, FileSpreadsheet, Filter, SlidersHorizontal, Table2 } from 'lucide-react'
import { AirlineMark } from '@/components/AirlineMark'
import { EmptyFareState } from '@/components/EmptyFareState'
import { getAirlineBrand, getAirlineBrandByCode } from '@/data/airlines'
import { findAirport } from '@/data/airports'
import { useFareDashboardData } from '@/hooks/useFareDashboardData'
import type { FareSnapshot } from '@/types/fare'

type DataExplorerPageProps = {
  theme: 'dark' | 'light'
}

type SortKey = 'price' | 'departureTime' | 'airline'

const exportFields: Array<keyof FareSnapshot> = [
  'routeKey', 'origin', 'destination', 'departureDate', 'bookingWindowDays', 'collectionDate', 'collectedAt',
  'airline', 'airlineCode', 'flightNumber', 'departureTime', 'arrivalTime', 'durationMinutes', 'stops',
  'price', 'baseFare', 'taxes', 'udf', 'convenienceFee', 'totalFare', 'currency', 'seatsRemaining',
  'fareClass', 'soldOut', 'dataQualityScore', 'dataQualityStatus', 'rejectedReason', 'confidence',
]
const emptyRows: FareSnapshot[] = []
const hiddenInternalFields = new Set(['id', 'sourceId', 'source', 'sourceType', 'collectionStage'])

function formatCurrency(value: number, currency = 'INR') {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(value)
}

function formatCollectionTime(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

function airportLabel(code: string) {
  const airport = findAirport(code)
  return airport ? `${airport.code} · ${airport.city}` : code
}

function SnapshotDetails({ snapshot, theme }: { snapshot: FareSnapshot; theme: 'dark' | 'light' }) {
  return (
    <details className={`border-t px-4 py-3 text-sm ${theme === 'dark' ? 'border-white/10 bg-slate-950/50 text-slate-300' : 'border-slate-200 bg-slate-50/70 text-slate-700'}`}>
      <summary className="cursor-pointer font-semibold">All verified fields</summary>
      <dl className="mt-3 grid gap-x-5 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
        {Object.entries(snapshot).filter(([field]) => !hiddenInternalFields.has(field)).map(([field, value]) => (
          <div key={field} className="min-w-0">
            <dt className="text-xs font-semibold uppercase text-slate-500">{field.replace(/[A-Z]/g, (letter) => ` ${letter}`).trim()}</dt>
            <dd className="mt-1 break-words">{value === null || value === undefined || value === '' ? '—' : String(value)}</dd>
          </div>
        ))}
      </dl>
    </details>
  )
}

function toTableRow(snapshot: FareSnapshot) {
  return {
    origin: snapshot.origin,
    destination: snapshot.destination,
    airline: snapshot.airline,
    flightNumber: snapshot.flightNumber,
    date: snapshot.departureDate,
    collectionDate: snapshot.collectionDate ?? snapshot.collectedAt.slice(0, 10),
    departure: snapshot.departureTime,
    arrival: snapshot.arrivalTime,
    duration: `${Math.floor(snapshot.durationMinutes / 60)}h ${String(snapshot.durationMinutes % 60).padStart(2, '0')}m`,
    stops: snapshot.stops,
    fare: formatCurrency(snapshot.price, snapshot.currency),
    currency: snapshot.currency,
    collectedAt: snapshot.collectedAt,
  }
}
export function DataExplorerPage({ theme }: DataExplorerPageProps) {
  const { data, loading, error } = useFareDashboardData()
  const rows = data?.snapshots ?? emptyRows
  const quality = data?.quality ?? null
  const explorer = data?.explorer ?? null
  const [routeFilter, setRouteFilter] = useState('')
  const [airlineFilter, setAirlineFilter] = useState('')
  const [dateFilter, setDateFilter] = useState('')
  const [collectionDateFilter, setCollectionDateFilter] = useState('')
  const [minPrice, setMinPrice] = useState('')
  const [maxPrice, setMaxPrice] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('price')
  const [sortAscending, setSortAscending] = useState(true)
  const [page, setPage] = useState(1)
  const pageSize = 25

  const filteredRows = useMemo(() => rows.filter((row) => {
    const route = `${row.origin}-${row.destination}`
    return (!routeFilter || route.includes(routeFilter.toLowerCase())) &&
      (!airlineFilter || row.airline.toLowerCase().includes(airlineFilter.toLowerCase())) &&
      (!dateFilter || row.departureDate === dateFilter) &&
        (!collectionDateFilter || (row.collectionDate ?? row.collectedAt.slice(0, 10)) === collectionDateFilter) &&
      (!minPrice || row.price >= Number(minPrice)) &&
      (!maxPrice || row.price <= Number(maxPrice))
  }), [airlineFilter, collectionDateFilter, dateFilter, maxPrice, minPrice, routeFilter, rows])

  const sortedRows = useMemo(() => [...filteredRows].sort((left, right) => {
    const comparison = sortKey === 'price'
      ? left.price - right.price
      : sortKey === 'departureTime'
        ? left.departureTime.localeCompare(right.departureTime)
        : left.airline.localeCompare(right.airline)
    return sortAscending ? comparison : -comparison
  }), [filteredRows, sortAscending, sortKey])

  const pageCount = Math.max(1, Math.ceil(sortedRows.length / pageSize))
  const visiblePage = Math.min(page, pageCount)
  const paginatedRows = sortedRows.slice((visiblePage - 1) * pageSize, visiblePage * pageSize)

  const uniqueRoutes = new Set(rows.map((row) => row.routeKey)).size

  if (!data) {
    return <section className={`grid min-h-[60vh] place-items-center px-6 py-16 text-center ${theme === 'dark' ? 'bg-slate-950 text-white' : 'bg-slate-50 text-slate-950'}`}><p role="status">Loading verified fare records...</p></section>
  }

  if (!rows.length) {
    return <EmptyFareState theme={theme} />
  }

  function downloadFile(format: 'csv' | 'json') {
    const payload = format === 'json'
      ? JSON.stringify(sortedRows.map((row) => Object.fromEntries(Object.entries(row).filter(([field]) => !hiddenInternalFields.has(field)))), null, 2)
      : [
          exportFields.join(','),
          ...sortedRows.map((row) => exportFields.map((field) => `"${String(row[field] ?? '').replaceAll('"', '""')}"`).join(',')),
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
                  <input type="date" value={dateFilter} onChange={(event) => setDateFilter(event.target.value)} aria-label="Travel date" className="rounded-2xl border bg-transparent px-4 py-3 text-sm" />
                  <input type="date" value={collectionDateFilter} onChange={(event) => setCollectionDateFilter(event.target.value)} aria-label="Collection date" className="rounded-2xl border bg-transparent px-4 py-3 text-sm" />
                  <input type="number" min="0" value={minPrice} onChange={(event) => setMinPrice(event.target.value)} placeholder="Min price (INR)" className="rounded-2xl border bg-transparent px-4 py-3 text-sm" />
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
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex flex-wrap items-center gap-3">
                  <label className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm ${theme === 'dark' ? 'border-white/10 bg-slate-950/60' : 'border-slate-200 bg-slate-50'}`}>
                    <Table2 size={15} />
                    <span className="sr-only">Sort records by</span>
                    <select value={sortKey} onChange={(event) => setSortKey(event.target.value as SortKey)} className="bg-transparent font-semibold outline-none">
                      <option value="price">Fare</option>
                      <option value="departureTime">Departure</option>
                      <option value="airline">Airline</option>
                    </select>
                  </label>
                  <button type="button" onClick={() => setSortAscending((current) => !current)} className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold ${theme === 'dark' ? 'border-white/10 bg-slate-950/60' : 'border-slate-200 bg-slate-50'}`} aria-label={sortAscending ? 'Sort descending' : 'Sort ascending'}>
                    {sortAscending ? <ArrowUp size={15} /> : <ArrowDown size={15} />}
                    {sortAscending ? 'Ascending' : 'Descending'}
                  </button>
                </div>
              </div>
            </div>

            {error ? (
              <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {error}
              </div>
            ) : null}

            <div className={`mt-5 overflow-hidden rounded-[24px] border ${theme === 'dark' ? 'border-white/10' : 'border-slate-200'}`}>
              {loading ? (
                <div className={`px-4 py-8 text-sm ${theme === 'dark' ? 'bg-white/5 text-slate-300' : 'bg-white text-slate-600'}`}>
                  Loading fare records...
                </div>
              ) : sortedRows.length ? (
                <>
                  <div className="grid gap-3 p-3 md:hidden">
                    {paginatedRows.map((row) => {
                      const brand = getAirlineBrandByCode(row.airlineCode) ?? getAirlineBrand(row.airline)
                      return (
                        <article key={row.id} className={`rounded-2xl border p-4 ${theme === 'dark' ? 'border-white/10 bg-slate-950/50' : 'border-slate-200 bg-white'}`}>
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <AirlineMark airline={row.airline} code={row.airlineCode} logoUrl={brand?.logoUrl} compact />
                              <p className="mt-2 text-sm font-semibold">{row.flightNumber}</p>
                            </div>
                            <p className="shrink-0 text-lg font-bold text-teal-600 dark:text-teal-300">{formatCurrency(row.price, row.currency)}</p>
                          </div>
                          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                            <div><p className="text-xs uppercase text-slate-500">Route</p><p className="mt-1 font-semibold">{airportLabel(row.origin)} → {airportLabel(row.destination)}</p></div>
                            <div><p className="text-xs uppercase text-slate-500">Travel date</p><p className="mt-1 font-semibold">{row.departureDate}</p></div>
                            <div><p className="text-xs uppercase text-slate-500">Schedule</p><p className="mt-1 font-semibold">{row.departureTime} → {row.arrivalTime}</p><p className="text-xs text-slate-500">{toTableRow(row).duration}</p></div>
                            <div><p className="text-xs uppercase text-slate-500">Stops</p><p className="mt-1 font-semibold">{row.stops === 0 ? 'Non-stop' : `${row.stops} stop${row.stops === 1 ? '' : 's'}`}</p></div>
                            <div><p className="text-xs uppercase text-slate-500">Updated</p><p className="mt-1 font-semibold">{formatCollectionTime(row.collectedAt)}</p></div>
                          </div>
                          <SnapshotDetails snapshot={row} theme={theme} />
                        </article>
                      )
                    })}
                  </div>
                  <div className="hidden overflow-x-auto md:block">
                    <table className="w-full min-w-[1120px] text-left text-sm">
                      <thead className={theme === 'dark' ? 'bg-slate-900 text-slate-300' : 'bg-slate-50 text-slate-600'}>
                        <tr>{['Airline / flight', 'Route', 'Travel date', 'Schedule / duration', 'Stops', 'Fare', 'Updated'].map((heading) => <th key={heading} className="px-4 py-3 text-xs font-semibold uppercase">{heading}</th>)}</tr>
                      </thead>
                      {paginatedRows.map((row, index) => {
                        const brand = getAirlineBrandByCode(row.airlineCode) ?? getAirlineBrand(row.airline)
                        return (
                          <tbody key={row.id} className={theme === 'dark' ? index % 2 ? 'bg-slate-950/40' : 'bg-white/5' : index % 2 ? 'bg-slate-50' : 'bg-white'}>
                            <tr className={`border-t ${theme === 'dark' ? 'border-white/10' : 'border-slate-200'}`}>
                              <td className="px-4 py-3"><AirlineMark airline={row.airline} code={row.airlineCode} logoUrl={brand?.logoUrl} compact /><p className="mt-2 font-semibold">{row.flightNumber}</p></td>
                              <td className="px-4 py-3 font-medium">{airportLabel(row.origin)}<span className="mx-2 text-slate-400">→</span>{airportLabel(row.destination)}</td>
                              <td className="px-4 py-3">{row.departureDate}</td>
                              <td className="px-4 py-3"><span className="font-semibold">{row.departureTime} → {row.arrivalTime}</span><span className="mt-1 block text-xs text-slate-500">{toTableRow(row).duration}</span></td>
                              <td className="px-4 py-3">{row.stops === 0 ? 'Non-stop' : `${row.stops} stop${row.stops === 1 ? '' : 's'}`}</td>
                              <td className="px-4 py-3 font-bold text-teal-700 dark:text-teal-300">{formatCurrency(row.price, row.currency)}</td>
                              <td className="px-4 py-3">{formatCollectionTime(row.collectedAt)}</td>
                            </tr>
                            <tr><td colSpan={7} className="p-0"><SnapshotDetails snapshot={row} theme={theme} /></td></tr>
                          </tbody>
                        )
                      })}
                    </table>
                  </div>
                </>
              ) : (
                <div className={`px-4 py-8 text-sm ${theme === 'dark' ? 'bg-white/5 text-slate-300' : 'bg-white text-slate-600'}`}>
                  {rows.length ? 'No fare records match the current filters.' : 'No collected data yet.'}
                </div>
              )}
            </div>
            {sortedRows.length > pageSize ? (
              <div className="mt-4 flex items-center justify-between gap-3 text-sm">
                <span className={theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}>Page {visiblePage} of {pageCount} · {sortedRows.length} filtered records</span>
                <div className="flex gap-2">
                  <button type="button" disabled={visiblePage === 1} onClick={() => setPage((current) => Math.max(1, current - 1))} className="rounded-xl border px-3 py-2 disabled:cursor-not-allowed disabled:opacity-40">Previous</button>
                  <button type="button" disabled={visiblePage === pageCount} onClick={() => setPage((current) => Math.min(pageCount, current + 1))} className="rounded-xl border px-3 py-2 disabled:cursor-not-allowed disabled:opacity-40">Next</button>
                </div>
              </div>
            ) : null}
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