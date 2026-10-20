'use strict';
const test = require('node:test'); const assert = require('node:assert/strict'); const fs = require('node:fs'); const crypto = require('node:crypto');
const { Ledger, units } = require('../tools/economy_scenario_simulation');
const { OrderBook, fleetRepairQuote, runCase, csv } = require('../tools/economy_behavior_sensitivity');
function fixture() {
  let n=0; const l=new Ledger(); const counters={fundingDenials:0,fundedBidOrders:0,fundedAskOrders:0,commonControlMatchesExcluded:0,trades:0,humanTrades:0,npcTrades:0,filledOrders:0,expiredOrders:0,unfilledExpiredOrders:0};
  for(const u of ['seller','buyer'])l.issue('gp:'+u,u,'GP',units(100),'test_opening');l.issue('ore','seller','resource:iron_ore',10n,'test_opening');
  const b=new OrderBook({ledger:l,ownerOf:new Map(),issueId:()=>String(++n),metrics:counters,onFill:()=>{}});return {l,b,counters};
}
test('funded asks/bids clear at actualask and return excess bid escrow, no fictitious buyer or referral',()=>{
  const {l,b,counters}=fixture();b.place({user:'seller',controller:'S',side:'ask',asset:'resource:iron_ore',quantity:5,limit:units(1),now:0,expires:100});b.place({user:'buyer',controller:'B',side:'bid',asset:'resource:iron_ore',quantity:5,limit:units(2),now:0,expires:100});b.match(1);
  assert.equal(counters.trades,1);assert.equal(l.balance('buyer','GP'),units(95));assert.equal(l.balance('seller','GP'),units('99.75'));assert.equal(l.balance('buyer','resource:iron_ore'),5n);assert.equal(l.balance('referral_pool','GP'),0n);assert.equal(l.balance('dividend_pool','GP'),units('0.05'));assert.equal(l.balance('@burn','GP'),units('5.2'));assert.equal(l.audit().GP.error,'0');
});
test('unfunded orders leave state unchanged; commoncontrol crossing cannot fabricate volume',()=>{
  const {l,b,counters}=fixture();const before=l.snapshot();assert.equal(b.place({user:'buyer',controller:'X',side:'bid',asset:'resource:iron_ore',quantity:1000,limit:units(1),now:0,expires:100}),null);assert.deepEqual(l.snapshot(),before);
  b.place({user:'seller',controller:'X',side:'ask',asset:'resource:iron_ore',quantity:5,limit:units(1),now:0,expires:100});b.place({user:'buyer',controller:'X',side:'bid',asset:'resource:iron_ore',quantity:5,limit:units(2),now:0,expires:100});b.match(1);assert.equal(counters.trades,0);assert.ok(counters.commonControlMatchesExcluded>0);b.expire(100);const once=l.snapshot();b.expire(200);assert.deepEqual(l.snapshot(),once);assert.equal(l.balance('seller','resource:iron_ore'),10n);assert.equal(l.balance('buyer','GP'),units(100));assert.equal(l.balance('seller','GP'),units(95));
});
test('fleetaverageHP repair charges every participating hull, preserving perhull cap/materialceil',()=>{assert.deepEqual(fleetRepairQuote(16000,1),{gp:units(36),iron:2n});assert.deepEqual(fleetRepairQuote(16000,2),{gp:units(72),iron:4n});assert.deepEqual(fleetRepairQuote(16000,4),{gp:units(144),iron:8n});});
test('delayed build completion respects actual virtualduetime and preserves outstanding fundedescrow',()=>{
  const fast=runCase({name:'queue'},1,{days:2,accounts:6});const delayed=runCase({name:'queue'},1,{days:2,accounts:6,buildSeconds:10*86400});assert.ok(fast.summary.buildCompleted>0);assert.ok(delayed.summary.buildStarted>0);assert.equal(delayed.summary.buildCompleted,0);assert.equal(delayed.summary.buildPendingEnd,delayed.summary.buildStarted);assert.equal(delayed.summary.role_pnl_errors,0);assert.equal(delayed.summary.conservation_errors,0);
});
test('same seededcompact outputs replay, rolePnL reconciles, all source-backed partial model audits pass',()=>{
  const spec={name:'compact'};const a=runCase(spec,17,{days:7,accounts:6});const b=runCase(spec,17,{days:7,accounts:6});assert.equal(csv(a.daily),csv(b.daily));assert.deepEqual(a.summary,b.summary);assert.notEqual(csv(a.daily),csv(runCase(spec,18,{days:7,accounts:6}).daily));assert.equal(a.summary.cash_error,'0');assert.equal(a.summary.claim_error,'0');assert.equal(a.summary.conservation_errors,0);assert.equal(a.summary.role_pnl_errors,0);assert.ok(a.summary.gp_issuance_ex_opening>0);assert.ok(a.daily.every(d=>BigInt(d.iron_global_inventory)>=BigInt(d.iron_inventory_wallet_and_asks)));
});
test('matchedbotcapital and unknownwithdrawal custody remain separatefromGPclaims',()=>{
 const a=runCase({name:'bot',bots:8},19,{days:2,accounts:12});const b=runCase({name:'human'},19,{days:2,accounts:12});assert.equal(a.summary.opening_player_gp,b.summary.opening_player_gp);assert.equal(a.summary.opening_gp,2400);assert.equal(a.summary.controllers,5);assert.equal(a.summary.bot_controllers,1);
 const w=runCase({name:'withdraw',withdrawals:true,purchases:false},19,{days:92,accounts:8});assert.equal(w.summary.withdrawalRequested,8);assert.equal(w.summary.withdrawalCompleted,7);assert.equal(w.summary.withdrawalUnknown,1);assert.equal(w.summary.ending_USDT_unknown_reserved,20);assert.equal(w.summary.ending_USDT_claims,20);assert.equal(w.summary.ending_USDT_reserves,20);assert.equal(w.summary.business_USDT_revenue,0);
});
test('role-mix profiles preserve equal opening total; territory cap rejects fourthsuccess and unearnedweekly reward',()=>{
  const heavy=runCase({name:'miner_heavy',roleMix:{miner:24,crafter:6,builder:6,trader:6,casual:6,fighter:0}},5,{days:1,accounts:48});assert.equal(heavy.behavior.roleMix.miner,24);assert.equal(heavy.behavior.roleMix.fighter||0,0);assert.equal(heavy.summary.opening_player_gp,9600);
  const bots=runCase({name:'cap',bots:8},5,{days:7,accounts:8});assert.equal(bots.issuanceSourcesGP.territory_harvest_assumed_net_0_1PP_equivalent,undefined);assert.equal(bots.issuanceSourcesGP['territory_harvest_assumed_net_0.1PP_equivalent'],168);assert.equal(bots.issuanceSourcesGP.qualified_weekly_harvest_direct_GP_issuance,undefined);
});
test('frozen original model remains byte-for-byte unchanged',()=>{const value=fs.readFileSync(require.resolve('../tools/economy_scenario_simulation'));assert.equal(crypto.createHash('sha256').update(value).digest('hex'),'2ef69ccdc0ba137dc5a0055035b8c9bb4e16d284f2ee908b433692dd07973200');});
