'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../services/battleEngine.js'),'utf8');
function fixture(){
 let ai=0;const module={exports:{}};
 vm.runInNewContext(source+'\nmodule.exports.test={applyLiveCommandResult,updateFleetPosition,evaluateLiveTactics,captureFrame,getSpatialDamageMult,engagementRange};',{
  module,console,require(name){if(name==='./tacticsAI')return{evaluate(){ai++;}};return{};}
 });
 const own={id:'11',owner_wallet:'qa-owner',cx:200,cy:220,radius:30,vcx:0,vcy:0,formation:'wedge',movement:'advance',hp:100,maxHp:100,ships:[{isAlive:true,hp:100,id:'101'}]};
 const enemy={...own,id:'22',owner_wallet:'enemy',cx:800,side:'def',ships:[{isAlive:true,hp:100,id:'201'}]};own.side='atk';
 const state={tick:10,liveTickMs:120,fleets:[own,enemy],events:[],pendingCombatEvents:[]};
 const engine=module.exports.test;
 return{engine,state,own,enemy,ai:()=>ai,command(action,params={},extra={}){return engine.applyLiveCommandResult(state,{commandId:'qa-'+action,action,fleetId:'11',wallet:'qa-owner',params,...extra});}};
}
test('position orders reject forged, missing, nonfinite and off-field coordinates before changing a fleet',()=>{
 for(const params of [{},{x:'400',y:200},{x:NaN,y:200},{x:400,y:Infinity},{x:-1,y:200},{x:1001,y:200},{x:400,y:441}]){
  const f=fixture(),before=JSON.stringify(f.own);assert.equal(f.command('move',params).reason,'invalid_destination');assert.equal(JSON.stringify(f.own),before);
 }
 const f=fixture();assert.equal(f.command('move',{x:400,y:180},{wallet:'other'}).reason,'not_your_fleet');assert.equal(f.own.navigation,undefined);
 f.own.retreated=true;assert.equal(f.command('hold').reason,'fleet_unavailable');
});
test('a move is gradual, bounded by existing speed, reaches its point and holds without teleport or damage',()=>{
 const f=fixture(),result=f.command('move',{x:230,y:180});assert.equal(result.status,'applied');assert.equal(f.own.cx,200);
 let previous={x:f.own.cx,y:f.own.cy};
 for(let i=0;i<220;i++){f.engine.updateFleetPosition(f.own,f.state);assert.ok(Math.hypot(f.own.cx-previous.x,f.own.cy-previous.y)<=1.000001);previous={x:f.own.cx,y:f.own.cy};}
 assert.equal(f.own.cx,230);assert.equal(f.own.cy,180);assert.equal(f.own.vcx,0);assert.equal(f.own.hp,100);assert.equal(f.enemy.hp,100);
 f.engine.updateFleetPosition(f.own,f.state);assert.equal(f.own.cx,230);
});
test('hold stops residual velocity, persists beyond the manual doctrine timer and auto resumes AI',()=>{
 const f=fixture();f.own.vcx=.5;assert.equal(f.command('hold').status,'applied');
 for(let i=0;i<100;i++){f.state.tick+=100;f.engine.evaluateLiveTactics(f.own,f.state,[]);f.engine.updateFleetPosition(f.own,f.state);}
 assert.equal(f.own.cx,200);assert.equal(f.own.cy,220);assert.equal(f.ai(),0);
 assert.equal(f.command('auto').status,'applied');f.engine.evaluateLiveTactics(f.own,f.state,[]);assert.equal(f.ai(),1);assert.equal(f.own.navigation,null);
});
test('formation retains a position order, maneuver replaces it, and edge targets respect hull radius',()=>{
 const f=fixture();f.command('move',{x:0,y:440});assert.equal(f.own.navigation.x,38);assert.equal(f.own.navigation.y,402);
 f.command('formation',{formation:'screen'});assert.equal(f.own.navigation.mode,'move');
 assert.equal(f.command('maneuver',{movement:'rally'}).status,'applied');assert.equal(f.own.navigation,null);
});
test('authoritative snapshots clone accepted destinations for live and replay consumers',()=>{
 const f=fixture();f.command('move',{x:300,y:140});const frame=f.engine.captureFrame(f.state,10);
 assert.equal(frame.fleets[0].navigation.x,300);frame.fleets[0].navigation.x=900;assert.equal(f.own.navigation.x,300);
 f.command('auto');assert.equal('navigation' in f.engine.captureFrame(f.state,11).fleets[0],false);
});
test('actual distance and facing affect normal fire within bounds; orders alone cannot invent damage',()=>{
 const f=fixture(),mult=f.engine.getSpatialDamageMult;
 const gun={x:350,y:0,role:'dps',fireType:'bullet'},target={x:0,y:0,facing:0};
 const front=mult(gun,target),rear=mult({...gun,x:-350},target),far=mult({...gun,x:900},target);
 assert.ok(front>far);assert.ok(rear>front);assert.equal(f.engine.engagementRange({...gun,role:'sniper'}),550);
 assert.ok(mult({...gun,role:'sniper',x:400},target)>mult({...gun,role:'sniper',x:80},target));
 for(const x of [-2000,-300,-1,0,90,500,2000]){const value=mult({...gun,x},target);assert.ok(value>=.85&&value<=1.18);}
 assert.equal(mult({role:'dps'},target),1);f.command('move',{x:300,y:150});assert.equal(f.own.hp,100);assert.equal(f.enemy.hp,100);
});
