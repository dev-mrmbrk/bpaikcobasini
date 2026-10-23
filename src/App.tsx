import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LoginScreen } from './components/LoginScreen';
import { PegawaiView } from './components/PegawaiView';
import { AdminPortal } from './components/AdminPortal';
import { ProjectorQrView } from './components/ProjectorQrView';
import { QrScannerModal } from './components/QrScannerModal';
import { AttendanceSuccessModal } from './components/AttendanceSuccessModal';
import { SignaturePadModal } from './components/SignaturePadModal';
import { BPAIKEvent, AttendanceRecord, BPAIKUser, AuditLog } from './types';
import { db } from './firebase';
import { collection, onSnapshot } from 'firebase/firestore';

const todayYmd = new Date().toISOString().split('T')[0];
const DEFAULT_EVENTS: BPAIKEvent[] = [
  {
    id: 'ev_kajian_rutin_tarjih',
    title: 'Kajian Rutin Tarjih & Pembinaan Civitas Akademika',
    description: 'Kajian rutin pendalaman Fiqih Ibadah Praktis sesuai HPT Muhammadiyah, pembinaan akhlaqul karimah, serta penguatan komitmen civitas akademika Universitas \'Aisyiyah Bandung dalam menegakkan nilai-nilai Al-Islam dan Kemuhammadiyahan di lingkungan kerja.',
    startDateTime: `${todayYmd}T08:30`,
    endDateTime: `${todayYmd}T11:45`,
    date: todayYmd,
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
    id: 'ev_baitul_arqam_2026',
    title: 'Baitul Arqam Dosen & Tenaga Kependidikan Angkatan VIII',
    description: 'Penguatan Ideologi Al-Islam dan Kemuhammadiyahan bagi civitas akademika Universitas \'Aisyiyah Bandung di era transformasi digital.',
    startDateTime: `${todayYmd}T07:30`,
    endDateTime: `${todayYmd}T17:00`,
    date: todayYmd,
    startTime: '07:30',
    endTime: '17:00',
    location: 'Auditorium KH. Ahmad Dahlan, Gedung Rektorat Lt. 4',
    createdBy: 'admin.bpaik@unisa-bandung.ac.id',
    creatorName: 'Admin Utama BPAIK',
    status: 'dijadwalkan',
    sessionDurationMinutes: 90,
    sessionStatus: 'belum_dibuka',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

const DEFAULT_EMPLOYEES: BPAIKUser[] = [
  {
    id: 'admin_bpaik',
    email: 'admin.bpaik@unisa-bandung.ac.id',
    name: 'Admin Utama BPAIK',
    npp: 'NPP. 0422019800',
    jabatan: 'Administrator BPAIK',
    whatsapp: '081223344550',
    role: 'ADMIN',
    status: 'aktif'
  },
  {
    id: 'peserta_hamzah',
    email: 'peserta.bpaik@gmail.com',
    name: 'Dr. H. Hamzah Arifin, M.Ag.',
    npp: 'NPP. 0415038102',
    jabatan: 'Dosen / Peserta Kajian',
    whatsapp: '081234567890',
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80',
    role: 'PESERTA',
    qrUniqueCode: 'BPAIK-KARTU-0415038102-HAMZAH',
    status: 'aktif'
  }
];

// Always scroll to top when route changes: "buka antar halaman mulai dari atas"
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [pathname]);
  return null;
}

// Proyektor Route Page Component
function ProyektorRouteView({ events }: { events: BPAIKEvent[] }) {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const targetEvent = events.find(e => e.id === eventId);

  if (!targetEvent) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-6 text-center">
        <h2 className="text-xl font-bold font-islamic mb-2">Kegiatan Tidak Ditemukan</h2>
        <p className="text-xs text-slate-400 mb-6">Agenda kegiatan dengan ID "{eventId}" tidak terdaftar di sistem.</p>
        <button
          onClick={() => navigate('/kegiatan')}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-xs font-bold cursor-pointer"
        >
          Kembali ke Jadwal Kegiatan
        </button>
      </div>
    );
  }

  return (
    <ProjectorQrView
      event={targetEvent}
      onBack={() => navigate('/kegiatan')}
    />
  );
}

function MainAppContent() {
  const { bpaikUser, isLoading, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Firestore collections state with rich defaults
  const [events, setEvents] = useState<BPAIKEvent[]>(DEFAULT_EVENTS);
  const [employees, setEmployees] = useState<BPAIKUser[]>(DEFAULT_EMPLOYEES);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  // Modals & Flows
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [justScannedRecord, setJustScannedRecord] = useState<AttendanceRecord | null>(null);
  const [recordForSignature, setRecordForSignature] = useState<AttendanceRecord | null>(null);

  // User login landing route enforcement:
  // "setiap login, masuknya ke dashboard dlu, atau beranda buat user"
  const prevUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!bpaikUser) {
      prevUserIdRef.current = null;
      return;
    }

    const isFirstLogin = prevUserIdRef.current !== bpaikUser.id;
    prevUserIdRef.current = bpaikUser.id;

    const currentPath = location.pathname;

    if (isFirstLogin || currentPath === '/' || currentPath === '') {
      if (bpaikUser.role === 'ADMIN') {
        navigate('/dashboard', { replace: true });
      } else {
        navigate('/beranda', { replace: true });
      }
    }
  }, [bpaikUser, navigate, location.pathname]);

  // Sync Events
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'events'), (snapshot) => {
      const list: BPAIKEvent[] = [];
      snapshot.forEach(doc => list.push({ ...(doc.data() as BPAIKEvent), id: doc.id }));
      list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      if (list.length > 0) setEvents(list);
    }, (err) => console.warn('Events sync notice (using defaults if offline):', err.message));
    return () => unsub();
  }, []);

  // Sync Employees
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'users'), (snapshot) => {
      const list: BPAIKUser[] = [];
      snapshot.forEach(doc => list.push({ ...(doc.data() as BPAIKUser), id: doc.id }));
      list.sort((a, b) => a.name.localeCompare(b.name));
      if (list.length > 0) setEmployees(list);
    }, (err) => console.warn('Users sync notice (using defaults if offline):', err.message));
    return () => unsub();
  }, []);

  // Sync Attendance Records
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'attendanceRecords'), (snapshot) => {
      const list: AttendanceRecord[] = [];
      snapshot.forEach(doc => list.push({ ...(doc.data() as AttendanceRecord), id: doc.id }));
      list.sort((a, b) => new Date(b.scanTime).getTime() - new Date(a.scanTime).getTime());
      setAttendanceRecords(list);
    }, (err) => console.warn('Attendance sync notice:', err.message));
    return () => unsub();
  }, []);

  // Sync Audit Logs
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'auditLogs'), (snapshot) => {
      const list: AuditLog[] = [];
      snapshot.forEach(doc => list.push({ ...(doc.data() as AuditLog), id: doc.id }));
      list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setAuditLogs(list);
    }, (err) => console.warn('Audit sync notice:', err.message));
    return () => unsub();
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="w-12 h-12 rounded-2xl bg-emerald-700 text-white flex items-center justify-center font-bold text-lg animate-bounce shadow-md">
          BP
        </div>
        <p className="mt-3 text-xs font-semibold text-emerald-900">Memuat Sistem Absensi BPAIK...</p>
        <p className="text-[11px] text-slate-400">Universitas 'Aisyiyah Bandung</p>
      </div>
    );
  }

  if (!bpaikUser) {
    return <LoginScreen />;
  }

  // Active events for scanner (strictly events where sessionStatus === 'aktif')
  const activeEvents = events.filter(e => e.sessionStatus === 'aktif');

  return (
    <div className="min-h-screen bg-slate-100 font-sans antialiased text-slate-900">
      <ScrollToTop />

      <Routes>
        {/* Proyektor Screen dedicated route */}
        <Route path="/proyektor/:eventId" element={<ProyektorRouteView events={events} />} />

        {/* Admin and Peserta Multi-page Routes */}
        <Route
          path="*"
          element={
            bpaikUser.role === 'ADMIN' ? (
              <AdminPortal
                currentUser={bpaikUser}
                events={events}
                employees={employees}
                attendanceRecords={attendanceRecords}
                auditLogs={auditLogs}
                onOpenProjectorQr={(event) => navigate(`/proyektor/${event.id}`)}
                onRefreshData={() => {}}
                onLogout={logout}
              />
            ) : (
              <PegawaiView
                user={bpaikUser}
                events={events}
                attendanceRecords={attendanceRecords}
                onOpenScanner={() => setIsScannerOpen(true)}
                onOpenSignPad={(record) => setRecordForSignature(record)}
                onLogout={logout}
              />
            )
          }
        />
      </Routes>

      {/* QR SCANNER MODAL */}
      {isScannerOpen && (
        <QrScannerModal
          user={bpaikUser}
          activeEvents={activeEvents}
          onAttendanceRecorded={(record) => {
            setIsScannerOpen(false);
            setJustScannedRecord(record);
          }}
          onClose={() => setIsScannerOpen(false)}
        />
      )}

      {/* ATTENDANCE SUCCESS CONFIRMATION MODAL (Step 1 mandatory popup) */}
      {justScannedRecord && (
        <AttendanceSuccessModal
          record={justScannedRecord}
          onProceedToSign={() => {
            const rec = justScannedRecord;
            setJustScannedRecord(null);
            setRecordForSignature(rec);
          }}
        />
      )}

      {/* DIGITAL SIGNATURE ARTBOARD MODAL (Step 2 mandatory signature) */}
      {recordForSignature && (
        <SignaturePadModal
          record={recordForSignature}
          onSuccess={() => {
            setRecordForSignature(null);
          }}
          onClose={() => setRecordForSignature(null)}
        />
      )}
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <MainAppContent />
      </AuthProvider>
    </BrowserRouter>
  );
}
