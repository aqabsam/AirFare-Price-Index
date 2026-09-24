import type { FastifyInstance } from 'fastify'
import { collectAndStoreFareSnapshots, getFareCollectionStatus } from '../services/fareCollectionService.js'
import { calculateFareSourceHealth } from '../services/fareSourceHealthService.js'
import { fareStore } from '../services/fareStore.js'
import { getCollectionLogs } from '../services/collectionLogService.js'

export async function adminRoutes(fastify: FastifyInstance) {
  fastify.get('/api/admin/fare-collection/status', async () => {
    const status = getFareCollectionStatus()
    return {
      status,
      snapshotCount: fareStore.getSnapshots().length,
      routes: fareStore.getSummaries().length,
    }
  })

  fastify.post('/api/admin/fare-collection/run', async (request, reply) => {
    try {
      await collectAndStoreFareSnapshots('manual')
      return reply.send({
        ok: true,
        status: getFareCollectionStatus(),
      })
    } catch (error) {
      request.log.error({ error }, 'Manual fare collection failed')
      return reply.status(500).send({
        ok: false,
        status: getFareCollectionStatus(),
        error: error instanceof Error ? error.message : 'Unable to collect fares right now',
      })
    }
  })

  fastify.get('/api/admin/fare-collection/snapshots', async () => {
    return {
      snapshots: fareStore.getSnapshots(),
    }
  })

  fastify.get('/api/admin/fare-collection/logs', async () => ({ logs: getCollectionLogs() }))

  fastify.get('/api/admin/fare-sources/status', async () => {
    return calculateFareSourceHealth()
  })
}
