'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../services/crafting.js'), 'utf8');

function fixture({ items = [], resources = [], ingredients } = {}) {
  const calls = [];
  const recipe = { id: 1, ingredients: ingredients || [{ code: 'iron_ore', qty: 5 }, { resource_code: 'silicon_dust', qty: 3 }] };
  const pool = { async query(sql, args) {
    calls.push({ sql, args });
    if (/FROM crafting_recipes/.test(sql)) return { rows: [recipe] };
    if (/FROM user_items/.test(sql)) return { rows: items };
    if (/FROM user_resource_inventory/.test(sql)) return { rows: resources };
    throw Error('Unexpected SQL: ' + sql);
  } };
  const module = { exports: {} };
  vm.runInNewContext(source, { module, exports: module.exports, require(name) {
    assert.equal(name, '../db'); return { pool };
  } }, { filename: 'services/crafting.js' });
  return { service: module.exports, calls };
}

test('recipe list/detail accept mined resources using code and resource_code', async () => {
  const f = fixture({ resources: [{ code: 'iron_ore', quantity: '5' }, { code: 'silicon_dust', quantity: '3' }] });
  assert.equal((await f.service.getRecipes('all', 'COMMANDER'))[0].canCraft, true);
  assert.equal((await f.service.getRecipe(1, 'COMMANDER')).canCraft, true);
  for (const call of f.calls.filter(x => /user_(items|resource_inventory)/.test(x.sql))) assert.equal(call.args[0], 'commander');
});

test('insufficient resource stays unavailable even with unrelated item inventory', async () => {
  const f = fixture({ items: [{ item_type_id: 1, quantity: 999 }], resources: [{ code: 'iron_ore', quantity: 5 }, { code: 'silicon_dust', quantity: 2 }] });
  assert.equal((await f.service.getRecipes('all', 'commander'))[0].canCraft, false);
  assert.equal((await f.service.getRecipe(1, 'commander')).canCraft, false);
});

test('legacy item ingredients retain their inventory path', async () => {
  const f = fixture({ ingredients: [{ item_type_id: 1, qty: 2 }], items: [{ item_type_id: 1, quantity: 2 }] });
  assert.equal((await f.service.getRecipes('all', 'commander'))[0].canCraft, true);
  assert.equal((await f.service.getRecipe(1, 'commander')).canCraft, true);
});

test('public recipe reads stay unavailable and do not query personal inventory', async () => {
  const f = fixture();
  assert.equal((await f.service.getRecipes('all', null))[0].canCraft, false);
  assert.equal((await f.service.getRecipe(1, null)).canCraft, false);
  assert.equal(f.calls.filter(x => /user_(items|resource_inventory)/.test(x.sql)).length, 0);
});
