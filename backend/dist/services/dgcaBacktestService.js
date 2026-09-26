import { getDgcaAnalytics, INSUFFICIENT_DGCA_DATA_MESSAGE } from './dgcaAnalyticsService.js';
export async function calculateDgcaBacktest(windowDays = 30) {
    const dataset = await getDgcaAnalytics();
    return {
        available: false,
        windowDays,
        sampleCount: dataset.fareObservations.length,
        mae: null,
        rmse: null,
        mape: null,
        correlation: null,
        message: INSUFFICIENT_DGCA_DATA_MESSAGE,
    };
}
