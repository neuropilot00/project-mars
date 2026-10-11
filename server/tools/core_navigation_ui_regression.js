#!/usr/bin/env node
// Exercise mission intent entry, lazy legacy records and session isolation without DB.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.resolve(__dirname, '../../assets/core-navigation.js'), 'utf8');
const html = fs.readFileSync(path.resolve(__dirname, '../../index.html'), 'utf8');
function harness() {
  let token = 'user-a', lang = 'en', router;
  const calls = [], loads = [], opened = [];
  const elements = {};
  for (const id of ['coreMissionState', 'basePane_mission', 'coreRewardRecords', 'coreLegacyCommunity']) elements[id] = {innerHTML: '', open: false, events: {}, classList: {contains: () => true}, addEventListener(name, fn) {this.events[name] = fn;}};
  const label = {dataset: {coreEn: 'OPERATIONS', coreKo: '작전'}, textContent: ''};
  const window = {walletState: {address: 'WALLET-A'}};
  for (const name of ['checkDailyLogin', 'renderInlineCheckin', 'loadDailyMissions', 'loadAchievements', 'loadWeeklyChallenges']) window[name] = () => loads.push(name);
  const document = {readyState: 'complete', documentElement: {}, getElementById: id => elements[id], querySelectorAll: () => [label]};
  const response = (value, ok = true) => ({ok, json: async () => value});
  const state = {success: true, currentMissionId: 'move_yield', missions: [{id:'first_sortie',status:'claimed'}, {id:'secure_node',status:'claimed'}, {id:'move_yield', status:'active', objectives:[{key:'production_collected',current:1,target:1}, {key:'cargo_arrived',current:0,target:1}]}]};
  const context = {window, document, localStorage: {getItem: () => token}, tl: (en, ko) => lang === 'ko' ? ko : en,
    getAuthHeaders: () => ({Authorization:'Bearer ' + token}), loadQuests: w => loads.push('quests:' + w),
    _scheduleQuestAuxLoads: () => loads.push('community'), _cancelQuestAuxLoads: () => loads.push('cancel-community'),
    closeCommandCenter: () => opened.push('close-command'), openBaseModal: () => opened.push('base'), switchBaseTab: t => opened.push(t),
    fetch: async (url, options) => {calls.push({url,options});return router ? router() : response(state);}, console};
  vm.createContext(context); vm.runInContext(source, context);
  return {window, elements, calls, loads, opened, label, state, response, set token(v) {token=v;}, set lang(v) {lang=v;}, set router(v) {router=v;}};
}
async function main() {
  let h = harness(); assert.equal(h.window._lastBaseCat, 'mission'); assert.equal(h.calls.length, 0); assert.deepEqual(h.loads, []);
  await h.window.loadCoreMission();
  assert.equal(h.calls[0].url, '/api/starter-ops/state'); assert.equal(h.calls[0].options.headers.Authorization, 'Bearer user-a');
  assert.ok(h.elements.coreMissionState.innerHTML.includes('Escort the yield')); assert.ok(h.elements.coreMissionState.innerHTML.includes('2 / 5')); assert.ok(h.elements.coreMissionState.innerHTML.includes('1 / 1')); assert.ok(h.elements.coreMissionState.innerHTML.includes('0 / 1'));
  assert.ok(h.elements.coreMissionState.innerHTML.includes("openCommandCenter('missions')")); assert.equal(h.calls.length, 1); assert.deepEqual(h.loads, []);
  h.lang='ko'; h.window.refreshCoreLabels(); assert.equal(h.label.textContent, '작전'); assert.ok(h.elements.coreMissionState.innerHTML.includes('화물 호위')); assert.ok(h.elements.coreMissionState.innerHTML.includes('작전 이어가기'));
  h.state.missions[2].status='completed'; await h.window.loadCoreMission(); assert.ok(h.elements.coreMissionState.innerHTML.includes('작전 보상 수령'));
  h.window.loadCoreRecords(); assert.deepEqual(h.loads, []);
  h.elements.coreRewardRecords.open=true; h.elements.coreRewardRecords.events.toggle(); assert.ok(h.loads.includes('quests:WALLET-A')); assert.ok(h.loads.includes('loadWeeklyChallenges')); assert.ok(!h.loads.includes('community'));
  h.elements.coreLegacyCommunity.open=true; h.elements.coreLegacyCommunity.events.toggle(); assert.ok(h.loads.includes('community')); h.elements.coreLegacyCommunity.open=false; h.elements.coreLegacyCommunity.events.toggle(); assert.ok(h.loads.includes('cancel-community'));
  h.window.openGuildLounge(); assert.deepEqual(h.opened, ['close-command', 'base', 'guild']);
  h = harness();h.token=null;await h.window.loadCoreMission();assert.equal(h.calls.length,0);assert.ok(h.elements.coreMissionState.innerHTML.includes('Sign in'));
  h=harness();let release;h.router=()=>new Promise(resolve=>{release=()=>resolve(h.response(h.state));}); const pending=h.window.loadCoreMission();h.token='user-b';h.window.walletState.address='WALLET-B';release();await pending;assert.ok(!h.elements.coreMissionState.innerHTML.includes('Escort the yield'), 'Do not paint previous identity progress');
  h=harness();h.router=()=>h.response({error:'UNAUTHORIZED'},false);await h.window.loadCoreMission();assert.ok(h.elements.coreMissionState.innerHTML.includes('Retry'));assert.ok(!h.elements.coreMissionState.innerHTML.includes('Reward ready'));
  h=harness();h.state.currentMissionId=null;h.state.missions=['first_sortie','secure_node','move_yield','restore_fleet','hold_front'].map(id=>({id,status:'claimed'}));await h.window.loadCoreMission();assert.ok(h.elements.coreMissionState.innerHTML.includes('Five starting operations completed'));
  const mission = html.slice(html.indexOf('id="basePane_mission"'), html.indexOf('id="basePane_quests"'));
  const campaign = html.slice(html.indexOf('id="basePane_quests"'), html.indexOf('id="basePane_records"'));
  const records = html.slice(html.indexOf('id="basePane_records"'), html.indexOf('<!-- TAB: PVP -->'));
  assert.ok(!mission.includes('dailyCheckinInline')); assert.ok(campaign.includes('campaignPanel')); assert.ok(campaign.includes('bannerQuests')); assert.ok(!campaign.includes('questsContainer'));assert.ok(!campaign.includes('dailyCheckinInline'));
  for (const id of ['dailyCheckinInline','dailyMissionsPanel','questsContainer','achievementsSection','weeklyChallengesContainer','bountyBoardSection']) assert.ok(records.includes('id="' + id + '"'), 'Keep existing claim/load targets: '+id);
  assert.ok(html.includes('class="mob-nav-item mn-cantina" onclick="openGuildLounge()"'));assert.ok(html.includes('class="col-fab arena"  onclick="openGuildLounge()"'));
  assert.ok(records.includes('data-action="openArena"'), 'Keep settlement entry available');
  for(const id of ['cratesQuickBtn','campaignQuickBtn'])assert.ok(html.includes('id="'+id+'" hidden'));
  console.log('PASS core navigation VM: server-authenticated goal/progress, ko/en labels, reward continuation, logout stale isolation, all-complete/error states, lazy rewards/community, painted Cantina guild entry and legacy settlement access.');
}
main().catch(error => {console.error(error);process.exitCode=1;});
