type AirlineMarkProps = {
  airline: string
  code: string
  logoUrl?: string
  compact?: boolean
}

const brandStyles: Record<
  string,
  { ring: string; fill: string; text: string; accent: string }
> = {
  IndiGo: {
    ring: 'ring-blue-200/60',
    fill: 'bg-blue-50',
    text: 'text-blue-700',
    accent: 'from-blue-500 to-cyan-400',
  },
  'Air India': {
    ring: 'ring-rose-200/60',
    fill: 'bg-rose-50',
    text: 'text-rose-700',
    accent: 'from-rose-500 to-orange-400',
  },
  'Akasa Air': {
    ring: 'ring-violet-200/60',
    fill: 'bg-violet-50',
    text: 'text-violet-700',
    accent: 'from-violet-500 to-fuchsia-400',
  },
  Vistara: {
    ring: 'ring-amber-200/60',
    fill: 'bg-amber-50',
    text: 'text-amber-800',
    accent: 'from-amber-500 to-orange-300',
  },
  SpiceJet: {
    ring: 'ring-orange-200/60',
    fill: 'bg-orange-50',
    text: 'text-orange-700',
    accent: 'from-orange-500 to-red-400',
  },
  'Air India Express': {
    ring: 'ring-teal-200/60',
    fill: 'bg-teal-50',
    text: 'text-teal-700',
    accent: 'from-teal-500 to-emerald-400',
  },
}

export function AirlineMark({ airline, code, logoUrl, compact = false }: AirlineMarkProps) {
  const brand = brandStyles[airline] ?? {
    ring: 'ring-slate-200/60',
    fill: 'bg-slate-50',
    text: 'text-slate-700',
    accent: 'from-slate-600 to-slate-400',
  }

  return (
    <div
      className={`inline-flex items-center gap-2 rounded-full border border-white/60 bg-white/90 px-2 py-1 shadow-sm ring-1 ${brand.ring} ${compact ? 'pr-3' : 'pr-4'}`}
    >
      <div className={`grid h-8 w-8 place-items-center overflow-hidden rounded-full bg-gradient-to-br ${brand.accent} text-white shadow-sm`}>
        {logoUrl ? (
          <img
            src={logoUrl}
            alt={`${airline} logo`}
            className="h-full w-full rounded-full bg-white object-cover p-1.5"
            loading="lazy"
            referrerPolicy="no-referrer"
          />
        ) : (
          <span className="text-[11px] font-bold tracking-[0.08em]">{code}</span>
        )}
      </div>
      <div className="flex flex-col leading-none">
        <span className={`text-xs font-semibold ${brand.text}`}>{airline}</span>
        {!compact ? <span className="text-[10px] uppercase tracking-[0.16em] text-slate-400">Airline</span> : null}
      </div>
    </div>
  )
}
