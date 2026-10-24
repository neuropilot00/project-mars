#!/usr/bin/env node
// Actual engine + private localhost WS/HTTP checks. No DB or external services.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const http = require('node:http');
const serverDir = path.resolve(__dirname, '..');
const owner = '0xqa-command-owner-000000000000';
const filename = path.join(serverDir, 'services/battleEngine.js');
const sandbox = { module: { exports: {} }, console, require(name) {
  if (name === '../db') return { pool: { query() { throw Error('Unexpected DB access'); } }, getSetting() { throw Error('Unexpected setting access'); } };
  if (name === './battleEnvironment') return { decorateBattle: b => b };
  if (name === './tacticsAI') return require('../services/tacticsAI');
  return {};
} };
vm.runInNewContext(fs.readFileSync(filename, 'utf8') + '\nmodule.exports.__test = { initBattleState, applyLiveCommandResult, evaluateLiveTactics, captureFrame };', sandbox, { filename });
const { initBattleState, applyLiveCommandResult, evaluateLiveTactics, captureFrame } = sandbox.module.exports.__test;
function fixture() {
  const fleets = [0,1].map(i => ({ fleet_id: i ? '22' : '11', owner_wallet: i ? 'enemy' : owner,
    side: i ? 'def' : 'atk', formation: 'sphere', movement: 'advance',
    ships: Array.from({length:i?1:3}, (_,s) => ({ id: String(100+i*10+s), ship_type_code:'qa',role:'dps',size_class:'cruiser',
      current_hp:10000,max_hp:10000,is_flagship:s===0,base_atk:100,base_def:0,base_speed:1,fire_interval:1000,fire_type:'gun',shots:1 })) }));
  const state = initBattleState({battle:{id:'77',battle_type:'ai'},fleets});
  state.liveTickMs=120;state.tick=10;state.events=[];
  return state;
}
function command(state, action, params={}, extra={}) {
  return applyLiveCommandResult(state,{commandId:'qa-'+action,fleetId:'11',wallet:owner,action,params,...extra});
}
const checks=[];
async function check(name, fn) { await fn(); checks.push(name); console.log('PASS '+name); }
async function main() {
  await check('manual formation survives AI for 10 seconds of paced ticks, then AI resumes',()=>{
    const state=fixture(),f=state.fleets[0];
    const result=command(state,'formation',{formation:'echelon'});
    assert.equal(result.status,'applied');assert.equal(result.manualControlUntilTick,94);assert.equal(result.manualControlRemainingMs,10080);
    for(let tick=10;tick<94;tick++){state.tick=tick;evaluateLiveTactics(f,state,state.events);assert.equal(f.formation,'echelon');}
    state.tick=94;evaluateLiveTactics(f,state,state.events);assert.equal(f.formation,'wedge');assert.equal(f.movement,'flank');
  });
  await check('manual maneuver refreshes the same fleet hold without relying on a client timer',()=>{
    const state=fixture(),f=state.fleets[0];command(state,'formation',{formation:'screen'});
    state.tick=40;const result=command(state,'maneuver',{movement:'scatter'});
    assert.equal(result.manualControlUntilTick,124);state.tick=123;evaluateLiveTactics(f,state,state.events);
    assert.equal(f.formation,'screen');assert.equal(f.movement,'scatter');
    state.tick=124;evaluateLiveTactics(f,state,state.events);assert.equal(f.formation,'wedge');
  });
  await check('invalid tactics reject with a reason without renewing the hold',()=>{
    const state=fixture();assert.equal(command(state,'formation',{formation:'fake'}).reason,'invalid_formation');
    assert.equal(command(state,'maneuver',{movement:'fake'}).reason,'invalid_maneuver');assert.equal(state.fleets[0].manualControlUntilTick,undefined);
  });
  await check('insufficient charge is rejected after acceptance and does not consume charge or damage',()=>{
    const state=fixture();state.fleets[0].beamCharge=99;
    const result=command(state,'beam');assert.equal(result.status,'rejected');assert.equal(result.reason,'charge_insufficient');
    assert.equal(result.charge,99);assert.equal(result.requiredCharge,100);assert.equal(state.fleets[0].beamCharge,99);assert.equal(state.events.length,0);
  });
  await check('charged skill returns the actual damage event and resets charge once',()=>{
    const state=fixture();state.fleets[0].beamCharge=100;
    const result=command(state,'beam');assert.equal(result.status,'applied');assert.equal(result.charge,0);
    const event=state.events.find(e=>e.type==='manual_skill');assert.equal(result.totalDamage,event.payload.total_damage);
    assert.equal(result.targetCount,1);assert.equal(result.totalDamage,2400);assert.equal(state.fleets[1].ships[0].hp,7600);
    assert.equal(command(state,'beam').reason,'charge_insufficient');assert.equal(state.events.length,1);
  });
  await check('owner and unavailable fleet rejections remain authoritative',()=>{
    const state=fixture();assert.equal(command(state,'formation',{formation:'screen'},{wallet:'other'}).reason,'not_your_fleet');
    state.fleets[0].retreated=true;assert.equal(command(state,'beam').reason,'fleet_unavailable');
  });
  await check('live frames expose exact ownership and hold state; offline frame contract stays unchanged',()=>{
    const state=fixture();command(state,'formation',{formation:'line'});state.tick=30;
    const frame=captureFrame(state,30),fleet=frame.fleets[0];assert.equal(fleet.owner_wallet,owner);
    assert.equal(fleet.manualControlRemainingMs,7680);assert.equal(fleet.manualControlUntilTick,94);assert.equal(fleet.retreated,false);
    delete state.liveTickMs;assert.equal('manualControlUntilTick' in captureFrame(state,30).fleets[0],false);
  });
  const live=require('../services/liveBattle');
  await check('queue rejection never silently evicts an accepted command',()=>{
    live.markActive('capacity');
    for(let i=0;i<500;i++)assert.equal(live.enqueueCommand('capacity',{wallet:'wallet-'+i,commandId:String(i)}),true);
    assert.equal(live.enqueueCommandResult('capacity',{wallet:'overflow'}).reason,'queue_full');
    const drained=live.drainCommands('capacity');assert.equal(drained.length,500);assert.equal(drained[0].commandId,'0');live.clearActive('capacity');
    live.markActive('rate');for(let i=0;i<5;i++)assert.equal(live.enqueueCommand('rate',{wallet:owner}),true);
    assert.equal(live.enqueueCommandResult('rate',{wallet:owner}).reason,'rate_limited');assert.equal(live.clearActive('rate').length,5);
  });
  process.env.REDIS_URL='';process.env.JWT_SECRET='private-live-command-regression-only';
  const dbFile=path.join(serverDir,'db.js');
  require.cache[dbFile]={id:dbFile,filename:dbFile,loaded:true,exports:{pool:{async query(sql,p){
    if(sql.includes('SELECT status'))return {rows:[{status:'active'}]};
    if(sql.includes('SELECT fleet_id'))return {rows:String(p[1]).toLowerCase()===owner ? [{fleet_id:'11'}] : []};
    return {rows:String(p[1])==='11'&&String(p[2]).toLowerCase()===owner ? [{status:'active',fleet_id:'11'}] : []};
  }}}};
  const commanderFile=path.join(serverDir,'services/commanderActions.js');
  require.cache[commanderFile]={id:commanderFile,filename:commanderFile,loaded:true,exports:{}};
  const jwt=require('../node_modules/jsonwebtoken'),WebSocket=require('../node_modules/ws'),express=require('../node_modules/express');
  const wsSvc=require('../wsServer');
  const app=express();app.use(express.json());app.use('/api',require('../routes/commanderActions'));
  const server=http.createServer(app),wss=wsSvc.attachWsServer(server),clients=[];
  const delay=ms=>new Promise(r=>setTimeout(r,ms));
  const token=jwt.sign({wallet_address:owner},process.env.JWT_SECRET);
  async function connect(auth=true){
    const messages=[];const ws=new WebSocket(`ws://127.0.0.1:${server.address().port}/ws/battle/77${auth?'?token='+token:''}`);clients.push(ws);
    ws.on('message',raw=>messages.push(JSON.parse(raw.toString())));await new Promise((resolve,reject)=>{ws.once('open',resolve);ws.once('error',reject);});
    await delay(15);return {ws,messages};
  }
  try {
    await new Promise(r=>server.listen(0,'127.0.0.1',r));live.markActive('77');
    const client=await connect(),viewer=await connect(false);
    await check('actual WS separates accepted from engine rejected with the same commandId and owner-only result',async()=>{
      client.ws.send(JSON.stringify({type:'cmd',cmd:'beam',commandId:'ws-low-charge',payload:{fleetId:'11'}}));await delay(30);
      const ack=client.messages.find(m=>m.commandId==='ws-low-charge');assert.equal(ack.type,'cmd_ok');assert.equal(ack.status,'accepted');
      assert.equal(client.messages.some(m=>m.type==='cmd_result'),false);
      const queued=live.drainCommands('77');assert.equal(queued.length,1);wsSvc.broadcastBattleCommandResult('77',applyLiveCommandResult(fixture(),queued[0]));
      await delay(20);const result=client.messages.find(m=>m.type==='cmd_result');assert.equal(result.commandId,ack.commandId);
      assert.equal(result.status,'rejected');assert.equal(result.reason,'charge_insufficient');assert.equal('wallet' in result,false);
      assert.equal(viewer.messages.some(m=>m.type==='cmd_result'),false);
    });
    await delay(1050);
    await check('actual WS routes position coordinates to the engine and sends the accepted path only to its owner',async()=>{
      client.ws.send(JSON.stringify({type:'cmd',cmd:'move',commandId:'ws-move',payload:{fleetId:'11',x:300,y:180}}));await delay(30);
      const ack=client.messages.find(m=>m.commandId==='ws-move');assert.equal(ack.status,'accepted');
      const queued=live.drainCommands('77');assert.equal(queued.length,1);assert.equal(queued[0].params.x,300);assert.equal(queued[0].params.y,180);
      wsSvc.broadcastBattleCommandResult('77',applyLiveCommandResult(fixture(),queued[0]));await delay(20);
      const result=client.messages.find(m=>m.type==='cmd_result'&&m.commandId==='ws-move');assert.equal(result.status,'applied');assert.equal(result.navigation.x,300);assert.equal(result.navigation.mode,'move');
      assert.equal(viewer.messages.some(m=>m.type==='cmd_result'&&m.commandId==='ws-move'),false);
    });
    await check('HTTP live command returns the client commandId and explicit acceptance, with the same terminal WS result',async()=>{
      const response=await fetch(`http://127.0.0.1:${server.address().port}/api/battles/77/commander-action`,{
        method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},
        body:JSON.stringify({action_type:'formation_change',commandId:'http-tactic',params:{formation:'echelon'}})});
      const ack=await response.json();assert.equal(response.status,200);assert.equal(ack.commandId,'http-tactic');assert.equal(ack.status,'accepted');
      const state=fixture(),queued=live.drainCommands('77');assert.equal(queued[0].commandId,ack.commandId);
      wsSvc.broadcastBattleCommandResult('77',applyLiveCommandResult(state,queued[0]));await delay(20);
      const result=client.messages.find(m=>m.type==='cmd_result'&&m.commandId===ack.commandId);assert.equal(result.status,'applied');assert.equal(result.manualControlRemainingMs,10080);
    });
  } finally { live.clearActive('77');for(const client of clients)client.terminate();await new Promise(r=>wss.close(r));await new Promise(r=>server.close(r)); }
  console.log(JSON.stringify({checks:checks.length,passed:checks.length,databaseUsed:false,externalServicesUsed:false}));
}
main().catch(error=>{console.error(error);process.exitCode=1;});
