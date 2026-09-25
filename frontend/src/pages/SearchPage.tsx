import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { FlightResults } from '@/components/FlightResults'
import { SearchSection } from '@/components/SearchSection'
import { searchFlights } from '@/services/flightApi'
import type { FlightSearchInput } from '@/types/flight'
import type { FlightSearchResult } from '@/types/flight'

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
const MINIMUM_LOADING_TIME_MS = 5_000
const LAST_AIRFARE_ROUTE_KEY = 'last-airfare-route'

const initialSearch: FlightSearchInput = {
  origin: 'Patna - Jay Prakash Narayan Airport (PAT)',
  destination: 'Mumbai - Chhatrapati Shivaji Maharaj International Airport (BOM)',
  travelDate: today,
  adults: 1,
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message
  }

  return 'Unable to load flight pricing right now. Please try again.'
}

function waitForMinimumLoadingTime() {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, MINIMUM_LOADING_TIME_MS)
  })
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
  const [result, setResult] = useState<FlightSearchResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const resultsRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    let active = true

    async function loadInitialResult() {
      setLoading(true)
      setError('')

      try {
        const [response] = await Promise.all([searchFlights(initialQuery), waitForMinimumLoadingTime()])
        if (active) {
          setResult(response)
        }
      } catch (error) {
        if (active) {
          setError(getErrorMessage(error))
        }
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    void loadInitialResult()

    return () => {
      active = false
    }
  }, [initialQuery])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError('')

    try {
      const [response] = await Promise.all([searchFlights(query), waitForMinimumLoadingTime()])
      setResult(response)
      window.localStorage.setItem(
        LAST_AIRFARE_ROUTE_KEY,
        JSON.stringify({ origin: query.origin, destination: query.destination }),
      )
      window.dispatchEvent(new CustomEvent('airfare-route-change', {
        detail: { origin: query.origin, destination: query.destination },
      }))
      setSearchParams(
        {
          origin: query.origin,
          destination: query.destination,
          departureDate: query.travelDate,
          adults: String(query.adults),
        },
        { replace: true },
      )
      window.requestAnimationFrame(() => {
        resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      })
    } catch (error) {
      setError(getErrorMessage(error))
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className={theme === 'dark' ? 'bg-slate-950' : 'bg-slate-50'}>
      <SearchSection value={query} loading={loading} onChange={setQuery} onSubmit={handleSubmit} theme={theme} />

      {error ? (
        <div className="mx-auto w-full max-w-7xl px-4 pb-6 sm:px-6 lg:px-8">
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 shadow-sm">
            {error}
          </div>
        </div>
      ) : null}

      <div ref={resultsRef} className="mx-auto w-full max-w-7xl px-4 pb-10 sm:px-6 lg:px-8">
        <FlightResults result={result} loading={loading} theme={theme} />
      </div>
    </section>
  )
}
