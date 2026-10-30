'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../wsServer.js'), 'utf8');
function fixture(call) {
  const context = { module: { exports: {} }, process: { env: {} }, console, Buffer,
    setTimeout, clearTimeout, setInterval, clearInterval, fake: { call },
    require(name) {
      if (name === 'ws') return { WebSocketServer: class {} };
      if (name === 'url') return require('node:url');
      if (name === 'crypto') return require('node:crypto');
      if (name === './utils/totpSessionBoundary') return {};
      throw Error('Unexpected dependency: ' + name);
    } };
  vm.runInNewContext(source + '\n_pub = fake; _redisReady = true;', context);
  return context.module.exports;
}

test('remote viewer checks batch and deduplicate Redis NUMSUB without changing per-battle results', async () => {
  const calls = [];
  const api = fixture(async (...args) => {
    calls.push(args);
    return args.slice(2).flatMap(key => [key, key.endsWith(':3') ? 1 : 0]);
  });
  const checks = Array.from({ length: 130 }, (_, i) => api.hasBattleViewers(String(i + 1)));
  checks.push(api.hasBattleViewers('3'), api.hasBattleViewers('invalid'));
  const result = await Promise.all(checks);
  assert.equal(calls.length, 2, 'NUMSUB is bounded to 128 channels per request');
  assert.equal(calls[0].length, 130);
  assert.equal(calls[1].length, 4);
  assert.deepEqual(result.map((v, i) => v ? i : -1).filter(i => i >= 0), [2, 130]);
});

test('a stalled Redis viewer check times out and a later successful check recovers', async () => {
  let calls = 0, release;
  const api = fixture(async (...args) => {
    if (++calls === 1) return new Promise(resolve => { release = resolve; });
    return [args[2], 1];
  });
  const started = Date.now();
  assert.equal(await api.hasBattleViewers('71'), false);
  assert.ok(Date.now() - started < 1200, 'a stuck Redis request cannot stall playback indefinitely');
  release(['om:ws:watch:71', 1]);
  assert.equal(await api.hasBattleViewers('71'), true);
  assert.equal(calls, 2);
});
