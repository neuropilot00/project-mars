'use strict';

const crypto = require('node:crypto');
const protocol = require('./totpCrypto');
const TTL_SECONDS = 300;
const MAX_ATTEMPTS = 5;
const LOCK_MS = 15 * 60 * 1000;
const DAILY_WINDOW_MS = 24 * 60 * 60 * 1000;
const DAILY_ATTEMPTS = 5;
const digest = value => crypto.createHash('sha256').update(value).digest('hex');
const validTicket = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const normalizeUsername = value => typeof value === 'string' ? value.trim().toLowerCase() : '';
const validUsername = value => /^[a-z0-9_]{4,24}$/.test(value);
const equalHash = (value, expected) => typeof value === 'string' && /^[a-f0-9]{64}$/.test(expected || '') &&
  crypto.timingSafeEqual(Buffer.from(digest(value), 'hex'), Buffer.from(expected, 'hex'));

class TotpAuthError extends Error {
  constructor(code, status) { super(code); this.code = code; this.status = status; }
}
const invalid = () => new TotpAuthError('auth_invalid', 401);
const unavailable = () => new TotpAuthError('auth_unavailable', 503);

// Pure factory at import: no environment files, database, HTTP or JWT library.
// Tests inject fixed bytes/IV/clock/signer; production entropy is never called by fixtures.
function createService({ pool, signToken, clock = Date.now, randomBytes = crypto.randomBytes,
  enabled = () => process.env.TOTP_AUTH_ENABLED === 'true',
  encryptionKey = () => process.env.TOTP_ENCRYPTION_KEY,
  jwtConfigured = () => Boolean(process.env.JWT_SECRET), primitives = protocol,
  getPPToGPRate = client => require('../db').getPPToGPRate(client) } = {}) {
  function key() { try { return primitives.parseEncryptionKey(encryptionKey()); } catch (_) { throw unavailable(); } }
  function config() {
    let configured = false;
    try { configured = Boolean(enabled() && jwtConfigured() && key()); } catch (_) {}
    return { enabled: configured, kind: 'totp', enrollmentTtlSeconds: TTL_SECONDS,
      recoveryCodeCount: 10, recoveryCodesAfterConfirmation: 9 };
  }
  async function availableConfig() {
    const result = config();
    if (!result.enabled || !pool) return { ...result, enabled: false, schemaReady: false };
    let client;
    try {
      client = await pool.connect();
      // Resolve every TOTP column without reading account data. Missing or partial
      // migrations must not advertise an available signup method.
      await client.query(`/* totp:schema-readiness */ SELECT
        t.username,t.wallet_address,t.encrypted_secret,t.last_counter,t.recovery_hashes,
        t.session_version,t.status,t.failed_attempts,t.failed_daily_count,t.failed_window_start,t.locked_until,
        e.enrollment_hash,e.secret_hash,e.username,e.encrypted_secret,e.kind,e.wallet_address,
        e.target_version,e.state,e.verified_counter,e.pending_recovery_hashes,e.confirmation_hash,
        e.failed_attempts,e.expires_at
        FROM totp_identities t CROSS JOIN totp_enrollments e WHERE false`);
      return { ...result, schemaReady: true };
    } catch (_) { return { ...result, enabled: false, schemaReady: false }; }
    finally { if (client) client.release(); }
  }
  function ready() { if (!config().enabled || !pool || typeof signToken !== 'function') throw unavailable(); return key(); }
  async function tx(fn) {
    let client;
    try {
      client = await pool.connect(); await client.query('BEGIN');
      const result = await fn(client);
      await client.query('COMMIT'); return result;
    } catch (error) {
      if (client) { try { await client.query('ROLLBACK'); } catch (_) {} }
      if (error instanceof TotpAuthError) throw error;
      throw unavailable();
    } finally { if (client) client.release(); }
  }
  function unpack(value) {
    const result = typeof value === 'string' ? JSON.parse(value) : value;
    if (!Array.isArray(result) || result.some(h => typeof h !== 'string' || !/^[a-f0-9]{64}$/.test(h))) throw unavailable();
    return result;
  }
  function finish(result) { if (!result || result.invalid) throw invalid(); return result; }
  async function grantSignupBenefits(client, wallet) {
    // Match email signup's administrator settings without changing their values.
    // The existing exchange-rate helper accepts this transaction client. Resolve
    // it lazily so importing this factory never loads db.js or constructs a Pool.
    const bonusSetting = await client.query(
      "/* totp:signup-bonus-setting */ SELECT value FROM settings WHERE key = 'signup_pp_bonus'");
    const bonus = bonusSetting.rows.length ? Number(bonusSetting.rows[0].value) : 0;
    if (bonus > 0) {
      const rate = await getPPToGPRate(client);
      const gpBonus = Math.round(bonus * rate * 1000000) / 1000000;
      if (!Number.isFinite(bonus) || !Number.isFinite(rate) || rate <= 0 || !Number.isFinite(gpBonus)) throw unavailable();
      const credited = await client.query(
        '/* totp:signup-gp */ UPDATE users SET gp_balance = COALESCE(gp_balance, 0) + $2 WHERE LOWER(wallet_address) = LOWER($1)',
        [wallet, gpBonus]);
      if (credited.rowCount !== 1) throw unavailable();
    }
    const mineralSetting = await client.query(
      "/* totp:signup-minerals-setting */ SELECT value FROM settings WHERE key = 'signup_starter_minerals'");
    const value = mineralSetting.rows[0]?.value;
    const pack = value && typeof value === 'object' ? value : { iron_ore: 6, carbon_fiber: 6, silicon_chip: 3 };
    for (const resource of Object.keys(pack)) {
      const quantity = parseInt(pack[resource]) || 0;
      if (quantity <= 0) continue;
      const seed = await client.query(
        `/* totp:starter */ INSERT INTO user_resource_inventory (wallet_address,resource_id,quantity,updated_at)
         SELECT $1,id,$3,$4 FROM resources WHERE code=$2
         ON CONFLICT (wallet_address,resource_id) DO UPDATE
          SET quantity=user_resource_inventory.quantity+EXCLUDED.quantity,updated_at=EXCLUDED.updated_at`,
        [wallet, resource, quantity, new Date(clock())]);
      if (seed.rowCount !== 1) throw unavailable();
    }
  }
  async function createEnrollment(client, username, kind, encryption, wallet = null, version = null) {
    const enrollmentId = randomBytes(32).toString('hex');
    const enrollmentSecret = randomBytes(32).toString('hex');
    const secret = primitives.encodeSecret(randomBytes(20));
    const idHash = digest(enrollmentId);
    const encrypted = primitives.encryptSecret(secret, encryption, 'enroll:' + idHash, { iv: randomBytes(12) });
    await client.query(
      `/* totp:create-enrollment */ INSERT INTO totp_enrollments
       (enrollment_hash, secret_hash, username, encrypted_secret, kind, wallet_address, target_version, expires_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [idHash, digest(enrollmentSecret), username, encrypted, kind, wallet, version, new Date(clock() + TTL_SECONDS * 1000)]);
    return { enrollmentId, enrollmentSecret, username, kind, secret,
      otpauthUri: primitives.buildOtpAuthUri(username, secret), expiresIn: TTL_SECONDS };
  }
  async function lockedTicket(client, enrollmentId) {
    return (await client.query('/* totp:enrollment */ SELECT * FROM totp_enrollments WHERE enrollment_hash=$1 FOR UPDATE', [digest(enrollmentId)])).rows[0];
  }
  async function lockedIdentity(client, username) {
    return (await client.query(
      `/* totp:identity */ SELECT t.* FROM totp_identities t JOIN users u ON u.wallet_address=t.wallet_address
       WHERE t.username=$1 AND COALESCE(u.is_active,true)=true FOR UPDATE OF t`, [username])).rows[0];
  }
  function live(row) { return row && new Date(row.expires_at).getTime() > clock() &&
    ['pending', 'verified'].includes(row.state) && row.failed_attempts < MAX_ATTEMPTS; }
  async function ticketFailure(client, row) {
    await client.query(
      "/* totp:ticket-failure */ UPDATE totp_enrollments SET failed_attempts=failed_attempts+1, state=CASE WHEN failed_attempts+1 >= 5 THEN 'locked' ELSE state END WHERE enrollment_hash=$1",
      [row.enrollment_hash]);
    return { invalid: true };
  }
  async function accountFailure(client, row) {
    const attempts = (row.locked_until && new Date(row.locked_until).getTime() <= clock()) ? 1 : Number(row.failed_attempts || 0) + 1;
    const windowActive = row.failed_window_start && new Date(row.failed_window_start).getTime() + DAILY_WINDOW_MS > clock();
    const dailyCount = windowActive ? Math.min(Number(row.failed_daily_count || 0) + 1, DAILY_ATTEMPTS) : 1;
    await client.query(
      '/* totp:account-failure */ UPDATE totp_identities SET failed_attempts=$2, locked_until=$3, failed_daily_count=$4, failed_window_start=$5 WHERE username=$1',
      [row.username, Math.min(attempts, MAX_ATTEMPTS), attempts >= MAX_ATTEMPTS ? new Date(clock() + LOCK_MS) : null,
        dailyCount, windowActive ? row.failed_window_start : new Date(clock())]);
    return { invalid: true };
  }
  function accountLocked(row) {
    // Persistent per-account budget applies across IPs and successful logins.
    // The fixed 24h budget starts with the first failure, not at midnight.
    // Public usernames can
    // be deliberately locked; a valid high-entropy recovery backup still works.
    if (Number(row.failed_daily_count || 0) >= DAILY_ATTEMPTS && row.failed_window_start &&
        new Date(row.failed_window_start).getTime() + DAILY_WINDOW_MS > clock()) return true;
    return row.locked_until && new Date(row.locked_until).getTime() > clock();
  }
  async function loginResult(client, username, wallet, version) {
    const user = (await client.query(
      '/* totp:user */ SELECT wallet_address,email,nickname,referral_code,COALESCE(rank_level,1) AS rank_level FROM users WHERE wallet_address=$1 AND COALESCE(is_active,true)=true FOR SHARE', [wallet])).rows[0];
    if (!user) throw invalid();
    const token = await signToken({ wallet: user.wallet_address, email: user.email, nickname: user.nickname,
      auth_kind: 'totp', auth_version: version, jti: randomBytes(16).toString('hex') }, { expiresIn: '30d' });
    await client.query('/* totp:last-login */ UPDATE users SET last_login_at=$2 WHERE wallet_address=$1', [wallet, new Date(clock())]);
    return { success: true, token, user: { wallet: user.wallet_address, email: user.email, nickname: user.nickname,
      rank: parseInt(user.rank_level, 10) || 1, referralCode: user.referral_code, username } };
  }
  async function start({ username: value, tosAccepted } = {}) {
    const encryption = ready(); const username = normalizeUsername(value);
    if (!validUsername(username) || tosAccepted !== true) throw invalid();
    return tx(async client => {
      await client.query('/* totp:cleanup */ DELETE FROM totp_enrollments WHERE expires_at <= $1', [new Date(clock())]);
      // Existing and pending names have the same response shape. No identity is
      // replaced or reserved here; only final activation can claim a username.
      return createEnrollment(client, username, 'signup', encryption);
    });
  }
  async function verify({ enrollmentId, enrollmentSecret, code } = {}) {
    const encryption = ready();
    if (!validTicket(enrollmentId) || !validTicket(enrollmentSecret)) throw invalid();
    return finish(await tx(async client => {
      const row = await lockedTicket(client, enrollmentId);
      if (!live(row) || row.state !== 'pending') return { invalid: true };
      if (!equalHash(enrollmentSecret, row.secret_hash)) return ticketFailure(client, row);
      if (row.kind === 'recovery') {
        const target = await lockedIdentity(client, row.username);
        if (!target || target.status !== 'recovering' || target.wallet_address !== row.wallet_address ||
            Number(target.session_version) !== Number(row.target_version)) return { invalid: true };
      }
      const secret = primitives.decryptSecret(row.encrypted_secret, encryption, 'enroll:' + row.enrollment_hash);
      const counter = primitives.verifyTotp(secret, code, { nowMs: clock(), lastCounter: -1, window: 1 });
      if (counter === null) return ticketFailure(client, row);
      const recoveryCodes = Array.from({ length: 10 }, () => primitives.formatRecoveryCode(randomBytes(16)));
      const hashes = recoveryCodes.map(primitives.recoveryHash);
      if (new Set(hashes).size !== hashes.length) throw unavailable();
      const confirmationNonce = randomBytes(32).toString('hex');
      const updated = await client.query(
        `/* totp:verify */ UPDATE totp_enrollments SET state='verified', verified_counter=$2,
          pending_recovery_hashes=$3::jsonb, confirmation_hash=$4
          WHERE enrollment_hash=$1 AND state='pending' AND expires_at > $5`,
        [row.enrollment_hash, counter, JSON.stringify(hashes), digest(confirmationNonce), new Date(clock())]);
      if (updated.rowCount !== 1) throw invalid();
      return { recoveryCodes, confirmationNonce, recoveryCodesAfterConfirmation: 9,
        expiresIn: Math.max(1, Math.ceil((new Date(row.expires_at).getTime() - clock()) / 1000)) };
    }));
  }
  async function activate({ enrollmentId, enrollmentSecret, confirmationNonce, recoveryCode } = {}) {
    const encryption = ready();
    if (!validTicket(enrollmentId) || !validTicket(enrollmentSecret) || !validTicket(confirmationNonce)) throw invalid();
    return finish(await tx(async client => {
      const row = await lockedTicket(client, enrollmentId);
      if (!live(row) || row.state !== 'verified') return { invalid: true };
      if (!equalHash(enrollmentSecret, row.secret_hash) || !equalHash(confirmationNonce, row.confirmation_hash)) return ticketFailure(client, row);
      const hashes = unpack(row.pending_recovery_hashes);
      const matches = hashes.map(h => primitives.verifyRecovery(recoveryCode, h));
      const index = matches.indexOf(true);
      if (index < 0) return ticketFailure(client, row);
      const remaining = hashes.filter((_, i) => i !== index);
      const secret = primitives.decryptSecret(row.encrypted_secret, encryption, 'enroll:' + row.enrollment_hash);
      let wallet = row.wallet_address, version = 1;
      if (row.kind === 'signup') {
        wallet = '0x' + randomBytes(20).toString('hex');
        const created = await client.query(
          `/* totp:new-user */ INSERT INTO users
           (wallet_address,email,password_hash,nickname,referral_code,tos_accepted_at,tos_version,wallet_type)
           VALUES ($1,NULL,NULL,$2,$3,$4,'1.0','placeholder') RETURNING wallet_address`,
          [wallet, row.username, randomBytes(6).toString('hex').toUpperCase(), new Date(clock())]);
        if (created.rowCount !== 1) throw unavailable();
        const inserted = await client.query(
          `/* totp:new-identity */ INSERT INTO totp_identities
           (username,wallet_address,encrypted_secret,last_counter,recovery_hashes,session_version,status)
           VALUES ($1,$2,$3,$4,$5::jsonb,1,'active') ON CONFLICT (username) DO NOTHING`,
          [row.username, wallet, primitives.encryptSecret(secret, encryption, 'totp:' + row.username + ':' + wallet, { iv: randomBytes(12) }),
            row.verified_counter, JSON.stringify(remaining)]);
        if (inserted.rowCount !== 1) throw invalid(); // Rolls back the speculative new user too.
        // Apply exactly once after the username's unique activation wins. This
        // pays the configured signup bonus as GP, never as redeemable PP.
        await grantSignupBenefits(client, wallet);
      } else {
        const identity = await lockedIdentity(client, row.username);
        if (!identity || identity.status !== 'recovering' || identity.wallet_address !== wallet ||
            Number(identity.session_version) !== Number(row.target_version)) return { invalid: true };
        version = Number(identity.session_version) + 1;
        await client.query(
          `/* totp:replace */ UPDATE totp_identities SET status='active',encrypted_secret=$2,last_counter=$3,
            recovery_hashes=$4::jsonb,session_version=$5,failed_attempts=0,locked_until=NULL WHERE username=$1`,
          [row.username, primitives.encryptSecret(secret, encryption, 'totp:' + row.username + ':' + wallet, { iv: randomBytes(12) }),
            row.verified_counter, JSON.stringify(remaining), version]);
      }
      const consumed = await client.query(
        "/* totp:consume */ UPDATE totp_enrollments SET state='used',encrypted_secret=NULL,pending_recovery_hashes=NULL,confirmation_hash=NULL WHERE enrollment_hash=$1 AND state='verified' AND expires_at>$2",
        [row.enrollment_hash, new Date(clock())]);
      if (consumed.rowCount !== 1) throw invalid();
      return { ...await loginResult(client, row.username, wallet, version), remainingRecoveryCodes: remaining.length };
    }));
  }
  async function login({ username: value, code } = {}) {
    const encryption = ready(); const username = normalizeUsername(value);
    if (!validUsername(username)) throw invalid();
    return finish(await tx(async client => {
      const row = await lockedIdentity(client, username);
      if (!row) { primitives.verifyTotp('AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', code, { nowMs: clock(), window: 1 }); return { invalid: true }; }
      if (row.status !== 'active' || accountLocked(row)) return { invalid: true };
      const secret = primitives.decryptSecret(row.encrypted_secret, encryption, 'totp:' + username + ':' + row.wallet_address);
      const counter = primitives.verifyTotp(secret, code, { nowMs: clock(), lastCounter: Number(row.last_counter), window: 1 });
      if (counter === null) return accountFailure(client, row);
      const updated = await client.query(
        "/* totp:login-counter */ UPDATE totp_identities SET last_counter=$2,failed_attempts=0,locked_until=NULL WHERE username=$1 AND status='active' AND last_counter<$2",
        [username, counter]);
      if (updated.rowCount !== 1) return { invalid: true };
      return loginResult(client, username, row.wallet_address, Number(row.session_version));
    }));
  }
  async function recover({ username: value, recoveryCode } = {}) {
    const encryption = ready(); const username = normalizeUsername(value);
    if (!validUsername(username)) throw invalid();
    return finish(await tx(async client => {
      const row = await lockedIdentity(client, username);
      if (!row) { primitives.verifyRecovery(recoveryCode, digest('unavailable-recovery-fixture')); return { invalid: true }; }
      // A valid high-entropy backup remains a recovery lifeline even if an
      // attacker locked the public username with incorrect six-digit codes.
      // Recovery requests retain their independent IP quota and generic errors.
      const hashes = unpack(row.recovery_hashes);
      const index = hashes.map(h => primitives.verifyRecovery(recoveryCode, h)).indexOf(true);
      if (index < 0) return accountFailure(client, row);
      const version = Number(row.session_version) + 1;
      await client.query(
        `/* totp:recover */ UPDATE totp_identities SET recovery_hashes=$2::jsonb,status='recovering',encrypted_secret=NULL,
          last_counter=-1,session_version=$3,failed_attempts=0,locked_until=NULL WHERE username=$1`,
        [username, JSON.stringify(hashes.filter((_, i) => i !== index)), version]);
      // No general JWT is issued. Old authenticator and sessions stop immediately;
      // re-enrollment must prove the new authenticator and new recovery backup.
      return createEnrollment(client, username, 'recovery', encryption, row.wallet_address, version);
    }));
  }
  async function checkSession(payload) {
    if (payload?.auth_kind !== 'totp') return true;
    ready();
    if (!Number.isSafeInteger(payload.auth_version) || typeof payload.wallet !== 'string' ||
        !/^[a-f0-9]{32}$/.test(payload.jti || '')) return false;
    return tx(async client => {
      const row = (await client.query(
        `/* totp:session */ SELECT t.status,t.session_version FROM totp_identities t JOIN users u ON u.wallet_address=t.wallet_address
         WHERE t.wallet_address=$1 AND COALESCE(u.is_active,true)=true`, [payload.wallet])).rows[0];
      return Boolean(row && row.status === 'active' && Number(row.session_version) === payload.auth_version);
    });
  }
  return { config, availableConfig, start, verify, activate, login, recover, checkSession };
}

module.exports = { createService, TotpAuthError, TTL_SECONDS, MAX_ATTEMPTS };
