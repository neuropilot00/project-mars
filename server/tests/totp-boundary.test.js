'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createBoundary } = require('../utils/totpSessionBoundary');
const wallet = '0x' + '1'.repeat(40);
const claims = { wallet, auth_kind:'totp', auth_version:2, jti:'a'.repeat(32) };
const verify = value => {
  if (value === 'new') return claims;
  if (value === 'legacy') return { wallet };
  if (value === 'bad-claims') return { ...claims, auth_version:'2' };
  throw new Error('invalid signature');
};
const response = () => ({ statusCode:200, status(value) { this.statusCode=value; return this; }, json(value) { this.body=value; return this; } });

test('legacy sessions preserve behavior and never query new identity state', async () => {
  const boundary = createBoundary({ verify, checkSession:() => assert.fail('legacy must not query') });
  assert.equal((await boundary.validateToken('legacy')).wallet, wallet);
  let passed = false;
  await boundary.middleware({ headers:{authorization:'Bearer legacy'}, path:'/marketplace/list' }, response(), () => { passed=true; });
  assert.equal(passed,true);
});
test('recovery rotation rejects old bearer AND body-token requests before a legacy route', async () => {
  const boundary = createBoundary({ verify, checkSession:async () => false });
  for (const req of [
    { headers:{authorization:'Bearer new'},path:'/marketplace/list' },
    { headers:{authorization:'new'},path:'/marketplace/list' },
    ...['bearer new','BEARER new','Bearer\tnew','bEaReR   new'].map(authorization => ({headers:{authorization},path:'/frontier-industry/collect'})),
    { headers:{authorization:'Other new'},path:'/auth/change-password' },
    { headers:{},body:{token:'new'},path:'/auth/link-wallet' },
    { headers:{authorization:'Bearer legacy'},body:{token:'new'},path:'/auth/reveal-key' }
  ]) {
    const res=response(); await boundary.middleware(req,res,() => assert.fail('revoked request passed'));
    assert.equal(res.statusCode,401); assert.deepEqual(res.body,{error:'session_expired'});
  }
});
test('current authenticator session cannot downgrade itself through wallet-link', async () => {
  const boundary=createBoundary({verify,checkSession:async () => true});
  const res=response();
  await boundary.middleware({headers:{},body:{token:'new'},path:'/auth/link-wallet'},res,() => assert.fail('downgrade passed'));
  assert.equal(res.statusCode,403);
});
test('missing, malformed, unavailable and stalled new-session checks fail closed', async () => {
  const malformed=createBoundary({verify,checkSession:() => assert.fail('malformed queried')});
  assert.equal((await malformed.validateToken('bad-claims')).revoked,true);
  const broken=createBoundary({verify,checkSession:async () => {throw new Error('fixture unavailable');}});
  assert.equal((await broken.validateToken('new')).revoked,true);
  const stalled=createBoundary({verify,checkSession:() => new Promise(() => {}),timeoutMs:1});
  assert.equal((await stalled.validateToken('new')).revoked,true);
});
test('one socket token is checked again after session rotation, not trusted from handshake', async () => {
  let version=2;
  const boundary=createBoundary({verify,checkSession:async data => data.auth_version===version});
  assert.equal((await boundary.validateToken('new')).wallet,wallet);
  version++;
  assert.equal((await boundary.validateToken('new')).revoked,true);
  const source=fs.readFileSync(path.join(__dirname,'../wsServer.js'),'utf8');
  assert.match(source,/session = await totpSessionBoundary\.validateToken/);
  assert.match(source,/if \(msg\.type === 'cmd'\)[\s\S]*?await totpSessionBoundary\.validateToken\(ws\.totpToken\)/);
  assert.match(source,/ws\.close\(1008, 'session_expired'\)/);
});
test('legacy wallet-link has its own signed-TOTP rejection before database access', async () => {
  const routes=[];
  const router={post:(url,...handlers)=>routes.push({url,handler:handlers.at(-1)}),get:()=>{}};
  const context={module:{exports:{}},process:{env:{JWT_SECRET:'fixture-not-a-production-secret'}},console:{log(){},warn(){},error(){}},require(name){
    if(name==='express')return{Router:()=>router};
    if(name==='crypto')return require('node:crypto');
    if(name==='jsonwebtoken')return{verify:()=>claims};
    if(name==='bcryptjs')return{};
    if(name==='express-rate-limit')return()=>()=>{};
    if(name==='../db')return{pool:{connect:()=>assert.fail('wallet-link accessed database')}};
    if(name==='../services/email')return{};
    if(name==='../services/rateLimitStore')return{makeLimiterStore:()=>undefined};
    if(name==='../utils/rateLimiters')return{makeRateLimiter:()=>()=>{}};
    throw new Error('unexpected fixture dependency '+name);
  },setInterval:()=>({unref(){}}),clearInterval(){}};
  const source=fs.readFileSync(path.join(__dirname,'../routes/auth.js'),'utf8');
  vm.runInNewContext(source,context);
  const route=routes.find(item=>item.url==='/link-wallet');
  const res=response();
  await route.handler({body:{token:'new',walletAddress:'0x'+'2'.repeat(40)}},res);
  assert.equal(res.statusCode,403);
  assert.equal(res.body.error,'authenticator_wallet_link_unavailable');
});
