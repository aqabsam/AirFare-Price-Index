import { z } from 'zod';
import { searchFlights } from '../services/flightService.js';
const flightSearchSchema = z
    .object({
    origin: z
        .string()
        .trim()
        .transform((value) => value.toUpperCase())
        .pipe(z.string().regex(/^[A-Z]{3}$/, 'origin must be a 3-letter airport code')),
    destination: z
        .string()
        .trim()
        .transform((value) => value.toUpperCase())
        .pipe(z.string().regex(/^[A-Z]{3}$/, 'destination must be a 3-letter airport code')),
    departureDate: z
        .string()
        .trim()
        .regex(/^\d{4}-\d{2}-\d{2}$/, 'departureDate must be in YYYY-MM-DD format'),
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
    message: 'origin and destination must be different',
    path: ['destination'],
});
export async function flightsRoutes(fastify) {
    fastify.post('/api/flights/search', async (request, reply) => {
        const parsed = flightSearchSchema.safeParse(request.body);
        if (!parsed.success) {
            return reply.status(400).send({
                error: 'Invalid flight search request',
                details: parsed.error.flatten(),
            });
        }
        try {
            const offers = await searchFlights(parsed.data);
            return reply.send({ offers });
        }
        catch (error) {
            request.log.error({ error }, 'Unexpected flight search failure');
            return reply.status(500).send({ error: 'Unable to search flights right now' });
        }
    });
}
