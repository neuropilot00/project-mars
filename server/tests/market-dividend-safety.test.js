'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../services/dividends.js'),'utf8');
function dividendFixture(value,missing=false){
 const calls=[];const client={async query(sql,args){calls.push({sql,args});if(sql.includes('SELECT key, value'))return {rows:value===undefined?[]:[{key:'dividends_marketplace_pct',value}]};if(missing&&sql.includes('INSERT INTO gp_dividend_pool'))throw Object.assign(Error('missing pool'),{code:'42P01'});return {rows:[],rowCount:1};}};
 const module={exports:{}};vm.runInNewContext(source,{module,exports:module.exports,console:{log(){}},require(name){if(name==='../db')return {pool:{query(){throw Error('Sale must use supplied client');}}};throw Error('Unrelated collaborator');}},{filename:'dividends.js'});
 return {client,calls,service:module.exports};
}
test('dividends use supplied client with default20/explicit0 and remaining-fee ceiling',async()=>{
 const nominal=dividendFixture();assert.equal(await nominal.service.addToPool(10,'marketplace',nominal.client),2);
 assert.equal(nominal.calls.find(c=>c.sql.includes('INSERT INTO gp_dividend_pool')).args[1],2);
 const capped=dividendFixture();assert.equal(await capped.service.addToPool(10,'marketplace',capped.client,1.5),1.5);
 const zero=dividendFixture('0');assert.equal(await zero.service.addToPool(10,'marketplace',zero.client),0);assert.equal(zero.calls.filter(c=>c.sql.includes('INSERT INTO gp_dividend_pool')).length,0);
});
test('invalid percentage rolls allocation back to savepoint before propagating',async()=>{
 for(const value of ['-1','101','NaN','']){const f=dividendFixture(value);await assert.rejects(f.service.addToPool(10,'marketplace',f.client),/INVALID_DIVIDEND_PERCENTAGE/);assert.ok(f.calls.some(c=>c.sql==='ROLLBACK TO SAVEPOINT marketplace_dividend'));assert.ok(f.calls.some(c=>c.sql==='RELEASE SAVEPOINT marketplace_dividend'));assert.equal(f.calls.filter(c=>c.sql.includes('INSERT INTO gp_dividend_pool')).length,0);}
});
test('optional missing pool returns zero after restoring caller transaction savepoint',async()=>{
 const f=dividendFixture(undefined,true);assert.equal(await f.service.addToPool(10,'marketplace',f.client),0);
 assert.deepEqual(f.calls.slice(-2).map(c=>c.sql),['ROLLBACK TO SAVEPOINT marketplace_dividend','RELEASE SAVEPOINT marketplace_dividend']);
});
test('ship fail/cancel refund percentages cannot exceed principal; explicit zero stays zero',async()=>{
 const ship=fs.readFileSync(path.join(__dirname,'../services/ship.js'),'utf8');
 const failed=ship.slice(ship.indexOf('async function refundFailedBuildJob('),ship.indexOf('// ─── 완료된 작업 일괄 처리'));
 const cancel=ship.slice(ship.indexOf('async function cancelBuildJob('),ship.indexOf('// ─── 함대 자동 생성'));
 for(const value of ['0','150','-1','bad','','12junk',Infinity]){
  const calls=[];const client={async query(sql){calls.push(sql);return {rows:sql.includes('SELECT * FROM ship_build_jobs')?[{id:1,status:'building',gp_cost:10,minerals_used:{iron_ore:2},wallet_address:'fixture'}]:[],rowCount:1};},release(){}};
  const context={getSetting:async()=>value,pool:{connect:async()=>client},console:{error(){}}};vm.createContext(context);vm.runInContext(failed+'\n'+cancel,context);
  if(value==='0'){assert.equal((await context.cancelBuildJob(1,'fixture')).refund_pct,0);assert.equal((await context.refundFailedBuildJob(client,{id:1},Error('dummy'))).refund_pct,0);}
  else{await assert.rejects(context.cancelBuildJob(1,'fixture'),/INVALID_REFUND_PERCENTAGE/);assert.equal((await context.refundFailedBuildJob(client,{id:1},Error('dummy'))).error,'INVALID_REFUND_PERCENTAGE');}
  assert.equal(calls.filter(sql=>/UPDATE users SET gp_balance|INSERT INTO user_resource_inventory/.test(sql)).length,0);
 }
});

test('ship scrap uses the same strict percentage bounds without changing catalog cost basis',async()=>{
 const ship=fs.readFileSync(path.join(__dirname,'../services/ship.js'),'utf8');const scrap=ship.slice(ship.indexOf('async function scrapShip('),ship.indexOf('module.exports = {'));
 for(const value of ['0','150','-1','','12junk',Infinity]){
  const calls=[];const client={async query(sql){calls.push(sql);return {rows:sql.includes('SELECT s.id, s.owner_wallet')?[{id:1,is_alive:true,build_gp_cost:10,recipe_minerals:{iron_ore:2},fleet_id:1}]:[],rowCount:1};},release(){}};
  const context={assertNotStarterGrantShip:async()=>{},require(name){assert.equal(name,'../db');return {getSetting:async()=>value,pool:{connect:async()=>client}};}};vm.createContext(context);vm.runInContext(scrap,context);
  if(value==='0')assert.equal((await context.scrapShip('fixture',1)).gpRefunded,0);else await assert.rejects(context.scrapShip('fixture',1),/INVALID_REFUND_PERCENTAGE/);
  assert.equal(calls.filter(sql=>/UPDATE users SET gp_balance|INSERT INTO user_resource_inventory/.test(sql)).length,0);
 }
});
