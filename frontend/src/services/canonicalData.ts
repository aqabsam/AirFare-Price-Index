import type { FlightOffer } from '@/types/flight'
import { buildApiUrl } from '@/services/apiUrl'
const API_TIMEOUT_MS = 8000
export type CanonicalDataset = {
  offers: FlightOffer[]
  summary: { liveRoutes: number; airlines: number; averageFare: number | null; lowestFare: number | null; highestFare: number | null; currentIndex: number | null; lastUpdated: string | null; source: string }
  index: { base: number | null; current: number | null; dailyChange: number | null; weeklyChange: number | null; monthlyChange: number | null; message: string }
}

export async function fetchCanonicalDataset(): Promise<CanonicalDataset> {
  const controller = new AbortController()
  const timeoutId = window.setTimeout(() => controller.abort(), API_TIMEOUT_MS)
  let response: Response
  try {
    response = await fetch(buildApiUrl('/api/data/canonical'), { signal: controller.signal })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('Canonical fare data request timed out.')
    }
    throw new Error('Unable to load canonical flight data.')
  } finally {
    window.clearTimeout(timeoutId)
  }

  if (!response.ok) throw new Error('Unable to load canonical flight data.')
  return response.json() as Promise<CanonicalDataset>
}
