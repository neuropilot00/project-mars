'use strict';
// 200 synthetic observers via four local reverse proxies and real Redis fanout.
// The 600-ship frame is a fixed engine output; no production traffic or accounts.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const http = require('node:http');
const net = require('node:net');
const { fork, spawn } = require('node:child_process');
const { gunzipSync } = require('node:zlib');
const { monitorEventLoopDelay } = require('node:perf_hooks');
const assert = require('node:assert/strict');
const WebSocket = require('ws');
const Redis = require('ioredis');
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(predicate, name, attempts = 300) { for (let i = 0; i < attempts; i++) { if (await predicate()) return; await pause(20); } throw Error('Timeout: ' + name); }
async function availablePort() { const srv = net.createServer(); await new Promise(resolve => srv.listen(0, '127.0.0.1', resolve)); const p = srv.address().port; await new Promise(resolve => srv.close(resolve)); return p; }
async function startRedis(port) { const child = spawn('redis-server', ['--port', String(port), '--bind', '127.0.0.1', '--save', '', '--appendonly', 'no'], { stdio: 'ignore' }); await until(() => new Promise(resolve => { const sock = net.createConnection(port, '127.0.0.1'); sock.once('connect', () => { sock.destroy(); resolve(true); }); sock.once('error', () => resolve(false)); }), 'Redis start'); return child; }
async function worker() {
  const source = fs.readFileSync(path.join(__dirname, '../wsServer.js'), 'utf8');
  const redisClients = [];
  class TrackedRedis extends Redis { constructor(...args) { super(...args); redisClients.push(this); } }
  const context = { module: { exports: {} }, Buffer, Date, setTimeout, clearTimeout, setInterval, clearInterval,
    process: { env: { REDIS_URL: process.env.TEST_REDIS_URL, WS_MAX_PER_IP: '50' } }, console: { log() {}, warn() {}, error() {} },
    require(name) {
      if (name === 'ioredis') return TrackedRedis;
      if (name === 'ws') return WebSocket;
      if (name === 'url') return require('node:url');
      if (name === 'crypto') return require('node:crypto');
      if (name === './utils/totpSessionBoundary') return { validateToken: async () => ({ wallet: null, totp: false, revoked: false }) };
      if (name === './db') return { pool: { query: async () => ({ rows: [{ status: 'active' }] }) } };
      if (name === './utils/battleFrameWire') return require('../utils/battleFrameWire');
      throw Error('Unexpected dependency: ' + name);
    } };
  vm.runInNewContext(source, context, { filename: 'wsServer.js' });
  const api = context.module.exports, server = http.createServer(), wss = api.attachWsServer(server);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const lag = monitorEventLoopDelay({ resolution: 20 }); lag.enable(); let baseline = { cpu: process.cpuUsage(), at: Date.now() };
  process.on('message', async message => {
    try {
      let value;
      if (message.op === 'ready') value = redisClients.length === 2 && redisClients.every(c => c.status === 'ready');
      else if (message.op === 'reset') { lag.reset(); baseline = { cpu: process.cpuUsage(), at: Date.now() }; value = true; }
      else if (message.op === 'broadcast') {
        const payload = JSON.parse(fs.readFileSync(process.env.TEST_FRAME_PATH, 'utf8'));
        payload.t = message.sequence; payload.test_sent_ms = Date.now();
        api.broadcastBattleFrame('77', payload); value = true;
      } else if (message.op === 'stats') {
        const cpu = process.cpuUsage(baseline.cpu);
        value = { wallMs: Date.now() - baseline.at, userCpuMs: cpu.user / 1000, systemCpuMs: cpu.system / 1000,
          rssBytes: process.memoryUsage().rss, eventLoopP95Ms: lag.percentile(95) / 1e6, eventLoopP99Ms: lag.percentile(99) / 1e6,
          eventLoopMaxMs: lag.max / 1e6, channels: api.channelStats() };
      } else if (message.op === 'quit') {
        redisClients.forEach(c => c.disconnect()); wss.close(); server.close();
        process.send({ id: message.id, value: true }); return setTimeout(() => process.exit(0), 50);
      }
      process.send({ id: message.id, value });
    } catch (error) { process.send({ id: message.id, error: error.stack }); }
  });
  process.send({ event: 'ready', port: server.address().port, pid: process.pid });
}
function spawnWorker(url, framePath) {
  const child = fork(__filename, ['--worker'], { env: { PATH: process.env.PATH, TEST_REDIS_URL: url, TEST_FRAME_PATH: framePath }, stdio: ['ignore','ignore','inherit','ipc'] });
  const pending = new Map(); let next = 0;
  const ready = new Promise((resolve, reject) => { child.once('error', reject); child.on('message', m => { if (m.event === 'ready') resolve(m); else if (pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.reject(Error(m.error)) : p.resolve(m.value); } }); });
  return { child, ready, call(op, args = {}) { const id = ++next; return new Promise((resolve,reject) => { pending.set(id,{resolve,reject}); child.send({ id, op, ...args }); }); } };
}
async function proxy(upstreamPort, address, sockets) {
  const server = http.createServer();
  server.on('upgrade', (req, client, head) => {
    const upstream = net.createConnection(upstreamPort, '127.0.0.1'); sockets.add(client); sockets.add(upstream);
    client.on('close', () => sockets.delete(client)); upstream.on('close', () => sockets.delete(upstream));
    client.on('error', () => upstream.destroy()); upstream.on('error', () => client.destroy());
    upstream.once('connect', () => {
      const headers = { ...req.headers, 'x-forwarded-for': address };
      const text = Object.entries(headers).map(([name, value]) => `${name}: ${value}`).join('\r\n');
      upstream.write(`${req.method} ${req.url} HTTP/${req.httpVersion}\r\n${text}\r\n\r\n`);
      if (head.length) upstream.write(head); client.pipe(upstream); upstream.pipe(client);
    });
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); return server;
}
async function main() {
  const framePath = '/Users/jongho/Documents/Codex/2026-10-10/oc/outputs/coalition-vfx-load-20261030/final-max.json';
  const frame = JSON.parse(fs.readFileSync(framePath, 'utf8')); assert.equal(frame.ships.length, 600);
  const port = await availablePort(), workers = [], proxies = [], clients = [], proxiedSockets = new Set(); let redis, monitor;
  const latencies = [], counts = { raw: 0, gzip: 0, decodedRaw: 0, decodedGzip: 0, malformed: 0, duplicate: 0, bytes: { raw: 0, gzip: 0 }, errors: 0 };
  try {
    redis = await startRedis(port); const url = `redis://127.0.0.1:${port}`;
    const a = spawnWorker(url, framePath), b = spawnWorker(url, framePath); workers.push(a,b); const ready = await Promise.all(workers.map(w => w.ready));
    for (let i = 0; i < 4; i++) proxies.push(await proxy(ready[Math.floor(i/2)].port, `198.51.100.${i+1}`, proxiedSockets));
    await until(async () => (await Promise.all(workers.map(w => w.call('ready')))).every(Boolean), 'Redis subscriptions');
    for (let i = 0; i < 200; i++) {
      const compressed = i % 2 === 0, proxyServer = proxies[Math.floor(i / 50)];
      const socket = new WebSocket(`ws://127.0.0.1:${proxyServer.address().port}/ws/battle/77${compressed ? '?wire=gzip-v1' : ''}`);
      const seen = new Set(); clients.push(socket); socket.on('error', () => { counts.errors++; });
      socket.on('message', raw => {
        try {
          const packet = JSON.parse(raw.toString()); if (!['frame','frame_gzip_v1'].includes(packet.type)) return;
          const isGzip = packet.type === 'frame_gzip_v1'; const decoded = isGzip ? JSON.parse(gunzipSync(Buffer.from(packet.data, 'base64'))) : packet;
          if (isGzip !== compressed || decoded.ships.length !== 600 || decoded.battleId !== '77') throw Error('wire format or content mismatch');
          const key = compressed ? 'gzip' : 'raw'; counts[key]++; counts.bytes[key] += raw.length; counts[isGzip ? 'decodedGzip' : 'decodedRaw']++;
          if (seen.has(decoded.t)) counts.duplicate++; seen.add(decoded.t); latencies.push(Date.now() - decoded.test_sent_ms);
        } catch (_) { counts.malformed++; }
      });
    }
    await until(() => clients.every(c => c.readyState === WebSocket.OPEN), '200 WebSockets open', 600);
    monitor = new Redis(url, { maxRetriesPerRequest: 2 }); await until(() => monitor.status === 'ready', 'Redis monitor');
    await until(async () => Number((await monitor.call('PUBSUB', 'NUMSUB', 'om:ws:watch:77'))[1]) === 2, 'both nodes registered');
    await Promise.all(workers.map(w => w.call('reset'))); const started = Date.now();
    for (let sequence = 0; sequence < 12; sequence++) { await a.call('broadcast', { sequence }); if (sequence < 11) await pause(1250); }
    await until(() => counts.raw + counts.gzip >= 2400, 'all 2400 frames received', 600); const elapsedMs = Date.now() - started;
    const status = await Promise.all(workers.map(w => w.call('stats')));
    assert.equal(counts.raw,1200); assert.equal(counts.gzip,1200); assert.equal(counts.duplicate,0); assert.equal(counts.malformed,0); assert.equal(counts.errors,0);
    const sorted = latencies.sort((x,y)=>x-y), pct = p => sorted[Math.min(sorted.length-1,Math.floor(sorted.length*p))];
    console.log(JSON.stringify({ result:'passed', scope:'two independent actual wsServer processes, real local Redis, 4 local reverse proxies inject 4 virtual client IPs, 200 local sockets, 600-ship fixed real engine frame, fixture auth/DB, 12 broadcasts at 1250ms. This models 200 sockets, not independent clients, devices, WAN or production ingress.', pids: ready.map(x=>x.pid), ports: 'ephemeral', clients:200, perNode:100, rawClients:100, gzipClients:100, virtualIps:4, frames:12, totalReceived:counts.raw+counts.gzip, duplicate:counts.duplicate, malformed:counts.malformed, errors:counts.errors, rawBytes:counts.bytes.raw, gzipBytes:counts.bytes.gzip, latencyP50Ms:pct(.5), latencyP95Ms:pct(.95), latencyP99Ms:pct(.99), latencyMaxMs:sorted.at(-1), elapsedMs, nodeStats:status, productionTraffic:false }));
  } finally {
    clients.forEach(c => c.terminate()); proxiedSockets.forEach(s => s.destroy()); monitor?.disconnect();
    for (const proxyServer of proxies) await new Promise(resolve => proxyServer.close(resolve));
    for (const w of workers) { try { await w.call('quit'); } catch (_) {} w.child.kill('SIGTERM'); }
    if (redis) { redis.kill('SIGTERM'); await new Promise(resolve => redis.once('exit', resolve)); }
  }
}
if (process.argv.includes('--worker')) worker().catch(error => { console.error(error.stack); process.exit(1); });
else main().catch(error => { console.error(error.stack); process.exitCode = 1; });
