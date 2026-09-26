import type { FlightOffer } from '@/types/flight'
import type { FareSnapshot } from '@/types/fare'

const ALLOWED_AIRLINES = new Set(['IndiGo', 'Air India', 'Air India Express', 'Akasa Air', 'SpiceJet', 'Alliance Air', 'Star Air'])

function normalizeAirlineName(name: string, code: string) {
  const normalizedName = name.trim().toLowerCase().replace(/[^a-z]/g, '')
  const normalizedCode = code.trim().toUpperCase()

  if (normalizedCode) {
    const airlineByCode: Record<string, string> = {
      '6E': 'IndiGo',
      AI: 'Air India',
      IX: 'Air India Express',
      QP: 'Akasa Air',
      SG: 'SpiceJet',
      '9I': 'Alliance Air',
      S5: 'Star Air',
    }
    return airlineByCode[normalizedCode] ?? ''
  }

  if (normalizedName === 'indigo' || normalizedName === 'indigoairlines') return 'IndiGo'
  if (normalizedName === 'airindiaexpress') return 'Air India Express'
  if (normalizedName === 'airindia' || normalizedName === 'airindianational') return 'Air India'
  if (normalizedName === 'akasa' || normalizedName === 'akasaair') return 'Akasa Air'
  if (normalizedName === 'spicejet' || normalizedName === 'spicejetlimited') return 'SpiceJet'
  if (normalizedName === 'allianceair' || normalizedName === 'allianceairlimited') return 'Alliance Air'
  if (normalizedName === 'starair' || normalizedName === 'starairlines') return 'Star Air'
  return ''
}

export function normalizeAllowedAirline(name: string, code: string) {
  const normalized = normalizeAirlineName(name, code)
  return ALLOWED_AIRLINES.has(normalized) ? normalized : null
}

export function filterAllowedOffers(offers: FlightOffer[]) {
  return offers.flatMap((offer) => {
    const airline = normalizeAllowedAirline(offer.airline, offer.airlineCode)
    if (!airline) return []
    return [{ ...offer, airline }]
  })
}

export function filterAllowedSnapshots(snapshots: FareSnapshot[]) {
  return snapshots.flatMap((snapshot) => {
    const airline = normalizeAllowedAirline(snapshot.airline, snapshot.airlineCode)
    if (!airline) return []
    return [{ ...snapshot, airline }]
  })
}
