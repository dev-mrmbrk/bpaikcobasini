import React, { useState, useRef, useEffect } from 'react';
import { BrowserQRCodeReader } from '@zxing/browser';
import { Camera, X, AlertCircle, RefreshCw, CheckCircle2, ShieldCheck, KeyRound } from 'lucide-react';
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

  // Synchronize selectedEventId if activeEvents changes
  useEffect(() => {
    if (activeEvents.length > 0 && (!selectedEventId || !activeEvents.find(e => e.id === selectedEventId))) {
      setSelectedEventId(activeEvents[0].id);
    }
  }, [activeEvents, selectedEventId]);

  // Start camera and actively decode QR codes from its video stream.
  useEffect(() => {
    if (activeEvents.length === 0) return;

    let active = true;
    let alreadyDecoded = false;
    let controls: { stop: () => void } | undefined;
    const reader = new BrowserQRCodeReader();

    async function startCamera() {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          setCameraError('Perangkat tidak mendukung akses kamera langsung');
          setShowManualInput(true);
          return;
        }

        const video = videoRef.current;
        if (!video) return;

        controls = await reader.decodeFromVideoDevice(
          undefined,
          video,
          (result) => {
            if (!active || alreadyDecoded || !result) return;

            const value = result.getText().trim();
            if (!value) return;

            alreadyDecoded = true;
            controls?.stop();
            void handleProcessToken(value);
          }
        );

        if (active) {
          setCameraError(null);
          setShowManualInput(false);
        }
      } catch (err) {
        if (!active) return;
        console.warn('QR camera decoder error:', err);
        setCameraError('Kamera tidak dapat membaca QR. Periksa izin kamera atau gunakan input manual.');
        setShowManualInput(true);
      }
    }

    void startCamera();

    return () => {
      active = false;
      controls?.stop();
    };
  }, [activeEvents.length, selectedEventId]);

  const handleProcessToken = async (tokenString: string) => {
    if (!tokenString.trim()) {
      setErrorMessage('Token QR tidak boleh kosong');
      return;
    }

    if (activeEvents.length === 0) {
      setErrorMessage('Tidak ada sesi presensi kegiatan yang aktif saat ini.');
      return;
    }

    const targetEvent = activeEvents.find(event => event.id === selectedEventId);
    if (!targetEvent) {
      setErrorMessage('Pilih kegiatan yang sedang aktif sebelum memindai QR.');
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);

    try {
      const response = await fetch('/api/attendance/scan', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: tokenString.trim(),
          eventId: selectedEventId
        })
      });

      const payload = await response.json() as {
        success?: boolean;
        duplicate?: boolean;
        record?: AttendanceRecord;
        error?: string;
      };

      if (!response.ok || payload.success !== true || !payload.record) {
        throw new Error(payload.error || 'Gagal menyimpan presensi ke server.');
      }

      const record = payload.record;

      if (record.signatureStatus === 'TERKONFIRMASI') {
        setConfirmedNotice({
          title: 'Presensi Anda Sudah Sah & Terkonfirmasi',
          message: `Presensi untuk kegiatan "${record.eventTitle}" sudah tercatat dan tanda tangan telah dikonfirmasi.`,
          scanTime: record.scanTime,
          record
        });
        return;
      }

      // Record baru maupun duplikat yang belum bertanda tangan akan menuju alur tanda tangan.
      onAttendanceRecorded(record);
    } catch (err: unknown) {
      const msg = err instanceof Error
        ? err.message
        : 'Gagal memverifikasi kehadiran';
      setErrorMessage(msg);
    } finally {
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
