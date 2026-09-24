import 'dotenv/config'
import net from 'node:net'
import fastify from 'fastify'
import cors from '@fastify/cors'
import { adminRoutes } from './routes/admin.js'
import { analyticsRoutes } from './routes/analytics.js'
import { flightsRoutes } from './routes/flights.js'
import { fareStore } from './services/fareStore.js'
import { startFareRefreshScheduler } from './jobs/fareRefresh.js'

const app = fastify({
  logger: true,
})

const port = Number(process.env.PORT ?? '3000')
const host = process.env.HOST ?? '0.0.0.0'

async function isPortInUse(portNumber: number, hostName: string) {
  return await new Promise<boolean>((resolve) => {
    const tester = net.createServer()
    tester.once('error', (error: NodeJS.ErrnoException) => {
      resolve(error.code === 'EADDRINUSE')
    })
    tester.once('listening', () => {
      tester.close(() => resolve(false))
    })
    tester.listen(portNumber, hostName)
  })
}

if (await isPortInUse(port, host)) {
  console.warn(`[backend] Port ${port} is already in use on ${host}. Refusing to start a duplicate backend process.`)
  process.exit(0)
}

await app.register(cors, {
  origin: [/^http:\/\/localhost:\d+$/, /^http:\/\/127\.0\.0\.1:\d+$/, /^http:\/\/0\.0\.0\.0:\d+$/],
  methods: ['GET', 'POST', 'OPTIONS'],
  credentials: false,
  allowedHeaders: ['Content-Type', 'Authorization'],
})

await fareStore.load()
startFareRefreshScheduler()

await app.register(flightsRoutes)
await app.register(analyticsRoutes)
await app.register(adminRoutes)

app.get('/', async () => {
  return {
    ok: true,
    service: 'AirFare Price Index API',
    health: '/health',
  }
})

app.get('/health', async () => {
  return {
    ok: true,
  }
})

try {
  await app.listen({ port, host })
} catch (error) {
  app.log.error(error)
  process.exit(1)
}
