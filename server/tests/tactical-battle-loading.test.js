'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'../..');
const routeSource=fs.readFileSync(path.join(root,'server/routes/tacticalLab.js'),'utf8');
const script=fs.readFileSync(path.join(root,'assets/tactical-lab-v11.html'),'utf8').match(/<script>([\s\S]*)<\/script>/)[1];
const participant={fleet_id:'31',side:'atk',owner_wallet:'dummy-owner',nick:'Dummy',owner_faction:'MCC'};
const catalog={ships:[{code:'mcc_int',base_hp:100,size_class:'frigate',base_atk:10,base_def:2}],resources:[],factions:[]};
function routeFixture({parts=[participant],failure=false,emptyShips=false}={}){
 const routes={},router={get:(url,handler)=>routes[url]=handler};
 const query=async(sql)=>{
  if(sql.includes('SELECT code FROM ship_types'))return{rows:[{code:'mcc_int'},{code:'mcc_titan'}]};
  if(sql.includes('FROM fleet_battle_participants')){if(failure)throw Error('fixture DB unavailable');return{rows:parts};}
  if(sql.includes('GROUP BY ship_type_code'))return{rows:emptyShips?[]:[{ship_type_code:'mcc_int',cnt:1,flagship_cnt:1,flagship_code:'mcc_int'}]};
  throw Error('Unexpected query '+sql);
 };
 const box={module:{exports:{}},console:{warn(){},error(){}},require(name){if(name==='express')return{Router:()=>router};if(name==='../db')return{pool:{query}};throw Error(name);}};
 vm.runInNewContext(routeSource,box);
 return async query=>{const res={statusCode:200,status(code){this.statusCode=code;return this;},json(body){this.body=body;return this;}};await routes['/fleet-presets']({query},res);return res;};
}
for(const [label,options,status]of[['missing',{parts:[]},404],['database error',{failure:true},500],['empty real fleet',{emptyShips:true},409],['missing owner',{parts:[{...participant,owner_wallet:null}]},409],['invalid participant side',{parts:[{...participant,side:'unknown'}]},409]])test('requested battle '+label+' returns explicit error without demo',async()=>{
 const result=await routeFixture(options)({bid:'71'});assert.equal(result.statusCode,status);assert.ok(result.body.error);assert.equal(result.body.atk,undefined);assert.equal(result.body.def,undefined);
});
test('real battle route returns actual participant fleet and masked owner only',async()=>{const result=await routeFixture()({bid:'71'});assert.equal(result.statusCode,200);assert.equal(result.body.source,'battle:71');assert.equal(result.body.atk[0].dbFleetId,'31');assert.notEqual(result.body.atk[0].ownerWallet,participant.owner_wallet);assert.equal(result.body.atk[0].id,'Dummy');});
test('invalid requested battle id cannot enter sandbox demo branch',async()=>{for(const bid of['','abc','0','9007199254740992x']){const result=await routeFixture()({bid});assert.equal(result.statusCode,400);assert.equal(result.body.atk,undefined);}});
test('sandbox without a battle id preserves demo presets',async()=>{const result=await routeFixture()({});assert.equal(result.statusCode,200);assert.ok(result.body.atk.some(f=>f.id==='KimWarrior'));assert.equal(result.body.source,undefined);});
function clientFixture({status=200,mode='battle',bid='71',empty=false,noOwner=false,source='battle:71',lang='ko'}={}){
 const elements={},calls={init:0,ws:0,loop:0,reload:0},controls=[{disabled:false}];
 const make=tag=>({tag,children:[],style:{},appendChild(child){this.children.push(child);elements[child.id]=child;},setAttribute(){},addEventListener(name,fn){this[name]=fn;}});
 const document={hidden:false,body:make('body'),createElement:make,getElementById:id=>elements[id]||null,querySelectorAll:()=>controls};elements.c=make('canvas');
 const flt={source,atk:empty?[]:[{id:'Dummy',dbFleetId:'31',ownerWallet:noOwner?null:'dummy...wner',flagship:'mcc_int',escort:{}}],def:[]};
 const ctx={console:{warn(){},log(){}},document,location:{reload(){calls.reload++;}},TL_MODE:mode,TLANG:lang,TL_DEBUG:false,ATK_FLEETS:[{id:'FakeAttack'}],DEF_FLEETS:[{id:'FakeDefense'}],fleets:[{id:'fake'}],ships:[{id:'fake'}],_battleUiReady:false,tlQuery:key=>key==='bid'?bid:null,
  fetch:async url=>({ok:status===200,status,json:async()=>url.includes('/catalog')?catalog:flt}),
  closeBattleWs(){},stopBattleLoop(){},syncCompactCommandLayout(){},notifyParent(){},localizeStaticUI(){},renderRegistry(){},renderMinerals(){},renderAnalysis(){},renderFleetStatus(){},initBattle(){calls.init++;},updateCommandDeck(){},setSimSpeed(){},requestBattleLoop(){calls.loop++;},connectBattleWs(){calls.ws++;}
 };
 vm.createContext(ctx);vm.runInContext('let _queuedReplayFrame=null,_queuedReplayEnd=null;',ctx);
 vm.runInContext(script.slice(script.indexOf('function showBattleLoadError('),script.indexOf('// This view reads only authoritative objective fields')),ctx);
 vm.runInContext(script.slice(script.indexOf('async function boot(){'),script.lastIndexOf('\nboot();')),ctx);
 return{ctx,elements,calls,controls};
}
for(const status of[401,404,500])test('actual battle loader/boot '+status+' clears fake fleets, shows retry, and never initializes/connects',async()=>{
 const f=clientFixture({status});await f.ctx.boot();assert.equal(f.calls.init,0);assert.equal(f.calls.ws,0);assert.equal(f.calls.loop,0);assert.equal(f.ctx.ATK_FLEETS.length,0);assert.equal(f.ctx.DEF_FLEETS.length,0);assert.equal(f.ctx.fleets.length,0);assert.equal(f.elements.c.hidden,true);assert.equal(f.controls[0].disabled,true);assert.match(f.elements.battleLoadError.children[0].textContent,/전투 정보를 불러오지 못했습니다/);f.elements.battleLoadError.children[1].click();assert.equal(f.calls.reload,1);
});
for(const [label,options]of[['empty',{empty:true}],['no owner',{noOwner:true}],['demo source',{source:'demo'}],['missing id',{bid:''}]])test('actual battle loader rejects '+label+' before fake rendering',async()=>{const f=clientFixture(options);await f.ctx.boot();assert.equal(f.calls.init,0);assert.equal(f.calls.ws,0);assert.ok(f.elements.battleLoadError);});
test('actual battle successful loader/boot uses real presets and opens the viewer only after load',async()=>{const f=clientFixture();await f.ctx.boot();assert.equal(f.ctx.ATK_FLEETS[0].dbFleetId,'31');assert.equal(f.ctx.DEF_FLEETS.length,0,'empty real side does not retain demo defense');assert.equal(f.calls.init,1);assert.equal(f.calls.ws,1);assert.equal(f.calls.loop,1);assert.equal(f.ctx._battleUiReady,true);assert.equal(f.elements.battleLoadError,undefined);});
test('sandbox fallback remains playable if catalog services fail',async()=>{const f=clientFixture({mode:'sandbox',status:500,bid:''});await f.ctx.boot();assert.equal(f.ctx.ATK_FLEETS[0].id,'FakeAttack');assert.equal(f.calls.init,1);assert.equal(f.elements.battleLoadError,undefined);});
for(const lang of['en','ko','ja','zh','id','vi','th'])test('battle error and Retry copy exists for '+lang,async()=>{const f=clientFixture({status:500,lang});await f.ctx.boot();assert.ok(f.elements.battleLoadError.children[0].textContent.length>10);assert.ok(f.elements.battleLoadError.children[1].textContent.length>1);});
