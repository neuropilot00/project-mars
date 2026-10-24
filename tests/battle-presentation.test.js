'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../assets/tactical-lab-v11.html'),'utf8');
const source=html.match(/<script>([\s\S]*)<\/script>/)[1];
function extract(a,b){const start=source.indexOf(a),end=source.indexOf(b,start);assert.ok(start>=0&&end>start);return source.slice(start,end);}
function projection(){const c={Math,Set};vm.createContext(c);vm.runInContext(extract('function objectiveMapPoint(','function renderObjectiveBanner('),c);return c;}
test('main battlefield maps attack below defense and preserves scale without rotating situation map',()=>{
 const c=projection(),a=c.battleWorldPoint(100,220,460,600),d=c.battleWorldPoint(900,220,460,600);
 assert.equal(a.x,d.x);assert.ok(a.y>d.y);assert.equal(a.scale,d.scale);
 const mapA=c.objectiveMapPoint(100,220,460,180),mapD=c.objectiveMapPoint(900,220,460,180);
 assert.ok(mapA.x<mapD.x);assert.equal(mapA.y,mapD.y);
});
test('legacy zero-facing flagships visually aim at the actual opposing recorded ship',()=>{
 const c=projection(),frame={fleets:[{id:1,side:'atk',cx:100,cy:220},{id:2,side:'def',cx:900,cy:220}],ships:[{fid:1,x:100,y:220,hp:100,ff:true,facing:0},{fid:2,x:900,y:220,hp:100,ff:true,facing:0}]};
 assert.equal(c.battleShipFacing(frame.ships[0],frame),-Math.PI/2);assert.equal(c.battleShipFacing(frame.ships[1],frame),Math.PI/2);
 const snapshot=JSON.stringify(frame);c.battleShipPoint(frame.ships[0],frame,460,600);assert.equal(JSON.stringify(frame),snapshot,'display transform cannot alter server state');
});
test('small fleet spacing preserves relative formation order and its central flagship',()=>{
 const c=projection(),frame={fleets:[{id:1,cx:100,cy:220}],ships:[{fid:1,x:100,y:220},{fid:1,x:100,y:200},{fid:1,x:100,y:240}]};
 const [center,left,right]=frame.ships.map(s=>c.battleShipPoint(s,frame,460,600));
 assert.equal(center.x,230);assert.ok(left.x<center.x&&right.x>center.x);assert.ok(Math.abs((center.x-left.x)-(right.x-center.x))<0.000001);
});
test('minimum visual hull lengths retain frigate through titan hierarchy at mobile scale',()=>{
 const c={Math,CVs:{getBoundingClientRect:()=>({width:320,height:418})},W:460,H:600,camScale:1,_frameLiving:4,SHIP_SPRITES:{}};vm.createContext(c);
 vm.runInContext(extract('function shipDisplayMetrics(','// [v7.404] FACTIONS'),c);
 const values=['frigate','destroyer','cruiser','battleship','titan'].map(size=>{const s={type:{code:size,size,r:2}};const m=c.shipDisplayMetrics(s);return c.shipVisualLength(s.type)*m.scale*m.pixelScale;});
 for(let i=1;i<values.length;i++)assert.ok(values[i]>values[i-1]*1.3);
 assert.ok(values[4]>values[0]*3.5);
});
function dock(){
 class Node{
  constructor(){this.children=[];this.dataset={};this.hidden=false;this.disabled=false;this.textContent='';this.value='';this.style={setProperty:(k,v)=>{this[k]=v;}};this.attrs={};this.classList={toggle(){}};}
  appendChild(n){n.parent=this;this.children.push(n);return n;}remove(){this.parent.children=this.parent.children.filter(n=>n!==this);}setAttribute(k,v){this.attrs[k]=v;}hasAttribute(k){return Object.hasOwn(this.attrs,k);}querySelector(tag){return this.children.find(n=>n.tag===tag)||null;}
 }
 const nodes={};for(const id of ['battleCommandDock','combatCommandTray','combatTrayOptions','combatTrayTitle','combatDoctrineLabel','combatTargetLabel','combatDoctrineValue','combatTargetValue','combatWeaponName','combatDockStatus','combatFire','combatCharge','doctrineChoice','skillChoice','focusChoice'])nodes[id]=new Node();
 nodes.doctrineChoice.value='breakthrough';nodes.skillChoice.value='beam';nodes.focusChoice.options=[{value:'22',textContent:'Enemy · HP 90%'}];
 const calls=[],mine={beamCharge:45,missileCharge:100,overdriveCharge:0,hasAssembled:false};
 const c={document:{getElementById:id=>nodes[id]||null,querySelectorAll:()=>[],createElement:tag=>Object.assign(new Node(),{tag})},Math,Map,Array,JSON,Number,String,TLANG:'ko',TL_MODE:'battle',ownedLiveFleet:()=>mine,_pendingCommands:new Map(),focusFleet:null,fleets:[],commandText:k=>k,tl:k=>k,cmdDoctrine:()=>calls.push('doctrine:'+nodes.doctrineChoice.value),cmdFocus:()=>calls.push('focus:'+nodes.focusChoice.value),cmdSelectedSkill:()=>calls.push('fire:'+nodes.skillChoice.value),updateCommandDeck:()=>c.updateCombatDock(true,'live')};
 vm.createContext(c);vm.runInContext(extract("let combatPanel=''",'function updateCommandDeck('),c);
 function click(dataset,attr){const control=new Node();control.dataset=dataset;if(attr)control.attrs[attr]='';control.disabled=attr==='data-combat-fire'?nodes.combatFire.disabled:false;c.handleCombatDockClick({target:{closest:()=>control}});}
 return {c,nodes,calls,mine,click};
}
test('dock transmits a chosen doctrine and a valid enemy only, with no automatic skill fire',()=>{
 const f=dock();f.c.updateCombatDock(true,'live');
 f.click({combatPanel:'doctrine'});assert.equal(f.nodes.combatTrayOptions.children.length,3);
 f.click({combatChoice:'doctrine',value:'flank'});assert.deepEqual(f.calls,['doctrine:flank']);assert.equal(f.nodes.combatCommandTray.hidden,true);
 f.click({combatChoice:'target',value:'foreign'});assert.equal(f.calls.length,1);
 f.click({combatChoice:'target',value:'22'});assert.equal(f.calls.at(-1),'focus:22');
 f.click({combatChoice:'skill',value:'missile'});assert.equal(f.nodes.skillChoice.value,'missile');assert.ok(!f.calls.some(x=>x.startsWith('fire:')));
 f.click({},'data-combat-fire');assert.equal(f.calls.at(-1),'fire:missile');
});
test('charging, replay and disconnected docks cannot fire or issue combat commands',()=>{
 for(const [enabled,mode]of[[true,'live'],[false,'replay'],[false,'disconnected']]){const f=dock();f.c.updateCombatDock(enabled,mode);f.click({},'data-combat-fire');assert.equal(f.calls.length,0);if(!enabled){f.click({combatChoice:'doctrine',value:'flank'});f.click({combatChoice:'target',value:'22'});assert.equal(f.calls.length,0);}}
});
test('live target HP refresh preserves the same target button under an active touch',()=>{
 const f=dock();f.c.updateCombatDock(true,'live');f.click({combatPanel:'target'});const control=f.nodes.combatTrayOptions.children[0];
 f.nodes.focusChoice.options[0].textContent='Enemy · HP 80%';f.c.updateCombatDock(true,'live');assert.equal(f.nodes.combatTrayOptions.children[0],control);assert.equal(control.children[0].textContent,'Enemy · HP 80%');
});
test('confirmed beam and missile events produce distinct bounded visual-only effects and dedupe',()=>{
 const c={Math,Set,Number,String,Array,TL_MODE:'battle',camScale:1,ships:[],lasers:[],weaponColor:()=> '#6fc',W:460,H:600};vm.createContext(c);
 vm.runInContext(extract('function objectiveMapPoint(','function renderObjectiveBanner(')+extract('function syncServerCombatEvents(','function fleetRoleText('),c);
 const event=type=>({id:'confirmed-'+type,type:'shot_hit',fire_type:type,source_side:'atk',source_ship_id:1,target_ship_id:2,from:{x:100,y:220},to:{x:900,y:220}});
 const frame={t:1,combat_events:[event('beam'),event('missile')]};c.syncServerCombatEvents(frame);
 assert.equal(c.lasers.length,2);assert.equal(c.lasers[0].beamCannon,true);assert.equal(c.lasers[0].ttl,120);assert.equal(c.lasers[1].projectile,true);
 assert.ok(c.lasers.every(x=>x.visual&&x.dmg===0&&x.applied));c.syncServerCombatEvents(frame);assert.equal(c.lasers.length,2);
});

test('final battle composition holds on a one-sided or ended snapshot and resumes on replay seek',()=>{
 const c={};vm.createContext(c);vm.runInContext(extract('function shouldHoldBattleCamera(','function battleDeathPoint('),c);
 assert.equal(c.shouldHoldBattleCamera('battle',false,1,1),false);
 assert.equal(c.shouldHoldBattleCamera('battle',false,1,0),true);
 assert.equal(c.shouldHoldBattleCamera('battle',true,1,1),true);
 assert.equal(c.shouldHoldBattleCamera('battle',false,1,1),false);
 assert.equal(c.shouldHoldBattleCamera('sandbox',false,1,0),false);
});
test('destroyed ship explodes at its last visible hull location, with projection only as fallback',()=>{
 const c={ships:[{dbShipId:42,x:109,y:314,dead:true}],Number,String,W:460,H:600,battleWorldPoint:()=>({x:20,y:40})};vm.createContext(c);vm.runInContext(extract('function battleDeathPoint(','const BATTLE_VIEWPORT_RIM='),c);
 assert.deepEqual(JSON.parse(JSON.stringify(c.battleDeathPoint('42',{x:5,y:6}))),{x:109,y:314});
 assert.deepEqual(JSON.parse(JSON.stringify(c.battleDeathPoint(43,{x:5,y:6}))),{x:20,y:40});
});

test('result art metadata includes real destroyed hulls and excludes local catalogue ships',()=>{
 const c={TL_MODE:'battle',TL_QUERY:new URLSearchParams('bid=1507'),ships:[{dbShipId:1,tid:'fsp_int',dead:true,fleet:{dbFleetId:11}},{tid:'fake',fleet:{dbFleetId:11}}],fleets:[{dbFleetId:11,side:'atk'}]};
 vm.createContext(c);vm.runInContext(extract('function battleResultArtSnapshot(','const BATTLE_VIEWPORT_RIM='),c);
 const actual=JSON.parse(JSON.stringify(c.battleResultArtSnapshot()));assert.deepEqual(actual,{battleId:'1507',ships:[{id:1,fid:11,code:'fsp_int'}],fleets:[{id:11,side:'atk'}]});
});
