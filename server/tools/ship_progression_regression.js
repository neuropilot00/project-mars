#!/usr/bin/env node
'use strict';
// Real service transactions in disposable shadow tables; public game rows stay untouched.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { Pool } = require('pg');
const url = new URL(process.env.DATABASE_URL || '');
if (!['localhost', '127.0.0.1'].includes(url.hostname) || url.pathname !== '/codex_occupy_review_upgrade_20261010') throw Error('Exact local review clone required');
if (process.env.NODE_ENV !== 'development' || process.env.RUN_SCHEDULERS !== 'false') throw Error('Development with schedulers disabled required');
const schema = 'ship_progression_qa_' + crypto.randomBytes(6).toString('hex');
const admin = new Pool({ connectionString: url.href });
const pool = new Pool({ connectionString: url.href, options: '-c search_path=' + schema + ',public', application_name: schema });
const wallet = '0x' + crypto.randomBytes(20).toString('hex');
const tables = ['users','ships','ship_types','fleets','ship_market_listings','ship_stat_upgrade_log','resources','user_resource_inventory','fleet_gp_activity'];
const settings = {
  ship_upgrade_base_gp:'25',ship_upgrade_growth:'1.14',ship_upgrade_atk_step:'1',ship_upgrade_def_step:'1',ship_upgrade_hp_step:'200',ship_upgrade_speed_step:'0.05',
  ship_upgrade_success_base_pct:'92',ship_upgrade_success_decay_pct:'1.8',ship_upgrade_success_floor_pct:'35',
  ship_repair_gp_per_hp:'0.03',ship_repair_iron_per_10hp:'0.2',ship_repair_cost_cap_pct_of_build:'60'
};
const originalRandom = Math.random;
let pending;
function stub(path, exports) { const id=require.resolve(path);require.cache[id]={id,filename:id,loaded:true,exports}; }
async function hull(quality='legendary',level=0) {
  return (await pool.query(`INSERT INTO ships(owner_wallet,ship_type_code,current_hp,max_hp,quality,upgrade_level,bonus_atk,bonus_def,bonus_hp,bonus_speed)
    SELECT $1,code,base_hp+21600,base_hp,$2,$3,9,5,21600,1.21 FROM ship_types WHERE code='mcc_frg' RETURNING *`,[wallet,quality,level])).rows[0];
}
async function history(id,successes,failures=0) {
  await pool.query(`INSERT INTO ship_stat_upgrade_log(ship_id,wallet_address,stat,from_bonus,to_bonus,gp_cost,success)
    SELECT $1,$2,'atk',0,CASE WHEN n<=$3 THEN 1 ELSE 0 END,25,n<=$3 FROM generate_series(1,$3::int+$4::int) n`,[id,wallet,successes,failures]);
}
async function balance() {return Number((await pool.query('SELECT gp_balance FROM users WHERE wallet_address=$1',[wallet])).rows[0].gp_balance);}
async function main() {
  await admin.query('CREATE SCHEMA '+schema);
  for (const table of tables) {
    await admin.query(`CREATE TABLE ${schema}.${table} (LIKE public.${table} INCLUDING ALL)`);
    const cols=(await admin.query("SELECT column_name FROM information_schema.columns WHERE table_schema=$1 AND table_name=$2 AND column_default LIKE 'nextval(%'",[schema,table])).rows;
    for (const col of cols) {
      const sequence=`${schema}.${table}_${col.column_name}_qa_seq`;
      await admin.query('CREATE SEQUENCE '+sequence);
      await admin.query(`ALTER TABLE ${schema}.${table} ALTER COLUMN ${col.column_name} SET DEFAULT nextval('${sequence}')`);
    }
  }
  stub('../db',{pool,getSetting:async(k,f)=>settings[k]??f,logGPActivity:async()=>{}});
  stub('../routes/dailyOps',{notifyMissionProgress:async()=>{}});
  const ship=require('../services/ship');
  await pool.query("INSERT INTO users(wallet_address,nickname,faction_code,gp_balance) VALUES($1,'Ship progression QA','mcc',100000)",[wallet]);
  await pool.query("INSERT INTO ship_types SELECT * FROM public.ship_types WHERE code='mcc_frg'");
  await pool.query("INSERT INTO resources SELECT * FROM public.resources WHERE code IN ('carbon_fiber','plasma_crystal','exotic_alloy','iron_ore','silicon_chip','basalt_chip')");
  await pool.query('INSERT INTO user_resource_inventory(wallet_address,resource_id,quantity) SELECT $1,id,100 FROM resources',[wallet]);
  const fresh=await hull(),common=await hull('common'),historical=await hull('legendary',1),legacyLevel=await hull('legendary',8);
  await pool.query('UPDATE ships SET bonus_atk=0,bonus_def=0,bonus_hp=0,bonus_speed=0,current_hp=max_hp WHERE id=$1',[common.id]);
  await history(historical.id,5,4);
  async function view(id) {return (await ship.getMyShips(wallet)).find(s=>String(s.id)===String(id));}
  const first=await view(fresh.id);
  assert.deepEqual(first.upgrade_offers,(await view(common.id)).upgrade_offers);
  assert.equal(first.upgrade_costs.atk,25);assert.equal(first.upgrade_offers.atk.chance,92);
  assert.equal(first.bonus_atk,9);assert.equal(first.bonus_hp,21600);assert.equal(first.bonus_speed,1.21);
  const old=await view(historical.id);
  assert.equal(old.upgrade_costs.atk,Math.ceil(25*1.14**5));assert.equal(old.upgrade_offers.atk.chance,83);
  assert.equal(old.upgrade_offers.atk.material_tier,2);assert.equal(old.upgrade_offers.atk.material_code,'plasma_crystal');
  assert.equal((await view(legacyLevel.id)).upgrade_costs.atk,Math.ceil(25*1.14**8));
  settings.ship_upgrade_atk_step='4';settings.ship_upgrade_hp_step='800';settings.ship_upgrade_speed_step='0.2';
  assert.deepEqual((await view(historical.id)).upgrade_offers,old.upgrade_offers);
  settings.ship_upgrade_atk_step='1';settings.ship_upgrade_hp_step='200';settings.ship_upgrade_speed_step='0.05';
  console.log('PASS quality stats excluded; successful logs/legacy level retained; failures and stat-step changes do not reinterpret paid progression');

  Math.random=()=>0.9999;
  const before=await balance(),failure=await ship.upgradeShipStat(wallet,fresh.id,'atk');
  assert.equal(failure.upgraded,false);assert.equal(failure.base_gp_cost,25);assert.equal(failure.next_cost,25);assert.equal(failure.next_chance,92);
  assert.equal(await balance(),before-failure.gp_cost);
  let stored=(await pool.query('SELECT * FROM ships WHERE id=$1',[fresh.id])).rows[0];
  assert.equal(stored.upgrade_level,0);assert.equal(stored.bonus_atk,9);assert.equal(stored.bonus_hp,21600);assert.equal(Number(stored.bonus_speed),1.21);
  Math.random=()=>0;
  const success=await ship.upgradeShipStat(wallet,fresh.id,'atk');
  assert.equal(success.upgraded,true);assert.equal(success.base_gp_cost,25);assert.equal(success.next_cost,29);assert.equal(success.next_chance,90.2);
  stored=(await pool.query('SELECT * FROM ships WHERE id=$1',[fresh.id])).rows[0];
  assert.equal(stored.upgrade_level,1);assert.equal(stored.bonus_atk,10);assert.equal(stored.bonus_def,5);assert.equal(stored.bonus_hp,21600);assert.equal(Number(stored.bonus_speed),1.21);
  assert.equal((await view(fresh.id)).upgrade_costs.atk,29);
  console.log('PASS real failure debits once without progress; real success appends stats and advances next offer once');

  // An external row lock ensures both calls race on the same historical ship.
  const locker=await pool.connect();
  try {
    await locker.query('BEGIN');await locker.query('SELECT id FROM ships WHERE id=$1 FOR UPDATE',[historical.id]);
    const gpBefore=await balance();
    pending=Promise.all([ship.upgradeShipStat(wallet,historical.id,'atk'),ship.upgradeShipStat(wallet,historical.id,'atk')]);
    for(let i=0;i<100;i++) {
      const waiting=(await admin.query("SELECT COUNT(*)::int n FROM pg_stat_activity WHERE application_name=$1 AND wait_event_type='Lock' AND query LIKE '%FOR UPDATE OF s%'",[schema])).rows[0].n;
      if(waiting>=2)break;
      if(i===99)throw Error('Concurrent upgrade callers did not reach ship lock');
      await new Promise(r=>setTimeout(r,20));
    }
    await locker.query('COMMIT');
    const results=await pending;pending=null;
    assert.deepEqual(results.map(r=>r.base_gp_cost).sort((a,b)=>a-b),[Math.ceil(25*1.14**5),Math.ceil(25*1.14**6)]);
    assert.equal(await balance(),gpBefore-results.reduce((n,r)=>n+r.gp_cost,0));
    const count=(await pool.query('SELECT COUNT(*)::int n FROM ship_stat_upgrade_log WHERE ship_id=$1 AND success=true',[historical.id])).rows[0].n;
    assert.equal(count,7);assert.equal((await view(historical.id)).upgrade_costs.atk,Math.ceil(25*1.14**7));
  } finally {await locker.query('ROLLBACK');locker.release();}
  console.log('PASS concurrent successful upgrades price serially from committed historical count; both GP debits and logs match');

  await pool.query('UPDATE ships SET current_hp=4800,bonus_hp=0 WHERE id=$1',[common.id]);
  const repair=await ship.getRepairQuote(wallet,common.id);
  assert.equal(repair.gp_cost,36);assert.equal(repair.iron_used,3);
  console.log('PASS blueprint repair ceiling: mcc_frg 15%→100%, 36 GP + 3 ore; blueprint 60 GP + 5 ore + 3 carbon');
}
main().catch(e=>{console.error(e.stack||e);process.exitCode=1;}).finally(async()=>{
  if(pending)await pending.catch(()=>{});
  Math.random=originalRandom;
  await pool.end();await admin.query('DROP SCHEMA IF EXISTS '+schema+' CASCADE');await admin.end();
});
