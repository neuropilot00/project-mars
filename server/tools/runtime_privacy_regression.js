#!/usr/bin/env node
// No DB, credentials or production traffic: exercise shipped SW/account code and static mounts.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const express = require('express');
const root = path.resolve(__dirname, '../..');
async function serviceWorker() {
  const handlers = {}, deleted = [], stores = [];
  const requests = ['/api/auth/me', '/api/fleets', '/assets/main.css'].map(p => ({url:'https://game.test'+p}));
  const cache = {keys:async()=>requests,delete:async r=>{deleted.push(r.url);return true;},put:()=>stores.push('put')};
  let matches=0, network;
  const context = {URL,Promise,self:{addEventListener:(n,f)=>handlers[n]=f,clients:{claim:async()=>{}},skipWaiting(){}},
    caches:{keys:async()=>['mars-v166-upgrade22'],open:async()=>cache,delete:async()=>true,match:async()=>{matches++;return {oldAccount:'A'};}},
    fetch:r=>network(r)};
  vm.runInNewContext(fs.readFileSync(path.join(root,'sw.js'),'utf8'),context);
  let activation;handlers.activate({waitUntil:p=>activation=p});await activation;
  assert.deepEqual(deleted,requests.slice(0,2).map(r=>r.url));
  async function get(url,online) {
    network=async()=>{if(!online)throw Error('offline');return {ok:true,account:'B'};};
    let response;handlers.fetch({request:{url:'https://game.test'+url,method:'GET',destination:'',headers:{Authorization:'Bearer B'}},respondWith:p=>response=p});
    if(online){assert.equal((await response).account,'B');}else await assert.rejects(response,/offline/);
  }
  await get('/api/auth/me',true);await get('/api/auth/me',false);await get('/api/fleets',false);await get('/api/starter-ops/state',false);
  assert.equal(matches,0);assert.equal(stores.length,0);
  console.log('PASS SW: legacy API purge; online-only private game state; no cross-account offline fallback');
}
async function staticFiles() {
  const source=fs.readFileSync(path.join(root,'server/index.js'),'utf8');
  const start=source.indexOf('// ── Favicon 204');const end=source.indexOf('// ── SPA fallback',start);
  const app=express();vm.runInNewContext(source.slice(start,end),{app,express,path,__dirname:path.join(root,'server')});
  const server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});
  const base='http://127.0.0.1:'+server.address().port;
  try {
    for(const file of ['/index.html','/admin.html','/arena.html','/manifest.json','/sw.js','/assets/main.css','/assets/tactical-lab-v11.html','/assets/lib/globe.gl.min.js']){
      const response=await fetch(base+file);assert.equal(response.status,200,file);await response.arrayBuffer();
    }
    for(const file of ['/server/package.json','/server/services/exploration.js','/package.json','/railway.json','/docs/no-file.json','/scripts/check_inline_onclick.sh','/assets/../server/package.json','/assets/%2e%2e/server/package.json']){
      const response=await fetch(base+file);assert.equal(response.status,404,file);await response.arrayBuffer();
    }
    assert.ok(!source.includes("VALUES ('cantina', 'cantina_enabled', 'true'"),'bootstrap must not force enable Cantina');
    console.log('PASS static: public clients and assets served; server/config/tools/traversal blocked; forced Cantina gate absent');
  } finally {await new Promise(resolve=>server.close(resolve));}
}
async function account() {
  const source=fs.readFileSync(path.join(root,'assets/account-profile.js'),'utf8');
  const start=source.indexOf('var _authMeInFlight =');const end=source.indexOf('function _authRankCacheKey',start);
  const pending=[];const applied=[];
  const context={emailAuth:{token:'A'},Date,Promise,fetch:()=>new Promise(resolve=>pending.push(data=>resolve({ok:true,json:async()=>data}))),_applyAuthMeBalances:d=>applied.push(d)};
  vm.createContext(context);vm.runInContext(source.slice(start,end),context);
  const a=context.fetchAuthMe(false);assert.equal(context.fetchAuthMe(false),a);
  context.emailAuth.token='B';const b=context.fetchAuthMe(false);assert.notEqual(a,b);assert.equal(pending.length,2);
  pending[0]({account:'A'});assert.equal(await a,null);assert.equal(context.fetchAuthMe(false),b,'old request finally must preserve new request');
  pending[1]({account:'B'});assert.equal((await b).account,'B');assert.equal((await context.fetchAuthMe(false)).account,'B');
  const rs=source.indexOf('async function refreshEmailBalances()');const re=source.indexOf('/* ── Referral System',rs);
  vm.runInContext(source.slice(rs,re),context);
  context.emailAuth.token='C';const refresh=context.refreshEmailBalances();context.emailAuth.token=null;pending[2]({account:'C'});await refresh;assert.equal(applied.length,0);
  const autoStart=source.indexOf('(function autoLoginInit(){');
  const autoSource=source.slice(autoStart,source.indexOf('})();',autoStart)+5);
  async function restoreFailure(message,switchToken) {
    let reject, removed=0, fallback=0;
    const ctx={emailAuth:{token:'saved'},console:{log(){}},_authQuietPublicReads(){},
      fetchAuthMe:()=>new Promise((resolve,r)=>{reject=r;}),localStorage:{removeItem:()=>removed++},_tryCredentialAutoLogin:()=>fallback++};
    vm.runInNewContext(autoSource,ctx);
    if(switchToken)ctx.emailAuth.token='new-account';
    reject(Error(message));await new Promise(resolve=>setImmediate(resolve));
    return {token:ctx.emailAuth.token,removed,fallback};
  }
  assert.deepEqual(await restoreFailure('offline',false),{token:'saved',removed:0,fallback:0});
  assert.deepEqual(await restoreFailure('auth_me_401',true),{token:'new-account',removed:0,fallback:0});
  assert.deepEqual(await restoreFailure('auth_me_401',false),{token:null,removed:1,fallback:1});
  console.log('PASS auth: token-scoped requests; stale response/finally ignored; logout refresh isolated; offline token retained; stale restore failure cannot log out new account');
}
(async()=>{await serviceWorker();await staticFiles();await account();})().catch(e=>{console.error(e);process.exitCode=1;});
