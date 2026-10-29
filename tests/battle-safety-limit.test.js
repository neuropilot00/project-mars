'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'../assets/tactical-lab-v11.html'),'utf8');
const source=html.slice(html.indexOf('function renderBattleSafetyLimit('),html.indexOf('function processBattleMessage('));

function fixture(lang){
 const nodes=Object.fromEntries(['battleSafetyLimit','battleSafetyDetail','turnInfo'].map(id=>[id,{hidden:true,textContent:'',setAttribute(name,value){this[name]=value;}}]));
 const ctx={TLANG:lang,document:{getElementById:id=>nodes[id]}};
 vm.createContext(ctx);vm.runInContext(source,ctx);
 return {nodes,render:ctx.renderBattleSafetyLimit};
}
for(const lang of ['en','ko','ja','zh','id','vi','th'])test('live safety explanation is localized for '+lang,()=>{
 const {nodes,render}=fixture(lang);
 render({realtime:true,wall_clock_limit_seconds:1800,wall_clock_elapsed_seconds:12});
 assert.ok(nodes.battleSafetyLimit.textContent.includes('30'));
 assert.equal(nodes.battleSafetyLimit.hidden,false);assert.equal(nodes.turnInfo.hidden,true);
 assert.match(nodes.battleSafetyDetail.textContent,/30:00/);
 assert.equal(nodes.battleSafetyLimit['aria-label'],nodes.battleSafetyDetail.textContent);
});
test('replays and old live frames retain the original turn display',()=>{
 const {nodes,render}=fixture('ko');
 render({realtime:true,wall_clock_limit_seconds:2700});
 assert.equal(nodes.battleSafetyLimit.textContent,'상한 45분');
 for(const frame of [{realtime:false,wall_clock_limit_seconds:2700},{realtime:true},{realtime:true,wall_clock_limit_seconds:0}]){
  render(frame);assert.equal(nodes.battleSafetyLimit.hidden,true);assert.equal(nodes.battleSafetyDetail.hidden,true);assert.equal(nodes.turnInfo.hidden,false);
 }
});
