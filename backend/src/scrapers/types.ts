import type { Browser, Page } from 'playwright'
import type { FareSnapshot } from '../types/fare.js'
import type { FlightSearchRequest } from '../types/flight.js'

export type ScraperSourceType = 'airline' | 'ota'

export type ScraperFieldHints = {
  origin: RegExp[]
  destination: RegExp[]
  date: RegExp[]
  submit: RegExp[]
}

export type ScraperDefinition = {
  id: string
  name: string
  sourceType: ScraperSourceType
  airline?: string
  airlineCode?: string
  url: string
  cardSelectors: string[]
  hints: ScraperFieldHints
  buildSearchUrl?: (input: FlightSearchRequest) => string
  extractSnapshots?: (page: Page, definition: ScraperDefinition, input: FlightSearchRequest) => Promise<FareSnapshot[]>
}

export type WebsiteScraper = {
  definition: ScraperDefinition
  scrape: (browser: Browser, input: FlightSearchRequest) => Promise<FareSnapshot[]>
}

export type PageScraper = (page: Page, definition: ScraperDefinition, input: FlightSearchRequest) => Promise<FareSnapshot[]>
