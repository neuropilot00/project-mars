#!/usr/bin/env node
'use strict';
// Exercise actual sprite request and draw transitions without a browser or database.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '../..');
const source = fs.readFileSync(path.join(root, 'assets/tactical-lab-v11.html'), 'utf8');
const registry = source.slice(source.indexOf('const SHIP_SPRITE_CODES=['), source.indexOf('const MARS_BATTLE_BG='));
const draw = source.slice(source.indexOf('function drawShipSprite(ctx,s){'), source.indexOf('// Display-only hull scale.'));
const refresh = source.slice(source.indexOf('function refreshRegistryShip(code){'), source.indexOf('function renderRegistry(){'));
assert.ok(registry && draw && refresh, 'Actual registry, draw and preview refresh functions are extracted');
const requests = [], trims = [], refreshed = [];
let registryVisible = true, matchingCanvas = true;
const canvas = {};
const panel = {classList: {contains: name => name === 'on' && registryVisible}};
const grid = {scrollTop: 83, querySelector: () => matchingCanvas ? canvas : null};
class FakeImage {
  set src(value) { this.url = value; requests.push(this); }
}
const window = {parent: {ASSET_VER: 'test-version'}};
const context = {
  window, Image: FakeImage, SHIPS: {},
  document: {getElementById: id => id === 'panel-registry' ? panel : id === 'ship-grid' ? grid : null},
  drawRegistryShip(target, ship) { refreshed.push({target, code: ship.code}); },
  trimShipSprite(image) { trims.push(image); return {width: 320, height: 320}; }
};
vm.runInNewContext(registry + '\nfunction hasShipSpriteAsset(code){return SHIP_SPRITE_CODES.includes(code);}\n' + draw + '\n' + refresh
  + '\nthis.api={codes:SHIP_SPRITE_CODES,status:SHIP_SPRITE_STATUS,sprites:SHIP_SPRITES,loadShipSprite,drawShipSprite};', context);
const api = context.api;
const assembled = ['pilgrim_voltaris','pilgrim_ignis','pilgrim_glacius','pilgrim_umbra','pilgrim_aurum','pilgrim_tempest',
  'alien_devourer','alien_hive','alien_leviathan','alien_voidmaw'];
const files = fs.readdirSync(path.join(root, 'assets/ships/top')).filter(file => file.endsWith('.png')).map(file => file.slice(0, -4)).sort();
assert.equal(api.codes.length, 32);
assert.deepEqual(Array.from(api.codes).sort(), files, 'Every actual top sprite is registered, with no missing path');
assert.equal(requests.length, 22, 'Only standard hulls preload');
assert.ok(requests.every(image => !assembled.some(code => image.url.includes('/' + code + '.png'))));
assert.ok(requests.every(image => image.url.endsWith('?v=test-version')), 'Preserve parent cache version');
const ctx = {save(){}, restore(){}, rotate(){}, drawImage(){this.draws++;}, draws:0};
for (const code of assembled) {
  context.SHIPS[code] = {code};
  assert.equal(api.drawShipSprite(ctx, {code, size:'assembled'}), false, code + ': fallback while pending');
  const image = requests[requests.length - 1];
  assert.equal(image.url, 'ships/top/' + code + '.png?v=test-version');
  assert.equal(image.decoding, 'async');
  assert.equal(api.status[code], 'loading');
  const count = requests.length;
  api.drawShipSprite(ctx, {code, size:'assembled'});
  api.loadShipSprite(code);
  assert.equal(requests.length, count, code + ': request once while loading');
  if (code === 'alien_voidmaw') {
    image.onerror();
    assert.equal(api.status[code], 'failed');
    assert.equal(api.drawShipSprite(ctx, {code, size:'assembled'}), false);
    assert.equal(requests.length, count, 'Failed images do not retry every frame');
  } else {
    registryVisible = code !== 'pilgrim_umbra';
    matchingCanvas = code !== 'pilgrim_aurum';
    const refreshCount = refreshed.length;
    image.onload();
    assert.equal(refreshed.length, refreshCount + (registryVisible && matchingCanvas ? 1 : 0), code + ': refresh only the visible matching preview');
    assert.equal(api.status[code], 'ready');
    assert.equal(api.drawShipSprite(ctx, {code, size:'assembled'}), true, code + ': draw after image loads');
    assert.equal(requests.length, count, code + ': ready image is reused');
  }
}
assert.equal(requests.length, 32, 'All ten assembled units load on demand');
assert.equal(trims.length, 9, 'Successful loads keep existing sprite trimming');
assert.equal(ctx.draws, 9);
assert.equal(refreshed.length, 7, 'Hidden registry and different faction canvases do not repaint');
assert.ok(refreshed.every(entry => entry.target === canvas));
assert.equal(grid.scrollTop, 83, 'Preview refresh retains scroll and DOM');
assert.ok(source.includes('drawRegistryShip(canvas,s);'), 'Initial registry draw uses the same canvas painter');
for (const code of ['unknown_ship','../escape','toString']) {
  api.loadShipSprite(code);
  assert.equal(api.drawShipSprite(ctx, {code}), false);
}
assert.equal(requests.length, 32, 'Unknown codes cannot construct image paths');
console.log('PASS: 32 tracked sprites registered, 22 standard eager requests, ten assembled requests on first draw, load/ready/error reuse, cache version and trimming, visible matching registry repaint without DOM/scroll reset, hidden/filter exclusion, unknown path rejection.');
