import type { FormEvent } from 'react'
import { CalendarDays, Loader2, PlaneLanding, PlaneTakeoff, Search, Users } from 'lucide-react'
import type { FlightSearchInput } from '@/types/flight'
import { airportOptions } from '@/data/airports'

type SearchSectionProps = {
  value: FlightSearchInput
  loading?: boolean
  onChange: (next: FlightSearchInput) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  theme: 'dark' | 'light'
}

export function SearchSection({ value, loading = false, onChange, onSubmit, theme }: SearchSectionProps) {
  return (
    <section
      id="search"
      className={`py-10 transition-colors duration-300 ${theme === 'dark' ? 'bg-slate-950' : 'bg-white'}`}
    >
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div
          className={`overflow-hidden rounded-[32px] border p-5 shadow-[0_24px_80px_rgba(15,23,42,0.10)] sm:p-6 lg:p-8 ${
            theme === 'dark'
              ? 'border-white/10 bg-white/5 text-white shadow-slate-950/30'
              : 'border-slate-200 bg-white text-slate-950 shadow-slate-200/60'
          }`}
        >
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl space-y-3">
              <p className={`text-sm font-semibold tracking-[0.24em] uppercase ${theme === 'dark' ? 'text-teal-200' : 'text-teal-700'}`}>
                Search flights
              </p>
              <h2 className={`text-3xl font-bold sm:text-4xl ${theme === 'dark' ? 'text-white' : 'text-slate-950'}`}>
                Search by airport name or code, then compare the fares.
              </h2>
              <p className={`text-sm leading-7 sm:text-base ${theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>
                Choose your origin, destination, and travel date. The results page will show the cheapest flight
                first and keep the route comparison easy to scan.
              </p>
            </div>

            <div className={`rounded-2xl border px-4 py-3 text-sm ${theme === 'dark' ? 'border-white/10 bg-slate-950/50 text-slate-300' : 'border-slate-200 bg-slate-50 text-slate-600'}`}>
              Search on this page, then navigate to Results for the fare breakdown.
            </div>
          </div>

          <form onSubmit={onSubmit} className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_220px_160px_auto] lg:items-end">
            <label className="grid gap-2 min-w-0">
                <span className={`text-sm font-semibold ${theme === 'dark' ? 'text-slate-200' : 'text-slate-700'}`}>
                  From
                </span>
                <div
                className={`relative rounded-[22px] border px-4 py-3 transition ${
                  theme === 'dark' ? 'border-white/10 bg-slate-900/70' : 'border-slate-200 bg-slate-50'
                }`}
                >
                <PlaneTakeoff
                  size={16}
                  className={`pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 ${
                    theme === 'dark' ? 'text-sky-300' : 'text-sky-600'
                  }`}
                />
                <input
                  list="airport-options"
                  value={value.origin}
                  disabled={loading}
                  onFocus={() => onChange({ ...value, origin: '' })}
                  onChange={(event) => onChange({ ...value, origin: event.target.value })}
                  placeholder="Delhi - Indira Gandhi International Airport"
                  className={`h-7 w-full bg-transparent pl-6 pr-0 outline-none placeholder:text-slate-500 ${
                    theme === 'dark' ? 'text-white disabled:text-slate-500' : 'text-slate-950 disabled:text-slate-500'
                  }`}
                />
              </div>
            </label>

            <label className="grid gap-2 min-w-0">
                <span className={`text-sm font-semibold ${theme === 'dark' ? 'text-slate-200' : 'text-slate-700'}`}>
                  To
                </span>
                <div
                className={`relative rounded-[22px] border px-4 py-3 transition ${
                  theme === 'dark' ? 'border-white/10 bg-slate-900/70' : 'border-slate-200 bg-slate-50'
                }`}
                >
                <PlaneLanding
                  size={16}
                  className={`pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 ${
                    theme === 'dark' ? 'text-amber-300' : 'text-amber-600'
                  }`}
                />
                <input
                  list="airport-options"
                  value={value.destination}
                  disabled={loading}
                  onFocus={() => onChange({ ...value, destination: '' })}
                  onChange={(event) => onChange({ ...value, destination: event.target.value })}
                  placeholder="Mumbai - Chhatrapati Shivaji Maharaj International Airport"
                  className={`h-7 w-full bg-transparent pl-6 pr-0 outline-none placeholder:text-slate-500 ${
                    theme === 'dark' ? 'text-white disabled:text-slate-500' : 'text-slate-950 disabled:text-slate-500'
                  }`}
                />
              </div>
            </label>

            <div className="grid gap-2 min-w-0">
              <span className={`text-sm font-semibold ${theme === 'dark' ? 'text-slate-200' : 'text-slate-700'}`}>
                Departure
              </span>
              <div
                className={`flex items-center gap-3 rounded-[22px] border px-4 py-3 transition ${
                  theme === 'dark' ? 'border-white/10 bg-slate-900/70' : 'border-slate-200 bg-slate-50'
                }`}
              >
                <CalendarDays size={16} className={theme === 'dark' ? 'text-teal-300' : 'text-teal-600'} />
                <input
                  type="date"
                  value={value.travelDate}
                  disabled={loading}
                  onChange={(event) => onChange({ ...value, travelDate: event.target.value })}
                  className={`h-7 w-full bg-transparent outline-none ${
                    theme === 'dark' ? 'text-white disabled:text-slate-500' : 'text-slate-950 disabled:text-slate-500'
                  }`}
                />
              </div>
            </div>

            <div className="grid gap-2 min-w-0">
              <span className={`text-sm font-semibold ${theme === 'dark' ? 'text-slate-200' : 'text-slate-700'}`}>
                Passengers
              </span>
              <div
                className={`flex items-center gap-3 rounded-[22px] border px-4 py-3 transition ${
                  theme === 'dark' ? 'border-white/10 bg-slate-900/70' : 'border-slate-200 bg-slate-50'
                }`}
              >
                <Users size={16} className={theme === 'dark' ? 'text-amber-300' : 'text-amber-600'} />
                <input
                  type="number"
                  min={1}
                  max={9}
                  step={1}
                  value={value.adults}
                  disabled={loading}
                  onChange={(event) => onChange({ ...value, adults: Math.max(1, Math.min(9, Number(event.target.value) || 1)) })}
                  className={`h-7 w-full bg-transparent outline-none ${
                    theme === 'dark' ? 'text-white disabled:text-slate-500' : 'text-slate-950 disabled:text-slate-500'
                  }`}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="inline-flex h-14 w-full items-center justify-center gap-2 rounded-[22px] bg-gradient-to-r from-teal-300 to-amber-200 px-5 text-sm font-semibold text-slate-950 shadow-lg shadow-teal-400/20 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-teal-400/25 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {loading ? 'Searching flights' : 'Search flights'}
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
            </button>
          </form>

          <datalist id="airport-options">
            {airportOptions.map((airport) => (
              <option key={airport.value} value={airport.value} />
            ))}
          </datalist>
        </div>
      </div>
    </section>
  )
}
