#!/usr/bin/env node
'use strict';
// Real combat engine and local catalogue; synthetic rosters, no battle or economy writes.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),zlib=require('node:zlib');
const {Pool}=require('pg');
const url=new URL(process.env.DATABASE_URL||'');
if(!['localhost','127.0.0.1'].includes(url.hostname)||url.pathname!=='/codex_occupy_review_upgrade_20261010')throw Error('Exact disposable local review DB required');
const pool=new Pool({connectionString:url.href}),output=process.argv[2];
const filename=path.join(__dirname,'../services/battleEngine.js'),source=fs.readFileSync(filename,'utf8');
function engine(data,seed){
 const math=Object.create(Math);math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 const c={module:{exports:{}},console:{log(){},warn(){},error(){}},Buffer,Date,setTimeout,Math:math,fixture:data,require(name){
  if(name==='../db')return{getSetting:async(k,fallback)=>fallback,pool:{query(){throw Error('Combat simulation must not access DB');}}};
  if(name==='./battleEnvironment')return require('../services/battleEnvironment');
  if(name==='./tacticsAI')return require('../services/tacticsAI');
  if(name==='./objectiveOperations')return{initObjective(){},beforeTick(){},evaluateObjective(){return null;}};
  throw Error('Unexpected simulation dependency: '+name);
 }};
 vm.runInNewContext(source+'\nloadBattleData=async()=>fixture;',c,{filename});return c.module.exports;
}
(async()=>{
 const {rows}=await pool.query('SELECT * FROM ship_types');await pool.end();
 const catalogue=new Map(rows.map(r=>[r.code,r])),cases=[];
 for(const size of [3,50,200]){
  const fleets=['atk','def'].map((side,i)=>{
   const codes=i?['mcc_int','mcc_frg','mcc_crs','mcc_bs']:['fsp_int','fsp_dst','fsp_crs','fsp_bs'];
   return{fleet_id:String(i+1),fleet_name:'SIMULATION '+side,owner_wallet:'simulation-'+side,side,formation:'wedge',movement:'advance',
    ships:Array.from({length:size},(_,j)=>{const type=catalogue.get(codes[j%codes.length]);assert.ok(type,codes[j%codes.length]);return{...type,id:String(i*size+j+1),ship_type_code:type.code,current_hp:type.base_hp,max_hp:type.base_hp,is_flagship:j===0};})};
  });
  const data={battle:{id:size,battle_type:'pvp_duel'},fleets},started=performance.now();
  const result=await engine(data,20261028+size).simulateBattle(size),durationMs=Math.round(performance.now()-started);
  assert.ok(['atk','def','draw'].includes(result.winner_side));assert.equal(result.stats.by_ship.length,size*2);
  const final=result.timeline.frames.at(-1);assert.equal(final.t,result.duration_ticks);
  for(const side of ['atk','def']){
   assert.equal(result.stats[side].ships_total,size);
   const ships=result.stats.by_ship.filter(s=>s.side===side);assert.equal(ships.filter(s=>!s.is_alive).length,result.stats[side].ships_lost);
   for(const ship of ships){assert.ok(Number.isFinite(ship.current_hp)&&ship.current_hp>=0&&ship.current_hp<=ship.max_hp);const f=final.ships.find(s=>String(s.id)===String(ship.ship_id));assert.equal(!!f&&f.hp>0,ship.is_alive);}
  }
  assert.ok(result.timeline.frames.some(f=>(f.combat_events||[]).some(e=>e.type==='shot_hit')),'actual hits recorded');
  const tape=zlib.gzipSync(JSON.stringify(result)),record={shipsPerSide:size,totalShips:size*2,winner:result.winner_side,durationTicks:result.duration_ticks,simulationMs:durationMs,frames:result.timeline.frames.length,eventCount:result.events.length,gzipBytes:tape.length,atk:result.stats.atk,def:result.stats.def};cases.push(record);
  if(output){fs.mkdirSync(output,{recursive:true});fs.writeFileSync(path.join(output,'battle-'+size+'-vs-'+size+'.json.gz'),tape);}
 }
 const report={scope:'synthetic rosters through actual battleEngine; local catalogue; no production state writes',seed:20261028,cases};
 if(output)fs.writeFileSync(path.join(output,'fleet-simulation.json'),JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify(report,null,2));
})().catch(async e=>{await pool.end().catch(()=>{});console.error(e);process.exitCode=1;});
