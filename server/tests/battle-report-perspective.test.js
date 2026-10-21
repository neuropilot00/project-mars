'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.resolve(__dirname,'../../assets/battle-hub-modal.js'),'utf8');
const languages=['en','ko','ja','zh','id','vi','th'];
const report={winner_side:'atk',result:'attacker_win',
 atk:{shipsDeployed:3,shipsDestroyed:0,class_breakdown:[{class_label:'frigate',survival_pct:100,survived:3,deployed:3,perf_label:'핵심 기여'}],role_counts:{dps:2,tackle:1}},
 def:{shipsDeployed:1,shipsDestroyed:1,class_breakdown:[],role_counts:{dps:1}},
 event_stats:{skillsUsed:{atk:{beam:1,missile:0,overdrive:0,emp:0},def:{beam:0,missile:0,overdrive:0,emp:0}},manualSkillDamage:{atk:216,def:0},flagshipDestroyed:{atk:false,def:true},repairDone:{atk:0,def:0}},
 analysis_items:[{code:'flagship_lost',text:'기함이 격침되며 전투 통제력이 무너졌습니다.'},{code:'manual_skill_gap',text:'상대는 전술 스킬을 사용했지만 내 함대는 결정타 스킬을 쓰지 못했습니다.'}],recommendations_ko:['수동 스킬을 쓰세요.']};
function fixture(lang='en',payload=report){
 const section={innerHTML:''};const index=languages.indexOf(lang),calls=[];
 const c={LANG:lang,bv:{battle:{winner_side:payload.winner_side}},document:{getElementById:()=>section},escapeHtml:text=>String(text).replace(/</g,'&lt;'),formatNum:value=>String(value),tl:(...args)=>{calls.push(args);return args[index]||args[0];},t:key=>key,shipRoleInfo:role=>({label:role}),isObjectiveBattle:()=>false,renderBattleReportAllianceBanner:()=>'',battleHubReadKeyed:async key=>key.startsWith('battle-report:')?{report:payload}:{highlights:[]}};
 vm.createContext(c);vm.runInContext(source.slice(source.indexOf('// Legacy analysis strings describe'),source.indexOf('function renderBattleReportAllianceBanner(')),c);
 vm.runInContext(source.slice(source.indexOf('function battleResultContinuation('),source.indexOf('function battleObjectiveResult(')),c);
 return{c,section,calls};
}
function row(html,key){return html.match(new RegExp('data-observation="'+key+'"[^>]*>([^<]*)<'))?.[1];}
test('actual report loader shows the winning beam user records, never the losing-side heuristic or causal headline',async()=>{
 const{c,section}=fixture();await c._loadBattleReport(1,'atk');const html=section.innerHTML;
 assert.match(row(html,'skills'),/you 1; opponent 0/);assert.match(row(html,'skill-damage'),/you 216; opponent 0/);assert.match(row(html,'flagships'),/you 0; opponent 1/);assert.match(row(html,'losses'),/you 0\/3; opponent 1\/1/);
 assert.ok(!/because|Won because|기함이 격침|결정타|핵심 기여|수동 스킬을 쓰세요/.test(html));assert.ok(!/[가-힣]/.test(html));
});
test('the same response reverses every observation for the defender without changing the actual winner',async()=>{
 const{c,section}=fixture();await c._loadBattleReport(1,'def');assert.match(row(section.innerHTML,'skills'),/you 0; opponent 1/);assert.match(row(section.innerHTML,'skill-damage'),/you 0; opponent 216/);assert.match(row(section.innerHTML,'flagships'),/you 1; opponent 0/);assert.equal(report.winner_side,'atk');
});
for(const lang of languages)test('viewer-relative observations have explicit copy in '+lang,async()=>{
 const{c,section,calls}=fixture(lang);await c._loadBattleReport(1,'atk');assert.ok(section.innerHTML.includes('data-battle-observations'));
 const observationCalls=calls.filter(args=>/^(Ships lost:|Recorded skill uses:|Recorded skill damage:|Recorded flagship losses:|Recorded battle observations)/.test(args[0]));assert.equal(observationCalls.length,5);for(const args of observationCalls){assert.equal(args.length,7);assert.ok(args.every(text=>typeof text==='string'&&text.length>5));if(lang!=='en')assert.notEqual(args[languages.indexOf(lang)],args[0]);}
 assert.ok(!section.innerHTML.includes('기함이 격침되며 전투 통제력이 무너졌습니다.'));
});
test('missing records and observers never receive invented zero facts',()=>{
 const{c}=fixture();assert.equal(c.renderBattleReportObservations({},'atk'),'');assert.equal(c.renderBattleReportObservations(report,null),'');assert.equal(c.renderBattleReportObservations({analysis_items:report.analysis_items},'def'),'');
});
test('first-sortie participants return to Missions for claim/retry, ordinary PvP and spectators keep Front',()=>{
 const{c}=fixture();const starter={winner_side:'atk',battle_summary:{is_starter_battle:true,trusted_source:'starter_ops',missionId:'first_sortie'}};
 assert.equal(c.battleResultContinuation(starter,'atk').tab,'missions');assert.match(c.battleResultContinuation(starter,'atk').label,/claim and continue/);assert.match(c.battleResultContinuation(starter,'def').label,/retry sortie/);
 assert.equal(c.battleResultContinuation({...starter,battle_summary:{}},'atk').tab,'front');assert.equal(c.battleResultContinuation(starter,null).tab,'front');
});

test('objective results keep their dedicated result path without ordinary battle observations',async()=>{
 const{c,section}=fixture();c.isObjectiveBattle=()=>true;await c._loadBattleReport(1,'atk');assert.ok(!section.innerHTML.includes('data-battle-observations'));assert.ok(!section.innerHTML.includes('기함이 격침'));
});

function realReportTransport(f, fetcher) {
 const runtime=fs.readFileSync(path.resolve(__dirname,'../../assets/core-runtime.js'),'utf8');
 Object.assign(f.c,{URL,location:{origin:'https://fixture.invalid'},_apiFetchGuards:{},_apiEndpointGuards:{},_isPublicHudFetchPath:()=>false,getAuthHeaders:()=>({Authorization:'Bearer public-dummy-fixture-token'}),getMyWallet:()=> 'COMMANDER',fetch:fetcher});
 vm.runInContext(runtime.slice(runtime.indexOf('function _guardedFetchEndpointKey('),runtime.indexOf('function _clearActiveTimeout(')),f.c);
 vm.runInContext(source.slice(source.indexOf('function battleHubReadFetch('),source.indexOf('function normalizeBattleSummary(')),f.c);
}
for(const failure of ['http','network','invalid'])test('actual report '+failure+' failure renders Retry and the immediate same-ID retry restores real observations without duplicate in-flight reads',async()=>{
 const f=fixture();const requests=[];let online=false,release;
 realReportTransport(f,async(url,options)=>{
  requests.push({url,options});
  if(url.endsWith('/highlights'))return{ok:true,status:200,json:async()=>({highlights:[]})};
  if(!online){if(failure==='network')throw Error('offline fixture');return{ok:failure==='invalid',status:failure==='http'?503:200,json:async()=>({error:'report unavailable'})};}
  await new Promise(resolve=>{release=resolve;});return{ok:true,status:200,json:async()=>({report})};
 });
 await f.c._loadBattleReport(1,'atk');
 assert.ok(f.section.innerHTML.includes('bv_report_error'));assert.ok(!f.section.innerHTML.includes('data-battle-observations'));
 const click=f.section.innerHTML.match(/onclick="(_loadBattleReport\(1,'atk',true\))"/);assert.ok(click);
 const retryLabels=f.calls.filter(args=>args[0]==='Retry');assert.equal(retryLabels.length,1);assert.equal(retryLabels[0].length,7);
 online=true;const pending=vm.runInContext(click[1],f.c);const duplicate=vm.runInContext(click[1],f.c);
 assert.equal(requests.length,2,'retry bypasses only minGap and duplicate click sends no second report request');assert.equal(f.section._battleReportLoading,true);
 assert.ok(f.section.innerHTML.includes('bv_report_loading'));assert.ok(!f.section.innerHTML.includes('onclick="_loadBattleReport'));
 release();await Promise.all([pending,duplicate]);
 assert.match(row(f.section.innerHTML,'skill-damage'),/you 216; opponent 0/);assert.match(row(f.section.innerHTML,'skills'),/you 1; opponent 0/);
 assert.equal(f.c.bv.battle.winner_side,'atk');assert.equal(f.section._battleReportLoading,false);assert.equal(requests.filter(r=>r.url.endsWith('/report')).length,2);
 assert.ok(requests.every(r=>!r.options.method||r.options.method==='GET'));
});
test('manual report retry preserves real 429 endpoint backoff',async()=>{
 const f=fixture();let reads=0;
 realReportTransport(f,async()=>{reads++;return{status:429,ok:false,headers:{get:()=> '120'}};});
 await f.c._loadBattleReport(1,'def');await f.c._loadBattleReport(1,'def',true);
 assert.equal(reads,1);assert.ok(f.section.innerHTML.includes("_loadBattleReport(1,'def',true)"));assert.ok(!f.section.innerHTML.includes('data-battle-observations'));assert.equal(f.section._battleReportLoading,false);
});
