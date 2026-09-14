type AirlineBrand = {
  airline: string
  code: string
  logoUrl: string
  bookingUrl: (originCity: string, destinationCity: string, travelDate: string) => string
}

function slugifyRouteSegment(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

const favicon = (domain: string) => `https://www.google.com/s2/favicons?domain=${domain}&sz=128`

export const airlineDirectory: Record<string, AirlineBrand> = {
  IndiGo: {
    airline: 'IndiGo',
    code: '6E',
    logoUrl: favicon('goindigo.in'),
    bookingUrl: (originCity, destinationCity) =>
      `https://www.goindigo.in/domestic-flights/${slugifyRouteSegment(originCity)}-to-${slugifyRouteSegment(destinationCity)}-flights.html`,
  },
  'Air India': {
    airline: 'Air India',
    code: 'AI',
    logoUrl: favicon('airindia.com'),
    bookingUrl: (originCity, destinationCity) =>
      `https://www.airindia.com/en/book-flights/${slugifyRouteSegment(originCity)}-to-${slugifyRouteSegment(destinationCity)}-flights`,
  },
  'Air India Express': {
    airline: 'Air India Express',
    code: 'IX',
    logoUrl: favicon('airindiaexpress.com'),
    bookingUrl: (originCity, destinationCity) =>
      `https://flights.airindiaexpress.com/en-in/${slugifyRouteSegment(originCity)}-to-${slugifyRouteSegment(destinationCity)}-flights`,
  },
  'Akasa Air': {
    airline: 'Akasa Air',
    code: 'QP',
    logoUrl: 'https://images.seeklogo.com/logo-png/43/1/akasa-air-logo-png_seeklogo-431797.png',
    bookingUrl: (originCity, destinationCity, travelDate) =>
      `https://www.akasaair.com/flight-booking/${slugifyRouteSegment(originCity)}-to-${slugifyRouteSegment(destinationCity)}?date=${encodeURIComponent(travelDate)}`,
  },
  SpiceJet: {
    airline: 'SpiceJet',
    code: 'SG',
    logoUrl: favicon('spicejet.com'),
    bookingUrl: (originCity, destinationCity, travelDate) =>
      `https://book.spicejet.com/?origin=${encodeURIComponent(originCity)}&destination=${encodeURIComponent(destinationCity)}&date=${encodeURIComponent(travelDate)}`,
  },
}

export function getAirlineBrand(airline: string) {
  return airlineDirectory[airline]
}

export function getAirlineBrandByCode(code: string) {
  const normalizedCode = code.trim().toUpperCase()
  return Object.values(airlineDirectory).find((brand) => brand.code === normalizedCode)
}
