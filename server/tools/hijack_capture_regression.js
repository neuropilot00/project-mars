#!/usr/bin/env node
// Actual HTTP declaration + actual scheduler/engine, confined to an isolated clone.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const url = new URL(process.env.DATABASE_URL || '');
if (!['localhost','127.0.0.1'].includes(url.hostname) || !/^\/codex_occupy_(review_)?upgrade_/.test(url.pathname)) throw Error('Isolated local upgrade DB required');
process.env.JWT_SECRET ||= crypto.randomBytes(32).toString('hex');
delete process.env.REDIS_URL;
const express = require('express');
const jwt = require('jsonwebtoken');
const { pool } = require('../db');
const hijack = require('../services/hijack');
const scheduler = require('../services/battleScheduler');
const app = express();app.set('trust proxy','loopback');app.use(express.json());
app.use('/api',require('../routes/api'));app.use('/api',require('../routes/phaseC'));
const fixtures=[];const cases=[];let server,base,reqNo=0;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function request(wallet,path,body) {
  const res=await fetch(base+path,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json','X-Forwarded-For':'192.0.2.'+(++reqNo%250+1),...(wallet?{Authorization:'Bearer '+jwt.sign({wallet_address:wallet},process.env.JWT_SECRET)}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});
  return {status:res.status,data:await res.json()};
}
async function balance(wallet) { return Number((await pool.query('SELECT pp_balance FROM users WHERE wallet_address=$1',[wallet])).rows[0].pp_balance); }
async function pixel(f) { return (await pool.query('SELECT owner,claim_id FROM pixels WHERE lat=$1 AND lng=$2',[f.lat,f.lng])).rows[0]; }
async function fixture(name,kind='win') {
  const f={name,wallets:[0,1,2].map(()=>'0x'+crypto.randomBytes(20).toString('hex')),fleets:[]};fixtures.push(f);
  for(const w of f.wallets) {
    await pool.query("INSERT INTO users(wallet_address,nickname,pp_balance,level,rank_level,created_at,is_test_account) VALUES($1,$2,1000,10,10,NOW()-INTERVAL '30 days',true)",[w,'Hijack QA '+name]);
    await pool.query('INSERT INTO user_onboarding(wallet_address,completed) VALUES($1,true)',[w]);
  }
  for(const [i,w] of f.wallets.slice(0,2).entries()) {
    const row=(await pool.query('INSERT INTO fleets(owner_wallet,name) VALUES($1,$2) RETURNING id',[w,name+' '+(i?'def':'atk')])).rows[0];f.fleets.push(String(row.id));
  }
  const codes=(await pool.query("SELECT code,size_class FROM ship_types WHERE size_class IN ('destroyer','cruiser') ORDER BY code")).rows;
  const destroyer=codes.find(c=>c.size_class==='destroyer').code;const cruiser=codes.find(c=>c.size_class==='cruiser').code;
  for(let i=0;i<2;i++) {
    const strong=(kind==='phase1-loss'?i===1:i===0),hp=strong?100000:100;
    await pool.query('INSERT INTO ships(fleet_id,owner_wallet,ship_type_code,current_hp,max_hp,bonus_atk,bonus_def) VALUES($1,$2,$3,$4,$4,$5,$5)',[f.fleets[i],f.wallets[i],destroyer,hp,strong?100000:0]);
  }
  if(kind==='phase2-loss') await pool.query('INSERT INTO ships(fleet_id,owner_wallet,ship_type_code,current_hp,max_hp,bonus_atk,bonus_def) VALUES($1,$2,$3,10000000,10000000,10000000,10000000)',[f.fleets[1],f.wallets[1],cruiser]);
  // Pick empty integer-grid cells without changing any cloned existing pixels.
  for(let n=0;n<500;n++) {
    const lat=60.06,lng=Math.round((100.10+n*0.22)*100)/100;
    const exists=await pool.query('SELECT 1 FROM pixels WHERE lat=$1 AND lng IN($2,$3)',[lat,lng,Math.round((lng+0.22)*100)/100]);
    if(!exists.rows.length) {f.lat=lat;f.lng=lng;break;}
  }
  assert.notEqual(f.lat,undefined,'empty fixture cell needed');
  f.claim=(await pool.query('INSERT INTO claims(owner,center_lat,center_lng,width,height,total_paid) VALUES($1,$2,$3,1,1,1) RETURNING id',[f.wallets[1],f.lat,f.lng])).rows[0].id;
  await pool.query('INSERT INTO pixels(lat,lng,owner,price,claim_id) VALUES($1,$2,$3,1,$4)',[f.lat,f.lng,f.wallets[1],f.claim]);
  return f;
}
async function declare(f) {
  const r=await request(f.wallets[0],'/hijack/declare-with-pp',{lat:f.lat,lng:f.lng,width:1,height:1,atk_fleet_id:f.fleets[0]});
  assert.equal(r.status,200,JSON.stringify(r));assert.equal(r.data.auto_win,false);f.declaration=r.data;return r.data;
}
async function waitComplete(f,endedOnly=false) {
  for(let n=0;n<120;n++) {
    const h=await hijack.getHijackDetail(f.declaration.hijack_id);
    if(endedOnly?h.phase2_status==='ended':['completed','failed'].includes(h.phase)) return h;
    await sleep(100);
  }
  throw Error('Hijack did not complete in 12 seconds');
}
async function run(name,fn) {if(process.env.HIJACK_CASE_FILTER && !name.includes(process.env.HIJACK_CASE_FILTER)) return;const data=await fn();cases.push({name,passed:true,...data});console.log('PASS '+name);}
async function replay(f,h) {
  const before=[await balance(f.wallets[0]),await balance(f.wallets[1]),await pixel(f)];
  await Promise.all(Array.from({length:4},()=>h.phase2_battle_id?hijack.handlePhase2Complete(h.phase2_battle_id):hijack.handlePhase1Complete(h.phase1_battle_id)));
  if(h.phase2_battle_id) await scheduler.runBattle(h.phase2_battle_id);
  assert.deepEqual([await balance(f.wallets[0]),await balance(f.wallets[1]),await pixel(f)],before);
  const reconnect=await request(f.wallets[0],'/hijack/'+h.id);
  assert.equal(reconnect.status,200);assert.equal(reconnect.data.hijack.phase,h.phase);
  return before;
}
(async()=>{
  const flag=await pool.query("SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='is_test_account'");assert.ok(flag.rows.length,'Apply test-account migration first');
  const mode=(await pool.query("SELECT value #>> '{}' mode FROM settings WHERE key='fleet_realtime_mode'")).rows[0]?.mode;
  assert.ok(mode==='ai'||mode==='off','Use precompute-compatible clone settings; do not change shared settings');
  server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});base='http://127.0.0.1:'+server.address().port+'/api';
  await run('actual two-phase attacker victory transfers pixel and credits previous owner once',async()=>{
    const f=await fixture('winner');const d=await declare(f);
    assert.equal(await balance(f.wallets[0]),998.8);assert.equal(await balance(f.wallets[1]),1000);
    await hijack.handlePhase1Complete(d.phase1_battle_id);assert.equal((await hijack.getHijackDetail(d.hijack_id)).phase,'phase1');
    const duplicate=await request(f.wallets[0],'/hijack/declare-with-pp',{lat:f.lat,lng:f.lng,width:1,height:1,atk_fleet_id:f.fleets[0]});assert.equal(duplicate.status,409);assert.equal(await balance(f.wallets[0]),998.8);
    await scheduler.runBattle(d.phase1_battle_id);const h=await waitComplete(f);
    assert.equal(h.final_result,'attacker_won');assert.equal((await pixel(f)).owner,f.wallets[0]);assert.equal(await balance(f.wallets[1]),1001.1);
    assert.equal((await pool.query("SELECT COUNT(*)::int n FROM player_notifications WHERE wallet=$1 AND type='hijack_phase2_start'",[f.wallets[1]])).rows[0].n,1);
    const stats=(await pool.query('SELECT * FROM hijack_stats WHERE wallet_address=$1',[f.wallets[0]])).rows[0];assert.equal(stats.hijacks_attempted,1);assert.equal(stats.hijacks_succeeded,1);
    await replay(f,h);return {hijack_id:h.id,phase1:h.phase1_battle_id,phase2:h.phase2_battle_id,pixel:[f.lat,f.lng],wallets:f.wallets,attacker_pp:await balance(f.wallets[0]),prior_owner_pp:await balance(f.wallets[1])};
  });
  await run('actual phase1 defender victory retains owner and refunds 90 percent once',async()=>{
    const f=await fixture('phase1loser','phase1-loss');const d=await declare(f);await scheduler.runBattle(d.phase1_battle_id);const h=await waitComplete(f);
    assert.equal(h.final_result,'defender_won');assert.equal((await pixel(f)).owner,f.wallets[1]);assert.equal(await balance(f.wallets[0]),999.88);assert.equal(await balance(f.wallets[1]),1000);await replay(f,h);
    return {hijack_id:h.id,phase1:h.phase1_battle_id,pixel:[f.lat,f.lng],wallets:f.wallets,attacker_pp:await balance(f.wallets[0]),prior_owner_pp:await balance(f.wallets[1])};
  });
  await run('actual phase2 defender victory retains owner and refunds 90 percent once',async()=>{
    const f=await fixture('phase2loser','phase2-loss');const d=await declare(f);await scheduler.runBattle(d.phase1_battle_id);const h=await waitComplete(f);
    assert.equal(h.phase1_winner,'atk');assert.equal(h.final_result,'defender_won');assert.equal((await pixel(f)).owner,f.wallets[1]);assert.equal(await balance(f.wallets[0]),999.88);assert.equal(await balance(f.wallets[1]),1000);await replay(f,h);
    return {hijack_id:h.id,phase1:h.phase1_battle_id,phase2:h.phase2_battle_id,pixel:[f.lat,f.lng],wallets:f.wallets,attacker_pp:await balance(f.wallets[0]),prior_owner_pp:await balance(f.wallets[1])};
  });
  await run('interrupted after actual engine completion recovers ownership settlement exactly once',async()=>{
    const f=await fixture('interrupted');const d=await declare(f);const normal=hijack.handlePhase2Complete;
    let signal;const intercepted=new Promise(resolve=>{signal=resolve;});
    try {
      hijack.handlePhase2Complete=async()=>{signal();}; // Fault injection: process died between engine commit and territory hook.
      await scheduler.runBattle(d.phase1_battle_id);const interrupted=await waitComplete(f,true);
      await Promise.race([intercepted,sleep(12000).then(()=>{throw Error('Interruption hook not reached');})]);
      assert.equal(interrupted.phase,'phase2');assert.equal((await pixel(f)).owner,f.wallets[1]);assert.equal(await balance(f.wallets[1]),1000);
    } finally {hijack.handlePhase2Complete=normal;}
    const pendingState=await hijack.getHijackDetail(d.hijack_id);
    const locker=await pool.connect();let recovery;
    try {
      await locker.query('BEGIN');
      await locker.query('SELECT id FROM fleet_battles WHERE id=$1 FOR UPDATE',[pendingState.phase2_battle_id]);
      await locker.query('SELECT wallet_address FROM users WHERE wallet_address=$1 FOR UPDATE',[f.wallets[1]]);
      recovery=hijack.recoverOrphanedPhase2();
      await sleep(100);
      // A reward-like TX holding battle/user must still acquire hijack.
      // This proves recovery waits for battle BEFORE taking hijack or user locks.
      await locker.query('SELECT id FROM hijack_battles WHERE id=$1 FOR UPDATE NOWAIT',[d.hijack_id]);
      await locker.query('COMMIT');
      await recovery;
    } finally {await locker.query('ROLLBACK');locker.release();if(recovery) await recovery;}
    const h=await hijack.getHijackDetail(d.hijack_id);
    assert.equal(h.phase,'completed');assert.equal((await pixel(f)).owner,f.wallets[0]);assert.equal(await balance(f.wallets[1]),1001.1);
    await hijack.recoverOrphanedPhase2();await replay(f,h);return {hijack_id:h.id,phase2:h.phase2_battle_id,pixel:[f.lat,f.lng],wallets:f.wallets};
  });
  await run('stale third-party pixel is neither captured nor paid to former owner',async()=>{
    const f=await fixture('stale');const d=await declare(f);
    await pool.query('UPDATE pixels SET owner=$3 WHERE lat=$1 AND lng=$2',[f.lat,f.lng,f.wallets[2]]);
    await scheduler.runBattle(d.phase1_battle_id);const h=await waitComplete(f);
    assert.equal(h.final_result,'attacker_won');assert.equal((await pixel(f)).owner,f.wallets[2]);assert.equal(await balance(f.wallets[1]),1000);assert.equal(await balance(f.wallets[2]),1000);assert.equal(h.new_claim_id,null);await replay(f,h);
    return {hijack_id:h.id,pixel:[f.lat,f.lng],wallets:f.wallets};
  });
  await run('automatic capture of undefended territory settles once under concurrent retry',async()=>{
    const f=await fixture('autowin');await pool.query('DELETE FROM ships WHERE fleet_id=$1',[f.fleets[1]]);
    const rs=await Promise.all(Array.from({length:2},()=>request(f.wallets[0],'/hijack/declare-with-pp',{lat:f.lat,lng:f.lng,width:1,height:1,atk_fleet_id:f.fleets[0]})));
    assert.equal(rs.filter(r=>r.status===200).length,1,JSON.stringify(rs));
    f.declaration=rs.find(r=>r.status===200).data;assert.equal(f.declaration.auto_win,true);
    assert.equal(await balance(f.wallets[0]),998.8);assert.equal(await balance(f.wallets[1]),1001.1);assert.equal((await pixel(f)).owner,f.wallets[0]);
    return {hijack_id:f.declaration.hijack_id,pixel:[f.lat,f.lng],wallets:f.wallets};
  });
  await run('busy defender is not treated as unguarded auto-win',async()=>{
    const f=await fixture('busy');await pool.query('UPDATE fleets SET is_in_battle=true WHERE id=$1',[f.fleets[1]]);
    const r=await request(f.wallets[0],'/hijack/declare-with-pp',{lat:f.lat,lng:f.lng,width:1,height:1,atk_fleet_id:f.fleets[0]});assert.equal(r.status,409);assert.equal(r.data.error,'DEF_FLEET_IN_BATTLE');assert.equal(await balance(f.wallets[0]),1000);assert.equal(await balance(f.wallets[1]),1000);assert.equal((await pixel(f)).owner,f.wallets[1]);return {};
  });
  await run('stale unclaimed cell cannot overwrite third-party owner and rolls cost back',async()=>{
    const f=await fixture('claimrace');const next=Math.round((f.lng+0.22)*100)/100;f.extraLng=next;
    await pool.query('INSERT INTO pixels(lat,lng,owner,price) VALUES($1,$2,$3,1)',[f.lat,next,f.wallets[2]]);
    await assert.rejects(hijack.declareHijackWithPP({attacker_wallet:f.wallets[0],lat:f.lat,lng:f.lng,width:2,height:1,atk_fleet_id:f.fleets[0],new_pixels:[{lat:f.lat,lng:next,sectorPrice:0.1}],enemy_pixels:[{lat:f.lat,lng:f.lng,prevOwner:f.wallets[1],price:1}],primary_defender_wallet:f.wallets[1],primary_def_fleet_id:f.fleets[1],primary_def_claim_id:f.claim,base_cost:0.1,attack_cost:1.2}),/PIXEL_OWNERSHIP_CHANGED/);
    assert.equal(await balance(f.wallets[0]),1000);assert.equal((await pool.query('SELECT owner FROM pixels WHERE lat=$1 AND lng=$2',[f.lat,next])).rows[0].owner,f.wallets[2]);return {};
  });
  const evidence={database:url.pathname.slice(1),passed:cases.length,failed:0,cases,keep_fixtures:process.env.KEEP_HIJACK_FIXTURES==='1',limits:['No existing cancellation API; tested interruption/retry/recovery instead.','Reconnect is an actual HTTP detail reload after completed battle, not a physical browser/WebSocket reconnect.']};
  if(process.env.HIJACK_EVIDENCE_PATH) fs.writeFileSync(process.env.HIJACK_EVIDENCE_PATH,JSON.stringify(evidence,null,2)+'\n');
  console.log(JSON.stringify({passed:cases.length,failed:0,database:evidence.database}));
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{
  scheduler.stop();
  if(process.env.KEEP_HIJACK_FIXTURES!=='1') {
    for(const f of fixtures) {
      const hs=await pool.query('DELETE FROM hijack_battles WHERE attacker_wallet=$1 RETURNING phase1_battle_id,phase2_battle_id',[f.wallets[0]]);
      await pool.query('UPDATE fleets SET current_battle_id=NULL,is_in_battle=false WHERE owner_wallet=ANY($1::text[])',[f.wallets]);
      for(const h of hs.rows) for(const id of [h.phase2_battle_id,h.phase1_battle_id]) if(id) await pool.query('DELETE FROM fleet_battles WHERE id=$1',[id]);
      await pool.query('DELETE FROM pixels WHERE owner=ANY($1::text[])',[f.wallets]);
      await pool.query('DELETE FROM claims WHERE owner=ANY($1::text[])',[f.wallets]);
      await pool.query('DELETE FROM fleets WHERE owner_wallet=ANY($1::text[])',[f.wallets]);
      await pool.query('DELETE FROM users WHERE wallet_address=ANY($1::text[])',[f.wallets]);
    }
  }
  if(server) await new Promise(resolve=>server.close(resolve));await pool.end();
});
