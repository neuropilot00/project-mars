'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require('node:path').join(__dirname,'../server/services/battleEngine.js'),'utf8');
const fn=source.slice(source.indexOf('function updateShipPositions('),source.indexOf('function findNearestEnemyShip('));
function facing(side,formation='wedge'){
 const enemy={x:side==='atk'?890:110,y:66};
 const ship={isAlive:true,isFlagship:true,x:0,y:0,facing:0,hp:500,maxHp:500};
 const fleet={cx:side==='atk'?110:890,cy:66,facingAngle:side==='atk'?0:Math.PI,formation,ships:[ship]};
 const c={Math,findNearestEnemyShip:()=>enemy};vm.createContext(c);vm.runInContext(fn,c);c.updateShipPositions(fleet,{});return {ship,fleet};
}
for(const formation of ['wedge','sphere','screen'])test('flagship aims at the opposing fleet in '+formation,()=>{
 const attacker=facing('atk',formation),defender=facing('def',formation);
 assert.equal(attacker.ship.facing,0);assert.equal(defender.ship.facing,Math.PI);
 assert.equal(attacker.ship.x,attacker.fleet.cx);assert.equal(defender.ship.x,defender.fleet.cx);
 assert.equal(defender.ship.hp,500,'facing update cannot alter health');
});
