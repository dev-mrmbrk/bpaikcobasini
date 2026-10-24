import React, { useState, useEffect } from 'react';
import { QrCode, Maximize2, Minimize2, Users, Clock, ShieldCheck, CheckCircle2, AlertTriangle, ArrowLeft, AlertCircle, Play } from 'lucide-react';
import { BPAIKEvent, AttendanceRecord } from '../types';
import QRCode from 'qrcode';

interface ProjectorQrViewProps {
  event: BPAIKEvent;
  onBack: () => void;
}

export const ProjectorQrView: React.FC<ProjectorQrViewProps> = ({ event: initialEvent, onBack }) => {
  const [currentEvent, setCurrentEvent] = useState<BPAIKEvent>(initialEvent);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [tokenString, setTokenString] = useState<string>('');
  const [countdown, setCountdown] = useState<number>(10);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [attendees, setAttendees] = useState<AttendanceRecord[]>([]);
  const [isLoadingToken, setIsLoadingToken] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Poll event state from Worker / D1.
  useEffect(() => {
    let active = true;

    const syncEvent = async () => {
      try {
        const response = await fetch('/api/events', {
          method: 'GET',
          credentials: 'same-origin'
        });
        const payload = await response.json() as {
          success?: boolean;
          events?: BPAIKEvent[];
          error?: string;
        };

        if (!response.ok || payload.success !== true || !Array.isArray(payload.events)) {
          throw new Error(payload.error || 'Gagal membaca kegiatan.');
        }

        const freshEvent = payload.events.find(item => item.id === initialEvent.id);
        if (active && freshEvent) {
          setCurrentEvent(freshEvent);
        }
      } catch (error) {
        if (active) console.warn('Projector D1 event sync error:', error);
      }
    };

    void syncEvent();
    const interval = setInterval(() => void syncEvent(), 3000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [initialEvent.id]);

  const isSessionActive = currentEvent.sessionStatus === 'aktif';

  // Fetch a short-lived token from Worker; render its QR image in the browser.
  const fetchNewToken = async () => {
    if (!isSessionActive) return;

    try {
      const response = await fetch(
        `/api/qr/token/${encodeURIComponent(currentEvent.id)}`,
        { credentials: 'same-origin' }
      );
      const payload = await response.json() as {
        success?: boolean;
        token?: string;
        error?: string;
      };

      if (!response.ok || payload.success !== true || !payload.token) {
        throw new Error(payload.error || 'Gagal mengambil token QR.');
      }

      const dataUrl = await QRCode.toDataURL(payload.token, {
        errorCorrectionLevel: 'M',
        margin: 2,
        width: 400,
        color: {
          dark: '#14532d',
          light: '#ffffff'
        }
      });

      setQrDataUrl(dataUrl);
      setTokenString(payload.token);
      setCountdown(10);
      setErrorMsg(null);
    } catch (error: unknown) {
      console.error('Fetch QR token error:', error);
      setErrorMsg(error instanceof Error
        ? error.message
        : 'Koneksi ke server terputus saat memperbarui QR');
    } finally {
      setIsLoadingToken(false);
    }
  };

  // Initial fetch and 10-second token rotation ONLY if session is active
  useEffect(() => {
    if (!isSessionActive) {
      setIsLoadingToken(false);
      setQrDataUrl(null);
      setTokenString('');
      return;
    }

    fetchNewToken();
    const tokenInterval = setInterval(() => {
      fetchNewToken();
    }, 10000);

    return () => clearInterval(tokenInterval);
  }, [currentEvent.id, isSessionActive]);

  // 1-second countdown ticker
  useEffect(() => {
    if (!isSessionActive) return;
    const timer = setInterval(() => {
      setCountdown(prev => (prev > 1 ? prev - 1 : 10));
    }, 1000);
    return () => clearInterval(timer);
  }, [isSessionActive]);

  // Poll attendance records from Worker / D1.
  useEffect(() => {
    let active = true;

    const syncAttendees = async () => {
      try {
        const response = await fetch(
          `/api/attendance?eventId=${encodeURIComponent(currentEvent.id)}`,
          { credentials: 'same-origin' }
        );
        const payload = await response.json() as {
          success?: boolean;
          records?: AttendanceRecord[];
          error?: string;
        };

        if (!response.ok || payload.success !== true || !Array.isArray(payload.records)) {
          throw new Error(payload.error || 'Gagal membaca rekap presensi.');
        }

        if (active) {
          const list = [...payload.records].sort(
            (a, b) => new Date(b.scanTime).getTime() - new Date(a.scanTime).getTime()
          );
          setAttendees(list);
        }
      } catch (error) {
        if (active) console.warn('D1 attendance sync error:', error);
      }
    };

    void syncAttendees();
    const interval = setInterval(() => void syncAttendees(), 3000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [currentEvent.id]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  const confirmedCount = attendees.filter(a => a.signatureStatus === 'TERKONFIRMASI').length;
  const pendingCount = attendees.filter(a => a.signatureStatus === 'MENUNGGU_KONFIRMASI').length;

  return (
    <div className="fixed inset-0 z-40 bg-slate-900 text-white flex flex-col overflow-y-auto">
      {/* Top Banner */}
      <header className="bg-emerald-900 border-b border-emerald-800 px-6 py-4 flex items-center justify-between shadow-md shrink-0">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2 rounded-xl bg-emerald-800/80 hover:bg-emerald-700 text-emerald-100 transition-colors flex items-center gap-1.5 text-xs font-semibold cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Kembali ke Jadwal</span>
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className={`text-xs font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full ${
                isSessionActive ? 'bg-amber-400 text-slate-950' : 'bg-red-500 text-white'
              }`}>
                {isSessionActive ? 'Mode Proyektor Aktif' : 'Sesi Presensi Ditutup'}
              </span>
              {isSessionActive && (
                <>
                  <span className="text-xs text-emerald-200">
                    Rotasi Token 10 Detik
                  </span>
                  <span className="text-xs bg-emerald-800 text-amber-300 font-mono font-bold px-2 py-0.5 rounded-full border border-emerald-700">
                    Durasi Sesi: {currentEvent.sessionDurationMinutes || 60} Menit
                  </span>
                </>
              )}
            </div>
            <h1 className="text-lg sm:text-xl font-bold text-white mt-1 line-clamp-1">{currentEvent.title}</h1>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={toggleFullscreen}
            className="p-2.5 rounded-xl bg-emerald-800 hover:bg-emerald-700 text-white transition-colors flex items-center gap-2 text-xs font-medium cursor-pointer"
            title="Layar Penuh"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            <span className="hidden sm:inline">{isFullscreen ? 'Keluar Fullscreen' : 'Layar Penuh'}</span>
          </button>
        </div>
      </header>

      {/* Main Stage */}
      <div className="flex-1 p-6 lg:p-10 flex flex-col lg:flex-row items-center justify-center gap-8 max-w-7xl mx-auto w-full">
        
        {/* If session is INACTIVE: show clear alert screen */}
        {!isSessionActive ? (
          <div className="bg-white text-slate-900 p-8 sm:p-10 rounded-3xl shadow-2xl flex flex-col items-center justify-center border-4 border-amber-500 max-w-lg w-full text-center">
            <div className="w-16 h-16 rounded-2xl bg-amber-100 flex items-center justify-center text-amber-600 mb-4">
              <AlertCircle className="w-9 h-9" />
            </div>
            <span className="text-xs font-bold tracking-widest text-emerald-700 uppercase">
              Universitas 'Aisyiyah Bandung
            </span>
            <h2 className="text-xl font-black text-slate-900 font-islamic mt-1">
              Sesi Presensi Belum Diaktifkan
            </h2>
            <p className="text-xs text-slate-600 mt-2 leading-relaxed">
              Kode QR dinamis hanya dapat dibuka dan dipindai jika sesi presensi untuk kegiatan ini telah dibuka oleh Admin.
            </p>

            <div className="mt-4 p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 text-left w-full space-y-1">
              <p>📌 <strong>Kegiatan:</strong> {currentEvent.title}</p>
              <p>📍 <strong>Lokasi:</strong> {currentEvent.location}</p>
              <p>⏰ <strong>Jadwal:</strong> {currentEvent.startTime} - {currentEvent.endTime} WIB</p>
              <p>🔒 <strong>Status Sesi:</strong> <span className="font-bold text-red-600 uppercase">{currentEvent.sessionStatus || 'belum dibuka'}</span></p>
            </div>

            <p className="text-[11px] text-slate-500 mt-4">
              Silakan kembali ke menu <strong>Jadwal & Kegiatan</strong>, lalu tekan tombol <strong>"Buka Sesi QR"</strong> pada kartu kegiatan ini.
            </p>

            <button
              type="button"
              onClick={onBack}
              className="mt-5 px-5 py-2.5 rounded-xl bg-[#0f613c] hover:bg-[#0c4e30] text-white font-bold text-xs flex items-center gap-2 cursor-pointer shadow-md transition-all active:scale-95"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Kembali ke Jadwal Kegiatan</span>
            </button>
          </div>
        ) : (
          /* Active Presentation Box */
          <div className="bg-white text-slate-900 p-8 sm:p-10 rounded-3xl shadow-2xl flex flex-col items-center justify-center border-4 border-emerald-500 relative max-w-md w-full">
            {/* BPAIK Identity badge */}
            <div className="text-center mb-6">
              <span className="text-xs font-bold tracking-widest text-emerald-700 uppercase">
                Universitas 'Aisyiyah Bandung
              </span>
              <h2 className="text-lg font-black text-slate-800">
                Absensi BPAIK
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Scan menggunakan kamera HP Anda pada menu Beranda Pegawai
              </p>
            </div>

            {/* QR Display */}
            <div className="relative p-3 bg-white rounded-2xl border-2 border-slate-200 shadow-inner flex items-center justify-center">
              {qrDataUrl ? (
                <img
                  src={qrDataUrl}
                  alt="QR Kegiatan Dinamis"
                  className="w-64 h-64 sm:w-72 sm:h-72 object-contain rounded-lg"
                />
              ) : (
                <div className="w-64 h-64 sm:w-72 sm:h-72 flex items-center justify-center text-slate-400">
                  {isLoadingToken ? 'Menyiapkan QR Dinamis...' : 'Memuat QR...'}
                </div>
              )}

              {/* Glowing Scan Ring Indicator */}
              <div className="absolute inset-0 rounded-2xl border-2 border-emerald-500/40 pointer-events-none animate-pulse" />
            </div>

            {/* Rotating Countdown Bar */}
            <div className="mt-6 w-full flex flex-col items-center gap-2">
              <div className="flex items-center justify-between w-full text-xs font-semibold text-slate-600">
                <span className="flex items-center gap-1.5 text-emerald-700">
                  <Clock className="w-3.5 h-3.5 animate-spin" />
                  <span>QR Berganti Otomatis</span>
                </span>
                <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-mono font-bold">
                  {countdown}s
                </span>
              </div>
              {/* Progress Bar */}
              <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-emerald-600 h-full transition-all duration-1000 ease-linear rounded-full"
                  style={{ width: `${(countdown / 10) * 100}%` }}
                />
              </div>
            </div>

            {errorMsg && (
              <div className="mt-3 text-xs text-red-600 bg-red-50 p-2 rounded-lg flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}
          </div>
        )}

        {/* Live Attendance Counter & Feed */}
        <div className="flex-1 w-full max-w-lg flex flex-col gap-6">
          {/* Quick Metrics */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-800/90 border border-slate-700 p-5 rounded-2xl shadow-lg">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400 font-medium">Hadir Terkonfirmasi</span>
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              </div>
              <p className="text-3xl font-extrabold text-white mt-2 font-mono">{confirmedCount}</p>
              <p className="text-[11px] text-emerald-400 mt-1">Tanda tangan selesai</p>
            </div>

            <div className="bg-slate-800/90 border border-slate-700 p-5 rounded-2xl shadow-lg">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400 font-medium">Menunggu TTD</span>
                <Clock className="w-5 h-5 text-amber-400" />
              </div>
              <p className="text-3xl font-extrabold text-amber-400 mt-2 font-mono">{pendingCount}</p>
              <p className="text-[11px] text-amber-400 mt-1">Sudah scan di HP</p>
            </div>
          </div>

          {/* Real-time Ticker of Entering Attendees */}
          <div className="bg-slate-800/90 border border-slate-700 p-5 rounded-2xl shadow-lg flex-1 flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-700">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-bold text-white">Peserta Masuk (Live Feed)</h3>
              </div>
              <span className="text-xs font-semibold text-emerald-300">
                Total: {attendees.length}
              </span>
            </div>

            <div className="mt-3 flex-1 overflow-y-auto max-h-72 space-y-2 pr-1 divide-y divide-slate-700/50">
              {attendees.length === 0 ? (
                <div className="py-8 text-center text-slate-400 text-xs">
                  {isSessionActive
                    ? 'Belum ada peserta yang memindai QR. Menunggu presensi pertama...'
                    : 'Sesi presensi ditutup. Tidak menerima pemindaian baru.'}
                </div>
              ) : (
                attendees.map(item => (
                  <div key={item.id} className="pt-2 flex items-center justify-between text-xs">
                    <div>
                      <p className="font-semibold text-white">{item.userName}</p>
                      <p className="text-[11px] text-slate-400">{item.userJabatan || 'Peserta'}</p>
                    </div>
                    <div className="text-right">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        item.signatureStatus === 'TERKONFIRMASI'
                          ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                          : 'bg-amber-950 text-amber-400 border border-amber-800'
                      }`}>
                        {item.signatureStatus === 'TERKONFIRMASI' ? 'Terkonfirmasi' : 'Menunggu TTD'}
                      </span>
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        {new Date(item.scanTime).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
