import { scrapeWebsite } from './shared.js'
import type { WebsiteScraper } from './types.js'

export function createAllianceAirScraper(): WebsiteScraper | null {
  const url = process.env.SCRAPER_ALLIANCE_AIR_URL?.trim()
  if (!url) return null
  const definition = { id: 'alliance-air', name: 'Alliance Air website', sourceType: 'airline' as const, airline: 'Alliance Air', airlineCode: '9I', url, cardSelectors: ['[data-testid*="flight"]', '[class*="flight"]', 'article'], hints: { origin: [/from|origin|depart/i], destination: [/to|destination|arriv/i], date: [/date|departure|journey/i], submit: [/search|find flights|continue/i] } }
  return { definition, scrape: (browser, input) => scrapeWebsite(browser, definition, input) }
}
