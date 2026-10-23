export interface ParsedEmployee {
  nama: string;
  email: string;
  npp: string;
  unit_kerja: string;
  role: 'ADMIN' | 'PANITIA' | 'PEGAWAI';
  status: 'aktif' | 'nonaktif';
}

export interface CsvParseResult {
  success: boolean;
  employees: ParsedEmployee[];
  errors: string[];
}

export function parseEmployeeCsv(csvContent: string): CsvParseResult {
  const result: CsvParseResult = {
    success: false,
    employees: [],
    errors: []
  };

  if (!csvContent || !csvContent.trim()) {
    result.errors.push('File CSV kosong');
    return result;
  }

  const lines = csvContent
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line.length > 0);

  if (lines.length < 2) {
    result.errors.push('File CSV harus memiliki baris judul kolom dan minimal satu baris data');
    return result;
  }

  const rawHeader = lines[0].toLowerCase();
  // Support both comma and semicolon separators
  const separator = rawHeader.includes(';') ? ';' : ',';
  const headers = lines[0]
    .split(separator)
    .map(h => h.trim().replace(/^["']|["']$/g, '').toLowerCase());

  const nameIdx = headers.findIndex(h => h.includes('nama') || h === 'name');
  const emailIdx = headers.findIndex(h => h.includes('email') || h === 'surel');
  const nppIdx = headers.findIndex(h => h.includes('npp') || h.includes('nik') || h === 'nip');
  const unitIdx = headers.findIndex(h => h.includes('unit') || h.includes('bagian') || h.includes('fakultas') || h.includes('kerja'));
  const roleIdx = headers.findIndex(h => h.includes('role') || h.includes('peran') || h.includes('jabatan'));
  const statusIdx = headers.findIndex(h => h.includes('status') || h.includes('keaktifan'));

  if (nameIdx === -1 || emailIdx === -1) {
    result.errors.push('Kolom Nama dan Email wajib ada dalam header CSV');
    return result;
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  for (let i = 1; i < lines.length; i++) {
    const row = lines[i].split(separator).map(cell => cell.trim().replace(/^["']|["']$/g, ''));
    if (row.length === 1 && !row[0]) continue;

    const nama = row[nameIdx] || '';
    const email = (row[emailIdx] || '').toLowerCase();
    const npp = nppIdx !== -1 ? row[nppIdx] || '' : '';
    const unit_kerja = unitIdx !== -1 ? row[unitIdx] || 'BPAIK' : 'BPAIK';

    let role: 'ADMIN' | 'PANITIA' | 'PEGAWAI' = 'PEGAWAI';
    if (roleIdx !== -1 && row[roleIdx]) {
      const r = row[roleIdx].toUpperCase();
      if (r === 'ADMIN' || r === 'PANITIA' || r === 'PEGAWAI') {
        role = r;
      }
    }

    let status: 'aktif' | 'nonaktif' = 'aktif';
    if (statusIdx !== -1 && row[statusIdx]) {
      const s = row[statusIdx].toLowerCase();
      if (s === 'nonaktif' || s === 'inactive' || s === 'tidak aktif') {
        status = 'nonaktif';
      }
    }

    if (!nama) {
      result.errors.push(`Baris ${i + 1}: Nama tidak boleh kosong`);
      continue;
    }

    if (!email || !emailRegex.test(email)) {
      result.errors.push(`Baris ${i + 1}: Format email '${email}' tidak valid`);
      continue;
    }

    result.employees.push({
      nama,
      email,
      npp,
      unit_kerja,
      role,
      status
    });
  }

  result.success = result.employees.length > 0 && result.errors.length === 0;
  return result;
}
