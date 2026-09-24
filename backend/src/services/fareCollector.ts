import { chromium, type Browser } from 'playwright'
import { loadTrackedRoutes, type TrackedRoute } from '../data/trackedRoutes.js'
import type { FareSnapshot } from '../types/fare.js'
import type { FlightSearchRequest } from '../types/flight.js'
import { loadWebsiteScrapers } from '../scrapers/index.js'
import { searchDuffelOffers } from '../providers/duffel.js'
import { DEFAULT_FARE_SNAPSHOTS } from '../data/fareCatalog.js'
import type { NormalizedFlightOffer } from '../types/flight.js'

const MAX_CONCURRENT = Math.max(1, Math.min(4, Number(process.env.SCRAPER_MAX_CONCURRENT ?? '2')))
const SCRAPE_TIMEOUT_MS = Math.max(30_000, Number(process.env.SCRAPER_TIMEOUT ?? '30000'))
const CACHE_TTL_MS = Math.max(0, Number(process.env.SCRAPER_CACHE_TTL ?? '300')) * 1_000
const IST_TIME_ZONE = 'Asia/Kolkata'
export const ADVANCE_WINDOWS = [1, 7, 15, 30, 45] as const

const routeCache = new Map<string, { expiresAt: number; snapshots: FareSnapshot[] }>()
const robotsCache = new Map<string, { expiresAt: number; disallowed: string[] }>()
const DUFFEL_RETRIES = Math.max(0, Number(process.env.DUFFEL_RETRIES ?? '2'))
const SOURCE_DELAY_MS = Math.max(0, Number(process.env.SOURCE_RATE_LIMIT_MS ?? '250'))

async function robotsAllowed(targetUrl: string) {
  let origin: string
  try {
    origin = new URL(targetUrl).origin
  } catch {
    return false
  }

  const cached = robotsCache.get(origin)
  let disallowed = cached?.expiresAt && cached.expiresAt > Date.now() ? cached.disallowed : null
  if (!disallowed) {
    try {
      const response = await fetch(`${origin}/robots.txt`)
      const body = response.ok ? await response.text() : ''
      disallowed = body.split(/\r?\n/).reduce<string[]>((rules, line) => {
        const match = line.match(/^\s*Disallow:\s*(\S*)/i)
        if (match?.[1]) rules.push(match[1])
        return rules
      }, [])
      robotsCache.set(origin, { expiresAt: Date.now() + 3_600_000, disallowed })
    } catch {
      return false
    }
  }

  const pathname = new URL(targetUrl).pathname
  return !disallowed.some((rule) => rule === '/' || pathname.startsWith(rule))
}

function todayInIndia() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: IST_TIME_ZONE }).format(new Date())
}

function addDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00Z`)
  value.setUTCDate(value.getUTCDate() + days)
  return value.toISOString().slice(0, 10)
}

function routeInput(route: TrackedRoute, collectionDate: string): FlightSearchRequest {
  return {
    origin: route.origin,
    destination: route.destination,
    departureDate: route.departureDate ?? addDays(collectionDate, route.bookingWindowDays ?? 1),
    adults: route.adults ?? 1,
  }
}

function routeInputs(route: TrackedRoute, collectionDate: string) {
  if (route.departureDate || route.bookingWindowDays !== undefined) {
    return [routeInput(route, collectionDate)]
  }

  return ADVANCE_WINDOWS.map((bookingWindowDays) => routeInput({ ...route, bookingWindowDays }, collectionDate))
}

function flightKey(snapshot: FareSnapshot) {
  return [snapshot.routeKey, snapshot.airlineCode, snapshot.flightNumber, snapshot.departureTime].join('|').toUpperCase()
}

function cheapestUnique(snapshots: FareSnapshot[]) {
  const byFlight = new Map<string, FareSnapshot>()
  for (const snapshot of snapshots) {
    const current = byFlight.get(flightKey(snapshot))
    if (!current || snapshot.price < current.price) byFlight.set(flightKey(snapshot), snapshot)
  }
  return [...byFlight.values()].sort((left, right) => left.price - right.price)
}

async function scrapeSources(browser: Browser, input: FlightSearchRequest) {
  const cacheKey = `${input.origin}-${input.destination}-${input.departureDate}`.toUpperCase()
  const cached = routeCache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now()) return cached.snapshots

  const scrapers = loadWebsiteScrapers()
  if (!scrapers.length) return []

  const settled = await mapWithConcurrency(scrapers, async (scraper) => {
    const sourceName = scraper.definition.name
    console.info(`[scraper] ${sourceName} STARTED route=${input.origin}-${input.destination}-${input.departureDate}`)
    try {
      const targetUrl = scraper.definition.buildSearchUrl?.(input) ?? scraper.definition.url
      if (!(await robotsAllowed(targetUrl))) {
        console.warn(`[scraper] ${sourceName} SKIPPED by robots.txt`)
        return []
      }
      if (SOURCE_DELAY_MS > 0) await new Promise((resolve) => setTimeout(resolve, SOURCE_DELAY_MS))
      const timeout = new Promise<FareSnapshot[]>((_, reject) => {
        setTimeout(() => reject(new Error(`${scraper.definition.name} timed out`)), SCRAPE_TIMEOUT_MS)
      })
      const snapshots = await Promise.race([scraper.scrape(browser, input), timeout])
      if (snapshots.length > 0) {
        console.info(`[scraper] ${sourceName} SUCCESS fares=${snapshots.length}`)
      } else {
        console.info(`[scraper] ${sourceName} NO FARES`)
      }
      return snapshots
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      const status = /timed out|timeout|aborted/i.test(message) ? 'TIMEOUT' : 'FAILED'
      console.warn(`[scraper] ${sourceName} ${status}: ${message}`)
      return []
    }
  })

  const snapshots = settled
    .flat()
    .filter((snapshot) => !!snapshot && !!snapshot.routeKey)

  if (CACHE_TTL_MS > 0) routeCache.set(cacheKey, { expiresAt: Date.now() + CACHE_TTL_MS, snapshots })
  return snapshots
}

function offerToSnapshot(offer: NormalizedFlightOffer, input: FlightSearchRequest, sourceType: FareSnapshot['sourceType'] = 'duffel'): FareSnapshot {
  const collectionDate = todayInIndia()
  return {
    id: offer.offerId,
    routeKey: `${offer.origin}-${offer.destination}-${input.departureDate}`,
    origin: offer.origin,
    destination: offer.destination,
    departureDate: input.departureDate,
    bookingWindowDays: Math.max(0, Math.round((new Date(`${input.departureDate}T00:00:00Z`).getTime() - new Date(`${collectionDate}T00:00:00Z`).getTime()) / 86_400_000)),
    collectionDate,
    collectedAt: offer.collectedAt,
    sourceId: sourceType,
    collectionStage: sourceType === 'duffel' ? 'DUFFEL' : 'DEMO',
    airline: offer.airline,
    airlineCode: offer.airlineCode,
    flightNumber: offer.flightNumber,
    departureTime: offer.departureTime,
    arrivalTime: offer.arrivalTime,
    durationMinutes: Number.parseInt(offer.duration, 10) * 60 + Number.parseInt(offer.duration.match(/(\d{2})m/)?.[1] ?? '0', 10),
    stops: offer.stops,
    price: offer.price,
    baseFare: offer.baseFare,
    taxes: offer.taxes,
    udf: offer.udf,
    convenienceFee: offer.convenienceFee,
    totalFare: offer.totalFare ?? offer.price,
    currency: offer.currency,
    seatsRemaining: offer.seatsRemaining,
    soldOut: offer.seatsRemaining <= 0,
    source: offer.source,
    sourceType,
    confidence: offer.confidence,
  }
}

async function collectDuffel(input: FlightSearchRequest) {
  for (let attempt = 0; attempt <= DUFFEL_RETRIES; attempt += 1) {
    try {
      if (SOURCE_DELAY_MS > 0) await new Promise((resolve) => setTimeout(resolve, SOURCE_DELAY_MS))
      return (await searchDuffelOffers(input)).map((offer) => offerToSnapshot(offer, input))
    } catch (error) {
      if (attempt === DUFFEL_RETRIES) {
        console.warn(`[duffel] FAILED route=${input.origin}-${input.destination}-${input.departureDate}: ${error instanceof Error ? error.message : String(error)}`)
      }
    }
  }
  return []
}

function demoFallback(input: FlightSearchRequest) {
  return DEFAULT_FARE_SNAPSHOTS
    .filter((snapshot) => snapshot.origin === input.origin.toUpperCase() && snapshot.destination === input.destination.toUpperCase())
    .map((snapshot) => ({
      ...snapshot,
      id: `demo-${snapshot.id}`,
      departureDate: input.departureDate,
      routeKey: `${input.origin.toUpperCase()}-${input.destination.toUpperCase()}-${input.departureDate}`,
      source: 'Demo fallback',
      collectionStage: 'DEMO' as const,
      sourceType: 'demo' as const,
      collectedAt: new Date().toISOString(),
    }))
}

async function mapWithConcurrency<T, R>(items: T[], worker: (item: T) => Promise<R>) {
  const results = new Array(items.length) as R[]
  let cursor = 0

  async function consume() {
    while (true) {
      const index = cursor
      cursor += 1
      if (index >= items.length) return
      results[index] = await worker(items[index])
    }
  }

  await Promise.all(Array.from({ length: Math.min(MAX_CONCURRENT, items.length) }, () => consume()))
  return results
}

async function collectForInputs(inputs: FlightSearchRequest[]) {
  const scrapers = loadWebsiteScrapers()
  const browser = scrapers.length ? await chromium.launch({ headless: process.env.SCRAPER_HEADLESS?.toLowerCase() !== 'false' }) : null
  try {
    const results = await mapWithConcurrency(inputs, async (input) => {
      const scraped = browser ? await scrapeSources(browser, input) : []
      if (scraped.length) return scraped
      const duffel = await collectDuffel(input)
      return duffel.length ? duffel : demoFallback(input)
    })
    const collectionDate = todayInIndia()
    const snapshots = results.flat().map((snapshot) => {
      const departure = new Date(`${snapshot.departureDate}T00:00:00Z`).getTime()
      const collection = new Date(`${collectionDate}T00:00:00Z`).getTime()
      const bookingWindowDays = Number.isFinite(departure) && Number.isFinite(collection)
        ? Math.max(0, Math.round((departure - collection) / 86_400_000))
        : snapshot.bookingWindowDays ?? 0
      return { ...snapshot, bookingWindowDays }
    })
    return cheapestUnique(snapshots)
  } finally {
    await browser?.close()
  }
}

export async function collectFareSnapshots() {
  const collectionDate = todayInIndia()
  return collectForInputs(loadTrackedRoutes().flatMap((route) => routeInputs(route, collectionDate)))
}

export async function collectFareSnapshotsForRoute(route: TrackedRoute) {
  const collectionDate = todayInIndia()
  return collectForInputs([routeInput(route, collectionDate)])
}
