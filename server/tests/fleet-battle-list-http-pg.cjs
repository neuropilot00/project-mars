'use strict';
// Explicit local regression: real SQL + actual router over a private Unix HTTP
// socket. Not part of the socket-free *.test.js suite. No schema/data writes.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),http=require('node:http'),vm=require('node:vm');
const express=require('express'),{Pool}=require('pg');
const repo=path.resolve(__dirname,'../..');
const runtimeFile=process.env.MARS_BATTLE_FIXTURE_RUNTIME;
assert.ok(runtimeFile,'Set MARS_BATTLE_FIXTURE_RUNTIME to the authorized disposable fixture runtime.json');
const runtime=JSON.parse(fs.readFileSync(runtimeFile,'utf8'));
assert.ok(runtime.privateRoot.startsWith('/tmp/oc-mobile-play-'),'only the authorized disposable cluster');
assert.ok(runtime.socket.startsWith(runtime.privateRoot+'/'),'private Unix PG socket only');
assert.equal(runtime.database,'mobile_play');assert.equal(runtime.user,'mobile_fixture');
const pool=new Pool({host:runtime.socket,port:55447,user:runtime.user,database:runtime.database,ssl:false,max:1,options:'-c default_transaction_read_only=on'});
const source=fs.readFileSync(path.join(repo,'server/routes/fleetBattles.js'),'utf8');
const routeQueries={};
for(const name of ['active','recent']){
 const start=source.indexOf("router.get('/list/"+name+"'");
 const query=source.slice(start).match(/pool\.query\(`([\s\S]*?)`/)[1];
 routeQueries[name]=query;
}
function request(socketPath,route){return new Promise((resolve,reject)=>{
 const req=http.get({socketPath,path:route},res=>{const chunks=[];res.on('data',chunk=>chunks.push(chunk));res.on('end',()=>{try{resolve({status:res.statusCode,body:JSON.parse(Buffer.concat(chunks).toString())});}catch(error){reject(error);}});});req.on('error',reject);
});}
test('battle list actual SQL resolves joined ids and actual HTTP preserves list/cache contracts',async()=>{
 const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'mars-battle-list-'));
 const socketPath=path.join(temporary,'http.sock');let server;let queries=0;
 try{
  assert.equal((await pool.query('SHOW default_transaction_read_only')).rows[0].default_transaction_read_only,'on');
  for(const name of ['active','recent']){
   const legacy=routeQueries[name].replace('SELECT fb.id,','SELECT id,');
   await assert.rejects(pool.query(legacy,name==='recent'?[20]:[]),error=>error.code==='42702'&&/ambiguous/.test(error.message),'unqualified '+name+' id reproduces PostgreSQL42702');
   const fixed=await pool.query(routeQueries[name],name==='recent'?[20]:[]);
   for(const row of fixed.rows){assert.ok(row.id!=null);assert.ok('sector_code'in row);assert.ok('sector_name'in row);}
  }
  const actualPool={query(sql,args){assert.match(sql,/^\s*SELECT\b/);queries++;return pool.query(sql,args);}};
  const actualEnvironment=require('../services/battleEnvironment');
  const context={module:{exports:{}},console:{error(...args){throw new Error('Unexpected route failure: '+args.map(String).join(' '));}},process:{env:{}},require(name){
   if(name==='express')return express;if(name==='jsonwebtoken')return require('jsonwebtoken');
   if(name==='../db')return{pool:actualPool};
   if(name==='../utils/rateLimiters')return{makeRateLimiter:()=>((_req,_res,next)=>next())};
   if(name==='../services/battleEnvironment')return actualEnvironment;
   if(name.startsWith('../services/'))return{};
   throw Error('Unexpected fixture dependency '+name);
  }};
  vm.runInNewContext(source,context,{filename:'fleetBattles.js'});
  const app=express();app.use('/api/battles',context.module.exports);server=http.createServer(app);
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(socketPath,resolve);});
  for(const name of ['active','recent']){
   const response=await request(socketPath,'/api/battles/list/'+name);
   assert.equal(response.status,200,name);assert.ok(Array.isArray(response.body.battles));
   const expected=await pool.query(routeQueries[name],name==='recent'?[20]:[]);
   assert.deepEqual(response.body.battles.map(row=>String(row.id)),expected.rows.map(row=>String(row.id)),name+' returns actual battle ids');
   for(const row of response.body.battles){assert.ok('battle_type'in row);assert.ok('status'in row);assert.ok('sector_code'in row);if(name==='recent'){assert.ok('reward_total_gp'in row);assert.ok('reward_count'in row);}}
   const before=queries;assert.equal((await request(socketPath,'/api/battles/list/'+name)).status,200);assert.equal(queries,before,name+' list cache still avoids duplicate query');
   console.log(name+': PostgreSQL42702 reproduced before qualification; actual PostgreSQL/HTTP200 after; '+response.body.battles.length+' rows; cache preserved');
  }
 }finally{
  if(server)await new Promise(resolve=>server.close(resolve));
  await pool.end();fs.rmSync(temporary,{recursive:true,force:true});
 }
});
