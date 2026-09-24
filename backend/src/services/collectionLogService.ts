export type CollectionLog = {
  id: string
  startedAt: string
  finishedAt: string | null
  trigger: 'startup' | 'scheduled' | 'manual'
  status: 'running' | 'success' | 'error'
  source: string
  records: number
  message: string | null
}

const logs: CollectionLog[] = []

export function startCollectionLog(trigger: CollectionLog['trigger'], source: string) {
  const log: CollectionLog = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    startedAt: new Date().toISOString(),
    finishedAt: null,
    trigger,
    status: 'running',
    source,
    records: 0,
    message: null,
  }
  logs.unshift(log)
  logs.splice(20)
  return log
}

export function finishCollectionLog(log: CollectionLog, result: Pick<CollectionLog, 'status' | 'records' | 'message'>) {
  Object.assign(log, { ...result, finishedAt: new Date().toISOString() })
}

export function getCollectionLogs() {
  return logs.map((log) => ({ ...log }))
}