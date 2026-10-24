'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../index.js'),'utf8');
const handler=source.slice(source.indexOf('async function healthCheck('),source.indexOf("app.get('/health'"));
async function probe(redisStatus,{required=true,db='ok'}={}){
 let sent;const c={process:{env:{REDIS_URL:'test-redis',RUN_SCHEDULERS:required?'true':'false'},uptime:()=>12,memoryUsage:()=>({rss:1000000})},Date,Math,pool:{query:async()=>{if(db!=='ok')throw Error('database unavailable');}},cacheDiagnostics:async()=>({status:redisStatus,configured:true,mode:'redis'}),require:()=>({isLeader:()=>true})};
 vm.createContext(c);vm.runInContext(handler,c);await c.healthCheck({}, {status(code){this.code=code;return this;},json(body){sent={code:this.code,body};}});return sent;
}
test('configured cache starts during application boot, rather than being created by the first probe',()=>{
 const init=source.indexOf("const { cacheDiagnostics } = require('./services/cache')");assert.ok(init>source.indexOf("require('dotenv').config"));assert.ok(init<source.indexOf('async function healthCheck('));assert.ok(!handler.includes("require('./services/cache')"));
});
test('a ready database and required Redis remain healthy',async()=>assert.equal((await probe('ok')).code,200));
test('an actual required Redis outage still fails readiness',async()=>{const r=await probe('down');assert.equal(r.code,503);assert.equal(r.body.redis.required,true);assert.equal(r.body.redis.status,'down');});
test('web-only optional cache outage stays visible without failing readiness',async()=>{const r=await probe('down',{required:false});assert.equal(r.code,200);assert.equal(r.body.redis.status,'down');assert.equal(r.body.redis.required,false);});
test('a database outage still fails readiness even with healthy Redis',async()=>assert.equal((await probe('ok',{db:'error'})).code,503));
