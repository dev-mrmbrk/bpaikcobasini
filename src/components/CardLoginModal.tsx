import React, { useState, useRef, useEffect } from 'react';
import { Camera, X, AlertCircle, RefreshCw, CheckCircle2, CreditCard, ArrowRight, KeyRound, Sparkles } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { BPAIKUser } from '../types';
import { BrowserQRCodeReader } from '@zxing/browser';
import { normalizeCardQrPayload } from '../utils/cardQr';

interface CardLoginModalProps {
  onClose: () => void;
  onSuccess: (user: BPAIKUser) => void;
}

export const CardLoginModal: React.FC<CardLoginModalProps> = ({
  onClose,
  onSuccess
}) => {
  const { loginWithCardQr, isLoading } = useAuth();
  const [manualCode, setManualCode] = useState('');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [verifiedUser, setVerifiedUser] = useState<BPAIKUser | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [showManualInput, setShowManualInput] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const controlsRef = useRef<{ stop: () => void } | null>(null);

  // Scanner QR lintas browser, tidak bergantung pada BarcodeDetector.
  useEffect(() => {
    let active = true;
    let handled = false;
    let localControls: { stop: () => void } | null = null;

    if (isVerifying || verifiedUser) {
      return () => {
        active = false;
      };
    }

    async function initCamera() {
      try {
        const videoElement = videoRef.current;

        if (!navigator.mediaDevices?.getUserMedia || !videoElement) {
          setCameraError('Kamera tidak didukung atau tidak tersedia di browser ini.');
          setShowManualInput(true);
          return;
        }

        const reader = new BrowserQRCodeReader(
          undefined,
          { delayBetweenScanAttempts: 250 }
        );

        const controls = await reader.decodeFromVideoDevice(
          undefined,
          videoElement,
          (result, _error, scanControls) => {
            if (!active || handled || isVerifying || verifiedUser || !result) {
              return;
            }

            const rawCode = result.getText()?.trim();
            if (!rawCode) return;

            handled = true;
            scanControls.stop();
            controlsRef.current = null;
            void handleProcessCode(rawCode);
          }
        );

        localControls = controls;

        if (!active || handled) {
          controls.stop();
        } else {
          controlsRef.current = controls;
        }
      } catch (err: unknown) {
        if (!active) return;

        console.warn('Camera access for card login:', err);
        setCameraError(
          'Kamera tidak dapat diakses. Pastikan izin kamera aktif dan situs memakai HTTPS.'
        );
        setShowManualInput(true);
      }
    }

    void initCamera();

    return () => {
      active = false;
      localControls?.stop();
      controlsRef.current?.stop();
      controlsRef.current = null;
    };
  }, [isVerifying, verifiedUser]);

  const handleProcessCode = async (rawCode: string) => {
    const codeToUse = normalizeCardQrPayload(rawCode);

    if (!codeToUse) {
      setScanError('QR tidak berisi kode kartu BPAIK yang dikenali.');
      return;
    }

    setIsVerifying(true);
    setScanError(null);

    try {
      const user = await loginWithCardQr(codeToUse);
      setVerifiedUser(user);

      window.setTimeout(() => {
        onSuccess(user);
      }, 900);
    } catch (err: unknown) {
      const msg = err instanceof Error
        ? err.message
        : 'Kode kartu tidak valid';

      setScanError(msg);
    } finally {
      setIsVerifying(false);
    }
  };

  // Membaca QR dari gambar kartu menggunakan decoder yang sama.
  const handleUploadCardImage = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const imageUrl = URL.createObjectURL(file);

    try {
      const reader = new BrowserQRCodeReader();
      const result = await reader.decodeFromImageUrl(imageUrl);
      const rawCode = result.getText();

      if (rawCode) {
        await handleProcessCode(rawCode);
        return;
      }
    } catch (err) {
      console.warn('QR image decoding notice:', err);
    } finally {
      URL.revokeObjectURL(imageUrl);
    }

    setScanError(
      'QR tidak terbaca dari gambar. Coba foto yang lebih jelas atau pindai langsung dengan kamera.'
    );
    setShowManualInput(true);
  };



  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="tactile-3d-card w-full max-w-md bg-white border border-slate-200 overflow-hidden shadow-2xl relative">
        
        {/* Top Header */}
        <div className="bg-gradient-to-r from-emerald-950 via-emerald-800 to-emerald-900 text-white p-4 flex items-center justify-between border-b-2 border-amber-400">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center font-bold shadow-xs">
              <Camera className="w-5 h-5 text-slate-950" />
            </div>
            <div>
              <h3 className="text-sm font-bold font-islamic text-white">
                Pindai Kartu Digital Peserta
              </h3>
              <p className="text-[10px] text-emerald-200">
                Arahkan kamera ke QR Code pada Kartu Peserta BPAIK
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center cursor-pointer transition-colors"
            aria-label="Tutup"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body Area */}
        <div className="p-5 flex flex-col items-center">
          
          {verifiedUser ? (
            /* Success confirmation card */
            <div className="py-6 flex flex-col items-center text-center space-y-3 animate-in zoom-in-95 duration-200">
              <div className="w-16 h-16 rounded-full bg-emerald-100 border-2 border-emerald-500 text-emerald-700 flex items-center justify-center shadow-md animate-bounce">
                <CheckCircle2 className="w-9 h-9" />
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold tracking-widest text-emerald-700 font-mono">
                  Kartu Terverifikasi
                </span>
                <h4 className="text-base sm:text-lg font-extrabold text-slate-900 font-islamic mt-0.5">
                  {verifiedUser.name}
                </h4>
                <p className="text-xs text-slate-500 font-mono">{verifiedUser.npp || verifiedUser.email}</p>
                <div className="inline-block mt-2 px-3 py-1 bg-emerald-50 text-emerald-800 rounded-full text-xs font-bold border border-emerald-200">
                  Peran: {verifiedUser.role} • Mengalihkan ke sistem...
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Camera Scanner Viewfinder */}
              <div className="relative w-64 h-64 sm:w-72 sm:h-72 rounded-2xl overflow-hidden border-2 border-emerald-600 bg-slate-950 shadow-inner flex items-center justify-center">
                <video
                  ref={videoRef}
                  playsInline
                  muted
                  className="absolute inset-0 w-full h-full object-cover"
                />

                {/* Framing guides */}
                <div className="absolute top-3 left-3 w-7 h-7 border-t-4 border-l-4 border-[#F4C542] rounded-tl-lg pointer-events-none" />
                <div className="absolute top-3 right-3 w-7 h-7 border-t-4 border-r-4 border-[#F4C542] rounded-tr-lg pointer-events-none" />
                <div className="absolute bottom-3 left-3 w-7 h-7 border-b-4 border-l-4 border-[#F4C542] rounded-bl-lg pointer-events-none" />
                <div className="absolute bottom-3 right-3 w-7 h-7 border-b-4 border-r-4 border-[#F4C542] rounded-br-lg pointer-events-none" />

                {/* Laser animation */}
                <div className="absolute inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-[#F4C542] to-transparent shadow-[0_0_12px_#F4C542] animate-pulse" />

                {cameraError && (
                  <div className="absolute inset-0 bg-slate-900/90 flex flex-col items-center justify-center p-4 text-center">
                    <Camera className="w-8 h-8 text-amber-400 mb-2 opacity-70" />
                    <p className="text-xs text-white font-bold">{cameraError}</p>
                    <p className="text-[11px] text-slate-300 mt-1">
                      Silakan unggah foto kartu atau input kode kartu di bawah.
                    </p>
                  </div>
                )}
              </div>

              {/* Upload photo alternative */}
              <div className="mt-3 flex items-center gap-2">
                <label className="px-3 py-1.5 bg-slate-100 hover:bg-emerald-50 text-emerald-800 rounded-xl text-xs font-bold border border-slate-300 hover:border-emerald-400 flex items-center gap-1.5 cursor-pointer shadow-xs transition-all">
                  <CreditCard className="w-3.5 h-3.5 text-[#0f613c]" />
                  <span>Pilih Foto Kartu / QR</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleUploadCardImage}
                    className="hidden"
                  />
                </label>
              </div>

              {scanError && (
                <div className="mt-3 w-full p-2.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <span className="text-[11px]">{scanError}</span>
                </div>
              )}

              {/* Quick Scan Demo Buttons */}
              <div className="w-full mt-4 pt-3 border-t border-slate-100">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold text-slate-500 uppercase font-mono tracking-wider">
                    Uji Pindai Cepat Kartu:
                  </span>
                  <span className="text-[9px] bg-amber-100 text-amber-900 font-extrabold px-2 py-0.5 rounded-full">
                    Demo QR
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={isVerifying}
                    onClick={() => handleProcessCode('BPAIK-KARTU-0415038102-HAMZAH')}
                    className="tactile-3d-btn-accent p-2 rounded-xl text-left cursor-pointer flex flex-col items-start disabled:opacity-50"
                  >
                    <span className="text-xs font-bold text-slate-950 font-islamic flex items-center gap-1">
                      <CreditCard className="w-3.5 h-3.5" />
                      <span>Kartu Dr. Hamzah</span>
                    </span>
                    <span className="text-[10px] text-slate-700 font-mono mt-0.5 truncate w-full">
                      Peserta (Dosen)
                    </span>
                  </button>

                  <button
                    type="button"
                    disabled={isVerifying}
                    onClick={() => handleProcessCode('BPAIK-KARTU-NPP0422019800')}
                    className="tactile-3d-btn-white p-2 rounded-xl text-left cursor-pointer flex flex-col items-start border border-slate-200 disabled:opacity-50"
                  >
                    <span className="text-xs font-bold text-[#0f613c] font-islamic flex items-center gap-1">
                      <CreditCard className="w-3.5 h-3.5" />
                      <span>Kartu Admin BPAIK</span>
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono mt-0.5 truncate w-full">
                      Administrator
                    </span>
                  </button>
                </div>
              </div>

              {/* Manual Input Toggle */}
              <div className="w-full mt-3">
                {!showManualInput ? (
                  <button
                    type="button"
                    onClick={() => setShowManualInput(true)}
                    className="w-full text-center text-xs text-[#0284c7] hover:underline font-bold py-1 cursor-pointer"
                  >
                    Punya isi QR kartu tertulis? Klik di sini
                  </button>
                ) : (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleProcessCode(manualCode);
                    }}
                    className="mt-2 space-y-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200"
                  >
                    <label className="block text-[11px] font-bold text-slate-700">
                      Masukkan Kode QR Kartu Peserta:
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="contoh: BPAIK-KARTU-..."
                        value={manualCode}
                        onChange={(e) => setManualCode(e.target.value)}
                        className="flex-1 p-2 bg-white border border-slate-300 rounded-lg text-xs font-mono focus:outline-emerald-600"
                      />
                      <button
                        type="submit"
                        disabled={isVerifying || !manualCode.trim()}
                        className="tactile-3d-btn-primary px-3 py-2 rounded-lg text-xs font-bold cursor-pointer disabled:opacity-50"
                      >
                        {isVerifying ? 'Cek...' : 'Masuk'}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </>
          )}

        </div>

        {/* Footer Note */}
        <div className="bg-slate-50 px-4 py-2.5 border-t border-slate-200 text-center text-[10px] text-slate-500">
          Sistem Presensi BPAIK Universitas 'Aisyiyah Bandung
        </div>

      </div>
    </div>
  );
};
