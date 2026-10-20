'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const economy = fs.readFileSync(path.join(__dirname, '../assets/economy-inventory.js'), 'utf8');
const runtime = fs.readFileSync(path.join(__dirname, '../assets/core-runtime.js'), 'utf8');
function extract(source, start, end) {
  const a = source.indexOf(start), b = source.indexOf(end, a);
  assert.ok(a >= 0 && b > a, 'source markers must remain present');
  return source.slice(a, b);
}
const helpers = economy.slice(0, economy.indexOf('(function(){'));
const readHelper = extract(economy, 'function _economyReadFetch(', 'function shopConfirm(');
const crafting = extract(economy, 'var _craftingRecipes=', 'var _craftHistoryOpen=');
const guard = extract(runtime, 'function _guardedFetchEndpointKey(', 'function _clearActiveTimeout(');
const settle = () => new Promise(resolve => setImmediate(resolve));

function fixture(options = {}) {
  const calls = [], alerts = [], confirmations = [], refreshes = [], repaints = [];
  let now = 100000, affordable = true;
  const grid = { innerHTML: '' }, button = { disabled: false, textContent: 'CRAFT' };
  const recipe = () => ({ id: 1, name: 'Shield', output_name: 'Shield', output_item_type_id: 1,
    ingredients: [{ code: 'iron_ore', qty: 5 }], gp_cost: 50, success_rate: 80, output_qty: 1,
    category: 'defense', fail_refund_pct: 50, canCraft: affordable });
  const context = {
    window: {}, LANG: 'en', URL, location: { origin: 'https://fixture.invalid' },
    Date: class extends Date { static now() { return now; } },
    walletState: { address: 'COMMANDER' }, _baseShopItems: [{ id: 1, code: 'shield' }], _shopItems: [],
    _apiFetchGuards: {}, _apiEndpointGuards: {}, _isPublicHudFetchPath: () => false,
    getAuthHeaders: () => ({ Authorization: 'Bearer public-dummy-fixture-token' }),
    tl: en => en,
    t: key => key === 'craft_refund_partial' ? options.refundLabel ?? 'GP 부분 환급' : '',
    _itemName: code => code, _escHtml: value => String(value),
    document: { getElementById: id => id === 'craftingGrid' ? grid : null,
      querySelector: () => button, querySelectorAll: () => [] },
    gameAlert: text => alerts.push(text),
    gameConfirm: async data => { confirmations.push(data); return options.confirm !== false; },
    updateBalanceDisplays: () => repaints.push(true),
    fetch: async (url, init = {}) => {
      calls.push({ url, init });
      if (url === '/api/crafting/craft') {
        if (options.postFailure) throw Error('Fixture POST unavailable');
        const data = options.result || { success: true, outputQty: 1, outputName: 'Shield' };
        if (!data.error) affordable = false;
        return { json: async () => data };
      }
      if (options.holdRead) await options.holdRead;
      const status = options.readStatus || 200;
      return { status, ok: status === 200, headers: { get: () => options.retryAfter || null },
        json: async () => url.startsWith('/api/crafting/recipes') ? [recipe()] : [] };
    }
  };
  if (!options.noBalanceRefresh) context.refreshBalance = () => refreshes.push(true);
  vm.createContext(context);
  vm.runInContext(guard + '\n' + helpers + '\n' + readHelper + '\n' + crafting, context, { filename: 'crafting-ui-source-fixture.js' });
  context._craftingRecipes = [recipe()];
  return { context, options, calls, alerts, confirmations, refreshes, repaints, grid, button,
    advance(ms) { now += ms; },
    reads() { return calls.filter(x => x.url.startsWith('/api/crafting/recipes')); },
    posts() { return calls.filter(x => x.url === '/api/crafting/craft'); } };
}

test('actual craft handler immediately refetches affordability through the real guard and refreshes server balances', async () => {
  const f = fixture();
  f.context.loadCraftingView(); await settle();
  assert.equal(f.reads().length, 1);
  f.context.loadCraftingView(); await settle();
  assert.equal(f.reads().length, 1, 'normal navigation retains the existing 15-second read gap');
  f.context.attemptCraft(1); await settle();
  assert.equal(f.posts().length, 1);
  assert.equal(f.reads().length, 2, 'post-craft read skips only the minGap');
  assert.equal(f.context._craftingRecipes[0].canCraft, false);
  assert.doesNotMatch(f.grid.innerHTML, /Please wait/);
  assert.equal(f.refreshes.length, 1); assert.equal(f.repaints.length, 0);
  assert.equal(f.button.disabled, false);
  assert.equal(f.reads()[1].init.headers.Authorization, 'Bearer public-dummy-fixture-token');
});

test('failed roll displays the translated label and actual GP refund and refreshes confirmed economic outcome', async () => {
  const f = fixture({ result: { success: false, gpRefunded: 12.5 } });
  f.context.attemptCraft(1); await settle();
  assert.equal(f.alerts[0], '❌ Craft failed\nGP 부분 환급: 12.5 GP');
  assert.equal(f.reads().length, 1); assert.equal(f.refreshes.length, 1);
});

test('refund label falls back with the actual amount; legacy display fallback remains available', async () => {
  const f = fixture({ refundLabel: '', noBalanceRefresh: true, result: { success: false, gpRefunded: 10 } });
  f.context.attemptCraft(1); await settle();
  assert.match(f.alerts[0], /Partial GP refunded: 10 GP/);
  assert.equal(f.repaints.length, 1);
  const zero = fixture({ result: { success: false, gpRefunded: 0 } });
  zero.context.attemptCraft(1); await settle();
  assert.equal(zero.alerts[0], '❌ Craft failed');
});

test('cancelled craft sends no mutation or refresh', async () => {
  const f = fixture({ confirm: false });
  f.context.attemptCraft(1); await settle();
  assert.equal(f.confirmations.length, 1); assert.equal(f.calls.length, 0);
  assert.equal(f.refreshes.length, 0); assert.equal(f.repaints.length, 0);
  assert.equal(f.button.disabled, false);
});

test('server error and transport error restore the button without confirmed-outcome refresh', async () => {
  for (const options of [{ result: { error: 'Insufficient GP' } }, { postFailure: true }]) {
    const f = fixture(options);
    f.context.attemptCraft(1); await settle();
    assert.equal(f.posts().length, 1); assert.equal(f.reads().length, 0);
    assert.equal(f.refreshes.length, 0); assert.equal(f.repaints.length, 0);
    assert.equal(f.alerts.length, 1); assert.equal(f.button.disabled, false);
  }
});

test('economy read helper distinguishes explicit zero from its unchanged default gap', async () => {
  const f = fixture();
  await f.context._economyReadFetch('default', '/api/fixture', true);
  f.advance(1);
  assert.equal(await f.context._economyReadFetch('default', '/api/fixture', true), null);
  assert.equal(f.calls.length, 1);
  await f.context._economyReadFetch('default', '/api/fixture', true, 0);
  assert.equal(f.calls.length, 2);
});

test('immediate crafting refresh preserves inFlight and shared endpoint 429 backoff', async () => {
  let release;
  const f = fixture({ holdRead: new Promise(resolve => { release = resolve; }) });
  f.context.loadCraftingView();
  f.context.loadCraftingView(true); await settle();
  assert.equal(f.reads().length, 1, 'force refresh must not bypass a pending recipe request');
  release(); await settle();
  f.options.holdRead = null; f.options.readStatus = 429; f.options.retryAfter = '120';
  f.context.loadCraftingView(true); await settle();
  assert.equal(f.reads().length, 2);
  f.options.readStatus = 200;
  f.context.attemptCraft(1); await settle();
  assert.equal(f.posts().length, 1);
  assert.equal(f.reads().length, 2, 'post-craft minGap zero must still respect 429 backoff');
  f.context._craftingCatFilter = 'defense';
  f.context.loadCraftingView(true); await settle();
  assert.equal(f.reads().length, 2, 'shared endpoint guard also blocks another recipe category');
  f.advance(119999); f.context.loadCraftingView(true); await settle();
  assert.equal(f.reads().length, 2);
  f.advance(1); f.context.loadCraftingView(true); await settle();
  assert.equal(f.reads().length, 3);
  assert.equal(f.context._craftingRecipes[0].canCraft, false);
});
