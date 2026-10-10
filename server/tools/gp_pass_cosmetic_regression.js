#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const url = new URL(process.env.DATABASE_URL || '');
if (!['localhost','127.0.0.1','::1'].includes(url.hostname) || url.pathname !== '/codex_occupy_review_upgrade_20261010') throw Error('Exact disposable local review database required');
process.env.JWT_SECRET = crypto.randomBytes(32).toString('hex');
const { pool } = require('../db');
const season = require('../services/season');
const express = require('express');
const jwt = require('jsonwebtoken');
const app = express(); app.use(express.json());
app.use('/api', require('../routes/seasonRoutes'));
app.use('/api', require('../routes/cosmeticRoutes'));
const wallets = Array.from({length:3}, () => '0x'+crypto.randomBytes(20).toString('hex'));
const [buyer,poor,stranger] = wallets;
const checks = [];
let server,base,claimId,nodeId,fleetId,shipId,testSeason,originalPrice,originalFee;
const migration = fs.readFileSync(path.join(__dirname,'../migrations/349_gp_pass_cosmetic_foundation.sql'),'utf8');
async function call(w,method,route,body,auth=true) {
  const response=await fetch(base+route,{method,headers:{'Content-Type':'application/json',...(auth?{Authorization:'Bearer '+jwt.sign({wallet_address:w},process.env.JWT_SECRET)}:{})},...(body?{body:JSON.stringify(body)}:{})});
  return {status:response.status,body:await response.json()};
}
async function gp(w) { return Number((await pool.query('SELECT gp_balance FROM users WHERE wallet_address=$1',[w])).rows[0].gp_balance); }
async function xp(w,id) {return Number((await pool.query('SELECT pass_xp FROM season_pass_progress WHERE wallet=$1 AND season_id=$2',[w,id])).rows[0]?.pass_xp||0);}
async function value(key) {return (await pool.query('SELECT value FROM settings WHERE key=$1',[key])).rows[0]?.value;}
async function set(key,v) {await pool.query('UPDATE settings SET value=$2::jsonb WHERE key=$1',[key,JSON.stringify(v)]);}
async function run() {
  await pool.query(migration);
  originalPrice=await value('season_pass_premium_cost_gp'); originalFee=await value('cosmetic_equip_fee_pp');
  const active=await season.getActiveSeason(); assert.ok(active,'Existing active season required');
  const promised=(await pool.query('SELECT * FROM season_pass_tiers WHERE season_id=$1 ORDER BY id',[active.id])).rows;
  for(const [i,w] of wallets.entries()) await pool.query("INSERT INTO users(wallet_address,nickname,gp_balance,pp_balance,is_test_account) VALUES($1,$2,$3,0,true)",[w,'GP pass regression '+i,i===1?0:1000]);
  server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));}); base='http://127.0.0.1:'+server.address().port;
  assert.equal((await call(buyer,'POST','/api/season/pass/purchase',{},false)).status,401);
  await set('season_pass_premium_cost_gp',177);
  const quoted=await call(buyer,'GET','/api/season/pass');
  assert.equal(quoted.status,200); assert.equal(quoted.body.premiumCost,177); assert.equal(quoted.body.currency,'GP'); assert.equal(quoted.body.paymentType,'gameplay_currency');
  const stale=await call(buyer,'POST','/api/season/pass/purchase',{expectedCost:150,expectedSeasonId:active.id});
  assert.equal(stale.body.error,'PASS_PRICE_CHANGED'); assert.equal(await gp(buyer),1000);
  assert.equal((await call(buyer,'POST','/api/season/pass/purchase',{expectedCost:177,expectedSeasonId:active.id+10000})).body.error,'PASS_SEASON_CHANGED');
  const blocker=await pool.connect(); await blocker.query('BEGIN'); await blocker.query('SELECT wallet_address FROM users WHERE wallet_address=$1 FOR UPDATE',[buyer]);
  const pending=Promise.all(Array.from({length:4},()=>call(buyer,'POST','/api/season/pass/purchase',{expectedCost:177,expectedSeasonId:active.id})));
  let waiting=0;
  for(let i=0;i<100&&waiting<4;i++) {
    await blocker.query('SELECT pg_stat_clear_snapshot()');
    waiting=Number((await blocker.query("SELECT COUNT(*) n FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE 'SELECT wallet_address,gp_balance FROM users%FOR UPDATE'")).rows[0].n);
    if(waiting<4) await new Promise(r=>setTimeout(r,10));
  }
  await blocker.query('COMMIT'); blocker.release();
  const bought=await pending; assert.ok(waiting>=4,'All four purchases must reach user lock');
  assert.ok(bought.every(r=>r.status===200)); assert.equal(bought.filter(r=>r.body.charged===177).length,1);assert.equal(bought.filter(r=>r.body.alreadyOwned).length,3);
  assert.equal(await gp(buyer),823);
  const receipt=(await pool.query("SELECT * FROM transactions WHERE from_wallet=$1 AND meta->>'action'='season_pass_purchase'",[buyer])).rows;
  assert.equal(receipt.length,1);assert.equal(receipt[0].meta.gp,177);assert.equal(String(bought.find(r=>r.body.charged===177).body.transactionId),String(receipt[0].id));
  assert.equal((await call(buyer,'POST','/api/season/pass/purchase',{})).body.charged,0);assert.equal(await gp(buyer),823);
  assert.equal((await call(poor,'POST','/api/season/pass/purchase',{})).status,400);assert.equal(await gp(poor),0);
  checks.push('HTTP GP quote/price-change/season-change checks, forced four-request race, retry, single receipt and insufficient funds');
  await set('season_pass_premium_cost_gp',null);assert.equal(await season.getPremiumPassPrice(),150);
  assert.equal((await call(stranger,'GET','/api/season/pass')).body.premiumCost,150);
  for(const bad of [-1,0,1.5,'abc',true,[1],{}]) {await set('season_pass_premium_cost_gp',bad);await assert.rejects(season.getPremiumPassPrice(),/INVALID_PASS_PRICE/);}
  await set('season_pass_premium_cost_gp',177);
  checks.push('Single 150 GP fallback and fail-closed malformed configured prices');
  // An inactive fixture season avoids changing the real Season 5 window/rewards.
  testSeason=(await pool.query("INSERT INTO seasons(name,starts_at,ends_at,active) VALUES('GP regression',NOW()-INTERVAL '4 days',NOW()+INTERVAL '1 day',false) RETURNING *")).rows[0];
  const window={id:testSeason.id,startsAt:testSeason.starts_at,endsAt:testSeason.ends_at};
  const sector=(await pool.query("SELECT id FROM sectors ORDER BY id LIMIT 1")).rows[0];assert.ok(sector);
  nodeId=(await pool.query("INSERT INTO frontier_nodes(front_key,node_type,name,sector_id) VALUES($1,'resource','GP regression mine',$2) RETURNING id",['bm:'+buyer,sector.id])).rows[0].id;
  fleetId=(await pool.query("INSERT INTO fleets(owner_wallet,name) VALUES($1,'GP regression') RETURNING id",[buyer])).rows[0].id;
  const type=(await pool.query('SELECT code,base_hp FROM ship_types WHERE is_active ORDER BY code LIMIT 1')).rows[0];assert.ok(type);
  shipId=(await pool.query('INSERT INTO ships(fleet_id,owner_wallet,ship_type_code,current_hp,max_hp) VALUES($1,$2,$3,$4,$4) RETURNING id',[fleetId,buyer,type.code,type.base_hp])).rows[0].id;
  // >100 XP on yesterday; later GETs cannot move that day's excess into today.
  await pool.query(`INSERT INTO frontier_production_events(wallet,owner_key,node_id,batches,iron_dust,hull_plate,created_at)
    SELECT $1::varchar,'wallet:'||$1::varchar,$2,1,20,4,date_trunc('day',NOW())-INTERVAL '1 hour'+n*INTERVAL '1 second' FROM generate_series(1,25) n`,[buyer,nodeId]);
  await pool.query("INSERT INTO frontier_production_events(wallet,owner_key,node_id,batches,iron_dust,hull_plate,created_at) VALUES($1,$2,$3,1,20,4,NOW()),($4,$5,$3,1,20,4,NOW()),($1,$2,$3,1,20,4,NOW()-INTERVAL '5 days')",[buyer,'wallet:'+buyer,nodeId,stranger,'wallet:'+stranger]);
  await pool.query("INSERT INTO frontier_repairs(wallet,owner_key,ship_id,healed,iron_used,gp_cost) VALUES($1,$2,$3,1,1,1)",[buyer,'wallet:'+buyer,shipId]);
  for(const status of ['arrived','cancelled','raided','moving']) await pool.query(`INSERT INTO frontier_cargo(wallet,owner_key,fleet_id,front_key,resource_code,amount,received,status,arrives_at,settled_at)
    VALUES($1,$2,$3,$4,'iron_dust',1,$5,$6,NOW(),NOW())`,[buyer,'wallet:'+buyer,fleetId,'bm:'+buyer,status==='arrived'?1:0,status]);
  const syncs=await Promise.all(Array.from({length:4},()=>season.syncIndustryPassXP(buyer,window)));
  assert.equal(syncs.reduce((n,r)=>n+r.earned,0),120);assert.equal(await xp(buyer,testSeason.id),120);
  assert.ok(syncs.every(r=>r.dailyUsed===20&&r.dailyRemaining===80),'Yesterday 100 XP must not consume today; concurrent responses use actual ledger');
  assert.equal((await season.syncIndustryPassXP(buyer,window)).earned,0);assert.equal(await xp(buyer,testSeason.id),120);
  const credited=(await pool.query('SELECT source_type,xp,event_day::text FROM season_pass_contributions WHERE season_id=$1 AND wallet=$2',[testSeason.id,buyer])).rows;
  assert.equal(credited.length,28);assert.equal(credited.filter(r=>r.xp===0).length,5);assert.equal(credited.filter(r=>r.source_type==='delivery').length,1);
  const other=await season.syncIndustryPassXP(stranger,window);assert.equal(other.earned,5);assert.equal(other.dailyUsed,5);assert.equal(other.dailyRemaining,95);
  const empty=await season.syncIndustryPassXP(poor,window);assert.equal(empty.dailyUsed,0);assert.equal(empty.dailyRemaining,100);
  // Actual GET derives its own current-season window and ignores arbitrary body XP.
  const before=await xp(buyer,active.id);await call(buyer,'POST','/api/season/pass/purchase',{xp:999999});
  assert.equal(await xp(buyer,active.id),before);
  const current=(await call(buyer,'GET','/api/season/pass')).body;
  const eligibleYesterday=Number((await pool.query('SELECT COUNT(*) n FROM frontier_production_events WHERE wallet=$1 AND created_at >= $2 AND created_at < CURRENT_DATE',[buyer,active.startsAt])).rows[0].n);
  assert.equal(current.xp-before,Math.min(eligibleYesterday*5,100)+20);assert.equal((await call(buyer,'GET','/api/season/pass')).body.xp,current.xp);
  checks.push('Committed production/delivery/repair, original-event-day 100 XP cap, concurrent sync, pre-season/other-user/cancelled/raided exclusion and replay-safe GET');
  assert.equal(current.contributionPolicy.dailyUsed,20);assert.equal(current.contributionPolicy.dailyRemaining,80);
  // 500 nominal production XP today still spends only the remaining 80.
  await pool.query(`INSERT INTO frontier_production_events(wallet,owner_key,node_id,batches,iron_dust,hull_plate,created_at)
    SELECT $1::varchar,'wallet:'||$1::varchar,$2,1,20,4,NOW() FROM generate_series(1,100) n`,[buyer,nodeId]);
  const capped=await season.syncIndustryPassXP(buyer,window);
  assert.equal(capped.earned,80);assert.equal(capped.dailyUsed,100);assert.equal(capped.dailyRemaining,0);
  const repeat=await season.syncIndustryPassXP(buyer,window);
  assert.equal(repeat.earned,0);assert.equal(repeat.dailyUsed,100);assert.equal(repeat.dailyRemaining,0);
  const cappedGet=(await call(buyer,'GET','/api/season/pass')).body;
  assert.equal(cappedGet.contributionPolicy.dailyUsed,100);assert.equal(cappedGet.contributionPolicy.dailyRemaining,0);
  assert.equal(Number.isInteger(cappedGet.contributionPolicy.dailyUsed),true);
  checks.push('Actual Asia/Seoul dailyUsed/dailyRemaining exclude old days, empty user has full allowance, 500 nominal XP caps at 100 and repeat GET preserves values');

  // Claims stay single-use and the existing real season reward table stays unchanged.
  await pool.query('UPDATE season_pass_progress SET pass_xp=10000 WHERE season_id=$1 AND wallet=$2',[active.id,buyer]);
  const balance=await gp(buyer);const tier=promised.find(t=>t.is_premium&&t.reward_type==='gp');assert.ok(tier);
  const claims=await Promise.all(Array.from({length:4},()=>call(buyer,'POST','/api/season/pass/claim',{tier:tier.tier,isPremium:true})));
  assert.equal(claims.filter(r=>r.status===200).length,1);assert.equal(await gp(buyer)-balance,Number(tier.reward_amount));
  assert.deepEqual((await pool.query('SELECT * FROM season_pass_tiers WHERE season_id=$1 ORDER BY id',[active.id])).rows,promised);
  checks.push('Four concurrent claims pay once; existing active season promised tiers unchanged');
  // Reapplying migration only changes the shipped .5 fee and preserves custom .7.
  await set('cosmetic_equip_fee_pp',0.7);await pool.query(migration);assert.equal(Number(await value('cosmetic_equip_fee_pp')),0.7);
  await set('cosmetic_equip_fee_pp',0.5);await pool.query(migration);assert.equal(Number(await value('cosmetic_equip_fee_pp')),0);
  claimId=(await pool.query('INSERT INTO claims(owner,center_lat,center_lng,width,height,total_paid) VALUES($1,63,91,1,1,1) RETURNING id',[buyer])).rows[0].id;
  const item=(await pool.query("SELECT id FROM item_types WHERE code='neon_border' AND category='cosmetic'")).rows[0];assert.ok(item);
  await pool.query('INSERT INTO user_items(wallet,item_type_id,quantity) VALUES($1,$2,1)',[buyer,item.id]);
  const equips=await Promise.all(Array.from({length:4},()=>call(buyer,'POST','/api/cosmetic/equip',{claimId,itemCode:'neon_border'})));
  assert.ok(equips.every(r=>r.status===200));assert.ok(equips.every(r=>r.body.feePP===0));assert.equal(equips.filter(r=>r.body.alreadyEquipped).length,3);
  assert.equal(Number((await pool.query('SELECT pp_balance FROM users WHERE wallet_address=$1',[buyer])).rows[0].pp_balance),0);
  assert.equal((await pool.query('SELECT quantity FROM user_items WHERE wallet=$1 AND item_type_id=$2',[buyer,item.id])).rows[0].quantity,0);
  assert.equal((await call(stranger,'POST','/api/cosmetic/equip',{claimId,itemCode:'neon_border'})).status,403);
  assert.equal((await call(buyer,'POST','/api/cosmetic/equip',{claimId,itemCode:'flame_border'})).status,400);
  assert.equal((await call(buyer,'POST','/api/cosmetic/unequip',{claimId,cosmeticType:'border'})).status,200);
  assert.equal((await pool.query('SELECT quantity FROM user_items WHERE wallet=$1 AND item_type_id=$2',[buyer,item.id])).rows[0].quantity,1);
  checks.push('349 preserves custom fees; default free equip with zero PP, repeated concurrent equip, ownership rejection, unequip returns one item');
}
run().then(()=>console.log(JSON.stringify({success:true,checks},null,2))).catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{
  if(server) await new Promise(resolve=>server.close(resolve));
  try {
    if(originalPrice!==undefined) await set('season_pass_premium_cost_gp',originalPrice);
    if(originalFee!==undefined) await set('cosmetic_equip_fee_pp',originalFee);
    for(const table of ['user_cosmetics','user_items','daily_missions','season_pass_claims','season_pass_progress','season_pass_contributions','season_scores']) await pool.query(`DELETE FROM ${table} WHERE wallet=ANY($1::varchar[])`,[wallets]);
    await pool.query('DELETE FROM frontier_production_events WHERE wallet=ANY($1::varchar[])',[wallets]);
    await pool.query('DELETE FROM frontier_cargo WHERE wallet=ANY($1::varchar[])',[wallets]);
    await pool.query('DELETE FROM frontier_repairs WHERE wallet=ANY($1::varchar[])',[wallets]);
    await pool.query('DELETE FROM transactions WHERE from_wallet=ANY($1::varchar[])',[wallets]);
    if(claimId) await pool.query('DELETE FROM claims WHERE id=$1',[claimId]);
    if(shipId) await pool.query('DELETE FROM ships WHERE id=$1',[shipId]);
    if(fleetId) await pool.query('DELETE FROM fleets WHERE id=$1',[fleetId]);
    if(nodeId) await pool.query('DELETE FROM frontier_nodes WHERE id=$1',[nodeId]);
    if(testSeason) await pool.query('DELETE FROM seasons WHERE id=$1',[testSeason.id]);
    await pool.query('DELETE FROM users WHERE wallet_address=ANY($1::varchar[])',[wallets]);
  } catch(error) {console.error('fixture cleanup:',error);process.exitCode=1;}
  await pool.end();
});
