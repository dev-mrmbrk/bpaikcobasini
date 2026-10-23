export type UserRole = 'ADMIN' | 'PESERTA';
export type AccountStatus = 'aktif' | 'nonaktif';

export interface BPAIKUser {
  id: string;
  email: string; // Email pribadi (bukan email kampus)
  name: string;
  npp: string;
  jabatan: string; // Menggantikan unitKerja
  whatsapp: string; // Menggantikan hak akses
  avatarUrl?: string; // Foto profil ukuran 2x3 max 200kb
  role: UserRole; // 'ADMIN' atau 'PESERTA'
  qrUniqueCode?: string; // Kode unik untuk scan absen cadangan
  status: AccountStatus;
  createdAt?: string;
  updatedAt?: string;
}

export type EventStatus = 'dijadwalkan' | 'berlangsung' | 'selesai' | 'dibatalkan';
export type SessionStatus = 'belum_dibuka' | 'aktif' | 'ditutup';

export interface BPAIKEvent {
  id: string;
  title: string;
  description: string; // Deskripsi panjang
  startDateTime: string; // ISO datetime YYYY-MM-DDTHH:mm
  endDateTime: string; // ISO datetime YYYY-MM-DDTHH:mm
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  location: string;
  createdBy: string;
  creatorName: string;
  status: EventStatus;
  sessionDurationMinutes: number; // Durasi sesi dihitung setelah sesi dibuka (bukan jam kegiatan)
  sessionStatus: SessionStatus;
  sessionOpenedAt?: string | null;
  sessionClosedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export type AttendanceStatus = 'HADIR' | 'IZIN' | 'SAKIT' | 'ALPA';
export type SignatureStatus = 'MENUNGGU_KONFIRMASI' | 'TERKONFIRMASI';

export interface AttendanceRecord {
  id: string;
  eventId: string;
  eventTitle: string;
  eventDate: string;
  userId: string;
  userEmail: string;
  userName: string;
  userNpp: string;
  userJabatan: string;
  userWhatsapp?: string;
  scanTime: string; // ISO format
  attendanceStatus: AttendanceStatus;
  signatureStatus: SignatureStatus;
  signatureData?: string | null;
  signatureTimestamp?: string | null;
  verifiedBy?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export type LeaveStatus = 'MENUNGGU_ACC' | 'DISETUJUI' | 'DITOLAK';

export interface LeaveRequest {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  userNpp: string;
  userJabatan: string;
  userWhatsapp: string;
  eventId: string;
  eventTitle: string;
  eventDate: string;
  reason: string; // Alasan izin
  status: LeaveStatus;
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  adminNotes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AuditLog {
  id: string;
  action: string;
  actorEmail: string;
  actorName: string;
  actorRole: string;
  targetType: string;
  targetId: string;
  description: string;
  details?: Record<string, unknown> | string;
  timestamp: string;
}
