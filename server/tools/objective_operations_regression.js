#!/usr/bin/env node
const assert=require('node:assert/strict'),crypto=require('node:crypto');
if(!/^codex_occupy_review_/.test(new URL(process.env.DATABASE_URL).pathname.slice(1)))throw Error('Disposable review database required');
const {pool}=require('../db');const ops=require('../services/objectiveOperations');
async function commander(count=3,shipsPerFleet=2) {
  const wallet='0x'+crypto.randomBytes(20).toString('hex');await pool.query(`INSERT INTO users(wallet_address,nickname,faction_code,gp_balance,rank_level,level) VALUES($1,'Objective Regression','mcc',10000,20,20)`,[wallet]);
  const type=(await pool.query(`SELECT * FROM ship_types WHERE code='mcc_frg'`)).rows[0],fleets=[];
  for(let i=0;i<count;i++) {
    const fleet=(await pool.query(`INSERT INTO fleets(owner_wallet,name,formation,movement) VALUES($1,$2,'wedge','advance') RETURNING id`,[wallet,'작전 함대 '+(i+1)])).rows[0];fleets.push(String(fleet.id));
    for(let j=0;j<shipsPerFleet;j++) await pool.query(`INSERT INTO ships(fleet_id,ship_type_code,owner_wallet,current_hp,max_hp,is_alive,is_flagship,built_by_wallet) VALUES($1,'mcc_frg',$2,$3,$3,true,$4,$2)`,[fleet.id,wallet,type.base_hp,j===0]);
  }
  return {wallet,fleets};
}
function fixture(kind) {
  const config={kind,playerFleetIds:['1'],targetShipId:'20',targetFleetId:'2',convoyShipId:'30',convoyFleetId:'3',positions:{},deadlineSeconds:150,holdTargetSeconds:90,
    zone:{cx:500,cy:220,radius:100},route:{start:{cx:200,cy:220},end:{cx:500,cy:220},durationSeconds:120}};
  const state={tick:0,liveTickMs:120,fleets:[{id:1,side:'atk',cx:500,cy:220,ships:[{id:10,isAlive:true,hp:32000}]},
    {id:2,side:'def',cx:900,cy:220,ships:[{id:20,isAlive:true,hp:15000}]}, {id:3,side:'atk',cx:200,cy:220,ships:[{id:30,isAlive:true,hp:28000}]}]};
  ops.initObjective(state,config);return state;
}
async function main() {
  const hold=fixture('hold');let winner;
  for(let tick=0;tick<750;tick++){hold.tick=tick;winner=ops.evaluateObjective(hold);assert.deepEqual(ops.evaluateObjective(hold),winner);}assert.equal(winner.winner_side,'atk');assert.equal(winner.progress.hold_seconds,90);
  const contested=fixture('hold');contested.fleets[1].cx=500;
  for(let tick=0;tick<1250;tick++){contested.tick=tick;winner=ops.evaluateObjective(contested);}assert.equal(winner.winner_side,'def');assert.equal(winner.progress.hold_seconds,0);
  const escort=fixture('escort');for(let tick=0;tick<1000;tick++){escort.tick=tick;ops.beforeTick(escort);winner=ops.evaluateObjective(escort);}assert.equal(winner.winner_side,'atk');assert.equal(escort.fleets[2].cx,500);
  const lost=fixture('escort');lost.fleets[2].ships[0].isAlive=false;assert.equal(ops.evaluateObjective(lost).progress.reason,'convoy_lost');
  const flag=fixture('flagship');flag.fleets[1].ships[0].isAlive=false;assert.equal(ops.evaluateObjective(flag).progress.reason,'flagship_destroyed');
  console.log('PASS 120ms authoritative pace: hold90s/contesteddeadline150s/escort120s/flagshiptarget; duplicate evaluation does not speed progress');

  const p=await commander(),wrong=await commander(1,1),requestKey=crypto.randomUUID();
  await assert.rejects(ops.createOperation(p.wallet,'hold',{fleetIds:wrong.fleets,requestKey:crypto.randomUUID()},{dispatch:false}),/FLEET_NOT_FOUND/);
  await pool.query(`INSERT INTO ship_mining_jobs(wallet_address,fleet_id,ends_at,status) VALUES($1,$2,NOW()+INTERVAL '1 hour','mining')`,[p.wallet,p.fleets[0]]);
  await assert.rejects(ops.createOperation(p.wallet,'hold',{fleetIds:[p.fleets[0]],requestKey:crypto.randomUUID()},{dispatch:false}),/FLEET_MINING/);
  await pool.query(`UPDATE ship_mining_jobs SET status='completed' WHERE wallet_address=$1`,[p.wallet]);
  const concurrent=await Promise.all(Array.from({length:4},()=>ops.createOperation(p.wallet,'hold',{fleetIds:p.fleets,requestKey},{dispatch:false})));
  assert.equal(concurrent.filter(r=>!r.reused).length,1);assert.equal(new Set(concurrent.map(r=>r.battleId)).size,1);
  const battleId=concurrent[0].battleId,battle=(await pool.query(`SELECT * FROM fleet_battles WHERE id=$1`,[battleId])).rows[0];
  const config=await ops.loadRegisteredObjective(pool,battle);assert.equal(config.kind,'hold');
  const actual=(await pool.query(`SELECT COUNT(*)::int AS count FROM fleet_battle_participants WHERE battle_id=$1`,[battleId])).rows[0];assert.equal(actual.count,5);
  const npcStats=(await pool.query(`SELECT s.current_hp,s.max_hp,s.bonus_atk,s.bonus_hp,st.base_hp FROM ships s JOIN ship_types st ON st.code=s.ship_type_code JOIN users u ON u.wallet_address=s.owner_wallet JOIN fleet_battle_participants p ON p.fleet_id=s.fleet_id WHERE p.battle_id=$1 AND u.is_objective_npc`,[battleId])).rows;
  assert.ok(npcStats.length>0);for(const s of npcStats){assert.equal(Number(s.current_hp),Number(s.base_hp));assert.equal(Number(s.max_hp),Number(s.base_hp));assert.equal(Number(s.bonus_atk),0);assert.equal(Number(s.bonus_hp),0);}
  await assert.rejects(ops.loadRegisteredObjective(pool,{...battle,battle_summary:{is_objective_operation:true,is_ai_battle:true,trusted_source:'client'}}),/OBJECTIVE_NPC_REQUIRES_REGISTERED_BATTLE/);
  await assert.rejects(ops.getRun(wrong.wallet,battleId),/OPERATION_NOT_FOUND/);
  await assert.rejects(ops.createOperation(p.wallet,'flagship',{fleetIds:p.fleets,requestKey},{dispatch:false}),/REQUEST_KEY_REUSED/);
  console.log('PASS owned/mining guards; 4 identical starts create one registered 5-fleet battle; real full catalog NPC stats; forged source and wrong owner rejected');
  const engine=require('../services/battleEngine');
  const results=[];
  for(const mode of ['hold','escort','flagship']) {
    let owner,run;
    if(mode==='hold'){owner=p;run=concurrent[0];}
    else {owner=await commander(mode==='escort'?2:3,2);run=await ops.createOperation(owner.wallet,mode,{fleetIds:owner.fleets,requestKey:crypto.randomUUID()},{dispatch:false});}
    const balanceBefore=Number((await pool.query(`SELECT gp_balance FROM users WHERE wallet_address=$1`,[owner.wallet])).rows[0].gp_balance);
    await pool.query(`UPDATE fleet_battles SET status='active',battle_started_at=NOW() WHERE id=$1`,[run.battleId]);
    const result=await engine.simulateBattle(run.battleId);
    assert.ok(result.objective_result||result.objective,'Engine objective hook required');
    const progress=result.objective_result||result.objective;
    assert.ok(progress.complete);assert.ok(progress.elapsed_seconds<=150);assert.ok(result.timeline.frames.some(f=>f.objective));
    await engine.applyBattleResults(run.battleId,result);
    const stored=await ops.getRun(owner.wallet,run.battleId);assert.ok(['succeeded','failed'].includes(stored.run.status));
    const protection=(await pool.query(`SELECT b.battle_summary,s.is_alive,s.current_hp,s.max_hp FROM fleet_battles b JOIN fleet_battle_participants p ON p.battle_id=b.id JOIN ships s ON s.fleet_id=p.fleet_id WHERE b.id=$1 AND LOWER(s.owner_wallet)=$2`,[run.battleId,owner.wallet])).rows;
    assert.ok(protection.every(s=>s.is_alive&&Number(s.current_hp)>0));assert.equal(protection[0].battle_summary.combat_policy.permanent_loss,false);
    assert.equal(Number((await pool.query(`SELECT gp_balance FROM users WHERE wallet_address=$1`,[owner.wallet])).rows[0].gp_balance),balanceBefore);
    assert.equal((await pool.query(`SELECT COUNT(*)::int AS count FROM ship_wrecks WHERE battle_id=$1`,[run.battleId])).rows[0].count,0);
    assert.equal((await pool.query(`SELECT COUNT(*)::int AS count FROM fleet_battle_rewards WHERE battle_id=$1`,[run.battleId])).rows[0].count,0);
    const before=stored.run.settled_at;await engine.applyBattleResults(run.battleId,result);assert.deepEqual((await ops.getRun(owner.wallet,run.battleId)).run.settled_at,before);
    results.push({mode,battleId:run.battleId,winner:result.winner_side,reason:progress.reason,elapsed_seconds:progress.elapsed_seconds,fleets:result.timeline.fleets_meta.length});
  }
  console.log('PASS three actual server simulations + committed objective results, permanent loss off, 0 GP/reward/wreck mint, repeat settlement unchanged');
  console.log('ACTUAL_OBJECTIVE_RESULTS',JSON.stringify(results));
  process.env.JWT_SECRET=process.env.JWT_SECRET||crypto.randomBytes(32).toString('hex');
  const express=require('express'),jwt=require('jsonwebtoken'),app=express();app.use(express.json());app.use('/api',require('../routes/objectiveOperations'));
  const server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});
  try {
    const root='http://127.0.0.1:'+server.address().port+'/api/objective-ops';
    assert.equal((await fetch(root)).status,401);
    const headers={Authorization:'Bearer '+jwt.sign({wallet_address:p.wallet},process.env.JWT_SECRET)};
    const response=await fetch(root+'?wallet='+wrong.wallet,{headers}),data=await response.json();
    assert.equal(response.status,200);assert.equal(data.catalog.length,3);assert.ok(data.fleets.every(f=>p.fleets.includes(String(f.id))));
    assert.equal(data.policy.permanent_loss,false);assert.equal(data.policy.currency_rewards,false);
    assert.equal((await fetch(root+'/runs/'+battleId,{headers:{Authorization:'Bearer '+jwt.sign({wallet_address:wrong.wallet},process.env.JWT_SECRET)}})).status,404);
    assert.equal((await fetch(root+'/flagship/start',{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({fleetIds:wrong.fleets,requestKey:crypto.randomUUID(),is_ai_battle:true,trusted_source:'objective_ops'})})).status,404);
    console.log('PASS actual HTTP catalog authentication, JWT identity, private run ownership and forged POST rejection');
  } finally {await new Promise(resolve=>server.close(resolve));}
  if(process.argv.includes('--live')) {
    const liveResults=await Promise.all(['hold','escort','flagship'].map(async mode=>{
      const owner=await commander(mode==='escort'?2:3,2),run=await ops.createOperation(owner.wallet,mode,{fleetIds:owner.fleets,requestKey:crypto.randomUUID()},{dispatch:false});
      await pool.query(`UPDATE fleet_battles SET status='active',battle_started_at=NOW() WHERE id=$1`,[run.battleId]);
      const started=Date.now();let frames=0;
      const result=await engine.simulateBattleLive(run.battleId,{tickMs:200,wallClockMs:160000,onFrame:frame=>{if(frame.objective)frames++;}});
      const wallSeconds=Math.round((Date.now()-started)/100)/10,progress=result.objective_result;
      assert.ok(progress.complete);assert.ok(frames>0);assert.ok(progress.elapsed_seconds>=90&&progress.elapsed_seconds<=150);assert.ok(wallSeconds>=89&&wallSeconds<=155);
      await engine.applyBattleResults(run.battleId,result);
      return {mode,battleId:run.battleId,winner:result.winner_side,reason:progress.reason,objective_seconds:progress.elapsed_seconds,wall_seconds:wallSeconds,frames};
    }));
    console.log('ACTUAL_LIVE_OBJECTIVE_RESULTS',JSON.stringify(liveResults));
  }
}
main().then(()=>pool.end()).then(()=>process.exit(0)).catch(async e=>{console.error(e);await pool.end();process.exit(1);});
