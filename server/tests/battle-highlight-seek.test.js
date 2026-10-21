'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'../..');
const hub=fs.readFileSync(path.join(root,'assets/battle-hub-modal.js'),'utf8');
const lab=fs.readFileSync(path.join(root,'assets/tactical-lab-v11.html'),'utf8');
const modal=fs.readFileSync(path.join(root,'assets/tactical-lab-modal.js'),'utf8');
const part=(source,start,end)=>source.slice(source.indexOf(start),source.indexOf(end,source.indexOf(start)));
const origin='https://fixture.invalid';
function fixture(status='ended'){
  const posted=[],events=[],drawn=[],elements=new Map(),parent={};
  const frames=[0,780,786,800].map(t=>({t,fleets:[{id:1,side:'atk',hp:100,maxHp:100},{id:2,side:'def',hp:t>=786?0:100,maxHp:100}],ships:[]}));
  const iframe=vm.createContext({window:{parent},location:{origin},tlQuery:()=> '2',closeBattleWs(){},renderObjectiveBanner(){},loadPersistedActionSummary(){},syncServerShips(){},syncServerCombatEvents(){},updateCommandDeck(){},renderActionSummary(){},addLog(){},performance:{now:()=>1000},fleets:[],setTimeout(){},notifyParent(){}});
  vm.runInContext("let _parentReplay=false,_battleUiReady=false,_queuedReplayFrame=null,_queuedReplayEnd=null,_wsRealtime=false,_wsLastFrame=null,_wsEndPayload=null,btMs=0,battleOver=false,_wsPrevShips=new Map();",iframe);
  vm.runInContext(part(lab,'function receiveObjectiveReplayMessage(','window.addEventListener(\'message\',receiveObjectiveReplayMessage)'),iframe);
  vm.runInContext(part(lab,'function processBattleMessage(','function closeBattleWs('),iframe);
  const el=id=>{if(!elements.has(id))elements.set(id,{textContent:'',style:{},classList:{contains:()=>true,add(){},remove(){}},getContext:()=>({})});return elements.get(id);};
  el('bvTacticalFrame').contentWindow={postMessage(message,target){assert.equal(target,origin);posted.push(message);iframe.receiveObjectiveReplayMessage({origin,source:parent,data:message});}};
  const c=vm.createContext({URLSearchParams,location:{origin},document:{getElementById:el},walletState:{address:'commander'},
    bv:{_viewerSeq:0,shownEvents:new Set(),speed:1},BATTLEFIELD_LABELS:{},
    getLang:()=> 'en',getTacticalLabAssetVersion:()=> 'fixture',
    loadBvSidePanels(){},renderHudSides(){},renderBvCmdBanner(){},rememberBattleContext(){},
    _pageIsActive:()=>true,_activeSleep:async()=>{},performance:{now:()=>1000},
    requestAnimationFrame:()=>1,bvAnimLoop(){},cancelAnimationFrame(){},_clearActiveTimeout(){},showFactionToast(){},
    drawBattleFrame:f=>drawn.push(f),updateHudFleets(){},showBvEvent:e=>events.push(e),
    formatTickTime:t=>Math.floor(t*200/60000).toString().padStart(2,'0')+':'+Math.floor(t*200/1000%60).toString().padStart(2,'0'),
    battleHubReadKeyed:async key=>key.startsWith('battle-info:')?{battle:{id:2,status},events:[{id:'old',tick:20},{id:'highlight',tick:786}]}:key.startsWith('battle-timeline:')?{timeline:{tick_ms:200,frames}}:{actions:[]},console});
  vm.runInContext(part(modal,'function buildTacticalLabUrl(','function pickBattlefieldKey('),c);
  vm.runInContext(part(hub,'function openBattleViewerAt(','function closeBattleViewer('),c);
  vm.runInContext(part(hub,'function getLastTick(','function bvAnimLoop('),c);
  vm.runInContext(part(hub,'function forwardObjectiveReplayFrame(','function drawBattleFrame('),c);
  return{c,iframe,posted,events,drawn,el,ready(){vm.runInContext('_battleUiReady=true',iframe);const queued=vm.runInContext('_queuedReplayFrame',iframe);if(queued)iframe.receiveObjectiveReplayMessage({origin,source:parent,data:queued});}};
}
test('actual parent timeline jump queues the first recorded highlight frame into the loading iframe, with absolute clock and HP',async()=>{
  const f=fixture();await f.c.openBattleViewer(2,786);
  assert.equal(new URL(f.el('bvTacticalFrame').src,origin).searchParams.get('startTick'),'786');
  assert.equal(f.c.bv.currentTick,786);assert.equal(f.el('bvHudTime').textContent,'02:37');
  assert.equal(f.posted[0].payload.tick,786);assert.equal(f.posted[0].payload.fleets[1].hp,0);
  assert.equal(f.posted[0].payload.realtime,false);assert.equal(f.posted[0].cmd,'replay_frame');
  assert.equal(vm.runInContext('_wsLastFrame',f.iframe),null,'early frame is queued until the real iframe is ready');
  f.ready();assert.equal(vm.runInContext('btMs',f.iframe),157200);
  assert.equal(vm.runInContext('_wsLastFrame.fleets[1].hp',f.iframe),0);
  assert.equal(vm.runInContext('_wsRealtime',f.iframe),false);
  assert.deepEqual(f.events.map(e=>e.id),['highlight']);assert.ok(f.c.bv.shownEvents.has('old'));
  f.c.redrawCurrentFrame();assert.equal(f.posted.length,1);assert.equal(f.events.length,1,'redraw does not duplicate the frame or event');
});
test('invalid and out-of-range ticks clamp safely; sparse recordings forward an actual earlier stored frame',async()=>{
  for(const [requested,expected,stored] of [[undefined,0,0],['invalid',0,0],[Infinity,0,0],[-10,0,0],[9999,800,800],[785.9,785,780]]){
    const f=fixture();await f.c.openBattleViewer(2,requested);
    assert.equal(f.c.bv.currentTick,expected);assert.equal(f.posted[0].payload.tick,stored);
  }
});
test('an active ordinary battle keeps live mode and does not receive a stored-frame seek or replay command',async()=>{
  const f=fixture('active');await f.c.openBattleViewer(2,786);
  assert.equal(f.c.bv.currentTick,0);assert.equal(f.c.bv._objectiveReplay,false);assert.equal(f.posted.length,0);
});
for(const mode of ['battle','sandbox'])test('actual iframe boot preserves sandbox fast-forward and excludes fake battle seek overlays in '+mode,async()=>{
  const speeds=[],appended=[],timers=[];
  const c=vm.createContext({TL_MODE:mode,TLANG:'en',_battleUiReady:false,_queuedReplayFrame:null,_queuedReplayEnd:null,
    tlQuery:()=> '786',syncCompactCommandLayout(){},notifyParent(){},localizeStaticUI(){},loadCatalog:async()=>true,
    renderRegistry(){},renderMinerals(){},renderAnalysis(){},renderFleetStatus(){},initBattle(){},
    updateCommandDeck(){},requestBattleLoop(){},connectBattleWs(){},setSimSpeed:s=>speeds.push(s),
    document:{createElement:()=>({style:{}}),body:{appendChild:el=>appended.push(el)}},setTimeout:(fn,ms)=>timers.push({fn,ms}),window:{parent:{}}});
  vm.runInContext(part(lab,'async function boot(){','boot();'),c);await c.boot();
  assert.deepEqual(speeds,mode==='battle'?[1]:[1,8]);assert.equal(appended.length,mode==='battle'?0:1);
  assert.equal(timers.length,mode==='battle'?0:1);
});
