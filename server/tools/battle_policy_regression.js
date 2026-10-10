#!/usr/bin/env node
// Exercise real policy/occupancy/stat helpers with isolated transactional doubles.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const occupancy=require('../services/fleetOccupancy');
const filename=path.join(__dirname,'../services/battleEngine.js');
let transaction;
const sandbox={module:{exports:{}},console,require(name){
  if(name==='../db')return {pool:{connect:async()=>transaction},getSetting:async(k,f)=>k==='full_loss_mode'?'always':f};
  if(name==='./objectiveOperations')return {loadRegisteredObjective:async()=>null};
  if(name==='./fleetDuelInvitations')return {getAcceptedStandardDuel:async()=>null};
  if(name==='./battleEnvironment')return {decorateBattle:b=>b};
  return {};
}};
vm.runInNewContext(fs.readFileSync(filename,'utf8')+'\nmodule.exports.__test={getSafeTrainingMode,initBattleState,computeBattleStats};',sandbox,{filename});
const engine=sandbox.module.exports;
const checks=[];
async function test(name,run){await run();checks.push(name);console.log('PASS '+name);}
function cargoClient({cargo=[],mining=[],table=true}={}){const calls=[];return {calls,async query(sql,params){calls.push({sql,params});
  if(sql.includes('to_regclass'))return {rows:[{name:table?'frontier_cargo':null}]};
  return {rows:(sql.includes('ship_mining_jobs')?mining:cargo).map(fleet_id=>({fleet_id}))};}};}
async function main(){
  await test('cargo guard blocks an exactly preserved BIGINT fleet under the shared guard',async()=>{
    const client=cargoClient({cargo:['9007199254740993']});
    await assert.rejects(occupancy.assertFleetsNotMining(client,['9007199254740993']),error=>error.message==='FLEET_TRANSPORTING'&&error.meta.fleet_ids[0]==='9007199254740993');
    assert.equal(client.calls.find(c=>c.sql.includes('frontier_cargo WHERE')).params[0][0],'9007199254740993');
    await assert.rejects(occupancy.assertFleetsNotMining(client,[Number('9007199254740993')]),/INVALID_FLEET_ID/);
  });
  await test('mining rejection still preserves the callers error code and no cargo query follows',async()=>{
    const client=cargoClient({mining:['7']});await assert.rejects(occupancy.assertFleetsNotMining(client,[7],'ATK_FLEET_MINING'),/ATK_FLEET_MINING/);
    assert.equal(client.calls.length,1);
  });
  await test('an optional cargo table is checked before querying it inside a transaction',async()=>{
    const client=cargoClient({table:false});await occupancy.assertFleetsNotMining(client,['7']);
    assert.equal(client.calls.some(c=>c.sql.includes('frontier_cargo WHERE')),false);
  });
  const shipFile=path.join(__dirname,'../services/ship.js');
  const shipSandbox={module:{exports:{}},console,require(name){if(name==='../db')return {};if(name==='./fleetOccupancy')return occupancy;return {};}};
  vm.runInNewContext(fs.readFileSync(shipFile,'utf8')+'\nmodule.exports.__test={assertShipNotInBattle,getOrCreateDefaultFleet};',shipSandbox,{filename:shipFile});
  const shipHelpers=shipSandbox.module.exports.__test;
  function shipClient(allReserved=false){const calls=[];return {calls,async query(sql,p){calls.push({sql,p});
    if(sql.includes('ORDER BY id ASC FOR UPDATE'))return {rows:[{id:'1'},{id:'2'}]};
    if(sql.includes('SELECT is_in_battle'))return {rows:[{is_in_battle:false,current_battle_id:null}]};
    if(sql.includes('to_regclass'))return {rows:[{name:'frontier_cargo'}]};
    if(sql.includes('frontier_cargo WHERE'))return {rows:p[0][0]==='1'||allReserved?[{fleet_id:p[0][0]}]:[]};
    if(sql.includes('INSERT INTO fleets'))return {rows:[{id:'3'}]};return {rows:[]};
  }};}
  await test('the actual ship mutation guard locks its fleet before rejecting a moving cargo fleet',async()=>{
    const client=shipClient();await assert.rejects(shipHelpers.assertShipNotInBattle(client,'1'),/FLEET_TRANSPORTING/);
    assert.ok(client.calls[0].sql.includes('FOR UPDATE'));
  });
  await test('the actual default build fleet selector skips cargo reservations or creates a free fleet',async()=>{
    assert.equal(await shipHelpers.getOrCreateDefaultFleet(shipClient(),'owner'),'2');
    assert.equal(await shipHelpers.getOrCreateDefaultFleet(shipClient(true),'owner'),'3');
  });
  await test('training flags only exempt trusted starter or registered frontier with a real AI defender',async()=>{
    const calls=[];const client={async query(sql){calls.push(sql);return {rows:sql.includes('to_regclass')?[{name:'frontier_battles'}]:[]};}};
    const safe=engine.__test.getSafeTrainingMode;
    assert.equal(await safe(client,'7',{starter_training:true}),null);
    assert.equal(await safe(client,'7',{is_starter_battle:true,starter_training:true,trusted_source:'client'}),null);
    assert.equal(await safe(client,'7',{is_starter_battle:true,starter_training:true,trusted_source:'starter_ops'}),'starter');
    assert.equal(await safe(client,'7',{is_frontier_battle:true,is_ai_battle:true}),null);
    client.query=async sql=>({rows:sql.includes('to_regclass')?[{name:'frontier_battles'}]:[{}]});
    assert.equal(await safe(client,'7',{is_frontier_battle:true,is_ai_battle:true}),'frontier_npc');
    assert.equal(await safe(client,'7',{is_frontier_battle:true,is_ai_battle:false}),null);
  });
  await test('protected frontier NPC cannot enter a generic battle or unregistered special battle',async()=>{
    let registered=false;const client={async query(sql){return {rows:sql.includes('to_regclass')?[{name:'frontier_battles'}]:sql.includes('to_jsonb')?[{}]:registered?[{}]:[]};}};
    await assert.rejects(engine.assertRegisteredFrontierBattle(client,'7',{}),/FRONTIER_NPC_REQUIRES_REGISTERED_BATTLE/);
    await assert.rejects(engine.assertRegisteredFrontierBattle(client,'7',{is_frontier_battle:true}),/FRONTIER_NPC_REQUIRES_REGISTERED_BATTLE/);
    registered=true;await engine.assertRegisteredFrontierBattle(client,'7',{is_frontier_battle:true});
  });
  for(const training of [true,false])await test(training?'actual settlement preserves a destroyed training hull at 15% HP':'ordinary full-loss settlement still permanently destroys the hull',async()=>{
    const calls=[];const summary=training?{is_starter_battle:true,starter_training:true,trusted_source:'starter_ops',is_ai_battle:true}:{};
    transaction={release(){},async query(sql,params){calls.push({sql,params});
      if(sql.includes('SELECT battle_type, status'))return {rows:[{battle_type:'event',status:'active',battle_summary:summary}],rowCount:1};
      return {rows:[],rowCount:1};}};
    const side={ships_total:1,ships_lost:1,damage_dealt:0,kills:0};
    await engine.applyBattleResults('7',{winner_side:'def',duration_seconds:90,events:[],stats:{atk:side,def:side,by_player:{},by_fleet:[],by_ship:[{ship_id:'1',is_alive:false,current_hp:0,shield_hp:0}]}});
    const writes=calls.filter(c=>c.sql.includes('UPDATE ships'));
    assert.equal(writes.some(c=>c.sql.includes('is_alive = false')),!training);
    assert.equal(writes.some(c=>c.sql.includes('* 0.15')),training);
    const saved=JSON.parse(calls.find(c=>c.sql.includes('UPDATE fleet_battles')).params[6]);
    assert.equal(saved.combat_policy.permanent_loss,!training);assert.equal(saved.combat_policy.safe_training_mode,training?'starter':null);
  });
  await test('part changes are captured in actual engine state and final result while quality bonuses stay intact',()=>{
    const {applyShipPartStats}=require('../services/shipParts');
    const effects=[{part_code:'damage_focus',slot:'weapon',level:1,atk_pct:8,def_pct:-5,speed_pct:0}];
    const raw={id:'1',ship_type_code:'qa',role:'dps',size_class:'frigate',base_atk:100,base_def:100,base_speed:1,bonus_atk:10,bonus_def:10,bonus_speed:0,current_hp:1000,max_hp:1000,fire_interval:200,fire_type:'gun',shots:1};
    const fitted=applyShipPartStats(raw,effects);assert.equal(fitted.bonus_atk,10);assert.equal(raw.base_atk,100);
    const state=engine.__test.initBattleState({battle:{id:'7'},fleets:[{fleet_id:'11',owner_wallet:'owner',side:'atk',ships:[fitted]}]});
    const ship=state.fleets[0].ships[0];assert.equal(ship.atk,119);assert.equal(ship.def,105);assert.equal(ship.part_effects[0].part_code,'damage_focus');
    const result=engine.__test.computeBattleStats(state).by_ship[0];assert.equal(result.bonus_atk,10);assert.equal(result.combat_stats.atk,119);assert.equal(result.part_effects[0].level,1);
  });
  console.log(JSON.stringify({checks:checks.length,passed:checks.length,databaseUsed:false}));
}
main().catch(error=>{console.error(error);process.exitCode=1;});
