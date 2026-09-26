import { z } from 'zod';
import { isValidIndianAirportCode } from '../data/indianAirportCodes.js';
import { searchFlights } from '../services/flightService.js';
import { getCanonicalDataset } from '../services/canonicalDataService.js';
function isCalendarDate(value) {
    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}
export const flightSearchSchema = z
    .object({
    origin: z
        .string()
        .trim()
        .transform((value) => value.toUpperCase())
        .pipe(z.string().refine(isValidIndianAirportCode, 'origin must be a valid Indian IATA airport code')),
    destination: z
        .string()
        .trim()
        .transform((value) => value.toUpperCase())
        .pipe(z.string().refine(isValidIndianAirportCode, 'destination must be a valid Indian IATA airport code')),
    departureDate: z
        .string()
        .trim()
        .regex(/^\d{4}-\d{2}-\d{2}$/, 'departureDate must be in YYYY-MM-DD format')
        .refine(isCalendarDate, 'departureDate must be a real calendar date'),
    adults: z.coerce.number().int().min(1).max(9).optional(),
    passengers: z.coerce.number().int().min(1).max(9).optional(),
})
    .transform((value) => ({
    origin: value.origin,
    destination: value.destination,
    departureDate: value.departureDate,
    adults: value.adults ?? value.passengers ?? 1,
}))
    .refine((value) => value.origin !== value.destination, {
    message: 'origin and destination must be different valid airports',
    path: ['destination'],
});
export async function flightsRoutes(fastify) {
    fastify.get('/api/data/canonical', async () => getCanonicalDataset());
    fastify.post('/api/flights/search', async (request, reply) => {
        const parsed = flightSearchSchema.safeParse(request.body);
        if (!parsed.success) {
            return reply.status(400).send({
                error: 'Invalid flight search request',
                details: parsed.error.flatten(),
            });
        }
        try {
            console.info('[SEARCH] request received');
            console.info(`[SEARCH] origin=${parsed.data.origin}`);
            console.info(`[SEARCH] destination=${parsed.data.destination}`);
            console.info(`[SEARCH] date=${parsed.data.departureDate}`);
            console.info(`[SEARCH] passengers=${parsed.data.adults}`);
            return reply.send(await searchFlights(parsed.data));
        }
        catch (error) {
            request.log.error({ error }, 'Unexpected flight search failure');
            return reply.status(503).send({
                error: 'Verified live flight data could not be retrieved. Please try again.',
            });
        }
    });
}
