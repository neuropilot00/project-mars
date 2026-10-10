#!/usr/bin/env node
// Real HTTP + PostgreSQL concurrency checks. No engine/scheduler is started.
// Writes are allowed only to a named, local Codex upgrade database.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const url = new URL(process.env.DATABASE_URL || '');
if (!['localhost','127.0.0.1'].includes(url.hostname) || !/^\/codex_occupy_(review_)?upgrade_/.test(url.pathname)) {
  throw Error('Use a local codex_occupy_upgrade_* isolated database');
}
process.env.JWT_SECRET ||= crypto.randomBytes(32).toString('hex');
const express = require('express');
const jwt = require('jsonwebtoken');
const { pool } = require('../db');
const app = express();
app.set('trust proxy', 'loopback');
app.use(express.json());
app.use('/api/battles', require('../routes/fleetBattles'));
const wallets = ['a','b','c'].map(() => '0x' + crypto.randomBytes(20).toString('hex'));
const fleets = [];
let server, base, requestNumber = 0, passes = 0;
async function request(wallet, path, body) {
  const r = await fetch(base + path, { method: body === undefined ? 'GET' : 'POST',
    headers: { 'Content-Type':'application/json', 'X-Forwarded-For': '192.0.2.' + (++requestNumber % 250 + 1),
      ...(wallet ? {Authorization:'Bearer ' + jwt.sign({wallet_address:wallet},process.env.JWT_SECRET)} : {}) },
    ...(body === undefined ? {} : {body:JSON.stringify(body)}) });
  return { status:r.status, data:await r.json() };
}
async function invite(a = fleets[0], b = fleets[1], path = '/duel-invitations') {
  const r = await request(wallets[0], path, {my_fleet_id:a,target_fleet_id:b,run_immediately:true});
  assert.equal(r.status,201,JSON.stringify(r));
  return r.data.invitation;
}
async function respond(i, action='accept', wallet=wallets[1], body) {
  return request(wallet, '/duel-invitations/'+i.id+'/'+action,
    body || {terms_token:i.terms_token,accept_loss_terms:true});
}
async function check(name, fn) { await fn(); passes++; console.log('PASS '+name); }
async function reset() {
  await pool.query('UPDATE fleets SET is_in_battle=false,current_battle_id=NULL WHERE id=ANY($1::bigint[])',[fleets]);
  await pool.query("UPDATE fleet_duel_invitations SET status='declined' WHERE inviter_wallet=$1 AND status='pending'",[wallets[0]]);
}
(async()=>{
  server = await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});
  base='http://127.0.0.1:'+server.address().port+'/api/battles';
  for (const wallet of wallets) await pool.query("INSERT INTO users(wallet_address,nickname) VALUES($1,'duel-regression')",[wallet]);
  // New test-account field is optional until its separately owned migration lands.
  const testFlag = await pool.query("SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='is_test_account'");
  if (testFlag.rows.length) await pool.query('UPDATE users SET is_test_account=true WHERE wallet_address=ANY($1::text[])',[wallets]);
  const type=(await pool.query("SELECT code FROM ship_types WHERE size_class='destroyer' ORDER BY code LIMIT 1")).rows[0].code;
  for (const [i,w] of [wallets[0],wallets[1],wallets[0],wallets[2]].entries()) {
    const f=await pool.query("INSERT INTO fleets(owner_wallet,name) VALUES($1,$2) RETURNING id",[w,'Consent fixture '+i]);
    fleets.push(String(f.rows[0].id));
    await pool.query('INSERT INTO ships(fleet_id,owner_wallet,ship_type_code,current_hp,max_hp) VALUES($1,$2,$3,100,100)',[fleets[i],w,type]);
  }
  await check('legacy declare creates only pending invite and reserves no fleet',async()=>{
    const i=await invite(undefined,undefined,'/declare-pvp');
    assert.equal(i.status,'pending');assert.equal(i.battle_id,null);
    assert.equal((await pool.query('SELECT COUNT(*)::int AS n FROM fleets WHERE id=ANY($1::bigint[]) AND is_in_battle',[fleets])).rows[0].n,0);
    assert.equal((await respond(i,'decline')).status,200);
  });
  await check('authentication, same fleet, same owner and bad IDs are rejected',async()=>{
    assert.equal((await request(null,'/duel-invitations',{})).status,401);
    for (const b of [fleets[0],fleets[2]]) assert.equal((await request(wallets[0],'/duel-invitations',{my_fleet_id:fleets[0],target_fleet_id:b})).status,400);
    for (const bad of ['1e2','1.1','0','9223372036854775808',9007199254740992]) assert.equal((await request(wallets[0],'/duel-invitations',{my_fleet_id:bad,target_fleet_id:fleets[1]})).status,400);
  });
  await check('four concurrent creates produce one invitation',async()=>{
    const rs=await Promise.all(Array.from({length:4},()=>request(wallets[0],'/duel-invitations',{my_fleet_id:fleets[0],target_fleet_id:fleets[1]})));
    assert.equal(rs.filter(r=>r.status===201).length,1);assert.equal(rs.filter(r=>r.status===409).length,3);
    await reset();
  });
  await check('only defender can respond; explicit exact loss confirmation required',async()=>{
    const i=await invite();
    for (const w of [wallets[0],wallets[2]]) assert.equal((await respond(i,'accept',w)).status,403);
    assert.equal((await respond(i,'accept',wallets[1],{})).status,400);
    assert.equal((await respond(i,'accept',wallets[1],{terms_token:'wrong',accept_loss_terms:true})).status,400);
    assert.equal((await request(wallets[2],'/duel-invitations')).data.invitations.length,0);
    await respond(i,'decline');assert.equal((await respond(i)).data.error,'INVITATION_DECLINED');
  });
  await check('expired invite cannot enqueue and persists expiry',async()=>{
    const i=await invite();await pool.query("UPDATE fleet_duel_invitations SET expires_at=NOW()-INTERVAL '1 second' WHERE id=$1",[i.id]);
    assert.equal((await respond(i)).status,410);
    assert.equal((await pool.query('SELECT status FROM fleet_duel_invitations WHERE id=$1',[i.id])).rows[0].status,'expired');
  });
  await check('ship HP and formation changes invalidate previously shown fleets',async()=>{
    let i=await invite();await pool.query('UPDATE ships SET current_hp=99 WHERE fleet_id=$1',[fleets[0]]);
    assert.equal((await respond(i)).data.error,'FLEET_CHANGED');await reset();
    i=await invite();await pool.query("UPDATE fleets SET formation='line' WHERE id=$1",[fleets[1]]);
    assert.equal((await respond(i)).data.error,'FLEET_CHANGED');await reset();
  });
  await check('ownership changes cannot be accepted by previous defender',async()=>{
    const i=await invite();await pool.query('UPDATE fleets SET owner_wallet=$2 WHERE id=$1',[fleets[1],wallets[2]]);
    const r=await respond(i);assert.equal(r.status,409);
    await pool.query('UPDATE fleets SET owner_wallet=$2 WHERE id=$1',[fleets[1],wallets[1]]);await reset();
  });
  await check('battle reservation changed since invite blocks acceptance',async()=>{
    const i=await invite();await pool.query('UPDATE fleets SET is_in_battle=true WHERE id=$1',[fleets[1]]);
    assert.equal((await respond(i)).data.error,'TARGET_IN_BATTLE');await reset();
  });
  await check('mining started after invitation blocks acceptance',async()=>{
    const i=await invite();
    await pool.query("INSERT INTO ship_mining_jobs(wallet_address,fleet_id,ends_at) VALUES($1,$2,NOW()+INTERVAL '1 hour')",[wallets[1],fleets[1]]);
    try { assert.equal((await respond(i)).data.error,'TARGET_FLEET_MINING'); }
    finally { await pool.query('DELETE FROM ship_mining_jobs WHERE fleet_id=$1',[fleets[1]]); }
  });
  await check('moving cargo blocks invitation creation and invalidates pending acceptance',async()=>{
    const frontier=require('../services/frontierIndustry');
    await pool.query("INSERT INTO frontier_stocks(owner_key,depot,resource_code,quantity) VALUES($1,'mine','iron_dust',100) ON CONFLICT(owner_key,depot,resource_code) DO UPDATE SET quantity=100",['wallet:'+wallets[1]]);
    const i=await invite();await frontier.startCargo(wallets[1],fleets[1],1);
    try {
      const made=await request(wallets[0],'/duel-invitations',{my_fleet_id:fleets[0],target_fleet_id:fleets[1]});
      assert.equal(made.status,409);assert.equal(made.data.error,'FLEET_TRANSPORTING');
      const accepted=await respond(i);assert.equal(accepted.status,409);assert.equal(accepted.data.error,'FLEET_TRANSPORTING');
      assert.equal((await pool.query('SELECT battle_id,status FROM fleet_duel_invitations WHERE id=$1',[i.id])).rows[0].status,'expired');
    } finally {await pool.query('DELETE FROM frontier_cargo WHERE fleet_id=$1',[fleets[1]]);}
  });
  await check('concurrent cargo start and duel acceptance reserve a fleet in only one system',async()=>{
    const frontier=require('../services/frontierIndustry');
    const i=await invite();
    const [accepted,cargo]=await Promise.all([respond(i),frontier.startCargo(wallets[1],fleets[1],1).then(r=>({ok:true,...r}),e=>({ok:false,error:e.message}))]);
    assert.equal(Number(accepted.status===200)+Number(cargo.ok),1,JSON.stringify({accepted,cargo}));
    if(cargo.ok) {assert.equal(accepted.data.error,'FLEET_TRANSPORTING');assert.equal(accepted.status,409);}
    else {assert.equal(cargo.error,'FLEET_IN_BATTLE');}
    const f=(await pool.query('SELECT is_in_battle,current_battle_id FROM fleets WHERE id=$1',[fleets[1]])).rows[0];
    const moving=(await pool.query("SELECT COUNT(*)::int n FROM frontier_cargo WHERE fleet_id=$1 AND status='moving'",[fleets[1]])).rows[0].n;
    assert.equal(Number(f.is_in_battle)+moving,1);
    await pool.query('DELETE FROM frontier_cargo WHERE fleet_id=$1',[fleets[1]]);await reset();
  });
  await check('active siege commitment blocks acceptance',async()=>{
    const i=await invite();
    const sector=(await pool.query('SELECT code FROM sector_definitions ORDER BY code LIMIT 1')).rows[0].code;
    const siege=(await pool.query("INSERT INTO governor_sieges(sector_code,challenger_wallet,status) VALUES($1,$2,'pending') RETURNING id",[sector,wallets[1]])).rows[0].id;
    await pool.query("INSERT INTO siege_fleet_commits(siege_id,wallet,fleet_id,side) VALUES($1,$2,$3,'atk')",[siege,wallets[1],fleets[1]]);
    try { assert.equal((await respond(i)).data.error,'FLEET_IN_SIEGE'); }
    finally { await pool.query('DELETE FROM governor_sieges WHERE id=$1',[siege]); }
  });
  await check('AI target requires its separate practice path',async()=>{
    await pool.query('UPDATE users SET is_ai=true WHERE wallet_address=$1',[wallets[1]]);
    try { assert.equal((await request(wallets[0],'/duel-invitations',{my_fleet_id:fleets[0],target_fleet_id:fleets[1]})).data.error,'USE_AI_PRACTICE'); }
    finally { await pool.query('UPDATE users SET is_ai=false WHERE wallet_address=$1',[wallets[1]]); }
  });
  await check('invitation expiring while fleet lock is held cannot enqueue',async()=>{
    const i=await invite();const locker=await pool.connect();
    try {
      await locker.query('BEGIN');await locker.query('SELECT id FROM fleets WHERE id=$1 FOR UPDATE',[fleets[0]]);
      await pool.query("UPDATE fleet_duel_invitations SET expires_at=clock_timestamp()+INTERVAL '150 milliseconds' WHERE id=$1",[i.id]);
      const pending=respond(i);await locker.query('SELECT pg_sleep(0.25)');await locker.query('COMMIT');
      assert.equal((await pending).status,410);
    } finally { await locker.query('ROLLBACK');locker.release(); }
  });
  await check('loss opt-in changed since invite blocks acceptance',async()=>{
    const i=await invite();await pool.query('UPDATE users SET full_loss_optin=true WHERE wallet_address=$1',[wallets[1]]);
    assert.equal((await respond(i)).data.error,'LOSS_TERMS_CHANGED');await reset();
  });
  await check('six concurrent accepts create exactly one existing engine battle',async()=>{
    const i=await invite();const rs=await Promise.all(Array.from({length:6},()=>respond(i)));
    assert.equal(rs.filter(r=>r.status===200).length,1,JSON.stringify(rs));assert.equal(rs.filter(r=>r.status===409).length,5);
    const accepted=rs.find(r=>r.status===200).data;
    const battles=await pool.query("SELECT * FROM fleet_battles WHERE battle_summary->>'duel_invitation_id'=$1",[String(i.id)]);
    assert.equal(battles.rows.length,1);assert.equal(battles.rows[0].status,'preparing');assert.equal(battles.rows[0].battle_type,'pvp_duel');
    assert.equal((await pool.query('SELECT COUNT(*)::int n FROM fleet_battle_participants WHERE battle_id=$1',[accepted.battle_id])).rows[0].n,2);
    assert.equal((await pool.query('SELECT COUNT(*)::int n FROM fleets WHERE current_battle_id=$1 AND is_in_battle',[accepted.battle_id])).rows[0].n,2);
    assert.equal((await respond(i)).data.error,'INVITATION_ACCEPTED');await reset();
  });
  await check('two distinct accepted invitations cannot double-book a fleet',async()=>{
    const one=await invite();const two=await invite(fleets[0],fleets[3]);
    const rs=await Promise.all([respond(one),respond(two,'accept',wallets[2])]);
    assert.equal(rs.filter(r=>r.status===200).length,1,JSON.stringify(rs));assert.equal(rs.filter(r=>r.status===409).length,1);
    await reset();
  });
  console.log(JSON.stringify({passed:passes,failed:0,database:url.pathname.slice(1)}));
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{
  try {
    await pool.query('UPDATE fleets SET current_battle_id=NULL,is_in_battle=false WHERE id=ANY($1::bigint[])',[fleets]);
    const battles=await pool.query('DELETE FROM fleet_duel_invitations WHERE inviter_wallet=ANY($1::text[]) OR defender_wallet=ANY($1::text[]) RETURNING battle_id',[wallets]);
    for(const b of battles.rows.filter(b=>b.battle_id)) await pool.query('DELETE FROM fleet_battles WHERE id=$1',[b.battle_id]);
    await pool.query('DELETE FROM ship_mining_jobs WHERE wallet_address=ANY($1::text[])',[wallets]);
    await pool.query('DELETE FROM governor_sieges WHERE challenger_wallet=ANY($1::text[])',[wallets]);
    await pool.query('DELETE FROM frontier_cargo WHERE wallet=ANY($1::text[])',[wallets]);
    await pool.query('DELETE FROM frontier_stocks WHERE owner_key=ANY($1::text[])',[wallets.map(w=>'wallet:'+w)]);
    await pool.query('DELETE FROM fleets WHERE id=ANY($1::bigint[])',[fleets]);
    await pool.query('DELETE FROM users WHERE wallet_address=ANY($1::text[])',[wallets]);
  } finally {
    if(server) await new Promise(resolve=>server.close(resolve));await pool.end();
  }
});
