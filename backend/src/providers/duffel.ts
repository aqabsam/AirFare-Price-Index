import type { FlightSearchRequest, NormalizedFlightOffer, NormalizedFlightSegment } from '../types/flight.js'
import { isValidIndianAirportCode } from '../data/indianAirportCodes.js'

export class DuffelProviderError extends Error {
  statusCode: number

  constructor(message: string, statusCode = 502) {
    super(message)
    this.name = 'DuffelProviderError'
    this.statusCode = statusCode
  }
}

type DuffelCarrier = {
  name?: string | null
  iata_code?: string | null
  country_code?: string | null
  logo_symbol_url?: string | null
  logo_lockup_url?: string | null
}

const canonicalAirlineNames: Record<string, string> = {
  '6E': 'IndiGo',
  AI: 'Air India',
  IX: 'Air India Express',
  QP: 'Akasa Air',
  SG: 'SpiceJet',
  '9I': 'Alliance Air',
  S5: 'Star Air',
}

type DuffelSegment = {
  origin?: { iata_code?: string | null } | null
  destination?: { iata_code?: string | null } | null
  operating_carrier?: DuffelCarrier | null
  marketing_carrier?: DuffelCarrier | null
  operating_carrier_flight_number?: string | null
  marketing_carrier_flight_number?: string | null
  flight_number?: string | null
  departing_at?: string | null
  arriving_at?: string | null
}

type DuffelSlice = {
  origin?: { iata_code?: string | null } | null
  destination?: { iata_code?: string | null } | null
  segments?: DuffelSegment[] | null
}

type DuffelOffer = {
  id?: string | null
  live_mode?: boolean | null
  total_amount?: number | string | null
  total_currency?: string | null
  base_amount?: number | string | null
  base_currency?: string | null
  intended_base_amount?: number | string | null
  tax_amount?: number | string | null
  tax_currency?: string | null
  intended_total_amount?: number | string | null
  total_duration?: string | null
  slices?: DuffelSlice[] | null
}

type DuffelPayload = {
  data?: { offers?: DuffelOffer[] | null }
  offers?: DuffelOffer[] | null
  errors?: Array<{ message?: string | null; title?: string | null; code?: string | null; type?: string | null }>
}

export type DuffelOfferRejectionReason =
  | 'missing_itinerary'
  | 'invalid_carrier'
  | 'blocked_carrier'
  | 'invalid_flight_number'
  | 'invalid_price'
  | 'invalid_currency'
  | 'invalid_schedule'
  | 'route_mismatch'
  | 'date_mismatch'

export type DuffelOfferDiagnostics = Record<DuffelOfferRejectionReason, number>
export type DuffelOfferValidationSummary = {
  validOffers: number
  rejectedOffers: number
  rejections: Record<string, number>
}

function rejectOffer(diagnostics: DuffelOfferDiagnostics | undefined, reason: DuffelOfferRejectionReason): null {
  if (diagnostics) {
    diagnostics[reason] += 1
  }
  return null
}

function parseIsoDuration(duration: string | null | undefined): number | null {
  if (!duration) return null

  const isoMatch = duration.match(/^P(?:T)?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/i)
  if (isoMatch) {
    const hours = Number(isoMatch[1] ?? 0)
    const minutes = Number(isoMatch[2] ?? 0)
    const seconds = Number(isoMatch[3] ?? 0)
    return Math.max(0, Math.round(hours * 60 + minutes + seconds / 60))
  }

  const clockMatch = duration.match(/^(\d+):(\d{2}):(\d{2})$/)
  if (clockMatch) {
    const hours = Number(clockMatch[1])
    const minutes = Number(clockMatch[2])
    const seconds = Number(clockMatch[3])
    return Math.max(0, Math.round(hours * 60 + minutes + seconds / 60))
  }

  const minuteMatch = duration.match(/^(\d+)m$/i)
  if (minuteMatch) {
    return Number(minuteMatch[1])
  }

  return null
}

function formatDuration(minutes: number) {
  const hours = Math.floor(minutes / 60)
  const remainder = minutes % 60
  return `${hours}h ${String(remainder).padStart(2, '0')}m`
}

function formatClockTime(isoString: string | null | undefined) {
  if (!isoString) return '--:--'
  const clockMatch = isoString.match(/T(\d{2}:\d{2})/)
  return clockMatch ? clockMatch[1] : '--:--'
}

function calculateDuration(startIso: string | null | undefined, endIso: string | null | undefined, fallbackDuration: string | null | undefined) {
  if (startIso && endIso) {
    const start = new Date(startIso).getTime()
    const end = new Date(endIso).getTime()
    if (Number.isFinite(start) && Number.isFinite(end) && end >= start) {
      return formatDuration(Math.max(0, Math.round((end - start) / 60000)))
    }
  }

  const parsed = parseIsoDuration(fallbackDuration ?? null)
  return parsed !== null ? formatDuration(parsed) : '--'
}

function cleanAirlineCode(value: string | null | undefined) {
  if (!value) return ''
  const cleaned = value.trim().toUpperCase()
  return /^[A-Z0-9]{2,3}$/.test(cleaned) ? cleaned : ''
}

function isProviderBrandName(value: string | null | undefined) {
  if (!value) return false
  const normalized = value.trim().toLowerCase()
  return ['duffel', 'provider', 'booking', 'payment', 'travel agency', 'aggregator'].some((brand) => normalized.includes(brand))
}

function rawCarrierCode(value: string | null | undefined) {
  return cleanAirlineCode(value)
}

function normalizeFlightNumber(airlineCode: string, rawNumber: string | null | undefined) {
  if (rawNumber === undefined || rawNumber === null) return null

  const value = String(rawNumber).trim()
  if (!value) return null

  const merged = value.toUpperCase()
  if (/^(?=[A-Z0-9]{2,3}\d{1,5}$)(?=[A-Z0-9]*[A-Z])[A-Z0-9]{2,3}\d{1,5}$/.test(merged)) {
    return merged
  }

  if (/^\d{1,5}$/.test(merged) && airlineCode) {
    return `${airlineCode}${merged}`
  }

  return null
}

function rawCarrierLabel(carrier: DuffelCarrier | null | undefined) {
  const code = carrier?.iata_code?.trim().toUpperCase() || 'missing-code'
  const name = carrier?.name?.trim() || 'missing-name'
  const country = carrier?.country_code?.trim().toUpperCase()
  return `${code}/${name}${country ? `/${country}` : ''}`
}

function carrierCounts(offers: NormalizedFlightOffer[]) {
  const counts: Record<string, number> = {}
  for (const offer of offers) {
    const carriers = new Set(offer.segments?.map((segment) => `${segment.airlineCode}/${segment.airline}`) ?? [`${offer.airlineCode}/${offer.airline}`])
    for (const carrier of carriers) counts[carrier] = (counts[carrier] ?? 0) + 1
  }
  return Object.entries(counts).map(([carrier, count]) => `${carrier}=${count}`).join(', ') || 'none'
}

function logRawDuffelOffers(offers: DuffelOffer[]) {
  const marketingCounts: Record<string, number> = {}
  const operatingCounts: Record<string, number> = {}

  offers.forEach((offer, offerIndex) => {
    const segments = offer.slices?.flatMap((slice) => slice.segments ?? []) ?? []
    if (!segments.length) {
      console.info(`[Duffel] RAW OFFER #${offerIndex + 1} has no segments total=${offer.total_amount ?? 'missing'} ${offer.total_currency ?? ''}`)
      return
    }

    segments.forEach((segment, segmentIndex) => {
      const marketingCarrier = rawCarrierLabel(segment.marketing_carrier)
      const operatingCarrier = rawCarrierLabel(segment.operating_carrier)
      marketingCounts[marketingCarrier] = (marketingCounts[marketingCarrier] ?? 0) + 1
      operatingCounts[operatingCarrier] = (operatingCounts[operatingCarrier] ?? 0) + 1
      console.info(
        `[Duffel] RAW OFFER #${offerIndex + 1} SEGMENT #${segmentIndex + 1} live_mode=${offer.live_mode ?? 'missing'} marketing=${marketingCarrier} operating=${operatingCarrier} marketing_flight=${segment.marketing_carrier_flight_number ?? 'missing'} operating_flight=${segment.operating_carrier_flight_number ?? 'missing'} flight_number=${segment.flight_number ?? 'missing'} origin=${segment.origin?.iata_code ?? 'missing'} destination=${segment.destination?.iata_code ?? 'missing'} departure=${segment.departing_at ?? 'missing'} arrival=${segment.arriving_at ?? 'missing'} total=${offer.total_amount ?? 'missing'} ${offer.total_currency ?? ''}`,
      )
    })
  })

  const formatCounts = (counts: Record<string, number>) => Object.entries(counts).map(([carrier, count]) => `${carrier}=${count}`).join(', ') || 'none'
  console.info(`[Duffel] RAW OFFERS BY CARRIER: marketing [${formatCounts(marketingCounts)}]; operating [${formatCounts(operatingCounts)}]`)
}

export function normalizeDuffelOffer(
  offer: DuffelOffer,
  requestedRoute: FlightSearchRequest,
  diagnostics?: DuffelOfferDiagnostics,
): NormalizedFlightOffer | null {
  const slice = offer.slices?.[0]
  const segments = slice?.segments ?? []

  if (!slice || !segments.length) {
    return rejectOffer(diagnostics, 'missing_itinerary')
  }

  const normalizedSegments: NormalizedFlightSegment[] = []
  let previousArrival = Number.NEGATIVE_INFINITY
  for (const segment of segments) {
    const operatingCarrier = segment.operating_carrier
    const marketingCarrier = segment.marketing_carrier
    const operatingHasCode = Boolean(cleanAirlineCode(operatingCarrier?.iata_code))
    const actualCarrier = operatingHasCode ? operatingCarrier : marketingCarrier
    const airlineCode = rawCarrierCode(actualCarrier?.iata_code)
    const airline = canonicalAirlineNames[airlineCode] ?? ''
    if (!airline || !airlineCode || isProviderBrandName(airline) || (actualCarrier?.country_code && actualCarrier.country_code.trim().toUpperCase() !== 'IN')) {
      return rejectOffer(diagnostics, 'invalid_carrier')
    }

    const operatingCode = cleanAirlineCode(operatingCarrier?.iata_code)
    const marketingCode = cleanAirlineCode(marketingCarrier?.iata_code)
    const operatingFlightNumber = normalizeFlightNumber(operatingCode, segment.operating_carrier_flight_number)
    const marketingFlightNumber = normalizeFlightNumber(marketingCode, segment.marketing_carrier_flight_number)
    const flightNumber = operatingFlightNumber?.startsWith(operatingCode)
      ? operatingFlightNumber
      : marketingFlightNumber?.startsWith(marketingCode)
        ? marketingFlightNumber
        : null
    const flightNumberCarrierCode = operatingFlightNumber?.startsWith(operatingCode)
      ? operatingCode
      : marketingCode
    if (!flightNumber) return rejectOffer(diagnostics, 'invalid_flight_number')

    const origin = segment.origin?.iata_code?.trim().toUpperCase() ?? ''
    const destination = segment.destination?.iata_code?.trim().toUpperCase() ?? ''
    if (!isValidIndianAirportCode(origin) || !isValidIndianAirportCode(destination)) {
      return rejectOffer(diagnostics, 'route_mismatch')
    }

    const departureAt = segment.departing_at ?? ''
    const arrivalAt = segment.arriving_at ?? ''
    const departureTimestamp = Date.parse(departureAt)
    const arrivalTimestamp = Date.parse(arrivalAt)
    const departureDate = departureAt.slice(0, 10)
    const arrivalDate = arrivalAt.slice(0, 10)
    const departureTime = formatClockTime(departureAt)
    const arrivalTime = formatClockTime(arrivalAt)
    if (!Number.isFinite(departureTimestamp) || !Number.isFinite(arrivalTimestamp) || arrivalTimestamp < departureTimestamp || departureTimestamp < previousArrival || departureTime === '--:--' || arrivalTime === '--:--') {
      return rejectOffer(diagnostics, 'invalid_schedule')
    }
    previousArrival = arrivalTimestamp

    const previousSegment = normalizedSegments.at(-1)
    if (previousSegment && previousSegment.destination !== origin) {
      return rejectOffer(diagnostics, 'route_mismatch')
    }

    normalizedSegments.push({
      airline,
      airlineCode,
      marketingAirline: marketingCarrier?.name?.trim() || null,
      marketingAirlineCode: cleanAirlineCode(marketingCarrier?.iata_code) || null,
      operatingAirline: operatingCarrier?.name?.trim() || null,
      operatingAirlineCode: cleanAirlineCode(operatingCarrier?.iata_code) || null,
      flightNumberCarrierCode,
      carrierCountryCode: actualCarrier?.country_code?.trim().toUpperCase() || null,
      logoUrl: actualCarrier?.logo_symbol_url?.trim() || actualCarrier?.logo_lockup_url?.trim() || null,
      flightNumber,
      origin,
      destination,
      departureDate,
      departureTime,
      arrivalDate,
      arrivalTime,
    })
  }

  const firstSegment = segments[0]
  const lastSegment = segments[segments.length - 1]
  const firstNormalizedSegment = normalizedSegments[0]
  const lastNormalizedSegment = normalizedSegments[normalizedSegments.length - 1]
  if (!firstSegment || !lastSegment || !firstNormalizedSegment || !lastNormalizedSegment) {
    return rejectOffer(diagnostics, 'missing_itinerary')
  }

  const priceValue = Number(offer.total_amount)
  if (!Number.isFinite(priceValue) || priceValue <= 0) {
    return rejectOffer(diagnostics, 'invalid_price')
  }

  const routeOrigin = firstNormalizedSegment.origin
  const routeDestination = lastNormalizedSegment.destination
  const sliceOrigin = slice.origin?.iata_code?.trim().toUpperCase()
  const sliceDestination = slice.destination?.iata_code?.trim().toUpperCase()

  if (routeOrigin !== requestedRoute.origin.trim().toUpperCase() || routeDestination !== requestedRoute.destination.trim().toUpperCase() || (sliceOrigin && sliceOrigin !== routeOrigin) || (sliceDestination && sliceDestination !== routeDestination)) {
    return rejectOffer(diagnostics, 'route_mismatch')
  }

  const requestedDate = requestedRoute.departureDate.trim()
  const departureDate = firstNormalizedSegment.departureDate
  if (departureDate !== requestedDate) {
    return rejectOffer(diagnostics, 'date_mismatch')
  }

  const uniqueCarriers = [...new Map(normalizedSegments.map((segment) => [segment.airlineCode, segment])).values()]
  const airline = uniqueCarriers.map((segment) => segment.airline).join(' / ')
  const airlineCode = uniqueCarriers.map((segment) => segment.airlineCode).join('/')
  const flightNumber = normalizedSegments.map((segment) => segment.flightNumber).join(' / ')
  const departureTime = firstNormalizedSegment.departureTime
  const arrivalTime = lastNormalizedSegment.arrivalTime

  const currency = offer.total_currency?.trim().toUpperCase() || ''
  if (!currency) {
    return rejectOffer(diagnostics, 'invalid_currency')
  }

  const baseCurrency = offer.base_currency?.trim().toUpperCase() || ''
  const taxCurrency = offer.tax_currency?.trim().toUpperCase() || ''
  const baseAmount = baseCurrency === currency ? positiveAmount(offer.base_amount) : null
  const taxAmount = taxCurrency === currency ? positiveOrZeroAmount(offer.tax_amount) : null

  return {
    airline,
    airlineCode,
    segments: normalizedSegments,
    flightNumber,
    origin: routeOrigin,
    destination: routeDestination,
    departureDate: requestedDate,
    liveMode: offer.live_mode ?? false,
    departureTime,
    arrivalTime,
    duration: calculateDuration(firstSegment.departing_at, lastSegment.arriving_at, null),
    stops: Math.max(0, segments.length - 1),
    price: priceValue,
    currency,
    offerId: offer.id?.trim() || `${airlineCode}-${flightNumber}`,
    seatsRemaining: 1,
    source: 'Duffel API',
    sourceType: 'duffel',
    collectedAt: new Date().toISOString(),
    confidence: 0.82,
    baseFare: baseAmount,
    taxes: taxAmount,
    udf: null,
    convenienceFee: null,
    totalFare: priceValue,
  }
}

function positiveAmount(value: number | string | null | undefined) {
  const amount = Number(value)
  return Number.isFinite(amount) && amount > 0 ? amount : null
}

function positiveOrZeroAmount(value: number | string | null | undefined) {
  const amount = Number(value)
  return Number.isFinite(amount) && amount >= 0 ? amount : null
}

export function getDuffelAccessToken() {
  const configuredToken = process.env.DUFFEL_ACCESS_TOKEN?.trim() || process.env.DUFFEL_API_KEY?.trim() || ''
  return configuredToken === 'process.env.DUFFEL_API_KEY' ? '' : configuredToken
}

export function hasDuffelTestAccessToken() {
  return getDuffelAccessToken().startsWith('duffel_test_')
}

export async function searchDuffelOffers(
  input: FlightSearchRequest,
  onRawOfferCount?: (count: number) => void,
  onOfferValidation?: (summary: DuffelOfferValidationSummary) => void,
): Promise<NormalizedFlightOffer[]> {
  const apiKey = getDuffelAccessToken()
  if (!apiKey) {
    throw new DuffelProviderError('DUFFEL_ACCESS_TOKEN or DUFFEL_API_KEY is not configured in backend/.env', 500)
  }

  const baseUrl = (process.env.DUFFEL_API_BASE_URL?.trim() || 'https://api.duffel.com').replace(/\/$/, '')
  const supplierTimeout = Number(process.env.DUFFEL_SUPPLIER_TIMEOUT_MS ?? '10000')
  const timeoutMs = Number.isFinite(supplierTimeout) && supplierTimeout > 0 ? supplierTimeout : 10000
  const controller = new AbortController()
  const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs + 1000)

  try {
    const requestPayload = {
      data: {
        cabin_class: 'economy',
        slices: [
          {
            origin: input.origin,
            destination: input.destination,
            departure_date: input.departureDate,
          },
        ],
        passengers: Array.from({ length: input.adults }, () => ({ type: 'adult' })),
      },
    }
    console.info(`[Duffel] SAFE REQUEST PAYLOAD ${JSON.stringify(requestPayload)}`)
    const response = await fetch(`${baseUrl}/air/offer_requests?supplier_timeout=${timeoutMs}`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'Duffel-Version': 'v2',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestPayload),
      signal: controller.signal,
    })

    console.info(`[Duffel] HTTP RESPONSE STATUS ${response.status}`)
    const payload = (await response.json().catch(() => null)) as DuffelPayload | null
    if (!response.ok) {
      const firstError = payload?.errors?.[0]
      const message = firstError?.message || firstError?.title || `Duffel request failed with status ${response.status}`
      const diagnostic = [firstError?.type, firstError?.code, message].filter(Boolean).join(': ')
      console.warn(`[Duffel] HTTP ${response.status}: ${diagnostic}`)
      throw new DuffelProviderError(message, response.status)
    }

    const offers = payload?.data?.offers ?? payload?.offers
    if (!Array.isArray(offers)) {
      console.warn(`[Duffel] HTTP ${response.status}: response did not contain data.offers`)
      throw new DuffelProviderError('Duffel returned an invalid offers response', 502)
    }
    onRawOfferCount?.(offers.length)
    logRawDuffelOffers(offers)

    const diagnostics: DuffelOfferDiagnostics = {
      missing_itinerary: 0,
      invalid_carrier: 0,
      blocked_carrier: 0,
      invalid_flight_number: 0,
      invalid_price: 0,
      invalid_currency: 0,
      invalid_schedule: 0,
      route_mismatch: 0,
      date_mismatch: 0,
    }
    const normalizedOffers: NormalizedFlightOffer[] = []
    offers.forEach((offer, index) => {
      const offerDiagnostics: DuffelOfferDiagnostics = {
        missing_itinerary: 0,
        invalid_carrier: 0,
        blocked_carrier: 0,
        invalid_flight_number: 0,
        invalid_price: 0,
        invalid_currency: 0,
        invalid_schedule: 0,
        route_mismatch: 0,
        date_mismatch: 0,
      }
      const normalized = normalizeDuffelOffer(offer, input, offerDiagnostics)
      for (const reason of Object.keys(diagnostics) as DuffelOfferRejectionReason[]) {
        diagnostics[reason] += offerDiagnostics[reason]
      }
      if (normalized) {
        normalizedOffers.push(normalized)
      } else {
        const reasons = Object.entries(offerDiagnostics).filter(([, count]) => count > 0).map(([reason]) => reason).join(', ') || 'unknown validation failure'
        console.warn(`[Duffel] REJECTED OFFER #${index + 1}: ${reasons}`)
      }
    })
    normalizedOffers.sort((left, right) => left.price - right.price)
    const rejectedOfferCount = Object.values(diagnostics).reduce((total, count) => total + count, 0)
    onOfferValidation?.({
      validOffers: normalizedOffers.length,
      rejectedOffers: rejectedOfferCount,
      rejections: Object.fromEntries(Object.entries(diagnostics).filter(([, count]) => count > 0)),
    })
    console.info(`[Duffel] HTTP ${response.status}: received ${offers.length} offers, normalized ${normalizedOffers.length} offers for ${input.origin}-${input.destination} on ${input.departureDate}`)
    console.info(`[Duffel] NORMALIZED OFFERS BY CARRIER: ${carrierCounts(normalizedOffers)}`)
    console.info(`[Duffel] REJECTED OFFERS + EXACT REASON: ${Object.entries(diagnostics).filter(([, count]) => count > 0).map(([reason, count]) => `${reason}=${count}`).join(', ') || 'none'}`)
    if (!normalizedOffers.length) {
      console.warn(`[Duffel] No verified offers for ${input.origin}-${input.destination} on ${input.departureDate}; see rejection counts above`)
    }

    return normalizedOffers
  } catch (error) {
    if (error instanceof DuffelProviderError) throw error
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new DuffelProviderError('Duffel request timed out before returning offers', 504)
    }
    throw new DuffelProviderError('Unable to fetch live flight offers from Duffel', 502)
  } finally {
    clearTimeout(timeoutHandle)
  }
}
