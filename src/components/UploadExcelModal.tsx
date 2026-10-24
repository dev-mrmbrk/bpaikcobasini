import React, { useState, useRef } from 'react';
import { X, Upload, FileSpreadsheet, Download, CheckCircle2, AlertCircle, RefreshCw, Users, Trash2 } from 'lucide-react';
import { BPAIKUser } from '../types';
import { parseParticipantExcelFile, downloadParticipantTemplateExcel } from '../utils/reportExport';

interface UploadExcelModalProps {
  currentUser: BPAIKUser;
  onSuccess: () => void;
  onClose: () => void;
}

export const UploadExcelModal: React.FC<UploadExcelModalProps> = ({
  onSuccess,
  onClose
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [parsedUsers, setParsedUsers] = useState<Omit<BPAIKUser, 'id'>[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [importSummary, setImportSummary] = useState<{ total: number; success: number } | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setIsParsing(true);
    setParseErrors([]);
    setParsedUsers([]);
    setImportSummary(null);

    try {
      const result = await parseParticipantExcelFile(file);
      setParsedUsers(result.validUsers);
      setParseErrors(result.errors);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal membaca berkas Excel';
      setParseErrors([msg]);
    } finally {
      setIsParsing(false);
    }
  };

  const handleImportToDatabase = async () => {
    if (parsedUsers.length === 0) return;

    setIsImporting(true);
    let successCount = 0;
    const importErrors: string[] = [...parseErrors];

    try {
      for (const userCandidate of parsedUsers) {
        const cleanEmail = userCandidate.email.toLowerCase().trim();

        try {
          const response = await fetch('/api/users', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: userCandidate.name,
              email: cleanEmail,
              npp: userCandidate.npp,
              jabatan: userCandidate.jabatan,
              whatsapp: userCandidate.whatsapp,
              role: userCandidate.role,
              status: userCandidate.status
            })
          });

          const payload = await response.json() as {
            success?: boolean;
            user?: BPAIKUser;
            error?: string;
          };

          if (!response.ok || payload.success !== true || !payload.user) {
            importErrors.push(
              `${cleanEmail}: ${payload.error || 'Gagal menyimpan ke D1.'}`
            );
            continue;
          }

          successCount++;
        } catch (error) {
          importErrors.push(
            `${cleanEmail}: ${
              error instanceof Error ? error.message : 'Kesalahan jaringan.'
            }`
          );
        }
      }

      setImportSummary({
        total: parsedUsers.length,
        success: successCount
      });
      setParseErrors(importErrors);

      if (successCount > 0) {
        setTimeout(() => onSuccess(), 1500);
      }
    } catch (err) {
      console.error('Import excel error:', err);
      alert('Terjadi kesalahan saat mengimpor data ke D1.');
    } finally {
      setIsImporting(false);
    }
  };

  const handleRemoveRow = (index: number) => {
    setParsedUsers(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="tactile-3d-card w-full max-w-2xl bg-white p-5 sm:p-6 border border-slate-200 max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-200">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center shadow-xs">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold font-islamic text-slate-900">
                Impor Data Peserta dari Excel (.xlsx / .csv)
              </h3>
              <p className="text-xs text-slate-500">
                Unggah daftar peserta kegiatan. Data langsung tersimpan ke database cloud server.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action Bar: Download Template & File Picker */}
        <div className="my-4 p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div>
            <h4 className="text-xs font-bold text-emerald-950">Belum punya format tabel?</h4>
            <p className="text-[11px] text-emerald-800/80">
              Gunakan template resmi BPAIK UNISA agar kolom sesuai standar.
            </p>
          </div>

          <button
            type="button"
            onClick={downloadParticipantTemplateExcel}
            className="tactile-3d-btn-white px-3.5 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-2 cursor-pointer shrink-0"
          >
            <Download className="w-4 h-4 text-emerald-800" />
            <span>Download Template Excel</span>
          </button>
        </div>

        {/* Upload Dropzone */}
        <div
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-emerald-300 hover:border-emerald-600 bg-emerald-50/30 hover:bg-emerald-50/70 rounded-2xl p-6 text-center cursor-pointer transition-all"
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx, .xls, .csv"
            onChange={handleFileChange}
            className="hidden"
          />
          <Upload className="w-8 h-8 mx-auto text-emerald-600 mb-2" />
          <p className="text-xs font-bold text-slate-800">
            {selectedFile ? selectedFile.name : 'Klik untuk memilih file Excel (.xlsx / .xls / .csv)'}
          </p>
          <p className="text-[10px] text-slate-400 mt-1">
            Format file didukung: Microsoft Excel Worksheet (.xlsx, .xls) atau Comma-Separated Values (.csv)
          </p>
        </div>

        {/* Loading Spinner */}
        {isParsing && (
          <div className="py-6 text-center text-xs text-slate-600 flex items-center justify-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin text-emerald-700" />
            <span>Memproses dan memvalidasi file Excel...</span>
          </div>
        )}

        {/* Errors / Warnings */}
        {parseErrors.length > 0 && (
          <div className="mt-3 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs space-y-1">
            <div className="flex items-center gap-1.5 font-bold">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>Catatan Pemeriksaan Berkas:</span>
            </div>
            <ul className="list-disc pl-5 text-[11px] space-y-0.5">
              {parseErrors.slice(0, 5).map((err, idx) => (
                <li key={idx}>{err}</li>
              ))}
              {parseErrors.length > 5 && (
                <li>...dan {parseErrors.length - 5} catatan lainnya.</li>
              )}
            </ul>
          </div>
        )}

        {/* Success Notice */}
        {importSummary && (
          <div className="mt-3 p-4 rounded-xl bg-emerald-100 border border-emerald-300 text-emerald-950 text-xs flex items-center gap-3">
            <CheckCircle2 className="w-6 h-6 text-emerald-700 shrink-0" />
            <div>
              <p className="font-bold">Berhasil Mengimpor {importSummary.success} Data Peserta!</p>
              <p className="text-[11px] text-emerald-800">Seluruh data telah tersimpan di database server cloud Firestore.</p>
            </div>
          </div>
        )}

        {/* Preview Table */}
        {parsedUsers.length > 0 && !importSummary && (
          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800">
                Pratinjau Data ({parsedUsers.length} Peserta Valid):
              </span>
              <span className="text-[10px] text-slate-400">
                Periksa data sebelum disimpan ke database
              </span>
            </div>

            <div className="overflow-x-auto max-h-56 border border-slate-200 rounded-xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 sticky top-0">
                  <tr>
                    <th className="p-2">No</th>
                    <th className="p-2">Nama Lengkap</th>
                    <th className="p-2">Email</th>
                    <th className="p-2">NPP</th>
                    <th className="p-2">Jabatan</th>
                    <th className="p-2">Peran</th>
                    <th className="p-2 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {parsedUsers.map((u, i) => (
                    <tr key={i} className="hover:bg-slate-50">
                      <td className="p-2 font-mono text-[11px] text-slate-400">{i + 1}</td>
                      <td className="p-2 font-bold text-slate-900">{u.name}</td>
                      <td className="p-2 font-mono text-[11px] text-slate-600">{u.email}</td>
                      <td className="p-2 font-mono text-[11px] text-slate-600">{u.npp || '-'}</td>
                      <td className="p-2 text-slate-700">{u.jabatan || 'Peserta'}</td>
                      <td className="p-2">
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                          u.role === 'ADMIN' ? 'bg-amber-100 text-amber-900' : 'bg-emerald-100 text-emerald-800'
                        }`}>
                          {u.role}
                        </span>
                      </td>
                      <td className="p-2 text-right">
                        <button
                          type="button"
                          onClick={() => handleRemoveRow(i)}
                          className="p-1 text-slate-400 hover:text-red-600 rounded-md transition-colors cursor-pointer"
                          title="Hapus baris ini dari impor"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-end gap-2 text-xs">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-slate-600 font-bold hover:bg-slate-100 cursor-pointer"
          >
            Batal
          </button>
          <button
            type="button"
            disabled={parsedUsers.length === 0 || isImporting}
            onClick={handleImportToDatabase}
            className="tactile-3d-btn-primary px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 cursor-pointer disabled:opacity-50 shadow-md"
          >
            {isImporting ? (
              <RefreshCw className="w-4 h-4 animate-spin text-amber-300" />
            ) : (
              <Users className="w-4 h-4 text-[#F4C542]" />
            )}
            <span>
              {isImporting ? 'Menyimpan ke Database...' : `Simpan ${parsedUsers.length} Peserta ke Database`}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
