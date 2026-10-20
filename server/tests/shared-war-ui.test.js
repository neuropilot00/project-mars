'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.resolve(__dirname, '../../assets/world-live-feeds.js'), 'utf8');
const functions = source.slice(source.indexOf('  function _siegeSideList'), source.indexOf('  // ── Betting panel loader'));
function fixture({ side = 'atk', roleUnavailable = false, confirmation = true, resolved = false } = {}) {
  const actions = [], requests = [], dialogs = [];
  const el = { innerHTML: '', dataset: {}, listener: null, addEventListener(name, cb) { this.listener = cb; }, querySelector() { return { value: '31' }; } };
  const ctx = { console: { log() {}, error() {} }, window: { walletState: { address: 'newcomer' } }, document: { getElementById: () => el },
    tl: (en, ko) => ko, escapeHtml: str => String(str).replaceAll('<', '&lt;'),
    getAuthHeaders: () => ({ Authorization: 'public-dummy-token' }),
    wlfReadFetch: async (key, url) => {
      if (url.includes('/roster')) return { roster: { commits: [], resolution_mode: 'fleet_battle', fleet_battle_id: resolved ? '81' : null } };
      if (url === '/api/fleets') return { fleets: [{ id: '31', name: 'Dummy', ships_alive: 1 }] };
      if (roleUnavailable) throw new Error('fixture unavailable');
      return { participation: { side, canCommit: !!side && !resolved, maxFleetsPerSide: 2, result: resolved ? 'def' : null } };
    },
    fetch: async (url, options) => { requests.push({ url, options }); return { ok: true, json: async () => ({ success: true, side }) }; },
    openCommandCenter: tab => actions.push(tab), openBattleViewer: id => actions.push(id),
    loadSiegeInfoPanel: code => actions.push('reload:' + code), showToast() {},
    gameConfirm: async config => { dialogs.push(config); return confirmation; }
  };
  ctx.walletState = ctx.window.walletState;
  vm.createContext(ctx); vm.runInContext(functions, ctx);
  const click = (action, attributes = {}) => {
    const button = { disabled: false, textContent: 'Join', getAttribute: key => ({ 'data-action': action, 'data-siege': '7', 'data-side': side === 'atk' ? 'attack' : 'defense', 'data-battle': '81', ...attributes })[key] };
    el.listener({ target: { closest: () => button }, stopPropagation() {} }); return button;
  };
  return { ctx, el, actions, requests, dialogs, click, render: () => ctx._loadSiegeFleetPanel({ id: '7', status: resolved ? 'resolved' : 'pending' }, 'relay', 'newcomer') };
}
const flush = () => new Promise(resolve => setImmediate(resolve));
for (const side of ['atk', 'def']) test('only membership side ' + side + ' is offered and consent precedes mutation', async () => {
  const f = fixture({ side }); await f.render();
  assert.equal((f.el.innerHTML.match(/data-action="siegeJoin"/g) || []).length, 1);
  assert.match(f.el.innerHTML, new RegExp('data-side="' + (side === 'atk' ? 'attack' : 'defense') + '"'));
  assert.equal(f.requests.length, 0);
  f.click('siegeJoin'); await flush();
  assert.equal(f.dialogs.length, 1); assert.match(f.dialogs[0].body, /영구 파괴|다른 작전에 사용할 수 없습니다/);
  assert.equal(f.requests.length, 1); assert.deepEqual(JSON.parse(f.requests[0].options.body), { fleetId: 31 });
  assert.equal('side' in JSON.parse(f.requests[0].options.body), false);
});
test('declining commitment keeps owned fleet out of the shared operation', async () => {
  const f = fixture({ confirmation: false }); await f.render(); const button = f.click('siegeJoin'); await flush();
  assert.equal(f.requests.length, 0); assert.equal(button.disabled, false);
});
test('role read failure offers Retry and never presents a newcomer as confirmed ineligible', async () => {
  const f = fixture({ roleUnavailable: true }); await f.render();
  assert.match(f.el.innerHTML, /참가 자격을 불러오지 못했습니다/); assert.doesNotMatch(f.el.innerHTML, /data-action="siegeJoin"|처음이라면/);
  f.click('siegeRetry'); assert.equal(f.actions[0], 'reload:relay');
});
test('resolved shared result has replay and loser repair/production followup', async () => {
  const f = fixture({ resolved: true }); await f.render();
  assert.match(f.el.innerHTML, /수비 측이 통치권을 지켰습니다/); assert.match(f.el.innerHTML, /공동 전투 다시보기/); assert.doesNotMatch(f.el.innerHTML, /data-action="siegeJoin"/);
  f.click('siegeRebuild'); f.click('siegeProduction'); f.click('siegeSpectate');
  assert.deepEqual(f.actions, ['fleet', 'front', 81]);
});
test('late private receipt cannot render into a different signed-in account panel', async () => {
  const f = fixture(); f.ctx.window.walletState.address = 'different'; await f.render(); assert.equal(f.el.innerHTML, '');
});
test('latest finished siege is reachable after active siege disappears', () => {
  assert.match(source, /\/api\/siege\/history\/.*\?limit=1/);
  assert.match(source, /_loadSiegeFleetPanel\(lastSiege, code, w\)/);
});
