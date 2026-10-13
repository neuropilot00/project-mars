#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),crypto=require('node:crypto'),fs=require('node:fs'),path=require('node:path');
const fixture=require('./frontier_regression_fixture'),{pool}=fixture;
const svc=require('../services/frontierIndustry');
async function user(){
 const wallet='0x'+crypto.randomBytes(20).toString('hex');
 await pool.query("INSERT INTO users(wallet_address,nickname,faction_code,gp_balance,is_test_account) VALUES($1,'Storage QA','mcc',1000,true)",[wallet]);
 const fleetId=(await pool.query("INSERT INTO fleets(owner_wallet,name) VALUES($1,'Cargo QA') RETURNING id",[wallet])).rows[0].id;
 await pool.query("INSERT INTO ships(fleet_id,owner_wallet,ship_type_code,current_hp,max_hp) SELECT $1,$2,code,base_hp,base_hp FROM ship_types WHERE code='mcc_frg'",[fleetId,wallet]);
 return {wallet,fleetId,key:'wallet:'+wallet};
}
async function main(){
 await fixture.setup();const a=await user(),b=await user();
 const before=await svc.getState(a.wallet),mine=before.nodes.find(n=>n.node_type==='resource'),logistics=before.nodes.find(n=>n.node_type==='logistics');
 await pool.query("UPDATE frontier_nodes SET owner_key=$2,controller_wallet=$3,stored_batches=4,production_at=NOW()-INTERVAL '1 day' WHERE id=$1",[mine.id,a.key,a.wallet]);
 await pool.query("INSERT INTO frontier_stocks(owner_key,depot,resource_code,quantity) VALUES($1,'mine','iron_dust',500)",[a.key]);
 const guild=(await pool.query('INSERT INTO guilds(name,tag,leader_wallet) VALUES($1,$2,$3) RETURNING id',['Cargo '+crypto.randomBytes(4).toString('hex'),crypto.randomBytes(2).toString('hex'),a.wallet])).rows[0].id;
 for(const u of [a,b])await pool.query("INSERT INTO guild_members(guild_id,wallet,role) VALUES($1,$2,$3)",[guild,u.wallet,u===a?'leader':'member']);
 const guildKey='guild:'+guild,shared=await svc.getState(a.wallet),sharedMine=shared.nodes.find(n=>n.node_type==='resource'),sharedLogistics=shared.nodes.find(n=>n.node_type==='logistics');
 await pool.query("UPDATE frontier_nodes SET owner_key=$2,stored_batches=4,production_at=NOW()-INTERVAL '1 day' WHERE id=$1",[sharedMine.id,guildKey]);
 const c=await pool.connect();try{await c.query('BEGIN');
  await c.query('ALTER TABLE frontier_nodes DROP CONSTRAINT frontier_nodes_stored_batches_check; ALTER TABLE frontier_nodes ADD CONSTRAINT frontier_nodes_stored_batches_check CHECK(stored_batches BETWEEN 0 AND 4); ALTER TABLE frontier_production_events DROP CONSTRAINT frontier_production_events_batches_check; ALTER TABLE frontier_production_events ADD CONSTRAINT frontier_production_events_batches_check CHECK(batches BETWEEN 1 AND 4); ALTER TABLE frontier_cargo DROP CONSTRAINT frontier_cargo_amount_check; ALTER TABLE frontier_cargo ADD CONSTRAINT frontier_cargo_amount_check CHECK(amount BETWEEN 1 AND 100)');
  await c.query(fs.readFileSync(path.join(__dirname,'../migrations/351_frontier_storage_logistics.sql'),'utf8'));await c.query('COMMIT');}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
 assert.equal((await pool.query('SELECT COUNT(*)::int n FROM frontier_production_events')).rows[0].n,0);
 assert.equal((await pool.query("SELECT quantity FROM frontier_stocks WHERE owner_key=$1 AND depot='mine' AND resource_code='iron_dust'",[a.key])).rows[0].quantity,500);
 for(const [wallet,options,id] of [[a.wallet,{personal:true},mine.id],[a.wallet,{},sharedMine.id]]){
  const s=await svc.getState(wallet,options);assert.equal(s.nodes.find(n=>String(n.id)===String(id)).stored_batches,4);assert.equal(s.balance.batchCap,16);assert.equal(s.balance.batchMinutes,30);
  assert.equal((await svc.collectProduction(wallet,id,options)).batches,4);await assert.rejects(svc.collectProduction(wallet,id,options),/PRODUCTION_NOT_READY/);
 }
 assert.equal((await pool.query('SELECT SUM(hold_points)::int n FROM frontier_season_score WHERE owner_key=$1',[guildKey])).rows[0].n,48);
 assert.equal((await pool.query("SELECT quantity FROM frontier_stocks WHERE owner_key=$1 AND depot='mine' AND resource_code='iron_dust'",[a.key])).rows[0].quantity,580);
 console.log('PASS migration stored4/day-old stays4; overflow watermark advanced, no12 retro batches, old guild48 intervals credited once');
 await pool.query("UPDATE frontier_nodes SET production_at=NOW()-INTERVAL '1 day',stored_batches=0 WHERE id=$1",[mine.id]);
 assert.equal((await svc.getState(a.wallet,{personal:true})).nodes.find(n=>String(n.id)===String(mine.id)).stored_batches,16);
 const mark=(await pool.query('SELECT production_at FROM frontier_nodes WHERE id=$1',[mine.id])).rows[0].production_at;
 const collected=await svc.collectProduction(a.wallet,mine.id,{personal:true});assert.equal(collected.batches,16);assert.equal(collected.iron_dust,320);assert.equal(collected.hull_plate,64);
 await assert.rejects(svc.collectProduction(a.wallet,mine.id,{personal:true}),/PRODUCTION_NOT_READY/);
 assert.equal((await pool.query('SELECT production_at FROM frontier_nodes WHERE id=$1',[mine.id])).rows[0].production_at.getTime(),mark.getTime());
 await pool.query("UPDATE frontier_nodes SET production_at=NOW()-INTERVAL '29 minutes' WHERE id=$1",[mine.id]);await assert.rejects(svc.collectProduction(a.wallet,mine.id,{personal:true}),/PRODUCTION_NOT_READY/);
 await pool.query("UPDATE frontier_nodes SET production_at=NOW()-INTERVAL '30 minutes' WHERE id=$1",[mine.id]);assert.equal((await svc.collectProduction(a.wallet,mine.id,{personal:true})).batches,1);
 await assert.rejects(pool.query('UPDATE frontier_nodes SET stored_batches=17 WHERE id=$1',[mine.id]),/check constraint/);
 console.log('PASS buffer16 yields320 iron/64 plates; capped elapsed advances, no catch-up, unchanged30-minute production');
 await pool.query("UPDATE frontier_stocks SET quantity=500 WHERE owner_key=$1 AND depot='mine' AND resource_code='iron_dust'",[guildKey]);
 async function cargo(u,amount,options,minutes){const r=await svc.startCargo(u.wallet,u.fleetId,amount,'iron_dust',options);assert.equal(r.cargo.amount,amount);assert.equal(new Date(r.cargo.arrives_at)-new Date(r.cargo.started_at),minutes*60000);await svc.cancelCargo(u.wallet,r.cargo.id,options);}
 const personal={personal:true};assert.equal((await svc.getState(a.wallet,personal)).cargoCapacity,100);
 await cargo(a,100,personal,10);await assert.rejects(svc.startCargo(a.wallet,a.fleetId,101,'iron_dust',personal),/CARGO_CAPACITY_EXCEEDED/);
 await pool.query('UPDATE frontier_nodes SET owner_key=$2 WHERE id=$1',[sharedLogistics.id,guildKey]);
 assert.equal((await svc.getState(a.wallet)).cargoCapacity,200);assert.equal((await svc.getState(b.wallet)).cargoCapacity,200);assert.equal((await svc.getState(a.wallet,personal)).cargoCapacity,100);
 await cargo(b,200,{},9);await assert.rejects(svc.startCargo(b.wallet,b.fleetId,201),/INVALID_INTEGER/);
 await assert.rejects(svc.startCargo(b.wallet,a.fleetId,100),/FLEET_NOT_FOUND/);
 await assert.rejects(svc.startCargo(a.wallet,a.fleetId,200,'iron_dust',{personal:true,ownerKey:guildKey,logistics:true}),/CARGO_CAPACITY_EXCEEDED/);
 await pool.query('UPDATE frontier_nodes SET owner_key=$2 WHERE id=$1',[logistics.id,a.key]);assert.equal((await svc.getState(a.wallet,personal)).cargoCapacity,200);await cargo(a,200,personal,9);
 await pool.query('UPDATE frontier_nodes SET owner_key=$2 WHERE id=$1',[sharedLogistics.id,'guild:999999']);assert.equal((await svc.getState(a.wallet)).cargoCapacity,100);
 await cargo(b,100,{},10);await assert.rejects(svc.startCargo(b.wallet,b.fleetId,101),/CARGO_CAPACITY_EXCEEDED/);
 console.log('PASS exact100/101 and200/201 boundaries; real board/controller, own fleet, guild-member cargo and independent personal scopes');
 const express=require('express'),jwt=require('jsonwebtoken');process.env.JWT_SECRET='disposable-cargo-capacity-test';const app=express();app.use(express.json());app.use('/api/frontier',require('../routes/frontierIndustry'));const server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});
 try{const base='http://127.0.0.1:'+server.address().port+'/api/frontier',headers={Authorization:'Bearer '+jwt.sign({wallet:a.wallet},process.env.JWT_SECRET),'Content-Type':'application/json'};
  const state=await fetch(base+'/state?scope=personal',{headers});const payload=await state.json();assert.equal(payload.cargoCapacity,200);assert.equal(payload.balance.batchCap*payload.balance.batchMinutes,480);
  const forged=await fetch(base+'/cargo',{method:'POST',headers,body:JSON.stringify({fleetId:a.fleetId,amount:200,ownerKey:a.key,logistics:true,cargoCapacity:200})});assert.equal(forged.status,409);assert.equal((await forged.json()).error,'CARGO_CAPACITY_EXCEEDED');
  const valid=await fetch(base+'/cargo',{method:'POST',headers,body:JSON.stringify({fleetId:a.fleetId,amount:200,scope:'personal'})});assert.equal(valid.status,200);const sent=(await valid.json()).cargo;assert.equal(sent.owner_key,a.key);await svc.cancelCargo(a.wallet,sent.id,personal);
  console.log('PASS authenticated HTTP exposes8h/200capacity; forged ownership/cap ignored; explicit personal200 cargo accepted');
 }finally{await new Promise(resolve=>server.close(resolve));}
}
main().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>fixture.close());
