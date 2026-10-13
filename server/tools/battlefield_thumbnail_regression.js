#!/usr/bin/env node
'use strict';
// Keep DOM thumbnails and canvas battlefield crops on the same atlas cells.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '../..');
const window = {};
vm.runInNewContext(fs.readFileSync(path.join(root, 'assets/battlefield-art.js'), 'utf8'), {window});
const art = window.BattlefieldArt;
const groups = {
  a: ['orbit_territory', 'mining_site', 'canyon_outpost', 'polar_ice'],
  b: ['lava_tube', 'refinery_yard', 'colony_dome', 'excavation_grid'],
  c: ['dust_storm', 'occupied_airspace', 'shipyard_drydock', 'ancient_ruins'],
  d: ['garrison_rooftop', 'deep_mine', 'settlement_airspace', 'orbital_minefield']
};
for (const [group, keys] of Object.entries(groups)) {
  keys.forEach((key, index) => {
    const markup = art.thumbnailMarkup(key);
    const x = index % 2, y = Math.floor(index / 2);
    assert.ok(markup.includes('viewBox="0 0 1 1" preserveAspectRatio="xMidYMid meet"'), key + ': cell aspect ratio');
    assert.ok(markup.includes('viewBox="' + x + ' ' + y + ' 1 1" preserveAspectRatio="none" overflow="hidden"'), key + ': isolated cell');
    assert.ok(markup.includes('href="/assets/battlefields/realistic-atlas-' + group + '.webp"'), key + ': correct atlas');
    assert.ok(markup.includes('width="2" height="2"'), key + ': full atlas coordinates');
    assert.deepEqual(JSON.parse(JSON.stringify(art.sourceRect(key, 1254, 1254))), {x: x * 627, y: y * 627, width: 627, height: 627}, key + ': canvas uses same cell');
    assert.equal(art.backgrounds[key], art.resolve(key).path);
    assert.equal(typeof art.thumbnailStyle(key), 'string');
  });
}
for (const key of art.keys.filter(key => art.resolve(key).columns === 1).concat('unknown-field')) {
  const markup = art.thumbnailMarkup(key);
  assert.equal((markup.match(/<svg /g) || []).length, 1, key + ': standalone image');
  assert.ok(!markup.includes('viewBox='), key + ': standalone fits the full slot without a square intermediary');
  assert.ok(markup.includes('width="100%" height="100%" preserveAspectRatio="xMidYMid meet"'), key + ': preserve source proportions in the full slot');
  assert.ok(fs.existsSync(path.join(root, art.resolve(key).path)), key + ': source exists');
}
// Check both real HTML consumers use clipped markup, while tactical canvas APIs remain intact.
for (const file of ['assets/battle-hub-modal.js', 'assets/objective-operations.js']) {
  const source = fs.readFileSync(path.join(root, file), 'utf8');
  new vm.Script(source);
  assert.ok(source.includes('BattlefieldArt.thumbnailMarkup('), file);
  assert.ok(!source.includes('BattlefieldArt.thumbnailStyle('), file + ': no stretched CSS atlas');
}
const tactical = fs.readFileSync(path.join(root, 'assets/tactical-lab-v11.html'), 'utf8');
assert.ok(tactical.includes('BattlefieldArt.sourceRect('));
assert.ok(tactical.includes('BattlefieldArt.backgrounds'));
console.log('PASS: all 16 atlas cells clipped consistently with canvas crops, standalone/fallback proportions, asset paths, both DOM consumers, and existing canvas/background/style APIs.');
