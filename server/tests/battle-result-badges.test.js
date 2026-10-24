'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.resolve(__dirname,'../../assets/battle-hub-modal.js'),'utf8');
const actual=source.slice(source.indexOf('function showBattleResult()'),source.indexOf('function bvRematch()'));
const langs=['en','ko','ja','zh','id','vi','th'];
function render(winner,wallet,lang='en',code='fsp_int'){
 const elements={};function node(id){return elements[id]||(elements[id]={style:{},classList:{add(){},remove(){},contains:()=>true},innerHTML:'',textContent:'',contains:()=>true});}
 const calls=[],next=[];const c={LANG:lang,bv:{battle:{id:1,winner_side:winner,atk_ships_total:3,atk_ships_lost:1,def_ships_total:1,def_ships_lost:1,battle_summary:{},participants:[{side:'atk',wallet:'alpha',fleet_id:11,fleet_name:'Alpha'},{side:'def',wallet:'beta',fleet_id:22,fleet_name:'Beta'}]},timeline:{fleets_meta:[{id:11,side:'atk'},{id:22,side:'def'}],frames:[{ships:[{id:1,fid:11,code},{id:2,fid:22,code:'mcc_int'}]}]}},walletState:{address:wallet},document:{getElementById:node},window:{},tl:(...a)=>a[langs.indexOf(lang)]||a[0],t:key=>key,escapeHtml:String,formatNum:String,battleResultContinuation:()=>({tab:'missions',label:'Next'}),bvResultNextAction:tab=>next.push(tab),renderBattleCommandSummary(){},renderBattleObjectiveResult(){},_setActiveTimeout(){},_loadBattleReport:(id,side)=>calls.push({id,side}),_injectRewardIntoResult(){}};
 vm.createContext(c);vm.runInContext(actual,c);c.showBattleResult();return{title:elements.bvResultTitle.textContent,subtitle:elements.bvResultSubtitle.textContent,stats:elements.bvResultStats.innerHTML,calls,next,elements};
}
for(const lang of langs)test('result distinguishes a participant draw from an observed winner in '+lang,()=>{
 const draws=['Draw','무승부','引き分け','平局','Seri','Hòa','เสมอ'],winners=['Winner','승자','勝者','胜方','Pemenang','Bên thắng','ผู้ชนะ'];
 for(const wallet of ['alpha','beta','observer'])assert.equal(render('draw',wallet,lang).title,draws[langs.indexOf(lang)]);
 for(const side of ['atk','def']){const result=render(side,'observer',lang);assert.equal(result.title,side.toUpperCase()+' · '+winners[langs.indexOf(lang)]);assert.equal(result.calls[0].side,null);}
});
test('own result uses the actual side, ship art, survivors and unchanged report request',()=>{
 const won=render('atk','alpha'),lost=render('atk','beta');assert.equal(won.title,'Victory');assert.equal(lost.title,'Defeat');assert.equal(won.calls[0].side,'atk');assert.equal(lost.calls[0].side,'def');
 assert.ok(won.stats.includes('/assets/ships/fsp_int.png'));assert.ok(!won.stats.includes('/assets/ships/mcc_int.png'));assert.ok(lost.stats.includes('/assets/ships/mcc_int.png'));
 assert.ok(won.stats.includes('<b>2<span> / 3</span></b>'));assert.ok(lost.stats.includes('<b>0<span> / 1</span></b>'));
 assert.ok(won.stats.includes('id="bvObjectiveResult"'));assert.ok(won.stats.includes('id="bvInlineReward"')===false);assert.ok(!won.stats.includes('onclick='));assert.ok(!won.stats.includes('<details open'));
 const stats=won.elements.bvResultStats;stats.onclick({target:{closest:()=>({dataset:{bvResultNext:'missions'}})}});assert.deepEqual(won.next,['missions']);
});
test('unknown ship codes cannot become art URLs and incomplete outcomes do not invent victory',()=>{
 const result=render(null,'alpha','en','../../private');assert.equal(result.title,'Battle ended');assert.ok(!result.stats.includes('<img'));assert.ok(!result.stats.includes('/assets/ships/../../'));
});
