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

## How to extend

1. Point a Playwright worker at the permitted airline/OTA booking pages for page-based sources.
2. Point API-based sources at official airline/NDC endpoints when you have credentials.
3. Save the raw payloads to PostgreSQL.
4. Run the Python cleaning scripts in this folder to normalize the rows.
5. Feed the normalized rows back into the backend store or query PostgreSQL directly.
6. Keep the React search page pointed at `/api/flights/search`.

## What is live versus seeded

- If a configured airline page or API returns data, that data is treated as the live source of truth for price, departure/arrival times, seats remaining, and timestamps.
- If a source is missing, unreachable, or not yet configured, the collector should return no rows and surface an error in the admin status instead of falling back to seeded snapshots.
- The example config in `pipeline/fare-sources.example.json` shows both a page source and an API source template.

## Config

- `backend/.env.example` lists the backend variables, including `DATABASE_URL`, `FARE_SOURCES_CONFIG`, and `FARE_REFRESH_CRON`.
- `frontend/.env.example` lists the optional `VITE_API_BASE_URL`.
- `pipeline/fare-sources.example.json` shows the selector-driven source config format for permitted airline and OTA pages.
