import type { FormEvent } from 'react'
import { Search } from 'lucide-react'
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
      className={`grid gap-4 rounded-[28px] border p-5 ${
        theme === 'dark' ? 'border-white/10 bg-slate-950/60' : 'border-slate-200 bg-slate-50'
      } lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_220px_auto_auto] lg:items-end`}
    >
      <label className="grid gap-2 min-w-0">
        <span className={`text-sm font-semibold ${theme === 'dark' ? 'text-slate-200' : 'text-slate-700'}`}>
          Origin
        </span>
        <input
          list="airport-options"
          value={value.origin}
          onChange={(event) => onChange({ ...value, origin: event.target.value })}
          placeholder="PAT or Patna"
          className={`rounded-[22px] border px-4 py-3 text-sm outline-none ${
            theme === 'dark'
              ? 'border-white/10 bg-slate-900/70 text-white placeholder:text-slate-500'
              : 'border-slate-200 bg-white text-slate-950 placeholder:text-slate-400'
          }`}
        />
      </label>

      <label className="grid gap-2 min-w-0">
        <span className={`text-sm font-semibold ${theme === 'dark' ? 'text-slate-200' : 'text-slate-700'}`}>
          Destination
        </span>
        <input
          list="airport-options"
          value={value.destination}
          onChange={(event) => onChange({ ...value, destination: event.target.value })}
          placeholder="BOM or Mumbai"
          className={`rounded-[22px] border px-4 py-3 text-sm outline-none ${
            theme === 'dark'
              ? 'border-white/10 bg-slate-900/70 text-white placeholder:text-slate-500'
              : 'border-slate-200 bg-white text-slate-950 placeholder:text-slate-400'
          }`}
        />
      </label>

      <label className="grid gap-2 min-w-0">
        <span className={`text-sm font-semibold ${theme === 'dark' ? 'text-slate-200' : 'text-slate-700'}`}>
          Departure
        </span>
        <input
          type="date"
          value={value.departureDate}
          onChange={(event) => onChange({ ...value, departureDate: event.target.value })}
          className={`rounded-[22px] border px-4 py-3 text-sm outline-none ${
            theme === 'dark'
              ? 'border-white/10 bg-slate-900/70 text-white'
              : 'border-slate-200 bg-white text-slate-950'
          }`}
        />
      </label>

      <button
        type="submit"
        className="inline-flex h-12 items-center justify-center gap-2 rounded-[22px] bg-gradient-to-r from-teal-300 to-amber-200 px-5 text-sm font-semibold text-slate-950 shadow-lg shadow-teal-400/20 transition hover:-translate-y-0.5"
      >
        <Search size={16} />
        {submitLabel}
      </button>

      <button
        type="button"
        onClick={onClear}
        className={`inline-flex h-12 items-center justify-center rounded-[22px] border px-5 text-sm font-semibold transition hover:-translate-y-0.5 ${
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
