const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Load browser source as text: no application modules, browser, network or DB.
const source = fs.readFileSync(path.join(__dirname, '../assets/market-transport.js'), 'utf8');

function quote(overrides = {}) {
  return {
    price: 6, currency: 'GP', listingFeeGp: 5,
    saleFee: 0.3, saleFeePct: 5,
    listingDiscountsVerified: true, saleDiscountsVerified: true,
    receivesMin: 5.58, receivesMax: 5.7,
    tariffStatus: 'range', tariffMax: 0.12, sectorId: 2,
    netAfterListingFeeMin: 0.58, netAfterListingFeeMax: 0.7,
    quotedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 60000).toISOString(),
    npcCompetition: { available: true, listingCount: 2, minUnitPrice: 0.6 },
    ...overrides,
  };
}

function browserFixture(options = {}) {
  const requests = [];
  const confirmations = [];
  const toasts = [];
  const context = {
    window: {}, LANG: 'en',
    walletState: { address: '0xseller', gpBalance: 100, ppBalance: 100 },
    _resourceInventory: [{ code: 'iron_ore', name: 'Iron', quantity: 10, base_pp_value: 1 }],
    tl: (en) => en, t: () => '',
    _enhGlowClass: () => '', _enhBadge: () => '',
    getAuthHeaders: () => ({ Authorization: 'Bearer fixture-token' }),
    escapeHTML: (value) => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])),
    srvErr: (value) => value,
    showToast: (...args) => toasts.push(args),
    document: { getElementById: () => null },
    _setActiveTimeout: () => 0, // Do not run the unrelated enhancement startup timer.
    setTimeout, clearTimeout,
    fetch: async (url, init = {}) => {
      requests.push({ url, init, body: init.body ? JSON.parse(init.body) : null });
      if (url === '/api/marketplace/listing-quote') {
        if (options.quoteFailure) throw new Error('Fixture quote unavailable');
        const data = options.quoteData || quote();
        return { ok: !data.error, json: async () => data };
      }
      if (url === '/api/marketplace/list') {
        const data = options.createData || { success: true, listing: { id: 1 } };
        return { ok: !data.error, json: async () => data };
      }
      throw new Error(`Unexpected network attempt: ${url}`);
    },
    gameConfirm: async opts => {
      confirmations.push(opts);
      return options.confirm !== undefined ? options.confirm : true;
    },
  };
  // Preserve the current economy art/escaping contract; these tests cover quote UX.
  context._ecoNum = value => Number(value) || 0;
  context._ecoEsc = context.escapeHTML;
  context._ecoInline = context.escapeHTML;
  context._ecoArt = () => '<span data-fixture-art></span>';
  context._ecoCardArt = context._ecoArt;
  context.window.walletState = context.walletState;
  vm.createContext(context);
  vm.runInContext(source, context, { filename: 'market-transport.js' });
  return { context, requests, confirmations, toasts };
}

const listing = () => ({ type: 'resource', resourceCode: 'iron_ore', resourceQuantity: 10, price: 6, currency: 'GP' });
const visibleText = opts => JSON.stringify({ body: opts.body, info: opts.info });

test('seller reviews a live quote before creation; price stays the bundle total', async () => {
  const f = browserFixture();
  let onListed;
  await f.context.confirmMarketListing(listing(), result => { onListed = result; });
  assert.deepEqual(f.requests.map(r => r.url), ['/api/marketplace/listing-quote', '/api/marketplace/list']);
  assert.equal(f.confirmations.length, 1);
  assert.equal(f.confirmations[0].info[0].v, 'Iron ×10');
  assert.equal(f.requests[0].body.price, 6);
  assert.equal(f.requests[1].body.price, 6, 'quantity must not multiply an existing bundle price');
  assert.equal(f.requests[1].body.resourceQuantity, 10);
  assert.equal(f.requests[1].body.expectedListingFeeGp, 5);
  assert.ok(f.requests[1].body.listingQuoteExpiresAt);
  assert.equal(f.requests[0].init.headers.Authorization, 'Bearer fixture-token');
  assert.equal(f.requests[1].init.headers.Authorization, 'Bearer fixture-token');
  assert.ok(onListed, 'existing success flow should run after the listing succeeds');
});

test('nonpositive GP resource proceeds require an edit before any registration', async () => {
  const f = browserFixture({ quoteData: quote({
    price: 4, saleFee: 0.2, receivesMin: 3.72, receivesMax: 3.8,
    netAfterListingFeeMin: -1.28, netAfterListingFeeMax: -1.2,
  }) });
  await f.context.confirmMarketListing({ ...listing(), price: 4 }, () => {});
  const text = visibleText(f.confirmations[0]);
  assert.match(text, /-[\d.]+/);
  assert.match(text, /cannot leave positive GP/i);
  assert.equal(f.confirmations[0].validate(), false);
  assert.notEqual(f.confirmations[0].disabled, true);
  assert.equal(f.requests.filter(r => r.url === '/api/marketplace/list').length, 0);
});

test('PP proceeds and GP listing costs are displayed separately', async () => {
  const f = browserFixture({ quoteData: quote({
    currency: 'PP', netAfterListingFeeMin: null, netAfterListingFeeMax: null,
    npcCompetition: null,
  }) });
  await f.context.confirmMarketListing({ ...listing(), currency: 'PP' }, () => {});
  const text = visibleText(f.confirmations[0]);
  assert.match(text, /5 GP/);
  assert.match(text, /5\.(?:58|7) PP/);
  assert.doesNotMatch(text, /0\.(?:58|7) PP/, 'GP costs must never be subtracted from PP proceeds');
  assert.match(text, /separate|different currenc|not combined|not converted/i);
});

test('quote explains current NPC supply and uncertain buyer tariffs', async () => {
  const f = browserFixture();
  await f.context.confirmMarketListing(listing(), () => {});
  const text = visibleText(f.confirmations[0]);
  assert.match(text, /NPC/);
  assert.match(text, /0\.6/);
  assert.match(text, /tariff|buyer/i);
  assert.match(text, /not refunded.*expires.*cancel/i);
});

test('unavailable discount and tariff data are described as estimates', async () => {
  const f = browserFixture({ quoteData: quote({
    listingDiscountsVerified: false, saleDiscountsVerified: false,
    tariffStatus: 'unknown', tariffMax: null, receivesMin: null,
    netAfterListingFeeMin: null, npcCompetition: { available: false },
  }) });
  await f.context.confirmMarketListing(listing(), () => {});
  const text = visibleText(f.confirmations[0]);
  assert.match(text, /discounts could not be verified/i);
  assert.match(text, /tariff could not be verified/i);
  assert.match(text, /estimates/i);
  assert.match(text, /NPC supply could not be checked/i);
  assert.match(text, /Estimate before unverified adjustments/);
});

test('cancelled cost review never submits a listing', async () => {
  const f = browserFixture({ confirm: false });
  let completed = false;
  await f.context.confirmMarketListing(listing(), () => { completed = true; });
  assert.equal(f.requests.length, 1);
  assert.equal(completed, false);
});

test('failed quote never falls back to guessed fees or submits a listing', async () => {
  const f = browserFixture({ quoteFailure: true });
  let completed = false;
  await f.context.confirmMarketListing(listing(), () => { completed = true; });
  assert.equal(f.requests.length, 1);
  assert.equal(f.confirmations.length, 0);
  assert.equal(completed, false);
  assert.ok(f.toasts.length);
});

test('expired quote cannot create a listing', async () => {
  const f = browserFixture({ quoteData: quote({ expiresAt: new Date(Date.now() - 1000).toISOString() }) });
  let completed = false;
  await f.context.confirmMarketListing(listing(), () => { completed = true; });
  assert.equal(f.requests.filter(r => r.url === '/api/marketplace/list').length, 0);
  assert.equal(completed, false);
  assert.ok(f.toasts.length);
});

test('stale fee rejection preserves the failure path', async () => {
  const f = browserFixture({ createData: { error: 'LISTING_FEE_CHANGED' } });
  let completed = false;
  await f.context.confirmMarketListing(listing(), () => { completed = true; });
  assert.equal(completed, false);
  assert.ok(f.toasts.some(args => /Costs changed or preview expired.*review current costs/i.test(String(args[0]))));
});

test('NPC cards identify supply without marking human sellers as NPC', () => {
  const f = browserFixture();
  const card = {
    id: 1, listing_type: 'resource', resource_code: 'iron_ore', resource_quantity: 10,
    price: 6, currency: 'GP', seller: '0xother', seller_name: 'Supplier',
    expires_at: new Date(Date.now() + 3600000).toISOString(),
  };
  assert.match(f.context.renderMarketCard({ ...card, seller_is_npc: true }), /NPC/);
  assert.doesNotMatch(f.context.renderMarketCard({ ...card, seller_is_npc: false }), /NPC/);
});

test('resource form describes the actual total-price API contract', () => {
  const f = browserFixture({ confirm: false });
  f.context.openResourceMarketListing('iron_ore');
  assert.match(f.confirmations[0].body, /bundle total|total.*price/i);
  assert.doesNotMatch(f.confirmations[0].body, /PRICE EACH/);
});

test('invalid resource quantities stop before quote lookup without silent coercion', async () => {
  for (const input of ['', ' ', '0', '-1', '1.5', '1.0', '3abc', '1e0', 'Infinity', '11', '9007199254740993']) {
    const f = browserFixture();
    const fields = { resListQty: { value: input }, resListPrice: { value: '6' }, resListCurrency: { value: 'GP' } };
    f.context.document.getElementById = id => fields[id];
    f.context.openResourceMarketListing('iron_ore');
    await Promise.resolve(); await Promise.resolve();
    assert.equal(f.requests.length, 0, 'invalid quantity reached quote/list request: ' + input);
    assert.ok(f.toasts.some(args => /whole quantity/.test(args[0])), input);
  }
});

test('resource quantities 1, 3 and the exact stock limit reach cost review unchanged', async () => {
  for (const quantity of [1, 3, 10]) {
    const f = browserFixture();
    const forwarded = [];
    f.context.confirmMarketListing = body => forwarded.push(body);
    const fields = { resListQty: { value: String(quantity) }, resListPrice: { value: '6' }, resListCurrency: { value: 'GP' } };
    f.context.document.getElementById = id => fields[id];
    f.context.openResourceMarketListing('iron_ore');
    await Promise.resolve(); await Promise.resolve();
    assert.equal(forwarded.length, 1);
    assert.equal(forwarded[0].resourceQuantity, quantity);
    assert.equal(forwarded[0].price, 6, 'quantity does not change bundle price');
  }
});

test('the actual confirmation dialog keeps invalid sale input open and cancels without validating', async () => {
  const f = browserFixture(), open = new Set(), forwarded = [];
  const nodes = Object.fromEntries(['gcTitle','gcIcon','gcBody','gcInfo','gcConfirmBtn'].map(id => [id,{textContent:'',innerHTML:'',style:{}}]));
  nodes.gameConfirm = {classList:{add:v=>open.add(v),remove:v=>open.delete(v)}};
  let focused;
  for (const [id,value] of Object.entries({resListQty:'1.5',resListPrice:'6',resListCurrency:'GP'})) nodes[id]={value,setAttribute(){},focus(){focused=id;}};
  nodes.resListError = {textContent:'',hidden:true};
  f.context.document.getElementById = id => nodes[id];
  f.context.confirmMarketListing = body => forwarded.push(body);
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../assets/game-dialogs.js'),'utf8'),f.context);
  f.context.gameConfirm = f.context.window.gameConfirm;
  f.context.openResourceMarketListing('iron_ore');
  f.context.window.gameConfirmResolve(true);
  await Promise.resolve();
  assert.ok(open.has('open')); assert.equal(nodes.resListQty.value,'1.5');
  assert.match(nodes.resListError.textContent,/whole quantity/); assert.equal(focused,'resListQty');
  assert.equal(forwarded.length,0); assert.equal(f.requests.length,0);
  nodes.resListQty.value='3';f.context.window.gameConfirmResolve(true);await Promise.resolve();
  assert.ok(!open.has('open'));assert.equal(forwarded[0].resourceQuantity,3);
  f.context.openResourceMarketListing('iron_ore');nodes.resListQty.value='';f.context.window.gameConfirmResolve(false);await Promise.resolve();
  assert.ok(!open.has('open'));assert.equal(forwarded.length,1);
  const plain=f.context.gameConfirm({body:'plain confirmation'});f.context.window.gameConfirmResolve(true);assert.equal(await plain,true,'validator must not leak into later dialogs');
});

test('a delayed quote cannot replace an intervening dialog, even after it closes', async () => {
  for (const stillOpen of [true, false]) {
    const f = browserFixture();
    const body = { firstChild: { form: 'original listing' } };
    let open = false;
    const modal = { classList: { contains: name => name === 'open' && open } };
    f.context.document.getElementById = id => id === 'gcBody' ? body : id === 'gameConfirm' ? modal : null;
    let resolveResponse;
    f.context.fetch = (url, init) => {
      f.requests.push({ url, init });
      return new Promise(resolve => { resolveResponse = resolve; });
    };
    let created = false;
    const pending = f.context.confirmMarketListing(listing(), () => { created = true; });
    const otherDialogContent = { form: 'another game dialog' };
    body.firstChild = otherDialogContent;
    open = stillOpen;
    resolveResponse({ ok: true, json: async () => quote() });
    await pending;
    assert.equal(f.confirmations.length, 0, 'a stale response must not open a cost dialog');
    assert.equal(body.firstChild, otherDialogContent, 'the newer dialog content must remain intact');
    assert.equal(f.requests.length, 1, 'no listing request should be submitted');
    assert.equal(created, false);
  }
});

test('only the latest of overlapping listing quotes can ask for confirmation', async () => {
  const f = browserFixture({ confirm: false });
  const pendingResponses = [];
  f.context.fetch = (url, init) => {
    f.requests.push({ url, init, body: JSON.parse(init.body) });
    return new Promise(resolve => { pendingResponses.push(resolve); });
  };
  const older = f.context.confirmMarketListing({ type: 'claim', claimId: 11, price: 6, currency: 'GP' }, () => {});
  const newer = f.context.confirmMarketListing({ type: 'claim', claimId: 22, price: 9, currency: 'GP' }, () => {});
  pendingResponses[1]({ ok: true, json: async () => quote({ price: 9 }) });
  await newer;
  assert.equal(f.confirmations.length, 1);
  assert.match(visibleText(f.confirmations[0]), /Territory #22/);
  pendingResponses[0]({ ok: true, json: async () => quote() });
  await older;
  assert.equal(f.confirmations.length, 1, 'the older response must not replace the newer confirmation');
  assert.equal(f.requests.filter(r => r.url === '/api/marketplace/list').length, 0);
});

test('an unresponsive quote times out after 8 seconds without auto-registering or replacing a dialog', async () => {
  const f = browserFixture();
  let timeout;
  let lateResponse;
  f.context.setTimeout = (fn, milliseconds) => {
    assert.equal(milliseconds, 8000);
    timeout = fn;
    return 1;
  };
  f.context.clearTimeout = () => {};
  f.context.fetch = (url, init) => {
    f.requests.push({ url, init });
    return new Promise(resolve => { lateResponse = resolve; });
  };
  const pending = f.context.confirmMarketListing(listing(), () => assert.fail('must not register'));
  assert.ok(f.toasts.some(args => /Checking current listing costs/.test(args[0])));
  timeout();
  await pending;
  assert.equal(f.requests.length, 1);
  assert.equal(f.confirmations.length, 0);
  assert.ok(f.toasts.some(args => /No listing request was sent.*Try again/.test(args[0])));
  lateResponse({ ok: true, json: async () => quote() });
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(f.confirmations.length, 0, 'a response after timeout must not replace a newer dialog');
});

test('suggested bundle uses a fresh quote and a separate approval before any write', async () => {
  const f = browserFixture();
  const nodes = {};
  f.context.document.getElementById = id => nodes[id] || null;
  const pending = [];
  f.context.gameConfirm = opts => {
    f.confirmations.push(opts);
    for (const [id, value] of Object.entries({ mktReviewResourceQty: String(f.confirmations.length === 1 ? 5 : 9), mktReviewResourcePrice: String(f.confirmations.length === 1 ? 3 : 5.4), mktUseSuggestedBundle: '', mktUseMinimumTotal: '' })) {
      nodes[id] = { value, handlers: {}, addEventListener(event, fn) { this.handlers[event] = fn; } };
    }
    nodes.mktReviewResourceError = {};
    return new Promise(resolve => pending.push(resolve));
  };
  f.context.fetch = async (url, init) => {
    const body = JSON.parse(init.body);
    f.requests.push({ url, init, body });
    const blocked = body.price === 3;
    return { ok: true, json: async () => url.endsWith('listing-quote') ? quote({
      price: body.price, resourceQuantity: body.resourceQuantity,
      netAfterListingFeeMax: blocked ? -2.15 : 0.13,
      resourceRegistration: { blocked, minimumTotalPriceGp: 5.263158, suggestedQuantity: 9, suggestedTotalPrice: 5.4, unitPrice: 0.6 },
    }) : { success: true } };
  };
  const run = f.context.confirmMarketListing({ ...listing(), price: 3, resourceQuantity: 5 }, () => {});
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(f.confirmations[0].validate(), false);
  nodes.mktUseSuggestedBundle.handlers.click();
  assert.equal(nodes.mktReviewResourceQty.value, '9');
  assert.equal(nodes.mktReviewResourcePrice.value, '5.4');
  assert.equal(f.confirmations[0].validate(), true);
  pending[0](true);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(f.requests.length, 2, 'adjusting requires another free quote, not registration');
  assert.equal(f.requests[1].body.price, 5.4);
  assert.equal(f.requests[1].body.resourceQuantity, 9);
  pending[1](true);
  await run;
  assert.equal(f.requests.length, 3);
  assert.equal(f.requests[2].url, '/api/marketplace/list');
  assert.equal(f.requests[2].body.resourceQuantity, 9);
});

test('resource drafts preserve cancelled edits per wallet without silently reducing quantities', async () => {
  const f = browserFixture({ confirm: false });
  const nodes = { resListQty: { value: '9' }, resListPrice: { value: '5.4' }, resListCurrency: { value: 'PP' } };
  f.context.document.getElementById = id => nodes[id] || null;
  await f.context.openResourceMarketListing('iron_ore');
  f.context.document.getElementById = () => null;
  f.context._resourceInventory[0].quantity = 4;
  await f.context.openResourceMarketListing('iron_ore');
  assert.match(f.confirmations[1].body, /value="9"/);
  assert.match(f.confirmations[1].body, /value="5.4"/);
  assert.match(f.confirmations[1].body, /value="PP" selected/);
  f.context.walletState.address = 'other-wallet';
  await f.context.openResourceMarketListing('iron_ore');
  assert.doesNotMatch(f.confirmations[2].body, /value="5.4"/);
  assert.equal(f.requests.length, 0);
});

test('frozen auctions preserve asset cards but expose no bid, buyout or cancellation controls', async () => {
  for (const seller of ['0xseller', 'another']) {
    const f = browserFixture();
    const grid = { innerHTML: '', querySelector: () => null };
    f.context.document.getElementById = id => id === 'auctionGrid' ? grid : null;
    f.context.mtReadFetch = async () => ({ auctions: [{ id: 7, status: 'active', escrow_version: 0, seller_wallet: seller, start_price: 10, buyout_price: 20, currency: 'GP', ends_at: new Date().toISOString(), item_name: 'Preserved asset' }] });
    f.context.loadAuctions();
    await new Promise(resolve => setImmediate(resolve));
    assert.match(grid.innerHTML, /assets are preserved pending escrow review/);
    assert.match(grid.innerHTML, /disabled aria-disabled="true"/);
    assert.doesNotMatch(grid.innerHTML, /onclick="gov(?:PlaceAuctionBid|AuctionBuyout|CancelAuction)/);
    for (const action of ['govPlaceAuctionBid', 'govAuctionBuyout', 'govCancelAuction']) await f.context.window[action](7, 11, 'GP');
    assert.equal(f.requests.length, 0);
    assert.equal(f.confirmations.length, 0);
  }
});

test('auction actions read fresh modern or flat detail and fail closed on frozen or unavailable status', async () => {
  for (const action of ['govPlaceAuctionBid', 'govAuctionBuyout', 'govCancelAuction']) {
    for (const modern of [true, false]) {
      const f = browserFixture();
      f.context.fetch = async (url, init) => {
        f.requests.push({ url, init });
        const a = { id: 8, status: 'active', escrow_version: 0, read_only: true, escrow_review_required: true };
        return { json: async () => modern ? { auction: a, bids: [] } : a };
      };
      await f.context.window[action](8, 10, 'GP');
      assert.equal(f.requests.length, 1);
      assert.equal(f.requests[0].url, '/api/auctions/8');
      assert.notEqual(f.requests[0].init.method, 'POST');
      assert.equal(f.confirmations.length, 0);
    }
  }
  const f = browserFixture();
  f.context.fetch = async () => { throw new Error('unavailable'); };
  await f.context.window.govCancelAuction(8);
  assert.equal(f.confirmations.length, 0);
  assert.ok(f.toasts.some(a => /status unavailable/.test(a[0])));
});

test('completed legacy auctions are history, while explicit current flags and active zero-version are read-only', () => {
  const f = browserFixture();
  assert.equal(f.context._auctionReadOnly({ status: 'sold', escrow_version: 0, read_only: false }), false);
  assert.equal(f.context._auctionReadOnly({ status: 'cancelled', escrow_version: 0 }), false);
  assert.equal(f.context._auctionReadOnly({ status: 'active', escrow_version: 0 }), true);
  assert.equal(f.context._auctionReadOnly({ escrow_version: 0 }), true);
  assert.equal(f.context._auctionReadOnly({ status: 'active', escrow_version: 1 }), false);
  assert.equal(f.context._auctionReadOnly({ read_only: true }), true);
  assert.equal(f.context._auctionReadOnly({ escrow_review_required: true }), true);
});

test('verified current auctions retain bid, buyout and cancel behavior after the new read check', async () => {
  for (const [action, suffix] of [['govPlaceAuctionBid','bid'], ['govAuctionBuyout','buyout'], ['govCancelAuction','cancel']]) {
    const f = browserFixture();
    f.context.document.getElementById = id => id === 'aucBidAmt' ? { value: '11' } : null;
    f.context.refreshBalance = () => {};
    f.context.loadAuctions = () => {};
    f.context.loadItemInstances = () => {};
    f.context.fetch = async (url, init = {}) => {
      f.requests.push({ url, init });
      return { json: async () => init.method === 'POST' ? { success: true } : { auction: { id: 9, status: 'active', escrow_version: 1, read_only: false, escrow_review_required: false }, bids: [] } };
    };
    await f.context.window[action](9, 10, 'GP');
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(f.confirmations.length, 1);
    assert.equal(f.requests.length, 2);
    assert.equal(f.requests[0].url, '/api/auctions/9');
    assert.equal(f.requests[1].url, '/api/auctions/9/' + suffix);
    assert.equal(f.requests[1].init.method, 'POST');
  }
});
