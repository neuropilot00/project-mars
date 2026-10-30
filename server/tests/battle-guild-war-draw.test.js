'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../services/battleScheduler.js'), 'utf8');
const start = source.indexOf('async function _guildWarHook(');
const end = source.indexOf('\nmodule.exports', start);
assert.ok(start >= 0 && end > start, 'guild hook must be present');

function fixture({ activeWar = true } = {}) {
  const queries = [], awards = [];
  const pool = { async query(sql, params) {
    queries.push({ sql, params });
    if (sql.includes('FROM fleet_battle_participants')) return { rows: [
      { wallet_address: 'attacker', side: 'atk' },
      { wallet_address: 'defender', side: 'def' },
    ] };
    if (sql.includes('FROM guild_wars')) return { rows: activeWar ? [{ id: 7 }] : [] };
    throw new Error('unexpected query');
  } };
  const context = { pool, console: { log() {}, warn() {} }, require(name) {
    if (name === '../db') return { getSetting: async () => '10' };
    if (name === './guild') return { recordWarAction: async (...args) => { awards.push(args); return {}; } };
    throw new Error('unexpected dependency');
  } };
  const hook = vm.runInNewContext(`(${source.slice(start, end)})`, context);
  return { hook, queries, awards };
}

test('draw, absent or invalid winner cannot query or award guild victory points', async () => {
  for (const result of [{ winner_side: 'draw' }, { winner_side: null }, {}, null, { winner_side: 'invalid' }]) {
    const f = fixture();
    await f.hook(101, result);
    assert.equal(f.queries.length, 0);
    assert.equal(f.awards.length, 0);
  }
});

for (const [side, wallet] of [['atk', 'attacker'], ['def', 'defender']]) {
  test(`${side} victory awards only the actual winner`, async () => {
    const f = fixture();
    await f.hook(101, { winner_side: side });
    assert.equal(f.awards.length, 1);
    assert.equal(f.awards[0][0], wallet);
    assert.equal(f.awards[0][1], 'fleet_battle_win');
    assert.equal(f.awards[0][2], 10);
    assert.equal(f.awards[0][3].battleId, 101);
  });
}

test('a decisive result without an active guild war does not award points', async () => {
  const f = fixture({ activeWar: false });
  await f.hook(101, { winner_side: 'def' });
  assert.equal(f.awards.length, 0);
});
