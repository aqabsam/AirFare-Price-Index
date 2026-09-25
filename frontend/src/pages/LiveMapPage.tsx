import { useEffect, useMemo, useState } from 'react'
import { MapPinned, PlaneTakeoff } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { RouteMap } from '@/components/RouteMap'
import { fetchAirfareIndex } from '@/services/fareApi'
import type { FareRouteSummary } from '@/types/fare'

type LiveMapPageProps = {
  theme: 'dark' | 'light'
}

function formatPrice(value: number, currency: string) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(value)
}

export function LiveMapPage({ theme }: LiveMapPageProps) {
  const [searchParams] = useSearchParams()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [route, setRoute] = useState<FareRouteSummary | null>(null)

  const query = useMemo(() => {
    return {
      origin: searchParams.get('origin') || 'PAT',
      destination: searchParams.get('destination') || 'BOM',
      departureDate: searchParams.get('departureDate') || searchParams.get('date') || undefined,
    }
  }, [searchParams])
  const filters = useMemo(
    () => ({
      origin: searchParams.get('origin') || undefined,
      destination: searchParams.get('destination') || undefined,
      departureDate: searchParams.get('departureDate') || searchParams.get('date') || undefined,
    }),
    [searchParams],
  )

  useEffect(() => {
    let active = true

    async function loadRoute() {
      setLoading(true)
      setError('')

      try {
        const result = await fetchAirfareIndex(filters)
         if (active) {
          const requestedRoute = result.routes.find(
            (candidate) => candidate.origin === query.origin.toUpperCase() && candidate.destination === query.destination.toUpperCase(),
          )
          setRoute(requestedRoute ?? result.routes[0] ?? null)
            }
      } catch (searchError) {
        if (active) {
          setRoute(null)
          setError(searchError instanceof Error ? searchError.message : 'Unable to load the selected route.')
        }
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    void loadRoute()
    return () => {
      active = false
    }
  }, [filters, query])

  const origin = route?.origin ?? query.origin
  const destination = route?.destination ?? query.destination
  const routeTitle = `${origin} → ${destination}`
  const airline = route?.topCarrier
  const fare = route ? formatPrice(route.cheapestPrice, route.currency) : null
   const summary = route ? `${airline} • ${fare}` : 'Waiting for verified fare data'

  return (
    <section className={`min-h-[70vh] py-10 ${theme === 'dark' ? 'bg-slate-950' : 'bg-slate-50'}`}>
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className={`rounded-[32px] border shadow-[0_18px_60px_rgba(15,23,42,0.08)] ${theme === 'dark' ? 'border-white/10 bg-white/5 text-white' : 'border-slate-200/70 bg-white text-slate-950'}`}>
          <div className="grid gap-8 p-6 lg:grid-cols-[0.9fr_1.1fr] lg:p-8 xl:p-10">
            <div>
              <p className={`text-sm font-semibold uppercase tracking-[0.24em] ${theme === 'dark' ? 'text-teal-200' : 'text-teal-700'}`}>
                Live Map
              </p>
              <h1 className={`mt-3 text-4xl font-bold sm:text-5xl ${theme === 'dark' ? 'text-white' : 'text-slate-950'}`}>
                Route map for the selected flight search
              </h1>
              <p className={`mt-4 text-base leading-8 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>
                Real India geographic map with live airport pins, route connection, and fare details for the current search.
                              </p>

              <div className="mt-6 space-y-3">
                <div className={`rounded-2xl border p-4 ${theme === 'dark' ? 'border-white/10 bg-slate-950/60' : 'border-slate-200 bg-slate-50'}`}>
                  <p className={`text-xs font-semibold uppercase tracking-[0.2em] ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                    Route
                  </p>
                  <p className="mt-2 text-xl font-bold">{routeTitle}</p>
                </div>

                <div className={`rounded-2xl border p-4 ${theme === 'dark' ? 'border-white/10 bg-slate-950/60' : 'border-slate-200 bg-slate-50'}`}>
                  <p className={`text-xs font-semibold uppercase tracking-[0.2em] ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                    Current fare
                  </p>
                  <p className="mt-2 text-xl font-bold">{summary}</p>
                </div>

                <div className={`rounded-2xl border p-4 ${theme === 'dark' ? 'border-white/10 bg-slate-950/60' : 'border-slate-200 bg-slate-50'}`}>
                  <p className={`text-xs font-semibold uppercase tracking-[0.2em] ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                    Airports
                  </p>
                  <p className="mt-2 text-sm leading-6">
                    {origin} → {destination}
                  </p>
                </div>
              </div>
            </div>

            <div className={`rounded-[28px] border p-4 ${theme === 'dark' ? 'border-white/10 bg-[#0b1b2b]' : 'border-slate-200 bg-[#edf7f7]'}`}>
              {error ? (
                <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {error}
                </div>
              ) : null}

              <div className="relative overflow-hidden rounded-[24px] border border-teal-500/20 p-2">
                <RouteMap origin={origin} destination={destination} theme={theme} routeLabel={routeTitle} airline={airline} fare={fare ?? undefined} />
              </div>

              <div className={`mt-4 rounded-2xl border p-4 ${theme === 'dark' ? 'border-white/10 bg-slate-950/60' : 'border-slate-200 bg-slate-50'}`}>
                <div className="flex flex-wrap items-center gap-3">
                  <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold ${theme === 'dark' ? 'border-white/10 bg-slate-950/60 text-white' : 'border-slate-200 bg-white text-slate-900'}`}>
                    <MapPinned size={14} className="text-amber-300" />
                    {origin}
                  </div>
                  <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold ${theme === 'dark' ? 'border-white/10 bg-slate-950/60 text-white' : 'border-slate-200 bg-white text-slate-900'}`}>
                    <PlaneTakeoff size={14} className="text-teal-300" />
                    {destination}
                  </div>
                </div>

                <div className="mt-4 space-y-2 text-sm">
                  <div className="flex justify-between gap-3">
                    <span className={theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}>Airline</span>
                    <span className="font-semibold">{airline ?? 'No verified fare data available'}</span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className={theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}>Flight</span>
                    <span className="font-semibold">{route ? 'Verified fare route' : 'No verified fare data available'}</span>
                       </div>
                  <div className="flex justify-between gap-3">
                    <span className={theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}>Fare</span>
                    <span className="font-semibold text-teal-500">{fare ?? 'No verified fare data available'}</span>
                  </div>
                </div>
              </div>

              {loading ? (
                <div className={`mt-4 rounded-2xl border px-4 py-3 text-sm ${theme === 'dark' ? 'border-white/10 bg-slate-950/60 text-slate-300' : 'border-slate-200 bg-slate-50 text-slate-600'}`}>
                  Loading the selected route…
                </div>
              ) : null}

              {!loading && !error && !route ? (
                <div className={`mt-4 rounded-2xl border px-4 py-3 text-sm ${theme === 'dark' ? 'border-rose-500/30 bg-rose-500/10 text-rose-200' : 'border-rose-200 bg-rose-50 text-rose-700'}`}>
                  No verified fare data available
                   </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
