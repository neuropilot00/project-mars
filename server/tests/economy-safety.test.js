'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
function service(name,db){const module={exports:{}};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../services/'+name+'.js'),'utf8'),{module,exports:module.exports,console:{log(){},warn(){},error(){}},require(request){if(request==='../db')return db;throw Error('Blocked fixture dependency: '+request);}},{filename:name+'.js'});return module.exports;}
const noDb={pool:{connect:async()=>{throw Error('Unexpected database mutation');}},getSetting:async(_key,fallback)=>fallback};
test('both auction entry services reject nonfinite/negative buyout configuration before escrow',async()=>{
 const modern=service('auctionCombat',noDb),legacy=service('auction',noDb);
 for(const amount of [-1,Infinity,'NaN']){
  await assert.rejects(modern.createAuction('seller',{listing_type:'resource',start_price:1,buyout_price:amount}),/INVALID_BUYOUT_PRICE/);
  assert.equal((await legacy.createAuction('seller',{itemType:'resource',startPrice:1,buyoutPrice:amount})).error,'invalid_buyout_price');
 }
 for(const amount of [NaN,Infinity,0,-1])await assert.rejects(modern.placeBid('buyer',1,amount),/INVALID_BID_AMOUNT/);
});
test('completed resource claim rolls back before returning its pooled connection',async()=>{
 const calls=[];const client={query:async(sql)=>{calls.push(sql);return {rows:sql.includes('SELECT *')?[{status:'completed'}]:[]};},release(){calls.push('release');}};
 const s=service('resourceCraft',{pool:{connect:async()=>client}});
 assert.equal((await s.claimJob(1,'seller')).already_claimed,true);
 assert.ok(calls.indexOf('ROLLBACK')>calls.indexOf('BEGIN'));assert.ok(calls.indexOf('release')>calls.indexOf('ROLLBACK'));
});
test('item crafting malformed cost/refund/ingredient values fail before any debit or lock',async()=>{
 const invalid=[{gp_cost:-1},{gp_cost:Infinity},{fail_refund_pct:150},{fail_refund_pct:-1},{success_rate:101},{ingredients:[{code:'iron_ore',qty:-2}]},{ingredients:[{code:'iron_ore',qty:1.5}]}];
 for(const change of invalid){
  const recipe={gp_cost:10,fail_refund_pct:50,success_rate:80,ingredients:[{code:'iron_ore',qty:1}],...change};
  const calls=[];const client={query:async(sql)=>{calls.push(sql);assert.match(sql,/SELECT \* FROM crafting_recipes/);return {rows:[recipe]};}};
  const s=service('crafting',{pool:{query:async()=>({rows:[{value:true}]})}});
  await assert.rejects(s.craftItem(client,'SELLER',1),/INVALID_RECIPE/);assert.equal(calls.length,1);
 }
});
test('resource cancellation honors zero refund and rejects refund above principal before writing',async()=>{
 for(const rate of ['0','150']){
  const calls=[];const client={query:async(sql)=>{calls.push(sql);return {rows:sql.includes('SELECT *')?[{status:'crafting',materials_used:{iron_ore:10}}]:[]};},release(){}};
  const s=service('resourceCraft',{pool:{connect:async()=>client},getSetting:async()=>rate});
  if(rate==='150'){await assert.rejects(s.cancelJob(1,'seller'),/INVALID_REFUND_CONFIGURATION/);assert.ok(calls.includes('ROLLBACK'));}
  else assert.equal((await s.cancelJob(1,'seller')).refund_pct,0);
  assert.equal(calls.filter(sql=>sql.includes('INSERT INTO user_resource_inventory')).length,0);
 }
});
