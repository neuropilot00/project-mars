'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../routes/userBaseRoutes.js'),'utf8');
function fixture(balance,{missing=false,rankFails=false}={}){
 const routes=[],reads=[];
 const row={wallet_address:'0xfixture',nickname:'Mobile QA',usdt_balance:'1.25',pp_balance:'2.5',gp_balance:balance,xp:7,rank_level:2,referral_code:'FIXTURE',created_at:'2026-10-21T00:00:00.000Z'};
 const pool={async query(sql,args){
  reads.push({sql,args});
  if(sql.includes('FROM users')){
   // Model SQL projection so a missing gp_balance SELECT cannot be masked by a
   // fixture returning extra columns that the real driver would never return.
   const columns=sql.slice(sql.indexOf('SELECT ')+7,sql.indexOf(' FROM users')).split(',').map(value=>value.trim());
   return{rows:missing?[]:[Object.fromEntries(columns.map(column=>[column,row[column]]))]};
  }
  if(sql.includes('FROM pixels'))return{rows:[{sector_id:4,sector_name:'Frontier',tier:'frontier',pixel_count:'25'}]};
  if(sql.includes('FROM user_mining'))return{rows:[]};
  if(sql.includes('FROM rank_definitions'))return{rows:[{level:2,name:'Settler',required_xp:5,reward_pp:'0'}]};
  throw Error('Unexpected query '+sql);
 }};
 const context={module:{exports:{}},console:{error:(...args)=>assert.fail(args.join(' '))},Date,require(name){
  if(name==='express')return{Router:()=>({get:(url,handler)=>routes.push({url,handler})})};
  if(name==='../db')return{pool};
  if(name==='../utils/settingsCache')return{cfg:async()=>({})};
  if(name==='../services/rank')return{recalcUserRank:async()=>{if(rankFails)throw Error('fixture rank unavailable');}};
  throw Error('Unexpected dependency '+name);
 }};
 vm.runInNewContext(source,context,{filename:'userBaseRoutes.js'});
 const response={statusCode:200,status(value){this.statusCode=value;return this;},json(value){this.body=value;return this;}};
 return{row,reads,response,async request(){await routes.find(route=>route.url==='/user/:wallet/base').handler({params:{wallet:'0xFiXtUrE'}},response);return response;}};
}
test('actual BASE route returns numeric current GP for85→88 after harvest and preserves other user fields',async()=>{
 for(const balance of ['85','88','88.125']){
  const f=fixture(balance),res=await f.request();assert.equal(res.statusCode,200);assert.equal(typeof res.body.user.gp,'number');assert.equal(res.body.user.gp,Number(balance));
  assert.equal(res.body.user.wallet,'0xfixture');assert.equal(res.body.user.nickname,f.row.nickname);assert.equal(res.body.user.usdt,1.25);assert.equal(res.body.user.pp,2.5);assert.equal(res.body.user.xp,7);assert.equal(res.body.user.rank,2);assert.equal(res.body.user.referralCode,'FIXTURE');assert.equal(res.body.user.joinedAt,f.row.created_at);
  assert.equal(res.body.territory.totalPixels,25);assert.equal(res.body.territory.bySector[0].pixels,25);assert.equal(res.body.mining.harvestAvailable,true);assert.equal(res.body.ranks[0].name,'Settler');
  assert.equal(f.reads.filter(read=>read.sql.includes('FROM users')).length,1);assert.equal(f.reads[0].args[0],'0xfixture');assert.equal(f.reads.length,4);assert.ok(f.reads.every(read=>/^\s*SELECT\b/.test(read.sql)));
 }
});
test('BASE GP handles zero/null and remains available when optional rank refresh fails',async()=>{
 for(const balance of ['0',0,null]){const res=await fixture(balance,{rankFails:true}).request();assert.equal(res.statusCode,200);assert.equal(res.body.user.gp,0);}
});
test('unknown BASE account keeps existing404 contract',async()=>{
 const res=await fixture('88',{missing:true}).request();assert.equal(res.statusCode,404);assert.equal(res.body.error,'User not found');
});
