#!/usr/bin/env node
'use strict';
// Dedicated empty fixture database only. No application startup, dotenv or settlement.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { Pool } = require('pg');
if (process.env.NODE_ENV !== 'test' || process.env.DATABASE_URL) throw Error('Use a cleared environment, NODE_ENV=test, and no DATABASE_URL');
const config = { host: '/tmp/mars-oc-20261021-socket', port: 55441, user: 'mars_fixture', database: 'first_play_fixture', ssl: false };
const schema = 'first_play_' + crypto.randomBytes(6).toString('hex');
const admin = new Pool({ ...config, database: 'postgres' });
const pool = new Pool({ ...config, options: '-c search_path=' + schema, max: 8 });
// Production services receive the real isolated PostgreSQL pool. Engine/SQL remain unmocked.
const dbFile = require.resolve('../db');
require.cache[dbFile] = { id: dbFile, filename: dbFile, loaded: true, exports: { pool, getSetting: async (key, fallback) => {
  const row = (await pool.query("SELECT value #>> '{}' AS v FROM settings WHERE key=$1", [key])).rows[0];
  return row?.v ?? fallback;
} } };
// Fail closed on any connection except the designated fixture Unix socket.
const net = require('node:net');
const originalConnect = net.Socket.prototype.connect;
net.Socket.prototype.connect = function (...args) {
  const options = typeof args[0] === 'object' ? args[0] : { path: args[0] };
  if (!String(options.path || '').startsWith(config.host + '/.s.PGSQL.55441')) throw Error('NON_FIXTURE_NETWORK_BLOCKED');
  return originalConnect.apply(this, args);
};

async function setup() {
  if (!(await admin.query('SELECT 1 FROM pg_database WHERE datname=$1', [config.database])).rowCount) await admin.query('CREATE DATABASE first_play_fixture');
  await pool.query('CREATE SCHEMA ' + schema);
  await pool.query(`
    CREATE TABLE factions(code text PRIMARY KEY,color_primary text);
    INSERT INTO factions VALUES('mcc','#d6a95c'),('cv','#aa5555'),('fsp','#5599aa');
    CREATE TABLE users(wallet_address text PRIMARY KEY,nickname text,faction_code text,is_ai boolean DEFAULT false,ai_difficulty text,gp_balance numeric DEFAULT 0,is_objective_npc boolean DEFAULT false);
    CREATE TABLE fleets(id bigserial PRIMARY KEY,owner_wallet text,name text,sector_id bigint,is_npc boolean DEFAULT false,formation text,movement text,auto_retreat_pct integer DEFAULT 0,is_in_battle boolean DEFAULT false,current_battle_id bigint);
    CREATE TABLE ships(id bigserial PRIMARY KEY,fleet_id bigint,ship_type_code text,owner_wallet text,current_hp integer,max_hp integer,is_flagship boolean DEFAULT false,is_alive boolean DEFAULT true,built_by_wallet text,bonus_atk integer DEFAULT 0,bonus_def integer DEFAULT 0,bonus_hp integer DEFAULT 0,bonus_speed numeric DEFAULT 0,shield_hp integer DEFAULT 0,shield_max integer DEFAULT 0);
    CREATE TABLE starter_fleet_grants(wallet_address text,grant_code text,fleet_id bigint,PRIMARY KEY(wallet_address,grant_code));
    CREATE TABLE starter_fleet_grant_ships(ship_id bigint PRIMARY KEY,wallet_address text,grant_code text);
    CREATE TABLE fleet_battles(id bigserial PRIMARY KEY,battle_type text,status text,sector_id bigint,scheduled_start_at timestamptz,battle_summary jsonb);
    CREATE TABLE fleet_battle_participants(battle_id bigint,fleet_id bigint,wallet_address text,side text,ships_at_start integer,hp_at_start integer,spawn_x numeric,spawn_y numeric);
    CREATE TABLE ship_mining_jobs(fleet_id bigint,status text);
    CREATE TABLE ship_part_cards(id bigserial PRIMARY KEY,ship_id bigint,wallet_address text);
    CREATE TABLE fleet_duel_invitations(id bigserial PRIMARY KEY,battle_id bigint,mode text);
    CREATE TABLE commander_actions(id bigserial PRIMARY KEY,battle_id bigint,wallet_address text,side text,action_type text,params jsonb,applied_at_tick integer,gp_cost numeric DEFAULT 0,created_at timestamptz DEFAULT now());
    CREATE TABLE settings(key text PRIMARY KEY,value jsonb);
    INSERT INTO settings VALUES('job_system_enabled','false');
  `);
  // Actual repository catalogue, without invoking the application migration runner.
  await pool.query(fs.readFileSync(path.join(__dirname, '../migrations/090_ship_types.sql'), 'utf8'));
}
async function fixture(openingTactic) {
  const wallet = '0x' + crypto.randomBytes(20).toString('hex');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("INSERT INTO users(wallet_address,nickname,faction_code) VALUES($1,'Isolated first play','mcc')", [wallet]);
    const operations = require('../services/starterOperations');
    const factory = require('../services/starterBattle');
    const grant = await operations.ensureStarterFleet(client, wallet);
    const battle = await factory.createFirstSortie({ client, wallet, fleetId: grant.fleetId, openingTactic });
    if (openingTactic) {
      const resumed = await factory.createFirstSortie({ client, wallet, fleetId: grant.fleetId, openingTactic: openingTactic === 'flank' ? 'breakthrough' : 'flank' });
      assert.equal(resumed.battleId, battle.battleId);
      assert.equal(resumed.reused, true);
      assert.equal((await client.query("SELECT battle_summary->>'opening_tactic' tactic FROM fleet_battles WHERE id=$1", [battle.battleId])).rows[0].tactic, openingTactic, 'resume cannot overwrite initial choice');
    }
    // Exercise existing scheduler defaults: these must not erase explicit opening intent.
    await client.query("INSERT INTO commander_actions(battle_id,wallet_address,side,action_type,params) VALUES($1,$2,'atk','formation_change','{\"formation\":\"sphere\"}'),($1,$2,'atk','maneuver_change','{\"maneuver\":\"rally\"}')", [battle.battleId, wallet]);
    await client.query('COMMIT');
    return { ...battle, wallet, fleetId: String(grant.fleetId) };
  } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
}
function assertOpening(result, fixture, formation, movement, tickMs) {
  const opening = result.timeline.frames.filter(frame => frame.t * tickMs < 10000);
  assert.ok(opening.length >= 10, 'real engine must expose opening frames');
  for (const frame of opening) {
    const fleet = frame.fleets.find(f => String(f.id) === fixture.fleetId);
    assert.equal(fleet.formation, formation);
    assert.equal(fleet.movement, movement);
  }
  return opening.at(-1).fleets.find(f => String(f.id) === fixture.fleetId);
}
async function run() {
  let ready = false;
  try {
    await setup(); ready = true;
    const factory = require('../services/starterBattle');
    assert.throws(() => factory.validateOpeningTactic('sphere'), /INVALID_OPENING_TACTIC/);
    const [direct, flank, legacy] = await Promise.all([fixture('breakthrough'), fixture('flank'), fixture(undefined)]);
    const engine = require('../services/battleEngine');
    const directResult = await engine.simulateBattle(direct.battleId);
    const flankResult = await engine.simulateBattle(flank.battleId);
    const directPos = assertOpening(directResult, direct, 'wedge', 'advance', 200);
    const flankPos = assertOpening(flankResult, flank, 'screen', 'flank', 200);
    assert.notEqual(directPos.cx, flankPos.cx, 'the actual engine moves the choices differently');
    for (const [result, battle] of [[directResult,direct],[flankResult,flank]]) {
      assert.ok(result.events.some(e => e.type === 'tactic_changed' && String(e.fleet_id) === battle.fleetId && e.tick >= 50), 'AI resumes after opening control');
      assert.equal(result.winner_side, 'atk');
    }
    const summary = (await pool.query('SELECT battle_summary FROM fleet_battles WHERE id=$1', [direct.battleId])).rows[0].battle_summary;
    assert.equal(await factory.loadOpeningTactic(pool, { id: flank.battleId, battle_summary: summary }), null, 'forged owner cannot enable control');
    await pool.query("UPDATE fleet_battles SET battle_summary=jsonb_set(battle_summary,'{trusted_source}','\"ordinary\"') WHERE id=$1", [direct.battleId]);
    const ordinary = await engine.simulateBattle(direct.battleId);
    const legacyResult = await engine.simulateBattle(legacy.battleId);
    for (const [result, battle] of [[ordinary,direct],[legacyResult,legacy]]) {
      const first = result.timeline.frames[0].fleets.find(f => String(f.id) === battle.fleetId);
      assert.equal(first.movement, 'flank', 'ordinary/legacy battles keep tick-zero AI response');
      assert.ok(result.events.some(e => e.type === 'tactic_changed' && String(e.fleet_id) === battle.fleetId && e.tick === 0));
    }
    console.log('PASS actual PostgreSQL factory and complete engine timelines: both opening paths differ; resume immutable; invalid/forged/ordinary/legacy paths isolated; AI resumes');
    // Real paced loop at 120ms proves the duration does not shrink to 6 seconds.
    const liveStarted = Date.now();
    const live = await engine.simulateBattleLive(flank.battleId, { tickMs: 120, wallClockMs: 10600 });
    assertOpening(live, flank, 'screen', 'flank', 120);
    assert.ok(live.events.some(e => e.type === 'tactic_changed' && String(e.fleet_id) === flank.fleetId && e.tick >= 84));
    console.log('PASS 120ms real live loop opening retained for 10 seconds; AI resumed; observed wall ms=' + (Date.now() - liveStarted));
    assert.equal((await pool.query('SELECT count(*)::int n FROM starter_fleet_grants')).rows[0].n, 3);
    assert.equal((await pool.query('SELECT count(*)::int n FROM starter_fleet_grant_ships')).rows[0].n, 9);
    console.log('PASS only-once grants: three fixture players, nine original hulls; no scheduler, settlement, rewards, or external requests invoked');
  } finally {
    if (ready) await pool.query('DROP SCHEMA ' + schema + ' CASCADE');
    await pool.end(); await admin.end();
    net.Socket.prototype.connect = originalConnect;
  }
}
run().catch(error => { console.error(error.stack || error); process.exitCode = 1; });
