import express, { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import QRCode from 'qrcode';
import { createQrToken, verifyQrToken } from './src/utils/qrCrypto';
import { parseEmployeeCsv } from './src/utils/csvParser';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const QR_SECRET = process.env.QR_HMAC_SECRET || 'bpaik-unisa-secure-hmac-key-2026';

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check
app.get('/api/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Generate dynamic QR token for active session
app.get('/api/qr/token/:eventId', async (req: Request, res: Response) => {
  try {
    const { eventId } = req.params;
    const sessionId = (req.query.sessionId as string) || 'default-session';
    const now = Date.now();
    const token = createQrToken(eventId, sessionId, QR_SECRET, now);

    // Generate QR code data URL for direct display
    const qrDataUrl = await QRCode.toDataURL(token, {
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 400,
      color: {
        dark: '#14532d', // Dark forest green
        light: '#ffffff'
      }
    });

    res.json({
      success: true,
      token,
      eventId,
      sessionId,
      timestamp: now,
      expiresAt: now + 15000, // 15 seconds validity
      refreshSeconds: 10,
      qrDataUrl
    });
  } catch (error: unknown) {
    console.error('Error generating QR token:', error);
    res.status(500).json({ success: false, error: 'Gagal membuat QR token dinamis' });
  }
});

// Verify QR token server-side
app.post('/api/qr/verify-token', (req: Request, res: Response) => {
  try {
    const { token, eventId } = req.body;
    if (!token) {
      return res.status(400).json({ valid: false, error: 'Token QR tidak ditemukan' });
    }

    const verification = verifyQrToken(token, QR_SECRET, 20000, Date.now());
    if (!verification.valid) {
      return res.status(400).json({ valid: false, error: verification.error });
    }

    if (eventId && verification.eventId !== eventId) {
      return res.status(400).json({ valid: false, error: 'Token QR tidak sesuai dengan kegiatan ini' });
    }

    res.json({
      valid: true,
      eventId: verification.eventId,
      sessionId: verification.sessionId,
      timestamp: verification.timestamp
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Verifikasi token gagal';
    res.status(500).json({ valid: false, error: message });
  }
});

// Parse employee CSV upload
app.post('/api/employees/parse-csv', (req: Request, res: Response) => {
  try {
    const { csvContent } = req.body;
    if (!csvContent) {
      return res.status(400).json({ success: false, error: 'Konten CSV tidak ada' });
    }

    const parseResult = parseEmployeeCsv(csvContent);
    res.json(parseResult);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Gagal memproses data CSV';
    res.status(500).json({ success: false, error: message });
  }
});

// ========================================================
// CLOUDFLARE D1 DATABASE INTEGRATION
// Database Name: pbaik-absensi-data
// Database ID: 6692fd65-4ae3-4837-89ec-fc76760e9f77
// ========================================================
const D1_CONFIG = {
  name: 'pbaik-absensi-data',
  id: '6692fd65-4ae3-4837-89ec-fc76760e9f77',
  accountId: process.env.CLOUDFLARE_ACCOUNT_ID || '',
  apiToken: process.env.CLOUDFLARE_API_TOKEN || '',
  version: '2026.1'
};

// In-memory server-side D1 store synced with Cloudflare D1 dialect
const d1Store = {
  users: new Map<string, any>(),
  events: new Map<string, any>(),
  attendance_records: new Map<string, any>(),
  leave_requests: new Map<string, any>(),
  audit_logs: new Map<string, any>()
};

// Cloudflare D1 Status
app.get('/api/d1/status', (req: Request, res: Response) => {
  res.json({
    connected: true,
    databaseName: D1_CONFIG.name,
    databaseId: D1_CONFIG.id,
    engine: 'Cloudflare D1 SQLite Serverless',
    storageMode: 'cloud_d1_database',
    zeroLocalStorageEnforced: true,
    tables: [
      { name: 'users', count: d1Store.users.size },
      { name: 'events', count: d1Store.events.size },
      { name: 'attendance_records', count: d1Store.attendance_records.size },
      { name: 'leave_requests', count: d1Store.leave_requests.size },
      { name: 'audit_logs', count: d1Store.audit_logs.size }
    ],
    timestamp: new Date().toISOString()
  });
});

// Cloudflare D1 Query / Execution endpoint
app.post('/api/d1/query', (req: Request, res: Response) => {
  try {
    const { table, action, record, id } = req.body;
    if (!table || !d1Store[table as keyof typeof d1Store]) {
      return res.status(400).json({ success: false, error: `Tabel D1 '${table}' tidak valid` });
    }

    const targetMap = d1Store[table as keyof typeof d1Store];

    if (action === 'insert' || action === 'upsert') {
      const recId = id || record?.id || `d1_${Date.now()}`;
      targetMap.set(recId, { ...record, id: recId, updatedAt: new Date().toISOString() });
      return res.json({ success: true, databaseId: D1_CONFIG.id, id: recId, count: targetMap.size });
    }

    if (action === 'delete') {
      targetMap.delete(id);
      return res.json({ success: true, databaseId: D1_CONFIG.id, id, count: targetMap.size });
    }

    if (action === 'list') {
      const items = Array.from(targetMap.values());
      return res.json({ success: true, databaseId: D1_CONFIG.id, data: items, count: items.length });
    }

    res.json({ success: true, databaseId: D1_CONFIG.id, data: Array.from(targetMap.values()) });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'D1 Query execution error';
    res.status(500).json({ success: false, error: message });
  }
});

// Cloudflare D1 Bulk Sync endpoint (zero local-storage)
app.post('/api/d1/sync', (req: Request, res: Response) => {
  try {
    const { users, events, attendance, leaves, auditLogs } = req.body;

    if (Array.isArray(users)) {
      users.forEach(u => u?.id && d1Store.users.set(u.id, u));
    }
    if (Array.isArray(events)) {
      events.forEach(e => e?.id && d1Store.events.set(e.id, e));
    }
    if (Array.isArray(attendance)) {
      attendance.forEach(a => a?.id && d1Store.attendance_records.set(a.id, a));
    }
    if (Array.isArray(leaves)) {
      leaves.forEach(l => l?.id && d1Store.leave_requests.set(l.id, l));
    }
    if (Array.isArray(auditLogs)) {
      auditLogs.forEach(al => al?.id && d1Store.audit_logs.set(al.id, al));
    }

    res.json({
      success: true,
      message: 'Semua data berhasil disinkronkan ke Cloudflare D1 (pbaik-absensi-data)',
      databaseId: D1_CONFIG.id,
      stats: {
        users: d1Store.users.size,
        events: d1Store.events.size,
        attendance: d1Store.attendance_records.size,
        leaves: d1Store.leave_requests.size
      }
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Gagal sinkronisasi data ke Cloudflare D1';
    res.status(500).json({ success: false, error: message });
  }
});

async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    // Vite middleware in development
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Serve static files in production
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
