import { scrapeWebsite, buildSnapshot, SOURCE_TIMEOUT_MS } from './shared.js'
import type { WebsiteScraper, ScraperDefinition } from './types.js'
import type { FlightSearchRequest } from '../types/flight.js'
import type { FareSnapshot } from '../types/fare.js'
import type { Page } from 'playwright'

export function createGoogleFlightsScraper(): WebsiteScraper | null {
  const url = process.env.SCRAPER_GOOGLE_FLIGHTS_URL?.trim() || 'https://www.google.com/travel/flights'
  if (!url) return null

  const definition: ScraperDefinition = {
    id: 'google-flights',
    name: 'Google Flights',
    sourceType: 'ota',
    url,
    cardSelectors: ['li:has-text("₹")', 'div.yR1fYc', '[role="listitem"]:has-text("₹")'],
    hints: {
      origin: [/from|origin/i],
      destination: [/to|destination/i],
      date: [/date|departure/i],
      submit: [/search/i],
    },
    buildSearchUrl: (input: FlightSearchRequest) => {
      const base = url.split('?')[0].replace(/\/+$/, '')
      return `${base}?q=Flights%20to%20${input.destination}%20from%20${input.origin}%20on%20${input.departureDate}%20oneway`
    },
    extractSnapshots: async (page: Page, def: ScraperDefinition, input: FlightSearchRequest): Promise<FareSnapshot[]> => {
      const cardSelector = 'li:has-text("₹"), div.yR1fYc'
      await page.waitForSelector(cardSelector, { timeout: SOURCE_TIMEOUT_MS }).catch(() => undefined)
      await page.waitForTimeout(2000)

      const cards = page.locator(cardSelector)
      const count = await cards.count().catch(() => 0)
      const snapshots: FareSnapshot[] = []

      for (let i = 0; i < Math.min(count, 50); i++) {
        const text = await cards.nth(i).innerText().catch(() => '')
        if (!text || !text.includes('₹')) continue

        const snapshot = buildSnapshot(text, def, input, i)
        if (snapshot) {
          snapshots.push(snapshot)
        }
      }

      return snapshots
    },
  }

  return {
    definition,
    scrape: (browser, input) => scrapeWebsite(browser, definition, input),
  }
}

