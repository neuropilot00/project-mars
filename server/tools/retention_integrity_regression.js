#!/usr/bin/env node
'use strict';
// Run real service functions + authenticated HTTP routes with isolated DB doubles.
// Never opens the project DB, shared server, or any external provider.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const express = require('express');
const jwt = require('jsonwebtoken');
const checks = [];
const wallet = '0xretentionisolatedowner';
function load(file, mocks, random = Math.random) {
  const filename = path.resolve(__dirname, '..', file);
  const math = Object.create(Math); math.random = random;
  const box = { module: { exports: {} }, console, Date, Math: math, process: { env: { JWT_SECRET: 'retention-test-only' } }, require(name) {
    if (Object.hasOwn(mocks, name)) return mocks[name];
    if (name === 'express') return express;
    if (name === 'jsonwebtoken') return jwt;
    throw new Error('Unmocked dependency: ' + name);
  } };
  vm.runInNewContext(fs.readFileSync(filename, 'utf8'), box, { filename });
  return box.module.exports;
}
function dbDouble(query, extras = {}) {
  const client = { query, release() {} };
  return { pool: { query, connect: async () => client }, getSetting: async (_key, fallback) => fallback, ...extras };
}
async function check(name, fn) { await fn(); checks.push(name); console.log('PASS ' + name); }
async function main() {
  await check('legacy tournament cancel refunds once; cancelled payout and reopen rejected', async () => {
    let status = 'open', balance = 0, refunds = 0;
    const db = dbDouble(async (sql, params = []) => {
      if (/SELECT \* FROM tournaments/.test(sql)) return { rows: [{ id: 1, status, entry_fee_gp: 50, prize_pool_gp: 45 }] };
      if (/SELECT wallet FROM tournament_entries/.test(sql)) return { rows: [{ wallet }] };
      if (/UPDATE users SET gp_balance/.test(sql)) { balance += params[1]; refunds++; }
      if (/UPDATE tournaments SET status='cancelled'/.test(sql)) status = 'cancelled';
      if (/UPDATE tournaments SET status=\$1/.test(sql)) return { rows: [], rowCount: 0 };
      return { rows: [], rowCount: 1 };
    });
    const svc = load('services/tournaments.js', { '../db': db });
    assert.equal((await svc.adminCancelTournament(1)).refunded, 1);
    assert.equal((await svc.adminCancelTournament(1)).refunded, 0);
    await assert.rejects(svc.adminPickWinner(1, wallet), /closed/);
    await assert.rejects(svc.adminUpdateStatus(1, 'open'), /closed/);
    await assert.rejects(svc.adminUpdateStatus(1, 'cancelled'), /winner or cancel/);
    assert.equal(balance, 50); assert.equal(refunds, 1);
    status = 'completed';
    await assert.rejects(svc.adminCancelTournament(1), /closed/);
    assert.equal(balance, 50);
  });
  await check('manual tournament creation and entry retire before DB work; HTTP join returns 410', async () => {
    const db = dbDouble(async () => { throw new Error('No DB access for retired sales'); });
    db.pool.connect = async () => { throw new Error('No DB access for retired sales'); };
    const svc = load('services/tournaments.js', { '../db': db });
    for (const fn of [() => svc.joinTournament(wallet, 1), () => svc.adminCreateTournament({ name: 'new manual' })]) {
      await assert.rejects(fn(), e => e.status === 410 && e.code === 'LEGACY_MANUAL_TOURNAMENT_RETIRED');
    }
    const routes = load('routes/tournaments.js', { '../services/tournaments': svc });
    const app = express(); app.use(express.json()); app.use('/api', routes);
    const server = await new Promise(resolve => { const x = app.listen(0, '127.0.0.1', () => resolve(x)); });
    try {
      const response = await fetch('http://127.0.0.1:' + server.address().port + '/api/tournaments/join', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + jwt.sign({ wallet_address: wallet }, 'retention-test-only') }, body: JSON.stringify({ tournamentId: 1 }) });
      assert.equal(response.status, 410); assert.equal((await response.json()).error, 'LEGACY_MANUAL_TOURNAMENT_RETIRED');
    } finally { await new Promise(resolve => server.close(resolve)); }
  });
  await check('manual admin mutation cannot touch empty, registered, or mixed fleet brackets', async () => {
    for (const shape of ['deadline', 'participants', 'matches']) {
      const writes = [];
      const db = dbDouble(async (sql, params = []) => {
        if (/SELECT \* FROM tournaments/.test(sql)) return { rows: [{ id: 1, status: 'running', registration_deadline: shape === 'deadline' ? new Date() : null }] };
        if (/AS fleet_tournament/.test(sql)) return { rows: [{ fleet_tournament: shape !== 'deadline' }] };
        if (/UPDATE|INSERT/.test(sql)) writes.push({ sql, params });
        return { rows: [] };
      });
      const svc = load('services/tournaments.js', { '../db': db });
      await assert.rejects(svc.adminPickWinner(1, wallet), /BRACKET_CONTROLS/);
      await assert.rejects(svc.adminCancelTournament(1), /BRACKET_CONTROLS/);
      await assert.rejects(svc.adminUpdateStatus(1, 'running'), /BRACKET_CONTROLS/);
      assert.equal(writes.length, 0, shape);
    }
  });
  await check('existing manual entry-only winner can receive its promised prize once', async () => {
    let status = 'running', balance = 0;
    const db = dbDouble(async (sql, params = []) => {
      if (/SELECT \* FROM tournaments/.test(sql)) return { rows: [{ id: 1, name: 'Old manual', status, entry_fee_gp: 50, prize_pool_gp: 45, registration_deadline: null }] };
      if (/AS fleet_tournament/.test(sql)) return { rows: [{ fleet_tournament: false }] };
      if (/SELECT id FROM tournament_entries/.test(sql)) return { rows: [{ id: 7 }] };
      if (/UPDATE users SET gp_balance/.test(sql)) balance += params[1];
      if (/UPDATE tournaments SET status=\$1/.test(sql)) status = params[0];
      return { rows: [] };
    });
    const svc = load('services/tournaments.js', { '../db': db });
    assert.equal((await svc.adminPickWinner(1, wallet)).prize, 45);
    assert.equal(balance, 45); assert.equal(status, 'completed');
    await assert.rejects(svc.adminPickWinner(1, wallet), /closed/);
    await assert.rejects(svc.adminCancelTournament(1), /closed/);
    assert.equal(balance, 45);
  });
  await check('raffle cancel refunds once and cannot cancel a paid winner', async () => {
    let status = 'open', balance = 0;
    const db = dbDouble(async (sql, params = []) => {
      if (/SELECT \* FROM raffles/.test(sql)) return { rows: [{ id: 1, status }] };
      if (/SELECT wallet, gp_spent/.test(sql)) return { rows: [{ wallet, gp_spent: 20 }] };
      if (/UPDATE users SET gp_balance/.test(sql)) balance += params[0];
      if (/UPDATE raffles SET status='cancelled'/.test(sql)) status = 'cancelled';
      return { rows: [] };
    });
    const svc = load('services/raffle.js', { '../db': db });
    assert.equal((await svc.adminCancelRaffle(1)).refunded, 1);
    assert.equal((await svc.adminCancelRaffle(1)).refunded, 0);
    assert.equal(balance, 20);
    status = 'completed'; await assert.rejects(svc.adminCancelRaffle(1), /closed/);
    assert.equal(balance, 20);
  });
  await check('new timed invasion preview/launch rejects before connecting to DB', async () => {
    const db = dbDouble(async () => { throw new Error('DB must not be reached'); });
    db.pool.connect = async () => { throw new Error('DB must not be reached'); };
    const svc = load('services/missions.js', { '../db': db });
    for (const fn of ['launchMission', 'previewMission']) {
      const result = await svc[fn](wallet, 'invasion', 1, 0, 0, '0xtarget');
      assert.equal(result.code, 'TIMED_INVASION_RETIRED'); assert.equal(result.alternative, 'fleet_battles');
    }
  });
  await check('existing resolved mission pays exact stored rewards despite forged score, then cannot reclaim', async () => {
    let claimed = false, gp = 0, xp = 0;
    const db = dbDouble(async (sql, params = []) => {
      if (/SELECT \* FROM missions/.test(sql)) return { rows: claimed ? [] : [{ id: 1, wallet, type: 'invasion', success: true, reward_json: { gp: 10, pp: 0.25, xp: 7 } }] };
      if (/UPDATE users SET gp_balance/.test(sql)) gp += params[0];
      if (/UPDATE missions/.test(sql)) claimed = true;
      return { rows: [] };
    }, { getPPToGPRate: async () => 100, awardXP: async (_client, _wallet, amount) => { xp += amount; }, creditReferralCommission: async () => {} });
    const svc = load('services/missions.js', { '../db': db });
    const first = await svc.claimMission(wallet, 1, 9999999);
    assert.equal(first.success, true); assert.equal(gp, 35); assert.equal(xp, 7);
    assert.equal(first.mission.reward.minigameBonus, undefined);
    assert.equal((await svc.claimMission(wallet, 1, 9999999)).error, 'Mission not ready or already claimed');
    assert.equal(gp, 35); assert.equal(xp, 7);
  });
  await check('existing failed invasion settles promised refund without guild war points', async () => {
    let warPoints = 0, resolvedReward;
    const db = dbDouble(async (sql, params = []) => {
      if (/SELECT \* FROM missions/.test(sql)) return { rows: [{ id: 1, type: 'invasion', wallet, target_wallet: '0xtarget', launch_cost_pp: 2, distance_deg: 1, reward_multiplier: 1 }] };
      if (/FROM pixels/.test(sql)) return { rows: [{ cnt: 1 }] };
      if (/FROM users/.test(sql)) return { rows: [{ shield_level: 0 }] };
      if (/UPDATE missions/.test(sql)) resolvedReward = JSON.parse(params[0]);
      return { rows: [] };
    });
    const svc = load('services/missions.js', { '../db': db, './guild': { getResearchBonuses: async () => ({}), recordWarAction: async () => { warPoints++; } }, './season': { addPassXP: async () => {} } }, () => 0.99);
    await svc.resolveMission(1);
    assert.equal(resolvedReward.failed, true); assert.equal(resolvedReward.pp, 0.6); assert.equal(warPoints, 0);
  });
  await check('mission HTTP reports retired launches as 410 and never forwards claim score', async () => {
    let claimArgs;
    const service = { previewMission: async () => ({ error: 'Retired', code: 'TIMED_INVASION_RETIRED' }), launchMission: async () => ({ error: 'Retired', code: 'TIMED_INVASION_RETIRED' }), claimMission: async (...args) => { claimArgs = args; return { success: true, mission: { type: 'exploration' } }; } };
    const auth = load('utils/apiHelpers.js', {});
    const routes = load('routes/missionRoutes.js', { '../services/missions': service, '../services/season': null, '../utils/apiHelpers': auth, '../utils/rateLimiters': { makeRateLimiter: () => (_req, _res, next) => next() } });
    const app = express(); app.use(express.json()); app.use('/api', routes);
    const server = await new Promise(resolve => { const x = app.listen(0, '127.0.0.1', () => resolve(x)); });
    const base = 'http://127.0.0.1:' + server.address().port;
    const headers = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + jwt.sign({ wallet_address: wallet }, 'retention-test-only') };
    try {
      assert.equal((await fetch(base + '/api/missions/preview?type=invasion&originClaimId=1&lat=0&lng=0', { headers })).status, 410);
      assert.equal((await fetch(base + '/api/missions/launch', { method: 'POST', headers, body: JSON.stringify({ type: 'invasion', originClaimId: 1, targetLat: 0, targetLng: 0 }) })).status, 410);
      assert.equal((await fetch(base + '/api/missions/7/claim', { method: 'POST', headers, body: JSON.stringify({ minigameScore: 999999 }) })).status, 200);
      assert.equal(claimArgs.length, 2); assert.equal(claimArgs[0], wallet); assert.equal(claimArgs[1], 7);
    } finally { await new Promise(resolve => server.close(resolve)); }
  });
  await check('authenticated quest clients cannot progress/track or generate; stored completed claims survive', async () => {
    const queries = [];
    let balance = 0, claimed = false;
    const complete = { id: 9, tier: 'free', title: 'Existing completed task', reward_pp: 0.01, status: 'completed', requirement_value: 1, current_progress: 1 };
    const db = dbDouble(async (sql, params = []) => {
      queries.push(sql);
      if (/SELECT \* FROM user_quests/.test(sql)) return { rows: claimed ? [] : [complete] };
      if (/SELECT id, tier, title, description/.test(sql)) return { rows: claimed ? [] : [complete] };
      if (/SELECT id, tier, title, reward_pp/.test(sql)) return { rows: [] };
      if (/SUM\(pp_amount\)/.test(sql)) return { rows: [{ total: 0 }] };
      if (/UPDATE users SET gp_balance/.test(sql)) balance += params[0];
      if (/UPDATE user_quests SET status = 'claimed'/.test(sql)) claimed = true;
      return { rows: [] };
    }, { getPPToGPRate: async () => 100, awardXP: async () => null });
    const auth = load('utils/apiHelpers.js', {});
    const routes = load('routes/questRoutes.js', { '../db': db, '../utils/apiHelpers': auth, '../utils/rateLimiters': { makeRateLimiter: () => (_req, _res, next) => next() }, '../utils/settingsCache': { cfg: async () => ({}) } });
    const app = express(); app.use(express.json()); app.use('/api', routes);
    const server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
    const base = 'http://127.0.0.1:' + server.address().port;
    const headers = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + jwt.sign({ wallet_address: wallet }, 'retention-test-only') };
    try {
      assert.equal((await fetch(base + '/api/quests/9/progress', { method: 'POST' })).status, 401);
      for (const url of ['/api/quests/9/progress', '/api/quests/track']) {
        const response = await fetch(base + url, { method: 'POST', headers, body: JSON.stringify({ action: 'harvest', amount: 1e9 }) });
        assert.equal(response.status, 410); assert.equal((await response.json()).error, 'LEGACY_QUEST_PROGRESS_RETIRED');
      }
      assert.equal(queries.length, 0);
      const list = await (await fetch(base + '/api/quests', { headers })).json();
      assert.equal(list.legacyRetired, true); assert.equal(list.assignmentEnabled, false); assert.equal(list.quests[0].id, 9);
      assert.equal(queries.some(sql => /INSERT|UPDATE/.test(sql)), false);
      const response = await fetch(base + '/api/quests/9/claim', { method: 'POST', headers, body: '{}' });
      assert.equal(response.status, 200); assert.equal((await response.json()).rewardGP, 3); assert.equal(balance, 3);
      assert.equal((await fetch(base + '/api/quests/9/claim', { method: 'POST', headers, body: '{}' })).status, 404);
      assert.equal(balance, 3);
      assert.equal(queries.some(sql => /INSERT INTO user_quests/.test(sql)), false);
    } finally { await new Promise(resolve => server.close(resolve)); }
  });
  console.log(JSON.stringify({ passed: checks.length, databaseUsed: false, sharedServerUsed: false }));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
