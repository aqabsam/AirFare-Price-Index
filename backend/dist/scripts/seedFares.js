import { fareStore } from '../services/fareStore.js';
async function main() {
    await fareStore.load();
    await fareStore.persist();
    console.log(`Seeded ${fareStore.getSnapshots().length} fare snapshots`);
}
void main().catch((error) => {
    console.error(error);
    process.exit(1);
});
