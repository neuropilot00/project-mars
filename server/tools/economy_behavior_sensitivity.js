#!/usr/bin/env node
'use strict';
// Offline sensitivity driver. Accounting/formula reuse is explicit; this is not an API replay.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { performance } = require('node:perf_hooks');
const { Ledger, Custody, POLICY, SCALE, units, craft, repairCost, stressProbes } = require('./economy_scenario_simulation');
const EPOCH = Date.parse('2026-10-21T00:00:00Z');
const HOUR = 3600000;
const VERSION = 'behavior-sensitivity-2026-10-21-v1';
const RESOURCES = ['iron_ore', 'carbon_fiber', 'silicon_chip'];
const ASSET = code => 'resource:' + code;
const PRICES = { iron_ore: units('0.6'), carbon_fiber: units(1), silicon_chip: units('1.4'), 'item:energy_shield': units(70) };
const ROLE_RULES = Object.freeze({
  miner:   { mine: 90, craft: 3, build: 5, offer: 85, bid: 55, fight: 5, harvest: 60, useShield: 5 },
  crafter: { mine: 35, craft: 70, build: 5, offer: 75, bid: 85, fight: 5, harvest: 60, useShield: 5 },
  builder: { mine: 45, craft: 5, build: 60, offer: 50, bid: 90, fight: 10, harvest: 60, useShield: 5 },
  trader:  { mine: 25, craft: 10, build: 5, offer: 90, bid: 90, fight: 5, harvest: 50, useShield: 10 },
  casual:  { mine: 25, craft: 10, build: 5, offer: 30, bid: 40, fight: 10, harvest: 60, useShield: 30 },
  fighter: { mine: 50, craft: 10, build: 30, offer: 35, bid: 75, fight: 70, harvest: 60, useShield: 70 },
});
const DEFAULTS = Object.freeze({ days: 112, accounts: 48, stepHours: 6, orderHours: 120, frequency: 'medium',
  decline: false, bots: 0, whale: 'none', peace: false, war: false, buyerShortage: false, withdrawals: false,
  purchases: true, highSpend: false, roleMix: null, openingGP: 200, openingHulls: 2, openingOre: 20, openingCarbon: 10, openingSilicon: 6,
  buildSeconds: 1500, miningHours: 4, maxFleetHulls: 4, maxActiveOrders: 3, tradeLot: 5,
  rates: { iron_ore: 0.50, carbon_fiber: 0.30, silicon_chip: 0.20 }, dropMax: 10,
  resourceJobBuffs: false, weeklyChallenges: true, dividends: true,
});
const PROFILES = Object.freeze([
  { name: 'mixed_low', frequency: 'low' }, { name: 'mixed_medium' },
  { name: 'miner_heavy', roleMix: { miner:24, crafter:6, builder:6, trader:6, casual:6, fighter:0 } },
  { name: 'fighter_builder_heavy', roleMix: { miner:4, crafter:4, builder:16, trader:4, casual:4, fighter:16 } },
  { name: 'high_consumption', frequency: 'high', highSpend: true },
  { name: 'zero_entrants_no_purchases', purchases: false }, { name: 'player_decline', decline: true },
  { name: 'bots_matched_capital', bots: 8 }, { name: 'whale_hoard', whale: 'hoard' }, { name: 'whale_dump', whale: 'dump' },
  { name: 'long_peace', peace: true }, { name: 'war_resource_blockade', war: true },
  { name: 'buyer_shortage', buyerShortage: true }, { name: 'withdrawal_run_unknown', purchases: false, withdrawals: true },
]);
function random(seed) { let n = seed >>> 0; return () => { n = (Math.imul(n, 1664525) + 1013904223) >>> 0; return n / 4294967296; }; }
function gp(value) { return Number(value) / 1000000; }
function pct(a, b) { return b ? Number(a * 10000n / b) / 100 : 0; }
function fleetRepairQuote(hp, participatingHulls) { const quote = repairCost(Math.max(1, POLICY.hullHP - hp)); return { gp: quote.gp * BigInt(participatingHulls), iron: quote.iron * BigInt(participatingHulls) }; }
function hash(value) { return crypto.createHash('sha256').update(value).digest('hex'); }
function weekAt(time) { const d = new Date(time); return Math.floor((time - ((d.getUTCDay() + 6) % 7) * 86400000) / (7 * 86400000)); }
function validate(p) {
  if (!Number.isSafeInteger(p.days) || p.days < 1 || p.days > 120 || !Number.isSafeInteger(p.accounts) || p.accounts < 2 || p.accounts > 48 || ![6].includes(p.stepHours) || !['low', 'medium', 'high'].includes(p.frequency)) throw Error('INVALID_BOUNDED_PARAMETERS');
  if (p.roleMix && (Object.values(p.roleMix).reduce((sum,n)=>sum+n,0)!==p.accounts || Object.entries(p.roleMix).some(([role,n])=>!ROLE_RULES[role]||!Number.isSafeInteger(n)||n<0))) throw Error('INVALID_ROLE_MIX');
  if (!Number.isSafeInteger(p.bots) || p.bots < 0 || p.bots > p.accounts || !['none', 'hoard', 'dump'].includes(p.whale)) throw Error('INVALID_ROLE_PARAMETERS');
}

class OrderBook {
  constructor({ ledger, ownerOf, issueId, metrics, onFill }) { Object.assign(this, { ledger, ownerOf, issueId, metrics, onFill }); this.orders = []; this.trades = []; }
  live(user, side, asset) { return this.orders.filter(o => o.status === 'open' && o.user === user && (!side || o.side === side) && (!asset || o.asset === asset)); }
  place({ user, controller, side, asset, quantity, limit, now, expires, npc = false }) {
    if (!['bid', 'ask'].includes(side) || !Number.isSafeInteger(quantity) || quantity < 1 || typeof limit !== 'bigint' || limit <= 0n || expires <= now) throw Error('INVALID_ORDER');
    const escrow = 'order:' + this.issueId(); const fee = side === 'ask' ? units(POLICY.listingGP) : 0n;
    const required = side === 'ask' ? BigInt(quantity) : BigInt(quantity) * limit;
    if (this.ledger.balance(user, side === 'ask' ? asset : 'GP') < required || (fee && this.ledger.balance(user, 'GP') < fee)) { this.metrics.fundingDenials++; return null; }
    this.ownerOf.set(escrow, user);
    const legs = [{ account: user, asset: side === 'ask' ? asset : 'GP', delta: -required }, { account: escrow, asset: side === 'ask' ? asset : 'GP', delta: required }];
    if (fee) legs.push({ account: user, asset: 'GP', delta: -fee }, { account: '@burn', asset: 'GP', delta: fee });
    this.ledger.post({ id: this.issueId(), actor: 'engine', kind: fee ? 'burn' : 'transfer', legs, reason: 'order_registration_and_funded_escrow' });
    const order = { id: escrow, user, controller, side, asset, remaining: quantity, original: quantity, limit, created: now, expires, npc, status: 'open', filled: 0 };
    this.orders.push(order); this.metrics[side === 'bid' ? 'fundedBidOrders' : 'fundedAskOrders']++; return order;
  }
  release(o, reason = 'order_expiry') {
    if (o.status !== 'open') return;
    const asset = o.side === 'bid' ? 'GP' : o.asset; const amount = this.ledger.balance(o.id, asset);
    if (amount) this.ledger.transfer(this.issueId(), o.id, o.user, asset, amount, 'engine', reason);
    o.status = reason === 'order_expiry' ? 'expired' : 'closed'; if (o.remaining) { this.metrics.expiredOrders++; if (!o.filled) this.metrics.unfilledExpiredOrders++; }
  }
  expire(now) { for (const o of this.orders) if (o.status === 'open' && o.expires <= now) this.release(o); this.orders = this.orders.filter(o => o.status === 'open'); }
  match(now) {
    this.expire(now);
    for (const asset of [...RESOURCES.map(ASSET), 'item:energy_shield']) {
      const asks = this.orders.filter(o => o.status === 'open' && o.side === 'ask' && o.asset === asset).sort((a, b) => a.limit === b.limit ? a.created - b.created : a.limit < b.limit ? -1 : 1);
      const bids = this.orders.filter(o => o.status === 'open' && o.side === 'bid' && o.asset === asset).sort((a, b) => a.limit === b.limit ? a.created - b.created : a.limit > b.limit ? -1 : 1);
      for (const bid of bids) for (const ask of asks) {
        if (bid.status !== 'open' || ask.status !== 'open' || bid.limit < ask.limit) continue;
        if (bid.controller === ask.controller) { this.metrics.commonControlMatchesExcluded++; continue; }
        const quantity = Math.min(bid.remaining, ask.remaining); const price = ask.limit * BigInt(quantity); const fee = price * 500n / 10000n;
        const referral = 0n; // No eligible referral tree is assumed;25% is a base ceiling, not paid allocation.
        const dividend = fee * 2000n / 10000n;
        this.ledger.post({ id: this.issueId(), actor: 'engine', kind: 'transform', reason: 'funded_market_settlement', legs: [
          { account: bid.id, asset: 'GP', delta: -price }, { account: ask.user, asset: 'GP', delta: price - fee },
          { account: 'referral_pool', asset: 'GP', delta: referral }, { account: 'dividend_pool', asset: 'GP', delta: dividend }, { account: '@burn', asset: 'GP', delta: fee - referral - dividend },
          { account: ask.id, asset, delta: -BigInt(quantity) }, { account: bid.user, asset, delta: BigInt(quantity) },
        ].filter(l => l.delta) });
        bid.remaining -= quantity; ask.remaining -= quantity; bid.filled += quantity; ask.filled += quantity;
        this.metrics.trades++; this.metrics[ask.npc ? 'npcTrades' : 'humanTrades']++;
        const t = { time: now, asset, quantity, unit: ask.limit, amount: price, npc: ask.npc, seller: ask.user, buyer: bid.user };
        this.trades.push(t); this.onFill(t);
        for (const o of [ask, bid]) if (o.remaining === 0) { this.release(o, 'order_filled'); this.metrics.filledOrders++; }
      }
    }
  }
  closeAll() { for (const o of this.orders) this.release(o, 'end_of_horizon_return'); }
  askQuantity(asset) { return this.orders.filter(o => o.status === 'open' && o.side === 'ask' && o.asset === asset).reduce((s, o) => s + o.remaining, 0); }
  cheapest(asset) { const prices = this.orders.filter(o => o.status === 'open' && o.side === 'ask' && o.asset === asset).map(o => o.limit); return prices.length ? prices.reduce((a, b) => a < b ? a : b) : null; }
}

function runCase(profile, seed, options = {}) {
  const p = { ...DEFAULTS, ...profile, ...options }; validate(p); const rnd = random(seed); let serial = 0; const id = () => 'behavior:' + (++serial);
  const ownerOf = new Map(); const people = []; const users = new Map(); const jobs = []; const daily = []; const roleStats = {};
  const resourceOutstanding = new Map();
  const flows = { opening: 0n, issuance: 0n, burn: 0n, transfers: 0n, sources: {} }; let opening = true;
  const metrics = { trades: 0, humanTrades: 0, npcTrades: 0, fundedBidOrders: 0, fundedAskOrders: 0, filledOrders: 0, expiredOrders: 0, unfilledExpiredOrders: 0, fundingDenials: 0, commonControlMatchesExcluded: 0, priceRefusals: 0, buildStarted: 0, buildCompleted: 0, buildPendingEnd: 0, buildFailedFunding: 0, miningCompleted: 0, repairCompleted: 0, repairBlockedSteps: 0, warLosses: 0, craftSuccess: 0, craftFailure: 0, highSpendAttempts: 0, highSpendCompleted: 0, highSpendDenied: 0, gachaSpendGP: 0, gachaAttempts: 0, gachaDenied: 0, shieldUnitsPurchased: 0, custodyDenied: 0, withdrawalRequested: 0, withdrawalCompleted: 0, withdrawalUnknown: 0 };
  function stat(role) { return roleStats[role] ||= { accounts: 0, openingGP: 0n, faucetsGP: 0n, marketNetGP: 0n, consumedGP: 0n, otherTransfersGP: 0n, endingGP: 0n, oreConsumed: 0n, carbonConsumed: 0n, siliconConsumed: 0n, actions: 0 }; }
  const ledger = new Ledger(e => {
    const issued = e.legs.filter(l => l.account === '@issuer' && l.asset === 'GP').reduce((s, l) => s - l.delta, 0n);
    const burned = e.legs.filter(l => l.account === '@burn' && l.asset === 'GP').reduce((s, l) => s + l.delta, 0n);
    if (opening) flows.opening += issued; else { flows.issuance += issued; flows.sources[e.reason] = (flows.sources[e.reason] || 0n) + issued; }
    flows.burn += burned;
    const ownerNet = new Map();
    for (const l of e.legs) {
      if (l.asset.startsWith('resource:') && (l.account === '@issuer' || l.account === '@burn')) resourceOutstanding.set(l.asset, (resourceOutstanding.get(l.asset) || 0n) - l.delta);
      if (l.asset === 'GP' && !l.account.startsWith('@')) { const owner = ownerOf.get(l.account) || l.account; ownerNet.set(owner, (ownerNet.get(owner) || 0n) + l.delta); }
    }
    if (!issued) flows.transfers += [...ownerNet.values()].filter(n => n > 0n).reduce((s, n) => s + n, 0n);
    const byOwner = new Map();
    for (const l of e.legs) if (l.asset === 'GP') { const owner = ownerOf.get(l.account) || l.account; if (users.has(owner)) byOwner.set(owner, (byOwner.get(owner) || 0n) + l.delta); }
    for (const [owner, delta] of byOwner) {
      const s = stat(users.get(owner).role); if (opening) s.openingGP += delta;
      else if (issued) s.faucetsGP += delta;
      else if (e.reason === 'funded_market_settlement') s.marketNetGP += delta;
      else if (burned && delta < 0n) s.consumedGP -= delta;
      else s.otherTransfersGP += delta;
    }
  });
  const custody = new Custody();
  const book = new OrderBook({ ledger, ownerOf, issueId: id, metrics, onFill: t => {
    const buyer = users.get(t.buyer); if (buyer) completeMission(buyer, 'marketplace_trade');
  } });
  function issue(user, asset, amount, reason) { ledger.issue(id(), user, asset, amount, reason); }
  function consume(user, asset, amount, reason) { ledger.burn(id(), user, asset, amount, reason); }
  function quoteFor(u) { return fleetRepairQuote(u.hp, Math.min(p.maxFleetHulls, u.hulls)); }
  function available(user, asset) { return ledger.balance(user.id || user, asset); }
  function can(user, gpCost, materials = {}) { return available(user, 'GP') >= gpCost && Object.entries(materials).every(([a, n]) => available(user, a) >= BigInt(n)); }
  function burnBasket(user, gpCost, materials, reason) {
    if (!can(user, gpCost, materials)) return false;
    const basket = { GP: gpCost, ...Object.fromEntries(Object.entries(materials).map(([a, q]) => [a, BigInt(q)])) };
    const legs = Object.entries(basket).filter(([, q]) => q).flatMap(([asset, amount]) => {
      const reserve = reason === 'ordinary_ship_repair' && asset === 'GP' ? amount / 5n : 0n;
      return [{ account: user.id, asset, delta: -amount }, { account: '@burn', asset, delta: amount - reserve }, ...(reserve ? [{ account: 'victory_slot_pool', asset, delta: reserve }] : [])];
    });
    ledger.post({ id: id(), actor: 'engine', kind: 'burn', reason, legs });
    const s = stat(user.role); s.oreConsumed += BigInt(materials[ASSET('iron_ore')] || 0); s.carbonConsumed += BigInt(materials[ASSET('carbon_fiber')] || 0); s.siliconConsumed += BigInt(materials[ASSET('silicon_chip')] || 0); return true;
  }
  const missionDefs = [{ type: 'harvest', reward: 10 }, { type: 'marketplace_trade', reward: 15 }, { type: 'build_ship', reward: 25 }, { type: 'claim_pixels', reward: 15 }, { type: 'hijack', reward: 25 }, { type: 'equip_cosmetic', reward: 10 }, { type: 'enhance_item', reward: 20 }, { type: 'win_naval_battle', reward: 40 }];
  function completeMission(u, type) { const m = u.missions?.find(m => m.type === type); if (!m || m.paid) return; m.progress++; if (m.progress >= m.target) { issue(u.id, 'GP', units(m.reward), 'qualified_daily_mission'); m.paid = true; if (u.missions.every(m => m.paid)) issue(u.id, 'GP', units(50), 'qualified_all_missions_bonus'); } }
  function login(u, day) {
    if (u.lastLogin === day) return;
    u.streak = u.lastLogin != null && day - u.lastLogin <= 2 ? u.streak % 7 + 1 : 1; const reset = u.lastLogin != null && u.streak === 1 && day - u.lastLogin <= 2; u.lastLogin = day;
    let reward = POLICY.loginGP[u.streak - 1]; let ppGP = u.streak === 7 ? units(1) : 0n;
    if (reset) { reward = 4 + Math.floor(rnd() * 9); ppGP = units(Math.floor(rnd() * 3) * 10); }
    issue(u.id, 'GP', units(reward) + ppGP, 'login_GP_including_PP_equivalent');
    if (u.streak === 3 || u.streak === 7) issue(u.id, 'GP', units(u.streak === 3 ? 30 : 150), 'streak_milestone');
    const shuffled = missionDefs.map(d => ({ ...d, sort: rnd() })).sort((a, b) => a.sort - b.sort).slice(0, 3);
    u.missions = shuffled.map(m => ({ ...m, progress: 0, paid: false, target: m.type === 'build_ship' ? 1 + Math.floor(rnd() * 2) : m.type === 'claim_pixels' ? 3 : 1 }));
  }
  const roles = Object.keys(ROLE_RULES); const allocatedRoles = p.roleMix ? roles.flatMap(role=>Array(p.roleMix[role]||0).fill(role)) : null;
  for (let i = 0; i < p.accounts; i++) {
    const bot = i >= p.accounts - p.bots; const role = bot ? 'bot' : allocatedRoles ? allocatedRoles[i] : roles[i % roles.length]; const u = { id: 'p' + i, controller: bot ? 'bot-controller:0' : 'controller:' + i, role, bot, hp: POLICY.hullHP, hulls: p.openingHulls, mining: false, building: false, retired: false, streak: 0, lastLogin: null, week: null, harvests: 0, kills: 0, weeklyPaid: new Set(), stockout: 0, longestStockout: 0, mineHistory: [], shipShield: 0, harvestDay: null, harvestedToday: 0 };
    people.push(u); users.set(u.id, u); stat(role).accounts++;
    issue(u.id, 'GP', units(p.openingGP), 'opening_existing_capital'); issue(u.id, 'ship:ordinary', BigInt(p.openingHulls), 'opening_existing_fleet');
    for (const [r, q] of Object.entries({ iron_ore: p.openingOre, carbon_fiber: p.openingCarbon, silicon_chip: p.openingSilicon })) issue(u.id, ASSET(r), BigInt(q), 'opening_existing_inventory');
    custody.apply({ id: id(), actor: 'verified_funding', kind: 'deposit', asset: 'USDT', user: u.id, amount: units(20) });
  }
  if (p.whale !== 'none') for (const u of people.slice(1)) for (const a of ['GP', ...RESOURCES.map(ASSET)]) { const amount = available(u, a) * 9n / 10n; if (amount) ledger.transfer(id(), u.id, people[0].id, a, amount, u.id, 'opening_concentration_transfer_same_aggregate'); }
  const openingGP = flows.opening; const openingPlayersGP = people.reduce((s, u) => s + available(u, 'GP'), 0n);
  const openingTop1 = people.reduce((s, u) => available(u, 'GP') > s ? available(u, 'GP') : s, 0n);
  // Finite seed only, one fresh synthetic NPC. No new NPC identities or periodic replenishment.
  opening = false; issue('npc', 'GP', units(200), 'finite_NPC_seed'); for (const r of [...RESOURCES, 'titanium_alloy', 'plasma_crystal']) issue('npc', ASSET(r), 40n, 'finite_NPC_seed');
  const miningDaily = new Map(); let noAskHours = 0; let longestNoAskHours = 0; let globalOreZeroHours = 0; let longestGlobalOreZeroHours = 0; let now = EPOCH;
  function schedule(job) { jobs.push(job); jobs.sort((a, b) => a.due - b.due); }
  function finishJobs(until) {
    while (jobs.length && jobs[0].due <= until) {
      const job = jobs.shift(); ledger.setTime(job.due); custody.setTime(job.due); const u = job.user;
      if (job.type === 'build') {
        const legs = [];
        for (const [asset, amount] of Object.entries(job.basket)) legs.push({ account: job.escrow, asset, delta: -amount }, { account: '@burn', asset, delta: amount });
        legs.push({ account: '@issuer', asset: 'ship:ordinary', delta: -1n }, { account: u.id, asset: 'ship:ordinary', delta: 1n });
        ledger.post({ id: id(), actor: 'engine', kind: 'transform', reason: 'delayed_build_complete', legs }); const oldFleet = Math.min(p.maxFleetHulls, u.hulls); if (oldFleet < p.maxFleetHulls) u.hp = Math.round((u.hp * oldFleet + POLICY.hullHP) / (oldFleet + 1)); u.hulls++; u.building = false; metrics.buildCompleted++; completeMission(u, 'build_ship');
      } else if (job.type === 'mine') {
        u.mineHistory = u.mineHistory.filter(r => r.time > job.due - 24 * HOUR); const used = u.mineHistory.reduce((s, r) => s + r.gp, 0n); const raw = units(job.capacity * p.miningHours * 3); const room = units(1500) - used; const reward = raw < room ? raw : room > 0n ? room : 0n;
        issue(u.id, 'GP', reward, 'ship_mining_new_issuance'); u.mineHistory.push({ time: job.due, gp: reward }); u.hp = Math.max(1, u.hp - Math.round(POLICY.hullHP * .02 * p.miningHours));
        const rolls = Math.max(1, Math.round(job.capacity / 2 * (p.miningHours / 4)));
        for (let roll = 0; roll < rolls; roll++) for (const r of RESOURCES) if (rnd() < p.rates[r] * job.supplyFactor) issue(u.id, ASSET(r), BigInt(1 + Math.floor(rnd() * p.dropMax)), 'source_frontier_resource_roll_proxy_no_job_buff');
        u.mining = false; metrics.miningCompleted++;
      } else if (job.type === 'withdraw') { custody.reconcileWithdrawal({ id: id(), requestId: job.requestId, actor: 'verified_settlement', confirmed: true }); metrics.withdrawalCompleted++; }
    }
    ledger.setTime(until); custody.setTime(until);
  }
  function offer(u, asset, quantity, mult, time, npc = false) {
    if (book.live(u.id || u, 'ask', asset).length || book.live(u.id || u).length >= p.maxActiveOrders) return;
    const ref = PRICES[asset.startsWith('resource:') ? asset.slice(9) : asset]; const limit = ref * BigInt(Math.round(mult * 1000)) / 1000n;
    book.place({ user: u.id || u, controller: u.controller || 'NPC', side: 'ask', asset, quantity, limit: limit > 0n ? limit : 1n, now: time, expires: time + p.orderHours * HOUR, npc });
  }
  function bid(u, asset, quantity, mult, time) {
    if (book.live(u.id, 'bid', asset).length || book.live(u.id).length >= p.maxActiveOrders) return;
    const ref = PRICES[asset.startsWith('resource:') ? asset.slice(9) : asset]; const limit = ref * BigInt(Math.round(mult * 1000)) / 1000n;
    const ask = book.cheapest(asset); if (ask != null && ask > limit) metrics.priceRefusals++;
    book.place({ user: u.id, controller: u.controller, side: 'bid', asset, quantity, limit, now: time, expires: time + p.orderHours * HOUR });
  }
  const totalSteps = p.days * 24 / p.stepHours; const freq = { low: .25, medium: .60, high: .95 }[p.frequency];
  const checkpoint = options.checkpoint || (() => {});
  for (let step = 0; step < totalSteps; step++) {
    checkpoint(); now = EPOCH + step * p.stepHours * HOUR; finishJobs(now); book.expire(now);
    const day = Math.floor(step / 4); const week = weekAt(now); const warActive = p.war && day >= 28 && day < 84 && ((now - (EPOCH + 28 * 24 * HOUR)) % (120 * HOUR) < 72 * HOUR); const blocked = p.war && day >= 42 && day < 70;
    if (p.decline && day >= 28) for (const u of people.slice(Math.max(12, p.accounts - Math.floor((day - 28) / 3)))) u.retired = true;
    for (const u of people) {
      u.shipShield = Math.floor(u.shipShield * Math.pow(.97, p.stepHours));
      if (u.retired || rnd() >= (u.bot ? 1 : freq)) continue;
      login(u, day); stat(u.role).actions++;
      if (u.week !== week) { u.week = week; u.harvests = 0; u.kills = 0; u.weeklyPaid = new Set(); }
      const rule = u.bot ? { ...ROLE_RULES.miner, mine: 100, craft: 0, build: 0, harvest: 100, offer: 90, bid: 70 } : ROLE_RULES[u.role]; const chance = field => rnd() * 100 < rule[field];
      if (u.harvestDay !== day) { u.harvestDay = day; u.harvestedToday = 0; }
      if (chance('harvest') && u.harvestedToday < 3) { u.harvestedToday++; issue(u.id, 'GP', units(1), 'territory_harvest_assumed_net_0.1PP_equivalent'); u.harvests++; completeMission(u, 'harvest'); }
      if (p.weeklyChallenges && u.harvests >= 20 && !u.weeklyPaid.has('harvest')) { issue(u.id, 'GP', units(400), 'qualified_weekly_harvest_direct_GP_issuance'); u.weeklyPaid.add('harvest'); }
      if (!u.mining && u.hulls > 0 && chance('mine')) {
        if (u.hp < POLICY.hullHP * .5) {
          const cost = quoteFor(u);
          if (burnBasket(u, cost.gp, { [ASSET('iron_ore')]: Number(cost.iron) }, 'ordinary_ship_repair')) { u.hp = POLICY.hullHP; metrics.repairCompleted++; }
          else metrics.repairBlockedSteps++;
        }
        if (u.hp >= POLICY.hullHP * .15) { u.mining = true; schedule({ type: 'mine', due: now + p.miningHours * HOUR, user: u, capacity: Math.min(p.maxFleetHulls, u.hulls), supplyFactor: blocked ? .1 : 1 }); }
      }
      if (!u.mining && chance('craft') && can(u, units(50), { [ASSET('iron_ore')]: 5, [ASSET('silicon_chip')]: 3 })) {
        const success = rnd() < .8; craft(ledger, { id: id(), user: u.id, success }); metrics[success ? 'craftSuccess' : 'craftFailure']++;
        stat(u.role).oreConsumed += 5n; stat(u.role).siliconConsumed += 3n;
      }
      if (!u.building && chance('build') && u.hulls < (warActive ? 6 : 4)) {
        const basket = { GP: units(60), [ASSET('iron_ore')]: 5n, [ASSET('carbon_fiber')]: 3n };
        if (can(u, basket.GP, { [ASSET('iron_ore')]: 5, [ASSET('carbon_fiber')]: 3 })) {
          const escrow = 'build:' + id(); ownerOf.set(escrow, u.id);
          ledger.post({ id: id(), actor: u.id, reason: 'delayed_build_funded_escrow', legs: Object.entries(basket).flatMap(([asset, amount]) => [{ account: u.id, asset, delta: -amount }, { account: escrow, asset, delta: amount }]) });
          schedule({ type: 'build', due: now + p.buildSeconds * 1000, user: u, basket, escrow }); u.building = true; metrics.buildStarted++; stat(u.role).oreConsumed += 5n; stat(u.role).carbonConsumed += 3n;
        } else metrics.buildFailedFunding++;
      }
      if (available(u, 'item:energy_shield') && chance('useShield')) consume(u.id, 'item:energy_shield', 1n, 'actual_modeled_item_consumption');
      if (warActive && !u.mining && u.hulls && chance('fight')) {
        const enemy = people.find(v => !v.retired && v.controller !== u.controller && !v.mining && v.hulls > 0 && v.id !== u.id);
        if (enemy && rnd() < .25) { consume(enemy.id, 'ship:ordinary', 1n, 'assumed_settled_PvP_hull_destruction'); enemy.hulls--; metrics.warLosses++; u.kills++; completeMission(u, 'win_naval_battle'); issue('wreck:' + id(), ASSET('iron_dust'), 1n, 'source_60GP_zeroMOD_wreck_material');
          if (u.kills >= 3 && !u.weeklyPaid.has('kill')) { issue(u.id, 'GP', units(500), 'qualified_weekly_kill_direct_GP_issuance'); u.weeklyPaid.add('kill'); }
        }
      }
      if (p.highSpend && day % 7 === 0 && step % 4 === 0 && ['fighter', 'trader', 'builder'].includes(u.role)) {
        const robotPull = Math.floor(day / 7) % 2 === 0; const cost = units(robotPull ? 500 : 300); metrics.highSpendAttempts++; metrics.gachaAttempts++;
        if (burnBasket(u, cost, {}, robotPull ? 'source_robot_gacha_500GP_abstract_outcome' : 'source_standard_shipcrate_300GP_abstract_outcome')) { metrics.highSpendCompleted++; metrics.gachaSpendGP += gp(cost); issue(u.id, robotPull ? 'collection:robot_part_abstract' : 'collection:shipcrate_outcome_abstract', 1n, 'paid_collection_outcome_no_assumed_resale_or_capacity'); } else { metrics.highSpendDenied++; metrics.gachaDenied++; }
      }
      if (p.highSpend && day % 3 === 0 && step % 4 === 0 && ['fighter', 'trader', 'builder'].includes(u.role)) {
        // Source shield recharge anchor:1000shield×0.05GP=50GP. Purchased service is consumed; no fictitious resale.
        const unitsToFill = Math.max(0, 1000 - u.shipShield); const shieldCost = BigInt(unitsToFill) * units('0.05');
        if (unitsToFill) { metrics.highSpendAttempts++; if (burnBasket(u, shieldCost, {}, 'high_consumption_source_shield_actual_missing_units')) { u.shipShield += unitsToFill; metrics.shieldUnitsPurchased += unitsToFill; metrics.highSpendCompleted++; } else metrics.highSpendDenied++; }
      }
      if (chance('offer')) {
        for (const r of RESOURCES) {
          const hold = available(u, ASSET(r)); const reserve = u.bot || u.role === 'miner' ? (r === 'iron_ore' ? 8 : 3) : r === 'iron_ore' ? 12 : 6;
          const whale = p.whale !== 'none' && u === people[0]; if (whale && p.whale === 'hoard') continue;
          const excess = whale && p.whale === 'dump' ? hold : hold - BigInt(reserve);
          if (excess >= BigInt(p.tradeLot)) offer(u, ASSET(r), Math.min(Number(excess), whale ? 50 : p.tradeLot), whale && p.whale === 'dump' ? .3 : .8 + rnd() * .6, now);
        }
        if (available(u, 'item:energy_shield')) offer(u, 'item:energy_shield', 1, .8 + rnd() * .4, now);
      }
      if (chance('bid') && (!p.buyerShortage || rnd() < .08)) {
        for (const r of RESOURCES) if (available(u, ASSET(r)) < BigInt(r === 'iron_ore' ? 8 : 3) || (p.whale === 'hoard' && u === people[0])) bid(u, ASSET(r), p.tradeLot, p.whale === 'hoard' && u === people[0] ? 1.8 : 1 + rnd() * .6, now);
        if (['fighter', 'casual'].includes(u.role) && available(u, 'item:energy_shield') < 1n) bid(u, 'item:energy_shield', 1, .8 + rnd() * .5, now);
      }
    }
    for (const r of RESOURCES) if (available('npc', ASSET(r)) >= 10n) offer('npc', ASSET(r), 10, 1, now, true);
    book.match(now);
    for (const u of people) if (!u.retired) {
      const quote = quoteFor(u); const needs = u.hp < POLICY.hullHP * .5;
      const noOre = available(u, ASSET('iron_ore')) < quote.iron;
      if (needs && noOre) { u.stockout += p.stepHours; u.longestStockout = Math.max(u.longestStockout, u.stockout); } else u.stockout = 0;
    }
    let totalOre = people.reduce((sum, u) => sum + available(u, ASSET('iron_ore')), 0n); totalOre += BigInt(book.askQuantity(ASSET('iron_ore')));
    if (!book.askQuantity(ASSET('iron_ore'))) { noAskHours += p.stepHours; longestNoAskHours = Math.max(longestNoAskHours, noAskHours); } else noAskHours = 0;
    if (!(resourceOutstanding.get(ASSET('iron_ore')) || 0n)) { globalOreZeroHours += p.stepHours; longestGlobalOreZeroHours = Math.max(longestGlobalOreZeroHours, globalOreZeroHours); } else globalOreZeroHours = 0;
    if (p.withdrawals && day === 90 && step % 4 === 0) for (const u of people) {
      const amount = custody.availableClaim(u.id, 'USDT'); if (!amount) continue; const requestId = id();
      custody.requestWithdrawal({ id: requestId, actor: u.id, user: u.id, asset: 'USDT', amount }); metrics.withdrawalRequested++;
      if (Number(u.id.slice(1)) % 8 === 0) { custody.timeoutWithdrawal(requestId); metrics.withdrawalUnknown++; } else schedule({ type: 'withdraw', due: now + 12 * HOUR, user: u, requestId });
    }
    if (p.purchases && day % 7 === 0 && step % 4 === 0) for (const u of people.filter(u => !u.retired)) {
      try { custody.apply({ id: id(), actor: u.id, kind: 'spend', asset: 'USDT', user: u.id, amount: units(1) }); issue(u.id, 'credit:nonrefundable', units(1), 'hypothetical_funded_access_credit_no_GP_no_redemption'); } catch (e) { if (e.message !== 'UNFUNDED_SPEND') throw e; metrics.custodyDenied++; }
    }
    if (step % 4 === 3) {
      const issued = flows.issuance; const burned = flows.burn; const gpHeld = openingGP + issued - burned;
      const dayTrades = book.trades.filter(t => t.time >= EPOCH + day * 24 * HOUR && t.time < EPOCH + (day + 1) * 24 * HOUR); const oreTrades = dayTrades.filter(t => t.asset === ASSET('iron_ore'));
      const oreQty = oreTrades.reduce((s, t) => s + t.quantity, 0); const oreGross = oreTrades.reduce((s, t) => s + t.amount, 0n);
      const asks = book.askQuantity(ASSET('iron_ore')); const hungry = people.filter(u => !u.retired && u.hp < POLICY.hullHP * .5 && available(u, ASSET('iron_ore')) < quoteFor(u).iron);
      const cheapest = book.cheapest(ASSET('iron_ore')); const fundedNeed = hungry.filter(u => available(u, 'GP') >= quoteFor(u).gp + (cheapest || PRICES.iron_ore) * quoteFor(u).iron).length;
      daily.push({ profile: p.name, seed, day: day + 1, active_accounts: people.filter(u => !u.retired).length, gp_issued_ex_opening: gp(issued), gp_true_burned: gp(burned), gp_transferred: gp(flows.transfers), gp_outstanding: gp(gpHeld), iron_inventory_wallet_and_asks: totalOre.toString(), iron_global_inventory: (resourceOutstanding.get(ASSET('iron_ore')) || 0n).toString(), carbon_inventory_wallet: people.reduce((s, u) => s + available(u, ASSET('carbon_fiber')), 0n).toString(), silicon_inventory_wallet: people.reduce((s, u) => s + available(u, ASSET('silicon_chip')), 0n).toString(), iron_ask_quantity: asks, iron_vwap_gp: oreQty ? gp(oreGross) / oreQty : null, iron_trade_quantity: oreQty, trades: dayTrades.length, repair_unmet_material_accounts: hungry.length, repair_unmet_funded_accounts: fundedNeed, order_funding_denials: metrics.fundingDenials, expired_orders: metrics.expiredOrders, withdrawal_unknown: metrics.withdrawalUnknown, reserve_USDT: gp(BigInt(custody.audit().USDT.reserves)), claims_USDT: gp(BigInt(custody.audit().USDT.customerLiabilities)) });
      ledger.audit();
    }
  }
  finishJobs(EPOCH + p.days * 24 * HOUR); metrics.buildPendingEnd = jobs.filter(j=>j.type==='build').length; book.closeAll(); const audit = ledger.audit(); const money = custody.audit();
  const ownedGP = new Map(people.map(u => [u.id, available(u, 'GP')])); for (const [account, owner] of ownerOf) ownedGP.set(owner, (ownedGP.get(owner) || 0n) + ledger.balance(account, 'GP'));
  const wealth = people.map(u => ({ gp: ownedGP.get(u.id), role: u.role, controller: u.controller, bot: u.bot })); const total = wealth.reduce((s, u) => s + u.gp, 0n); wealth.sort((a, b) => a.gp > b.gp ? -1 : a.gp < b.gp ? 1 : 0);
  for (const u of people) stat(u.role).endingGP += ownedGP.get(u.id);
  const rolePnL = Object.fromEntries(Object.entries(roleStats).map(([role, s]) => { const error = s.endingGP - s.openingGP - s.faucetsGP - s.marketNetGP + s.consumedGP - s.otherTransfersGP; if (error) throw Error('ROLE_PNL_NOT_RECONCILED:' + role + ':' + error); return [role, Object.fromEntries(Object.entries(s).map(([k, v]) => [k, typeof v === 'bigint' ? k.endsWith('GP') ? gp(v) : v.toString() : v]))]; }));
  const controllerBalances = new Map(); for (const u of wealth) controllerBalances.set(u.controller, (controllerBalances.get(u.controller) || 0n) + u.gp); const controllerTop = [...controllerBalances.values()].reduce((s, n) => n > s ? n : s, 0n);
  const oreTrades = book.trades.filter(t => t.asset === ASSET('iron_ore')); const oreQuantity = oreTrades.reduce((s, t) => s + t.quantity, 0); const oreValue = oreTrades.reduce((s, t) => s + t.amount, 0n);
  const ordinary = wealth.filter(u => !u.bot); const bots = wealth.filter(u => u.bot); const oreInventory = people.reduce((s, u) => s + available(u, ASSET('iron_ore')), 0n);
  const summary = { profile: p.name, seed, days: p.days, accounts: p.accounts, controllers: controllerBalances.size, bot_accounts: p.bots, bot_controllers: p.bots ? 1 : 0, frequency: p.frequency, opening_gp: gp(openingGP), opening_player_gp: gp(openingPlayersGP), opening_top1_pct: pct(openingTop1, openingPlayersGP), gp_issuance_ex_opening: gp(flows.issuance), gp_true_burn: gp(flows.burn), gp_transfers: gp(flows.transfers), ending_player_gp: gp(total), net_gp_issuance_ex_opening: gp(flows.issuance - flows.burn), top1_pct: pct(wealth[0].gp, total), top10_pct: pct(wealth.slice(0, Math.ceil(wealth.length / 10)).reduce((s, u) => s + u.gp, 0n), total), top_controller_pct: pct(controllerTop, total), bot_gp_share_pct: pct(bots.reduce((s, u) => s + u.gp, 0n), total), bot_mean_gp: bots.length ? gp(bots.reduce((s, u) => s + u.gp, 0n)) / bots.length : 0, human_mean_gp: ordinary.length ? gp(ordinary.reduce((s, u) => s + u.gp, 0n)) / ordinary.length : 0, iron_final_inventory: oreInventory.toString(), iron_final_global_inventory: (resourceOutstanding.get(ASSET('iron_ore')) || 0n).toString(), iron_turnover_over_mean_global_inventory: oreQuantity / Math.max(1, daily.reduce((sum,d)=>sum+Number(d.iron_global_inventory),0)/daily.length), iron_traded: oreQuantity, iron_vwap_gp: oreQuantity ? gp(oreValue) / oreQuantity : null, iron_min_gp: oreTrades.length ? gp(oreTrades.reduce((s, t) => t.unit < s ? t.unit : s, oreTrades[0].unit)) : null, iron_max_gp: oreTrades.length ? gp(oreTrades.reduce((s, t) => t.unit > s ? t.unit : s, 0n)) : null, longest_iron_ask_stockout_hours: longestNoAskHours, longest_global_iron_stockout_hours: longestGlobalOreZeroHours, longest_account_repair_material_stockout_hours: Math.max(...people.map(u => u.longestStockout)), ending_USDT_reserves: gp(BigInt(money.USDT.reserves)), ending_USDT_claims: gp(BigInt(money.USDT.customerLiabilities)), ending_USDT_unknown_reserved: gp(BigInt(money.USDT.pendingWithdrawalMicro)), business_USDT_revenue: gp(BigInt(money.USDT.revenue)), cash_error: money.USDT.cashError, claim_error: money.USDT.claimError, conservation_errors: Object.values(audit).filter(a => a.error !== '0').length, role_pnl_errors: 0, ...metrics };
  return { summary, daily, roles: rolePnL, issuanceSourcesGP: Object.fromEntries(Object.entries(flows.sources).filter(([, n]) => n).map(([k, n]) => [k, gp(n)])), conservation: audit, custody: money, behavior: { ...p, roleMix: Object.fromEntries(Object.entries(roleStats).map(([role,s])=>[role,s.accounts])), checkpoint: undefined }, boundary: 'Source accounting and selected formulas only; synthetic fixed-ask demand driver, funded proxy bids, role activity, prices and warfare are behavior assumptions. Not full-game inflation or actual profit evidence.' };
}
function csv(rows) { if (!rows.length) return ''; const keys = Object.keys(rows[0]); const quote = v => v == null ? '' : /[",\n]/.test(String(v)) ? '"' + String(v).replaceAll('"', '""') + '"' : String(v); return keys.join(',') + '\n' + rows.map(r => keys.map(k => quote(r[k])).join(',')).join('\n') + '\n'; }
function parameters() {
  return { version: VERSION, seeds: [20261021, 20261022, 20261023], profiles: PROFILES, defaults: DEFAULTS, roleActionProbabilityPercentPerActiveStep: ROLE_RULES, activityProbabilityPer6hStep: { low: .25, medium: .60, high: .95, bot: 1 }, sources: [
    'server/tools/economy_behavior_sensitivity.js', 'server/tests/economy-behavior-sensitivity.test.js', 'server/tools/economy_scenario_simulation.js', 'server/services/ship.js', 'server/services/shipMining.js', 'server/services/resource.js', 'server/services/daily.js', 'server/services/weeklyChallenge.js', 'server/services/marketplace.js', 'server/services/npcEconomy.js', 'server/services/crafting.js', 'server/services/shipCrate.js', 'server/services/assembly.js', 'server/services/victorySlot.js', 'server/db.js',
    'server/migrations/228_ship_crate_gacha.sql', 'server/migrations/245_ship_crate_expansion.sql', 'server/migrations/282_assembly_units_catalog.sql', 'server/migrations/313_victory_slot.sql', 'server/migrations/221_referral_safety_and_decimal_economy.sql', 'server/migrations/090_ship_types.sql', 'server/migrations/163_zone_minerals.sql', 'server/migrations/166_economic_balance.sql', 'server/migrations/220_economy_balance_sea.sql', 'server/migrations/224_week1_funnel_gp_bundle.sql', 'server/migrations/277_ship_mining_depth.sql', 'server/migrations/294_economy_faucet_revert_compromise.sql', 'server/migrations/300_ship_repair_cost_tuning.sql', 'server/migrations/331_retention_hooks.sql', 'server/migrations/354_npc_seed_budget.sql',
  ].map(file => ({ path: file, sha256: hash(fs.readFileSync(path.resolve(__dirname, '../..', file))) })), policyFacts: { buildSeconds: 1500, shipMiningRate: 3, shipMiningCapRolling24h: 1500, territoryHarvestDailyCap: '0.3PPequivalent/day=three1GP modeledharvests; fourthattempt pays0 andcounts0', hullCapacityWeight: 1, hullsPerAccountOpening: 2, repairFormula: 'per-hull frozen repairCost ordinary32000HP/60GP/5ore multiplied by damaged participatingfleet hullcount; HP is fleet average', authoredFrontierDropRates: DEFAULTS.rates, authoredDropQuantityMax: 10, weeklyHarvest: { target: 20, rewardGP: 400, accounting: 'direct issuance despite carve comment' }, weeklyKill: { target: 3, rewardGP: 500, accounting: 'direct issuance despite carve comment' }, weeklyClaim: { target: 5, rewardGP: 300, modeled: false, reason: 'no paid territory-claim expansion driver' }, stakingEnabled: false, dividendPoolDistribution: false, miningGlobalBudget: 'none:explicit new GP issuance; not an invented funded reward pool', NPC: 'one synthetic freshNPC with200GP and40each of5source resources;3resource types traded; no replenishment or newidentities', repairPool: '20% of repair GP parked in victory_slot_pool under313schema assumption; no pool payout modeled', marketReferral: 'no eligible uplines:0paid;25%fee is MAXBASE, not paid share', dividends: '20%fee parked under110schema assumption; no stakers or payout modeled', highSpend: 'fundable500GP robotpull or300GP standardcrate weekly alternating plus up-to1000missing shieldunits×0.05GP every3days; synthetic1000capacity,3%hourlydecay; nevercharge fullshield; outcomes abstractnonresoldcollections not sourceodds simulator' }, assumptions: ['Fixed48playeraccounts, no entrants; identical opening200GP/2ordinaryhulls/20ore/10carbon/6silicon per account before whale redistribution.', 'Bot profile8accounts/1controller replaces8humans; same opening capital and capacity, higher activity and consumption avoidance only. Common-controller fills excluded.', 'Offers are source-like fixed asks with listing fee; funded escrow limit bids and5day expiry are sensitivity mechanics, not existing server endpoints.', 'No token appreciation, GP/PP cash conversion, new-user funding income or guaranteed NPC buyback.', 'Economic PnL separates opening balances, faucets, market net cashflow, actualGP consumption and other transfers. It is not fiat profit.', 'Optional/highvalue sinks not fully represented: gacha odds, enhancement/fusion/hijack, quality, largerhull capital costs, territorial upkeep and loss modes; cannot conclude whole-game inflation from this slice.'] };
}
function main(out) {
  const receiptPath = path.join(out, 'run-receipt.json'); const prior = fs.existsSync(receiptPath) ? JSON.parse(fs.readFileSync(receiptPath, 'utf8')) : {}; const priorCpuMs = prior.cumulativeKnownCpuMs || prior.cpuMs || 0; const priorWallMs = prior.cumulativeKnownWallMs || prior.wallMs || 0; const priorExecutions = prior.cumulativeExecutions || (prior.status === 'completed' ? 1 : 0);
  const start = performance.now(); const cpuStart = process.cpuUsage(); let peakHeap = 0; const cap = { wallMs: 120000, cpuMs: 100000, heapBytes: 768 * 1024 * 1024, outputBytes: 20 * 1024 * 1024, runs: 42 };
  const checkpoint = () => { peakHeap = Math.max(peakHeap, process.memoryUsage().heapUsed); const cpu = process.cpuUsage(cpuStart); if (performance.now() - start + priorWallMs > cap.wallMs || (cpu.user + cpu.system) / 1000 + priorCpuMs > cap.cpuMs || peakHeap > cap.heapBytes) throw Error('RESOURCE_BUDGET_EXCEEDED'); };
  const runs = []; for (const seed of [20261021, 20261022, 20261023]) for (const profile of PROFILES) { checkpoint(); runs.push(runCase(profile, seed, { checkpoint })); }
  const compactA = runCase({ name: 'compact_replay' }, 20261021, { days: 7, accounts: 6, checkpoint }); const compactB = runCase({ name: 'compact_replay' }, 20261021, { days: 7, accounts: 6, checkpoint }); const compactHashA = hash(csv(compactA.daily)); const compactHashB = hash(csv(compactB.daily)); if (compactHashA !== compactHashB) throw Error('COMPACT_REPLAY_CHANGED');
  const summaries = runs.map(r => r.summary); const daily = runs.flatMap(r => r.daily); const params = parameters();
  const artifacts = { 'summary.csv': csv(summaries), 'daily.csv': csv(daily), 'summary.json': JSON.stringify({ version: VERSION, runs: runs.map(({ daily, ...r }) => r), legacyAndPendingProbes: stressProbes() }, null, 2) + '\n', 'parameters.json': JSON.stringify(params, null, 2) + '\n' };
  const bytes = Object.values(artifacts).reduce((s, x) => s + Buffer.byteLength(x), 0); if (bytes > cap.outputBytes) throw Error('OUTPUT_BUDGET_EXCEEDED');
  fs.mkdirSync(out, { recursive: true }); for (const [name, value] of Object.entries(artifacts)) fs.writeFileSync(path.join(out, name), value);
  const cpu = process.cpuUsage(cpuStart); const receipt = { version: VERSION, status: 'completed', runCount: runs.length, seeds: [20261021, 20261022, 20261023], profiles: PROFILES.map(p => p.name), virtualDays: 112, decisionStepHours: 6, cumulativeExecutions: priorExecutions + 1, cumulativeKnownWallMs: priorWallMs + performance.now() - start, cumulativeKnownCpuMs: priorCpuMs + (cpu.user + cpu.system) / 1000, wallMs: performance.now() - start, cpuMs: (cpu.user + cpu.system) / 1000, peakObservedHeapBytes: peakHeap, maxRSSBytes: process.resourceUsage().maxRSS * 1024, aggregateOutputBytes: bytes, limits: cap, files: Object.fromEntries(Object.entries(artifacts).map(([name, value]) => [name, { bytes: Buffer.byteLength(value), sha256: hash(value) }])), compactReplay: { caseDays: 7, accounts: 6, executions: 2, identicalDailyCSV: compactHashA === compactHashB, sha256: compactHashA }, cleanup: 'No subprocess/server/tempDB/network; no full eventlogs written. Per-run private accounting retained only until run returns.', frozenModelSHA256: hash(fs.readFileSync(path.join(__dirname, 'economy_scenario_simulation.js'))) };
  fs.writeFileSync(path.join(out, 'run-receipt.json'), JSON.stringify(receipt, null, 2) + '\n'); process.stdout.write(JSON.stringify(receipt, null, 2) + '\n');
}
if (require.main === module) { const args = process.argv.slice(2); if (args.length !== 2 || args[0] !== '--out') throw Error('Usage: node --max-old-space-size=768 server/tools/economy_behavior_sensitivity.js --out directory'); main(path.resolve(args[1])); }
module.exports = { VERSION, PROFILES, DEFAULTS, ROLE_RULES, OrderBook, fleetRepairQuote, runCase, csv, parameters, main };
