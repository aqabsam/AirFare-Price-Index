# Airfare Price Index

## Project Purpose

A React and Node.js application for searching flight fares, comparing routes, and analyzing live airfare data for India.

## Frontend Sections

### Home
Introduces the product and links users to flight search, airfare index, analytics, and data explorer.

### Search
Users select origin, destination, departure date, and passengers. The page shows a large airplane animation while live data is fetched, then displays flight results.

### Results
Shows:

- Route and travel date
- Available airlines returned for the route
- Cheapest fare
- Flight number
- Departure and arrival time
- Duration
- Stops
- Price
- Responsive mobile flight cards and desktop comparison table

### Airfare Index
Displays live route summaries, fare index values, cheapest fares, carriers, and route movement.

### Analytics
Displays live fare trends, booking-window comparisons, daily indexes, route summaries, and heatmap data.

### Data Explorer
Displays normalized live fare snapshots in a table with route counts, visible rows, and export-oriented views.

### About
Provides project and pipeline information.

## Backend Sections

### Flight API
`POST /api/flights/search` collects live fares for a requested route and returns normalized flight offers.

### Analytics API
Provides endpoints for airfare index summaries, analytics, fare snapshots, trends, and heatmap data.

### Fare Collector
Runs configured Playwright website scrapers in parallel, applies timeouts, normalizes results, removes duplicate flight variants, and stores snapshots.

### Website Scrapers
Separate scraper modules are available for:

- IndiGo
- Air India
- Akasa Air
- Air India Express
- Alliance Air
- Star Air
- SpiceJet
- MakeMyTrip
- Goibibo
- Yatra
- EaseMyTrip
- Cleartrip
- ixigo

### Fare Store
Stores normalized fare snapshots in PostgreSQL when configured and supports the local file cache when explicitly enabled.

## Scraper Configuration

Configure sources in `backend/.env`:

```env
SCRAPER_TIMEOUT=15000
SCRAPER_MAX_CONCURRENT=5
SCRAPER_HEADLESS=true
SCRAPER_CACHE_TTL=300
```

Each `SCRAPER_*_URL` points to a permitted airline or OTA website. Empty or blocked sources return no fabricated data.

## Data Flow

```text
React frontend
  -> Node.js API
  -> Playwright website scrapers
  -> Normalized fare snapshots
  -> PostgreSQL or file cache
  -> Search, index, analytics, and explorer views
```

## Validation

- Backend TypeScript build passes.
- Frontend production build passes.
- No third-party flight API is used.
- No seeded demo fares are used for live search or analytics.

## Important Limitation

Airline and OTA websites can change their HTML, require consent flows, or block automated browsers. Each source may need updated selectors and permission to automate access before it returns live fare cards.    

## commnand for both run
    cd ~/Desktop/AIRLINE
(cd backend && npm run dev) & (cd frontend && npm run dev)