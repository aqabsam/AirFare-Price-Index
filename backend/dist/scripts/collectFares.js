import { collectFareSnapshots } from '../services/fareCollector.js';
import { fareStore } from '../services/fareStore.js';
async function main() {
    const snapshots = await collectFareSnapshots();
    fareStore.replaceSnapshots(snapshots);
    await fareStore.persist();
    console.log(`Collected ${snapshots.length} fare snapshots`);
}
void main().catch((error) => {
    console.error(error);
    process.exit(1);
});
