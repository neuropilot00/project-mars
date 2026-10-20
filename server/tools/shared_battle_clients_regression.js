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
// The actual client frame consumer is evaluated twice with separate state.
// Rendering functions are stubbed; world coordinates/HP/commands use the source
// sync logic and actual updateFleets guard, not a replacement client model.
const clientSource = fs.readFileSync(path.resolve(root, '../assets/tactical-lab-v11.html'), 'utf8');
function clientRenderer() {
  const viewFleets = fixtures.map(f => ({ dbFleetId: f.fleet_id, userId: f.fleet_name, side: f.side, hp: 1000, maxHp: 1000, ships: [{ tid: 'fixture', type: { code: 'fixture' }, isFlagship: true, hp: 1000, maxHp: 1000, dead: false }] }));
  const viewShips = viewFleets.flatMap(f => f.ships);
  const context = { console, fleets: viewFleets, ships: viewShips, lasers: [], weaponColor: () => '#dummy-visual-color', W: 460, H: 600,
    FORMATIONS: { sphere: {}, screen: {}, wedge: {} }, MANEUVERS: { advance: {}, flank: {} }, SHIPS: { fixture: { size: 'frigate' } },
    performance: { now: () => 1000 }, renderObjectiveBanner() {}, updateCommandDeck() {}, loadPersistedActionSummary() {}, renderActionSummary() {}, addLog() {}, mkExp() {}, mkShockwave() {}, notifyParent() {}, advanceBattleClock() {}, setTimeout() {} };
  vm.createContext(context);
  vm.runInContext("const TL_MODE='battle';let _wsLastFrame=null,_wsRealtime=false,_wsMaxHpCalibrated=false,_wsEndPayload=null,_commandWallet='',atkMaxHP=1000,defMaxHP=1000,focusFleet=null,battleOver=false,_wsPrevShips=new Map(),_confirmedActions=new Map();", context);
  for (const [start, end] of [['function objectiveMapPoint(', 'function renderObjectiveBanner('], ['function syncServerShips(', 'function fleetRoleText('], ['function updateFleets(', 'function fire('], ['function processBattleMessage(', 'function closeBattleWs(']]) {
    vm.runInContext(clientSource.slice(clientSource.indexOf(start), clientSource.indexOf(end)), context);
  }
  return { context, fleets: viewFleets, receive: message => {
    if (!['hello', 'frame', 'end'].includes(message.type)) return;
    context.processBattleMessage(message, '71');
    if (message.type === 'frame') {
      const before = JSON.stringify(viewFleets.map(f => ({ cx: f.cx, cy: f.cy, ships: f.ships.map(s => ({ x: s.x, y: s.y, hp: s.hp, shield: s.shield })) })));
      for (let i = 0; i < 20; i++) context.updateFleets(16);
      assert.equal(JSON.stringify(viewFleets.map(f => ({ cx: f.cx, cy: f.cy, ships: f.ships.map(s => ({ x: s.x, y: s.y, hp: s.hp, shield: s.shield })) }))), before, 'Battle client cannot drift between authoritative frames');
    }
  } };
}
const clients = [];
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(predicate, message) {
  for (let i = 0; i < 150; i++) { if (predicate()) return; await pause(10); }
  assert.fail(message);
}
async function connect(token) {
  const ws = new WebSocket('ws://127.0.0.1:' + server.address().port + '/ws/battle/71?token=' + token);
  const messages = [], renderer = clientRenderer(); clients.push(ws);
  ws.on('message', raw => { const message = JSON.parse(raw.toString()); messages.push(message); renderer.receive(message); });
  await new Promise((resolve, reject) => { ws.once('open', resolve); ws.once('error', reject); });
  return { ws, messages, renderer };
}
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const alpha = await connect('dummy-alpha'), beta = await connect('dummy-beta');
  live.markActive('71');
  const battle = engine.simulateBattleLive('71', { tickMs: 5, wallClockMs: 650,
    drainCommands: () => live.drainCommands('71'),
    onFrame: frame => wsSvc.broadcastBattleFrame('71', frame),
    onCommandResult: result => wsSvc.broadcastBattleCommandResult('71', result) });
  await until(() => alpha.messages.some(m => m.type === 'frame') && beta.messages.some(m => m.type === 'frame'), 'Both clients need engine frames');
  alpha.ws.send(JSON.stringify({ type: 'cmd', commandId: 'alpha-formation', cmd: 'formation', payload: { fleetId: '11', formation: 'screen' } }));
  beta.ws.send(JSON.stringify({ type: 'cmd', commandId: 'beta-maneuver', cmd: 'maneuver', payload: { fleetId: '22', maneuver: 'flank' } }));
  await until(() => alpha.messages.some(m => m.type === 'cmd_result' && m.commandId === 'alpha-formation' && m.status === 'applied') && beta.messages.some(m => m.type === 'cmd_result' && m.commandId === 'beta-maneuver' && m.status === 'applied'), 'Each owner command must actually apply');
  // Third command is an ownership attack, not an authorized control action.
  alpha.ws.send(JSON.stringify({ type: 'cmd', commandId: 'alpha-forged', cmd: 'formation', payload: { fleetId: '22', formation: 'wedge' } }));
  await until(() => alpha.messages.some(m => m.type === 'cmd_err' && m.commandId === 'alpha-forged' && m.reason === 'not_your_fleet'), 'Other-owner control must reject');
  await until(() => [alpha, beta].every(c => c.messages.some(m => m.type === 'frame' && m.fleets.find(f => f.id === '11')?.formation === 'screen' && m.fleets.find(f => f.id === '22')?.movement === 'flank')), 'Both clients must observe both commands in common state');
  const aFrames = alpha.messages.filter(m => m.type === 'frame');
  assert.ok(aFrames.some(m => m.fleets.some(f => f.cx !== aFrames[0].fleets.find(first => first.id === f.id).cx)), 'Authoritative fleet positions move');
  const lastTick = beta.messages.filter(m => m.type === 'frame').at(-1).t;
  beta.ws.close(); await pause(20);
  const rejoined = await connect('dummy-beta');
  await until(() => rejoined.messages.some(m => m.type === 'frame' && m.t > lastTick), 'Reconnect must receive later authority frames');
  const result = await battle;
  live.clearActive('71');
  wsSvc.broadcastBattleEnd('71', { winner_side: result.winner_side, duration_seconds: result.duration_seconds });
  await until(() => alpha.messages.some(m => m.type === 'end') && rejoined.messages.some(m => m.type === 'end'), 'Active clients need common result');
  assert.deepEqual(alpha.messages.find(m => m.type === 'end'), rejoined.messages.find(m => m.type === 'end'));
  const common = alpha.messages.filter(m => m.type === 'frame').find(m => rejoined.messages.some(n => n.type === 'frame' && n.t === m.t));
  assert.ok(common); assert.deepEqual(common, rejoined.messages.find(m => m.type === 'frame' && m.t === common.t));
  assert.deepEqual(alpha.renderer.fleets.map(f => ({ cx: f.cx, cy: f.cy, hp: f.hp, ships: f.ships.map(s => ({ id: s.dbShipId, x: s.x, y: s.y, hp: s.hp, dead: s.dead })) })), rejoined.renderer.fleets.map(f => ({ cx: f.cx, cy: f.cy, hp: f.hp, ships: f.ships.map(s => ({ id: s.dbShipId, x: s.x, y: s.y, hp: s.hp, dead: s.dead })) })));
  for (const f of alpha.renderer.fleets) for (const ship of f.ships) {
    assert.ok(ship.x >= 0 && ship.x <= 460 && ship.y >= 0 && ship.y <= 600, 'Authoritative ship fits mapped canvas world');
  }
  assert.equal(vm.runInContext('battleOver', alpha.renderer.context), true);
  const combatHits = result.timeline.frames.flatMap(f => f.combat_events);
  assert.ok(combatHits.length > 0, 'real engine hits reach the actual source consumer');
  assert.ok(alpha.renderer.context.lasers.length > 0, 'actual source consumer creates visible authoritative hit effects');
  assert.ok(alpha.renderer.context.lasers.every(effect => effect.visual === true && effect.dmg === 0 && effect.applied === true), 'effects cannot apply local damage');
  const lastFrame = alpha.messages.filter(m => m.type === 'frame').at(-1);
  const beforeEffects = alpha.renderer.context.lasers.length;
  alpha.renderer.context.syncServerCombatEvents(lastFrame);
  assert.equal(alpha.renderer.context.lasers.length, beforeEffects, 'same stable event IDs cannot create duplicate effects');
  const liveShips = new Map(lastFrame.ships.map(ship => [String(ship.id), ship]));
  for (const fleet of alpha.renderer.fleets) for (const ship of fleet.ships) {
    const authoritative = liveShips.get(String(ship.dbShipId));
    if (authoritative) { assert.equal(ship.shield, authoritative.shield_hp); assert.equal(ship.shieldMax, authoritative.shield_max); }
  }


  assert.equal(beta.messages.filter(m => m.type === 'cmd_result').some(m => m.commandId === 'alpha-formation'), false, 'Private acknowledgments do not leak to opponent');
  assert.ok(result.events.some(e => e.type === 'command_result' && e.payload.command_id === 'alpha-formation' && e.payload.status === 'applied'));
  console.log(JSON.stringify({ result: 'passed', scope: 'actual_engine_and_localhost_ws_fixture_db_and_auth', clients: 2, reconnects: 1, sharedTick: common.t, authoritativeFrames: result.timeline.frames.length,
    appliedCommands: result.events.filter(e => e.type === 'command_result').map(e => e.payload), sharedResult: result.winner_side,
    resultCause: result.events.find(e => e.type === 'battle_timeout')?.payload.reason || 'combat', clientWorldCoordinates: 'matched_after_actual_source_frame_consumer', clientDrift: 'blocked_between_frames', actualCombatHits: combatHits.length, actualConsumerEffects: alpha.renderer.context.lasers.length, effectDamage: 0, authoritativeShields: true, settlement: 'not_run', scaleClaim: 'two dummy clients only' }));
})().catch(error => { console.error(error.stack); process.exitCode = 1; }).finally(async () => {
  live.clearActive('71'); for (const ws of clients) ws.terminate();
  await new Promise(resolve => wss.close(resolve)); await new Promise(resolve => server.close(resolve));
});
