'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../services/battleEngine.js'), 'utf8');
const objectiveSource = fs.readFileSync(path.join(__dirname, '../services/objectiveOperations.js'), 'utf8');

function objectiveOperations() {
  const box = { module: { exports: {} },
    require(name) {
      if (name === 'crypto') return require('node:crypto');
      if (name === '../db') return { pool: {} };
      if (name === './fleetOccupancy') return { assertFleetsNotMining() {} };
      throw Error('Unconfigured objective dependency: ' + name);
    } };
  vm.runInNewContext(objectiveSource, box);
  return box.module.exports;
}

function scenario(shipsPerOwner) {
  const fleets = [];
  for (const [sideIndex, side] of ['atk', 'def'].entries()) {
    for (let player = 0; player < 2; player++) {
      for (let wing = 0; wing < Math.ceil(shipsPerOwner / 50); wing++) {
        const fleetId = sideIndex * 10 + player * 2 + wing + 1;
        fleets.push({ fleet_id: String(fleetId), fleet_name: `${side}-${player}-${wing}`, side,
          owner_wallet: `${side}-${player}`, formation: 'wedge', movement: 'advance',
          ships: Array.from({ length: Math.min(50, shipsPerOwner - wing * 50) }, (_, i) => ({ id: String(fleetId * 1000 + i),
            ship_type_code: 'test-frigate', role: 'attack', size_class: 'frigate',
            base_atk: 1, base_def: 2, base_speed: 4, current_hp: 1000000, max_hp: 1000000,
            fire_interval: 1000, fire_type: 'laser', shots: 1 })) });
      }
    }
  }
  if (shipsPerOwner === 30) {
    const extra = fleets.findIndex(f => f.fleet_id === '3');
    fleets.splice(extra, 1);
    for (const fleet of fleets.filter(f => f.side === 'def')) fleet.ships = fleet.ships.slice(0, 3);
  }
  return { battle: { id: 701, battle_type: 'pvp_duel' }, fleets,
    objectiveConfig: { kind: 'flagship', playerFleetIds: fleets.filter(f => f.side === 'atk').map(f => f.fleet_id),
      targetFleetId: '11', targetShipId: '11000', deadlineSeconds: 3, positions: {} } };
}

function engine(data, clock, comparisonSource = source) {
  let seed = 11;
  const objective = objectiveOperations();
  const math = Object.create(Math);
  math.random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  class SimDate extends Date { static now() { return clock.ms; } }
  const box = { module: { exports: {} }, fixture: structuredClone(data), Math: math, Date: SimDate,
    Buffer, console: { log() {}, warn() {}, error() {} },
    setTimeout(fn, ms) { if (clock.sleeps) clock.sleeps.push(ms); clock.ms += clock.step || ms; queueMicrotask(fn); },
    require(name) {
      if (name === '../db') return { getSetting: async (_key, fallback) => fallback };
      if (name === './objectiveOperations') return objective;
      if (['./battleEnvironment', './tacticsAI'].includes(name)) {
        return require('../services/' + name.slice(2));
      }
      throw Error('Unconfigured dependency: ' + name);
    } };
  vm.runInNewContext(comparisonSource + '\nloadBattleData = async () => fixture;', box);
  return box.module.exports;
}

for (const shipsPerOwner of [30, 50, 100]) {
  test(`real objective and authorized commands work with ${shipsPerOwner} synthetic ships per player`, async () => {
    const clock = { ms: 0 }, results = [], sent = new Set();
    const result = await engine(scenario(shipsPerOwner), clock).simulateBattleLive(701, {
      tickMs: 200, wallClockMs: 10000,
      drainCommands() {
        const commands = [];
        if (clock.ms >= 200 && !sent.has('own')) {
          sent.add('own');
          commands.push({ commandId: 'own', fleetId: '1', wallet: 'atk-0', action: 'hold' });
          commands.push({ commandId: 'foreign', fleetId: '11', wallet: 'atk-0', action: 'hold' });
        }
        if (clock.ms >= 1000 && !sent.has('formation')) {
          sent.add('formation');
          commands.push({ commandId: 'formation', fleetId: '1', wallet: 'atk-0', action: 'formation', params: { formation: 'wedge' } });
        }
        return commands;
      },
      onCommandResult(command) { results.push(command); },
    });
    assert.equal(results.find(c => c.commandId === 'own')?.status, 'applied');
    assert.equal(results.find(c => c.commandId === 'foreign')?.reason, 'not_your_fleet');
    const formation = results.find(c => c.commandId === 'formation');
    assert.equal(formation?.status, 'applied');
    assert.equal(formation.manualControlRemainingMs, 10000);
    assert.equal(result.winner_side, 'def');
    assert.equal(result.objective_result?.reason, 'objective_deadline');
    assert.equal(result.objective_result?.elapsed_seconds, 3);
    assert.equal(result.events.some(e => e.type === 'battle_timeout'), false);
  });
}

for (const shipsPerOwner of [50, 100]) {
  test(`large live battle preserves configured cadence with ${shipsPerOwner} ships per player`, async () => {
    const data = scenario(shipsPerOwner);
    delete data.objectiveConfig;
    const clock = { ms: 0 }, results = [], frames = [], sent = new Set();
    let start;
    await assert.rejects(engine(data, clock).simulateBattleLive(701, {
      tickMs: 250, wallClockMs: 360000,
      onLiveStart(info) { start = info; },
      drainCommands() {
        const commands = [];
        for (const [id, when, action] of [['early', 750, 'beam'], ['ready', 1500, 'beam'], ['hold', 1000, 'hold']]) {
          if (clock.ms >= when && !sent.has(id)) {
            sent.add(id);
            commands.push({ commandId: id, fleetId: '1', wallet: 'atk-0', action });
          }
        }
        return commands;
      },
      onCommandResult(command) { results.push({ ...command, wall: clock.ms }); },
      onFrame(frame) { frames.push({ wall: clock.ms, frame }); },
      shouldAbort() { return clock.ms > 1750; },
    }), /AUTHORITY_LOST/);
    assert.equal(start.wallClockMs, (shipsPerOwner === 50 ? 30 : 45) * 60000);
    assert.equal(results.find(c => c.commandId === 'early')?.reason, 'charge_insufficient');
    assert.equal(results.find(c => c.commandId === 'ready')?.status, 'applied');
    assert.equal(results.find(c => c.commandId === 'ready')?.wall, 1500);
    assert.equal(results.find(c => c.commandId === 'hold')?.status, 'applied');
    assert.deepEqual(frames.slice(0, 2).map(f => f.wall), [0, 1250]);
    assert.equal(frames[1].frame.fleets.find(f => String(f.id) === '1')?.beamCharge, 100);
    assert.equal(frames[1].frame.realtime, true);
    assert.equal(frames[1].frame.wall_clock_limit_seconds, start.wallClockMs / 1000);
  });
}

test('operator limits longer than the large-battle floor remain intact', async () => {
  const data = scenario(100), clock = { ms: 0 };
  delete data.objectiveConfig;
  let start;
  await assert.rejects(engine(data, clock).simulateBattleLive(701, {
    tickMs: 250, wallClockMs: 3600000, onLiveStart(info) { start = info; }, shouldAbort() { return true; },
  }), /AUTHORITY_LOST/);
  assert.equal(start.wallClockMs, 3600000);
});

test('registered standard and objective modes retain their configured safety limit', async () => {
  for (const mode of ['standard', 'objective']) {
    const data = scenario(100), clock = { ms: 0 };
    if (mode === 'standard') { delete data.objectiveConfig; data.standardConfig = {}; }
    let start;
    await assert.rejects(engine(data, clock).simulateBattleLive(701, {
      tickMs: 200, wallClockMs: 360000, onLiveStart(info) { start = info; }, shouldAbort() { return true; },
    }), /AUTHORITY_LOST/);
    assert.equal(start.wallClockMs, 360000);
  }
});

test('a large unresolved battle is a draw when its safety limit expires', async () => {
  const data = scenario(50), clock = { ms: 0, step: 300000 };
  delete data.objectiveConfig;
  const result = await engine(data, clock).simulateBattleLive(701, { tickMs: 250, wallClockMs: 360000 });
  assert.equal(result.winner_side, 'draw');
  assert.equal(result.events.find(e => e.type === 'battle_timeout')?.payload.reason, 'wall_clock');
  assert.equal(result.duration_seconds, 2100);
  assert.equal(result.stats.atk.ships_lost, 0);
  assert.equal(result.stats.def.ships_lost, 0);
});

test('authority lost during the finishing frame prevents a result from being returned', async () => {
  const data = scenario(30), clock = { ms: 0 };
  delete data.objectiveConfig;
  data.fleets = data.fleets.slice(0, 1).concat(data.fleets.find(f => f.side === 'def'));
  data.fleets[0].ships = data.fleets[0].ships.slice(0, 1);
  data.fleets[1].ships = [];
  let lost = false;
  await assert.rejects(engine(data, clock).simulateBattleLive(701, {
    tickMs: 250, wallClockMs: 360000,
    onFrame() { lost = true; }, shouldAbort() { return lost; },
  }), /AUTHORITY_LOST/);
});

test('live tick cadence includes processing time and still yields under overload or clock reversal', async () => {
  for (const cost of [40, 300, -500]) {
    const data = scenario(30), clock = { ms: 1000, sleeps: [] }, frames = [];
    delete data.objectiveConfig;
    let calls = 0;
    await assert.rejects(engine(data, clock).simulateBattleLive(701, {
      tickMs: 250,
      drainCommands() { clock.ms += cost < 0 ? (calls++ === 0 ? cost : 0) : cost; return []; },
      onFrame(frame) { frames.push({ tick: frame.t, wall: clock.ms }); },
      shouldAbort() { return frames.length >= 2; },
    }), /AUTHORITY_LOST/);
    if (cost === 40) assert.equal(frames[1].wall - frames[0].wall, 1250);
    if (cost === 300) {
      assert.equal(frames[1].wall - frames[0].wall, 1500);
      assert.ok(clock.sleeps.every(ms => ms === 0), 'overload must yield, without catch-up bursts');
    }
    if (cost === -500) assert.equal(clock.sleeps[0], 250, 'clock reversal cannot extend a tick sleep');
  }
});

test('processing-time compensation keeps objective deadlines and manual control close to real time', async () => {
  const data = scenario(30), clock = { ms: 0 }, commands = [], frames = [];
  data.objectiveConfig.deadlineSeconds = 150;
  let sent = false;
  const result = await engine(data, clock).simulateBattleLive(701, {
    tickMs: 200, wallClockMs: 360000,
    drainCommands() {
      clock.ms += 40;
      if (!sent && clock.ms >= 1000) {
        sent = true;
        return [{ commandId: 'formation', fleetId: '1', wallet: 'atk-0', action: 'formation', params: { formation: 'wedge' } }];
      }
      return [];
    },
    onCommandResult(command) { commands.push({ ...command, wall: clock.ms }); },
    onFrame(frame) {
      if (frame.t <= 60) frames.push({ tick: frame.t, wall: clock.ms,
        remaining: frame.fleets.find(f => String(f.id) === '1')?.manualControlRemainingMs });
    },
  });
  const command = commands.find(c => c.commandId === 'formation');
  assert.equal(command?.status, 'applied');
  assert.equal(command?.manualControlRemainingMs, 10000);
  const after = frames.find(frame => frame.tick === command.manualControlUntilTick);
  assert.equal(after?.remaining, 0);
  assert.equal(after.wall - command.wall, 10000);
  assert.equal(result.objective_result?.reason, 'objective_deadline');
  assert.equal(result.objective_result?.elapsed_seconds, 150);
  assert.ok(clock.ms >= 149800 && clock.ms <= 150000, `objective finished at ${clock.ms}ms`);
});

test('same tick-indexed commands preserve combat outcomes while wall-time command ticks can change', async () => {
  const baseline = source.replace('    const tickStartedAt = Date.now();\n', '')
    .replace('await _sleep(Math.max(0, tickMs - Math.max(0, Date.now() - tickStartedAt)));', 'await _sleep(tickMs);');
  assert.notEqual(baseline, source);
  async function run(engineSource, byWall) {
    const clock = { ms: 0 }, data = scenario(30), commands = [];
    let calls = 0, sent = false;
    const result = await engine(data, clock, engineSource).simulateBattleLive(701, {
      tickMs: 200, wallClockMs: 10000,
      drainCommands() {
        clock.ms += 40;
        calls++;
        if (!sent && (byWall ? clock.ms >= 1000 : calls === 3)) {
          sent = true;
          return [{ commandId: 'formation', fleetId: '1', wallet: 'atk-0', action: 'formation', params: { formation: 'wedge' } }];
        }
        return [];
      },
      onCommandResult(command) { commands.push(command); },
    });
    return { result, commands, wall: clock.ms };
  }
  const previous = await run(baseline, false), current = await run(source, false);
  assert.equal(previous.commands[0].tick, current.commands[0].tick);
  assert.equal(JSON.stringify(previous.result.stats), JSON.stringify(current.result.stats));
  assert.equal(JSON.stringify(previous.result.events), JSON.stringify(current.result.events));
  assert.equal(previous.result.winner_side, current.result.winner_side);
  assert.equal(previous.result.duration_ticks, current.result.duration_ticks);
  assert.ok(current.wall < previous.wall);
  const wallPrevious = await run(baseline, true), wallCurrent = await run(source, true);
  assert.ok(wallCurrent.commands[0].tick > wallPrevious.commands[0].tick,
    'a fixed wall-time command may affect a different simulation tick');
});
