'use strict';
// Actual engine + WS on ephemeral localhost. DB rows and identity validation are
// explicit dummy fixtures; no .env/PG/Redis/mail/chain/user accounts are loaded.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const http = require('node:http');
const WebSocket = require('../node_modules/ws');
const root = path.resolve(__dirname, '..');
const load = (file, imports) => {
  const sandbox = { module: { exports: {} }, console, process: { env: {} }, Buffer,
    setTimeout, clearTimeout, setInterval, clearInterval,
    require: name => Object.hasOwn(imports, name) ? imports[name] : (() => { throw new Error('Unexpected fixture import ' + name); })() };
  vm.runInNewContext(fs.readFileSync(path.join(root, file), 'utf8'), sandbox, { filename: file });
  return sandbox.module.exports;
};
const owners = { '11': 'dummy-alpha', '22': 'dummy-beta' };
const fixtures = Object.keys(owners).map((id, i) => ({ fleet_id: id, fleet_name: 'Dummy ' + i, owner_wallet: owners[id], side: i ? 'def' : 'atk', formation: 'sphere', movement: 'advance', faction_code: 'MCC', auto_retreat_pct: 0 }));
const db = { getSetting: async (key, fallback) => fallback, pool: { query: async (sql, params) => {
  if (sql.includes('SELECT * FROM fleet_battles')) return { rows: [{ id: '71', status: 'active', battle_type: 'siege', battle_summary: {} }] };
  if (sql.includes('is_frontier_npc')) return { rows: [] };
  if (sql.includes('SELECT fb.status')) return { rows: owners[String(params[1])] === params[2] && params[0] === '71' ? [{ status: 'active' }] : [] };
  if (sql.includes('p.spawn_x')) return { rows: fixtures };
  if (sql.includes('JOIN ship_types')) return { rows: [{ id: String(Number(params[0]) + 100), ship_type_code: 'fixture', current_hp: 1000, max_hp: 1000, shield_hp: 20, shield_max: 20, is_flagship: true, name_ko: 'Dummy', size_class: 'frigate', role: 'attack', base_atk: 10, base_def: 2, base_speed: 4, fire_interval: 4, fire_type: 'laser', shots: 1, render_radius: 3 }] };
  throw new Error('Unexpected fixture SQL ' + sql.slice(0, 100));
} } };
const objectives = { loadRegisteredObjective: async () => null, initObjective() {}, beforeTick() {}, evaluateObjective: () => null };
const engine = load('services/battleEngine.js', { '../db': db,
  './battleEnvironment': require('../services/battleEnvironment'), './tacticsAI': require('../services/tacticsAI'),
  './commanderActions': { loadForBattle: async () => null }, './job': {},
  './objectiveOperations': objectives, './fleetDuelInvitations': { getAcceptedStandardDuel: async () => null },
  './starterBattle': { loadOpeningTactic: async () => null },
  './shipParts': { loadShipPartEffects: async () => ({}), applyShipPartStats: ship => ship } });
const live = load('services/liveBattle.js', {});
const wsSvc = load('wsServer.js', { ws: { WebSocketServer: WebSocket.WebSocketServer }, url: require('node:url'), crypto: require('node:crypto'),
  './utils/totpSessionBoundary': { validateToken: async token => ({ wallet: Object.values(owners).includes(token) ? token : null, totp: false, revoked: false }) },
  './services/liveBattle': live, './db': db });
const server = http.createServer();
const wss = wsSvc.attachWsServer(server);

// Only this ephemeral loopback server is used. Production DB/auth/Redis are
// injected above, while combat and wire serialization use the real services.
const clients = [];
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(predicate, message) {
  for (let i = 0; i < 100; i++) { if (predicate()) return; await pause(10); }
  assert.fail(message);
}
async function connect(token) {
  const ws = new WebSocket('ws://127.0.0.1:' + server.address().port + '/ws/battle/71?token=' + token);
  clients.push(ws); const messages = [];
  ws.on('message', raw => messages.push(JSON.parse(raw.toString())));
  await new Promise((resolve, reject) => { ws.once('open', resolve); ws.once('error', reject); });
  return { ws, messages };
}
function validateTimeline(result) {
  const frames = result.timeline.frames;
  assert.equal(frames.at(-1).t, result.duration_ticks, 'terminal state is captured even between periodic frames');
  const hits = frames.flatMap(f => f.combat_events);
  assert.ok(hits.length > 0, 'real damage produces visual hits');
  assert.equal(new Set(hits.map(h => h.id)).size, hits.length);
  assert.equal(hits.reduce((sum, h) => sum + h.damage, 0), result.stats.atk.damage_dealt + result.stats.def.damage_dealt);
  for (const frame of frames) {
    assert.ok(frame.combat_events.length <= 128);
    assert.equal(frame.realtime, undefined, 'stored replay does not acquire live authority');
    for (const ship of frame.ships) { assert.ok(Number.isFinite(ship.shield_hp)); assert.equal(ship.shield_max, 20); }
  }
  for (const hit of hits) {
    assert.equal(hit.id, '71:combat:' + hit.seq); assert.equal(hit.type, 'shot_hit');
    assert.ok(['111', '122'].includes(hit.source_ship_id)); assert.notEqual(hit.source_ship_id, hit.target_ship_id);
    assert.ok(Number.isFinite(hit.from.x) && Number.isFinite(hit.to.y));
    assert.ok(hit.hull_damage >= 0 && hit.shield_damage >= 0);
  }
  assert.equal(JSON.parse(JSON.stringify(frames))[0].combat_events[0].id, frames[0].combat_events[0].id);
  return hits;
}
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const alpha = await connect('dummy-alpha'), beta = await connect('dummy-beta');
  await until(() => [alpha, beta].every(c => c.messages.some(m => m.type === 'hello')), 'two dummy clients attached');
  const result = await engine.simulateBattleLive('71', { tickMs: 5, wallClockMs: 83,
    onFrame: frame => wsSvc.broadcastBattleFrame('71', frame) });
  const hits = validateTimeline(result);
  await until(() => [alpha, beta].every(c => c.messages.filter(m => m.type === 'frame').length === result.timeline.frames.length), 'all real engine frames delivered');
  const alphaFrames = alpha.messages.filter(m => m.type === 'frame');
  const betaFrames = beta.messages.filter(m => m.type === 'frame');
  assert.deepEqual(alphaFrames, betaFrames, 'both clients receive identical authoritative combat IDs and damage');
  assert.deepEqual(alphaFrames.flatMap(f => f.combat_events).map(h => h.id), Array.from(hits, h => h.id));
  const replay = await engine.simulateBattle('71'); const replayHits = validateTimeline(replay);
  console.log(JSON.stringify({ result: 'passed', scope: 'actual_engine_and_loopback_ws_with_dummy_db_auth', clients: 2,
    liveFrames: result.timeline.frames.length, liveHits: hits.length, replayFrames: replay.timeline.frames.length,
    replayHits: replayHits.length, terminalTick: result.duration_ticks, terminalCaptured: true,
    sameWireHits: true, fullDamageAccounted: true, settlement: 'not_run', scale: 'two dummy clients only' }));
})().catch(error => { console.error(error.stack); process.exitCode = 1; }).finally(async () => {
  for (const ws of clients) ws.terminate();
  await new Promise(resolve => wss.close(resolve)); await new Promise(resolve => server.close(resolve));
});
