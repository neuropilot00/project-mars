// ═════ Fleet Command State ═════
var fleetCmdState = {
  fleets: [],
  selectedFleetId: null,
  selectedFleet: null,
  selectedShipIds: new Set(),
  focusedShipId: null,
  formations: [],
  movements: [],
};

function fleetCmdReadJson(key, url, minGap, auth) {
  var walletKey = (window.walletState && walletState.address) ? String(walletState.address).toLowerCase() : 'public';
  var fetchOptions = auth === false ? {} : { headers: getAuthHeaders() };
  if (typeof _guardedJsonFetch === 'function') {
    return _guardedJsonFetch('fleet-cmd:' + key + ':' + walletKey, url, {
      minGap: minGap || 10000,
      backoffMs: 120000,
      fetchOptions: fetchOptions
    });
  }
  return fetch(url, fetchOptions).then(function(r){ return r.ok ? r.json() : null; }).catch(function(){ return null; });
}

function openFleetCmd() {
  if (!isLoggedIn()) { showFactionToast(t('daily_login_required')||tl('Login required','로그인이 필요합니다','ログインが必要です','请先登录'),'error'); return; }
  // Update i18n text for static HTML spans
  var subtitle = document.getElementById('fleetCmdSubtitle');
  if (subtitle) subtitle.textContent = LANG==='ko'?'함대 지휘':LANG==='ja'?'艦隊指揮':LANG==='zh'?'舰队指挥':'Command';
  var newBtn = document.getElementById('fleetCmdNewBtn');
  if (newBtn) newBtn.textContent = LANG==='ko'?'새 함대':LANG==='ja'?'新艦隊':LANG==='zh'?'新建舰队':'New Fleet';
  var hint = document.getElementById('fleetCmdSelectHint');
  if (hint) hint.textContent = LANG==='ko'?'함대를 선택하세요':LANG==='ja'?'艦隊を選択してください':LANG==='zh'?'请选择舰队':'Select a fleet';
  document.getElementById('fleetCmdModal').classList.add('active');
  loadFleetOptions().then(function(){ refreshFleetList(); });
}

function closeFleetCmd() {
  document.getElementById('fleetCmdModal').classList.remove('active');
}

function fleetCmdBodyScroll() {
  var body = document.querySelector('#fleetCmdModal .fleetcmd-body');
  return body ? body.scrollTop : 0;
}

function keepFleetCmdOpen(scrollTop) {
  var modal = document.getElementById('fleetCmdModal');
  if (modal) modal.classList.add('active');
  if (scrollTop === undefined || scrollTop === null) return;
  requestAnimationFrame(function() {
    var body = document.querySelector('#fleetCmdModal .fleetcmd-body');
    if (body) body.scrollTop = scrollTop;
  });
}

async function loadFleetOptions() {
  if (fleetCmdState.formations.length > 0) return;
  try {
    var data = await fleetCmdReadJson('options', '/api/fleets/options', 60000, false);
    if (!data) return;
    fleetCmdState.formations = data.formations || [];
    fleetCmdState.movements  = data.movements  || [];
  } catch(e) { console.error('loadFleetOptions error:', e); }
}

async function refreshFleetList() {
  try {
    var data = await fleetCmdReadJson('list', '/api/fleets', 8000);
    if (!data) return;
    fleetCmdState.fleets = data.fleets || [];
    document.getElementById('fleetCountLabel').textContent = fleetCmdState.fleets.length;
    renderFleetList();
    if (fleetCmdState.selectedFleetId) {
      var still = fleetCmdState.fleets.find(function(f){ return f.id === fleetCmdState.selectedFleetId; });
      if (still) await loadFleetDetail(fleetCmdState.selectedFleetId);
      else { fleetCmdState.selectedFleetId = null; fleetCmdState.selectedFleet = null; renderFleetDetail(); }
    }
  } catch(e) { console.error('refreshFleetList error:', e); }
}

function renderFleetList() {
  var container = document.getElementById('fleetListContent');
  if (fleetCmdState.fleets.length === 0) {
    container.innerHTML = '<div class="fs-empty" style="padding:20px">함대가 없습니다<br><button type="button" class="fleet-new-btn" style="margin-top:10px" onclick="event.preventDefault();event.stopPropagation();createNewFleet()">+ 첫 함대 생성</button></div>';
    return;
  }
  container.innerHTML = fleetCmdState.fleets.map(function(f) {
    var isActive = fleetCmdState.selectedFleetId === f.id;
    var hpPct = f.total_max_hp > 0 ? (f.total_hp / f.total_max_hp) * 100 : 0;
    var hpCls = hpPct < 30 ? 'crit' : hpPct < 60 ? 'low' : '';
    var formIcon = (f.formation_info && f.formation_info.icon) || '●';
    var moveIcon = (f.movement_info && f.movement_info.icon) || '→';
    var _fcAccent = (f.accent_color && /^#[0-9a-fA-F]{6}$/.test(f.accent_color)) ? f.accent_color : '';
    var _fcKills = parseInt(f.total_kills || 0) || 0;
    var _ident = (_fcAccent ? '<span class="fc-accent" style="background:' + _fcAccent + '"></span>' : '') +
                 (f.guild_emblem ? '<span class="fc-guild">' + fcEsc(f.guild_emblem) + '</span>' : '');
    return '<div class="fleet-card ' + (isActive ? 'active' : '') + ' ' + (f.is_in_battle ? 'in-battle' : '') + '" onclick="event.preventDefault();event.stopPropagation();selectFleet(' + f.id + ')">' +
      '<div class="fleet-card-name" title="' + fcEsc(f.name) + '">' + _ident + fcEsc(f.name || (LANG==='ko'?'이름없음':LANG==='ja'?'名前なし':LANG==='zh'?'无名称':'Unnamed')) + '</div>' +
      '<div class="fleet-card-meta"><span>' + f.ships_alive + '척</span>' +
        '<span>' + formIcon + ' ' + ((f.formation_info && f.formation_info.name_ko) || '-') + '</span>' +
        '<span>' + moveIcon + ' ' + ((f.movement_info && f.movement_info.name_ko) || '-') + '</span>' +
        (_fcKills > 0 ? '<span class="fc-kills" title="' + tl('Total kills','누적 격파','累計撃破','累计击破') + '">⊹' + (_fcKills > 999 ? '999+' : _fcKills) + '</span>' : '') +
        (f.is_in_battle ? '<span class="fleet-card-battle-tag">'+(LANG==='ko'?'전투중':LANG==='ja'?'戦闘中':LANG==='zh'?'战斗中':'In Battle')+'</span>' : '') +
      '</div>' +
      '<div class="fleet-card-bar"><div class="fleet-card-bar-fill ' + hpCls + '" style="width:' + hpPct + '%"></div></div>' +
    '</div>';
  }).join('');
}

async function selectFleet(fleetId) {
  fleetCmdState.selectedFleetId = fleetId;
  fleetCmdState.selectedShipIds.clear();
  fleetCmdState.focusedShipId = null;
  await loadFleetDetail(fleetId);
  renderFleetList();
}

async function loadFleetDetail(fleetId) {
  try {
    var data = await fleetCmdReadJson('detail:' + fleetId, '/api/fleets/' + fleetId, 5000);
    if (!data) return;
    if (!data.fleet) {
      showFactionToast((LANG==='ko'?'함대 로드 실패: ':LANG==='ja'?'艦隊ロード失敗: ':LANG==='zh'?'舰队加载失败: ':'Fleet load failed: ') + fleetCmdErrorMessage(data.error, data), 'error');
      return;
    }
    fleetCmdState.selectedFleet = data.fleet;
    renderFleetDetail();
  } catch(e) { console.error('loadFleetDetail error:', e); }
}

function fleetCmdErrorMessage(error, data) {
  var meta = data && data.meta ? data.meta : {};
  var msgMap = {
    NO_WALLET: LANG==='ko'?'지갑 로그인이 필요합니다':LANG==='ja'?'ウォレットログインが必要です':LANG==='zh'?'需要钱包登录':'Wallet login required',
    INVALID_FLEET_ID: LANG==='ko'?'함대 정보가 올바르지 않습니다':LANG==='ja'?'艦隊情報が不正です':LANG==='zh'?'舰队信息无效':'Invalid fleet',
    FLEET_NOT_FOUND: LANG==='ko'?'함대를 찾을 수 없습니다':LANG==='ja'?'艦隊が見つかりません':LANG==='zh'?'找不到舰队':'Fleet not found',
    FLEET_IN_BATTLE: LANG==='ko'?'전투 중인 함대는 이 작업을 할 수 없습니다':LANG==='ja'?'戦闘中の艦隊では操作できません':LANG==='zh'?'战斗中的舰队无法操作':'Fleet is in battle',
    INVALID_FORMATION: LANG==='ko'?'지원하지 않는 진형입니다':LANG==='ja'?'サポートされていない陣形です':LANG==='zh'?'不支持的阵型':'Invalid formation',
    INVALID_MOVEMENT: LANG==='ko'?'지원하지 않는 기동입니다':LANG==='ja'?'サポートされていない機動です':LANG==='zh'?'不支持的机动':'Invalid movement',
    NAME_TOO_LONG: LANG==='ko'?'이름이 너무 깁니다 (60자 이하)':LANG==='ja'?'名前が長すぎます（60文字以内）':LANG==='zh'?'名称过长（60字以内）':'Name too long (max 60)',
    NAME_EMPTY: LANG==='ko'?'이름이 비어있습니다':LANG==='ja'?'名前が空です':LANG==='zh'?'名称不能为空':'Name is empty',
    FLEET_LIMIT_REACHED: LANG==='ko'?'함대 최대 ' + (meta.max || 5) + '개까지 생성 가능합니다':LANG==='ja'?'艦隊は最大' + (meta.max || 5) + '個まで作成できます':LANG==='zh'?'最多可创建' + (meta.max || 5) + '支舰队':'Fleet limit (' + (meta.max || 5) + ')',
    LAST_FLEET: LANG==='ko'?'마지막 함대는 해체할 수 없습니다':LANG==='ja'?'最後の艦隊は解散できません':LANG==='zh'?'不能解散最后一支舰队':'Cannot disband last fleet',
    SHIP_IDS_REQUIRED: LANG==='ko'?'이동할 함선을 선택해야 합니다':LANG==='ja'?'移動する艦船を選択してください':LANG==='zh'?'请选择要移动的舰船':'Select ships to move',
    SHIP_NOT_OWNED: LANG==='ko'?'소유하지 않은 함선이 포함되어 있습니다':LANG==='ja'?'所有していない艦船が含まれています':LANG==='zh'?'包含未拥有的舰船':'Ship not owned',
    SHIPS_IN_BATTLE: LANG==='ko'?'선택한 함선이 전투 중입니다':LANG==='ja'?'選択した艦船は戦闘中です':LANG==='zh'?'所选舰船正在战斗':'Ships in battle',
    SHIP_LISTED_FOR_SALE: LANG==='ko'?'판매 중인 함선은 함대 조작에 사용할 수 없습니다':LANG==='ja'?'出品中の艦船は使用できません':LANG==='zh'?'在售舰船无法操作':'Ship listed for sale',
    TARGET_FLEET_IN_BATTLE: LANG==='ko'?'대상 함대가 전투 중입니다':LANG==='ja'?'対象艦隊が戦闘中です':LANG==='zh'?'目标舰队正在战斗':'Target fleet in battle',
    SHIP_ID_REQUIRED: LANG==='ko'?'기함으로 지정할 함선을 선택해야 합니다':LANG==='ja'?'旗艦にする艦船を選択してください':LANG==='zh'?'请选择旗舰':'Select a flagship',
    SHIP_NOT_FOUND: LANG==='ko'?'함선을 찾을 수 없습니다':LANG==='ja'?'艦船が見つかりません':LANG==='zh'?'找不到舰船':'Ship not found',
    SHIP_DEAD: LANG==='ko'?'파괴된 함선은 기함이 될 수 없습니다':LANG==='ja'?'破壊された艦船は旗艦になれません':LANG==='zh'?'已损毁的舰船无法成为旗舰':'Ship is destroyed',
    SHIP_NOT_IN_FLEET: LANG==='ko'?'이 함대 소속 함선이 아닙니다':LANG==='ja'?'この艦隊所属の艦船ではありません':LANG==='zh'?'该舰船不属于此舰队':'Ship not in fleet',
    SHIP_CANNOT_BE_FLAGSHIP: LANG==='ko'?'이 함선은 기함 지정이 불가능합니다':LANG==='ja'?'この艦船は旗艦に指定できません':LANG==='zh'?'此舰船无法成为旗舰':'Ship cannot be flagship',
    CROSS_FACTION_SHIP: LANG==='ko'?'다른 진영 함선은 함대에 편입할 수 없습니다 (마켓에 판매 가능)':LANG==='ja'?'他陣営の艦船は艦隊に編入できません(マーケット販売は可能)':LANG==='zh'?'其他阵营舰船无法编入舰队（可在市场出售）':'Other-faction ship cannot be deployed (listable on market)'
  };
  return msgMap[error] || error || (LANG==='ko'?'알 수 없는 오류':LANG==='ja'?'不明なエラー':LANG==='zh'?'未知错误':'Unknown error');
}

function updateFleetListSnapshotFromSelected() {
  var f = fleetCmdState.selectedFleet;
  if (!f) return;
  fleetCmdState.fleets = (fleetCmdState.fleets || []).map(function(item) {
    if (item.id !== f.id) return item;
    return Object.assign({}, item, {
      name: f.name,
      formation: f.formation,
      movement: f.movement,
      formation_info: f.formation_info,
      movement_info: f.movement_info,
      ships_alive: f.ships_alive,
      total_hp: f.total_hp,
      total_max_hp: f.total_max_hp
    });
  });
}

function renderFleetDetail() {
  var container = document.getElementById('fleetDetailContent');
  var f = fleetCmdState.selectedFleet;
  if (!f) { container.innerHTML = '<div class="fs-empty">'+(LANG==='ko'?'함대를 선택하세요':LANG==='ja'?'艦隊を選択してください':LANG==='zh'?'请选择舰队':'Select a fleet')+'</div>'; return; }
  var formations = fleetCmdState.formations || [];
  var movements  = fleetCmdState.movements  || [];
  var inBattle   = f.is_in_battle;
  var selCount   = fleetCmdState.selectedShipIds.size;
  var formBtns = formations.map(function(fm) {
    return '<button type="button" class="tactic-btn ' + (f.formation === fm.code ? 'active' : '') + '" onclick="event.preventDefault();event.stopPropagation();setFleetTactic(\'formation\',\'' + fm.code + '\')" title="' + fcEsc(fm.desc) + '">' + fm.icon + ' ' + fm.name_ko + '</button>';
  }).join('');
  var moveBtns = movements.map(function(mv) {
    return '<button type="button" class="tactic-btn ' + (f.movement === mv.code ? 'active' : '') + '" onclick="event.preventDefault();event.stopPropagation();setFleetTactic(\'movement\',\'' + mv.code + '\')" title="' + fcEsc(mv.desc) + '">' + mv.icon + ' ' + mv.name_ko + '</button>';
  }).join('');
  var activeFormation = formations.find(function(fm){ return fm.code === f.formation; }) || null;
  var activeMovement = movements.find(function(mv){ return mv.code === f.movement; }) || null;
  var shipCards = (f.ships || []).length === 0
    ? '<div class="fs-empty" style="grid-column:1/-1">'+(LANG==='ko'?'이 함대에 함선이 없습니다':LANG==='ja'?'この艦隊に艦船がありません':LANG==='zh'?'此舰队没有舰船':'No ships in this fleet')+'</div>'
    : (f.ships || []).map(function(s){ return renderFcShipCard(s, inBattle); }).join('');
  container.innerHTML =
    '<div class="fleet-detail-header">' +
      '<div class="fleet-detail-name">' + fcEsc(f.name || (LANG==='ko'?'이름없음':LANG==='ja'?'名前なし':LANG==='zh'?'无名称':'Unnamed')) + '</div>' +
      '<div class="fleet-detail-actions">' +
        '<button type="button" class="fd-btn" onclick="event.preventDefault();event.stopPropagation();renameFleet()" ' + (inBattle ? 'disabled' : '') + '>✎ '+(LANG==='ko'?'이름':LANG==='ja'?'名前':LANG==='zh'?'命名':'Rename')+'</button>' +
        '<button type="button" class="fd-btn danger" onclick="event.preventDefault();event.stopPropagation();deleteFleetPrompt()" ' + (inBattle ? 'disabled' : '') + '>🗑 '+(LANG==='ko'?'해체':LANG==='ja'?'解散':LANG==='zh'?'解散':'Disband')+'</button>' +
      '</div>' +
    '</div>' +
    (inBattle ? '<div style="color:#ef5350;font-size:10px;letter-spacing:1px;padding:6px 10px;background:rgba(239,83,80,.08);border-radius:4px">⚠ '+(LANG==="ko"?"전투 중 — 일부 기능 제한":LANG==="ja"?"戦闘中 — 一部機能制限":LANG==="zh"?"战斗中 — 部分功能受限":"In Battle — Limited")+'</div>' : '') +
    '<div class="tactics-panel">' +
      '<div class="tactics-group"><div class="tactics-label">진형 (FORMATION)</div><div class="tactics-options">' + formBtns + '</div><div class="tactic-desc">' + fcEsc(fleetTacticBrief('formation', f.formation, activeFormation)) + '</div></div>' +
      _spreadRow(f) +
      '<div class="tactics-group"><div class="tactics-label">기동 (MOVEMENT)</div><div class="tactics-options">' + moveBtns + '</div><div class="tactic-desc">' + fcEsc(fleetTacticBrief('movement', f.movement, activeMovement)) + '</div></div>' +
      _autoRetreatRow(f) +
      _liveryRow(f) +
    '</div>' +
    renderSelectedShipPanel(f) +
    renderFleetPreview(f) +
    fleetRoleGapHtml(f) +
    '<div class="fleet-ships-header">' +
      '<div class="fs-summary"><span>총 <b>' + f.ships_alive + '</b>'+(LANG==="ko"?"척":LANG==="ja"?"隻":LANG==="zh"?"艘":"ships")+'</span><span>HP <b>' + syFmt(f.total_hp) + ' / ' + syFmt(f.total_max_hp) + '</b></span><span>'+(LANG==="ko"?"전적 ":LANG==="ja"?"戦績 ":LANG==="zh"?"战绩 ":"Record ")+'<b>' + (f.battles_won || 0) + 'W / ' + (f.battles_lost || 0) + 'L</b></span></div>' +
      '<div class="fs-select-actions ' + (selCount > 0 ? 'active' : '') + '">' +
        '<span class="fs-select-count">' + selCount + (LANG==="ko"?" 척 선택":LANG==="ja"?" 隻選択":LANG==="zh"?" 艘已选":" ships selected")+'</span>' +
        '<button type="button" class="fd-btn" onclick="event.preventDefault();event.stopPropagation();fleetCmdState.selectedShipIds.clear();fleetCmdState.focusedShipId=null;renderFleetDetail()">'+(LANG==="ko"?"해제":LANG==="ja"?"解除":LANG==="zh"?"取消选择":"Deselect")+'</button>' +
        '<button type="button" class="fd-btn primary" onclick="event.preventDefault();event.stopPropagation();showMoveShipsDialog(event)" ' + (inBattle ? 'disabled' : '') + '>→ '+(LANG==="ko"?"이동":LANG==="ja"?"移動":LANG==="zh"?"移动":"Move")+'</button>' +
      '</div>' +
    '</div>' +
    '<div class="fleet-ships-grid">' + shipCards + '</div>';
}

// 진형 좌표 생성 (v7.381 리서치 재설계) — 세로 전장: 적=위(y작음), 아군 전진=위.
// 비-기함은 정렬상 항상 앞 인덱스(0..n-2)라 idx 연속 → 행/링 계산이 깔끔.
// spread(=fleet.formation_spread, 0.55~1.6)로 밀집↔분산 커스터마이징.
function fleetPreviewPoint(i, total, formation, isFlagship, spread) {
  var n = Math.max(1, total);
  var idx = Math.max(0, i);
  var nf = Math.max(1, n - 1);                 // 비-기함 수
  var S = (typeof spread === 'number' && spread > 0) ? Math.max(0.55, Math.min(1.6, spread)) : 1;

  if (formation === 'wedge') {
    // 쐐기 — 정삼각 스피어헤드(돌파). 팁이 적을 향해 위로, 행이 내려갈수록 좌우로 넓어짐.
    if (isFlagship) return { x: 50, y: 86 };   // base 후방 중심(보호+지휘)
    var row = 0, start = 0, cap = 1;           // 삼각수 행 1,2,3,4,5...
    while (idx >= start + cap) { start += cap; row++; cap = row + 1; }
    var slot = idx - start;
    var half = row * 6.4 * S;
    var x = (cap === 1) ? 50 : (50 - half + (2 * half) * (slot / (cap - 1)));
    return fleetClampPreviewPoint({ x: x, y: 22 + row * 8.0 });
  }
  if (formation === 'sphere') {
    // 구형 집결 — 360° 방어 동심원(글로브). 기함 정중앙 코어.
    if (isFlagship) return { x: 50, y: 54 };
    var ring = 1, seen = 0, cap2 = 6;          // 1링6/2링12/3링18...
    while (idx >= seen + cap2) { seen += cap2; ring++; cap2 = ring * 6; }
    var s0 = idx - seen;
    var ang = (s0 / cap2) * Math.PI * 2 + (ring % 2 ? 0.42 : 0) - Math.PI / 2;
    var rx = ring * 12.5 * S, ry = ring * 9.6 * S;
    return fleetClampPreviewPoint({ x: 50 + Math.cos(ang) * rx, y: 54 + Math.sin(ang) * ry });
  }
  if (formation === 'screen') {
    // 방어막 — 전방 횡대 방패벽 + 후방 랭크(피해 흡수). 각 행 중앙정렬, 기함 최후방.
    if (isFlagship) return { x: 50, y: 88 };
    var perRow = 8;
    var rRow = Math.floor(idx / perRow), rCol = idx % perRow;
    var colsThis = Math.min(perRow, nf - rRow * perRow);
    var cw = 11 * S;
    return fleetClampPreviewPoint({ x: 50 - ((colsThis - 1) / 2) * cw + rCol * cw, y: 26 + rRow * 9.0 });
  }
  if (formation === 'pincer') {
    // 협공 — 오목한 초승달(포위). 양 날개(뿔)가 적을 향해 전방, 중앙은 후방.
    if (isFlagship) return { x: 50, y: 74 };
    var perSide = Math.ceil(nf / 2);
    var side = (idx % 2 === 0) ? -1 : 1;
    var rank = Math.floor(idx / 2);            // 0(중앙)..perSide-1(날개끝)
    var frac = (perSide <= 1) ? 1 : (rank / (perSide - 1));
    return fleetClampPreviewPoint({ x: 50 + side * (14 + frac * 30) * S, y: 66 - frac * 40 });
  }
  if (formation === 'line') {
    // 전열 횡대(Line Abreast) — 넓은 1열로 전방 화력 최대, 다열은 뒤로.
    if (isFlagship) return { x: 50, y: 80 };
    var perL = 12;
    var lRow = Math.floor(idx / perL), lCol = idx % perL;
    var colsL = Math.min(perL, nf - lRow * perL), lw = 7.5 * S;
    return fleetClampPreviewPoint({ x: 50 - ((colsL - 1) / 2) * lw + lCol * lw, y: 34 + lRow * 11 });
  }
  if (formation === 'echelon') {
    // 사다리꼴 편대(대각 계단) — 측면 사격각 확보, 후미 보호.
    if (isFlagship) return { x: 50, y: 84 };
    var ecPerCol = Math.max(1, Math.ceil(nf / 3));
    var ecCol = Math.floor(idx / ecPerCol), ecRow = idx % ecPerCol;
    return fleetClampPreviewPoint({ x: 30 + ecCol * 16 * S + ecRow * 4.5 * S, y: 26 + ecRow * 8.5 + ecCol * 6 });
  }
  if (formation === 'vanguard') {
    // 호위 방진(Box) — 기함을 중앙에 두고 사각 링으로 호위.
    if (isFlagship) return { x: 50, y: 56 };
    var vr = 1, vseen = 0, vcap = 8;           // 사각 링 8/16/24...
    while (idx >= vseen + vcap) { vseen += vcap; vr++; vcap = vr * 8; }
    var vs = idx - vseen, per = vcap / 4, sideI = Math.floor(vs / per), t = (vs % per) / per;
    var R = vr * 13 * S, Ry = vr * 10 * S, e = -1 + 2 * t, vx, vy;
    if (sideI === 0) { vx = e * R; vy = -Ry; }
    else if (sideI === 1) { vx = R; vy = e * Ry; }
    else if (sideI === 2) { vx = -e * R; vy = Ry; }
    else { vx = -R; vy = -e * Ry; }
    return fleetClampPreviewPoint({ x: 50 + vx, y: 56 + vy });
  }
  // 폴백 — 구형
  var a = (idx / n) * Math.PI * 2 - Math.PI / 2;
  return fleetClampPreviewPoint({ x: 50 + Math.cos(a) * 16 * S, y: 54 + Math.sin(a) * 13 * S });
}

function fleetClampPreviewPoint(p) {
  return {
    x: Math.max(8, Math.min(92, p.x)),
    y: Math.max(12, Math.min(88, p.y))
  };
}

function fleetPreviewSortWeight(ship) {
  var size = fleetNormalizeSizeClass(ship);
  var weights = { frigate: 1, destroyer: 2, cruiser: 3, battleship: 4, titan: 5 };
  return weights[size] || 1;
}

function fleetNormalizeSizeClass(ship) {
  var raw = String((ship && ship.size_class) || '').toLowerCase().trim();
  if (raw === 'battle_ship') raw = 'battleship';
  if (raw === 'ew frigate' || raw === 'interceptor') raw = 'frigate';
  if (raw === 'logistics cruiser' || raw === 'sniper cruiser') raw = 'cruiser';
  if (raw === 'frigate' || raw === 'destroyer' || raw === 'cruiser' || raw === 'battleship' || raw === 'titan') return raw;
  var label = String((ship && ship.class_label) || '').toLowerCase();
  if (label.indexOf('titan') >= 0 || label.indexOf('타이탄') >= 0) return 'titan';
  if (label.indexOf('battleship') >= 0 || label.indexOf('전함') >= 0) return 'battleship';
  if (label.indexOf('cruiser') >= 0 || label.indexOf('순양') >= 0) return 'cruiser';
  if (label.indexOf('destroyer') >= 0 || label.indexOf('구축') >= 0) return 'destroyer';
  return 'frigate';
}

function renderSelectedShipPanel(f) {
  var ships = f && Array.isArray(f.ships) ? f.ships : [];
  var selected = ships.filter(function(s){ return fleetCmdState.selectedShipIds.has(String(s.id)); });
  if (!selected.length) return '';
  var focused = ships.find(function(s){ return String(s.id) === String(fleetCmdState.focusedShipId); }) || selected[selected.length - 1];
  var hpPct = focused.max_hp > 0 ? Math.round((focused.current_hp / focused.max_hp) * 100) : 0;
  var role = shipRoleInfo(focused.role);
  var _flagshipLabels = LANG==='ko'?['기함','기함 가능','기함 불가']:LANG==='ja'?['旗艦','旗艦可能','旗艦不可']:LANG==='zh'?['旗舰','可旗舰','不可旗舰']:['Flagship','Can be Flagship','Cannot be Flagship'];
  var flagshipState = focused.is_flagship ? _flagshipLabels[0] : (focused.is_flagship_capable ? _flagshipLabels[1] : _flagshipLabels[2]);
  var _selShipFb = LANG==='ko'?'선택 함선':LANG==='ja'?'選択中の艦船':LANG==='zh'?'已选舰船':'Selected Ship';
  var _shipsUnit = LANG==='ko'?'척':LANG==='ja'?'隻':LANG==='zh'?'艘':'ships';
  return '<div class="fs-selected-panel">' +
    '<div><strong>' + fcEsc(syShipName(focused) || focused.ship_type_code || _selShipFb) + '</strong>' +
      '<small>' + fcEsc(syClassLabel(focused.class_label || '')) + ' · ' + role.label + (selected.length > 1 ? ' · ' + selected.length + _shipsUnit : '') + '</small></div>' +
    '<div class="fs-selected-stats">' +
      '<span>HP ' + hpPct + '%</span>' +
      '<span>ATK ' + (focused.base_atk || '-') + '</span>' +
      '<span>DEF ' + (focused.base_def || '-') + '</span>' +
      '<span>SPD ' + (focused.base_speed || '-') + '</span>' +
      '<span>' + flagshipState + '</span>' +
    '</div>' +
  '</div>';
}

function renderFleetPreview(f) {
  var ships = (f.ships || []).filter(function(s){ return s.is_alive !== false; });
  var formation = f.formation || 'sphere';
  // (v7.385) 진형별 배치 우선순위: 작고 싼 함선=앞/외곽(소모성 스크린), 크고 중요한 함선=중앙/기함 옆.
  //   sphere/pincer/vanguard 는 low idx가 안쪽(중앙·기함 옆)이라 큰 함선 먼저(내림차순),
  //   wedge/screen/line/echelon 은 low idx가 전방이라 작은 함선 먼저(오름차순).
  var _bigFirst = (formation === 'sphere' || formation === 'pincer' || formation === 'vanguard');
  var _flagArr = ships.filter(function(s){ return !!s.is_flagship; });
  var _escorts = ships.filter(function(s){ return !s.is_flagship; });
  // 표시 선택(28 캡): 초과 시 큰(중요한) 함선 우선 유지 — 타이탄/전함이 잘려나가지 않게.
  _escorts.sort(function(a,b){
    var w = fleetPreviewSortWeight(b) - fleetPreviewSortWeight(a);
    return w !== 0 ? w : Number(a.id || 0) - Number(b.id || 0);
  });
  var _keepN = Math.max(0, 28 - _flagArr.length);
  var _shown = _escorts.slice(0, _keepN);
  // 위치 정렬: 진형 방향대로(앞=작은함 또는 안쪽=큰함)
  _shown.sort(function(a,b){
    var sw = fleetPreviewSortWeight(a) - fleetPreviewSortWeight(b);
    if (sw !== 0) return _bigFirst ? -sw : sw;
    return Number(a.id || 0) - Number(b.id || 0);
  });
  var visible = _shown.concat(_flagArr);   // 기함은 항상 마지막(진형 중심에 배치)
  var movementName = (f.movement_info && f.movement_info.name_ko) || f.movement || '-';
  var counts = { frigate:0, destroyer:0, cruiser:0, battleship:0, titan:0 };
  var roles = {};
  ships.forEach(function(s){
    var sizeClass = fleetNormalizeSizeClass(s);
    counts[sizeClass] = (counts[sizeClass] || 0) + 1;
    roles[s.role || 'dps'] = (roles[s.role || 'dps'] || 0) + 1;
  });
  var maxCount = Math.max(1, counts.frigate, counts.destroyer, counts.cruiser, counts.battleship, counts.titan);
  var rows = [
    ['FRIGATE', counts.frigate],
    ['DESTROYER', counts.destroyer],
    ['CRUISER', counts.cruiser],
    ['BATTLESHIP', counts.battleship],
    ['TITAN', counts.titan]
  ].map(function(r){
    return '<div class="fleet-comp-row"><span>' + r[0] + '</span><div class="fleet-comp-bar"><div class="fleet-comp-fill" style="width:' + Math.round(r[1] / maxCount * 100) + '%"></div></div><b>' + r[1] + '</b></div>';
  }).join('');
  var roleChips = Object.keys(roles).sort().map(function(role){
    var ri = shipRoleInfo(role);
    return '<span class="fleet-role-chip">' + ri.label + ' ×' + roles[role] + '</span>';
  }).join('');
  var adviceHtml = fleetDoctrineAdviceHtml(f, counts, roles);
  var _accent = (f.accent_color && /^#[0-9a-fA-F]{6}$/.test(f.accent_color)) ? f.accent_color : '';
  var _spread = parseFloat(f.formation_spread) || 1;
  var boardShips = visible.map(function(s, i){
    var p = fleetPreviewPoint(i, visible.length, formation, !!s.is_flagship, _spread);
    var isPilgrim = String(s.ship_type_code || '').toLowerCase().indexOf('pilgrim_') === 0;
    var _kills = parseInt(s.total_kills || s.kills_dealt || 0) || 0;
    // 킬마크: 격파 전적을 함선에 자동으로 새김(무료). 5킬↑은 금색 에이스 표식. (코스메틱 v7.377)
    var _killmark = _kills > 0
      ? '<span class="fp-killmark' + (_kills >= 5 ? ' ace' : '') + '">⊹' + (_kills > 99 ? '99+' : _kills) + '</span>'
      : '';
    // 네임플레이트: 기함만 함명 노출(작은 함선까지 달면 난잡).
    var _nameplate = s.is_flagship
      ? '<span class="fp-nameplate">' + fcEsc(s.name_ko || '') + '</span>'
      : '';
    // 함대 리버리: 강조색을 엔진 글로우로 표시 → 멀리서도 "한 세력"으로 식별(함대 귀속). (v7.377)
    var _trail = _accent ? '<span class="fp-trail" style="background:' + _accent + '"></span>' : '';
    return '<div class="fleet-preview-ship ' + (s.is_flagship ? 'flagship' : '') + (isPilgrim ? ' pilgrim-sprite' : ' sc-' + fleetNormalizeSizeClass(s)) + '" title="' + fcEsc(s.name_ko || '') + '" style="left:' + p.x + '%;top:' + p.y + '%">' +
      '<div class="bp-visual no-svg-fallback">' + shipVisual(s.size_class, s.faction_code, { role: s.role, code: s.ship_type_code }) + '</div>' +
      _trail + _killmark + _nameplate +
    '</div>';
  }).join('');
  return '<div class="fleet-preview">' +
    '<div class="fleet-board">' +
      '<div class="fleet-board-axis"></div>' +
      '<div class="fleet-board-label">' + ((f.formation_info && f.formation_info.icon) || '●') + ' ' + ((f.formation_info && f.formation_info.name_ko) || formation) + '</div>' +
      '<div class="fleet-move-vector">' + ((f.movement_info && f.movement_info.icon) || '→') + ' ' + movementName + '</div>' +
      (f.guild_emblem || f.guild_tag ? '<div class="fleet-guild-badge"' + (_accent ? ' style="border-color:' + _accent + '88"' : '') + '>' + (f.guild_emblem ? '<span class="fgb-emblem">' + fcEsc(f.guild_emblem) + '</span>' : '') + (f.guild_tag ? '<span class="fgb-tag">' + fcEsc(f.guild_tag) + '</span>' : '') + '</div>' : '') +
      _killTrophyBadge(f.account_kills) +
      boardShips +
      (ships.length > visible.length ? '<div class="fleet-preview-more">+' + (ships.length - visible.length) + ' more</div>' : '') +
    '</div>' +
    '<div class="fleet-comp-panel">' +
      '<div class="fleet-comp-title">COMPOSITION</div>' + rows +
      '<div class="fleet-comp-title" style="margin-top:4px">ROLES</div><div class="fleet-role-strip">' + roleChips + '</div>' +
      '<div class="fleet-comp-title" style="margin-top:4px">DOCTRINE CHECK</div>' + adviceHtml +
      '<div class="fleet-doctrine">진형과 기동을 바꾸면 왼쪽 미리보기 배치가 즉시 바뀝니다. 작은 함선은 전열, 대형함/기함은 중심축으로 읽히게 표시됩니다.</div>' +
    '</div>' +
  '</div>';
}

function renderFcShipCard(s, fleetInBattle) {
  var sid = String(s.id);
  var isSel = fleetCmdState.selectedShipIds.has(sid);
  var isFocused = String(fleetCmdState.focusedShipId) === sid;
  var hpPct = (s.current_hp / s.max_hp) * 100;
  var hpCls = hpPct < 30 ? 'crit' : hpPct < 60 ? 'low' : '';
  var color = s.faction_color || '#fff';
  return '<div class="fs-card ' + (isSel ? 'selected' : '') + ' ' + (isFocused ? 'focused' : '') + ' ' + (s.is_flagship ? 'flagship' : '') + '" onclick="toggleShipSel(' + s.id + ',event)">' +
    (s.is_flagship ? '<span class="fs-card-flagship-badge">⚔</span>' : '') +
    '<div class="fs-card-name" style="color:' + color + '" title="' + fcEsc(s.name_ko) + '">' + fcEsc(s.name_ko) + '</div>' +
    '<div class="fs-card-class">' + fcEsc(s.class_label || '') + '</div>' +
    '<span class="fs-role">' + shipRoleInfo(s.role).label + '</span>' +
    shipRoleMatchupChips(s.role) +
    '<div class="fs-card-stats"><span>ATK ' + (s.base_atk || '-') + '</span><span>DEF ' + (s.base_def || '-') + '</span><span>SPD ' + (s.base_speed || '-') + '</span></div>' +
    '<div class="fs-card-hp-bar"><div class="fs-card-hp-fill ' + hpCls + '" style="width:' + hpPct + '%"></div></div>' +
    (!s.is_flagship && s.is_flagship_capable && !fleetInBattle
      ? '<button type="button" class="fd-btn" style="margin-top:4px;width:100%;font-size:8px" onclick="event.preventDefault();event.stopPropagation();setAsFlagship(' + s.id + ')">기함 지정</button>'
      : '') +
  '</div>';
}

function toggleShipSel(shipId, event) {
  if (event) event.stopPropagation();
  var key = String(shipId); // ships.id는 bigint → API에서 문자열. Set 키를 문자열로 통일해야 .has() 매칭됨
  if (fleetCmdState.selectedShipIds.has(key)) {
    fleetCmdState.selectedShipIds.delete(key);
    if (String(fleetCmdState.focusedShipId) === key) {
      var remaining = Array.from(fleetCmdState.selectedShipIds);
      fleetCmdState.focusedShipId = remaining.length ? remaining[remaining.length - 1] : null;
    }
  } else {
    fleetCmdState.selectedShipIds.add(key);
    fleetCmdState.focusedShipId = key;
  }
  renderFleetDetail();
}

// 자동 퇴각 설정 UI — HP 임계% 이하 시 자동 후퇴(함선 보존). 0=비활성.
function _autoRetreatRow(f) {
  var cur = parseInt((f && f.auto_retreat_pct), 10) || 0;
  var opts = [0, 15, 25, 35, 50];
  var btns = opts.map(function(p){
    var on = cur === p;
    var label = p === 0 ? tl('OFF','끔','OFF','关') : (p + '%');
    return '<button type="button" class="tactic-btn '+(on?'active':'')+'" onclick="event.preventDefault();event.stopPropagation();setAutoRetreat('+p+')">'+label+'</button>';
  }).join('');
  return '<div class="tactics-group"><div class="tactics-label">🛟 '+tl('AUTO-RETREAT (save ships)','자동 퇴각 (함선 보존)','自動退却','自动撤退')+'</div><div class="tactics-options">' + btns + '</div>' +
    '<div style="font-size:8px;color:rgba(255,255,255,.4);margin-top:4px">'+tl('Fleet retreats when HP drops below this — losing ships is avoided (loss counts as defeat).','함대 HP가 이 % 이하로 떨어지면 자동 후퇴 — 함선 파괴를 막습니다(패배 처리).','艦隊HPがこの%以下で自動退却 — 艦船喪失を回避（敗北扱い）。','舰队HP低于此%自动撤退 — 避免损失舰船（计为失败）。')+'</div></div>';
}
async function setAutoRetreat(pct) {
  var fleetId = fleetCmdState.selectedFleetId;
  if (!fleetId) return;
  var scrollTop = fleetCmdBodyScroll();
  if (fleetCmdState.selectedFleet) { fleetCmdState.selectedFleet.auto_retreat_pct = pct; renderFleetDetail(); keepFleetCmdOpen(scrollTop); }
  try {
    var res = await fetch('/api/fleets/' + fleetId, {
      method: 'PUT',
      headers: Object.assign({'Content-Type':'application/json','x-wallet':(getMyWallet()||'')}, getAuthHeaders()),
      body: JSON.stringify({ auto_retreat_pct: pct })
    });
    var d = await res.json();
    if (!res.ok || d.success === false) { showFactionToast(tl('Failed','설정 실패','失敗','失败'), 'error'); }
    else { showFactionToast(pct===0 ? tl('Auto-retreat off','자동 퇴각 끔','自動退却OFF','自动撤退关') : (tl('Auto-retreat at','자동 퇴각','自動退却','自动撤退')+' '+pct+'%'), 'success'); }
  } catch(e) { showFactionToast(tl('Network error','네트워크 오류','ネットワークエラー','网络错误'), 'error'); }
}
// ── 계정 킬 트로피 (전적 과시, 계정 귀속 — 함선 격침과 무관) (v7.380) ──
var _KILL_TROPHY_TIERS = [
  { min: 500, icon: '👑', cls: 'legend', label: { en:'Legend', ko:'레전드', ja:'レジェンド', zh:'传奇' } },
  { min: 150, icon: '🏆', cls: 'plat',   label: { en:'Ace',    ko:'에이스', ja:'エース',   zh:'王牌' } },
  { min: 50,  icon: '🥇', cls: 'gold',   label: { en:'Gold',   ko:'골드',   ja:'ゴールド', zh:'黄金' } },
  { min: 10,  icon: '🥈', cls: 'silver', label: { en:'Silver', ko:'실버',   ja:'シルバー', zh:'白银' } },
  { min: 1,   icon: '🥉', cls: 'bronze', label: { en:'Bronze', ko:'브론즈', ja:'ブロンズ', zh:'青铜' } }
];
function _killTrophy(kills) {
  var k = parseInt(kills || 0) || 0;
  for (var i = 0; i < _KILL_TROPHY_TIERS.length; i++) {
    if (k >= _KILL_TROPHY_TIERS[i].min) return _KILL_TROPHY_TIERS[i];
  }
  return null;
}
function _killTrophyBadge(kills) {
  var t = _killTrophy(kills);
  if (!t) return '';
  var lbl = t.label[LANG] || t.label.en;
  var k = parseInt(kills) || 0;
  return '<div class="fleet-trophy-badge ' + t.cls + '" title="' + tl('Account kill rank','계정 격파 등급','アカウント撃破ランク','账号击破等级') + ': ' + k + '">' +
    '<span class="ftb-icon">' + t.icon + '</span><span class="ftb-label">' + lbl + ' · ⊹' + k + '</span></div>';
}
// ── 함대 리버리(강조색) 코스메틱 — GP 싱크 (v7.377) ──
var _FLEET_LIVERY_PALETTE = ['#4fc3f7','#ff7043','#7ee787','#ffd54f','#ba68c8','#f06292','#4dd0e1','#a1887f','#ff5252','#82b1ff'];
function _liveryRow(f) {
  var cur = String((f && f.accent_color) || '');
  var swatches = _FLEET_LIVERY_PALETTE.map(function(c){
    var on = cur.toLowerCase() === c.toLowerCase();
    return '<button type="button" class="livery-swatch'+(on?' active':'')+'" style="background:'+c+'" onclick="event.preventDefault();event.stopPropagation();setFleetLivery(\''+c+'\')" title="'+c+'"></button>';
  }).join('');
  var offBtn = '<button type="button" class="tactic-btn'+(!cur?' active':'')+'" onclick="event.preventDefault();event.stopPropagation();setFleetLivery(\'\')">'+tl('OFF','끔','OFF','关')+'</button>';
  return '<div class="tactics-group"><div class="tactics-label">🎨 '+tl('FLEET LIVERY (200 GP)','함대 리버리 (200 GP)','艦隊リバリー (200 GP)','舰队涂装 (200 GP)')+'</div>'+
    '<div class="livery-swatches">'+swatches+offBtn+'</div>'+
    '<div style="font-size:8px;color:rgba(255,255,255,.4);margin-top:4px">'+tl('Accent shown as engine glow — identify your fleet at a glance. Fleet-bound (survives ship loss).','강조색이 엔진 글로우로 표시돼 멀리서도 내 함대를 식별 — 함대 귀속(함선 격침과 무관).','エンジン光として表示。艦隊帰属。','作为引擎光显示。舰队归属。')+'</div></div>';
}
async function setFleetLivery(color) {
  var fleetId = fleetCmdState.selectedFleetId;
  if (!fleetId) return;
  var scrollTop = fleetCmdBodyScroll();
  var prev = fleetCmdState.selectedFleet ? fleetCmdState.selectedFleet.accent_color : null;
  if (fleetCmdState.selectedFleet) { fleetCmdState.selectedFleet.accent_color = color || null; renderFleetDetail(); keepFleetCmdOpen(scrollTop); }
  try {
    var res = await fetch('/api/fleets/' + fleetId + '/livery', {
      method: 'POST',
      headers: Object.assign({'Content-Type':'application/json'}, getAuthHeaders()),
      body: JSON.stringify({ color: color })
    });
    var d = await res.json();
    if (!res.ok || d.success === false) {
      if (fleetCmdState.selectedFleet) { fleetCmdState.selectedFleet.accent_color = prev; renderFleetDetail(); keepFleetCmdOpen(scrollTop); }
      showFactionToast(d.error === 'INSUFFICIENT_GP' ? tl('Not enough GP','GP 부족','GP不足','GP不足') : tl('Failed','실패','失敗','失败'), 'error');
    } else {
      try { updateFleetListSnapshotFromSelected(); } catch(_){}
      renderFleetList();
      showFactionToast(color ? tl('Livery applied','리버리 적용','リバリー適用','涂装应用') : tl('Livery cleared','리버리 해제','リバリー解除','涂装清除'), 'success');
    }
  } catch(e) {
    if (fleetCmdState.selectedFleet) { fleetCmdState.selectedFleet.accent_color = prev; renderFleetDetail(); keepFleetCmdOpen(scrollTop); }
    showFactionToast(tl('Network error','네트워크 오류','ネットワークエラー','网络错误'), 'error');
  }
}
// ── 진형 밀집도(밀집↔분산) 커스터마이징 (v7.382) ──
function _spreadRow(f) {
  var cur = parseFloat(f && f.formation_spread) || 1;
  var opts = [
    { v: 0.75, label: tl('Tight','밀집','密集','密集') },
    { v: 1.0,  label: tl('Standard','표준','標準','标准') },
    { v: 1.3,  label: tl('Loose','분산','分散','分散') }
  ];
  var btns = opts.map(function(o){
    var on = Math.abs(cur - o.v) < 0.06;
    return '<button type="button" class="tactic-btn '+(on?'active':'')+'" onclick="event.preventDefault();event.stopPropagation();setFleetSpread('+o.v+')">'+o.label+'</button>';
  }).join('');
  return '<div class="tactics-group"><div class="tactics-label">📐 '+tl('FORMATION DENSITY','진형 밀집도','陣形密度','阵形密度')+'</div><div class="tactics-options">'+btns+'</div></div>';
}
async function setFleetSpread(val) {
  var fleetId = fleetCmdState.selectedFleetId;
  if (!fleetId) return;
  var scrollTop = fleetCmdBodyScroll();
  var prev = fleetCmdState.selectedFleet ? fleetCmdState.selectedFleet.formation_spread : null;
  if (fleetCmdState.selectedFleet) { fleetCmdState.selectedFleet.formation_spread = val; renderFleetDetail(); keepFleetCmdOpen(scrollTop); }
  try {
    var res = await fetch('/api/fleets/' + fleetId, {
      method: 'PUT',
      headers: Object.assign({'Content-Type':'application/json'}, getAuthHeaders()),
      body: JSON.stringify({ formation_spread: val })
    });
    var d = await res.json();
    if (!res.ok || d.success === false) {
      if (fleetCmdState.selectedFleet) { fleetCmdState.selectedFleet.formation_spread = prev; renderFleetDetail(); keepFleetCmdOpen(scrollTop); }
      showFactionToast(tl('Failed','실패','失敗','失败'), 'error');
    } else {
      try { updateFleetListSnapshotFromSelected(); } catch(_){}
    }
  } catch(e) {
    if (fleetCmdState.selectedFleet) { fleetCmdState.selectedFleet.formation_spread = prev; renderFleetDetail(); keepFleetCmdOpen(scrollTop); }
    showFactionToast(tl('Network error','네트워크 오류','ネットワークエラー','网络错误'), 'error');
  }
}
async function setFleetTactic(type, value) {
  var fleetId = fleetCmdState.selectedFleetId;
  if (!fleetId) return;
  var modal = document.getElementById('fleetCmdModal');
  var wasOpen = !!(modal && modal.classList.contains('active'));
  var scrollTop = fleetCmdBodyScroll();
  var prevFleet = fleetCmdState.selectedFleet ? Object.assign({}, fleetCmdState.selectedFleet) : null;
  if (fleetCmdState.selectedFleet) {
    fleetCmdState.selectedFleet[type] = value;
    if (type === 'formation') {
      var fm = (fleetCmdState.formations || []).find(function(x){ return x.code === value; });
      if (fm) fleetCmdState.selectedFleet.formation_info = fm;
    } else {
      var mv = (fleetCmdState.movements || []).find(function(x){ return x.code === value; });
      if (mv) fleetCmdState.selectedFleet.movement_info = mv;
    }
    renderFleetDetail();
    renderFleetList();
    keepFleetCmdOpen(scrollTop);
  }
  try {
    var body = {}; body[type] = value;
    var res = await fetch('/api/fleets/' + fleetId, {
      method: 'PUT',
      headers: Object.assign({'Content-Type':'application/json'}, getAuthHeaders()),
      body: JSON.stringify(body)
    });
    var data = await res.json();
    if (!res.ok) {
      if (prevFleet) fleetCmdState.selectedFleet = prevFleet;
      renderFleetDetail();
      showFactionToast((LANG==='ko'?'변경 실패: ':LANG==='ja'?'変更失敗: ':LANG==='zh'?'更改失败: ':'Change failed: ') + fleetCmdErrorMessage(data.error, data), 'error');
      if (wasOpen) keepFleetCmdOpen(scrollTop);
      return;
    }
    showFactionToast((type === 'formation' ? (LANG==='ko'?'진형':LANG==='ja'?'陣形':LANG==='zh'?'阵型':'Formation') : (LANG==='ko'?'기동':LANG==='ja'?'機動':LANG==='zh'?'机动':'Maneuver')) + (LANG==='ko'?' 변경됨':LANG==='ja'?' 変更済み':LANG==='zh'?' 已变更':' changed'), 'success');
    updateFleetListSnapshotFromSelected();
    renderFleetList();
    renderFleetDetail();
    if (wasOpen) keepFleetCmdOpen(scrollTop);
  } catch(e) {
    if (prevFleet) fleetCmdState.selectedFleet = prevFleet;
    renderFleetDetail();
    if (wasOpen) keepFleetCmdOpen(scrollTop);
    showFactionToast(t('quests_network_error')||tl('Network error','네트워크 오류','ネットワークエラー','网络错误'),'error');
  }
}

function setFleetFormation(formation) {
  return setFleetTactic('formation', formation);
}

function setFleetManeuver(maneuver) {
  return setFleetTactic('movement', maneuver);
}

async function createNewFleet() {
  var name = await gameInput({ title:'새 함대', label:'함대 이름 (비워두면 자동)', placeholder:'예: 1함대', maxLength:60 });
  if (name === null) return;
  try {
    var res = await fetch('/api/fleets', {
      method: 'POST',
      headers: Object.assign({'Content-Type':'application/json'}, getAuthHeaders()),
      body: JSON.stringify({ name: name.trim() || undefined })
    });
    var data = await res.json();
    if (!res.ok) {
      showFactionToast((LANG==='ko'?'오류: ':LANG==='ja'?'エラー: ':LANG==='zh'?'错误: ':'Error: ') + fleetCmdErrorMessage(data.error, data), 'error'); return;
    }
    showFactionToast('\'' + data.name + '\' ' + (LANG==='ko'?'생성됨':LANG==='ja'?'作成しました':LANG==='zh'?'已创建':'created'), 'success');
    await refreshFleetList();
    await selectFleet(data.id);
  } catch(e) { showFactionToast(t('quests_network_error')||tl('Network error','네트워크 오류','ネットワークエラー','网络错误'),'error'); }
}

async function renameFleet() {
  var f = fleetCmdState.selectedFleet; if (!f) return;
  var newName = await gameInput({ title:'함대 이름 변경', label:'새 이름', placeholder:f.name, defaultValue:f.name, maxLength:60 });
  if (newName === null || newName.trim() === f.name) return;
  if (!newName.trim()) { showFactionToast(LANG==='ko'?'이름이 비어있습니다':LANG==='ja'?'名前が空です':LANG==='zh'?'名称为空':'Name is empty','error'); return; }
  try {
    var res = await fetch('/api/fleets/' + f.id, {
      method: 'PUT',
      headers: Object.assign({'Content-Type':'application/json'}, getAuthHeaders()),
      body: JSON.stringify({ name: newName.trim() })
    });
    var data = await res.json();
    if (!res.ok) { showFactionToast((LANG==='ko'?'변경 실패: ':LANG==='ja'?'変更失敗: ':LANG==='zh'?'更改失败: ':'Change failed: ') + fleetCmdErrorMessage(data.error, data), 'error'); return; }
    showFactionToast(LANG==='ko'?'이름 변경됨':LANG==='ja'?'名前変更しました':LANG==='zh'?'名称已更改':'Name changed','success');
    await refreshFleetList();
  } catch(e) { showFactionToast(t('quests_network_error')||tl('Network error','네트워크 오류','ネットワークエラー','网络错误'),'error'); }
}

async function deleteFleetPrompt() {
  var f = fleetCmdState.selectedFleet; if (!f) return;
  var body = f.ships_alive > 0
    ? '<b>' + fcEsc(f.name) + '</b> '+(LANG==="ko"?"함대를 해체합니다.":LANG==="ja"?"艦隊を解散します。":LANG==="zh"?"解散舰队。":"Fleet will be disbanded.")+'<br><span style="color:var(--gold)">' + f.ships_alive + (LANG==="ko"?"척":LANG==="ja"?"隻":LANG==="zh"?"艘":"ships")+'</span>'+(LANG==="ko"?"이 다른 함대로 이동됩니다.":LANG==="ja"?"は他の艦隊に移動されます。":LANG==="zh"?"将移至其他舰队。":" moved to another fleet.")
    : '<b>' + fcEsc(f.name) + '</b> '+(LANG==="ko"?"함대를 해체합니다.":LANG==="ja"?"艦隊を解散します。":LANG==="zh"?"解散舰队。":"Fleet will be disbanded.");
  var ok = await gameConfirm({ icon:'🗑', title:LANG==="ko"?"함대 해체":LANG==="ja"?"艦隊解散":LANG==="zh"?"解散舰队":"Disband Fleet", body:body, confirmText:LANG==="ko"?"해체":LANG==="ja"?"解散":LANG==="zh"?"解散":"Disband" });
  if (!ok) return;
  try {
    var res = await fetch('/api/fleets/' + f.id, { method: 'DELETE', headers: getAuthHeaders() });
    var data = await res.json();
    if (!res.ok) {
      showFactionToast((LANG==='ko'?'오류: ':LANG==='ja'?'エラー: ':LANG==='zh'?'错误: ':'Error: ') + fleetCmdErrorMessage(data.error, data), 'error'); return;
    }
    showFactionToast(data.ships_moved > 0 ? ((LANG==='ko'?'해체 완료 — ':LANG==='ja'?'解散完了 — ':LANG==='zh'?'解散完成 — ':'Disbanded — ') + data.ships_moved + (LANG==='ko'?'척 이동':LANG==='ja'?'隻移動':LANG==='zh'?'艘已移动':' ships moved')) : (LANG==='ko'?'해체 완료':LANG==='ja'?'解散完了':LANG==='zh'?'解散完成':'Disbanded'), 'success');
    fleetCmdState.selectedFleetId = null; fleetCmdState.selectedFleet = null;
    await refreshFleetList();
  } catch(e) { showFactionToast(t('quests_network_error')||tl('Network error','네트워크 오류','ネットワークエラー','网络错误'),'error'); }
}

async function showMoveShipsDialog(event) {
  if (event) event.stopPropagation();
  var scrollTop = fleetCmdBodyScroll();
  var shipIds = Array.from(fleetCmdState.selectedShipIds);
  if (!shipIds.length) return;
  var otherFleets = fleetCmdState.fleets.filter(function(f){ return f.id !== fleetCmdState.selectedFleetId && !f.is_in_battle; });
  if (!otherFleets.length) { showFactionToast(LANG==='ko'?'이동할 함대가 없습니다. 새 함대를 만드세요.':LANG==='ja'?'移動先の艦隊がありません。新しい艦隊を作成してください。':LANG==='zh'?'没有可移动的舰队，请创建新舰队。':'No other fleets to move to. Create a new fleet.','error'); return; }
  var targetId = await gamePicker({
    title: shipIds.length + '척 함선 이동',
    items: otherFleets.map(function(f){ return { value: String(f.id), label: f.name + ' (' + f.ships_alive + '척)', icon: '🚢' }; })
  });
  if (!targetId) return;
  var target = otherFleets.find(function(f){ return String(f.id) === targetId; });
  if (!target) { showFactionToast(LANG==='ko'?'잘못된 선택':LANG==='ja'?'無効な選択':LANG==='zh'?'无效选择':'Invalid selection','error'); return; }
  try {
    var res = await fetch('/api/fleets/' + target.id + '/move-ships', {
      method: 'POST',
      headers: Object.assign({'Content-Type':'application/json'}, getAuthHeaders()),
      body: JSON.stringify({ ship_ids: shipIds })
    });
    var data = await res.json();
    if (!res.ok) {
      showFactionToast((LANG==='ko'?'오류: ':LANG==='ja'?'エラー: ':LANG==='zh'?'错误: ':'Error: ') + fleetCmdErrorMessage(data.error, data), 'error'); return;
    }
    showFactionToast(data.moved_count + (LANG==='ko'?'척 이동 완료':LANG==='ja'?'隻移動完了':LANG==='zh'?'艘移动完成':' ships moved'), 'success');
    fleetCmdState.selectedShipIds.clear();
    await refreshFleetList();
    keepFleetCmdOpen(scrollTop);
  } catch(e) { showFactionToast(t('quests_network_error')||tl('Network error','네트워크 오류','ネットワークエラー','网络错误'),'error'); }
}

async function setAsFlagship(shipId) {
  var fleetId = fleetCmdState.selectedFleetId; if (!fleetId) return;
  var modal = document.getElementById('fleetCmdModal');
  var wasOpen = !!(modal && modal.classList.contains('active'));
  var scrollTop = fleetCmdBodyScroll();
  try {
    var res = await fetch('/api/fleets/' + fleetId + '/flagship', {
      method: 'POST',
      headers: Object.assign({'Content-Type':'application/json'}, getAuthHeaders()),
      body: JSON.stringify({ ship_id: shipId })
    });
    var data = await res.json();
    if (!res.ok) {
      showFactionToast(tl('Assign failed: ','지정 실패: ','指定失敗: ','指定失败：') + fleetCmdErrorMessage(data.error, data), 'error');
      if (wasOpen) keepFleetCmdOpen(scrollTop);
      return;
    }
    showFactionToast(tl('Flagship updated','기함 변경됨','旗艦を変更しました','旗舰已更新'), 'success');
    await loadFleetDetail(fleetId);
    updateFleetListSnapshotFromSelected();
    renderFleetList();
    if (wasOpen) keepFleetCmdOpen(scrollTop);
  } catch(e) {
    if (wasOpen) keepFleetCmdOpen(scrollTop);
    showFactionToast(t('quests_network_error')||tl('Network error','네트워크 오류','ネットワークエラー','网络错误'),'error');
  }
}

function fcEsc(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
}
