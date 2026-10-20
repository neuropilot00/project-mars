'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../services/npcEconomy.js'), 'utf8');

function fixture({ owners = [{ wallet_address: 'npc', is_ai: true, gp_balance: '0' }], enabled = 'true', missingLedger = false } = {}) {
  const calls = [];
  let listings = 0;
  const client = { release() {}, async query(sql, args) {
    calls.push(sql);
    if (/^(BEGIN|COMMIT|ROLLBACK)$/.test(sql)) return { rows: [] };
    if (/SELECT wallet_address, is_ai, gp_balance/.test(sql)) return { rows: owners };
    if (/FROM resources/.test(sql)) return { rows: [{ id: 1, code: 'iron_ore' }] };
    if (/FROM user_resource_inventory/.test(sql)) return { rows: [] };
    if (/FROM npc_economy_seed_ledger/.test(sql)) {
      if (missingLedger) throw Error('relation npc_economy_seed_ledger does not exist');
      return { rows: [{ wallet_address: 'npc' }] };
    }
    throw Error('Unexpected mutation: ' + sql + JSON.stringify(args));
  } };
  const pool = { connect: async () => client, async query(sql, args) {
    if (/FROM settings/.test(sql)) return { rows: args[0] === 'npc_economy_enabled' ? [{ value: enabled }] : [] };
    if (/COUNT/.test(sql)) return { rows: [{ n: 0 }] };
    if (/SELECT wallet_address FROM users/.test(sql)) return { rows: [{ wallet_address: 'NPC' }] };
    throw Error('Unexpected pool SQL: ' + sql);
  } };
  const module = { exports: {} };
  vm.runInNewContext(source, { module, exports: module.exports, require(name) {
    if (name === '../db') return { pool };
    assert.equal(name, './marketplace');
    return { async createListing() { listings++; } };
  } });
  return { service: module.exports, calls, listings: () => listings };
}

test('disabled fallback does not enter a transaction', async () => {
  const f = fixture({ enabled: 'false' });
  assert.equal((await f.service.runMarketTick()).skipped, 'disabled');
  assert.equal(f.calls.length, 0);
});

test('missing migration fails closed before inventory or GP issuance', async () => {
  const f = fixture({ missingLedger: true });
  assert.equal((await f.service.runMarketTick()).created, 0);
  assert.equal(f.calls.at(-1), 'ROLLBACK');
  assert.equal(f.calls.filter(sql => /^(INSERT|UPDATE)/.test(sql)).length, 0);
  assert.equal(f.listings(), 0);
});

for (const owners of [[], [{ wallet_address: 'npc', is_ai: false, gp_balance: '0' }],
  [{ wallet_address: 'npc', is_ai: true, gp_balance: '0' }, { wallet_address: 'NPC', is_ai: false, gp_balance: '0' }],
  ...[null, '', 'NaN', '-1', 'Infinity'].map(gp_balance => [{ wallet_address: 'npc', is_ai: true, gp_balance }])]) {
  test('invalid identity/balance cannot issue or list: ' + JSON.stringify(owners), async () => {
    const f = fixture({ owners });
    assert.equal((await f.service.runMarketTick()).created, 0);
    assert.equal(f.calls.at(-1), 'ROLLBACK');
    assert.equal(f.calls.filter(sql => /^(INSERT|UPDATE)/.test(sql)).length, 0);
    assert.equal(f.listings(), 0);
  });
}

test('normalized input with one AI ledger entry lists without another seed', async () => {
  const f = fixture();
  assert.equal((await f.service.runMarketTick()).created, 1);
  assert.equal(f.listings(), 1);
  assert.equal(f.calls.filter(sql => /^(INSERT|UPDATE)/.test(sql)).length, 0);
  assert.equal(f.calls.at(-1), 'COMMIT');
});
