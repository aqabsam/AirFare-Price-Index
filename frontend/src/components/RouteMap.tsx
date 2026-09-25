import { useEffect, useMemo, useState } from 'react'
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from 'react-leaflet'
import L from 'leaflet'
import { MapPinned, PlaneTakeoff } from 'lucide-react'
import 'leaflet/dist/leaflet.css'
import indiaAirports from '@/data/india-airports.json'
import { findAirport } from '@/data/airports'

type RouteMapProps = {
  origin: string
  destination: string
  theme: 'dark' | 'light'
  routeLabel?: string
  airline?: string
  fare?: string
}

type Airport = {
  iata: string
  name: string
  city: string
  lat: number
  lng: number
}

const AIRPORTS = indiaAirports as Airport[]
const AIRPORT_LOOKUP = new Map(AIRPORTS.map((airport) => [airport.iata.toUpperCase(), airport]))
const INDIA_CENTER: L.LatLngExpression = [22.5, 79]

function resolveAirport(input: string) {
  const knownAirport = findAirport(input)
  const code = knownAirport?.code ?? input.trim().toUpperCase().match(/\b[A-Z]{3}\b/)?.[0]
  return code ? AIRPORT_LOOKUP.get(code.toUpperCase()) ?? null : null
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

function RouteViewport({ origin, destination }: { origin: Airport; destination: Airport }) {
  const map = useMap()

  useEffect(() => {
    const resizeMap = () => map.invalidateSize({ pan: false })
    const bounds = L.latLngBounds([origin.lat, origin.lng], [destination.lat, destination.lng])
    resizeMap()
    map.fitBounds(bounds, { padding: [56, 56], maxZoom: 7, animate: true, duration: 0.8 })
    const container = map.getContainer()
    const observer = new ResizeObserver(resizeMap)
    observer.observe(container)
    return () => observer.disconnect()
  }, [destination.lat, destination.lng, map, origin.lat, origin.lng])

  return null
}

function AnimatedPlane({ origin, destination }: { origin: Airport; destination: Airport }) {
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    let frame = 0
    const startedAt = performance.now()
    const duration = 8000

    const animate = (now: number) => {
      const nextProgress = ((now - startedAt) % duration) / duration
      setProgress(nextProgress)
      frame = requestAnimationFrame(animate)
    }

    frame = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(frame)
  }, [destination.iata, origin.iata])

  const position: L.LatLngExpression = [
    origin.lat + (destination.lat - origin.lat) * progress,
    origin.lng + (destination.lng - origin.lng) * progress,
  ]

  return <Marker position={position} icon={PLANE_ICON} interactive={false} />
}

export function RouteMap({ origin, destination, theme, routeLabel, airline, fare }: RouteMapProps) {
  const from = useMemo(() => resolveAirport(origin), [origin])
  const to = useMemo(() => resolveAirport(destination), [destination])
  const hasRoute = Boolean(from && to)
  const routeKey = `${from?.iata ?? 'unknown'}-${to?.iata ?? 'unknown'}`
  const lineColor = theme === 'dark' ? '#67e8f9' : '#0f766e'

  return (
    <div className={`overflow-hidden rounded-[28px] border ${theme === 'dark' ? 'border-white/10 bg-[#172235]' : 'border-slate-200 bg-[#dce8ec]'}`}>
      <div className="flex items-center justify-between gap-3 bg-white/80 px-5 py-4 backdrop-blur dark:bg-slate-950/65">
        <div>
          <p className={`text-xs font-semibold uppercase tracking-[0.2em] ${theme === 'dark' ? 'text-cyan-200' : 'text-teal-700'}`}>
            Live route map
          </p>
          <p className={`mt-1 text-sm ${theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>
            {routeLabel ?? `${from?.iata ?? origin} to ${to?.iata ?? destination}`}
          </p>
        </div>
        <MapPinned size={20} className={theme === 'dark' ? 'text-cyan-200' : 'text-teal-700'} />
      </div>

      {hasRoute && from && to ? (
        <div className="route-map-canvas">
          <MapContainer
            key={routeKey}
            center={INDIA_CENTER}
            zoom={4}
            minZoom={2}
            maxZoom={18}
            scrollWheelZoom
            zoomControl
            className="h-full min-h-[420px] w-full"
            aria-label={`Map showing the route from ${from.city} to ${to.city}`}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <RouteViewport origin={from} destination={to} />
            <Polyline positions={[[from.lat, from.lng], [to.lat, to.lng]]} pathOptions={{ color: lineColor, weight: 4, opacity: 0.9, dashArray: '10 10' }} />
            <Marker position={[from.lat, from.lng]} icon={airportIcon('origin')}>
              <Popup>
                <strong>{from.iata}</strong><br />{from.name}
              </Popup>
            </Marker>
            <Marker position={[to.lat, to.lng]} icon={airportIcon('destination')}>
              <Popup>
                <strong>{to.iata}</strong><br />{to.name}
              </Popup>
            </Marker>
            <AnimatedPlane origin={from} destination={to} />
          </MapContainer>

          <div className="pointer-events-none absolute bottom-4 left-4 z-[1000] flex items-center gap-2 rounded-full border border-white/30 bg-slate-950/80 px-3 py-2 text-xs font-semibold text-white shadow-lg backdrop-blur">
            <PlaneTakeoff size={14} className="text-amber-300" />
            {from.iata} → {to.iata}
          </div>
        </div>
      ) : (
        <div className={`border-t px-5 py-8 text-sm ${theme === 'dark' ? 'border-white/10 text-slate-400' : 'border-slate-200 text-slate-600'}`}>
          Route coordinates are not available for this airport pair yet.
        </div>
      )}

      {(airline || fare) && (
        <div className={`border-t px-5 py-4 ${theme === 'dark' ? 'border-white/10 bg-slate-950/40 text-slate-200' : 'border-slate-200 bg-white/80 text-slate-800'}`}>
          {airline ? <div className="text-sm font-semibold">{airline}</div> : null}
          {fare ? <div className="mt-1 text-sm text-teal-600 dark:text-teal-300">{fare}</div> : null}
        </div>
      )}
    </div>
  )
}
