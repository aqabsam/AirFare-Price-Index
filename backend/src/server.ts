import 'dotenv/config'
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

await app.register(cors, {
  origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
  methods: ['GET', 'POST', 'OPTIONS'],
})

await fareStore.load()
startFareRefreshScheduler()

await app.register(flightsRoutes)
await app.register(analyticsRoutes)
await app.register(adminRoutes)

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
