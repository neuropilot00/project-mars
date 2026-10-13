#!/usr/bin/env node
'use strict';
// Real service SQL/locks and authenticated HTTP in disposable shadow tables only.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const { Pool } = require('pg');
const url = new URL(process.env.DATABASE_URL || '');
if (!['localhost', '127.0.0.1'].includes(url.hostname) || url.pathname !== '/codex_occupy_review_upgrade_20261010') throw Error('Exact disposable local review DB required');
const schema = 'campaign_qa_' + crypto.randomBytes(6).toString('hex');
const admin = new Pool({ connectionString: url.href });
const pool = new Pool({ connectionString: url.href, options: '-c search_path=' + schema + ',public', max: 20 });
const tables = ['users','campaign_chapters','campaign_sessions','player_campaign_progress','player_reputation','player_chapter_choices','reputation_history','campaign_reward_inbox','player_lore_flags','player_branch_modifiers','chapter_branch_modifiers','player_tags','user_titles','player_environment_mastery','ships','fleets','ship_types','resources','user_resource_inventory','item_types','user_items','transactions','claims','marketplace_listings','fleet_battles','fleet_battle_participants','ship_stat_upgrade_log','territory_upgrades'];
const checks = [];
let server;
async function account() {
  const wallet = '0x' + crypto.randomBytes(20).toString('hex');
  await pool.query("INSERT INTO users(wallet_address,nickname,faction_code,rank_level,gp_balance,xp) VALUES($1,'Campaign QA','mcc',10,0,0)", [wallet]);
  return wallet;
}
async function row(wallet, quest) { return (await pool.query('SELECT * FROM player_campaign_progress WHERE wallet=$1 AND quest_id=$2', [wallet, quest])).rows[0]; }
async function reputation(wallet, faction) { return Number((await pool.query('SELECT value FROM player_reputation WHERE wallet=$1 AND faction=$2', [wallet, faction])).rows[0]?.value || 0); }
(async () => {
  await admin.query('CREATE SCHEMA ' + schema);
  for (const table of tables) {
    await admin.query(`CREATE TABLE ${schema}.${table} (LIKE public.${table} INCLUDING ALL)`);
    const columns = (await admin.query("SELECT column_name FROM information_schema.columns WHERE table_schema=$1 AND table_name=$2 AND column_default LIKE 'nextval(%'", [schema, table])).rows;
    for (const column of columns) {
      const sequence = `${schema}.${table}_${column.column_name}_qa_seq`;
      await admin.query('CREATE SEQUENCE ' + sequence);
      await admin.query(`ALTER TABLE ${schema}.${table} ALTER COLUMN ${column.column_name} SET DEFAULT nextval('${sequence}')`);
    }
  }
  await pool.query('INSERT INTO campaign_chapters SELECT * FROM public.campaign_chapters');
  await pool.query("INSERT INTO ship_types SELECT * FROM public.ship_types WHERE code IN ('mcc_int','mcc_frg')");
  const dbPath = require.resolve('../db');
  require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: {
    pool, ensureUser: async (client, wallet) => client.query('INSERT INTO users(wallet_address) VALUES($1) ON CONFLICT DO NOTHING', [wallet]),
    awardXP: async (client, wallet, amount) => client.query('UPDATE users SET xp=COALESCE(xp,0)+$1 WHERE wallet_address=$2', [amount,wallet]),
    notifyPlayer: async () => {}, logGPActivity: async () => {},
  } };
  const dailyPath = require.resolve('../routes/dailyOps');
  require.cache[dailyPath] = { id: dailyPath, filename: dailyPath, loaded: true, exports: { notifyMissionProgress: async () => {} } };
  const campaign = require('../services/campaign');
  const servicePath = require.resolve('../services/campaign');
  const moduleStub = { exports: {} };
  vm.runInNewContext(fs.readFileSync(servicePath,'utf8') + '\nmodule.exports.__audit={CHAPTERS,simulateChapter,simulateCh1,calculateRewards,campaignShipRewardPlan};', {
    require: name => name === '../db' ? require('../db') : require(name), module: moduleStub, console,
    __dirname: path.dirname(servicePath), Buffer, Date,
  }, { filename: servicePath });
  const audit = moduleStub.exports.__audit;
  assert.equal(Object.keys(audit.CHAPTERS).length,38);
  let catalogChoices=0;
  for(const [questId,chapter] of Object.entries(audit.CHAPTERS)) {
    assert.equal(chapter.questId,questId);
    if(chapter.prerequisiteChapter)assert.ok(audit.CHAPTERS[chapter.prerequisiteChapter],questId+' prerequisite exists');
    const choices=chapter.choices.length?chapter.choices:[null];
    for(const choice of choices) {
      const progress={wallet:'catalog_qa',session_id:'catalog_'+questId,quest_id:questId,choices_payload:choice?[{choice_id:choice.id}]:[]};
      const sim=audit.simulateChapter(progress);
      assert.equal(typeof sim.success,'boolean',questId+' simulation result');
      assert.ok(sim.metrics&&typeof sim.metrics==='object',questId+' simulation metrics');
      const reward=audit.calculateRewards(progress,sim);
      assert.ok(Number.isFinite(reward.GP)&&Number.isFinite(reward.XP),questId+' numeric rewards');
      for(const next of reward.unlocks||[])assert.ok(audit.CHAPTERS[next],questId+' reward target exists: '+next);
      if(choice)catalogChoices++;
    }
  }
  checks.push('All 38 chapter definitions and '+catalogChoices+' choice simulations have valid prerequisites, metrics, numeric rewards and unlock targets (catalog coverage, not real fleet battles)');
  const fixture = { wallet:'qa',session_id:'qa',quest_id:'mcc_campaign_ch1',choices_payload:[{choice_id:'ch1_tactical'}] };
  assert.deepEqual(JSON.parse(JSON.stringify(audit.simulateChapter(fixture))), JSON.parse(JSON.stringify(audit.simulateCh1(fixture))));
  assert.equal(audit.campaignShipRewardPlan('mcc_int',1)[0], 'mcc_int');
  checks.push('MCC Ch1 dispatch returns oxygen/combat metrics and rewards map to the real interceptor catalog');
  for (const choice of audit.CHAPTERS.mcc_campaign_ch4.choices) {
    const outcomes=Array.from({length:500},(_,i)=>audit.simulateChapter({wallet:'qa',session_id:'reachability_'+i,quest_id:'mcc_campaign_ch4',choices_payload:[{choice_id:choice.id}]}));
    assert.ok(outcomes.some(result=>result.success&&result.metrics.helion_escapes===0),'Ch4 must be completable for '+choice.id);
    assert.ok(outcomes.some(result=>!result.success),'Ch4 still retains failure outcomes for '+choice.id);
  }
  checks.push('Every MCC Ch4 choice has both reachable success and failure outcomes instead of a guaranteed story dead end');

  const hiddenWallet=await account(),otherWallet=await account();
  const routeChapters=['mcc_campaign_ch1','fsp_campaign_ch1','cv_campaign_ch1'];
  async function gateStatus(missing) {
    const status=await campaign.getStatus(hiddenWallet);
    assert.ok(status.lockedChapters.includes('hidden_campaign_ch1'));
    assert.ok(!status.availableChapters.includes('hidden_campaign_ch1'));
    const result=await campaign.startChapter(hiddenWallet,'hidden_campaign_ch1');
    assert.equal(result.error,'PREREQUISITE_NOT_MET');
    assert.deepEqual(result.missingChapters,missing);
    assert.equal(await row(hiddenWallet,'hidden_campaign_ch1'),undefined);
  }
  await gateStatus(routeChapters);
  await pool.query("INSERT INTO player_campaign_progress(wallet,quest_id,campaign_id,chapter_number,status) VALUES($1,'mcc_campaign_ch2','mcc_route',2,'completed')",[hiddenWallet]);
  for(const quest of routeChapters) {
    await pool.query("INSERT INTO player_campaign_progress(wallet,quest_id,campaign_id,chapter_number,status) VALUES($1,$2,$3,1,'completed')",[otherWallet,quest,audit.CHAPTERS[quest].campaignId]);
  }
  await gateStatus(routeChapters);
  for(const [index,quest] of routeChapters.entries()) {
    await pool.query("INSERT INTO player_campaign_progress(wallet,quest_id,campaign_id,chapter_number,status) VALUES($1,$2,$3,1,$4)",[hiddenWallet,quest,audit.CHAPTERS[quest].campaignId,index===0?'claimed':index===1?'completed':'failed']);
    await gateStatus(routeChapters.slice(index+1).concat(index===2?[quest]:[]));
  }
  await pool.query("UPDATE player_campaign_progress SET status='in_progress' WHERE wallet=$1 AND quest_id='cv_campaign_ch1'",[hiddenWallet]);
  await gateStatus(['cv_campaign_ch1']);
  await pool.query("UPDATE player_campaign_progress SET status='completed' WHERE wallet=$1 AND quest_id='cv_campaign_ch1'",[hiddenWallet]);
  assert.ok((await campaign.getStatus(hiddenWallet)).availableChapters.includes('hidden_campaign_ch1'));
  const hiddenStarts=await Promise.all(Array.from({length:4},()=>campaign.startChapter(hiddenWallet,'hidden_campaign_ch1')));
  assert.equal(new Set(hiddenStarts.map(result=>result.sessionId)).size,1);
  assert.ok(hiddenStarts[0].sessionId);
  await pool.query('DELETE FROM player_campaign_progress WHERE wallet=$1 AND quest_id=ANY($2)',[hiddenWallet,routeChapters]);
  assert.equal((await campaign.startChapter(hiddenWallet,'hidden_campaign_ch1')).sessionId,hiddenStarts[0].sessionId);
  await campaign.abandon(hiddenWallet,hiddenStarts[0].sessionId);
  assert.ok((await campaign.getStatus(hiddenWallet)).availableChapters.includes('hidden_campaign_ch1'));
  const hiddenRetry=await campaign.startChapter(hiddenWallet,'hidden_campaign_ch1');
  assert.ok(hiddenRetry.sessionId);assert.notEqual(hiddenRetry.sessionId,hiddenStarts[0].sessionId);
  for(const status of ['completed','claimed']) {
    await pool.query('UPDATE player_campaign_progress SET status=$1 WHERE wallet=$2 AND quest_id=$3',[status,hiddenWallet,'hidden_campaign_ch1']);
    const existing=await campaign.startChapter(hiddenWallet,'hidden_campaign_ch1');
    assert.equal(existing.alreadyCompleted,true);assert.equal(existing.sessionId,hiddenRetry.sessionId);
  }
  checks.push('Hidden Ch1 requires the exact MCC/FSP/CV Ch1 completed or claimed rows on the same wallet; missing/failed/active routes, another wallet and Ch2 cannot bypass it; status agrees, concurrent entry shares one session, and admitted resume/retry/completed rights survive');

  const epilogueWallet=await account();
  await pool.query("INSERT INTO player_campaign_progress(wallet,quest_id,campaign_id,chapter_number,status) VALUES($1,'hidden_campaign_ch4','hidden_route',4,'completed')",[epilogueWallet]);
  const epilogue=await campaign.startChapter(epilogueWallet,'hidden_campaign_ch5');
  const epilogueDone=await campaign.complete(epilogueWallet,epilogue.sessionId);
  assert.equal(epilogueDone.success,true);
  assert.equal((await row(epilogueWallet,'hidden_campaign_ch5')).choices_payload.length,0);
  assert.ok(epilogueDone.rewards.tags.includes('the_observer'));
  const hiddenScene=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../../docs/campaign-story/hidden_ch5_last_observation.json'),'utf8'));
  assert.equal(hiddenScene.scenes.filter(scene=>['choice','branch'].includes(scene.type)).length,0);
  assert.equal(hiddenScene.scenes.at(-1).type,'ending');
  checks.push('Hidden Ch5 cinematic epilogue completes with no choice and grants the observer tag; its story contains no choice/branch scenes and ends with an ending scene');

  const cvFailedWallet=await account();
  await pool.query("INSERT INTO player_campaign_progress(wallet,quest_id,campaign_id,chapter_number,status) VALUES($1,'cv_campaign_ch1','cv_route',1,'failed')",[cvFailedWallet]);
  for(let chapter=1;chapter<=9;chapter++) {
    const quest='cv_campaign_ch'+chapter;
    assert.deepEqual(Array.from(audit.calculateRewards({quest_id:quest}, {success:false}).unlocks),[]);
    const successReward=audit.calculateRewards({quest_id:quest}, {success:true,metrics:{}});
    assert.deepEqual(Array.from(successReward.unlocks),['cv_campaign_ch'+(chapter+1)]);
  }
  const cvNext=await campaign.startChapter(cvFailedWallet,'cv_campaign_ch2');
  assert.equal(cvNext.error,'PREREQUISITE_NOT_MET');
  checks.push('CV Ch1-9 failure rewards declare no next-chapter unlock; success metadata is preserved and failed prerequisites still reject admission');

  const a = await account(), b = await account();
  let p = await campaign.startChapter(a,'mcc_prologue');
  assert.equal((await campaign.complete(a,p.sessionId)).success,true);
  const started = await Promise.all(Array.from({length:4},()=>campaign.startChapter(a,'mcc_campaign_ch1')));
  assert.equal(new Set(started.map(x=>x.sessionId)).size,1);
  let sid = started[0].sessionId;
  await campaign.choose(a,sid,'ch1_tactical');
  const afterChoice = await reputation(a,'mcc');
  assert.equal(afterChoice,8);
  await Promise.all([campaign.choose(a,sid,'ch1_tactical'),campaign.choose(a,sid,'ch1_moral_concern'),campaign.startChapter(a,'mcc_campaign_ch1')]);
  assert.equal((await row(a,'mcc_campaign_ch1')).session_id,sid);
  assert.equal(await reputation(a,'mcc'),afterChoice);
  assert.equal(await reputation(a,'fsp'),0);
  await campaign.abandon(a,sid);
  p = await campaign.startChapter(a,'mcc_campaign_ch1');
  assert.notEqual(p.sessionId,sid);sid=p.sessionId;
  assert.equal(p.progress.choices[0].choice_id,'ch1_tactical');
  await campaign.choose(a,sid,'ch1_moral_concern');
  assert.equal(await reputation(a,'mcc'),afterChoice);
  assert.equal(await reputation(a,'fsp'),0);
  checks.push('Concurrent starts resume one session; repeat and contradictory choices cannot replay effects; failed retries preserve committed choices');

  await campaign.abandon(a,sid);
  await pool.query("UPDATE player_campaign_progress SET choices_payload='[]' WHERE wallet=$1 AND quest_id='mcc_campaign_ch1'",[a]);
  p=await campaign.startChapter(a,'mcc_campaign_ch1');sid=p.sessionId;
  assert.equal(p.progress.choices[0].choice_id,'ch1_tactical');
  await pool.query("UPDATE player_campaign_progress SET choices_payload='[]' WHERE wallet=$1 AND quest_id='mcc_campaign_ch1'",[a]);
  await campaign.choose(a,sid,'ch1_moral_concern');
  assert.equal((await row(a,'mcc_campaign_ch1')).choices_payload[0].choice_id,'ch1_tactical');
  assert.equal((await pool.query('SELECT COUNT(*)::int n FROM player_chapter_choices WHERE wallet=$1',[a])).rows[0].n,1);
  assert.equal(await reputation(a,'fsp'),0);
  checks.push('Older cleared payloads recover the durable earliest choice receipt without changing earned balances or flags');

  await pool.query("INSERT INTO player_campaign_progress(wallet,quest_id,campaign_id,chapter_number,status) VALUES($1,'mcc_campaign_ch5','mcc_route',5,'completed')",[b]);
  await pool.query("INSERT INTO player_reputation(wallet,faction,value) VALUES($1,'mcc',50) ON CONFLICT(wallet,faction) DO UPDATE SET value=50",[b]);
  let branch=await campaign.startChapter(b,'mcc_campaign_ch6');
  await campaign.choose(b,branch.sessionId,'ch6_help_lifang');
  // The permanent choice lowers reputation below the entry requirement, yet resume/retry remains valid.
  assert.equal((await campaign.startChapter(b,'mcc_campaign_ch6')).sessionId,branch.sessionId);
  await campaign.abandon(b,branch.sessionId);
  branch=await campaign.startChapter(b,'mcc_campaign_ch6');
  for(const alternative of ['ch6_report_chen','ch6_copy_silent']) {
    const result=await campaign.choose(b,branch.sessionId,alternative);
    assert.equal(result.progress.choices[0].choice_id,'ch6_help_lifang');
  }
  const branches=(await pool.query('SELECT modifier_id FROM player_branch_modifiers WHERE wallet=$1 ORDER BY modifier_id',[b])).rows.map(x=>x.modifier_id);
  assert.deepEqual(branches,['ending_3_locked_in','mcc_route_a_active']);
  assert.equal(await reputation(b,'mcc'),0);assert.equal(await reputation(b,'fsp'),30);
  assert.equal((await pool.query('SELECT COUNT(*)::int n FROM player_chapter_choices WHERE wallet=$1',[b])).rows[0].n,1);
  checks.push('MCC Ch6 A/B/C retry attempts retain exactly the original route, tags and reputation, even below the entry reputation gate');

  const express=require('express'),jwt=require('jsonwebtoken');
  process.env.JWT_SECRET='campaign-regression-local-only';
  const app=express();app.use(express.json());app.use('/api',require('../routes/campaignRoutes'));
  server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});
  const base='http://127.0.0.1:'+server.address().port;
  async function post(route,body,wallet) {
    const headers={'content-type':'application/json'};
    if(wallet)headers.authorization='Bearer '+jwt.sign({wallet_address:wallet},process.env.JWT_SECRET);
    const response=await fetch(base+'/api'+route,{method:'POST',headers,body:JSON.stringify(body)});
    return {status:response.status,data:await response.json()};
  }
  assert.equal((await post('/campaign/start',{quest_id:'mcc_prologue'})).status,401);
  assert.equal((await post('/campaign/choice',{session_id:sid,choice_id:'ch1_moral_concern',wallet:a},b)).status,400);
  assert.equal((await post('/campaign/complete',{session_id:sid,wallet:a},b)).status,404);
  const resumed=await post('/campaign/start',{quest_id:'mcc_campaign_ch1',wallet:b},a);
  assert.equal(resumed.status,200);assert.equal(resumed.data.sessionId,sid);
  assert.equal(await row(b,'mcc_campaign_ch1'),undefined);
  checks.push('Mounted HTTP routes require JWT and use token ownership instead of a supplied wallet');

  await pool.query("INSERT INTO claims(owner,center_lat,center_lng,width,height,total_paid,image_url) VALUES($1,0,0,1,1,0,'qa.png')",[a]);
  await pool.query("INSERT INTO transactions(type,from_wallet,meta) VALUES('mining',$1,'{}')",[a]);
  for(let i=0;i<100;i++) {
    const candidate='campaign_seed_'+i;
    if(audit.simulateChapter({...fixture,wallet:a,session_id:candidate}).metrics.oxygen_recovery_pct===100){
      await pool.query('UPDATE campaign_sessions SET session_id=$1 WHERE session_id=$2',[candidate,sid]);
      await pool.query("UPDATE player_campaign_progress SET session_id=$1,started_at=NOW()-INTERVAL '2 minutes' WHERE session_id=$2",[candidate,sid]);
      sid=candidate;break;
    }
  }
  const completed=await Promise.all([campaign.complete(a,sid),campaign.complete(a,sid)]);
  assert.equal(completed.filter(x=>x.success===true).length,1);
  assert.equal(completed.filter(x=>x.error==='SESSION_NOT_FOUND').length,1);
  const gp=Number((await pool.query('SELECT gp_balance FROM users WHERE wallet_address=$1',[a])).rows[0].gp_balance);
  assert.equal(gp,20000);
  assert.equal((await row(a,'mcc_campaign_ch1')).metrics_payload.oxygen_recovery_pct,100);
  const inbox=(await pool.query("SELECT * FROM campaign_reward_inbox WHERE wallet=$1 AND reward_code='mcc_int'",[a])).rows;
  assert.equal(inbox.length,1);
  assert.equal((await post('/campaign/reward/claim',{reward_id:inbox[0].id,wallet:a},b)).status,404);
  // Force the real INSERT to fail, proving that entitlement/claim receipt rolls back.
  await pool.query(`ALTER TABLE ships ADD CONSTRAINT qa_reject_ship CHECK(owner_wallet <> '${a}')`);
  await assert.rejects(campaign.claimReward(a,inbox[0].id),/qa_reject_ship/);
  assert.equal((await pool.query('SELECT claimed FROM campaign_reward_inbox WHERE id=$1',[inbox[0].id])).rows[0].claimed,false);
  await pool.query('ALTER TABLE ships DROP CONSTRAINT qa_reject_ship');
  const claimed=await Promise.all([campaign.claimReward(a,inbox[0].id),campaign.claimReward(a,inbox[0].id)]);
  assert.equal(claimed.filter(x=>x.success===true).length,1);
  assert.equal(claimed.filter(x=>x.error==='REWARD_NOT_FOUND').length,1);
  const ships=(await pool.query('SELECT ship_type_code,current_hp,max_hp,fleet_id FROM ships WHERE owner_wallet=$1',[a])).rows;
  assert.equal(ships.length,1);assert.equal(ships[0].ship_type_code,'mcc_int');assert.equal(ships[0].current_hp,ships[0].max_hp);assert.ok(ships[0].fleet_id);
  assert.equal((await pool.query("SELECT COUNT(*)::int n FROM transactions WHERE from_wallet=$1 AND meta->>'source'='campaign_reward_claim'",[a])).rows[0].n,1);
  await pool.query('UPDATE users SET rank_level=1 WHERE wallet_address=$1',[a]);
  assert.equal((await campaign.startChapter(a,'mcc_campaign_ch1')).alreadyCompleted,true);
  assert.equal(Number((await pool.query('SELECT gp_balance FROM users WHERE wallet_address=$1',[a])).rows[0].gp_balance),gp);
  checks.push('Real concurrent completion grants GP and inbox once; failed ship grant rolls back; concurrent claims mint one full-HP interceptor and one receipt');

  await pool.query('UPDATE users SET rank_level=10 WHERE wallet_address=$1',[a]);
  const cvPrologue=await campaign.startChapter(a,'cv_prologue');
  assert.equal((await campaign.complete(a,cvPrologue.sessionId)).success,true);
  const cvMission=await campaign.startChapter(a,'cv_campaign_ch1');
  await campaign.choose(a,cvMission.sessionId,'cv_ch1_refuse');
  let cvFailureSeed;
  for(let i=0;i<100;i++) {
    const candidate='cv_failure_'+i;
    if(!audit.simulateChapter({wallet:a,session_id:candidate,quest_id:'cv_campaign_ch1',choices_payload:[{choice_id:'cv_ch1_refuse'}]}).success) {cvFailureSeed=candidate;break;}
  }
  assert.ok(cvFailureSeed);
  await pool.query('UPDATE campaign_sessions SET session_id=$1 WHERE session_id=$2',[cvFailureSeed,cvMission.sessionId]);
  await pool.query("UPDATE player_campaign_progress SET session_id=$1,started_at=NOW()-INTERVAL '2 minutes' WHERE session_id=$2",[cvFailureSeed,cvMission.sessionId]);
  const cvFailure=await campaign.complete(a,cvFailureSeed);
  assert.equal(cvFailure.success,false);assert.equal(cvFailure.nextChapterUnlocked,null);
  assert.deepEqual(cvFailure.rewards.unlocks,[]);
  const cvFailedProgress=await row(a,'cv_campaign_ch1');
  assert.equal(cvFailedProgress.status,'failed');assert.deepEqual(cvFailedProgress.rewards_payload.unlocks,[]);
  assert.deepEqual(cvFailure.progress.rewards.unlocks,[]);
  assert.equal((await campaign.startChapter(a,'cv_campaign_ch2')).error,'PREREQUISITE_NOT_MET');
  checks.push('Real CV failure completion response, progress and saved rewards all omit next-chapter unlock; Ch2 remains locked under the existing completed-prerequisite rule');
  console.log(JSON.stringify({ok:true,checks,chapterCount:Object.keys(audit.CHAPTERS).length},null,2));
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{
  if(server)await new Promise(resolve=>server.close(resolve));
  await pool.end();await admin.query('DROP SCHEMA IF EXISTS '+schema+' CASCADE');await admin.end();
});
