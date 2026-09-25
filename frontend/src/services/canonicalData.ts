import type { FlightOffer } from '@/types/flight'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL?.trim().replace(/\/$/, '') ?? ''
export type CanonicalDataset = {
  offers: FlightOffer[]
  summary: { liveRoutes: number; airlines: number; averageFare: number | null; lowestFare: number | null; highestFare: number | null; currentIndex: number | null; lastUpdated: string | null; source: string }
  index: { base: number | null; current: number | null; dailyChange: number | null; weeklyChange: number | null; monthlyChange: number | null; message: string }
}

export async function fetchCanonicalDataset(): Promise<CanonicalDataset> {
  const response = await fetch(`${API_BASE_URL}/api/data/canonical`)
  if (!response.ok) throw new Error('Unable to load canonical flight data.')
  return response.json() as Promise<CanonicalDataset>
}
