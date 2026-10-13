#!/usr/bin/env node
'use strict';
// Validate actual rendered source windows, including the uneven cosmetic sheet.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '../..');
const context = {window: {}, document: {addEventListener() {}}};
vm.runInNewContext(fs.readFileSync(path.join(root, 'assets/item-art.js'), 'utf8'), context);
const art = context.window.ItemArt;
const crops = new Map();
for (const code of art.codes) {
  const item = art.resolve(code);
  assert.ok(fs.existsSync(path.join(root, item.path)), code + ': source exists');
  const html = art.render(code, {size: 88});
  assert.ok(html.includes('data-item-code="' + code + '"'), code);
  if (!item.atlas) continue;
  const boxes = [...html.matchAll(/viewBox="([\d.]+) ([\d.]+) ([\d.]+) ([\d.]+)"/g)].map(m => m.slice(1).map(Number));
  assert.equal(boxes.length, 2, code + ': isolate before fitting');
  const [x, y, w, h] = boxes[1];
  assert.ok(w > 0 && h > 0 && x >= 0 && y >= 0 && x + w <= 1254 && y + h <= 1254, code + ': source bounds');
  assert.ok(html.includes('preserveAspectRatio="xMidYMid meet"'), code + ': non-square slots preserve proportions');
  assert.ok(html.includes('overflow="hidden"'), code + ': neighbouring cells clipped');
  const previous = crops.get(item.path) || [];
  for (const box of previous) {
    assert.ok(x + w <= box.x || box.x + box.w <= x || y + h <= box.y || box.y + box.h <= y, code + ': no overlapping source cells');
  }
  previous.push({x, y, w, h}); crops.set(item.path, previous);
  if (item.atlas === 'd') {
    const rows = [0,302,580,858,1196], columns = [0,314,628,942,1254];
    assert.deepEqual(boxes[1], [columns[item.column], rows[item.row], columns[item.column+1]-columns[item.column], rows[item.row+1]-rows[item.row]], code + ': measured cosmetic crop retained');
  }
}
assert.equal([...crops.values()].reduce((n, a) => n + a.length, 0), 64);
assert.equal(art.resolve('mat_iron_ore').packQuantity, 5);
assert.ok(art.render('unknown').includes('item-art-neutral'));
assert.ok(!art.render('unknown', {name:'<script>bad</script>'}).includes('<script>'));
console.log('PASS: ' + art.codes.length + ' item codes, 64 non-overlapping bounded atlas windows, measured cosmetic crops, aspect-preserving SVG, pack aliases and neutral fallback.');
