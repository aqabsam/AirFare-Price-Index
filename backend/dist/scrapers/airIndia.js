import { scrapeWebsite } from './shared.js';
export function createAirIndiaScraper() {
    const url = process.env.SCRAPER_AIR_INDIA_URL?.trim() || 'https://www.airindia.com/en-in/book-flights';
    if (!url)
        return null;
    const definition = {
        id: 'air-india', name: 'Air India website', sourceType: 'airline', airline: 'Air India', airlineCode: 'AI', url,
        cardSelectors: ['[data-testid*="flight"]', '[class*="flight-card"]', '[class*="flightCard"]', 'article'],
        hints: { origin: [/from|origin|depart/i], destination: [/to|destination|arriv/i], date: [/date|departure|journey/i], submit: [/search|find flights|continue/i] },
    };
    return { definition, scrape: (browser, input) => scrapeWebsite(browser, definition, input) };
}
