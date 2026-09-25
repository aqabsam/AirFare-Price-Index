import type { FormEvent } from 'react'
import { CalendarDays, PlaneLanding, PlaneTakeoff, Search } from 'lucide-react'
import { airportOptions } from '@/data/airports'

export type RouteFilterValue = {
  origin: string
  destination: string
  departureDate: string
}

type RouteFilterPanelProps = {
  value: RouteFilterValue
  onChange: (next: RouteFilterValue) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  onClear: () => void
  theme: 'dark' | 'light'
  submitLabel?: string
}

export function RouteFilterPanel({
  value,
  onChange,
  onSubmit,
  onClear,
  theme,
  submitLabel = 'Apply filters',
}: RouteFilterPanelProps) {
  return (
    <form
      onSubmit={onSubmit}
      className={`grid gap-4 rounded-[28px] border p-4 shadow-[0_16px_40px_rgba(15,23,42,0.06)] sm:grid-cols-2 sm:p-5 lg:grid-cols-3 lg:items-end xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(190px,0.8fr)_auto_auto] xl:items-end ${
        theme === 'dark' ? 'border-white/10 bg-slate-950/60' : 'border-slate-200 bg-slate-50'
      }`}
    >
      <label className="grid gap-2 min-w-0">
        <span className={`block min-h-5 whitespace-nowrap text-sm font-semibold leading-5 ${theme === 'dark' ? 'text-slate-200' : 'text-slate-700'}`}>
          Origin
        </span>
        <div className={`flex min-w-0 items-center gap-3 rounded-[20px] border px-4 py-3 transition focus-within:ring-2 ${
          theme === 'dark'
            ? 'border-white/10 bg-slate-900/70 focus-within:border-teal-300/50 focus-within:ring-teal-300/20'
            : 'border-slate-200 bg-white focus-within:border-teal-500/50 focus-within:ring-teal-500/15'
        }`}>
          <PlaneTakeoff size={17} className={theme === 'dark' ? 'shrink-0 text-sky-300' : 'shrink-0 text-sky-600'} />
          <input
            list="airport-options"
            value={value.origin}
            onChange={(event) => onChange({ ...value, origin: event.target.value })}
            placeholder="PAT or Patna"
            className={`min-w-0 w-full bg-transparent text-sm outline-none placeholder:text-slate-500 ${theme === 'dark' ? 'text-white' : 'text-slate-950'}`}
          />
        </div>
      </label>

      <label className="grid gap-2 min-w-0">
        <span className={`block min-h-5 whitespace-nowrap text-sm font-semibold leading-5 ${theme === 'dark' ? 'text-slate-200' : 'text-slate-700'}`}>
          Destination
        </span>
        <div className={`flex min-w-0 items-center gap-3 rounded-[20px] border px-4 py-3 transition focus-within:ring-2 ${
          theme === 'dark'
            ? 'border-white/10 bg-slate-900/70 focus-within:border-amber-300/50 focus-within:ring-amber-300/20'
            : 'border-slate-200 bg-white focus-within:border-amber-500/50 focus-within:ring-amber-500/15'
        }`}>
          <PlaneLanding size={17} className={theme === 'dark' ? 'shrink-0 text-amber-300' : 'shrink-0 text-amber-600'} />
          <input
            list="airport-options"
            value={value.destination}
            onChange={(event) => onChange({ ...value, destination: event.target.value })}
            placeholder="BOM or Mumbai"
            className={`min-w-0 w-full bg-transparent text-sm outline-none placeholder:text-slate-500 ${theme === 'dark' ? 'text-white' : 'text-slate-950'}`}
          />
        </div>
      </label>

      <label className="grid gap-2 min-w-0">
        <span className={`block min-h-5 whitespace-nowrap text-sm font-semibold leading-5 ${theme === 'dark' ? 'text-slate-200' : 'text-slate-700'}`}>
          Departure
        </span>
        <div className={`flex min-w-0 items-center gap-3 rounded-[20px] border px-4 py-3 transition focus-within:ring-2 ${
          theme === 'dark'
            ? 'border-white/10 bg-slate-900/70 focus-within:border-teal-300/50 focus-within:ring-teal-300/20'
            : 'border-slate-200 bg-white focus-within:border-teal-500/50 focus-within:ring-teal-500/15'
        }`}>
          <CalendarDays size={17} className={theme === 'dark' ? 'shrink-0 text-teal-300' : 'shrink-0 text-teal-600'} />
          <input
            type="date"
            value={value.departureDate}
            onChange={(event) => onChange({ ...value, departureDate: event.target.value })}
            className={`min-w-0 w-full bg-transparent text-sm outline-none ${theme === 'dark' ? 'text-white' : 'text-slate-950'}`}
          />
        </div>
      </label>

      <button
        type="submit"
        className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-[20px] bg-gradient-to-r from-teal-300 to-amber-200 px-5 text-sm font-semibold text-slate-950 shadow-lg shadow-teal-400/20 transition hover:-translate-y-0.5 sm:col-span-1 xl:w-auto"
      >
        <Search size={16} />
        {submitLabel}
      </button>

      <button
        type="button"
        onClick={onClear}
        className={`inline-flex h-12 w-full items-center justify-center rounded-[20px] border px-5 text-sm font-semibold transition hover:-translate-y-0.5 sm:col-span-1 xl:w-auto ${
          theme === 'dark'
            ? 'border-white/10 bg-white/5 text-white hover:bg-white/10'
            : 'border-slate-200 bg-white text-slate-800 hover:bg-slate-50'
        }`}
      >
        Clear
      </button>
      <datalist id="airport-options">
        {airportOptions.map((airport) => (
          <option key={airport.value} value={airport.value} />
        ))}
      </datalist>
    </form>
  )
}
