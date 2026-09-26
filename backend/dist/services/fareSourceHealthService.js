import { fareStore } from './fareStore.js';
const STALE_AFTER_MS = 12 * 60 * 60 * 1000;
function normalizeKey(value) {
    return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
}
function sourceIdentityCandidates(source) {
    return [source.id, source.name].filter((value) => Boolean(value)).map(normalizeKey);
}
function snapshotIdentityCandidates(snapshot) {
    return [snapshot.sourceId, snapshot.source].filter((value) => Boolean(value)).map(normalizeKey);
}
function latestSnapshotTimestamp(values) {
    const newest = values.reduce((latest, current) => {
        if (!latest) {
            return current.collectedAt;
        }
        return current.collectedAt > latest ? current.collectedAt : latest;
    }, '');
    return newest || null;
}
function deriveStatus(lastCollectedAt) {
    if (!lastCollectedAt) {
        return 'empty';
    }
    const age = Date.now() - new Date(lastCollectedAt).getTime();
    if (Number.isFinite(age) && age > STALE_AFTER_MS) {
        return 'stale';
    }
    return 'live';
}
function normalizeApprovedAirline(name, code) {
    const normalizedName = name.trim().toLowerCase().replace(/[^a-z]/g, '');
    const normalizedCode = code.trim().toUpperCase();
    if (normalizedCode === '6E' || normalizedName === 'indigo' || normalizedName === 'indigoairlines')
        return 'IndiGo';
    if (normalizedCode === 'G8' || normalizedName === 'goair' || normalizedName === 'gofirst')
        return 'GoAir';
    if (normalizedCode === 'AI' || normalizedName === 'airindia')
        return 'Air India';
    if (normalizedCode === 'QP' || normalizedName === 'akasa' || normalizedName === 'akasaair')
        return 'Akasa Air';
    if (normalizedCode === 'SG' || normalizedName === 'spicejet')
        return 'SpiceJet';
    return null;
}
export async function calculateFareSourceHealth() {
    const snapshots = fareStore.getSnapshots();
    const configs = [...new Map(snapshots
            .filter((snapshot) => snapshot.sourceType !== 'demo' && snapshot.sourceType !== 'aggregated' && normalizeApprovedAirline(snapshot.airline, snapshot.airlineCode))
            .map((snapshot) => [snapshot.sourceId ?? snapshot.source, {
                id: snapshot.sourceId ?? snapshot.source,
                name: snapshot.source,
                sourceType: snapshot.sourceType,
                kind: snapshot.sourceType === 'duffel' ? 'api' : 'page',
                url: snapshot.sourceType === 'duffel' ? 'https://api.duffel.com' : '',
            }])).values()];
    const sources = configs.map((source) => {
        const sourceKeys = sourceIdentityCandidates(source);
        const matchingSnapshots = snapshots.filter((snapshot) => {
            const snapshotKeys = snapshotIdentityCandidates(snapshot);
            return sourceKeys.some((key) => snapshotKeys.includes(key));
        });
        const lastCollectedAt = latestSnapshotTimestamp(matchingSnapshots);
        return {
            id: source.id,
            name: source.name,
            sourceType: source.sourceType,
            kind: source.kind,
            url: source.url ?? '',
            routeCount: 0,
            bookingWindows: [],
            snapshotCount: matchingSnapshots.length,
            lastCollectedAt,
            status: deriveStatus(lastCollectedAt),
        };
    });
    const liveCount = sources.filter((source) => source.status === 'live').length;
    const staleCount = sources.filter((source) => source.status === 'stale').length;
    const emptyCount = sources.filter((source) => source.status === 'empty').length;
    return {
        sources,
        liveCount,
        staleCount,
        emptyCount,
    };
}
