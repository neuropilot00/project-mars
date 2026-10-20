'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '../..');

// Reuse the existing shipped-entrypoint harness, without executing its main test.
const runner = fs.readFileSync(path.join(root, 'server/tools/command_center_regression.js'), 'utf8');
const fixtureModule = { exports: {} };
vm.runInNewContext(runner.slice(0, runner.indexOf('async function main()')) + '\nmodule.exports=harness;', {
  module: fixtureModule, require, __dirname: path.join(root, 'server/tools'), console, setImmediate, URL
});
function fixture() {
  const f = fixtureModule.exports();
  f.window.walletState = { address: 'newcomer' };
  f.active = 'move_yield';
  f.mode = 'guild_front';
  return f;
}
const context = overrides => ({ kind: 'siege', siegeId: 7, sectorCode: 'relay', battleId: 81,
  wallet: 'newcomer', ownFleetId: 41, intent: 'supply', supplyAffectsSiege: false, ...overrides });
async function open(f, tab, value = context()) { f.window.openCommandCenter(tab, value); await f.flush(); }
function board(overrides = {}) {
  return { ownerKey: 'guild:5', wallet: 'newcomer', scope: 'guild', availableScopes: ['guild', 'personal'],
    mode: 'guild_front', canWithdrawStock: false, nodes: [{ id: 11, node_type: 'resource', owner_key: 'guild:5', stored_batches: 1, production_at: new Date().toISOString() }],
    stocks: [], cargo: [], battles: [], score: {}, objective: {}, contributions: [], ...overrides };
}
function withBoard(f, value) { f.router = c => c.url.startsWith('/api/frontier/state') ? f.response(value) : null; }

test('an explicit siege preparation bypasses starter training and sends industry intent to the real frontier route', async () => {
  const f = fixture(); withBoard(f, board());
  await open(f, 'front');
  assert.ok(f.calls.some(c => c.url === '/api/frontier/state'));
  assert.equal(f.calls.some(c => c.url.includes('/starter-ops/')), false);
  assert.match(f.body.innerHTML, /data-siege-context="7"/);
  assert.match(f.body.innerHTML, /data-supply-affects-siege="false"/);
  assert.match(f.body.innerHTML, /Shared siege preparation #7 · RELAY/);
  assert.match(f.body.innerHTML, /SERVER FLEET · HP 300 \/ 400/);
  assert.match(f.body.innerHTML, /do not grant a siege combat buff/);
  await f.click('collect', 11);
  assert.equal(f.calls.find(c => c.method === 'POST').url, '/api/frontier/production/collect');
  await f.click('cargo');
  const sent = f.calls.filter(c => c.method === 'POST').at(-1);
  assert.equal(sent.url, '/api/frontier/cargo');
  assert.equal(sent.body.fleetId, '41');
  assert.equal(sent.body.resourceCode, 'iron_dust');
  assert.equal(sent.body.missionId, undefined);
});

test('siege recovery uses normal quoted repair even while the starter repair mission is active', async () => {
  const f = fixture(); f.active = 'restore_fleet'; withBoard(f, board());
  await open(f, 'fleet', context({ intent: 'repair' }));
  await f.click('siege-repair');
  await f.click('repair-quote', 101);
  assert.ok(f.calls.some(c => c.url.startsWith('/api/frontier/repair-quote')));
  assert.equal(f.calls.some(c => c.url.includes('/starter-ops/')), false);
  const sent = f.calls.find(c => c.method === 'POST');
  assert.equal(sent.url, '/api/frontier/repair');
  assert.deepEqual(sent.body.expectedQuote, f.quote);
  assert.equal(sent.body.shipId, '101');
});

test('navigation inside preparation preserves context while a normal entry keeps starter onboarding', async () => {
  const f = fixture(); withBoard(f, board());
  await open(f, 'front');
  await f.click('tab', 'fleet');
  assert.match(f.body.innerHTML, /data-siege-context="7"/);
  await f.click('siege-supply');
  assert.match(f.body.innerHTML, /data-siege-context="7"/);
  f.router = null;
  await f.open('front');
  assert.ok(f.calls.some(c => c.url === '/api/starter-ops/frontier-state'));
  assert.doesNotMatch(f.body.innerHTML, /data-siege-context/);
  await f.click('collect', 11);
  assert.equal(f.calls.filter(c => c.method === 'POST').at(-1).url, '/api/starter-ops/move_yield/action');
});

test('the current server scope and contribution are displayed without fabricating completion or siege effects', async () => {
  const f = fixture();
  withBoard(f, board({ contributions: [{ wallet: 'NEWCOMER', produced: 20, delivered: 10, repaired: 55 }, { wallet: 'other', produced: 999, delivered: 999, repaired: 999 }],
    stocks: [{ depot: 'repair', resource_code: 'iron_dust', quantity: 15 }] }));
  await open(f, 'front');
  assert.match(f.body.innerHTML, /shared guild depot/);
  assert.match(f.body.innerHTML, /20 \/ 10 \/ 55/);
  assert.doesNotMatch(f.body.innerHTML, /999 \/ 999/);
  assert.doesNotMatch(f.body.innerHTML, /data-id="repair\|iron_dust"/); // regular member has no personal withdrawal
  withBoard(f, board({ scope: 'personal', mode: 'solo_training', availableScopes: ['personal'] }));
  await f.click('refresh');
  assert.match(f.body.innerHTML, /Using your personal depot/);
  assert.doesNotMatch(f.body.innerHTML, /My contribution today/);
});

test('an unavailable fleet hint never authorizes another fleet and account changes cannot submit preparation mutations', async () => {
  const f = fixture(); withBoard(f, board());
  await open(f, 'front', context({ ownFleetId: 999 }));
  assert.match(f.body.innerHTML, /SERVER FLEET/);
  await f.click('cargo');
  assert.equal(f.calls.find(c => c.method === 'POST').body.fleetId, '41');
  f.window.walletState.address = 'other';
  const before = f.calls.length;
  await f.click('collect', 11);
  assert.equal(f.calls.length, before);
  assert.match(f.status.textContent, /session expired/);
});

test('return opens the original sector and all seven languages have inline preparation copy', async () => {
  for (const [index, lang] of ['en', 'ko', 'ja', 'zh', 'id', 'vi', 'th'].entries()) {
    const f = fixture(); f.context.LANG = lang; f.context.tl = (...strings) => strings[index] || strings[0];
    let returned;
    f.window.loadSiegeInfoPanel = code => { returned = code; };
    withBoard(f, board()); await open(f, 'front');
    assert.match(f.body.innerHTML, /data-siege-context="7"/);
    if (lang !== 'en') assert.doesNotMatch(f.body.innerHTML, /Shared siege preparation/);
    await f.click('siege-return');
    assert.equal(returned, 'relay');
    assert.equal(f.root.hidden, true);
  }
});

test('the siege CTA carries current operation context and refuses navigation after account changes', async () => {
  const source = fs.readFileSync(path.join(root, 'assets/world-live-feeds.js'), 'utf8');
  const functions = source.slice(source.indexOf('  function _siegeSideList'), source.indexOf('  // ── Betting panel loader'));
  const panel = { innerHTML: '', dataset: {}, addEventListener(_name, fn) { this.click = fn; }, querySelector() { return { value: '31' }; } };
  const actions = [];
  const sandbox = { console: { log() {}, error() {} }, window: { walletState: { address: 'newcomer' } },
    document: { getElementById: () => panel }, tl: en => en, escapeHtml: String, getAuthHeaders: () => ({}),
    wlfReadFetch: async (_key, url) => url.includes('/roster') ? { roster: { commits: [], fleet_battle_id: 81 } }
      : url === '/api/fleets' ? { fleets: [{ id: 31, ships_alive: 1 }] }
      : { participation: { side: null, canCommit: false, maxFleetsPerSide: 20, supplyAffectsSiege: false } },
    openCommandCenter: (tab, value) => actions.push({ tab, value }) };
  sandbox.walletState = sandbox.window.walletState;
  vm.createContext(sandbox); vm.runInContext(functions, sandbox);
  await sandbox._loadSiegeFleetPanel({ id: 7, status: 'active' }, 'relay', 'newcomer');
  const click = action => panel.click({ target: { closest: () => ({ getAttribute: key => key === 'data-action' ? action : null }) }, stopPropagation() {} });
  click('siegeProduction');
  assert.equal(actions[0].tab, 'front');
  assert.equal(actions[0].value.siegeId, 7);
  assert.equal(actions[0].value.ownFleetId, 31);
  assert.equal(actions[0].value.battleId, 81);
  assert.equal(actions[0].value.supplyAffectsSiege, false);
  sandbox.window.walletState.address = 'other'; click('siegeRebuild');
  assert.equal(actions.length, 1);
});
