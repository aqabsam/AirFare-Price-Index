import { loadWebsiteScrapers } from '../scrapers/index.js'
import { fareStore } from './fareStore.js'
import type { FareSourceHealth, FareSourceHealthResponse } from '../types/fare.js'

const STALE_AFTER_MS = 12 * 60 * 60 * 1000

function normalizeKey(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '')
}

function sourceIdentityCandidates(source: { id?: string; name: string }) {
  return [source.id, source.name].filter((value): value is string => Boolean(value)).map(normalizeKey)
}

function snapshotIdentityCandidates(snapshot: { sourceId?: string; source: string }) {
  return [snapshot.sourceId, snapshot.source].filter((value): value is string => Boolean(value)).map(normalizeKey)
}

function latestSnapshotTimestamp(values: Array<{ collectedAt: string }>) {
  const newest = values.reduce((latest, current) => {
    if (!latest) {
      return current.collectedAt
    }

    return current.collectedAt > latest ? current.collectedAt : latest
  }, '')

  return newest || null
}

function deriveStatus(lastCollectedAt: string | null): FareSourceHealth['status'] {
  if (!lastCollectedAt) {
    return 'empty'
  }

  const age = Date.now() - new Date(lastCollectedAt).getTime()
  if (Number.isFinite(age) && age > STALE_AFTER_MS) {
    return 'stale'
  }

  return 'live'
}

export async function calculateFareSourceHealth(): Promise<FareSourceHealthResponse> {
  const configs = loadWebsiteScrapers().map((scraper) => scraper.definition)
  const snapshots = fareStore.getSnapshots()

  const sources: FareSourceHealth[] = configs.map((source) => {
    const sourceKeys = sourceIdentityCandidates(source)
    const matchingSnapshots = snapshots.filter((snapshot) => {
      const snapshotKeys = snapshotIdentityCandidates(snapshot)
      return sourceKeys.some((key) => snapshotKeys.includes(key))
    })

    const lastCollectedAt = latestSnapshotTimestamp(matchingSnapshots)

    return {
      id: source.id,
      name: source.name,
      sourceType: source.sourceType,
      kind: 'page',
      url: source.url ?? '',
      routeCount: 0,
      bookingWindows: [],
      snapshotCount: matchingSnapshots.length,
      lastCollectedAt,
      status: deriveStatus(lastCollectedAt),
    }
  })

  const liveCount = sources.filter((source) => source.status === 'live').length
  const staleCount = sources.filter((source) => source.status === 'stale').length
  const emptyCount = sources.filter((source) => source.status === 'empty').length

  return {
    sources,
    liveCount,
    staleCount,
    emptyCount,
  }
}
