'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const globeSource=fs.readFileSync(path.join(__dirname,'../../assets/world-globe.js'),'utf8');
const territorySource=fs.readFileSync(path.join(__dirname,'../../assets/territory-ui.js'),'utf8');
const owner='0xfirst',other='0xsecond';
function row(id,extra={}){return{id,owner,lat:20,lng:40,w:5,h:5,nickname:'MobileQA002',ts:100,...extra};}
async function fixture(initial=[]){
 let now=1000,response=initial,polls=[],redraws=0;
 const claims=[];
 const state={claims,walletState:{connected:true,address:owner},window:{walletState:{connected:true,address:owner}},navigator:{userAgent:'Mobile'},
 Date:class extends Date{static now(){return now;}},localStorage:{getItem:()=>null},console:{warn:(...args)=>assert.fail(args.join(' '))},
 marsAuthHeaders:()=>({}),_guardedJsonFetch:async(_key,url)=>url.startsWith('/api/claims')?response:{},
 _setActiveInterval:callback=>polls.push(callback),_setActiveTimeout:()=>1,_publicHudQuietRemainingMs:()=>0,
 initPixelGrid:()=>{},initPixelGridFromServer:()=>{},imgCache:{},cacheImage:()=>assert.fail('fixture has no images'),compositeClaimsOnTexture:()=>{redraws++;}};
 vm.createContext(state);const start=globeSource.indexOf('var _serverClaimsBootRetryId');
 vm.runInContext(globeSource.slice(start,globeSource.indexOf('// ── Sectors auto-refresh',start)),state);
 const settle=()=>new Promise(resolve=>setImmediate(resolve));await settle();
 return{state,claims,set:rows=>{response=rows;},settle,get redraws(){return redraws;},async boot(rows){response=rows;state.loadServerClaims();await settle();},async poll(rows){response=rows;now+=21000;polls[0]();await settle();}};
}
test('actual repeated boot and duplicate payloads keep one row per number/string ID and preserve shared array',async()=>{
 const f=await fixture([row(42)]),reference=f.claims;
 await f.boot([row('42',{nickname:'current'})]);await f.boot([row(42),row('42',{nickname:'latest'})]);
 assert.equal(f.state.claims,reference);assert.equal(f.claims.length,1);assert.equal(f.claims[0].nickname,'latest');
 f.claims.push(row(42),{owner:'demo',lat:0});await f.boot([row('42')]);assert.equal(f.claims.length,2);assert.equal(f.claims.filter(c=>c.id!=null).length,1);
});
test('actual delta replaces changed ownership and deduplicates new IDs within one response',async()=>{
 const f=await fixture([row(42)]),before=f.redraws;
 await f.poll([row('42',{owner:other}),row(43),row('43',{nickname:'current43'})]);
 assert.equal(f.claims.length,2);assert.equal(f.claims.find(c=>String(c.id)==='42').owner,other);assert.equal(f.claims.find(c=>String(c.id)==='43').nickname,'current43');
 assert.ok(f.redraws>before,'ownership update redraws rather than being skipped');
 for(let i=0;i<8;i++)await f.poll([row('43'),row(43)]);
 assert.equal(f.claims.length,1,'existing ninth-poll full reconciliation still removes absent claims');assert.equal(String(f.claims[0].id),'43');
});
test('actual POST-success insertion upserts a claim already received by polling and registers its existing index',async()=>{
 const f=await fixture([row(42),row(43,{owner:other})]);
 Object.assign(f.state,{ncLat:20,ncLng:40,ncW:5,ncH:5,myAddr:owner,walletState:{nickname:'MobileQA002'},d:{claimId:'42',totalCost:0},linkVal:'',sendImageUrl:'',uploadedUrl:''});
 const start=territorySource.indexOf('    var nc={lat:ncLat');const end=territorySource.indexOf('    if(d.newPixels){',start);
 vm.runInContext(territorySource.slice(start,end),f.state);
 assert.equal(f.claims.length,2);assert.equal(f.state.claimIdx,0);assert.equal(f.claims.filter(c=>String(c.id)==='42').length,1);
});
test('actual item picker renders one25px claim after boot/delta/POST race, never2merged50px',async()=>{
 const f=await fixture([row(42),row('42')]);await f.boot([row(42)]);await f.poll([row('42')]);
 let rendered='';function element(){return{style:{},addEventListener(){},appendChild(){},querySelectorAll:()=>[],querySelector:()=>({addEventListener(){}}),set innerHTML(value){rendered=value;},get innerHTML(){return rendered;}};}
 f.state.document={querySelectorAll:()=>[],createElement:element,body:{appendChild(){}}};f.state.tl=(...copy)=>copy[0];
 const picker=fs.readFileSync(path.join(__dirname,'../../assets/economy-inventory.js'),'utf8');const start=picker.indexOf('function _cpGroupAdjacent(');vm.runInContext(picker.slice(start,picker.indexOf('function _scanEsc(',start)),f.state);
 f.state._showClaimPicker(f.claims.filter(c=>c.owner===owner),'shield','Use item');
 assert.match(rendered,/MobileQA002/);assert.match(rendered,/1 claim/);assert.match(rendered,/25px/);assert.doesNotMatch(rendered,/2 merged|50px/);assert.equal((rendered.match(/data-claim-id=/g)||[]).length,1);
});
