'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../assets/tactical-lab-v11.html'),'utf8').match(/<script>([\s\S]*)<\/script>/)[1];
function part(a,b){const start=source.indexOf(a),end=source.indexOf(b,start);assert.ok(start>=0&&end>start);return source.slice(start,end);}
test('touch destinations invert the same portrait projection at every battlefield size',()=>{
 const c={};vm.createContext(c);vm.runInContext(part('function battleWorldPoint(','function battleShipPoint('),c);
 for(const [w,h]of[[460,600],[320,480],[390,740]])for(const [x,y]of[[0,0],[1000,440],[100,220],[670,64]]){
  const p=c.battleWorldPoint(x,y,w,h),q=c.battleServerPoint(p.x,p.y,w,h);assert.ok(q);assert.ok(Math.abs(q.x-x)<.000001);assert.ok(Math.abs(q.y-y)<.000001);
 }
 assert.equal(c.battleServerPoint(-100,0,460,600),null);
});
test('selection can switch only between living owned fleets and outgoing commands name the selected fleet',()=>{
 const sent=[],c={_commandWallet:'owner',_selectedCommandFleetId:null,_moveOrderArmed:false,_wsLastFrame:{fleets:[{id:'11',owner_wallet:'owner',hp:100},{id:'12',owner_wallet:'OWNER',hp:100},{id:'22',owner_wallet:'enemy',hp:100},{id:'13',owner_wallet:'owner',hp:100,retreated:true}]},_wsRealtime:true,_wsEndPayload:null,_liveCancelled:false,_battleSyncWaiting:false,_battleAwaitFrame:false,_wsBattle:{readyState:1,send:x=>sent.push(JSON.parse(x))},_commandSeq:0,_pendingCommands:new Map(),_uncertainCommands:new Map(),setTimeout:()=>1,clearTimeout(){},navigationText:x=>x,commandText:x=>x,commandFeedback(){},updateCommandDeck(){}};
 vm.createContext(c);vm.runInContext(part('function commandableFleets(','function advanceBattleClock(').replace(/function commandFeedback\([^]*?\nfunction scheduleCommandTimeout/,'function scheduleCommandTimeout'),c);
 assert.equal(c.selectCommandFleet('22'),false);assert.equal(c.selectCommandFleet('13'),false);assert.equal(c.selectCommandFleet('12'),true);
 assert.equal(c.sendLiveCommand('hold',{}),true);assert.equal(sent[0].payload.fleetId,'12');
 c._liveCancelled=true;assert.equal(c.sendLiveCommand('hold',{}),false,'a cancelled live battle cannot receive commands');c._liveCancelled=false;
 c._wsEndPayload={};assert.equal(c.selectCommandFleet('11'),false);assert.equal(c.sendLiveCommand('move',{x:10,y:10}),false);assert.equal(sent.length,1);
});
test('unconfirmed accepted command unlocks without retry and a late result is shown once',()=>{
 const sent=[],feedback=[],timers=[];
 const c={_commandWallet:'owner',_selectedCommandFleetId:null,_moveOrderArmed:false,
  _wsLastFrame:{fleets:[{id:'11',owner_wallet:'owner',hp:100}]},_wsRealtime:true,_wsEndPayload:null,_liveCancelled:false,_battleSyncWaiting:false,_battleAwaitFrame:false,
  _wsBattle:{readyState:1,send:x=>sent.push(JSON.parse(x))},_commandSeq:0,_pendingCommands:new Map(),_uncertainCommands:new Map(),_confirmedActions:new Map(),fleets:[],
  setTimeout:(fn,ms)=>{timers.push({fn,ms});return timers.length;},clearTimeout(){},navigationText:x=>x,commandText:x=>x,commandReason:x=>x,
  TLANG:'en',document:{getElementById:()=>null},addLog:(_kind,text)=>feedback.push(text),updateCommandDeck(){},performance:{now:()=>0}};
 vm.createContext(c);vm.runInContext(part('function commandableFleets(','function rememberAppliedAction('),c);
 vm.runInContext(part('function processBattleMessage(','function closeBattleWs('),c);
 c.rememberAppliedAction=()=>{};
 assert.equal(c.sendLiveCommand('hold',{}),true);assert.equal(timers[0].ms,9000);
 const id=sent[0].commandId;assert.equal(c._pendingCommands.has(id),true);
 c.processBattleMessage({type:'cmd_ok',commandId:id,status:'accepted',cmd:'hold'},'71');assert.match(feedback.at(-1),/accepted/);
 assert.equal(timers.length,2);assert.equal(timers[1].ms,9000);
 c.processBattleMessage({type:'cmd_ok',commandId:id,status:'accepted',cmd:'hold'},'71');assert.equal(timers.length,2,'duplicate acknowledgement does not extend timeout');
 timers[1].fn();assert.equal(c._pendingCommands.has(id),false);assert.equal(c._uncertainCommands.has(id),true);assert.match(feedback.at(-1),/result_unknown/);assert.equal(sent.length,1);
 c.handleCommandResult({commandId:id,status:'applied',cmd:'hold',tick:12,fleetId:'11'});
 assert.equal(c._uncertainCommands.has(id),false);assert.match(feedback.at(-1),/applied/);const count=feedback.length;
 c.handleCommandResult({commandId:id,status:'applied',cmd:'hold',tick:12,fleetId:'11'});assert.equal(feedback.length,count);
});
test('armed canvas input sends real server coordinates once; replay/spectator/ended input cannot send',()=>{
 const calls=[],c={ships:[{}],TL_MODE:'battle',_moveOrderArmed:true,canCommandBattle:()=>true,_canvasToWorld:()=>({wx:230,wy:450,displayScale:1}),W:460,H:600,sendLiveCommand:(cmd,p)=>{calls.push({cmd,p});return true;},updateCommandDeck(){},commandFeedback(){},navigationText:x=>x};
 vm.createContext(c);vm.runInContext(part('function battleServerPoint(','function battleShipPoint(')+part('function _onCanvasTap(','CVs.addEventListener('),c);
 c._onCanvasTap(1,2);assert.equal(calls.length,1);assert.equal(calls[0].cmd,'move');assert.equal(calls[0].p.x,250);assert.equal(calls[0].p.y,220);assert.equal(c._moveOrderArmed,false);
 c.canCommandBattle=()=>false;c._moveOrderArmed=true;c._onCanvasTap(1,2);assert.equal(calls.length,1);
});
test('navigation labels cover all seven languages with concrete action and destination guidance',()=>{
 const c={TLANG:'en'};vm.createContext(c);vm.runInContext(part('const NAVIGATION_COPY=','function updateNavigationControls('),c);
 for(const lang of ['en','ko','ja','zh','id','vi','th']){c.TLANG=lang;for(const key of ['move','hold','auto','pick','hint','selected','invalid'])assert.ok(c.navigationText(key)&&c.navigationText(key)!==key||lang==='en'&&key==='auto');}
});
