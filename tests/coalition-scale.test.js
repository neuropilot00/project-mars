'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const engineSource=fs.readFileSync(path.join(__dirname,'../server/services/battleEngine.js'),'utf8');
function engine(){const c={module:{exports:{}},console,require(n){if(n==='../db')return{};if(n==='./battleEnvironment')return require('../server/services/battleEnvironment');if(n==='./tacticsAI')return require('../server/services/tacticsAI');throw Error('No dependency '+n);}};vm.createContext(c);vm.runInContext(engineSource+'\nmodule.exports.initBattleState=initBattleState;',c);return c.module.exports;}
function fleets(n){return['atk','def'].flatMap((side,i)=>Array.from({length:n},(_,j)=>({fleet_id:i*n+j+1,side,owner_wallet:'owner'+Math.floor(j/2),ships:[{id:i*n+j+1,base_atk:1,base_def:1,base_speed:1,current_hp:100,max_hp:100,fire_interval:1000}]})));}
test('coalition spawn never drops the sixth or later fleet onto the shared battlefield center',()=>{const s=engine().initBattleState({battle:{id:8},fleets:fleets(8)});for(const side of ['atk','def']){const own=s.fleets.filter(f=>f.side===side);assert.equal(new Set(own.map(f=>f.cx+':'+f.cy)).size,8);assert.ok(own.every(f=>side==='atk'?f.cx<350:f.cx>650));}});
test('existing one-fleet opening stays unchanged',()=>{const s=engine().initBattleState({battle:{id:1},fleets:fleets(1)});assert.equal(s.fleets[0].cx,110);assert.equal(s.fleets[0].cy,66);assert.equal(s.fleets[1].cx,890);});
test('large battles render every surviving hull instead of hiding half the small ships',()=>{
 const html=fs.readFileSync(path.join(__dirname,'../assets/tactical-lab-v11.html'),'utf8');let drawn=0,rectReads=0;
 const c={ships:Array.from({length:100},(_,i)=>({type:{r:2,size:'frigate',faction:'mcc'},side:'atk',x:i,y:i,facing:0,flash:0,shieldMax:0,isFlagship:false,hp:100,maxHp:100})),PERF_MODE:true,_frameLiving:100,TL_MODE:'battle',Math,Date,window:{matchMedia:()=>({matches:true})},CX:new Proxy({},{get:(t,k)=>t[k]||(()=>{}),set:(t,k,v)=>(t[k]=v,true)}),CVs:{getBoundingClientRect(){rectReads++;return{width:390,height:500};}},W:460,H:600,facOf:()=>({color:'#fff'}),isSmall:()=>true,shipDisplayMetrics:()=>({scale:1,pixelScale:1,radius:4,compact:false}),drawShipByFaction:()=>{drawn++;return true;},drawEngineFlame(){}};
 vm.createContext(c);vm.runInContext(html.slice(html.indexOf('function drawShips2(){'),html.indexOf('function drawBullets(')),c);c.drawShips2();assert.equal(drawn,100);assert.ok(rectReads<=1);
});
test('600-ship presentation keeps class hierarchy while reducing per-hull size and flame length',()=>{
 const html=fs.readFileSync(path.join(__dirname,'../assets/tactical-lab-v11.html'),'utf8');
 const c={Math,CVs:{getBoundingClientRect:()=>({width:320,height:418})},W:460,H:600,camScale:.65,_frameLiving:50,SHIP_SPRITES:{}};vm.createContext(c);
 vm.runInContext(html.slice(html.indexOf('function shipDisplayMetrics('),html.indexOf('// [v7.404] FACTIONS')),c);
 const hull={type:{code:'mcc_bs',size:'battleship',r:5}},small=c.shipDisplayMetrics(hull);c._frameLiving=600;
 const dense=c.shipDisplayMetrics(hull),frig=c.shipDisplayMetrics({type:{code:'mcc_int',size:'frigate',r:2}});
 assert.ok(dense.length<small.length*.6);assert.ok(dense.length>frig.length*2);assert.ok(dense.length*dense.pixelScale<25);
 let radius=0;const ctx=new Proxy({createRadialGradient:(x,y,a,b,d,r)=>(radius=r,{addColorStop(){}})},{get:(t,k)=>t[k]||(()=>{}),set:(t,k,v)=>(t[k]=v,true)});
 c.FACTIONS={mcc:{color:'#6cf'}};vm.runInContext(html.slice(html.indexOf('function drawEngineFlame('),html.indexOf('function drawShipByFaction(')),c);
 c.drawEngineFlame(ctx,0,0,0,{...hull.type,faction:'mcc'},1,dense.scale,dense.length);
 assert.ok(radius*dense.pixelScale<9,'flagship exhaust must fit the visible hull rather than scale twice');
});
