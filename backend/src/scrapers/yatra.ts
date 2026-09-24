import { scrapeWebsite } from './shared.js'
import type { WebsiteScraper } from './types.js'

export function createYatraScraper(): WebsiteScraper | null {
  const url = process.env.SCRAPER_YATRA_URL?.trim()
  if (!url) return null
  const definition = { id: 'yatra', name: 'Yatra website', sourceType: 'ota' as const, url, cardSelectors: ['[class*="flight"]', '[class*="listing"]', '[data-testid*="flight"]', 'article'], hints: { origin: [/from|origin|depart/i], destination: [/to|destination|arriv/i], date: [/date|departure|journey/i], submit: [/search|search flights|continue/i] } }
  return { definition, scrape: (browser, input) => scrapeWebsite(browser, definition, input) }
}
