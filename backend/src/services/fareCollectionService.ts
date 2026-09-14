import { collectFareSnapshots } from './fareCollector.js'
import { fareStore } from './fareStore.js'

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
    try {
      const snapshots = await collectFareSnapshots()
      if (!snapshots.length) {
        throw new Error('No live fares were collected. Configure real airline or OTA sources before running the pipeline.')
      }

      fareStore.replaceSnapshots(snapshots)
      await fareStore.persist()
      updateState({
        status: 'success',
        finishedAt: new Date().toISOString(),
        sourceCount: new Set(snapshots.map((snapshot) => snapshot.source)).size,
        snapshotCount: snapshots.length,
        message: `Collected ${snapshots.length} fare snapshots`,
      })
    } catch (error) {
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
