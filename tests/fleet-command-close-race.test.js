'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../assets/fleet-command-modal.js'), 'utf8');
function extract(start, end) {
  const a = source.indexOf(start), b = source.indexOf(end, a);
  assert.ok(a >= 0 && b > a);
  return source.slice(a, b);
}
function fixture() {
  const classes = new Set(['active']), frames = [];
  const modal = { classList: { contains: x => classes.has(x), add: x => classes.add(x), remove: x => classes.delete(x) } };
  const body = { scrollTop: 125 };
  let resolve, reject;
  const pending = new Promise((yes, no) => { resolve = yes; reject = no; });
  const context = {
    document: { getElementById: () => modal, querySelector: () => body },
    requestAnimationFrame: fn => frames.push(fn),
    fleetCmdState: { selectedFleetId: 7, selectedFleet: { id: 7, formation: 'sphere' }, formations: [], movements: [] },
    fetch: () => pending, getAuthHeaders: () => ({}), LANG: 'ko',
    renderFleetDetail() {}, renderFleetList() {}, updateFleetListSnapshotFromSelected() {},
    showFactionToast() {}, fleetCmdErrorMessage: x => x, t: () => '', tl: en => en
  };
  vm.createContext(context);
  vm.runInContext(extract('function closeFleetCmd()', 'async function loadFleetOptions(') + '\n' +
    extract('async function setFleetTactic(', 'function setFleetFormation('), context);
  return { context, body, frames, active: () => classes.has('active'),
    finish(outcome) { if (outcome === 'network') reject(Error('offline')); else resolve({ ok: outcome === 'success', json: async () => ({ error: 'REJECTED' }) }); },
    flushFrames() { while (frames.length) frames.shift()(); } };
}
for (const outcome of ['success', 'rejected', 'network']) {
  test('closing fleet editor while tactic save is pending stays closed after ' + outcome, async () => {
    const f = fixture();
    const saving = f.context.setFleetTactic('formation', 'screen');
    f.context.closeFleetCmd();
    f.finish(outcome); await saving; f.flushFrames();
    assert.equal(f.active(), false, 'late save completion must respect explicit close');
  });
}
test('an open editor retains its scroll after saving', async () => {
  const f = fixture();
  const saving = f.context.setFleetTactic('formation', 'screen');
  f.body.scrollTop = 0;
  f.finish('success'); await saving; f.flushFrames();
  assert.equal(f.active(), true);
  assert.equal(f.body.scrollTop, 125);
});
test('a scheduled scroll restore does not run after closing the editor', () => {
  const f = fixture();
  f.context.keepFleetCmdOpen(125); f.context.closeFleetCmd();
  f.body.scrollTop = 0; f.flushFrames();
  assert.equal(f.active(), false);
  assert.equal(f.body.scrollTop, 0);
});
