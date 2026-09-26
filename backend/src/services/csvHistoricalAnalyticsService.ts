import { readFile, readdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const PROJECT_ROOT = fileURLToPath(new URL('../../../', import.meta.url))
const DATE_HEADERS = ['date', 'observationdate', 'observeddate', 'collectiondate', 'collectedat', 'observedat', 'timestamp', 'scrapedat', 'snapshotdate', 'recordedat', 'searchdate', 'quotedate']
const ORIGIN_HEADERS = ['origin', 'from', 'origincode', 'originiata', 'originairportcode', 'originairportiata']
const DESTINATION_HEADERS = ['destination', 'to', 'destinationcode', 'destinationiata', 'destinationairportcode', 'destinationairportiata']
const FARE_HEADERS = ['fare', 'price', 'totalfare', 'totalprice', 'amount', 'totalamount', 'fareinr', 'priceinr', 'totalfareinr', 'totalpriceinr']
const CURRENCY_HEADERS = ['currency', 'farecurrency', 'pricecurrency', 'totalcurrency']
const ACTUAL_HEADERS = ['actualfare', 'actualprice', 'actualamount']
const PREDICTED_HEADERS = ['predictedfare', 'predictedprice', 'predictedamount', 'forecastfare', 'forecastprice']
const INSUFFICIENT_MESSAGE = 'Insufficient historical data available for this analysis.'

export type CsvHistoricalObservation = {
  id: string
  date: string
  origin: string
  destination: string
  routeKey: string
  airline: string | null
  flightNumber: string | null
  fare: number
  currency: string
  sourceFile: string
  actualFare: number | null
  predictedFare: number | null
}

type CsvFileSummary = {
  name: string
  columns: string[]
  rows: number
  malformedRows: number
  mappedColumns: {
    date: string | null
    origin: string | null
    destination: string | null
    fare: string | null
    currency: string | null
    actualFare: string | null
    predictedFare: string | null
  }
}

type DatedFareMetric = {
  date: string
  observations: number
  routes: number
  lowestFare: number
  highestFare: number
  averageFare: number
  index: number | null
}

export type CsvHistoricalAnalyticsResponse = {
  available: boolean
  source: 'CSV files'
  refreshedAt: string
  files: CsvFileSummary[]
  period: { startDate: string | null; endDate: string | null }
  observations: CsvHistoricalObservation[]
  summary: {
    observationCount: number
    dateCount: number
    lowestFare: number | null
    highestFare: number | null
    averageFare: number | null
    priceSpread: number | null
    priceChange: number | null
    priceChangePercent: number | null
    basePeriod: string | null
    baseIndex: number | null
    routeBasket: string[]
    routeWeights: Record<string, number>
  }
  routes: Array<{
    routeKey: string
    origin: string
    destination: string
    observationCount: number
    lowestFare: number
    highestFare: number
    averageFare: number
    index: number | null
  }>
  daily: DatedFareMetric[]
  weekly: DatedFareMetric[]
  monthly: DatedFareMetric[]
  quality: {
    sourceRows: number
    uniqueRows: number
    duplicateRows: number
    validFareObservations: number
    datesRepresented: number
    missingDateRows: number
    invalidDateRows: number
    missingOriginRows: number
    missingDestinationRows: number
    invalidRouteRows: number
    missingFareRows: number
    invalidFareRows: number
    missingCurrencyRows: number
  }
  benchmark: {
    available: boolean
    sampleCount: number
    mae: number | null
    rmse: number | null
    mape: number | null
    correlation: number | null
    message: string
  }
  message: string
}

type ParsedFile = {
  summary: CsvFileSummary
  records: Array<{ values: Record<string, string>; identity: string }>
  headerKeys: string[]
}

function parseCsv(text: string) {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index]
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        field += '"'
        index += 1
      } else if (character === '"') {
        quoted = false
      } else {
        field += character
      }
    } else if (character === '"' && field.length === 0) {
      quoted = true
    } else if (character === ',') {
      row.push(field)
      field = ''
    } else if (character === '\n') {
      row.push(field.replace(/\r$/, ''))
      rows.push(row)
      row = []
      field = ''
    } else {
      field += character
    }
  }

  if (row.length || field.length) {
    row.push(field.replace(/\r$/, ''))
    rows.push(row)
  }
  return rows
}

function normalizeHeader(value: string) {
  return value.replace(/^\uFEFF/, '').trim().toLowerCase().replace(/[^a-z0-9]/g, '')
}

function findHeader(headers: string[], aliases: string[]) {
  const wanted = new Set(aliases)
  return headers.find((header) => wanted.has(normalizeHeader(header))) ?? null
}

function parseDate(value: string) {
  const trimmed = value.trim()
  const isoDate = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})(?:$|T|\s)/)
  if (isoDate) {
    const year = Number(isoDate[1])
    const month = Number(isoDate[2])
    const day = Number(isoDate[3])
    const parsed = new Date(Date.UTC(year, month - 1, day))
    return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day ? `${isoDate[1]}-${isoDate[2]}-${isoDate[3]}` : null
  }
  const slashDate = trimmed.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/)
  if (slashDate) {
    const year = Number(slashDate[1])
    const month = Number(slashDate[2])
    const day = Number(slashDate[3])
    const parsed = new Date(Date.UTC(year, month - 1, day))
    return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day
      ? `${slashDate[1]}-${slashDate[2].padStart(2, '0')}-${slashDate[3].padStart(2, '0')}`
      : null
  }
  return null
}

function parseFare(value: string) {
  const normalized = value.trim().replace(/[₹$€£\s]/g, '').replace(/^(?:INR|USD|EUR|GBP)/i, '').replace(/,/g, '')
  if (!/^-?\d+(?:\.\d+)?$/.test(normalized)) return null
  const fare = Number(normalized)
  return Number.isFinite(fare) && fare > 0 ? fare : null
}

function readField(record: Record<string, string>, header: string | null) {
  return header ? (record[normalizeHeader(header)] ?? '').trim() : ''
}

function parseFile(name: string, text: string): ParsedFile {
  const rows = parseCsv(text)
  const originalHeaders = (rows[0] ?? []).map((header) => header.replace(/^\uFEFF/, '').trim())
  const headerKeys = originalHeaders.map(normalizeHeader)
  const dataRows = rows.slice(1).filter((row) => row.some((value) => value.trim().length > 0))
  const malformedRows = dataRows.filter((row) => row.length !== originalHeaders.length).length
  const records = dataRows.map((row) => {
    const values = Object.fromEntries(headerKeys.map((key, index) => [key, (row[index] ?? '').trim()]))
    const identity = JSON.stringify(Object.entries(values).sort(([left], [right]) => left.localeCompare(right)))
    return { values, identity }
  })
  return {
    summary: {
      name,
      columns: originalHeaders,
      rows: dataRows.length,
      malformedRows,
      mappedColumns: {
        date: findHeader(originalHeaders, DATE_HEADERS),
        origin: findHeader(originalHeaders, ORIGIN_HEADERS),
        destination: findHeader(originalHeaders, DESTINATION_HEADERS),
        fare: findHeader(originalHeaders, FARE_HEADERS),
        currency: findHeader(originalHeaders, CURRENCY_HEADERS),
        actualFare: findHeader(originalHeaders, ACTUAL_HEADERS),
        predictedFare: findHeader(originalHeaders, PREDICTED_HEADERS),
      },
    },
    records,
    headerKeys,
  }
}

function datedFareMetric(date: string, records: CsvHistoricalObservation[], indices: Map<string, number>) {
  const fares = records.map((record) => record.fare)
  const routeMeans = new Map<string, number[]>()
  for (const record of records) routeMeans.set(record.routeKey, [...(routeMeans.get(record.routeKey) ?? []), record.fare])
  const indexValues = [...routeMeans.entries()].flatMap(([routeKey, values]) => {
    const baseline = indices.get(routeKey)
    if (!baseline || baseline <= 0) return []
    const mean = values.reduce((sum, value) => sum + value, 0) / values.length
    return [(mean / baseline) * 100]
  })
  return {
    date,
    observations: records.length,
    routes: routeMeans.size,
    lowestFare: Math.min(...fares),
    highestFare: Math.max(...fares),
    averageFare: fares.reduce((sum, fare) => sum + fare, 0) / fares.length,
    index: indexValues.length ? indexValues.reduce((sum, value) => sum + value, 0) / indexValues.length : null,
  }
}

function emptyResponse(files: CsvFileSummary[], sourceRows: number, uniqueRows: number, duplicateRows: number, quality: CsvHistoricalAnalyticsResponse['quality']): CsvHistoricalAnalyticsResponse {
  return {
    available: files.length > 0,
    source: 'CSV files',
    refreshedAt: new Date().toISOString(),
    files,
    period: { startDate: null, endDate: null },
    observations: [],
    summary: { observationCount: 0, dateCount: 0, lowestFare: null, highestFare: null, averageFare: null, priceSpread: null, priceChange: null, priceChangePercent: null, basePeriod: null, baseIndex: null, routeBasket: [], routeWeights: {} },
    routes: [],
    daily: [],
    weekly: [],
    monthly: [],
    quality: { ...quality, sourceRows, uniqueRows, duplicateRows, validFareObservations: 0, datesRepresented: 0 },
    benchmark: { available: false, sampleCount: 0, mae: null, rmse: null, mape: null, correlation: null, message: INSUFFICIENT_MESSAGE },
    message: INSUFFICIENT_MESSAGE,
  }
}

export async function getCsvHistoricalAnalytics(): Promise<CsvHistoricalAnalyticsResponse> {
  const fileNames = (await readdir(PROJECT_ROOT, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.csv'))
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right))
  const parsedFiles: ParsedFile[] = []
  for (const name of fileNames) {
    try {
      parsedFiles.push(parseFile(name, await readFile(new URL(`file://${PROJECT_ROOT}/${encodeURIComponent(name)}`), 'utf8')))
    } catch {
      continue
    }
  }

  const files = parsedFiles.map((file) => file.summary)
  const allRecords = parsedFiles.flatMap((file) => file.records)
  const uniqueByIdentity = new Map<string, { values: Record<string, string>; identity: string; sourceFiles: Set<string> }>()
  for (const record of allRecords) {
    const existing = uniqueByIdentity.get(record.identity)
    if (existing) existing.sourceFiles.add(parsedFiles.find((file) => file.records.includes(record))?.summary.name ?? '')
    else {
      const sourceFile = parsedFiles.find((file) => file.records.includes(record))?.summary.name ?? ''
      uniqueByIdentity.set(record.identity, { ...record, sourceFiles: new Set([sourceFile]) })
    }
  }
  const uniqueRows = [...uniqueByIdentity.values()]
  const duplicateRows = allRecords.length - uniqueRows.length
  const rowsWithMappedColumns = parsedFiles.map((file) => ({ file, mapping: file.summary.mappedColumns }))
  let missingDateRows = 0
  let invalidDateRows = 0
  let missingOriginRows = 0
  let missingDestinationRows = 0
  let invalidRouteRows = 0
  let missingFareRows = 0
  let invalidFareRows = 0
  let missingCurrencyRows = 0
  const candidates: CsvHistoricalObservation[] = []
  const benchmarks: Array<{ actual: number; predicted: number }> = []

  for (const record of uniqueRows) {
    const owningFile = rowsWithMappedColumns.find(({ file }) => file.headerKeys.every((key) => Object.hasOwn(record.values, key))) ?? rowsWithMappedColumns.find(({ file }) => file.headerKeys.length === Object.keys(record.values).length)
    if (!owningFile) continue
    const { mapping } = owningFile
    const dateValue = readField(record.values, mapping.date)
    const date = dateValue ? parseDate(dateValue) : null
    if (!dateValue) missingDateRows += 1
    else if (!date) invalidDateRows += 1
    const originValue = readField(record.values, mapping.origin)
    const destinationValue = readField(record.values, mapping.destination)
    if (!originValue) missingOriginRows += 1
    if (!destinationValue) missingDestinationRows += 1
    const origin = /^[A-Za-z]{3}$/.test(originValue) ? originValue.toUpperCase() : ''
    const destination = /^[A-Za-z]{3}$/.test(destinationValue) ? destinationValue.toUpperCase() : ''
    if (originValue && !origin || destinationValue && !destination) invalidRouteRows += 1
    const fareValue = readField(record.values, mapping.fare)
    const fare = fareValue ? parseFare(fareValue) : null
    if (!fareValue) missingFareRows += 1
    else if (!fare) invalidFareRows += 1
    const currencyValue = readField(record.values, mapping.currency)
    const fareHeader = normalizeHeader(mapping.fare ?? '')
    const currency = currencyValue.toUpperCase() || (fareHeader.endsWith('inr') ? 'INR' : '')
    if (fare && !currency) missingCurrencyRows += 1
    if (!date || !origin || !destination || !fare || !currency) continue

    const airlineHeader = findHeader(owningFile.file.summary.columns, ['airline', 'carrier', 'airlinename'])
    const flightHeader = findHeader(owningFile.file.summary.columns, ['flightnumber', 'flightno', 'flight'])
    const actualValue = readField(record.values, mapping.actualFare)
    const predictedValue = readField(record.values, mapping.predictedFare)
    const actualFare = actualValue ? parseFare(actualValue) : null
    const predictedFare = predictedValue ? parseFare(predictedValue) : null
    if (actualFare && predictedFare) benchmarks.push({ actual: actualFare, predicted: predictedFare })
    const sourceFile = [...uniqueByIdentity.get(record.identity)!.sourceFiles].filter(Boolean).sort().join(', ')
    candidates.push({
      id: record.identity,
      date,
      origin,
      destination,
      routeKey: `${origin}-${destination}`,
      airline: readField(record.values, airlineHeader) || null,
      flightNumber: readField(record.values, flightHeader) || null,
      fare,
      currency,
      sourceFile,
      actualFare,
      predictedFare,
    })
  }

  const sourceRows = allRecords.length
  const quality = {
    sourceRows,
    uniqueRows: uniqueRows.length,
    duplicateRows,
    validFareObservations: 0,
    datesRepresented: 0,
    missingDateRows,
    invalidDateRows,
    missingOriginRows,
    missingDestinationRows,
    invalidRouteRows,
    missingFareRows,
    invalidFareRows,
    missingCurrencyRows,
  }
  if (!candidates.length) return emptyResponse(files, sourceRows, uniqueRows.length, duplicateRows, quality)

  const latestDate = candidates.map((record) => record.date).sort().at(-1)!
  const end = new Date(`${latestDate}T00:00:00Z`)
  end.setUTCDate(end.getUTCDate() - 29)
  const startDate = end.toISOString().slice(0, 10)
  const observations = candidates.filter((record) => record.date >= startDate && record.date <= latestDate)
  const dates = [...new Set(observations.map((record) => record.date))].sort()
  const routeKeys = [...new Set(observations.map((record) => record.routeKey))].sort()
  const routeBaselines = new Map<string, number>()
  for (const routeKey of routeKeys) {
    const firstDate = dates.find((date) => observations.some((record) => record.routeKey === routeKey && record.date === date))
    const firstRecords = observations.filter((record) => record.routeKey === routeKey && record.date === firstDate)
    if (firstRecords.length) routeBaselines.set(routeKey, firstRecords.reduce((sum, record) => sum + record.fare, 0) / firstRecords.length)
  }
  const routeWeights = Object.fromEntries(routeKeys.map((routeKey) => [routeKey, routeKeys.length ? 1 / routeKeys.length : 0]))
  const daily = dates.map((date) => datedFareMetric(date, observations.filter((record) => record.date === date), routeBaselines))
  const byWeek = new Map<string, CsvHistoricalObservation[]>()
  const byMonth = new Map<string, CsvHistoricalObservation[]>()
  for (const record of observations) {
    const day = new Date(`${record.date}T00:00:00Z`)
    const weekday = day.getUTCDay() || 7
    day.setUTCDate(day.getUTCDate() - weekday + 1)
    const week = day.toISOString().slice(0, 10)
    byWeek.set(week, [...(byWeek.get(week) ?? []), record])
    const month = record.date.slice(0, 7)
    byMonth.set(month, [...(byMonth.get(month) ?? []), record])
  }
  const weekly = [...byWeek.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([date, records]) => datedFareMetric(date, records, routeBaselines))
  const monthly = [...byMonth.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([date, records]) => datedFareMetric(date, records, routeBaselines))
  const allFares = observations.map((record) => record.fare)
  const dailyAverages = daily.map((item) => item.averageFare)
  const firstAverage = dailyAverages[0]
  const lastAverage = dailyAverages.at(-1)
  const currencies = [...new Set(observations.map((record) => record.currency))]
  const routeSummaries = routeKeys.map((routeKey) => {
    const records = observations.filter((record) => record.routeKey === routeKey)
    const fares = records.map((record) => record.fare)
    return {
      routeKey,
      origin: records[0]!.origin,
      destination: records[0]!.destination,
      observationCount: records.length,
      lowestFare: Math.min(...fares),
      highestFare: Math.max(...fares),
      averageFare: fares.reduce((sum, fare) => sum + fare, 0) / fares.length,
      index: 100,
    }
  })
  const actualPredicted = benchmarks
  const benchmarkMetrics = calculateBenchmark(actualPredicted)
  const completeBenchmark = actualPredicted.length > 1
  quality.validFareObservations = observations.length
  quality.datesRepresented = dates.length
  return {
    available: true,
    source: 'CSV files',
    refreshedAt: new Date().toISOString(),
    files,
    period: { startDate: dates[0] ?? null, endDate: dates.at(-1) ?? null },
    observations,
    summary: {
      observationCount: observations.length,
      dateCount: dates.length,
      lowestFare: Math.min(...allFares),
      highestFare: Math.max(...allFares),
      averageFare: allFares.reduce((sum, fare) => sum + fare, 0) / allFares.length,
      priceSpread: Math.max(...allFares) - Math.min(...allFares),
      priceChange: firstAverage !== undefined && lastAverage !== undefined ? lastAverage - firstAverage : null,
      priceChangePercent: firstAverage ? ((lastAverage! - firstAverage) / firstAverage) * 100 : null,
      basePeriod: dates[0] ?? null,
      baseIndex: dates.length ? 100 : null,
      routeBasket: routeKeys,
      routeWeights,
    },
    routes: routeSummaries,
    daily,
    weekly,
    monthly,
    quality,
    benchmark: { ...benchmarkMetrics, available: completeBenchmark, message: completeBenchmark ? 'Metrics use matched actual and predicted fare fields from CSV observations.' : INSUFFICIENT_MESSAGE },
    message: observations.length ? 'Historical observations loaded from CSV.' : INSUFFICIENT_MESSAGE,
  }
}

function calculateBenchmark(pairs: Array<{ actual: number; predicted: number }>) {
  if (pairs.length < 2) return { sampleCount: pairs.length, mae: null, rmse: null, mape: null, correlation: null }
  const errors = pairs.map(({ actual, predicted }) => actual - predicted)
  const mae = errors.reduce((sum, value) => sum + Math.abs(value), 0) / errors.length
  const rmse = Math.sqrt(errors.reduce((sum, value) => sum + value ** 2, 0) / errors.length)
  const mape = pairs.reduce((sum, pair) => sum + Math.abs(pair.actual - pair.predicted) / pair.actual * 100, 0) / pairs.length
  const actualMean = pairs.reduce((sum, pair) => sum + pair.actual, 0) / pairs.length
  const predictedMean = pairs.reduce((sum, pair) => sum + pair.predicted, 0) / pairs.length
  const covariance = pairs.reduce((sum, pair) => sum + (pair.actual - actualMean) * (pair.predicted - predictedMean), 0)
  const denominator = Math.sqrt(pairs.reduce((sum, pair) => sum + (pair.actual - actualMean) ** 2, 0) * pairs.reduce((sum, pair) => sum + (pair.predicted - predictedMean) ** 2, 0))
  return { sampleCount: pairs.length, mae, rmse, mape, correlation: denominator ? covariance / denominator : null }
}
