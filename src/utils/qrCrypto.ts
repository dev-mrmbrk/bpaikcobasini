import crypto from 'crypto';

export interface QrTokenPayload {
  eventId: string;
  sessionId: string;
  timestamp: number;
}

export function createQrToken(
  eventId: string,
  sessionId: string,
  secret: string,
  timestamp: number = Date.now()
): string {
  const payloadData = `${eventId}:${sessionId}:${timestamp}`;
  const hmac = crypto.createHmac('sha256', secret).update(payloadData).digest('hex').substring(0, 16);
  // Base64 encode token
  const token = Buffer.from(`${payloadData}:${hmac}`).toString('base64url');
  return token;
}

export interface VerifyQrResult {
  valid: boolean;
  eventId?: string;
  sessionId?: string;
  timestamp?: number;
  error?: string;
}

export function verifyQrToken(
  token: string,
  secret: string,
  maxAgeMs: number = 20000,
  now: number = Date.now()
): VerifyQrResult {
  try {
    if (!token || typeof token !== 'string') {
      return { valid: false, error: 'Token tidak boleh kosong' };
    }

    const decoded = Buffer.from(token, 'base64url').toString('utf8');
    const parts = decoded.split(':');
    if (parts.length !== 4) {
      return { valid: false, error: 'Format QR token tidak valid' };
    }

    const [eventId, sessionId, timestampStr, hmac] = parts;
    const timestamp = parseInt(timestampStr, 10);
    if (isNaN(timestamp)) {
      return { valid: false, error: 'Waktu token tidak valid' };
    }

    const expectedData = `${eventId}:${sessionId}:${timestamp}`;
    const expectedHmac = crypto.createHmac('sha256', secret).update(expectedData).digest('hex').substring(0, 16);

    // Constant-time compare
    const validSignature = crypto.timingSafeEqual(
      Buffer.from(hmac, 'utf8'),
      Buffer.from(expectedHmac, 'utf8')
    );

    if (!validSignature) {
      return { valid: false, error: 'Tanda tangan token QR tidak sah' };
    }

    // Check expiration (allow +/- maxAgeMs for slight clock skew)
    if (now - timestamp > maxAgeMs) {
      return { valid: false, error: 'QR code sudah kedaluwarsa (lebih dari 10 detik)' };
    }

    if (timestamp - now > 60000) {
      return { valid: false, error: 'Waktu token mendahului waktu server' };
    }

    return {
      valid: true,
      eventId,
      sessionId,
      timestamp
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Gagal memverifikasi token';
    return { valid: false, error: message };
  }
}
