#!/usr/bin/env node
'use strict';
// Actual season routes/services + authored season DDL in a disposable PG cluster.
// No existing database, application bootstrap, .env, TCP, account or scheduler.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const net = require('node:net');
const http = require('node:http');
const crypto = require('node:crypto');
const Module = require('node:module');
const { execFileSync } = require('node:child_process');
assert.equal(process.env.NODE_ENV, 'test');
assert.equal(process.env.RUN_SCHEDULERS, 'false');
for (const name of Object.keys(process.env)) assert.ok(['PATH', 'NODE_ENV', 'RUN_SCHEDULERS', '__CF_USER_TEXT_ENCODING'].includes(name), 'UNEXPECTED_ENVIRONMENT:' + name);
const root = path.resolve(__dirname, '../..'), pgBin = '/opt/homebrew/opt/postgresql@16/bin';
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'oc-season-schema-'));
fs.chmodSync(dir, 0o700);
const data = path.join(dir, 'db'), socket = path.join(dir, 's'), port = 55451;
fs.mkdirSync(socket, { mode: 0o700 });
const pgSocket = path.join(socket, '.s.PGSQL.' + port), httpSocket = path.join(dir, 'http.sock');
const childEnv = { PATH: '/opt/homebrew/bin:/usr/bin:/bin', LC_ALL: 'C' };
const inject = (file, exports) => { const id = require.resolve(file); require.cache[id] = { id, filename: id, loaded: true, exports }; };
const hashes = {};
const read = file => { const source = fs.readFileSync(path.join(root, file), 'utf8'); hashes[file] = crypto.createHash('sha256').update(source).digest('hex'); return source; };
let pool, server, started = false, checks = 0;
const pass = (name, details) => { checks++; console.log('PASS ' + name + (details ? ': ' + JSON.stringify(details) : '')); };

function boundary() {
  const target = args => Array.isArray(args[0]) ? target(args[0]) : typeof args[0] === 'string' ? args[0] : args[0]?.path;
  const connect = net.Socket.prototype.connect;
  net.Socket.prototype.connect = function (...args) { assert.ok([pgSocket, httpSocket].includes(target(args)), 'ONLY_PRIVATE_FIXTURE_UNIX_SOCKETS'); return connect.apply(this, args); };
  const listen = net.Server.prototype.listen;
  net.Server.prototype.listen = function (...args) { assert.equal(target(args), httpSocket, 'ONLY_PRIVATE_FIXTURE_HTTP'); return listen.apply(this, args); };
  const deny = () => { throw Error('EXTERNAL_IO_FORBIDDEN'); };
  require('node:tls').connect = deny;
  const dns = require('node:dns'); dns.lookup = deny; dns.resolve = deny; dns.promises.lookup = deny; dns.promises.resolve = deny; global.fetch = deny;
  const load = Module._load;
  Module._load = function (request, ...args) {
    if (['dotenv', 'ioredis', 'ethers', 'nodemailer'].includes(String(request).split('/')[0])) throw Error('FORBIDDEN_DEPENDENCY:' + request);
    return load.call(this, request, ...args);
  };
  const readFile = fs.readFileSync;
  fs.readFileSync = function (file, ...args) {
    assert.ok(!path.basename(String(file)).startsWith('.env') && !['.pgpass', 'credentials'].includes(path.basename(String(file))), 'NO_CREDENTIAL_READS');
    return readFile.call(this, file, ...args);
  };
}

async function run() {
  try {
    execFileSync(path.join(pgBin, 'initdb'), ['-D', data, '--no-locale', '--encoding=UTF8', '--auth=trust', '--username=season_schema_fixture'], { env: childEnv, stdio: 'pipe' });
    fs.appendFileSync(path.join(data, 'postgresql.conf'), "\nlisten_addresses=''\nport=" + port + "\nunix_socket_directories='" + socket + "'\n");
    execFileSync(path.join(pgBin, 'pg_ctl'), ['-D', data, '-l', path.join(dir, 'postgres.log'), '-w', 'start'], { env: childEnv, stdio: 'pipe' }); started = true;
    boundary();
    const { Pool } = require('pg');
    pool = new Pool({ host: socket, port, user: 'season_schema_fixture', password: 'unused-public-fixture-password', database: 'postgres', ssl: false, max: 8, statement_timeout: 6000, query_timeout: 7000 });
    await pool.query('CREATE TABLE schema_migrations(filename text PRIMARY KEY); CREATE TABLE users(wallet_address text PRIMARY KEY,nickname text,created_at timestamptz DEFAULT NOW(),xp integer DEFAULT 0,gp_balance numeric,pp_balance numeric)');
    await pool.query(read('server/migrations/047_season_system.sql'));
    await pool.query(read('server/migrations/050_seed_seasons.sql'));
    // The exact season-only extension block in the active 094 migration.
    const active094 = read('server/migrations/094_siege_hijack_integration.sql');
    const scoreBlock = active094.slice(active094.indexOf('-- ── 4. 시즌 통계'), active094.indexOf('-- ── 5. GP 활동'));
    assert.ok(scoreBlock.includes('ALTER TABLE season_scores ADD COLUMN ships_built'));
    await pool.query(scoreBlock);
    await pool.query(read('server/migrations/359_season_reward_finalizations.sql'));
    await pool.query("INSERT INTO users(wallet_address,nickname,gp_balance,pp_balance) VALUES('fixture_commander','Commander',123.45,2.5)");
    const seasonId = (await pool.query('SELECT id FROM seasons WHERE active=true ORDER BY id LIMIT 1')).rows[0].id;
    await pool.query("INSERT INTO season_scores(season_id,wallet,score,ships_built,pixels_claimed) VALUES($1,'fixture_commander',125,7,11)", [seasonId]);
    await pool.query("INSERT INTO season_rewards(season_id,wallet,rank,reward_type,reward_amount,claimed) VALUES($1,'fixture_commander',1,'gp',100,true)", [seasonId]);
    const noop = async () => {};
    inject('../db', { pool, getSetting: async (_key, fallback) => fallback, getPPToGPRate: async () => 10, logGPActivity: noop, notifyPlayer: noop });
    const service = require('../services/season');
    const express = require('express');
    const app = express();
    app.use((req, _res, next) => { Object.defineProperty(req, 'ip', { value: '127.0.0.1' }); next(); });
    app.use('/api', require('../routes/seasonRoutes'));
    server = http.createServer(app);
    await new Promise(resolve => server.listen(httpSocket, resolve));
    const get = route => new Promise((resolve, reject) => {
      const req = http.request({ socketPath: httpSocket, path: route, method: 'GET' }, res => {
        let value = ''; res.setEncoding('utf8'); res.on('data', chunk => { value += chunk; });
        res.on('end', () => { try { resolve({ status: res.statusCode, body: JSON.parse(value) }); } catch (error) { reject(error); } });
      });
      req.on('error', reject); req.setTimeout(7000, () => req.destroy(Error('FIXTURE_TIMEOUT'))); req.end();
    });
    const columns = async () => (await pool.query("SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='season_scores'")).rows.map(row => row.column_name);
    const preColumns = await columns();
    const requiredMissing = service.ALL_CATEGORIES.map(category => category.col).filter(column => !preColumns.includes(column));
    assert.deepEqual(requiredMissing.sort(), ['enhancements_done', 'naval_wins', 'trades_completed']);
    const failed = await get('/api/season/leaderboard?limit=20');
    assert.equal(failed.status, 500); assert.equal(failed.body.error, 'Failed to get leaderboard');
    await assert.rejects(service.addSeasonScore('fixture_commander', 'enhance', 1), error => error.code === '42703');
    pass('authored active season schema reproduces actual leaderboard GET500 and score write42703', { missingColumns: requiredMissing });

    const snapshot = async () => JSON.stringify({ users: (await pool.query('SELECT * FROM users ORDER BY wallet_address')).rows,
      scores: (await pool.query('SELECT season_id,wallet,score,ships_built,pixels_claimed FROM season_scores ORDER BY id')).rows,
      rewards: (await pool.query('SELECT * FROM season_rewards ORDER BY id')).rows,
      finalizations: (await pool.query('SELECT * FROM season_reward_finalizations ORDER BY season_id')).rows });
    const before = await snapshot();
    const migration = read('server/migrations/360_season_score_compatibility.sql');
    const client = await pool.connect();
    try { await client.query('BEGIN'); await client.query(migration); await client.query('COMMIT'); }
    catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
    assert.equal(await snapshot(), before);
    const postColumns = await columns();
    assert.deepEqual(service.ALL_CATEGORIES.map(category => category.col).filter(column => !postColumns.includes(column)), []);
    const added = (await pool.query("SELECT enhancements_done,trades_completed,naval_wins,ships_built FROM season_scores WHERE wallet='fixture_commander'")).rows[0];
    assert.deepEqual(added, { enhancements_done: 0, trades_completed: 0, naval_wins: 0, ships_built: 7 });
    pass('migration adds real missing columns with zero defaults and preserves all old scores/balances/rights/finalizations');

    const ok = await get('/api/season/leaderboard?limit=20');
    assert.equal(ok.status, 200); assert.equal(ok.body.leaderboard.length, 1);
    assert.equal(ok.body.leaderboard[0].score, 125); assert.equal(ok.body.leaderboard[0].shipsBuilt, 7);
    assert.equal(ok.body.leaderboard[0].enhancementsDone, 0); assert.equal(ok.body.leaderboard[0].tradesCompleted, 0); assert.equal(ok.body.leaderboard[0].navalWins, 0);
    pass('actual unchanged leaderboard GET now returns200 with original score and explicit new counters');
    for (const category of service.ALL_CATEGORIES) assert.equal((await get('/api/season/category/' + category.key)).status, 200, category.key);
    pass('every current category GET executes against actual columns', { categories: service.ALL_CATEGORIES.length });

    for (const [type, amount] of [['enhance', 2], ['trade', 3], ['naval_win', 1], ['ship_build', 1]]) await service.addSeasonScore('fixture_commander', type, amount);
    const updated = (await pool.query("SELECT score,enhancements_done,trades_completed,naval_wins,ships_built FROM season_scores WHERE wallet='fixture_commander'")).rows[0];
    assert.deepEqual(updated, { score: 165, enhancements_done: 2, trades_completed: 3, naval_wins: 1, ships_built: 8 });
    const countersBeforeRepeat = JSON.stringify(updated);
    await pool.query(migration);
    assert.equal(JSON.stringify((await pool.query("SELECT score,enhancements_done,trades_completed,naval_wins,ships_built FROM season_scores WHERE wallet='fixture_commander'")).rows[0]), countersBeforeRepeat);
    assert.equal((await pool.query("SELECT COUNT(*)::int AS n FROM schema_migrations WHERE filename='360_season_score_compatibility.sql'")).rows[0].n, 1);
    assert.equal(JSON.stringify((await pool.query('SELECT * FROM users ORDER BY wallet_address')).rows), JSON.stringify(JSON.parse(before).users));
    pass('four actual score writers work; repeated migration preserves nonzero counters and leaves money unchanged');
    // Match current 094 history where ships_built exists and may be nullable. No retrofit write.
    assert.equal((await pool.query("SELECT is_nullable FROM information_schema.columns WHERE table_name='season_scores' AND column_name='ships_built'")).rows[0].is_nullable, 'YES');
    for (const column of ['enhancements_done', 'trades_completed', 'naval_wins']) {
      const col = (await pool.query("SELECT data_type,is_nullable,column_default FROM information_schema.columns WHERE table_name='season_scores' AND column_name=$1", [column])).rows[0];
      assert.deepEqual(col, { data_type: 'integer', is_nullable: 'NO', column_default: '0' });
    }
    pass('new counters enforce integer NOT NULL DEFAULT0 while existing column contract stays intact');
    read('server/services/season.js'); read('server/routes/seasonRoutes.js'); read('server/tools/season_schema_isolated_regression.js');
    console.log(JSON.stringify({ result: 'passed', checks, sources: hashes, database: 'fresh private PostgreSQL16; actual routes/services; season DDL047/050/094 and359/360', existingAppOrDatabaseModified: false }, null, 2));
  } finally {
    if (server) await new Promise(resolve => server.close(resolve));
    if (pool) await pool.end();
    if (started) execFileSync(path.join(pgBin, 'pg_ctl'), ['-D', data, '-m', 'immediate', '-w', 'stop'], { env: childEnv, stdio: 'pipe' });
    fs.rmSync(dir, { recursive: true, force: true }); assert.equal(fs.existsSync(dir), false);
    console.log('CLEANUP temporary season-schema PostgreSQL cluster and HTTP socket removed');
  }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
