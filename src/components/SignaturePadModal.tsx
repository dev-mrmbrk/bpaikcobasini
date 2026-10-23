import React, { useRef, useState, useEffect } from 'react';
import { RefreshCw, CheckCircle, AlertCircle, PenTool, X } from 'lucide-react';
import confetti from 'canvas-confetti';
import { validateSignatureStrokes, Stroke, Point } from '../utils/signatureValidator';
import { updateDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { AttendanceRecord } from '../types';

interface SignaturePadModalProps {
  record: AttendanceRecord;
  onSuccess: () => void;
  onClose?: () => void;
}

export const SignaturePadModal: React.FC<SignaturePadModalProps> = ({
  record,
  onSuccess,
  onClose
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const currentStroke = useRef<Point[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmittedSuccess, setIsSubmittedSuccess] = useState(false);

  // Resize canvas according to container dimensions and DPR
  const setupCanvas = () => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const rect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.scale(dpr, dpr);
      ctx.strokeStyle = '#14532d'; // Dark forest green ink
      ctx.lineWidth = 1.75;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      redrawAllStrokes(ctx);
    }
  };

  useEffect(() => {
    setupCanvas();
    window.addEventListener('resize', setupCanvas);
    return () => window.removeEventListener('resize', setupCanvas);
  }, []);

  const redrawAllStrokes = (ctx: CanvasRenderingContext2D) => {
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    strokes.forEach(stroke => {
      if (stroke.length < 2) return;
      ctx.beginPath();
      ctx.moveTo(stroke[0].x, stroke[0].y);
      for (let i = 1; i < stroke.length - 1; i++) {
        const xc = (stroke[i].x + stroke[i + 1].x) / 2;
        const yc = (stroke[i].y + stroke[i + 1].y) / 2;
        ctx.quadraticCurveTo(stroke[i].x, stroke[i].y, xc, yc);
      }
      const last = stroke[stroke.length - 1];
      ctx.lineTo(last.x, last.y);
      ctx.stroke();
    });
  };

  const getCanvasCoordinates = (e: React.PointerEvent<HTMLCanvasElement>): Point => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      time: Date.now()
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    setErrorMsg(null);
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.setPointerCapture(e.pointerId);

    setIsDrawing(true);
    const pt = getCanvasCoordinates(e);
    currentStroke.current = [pt];

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.beginPath();
      ctx.moveTo(pt.x, pt.y);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    e.preventDefault();

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const pt = getCanvasCoordinates(e);
    currentStroke.current.push(pt);

    const pts = currentStroke.current;
    if (pts.length > 2) {
      const p1 = pts[pts.length - 2];
      const p2 = pts[pts.length - 1];
      const xc = (p1.x + p2.x) / 2;
      const yc = (p1.y + p2.y) / 2;
      ctx.quadraticCurveTo(p1.x, p1.y, xc, yc);
      ctx.stroke();
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    e.preventDefault();
    setIsDrawing(false);

    if (currentStroke.current.length > 0) {
      const newStrokes = [...strokes, [...currentStroke.current]];
      setStrokes(newStrokes);
    }
    currentStroke.current = [];
  };

  const handleClear = () => {
    setStrokes([]);
    currentStroke.current = [];
    setErrorMsg(null);
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }
  };

  const handleSubmit = async () => {
    const validation = validateSignatureStrokes(strokes);
    if (!validation.valid) {
      setErrorMsg(validation.error || 'Tanda tangan tidak boleh kosong');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const canvas = canvasRef.current;
      const dataUrl = canvas ? canvas.toDataURL('image/png') : '';

      // Update Firestore record
      const recordRef = doc(db, 'attendanceRecords', record.id);
      const nowIso = new Date().toISOString();

      await updateDoc(recordRef, {
        signatureStatus: 'TERKONFIRMASI',
        signatureData: dataUrl,
        signatureTimestamp: nowIso,
        updatedAt: nowIso
      });

      // Confetti celebration
      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.6 }
      });

      setIsSubmittedSuccess(true);
      setTimeout(() => {
        onSuccess();
      }, 1500);
    } catch (err: unknown) {
      console.error('Submit signature error:', err);
      const msg = err instanceof Error ? err.message : 'Gagal mengirim konfirmasi tanda tangan';
      setErrorMsg(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex flex-col justify-end sm:justify-center items-center p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-2xl sm:rounded-2xl shadow-2xl flex flex-col h-[95vh] sm:h-[88vh] overflow-hidden">
        {/* Header Bar */}
        <div className="px-5 py-3.5 bg-emerald-800 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-emerald-700 flex items-center justify-center text-amber-300">
              <PenTool className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold leading-tight">Konfirmasi Tanda Tangan Digital</h2>
              <p className="text-xs text-emerald-200">Wajib untuk mengesahkan daftar hadir kegiatan</p>
            </div>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1 rounded-full text-emerald-200 hover:text-white hover:bg-emerald-700/50"
              aria-label="Tutup"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Event Context Card */}
        <div className="px-5 py-3 bg-emerald-50/70 border-b border-emerald-100 flex flex-col gap-1 shrink-0">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-800">
              Kegiatan BPAIK
            </span>
            <span className="text-xs text-slate-500 font-medium">
              {record.eventDate}
            </span>
          </div>
          <h3 className="text-sm font-bold text-slate-800 line-clamp-1">{record.eventTitle}</h3>
          <p className="text-xs text-slate-600">
            Pegawai: <strong className="text-emerald-900">{record.userName}</strong> ({record.userNpp || record.userEmail})
          </p>
        </div>

        {/* Canvas Area: 75-85% height of artboard body */}
        <div className="flex-1 p-3 bg-slate-100 flex flex-col min-h-0">
          <div
            ref={containerRef}
            className="flex-1 bg-white rounded-xl border-2 border-dashed border-emerald-300 relative overflow-hidden shadow-inner cursor-crosshair select-none"
            style={{ touchAction: 'none' }}
          >
            {strokes.length === 0 && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 pointer-events-none p-4 text-center">
                <PenTool className="w-8 h-8 text-emerald-400/60 mb-2 animate-bounce" />
                <p className="text-sm font-medium text-slate-500">Bubuhkan Tanda Tangan di Sini</p>
                <p className="text-xs text-slate-400 mt-0.5">Gunakan jari tangan atau stylus Anda</p>
              </div>
            )}

            <canvas
              ref={canvasRef}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              className="w-full h-full block"
            />
          </div>

          {errorMsg && (
            <div className="mt-2 p-2 bg-red-50 text-red-700 rounded-lg text-xs flex items-center gap-1.5 border border-red-200">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          {isSubmittedSuccess && (
            <div className="mt-2 p-2 bg-emerald-50 text-emerald-800 rounded-lg text-xs flex items-center gap-1.5 border border-emerald-200">
              <CheckCircle className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>Tanda tangan terkonfirmasi! Menutup dialog...</span>
            </div>
          )}
        </div>

        {/* Bottom Actions */}
        <div className="px-5 py-3.5 bg-white border-t border-slate-200 flex items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={handleClear}
            disabled={strokes.length === 0 || isSubmitting}
            className="px-4 py-2.5 rounded-xl tactile-3d-btn-white disabled:opacity-40 disabled:cursor-not-allowed font-bold text-xs flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Ulangi / Hapus</span>
          </button>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={strokes.length === 0 || isSubmitting || isSubmittedSuccess}
            className="flex-1 py-2.5 px-4 rounded-xl tactile-3d-btn-primary font-bold text-xs flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {isSubmitting ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Menyimpan Konfirmasi...</span>
              </>
            ) : isSubmittedSuccess ? (
              <>
                <CheckCircle className="w-4 h-4 text-[#F4C542]" />
                <span>Terkonfirmasi!</span>
              </>
            ) : (
              <>
                <CheckCircle className="w-4 h-4 text-[#F4C542]" />
                <span>Kirim Konfirmasi Tanda Tangan</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
