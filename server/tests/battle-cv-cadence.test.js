'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const filename = path.resolve(__dirname, '../services/battleEngine.js');
const box = { module: { exports: {} }, console, require(name) {
  if (name === '../db') return {};
  if (name === './battleEnvironment') return require('../services/battleEnvironment');
  if (name === './tacticsAI') return {};
  throw new Error('Unconfigured collaborator: ' + name);
} };
vm.runInNewContext(fs.readFileSync(filename, 'utf8') + '\nmodule.exports.__test={normalizeStandardShip,initShip};', box, { filename });
const { normalizeStandardShip, initShip } = box.module.exports.__test;

test('existing and newly acquired cruiser read current catalog cadence; standard invitations retain their captured cadence', () => {
  const type = { code:'cv_crs', base_hp:85000, base_atk:86, base_def:32, base_speed:0.8,
    fire_interval:400, fire_type:'missile', size_class:'cruiser', role:'dps' };
  const ship = id => ({ ...type, id, ship_type_code:type.code, current_hp:type.base_hp, max_hp:type.base_hp });
  const interval = data => initShip(data, { cx:0, cy:0 }, 0, 1, 20).fireInterval;
  assert.equal(interval(ship('existing')), 400);
  assert.equal(interval(ship('new')), 400);
  const oldTerms = { catalogByShipId:{ existing:{ ...type, fire_interval:225 } } };
  const newTerms = { catalogByShipId:{ existing:{ ...type, fire_interval:400 } } };
  assert.equal(interval(normalizeStandardShip(ship('existing'), oldTerms)), 225);
  assert.equal(interval(normalizeStandardShip(ship('existing'), newTerms)), 400);
});
