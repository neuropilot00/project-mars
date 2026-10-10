#!/usr/bin/env node
// Fixtures are intentionally retained in the disposable review database.
const assert=require('node:assert/strict'),crypto=require('node:crypto');
if(!/^codex_occupy_review_/.test(new URL(process.env.DATABASE_URL).pathname.slice(1)))throw Error('Disposable review database required');
const target=process.env.TARGET_URL||'http://127.0.0.1:3187';
if(!['127.0.0.1','localhost'].includes(new URL(target).hostname))throw Error('Local test server required');
const {pool}=require('../db'),jwt=require('jsonwebtoken');
const {openCrate,listCrates}=require('../services/shipCrate');
const {ensureAiFleets}=require('../services/aiFleetManager');
async function user(){const w='0x'+crypto.randomBytes(20).toString('hex');await pool.query("INSERT INTO users(wallet_address,nickname,faction_code,gp_balance,pp_balance,rank_level,level) VALUES($1,'Regression Test','mcc',100000,10000,20,20)",[w]);return w;}
async function main(){
 const w=await user(),draws=await Promise.all(Array.from({length:5},()=>openCrate(w,'recruit_crate')));
 assert.equal(draws.filter(x=>x.success).length,1);assert.equal(draws.filter(x=>x.error==='DAILY_LIMIT_REACHED').length,4);
 assert.equal((await listCrates(w)).crates.find(x=>x.code==='recruit_crate').daily_remaining,0);
 console.log('PASS daily quota: 5 concurrent calls = 1 ship, 4 rejections, 0 remaining');
 const attacker=await user(),defender=await user();
 await pool.query('INSERT INTO pixels(lat,lng,owner,price) VALUES(66,176,$1,0.02) ON CONFLICT(lat,lng) DO UPDATE SET owner=$1,price=0.02',[defender]);
 const token=jwt.sign({wallet:attacker},process.env.JWT_SECRET,{expiresIn:'5m'});
 const r=await fetch(target+'/api/claim',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({lat:66,lng:176,width:1,height:1,payMethod:'pp'})}),body=await r.json();
 assert.equal(r.status,409,JSON.stringify(body));assert.equal(body.error,'FLEET_HIJACK_REQUIRED');
 const state=(await pool.query('SELECT (SELECT owner FROM pixels WHERE lat=66 AND lng=176) owner,pp_balance FROM users WHERE wallet_address=$1',[attacker])).rows[0];
 assert.equal(state.owner,defender);assert.equal(Number(state.pp_balance),10000);
 console.log('PASS territory conflict: battle required, owner and balance unchanged');
 const newcomer=await user();
 await pool.query("INSERT INTO user_onboarding(wallet_address,current_step) VALUES($1,2)",[newcomer]);
 await pool.query('DELETE FROM pixels WHERE lat=66 AND lng=175.78');
 async function claim(wallet,lng){return fetch(target+'/api/claim',{method:'POST',signal:AbortSignal.timeout(10000),headers:{'Content-Type':'application/json',Authorization:'Bearer '+jwt.sign({wallet},process.env.JWT_SECRET,{expiresIn:'5m'})},body:JSON.stringify({lat:66,lng,width:1,height:1,payMethod:'pp'})});}
 const first=await claim(newcomer,175.78),firstBody=await first.json();
 assert.equal(first.status,200,JSON.stringify(firstBody));
 const progress=(await pool.query('SELECT current_step, tutorial_claim_id, pp_rewarded FROM user_onboarding WHERE wallet_address=$1',[newcomer])).rows[0];
 assert.equal(progress.current_step,3);assert.equal(Number(progress.tutorial_claim_id),firstBody.claimId);assert.equal(progress.pp_rewarded,true);
 console.log('PASS first claim: committed ownership and tutorial reward finish without a lock wait');
 const competitors=await Promise.all(Array.from({length:4},user));
 for(const wallet of competitors)await pool.query('INSERT INTO user_onboarding(wallet_address,current_step,skipped) VALUES($1,5,true)',[wallet]);
 await pool.query('DELETE FROM pixels WHERE lat=66 AND lng=175.56');
 const claims=await Promise.all(competitors.map(async wallet=>{const r=await claim(wallet,175.56);return {wallet,status:r.status,body:await r.json()};}));
 assert.equal(claims.filter(r=>r.status===200).length,1,JSON.stringify(claims));
 assert.equal(claims.filter(r=>r.status===409).length,3,JSON.stringify(claims));
 const winner=claims.find(r=>r.status===200).wallet;
 assert.equal((await pool.query('SELECT owner FROM pixels WHERE lat=66 AND lng=175.56')).rows[0].owner,winner);
 for(const result of claims.filter(r=>r.status!==200))assert.equal(Number((await pool.query('SELECT pp_balance FROM users WHERE wallet_address=$1',[result.wallet])).rows[0].pp_balance),10000);
 console.log('PASS simultaneous claims: one owner, three conflicts, losing balances unchanged');
 const a=await fetch(target+'/api/review-nonexistent'),b=await fetch(target+'/api/review-nonexistent');
 assert.equal(a.status,404);assert.equal(b.status,404);assert.equal(Number(a.headers.get('ratelimit-remaining'))-Number(b.headers.get('ratelimit-remaining')),1);
 console.log('PASS limiter: one request consumes one quota unit');
 await ensureAiFleets();
 const fixture=(await pool.query("SELECT f.id,u.wallet_address FROM fleets f JOIN users u ON u.wallet_address=f.owner_wallet WHERE u.is_ai AND u.wallet_address LIKE '0xAI00mccE0000%' LIMIT 1")).rows[0];
 assert.ok(fixture,'Easy AI fixture missing');
 await pool.query('UPDATE fleets SET is_in_battle=false WHERE id=$1',[fixture.id]);
 await pool.query('UPDATE ships SET is_alive=false,current_hp=0 WHERE fleet_id=$1',[fixture.id]);
 const before=await pool.query('SELECT id,ship_id FROM fleet_battle_events WHERE ship_id IS NOT NULL ORDER BY id');
 await pool.query("UPDATE users SET ai_respawn_at=NOW()-INTERVAL '1 hour' WHERE is_ai=true");
 const respawns=await Promise.all([ensureAiFleets(),ensureAiFleets()]);
 assert.equal(respawns.reduce((n,r)=>n+r.created,0),1);
 const after=await pool.query('SELECT id,ship_id FROM fleet_battle_events WHERE ship_id IS NOT NULL ORDER BY id');assert.deepEqual(after.rows,before.rows);
 const alive=await pool.query('SELECT count(*)::int FROM ships WHERE fleet_id=$1 AND is_alive',[fixture.id]);assert.equal(alive.rows[0].count,8);
 console.log('PASS AI respawn: two concurrent callers restore exactly 8 ships once, '+before.rowCount+' event references preserved');
}
main().then(()=>pool.end()).then(()=>process.exit(0)).catch(async e=>{console.error(e);await pool.end();process.exit(1)});
