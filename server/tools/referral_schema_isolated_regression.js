#!/usr/bin/env node
'use strict';
// Actual referral HTTP routes + extracted DB helpers, fresh private Unix-socket PG.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const net = require('node:net');
const http = require('node:http');
const crypto = require('node:crypto');
const vm = require('node:vm');
const Module = require('node:module');
const { execFileSync } = require('node:child_process');
assert.equal(process.env.NODE_ENV, 'test'); assert.equal(process.env.RUN_SCHEDULERS, 'false');
for (const key of Object.keys(process.env)) assert.ok(['PATH', 'NODE_ENV', 'RUN_SCHEDULERS', '__CF_USER_TEXT_ENCODING'].includes(key), 'UNEXPECTED_ENVIRONMENT:' + key);
const root = path.resolve(__dirname, '../..'), pgBin = '/opt/homebrew/opt/postgresql@16/bin';
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'oc-referral-schema-'));
fs.chmodSync(dir, 0o700);
const data = path.join(dir, 'db'), socket = path.join(dir, 's'), port = 55453;
fs.mkdirSync(socket, { mode: 0o700 });
const pgSocket = path.join(socket, '.s.PGSQL.' + port), httpSocket = path.join(dir, 'http.sock');
const childEnv = { PATH: '/opt/homebrew/bin:/usr/bin:/bin', LC_ALL: 'C' };
const inject = (file, exports) => { const id = require.resolve(file); require.cache[id] = { id, filename: id, loaded: true, exports }; };
const hashes = {};
const read = file => { const text = fs.readFileSync(path.join(root, file), 'utf8'); hashes[file] = crypto.createHash('sha256').update(text).digest('hex'); return text; };
let pool, server, started = false, checks = 0;
const pass = (name, details) => { checks++; console.log('PASS ' + name + (details ? ': ' + JSON.stringify(details) : '')); };
function boundary() {
  const target = args => Array.isArray(args[0]) ? target(args[0]) : typeof args[0] === 'string' ? args[0] : args[0]?.path;
  const connect = net.Socket.prototype.connect;
  net.Socket.prototype.connect = function (...args) { assert.ok([pgSocket, httpSocket].includes(target(args)), 'ONLY_PRIVATE_UNIX_SOCKETS'); return connect.apply(this, args); };
  const listen = net.Server.prototype.listen;
  net.Server.prototype.listen = function (...args) { assert.equal(target(args), httpSocket); return listen.apply(this, args); };
  const deny = () => { throw Error('EXTERNAL_IO_FORBIDDEN'); };
  require('node:tls').connect = deny;
  const dns = require('node:dns'); dns.lookup = deny; dns.resolve = deny; dns.promises.lookup = deny; dns.promises.resolve = deny; global.fetch = deny;
  const load = Module._load;
  Module._load = function (request, ...args) {
    if (['dotenv', 'ioredis', 'ethers', 'nodemailer'].includes(String(request).split('/')[0])) throw Error('FORBIDDEN_DEPENDENCY:' + request);
    return load.call(this, request, ...args);
  };
  const readFile = fs.readFileSync;
  fs.readFileSync = function (file, ...args) { assert.ok(!path.basename(String(file)).startsWith('.env') && !['.pgpass', 'credentials'].includes(path.basename(String(file))), 'NO_CREDENTIAL_READS'); return readFile.call(this, file, ...args); };
}
async function run() {
  try {
    execFileSync(path.join(pgBin, 'initdb'), ['-D', data, '--no-locale', '--encoding=UTF8', '--auth=trust', '--username=referral_schema_fixture'], { env: childEnv, stdio: 'pipe' });
    fs.appendFileSync(path.join(data, 'postgresql.conf'), "\nlisten_addresses=''\nport=" + port + "\nunix_socket_directories='" + socket + "'\n");
    execFileSync(path.join(pgBin, 'pg_ctl'), ['-D', data, '-l', path.join(dir, 'postgres.log'), '-w', 'start'], { env: childEnv, stdio: 'pipe' }); started = true;
    boundary();
    const { Pool } = require('pg');
    pool = new Pool({ host: socket, port, user: 'referral_schema_fixture', password: 'unused-public-fixture-password', database: 'postgres', ssl: false, max: 8, statement_timeout: 6000, query_timeout: 7000 });
    await pool.query(`CREATE TABLE schema_migrations(filename text PRIMARY KEY); CREATE TABLE settings(key text PRIMARY KEY,value text);
      CREATE TABLE users(wallet_address text PRIMARY KEY,nickname text,referral_code text,referred_by text,gp_balance numeric NOT NULL DEFAULT 0,pp_balance numeric NOT NULL DEFAULT 0,usdt_balance numeric NOT NULL DEFAULT 0);
      INSERT INTO users VALUES('fixture_referrer','Referrer','PUBLICREF',NULL,100,20,0),('fixture_child','Child','PUBLICCHILD','fixture_referrer',100,20,0),('fixture_new','New',NULL,NULL,55,8,0);
      INSERT INTO settings VALUES('referral_enabled','true'),('referral_market_fee_pct','100'),('referral_tier1_percent','100'),('referral_daily_cap_gp','1000'),('referral_daily_cap_pp','1000');`);
    const initial = read('server/migrations/001_initial_schema.sql');
    const referralDDL = initial.match(/CREATE TABLE IF NOT EXISTS referral_rewards \([\s\S]*?\n\);/)[0];
    await pool.query(referralDDL);
    await pool.query("INSERT INTO referral_rewards(from_wallet,to_wallet,tier,pp_amount,trigger_type) VALUES('fixture_child','fixture_referrer',1,2.5,'legacy_harvest'),('fixture_child','fixture_referrer',2,1.25,'legacy_gp_name')");
    const dbSource = read('server/db.js');
    const getSetting = async (key, fallback) => (await pool.query('SELECT value FROM settings WHERE key=$1', [key])).rows[0]?.value ?? fallback;
    const context = { getSetting, console }; vm.createContext(context);
    vm.runInContext(dbSource.slice(dbSource.indexOf('async function getReferralChain('), dbSource.indexOf('// ── Check breakthrough conditions')), context);
    const noop = async () => {};
    inject('../db', { pool, getSetting, generateReferralCode: context.generateReferralCode, ensureUser: async () => { throw Error('UNEXPECTED_USER_CREATE'); } });
    inject('../services/season', { addSeasonScore: noop }); inject('../services/achievements', { checkAndUnlock: noop });
    const express = require('express'), app = express();
    app.use((req, _res, next) => { Object.defineProperty(req, 'ip', { value: '127.0.0.1' }); next(); });
    app.use('/api', require('../routes/referralRoutes')); server = http.createServer(app);
    await new Promise(resolve => server.listen(httpSocket, resolve));
    const get = route => new Promise((resolve, reject) => {
      const req = http.request({ socketPath: httpSocket, path: route, method: 'GET' }, res => { let text = ''; res.setEncoding('utf8'); res.on('data', chunk => { text += chunk; }); res.on('end', () => { try { resolve({ status: res.statusCode, body: JSON.parse(text) }); } catch (error) { reject(error); } }); });
      req.on('error', reject); req.setTimeout(7000, () => req.destroy(Error('FIXTURE_TIMEOUT'))); req.end();
    });
    assert.equal((await get('/api/referral/fixture_referrer')).status, 500);
    assert.equal((await get('/api/referral/leaderboard/top')).status, 500);
    pass('001 legacy schema reproduces actual referral info and leaderboard GET500');
    const oldRows = JSON.stringify((await pool.query('SELECT * FROM referral_rewards ORDER BY id')).rows);
    const oldUsers = JSON.stringify((await pool.query('SELECT * FROM users ORDER BY wallet_address')).rows);
    const migration = read('server/migrations/361_referral_currency_compatibility.sql');
    const migrationClient = await pool.connect();
    try { await migrationClient.query('BEGIN'); await migrationClient.query(migration); await migrationClient.query('COMMIT'); }
    catch (error) { await migrationClient.query('ROLLBACK'); throw error; } finally { migrationClient.release(); }
    const rows = (await pool.query('SELECT * FROM referral_rewards ORDER BY id')).rows;
    assert.equal(JSON.stringify(rows.map(({ gp_amount, currency, ...legacy }) => legacy)), oldRows);
    assert.ok(rows.every(row => row.gp_amount === '0.000000' && row.currency === 'pp'));
    assert.equal(JSON.stringify((await pool.query('SELECT * FROM users ORDER BY wallet_address')).rows), oldUsers);
    pass('361 adds gp0/currencyPP without rewriting old row evidence, interpreting trigger names or crediting balances');
    const legacy = await get('/api/referral/fixture_referrer'); assert.equal(legacy.status, 200);
    assert.equal(legacy.body.totalEarned, 3.75); assert.equal(legacy.body.totalEarnedGP, 0); assert.equal(legacy.body.referrals, 1);
    const fresh = await get('/api/referral/fixture_new'); assert.equal(fresh.status, 200); assert.equal(fresh.body.totalEarned, 0); assert.equal(fresh.body.totalEarnedGP, 0); assert.equal(fresh.body.code.length, 8);
    pass('actual old and new-account GET200 reports preserved legacy PP and zero GP; new code generation works');

    const totals = async () => (await pool.query('SELECT SUM(gp_balance)::text AS gp,SUM(pp_balance)::text AS pp FROM users')).rows[0];
    for (const currency of ['gp', 'pp']) {
      const before = await totals(), client = await pool.connect();
      try {
        await client.query('BEGIN');
        const col = currency === 'gp' ? 'gp_balance' : 'pp_balance';
        await client.query(`UPDATE users SET ${col}=${col}-10 WHERE wallet_address='fixture_child' AND ${col}>=10`);
        const rewards = await context.creditReferralCommission(client, 'fixture_child', 'market_fee', 10, currency);
        assert.equal(rewards.length, 1); assert.equal(rewards[0].amount, 10); assert.equal(rewards[0].currency, currency);
        await client.query('COMMIT');
      } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
      assert.deepEqual(await totals(), before);
    }
    const info = await get('/api/referral/fixture_referrer'); assert.equal(info.status, 200);
    assert.equal(info.body.totalEarned, 13.75); assert.equal(info.body.totalEarnedGP, 10);
    const leaderboard = await get('/api/referral/leaderboard/top'); assert.equal(leaderboard.status, 200);
    assert.equal(leaderboard.body.leaderboard[0].totalEarned, 13.75); assert.equal(leaderboard.body.leaderboard[0].totalEarnedGP, 10);
    assert.equal((await get('/api/referral/stats/fixture_referrer')).status, 200);
    pass('actual GP/PP helper writes matching-denomination rows and unchanged real routes aggregate them separately; funded caller totals conserved');
    const allRows = JSON.stringify((await pool.query('SELECT * FROM referral_rewards ORDER BY id')).rows);
    const allUsers = JSON.stringify((await pool.query('SELECT * FROM users ORDER BY wallet_address')).rows);
    await pool.query(migration);
    assert.equal(JSON.stringify((await pool.query('SELECT * FROM referral_rewards ORDER BY id')).rows), allRows);
    assert.equal(JSON.stringify((await pool.query('SELECT * FROM users ORDER BY wallet_address')).rows), allUsers);
    assert.equal((await pool.query("SELECT COUNT(*)::int AS n FROM schema_migrations WHERE filename='361_referral_currency_compatibility.sql'")).rows[0].n, 1);
    pass('repeated migration preserves nonzero GP/PP records, all balances and one migration receipt');
    read('server/routes/referralRoutes.js'); read('server/tools/referral_schema_isolated_regression.js');
    console.log(JSON.stringify({ result: 'passed', checks, sources: hashes, existingAppOrDatabaseModified: false }, null, 2));
  } finally {
    if (server) await new Promise(resolve => server.close(resolve));
    if (pool) await pool.end();
    if (started) execFileSync(path.join(pgBin, 'pg_ctl'), ['-D', data, '-m', 'immediate', '-w', 'stop'], { env: childEnv, stdio: 'pipe' });
    fs.rmSync(dir, { recursive: true, force: true }); assert.equal(fs.existsSync(dir), false);
    console.log('CLEANUP temporary referral-schema PostgreSQL cluster and HTTP socket removed');
  }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
