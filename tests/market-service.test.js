const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Evaluate only source text with an allowlisted require. No DB, .env or app boot.
const source = fs.readFileSync(path.join(__dirname, '../server/services/marketplace.js'), 'utf8');

function fixture(options = {}) {
  const calls = [];
  const settings = { marketplace_listing_fee_gp: '5', ...options.settings };
  let active = options.active || 0;
  const pool = { query: async (sql, args = []) => {
    calls.push({ sql, args });
    if (/COUNT\(\*\) AS cnt FROM marketplace_listings/.test(sql)) return { rows: [{ cnt: active }] };
    if (/SELECT sector_id FROM pixels/.test(sql)) {
      if (options.sectorFailure) throw new Error('Fixture sector lookup failure');
      return { rows: options.sectorId == null ? [] : [{ sector_id: options.sectorId }] };
    }
    if (/listing_count/.test(sql)) {
      if (options.npcFailure) throw new Error('Fixture NPC lookup failure');
      return { rows: [{ listing_count: 2, min_unit_price: '0.6' }] };
    }
    if (/SELECT gp_balance FROM users/.test(sql)) {
      if (options.afterUserLockActive != null) active = options.afterUserLockActive;
      if (options.clock && options.advanceOnUserLockMs) options.clock.now += options.advanceOnUserLockMs;
      return { rows: [{ gp_balance: options.gpBalance == null ? 10000 : options.gpBalance }] };
    }
    if (/SELECT \* FROM resources/.test(sql)) return { rows: [{ name_en: 'Iron', icon_emoji: 'ore', rarity: 'common' }] };
    if (/SELECT inv.quantity/.test(sql)) return { rows: [{ quantity: 100 }] };
    if (/INSERT INTO marketplace_listings/.test(sql)) return { rows: [{ id: 9, price: args[4], currency: args[5] }], rowCount: 1 };
    if (/SELECT \* FROM marketplace_listings WHERE id/.test(sql)) return { rows: [{
      id: 9, seller: 'seller', price: options.purchasePrice || 100, currency: 'GP',
      expires_at: new Date(Date.now() + 60000), sector_id: options.sectorId || null,
    }] };
    if (/^(UPDATE|INSERT)/.test(sql.trim())) return { rows: [], rowCount: 1 };
    throw new Error(`Unexpected fixture SQL: ${sql}`);
  } };
  const db = { pool, getSetting: async key => settings[key], logGPActivity: async () => {} };
  const module = { exports: {} };
  const context = { module, exports: module.exports, console: { warn() {}, log() {}, error() {} },
    require(name) {
      if (name === '../db') return db;
      if (name === './job') return { getJobBuff: async (_wallet, key, fallback) => {
        if (options.discountFailure) throw new Error('Fixture discount failure');
        return options.buffs && options.buffs[key] != null ? options.buffs[key] : fallback;
      } };
      if (name === './territoryCondition') return { marketFeeMultiplier: async () => options.territoryMultiplier || 1 };
      if (name === './sector') return { computeSectorTariff: async (sectorId, buyer, price) => {
        if (options.tariffFailure) throw new Error('Fixture tariff failure');
        return { tariffAmount: sectorId ? price * 0.02 : 0, tariffPct: sectorId ? 2 : 0,
          governorWallet: sectorId ? 'governor' : null, reason: 'ok', exempted: false };
      } };
      throw new Error(`Fixture blocked dependency: ${name}`);
    },
  };
  if (options.clock) context.Date = class extends Date { static now() { return options.clock.now; } };
  vm.createContext(context);
  vm.runInContext(source, context, { filename: 'marketplace.js' });
  return { service: module.exports, pool, calls };
}

const params = overrides => ({ price: 6, currency: 'GP', resourceCode: 'iron_ore', resourceQuantity: 10, ...overrides });
const writes = f => f.calls.filter(c => /^(INSERT|UPDATE|DELETE)/.test(c.sql.trim()));

test('seller quote is read-only and matches baseline 5 GP registration / 5% sale fee', async () => {
  const f = fixture();
  const q = await f.service.quoteListing('SELLER', 'resource', params());
  assert.equal(q.price, 6);
  assert.equal(q.listingFeeGp, 5);
  assert.equal(q.saleFee, 0.3);
  assert.equal(q.receivesMax, 5.7);
  assert.ok(Math.abs(q.netAfterListingFeeMax - 0.7) < 1e-10);
  assert.equal(q.resourceQuantity, 10);
  assert.equal(q.npcCompetition.listingCount, 2);
  assert.equal(q.npcCompetition.minUnitPrice, 0.6);
  assert.equal(Date.parse(q.expiresAt) - Date.parse(q.quotedAt), 60000);
  assert.equal(writes(f).length, 0);
  const npc = f.calls.find(c => /listing_count/.test(c.sql));
  assert.deepEqual(Array.from(npc.args), ['iron_ore', 'GP']);
  assert.match(npc.sql, /u\.is_ai = TRUE/);
  assert.match(npc.sql, /expires_at > NOW/);
});

test('dynamic thresholds use the same fee for preview and actual charge', async () => {
  for (const [active, expected] of [[0, 5], [5, 8], [10, 10]]) {
    const f = fixture({ active });
    const q = await f.service.quoteListing('seller', 'resource', params({ price: 30 }));
    assert.equal(q.listingFeeGp, expected);
    await f.service.createListing(f.pool, 'seller', 'resource', params({ price: 30,
      expectedListingFeeGp: q.listingFeeGp, listingQuoteExpiresAt: q.expiresAt,
    }));
    const charge = f.calls.find(c => /UPDATE users SET gp_balance = gp_balance -/.test(c.sql));
    assert.equal(charge.args[0], q.listingFeeGp);
    const insert = f.calls.find(c => /INSERT INTO marketplace_listings/.test(c.sql));
    assert.equal(insert.args[4], 30, 'resource price remains the total bundle price');
  }
});

test('seller buffs and territory discount stay shared with the existing purchase quote', async () => {
  const f = fixture({ active: 5, territoryMultiplier: 0.8, buffs: {
    merchant_fee_discount: 0.5, crafter_market_fee: 0.9, merchant_market_fee: 0.7,
  } });
  const q = await f.service.quoteListing('seller', 'resource', params({ price: 100 }));
  const purchase = await f.service.quotePurchase(9, 'buyer');
  assert.equal(q.listingFeeGp, 3, 'ceil(5 × 1.5) then floor(8 × .5 × .9)');
  assert.equal(q.saleFee, 2.52);
  assert.equal(q.saleFee, purchase.fee);
  assert.equal(q.saleFeePct, purchase.feePct);
  assert.equal(q.receivesMax, purchase.sellerReceives);
});

test('minimum seller sale fee floor remains in effect', async () => {
  const f = fixture({ buffs: { merchant_market_fee: 0.01 }, territoryMultiplier: 0.1 });
  const q = await f.service.quoteListing('seller', 'resource', params({ price: 100 }));
  assert.equal(q.saleFeePct, 0.5);
  assert.equal(q.saleFee, 0.5);
});

test('PP sale proceeds never combine with the GP listing fee', async () => {
  const f = fixture();
  const q = await f.service.quoteListing('seller', 'resource', params({ currency: 'PP' }));
  assert.equal(q.listingFeeGp, 5);
  assert.equal(q.saleFee, 0.3);
  assert.equal(q.receivesMin, 5.7);
  assert.equal(q.netAfterListingFeeMin, null);
  assert.equal(q.netAfterListingFeeMax, null);
});

test('buyer tariff uncertainty is a range, lookup failure is explicitly unknown', async () => {
  const f = fixture({ sectorId: 2 });
  const q = await f.service.quoteListing('seller', 'resource', params());
  assert.equal(q.tariffStatus, 'range');
  assert.equal(q.tariffMax, 0.12);
  assert.equal(q.receivesMin, 5.58);
  assert.equal(q.receivesMax, 5.7);
  for (const failure of [{ tariffFailure: true }, { sectorFailure: true }]) {
    const broken = fixture({ sectorId: 2, ...failure });
    const unknown = await broken.service.quoteListing('seller', 'resource', params());
    assert.equal(unknown.tariffStatus, 'unknown');
    assert.equal(unknown.tariffMax, null);
    assert.equal(unknown.receivesMin, null);
    assert.equal(unknown.netAfterListingFeeMin, null);
  }
});

test('missing discounts and NPC supply are disclosed, not fabricated', async () => {
  const f = fixture({ discountFailure: true, npcFailure: true });
  const q = await f.service.quoteListing('seller', 'resource', params());
  assert.equal(q.listingDiscountsVerified, false);
  assert.equal(q.saleDiscountsVerified, false);
  assert.equal(q.receivesMin, null, 'unverified discounts must not imply a firm proceeds range');
  assert.equal(q.npcCompetition.available, false);
  assert.equal(writes(f).length, 0);
});

test('changed fee and expired preview reject before any charge or asset mutation', async () => {
  for (const extra of [{ expectedListingFeeGp: 2 }, { listingQuoteExpiresAt: new Date(0).toISOString() }, { listingQuoteExpiresAt: 'invalid' }]) {
    const f = fixture();
    await assert.rejects(f.service.createListing(f.pool, 'seller', 'resource', params(extra)), /LISTING_(FEE_CHANGED|QUOTE_EXPIRED)/);
    assert.equal(writes(f).length, 0);
  }
});

test('seller lock precedes count so a competing registration crossing the fee threshold is re-quoted', async () => {
  const f = fixture({ active: 4, afterUserLockActive: 5 });
  const q = await f.service.quoteListing('seller', 'resource', params());
  assert.equal(q.listingFeeGp, 5);
  f.calls.length = 0;
  await assert.rejects(f.service.createListing(f.pool, 'seller', 'resource', params({ expectedListingFeeGp: q.listingFeeGp })), /LISTING_FEE_CHANGED/);
  assert.match(f.calls[0].sql, /users.*FOR UPDATE/);
  assert.match(f.calls[1].sql, /COUNT\(\*\).*marketplace_listings/);
  assert.equal(writes(f).length, 0);

  const free = fixture({ active: 4, afterUserLockActive: 5, buffs: { merchant_fee_discount: 0 } });
  await free.service.createListing(free.pool, 'seller', 'resource', params({ expectedListingFeeGp: 0 }));
  assert.match(free.calls[0].sql, /users.*FOR UPDATE/, 'zero-fee listings must also serialize the seller count');
  assert.equal(free.calls.some(c => /UPDATE users SET gp_balance = gp_balance -/.test(c.sql)), false);
});

test('a preview expiring while waiting for the seller lock cannot charge or escrow', async () => {
  const clock = { now: Date.now() };
  const f = fixture({ clock, advanceOnUserLockMs: 2000 });
  const expiresAt = new Date(clock.now + 1000).toISOString();
  await assert.rejects(f.service.createListing(f.pool, 'seller', 'resource', params({
    expectedListingFeeGp: 5, listingQuoteExpiresAt: expiresAt,
  })), /LISTING_QUOTE_EXPIRED/);
  assert.match(f.calls[0].sql, /users.*FOR UPDATE/);
  assert.equal(writes(f).length, 0);
});

test('existing creation clients without preview fields remain compatible', async () => {
  const f = fixture();
  const result = await f.service.createListing(f.pool, 'seller', 'resource', params());
  assert.equal(result.id, 9);
  assert.equal(result.price, 6);
  assert.equal(f.calls.filter(c => /UPDATE users SET gp_balance = gp_balance -/.test(c.sql)).length, 1);
});

test('invalid currency, price, type or listing cap returns no quote and no writes', async () => {
  for (const [type, p] of [['resource', params({ currency: 'USDT' })], ['resource', params({ price: -1 })], ['currency', params()]]) {
    const f = fixture();
    await assert.rejects(f.service.quoteListing('seller', type, p));
    assert.equal(writes(f).length, 0);
  }
  const full = fixture({ active: 20 });
  await assert.rejects(full.service.quoteListing('seller', 'resource', params()), /Maximum/);
  assert.equal(writes(full).length, 0);
});

test('loss-making and exact zero-net resource bundles cannot charge or escrow, including clients bypassing previews', async () => {
  for (const price of [3, 5.263157]) {
    const f = fixture();
    const p = params({ price, resourceQuantity: 5 });
    const q = await f.service.quoteListing('seller', 'resource', p);
    assert.equal(q.resourceRegistration.blocked, true);
    assert.equal(q.resourceRegistration.minimumTotalPriceGp, 5.263158);
    await assert.rejects(f.service.createListing(f.pool, 'seller', 'resource', p), /RESOURCE_LISTING_NO_NET_PROCEEDS/);
    assert.equal(writes(f).length, 0);
  }
});

test('the same-unit-price suggestion clears current fees and matches the actual charge', async () => {
  const f = fixture();
  const q = await f.service.quoteListing('seller', 'resource', params({ price: 3, resourceQuantity: 5 }));
  assert.equal(q.resourceRegistration.suggestedQuantity, 9);
  assert.equal(q.resourceRegistration.suggestedTotalPrice, 5.4);
  assert.equal(q.resourceRegistration.unitPrice, 0.6);
  const p = params({ price: 5.4, resourceQuantity: 9, expectedListingFeeGp: q.listingFeeGp });
  const revised = await f.service.quoteListing('seller', 'resource', p);
  assert.equal(revised.resourceRegistration.blocked, false);
  assert.ok(revised.netAfterListingFeeMax > 0);
  await f.service.createListing(f.pool, 'seller', 'resource', p);
  assert.equal(f.calls.find(c => /UPDATE users SET gp_balance = gp_balance -/.test(c.sql)).args[0], 5);
  assert.equal(f.calls.find(c => /INSERT INTO marketplace_listings/.test(c.sql)).args[4], 5.4);
});

test('resource safety follows actual dynamic settings, discounts, min price and separate PP denomination', async () => {
  for (const options of [
    { active: 5, settings: { marketplace_dynamic_fee_5: '2' } },
    { active: 10, settings: { marketplace_dynamic_fee_10: '4' } },
    { buffs: { merchant_fee_discount: 0.5, merchant_market_fee: 0.7 } },
    { buffs: { merchant_fee_discount: 0 }, settings: { marketplace_min_price: '2' } },
  ]) {
    const f = fixture(options);
    const q = await f.service.quoteListing('seller', 'resource', params());
    const minimum = q.resourceRegistration.minimumTotalPriceGp;
    assert.ok(minimum >= Number(options.settings?.marketplace_min_price || 1));
    const p = params({ price: minimum });
    const revised = await f.service.quoteListing('seller', 'resource', p);
    assert.equal(revised.resourceRegistration.blocked, false);
    await f.service.createListing(f.pool, 'seller', 'resource', p);
  }
  const pp = fixture();
  const q = await pp.service.quoteListing('seller', 'resource', params({ price: 1, currency: 'PP' }));
  assert.equal(q.resourceRegistration.status, 'separate_currencies');
  await pp.service.createListing(pp.pool, 'seller', 'resource', params({ price: 1, currency: 'PP' }));
});

test('a safe resource bundle still requires funded registration and rechecks current sale fees', async () => {
  const poor = fixture({ gpBalance: 4 });
  await assert.rejects(poor.service.createListing(poor.pool, 'seller', 'resource', params()), /Insufficient GP/);
  assert.equal(writes(poor).length, 0);
  const changed = fixture({ settings: { marketplace_fee_pct: '20' } });
  await assert.rejects(changed.service.createListing(changed.pool, 'seller', 'resource', params({ price: 5.4 })), /RESOURCE_LISTING_NO_NET_PROCEEDS/);
  assert.equal(writes(changed).length, 0);
});
