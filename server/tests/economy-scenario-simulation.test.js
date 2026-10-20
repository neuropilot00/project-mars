'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { SCALE, POLICY, Ledger, Custody, units, decimal, trade, craft, build, repairCost, runScenario, runSuite, auctionProbes, stressProbes } = require('../tools/economy_scenario_simulation');
function funded() { const l = new Ledger(); l.issue('gp', 'alice', 'GP', units(100), 'fixture'); l.issue('ore', 'alice', 'resource:iron_ore', 10n, 'fixture'); l.issue('si', 'alice', 'resource:silicon_chip', 6n, 'fixture'); return l; }
function assertZeroErrors(result) { for (const a of Object.values(result.conservation)) assert.equal(a.error, '0'); for (const a of Object.values(result.stablecoins)) { assert.equal(a.cashError, '0'); assert.equal(a.claimError, '0'); } }

test('exact six-decimal parser never accepts floating-point monetary inputs or exponent notation', () => {
  assert.equal(units('0.000001'), 1n); assert.equal(units('9007199254740993.123456'), 9007199254740993123456n);
  assert.equal(decimal(units('17.02')), '17.020000'); assert.equal(decimal(-1n), '-0.000001');
  for (const value of [0.1, '1e6', '-1', '0.0000001', 'Infinity', 'NaN', '01']) assert.throws(() => units(value));
});
test('ledger rejects unfunded, forged, duplicate, unbalanced and partially valid batches atomically', () => {
  const l = funded(); const before = l.snapshot();
  assert.throws(() => l.transfer('fake', 'alice', 'eve', 'GP', units(1), 'eve'), /UNAUTHORIZED_DEBIT/);
  assert.throws(() => l.transfer('overspend', 'alice', 'bob', 'GP', units(101)), /INSUFFICIENT_BALANCE/);
  assert.throws(() => l.post({ id: 'mint', actor: 'alice', kind: 'issue', legs: [{ account: '@issuer', asset: 'GP', delta: -1n }, { account: 'alice', asset: 'GP', delta: 1n }] }), /UNAUTHORIZED_ISSUANCE/);
  assert.throws(() => l.post({ id: 'partial', actor: 'alice', legs: [{ account: 'alice', asset: 'GP', delta: -1n }, { account: 'bob', asset: 'GP', delta: 2n }] }), /UNBALANCED_EVENT/);
  assert.deepEqual(l.snapshot(), before);
  l.transfer('once', 'alice', 'bob', 'GP', 1n); const once = l.snapshot(); assert.throws(() => l.transfer('once', 'alice', 'bob', 'GP', 1n), /DUPLICATE_EVENT/); assert.deepEqual(l.snapshot(), once);
  for (const a of Object.values(l.audit())) assert.equal(a.error, '0');
  const events = l.events; events[0].legs[0].delta = 100n; assert.equal(l.events[0].legs[0].delta, -units(100));
});
test('market transfers inventory once and carves referrals/dividends from fee without counting them as burn', () => {
  const l = funded(); l.issue('buyer', 'bob', 'GP', units(10), 'fixture');
  trade(l, { id: 'sale', seller: 'alice', buyer: 'bob', asset: 'resource:iron_ore', quantity: 10n, price: units(6) });
  assert.equal(l.balance('bob', 'resource:iron_ore'), 10n); assert.equal(l.balance('alice', 'resource:iron_ore'), 0n);
  assert.equal(l.balance('referral_pool', 'GP'), units('0.075')); assert.equal(l.balance('dividend_pool', 'GP'), units('0.06'));
  assert.equal(l.balance('@burn', 'GP'), units('5.165')); assert.equal(l.audit().GP.issued, units(110).toString());
  assert.throws(() => trade(l, { id: 'self', seller: 'bob', buyer: 'bob', asset: 'resource:iron_ore', quantity: 1n, price: units(1) }), /INVALID_TRADE/);
});
test('PP market transfer remains a different currency and creates zero cash claims', () => {
  const l = funded(); l.issue('pp', 'bob', 'PP', units(1), 'fixture');
  trade(l, { id: 'pp-sale', seller: 'alice', buyer: 'bob', asset: 'resource:iron_ore', quantity: 1n, price: units('0.1'), currency: 'PP' });
  assert.equal(l.balance('bob', 'PP'), units('0.9')); assert.equal(l.balance('alice', 'GP'), units(95));
  assert.equal(l.balance('alice', 'PP'), units('0.095')); assert.equal(new Custody().liabilities('USDC'), 0n);
});
test('craft failure consumes ingredients, refunds only paid GP, and disallows above100% refunds', () => {
  const l = funded(); const before = l.snapshot(); assert.throws(() => craft(l, { id: 'bad-refund', user: 'alice', success: false, refundBps: 10001 }), /INVALID_REFUND_BPS/); assert.deepEqual(l.snapshot(), before);
  const r = craft(l, { id: 'fail', user: 'alice', success: false }); assert.equal(r.refunded, units(25)); assert.equal(l.balance('alice', 'GP'), units(75)); assert.equal(l.balance('alice', 'resource:iron_ore'), 5n); assert.equal(l.balance('alice', 'item:energy_shield'), 0n);
  assert.throws(() => craft(l, { id: 'fail', user: 'alice', success: false }), /DUPLICATE_EVENT/); assert.equal(l.balance('alice', 'GP'), units(75));
});
test('build cancellation/failure/completion settles the funded escrow once without free materials', () => {
  for (const outcome of ['cancel', 'failure', 'complete']) {
    const l = funded(); l.issue('carbon', 'alice', 'resource:carbon_fiber', 3n, 'fixture'); build(l, 'job', 'alice', outcome);
    assert.equal(l.balance('build_escrow:job', 'GP'), 0n); assert.equal(l.balance('alice', 'GP'), units(outcome === 'failure' ? 100 : outcome === 'cancel' ? 70 : 40));
    assert.equal(l.balance('alice', 'ship:ordinary'), outcome === 'complete' ? 1n : 0n);
    assert.equal(l.balance('embodied:alice', 'resource:iron_ore'), outcome === 'complete' ? 5n : 0n);
    const before = l.snapshot(); assert.throws(() => build(l, 'job', 'alice', outcome)); assert.deepEqual(l.snapshot(), before); for (const a of Object.values(l.audit())) assert.equal(a.error, '0');
  }
});
test('ordinary hull repair includes both actual GP cap and source material cap; dust is not ore', () => {
  assert.deepEqual(repairCost(16000), { gp: units(36), iron: 2n }); assert.deepEqual(repairCost(10), { gp: units(1), iron: 1n });
  const l = new Ledger(); l.issue('dust', 'alice', 'resource:iron_dust', 100n, 'fixture'); assert.equal(l.balance('alice', 'resource:iron_ore'), 0n);
});
test('stablecoin liabilities require verified funding, segregate USDC/USDT and reject invented cash-outs', () => {
  const c = new Custody(); assert.throws(() => c.apply({ id: 'fake', actor: 'alice', kind: 'deposit', asset: 'USDC', user: 'alice', amount: units(10) }), /UNVERIFIED_FUNDING/);
  c.apply({ id: 'funded', actor: 'verified_funding', kind: 'deposit', asset: 'USDC', user: 'alice', amount: units(10) });
  assert.throws(() => c.requestWithdrawal({ id: 'wrong-asset', actor: 'alice', user: 'alice', asset: 'USDT', amount: units(1) }), /UNFUNDED_WITHDRAWAL/);
  assert.throws(() => c.apply({ id: 'gp-redemption', actor: 'alice', kind: 'redeem_GP', asset: 'USDC', user: 'alice', amount: units(1) }), /UNAUTHORIZED_LEDGER_CHANGE/);
  assert.throws(() => c.requestWithdrawal({ id: 'over', actor: 'alice', user: 'alice', asset: 'USDC', amount: units(11) }), /UNFUNDED_WITHDRAWAL/);
  c.apply({ id: 'purchase', actor: 'alice', kind: 'spend', asset: 'USDC', user: 'alice', amount: units(2) }); const a = c.audit().USDC;
  assert.equal(a.customerLiabilities, units(8).toString()); assert.equal(a.reserves, units(8).toString()); assert.equal(a.revenue, units(2).toString()); assert.equal(a.cashError, '0'); assert.equal(a.claimError, '0');
});
test('timeout keeps a customer claim and cash reservation until verified reconciliation', () => {
  const p = stressProbes().reorgAndTimeout; assert.equal(p.provisionalRejected, 'UNFUNDED_WITHDRAWAL'); assert.equal(p.timeoutDoubleSpendRejected, 'UNFUNDED_WITHDRAWAL');
  assert.equal(p.afterTimeout.USDC.customerLiabilities, units(100).toString()); assert.equal(p.afterTimeout.USDC.pendingWithdrawalMicro, units(20).toString()); assert.equal(p.afterTimeout.USDC.pendingWithdrawals[0].status, 'unknown');
  assert.equal(p.afterReconciliationAndHypotheticalLoss.USDC.reorgedFundingMicro, units(100).toString()); assert.equal(p.afterReconciliationAndHypotheticalLoss.USDC.customerLiabilities, units(80).toString());
  assert.equal(p.afterReconciliationAndHypotheticalLoss.USDC.reserveSurplus, (-SCALE).toString()); assert.equal(p.insolvencyRejected, 'INSOLVENT');
});
test('100funded→80pending→unknown prevents spend30 and cashlock30; settlement80 remains atomic', () => {
  const c = new Custody(); c.apply({ id: 'deposit', actor: 'verified_funding', kind: 'deposit', asset: 'USDG', user: 'alice', amount: units(100) });
  c.requestWithdrawal({ id: 'withdraw80', actor: 'alice', user: 'alice', asset: 'USDG', amount: units(80) }); c.timeoutWithdrawal('withdraw80');
  const before = c.audit(); const events = c.events;
  assert.throws(() => c.apply({ id: 'spend30', actor: 'alice', kind: 'spend', asset: 'USDG', user: 'alice', amount: units(30) }), /UNFUNDED_SPEND/);
  assert.throws(() => c.apply({ id: 'lock30', actor: 'custody_operator', kind: 'lock', asset: 'USDG', amount: units(30) }), /UNFUNDED_LOCK/);
  assert.throws(() => c.reconcileWithdrawal({ id: 'forged-settlement', requestId: 'withdraw80', actor: 'alice', confirmed: true }), /UNVERIFIED_SETTLEMENT/);
  assert.deepEqual(c.audit(), before); assert.deepEqual(c.events, events);
  assert.equal(before.USDG.customerLiabilities, units(100).toString()); assert.equal(before.USDG.pendingWithdrawalMicro, units(80).toString()); assert.equal(before.USDG.availableLiquidMicro, units(20).toString());
  c.apply({ id: 'spend20', actor: 'alice', kind: 'spend', asset: 'USDG', user: 'alice', amount: units(20) });
  c.reconcileWithdrawal({ id: 'confirmed80', requestId: 'withdraw80', actor: 'verified_settlement', confirmed: true });
  assert.equal(c.audit().USDG.customerLiabilities, '0'); assert.equal(c.audit().USDG.pendingWithdrawalMicro, '0'); assert.equal(c.audit().USDG.reserves, '0');
  const after = c.audit(); assert.throws(() => c.reconcileWithdrawal({ id: 'confirmed80again', requestId: 'withdraw80', actor: 'verified_settlement', confirmed: true }), /INVALID_PENDING_WITHDRAWAL/); assert.deepEqual(c.audit(), after);
});
test('funding reconciliation rejects replayed finalization event without duplicating liabilities', () => {
  const c=new Custody(); c.observeFunding({id:'fund',asset:'USDG',user:'alice',amount:units(10)}); c.reconcileFunding('fund',true,'verified_funding');
  const before=c.audit(); assert.throws(()=>c.apply({id:'finalized:fund',actor:'verified_funding',kind:'deposit',asset:'USDG',user:'alice',amount:units(10)}),/DUPLICATE_EVENT/); assert.deepEqual(c.audit(),before);
});
test('funded auction escrow rejects self/unfunded/repeat settlement and refunds prior bid once', () => {
  const a = auctionProbes(); assert.equal(a.filled, 1); assert.equal(a.expiredWithoutBid, 1); assert.equal(a.manipulationExcludedTrades, 1); assert.equal(a.unfundedBidsRejected, 1); assert.equal(a.duplicateRejected, 'AUCTION_CLOSED');
  assert.equal(a.previousBidRefundMicroGP, units(100).toString()); assert.equal(a.auctionFeeTreasuryMicroGP, units(1).toString()); assert.equal(a.conservation['claim:territory'].held, '2');
});
test('source policy profile stays connected to authored seed/fallback definitions', () => {
  const root = path.resolve(__dirname, '../..'); const read = p => fs.readFileSync(path.join(root, p), 'utf8');
  assert.match(read('server/migrations/224_week1_funnel_gp_bundle.sql'), /\[8, 12, 16, 20, 22, 25, 40\]/);
  assert.match(read('server/migrations/278_ship_mining_redteam_fixes.sql'), /ship_mining_gp_cap_per_day','1500'/);
  assert.match(read('server/services/shipMining.js'), /ship_mining_gp_cap_per_day', '1500'/);
  assert.match(read('server/migrations/300_ship_repair_cost_tuning.sql'), /value = '0.03'/);
  assert.match(read('server/services/npcEconomy.js'), /npc_economy_seed_ledger/);
  assert.match(read('server/migrations/354_npc_seed_budget.sql'), /legacy_existing.*0.*'\{\}'/);
  assert.equal(POLICY.hullBuildGP, 60);
});
test('fixed seed, virtualtime, policyversion and ordered events replay exactly; changedseed changes behavior', () => {
  const spec = { seed: 101, overrides: { days: 5, initialPlayers: 4, newPlayersPerDay: 0 } };
  const a = runScenario(spec); const b = runScenario(spec); assert.deepEqual(a, b); assert.notEqual(a.ledgerSHA256, runScenario({ ...spec, seed: 102 }).ledgerSHA256);
  assertZeroErrors(a); assert.equal(a.orderedEventRefs.length, a.events.length + a.custodyEvents.length); for (let i=0;i<a.orderedEventRefs.length;i++) assert.equal(a.orderedEventRefs[i].sequence,i+1); for (let i = 0; i < a.events.length; i++) { assert.equal(a.events[i].sequence, i + 1); assert.ok(a.events[i].virtualTime); assert.ok(a.events[i].policyVersion); assert.deepEqual(Object.values(a.events[i].invariants), [true, true, true, true]); }
  const changed = runScenario({ overrides: { days: 5, initialPlayers: 3, newPlayersPerDay: 0, policyChangeDay: 3, miningRateAfterChange: 1 } });
  const policyEvent = changed.events.find(e => e.kind === 'policy_change'); assert.ok(policyEvent); assert.match(policyEvent.policyVersion, /hypothetical-rate-change$/); assert.ok(changed.events.slice(0, policyEvent.sequence - 1).every(e => !e.policyVersion.endsWith('hypothetical-rate-change')));
});
test('all authored scenarios conserve every asset and funded cash, expose decline/bots/war/NPC depletion and liquidity differences', () => {
  const suite = runSuite(); for (const s of [...suite.scenarios, ...suite.comparisons]) assertZeroErrors(s);
  const scenario = name => suite.scenarios.find(s => s.name === name);
  assert.equal(scenario('zero_growth_no_pay').stablecoins.USDC.revenue, '0'); assert.equal(scenario('zero_growth_no_pay').daily.at(-1).registered, 40);
  assert.ok(scenario('player_decline').daily.at(-1).active < scenario('player_decline').daily[0].active);
  assert.ok(scenario('bot_farming').wealth.botSharePct > 50); assert.ok(scenario('whale_concentration').wealth.openingTop1SharePct > 90);
  assert.ok(scenario('major_war').counters.warLosses > 0); assert.equal(scenario('major_war').counters.warLosses, scenario('major_war').counters.salvageTransfers);
  assert.equal(scenario('major_war').issuanceBySource['salvage_recovered_part_transfer_no_issuance|resource:iron_dust'], undefined);
  assert.equal(scenario('major_war').issuanceBySource['war_hull_loss_and_source_wreck_derivative_material|resource:iron_dust'], String(scenario('major_war').counters.warLosses));
  assert.ok(scenario('npc_budget_exhaustion').counters.npcBudgetExhausted > 0); assert.equal(scenario('npc_budget_exhaustion').issuanceBySource['npc_one_time_seed|GP'], units(200).toString());
  for (const resource of ['iron_ore', 'carbon_fiber', 'silicon_chip', 'titanium_alloy', 'plasma_crystal']) assert.equal(scenario('npc_budget_exhaustion').issuanceBySource['npc_one_time_seed|resource:' + resource], '40');
  assert.equal(scenario('reorg_funding').fundingStress.unconfirmedWithdrawalRejected, 'UNFUNDED_WITHDRAWAL');
  assert.equal(scenario('reorg_funding').stablecoins.USDG.reorgedFundingMicro, units(100).toString());
  assert.ok(scenario('low_liquidity').counters.withdrawalRejected > 0); assert.equal(scenario('mass_withdrawals').counters.withdrawalRejected, 0);
  assert.equal(scenario('mass_withdrawals').stablecoins.USDC.pendingWithdrawalMicro, units(18).toString()); assert.equal(scenario('mass_withdrawals').stablecoins.USDC.customerLiabilities, units(18).toString());
  assert.ok(BigInt(suite.comparisons.find(s => s.name === 'legacy_npc_refill').issuanceBySource['npc_stock_refill|resource:iron_ore']) > 40n);
});
