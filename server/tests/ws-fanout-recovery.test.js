'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function fixture() {
  const redis = [];
  let server;
  class Redis {
    constructor() { this.events = {}; this.published = []; this.reject = false; redis.push(this); }
    on(name, callback) { this.events[name] = callback; }
    subscribe(_channel, callback) { callback(null); }
    publish(channel, raw) {
      this.published.push(JSON.parse(raw));
      if (this.reject) return Promise.reject(new Error('connection lost'));
      redis[1].events.message(channel, raw);
      return Promise.resolve(1);
    }
  }
  class WebSocketServer {
    constructor() { server = this; this.events = {}; }
    on(name, callback) { this.events[name] = callback; }
  }
  const context = { module: { exports: {} }, process: { env: { REDIS_URL: 'fixture' } },
    console: { log() {}, warn() {}, error() {} }, Buffer, setTimeout, clearTimeout, setInterval, clearInterval,
    require(name) {
      if (name === 'ioredis') return Redis;
      if (name === 'ws') return { WebSocketServer };
      if (name === 'url') return require('node:url');
      if (name === 'crypto') return { randomUUID: () => 'fixture-instance' };
      if (name === './utils/totpSessionBoundary') return { validateToken: async () => ({ wallet: null }) };
      if (name === './db') return { pool: { query: async () => ({ rows: [] }) } };
      throw Error('Unexpected dependency: ' + name);
    } };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../wsServer.js'), 'utf8'), context);
  context.module.exports.attachWsServer({ on() {} });
  const socket = { battleId: '71', readyState: 1, bufferedAmount: 0, sent: [],
    send(raw) { this.sent.push(JSON.parse(raw)); }, on() {}, terminate() { this.readyState = 3; } };
  server.events.connection(socket);
  return { api: context.module.exports, socket, pub: redis[0], sub: redis[1] };
}
const frames = f => f.socket.sent.filter(m => m.type === 'frame');
const flush = () => new Promise(resolve => setImmediate(resolve));

test('Redis echo does not duplicate local frames and remote frames remain delivered', async () => {
  const f = fixture();
  f.api.broadcastBattleFrame('71', { t: 1 });
  await flush();
  assert.deepEqual(frames(f).map(m => m.t), [1]);
  f.sub.events.message('om:ws', JSON.stringify({ kind: 'battleFrame', origin: 'other-instance', battleId: '71', frame: { t: 2 } }));
  assert.deepEqual(frames(f).map(m => m.t), [1, 2]);
});

test('rejected asynchronous publish still delivers locally and is handled', async () => {
  const f = fixture();
  f.pub.reject = true;
  f.api.broadcastBattleFrame('71', { t: 3 });
  await flush();
  assert.deepEqual(frames(f).map(m => m.t), [3]);
});

test('disconnected subscriber keeps local delivery and resubscribes on reconnect', async () => {
  const f = fixture();
  f.sub.events.close();
  f.api.broadcastBattleFrame('71', { t: 4 });
  assert.equal(f.pub.published.length, 0);
  f.sub.events.ready();
  f.api.broadcastBattleFrame('71', { t: 5 });
  await flush();
  assert.deepEqual(frames(f).map(m => m.t), [4, 5]);
  assert.equal(f.pub.published.length, 1);
});
