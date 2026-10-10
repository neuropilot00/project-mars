#!/usr/bin/env node
const assert=require('node:assert/strict'),crypto=require('node:crypto');
const url=new URL(process.env.DATABASE_URL||'');
if(!['localhost','127.0.0.1'].includes(url.hostname)||url.pathname!=='/codex_occupy_review_upgrade_20261010')throw Error('Exact local upgrade clone required');
const {pool}=require('../db'),{completeBuildJob}=require('../services/ship');
const tag='build-cap-'+crypto.randomBytes(6).toString('hex');pool.options.application_name=tag;
const type='qa_'+crypto.randomBytes(6).toString('hex'),wallets=[0,1].map(()=>'0x'+crypto.randomBytes(20).toString('hex')),jobs=[];
let locker,pending;
(async()=>{
  // Inactive isolated catalog fixture is invisible to crates and player blueprint discovery.
  await pool.query(`INSERT INTO ship_types SELECT (jsonb_populate_record(NULL::ship_types,to_jsonb(st)||jsonb_build_object('code',$1::text,'max_per_server',1,'max_per_player',NULL,'is_active',false))).* FROM ship_types st WHERE code='mcc_frg'`,[type]);
  for(const w of wallets){
    await pool.query("INSERT INTO users(wallet_address,nickname,faction_code,is_test_account) VALUES($1,'Build cap QA','mcc',true)",[w]);
    const job=(await pool.query("INSERT INTO ship_build_jobs(wallet_address,ship_type_code,started_at,completes_at,gp_cost,minerals_used) VALUES($1,$2,NOW()-INTERVAL '1 hour',NOW()-INTERVAL '1 second',0,'{}') RETURNING id",[w,type])).rows[0];jobs.push(job.id);
  }
  locker=await pool.connect();await locker.query('BEGIN');await locker.query('SELECT pg_advisory_xact_lock(hashtext($1))',['shipbuild:'+type]);
  pending=Promise.all(jobs.map(j=>completeBuildJob(j)));
  let waiting=0;
  for(let i=0;i<100&&waiting<2;i++){
    waiting=(await pool.query("SELECT COUNT(*)::int n FROM pg_stat_activity WHERE application_name=$1 AND wait_event_type='Lock' AND query LIKE '%pg_advisory_xact_lock%'",[tag])).rows[0].n;
    if(waiting<2)await new Promise(r=>setTimeout(r,20));
  }
  assert.equal(waiting,2,'Both real build completions must wait on the same cap lock used by crates');
  assert.equal((await pool.query('SELECT COUNT(*)::int n FROM ships WHERE ship_type_code=$1',[type])).rows[0].n,0);
  await locker.query('COMMIT');locker.release();locker=null;
  const results=await pending;pending=null;
  assert.equal(results.filter(r=>r.success).length,1);assert.equal(results.filter(r=>r.completion_failed).length,1);
  assert.equal((await pool.query('SELECT COUNT(*)::int n FROM ships WHERE ship_type_code=$1 AND is_alive',[type])).rows[0].n,1);
  assert.deepEqual((await pool.query('SELECT status FROM ship_build_jobs WHERE id=ANY($1::bigint[]) ORDER BY status',[jobs])).rows.map(j=>j.status),['completed','refunded']);
  console.log('PASS real concurrent build completions wait on shared shipbuild cap lock; one hull, one closed/refunded job, catalog cap preserved');
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{
  if(locker){await locker.query('ROLLBACK');locker.release();}
  if(pending)await pending.catch(()=>{});
  await pool.query('DELETE FROM ship_build_jobs WHERE id=ANY($1::bigint[])',[jobs]);
  await pool.query('DELETE FROM ships WHERE ship_type_code=$1',[type]);
  await pool.query('DELETE FROM fleets WHERE owner_wallet=ANY($1::text[])',[wallets]);
  await pool.query('DELETE FROM ship_collection WHERE ship_type_code=$1',[type]);
  await pool.query('DELETE FROM users WHERE wallet_address=ANY($1::text[])',[wallets]);
  await pool.query('DELETE FROM ship_types WHERE code=$1',[type]);await pool.end();
});
