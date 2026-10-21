'use strict';
// Explicit disposable PostgreSQL + HTTP regression. No operating DB, .env,
// credentials or external network. Excluded from the socket-free *.test.js suite.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),http=require('node:http'),vm=require('node:vm'),cp=require('node:child_process');
const express=require('express'),{Pool}=require('pg');
const pgBin='/opt/homebrew/opt/postgresql@16/bin';
const repo=path.resolve(__dirname,'../..');
const env={PATH:'/opt/homebrew/bin:/usr/bin:/bin',LC_ALL:'C'};
const legacySql=`SELECT f.code,f.name_ko,f.color_primary,
 COUNT(DISTINCT u.wallet_address) AS player_count,
 COUNT(DISTINCT s.id) FILTER (WHERE s.is_alive) AS ships_alive
 FROM factions f LEFT JOIN users u ON u.faction_code=f.code
 LEFT JOIN ship_types st ON st.faction_code=f.code
 LEFT JOIN ships s ON s.ship_type_code=st.code
 WHERE f.is_active=true GROUP BY f.code,f.name_ko,f.color_primary,f.sort_order ORDER BY f.sort_order`;
function maxRows(node){return Math.max(node['Actual Rows']||0,...(node.Plans||[]).map(maxRows));}
function get(socketPath){return new Promise((resolve,reject)=>{
 const req=http.get({socketPath,path:'/api/factions/stats'},res=>{const chunks=[];res.on('data',chunk=>chunks.push(chunk));res.on('end',()=>{try{resolve({status:res.statusCode,body:JSON.parse(Buffer.concat(chunks).toString())});}catch(error){reject(error);}});});req.on('error',reject);
});}
test('actual faction stats preserves counts/zero rows/order and avoids user-by-ship fanout over PostgreSQL and HTTP',async()=>{
 const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'mars-faction-stats-'));fs.chmodSync(temporary,0o700);
 const data=path.join(temporary,'data'),socketDir=path.join(temporary,'socket'),httpSocket=path.join(temporary,'http.sock');fs.mkdirSync(socketDir,{mode:0o700});
 let started=false,pool,server;
 try{
  cp.execFileSync(path.join(pgBin,'initdb'),['-D',data,'-U','fixture_owner','-A','trust','--no-locale','-E','UTF8'],{env,stdio:'pipe'});
  cp.execFileSync(path.join(pgBin,'pg_ctl'),['-D',data,'-l',path.join(temporary,'postgres.log'),'-o',"-k "+socketDir+" -p 55469 -c listen_addresses='' -c shared_buffers=12MB -c max_connections=10",'-w','start'],{env,stdio:'pipe'});started=true;
  pool=new Pool({host:socketDir,port:55469,user:'fixture_owner',database:'postgres',ssl:false,max:1});
  await pool.query(`CREATE TABLE factions(code text PRIMARY KEY,name_ko text,color_primary text,is_active boolean,sort_order int);
   CREATE TABLE users(wallet_address text PRIMARY KEY,faction_code text);
   CREATE TABLE ship_types(code text PRIMARY KEY,faction_code text);
   CREATE TABLE ships(id bigint PRIMARY KEY,ship_type_code text,is_alive boolean);
   INSERT INTO factions VALUES('mcc','MCC','#f00',true,2),('fsp','FSP','#00f',true,1),('cv','CV','#0f0',true,3),('inactive','Inactive','#000',false,0);
   INSERT INTO users SELECT 'mcc-user-'||n,'mcc' FROM generate_series(1,20)n;
   INSERT INTO users VALUES('fsp-1','fsp'),('fsp-2','fsp'),('unassigned',NULL),('inactive-1','inactive');
   INSERT INTO ship_types VALUES('mcc-one','mcc'),('mcc-two','mcc'),('fsp-one','fsp'),('inactive-one','inactive');
   INSERT INTO ships SELECT n,CASE WHEN n<=15 THEN 'mcc-one' ELSE 'mcc-two' END,true FROM generate_series(1,30)n;
   INSERT INTO ships VALUES(31,'mcc-one',false),(32,'mcc-two',NULL),(40,'fsp-one',true),(41,'fsp-one',true),(42,'fsp-one',false),(50,'inactive-one',true);`);
  const serviceContext={module:{exports:{}},require(name){if(name==='../db')return{pool};throw Error('Unexpected service import '+name);}};
  vm.runInNewContext(fs.readFileSync(path.join(repo,'server/services/faction.js'),'utf8'),serviceContext,{filename:'faction.js'});
  const service=serviceContext.module.exports;
  const stats=await service.getFactionStats(),previous=(await pool.query(legacySql)).rows;
  assert.deepEqual(stats,previous,'identical public contract including COUNT bigint strings');
  assert.deepEqual(stats.map(row=>row.code),['fsp','mcc','cv']);
  assert.equal(stats[0].player_count,'2');assert.equal(stats[0].ships_alive,'2');
  assert.equal(stats[1].player_count,'20');assert.equal(stats[1].ships_alive,'30');
  assert.equal(stats[2].player_count,'0');assert.equal(stats[2].ships_alive,'0');
  let actualSql;const captureContext={module:{exports:{}},require:()=>({pool:{query:async sql=>{actualSql=sql;return{rows:[]};}}})};
  vm.runInNewContext(fs.readFileSync(path.join(repo,'server/services/faction.js'),'utf8'),captureContext);await captureContext.module.exports.getFactionStats();
  const oldPlan=(await pool.query('EXPLAIN (ANALYZE, FORMAT JSON) '+legacySql)).rows[0]['QUERY PLAN'][0].Plan;
  const newPlan=(await pool.query('EXPLAIN (ANALYZE, FORMAT JSON) '+actualSql)).rows[0]['QUERY PLAN'][0].Plan;
  assert.ok(maxRows(oldPlan)>=640,'old join multiplies20 players by32 ship rows');assert.ok(maxRows(newPlan)<100,'independent aggregates avoid multiplied intermediate rows');
  const errors=[];const routeContext={module:{exports:{}},console:{error:(...args)=>errors.push(args)},process:{env:{}},require(name){
   if(name==='express')return express;if(name==='../services/faction')return service;if(name==='jsonwebtoken')return{};throw Error('Unexpected route import '+name);
  }};
  vm.runInNewContext(fs.readFileSync(path.join(repo,'server/routes/factions.js'),'utf8'),routeContext,{filename:'factions.js'});
  const app=express();app.use('/api/factions',routeContext.module.exports);server=http.createServer(app);
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(httpSocket,resolve);});
  const response=await get(httpSocket);assert.equal(response.status,200);assert.deepEqual(response.body,{stats});assert.equal(errors.length,0);
  console.log('Actual PostgreSQL plan largest intermediate rows: legacy='+maxRows(oldPlan)+', fixed='+maxRows(newPlan)+'; stats/zero factions/order/bigint strings identical; actual HTTP200.');
 }finally{
  if(server)await new Promise(resolve=>server.close(resolve));if(pool)await pool.end();
  if(started)cp.execFileSync(path.join(pgBin,'pg_ctl'),['-D',data,'-m','fast','-w','stop'],{env,stdio:'pipe'});
  fs.rmSync(temporary,{recursive:true,force:true});
 }
});
