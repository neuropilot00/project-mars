'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
function load(name,db,collaborators={}) {
 const module={exports:{}};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../services/'+name+'.js'),'utf8')+(name==='lottery'?'\nmodule.exports.drawRoundForTest=drawRound;':''),{module,exports:module.exports,console:{log(){},error(){}},require(key){if(key==='../db')return db;if(key==='crypto')return {randomInt:()=>1};if(collaborators[key])return collaborators[key];throw Error('Blocked unrelated dependency '+key);}});
 return module.exports;
}
test('lottery strict missing schema propagates only after savepoint restoration; optional market stays compatible',async()=>{
 for(const code of ['42P01','42703'])for(const strict of [false,true]){
  const calls=[];const client={async query(sql){calls.push(sql);if(sql.startsWith('SELECT key'))return {rows:[]};if(sql.includes('INSERT INTO gp_dividend_pool'))throw Object.assign(Error('fixture missing schema'),{code});return {rows:[]};}};
  const service=load('dividends',{pool:{query(){throw Error('Must use caller client');}}});
  const result=service.addToPool(5,strict?'lottery':'marketplace',client,5,{requireSchema:strict});
  if(strict)await assert.rejects(result,e=>e.code===code);else assert.equal(await result,0);
  assert.deepEqual(calls.slice(-2),['ROLLBACK TO SAVEPOINT marketplace_dividend','RELEASE SAVEPOINT marketplace_dividend']);
 }
});
test('explicit disabled/zero allocation needs no optional table even in strict lottery mode',async()=>{
 for(const settings of [[{key:'dividends_enabled',value:'false'}],[{key:'dividends_lottery_pct',value:'0'}]]){
  const client={async query(sql){assert.ok(!sql.includes('INSERT INTO gp_dividend_pool'));return {rows:sql.startsWith('SELECT key')?settings:[]};}};
  const service=load('dividends',{pool:{query(){throw Error('Must use caller client');}}});
  assert.equal(await service.addToPool(5,'lottery',client,5,{requireSchema:true}),0);
 }
});
function lotteryFixture(dividend,house=5){
 const calls=[];const locked={id:1,round_number:1,ticket_count:3,prize_pool_gp:95,...(house===undefined?{}:{house_gp:house})};
 const client={async query(sql){calls.push(sql);return {rows:sql.includes('SELECT * FROM lottery_rounds')?[locked]:sql.includes('SELECT wallet')?[{wallet:'fixture-winner'}]:[],rowCount:1};},release(){calls.push('release');}};
 return {calls,client,service:load('lottery',{pool:{connect:async()=>client}}, {'./dividends':dividend}),round:locked};
}
test('prize settlement waits for allocation on its own transaction before committing',async()=>{
 let resolve,started;const entering=new Promise(r=>started=r),pending=new Promise(r=>resolve=r);
 const f=lotteryFixture({async addToPool(amount,source,client,max,options){assert.equal(amount,5);assert.equal(source,'lottery');assert.equal(client,f.client);assert.equal(max,5);assert.equal(options.requireSchema,true);started();await pending;return 1.5;}});
 const draw=f.service.drawRoundForTest(f.round,{minTickets:3,enabled:false});await entering;
 assert.ok(f.calls.some(sql=>sql.includes("SET status = 'completed'")));assert.ok(!f.calls.includes('COMMIT'));
 resolve();assert.equal(await draw,true);assert.ok(f.calls.includes('COMMIT'));assert.ok(!f.calls.includes('ROLLBACK'));assert.equal(f.calls.at(-1),'release');
});
test('allocation failure rolls the whole lottery transaction back without committing',async()=>{
 const f=lotteryFixture({async addToPool(){throw Error('fixture allocation failure');}});
 assert.equal(await f.service.drawRoundForTest(f.round,{minTickets:3,enabled:false}),false);
 assert.ok(f.calls.includes('ROLLBACK'));assert.ok(!f.calls.includes('COMMIT'));assert.equal(f.calls.at(-1),'release');
});
test('failed draw is not counted as a completed draw',async()=>{
 const f=lotteryFixture({async addToPool(){throw Error('fixture allocation failure');}});
 const service=load('lottery',{pool:{connect:async()=>f.client,async query(sql){return {rows:sql.includes('SELECT * FROM lottery_rounds')?[f.round]:[{key:'lottery_enabled',value:'false'}]};}}},{'./dividends':{async addToPool(){throw Error('fixture allocation failure');}}});
 assert.equal(await service.drawExpiredRounds(),0);assert.ok(f.calls.includes('ROLLBACK'));
});
test('new purchases persist the charged GP split and per-ticket principal on caller transaction',async()=>{
 const calls=[];const round={id:1,ticket_count:0,ends_at:new Date(Date.now()+60000).toISOString()};
 const client={async query(sql,args){calls.push({sql,args});if(sql.includes('SELECT key'))return {rows:[]};if(sql.includes('SELECT * FROM lottery_rounds'))return {rows:[round]};if(sql.includes('COUNT(*)'))return {rows:[{n:'0'}]};if(sql.includes('SELECT gp_balance'))return {rows:[{gp_balance:'100'}]};return {rows:[],rowCount:1};}};
 const service=load('lottery',{pool:{query(){assert.fail('Purchase settings must use caller transaction');}}});
 const result=await service.buyTickets(client,'fixture-winner',10);
 assert.equal(result.totalCost,100);
 const totals=calls.find(c=>c.sql.includes('SET ticket_count'));
 assert.deepEqual(Array.from(totals.args),[1,10,95,5]);
 const tickets=calls.filter(c=>c.sql.includes('INSERT INTO lottery_tickets'));
 assert.equal(tickets.length,10);assert.equal(tickets.reduce((n,c)=>n+c.args[3],0),100);
});
test('absent or zero legacy house amount is not inferred from ticket counts',async()=>{
 for(const house of [null,0]){
  const f=lotteryFixture({async addToPool(){assert.fail('Must not invent captured house funds');}},house);
  delete f.round.house_gp;if(house===0)f.round.house_gp=0;
  await f.service.drawRoundForTest(f.round,{minTickets:3,enabled:false});assert.ok(f.calls.includes('COMMIT'));
 }
});
