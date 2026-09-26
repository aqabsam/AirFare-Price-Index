import { scrapeWebsite } from './shared.js'
import type { WebsiteScraper } from './types.js'

export function createIndigoScraper(): WebsiteScraper | null {
  const url = process.env.SCRAPER_INDIGO_URL?.trim() || 'https://www.goindigo.in/flights'
  if (!url) return null
  const definition = {
    id: 'indigo', name: 'IndiGo website', sourceType: 'airline' as const, airline: 'IndiGo', airlineCode: '6E', url,
    cardSelectors: ['[data-testid*="flight"]', '[class*="flight-card"]', '[class*="flightCard"]', 'article'],
    hints: { origin: [/from|origin|depart/i], destination: [/to|destination|arriv/i], date: [/date|departure|journey/i], submit: [/search|find flights|continue/i] },
  }
  return { definition, scrape: (browser, input) => scrapeWebsite(browser, definition, input) }
}
