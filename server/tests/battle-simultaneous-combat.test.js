'use strict';
const test=require('node:test'), assert=require('node:assert/strict'), fs=require('node:fs'), vm=require('node:vm');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');
const math=Object.create(Math); math.random=()=>0.99;
const box={module:{exports:{}},console,Math:math,require(name){if(name==='../db')return {};if(name==='./battleEnvironment')return require(root+'/server/services/battleEnvironment');if(name==='./tacticsAI')return {};throw Error(name)}};
vm.runInNewContext(fs.readFileSync(path.join(root,'server/services/battleEngine.js'),'utf8')+'\nmodule.exports.__test={processCombat,initBattleState,captureFrame,computeBattleStats}',box);
const {processCombat,initBattleState,captureFrame,computeBattleStats}=box.module.exports.__test;
function scenario(sideShips){let seq=1; const fleets=['atk','def'].map((side,i)=>({fleet_id:String(i+1),side,owner_wallet:'dummy-'+side,formation:'sphere',movement:'advance',ships:sideShips[i].map(v=>({id:String(seq++),ship_type_code:'fixture',role:'dps',size_class:'frigate',base_atk:1000,base_def:0,base_speed:4,current_hp:100,max_hp:100,fire_interval:200,fire_type:'laser',shots:1,...v}))}));const s=initBattleState({battle:{id:1},fleets});s.tick=1;s.events=[];for(const f of s.fleets)for(const sh of f.ships)sh.shootT=0;return s;}
test('simultaneous lethal flagship fire records both destruction events and both damage snapshots',()=>{const s=scenario([[{is_flagship:true}],[{is_flagship:true}]]);processCombat(s,s.events);assert.deepEqual(Array.from(s.fleets,f=>f.ships[0].isAlive),[false,false]);assert.equal(s.events.filter(e=>e.type==='ship_destroyed').length,2);assert.equal(s.events.filter(e=>e.type==='flagship_destroyed').length,2);const frame=captureFrame(s,1);assert.equal(frame.combat_events.length,2);assert.equal(frame.combat_events.filter(e=>e.destroyed).length,2);assert.deepEqual(Array.from(s.fleets,f=>f.ships[0].killsDealt),[1,1]);});
test('multiple attacks against same target cannot award duplicate kills',()=>{const s=scenario([[{},{}],[{fire_interval:100000}]]);processCombat(s,s.events);assert.equal(s.events.filter(e=>e.type==='ship_destroyed').length,1);assert.equal(s.fleets[0].ships.reduce((n,x)=>n+x.killsDealt,0),1);const hits=captureFrame(s,1).combat_events;assert.equal(hits.length,2);assert.equal(hits.filter(e=>e.destroyed).length,1);const overkill=hits.find(e=>e.overkill);assert.ok(overkill);assert.equal(overkill.damage,0);assert.equal(overkill.hull_damage,0);assert.equal(overkill.shield_damage,0);assert.equal(overkill.destroyed,false);assert.equal(s.fleets[0].ships.reduce((n,x)=>n+x.damageDealt,0),hits.reduce((n,x)=>n+x.damage,0));});
test('large simultaneous volleys retain the visual event cap and one authoritative destruction',()=>{const s=scenario([Array.from({length:200},()=>({})),[{fire_interval:100000}]]);processCombat(s,s.events);const frame=captureFrame(s,1);assert.equal(frame.combat_events.length,128);assert.equal(frame.combat_events_dropped,72);assert.equal(frame.combat_events.every(e=>e.overkill&&e.damage===0),true);assert.equal(s.events.filter(e=>e.type==='ship_destroyed').length,1);assert.equal(s.fleets[0].ships.reduce((n,x)=>n+x.killsDealt,0),1);});
test('EW effects planned by both sides are not prevented by same-tick destruction',()=>{const s=scenario([[{fire_type:'ew'},{base_atk:1000}],[{fire_type:'ew'},{base_atk:1000}]]);processCombat(s,s.events);assert.ok(s.fleets[0].ewUntilTick>1);assert.ok(s.fleets[1].ewUntilTick>1);assert.equal(s.events.filter(e=>e.type==='electronic_warfare').length,2);});
test('repairs use pre-damage damage state and never revive destroyed ships',()=>{const s=scenario([[{fire_type:'repair',base_atk:10},{base_atk:0,current_hp:50,fire_interval:100000}],[{base_atk:1000}]]);const ally=s.fleets[0].ships[1];processCombat(s,s.events);assert.equal(ally.isAlive,false);assert.ok(s.fleets[0].ships[0].healingDone>0);assert.equal(s.events.filter(e=>e.type==='ship_destroyed'&&e.ship_id===ally.id).length,1);});


test('mutual destruction uses the actual draw reward route and pays neither side as winner', async () => {
  const state = scenario([[{}], [{}]]);
  processCombat(state, state.events);
  const stats = box.module.exports.__test.computeBattleStats(state);
  assert.equal(stats.atk.ships_lost, 1);
  assert.equal(stats.def.ships_lost, 1);
  assert.equal(stats.atk.kills, 1);
  assert.equal(stats.def.kills, 1);
  const writes = [];
  const client = {
    async query(sql, params) {
      writes.push({ sql, params });
      return { rows: [] };
    },
    release() {},
  };
  const db = {
    pool: {
      async query(sql) {
        if (sql.includes('FROM fleet_battles WHERE id')) return { rows: [{ id: 1, battle_type: 'pvp_duel', winner_side: 'draw', battle_summary: {} }] };
        if (sql.includes('FROM fleet_battle_participants')) return { rows: [
          { wallet_address: 'dummy-atk', side: 'atk', damage_dealt: stats.atk.damage_dealt },
          { wallet_address: 'dummy-def', side: 'def', damage_dealt: stats.def.damage_dealt },
        ] };
        return { rows: [] };
      },
      async connect() { return client; },
    },
    async getSetting(key) { return key === 'newplayer_combat_grace_enabled' ? 'false' : '5'; },
    async awardXP() {},
  };
  const rewardsBox = { module: { exports: {} }, console: { log() {}, warn() {}, error() {} },
    require(name) { if (name === '../db') return db; throw Error(name); } };
  vm.runInNewContext(fs.readFileSync(path.join(root, 'server/services/battleRewards.js'), 'utf8'), rewardsBox);
  const rewards = await rewardsBox.module.exports.distributeRewards(1);
  assert.equal(rewards.length, 2);
  assert.equal(rewards.every(item => item.is_winner === false), true);
  assert.equal(rewards[0].gp_awarded, rewards[1].gp_awarded);
  assert.equal(writes.filter(w => w.sql.includes('INSERT INTO fleet_battle_rewards')).length, 2);
  assert.equal(writes.some(w => w.sql === 'COMMIT'), true);
});

test('mirrored fleets do not give the first-processed side a deterministic sweep', () => {
  const source = fs.readFileSync(path.join(root, 'server/services/battleEngine.js'), 'utf8');
  for (const interval of [200, 400]) {
    const wins = { atk: 0, def: 0, draw: 0 };
    for (let seed = 1; seed <= 100; seed++) {
      let value = seed;
      const randomMath = Object.create(Math);
      randomMath.random = () => { value = (Math.imul(value, 1664525) + 1013904223) >>> 0; return value / 4294967296; };
      const isolated = { module: { exports: {} }, Math: randomMath, console,
        require(name) { if (name === '../db') return {}; if (name === './battleEnvironment') return require(root + '/server/services/battleEnvironment'); if (name === './tacticsAI') return {}; throw Error(name); } };
      vm.runInNewContext(source + '\nmodule.exports.__test={initBattleState,processCombat};', isolated);
      const engine = isolated.module.exports.__test;
      const fleets = ['atk', 'def'].map((side, i) => ({ fleet_id: String(i + 1), side, owner_wallet: 'mirror-' + side,
        formation: 'sphere', movement: 'advance', ships: Array.from({ length: 20 }, (_, j) => ({ id: String(1 + i * 20 + j),
          ship_type_code: 'fixture', role: 'dps', size_class: 'frigate', base_atk: 50, base_def: 0, base_speed: 4,
          current_hp: 100, max_hp: 100, fire_interval: interval, fire_type: 'laser', shots: 1 })) }));
      const state = engine.initBattleState({ battle: { id: 1 }, fleets });
      state.events = [];
      for (const fleet of state.fleets) for (const ship of fleet.ships) ship.shootT = 0;
      for (let tick = 0; tick < 500; tick++) {
        state.tick = tick;
        engine.processCombat(state, state.events);
        if (state.fleets.some(fleet => !fleet.ships.some(ship => ship.isAlive))) break;
      }
      const survivors = state.fleets.map(fleet => fleet.ships.filter(ship => ship.isAlive).length);
      wins[survivors[0] > survivors[1] ? 'atk' : survivors[1] > survivors[0] ? 'def' : 'draw']++;
    }
    assert.ok(wins.atk >= 20 && wins.def >= 20, JSON.stringify({ interval, wins }));
    assert.ok(Math.abs(wins.atk - wins.def) <= 30, JSON.stringify({ interval, wins }));
  }
});
