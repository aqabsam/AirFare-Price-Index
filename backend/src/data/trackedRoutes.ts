export type TrackedRoute = {
  origin: string
  destination: string
  departureDate?: string
  bookingWindowDays?: number
  collectionDate?: string
}

function parseTrackedRoutes(value: string | undefined): TrackedRoute[] {
  if (!value?.trim()) {
    return []
  }

  try {
    const parsed = JSON.parse(value) as unknown
    if (!Array.isArray(parsed)) {
      return []
    }

    return parsed.flatMap((entry) => {
      if (!entry || typeof entry !== 'object') {
        return []
      }

      const candidate = entry as Record<string, unknown>
      const origin = typeof candidate.origin === 'string' ? candidate.origin.trim().toUpperCase() : ''
      const destination = typeof candidate.destination === 'string' ? candidate.destination.trim().toUpperCase() : ''
      const departureDate = typeof candidate.departureDate === 'string' ? candidate.departureDate.trim() : undefined
      const bookingWindowDays =
        typeof candidate.bookingWindowDays === 'number' && Number.isFinite(candidate.bookingWindowDays)
          ? Math.max(0, Math.round(candidate.bookingWindowDays))
          : undefined
      const collectionDate = typeof candidate.collectionDate === 'string' ? candidate.collectionDate.trim() : undefined

      if (!origin || !destination) {
        return []
      }

      return [{ origin, destination, departureDate, bookingWindowDays, collectionDate }]
    })
  } catch {
    return []
  }
}

const DEFAULT_TRACKED_ROUTES: TrackedRoute[] = [
  { origin: 'PAT', destination: 'BOM' },
  { origin: 'DEL', destination: 'BLR' },
  { origin: 'CCU', destination: 'PNQ' },
  { origin: 'HYD', destination: 'COK' },
  { origin: 'BOM', destination: 'DEL' },
  { origin: 'MAA', destination: 'DEL' },
]

export function loadTrackedRoutes() {
  const parsed = parseTrackedRoutes(process.env.FARE_TRACKED_ROUTES)
  return parsed.length ? parsed : DEFAULT_TRACKED_ROUTES
}
