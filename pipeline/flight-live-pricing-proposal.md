# Real-Time Flight Fare Intelligence Proposal

## Page 1. Proposed Solution and Prototype Idea

### Problem Statement
Travelers and administrators need live flight prices, departure dates, arrival times, airline names, seat availability, and booking-window comparisons instead of seeded or static demo data. For SIH, the goal is not just to display a flight list, but to continuously collect and normalize real fares from airline booking portals and OTAs, then expose them through a searchable dashboard and airfare index.

### Proposed Solution
Build a live fare intelligence pipeline that:

1. Reads configured airline and OTA source definitions.
2. Opens the official booking/search flow for each permitted source.
3. Fills route and date parameters for booking windows such as `T+1`, `T+7`, `T+15`, `T+30`, and `T+45`.
4. Scrapes fare cards, times, taxes, seat counts, and source timestamps.
5. Normalizes each result into a common schema.
6. Stores the cleaned records in PostgreSQL.
7. Serves live search results and analytics to the React dashboard.

### Prototype Idea
The prototype should focus on one route pair first, for example `PAT -> BOM`, and one or two live sources such as IndiGo and Air India. Once the pipeline is stable, more sources can be added using the same config-driven pattern.

The prototype should show:

- Real fare cards from live sources only.
- No fallback to seeded data when live data is missing.
- A route filter for origin, destination, and departure date.
- A booking-window comparison view.
- An admin panel showing which sources are live, stale, or empty.

---

## Page 2. Technical Approach

### System Flow

`Airline/OTA booking pages -> Playwright scraper -> raw flight snapshots -> cleaning and normalization -> PostgreSQL -> airfare index service -> backend API -> React dashboard`

### Backend Components

- `backend/src/services/fareCollector.ts`
  - Opens configured live sources with Playwright.
  - Attempts basic route/date form filling.
  - Scrapes the visible flight cards after search.
- `backend/src/services/fareStore.ts`
  - Normalizes snapshots.
  - Stores them in PostgreSQL.
  - Optionally persists a file cache only when explicitly enabled.
- `backend/src/services/airfareIndexService.ts`
  - Builds route summaries.
  - Computes fare trends for booking windows.
  - Generates daily airfare index series and heatmap cells.
- `backend/src/routes/analytics.ts`
  - Serves the analytics API for the UI.
- `backend/src/routes/admin.ts`
  - Exposes collection status and source health.

### Frontend Components

- `frontend/src/pages/AnalyticsPage.tsx`
  - Shows live fare trends, daily index, and heatmap views.
- `frontend/src/pages/AdminPage.tsx`
  - Shows collection status, snapshot list, and source health.
- `frontend/src/services/fareApi.ts`
  - Calls the backend endpoints for fares, analytics, and admin status.

### Data Model

Each snapshot should keep:

- route key
- origin and destination
- departure date
- booking window day
- collection date
- airline and flight number
- departure and arrival times
- price, currency, and seats remaining
- source name and source ID
- confidence and collection timestamp

### Why This Approach

This design keeps the system flexible:

- If a source exposes HTML cards, Playwright can scrape them.
- If a source exposes an API, the same schema can ingest it.
- If a source is unavailable, the system returns no rows rather than fabricated data.

---

## Page 3. Feasibility and Viability

### Technical Feasibility

The solution is technically feasible because:

- Playwright is designed for browser automation and resilient locators.
- PostgreSQL can store normalized fare snapshots efficiently.
- Fastify provides a lightweight API layer for analytics and admin tools.
- React is well suited for route filters, charts, and data-driven dashboards.

### Operational Feasibility

The system can be operated in stages:

1. Start with a small set of routes and sources.
2. Validate scraping on each source individually.
3. Expand to more routes, more booking windows, and more carriers.
4. Store results in PostgreSQL and refresh on a schedule.

### Viability

The project is viable for SIH because it demonstrates:

- real-world data integration
- data normalization
- analytics generation
- route and fare comparison
- admin observability

### Constraints and Risks

- Airline and OTA websites can change their HTML at any time.
- Some sites may use dynamic anti-bot controls or require manual tuning.
- Not every source will expose the same data fields.
- Some live searches may be blocked or rate limited.

### Mitigation

- Use source-specific scraper profiles.
- Maintain a fallback parser only for live pages, not seeded data.
- Track source health in the admin view.
- Store source metadata, timestamps, and confidence values.

---

## Page 4. Impact and Benefits

### User Impact

Users get:

- real fare visibility instead of demo content
- actual booking dates and live times
- fare comparison across airlines and OTAs
- route-based search with booking windows

### Admin and Research Impact

Administrators and researchers get:

- a daily airfare index
- trend analysis for `T+1`, `T+7`, `T+15`, `T+30`, and `T+45`
- a heatmap of fare movement by route and booking window
- source health monitoring

### Benefits to the SIH Problem Statement

This solution directly addresses the need for a live airfare intelligence layer by:

- collecting fares from official booking flows
- normalizing the data into one schema
- comparing fares across sources
- exposing the data in a dashboard

### Broader Benefits

- Better fare transparency
- Faster route-level pricing analysis
- Foundation for predictive pricing work later
- Reusable ingestion architecture for other transport domains

---

## Page 5. Implementation Roadmap

### Phase 1. Source Onboarding

- Add source definitions for IndiGo, Air India, Air India Express, Akasa Air, SpiceJet, and major OTAs.
- Confirm which sources can be searched through page automation and which need API-based ingestion.
- Tune selectors for each site.

### Phase 2. Scraper Hardening

- Add per-source scraper profiles.
- Improve form handling for date pickers and airport selectors.
- Record failures and source health in the admin panel.

### Phase 3. Storage and Indexing

- Persist raw normalized fares to PostgreSQL.
- Create route-level and day-level views.
- Maintain booking-window snapshots for `T+` comparisons.

### Phase 4. Analytics and UI

- Show live fare trend cards.
- Add heatmaps and daily index charts.
- Add route filters and source health visibility.

### Phase 5. Expansion

- Add more routes across metro and tier-2 city pairs.
- Add scheduled collection jobs.
- Add export/reporting for evaluation and presentation.

---

## Page 6. Research and References

### Official Technical References

- Playwright Locators: https://playwright.dev/docs/locators
- Playwright Other Locators: https://playwright.dev/docs/other-locators
- PostgreSQL Documentation: https://www.postgresql.org/docs/
- Fastify Getting Started: https://fastify.dev/docs/latest/Guides/Getting-Started/
- Fastify Reference: https://fastify.dev/docs/latest/Reference/
- Fastify TypeScript Reference: https://fastify.dev/docs/latest/Reference/TypeScript/
- React Reference Overview: https://react.dev/reference/react
- React Quick Start: https://react.dev/learn

### Project-Specific References

- Live-only fare pipeline notes: `pipeline/README.md`
- Example source config: `pipeline/fare-sources.example.json`
- Analytics UI: `frontend/src/pages/AnalyticsPage.tsx`
- Admin UI: `frontend/src/pages/AdminPage.tsx`

### Research Notes

- Playwright recommends resilient locators such as role, label, text, placeholder, and test-id based selectors for robust browser automation.
- PostgreSQL is suitable for structured fare snapshots, route summaries, and indexed analytics.
- Fastify is a good fit for a small, fast API layer with route registration and TypeScript support.
- React is a good fit for a dashboard that needs filters, dynamic cards, and chart-driven views.

### Note on Live Data Collection

The system should only use live airline or OTA sources that are permitted for access and should avoid seeded fallbacks when live sources are missing.

