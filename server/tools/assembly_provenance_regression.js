#!/usr/bin/env node
'use strict';
// Real PostgreSQL transactions in a temporary schema; the exact local review clone is mandatory.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { Pool } = require('pg');
const url = new URL(process.env.DATABASE_URL || '');
if (!['localhost', '127.0.0.1'].includes(url.hostname) || url.pathname !== '/codex_occupy_review_upgrade_20261010') throw Error('Exact local review clone required');
if (process.env.NODE_ENV !== 'development' || process.env.RUN_SCHEDULERS !== 'false') throw Error('Development with schedulers disabled required');
const schema = 'assembly_qa_' + crypto.randomBytes(6).toString('hex');
const admin = new Pool({connectionString: url.href});
const pool = new Pool({connectionString: url.href, options: '-c search_path=' + schema + ',public', application_name: schema, max: 10});
const tables = ['users','fleets','ships','ship_part_cards','ship_types','ship_stat_upgrade_log','ship_market_listings','assembly_units','assembly_parts','user_assembly_parts','user_assembly_shards','user_assembly_gacha','assembly_events','starter_fleet_grant_ships','fleet_battle_participants','fleet_battles','ship_mining_jobs','frontier_cargo'];
const wallet = '0x' + crypto.randomBytes(20).toString('hex');
const other = '0x' + crypto.randomBytes(20).toString('hex');
let locker, pending;
async function hull(id) { return (await pool.query('SELECT quality,current_hp,max_hp,bonus_atk,bonus_def,bonus_hp,bonus_speed,upgrade_level,shield_hp,shield_max FROM ships WHERE id=$1',[id])).rows[0]; }
async function waitForWalletLocks(count) {
  for (let i=0;i<100;i++) {
    const result = await admin.query("SELECT COUNT(*)::int n FROM pg_stat_activity WHERE application_name=$1 AND wait_event_type='Lock' AND query LIKE '%users%FOR UPDATE%'",[schema]);
    if (result.rows[0].n >= count) return;
    await new Promise(resolve=>setTimeout(resolve,20));
  }
  throw Error('Concurrent requests did not reach wallet lock');
}
(async()=>{
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
  const settings={assembly_quality_weights:{mythic:1}};
  require.cache[require.resolve('../db')]={id:require.resolve('../db'),filename:require.resolve('../db'),loaded:true,exports:{pool,getSetting:async(k,f)=>settings[k]??f,logGPActivity:async()=>{}}};
  const assembly=require('../services/assembly');
  const shipService=require('../services/ship');
  for (const w of [wallet,other]) await pool.query("INSERT INTO users(wallet_address,nickname,faction_code,gp_balance) VALUES($1,'Assembly QA','mcc',1000)",[w]);
  await pool.query("INSERT INTO ship_types SELECT * FROM public.ship_types WHERE code='mcc_frg' OR code=(SELECT code FROM public.ship_types WHERE code<>'mcc_frg' ORDER BY code LIMIT 1)");
  const types=(await pool.query("SELECT code FROM ship_types ORDER BY (code='mcc_frg') DESC")).rows;
  assert.equal(types.length,2);
  for (const [i,type] of types.entries()) {
    await pool.query("INSERT INTO assembly_units(unit_code,ship_type_code,name_en,name_ko,part_count,max_per_player,assemble_gp_cost) VALUES($1,$2,'QA','QA',1,1,0)",['qa_unit'+i,type.code]);
    await pool.query("INSERT INTO assembly_parts(part_code,unit_code,slot,name_en,name_ko) VALUES($1,$2,1,'QA','QA')",['qa_part'+i,'qa_unit'+i]);
    for (const w of [wallet,other]) await pool.query('INSERT INTO user_assembly_parts(wallet,part_code,qty) VALUES($1,$2,2)',[w,'qa_part'+i]);
  }
  const first=await assembly.assemble(wallet,'qa_unit0');assert.equal(first.success,true);assert.equal(first.reassembled,false);assert.equal(first.quality,'mythic');
  await pool.query("UPDATE ships SET quality='epic',current_hp=37,max_hp=100,bonus_atk=11,bonus_def=7,bonus_hp=29,bonus_speed=0.73,upgrade_level=6,shield_hp=9,shield_max=25 WHERE id=$1",[first.ship_id]);
  const expected=await hull(first.ship_id);
  const fitting=(await pool.query("INSERT INTO ship_part_cards(wallet_address,part_code,slot,ship_id,level) VALUES($1,'rail_amp','weapon',$2,2) RETURNING id",[wallet,first.ship_id])).rows[0].id;
  const partsBefore=(await pool.query('SELECT qty FROM user_assembly_parts WHERE wallet=$1 AND part_code=$2',[wallet,'qa_part0'])).rows[0].qty;
  assert.equal((await assembly.disassemble(first.ship_id,wallet)).error,'PARTS_EQUIPPED');
  assert.deepEqual(await hull(first.ship_id),expected);
  assert.equal((await pool.query('SELECT qty FROM user_assembly_parts WHERE wallet=$1 AND part_code=$2',[wallet,'qa_part0'])).rows[0].qty,partsBefore);
  assert.equal((await pool.query('SELECT COUNT(*)::int n FROM assembly_events WHERE action=$1',[ 'disassemble' ])).rows[0].n,0);
  assert.equal(String((await pool.query('SELECT ship_id FROM ship_part_cards WHERE id=$1',[fitting])).rows[0].ship_id),first.ship_id);
  assert.equal(Number((await pool.query('SELECT gp_balance FROM users WHERE wallet_address=$1',[wallet])).rows[0].gp_balance),1000);
  await pool.query('UPDATE ship_part_cards SET ship_id=NULL WHERE id=$1',[fitting]);
  console.log('PASS fitted hull rejects dismantling without material/GP/HP/fitting changes; unequip preserves fitting');
  await pool.query(`INSERT INTO ship_stat_upgrade_log(ship_id,wallet_address,stat,from_bonus,to_bonus,gp_cost,success)
    SELECT $1,$2,'atk',0,CASE WHEN n<=8 THEN 1 ELSE 0 END,25,n<=8 FROM generate_series(1,11) n`,[first.ship_id,wallet]);
  const beforeOffer=(await shipService.getMyShips(wallet)).find(s=>String(s.id)===first.ship_id).upgrade_offers;
  expected.upgrade_level=8;
  const dismantled=await assembly.disassemble(first.ship_id,wallet);assert.equal(dismantled.success,true);
  assert.equal((await assembly.getState(wallet,'qa_unit0')).pending_reassembly,true);
  settings.assembly_quality_weights={common:1};
  const rebuilt=await assembly.assemble(wallet,'qa_unit0');assert.equal(rebuilt.success,true);assert.equal(rebuilt.reassembled,true);assert.equal(rebuilt.source_ship_id,first.ship_id);assert.deepEqual(await hull(rebuilt.ship_id),expected);
  const retired=(await pool.query('SELECT is_alive,current_hp,destroyed_reason FROM ships WHERE id=$1',[first.ship_id])).rows[0];assert.equal(retired.is_alive,false);assert.equal(retired.current_hp,0);assert.equal(retired.destroyed_reason,'scrapped');
  assert.equal((await assembly.getState(wallet,'qa_unit0')).pending_reassembly,false);
  const consumed=(await pool.query("SELECT detail FROM assembly_events WHERE action='disassemble' AND ship_id=$1",[first.ship_id])).rows[0].detail;assert.equal(consumed.reassembled_ship_id,rebuilt.ship_id);
  assert.equal(Number((await pool.query('SELECT gp_balance FROM users WHERE wallet_address=$1',[wallet])).rows[0].gp_balance),1000);
  console.log('PASS recovered set keeps exact quality/bonuses/upgrades/HP/shield; source hull remains retired; no new GP fee');
  assert.deepEqual((await shipService.getMyShips(wallet)).find(s=>String(s.id)===rebuilt.ship_id).upgrade_offers,beforeOffer);
  assert.equal((await pool.query('SELECT COUNT(*)::int n FROM ship_stat_upgrade_log WHERE ship_id=$1',[rebuilt.ship_id])).rows[0].n,0);
  console.log('PASS legacy eight successes with stored level six retain price/chance/material tier on new hull ID; failed logs do not count');

  assert.equal((await assembly.disassemble(rebuilt.ship_id,wallet)).success,true);
  const otherWallet=await assembly.assemble(other,'qa_unit0');assert.equal(otherWallet.success,true);assert.equal(otherWallet.reassembled,false);assert.equal(otherWallet.quality,'common');
  const otherUnit=await assembly.assemble(wallet,'qa_unit1');assert.equal(otherUnit.success,true);assert.equal(otherUnit.reassembled,false);
  assert.equal((await assembly.getState(wallet,'qa_unit0')).pending_reassembly,true);
  console.log('PASS wallet/unit separation; fresh parts roll current settings without consuming another profile');

  await pool.query("UPDATE user_assembly_parts SET qty=0 WHERE wallet=$1 AND part_code='qa_part0'",[wallet]);
  assert.equal((await assembly.assemble(wallet,'qa_unit0')).error,'MISSING_PARTS');assert.equal((await assembly.getState(wallet,'qa_unit0')).pending_reassembly,true);
  await pool.query("UPDATE user_assembly_parts SET qty=2 WHERE wallet=$1 AND part_code='qa_part0'",[wallet]);
  await pool.query("CREATE FUNCTION reject_assembly_qa() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='assemble' THEN RAISE EXCEPTION 'forced rollback'; END IF; RETURN NEW; END $$");
  await pool.query('CREATE TRIGGER reject_assembly_qa BEFORE INSERT ON assembly_events FOR EACH ROW EXECUTE FUNCTION reject_assembly_qa()');
  const countBefore=(await pool.query('SELECT COUNT(*)::int n FROM ships')).rows[0].n;
  assert.equal((await assembly.assemble(wallet,'qa_unit0')).error,'internal_error');assert.equal((await pool.query('SELECT COUNT(*)::int n FROM ships')).rows[0].n,countBefore);
  assert.equal((await pool.query("SELECT qty FROM user_assembly_parts WHERE wallet=$1 AND part_code='qa_part0'",[wallet])).rows[0].qty,2);assert.equal((await assembly.getState(wallet,'qa_unit0')).pending_reassembly,true);
  await pool.query('DROP TRIGGER reject_assembly_qa ON assembly_events');
  console.log('PASS missing materials do not consume provenance; failed event commit restores hull/material/profile atomically');

  locker=await pool.connect();await locker.query('BEGIN');await locker.query('SELECT wallet_address FROM users WHERE wallet_address=$1 FOR UPDATE',[wallet]);
  pending=Promise.all([assembly.assemble(wallet,'qa_unit0'),assembly.assemble(wallet,'qa_unit0')]);await waitForWalletLocks(2);await locker.query('COMMIT');locker.release();locker=null;
  const concurrent=await pending;pending=null;assert.equal(concurrent.filter(r=>r.success).length,1);assert.equal(concurrent.find(r=>!r.success).error,'MAX_ASSEMBLED_REACHED');
  const restored=concurrent.find(r=>r.success);assert.equal(restored.reassembled,true);assert.equal(restored.source_ship_id,rebuilt.ship_id);assert.deepEqual(await hull(restored.ship_id),expected);
  assert.equal((await pool.query("SELECT COUNT(*)::int n FROM assembly_events WHERE action='disassemble' AND detail ? 'reassembled_ship_id'")).rows[0].n,2);
  assert.equal((await pool.query("SELECT qty FROM user_assembly_parts WHERE wallet=$1 AND part_code='qa_part0'",[wallet])).rows[0].qty,1);
  console.log('PASS forced concurrent reassembly consumes one profile/set; existing alive cap remains effective');

  let repeat=restored;
  for(let i=0;i<3;i++) {
    assert.equal((await assembly.disassemble(repeat.ship_id,wallet)).success,true);
    repeat=await assembly.assemble(wallet,'qa_unit0');assert.equal(repeat.success,true);assert.equal(repeat.reassembled,true);
    assert.deepEqual(await hull(repeat.ship_id),expected);
  }
  assert.equal((await pool.query('SELECT ship_id FROM ship_part_cards WHERE id=$1',[fitting])).rows[0].ship_id,null);
  console.log('PASS repeated zero-cost cycles cannot reroll/heal or inflate stats; unequipped fitting remains owned');

  // Older logs have no recoverable pre-scrap condition. Do not invent a profile or confiscate those parts.
  await pool.query("UPDATE ships SET is_alive=false,current_hp=0,destroyed_at=NOW(),destroyed_reason='scrapped' WHERE id=$1",[otherWallet.ship_id]);
  await pool.query("INSERT INTO assembly_events(wallet,unit_code,action,ship_id,detail) VALUES($1,'qa_unit0','disassemble',$2,$3)",[other,otherWallet.ship_id,JSON.stringify({parts_returned:['qa_part0']})]);
  const legacy=await assembly.assemble(other,'qa_unit0');assert.equal(legacy.success,true);assert.equal(legacy.reassembled,false);
  assert.equal((await pool.query("SELECT detail ? 'hull_state' profile FROM assembly_events WHERE action='disassemble' AND ship_id=$1",[otherWallet.ship_id])).rows[0].profile,false);
  console.log('PASS legacy unknown-condition parts/history stay usable without fabricated provenance');
})().catch(err=>{console.error(err);process.exitCode=1;}).finally(async()=>{
  if(locker){await locker.query('ROLLBACK');locker.release();}
  if(pending)await pending.catch(()=>{});
  await pool.end();await admin.query('DROP SCHEMA IF EXISTS '+schema+' CASCADE');await admin.end();
});
