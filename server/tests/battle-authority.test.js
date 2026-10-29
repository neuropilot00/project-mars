'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

test('a transient heartbeat failure retries without abandoning a valid lease', async () => {
  let now = 0, timer, failRenewal = false;
  class Clock extends Date { static now() { return now; } }
  const client = { async query(sql) {
    if (sql.includes('COUNT(*) FILTER')) return { rows: [{ n: 0, ahead: 0 }] };
    if (sql.includes('live_slot_acquired=true')) return { rowCount: 1, rows: [{ id: 1 }] };
    return { rows: [] };
  }, release() {} };
  const pool = { async connect() { return client; }, async query(sql) {
    if (sql.includes('SET live_lease_expires_at=') && failRenewal) throw new Error('temporary DB outage');
    return { rowCount: 1, rows: [{ id: 1 }] };
  } };
  const box = { module: { exports: {} }, Date: Clock,
    require(name) { if (name === 'crypto') return { randomUUID: () => '00000000-0000-0000-0000-000000000001' }; throw Error(name); },
    setInterval(fn) { timer = fn; return { unref() {} }; }, clearInterval() {},
    setTimeout(fn) { fn(); } };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../services/battleAuthority.js'), 'utf8'), box);
  const authority = await box.module.exports.acquireLiveAuthority(pool, 1, 3);
  now = 10000; failRenewal = true; await timer();
  assert.equal(authority.shouldAbort(), false);
  now = 20000; failRenewal = false; await timer();
  now = 79999; assert.equal(authority.shouldAbort(), false);
  now = 80000; assert.equal(authority.shouldAbort(), true);
  authority.stop();
});
