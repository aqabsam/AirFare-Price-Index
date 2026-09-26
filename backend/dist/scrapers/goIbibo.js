import { scrapeWebsite } from './shared.js';
export function createGoIbiboScraper() {
    const url = process.env.SCRAPER_GOIBIBO_URL?.trim();
    if (!url)
        return null;
    const definition = {
        id: 'goibibo', name: 'Goibibo website', sourceType: 'ota', url,
        cardSelectors: ['[class*="flightCard"]', '[class*="listing"]', '[data-testid*="flight"]', 'article'],
        hints: { origin: [/from|origin|depart/i], destination: [/to|destination|arriv/i], date: [/date|departure|journey/i], submit: [/search|search flights|continue/i] },
    };
    return { definition, scrape: (browser, input) => scrapeWebsite(browser, definition, input) };
}
