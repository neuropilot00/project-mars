#!/usr/bin/env node
'use strict';
// Synthetic participants, actual catalogue/engine/commands; no battle/economy writes.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),zlib=require('node:zlib'),{Pool}=require('pg');
const url=new URL(process.env.DATABASE_URL||'');
if(!['localhost','127.0.0.1'].includes(url.hostname)||url.pathname!=='/codex_occupy_review_upgrade_20261010')throw Error('Exact local review DB required');
const pool=new Pool({connectionString:url.href}),out=process.argv[2];
const engineFile=path.join(__dirname,'../services/battleEngine.js'),source=fs.readFileSync(engineFile,'utf8');
function loadEngine(data,seed){
 const math=Object.create(Math);math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 const c={module:{exports:{}},fixture:data,Math:math,console:{log(){},warn(){},error(){}},Buffer,Date,setTimeout,require(n){
  if(n==='../db')return{getSetting:async(k,f)=>f};
  if(n==='./battleEnvironment')return require('../services/battleEnvironment');
  if(n==='./tacticsAI')return require('../services/tacticsAI');
  if(n==='./objectiveOperations')return{initObjective(){},beforeTick(){},evaluateObjective(){return null;}};
  throw Error('Unexpected simulation dependency '+n);
 }};
 vm.runInNewContext(source+'\nloadBattleData=async()=>fixture;_sleep=async()=>{};module.exports.initBattleState=initBattleState;',c,{filename:engineFile});return c.module.exports;
}
function roster(catalogue,owners,wings,perFleet){
 return['atk','def'].flatMap((side,i)=>Array.from({length:owners},(_,owner)=>Array.from({length:wings},(_,wing)=>{
  const codes=i?['mcc_int','mcc_dst','mcc_crs','mcc_bs','mcc_ewar']:['fsp_int','fsp_dst','fsp_crs','fsp_bs','fsp_logi'];
  const id=i*owners*wings+owner*wings+wing+1;
  return{fleet_id:String(id),fleet_name:side+' '+(owner+1)+' / '+(wing+1),side,owner_wallet:'0x'+String(i*owners+owner+1).padStart(40,'0'),formation:wing?'screen':'wedge',movement:'advance',
   ships:Array.from({length:perFleet},(_,j)=>{const code=codes[j%codes.length],type=catalogue.get(code);assert.ok(type,code);return{...type,id:String(id*1000+j),ship_type_code:code,current_hp:type.base_hp,max_hp:type.base_hp,is_flagship:j===0};})};
 })).flat());
}
(async()=>{
 const {rows}=await pool.query('SELECT * FROM ship_types');await pool.end();const catalogue=new Map(rows.map(r=>[r.code,r])),reports=[];
 for(const scenario of [{name:'solo100',owners:1,wings:1,ships:100},{name:'coalition50',owners:3,wings:1,ships:50},{name:'coalition100-auto',owners:3,wings:2,ships:50},{name:'coalition100-tactics',owners:3,wings:2,ships:50,tactics:true}]){
  const data={battle:{id:713,battle_type:'pvp_duel'},fleets:roster(catalogue,scenario.owners,scenario.wings,scenario.ships)},engine=loadEngine(data,20261028),initial=engine.initBattleState(data);
  for(const side of ['atk','def']){const f=initial.fleets.filter(f=>f.side===side);assert.equal(new Set(f.map(f=>f.cx+':'+f.cy)).size,f.length);assert.ok(f.every(f=>side==='atk'?f.cx<350:f.cx>650));}
  const own=data.fleets.filter(f=>f.side==='atk').slice(0,scenario.wings),commands=[],receipts=[],opening=[];let tick=-1;
  function queue(at,f,action,params={}){commands.push({at,command:{commandId:'sim-'+commands.length,fleetId:f.fleet_id,wallet:f.owner_wallet,action,params}});}
  if(scenario.tactics){
   for(const f of own){queue(0,f,'formation',{formation:'screen'});queue(0,f,'focus',{targetFleetId:String(scenario.owners*scenario.wings+2)});queue(10,f,'beam');queue(30,f,'missile');queue(60,f,'move',{x:280,y:f===own[0]?120:320});queue(100,f,'hold');queue(150,f,'auto');}
   queue(0,{...data.fleets.at(-1),owner_wallet:own[0].owner_wallet},'hold');
  }
  const started=performance.now(),result=await engine.simulateBattleLive(713,{tickMs:200,wallClockMs:120000,drainCommands(){const ready=commands.filter(c=>c.at<=tick);for(const c of ready)commands.splice(commands.indexOf(c),1);return ready.map(c=>c.command);},onFrame(f){tick=f.t;if(f.t<=300)opening.push(f);},onCommandResult(r){receipts.push(r);}});
  const elapsed=Math.round(performance.now()-started),total=scenario.owners*scenario.wings*scenario.ships;
  for(const side of ['atk','def']){assert.equal(result.stats[side].ships_total,total);assert.equal(result.stats.by_ship.filter(s=>s.side===side&&!s.is_alive).length,result.stats[side].ships_lost);}
  assert.equal(result.stats.by_ship.length,total*2);assert.equal(result.timeline.frames.at(-1).t,result.duration_ticks);
  for(const ship of result.stats.by_ship){assert.ok(Number.isFinite(ship.current_hp)&&ship.current_hp>=0&&ship.current_hp<=ship.max_hp);const frameShip=result.timeline.frames.at(-1).ships.find(s=>String(s.id)===String(ship.ship_id));assert.equal(!!frameShip&&frameShip.hp>0,ship.is_alive);}
  if(scenario.tactics){assert.equal(receipts.filter(r=>r.reason==='not_your_fleet').length,1);assert.equal(receipts.filter(r=>r.status==='applied').length,14);assert.ok(receipts.some(r=>r.cmd==='beam'&&r.charge===0&&r.totalDamage>0));}
  const report={...scenario,totalShips:total*2,simulationMs:elapsed,winner:result.winner_side,ticks:result.duration_ticks,atk:result.stats.atk,def:result.stats.def,commands:receipts.map(({wallet,...rest})=>rest)};reports.push(report);
  if(out){fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,scenario.name+'.json.gz'),zlib.gzipSync(JSON.stringify({input:data,result,openingFrames:opening,catalog:rows})));}
 }
 const a=reports.find(r=>r.name==='coalition100-auto'),b=reports.find(r=>r.name==='coalition100-tactics');assert.notDeepEqual({atk:a.atk,def:a.def},{atk:b.atk,def:b.def},'real orders must change combat outcomes, not only UI');
 const report={scope:'actual live engine advanced without wall-clock sleeping; synthetic ownership/catalogue rosters, not production multiplayer',seed:20261028,cases:reports};if(out)fs.writeFileSync(path.join(out,'coalition-simulation.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
})().catch(async e=>{await pool.end().catch(()=>{});console.error(e);process.exitCode=1;});
