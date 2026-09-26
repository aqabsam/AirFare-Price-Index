import { scrapeWebsite } from './shared.js';
export function createStarAirScraper() {
    const url = process.env.SCRAPER_STAR_AIR_URL?.trim();
    if (!url)
        return null;
    const definition = { id: 'star-air', name: 'Star Air website', sourceType: 'airline', airline: 'Star Air', airlineCode: 'S5', url, cardSelectors: ['[data-testid*="flight"]', '[class*="flight"]', 'article'], hints: { origin: [/from|origin|depart/i], destination: [/to|destination|arriv/i], date: [/date|departure|journey/i], submit: [/search|find flights|continue/i] } };
    return { definition, scrape: (browser, input) => scrapeWebsite(browser, definition, input) };
}
