#!/usr/bin/env node
'use strict';
// Actual season finalizer/claims in a fresh private PostgreSQL Unix-socket fixture.
// Never boot the application, load .env, or connect to an existing database.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const vm = require('node:vm');
const crypto = require('node:crypto');
const net = require('node:net');
const Module = require('node:module');
const { execFileSync } = require('node:child_process');
assert.equal(process.env.NODE_ENV, 'test');
assert.equal(process.env.RUN_SCHEDULERS, 'false');
for (const key of Object.keys(process.env)) assert.ok(['PATH', 'NODE_ENV', 'RUN_SCHEDULERS', '__CF_USER_TEXT_ENCODING'].includes(key), 'UNEXPECTED_ENVIRONMENT:' + key);
const root = path.resolve(__dirname, '../..');
const sourceFile = path.join(root, 'server/services/season.js');
const pgBin = '/opt/homebrew/opt/postgresql@16/bin';
const childEnv = { PATH: '/opt/homebrew/bin:/usr/bin:/bin', LC_ALL: 'C' };
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'oc-season-'));
fs.chmodSync(dir, 0o700);
const data = path.join(dir, 'db'), socket = path.join(dir, 's'), port = 55449;
fs.mkdirSync(socket, { mode: 0o700 });
const socketPath = path.join(socket, '.s.PGSQL.' + port);
const hash = text => crypto.createHash('sha256').update(text).digest('hex');
let pool, started = false;
let checks = 0;
const pass = (name, detail) => { checks++; console.log('PASS ' + name + (detail ? ': ' + JSON.stringify(detail) : '')); };

function boundary() {
  const target = args => Array.isArray(args[0]) ? target(args[0]) : typeof args[0] === 'string' ? args[0] : args[0]?.path;
  const connect = net.Socket.prototype.connect;
  net.Socket.prototype.connect = function (...args) { assert.equal(target(args), socketPath, 'ONLY_PRIVATE_FIXTURE_SOCKET'); return connect.apply(this, args); };
  const deny = () => { throw Error('EXTERNAL_IO_FORBIDDEN'); };
  net.Server.prototype.listen = deny; require('node:tls').connect = deny;
  const dns = require('node:dns'); dns.lookup = deny; dns.resolve = deny; dns.promises.lookup = deny; dns.promises.resolve = deny; global.fetch = deny;
  const load = Module._load;
  Module._load = function (request, ...args) {
    if (['dotenv', 'ioredis', 'ethers', 'nodemailer'].includes(String(request).split('/')[0])) throw Error('FORBIDDEN_DEPENDENCY:' + request);
    return load.call(this, request, ...args);
  };
  const read = fs.readFileSync;
  fs.readFileSync = function (file, ...args) {
    assert.ok(!path.basename(String(file)).startsWith('.env') && !['.pgpass', 'credentials'].includes(path.basename(String(file))), 'NO_CREDENTIAL_READS');
    return read.call(this, file, ...args);
  };
}

function service(source) {
  const module = { exports: {} };
  const db = { pool, getSetting: async (_key, fallback) => fallback, getPPToGPRate: async () => 10 };
  vm.runInNewContext(source, { module, exports: module.exports, console: { log() {}, warn() {}, error() {} }, require(name) {
    assert.equal(name, '../db', 'ONLY_INJECTED_DATABASE'); return db;
  } }, { filename: sourceFile });
  return module.exports;
}

const schema = `
CREATE TABLE schema_migrations(filename text PRIMARY KEY);
CREATE TABLE users(wallet_address text PRIMARY KEY,gp_balance numeric NOT NULL DEFAULT 0);
CREATE TABLE seasons(id serial PRIMARY KEY,name text,active boolean,starts_at timestamptz DEFAULT now()-INTERVAL '31 days',ends_at timestamptz DEFAULT now()-INTERVAL '1 day',rewards_json jsonb DEFAULT '[{"category":"overall","rank":1,"type":"gp","amount":100}]',active_categories jsonb DEFAULT '["overall"]');
CREATE TABLE season_scores(season_id integer REFERENCES seasons, wallet text,score integer,UNIQUE(season_id,wallet));
CREATE TABLE season_rewards(id serial PRIMARY KEY,season_id integer REFERENCES seasons,wallet text,rank integer,reward_type text,reward_amount numeric,reward_meta jsonb DEFAULT '{}',claimed boolean DEFAULT false,created_at timestamptz DEFAULT now());
INSERT INTO users VALUES('dummy_winner',0);
`;

async function run() {
  try {
    execFileSync(path.join(pgBin, 'initdb'), ['-D', data, '--no-locale', '--encoding=UTF8', '--auth=trust', '--username=season_fixture'], { env: childEnv, stdio: 'pipe' });
    fs.appendFileSync(path.join(data, 'postgresql.conf'), "\nlisten_addresses=''\nport=" + port + "\nunix_socket_directories='" + socket + "'\n");
    execFileSync(path.join(pgBin, 'pg_ctl'), ['-D', data, '-l', path.join(dir, 'postgres.log'), '-w', 'start'], { env: childEnv, stdio: 'pipe' }); started = true;
    boundary();
    const { Pool } = require('pg');
    pool = new Pool({ host: socket, port, user: 'season_fixture', password: 'unused-public-fixture-password', database: 'postgres', ssl: false, max: 12, statement_timeout: 6000, query_timeout: 7000 });
    await pool.query(schema);
    const scalar = async (sql, args = []) => Number(Object.values((await pool.query(sql, args)).rows[0])[0]);
    const rights = id => scalar('SELECT COUNT(*) FROM season_rewards WHERE season_id=$1', [id]);
    const evidence = async id => (await pool.query('SELECT * FROM season_reward_finalizations WHERE season_id=$1', [id])).rows[0];
    const make = async (name, { active = true, score = 10, future = false } = {}) => {
      const id = (await pool.query("INSERT INTO seasons(name,active,ends_at) VALUES($1,$2,NOW()+$3*INTERVAL '1 day') RETURNING id", [name, active, future ? 1 : -1])).rows[0].id;
      await pool.query("INSERT INTO season_scores VALUES($1,'dummy_winner',$2)", [id, score]); return id;
    };
    // Pin the pre-fix tracked blob so committing the repair cannot change the baseline.
    const baselineSource = execFileSync('/usr/bin/git', ['show', '8f98a3a1d258869d40cec894e2c3d0aae06797ba'], { cwd: root, env: childEnv, encoding: 'utf8' });
    assert.equal(hash(baselineSource), 'b8165bcd2f4cfad579a5cbaa93c8686e912a1696cec8b5c767de52fb92990193');
    const baseline = service(baselineSource);
    const baselineId = await make('baseline_duplicate');
    await Promise.all([baseline.finalizeSeasonRewards(baselineId), baseline.finalizeSeasonRewards(baselineId)]);
    assert.equal(await rights(baselineId), 2);
    const duplicateRows = (await pool.query('SELECT id FROM season_rewards WHERE season_id=$1 ORDER BY id', [baselineId])).rows;
    for (const row of duplicateRows) assert.equal((await baseline.claimSeasonReward('dummy_winner', row.id)).success, true);
    assert.equal(await scalar("SELECT gp_balance FROM users WHERE wallet_address='dummy_winner'"), 200);
    pass('pinned pre-fix source reproduced: two concurrent finalizers create two independently claimable 100GP rewards', { rights: 2, creditedGP: 200, baselineSourceSHA256: hash(baselineSource) });
    if (process.argv.includes('--baseline-only')) return;

    const currentSource = fs.readFileSync(sourceFile, 'utf8');
    const current = service(currentSource);
    const missingId = await make('missing_migration');
    await assert.rejects(current.finalizeSeasonRewards(missingId), /season_reward_finalizations/);
    assert.equal(await current.autoRotateSeason(), null);
    assert.equal(await rights(missingId), 0);
    assert.equal((await pool.query('SELECT active FROM seasons WHERE id=$1', [missingId])).rows[0].active, true);
    pass('missing finalization migration fails closed; actual auto-rotation keeps the season active and retryable');

    const closedId = await make('legacy_empty_closed', { active: false, score: 0 });
    const queuedId = await make('future_queued', { active: false, future: true });
    const legacyId = await make('legacy_rights_active');
    await pool.query("INSERT INTO season_rewards(season_id,wallet,rank,reward_type,reward_amount) VALUES($1,'dummy_winner',1,'gp',77)", [legacyId]);
    const before = JSON.stringify((await pool.query('SELECT * FROM season_rewards ORDER BY id')).rows);
    const migration = fs.readFileSync(path.join(root, 'server/migrations/359_season_reward_finalizations.sql'), 'utf8');
    const c = await pool.connect();
    try { await c.query('BEGIN'); await c.query(migration); await c.query('COMMIT'); } catch (error) { await c.query('ROLLBACK'); throw error; } finally { c.release(); }
    assert.equal(JSON.stringify((await pool.query('SELECT * FROM season_rewards ORDER BY id')).rows), before);
    assert.equal(await scalar("SELECT gp_balance FROM users WHERE wallet_address='dummy_winner'"), 200);
    assert.equal((await evidence(baselineId)).source, 'legacy_rewards_present');
    assert.equal((await evidence(baselineId)).reward_rows, 2);
    assert.equal((await evidence(closedId)).source, 'legacy_closed');
    assert.equal((await evidence(legacyId)).source, 'legacy_rewards_present');
    assert.equal(await evidence(queuedId), undefined);
    pass('migration preserves every old right/claim/balance, marks observed legacy evidence and leaves future queue eligible');

    const finalized = await Promise.all(Array.from({ length: 8 }, () => current.finalizeSeasonRewards(missingId)));
    assert.equal(finalized.reduce((sum, result) => sum + result.rewarded, 0), 1);
    assert.equal(await rights(missingId), 1); assert.equal((await evidence(missingId)).source, 'completed');
    assert.equal((await evidence(missingId)).reward_rows, 1);
    const rewardId = (await pool.query('SELECT id FROM season_rewards WHERE season_id=$1', [missingId])).rows[0].id;
    const claims = await Promise.all([current.claimSeasonReward('dummy_winner', rewardId), current.claimSeasonReward('dummy_winner', rewardId)]);
    assert.equal(claims.filter(result => result.success).length, 1);
    assert.equal(await scalar("SELECT gp_balance FROM users WHERE wallet_address='dummy_winner'"), 300);
    pass('eight actual concurrent finalizers create one right, concurrent actual claim pays once');

    await pool.query('UPDATE seasons SET active=true WHERE id=$1', [missingId]);
    await current.finalizeSeasonRewards(missingId); assert.equal(await rights(missingId), 1);
    await current.finalizeSeasonRewards(legacyId); assert.equal(await rights(legacyId), 1);
    await pool.query('UPDATE seasons SET active=true WHERE id=$1', [closedId]);
    await current.finalizeSeasonRewards(closedId); assert.equal(await rights(closedId), 0);
    pass('admin-style reactivation cannot create new rights for completed/legacy-rights/legacy-empty seasons');

    const empty = await make('zero_eligible', { score: 0 });
    assert.equal((await current.finalizeSeasonRewards(empty)).rewarded, 0);
    assert.equal((await evidence(empty)).source, 'completed'); assert.equal((await evidence(empty)).reward_rows, 0);
    await pool.query('UPDATE seasons SET active=true WHERE id=$1', [empty]);
    await pool.query('UPDATE season_scores SET score=20 WHERE season_id=$1', [empty]);
    assert.equal((await current.finalizeSeasonRewards(empty)).rewarded, 0); assert.equal(await rights(empty), 0);
    pass('zero-eligible season persists completion and later score/activation edits cannot invent rights');

    assert.equal((await current.finalizeSeasonRewards(queuedId)).rewarded, 0); assert.equal(await evidence(queuedId), undefined);
    await pool.query('UPDATE seasons SET active=true WHERE id=$1', [queuedId]);
    assert.equal((await current.finalizeSeasonRewards(queuedId)).rewarded, 1);
    const lateClosed = await make('closed_after_migration', { active: false });
    assert.equal((await current.finalizeSeasonRewards(lateClosed)).rewarded, 0);
    assert.equal((await evidence(lateClosed)).source, 'legacy_closed');
    pass('future inactive queue stays pending; active queue can finalize; already-closed unknown history issues no rights');

    const failed = await make('rollback_fixture');
    await pool.query(`UPDATE seasons SET rewards_json='[{"category":"overall","rank":1,"type":"gp","amount":100},{"category":"overall","rank":1,"type":"gp","amount":50}]' WHERE id=$1`, [failed]);
    await pool.query(`CREATE FUNCTION reject_fixture_reward() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.season_id=${failed} AND NEW.reward_amount=50 THEN RAISE EXCEPTION 'forced_fixture_reward_failure'; END IF; RETURN NEW; END $$; CREATE TRIGGER reject_fixture_reward BEFORE INSERT ON season_rewards FOR EACH ROW EXECUTE FUNCTION reject_fixture_reward()`);
    await assert.rejects(current.finalizeSeasonRewards(failed), /forced_fixture_reward_failure/);
    assert.equal(await current.autoRotateSeason(), null);
    assert.equal(await evidence(failed), undefined); assert.equal(await rights(failed), 0);
    assert.equal((await pool.query('SELECT active FROM seasons WHERE id=$1', [failed])).rows[0].active, true);
    await pool.query('DROP TRIGGER reject_fixture_reward ON season_rewards');
    assert.equal((await current.finalizeSeasonRewards(failed)).rewarded, 1);
    assert.equal(await rights(failed), 2); assert.equal((await evidence(failed)).reward_rows, 2);
    assert.equal(await scalar('SELECT SUM(reward_amount) FROM season_rewards WHERE season_id=$1', [failed]), 150);
    pass('second reward insertion failure rolls back first right, season and marker; retry preserves both nominal awards');
    assert.equal((await current.finalizeSeasonRewards(999999)).error, 'Season not found');
    assert.equal(await scalar('SELECT COUNT(*) FROM season_reward_finalizations WHERE season_id=999999'), 0);
    pass('missing season creates no finalization history');
    console.log(JSON.stringify({ result: 'passed', checks, sourceSHA256: hash(currentSource), migrationSHA256: hash(migration), harnessSHA256: hash(fs.readFileSync(__filename, 'utf8')), database: 'fresh private PostgreSQL16 Unix socket; actual finalizer and claim SQL' }, null, 2));
  } finally {
    if (pool) await pool.end();
    if (started) execFileSync(path.join(pgBin, 'pg_ctl'), ['-D', data, '-m', 'immediate', '-w', 'stop'], { env: childEnv, stdio: 'pipe' });
    fs.rmSync(dir, { recursive: true, force: true });
    assert.equal(fs.existsSync(dir), false);
    console.log('CLEANUP temporary season PostgreSQL cluster removed');
  }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
