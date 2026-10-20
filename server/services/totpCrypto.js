'use strict';

// Pure authentication primitives. No environment reads, database, logging or
// key provisioning. Callers must consume the returned counter atomically in DB.
const crypto = require('node:crypto');
const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const SECRET_BYTES = 20;
const PERIOD_SECONDS = 30;
const DIGITS = 6;
const ISSUER = 'OCCUPY MARS';

function encodeSecret(bytes) {
  if (!Buffer.isBuffer(bytes) || bytes.length !== SECRET_BYTES) throw new Error('TOTP_SECRET_INVALID');
  let value = 0;
  let bits = 0;
  let encoded = '';
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      encoded += BASE32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
    value &= (1 << bits) - 1;
  }
  if (bits) encoded += BASE32[(value << (5 - bits)) & 31];
  return encoded;
}

function decodeSecret(secret) {
  // Provisioning is canonical: exactly 160 bits, no padding or silent cleanup.
  if (typeof secret !== 'string' || !/^[A-Z2-7]{32}$/.test(secret)) throw new Error('TOTP_SECRET_INVALID');
  let value = 0;
  let bits = 0;
  const bytes = [];
  for (const char of secret) {
    value = (value << 5) | BASE32.indexOf(char);
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
      value &= (1 << bits) - 1;
    }
  }
  if (bits || bytes.length !== SECRET_BYTES) throw new Error('TOTP_SECRET_INVALID');
  return Buffer.from(bytes);
}

function counterForTime(nowMs) {
  if (!Number.isSafeInteger(nowMs) || nowMs < 0) throw new Error('TOTP_TIME_INVALID');
  return Math.floor(nowMs / (PERIOD_SECONDS * 1000));
}

function hotp(secretBytes, counter) {
  if (!Number.isSafeInteger(counter) || counter < 0) throw new Error('TOTP_COUNTER_INVALID');
  const message = Buffer.alloc(8);
  message.writeBigUInt64BE(BigInt(counter));
  const digest = crypto.createHmac('sha1', secretBytes).update(message).digest();
  const offset = digest[digest.length - 1] & 15;
  const binary = digest.readUInt32BE(offset) & 0x7fffffff;
  return String(binary % (10 ** DIGITS)).padStart(DIGITS, '0');
}

function generateTotp(secret, options = {}) {
  const bytes = decodeSecret(secret);
  try {
    return hotp(bytes, counterForTime(options.nowMs ?? Date.now()));
  } finally {
    bytes.fill(0);
  }
}

function verifyTotp(secret, code, options = {}) {
  const { lastCounter = -1, window = 1 } = options;
  if (!Number.isSafeInteger(lastCounter) || lastCounter < -1) throw new Error('TOTP_COUNTER_INVALID');
  if (window !== 0 && window !== 1) throw new Error('TOTP_WINDOW_INVALID');
  const currentCounter = counterForTime(options.nowMs ?? Date.now());
  const bytes = decodeSecret(secret);
  const validCode = typeof code === 'string' && /^\d{6}$/.test(code);
  const candidate = Buffer.from(validCode ? code : '000000', 'ascii');
  let match = null;
  try {
    for (let delta = -window; delta <= window; delta++) {
      const counter = currentCounter + delta;
      if (counter < 0) continue;
      const equal = crypto.timingSafeEqual(candidate, Buffer.from(hotp(bytes, counter), 'ascii'));
      // Compare every permitted candidate even when it was already consumed.
      if (equal && validCode && counter > lastCounter) match = counter;
    }
    return match;
  } finally {
    bytes.fill(0);
  }
}

function assertKey(key) {
  if (!Buffer.isBuffer(key) || key.length !== 32) throw new Error('TOTP_KEY_UNAVAILABLE');
}

function parseEncryptionKey(raw) {
  if (typeof raw !== 'string' || !/^[A-Za-z0-9+/]{43}=$/.test(raw)) throw new Error('TOTP_KEY_UNAVAILABLE');
  const key = Buffer.from(raw, 'base64');
  if (key.length !== 32 || key.toString('base64') !== raw) throw new Error('TOTP_KEY_UNAVAILABLE');
  return key;
}

function contextBytes(aad) {
  if (typeof aad !== 'string' || !aad || Buffer.byteLength(aad, 'utf8') > 512) throw new Error('TOTP_CONTEXT_REQUIRED');
  return Buffer.from(aad, 'utf8');
}

function encryptSecret(secret, key, aad, options = {}) {
  assertKey(key);
  const context = contextBytes(aad);
  const iv = options.iv === undefined ? crypto.randomBytes(12) : options.iv;
  if (!Buffer.isBuffer(iv) || iv.length !== 12) throw new Error('TOTP_IV_INVALID');
  const plaintext = decodeSecret(secret);
  try {
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv, { authTagLength: 16 });
    cipher.setAAD(context);
    const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    return ['v1', iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), ciphertext.toString('base64url')].join('.');
  } finally {
    plaintext.fill(0);
  }
}

function envelopePart(raw, length) {
  if (typeof raw !== 'string' || !/^[A-Za-z0-9_-]+$/.test(raw)) throw new Error('TOTP_SECRET_UNAVAILABLE');
  const part = Buffer.from(raw, 'base64url');
  if (part.length !== length || part.toString('base64url') !== raw) throw new Error('TOTP_SECRET_UNAVAILABLE');
  return part;
}

function decryptSecret(envelope, key, aad) {
  assertKey(key);
  const context = contextBytes(aad);
  let plaintext;
  try {
    if (typeof envelope !== 'string' || envelope.length > 256) throw new Error('TOTP_SECRET_UNAVAILABLE');
    const parts = envelope.split('.');
    if (parts.length !== 4 || parts[0] !== 'v1') throw new Error('TOTP_SECRET_UNAVAILABLE');
    const iv = envelopePart(parts[1], 12);
    const tag = envelopePart(parts[2], 16);
    const ciphertext = envelopePart(parts[3], SECRET_BYTES);
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv, { authTagLength: 16 });
    decipher.setAAD(context);
    decipher.setAuthTag(tag);
    plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return encodeSecret(plaintext);
  } catch (_) {
    // Never surface a supplied envelope, secret, key or backend crypto error.
    throw new Error('TOTP_SECRET_UNAVAILABLE');
  } finally {
    if (plaintext) plaintext.fill(0);
  }
}

function formatRecoveryCode(bytes) {
  if (!Buffer.isBuffer(bytes) || bytes.length !== 16) throw new Error('RECOVERY_CODE_INVALID');
  return bytes.toString('hex').toUpperCase().match(/.{4}/g).join('-');
}

function normalizeRecoveryCode(code) {
  if (typeof code !== 'string' || code.length > 80) throw new Error('RECOVERY_CODE_INVALID');
  const trimmed = code.trim();
  if (!/^(?:[a-fA-F0-9]{32}|(?:[a-fA-F0-9]{4}-){7}[a-fA-F0-9]{4})$/.test(trimmed)) throw new Error('RECOVERY_CODE_INVALID');
  return trimmed.replace(/-/g, '').toUpperCase();
}

function hashNormalizedRecovery(normalized) {
  return crypto.createHash('sha256').update('occupy-mars:recovery:v1\0' + normalized, 'utf8').digest('hex');
}

function recoveryHash(code) {
  return hashNormalizedRecovery(normalizeRecoveryCode(code));
}

function verifyRecovery(code, storedHash) {
  let normalized;
  let valid = true;
  try { normalized = normalizeRecoveryCode(code); } catch (_) { normalized = '0'.repeat(32); valid = false; }
  const validHash = typeof storedHash === 'string' && /^[a-f0-9]{64}$/.test(storedHash);
  const expected = Buffer.from(validHash ? storedHash : '0'.repeat(64), 'hex');
  const equal = crypto.timingSafeEqual(Buffer.from(hashNormalizedRecovery(normalized), 'hex'), expected);
  return valid && validHash && equal;
}

function buildOtpAuthUri(username, secret) {
  decodeSecret(secret).fill(0);
  if (typeof username !== 'string' || !username.trim() || username.length > 64 || /[\u0000-\u001f\u007f]/.test(username)) throw new Error('TOTP_ACCOUNT_INVALID');
  const label = encodeURIComponent(ISSUER) + ':' + encodeURIComponent(username);
  const query = new URLSearchParams({ secret, issuer: ISSUER, algorithm: 'SHA1', digits: String(DIGITS), period: String(PERIOD_SECONDS) });
  return 'otpauth://totp/' + label + '?' + query.toString();
}

module.exports = {
  SECRET_BYTES, PERIOD_SECONDS, DIGITS, ISSUER,
  encodeSecret, decodeSecret, counterForTime, generateTotp, verifyTotp,
  parseEncryptionKey, encryptSecret, decryptSecret,
  formatRecoveryCode, normalizeRecoveryCode, recoveryHash, verifyRecovery,
  buildOtpAuthUri,
};
