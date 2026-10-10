#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const crypto = require('crypto');
if (!process.env.DATABASE_URL || new URL(process.env.DATABASE_URL).pathname !== '/codex_occupy_review_upgrade_20261010') throw Error('Exact disposable upgrade DB required');
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
 assert.equal((await pool.query('SELECT stored_batches FROM frontier_nodes WHERE id=$1',[daily.nodeId])).rows[0].stored_batches,4);
 console.log('PASS seven-day accrual336 equals seven daily reads336; stock remains capped4');

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
 await frontier.withdrawStock(member.wallet,'mine','iron_dust',1);
 assert.equal((await frontier.getState(member.wallet)).canWithdrawStock,true);
 console.log('PASS member personal withdrawal blocked; shared repair/cargo allowed; officer withdrawal allowed');

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
main().then(()=>pool.end()).then(()=>process.exit(0)).catch(async e=>{console.error(e);await pool.end();process.exit(1);});
