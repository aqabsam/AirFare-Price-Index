import cron from 'node-cron'
import { collectAndStoreFareSnapshots } from '../services/fareCollectionService.js'

export function startFareRefreshScheduler() {
  if (process.env.FARE_REFRESH_ON_STARTUP?.trim().toLowerCase() === 'true') {
    const initialRun = async () => {
      try {
        await collectAndStoreFareSnapshots('startup')
      } catch (error) {
        console.warn('Initial fare collection failed, continuing with stored data', error)
      }
    }

    void initialRun()
  }

  const cronExpression = process.env.FARE_REFRESH_CRON?.trim() || '0 */4 * * *'
  const task = cron.schedule(cronExpression, async () => {
    try {
      await collectAndStoreFareSnapshots('scheduled')
    } catch (error) {
      console.warn('Scheduled fare collection failed', error)
    }
  })

  task.start()
  return task
}
