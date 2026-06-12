// ═════ A-1: Faction System ═════

var factionState = {
  list: [],
  current: null,   // 내 현재 파벌
  selected: null,  // 모달에서 선택된 파벌
  stats: [],       // 파벌별 점유율/인원 통계
};

async function loadFactions() {
  try {
    var listRes = await fetch('/api/factions');
    var listData = await listRes.json();
    factionState.list = listData.factions || [];
    try {
      var statsRes = await fetch('/api/factions/stats');
      var statsData = await statsRes.json();
      factionState.stats = statsData.stats || [];
    } catch(_e) { factionState.stats = []; }
    if (_factionIsLoggedIn()) {
      var myRes = await fetch('/api/factions/mine', { headers: _factionAuthHeaders() });
      var myData = await myRes.json();
      factionState.current = myData.faction;
      _updateFactionBadge();
    }
  } catch(err) { console.warn('[Faction] loadFactions error:', err); }
}

function openFactionModal() {
  if (!_factionIsLoggedIn()) { showFactionToast(t('daily_login_required')||tl('Login required','로그인이 필요합니다','ログインが必要です','请先登录'),'error'); return; }
  var modal = document.getElementById('factionModal');
  var cardsEl = document.getElementById('factionCards');
  var subtitle = document.getElementById('factionModalSubtitle');
  var warning = document.getElementById('factionWarning');
  subtitle.textContent = factionState.current ? '// 파벌을 변경하시겠습니까?' : '// 파벌을 선택하세요';
  if (factionState.current && factionState.current.is_locked) {
    var hoursLeft = Math.ceil((new Date(factionState.current.can_change_at) - new Date()) / 3600000);
    warning.style.display = 'block';
    warning.innerHTML = '⏱ ' + (LANG==='ko'?'파벌 변경 쿨다운 중':LANG==='ja'?'派閥変更クールダウン中':LANG==='zh'?'派系变更冷却中':'Faction change cooldown') + '<br>' + hoursLeft + (LANG==='ko'?'시간 후 변경 가능':LANG==='ja'?'時間後に変更可能':LANG==='zh'?'小时后可变更':' hrs until available');
  } else if (factionState.current) {
    warning.style.display = 'block';
    warning.innerHTML = '⚠ 파벌 변경 시 <b>500 GP</b>가 소모됩니다.<br>변경 후 7일간 재변경이 불가능합니다.';
  } else {
    warning.style.display = 'none';
  }
  // 파벌별 점유율 계산 (밸런스 유도 — 인원 적은 파벌이 보이게)
  var _statMap = {};
  (factionState.stats || []).forEach(function(s){ _statMap[s.code] = s; });
  var _totalPlayers = (factionState.stats || []).reduce(function(a, s){ return a + (parseInt(s.player_count)||0); }, 0);
  var _minShare = null;
  (factionState.stats || []).forEach(function(s){
    var pc = parseInt(s.player_count)||0;
    if (_minShare === null || pc < _minShare.pc) _minShare = { code: s.code, pc: pc };
  });
  cardsEl.innerHTML = factionState.list.map(function(f) {
    var isCurrent = factionState.current && factionState.current.code === f.code;
    var st = _statMap[f.code] || {};
    var playerCount = parseInt(st.player_count) || 0;
    var shipsAlive = parseInt(st.ships_alive) || 0;
    var sharePct = _totalPlayers > 0 ? Math.round((playerCount / _totalPlayers) * 100) : 0;
    var isUnderdog = _minShare && _minShare.code === f.code && _totalPlayers > 0 && (factionState.stats||[]).length > 1;
    var balLabel = tl('Players','인원','人員','人数');
    var fleetLabel = tl('Fleet','함대','艦隊','舰队');
    var underdogTxt = tl('Needs you','합류 추천','参加推奨','建议加入');
    var statHtml = (factionState.stats && factionState.stats.length)
      ? '<div class="faction-balance">'
        + '<div class="faction-balance-bar"><div class="faction-balance-fill ' + f.code + '" style="width:' + sharePct + '%"></div></div>'
        + '<div class="faction-balance-meta">'
          + '<span>' + balLabel + ' <b>' + playerCount + '</b> · ' + sharePct + '%</span>'
          + '<span>' + fleetLabel + ' <b>' + shipsAlive + '</b></span>'
        + '</div>'
        + (isUnderdog ? '<div class="faction-balance-underdog">★ ' + underdogTxt + '</div>' : '')
      + '</div>'
      : '';
    return '<div class="faction-card ' + f.code + (isCurrent ? ' current' : '') + '" data-code="' + f.code + '" onclick="selectFaction(\'' + f.code + '\')">'
      + '<div class="faction-icon">' + (f.icon_emoji||'⬢') + '</div>'
      + '<div class="faction-name ' + f.code + '">' + f.name_ko + '</div>'
      + '<div class="faction-desc">' + (f.description_ko||'') + '</div>'
      + '<div class="faction-specialty">' + (f.specialty_ko||'') + '</div>'
      + '<div class="faction-stats"><span>공격<b>' + f.atk_multiplier + '</b></span><span>방어<b>' + f.def_multiplier + '</b></span><span>속도<b>' + f.spd_multiplier + '</b></span></div>'
      + statHtml
      + '</div>';
  }).join('');
  factionState.selected = null;
  document.getElementById('factionConfirmBtn').disabled = true;
  modal.classList.add('active');
}

function closeFactionModal() {
  document.getElementById('factionModal').classList.remove('active');
  factionState.selected = null;
}

function selectFaction(code) {
  if (factionState.current && factionState.current.code === code) return;
  if (factionState.current && factionState.current.is_locked) { showFactionToast(LANG==='ko'?'쿨다운 중입니다':LANG==='ja'?'クールダウン中です':LANG==='zh'?'冷却时间中':'Cooldown active','error'); return; }
  factionState.selected = code;
  document.querySelectorAll('.faction-card').forEach(function(el) {
    el.classList.remove('selected');
    if (el.dataset.code === code) el.classList.add('selected');
  });
  document.getElementById('factionConfirmBtn').disabled = false;
}

async function confirmFaction() {
  if (!factionState.selected) return;
  var btn = document.getElementById('factionConfirmBtn');
  btn.disabled = true; btn.textContent = LANG==='ko'?'처리 중...':LANG==='ja'?'処理中...':LANG==='zh'?'处理中...':'Processing...';
  try {
    var res = await fetch('/api/factions/choose', {
      method: 'POST',
      headers: Object.assign({'Content-Type':'application/json'}, _factionAuthHeaders()),
      body: JSON.stringify({ faction_code: factionState.selected })
    });
    var data = await res.json();
    if (!res.ok) {
      if (data.error === 'FACTION_CHANGE_COOLDOWN') {
        showFactionToast((LANG==='ko'?'쿨다운: ':LANG==='ja'?'クールダウン: ':LANG==='zh'?'冷却: ':'Cooldown: ') + Math.ceil((new Date(data.meta.can_change_at)-new Date())/3600000) + (LANG==='ko'?'시간 남음':LANG==='ja'?'時間後':LANG==='zh'?'小时后':' hrs left'), 'error');
      } else if (data.error === 'INSUFFICIENT_GP') {
        showFactionToast(tl('Not enough GP: need ' + data.meta.required + ' GP','GP 부족: ' + data.meta.required + ' GP 필요','GP不足: ' + data.meta.required + ' GP 必要','GP 不足：需要 ' + data.meta.required + ' GP'), 'error');
      } else if (data.error === 'SAME_FACTION') {
        showFactionToast(LANG==='ko'?'이미 같은 파벌입니다':LANG==='ja'?'すでに同じ派閥です':LANG==='zh'?'已在同一派系':'Already in same faction','error');
      } else {
        showFactionToast((LANG==='ko'?'선택 실패: ':LANG==='ja'?'選択失敗: ':LANG==='zh'?'选择失败: ':'Selection failed: ') + (data.error||'UNKNOWN'), 'error');
      }
      btn.disabled = false; btn.textContent = LANG==='ko'?'선택':LANG==='ja'?'選択':LANG==='zh'?'选择':'Select';
      return;
    }
    showFactionToast(data.is_first_choice ? (LANG==='ko'?'파벌 선택 완료':LANG==='ja'?'派閥選択完了':LANG==='zh'?'派系选择完成':'Faction selected') : (LANG==='ko'?'파벌 변경 완료 (-':LANG==='ja'?'派閥変更完了 (-':LANG==='zh'?'派系变更完成 (-':'Faction changed (-') + data.fee_paid + ' GP)', 'success');
    closeFactionModal();
    await loadFactions();
    // If user came from shipyard "파벌 선택하기" fallback, auto-reopen shipyard
    if (factionState.returnToShipyard) {
      factionState.returnToShipyard = false;
      setTimeout(function(){ if(typeof openShipyard==='function') openShipyard(); }, 250);
    }
  } catch(err) {
    console.error('[Faction] confirmFaction error:', err);
    showFactionToast(t('quests_network_error')||tl('Network error','네트워크 오류','ネットワークエラー','网络错误'),'error');
    btn.disabled = false; btn.textContent = LANG==='ko'?'선택':LANG==='ja'?'選択':LANG==='zh'?'选择':'Select';
  }
}

function _updateFactionBadge() {
  var badge = document.getElementById('factionBadge');
  if (!badge) return;
  if (factionState.current) {
    badge.textContent = factionState.current.name_ko;
    badge.style.color = factionState.current.color;
    badge.style.display = 'inline-block';
  } else {
    badge.textContent = LANG==='ko'?'파벌 미선택':LANG==='ja'?'派閥未選択':LANG==='zh'?'未选择派系':'No faction';
    badge.style.color = 'rgba(255,255,255,0.4)';
    badge.style.display = 'inline-block';
  }
}

function showFactionToast(msg, type) {
  var toast = document.getElementById('factionToast');
  if (!toast) return;
  toast.textContent = msg;
  toast.className = 'faction-toast show ' + (type || 'info');
  setTimeout(function(){ toast.classList.remove('show'); }, 3000);
}

// 이 프로젝트의 토큰 키는 'pw_token'
function _factionIsLoggedIn() { return !!localStorage.getItem('pw_token'); }
function _factionAuthHeaders() {
  var token = localStorage.getItem('pw_token');
  return token ? { 'Authorization': 'Bearer ' + token } : {};
}

// 페이지 로드 시 파벌 정보 로드
document.addEventListener('DOMContentLoaded', function() { loadFactions(); });
