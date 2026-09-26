import assert from 'node:assert/strict'
import test from 'node:test'

import { fareStore } from '../services/fareStore.js'
import { getConfiguredAirlineScrapers, loadWebsiteScrapers, REQUIRED_AIRLINE_SCRAPERS } from './index.js'
import { createEaseMyTripScraper } from './easeMyTrip.js'
import { createIxigoScraper } from './ixigo.js'
import { buildSnapshot, parseFlightNumber } from './shared.js'
import { createSpiceJetScraper } from './spiceJet.js'
import type { ScraperDefinition } from './types.js'

test('scraped flight numbers must match the source airline code', () => {
  assert.equal(parseFlightNumber('IndiGo 6E 6187 08:00 INR 5,100', '6E'), '6E6187')
  assert.equal(parseFlightNumber('IndiGo BY201 08:00 INR 5,100', '6E'), null)
  assert.equal(parseFlightNumber('IndiGo 27125 08:00 INR 5,100', '6E'), null)
  assert.equal(parseFlightNumber('Akasa QP-1234 08:00 INR 5,100', 'QP'), 'QP1234')
})

test('Google Flights result rows without a flight number report the exact parse rejection', () => {
  const definition: ScraperDefinition = {
    id: 'google-flights', name: 'Google Flights', sourceType: 'ota', url: 'https://www.google.com/travel/flights',
    cardSelectors: ['div.yR1fYc'], hints: { origin: [], destination: [], date: [], submit: [] },
  }
  const rejectionCounts: Record<string, number> = {}
  const snapshot = buildSnapshot(
    '11:55 PM - 2:15 AM+1 Air India 2 hr 20 min BOM-DEL Nonstop INR 6,346',
    definition,
    { origin: 'BOM', destination: 'DEL', departureDate: '2026-09-26', adults: 1 },
    0,
    rejectionCounts,
  )

  assert.equal(snapshot, null)
  assert.deepEqual(rejectionCounts, { 'missing flight number': 1 })
})

test('search URL builders preserve configured hosts and exact route/date/passenger parameters', () => {
  const input = { origin: 'BOM', destination: 'DEL', departureDate: '2026-09-26', adults: 2 }
  const original = {
    ixigo: process.env.SCRAPER_IXIGO_URL,
    easemytrip: process.env.SCRAPER_EASEMYTRIP_URL,
    spicejet: process.env.SCRAPER_SPICEJET_URL,
  }

  try {
    process.env.SCRAPER_IXIGO_URL = 'https://ixigo.example/search/result/flight'
    process.env.SCRAPER_EASEMYTRIP_URL = 'https://emt.example/'
    process.env.SCRAPER_SPICEJET_URL = 'https://spicejet.example/'
    const ixigoUrl = new URL(createIxigoScraper()?.definition.buildSearchUrl?.(input) ?? '')
    const easeMyTripUrl = new URL(createEaseMyTripScraper()?.definition.buildSearchUrl?.(input) ?? '')
    const spiceJetUrl = new URL(createSpiceJetScraper()?.definition.buildSearchUrl?.(input) ?? '')

    assert.equal(ixigoUrl.origin, 'https://ixigo.example')
    assert.deepEqual(Object.fromEntries(ixigoUrl.searchParams), {
      from: 'BOM', to: 'DEL', date: '26092026', adults: '2', children: '0', infants: '0', class: 'e',
    })
    assert.equal(easeMyTripUrl.origin, 'https://emt.example')
    assert.equal(easeMyTripUrl.searchParams.get('srch'), 'BOM-DEL-26/09/2026')
    assert.equal(easeMyTripUrl.searchParams.get('px'), '2-0-0')
    assert.equal(spiceJetUrl.origin, 'https://spicejet.example')
    assert.deepEqual(Object.fromEntries(spiceJetUrl.searchParams), {
      from: 'BOM', to: 'DEL', tripType: '1', departure: '2026-09-26', adult: '2',
    })
  } finally {
    if (original.ixigo === undefined) delete process.env.SCRAPER_IXIGO_URL
    else process.env.SCRAPER_IXIGO_URL = original.ixigo
    if (original.easemytrip === undefined) delete process.env.SCRAPER_EASEMYTRIP_URL
    else process.env.SCRAPER_EASEMYTRIP_URL = original.easemytrip
    if (original.spicejet === undefined) delete process.env.SCRAPER_SPICEJET_URL
    else process.env.SCRAPER_SPICEJET_URL = original.spicejet
  }
})

test('default stored fare catalog is available when no snapshot cache is loaded', async () => {
  fareStore.replaceSnapshots([])

  await fareStore.load()

  assert.ok(fareStore.getSnapshots().length > 0)
  assert.ok(fareStore.search('PAT', 'BOM', '2026-09-03', 1).length > 0)
})

test('all configured Indian airline scrapers and OTAs are available to live search', () => {
  const allScrapers = loadWebsiteScrapers()
  const airlineScrapers = getConfiguredAirlineScrapers()
  const airlineNames = [...new Set(airlineScrapers.map((scraper) => scraper.definition.airline).filter(Boolean))].sort()

  assert.ok(allScrapers.length >= 1)
  assert.ok(allScrapers.some((scraper) => scraper.definition.id === 'spicejet'))

  assert.ok(airlineNames.includes('IndiGo'))
  assert.ok(airlineNames.includes('Air India'))
  assert.ok(airlineNames.includes('Air India Express'))
  assert.ok(airlineNames.includes('Akasa Air'))
  assert.ok(airlineNames.includes('SpiceJet'))
  assert.deepEqual(
    airlineScrapers.map((scraper) => scraper.definition.id),
    allScrapers.map((scraper) => scraper.definition.id),
  )
  assert.ok(airlineScrapers.some((scraper) => scraper.definition.sourceType === 'ota'))
  assert.ok(REQUIRED_AIRLINE_SCRAPERS.every((name) => airlineNames.includes(name)))
})
