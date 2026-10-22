#!/usr/bin/env node
// Executes current production services against a fault-injecting transaction adapter.
// No database/network access or game records are created.
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
function service(name, pool, extras = {}) {
  const mod = { exports: {} };
  const source = fs.readFileSync(path.join(__dirname, '../services/', name + '.js'), 'utf8');
  vm.runInNewContext(source, { module: mod, exports: mod.exports, console: { log() {}, warn() {}, error() {} },
    require(id) {
      if (id === '../db') return { pool, getSetting: async () => 'false' };
      if (id === './fleetOccupancy') return { assertFleetsNotMining: async () => {} };
      if (id in extras) return extras[id];
      throw Error('Unexpected dependency: ' + id);
    }, Date, Math, Number, String, JSON, Map, Set }, { filename: name + '.js' });
  return mod.exports;
}
let passes = 0;
async function check(label, run) { await run(); passes++; console.log('PASS ' + label); }
function tournamentFixture({ failCredit = false, unfinished = false, badPrize = false } = {}) {
  let current = { status: 'running', balances: { alice: 0, bob: 0, carol: 0 }, receipts: 0 };
  let queue = Promise.resolve();
  const pool = { async connect() {
    let draft, unlock;
    return { async query(sql, args = []) {
      const q = sql.replace(/\s+/g, ' ').trim();
      if (q === 'BEGIN') return { rows: [] };
      if (q.includes('FROM tournaments WHERE id = $1 FOR UPDATE')) {
        const previous = queue; queue = new Promise(resolve => { unlock = resolve; }); await previous;
        draft = structuredClone(current);
        return { rows: [{ status: draft.status, total_rounds: 2, reward_1st_gp: badPrize ? 1000000 : 1000, reward_2nd_gp: 500, reward_3rd_gp: 250 }] };
      }
      if (q === 'COMMIT') { current = draft; unlock(); return { rows: [] }; }
      if (q === 'ROLLBACK') { if (unlock) unlock(); return { rows: [] }; }
      if (q.includes('FROM tournament_matches') && q.includes('FOR UPDATE')) return { rows: [{ p1_wallet: 'alice', p2_wallet: 'bob', winner_wallet: 'alice', status: unfinished ? 'running' : 'completed' }] };
      if (q.includes('FROM tournament_matches')) return { rows: [{ p1_wallet: 'alice', p2_wallet: 'carol', winner_wallet: 'alice' }] };
      if (q.startsWith('SELECT 1 FROM tournament_participants')) return { rows: [{}] };
      if (q.startsWith('UPDATE users')) {
        if (failCredit && args[1] === 'bob') throw Error('credit fault');
        draft.balances[args[1]] += args[0]; return { rows: [{ wallet_address: args[1] }], rowCount: 1 };
      }
      if (q.startsWith('INSERT INTO fleet_gp_activity')) { draft.receipts++; return { rows: [] }; }
      if (q.startsWith('UPDATE tournament_participants')) return { rows: [] };
      if (q.startsWith('UPDATE tournaments')) { draft.status = 'completed'; return { rows: [] }; }
      throw Error('Unexpected SQL: ' + q);
    }, release() {} };
  }, async query() { throw Error('Payout escaped transaction'); } };
  return { pool, get state() { return current; } };
}
async function siegeCase(mode, battle, challengerArea, defenderArea) {
  const queries = [];
  const client = { async query(sql, args = []) {
    queries.push(sql);
    if (sql.includes('SELECT * FROM governor_sieges')) return { rows: [{ status: 'active', sector_code: 'A', challenger_wallet: 'alice', defender_wallet: 'bob', resolution_mode: mode, fleet_battle_id: 9 }] };
    if (sql.includes('SELECT status, winner_side FROM fleet_battles')) return { rows: battle ? [battle] : [] };
    if (sql.includes('SELECT COUNT(*) AS cnt')) {
      assert.match(sql, /FROM pixels p JOIN sector_governance/);
      return { rows: [{ cnt: args[0] === 'alice' ? challengerArea : defenderArea }] };
    }
    return { rows: [] };
  }, release() {} };
  const result = await service('siege', { connect: async () => client }).resolveSiege(1);
  assert.equal(result.success, true);
  assert.ok(!queries.some(q => q.includes("resolution_mode = 'pixel_fallback'")));
  return result;
}
(async () => {
  await check('war score input cannot query or change war points', async () => {
    const pool = { connect() { throw Error('Unexpected mutation'); }, query() { throw Error('Unexpected mutation'); } };
    for (const score of [1, 999999999, -1, 'NaN']) {
      assert.equal((await service('guild', pool).submitGameScore('alice', 1, 'invaders', score)).error, 'WAR_MINIGAME_SCORING_DISABLED');
    }
  });
  await check('legacy team entry never enrolls or occupies third-party fleets', async () => {
    const pool = { connect() { throw Error('Unexpected mutation'); } };
    await assert.rejects(service('alliance', pool).createTeamBattle({ participants: [{ wallet: 'victim', fleet_id: 1 }] }), /TEAM_BATTLE_CONSENT_REQUIRED/);
  });
  await check('operator prize fields reject unbounded, fractional and negative issuance', async () => {
    const pool = { query() { throw Error('Unexpected INSERT'); } };
    const t = service('tournament', pool, { './siegeFleetBridge': {} });
    for (const reward_1st_gp of [1001, 1.5, -1, '1000']) await assert.rejects(t.createTournament({ name: 'Bad prize', reward_1st_gp }), /INVALID_PRIZE/);
  });
  await check('concurrent finalizers and replay credit each rank exactly once', async () => {
    const f = tournamentFixture(); const t = service('tournament', f.pool, { './siegeFleetBridge': {} });
    await Promise.all([t.finalizeTournament(1), t.finalizeTournament(1)]);
    await t.finalizeTournament(1);
    assert.deepEqual(f.state.balances, { alice: 1000, bob: 500, carol: 250 });
    assert.equal(f.state.receipts, 3); assert.equal(f.state.status, 'completed');
  });
  await check('failed second payout rolls back first payout and completion', async () => {
    const f = tournamentFixture({ failCredit: true });
    await assert.rejects(service('tournament', f.pool, { './siegeFleetBridge': {} }).finalizeTournament(1), /credit fault/);
    assert.deepEqual(f.state.balances, { alice: 0, bob: 0, carol: 0 }); assert.equal(f.state.receipts, 0); assert.equal(f.state.status, 'running');
  });
  await check('unfinished final and unsafe legacy prize cannot pay', async () => {
    for (const options of [{ unfinished: true }, { badPrize: true }]) {
      const f = tournamentFixture(options); const run = service('tournament', f.pool, { './siegeFleetBridge': {} }).finalizeTournament(1);
      if (options.badPrize) await assert.rejects(run, /INVALID_PRIZE/); else await run;
      assert.equal(f.state.receipts, 0); assert.equal(f.state.status, 'running');
    }
  });
  await check('cancelled and missing siege battles retain defender despite larger attacking area', async () => {
    for (const battle of [null, { status: 'cancelled', winner_side: 'atk' }]) assert.equal((await siegeCase('fleet_battle', battle, 500, 1)).winner, 'bob');
  });
  await check('legacy area comparison uses actual cells and ended fleet victory remains authoritative', async () => {
    assert.equal((await siegeCase('pixel_fallback', null, 1, 500)).winner, 'bob');
    assert.equal((await siegeCase('pixel_fallback', null, 500, 1)).winner, 'alice');
    assert.equal((await siegeCase('fleet_battle', { status: 'ended', winner_side: 'atk' }, 1, 500)).winner, 'alice');
  });
  await check('NPC arena excludes dedicated training/resource guards from readiness and density', async () => {
    let calls = 0;
    const npc = service('npcArena', { async query(sql) {
      assert.match(sql, /is_frontier_npc/); assert.match(sql, /is_objective_npc/); calls++;
      return { rows: sql.includes('AS n FROM') ? [{ n: 0 }] : [] };
    } }, { './battleScheduler': {}, './aiFleetManager': {} });
    assert.equal((await npc.listBattleReadyNpcFleets()).length, 0); assert.equal(await npc.countActiveNpcFleets(), 0); assert.equal(calls, 2);
  });
  await check('stale NPC arena selection cannot reserve a guard after lock recheck', async () => {
    let rolledBack = false;
    const pool = {
      async query(sql) {
        if (sql.includes('FROM settings')) return { rows: [{ key: 'npc_arena_enabled', value: true }] };
        if (sql.includes('pg_total_relation_size')) return { rows: [{ size_bytes: '0' }] };
        if (sql.includes('AS ships_alive')) return { rows: [
          { fleet_id: 1, owner_wallet: 'guard', ships_alive: 2 },
          { fleet_id: 2, owner_wallet: 'normal', ships_alive: 2 } ] };
        return { rows: [{ n: 0 }] };
      },
      async connect() { return { async query(sql) {
        if (sql === 'BEGIN') return { rows: [] };
        if (sql === 'ROLLBACK') { rolledBack = true; return { rows: [] }; }
        assert.match(sql, /FOR UPDATE OF f/);
        assert.match(sql, /is_frontier_npc/); assert.match(sql, /is_objective_npc/);
        return { rows: [{ id: 2, is_in_battle: false }] };
      }, release() {} }; }
    };
    const result = await service('npcArena', pool, { './battleScheduler': {}, './aiFleetManager': {} }).runArenaTick();
    assert.equal(result.skipped, 'fleet_locked'); assert.equal(rolledBack, true);
  });
  await check('war score and auto-win mounted handlers return 410 without domain writes', async () => {
    const handlers = new Map();
    const router = { get() {}, post(route, ...callbacks) { handlers.set(route, callbacks.at(-1)); } };
    const mod = { exports: {} };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../routes/guildRoutes.js'), 'utf8'), {
      module: mod, exports: mod.exports, console,
      require(id) {
        if (id === 'express') return { Router: () => router };
        if (id === '../utils/rateLimiters') return { makeRateLimiter: () => () => {} };
        if (id === '../utils/apiHelpers') return { requireAuth() {}, getAuthWallet: () => 'alice' };
        if (id === '../db') return { pool: { query() { throw Error('Unexpected write'); } }, getSetting() {} };
        throw Error('Optional dependency disabled');
      }
    });
    for (const [route, error] of [['/guild/war/score', 'WAR_MINIGAME_SCORING_DISABLED'], ['/guild/war/auto-win', 'WAR_AUTO_WIN_DISABLED']]) {
      let status, body;
      handlers.get(route)({ body: { score: 999999999, war_id: 1 } }, {
        status(n) { status = n; return this; }, json(value) { body = value; }
      });
      assert.equal(status, 410); assert.equal(body.error, error);
    }
  });
  // Admin middleware itself is exercised, not a text assertion.
  await check('authenticated non-admin tournament creation remains forbidden', async () => {
    const { requireAdmin } = require('../middleware/adminAuth');
    const previous = process.env.ADMIN_SECRET; process.env.ADMIN_SECRET = 'test-only-admin';
    try {
      let status, next = false;
      requireAdmin({ headers: {}, user: { wallet: 'alice' } }, { status(n) { status = n; return this; }, json() {} }, () => { next = true; });
      assert.equal(status, 403); assert.equal(next, false);
      requireAdmin({ headers: { 'x-admin-secret': 'test-only-admin' } }, {}, () => { next = true; }); assert.equal(next, true);
      assert.match(fs.readFileSync(path.join(__dirname, '../routes/phaseC.js'), 'utf8'), /router\.post\('\/tournaments', requireAuth, requireAdmin,/);
    } finally { if (previous === undefined) delete process.env.ADMIN_SECRET; else process.env.ADMIN_SECRET = previous; }
  });
  console.log(`PASS ${passes} combat integrity scenarios (isolated adapter; live PostgreSQL integration not claimed)`);
})().catch(err => { console.error(err); process.exitCode = 1; });
