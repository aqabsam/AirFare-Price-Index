import { scrapeWebsite } from './shared.js'
import type { WebsiteScraper, ScraperDefinition } from './types.js'
import type { FlightSearchRequest } from '../types/flight.js'

export function createEaseMyTripScraper(): WebsiteScraper | null {
  const url = process.env.SCRAPER_EASEMYTRIP_URL?.trim() || 'https://flight.easemytrip.com/'
  if (!url) return null

  const definition: ScraperDefinition = {
    id: 'easemytrip',
    name: 'EaseMyTrip website',
    sourceType: 'ota',
    url,
    cardSelectors: [
      '[class*="fltResult"]',
      '[class*="flt-opt"]',
      '[class*="listing"]',
      '[class*="flight"]',
      'article',
    ],
    hints: {
      origin: [/from|origin|depart/i],
      destination: [/to|destination|arriv/i],
      date: [/date|departure|journey/i],
      submit: [/search|search flights|continue/i],
    },
    buildSearchUrl: (input: FlightSearchRequest) => {
      const [y, m, d] = input.departureDate.split('-')
      const dateDMY = `${d}/${m}/${y}`
      return `https://flight.easemytrip.com/FlightList/Index?srch=${input.origin}-${input.destination}-${dateDMY}&px=${input.adults}-0-0&cbn=0&ar=undefined&isSplitItinerary=false`
    },
  }

  return { definition, scrape: (browser, input) => scrapeWebsite(browser, definition, input) }
}
