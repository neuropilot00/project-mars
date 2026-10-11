/* Core mission entry uses server progress; optional legacy systems load on request. */
(function () {
  'use strict';
  var request = 0, lastState = null, lastIdentity = '';
  var missions = {
    first_sortie: ['Landing defense', '착륙 방어'],
    secure_node: ['Secure the mine', '광산 확보'],
    move_yield: ['Escort the yield', '화물 호위'],
    restore_fleet: ['Restore the fleet', '전력 복구'],
    hold_front: ['Hold the front', '전선 개방']
  };
  var objectives = {
    battle_won: ['Win a fleet battle', '실제 함대전 승리'],
    node_captured: ['Capture the resource node', '자원 거점 점령'],
    production_collected: ['Collect node production', '거점 생산 인수'],
    cargo_arrived: ['Deliver the cargo', '화물 도착'],
    fleet_ready: ['Repair or inspect the fleet', '전력 정비 또는 점검'],
    node_defended: ['Save the defense formation', '방어 편성 저장']
  };
  function label(en, ko) { return typeof tl === 'function' ? tl(en, ko, en, en, en, en, en) : en; }
  function identity() {
    var wallet = window.walletState && window.walletState.address || '';
    return String(wallet).toLowerCase() + '|' + (localStorage.getItem('pw_token') || '');
  }
  function escape(value) { return String(value == null ? '' : value).replace(/[&<>"']/g, function (c) { return {'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]; }); }
  function operationButton(en, ko) { return '<button type="button" class="core-primary" onclick="openCommandCenter(\'missions\')">' + label(en, ko) + '</button>'; }
  function render(state) {
    var body = document.getElementById('coreMissionState');
    if (!body) return;
    var rows = state && state.missions || [];
    var current = rows.find(function (m) { return m.id === state.currentMissionId; }) || rows.find(function (m) { return m.status === 'completed' || m.status === 'active' || m.status === 'available'; });
    var claimed = rows.filter(function (m) { return m.status === 'claimed'; }).length;
    if (!current && rows.length && claimed === rows.length) {
      body.innerHTML = '<h2>' + label('Your front is open', '전선이 열렸습니다') + '</h2><p>' + label('Five starting operations completed. Choose a production node or your next battle below.', '시작 작전 5개 완료. 아래에서 생산 거점이나 다음 전투를 선택하세요.') + '</p>' + operationButton('View operation records', '작전 기록 보기');
      return;
    }
    if (!current || !missions[current.id]) throw Error('INVALID_MISSION_STATE');
    var title = missions[current.id];
    var status = current.status === 'completed' ? label('Reward ready', '보상 수령 가능') : current.status === 'active' ? label('In progress', '진행 중') : label('Ready to start', '시작 가능');
    var progress = (current.objectives || []).map(function (o) {
      var names = objectives[o.key] || [o.label || o.key, o.label || o.key];
      var target = Math.max(1, Number(o.target) || 1), count = Math.min(target, Math.max(0, Number(o.current) || 0));
      return '<li><span>' + escape(label(names[0], names[1])) + '</span><b>' + count + ' / ' + target + '</b></li>';
    }).join('');
    body.innerHTML = '<div class="core-mission-meta">' + claimed + ' / 5 · ' + status + '</div><h2>' + label(title[0], title[1]) + '</h2><ul class="core-objectives">' + progress + '</ul>' + operationButton(current.status === 'completed' ? 'Claim in operations' : current.status === 'active' ? 'Continue operation' : 'Start operation', current.status === 'completed' ? '작전 보상 수령' : current.status === 'active' ? '작전 이어가기' : '작전 시작');
  }
  window.refreshCoreLabels = function () {
    document.querySelectorAll('[data-core-en]').forEach(function (el) { el.textContent = label(el.dataset.coreEn, el.dataset.coreKo); });
    if (lastState && lastIdentity === identity()) { try { render(lastState); } catch (_) {} }
  };
  window.loadCoreMission = async function () {
    var body = document.getElementById('coreMissionState');
    if (!body) return;
    var at = ++request, owner = identity(); lastState = null;
    window.refreshCoreLabels();
    if (!localStorage.getItem('pw_token')) {
      body.innerHTML = '<h2>' + label('Your first fleet awaits', '첫 함대가 기다립니다') + '</h2><p>' + label('Sign in to start five operations with a free starting fleet.', '로그인하고 무료 시작 함대로 5개 작전을 진행하세요.') + '</p>' + operationButton('Sign in · first operation', '로그인·첫 작전');
      return;
    }
    body.innerHTML = '<p role="status">' + label('Loading your next objective…', '다음 목표를 불러오는 중…') + '</p>';
    try {
      var response = await fetch('/api/starter-ops/state', {headers: getAuthHeaders(), cache: 'no-store'});
      var data = await response.json();
      if (at !== request || owner !== identity()) return;
      var pane = document.getElementById('basePane_mission');
      if (!pane || !pane.classList.contains('active')) return;
      if (!response.ok || data.error || data.success === false) throw Error(data.error || 'REQUEST_FAILED');
      render(data); lastState = data; lastIdentity = owner;
    } catch (error) {
      if (at !== request || owner !== identity()) return;
      body.innerHTML = '<p role="alert">' + label('Could not load your operation. Retry or open operations.', '작전 정보를 불러오지 못했습니다. 다시 조회하거나 작전 화면을 여세요.') + '</p><div class="core-record-links"><button type="button" onclick="loadCoreMission()">' + label('Retry', '다시 조회') + '</button>' + operationButton('Open operations', '작전 열기') + '</div>';
    }
  };
  function loadRewards() {
    var wallet = window.walletState && window.walletState.address;
    if (wallet && typeof loadQuests === 'function') loadQuests(wallet);
    ['checkDailyLogin', 'renderInlineCheckin', 'loadDailyMissions', 'loadAchievements', 'loadWeeklyChallenges'].forEach(function (name) {
      if (typeof window[name] === 'function') { try { window[name](); } catch (_) {} }
    });
  }
  window.loadCoreRecords = function () {
    var rewards = document.getElementById('coreRewardRecords'), social = document.getElementById('coreLegacyCommunity');
    if (rewards && rewards.open) loadRewards();
    if (social && social.open && typeof _scheduleQuestAuxLoads === 'function') _scheduleQuestAuxLoads();
  };
  window.openGuildLounge = function () {
    if (typeof closeCommandCenter === 'function') closeCommandCenter();
    openBaseModal(); switchBaseTab('guild');
  };
  function init() {
    window._lastBaseCat = 'mission';
    window.refreshCoreLabels();
    var rewards = document.getElementById('coreRewardRecords'), social = document.getElementById('coreLegacyCommunity');
    if (rewards) rewards.addEventListener('toggle', function () { if (rewards.open) loadRewards(); });
    if (social) social.addEventListener('toggle', function () { if (social.open) _scheduleQuestAuxLoads(); else _cancelQuestAuxLoads(); });
    // Existing locale changes update document.lang; avoid wrapping shared setLang.
    if (typeof MutationObserver !== 'undefined') new MutationObserver(window.refreshCoreLabels).observe(document.documentElement, {attributes:true, attributeFilter:['lang']});
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
}());
