'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

async function report(battle) {
  const pool = { async query(sql) {
    if (sql.includes('FROM fleet_battles') && sql.includes('battle_summary')) return { rows: [battle] };
    return { rows: [], rowCount: 1 };
  } };
  const box = { module: { exports: {} }, console, require(name) {
    if (name === '../db') return { pool };
    throw new Error(`unexpected dependency ${name}`);
  } };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../services/battleReport.js'), 'utf8'), box);
  return box.module.exports.generateBattleReport(1, '');
}

test('reports preserve simulation ticks independently from live wall-clock duration', async () => {
  const result = await report({ id: 1, winner_side: 'def', duration_seconds: 273,
    battle_summary: JSON.stringify({ duration_ticks: 5465 }) });
  assert.equal(result.duration_ticks, 5465);
  assert.equal(result.summary.total_ticks, 5465);
});

test('historical reports derive ticks from the original simulated seconds', async () => {
  const result = await report({ id: 1, winner_side: 'def', duration_seconds: 1105, battle_summary: {} });
  assert.equal(result.duration_ticks, 5525);
  assert.equal(result.summary.total_ticks, 5525);
});
