#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const express = require('express');
const jwt = require('jsonwebtoken');

const expectedDb = 'codex_occupy_review_upgrade_20261010';
if (!process.env.DATABASE_URL || new URL(process.env.DATABASE_URL).pathname.slice(1) !== expectedDb) {
  throw new Error(`Exact disposable review database required: ${expectedDb}`);
}

const { pool } = require('../db');
const ops = require('../services/starterOperations');
const frontier = require('../services/frontierIndustry');
const battleEngine = require('../services/battleEngine');
const within = (promise, ms = 15000, label = 'operation') => Promise.race([
  promise,
  new Promise((_, reject) => setTimeout(() => reject(new Error(`${label} exceeded ${ms}ms`)), ms)),
]);
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const wallet = () => `0x${crypto.randomBytes(20).toString('hex')}`;
let apiBase;
const tokenFor = w => jwt.sign({ wallet_address: w }, process.env.JWT_SECRET);
async function request(w, method, path, body) {
  const response = await fetch(`${apiBase}${path}`, {
    method,
    headers: { authorization: `Bearer ${tokenFor(w)}`, ...(body ? { 'content-type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return { status: response.status, body: await response.json() };
}
async function api(w, method, path, body) {
  const result = await request(w, method, path, body);
  assert.ok(result.status < 400, `${method} ${path}: ${result.status} ${result.body.error || ''}`);
  return result.body;
}
async function apiError(w, method, path, body, error) {
  const result = await request(w, method, path, body);
  assert.equal(result.body.error, error, `${method} ${path} must reject with ${error}`);
  return result;
}

async function makeUser(nickname) {
  const w = wallet();
  await pool.query(`INSERT INTO users(wallet_address,nickname,faction_code,gp_balance,rank_level,level,is_test_account)
    VALUES($1,$2,'mcc',1000000,1,1,true)`, [w, nickname]);
  return w;
}

async function waitEnded(id, timeoutMs = 250000) {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    const r = await pool.query('SELECT status,winner_side FROM fleet_battles WHERE id=$1', [id]);
    if (r.rows[0]?.status === 'ended') return r.rows[0];
    if (['cancelled','failed'].includes(r.rows[0]?.status)) throw new Error(`Battle ${id} ${r.rows[0].status}`);
    await sleep(200);
  }
  throw new Error(`Battle ${id} did not end within ${timeoutMs}ms`);
}

async function settleOldNodeCapture(w, fleetId, nodeId) {
  const battle = await frontier.attackNode(w, nodeId, fleetId, { dispatch: false });
  const result = await battleEngine.simulateBattle(battle.battleId);
  assert.equal(result.winner_side, 'atk', 'test fleet must win old-event fixture capture');
  await battleEngine.applyBattleResults(battle.battleId, result);
  const settled = await frontier.settleBattle(battle.battleId);
  assert.equal(settled.result, 'captured');
  return battle.battleId;
}

async function claimExactlyOnce(w, id) {
  const key = `wallet:${w}`;
  const before = Number((await pool.query(`SELECT COALESCE((SELECT quantity FROM frontier_stocks
    WHERE owner_key=$1 AND depot='repair' AND resource_code='iron_dust'),0) quantity`, [key])).rows[0].quantity);
  const first = await within(api(w, 'POST', `/api/starter-ops/${id}/claim`), 15000, `${id} claim`);
  assert.equal(first.reward.amount, 5);
  const afterFirst = Number((await pool.query(`SELECT quantity FROM frontier_stocks
    WHERE owner_key=$1 AND depot='repair' AND resource_code='iron_dust'`, [key])).rows[0].quantity);
  assert.equal(afterFirst - before, 5, `${id} first claim pays once`);
  await within(api(w, 'POST', `/api/starter-ops/${id}/claim`), 15000, `${id} duplicate claim`);
  const afterDuplicate = Number((await pool.query(`SELECT quantity FROM frontier_stocks
    WHERE owner_key=$1 AND depot='repair' AND resource_code='iron_dust'`, [key])).rows[0].quantity);
  assert.equal(afterDuplicate, afterFirst, `${id} duplicate claim must not pay twice`);
}

async function run() {
  await pool.query('ALTER TABLE frontier_repairs ADD COLUMN IF NOT EXISTS tutorial_subsidy BOOLEAN NOT NULL DEFAULT false');
  await pool.query("CREATE UNIQUE INDEX IF NOT EXISTS frontier_one_tutorial_repair ON frontier_repairs(wallet) WHERE mission_id=4 AND tutorial_subsidy=true");
  await pool.query(fs.readFileSync(path.join(__dirname, '../migrations/347_starter_fleet_recovery.sql'), 'utf8'));
  const setting = await pool.query("SELECT value FROM settings WHERE key='fleet_realtime_mode'");
  const previousMode = setting.rows[0]?.value;
  let hadMode = setting.rowCount > 0;
  await pool.query(`INSERT INTO settings(key,value,description,category) VALUES('fleet_realtime_mode','"off"'::jsonb,'regression only','test')
    ON CONFLICT(key) DO UPDATE SET value='"off"'::jsonb`);
  process.env.JWT_SECRET = `starter-ops-regression-${crypto.randomBytes(20).toString('hex')}`;
  const app = express();
  app.use(express.json());
  app.use('/api', require('../routes/starterOperations'));
  const httpServer = await new Promise(resolve => { const server = app.listen(0, '127.0.0.1', () => resolve(server)); });
  apiBase = `http://127.0.0.1:${httpServer.address().port}`;
  try {
    const primary = await makeUser('Starter ops regression');
    const second = await makeUser('Starter isolation regression');

    const parallel = await within(Promise.all(Array.from({ length: 25 }, () => api(primary, 'GET', '/api/starter-ops/state'))), 8000, '25-way getState');
    assert.equal(parallel.length, 25);
    assert.ok(parallel.every(x => x.success));
    console.log('PASS 25 parallel getState calls complete within 8 seconds');

    await apiError(primary, 'POST', '/api/starter-ops/first_sortie/start', {openingTactic:'invalid', formation:'vanguard'}, 'INVALID_OPENING_TACTIC');
    assert.equal((await pool.query('SELECT COUNT(*)::int n FROM starter_fleet_grants WHERE LOWER(wallet_address)=LOWER($1)', [primary])).rows[0].n,0,'invalid tactic must roll back before any grant');
    const starts = await within(Promise.all(Array.from({ length: 4 }, () => api(primary, 'POST', '/api/starter-ops/first_sortie/start', {openingTactic:'breakthrough'}))), 15000, 'concurrent first-sortie start');
    const pBattle = String(starts[0].battle.battleId);
    assert.ok(starts.every(x => String(x.battle.battleId) === pBattle));
    assert.equal(starts[0].starterFleet.ships.length, 3);
    const pFleet = starts[0].starterFleet.fleetId;
    const grants = await pool.query('SELECT COUNT(*)::int n FROM starter_fleet_grant_ships WHERE LOWER(wallet_address)=LOWER($1)', [primary]);
    assert.equal(grants.rows[0].n, 3, 'concurrent starts issue exactly one three-ship grant');

    const secondStart = await within(api(second, 'POST', '/api/starter-ops/first_sortie/start', {openingTactic:'flank'}), 15000, 'second-wallet first-sortie start');
    assert.notEqual(String(secondStart.battle.battleId), pBattle, 'each wallet owns its own battle');
    await assert.rejects(ops.recordEvidence(second, 'first_sortie', 'battle_won', 'fleet_battle', pBattle), /SOURCE_NOT_VERIFIED/);
    const own = await pool.query(`SELECT 1 FROM fleet_battles b JOIN fleet_battle_participants p ON p.battle_id=b.id
      WHERE b.id=$1 AND p.side='atk' AND LOWER(p.wallet_address)=LOWER($2)
        AND b.battle_summary->>'starter_wallet'=LOWER($2)`, [pBattle, primary]);
    assert.equal(own.rowCount, 1);
    console.log('PASS 4 concurrent starts create one grant/battle; another active wallet cannot claim its battle');

    const outcomes = await Promise.all([waitEnded(pBattle), waitEnded(secondStart.battle.battleId)]);
    assert.ok(outcomes.every(x => x.winner_side === 'atk'), 'both controlled first-sortie battles must be won');
    const battleTimeline = require('../services/battleTimeline');
    const starterFactory = require('../services/starterBattle');
    for (const [id,fleetId,formation,movement] of [[pBattle,pFleet,'wedge','advance'],[secondStart.battle.battleId,secondStart.starterFleet.fleetId,'screen','flank']]) {
      const {timeline} = await battleTimeline.getTimeline(id);
      const opening = timeline.frames.filter(f=>f.t<50).map(f=>f.fleets.find(x=>String(x.id)===String(fleetId)));
      assert.ok(opening.length>=10);
      assert.ok(opening.every(f=>f.formation===formation&&f.movement===movement),'actual first 10 logical seconds preserve chosen formation/movement');
      // Persisted frames prove real engine control; API/summary intent alone is insufficient.
    }
    const summary=(await pool.query('SELECT battle_summary FROM fleet_battles WHERE id=$1',[pBattle])).rows[0].battle_summary;
    assert.equal(summary.opening_tactic,'breakthrough');
    assert.equal(await starterFactory.loadOpeningTactic(pool,{id:secondStart.battle.battleId,battle_summary:summary}),null,'copying summary onto another wallet battle grants no control');
    assert.equal(await starterFactory.loadOpeningTactic(pool,{id:pBattle,battle_summary:{...summary,trusted_source:'ordinary'}}),null,'ordinary battle never receives opening control');
    assert.equal(await starterFactory.loadOpeningTactic(pool,{id:pBattle,battle_summary:{...summary,opening_tactic:undefined}}),null,'legacy first sorties preserve their default behavior');
    console.log('PASS real saved timeline preserves both openings for 10 logical seconds; forged owner/source and legacy summaries cannot enable control');
    await within(Promise.all([api(primary, 'GET', '/api/starter-ops/state'), api(second, 'GET', '/api/starter-ops/state')]), 15000, 'first-sortie reconciliation');
    await claimExactlyOnce(primary, 'first_sortie');
    await claimExactlyOnce(second, 'first_sortie');
    const pstate = await frontier.getState(primary, { training: true });
    const pLogistics = pstate.nodes.find(n => n.node_type === 'logistics');
    const pResource = pstate.nodes.find(n => n.node_type === 'resource');
    assert.ok(pLogistics && pResource);

    const oldCapture = await settleOldNodeCapture(primary, pFleet, pLogistics.id);
    await api(primary, 'POST', '/api/starter-ops/secure_node/start');
    await assert.rejects(ops.recordEvidence(primary, 'secure_node', 'node_captured', 'frontier_battle', oldCapture), /SOURCE_NOT_VERIFIED/);
    await apiError(primary, 'POST', '/api/starter-ops/secure_node/action', { action: 'attack_node', fleetId: pFleet, nodeId: pLogistics.id }, 'RESOURCE_NODE_REQUIRED');
    const mission2 = await api(primary, 'POST', '/api/starter-ops/secure_node/action', { action: 'attack_node', fleetId: pFleet, nodeId: pResource.id });
    const nodeOutcome = await waitEnded(mission2.battleId);
    assert.equal(nodeOutcome.winner_side, 'atk');
    await within(api(primary, 'GET', '/api/starter-ops/state'), 15000, 'secure-node reconciliation');
    let state = await api(primary, 'GET', '/api/starter-ops/state');
    assert.equal(state.missions.find(x => x.id === 'secure_node').status, 'completed');
    await claimExactlyOnce(primary, 'secure_node');
    console.log('PASS only fresh resource-node capture completes mission 2; stale and wrong-node captures are rejected');

    await api(primary, 'POST', '/api/starter-ops/move_yield/start');
    state = await api(primary, 'GET', '/api/starter-ops/frontier-state');
    const resource = state.nodes.find(n => n.node_type === 'resource' && n.owner_key === state.ownerKey);
    assert.ok(resource);
    if (Number(resource.stored_batches) < 1) {
      await pool.query("UPDATE frontier_nodes SET production_at=NOW()-INTERVAL '30 minutes' WHERE id=$1", [resource.id]);
      await api(primary, 'GET', '/api/starter-ops/frontier-state');
    }
    const collected = await api(primary, 'POST', '/api/starter-ops/move_yield/action', { action: 'collect_production', nodeId: resource.id });
    assert.ok(collected.event?.id);
    const cargoStart = await api(primary, 'POST', '/api/starter-ops/move_yield/action', { action: 'start_cargo', fleetId: pFleet, amount: 1, resourceCode: 'iron_dust' });
    assert.ok(cargoStart.cargo?.id);
    await pool.query('UPDATE frontier_cargo SET arrives_at=NOW()-INTERVAL \'1 second\' WHERE id=$1', [cargoStart.cargo.id]);
    await api(primary, 'POST', '/api/starter-ops/move_yield/action', { action: 'check_cargo' });
    state = await api(primary, 'GET', '/api/starter-ops/state');
    assert.equal(state.missions.find(x => x.id === 'move_yield').status, 'completed');
    await claimExactlyOnce(primary, 'move_yield');
    console.log('PASS mission 3 uses real production collection and arrived cargo evidence');

    await api(primary, 'POST', '/api/starter-ops/restore_fleet/start');
    const damaged = await pool.query(`SELECT s.id FROM starter_fleet_grant_ships g JOIN ships s ON s.id=g.ship_id
      WHERE LOWER(g.wallet_address)=LOWER($1) AND s.current_hp<s.max_hp ORDER BY s.id LIMIT 1`, [primary]);
    if (damaged.rowCount) {
      const quoteResponse = await api(primary, 'GET', `/api/starter-ops/repair-quote?shipId=${damaged.rows[0].id}&targetHpPct=100`);
      assert.equal(quoteResponse.quote.tutorial_subsidy,true);
      assert.equal(Number(quoteResponse.quote.iron_used),10);
      assert.equal(Number(quoteResponse.quote.gp_cost),0);
      const repair = await api(primary, 'POST', '/api/starter-ops/restore_fleet/action', { action: 'repair_ship', shipId: Number(damaged.rows[0].id), targetHpPct: 100, expectedQuote: quoteResponse.quote });
      assert.ok(Number(repair.repair.healed) > 0);
      assert.equal(Number(repair.repair.mission_id), 4);
      assert.equal(repair.repair.tutorial_subsidy,true);
      console.log('PASS mission 4 records actual frontier repair of a damaged granted hull');
    } else {
      const ready = await api(primary, 'POST', '/api/starter-ops/restore_fleet/action', { action: 'inspect_fleet' });
      assert.equal(ready.ready, true);
      assert.equal(ready.source, 'verified_fleet_readiness');
      console.log('PASS mission 4 completes with immutable full-fleet readiness evidence');
    }
    state = await api(primary, 'GET', '/api/starter-ops/state');
    assert.equal(state.missions.find(x => x.id === 'restore_fleet').status, 'completed');
    await claimExactlyOnce(primary, 'restore_fleet');

    await api(primary, 'POST', '/api/starter-ops/hold_front/start');
    const defense = await api(primary, 'POST', '/api/starter-ops/hold_front/action', { action: 'save_defense', fleetId: pFleet, nodeId: resource.id, riskConsent: true });
    assert.ok(defense.event?.id);
    state = await api(primary, 'GET', '/api/starter-ops/state');
    assert.equal(state.missions.find(x => x.id === 'hold_front').status, 'completed');
    await claimExactlyOnce(primary, 'hold_front');
    const finalRepairStock = Number((await pool.query("SELECT quantity FROM frontier_stocks WHERE owner_key=$1 AND depot='repair' AND resource_code='iron_dust'", [`wallet:${primary}`])).rows[0].quantity);
    assert.equal(finalRepairStock, 16, 'five claims pay 25 dust, the delivered cargo adds 1, and the tutorial repair consumes 10');
    console.log('PASS mission 5 saves real defense preset; all five claims are exactly-once (25 iron dust total)');

    const fullHpWallet = await makeUser('Starter readiness full HP regression');
    await ops.getState(fullHpWallet);
    const grantClient = await pool.connect();
    let grant;
    try {
      await grantClient.query('BEGIN');
      grant = await ops.ensureStarterFleet(grantClient, fullHpWallet);
      await grantClient.query('COMMIT');
    } catch (e) {
      await grantClient.query('ROLLBACK').catch(() => {});
      throw e;
    } finally { grantClient.release(); }
    // Build a valid stage-4 predecessor chain; these are test-only progression fixtures, not HP mutations.
    for (const [id, status] of [['first_sortie','claimed'],['secure_node','claimed'],['move_yield','claimed']]) {
      await pool.query(`INSERT INTO starter_operation_progress(wallet_address,mission_id,status,started_at,completed_at,claimed_at)
        VALUES($1,$2,$3,NOW()-INTERVAL '1 hour',NOW()-INTERVAL '30 minutes',NOW()-INTERVAL '30 minutes') ON CONFLICT DO NOTHING`, [fullHpWallet,id,status]);
    }
    await pool.query("INSERT INTO starter_operation_progress(wallet_address,mission_id,status,started_at) VALUES($1,'restore_fleet','active',NOW()) ON CONFLICT(wallet_address,mission_id) DO UPDATE SET status='active',started_at=NOW()", [fullHpWallet]);
    const hullState = await pool.query(`SELECT s.id,s.current_hp,(s.max_hp+COALESCE(s.bonus_hp,0)) effective_max_hp,s.is_alive FROM starter_fleet_grant_ships g JOIN ships s ON s.id=g.ship_id
      WHERE LOWER(g.wallet_address)=LOWER($1) ORDER BY s.id`, [fullHpWallet]);
    assert.equal(hullState.rowCount,3);
    assert.ok(hullState.rows.every(s => s.is_alive && Number(s.current_hp)===Number(s.effective_max_hp)), 'grant is naturally full HP on mission entry');
    await apiError(fullHpWallet,'POST','/api/starter-ops/restore_fleet/action',{action:'repair_ship',shipId:Number(hullState.rows[0].id)},'ALREADY_FULL');
    const ready = await api(fullHpWallet,'POST','/api/starter-ops/restore_fleet/action',{action:'inspect_fleet'});
    assert.equal(ready.completed,true);
    const proof = await pool.query("SELECT source_type,payload FROM starter_operation_events WHERE LOWER(wallet_address)=LOWER($1) AND mission_id='restore_fleet' AND objective_key='fleet_ready'",[fullHpWallet]);
    assert.equal(proof.rows[0].source_type,'starter_fleet_readiness');
    assert.equal(proof.rows[0].payload.ships.length,3);
    console.log('PASS full-HP mission 4 entry completes through a locked, server-verified readiness snapshot (no HP fabricated)');

    const recoveryWallet = await makeUser('Starter hull recovery regression');
    await api(recoveryWallet, 'GET', '/api/starter-ops/state');
    const recoveryClient = await pool.connect();
    let recoveryGrant;
    try {
      await recoveryClient.query('BEGIN');
      recoveryGrant = await ops.ensureStarterFleet(recoveryClient, recoveryWallet);
      await recoveryClient.query('COMMIT');
    } catch (e) {
      await recoveryClient.query('ROLLBACK').catch(() => {});
      throw e;
    } finally { recoveryClient.release(); }
    for (const id of ['first_sortie','secure_node','move_yield']) {
      await pool.query(`INSERT INTO starter_operation_progress(wallet_address,mission_id,status,started_at,completed_at,claimed_at)
        VALUES($1,$2,'claimed',NOW()-INTERVAL '1 hour',NOW()-INTERVAL '30 minutes',NOW()-INTERVAL '30 minutes')
        ON CONFLICT(wallet_address,mission_id) DO UPDATE SET status='claimed',started_at=EXCLUDED.started_at,completed_at=EXCLUDED.completed_at,claimed_at=EXCLUDED.claimed_at`, [recoveryWallet,id]);
    }
    const originalIds = recoveryGrant.ships.map(s => Number(s.ship_id));
    await pool.query("UPDATE ships SET current_hp=0,is_alive=false,destroyed_at=NOW(),destroyed_reason='battle' WHERE id=$1", [originalIds[0]]);
    const recovered = await api(recoveryWallet,'POST','/api/starter-ops/restore_fleet/start');
    assert.deepEqual(recovered.recovery.shipIds,[originalIds[0]]);
    assert.equal(recovered.recovery.hpPercent,15);
    const recoveredShips = await pool.query('SELECT id,current_hp,(max_hp+COALESCE(bonus_hp,0)) effective_max_hp,is_alive FROM ships WHERE id=ANY($1::bigint[]) ORDER BY id',[originalIds]);
    assert.ok(recoveredShips.rows[0].is_alive);
    assert.equal(Number(recoveredShips.rows[0].current_hp),Math.ceil(Number(recoveredShips.rows[0].effective_max_hp)*0.15));
    assert.ok(recoveredShips.rows.slice(1).every(s=>s.is_alive&&Number(s.current_hp)===Number(s.effective_max_hp)), 'living original hulls stay unchanged');
    await pool.query("UPDATE ships SET current_hp=0,is_alive=false,destroyed_at=NOW(),destroyed_reason='battle' WHERE id=$1", [originalIds[0]]);
    const secondRecovery = await api(recoveryWallet,'POST','/api/starter-ops/restore_fleet/start');
    assert.equal(secondRecovery.recovery.alreadyUsed,true);
    assert.equal((await pool.query('SELECT is_alive FROM ships WHERE id=$1',[originalIds[0]])).rows[0].is_alive,false, 'recovery cannot be used twice');
    assert.equal((await pool.query('SELECT COUNT(*)::int n FROM starter_fleet_recoveries WHERE wallet_address=$1',[recoveryWallet])).rows[0].n,1);
    console.log('PASS stage-4 recovery revives only one original ID at 15%, preserves living hulls, and cannot repeat');
  } finally {
    await new Promise(resolve => httpServer.close(resolve));
    if (hadMode) await pool.query("UPDATE settings SET value=$1::jsonb WHERE key='fleet_realtime_mode'", [JSON.stringify(previousMode)]);
    else await pool.query("DELETE FROM settings WHERE key='fleet_realtime_mode'");
  }
}

run().then(() => pool.end()).then(() => process.exit(0)).catch(async error => {
  console.error(error.stack || error);
  await pool.end().catch(() => {});
  process.exit(1);
});
