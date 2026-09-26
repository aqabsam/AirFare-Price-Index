import { scrapeWebsite } from './shared.js';
export function createAkasaScraper() {
    const url = process.env.SCRAPER_AKASA_URL?.trim() || 'https://www.akasaair.com/flight-booking';
    if (!url)
        return null;
    const definition = { id: 'akasa', name: 'Akasa Air website', sourceType: 'airline', airline: 'Akasa Air', airlineCode: 'QP', url, cardSelectors: ['[data-testid*="flight"]', '[class*="flight"]', 'article'], hints: { origin: [/from|origin|depart/i], destination: [/to|destination|arriv/i], date: [/date|departure|journey/i], submit: [/search|find flights|continue/i] } };
    return { definition, scrape: (browser, input) => scrapeWebsite(browser, definition, input) };
}
