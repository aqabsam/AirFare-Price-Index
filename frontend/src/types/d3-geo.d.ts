declare module 'd3-geo' {
  export function geoMercator(): any
  export function geoPath(): any
  export function geoPath(projection: any): any
}

declare module '*.geojson' {
  const value: string
  export default value
}

declare module '*.geojson?raw' {
  const value: string
  export default value
}
