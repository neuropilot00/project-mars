'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'../..');
const script=fs.readFileSync(path.join(root,'assets/tactical-lab-v11.html'),'utf8').match(/<script>([\s\S]*)<\/script>/)[1];
const hub=fs.readFileSync(path.join(root,'assets/battle-hub-modal.js'),'utf8');
function part(source,start,end){return source.slice(source.indexOf(start),source.indexOf(end,source.indexOf(start)));}
function render(mode='battle'){
 const ship={dbShipId:'111',tid:'dummy',type:{code:'dummy',fireType:'bullet',faction:'mcc'},hp:100,shield:120,shieldMax:120,dead:false};
 const fleet={dbFleetId:'11',side:'atk',ships:[ship]};
 const c={TL_MODE:mode,W:460,H:600,camScale:1,fleets:[fleet],ships:[ship],lasers:[],SHIPS:{dummy:{hp:1000,r:2,size:'frigate'}},weaponColor:()=> '#fff'};
 vm.createContext(c);
 for(const [a,b]of[['function objectiveMapPoint(','function renderObjectiveBanner('],['function syncServerShips(','function fleetRoleText('],['function mkShip(','function autoTactics(']])vm.runInContext(part(script,a,b),c);
 return{c,ship,fleet};
}
test('real battle hulls never invent a shield; sandbox retains its existing shield simulation',()=>{
 for(const [mode,expected]of[['battle',0],['sandbox',120]]){const{c}=render(mode);const s=c.mkShip('dummy','atk',10,20,{cx:10,cy:20},false);assert.equal(s.shield,expected);assert.equal(s.shieldMax,expected);}
});
test('snapshot shields replace local defaults, reflect depletion, and clamp invalid or excess values',()=>{
 const{c,ship}=render();const hull={id:'111',fid:'11',code:'dummy',x:100,y:200,hp:90,maxHp:100};
 c.syncServerShips({ships:[hull]});assert.equal(ship.shield,0);assert.equal(ship.shieldMax,0);
 c.syncServerShips({ships:[{...hull,shield_hp:25,shield_max:40}]});assert.equal(ship.shield,25);assert.equal(ship.shieldMax,40);
 c.syncServerShips({ships:[{...hull,shield_hp:10,shield_max:40}]});assert.equal(ship.shield,10);assert.equal(ship.shieldFlash,1);
 c.syncServerShips({ships:[{...hull,shield_hp:90,shield_max:40}]});assert.equal(ship.shield,40);
 c.syncServerShips({ships:[{...hull,shield_hp:Infinity,shield_max:NaN}]});assert.equal(ship.shield,0);assert.equal(ship.shieldMax,0);
});
const shot=id=>({id,type:'shot_hit',source_side:'atk',source_ship_id:'111',fire_type:'bullet',from:{x:0,y:0},to:{x:1000,y:440},damage:999999,target_hp:0});
test('simultaneous overkill shots render as tracers without inventing damage',()=>{
 const{c,ship}=render();const event={...shot('71:combat:2'),damage:0,hull_damage:0,shield_damage:0,destroyed:false,overkill:true};
 c.syncServerCombatEvents({combat_events:[event]});
 assert.equal(c.lasers.length,1);assert.equal(c.lasers[0].visual,true);assert.equal(c.lasers[0].dmg,0);assert.equal(ship.hp,100);
});
test('only resolved authoritative shots create deduplicated visual tracers with exact mapped endpoints and no damage',()=>{
 const{c,ship}=render();c.Date={now:()=>1000};c.syncServerCombatEvents({combat_events:[shot('71:combat:1')]});
 assert.equal(ship.recoilUntil,1180);assert.equal(ship.x,undefined);assert.equal(ship.y,undefined);
 assert.equal(c.lasers.length,1);const effect=c.lasers[0];assert.equal(effect.x1,98);assert.equal(effect.x2,362);assert.equal(effect.y1,600);assert.equal(effect.y2,0);assert.equal(effect.visual,true);assert.equal(effect.applied,true);assert.equal(effect.dmg,0);assert.equal(ship.hp,100);assert.equal(ship.shield,120);
 c.Date={now:()=>2000};c.syncServerCombatEvents({combat_events:[shot('71:combat:1'),{...shot('2'),type:'fake'},{...shot('3'),from:{x:NaN,y:0}}]});assert.equal(c.lasers.length,1);assert.equal(ship.recoilUntil,1180,'duplicates and invalid events never restart recoil');
 c.syncServerCombatEvents({});assert.equal(c.lasers.length,1,'old records without events never invent firing');
});
test('seeking an actual recording backward clears prior tracers and permits the same recorded hit again',()=>{
 const{c}=render();c.syncServerCombatEvents({t:20,combat_events:[shot('71:combat:1')]});assert.equal(c.lasers.length,1);
 c.syncServerCombatEvents({t:10,combat_events:[shot('71:combat:1')]});assert.equal(c.lasers.length,1);assert.equal(c.syncServerCombatEvents.seen.size,1);
});
test('replay seek and battle reinitialization cancel prior delayed visual groups',()=>{
 const {c}=render();let cancelled=[];c.clearTimeout=id=>cancelled.push(id);
 c.syncServerCombatEvents.pending=[{count:8}];c.syncServerCombatEvents.retryTimer=37;
 c.syncServerCombatEvents({t:2,replay_seek:true,combat_events:[]});
 assert.equal(c.syncServerCombatEvents.pending.length,0);assert.equal(c.syncServerCombatEvents.retryTimer,null);assert.deepEqual(cancelled,[37]);
 c.syncServerCombatEvents.pending=[{count:9}];c.syncServerCombatEvents.retryTimer=38;
 Object.assign(c,{ATK_FLEETS:[],DEF_FLEETS:[],W:460,H:600,TLANG:'ko',centeredPos:()=>[],document:{getElementById:()=>null},addLog(){},clearUnconfirmedBattleHud(){}});
 vm.runInContext(part(script,'function initBattle(){','function mkFleet('),c);c.initBattle();
 assert.equal(c.syncServerCombatEvents.pending.length,0);assert.equal(c.syncServerCombatEvents.retryTimer,null);assert.deepEqual(cancelled,[37,38]);
});
test('bounded salvo effects use confirmed samples, do not alter damage, and deduplicate on resend',()=>{
 const{c,ship}=render();let now=1000;c.Date={now:()=>now};
 const salvo={id:'71:salvo:1:200:atk:laser',source_side:'atk',fire_type:'laser',count:200,samples:[{from:{x:0,y:0},to:{x:1000,y:440}},{from:{x:100,y:50},to:{x:900,y:400}}]};
 c.syncServerCombatEvents({t:10,combat_events:[],combat_salvos:[salvo]});assert.equal(c.lasers.length,2);
 assert.ok(c.lasers.every(l=>l.volley&&l.visual&&l.dmg===0&&l.applied&&l.durationMs===1100));
 assert.equal(c.lasers[0].delayMs,0);assert.equal(c.lasers[1].delayMs,400);assert.equal(ship.hp,100);
 c.syncServerCombatEvents({t:10,combat_events:[],combat_salvos:[salvo]});assert.equal(c.lasers.length,2);
 c.syncServerCombatEvents({t:12,replay_seek:true,combat_events:[],combat_salvos:[]});assert.equal(c.lasers.length,0,'forward seek clears delayed effects');
 c.syncServerCombatEvents({t:10,combat_events:[],combat_salvos:[salvo]});assert.equal(c.lasers.length,2);
 now=3000;c.syncServerCombatEvents({t:15,combat_events:[],combat_salvos:[]});assert.equal(c.lasers.length,0);
 c.syncServerCombatEvents({t:5,combat_events:[],combat_salvos:[salvo]});assert.equal(c.lasers.length,2,'backward seek replays recorded groups');
});
test('salvo rendering cannot evict heavy and authoritative critical effects',()=>{
 const{c}=render();c.Date={now:()=>1000};for(let i=0;i<256;i++)c.lasers.push({visual:true,beamCannon:true});
 const salvo={id:'salvo',source_side:'atk',fire_type:'laser',count:10,samples:[{from:{x:0,y:0},to:{x:1,y:1}}]};
 c.syncServerCombatEvents({combat_events:[],combat_salvos:[salvo]});assert.equal(c.lasers.length,256);assert.ok(c.lasers.every(l=>l.beamCannon));
});
test('mass confirmed explosions keep a bounded particle budget and favor larger hulls',()=>{
 const c={TL_MODE:'battle',PERF_MODE:true,exps:[],playExplosionSound(){}};vm.createContext(c);
 vm.runInContext(part(script,'function mkExp(','function mkShockwave('),c);
 for(let i=0;i<200;i++)c.mkExp(i,0,1);
 assert.equal(c.exps.length,96);c.mkExp(0,0,6);assert.equal(c.exps.length,96);
 assert.ok(c.exps.some(e=>e.sz===6));assert.ok(c.exps.every(e=>e.ptcl.length<=14&&e.smoke.length<=4));
});
for(const fps of [30,60])test(`two-sided salvos remain visible and expire by wall time at ${fps} fps`,()=>{
 const{c}=render();let now=1000;c.Date={now:()=>now};c.PERF_MODE=true;c.VFX_IMPACT={};c.vfxImpactKeyForColor=()=>'';
 c.CX={beginPath(){},moveTo(){},lineTo(){},stroke(){},arc(){},fill(){},createRadialGradient(){return{addColorStop(){}}}};
 vm.runInContext(part(script,'function drawLasers(','function drawExps('),c);
 const group=side=>({id:side,source_side:side,fire_type:'laser',count:300,samples:[{from:{x:0,y:0},to:{x:900,y:400}},{from:{x:100,y:50},to:{x:800,y:300}}]});
 const frame={t:10,combat_events:[],combat_salvos:[group('atk'),group('def')]};c.syncServerCombatEvents(frame);assert.equal(c.lasers.length,4);
 for(let elapsed=0;elapsed<=1500;elapsed+=1000/fps){now=1000+elapsed;c.drawLasers(true);if(elapsed>500&&elapsed<550)assert.deepEqual(new Set(c.lasers.filter(l=>l.age>0).map(l=>l.side)),new Set(['atk','def']));}
 now=2600;c.drawLasers(true);assert.equal(c.lasers.length,0);
 c.syncServerCombatEvents(frame);assert.equal(c.lasers.length,0,'re-sent frame is not repeated');
});
test('combat effects and deduplication memory remain bounded under repeated large frames',()=>{
 const{c}=render();for(let n=0;n<8;n++)c.syncServerCombatEvents({combat_events:Array.from({length:200},(_,i)=>shot('71:combat:'+(n*200+i)))});
 assert.equal(c.lasers.length,256);assert.equal(c.syncServerCombatEvents.seen.size,512);
 const sandbox=render('sandbox');sandbox.c.syncServerCombatEvents({combat_events:[shot('local')]});assert.equal(sandbox.c.lasers.length,0);
});
test('before the first real frame the battle loop draws only the background and unknown counters',()=>{
 const elements=Object.fromEntries(['ai','di','tn','tm','ah','dh'].map(id=>[id,{textContent:'100%',style:{width:'100%'}}]));let bg=0,requested=0;
 let clockAdvances=0;const c={TL_MODE:'battle',document:{hidden:false,getElementById:id=>elements[id]},loopFrame:1,tlDisposed:false,_wsLastFrame:null,_waitingLiveSlot:true,lt:0,drawBG(){bg++;},advanceBattleClock(){clockAdvances++;},requestBattleLoop(){requested++;}};
 vm.createContext(c);vm.runInContext(part(script,'function clearUnconfirmedBattleHud(){','/* ═══════════════════════════════════════════════════════════\n   커맨드'),c);
 c.loop(16);assert.equal(bg,1);assert.equal(requested,1);assert.equal(elements.ai.textContent,'—');assert.equal(elements.di.textContent,'—');assert.equal(elements.tm.textContent,'—');assert.equal(elements.ah.style.width,'0%');
 c.loop(10000);assert.equal(clockAdvances,0,'the battle clock stays stopped while waiting for a live slot');
});
test('ordinary real end, including a first sortie, reaches the parent result without local victory simulation',()=>{
 const sent=[],timers=[];const c={_wsEndPayload:null,_wsLastFrame:{fleets:[],ships:[]},battleOver:false,tlDisposed:false,_confirmedActions:new Map(),advanceBattleClock(){},renderActionSummary(){},loadPersistedActionSummary(){},updateCommandDeck(){},addLog(){},notifyParent:(cmd,payload)=>sent.push({cmd,payload}),setTimeout:(fn,ms)=>timers.push({fn,ms})};
 vm.createContext(c);vm.runInContext(part(script,'function processBattleMessage(','function closeBattleWs('),c);
 c.processBattleMessage({type:'end',winner_side:'atk',duration_seconds:30},'71');assert.equal(c.battleOver,true);assert.ok(sent.some(m=>m.cmd==='ws_end'));assert.equal(timers[0].ms,1800);timers[0].fn();assert.ok(sent.some(m=>m.cmd==='battle_final_done'&&m.payload.winner_side==='atk'));
 c._wsEndPayload=null;const before=sent.length;timers[0].fn();assert.equal(sent.length,before,'seeking a record before a queued end prevents an obsolete result');
});
function viewer({status='active',frames=null,error=null}={}){
 const elements={};const element=id=>elements[id]||(elements[id]={textContent:'',src:'',style:{},classList:{add(){},remove(){},contains(){return true;}},getContext(){return{};}});
 const notices=[],posted=[],drawn=[];let animations=0;
 const origin='https://fixture.invalid';
 element('bvTacticalFrame').contentWindow={postMessage(message,target){assert.equal(target,origin);posted.push(message);}};
 const c={console:{log(){},warn(){},error(){}},LANG:'en',walletState:{address:'dummy'},bv:{_viewerSeq:0,animHandle:null,playing:true,timeline:{frames:[{t:999}],tick_ms:200},battle:{id:999},shownEvents:new Set()},document:{getElementById:element},performance:{now:()=>100},buildTacticalLabUrl:()=>'/tactical?mode=battle&bid=71',loadBvSidePanels(){},defaultReplaySpeed:()=>2,setSpeed(){},showReplaySpeedControl(){},_pageIsActive:()=>true,_activeSleep:async()=>{},rememberBattleContext(){},renderHudSides(){},renderBvCmdBanner(){},formatTickTime:()=> '00:00',showFactionToast:(message,type)=>notices.push({message,type}),requestAnimationFrame:()=>++animations,cancelAnimationFrame(){},bvAnimLoop(){},
 location:{origin},drawBattleFrame:frame=>drawn.push(frame),updateHudFleets(){},showBvEvent(){assert.fail('fixture has no recorded battle events');},
 battleHubReadKeyed:async(key)=>key.startsWith('battle-info:')?error?{error}:{battle:{id:71,status,winner_side:status==='ended'?'atk':null}}:key.startsWith('battle-timeline:')?frames?{timeline:{tick_ms:200,frames}}:null:{actions:[]}};
 vm.createContext(c);
 vm.runInContext(part(hub,'async function openBattleViewer(','function closeBattleViewer('),c);
 vm.runInContext(part(hub,'function getLastTick(','function bvAnimLoop('),c);
 vm.runInContext(part(hub,'function forwardObjectiveReplayFrame(','function drawBattleFrame('),c);
 return{c,notices,posted,drawn,get animations(){return animations;}};
}
for(const [name,input]of[['active pending',{status:'active'}],['ended missing timeline',{status:'ended'}],['info failure',{error:'UNAVAILABLE'}]])test('viewer '+name+' never reuses prior battle or invents an instant result',async()=>{
 const f=viewer(input);await f.c.openBattleViewer(71);assert.equal(f.c.bv.timeline,null);assert.equal(f.animations,0);assert.ok(!f.notices.some(n=>/Auto-win|Auto-loss|instantly/.test(n.message)));if(input.status==='ended'||input.error)assert.ok(f.notices.some(n=>n.type==='error'));
});
test('ordinary terminal battle with actual stored frames uses the same authoritative replay bridge as objectives',async()=>{
 const f=viewer({status:'ended',frames:[{t:0,fleets:[],ships:[]},{t:50,fleets:[],ships:[]}]});await f.c.openBattleViewer(71);assert.equal(f.c.bv._objectiveReplay,true);assert.equal(f.c.bv.timeline.frames.length,2);assert.equal(f.animations,1);assert.ok(!f.notices.length);
 assert.equal(typeof f.c.redrawCurrentFrame,'function');assert.equal(f.drawn[0],f.c.bv.timeline.frames[0]);
 assert.equal(f.posted.length,1);assert.equal(f.posted[0].cmd,'replay_frame');assert.equal(f.posted[0].battleId,71);assert.equal(f.posted[0].payload.tick,0);assert.equal(f.posted[0].payload.realtime,false);
 f.c.redrawCurrentFrame();assert.equal(f.posted.length,1,'actual bridge deduplicates the initial stored frame');
});

test('a one-frame real result never claims an unverified automatic territory capture',async()=>{
 const f=viewer({status:'ended',frames:[{t:0,fleets:[],ships:[]}]});await f.c.openBattleViewer(71);assert.equal(f.c.bv._objectiveReplay,true);assert.ok(!f.notices.length);assert.equal(f.animations,1);
 assert.equal(f.drawn[0],f.c.bv.timeline.frames[0]);assert.equal(f.posted.length,1);assert.equal(f.posted[0].cmd,'replay_frame');assert.equal(f.posted[0].payload.tick,0);
 assert.ok(!f.posted.some(message=>message.cmd==='replay_end'),'opening a short record does not manufacture an end/capture');
});

test('disabled targets and detailed fleet status never expose catalogue HP before the first authoritative frame',()=>{
 const elements={};const element=id=>elements[id]||(elements[id]={textContent:'HP 100%',options:[],value:'breakthrough',disabled:false,replaceChildren(){this.options=[];},appendChild(option){this.options.push(option);}});
 const c={TL_MODE:'battle',TLANG:'en',_wsLastFrame:null,_wsEndPayload:null,_wsRealtime:false,_waitingLiveSlot:false,_liveCancelled:false,_battleSyncWaiting:false,_battleAwaitFrame:false,_battleSyncIncomplete:false,_wsBattle:null,battleOver:false,commandText:key=>key,canCommandBattle:()=>false,document:{getElementById:element,createElement:()=>({}),querySelectorAll:()=>[element('focusChoice'),element('focusApply')]}};
 vm.createContext(c);vm.runInContext(part(script,'function updateCommandDeck(){','// ─── WebSocket 실시간 frame 수신'),c);vm.runInContext(part(script,'function renderFleetStatus(){','function renderRegistry('),c);
 c.updateCommandDeck();c.renderFleetStatus();
 assert.equal(elements.focusChoice.options[0].textContent,'connecting');assert.equal(elements.focusApply.disabled,true);assert.equal(elements.skillApply.textContent,'—');
 for(const id of ['targetNote','compactFleetStatus','manualHoldStatus','fs-grid']){assert.equal(elements[id].textContent,'connecting');assert.ok(!elements[id].textContent.includes('100%'));}
});
