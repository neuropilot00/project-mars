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
  const context = { module: { exports: {} }, Buffer, Date, JSON, setTimeout, clearTimeout, setInterval, clearInterval,
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
    './utils/battleFrameWire': require('../utils/battleFrameWire'), './services/battleVisualJournal': require('../services/battleVisualJournal') });
  const server = http.createServer();
  const wss = api.attachWsServer(server);
  const frames = Array.from({ length: 60 }, (_, i) => ({ t: i * 5, ships: [], fleets: [],
    combat_events: ['atk','def'].map((side, n) => ({ id:`71:combat:${i*2+n+1}`, seq:i*2+n+1, tick:i*5,
      type:'shot_hit', source_side:side, fire_type:'laser', from:{x:1,y:2}, to:{x:8,y:2}, damage:1, destroyed:false })) }));
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
    const pids = await Promise.all(workers.map(w => w.ready)); assert.notEqual(...pids);
    await viewer.call('open', { battle:'71' });
    await until(() => producer.call('has', { battle:'71' }), 'remote spectator registered');
    assert.equal(await producer.call('run', { battle:'71' }),true);
    await until(() => viewer.packets.filter(p=>p.type==='frame').length>=3, 'initial replay frames');
    const before = viewer.packets.filter(p=>p.type==='frame').length;
    redis.kill('SIGTERM'); await new Promise(resolve=>redis.once('exit',resolve)); redis=null;
    // Producer has no local viewer. It must journal skipped display frames while
    // Redis presence is unavailable rather than silently discarding them.
    await sleep(1800);
    assert.equal(viewer.packets.filter(p=>p.type==='frame').length,before,'remote receives no data while Redis is down');
    redis=await launchRedis(port);
    await until(()=>viewer.packets.some(p=>p.type==='frame'&&p.recovery_incomplete===false),'recovered frame',1000);
    await until(()=>viewer.packets.some(p=>p.type==='end'),'replay end after recovery',1000);
    const received=viewer.packets.filter(p=>p.type==='frame');
    const sums={atk:0,def:0};
    for (const packet of received) {
      for (const event of packet.combat_events||[]) if (event.source_side in sums) sums[event.source_side]++;
      for (const salvo of packet.combat_salvos||[]) if (salvo.source_side in sums) sums[salvo.source_side]+=salvo.count;
    }
    assert.deepEqual(sums,{atk:60,def:60},'all actual replay visual counts survive Redis outage');
    const sequence=received.map(p=>p._continuity?.seq).filter(Number.isSafeInteger);
    assert.equal(new Set(sequence).size,sequence.length,'no duplicate replay continuity cursor');
    assert.ok(sequence.every((seq,i)=>!i||seq>sequence[i-1]),'strict replay order');
    assert.equal(viewer.packets.filter(p=>p.type==='end').length,1,'end delivered once');
    console.log(JSON.stringify({result:'passed',scope:'two independent real scheduler/WS processes and local Redis; no local producer spectator; DB/auth/frames fixtures',pids,beforeOutage:before,recovered:received.filter(p=>p.recovery_incomplete===false).length,receivedFrames:received.length,visualCounts:sums,endCount:1,productionTraffic:false}));
  } finally {
    for (const w of workers) { try { await w.call('quit'); } catch (_) {} w.child.kill('SIGTERM'); }
    if (redis) { redis.kill('SIGTERM'); await new Promise(resolve=>redis.once('exit',resolve)); }
  }
}
if (process.argv.includes('--worker')) worker().catch(error=>{console.error(error.stack);process.exit(1);});
else main().catch(error=>{console.error(error.stack);process.exitCode=1;});
