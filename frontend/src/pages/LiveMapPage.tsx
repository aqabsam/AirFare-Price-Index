import { MapPinned, PlaneTakeoff } from 'lucide-react'
import { RouteMap } from '@/components/RouteMap'
import { EmptyFareState } from '@/components/EmptyFareState'
import { useSearchState } from '@/state/searchContext'
import type { FlightOffer, FlightSearchInput } from '@/types/flight'

type LiveMapPageProps = {
  theme: 'dark' | 'light'
}

function formatPrice(value: number, currency: string) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 0 }).format(value)
}

function offerMatchesSearch(offer: FlightOffer, input: FlightSearchInput) {
  const segments = offer.segments ?? []
  const totalFare = offer.totalFare
  return offer.origin === input.origin && offer.destination === input.destination &&
    segments.length > 0 && segments[0]?.origin === input.origin && segments.at(-1)?.destination === input.destination &&
    segments.every((segment, index) => index === 0 || segments[index - 1]?.destination === segment.origin) &&
    segments[0]?.departureDate === input.travelDate &&
    offer.departureTime === segments[0]?.departureTime && offer.arrivalTime === segments.at(-1)?.arrivalTime &&
    offer.stops === segments.length - 1 && segments.every((segment) => segment.airline.trim() && segment.airlineCode.trim() && segment.flightNumber.trim()) &&
    Number.isFinite(totalFare) && (totalFare ?? 0) > 0 && Number.isFinite(Date.parse(offer.collectedAt))
}

export function LiveMapPage({ theme }: LiveMapPageProps) {
  const { data } = useSearchState()
  const input = data?.input
  const successfulStatus = data && ['live_success', 'duffel_success'].includes(data.result.status)
  const offers = successfulStatus && input ? data.result.offers.filter((offer) => offerMatchesSearch(offer, input)) : []
  const currentOffer = offers[0]
  const fare = currentOffer && typeof currentOffer.totalFare === 'number'
    ? formatPrice(currentOffer.totalFare, currentOffer.currency)
    : undefined

  if (!input || !currentOffer || !successfulStatus) {
    return <EmptyFareState theme={theme} />
  }

  const routeLabel = `${input.origin} → ${input.destination}`

  return (
    <section className={`min-h-[70vh] py-10 ${theme === 'dark' ? 'bg-slate-950' : 'bg-slate-50'}`}>
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <header className={`border-b pb-6 ${theme === 'dark' ? 'border-white/10' : 'border-slate-200'}`}>
          <p className={`text-xs font-semibold uppercase tracking-[0.2em] ${theme === 'dark' ? 'text-teal-200' : 'text-teal-700'}`}>Latest Verified Flight Search</p>
          <h1 className={`mt-2 text-3xl font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-950'}`}>Live Route Map</h1>
          <p className={`mt-2 text-sm ${theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>{routeLabel} · {input.travelDate}</p>
        </header>

        <div className="mt-6 grid gap-6 lg:grid-cols-[0.75fr_1.25fr]">
          <div className="space-y-3">
            <div className={`border p-4 ${theme === 'dark' ? 'border-white/10 bg-slate-900/70 text-white' : 'border-slate-200 bg-white text-slate-950'}`}>
              <p className="text-xs font-semibold uppercase text-slate-500">Searched route</p>
              <p className="mt-2 text-xl font-bold">{routeLabel}</p>
              <p className="mt-1 text-sm text-slate-500">Departure date: {input.travelDate}</p>
            </div>
            <div className={`border p-4 ${theme === 'dark' ? 'border-white/10 bg-slate-900/70 text-white' : 'border-slate-200 bg-white text-slate-950'}`}>
              <p className="text-xs font-semibold uppercase text-slate-500">Verified offers</p>
              <p className="mt-2 text-xl font-bold">{offers.length}</p>
            </div>
            <div className={`border p-4 ${theme === 'dark' ? 'border-white/10 bg-slate-900/70 text-white' : 'border-slate-200 bg-white text-slate-950'}`}>
              <p className="text-xs font-semibold uppercase text-slate-500">Verified itinerary</p>
              <p className="mt-2 text-lg font-bold">{currentOffer.airline}</p>
              <p className="mt-1 text-sm">{currentOffer.flightNumber}</p>
              <p className="mt-2 text-sm font-semibold">{currentOffer.departureTime} → {currentOffer.arrivalTime}</p>
              <p className="mt-1 text-sm text-slate-500">{currentOffer.duration} · {currentOffer.stops === 0 ? 'Non-stop' : `${currentOffer.stops} stop${currentOffer.stops === 1 ? '' : 's'}`}</p>
              {fare ? <p className="mt-3 text-lg font-bold text-teal-600 dark:text-teal-300">{fare}</p> : null}
            </div>
          </div>

          <div className={`min-w-0 border p-3 ${theme === 'dark' ? 'border-white/10 bg-slate-900/70' : 'border-slate-200 bg-white'}`}>
            <RouteMap
              origin={input.origin}
              destination={input.destination}
              theme={theme}
              routeLabel={routeLabel}
              airline={currentOffer.airline}
              flightNumber={currentOffer.flightNumber}
              fare={fare}
              travelDate={input.travelDate}
              searchedAt={currentOffer.collectedAt}
            />
            <p className={`mt-3 flex items-center gap-2 text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
              <MapPinned size={15} /> Route line connects the searched origin and destination.
            </p>
            <p className={`mt-2 flex items-center gap-2 text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
              <PlaneTakeoff size={15} /> Flight details come from verified offers for this search.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
