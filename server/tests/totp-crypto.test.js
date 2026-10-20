'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const totp = require('../services/totpCrypto');

// Public RFC test material and fixed dummy key/IV only. No real enrollment or
// credential generation, clock, environment, DB, mail or network is used.
const SECRET_BYTES = Buffer.from('12345678901234567890', 'ascii');
const SECRET = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';
const KEY = Buffer.from('fixture-only-key-not-for-prod!!!', 'ascii');
const IV = Buffer.from('fixture-iv12', 'ascii');
const CONTEXT = 'totp:fixture-account:revision-1';

test('canonical Base32 roundtrip preserves exactly 160 bits', () => {
  assert.equal(totp.encodeSecret(SECRET_BYTES), SECRET);
  assert.deepEqual(totp.decodeSecret(SECRET), SECRET_BYTES);
  assert.equal(totp.encodeSecret(Buffer.from('000102030405060708090a0b0c0d0e0f10111213', 'hex')), 'AAAQEAYEAUDAOCAJBIFQYDIOB4IBCEQT');
});

test('noncanonical, undersized and oversized secrets fail closed', () => {
  for (const secret of [null, '', SECRET.toLowerCase(), SECRET + '=', ' ' + SECRET, SECRET.slice(1), SECRET + 'A', SECRET.replace('G', '0')]) {
    assert.throws(() => totp.decodeSecret(secret), /^Error: TOTP_SECRET_INVALID$/);
  }
  assert.throws(() => totp.encodeSecret(Buffer.alloc(19)), /TOTP_SECRET_INVALID/);
  assert.throws(() => totp.encodeSecret(new Uint8Array(20)), /TOTP_SECRET_INVALID/);
});

test('RFC6238 SHA1 vectors produce the six-digit truncation required by the app', () => {
  const vectors = [
    [59, '287082'],
    [1111111109, '081804'],
    [1111111111, '050471'],
    [1234567890, '005924'],
    [2000000000, '279037'],
    [20000000000, '353130'],
  ];
  for (const [seconds, expected] of vectors) {
    assert.equal(totp.generateTotp(SECRET, { nowMs: seconds * 1000 }), expected);
    assert.equal(totp.verifyTotp(SECRET, expected, { nowMs: seconds * 1000, window: 0 }), Math.floor(seconds / 30));
  }
});

test('30-second boundaries and narrow +/- one window work without widening', () => {
  const at = 90_000;
  assert.equal(totp.counterForTime(29_999), 0);
  assert.equal(totp.counterForTime(30_000), 1);
  assert.equal(totp.generateTotp(SECRET, { nowMs: 29_999 }), '755224');
  assert.equal(totp.generateTotp(SECRET, { nowMs: 30_000 }), '287082');
  for (const delta of [-1, 0, 1]) {
    const code = totp.generateTotp(SECRET, { nowMs: at + delta * 30_000 });
    assert.equal(totp.verifyTotp(SECRET, code, { nowMs: at }), 3 + delta);
  }
  const tooOld = totp.generateTotp(SECRET, { nowMs: at - 60_000 });
  const tooNew = totp.generateTotp(SECRET, { nowMs: at + 60_000 });
  assert.equal(totp.verifyTotp(SECRET, tooOld, { nowMs: at }), null);
  assert.equal(totp.verifyTotp(SECRET, tooNew, { nowMs: at }), null);
  assert.throws(() => totp.verifyTotp(SECRET, '123456', { nowMs: at, window: 2 }), /TOTP_WINDOW_INVALID/);
});

test('consumed counter prevents reuse and older-window rollback', () => {
  const nowMs = 90_000;
  const code = totp.generateTotp(SECRET, { nowMs });
  assert.equal(totp.verifyTotp(SECRET, code, { nowMs, lastCounter: 2 }), 3);
  assert.equal(totp.verifyTotp(SECRET, code, { nowMs, lastCounter: 3 }), null);
  assert.equal(totp.verifyTotp(SECRET, code, { nowMs, lastCounter: 4 }), null);
  const previousCode = totp.generateTotp(SECRET, { nowMs: 60_000 });
  assert.equal(totp.verifyTotp(SECRET, previousCode, { nowMs, lastCounter: 3 }), null);
  assert.throws(() => totp.verifyTotp(SECRET, code, { nowMs, lastCounter: '3' }), /TOTP_COUNTER_INVALID/);
});

test('codes remain strings so leading zeroes cannot disappear', () => {
  const nowMs = 1234567890_000;
  assert.equal(totp.verifyTotp(SECRET, '005924', { nowMs, window: 0 }), 41152263);
  for (const code of [5924, '5924', ' 005924', '005924\n', '００５９２４', null, '', '0000000', {}]) {
    assert.equal(totp.verifyTotp(SECRET, code, { nowMs }), null);
  }
  for (const now of [-1, NaN, Infinity, '90000', 1.5, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => totp.generateTotp(SECRET, { nowMs: now }), /TOTP_TIME_INVALID/);
  }
});

test('verification compares every permitted window candidate', () => {
  const original = crypto.timingSafeEqual;
  let calls = 0;
  crypto.timingSafeEqual = (...args) => { calls++; return original(...args); };
  try {
    totp.verifyTotp(SECRET, totp.generateTotp(SECRET, { nowMs: 90_000 }), { nowMs: 90_000 });
    assert.equal(calls, 3);
    calls = 0;
    totp.verifyTotp(SECRET, 'invalid', { nowMs: 90_000 });
    assert.equal(calls, 3);
  } finally { crypto.timingSafeEqual = original; }
});

test('key parsing requires canonical base64 of exactly 32 bytes', () => {
  assert.equal(KEY.length, 32);
  assert.deepEqual(totp.parseEncryptionKey(KEY.toString('base64')), KEY);
  for (const raw of [undefined, '', KEY.toString('hex'), KEY.toString('base64url'), KEY.toString('base64') + '\n', Buffer.alloc(31).toString('base64'), Buffer.alloc(33).toString('base64')]) {
    assert.throws(() => totp.parseEncryptionKey(raw), /^Error: TOTP_KEY_UNAVAILABLE$/);
  }
});

test('AES-256-GCM roundtrip is context-bound and contains no plaintext secret', () => {
  assert.equal(IV.length, 12);
  const envelope = totp.encryptSecret(SECRET, KEY, CONTEXT, { iv: IV });
  assert.match(envelope, /^v1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
  assert.equal(envelope.includes(SECRET), false);
  assert.equal(totp.decryptSecret(envelope, KEY, CONTEXT), SECRET);
  assert.throws(() => totp.decryptSecret(envelope, KEY, 'totp:other-account:revision-1'), /^Error: TOTP_SECRET_UNAVAILABLE$/);
  assert.throws(() => totp.decryptSecret(envelope, Buffer.alloc(32, 9), CONTEXT), /^Error: TOTP_SECRET_UNAVAILABLE$/);
});

test('tampering with IV, tag, ciphertext, version or envelope fails closed', () => {
  const envelope = totp.encryptSecret(SECRET, KEY, CONTEXT, { iv: IV });
  for (const index of [1, 2, 3]) {
    const parts = envelope.split('.');
    const bytes = Buffer.from(parts[index], 'base64url');
    bytes[0] ^= 1;
    parts[index] = bytes.toString('base64url');
    assert.throws(() => totp.decryptSecret(parts.join('.'), KEY, CONTEXT), /^Error: TOTP_SECRET_UNAVAILABLE$/);
  }
  for (const invalid of [null, '', envelope.replace('v1.', 'v2.'), envelope + '.extra', envelope + '=', 'v1.a.b.c']) {
    assert.throws(() => totp.decryptSecret(invalid, KEY, CONTEXT), /^Error: TOTP_SECRET_UNAVAILABLE$/);
  }
  for (const key of [null, '', Buffer.alloc(31), Buffer.alloc(33)]) {
    assert.throws(() => totp.encryptSecret(SECRET, key, CONTEXT, { iv: IV }), /TOTP_KEY_UNAVAILABLE/);
  }
  assert.throws(() => totp.encryptSecret(SECRET, KEY, '', { iv: IV }), /TOTP_CONTEXT_REQUIRED/);
  assert.throws(() => totp.encryptSecret(SECRET, KEY, CONTEXT, { iv: Buffer.alloc(11) }), /TOTP_IV_INVALID/);
});

test('recovery code formatting and normalization preserve full 128-bit fixture', () => {
  const bytes = Buffer.from('0123456789abcdeffedcba9876543210', 'hex');
  const code = '0123-4567-89AB-CDEF-FEDC-BA98-7654-3210';
  assert.equal(totp.formatRecoveryCode(bytes), code);
  const digest = totp.recoveryHash(code);
  assert.match(digest, /^[a-f0-9]{64}$/);
  assert.notEqual(digest, code);
  assert.equal(totp.recoveryHash('  ' + code.toLowerCase() + '  '), digest);
  assert.equal(totp.recoveryHash(bytes.toString('hex')), digest);
  assert.equal(totp.verifyRecovery(code, digest), true);
  assert.equal(totp.verifyRecovery(code.toLowerCase(), digest), true);
  assert.equal(totp.verifyRecovery('1123-4567-89AB-CDEF-FEDC-BA98-7654-3210', digest), false);
});

test('malformed recovery inputs and stored hashes never authenticate', () => {
  const digest = totp.recoveryHash('0123456789abcdeffedcba9876543210');
  for (const value of [null, 1234, '', '----0123456789abcdeffedcba9876543210', '0123456789abcdeffedcba987654321g', 'A'.repeat(81)]) {
    assert.equal(totp.verifyRecovery(value, digest), false);
    assert.throws(() => totp.recoveryHash(value), /^Error: RECOVERY_CODE_INVALID$/);
  }
  for (const hash of [null, '', digest.toUpperCase(), digest.slice(1), 'g'.repeat(64)]) {
    assert.equal(totp.verifyRecovery('0123456789abcdeffedcba9876543210', hash), false);
  }
  assert.throws(() => totp.formatRecoveryCode(Buffer.alloc(15)), /RECOVERY_CODE_INVALID/);
});

test('otpauth URI carries the exact issuer and Google Authenticator contract', () => {
  const uri = totp.buildOtpAuthUri('fixture:name /한글', SECRET);
  const parsed = new URL(uri);
  assert.equal(parsed.protocol, 'otpauth:');
  assert.equal(parsed.hostname, 'totp');
  assert.match(parsed.pathname, /OCCUPY%20MARS:fixture%3Aname%20%2F/);
  assert.equal(parsed.searchParams.get('secret'), SECRET);
  assert.equal(parsed.searchParams.get('issuer'), 'OCCUPY MARS');
  assert.equal(parsed.searchParams.get('algorithm'), 'SHA1');
  assert.equal(parsed.searchParams.get('digits'), '6');
  assert.equal(parsed.searchParams.get('period'), '30');
  for (const username of ['', ' ', null, 'x\nname', 'x'.repeat(65)]) {
    assert.throws(() => totp.buildOtpAuthUri(username, SECRET), /TOTP_ACCOUNT_INVALID/);
  }
});

test('fixture suite does not generate actual secrets, IVs, recovery codes or keys', () => {
  const original = crypto.randomBytes;
  crypto.randomBytes = () => { throw new Error('fixture must supply entropy'); };
  try {
    const envelope = totp.encryptSecret(SECRET, KEY, CONTEXT, { iv: IV });
    assert.equal(totp.decryptSecret(envelope, KEY, CONTEXT), SECRET);
    assert.equal(totp.formatRecoveryCode(Buffer.alloc(16, 1)).length, 39);
    assert.throws(() => totp.encryptSecret(SECRET, KEY, CONTEXT), /fixture must supply entropy/);
  } finally { crypto.randomBytes = original; }
});
