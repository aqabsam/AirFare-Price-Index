import { scrapeWebsite } from './shared.js';
export function createIxigoScraper() {
    const url = process.env.SCRAPER_IXIGO_URL?.trim() || 'https://www.ixigo.com/search/result/flight';
    if (!url)
        return null;
    const definition = {
        id: 'ixigo',
        name: 'ixigo website',
        sourceType: 'ota',
        url,
        cardSelectors: [
            '.shadow-card.cursor-pointer',
            '[class*="flight-listing-row"]',
            '[class*="flightCard"]',
            '[class*="listing"]',
        ],
        hints: {
            origin: [/from|origin|depart/i],
            destination: [/to|destination|arriv/i],
            date: [/date|departure|journey/i],
            submit: [/search|search flights|continue/i],
        },
        buildSearchUrl: (input) => {
            const [y, m, d] = input.departureDate.split('-');
            const dateDDMMYYYY = `${d}${m}${y}`;
            const configuredOrigin = new URL(url).origin;
            return `${configuredOrigin}/search/result/flight?from=${input.origin}&to=${input.destination}&date=${dateDDMMYYYY}&adults=${input.adults}&children=0&infants=0&class=e`;
        },
    };
    return { definition, scrape: (browser, input) => scrapeWebsite(browser, definition, input) };
}
