'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const filename = path.resolve(__dirname, '../services/battleEngine.js');
const box = { module: { exports: {} }, console, require(name) {
  if (name === '../db') return {};
  if (name === './battleEnvironment') return require('../services/battleEnvironment');
  if (name === './tacticsAI') return {};
  throw new Error('Unconfigured collaborator: ' + name);
} };
vm.runInNewContext(fs.readFileSync(filename, 'utf8') + '\nmodule.exports.__test={applyDamage,captureFrame,initBattleState,processCombat,_applySkill};', box, { filename });
const engine = box.module.exports.__test;
function fixture() {
  const fleets = ['atk', 'def'].map((side, i) => ({ fleet_id: String(i + 1), side, owner_wallet: 'dummy-' + side, formation: 'sphere', movement: 'advance', ships: [{ id: String(9007199254740993n + BigInt(i)), ship_type_code: 'fixture', role: 'attack', size_class: 'frigate', base_atk: 10, base_def: 2, base_speed: 4, current_hp: 100, max_hp: 100, shield_hp: i ? 20 : 0, shield_max: i ? 20 : 0, fire_interval: 1000, fire_type: 'laser', shots: 1 }] }));
  const state = engine.initBattleState({ battle: { id: '9007199254740999' }, fleets });
  state.tick = 7; state.events = [];
  const [attackerFleet, targetFleet] = state.fleets;
  const [attacker, target] = [attackerFleet.ships[0], targetFleet.ships[0]];
  Object.assign(attacker, { x: 123.45, y: 200 }); Object.assign(target, { x: 800, y: 220 });
  return { state, attackerFleet, targetFleet, attacker, target, hit(damage, fireType) { engine.applyDamage(target, targetFleet, damage, attacker, attackerFleet, state, state.events, fireType); } };
}
test('real damage emits shield absorption and exact stable IDs/coordinates in the authoritative snapshot', () => {
  const f = fixture(); f.hit(25);
  const frame = engine.captureFrame(f.state, 7), hit = frame.combat_events[0];
  assert.equal(hit.id, '9007199254740999:combat:1'); assert.equal(hit.seq, 1); assert.equal(hit.tick, 7);
  assert.equal(hit.source_ship_id, '9007199254740993'); assert.equal(hit.target_ship_id, '9007199254740994');
  assert.equal(hit.source_side, 'atk'); assert.equal(hit.target_side, 'def'); assert.equal(hit.fire_type, 'laser');
  assert.equal(hit.from.x, 123.5); assert.equal(hit.to.x, 800);
  assert.equal(hit.damage, 25); assert.equal(hit.shield_damage, 20); assert.equal(hit.hull_damage, 5); assert.equal(hit.target_hp, 95); assert.equal(hit.destroyed, false);
  assert.equal(frame.ships[1].shield_hp, 0); assert.equal(frame.ships[1].shield_max, 20); assert.equal(frame.ships[1].hp, 95);
});
test('capture drains events once while saved frame/resend IDs and later sequence remain stable', () => {
  const f = fixture(); f.hit(1);
  const frame = engine.captureFrame(f.state, 7), saved = JSON.stringify(frame);
  assert.equal(engine.captureFrame(f.state, 7).combat_events.length, 0);
  f.state.tick = 8; f.hit(1);
  assert.equal(engine.captureFrame(f.state, 8).combat_events[0].id, '9007199254740999:combat:2');
  assert.equal(JSON.stringify(frame), saved); assert.equal(JSON.parse(saved).combat_events[0].id, frame.combat_events[0].id);
});
test('lethal hit preserves destruction events and reports only actual hull loss despite overkill', () => {
  const f = fixture(); f.hit(500);
  const hit = engine.captureFrame(f.state, 7).combat_events[0];
  assert.equal(hit.damage, 500); assert.equal(hit.hull_damage, 100); assert.equal(hit.shield_damage, 20);
  assert.equal(hit.target_hp, 0); assert.equal(hit.destroyed, true); assert.equal(f.target.isAlive, false);
  assert.equal(f.state.events.filter(e => e.type === 'ship_destroyed').length, 1); assert.equal(f.attacker.killsDealt, 1);
});
test('visual queue caps details and accounts for displaced shots without changing damage', () => {
  const f = fixture(); f.target.hp = f.target.maxHp = f.targetFleet.hp = 1000;
  for (let i = 0; i < 140; i++) f.hit(1);
  assert.equal(f.state.pendingCombatEvents.length, 128);
  const frame = engine.captureFrame(f.state, 7);
  assert.equal(frame.combat_events.length, 128); assert.equal(frame.combat_events_dropped, 12);
  assert.equal(frame.combat_salvos.length, 1); assert.equal(frame.combat_salvos[0].count, 12);
  assert.equal(frame.combat_salvos[0].source_side, 'atk'); assert.equal(frame.combat_salvos[0].samples.length, 2);
  assert.equal(frame.combat_salvos[0].samples[0].from.x, 123.5);
  assert.equal(frame.combat_events[0].seq, 13); assert.equal(frame.combat_events.at(-1).seq, 140);
  assert.equal(f.target.hp, 880); assert.equal(f.attacker.damageDealt, 140);
  const next=engine.captureFrame(f.state, 8);assert.equal(next.combat_events_dropped, undefined);assert.equal(next.combat_salvos,undefined);
});
test('large two-sided volleys keep exact counts, sampled real trajectories and critical destructions', () => {
  const f=fixture(),s=f.state,[atk,def]=s.fleets;
  for(const fleet of s.fleets)Object.assign(fleet.ships[0],{hp:100000,maxHp:100000});
  for(let i=0;i<200;i++){
    const from=i%2?def:atk,to=i%2?atk:def;
    from.ships[0].x=i;from.ships[0].y=200;to.ships[0].x=800;to.ships[0].y=220;
    engine.applyDamage(to.ships[0],to,1,from.ships[0],from,s,s.events);
  }
  const frame=engine.captureFrame(s,8),groups=Array.from(frame.combat_salvos);
  for(const side of ['atk','def']){
    const individual=frame.combat_events.filter(e=>e.source_side===side).length;
    const grouped=groups.filter(e=>e.source_side===side).reduce((n,e)=>n+e.count,0);
    assert.equal(individual+grouped,100,side);
  }
  assert.equal(groups.reduce((n,e)=>n+e.count,0),72);
  assert.ok(groups.every(g=>g.samples.length<=2&&g.samples.every(p=>p.from.x>=0&&p.from.x<200)));
  const q=fixture();q.target.hp=1;q.target.shield_hp=0;q.hit(1);for(let i=0;i<200;i++)q.hit(0);
  const final=engine.captureFrame(q.state,9);
  assert.equal(final.combat_events.filter(e=>e.destroyed).length,1,'lethal evidence stays in bounded detail');
  assert.equal(final.combat_events.length+final.combat_salvos.reduce((n,e)=>n+e.count,0),201);
});
test('actual combat cooldown generates no cosmetic attacks until its real damage is applied', () => {
  const f = fixture();
  for (const fleet of f.state.fleets) fleet.ships[0].shootT = 0;
  engine.processCombat(f.state, f.state.events);
  assert.equal(engine.captureFrame(f.state, 7).combat_events.length, 0);
  f.attacker.shootT = 1000;
  engine.processCombat(f.state, f.state.events);
  const hits = engine.captureFrame(f.state, 8).combat_events;
  assert.equal(hits.length, 1); assert.equal(hits[0].source_ship_id, f.attacker.id);
  assert.ok(hits[0].damage > 0); assert.equal(f.attacker.damageDealt, hits[0].damage);
});
test('real manual skill damage carries its skill type instead of the source hull default weapon', () => {
  const f = fixture();
  assert.equal(engine._applySkill(f.state, f.attackerFleet, 'beam', f.state.events), true);
  const hits = engine.captureFrame(f.state, 7).combat_events;
  assert.equal(hits.length, 1); assert.equal(hits[0].fire_type, 'beam');
  assert.equal(hits[0].source_ship_id, f.attacker.id); assert.equal(hits[0].damage, 88);
  assert.equal(f.state.events.some(e => e.type === 'manual_skill'), true);
});
test('sub-tick attack progress reflects the configured interval without firing more than once per tick', () => {
  for (const [interval, expected] of [[180, 200], [205, 195], [225, 177]]) {
    const f = fixture();
    Object.assign(f.attacker, { fireInterval: interval, shootT: 0 });
    Object.assign(f.target, { shootT: 0, fireInterval: 1e9, hp: 1e9, maxHp: 1e9, shield_hp: 0 });
    let hits = 0;
    for (let tick = 1; tick <= 200; tick++) {
      f.state.tick = tick;
      engine.processCombat(f.state, f.state.events);
      const frame = engine.captureFrame(f.state, tick);
      assert.ok(frame.combat_events.length <= 1);
      hits += frame.combat_events.length;
    }
    assert.equal(hits, expected, `interval ${interval}`);
  }
});
test('repair uses the same carried cooldown and EMP expiry cannot bank a burst', () => {
  const f = fixture();
  Object.assign(f.attacker, { fireType: 'repair', fireInterval: 205, shootT: 0 });
  Object.assign(f.target, { shootT: 0, fireInterval: 1e9 });
  const ally = { ...f.attacker, id: 'ally', fireInterval: 1e9, shootT: 0, hp: 1, maxHp: 1e9 };
  f.attackerFleet.ships.push(ally);
  for (let tick = 1; tick <= 200; tick++) {
    f.state.tick = tick;
    engine.processCombat(f.state, f.state.events);
  }
  assert.equal(f.attacker.healingDone, 195 * f.attacker.atk * 15);
  f.attacker.shootT = 800;
  f.state.empActive = { targetSide: 'atk', mult: 5, untilTick: 201 };
  f.state.tick = 201;
  engine.processCombat(f.state, f.state.events);
  f.state.tick = 202;
  engine.processCombat(f.state, f.state.events);
  assert.ok(f.attacker.shootT <= 200);
});
test('EW cooldown multiplier changes the actual firing rate and expires without accumulating a burst', () => {
  const f = fixture();
  Object.assign(f.attacker, { fireInterval: 205, shootT: 0 });
  Object.assign(f.target, { shootT: 0, fireInterval: 1e9, hp: 1e9, maxHp: 1e9, shield_hp: 0 });
  Object.assign(f.attackerFleet, { ewUntilTick: 200, ewFireIntervalMult: 1.5 });
  let hits = 0;
  for (let tick = 1; tick <= 200; tick++) {
    f.state.tick = tick;
    engine.processCombat(f.state, f.state.events);
    hits += engine.captureFrame(f.state, tick).combat_events.length;
  }
  assert.equal(hits, 130);
  f.state.tick = 201;
  engine.processCombat(f.state, f.state.events);
  assert.ok(f.attacker.shootT <= 200);
});
