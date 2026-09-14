import { loadFareSourceConfigs } from '../config/fareSources.js';
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
export async function calculateFareSourceHealth() {
    const configs = await loadFareSourceConfigs();
    const snapshots = fareStore.getSnapshots();
    const sources = configs.map((source) => {
        const sourceKeys = sourceIdentityCandidates(source);
        const matchingSnapshots = snapshots.filter((snapshot) => {
            const snapshotKeys = snapshotIdentityCandidates(snapshot);
            return sourceKeys.some((key) => snapshotKeys.includes(key));
        });
        const lastCollectedAt = latestSnapshotTimestamp(matchingSnapshots);
        return {
            id: source.id ?? normalizeKey(source.name),
            name: source.name,
            sourceType: source.sourceType,
            kind: source.kind ?? 'page',
            url: source.url ?? '',
            routeCount: source.routes?.length ?? 0,
            bookingWindows: source.bookingWindows ?? [],
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
