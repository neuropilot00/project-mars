'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
function fixture(name){
 const source=fs.readFileSync(path.join(__dirname,'../services',name+'.js'),'utf8'),rows=[{id:1,status:'active',escrow_version:0},{id:2,status:'active',escrow_version:1},{id:3,status:'completed',escrow_version:0}],module={exports:{}};
 vm.runInNewContext(source,{module,exports:module.exports,console,require(key){if(key==='../db')return {pool:{async query(sql){return {rows:sql.includes('SELECT b.')?[]:rows};}}};throw Error('No unrelated collaborator '+key);}});
 return {service:module.exports,rows};
}
function flags(list){return Array.from(list,a=>[a.id,a.escrow_review_required,a.read_only]);}
const expected=[[1,true,true],[2,false,false],[3,false,false]];
test('modern public/my/detail reads explicitly expose legacy review without mutating auction data',async()=>{
 const f=fixture('auctionCombat'),before=JSON.stringify(f.rows);
 assert.deepEqual(flags(await f.service.getAuctions()),expected);const mine=await f.service.getMyAuctions('fixture');assert.deepEqual(flags(mine.selling),expected);assert.deepEqual(flags(mine.bidding),expected);const detail=await f.service.getAuctionDetail(1);assert.equal(detail.auction.escrow_review_required,true);assert.equal(JSON.stringify(f.rows),before);
});
test('legacy public/user/detail reads expose the same active-only review contract',async()=>{
 const f=fixture('auction'),before=JSON.stringify(f.rows);
 assert.deepEqual(flags(await f.service.getAuctions()),expected);assert.deepEqual(flags(await f.service.getUserAuctions('fixture')),expected);assert.equal((await f.service.getAuction(1)).read_only,true);assert.equal(JSON.stringify(f.rows),before);
});
test('actual server static registration includes authenticator page while retaining repository exclusion',()=>{
 const source=fs.readFileSync(path.join(__dirname,'../index.js'),'utf8'),start=source.indexOf("app.use('/assets', express.static"),end=source.indexOf('// ── SPA fallback',start),routes=[];
 assert.ok(start>=0&&end>start);vm.runInNewContext(source.slice(start,end),{app:{use(){},get(route){routes.push(route);}},express:{static(){return ()=>{};}},path,__dirname:path.join(__dirname,'..')});
 assert.ok(routes.includes('/authenticator.html'));for(const route of ['/server/index.js','/.env','/docs/AUTHENTICATOR_LOCAL.md','/work/'])assert.ok(!routes.includes(route));
});
