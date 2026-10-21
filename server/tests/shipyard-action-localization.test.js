'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.resolve(__dirname,'../../assets/shipyard-modal.js'),'utf8');
const langs=['en','ko','ja','zh','id','vi','th'];
function part(a,b){return source.slice(source.indexOf(a),source.indexOf(b,source.indexOf(a)));}
function fixture(lang='en',ships=[]){
 const list={innerHTML:''},dialogs=[],requests=[],messages=[],labels=[];let approve=false,input=null;
 const ship={id:7,name_ko:'서버 이름',name_en:'Verdant',max_hp:100,current_hp:100,shield_hp:0,shield_max:20,faction_code:'mcc',base_atk:10,base_def:5,base_speed:1,...ships[0]};
 const c={LANG:lang,shipyardState:{ships:[ship],myFaction:{code:'mcc'}},document:{getElementById:()=>list},escapeHTML:String,syShipName:s=>s.name_en,syClassLabel:v=>v,syFmt:String,syStatValue:v=>String(v),syUpgradeBtn:()=>'',renderPermanentCollection:()=>'',renderShipRepairSummary:()=>'',getAuthHeaders:()=>({fixture:'only'}),srvErr:String,refreshBalance(){},refreshShipyard:async()=>{},markDailyOpsAction(){},console:{log(){}},
 tl:(...args)=>{labels.push(args);return args[langs.indexOf(lang)]||args[0];},_syReadJson:async()=>({gp_cost:3,iron_used:2,target_hp:100,healed:50}),gameConfirm:async data=>{dialogs.push(data);return approve;},gameInput:async data=>{dialogs.push(data);return input;},showFactionToast:(text,type)=>messages.push({text,type}),fetch:async(url,options)=>{requests.push({url,...options});return{ok:true,json:async()=>({healed:50,gp_cost:3,shield_added:20,price_gp:1200})};}};
 vm.createContext(c);
 for(const[a,b]of[['function renderShips() {','function renderShipRepairSummary('],['async function syRepairShip(','async function syScrapShip('],['async function syChargeShield(','function filterMarketFaction('],['async function syListShipForSale(','async function syCancelShipListing(']])vm.runInContext(part(a,b),c);
 return{c,list,ship,dialogs,requests,messages,labels,set approve(v){approve=v;},set input(v){input=v;}};
}
for(const lang of langs)test('actual MY FLEET actions and aria labels localize in '+lang+' without changing action data or disabled rules',()=>{
 const f=fixture(lang);f.c.renderShips();const html=f.list.innerHTML;
 const full=f.labels.find(a=>a[0]==='Full HP')[langs.indexOf(lang)],shield=f.labels.find(a=>a[0]==='Shield')[langs.indexOf(lang)],sale=f.labels.find(a=>a[0]==='List for sale')[langs.indexOf(lang)];
 assert.match(html,new RegExp('<button disabled aria-label="'+full+'"'));assert.ok(html.includes('✅ '+full));assert.ok(html.includes('aria-label="'+shield+'" data-action="syChargeShield" data-ship-id="7"'));assert.ok(html.includes('aria-label="'+sale+'" class="ship-sale-btn" onclick="syListShipForSale(7)"'));
 f.ship.current_hp=50;f.c.renderShips();const repair=f.labels.find(a=>a[0]==='Repair')[langs.indexOf(lang)];assert.ok(f.list.innerHTML.includes('aria-label="'+repair+'" data-action="syRepairShip" data-ship-id="7"'));assert.ok(f.list.innerHTML.includes('data-current-hp="50" data-effective-max-hp="100"'));
 f.ship.is_market_listed=true;f.ship.market_listing_id=99;f.ship.market_price_gp=1200;f.c.renderShips();assert.ok(!f.list.innerHTML.includes('data-action="syRepairShip"'));assert.ok(f.list.innerHTML.includes('<button disabled aria-label="'+shield+'" data-action="syChargeShield"'));assert.ok(f.list.innerHTML.includes('onclick="syCancelShipListing(99)"'));assert.ok(f.list.innerHTML.includes('1200 GP'));
 for(const args of f.labels.filter(a=>['Repair','Full HP','Shield','List for sale','Listed','Cancel listing'].includes(a[0])))assert.equal(args.length,7);
});
for(const lang of langs)test('repair, shield and sale essentials use explicit '+lang+' copy; declining never posts',async()=>{
 const f=fixture(lang);await f.c.syRepairShip(7,'Verdant',50,100);await f.c.syChargeShield(7,'Verdant',100,0,20);await f.c.syListShipForSale(7);
 assert.equal(f.dialogs.length,3);assert.equal(f.requests.length,0);
 for(const args of f.labels){assert.equal(args.length,7);assert.ok(args[langs.indexOf(lang)].length>0);}
 assert.equal(f.dialogs[0].info[0].v,'3 GP');assert.equal(f.dialogs[1].info[0].v,'1 GP');assert.equal(f.dialogs[2].maxLength,16);
 if(lang==='en'){assert.equal(f.dialogs[0].title,'🔧 Repair Ship');assert.equal(f.dialogs[1].confirmText,'🛡 Charge');assert.equal(f.dialogs[2].label,'Verdant Sale Price (GP)');}
});
test('accepted localized actions preserve the exact repair/shield/list endpoints and request payloads',async()=>{
 const f=fixture();f.approve=true;await f.c.syRepairShip(7,'Verdant',50,100);await f.c.syChargeShield(7,'Verdant',100,0,20);f.input='1,200';await f.c.syListShipForSale(7);
 assert.deepEqual(f.requests.map(r=>r.url),['/api/ships/7/repair','/api/ships/7/shield','/api/ships/7/list']);assert.deepEqual(f.requests.map(r=>JSON.parse(r.body)),[{target_hp_pct:100},{units:20},{price_gp:1200}]);assert.ok(f.requests.every(r=>r.method==='POST'));assert.ok(f.messages.some(m=>m.text==='🔧 Repair complete! +50 HP (-3 GP)'));
});
