#!/usr/bin/env node
// Registered mode boundaries through real engine/HTTP code; no shared server or DB.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),http=require('node:http');
const express=require('../node_modules/express'),jwt=require('../node_modules/jsonwebtoken');
const objective=require('../services/objectiveOperations');
const type={id:'9007199254740993',code:'qa',base_hp:1000,base_atk:10,base_def:5,base_speed:1,fire_interval:100,fire_type:'gun',shots:1,size_class:'frigate',role:'dps',render_radius:2};
const standard={ruleset:'standard_v1',catalogByShipId:{[type.id]:type}};
let activeStandard=null,transaction;const calls=[];
const filename=path.join(__dirname,'../services/battleEngine.js');
const sandbox={module:{exports:{}},console,require(name){
 if(name==='../db')return {pool:{connect:async()=>transaction},getSetting:async(k,f)=>k==='full_loss_mode'?'always':f};
 if(name==='./battleEnvironment')return {decorateBattle:b=>b};
 if(name==='./objectiveOperations')return {loadRegisteredObjective:async()=>null};
 if(name==='./fleetDuelInvitations')return {getAcceptedStandardDuel:async()=>activeStandard};return {};
}};
vm.runInNewContext(fs.readFileSync(filename,'utf8')+'\nmodule.exports.__test={normalizeStandardShip,initBattleState,captureFrame};',sandbox,{filename});
const engine=sandbox.module.exports;const checks=[];
async function check(name,fn){await fn();checks.push(name);console.log('PASS '+name);}
function fleet(id,side,alive=true){return {id,side,cx:500,cy:220,ships:[{id:id+'1',hp:1000,isAlive:alive,withdrawn:false}],retreated:false};}
async function main(){
 await check('standard normalization preserves exact BIGINT and original paid stats while simulating catalog-only full HP',()=>{
 const raw={id:type.id,ship_type_code:'qa',current_hp:3,max_hp:2000,bonus_atk:99,bonus_def:90,bonus_hp:500,bonus_speed:7,shield_hp:200,shield_max:500,part_effects:[{atk_pct:20}]};
 const normalized=engine.__test.normalizeStandardShip(raw,standard);assert.equal(normalized.id,type.id);assert.equal(raw.current_hp,3);assert.equal(raw.bonus_atk,99);
 const state=engine.__test.initBattleState({battle:{id:'7'},fleets:[{fleet_id:'1',side:'atk',ships:[normalized],combatPowerMult:1}]});
 const ship=state.fleets[0].ships[0];assert.equal(ship.hp,1000);assert.equal(ship.atk,10);assert.equal(ship.def,5);assert.equal(ship.speed,1);assert.equal(ship.shield_hp,0);assert.equal(ship.part_effects.length,0);
 assert.throws(()=>engine.__test.normalizeStandardShip({...raw,id:'9007199254740992'},standard),/STANDARD_DUEL_REGISTRATION_MISMATCH/);
 });
 await check('actual standard settlement releases fleets and persists simulated results without ships, wrecks or career changes',async()=>{
 activeStandard=standard;transaction={release(){},async query(sql,p){calls.push({sql,p});if(sql.includes('SELECT battle_type, status'))return {rows:[{battle_type:'pvp_duel',status:'active',battle_summary:{duel_mode:'standard_v1'}}],rowCount:1};return {rows:[],rowCount:1};}};
 const side={ships_total:1,ships_lost:1,damage_dealt:100,kills:1};
 await engine.applyBattleResults('7',{winner_side:'atk',duration_seconds:60,events:[{type:'ship_destroyed',ship_id:type.id,tick:1}],stats:{atk:side,def:side,by_player:{},by_fleet:[{fleet_id:'1',side:'atk',...side}],by_ship:[{ship_id:type.id,is_alive:false,current_hp:0}]}});
 assert.equal(calls.some(c=>c.sql.includes('UPDATE ships')||c.sql.includes('INSERT INTO ship_wrecks')),false);
 const fleetWrite=calls.find(c=>c.sql.includes('UPDATE fleets SET'));assert.deepEqual(Array.from(fleetWrite.p),[0,0,0,'1']);
 const saved=JSON.parse(calls.find(c=>c.sql.includes('UPDATE fleet_battles')).p[6]);assert.equal(saved.combat_policy.asset_updates,false);assert.equal(saved.combat_policy.permanent_loss,false);assert.equal(saved.combat_policy.standard_ruleset,'standard_v1');
 activeStandard=null;
 });
 const base={playerFleetIds:['1'],npcFleetIds:['2'],targetShipId:'21',targetFleetId:'2',convoyShipId:'31',convoyFleetId:'3',deadlineSeconds:150,holdTargetSeconds:90,zone:{cx:500,cy:220,radius:170},route:{start:{cx:200,cy:220},end:{cx:500,cy:220},durationSeconds:120},positions:{}};
 await check('escort continues after enemy elimination, reaches actual route endpoint at 120 paced seconds and frames carry progress',()=>{
 const state={tick:0,liveTickMs:120,fleets:[fleet('1','atk'),fleet('2','def',false),fleet('3','atk')]};objective.initObjective(state,{...base,kind:'escort'});let result;
 for(let tick=0;tick<1000;tick++){state.tick=tick;objective.beforeTick(state);result=objective.evaluateObjective(state);if(tick<999)assert.equal(result,null);}
 assert.equal(result.winner_side,'atk');assert.equal(result.progress.reason,'convoy_arrived');assert.equal(state.fleets[2].cx,500);
 assert.equal(engine.__test.captureFrame(state,999).objective.route_progress,1);
 });
 await check('hold pauses for enemies and needs 90 uncontested paced seconds; player elimination always fails',()=>{
 const state={tick:0,liveTickMs:120,fleets:[fleet('1','atk'),fleet('2','def')]};objective.initObjective(state,{...base,kind:'hold'});
 for(let t=0;t<20;t++){state.tick=t;assert.equal(objective.evaluateObjective(state),null);}assert.equal(state.objective.holdSeconds,0);
 state.fleets[1].cx=900;let result;for(let t=20;t<770;t++){state.tick=t;result=objective.evaluateObjective(state);if(t<769)assert.equal(result,null);}assert.equal(result.progress.reason,'relay_held');
 state.fleets[0].retreated=true;state.tick++;assert.equal(objective.evaluateObjective(state).progress.reason,'player_eliminated');
 });
 await check('flagship only wins from exact target death and otherwise fails at the 150 second deadline',()=>{
 const state={tick:0,liveTickMs:200,fleets:[fleet('1','atk'),fleet('2','def')]};objective.initObjective(state,{...base,kind:'flagship'});assert.equal(objective.evaluateObjective(state),null);
 state.fleets[1].ships[0].isAlive=false;state.tick++;assert.equal(objective.evaluateObjective(state).progress.reason,'flagship_destroyed');
 state.fleets[1].ships[0].isAlive=true;objective.initObjective(state,{...base,kind:'flagship'});for(let t=0;t<750;t++){state.tick=t;var result=objective.evaluateObjective(state);}assert.equal(result.winner_side,'def');assert.equal(result.progress.reason,'objective_deadline');
 });
 await check('standard pre-battle loader preserves free formation/maneuver while excluding paid or artificial reinforcements',async()=>{
 const actions=[{side:'atk',action_type:'formation_change',gp_cost:'0',params:{formation:'screen'}},{side:'atk',action_type:'maneuver_change',gp_cost:0,params:{maneuver:'rally'}},{side:'atk',action_type:'reinforce',gp_cost:0,params:{shipTypeCode:'qa',count:5}},{side:'def',action_type:'formation_change',gp_cost:50,params:{formation:'wedge'}},{side:'atk',action_type:'emp',gp_cost:50,params:{}}];
 const file=path.join(__dirname,'../services/commanderActions.js'),box={module:{exports:{}},console,require(name){if(name==='../db')return {pool:{query:async()=>({rows:actions})},getSetting:async(k,f)=>f};return {};}};
 vm.runInNewContext(fs.readFileSync(file,'utf8'),box,{filename:file});const result=await box.module.exports.loadForBattle('7',{standardFreeOnly:true});assert.equal(result.formationsBySide.atk,'screen');assert.equal(result.maneuversBySide.atk,'rally');assert.equal(result.formationsBySide.def,undefined);assert.equal(result.reinforcements.length,0);assert.equal(result.empSchedule.length,0);
 });
 await check('actual authenticated HTTP paid command rejects before debit or commander action insertion',async()=>{
 const writes=[];const client={release(){},async query(sql,p){writes.push(sql);if(sql.includes('SELECT id, status'))return {rows:[{id:'7',status:'preparing'}]};if(sql.includes('SELECT side'))return {rows:[{side:'atk'}]};return {rows:[]};}};
 const serviceFile=path.join(__dirname,'../services/commanderActions.js');const serviceBox={module:{exports:{}},console,require(name){if(name==='../db')return {pool:{connect:async()=>client},getSetting:async(k,f)=>f};if(name==='./fleetDuelInvitations')return {getAcceptedStandardDuel:async()=>standard};return {};}};
 vm.runInNewContext(fs.readFileSync(serviceFile,'utf8'),serviceBox,{filename:serviceFile});
 const routeFile=path.join(__dirname,'../routes/commanderActions.js');const routeBox={module:{exports:{}},console,process:{env:{JWT_SECRET:'isolated-mode-test'}},require(name){if(name==='express')return express;if(name==='jsonwebtoken')return jwt;if(name==='../services/commanderActions')return serviceBox.module.exports;if(name==='../services/liveBattle')return {isActive:()=>false};if(name==='../db')return {pool:{query:async()=>({rows:[{status:'preparing'}]})}};return {};}};
 vm.runInNewContext(fs.readFileSync(routeFile,'utf8'),routeBox,{filename:routeFile});const app=express();app.use(express.json());app.use('/api',routeBox.module.exports);const server=http.createServer(app);
 try{await new Promise(r=>server.listen(0,'127.0.0.1',r));const token=jwt.sign({wallet_address:'0xisolatedstandardowner'},'isolated-mode-test');const response=await fetch(`http://127.0.0.1:${server.address().port}/api/battles/7/commander-action`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({action_type:'emp'})});assert.equal(response.status,409);assert.equal((await response.json()).error,'STANDARD_DUEL_PAID_ACTION_DISABLED');assert.equal(writes.some(s=>s.includes('UPDATE users')||s.includes('INSERT INTO commander_actions')),false);assert.ok(writes.includes('ROLLBACK'));}finally{await new Promise(r=>server.close(r));}
 });
 console.log(JSON.stringify({checks:checks.length,passed:checks.length,databaseUsed:false,sharedServerUsed:false}));
}
main().catch(error=>{console.error(error);process.exitCode=1;});
