#!/usr/bin/env node
'use strict';
// Real PostgreSQL transactions in temporary shadow tables; never mutates public game rows.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { Pool } = require('pg');
const url = new URL(process.env.DATABASE_URL || '');
if (!['localhost', '127.0.0.1'].includes(url.hostname) || url.pathname !== '/codex_occupy_review_upgrade_20261010') throw Error('Exact local review clone required');
const schema = 'economy_qa_' + crypto.randomBytes(6).toString('hex');
const admin = new Pool({ connectionString: url.href });
const pool = new Pool({ connectionString: url.href, options: '-c search_path=' + schema + ',public', application_name: schema, max: 10 });
const tables = ['users','fleets','ships','ship_types','assembly_units','assembly_parts','user_assembly_parts','assembly_events','starter_fleet_grant_ships','fleet_battle_participants','fleet_battles','ship_mining_jobs','frontier_cargo','marketplace_listings','resources','user_resource_inventory','item_instances','claims','transactions','game_settings','territory_rentals','rental_log'];
const wallet = '0x' + crypto.randomBytes(20).toString('hex');
let server, locker, pending;
async function insertListing(qty, code='iron_dust', status='active') {
  return (await pool.query("INSERT INTO marketplace_listings(seller,listing_type,price,resource_code,resource_quantity,status,expires_at) VALUES($1,'resource',10,$2,$3,$4,NOW()-INTERVAL '1 hour') RETURNING id",[wallet,code,qty,status])).rows[0].id;
}
async function inventory() { return Number((await pool.query('SELECT quantity FROM user_resource_inventory WHERE wallet_address=$1',[wallet])).rows[0]?.quantity || 0); }
async function awaitUserWaiters(count) {
  for(let i=0;i<100;i++) {
    const n=(await admin.query("SELECT COUNT(*)::int n FROM pg_stat_activity WHERE application_name=$1 AND wait_event_type='Lock' AND query LIKE '%users%FOR UPDATE%'",[schema])).rows[0].n;
    if(n>=count) return;
    await new Promise(r=>setTimeout(r,20));
  }
  throw Error('Concurrent requests did not reach account lock');
}
(async()=>{
  await admin.query('CREATE SCHEMA '+schema);
  for(const table of tables) {
    await admin.query(`CREATE TABLE ${schema}.${table} (LIKE public.${table} INCLUDING ALL)`);
    const cols=(await admin.query("SELECT column_name,column_default FROM information_schema.columns WHERE table_schema=$1 AND table_name=$2 AND column_default LIKE 'nextval(%'",[schema,table])).rows;
    for(const col of cols) {
      const sequence=`${schema}.${table}_${col.column_name}_qa_seq`;
      await admin.query('CREATE SEQUENCE '+sequence);
      await admin.query(`ALTER TABLE ${schema}.${table} ALTER COLUMN ${col.column_name} SET DEFAULT nextval('${sequence}')`);
    }
  }
  // Point only this process's services at the shadow schema, retaining real SQL and locks.
  const settings={casual_mode_enabled:'false',pp_to_gp_exchange_enabled:'true',pp_to_gp_exchange_min:'0.1',pp_to_gp_exchange_max:'5',pp_to_gp_exchange_daily_limit:'5',pp_to_gp_exchange_rate:'10',pp_to_gp_exchange_fee_pct:'5'};
  require.cache[require.resolve('../db')]={id:require.resolve('../db'),filename:require.resolve('../db'),loaded:true,exports:{pool,getSetting:async(k,f)=>settings[k]??f,logGPActivity:async()=>{},notifyPlayer:async()=>{}}};
  const market=require('../services/marketplace'),assembly=require('../services/assembly'),rental=require('../services/rental');
  await pool.query("INSERT INTO users(wallet_address,nickname,faction_code,gp_balance,pp_balance) VALUES($1,'Economy QA','mcc',1000,100)",[wallet]);
  await pool.query("INSERT INTO resources SELECT * FROM public.resources WHERE code='iron_dust'");
  assert.equal((await pool.query('SELECT COUNT(*)::int n FROM resources')).rows[0].n,1);
  await pool.query("INSERT INTO user_resource_inventory(wallet_address,resource_id,quantity) SELECT $1,id,10 FROM resources",[wallet]);
  const original=await insertListing(7);await insertListing(900,'iron_dust','expired');
  const results=await Promise.all([market.expireListings(),market.expireListings()]);
  assert.equal(results.reduce((a,b)=>a+b,0),1);assert.equal(await inventory(),17);assert.equal(await market.expireListings(),0);assert.equal(await inventory(),17);
  const valid=await insertListing(3),missing=await insertListing(2,'qa_missing');
  await assert.rejects(market.expireListings(),/ESCROW_RESOURCE_NOT_FOUND/);assert.equal(await inventory(),17);
  assert.deepEqual((await pool.query('SELECT status FROM marketplace_listings WHERE id=ANY($1::int[])',[ [valid,missing] ])).rows.map(r=>r.status),['active','active']);
  await pool.query('DELETE FROM marketplace_listings WHERE id=$1',[missing]);
  async function cancel(id) { const c=await pool.connect();try{await c.query('BEGIN');const r=await market.cancelListing(c,id,wallet);await c.query('COMMIT');return r;}catch(e){await c.query('ROLLBACK');return {error:e.message};}finally{c.release();} }
  await Promise.all([market.expireListings(),cancel(valid)]);assert.equal(await inventory(),20);
  assert.equal((await pool.query('SELECT status FROM marketplace_listings WHERE id=$1',[original])).rows[0].status,'expired');
  const moderated=await insertListing(4);await pool.query("UPDATE marketplace_listings SET expires_at=NOW()+INTERVAL '1 hour' WHERE id=$1",[moderated]);
  async function moderate(id) {const c=await pool.connect();try{await c.query('BEGIN');const r=await market.adminCancelListing(c,id);await c.query('COMMIT');return r;}catch(e){await c.query('ROLLBACK');return {error:e.message};}finally{c.release();}}
  const moderation=await Promise.all([moderate(moderated),moderate(moderated)]);assert.equal(moderation.filter(r=>r.success).length,1);assert.equal(await inventory(),24);
  console.log('PASS marketplace real concurrent expiry/refund once; historical expiry untouched; rollback on missing resource; cancel/expiry race conserves assets');

  await pool.query("INSERT INTO ship_types SELECT * FROM public.ship_types WHERE code='mcc_frg'");
  await pool.query("INSERT INTO assembly_units(unit_code,ship_type_code,name_en,name_ko,part_count,max_per_player,assemble_gp_cost) VALUES('qa_unit','mcc_frg','QA unit','QA unit',1,1,25)");
  await pool.query("INSERT INTO assembly_parts(part_code,unit_code,slot,name_en,name_ko) VALUES('qa_part','qa_unit',1,'QA part','QA part')");
  await pool.query("INSERT INTO user_assembly_parts(wallet,part_code,qty) VALUES($1,'qa_part',2)",[wallet]);
  locker=await pool.connect();await locker.query('BEGIN');await locker.query('SELECT wallet_address FROM users WHERE wallet_address=$1 FOR UPDATE',[wallet]);
  pending=Promise.all([assembly.assemble(wallet,'qa_unit'),assembly.assemble(wallet,'qa_unit')]);await awaitUserWaiters(2);await locker.query('COMMIT');locker.release();locker=null;
  const made=await pending;pending=null;assert.equal(made.filter(r=>r.success).length,1);assert.equal(made.find(r=>!r.success).error,'MAX_ASSEMBLED_REACHED');
  assert.equal(Number((await pool.query('SELECT gp_balance FROM users WHERE wallet_address=$1',[wallet])).rows[0].gp_balance),975);
  assert.equal((await pool.query('SELECT qty FROM user_assembly_parts WHERE wallet=$1',[wallet])).rows[0].qty,1);
  const hull=made.find(r=>r.success).ship_id, fleet=(await pool.query('SELECT fleet_id FROM ships WHERE id=$1',[hull])).rows[0].fleet_id;
  await pool.query("UPDATE ships SET is_alive=false,current_hp=0,destroyed_at=NOW(),destroyed_reason='battle' WHERE id=$1",[hull]);
  assert.equal((await assembly.disassemble(hull,wallet)).error,'SHIP_DESTROYED');
  assert.equal((await pool.query('SELECT qty FROM user_assembly_parts WHERE wallet=$1',[wallet])).rows[0].qty,1);
  await pool.query('UPDATE ships SET is_alive=true,current_hp=max_hp,destroyed_at=NULL,destroyed_reason=NULL WHERE id=$1',[hull]);
  const mining=(await pool.query("INSERT INTO ship_mining_jobs(wallet_address,fleet_id,ends_at) VALUES($1,$2,NOW()+INTERVAL '1 hour') RETURNING id",[wallet,fleet])).rows[0].id;
  assert.equal((await assembly.disassemble(hull,wallet)).error,'FLEET_MINING');await pool.query("UPDATE ship_mining_jobs SET status='cancelled' WHERE id=$1",[mining]);
  const cargo=(await pool.query("INSERT INTO frontier_cargo(wallet,owner_key,fleet_id,front_key,resource_code,amount,arrives_at) VALUES($1::text,$1::text,$2,'public','iron_dust',1,NOW()+INTERVAL '1 hour') RETURNING id",[wallet,fleet])).rows[0].id;
  assert.equal((await assembly.disassemble(hull,wallet)).error,'FLEET_TRANSPORTING');await pool.query("UPDATE frontier_cargo SET status='cancelled' WHERE id=$1",[cargo]);
  await pool.query('UPDATE fleets SET is_in_battle=true WHERE id=$1',[fleet]);assert.equal((await assembly.disassemble(hull,wallet)).error,'FLEET_IN_BATTLE');await pool.query('UPDATE fleets SET is_in_battle=false WHERE id=$1',[fleet]);
  const battle=(await pool.query("INSERT INTO fleet_battles(battle_type,status) VALUES('pvp_duel','preparing') RETURNING id")).rows[0].id;
  await pool.query("INSERT INTO fleet_battle_participants(battle_id,fleet_id,wallet_address,side) VALUES($1,$2,$3,'atk')",[battle,fleet,wallet]);
  assert.equal((await assembly.disassemble(hull,wallet)).error,'FLEET_IN_BATTLE');await pool.query("UPDATE fleet_battles SET status='ended' WHERE id=$1",[battle]);
  // A retained historical reference must not prevent voluntary dismantling.
  await pool.query('CREATE TABLE qa_hull_history(ship_id bigint REFERENCES ships(id))');await pool.query('INSERT INTO qa_hull_history VALUES($1)',[hull]);
  const dismantled=await Promise.all([assembly.disassemble(hull,wallet),assembly.disassemble(hull,wallet)]);assert.equal(dismantled.filter(r=>r.success).length,1);assert.equal(dismantled.find(r=>!r.success).error,'SHIP_DESTROYED');
  assert.equal((await pool.query('SELECT qty FROM user_assembly_parts WHERE wallet=$1',[wallet])).rows[0].qty,2);
  const retired=(await pool.query('SELECT is_alive,destroyed_reason FROM ships WHERE id=$1',[hull])).rows[0];assert.equal(retired.is_alive,false);assert.equal(retired.destroyed_reason,'scrapped');
  assert.equal((await pool.query('SELECT COUNT(*)::int n FROM qa_hull_history')).rows[0].n,1);
  // Assembly into a reserved fleet must create/use a safe fleet instead.
  await pool.query('UPDATE fleets SET is_in_battle=true WHERE id=$1',[fleet]);const safe=await assembly.assemble(wallet,'qa_unit');assert.equal(safe.success,true);assert.notEqual(String((await pool.query('SELECT fleet_id FROM ships WHERE id=$1',[safe.ship_id])).rows[0].fleet_id),String(fleet));
  console.log('PASS assembly forced concurrent cap/spend; destroyed hull no parts; mining/preparing/battle guards; concurrent dismantle once; history retained; reserved fleet avoided');

  process.env.JWT_SECRET='isolated-economy-qa';
  const app=require('express')();app.use(require('express').json());app.use('/api',require('../routes/exchangeRoutes'));app.use('/api',require('../routes/rental'));
  server=await new Promise(r=>{const s=app.listen(0,'127.0.0.1',()=>r(s));});
  const token=require('jsonwebtoken').sign({wallet_address:wallet},process.env.JWT_SECRET),base='http://127.0.0.1:'+server.address().port+'/api';
  async function post(path,body) {const response=await fetch(base+path,{method:'POST',headers:{authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(body)});return {status:response.status,data:await response.json()};}
  locker=await pool.connect();await locker.query('BEGIN');await locker.query('SELECT wallet_address FROM users WHERE wallet_address=$1 FOR UPDATE',[wallet]);
  pending=Promise.all([post('/exchange/pp-to-gp',{amount:3}),post('/exchange/pp-to-gp',{amount:3})]);await awaitUserWaiters(2);await locker.query('COMMIT');locker.release();locker=null;
  const exchanges=await pending;pending=null;assert.equal(exchanges.filter(r=>r.status===200).length,1);assert.equal(exchanges.filter(r=>r.status===400).length,1);
  assert.equal(Number((await pool.query('SELECT pp_balance FROM users WHERE wallet_address=$1',[wallet])).rows[0].pp_balance),97);
  assert.equal(Number((await pool.query("SELECT SUM(pp_amount) n FROM transactions WHERE type='pp_to_gp_exchange'")).rows[0].n),3);
  console.log('PASS HTTP JWT exchange: two requests held at user lock; one within rolling quota; one rejected without debit');
  const rentalSettings=await (await fetch(base+'/rental/settings')).json();assert.equal(rentalSettings.enabled,false);assert.equal(rentalSettings.unavailableReason,'RENTAL_PRODUCTION_UNAVAILABLE');
  for(const [path,body] of [['/rental/list',{claimId:1,gpPerPeriod:5,periodHours:6}],['/rental/rent',{rentalId:1,periods:1}]]) {const result=await post(path,body);assert.equal(result.status,409);assert.equal(result.data.error,'RENTAL_PRODUCTION_UNAVAILABLE');}
  const listed=(await pool.query("INSERT INTO territory_rentals(claim_id,owner,gp_per_period,period_hours,fee_pct,status) VALUES(1,$1,5,6,10,'listed') RETURNING id",[wallet])).rows[0].id;
  const cancelled=await post('/rental/cancel',{rentalId:listed});assert.equal(cancelled.status,200);assert.equal((await pool.query('SELECT status FROM territory_rentals WHERE id=$1',[listed])).rows[0].status,'cancelled');
  assert.equal((await fetch(base+'/rental/my',{headers:{authorization:'Bearer '+token}})).status,200);
  assert.equal((await pool.query('SELECT COUNT(*)::int n FROM rental_log')).rows[0].n,0);
  assert.equal((await rental.getSettings()).enabled,false);
  const fs=require('node:fs'),vm=require('node:vm');
  const ui=fs.readFileSync(require('node:path').resolve(__dirname,'../../assets/daily-engagement.js'),'utf8');
  const context={tl:(en)=>en};vm.createContext(context);vm.runInContext(ui.slice(ui.indexOf('function renderRentalPanel('),ui.indexOf('function switchRentalTab(')),context);
  const content={innerHTML:''},listing={id:listed,claim_id:1,pixel_count:4,owner:'0xother',owner_nick:'Other',status:'listed',gp_per_period:5,period_hours:6,boost_pct:10};
  context.renderRentalPanel(content,[listing],[{...listing,owner:wallet}],rentalSettings,wallet);
  assert.ok(!content.innerHTML.includes('openRentModal('));assert.ok(!content.innerHTML.includes('openListForRentModal('));assert.ok(!content.innerHTML.includes('mining boost'));assert.ok(content.innerHTML.includes('cancelRentalListing('));assert.ok(content.innerHTML.includes('New rentals are unavailable'));
  console.log('PASS HTTP rental unsupported new sales blocked; existing cancellation/history readable; no payment log');
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{
  if(locker){await locker.query('ROLLBACK');locker.release();}
  if(pending)await pending.catch(()=>{});
  if(server)await new Promise(r=>server.close(r));
  await pool.end();
  await admin.query('DROP SCHEMA IF EXISTS '+schema+' CASCADE');await admin.end();
});
