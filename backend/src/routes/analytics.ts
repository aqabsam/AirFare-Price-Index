import type { FastifyInstance } from 'fastify'
import { calculateFareAnalytics, calculateRouteIndex } from '../services/airfareIndexService.js'
import { calculateDgcaBacktest } from '../services/dgcaBacktestService.js'
import { calculateDataQuality } from '../services/dataQualityService.js'
import { fareStore } from '../services/fareStore.js'
import { getCollectionLogs } from '../services/collectionLogService.js'
import { getFareCollectionStatus } from '../services/fareCollectionService.js'

export async function analyticsRoutes(fastify: FastifyInstance) {
  const readFilters = (request: { query: unknown }) => request.query as Record<string, string | undefined>

  fastify.get('/api/fares', async (request) => {
    const query = readFilters(request)
    return { snapshots: fareStore.getSnapshots().filter((snapshot) => (!query.origin || snapshot.origin === query.origin.toUpperCase()) && (!query.destination || snapshot.destination === query.destination.toUpperCase()) && (!query.departureDate || snapshot.departureDate === query.departureDate)) }
  })

  fastify.get('/api/fares/snapshots', async (request) => {
    const query = request.query as Record<string, string | undefined>
    const snapshots = fareStore.getSnapshots().filter((snapshot) => {
      if (query.origin && snapshot.origin !== query.origin.toUpperCase()) {
        return false
      }

      if (query.destination && snapshot.destination !== query.destination.toUpperCase()) {
        return false
      }

      if (query.departureDate && snapshot.departureDate !== query.departureDate) {
        return false
      }

      return true
    })

    return { snapshots }
  })

  fastify.get('/api/fares/routes', async (request) => {
    const query = readFilters(request)
    return { routes: calculateRouteIndex(query.origin, query.destination, query.departureDate) }
  })

  fastify.get('/api/fares/summary', async (request) => {
    const query = request.query as Record<string, string | undefined>
    const summary = calculateRouteIndex(query.origin, query.destination, query.departureDate)
    return { summary }
  })

  fastify.get('/api/airfare-index', async (request) => {
    const query = request.query as Record<string, string | undefined>
    const summary = calculateRouteIndex(query.origin, query.destination, query.departureDate)
    return {
      routeCount: summary.length,
      routes: summary,
    }
  })

  fastify.get('/api/fares/analytics', async (request) => {
    const query = request.query as Record<string, string | undefined>
    return calculateFareAnalytics(query.origin, query.destination, query.departureDate)
  })

  fastify.get('/api/index/daily', async (request) => ({ dailyIndex: calculateFareAnalytics(readFilters(request).origin, readFilters(request).destination, readFilters(request).departureDate).dailyIndex }))
  fastify.get('/api/index/weekly', async (request) => ({ weeklyIndex: calculateFareAnalytics(readFilters(request).origin, readFilters(request).destination, readFilters(request).departureDate).weeklyIndex }))
  fastify.get('/api/index/monthly', async (request) => ({ monthlyIndex: calculateFareAnalytics(readFilters(request).origin, readFilters(request).destination, readFilters(request).departureDate).monthlyIndex }))
  fastify.get('/api/index', async (request) => {
    const query = readFilters(request)
    return calculateFareAnalytics(query.origin, query.destination, query.departureDate)
  })

  fastify.get('/api/index/history', async () => ({ history: fareStore.getIndexHistory() }))

  fastify.get('/api/fares/dgca-backtest', async (request) => {
    const query = request.query as Record<string, string | undefined>
    const windowDays = Number(query.windowDays ?? '30')
    return calculateDgcaBacktest(Number.isFinite(windowDays) ? Math.max(1, Math.round(windowDays)) : 30)
  })

  fastify.get('/api/fares/data-quality', async () => calculateDataQuality())

  fastify.get('/api/fares/explorer', async () => ({
    raw: fareStore.getRawSnapshots(),
    cleaned: fareStore.getSnapshots(),
    rejected: fareStore.getRejectedSnapshots(),
    indexHistory: fareStore.getIndexHistory(),
    collectionStatus: getFareCollectionStatus(),
    collectionLogs: getCollectionLogs(),
  }))

  fastify.get('/api/collection/status', async () => ({ status: getFareCollectionStatus(), logs: getCollectionLogs() }))
}
