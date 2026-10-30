'use strict';
// Independent local Redis + two WS service instances; no user data or accounts.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const http = require('node:http');
const net = require('node:net');
const { spawn } = require('node:child_process');
const WebSocket = require('ws');
const Redis = require('ioredis');
const source = fs.readFileSync(path.join(__dirname, '../wsServer.js'), 'utf8');
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(predicate, label, attempts = 250) {
  for (let i = 0; i < attempts; i++) { if (await predicate()) return; await pause(20); }
  throw Error('Timeout: ' + label);
}
async function freePort() {
  const server = net.createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  await new Promise(resolve => server.close(resolve));
  return port;
}
async function launchRedis(port) {
  const process = spawn('redis-server', ['--port', String(port), '--bind', '127.0.0.1', '--save', '', '--appendonly', 'no'], { stdio: 'ignore' });
  await until(async () => {
    const conn = net.createConnection({ port, host: '127.0.0.1' });
    return new Promise(resolve => { conn.once('connect', () => { conn.destroy(); resolve(true); }); conn.once('error', () => resolve(false)); });
  }, 'Redis start');
  return process;
}
function instance(port, redisClients) {
  class TrackedRedis extends Redis { constructor(...args) { super(...args); redisClients.push(this); } }
  const context = { module: { exports: {} }, process: { env: { REDIS_URL: `redis://127.0.0.1:${port}`, WS_MAX_PER_IP: '50' } },
    console: { log() {}, warn() {}, error() {} }, Buffer, setTimeout, clearTimeout, setInterval, clearInterval,
    require(name) {
      if (name === 'ioredis') return TrackedRedis;
      if (name === 'ws') return WebSocket;
      if (name === 'url') return require('node:url');
      if (name === 'crypto') return require('node:crypto');
      if (name === './utils/totpSessionBoundary') return { validateToken: async () => ({ wallet: null, totp: false, revoked: false }) };
      if (name === './db') return { pool: { query: async () => ({ rows: [] }) } };
      throw Error('Unexpected dependency: ' + name);
    } };
  vm.runInNewContext(source, context, { filename: 'wsServer.js' });
  const server = http.createServer();
  const wss = context.module.exports.attachWsServer(server);
  return { api: context.module.exports, server, wss };
}
async function connect(instance, clients) {
  const socket = new WebSocket(`ws://127.0.0.1:${instance.server.address().port}/ws/battle/71`);
  clients.push(socket);
  const frames = [];
  socket.on('message', raw => { const data = JSON.parse(raw); if (data.type === 'frame') frames.push(data.t); });
  await new Promise((resolve, reject) => { socket.once('open', resolve); socket.once('error', reject); });
  return frames;
}
(async () => {
  const port = await freePort(), clients = [], redisClients = [], instances = [];
  let redis;
  try {
    redis = await launchRedis(port);
    instances.push(instance(port, redisClients), instance(port, redisClients));
    for (const i of instances) await new Promise(resolve => i.server.listen(0, '127.0.0.1', resolve));
    const a = await connect(instances[0], clients), b = await connect(instances[1], clients);
    await until(() => redisClients.length === 4 && redisClients.every(c => c.status === 'ready'), 'four Redis clients ready');
    await pause(100);
    instances[0].api.broadcastBattleFrame('71', { t: 1 });
    await until(() => a.length === 1 && b.length === 1, 'Redis cross-instance frame');
    assert.deepEqual(a, [1]); assert.deepEqual(b, [1]);
    redis.kill('SIGTERM'); await new Promise(resolve => redis.once('exit', resolve)); redis = null;
    await until(() => redisClients[1].status !== 'ready' && redisClients[3].status !== 'ready', 'Redis disconnected');
    instances[0].api.broadcastBattleFrame('71', { t: 2 });
    await until(() => a.includes(2), 'local frame while Redis down');
    assert.deepEqual(a, [1, 2]); assert.deepEqual(b, [1]);
    redis = await launchRedis(port);
    await until(() => redisClients.every(c => c.status === 'ready'), 'Redis reconnect', 500);
    await pause(200);
    instances[0].api.broadcastBattleFrame('71', { t: 3 });
    await until(() => b.includes(3), 'remote frame after reconnect', 500);
    await pause(50);
    assert.deepEqual(a, [1, 2, 3]); assert.deepEqual(b, [1, 3]);
    console.log(JSON.stringify({ result: 'passed', actual: 'two isolated wsServer modules and localhost Redis', initialLocalFrames: [1], initialRemoteFrames: [1], localRedisOutageFrames: [2], remoteOutageFrames: [], recoveredFrames: [3], duplicateFrames: 0, recoveryIsReplay: false, productionTraffic: false }));
  } finally {
    clients.forEach(c => c.terminate());
    for (const i of instances) { await new Promise(resolve => i.wss.close(resolve)); await new Promise(resolve => i.server.close(resolve)); }
    redisClients.forEach(c => c.disconnect());
    if (redis) { redis.kill('SIGTERM'); await new Promise(resolve => redis.once('exit', resolve)); }
  }
})().catch(error => { console.error(error.stack); process.exitCode = 1; });
