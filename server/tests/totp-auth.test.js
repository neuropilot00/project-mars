'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createService } = require('../services/totpAuth');
const { createRouter } = require('../routes/totpAuthRoutes');
const primitives = require('../services/totpCrypto');
const FIXTURE_KEY = Buffer.alloc(32, 0x47).toString('base64');

// This serial in-memory PostgreSQL contract fixture is not a database driver.
// All entropy, clocks and token signing are fixed fixtures; no MFA is enrolled.
function fixture(extra = {}) {
  let now = 1800000000000, bytesCall = 0, queue = Promise.resolve();
  const enrollments = new Map(), identities = new Map(), users = new Map(), seeds = [], signed = [], sql = [];
  const settings = { ...extra.settings };
  const pool = { async connect() {
    let unlock, snapshot;
    return { async query(statement, args = []) {
      sql.push(statement);
      if (statement === 'BEGIN') {
        const prior = queue; queue = new Promise(resolve => { unlock = resolve; }); await prior;
        snapshot = structuredClone({ enrollments: [...enrollments], identities: [...identities], users: [...users], seeds });
        return { rows: [], rowCount: 0 };
      }
      if (statement === 'COMMIT' || statement === 'ROLLBACK') {
        if (statement === 'ROLLBACK') {
          for (const [map, values] of [[enrollments, snapshot.enrollments], [identities, snapshot.identities], [users, snapshot.users]]) {
            map.clear(); for (const pair of values) map.set(...pair);
          }
          seeds.splice(0, seeds.length, ...snapshot.seeds);
        }
        unlock(); unlock = null; return { rows: [], rowCount: 0 };
      }
      const result = (rows = [], rowCount = rows.length) => ({ rows, rowCount });
      if (statement.includes('totp:schema-readiness')) return result();
      if (statement.includes('totp:signup-bonus-setting')) return result(Object.hasOwn(settings, 'signup_pp_bonus') ? [{ value: settings.signup_pp_bonus }] : []);
      if (statement.includes('totp:signup-minerals-setting')) return result(Object.hasOwn(settings, 'signup_starter_minerals') ? [{ value: settings.signup_starter_minerals }] : []);
      if (statement.includes('fixture:signup-gp-rate')) return result(Object.hasOwn(settings, 'pp_to_gp_exchange_rate') ? [{ value: settings.pp_to_gp_exchange_rate }] : []);
      if (statement.includes('totp:cleanup')) {
        for (const [id, row] of enrollments) if (new Date(row.expires_at) <= args[0]) enrollments.delete(id);
        return result();
      }
      if (statement.includes('totp:create-enrollment')) {
        if (enrollments.has(args[0])) throw new Error('fixture_id_collision');
        enrollments.set(args[0], { enrollment_hash: args[0], secret_hash: args[1], username: args[2], encrypted_secret: args[3],
          kind: args[4], wallet_address: args[5], target_version: args[6], expires_at: args[7], state: 'pending', failed_attempts: 0 });
        return result([], 1);
      }
      if (statement.includes('totp:enrollment')) return result(enrollments.has(args[0]) ? [structuredClone(enrollments.get(args[0]))] : []);
      if (statement.includes('totp:identity')) {
        const row = identities.get(args[0]);
        return result(row && users.get(row.wallet_address)?.is_active !== false && users.has(row.wallet_address) ? [structuredClone(row)] : []);
      }
      if (statement.includes('totp:user')) {
        const user = users.get(args[0]); return result(user && user.is_active !== false ? [{ ...user }] : []);
      }
      if (statement.includes('totp:session')) {
        const row = [...identities.values()].find(value => value.wallet_address === args[0]);
        return result(row && users.has(args[0]) && users.get(args[0]).is_active !== false ? [structuredClone(row)] : []);
      }
      if (statement.includes('totp:ticket-failure')) {
        const row = enrollments.get(args[0]); row.failed_attempts++; if (row.failed_attempts >= 5) row.state = 'locked'; return result([], 1);
      }
      if (statement.includes('totp:account-failure')) {
        const row = identities.get(args[0]); row.failed_attempts = args[1]; row.locked_until = args[2];
        row.failed_daily_count = args[3]; row.failed_window_start = args[4]; return result([], 1);
      }
      if (statement.includes('totp:verify')) {
        const row = enrollments.get(args[0]);
        if (row.state !== 'pending' || new Date(row.expires_at) <= args[4]) return result();
        Object.assign(row, { state: 'verified', verified_counter: args[1], pending_recovery_hashes: JSON.parse(args[2]), confirmation_hash: args[3] });
        return result([], 1);
      }
      if (statement.includes('totp:new-user')) {
        if (users.has(args[0])) throw new Error('fixture_wallet_collision');
        users.set(args[0], { wallet_address: args[0], email: null, nickname: args[1], referral_code: args[2], rank_level: 1,
          is_active: true, gp_balance: 0, pp_balance: 0 });
        return result([{ wallet_address: args[0] }]);
      }
      if (statement.includes('totp:new-identity')) {
        if (identities.has(args[0])) return result();
        identities.set(args[0], { username: args[0], wallet_address: args[1], encrypted_secret: args[2], last_counter: args[3],
          recovery_hashes: JSON.parse(args[4]), session_version: 1, status: 'active', failed_attempts: 0,
          failed_daily_count: 0, failed_window_start: null, locked_until: null });
        return result([], 1);
      }
      if (statement.includes('totp:starter')) { seeds.push(args); return result([], extra.missingStarter ? 0 : 1); }
      if (statement.includes('totp:signup-gp')) { users.get(args[0]).gp_balance += args[1]; return result([], 1); }
      if (statement.includes('totp:replace')) {
        const row = identities.get(args[0]);
        Object.assign(row, { status: 'active', encrypted_secret: args[1], last_counter: args[2], recovery_hashes: JSON.parse(args[3]),
          session_version: args[4], failed_attempts: 0, locked_until: null }); return result([], 1);
      }
      if (statement.includes('totp:consume')) {
        const row = enrollments.get(args[0]);
        if (row.state !== 'verified' || new Date(row.expires_at) <= args[1]) return result();
        Object.assign(row, { state: 'used', encrypted_secret: null, pending_recovery_hashes: null, confirmation_hash: null });
        return result([], 1);
      }
      if (statement.includes('totp:login-counter')) {
        const row = identities.get(args[0]);
        if (row.status !== 'active' || row.last_counter >= args[1]) return result();
        Object.assign(row, { last_counter: args[1], failed_attempts: 0, locked_until: null }); return result([], 1);
      }
      if (statement.includes('totp:recover')) {
        Object.assign(identities.get(args[0]), { recovery_hashes: JSON.parse(args[1]), status: 'recovering', encrypted_secret: null,
          last_counter: -1, session_version: args[2], failed_attempts: 0, locked_until: null }); return result([], 1);
      }
      if (statement.includes('totp:last-login')) return result([], 1);
      throw new Error('Unhandled fixture statement');
    }, release() { assert.equal(unlock ?? null, null); } };
  } };
  const options = { pool, enabled: () => true, encryptionKey: () => FIXTURE_KEY, jwtConfigured: () => true,
    clock: () => now,
    async getPPToGPRate(client) {
      // Pure injected contract fixture for db.js#getPPToGPRate(client). No source
      // database module is imported; only this fixed transaction client is used.
      const setting = await client.query('/* fixture:signup-gp-rate */ SELECT value FROM settings WHERE key=$1', ['pp_to_gp_exchange_rate']);
      const rate = parseFloat(setting.rows[0]?.value ?? '10');
      return rate > 0 && Number.isFinite(rate) ? rate : 10;
    },
    randomBytes(size) { bytesCall++; const bytes = Buffer.alloc(size, bytesCall % 255); bytes.writeUInt32BE(bytesCall, size - 4); return bytes; },
    signToken(claims, jwtOptions) { signed.push({ claims: { ...claims }, options: jwtOptions }); return 'fixture_not_a_JWT_' + signed.length; },
    ...extra.options };
  const service = createService(options);
  const code = secret => primitives.generateTotp(secret, { nowMs: now });
  async function verified(username = 'fixture_user') {
    const enrollment = await service.start({ username, tosAccepted: true });
    const recovery = await service.verify({ ...enrollment, code: code(enrollment.secret) });
    return { enrollment, recovery };
  }
  async function enrolled(username = 'fixture_user') {
    const { enrollment, recovery } = await verified(username);
    const activated = await service.activate({ ...enrollment, confirmationNonce: recovery.confirmationNonce, recoveryCode: recovery.recoveryCodes[0] });
    return { enrollment, recovery, activated };
  }
  return { options, service, enrollments, identities, users, seeds, signed, sql, settings, code, verified, enrolled,
    advance(ms = 30000) { now += ms; } };
}
const bad = promise => assert.rejects(promise, error => error.code === 'auth_invalid' && error.status === 401);

test('new username enrollment requires first authenticator proof and recovery confirmation before account creation', async () => {
  const f = fixture();
  await bad(f.service.start({ username: 'fixture_user', tosAccepted: false }));
  const enrollment = await f.service.start({ username: 'FIXTURE_user', tosAccepted: true });
  assert.equal(enrollment.username, 'fixture_user'); assert.equal(f.users.size, 0);
  assert.match(enrollment.otpauthUri, /^otpauth:\/\/totp\//);
  await bad(f.service.activate({ ...enrollment, confirmationNonce: '0'.repeat(64), recoveryCode: '0'.repeat(32) }));
  const recovery = await f.service.verify({ ...enrollment, code: f.code(enrollment.secret) });
  assert.equal(recovery.recoveryCodes.length, 10); assert.equal(f.users.size, 0);
  await bad(f.service.verify({ ...enrollment, code: f.code(enrollment.secret) }));
  await bad(f.service.activate({ ...enrollment, confirmationNonce: recovery.confirmationNonce, recoveryCode: '0'.repeat(32) }));
  const activated = await f.service.activate({ ...enrollment, confirmationNonce: recovery.confirmationNonce, recoveryCode: recovery.recoveryCodes[0] });
  assert.equal(activated.remainingRecoveryCodes, 9); assert.equal(activated.user.email, null);
  assert.equal(activated.user.username, 'fixture_user'); assert.equal(f.users.size, 1); assert.equal(f.seeds.length, 3);
  assert.deepEqual(f.seeds.map(seed => seed.slice(1, 3)), [['iron_ore', 6], ['carbon_fiber', 6], ['silicon_chip', 3]]);
  assert.equal(f.users.get(activated.user.wallet).gp_balance, 0);
  assert.equal(f.signed[0].claims.auth_kind, 'totp'); assert.equal(f.signed[0].claims.auth_version, 1);
  assert.equal(f.signed[0].options.expiresIn, '30d'); assert.match(f.signed[0].claims.jti, /^[a-f0-9]{32}$/);
  assert.equal(await f.service.checkSession(f.signed[0].claims), true);
  await bad(f.service.login({ username: enrollment.username, code: f.code(enrollment.secret) })); // Registration counter consumed.
  f.advance();
  assert.equal((await f.service.login({ username: enrollment.username, code: f.code(enrollment.secret) })).success, true);
  await bad(f.service.activate({ ...enrollment, confirmationNonce: recovery.confirmationNonce, recoveryCode: recovery.recoveryCodes[1] }));
});

test('pending duplicate usernames do not reserve or overwrite names; activation is an atomic unique winner', async () => {
  const f = fixture({ settings: { signup_pp_bonus: 2, pp_to_gp_exchange_rate: 7 } });
  const first = await f.verified(), second = await f.verified();
  const activate = value => f.service.activate({ ...value.enrollment, confirmationNonce: value.recovery.confirmationNonce, recoveryCode: value.recovery.recoveryCodes[0] });
  const results = await Promise.allSettled([activate(first), activate(second)]);
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal(f.users.size, 1); assert.equal(f.identities.size, 1); assert.equal(f.seeds.length, 3);
  assert.equal([...f.users.values()][0].gp_balance, 14);
  assert.equal(f.sql.filter(statement => statement.includes('totp:signup-gp')).length, 1);
  const again = await f.service.start({ username: 'fixture_user', tosAccepted: true });
  assert.deepEqual(Object.keys(again).sort(), Object.keys(first.enrollment).sort());
  assert.equal(f.identities.size, 1);
});

test('administrator signup bonus and mineral pack are honored once; recovery never grants signup benefits again', async () => {
  const pack = { iron_ore: 12.9, carbon_fiber: 0, silicon_chip: -3, titanium_alloy: '5.8', ignored: 'invalid' };
  const f = fixture({ settings: { signup_pp_bonus: 1.23456789, pp_to_gp_exchange_rate: 2.5, signup_starter_minerals: pack } });
  const first = await f.enrolled();
  assert.equal(f.users.get(first.activated.user.wallet).gp_balance, 3.08642);
  assert.equal(f.users.get(first.activated.user.wallet).pp_balance, 0);
  assert.deepEqual(f.seeds.map(seed => seed.slice(1, 3)), [['iron_ore', 12], ['titanium_alloy', 5]]);
  assert.deepEqual(f.settings.signup_starter_minerals, pack);
  await bad(f.service.activate({ ...first.enrollment, confirmationNonce: first.recovery.confirmationNonce,
    recoveryCode: first.recovery.recoveryCodes[0] }));
  const replacement = await f.service.recover({ username: 'fixture_user', recoveryCode: first.recovery.recoveryCodes[1] });
  const codes = await f.service.verify({ ...replacement, code: f.code(replacement.secret) });
  const recovered = await f.service.activate({ ...replacement, confirmationNonce: codes.confirmationNonce, recoveryCode: codes.recoveryCodes[0] });
  assert.equal(recovered.user.wallet, first.activated.user.wallet);
  assert.equal(f.users.get(recovered.user.wallet).gp_balance, 3.08642);
  assert.equal(f.seeds.length, 2);
  assert.equal(f.sql.filter(statement => statement.includes('totp:signup-bonus-setting')).length, 1);
  assert.equal(f.sql.filter(statement => statement.includes('fixture:signup-gp-rate')).length, 1);
  assert.equal(f.sql.filter(statement => statement.includes('totp:signup-minerals-setting')).length, 1);
});

test('disabled signup bonuses and an empty administrator mineral pack remain disabled', async () => {
  for (const bonus of [0, -5, 'invalid']) {
    const f = fixture({ settings: { signup_pp_bonus: bonus, signup_starter_minerals: {} },
      options: { getPPToGPRate: async () => { throw new Error('exchange helper must not be used for disabled bonuses'); } } });
    const account = await f.enrolled();
    assert.equal(f.users.get(account.activated.user.wallet).gp_balance, 0);
    assert.equal(f.users.get(account.activated.user.wallet).pp_balance, 0);
    assert.deepEqual(f.seeds, []);
  }
});

test('missing exchange rate uses the existing helper contract default and non-object minerals keep the legacy default', async () => {
  for (const mineralValue of [null, 'not-an-object']) {
    const f = fixture({ settings: { signup_pp_bonus: 2.5, signup_starter_minerals: mineralValue } });
    const account = await f.enrolled();
    assert.equal(f.users.get(account.activated.user.wallet).gp_balance, 25);
    assert.deepEqual(f.seeds.map(seed => seed.slice(1, 3)), [['iron_ore', 6], ['carbon_fiber', 6], ['silicon_chip', 3]]);
  }
});

test('invalid injected exchange rate rolls activation back instead of issuing an account with an invalid balance', async () => {
  const f = fixture({ settings: { signup_pp_bonus: 2 }, options: { getPPToGPRate: async () => Infinity } });
  await assert.rejects(f.enrolled(), { code: 'auth_unavailable', status: 503 });
  assert.equal(f.users.size, 0); assert.equal(f.identities.size, 0); assert.deepEqual(f.seeds, []);
});

test('expired enrollment, bad tickets and five invalid factors fail generically; pending creates no user', async () => {
  const f = fixture(); const enrollment = await f.service.start({ username: 'fixture_user', tosAccepted: true });
  await bad(f.service.verify({ ...enrollment, enrollmentSecret: 'f'.repeat(64), code: 'bad' }));
  for (let i = 0; i < 4; i++) await bad(f.service.verify({ ...enrollment, code: 'bad' }));
  assert.equal([...f.enrollments.values()][0].state, 'locked');
  await bad(f.service.verify({ ...enrollment, code: f.code(enrollment.secret) })); assert.equal(f.users.size, 0);
  const expired = fixture(); const pending = await expired.service.start({ username: 'fixture_user', tosAccepted: true });
  expired.advance(300000); await bad(expired.service.verify({ ...pending, code: expired.code(pending.secret) }));
});

test('TOTP counter replay and simultaneous login use exactly one counter; account lockout persists', async () => {
  const f = fixture(); const { enrollment } = await f.enrolled(); f.advance();
  const args = { username: enrollment.username, code: f.code(enrollment.secret) };
  const results = await Promise.allSettled([f.service.login(args), f.service.login(args)]);
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  await bad(f.service.login(args));
  // Malformed factors count too, but a valid future factor cannot bypass an active lock.
  for (let i = 0; i < 3; i++) await bad(f.service.login({ username: enrollment.username, code: 'bad' }));
  f.advance(); await bad(f.service.login({ username: enrollment.username, code: f.code(enrollment.secret) }));
  f.advance(15 * 60 * 1000);
  await bad(f.service.login({ username: enrollment.username, code: f.code(enrollment.secret) }));
  f.advance(24 * 60 * 60 * 1000);
  assert.equal((await f.service.login({ username: enrollment.username, code: f.code(enrollment.secret) })).success, true);
  await bad(f.service.login({ username: 'unknown_user', code: args.code }));
});

test('recovery consumes one code without issuing JWT, revokes old authenticator/session, and requires new enrollment proof', async () => {
  const f = fixture(); const old = await f.enrolled(); const claims = f.signed[0].claims;
  await bad(f.service.recover({ username: 'fixture_user', recoveryCode: old.recovery.recoveryCodes[0] })); // Confirmation was consumed.
  const replacement = await f.service.recover({ username: 'fixture_user', recoveryCode: old.recovery.recoveryCodes[1] });
  assert.equal(replacement.kind, 'recovery'); assert.equal(replacement.token, undefined); assert.equal(f.signed.length, 1);
  assert.equal(await f.service.checkSession(claims), false);
  f.advance(); await bad(f.service.login({ username: 'fixture_user', code: f.code(old.enrollment.secret) }));
  await bad(f.service.recover({ username: 'fixture_user', recoveryCode: old.recovery.recoveryCodes[1] }));
  const freshCodes = await f.service.verify({ ...replacement, code: f.code(replacement.secret) });
  const active = await f.service.activate({ ...replacement, confirmationNonce: freshCodes.confirmationNonce, recoveryCode: freshCodes.recoveryCodes[0] });
  assert.equal(active.user.wallet, old.activated.user.wallet); assert.equal(f.users.size, 1);
  assert.equal(f.signed.at(-1).claims.auth_version, 3); assert.equal(await f.service.checkSession(f.signed.at(-1).claims), true);
  assert.equal(await f.service.checkSession(claims), false);
  await bad(f.service.recover({ username: 'fixture_user', recoveryCode: old.recovery.recoveryCodes[2] }));
  f.advance(); await bad(f.service.login({ username: 'fixture_user', code: f.code(old.enrollment.secret) }));
  assert.equal((await f.service.login({ username: 'fixture_user', code: f.code(replacement.secret) })).success, true);
});

test('simultaneous recovery code consumption and stale recovery enrollment cannot change the account', async () => {
  const f = fixture(); const old = await f.enrolled();
  const args = { username: 'fixture_user', recoveryCode: old.recovery.recoveryCodes[1] };
  const recovered = await Promise.allSettled([f.service.recover(args), f.service.recover(args)]);
  assert.equal(recovered.filter(r => r.status === 'fulfilled').length, 1);
  const stale = recovered.find(r => r.status === 'fulfilled').value;
  const current = await f.service.recover({ username: 'fixture_user', recoveryCode: old.recovery.recoveryCodes[2] });
  await bad(f.service.verify({ ...stale, code: f.code(stale.secret) }));
  assert.equal((await f.service.verify({ ...current, code: f.code(current.secret) })).recoveryCodes.length, 10);
});

test('a valid recovery backup remains usable while six-digit login is locked', async () => {
  const f = fixture(); const old = await f.enrolled();
  for (let i = 0; i < 5; i++) await bad(f.service.login({ username: 'fixture_user', code: 'bad' }));
  f.advance(); await bad(f.service.login({ username: 'fixture_user', code: f.code(old.enrollment.secret) }));
  const result = await f.service.recover({ username: 'fixture_user', recoveryCode: old.recovery.recoveryCodes[1] });
  assert.equal(result.kind, 'recovery'); assert.equal(result.token, undefined);
});

test('successful login does not reset the persistent fixed 24h budget; midnight and changed IP cannot bypass it', async () => {
  const f = fixture(); const old = await f.enrolled();
  const firstFailureAt = f.options.clock();
  for (let i = 0; i < 4; i++) {
    await bad(f.service.login({ username: 'fixture_user', code: 'bad' }));
    f.advance();
    assert.equal((await f.service.login({ username: 'fixture_user', code: f.code(old.enrollment.secret) })).success, true);
  }
  assert.equal(f.identities.get('fixture_user').failed_daily_count, 4);
  const request = routeFixture(f);
  assert.equal((await request('POST', '/login', { body: { username: 'fixture_user', code: 'bad' }, ip: 'different-fixture-ip' })).statusCode, 401);
  assert.equal(f.identities.get('fixture_user').failed_daily_count, 5);
  f.advance(16 * 60 * 1000);
  assert.equal((await request('POST', '/login', { body: { username: 'fixture_user', code: f.code(old.enrollment.secret) }, ip: 'another-fixture-ip' })).statusCode, 401);
  f.advance(firstFailureAt + 24 * 60 * 60 * 1000 - 1 - f.options.clock());
  assert.equal((await request('POST', '/login', { body: { username: 'fixture_user', code: f.code(old.enrollment.secret) } })).statusCode, 401);
  f.advance(1); // Exactly 24h from the first failure, regardless of local midnight.
  assert.equal((await request('POST', '/login', { body: { username: 'fixture_user', code: f.code(old.enrollment.secret) } })).statusCode, 200);
  await bad(f.service.login({ username: 'fixture_user', code: 'bad' }));
  assert.equal(f.identities.get('fixture_user').failed_daily_count, 1);
});

test('deleted users cannot login, recover, verify recovery, activate recovery or retain a session', async () => {
  const f = fixture(); const old = await f.enrolled();
  const recovery = await f.service.recover({ username: 'fixture_user', recoveryCode: old.recovery.recoveryCodes[1] });
  const verified = await f.service.verify({ ...recovery, code: f.code(recovery.secret) });
  f.users.get(old.activated.user.wallet).is_active = false;
  assert.equal(await f.service.checkSession(f.signed[0].claims), false);
  await bad(f.service.login({ username: 'fixture_user', code: f.code(old.enrollment.secret) }));
  await bad(f.service.recover({ username: 'fixture_user', recoveryCode: old.recovery.recoveryCodes[2] }));
  await bad(f.service.activate({ ...recovery, confirmationNonce: verified.confirmationNonce, recoveryCode: verified.recoveryCodes[0] }));
  const another = fixture(); const active = await another.enrolled();
  const ticket = await another.service.recover({ username: 'fixture_user', recoveryCode: active.recovery.recoveryCodes[1] });
  another.users.get(active.activated.user.wallet).is_active = false;
  await bad(another.service.verify({ ...ticket, code: another.code(ticket.secret) }));
});

test('encrypted storage/AAD, missing keys, disabled flags, failed schema/seed all fail closed without partial accounts', async () => {
  const f = fixture(); const { enrollment, recovery } = await f.verified();
  assert.equal(JSON.stringify([...f.enrollments]).includes(enrollment.secret), false);
  assert.equal(JSON.stringify([...f.enrollments]).includes(recovery.recoveryCodes[0]), false);
  const badKey = createService({ ...f.options, encryptionKey: () => Buffer.alloc(32, 8).toString('base64') });
  await assert.rejects(badKey.activate({ ...enrollment, confirmationNonce: recovery.confirmationNonce, recoveryCode: recovery.recoveryCodes[0] }), { code: 'auth_unavailable' });
  assert.equal(f.users.size, 0);
  for (const options of [{ enabled: () => false }, { encryptionKey: () => '' }, { jwtConfigured: () => false }]) {
    const service = createService({ ...f.options, ...options }); assert.equal(service.config().enabled, false);
    await assert.rejects(service.start({ username: 'fixture_user', tosAccepted: true }), { code: 'auth_unavailable', status: 503 });
    assert.equal(await service.checkSession({ wallet: 'legacy-fixture' }), true);
    await assert.rejects(service.checkSession({ auth_kind: 'totp' }), { code: 'auth_unavailable' });
  }
  const schema = createService({ ...f.options, pool: { async connect() { throw new Error('private_fixture_schema_detail'); } } });
  await assert.rejects(schema.start({ username: 'fixture_user', tosAccepted: true }), error => error.message === 'auth_unavailable');
  const missing = fixture({ missingStarter: true });
  await assert.rejects(missing.enrolled(), { code: 'auth_unavailable' }); assert.equal(missing.users.size, 0); assert.equal(missing.identities.size, 0);
});

function routeFixture(f, extra = {}) {
  const middleware = [], handlers = new Map();
  const router = { use(fn) { middleware.push(fn); }, get(path, fn) { handlers.set('GET ' + path, fn); }, post(path, fn) { handlers.set('POST ' + path, fn); } };
  createRouter({ service: f.service, express: { Router: () => router }, clock: f.options.clock, ...extra });
  return async (method, path, { body = {}, origin = 'http://127.0.0.1:3000', type = 'application/json', ip = 'fixture-ip' } = {}) => {
    const headers = { origin, host: '127.0.0.1:3000', 'content-type': type, 'sec-fetch-site': 'same-origin' };
    const req = { method, body, protocol: 'http', ip, get: name => headers[name.toLowerCase()] };
    const res = { statusCode: 200, headers: {}, done: false, set(key, value) { this.headers[key] = value; return this; }, status(code) { this.statusCode = code; return this; },
      json(data) { this.data = data; this.done = true; return this; } };
    const chain = [...middleware, handlers.get(method + ' ' + path)];
    async function run(i) { if (i < chain.length && !res.done) await chain[i](req, res, () => run(i + 1)); }
    await run(0); return res;
  };
}

test('HTTP factory enforces origin/JSON, bounded IP quotas, no-store, generic errors and zero secret logging', async () => {
  const f = fixture(); const request = routeFixture(f, { limits: { login: 1, start: 1 } });
  const output = []; const original = ['log', 'warn', 'error'].map(name => [name, console[name]]);
  for (const [name] of original) console[name] = (...args) => output.push(args);
  try {
    for (const path of ['/enroll/start', '/enroll/verify', '/enroll/activate', '/login', '/recover']) {
      assert.equal((await request('POST', path, { origin: 'https://attacker.invalid' })).statusCode, 403);
      assert.equal((await request('POST', path, { origin: null })).statusCode, 403);
      assert.equal((await request('POST', path, { type: 'application/x-www-form-urlencoded' })).statusCode, 415);
    }
    const config = await request('GET', '/config'); assert.equal(config.data.enabled, true); assert.equal(config.headers['Cache-Control'], 'no-store');
    assert.deepEqual((await request('POST', '/login', { body: { username: 'absent_user', code: '000000' } })).data, { error: 'auth_invalid' });
    assert.equal((await request('POST', '/login')).statusCode, 429);
    assert.equal((await request('POST', '/enroll/start', { body: { username: 'fixture_user', tosAccepted: true } })).statusCode, 200);
    assert.equal((await request('POST', '/enroll/start')).statusCode, 429);
  } finally { for (const [name, method] of original) console[name] = method; }
  assert.deepEqual(output, []);
  const off = routeFixture(fixture({ options: { enabled: () => false } }));
  assert.equal((await off('GET', '/config')).data.enabled, false);
  assert.equal((await off('POST', '/login')).statusCode, 503);
});
