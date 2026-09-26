const logs = [];
export function startCollectionLog(trigger, source) {
    const log = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        startedAt: new Date().toISOString(),
        finishedAt: null,
        trigger,
        status: 'running',
        source,
        records: 0,
        message: null,
    };
    logs.unshift(log);
    logs.splice(20);
    return log;
}
export function finishCollectionLog(log, result) {
    Object.assign(log, { ...result, finishedAt: new Date().toISOString() });
}
export function getCollectionLogs() {
    return logs.map((log) => ({ ...log }));
}
