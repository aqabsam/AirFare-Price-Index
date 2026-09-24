import { scrapeWebsite } from './shared.js'
import type { WebsiteScraper } from './types.js'

export function createMakeMyTripScraper(): WebsiteScraper | null {
  const url = process.env.SCRAPER_MAKEMYTRIP_URL?.trim()
  if (!url) return null
  const definition = {
    id: 'makemytrip', name: 'MakeMyTrip website', sourceType: 'ota' as const, url,
    cardSelectors: ['[class*="listingCard"]', '[class*="flightCard"]', '[data-testid*="flight"]', 'article'],
    hints: { origin: [/from|origin|depart/i], destination: [/to|destination|arriv/i], date: [/date|departure|journey/i], submit: [/search|search flights|continue/i] },
  }
  return { definition, scrape: (browser, input) => scrapeWebsite(browser, definition, input) }
}
