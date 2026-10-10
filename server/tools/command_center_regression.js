#!/usr/bin/env node
// Exercises the shipped browser entry points and delegated UI events without a browser or DB.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const source=fs.readFileSync(path.resolve(__dirname,'../../assets/command-center.js'),'utf8');
const ids=['first_sortie','secure_node','move_yield','restore_fleet','hold_front'];
function classes(){const values=new Set();return {add:x=>values.add(x),remove:x=>values.delete(x),contains:x=>values.has(x),toggle:(x,on)=>on?values.add(x):values.delete(x)};}
function element(){return {innerHTML:'',textContent:'',hidden:false,isConnected:true,disabled:false,attrs:{},events:{},classList:classes(),insertAdjacentHTML(position,html){this.innerHTML+=html;},setAttribute(k,v){this.attrs[k]=v;},addEventListener(k,f){this.events[k]=f;},focus(){this.focused=true;}};}
function harness(){
 const body=element(),status=element(),heading=element(),close=element(),root=element();root.hidden=true;
 const nav=['front','fleet','missions','base'].map(tab=>Object.assign(element(),{dataset:{commandNav:tab},querySelector(){return this.label ||= element();}}));
 root.querySelector=s=>s==='.cc-body'?body:s==='.cc-status'?status:s==='h2'?heading:close;
 const document={readyState:'complete',hidden:false,events:{},body:{classList:classes()},activeElement:element(),getElementById:id=>id==='commandCenter'?root:id==='ccCargoAmount'?{value:'20'}:null,querySelectorAll:()=>nav,addEventListener(k,f){this.events[k]=f;}};
 const calls=[],opened=[],confirmations=[];let token='session',active=null,missionStatus='active',mode='private_training',confirm=true,router;
 const fleet={id:41,name:'SERVER FLEET',ships_alive:3,total_hp:300,total_max_hp:400,formation:'wedge',movement:'advance',current_battle_id:null,is_in_battle:false};
 const frontier=()=>({ownerKey:'owner',mode,nodes:[{id:11,node_type:'resource',name:'Mine',owner_key:active==='secure_node'||(!active&&mode==='guild_front')?'enemy':'owner',stored_batches:1,production_at:new Date().toISOString()}],stocks:[],cargo:[],battles:[],score:{hold_points:0,delivery_points:0},objective:{complete:false}});
 const missions=()=>({currentMissionId:active||'first_sortie',starterFleet:{fleetId:41},missions:ids.map(id=>({id,status:id===active?missionStatus:'locked',objectives:[]}))});
 const quote={ship_id:101,target_hp:1200,iron_used:8,gp_cost:13,target_hp_pct:100};
 function response(value,ok=true){return {ok,json:async()=>value};}
 const window={addEventListener(){},openFactionModal(){opened.push('faction');}};
 const context={window,document,LANG:'en',localStorage:{getItem:()=>token},getAuthHeaders:()=>token?{Authorization:'Bearer '+token}:{},URL,console,Date,Number,String,Promise,Set,Array,Object,encodeURIComponent,
  openFactionModal(){opened.push('faction');},closeBaseModal(){},openAuthModal(){opened.push('auth');},openBattleViewer(id){opened.push('battle:'+id);},gameConfirm:async q=>{confirmations.push(q);return confirm;},
  fetch:async(url,options)=>{const call={url,method:options.method,body:options.body?JSON.parse(options.body):undefined};calls.push(call);if(router){const r=await router(call);if(r)return r;}if(call.method==='POST')return response({success:true});if(url==='/api/fleets')return response({fleets:[fleet]});if(url==='/api/frontier/state')return response(frontier());if(url==='/api/starter-ops/frontier-state')return response({...frontier(),mode:'private_training'});if(url==='/api/starter-ops/state')return response(missions());if(url==='/api/fleets/41')return response({fleet:{...fleet,ships:[{id:101,ship_type_code:'mcc_frg',role:'dps',max_hp:1000,bonus_hp:200,current_hp:500}]}});if(url.startsWith('/api/frontier/repair-quote'))return response(quote);if(url.startsWith('/api/starter-ops/repair-quote'))return response({success:true,quote});throw Error('Unexpected endpoint '+url);}};
 for(const [action,fn] of Object.entries({'openFleetCmd':'fleet','openShipyard':'collection','openShipCardWorkshop':'cards','openFleetFieldGuide':'guide','openGacha':'gacha','openBattleHub':'hub','openTacticalLab':'practice','openCampaignHub':'story','openBaseModal':'base','toggleMyLand':'land','activateLandSelect':'claim'}))window[action]=()=>opened.push(fn);
 vm.createContext(context);vm.runInContext(source,context);
 async function flush(){for(let i=0;i<8;i++)await Promise.resolve();await new Promise(resolve=>setImmediate(resolve));}
 async function open(tab){window.openCommandCenter(tab);await flush();}
 async function click(action,id){if(!['close','refresh'].includes(action))assert.ok(body.innerHTML.includes('data-cc="'+action+'"'),'Action must be reachable: '+action);const b=Object.assign(element(),{dataset:{cc:action,id:id==null?undefined:String(id)}});await root.events.click({target:{closest:()=>b}});await flush();}
 return {body,status,root,heading,calls,opened,confirmations,quote,fleet,context,window,nav,response,flush,open,click,
  set active(x){active=x;},set missionStatus(x){missionStatus=x;},set token(x){token=x;},set mode(x){mode=x;},set confirm(x){confirm=x;},set router(x){router=x;}};
}
async function main(){
 // Logged-out entry and stale response isolation across real navigation entry points.
 let h=harness();h.token=null;await h.open('front');assert.ok(h.body.innerHTML.includes('Sign in / join'));assert.equal(h.calls.length,0);await h.click('login');assert.deepEqual(h.opened,['auth']);assert.equal(h.root.hidden,true);
 h=harness();let release;h.router=c=>c.url==='/api/frontier/state'?new Promise(resolve=>release=()=>resolve(h.response({ownerKey:'owner',mode:'private_training',nodes:[],stocks:[],cargo:[],battles:[]}))):null;
 h.window.openCommandCenter('front');await h.flush();await h.open('fleet');assert.ok(h.body.innerHTML.includes('SERVER FLEET'));release();await h.flush();assert.ok(h.body.innerHTML.includes('SERVER FLEET'));assert.ok(!h.body.innerHTML.includes('supply line'));
 h=harness();let releaseLogout;h.router=c=>c.url==='/api/frontier/state'?new Promise(resolve=>releaseLogout=()=>resolve(h.response({ownerKey:'owner',mode:'private_training',nodes:[],stocks:[],cargo:[],battles:[]}))):null;
 h.window.openCommandCenter('front');await h.flush();h.token=null;await h.open('base');assert.ok(h.body.innerHTML.includes('Sign in / join'));releaseLogout();await h.flush();assert.ok(h.body.innerHTML.includes('Sign in / join'),'An old authenticated request must not overwrite the logged-out screen');
 h=harness();await h.open('fleet');assert.ok(h.body.innerHTML.includes('3 ships'));assert.ok(h.body.innerHTML.includes('HP 300 / 400'));await h.click('fleet-detail',41);assert.ok(h.body.innerHTML.includes('HP 500 / 1,200'));await h.click('tab','fleet');assert.ok(h.body.innerHTML.includes('SERVER FLEET'));
 // Each operation sends intent to the server route; no client evidence/completion is invented.
 const cases=[['secure_node','attack',11,'attack_node'],['move_yield','collect',11,'collect_production'],['move_yield','cargo',null,'start_cargo'],['hold_front','defense',11,'save_defense']];
 for(const [mission,action,id,intent] of cases){h=harness();h.active=mission;await h.open('front');await h.click(action,id);const post=h.calls.find(c=>c.method==='POST');assert.equal(post.url,'/api/starter-ops/'+mission+'/action');assert.equal(post.body.action,intent);if(['attack','cargo','defense'].includes(action))assert.equal(post.body.fleetId,'41');assert.equal(post.body.sourceId,undefined);assert.equal(post.body.complete,undefined);}
 h=harness();h.active='move_yield';await h.open('front');await h.click('check-cargo');assert.equal(h.calls.find(c=>c.method==='POST').body.action,'check_cargo');
 h=harness();h.active='restore_fleet';await h.open('front');await h.click('operation-repair');await h.click('repair-quote',101);let post=h.calls.find(c=>c.method==='POST');assert.equal(post.url,'/api/starter-ops/restore_fleet/action');assert.deepEqual(post.body.expectedQuote,h.quote);assert.equal(post.body.shipId,'101');assert.equal(post.body.targetHpPct,100);assert.ok(h.calls.some(c=>c.url.startsWith('/api/starter-ops/repair-quote')));assert.ok(!h.calls.some(c=>c.url.startsWith('/api/frontier/repair-quote')));
 // Active and completed-but-unclaimed operations use a private context, even for guild members.
 h=harness();h.mode='guild_front';h.active='secure_node';await h.open('front');assert.ok(h.calls.some(c=>c.url==='/api/starter-ops/frontier-state'));assert.ok(!h.calls.some(c=>c.url==='/api/frontier/state'));await h.click('attack',11);assert.equal(h.confirmations.length,0);assert.equal(h.calls.find(c=>c.method==='POST').body.riskConsent,false);
 h=harness();h.mode='guild_front';h.active='secure_node';h.missionStatus='completed';await h.open('front');assert.ok(h.calls.some(c=>c.url==='/api/starter-ops/frontier-state'));assert.ok(h.body.innerHTML.includes('data-cc="claim-mission"'));for(const a of ['attack','cargo','defense'])assert.ok(!h.body.innerHTML.includes('data-cc="'+a+'"'));
 h=harness();h.mode='guild_front';h.active='secure_node';h.missionStatus='claimed';await h.open('front');assert.ok(h.calls.some(c=>c.url==='/api/frontier/state'));assert.ok(!h.calls.some(c=>c.url==='/api/starter-ops/frontier-state'));
 // Pending mutations accept one click and cannot overwrite a later logged-out screen.
 h=harness();h.active='secure_node';let releaseMutation;h.router=c=>c.method==='POST'?new Promise(resolve=>releaseMutation=()=>resolve(h.response({success:true}))):null;await h.open('front');const pending=h.click('attack',11);await h.flush();await h.click('attack',11);assert.equal(h.calls.filter(c=>c.method==='POST').length,1);h.token=null;await h.open('base');assert.ok(h.body.innerHTML.includes('Sign in / join'));releaseMutation();await pending;assert.ok(h.body.innerHTML.includes('Sign in / join'),'A completed old mutation must not overwrite a later logged-out screen');
 // Declining permanent-loss consent never calls mutation; accepting sends explicit consent.
 h=harness();h.mode='guild_front';h.confirm=false;await h.open('front');await h.click('attack',11);assert.equal(h.calls.filter(c=>c.method==='POST').length,0);assert.ok(h.confirmations[0].body.includes('permanently destroyed'));h.confirm=true;await h.click('attack',11);post=h.calls.find(c=>c.method==='POST');assert.equal(post.body.riskConsent,true);
 // Failed actions keep actionable error feedback and never claim successful server completion.
 h=harness();h.active='secure_node';h.router=c=>c.method==='POST'?h.response({error:'FLEET_IN_BATTLE'},false):null;await h.open('front');await h.click('attack',11);assert.ok(h.status.textContent.includes('already fighting'));assert.ok(!h.status.textContent.includes('Saved on the server'));
 h=harness();h.router=c=>c.method==='POST'?h.response({error:'FACTION_REQUIRED'},false):null;await h.open('missions');await h.click('start-mission','first_sortie');assert.ok(h.status.textContent.includes('faction'));assert.ok(h.body.innerHTML.includes('data-cc="faction"'),'Faction-required starter failure needs a reachable recovery action');await h.click('faction');assert.ok(h.opened.includes('faction'));
 // Close during loading invalidates the request and preserves focus/navigation state.
 h=harness();let releaseClose;h.router=c=>c.url==='/api/frontier/state'?new Promise(resolve=>releaseClose=()=>resolve(h.response({ownerKey:'owner',mode:'private_training',nodes:[],stocks:[],cargo:[],battles:[]}))):null;h.window.openCommandCenter('front');await h.flush();await h.click('close');releaseClose();await h.flush();assert.equal(h.root.hidden,true);assert.ok(h.body.innerHTML.includes('Loading operation state'));
 console.log('PASS shipped command-center VM: login and stale-response isolation; exact fleet/detail fields and return; mission2–5 server intents; quote forwarding; declined/accepted permanent-loss consent; errors without fake completion; first-mission faction recovery; close invalidation. Browser geometry remains parent-owned.');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
