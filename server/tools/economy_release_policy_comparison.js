#!/usr/bin/env node
'use strict';
// Offline release-policy slice. Frozen drivers/evidence are read-only dependencies.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),Module=require('node:module'),vm=require('node:vm');
const {performance}=require('node:perf_hooks');
const {units}=require('./economy_scenario_simulation');
const {SourceMarket,listingFee,csv}=require('./economy_source_market_comparison');
const ROOT=path.resolve(__dirname,'../..'),DRIVER=path.join(__dirname,'economy_behavior_sensitivity.js');
const VERSION='release-policy-comparison-2026-10-21-v1';
const POLICIES=Object.freeze({
 current_guard:{kind:'reference',proposalUptake:0,miningAccountCapGP:1500},
 fee_one_percent_capped5:{kind:'synthetic_opt_in',proposalUptake:0,miningAccountCapGP:1500,fee:'min(5GP,floor(bundleTotal*1% to6dp)); no dynamic multiplier'},
 mining_account_cap150:{kind:'synthetic_opt_in',proposalUptake:0,miningAccountCapGP:150},
 mining_controller_cap150:{kind:'synthetic_opt_in',proposalUptake:0,miningAccountCapGP:1500,miningControllerCapGP:150},
 npc_funded_reprocurement:{kind:'synthetic_opt_in',proposalUptake:0,miningAccountCapGP:1500,npc:{dailyMaxPurchases:1,stockCeilingPerResource:40,reserveGP:10,maxUnitPrice:{iron_ore:'0.6',carbon_fiber:'1',silicon_chip:'1.4'}}},
});
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
const gp=x=>Number(x)/1e6;
const serviceSource=fs.readFileSync(path.join(ROOT,'server/services/marketplace.js'),'utf8');
const safetyStart=serviceSource.indexOf('function resourceListingSafety('),safetyEnd=serviceSource.indexOf('// Shared by the read-only seller preview',safetyStart);
if(safetyStart<0||safetyEnd<0)throw Error('MISSING_CURRENT_PURE_GUARD');
const safetySource=serviceSource.slice(safetyStart,safetyEnd).trim();
const currentSafety=vm.runInNewContext('('+safetySource+')',{}, {timeout:1000});
function feeFor(policy,active,total){if(policy==='fee_one_percent_capped5'){const grossFee=total/100n;return grossFee<units(5)?grossFee:units(5);}return listingFee(active);}
function checkSafety(price,fee,quantity){return currentSafety({currency:'GP',price:gp(price),listingFeeGp:gp(fee),minPrice:1,maxPrice:999999},{fee:Math.floor(gp(price)*5/100*1e6)/1e6,feePct:5},quantity);}
class ReleaseMarket extends SourceMarket {
 constructor(options,policy='current_guard'){
  super(options);if(!POLICIES[policy])throw Error('UNKNOWN_POLICY');this.policy=policy;this.lastNpcDay=null;
  Object.assign(this.metrics,{listingAttempts:0,listingGuardDenied:0,listingGuardDeniedGPFeesAvoided:0,proposalAvailable:0,proposalAdopted:0,npcProcurementAttempts:0,npcProcurementBought:0,npcProcurementSpendGP:0,npcProcurementReserveDenied:0,npcProcurementStockDenied:0,policyMiningCapHits:0,policyMiningGPNotIssued:0});
 }
 place(input){
  const {user,controller,side,asset,quantity,limit,now,npc=false}=input;
  if(!['bid','ask'].includes(side)||!Number.isSafeInteger(quantity)||quantity<1||typeof limit!=='bigint'||limit<=0n)throw Error('INVALID_RELEASE_MARKET_REQUEST');
  if(side==='bid')return this.purchase({user,controller,asset,maximumUnitPrice:limit,now});
  this.metrics.listingAttempts++;
  if(!asset.startsWith('resource:')){this.metrics.listingUnsupported++;return null;}
  const active=this.live(user).length,price=BigInt(quantity)*limit;
  if(active>=20||price<units(1)||price>units(999999)){this.metrics.listingRegistrationDenied++;return null;}
  const fee=feeFor(this.policy,active,price),safety=checkSafety(price,fee,quantity);
  if(safety.blocked){this.metrics.listingGuardDenied++;this.metrics.listingGuardDeniedGPFeesAvoided+=gp(fee);if(safety.suggestedQuantity!=null)this.metrics.proposalAvailable++;return null;}
  if(this.ledger.balance(user,asset)<BigInt(quantity)||this.ledger.balance(user,'GP')<fee){this.metrics.fundingDenials++;this.metrics.listingRegistrationDenied++;return null;}
  const escrow='release-listing:'+this.issueId();this.ownerOf.set(escrow,user);
  this.ledger.post({id:this.issueId(),actor:'engine',kind:'burn',reason:'order_registration_and_funded_escrow',legs:[
   {account:user,asset:'GP',delta:-fee},{account:'@burn',asset:'GP',delta:fee},
   {account:user,asset,delta:-BigInt(quantity)},{account:escrow,asset,delta:BigInt(quantity)},
  ].filter(l=>l.delta)});
  const o={id:escrow,user,controller,side:'ask',asset,remaining:quantity,original:quantity,totalPrice:price,limit,created:now,expires:now+168*3600000,npc,status:'open',filled:0};
  this.orders.push(o);this.metrics.listingCreated++;this.metrics.fundedAskOrders++;this.metrics.listingGPFees+=gp(fee);if(active>=5&&this.policy!=='fee_one_percent_capped5')this.metrics.dynamicListingFeesApplied++;return o;
 }
 match(now){
  super.match(now);if(this.policy!=='npc_funded_reprocurement')return;
  const day=Math.floor(now/(24*3600000));if(day===this.lastNpcDay)return;this.lastNpcDay=day;
  for(const [code,anchor]of Object.entries(POLICIES[this.policy].npc.maxUnitPrice)){
   const asset='resource:'+code;
   const inventory=this.ledger.balance('npc',asset)+BigInt(this.live('npc','ask',asset).reduce((n,o)=>n+o.original,0));
   const candidate=this.orders.filter(o=>o.status==='open'&&o.asset===asset&&o.controller!=='NPC').sort((a,b)=>a.limit===b.limit?a.created-b.created:a.limit<b.limit?-1:1)[0];
   if(!candidate||candidate.limit>units(anchor))continue;
   if(inventory+BigInt(candidate.original)>40n){this.metrics.npcProcurementStockDenied++;continue;}
   this.metrics.npcProcurementAttempts++;
   if(this.ledger.balance('npc','GP')<candidate.totalPrice+units(10)){this.metrics.npcProcurementReserveDenied++;continue;}
   const trade=this.purchase({user:'npc',controller:'NPC',asset,maximumUnitPrice:units(anchor),now});
   if(trade){this.metrics.npcProcurementBought++;this.metrics.npcProcurementSpendGP+=gp(trade.amount);break;}
  }
 }
}
function marketFor(policy){return class extends ReleaseMarket{constructor(options){super(options,policy||'current_guard');}};}
function miningReward(p,u,due,raw,used,metrics){
 const config=POLICIES[p.policy||'current_guard'];if(!config)throw Error('UNKNOWN_POLICY');
 let room=units(config.miningAccountCapGP)-used;
 if(config.miningControllerCapGP){
  if(!p._controllerHistory)Object.defineProperty(p,'_controllerHistory',{value:new Map(),enumerable:false});
  const history=(p._controllerHistory.get(u.controller)||[]).filter(r=>r.time>due-24*3600000);
  const controllerRoom=units(config.miningControllerCapGP)-history.reduce((sum,r)=>sum+r.gp,0n);room=room<controllerRoom?room:controllerRoom;
  const reward=raw<room?raw:room>0n?room:0n;history.push({time:due,gp:reward});p._controllerHistory.set(u.controller,history);
  if(reward<raw){metrics.policyMiningCapHits++;metrics.policyMiningGPNotIssued+=gp(raw-reward);}return reward;
 }
 const reward=raw<room?raw:room>0n?room:0n;if(reward<raw){metrics.policyMiningCapHits++;metrics.policyMiningGPNotIssued+=gp(raw-reward);}return reward;
}
function compileDriver(){
 const original=fs.readFileSync(DRIVER,'utf8');let compiled=original;const patches=[];
 for(const [label,needle,replacement]of [
  ['market_constructor','const book = new OrderBook({',"const book = new (require('./economy_release_policy_comparison').marketFor(p.policy))({"],
  ['mining_reward','const room = units(1500) - used; const reward = raw < room ? raw : room > 0n ? room : 0n;',"const reward = require('./economy_release_policy_comparison').miningReward(p,u,job.due,raw,used,metrics);"],
 ]){const occurrences=compiled.split(needle).length-1;if(occurrences!==1)throw Error('EXPECTED_ONE_PATCH:'+label+':'+occurrences);compiled=compiled.replace(needle,replacement);patches.push({label,occurrences});}
 const m=new Module(DRIVER,module);m.filename=DRIVER;m.paths=Module._nodeModulePaths(path.dirname(DRIVER));m._compile(compiled,DRIVER);
 return {api:m.exports,patches,originalSHA256:sha(original),compiledSHA256:sha(compiled)};
}
function inventory(){const result={};for(const dir of ['economy-sensitivity-20261021','economy-source-market-20261021']){const absolute=path.resolve(ROOT,'../../outputs/evidence',dir);for(const file of fs.readdirSync(absolute).sort())if(fs.statSync(path.join(absolute,file)).isFile())result[dir+'/'+file]=sha(fs.readFileSync(path.join(absolute,file)));}for(const name of ['economy_scenario_simulation.js','economy_behavior_sensitivity.js','economy_source_market_comparison.js'])result['tools/'+name]=sha(fs.readFileSync(path.join(__dirname,name)));return result;}
function main(out){
 if(fs.existsSync(out))throw Error('NEW_OUTPUT_DIRECTORY_REQUIRED');fs.mkdirSync(out,{recursive:true});
 const start=performance.now(),cpuStart=process.cpuUsage(),priorCPUms=77770.228,limits={cpuMs:12000,wallMs:25000,heapBytes:768*1024*1024,artifactBytes:20*1024*1024,fullRuns:17};let peak=0;
 const runs=[],before=inventory();const compiled=compileDriver();
 const checkpoint=()=>{peak=Math.max(peak,process.memoryUsage().heapUsed);const c=process.cpuUsage(cpuStart);if((c.user+c.system)/1000>limits.cpuMs||performance.now()-start>limits.wallMs||peak>limits.heapBytes)throw Error('RELEASE_POLICY_BUDGET_EXCEEDED');};
 const save=(name,value)=>{const text=typeof value==='string'?value:JSON.stringify(value,null,2)+'\n';if(Buffer.byteLength(text)>limits.artifactBytes)throw Error('ARTIFACT_LIMIT');fs.writeFileSync(path.join(out,name),text);};
 const receipt=status=>{const c=process.cpuUsage(cpuStart);return{version:VERSION,status,fullRuns:runs.length,fullRunRepetitions:1,virtualDays:112,accounts:48,wallMs:performance.now()-start,cpuMs:(c.user+c.system)/1000,priorKnownModelCPUms:priorCPUms,cumulativeKnownModelCPUms:priorCPUms+(c.user+c.system)/1000,peakObservedHeapBytes:peak,maxRSSBytes:process.resourceUsage().maxRSS*1024,limits,inMemoryPatches:compiled.patches,preservedBefore:before};};
 const sourcePaths=['server/tools/economy_release_policy_comparison.js','server/tests/economy-release-policy-comparison.test.js','server/tools/economy_scenario_simulation.js','server/tools/economy_behavior_sensitivity.js','server/tools/economy_source_market_comparison.js','server/services/marketplace.js','server/services/shipMining.js','server/services/npcEconomy.js'];
 save('parameters.json',{version:VERSION,policies:POLICIES,seeds:[20261021,20261022,20261023],profiles:['mixed_medium','buyer_shortage','bots_matched_capital'],options:{days:112,accounts:48,stepHours:6,maxActiveOrders:20,orderHours:168},currentPureGuardSHA256:sha(safetySource),sources:sourcePaths.map(file=>({path:file,sha256:sha(fs.readFileSync(path.join(ROOT,file)))})),compiled:{originalSHA256:compiled.originalSHA256,compiledSHA256:compiled.compiledSHA256,patches:compiled.patches},omissions:['proposal uptake >0 not executed: guard effect is separated from seller adaptation','no actual NPC procurement or controller detection exists in source; candidates are synthetic opt-in only','mining account cap100 and alternative cap levels not run;150 selected from requested candidate, not optimized','same seed is descriptive; shared RNG paths may diverge','existing selected-mechanic coverage only; not full service/API/DB replay; source-policy audit omissions remain','no GP/PP cash rights, no new entrants/appreciation as income, USDT custody remains separate']});
 try{
  const execute=(profile,seed,policy)=>{checkpoint();const result=compiled.api.runCase(profile,seed,{policy,maxActiveOrders:20,orderHours:168,checkpoint});const s=result.summary;Object.assign(s,{policy,source_mode:'release_guard_fixed_ask_whole_lot',proposal_uptake:0,listingOutcomeError:s.listingCreated-s.listingSold-s.listingExpired-s.horizonOpenReturned,purchaseOutcomeError:s.purchaseAttempts-s.listingSold-s.purchaseNoEligibleListing-s.purchasePriceRefusals-s.purchaseFundingDenials-s.purchaseUnsupportedAsset});
   if(s.listingOutcomeError||s.purchaseOutcomeError||s.conservation_errors||s.role_pnl_errors||s.fundedBidOrders||s.cash_error!=='0'||s.claim_error!=='0')throw Error('RUN_INVARIANT_FAILED');runs.push(result);save('run-progress.json',{...receipt('running'),completed:runs.map(r=>({profile:r.summary.profile,seed:r.summary.seed,policy:r.summary.policy}))});return result;};
  for(const seed of [20261021,20261022,20261023])for(const name of ['mixed_medium','buyer_shortage','bots_matched_capital'])execute(compiled.api.PROFILES.find(p=>p.name===name),seed,'current_guard');
  save('reference-summary.json',{version:VERSION,runs:runs.map(({daily,...r})=>r)});process.stdout.write(JSON.stringify({stage:'reference_complete',runs:runs.length,cpuMs:receipt('running').cpuMs,reference:runs.map(r=>({profile:r.summary.profile,seed:r.summary.seed,net:r.summary.net_gp_issuance_ex_opening,trades:r.summary.trades,guardDenied:r.summary.listingGuardDenied}))})+'\n');
  for(const policy of Object.keys(POLICIES).filter(p=>p!=='current_guard'))for(const name of ['mixed_medium','bots_matched_capital'])execute(compiled.api.PROFILES.find(p=>p.name===name),20261021,policy);
  const compactOptions={days:2,accounts:6,maxActiveOrders:20,orderHours:168,policy:'current_guard',checkpoint};const a=compiled.api.runCase({name:'compact'},20261021,compactOptions),b=compiled.api.runCase({name:'compact'},20261021,compactOptions);if(csv(a.daily)!==csv(b.daily))throw Error('COMPACT_REPLAY_CHANGED');checkpoint();
  const old=JSON.parse(fs.readFileSync(path.resolve(ROOT,'../../outputs/evidence/economy-source-market-20261021/summary.json'),'utf8'));
  const keys=['gp_issuance_ex_opening','gp_true_burn','net_gp_issuance_ex_opening','trades','iron_traded','iron_vwap_gp','iron_final_global_inventory','bot_gp_share_pct','top_controller_pct'];
  const comparison=runs.map(r=>{const s=r.summary,baseline=s.policy==='current_guard'?old.runs.find(r=>r.summary.profile===s.profile&&r.summary.seed===s.seed):runs.find(r=>r.summary.policy==='current_guard'&&r.summary.profile===s.profile&&r.summary.seed===s.seed);if(!baseline)throw Error('MISSING_BASELINE');const row={profile:s.profile,seed:s.seed,policy:s.policy,comparison_to:s.policy==='current_guard'?'frozen_source_without_guard':'current_guard'};for(const k of keys){row['baseline_'+k]=baseline.summary[k];row['release_'+k]=s[k];row['difference_'+k]=s[k]==null||baseline.summary[k]==null?null:Number(s[k])-Number(baseline.summary[k]);}return row;});
  save('summary.json',{version:VERSION,runs:runs.map(({daily,...r})=>r),comparison});save('summary.csv',csv(runs.map(r=>r.summary)));save('daily.csv',csv(runs.flatMap(r=>r.daily.map(d=>({...d,policy:r.summary.policy,source_mode:r.summary.source_mode})))));save('comparison.csv',csv(comparison));
  const after=inventory();if(JSON.stringify(before)!==JSON.stringify(after))throw Error('FROZEN_INPUT_CHANGED');const files={};let bytes=0;for(const name of fs.readdirSync(out)){const data=fs.readFileSync(path.join(out,name));bytes+=data.length;files[name]={bytes:data.length,sha256:sha(data)};}if(bytes>limits.artifactBytes)throw Error('AGGREGATE_ARTIFACT_LIMIT');
  const final={...receipt('completed'),allFrozenInputsUnchanged:true,artifactBytes:bytes,files,compactReplay:{days:2,accounts:6,executions:2,identicalDailyCSV:true,sha256:sha(csv(a.daily))},cleanup:'No app code mutations, network, packages, DB, env, accounts, wallets, chain, deploy, subprocess or full event logs; frozen42+9 artifacts only read.'};save('run-receipt.json',final);process.stdout.write(JSON.stringify(final)+'\n');
 }catch(e){save('partial-summary.json',{version:VERSION,runs:runs.map(({daily,...r})=>r)});save('run-receipt.json',{...receipt('partial_or_failed'),error:e.message,allFrozenInputsUnchanged:JSON.stringify(before)===JSON.stringify(inventory())});throw e;}
}
module.exports={VERSION,POLICIES,ReleaseMarket,marketFor,feeFor,checkSafety,miningReward,compileDriver,currentSafety,safetySource,main};
if(require.main===module){const args=process.argv.slice(2);if(args.length!==2||args[0]!=='--out')throw Error('Usage: node --max-old-space-size=768 server/tools/economy_release_policy_comparison.js --out NEW_DIRECTORY');main(path.resolve(args[1]));}
