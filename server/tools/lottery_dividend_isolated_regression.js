#!/usr/bin/env node
'use strict';
// Fresh private Unix-socket PostgreSQL only. Never bootstrap the app or load credentials.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),vm=require('node:vm'),net=require('node:net'),Module=require('node:module'),crypto=require('node:crypto');
const {execFileSync}=require('node:child_process');
assert.equal(process.env.NODE_ENV,'test');assert.equal(process.env.RUN_SCHEDULERS,'false');
for(const key of Object.keys(process.env))assert.ok(['PATH','NODE_ENV','RUN_SCHEDULERS','__CF_USER_TEXT_ENCODING'].includes(key),'Unexpected env '+key);
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'oc-lottery-')),data=path.join(dir,'db'),socket=path.join(dir,'s'),pgBin='/opt/homebrew/opt/postgresql@16/bin';
fs.chmodSync(dir,0o700);fs.mkdirSync(socket,{mode:0o700});
const childEnv={PATH:'/opt/homebrew/bin:/usr/bin:/bin',LC_ALL:'C'},results=[],root=path.resolve(__dirname,'../..'),frozen=path.resolve(root,'../../outputs/evidence/lottery-dividend-followup-20261021/frozen-source');
let pool,inspection,started=false,failure=false,pending=[];
function guard(){
 const connect=net.Socket.prototype.connect;
 function target(args){return Array.isArray(args[0])?target(args[0]):typeof args[0]==='string'?args[0]:args[0]?.path;}
 net.Socket.prototype.connect=function(...args){assert.equal(target(args),path.join(socket,'.s.PGSQL.55444'),'FIXTURE_UNIX_SOCKET_ONLY');return connect.apply(this,args);};
 const deny=()=>{throw Error('EXTERNAL_IO_FORBIDDEN');};net.Server.prototype.listen=deny;require('node:tls').connect=deny;const dns=require('node:dns');dns.lookup=deny;dns.resolve=deny;dns.promises.lookup=deny;dns.promises.resolve=deny;global.fetch=deny;
 const load=Module._load;Module._load=function(request,...args){if(['dotenv','ioredis','nodemailer','ethers'].includes(String(request).split('/')[0]))throw Error('FORBIDDEN_DEPENDENCY:'+request);return load.call(this,request,...args);};
 const read=fs.readFileSync;fs.readFileSync=function(file,...args){assert.ok(!path.basename(String(file)).startsWith('.env')&&!['.pgpass','credentials'].includes(path.basename(String(file))));return read.call(this,file,...args);};
}
function load(name,db,collaborators,before=false){
 const file=before?path.join(frozen,name+'.js'):path.join(root,'server/services',name+'.js'),module={exports:{}};
 vm.runInNewContext(fs.readFileSync(file,'utf8'),{module,exports:module.exports,console:{log(){},warn(){},error(){}},require(key){if(key==='../db')return db;if(key==='crypto')return crypto;if(collaborators[key])return collaborators[key];throw Error('Blocked unrelated collaborator '+key);}},{filename:file});return module.exports;
}
async function query(db,sql,args){if(failure&&sql.includes('INSERT INTO gp_dividend_pool'))return db.query('SELECT 1/0');return db.query(sql,args);}
const fixtureDb={pool:{query:(sql,args)=>query(pool,sql,args),async connect(){const c=await pool.connect();return {query:(sql,args)=>query(c,sql,args),release:()=>c.release()};}}};
function services(before=false){
 const dividend=load('dividends',fixtureDb,{},before);
 const lottery=load('lottery',fixtureDb,{'./dividends':{addToPool(...args){const p=dividend.addToPool(...args);pending.push(p);return p;}}},before);
 return {lottery,dividend};
}
async function draw(service){await service.drawExpiredRounds();await Promise.allSettled(pending);pending=[];}
async function reset({house=true}={}){
 failure=false;pending=[];
 await pool.query(`DROP TABLE IF EXISTS lottery_tickets,lottery_rounds,users,settings,gp_dividend_pool;
 CREATE TABLE users(wallet_address text PRIMARY KEY,gp_balance numeric NOT NULL DEFAULT 0 CHECK(gp_balance>=0));
 CREATE TABLE settings(key text PRIMARY KEY,value text);
 CREATE TABLE lottery_rounds(id serial PRIMARY KEY,round_number integer UNIQUE,ticket_price_gp numeric,ticket_count integer,prize_pool_gp numeric,status text,ends_at timestamptz,drawn_at timestamptz,winner_wallet text,winning_ticket_number integer${house?',house_gp numeric':''});
 CREATE TABLE lottery_tickets(round_id integer,wallet text,ticket_number integer,is_winner boolean DEFAULT false,UNIQUE(round_id,ticket_number));
 CREATE TABLE gp_dividend_pool(id serial PRIMARY KEY,week_start date UNIQUE,pool_gp numeric DEFAULT 0);
 INSERT INTO users VALUES('fixture-winner',0);
 INSERT INTO settings VALUES('lottery_enabled','false');
 INSERT INTO lottery_rounds(round_number,ticket_price_gp,ticket_count,prize_pool_gp,status,ends_at${house?',house_gp':''}) VALUES(1,10,10,95,'open',now()-interval '1 minute'${house?',5':''});
 INSERT INTO lottery_tickets(round_id,wallet,ticket_number) SELECT 1,'fixture-winner',n FROM generate_series(1,10) n;`);
}
async function snapshot(){
 const r=(await inspection.query('SELECT status,winner_wallet FROM lottery_rounds WHERE id=1')).rows[0],u=(await inspection.query('SELECT gp_balance FROM users')).rows[0];
 const wins=Number((await inspection.query('SELECT COUNT(*) n FROM lottery_tickets WHERE is_winner')).rows[0].n),columns=(await inspection.query("SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='gp_dividend_pool' AND column_name='pool_gp'")).rows.length;
 return {status:r.status,winner:r.winner_wallet,prizeGP:Number(u.gp_balance),winningTickets:wins,poolGP:columns?Number((await inspection.query('SELECT COALESCE(SUM(pool_gp),0) n FROM gp_dividend_pool')).rows[0].n):null};
}
const pass=(name,details)=>results.push({name,passed:true,...details});
const unopened={status:'open',winner:null,prizeGP:0,winningTickets:0,poolGP:0};
async function main(){try{
 execFileSync(path.join(pgBin,'initdb'),['-D',data,'-A','trust','--no-locale'],{env:childEnv,stdio:'pipe'});
 execFileSync(path.join(pgBin,'pg_ctl'),['-D',data,'-o',"-k "+socket+" -p 55444 -h '' -c fsync=off",'-l',path.join(dir,'pg.log'),'-w','start'],{env:childEnv,stdio:'pipe'});started=true;guard();
 const {Pool}=require('pg'),user=os.userInfo().username;pool=new Pool({host:socket,port:55444,user,database:'postgres',application_name:'lottery-atomicity-fixture',max:6});inspection=new Pool({host:socket,port:55444,user,database:'postgres',application_name:'lottery-inspection',max:1});
 await reset();failure=true;await draw(services(true).lottery);const before=await snapshot();assert.equal(before.status,'completed');assert.equal(before.prizeGP,95);assert.equal(before.winningTickets,1);assert.equal(before.poolGP,0);pass('captured prepatch source reproduces committed prize/round with failed separate allocation',{before});
 await reset();failure=true;const fixed=services();await draw(fixed.lottery);assert.deepEqual(await snapshot(),unopened);failure=false;await draw(fixed.lottery);const committed=await snapshot();assert.deepEqual(committed,{status:'completed',winner:'fixture-winner',prizeGP:95,winningTickets:1,poolGP:1.5});await draw(fixed.lottery);assert.deepEqual(await snapshot(),committed);pass('transient SQL allocation error rolls all draw money/state back; retry settles once; duplicate draw unchanged',{after:committed});
 await reset();await Promise.all([draw(services().lottery),draw(services().lottery)]);assert.deepEqual(await snapshot(),committed);pass('concurrent expired-round calls cannot repeat prize or dividend');
 for(const mode of ['table','column']){
  await reset();await pool.query(mode==='table'?'DROP TABLE gp_dividend_pool':'ALTER TABLE gp_dividend_pool DROP COLUMN pool_gp');
  const s=services();await draw(s.lottery);assert.deepEqual(await snapshot(),{...unopened,poolGP:null});
  await pool.query(mode==='table'?'CREATE TABLE gp_dividend_pool(id serial PRIMARY KEY,week_start date UNIQUE,pool_gp numeric DEFAULT 0)':'ALTER TABLE gp_dividend_pool ADD COLUMN pool_gp numeric DEFAULT 0');
  await draw(s.lottery);assert.deepEqual(await snapshot(),committed);pass('required lottery '+mode+' absence rolls back; repair then retry settles once');
 }
 for(const [key,value] of [['dividends_enabled','false'],['dividends_lottery_pct','0']]){
  await reset();await pool.query('INSERT INTO settings VALUES($1,$2)',[key,value]);await pool.query('DROP TABLE gp_dividend_pool');await draw(services().lottery);assert.deepEqual(await snapshot(),{...committed,poolGP:null});pass('explicit '+key+'='+value+' preserves successful zero allocation without pool');
 }
 await reset({house:false});await pool.query('DROP TABLE gp_dividend_pool');await draw(services().lottery);assert.deepEqual(await snapshot(),{...committed,poolGP:null});pass('current179/296-style schema without house_gp preserves prize and does not invent a house base');
 await reset();await pool.query('DROP TABLE gp_dividend_pool');const c=await pool.connect();try{await c.query('BEGIN');assert.equal(await services().dividend.addToPool(5,'marketplace',c),0);assert.equal((await c.query('SELECT 1 n')).rows[0].n,1);await c.query('COMMIT');}finally{c.release();}pass('existing optional marketplace missing-pool policy remains transaction-usable');
 assert.equal(Number((await inspection.query("SELECT COUNT(*) n FROM pg_stat_activity WHERE application_name='lottery-atomicity-fixture' AND state='idle in transaction'")).rows[0].n),0);
 console.log(JSON.stringify({groups:results.length,results,sources:Object.fromEntries(['lottery','dividends'].map(n=>[n,{beforeSHA256:crypto.createHash('sha256').update(fs.readFileSync(path.join(frozen,n+'.js'))).digest('hex'),afterSHA256:crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'server/services',n+'.js'))).digest('hex')}])),boundaries:['Actual source/SQL and row locking in a fresh private Unix-socket PG; no app/bootstrap/scheduler process or production data.','Positive legacy captured house5/prize95 is explicit fixture capital; current179 absent house_gp is a separate zero-base case. No inferred historical cut or new funding policy.','This compatibility suite checks draw/dividend settlement. Next-round retry and successful-close counters are covered by lottery_release_private_pg.js.']},null,2));
}finally{if(pool)await pool.end();if(inspection)await inspection.end();if(started)execFileSync(path.join(pgBin,'pg_ctl'),['-D',data,'-m','immediate','-w','stop'],{env:childEnv,stdio:'pipe'});fs.rmSync(dir,{recursive:true,force:true});console.log('CLEANUP private PG stopped and fixture removed '+dir);}}
main().catch(error=>{console.error(error.stack||error);process.exitCode=1;});
