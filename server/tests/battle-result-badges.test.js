'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.resolve(__dirname,'../../assets/battle-hub-modal.js'),'utf8');
const actual=source.slice(source.indexOf('function showBattleResult()'),source.indexOf('function bvRematch()'));
const langs=['en','ko','ja','zh','id','vi','th'];
function render(winner,wallet,lang='en'){
 const elements={};function node(id){return elements[id]||(elements[id]={style:{},classList:{add(){},remove(){},contains:()=>true},innerHTML:''});}
 const calls=[];const c={LANG:lang,bv:{battle:{id:1,winner_side:winner,battle_summary:{},participants:[{side:'atk',wallet:'alpha',fleet_name:'Alpha'},{side:'def',wallet:'beta',fleet_name:'Beta'}]}},walletState:{address:wallet},document:{getElementById:node},window:{},tl:(...a)=>a[langs.indexOf(lang)]||a[0],t:key=>key,escapeHtml:String,formatNum:String,battleResultContinuation:()=>({tab:'front',label:'Next'}),renderBattleCommandSummary(){},renderBattleObjectiveResult(){},_setActiveTimeout(){},_loadBattleReport:(id,side)=>calls.push({id,side}),_injectRewardIntoResult(){}};
 vm.createContext(c);vm.runInContext(actual,c);c.showBattleResult();return{subtitle:elements.bvResultSubtitle.innerHTML,stats:elements.bvResultStats.innerHTML,calls};
}
for(const lang of langs)test('actual result DOM distinguishes participant draws and observed winners in '+lang,()=>{
 const drawLabels=['Draw','무승부','引き分け','平局','Seri','Hòa','เสมอ'],winLabels=['Winner','승자','勝者','胜方','Pemenang','Bên thắng','ผู้ชนะ'];
 for(const wallet of ['alpha','beta','observer']){
  const result=render('draw',wallet,lang);assert.ok(result.subtitle.includes(drawLabels[langs.indexOf(lang)]));assert.ok(!result.subtitle.includes('💀'));assert.ok(!result.subtitle.includes('🏆'));assert.ok(!result.stats.includes('>WIN</span>'));assert.ok(!result.stats.includes('>LOSS</span>'));
 }
 for(const side of ['atk','def']){
  const result=render(side,'observer',lang);assert.ok(result.subtitle.includes(side.toUpperCase()+' · '+winLabels[langs.indexOf(lang)]));assert.ok(!result.subtitle.includes('≋'));assert.ok(!result.subtitle.includes(drawLabels[langs.indexOf(lang)]));assert.equal(result.calls[0].side,null);
 }
});
test('actual participant decisive result DOM retains Victory/Defeat, real side and unchanged report request',()=>{
 const won=render('atk','alpha'),lost=render('atk','beta');assert.ok(won.subtitle.includes('🏆 Victory'));assert.ok(lost.subtitle.includes('💀 Defeat'));assert.equal(won.calls[0].side,'atk');assert.equal(lost.calls[0].side,'def');assert.ok(won.stats.includes('>WIN</span>'));assert.ok(lost.stats.includes('>LOSS</span>'));
});
