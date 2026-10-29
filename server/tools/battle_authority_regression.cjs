'use strict';
// Run only against a disposable local PostgreSQL database.
const assert = require('node:assert/strict');
const { Pool } = require('pg');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const { acquireLiveAuthority, cleanupExpiredBattles } = require('../services/battleAuthority');
const dbName = process.env.BATTLE_AUTHORITY_TEST_DB || '';
if (!/^codex_battle_authority_[a-z0-9]+$/.test(dbName)) throw new Error('disposable test database required');
const pool = new Pool({ host: '/tmp', database: dbName, max: 8 });
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
(async () => {
  await pool.query(`CREATE TABLE fleet_battles (id bigint PRIMARY KEY, status text NOT NULL, battle_started_at timestamptz, ended_at timestamptz, battle_summary jsonb DEFAULT '{}'::jsonb,
    battle_type text DEFAULT 'pvp_duel', governor_siege_id bigint)`);
  await pool.query(fs.readFileSync(path.join(__dirname, '../migrations/364_live_battle_authority.sql'), 'utf8'));
  await pool.query('CREATE TABLE fleets (id bigint PRIMARY KEY, current_battle_id bigint, is_in_battle boolean)');
  await pool.query("INSERT INTO fleet_battles(id,status,battle_started_at) SELECT n,'active', NOW() FROM generate_series(1,8) n");
  await pool.query('INSERT INTO fleets SELECT n,n,true FROM generate_series(1,8) n');
  const first = await acquireLiveAuthority(pool, 1, 1);
  let secondGranted = false;
  const secondPending = acquireLiveAuthority(pool, 2, 1).then(v => { secondGranted = true; return v; });
  await wait(250);
  assert.equal(secondGranted, false, 'another worker must wait for the global slot');
  const old = await pool.query("SELECT status FROM fleet_battles WHERE id=1");
  await cleanupExpiredBattles(pool);
  assert.equal((await pool.query('SELECT status FROM fleet_battles WHERE id=1')).rows[0].status, old.rows[0].status);
  await pool.query("UPDATE fleet_battles SET status='ended' WHERE id=1");
  first.stop();
  const second = await secondPending;
  assert.equal(secondGranted, true);
  const current = await pool.query('SELECT live_lease_token,live_slot_acquired FROM fleet_battles WHERE id=2');
  assert.equal(current.rows[0].live_lease_token, second.token);
  assert.equal(current.rows[0].live_slot_acquired, true);
  // A crashed worker leaves its token behind, but expiry releases only its own fleet.
  await pool.query("UPDATE fleet_battles SET live_lease_expires_at=NOW()-INTERVAL '1 second' WHERE id=2");
  const cleaned = await cleanupExpiredBattles(pool);
  assert.deepEqual(cleaned.rows.map(x => String(x.id)), ['2']);
  assert.equal((await pool.query('SELECT is_in_battle FROM fleets WHERE id=2')).rows[0].is_in_battle, false);
  assert.equal((await pool.query('SELECT is_in_battle FROM fleets WHERE id=3')).rows[0].is_in_battle, true);
  second.stop();
  // A rolling deploy must not cancel legacy workers before the grace; old orphans do recover.
  await pool.query("UPDATE fleet_battles SET battle_started_at=NOW()-INTERVAL '31 minutes' WHERE id=3");
  await pool.query("UPDATE fleet_battles SET battle_started_at=NOW()-INTERVAL '4 hours' WHERE id=4");
  await cleanupExpiredBattles(pool);
  assert.equal((await pool.query('SELECT status FROM fleet_battles WHERE id=3')).rows[0].status, 'active');
  assert.equal((await pool.query('SELECT status FROM fleet_battles WHERE id=4')).rows[0].status, 'cancelled');
  // Concurrent acquisition across separate clients cannot exceed the global limit.
  const [x, y] = await Promise.all([acquireLiveAuthority(pool, 5, 2), acquireLiveAuthority(pool, 6, 2)]);
  const slots = await pool.query("SELECT count(*)::int n FROM fleet_battles WHERE status='active' AND live_slot_acquired AND live_lease_expires_at>NOW()");
  assert.equal(slots.rows[0].n, 2);
  x.stop(); y.stop();
  // The advisory lock may be held beyond lease expiry; transaction start time must not renew it.
  const blocker = await pool.connect();
  await blocker.query('BEGIN');
  await blocker.query('SELECT pg_advisory_xact_lock($1)', [177656071]);
  const blocked = acquireLiveAuthority(pool, 7, 3);
  await wait(150);
  await pool.query("UPDATE fleet_battles SET live_lease_expires_at=clock_timestamp()-INTERVAL '1 second' WHERE id=7");
  await blocker.query('COMMIT'); blocker.release();
  await assert.rejects(blocked, /BATTLE_AUTHORITY_LOST/);
  // Queue rank limits new waiters; rejected requests do not retain an active lease.
  await pool.query("INSERT INTO fleet_battles(id,status,battle_started_at,live_lease_token,live_lease_expires_at) SELECT n,'active',NOW()-INTERVAL '1 minute',gen_random_uuid(),NOW()+INTERVAL '1 minute' FROM generate_series(10,14) n");
  await assert.rejects(acquireLiveAuthority(pool, 8, 1), /BATTLE_QUEUE_FULL/);
  assert.equal((await pool.query('SELECT live_lease_token FROM fleet_battles WHERE id=8')).rows[0].live_lease_token, null);
  // Real settlement entry must fail closed after cancellation, expiry or a different token.
  const sandbox = { module: { exports: {} }, console, Buffer, setTimeout, clearTimeout, setInterval, clearInterval,
    require(name) { if (name === '../db') return { pool, getSetting: async (_key, fallback) => fallback }; return {}; } };
  const source = fs.readFileSync(path.join(__dirname, '../services/battleEngine.js'), 'utf8');
  vm.runInNewContext(source + "\nassertRegisteredFrontierBattle=async()=>{throw Error('VALID_LEASE_REACHED')};", sandbox);
  const settle = sandbox.module.exports.applyBattleResults;
  assert.equal((await settle(2, {}, second.token)).skipped, true);
  assert.equal((await settle(1, {}, first.token)).skipped, true);
  assert.equal((await settle(5, {}, y.token)).skipped, true);
  await pool.query("UPDATE fleet_battles SET live_lease_expires_at=NOW()-INTERVAL '1 second' WHERE id=5");
  assert.equal((await settle(5, {}, x.token)).skipped, true);
  await pool.query("UPDATE fleet_battles SET live_lease_expires_at=NOW()+INTERVAL '1 minute' WHERE id=5");
  await assert.rejects(settle(5, {}, x.token), /VALID_LEASE_REACHED/);
  console.log('battle authority PG regression passed: global cap, wait, active protection, expiry, legacy grace and concurrent acquisition');
})().finally(() => pool.end()).catch(error => { console.error(error); process.exitCode = 1; });
