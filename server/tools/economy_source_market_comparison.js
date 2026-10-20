#!/usr/bin/env node
'use strict';
// Single source-market dependency substitution in a byte-preserved offline driver.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const Module = require('node:module');
const { performance } = require('node:perf_hooks');
const { units, SCALE } = require('./economy_scenario_simulation');
const ROOT = path.resolve(__dirname, '../..');
const DRIVER = path.join(__dirname, 'economy_behavior_sensitivity.js');
const OLD_OUT = path.resolve(ROOT, '../../outputs/evidence/economy-sensitivity-20261021');
const VERSION = 'source-market-comparison-2026-10-21-v1';
const SOURCE_PROFILE = Object.freeze({ baseListingGP:5, maxActiveListings:20, expiryHours:168, minimumTotalGP:1, maximumTotalGP:999999, dynamicAt5:2, dynamicAt10:4, saleFeeBps:500, dividendBps:2000, referralPaid:0,
  scope:'Authored migration079/082/220 profile; no live settings read. No job buffs/discounts/tariff; ordinary territory; no eligible referral uplines. Dividend schema110 assumed present.' });
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const gp = value => Number(value) / 1000000;
function listingFee(active) { return units(SOURCE_PROFILE.baseListingGP * (active >= 10 ? SOURCE_PROFILE.dynamicAt10 : active >= 5 ? SOURCE_PROFILE.dynamicAt5 : 1)); }

class SourceMarket {
  constructor({ ledger, ownerOf, issueId, metrics, onFill }) {
    Object.assign(this,{ledger,ownerOf,issueId,metrics,onFill});this.orders=[];this.trades=[];
    Object.assign(metrics,{ listingCreated:0,listingSold:0,listingExpired:0,horizonOpenReturned:0,listingUnsupported:0,listingRegistrationDenied:0,purchaseAttempts:0,purchasePriceRefusals:0,purchaseFundingDenials:0,purchaseNoEligibleListing:0,purchaseUnsupportedAsset:0,listingGPFees:0,saleGPFees:0,dividendGPAllocated:0,dynamicListingFeesApplied:0 });
  }
  live(user,side,asset) { return this.orders.filter(o=>o.status==='open'&&o.user===user&&(!side||side==='ask')&&(!asset||asset===o.asset)); }
  place(input) {
    const {user,controller,side,asset,quantity,limit,now,npc=false}=input;
    if(!['bid','ask'].includes(side)||!Number.isSafeInteger(quantity)||quantity<1||typeof limit!=='bigint'||limit<=0n)throw Error('INVALID_SOURCE_MARKET_REQUEST');
    if(side==='bid')return this.purchase({user,controller,asset,maximumUnitPrice:limit,now});
    if(!asset.startsWith('resource:')){this.metrics.listingUnsupported++;return null;}
    const active=this.live(user).length;const price=BigInt(quantity)*limit;
    if(active>=SOURCE_PROFILE.maxActiveListings||price<units(1)||price>units(999999)){this.metrics.listingRegistrationDenied++;return null;}
    const fee=listingFee(active);
    if(this.ledger.balance(user,asset)<BigInt(quantity)||this.ledger.balance(user,'GP')<fee){this.metrics.fundingDenials++;this.metrics.listingRegistrationDenied++;return null;}
    const escrow='source-listing:'+this.issueId();this.ownerOf.set(escrow,user);
    this.ledger.post({id:this.issueId(),actor:'engine',kind:'burn',reason:'order_registration_and_funded_escrow',legs:[
      {account:user,asset:'GP',delta:-fee},{account:'@burn',asset:'GP',delta:fee},
      {account:user,asset,delta:-BigInt(quantity)},{account:escrow,asset,delta:BigInt(quantity)},
    ]});
    const o={id:escrow,user,controller,side:'ask',asset,remaining:quantity,original:quantity,totalPrice:price,limit,created:now,expires:now+168*3600000,npc,status:'open',filled:0};
    this.orders.push(o);this.metrics.listingCreated++;this.metrics.fundedAskOrders++;this.metrics.listingGPFees+=gp(fee);if(active>=5)this.metrics.dynamicListingFeesApplied++;return o;
  }
  purchase({user,controller,asset,maximumUnitPrice,now}) {
    this.metrics.purchaseAttempts++;
    if(!asset.startsWith('resource:')){this.metrics.purchaseUnsupportedAsset++;return null;}
    this.expire(now);
    const candidates=this.orders.filter(o=>o.status==='open'&&o.asset===asset).sort((a,b)=>a.limit===b.limit?a.created-b.created:a.limit<b.limit?-1:1);
    const eligible=candidates.filter(o=>{if(o.controller===controller){this.metrics.commonControlMatchesExcluded++;return false;}return true;});
    if(!eligible.length){this.metrics.purchaseNoEligibleListing++;return null;}
    const ask=eligible[0];
    if(ask.limit>maximumUnitPrice){this.metrics.purchasePriceRefusals++;return null;}
    // Desired quantity does not authorize partial execution. Pay/take the ENTIRE listing.
    const price=ask.totalPrice;const quantity=ask.original;
    if(this.ledger.balance(user,'GP')<price){this.metrics.purchaseFundingDenials++;this.metrics.fundingDenials++;return null;}
    const fee=price*500n/10000n;
    // Current dividends.addToPool rounds nominal20% to6dp, then clamps to captured fee.
    const dividend=(fee*2000n+5000n)/10000n;
    this.ledger.post({id:this.issueId(),actor:'engine',kind:'transform',reason:'funded_market_settlement',legs:[
      {account:user,asset:'GP',delta:-price},{account:ask.user,asset:'GP',delta:price-fee},
      {account:'dividend_pool',asset:'GP',delta:dividend},{account:'@burn',asset:'GP',delta:fee-dividend},
      {account:ask.id,asset,delta:-BigInt(quantity)},{account:user,asset,delta:BigInt(quantity)},
    ].filter(l=>l.delta)});
    ask.remaining=0;ask.filled=quantity;ask.status='sold';this.metrics.trades++;this.metrics[ask.npc?'npcTrades':'humanTrades']++;this.metrics.filledOrders++;this.metrics.listingSold++;this.metrics.saleGPFees+=gp(fee);this.metrics.dividendGPAllocated+=gp(dividend);
    const t={time:now,asset,quantity,unit:ask.limit,amount:price,npc:ask.npc,seller:ask.user,buyer:user};this.trades.push(t);this.onFill(t);return t;
  }
  release(o,reason) {
    if(o.status!=='open')return;
    const quantity=this.ledger.balance(o.id,o.asset);if(quantity)this.ledger.transfer(this.issueId(),o.id,o.user,o.asset,quantity,'engine',reason);
    if(reason==='order_expiry'){o.status='expired';this.metrics.listingExpired++;this.metrics.expiredOrders++;this.metrics.unfilledExpiredOrders++;}
    else{o.status='horizon_returned';this.metrics.horizonOpenReturned++;}
  }
  expire(now) { for(const o of this.orders)if(o.status==='open'&&o.expires<now)this.release(o,'order_expiry');this.orders=this.orders.filter(o=>o.status==='open'); }
  match(now) { this.lastNow=now; this.expire(now); } // No matching engine or persistent bids.
  closeAll() { if(this.lastNow!=null)this.expire(this.lastNow+6*3600000); for(const o of this.orders)this.release(o,'end_of_horizon_return'); }
  askQuantity(asset) { return this.orders.filter(o=>o.status==='open'&&o.asset===asset).reduce((s,o)=>s+o.original,0); }
  cheapest(asset) { const p=this.orders.filter(o=>o.status==='open'&&o.asset===asset).map(o=>o.limit);return p.length?p.reduce((a,b)=>a<b?a:b):null; }
}

function compileDriver(sourceMarket=true) {
  const original=fs.readFileSync(DRIVER,'utf8');const needle='const book = new OrderBook({';const occurrences=original.split(needle).length-1;
  if(occurrences!==1)throw Error('EXPECTED_ONE_MARKET_DEPENDENCY_SITE:'+occurrences);
  const replacement="const book = new (require('./economy_source_market_comparison').SourceMarket)({";
  const compiledSource=sourceMarket?original.replace(needle,replacement):original;
  const m=new Module(DRIVER,module);m.filename=DRIVER;m.paths=Module._nodeModulePaths(path.dirname(DRIVER));m._compile(compiledSource,DRIVER);
  return {api:m.exports,originalSHA256:sha(original),compiledSHA256:sha(compiledSource),occurrences,mutation:sourceMarket?'one exact constructor dependency substitution in memory; source file untouched':'unchanged source compilation'};
}
function csv(rows){if(!rows.length)return'';const keys=Object.keys(rows[0]);const q=v=>v==null?'':/[",\n]/.test(String(v))?'"'+String(v).replaceAll('"','""')+'"':String(v);return keys.join(',')+'\n'+rows.map(r=>keys.map(k=>q(r[k])).join(',')).join('\n')+'\n';}
function preserveHashInventory(){return Object.fromEntries(fs.readdirSync(OLD_OUT).filter(n=>fs.statSync(path.join(OLD_OUT,n)).isFile()).sort().map(n=>[n,sha(fs.readFileSync(path.join(OLD_OUT,n)))]));}
function verifyBaselineCompilation(){const original=require('./economy_behavior_sensitivity');const unchanged=compileDriver(false);const a=original.runCase({name:'baseline_compile_probe'},20261021,{days:2,accounts:6});const b=unchanged.api.runCase({name:'baseline_compile_probe'},20261021,{days:2,accounts:6});if(JSON.stringify(a)!==JSON.stringify(b))throw Error('UNCHANGED_BASELINE_COMPILE_DIFFERS');return{identical:true,days:2,accounts:6,sha256:sha(JSON.stringify(a)),originalDriverSHA256:unchanged.originalSHA256};}
function main(out){
  const start=performance.now();const cpuStart=process.cpuUsage();let peakHeap=0;const priorCpuMs=73933.152;const limits={wallMs:30000,cpuMs:15000,heapBytes:768*1024*1024,artifactBytes:20*1024*1024,fullRuns:9};
  const checkpoint=()=>{const cpu=process.cpuUsage(cpuStart);peakHeap=Math.max(peakHeap,process.memoryUsage().heapUsed);if(performance.now()-start>limits.wallMs||(cpu.user+cpu.system)/1000>limits.cpuMs||peakHeap>limits.heapBytes)throw Error('SOURCE_COMPARISON_RESOURCE_BUDGET_EXCEEDED');};
  const before=preserveHashInventory();const frozenSHA=sha(fs.readFileSync(path.join(__dirname,'economy_scenario_simulation.js')));const compiled=compileDriver();const baselineProbe=verifyBaselineCompilation();
  const compactA=compiled.api.runCase({name:'source_compact_probe'},20261021,{days:2,accounts:6,maxActiveOrders:20,orderHours:168,checkpoint});const compactB=compiled.api.runCase({name:'source_compact_probe'},20261021,{days:2,accounts:6,maxActiveOrders:20,orderHours:168,checkpoint});
  const compactSHA=sha(csv(compactA.daily));if(compactSHA!==sha(csv(compactB.daily)))throw Error('SOURCE_COMPACT_REPLAY_CHANGED');
  const old=JSON.parse(fs.readFileSync(path.join(OLD_OUT,'summary.json'),'utf8'));const profiles=['mixed_medium','buyer_shortage','bots_matched_capital'];const seeds=[20261021,20261022,20261023];const runs=[];const joined=[];
  for(const seed of seeds)for(const name of profiles){checkpoint();const profile=compiled.api.PROFILES.find(p=>p.name===name);const r=compiled.api.runCase(profile,seed,{maxActiveOrders:20,orderHours:168,checkpoint});const s=r.summary;Object.assign(s,{source_mode:'fixed_ask_whole_lot_immediate_buy',listingOutcomeError:s.listingCreated-s.listingSold-s.listingExpired-s.horizonOpenReturned,purchaseOutcomeError:s.purchaseAttempts-s.listingSold-s.purchaseNoEligibleListing-s.purchasePriceRefusals-s.purchaseFundingDenials-s.purchaseUnsupportedAsset,sold_over_created_pct:s.listingCreated?s.listingSold/s.listingCreated*100:0});if(s.listingOutcomeError||s.purchaseOutcomeError||s.fundedBidOrders!==0)throw Error('SOURCE_MARKET_OUTCOME_NOT_RECONCILED');
    const baseline=old.runs.find(x=>x.summary.profile===name&&x.summary.seed===seed);if(!baseline)throw Error('FROZEN_BASELINE_MISSING');
    const row={profile:name,seed,source_mode:s.source_mode};for(const key of ['gp_issuance_ex_opening','gp_true_burn','net_gp_issuance_ex_opening','trades','humanTrades','npcTrades','iron_traded','iron_vwap_gp','iron_final_global_inventory','bot_gp_share_pct','top_controller_pct']){row['baseline_'+key]=baseline.summary[key];row['source_'+key]=s[key];row['difference_'+key]=s[key]==null||baseline.summary[key]==null?null:Number(s[key])-Number(baseline.summary[key]);}joined.push(row);runs.push(r);
  }
  checkpoint();const after=preserveHashInventory();if(JSON.stringify(before)!==JSON.stringify(after))throw Error('FROZEN42_ARTIFACT_CHANGED');if(compiled.originalSHA256!==sha(fs.readFileSync(DRIVER)))throw Error('FROZEN_DRIVER_CHANGED');
  const sourcePaths=['server/tools/economy_source_market_comparison.js','server/tests/economy-source-market-comparison.test.js','server/tools/economy_behavior_sensitivity.js','server/tools/economy_scenario_simulation.js','server/services/marketplace.js','server/services/dividends.js','server/db.js','server/migrations/079_marketplace.sql','server/migrations/082_bible_migration080_settings.sql','server/migrations/173_economy_balance_pack.sql','server/migrations/220_economy_balance_sea.sql'];
  const params={version:VERSION,sourceProfile:SOURCE_PROFILE,profiles,seeds,driverOptions:{days:112,accounts:48,stepHours:6,orderHours:168,maxActiveOrders:20},baselineDriverOptions:{orderHours:120,maxActiveOrders:3},sources:sourcePaths.map(file=>({path:file,sha256:sha(fs.readFileSync(path.join(ROOT,file)))})),inMemorySubstitution:{occurrences:compiled.occurrences,originalSHA256:compiled.originalSHA256,compiledSHA256:compiled.compiledSHA256,mutation:compiled.mutation},assumptions:['Willingness/unit limits/selection/roles/resources remain synthetic. Buyer chooses lowest unit ask and buys entire lot even if desiredqty is5 and listingqty10.','No job buffs, listing/fee discounts, tariffs or eligible referral uplines. Dividend schema110 assumed and20%rounded allocation kept out of trueburn.','No resource stack item:energy_shield sales: crafting stacks are not marketplace item_instances; unsupported attempts counted separately.','MaxActiveOrders20 replaces synthetic3 so seller listing counts do not block source purchase choices. Per-asset one-listing preference retained; dynamic5/10bands are unit tested but not usually reached.','Source expiry168h with strict expires_at<now eligibility; source cron5min is approximated at6h model decisions. Horizon returns are not called actual expiries.','Same seed does not ensure identical later actions because market branch paths consume a shared RNG differently. Descriptive condition comparison, not paired causal inference or statistical confidence interval.','Old filledOrders/expiredOrders count asks+bids and mix horizon returns. Do not subtract those metrics from new single listing outcomes.','All other whole-game scope limitations of frozen behavior model remain. No DB/service/concurrency/fullgame replay or live setting verification.']};
  const data={'summary.csv':csv(runs.map(r=>r.summary)),'daily.csv':csv(runs.flatMap(r=>r.daily.map(d=>({...d,source_mode:'fixed_ask_whole_lot_immediate_buy'})))),'comparison.csv':csv(joined),'summary.json':JSON.stringify({version:VERSION,runs:runs.map(({daily,...r})=>r),comparison:joined,baselineMetricBoundary:'Only common monetary/resource/trade/concentration metrics are joined; old dual-side expiry/completion percentages are not comparable.'},null,2)+'\n','parameters.json':JSON.stringify(params,null,2)+'\n'};
  const bytes=Object.values(data).reduce((n,s)=>n+Buffer.byteLength(s),0);if(bytes>limits.artifactBytes)throw Error('SOURCE_ARTIFACT_SIZE_EXCEEDED');fs.mkdirSync(out,{recursive:true});for(const [name,value]of Object.entries(data))fs.writeFileSync(path.join(out,name),value);
  const cpu=process.cpuUsage(cpuStart);const receipt={version:VERSION,status:'completed',fullRuns:runs.length,fullRunRepetitions:1,virtualDays:112,accounts:48,wallMs:performance.now()-start,cpuMs:(cpu.user+cpu.system)/1000,cumulativeKnownModelCPUms:priorCpuMs+(cpu.user+cpu.system)/1000,priorKnownModelCPUms:priorCpuMs,peakObservedHeapBytes:peakHeap,maxRSSBytes:process.resourceUsage().maxRSS*1024,artifactBytes:bytes,limits,baselineCompilationProbe:baselineProbe,compactReplay:{identicalDailyCSV:true,days:2,accounts:6,sha256:compactSHA},preserved42Files:before,allFrozenArtifactsUnchanged:true,originalDriverSHA256:compiled.originalSHA256,frozenAccountingSHA256:frozenSHA,inMemoryConstructorSubstitutions:compiled.occurrences,files:Object.fromEntries(Object.entries(data).map(([name,value])=>[name,{bytes:Buffer.byteLength(value),sha256:sha(value)}])),cleanup:'No server, subprocess, network, externalpackages, DB, credentials, accounts, wallets, deploy or full eventlogs. Existing42 artifacts read only.'};
  fs.writeFileSync(path.join(out,'run-receipt.json'),JSON.stringify(receipt,null,2)+'\n');process.stdout.write(JSON.stringify(receipt,null,2)+'\n');
}
module.exports={VERSION,SOURCE_PROFILE,SourceMarket,listingFee,compileDriver,verifyBaselineCompilation,csv,main};
if(require.main===module){const args=process.argv.slice(2);if(args.length!==2||args[0]!=='--out')throw Error('Usage: node --max-old-space-size=768 server/tools/economy_source_market_comparison.js --out newdirectory');main(path.resolve(args[1]));}
