import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
export const INSUFFICIENT_DGCA_DATA_MESSAGE = 'Insufficient DGCA data available for this analysis.';
const datasetUrl = new URL('../../data/dgca-data.json', import.meta.url);
function isValidObservation(value) {
    if (!value || typeof value !== 'object')
        return false;
    const observation = value;
    return typeof observation.month === 'string'
        && /^\d{4}-\d{2}$/.test(observation.month)
        && typeof observation.airline === 'string'
        && observation.airline.length > 0
        && typeof observation.percent === 'number'
        && Number.isFinite(observation.percent)
        && observation.percent >= 0
        && observation.percent <= 100
        && Number.isInteger(observation.page);
}
function unavailableResponse() {
    return {
        available: false,
        source: 'DGCA-DATA.pdf',
        report: null,
        monthlyPassengerLoadFactors: [],
        fareObservations: [],
        fareAnalysisMessage: INSUFFICIENT_DGCA_DATA_MESSAGE,
    };
}
export async function getDgcaAnalytics() {
    try {
        const dataset = JSON.parse(await readFile(fileURLToPath(datasetUrl), 'utf8'));
        if (dataset.source !== 'DGCA-DATA.pdf' || !dataset.report || !Array.isArray(dataset.monthlyPassengerLoadFactors) || !Array.isArray(dataset.fareObservations)) {
            return unavailableResponse();
        }
        const observations = dataset.monthlyPassengerLoadFactors.filter(isValidObservation);
        return {
            available: true,
            source: 'DGCA-DATA.pdf',
            report: dataset.report,
            monthlyPassengerLoadFactors: observations,
            fareObservations: dataset.fareObservations,
            fareAnalysisMessage: dataset.fareObservations.length
                ? INSUFFICIENT_DGCA_DATA_MESSAGE
                : INSUFFICIENT_DGCA_DATA_MESSAGE,
        };
    }
    catch {
        return unavailableResponse();
    }
}
