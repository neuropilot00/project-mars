'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { gunzipSync } = require('node:zlib');
const { encodeBattleFrame, MAX_DECODED_FRAME_BYTES } = require('../utils/battleFrameWire');

test('large frame compression is lossless and has a bounded length marker', () => {
  const frame = { t: 1234, realtime: true, ships: Array.from({ length: 600 }, (_, n) => ({
    id: String(9000000000000000000n + BigInt(n)), fid: '3', x: n / 10, y: 25,
    hp: n * 23, shield_hp: n, code: 'fsp_crs', label: '함선'
  })), combat_salvos: [{ count: 1900, side: 'atk', fire_type: 'laser' }] };
  const { raw, compressed } = encodeBattleFrame('123', frame, true);
  assert.ok(compressed);
  const envelope = JSON.parse(compressed);
  assert.equal(envelope.type, 'frame_gzip_v1');
  const bytes = gunzipSync(Buffer.from(envelope.data, 'base64'));
  assert.equal(bytes.length, envelope.bytes);
  assert.deepEqual(JSON.parse(bytes.toString('utf8')), JSON.parse(raw));
  assert.ok(Buffer.byteLength(compressed) < Buffer.byteLength(raw));
});

test('unnegotiated, small and oversized frames retain the old JSON protocol', () => {
  const small = { t: 1, ships: [] };
  assert.equal(encodeBattleFrame('1', small, false).compressed, null);
  assert.equal(encodeBattleFrame('1', small, true).compressed, null);
  const huge = { t: 2, body: 'x'.repeat(MAX_DECODED_FRAME_BYTES) };
  assert.equal(encodeBattleFrame('1', huge, true).compressed, null);
});
