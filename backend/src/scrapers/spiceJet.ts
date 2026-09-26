import { scrapeWebsite } from './shared.js'
import type { WebsiteScraper, ScraperDefinition } from './types.js'
import type { FlightSearchRequest } from '../types/flight.js'

export function createSpiceJetScraper(): WebsiteScraper | null {
  const url = process.env.SCRAPER_SPICEJET_URL?.trim() || 'https://www.spicejet.com/'
  if (!url) return null

  const definition: ScraperDefinition = {
    id: 'spicejet',
    name: 'SpiceJet website',
    sourceType: 'airline',
    airline: 'SpiceJet',
    airlineCode: 'SG',
    url,
    cardSelectors: [
      '[data-testid*="flight"]',
      '[class*="flight-card"]',
      '[class*="flightCard"]',
      'div:has-text("SG-")',
      'article',
    ],
    hints: {
      origin: [/from|origin|depart/i],
      destination: [/to|destination|arriv/i],
      date: [/date|departure|journey/i],
      submit: [/search|find flights|continue/i],
    },
    buildSearchUrl: (input: FlightSearchRequest) => {
      const configuredOrigin = new URL(url).origin
      return `${configuredOrigin}/search?from=${input.origin}&to=${input.destination}&tripType=1&departure=${input.departureDate}&adult=${input.adults}`
    },
  }

  return { definition, scrape: (browser, input) => scrapeWebsite(browser, definition, input) }
}
