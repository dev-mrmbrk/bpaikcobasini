import React from 'react';
import { CheckCircle2, PenLine, ShieldCheck } from 'lucide-react';
import { AttendanceRecord } from '../types';

interface AttendanceSuccessModalProps {
  record: AttendanceRecord;
  onProceedToSign: () => void;
}

export const AttendanceSuccessModal: React.FC<AttendanceSuccessModalProps> = ({
  record,
  onProceedToSign
}) => {
  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="tactile-3d-card bg-white w-full max-w-md overflow-hidden border border-slate-200 flex flex-col text-center p-5 sm:p-7 animate-in fade-in zoom-in-95 duration-200">
        {/* Animated Check Icon */}
        <div className="mx-auto w-16 h-16 rounded-2xl bg-emerald-100 text-[#0f613c] flex items-center justify-center mb-4 border border-emerald-200 shadow-xs">
          <CheckCircle2 className="w-10 h-10" />
        </div>

        {/* Title & Message */}
        <h3 className="text-lg sm:text-xl font-bold font-islamic text-slate-900 mb-1">
          Berhasil! Kehadiranmu sudah tercatat.
        </h3>
        <p className="text-xs text-slate-600 mb-5 leading-relaxed">
          Silakan tanda tangan digital untuk mengonfirmasi daftar hadir kegiatan ini secara sah.
        </p>

        {/* Event summary snippet */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 mb-5 text-left text-xs">
          <div className="flex items-center gap-1.5 text-xs text-[#0f613c] font-bold mb-1">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Presensi Sah Terverifikasi</span>
          </div>
          <p className="text-xs font-bold text-slate-800 line-clamp-2">{record.eventTitle}</p>
          <div className="mt-2 text-[11px] text-slate-500 flex justify-between">
            <span>Waktu: {new Date(record.scanTime).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB</span>
            <span className="font-bold text-emerald-700">HADIR</span>
          </div>
        </div>

        {/* Action Button with 3D Primary Button */}
        <button
          type="button"
          onClick={onProceedToSign}
          className="w-full py-3 px-5 rounded-xl sm:rounded-2xl tactile-3d-btn-primary font-bold text-xs sm:text-sm flex items-center justify-center gap-2 cursor-pointer"
        >
          <PenLine className="w-4 h-4 text-[#F4C542]" />
          <span>Tanda Tangan untuk Konfirmasi</span>
        </button>
      </div>
    </div>
  );
};
