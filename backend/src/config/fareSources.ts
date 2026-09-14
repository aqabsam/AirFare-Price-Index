import { readFile } from 'node:fs/promises'
import path from 'node:path'

export type FareSourceFieldSelectors = {
  card: string
  id?: string
  routeKey?: string
  origin?: string
  destination?: string
  departureDate?: string
  airline?: string
  airlineCode?: string
  flightNumber?: string
  departureTime?: string
  arrivalTime?: string
  durationMinutes?: string
  stops?: string
  price?: string
  currency?: string
  seatsRemaining?: string
  source?: string
  confidence?: string
}

export type FareSourceRoute = {
  origin: string
  destination: string
  departureDate?: string
  bookingWindowDays?: number
  collectionDate?: string
}

export type FareSourceConfig = {
  id?: string
  name: string
  sourceType: 'airline' | 'ota' | 'aggregated'
  kind?: 'page' | 'api'
  url?: string
  method?: 'GET' | 'POST'
  headers?: Record<string, string>
  body?: unknown
  responsePath?: string
  routes?: FareSourceRoute[]
  bookingWindows?: number[]
  selectors: FareSourceFieldSelectors
  apiFields?: Partial<FareSourceFieldSelectors>
}

type FareSourceConfigInput = Partial<FareSourceConfig> & {
  id?: string
  name?: string
  type?: 'web' | 'api'
  enabled?: boolean
  sourceType?: FareSourceConfig['sourceType']
  selectors?: Partial<FareSourceFieldSelectors>
  routes?: Array<Partial<FareSourceRoute> | null | undefined>
  bookingWindows?: Array<number | string | null | undefined>
}

function defaultSelectors(): FareSourceFieldSelectors {
  return {
    card: '[data-fare-card], [data-testid*="flight"], [class*="flight"], article, li, tr, [role="listitem"]',
    id: '[data-id]',
    routeKey: '[data-route-key]',
    origin: '[data-origin]',
    destination: '[data-destination]',
    departureDate: '[data-departure-date]',
    airline: '[data-airline]',
    airlineCode: '[data-airline-code]',
    flightNumber: '[data-flight-number]',
    departureTime: '[data-departure-time]',
    arrivalTime: '[data-arrival-time]',
    durationMinutes: '[data-duration-minutes]',
    stops: '[data-stops]',
    price: '[data-price]',
    currency: '[data-currency]',
    seatsRemaining: '[data-seats-remaining]',
    source: '[data-source]',
    confidence: '[data-confidence]',
  }
}

function inferSourceType(input: FareSourceConfigInput): FareSourceConfig['sourceType'] {
  if (input.sourceType) {
    return input.sourceType
  }

  const lowered = `${input.id ?? ''} ${input.name ?? ''}`.toLowerCase()
  if (lowered.includes('yatra') || lowered.includes('makemytrip') || lowered.includes('easemytrip') || lowered.includes('cleartrip') || lowered.includes('ixigo') || lowered.includes('goibibo')) {
    return 'ota'
  }

  return 'airline'
}

function normalizeSourceEntry(entry: FareSourceConfigInput): FareSourceConfig | null {
  if (entry.enabled === false) {
    return null
  }

  const kind = entry.kind ?? (entry.type === 'api' ? 'api' : 'page')
  const sourceType = inferSourceType(entry)
  const name = (entry.name ?? entry.id ?? '').trim()
  const url = entry.url?.trim() || ''
  if (!name || !url) {
    return null
  }

  return {
    id: entry.id?.trim() || undefined,
    name,
    sourceType,
    kind,
    url,
    method: entry.method ?? 'GET',
    headers: entry.headers ?? {},
    body: entry.body,
    responsePath: entry.responsePath?.trim() || '',
    routes: Array.isArray(entry.routes)
      ? entry.routes
          .map((route): FareSourceRoute | null => {
            if (!route) {
              return null
            }

            const origin = typeof route.origin === 'string' ? route.origin.trim().toUpperCase() : ''
            const destination = typeof route.destination === 'string' ? route.destination.trim().toUpperCase() : ''
            if (!origin || !destination) {
              return null
            }

            return {
              origin,
              destination,
              departureDate: typeof route.departureDate === 'string' ? route.departureDate.trim() || undefined : undefined,
              bookingWindowDays:
                typeof route.bookingWindowDays === 'number' && Number.isFinite(route.bookingWindowDays)
                  ? Math.max(0, Math.round(route.bookingWindowDays))
                  : undefined,
              collectionDate: typeof route.collectionDate === 'string' ? route.collectionDate.trim() || undefined : undefined,
            }
          })
          .filter((route): route is FareSourceRoute => Boolean(route))
      : [],
    bookingWindows: Array.isArray(entry.bookingWindows)
      ? entry.bookingWindows
          .map((value) => Number(value))
          .filter((value) => Number.isFinite(value) && value > 0)
      : undefined,
    selectors: { ...defaultSelectors(), ...(entry.selectors ?? {}) },
    apiFields: entry.apiFields ?? {},
  }
}

function renderTemplate<T>(value: T, route?: FareSourceRoute): T {
  if (typeof value === 'string') {
    return value
      .replace(/\{\{\s*origin\s*\}\}/gi, route?.origin ?? '')
      .replace(/\{\{\s*destination\s*\}\}/gi, route?.destination ?? '')
      .replace(/\{\{\s*departureDate\s*\}\}/gi, route?.departureDate ?? '')
      .replace(/\{\{\s*bookingWindowDays\s*\}\}/gi, route?.bookingWindowDays !== undefined ? String(route.bookingWindowDays) : '')
      .replace(/\{\{\s*collectionDate\s*\}\}/gi, route?.collectionDate ?? '') as T
  }

  if (Array.isArray(value)) {
    return value.map((entry) => renderTemplate(entry, route)) as T
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, entry]) => [key, renderTemplate(entry, route)]),
    ) as T
  }

  return value
}

function envSource(name: string, sourceType: FareSourceConfig['sourceType'], urlEnv: string): FareSourceConfig {
  return {
    name,
    sourceType,
    kind: 'page',
    url: process.env[urlEnv]?.trim() || '',
    selectors: defaultSelectors(),
  }
}

export async function loadFareSourceConfigs(): Promise<FareSourceConfig[]> {
  const configPath = process.env.FARE_SOURCES_CONFIG?.trim()
  if (configPath) {
    try {
      const raw = await readFile(path.resolve(configPath), 'utf8')
      const parsed = JSON.parse(raw) as FareSourceConfig[] | { sources?: FareSourceConfigInput[] }
      const entries = Array.isArray(parsed) ? parsed : parsed.sources ?? []
      return entries.map(normalizeSourceEntry).filter((entry): entry is FareSourceConfig => Boolean(entry))
    } catch {
      return []
    }
  }

  return [
    envSource('IndiGo public booking flow', 'airline', 'INDIGO_SOURCE_URL'),
    envSource('Air India booking flow', 'airline', 'AIR_INDIA_SOURCE_URL'),
    envSource('Akasa Air OTA mirror', 'ota', 'AKASA_SOURCE_URL'),
    envSource('SpiceJet booking flow', 'airline', 'SPICEJET_SOURCE_URL'),
  ].filter((entry) => Boolean(entry.url))
}

export function getDefaultFareSourceConfig() {
  return {
    card: '[data-fare-card]',
    id: '[data-id]',
    routeKey: '[data-route-key]',
    origin: '[data-origin]',
    destination: '[data-destination]',
    departureDate: '[data-departure-date]',
    airline: '[data-airline]',
    airlineCode: '[data-airline-code]',
    flightNumber: '[data-flight-number]',
    departureTime: '[data-departure-time]',
    arrivalTime: '[data-arrival-time]',
    durationMinutes: '[data-duration-minutes]',
    stops: '[data-stops]',
    price: '[data-price]',
    currency: '[data-currency]',
    seatsRemaining: '[data-seats-remaining]',
    source: '[data-source]',
    confidence: '[data-confidence]',
  } satisfies FareSourceFieldSelectors
}

export function renderFareSourceTemplate<T>(value: T, route?: FareSourceRoute) {
  return renderTemplate(value, route)
}
