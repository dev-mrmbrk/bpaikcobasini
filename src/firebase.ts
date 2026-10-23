import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { 
  getFirestore, 
  doc, 
  getDocFromServer, 
  collection, 
  getDocs, 
  setDoc, 
  getDoc, 
  updateDoc, 
  query, 
  where, 
  orderBy,
  onSnapshot
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import { BPAIKUser, BPAIKEvent } from './types';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account'
});

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error:', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Test connection on boot
export async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'users', 'connection-check'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn("Firestore client is offline or starting up.");
    }
  }
}
testConnection();

// Initial database seeding with BPAIK 2 authorized roles: ADMIN and PESERTA
export async function seedInitialData() {
  try {
    // Exactly 2 demo accounts: 1 ADMIN and 1 USER/PESERTA
    const officialUsers: BPAIKUser[] = [
      {
        id: 'admin_bpaik',
        email: 'admin.bpaik@unisa-bandung.ac.id',
        name: 'Admin Utama BPAIK',
        npp: 'NPP. 0422019800',
        jabatan: 'Administrator BPAIK',
        whatsapp: '081223344550',
        role: 'ADMIN',
        status: 'aktif',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'peserta_hamzah',
        email: 'peserta.bpaik@gmail.com', // Email pribadi (bukan email kampus)
        name: 'Dr. H. Hamzah Arifin, M.Ag.',
        npp: 'NPP. 0415038102',
        jabatan: 'Dosen / Peserta Kajian',
        whatsapp: '081234567890',
        avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80',
        role: 'PESERTA',
        qrUniqueCode: 'BPAIK-KARTU-0415038102-HAMZAH',
        status: 'aktif',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ];

    for (const user of officialUsers) {
      try {
        const userRef = doc(db, 'users', user.id);
        await setDoc(userRef, user, { merge: true });
      } catch (err) {
        console.warn(`Seed user notice for ${user.id}:`, err);
      }
    }

    // Also support bootstrapped Google emails as Admin
    const bootstrapAdmins = ['ridhwanmujahidin01@gmail.com', 'eungeunyoon@gmail.com', 'ridhwan.mbrk@gmail.com'];
    for (const email of bootstrapAdmins) {
      try {
        const q = query(collection(db, 'users'), where('email', '==', email));
        const snap = await getDocs(q);
        if (snap.empty) {
          const id = 'user_admin_' + email.replace(/[^a-zA-Z0-9]/g, '_');
          await setDoc(doc(db, 'users', id), {
            id,
            email,
            name: email === 'ridhwanmujahidin01@gmail.com' ? 'Ridhwan Mujahidin (Admin BPAIK)' : (email === 'eungeunyoon@gmail.com' ? 'Admin BPAIK (Eungeun)' : 'Ridhwan Mubarak, S.Ag., M.Ag.'),
            npp: 'NPP. 0422019800',
            jabatan: 'Administrator BPAIK',
            whatsapp: '081223344550',
            role: 'ADMIN',
            status: 'aktif',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          });
        }
      } catch (err) {
        console.warn(`Seed bootstrap admin notice for ${email}:`, err);
      }
    }

    // Ensure sample events with startDateTime, endDateTime, long description, and duration
    try {
      const eventsRef = collection(db, 'events');
      const eventsSnap = await getDocs(eventsRef);
      if (eventsSnap.empty) {
        const today = new Date();
        const todayYMD = today.toISOString().split('T')[0];
        const nextDay = new Date(today.getTime() + 86400000 * 3);
        const nextDayYMD = nextDay.toISOString().split('T')[0];

        const initialEvents: BPAIKEvent[] = [
          {
            id: 'ev_kajian_rutin_tarjih',
            title: 'Kajian Rutin Tarjih & Pembinaan Civitas Akademika',
            description: 'Kajian rutin pendalaman Fiqih Ibadah Praktis sesuai HPT Muhammadiyah, pembinaan akhlaqul karimah, serta penguatan komitmen civitas akademika Universitas \'Aisyiyah Bandung dalam menegakkan nilai-nilai Al-Islam dan Kemuhammadiyahan di lingkungan kerja.',
            startDateTime: `${todayYMD}T08:30`,
            endDateTime: `${todayYMD}T11:45`,
            date: todayYMD,
            startTime: '08:30',
            endTime: '11:45',
            location: 'Masjid Kampus Utama Universitas \'Aisyiyah Bandung & Hall Ahmad Dahlan',
            createdBy: 'admin.bpaik@unisa-bandung.ac.id',
            creatorName: 'Admin Utama BPAIK',
            status: 'berlangsung',
            sessionDurationMinutes: 60,
            sessionStatus: 'aktif',
            sessionOpenedAt: new Date().toISOString(),
            sessionClosedAt: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          },
          {
            id: 'ev_baitul_arqam_dosen',
            title: 'Baitul Arqam Dosen & Tenaga Kependidikan Angkatan VIII',
            description: 'Program intensif pengkaderan dan pembinaan ideologi Persyarikatan Muhammadiyah dan \'Aisyiyah. Meliputi materi Manhaj Gerakan Muhammadiyah, PHIWM dalam Kehidupan Kampus, serta strategi integrasi nilai keislaman dalam kurikulum pengajaran dan pelayanan akademik.',
            startDateTime: `${nextDayYMD}T07:30`,
            endDateTime: `${nextDayYMD}T17:00`,
            date: nextDayYMD,
            startTime: '07:30',
            endTime: '17:00',
            location: 'Auditorium Gedung KH. Ahmad Dahlan, Lantai 4',
            createdBy: 'admin.bpaik@unisa-bandung.ac.id',
            creatorName: 'Admin Utama BPAIK',
            status: 'dijadwalkan',
            sessionDurationMinutes: 90,
            sessionStatus: 'belum_dibuka',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }
        ];

        for (const ev of initialEvents) {
          try {
            await setDoc(doc(db, 'events', ev.id), ev);
          } catch (e) {
            console.warn(`Seed event ${ev.id} notice:`, e);
          }
        }
      }
    } catch (e) {
      console.warn("Notice reading events during seed:", e);
    }
  } catch (err) {
    console.warn("Initial data seed notice:", err);
  }
}
