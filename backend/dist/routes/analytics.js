import { calculateFareAnalytics, calculateRouteIndex } from '../services/airfareIndexService.js';
import { fareStore } from '../services/fareStore.js';
export async function analyticsRoutes(fastify) {
    fastify.get('/api/fares/snapshots', async (request) => {
        const query = request.query;
        const snapshots = fareStore.getSnapshots().filter((snapshot) => {
            if (query.origin && snapshot.origin !== query.origin.toUpperCase()) {
                return false;
            }
            if (query.destination && snapshot.destination !== query.destination.toUpperCase()) {
                return false;
            }
            if (query.departureDate && snapshot.departureDate !== query.departureDate) {
                return false;
            }
            return true;
        });
        return { snapshots };
    });
    fastify.get('/api/fares/summary', async (request) => {
        const query = request.query;
        const summary = calculateRouteIndex(query.origin, query.destination, query.departureDate);
        return { summary };
    });
    fastify.get('/api/airfare-index', async (request) => {
        const query = request.query;
        const summary = calculateRouteIndex(query.origin, query.destination, query.departureDate);
        return {
            routeCount: summary.length,
            routes: summary,
        };
    });
    fastify.get('/api/fares/analytics', async (request) => {
        const query = request.query;
        return calculateFareAnalytics(query.origin, query.destination, query.departureDate);
    });
}
