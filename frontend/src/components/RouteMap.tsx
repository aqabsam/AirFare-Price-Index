import { useEffect } from 'react'
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from 'react-leaflet'
import L from 'leaflet'
import { MapPinned, PlaneTakeoff } from 'lucide-react'
import 'leaflet/dist/leaflet.css'
import indiaAirports from '@/data/india-airports.json'

type RouteMapProps = {
  origin: string
  destination: string
  theme: 'dark' | 'light'
  routeLabel?: string
  airline?: string
  flightNumber?: string
  fare?: string
  travelDate?: string
  searchedAt?: string
}

type Airport = {
  iata: string
  name: string
  city: string
  lat: number
  lng: number
}

type RouteDetails = Omit<RouteMapProps, 'theme'>

const AIRPORTS = indiaAirports as Airport[]
const AIRPORT_LOOKUP = new Map(AIRPORTS.map((airport) => [airport.iata.toUpperCase(), airport]))

function resolveAirport(input: string) {
  const code = input.trim().toUpperCase()
  if (!/^[A-Z]{3}$/.test(code)) return null
  const airport = AIRPORT_LOOKUP.get(code)
  if (!airport || !Number.isFinite(airport.lat) || !Number.isFinite(airport.lng) || Math.abs(airport.lat) > 90 || Math.abs(airport.lng) > 180) {
    return null
  }
  return airport
}

function airportIcon(kind: 'origin' | 'destination') {
  return L.divIcon({
    className: 'airport-map-icon',
    html: `<span class="airport-map-pin airport-map-pin-${kind}"><span class="airport-map-pin-dot"></span></span>`,
    iconSize: [28, 36],
    iconAnchor: [14, 34],
  })
}

const PLANE_ICON = L.divIcon({
  className: 'route-plane-icon',
  html: '<span aria-hidden="true">✈</span>',
  iconSize: [30, 30],
  iconAnchor: [15, 15],
})

function RouteViewport({ airports }: { airports: Airport[] }) {
  const map = useMap()

  useEffect(() => {
    if (airports.length !== 2) return
    const resizeMap = () => map.invalidateSize({ pan: false })
    const bounds = L.latLngBounds(airports.map((airport) => [airport.lat, airport.lng] as L.LatLngTuple))
    resizeMap()
    map.fitBounds(bounds, { padding: [56, 56], maxZoom: 7, animate: true, duration: 0.8 })
    const observer = new ResizeObserver(resizeMap)
    observer.observe(map.getContainer())
    return () => observer.disconnect()
  }, [airports, map])

  return null
}

function RoutePlane({ origin, destination, route }: { origin: Airport; destination: Airport; route: RouteDetails }) {
  const position: L.LatLngExpression = [
    (origin.lat + destination.lat) / 2,
    (origin.lng + destination.lng) / 2,
  ]

  return (
    <Marker position={position} icon={PLANE_ICON}>
      <Popup>
        <strong>{route.routeLabel ?? `${origin.iata} → ${destination.iata}`}</strong>
        {route.travelDate ? <><br />Departure date: {route.travelDate}</> : null}
        {route.airline ? <><br />Airline: {route.airline}</> : null}
        {route.flightNumber ? <><br />Flight: {route.flightNumber}</> : null}
        {route.fare ? <><br />Verified total fare: {route.fare}</> : null}
        {route.searchedAt ? <><br />Searched: {route.searchedAt}</> : null}
      </Popup>
    </Marker>
  )
}

export function RouteMap({ origin, destination, theme, routeLabel, airline, flightNumber, fare, travelDate, searchedAt }: RouteMapProps) {
  const from = resolveAirport(origin)
  const to = resolveAirport(destination)
  const hasRoute = Boolean(from && to)
  const lineColor = theme === 'dark' ? '#67e8f9' : '#0f766e'
  const routeKey = `${origin.trim().toUpperCase()}-${destination.trim().toUpperCase()}`
  const routeDetails: RouteDetails = { origin, destination, routeLabel, airline, flightNumber, fare, travelDate, searchedAt }
  const routeAirports = from && to ? [from, to] : []

  return (
    <div className={`overflow-hidden rounded-[28px] border ${theme === 'dark' ? 'border-white/10 bg-[#172235]' : 'border-slate-200 bg-[#dce8ec]'}`}>
      <div className="flex items-center justify-between gap-3 bg-white/80 px-5 py-4 backdrop-blur dark:bg-slate-950/65">
        <div>
          <p className={`text-xs font-semibold uppercase tracking-[0.2em] ${theme === 'dark' ? 'text-cyan-200' : 'text-teal-700'}`}>Live route map</p>
          <p className={`mt-1 text-sm ${theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>
            {routeLabel ?? `${origin} → ${destination}`}
          </p>
        </div>
        <MapPinned size={20} className={theme === 'dark' ? 'text-cyan-200' : 'text-teal-700'} />
      </div>

      {hasRoute && from && to ? (
        <div className="route-map-canvas">
          <MapContainer
            key={routeKey}
            center={[from.lat, from.lng]}
            zoom={4}
            minZoom={2}
            maxZoom={18}
            scrollWheelZoom
            zoomControl
            className="h-full min-h-[420px] w-full"
            aria-label={`Map showing ${from.iata} to ${to.iata}`}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <RouteViewport airports={routeAirports} />
            <Polyline positions={[[from.lat, from.lng], [to.lat, to.lng]]} pathOptions={{ color: lineColor, weight: 4, opacity: 0.9, dashArray: '10 10' }} />
            <Marker position={[from.lat, from.lng]} icon={airportIcon('origin')}>
              <Popup><strong>{from.iata}</strong><br />{from.name}</Popup>
            </Marker>
            <Marker position={[to.lat, to.lng]} icon={airportIcon('destination')}>
              <Popup><strong>{to.iata}</strong><br />{to.name}</Popup>
            </Marker>
            <RoutePlane origin={from} destination={to} route={routeDetails} />
          </MapContainer>

          <div className="pointer-events-none absolute bottom-4 left-4 z-[1000] flex items-center gap-2 rounded-full border border-white/30 bg-slate-950/80 px-3 py-2 text-xs font-semibold text-white shadow-lg backdrop-blur">
            <PlaneTakeoff size={14} className="text-amber-300" />
            {from.iata} → {to.iata}
          </div>
        </div>
      ) : (
        <div role="status" className={`border-t px-5 py-8 text-sm font-semibold ${theme === 'dark' ? 'border-white/10 text-amber-200' : 'border-slate-200 text-amber-800'}`}>
          Route map unavailable for this airport
        </div>
      )}

      {(airline || fare) ? (
        <div className={`border-t px-5 py-4 ${theme === 'dark' ? 'border-white/10 bg-slate-950/40 text-slate-200' : 'border-slate-200 bg-white/80 text-slate-800'}`}>
          {airline ? <div className="text-sm font-semibold">{airline}</div> : null}
          {fare ? <div className="mt-1 text-sm text-teal-600 dark:text-teal-300">{fare}</div> : null}
        </div>
      ) : null}
    </div>
  )
}
