import assert from 'node:assert/strict'
import test from 'node:test'
import { calculateRouteIndex } from './airfareIndexService.js'
import { fareStore } from './fareStore.js'
import type { FareSnapshot } from '../types/fare.js'

function record(id: string, sourceType: FareSnapshot['sourceType'], price: number): FareSnapshot {
  return {
    id,
    routeKey: 'PAT-BOM-2026-10-01',
    origin: 'PAT',
    destination: 'BOM',
    departureDate: '2026-10-01',
    collectionDate: '2026-09-01',
    collectedAt: '2026-09-01T00:00:00.000Z',
    airline: 'IndiGo',
    airlineCode: '6E',
    flightNumber: id,
    departureTime: '10:00',
    arrivalTime: '12:00',
    durationMinutes: 120,
    stops: 0,
    price,
    currency: 'INR',
    seatsRemaining: 2,
    source: sourceType,
    sourceType,
    confidence: 1,
  }
}

test('official route index excludes demo records', () => {
  fareStore.replaceSnapshots([record('demo', 'demo', 1000), record('duffel', 'duffel', 5000)])
  const routes = calculateRouteIndex()
  assert.equal(routes.length, 1)
  assert.equal(routes[0]?.cheapestPrice, 5000)
  assert.equal(routes[0]?.airfareIndex, 100)
})