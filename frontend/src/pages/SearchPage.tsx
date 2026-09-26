import { useMemo, useRef, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { FlightResults } from '@/components/FlightResults'
import { SearchSection } from '@/components/SearchSection'
import { findAirport } from '@/data/airports'
import { useSearchState } from '@/state/searchContext'
import { hideProviderBrand } from '@/services/displayText'
import type { FlightSearchInput } from '@/types/flight'

type SearchPageProps = {
  theme: 'dark' | 'light'
}

function getLocalDate() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const today = getLocalDate()
const initialSearch: FlightSearchInput = {
  origin: '',
  destination: '',
  travelDate: today,
  adults: 1,
}

export function SearchPage({ theme }: SearchPageProps) {
  const [searchParams, setSearchParams] = useSearchParams()
  const initialQuery = useMemo<FlightSearchInput>(
    () => ({
      origin: searchParams.get('origin') || initialSearch.origin,
      destination: searchParams.get('destination') || initialSearch.destination,
      travelDate: searchParams.get('departureDate') || searchParams.get('date') || initialSearch.travelDate,
      adults: Number.parseInt(searchParams.get('adults') || '', 10) || initialSearch.adults,
    }),
    [searchParams],
  )

  const [query, setQuery] = useState<FlightSearchInput>(initialQuery)
  const resultsRef = useRef<HTMLDivElement | null>(null)
  const { data, loading, error, executeSearch } = useSearchState()

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    try {
      await executeSearch(query)
      const originCode = findAirport(query.origin)?.code ?? query.origin
      const destinationCode = findAirport(query.destination)?.code ?? query.destination
      setSearchParams(
        {
          origin: originCode,
          destination: destinationCode,
          departureDate: query.travelDate,
          adults: String(query.adults),
        },
        { replace: true },
      )
    } catch {
      // The shared search state exposes the request error to every section.
    }
  }

  return (
    <section className={theme === 'dark' ? 'bg-slate-950' : 'bg-slate-50'}>
      <SearchSection value={query} loading={loading} onChange={setQuery} onSubmit={handleSubmit} theme={theme} />

      {error ? (
        <div className="mx-auto w-full max-w-7xl px-4 pb-6 sm:px-6 lg:px-8">
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 shadow-sm">
            {hideProviderBrand(error)}
          </div>
        </div>
      ) : null}

      <div ref={resultsRef} className="mx-auto w-full max-w-7xl px-4 pb-10 sm:px-6 lg:px-8">
        <FlightResults result={data?.result ?? null} loading={loading} theme={theme} />
      </div>
    </section>
  )
}
