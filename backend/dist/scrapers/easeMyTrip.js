import { scrapeWebsite } from './shared.js';
export function createEaseMyTripScraper() {
    const url = process.env.SCRAPER_EASEMYTRIP_URL?.trim() || 'https://flight.easemytrip.com/';
    if (!url)
        return null;
    const definition = {
        id: 'easemytrip',
        name: 'EaseMyTrip website',
        sourceType: 'ota',
        url,
        cardSelectors: [
            '[class*="fltResult"]',
            '[class*="flt-opt"]',
            '[class*="listing"]',
            '[class*="flight"]',
            'article',
        ],
        hints: {
            origin: [/from|origin|depart/i],
            destination: [/to|destination|arriv/i],
            date: [/date|departure|journey/i],
            submit: [/search|search flights|continue/i],
        },
        buildSearchUrl: (input) => {
            const [y, m, d] = input.departureDate.split('-');
            const dateDMY = `${d}/${m}/${y}`;
            const configuredUrl = new URL(url);
            return `${configuredUrl.origin}/FlightList/Index?srch=${input.origin}-${input.destination}-${dateDMY}&px=${input.adults}-0-0&cbn=0&ar=undefined&isSplitItinerary=false`;
        },
    };
    return { definition, scrape: (browser, input) => scrapeWebsite(browser, definition, input) };
}
