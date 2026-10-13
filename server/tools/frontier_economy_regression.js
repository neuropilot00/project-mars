#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const crypto = require('crypto');
const testFixture = require('./frontier_regression_fixture');
const { pool } = require('../db');
const frontier = require('../services/frontierIndustry');
const engine = require('../services/battleEngine');
async function fixture() {
 const wallet = '0x' + crypto.randomBytes(20).toString('hex');
 await pool.query("INSERT INTO users(wallet_address,nickname,faction_code,gp_balance,is_test_account) VALUES($1,'Frontier economy regression','mcc',100000,true)", [wallet]);
 const guild = (await pool.query('INSERT INTO guilds(name,tag,leader_wallet) VALUES($1,$2,$3) RETURNING id', ['Economy '+crypto.randomBytes(8).toString('hex'),crypto.randomBytes(2).toString('hex'),wallet])).rows[0].id;
 await pool.query("INSERT INTO guild_members(guild_id,wallet,role) VALUES($1,$2,'leader')", [guild,wallet]);
 const fleetId = (await pool.query("INSERT INTO fleets(owner_wallet,name) VALUES($1,'Economy escort') RETURNING id", [wallet])).rows[0].id;
 const hull = (await pool.query("SELECT code,base_hp FROM ship_types WHERE faction_code='mcc' AND size_class='cruiser' AND is_active ORDER BY code LIMIT 1")).rows[0];
 for(let i=0;i<3;i++) await pool.query('INSERT INTO ships(fleet_id,owner_wallet,ship_type_code,current_hp,max_hp,is_flagship) VALUES($1,$2,$3,$4,$4,$5)', [fleetId,wallet,hull.code,hull.base_hp,i===0]);
 const state = await frontier.getState(wallet);
 return {wallet,guild,ownerKey:'guild:'+guild,fleetId,nodeId:state.nodes.find(n=>n.node_type==='resource').id};
}
async function points(ownerKey) {
 return Number((await pool.query('SELECT COALESCE(SUM(hold_points),0) n FROM frontier_season_score WHERE owner_key=$1', [ownerKey])).rows[0].n);
}
async function main() {
 await testFixture.setup();
 const once=await fixture(),daily=await fixture(),boundary=await fixture();
 // Prepare ownership/watermarks directly: these cases test accrual, not fake capture evidence.
 await pool.query("UPDATE frontier_nodes SET owner_key=$2,controller_wallet=$3,production_at=NOW()-INTERVAL '7 days',stored_batches=0 WHERE id=$1", [once.nodeId,once.ownerKey,once.wallet]);
 await frontier.getState(once.wallet);
 assert.equal(await points(once.ownerKey),336);
 for(let i=0;i<7;i++) {
  await pool.query("UPDATE frontier_nodes SET owner_key=$2,controller_wallet=$3,production_at=NOW()-INTERVAL '1 day',stored_batches=0 WHERE id=$1", [daily.nodeId,daily.ownerKey,daily.wallet]);
  await frontier.getState(daily.wallet);
 }
 assert.equal(await points(daily.ownerKey),336);
 assert.equal((await pool.query('SELECT stored_batches FROM frontier_nodes WHERE id=$1',[daily.nodeId])).rows[0].stored_batches,16);
 console.log('PASS seven-day accrual336 equals seven daily reads336; stock remains capped16');

 const clock=(await pool.query("SELECT current_setting('TimeZone') tz,date_trunc('month',NOW()) boundary")).rows[0];
 assert.equal(clock.tz,'Asia/Seoul');
 await pool.query("UPDATE frontier_nodes SET owner_key=$2,controller_wallet=$3,production_at=$4::timestamptz-INTERVAL '45 minutes',stored_batches=0 WHERE id=$1", [boundary.nodeId,boundary.ownerKey,boundary.wallet,clock.boundary]);
 await frontier.getState(boundary.wallet);
 const credited=(await pool.query('SELECT season,hold_points FROM frontier_season_score WHERE owner_key=$1 ORDER BY season',[boundary.ownerKey])).rows;
 const expected=(await pool.query("SELECT TO_CHAR(due,'YYYY-MM') season,COUNT(*)::int points FROM frontier_nodes n CROSS JOIN LATERAL generate_series($2::timestamptz-INTERVAL '15 minutes',n.production_at,INTERVAL '30 minutes') due WHERE n.id=$1 GROUP BY season ORDER BY season",[boundary.nodeId,clock.boundary])).rows;
 assert.deepEqual(credited.map(r=>[r.season,r.hold_points]),expected.map(r=>[r.season,r.points]));
 assert.equal(credited[0].hold_points,1);
 const priorTotal=await points(boundary.ownerKey);
 await frontier.getState(boundary.wallet);
 assert.equal(await points(boundary.ownerKey),priorTotal);
 console.log('PASS KST month boundary credits completed intervals to their actual month once');

 const member=await fixture();
 await pool.query('DELETE FROM guild_members WHERE wallet=$1',[member.wallet]);
 await pool.query("INSERT INTO guild_members(guild_id,wallet,role) VALUES($1,$2,'member')",[boundary.guild,member.wallet]);
 await pool.query("INSERT INTO frontier_stocks(owner_key,depot,resource_code,quantity) VALUES($1,'mine','iron_dust',100),($1,'repair','iron_dust',100)",[boundary.ownerKey]);
 await assert.rejects(frontier.withdrawStock(member.wallet,'mine','iron_dust',1),/GUILD_WITHDRAW_ROLE_REQUIRED/);
 assert.equal((await frontier.getState(member.wallet)).canWithdrawStock,false);
 const ship=(await pool.query('SELECT id FROM ships WHERE fleet_id=$1 ORDER BY id LIMIT 1',[member.fleetId])).rows[0];
 await pool.query('UPDATE ships SET current_hp=max_hp-1 WHERE id=$1',[ship.id]);
 const quote=await frontier.repairQuote(member.wallet,ship.id,100);
 await frontier.repair(member.wallet,ship.id,100,{expectedQuote:quote});
 const memberCargo=await frontier.startCargo(member.wallet,member.fleetId,1);
 await frontier.cancelCargo(member.wallet,memberCargo.cargo.id);
 await pool.query("UPDATE guild_members SET role='officer' WHERE wallet=$1",[member.wallet]);
 await assert.rejects(frontier.withdrawStock(member.wallet,'mine','iron_dust',1),/CARGO_DELIVERY_REQUIRED/);
 await frontier.withdrawStock(member.wallet,'repair','iron_dust',1);
 assert.equal((await frontier.getState(member.wallet)).canWithdrawStock,true);
 console.log('PASS member personal withdrawal blocked; shared repair/cargo allowed; officer withdrawal allowed');
 // Existing personal holdings remain accessible after joining a guild; caller-supplied owner keys do not select a depot.
 await pool.query("UPDATE guild_members SET role='member' WHERE wallet=$1",[member.wallet]);
 const personalKey='wallet:'+member.wallet,foreignKey='wallet:'+once.wallet;
 await pool.query("INSERT INTO frontier_stocks(owner_key,depot,resource_code,quantity) VALUES($1,'repair','iron_dust',7),($1,'mine','iron_dust',10),($2,'repair','iron_dust',99)",[personalKey,foreignKey]);
 const privateState=await frontier.getState(member.wallet,{personal:true});assert.deepEqual(privateState.availableScopes,['guild','personal']);assert.equal(privateState.training,false);assert.equal(privateState.scope,'personal');assert.equal(privateState.ownerKey,personalKey);assert.equal(privateState.canWithdrawStock,true);assert.equal((await frontier.getState(member.wallet)).ownerKey,boundary.ownerKey);
 await frontier.withdrawStock(member.wallet,'repair','iron_dust',2,{personal:true,ownerKey:foreignKey,guildId:once.guild});
 assert.equal((await pool.query("SELECT quantity FROM frontier_stocks WHERE owner_key=$1 AND depot='repair' AND resource_code='iron_dust'",[foreignKey])).rows[0].quantity,99);
 await assert.rejects(frontier.withdrawStock(member.wallet,'repair','iron_dust',6,{personal:true}),/INSUFFICIENT_STOCK/);
 await assert.rejects(frontier.withdrawStock(member.wallet,'repair','iron_dust',1),/GUILD_WITHDRAW_ROLE_REQUIRED/);
 await assert.rejects(frontier.withdrawStock(member.wallet,'mine','iron_dust',1,{personal:true}),/CARGO_DELIVERY_REQUIRED/);
 const privateCargo=await frontier.startCargo(member.wallet,member.fleetId,5,'iron_dust',{personal:true});assert.equal(privateCargo.cargo.owner_key,personalKey);assert.equal(new Date(privateCargo.cargo.arrives_at)-new Date(privateCargo.cargo.started_at),600000);
 await pool.query("UPDATE frontier_cargo SET arrives_at=NOW()-INTERVAL '1 second' WHERE id=$1",[privateCargo.cargo.id]);await frontier.getState(member.wallet,{personal:true});
 await frontier.withdrawStock(member.wallet,'repair','iron_dust',10,{personal:true});
 assert.equal((await pool.query("SELECT quantity FROM frontier_stocks WHERE owner_key=$1 AND depot='repair' AND resource_code='iron_dust'",[personalKey])).rows[0].quantity,0);
 console.log('PASS guild member personal holdings: own view/cargo/delivered withdrawal; no foreign or guild withdrawal');
 const privateNode=privateState.nodes.find(n=>n.node_type==='resource');const privateBattle=await frontier.attackNode(member.wallet,privateNode.id,member.fleetId,{personal:true,dispatch:false});const privateResult=await engine.simulateBattle(privateBattle.battleId);assert.equal(privateResult.winner_side,'atk');await engine.applyBattleResults(privateBattle.battleId,privateResult);assert.equal((await frontier.captureNode(member.wallet,privateNode.id,privateBattle.battleId,{personal:true})).result,'captured');
 assert.equal((await pool.query('SELECT owner_key FROM frontier_nodes WHERE id=$1',[privateNode.id])).rows[0].owner_key,personalKey);await frontier.collectProduction(member.wallet,privateNode.id,{personal:true});
 assert.equal((await pool.query('SELECT COUNT(*)::int n FROM frontier_season_score WHERE owner_key=$1',[personalKey])).rows[0].n,0);
 console.log('PASS personal capture/production after guild join settles to own depot without guild season credit');

 const express=require('express'),jwt=require('jsonwebtoken');process.env.JWT_SECRET='disposable-personal-stock-test';const app=express();app.use(express.json());app.use('/api/frontier',require('../routes/frontierIndustry'));const server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});
 try{const base='http://127.0.0.1:'+server.address().port+'/api/frontier',headers={Authorization:'Bearer '+jwt.sign({wallet:member.wallet},process.env.JWT_SECRET),'Content-Type':'application/json'};
 const own=await fetch(base+'/state?scope=personal&wallet='+once.wallet+'&ownerKey='+foreignKey,{headers});assert.equal(own.status,200);assert.equal((await own.json()).ownerKey,personalKey);
 for(const [body,error] of [[{depot:'mine',resourceCode:'iron_dust',amount:1,scope:'personal'},'CARGO_DELIVERY_REQUIRED'],[{depot:'repair',resourceCode:'iron_dust',amount:1,ownerKey:foreignKey,wallet:once.wallet},'GUILD_WITHDRAW_ROLE_REQUIRED']]){const res=await fetch(base+'/stock/withdraw',{method:'POST',headers,body:JSON.stringify(body)});assert.equal(res.status,409);assert.equal((await res.json()).error,error);}
 const inventoryBefore=Number((await pool.query("SELECT quantity FROM user_resource_inventory i JOIN resources r ON r.id=i.resource_id WHERE wallet_address=$1 AND r.code='iron_dust'",[member.wallet])).rows[0].quantity);
 const privatePlate=await frontier.startCargo(member.wallet,member.fleetId,1,'iron_dust',{personal:true});await pool.query("UPDATE frontier_cargo SET arrives_at=NOW()-INTERVAL '1 second' WHERE id=$1",[privatePlate.cargo.id]);await frontier.getState(member.wallet,{personal:true});
 const res=await fetch(base+'/stock/withdraw',{method:'POST',headers,body:JSON.stringify({depot:'repair',resourceCode:'iron_dust',amount:1,scope:'personal',wallet:once.wallet,ownerKey:foreignKey})});assert.equal(res.status,200);assert.equal(Number((await pool.query("SELECT quantity FROM user_resource_inventory i JOIN resources r ON r.id=i.resource_id WHERE wallet_address=$1 AND r.code='iron_dust'",[member.wallet])).rows[0].quantity),inventoryBefore+1);
 console.log('PASS HTTP authenticated personal scope, delivered withdrawal, forged ownership ignored, 409 mine/guild rejection');
 }finally{await new Promise(resolve=>server.close(resolve));}



 await pool.query('UPDATE ships SET bonus_atk=5000 WHERE fleet_id=$1',[boundary.fleetId]);
 const assigned=await frontier.saveDefense(boundary.wallet,boundary.nodeId,boundary.fleetId,{riskConsent:true,missionId:5});
 const assignedAgain=await frontier.saveDefense(boundary.wallet,boundary.nodeId,boundary.fleetId,{riskConsent:true,missionId:5});
 assert.ok(assigned.event.id&&assignedAgain.event.id);
 assert.equal(Number((await pool.query('SELECT COALESCE(SUM(defended),0) n FROM frontier_objective_progress WHERE owner_key=$1',[boundary.ownerKey])).rows[0].n),0);
 const cargo=await frontier.startCargo(boundary.wallet,boundary.fleetId,10);
 await pool.query("UPDATE frontier_cargo SET started_at=NOW()-INTERVAL '3 minutes',arrives_at=NOW()+INTERVAL '7 minutes' WHERE id=$1",[cargo.cargo.id]);
 const mining=(await pool.query("INSERT INTO ship_mining_jobs(wallet_address,fleet_id,ends_at,status) VALUES($1,$2,NOW()+INTERVAL '1 hour','mining') RETURNING id",[boundary.wallet,boundary.fleetId])).rows[0];
 await assert.rejects(frontier.attackCargo(once.wallet,cargo.cargo.id,once.fleetId,{riskConsent:true,dispatch:false}),/FLEET_MINING/);
 await pool.query("UPDATE ship_mining_jobs SET status='cancelled' WHERE id=$1",[mining.id]);
 const raid=await frontier.attackCargo(once.wallet,cargo.cargo.id,once.fleetId,{riskConsent:true,dispatch:false});
 const escort=(await pool.query("SELECT fleet_id,wallet_address FROM fleet_battle_participants WHERE battle_id=$1 AND side='def'",[raid.battleId])).rows[0];
 assert.equal(String(escort.fleet_id),String(boundary.fleetId));
 assert.equal(escort.wallet_address,boundary.wallet);
 await assert.rejects(frontier.startCargo(boundary.wallet,boundary.fleetId,1),/FLEET_IN_BATTLE/);
 const result=await engine.simulateBattle(raid.battleId);
 assert.equal(result.winner_side,'def');
 await engine.applyBattleResults(raid.battleId,result);
 const first=await frontier.settleBattle(raid.battleId);
 assert.equal(first.result,'defended');
 const count=async()=>Number((await pool.query('SELECT COALESCE(SUM(defended),0) n FROM frontier_objective_progress WHERE owner_key=$1',[boundary.ownerKey])).rows[0].n);
 assert.equal(await count(),1);
 await Promise.all([frontier.settleBattle(raid.battleId),frontier.settleBattle(raid.battleId)]);
 assert.equal(await count(),1);
 assert.equal((await pool.query('SELECT status FROM frontier_cargo WHERE id=$1',[cargo.cargo.id])).rows[0].status,'moving');
 await pool.query("UPDATE frontier_cargo SET arrives_at=NOW()-INTERVAL '1 second' WHERE id=$1",[cargo.cargo.id]);
 await frontier.getState(boundary.wallet);
 assert.equal((await pool.query('SELECT status FROM frontier_cargo WHERE id=$1',[cargo.cargo.id])).rows[0].status,'arrived');
 console.log('PASS actual escort battle '+raid.battleId+': unrelated mining blocked, assignment no credit, real defense win counted exactly once and delivery conserved');
}
main().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>testFixture.close());
