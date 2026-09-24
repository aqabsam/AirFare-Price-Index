import { scrapeWebsite } from './shared.js'
import type { WebsiteScraper } from './types.js'

export function createAkasaScraper(): WebsiteScraper | null {
  const url = process.env.SCRAPER_AKASA_URL?.trim()
  if (!url) return null
  const definition = { id: 'akasa', name: 'Akasa Air website', sourceType: 'airline' as const, airline: 'Akasa Air', airlineCode: 'QP', url, cardSelectors: ['[data-testid*="flight"]', '[class*="flight"]', 'article'], hints: { origin: [/from|origin|depart/i], destination: [/to|destination|arriv/i], date: [/date|departure|journey/i], submit: [/search|find flights|continue/i] } }
  return { definition, scrape: (browser, input) => scrapeWebsite(browser, definition, input) }
}
