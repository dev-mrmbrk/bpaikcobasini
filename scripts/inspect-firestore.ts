import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { initializeApp } from 'firebase/app';
import {
  collection,
  getCountFromServer,
  getFirestore
} from 'firebase/firestore';

const configPath = fileURLToPath(
  new URL('../firebase-applet-config.json', import.meta.url)
);

const config = JSON.parse(readFileSync(configPath, 'utf8'));

const app = initializeApp(config, 'bpaik-firestore-audit');
const db = getFirestore(app, config.firestoreDatabaseId);

const collections = [
  'users',
  'events',
  'attendanceRecords',
  'leaveRequests',
  'auditLogs'
];

async function main() {
  console.log('\n========== AUDIT DATA FIRESTORE BPAIK ==========\n');

  let failed = false;

  for (const name of collections) {
    try {
      const snapshot = await getCountFromServer(collection(db, name));
      console.log(`${name}: ${snapshot.data().count} dokumen`);
    } catch (error) {
      failed = true;
      const message = error instanceof Error
        ? error.message
        : 'Kesalahan tidak diketahui';

      console.error(`${name}: GAGAL MEMBACA (${message})`);
    }
  }

  console.log('\nPemeriksaan selesai. Tidak ada data yang diubah.');

  if (failed) {
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  console.error(
    'Audit gagal:',
    error instanceof Error ? error.message : error
  );
  process.exitCode = 1;
});
