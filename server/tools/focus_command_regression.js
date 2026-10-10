#!/usr/bin/env node
// Exercise actual engine target selection/damage with deterministic randomness.
// Private helpers are exposed only inside this VM; no DB, HTTP, or app export changes.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const filename = path.join(__dirname, '../services/battleEngine.js');
const source = fs.readFileSync(filename, 'utf8');
const fixedMath = Object.create(Math);
fixedMath.random = () => 0.5;
const sandbox = {
  module: { exports: {} }, console, Math: fixedMath,
  require(name) {
    if (name === '../db') return { pool: { query() { throw Error('Unexpected DB access'); } }, getSetting() { throw Error('Unexpected settings access'); } };
    if (name === './battleEnvironment') return { decorateBattle: b => b };
    return {};
  },
};
vm.runInNewContext(source + '\nmodule.exports.__test = { initBattleState, processCombat };', sandbox, { filename });
const engine = sandbox.module.exports;
const { initBattleState, processCombat } = engine.__test;

function fixture({ farId = '33', fleetIdsAsNumbers = false, preBattleTarget } = {}) {
  const ids = ['11','22',farId];
  const fleets = ids.map((id,i) => ({
    fleet_id: fleetIdsAsNumbers ? Number(id) : id, fleet_name: 'fixture',
    owner_wallet: i === 0 ? 'own-wallet' : 'enemy-'+i, side: i === 0 ? 'atk' : 'def',
    formation:'line', movement:'advance',
    ships:[{ id:String(100+i),ship_type_code:'qa_ship',role:'dps',size_class:'cruiser',
      current_hp:10000,max_hp:10000,is_flagship:true,
      base_atk:100,base_def:0,base_speed:1,fire_interval:i===0?200:1e9,fire_type:'gun',shots:1 }],
  }));
  const data = { battle:{id:'1',battle_type:'pvp_duel'},fleets };
  if (preBattleTarget !== undefined) data.commanderActions={focusFireByWallet:{'own-wallet':preBattleTarget}};
  const state=initBattleState(data);
  state.focusFireDmgBonus=15;
  state.fleets.forEach((f,i)=>{f.cx=[100,200,800][i];f.cy=100;f.ships[0].x=f.cx;f.ships[0].y=100;f.ships[0].shootT=0;});
  return state;
}
function shoot(state) {
  processCombat(state,[]);
  return { nearDamage:10000-state.fleets[1].ships[0].hp, farDamage:10000-state.fleets[2].ships[0].hp, ownDamage:state.fleets[0].ships[0].damageDealt };
}
function focus(state,target,wallet='own-wallet') {
  return engine.applyLiveCommand(state,{fleetId:state.fleets[0].id,wallet,action:'focus',params:{targetFleetId:target}});
}
const results=[];
function test(name,fn) {
  try {fn();results.push({name,passed:true});console.log('PASS '+name);}
  catch(e){results.push({name,passed:false,error:e.message});console.error('FAIL '+name+': '+e.message);}
}
const reference=fixture();
assert.equal(focus(reference,'33'),true);
const expected=shoot(reference);
const normal=shoot(fixture());
assert.equal(normal.farDamage,0);
assert.ok(expected.farDamage>normal.nearDamage);
assert.equal(expected.farDamage,Math.floor(normal.nearDamage*1.15));

test('numeric live target selects farther DB-string enemy and applies 15% bonus',()=>{
  const state=fixture();assert.equal(focus(state,33),true);assert.deepEqual(shoot(state),expected);
});
test('numeric saved commander action selects farther DB-string enemy and applies bonus',()=>{
  assert.deepEqual(shoot(fixture({preBattleTarget:33})),expected);
});
test('string target still works against numeric fleet state',()=>{
  const state=fixture({fleetIdsAsNumbers:true});assert.equal(focus(state,'33'),true);assert.deepEqual(shoot(state),expected);
});
test('BIGINT string above safe Number selects exact enemy without rounding',()=>{
  for (const id of ['9007199254740993','9223372036854775807']) {
    const state=fixture({farId:id});
    state.fleets[1].id=(BigInt(id)-1n).toString();
    assert.equal(focus(state,id),true);assert.deepEqual(shoot(state),expected);
  }
});
test('BIGINT value is stored as a JSON-safe canonical string',()=>{
  const state=fixture({farId:'9007199254740993'});
  assert.equal(focus(state,9007199254740993n),true);
  assert.equal(state.fleets[0].focusFireTargetId,'9007199254740993');
  assert.doesNotThrow(()=>JSON.stringify(state));assert.deepEqual(shoot(state),expected);
});
test('leading-zero target selects the same enemy',()=>{
  const state=fixture();assert.equal(focus(state,'00033'),true);assert.deepEqual(shoot(state),expected);
});
test('invalid ids cannot select an enemy or grant a bonus',()=>{
  for(const id of [null,undefined,0,-1,'', '33junk','3.3',{},'9223372036854775808',Number('9007199254740993')]){
    const state=fixture();assert.equal(focus(state,id),true);
    assert.deepEqual(shoot(state),normal,'id '+String(id));
  }
  const rounded=fixture({farId:'9007199254740993'});
  rounded.fleets[1].id='9007199254740992';
  assert.equal(focus(rounded,Number('9007199254740993')),true);
  assert.deepEqual(shoot(rounded),normal,'unsafe number must not focus the rounded neighboring id');
});
test('unknown and allied ids retain enemy-only selection and no bonus',()=>{
  for(const id of ['11','44']){
    const state=fixture();assert.equal(focus(state,id),true);
    assert.deepEqual(shoot(state),normal);assert.equal(state.fleets[0].ships[0].hp,10000);
  }
});
test('retreated and dead target selection falls back to nearest active enemy',()=>{
  for(const kind of ['retreated','dead']){
    const state=fixture();
    if(kind==='retreated')state.fleets[2].retreated=true;else state.fleets[2].ships[0].isAlive=false;
    assert.equal(focus(state,'33'),true);assert.deepEqual(shoot(state),normal);
  }
});
test('existing focus stops granting bonus after target retreats',()=>{
  const state=fixture();assert.equal(focus(state,'33'),true);state.fleets[2].retreated=true;
  assert.deepEqual(shoot(state),normal);
});
test('owner validation remains enforced',()=>{
  const state=fixture();assert.equal(focus(state,'33','other-wallet'),false);assert.deepEqual(shoot(state),normal);
});
test('malformed or unsafe saved commander target gives no bonus',()=>{
  for(const id of ['33junk',Number('9007199254740993')])assert.deepEqual(shoot(fixture({preBattleTarget:id})),normal);
});
const failed=results.filter(r=>!r.passed).length;
console.log(JSON.stringify({checks:results.length,passed:results.length-failed,failed,damageEvidence:{normal,focused:expected},databaseUsed:false}));
process.exitCode=failed?1:0;
