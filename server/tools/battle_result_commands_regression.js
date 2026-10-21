'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');
const source=fs.readFileSync(path.join(__dirname,'../../assets/battle-hub-modal.js'),'utf8');new vm.Script(source);
const helpers=source.slice(source.indexOf('// Merge verified live results'),source.indexOf('function showBattleResult()'));
function node(){return {textContent:'',style:{},children:[],appendChild(n){this.children.push(n);},replaceChildren(){this.children=[];}};}
const container=node(),calls=[];const ctx=vm.createContext({console,Map,Array,Object,String,Number,LANG:'ko',bv:{battle:{},events:[]},document:{getElementById:()=>container,createElement:node},window:{openCommandCenter:t=>calls.push(t)},closeBattleViewer:()=>calls.push('close')});vm.runInContext(helpers,ctx);
const collect=(battle,events)=>ctx.collectBattleCommandEvents(battle,events);
assert.equal(collect({command_events:[{cmd:'beam',status:'accepted',tick:1},{cmd:'beam',status:'rejected',tick:2}]},[]).length,0);
let events=collect({command_events:[{cmd:'missile',status:'applied',tick:56,fleetId:848,totalDamage:504,targetCount:3}]},[{event_type:'manual_skill',fleet_id:'848',tick:56,payload:{skill:'missile',total_damage:504,target_count:3}},{event_type:'command_result',fleet_id:'848',tick:56,payload:{cmd:'missile',status:'applied'}}]);assert.equal(events.length,1);assert.equal(events[0].totalDamage,504);
events=collect({command_events:[{cmd:'formation',status:'applied',tick:3,fleetId:1},{cmd:'focus',status:'applied',tick:4,fleetId:1}]},[{event_type:'manual_skill',fleet_id:1,tick:2,payload:{skill:'beam',total_damage:20,target_count:1}}]);assert.equal(events.length,2);assert.equal(events[0].cmd,'formation');assert.equal(events[1].cmd,'focus');
ctx.renderBattleCommandSummary();assert.match(container.children[1].children[0].textContent,/기록이 없습니다/);
ctx.bv.battle.command_events=[{cmd:'beam',status:'applied',tick:4,fleetId:1,totalDamage:23,targetCount:1}];ctx.renderBattleCommandSummary();assert.match(container.children[1].children[0].textContent,/피해 23/);
ctx.bv.events=[{event_type:'manual_skill',fleet_id:1,tick:5,payload:{skill:'missile',total_damage:504,target_count:3}}];ctx.renderBattleCommandSummary();assert.equal(container.children[1].children.length,2);assert.match(container.children[1].children[1].textContent,/504.*3표적/);
ctx.bvResultNextAction('fleet');ctx.bvResultNextAction('front');assert.deepEqual(calls,['close','fleet','close','front']);
const actual278={event_type:'command_result',fleet_id:'1198',tick:313,payload:{action:'focus',reason:null,status:'applied',command_id:'tl-mv2fwkkd-1'}};events=collect({},[actual278]);assert.equal(events.length,1);assert.equal(events[0].cmd,'focus');assert.equal(events[0].tick,313);ctx.bv.battle={};ctx.bv.events=[actual278];ctx.renderBattleCommandSummary();assert.match(container.children[1].children[0].textContent,/tick 313.*함대 집중.*적용됨/);
assert.equal(ctx.objectiveResultText({battle_summary:{is_objective_operation:true,objective_result:{kind:'hold',complete:true,success:true,reason:'relay_held',hold_seconds:90}}},'ko'),'중계소 90초 점유로 승리');
for(const [reason,phrase] of [['convoy_arrived','항로 완주'],['flagship_destroyed','기함 격파']])assert.match(ctx.objectiveResultText({objective_result:{complete:true,success:true,reason}},'ko'),new RegExp(phrase));
for(const [reason,phrase] of [['player_eliminated','전멸 또는 철수'],['convoy_lost','보급 기함 손실'],['objective_deadline','제한 시간 초과']])assert.match(ctx.objectiveResultText({objective_result:{complete:true,success:false,reason}},'ko'),new RegExp(phrase));
assert.match(ctx.objectiveResultText({objective_result:{kind:'hold',hold_seconds:90,complete:false,success:true}},'ko'),/확인 중/);assert.equal(ctx.objectiveResultText({winner_side:'atk',battle_summary:{atk:{damage_dealt:500}}},'ko'),'');assert.equal(ctx.isObjectiveBattle({battle_summary:{atk:{damage_dealt:500}}}),false);
// Viewer-relative observations and objective exclusion execute in battle-report-perspective.test.js.
console.log('PASS: confirmed-only summary, persisted replay skill, WS/persisted duplicate merge, last two by actual tick, late event repaint, next-action routing.');
