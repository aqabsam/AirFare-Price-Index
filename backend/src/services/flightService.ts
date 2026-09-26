import { chromium, type Browser } from 'playwright'
import type { FlightSearchRequest, FlightSearchResponse, NormalizedFlightOffer } from '../types/flight.js'
import { getDuffelAccessToken, searchDuffelOffers, type DuffelOfferValidationSummary } from '../providers/duffel.js'
import { getConfiguredAirlineScrapers } from '../scrapers/index.js'
import { SOURCE_TIMEOUT_MS } from '../scrapers/shared.js'
import { publishFlightOffers } from './canonicalDataService.js'

const inFlightSearches = new Map<string, Promise<FlightSearchResponse>>()
const CURRENCY_TO_INR: Record<string, number> = { INR: 1, USD: 95.4, EUR: 111.28, GBP: 130.06 }
const SOURCE_TIMEOUT_BUDGET_MS = SOURCE_TIMEOUT_MS + 250
const INDIAN_CARRIERS: Array<{ name: string; code: string; aliases: readonly string[] }> = [
  { name: 'IndiGo', code: '6E', aliases: ['indigo', 'indigoairlines'] },
  { name: 'Air India', code: 'AI', aliases: ['airindia', 'airindianational', 'airindialimited'] },
  { name: 'Air India Express', code: 'IX', aliases: ['airindiaexpress', 'airindiaexpresslimited'] },
  { name: 'Akasa Air', code: 'QP', aliases: ['akasa', 'akasaair', 'akasaairlines'] },
  { name: 'SpiceJet', code: 'SG', aliases: ['spicejet', 'spicejetlimited'] },
  { name: 'Alliance Air', code: '9I', aliases: ['allianceair', 'allianceairlimited'] },
  { name: 'Star Air', code: 'S5', aliases: ['starair', 'starairlines'] },
]

function verifiedIndianAirline(name: string, code: string) {
  const normalizedName = name.trim().toLowerCase().replace(/[^a-z]/g, '')
  const normalizedCode = code.trim().toUpperCase()
  const nameMatch = INDIAN_CARRIERS.find((carrier) => carrier.aliases.includes(normalizedName))
  const codeMatch = INDIAN_CARRIERS.find((carrier) => carrier.code === normalizedCode)
  if (normalizedCode) return codeMatch ?? null
  return nameMatch ?? null
}

function comparablePriceInINR(offer: NormalizedFlightOffer) {
  return offer.price * (CURRENCY_TO_INR[offer.currency.trim().toUpperCase()] ?? 1)
}

export function hasMatchingFlightCarrier(offer: NormalizedFlightOffer) {
  if (offer.segments?.length) {
    return offer.segments.every((segment) => {
      const flightNumber = segment.flightNumber.replace(/[\s-]/g, '').toUpperCase()
      const airlineCode = segment.airlineCode.trim().toUpperCase()
      return /^[A-Z0-9]{2,3}\d{2,5}$/.test(flightNumber) && flightNumber.startsWith(airlineCode)
    })
  }

  const flightNumber = offer.flightNumber.replace(/[\s-]/g, '').toUpperCase()
  const airlineCode = offer.airlineCode.trim().toUpperCase()
  return /^[A-Z0-9]{2,3}\d{2,5}$/.test(flightNumber) && flightNumber.startsWith(airlineCode)
}

function keyForSearch(input: FlightSearchRequest) {
  return `${input.origin.trim().toUpperCase()}|${input.destination.trim().toUpperCase()}|${input.departureDate.trim()}|${input.adults}`.toLowerCase()
}

function validateRequest(input: FlightSearchRequest) {
  const origin = input.origin.trim().toUpperCase()
  const destination = input.destination.trim().toUpperCase()
  const departureDate = input.departureDate.trim()

  if (!/^[A-Z]{3}$/.test(origin) || !/^[A-Z]{3}$/.test(destination)) {
    throw new Error('Origin and destination must be valid 3-letter airport codes.')
  }

  if (origin === destination) {
    throw new Error('Origin and destination must be different.')
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(departureDate)) {
    throw new Error('Departure date must be in YYYY-MM-DD format.')
  }

  const parsed = new Date(`${departureDate}T00:00:00Z`)
  if (Number.isNaN(parsed.getTime())) {
    throw new Error('Departure date is invalid.')
  }

  return { origin, destination, departureDate }
}

export function deduplicateOffers(offers: NormalizedFlightOffer[]) {
  const unique = new Map<string, NormalizedFlightOffer>()
  const sourcePriority = { airline: 3, duffel: 2, ota: 1, aggregated: 0, demo: 0 } as const
  for (const offer of offers) {
    const identity = [
      offer.airlineCode || offer.airline,
      offer.flightNumber.replace(/[^a-z0-9]/gi, ''),
      offer.origin,
      offer.destination,
      offer.departureDate,
      offer.departureTime,
      offer.arrivalTime,
      offer.duration,
      offer.stops,
    ].join('|').toUpperCase()
    const current = unique.get(identity)
    const priority = sourcePriority[offer.sourceType]
    const currentPriority = current ? sourcePriority[current.sourceType] : -1
    if (!current || priority > currentPriority || (priority === currentPriority && comparablePriceInINR(offer) < comparablePriceInINR(current)) || (priority === currentPriority && comparablePriceInINR(offer) === comparablePriceInINR(current) && offer.confidence > current.confidence)) {
      unique.set(identity, offer)
    }
  }
  return [...unique.values()].sort((left, right) => left.departureTime.localeCompare(right.departureTime) || comparablePriceInINR(left) - comparablePriceInINR(right))
}

export function timestampSearchOffers(offers: NormalizedFlightOffer[], collectedAt = new Date().toISOString()) {
  return offers.map((offer) => ({ ...offer, collectedAt }))
}

function recordRejection(rejections: Record<string, number> | undefined, reason: string) {
  if (rejections) rejections[reason] = (rejections[reason] ?? 0) + 1
}

export function canonicalizeScrapedOffer(
  snapshot: { airline?: string; airlineCode?: string; flightNumber?: string; origin?: string; destination?: string; departureDate?: string; departureTime?: string; arrivalTime?: string; duration?: string; durationMinutes?: number; stops?: number; price?: number; currency?: string; collectedAt?: string; source?: string; sourceType?: string; confidence?: number; offerId?: string; seatsRemaining?: number; liveMode?: boolean },
  rejections?: Record<string, number>,
): NormalizedFlightOffer | null {
  const reject = (reason: string) => {
    recordRejection(rejections, reason)
    return null
  }
  if (!snapshot.airline?.trim()) return reject('missing airline')
  if (!snapshot.flightNumber?.trim()) return reject('missing flight number')
  if (!snapshot.origin?.trim() || !snapshot.destination?.trim()) return reject('missing route')
  if (!snapshot.departureDate?.trim()) return reject('missing travel date')

  const carrier = verifiedIndianAirline(snapshot.airline, snapshot.airlineCode ?? '')
  if (!carrier) return reject('invalid or conflicting Indian airline')
  const airlineCode = snapshot.airlineCode?.trim().toUpperCase() || carrier.code
  const flightNumber = snapshot.flightNumber.trim().replace(/[\s-]/g, '').toUpperCase()
  if (!/^[A-Z0-9]{2,3}\d{2,5}$/.test(flightNumber)) return reject('invalid flight number format')
  if (!flightNumber.startsWith(airlineCode)) return reject('flight number carrier mismatch')

  const origin = snapshot.origin.trim().toUpperCase()
  const destination = snapshot.destination.trim().toUpperCase()
  if (!/^[A-Z]{3}$/.test(origin) || !/^[A-Z]{3}$/.test(destination)) return reject('invalid airport code')
  const departureDate = snapshot.departureDate.trim()
  const parsedDate = new Date(`${departureDate}T00:00:00Z`)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(departureDate) || Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== departureDate) {
    return reject('invalid travel date')
  }

  const price = Number(snapshot.price)
  if (!Number.isFinite(price) || price <= 0) return reject('invalid fare')
  const departureTime = snapshot.departureTime?.trim() ?? ''
  const arrivalTime = snapshot.arrivalTime?.trim() ?? ''
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(departureTime)) return reject('invalid departure time')
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(arrivalTime)) return reject('invalid arrival time')
  const duration = snapshot.duration?.trim() || (snapshot.durationMinutes && snapshot.durationMinutes > 0
    ? `${Math.floor(snapshot.durationMinutes / 60)}h ${String(snapshot.durationMinutes % 60).padStart(2, '0')}m`
    : '')
  if (!/^\d+h\s+\d{2}m$/i.test(duration)) return reject('invalid or missing duration')
  const stops = Number(snapshot.stops)
  if (!Number.isInteger(stops) || stops < 0) return reject('invalid or missing stops')
  const sourceType = snapshot.sourceType ?? 'airline'
  if (sourceType !== 'airline' && sourceType !== 'ota') return reject('invalid source type')

  return {
    airline: carrier.name,
    airlineCode: carrier.code,
    flightNumber,
    origin,
    destination,
    departureDate,
    liveMode: snapshot.liveMode ?? true,
    departureTime,
    arrivalTime,
    duration,
    stops,
    price,
    currency: (snapshot.currency ?? 'INR').trim().toUpperCase() || 'INR',
    offerId: snapshot.offerId ?? `${origin}-${destination}-${departureDate}-${flightNumber}`,
    seatsRemaining: Number(snapshot.seatsRemaining ?? 1),
    source: snapshot.source ?? 'Verified airline/OTA source',
    sourceType,
    collectedAt: snapshot.collectedAt ?? new Date().toISOString(),
    confidence: Number(snapshot.confidence ?? 0.8),
  }
}

function formatRejections(rejections: Record<string, number>) {
  return Object.entries(rejections).map(([reason, count]) => `${reason}=${count}`).join(', ') || 'none'
}

function sourceUrl(scraper: ReturnType<typeof getConfiguredAirlineScrapers>[number], input: FlightSearchRequest) {
  const target = scraper.definition.buildSearchUrl?.(input) ?? scraper.definition.url
  try {
    const parsed = new URL(target)
    return `${parsed.origin}${parsed.pathname}`
  } catch {
    return 'invalid source URL'
  }
}

async function withSourceTimeout<T>(promise: Promise<T>, sourceName: string) {
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timeoutHandle = setTimeout(() => reject(new Error(`${sourceName} timed out after ${SOURCE_TIMEOUT_BUDGET_MS}ms`)), SOURCE_TIMEOUT_BUDGET_MS)
      }),
    ])
  } finally {
    if (timeoutHandle) clearTimeout(timeoutHandle)
  }
}

async function searchLiveAirlineOffers(input: FlightSearchRequest): Promise<NormalizedFlightOffer[]> {
  // Retained for restoration; normal Flight Search does not invoke web scrapers.
  const scrapers = getConfiguredAirlineScrapers()
  if (!scrapers.length) {
    console.warn('[Flight Search] No configured airline/OTA scrapers')
    return []
  }

  let browser: Browser | null = null
  try {
    browser = await Promise.race([
      chromium.launch({ headless: true }),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Live scraper startup timed out')), 3000)),
    ]).catch((error) => {
      console.warn('[Flight Search] Playwright browser unavailable:', error instanceof Error ? error.message : error)
      return null
    })
  } catch (error) {
    console.warn('[Flight Search] Playwright browser unavailable:', error instanceof Error ? error.message : error)
    for (const scraper of scrapers) {
      console.warn(`[Source ${scraper.definition.name}] FAILED: browser unavailable`)
    }
    return []
  }

  if (!browser) {
    for (const scraper of scrapers) {
      console.warn(`[Source ${scraper.definition.name}] FAILED: browser unavailable`)
    }
    return []
  }

  try {
    const scraperResults = await Promise.all(
      scrapers.map(async (scraper) => {
        const sourceName = scraper.definition.name
        console.info(`[Source ${sourceName}] LOADING ${sourceUrl(scraper, input)} route=${input.origin}-${input.destination} date=${input.departureDate}`)
        try {
          const result = await withSourceTimeout(scraper.scrape(browser, input), sourceName)
          const rejectionCounts = { ...result.rejectionCounts }
          const verifiedOffers: NormalizedFlightOffer[] = []
          for (const snapshot of result.snapshots) {
            const offer = canonicalizeScrapedOffer(snapshot, rejectionCounts)
            if (!offer) continue
            if (offer.origin !== input.origin.toUpperCase() || offer.destination !== input.destination.toUpperCase()) {
              recordRejection(rejectionCounts, 'route mismatch')
              continue
            }
            if (offer.departureDate !== input.departureDate) {
              recordRejection(rejectionCounts, 'travel date mismatch')
              continue
            }
            verifiedOffers.push(offer)
          }
          const parseSummary = formatRejections(result.rejectionCounts)
          const verificationSummary = formatRejections(Object.fromEntries(Object.entries(rejectionCounts).filter(([reason]) => !(reason in result.rejectionCounts))))
          console.info(`[Source ${sourceName}] extracted ${result.candidateCount} raw candidates, ${verifiedOffers.length} verified offers (parsed snapshots=${result.snapshots.length}; parse rejections: ${parseSummary}; validation rejections: ${verificationSummary})`)
          if (result.networkResponses.length) console.info(`[Source ${sourceName}] XHR/fetch: ${result.networkResponses.join(' | ')}`)
          return verifiedOffers
        } catch (error) {
          console.warn(`[Source ${sourceName}] FAILED: ${error instanceof Error ? error.message : String(error)}`)
          return []
        }
      }),
    )

    const liveOffers = deduplicateOffers(scraperResults.flat())
    return liveOffers.filter((offer) => offer.origin === input.origin.trim().toUpperCase() && offer.destination === input.destination.trim().toUpperCase() && offer.departureDate === input.departureDate.trim())
  } finally {
    await browser.close().catch(() => undefined)
  }
}

export async function searchFlightsFromDuffel(
  input: FlightSearchRequest,
  searchDuffel: (
    input: FlightSearchRequest,
    onRawOfferCount?: (count: number) => void,
    onOfferValidation?: (summary: DuffelOfferValidationSummary) => void,
  ) => Promise<NormalizedFlightOffer[]> = searchDuffelOffers,
): Promise<FlightSearchResponse> {
  const { origin, destination, departureDate } = validateRequest(input)
  const searchInput = { ...input, origin, destination, departureDate }
  console.info('[Flight Search] Live web scraping disabled')
  console.info('[Flight Search] Using Duffel API')
  const accessToken = getDuffelAccessToken()
  if (!accessToken) {
    console.warn('[Duffel] API key not configured')
    console.info('[Duffel] Raw offers: 0')
    console.info('[Duffel] Valid offers before airline filtering: 0')
    console.info('[Duffel] Rejected offers: 0')
    console.info('[Duffel] Verified offers: 0')
    console.info('[Flight Search] Final merged result count=0 source=duffel')
    return { offers: [], status: 'no_results', message: 'No flights available for this search.' }
  }

  console.info(`[Duffel] Searching ${origin}-${destination} for ${departureDate}, passengers=${searchInput.adults}`)
  try {
    let rawOfferCount: number | undefined
    let validationSummary: DuffelOfferValidationSummary | undefined
    const duffelOffers = await searchDuffel(searchInput, (count) => {
      rawOfferCount = count
    }, (summary) => {
      validationSummary = summary
    })
    const rejections: Record<string, number> = {}
    const verifiedOffers = duffelOffers.flatMap((offer) => {
      if (offer.sourceType !== 'duffel') {
        recordRejection(rejections, 'invalid Duffel source provenance')
        return []
      }
      const segments = offer.segments ?? []
      const carriers = segments.length
        ? [...new Map(segments.map((segment) => [segment.airlineCode, verifiedIndianAirline(segment.airline, segment.airlineCode)])).values()]
        : [verifiedIndianAirline(offer.airline, offer.airlineCode)]
      if (!segments.length || carriers.some((carrier) => !carrier)) {
        recordRejection(rejections, 'invalid or non-Indian operating airline')
        return []
      }
      if (!hasMatchingFlightCarrier(offer)) {
        recordRejection(rejections, 'flight number carrier mismatch')
        return []
      }
      if (offer.origin !== origin || offer.destination !== destination) {
        recordRejection(rejections, 'route mismatch')
        return []
      }
      if (segments[0]?.origin !== origin || segments.at(-1)?.destination !== destination || segments.some((segment, index) => index > 0 && segments[index - 1]?.destination !== segment.origin)) {
        recordRejection(rejections, 'segment route mismatch')
        return []
      }
      if (segments.some((segment) => !hasMatchingFlightCarrier({ ...offer, airline: segment.airline, airlineCode: segment.airlineCode, flightNumber: segment.flightNumber, segments: undefined }))) {
        recordRejection(rejections, 'segment flight number mismatch')
        return []
      }
      if (offer.flightNumber !== segments.map((segment) => segment.flightNumber).join(' / ')) {
        recordRejection(rejections, 'itinerary flight number mismatch')
        return []
      }
      if (offer.departureDate !== departureDate) {
        recordRejection(rejections, 'travel date mismatch')
        return []
      }
      if (segments[0]?.departureDate !== departureDate || segments[0]?.departureTime !== offer.departureTime || segments.at(-1)?.arrivalTime !== offer.arrivalTime || offer.stops !== segments.length - 1) {
        recordRejection(rejections, 'segment schedule mismatch')
        return []
      }
      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(offer.departureTime) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(offer.arrivalTime)) {
        recordRejection(rejections, 'invalid schedule')
        return []
      }
      if (!/^\d+h\s+\d{2}m$/i.test(offer.duration) || !Number.isInteger(offer.stops) || offer.stops < 0) {
        recordRejection(rejections, 'invalid schedule')
        return []
      }
      if (!Number.isFinite(offer.price) || offer.price <= 0 || !offer.currency.trim()) {
        recordRejection(rejections, 'invalid fare')
        return []
      }
      return [{
        ...offer,
        airline: [...new Set(segments.map((segment) => verifiedIndianAirline(segment.airline, segment.airlineCode)?.name ?? ''))].filter(Boolean).join(' / '),
        airlineCode: [...new Set(segments.map((segment) => verifiedIndianAirline(segment.airline, segment.airlineCode)?.code ?? ''))].filter(Boolean).join('/'),
        flightNumber: segments.map((segment) => segment.flightNumber).join(' / '),
        sourceType: 'airline' as const,
        offerId: `${origin}-${destination}-${departureDate}-${offer.flightNumber}-${offer.departureTime}`,
        source: 'Verified flight offer',
      }]
    })
    const rawOffers = rawOfferCount ?? duffelOffers.length
    const validBeforeAirlineFiltering = validationSummary?.validOffers ?? duffelOffers.length
    const providerRejectedOffers = validationSummary?.rejectedOffers ?? Math.max(0, rawOffers - validBeforeAirlineFiltering)
    const localRejectedOffers = Object.values(rejections).reduce((total, count) => total + count, 0)
    const combinedRejections = { ...validationSummary?.rejections }
    for (const [reason, count] of Object.entries(rejections)) {
      combinedRejections[reason] = (combinedRejections[reason] ?? 0) + count
    }
    const searchOffers = timestampSearchOffers(deduplicateOffers(verifiedOffers))
    const countByCarrier = (offers: NormalizedFlightOffer[]) => {
      const counts: Record<string, number> = {}
      for (const offer of offers) {
        const carriers = new Set(offer.segments?.map((segment) => `${segment.airlineCode}/${segment.airline}`) ?? [`${offer.airlineCode}/${offer.airline}`])
        for (const carrier of carriers) counts[carrier] = (counts[carrier] ?? 0) + 1
      }
      return Object.entries(counts).map(([carrier, count]) => `${carrier}=${count}`).join(', ') || 'none'
    }
    console.info(`[Duffel] Raw offers: ${rawOffers}`)
    console.info(`[Duffel] Valid offers before airline filtering: ${validBeforeAirlineFiltering}`)
    console.info(`[Duffel] NORMALIZED OFFERS BY CARRIER: ${countByCarrier(duffelOffers)}`)
    console.info(`[Duffel] Rejection reasons: ${formatRejections(combinedRejections)}`)
    console.info(`[Duffel] VERIFIED OFFERS BY CARRIER: ${countByCarrier(searchOffers)}`)
    console.info(`[Duffel] Rejected offers: ${providerRejectedOffers + localRejectedOffers}`)
    console.info(`[Duffel] Verified offers: ${searchOffers.length}`)
    if (searchOffers.length) {
      void Promise.resolve()
        .then(() => publishFlightOffers(searchOffers))
        .catch((error) => console.warn('Unable to publish verified flight search results', error))
    }
    console.info(`[Flight Search] Final merged result count=${searchOffers.length} source=duffel`)
    return searchOffers.length
      ? { offers: searchOffers, status: 'live_success' }
      : { offers: [], status: 'no_results', message: 'No flights available for this search.' }
  } catch (error) {
    console.warn(`[Duffel] FAILED: ${error instanceof Error ? error.message : String(error)}`)
    console.info('[Duffel] Raw offers: 0')
    console.info('[Duffel] Valid offers before airline filtering: 0')
    console.info('[Duffel] Rejected offers: 0')
    console.info('[Duffel] Verified offers: 0')
    console.info('[Flight Search] Final merged result count=0 source=duffel')
    return { offers: [], status: 'no_results', message: 'No flights available for this search.' }
  }
}

export async function searchFlights(input: FlightSearchRequest): Promise<FlightSearchResponse> {
  const requestKey = keyForSearch(input)
  const existing = inFlightSearches.get(requestKey)
  if (existing) {
    return existing
  }

  const request = searchFlightsFromDuffel(input)

  inFlightSearches.set(requestKey, request)

  try {
    return await request
  } finally {
    inFlightSearches.delete(requestKey)
  }
}
