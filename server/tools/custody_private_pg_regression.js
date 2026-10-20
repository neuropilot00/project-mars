#!/usr/bin/env node
'use strict';
// Creates its OWN new throwaway cluster, Unix socket only; never opens an
// existing database, loads db.js/.env, creates a key, signs or calls an RPC.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { spawnSync } = require('node:child_process');
const net = require('node:net');
const tls = require('node:tls');
const dns = require('node:dns');
const root = path.resolve(__dirname, '../..');
fs.mkdirSync(path.join(root, 'work'), { recursive: true });
const temp = fs.mkdtempSync(path.join(root, 'work/pg-c-'));
const socket = path.join(temp, 's'); fs.mkdirSync(socket);
const data = path.join(temp, 'd');
const port = 55491;
const socketFile = path.join(socket, '.s.PGSQL.' + port);
assert.ok(socketFile.length < 104, 'Private socket path must fit Unix limit');
const originalConnect = net.Socket.prototype.connect;
net.Socket.prototype.connect = function (...args) {
  if (args[0] !== socketFile && args[0]?.path !== socketFile) throw Error('Only this NEW fixture Unix socket is allowed');
  return originalConnect.apply(this, args);
};
tls.connect = dns.lookup = dns.resolve = () => { throw Error('External network disabled'); };
const pg = require('pg');
const pgBin = '/opt/homebrew/opt/postgresql@16/bin';
function run(binary, args) {
  const result = spawnSync(path.join(pgBin, binary), args, { encoding: 'utf8', env: { PATH: '/usr/bin:/bin', LC_ALL: 'C' } });
  if (result.status !== 0) throw Error(binary + ' failed: ' + result.stderr + result.stdout);
}
function load(relative, dependencies) {
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(path.join(root, relative), 'utf8'), {
    module, exports: module.exports, process: { env: {} }, Date,
    console: { log() {}, warn() {}, error() {} },
    require(name) { if (!(name in dependencies)) throw Error('Uninjected dependency ' + name); return dependencies[name]; }
  }, { filename: relative });
  return module.exports;
}
class BN {
  constructor(value) { this.value = BigInt(value instanceof BN ? value.value : value); }
  sub(value) { return new BN(this.value - new BN(value).value); }
  lt(value) { return this.value < new BN(value).value; }
  gt(value) { return this.value > new BN(value).value; }
  toString() { return String(this.value); }
}
const ethers = { BigNumber: { from: value => new BN(value) }, constants: { Zero: new BN(0) }, utils: {
  parseUnits: (value, decimals) => new BN(BigInt(Math.round(Number(value) * 1e6)) * 10n ** BigInt(decimals - 6)),
  formatUnits: (value, decimals) => String(Number(new BN(value).value) / 10 ** decimals)
} };
const checks = [];
let pool, started = false;
async function main() {
  run('initdb', ['-D', data, '-U', 'custody_fixture', '--auth-local=trust', '--auth-host=reject', '--no-locale', '-E', 'UTF8']);
  run('pg_ctl', ['-D', data, '-l', path.join(temp, 'postgres.log'), '-o', `-F -c listen_addresses='' -k '${socket}' -p ${port}`, '-w', 'start']);
  started = true;
  pool = new pg.Pool({ host: socket, port, database: 'postgres', user: 'custody_fixture', password: '', ssl: false,
    max: 12, connectionTimeoutMillis: 3000, options: '-c statement_timeout=5000 -c lock_timeout=4000' });
  await pool.query(`
    CREATE TABLE schema_migrations(filename TEXT PRIMARY KEY);
    CREATE TABLE users(wallet_address TEXT PRIMARY KEY, usdt_balance NUMERIC(20,6) NOT NULL DEFAULT 0,
      pp_balance NUMERIC(20,6) NOT NULL DEFAULT 0, redeemable_pp NUMERIC(20,6) NOT NULL DEFAULT 0,
      withdrawal_nonce INT NOT NULL DEFAULT 888, last_withdrawal_at TIMESTAMPTZ);
    CREATE TABLE treasury_ledger(id INT PRIMARY KEY, collateral_usdt NUMERIC(20,6) NOT NULL, updated_at TIMESTAMPTZ DEFAULT NOW());
    CREATE TABLE transactions(id BIGSERIAL PRIMARY KEY, type TEXT, from_wallet TEXT, usdt_amount NUMERIC(20,6),
      pp_amount NUMERIC(20,6), fee NUMERIC(20,6), meta JSONB, created_at TIMESTAMPTZ DEFAULT NOW());
    CREATE TABLE deposits(id BIGSERIAL PRIMARY KEY, wallet_address TEXT, amount NUMERIC(20,6), pp_bonus NUMERIC(20,6),
      chain TEXT, tx_hash TEXT UNIQUE NOT NULL, block_number BIGINT, created_at TIMESTAMPTZ DEFAULT NOW());
    CREATE TABLE settings(key TEXT PRIMARY KEY, value TEXT);
  `);
  for (const migration of ['316_pending_withdrawals.sql', '357_deposit_finality_identity.sql']) {
    const client = await pool.connect();
    try { await client.query('BEGIN'); await client.query(fs.readFileSync(path.join(root, 'server/migrations', migration), 'utf8')); await client.query('COMMIT'); }
    catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
  }
  checks.push('Actual migrations 316 and 357 applied to a new minimal schema');
  let signatures = 0, finalized = { nonce: 0, timestamp: Math.floor(Date.now() / 1000), blockNumber: 99, blockHash: 'PUBLIC_FINAL_BLOCK' };
  let eventFinalized = true, chainLiquidity = 100;
  const signer = { CHAINS: { base: { chainId: 8453, decimals: 6 } },
    getOnchainWithdrawNonce: async () => 0,
    getAvailableLiquidity: async () => ethers.utils.parseUnits(String(chainLiquidity), 6),
    async getFinalizedWithdrawState() { if (finalized instanceof Error) throw finalized; return finalized; },
    async verifyFinalizedEvent() { if (!eventFinalized) throw Error('Event not finalized'); },
    async generateWithdrawSignature() { signatures++; return { deadline: Math.floor(Date.now() / 1000) + 600, signature: 'PUBLIC_FIXTURE_CALLBACK_ONLY', chainId: 8453 }; }
  };
  const treasury = load('server/services/treasury.js', {});
  const db = { pool, getSetting: async (_key, fallback) => fallback, ensureUser: async () => {}, awardXP: async () => {}, creditReferralCommission: async () => [] };
  const reloadChain = () => load('server/services/chain.js', { ethers: { ethers }, '../db': db, './treasury': treasury, './signer': signer });
  const handlers = {};
  load('server/routes/redemptionRoutes.js', {
    express: { Router: () => ({ post(route, ...callbacks) { handlers[route] = callbacks.at(-1); } }) },
    ethers: { ethers }, '../utils/rateLimiters': { makeRateLimiter: () => () => {} }, '../db': db,
    '../services/signer': signer, '../services/treasury': treasury,
    '../utils/apiHelpers': { requireAuth() {}, getAuthWallet: req => req.wallet },
    '../utils/settingsCache': { cfg: async () => ({ withdrawal_cooldown_hours: 24, withdraw_min_amount: 1, withdraw_fee_percent: 5 }) }
  });
  async function invoke(wallet = 'alice', route = '/withdraw') {
    const res = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
    await handlers[route]({ wallet, body: { amount: 100, chain: 'base' } }, res); return res;
  }
  async function reset() {
    await pool.query('TRUNCATE users, pending_withdrawals, transactions, deposits, treasury_ledger RESTART IDENTITY');
    await pool.query("INSERT INTO users(wallet_address,usdt_balance) VALUES ('alice',100),('bob',100)");
    await pool.query('INSERT INTO treasury_ledger(id,collateral_usdt) VALUES (1,200)');
    finalized = { nonce: 0, timestamp: Math.floor(Date.now() / 1000), blockNumber: 99, blockHash: 'PUBLIC_FINAL_BLOCK' }; signatures = 0; chainLiquidity = 100;
  }
  const bal = async wallet => Number((await pool.query('SELECT usdt_balance FROM users WHERE wallet_address=$1', [wallet])).rows[0].usdt_balance);
  const pending = async () => (await pool.query('SELECT * FROM pending_withdrawals ORDER BY id')).rows;
  await reset();
  const concurrent = await Promise.all([invoke('alice'), invoke('bob')]);
  assert.deepEqual(concurrent.map(r => r.statusCode).sort(), [200, 409]);
  assert.equal((await pending()).length, 1); assert.equal(signatures, 1);
  const winner = concurrent[0].statusCode === 200 ? 'alice' : 'bob';
  const retry = await invoke(winner); assert.equal(retry.body.reissued, true); assert.equal(retry.body.usdtBalance, 0); assert.equal(retry.body.pending, true);
  const snapshotClient = await pool.connect(); let snapshot;
  try { await snapshotClient.query('BEGIN'); snapshot = await treasury.lockRoom(snapshotClient, winner); await snapshotClient.query('COMMIT'); } finally { snapshotClient.release(); }
  assert.equal(snapshot.customerClaims, 200); assert.equal(snapshot.trackedReserve, 200); assert.equal(snapshot.pendingFeeHold, 5); assert.equal(snapshot.room, 0); assert.equal(snapshot.physicalReserve, null);
  checks.push('Actual concurrent cross-wallet reservation, lost-response reissue and pending claims snapshot');
  await pool.query("UPDATE pending_withdrawals SET deadline=EXTRACT(EPOCH FROM NOW())::bigint-300");
  finalized = Error('PUBLIC_FIXTURE_RPC_TIMEOUT_UNKNOWN');
  await reloadChain().reconcilePendingWithdrawals(); assert.equal((await pending())[0].status, 'pending'); assert.equal(await bal(winner), 0);
  assert.equal((await invoke(winner)).body.error, 'withdrawal_pending_reconciliation');
  const deadline = Number((await pending())[0].deadline);
  finalized = { nonce: 0, timestamp: deadline, blockNumber: 100, blockHash: 'PUBLIC_FINAL_BLOCK' };
  await reloadChain().reconcilePendingWithdrawals(); assert.equal((await pending())[0].status, 'pending');
  finalized.timestamp++;
  await Promise.all([reloadChain().reconcilePendingWithdrawals(), reloadChain().reconcilePendingWithdrawals(), invoke(winner)]);
  assert.equal((await pending())[0].status, 'expired'); assert.equal(await bal(winner), 100);
  assert.equal(Number((await pool.query('SELECT collateral_usdt FROM treasury_ledger')).rows[0].collateral_usdt), 200);
  assert.equal(Number((await pool.query("SELECT COUNT(*) n FROM transactions WHERE type='withdraw_refund'")).rows[0].n), 1);
  checks.push('Actual concurrent reconcile/retry refunds once; timeout and exact final deadline remain reserved');
  await reset(); await invoke('alice');
  finalized.nonce = 1;
  await Promise.all([reloadChain().settleWithdrawal({ wallet: 'alice', chain: 'base', nonce: 0 }), reloadChain().settleWithdrawal({ wallet: 'alice', chain: 'base', nonce: 0 })]);
  await reloadChain().settleWithdrawal({ wallet: 'alice', chain: 'base', nonce: 0 });
  assert.equal((await pending())[0].status, 'settled'); assert.equal(await bal('alice'), 0);
  checks.push('Actual duplicate finalized settlement across service reload causes no refund');
  await reset();
  const receipt = { wallet: 'alice', amount: '10', chain: 'base', txHash: '0x' + 'a'.repeat(64), blockNumber: 88, blockHash: 'PUBLIC_FINAL_BLOCK', logIndex: 1 };
  eventFinalized = false; await assert.rejects(reloadChain().processDeposit(receipt), /not finalized/); assert.equal(await bal('alice'), 100);
  eventFinalized = true;
  await Promise.all([reloadChain().processDeposit(receipt), reloadChain().processDeposit(receipt)]);
  await reloadChain().processDeposit({ ...receipt, logIndex: 2 });
  assert.equal(await bal('alice'), 120);
  assert.equal(Number((await pool.query('SELECT COUNT(*) n FROM deposits')).rows[0].n), 2);
  assert.equal(Number((await pool.query('SELECT collateral_usdt FROM treasury_ledger')).rows[0].collateral_usdt), 220);
  const bonus = (await pool.query("SELECT pp_balance,redeemable_pp FROM users WHERE wallet_address='alice'")).rows[0];
  assert.equal(Number(bonus.pp_balance), 2); assert.equal(Number(bonus.redeemable_pp), 1.6);
  checks.push('Actual finalized-only duplicate deposit/restart, unique log identity, balances and preserved PP buckets');
  await reset();
  const closed = await invoke('alice', '/withdraw-all'); assert.equal(closed.statusCode, 409); assert.equal(await bal('alice'), 100); assert.equal(signatures, 0);
  checks.push('Actual legacy combined withdrawal closure leaves balances intact');
  const limitSettings = { redemption_daily_limit_usdt: '0', redemption_weekly_cap_enabled: 'true', redemption_weekly_cap_pct: '30', redemption_weekly_cap_floor_usdt: '100' };
  async function redeemAgainstWeeklyCap(wallet) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SELECT 1 FROM users WHERE wallet_address=$1 FOR UPDATE', [wallet]);
      const result = await treasury.checkRedemptionLimits(client, { wallet, redeemUsdt: 75 }, async key => limitSettings[key]);
      if (result.ok) await client.query("INSERT INTO transactions(type,from_wallet,usdt_amount) VALUES('swap',$1,75)", [wallet]);
      await client.query(result.ok ? 'COMMIT' : 'ROLLBACK'); return result.ok;
    } finally { client.release(); }
  }
  assert.deepEqual((await Promise.all([redeemAgainstWeeklyCap('alice'), redeemAgainstWeeklyCap('bob')])).sort(), [false, true]);
  checks.push('Actual weekly redemption check plus insertion serializes across users without changing configured cap');
  await pool.query("ALTER TABLE pending_withdrawals RENAME TO custody_missing_pending");
  const failClient = await pool.connect();
  try { await failClient.query('BEGIN'); await assert.rejects(treasury.lockRoom(failClient, 'alice'), error => error.code === '42P01'); await failClient.query('ROLLBACK'); } finally { failClient.release(); }
  assert.equal(await bal('alice'), 100);
  checks.push('Actual missing pending-liability migration cannot yield solvency room');
}
(async () => {
  let failure;
  try { await main(); } catch (error) { failure = error; }
  finally {
    if (pool) await pool.end();
    if (started) run('pg_ctl', ['-D', data, '-m', 'immediate', '-w', 'stop']);
    fs.rmSync(temp, { recursive: true, force: true });
  }
  if (failure) { console.error(failure); process.exitCode = 1; }
  else console.log(JSON.stringify({ ok: true, checks, privateClusterRemoved: !fs.existsSync(temp), noExternalNetwork: true, realSigning: false }, null, 2));
})();
