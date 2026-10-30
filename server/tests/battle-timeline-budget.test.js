'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const engineSource = fs.readFileSync(path.join(__dirname, '../services/battleEngine.js'), 'utf8');
const quiet = { log() {}, warn() {}, error() {} };
const plain = value => JSON.parse(JSON.stringify(value));
function load(source, dependencies, extra = {}) {
  const box = { module: { exports: {} }, console: quiet, Buffer, setTimeout, Date,
    require(name) { if (name in dependencies) return dependencies[name]; throw Error('Unconfigured dependency: ' + name); }, ...extra };
  vm.runInNewContext(source, box);
  return box.module.exports;
}
function engine(data, unbounded = false, extra = {}) {
  let seed = 7;
  const math = Object.create(Math);
  math.random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  return load(engineSource + `\nloadBattleData = async () => fixture;
    ${unbounded ? 'createTimelineRecorder = timeline => frame => timeline.frames.push(frame);' : ''}
    module.exports.createTimelineRecorder = createTimelineRecorder;`, {
    '../db': { getSetting: async (_key, fallback) => fallback },
    './battleEnvironment': require('../services/battleEnvironment'),
    './tacticsAI': require('../services/tacticsAI'),
    './objectiveOperations': { initObjective() {}, beforeTick() {}, evaluateObjective() { return null; } },
  }, { fixture: structuredClone(data), Math: math, ...extra });
}
function fixture({ ships = 3, hp = 1e9, attack = 10 } = {}) {
  return { battle: { id: 1457, battle_type: 'pvp_duel', battle_summary: { npc_vs_npc: true, arena: true } },
    fleets: ['atk', 'def'].map((side, i) => ({ fleet_id: String(i + 1), fleet_name: 'NPC 화성艦隊🚀', side,
      owner_wallet: 'npc-' + side, formation: 'sphere', movement: 'advance',
      ships: Array.from({ length: ships }, (_, j) => ({ id: String(i * ships + j + 1), ship_type_code: 'fixture',
        role: 'attack', size_class: 'frigate', base_atk: attack, base_def: 2, base_speed: 4,
        current_hp: hp, max_hp: hp, fire_interval: 1000, fire_type: 'laser', shots: 1 })) })) };
}
function withoutTimeline(result) { const { timeline, ...rest } = plain(result); return rest; }
function storage() {
  const writes = [];
  const service = load(fs.readFileSync(path.join(__dirname, '../services/battleTimeline.js'), 'utf8'), {
    '../db': { pool: { async query(sql, args) { writes.push({ sql, args }); return { rows: [] }; } } },
    './battleEnvironment': {},
  });
  return { service, writes };
}
async function rewardInputs(result) {
  const rewards = load(fs.readFileSync(path.join(__dirname, '../services/battleRewards.js'), 'utf8') +
    '\nmodule.exports.computeReward = computeReward;', {
    '../db': {}, './battleEnvironment': require('../services/battleEnvironment'),
  }, { Math: Object.assign(Object.create(Math), { random: () => 0.1 }) });
  const battle = { battle_type: 'pvp_duel', winner_side: result.winner_side,
    atk_ships_lost: result.stats.atk.ships_lost, def_ships_lost: result.stats.def.ships_lost };
  const settings = { reward_base_gp_pvp: 100, reward_loser_consolation: 10,
    reward_per_ship_destroyed: 5, reward_mineral_drop_chance: 20 };
  return Promise.all(result.stats.by_fleet.map(fleet => rewards.computeReward({ ...fleet, damage_share_pct: 1 },
    battle, settings, fleet.side === battle.winner_side))).then(plain);
}

test('three-hour NPC simulation stays below the real storage guard with identical authoritative results', async () => {
  const data = fixture();
  const raw = await engine(data, true).simulateBattle(1457);
  const bounded = await engine(data).simulateBattle(1457);
  const rawBytes = Buffer.byteLength(JSON.stringify(raw.timeline));
  const boundedBytes = Buffer.byteLength(JSON.stringify(bounded.timeline));
  assert.ok(rawBytes > 10 * 1024 * 1024, 'fixture reproduces the production size failure');
  assert.ok(boundedBytes < 8 * 1024 * 1024, 'entire UTF-8 timeline, including combat events and metadata, fits');
  assert.deepEqual(withoutTimeline(bounded), withoutTimeline(raw), 'winner, duration, all damage/HP/kills and persistent events are unchanged');
  assert.equal(bounded.duration_ticks, 53999);
  assert.equal(bounded.timeline.frames[0].t, 0);
  assert.equal(bounded.timeline.frames.at(-1).t, 53999);
  assert.deepEqual(plain(bounded.timeline.frames[0]), plain(raw.timeline.frames[0]));
  const { combat_salvos: carriedFire, combat_events_dropped: compactedFire, ...boundedLast } = plain(bounded.timeline.frames.at(-1));
  const { combat_events_dropped: originalCompactedFire, ...rawLast } = plain(raw.timeline.frames.at(-1));
  assert.deepEqual(boundedLast, rawLast, 'the final state and individual events remain exact');
  assert.ok(carriedFire?.length, 'omitted frames are carried into the final replay frame');
  assert.ok((compactedFire || 0) >= (originalCompactedFire || 0));
  assert.ok(bounded.timeline.replay_frame_interval_ticks > 5);
  assert.ok(bounded.timeline.frames.every((f, i, all) => !i || f.t > all[i - 1].t));
  const saved = storage();
  await assert.rejects(saved.service.saveTimeline(1457, raw.timeline), /TIMELINE_TOO_LARGE/);
  const meta = await saved.service.saveTimeline(1457, bounded.timeline);
  assert.equal(meta.size_bytes, boundedBytes);
  assert.equal(meta.storage_type, 'table');
  const write = saved.writes.find(w => w.sql.includes('INSERT INTO fleet_battle_timelines'));
  assert.deepEqual(JSON.parse(write.args[1]), plain(bounded.timeline));
  assert.equal(write.args[3], bounded.timeline.frames.length);
  console.log(JSON.stringify({ rawBytes, boundedBytes, rawFrames: raw.timeline.frames.length,
    boundedFrames: bounded.timeline.frames.length, intervalTicks: bounded.timeline.replay_frame_interval_ticks }));
});

test('short winning battle retains the complete original replay, result and reward inputs', async () => {
  const data = fixture({ ships: 2, hp: 100, attack: 100 });
  for (const ship of data.fleets[0].ships) ship.current_hp = ship.max_hp = 2000;
  const raw = await engine(data, true).simulateBattle(1457);
  const bounded = await engine(data).simulateBattle(1457);
  assert.equal(bounded.winner_side, 'atk');
  assert.deepEqual(plain(bounded), plain(raw));
  assert.equal(bounded.timeline.replay_frame_interval_ticks, undefined);
  assert.deepEqual(await rewardInputs(bounded), await rewardInputs(raw), 'actual reward calculation preserves GP, minerals and breakdown');
});

test('large evolving frames retain a bounded recording, actual endpoints and untouched live broadcast objects', () => {
  const timeline = { tick_ms: 200, frames: [] };
  const record = engine(fixture()).createTimelineRecorder(timeline);
  const broadcast = [];
  let interval = 5;
  for (let tick = 0; tick < 3000; tick += 5) {
    const frame = { t: tick, ships: Array.from({ length: 1000 }, (_, id) => ({ id: String(id), hp: 1000 - tick / 5, x: tick, code: '화성艦🚀' })),
      combat_events: Array.from({ length: 128 }, (_, seq) => ({ id: tick + ':' + seq, tick, damage: 1 })) };
    record(frame);
    broadcast.push({ ...frame, realtime: true });
    if (tick % 250 === 0 || interval !== timeline.replay_frame_interval_ticks) {
      assert.ok(Buffer.byteLength(JSON.stringify(timeline)) < 8 * 1024 * 1024);
      interval = timeline.replay_frame_interval_ticks;
    }
  }
  assert.equal(broadcast.length, 600, 'live caller can still broadcast every original capture');
  assert.equal(timeline.frames[0].t, 0);
  assert.equal(timeline.frames.at(-1).t, 2995);
  assert.ok(timeline.frames.length < broadcast.length);
  assert.ok(timeline.frames.every(f => !f.realtime));
  assert.equal(broadcast.at(-1).ships[0].hp, 401);
});

test('replay compaction carries every real shot once, with original endpoints and no live-frame mutation', () => {
  const timeline = { battle_id: '1457', tick_ms: 200, frames: [] };
  const record = engine(fixture()).createTimelineRecorder(timeline);
  const point = seq => ({ from: { x: seq, y: 0 }, to: { x: seq, y: 10 } });
  let last;
  for (let i = 0; i < 500; i++) {
    const base = i * 5;
    const frame = { t: i * 5, payload: 'x'.repeat(48000),
      combat_events: [
        { id: `atk:${base + 2}`, seq: base + 2, source_side: 'atk', fire_type: 'laser', destroyed: true, ...point(base + 2) },
        { id: `def:${base + 5}`, seq: base + 5, source_side: 'def', fire_type: 'laser', ...point(base + 5) },
      ],
      combat_salvos: [{ source_side: 'atk', fire_type: 'laser', count: 3,
        first_seq: base + 1, last_seq: base + 4, samples: [point(base + 1), point(base + 4)] }],
      combat_events_dropped: 3 };
    const before = JSON.stringify(frame);
    record(frame);
    assert.equal(JSON.stringify(frame), before, 'recording never mutates a live broadcast frame');
    last = frame;
  }
  assert.equal(timeline.frames[0].t, 0);
  assert.equal(timeline.frames.at(-1).t, last.t);
  assert.ok(timeline.frames.length < 500);
  assert.ok(Buffer.byteLength(JSON.stringify(timeline)) < 8 * 1024 * 1024);
  const totals = { atk: 0, def: 0 };
  for (const frame of timeline.frames) {
    for (const event of frame.combat_events || []) totals[event.source_side]++;
    assert.equal((frame.combat_salvos || []).reduce((sum, salvo) => sum + salvo.count, 0), frame.combat_events_dropped || 0);
    for (const salvo of frame.combat_salvos || []) {
      totals[salvo.source_side] += salvo.count;
      assert.equal(salvo.samples[0].from.x, salvo.first_seq, 'first representative is an actual first-sequence shot');
      assert.equal(salvo.samples.at(-1).from.x, salvo.last_seq, 'last representative is an actual last-sequence shot');
    }
  }
  assert.deepEqual(totals, { atk: 2000, def: 500 });
});

test('live simulation broadcasts every original frame while bounding only the saved replay', async () => {
  const data = fixture();
  const immediateTimers = { setTimeout: fn => { queueMicrotask(fn); return 1; } };
  const originalFrames = [], boundedFrames = [];
  const raw = await engine(data, true, immediateTimers).simulateBattleLive(1457, { onFrame: frame => originalFrames.push(frame) });
  const bounded = await engine(data, false, immediateTimers).simulateBattleLive(1457, { onFrame: frame => boundedFrames.push(frame) });
  const { duration_seconds: boundedElapsed, ...boundedResult } = withoutTimeline(bounded);
  const { duration_seconds: rawElapsed, ...rawResult } = withoutTimeline(raw);
  assert.ok(boundedElapsed >= 0 && rawElapsed >= 0);
  assert.deepEqual(boundedResult, rawResult);
  const withoutElapsed = frames => plain(frames).map(({ wall_clock_elapsed_seconds, ...frame }) => frame);
  assert.deepEqual(withoutElapsed(boundedFrames), withoutElapsed(originalFrames));
  assert.ok(boundedFrames.length > bounded.timeline.frames.length);
  assert.ok(bounded.timeline.frames.every(frame => !frame.realtime));
  assert.equal(bounded.timeline.frames.at(-1).t, bounded.duration_ticks);
  assert.ok(Buffer.byteLength(JSON.stringify(bounded.timeline)) < 8 * 1024 * 1024);
});

test('scheduler settles a large replay before saving it and distributing rewards once', async () => {
  const data = fixture();
  const result = await engine(data).simulateBattle(1457);
  assert.ok(result.timeline.replay_frame_interval_ticks > 5);
  const calls = [], sqls = [];
  const query = async sql => {
    sqls.push(sql);
    if (sql.includes('live_lease_token=NULL')) return { rowCount: 1, rows: [{ id: 1457 }] };
    if (sql.includes('RETURNING battle_type, phase, battle_summary')) return { rows: [{ battle_type: 'pvp_duel', phase: 'main', battle_summary: data.battle.battle_summary }] };
    return { rows: [] };
  };
  const pool = { query, connect: async () => ({ query, release() {} }) };
  const timelineService = storage().service;
  const scheduler = load(fs.readFileSync(path.join(__dirname, '../services/battleScheduler.js'), 'utf8'), {
    crypto: require('node:crypto'),
    './battleReplayPacing': require('../services/battleReplayPacing'),
    './battleAuthority': { cleanupExpiredBattles: async () => ({ rows: [] }), acquireLiveAuthority: async () => ({ token: 'test', shouldAbort: () => false, stop() {} }) },
    '../db': { pool, getSetting: async (_key, fallback) => fallback },
    './battleEngine': { assertRegisteredFrontierBattle: async () => {}, assertRegisteredBattleModes: async () => ({}),
      simulateBattle: async () => result, applyBattleResults: async (id, actual) => {
        assert.equal(id, 1457); assert.equal(actual, result); assert.deepEqual(calls, []); calls.push('apply');
        await timelineService.saveTimeline(id, actual.timeline); calls.push('save');
      } },
    './battleTimeline': { saveTimeline: async (id, actual) => { assert.equal(actual, result.timeline);
      const meta = await timelineService.saveTimeline(id, actual); calls.push('save'); return meta; } },
    './battleRewards': { distributeRewards: async () => { assert.deepEqual(calls, ['apply', 'save']); calls.push('rewards'); return []; } },
    './hijack': {}, './aiFleetManager': { scheduleRespawnIfNeeded: async () => {} },
    './aiStrategy': { applyAIStrategy: async () => null }, '../wsServer': { channelStats: () => ({}) },
  }, { process: { env: {} } });
  assert.equal(await scheduler.runBattle(1457), result);
  assert.deepEqual(calls, ['apply', 'save', 'rewards']);
  assert.ok(!sqls.some(sql => sql.includes("SET status='cancelled'")));
  assert.ok(sqls.some(sql => sql.includes('SET is_in_battle=false, current_battle_id=NULL')));
});
