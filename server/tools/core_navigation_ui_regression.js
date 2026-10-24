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
  for (const id of ['coreMissionState', 'coreMissionJournal', 'coreActivityGuide', 'baseModal', 'basePane_mission', 'coreRewardRecords', 'coreLegacyCommunity']) elements[id] = {innerHTML: '', open: false, events: {}, classList: {contains: () => true}, addEventListener(name, fn) {this.events[name] = fn;}};
  const label = {dataset: {coreEn: 'OPERATIONS', coreKo: '작전'}, textContent: ''};
  const window = {walletState: {address: 'WALLET-A'}};
  for (const name of ['checkDailyLogin', 'renderInlineCheckin', 'loadDailyMissions', 'loadAchievements', 'loadWeeklyChallenges']) window[name] = () => loads.push(name);
  const document = {readyState: 'complete', documentElement: {}, getElementById: id => elements[id], querySelectorAll: selector => selector === '[data-core-en]' ? [label] : [], querySelector: () => ({dataset:{view:'crafting'}})};
  const response = (value, ok = true) => ({ok, json: async () => value});
  const state = {success: true, currentMissionId: 'move_yield', missions: [{id:'first_sortie',status:'claimed'}, {id:'secure_node',status:'claimed'}, {id:'move_yield', status:'active', objectives:[{key:'production_collected',current:1,target:1}, {key:'cargo_arrived',current:0,target:1}]},{id:'restore_fleet',status:'locked'},{id:'hold_front',status:'locked'}]};
  for(const name of ['openShipyard','openObjectiveOperations','openTacticalLab','openAiFight'])window[name]=()=>opened.push(name);
  const context = {window, document, localStorage: {getItem: () => token}, tl: (en, ko) => lang === 'ko' ? ko : en,
    getAuthHeaders: () => ({Authorization:'Bearer ' + token}), loadQuests: w => loads.push('quests:' + w),
    _scheduleQuestAuxLoads: () => loads.push('community'), _cancelQuestAuxLoads: () => loads.push('cancel-community'),
    closeCommandCenter: () => opened.push('close-command'), openBaseModal: () => opened.push('base'), switchBaseTab: t => opened.push(t), openCommandCenter: t => opened.push('command:'+t), closeBaseModal: () => opened.push('close-base'), loadBaseInventory: () => opened.push('load-inventory'), loadBaseShopItems: () => opened.push('load-shop'), loadMarketTab: () => opened.push('load-market'), switchBaseShopView: (v,el) => {assert.ok(el);opened.push('shop:'+v);},
    fetch: async (url, options) => {calls.push({url,options});return router ? router() : response(state);}, console};
  vm.createContext(context); vm.runInContext(source, context);
  return {window, context, elements, calls, loads, opened, label, state, response, set token(v) {token=v;}, set lang(v) {lang=v;}, set router(v) {router=v;}};
}
async function main() {
  let h = harness(); assert.equal(h.window._lastBaseCat, 'mission'); assert.equal(h.calls.length, 0); assert.deepEqual(h.loads, []);
  await h.window.loadCoreMission();
  assert.equal(h.calls[0].url, '/api/starter-ops/state'); assert.equal(h.calls[0].options.headers.Authorization, 'Bearer user-a');
  assert.ok(h.elements.coreMissionState.innerHTML.includes('Escort the yield')); assert.ok(h.elements.coreMissionState.innerHTML.includes('2 / 5')); assert.ok(h.elements.coreMissionState.innerHTML.includes('1 / 1')); assert.ok(h.elements.coreMissionState.innerHTML.includes('0 / 1'));
  assert.ok(h.elements.coreMissionState.innerHTML.includes('data-core-route="front"')); assert.ok(!h.elements.coreMissionState.innerHTML.includes('onclick')); assert.ok(h.elements.coreMissionJournal.innerHTML.includes('data-mission="move_yield" data-current="true"')); assert.ok(h.elements.coreMissionJournal.innerHTML.includes('Claim the previous operation reward first.')); assert.ok(h.elements.coreMissionJournal.innerHTML.includes('repair depot')); assert.equal((h.elements.coreMissionJournal.innerHTML.match(/data-mission=/g)||[]).length,5); assert.equal(h.calls.length, 1); assert.deepEqual(h.loads, []);
  h.lang='ko'; h.window.refreshCoreLabels(); assert.equal(h.label.textContent, '작전'); assert.ok(h.elements.coreMissionState.innerHTML.includes('화물 호위')); assert.ok(h.elements.coreMissionState.innerHTML.includes('작전 이어가기'));
  h.state.missions[2].status='completed'; await h.window.loadCoreMission(); assert.ok(h.elements.coreMissionState.innerHTML.includes('작전 보상 수령'));
  h.window.loadCoreRecords(); assert.deepEqual(h.loads, []);
  h.elements.coreRewardRecords.open=true; h.elements.coreRewardRecords.events.toggle(); assert.ok(h.loads.includes('quests:WALLET-A')); assert.ok(h.loads.includes('loadWeeklyChallenges')); assert.ok(!h.loads.includes('community'));
  h.elements.coreLegacyCommunity.open=true; h.elements.coreLegacyCommunity.events.toggle(); assert.ok(h.loads.includes('community')); h.elements.coreLegacyCommunity.open=false; h.elements.coreLegacyCommunity.events.toggle(); assert.ok(h.loads.includes('cancel-community'));
  h.window.openGuildLounge(); assert.deepEqual(h.opened, ['close-command', 'base', 'guild']);
  h = harness();h.token=null;await h.window.loadCoreMission();assert.equal(h.calls.length,0);assert.ok(h.elements.coreMissionState.innerHTML.includes('Sign in'));
  h=harness();let release;h.router=()=>new Promise(resolve=>{release=()=>resolve(h.response(h.state));}); const pending=h.window.loadCoreMission();h.token='user-b';h.window.walletState.address='WALLET-B';release();await pending;assert.ok(!h.elements.coreMissionState.innerHTML.includes('Escort the yield'), 'Do not paint previous identity progress');
  h=harness();h.router=()=>h.response({error:'UNAUTHORIZED'},false);await h.window.loadCoreMission();assert.ok(h.elements.coreMissionState.innerHTML.includes('Retry'));assert.ok(!h.elements.coreMissionState.innerHTML.includes('Reward ready'));
  h=harness();h.state.currentMissionId=null;h.state.missions=['first_sortie','secure_node','move_yield','restore_fleet','hold_front'].map(id=>({id,status:'claimed'}));await h.window.loadCoreMission();assert.ok(h.elements.coreMissionState.innerHTML.includes('5 / 5')); assert.ok(h.elements.coreMissionState.innerHTML.includes('Your front is open'));assert.ok(h.elements.coreMissionState.innerHTML.includes('data-core-route="npc"'));assert.ok(h.elements.coreMissionState.innerHTML.includes('data-core-route="crafting"'));click('npc');assert.deepEqual(h.opened,['close-base','openAiFight']);assert.ok(h.elements.coreMissionState.innerHTML.includes('data-core-route="front"'));assert.doesNotMatch(h.elements.coreMissionJournal.innerHTML,/<details[^>]+ open[ >]/);
  // A reward ready in the same payload takes precedence over an available successor.
  h=harness();h.state.missions[1].status='completed';h.state.currentMissionId='move_yield';await h.window.loadCoreMission();
  assert.ok(h.elements.coreMissionState.innerHTML.includes('Secure the mine'));assert.ok(h.elements.coreMissionState.innerHTML.includes('Claim in operations'));
  assert.ok(h.elements.coreMissionState.innerHTML.includes('data-core-route="operations"'));
  // Invalid/partial state must never become a fabricated zero-progress journal.
  for(const invalid of [[],[{id:'untrusted',status:'active'}],Array(5).fill({id:'first_sortie',status:'active'})]){
    h=harness();h.state.missions=invalid;await h.window.loadCoreMission();assert.ok(h.elements.coreMissionState.innerHTML.includes('role="alert"'));assert.equal(h.elements.coreMissionJournal.innerHTML,'');
  }
  h=harness();h.state.missions[2].objectives[0].label='<img src=x onerror=alert(1)>';h.state.missions[2].objectives[0].key='unknown';
  await h.window.loadCoreMission();assert.ok(h.elements.coreMissionState.innerHTML.includes('&lt;img'));assert.ok(!h.elements.coreMissionState.innerHTML.includes('<img'));
  h=harness();let finish;h.router=()=>new Promise(resolve=>{finish=()=>resolve(h.response(h.state));});let pendingPane=h.window.loadCoreMission();h.elements.basePane_mission.classList.contains=()=>false;finish();await pendingPane;assert.ok(!h.elements.coreMissionState.innerHTML.includes('Escort the yield'));
  // Routes open destinations only; inventory, market and crafting also load their real data.
  h=harness();
  function click(route){const control={dataset:{coreRoute:route}};h.elements.baseModal.contains=el=>el===control;h.elements.baseModal.events.click({target:{closest:()=>control}});}
  click('npc');assert.deepEqual(h.opened,['command:missions']);h.opened.length=0;
  for(const route of ['front','operations','campaign','records','season','territory','sectors','mining','fleet','items','crafting','market','guild','govern','pvp','shipyard','objectives','practice','journal','untrusted'])click(route);
  assert.deepEqual(h.opened,['command:front','command:missions','quests','records','rank','territory','sectors','mining','fleet','items','load-inventory','shop','load-shop','shop:crafting','market','load-market','guild','govern','pvp','close-base','openShipyard','close-base','openObjectiveOperations','close-base','openTacticalLab','mission']);
  assert.equal(h.calls.length,0,'navigation never performs a reward/payment/combat POST');
  // Every new prose entry supplies all supported languages, with no missing cells.
  const copyStart=source.indexOf('  var copy = '),copyEnd=source.indexOf('  function translated(',copyStart);
  const dictionaries=vm.runInNewContext('(function(){'+source.slice(copyStart,copyEnd)+'return {copy,reasons};})()');
  for(const values of [...Object.values(dictionaries.copy),...Object.values(dictionaries.reasons).flat()]){assert.equal(values.length,7);assert.ok(values.every(v=>typeof v==='string'&&v.length>0));}
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
