import { createIndigoScraper } from './indigo.js'
import { createAirIndiaScraper } from './airIndia.js'
import { createAirIndiaExpressScraper } from './airIndiaExpress.js'
import { createAkasaScraper } from './akasa.js'
import { createSpiceJetScraper } from './spiceJet.js'
import { createGoogleFlightsScraper } from './googleFlights.js'
import { createIxigoScraper } from './ixigo.js'
import { createMakeMyTripScraper } from './makeMyTrip.js'
import { createGoIbiboScraper } from './goIbibo.js'
import { createYatraScraper } from './yatra.js'
import { createEaseMyTripScraper } from './easeMyTrip.js'
import { createClearTripScraper } from './clearTrip.js'
import { createAllianceAirScraper } from './allianceAir.js'
import { createStarAirScraper } from './starAir.js'
import type { WebsiteScraper } from './types.js'

export const REQUIRED_AIRLINE_SCRAPERS = [
  'IndiGo',
  'Air India',
  'Air India Express',
  'Akasa Air',
  'SpiceJet',
] as const

const SCRAPER_FACTORIES = [
  createIndigoScraper,
  createAirIndiaScraper,
  createAirIndiaExpressScraper,
  createAkasaScraper,
  createSpiceJetScraper,
  createGoogleFlightsScraper,
  createIxigoScraper,
  createMakeMyTripScraper,
  createGoIbiboScraper,
  createYatraScraper,
  createEaseMyTripScraper,
  createClearTripScraper,
  createAllianceAirScraper,
  createStarAirScraper,
] as const

export function getConfiguredAirlineScrapers() {
  return SCRAPER_FACTORIES
    .map((factory) => factory())
    .filter((scraper): scraper is WebsiteScraper => Boolean(scraper))
    .filter((scraper) => {
      if (scraper.definition.airline) {
        return REQUIRED_AIRLINE_SCRAPERS.includes(scraper.definition.airline as (typeof REQUIRED_AIRLINE_SCRAPERS)[number])
      }
      return true
    })
}

export function loadWebsiteScrapers() {
  return SCRAPER_FACTORIES
    .map((factory) => factory())
    .filter((scraper): scraper is WebsiteScraper => Boolean(scraper))
}
