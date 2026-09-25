import { BadgeIndianRupee, Clock3, PlaneTakeoff, ScanSearch } from 'lucide-react'
import { AirlineMark } from '@/components/AirlineMark'
import { getAirlineBrand, getAirlineBrandByCode } from '@/data/airlines'
import type { FlightOffer, FlightSearchResult } from '@/types/flight'
import airplaneImage from '../../../airpalne-removebg-preview.png'

type FlightResultsProps = {
  result: FlightSearchResult | null
  loading?: boolean
  theme: 'dark' | 'light'
}

function formatPrice(price: number, currency: string) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(price)
}

function formatCollectedAt(value: string) {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(parsed)
}

export function FlightResults({ result, loading = false, theme }: FlightResultsProps) {
  if (loading) {
    return <LoadingState theme={theme} />
  }

  if (!result) {
    return null
  }

  if (result.totalResults === 0) {
    return (
      <section id="results" className="mx-auto w-full max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div
          className={`rounded-[28px] border p-8 text-center shadow-[0_18px_60px_rgba(15,23,42,0.08)] ${
            theme === 'dark'
              ? 'border-white/10 bg-slate-950 text-slate-200'
              : 'border-slate-200/70 bg-white text-slate-700'
          }`}
        >
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-slate-950 text-white">
            <ScanSearch size={22} />
          </div>
          <h2 className={`mt-4 text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-950'}`}>
            {result.message ?? 'No matching flight offers were found for this search.'}
          </h2>
          <p className={`mt-2 text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
            The search completed without any flights to display.
          </p>
        </div>
      </section>
    )
  }

  const cheapest = result.cheapestOffer
  const cheapestBrand = cheapest ? getAirlineBrandByCode(cheapest.airlineCode) ?? getAirlineBrand(cheapest.airline) : undefined
  const latestCollectedAt = result.offers.reduce((latest, offer) => {
    const collectedAt = new Date(offer.collectedAt).getTime()
    if (Number.isNaN(collectedAt)) {
      return latest
    }

    return collectedAt > latest ? collectedAt : latest
  }, 0)

  const latestCollectedLabel = latestCollectedAt
    ? new Intl.DateTimeFormat('en-IN', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(new Date(latestCollectedAt))
    : 'Live check pending'
  const availableAirlines = [...new Map(
    result.offers.map((offer) => [offer.airlineCode || offer.airline, offer]),
  ).values()]

  return (
    <section id="results" className="mx-auto w-full max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <div
        className={`flex flex-col gap-4 rounded-[28px] border p-6 shadow-[0_18px_60px_rgba(15,23,42,0.08)] transition-all duration-300 lg:p-8 ${
          theme === 'dark'
            ? 'border-slate-200/10 bg-slate-950 text-white shadow-slate-950/20'
            : 'border-slate-200/70 bg-white text-slate-950'
        }`}
      >
        {result.message ? (
          <div
            className={`rounded-[20px] border px-5 py-4 text-sm font-semibold ${
              theme === 'dark' ? 'border-amber-300/20 bg-amber-300/10 text-amber-100' : 'border-amber-200 bg-amber-50 text-amber-900'
            }`}
          >
            {result.message}
          </div>
        ) : null}
        <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-4">
            <div
              className={`inline-flex items-center gap-3 rounded-[24px] border px-4 py-3 shadow-sm ${
                theme === 'dark'
                  ? 'border-white/10 bg-white/5 text-white'
                  : 'border-slate-200 bg-slate-50 text-slate-950'
              }`}
            >
              <div
                className={`grid h-11 w-11 place-items-center rounded-2xl ${
                  theme === 'dark' ? 'bg-teal-300 text-slate-950' : 'bg-slate-950 text-white'
                }`}
              >
                <PlaneTakeoff size={18} />
              </div>
              <div>
                <p
                  className={`text-xs font-semibold uppercase tracking-[0.22em] ${
                    theme === 'dark' ? 'text-teal-200' : 'text-teal-700'
                  }`}
                >
                  Flight route
                </p>
                <p className={`text-sm font-semibold ${theme === 'dark' ? 'text-white' : 'text-slate-950'}`}>
                  {result.routeLabel}
                </p>
              </div>
            </div>

            <p
              className={`text-sm font-semibold uppercase tracking-[0.24em] ${
                theme === 'dark' ? 'text-teal-200' : 'text-teal-700'
              }`}
            >
              Search result
            </p>
            <h2 className={`mt-2 text-3xl font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-950'}`}>
              {result.routeLabel}
            </h2>
            <div className={`grid gap-3 sm:grid-cols-2 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>
              <InfoCard theme={theme} label="From" value={result.originLabel} />
              <InfoCard theme={theme} label="To" value={result.destinationLabel} />
            </div>
          </div>

          <div className="grid w-full gap-3 sm:grid-cols-2 lg:max-w-[720px] lg:grid-cols-4">
            <Stat theme={theme} label="Offers found" value={String(result.totalResults)} />
            <Stat
              theme={theme}
              label="Average fare"
              value={result.averagePrice ? formatPrice(result.averagePrice, cheapest?.currency ?? 'INR') : 'N/A'}
            />
            <Stat theme={theme} label="Travel date" value={result.travelDate || 'Select date'} />
            <Stat theme={theme} label="Last live check" value={latestCollectedLabel} />
          </div>
        </div>

        <div
          className={`rounded-[24px] border px-5 py-4 ${
            theme === 'dark' ? 'border-white/10 bg-slate-900/70' : 'border-slate-200 bg-slate-50'
          }`}
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className={`text-xs font-semibold uppercase tracking-[0.2em] ${theme === 'dark' ? 'text-teal-200' : 'text-teal-700'}`}>
                Available airlines
              </p>
              <p className={`mt-1 text-sm ${theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>
                Carriers returned for this route and date
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {availableAirlines.map((offer) => {
                const brand = getAirlineBrandByCode(offer.airlineCode) ?? getAirlineBrand(offer.airline)
                return (
                  <div
                    key={offer.airlineCode || offer.airline}
                    className={`rounded-2xl border px-3 py-2 ${
                      theme === 'dark' ? 'border-white/10 bg-white/5' : 'border-slate-200 bg-white'
                    }`}
                  >
                    <AirlineMark airline={offer.airline} code={offer.airlineCode} logoUrl={brand?.logoUrl} compact />
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {cheapest ? (
          <div
            className={`rounded-[24px] border p-5 transition-all duration-300 ${
              theme === 'dark'
                ? 'border-teal-300/20 bg-gradient-to-br from-slate-900 to-slate-800'
                : 'border-teal-200/70 bg-gradient-to-br from-teal-50 to-amber-50'
            }`}
          >
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex min-w-0 items-start gap-4">
              <div
                className={`grid h-14 w-14 place-items-center rounded-2xl ${
                  theme === 'dark' ? 'bg-teal-300 text-slate-950' : 'bg-slate-950 text-white'
                }`}
              >
                  {cheapestBrand?.logoUrl ? (
                    <img
                      src={cheapestBrand.logoUrl}
                      alt={`${cheapest.airline} logo`}
                      className="h-10 w-10 rounded-full bg-white object-cover p-1"
                      loading="lazy"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <PlaneTakeoff size={22} />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className={`text-sm font-semibold ${theme === 'dark' ? 'text-teal-200' : 'text-teal-800'}`}>
                    Cheapest airline
                  </p>
                  <h3 className={`mt-1 break-words text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-950'}`}>
                    {cheapest.airline}{' '}
                    <span className={theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}>
                      ({cheapest.airlineCode})
                    </span>
                  </h3>
                  <div className={`mt-2 flex flex-wrap gap-3 text-sm ${theme === 'dark' ? 'text-slate-200' : 'text-slate-700'}`}>
                    <span
                      className={`inline-flex items-center gap-2 rounded-full px-3 py-2 shadow-sm ${
                        theme === 'dark' ? 'bg-slate-800' : 'bg-white'
                      }`}
                    >
                      <Clock3 size={14} />
                      {cheapest.departureTime} - {cheapest.arrivalTime}
                    </span>
                    <span
                      className={`inline-flex items-center gap-2 rounded-full px-3 py-2 shadow-sm ${
                        theme === 'dark' ? 'bg-slate-800' : 'bg-white'
                      }`}
                    >
                      <BadgeIndianRupee size={14} />
                      {cheapest.duration}
                    </span>
                    <span
                      className={`inline-flex items-center gap-2 rounded-full px-3 py-2 shadow-sm ${
                        theme === 'dark' ? 'bg-slate-800' : 'bg-white'
                      }`}
                    >
                      {cheapest.stops === 0 ? 'Non-stop' : `${cheapest.stops} stop${cheapest.stops > 1 ? 's' : ''}`}
                    </span>
                  </div>
                  <div className="mt-3">
                    <AirlineMark
                      airline={cheapest.airline}
                      code={cheapest.airlineCode}
                      logoUrl={cheapestBrand?.logoUrl}
                    />
                  </div>
                  <div className="mt-3">
                    <SourceBadge offer={cheapest} theme={theme} />
                  </div>
                  <div className={`mt-4 grid gap-3 sm:grid-cols-2 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>
                    <InfoCard theme={theme} label="Collected at" value={formatCollectedAt(cheapest.collectedAt)} />
                    <InfoCard theme={theme} label="Confidence" value={`${Math.round(cheapest.confidence * 100)}%`} />
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
                    {[
                      ['Base fare', cheapest.baseFare],
                      ['Taxes', cheapest.taxes],
                      ['UDF', cheapest.udf],
                      ['Convenience', cheapest.convenienceFee],
                      ['Total', cheapest.totalFare ?? cheapest.price],
                    ].map(([label, value]) => (
                      <div key={String(label)} className={`rounded-xl border px-3 py-2 ${theme === 'dark' ? 'border-white/10 bg-white/5' : 'border-slate-200 bg-white'}`}>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</p>
                        <p className={`mt-1 text-sm font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-950'}`}>
                          {typeof value === 'number' ? formatPrice(value, cheapest.currency) : 'Unavailable'}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div
                className={`w-full shrink-0 rounded-[20px] px-5 py-4 lg:w-auto lg:min-w-[220px] ${
                  theme === 'dark' ? 'bg-white text-slate-950' : 'bg-slate-950 text-white'
                }`}
              >
                <p className={`text-sm ${theme === 'dark' ? 'text-slate-500' : 'text-slate-300'}`}>Lowest price</p>
                <p className="mt-1 text-3xl font-bold">{formatPrice(cheapest.price, cheapest.currency)}</p>
                <p className={`mt-1 text-sm ${theme === 'dark' ? 'text-slate-500' : 'text-slate-300'}`}>
                  Offer ID: {cheapest.offerId}
                </p>
              </div>
            </div>
          </div>
        ) : null}

        <div className="grid gap-3 md:hidden">
          {result.offers.map((offer, index) => (
            <FlightOfferCard
              key={`mobile-${offer.offerId}`}
              offer={offer}
              theme={theme}
              isCheapest={index === 0}
            />
          ))}
        </div>

        <div className={`hidden overflow-x-auto rounded-[24px] border md:block ${theme === 'dark' ? 'border-white/10' : 'border-slate-200'}`}>
          <table
            className={`min-w-[1120px] divide-y ${theme === 'dark' ? 'divide-slate-800 bg-slate-950' : 'divide-slate-200 bg-white'}`}
          >
            <thead className={`text-left text-sm ${theme === 'dark' ? 'bg-slate-900 text-slate-200' : 'bg-slate-950 text-slate-200'}`}>
              <tr>
                <th className="px-5 py-4 font-semibold">Airline</th>
                <th className="px-5 py-4 font-semibold">Flight</th>
                <th className="px-5 py-4 font-semibold">Departure</th>
                <th className="px-5 py-4 font-semibold">Arrival</th>
                <th className="px-5 py-4 font-semibold">Duration</th>
                <th className="px-5 py-4 font-semibold">Stops</th>
                <th className="px-5 py-4 font-semibold">Updated</th>
                <th className="px-5 py-4 font-semibold text-right">Price</th>
              </tr>
            </thead>
            <tbody className={theme === 'dark' ? 'divide-y divide-slate-800' : 'divide-y divide-slate-100'}>
              {result.offers.map((offer, index) => {
                const isCheapest = index === 0
                return (
                  <FlightRow
                    key={offer.offerId}
                    offer={offer}
                    theme={theme}
                    isCheapest={isCheapest}
                  />
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}

function FlightOfferCard({
  offer,
  theme,
  isCheapest,
}: {
  offer: FlightOffer
  theme: 'dark' | 'light'
  isCheapest: boolean
}) {
  const brand = getAirlineBrandByCode(offer.airlineCode) ?? getAirlineBrand(offer.airline)
  const airlineName = brand?.airline ?? offer.airline

  return (
    <article
      className={`rounded-[24px] border p-4 shadow-sm ${
        isCheapest
          ? theme === 'dark'
            ? 'border-teal-300/40 bg-teal-300/10'
            : 'border-teal-300 bg-teal-50/70'
          : theme === 'dark'
            ? 'border-white/10 bg-slate-900/80'
            : 'border-slate-200 bg-white'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col items-start gap-2">
          <AirlineMark airline={airlineName} code={offer.airlineCode} logoUrl={brand?.logoUrl} compact />
          <SourceBadge offer={offer} theme={theme} />
        </div>
        <div className="text-right">
          <p className={`text-xs font-semibold uppercase tracking-[0.16em] ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
            Fare
          </p>
          <p className={`mt-1 text-xl font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-950'}`}>
            {formatPrice(offer.price, offer.currency)}
          </p>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <div>
          <p className={`text-xl font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-950'}`}>{offer.departureTime}</p>
          <p className={`text-xs font-semibold ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>{offer.origin}</p>
        </div>
        <div className="min-w-0 flex-1 px-2 text-center">
          <p className={`truncate text-xs font-semibold ${theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>{offer.duration}</p>
          <div className={`my-2 border-t border-dashed ${theme === 'dark' ? 'border-teal-300/50' : 'border-teal-500/50'}`} />
          <p className={`text-xs font-medium ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
            {offer.stops === 0 ? 'Non-stop' : `${offer.stops} stop${offer.stops > 1 ? 's' : ''}`}
          </p>
        </div>
        <div className="text-right">
          <p className={`text-xl font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-950'}`}>{offer.arrivalTime}</p>
          <p className={`text-xs font-semibold ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>{offer.destination}</p>
        </div>
      </div>

      <div className={`mt-4 flex items-center justify-between border-t pt-3 text-xs ${theme === 'dark' ? 'border-white/10 text-slate-400' : 'border-slate-200 text-slate-500'}`}>
        <span>{offer.flightNumber}</span>
        <span>{isCheapest ? 'Best price' : formatCollectedAt(offer.collectedAt)}</span>
      </div>
    </article>
  )
}

function FlightRow({
  offer,
  theme,
  isCheapest,
}: {
  offer: FlightOffer
  theme: 'dark' | 'light'
  isCheapest: boolean
}) {
  const brand = getAirlineBrandByCode(offer.airlineCode) ?? getAirlineBrand(offer.airline)
  const airlineName = brand?.airline ?? offer.airline

  return (
    <tr
      className={
        isCheapest
          ? theme === 'dark'
            ? 'bg-teal-500/10'
            : 'bg-teal-50/70'
          : theme === 'dark'
            ? 'bg-slate-950'
            : 'bg-white'
      }
    >
      <td className="px-5 py-4">
        <div className="flex flex-col items-start gap-2">
          <AirlineMark airline={airlineName} code={offer.airlineCode} logoUrl={brand?.logoUrl} compact />
          <SourceBadge offer={offer} theme={theme} />
        </div>
      </td>
      <td className={`whitespace-nowrap px-5 py-4 text-sm font-semibold ${theme === 'dark' ? 'text-slate-100' : 'text-slate-900'}`}>
        {offer.flightNumber}
      </td>
      <td className={`whitespace-nowrap px-5 py-4 text-sm ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>
        {offer.origin} {offer.departureTime}
      </td>
      <td className={`whitespace-nowrap px-5 py-4 text-sm ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>
        {offer.destination} {offer.arrivalTime}
      </td>
      <td className={`whitespace-nowrap px-5 py-4 text-sm ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>{offer.duration}</td>
      <td className="px-5 py-4">
        <span className={`rounded-full px-3 py-1 text-sm ${theme === 'dark' ? 'bg-slate-800 text-slate-200' : 'bg-slate-100 text-slate-700'}`}>
          {offer.stops === 0 ? 'Non-stop' : `${offer.stops} stop${offer.stops > 1 ? 's' : ''}`}
        </span>
      </td>
      <td className={`whitespace-nowrap px-5 py-4 text-sm ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>
        {formatCollectedAt(offer.collectedAt)}
      </td>
      <td className={`whitespace-nowrap px-5 py-4 text-right text-lg font-semibold ${theme === 'dark' ? 'text-white' : 'text-slate-950'}`}>
        {formatPrice(offer.price, offer.currency)}
      </td>
    </tr>
  )
}

function getSourceLabel(offer: FlightOffer) {
  if (offer.sourceType === 'duffel' || offer.source.trim().toLowerCase() === 'duffel api') {
    return 'Duffel API'
  }

  if (offer.sourceType === 'demo' || offer.source.trim().toLowerCase() === 'demo data') {
    return 'Demo Data (Fallback)'
  }

  return offer.source || 'Unknown source'
}

function SourceBadge({ offer, theme }: { offer: FlightOffer; theme: 'dark' | 'light' }) {
  const label = getSourceLabel(offer)

  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] ${
        offer.sourceType === 'demo'
          ? theme === 'dark'
            ? 'bg-amber-300/15 text-amber-200'
            : 'bg-amber-100 text-amber-800'
          : theme === 'dark'
            ? 'bg-teal-300/15 text-teal-200'
            : 'bg-teal-100 text-teal-800'
      }`}
    >
      {label}
    </span>
  )
}

function InfoCard({ label, value, theme }: { label: string; value: string; theme: 'dark' | 'light' }) {
  return (
    <div
      className={`rounded-2xl border px-4 py-3 ${
        theme === 'dark' ? 'border-white/10 bg-white/5' : 'border-slate-200 bg-slate-50'
      }`}
    >
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">{label}</p>
      <div className={`mt-2 text-sm font-medium ${theme === 'dark' ? 'text-white' : 'text-slate-950'}`}>{value}</div>
    </div>
  )
}

function Stat({ label, value, theme }: { label: string; value: string; theme: 'dark' | 'light' }) {
  return (
    <div
      className={`w-full rounded-2xl border px-4 py-3 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md ${
        theme === 'dark'
          ? 'border-white/10 bg-slate-900 text-white'
          : 'border-slate-200 bg-slate-50 text-slate-950'
      }`}
    >
      <p className={`text-xs font-semibold uppercase tracking-[0.18em] ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
        {label}
      </p>
      <p className={`mt-1 break-words text-base font-bold sm:text-lg ${theme === 'dark' ? 'text-white' : 'text-slate-950'}`}>
        {value}
      </p>
    </div>
  )
}

function LoadingState({ theme }: { theme: 'dark' | 'light' }) {
  return (
    <section id="results" className="mx-auto w-full max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <div
        className={`rounded-[28px] border p-6 shadow-[0_18px_60px_rgba(15,23,42,0.08)] lg:p-8 ${
          theme === 'dark' ? 'border-slate-200/10 bg-slate-950 text-white' : 'border-slate-200/70 bg-white text-slate-950'
        }`}
      >
        <div
          className={`overflow-hidden rounded-[24px] border ${
            theme === 'dark' ? 'border-teal-300/20 bg-teal-300/10' : 'border-teal-200 bg-teal-50'
          }`}
          role="status"
          aria-live="polite"
        >
          <div className={`flight-loader-stage relative flex h-56 items-center overflow-hidden sm:h-64 ${theme === 'dark' ? 'bg-slate-900/60' : 'bg-white/70'}`}>
            <div className="flight-loader-route absolute inset-x-8 top-1/2 border-t border-dashed border-teal-300/50" />
            <img src={airplaneImage} alt="" aria-hidden="true" className="flight-loader-plane absolute h-40 w-64 object-contain sm:h-48 sm:w-80" />
          </div>
          <div className="flex items-center gap-3 px-5 py-4">
            <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${theme === 'dark' ? 'bg-teal-300 text-slate-950' : 'bg-slate-950 text-white'}`}>
              <PlaneTakeoff size={18} />
            </div>
            <div>
              <p className={`text-sm font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-950'}`}>Searching available flights</p>
              <p className={`text-xs ${theme === 'dark' ? 'text-teal-100/70' : 'text-teal-800/70'}`}>Checking Duffel API and Demo Data for this route...</p>
            </div>
          </div>
        </div>
        <div className="mt-6 grid gap-3 md:grid-cols-3">
          <div className="h-20 animate-pulse rounded-2xl bg-slate-200/60" />
          <div className="h-20 animate-pulse rounded-2xl bg-slate-200/60" />
          <div className="h-20 animate-pulse rounded-2xl bg-slate-200/60" />
        </div>
        <div className="mt-6 h-28 animate-pulse rounded-[24px] bg-slate-200/60" />
        <div className="mt-6 overflow-hidden rounded-[24px] border border-slate-200/70">
          <div className="h-12 animate-pulse bg-slate-200/70" />
          <div className="h-14 animate-pulse border-t border-slate-200/60 bg-slate-100/80" />
          <div className="h-14 animate-pulse border-t border-slate-200/60 bg-slate-100/80" />
        </div>
      </div>
    </section>
  )
}
