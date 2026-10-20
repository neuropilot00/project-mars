'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {Ledger,units}=require('../tools/economy_scenario_simulation');
const {ReleaseMarket,feeFor,checkSafety,miningReward,compileDriver}=require('../tools/economy_release_policy_comparison');
function fixture(policy='current_guard'){
 let serial=0;const ledger=new Ledger();ledger.issue('capital','seller','GP',units(200),'opening');ledger.issue('ore','seller','resource:iron_ore',100n,'opening');ledger.issue('buyer','buyer','GP',units(100),'opening');
 const metrics={fundingDenials:0,fundedAskOrders:0,fundedBidOrders:0,trades:0,npcTrades:0,humanTrades:0,filledOrders:0,expiredOrders:0,unfilledExpiredOrders:0,commonControlMatchesExcluded:0};const book=new ReleaseMarket({ledger,ownerOf:new Map(),issueId:()=>String(++serial),metrics,onFill:()=>{}},policy);
 return{ledger,metrics,book};
}
const ask=(book,quantity=5,limit=units('0.6'))=>book.place({user:'seller',controller:'seller',side:'ask',asset:'resource:iron_ore',quantity,limit,now:0});
test('current source guard blocks 3GP before any fee or escrow and leaves suggestion unadopted',()=>{
 const f=fixture(),before=f.ledger.snapshot();assert.equal(ask(f.book),null);assert.deepEqual(f.ledger.snapshot(),before);assert.equal(f.metrics.listingGuardDenied,1);assert.equal(f.metrics.proposalAdopted,0);
 const q=checkSafety(units(3),units(5),5);assert.equal(q.minimumTotalPriceGp,5.263158);assert.equal(q.suggestedQuantity,9);assert.equal(q.suggestedTotalPrice,5.4);
 assert.equal(checkSafety(units('5.263157'),units(5),1).blocked,true);assert.equal(checkSafety(units('5.263158'),units(5),1).blocked,false);
 assert.ok(ask(f.book,9));assert.equal(f.ledger.balance('seller','GP'),units(195));assert.equal(f.ledger.audit().GP.error,'0');
});
test('all policy markets apply the same guard; fee hypothesis changes only its registration amount',()=>{
 assert.equal(feeFor('fee_one_percent_capped5',0,units(3)),units('0.03'));assert.equal(feeFor('fee_one_percent_capped5',10,units(1000)),units(5));
 const low=fixture('fee_one_percent_capped5');assert.ok(ask(low.book));assert.equal(low.ledger.balance('seller','GP'),units('199.97'));
 for(const policy of ['mining_account_cap150','mining_controller_cap150','npc_funded_reprocurement']){const f=fixture(policy);assert.equal(ask(f.book),null);assert.equal(f.metrics.listingGuardDenied,1);}
});
test('mining candidates cap only new mining GP with strict rolling24h and account/controller distinction',()=>{
 const m=()=>({policyMiningCapHits:0,policyMiningGPNotIssued:0});
 assert.equal(miningReward({policy:'current_guard'},{controller:'x'},0,units(48),units(1490),m()),units(10));
 assert.equal(miningReward({policy:'mining_account_cap150'},{controller:'x'},0,units(48),units(140),m()),units(10));
 const p={policy:'mining_controller_cap150'},metrics=m();
 assert.equal(miningReward(p,{controller:'bot'},0,units(96),0n,metrics),units(96));
 assert.equal(miningReward(p,{controller:'bot'},0,units(96),0n,metrics),units(54));
 assert.equal(miningReward(p,{controller:'human'},0,units(96),0n,metrics),units(96));
 assert.equal(miningReward(p,{controller:'bot'},24*3600000,units(96),0n,metrics),units(96));
 assert.equal(metrics.policyMiningCapHits,1);assert.equal(metrics.policyMiningGPNotIssued,42);
});
test('NPC procurement uses existing funds, observes stock/reserve and adds no issuer leg',()=>{
 const f=fixture('npc_funded_reprocurement');f.ledger.issue('npc','npc','GP',units(20),'opening');assert.ok(ask(f.book,10));
 const gpBefore=f.ledger.balance('@issuer','GP'),oreBefore=f.ledger.balance('@issuer','resource:iron_ore');f.book.match(0);
 assert.equal(f.metrics.npcProcurementBought,1);assert.equal(f.metrics.npcProcurementSpendGP,6);assert.equal(f.ledger.balance('npc','GP'),units(14));assert.equal(f.ledger.balance('npc','resource:iron_ore'),10n);
 assert.equal(f.ledger.balance('@issuer','GP'),gpBefore);assert.equal(f.ledger.balance('@issuer','resource:iron_ore'),oreBefore);f.book.match(0);assert.equal(f.metrics.npcProcurementBought,1);assert.equal(f.ledger.audit().GP.error,'0');
 const poor=fixture('npc_funded_reprocurement');poor.ledger.issue('npc','npc','GP',units(15),'opening');ask(poor.book,10);poor.book.match(0);assert.equal(poor.metrics.npcProcurementBought,0);assert.equal(poor.metrics.npcProcurementReserveDenied,1);
 const stocked=fixture('npc_funded_reprocurement');stocked.ledger.issue('npc','npc','GP',units(100),'opening');stocked.ledger.issue('npcOre','npc','resource:iron_ore',40n,'opening');ask(stocked.book,10);stocked.book.match(0);assert.equal(stocked.metrics.npcProcurementBought,0);assert.equal(stocked.metrics.npcProcurementStockDenied,1);
});
test('whole-lot immediate buy, no persistent bids, and168h expiry retain source-market semantics',()=>{
 const f=fixture();ask(f.book,10);f.book.place({user:'buyer',controller:'buyer',side:'bid',asset:'resource:iron_ore',quantity:5,limit:units('0.6'),now:0});assert.equal(f.ledger.balance('buyer','resource:iron_ore'),10n);assert.equal(f.metrics.fundedBidOrders,0);assert.equal(f.metrics.listingSold,1);
 ask(f.book,10);f.book.expire(168*3600000);assert.equal(f.metrics.listingExpired,0);f.book.expire(168*3600000+1);assert.equal(f.metrics.listingExpired,1);assert.equal(f.ledger.audit().GP.error,'0');
});
test('only two exact in-memory sites are replaced and compact output conserves accounting',()=>{
 const c=compileDriver();assert.deepEqual(c.patches.map(p=>p.occurrences),[1,1]);assert.equal(c.originalSHA256,'fa69d88afa16f363fdaf82194ff3b2445b49b4f7470f8ccec51d2fd588e070d7');
 const r=c.api.runCase({name:'unit_compact'},20261021,{days:1,accounts:6,policy:'current_guard',maxActiveOrders:20,orderHours:168});assert.equal(r.summary.conservation_errors,0);assert.equal(r.summary.role_pnl_errors,0);assert.equal(r.summary.fundedBidOrders,0);assert.equal(r.summary.listingCreated,r.summary.listingSold+r.summary.listingExpired+r.summary.horizonOpenReturned);
});
