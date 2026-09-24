import assert from 'node:assert/strict'
import test from 'node:test'

import { fareStore } from '../services/fareStore.js'
import { getConfiguredAirlineScrapers, loadWebsiteScrapers, REQUIRED_AIRLINE_SCRAPERS } from './index.js'

test('default stored fare catalog is available when no snapshot cache is loaded', async () => {
  fareStore.replaceSnapshots([])

  await fareStore.load()

  assert.ok(fareStore.getSnapshots().length > 0)
  assert.ok(fareStore.search('PAT', 'BOM', '2026-09-03', 1).length > 0)
})

test('configured scrapers are loaded and the required airline subset remains available when configured', () => {
  const allScrapers = loadWebsiteScrapers()
  const airlineScrapers = getConfiguredAirlineScrapers()
  const airlineNames = [...new Set(airlineScrapers.map((scraper) => scraper.definition.airline).filter(Boolean))].sort()

  assert.ok(allScrapers.length >= 1)
  assert.ok(allScrapers.some((scraper) => scraper.definition.id === 'spicejet'))

  if (allScrapers.some((scraper) => scraper.definition.id === 'indigo')) {
    assert.ok(airlineNames.includes('IndiGo'))
  }

  if (allScrapers.some((scraper) => scraper.definition.id === 'air-india')) {
    assert.ok(airlineNames.includes('Air India'))
  }

  if (allScrapers.some((scraper) => scraper.definition.id === 'spicejet')) {
    assert.ok(airlineNames.includes('SpiceJet'))
  }

  assert.ok(airlineNames.every((name) => REQUIRED_AIRLINE_SCRAPERS.includes(name as (typeof REQUIRED_AIRLINE_SCRAPERS)[number])))
})
