import assert from 'node:assert/strict'
import test from 'node:test'

import { getDuffelAccessToken, normalizeDuffelOffer } from '../providers/duffel.js'
import { fareStore } from './fareStore.js'
import { searchFlights } from './flightService.js'

test('searchFlights never returns demo data from the live search path', async () => {
  const originalEnv = { ...process.env }

  for (const key of Object.keys(process.env)) {
    if (key.startsWith('SCRAPER_')) {
      delete process.env[key]
    }
  }

  try {
    const offers = await searchFlights({
      origin: 'PAT',
      destination: 'BOM',
      departureDate: '2026-09-03',
      adults: 1,
    })

    assert.ok(offers.every((offer) => offer.sourceType !== 'demo' && offer.source !== 'Demo data'))
  } finally {
    process.env = originalEnv
  }
})

test('searchFlights never uses demo data for an unmatched live search', async () => {
  const originalEnv = { ...process.env }

  for (const key of Object.keys(process.env)) {
    if (key.startsWith('SCRAPER_')) {
      delete process.env[key]
    }
  }

  try {
    const offers = await searchFlights({
      origin: 'PAT',
      destination: 'BOM',
      departureDate: '2026-09-30',
      adults: 2,
    })

    assert.ok(offers.every((offer) => offer.sourceType !== 'demo' && offer.source !== 'Demo data'))
  } finally {
    process.env = originalEnv
  }
})

test('Duffel normalization rejects provider brands and keeps real airline data only', () => {
  assert.equal(
    normalizeDuffelOffer(
      {
        id: 'offer-1',
        total_amount: '2450',
        total_currency: 'INR',
        total_duration: 'PT1H30M',
        slices: [{
          origin: { iata_code: 'PAT' },
          destination: { iata_code: 'BOM' },
          segments: [{
            operating_carrier: { name: 'Duffel Airways', iata_code: 'ZZ' },
            marketing_carrier: { name: 'Duffel Airways', iata_code: 'ZZ' },
            operating_carrier_flight_number: '9',
            departing_at: '2026-09-30T06:00:00+05:30',
            arriving_at: '2026-09-30T07:30:00+05:30',
          }],
        }],
      },
      { origin: 'PAT', destination: 'BOM', departureDate: '2026-09-30', adults: 1 },
    ),
    null,
  )

  const realOffer = normalizeDuffelOffer(
    {
      id: 'offer-2',
      total_amount: '4320',
      total_currency: 'INR',
      total_duration: 'PT2H15M',
      slices: [{
        origin: { iata_code: 'PAT' },
        destination: { iata_code: 'BOM' },
        segments: [{
          operating_carrier: { name: 'IndiGo', iata_code: '6E' },
          marketing_carrier: { name: 'IndiGo', iata_code: '6E' },
          operating_carrier_flight_number: '2124',
          departing_at: '2026-09-30T08:00:00+05:30',
          arriving_at: '2026-09-30T10:15:00+05:30',
        }],
      }],
    },
    { origin: 'PAT', destination: 'BOM', departureDate: '2026-09-30', adults: 1 },
  )

  assert.ok(realOffer)
  assert.equal(realOffer?.airline, 'IndiGo')
  assert.equal(realOffer?.airlineCode, '6E')
  assert.equal(realOffer?.flightNumber, '6E2124')
  assert.equal(realOffer?.sourceType, 'duffel')
})

test('manual reference data is exact-route/date only and clearly labeled', () => {
  const originalSnapshots = fareStore.getSnapshots()

  fareStore.replaceSnapshots([
    {
      id: 'manual-route-1',
      routeKey: 'DEL-BOM-2026-09-30',
      origin: 'DEL',
      destination: 'BOM',
      departureDate: '2026-09-30',
      collectedAt: '2026-09-29T08:00:00+05:30',
      airline: 'Air India',
      airlineCode: 'AI',
      flightNumber: 'AI 101',
      departureTime: '08:30',
      arrivalTime: '10:45',
      durationMinutes: 135,
      stops: 0,
      price: 5400,
      currency: 'INR',
      seatsRemaining: 4,
      source: 'User-provided fare reference',
      sourceType: 'aggregated',
      confidence: 1,
    },
  ])

  try {
    const manualOffers = fareStore.search('DEL', 'BOM', '2026-09-30', 1)
    assert.equal(manualOffers.length, 1)
    assert.equal(manualOffers[0]?.airline, 'Air India')
    assert.equal(manualOffers[0]?.flightNumber, 'AI 101')
    assert.equal(manualOffers[0]?.source, 'Manual/Reference Data')
    assert.equal(fareStore.search('DEL', 'BOM', '2026-09-29', 1).length, 0)
  } finally {
    fareStore.replaceSnapshots(originalSnapshots)
  }
})

test('Duffel token resolution accepts the access token environment name without exposing secrets', () => {
  const originalAccessToken = process.env.DUFFEL_ACCESS_TOKEN
  const originalApiKey = process.env.DUFFEL_API_KEY

  try {
    delete process.env.DUFFEL_ACCESS_TOKEN
    process.env.DUFFEL_API_KEY = 'secret-api-key'
    assert.equal(getDuffelAccessToken(), 'secret-api-key')

    delete process.env.DUFFEL_API_KEY
    process.env.DUFFEL_ACCESS_TOKEN = 'secret-access-token'
    assert.equal(getDuffelAccessToken(), 'secret-access-token')
  } finally {
    if (originalAccessToken === undefined) delete process.env.DUFFEL_ACCESS_TOKEN
    else process.env.DUFFEL_ACCESS_TOKEN = originalAccessToken

    if (originalApiKey === undefined) delete process.env.DUFFEL_API_KEY
    else process.env.DUFFEL_API_KEY = originalApiKey
  }
})
