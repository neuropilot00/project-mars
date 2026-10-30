'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const html=fs.readFileSync(path.resolve(__dirname,'../../assets/tactical-lab-v11.html'),'utf8');
const part=(start,end)=>html.slice(html.indexOf(start),html.indexOf(end,html.indexOf(start)));

test('slot waiting stays locked until a real frame, and stale queue messages cannot hide live play',()=>{
 const modes=[],elements={};
 const el=id=>elements[id]||(elements[id]={textContent:'',options:[],value:'breakthrough',disabled:false,replaceChildren(){this.options=[];},appendChild(option){this.options.push(option);}});
 const c={TL_MODE:'battle',TLANG:'ko',_wsLastFrame:null,_wsEndPayload:null,_wsRealtime:false,_waitingLiveSlot:false,_battleSyncWaiting:false,_battleAwaitFrame:false,_battleSyncIncomplete:false,_liveCancelled:false,_wsBattle:{readyState:1},battleOver:false,
  document:{getElementById:el,createElement:()=>({}),querySelectorAll:()=>[el('focusChoice'),el('focusApply')]},
  commandText:key=>key,canCommandBattle:()=>false,updateCombatDock:(_enabled,mode)=>modes.push(mode),
  renderBattleSafetyLimit(){},renderObjectiveBanner(){},syncServerShips(){},syncServerCombatEvents(){},loadPersistedActionSummary(){},fleets:[],_wsPrevShips:new Map()};
 vm.createContext(c);vm.runInContext(part('function updateCommandDeck(){','// ─── WebSocket 실시간 frame 수신'),c);
 vm.runInContext(part('function processBattleMessage(','function closeBattleWs('),c);
 c.processBattleMessage({type:'queue',reason:'live_capacity'},'71');
 assert.equal(c._waitingLiveSlot,true);assert.equal(modes.at(-1),'waiting_slot');assert.equal(el('focusApply').disabled,true);
 // Stop before the ordinary live command deck, which is covered by battle-presentation tests.
 c.updateCommandDeck=()=>modes.push('frame');
 c.processBattleMessage({type:'frame',realtime:true,fleets:[],ships:[]},'71');
 assert.equal(c._waitingLiveSlot,false);assert.equal(c._wsRealtime,true);assert.equal(modes.at(-1),'frame');
 c.processBattleMessage({type:'queue',reason:'live_capacity'},'71');assert.equal(c._waitingLiveSlot,false);
});

test('cancelled waiting is explicit and stays locked even if a stale queue or frame arrives',()=>{
 const modes=[],elements={};const el=id=>elements[id]||(elements[id]={textContent:'',options:[],value:'breakthrough',disabled:false,replaceChildren(){this.options=[];},appendChild(option){this.options.push(option);}});
 const c={TL_MODE:'battle',TLANG:'ko',_wsLastFrame:null,_wsEndPayload:null,_wsRealtime:false,_waitingLiveSlot:false,_battleSyncWaiting:false,_battleAwaitFrame:false,_battleSyncIncomplete:false,_liveCancelled:false,_wsBattle:{readyState:1},battleOver:false,
  document:{getElementById:el,createElement:()=>({}),querySelectorAll:()=>[el('focusChoice'),el('focusApply')]},commandText:key=>key,canCommandBattle:()=>false,updateCombatDock:(_enabled,mode)=>modes.push(mode)};
 vm.createContext(c);vm.runInContext(part('function updateCommandDeck(){','// ─── WebSocket 실시간 frame 수신'),c);
 vm.runInContext(part('function processBattleMessage(','function closeBattleWs('),c);
 c.processBattleMessage({type:'queue',reason:'live_capacity'},'71');c.processBattleMessage({type:'queue',reason:'battle_cancelled'},'71');
 assert.equal(c._waitingLiveSlot,false);assert.equal(c._liveCancelled,true);assert.equal(modes.at(-1),'cancelled');assert.equal(el('focusApply').disabled,true);
 c.processBattleMessage({type:'queue',reason:'live_capacity'},'71');c.processBattleMessage({type:'frame',realtime:true},'71');
 assert.equal(c._waitingLiveSlot,false);assert.equal(c._wsLastFrame,null);assert.equal(modes.at(-1),'cancelled');assert.equal(c._wsEndPayload,null);
});

for(const lang of ['en','ko','ja','zh','id','vi','th'])test('slot waiting explanation is localized for '+lang,()=>{
 const c={TLANG:lang,COMMAND_COPY:{en:{}}};vm.createContext(c);
 vm.runInContext(part('const BATTLE_QUEUE_COPY=','function commandReason('),c);
 assert.ok(c.commandText('waiting_slot').length>10);
 assert.ok(c.commandText('cancelled').length>10);
});
