import { collectFareSnapshots } from './fareCollector.js'
import { fareStore } from './fareStore.js'
import { cleanFareSnapshots } from './fareCleaningService.js'
import { finishCollectionLog, startCollectionLog } from './collectionLogService.js'
import { calculateFareAnalytics } from './airfareIndexService.js'
import type { IndexSnapshotRecord } from './fareStore.js'

export type FareCollectionStatus = {
  status: 'idle' | 'running' | 'success' | 'error'
  trigger: 'startup' | 'scheduled' | 'manual'
  startedAt: string | null
  finishedAt: string | null
  sourceCount: number
  snapshotCount: number
  message: string | null
}

const currentState: FareCollectionStatus = {
  status: 'idle',
  trigger: 'startup',
  startedAt: null,
  finishedAt: null,
  sourceCount: fareStore.getSnapshots().length,
  snapshotCount: fareStore.getSnapshots().length,
  message: null,
}

let activeRun: Promise<void> | null = null

function updateState(next: Partial<FareCollectionStatus>) {
  Object.assign(currentState, next)
}

export function getFareCollectionStatus() {
  return { ...currentState }
}

export async function collectAndStoreFareSnapshots(trigger: FareCollectionStatus['trigger']) {
  if (activeRun) {
    return activeRun
  }

  const startedAt = new Date().toISOString()
  updateState({
    status: 'running',
    trigger,
    startedAt,
    finishedAt: null,
    message: null,
  })

  activeRun = (async () => {
    const log = startCollectionLog(trigger, 'SCRAPER -> DUFFEL -> DEMO')
    try {
      const snapshots = await collectFareSnapshots()
      if (!snapshots.length) {
        throw new Error('No live fares were collected. Configure real airline or OTA sources before running the pipeline.')
      }

      const cleaning = cleanFareSnapshots(snapshots)
      fareStore.replaceSnapshots(cleaning.cleaned, cleaning.rejected, snapshots)
      const analytics = calculateFareAnalytics()
      const calculatedAt = new Date().toISOString()
      const indexSnapshots: IndexSnapshotRecord[] = [
        ...analytics.summary.map((summary) => ({
          routeKey: summary.routeKey,
          departureDate: summary.departureDate,
          cheapestPrice: summary.cheapestPrice,
          averagePrice: summary.averagePrice,
          medianPrice: summary.medianPrice,
          airfareIndex: summary.airfareIndex ?? 0,
          calculatedAt,
        })),
        ...analytics.dailyIndex.map((point) => ({
          routeKey: 'MARKET',
          departureDate: point.collectionDate,
          cheapestPrice: point.cheapestPrice,
          averagePrice: point.averagePrice,
          medianPrice: point.averagePrice,
          airfareIndex: point.airfareIndex ?? 0,
          calculatedAt,
        })),
      ]
      await fareStore.persist(indexSnapshots)
      finishCollectionLog(log, { status: 'success', records: cleaning.cleaned.length, message: `Collected ${snapshots.length}; accepted ${cleaning.cleaned.length}; rejected ${cleaning.rejected.length}` })
      updateState({
        status: 'success',
        finishedAt: new Date().toISOString(),
        sourceCount: new Set(snapshots.map((snapshot) => snapshot.source)).size,
        snapshotCount: cleaning.cleaned.length,
        message: `Collected ${snapshots.length} fare snapshots; accepted ${cleaning.cleaned.length}`,
      })
    } catch (error) {
      finishCollectionLog(log, { status: 'error', records: 0, message: error instanceof Error ? error.message : 'Unable to collect fare snapshots' })
      updateState({
        status: 'error',
        finishedAt: new Date().toISOString(),
        message: error instanceof Error ? error.message : 'Unable to collect fare snapshots',
      })
      throw error
    } finally {
      activeRun = null
    }
  })()

  return activeRun
}
