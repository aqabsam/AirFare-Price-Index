export function hideProviderBrand(value: string) {
  return value.replace(/duffel(?:\s+api)?/gi, 'flight data provider')
}