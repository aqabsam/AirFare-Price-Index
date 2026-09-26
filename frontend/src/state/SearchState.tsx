import type { FareAnalyticsResponse } from '@/types/fare'
import { useEffect, useState, type ReactNode } from 'react'
import { findAirport } from '@/data/airports'
import { searchFlights } from '@/services/flightApi'
import type { FlightSearchInput, FlightSearchResult } from '@/types/flight'
import type { FareSnapshot } from '@/types/fare'
import { calculateFareMetrics } from '@/services/fareCalculations'
import { SearchStateContext, type SearchData, type SearchedRoute, type VerifiedFareObservation } from '@/state/searchContext'

const emptyAnalytics: FareAnalyticsResponse = {
  summary: [],
  trends: [],
  dailyIndex: [],
  weeklyIndex: [],
  monthlyIndex: [],
  heatmap: [],
  sourceComparison: [],
}

function emptySearchData(input: FlightSearchInput, result: FlightSearchResult): SearchData {
  return {
    input,
    result,
    index: { routeCount: 0, routes: [] },
    allRoutes: [],
    analytics: emptyAnalytics,
    snapshots: [],
    quality: { rawRecords: 0, cleanedRecords: 0, duplicateRecords: 0, outlierRecords: 0, missingFieldRecords: 0, soldOutRecords: 0, unknownAvailabilityRecords: 0, message: '' },
    backtest: { available: false, windowDays: 30, sampleCount: 0, mae: null, rmse: null, mape: null, correlation: null, message: '' },
    sourceHealth: { sources: [], liveCount: 0, staleCount: 0, emptyCount: 0 },
    history: [],
    explorer: { raw: [], cleaned: [], rejected: [], indexHistory: [], collectionStatus: { status: 'idle', trigger: 'manual', startedAt: null, finishedAt: null, sourceCount: 0, snapshotCount: 0, message: null }, collectionLogs: [] },
  }
}

function snapshotsFromOffers(result: FlightSearchResult): FareSnapshot[] {
  return result.offers.map((offer) => {
    const durationMatch = offer.duration.match(/^(\d+)h\s+(\d{2})m$/i)
    return {
      id: `${offer.offerId}|${offer.collectedAt}`,
      routeKey: `${offer.origin}-${offer.destination}-${result.travelDate}`,
      origin: offer.origin,
      destination: offer.destination,
      departureDate: result.travelDate,
      bookingWindowDays: 0,
      collectionDate: offer.collectedAt.slice(0, 10),
      collectedAt: offer.collectedAt,
      airline: offer.airline,
      airlineCode: offer.airlineCode,
      flightNumber: offer.flightNumber,
      departureTime: offer.departureTime,
      arrivalTime: offer.arrivalTime,
      durationMinutes: durationMatch ? Number(durationMatch[1]) * 60 + Number(durationMatch[2]) : 0,
      stops: offer.stops,
      price: offer.price,
      baseFare: offer.baseFare,
      taxes: offer.taxes,
      udf: offer.udf,
      convenienceFee: offer.convenienceFee,
      totalFare: offer.totalFare ?? offer.price,
      currency: offer.currency,
      seatsRemaining: offer.seatsRemaining,
      source: offer.source,
      sourceType: offer.sourceType,
      collectionStage: 'SEARCH',
      confidence: offer.confidence,
    }
  })
}

const SEARCHED_ROUTES_KEY = 'airfare-searched-routes'
const FARE_HISTORY_KEY = 'airfare-verified-fare-history'

function loadFareHistory(): VerifiedFareObservation[] {
  if (typeof window === 'undefined') return []
  try {
    const saved = JSON.parse(window.localStorage.getItem(FARE_HISTORY_KEY) ?? '[]') as VerifiedFareObservation[]
    if (!Array.isArray(saved)) return []
    return saved.filter((observation) =>
      /^[A-Z]{3}$/.test(observation.origin) && /^[A-Z]{3}$/.test(observation.destination) &&
      /^\d{4}-\d{2}-\d{2}$/.test(observation.travelDate) && Number.isFinite(Date.parse(observation.collectedAt)) &&
      Number.isFinite(observation.fare) && observation.fare > 0 && Boolean(observation.id && observation.airline && observation.flightNumber && observation.currency),
    )
  } catch {
    return []
  }
}

function loadSearchedRoutes(): SearchedRoute[] {
  if (typeof window === 'undefined') return []
  try {
    const saved = JSON.parse(window.localStorage.getItem(SEARCHED_ROUTES_KEY) ?? '[]') as SearchedRoute[]
    return Array.isArray(saved) ? saved.filter((route) => /^[A-Z]{3}$/.test(route.origin) && /^[A-Z]{3}$/.test(route.destination) && /^\d{4}-\d{2}-\d{2}$/.test(route.travelDate)) : []
  } catch {
    return []
  }
}

function toAirportCode(value: string) {
  return findAirport(value)?.code ?? value.trim().toUpperCase()
}

export function SearchStateProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<SearchData | null>(null)
  const [fareHistoryObservations, setFareHistoryObservations] = useState<VerifiedFareObservation[]>(loadFareHistory)
  const [searchedRoutes, setSearchedRoutes] = useState<SearchedRoute[]>(loadSearchedRoutes)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    window.localStorage.setItem(SEARCHED_ROUTES_KEY, JSON.stringify(searchedRoutes))
  }, [searchedRoutes])

  useEffect(() => {
    try {
      window.localStorage.setItem(FARE_HISTORY_KEY, JSON.stringify(fareHistoryObservations))
    } catch (storageError) {
      console.warn('Unable to persist verified fare history', storageError)
    }
  }, [fareHistoryObservations])

  async function executeSearch(input: FlightSearchInput) {
    setLoading(true)
    setError('')
    setData(null)

    const normalizedInput = {
      ...input,
      origin: toAirportCode(input.origin),
      destination: toAirportCode(input.destination),
    }

    try {
      const rawResult = await searchFlights(normalizedInput)
      const offers = rawResult.offers
      const result: FlightSearchResult = {
        ...rawResult,
        offers,
        totalResults: offers.length,
        cheapestOffer: offers[0] ?? null,
        averagePrice: offers.length ? Math.round(offers.reduce((sum, offer) => sum + offer.price, 0) / offers.length) : 0,
        status: offers.length ? rawResult.status : 'no_results',
        message: offers.length ? rawResult.message : 'No flights available for this search.',
      }
      if (['live_success', 'duffel_success'].includes(result.status)) {
        const observations = offers.flatMap((offer): VerifiedFareObservation[] => {
          const fare = offer.totalFare
          const segments = offer.segments ?? []
          const routeMatches = offer.origin === normalizedInput.origin && offer.destination === normalizedInput.destination &&
            segments.length > 0 && segments[0]?.origin === normalizedInput.origin && segments.at(-1)?.destination === normalizedInput.destination &&
            segments.every((segment, index) => index === 0 || segments[index - 1]?.destination === segment.origin)
          const scheduleMatches = segments[0]?.departureDate === normalizedInput.travelDate &&
            offer.departureTime === segments[0]?.departureTime && offer.arrivalTime === segments.at(-1)?.arrivalTime
          if (!routeMatches || !scheduleMatches || !Number.isFinite(fare) || (fare ?? 0) <= 0 || !offer.airline || !offer.flightNumber || !offer.collectedAt) return []
          return [{
            id: `${normalizedInput.origin}|${normalizedInput.destination}|${normalizedInput.travelDate}|${offer.offerId}|${offer.collectedAt}`,
            origin: normalizedInput.origin,
            destination: normalizedInput.destination,
            travelDate: normalizedInput.travelDate,
            collectedAt: offer.collectedAt,
            airline: offer.airline,
            flightNumber: offer.flightNumber,
            fare: fare!,
            currency: offer.currency,
          }]
        })
        if (observations.length) {
          setFareHistoryObservations((current) => {
            const knownIds = new Set(current.map((observation) => observation.id))
            return [...current, ...observations.filter((observation) => !knownIds.has(observation.id))]
          })
        }
      }
      const initialData = emptySearchData(normalizedInput, result)
      const fallbackSnapshots = snapshotsFromOffers(result)
      const fareMetrics = calculateFareMetrics(fallbackSnapshots)
      const searchedRoute: SearchedRoute = {
        origin: normalizedInput.origin,
        destination: normalizedInput.destination,
        travelDate: normalizedInput.travelDate,
        searchedAt: new Date().toISOString(),
        offers: result.offers.map(({ airline, airlineCode, flightNumber, price, currency, source }) => ({ airline, airlineCode, flightNumber, price, currency, source })),
      }
      setSearchedRoutes((current) => [
        ...current.filter((route) => `${route.origin}-${route.destination}-${route.travelDate}` !== `${searchedRoute.origin}-${searchedRoute.destination}-${searchedRoute.travelDate}`),
        searchedRoute,
      ])
      initialData.snapshots = fareMetrics.snapshots
      initialData.index = fareMetrics.index
      initialData.analytics = fareMetrics.analytics
      initialData.quality = fareMetrics.quality
      initialData.sourceHealth = fareMetrics.sourceHealth
      initialData.explorer = { ...initialData.explorer, raw: fareMetrics.snapshots, cleaned: fareMetrics.snapshots }
      setData(initialData)
      return initialData
    } catch (searchError) {
      const message = searchError instanceof Error ? searchError.message : 'Unable to load flight pricing right now. Please try again.'
      setError(message)
      throw searchError
    } finally {
      setLoading(false)
    }
  }

  return <SearchStateContext.Provider value={{ data, fareHistoryObservations, searchedRoutes, loading, error, executeSearch }}>{children}</SearchStateContext.Provider>
}