#!/usr/bin/env node
'use strict';
// Real Express handlers + HTTP with an in-memory ledger. No game DB or production writes.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const express=require('express'),crypto=require('node:crypto');
const files=name=>fs.readFileSync(path.resolve(__dirname,'../',name),'utf8');
const ledger={balance:0,receipts:0,crashActive:true,minesActive:true,hiloActive:true},queries=[];
let accesses=0,configReads=0;
const db={getSetting:async()=>{configReads++;return 'true';},getSettings:async()=>({}),awardXP:async()=>{},pool:{async connect(){accesses++;return {query,release(){}};},query}};
async function query(sql,args=[]){accesses++;const text=sql.replace(/\s+/g,' ').trim();queries.push(text);
 if(['BEGIN','COMMIT','ROLLBACK'].includes(text))return {rows:[]};
 if(text.includes('FROM user_active_effects'))return {rows:[]};
 if(text.includes("FROM crash_rounds WHERE status = 'running'"))return {rows:[{id:1,started_at:new Date(Date.now()-20000),crash_point:10}]};
 if(text.includes('FROM crash_bets')&&text.includes('FOR UPDATE'))return {rows:ledger.crashActive?[{id:1,bet_amount:10,currency:'PP'}]:[]};
 if(text.includes('FROM mines_games')&&text.includes('FOR UPDATE'))return {rows:ledger.minesActive?[{id:2,bet_amount:10,currency:'PP',current_multiplier:1.5,revealed:'[0]',grid:'["gem","gem"]'}]:[]};
 if(text.includes('FROM hilo_games')&&text.includes('FOR UPDATE'))return {rows:ledger.hiloActive?[{id:3,wallet:'alice',bet_amount:10,currency:'PP',current_multiplier:2,cards:'[{"value":2},{"value":3}]'}]:[]};
 if(text.startsWith('UPDATE users')){ledger.balance+=args[0];return {rows:[],rowCount:1};}
 if(text.startsWith('UPDATE crash_bets')){ledger.crashActive=false;return {rows:[],rowCount:1};}
 if(text.startsWith('UPDATE mines_games')){ledger.minesActive=false;return {rows:[],rowCount:1};}
 if(text.startsWith('UPDATE hilo_games')){ledger.hiloActive=false;return {rows:[],rowCount:1};}
 if(text.startsWith('INSERT INTO transactions')){ledger.receipts++;return {rows:[],rowCount:1};}
 if(text.startsWith('SELECT pp_balance as bal'))return {rows:[{bal:ledger.balance}]};
 if(text.startsWith('SELECT'))return {rows:[]};
 throw Error('Unexpected SQL: '+text);
}
const jwt={verify:token=>{if(token!=='valid')throw Error('invalid');return {wallet:'alice'};}};
function load(relative,extras={}){const module={exports:{}};vm.runInNewContext(files(relative),{module,exports:module.exports,console,process,Set,Date,Math,Number,String,JSON,Buffer,require(id){if(id==='../db')return db;if(id==='express')return express;if(id==='crypto')return crypto;if(id==='jsonwebtoken')return jwt;if(id==='express-rate-limit')return ()=> (_req,_res,next)=>next();if(id in extras)return extras[id];throw Error('Optional dependency excluded: '+id);}}, {filename:relative});return module.exports;}
async function main(){
 const spells=load('services/spells.js');const app=express();app.use(express.json());app.use('/arena',load('routes/arena.js'));app.use(load('routes/spells.js',{'../services/spells':spells}));
 const server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});
 async function request(url,body={},token='valid'){const response=await fetch('http://127.0.0.1:'+server.address().port+url,{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(body)});return {status:response.status,data:await response.json()};}
 try{
  for(const endpoint of ['/crash/bet','/mines/start','/coinflip/play','/dice/play','/hilo/start','/CRASH/BET/']){
   const before=JSON.stringify(ledger),access=accesses,reads=configReads;
   const response=await request('/arena'+endpoint,{wallet:'victim',amount:10,currency:'PP',mines:3});assert.equal(response.status,410);assert.equal(response.data.code,'CASINO_NEW_STAKES_RETIRED');assert.equal(accesses,access,'Retired stake cannot read/write ledger');assert.equal(configReads,reads,'Retirement happens before config');assert.equal(JSON.stringify(ledger),before);
  }
  for(const token of [null,'bad']){const response=await request('/arena/crash/bet',{amount:10},token);assert.equal(response.status,401);}
  for(const type of ['flood','bless','not-real']){const before=accesses;const response=await request('/spells/cast',{claimId:7,spellType:type});assert.equal(response.status,410);assert.equal(response.data.code,'SPELL_EFFECTS_UNAVAILABLE');assert.equal(accesses,before);}
  await assert.rejects(spells.castSpell('alice',7,'goldmine'),error=>error.code==='SPELL_EFFECTS_UNAVAILABLE');
  const spellCfg=await spells.getCfg();assert.equal(spellCfg.enabled,false);assert.equal(spellCfg.retiredReason,'SPELL_EFFECTS_UNAVAILABLE');
  const crash=await request('/arena/crash/cashout',{multiplier:2});assert.equal(crash.status,200);assert.equal(crash.data.payout,20);
  const mines=await request('/arena/mines/cashout',{gameId:2});assert.equal(mines.status,200);assert.equal(mines.data.payout,15);
  const hilo=await request('/arena/hilo/cashout',{gameId:3});assert.equal(hilo.status,200);assert.equal(hilo.data.payout,20);
  assert.equal(ledger.balance,55);assert.equal(ledger.receipts,2);
  for(const [url,body] of [['/arena/crash/cashout',{multiplier:2}],['/arena/mines/cashout',{gameId:2}],['/arena/hilo/cashout',{gameId:3}]])assert.notEqual((await request(url,body)).status,410);
  assert.equal(ledger.balance,55,'Repeated legacy cashout cannot pay twice');
  for(const [url,body] of [['/arena/crash/start',{}],['/arena/mines/reveal',{gameId:99,position:0}],['/arena/hilo/guess',{gameId:99,guess:'high'}]])assert.notEqual((await request(url,body)).status,410,'Legacy round progress route remains reachable');
  for(const url of ['/arena/crash/history','/arena/mines/active','/arena/coinflip/history','/arena/hilo/active','/spells/my','/spells/claim/7']){const response=await fetch('http://127.0.0.1:'+server.address().port+url,{headers:{Authorization:'Bearer valid'}});assert.equal(response.status,200,url);}
  console.log('PASS retired side loops HTTP: 6 case/trailing-slash stake paths 410 before any DB/config access; JWT denial; all spell types 410 before charge; historical crash/mines/hilo payouts 55 PP exactly once; start/reveal/guess/history/active/spell records retained.');
 }finally{await new Promise(resolve=>server.close(resolve));}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
