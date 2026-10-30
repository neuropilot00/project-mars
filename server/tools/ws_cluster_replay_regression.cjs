'use strict';
// Local Redis and two independent Node workers. DB/auth are fixtures; no production data.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const http = require('node:http');
const net = require('node:net');
const { fork, spawn } = require('node:child_process');
const WebSocket = require('ws');
const Redis = require('ioredis');
const { monitorEventLoopDelay } = require('node:perf_hooks');
const ROOT = path.resolve(__dirname, '..');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');
function evaluate(file, dependencies, extra = {}) {
  const context = { module: { exports: {} }, Buffer, Date, setTimeout, clearTimeout, setInterval, clearInterval,
    process: { pid: process.pid, env: { REDIS_URL: process.env.TEST_REDIS_URL } },
    console: { log() {}, warn() {}, error() {} }, ...extra,
    require(name) { if (Object.hasOwn(dependencies, name)) return dependencies[name]; throw Error('Unexpected dependency: ' + name); } };
  context.global = context;
  vm.runInNewContext(read(file), context, { filename: file });
  return context.module.exports;
}
async function worker() {
  const clients = [], metrics = { presenceCommands: 0, presenceChannels: 0, pendingReplayTimers: 0, executedReplayTimers: 0 };
  const lag = monitorEventLoopDelay({ resolution: 20 }); lag.enable();
  let baseline = { cpu: process.cpuUsage(), at: Date.now() };
  class TrackedRedis extends Redis {
    constructor(...args) { super(...args); clients.push(this); }
    call(...args) { if (String(args[0]).toUpperCase() === 'PUBSUB' && String(args[1]).toUpperCase() === 'NUMSUB') { metrics.presenceCommands++; metrics.presenceChannels += Math.max(0, args.length - 2); } return super.call(...args); }
  }
  function trackedTimer(callback, ms) {
    metrics.pendingReplayTimers++;
    return setTimeout(() => { metrics.pendingReplayTimers--; metrics.executedReplayTimers++; callback(); }, ms);
  }
  const query = async (sql) => {
    if (sql.includes('RETURNING battle_type, phase, battle_summary')) return { rows: [{ battle_type: 'pvp_duel', phase: 'main', battle_summary: { duel_mode: 'standard_v1' } }], rowCount: 1 };
    if (sql.includes('live_lease_token=NULL')) return { rows: [{ id: 71 }], rowCount: 1 };
    return { rows: [] };
  };
  const pool = { query, connect: async () => ({ query, release() {} }) };
  const api = evaluate('wsServer.js', { 'ioredis': TrackedRedis, ws: WebSocket, url: require('node:url'), crypto: require('node:crypto'),
    './utils/totpSessionBoundary': { validateToken: async () => ({ wallet: null, revoked: false, totp: false }) }, './db': { pool },
    './services/liveBattle': { enqueueCommandResult: () => ({ accepted: false, reason: 'not_authority' }) },
    './utils/battleFrameWire': require('../utils/battleFrameWire') });
  const server = http.createServer();
  const wss = api.attachWsServer(server);
  const frames = Array.from({ length: 60 }, (_, i) => ({ t: i * 5, ships: [], fleets: [], combat_events: [] }));
  const result = { winner_side: 'draw', duration_seconds: 60, stats: {}, timeline: { tick_ms: 200, frames } };
  const scheduler = evaluate('services/battleScheduler.js', {
    crypto: require('node:crypto'), ioredis: TrackedRedis,
    '../db': { pool, getSetting: async (key, fallback) => key === 'fleet_realtime_mode' ? 'off' : fallback },
    './battleEngine': { assertRegisteredFrontierBattle: async () => {}, assertRegisteredBattleModes: async () => ({}),
      simulateBattle: async () => result, applyBattleResults: async () => ({}) },
    './battleTimeline': {}, './battleRewards': { distributeRewards: async () => [] },
    './hijack': {}, './aiFleetManager': {}, './aiStrategy': { applyAIStrategy: async () => null },
    './battleAuthority': { cleanupExpiredBattles: async () => ({ rows: [] }) },
    './battleReplayPacing': require('../services/battleReplayPacing'), '../wsServer': api,
  }, { setTimeout: trackedTimer });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let socket;
  process.on('message', async message => {
    try {
      let value;
      if (message.op === 'has') value = await api.hasBattleViewers(message.battle);
      else if (message.op === 'open') {
        socket = new WebSocket(`ws://127.0.0.1:${server.address().port}/ws/battle/${message.battle}`);
        socket.on('message', raw => { const packet = JSON.parse(raw); if (packet.type === 'frame' || packet.type === 'end') process.send({ event: 'packet', packet }); });
        await new Promise((resolve, reject) => { socket.once('open', resolve); socket.once('error', reject); });
        value = true;
      } else if (message.op === 'close') {
        if (socket && socket.readyState === WebSocket.OPEN) { socket.close(); await new Promise(resolve => socket.once('close', resolve)); }
        socket = null; value = true;
      } else if (message.op === 'run') value = !!(await scheduler.runBattle(message.battle));
      else if (message.op === 'broadcast') { api.broadcastBattleFrame(message.battle, { t: message.tick }); value = true; }
      else if (message.op === 'resetMetrics') { metrics.presenceCommands = 0; metrics.presenceChannels = 0; metrics.executedReplayTimers = 0; lag.reset(); baseline = { cpu: process.cpuUsage(), at: Date.now() }; value = true; }
      else if (message.op === 'runMany') value = await Promise.all(Array.from({ length: message.count }, (_, i) => scheduler.runBattle(String(message.startId + i))));
      else if (message.op === 'metrics') { const cpu = process.cpuUsage(baseline.cpu); value = { wallMs: Date.now() - baseline.at, userCpuMs: cpu.user / 1000, systemCpuMs: cpu.system / 1000, rssBytes: process.memoryUsage().rss, p95EventLoopMs: lag.percentile(95) / 1e6, p99EventLoopMs: lag.percentile(99) / 1e6, maxEventLoopMs: lag.max / 1e6, ...metrics }; }
      else if (message.op === 'quit') {
        if (socket) socket.terminate();
        clients.forEach(client => client.disconnect());
        wss.close(); server.close(); value = true;
        process.send({ id: message.id, value });
        return setTimeout(() => process.exit(0), 50);
      }
      process.send({ id: message.id, value });
    } catch (error) { process.send({ id: message.id, error: error.stack }); }
  });
  process.send({ event: 'ready', pid: process.pid });
}
async function freePort() { const s = net.createServer(); await new Promise(resolve => s.listen(0, '127.0.0.1', resolve)); const port = s.address().port; await new Promise(resolve => s.close(resolve)); return port; }
async function until(predicate, label, attempts = 300) { for (let n = 0; n < attempts; n++) { if (await predicate()) return; await sleep(20); } throw Error('Timeout: ' + label); }
async function launchRedis(port) {
  const child = spawn('redis-server', ['--port', String(port), '--bind', '127.0.0.1', '--save', '', '--appendonly', 'no'], { stdio: 'ignore' });
  await until(() => new Promise(resolve => { const socket = net.createConnection(port, '127.0.0.1'); socket.once('connect', () => { socket.destroy(); resolve(true); }); socket.once('error', () => resolve(false)); }), 'local Redis ready');
  return child;
}
function launchWorker(url) {
  const child = fork(__filename, ['--worker'], { env: { PATH: process.env.PATH, TEST_REDIS_URL: url }, stdio: ['ignore', 'ignore', 'inherit', 'ipc'] });
  const packets = [], pending = new Map(); let next = 0;
  const ready = new Promise((resolve, reject) => {
    child.once('error', reject);
    child.on('message', message => {
      if (message.event === 'ready') resolve(message.pid);
      else if (message.event === 'packet') packets.push(message.packet);
      else if (pending.has(message.id)) { const { resolve, reject } = pending.get(message.id); pending.delete(message.id); message.error ? reject(Error(message.error)) : resolve(message.value); }
    });
  });
  return { child, packets, ready, call(op, data = {}) { const id = ++next; return new Promise((resolve, reject) => { pending.set(id, { resolve, reject }); child.send({ id, op, ...data }); }); } };
}
async function main() {
  const port = await freePort(); let redis; const workers = [];
  try {
    redis = await launchRedis(port);
    const url = `redis://127.0.0.1:${port}`;
    const producer = launchWorker(url), viewer = launchWorker(url); workers.push(producer, viewer);
    const pids = await Promise.all(workers.map(w => w.ready)); assert.notEqual(pids[0], pids[1]);
    await viewer.call('open', { battle: '71' });
    await until(() => producer.call('has', { battle: '71' }), 'remote presence');
    assert.equal(await producer.call('run', { battle: '71' }), true);
    await until(() => viewer.packets.filter(p => p.type === 'frame').length >= 3, 'remote precomputed stream');
    const firstTicks = viewer.packets.filter(p => p.type === 'frame').map(p => p.t);
    assert.equal(new Set(firstTicks).size, firstTicks.length, 'no duplicate received frames');
    await viewer.call('close');
    await until(async () => !(await producer.call('has', { battle: '71' })), 'last viewer cleanup');
    await Promise.all([viewer.call('open', { battle: '75' }), producer.call('run', { battle: '75' })]);
    await until(() => viewer.packets.some(p => p.type === 'frame' && p.battleId === '75'), 'simultaneous open/replay eventually delivers');
    await viewer.call('close');
    for (let id = 80; id < 90; id++) {
      await viewer.call('open', { battle: String(id) }); await viewer.call('close');
      await until(async () => !(await producer.call('has', { battle: String(id) })), 'immediate close clears presence ' + id);
    }
    await viewer.call('open', { battle: '76' });
    await until(() => producer.call('has', { battle: '76' }), 'presence for occupied lock');
    const control = new Redis(url, { maxRetriesPerRequest: 1 });
    await control.set('om:battle_stream:76', 'another-worker', 'PX', 30000);
    await producer.call('run', { battle: '76' }); await sleep(800);
    assert.equal(viewer.packets.filter(p => p.type === 'frame' && p.battleId === '76').length, 0, 'occupied NX lock suppresses duplicate stream');
    await control.del('om:battle_stream:76'); control.disconnect(); await viewer.call('close');
    await producer.call('run', { battle: '72' });
    await sleep(900);
    await viewer.call('open', { battle: '72' });
    await until(() => viewer.packets.some(p => p.type === 'frame' && p.battleId === '72'), 'late remote join');
    const late = viewer.packets.find(p => p.type === 'frame' && p.battleId === '72');
    assert.ok(late.t > 0, 'viewer joining late sees current playback');
    await viewer.call('close');
    await producer.call('open', { battle: '74' });
    await viewer.call('open', { battle: '73' });
    await until(() => producer.call('has', { battle: '73' }), 'presence before restart');
    redis.kill('SIGTERM'); await new Promise(resolve => redis.once('exit', resolve)); redis = null;
    await sleep(400);
    await producer.call('broadcast', { battle: '74', tick: 888 });
    await until(() => producer.packets.some(p => p.type === 'frame' && p.battleId === '74' && p.t === 888), 'local delivery while Redis down');
    await producer.call('close'); await producer.call('open', { battle: '77' });
    await producer.call('run', { battle: '77' });
    await until(() => producer.packets.some(p => p.type === 'frame' && p.battleId === '77'), 'replay local fallback when Redis lock fails', 500);
    await producer.call('close');
    redis = await launchRedis(port);
    await until(() => producer.call('has', { battle: '73' }), 'presence re-registration after Redis restart', 500);
    await producer.call('broadcast', { battle: '73', tick: 777 });
    await until(() => viewer.packets.some(p => p.type === 'frame' && p.battleId === '73' && p.t === 777), 'remote frame after Redis restart', 500);
    await sleep(150);
    assert.equal(viewer.packets.filter(p => p.type === 'frame' && p.battleId === '73' && p.t === 777).length, 1, 'no duplicate after reconnect');
    await viewer.call('close');
    await until(async () => !(await producer.call('has', { battle: '73' })), 'presence removed after reconnect');
    const emptyReplayLoad = [];
    for (const count of [20, 50]) {
      const bench = launchWorker(url); workers.push(bench); await bench.ready; await sleep(300);
      await bench.call('resetMetrics'); await bench.call('runMany', { count, startId: 1000 + count * 100 }); await sleep(3000);
      const observed = await bench.call('metrics'); emptyReplayLoad.push({ count, ...observed });
      assert.ok(observed.presenceChannels >= count, 'each viewerless replay checks presence: ' + JSON.stringify(observed));
      assert.ok(observed.pendingReplayTimers <= count, 'bounded timer per replay');
      await bench.call('quit'); bench.child.kill('SIGTERM'); workers.pop();
    }
    console.log(JSON.stringify({ result: 'passed', scope: 'two independent Node processes, real wsServer/scheduler and local Redis; DB/auth/frames mocked', pids, initialRemoteFrames: firstTicks.length, simultaneousOpenReplay: true, immediateDisconnects: 10, lateJoinTick: late.t, redisReconnect: true, localWhileRedisDown: true, localReplayOnLockFailure: true, occupiedLockNoDuplicate: true, duplicateFrames: 0, presenceCleanup: true, emptyReplayLoad, productionTraffic: false }));
  } finally {
    for (const w of workers) { try { await w.call('quit'); } catch (_) {} w.child.kill('SIGTERM'); }
    if (redis) { redis.kill('SIGTERM'); await new Promise(resolve => redis.once('exit', resolve)); }
  }
}
if (process.argv.includes('--worker')) worker().catch(error => { console.error(error.stack); process.exit(1); });
else main().catch(error => { console.error(error.stack); process.exitCode = 1; });
