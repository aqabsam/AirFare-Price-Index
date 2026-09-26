import { fareStore } from './fareStore.js';
function outlierCount(values) {
    if (values.length < 4)
        return 0;
    const sorted = [...values].sort((left, right) => left - right);
    const q1 = sorted[Math.floor(sorted.length * 0.25)] ?? 0;
    const q3 = sorted[Math.floor(sorted.length * 0.75)] ?? 0;
    const limit = q3 + (q3 - q1) * 1.5;
    return values.filter((value) => value > limit).length;
}
export function calculateDataQuality() {
    const snapshots = fareStore.getSnapshots();
    const rejectedSnapshots = fareStore.getRejectedSnapshots();
    const seen = new Set();
    let duplicateRecords = 0;
    let missingFieldRecords = 0;
    for (const snapshot of snapshots) {
        const key = [snapshot.routeKey, snapshot.airlineCode, snapshot.flightNumber, snapshot.departureTime].join('|');
        if (seen.has(key))
            duplicateRecords += 1;
        seen.add(key);
        if (!snapshot.origin || !snapshot.destination || !snapshot.departureDate || !snapshot.airline || !snapshot.price) {
            missingFieldRecords += 1;
        }
    }
    const allRecords = [...snapshots, ...rejectedSnapshots];
    const qualityBySource = Object.fromEntries([...new Set(allRecords.map((snapshot) => snapshot.sourceType))].map((sourceType) => {
        const records = allRecords.filter((snapshot) => snapshot.sourceType === sourceType);
        const scores = records.map((snapshot) => snapshot.dataQualityScore).filter((score) => score !== null && score !== undefined);
        return [sourceType, { records: records.length, averageScore: scores.length ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length) : null }];
    }));
    const scores = allRecords.map((snapshot) => snapshot.dataQualityScore).filter((score) => score !== null && score !== undefined);
    return {
        rawRecords: allRecords.length,
        cleanedRecords: snapshots.length,
        duplicateRecords,
        outlierRecords: outlierCount(snapshots.map((snapshot) => snapshot.price)),
        missingFieldRecords,
        soldOutRecords: allRecords.filter((snapshot) => snapshot.soldOut || snapshot.seatsRemaining <= 0).length,
        unknownAvailabilityRecords: snapshots.filter((snapshot) => snapshot.seatsRemaining <= 0).length,
        rejectedRecords: rejectedSnapshots.length,
        averageQualityScore: scores.length ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length) : null,
        qualityBySource,
        message: 'Quality metrics are calculated from accepted and rejected normalized collection records.',
    };
}
