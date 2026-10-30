'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { createVisualJournal } = require('../services/battleVisualJournal');

function shot(seq, side, weapon = 'laser') {
  return { type: 'shot_hit', seq, source_side: side, fire_type: weapon,
    from: { x: seq, y: 1 }, to: { x: seq + 1, y: 2 }, damage: 123, target_hp: 50 };
}

test('recovery groups actual missed fire from both sides without altering the source or creating damage', () => {
  const journal = createVisualJournal({ epoch: 'test', limit: 4 });
  const frame = { t: 5, realtime: true, ships: [{ id: 'ship', hp: 50 }],
    combat_events: [shot(3, 'atk'), shot(4, 'def')],
    combat_salvos: [{ source_side: 'atk', fire_type: 'laser', count: 8, first_seq: 1, last_seq: 2,
      samples: [{ seq: 1, from: { x: 1, y: 1 }, to: { x: 2, y: 2 } }, { seq: 2, from: { x: 2, y: 1 }, to: { x: 3, y: 2 } }] }] };
  const original = structuredClone(frame);
  const before = journal.push({ t: 0 });
  const initial = journal.push(frame);
  assert.equal(initial.epoch, 'test');
  assert.equal(initial.seq, 2);
  assert.equal(initial.totals['atk:laser'], 9);
  assert.match(initial.proof, /^[A-Za-z0-9_-]{43}$/);
  const result = journal.recover(before);
  assert.equal(result.incomplete, false);
  assert.deepEqual(result.frame.combat_events, []);
  assert.deepEqual(result.frame.combat_salvos, []);
  assert.deepEqual(frame, original);
  const atk = result.combat_salvos.find(s => s.source_side === 'atk');
  const def = result.combat_salvos.find(s => s.source_side === 'def');
  assert.equal(atk.count, 9);
  assert.equal(def.count, 1);
  assert.deepEqual(atk.samples.map(p => p.seq), [1, 3]);
  assert.equal('damage' in atk, false);
  assert.equal(result.frame.ships[0].hp, 50);
  assert.deepEqual(journal.recover(before).combat_salvos, result.combat_salvos);
  assert.deepEqual(journal.recover(initial).combat_salvos, []);
});

test('the bounded journal signals missing history and keeps a latest authoritative frame', () => {
  const journal = createVisualJournal({ epoch: 'test', limit: 2 });
  assert.equal(journal.recover({ epoch: 'test', seq: 0 }), null);
  const first = journal.push({ t: 5, ships: [{ hp: 99 }], combat_events: [shot(1, 'atk')] });
  for (let n = 2; n <= 4; n++) journal.push({ t: n * 5, ships: [{ hp: 100 - n }], combat_events: [shot(n, 'atk')] });
  const expired = journal.recover({ epoch: 'test', seq: 0 });
  assert.equal(expired.incomplete, true);
  assert.equal(expired.seq, 4);
  assert.equal(expired.frame.t, 20);
  assert.equal(expired.frame.ships[0].hp, 96);
  assert.equal(expired.combat_salvos[0].count, 1);
  const retained = journal.recover(first);
  assert.equal(retained.incomplete, false);
  assert.equal(retained.combat_salvos[0].count, 3);
  assert.equal(journal.recover({ epoch: 'different', seq: 0 }).incomplete, true);
  assert.equal(journal.recover(null).combat_salvos[0].count, 1);
  assert.equal(journal.recover({ epoch: 'test', seq: 100 }).incomplete, true);
});

test('digest is bounded by valid side and weapon category and ignores non-shot events', () => {
  const journal = createVisualJournal({ epoch: 'bound' });
  const before = journal.currentCursor();
  assert.equal(before.seq, 0);
  assert.match(before.proof, /^[A-Za-z0-9_-]{43}$/);
  const events = [];
  for (let i = 0; i < 10000; i++) events.push(shot(i + 1, i % 2 ? 'atk' : 'def', `unrecognized-${i}`));
  events.push({ type: 'repair', source_side: 'atk', fire_type: 'laser' }, shot(10001, 'invalid'));
  journal.push({ t: 5, combat_events: events });
  const result = journal.recover(before);
  assert.equal(result.combat_salvos.length, 2);
  assert.equal(result.combat_salvos.reduce((sum, salvo) => sum + salvo.count, 0), 10000);
  assert.ok(result.combat_salvos.every(salvo => salvo.fire_type === 'other' && salvo.samples.length <= 2));
  assert.equal(journal.currentCursor().seq, 1);
});

test('signed cumulative cursor preserves exact per-side totals after ring eviction without trusting client edits', () => {
  const journal = createVisualJournal({ epoch: 'long', limit: 2 });
  const cursor = journal.push({ t: 5, combat_events: [shot(1, 'atk'), shot(2, 'def')] });
  for (let n = 2; n <= 200; n++) journal.push({ t: n * 5, combat_events: [shot(n * 2 - 1, 'atk'), shot(n * 2, 'def')] });
  const result = journal.recover(cursor);
  assert.equal(result.incomplete, false);
  assert.equal(result.seq, 200);
  assert.equal(result.combat_salvos.find(s => s.source_side === 'atk').count, 199);
  assert.equal(result.combat_salvos.find(s => s.source_side === 'def').count, 199);
  assert.ok(result.combat_salvos.every(s => s.samples.length === 1 && s.first_seq_is_lower_bound === true));
  assert.deepEqual(journal.recover(result.cursor).combat_salvos, []);
  const forged = structuredClone(cursor);
  forged.totals['atk:laser'] = 0;
  const rejected = journal.recover(forged);
  assert.equal(rejected.incomplete, true);
  assert.equal(rejected.combat_salvos.find(s => s.source_side === 'atk').count, 1);
  const badProof = { ...cursor, proof: cursor.proof.slice(0, -1) + (cursor.proof.endsWith('A') ? 'B' : 'A') };
  assert.equal(journal.recover(badProof).incomplete, true);
  const unsigned = journal.recover({ epoch: cursor.epoch, seq: cursor.seq });
  assert.equal(unsigned.incomplete, true);
  assert.equal(unsigned.combat_salvos.find(s => s.source_side === 'atk').count, 1);
  assert.equal(journal.recover(JSON.parse(JSON.stringify(cursor))).incomplete, false);
  const otherRealm = vm.runInNewContext(`JSON.parse(${JSON.stringify(JSON.stringify(cursor))})`);
  assert.equal(journal.recover(otherRealm).incomplete, false);
  const malformed = [
    { ...cursor, seq: -1 }, { ...cursor, seq: 999999 }, { ...cursor, lastCombatSeq: -1 },
    { ...cursor, totals: null }, { ...cursor, totals: [] }, { ...cursor, totals: { 'atk:laser': -1 } },
    { ...cursor, totals: { ['atk:' + 'x'.repeat(4000)]: 1 } },
    { ...cursor, totals: Object.fromEntries(Array.from({ length: 100 }, (_, i) => [`atk:extra_${i}`, i])) },
    { ...cursor, totals: Object.assign(Object.create({ inherited: 1 }), cursor.totals) },
    { ...cursor, extra: 'x'.repeat(5000) }, { ...cursor, proof: 'not-a-proof' },
  ];
  for (const bad of malformed) {
    const safe = journal.recover(bad);
    assert.equal(safe.incomplete, true);
    assert.equal(safe.combat_salvos.find(s => s.source_side === 'atk').count, 1);
  }
});
