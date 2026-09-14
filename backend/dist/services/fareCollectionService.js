import { collectFareSnapshots } from './fareCollector.js';
import { fareStore } from './fareStore.js';
const currentState = {
    status: 'idle',
    trigger: 'startup',
    startedAt: null,
    finishedAt: null,
    sourceCount: fareStore.getSnapshots().length,
    snapshotCount: fareStore.getSnapshots().length,
    message: null,
};
let activeRun = null;
function updateState(next) {
    Object.assign(currentState, next);
}
export function getFareCollectionStatus() {
    return { ...currentState };
}
export async function collectAndStoreFareSnapshots(trigger) {
    if (activeRun) {
        return activeRun;
    }
    const startedAt = new Date().toISOString();
    updateState({
        status: 'running',
        trigger,
        startedAt,
        finishedAt: null,
        message: null,
    });
    activeRun = (async () => {
        try {
            const snapshots = await collectFareSnapshots();
            if (!snapshots.length) {
                throw new Error('No live fares were collected. Configure real airline or OTA sources before running the pipeline.');
            }
            fareStore.replaceSnapshots(snapshots);
            await fareStore.persist();
            updateState({
                status: 'success',
                finishedAt: new Date().toISOString(),
                sourceCount: new Set(snapshots.map((snapshot) => snapshot.source)).size,
                snapshotCount: snapshots.length,
                message: `Collected ${snapshots.length} fare snapshots`,
            });
        }
        catch (error) {
            updateState({
                status: 'error',
                finishedAt: new Date().toISOString(),
                message: error instanceof Error ? error.message : 'Unable to collect fare snapshots',
            });
            throw error;
        }
        finally {
            activeRun = null;
        }
    })();
    return activeRun;
}
