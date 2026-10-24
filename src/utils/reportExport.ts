import * as XLSX from 'xlsx';
import { BPAIKEvent, AttendanceRecord, BPAIKUser } from '../types';

/**
 * Export Attendance to Excel matching the exact structure from the reference:
 * - Row 1: Nama_Kegiatan
 * - Row 2: Tanggal
 * - Row 3: Tempat
 * - Row 4: Empty
 * - Row 5: Table Header: No | Nama_Lengkap | Jabatan | ScanTime | TANDA_TANGAN (merged across 2 cols)
 * - Row 6: Subheader for Tanda Tangan: 1 | 2
 * - Row 7+: Alternating zigzag signature numbers and attendance records
 */
export function exportAttendanceToExcel(event: BPAIKEvent, records: AttendanceRecord[]) {
  const wb = XLSX.utils.book_new();

  // Sort records by scan time ascending or name
  const sortedRecords = [...records].sort((a, b) => new Date(a.scanTime).getTime() - new Date(b.scanTime).getTime());

  // Prepare header rows
  const wsData: (string | number)[][] = [
    ['Nama_Kegiatan', event.title],
    ['Tanggal', event.date || new Date().toISOString().split('T')[0]],
    ['Tempat', event.location || 'Universitas \'Aisyiyah Bandung'],
    [], // empty row
    ['No', 'Nama_Lengkap', 'Jabatan', 'ScanTime', 'TANDA_TANGAN', ''],
    ['', '', '', '', '1', '2']
  ];

  // Ekspor hanya data yang tersedia; jumlah baris bertambah mengikuti kehadiran.
  const totalRows = sortedRecords.length;

  for (let i = 0; i < totalRows; i++) {
    const rowNumber = i + 1;
    const rec = sortedRecords[i];
    const isIzin = rec && (rec.attendanceStatus === 'IZIN' || (rec.notes && rec.notes.toLowerCase().includes('izin')));
    const isSakit = rec && rec.attendanceStatus === 'SAKIT';
    const isAlpa = rec && rec.attendanceStatus === 'ALPA';

    const nama = rec ? rec.userName : '';
    const jabatan = rec ? (rec.userJabatan || 'Peserta') : '';
    const scanTime = isIzin
      ? 'Izin (Tidak Hadir)'
      : isSakit
      ? 'Sakit (Tidak Hadir)'
      : isAlpa
      ? 'Tidak Hadir'
      : rec
      ? new Date(rec.scanTime).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' WIB'
      : '';

    // Alternating signature columns:
    // Odd row (rowNumber 1, 3, 5, ...): col 1 has rowNumber, col 2 is empty
    // Even row (rowNumber 2, 4, 6, ...): col 1 is empty, col 2 has rowNumber
    let sigCol1: string | number = '';
    let sigCol2: string | number = '';

    if (isIzin) {
      if (rowNumber % 2 !== 0) {
        sigCol1 = `${rowNumber}. Izin (Tidak Hadir)`;
        sigCol2 = '';
      } else {
        sigCol1 = '';
        sigCol2 = `${rowNumber}. Izin (Tidak Hadir)`;
      }
    } else if (rowNumber % 2 !== 0) {
      // Odd row (1, 3, 5...)
      sigCol1 = rec && rec.signatureStatus === 'TERKONFIRMASI' ? `${rowNumber} (Sah ✓)` : rowNumber;
      sigCol2 = '';
    } else {
      // Even row (2, 4, 6...)
      sigCol1 = '';
      sigCol2 = rec && rec.signatureStatus === 'TERKONFIRMASI' ? `${rowNumber} (Sah ✓)` : rowNumber;
    }

    wsData.push([
      rowNumber,
      nama,
      jabatan,
      scanTime,
      sigCol1,
      sigCol2
    ]);
  }

  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Column widths
  ws['!cols'] = [
    { wch: 6 },  // No
    { wch: 34 }, // Nama_Lengkap
    { wch: 28 }, // Jabatan
    { wch: 18 }, // ScanTime
    { wch: 16 }, // Tanda Tangan 1
    { wch: 16 }  // Tanda Tangan 2
  ];

  // Merges for header:
  // Merged "TANDA_TANGAN" in row 5 across col 4 and 5 (E5:F5 -> {s: {r:4, c:4}, e: {r:4, c:5}})
  // Merged "No" row 5-6 (A5:A6 -> {s: {r:4, c:0}, e: {r:5, c:0}})
  // Merged "Nama_Lengkap" row 5-6 (B5:B6 -> {s: {r:4, c:1}, e: {r:5, c:1}})
  // Merged "Jabatan" row 5-6 (C5:C2 -> {s: {r:4, c:2}, e: {r:5, c:2}})
  // Merged "ScanTime" row 5-6 (D5:D6 -> {s: {r:4, c:3}, e: {r:5, c:3}})
  ws['!merges'] = [
    { s: { r: 4, c: 4 }, e: { r: 4, c: 5 } }, // TANDA_TANGAN merged header
    { s: { r: 4, c: 0 }, e: { r: 5, c: 0 } }, // No
    { s: { r: 4, c: 1 }, e: { r: 5, c: 1 } }, // Nama_Lengkap
    { s: { r: 4, c: 2 }, e: { r: 5, c: 2 } }, // Jabatan
    { s: { r: 4, c: 3 }, e: { r: 5, c: 3 } }  // ScanTime
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Daftar Hadir');

  // Generate clean filename
  const cleanTitle = event.title.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 30);
  const fileName = `Daftar_Hadir_${cleanTitle}_${event.date || 'BPAIK'}.xlsx`;

  XLSX.writeFile(wb, fileName);
}

/**
 * Download official Excel template for importing participants
 */
export function downloadParticipantTemplateExcel() {
  const wb = XLSX.utils.book_new();

  const headers = [
    ['Nama_Lengkap', 'Email', 'NPP_NIK', 'Jabatan', 'WhatsApp', 'Role', 'Status'],
    ['Dr. H. Ahmad Dahlan, M.Ag.', 'ahmad.dahlan@unisa-bandung.ac.id', '0422019800', 'Dosen Fakultas Ilmu Kesehatan', '081223344550', 'PESERTA', 'aktif'],
    ['Dra. Hj. Siti Walidah, M.Kes.', 'siti.walidah@unisa-bandung.ac.id', '0415038102', 'Tenaga Kependidikan / SDM', '081298765432', 'PESERTA', 'aktif'],
    ['Muhammad Ridwan, S.Kom.', 'ridwan.admin@unisa-bandung.ac.id', '0419089201', 'Administrator IT BPAIK', '085712345678', 'ADMIN', 'aktif']
  ];

  const ws = XLSX.utils.aoa_to_sheet(headers);
  ws['!cols'] = [
    { wch: 32 }, // Nama_Lengkap
    { wch: 34 }, // Email
    { wch: 18 }, // NPP_NIK
    { wch: 30 }, // Jabatan
    { wch: 18 }, // WhatsApp
    { wch: 14 }, // Role (ADMIN/PESERTA)
    { wch: 12 }  // Status (aktif/nonaktif)
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Template Peserta');
  XLSX.writeFile(wb, 'Template_Data_Peserta_BPAIK.xlsx');
}

/**
 * Parse Excel (.xlsx, .xls) or CSV file uploaded by Admin
 */
export async function parseParticipantExcelFile(file: File): Promise<{
  validUsers: Omit<BPAIKUser, 'id'>[];
  errors: string[];
}> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });

        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];

        const jsonRows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

        const validUsers: Omit<BPAIKUser, 'id'>[] = [];
        const errors: string[] = [];

        if (jsonRows.length === 0) {
          errors.push('File Excel tidak memiliki baris data.');
          resolve({ validUsers, errors });
          return;
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        jsonRows.forEach((row, index) => {
          const rowNum = index + 2; // header is row 1
          
          // Flexible key lookup
          const getVal = (possibleKeys: string[]): string => {
            for (const key of Object.keys(row)) {
              const cleanKey = key.toLowerCase().replace(/[^a-z0-9]/g, '');
              for (const pk of possibleKeys) {
                if (cleanKey.includes(pk)) {
                  return String(row[key] || '').trim();
                }
              }
            }
            return '';
          };

          const name = getVal(['nama', 'name', 'lengkap']);
          const email = getVal(['email', 'surel', 'mail']).toLowerCase();
          const npp = getVal(['npp', 'nik', 'nip', 'nomor']);
          const jabatan = getVal(['jabatan', 'unit', 'bagian', 'prodi', 'posisi']) || 'Peserta Kegiatan';
          const whatsapp = getVal(['wa', 'whatsapp', 'telp', 'hp', 'phone']);
          const rawRole = getVal(['role', 'peran', 'akses']).toUpperCase();
          const rawStatus = getVal(['status', 'keaktifan']).toLowerCase();

          if (!name) {
            errors.push(`Baris ${rowNum}: Nama lengkap tidak boleh kosong.`);
            return;
          }

          if (!email || !emailRegex.test(email)) {
            errors.push(`Baris ${rowNum}: Format email '${email}' tidak valid.`);
            return;
          }

          const role = rawRole === 'ADMIN' ? 'ADMIN' : 'PESERTA';
          const status = rawStatus === 'nonaktif' || rawStatus === 'inactive' ? 'nonaktif' : 'aktif';

          validUsers.push({
            name,
            email,
            npp: npp || `NPP. ${Date.now().toString().slice(-7)}`,
            jabatan,
            whatsapp: whatsapp || '',
            role,
            status,
            qrUniqueCode: `BPAIK-KARTU-${npp ? npp.replace(/[^a-zA-Z0-9]/g, '') : Date.now().toString().slice(-6)}`
          });
        });

        resolve({ validUsers, errors });
      } catch (err: unknown) {
        console.error('Error parsing excel:', err);
        const msg = err instanceof Error ? err.message : 'Gagal membaca file Excel';
        reject(new Error(msg));
      }
    };

    reader.onerror = () => {
      reject(new Error('Gagal membaca file'));
    };

    reader.readAsArrayBuffer(file);
  });
}
