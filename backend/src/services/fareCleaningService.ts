import type { FareSnapshot } from '../types/fare.js'

export type FareCleaningResult = {
  cleaned: FareSnapshot[]
  rejected: FareSnapshot[]
  duplicateRecords: number
  outlierRecords: number
  missingFieldRecords: number
}

const REQUIRED_FIELDS: Array<keyof FareSnapshot> = [
  'id',
  'routeKey',
  'origin',
  'destination',
  'departureDate',
  'collectedAt',
  'airline',
  'airlineCode',
  'flightNumber',
  'currency',
  'source',
]

function qualityScore(snapshot: FareSnapshot) {
  const checks = [
    snapshot.origin.length === 3,
    snapshot.destination.length === 3,
    snapshot.price > 0,
    snapshot.durationMinutes > 0,
    snapshot.currency.length === 3,
    Number.isFinite(new Date(snapshot.collectedAt).getTime()),
  ]
  return Math.round((checks.filter(Boolean).length / checks.length) * 100)
}

function duplicateKey(snapshot: FareSnapshot) {
  return [snapshot.routeKey, snapshot.airlineCode, snapshot.flightNumber, snapshot.departureTime, snapshot.price].join('|').toUpperCase()
}

function outlierKeys(snapshots: FareSnapshot[]) {
  const prices = snapshots.map((snapshot) => snapshot.price).sort((left, right) => left - right)
  if (prices.length < 4) return new Set<string>()
  const q1 = prices[Math.floor(prices.length * 0.25)] ?? 0
  const q3 = prices[Math.floor(prices.length * 0.75)] ?? 0
  const median = prices[Math.floor(prices.length / 2)] ?? 0
  const deviations = prices.map((price) => Math.abs(price - median)).sort((left, right) => left - right)
  const medianDeviation = deviations[Math.floor(deviations.length / 2)] ?? 0
  const iqrLimit = q3 + (q3 - q1) * 1.5
  const robustLimit = median + Math.max(1, medianDeviation * 3)
  const limit = Math.min(iqrLimit, robustLimit)
  return new Set(snapshots.filter((snapshot) => snapshot.price > limit).map((snapshot) => snapshot.id))
}

export function cleanFareSnapshots(input: FareSnapshot[]): FareCleaningResult {
  const seen = new Set<string>()
  const rejected: FareSnapshot[] = []
  const validCandidates: FareSnapshot[] = []
  let missingFieldRecords = 0
  let duplicateRecords = 0

  for (const snapshot of input) {
    const missing = REQUIRED_FIELDS.some((field) => {
      const value = snapshot[field]
      return value === undefined || value === null || value === ''
    })
    if (missing || snapshot.price <= 0 || snapshot.stops < 0 || snapshot.durationMinutes < 0) {
      missingFieldRecords += 1
      rejected.push({ ...snapshot, dataQualityScore: qualityScore(snapshot), dataQualityStatus: missing ? 'missing' : 'invalid', rejectedReason: missing ? 'Missing required field' : 'Invalid fare values' })
      continue
    }

    const key = duplicateKey(snapshot)
    if (seen.has(key)) {
      duplicateRecords += 1
      rejected.push({ ...snapshot, dataQualityScore: qualityScore(snapshot), dataQualityStatus: 'duplicate', rejectedReason: 'Duplicate fare record' })
      continue
    }
    seen.add(key)
    validCandidates.push(snapshot)
  }

  const outliers = outlierKeys(validCandidates)
  const cleaned = validCandidates.filter((snapshot) => !outliers.has(snapshot.id)).map((snapshot) => ({
    ...snapshot,
    soldOut: snapshot.soldOut ?? snapshot.seatsRemaining <= 0,
    totalFare: snapshot.totalFare ?? snapshot.price,
    dataQualityScore: qualityScore(snapshot),
    dataQualityStatus: 'valid' as const,
    rejectedReason: null,
  }))
  const outlierRecords = validCandidates.filter((snapshot) => outliers.has(snapshot.id)).length
  rejected.push(...validCandidates.filter((snapshot) => outliers.has(snapshot.id)).map((snapshot) => ({
    ...snapshot,
    dataQualityScore: qualityScore(snapshot),
    dataQualityStatus: 'outlier' as const,
    rejectedReason: 'Fare exceeds route distribution threshold',
  })))

  return { cleaned, rejected, duplicateRecords, outlierRecords, missingFieldRecords }
}