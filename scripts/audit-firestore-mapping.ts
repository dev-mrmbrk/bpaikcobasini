import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { initializeApp } from 'firebase/app';
import {
  collection,
  getDocs,
  getFirestore
} from 'firebase/firestore';

type Row = Record<string, unknown> & { id: string };

const configPath = fileURLToPath(
  new URL('../firebase-applet-config.json', import.meta.url)
);
const config = JSON.parse(readFileSync(configPath, 'utf8'));
const app = initializeApp(config, 'bpaik-mapping-audit');
const db = getFirestore(app, config.firestoreDatabaseId);

const issues: string[] = [];

function requiredFields(
  collectionName: string,
  rows: Row[],
  fields: string[]
) {
  for (const row of rows) {
    for (const field of fields) {
      const value = row[field];
      if (value === undefined || value === null || value === '') {
        issues.push(
          `${collectionName}/${row.id}: field wajib kosong "${field}"`
        );
      }
    }
  }
}

function allowedValues(
  collectionName: string,
  rows: Row[],
  field: string,
  values: string[]
) {
  for (const row of rows) {
    if (!values.includes(String(row[field]))) {
      issues.push(
        `${collectionName}/${row.id}: nilai "${field}" tidak valid`
      );
    }
  }
}

function duplicateValues(rows: Row[], field: string) {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  for (const row of rows) {
    const value = String(row[field] ?? '').trim().toLowerCase();
    if (!value) continue;

    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  }

  return duplicates.size;
}

async function main() {
  const fetchCollection = async (name: string): Promise<Row[]> => {
    const snapshot = await getDocs(collection(db, name));
    return snapshot.docs.map((doc) => ({
      ...doc.data(),
      id: doc.id
    })) as Row[];
  };

  const users = await fetchCollection('users');
  const events = await fetchCollection('events');
  const attendance = await fetchCollection('attendanceRecords');
  const leaves = await fetchCollection('leaveRequests');
  const auditLogs = await fetchCollection('auditLogs');

  console.log('\n========== AUDIT KOMPATIBILITAS D1 ==========');
  console.log('Jumlah dokumen:');
  console.log(`users: ${users.length}`);
  console.log(`events: ${events.length}`);
  console.log(`attendanceRecords: ${attendance.length}`);
  console.log(`leaveRequests: ${leaves.length}`);
  console.log(`auditLogs: ${auditLogs.length}`);

  requiredFields('users', users, [
    'email', 'name', 'npp', 'jabatan', 'whatsapp',
    'role', 'status', 'createdAt', 'updatedAt'
  ]);
  allowedValues('users', users, 'role', ['ADMIN', 'PESERTA']);
  allowedValues('users', users, 'status', ['aktif', 'nonaktif']);

  if (duplicateValues(users, 'email') > 0) {
    issues.push('users: ditemukan email duplikat setelah normalisasi');
  }
  if (duplicateValues(users, 'qrUniqueCode') > 0) {
    issues.push('users: ditemukan qrUniqueCode duplikat');
  }

  requiredFields('events', events, [
    'title', 'description', 'startDateTime', 'endDateTime',
    'date', 'startTime', 'endTime', 'location',
    'createdBy', 'creatorName', 'status',
    'sessionDurationMinutes', 'sessionStatus',
    'createdAt', 'updatedAt'
  ]);
  allowedValues(
    'events', events, 'status',
    ['dijadwalkan', 'berlangsung', 'selesai', 'dibatalkan']
  );
  allowedValues(
    'events', events, 'sessionStatus',
    ['belum_dibuka', 'aktif', 'ditutup']
  );

  for (const event of events) {
    if (
      typeof event.sessionDurationMinutes !== 'number' ||
      event.sessionDurationMinutes <= 0
    ) {
      issues.push(`events/${event.id}: durasi sesi harus angka positif`);
    }
  }

  requiredFields('attendanceRecords', attendance, [
    'eventId', 'userId', 'eventDate', 'scanTime',
    'attendanceStatus', 'signatureStatus'
  ]);
  requiredFields('leaveRequests', leaves, [
    'userId', 'eventId', 'eventDate', 'reason', 'status'
  ]);
  requiredFields('auditLogs', auditLogs, [
    'action', 'actorEmail', 'actorName', 'actorRole',
    'targetType', 'targetId', 'description', 'timestamp'
  ]);

  if (issues.length) {
    console.log(`\nDITEMUKAN ${issues.length} MASALAH:`);
    for (const issue of issues) console.log(`- ${issue}`);
    console.log('\nPerbaiki atau tentukan pemetaan untuk masalah ini sebelum impor.');
    process.exitCode = 1;
  } else {
    console.log('\nLULUS: field wajib dan batasan utama cocok dengan skema D1.');
    console.log('Belum ada data yang diimpor atau diubah.');
  }
}

main().catch((error: unknown) => {
  console.error(
    'Audit gagal:',
    error instanceof Error ? error.message : 'Kesalahan tidak diketahui'
  );
  process.exitCode = 1;
});
