# Fare data pipeline

This folder documents the local data pipeline for collecting real airline and OTA fares.

Flow:

`Playwright` -> permitted airline/OTA pages -> raw fare snapshots -> Python cleaning/normalization -> PostgreSQL -> Node API -> React UI

The repository is now wired for live-only collection. If no real airline or OTA source is configured, the search and collection flows should return no fares rather than fabricated demo data.

## Runtime pieces

- `backend/src/routes/flights.ts` serves search results to the React app.
- `backend/src/routes/analytics.ts` exposes fare snapshots and airfare index summaries.
- `backend/src/services/fareStore.ts` keeps the normalized snapshot cache and persists it to `backend/data/fare-snapshots.json`.
- `backend/src/jobs/fareRefresh.ts` is the scheduler hook for periodic persistence or ingestion refreshes.

## Website scraper setup

The backend uses only the source-specific Playwright scrapers in `backend/src/scrapers/`.
Configure permitted page URLs in `backend/.env` with `SCRAPER_INDIGO_URL`,
`SCRAPER_AIR_INDIA_URL`, `SCRAPER_MAKEMYTRIP_URL`, `SCRAPER_GOIBIBO_URL`, and
`SCRAPER_SPICEJET_URL`. Leave a source empty until you have permission to automate it.
The scrapers run in parallel, enforce a configurable per-source timeout, normalize visible
flight cards, and discard sources that return no valid fare cards.

Runtime controls are configured in `backend/.env`: `SCRAPER_TIMEOUT` is the per-source
timeout in milliseconds, `SCRAPER_MAX_CONCURRENT` limits active source jobs,
`SCRAPER_HEADLESS` controls browser visibility, and `SCRAPER_CACHE_TTL` is the route
cache lifetime in seconds.

## How to extend

1. Point the source-specific Playwright scraper at a permitted airline/OTA booking page.
2. Add a new source module under `backend/src/scrapers/` with its own selectors and field hints.
3. Save the normalized snapshots to PostgreSQL through the existing fare store.
4. Run the Python cleaning scripts in this folder when batch processing is needed.
5. Keep the React search page pointed at `/api/flights/search`.

## What is live versus seeded

- If a configured airline or OTA page returns data, that data is treated as the live source of truth for price, departure/arrival times, stops, and timestamps.
- If a source is missing, unreachable, or not yet configured, the collector should return no rows and surface an error in the admin status instead of falling back to seeded snapshots.

## Config

- `backend/.env.example` lists the backend variables, including database settings, scraper URLs, and `FARE_REFRESH_CRON`.
- `frontend/.env.example` lists the optional `VITE_API_BASE_URL`.
