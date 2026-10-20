#!/usr/bin/env node
'use strict';
// Pure, offline policy/behavior model. Never imports db, dotenv, signer, or game services.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const SCALE = 1000000n;
const POLICY_VERSION = 'occupy-authored-seeds-2026-10-21-v1';
const VIRTUAL_EPOCH = Date.parse('2026-10-21T00:00:00Z');
const ROOT = path.resolve(__dirname, '../..');
const SOURCE_PATHS = [
  'server/tools/economy_scenario_simulation.js', 'server/tests/economy-scenario-simulation.test.js',
  'server/services/daily.js', 'server/services/onboarding.js', 'server/services/shipMining.js',
  'server/services/ship.js', 'server/services/crafting.js', 'server/services/resource.js',
  'server/services/marketplace.js', 'server/services/npcEconomy.js', 'server/services/guild.js',
  'server/services/dividends.js', 'server/services/shipSalvage.js', 'server/services/battleEngine.js', 'server/services/auction.js', 'server/services/auctionCombat.js',
  'server/migrations/354_npc_seed_budget.sql', 'server/services/frontierIndustry.js', 'server/routes/api.js',
  'server/routes/redemptionRoutes.js', 'server/services/treasury.js',
  'server/migrations/163_zone_minerals.sql', 'server/migrations/173_economy_balance_pack.sql',
  'server/migrations/212_crafting_recipes_seed.sql', 'server/migrations/276_ship_mining_hull_wear.sql', 'server/migrations/212_ship_hp_balance_pass.sql',
  'server/migrations/220_economy_balance_sea.sql', 'server/migrations/224_week1_funnel_gp_bundle.sql',
  'server/migrations/277_ship_mining_depth.sql', 'server/migrations/278_ship_mining_redteam_fixes.sql',
  'server/migrations/294_economy_faucet_revert_compromise.sql', 'server/migrations/300_ship_repair_cost_tuning.sql',
  'server/migrations/329_npc_economy_settings.sql', 'server/migrations/348_crafting_silicon_chip.sql',
];
function units(value) {
  if (typeof value !== 'string' && !(typeof value === 'number' && Number.isSafeInteger(value))) throw Error('EXACT_DECIMAL_REQUIRED');
  const m = String(value).match(/^(0|[1-9]\d*)(?:\.(\d{1,6}))?$/);
  if (!m) throw Error('INVALID_DECIMAL');
  return BigInt(m[1]) * SCALE + BigInt((m[2] || '').padEnd(6, '0'));
}
function decimal(n) { const sign = n < 0n ? '-' : ''; n = n < 0n ? -n : n; return sign + n / SCALE + '.' + String(n % SCALE).padStart(6, '0'); }
function positiveInteger(v, name, max = 1000000) { if (!Number.isSafeInteger(v) || v < 0 || v > max) throw Error('INVALID_' + name); return v; }
function ratio(n, d) { return d ? Number(n * 10000n / d) / 100 : 0; }
function rng(seed) {
  positiveInteger(seed, 'SEED', 0xffffffff); let state = seed >>> 0;
  return () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
}

// Trusted engine actor is a model controller, not production authentication.
// User actors may debit only their own account. System accounts cannot be forged by users.
class Ledger {
  #balances = new Map(); #ids = new Set(); #events = []; #time = VIRTUAL_EPOCH; #policy = POLICY_VERSION; #observer;
  constructor(observer = () => {}) { this.#observer = observer; }
  changePolicy(actor, version) { if (actor !== 'policy_operator' || typeof version !== 'string' || !version) throw Error('UNAUTHORIZED_POLICY_CHANGE'); if (this.#ids.has('policy:' + version)) throw Error('DUPLICATE_EVENT'); this.#ids.add('policy:' + version); this.#policy = version; this.#events.push({ sequence: this.#events.length + 1, virtualTime: new Date(this.#time).toISOString(), policyVersion: version, id: 'policy:' + version, actor, kind: 'policy_change', reason: 'explicit_scenario_sensitivity', invariants: { balancedEveryAsset: true, nonnegativeSpendableAccounts: true, uniqueEvent: true, authorizedDebits: true }, legs: [] }); this.#observer(this.#events.at(-1)); }
  setTime(time) { if (!Number.isSafeInteger(time) || time < this.#time) throw Error('TIME_REVERSAL'); this.#time = time; }
  get events() { return this.#events.map(e => ({ ...e, legs: e.legs.map(l => ({ ...l })) })); }
  balance(account, asset) { return this.#balances.get(account + '|' + asset) || 0n; }
  post({ id, actor, kind = 'transfer', legs, reason = '' }) {
    if (!id || this.#ids.has(id)) throw Error('DUPLICATE_EVENT');
    if (!Array.isArray(legs) || legs.length < 2) throw Error('INVALID_POSTINGS');
    if (!['issue', 'burn', 'transfer', 'transform'].includes(kind)) throw Error('INVALID_KIND');
    if (kind !== 'transfer' && actor !== 'engine') throw Error('UNAUTHORIZED_ISSUANCE');
    const staged = new Map(); const totals = new Map();
    for (const leg of legs) {
      const { account, asset, delta } = leg;
      if (typeof account !== 'string' || !account || account.includes('|') || typeof asset !== 'string' || !asset || asset.includes('|') || typeof delta !== 'bigint' || delta === 0n) throw Error('INVALID_POSTING');
      const system = account === '@issuer' || account === '@burn';
      if (account.startsWith('@') && !system) throw Error('UNKNOWN_SYSTEM_ACCOUNT');
      if (system && actor !== 'engine') throw Error('UNAUTHORIZED_SYSTEM_ACCOUNT');
      if (account === '@issuer' && (!['issue', 'transform'].includes(kind) || delta > 0n)) throw Error('UNAUTHORIZED_ISSUANCE');
      if (account === '@burn' && (!['burn', 'transform'].includes(kind) || delta < 0n)) throw Error('UNAUTHORIZED_BURN');
      if (!system && delta < 0n && actor !== 'engine' && actor !== account) throw Error('UNAUTHORIZED_DEBIT');
      const key = account + '|' + asset;
      staged.set(key, (staged.has(key) ? staged.get(key) : this.balance(account, asset)) + delta);
      totals.set(asset, (totals.get(asset) || 0n) + delta);
    }
    for (const n of totals.values()) if (n !== 0n) throw Error('UNBALANCED_EVENT');
    for (const [key, n] of staged) if (!key.startsWith('@issuer|') && n < 0n) throw Error('INSUFFICIENT_BALANCE');
    for (const [key, n] of staged) this.#balances.set(key, n);
    this.#ids.add(id); this.#events.push({ sequence: this.#events.length + 1, virtualTime: new Date(this.#time).toISOString(), policyVersion: this.#policy, id, actor, kind, reason, invariants: { balancedEveryAsset: true, nonnegativeSpendableAccounts: true, uniqueEvent: true, authorizedDebits: true }, legs: legs.map(l => ({ ...l })) }); this.#observer(this.#events.at(-1));
  }
  issue(id, to, asset, amount, reason) { if (amount) this.post({ id, actor: 'engine', kind: 'issue', reason, legs: [{ account: '@issuer', asset, delta: -amount }, { account: to, asset, delta: amount }] }); }
  transfer(id, from, to, asset, amount, actor = from, reason = '') { if (amount) this.post({ id, actor, reason, legs: [{ account: from, asset, delta: -amount }, { account: to, asset, delta: amount }] }); }
  burn(id, from, asset, amount, reason) { if (amount) this.post({ id, actor: 'engine', kind: 'burn', reason, legs: [{ account: from, asset, delta: -amount }, { account: '@burn', asset, delta: amount }] }); }
  snapshot() { return Object.fromEntries([...this.#balances].sort().map(([k, v]) => [k, v.toString()])); }
  audit() {
    const totals = {}; const assets = new Set([...this.#balances.keys()].map(k => k.split('|')[1]));
    for (const asset of [...assets].sort()) {
      let held = 0n; let sum = 0n;
      for (const [key, value] of this.#balances) if (key.endsWith('|' + asset)) { sum += value; if (!key.startsWith('@')) held += value; }
      const issued = -this.balance('@issuer', asset); const burned = this.balance('@burn', asset);
      totals[asset] = { issued: issued.toString(), burned: burned.toString(), held: held.toString(), error: (issued - burned - held).toString() };
      if (sum !== 0n || issued - burned !== held) throw Error('CONSERVATION_FAILURE');
    }
    return totals;
  }
}

const CUSTODY_ASSETS = Object.freeze(['USDC', 'USDT', 'USDG']);
class Custody {
  #assets = new Map(); #ids = new Set(); #customers = new Map(); #pending = new Map(); #funding = new Map(); #events = []; #time = VIRTUAL_EPOCH; #observer;
  constructor(observer = () => {}) { this.#observer = observer; }
  get events() { return this.#events.map(e => ({ ...e })); }
  setTime(time) { if (!Number.isSafeInteger(time) || time < this.#time) throw Error('TIME_REVERSAL'); this.#time = time; }
  #asset(asset) { if (!CUSTODY_ASSETS.includes(asset)) throw Error('UNSUPPORTED_STABLECOIN'); return this.#assets.get(asset) || { liquid: 0n, locked: 0n, revenue: 0n, deposited: 0n, withdrawn: 0n, spent: 0n, funded: 0n, lost: 0n }; }
  claim(user, asset) { this.#asset(asset); return this.#customers.get(user + '|' + asset) || 0n; }
  pending(asset) { this.#asset(asset); return [...this.#pending.values()].filter(p => p.asset === asset && ['pending', 'unknown'].includes(p.status)).map(p => ({ ...p })); }
  available(asset) { return this.#asset(asset).liquid - this.pending(asset).reduce((s, p) => s + p.amount, 0n); }
  availableClaim(user, asset) { return this.claim(user, asset) - this.pending(asset).filter(p => p.user === user).reduce((s, p) => s + p.amount, 0n); }
  liabilities(asset) { this.#asset(asset); let n = 0n; for (const [k, v] of this.#customers) if (k.endsWith('|' + asset)) n += v; return n; }
  #atomic(id, action) {
    if (!id || this.#ids.has(id)) throw Error('DUPLICATE_EVENT');
    const clone = m => new Map([...m].map(([k, v]) => [k, typeof v === 'object' ? { ...v } : v]));
    const before = [clone(this.#assets), clone(this.#customers), clone(this.#pending), clone(this.#funding), new Set(this.#ids), this.#events.length];
    try { action(); this.audit(); this.#ids.add(id); for (const event of this.#events.slice(before[5])) this.#observer(event); }
    catch (e) { [this.#assets, this.#customers, this.#pending, this.#funding, this.#ids] = before; this.#events.length = before[5]; throw e; }
  }
  #record(id, kind, params = {}) { this.#events.push({ sequence: this.#events.length + 1, virtualTime: new Date(this.#time).toISOString(), policyVersion: POLICY_VERSION, id, kind, ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, typeof v === 'bigint' ? v.toString() : v])), invariantsCheckedAfterEvent: true }); }
  observeFunding({ id, asset, user, amount }) {
    this.#atomic(id, () => { this.#asset(asset); if (!user || typeof amount !== 'bigint' || amount <= 0n) throw Error('INVALID_FUNDING'); this.#funding.set(id, { id, asset, user, amount, status: 'unconfirmed' }); this.#record(id, 'funding_observed_unconfirmed', { asset, user, amount }); });
  }
  reconcileFunding(id, finalized, actor) {
    this.#atomic('reconcile:' + id, () => {
      if (actor !== 'verified_funding') throw Error('UNVERIFIED_FUNDING');
      const f = this.#funding.get(id); if (!f || f.status !== 'unconfirmed') throw Error('INVALID_FUNDING_RECONCILIATION');
      if (finalized) { this.#post({ id: 'finalized:' + id, actor, kind: 'deposit', asset: f.asset, user: f.user, amount: f.amount }); f.status = 'finalized'; } else f.status = 'reorged';
      this.#record('reconcile:' + id, finalized ? 'funding_finalized' : 'funding_reorged', { asset: f.asset, user: f.user, amount: f.amount });
    });
  }
  requestWithdrawal({ id, actor, user, asset, amount }) {
    this.#atomic(id, () => {
      if (actor !== user) throw Error('UNAUTHORIZED_DEBIT');
      if (typeof amount !== 'bigint' || amount <= 0n || this.availableClaim(user, asset) < amount) throw Error('UNFUNDED_WITHDRAWAL');
      const a = this.#asset(asset); if (a.liquid + a.locked < this.liabilities(asset)) throw Error('INSOLVENT');
      if (this.available(asset) < amount) throw Error('ILLIQUID');
      this.#pending.set(id, { id, user, asset, amount, status: 'pending' }); this.#record(id, 'withdrawal_reserved', { asset, user, amount });
    });
  }
  timeoutWithdrawal(id) {
    this.#atomic('timeout:' + id, () => { const p = this.#pending.get(id); if (!p || p.status !== 'pending') throw Error('INVALID_PENDING_WITHDRAWAL'); p.status = 'unknown'; this.#record('timeout:' + id, 'withdrawal_timeout_unknown_lock_retained', { asset: p.asset, user: p.user, amount: p.amount }); });
  }
  reconcileWithdrawal({ id, requestId, actor, confirmed }) {
    this.#atomic(id, () => {
      if (actor !== 'verified_settlement') throw Error('UNVERIFIED_SETTLEMENT');
      const p = this.#pending.get(requestId); if (!p || !['pending', 'unknown'].includes(p.status)) throw Error('INVALID_PENDING_WITHDRAWAL');
      // Release only this reservation inside the same atomic operation as settlement.
      p.status = confirmed ? 'completed' : 'confirmed_failed';
      if (confirmed) this.#post({ id, actor, kind: 'withdraw', asset: p.asset, user: p.user, amount: p.amount }, true);
      else this.#record(id, 'withdrawal_confirmed_failed_lock_released', { asset: p.asset, user: p.user, amount: p.amount });
    });
  }
  apply(params) { this.#atomic(params.id, () => this.#post(params)); }
  #post({ id, actor, kind, asset, user, amount }, verifiedPendingSettlement = false) {
    if (this.#ids.has(id)) throw Error('DUPLICATE_EVENT'); this.#ids.add(id);
    if (typeof amount !== 'bigint' || amount <= 0n) throw Error('INVALID_AMOUNT');
    const a = { ...this.#asset(asset) }; let claim = this.claim(user, asset);
    if (kind === 'deposit') { if (actor !== 'verified_funding') throw Error('UNVERIFIED_FUNDING'); a.liquid += amount; a.deposited += amount; claim += amount; }
    else if (kind === 'operator_funding') { if (actor !== 'verified_funding') throw Error('UNVERIFIED_FUNDING'); a.liquid += amount; a.funded += amount; }
    else if (kind === 'spend') {
      if (actor !== user) throw Error('UNAUTHORIZED_DEBIT');
      if (this.availableClaim(user, asset) < amount || this.available(asset) < amount) throw Error('UNFUNDED_SPEND');
      claim -= amount; a.liquid -= amount; a.revenue += amount; a.spent += amount;
    } else if (kind === 'withdraw') {
      if (actor !== 'verified_settlement' || !verifiedPendingSettlement) throw Error('UNVERIFIED_SETTLEMENT');
      if (this.availableClaim(user, asset) < amount) throw Error('UNFUNDED_WITHDRAWAL');
      if (a.liquid + a.locked < this.liabilities(asset)) throw Error('INSOLVENT');
      if (this.available(asset) < amount) throw Error('ILLIQUID');
      claim -= amount; a.liquid -= amount; a.withdrawn += amount;
    } else if (kind === 'lock' || kind === 'unlock' || kind === 'loss') {
      if (actor !== 'custody_operator') throw Error('UNAUTHORIZED_CUSTODY_CHANGE');
      if (kind === 'lock') { if (this.available(asset) < amount) throw Error('UNFUNDED_LOCK'); a.liquid -= amount; a.locked += amount; }
      if (kind === 'unlock') { if (a.locked < amount) throw Error('UNFUNDED_UNLOCK'); a.locked -= amount; a.liquid += amount; }
      if (kind === 'loss') { if (this.available(asset) < amount) throw Error('UNFUNDED_LOSS'); a.liquid -= amount; a.lost += amount; }
    } else throw Error('UNAUTHORIZED_LEDGER_CHANGE');
    this.#assets.set(asset, a); if (user) this.#customers.set(user + '|' + asset, claim); this.#record(id, kind, { actor, asset, user: user || null, amount });
  }
  audit() {
    const out = {};
    for (const asset of CUSTODY_ASSETS) {
      const a = this.#asset(asset); const liabilities = this.liabilities(asset); const reserve = a.liquid + a.locked; const pending = this.pending(asset); const reserved = pending.reduce((s, p) => s + p.amount, 0n);
      const cashError = a.deposited + a.funded - a.withdrawn - a.revenue - reserve - a.lost;
      const claimError = a.deposited - a.withdrawn - a.spent - liabilities;
      if (cashError !== 0n || claimError !== 0n) throw Error('CUSTODY_CONSERVATION_FAILURE');
      if (Object.values(a).some(n => n < 0n) || reserved > a.liquid || reserved < 0n) throw Error('INVALID_PENDING_CASH_BALANCE');
      for (const [key, value] of this.#customers) if (key.endsWith('|' + asset)) {
        const user = key.slice(0, -(asset.length + 1)); const encumbered = pending.filter(p => p.user === user).reduce((s, p) => s + p.amount, 0n);
        if (value < 0n || encumbered > value) throw Error('INVALID_PENDING_CUSTOMER_BALANCE');
      }
      out[asset] = { ...Object.fromEntries(Object.entries(a).map(([k, v]) => [k, v.toString()])), customerLiabilities: liabilities.toString(), reserves: reserve.toString(), reserveSurplus: (reserve - liabilities).toString(), availableLiquidMicro: (a.liquid - reserved).toString(), insolvency: reserve < liabilities, cashError: cashError.toString(), claimError: claimError.toString(), pendingWithdrawalMicro: reserved.toString(), pendingWithdrawals: pending.map(p => ({ ...p, amount: p.amount.toString() })), unconfirmedFundingMicro: [...this.#funding.values()].filter(f => f.asset === asset && f.status === 'unconfirmed').reduce((s, f) => s + f.amount, 0n).toString(), reorgedFundingMicro: [...this.#funding.values()].filter(f => f.asset === asset && f.status === 'reorged').reduce((s, f) => s + f.amount, 0n).toString() };
    }
    return out;
  }
}

const POLICY = Object.freeze({
  profile: 'authored-seed-profile-not-live-settings', loginGP: [8, 12, 16, 20, 22, 25, 40], loginDay7EquivalentPP: '0.1', ppToGp: 10,
  streak3GP: 30, streak7GP: 150, onboardingGP: 75, onboardingPPEquivalent: '0.5',
  // Mission selection/completion is behavioral; 15+10+25 are real mission rewards.
  missionGP: 50, missionAllBonusGP: 50, listingGP: 5, saleFeeBps: 500, referralFeeShareBps: 2500, dividendFeeShareBps: 2000,
  miningGPPerCapacityHour: 3, miningCapGPPer24h: 1500, miningWearBpsPerHour: 200,
  repairGPPerHP: '0.03', repairCapBps: 6000, repairIronPer10HP: '0.2',
  hullHP: 32000, hullBuildGP: 60, hullIron: 5, hullCarbon: 3,
  craftGP: 50, craftIron: 5, craftSilicon: 3, craftSuccessBps: 8000, craftFailureRefundBps: 5000,
  buildCancelRefundBps: 5000, scrapRefundBps: 4000,
  npcBatchQuantity: 10, npcIronBatchGP: 6, npcStockFloor: 40, npcGPFloor: 200,
  frontierStoredBatchCap: 16, frontierIronDustPerBatch: 20, frontierHullPlatePerBatch: 4,
});
const ASSUMPTIONS = Object.freeze({ days: 30, initialPlayers: 40, newPlayersPerDay: 1, declinePerDay: 0, bots: 0, activeBps: 8000,
  initialGP: 200, initialPP: '0', miningCapacity: 2, miningHours: 4, mineBps: 6000, missionBps: 3000,
  craftBps: 1200, buildBps: 800, cancelBps: 2000, scrapBps: 1500, tradeBps: 4000, guildContributionBps: 1000,
  frontierProductionBps: 1500, warLossBps: 0, policyChangeDay: 0, miningRateAfterChange: 3, resourceDropBps: 4500, maxResourceDropQty: 5,
  whale: false, npcMode: 'one_time_seed', npcDailyListingAttempts: 4, npcLifetimeIronBudget: 400, npcLifetimeGPBudget: 200,
  stableDepositPerCustomer: 20, stablePurchasePerCustomer: 2, custodyLockedBps: 0, withdrawBps: 2000, timeoutFirstWithdrawal: false, reorgStress: false,
});
const SCENARIOS = Object.freeze([
  { name: 'baseline', overrides: {} },
  { name: 'zero_growth_no_pay', overrides: { newPlayersPerDay: 0, stablePurchasePerCustomer: 0 } },
  { name: 'player_decline', overrides: { newPlayersPerDay: 0, declinePerDay: 1 } },
  { name: 'whale_concentration', overrides: { newPlayersPerDay: 0, whale: true } },
  { name: 'bot_farming', overrides: { newPlayersPerDay: 0, bots: 40 } },
  { name: 'low_liquidity', overrides: { newPlayersPerDay: 0, tradeBps: 500, custodyLockedBps: 9000, withdrawBps: 10000 } },
  { name: 'mass_withdrawals', overrides: { newPlayersPerDay: 0, withdrawBps: 10000, timeoutFirstWithdrawal: true } },
  { name: 'long_peace', overrides: { days: 90, newPlayersPerDay: 0, craftBps: 0, buildBps: 0, scrapBps: 0, warLossBps: 0 } },
  { name: 'major_war', overrides: { newPlayersPerDay: 0, warLossBps: 2000, buildBps: 6000, craftBps: 4000, tradeBps: 7000 } },
  { name: 'reorg_funding', overrides: { newPlayersPerDay: 0, reorgStress: true } },
  { name: 'policy_change', overrides: { newPlayersPerDay: 0, policyChangeDay: 15, miningRateAfterChange: 1 } },
  { name: 'npc_budget_exhaustion', overrides: { newPlayersPerDay: 0, days: 90, npcMode: 'one_time_seed' } },
]);
function validateParams(p) {
  for (const [key, value] of Object.entries(p)) if (typeof value === 'number') positiveInteger(value, key, key.endsWith('Bps') ? 10000 : 1000000);
  if (p.days < 1 || p.days > 365 || p.initialPlayers < 1 || p.initialPlayers + p.days * p.newPlayersPerDay + p.bots > 1000 || p.miningHours > 24 || p.maxResourceDropQty < 1) throw Error('SCENARIO_TOO_LARGE_OR_INVALID');
  if (!['legacy_refill', 'finite_budget', 'one_time_seed', 'disabled'].includes(p.npcMode)) throw Error('INVALID_NPC_MODE');
  units(p.initialPP);
}
function trade(ledger, { id, seller, buyer, asset, quantity, price, currency = 'GP', listingFee = units(POLICY.listingGP) }) {
  if (seller === buyer || quantity <= 0n || price <= 0n || listingFee < 0n || !['GP', 'PP'].includes(currency) || !asset.startsWith('resource:')) throw Error('INVALID_TRADE');
  const fee = price * BigInt(POLICY.saleFeeBps) / 10000n;
  const referral = fee * BigInt(POLICY.referralFeeShareBps) / 10000n;
  const dividend = fee * BigInt(POLICY.dividendFeeShareBps) / 10000n;
  // Fixed share accounts make fee carving auditable. No full-fee double allocation.
  const legs = [{ account: buyer, asset: currency, delta: -price }, { account: seller, asset: currency, delta: price - fee },
    { account: 'referral_pool', asset: currency, delta: referral }, { account: 'dividend_pool', asset: currency, delta: dividend },
    { account: '@burn', asset: currency, delta: fee - referral - dividend },
    { account: seller, asset: 'GP', delta: -listingFee }, { account: '@burn', asset: 'GP', delta: listingFee },
    { account: seller, asset, delta: -quantity }, { account: buyer, asset, delta: quantity }].filter(l => l.delta !== 0n);
  // Precheck buyer funding before seller credit (seller/buyer cannot be identical).
  if (ledger.balance(buyer, currency) < price || ledger.balance(seller, 'GP') < listingFee || ledger.balance(seller, asset) < quantity) throw Error('INSUFFICIENT_BALANCE');
  ledger.post({ id, actor: 'engine', kind: 'transform', reason: 'marketplace_fee_carve', legs });
  return { fee, referral, dividend };
}
function craft(ledger, { id, user, success, refundBps = POLICY.craftFailureRefundBps }) {
  positiveInteger(refundBps, 'REFUND_BPS', 10000);
  const cost = units(POLICY.craftGP); const refund = success ? 0n : cost * BigInt(refundBps) / 10000n;
  if (ledger.balance(user, 'GP') < cost || ledger.balance(user, 'resource:iron_ore') < 5n || ledger.balance(user, 'resource:silicon_chip') < 3n) throw Error('INSUFFICIENT_BALANCE');
  const legs = [{ account: user, asset: 'GP', delta: -(cost - refund) }, { account: '@burn', asset: 'GP', delta: cost - refund },
    { account: user, asset: 'resource:iron_ore', delta: -5n }, { account: '@burn', asset: 'resource:iron_ore', delta: 5n },
    { account: user, asset: 'resource:silicon_chip', delta: -3n }, { account: '@burn', asset: 'resource:silicon_chip', delta: 3n }];
  if (success) legs.push({ account: '@issuer', asset: 'item:energy_shield', delta: -1n }, { account: user, asset: 'item:energy_shield', delta: 1n });
  ledger.post({ id, actor: 'engine', kind: 'transform', reason: success ? 'craft_success' : 'craft_failure_net_of_refund', legs: legs.filter(l => l.delta) });
  return { paid: cost, refunded: refund, burned: cost - refund };
}
function build(ledger, id, user, outcome) {
  if (!['cancel', 'failure', 'complete'].includes(outcome)) throw Error('INVALID_BUILD_OUTCOME');
  const escrow = 'build_escrow:' + id; const basket = { GP: units(POLICY.hullBuildGP), 'resource:iron_ore': 5n, 'resource:carbon_fiber': 3n };
  for (const [asset, amount] of Object.entries(basket)) if (ledger.balance(user, asset) < amount) throw Error('INSUFFICIENT_BALANCE');
  ledger.post({ id: id + ':pay', actor: user, legs: Object.entries(basket).flatMap(([asset, amount]) => [{ account: user, asset, delta: -amount }, { account: escrow, asset, delta: amount }]), reason: 'build_escrow' });
  const refundBps = outcome === 'cancel' ? POLICY.buildCancelRefundBps : outcome === 'failure' ? 10000 : 0;
  const legs = [];
  for (const [asset, amount] of Object.entries(basket)) {
    // Code floors whole GP and material cancellation refunds.
    const refund = asset === 'GP' ? amount / SCALE * BigInt(refundBps) / 10000n * SCALE : amount * BigInt(refundBps) / 10000n;
    legs.push({ account: escrow, asset, delta: -amount });
    if (refund) legs.push({ account: user, asset, delta: refund });
    if (amount > refund) legs.push({ account: outcome === 'complete' && asset !== 'GP' ? 'embodied:' + user : '@burn', asset, delta: amount - refund });
  }
  if (outcome === 'complete') legs.push({ account: '@issuer', asset: 'ship:ordinary', delta: -1n }, { account: user, asset: 'ship:ordinary', delta: 1n });
  ledger.post({ id: id + ':settle', actor: 'engine', kind: 'transform', legs, reason: 'build_' + outcome });
}
function repairCost(healHP) {
  positiveInteger(healHP, 'HEAL_HP', POLICY.hullHP);
  const gp = BigInt(Math.min(Math.ceil(healHP * 3 / 100), Math.floor(POLICY.hullBuildGP * 60 / 100))) * SCALE;
  const iron = BigInt(Math.min(Math.ceil(healHP / 50), Math.max(1, Math.ceil(POLICY.hullIron * 60 * healHP / (100 * POLICY.hullHP)))));
  return { gp, iron };
}
function attempt(fn, counters) { try { return fn(); } catch (e) { if (e.message !== 'INSUFFICIENT_BALANCE') throw e; counters.insufficientGameplayFunds++; return null; } }

function runScenario({ name = 'custom', seed = 20261021, overrides = {}, policyOverrides = {} } = {}) {
  const p = { ...ASSUMPTIONS, ...overrides }; validateParams(p);
  const policy = { ...POLICY, ...policyOverrides };
  // Only a missing-setting sensitivity is allowed to override the reward/cap profile.
  for (const key of Object.keys(policyOverrides)) if (!['miningGPPerCapacityHour', 'miningCapGPPer24h'].includes(key)) throw Error('UNSUPPORTED_POLICY_OVERRIDE');
  positiveInteger(policy.miningGPPerCapacityHour, 'MINING_RATE'); positiveInteger(policy.miningCapGPPer24h, 'MINING_CAP');
  const random = rng(seed); const orderedEventRefs = [];
  const observe = book => event => orderedEventRefs.push({ sequence: orderedEventRefs.length + 1, book, bookSequence: event.sequence, id: event.id, virtualTime: event.virtualTime, policyVersion: event.policyVersion });
  const ledger = new Ledger(observe('game')); const custody = new Custody(observe('custody')); const users = [];
  const counters = { trades: 0, humanTrades: 0, npcTrades: 0, unfilledOrders: 0, craftSuccess: 0, craftFailure: 0, builds: 0, buildCancellations: 0, scraps: 0, warLosses: 0, salvageTransfers: 0, salvageBudgetRejected: 0, miningRuns: 0, insufficientGameplayFunds: 0, withdrawalAccepted: 0, withdrawalCompleted: 0, withdrawalUnknown: 0, withdrawalRejected: 0, npcBudgetExhausted: 0 };
  const transactions = []; const daily = []; let id = 0; let npcIronBudget = BigInt(p.npcLifetimeIronBudget); let npcGPBudget = units(p.npcLifetimeGPBudget);
  let marketBatchPrice = units(POLICY.npcIronBatchGP); let npcSeeded = false;
  function grant(user, day, bot = false) {
    const u = { id: user, joined: day, bot, hp: POLICY.hullHP, retired: false }; users.push(u);
    ledger.issue('opening:' + user, user, 'GP', units(p.initialGP), 'opening_assumed_existing_balance');
    ledger.issue('opening-pp:' + user, user, 'PP', units(p.initialPP), 'opening_assumed_existing_balance_no_cash_claim');
    for (const [asset, amount] of Object.entries({ 'ship:ordinary': 1n, 'claim:territory': 1n, 'resource:iron_ore': 10n, 'resource:carbon_fiber': 5n, 'resource:silicon_chip': 3n })) ledger.issue('initial:' + asset + ':' + user, user, asset, amount, 'opening_assumed_existing_inventory');
    for (const [asset, amount] of Object.entries({ 'resource:iron_ore': 5n, 'resource:carbon_fiber': 3n })) ledger.issue('opening-embodied:' + asset + ':' + user, 'embodied:' + user, asset, amount, 'opening_assumed_ship_embodied_material');
    // Finance stress is a separate hypothetical population, initialized once; no player growth revenue.
    if (day === 0 && !bot) for (const asset of CUSTODY_ASSETS) {
      custody.apply({ id: 'deposit:' + asset + ':' + user, actor: 'verified_funding', kind: 'deposit', asset, user, amount: units(p.stableDepositPerCustomer) });
      if (p.stablePurchasePerCustomer) { custody.apply({ id: 'purchase:' + asset + ':' + user, actor: user, kind: 'spend', asset, user, amount: units(p.stablePurchasePerCustomer) }); ledger.issue('access-credit:' + asset + ':' + user, user, 'credit:nonrefundable', units(p.stablePurchasePerCustomer), 'hypothetical_funded_purchase_nonrefundable_access_credit_not_GP_PP'); }
    }
    return u;
  }
  for (let i = 0; i < p.initialPlayers; i++) grant('player:' + i, 0);
  for (let i = 0; i < p.bots; i++) grant('bot:' + i, 0, true);
  if (p.whale) {
    for (const u of users.slice(1)) ledger.transfer('wealth-concentrate:' + u.id, u.id, users[0].id, 'GP', ledger.balance(u.id, 'GP') * 9n / 10n, u.id, 'assumed_opening_concentration_same_total_GP');
  }
  const openingPlayerGP = users.reduce((sum, u) => sum + ledger.balance(u.id, 'GP'), 0n);
  const openingTopGP = users.reduce((top, u) => ledger.balance(u.id, 'GP') > top ? ledger.balance(u.id, 'GP') : top, 0n);
  const fundingStress = {};
  for (let day = 1; day <= p.days; day++) {
    ledger.setTime(VIRTUAL_EPOCH + day * 86400000); custody.setTime(VIRTUAL_EPOCH + day * 86400000);
    if (p.policyChangeDay === day) { policy.miningGPPerCapacityHour = p.miningRateAfterChange; ledger.changePolicy('policy_operator', POLICY_VERSION + '-hypothetical-rate-change'); }
    for (let j = 0; j < p.newPlayersPerDay; j++) grant('entrant:' + day + ':' + j, day);
    if (day > 1 && p.declinePerDay) for (const u of users.filter(u => !u.retired && !u.bot).slice(-p.declinePerDay)) u.retired = true;
    const salvageDailyUsed = new Map();
    let active = 0; const beforeTrades = counters.trades;
    for (const u of users) {
      if (u.retired || (!u.bot && random() * 10000 >= p.activeBps)) continue;
      active++;
      const age = day - u.joined; const cycleDay = Math.max(0, age - 1) % 7;
      let login = POLICY.loginGP[cycleDay]; let ppEquivalent = cycleDay === 6 ? units(POLICY.loginDay7EquivalentPP) * 10n : 0n;
      if (age > 7 && cycleDay === 0) { login = Math.floor(8 * 0.6) + Math.floor(random() * (Math.floor(8 * 1.5) - Math.floor(8 * 0.6) + 1)); ppEquivalent = BigInt(Math.floor(random() * 3)) * 10n * SCALE; }
      ledger.issue('login:' + day + ':' + u.id, u.id, 'GP', units(login) + ppEquivalent, 'login_PP_equivalent_paid_in_GP');
      if (cycleDay === 2 || cycleDay === 6) ledger.issue('streak:' + day + ':' + u.id, u.id, 'GP', units(cycleDay === 2 ? POLICY.streak3GP : POLICY.streak7GP), 'streak_assumed_unbroken');
      if (age === 1) ledger.issue('onboard:' + u.id, u.id, 'GP', units(POLICY.onboardingGP) + units(POLICY.onboardingPPEquivalent) * 10n, 'assumed_completed_onboarding');
      if (random() * 10000 < (u.bot ? 1000 : p.missionBps)) ledger.issue('missions:' + day + ':' + u.id, u.id, 'GP', units(POLICY.missionGP + POLICY.missionAllBonusGP), 'assumed_three_valid_missions_completed_plus_bonus');
      // Ordinary frontier 4h runs; bot runs6 times/day with capacity20 as a stated stress assumption.
      const runs = ledger.balance(u.id, 'ship:ordinary') < 1n ? 0 : u.bot ? 6 : random() * 10000 < p.mineBps ? 1 : 0; let mined = 0n;
      for (let run = 0; run < runs; run++) {
        const wearHP = Math.round(POLICY.hullHP * POLICY.miningWearBpsPerHour / 10000 * p.miningHours);
        if (u.hp < Math.ceil(POLICY.hullHP * 0.15) || u.hp - wearHP < POLICY.hullHP / 2) {
          const cost = repairCost(POLICY.hullHP - u.hp);
          const repaired = attempt(() => {
            if (ledger.balance(u.id, 'GP') < cost.gp || ledger.balance(u.id, 'resource:iron_ore') < cost.iron) throw Error('INSUFFICIENT_BALANCE');
            ledger.post({ id: 'repair:' + day + ':' + run + ':' + u.id, actor: 'engine', kind: 'burn', reason: 'ordinary_hull_repair', legs: [{ account: u.id, asset: 'GP', delta: -cost.gp }, { account: '@burn', asset: 'GP', delta: cost.gp }, { account: u.id, asset: 'resource:iron_ore', delta: -cost.iron }, { account: '@burn', asset: 'resource:iron_ore', delta: cost.iron }].filter(l => l.delta) }); return true;
          }, counters);
          if (!repaired) break; u.hp = POLICY.hullHP;
        }
        let reward = units((u.bot ? 20 : p.miningCapacity) * p.miningHours * policy.miningGPPerCapacityHour);
        const cap = units(policy.miningCapGPPer24h); if (cap > 0n && reward > cap - mined) reward = cap - mined;
        if (reward < 0n) reward = 0n;
        ledger.issue('mining:' + day + ':' + run + ':' + u.id, u.id, 'GP', reward, 'ship_mining'); mined += reward; counters.miningRuns++; u.hp = Math.max(1, u.hp - wearHP);
        // Proxy drop distribution is an assumption, not the DB sector_resource_rates table.
        for (const resource of ['iron_ore', 'carbon_fiber', 'silicon_chip']) if (random() * 10000 < p.resourceDropBps) ledger.issue('drop:' + day + ':' + run + ':' + u.id + ':' + resource, u.id, 'resource:' + resource, BigInt(1 + Math.floor(random() * p.maxResourceDropQty)), 'assumed_resource_drop_proxy');
      }
      // Territory claim harvest: assumed0.1 PP-equivalent net of limits/multipliers, GP credited only.
      const harvestGP = units('0.1') * 10n; ledger.issue('harvest:' + day + ':' + u.id, u.id, 'GP', harvestGP, 'territory_harvest_assumed_net_PP_equivalent');
      ledger.transfer('guild:' + day + ':' + u.id, u.id, 'guild_treasury', 'GP', harvestGP * BigInt(p.guildContributionBps) / (10000n * SCALE) * SCALE, u.id, 'guild_contribution_transfer_not_sink');
      if (!u.bot && random() * 10000 < p.frontierProductionBps) {
        ledger.issue('frontier-iron:' + day + ':' + u.id, 'frontier-stock:' + u.id, 'resource:iron_dust', BigInt(16 * 20), 'frontier_assumed_one_full_stored_batch_collection');
        ledger.issue('frontier-plate:' + day + ':' + u.id, 'frontier-stock:' + u.id, 'resource:hull_plate', BigInt(16 * 4), 'frontier_assumed_one_full_stored_batch_collection');
      }
      if (!u.bot && random() * 10000 < p.craftBps) { const success = random() * 10000 < POLICY.craftSuccessBps; const result = attempt(() => craft(ledger, { id: 'craft:' + day + ':' + u.id, user: u.id, success }), counters); if (result) counters[success ? 'craftSuccess' : 'craftFailure']++; }
      if (!u.bot && random() * 10000 < p.buildBps) { const outcome = random() * 10000 < p.cancelBps ? 'cancel' : 'complete'; if (attempt(() => { build(ledger, 'build:' + day + ':' + u.id, u.id, outcome); return true; }, counters)) counters[outcome === 'cancel' ? 'buildCancellations' : 'builds']++; }
      if (!u.bot && ledger.balance(u.id, 'ship:ordinary') > 1n && random() * 10000 < p.scrapBps) {
        const legs = [{ account: u.id, asset: 'ship:ordinary', delta: -1n }, { account: '@burn', asset: 'ship:ordinary', delta: 1n }];
        const gpRefund = units(Math.floor(POLICY.hullBuildGP * 0.4)); legs.push({ account: '@issuer', asset: 'GP', delta: -gpRefund }, { account: u.id, asset: 'GP', delta: gpRefund });
        for (const [asset, original] of Object.entries({ 'resource:iron_ore': 5n, 'resource:carbon_fiber': 3n })) { const returned = original * 40n / 100n; legs.push({ account: 'embodied:' + u.id, asset, delta: -original }, { account: u.id, asset, delta: returned }, { account: '@burn', asset, delta: original - returned }); }
        ledger.post({ id: 'scrap:' + day + ':' + u.id, actor: 'engine', kind: 'transform', reason: 'scrap_partial_historical_cost_refund', legs }); counters.scraps++;
      }
      if (p.warLossBps && ledger.balance(u.id, 'ship:ordinary') > 0n && random() * 10000 < p.warLossBps) {
        const opponent = users.find(v => v.id !== u.id && !v.retired && !v.bot);
        if (opponent) {
          const wreck = 'wreck:' + day + ':' + u.id; const legs = [{ account: u.id, asset: 'ship:ordinary', delta: -1n }, { account: '@burn', asset: 'ship:ordinary', delta: 1n }];
          for (const [asset, original] of Object.entries({ 'resource:iron_ore': 5n, 'resource:carbon_fiber': 3n })) legs.push({ account: 'embodied:' + u.id, asset, delta: -original }, { account: '@burn', asset, delta: original });
          // Actual buildWreckResources(60GP,0mods) yields1iron_dust, no repairore.
          // Authorize/record the derived wreck material exactlyonce at loss; the claim is a transfer.
          legs.push({ account: '@issuer', asset: 'resource:iron_dust', delta: -1n }, { account: wreck, asset: 'resource:iron_dust', delta: 1n });
          ledger.post({ id: wreck + ':loss', actor: 'engine', kind: 'transform', reason: 'war_hull_loss_and_source_wreck_derivative_material', legs });
          counters.warLosses++;
          const used = salvageDailyUsed.get(opponent.id) || 0;
          if (used < 240) { ledger.transfer(wreck + ':salvage', wreck, opponent.id, 'resource:iron_dust', 1n, 'engine', 'salvage_recovered_part_transfer_no_issuance'); salvageDailyUsed.set(opponent.id, used + 1); counters.salvageTransfers++; } else counters.salvageBudgetRejected++;
        }
      }
    }
    // Sell-side proxy, explicit finite actual buyers, no artificial volume credit.
    for (const seller of users.filter(u => !u.retired && !u.bot)) {
      if (random() * 10000 >= p.tradeBps) continue;
      const buyers = users.filter(u => !u.retired && !u.bot && u.id !== seller.id);
      if (!buyers.length) continue; const buyer = buyers[Math.floor(random() * buyers.length)];
      const result = attempt(() => trade(ledger, { id: 'trade:' + (++id), seller: seller.id, buyer: buyer.id, asset: 'resource:iron_ore', quantity: 10n, price: marketBatchPrice }), counters);
      if (result) { counters.trades++; counters.humanTrades++; transactions.push({ day, seller: seller.id, buyer: buyer.id, asset: 'resource:iron_ore', quantity: 10, priceMicroGP: marketBatchPrice.toString(), npc: false }); } else counters.unfilledOrders++;
    }
    if (p.npcMode !== 'disabled') for (let n = 0; n < p.npcDailyListingAttempts; n++) {
      const offer = p.npcMode === 'finite_budget' ? { code: 'iron_ore', price: 6 } : [{ code: 'iron_ore', price: 6 }, { code: 'carbon_fiber', price: 10 }, { code: 'silicon_chip', price: 14 }, { code: 'titanium_alloy', price: 28 }, { code: 'plasma_crystal', price: 36 }][Math.floor(random() * 5)];
      let iron = 40n - ledger.balance('npc', 'resource:iron_ore'); let gp = units(200) - ledger.balance('npc', 'GP'); if (iron < 0n) iron = 0n; if (gp < 0n) gp = 0n;
      if (p.npcMode === 'one_time_seed' && npcSeeded) { iron = 0n; gp = 0n; }
      if (p.npcMode === 'finite_budget') { if (iron > npcIronBudget) iron = npcIronBudget; if (gp > npcGPBudget) gp = npcGPBudget; npcIronBudget -= iron; npcGPBudget -= gp; }
      ledger.issue('npc-iron:' + day + ':' + n, 'npc', 'resource:iron_ore', iron, p.npcMode === 'one_time_seed' ? 'npc_one_time_seed' : 'npc_stock_refill'); ledger.issue('npc-gp:' + day + ':' + n, 'npc', 'GP', gp, p.npcMode === 'one_time_seed' ? 'npc_one_time_seed' : 'npc_fee_balance_refill');
      if ((p.npcMode === 'one_time_seed' && !npcSeeded) || p.npcMode === 'legacy_refill') for (const resource of ['carbon_fiber', 'silicon_chip', 'titanium_alloy', 'plasma_crystal']) ledger.issue('npc-seed:' + day + ':' + n + ':' + resource, 'npc', 'resource:' + resource, 40n - ledger.balance('npc', 'resource:' + resource), p.npcMode === 'one_time_seed' ? 'npc_one_time_seed' : 'npc_stock_refill');
      if (p.npcMode === 'one_time_seed') npcSeeded = true;
      const buyers = users.filter(u => !u.retired && !u.bot); if (!buyers.length) break; const buyer = buyers[Math.floor(random() * buyers.length)];
      const result = attempt(() => trade(ledger, { id: 'npc-trade:' + (++id), seller: 'npc', buyer: buyer.id, asset: 'resource:' + offer.code, quantity: 10n, price: units(offer.price) }), counters);
      if (result) { npcSeeded = true; counters.trades++; counters.npcTrades++; transactions.push({ day, seller: 'npc', buyer: buyer.id, asset: 'resource:' + offer.code, quantity: 10, priceMicroGP: units(offer.price).toString(), npc: true }); }
      else { counters.unfilledOrders++; if ((p.npcMode === 'finite_budget' && npcIronBudget === 0n) || (p.npcMode === 'one_time_seed' && npcSeeded)) counters.npcBudgetExhausted++; }
    }
    // Hypothetical price response, integer micro-GP, no purchased token appreciation.
    const dayTrades = counters.trades - beforeTrades;
    marketBatchPrice = dayTrades < active / 4 ? marketBatchPrice * 99n / 100n : marketBatchPrice * 101n / 100n;
    if (marketBatchPrice < units(1)) marketBatchPrice = units(1);
    const audit = ledger.audit(); daily.push({ day, active, registered: users.length, retired: users.filter(u => u.retired).length, trades: dayTrades, nextHumanBatchAskMicroGP: marketBatchPrice.toString(), gpOutstandingMicro: audit.GP.held, gpBurnedMicro: audit.GP.burned, gpIssuedMicro: audit.GP.issued, ironOreAvailable: users.filter(u => !u.retired).reduce((s, u) => s + ledger.balance(u.id, 'resource:iron_ore'), 0n).toString(), activeAccountsWithoutRepairIron: users.filter(u => !u.retired && ledger.balance(u.id, 'resource:iron_ore') < 1n).length });
  }
  if (p.reorgStress) {
    custody.observeFunding({ id: 'hypothetical-reorg-event', asset: 'USDG', user: users[0].id, amount: units(100) });
    try { custody.requestWithdrawal({ id: 'unconfirmed-funded-payout', actor: users[0].id, user: users[0].id, asset: 'USDG', amount: custody.claim(users[0].id, 'USDG') + units(100) }); } catch (e) { fundingStress.unconfirmedWithdrawalRejected = e.message; }
    custody.reconcileFunding('hypothetical-reorg-event', false, 'verified_funding'); fundingStress.reorgedMicroUSDG = units(100).toString();
  }
  for (const asset of CUSTODY_ASSETS) {
    const claims = custody.liabilities(asset);
    const locked = claims * BigInt(p.custodyLockedBps) / 10000n;
    if (locked) custody.apply({ id: 'lock:' + asset, actor: 'custody_operator', kind: 'lock', asset, amount: locked });
    for (const u of users.filter(u => u.joined === 0 && !u.bot)) {
      const amount = custody.claim(u.id, asset) * BigInt(p.withdrawBps) / 10000n; if (!amount) continue;
      try { const requestId = 'withdraw:' + asset + ':' + u.id; custody.requestWithdrawal({ id: requestId, actor: u.id, asset, user: u.id, amount }); if (p.timeoutFirstWithdrawal && u.id === 'player:0') { custody.timeoutWithdrawal(requestId); counters.withdrawalUnknown++; } else { custody.reconcileWithdrawal({ id: 'settle:' + requestId, requestId, actor: 'verified_settlement', confirmed: true }); counters.withdrawalCompleted++; } counters.withdrawalAccepted++; }
      catch (e) { if (!['ILLIQUID', 'INSOLVENT', 'UNFUNDED_WITHDRAWAL'].includes(e.message)) throw e; counters.withdrawalRejected++; }
    }
  }
  const audit = ledger.audit(); const stablecoins = custody.audit();
  const wealth = users.map(u => ({ user: u.id, bot: u.bot, retired: u.retired, gpMicro: ledger.balance(u.id, 'GP').toString(), ppMicro: ledger.balance(u.id, 'PP').toString(), ships: ledger.balance(u.id, 'ship:ordinary').toString(), territories: ledger.balance(u.id, 'claim:territory').toString() })).sort((a, b) => BigInt(a.gpMicro) === BigInt(b.gpMicro) ? a.user.localeCompare(b.user) : BigInt(a.gpMicro) > BigInt(b.gpMicro) ? -1 : 1);
  const totalGP = wealth.reduce((s, u) => s + BigInt(u.gpMicro), 0n); const botGP = wealth.filter(u => u.bot).reduce((s, u) => s + BigInt(u.gpMicro), 0n);
  const issuerReasons = {}; for (const e of ledger.events) for (const l of e.legs) if (l.account === '@issuer') { const key = e.reason + '|' + l.asset; issuerReasons[key] = ((BigInt(issuerReasons[key] || 0)) - l.delta).toString(); }
  const sinkReasons = {}; for (const e of ledger.events) for (const l of e.legs) if (l.account === '@burn') { const key = e.reason + '|' + l.asset; sinkReasons[key] = (BigInt(sinkReasons[key] || 0) + l.delta).toString(); }
  const availableOre = users.filter(u => !u.retired).reduce((sum, u) => sum + ledger.balance(u.id, 'resource:iron_ore'), 0n);
  const averageOre = daily.reduce((sum, d) => sum + BigInt(d.ironOreAvailable), 0n) / BigInt(daily.length);
  const volume = transactions.reduce((s, t) => s + BigInt(t.priceMicroGP), 0n); const quantity = BigInt(transactions.filter(t => t.asset === 'resource:iron_ore').reduce((s, t) => s + t.quantity, 0));
  const ironVolume = transactions.filter(t => t.asset === 'resource:iron_ore').reduce((sum, t) => sum + BigInt(t.priceMicroGP), 0n);
  const risks = [
    { code: 'MODEL_NOT_RUNTIME', severity: 'boundary', detail: 'Seeded model assertions are not DB/API/concurrent production verification or demand/retention evidence.' },
    { code: 'NPC_REFILL_UNCAPPED', severity: p.npcMode === 'legacy_refill' ? 'risk' : 'comparison', detail: 'Legacy ensureNpcStock floors may issue again each invocation. Current one-time-seed variant never replenishes after its first seed. Historical NPC migration eligibility is not inferred from this synthetic freshNPC.' },
    { code: 'MINING_CAP_PER_WALLET_NOT_PERSON', severity: 'risk', detail: 'Seed profile1500 GP/rolling24h is per wallet. Identity/Sybil operating policy is not established by this model.' },
    { code: 'LEGACY_MISSING_MINING_SETTINGS_UNCAPPED', severity: policy.miningCapGPPer24h === 0 ? 'legacy_sensitivity' : 'resolved_in_source', detail: 'Current service fallback matches authored3/1500. Legacy5/0 sensitivity is separately executed; explicit operator cap0 remains an uncapped policy decision.' },
    { code: 'CONDITIONAL_MARKET_MISSION_SUBSIDY', severity: 'review', detail: 'Assigned market mission15 GP exceeds modeled5 GP listing+0.3 GP fee for a6 GP trade. Does not prove infinite profit: daily assignment/completion/eligibility apply; market trade alone must not be treated as cash revenue.' },
    { code: 'RESOURCE_PRICE_IS_ASSUMPTION', severity: 'boundary', detail: 'Adaptive asks and drop probabilities are behavior assumptions; no demand elasticity or real clearing price is estimated.' },
  ];
  if (ratio(BigInt(wealth[0].gpMicro), totalGP) > 25 || ratio(openingTopGP, openingPlayerGP) > 25) risks.push({ code: 'WEALTH_CONCENTRATION', severity: 'risk', detail: 'Largest player holds more than25% of player GP at opening or end (illustrative threshold).' });
  if (botGP > totalGP / 2n) risks.push({ code: 'BOT_MAJORITY_GP', severity: 'risk', detail: 'Hypothetical bots hold more than50% of player GP.' });
  if (counters.withdrawalRejected) risks.push({ code: 'WITHDRAWAL_LIQUIDITY_SHORTFALL', severity: 'risk', detail: 'Funded customer claims remain outstanding; rejected requests do not erase liabilities.' });
  if (Object.values(stablecoins).some(a => a.insolvency)) risks.push({ code: 'INSOLVENCY', severity: 'risk', detail: 'Reserve below customer claims; business revenue excluded from customer reserve.' });
  if (counters.humanTrades < p.days) risks.push({ code: 'THIN_PLAYER_MARKET', severity: 'risk', detail: 'Fewer thanone completed human trade/day on average; NPC volume is reported separately.' });
  return { name, seed, policyVersion: POLICY_VERSION, virtualEpoch: new Date(VIRTUAL_EPOCH).toISOString(), virtualEnd: new Date(VIRTUAL_EPOCH + p.days * 86400000).toISOString(), units: { GP: 'integer microGP', PP: 'integer microPP', stablecoins: 'integer microtoken per distinct asset', resources: 'integer items; iron_dust and iron_ore are different assets' }, parameters: p, policy, counters, conservation: audit, issuanceBySource: issuerReasons, burnBySource: sinkReasons, stablecoins, fundingStress, wealth: { openingTop1SharePct: ratio(openingTopGP, openingPlayerGP), top1SharePct: ratio(BigInt(wealth[0].gpMicro), totalGP), top10SharePct: ratio(wealth.slice(0, Math.max(1, Math.ceil(wealth.length / 10))).reduce((s, u) => s + BigInt(u.gpMicro), 0n), totalGP), botSharePct: ratio(botGP, totalGP), accounts: wealth }, materialAccessibility: { activeAccountsWithoutRepairIron: daily.at(-1).activeAccountsWithoutRepairIron, availableIronOre: availableOre.toString(), averageDailyAvailableIronOre: averageOre.toString(), ironOreTradedToAverageInventoryBps: averageOre ? (quantity * 10000n / averageOre).toString() : null, distinction: 'Warehouse iron_dust does not satisfy ordinary iron_ore repair. No inferred conversion.' }, market: { manipulationExcludedTrades: 0, manipulationMetricBoundary: 'Synthetic distinct actors; real common-control detection not modeled. NPC trades always separated.', volumeMicroGP: volume.toString(), quantity: quantity.toString(), vwapMicroGPPerIronOre: quantity ? (ironVolume / quantity).toString() : null, lastHumanBatchAskMicroGP: marketBatchPrice.toString(), minBatchPriceAcrossResourcesMicroGP: transactions.length ? transactions.reduce((v, t) => BigInt(t.priceMicroGP) < v ? BigInt(t.priceMicroGP) : v, BigInt(transactions[0].priceMicroGP)).toString() : null, maxBatchPriceAcrossResourcesMicroGP: transactions.length ? transactions.reduce((v, t) => BigInt(t.priceMicroGP) > v ? BigInt(t.priceMicroGP) : v, 0n).toString() : null, trades: transactions }, accounts: ledger.snapshot(), daily, risks, orderedEventRefs, events: ledger.events.map(e => ({ ...e, legs: e.legs.map(l => ({ ...l, delta: l.delta.toString() })) })), custodyEvents: custody.events, eventCount: ledger.events.length, ledgerSHA256: crypto.createHash('sha256').update(JSON.stringify(ledger.events, (_, v) => typeof v === 'bigint' ? v.toString() : v)).digest('hex') };
}
function sourceManifest() { return SOURCE_PATHS.map(file => ({ path: file, sha256: crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT, file))).digest('hex') })); }
// Sequential auction contract model; actual DB races are verified by separate service tests.
class ModelAuction {
  constructor(ledger, { id, seller, asset, quantity = 1n }) {
    if (!id || !seller || !asset || quantity <= 0n || ledger.balance(seller, asset) < quantity || ledger.balance(seller, 'GP') < units(5)) throw Error('INVALID_AUCTION');
    this.ledger = ledger; this.id = id; this.seller = seller; this.asset = asset; this.quantity = quantity; this.status = 'active'; this.bidder = null; this.bid = 0n;
    ledger.post({ id: id + ':list', actor: 'engine', kind: 'burn', reason: 'auction_listing', legs: [{ account: seller, asset: 'GP', delta: -units(5) }, { account: '@burn', asset: 'GP', delta: units(5) }, { account: seller, asset, delta: -quantity }, { account: 'auction_asset:' + id, asset, delta: quantity }] });
  }
  placeBid(user, amount, eventId) {
    if (this.status !== 'active') throw Error('AUCTION_CLOSED');
    if (user === this.seller || user === this.bidder) throw Error('MANIPULATION_EXCLUDED');
    if (amount <= this.bid || amount <= 0n || this.ledger.balance(user, 'GP') < amount) throw Error('UNFUNDED_BID');
    const legs = [{ account: user, asset: 'GP', delta: -amount }, { account: 'auction_bid:' + this.id, asset: 'GP', delta: amount }];
    if (this.bidder) legs.push({ account: 'auction_bid:' + this.id, asset: 'GP', delta: -this.bid }, { account: this.bidder, asset: 'GP', delta: this.bid });
    this.ledger.post({ id: eventId, actor: 'engine', reason: 'auction_bid_escrow_and_previous_refund', legs }); this.bid = amount; this.bidder = user;
  }
  close(eventId) {
    if (this.status !== 'active') throw Error('AUCTION_CLOSED');
    const legs = [{ account: 'auction_asset:' + this.id, asset: this.asset, delta: -this.quantity }, { account: this.bidder || this.seller, asset: this.asset, delta: this.quantity }];
    if (this.bidder) {
      const fee = (this.bid / SCALE * 5n / 100n > 1n ? this.bid / SCALE * 5n / 100n : 1n) * SCALE;
      if (this.bid < fee) throw Error('INVALID_AUCTION_FEE');
      legs.push({ account: 'auction_bid:' + this.id, asset: 'GP', delta: -this.bid }, { account: this.seller, asset: 'GP', delta: this.bid - fee }, { account: 'auction_fee_treasury', asset: 'GP', delta: fee });
    }
    this.ledger.post({ id: eventId, actor: 'engine', reason: this.bidder ? 'auction_filled_funded_treasury_fee' : 'auction_expired_asset_return', legs: legs.filter(l => l.delta) }); this.status = this.bidder ? 'filled' : 'expired';
  }
}
function auctionProbes() {
  const l = new Ledger(); for (const user of ['seller', 'buyer1', 'buyer2']) l.issue('opening:' + user, user, 'GP', units(100), 'probe_opening');
  l.issue('claim', 'seller', 'claim:territory', 2n, 'probe_owned_nonNFT_claims');
  const a = new ModelAuction(l, { id: 'filled', seller: 'seller', asset: 'claim:territory' }); let excluded = 0; let rejected = 0;
  try { a.placeBid('seller', units(20), 'self'); } catch (e) { if (e.message !== 'MANIPULATION_EXCLUDED') throw e; excluded++; }
  try { a.placeBid('buyer1', units(101), 'unfunded'); } catch (e) { if (e.message !== 'UNFUNDED_BID') throw e; rejected++; }
  a.placeBid('buyer1', units(20), 'bid1'); a.placeBid('buyer2', units(25), 'bid2'); a.close('settlement');
  let duplicateRejected; try { a.close('settlement-again'); } catch (e) { duplicateRejected = e.message; }
  const expired = new ModelAuction(l, { id: 'expired', seller: 'seller', asset: 'claim:territory' }); expired.close('expire');
  return { filled: 1, expiredWithoutBid: 1, unfundedBidsRejected: rejected, manipulationExcludedTrades: excluded, duplicateRejected, previousBidRefundMicroGP: l.balance('buyer1', 'GP').toString(), auctionFeeTreasuryMicroGP: l.balance('auction_fee_treasury', 'GP').toString(), conservation: l.audit(), accounts: l.snapshot(), boundary: 'Sequential local contract model only; auction service concurrency/reward carve behavior is tested separately.' };
}
function stressProbes() {
  const c = new Custody(); c.observeFunding({ id: 'reorg-funding', user: 'customer', asset: 'USDC', amount: units(100) });
  let provisionalRejected; try { c.requestWithdrawal({ id: 'unconfirmed-spend', actor: 'customer', user: 'customer', asset: 'USDC', amount: units(1) }); } catch (e) { provisionalRejected = e.message; }
  c.reconcileFunding('reorg-funding', false, 'verified_funding');
  c.observeFunding({ id: 'final-funding', user: 'customer', asset: 'USDC', amount: units(100) }); c.reconcileFunding('final-funding', true, 'verified_funding');
  c.requestWithdrawal({ id: 'pending-20', actor: 'customer', user: 'customer', asset: 'USDC', amount: units(20) }); c.timeoutWithdrawal('pending-20');
  const afterTimeout = c.audit(); let timeoutDoubleSpendRejected;
  try { c.requestWithdrawal({ id: 'overlapping-90', actor: 'customer', user: 'customer', asset: 'USDC', amount: units(90) }); } catch (e) { timeoutDoubleSpendRejected = e.message; }
  c.reconcileWithdrawal({ id: 'confirmed-20', requestId: 'pending-20', actor: 'verified_settlement', confirmed: true });
  c.apply({ id: 'hypothetical-custody-loss', actor: 'custody_operator', kind: 'loss', asset: 'USDC', amount: units(1) }); let insolvencyRejected;
  try { c.requestWithdrawal({ id: 'insolvent-withdraw', actor: 'customer', user: 'customer', asset: 'USDC', amount: units(1) }); } catch (e) { insolvencyRejected = e.message; }
  return { auctionSettlement: auctionProbes(), reorgAndTimeout: { provisionalRejected, timeoutDoubleSpendRejected, afterTimeout, afterReconciliationAndHypotheticalLoss: c.audit(), insolvencyRejected, interpretation: 'Hypothetical1USDC loss produces true insolvency and blocks payout; no liability is canceled to hide it.' } };
}
function runSuite(seed = 20261021) {
  return { schema: 'occupy-economy-scenarios-v1', seed, conclusion: 'Offline development model completed. Outcomes are assumptions/sensitivities, not predictions or redeemability promises.', sources: sourceManifest(), stressProbes: stressProbes(), scenarios: SCENARIOS.map(s => runScenario({ ...s, seed })), comparisons: [runScenario({ name: 'legacy_npc_refill', seed, overrides: { newPlayersPerDay: 0, npcMode: 'legacy_refill' } }), runScenario({ name: 'zero_growth_finite_npc_budget', seed, overrides: { newPlayersPerDay: 0, npcMode: 'finite_budget' } }), runScenario({ name: 'legacy_bot_missing_mining_settings', seed, overrides: { newPlayersPerDay: 0, bots: 40 }, policyOverrides: { miningGPPerCapacityHour: 5, miningCapGPPer24h: 0 } })] };
}
function markdown(report) {
  const lines = ['# Offline economy scenario evidence', '', 'Seed: ' + report.seed + '. Amounts are exact integer micro units internally; displayed GP is decimal GP. Baseline/new entries are behavior assumptions, never business income. No real accounts, balances, networks, DB or keys were used.', '', '| Scenario | GP issued | GP burned | Human/NPC trades | Top1 GP | Bot GP | Accepted/rejected withdrawals |', '|---|---:|---:|---:|---:|---:|---:|'];
  for (const s of [...report.scenarios, ...report.comparisons]) lines.push(`| ${s.name} | ${decimal(BigInt(s.conservation.GP.issued))} | ${decimal(BigInt(s.conservation.GP.burned))} | ${s.counters.humanTrades}/${s.counters.npcTrades} | ${s.wealth.top1SharePct}% | ${s.wealth.botSharePct}% | ${s.counters.withdrawalAccepted}/${s.counters.withdrawalRejected} |`);
  lines.push('', 'All reported conservation errors must be0. Custody USDC, USDT and USDG are separate, fully funded hypothetical customer claims; GP/PP issue no stablecoin claim. Purchases reduce a customer liability and move exactly that funded cash into business revenue; deposits are liabilities, never income. Low liquidity moves reserves to locked custody and retains unpaid claims. Mass requests are funded without new deposits; one timed-out request per asset remains unknown and fully reserved until reconciliation.', '', 'The default NPC variant uses the current one-time seed (200GP plus40each of5resources forone synthetic newNPC); legacy refill and alternative iron-only finitebudgets are separately labeled sensitivities. Neither report is a live balance-policy change.', '', 'See `docs/ECONOMY_MODEL_2026-10-21.md` for source/default precedence, coverage, missing policies and limitations. Full JSON includes every source hash, parameter, daily trace, asset inventory, trade, issuance source and reserve reconciliation.', '');
  return lines.join('\n');
}
function dashboard(report) {
  const data = JSON.stringify(report).replaceAll('<', '\\u003c');
  return `<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Occupy Mars economy scenarios</title><style>body{margin:24px auto;padding:0 20px;max-width:1300px;background:#111821;color:#e2ecf5;font:15px/1.6 system-ui}h1{font-size:28px}p{max-width:950px;color:#b8c8d6}table{width:100%;border-collapse:collapse;font-variant-numeric:tabular-nums}th,td{padding:9px;text-align:right;border-bottom:1px solid #36404b}th:first-child,td:first-child{text-align:left}select{background:#233347;color:inherit;padding:10px;max-width:100%;font:inherit;border:1px solid #678}pre{white-space:pre-wrap;overflow-wrap:anywhere;padding:16px;background:#172431;border-radius:8px}.scroll{overflow:auto}svg{width:100%;height:180px;background:#172431}.grid{display:grid;grid-template-columns:1fr 1fr;gap:20px}@media(max-width:750px){.grid{grid-template-columns:1fr}body{padding:0 12px}}a{color:#7dd3fc}</style><body><h1>Occupy Mars · 경제 시나리오</h1><p>고정 seed ${report.seed} · 가상 시간 · 정수 원장. 행동 가정으로 실행한 로컬 모델입니다. GP/PP 현금 교환권, 실제 수요, 운영 준비 완료를 뜻하지 않습니다. 예치금은 고객 부채이며 수익이 아닙니다.</p><div class="scroll"><table><thead><tr><th>Scenario</th><th>발행 GP</th><th>실제 소각 GP</th><th>인간/NPC 거래</th><th>상위1 GP</th><th>출금 승인/거부</th></tr></thead><tbody id="rows"></tbody></table></div><h2>시나리오 상세</h2><label for="scenario">선택 </label><select id="scenario"></select><p>아래 그래프는 일별 GP 잔액입니다. 토큰 시세나 매출 예측이 아닙니다.</p><svg viewBox="0 0 1000 180" role="img" aria-label="Daily outstanding GP"><polyline id="line" fill="none" stroke="#58d7bd" stroke-width="3"/></svg><div class="grid"><section><h3>재료 · 거래 · 집중도</h3><pre id="game"></pre></section><section><h3>자산별 준비금 · 고객 청구권 · 출금 예약</h3><pre id="cash"></pre></section></div><details><summary>가정 · 정책 · 위험</summary><pre id="params"></pre></details><details><summary>소스 해시 · 재현 정보</summary><pre id="sources"></pre></details><p><a href="economy-scenarios.json">전체 JSON</a> · <a href="economy-events.jsonl">순서가 고정된 이벤트 원장</a> · <a href="economy-scenarios.md">Markdown</a></p><script>const data=${data};const all=[...data.scenarios,...data.comparisons];const money=v=>{const n=BigInt(v);return (n/1000000n).toString()+'.'+(n%1000000n).toString().padStart(6,'0')};const rows=document.getElementById('rows'), select=document.getElementById('scenario');for(const s of all){const tr=document.createElement('tr');for(const v of [s.name,money(s.conservation.GP.issued),money(s.conservation.GP.burned),s.counters.humanTrades+'/'+s.counters.npcTrades,s.wealth.top1SharePct+'%',s.counters.withdrawalAccepted+'/'+s.counters.withdrawalRejected]){const td=document.createElement('td');td.textContent=v;tr.append(td)}rows.append(tr);const o=document.createElement('option');o.textContent=s.name;select.append(o)}function render(){const s=all[select.selectedIndex];document.getElementById('game').textContent=JSON.stringify({materialAccessibility:s.materialAccessibility,counters:s.counters,market:{...s.market,trades:s.market.trades.length+' records in JSON'},wealth:{openingTop1SharePct:s.wealth.openingTop1SharePct,top1SharePct:s.wealth.top1SharePct,top10SharePct:s.wealth.top10SharePct,botSharePct:s.wealth.botSharePct}},null,2);document.getElementById('cash').textContent=JSON.stringify(s.stablecoins,null,2);document.getElementById('params').textContent=JSON.stringify({parameters:s.parameters,policy:s.policy,risks:s.risks,fundingStress:s.fundingStress},null,2);const max=Math.max(...s.daily.map(d=>Number(d.gpOutstandingMicro)));document.getElementById('line').setAttribute('points',s.daily.map((d,i)=>(i*980/Math.max(1,s.daily.length-1)+10)+','+(170-Number(d.gpOutstandingMicro)/Math.max(1,max)*160)).join(' '))}select.addEventListener('change',render);document.getElementById('sources').textContent=JSON.stringify({seed:data.seed,eventLog:data.eventLog,sources:data.sources,stressProbes:data.stressProbes},null,2);render();</script></body></html>\n`;
}
if (require.main === module) {
  const args = process.argv.slice(2); let output; let seed = 20261021;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--out' && args[i + 1]) output = path.resolve(args[++i]);
    else if (args[i] === '--seed' && args[i + 1]) seed = Number(args[++i]);
    else throw Error('Usage: node server/tools/economy_scenario_simulation.js [--seed integer] [--out directory]');
  }
  const report = runSuite(seed);
  if (output) {
    fs.mkdirSync(output, { recursive: true }); const md = markdown(report);
    const eventPath = path.join(output, 'economy-events.jsonl'); const fd = fs.openSync(eventPath, 'w'); const hash = crypto.createHash('sha256'); let count = 0;
    function stripEvents(s) {
      for (const ref of s.orderedEventRefs) {
        const event = ref.book === 'game' ? s.events[ref.bookSequence - 1] : s.custodyEvents[ref.bookSequence - 1];
        const line = JSON.stringify({ scenario: s.name, scenarioSequence: ref.sequence, book: ref.book, ...event }) + '\n';
        fs.writeSync(fd, line); hash.update(line); count++;
      }
      const { events, custodyEvents, orderedEventRefs, ...summary } = s; return summary;
    }
    const summary = { ...report, scenarios: report.scenarios.map(stripEvents), comparisons: report.comparisons.map(stripEvents) };
    fs.closeSync(fd); summary.eventLog = { file: 'economy-events.jsonl', records: count, sha256: hash.digest('hex'), ordering: 'Per scenario, actual cross-ledger execution order; scenarioSequence is strictly increasing. No wallclock input.' };
    fs.writeFileSync(path.join(output, 'economy-scenarios.json'), JSON.stringify(summary, null, 2) + '\n');
    fs.writeFileSync(path.join(output, 'economy-scenarios.md'), md);
    fs.writeFileSync(path.join(output, 'economy-scenarios.html'), dashboard(summary));
    process.stdout.write(markdown(report));
  } else process.stdout.write(JSON.stringify(report, null, 2) + '\n');
}
module.exports = { SCALE, POLICY_VERSION, CUSTODY_ASSETS, units, decimal, Ledger, Custody, POLICY, ASSUMPTIONS, SCENARIOS, trade, craft, build, repairCost, runScenario, runSuite, stressProbes, ModelAuction, auctionProbes, sourceManifest, markdown, dashboard };
