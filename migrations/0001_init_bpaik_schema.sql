-- Schema awal PortalBPAIK
-- Tidak memasukkan data contoh atau akun demo.

CREATE TABLE users (
  id TEXT PRIMARY KEY NOT NULL,
  email TEXT NOT NULL COLLATE NOCASE UNIQUE,
  name TEXT NOT NULL,
  npp TEXT NOT NULL DEFAULT '',
  jabatan TEXT NOT NULL DEFAULT '',
  whatsapp TEXT NOT NULL DEFAULT '',
  avatar_url TEXT,
  role TEXT NOT NULL CHECK (role IN ('ADMIN', 'PESERTA')),
  qr_unique_code TEXT UNIQUE,
  status TEXT NOT NULL DEFAULT 'aktif'
    CHECK (status IN ('aktif', 'nonaktif')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX idx_users_name ON users(name);
CREATE INDEX idx_users_role_status ON users(role, status);

CREATE TABLE events (
  id TEXT PRIMARY KEY NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  start_datetime TEXT NOT NULL,
  end_datetime TEXT NOT NULL,
  event_date TEXT NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  location TEXT NOT NULL DEFAULT '',
  created_by TEXT NOT NULL,
  creator_name TEXT NOT NULL,
  status TEXT NOT NULL
    CHECK (status IN ('dijadwalkan', 'berlangsung', 'selesai', 'dibatalkan')),
  session_duration_minutes INTEGER NOT NULL DEFAULT 60
    CHECK (session_duration_minutes > 0),
  session_status TEXT NOT NULL DEFAULT 'belum_dibuka'
    CHECK (session_status IN ('belum_dibuka', 'aktif', 'ditutup')),
  session_opened_at TEXT,
  session_closed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX idx_events_date ON events(event_date);
CREATE INDEX idx_events_session_status ON events(session_status);

CREATE TABLE attendance_records (
  id TEXT PRIMARY KEY NOT NULL,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE RESTRICT,
  event_title TEXT NOT NULL,
  event_date TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  user_email TEXT NOT NULL,
  user_name TEXT NOT NULL,
  user_npp TEXT NOT NULL DEFAULT '',
  user_jabatan TEXT NOT NULL DEFAULT '',
  user_whatsapp TEXT,
  scan_time TEXT NOT NULL,
  attendance_status TEXT NOT NULL
    CHECK (attendance_status IN ('HADIR', 'IZIN', 'SAKIT', 'ALPA')),
  signature_status TEXT NOT NULL DEFAULT 'MENUNGGU_KONFIRMASI'
    CHECK (signature_status IN ('MENUNGGU_KONFIRMASI', 'TERKONFIRMASI')),
  signature_data TEXT,
  signature_timestamp TEXT,
  verified_by TEXT,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (event_id, user_id)
);

CREATE INDEX idx_attendance_date ON attendance_records(event_date);
CREATE INDEX idx_attendance_user ON attendance_records(user_id, scan_time);
CREATE INDEX idx_attendance_event ON attendance_records(event_id);
CREATE INDEX idx_attendance_signature ON attendance_records(signature_status);

CREATE TABLE leave_requests (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  user_name TEXT NOT NULL,
  user_email TEXT NOT NULL,
  user_npp TEXT NOT NULL DEFAULT '',
  user_jabatan TEXT NOT NULL DEFAULT '',
  user_whatsapp TEXT NOT NULL DEFAULT '',
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE RESTRICT,
  event_title TEXT NOT NULL,
  event_date TEXT NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'MENUNGGU_ACC'
    CHECK (status IN ('MENUNGGU_ACC', 'DISETUJUI', 'DITOLAK')),
  reviewed_by TEXT,
  reviewed_at TEXT,
  admin_notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX idx_leave_user ON leave_requests(user_id, created_at);
CREATE INDEX idx_leave_status ON leave_requests(status, event_date);

CREATE TABLE audit_logs (
  id TEXT PRIMARY KEY NOT NULL,
  action TEXT NOT NULL,
  actor_email TEXT NOT NULL DEFAULT '',
  actor_name TEXT NOT NULL DEFAULT '',
  actor_role TEXT NOT NULL DEFAULT '',
  target_type TEXT NOT NULL DEFAULT '',
  target_id TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  details_json TEXT,
  timestamp TEXT NOT NULL
);

CREATE INDEX idx_audit_timestamp ON audit_logs(timestamp);
CREATE INDEX idx_audit_action ON audit_logs(action);
CREATE INDEX idx_audit_actor ON audit_logs(actor_email);
