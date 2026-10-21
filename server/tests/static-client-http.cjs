'use strict';
// Standalone local HTTP regression. Uses one private Unix socket; no DB, .env,
// account, key generation or application bootstrap. Intentionally not in the
// socket-free *.test.js suite; run explicitly with node --test.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const vm = require('node:vm');
const express = require('express');
const repo = path.resolve(__dirname, '../..');
const source = fs.readFileSync(path.join(repo, 'server/index.js'), 'utf8');
const start = source.indexOf('// Publish only game client files');
const end = source.indexOf('// ── SPA fallback ──', start);
assert.ok(start >= 0 && end > start, 'extract current production static publication block');
function request(socketPath, route) {
  return new Promise((resolve, reject) => {
    const req = http.get({ socketPath, path: route }, res => {
      const chunks = []; res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }));
    });
    req.on('error', reject);
  });
}
test('production static block serves exact minigame scripts and keeps repository/public internals private over HTTP', async () => {
  const app = express();
  vm.runInNewContext(source.slice(start, end), { app, express, path, __dirname: path.join(repo, 'server') });
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'mars-static-'));
  const socketPath = path.join(temporary, 'http.sock');
  const server = http.createServer(app);
  try {
    await new Promise((resolve, reject) => { server.once('error', reject); server.listen(socketPath, resolve); });
    for (const name of ['minigame-runner.js', 'minigame-invaders.js', 'minigame-digger.js']) {
      const response = await request(socketPath, '/public/js/' + name + '?v=regression');
      assert.equal(response.status, 200, name);
      assert.match(response.headers['content-type'], /javascript/);
      assert.deepEqual(response.body, fs.readFileSync(path.join(repo, 'public/js', name)), name + ' serves actual script');
    }
    for (const route of ['/authenticator.html', '/index.html', '/assets/authenticator-entry.js']) {
      assert.equal((await request(socketPath, route)).status, 200, route);
    }
    for (const route of [
      '/public', '/public/', '/public/js/', '/public/js/unknown.js',
      '/public/js/minigame-runner.js.map', '/public/js/../server/index.js',
      '/server/index.js', '/server/package.json', '/package.json',
      '/.env', '/server/.env', '/public/.env', '/public/js/.env',
      '/docs/AUTHENTICATOR_LOCAL.md', '/tools/sea-i18n.js'
    ]) assert.equal((await request(socketPath, route)).status, 404, route);
  } finally {
    await new Promise(resolve => server.close(resolve));
    fs.rmSync(temporary, { recursive: true, force: true });
  }
});
