#!/usr/bin/env node
const assert=require('node:assert/strict'),crypto=require('node:crypto');
if (!/^codex_occupy_review_/.test(new URL(process.env.DATABASE_URL).pathname.slice(1))) throw Error('Disposable review database required');
const {pool}=require('../db');
const {DAILY_LIMITS,boundedDrops,budgetState,quoteSalvage,claimSalvage}=require('../services/shipSalvage');
async function user(ai=false) {
  const w='0x'+crypto.randomBytes(20).toString('hex');
  await pool.query(`INSERT INTO users(wallet_address,nickname,faction_code,gp_balance,is_ai,rank_level,level) VALUES($1,'Salvage Regression','mcc',100000,$2,20,20)`,[w,ai]);
  const f=(await pool.query(`INSERT INTO fleets(owner_wallet,name,formation,movement) VALUES($1,'Salvage Test','wedge','advance') RETURNING id`,[w])).rows[0].id;
  return {w,f};
}
async function wreck(killer,victim,options={}) {
  const battle=(await pool.query(`INSERT INTO fleet_battles(battle_type,status,winner_side,battle_started_at,ended_at,battle_summary)
    VALUES('pvp_duel',$1,'atk',NOW()-INTERVAL '10 seconds',NOW(),$2) RETURNING id`,[options.status||'ended',JSON.stringify(options.summary||{})])).rows[0].id;
  await pool.query(`INSERT INTO fleet_battle_participants(battle_id,fleet_id,wallet_address,side,ships_at_start) VALUES($1,$2,$3,'atk',1),($1,$4,$5,'def',1)`,[battle,killer.f,killer.w,victim.f,victim.w]);
  const ship=(await pool.query(`INSERT INTO ships(fleet_id,ship_type_code,owner_wallet,current_hp,max_hp,is_alive,destroyed_at,destroyed_reason,built_at,built_by_wallet)
    VALUES($1,'mcc_frg',$2,0,100,$3,NOW(),'battle',NOW(),$2) RETURNING id`,[victim.f,victim.w,options.alive||false])).rows[0].id;
  const id=(await pool.query(`INSERT INTO ship_wrecks(battle_id,ship_instance_id,ship_type,original_owner,killer_wallet,killer_side,victim_side,resources,expires_at)
    VALUES($1,$2,'mcc_frg',$3,$4,'atk','def',$5,NOW()+INTERVAL '1 hour') RETURNING id`,[battle,ship,victim.w,killer.w,JSON.stringify(options.resources||{iron_dust:80})])).rows[0].id;
  return {id,battle,ship};
}
async function main() {
  const limited=boundedDrops({iron_dust:1e12,gp:1e12,hull_plate:-1,rare_metal:'bad'});
  assert.deepEqual(limited.drops,[{code:'iron_dust',quantity:240}]);assert.equal(limited.capped,true);
  const killer=await user(),victim=await user(),ai=await user(true);
  const legit=await wreck(killer,victim);
  const quote=await quoteSalvage(killer.w,legit.id);assert.equal(quote.eligible,true);
  const claims=await Promise.allSettled(Array.from({length:4},()=>claimSalvage(killer.w,legit.id)));
  assert.equal(claims.filter(r=>r.status==='fulfilled').length,1);assert.equal(claims.filter(r=>r.status==='rejected'&&r.reason.message==='ALREADY_SALVAGED').length,3);
  const budget=await budgetState(killer.w);assert.equal(budget.used.iron_dust,80);assert.equal(budget.remaining.iron_dust,160);
  console.log('PASS one actual destroyed hull: 4 claims issue once; budget and inventory agree');
  const expected=[
    [await wreck(killer,ai),'PRACTICE_SALVAGE_FORBIDDEN'],
    [await wreck(killer,victim,{summary:{is_ai_battle:true}}),'PRACTICE_SALVAGE_FORBIDDEN'],
    [await wreck(killer,victim,{summary:{is_starter_battle:true,trusted_source:'starter_ops'}}),'PRACTICE_SALVAGE_FORBIDDEN'],
    [await wreck(killer,victim,{alive:true}),'HULL_NOT_LOST'],
    [await wreck(killer,victim,{status:'preparing'}),'UNSETTLED_LOSS']
  ];
  const starter=await wreck(killer,victim);
  await pool.query(`INSERT INTO starter_fleet_grants(wallet_address,grant_code,fleet_id) VALUES($1,'salvage_regression',$2)`,[victim.w,victim.f]);
  await pool.query(`INSERT INTO starter_fleet_grant_ships(ship_id,wallet_address,grant_code) VALUES($1,$2,'salvage_regression')`,[starter.ship,victim.w]);
  expected.push([starter,'STARTER_HULL_SALVAGE_FORBIDDEN']);
  const starterQuote=await quoteSalvage(killer.w,starter.id);assert.equal(starterQuote.eligible,false);assert.equal(starterQuote.error,'STARTER_HULL_SALVAGE_FORBIDDEN');
  const same=await user();const selfVictim={w:same.w,f:(await pool.query(`INSERT INTO fleets(owner_wallet,name,formation,movement) VALUES($1,'Self Test','wedge','advance') RETURNING id`,[same.w])).rows[0].id};
  expected.push([await wreck(same,selfVictim),'SELF_SALVAGE_FORBIDDEN',same.w]);
  for(const [fixture,error,wallet] of expected) {
    await assert.rejects(claimSalvage(wallet||killer.w,fixture.id),new RegExp(error));
    assert.equal((await pool.query(`SELECT salvaged_by FROM ship_wrecks WHERE id=$1`,[fixture.id])).rows[0].salvaged_by,null);
  }
  const clone=(await pool.query(`INSERT INTO ship_wrecks(battle_id,ship_instance_id,ship_type,original_owner,killer_wallet,killer_side,victim_side,resources,expires_at)
    SELECT battle_id,ship_instance_id,ship_type,original_owner,killer_wallet,killer_side,victim_side,resources,expires_at FROM ship_wrecks WHERE id=$1 RETURNING id`,[legit.id])).rows[0].id;
  await assert.rejects(claimSalvage(killer.w,clone),/HULL_ALREADY_SALVAGED/);
  assert.equal((await budgetState(killer.w)).used.iron_dust,80);
  console.log('PASS AI participant/practice/starter/free-starter-hull PvP/self/alive/unsettled/duplicate-source issuance blocked with killmail retained');
  const farmer=await user();const wrecks=[];for(let i=0;i<6;i++)wrecks.push(await wreck(farmer,victim));
  const concurrent=await Promise.allSettled(wrecks.map(w=>claimSalvage(farmer.w,w.id)));
  assert.equal(concurrent.filter(r=>r.status==='fulfilled').length,3);assert.equal(concurrent.filter(r=>r.status==='rejected'&&r.reason.message==='SALVAGE_DAILY_LIMIT').length,3);
  assert.equal((await budgetState(farmer.w)).used.iron_dust,DAILY_LIMITS.iron_dust);
  const inventory=(await pool.query(`SELECT quantity FROM user_resource_inventory i JOIN resources r ON r.id=i.resource_id WHERE i.wallet_address=$1 AND r.code='iron_dust'`,[farmer.w])).rows[0];assert.equal(Number(inventory.quantity),240);
  const failed=concurrent.findIndex(r=>r.status==='rejected');const capQuote=await quoteSalvage(farmer.w,wrecks[failed].id);assert.equal(capQuote.eligible,false);assert.equal(capQuote.error,'SALVAGE_DAILY_LIMIT');
  console.log('PASS concurrent different wrecks cannot exceed daily cap; exhausted wreck stays unclaimed');
  // Exercise exact registered routes through a temporary loopback HTTP server.
  process.env.JWT_SECRET=process.env.JWT_SECRET || 'local-salvage-regression-only';
  const express=require('express'),jwt=require('jsonwebtoken'),app=express();app.use(express.json());app.use('/api/killboard',require('../routes/killboard'));app.use('/api/ships',require('../routes/ships'));
  const server=await new Promise(resolve=>{const server=app.listen(0,'127.0.0.1',()=>resolve(server));});
  try {
    const target='http://127.0.0.1:'+server.address().port;
    const headers={Authorization:'Bearer '+jwt.sign({wallet_address:farmer.w},process.env.JWT_SECRET)};
    assert.equal((await fetch(target+'/api/ships/collection')).status,401);
    assert.equal((await fetch(target+'/api/killboard/salvage-policy')).status,401);
    const policy=await fetch(target+'/api/killboard/salvage-policy',{headers});assert.equal(policy.status,200);assert.equal((await policy.json()).remaining.iron_dust,0);
    const denied=await fetch(target+'/api/killboard/'+wrecks[failed].id+'/salvage',{method:'POST',headers});assert.equal(denied.status,429);assert.equal((await denied.json()).error,'SALVAGE_DAILY_LIMIT');
    const starterDenied=await fetch(target+'/api/killboard/'+starter.id+'/salvage',{method:'POST',headers:{Authorization:'Bearer '+jwt.sign({wallet_address:killer.w},process.env.JWT_SECRET)}});assert.equal(starterDenied.status,409);assert.equal((await starterDenied.json()).error,'STARTER_HULL_SALVAGE_FORBIDDEN');
    const odds=await fetch(target+'/api/ships/crates',{headers});assert.equal(odds.status,200);const body=await odds.json();assert.ok(body.crates.find(c=>c.code==='legendary_crate').disclosure.quality_odds.legendary===6);
    const collection=await fetch(target+'/api/ships/collection?wallet='+victim.w,{headers});assert.equal(collection.status,200);assert.equal((await collection.json()).collection.length,0);
    console.log('PASS HTTP auth, JWT collection identity, actual paid crate disclosure and cap 429 response');
  } finally {await new Promise(resolve=>server.close(resolve));}
}
main().then(()=>pool.end()).then(()=>process.exit(0)).catch(async e=>{console.error(e);await pool.end();process.exit(1);});
