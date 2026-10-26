import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createWorkerQrToken,
  verifyWorkerQrToken
} from '../worker';

const secret = 'test-only-worker-qr-secret';
const now = 1700000000000;

test('Worker QR token uses full 256-bit HMAC and validates', async () => {
  const token = await createWorkerQrToken(
    'event-1',
    'event-1_session',
    secret,
    now
  );

  const decoded = Buffer.from(token, 'base64url').toString('utf8');
  const parts = decoded.split(':');

  assert.equal(parts.length, 4);
  assert.match(parts[3], /^[0-9a-f]{64}$/);

  const result = await verifyWorkerQrToken(
    token, secret, 15000, now + 5000
  );

  assert.equal(result.valid, true);
  assert.equal(result.eventId, 'event-1');
  assert.equal(result.sessionId, 'event-1_session');
});

test('Worker rejects a QR token after 15 seconds', async () => {
  const token = await createWorkerQrToken(
    'event-1', 'event-1_session', secret, now
  );

  const result = await verifyWorkerQrToken(
    token, secret, 15000, now + 15001
  );

  assert.equal(result.valid, false);
  assert.match(result.error || '', /kedaluwarsa/i);
});

test('Worker rejects a token signed with the wrong secret', async () => {
  const token = await createWorkerQrToken(
    'event-1', 'event-1_session', secret, now
  );

  const result = await verifyWorkerQrToken(
    token, 'wrong-secret', 15000, now + 1000
  );

  assert.equal(result.valid, false);
});

test('Worker rejects a modified QR token', async () => {
  const token = await createWorkerQrToken(
    'event-1', 'event-1_session', secret, now
  );

  const decoded = Buffer.from(token, 'base64url').toString('utf8');
  const modified = decoded.replace('event-1', 'event-2');
  const forgedToken = Buffer.from(modified).toString('base64url');

  const result = await verifyWorkerQrToken(
    forgedToken, secret, 15000, now + 1000
  );

  assert.equal(result.valid, false);
});
