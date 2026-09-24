import type { Browser, Page } from 'playwright'
import type { FareSnapshot } from '../types/fare.js'
import type { FlightSearchRequest } from '../types/flight.js'
import type { ScraperDefinition } from './types.js'

export const SOURCE_TIMEOUT_MS = Math.max(30_000, Number(process.env.SCRAPER_TIMEOUT ?? '30000'))
const IST_TIME_ZONE = 'Asia/Kolkata'

export const KNOWN_AIRLINES: { name: string; code: string; matchers: RegExp[] }[] = [
  { name: 'Air India Express', code: 'IX', matchers: [/air[- ]?india express/i, /\bIX\b/i] },
  { name: 'Air India', code: 'AI', matchers: [/air[- ]?india\b(?! express)/i, /\bAI\b/i] },
  { name: 'IndiGo', code: '6E', matchers: [/indigo/i, /\b6E\b/i] },
  { name: 'SpiceJet', code: 'SG', matchers: [/spicejet/i, /\bSG\b/i] },
  { name: 'Akasa Air', code: 'QP', matchers: [/akasa(?: air)?/i, /\bQP\b/i] },
  { name: 'Alliance Air', code: '9I', matchers: [/alliance(?: air)?/i, /\b9I\b/i] },
  { name: 'Star Air', code: 'S5', matchers: [/star air/i, /\bS5\b/i] },
  { name: 'Vistara', code: 'UK', matchers: [/vistara/i, /\bUK\b/i] },
]

export function todayInIndia() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: IST_TIME_ZONE }).format(new Date())
}

export function routeKey(input: FlightSearchRequest) {
  return `${input.origin}-${input.destination}-${input.departureDate}`.toUpperCase()
}

export function numberFrom(value: string) {
  const parsed = Number(value.replace(/[^\d.]/g, ''))
  return Number.isFinite(parsed) ? Math.round(parsed) : 0
}

export function labeledAmount(value: string, labels: string[]) {
  const pattern = new RegExp(`(?:${labels.join('|')})\\s*[:\\-]?\\s*(?:₹|INR|Rs\\.?)?\\s*([\\d,]+(?:\\.\\d+)?)`, 'i')
  const match = value.match(pattern)
  return match?.[1] ? numberFrom(match[1]) : null
}

export function durationFrom(value: string) {
  const hours = value.match(/(\d+(?:\.\d+)?)\s*h(?:r|ours?)?/i)?.[1]
  const minutes = value.match(/(\d+)\s*m(?:in|inutes?)?/i)?.[1]
  if (hours || minutes) {
    return Math.round(Number(hours ?? 0) * 60 + Number(minutes ?? 0))
  }
  return 0
}

export function parseTimes(text: string): { departure: string; arrival: string } | null {
  const matches = [...text.matchAll(/\b([01]?\d|2[0-3]):([0-5]\d)(?:\s*(AM|PM))?\b/gi)]
  if (matches.length < 2) return null

  function formatTime(m: RegExpMatchArray): string {
    let hours = parseInt(m[1], 10)
    const minutes = m[2]
    const meridiem = m[3]?.toUpperCase()

    if (meridiem === 'PM' && hours < 12) hours += 12
    if (meridiem === 'AM' && hours === 12) hours = 0

    return `${String(hours).padStart(2, '0')}:${minutes}`
  }

  return {
    departure: formatTime(matches[0]),
    arrival: formatTime(matches[1]),
  }
}

export function parseFlightNumber(text: string, airlineCode: string, index: number): string {
  const match = text.match(/\b([A-Z0-9]{2})\s?[-]?\s?(\d{3,4})\b/i)
  if (match) {
    const code = match[1].toUpperCase()
    if (!['AM', 'PM', 'HR', 'CO', 'TO', 'IN', 'ON', 'IS', 'AT', 'OF'].includes(code)) {
      return `${code}${match[2]}`
    }
  }
  return `${airlineCode}-${String(100 + index)}`
}

export function parseAirline(text: string, fallbackAirline?: string, fallbackCode?: string) {
  for (const item of KNOWN_AIRLINES) {
    if (item.matchers.some((m) => m.test(text))) {
      return { airline: item.name, code: item.code }
    }
  }
  return {
    airline: fallbackAirline || 'Domestic Carrier',
    code: fallbackCode || 'XX',
  }
}

export function stopsFrom(value: string) {
  if (/non[- ]?stop|direct/i.test(value)) return 0
  const match = value.match(/(\d+)\s*stop/i)
  return match ? parseInt(match[1], 10) : 0
}

function matchesAny(value: string, patterns: RegExp[]) {
  return patterns.some((pattern) => pattern.test(value))
}

async function fillByHints(page: Page, patterns: RegExp[], value: string) {
  const fields = page.locator('input, textarea')
  for (let index = 0; index < await fields.count(); index += 1) {
    const field = fields.nth(index)
    const metadata = await field.evaluate((element) => ({
      placeholder: element.getAttribute('placeholder') ?? '',
      aria: element.getAttribute('aria-label') ?? '',
      name: element.getAttribute('name') ?? '',
      id: element.getAttribute('id') ?? '',
      type: element.getAttribute('type') ?? '',
    })).catch(() => null)
    if (!metadata || !matchesAny(`${metadata.placeholder} ${metadata.aria} ${metadata.name} ${metadata.id}`.toLowerCase(), patterns)) continue
    await field.fill(value).catch(() => undefined)
    return
  }
}

async function submitByHints(page: Page, patterns: RegExp[]) {
  const controls = page.locator('button, input[type="submit"], [role="button"]')
  for (let index = 0; index < await controls.count(); index += 1) {
    const control = controls.nth(index)
    const text = await control.innerText().catch(() => '')
    const aria = await control.getAttribute('aria-label').catch(() => '')
    if (matchesAny(`${text} ${aria}`.toLowerCase(), patterns)) {
      await control.click({ force: true }).catch(() => undefined)
      return
    }
  }
  await page.keyboard.press('Enter').catch(() => undefined)
}

export function buildSnapshot(text: string, definition: ScraperDefinition, input: FlightSearchRequest, index: number): FareSnapshot | null {
  const times = parseTimes(text)
  const priceMatch = text.match(/(?:₹|INR|Rs\.?)\s*([\d,]+(?:\.\d+)?)/i)
  if (!priceMatch || !times) return null

  const price = numberFrom(priceMatch[1] ?? '')
  if (!price) return null

  const durationMinutes = durationFrom(text)
  const baseFare = labeledAmount(text, ['base fare', 'base'])
  const taxes = labeledAmount(text, ['taxes', 'tax'])
  const udf = labeledAmount(text, ['udf', 'user development fee'])
  const convenienceFee = labeledAmount(text, ['convenience fee', 'convenience'])

  const { airline, code } = parseAirline(text, definition.airline, definition.airlineCode)
  const number = parseFlightNumber(text, code, index)
  const collectedAt = new Date().toISOString()

  return {
    id: `${definition.id}-${input.origin}-${input.destination}-${input.departureDate}-${index}`,
    routeKey: routeKey(input),
    origin: input.origin,
    destination: input.destination,
    departureDate: input.departureDate,
    bookingWindowDays: 0,
    collectionDate: todayInIndia(),
    collectedAt,
    sourceId: definition.id,
    airline: definition.airline ?? airline,
    airlineCode: definition.airlineCode ?? code,
    flightNumber: number,
    departureTime: times.departure,
    arrivalTime: times.arrival,
    durationMinutes,
    stops: stopsFrom(text),
    price,
    baseFare,
    taxes,
    udf,
    convenienceFee,
    totalFare: price,
    currency: 'INR',
    seatsRemaining: 9,
    source: definition.name,
    collectionStage: 'SCRAPER',
    sourceType: definition.sourceType,
    confidence: 0.9,
  }
}

export async function scrapeWebsite(browser: Browser, definition: ScraperDefinition, input: FlightSearchRequest): Promise<FareSnapshot[]> {
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
    viewport: { width: 1366, height: 768 },
    locale: 'en-US',
  }).catch(() => null)

  const page = context ? await context.newPage() : await browser.newPage()
  try {
    const targetUrl = definition.buildSearchUrl ? definition.buildSearchUrl(input) : definition.url

    await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: SOURCE_TIMEOUT_MS })

    if (!definition.buildSearchUrl) {
      await fillByHints(page, definition.hints.origin, input.origin)
      await fillByHints(page, definition.hints.destination, input.destination)
      await fillByHints(page, definition.hints.date, input.departureDate)
      await submitByHints(page, definition.hints.submit)
    }

    if (definition.extractSnapshots) {
      return await definition.extractSnapshots(page, definition, input)
    }

    const cardSelector = definition.cardSelectors.join(', ')
    await page.waitForSelector(cardSelector, { timeout: SOURCE_TIMEOUT_MS }).catch(() => undefined)
    await page.waitForTimeout(1500)

    const cards = page.locator(cardSelector)
    const count = await cards.count().catch(() => 0)
    const snapshots: FareSnapshot[] = []

    for (let index = 0; index < Math.min(count, 100); index += 1) {
      const text = await cards.nth(index).innerText().catch(() => '')
      const snapshot = buildSnapshot(text, definition, input, index)
      if (snapshot) snapshots.push(snapshot)
    }

    return snapshots
  } catch (error) {
    console.warn(`[Scraper: ${definition.name}] Scrape warning:`, error instanceof Error ? error.message : error)
    if (error instanceof Error && (error.name === 'TimeoutError' || /timeout|timed out|aborted/i.test(error.message))) {
      throw error
    }
    return []
  } finally {
    await page.close().catch(() => undefined)
    if (context) await context.close().catch(() => undefined)
  }
}
