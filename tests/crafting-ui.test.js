'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const economy = fs.readFileSync(path.join(__dirname, '../assets/economy-inventory.js'), 'utf8');
const profile = fs.readFileSync(path.join(__dirname, '../assets/account-profile.js'), 'utf8');
const daily = fs.readFileSync(path.join(__dirname, '../assets/daily-engagement.js'), 'utf8');
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
  let now = 100000, affordable = true, serverGP = 85;
  const nodes = Object.fromEntries(['baseGP','baseShopBalGP','baseShopBalPP','baseShopBalUSDT','walletGP','walletGPRow','authGPBal','walletUsdt','walletPP','authUsdtBal','authPPBal'].map(id => [id,{textContent:'',style:{}}]));
  const grid = { innerHTML: '' }, button = { disabled: false, textContent: 'CRAFT' };
  const recipe = () => ({ id: options.recipeId ?? 1, name: 'Shield', output_name: 'Shield', output_item_type_id: 1,
    ingredients: [{ code: 'iron_ore', qty: 5 }], gp_cost: 50, success_rate: 80, output_qty: 1,
    category: 'defense', fail_refund_pct: 50, canCraft: affordable });
  const context = {
    window: {}, LANG: 'en', URL, location: { origin: 'https://fixture.invalid' },
    Date: class extends Date { static now() { return now; } },
    walletState: { address: 'COMMANDER', gameGP:85, gamePP:2, gameUsdt:3 }, emailAuth:{token:'public-dummy-fixture-token'}, _dailyState:{gpBalance:85}, _baseShopItems: [{ id: 1, code: 'shield' }], _shopItems: [],
    _apiFetchGuards: {}, _apiEndpointGuards: {}, _isPublicHudFetchPath: () => false,
    getAuthHeaders: () => ({ Authorization: 'Bearer public-dummy-fixture-token' }),
    tl: en => en,
    t: key => key === 'craft_refund_partial' ? options.refundLabel ?? 'GP 부분 환급' : '',
    _itemName: code => code, _escHtml: value => String(value),
    document: { getElementById: id => id === 'craftingGrid' ? grid : nodes[id] || null,
      querySelector: () => button, querySelectorAll: () => [] },
    gameAlert: text => alerts.push(text),
    gameConfirm: async data => { confirmations.push(data); return options.confirm !== false; },
    fetch: async (url, init = {}) => {
      calls.push({ url, init });
      if (url === '/api/auth/me') {
        refreshes.push(true);
        if (options.holdBalance) await options.holdBalance;
        return {ok:true,json:async()=>({gpBalance:serverGP,ppBalance:2,usdtBalance:3})};
      }
      if (url === '/api/crafting/craft') {
        if (options.postFailure) throw Error('Fixture POST unavailable');
        const data = options.result || { success: true, outputQty: 1, outputName: 'Shield' };
        if (!data.error) { affordable = false; serverGP = 35; }
        return { json: async () => data };
      }
      if (options.holdRead) await options.holdRead;
      const status = options.readStatus || 200;
      return { status, ok: status === 200, headers: { get: () => options.retryAfter || null },
        json: async () => url.startsWith('/api/crafting/recipes') ? [recipe()] : [] };
    }
  };
  context.window._dailyState=context._dailyState;
  vm.createContext(context);
  vm.runInContext(guard + '\n' + helpers + '\n' + readHelper + '\n' + crafting, context, { filename: 'crafting-ui-source-fixture.js' });
  vm.runInContext(extract(profile,'var _authMeInFlight =','// Auto-login:')+'\n'+extract(profile,'async function refreshEmailBalances(','/* ── Referral System')+'\n'+extract(economy,'function _updateBaseShopBalances(','function filterBaseShop(')+'\n'+extract(daily,'function updateGPDisplay(){','// Legacy alias'),context);
  context._applyAuthRank=()=>{};
  context._craftingRecipes = [recipe()];
  return { context, options, calls, alerts, confirmations, refreshes, repaints, grid, button, nodes,
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

test('refund label falls back with the actual amount; real profile hook remains available', async () => {
  const f = fixture({ refundLabel: '', noBalanceRefresh: true, result: { success: false, gpRefunded: 10 } });
  f.context.attemptCraft(1); await settle();
  assert.match(f.alerts[0], /Partial GP refunded: 10 GP/);
  assert.equal(f.refreshes.length, 1); assert.equal(f.nodes.baseShopBalGP.textContent,35);
  assert.equal(f.nodes.baseGP.textContent,'35');
  const zero = fixture({ result: { success: false, gpRefunded: 0 } });
  zero.context.attemptCraft(1); await settle();
  assert.equal(zero.alerts[0], '❌ Craft failed');
});

test('unfunded recipes disable the actual card and cannot open a confirmation or submit a craft', async () => {
  for(const balance of [0,38,49.99,undefined]){
    const f=fixture();f.context.walletState.gameGP=balance;
    f.context.renderCraftingGrid();
    assert.match(f.grid.innerHTML,/<button disabled onclick="attemptCraft\(1\)"/);
    assert.match(f.grid.innerHTML,/Not enough GP/);
    f.context.attemptCraft(1);await settle();
    assert.equal(f.confirmations.length,0);assert.equal(f.posts().length,0);
  }
  const f=fixture();f.context.walletState.gameGP=50;f.context.renderCraftingGrid();
  assert.doesNotMatch(f.grid.innerHTML,/<button disabled/);
  f.context._craftingRecipes[0].canCraft=false;f.context.renderCraftingGrid();
  assert.match(f.grid.innerHTML,/<button disabled/);
  f.context.attemptCraft(1);await settle();assert.equal(f.confirmations.length,0);assert.equal(f.posts().length,0);
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

for (const confirm of [false, true]) test('actual rendered string recipe ID opens confirmation and ' + (confirm ? 'posts the original ID' : 'declining sends no POST'), async () => {
  const f = fixture({ recipeId: '1', confirm });
  f.context.renderCraftingGrid();
  const click = f.grid.innerHTML.match(/onclick="(attemptCraft\(1\))"/);
  assert.ok(click, 'execute the actual card click emitted for the PG string ID');
  vm.runInContext(click[1], f.context); await settle();
  assert.equal(f.confirmations.length, 1);
  assert.equal(f.posts().length, confirm ? 1 : 0);
  if (confirm) {
    assert.equal(f.posts()[0].init.method, 'POST');
    assert.deepEqual(JSON.parse(f.posts()[0].init.body), { wallet: 'COMMANDER', recipeId: '1' });
    assert.equal(f.refreshes.length, 1);
  } else assert.equal(f.calls.length, 0);
});

test('string recipe IDs retain missing-ingredient rejection and server GP-error handling', async () => {
  const missing = fixture({ recipeId: '1' });
  missing.context._craftingRecipes[0].canCraft = false;
  missing.context.attemptCraft(1); await settle();
  assert.equal(missing.alerts[0], 'Missing ingredients');
  assert.equal(missing.confirmations.length, 0); assert.equal(missing.posts().length, 0);
  const gp = fixture({ recipeId: '1', result: { error: 'Insufficient GP' } });
  gp.context.attemptCraft(1); await settle();
  assert.equal(gp.confirmations.length, 1); assert.equal(gp.posts().length, 1);
  assert.equal(gp.alerts[0], 'Insufficient GP'); assert.equal(gp.refreshes.length, 0);
});


test('actual profile hook forces post-craft /auth/me past cached GP and repaints real base/wallet/profile nodes', async () => {
  const f=fixture();
  await f.context.refreshEmailBalances();
  assert.equal(f.context.walletState.gameGP,85);
  assert.equal(f.refreshes.length,1);
  f.context.attemptCraft(1); await settle(); await settle();
  assert.equal(f.refreshes.length,2,'confirmed craft must force a new auth/me read within the 12s cache gap');
  assert.equal(f.context.walletState.gameGP,35);assert.equal(f.context._dailyState.gpBalance,35);
  assert.equal(f.nodes.baseShopBalGP.textContent,35);assert.equal(f.nodes.baseShopBalPP.textContent,'2.0');assert.equal(f.nodes.baseShopBalUSDT.textContent,'3.00');
  assert.equal(f.nodes.walletGP.textContent,'35');assert.equal(f.nodes.authGPBal.textContent,'35');
  assert.equal(f.context._craftingRecipes[0].canCraft,false);
  assert.equal(f.posts().length,1);assert.equal(f.posts()[0].init.method,'POST');
});

for(const change of ['wallet','token'])test('actual profile refresh and crafting continuation discard response after '+change+' changes',async()=>{
  let release;const f=fixture({holdBalance:new Promise(resolve=>{release=resolve;})});
  f.context.attemptCraft(1);await settle();assert.equal(f.refreshes.length,1);
  if(change==='wallet') f.context.walletState.address='OTHER_COMMANDER';else f.context.emailAuth.token='other-public-fixture-token';
  release();await settle();await settle();
  assert.equal(f.context.walletState.gameGP,85);assert.equal(f.nodes.baseShopBalGP.textContent,'');assert.equal(f.reads().length,0);
});

test('forced craft refresh waits for an older in-flight balance read before requesting the confirmed balance',async()=>{
  const f=fixture();const original=f.context.fetch;let release,authReads=0;
  f.context.fetch=async(url,init)=>{
    if(url==='/api/auth/me'&&++authReads===1){
      await new Promise(resolve=>{release=resolve;});
      return{ok:true,json:async()=>({gpBalance:85,ppBalance:2,usdtBalance:3})};
    }
    return original(url,init);
  };
  const older=f.context.refreshEmailBalances();
  f.context.attemptCraft(1);await settle();
  assert.equal(authReads,1);assert.equal(f.reads().length,0);
  release();await older;await settle();await settle();
  assert.equal(authReads,2,'a pre-craft in-flight read cannot satisfy the forced post-craft refresh');
  assert.equal(f.context.walletState.gameGP,35);assert.equal(f.nodes.baseShopBalGP.textContent,35);assert.equal(f.context._craftingRecipes[0].canCraft,false);
});
