#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const calls = [], messages = [], nodes = new Map();
function node(id) {
  if (!nodes.has(id)) nodes.set(id, { style: {}, value: '0', innerHTML: '', textContent: '', classList: { add() {}, remove() {}, toggle() {} }, prepend(child) { this.notice = child.textContent; } });
  return nodes.get(id);
}
const box = {
  console, Date, Math, Promise, LANG: 'en', walletState: { address: '0xisolated', connected: true }, emailAuth: { token: 'test' },
  document: { getElementById: node, createElement: () => ({ style: {} }), addEventListener() {}, body: { style: {} } },
  tl: en => en, t: key => key, showToast: text => messages.push(text), showAlert: text => messages.push(text),
  loadCampaignStatus() {}, getAuthHeaders: () => ({}), setBaseTabDot() {}, _updateBaseBtnDot() {},
  _guildReadJson: async () => ({ pads: [], missions: [] }), _setActiveInterval: () => 1,
  _setActiveTimeout: fn => fn(), _clearActiveTimeout() {}, requestRedraw() {},
  shopConfirm: () => { throw new Error('Retired sales must not request payment'); },
  fetch: async (url, options) => { calls.push({ url, options }); return { ok: true, json: async () => ({ mission: { type: 'exploration', reward: { pp: 0.5, ppAsGp: 50, currency: 'gp', gp: 10 } } }) }; },
};
box.window = box;
vm.createContext(box);
for (const file of ['quest-economy.js', 'wallet-minigame.js', 'guild-ops.js']) {
  vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../../assets/', file), 'utf8'), box, { filename: file });
}
async function main() {
  await box.getPOIHint(); await box.buyLootPriority(7); box.trackQuestAction('harvest', 999999);
  assert.equal(calls.length, 0); assert.ok(messages.some(m => m.includes('retired')));
  box.setOpsType('invasion');
  assert.equal(box._opsType, 'exploration'); assert.equal(node('opsTypeInvasion').hidden, true); assert.equal(node('opsTypeInvasion').disabled, true);
  box._opsType = 'invasion'; box.launchOpsMission(); assert.equal(calls.length, 0);
  box._opsMissions = [{ id: 1, type: 'invasion', readyToClaim: true, status: 'complete', startTime: new Date(), durationSec: 10, targetWallet: '0xtarget', distanceDeg: 1 }];
  box.renderOpsMissionList();
  assert.match(node('opsMissionList').innerHTML, /claimOpsMission\(1\)/); assert.doesNotMatch(node('opsMissionList').innerHTML, /playMissionMinigame|\(1x\)/);
  box.openMinigameOverlay(99); assert.match(node('mgWarInfo').textContent, /Practice only/);
  let continued = 0, stopped = 0;
  box._mgCurrentEngine = { getScore: () => 9999, continueGame() { continued++; }, stop() { stopped++; } };
  await box.payAndContinue(); assert.equal(continued, 1); assert.equal(calls.length, 0);
  await box.submitMinigameScore(); assert.equal(stopped, 1); assert.equal(calls.length, 0); assert.ok(messages.some(m => m.includes('Practice score: 9999')));
  box.playMissionMinigame(7, 'exploration'); assert.match(node('mgWarInfo').textContent, /reward does not change/);
  box._mgCurrentEngine = { getScore: () => 999999, stop() {} };
  box.loadOpsTab = () => {};
  await box.submitMinigameScore();
  assert.equal(calls.length, 1); assert.equal(calls[0].url, '/api/missions/7/claim');
  assert.equal(JSON.parse(calls[0].options.body).minigameScore, undefined);
  assert.ok(messages.some(m => m.includes('50.000 GP') && !m.includes('PP')));
  console.log(JSON.stringify({ passed: 5, groups: ['retired paid sales and legacy progress make no request', 'invasion UI switches to exploration before request', 'earned invasion reward still claimable without minigame gate', 'guild practice free and sends no war score', 'mission practice submits no score and displays GP conversion'], browserRendered: false, databaseUsed: false }));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
