#!/usr/bin/env node
'use strict';
// Execute changed payout/getter SQL against real cloned tables and FK constraints.
// Every write is isolated in a disposable schema on the exact local review DB.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const pg = require('pg');
const url = new URL(process.env.DATABASE_URL || '');
if (!['localhost','127.0.0.1'].includes(url.hostname) || url.pathname !== '/codex_occupy_review_upgrade_20261010') throw Error('Exact local review clone required');
const schema = 'map_qa_' + crypto.randomBytes(6).toString('hex');
const admin = new pg.Pool({connectionString:url.href});
const pool = new pg.Pool({connectionString:url.href,options:'-c search_path='+schema+',public',application_name:schema,max:10});
const tables = ['factions','jobs','users','fleets','sectors','resources','settings','user_resource_inventory','user_titles','world_events','world_event_participants','mars_weather','starlink_passes','rocket_events'];
const top = '0x' + crypto.randomBytes(20).toString('hex'), other = '0x' + crypto.randomBytes(20).toString('hex');
let originalDb, locker, pending;
async function balance(wallet) {return Number((await pool.query('SELECT gp_balance FROM users WHERE wallet_address=$1',[wallet])).rows[0].gp_balance);}
async function quantities(wallet) {return Object.fromEntries((await pool.query('SELECT r.code,i.quantity FROM user_resource_inventory i JOIN resources r ON r.id=i.resource_id WHERE i.wallet_address=$1 ORDER BY r.code',[wallet])).rows.map(r=>[r.code,Number(r.quantity)]));}
async function waitForLocks(count) {
  for(let i=0;i<100;i++) {
    const n=(await admin.query("SELECT COUNT(*)::int n FROM pg_stat_activity WHERE application_name=$1 AND wait_event_type='Lock' AND query LIKE '%world_event_participants%FOR UPDATE%'",[schema])).rows[0].n;
    if(n>=count)return;
    await new Promise(r=>setTimeout(r,20));
  }
  throw Error('Payout requests did not reach participant row lock');
}
(async()=>{
  await admin.query('CREATE SCHEMA '+schema);
  for(const table of tables) {
    await admin.query(`CREATE TABLE ${schema}.${table} (LIKE public.${table} INCLUDING ALL)`);
    const cols=(await admin.query("SELECT column_name FROM information_schema.columns WHERE table_schema=$1 AND table_name=$2 AND column_default LIKE 'nextval(%'",[schema,table])).rows;
    for(const col of cols) {
      const seq=`${schema}.${table}_${col.column_name}_qa_seq`;
      await admin.query('CREATE SEQUENCE '+seq);
      await admin.query(`ALTER TABLE ${schema}.${table} ALTER COLUMN ${col.column_name} SET DEFAULT nextval('${seq}')`);
    }
  }
  // LIKE omits FK constraints. Recreate real constraints with cloned targets.
  const fks=(await admin.query("SELECT c.conrelid::regclass::text tbl,c.conname,pg_get_constraintdef(c.oid) def FROM pg_constraint c JOIN pg_namespace n ON n.oid=c.connamespace WHERE n.nspname='public' AND c.contype='f' AND c.conrelid::regclass::text=ANY($1::text[])",[tables])).rows;
  for(const fk of fks) {
    const def=fk.def.replace(/REFERENCES (?:public\.)?([a-z_]+)\(/g,(_,name)=>`REFERENCES ${tables.includes(name)?schema:'public'}.${name}(`);
    await admin.query(`ALTER TABLE ${schema}.${fk.tbl} ADD CONSTRAINT ${fk.conname} ${def}`);
  }
  // Bind the actual db helpers to the shadow pool; never initialize/migrate game DB.
  const NativePool=pg.Pool;
  try {pg.Pool=class {constructor(){return pool;}}; originalDb=require('../db');} finally {pg.Pool=NativePool;}
  require.cache[require.resolve('../db')].exports={...originalDb,pool,logGPActivity:async()=>{}};
  // Battle simulation is irrelevant to payout SQL and is never dispatched here.
  require.cache[require.resolve('../services/battleScheduler')]={loaded:true,exports:{}};
  const events=require('../services/worldEvents'),weather=require('../services/weather'),exploration=require('../services/exploration'),rockets=require('../services/rocket');
  const {regionMultiplier,weightedRegionMultiplier}=require('../utils/regionalHarvest');
  await pool.query('INSERT INTO factions SELECT * FROM public.factions');
  await originalDb.ensureUser(pool,top);await originalDb.ensureUser(pool,other);
  await pool.query("UPDATE users SET gp_balance=0,xp=0 WHERE wallet_address=ANY($1::text[])",[[top,other]]);
  await pool.query("INSERT INTO resources SELECT * FROM public.resources WHERE code IN ('iron_dust','ice_crystal')");
  assert.equal((await pool.query('SELECT COUNT(*)::int n FROM resources')).rows[0].n,2);
  const event=(await pool.query("INSERT INTO world_events(event_type,event_code,hp_max,hp_current,ends_at,status) VALUES('void_raider','QA-PAYOUT',10,0,NOW()+INTERVAL '1 hour','defeated') RETURNING id")).rows[0].id;
  await pool.query('INSERT INTO world_event_participants(event_id,wallet,damage_dealt) VALUES($1,$2,100),($1,$3,50)',[event,top,other]);
  // Missing top mineral violates the real NOT NULL/resource FK path after GP update.
  await events.distributeRewards(event,'defeated');
  assert.equal(await balance(top),0);assert.equal(await balance(other),200);
  assert.deepEqual(await quantities(top),{});assert.deepEqual(await quantities(other),{ice_crystal:10,iron_dust:100});
  assert.equal((await pool.query('SELECT rewarded FROM world_event_participants WHERE event_id=$1 AND wallet=$2',[event,top])).rows[0].rewarded,false);
  assert.equal((await pool.query('SELECT COUNT(*)::int n FROM user_titles')).rows[0].n,0);
  console.log('PASS real PG failed top mineral grant rolls back GP/XP/inventory/title; other participant commits once');
  await pool.query("INSERT INTO resources SELECT * FROM public.resources WHERE code='ancient_metal'");
  assert.equal((await pool.query("SELECT COUNT(*)::int n FROM resources WHERE code='ancient_metal'")).rows[0].n,1);
  locker=await pool.connect();await locker.query('BEGIN');await locker.query('SELECT wallet FROM world_event_participants WHERE event_id=$1 AND wallet=$2 FOR UPDATE',[event,top]);
  pending=Promise.all([events.settleExpiredEvents(),events.settleExpiredEvents()]);
  await waitForLocks(2);await locker.query('COMMIT');locker.release();locker=null;
  await pending;pending=null;
  assert.equal(await balance(top),200);assert.equal(await balance(other),200);
  assert.equal(Number((await pool.query('SELECT xp FROM users WHERE wallet_address=$1',[top])).rows[0].xp),500);
  assert.deepEqual(await quantities(top),{ancient_metal:5,ice_crystal:10,iron_dust:100});
  assert.deepEqual(await quantities(other),{ice_crystal:10,iron_dust:100});
  const titles=(await pool.query('SELECT user_wallet,title_code,title_en FROM user_titles')).rows;
  assert.deepEqual(titles,[{user_wallet:top,title_code:'Void Hunter',title_en:'Void Hunter'}]);
  assert.equal((await pool.query('SELECT COUNT(*)::int n FROM world_event_participants WHERE rewarded=true')).rows[0].n,2);
  await events.settleExpiredEvents();await events.distributeRewards(event,'defeated');
  assert.equal(await balance(top),200);assert.equal((await pool.query('SELECT COUNT(*)::int n FROM user_titles')).rows[0].n,1);
  await assert.rejects(pool.query("INSERT INTO user_titles(user_wallet,title_code) VALUES('missing-user','QA')"),e=>e.code==='23503');
  console.log('PASS real PG forced concurrent defeated-event retries pay once, stable top title schema/FK, duplicate scheduler is inert');
  await pool.query('INSERT INTO sectors SELECT * FROM public.sectors ORDER BY id LIMIT 3');
  const sectors=(await pool.query('SELECT id,tier FROM sectors ORDER BY id')).rows;assert.equal(sectors.length,3);
  const [a,b,c]=sectors.map(s=>s.id);
  await pool.query(`INSERT INTO mars_weather(sector_id,weather_type,effects,starts_at,ends_at,active) VALUES
    ($1,'sandstorm','{"miningMod":50,"defenseMod":-30,"shieldMod":99}',NOW()-INTERVAL '1 hour',NOW()+INTERVAL '1 hour',true),
    ($1,'sandstorm','{"miningMod":50}',NOW()-INTERVAL '1 hour',NOW()+INTERVAL '1 hour',true),
    ($1,'solar_flare','{"miningMod":999}',NOW()+INTERVAL '1 hour',NOW()+INTERVAL '2 hours',true),
    ($1,'solar_flare','{"miningMod":999}',NOW()-INTERVAL '2 hours',NOW()-INTERVAL '1 hour',true),
    ($1,'solar_flare','{"miningMod":999}',NOW()-INTERVAL '1 hour',NOW()+INTERVAL '1 hour',false),
    ($2,'dust_devil','{"miningMod":-50}',NOW()-INTERVAL '1 hour',NOW()+INTERVAL '1 hour',true)`,[a,b]);
  await pool.query(`INSERT INTO starlink_passes(satellite_id,sector_id,boost_value,started_at,ends_at,active) VALUES
    (1,$1,0.1,NOW()-INTERVAL '1 hour',NOW()+INTERVAL '1 hour',true),
    (2,$1,0.2,NOW()-INTERVAL '1 hour',NOW()+INTERVAL '1 hour',true),
    (3,$1,9,NOW()-INTERVAL '2 hours',NOW()-INTERVAL '1 hour',true),
    (3,$1,9,NOW()-INTERVAL '1 hour',NOW()+INTERVAL '1 hour',false)`,[a]);
  assert.equal((await weather.getActiveWeather(a)).length,2);
  assert.deepEqual(await weather.getWeatherModifiers(a),{miningMod:100,defenseMod:-30,attackMod:0,claimCostMod:0,shieldMod:0});
  assert.ok(Math.abs(await exploration.getStarlinkBoost(a)-0.3)<1e-10);
  assert.ok(Math.abs(await regionMultiplier(a,weather,exploration)-2.6)<1e-10);
  assert.equal(await regionMultiplier(b,weather,exploration),0.5);assert.equal(await regionMultiplier(c,weather,exploration),1);
  assert.ok(Math.abs(await weightedRegionMultiplier([{sector_id:a,tier:'boosted',cnt:1},{sector_id:c,tier:'plain',cnt:99}],{boosted:2,plain:1},weather,exploration)-104.2/101)<1e-10);
  console.log('PASS real PG weather/pass getters exclude future/expired/inactive rows, whitelist effects, retain same-sector sum and tier-weighted regional share');
  await pool.query(`INSERT INTO rocket_events(landing_lat,landing_lng,status,landing_at,looting_ends_at,total_rewards,claimed_rewards) VALUES
    (0,0,'incoming',NOW()+INTERVAL '1 hour',NOW()+INTERVAL '2 hours',3,0),
    (0,0,'incoming',NOW()-INTERVAL '1 hour',NOW()+INTERVAL '1 hour',3,0),
    (0,0,'incoming',NOW()-INTERVAL '2 hours',NOW()-INTERVAL '1 hour',3,0),
    (0,0,'looting',NOW()-INTERVAL '1 hour',NOW()+INTERVAL '1 hour',3,0),
    (0,0,'looting',NOW()-INTERVAL '2 hours',NOW()-INTERVAL '1 hour',3,0),
    (0,0,'looting',NOW()-INTERVAL '1 hour',NOW()+INTERVAL '1 hour',3,3)`);
  const visible=await rockets.getActiveRocketEvents();
  assert.equal(visible.length,2);assert.deepEqual(visible.map(e=>e.status).sort(),['incoming','looting']);
  assert.equal((await pool.query('SELECT COUNT(*)::int n FROM rocket_events')).rows[0].n,6);
  console.log('PASS real PG rocket listing omits overdue incoming, expired and exhausted rows without deleting existing claims/events');
  console.log('PASS actual cloned columns/indexes and '+fks.length+' real FK constraints; all fixtures isolated in '+schema);
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{
  if(locker){await locker.query('ROLLBACK');locker.release();}
  if(pending)await pending.catch(()=>{});
  await pool.end();await admin.query('DROP SCHEMA IF EXISTS '+schema+' CASCADE');
  const left=(await admin.query('SELECT COUNT(*)::int n FROM pg_namespace WHERE nspname=$1',[schema])).rows[0].n;
  await admin.end();assert.equal(left,0);console.log('PASS shadow schema and fixture cleanup');
});
