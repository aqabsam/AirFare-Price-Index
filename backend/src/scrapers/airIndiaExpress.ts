import { scrapeWebsite } from './shared.js'
import type { WebsiteScraper } from './types.js'

export function createAirIndiaExpressScraper(): WebsiteScraper | null {
  const url = process.env.SCRAPER_AIR_INDIA_EXPRESS_URL?.trim() || 'https://www.airindiaexpress.com/'
  if (!url) return null
  const definition = { id: 'air-india-express', name: 'Air India Express website', sourceType: 'airline' as const, airline: 'Air India Express', airlineCode: 'IX', url, cardSelectors: ['[data-testid*="flight"]', '[class*="flight"]', 'article'], hints: { origin: [/from|origin|depart/i], destination: [/to|destination|arriv/i], date: [/date|departure|journey/i], submit: [/search|find flights|continue/i] } }
  return { definition, scrape: (browser, input) => scrapeWebsite(browser, definition, input) }
}
