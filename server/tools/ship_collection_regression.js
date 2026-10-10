#!/usr/bin/env node
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
if (!/^codex_occupy_review_/.test(new URL(process.env.DATABASE_URL).pathname.slice(1))) throw Error('Disposable review database required');
const { pool } = require('../db');
const { buildDisclosure, listCrates, openCrate } = require('../services/shipCrate');
const { listCollection, getRebuildQuote, startRebuild, rebuildCost } = require('../services/shipCollection');
const { completeBuildJob } = require('../services/ship');
const sum = values => values.reduce((a,b)=>a+b,0);
const approx = (a,b) => assert.ok(Math.abs(a-b) < 0.00002, `${a} ≠ ${b}`);
async function user() {
  const wallet='0x'+crypto.randomBytes(20).toString('hex');
  await pool.query(`INSERT INTO users(wallet_address,nickname,faction_code,gp_balance,rank_level,level) VALUES($1,'Collection Regression','mcc',100000,20,20)`, [wallet]);
  return wallet;
}
async function main() {
  const types = ['mcc','cv'].flatMap(faction=>['frigate','cruiser','battleship','titan'].map(size=>({code:`${faction}_${size}`,faction_code:faction,size_class:size,max_per_server:size==='titan'?3:null,server_alive:faction==='cv'&&size==='titan'?3:0,max_per_player:null,my_alive:0})));
  const context={faction:'mcc',pullsSince:0,crossPct:18,factions:['mcc','cv'],types,firstRecruit:true};
  const crate={code:'elite_crate',rarity_weights:{frigate:20,cruiser:40,battleship:30,titan:10},pity_pulls:5};
  const d=buildDisclosure(crate,context);
  approx(sum(d.outcomes.map(o=>o.probability_pct)),100); approx(d.effective_class_odds.titan,8.2); approx(d.effective_class_odds.battleship,31.8);
  approx(sum(Object.values(d.quality_odds)),100); approx(d.cross_faction_pct,18); approx(d.usable_pct,82);
  const pity=buildDisclosure(crate,{...context,pullsSince:4});
  assert.equal(pity.pity_active,true); assert.equal(pity.effective_class_odds.frigate,undefined); approx(sum(Object.values(pity.effective_class_odds)),100);
  const recruit=buildDisclosure({...crate,code:'recruit_crate'},context); assert.equal(recruit.cross_faction_pct,0); approx(recruit.usable_pct,100);
  const decimal=buildDisclosure({...crate,rarity_weights:{frigate:0.5,cruiser:2.5}},context); approx(decimal.base_class_odds.frigate,100/6);
  assert.throws(()=>rebuildCost({build_gp_cost:0,recipe_minerals:{},build_time_seconds:0}),/REBUILD_NOT_AVAILABLE/);
  console.log('PASS exact class/quality/cross/pity/Titan substitution and nonzero rebuild cost');

  const w=await user(), buyer=await user();
  const quotes=await listCrates(w), free=quotes.crates.find(c=>c.code==='recruit_crate');
  assert.equal(free.disclosure.first_recruit_own_faction,true); assert.equal(free.disclosure.cross_faction_pct,0);
  const draws=await Promise.all(Array.from({length:5},()=>openCrate(w,'recruit_crate')));
  assert.equal(draws.filter(d=>d.success).length,1); assert.equal(draws.filter(d=>d.error==='DAILY_LIMIT_REACHED').length,4);
  const drawn=draws.find(d=>d.success); assert.equal(drawn.ship.faction,'mcc'); assert.equal(drawn.ship.isCrossFaction,false);
  assert.equal((await listCrates(w)).crates.find(c=>c.code==='recruit_crate').daily_remaining,0);
  console.log('PASS first own-faction recruit and concurrent free daily quota');

  const type=(await pool.query(`SELECT * FROM ship_types WHERE code='mcc_frg'`)).rows[0];
  const source=(await pool.query(`INSERT INTO ships(ship_type_code,owner_wallet,current_hp,max_hp,is_alive,quality,bonus_atk,bonus_hp,upgrade_level,built_at,built_by_wallet)
    VALUES('mcc_frg',$1,$2,$2,true,'legendary',99,50,3,NOW(),$1) RETURNING id`,[w,type.base_hp])).rows[0];
  await pool.query(`UPDATE ships SET owner_wallet=$1 WHERE id=$2`,[buyer,source.id]);
  assert.ok((await listCollection(buyer)).collection.find(c=>c.ship_type_code==='mcc_frg'));
  assert.ok((await listCollection(w)).collection.find(c=>c.ship_type_code==='mcc_frg').qualities.includes('legendary'));
  await pool.query(`UPDATE ships SET owner_wallet=$1,is_alive=false,current_hp=0,destroyed_at=NOW(),destroyed_reason='battle' WHERE id=$2`,[w,source.id]);
  const before=(await pool.query(`SELECT quality,bonus_atk,bonus_hp,upgrade_level FROM ships WHERE id=$1`,[source.id])).rows[0];
  const collection=(await listCollection(w)).collection.find(c=>c.ship_type_code==='mcc_frg'); assert.ok(collection.lost_hulls.some(h=>String(h.id)===String(source.id)));
  await assert.rejects(getRebuildQuote(buyer,source.id),/SHIP_NOT_FOUND/);
  const quote=await getRebuildQuote(w,source.id);
  assert.equal(quote.build_seconds,300); assert.equal(quote.quality,'common'); assert.equal(quote.gp_cost,Number(type.build_gp_cost));
  assert.ok(quote.locks.includes('INSUFFICIENT_MINERALS'));
  const gpBefore=Number((await pool.query(`SELECT gp_balance FROM users WHERE wallet_address=$1`,[w])).rows[0].gp_balance);
  await assert.rejects(startRebuild(w,source.id),/INSUFFICIENT_MINERALS/);
  assert.equal(Number((await pool.query(`SELECT gp_balance FROM users WHERE wallet_address=$1`,[w])).rows[0].gp_balance),gpBefore);
  for (const [code,qty] of Object.entries(type.recipe_minerals)) await pool.query(`INSERT INTO user_resource_inventory(wallet_address,resource_id,quantity)
    SELECT $1,id,$2 FROM resources WHERE code=$3 ON CONFLICT(wallet_address,resource_id) DO UPDATE SET quantity=$2`,[w,Number(qty)*3,code]);
  const builds=await Promise.all(Array.from({length:4},()=>startRebuild(w,source.id)));
  assert.equal(builds.filter(b=>!b.already_started).length,1); assert.equal(new Set(builds.map(b=>String(b.job_id))).size,1);
  assert.equal(Number((await pool.query(`SELECT gp_balance FROM users WHERE wallet_address=$1`,[w])).rows[0].gp_balance),gpBefore-quote.gp_cost);
  for (const [code,qty] of Object.entries(type.recipe_minerals)) {
    const have=(await pool.query(`SELECT quantity FROM user_resource_inventory i JOIN resources r ON r.id=i.resource_id WHERE i.wallet_address=$1 AND r.code=$2`,[w,code])).rows[0].quantity;
    assert.equal(Number(have),Number(qty)*2);
  }
  const job=builds[0].job_id;
  await pool.query(`UPDATE ship_build_jobs SET completes_at=NOW()-INTERVAL '1 second' WHERE id=$1`,[job]);
  const completions=await Promise.all([completeBuildJob(job),completeBuildJob(job)]); assert.equal(completions.filter(c=>c.success).length,1);
  const result=completions.find(c=>c.success);
  const rebuilt=(await pool.query(`SELECT quality,bonus_atk,bonus_hp,upgrade_level FROM ships WHERE id=$1`,[result.ship_id])).rows[0];
  assert.equal(rebuilt.quality,'common'); assert.equal(Number(rebuilt.bonus_atk),0); assert.equal(Number(rebuilt.bonus_hp),0); assert.equal(Number(rebuilt.upgrade_level),0);
  assert.deepEqual((await pool.query(`SELECT quality,bonus_atk,bonus_hp,upgrade_level FROM ships WHERE id=$1`,[source.id])).rows[0],before);
  assert.equal((await startRebuild(w,source.id)).already_started,true);
  assert.equal((await getRebuildQuote(w,source.id)).can_rebuild,false);
  console.log('PASS permanent sale/loss discovery; source ownership; insufficient-resource rollback; 4 concurrent rebuilds spend once; 2 completions mint one common hull; paid quality remains');
  // A scrapped hull cannot collect a scrap refund AND become a recovery source.
  await pool.query(`UPDATE ships SET destroyed_reason='scrapped' WHERE id=$1`,[source.id]);
  await assert.rejects(getRebuildQuote(w,source.id),/SHIP_NOT_DESTROYED/);
  console.log('PASS scrapped source rejection');
  console.log('FIXTURE wallets retained only in disposable database:',w,buyer);
}
main().then(()=>pool.end()).then(()=>process.exit(0)).catch(async e=>{console.error(e);await pool.end();process.exit(1);});
