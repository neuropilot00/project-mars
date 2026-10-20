#!/usr/bin/env node
'use strict';
// New minimal private fixture only. No app bootstrap, existing DB or external IO.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const { spawnSync } = require('node:child_process');
const net = require('node:net'), dns = require('node:dns'), tls = require('node:tls');
const root = path.resolve(__dirname, '../..'), pgBin = '/opt/homebrew/opt/postgresql@16/bin';
fs.mkdirSync(path.join(root, 'work'), { recursive: true });
const temp = fs.mkdtempSync(path.join(root, 'work/pg-l-')), socket = path.join(temp, 's'), data = path.join(temp, 'd'), port = 55492;
fs.mkdirSync(socket); const socketFile = path.join(socket, '.s.PGSQL.' + port); assert.ok(socketFile.length < 104);
const connect = net.Socket.prototype.connect;
function target(args) { return Array.isArray(args[0]) ? target(args[0]) : typeof args[0] === 'string' ? args[0] : args[0]?.path; }
net.Socket.prototype.connect = function (...args) { assert.equal(target(args), socketFile, 'Only this fresh fixture socket is allowed'); return connect.apply(this, args); };
const deny = () => { throw Error('External IO disabled'); };
tls.connect = dns.lookup = dns.resolve = net.Server.prototype.listen = deny;
dns.promises.lookup = dns.promises.resolve = deny; global.fetch = deny;
const { Pool } = require('pg');
function run(binary, args) {
  const result = spawnSync(path.join(pgBin, binary), args, { encoding: 'utf8', env: { PATH: '/usr/bin:/bin', LC_ALL: 'C' } });
  if (result.status !== 0) throw Error(binary + ': ' + result.stderr + result.stdout);
}
function load(name, db, dependencies = {}) {
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(path.join(root, 'server/services', name + '.js'), 'utf8'), {
    module, exports: module.exports, console: { log() {}, error() {}, warn() {} },
    require(key) { if (key === '../db') return db; if (key === 'crypto') return { randomInt: () => 1 }; if (key in dependencies) return dependencies[key]; throw Error('Uninjected dependency ' + key); }
  });
  return module.exports;
}
let pool, started = false, failAllocation = false, failCreation = false;
const checks = [];
async function main() {
  run('initdb', ['-D', data, '-U', 'lottery_fixture', '--auth-local=trust', '--auth-host=reject', '--no-locale', '-E', 'UTF8']);
  run('pg_ctl', ['-D', data, '-l', path.join(temp, 'pg.log'), '-o', `-F -c listen_addresses='' -k '${socket}' -p ${port}`, '-w', 'start']); started = true;
  pool = new Pool({ host: socket, port, database: 'postgres', user: 'lottery_fixture', password: '', ssl: false, max: 12,
    connectionTimeoutMillis: 3000, options: '-c statement_timeout=5000 -c lock_timeout=4000' });
  async function q(db, sql, args) {
    if (failAllocation && sql.includes('INSERT INTO gp_dividend_pool')) return db.query('SELECT 1/0');
    if (failCreation && sql.includes('INSERT INTO lottery_rounds')) return db.query('SELECT 1/0');
    return db.query(sql, args);
  }
  const db = { pool: { query: (sql, args) => q(pool, sql, args), async connect() {
    const client = await pool.connect(); return { query: (sql, args) => q(client, sql, args), release: () => client.release() };
  } } };
  const dividends = load('dividends', db), lottery = load('lottery', db, { './dividends': dividends });
  await pool.query(`
    CREATE TABLE schema_migrations(filename TEXT PRIMARY KEY);
    CREATE TABLE users(wallet_address TEXT PRIMARY KEY, gp_balance NUMERIC(20,6) NOT NULL, nickname TEXT);
    CREATE TABLE settings(key TEXT PRIMARY KEY,value TEXT);
    CREATE TABLE lottery_rounds(id BIGSERIAL PRIMARY KEY,round_number INTEGER UNIQUE NOT NULL,ticket_price_gp NUMERIC(20,6) NOT NULL,
      ticket_count INTEGER NOT NULL DEFAULT 0,prize_pool_gp NUMERIC(20,6) NOT NULL DEFAULT 0,status TEXT NOT NULL DEFAULT 'open',
      ends_at TIMESTAMPTZ NOT NULL,drawn_at TIMESTAMPTZ,winner_wallet TEXT,winning_ticket_number INTEGER,created_at TIMESTAMPTZ DEFAULT NOW());
    CREATE TABLE lottery_tickets(id BIGSERIAL PRIMARY KEY,round_id BIGINT REFERENCES lottery_rounds(id),wallet TEXT,ticket_number INTEGER,
      created_at TIMESTAMPTZ DEFAULT NOW(),UNIQUE(round_id,ticket_number));
    CREATE TABLE gp_dividend_pool(id BIGSERIAL PRIMARY KEY,week_start DATE UNIQUE,pool_gp NUMERIC(20,6) DEFAULT 0);
    INSERT INTO lottery_rounds(round_number,ticket_price_gp,ticket_count,prize_pool_gp,ends_at) VALUES(1,10,10,95,NOW()-INTERVAL '1 minute');
    INSERT INTO lottery_tickets(round_id,wallet,ticket_number) SELECT 1,'alice',n FROM generate_series(1,10) n;
    INSERT INTO users VALUES('alice',0,'Fixture Alice'),('bob',100,'Fixture Bob');
    INSERT INTO settings VALUES('lottery_enabled','false');
  `);
  for (const migration of ['296_lottery_tickets_is_winner.sql', '358_lottery_captured_house.sql']) {
    const client = await pool.connect();
    try { await client.query('BEGIN'); await client.query(fs.readFileSync(path.join(root, 'server/migrations', migration), 'utf8')); await client.query('COMMIT'); }
    catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
  }
  assert.equal(Number((await pool.query('SELECT house_gp FROM lottery_rounds')).rows[0].house_gp), 0);
  assert.equal((await pool.query('SELECT paid_gp FROM lottery_tickets LIMIT 1')).rows[0].paid_gp, null);
  assert.equal(await lottery.drawExpiredRounds(), 1);
  assert.equal(Number((await pool.query('SELECT COALESCE(SUM(pool_gp),0) n FROM gp_dividend_pool')).rows[0].n), 0);
  checks.push('Real 358 migrates current179/296 historical rows to house0/paidNULL without inferred allocation');
  async function reset({ minTickets = 3 } = {}) {
    failAllocation = failCreation = false;
    await pool.query('TRUNCATE lottery_tickets,lottery_rounds,users,settings,gp_dividend_pool RESTART IDENTITY');
    await pool.query("INSERT INTO users VALUES('alice',100,'Fixture Alice'),('bob',100,'Fixture Bob')");
    await pool.query("INSERT INTO settings VALUES('lottery_enabled','true'),('lottery_min_tickets',$1)", [String(minTickets)]);
  }
  async function buy(wallet, count) {
    const client = await pool.connect();
    try { await client.query('BEGIN'); const result = await lottery.buyTickets(client, wallet, count); await client.query('COMMIT'); return result; }
    catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
  }
  const balance = async wallet => Number((await pool.query('SELECT gp_balance FROM users WHERE wallet_address=$1', [wallet])).rows[0].gp_balance);
  const round = async id => (await pool.query('SELECT * FROM lottery_rounds WHERE id=$1', [id])).rows[0];
  const poolGP = async () => Number((await pool.query('SELECT COALESCE(SUM(pool_gp),0) n FROM gp_dividend_pool')).rows[0].n);
  const expire = async id => pool.query("UPDATE lottery_rounds SET ends_at=NOW()-INTERVAL '1 minute' WHERE id=$1", [id]);
  await reset(); const opened = await lottery.getCurrentRound('alice');
  await buy('alice', 10); let captured = await round(opened.id);
  assert.equal(await balance('alice'), 0); assert.equal(Number(captured.prize_pool_gp), 95); assert.equal(Number(captured.house_gp), 5);
  assert.equal(Number((await pool.query('SELECT SUM(paid_gp) n FROM lottery_tickets')).rows[0].n), 100);
  await expire(opened.id); assert.equal(await lottery.drawExpiredRounds(), 1);
  assert.equal(await balance('alice'), 95); assert.equal(await poolGP(), 1.5);
  assert.equal(await lottery.drawExpiredRounds(), 0); assert.equal(await poolGP(), 1.5);
  const admin = await lottery.getAdminStats(); assert.equal(admin.total_house_gp, 5);
  checks.push('New actual debit100 equals prize95+captured house5; draw pays95 and dividends1.5 once; admin reports captured completed house');
  await reset({ minTickets: 20 }); const cancelled = await lottery.getCurrentRound('alice');
  await buy('alice', 5);
  await pool.query("INSERT INTO settings VALUES('lottery_ticket_price_gp','20')");
  assert.equal((await lottery.getCurrentRound('bob')).ticket_price, 20);
  await buy('bob', 2); assert.equal(await balance('alice'), 50); assert.equal(await balance('bob'), 60);
  await expire(cancelled.id); assert.equal(await lottery.drawExpiredRounds(), 1);
  assert.equal((await round(cancelled.id)).status, 'cancelled'); assert.equal(await balance('alice'), 100); assert.equal(await balance('bob'), 100);
  assert.equal(await poolGP(), 0); assert.equal((await lottery.getAdminStats()).total_house_gp, 0);
  checks.push('Current-price display matches unchanged charge policy; cancellation refunds actual captured principal50/40 across price changes, without house revenue');
  await reset(); const failed = await lottery.getCurrentRound('alice'); await buy('alice', 10); await expire(failed.id);
  failAllocation = true; assert.equal(await lottery.drawExpiredRounds(), 0);
  assert.equal((await round(failed.id)).status, 'open'); assert.equal(await balance('alice'), 0); assert.equal(await poolGP(), 0);
  assert.equal(Number((await pool.query('SELECT COUNT(*) n FROM lottery_tickets WHERE is_winner')).rows[0].n), 0);
  failAllocation = false;
  const draws = await Promise.all([lottery.drawExpiredRounds(), lottery.drawExpiredRounds()]);
  assert.equal(draws.reduce((a, b) => a + b), 1); assert.equal(await balance('alice'), 95); assert.equal(await poolGP(), 1.5);
  assert.equal(Number((await pool.query("SELECT COUNT(*) n FROM lottery_rounds WHERE status='open'")).rows[0].n), 1);
  checks.push('Allocation failure rolls reward/ticket/status/pool back and counts0; concurrent retry settles once and opens one next round');
  await reset(); const next = await lottery.getCurrentRound('alice'); await buy('alice', 10); await expire(next.id);
  failCreation = true; assert.equal(await lottery.drawExpiredRounds(), 1);
  assert.equal((await round(next.id)).status, 'completed'); assert.equal(await balance('alice'), 95); assert.equal(await poolGP(), 1.5);
  assert.equal(Number((await pool.query("SELECT COUNT(*) n FROM lottery_rounds WHERE status='open'")).rows[0].n), 0);
  failCreation = false;
  assert.deepEqual(await Promise.all([lottery.drawExpiredRounds(), lottery.drawExpiredRounds()]), [0, 0]);
  assert.equal(Number((await pool.query("SELECT COUNT(*) n FROM lottery_rounds WHERE status='open'")).rows[0].n), 1);
  assert.equal(await balance('alice'), 95); assert.equal(await poolGP(), 1.5);
  checks.push('Next-round creation failure does not misreport/rollback settled money; concurrent later scheduler retries create exactly one open round');
  await reset();
  const rounds = await Promise.all(Array.from({ length: 5 }, () => lottery.createRound({ ticketPrice: 10, roundHours: 24 })));
  assert.equal(new Set(rounds.map(r => r.id)).size, 1);
  assert.equal(Number((await pool.query('SELECT COUNT(*) n FROM lottery_rounds')).rows[0].n), 1);
  checks.push('Actual simultaneous first/current-round creation is idempotent under advisory lock');
  await reset(); const rollback = await lottery.getCurrentRound('alice');
  await pool.query('ALTER TABLE lottery_rounds RENAME COLUMN house_gp TO missing_house_gp');
  await assert.rejects(buy('alice', 10), error => error.code === '42703');
  assert.equal(await balance('alice'), 100); assert.equal(Number((await pool.query('SELECT COUNT(*) n FROM lottery_tickets')).rows[0].n), 0);
  assert.equal(Number((await round(rollback.id)).prize_pool_gp), 0);
  await pool.query('ALTER TABLE lottery_rounds RENAME COLUMN missing_house_gp TO house_gp');
  checks.push('Missing captured-house schema rolls purchase debit/tickets/prize back, never commits untracked funding');
  await reset({ minTickets: 20 }); const legacyCancel = await lottery.getCurrentRound('alice');
  await pool.query("UPDATE lottery_rounds SET ticket_count=1,prize_pool_gp=9.5,ends_at=NOW()-INTERVAL '1 minute' WHERE id=$1", [legacyCancel.id]);
  await pool.query("INSERT INTO lottery_tickets(round_id,wallet,ticket_number) VALUES($1,'alice',1)", [legacyCancel.id]);
  await pool.query("UPDATE users SET gp_balance=90 WHERE wallet_address='alice'");
  assert.equal(await lottery.drawExpiredRounds(), 1); assert.equal(await balance('alice'), 100); assert.equal(await poolGP(), 0);
  checks.push('Unrecorded historical ticket cancellation retains original round-price fallback; no historical house reconstruction');
  await reset({ minTickets: 20 });
  await pool.query("INSERT INTO settings VALUES('lottery_ticket_price_gp','0.33333335')");
  const fractional = await lottery.getCurrentRound('alice'); await buy('alice', 3);
  assert.equal(await balance('alice'), 99);
  assert.equal(Number((await pool.query('SELECT SUM(paid_gp) n FROM lottery_tickets')).rows[0].n), 1);
  await expire(fractional.id); assert.equal(await lottery.drawExpiredRounds(), 1); assert.equal(await balance('alice'), 100);
  checks.push('Six-decimal debit principal conserves rounding remainder across tickets and cancels without losing a micro-GP');
  assert.equal(Number((await pool.query("SELECT COUNT(*) n FROM pg_stat_activity WHERE datname='postgres' AND state='idle in transaction'")).rows[0].n), 0);
}
(async () => {
  let error;
  try { await main(); } catch (failure) { error = failure; }
  finally {
    if (pool) await pool.end();
    if (started) run('pg_ctl', ['-D', data, '-m', 'immediate', '-w', 'stop']);
    fs.rmSync(temp, { recursive: true, force: true });
  }
  if (error) { console.error(error); process.exitCode = 1; }
  else console.log(JSON.stringify({ ok: true, groups: checks.length, checks, privateClusterRemoved: !fs.existsSync(temp), externalNetwork: false, realSigning: false }, null, 2));
})();
