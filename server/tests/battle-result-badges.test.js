'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.resolve(__dirname,'../../assets/battle-hub-modal.js'),'utf8');
const actual=source.slice(source.indexOf('function battleResultFleetUnits('),source.indexOf('function bvRematch()'));
const langs=['en','ko','ja','zh','id','vi','th'];
function render(winner,wallet,lang='en',code='fsp_int',live=null,overrides={}){
 const elements={};function node(id){return elements[id]||(elements[id]={style:{},classList:{add(){},remove(){},contains:()=>true},innerHTML:'',textContent:'',contains:()=>true});}
 const calls=[],next=[];const c={LANG:lang,bv:{battle:{id:1,winner_side:winner,atk_ships_total:3,atk_ships_lost:1,def_ships_total:1,def_ships_lost:1,battle_summary:{},participants:[{side:'atk',wallet:'alpha',fleet_id:11,fleet_name:'Alpha'},{side:'def',wallet:'beta',fleet_id:22,fleet_name:'Beta'}],...overrides},timeline:{fleets_meta:[{id:11,side:'atk'},{id:22,side:'def'}],frames:[{ships:[{id:1,fid:11,code},{id:3,fid:11,code},{id:4,fid:11,code},{id:2,fid:22,code:'mcc_int'}]},{ships:[{id:1,fid:11,code,hp:10},{id:3,fid:11,code,hp:10}]}]}},walletState:{address:wallet},document:{getElementById:node},window:{},tl:(...a)=>a[langs.indexOf(lang)]||a[0],t:key=>key,escapeHtml:String,formatNum:String,battleResultContinuation:()=>({tab:'missions',label:'Next'}),bvResultNextAction:tab=>next.push(tab),renderBattleCommandSummary(){},renderBattleObjectiveResult(){},_setActiveTimeout(){},_loadBattleReport:(id,side)=>calls.push({id,side}),_injectRewardIntoResult(){}};
 if(live){c.bv.timeline=null;node('bvTacticalFrame').contentWindow={battleResultArtSnapshot:()=>live};}
 vm.createContext(c);vm.runInContext(actual,c);c.showBattleResult();return{title:elements.bvResultTitle.textContent,subtitle:elements.bvResultSubtitle.textContent,stats:elements.bvResultStats.innerHTML,calls,next,elements,context:c};
}
for(const lang of langs)test('result distinguishes a participant draw from an observed winner in '+lang,()=>{
 const draws=['Draw','무승부','引き分け','平局','Seri','Hòa','เสมอ'],winners=['Winner','승자','勝者','胜方','Pemenang','Bên thắng','ผู้ชนะ'];
 for(const wallet of ['alpha','beta','observer'])assert.equal(render('draw',wallet,lang).title,draws[langs.indexOf(lang)]);
 for(const side of ['atk','def']){const result=render(side,'observer',lang);assert.equal(result.title,side.toUpperCase()+' · '+winners[langs.indexOf(lang)]);assert.equal(result.calls[0].side,null);}
});
test('own result uses the actual side, ship art, survivors and unchanged report request',()=>{
 const won=render('atk','alpha'),lost=render('atk','beta');assert.equal(won.title,'Victory');assert.equal(lost.title,'Defeat');assert.equal(won.calls[0].side,'atk');assert.equal(lost.calls[0].side,'def');
 assert.ok(won.stats.includes('/assets/ships/reveal/fsp_int.jpg'));assert.ok(!won.stats.includes('/assets/ships/reveal/mcc_int.jpg'));assert.ok(lost.stats.includes('/assets/ships/wreck/ship-v1.webp'));assert.ok(!lost.stats.includes('/assets/ships/reveal/mcc_int.jpg'));
 assert.ok(won.stats.includes('<b>2<span> / 3</span></b>'));assert.ok(lost.stats.includes('<b>0<span> / 1</span></b>'));
 assert.ok(won.stats.includes('id="bvObjectiveResult"'));assert.ok(won.stats.includes('id="bvInlineReward"')===false);assert.ok(!won.stats.includes('onclick='));assert.ok(!won.stats.includes('<details open'));
 const stats=won.elements.bvResultStats;stats.onclick({target:{closest:()=>({dataset:{bvResultNext:'missions'}})}});assert.deepEqual(won.next,['missions']);
});
test('unknown ship codes cannot become art URLs and incomplete outcomes do not invent victory',()=>{
 const result=render(null,'alpha','en','../../private');assert.equal(result.title,'Battle ended');assert.ok(!result.stats.includes('<img'));assert.ok(!result.stats.includes('/assets/ships/../../'));
});

test('new live result without a timeline uses only the matching battle actual hull metadata',()=>{
 const live={battleId:1,ships:[{id:9,fid:11,code:'fsp_int',hp:10},{id:11,fid:11,code:'fsp_int',hp:10},{id:12,fid:11,code:'fsp_int',hp:0,dead:true},{id:10,fid:22,code:'mcc_int',hp:0,dead:true}],fleets:[{id:11,side:'atk'},{id:22,side:'def'}]};
 assert.ok(render('atk','alpha','en','fsp_int',live).stats.includes('/assets/ships/reveal/fsp_int.jpg'));
 assert.ok(render('atk','beta','en','fsp_int',live).stats.includes('/assets/ships/wreck/ship-v1.webp'));
 assert.ok(!render('atk','alpha','en','fsp_int',{...live,battleId:999}).stats.includes('<img'));
});

test('three actual lost interceptors are three wrecks, never the pristine featured ship',()=>{
 const r=render('def','alpha','ko','fsp_int',null,{atk_ships_lost:3});
 assert.equal((r.stats.match(/data-ship-state="lost"/g)||[]).length,3);
 assert.equal((r.stats.match(/\/wreck\/fsp_int-v1.webp/g)||[]).length,3);
 assert.ok(r.stats.includes('data-fleet-state="destroyed"'));assert.ok(!r.stats.includes('/reveal/fsp_int.jpg'));
 for(const id of [1,3,4])assert.ok(r.stats.includes('data-ship-id="'+id+'"'));
});
test('defeat after withdrawal with no lost ships does not invent destroyed hulls',()=>{
 const r=render('def','alpha','en','fsp_int',null,{atk_ships_lost:0});
 assert.equal(r.title,'Defeat');assert.equal((r.stats.match(/data-ship-state="surviving"/g)||[]).length,3);assert.ok(!r.stats.includes('/wreck/'));
});
test('partial loss follows the verified final ship identities even after a victory',()=>{
 const r=render('atk','alpha');assert.ok(r.stats.includes('data-fleet-state="mixed"'));
 assert.ok(r.stats.includes('class="bv-result-hull lost" data-ship-state="lost" data-ship-id="4"'));
 assert.equal((r.stats.match(/data-ship-state="surviving"/g)||[]).length,2);
});
test('coalition result includes all same-side participating fleets and bounds large fleets visibly',()=>{
 const c=render('atk','alpha').context,allowed=new Set(['fsp_int']);
 const ships=Array.from({length:25},(_,i)=>({id:i+1,fid:i%2?11:12,code:'fsp_int'}));
 const battle={atk_ships_total:25,atk_ships_lost:25,participants:[{side:'atk',fleet_id:11},{side:'atk',fleet_id:12}]};
 const model=c.battleResultFleetUnits(battle,{frames:[{ships}]},null,'atk',allowed);
 assert.equal(model.units.length,9);assert.equal(model.remaining,16);assert.equal(model.state,'destroyed');assert.ok(model.units.every(u=>u.lost));assert.ok(model.units.some(u=>u.id===1));
});
test('missing final identities preserve aggregate counts without guessing which hull died',()=>{
 const c=render('atk','alpha').context,allowed=new Set(['fsp_int','mcc_int']);
 const battle={atk_ships_total:3,atk_ships_lost:1,participants:[{side:'atk',fleet_id:11}]};
 const timeline={frames:[{ships:[{id:1,fid:11,code:'fsp_int'},{id:2,fid:11,code:'mcc_int'},{id:3,fid:11,code:'fsp_int'}]}]};
 const model=c.battleResultFleetUnits(battle,timeline,null,'atk',allowed);
 assert.equal(model.units.filter(u=>u.lost).length,1);assert.equal(model.units.filter(u=>!u.lost).length,2);assert.ok(model.units.every(u=>!u.id&&!u.code));
});
test('destroyed mech and alien use family remains, and invalid totals render no invented fleet',()=>{
 for(const [code,asset] of [['pilgrim_glacius','robot'],['alien_devourer','alien']]){
  const r=render('def','alpha','en',code,null,{atk_ships_lost:3});assert.equal((r.stats.match(new RegExp('/wreck/'+asset+'-v1.webp','g'))||[]).length,3);assert.ok(!r.stats.includes('/assets/ships/'+code+'.png'));
 }
 const r=render('def','alpha','en','fsp_int',null,{atk_ships_lost:4});assert.ok(!r.stats.includes('<img'));
});
test('live result snapshot carries observed hull HP and death without altering the battle',()=>{
 const tactical=fs.readFileSync(path.resolve(__dirname,'../../assets/tactical-lab-v11.html'),'utf8');
 const snapshot=tactical.slice(tactical.indexOf('function battleResultArtSnapshot()'),tactical.indexOf('const BATTLE_VIEWPORT_RIM='));
 const ships=[{dbShipId:7,fleet:{dbFleetId:11},tid:'fsp_int',hp:0,dead:true},{dbShipId:8,fleet:{dbFleetId:11},tid:'fsp_int',hp:12,dead:false}];
 const before=JSON.stringify(ships),c={ships,fleets:[{dbFleetId:11,side:'atk'}],TL_MODE:'battle',TL_QUERY:new URLSearchParams('bid=1512')};
 vm.createContext(c);vm.runInContext(snapshot,c);const value=c.battleResultArtSnapshot();assert.equal(value.battleId,'1512');assert.equal(value.ships[0].dead,true);assert.equal(value.ships[1].hp,12);assert.equal(JSON.stringify(ships),before);
});
