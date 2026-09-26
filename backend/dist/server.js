import 'dotenv/config';
import net from 'node:net';
import fastify from 'fastify';
import cors from '@fastify/cors';
import { adminRoutes } from './routes/admin.js';
import { analyticsRoutes } from './routes/analytics.js';
import { flightsRoutes } from './routes/flights.js';
import { fareStore } from './services/fareStore.js';
import { startFareRefreshScheduler } from './jobs/fareRefresh.js';
import { getDuffelAccessToken } from './providers/duffel.js';
const app = fastify({
    logger: true,
});
const port = Number(process.env.PORT ?? '3000');
const host = process.env.HOST ?? '0.0.0.0';
const allowedOrigins = (process.env.CORS_ORIGINS ?? 'https://airfare-price.web.app,https://airfare-price.firebaseapp.com,http://localhost:5173,http://localhost:4173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
console.info(`[Duffel] API key configured: ${Boolean(getDuffelAccessToken())}; base URL: ${(process.env.DUFFEL_API_BASE_URL?.trim() || 'https://api.duffel.com').replace(/\/$/, '')}`);
async function isPortInUse(portNumber, hostName) {
    return await new Promise((resolve) => {
        const tester = net.createServer();
        tester.once('error', (error) => {
            resolve(error.code === 'EADDRINUSE');
        });
        tester.once('listening', () => {
            tester.close(() => resolve(false));
        });
        tester.listen(portNumber, hostName);
    });
}
if (await isPortInUse(port, host)) {
    console.warn(`[backend] Port ${port} is already in use on ${host}. Refusing to start a duplicate backend process.`);
    process.exit(0);
}
await app.register(cors, {
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'OPTIONS'],
    credentials: false,
    allowedHeaders: ['Content-Type', 'Authorization'],
});
await fareStore.load();
startFareRefreshScheduler();
await app.register(flightsRoutes);
await app.register(analyticsRoutes);
await app.register(adminRoutes);
app.get('/', async () => {
    return {
        ok: true,
        service: 'AirFare Price Index API',
        health: '/health',
    };
});
app.get('/health', async () => {
    return {
        ok: true,
    };
});
try {
    await app.listen({ port, host });
}
catch (error) {
    app.log.error(error);
    process.exit(1);
}
