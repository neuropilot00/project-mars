#!/usr/bin/env node
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const url = new URL(process.env.DATABASE_URL || '');
if (!['localhost','127.0.0.1'].includes(url.hostname) || !/^\/codex_occupy_(review_)?upgrade_/.test(url.pathname)) throw Error('Isolated local upgrade DB required');
process.env.JWT_SECRET ||= crypto.randomBytes(32).toString('hex');delete process.env.REDIS_URL;
const express=require('express'),jwt=require('jsonwebtoken');
const db=require('../db');
// Local test configuration only: exercise actual scheduler/engine without a minutes-long live loop.
// Never update the shared database's runtime mode.
const readSetting=db.getSetting;
db.getSetting=(key,fallback)=>key==='fleet_realtime_mode'?Promise.resolve('off'):readSetting(key,fallback);
const {pool}=db,duels=require('../services/fleetDuelInvitations');
const app=express();app.set('trust proxy','loopback');app.use(express.json());app.use('/api/battles',require('../routes/fleetBattles'));
const wallets=[0,1].map(()=>'0x'+crypto.randomBytes(20).toString('hex')),fleets=[],added=[];
let server,base,reqNo=0,passes=0;
async function request(wallet,path,body) {
  const res=await fetch(base+path,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json','X-Forwarded-For':'192.0.2.'+(++reqNo%250+1),...(wallet?{Authorization:'Bearer '+jwt.sign({wallet_address:wallet},process.env.JWT_SECRET)}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});
  return {status:res.status,data:await res.json()};
}
async function create(mode='standard_v1') {return request(wallets[0],'/duel-invitations',{my_fleet_id:fleets[0],target_fleet_id:fleets[1],mode,standard_ruleset:mode});}
async function discard() {await pool.query("UPDATE fleet_duel_invitations SET status='declined' WHERE inviter_wallet=$1 AND status='pending'",[wallets[0]]);}
async function check(name,fn) {await fn();passes++;console.log('PASS '+name);}
async function ships() {return (await pool.query('SELECT * FROM ships WHERE fleet_id=ANY($1::bigint[]) ORDER BY id',[fleets])).rows;}
async function assets() {
  return {ships:await ships(),users:(await pool.query('SELECT wallet_address,gp_balance,pp_balance,usdt_balance,xp,total_actions,hijack_count FROM users WHERE wallet_address=ANY($1::text[]) ORDER BY wallet_address',[wallets])).rows,
    fleets:(await pool.query('SELECT id,total_kills,battles_won,battles_lost,formation,movement,auto_retreat_pct,formation_spread FROM fleets WHERE id=ANY($1::bigint[]) ORDER BY id',[fleets])).rows,
    parts:(await pool.query('SELECT * FROM ship_part_cards WHERE wallet_address=ANY($1::text[]) ORDER BY id',[wallets])).rows};
}
(async()=>{
  server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});base='http://127.0.0.1:'+server.address().port+'/api/battles';
  for(const w of wallets) await pool.query("INSERT INTO users(wallet_address,nickname,gp_balance,pp_balance,level,rank_level,is_test_account,faction_code) VALUES($1,'Standard QA',100000,1000,10,10,true,'mcc')",[w]);
  const type=(await pool.query("SELECT * FROM ship_types WHERE code='mcc_dst' AND is_active")).rows[0];
  for(let i=0;i<2;i++) {
    fleets.push(String((await pool.query("INSERT INTO fleets(owner_wallet,name,formation) VALUES($1,$2,'line') RETURNING id",[wallets[i],'Standard '+i])).rows[0].id));
    await pool.query(`INSERT INTO ships(fleet_id,owner_wallet,ship_type_code,current_hp,max_hp,quality,upgrade_level,bonus_atk,bonus_def,bonus_hp,bonus_speed,shield_hp,shield_max)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$8,$8,$9,$10,$10)`,[fleets[i],wallets[i],type.code,i?456:123,type.base_hp,i?'common':'legendary',i?0:10,i?0:100000,i?0:5,i?0:500]);
  }
  const fittedShip=(await ships()).find(s=>s.owner_wallet===wallets[0]);
  await pool.query("INSERT INTO ship_part_cards(wallet_address,part_code,slot,level,ship_id) VALUES($1,'rail_amp','weapon',3,$2)",[wallets[0],fittedShip.id]);
  await check('unknown mode rejected and ordinary invitation retains explicit permanent loss risk',async()=>{
    assert.equal((await create('forged')).status,400);const normal=await create('normal');assert.equal(normal.status,201);assert.equal(normal.data.invitation.loss_terms.permanent_ship_loss_possible,true);await discard();
  });
  await check('capital or assembled hull cannot enter standard budget',async()=>{
    const original=(await ships())[0].ship_type_code;
    for(const size of ['battleship','assembled']) {
      const code=(await pool.query('SELECT code FROM ship_types WHERE is_active AND size_class=$1 ORDER BY code LIMIT 1',[size])).rows[0].code;
      await pool.query('UPDATE ships SET ship_type_code=$2 WHERE fleet_id=$1',[fleets[0],code]);assert.equal((await create()).data.error,'STANDARD_HULL_INELIGIBLE');
    }
    await pool.query('UPDATE ships SET ship_type_code=$2 WHERE fleet_id=$1',[fleets[0],original]);
  });
  await check('six ships rejected even inside cost budget',async()=>{
    for(let i=0;i<5;i++) added.push((await pool.query('INSERT INTO ships(fleet_id,owner_wallet,ship_type_code,current_hp,max_hp) VALUES($1,$2,$3,100,100) RETURNING id',[fleets[0],wallets[0],type.code])).rows[0].id);
    assert.equal((await create()).data.error,'STANDARD_SHIP_LIMIT');await pool.query('DELETE FROM ships WHERE id=ANY($1::bigint[])',[added]);added.length=0;
  });
  await check('positive catalog cost sum above 5000 rejected',async()=>{
    const logi=(await pool.query("SELECT code FROM ship_types WHERE code='fsp_logi_crs'")).rows[0].code;
    const originals=await ships();await pool.query('UPDATE ships SET ship_type_code=$2 WHERE fleet_id=$1',[fleets[0],logi]);
    const extra=(await pool.query("INSERT INTO ships(fleet_id,owner_wallet,ship_type_code,current_hp,max_hp) VALUES($1,$2,'fsp_dst',100,100) RETURNING id",[fleets[0],wallets[0]])).rows[0].id;
    assert.equal((await create()).data.error,'STANDARD_BUDGET_EXCEEDED');await pool.query('DELETE FROM ships WHERE id=$1',[extra]);await pool.query('UPDATE ships SET ship_type_code=$2 WHERE fleet_id=$1',[fleets[0],originals[0].ship_type_code]);
  });
  let invitation,battleId,config;
  await check('both sides see exact budget and six accepts create one trusted standard registration',async()=>{
    const before=await assets();const made=await create();assert.equal(made.status,201,JSON.stringify(made));invitation=made.data.invitation;
    assert.equal(invitation.mode,'standard_v1');assert.equal(invitation.loss_terms.permanent_ship_loss_possible,false);
    assert.deepEqual(invitation.loss_terms.standard.fleet_budgets.map(b=>b.catalog_budget),[500,500]);
    assert.equal((await request(wallets[1],'/duel-invitations')).data.invitations[0].mode,'standard_v1');
    const accept=()=>request(wallets[1],'/duel-invitations/'+invitation.id+'/accept',{terms_token:invitation.terms_token,accept_loss_terms:true,mode:'normal'});
    const rs=await Promise.all(Array.from({length:6},accept));assert.equal(rs.filter(r=>r.status===200).length,1);assert.equal(rs.filter(r=>r.status===409).length,5);
    battleId=rs.find(r=>r.status===200).data.battle_id;config=await duels.getAcceptedStandardDuel(battleId);
    assert.equal(config.invitationId,String(invitation.id));assert.equal(Object.keys(config.catalogByShipId).length,2);assert.deepEqual(await assets(),before);
  });
  await check('forged standard summary and participant registration mismatch fail closed',async()=>{
    await pool.query("UPDATE fleet_battles SET battle_summary=jsonb_set(battle_summary,'{standard_ruleset}','\"fake\"') WHERE id=$1",[battleId]);
    await assert.rejects(duels.getAcceptedStandardDuel(battleId),/STANDARD_DUEL_REGISTRATION_MISMATCH/);
    await pool.query("UPDATE fleet_battles SET battle_summary=jsonb_set(battle_summary,'{standard_ruleset}','\"standard_v1\"') WHERE id=$1",[battleId]);
    await pool.query("UPDATE fleet_battle_participants SET wallet_address=$2 WHERE battle_id=$1 AND side='def'",[battleId,wallets[0]]);
    await assert.rejects(duels.getAcceptedStandardDuel(battleId),/STANDARD_DUEL_REGISTRATION_MISMATCH/);
    await pool.query("UPDATE fleet_battle_participants SET wallet_address=$2 WHERE battle_id=$1 AND side='def'",[battleId,wallets[1]]);
    assert.ok(await duels.getAcceptedStandardDuel(battleId));
  });
  if(process.env.STANDARD_ENGINE_READY==='1') {
    await check('crate draw during accepted standard duel uses a separate idle fleet and preserves registration',async()=>{
      const before=await ships();const draw=await require('../services/shipCrate').openCrate(wallets[0],'recruit_crate');
      assert.equal(draw.success,true,JSON.stringify(draw));assert.deepEqual(await ships(),before);
      const spawned=(await pool.query('SELECT fleet_id FROM ships WHERE id=$1',[draw.ship.id])).rows[0];
      assert.ok(spawned.fleet_id);assert.ok(!fleets.includes(String(spawned.fleet_id)));
      assert.ok(await duels.getAcceptedStandardDuel(battleId));
    });
    await check('actual standard simulation ignores paid quality/upgrades and settlement preserves every hull/asset',async()=>{
      const before=await assets();const scheduler=require('../services/battleScheduler');const engine=require('../services/battleEngine');
      const original=Math.random;let result,replay;Math.random=()=>0.5;
      try {result=await scheduler.runBattle(battleId);replay=await engine.simulateBattle(battleId);} finally {Math.random=original;}
      assert.ok(result);assert.equal(result.stats.by_ship.length,2);
      for(const ship of result.stats.by_ship) {
        assert.equal(ship.bonus_atk,0);assert.equal(ship.bonus_def,0);assert.equal(ship.bonus_hp,0);assert.equal(ship.bonus_speed,0);
        assert.equal(ship.max_hp,type.base_hp);assert.deepEqual(ship.part_effects,[]);
        // The shared battlefield can modify catalog stats equally; paid metadata cannot.
        assert.deepEqual(ship.combat_stats,result.stats.by_ship[0].combat_stats);
      }
      assert.equal((await pool.query('SELECT COUNT(*)::int n FROM commander_actions WHERE battle_id=$1',[battleId])).rows[0].n,0);
      assert.deepEqual(replay.stats,result.stats);assert.deepEqual(await assets(),before);
      await Promise.all([engine.applyBattleResults(battleId,result),scheduler.runBattle(battleId)]);
      assert.deepEqual(await assets(),before);
      const economic=(await pool.query('SELECT COUNT(*)::int n FROM fleet_battle_rewards WHERE battle_id=$1',[battleId])).rows[0];assert.equal(economic.n,0);
      const wrecks=(await pool.query('SELECT COUNT(*)::int n FROM ship_wrecks WHERE battle_id=$1',[battleId])).rows[0];assert.equal(wrecks.n,0);
      const hp=(await pool.query('SELECT hp_at_start FROM fleet_battle_participants WHERE battle_id=$1',[battleId])).rows;
      assert.ok(hp.every(p=>Number(p.hp_at_start)===Number(type.base_hp)));
    });
    await check('HTTP personal stats and recommended wins exclude registered standard results, retain ordinary wins',async()=>{
      await pool.query('UPDATE fleets SET cpi=10 WHERE id=ANY($1::bigint[])',[fleets]);
      const recommended=async()=>{
        const r=await request(null,'/recommended-opponents/'+wallets[1]);
        assert.equal(r.status,200);return r.data.opponents.find(o=>o.wallet===wallets[0]);
      };
      const clean=(await request(null,'/my-stats/'+wallets[0])).data.stats;
      assert.equal(clean.total_battles,0);assert.equal(clean.total_ships_destroyed,0);assert.equal(clean.total_ships_lost,0);assert.equal(clean.longest_win_streak,0);assert.deepEqual(clean.faction_win_rates,{});
      assert.equal((await recommended()).wins,0);
      const normal=(await create('normal')).data.invitation;
      const accepted=await request(wallets[1],'/duel-invitations/'+normal.id+'/accept',{terms_token:normal.terms_token,accept_loss_terms:true});
      assert.equal(accepted.status,200);
      // An isolated fixture result tests aggregate SQL without risking real ordinary hull losses.
      await pool.query("UPDATE fleet_battles SET status='ended',winner_side='atk',ended_at=NOW(),atk_ships_lost=0,def_ships_lost=4 WHERE id=$1",[accepted.data.battle_id]);
      await pool.query('UPDATE fleets SET is_in_battle=false,current_battle_id=NULL WHERE id=ANY($1::bigint[])',[fleets]);
      const stats=(await request(null,'/my-stats/'+wallets[0])).data.stats;
      assert.equal(stats.total_battles,1);assert.equal(stats.wins,1);assert.equal(stats.losses,0);assert.equal(stats.total_ships_destroyed,4);
      assert.equal(stats.longest_win_streak,1);assert.equal(stats.favorite_formation,'line');assert.equal(stats.faction_win_rates.mcc,1);assert.equal((await recommended()).wins,1);
    });
  }
  console.log(JSON.stringify({passed:passes,failed:0,engine_checked:process.env.STANDARD_ENGINE_READY==='1',database:url.pathname.slice(1)}));
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{
  try {
    await pool.query('UPDATE fleets SET is_in_battle=false,current_battle_id=NULL WHERE id=ANY($1::bigint[])',[fleets]);
    const removed=await pool.query('DELETE FROM fleet_duel_invitations WHERE inviter_wallet=$1 RETURNING battle_id',[wallets[0]]);
    for(const r of removed.rows) if(r.battle_id) await pool.query('DELETE FROM fleet_battles WHERE id=$1',[r.battle_id]);
    await pool.query('DELETE FROM ships WHERE owner_wallet=ANY($1::text[])',[wallets]);await pool.query('DELETE FROM fleets WHERE owner_wallet=ANY($1::text[])',[wallets]);await pool.query('DELETE FROM ship_part_cards WHERE wallet_address=ANY($1::text[])',[wallets]);await pool.query('DELETE FROM ship_crate_pulls WHERE wallet=ANY($1::text[])',[wallets]);await pool.query('DELETE FROM ship_crate_pity WHERE wallet=ANY($1::text[])',[wallets]);await pool.query('DELETE FROM users WHERE wallet_address=ANY($1::text[])',[wallets]);
  } finally {if(server) await new Promise(resolve=>server.close(resolve));await pool.end();}
});
