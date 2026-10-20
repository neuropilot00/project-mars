'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
require('./isolation-guard.cjs');

test('fixture suite cannot load live clients, open sockets or read .env', () => {
  for (const name of ['pg', 'dotenv', 'ioredis', 'nodemailer', 'ethers']) {
    assert.throws(() => require(name), /ISOLATED_TEST/);
  }
  assert.throws(() => require('node:net').connect({ port: 5432, host: '127.0.0.1' }), /ISOLATED_TEST/);
  assert.throws(() => require('node:dns').lookup('example.invalid'), /ISOLATED_TEST/);
  assert.throws(() => require('node:fs').readFileSync('/fixture/.env'), /ISOLATED_TEST/);
});
