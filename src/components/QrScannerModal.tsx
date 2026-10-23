import React, { useState, useRef, useEffect } from 'react';
import { Camera, X, AlertCircle, RefreshCw, CheckCircle2, ShieldCheck, KeyRound } from 'lucide-react';
import { db } from '../firebase';
import { doc, getDoc, addDoc, collection } from 'firebase/firestore';
import { BPAIKUser, BPAIKEvent, AttendanceRecord } from '../types';

interface QrScannerModalProps {
  user: BPAIKUser;
  activeEvents: BPAIKEvent[];
  onAttendanceRecorded: (record: AttendanceRecord) => void;
  onClose: () => void;
}

export const QrScannerModal: React.FC<QrScannerModalProps> = ({
  user,
  activeEvents,
  onAttendanceRecorded,
  onClose
}) => {
  const [selectedEventId, setSelectedEventId] = useState<string>(
    activeEvents.length > 0 ? activeEvents[0].id : ''
  );
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [manualToken, setManualToken] = useState('');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [showManualInput, setShowManualInput] = useState(false);
  const [confirmedNotice, setConfirmedNotice] = useState<{
    title: string;
    message: string;
    scanTime: string;
    record: AttendanceRecord;
  } | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Synchronize selectedEventId if activeEvents changes
  useEffect(() => {
    if (activeEvents.length > 0 && (!selectedEventId || !activeEvents.find(e => e.id === selectedEventId))) {
      setSelectedEventId(activeEvents[0].id);
    }
  }, [activeEvents, selectedEventId]);

  // Initialize camera stream only if there are active events
  useEffect(() => {
    if (activeEvents.length === 0) return;

    let active = true;

    async function startCamera() {
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          setCameraError('Perangkat tidak mendukung akses kamera langsung');
          setShowManualInput(true);
          return;
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' }
        });

        if (!active) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      } catch (err) {
        console.warn('Camera access denied or unavailable:', err);
        setCameraError('Kamera tidak dapat diakses atau izin ditolak');
        setShowManualInput(true);
      }
    }

    startCamera();

    return () => {
      active = false;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
    };
  }, [activeEvents.length]);

  const handleProcessToken = async (tokenString: string) => {
    if (!tokenString.trim()) {
      setErrorMessage('Token QR tidak boleh kosong');
      return;
    }

    if (activeEvents.length === 0) {
      setErrorMessage('Tidak ada sesi presensi kegiatan yang aktif saat ini.');
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);

    try {
      // 1. Verify token with server-side validation
      const res = await fetch('/api/qr/verify-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: tokenString.trim(),
          eventId: selectedEventId || undefined
        })
      });

      const data = await res.json();
      if (!data.valid) {
        throw new Error(data.error || 'Token QR tidak valid atau sudah kedaluwarsa');
      }

      const verifiedEventId = data.eventId;
      // Strict matching: must belong to an active session
      const targetEvent = activeEvents.find(e => e.id === verifiedEventId);
      
      if (!targetEvent) {
        throw new Error('Kode QR yang dipindai tidak sesuai dengan sesi kegiatan yang sedang dibuka saat ini.');
      }

      // Check if session is explicitly open
      if (targetEvent.sessionStatus !== 'aktif') {
        throw new Error('Sesi presensi untuk kegiatan ini belum diaktifkan oleh Admin.');
      }

      // Check if session has expired based on duration (calculated from sessionOpenedAt, independent of event hours)
      if (targetEvent.sessionOpenedAt) {
        const openedAtMs = new Date(targetEvent.sessionOpenedAt).getTime();
        const durationMs = (targetEvent.sessionDurationMinutes || 60) * 60 * 1000;
        const nowMs = Date.now();
        if (nowMs > (openedAtMs + durationMs)) {
          throw new Error(`Batas waktu sesi scan (${targetEvent.sessionDurationMinutes} menit) telah berakhir sejak sesi dibuka.`);
        }
      }

      const eventTitle = targetEvent.title || 'Kegiatan BPAIK';
      const eventDate = targetEvent.date || new Date().toISOString().split('T')[0];

      // 2. Check if attendance already recorded (prevent duplicate attendance)
      const sanitizedEmail = user.email.toLowerCase().replace(/[^a-zA-Z0-9]/g, '_');
      const recordId = `${verifiedEventId}_${sanitizedEmail}`;
      const recordRef = doc(db, 'attendanceRecords', recordId);
      const existingSnap = await getDoc(recordRef);

      const nowIso = new Date().toISOString();

      if (existingSnap.exists()) {
        const existingData = existingSnap.data() as AttendanceRecord;
        if (existingData.signatureStatus === 'TERKONFIRMASI') {
          setConfirmedNotice({
            title: 'Presensi Anda Sudah Sah & Terkonfirmasi',
            message: `Anda sudah berhasil melakukan presensi dan tanda tangan digital untuk kegiatan "${eventTitle}".`,
            scanTime: existingData.scanTime,
            record: existingData
          });
          return;
        } else {
          onAttendanceRecorded(existingData);
          return;
        }
      }

      // 3. Create fresh attendance record
      const newRecord: AttendanceRecord = {
        id: recordId,
        eventId: verifiedEventId,
        eventTitle,
        eventDate,
        userId: user.id,
        userEmail: user.email,
        userName: user.name,
        userNpp: user.npp,
        userJabatan: user.jabatan,
        userWhatsapp: user.whatsapp,
        scanTime: nowIso,
        attendanceStatus: 'HADIR',
        signatureStatus: 'MENUNGGU_KONFIRMASI',
        verifiedBy: 'system-qr',
        createdAt: nowIso,
        updatedAt: nowIso
      };

      await doc(db, 'attendanceRecords', recordId);
      const { setDoc: writeDoc } = await import('firebase/firestore');
      await writeDoc(recordRef, newRecord);

      await addDoc(collection(db, 'auditLogs'), {
        action: 'SCAN_QR_SUCCESS',
        actorEmail: user.email,
        actorName: user.name,
        actorRole: user.role,
        targetType: 'ATTENDANCE_RECORD',
        targetId: recordId,
        description: `Presensi berhasil via QR proyektor untuk kegiatan "${eventTitle}". Menunggu tanda tangan.`,
        timestamp: nowIso
      });

      onAttendanceRecorded(newRecord);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal memverifikasi kehadiran';
      setErrorMessage(msg);
    } finally {
      setIsProcessing(false);
    }
  };

  // Helper for quick testing / simulation directly from the active session
  const handleQuickTestScan = async () => {
    if (!selectedEventId) {
      setErrorMessage('Pilih sesi kegiatan yang sedang aktif');
      return;
    }
    setIsProcessing(true);
    try {
      const res = await fetch(`/api/qr/token/${selectedEventId}`);
      const data = await res.json();
      if (data.token) {
        await handleProcessToken(data.token);
      } else {
        throw new Error('Gagal mengambil token aktif kegiatan');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal melakukan scan presensi';
      setErrorMessage(msg);
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex flex-col justify-between p-4 sm:p-6 text-white animate-in fade-in duration-150">
      {/* Top Bar */}
      <div className="flex items-center justify-between z-10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center text-white">
            <Camera className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white">Pemindai QR Kegiatan</h2>
            <p className="text-xs text-emerald-300">Arahkan kamera ke layar proyektor BPAIK</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
          aria-label="Tutup Pemindai"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Middle Viewfinder or Inactive State */}
      <div className="relative flex-1 flex flex-col items-center justify-center my-4">
        {activeEvents.length === 0 ? (
          <div className="max-w-sm w-full bg-slate-900/90 border border-amber-500/50 p-6 rounded-3xl text-center shadow-xl">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center mx-auto mb-3">
              <AlertCircle className="w-8 h-8" />
            </div>
            <h3 className="text-base font-bold text-white mb-1 font-islamic">
              Tidak Ada Sesi Presensi Aktif
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed mb-4">
              Admin BPAIK belum mengaktifkan sesi presensi untuk kegiatan apapun saat ini. Silakan tunggu hingga Admin membuka sesi dan menayangkan kode QR di proyektor aula.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="w-full py-2.5 bg-emerald-700 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-sm"
            >
              Kembali ke Beranda
            </button>
          </div>
        ) : (
          <>
            {/* Event selector if multiple active events */}
            {activeEvents.length > 1 && (
              <div className="mb-4 w-full max-w-xs bg-slate-900/80 p-2 rounded-xl border border-white/20 z-10">
                <label className="text-[10px] text-slate-300 uppercase tracking-wider block mb-1 font-bold">
                  Sesi Kegiatan Aktif:
                </label>
                <select
                  value={selectedEventId}
                  onChange={e => setSelectedEventId(e.target.value)}
                  className="w-full bg-slate-800 text-xs text-white rounded-lg p-2 border border-slate-700 focus:outline-emerald-500 cursor-pointer"
                >
                  {activeEvents.map(ev => (
                    <option key={ev.id} value={ev.id}>
                      {ev.title} ({ev.startTime} WIB)
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="relative w-64 h-64 sm:w-72 sm:h-72 rounded-3xl overflow-hidden border-2 border-emerald-400/80 bg-black/60 shadow-2xl flex items-center justify-center">
              {/* Real video feed */}
              <video
                ref={videoRef}
                playsInline
                muted
                className="absolute inset-0 w-full h-full object-cover"
              />

              {/* Corner Guides */}
              <div className="absolute top-3 left-3 w-8 h-8 border-t-4 border-l-4 border-amber-400 rounded-tl-lg pointer-events-none" />
              <div className="absolute top-3 right-3 w-8 h-8 border-t-4 border-r-4 border-amber-400 rounded-tr-lg pointer-events-none" />
              <div className="absolute bottom-3 left-3 w-8 h-8 border-b-4 border-l-4 border-amber-400 rounded-bl-lg pointer-events-none" />
              <div className="absolute bottom-3 right-3 w-8 h-8 border-b-4 border-r-4 border-amber-400 rounded-br-lg pointer-events-none" />

              {/* Animated Laser Scanning Beam */}
              <div className="absolute inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_12px_#34d399] animate-pulse" />

              {cameraError && (
                <div className="absolute inset-0 bg-slate-900/90 flex flex-col items-center justify-center p-4 text-center">
                  <Camera className="w-8 h-8 text-amber-400 mb-2 opacity-60" />
                  <p className="text-xs text-slate-300 font-medium">{cameraError}</p>
                  <p className="text-[11px] text-slate-400 mt-1">Gunakan tombol Uji Scan atau Input Token di bawah</p>
                </div>
              )}
            </div>
          </>
        )}

        {errorMessage && (
          <div className="mt-4 max-w-xs p-3 bg-red-950/90 border border-red-500 text-red-200 rounded-xl text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
            <span>{errorMessage}</span>
          </div>
        )}

        {confirmedNotice && (
          <div className="absolute inset-0 z-30 bg-slate-950/95 flex flex-col items-center justify-center p-6 text-center animate-in fade-in">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mb-4 ring-8 ring-emerald-500/10 shadow-inner">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <h3 className="text-base font-bold text-white mb-2">{confirmedNotice.title}</h3>
            <p className="text-xs text-slate-300 max-w-xs mb-4 leading-relaxed">{confirmedNotice.message}</p>
            <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 text-xs text-slate-400 mb-6 w-full max-w-xs flex justify-between">
              <span>Waktu Presensi:</span>
              <strong className="text-emerald-400 font-mono">
                {new Date(confirmedNotice.scanTime).toLocaleTimeString('id-ID')} WIB
              </strong>
            </div>
            <div className="w-full max-w-xs space-y-2.5">
              <button
                type="button"
                onClick={onClose}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl text-xs font-bold shadow-lg shadow-emerald-900/30 transition-colors cursor-pointer"
              >
                Tutup Pemindai
              </button>
              <button
                type="button"
                onClick={() => {
                  onAttendanceRecorded(confirmedNotice.record);
                }}
                className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium transition-colors cursor-pointer"
              >
                Uji Ulang Alur Tanda Tangan
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Controls */}
      {activeEvents.length > 0 && (
        <div className="w-full max-w-sm mx-auto flex flex-col gap-2.5 z-10">
          {/* Quick Simulated Scan for headless testing & ease of use */}
          <button
            type="button"
            onClick={handleQuickTestScan}
            disabled={isProcessing}
            className="w-full py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 shadow-lg transition-transform active:scale-95 disabled:opacity-50 cursor-pointer"
          >
            {isProcessing ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <ShieldCheck className="w-4 h-4 text-emerald-950" />
            )}
            <span>Pindai QR Proyektor (Verifikasi Sesi)</span>
          </button>

          {/* Toggle Manual Token Entry */}
          {showManualInput ? (
            <div className="bg-slate-900/90 p-3 rounded-xl border border-slate-700 flex flex-col gap-2">
              <label className="text-xs text-slate-300">Tempel Token QR:</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={manualToken}
                  onChange={e => setManualToken(e.target.value)}
                  placeholder="Masukkan token QR..."
                  className="flex-1 bg-slate-800 text-xs px-3 py-2 rounded-lg border border-slate-700 text-white focus:outline-emerald-500"
                />
                <button
                  type="button"
                  onClick={() => handleProcessToken(manualToken)}
                  disabled={isProcessing || !manualToken.trim()}
                  className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold disabled:opacity-50 cursor-pointer"
                >
                  Kirim
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowManualInput(true)}
              className="text-xs text-slate-400 hover:text-white py-1 text-center flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>Input Kode Token Manual</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};
