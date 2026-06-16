// ── A-5: Auth & Util Helpers (used by A-2/A-3/A-5) ──
function isLoggedIn() { return !!localStorage.getItem('pw_token'); }
function getAuthHeaders() {
  var t = localStorage.getItem('pw_token');
  return t ? { 'Authorization': 'Bearer ' + t } : {};
}
function formatNum(n) {
  return typeof syFmt === 'function' ? syFmt(n) : String(Number(n)||0);
}
// Global escapeHtml (escapeHtml is local-scoped in some places; this provides a global fallback)
if (typeof escapeHtml === 'undefined') {
  var escapeHtml = function(s) { return escapeHtmlSafe(s); };
}

// ═══ A-5: Battle Renderer JS ═══
// ═════════════════════════════════════════════════════════════════
// Battle Hub
// ═════════════════════════════════════════════════════════════════

let battleHubState = {
  currentTab: 'active',
  pollTimer: null,
  listCache: Object.create(null),
  killboardCache: null,
};

const BATTLEFIELD_KEYS = ['orbit_territory','garrison','mining_site','canyon_outpost','polar_ice','lava_tube','crater_relay','refinery_yard','colony_dome','excavation_grid','dust_storm','occupied_airspace','shipyard_drydock','convoy_route','ancient_ruins','orbital_blockade','garrison_rooftop','deep_mine','settlement_airspace','occupation_grid_airspace','minehead_trench','dome_defense_line','orbital_minefield'];
const BATTLEFIELD_LABELS = {
  orbit_territory: 'Orbit Territory',
  garrison: 'Garrison Airspace',
  mining_site: 'Mining Site',
  canyon_outpost: 'Canyon Outpost',
  polar_ice: 'Polar Ice Field',
  lava_tube: 'Lava Tube',
  crater_relay: 'Crater Relay',
  refinery_yard: 'Refinery Yard',
  colony_dome: 'Colony Dome',
  excavation_grid: 'Excavation Grid',
  dust_storm: 'Dust Storm',
  occupied_airspace: 'Occupied Airspace',
  shipyard_drydock: 'Shipyard Drydock',
  convoy_route: 'Convoy Route',
  ancient_ruins: 'Ancient Ruins',
  orbital_blockade: 'Orbital Blockade',
  garrison_rooftop: 'Garrison Rooftop',
  deep_mine: 'Deep Mine Pit',
  settlement_airspace: 'Settlement Airspace',
  occupation_grid_airspace: 'Occupation Grid Airspace',
  minehead_trench: 'Minehead Trench',
  dome_defense_line: 'Dome Defense Line',
  orbital_minefield: 'Orbital Minefield'
};
const BATTLEFIELD_BACKGROUNDS = {
  orbit_territory: '/assets/textures/battlefields/mars_orbit_territory.png',
  garrison: '/assets/textures/battlefields/mars_garrison_topdown.png',
  mining_site: '/assets/textures/battlefields/mars_mining_site_topdown.png',
  canyon_outpost: '/assets/textures/battlefields/mars_canyon_outpost_topdown.png',
  polar_ice: '/assets/textures/battlefields/mars_polar_ice_topdown.png',
  lava_tube: '/assets/textures/battlefields/mars_lava_tube_topdown.png',
  crater_relay: '/assets/textures/battlefields/mars_crater_relay_topdown.png',
  refinery_yard: '/assets/textures/battlefields/mars_refinery_yard_topdown.png',
  colony_dome: '/assets/textures/battlefields/mars_colony_dome_topdown.png',
  excavation_grid: '/assets/textures/battlefields/mars_excavation_grid_topdown.png',
  dust_storm: '/assets/textures/battlefields/mars_dust_storm_topdown.png',
  occupied_airspace: '/assets/textures/battlefields/mars_occupied_airspace_topdown.png',
  shipyard_drydock: '/assets/textures/battlefields/mars_shipyard_drydock_topdown.png',
  convoy_route: '/assets/textures/battlefields/mars_convoy_route_topdown.png',
  ancient_ruins: '/assets/textures/battlefields/mars_ancient_ruins_topdown.png',
  orbital_blockade: '/assets/textures/battlefields/mars_orbital_blockade_topdown.png',
  garrison_rooftop: '/assets/textures/battlefields/mars_garrison_rooftop_topdown.png',
  deep_mine: '/assets/textures/battlefields/mars_deep_mine_topdown.png',
  settlement_airspace: '/assets/textures/battlefields/mars_settlement_airspace_topdown.png',
  occupation_grid_airspace: '/assets/textures/battlefields/mars_occupation_grid_airspace_topdown.png',
  minehead_trench: '/assets/textures/battlefields/mars_minehead_trench_topdown.png',
  dome_defense_line: '/assets/textures/battlefields/mars_dome_defense_line_topdown.png',
  orbital_minefield: '/assets/textures/battlefields/mars_orbital_blockade_topdown.png'
};
const SECTOR_BATTLEFIELD_BY_CODE = {
  olympus_crown: 'garrison_rooftop',
  tharsis_citadel: 'garrison_rooftop',
  pavonis_gate: 'orbital_minefield',
  ascraeus_vault: 'refinery_yard',
  arsia_forge: 'lava_tube',
  noctis_prime: 'canyon_outpost',
  marineris_east: 'canyon_outpost',
  marineris_west: 'canyon_outpost',
  candor_fields: 'minehead_trench',
  ophir_station: 'shipyard_drydock',
  hebes_crossing: 'dome_defense_line',
  coprates_ridge: 'canyon_outpost',
  eos_plateau: 'crater_relay',
  melas_basin: 'canyon_outpost',
  tithonium_scars: 'crater_relay',
  syria_planum: 'excavation_grid',
  hellas_abyss: 'crater_relay',
  elysium_wastes: 'dust_storm',
  utopia_flats: 'dome_defense_line',
  arcadia_ridge: 'dust_storm',
  cerberus_scars: 'lava_tube',
  phlegra_deep: 'polar_ice',
  amazonis_sink: 'minehead_trench',
  borealis_edge: 'polar_ice'
};
const battleContextById = Object.create(null);

function battleHubReadFetch(key, url, minGap) {
  const walletKey = (typeof getMyWallet === 'function' && getMyWallet()) || 'public';
  if (typeof _guardedJsonFetch === 'function') {
    return _guardedJsonFetch('battle-hub:' + key + ':' + String(walletKey).toLowerCase(), url, {
      minGap: minGap || 10000,
      backoffMs: 90000,
      fetchOptions: { headers: getAuthHeaders() }
    });
  }
  return fetch(url, { headers: getAuthHeaders() }).then(function(r){ return r.json(); });
}

function battleHubReadKeyed(key, url, minGap) {
  return battleHubReadFetch(key, url, minGap).then(function(data){ return data || null; });
}

function normalizeBattleSummary(summary) {
  if (!summary) return {};
  if (typeof summary === 'object') return summary;
  try { return JSON.parse(summary); } catch (_) { return {}; }
}

function rememberBattleContext(battle) {
  const id = parseInt(battle && battle.id, 10);
  if (!id) return;
  const summary = normalizeBattleSummary(battle.battle_summary);
  battleContextById[id] = {
    battle_type: battle.battle_type || '',
    sector_code: battle.sector_code || summary.sector_code || '',
    sector_name: battle.sector_name || '',
    battlefield_key: battle.battlefield_key || '',
    battlefield_label: battle.battlefield_label || '',
    environment_modifiers: battle.environment_modifiers || {},
    environment_objective: battle.environment_objective || '',
    environment_salvage_hint: battle.environment_salvage_hint || [],
    battle_summary: summary || {},
  };
}

function formatBattlefieldModifiers(mods) {
  mods = mods || {};
  const parts = [];
  const add = (label, value) => {
    const n = Number(value);
    if (!Number.isFinite(n) || Math.abs(n - 1) < 0.005) return;
    const pct = Math.round((n - 1) * 100);
    parts.push(label + ' ' + (pct > 0 ? '+' : '') + pct + '%');
  };
  add('ATK', mods.atk);
  add('DEF', mods.def);
  add('SPD', mods.speed);
  return parts.join(' · ');
}

function renderBattleEconomyTags(b, battlefieldKey) {
  const summary = normalizeBattleSummary(b && b.battle_summary);
  const tags = [];
  const bountyGp = Math.max(0, Math.round(Number(b && b.active_bounty_gp) || Number(summary.active_bounty_gp) || Number(summary.bounty_gp) || 0));
  if (bountyGp > 0) {
    tags.push(`<span style="color:var(--gold)">💰 ${LANG==='ko'?'현상금':LANG==='ja'?'賞金':LANG==='zh'?'悬赏':'Bounty'} +${formatNum(bountyGp)} GP</span>`);
  }
  if (summary.sector_conflict || (b && b.sector_code && ['pvp_duel','hijack','siege'].includes(String(b.battle_type || '')))) {
    tags.push(`<span style="color:#ffab40">⚔ ${LANG==='ko'?'분쟁 보너스':LANG==='ja'?'紛争ボーナス':LANG==='zh'?'争端加成':'Conflict bonus'}</span>`);
  }
  const type = String((b && b.battle_type) || '').toLowerCase();
  if (!summary.is_ai_battle && type !== 'ai_practice' && battlefieldKey) {
    tags.push(`<span style="color:#7dd3fc">🧲 ${LANG==='ko'?'전장 회수':LANG==='ja'?'戦場回収':LANG==='zh'?'战场回收':'Field salvage'}</span>`);
  }
  return tags.slice(0, 3).join('');
}

function battlefieldImageUrl(key) {
  return BATTLEFIELD_BACKGROUNDS[key] || '/assets/textures/mars_nasa_2k.jpg';
}

function formatBattlefieldSalvageHint(items) {
  if (!Array.isArray(items) || !items.length) return '';
  return items.slice(0, 2).map(function(code){
    var icon = (typeof MINERAL_ICONS !== 'undefined' && MINERAL_ICONS[code]) || '🧩';
    var name = (typeof MINERAL_KO !== 'undefined' && MINERAL_KO[code]) || code;
    return icon + ' ' + name;
  }).join(' / ');
}

function _stableBattlefieldIndex(seed) {
  seed = String(seed || '');
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0;
  return Math.abs(hash) % BATTLEFIELD_KEYS.length;
}

function pickBattlefieldKey(battleId) {
  const ctx = battleContextById[parseInt(battleId, 10)] || {};
  if (ctx.battlefield_key && BATTLEFIELD_LABELS[ctx.battlefield_key]) return ctx.battlefield_key;
  const type = String(ctx.battle_type || '').toLowerCase();
  const sectorCode = String(ctx.sector_code || '').toLowerCase();
  const sectorName = String(ctx.sector_name || '').toLowerCase();
  const mods = ctx.environment_modifiers || {};
  const summary = normalizeBattleSummary(ctx.battle_summary);
  if (sectorCode === '__commander__' || type === 'commander_siege') return 'occupied_airspace';
  if (summary.is_ai_battle || mods.is_ai_battle || type === 'ai_practice') return 'garrison';
  if (summary.arena || mods.arena || type === 'arena') return 'shipyard_drydock';
  if (summary.is_world_event || mods.is_world_event) return 'convoy_route';
  if (summary.active_bounty_gp || summary.bounty_gp || mods.bounty_gp || type === 'bounty') return 'orbital_blockade';
  if (/guild|alliance/.test(type)) return 'occupation_grid_airspace';
  if (/tournament|bracket/.test(type)) return 'colony_dome';
  if (/transport|convoy/.test(type)) return 'convoy_route';
  if (type === 'siege' && SECTOR_BATTLEFIELD_BY_CODE[sectorCode]) return SECTOR_BATTLEFIELD_BY_CODE[sectorCode];
  if (type === 'siege') return 'settlement_airspace';
  if (type === 'hijack') return 'occupation_grid_airspace';
  if (SECTOR_BATTLEFIELD_BY_CODE[sectorCode]) return SECTOR_BATTLEFIELD_BY_CODE[sectorCode];
  if (type === 'pvp_duel') return 'shipyard_drydock';
  if (type === 'raid') return 'mining_site';
  if (type === 'event') return 'ancient_ruins';
  if (type === 'world_event') return 'convoy_route';
  if (/ice|polar|borealis|phlegra|빙|얼음/.test(sectorName)) return 'polar_ice';
  if (/forge|arsia|lava|volcan|용암|화산|대장간/.test(sectorName)) return 'lava_tube';
  if (/storm|dust|waste|arcadia|elysium|폭풍|먼지|황무지/.test(sectorName)) return 'dust_storm';
  if (/garrison|fort|citadel|주둔|요새/.test(sectorName)) return 'garrison_rooftop';
  if (/colony|dome|station|crossing|utopia|식민|돔|기지/.test(sectorName)) return 'settlement_airspace';
  if (/shipyard|drydock|dock|yard|조선|도크|정박/.test(sectorName)) return 'shipyard_drydock';
  if (/convoy|route|road|supply|수송|보급|항로/.test(sectorName)) return 'convoy_route';
  if (/ruin|ancient|relic|artifact|유적|고대|유물/.test(sectorName)) return 'ancient_ruins';
  if (/excavat|mine|field|sink|candor|syria|amazonis|채굴|굴착|광산|함몰/.test(sectorName)) return 'deep_mine';
  if (/crater|abyss|hellas|scar|relay|분화구|심연|상흔/.test(sectorName)) return 'crater_relay';
  if (/canyon|marineris|noctis|ridge|basin|협곡|능선|분지/.test(sectorName)) return 'canyon_outpost';
  if (/plain|flat|평원|평지/.test(sectorName)) return 'mining_site';
  if (sectorCode) {
    const match = sectorCode.match(/\d+/);
    if (match) return BATTLEFIELD_KEYS[parseInt(match[0], 10) % BATTLEFIELD_KEYS.length];
    return BATTLEFIELD_KEYS[_stableBattlefieldIndex(sectorCode)];
  }
  return BATTLEFIELD_KEYS[_stableBattlefieldIndex(battleId)];
}

var _battleRewardsHistoryOpen = false;
function toggleBattleRewardsHistory() {
  _battleRewardsHistoryOpen = !_battleRewardsHistoryOpen;
  var wrap = document.getElementById('battleRewardsHistoryWrap');
  if (!wrap) return;
  wrap.style.display = _battleRewardsHistoryOpen ? '' : 'none';
  if (_battleRewardsHistoryOpen) loadBattleRewardsHistory();
}

function loadBattleRewardsHistory() {
  var el = document.getElementById('battleRewardsHistoryContent');
  if (!el) return;
  if (!isLoggedIn()) {
    el.innerHTML = '<div style="text-align:center;color:var(--tx3);padding:6px">' + tl('Login required','로그인이 필요합니다','ログインが必要です','请先登录') + '</div>';
    return;
  }
  el.innerHTML = '<div style="text-align:center;color:var(--tx3);padding:6px">Loading...</div>';
  battleHubReadKeyed('rewards-mine', '/api/battles/rewards/mine?limit=20', 30000)
    .then(function(data) {
      if (!data) { el.innerHTML = '<div style="text-align:center;color:var(--tx3);padding:6px">' + tl('Please wait before refreshing.','잠시 후 다시 새로고침하세요.','少し待ってから更新してください。','请稍后再刷新。') + '</div>'; return; }
      if (data && data.error) { el.innerHTML = '<div style="text-align:center;color:var(--mars);padding:6px">' + data.error + '</div>'; return; }
      var rewards = (data && data.rewards) || [];
      var totalGp = (data && data.total_gp) || 0;
      if (!rewards.length) {
        el.innerHTML = '<div style="text-align:center;color:var(--tx3);padding:6px">' + tl('No battle rewards yet','전투 보상 이력 없음','戦闘報酬の履歴なし','暂无战斗奖励') + '</div>';
        return;
      }
      var html = '<div style="display:flex;justify-content:space-between;font-size:9px;color:var(--gold);font-weight:700;margin-bottom:5px">'
        + '<span>' + tl('MY BATTLE REWARDS','내 전투 보상','戦闘報酬','我的战斗奖励') + '</span>'
        + '<span>' + tl('Total','합계','合計','合计') + ' ' + Math.round(parseFloat(totalGp) || 0) + ' GP</span></div>';
      html += '<div style="font-size:9px;color:var(--tx2);line-height:1.8;max-height:160px;overflow-y:auto">';
      rewards.forEach(function(rw) {
        var won = rw.is_winner;
        var gp = Math.round(parseFloat(rw.gp_awarded) || 0);
        var bt = rw.battle_type || tl('battle','전투','戦闘','战斗');
        var when = rw.created_at ? _battleRewardTimeAgo(rw.created_at) : '';
        var minerals = '';
        try {
          var mo = (typeof rw.minerals_awarded === 'string') ? JSON.parse(rw.minerals_awarded) : (rw.minerals_awarded || {});
          var keys = Object.keys(mo || {});
          if (keys.length) minerals = ' · ' + keys.map(function(k){ return k + '×' + mo[k]; }).join(' ');
        } catch(_e) {}
        var bonus = '';
        try {
          var br = (typeof rw.breakdown === 'string') ? JSON.parse(rw.breakdown) : (rw.breakdown || {});
          if (br && br.sector_conflict_bonus) {
            bonus = ' <span style="color:#ffab40;border:1px solid rgba(255,171,64,.25);border-radius:3px;padding:1px 4px">'
              + tl('SECTOR +','섹터 +','セクター +','区 +') + Math.round(parseFloat(br.sector_conflict_bonus) || 0) + ' GP'
              + (br.sector_code ? ' · ' + escapeHtml(br.sector_code) : '')
              + '</span>';
          }
          if (br && br.alliance_treasury_bonus) {
            bonus += ' <span style="color:#80cbc4;border:1px solid rgba(128,203,196,.28);border-radius:3px;padding:1px 4px">'
              + tl('ALLY BANK +','동맹 금고 +','同盟金庫 +','联盟金库 +') + Math.round(parseFloat(br.alliance_treasury_bonus) || 0) + ' GP'
              + '</span>';
          }
          if (br && br.environment_salvage) {
            bonus += ' <span style="color:#7dd3fc;border:1px solid rgba(125,211,252,.28);border-radius:3px;padding:1px 4px">'
              + tl('FIELD SALVAGE','전장 회수','戦場回収','战场回收')
              + (br.battlefield_label ? ' · ' + escapeHtml(br.battlefield_label) : '')
              + '</span>';
          }
        } catch(_e2) {}
        var resultTag = won ? '<span style="color:var(--gold)">🏆 ' + tl('WIN','승','勝','胜') + '</span>' : '<span style="color:var(--tx3)">' + tl('LOSS','패','敗','败') + '</span>';
        html += '<div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid rgba(255,255,255,.05);padding:2px 0">'
          + '<span>' + resultTag + ' <span style="color:var(--tx3)">' + bt + (when ? ' · ' + when : '') + '</span>' + bonus + '</span>'
          + '<span style="color:var(--gold)">+' + gp + ' GP' + '<span style="color:var(--cyan)">' + minerals + '</span></span></div>';
      });
      html += '</div>';
      el.innerHTML = html;
    })
    .catch(function() {
      el.innerHTML = '<div style="text-align:center;color:var(--mars);padding:6px">Failed to load</div>';
    });
}

function _battleRewardTimeAgo(ts) {
  try {
    var diff = Date.now() - new Date(ts).getTime();
    if (isNaN(diff)) return '';
    var m = Math.floor(diff / 60000);
    if (m < 1) return tl('now','방금','たった今','刚刚');
    if (m < 60) return m + tl('m ago','분 전','分前','分钟前');
    var h = Math.floor(m / 60);
    if (h < 24) return h + tl('h ago','시간 전','時間前','小时前');
    return Math.floor(h / 24) + tl('d ago','일 전','日前','天前');
  } catch(_e) { return ''; }
}

async function openBattleHub() {
  if (!isLoggedIn()) { showFactionToast(t('daily_login_required')||tl('Login required','로그인이 필요합니다','ログインが必要です','请先登录'),'error'); return; }
  document.getElementById('battleHubModal').classList.add('active');
  await bhLoad();
  // Active battle list polling while the modal is open.
  if (battleHubState.pollTimer) _clearActiveInterval(battleHubState.pollTimer);
  battleHubState.pollTimer = _setActiveInterval(() => {
    if (_pageIsActive() && battleHubState.currentTab === 'active' && document.getElementById('battleHubModal').classList.contains('active')) bhLoad();
  }, 15000);
}

function closeBattleHub() {
  document.getElementById('battleHubModal').classList.remove('active');
  if (battleHubState.pollTimer) { _clearActiveInterval(battleHubState.pollTimer); battleHubState.pollTimer = null; }
}

function stopBattleTransientWork() {
  try {
    var hub = document.getElementById('battleHubModal');
    if (hub && hub.classList.contains('active')) closeBattleHub();
  } catch (_) {}
  try {
    var viewer = document.getElementById('battleViewer');
    if (viewer && viewer.classList.contains('active')) closeBattleViewer();
  } catch (_) {}
}
window.stopBattleTransientWork = stopBattleTransientWork;

function bhSwitchTab(tab) {
  battleHubState.currentTab = tab;
  document.querySelectorAll('.bh-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.tab === tab);
  });
  bhLoad();
}

async function bhLoad() {
  const tab = battleHubState.currentTab;
  const container = document.getElementById('battleListContent');
  const cacheKey = 'list:' + tab;
  if (!battleHubState.listCache[cacheKey]) {
    container.innerHTML = '<div class="bh-empty">' + (LANG==='ko'?'로딩 중...':LANG==='ja'?'読み込み中...':LANG==='zh'?'加载中...':'Loading...') + '</div>';
  }
  
  try {
    if (tab === 'killboard') {
      await bhLoadKillboard(container);
      return;
    }
    if (tab === 'ace') {
      await bhLoadAce(container);
      return;
    }

    let url = '';
    if (tab === 'active') url = '/api/battles/list/active';
    else if (tab === 'recent') url = '/api/battles/list/recent?limit=30';
    else url = '/api/battles/list/history?limit=30';
    
    let data = await battleHubReadFetch(cacheKey, url, tab === 'active' ? 10000 : 30000);
    if (!data && battleHubState.listCache[cacheKey]) data = battleHubState.listCache[cacheKey];
    if (!data) throw new Error('battle_list_unavailable');
    battleHubState.listCache[cacheKey] = data;
    const battles = data.battles || [];
    battles.forEach(rememberBattleContext);
    
    if (battles.length === 0) {
      container.innerHTML = `<div class="bh-empty">
        ${tab === 'active' ? (LANG==='ko'?'진행 중인 전투가 없습니다':LANG==='ja'?'進行中の戦闘がありません':LANG==='zh'?'没有进行中的战斗':'No active battles') : 
          tab === 'recent' ? (LANG==='ko'?'최근 전투가 없습니다':LANG==='ja'?'最近の戦闘がありません':LANG==='zh'?'没有最近的战斗':'No recent battles') : 
          (LANG==='ko'?'전투 기록이 없습니다':LANG==='ja'?'戦闘記録がありません':LANG==='zh'?'没有战斗记录':'No battle history')}
      </div>`;
      return;
    }
    
    container.innerHTML = battles.map(b => renderBattleCard(b, tab)).join('');
  } catch (err) {
    console.error('bhLoad error:', err);
    container.innerHTML = '<div class="bh-empty">' + (LANG==='ko'?'로딩 실패':LANG==='ja'?'読み込み失敗':LANG==='zh'?'加载失败':'Load failed') + '</div>';
  }
}

async function bhLoadKillboard(container) {
  const myWallet = getMyWallet();
  const cache = battleHubState.killboardCache || {};
  if (!cache.data) container.innerHTML = '<div class="bh-empty">' + (LANG==='ko'?'로딩 중...':LANG==='ja'?'読み込み中...':LANG==='zh'?'加载中...':'Loading...') + '</div>';
  const calls = [
    battleHubReadFetch('killboard-global', '/api/killboard?limit=40', 30000)
  ];
  if (myWallet) calls.push(battleHubReadFetch('killboard-mine', '/api/killboard/' + encodeURIComponent(myWallet) + '?limit=5', 30000));
  const results = await Promise.all(calls);
  const data = results[0] || cache.data || {};
  const mine = results[1] || cache.mine || null;
  battleHubState.killboardCache = { data: data, mine: mine };
  const kills = data.kills || [];
  const header = mine ? renderMyKillboardSummary(mine) : '';
  // [v7.412] YOUR LOSSES 피드 — killboard.js(/:wallet)가 recentLosses 를 이미 반환하는데 렌더 안 하던 것.
  //   손실회피→재건/복수 carve 루프 봉합(울트라코드 rank1). 백엔드 0변경·GP 0영향.
  const lossesFeed = mine ? renderMyLossesFeed(mine) : '';
  if (!kills.length) {
    container.innerHTML = header + lossesFeed + '<div class="bh-empty">' + tl('No kills recorded yet','아직 격침 기록이 없습니다','撃沈記録はまだありません','暂无击毁记录') + '</div>';
    return;
  }
  container.innerHTML = header + lossesFeed + '<div class="killboard-list">' + kills.map(renderKillmailCard).join('') + '</div>';
}

// ═══ ACE Pilot leaderboard (cosmetic honor ranking — GET /api/ace/leaderboard) ═══
var ACE_TITLE_LABELS_BH = {
  ace_recruit: { en: 'ACE RECRUIT', ko: '에이스 신병', ja: 'エース新兵', zh: '王牌新兵' },
  ace_pilot:   { en: 'ACE PILOT', ko: '에이스 파일럿', ja: 'エースパイロット', zh: '王牌飞行员' },
  ace_veteran: { en: 'ACE VETERAN', ko: '에이스 베테랑', ja: 'エースベテラン', zh: '王牌老兵' },
  top_gun:     { en: 'TOP GUN', ko: '톱건', ja: 'トップガン', zh: '头号王牌' },
  ace_ace:     { en: 'DOUBLE ACE', ko: '더블 에이스', ja: 'ダブルエース', zh: '双料王牌' }
};
function aceTitleLabelBH(code) {
  var m = ACE_TITLE_LABELS_BH[code];
  if (!m) return String(code || '').toUpperCase();
  return m[LANG] || m.en;
}

async function bhLoadAce(container) {
  const myWallet = getMyWallet();
  const calls = [ battleHubReadFetch('ace-leaderboard', '/api/ace/leaderboard?metric=kills&limit=40', 30000) ];
  if (myWallet) calls.push(battleHubReadFetch('ace-me', '/api/ace/me', 30000));
  let lb = null, me = null;
  try {
    const results = await Promise.all(calls);
    lb = results[0] || null;
    me = results[1] || null;
  } catch (_) { /* keep nulls → empty render */ }
  const rows = (lb && (lb.leaderboard || lb.rows || lb.pilots)) || [];
  const header = me ? renderAceMeSummary(me) : '';
  if (!rows.length) {
    container.innerHTML = header + '<div class="bh-empty">' + tl('No ACE pilots ranked yet','아직 에이스 파일럿 기록이 없습니다','エースパイロットの記録はまだありません','暂无王牌飞行员记录') + '</div>';
    return;
  }
  container.innerHTML = header + '<div class="killboard-list">' + rows.map(renderAcePilotRow).join('') + '</div>';
}

function renderAceMeSummary(me) {
  const s = (me && me.stats) || me || {};
  const rank = parseInt(me && me.rank, 10) || 0;
  const totalKills = parseInt(s.totalKills, 10) || parseInt(s.total_kills, 10) || 0;
  const totalWins = parseInt(s.totalWins, 10) || parseInt(s.total_wins, 10) || 0;
  const bestKills = parseInt(s.bestKills, 10) || parseInt(s.best_kills, 10) || 0;
  const runs = parseInt(s.totalRuns, 10) || parseInt(s.total_runs, 10) || 0;
  let nextHtml = '';
  const nt = me && me.nextTitle;
  if (nt && nt.code) {
    const cur = parseInt(nt.current, 10) || 0;
    const tgt = parseInt(nt.target, 10) || 0;
    const pct = tgt > 0 ? Math.max(0, Math.min(100, Math.round((cur / tgt) * 100))) : 0;
    nextHtml = '<div class="ace-next-title">'
      + '<div class="ace-next-row"><span>' + tl('Next title','다음 칭호','次の称号','下个称号') + '</span>'
      + '<b>✦ ' + escapeHtml(aceTitleLabelBH(nt.code)) + '</b><span>' + cur + ' / ' + tgt + '</span></div>'
      + '<div class="ace-next-bar"><div class="ace-next-fill" style="width:' + pct + '%"></div></div></div>';
  }
  return ''
    + '<div class="my-killboard-summary">'
    + '<div class="mks-title">✈ ' + (LANG==='ko'?'내 에이스 전적':LANG==='ja'?'自分のエース戦績':LANG==='zh'?'我的王牌战绩':'MY ACE RECORD') + '</div>'
    + '<div class="mks-stat"><b>' + (rank ? '#' + rank : '-') + '</b><span>RANK</span></div>'
    + '<div class="mks-stat"><b>' + formatNum(totalKills) + '</b><span>' + (LANG==='ko'?'누적 격추':LANG==='ja'?'通算撃墜':LANG==='zh'?'累计击落':'KILLS') + '</span></div>'
    + '<div class="mks-stat"><b>' + totalWins + '</b><span>' + (LANG==='ko'?'승':LANG==='ja'?'勝':LANG==='zh'?'胜':'WINS') + '</span></div>'
    + '<div class="mks-stat"><b>' + bestKills + '</b><span>' + (LANG==='ko'?'최고 격추':LANG==='ja'?'最高撃墜':LANG==='zh'?'最高击落':'BEST') + '</span></div>'
    + '<div class="mks-stat"><b>' + runs + '</b><span>' + (LANG==='ko'?'출격':LANG==='ja'?'出撃':LANG==='zh'?'出击':'RUNS') + '</span></div>'
    + '</div>'
    + nextHtml;
}

function renderAcePilotRow(p, idx) {
  const rank = parseInt(p && p.rank, 10) || (idx + 1);
  const name = p && (p.nickname || p.nick) ? (p.nickname || p.nick) : shortWallet(p && p.wallet);
  const kills = formatNum(parseInt(p && p.totalKills, 10) || parseInt(p && p.total_kills, 10) || 0);
  const wins = parseInt(p && p.totalWins, 10) || parseInt(p && p.total_wins, 10) || 0;
  const best = parseInt(p && p.bestKills, 10) || parseInt(p && p.best_kills, 10) || 0;
  const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : ('#' + rank);
  return ''
    + '<div class="killmail-card">'
    + '<div class="killmail-skull">' + medal + '</div>'
    + '<div class="killmail-main">'
    + '<div class="killmail-title"><b>' + escapeHtml(name) + '</b></div>'
    + '<div class="killmail-meta">'
    + '<span>✈ ' + (LANG==='ko'?'격추':LANG==='ja'?'撃墜':LANG==='zh'?'击落':'Kills') + ' ' + kills + '</span>'
    + '<span>🏆 ' + (LANG==='ko'?'승':LANG==='ja'?'勝':LANG==='zh'?'胜':'Wins') + ' ' + wins + '</span>'
    + (best ? '<span>★ ' + (LANG==='ko'?'최고':LANG==='ja'?'最高':LANG==='zh'?'最高':'Best') + ' ' + best + '</span>' : '')
    + '</div></div>'
    + '<div class="killmail-value"><b>' + kills + '</b><span>' + (LANG==='ko'?'격추':LANG==='ja'?'撃墜':LANG==='zh'?'击落':'KILLS') + '</span></div>'
    + '</div>';
}

// [v7.412] 내 최근 피격 함선 + 재건/복수 CTA. 이 파일의 inline onclick + escapeAttr 패턴에 맞춤.
function renderMyLossesFeed(m) {
  const losses = (m && m.recentLosses) || [];
  if (!losses.length) return '';
  const myWallet = (getMyWallet() || '').toLowerCase();
  const title = LANG==='ko'?'내 피해 — 재건 / 복수':LANG==='ja'?'被害記録 — 再建 / 報復':LANG==='zh'?'我的损失 — 重建 / 复仇':'YOUR LOSSES — Rebuild / Revenge';
  const destroyedWord = LANG==='ko'?'격침 by':LANG==='ja'?'撃沈 by':LANG==='zh'?'击毁 by':'lost to';
  const rebuildWord = LANG==='ko'?'⚒ 재건':LANG==='ja'?'⚒ 再建':LANG==='zh'?'⚒ 重建':'⚒ Rebuild';
  const revengeWord = LANG==='ko'?'⚔ 복수':LANG==='ja'?'⚔ 報復':LANG==='zh'?'⚔ 复仇':'⚔ Revenge';
  const unknownWord = LANG==='ko'?'불명':LANG==='ja'?'不明':LANG==='zh'?'未知':'unknown';
  const rows = losses.map(function(l){
    const ship = escapeHtml(l.ship_name || l.ship_type || 'Ship');
    const val = Math.max(0, parseInt(l.ship_value_gp, 10) || 0);
    const mods = Math.max(0, parseInt(l.mods, 10) || 0);
    const killerName = l.killer_wallet ? shortWallet(l.killer_wallet) : unknownWord;
    const when = formatShortTime(l.created_at);
    const canHunt = l.killer_wallet && String(l.killer_wallet).toLowerCase() !== myWallet;
    return '<div class="killmail-card loss">'
      + '<div class="killmail-skull">💥</div>'
      + '<div class="killmail-main"><div class="killmail-title"><b>' + ship + '</b> <span>' + destroyedWord + '</span> <b>' + escapeHtml(killerName) + '</b></div>'
      + '<div class="killmail-meta">' + (val ? '<span>' + formatNum(val) + ' GP</span>' : '') + (mods ? '<span>MOD +' + mods + '</span>' : '') + '<span>' + when + '</span></div></div>'
      + '<div class="killmail-value">'
      + '<button class="bc-btn primary" onclick="rebuildLostShip(\'' + escapeAttr(l.ship_type || '') + '\')">' + rebuildWord + '</button>'
      + (canHunt ? '<button class="bc-btn hunt" onclick="huntKillmailTarget(\'' + escapeAttr(l.killer_wallet) + '\',\'' + escapeAttr(killerName) + '\')">' + revengeWord + '</button>' : '')
      + '</div></div>';
  }).join('');
  return '<div class="my-losses-feed"><div class="mlf-title">🛡 ' + title + '</div>' + rows + '</div>';
}

// 재건: 잃은 함선 종류를 들고 조선소로(현재는 조선소 열기 — shipType 은 향후 사전선택용).
function rebuildLostShip(shipType) {
  try { if (typeof openShipyard === 'function') openShipyard(); } catch (_) {}
}

function renderMyKillboardSummary(m) {
  const kills = parseInt(m.kills, 10) || 0;
  const losses = parseInt(m.losses, 10) || 0;
  const destroyed = parseInt(m.destroyedValue, 10) || 0;
  const lost = parseInt(m.lostValue, 10) || 0;
  const best = parseInt(m.bestKillValue, 10) || 0;
  const kd = losses > 0 ? (kills / losses).toFixed(2) : (kills ? String(kills) : '0');
  return `
    <div class="my-killboard-summary">
      <div class="mks-title">${LANG==='ko'?'내 킬보드 전적':LANG==='ja'?'自分のキルボード':LANG==='zh'?'我的击毁榜':'MY KILLBOARD'}</div>
      <div class="mks-stat"><b>${kills}</b><span>KILLS</span></div>
      <div class="mks-stat"><b>${losses}</b><span>LOSSES</span></div>
      <div class="mks-stat"><b>${kd}</b><span>K/D</span></div>
      <div class="mks-stat"><b>${formatNum(destroyed)}</b><span>${LANG==='ko'?'파괴가치':LANG==='ja'?'破壊価値':LANG==='zh'?'摧毁价值':'DESTROYED'}</span></div>
      <div class="mks-stat"><b>${formatNum(lost)}</b><span>${LANG==='ko'?'손실가치':LANG==='ja'?'損失価値':LANG==='zh'?'损失价值':'LOST'}</span></div>
      <div class="mks-stat"><b>${formatNum(best)}</b><span>${LANG==='ko'?'최고 킬':LANG==='ja'?'最高キル':LANG==='zh'?'最高击毁':'BEST KILL'}</span></div>
    </div>
  `;
}

function renderKillmailCard(k) {
  const myWallet = (getMyWallet() || '').toLowerCase();
  const killer = k.killer_nick || shortWallet(k.killer_wallet);
  const victim = k.victim_nick || shortWallet(k.victim_wallet);
  const killerAlliance = renderKillmailAllianceTag(k, 'killer');
  const victimAlliance = renderKillmailAllianceTag(k, 'victim');
  const value = Math.max(0, parseInt(k.ship_value_gp, 10) || 0);
  const mods = Math.max(0, parseInt(k.mods, 10) || 0);
  const ship = k.ship_name || k.ship_type || 'Ship';
  const when = formatShortTime(k.created_at);
  const expired = k.expires_at && new Date(k.expires_at).getTime() <= Date.now();
  const canSalvage = myWallet && String(k.killer_wallet || '').toLowerCase() === myWallet && !k.salvaged_by && !expired;
  const salvaged = !!k.salvaged_by;
  const bountyGp = Math.max(0, Math.floor(Number(k.active_bounty_gp) || 0));
  const canClaimBounty = myWallet && String(k.killer_wallet || '').toLowerCase() === myWallet && bountyGp > 0 && k.battle_id && k.victim_wallet;
  const canHunt = myWallet && k.victim_wallet && String(k.victim_wallet).toLowerCase() !== myWallet;
  const salvageHint = formatKillmailSalvage(k.resources);
  const salvageTime = !salvaged && !expired ? formatWreckExpires(k.expires_at) : '';
  const salvageCta = salvageHint
    ? (LANG==='ko'?'회수':LANG==='ja'?'回収':LANG==='zh'?'回收':'Salvage') + ' · ' + salvageHint
    : (LANG==='ko'?'잔해 회수':LANG==='ja'?'残骸回収':LANG==='zh'?'回收残骸':'Salvage');
  return `
    <div class="killmail-card ${k.victim_is_betrayer ? 'betrayer' : ''}" data-wreck-id="${parseInt(k.id, 10) || 0}">
      <div class="killmail-skull">☠</div>
      <div class="killmail-main">
        <div class="killmail-title">
          <b>${escapeHtml(killer)}</b>${killerAlliance}
          <span>${LANG==='ko'?'격침':LANG==='ja'?'撃沈':LANG==='zh'?'击毁':'destroyed'}</span>
          <b>${escapeHtml(victim)}</b>${victimAlliance}
        </div>
        <div class="killmail-meta">
          <span>🚀 ${escapeHtml(ship)}</span>
          ${mods ? `<span>MOD +${mods}</span>` : ''}
          ${bountyGp ? `<span class="bounty-tag">💰 ${formatNum(bountyGp)} GP</span>` : ''}
          ${k.victim_is_betrayer ? `<span class="traitor-tag">${LANG==='ko'?'변절자':LANG==='ja'?'裏切り者':LANG==='zh'?'叛徒':'BETRAYER'}</span>` : ''}
          ${salvaged ? `<span>${LANG==='ko'?'회수완료':LANG==='ja'?'回収済':LANG==='zh'?'已回收':'SALVAGED'}</span>` : expired ? `<span>${LANG==='ko'?'잔해소멸':LANG==='ja'?'残骸消滅':LANG==='zh'?'残骸消失':'EXPIRED'}</span>` : ''}
          ${canSalvage ? `<span style="color:var(--gold)">🧲 ${LANG==='ko'?'회수 가능':LANG==='ja'?'回収可能':LANG==='zh'?'可回收':'SALVAGEABLE'}${salvageTime ? ' · ' + salvageTime : ''}</span>` : ''}
          ${salvageHint ? `<span>🧩 ${salvageHint}</span>` : ''}
          <span>${when}</span>
        </div>
      </div>
      <div class="killmail-value">
        <b>${formatNum(value)}</b>
        <span>GP ${LANG==='ko'?'파괴가치':LANG==='ja'?'破壊価値':LANG==='zh'?'摧毁价值':'destroyed'}</span>
        ${canHunt ? `<button class="bc-btn hunt" onclick="huntKillmailTarget('${escapeAttr(k.victim_wallet)}','${escapeAttr(victim)}')">${LANG==='ko'?'추격':LANG==='ja'?'追撃':LANG==='zh'?'追猎':'Hunt'}</button>` : ''}
        ${canClaimBounty ? `<button class="bc-btn bounty" onclick="claimKillmailBounty(${parseInt(k.battle_id, 10) || 0},'${escapeAttr(k.victim_wallet)}',this)">${LANG==='ko'?'현상금 청구':LANG==='ja'?'賞金請求':LANG==='zh'?'领取悬赏':'Claim Bounty'}</button>` : ''}
        ${canSalvage ? `<button class="bc-btn salvage" title="${escapeAttr(salvageHint || '')}" onclick="salvageKillmail(${parseInt(k.id, 10) || 0},this)">${salvageCta}</button>` : ''}
        ${k.battle_id ? `<button class="bc-btn primary" onclick="openBattleViewer(${parseInt(k.battle_id, 10)})">${LANG==='ko'?'리플레이':LANG==='ja'?'リプレイ':LANG==='zh'?'回放':'Replay'}</button>` : ''}
      </div>
    </div>
  `;
}

function renderKillmailAllianceTag(k, side) {
  const tag = k && k[side + '_alliance_tag'];
  const name = k && k[side + '_alliance_name'];
  if (!tag && !name) return '';
  const colorRaw = String((k && k[side + '_alliance_color']) || '#80cbc4');
  const color = /^#[0-9a-f]{3,8}$/i.test(colorRaw) ? colorRaw : '#80cbc4';
  const label = tag ? '[' + escapeHtml(tag) + ']' : escapeHtml(name || 'Alliance');
  return `<span title="${escapeAttr(name || tag || 'Alliance')}" style="margin-left:4px;font-size:8px;color:${color};border:1px solid ${color}66;background:${color}16;border-radius:4px;padding:1px 4px;font-family:var(--fn);font-weight:800">🛡 ${label}</span>`;
}

function formatKillmailSalvage(resources) {
  let src = resources;
  if (!src) return '';
  if (typeof src === 'string') {
    try { src = JSON.parse(src); } catch (_) { return ''; }
  }
  if (!src || typeof src !== 'object' || Array.isArray(src)) return '';
  const parts = Object.keys(src)
    .map(function(code){ return { code: code, qty: Math.floor(Number(src[code]) || 0) }; })
    .filter(function(x){ return x.qty > 0; })
    .slice(0, 3)
    .map(function(x){ return escapeHtml(x.code) + '×' + x.qty; });
  return parts.join(' · ');
}

function formatWreckExpires(isoStr) {
  if (!isoStr) return '';
  const t = new Date(isoStr).getTime();
  if (!Number.isFinite(t)) return '';
  const diffMin = Math.max(0, Math.ceil((t - Date.now()) / 60000));
  if (diffMin <= 0) return LANG==='ko'?'곧 만료':LANG==='ja'?'まもなく期限切れ':LANG==='zh'?'即将过期':'expires soon';
  if (diffMin < 60) return (LANG==='ko'?'만료 ':LANG==='ja'?'期限 ':LANG==='zh'?'到期 ':'expires in ') + diffMin + (LANG==='ko'?'분':LANG==='ja'?'分':LANG==='zh'?'分钟':'m');
  return (LANG==='ko'?'만료 ':LANG==='ja'?'期限 ':LANG==='zh'?'到期 ':'expires in ') + Math.floor(diffMin / 60) + 'h ' + (diffMin % 60) + 'm';
}

async function huntKillmailTarget(targetWallet, targetLabel) {
  targetWallet = String(targetWallet || '').trim();
  if (!targetWallet) return;
  if (!isLoggedIn()) {
    if (typeof showFactionToast === 'function') showFactionToast(tl('Login required','로그인이 필요합니다','ログインが必要です','请先登录'), 'error');
    return;
  }
  await openDeclareBattle();
  const modal = document.getElementById('declareBattleModal');
  if (!modal || !modal.classList.contains('active')) return;
  const input = document.getElementById('declareTargetSearch');
  if (input) input.value = targetWallet;
  await doSearchTargets();
  if (typeof showFactionToast === 'function') {
    showFactionToast((targetLabel || shortWallet(targetWallet)) + ' ' + (LANG==='ko'?'추격 검색':LANG==='ja'?'追撃検索':LANG==='zh'?'追猎搜索':'hunt search'), 'success');
  }
}
window.huntKillmailTarget = huntKillmailTarget;

async function claimKillmailBounty(battleId, targetWallet, btn) {
  if (!battleId || !targetWallet || (btn && btn.disabled)) return;
  if (btn) { btn.disabled = true; btn.textContent = '...'; }
  try {
    const res = await fetch('/api/bounty/claim', {
      method: 'POST',
      headers: Object.assign({ 'Content-Type': 'application/json' }, getAuthHeaders()),
      body: JSON.stringify({ battle_id: battleId, target_wallet: targetWallet }),
    });
    const data = await res.json().catch(function(){ return {}; });
    if (!res.ok || data.error) {
      if (btn) { btn.disabled = false; btn.textContent = LANG==='ko'?'청구 실패':LANG==='ja'?'請求失敗':LANG==='zh'?'领取失败':'Failed'; }
      if (typeof showFactionToast === 'function') showFactionToast(data.error || 'BOUNTY_CLAIM_FAILED', 'error');
      return;
    }
    const gp = Math.floor(Number(data.net_gp || data.total_gp) || 0);
    if (btn) { btn.classList.add('done'); btn.textContent = LANG==='ko'?'청구완료':LANG==='ja'?'請求済':LANG==='zh'?'已领取':'Claimed'; }
    if (typeof rewardBurst === 'function') rewardBurst({ text: '+' + formatNum(gp) + ' GP', tier: 2, sound: window._sfx && _sfx.hijackWin });
    if (typeof showFactionToast === 'function') showFactionToast('+' + formatNum(gp) + ' GP', 'success');
    try { if (typeof refreshBalance === 'function') refreshBalance(); } catch(_) {}
    try {
      if (battleHubState.currentTab === 'killboard' && document.getElementById('battleHubModal')?.classList.contains('active')) {
        _setActiveTimeout(bhLoad, 350);
      }
    } catch(_) {}
  } catch (e) {
    if (btn) { btn.disabled = false; btn.textContent = LANG==='ko'?'현상금 청구':LANG==='ja'?'賞金請求':LANG==='zh'?'领取悬赏':'Claim Bounty'; }
  }
}
window.claimKillmailBounty = claimKillmailBounty;

async function salvageKillmail(wreckId, btn) {
  if (!wreckId || (btn && btn.disabled)) return;
  if (btn) { btn.disabled = true; btn.textContent = '...'; }
  try {
    const res = await fetch('/api/killboard/' + encodeURIComponent(wreckId) + '/salvage', {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    const data = await res.json().catch(function(){ return {}; });
    if (!res.ok || data.error) {
      if (btn) { btn.disabled = false; btn.textContent = LANG==='ko'?'회수 실패':LANG==='ja'?'回収失敗':LANG==='zh'?'回收失败':'Failed'; }
      if (typeof showFactionToast === 'function') showFactionToast(data.error || 'SALVAGE_FAILED', 'error');
      return;
    }
    const drops = data.drops || [];
    const label = drops.length
      ? drops.map(function(d){ return d.code + '×' + d.quantity; }).join(' · ')
      : (LANG==='ko'?'회수 완료':LANG==='ja'?'回収済':LANG==='zh'?'已回收':'Salvaged');
    if (btn) {
      btn.classList.add('done');
      btn.textContent = LANG==='ko'?'회수완료':LANG==='ja'?'回収済':LANG==='zh'?'已回收':'Salvaged';
    }
    if (typeof rewardBurst === 'function') rewardBurst({ text: label, tier: drops.length > 2 ? 2 : 1, sound: window._sfx && _sfx.success });
    if (typeof showFactionToast === 'function') showFactionToast(label, 'success');
    try { if (typeof markDailyOpsAction === 'function') markDailyOpsAction('salvage_wreck'); } catch(_) {}
    try { if (typeof loadBaseInventory === 'function') loadBaseInventory(); } catch(_) {}
    try {
      if (battleHubState.currentTab === 'killboard' && document.getElementById('battleHubModal')?.classList.contains('active')) {
        _setActiveTimeout(bhLoad, 350);
      }
    } catch(_) {}
  } catch (e) {
    if (btn) { btn.disabled = false; btn.textContent = LANG==='ko'?'잔해 회수':LANG==='ja'?'残骸回収':LANG==='zh'?'回收残骸':'Salvage'; }
  }
}
window.salvageKillmail = salvageKillmail;

function shortWallet(w) {
  w = String(w || '').trim();
  return w ? w.slice(0, 6) + '...' + w.slice(-4) : 'Unknown';
}
function escapeAttr(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/'/g,'&#39;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function renderBattleCard(b, tab) {
  rememberBattleContext(b);
  const isLive = b.status === 'active';
  const isPreparing = b.status === 'preparing';
  const statusCls = isLive ? 'active' : isPreparing ? 'preparing' : 'ended';
  const statusLabel = isLive ? '● LIVE' : isPreparing ? (t('bc_waiting')||'Waiting') :
                      (b.winner_side === 'atk' ? (t('bc_atk_win')||'ATK WIN') : b.winner_side === 'def' ? (t('bc_def_win')||'DEF WIN') : (t('bv_draw_result')||'Draw'));

  const battleTypeMap = {
    'pvp_duel': t('bc_type_duel')||'PvP Duel',
    'siege': t('bc_type_siege')||'Siege',
    'hijack': t('bc_type_hijack')||'Hijacking',
    'raid': t('bc_type_raid')||'Raid',
    'event': t('bc_type_event')||'Event',
  };

  let resultClass = '';
  let resultLabel = '';
  if (tab === 'history' && b.my_result) {
    resultClass = 'result-' + b.my_result;
    resultLabel = b.my_result === 'win' ? (t('bv_my_victory')||'Victory') : b.my_result === 'loss' ? (t('bv_my_defeat')||'Defeat') : (t('bv_draw_result')||'Draw');
  }

  const timeInfo = isLive ? (t('bc_in_progress')||'In Progress') :
                   isPreparing ? `${t('bc_scheduled')||'Scheduled'}: ${formatShortTime(b.scheduled_start_at)}` :
                   formatShortTime(b.ended_at);
  const sectorLabel = b.sector_code ? (b.sector_name ? (b.sector_name + ' · ' + b.sector_code) : b.sector_code) : '';
  const battlefieldKey = b.battlefield_key || pickBattlefieldKey(b.id);
  const battlefieldLabel = b.battlefield_label || BATTLEFIELD_LABELS[battlefieldKey] || '';
  const battlefieldMods = formatBattlefieldModifiers(b.environment_modifiers);
  const battlefieldObjective = b.environment_objective || '';
  const battlefieldSalvage = formatBattlefieldSalvageHint(b.environment_salvage_hint);
  const battlefieldImage = battlefieldImageUrl(battlefieldKey);
  const economyTags = renderBattleEconomyTags(b, battlefieldKey);
  const rewardGp = Math.round(parseFloat(b.my_reward_gp != null ? b.my_reward_gp : b.reward_total_gp) || 0);
  const rewardCount = parseInt(b.reward_count, 10) || 0;
  const rewardLabel = rewardGp > 0
    ? `<span style="color:var(--gold)">🏅 ${LANG==='ko'?'보상':LANG==='ja'?'報酬':LANG==='zh'?'奖励':'Reward'} +${formatNum(rewardGp)} GP</span>`
    : rewardCount > 0
      ? `<span style="color:var(--tx3)">🏅 ${LANG==='ko'?'보상 지급':LANG==='ja'?'報酬済み':LANG==='zh'?'已发奖励':'Rewarded'}</span>`
      : '';
  
  return `
    <div class="battle-card ${isLive ? 'active-battle' : ''} ${resultClass}">
      <div class="bc-field-thumb" style="background-image:url('${escapeAttr(battlefieldImage)}')" title="${escapeAttr(battlefieldLabel || battlefieldKey)}"></div>
      <div class="bc-status ${statusCls}">${statusLabel}</div>
      <div class="bc-info">
        <div class="bc-info-title">
          ${battleTypeMap[b.battle_type] || b.battle_type}
          ${tab === 'history' && b.my_fleet_name ? ` · <span style="color:#4fc3f7">${escapeHtml(b.my_fleet_name)}</span>` : ''}
        </div>
        <div class="bc-info-meta">
          <span>⚔ <b>${b.atk_ships_total || b.atk_fleets || 0}</b>${LANG==='ko'?'척':LANG==='ja'?'隻':LANG==='zh'?'艘':'ships'}</span>
          <span>vs <b>${b.def_ships_total || b.def_fleets || 0}</b>${LANG==='ko'?'척':LANG==='ja'?'隻':LANG==='zh'?'艘':'ships'}</span>
          ${sectorLabel ? `<span style="color:#ffab40">⌖ ${escapeHtml(sectorLabel)}</span>` : ''}
          ${battlefieldLabel ? `<span style="color:#81d4fa">▣ ${escapeHtml(battlefieldLabel)}</span>` : ''}
          ${battlefieldMods ? `<span style="color:#a5d6a7">◇ ${escapeHtml(battlefieldMods)}</span>` : ''}
          ${battlefieldObjective ? `<span style="color:#c5e1ff">🎯 ${escapeHtml(battlefieldObjective)}</span>` : ''}
          ${battlefieldSalvage ? `<span style="color:#7dd3fc">🧲 ${escapeHtml(battlefieldSalvage)}</span>` : ''}
          ${economyTags}
          ${rewardLabel}
          ${b.duration_seconds ? `<span>⏱ <b>${Math.round(b.duration_seconds/60)}</b>${LANG==='ko'?'분':LANG==='ja'?'分':LANG==='zh'?'分':'min'}</span>` : ''}
          <span>${timeInfo}</span>
        </div>
      </div>
      <div class="bc-actions">
        ${(b.status === 'ended' || b.status === 'active')
          ? `<button class="bc-btn primary" onclick="openBattleViewer(${b.id})">${isLive ? (LANG==='ko'?'관전':LANG==='ja'?'観戦':LANG==='zh'?'观战':'Watch') : (LANG==='ko'?'리플레이':LANG==='ja'?'リプレイ':LANG==='zh'?'回放':'Replay')}</button>
             <button class="bc-btn" onclick="openAceCombat(${b.id})" title="ACE MODE">✈ ${LANG==='ko'?'에이스':LANG==='ja'?'エース':LANG==='zh'?'王牌':'ACE'}</button>`
          : `<button class="bc-btn" onclick="bhRunBattle(${b.id})">${LANG==='ko'?'즉시 시작':LANG==='ja'?'即時開始':LANG==='zh'?'立即开始':'Start Now'}</button>`
        }
      </div>
    </div>
  `;
}

async function bhRunBattle(battleId) {
  var ok=await gameConfirm({icon:'⚔',title:LANG==='ko'?'전투 즉시 시작':LANG==='ja'?'戦闘即時開始':LANG==='zh'?'立即开始战斗':'Start Battle Now',body:(LANG==='ko'?'전투 #':LANG==='ja'?'戦闘 #':LANG==='zh'?'战斗 #':'Battle #')+battleId+(LANG==='ko'?'을 지금 바로 시작합니다.':LANG==='ja'?'を今すぐ開始します。':LANG==='zh'?'将立即开始。':' will start immediately.'),confirmText:LANG==='ko'?'시작':LANG==='ja'?'開始':LANG==='zh'?'开始':'Start'});
  if(!ok) return;
  try {
    const res = await fetch(`/api/battles/${battleId}/run`, {
      method: 'POST', headers: getAuthHeaders()
    });
    const data = await res.json();
    if (!res.ok) { showFactionToast((LANG==='ko'?'실패: ':LANG==='ja'?'失敗: ':LANG==='zh'?'失败: ':'Failed: ') + (data.error || 'UNKNOWN'), 'error'); return; }
    showFactionToast(LANG==='ko'?'전투 시작됨':LANG==='ja'?'戦闘開始':LANG==='zh'?'战斗已开始':'Battle started', 'success');
    _setActiveTimeout(bhLoad, 1500);
  } catch (err) {
    showFactionToast(t('quests_network_error')||tl('Network error','네트워크 오류','ネットワークエラー','网络错误'),'error');
  }
}

function formatShortTime(isoStr) {
  if (!isoStr) return '-';
  const d = new Date(isoStr);
  const now = new Date();
  const diffMin = Math.floor((now - d) / 60000);
  if (diffMin < 0) return `${Math.abs(diffMin)}${LANG==='ko'?'분 후':LANG==='ja'?'分後':LANG==='zh'?'分后':' min later'}`;
  if (diffMin < 1) return LANG==='ko'?'방금':LANG==='ja'?'たった今':LANG==='zh'?'刚刚':'Just now';
  if (diffMin < 60) return `${diffMin}${LANG==='ko'?'분 전':LANG==='ja'?'分前':LANG==='zh'?'分前':' min ago'}`;
  if (diffMin < 1440) return `${Math.floor(diffMin/60)}${LANG==='ko'?'시간 전':LANG==='ja'?'時間前':LANG==='zh'?'小时前':' hr ago'}`;
  return `${Math.floor(diffMin/1440)}${LANG==='ko'?'일 전':LANG==='ja'?'日前':LANG==='zh'?'天前':' days ago'}`;
}

// ═════════════════════════════════════════════════════════════════
// Declare Battle Modal
// ═════════════════════════════════════════════════════════════════

let declareState = {
  myFleets: [],
  targetFleets: [],
  selectedTargetFleetId: null,
  sectorCode: '',
  sectorName: '',
  sectorTier: '',
};

// ─── Phase B: openDeclareBattle (추천 상대 + 실시간 검색) ───

function clearDeclareSectorContext() {
  declareState.sectorCode = '';
  declareState.sectorName = '';
  declareState.sectorTier = '';
  const el = document.getElementById('declareSectorContext');
  if (el) {
    el.style.display = 'none';
    el.innerHTML = '';
  }
}

function setDeclareSectorContext(sector) {
  const code = String((sector && (sector.code || sector.sector_code)) || '').trim();
  const name = String((sector && sector.name) || code || '').trim();
  const tier = String((sector && sector.tier) || '').trim();
  declareState.sectorCode = code;
  declareState.sectorName = name;
  declareState.sectorTier = tier;
  const el = document.getElementById('declareSectorContext');
  if (!el || !code) return;
  const title = LANG==='ko'?'섹터 작전':LANG==='ja'?'セクター作戦':LANG==='zh'?'区域行动':'Sector operation';
  const hint = LANG==='ko'?'해당 섹터 보유 함대를 우선 추천합니다':LANG==='ja'?'該当セクター保有艦隊を優先表示':LANG==='zh'?'优先推荐该区域舰队':'Prioritizing fleets tied to this sector';
  el.style.display = '';
  el.innerHTML = '<span>'+title+'</span><b>'+escapeHtml(name || code)+'</b><em>'+escapeHtml(code)+(tier ? ' · '+escapeHtml(tier.toUpperCase()) : '')+'</em><small>'+hint+'</small>';
}

async function openDeclareBattle(opts) {
  opts = opts || {};
  closeBattleHub();

  // 내 함대 로드
  try {
    const data = await battleHubReadKeyed('declare-fleets', '/api/fleets', 8000);
    declareState.myFleets = (data.fleets || []).filter(f => f.ships_alive > 0 && !f.is_in_battle);
  } catch { declareState.myFleets = []; }

  if (declareState.myFleets.length === 0) {
    showFactionToast(t('fleet_no_combat_fleet')||'No combat fleet', 'error');
    return;
  }

  const sel = document.getElementById('declareMyFleet');
  sel.innerHTML = declareState.myFleets.map(f =>
    `<option value="${f.id}">${escapeHtml(f.name)} (${f.ships_alive}${LANG==='ko'?'척':LANG==='ja'?'隻':LANG==='zh'?'艘':'ships'})</option>`
  ).join('');

  document.getElementById('declareTargetSearch').value = '';
  document.getElementById('declareTargetList').innerHTML =
    `<div class="bd-search-hint">${LANG==='ko'?'2자 이상 입력하면 검색됩니다':LANG==='ja'?'2文字以上入力すると検索されます':LANG==='zh'?'输入2字以上开始搜索':'Enter 2+ chars to search'}</div>`;
  declareState.selectedTargetFleetId = null;
  document.getElementById('declareConfirmBtn').disabled = true;
  if (opts.sector) setDeclareSectorContext(opts.sector);
  else clearDeclareSectorContext();

  document.getElementById('declareBattleModal').classList.add('active');

  // 추천 상대 로드 (Phase B)
  loadRecommendedOpponents();
}

window.openDeclareBattleForSector = async function(sector) {
  return openDeclareBattle({ sector: sector || {} });
};

window.openDeclareBattleWithFleet = async function(targetFleetId, nickname, shipsAlive, sectorCode, bountyGp, cpi) {
  await openDeclareBattle(sectorCode ? { sector: { code: sectorCode, name: sectorCode } } : {});
  const id = parseInt(targetFleetId, 10);
  if (!id) return;

  const label = nickname || (LANG==='ko'?'추천 타깃':LANG==='ja'?'推奨標的':LANG==='zh'?'推荐目标':'Recommended Target');
  const alive = Math.max(0, parseInt(shipsAlive, 10) || 0);
  const listEl = document.getElementById('declareTargetList');
  if (listEl) {
    listEl.innerHTML = renderSearchResult({
      fleet_id: id,
      nickname: label,
      fleet_name: LANG==='ko'?'분쟁 추천 함대':LANG==='ja'?'紛争推奨艦隊':LANG==='zh'?'争端推荐舰队':'Conflict Recommended Fleet',
      ships_alive: alive,
      sector_code: sectorCode || '',
      active_bounty_gp: Math.max(0, parseInt(bountyGp, 10) || 0),
      combat_power: Math.max(0, parseInt(cpi, 10) || 0),
      can_attack: true,
      battles_won: 0,
      battles_lost: 0
    });
  }
  selectTargetFleet(id, label, alive);
};

function closeDeclareBattle() {
  document.getElementById('declareBattleModal').classList.remove('active');
}

async function loadRecommendedOpponents() {
  try {
    const sector = String(declareState.sectorCode || '').trim();
    const url = '/api/fleets/search/opponents' + (sector ? ('?sector=' + encodeURIComponent(sector)) : '');
    const cacheKey = 'opponent-recommendations' + (sector ? (':' + sector) : '');
    const data = await battleHubReadKeyed(cacheKey, url, 10000);
    if (!data) return;
    const chips = document.getElementById('declareOpponentChips');
    if (!chips) return;

    if (!data.results || data.results.length === 0) {
      chips.innerHTML = '<span style="color:rgba(255,255,255,.3);font-size:9px">'+(LANG==='ko'?'추천 상대 없음':LANG==='ja'?'推奨対戦相手なし':LANG==='zh'?'无推荐对手':'No recommended opponents')+'</span>';
      return;
    }

    chips.innerHTML = data.results.slice(0, 6).map(r => {
      const alliance = renderDeclareOpponentAlliance(r);
      const fleetName = r.fleet_name && r.fleet_name !== r.nickname
        ? `<span style="opacity:.55;font-size:8px;margin-left:4px">${escapeHtml(r.fleet_name)}</span>`
        : '';
      return `
      <div class="bd-opponent-chip" data-action="selectTargetFleet" data-fleet-id="${escapeHTML(r.fleet_id)}" data-nickname="${escapeHTML(r.nickname || 'Unknown')}" data-ships-alive="${escapeHTML(r.ships_alive)}">
        ${escapeHtml(r.nickname || 'Unknown')}${alliance}${fleetName} (${r.ships_alive}척)
      </div>`;
    }).join('');
  } catch (err) {
    console.warn('loadRecommendedOpponents:', err);
  }
}

function renderDeclareOpponentAlliance(r) {
  const tag = r && r.alliance_tag;
  const name = r && r.alliance_name;
  if (!tag && !name) return '';
  const colorRaw = String((r && r.alliance_color) || '#80cbc4');
  const color = /^#[0-9a-f]{3,8}$/i.test(colorRaw) ? colorRaw : '#80cbc4';
  const label = tag ? '[' + escapeHtml(tag) + ']' : escapeHtml(name || 'Alliance');
  return `<span title="${escapeAttr(name || tag || 'Alliance')}" style="margin-left:4px;color:${color};font-size:8px;font-weight:800">🛡 ${label}</span>`;
}

function getSelectedDeclareFleet() {
  const sel = document.getElementById('declareMyFleet');
  const id = sel && sel.value;
  return (declareState.myFleets || []).find(function(f){ return String(f.id) === String(id); }) || (declareState.myFleets || [])[0] || null;
}

function fleetPowerEstimate(fleet) {
  if (!fleet) return 0;
  const direct = Number(fleet.combat_power || fleet.power || fleet.fleet_power || fleet.cpi);
  if (Number.isFinite(direct) && direct > 0) return Math.round(direct);
  const ships = Math.max(0, parseInt(fleet.ships_alive || fleet.ship_count || fleet.alive_ships, 10) || 0);
  const mods = Math.max(0, parseInt(fleet.total_mod_level || fleet.mods || fleet.mod_level, 10) || 0);
  return Math.round(ships * 90 + mods * 18);
}

function renderTargetMatchupIntel(r, targetPower, bountyGp, danger) {
  const myFleet = getSelectedDeclareFleet();
  const myPower = fleetPowerEstimate(myFleet);
  const targetShips = Math.max(0, parseInt(r.ships_alive, 10) || 0);
  const targetFallbackPower = targetPower || Math.round(targetShips * 90);
  const ratio = myPower > 0 ? targetFallbackPower / myPower : 0;
  let matchup = LANG==='ko'?'정보 부족':LANG==='ja'?'情報不足':LANG==='zh'?'信息不足':'UNKNOWN';
  let cls = 'mid';
  if (ratio > 0) {
    if (ratio >= 1.35) { matchup = LANG==='ko'?'불리':LANG==='ja'?'不利':LANG==='zh'?'劣势':'OUTGUNNED'; cls = 'high'; }
    else if (ratio >= 0.82) { matchup = LANG==='ko'?'동급':LANG==='ja'?'同格':LANG==='zh'?'同级':'EVEN MATCH'; cls = 'mid'; }
    else { matchup = LANG==='ko'?'우세':LANG==='ja'?'優勢':LANG==='zh'?'优势':'FAVORABLE'; cls = 'low'; }
  } else if (danger) {
    cls = danger;
  }
  const rewardMotive = bountyGp > 0
    ? (LANG==='ko'?'현상금 사냥':LANG==='ja'?'賞金狩り':LANG==='zh'?'悬赏狩猎':'Bounty hunt')
    : (r.sector_code
      ? (LANG==='ko'?'섹터 압박':LANG==='ja'?'セクター圧力':LANG==='zh'?'区域压制':'Sector pressure')
      : (LANG==='ko'?'전투 경험':LANG==='ja'?'戦闘経験':LANG==='zh'?'战斗经验':'Combat XP'));
  const myText = myPower > 0 ? formatNum(myPower) : '-';
  const targetText = targetFallbackPower > 0 ? formatNum(targetFallbackPower) : '-';
  return `
    <div class="bd-matchup-intel">
      <span class="bd-risk-tag ${cls}">⚖ ${matchup}</span>
      <span>${LANG==='ko'?'내 전력':LANG==='ja'?'自戦力':LANG==='zh'?'我方战力':'My power'} ${myText}</span>
      <span>${LANG==='ko'?'표적':LANG==='ja'?'標的':LANG==='zh'?'目标':'Target'} ${targetText}</span>
      <span>${rewardMotive}</span>
    </div>
  `;
}

// 검색 (디바운스)
let searchTimer;
function searchTargets() {
  _clearActiveTimeout(searchTimer);
  searchTimer = _setActiveTimeout(function(){
    searchTimer = null;
    doSearchTargets();
  }, 400);
}

async function doSearchTargets() {
  const q = document.getElementById('declareTargetSearch').value.trim();
  const listEl = document.getElementById('declareTargetList');

  if (q.length < 2) {
    listEl.innerHTML = `<div class="bd-search-hint">${LANG==='ko'?'2자 이상 입력':LANG==='ja'?'2文字以上入力':LANG==='zh'?'请输入2字以上':'Type 2+ chars'}</div>`;
    return;
  }

  listEl.innerHTML = `<div class="bd-search-hint">${LANG==='ko'?'검색 중...':LANG==='ja'?'検索中...':LANG==='zh'?'搜索中...':'Searching...'}</div>`;

  try {
    const res = await fetch(`/api/fleets/search?q=${encodeURIComponent(q)}`, {
      headers: getAuthHeaders()
    });
    const data = await res.json();

    if (!res.ok) {
      listEl.innerHTML = `<div class="bd-search-hint">${LANG==='ko'?'검색 실패':LANG==='ja'?'検索失敗':LANG==='zh'?'搜索失败':'Search failed'}: ${data.error || ''}</div>`;
      return;
    }

    if (!data.results || data.results.length === 0) {
      listEl.innerHTML = `<div class="bd-search-hint">${LANG==='ko'?'검색 결과 없음':LANG==='ja'?'検索結果なし':LANG==='zh'?'无搜索结果':'No results found'}</div>`;
      return;
    }

    listEl.innerHTML = data.results.map(r => renderSearchResult(r)).join('');
  } catch (err) {
    console.error('doSearchTargets:', err);
    listEl.innerHTML = `<div class="bd-search-hint">${LANG==='ko'?'네트워크 오류':LANG==='ja'?'ネットワークエラー':LANG==='zh'?'网络错误':'Network error'}</div>`;
  }
}

function renderSearchResult(r) {
  const factionIcon = { mcc:'⬢', fsp:'◉', cv:'▲' }[r.faction_code] || '?';
  const color = r.faction_color || '#fff';
  const isSelected = declareState.selectedTargetFleetId === r.fleet_id;
  const power = Math.max(0, parseInt(r.combat_power, 10) || 0);
  const bountyGp = Math.max(0, parseInt(r.active_bounty_gp, 10) || 0);
  const sectorCode = r.sector_code || '';
  const danger = power >= 1200 ? 'high' : power >= 450 ? 'mid' : 'low';
  const dangerLabel = danger === 'high'
    ? (LANG==='ko'?'고위험':LANG==='ja'?'高危険':LANG==='zh'?'高风险':'HIGH RISK')
    : danger === 'mid'
      ? (LANG==='ko'?'교전권':LANG==='ja'?'交戦圏':LANG==='zh'?'交战区':'CONTESTED')
      : (LANG==='ko'?'사냥감':LANG==='ja'?'獲物':LANG==='zh'?'猎物':'PREY');

  return `
    <div class="bd-search-card ${isSelected ? 'selected' : ''} ${!r.can_attack ? 'in-battle' : ''}"
         ${r.can_attack ? `data-action="selectTargetFleet" data-fleet-id="${escapeHTML(r.fleet_id)}" data-nickname="${escapeHTML(r.nickname || '')}" data-ships-alive="${escapeHTML(r.ships_alive)}"` : ''}>
      <div class="bd-search-faction" style="color:${color}">${factionIcon}</div>
      <div class="bd-search-info">
        <div class="bd-search-nick">${escapeHtml(r.nickname || 'Unknown')}</div>
        <div class="bd-search-meta">
          ${escapeHtml(r.fleet_name || (LANG==='ko'?'함대':LANG==='ja'?'艦隊':LANG==='zh'?'舰队':'Fleet'))} · ${LANG==='ko'?'전적':LANG==='ja'?'戦績':LANG==='zh'?'战绩':'Record'} ${r.battles_won || 0}W ${r.battles_lost || 0}L
          ${sectorCode ? ` · ${escapeHtml(sectorCode)}` : ''}
        </div>
        ${renderTargetMatchupIntel(r, power, bountyGp, danger)}
      </div>
      <div>
        <div class="bd-search-ships">${r.ships_alive}${LANG==='ko'?'척':LANG==='ja'?'隻':LANG==='zh'?'艘':'ships'}</div>
        ${power ? `<div class="bd-risk-tag ${danger}">⚡ ${formatNum(power)} · ${dangerLabel}</div>` : ''}
        ${bountyGp ? `<div class="bd-risk-tag mid">💰 ${formatNum(bountyGp)} GP</div>` : ''}
        ${r.is_in_battle ? `<div class="bd-search-battle-tag">${LANG==='ko'?'전투중':LANG==='ja'?'戦闘中':LANG==='zh'?'战斗中':'In Battle'}</div>` : ''}
      </div>
    </div>
  `;
}

function selectTargetFleet(fleetId, nickname, shipsAlive) {
  declareState.selectedTargetFleetId = fleetId;
  document.getElementById('declareConfirmBtn').disabled = false;
  document.querySelectorAll('.bd-search-card').forEach(c => c.classList.remove('selected'));
  showFactionToast(`${nickname} (${shipsAlive}${LANG==='ko'?'척':LANG==='ja'?'隻':LANG==='zh'?'艘':'ships'}) ${LANG==='ko'?'선택됨':LANG==='ja'?'選択されました':LANG==='zh'?'已选择':'selected'}`, 'success');
}

async function confirmDeclareBattle() {
  const myFleetId = parseInt(document.getElementById('declareMyFleet').value);
  const targetFleetId = declareState.selectedTargetFleetId;

  if (!myFleetId || !targetFleetId) {
    showFactionToast(LANG==='ko'?'함대 선택을 확인해주세요':LANG==='ja'?'艦隊の選択を確認してください':LANG==='zh'?'请确认舰队选择':'Please check fleet selection','error');
    return;
  }
  if (myFleetId === targetFleetId) {
    showFactionToast(LANG==='ko'?'자기 자신은 공격할 수 없습니다':LANG==='ja'?'自分を攻撃することはできません':LANG==='zh'?'无法攻击自己':'Cannot attack yourself','error');
    return;
  }

  var ok=await gameConfirm({icon:'⚔',title:LANG==='ko'?'전투 선언':LANG==='ja'?'戦闘宣言':LANG==='zh'?'宣战':'Declare Battle',body:LANG==='ko'?'선언 후 전술 지시(Commander Actions)를 선택할 수 있습니다.':LANG==='ja'?'宣言後に戦術指示(Commander Actions)を選択できます。':LANG==='zh'?'宣战后可选择战术指令(Commander Actions)。':'After declaring, you can choose tactical directives (Commander Actions).',confirmText:LANG==='ko'?'선언':LANG==='ja'?'宣言':LANG==='zh'?'宣战':'Declare'});
  if(!ok) return;

  try {
    const res = await fetch('/api/battles/declare-pvp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({
        my_fleet_id: myFleetId,
        target_fleet_id: targetFleetId,
        run_immediately: false,   // ← 지시 선택 후 별도로 /run 호출
      })
    });
    const data = await res.json().catch(function(){ return {}; });

    if (!res.ok) {
      const msgMap = {
        'MY_FLEET_NOT_FOUND': LANG==='ko'?'내 함대를 찾을 수 없음':LANG==='ja'?'自分の艦隊が見つかりません':LANG==='zh'?'找不到我的舰队':'My fleet not found',
        'MY_FLEET_IN_BATTLE': LANG==='ko'?'내 함대가 전투 중':LANG==='ja'?'自分の艦隊が戦闘中':LANG==='zh'?'我的舰队正在战斗中':'My fleet is in battle',
        'MY_FLEET_EMPTY': LANG==='ko'?'내 함대에 함선이 없음':LANG==='ja'?'自分の艦隊に艦船がありません':LANG==='zh'?'我的舰队没有舰船':'My fleet is empty',
        'TARGET_FLEET_NOT_FOUND': LANG==='ko'?'대상 함대를 찾을 수 없음':LANG==='ja'?'対象艦隊が見つかりません':LANG==='zh'?'找不到目标舰队':'Target fleet not found',
        'TARGET_IN_BATTLE': LANG==='ko'?'대상이 이미 전투 중':LANG==='ja'?'対象がすでに戦闘中':LANG==='zh'?'目标已在战斗中':'Target is already in battle',
        'TARGET_EMPTY': LANG==='ko'?'대상 함대가 비어있음':LANG==='ja'?'対象艦隊が空です':LANG==='zh'?'目标舰队为空':'Target fleet is empty',
        'CANNOT_ATTACK_OWN_FLEET': LANG==='ko'?'자기 함대는 공격 불가':LANG==='ja'?'自分の艦隊は攻撃不可':LANG==='zh'?'无法攻击自己的舰队':'Cannot attack own fleet',
      };
      showFactionToast(msgMap[data.error] || (LANG==='ko'?`오류: ${data.error}`:LANG==='ja'?`エラー: ${data.error}`:LANG==='zh'?`错误: ${data.error}`:`Error: ${data.error}`), 'error');
      return;
    }

    const battleId = parseInt(data.battle_id);
    if (!battleId) {
      console.warn('[battle] declare-pvp response missing battle_id:', data);
      showFactionToast(LANG==='ko'?'전투 생성 응답에 전투 ID가 없습니다':LANG==='ja'?'戦闘作成レスポンスに戦闘IDがありません':LANG==='zh'?'宣战响应缺少战斗ID':'Battle response missing battle ID','error');
      return;
    }
    closeDeclareBattle();
    openCmdActionsModal(battleId, targetFleetId);
  } catch (err) {
    console.error('confirmDeclareBattle error:', err);
    showFactionToast(t('quests_network_error')||tl('Network error','네트워크 오류','ネットワークエラー','网络错误'),'error');
  }
}

// ═════════════════════════════════════════════════════════════════
// Commander Actions — pre-battle directives
// ═════════════════════════════════════════════════════════════════

const caState = {
  battleId: null,
  targetFleetId: null,
  max: 2,
  cost: 50,
  selected: new Set(),       // action_type set
  shipTypes: null,           // cached blueprints list
};

async function openCmdActionsModal(battleId, targetFleetId){
  caState.battleId = battleId;
  caState.targetFleetId = targetFleetId;
  caState.selected.clear();

  // settings 로드 (허용값 표시)
  try {
    // 참고: 전용 설정 조회 API 없으니 기본값만 사용. 서버가 최종 판단.
    caState.max = 2; caState.cost = 50;
  } catch(_) {}
  document.getElementById('caMaxSel').textContent = caState.max;
  document.getElementById('caMaxSel2').textContent = caState.max;

  // UI 초기화
  document.querySelectorAll('#cmdActionsModal .ca-card').forEach(c => c.classList.remove('selected'));
  document.querySelectorAll('#cmdActionsModal .ca-params').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('#caDoctrines .ca-doctrine-btn').forEach(b => b.classList.remove('active'));
  caUpdateQuota();

  // focus_fire 대상 라벨
  const lbl = document.getElementById('caFocusTargetLabel');
  if (lbl) lbl.textContent = (LANG==='ko'?`적 함대 #${targetFleetId} 가 자동 지정됩니다`:LANG==='ja'?`敵艦隊 #${targetFleetId} が自動指定されます`:LANG==='zh'?`敌方舰队 #${targetFleetId} 自动指定`:`Enemy fleet #${targetFleetId} auto-assigned`);

  // reinforce 함선 셀렉트 로드 (blueprints)
  const sel = document.getElementById('caReinforceShip');
  if (sel && !caState.shipTypes) {
    try {
      const j = await battleHubReadKeyed('commander-ship-blueprints', '/api/ships/blueprints', 30000);
      caState.shipTypes = Array.isArray(j && j.ships) ? j.ships : [];
    } catch(_) { caState.shipTypes = []; }
  }
  if (sel) {
    sel.innerHTML = `<option value="">${LANG==='ko'?'-- 함선 선택 --':LANG==='ja'?'-- 艦船を選択 --':LANG==='zh'?'-- 选择舰船 --':'-- Select Ship --'}</option>` +
      (caState.shipTypes || []).filter(s => !s.locked)
        .map(s => `<option value="${s.code}">${s.code} (${s.size_class || ''})</option>`).join('');
  }

  document.getElementById('cmdActionsModal').classList.add('active');
}

function closeCmdActionsModal(){
  document.getElementById('cmdActionsModal').classList.remove('active');
}

function caToggle(actionType){
  const card = document.querySelector(`#cmdActionsModal .ca-card[data-action="${actionType}"]`);
  if (!card || card.classList.contains('locked')) return;
  const panel = document.getElementById('caParams_' + actionType);
  if (caState.selected.has(actionType)) {
    caState.selected.delete(actionType);
    card.classList.remove('selected');
    if (panel) panel.classList.remove('active');
  } else {
    if (caState.selected.size >= caState.max) {
      showFactionToast(`${LANG==='ko'?'최대':LANG==='ja'?'最大':LANG==='zh'?'最多':'Max'} ${caState.max}${LANG==='ko'?'개까지 선택':LANG==='ja'?'個まで選択':LANG==='zh'?'项可选':'items max'}`, 'error');
      return;
    }
    caState.selected.add(actionType);
    card.classList.add('selected');
    if (panel) panel.classList.add('active');
  }
  // 수동 조작 시 doctrine 하이라이트 해제
  document.querySelectorAll('#caDoctrines .ca-doctrine-btn.active').forEach(b => b.classList.remove('active'));
  caUpdateQuota();
}

function caUpdateQuota(){
  const n = caState.selected.size;
  document.getElementById('caSelectedN').textContent = n;
  document.getElementById('caTotalCost').textContent = (n * caState.cost);
}

// ─── Doctrines (원클릭 프리셋) ───
const CA_DOCTRINES = {
  alpha_strike: {
    name: 'Alpha Strike',
    actions: ['focus_fire', 'wedge'],
    params: {},
    desc: LANG==='ko'?'집중 타격 + 돌격 전술':LANG==='ja'?'集中攻撃 + 突撃戦術':LANG==='zh'?'集中打击 + 突击战术':'Focus fire + charge tactics',
  },
  emp_ambush: {
    name: 'EMP Ambush',
    actions: ['emp', 'focus_fire'],
    params: { empTick: 800 },
    desc: LANG==='ko'?'EMP 무력화 후 집중 공격':LANG==='ja'?'EMP無力化後集中攻撃':LANG==='zh'?'EMP瘫痪后集中攻击':'EMP then focus fire',
  },
  drone_swarm: {
    name: 'Drone Swarm',
    actions: ['reinforce'],
    params: { reinforceSize: 'frigate', reinforceCount: 20 },
    desc: LANG==='ko'?'소형함 20척 대량 투입':LANG==='ja'?'小型艦20隻大量投入':LANG==='zh'?'大量投入20艘小型舰':'Deploy 20 small ships en masse',
  },
  shield_wall: {
    name: 'Shield Wall',
    actions: ['reinforce'],
    params: { reinforceSize: 'cruiser', reinforceCount: 10 },
    desc: LANG==='ko'?'중형함 10척 방벽 구축':LANG==='ja'?'中型艦10隻防壁構築':LANG==='zh'?'10艘中型舰构筑防线':'Build a wall with 10 cruisers',
  },
  blitzkrieg: {
    name: 'Blitzkrieg',
    actions: ['wedge', 'emp'],
    params: { empTick: 600 },
    desc: LANG==='ko'?'초반 돌격 + 조기 EMP':LANG==='ja'?'序盤突撃 + 早期EMP':LANG==='zh'?'初期突击 + 早期EMP':'Early charge + early EMP',
  },
  sniper: {
    name: 'Sniper',
    actions: ['focus_fire'],
    params: {},
    desc: LANG==='ko'?'단일 표적 저격 (GP 절약)':LANG==='ja'?'単一目標狙撃 (GP節約)':LANG==='zh'?'单目标狙击 (节省GP)':'Single-target snipe (saves GP)',
  },
};

function caApplyPreset(docKey){
  const doc = CA_DOCTRINES[docKey];
  if (!doc) return;

  // 이전 선택 완전 초기화
  caState.selected.clear();
  document.querySelectorAll('#cmdActionsModal .ca-card').forEach(c => c.classList.remove('selected'));
  document.querySelectorAll('#cmdActionsModal .ca-params').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('#caDoctrines .ca-doctrine-btn').forEach(b => b.classList.remove('active'));

  // 이 프리셋 버튼 활성화
  const btn = document.querySelector(`#caDoctrines .ca-doctrine-btn[data-doc="${docKey}"]`);
  if (btn) btn.classList.add('active');

  // 각 액션 토글
  const actions = doc.actions.slice(0, caState.max);
  for (const type of actions) {
    caState.selected.add(type);
    const card = document.querySelector(`#cmdActionsModal .ca-card[data-action="${type}"]`);
    if (card) card.classList.add('selected');
    const panel = document.getElementById('caParams_' + type);
    if (panel) panel.classList.add('active');
  }

  // 파라미터 자동 설정
  if (doc.params.empTick !== undefined) {
    const el = document.getElementById('caEmpTick');
    if (el) el.value = doc.params.empTick;
  }
  if (doc.params.reinforceSize) {
    // blueprints 중 size_class 가 맞는 첫 번째 unlocked 함선 선택
    const sel = document.getElementById('caReinforceShip');
    if (sel && caState.shipTypes) {
      const match = caState.shipTypes.find(s => !s.locked && s.size_class === doc.params.reinforceSize);
      if (match) sel.value = match.code;
      else if (caState.shipTypes[0] && !caState.shipTypes[0].locked) sel.value = caState.shipTypes[0].code;
    }
    const cntEl = document.getElementById('caReinforceCount');
    if (cntEl && doc.params.reinforceCount) cntEl.value = doc.params.reinforceCount;
  }

  caUpdateQuota();
  showFactionToast(`📜 ${doc.name} — ${doc.desc}`, 'success');
}
window.caApplyPreset = caApplyPreset;

async function caSkipAndFight(){
  if (!caState.battleId) return;
  closeCmdActionsModal();
  await caStartBattle(caState.battleId);
}

async function caApplyAndFight(){
  if (!caState.battleId) { closeCmdActionsModal(); return; }
  if (caState.selected.size === 0) { return caSkipAndFight(); }

  const btn = document.getElementById('caApplyBtn');
  if (btn) { btn.disabled = true; btn.textContent = LANG==='ko'?'적용 중...':LANG==='ja'?'適用中...':LANG==='zh'?'应用中...':'Applying...'; }

  try {
    const battleId = caState.battleId;
    const actions = [];

    for (const type of caState.selected) {
      const params = {};
      if (type === 'focus_fire') {
        params.targetFleetId = caState.targetFleetId;
      } else if (type === 'emp') {
        const t = parseInt(document.getElementById('caEmpTick').value);
        params.startTick = Number.isFinite(t) ? t : 1200;
      } else if (type === 'reinforce') {
        const code = (document.getElementById('caReinforceShip').value || '').trim();
        const cnt = parseInt(document.getElementById('caReinforceCount').value);
        if (!code) { showFactionToast(LANG==='ko'?'증원 함선을 선택하세요':LANG==='ja'?'増援艦船を選択してください':LANG==='zh'?'请选择增援舰船':'Select a reinforcement ship','error'); if (btn){btn.disabled=false;btn.textContent=(LANG==='ko'?'⚡ 지시 적용 & 전투':LANG==='ja'?'⚡ 指示適用 & 戦闘':LANG==='zh'?'⚡ 应用指令 & 战斗':'⚡ Apply & Fight');} return; }
        if (!cnt || cnt < 1 || cnt > 20) { showFactionToast(LANG==='ko'?'함선 수 1~20':LANG==='ja'?'艦船数 1~20':LANG==='zh'?'舰船数量 1~20':'Ship count 1~20','error'); if (btn){btn.disabled=false;btn.textContent=(LANG==='ko'?'⚡ 지시 적용 & 전투':LANG==='ja'?'⚡ 指示適用 & 戦闘':LANG==='zh'?'⚡ 应用指令 & 战斗':'⚡ Apply & Fight');} return; }
        params.shipTypeCode = code;
        params.count = cnt;
      }
      actions.push({ action_type: type, params });
    }

    // 순차 POST (실패 시 즉시 중단)
    for (const a of actions) {
      const r = await fetch(`/api/battles/${battleId}/commander-action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify(a),
      });
      const j = await r.json().catch(()=>({}));
      if (!r.ok) {
        const msgMap = {
          INSUFFICIENT_GP: LANG==='ko'?'GP 부족':LANG==='ja'?'GP不足':LANG==='zh'?'GP不足':'Insufficient GP',
          ACTION_QUOTA_EXCEEDED: LANG==='ko'?'지시 개수 초과':LANG==='ja'?'指示数超過':LANG==='zh'?'指令数量超限':'Action quota exceeded',
          ACTION_ALREADY_DECLARED: LANG==='ko'?'이미 선언된 지시':LANG==='ja'?'すでに宣言された指示':LANG==='zh'?'已声明的指令':'Action already declared',
          COMMANDER_ACTIONS_DISABLED: LANG==='ko'?'현재 비활성':LANG==='ja'?'現在無効':LANG==='zh'?'当前已禁用':'Currently disabled',
          TARGET_FLEET_ALLY: LANG==='ko'?'대상이 아군':LANG==='ja'?'対象が味方':LANG==='zh'?'目标是友军':'Target is ally',
          SHIP_TYPE_NOT_FOUND: LANG==='ko'?'함선 코드 없음':LANG==='ja'?'艦船コードなし':LANG==='zh'?'找不到舰船代码':'Ship type not found',
          BATTLE_NOT_ACCEPTING_ACTIONS: LANG==='ko'?'전투가 이미 진행 중':LANG==='ja'?'戦闘はすでに進行中':LANG==='zh'?'战斗已经开始':'Battle already in progress',
        };
        showFactionToast(`${a.action_type}: ${msgMap[j.error] || j.error || (LANG==='ko'?'실패':LANG==='ja'?'失敗':LANG==='zh'?'失败':'Failed')}`, 'error');
        if (btn){btn.disabled=false;btn.textContent=(LANG==='ko'?'⚡ 지시 적용 & 전투':LANG==='ja'?'⚡ 指示適用 & 戦闘':LANG==='zh'?'⚡ 应用指令 & 战斗':'⚡ Apply & Fight');}
        return;
      }
    }

    closeCmdActionsModal();
    showFactionToast(`${actions.length}` + (LANG==='ko'?'개 지시 적용 · 시뮬레이션 중...':LANG==='ja'?'個の指示適用中 · シミュレーション中...':LANG==='zh'?'个指令已应用 · 模拟中...':' actions applied · Simulating...'), 'success');
    await caStartBattle(battleId);
  } catch (err) {
    console.error('caApplyAndFight error:', err);
    showFactionToast(t('quests_network_error')||tl('Network error','네트워크 오류','ネットワークエラー','网络错误'),'error');
    if (btn){btn.disabled=false;btn.textContent=(LANG==='ko'?'⚡ 지시 적용 & 전투':LANG==='ja'?'⚡ 指示適用 & 戦闘':LANG==='zh'?'⚡ 应用指令 & 战斗':'⚡ Apply & Fight');}
  }
}

async function caStartBattle(battleId){
  try {
    const r = await fetch(`/api/battles/${battleId}/run`, {
      method: 'POST', headers: getAuthHeaders()
    });
    const j = await r.json().catch(()=>({}));
    if (!r.ok) {
      showFactionToast((LANG==='ko'?'전투 시작 실패: ':LANG==='ja'?'戦闘開始失敗: ':LANG==='zh'?'战斗开始失败: ':'Battle start failed: ') + (j.error || 'UNKNOWN'), 'error');
      return;
    }
    showFactionToast(LANG==='ko'?'전투 시작 · 잠시 후 관전 창이 열립니다':LANG==='ja'?'戦闘開始 · まもなく観戦画面が開きます':LANG==='zh'?'战斗开始 · 稍后将打开观战窗口':'Battle started · Spectator view will open shortly','success');
    markBattleDailyOpsOnce(battleId, 'battle_participate');
    _setActiveTimeout(() => openBattleViewer(battleId), 3000);
    _setActiveTimeout(() => showRewardIfAny(battleId), 8000);
  } catch (err) {
    console.error('caStartBattle error:', err);
    showFactionToast(t('quests_network_error')||tl('Network error','네트워크 오류','ネットワークエラー','网络错误'),'error');
  }
}

// expose for inline handlers
window.caToggle = caToggle;
window.caSkipAndFight = caSkipAndFight;
window.caApplyAndFight = caApplyAndFight;
window.closeCmdActionsModal = closeCmdActionsModal;

// ─── Phase B: 보상 토스트 ───

async function showRewardIfAny(battleId) {
  try {
    const data = await battleHubReadKeyed('battle-rewards:' + battleId, `/api/battles/${battleId}/rewards`, 10000);
    if (!data) return;

    const myWallet = getMyWallet();
    if (!myWallet) return;

    const myReward = (data.rewards || []).find(r =>
      r.wallet_address.toLowerCase() === myWallet.toLowerCase()
    );
    if (!myReward) return;
    if (!myReward.gp_awarded && !Object.keys(myReward.minerals_awarded || {}).length) return;

    markBattleDailyOpsOnce(battleId, 'battle_participate');
    if (myReward.is_winner) markBattleDailyOpsOnce(battleId, 'battle_win');
    showRewardToast(myReward);
    if (myReward.is_winner) { try { _showVictorySlot(battleId); } catch(_) {} }
  } catch (err) {
    console.warn('showRewardIfAny:', err);
  }
}

function markBattleDailyOpsOnce(battleId, type) {
  if (!battleId || !type || typeof markDailyOpsAction !== 'function') return;
  try {
    var w = (getMyWallet() || 'guest').toLowerCase();
    var key = 'battle_ops_marked_' + w + '_' + battleId + '_' + type;
    if (localStorage.getItem(key)) return;
    localStorage.setItem(key, '1');
    markDailyOpsAction(type, 1);
  } catch(_) {}
}
// (도파민 #4 v7.392) 승리 슬롯 — Sink 풀에서 추가 GP. 승자만 전투당 1회.
async function _showVictorySlot(battleId) {
  try {
    var st = await battleHubReadKeyed('victory-slot:' + battleId, '/api/battles/'+battleId+'/victory-slot', 10000);
    if (!st || !st.enabled || !st.eligible || st.spun || !(st.pool > 0)) return;
    var items = document.getElementById('rewardToastItems');
    if (!items) return;
    var btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'vslot-btn';
    btn.innerHTML = '🎰 ' + (LANG==='ko'?'승리 슬롯 — 스핀!':LANG==='ja'?'勝利スロット — スピン!':LANG==='zh'?'胜利老虎机 — 旋转!':'VICTORY SLOT — SPIN!') + '<span style="display:block;font-size:8px;opacity:.75;margin-top:1px">'+(LANG==='ko'?'풀':'Pool')+' ' + st.pool + ' GP</span>';
    btn.onclick = function(){ _spinVictorySlot(battleId, btn); };
    items.appendChild(btn);
  } catch (_) {}
}
async function _spinVictorySlot(battleId, btn) {
  if (btn.disabled) return; btn.disabled = true;
  var reel = ['🍒','💎','⚡','🌟','7️⃣','💰'];
  var spinner = _setActiveInterval(function(){ btn.textContent = '🎰 ' + reel[Math.floor(Math.random()*6)] + reel[Math.floor(Math.random()*6)] + reel[Math.floor(Math.random()*6)]; }, 80);
  try { if (window._sfx) _sfx.crateCharge(); } catch(_) {}
  var r = await fetch('/api/battles/'+battleId+'/victory-slot', { method:'POST', headers: getAuthHeaders() }).then(function(x){ return x.json(); }).catch(function(){ return {error:'net'}; });
  await _activeSleep(1100);
  _clearActiveInterval(spinner);
  if (r && r.success) {
    var won = r.payout > 0;
    btn.innerHTML = '🎰 ' + (won ? ('×'+r.multiplier+' → +'+r.payout+' GP!') : (LANG==='ko'?'꽝!':LANG==='ja'?'ハズレ!':LANG==='zh'?'未中!':'MISS!'));
    btn.style.background = won ? 'linear-gradient(135deg,#ffd166,#ff9a55)' : 'rgba(255,255,255,.06)';
    btn.style.color = won ? '#2a1800' : 'var(--tx3)';
    if (won) {
      rewardBurst({ text:'×'+r.multiplier+'  +'+r.payout+' GP', tier: r.multiplier>=5?3:r.multiplier>=2?2:1, sound: window._sfx && (r.multiplier>=5?_sfx.levelUp:_sfx.success) });
      try { refreshBalance && refreshBalance(); } catch(_) {}
      try { refreshEmailBalances && refreshEmailBalances(); } catch(_) {}
    } else { try { if (window._sfx) _sfx.error(); } catch(_) {} }
  } else {
    btn.innerHTML = '🎰 ' + (LANG==='ko'?'스핀 실패':LANG==='ja'?'スピン失敗':LANG==='zh'?'旋转失败':'Spin failed');
  }
}

// (도파민 v7.387) 공통 보상 연출 — 숫자 팝 + tier별 사운드/플래시. 경제중립(연출만, 보상량/드롭률 무변).
//   reduced-motion이면 파티클·플래시 생략(사운드만). DOM 1개만 생성 후 자동 제거(repaint 절약).
function rewardBurst(opts) {
  opts = opts || {};
  var tier = opts.tier || 0;
  try { if (opts.sound) opts.sound(); } catch(_) {}
  try {
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    var colors = ['#cfeaff', '#7ee787', '#ffd54f', '#ff9a55'];
    var x = (typeof opts.x === 'number') ? opts.x : (window.innerWidth / 2);
    var y = (typeof opts.y === 'number') ? opts.y : Math.round(window.innerHeight * 0.40);
    var el = document.createElement('div');
    el.className = 'reward-burst' + (tier >= 3 ? ' t3' : tier === 2 ? ' t2' : '');
    el.style.left = x + 'px'; el.style.top = y + 'px';
    el.style.color = colors[Math.min(3, tier)] || colors[0];
    el.textContent = opts.text || '';
    document.body.appendChild(el);
    if (tier >= 3) {
      var fl = document.createElement('div'); fl.className = 'reward-flash';
      document.body.appendChild(fl);
      setTimeout(function(){ try{ fl.remove(); }catch(_){} }, 640);
    }
    setTimeout(function(){ try{ el.remove(); }catch(_){} }, 1400);
  } catch(_) {}
}
// 광물 희귀 tier(연출 등급) — 채굴 잭팟감용. 보상량과 무관(연출만).
var _RESOURCE_TIER = {
  dark_matter:3, quantum_core:3, exotic_alloy:3, ancient_metal:3, xenomatter:3, meteorite_fragment:3, plasma_dust:3,
  titanium_alloy:2, plasma_crystal:2, nano_polymer:2,
  ice_crystal:1, volcanic_shard:1, hull_plate:1, plasma_coil:1, alloy_frame:1
};
function _resourceTier(code){ return _RESOURCE_TIER[code] || 0; }
function battleRewardNextStep(reward, breakdown, mineralsAwarded) {
  const minerals = mineralsAwarded || {};
  const hasMinerals = Object.keys(minerals).some(code => !!minerals[code]);
  const gp = Math.round(parseFloat(reward && reward.gp_awarded) || 0);
  if (breakdown && breakdown.sector_conflict_bonus) {
    const code = breakdown.sector_code ? (' · ' + escapeHtml(breakdown.sector_code)) : '';
    return LANG==='ko'?'분쟁 섹터 보너스가 붙었습니다'+code+'. 같은 섹터의 현상금/공성 표적을 이어서 치면 GP 효율이 좋습니다.'
      : LANG==='ja'?'紛争セクターボーナスが付きました'+code+'。同セクターの賞金/攻城標的を続けるとGP効率が良いです。'
      : LANG==='zh'?'获得争端区奖励'+code+'。继续攻击同区悬赏/攻城目标可提高GP效率。'
      : 'Conflict sector bonus landed'+code+'. Keep hitting bounty or siege targets in this sector for better GP efficiency.';
  }
  if (breakdown && breakdown.environment_salvage) {
    const salvage = breakdown.environment_salvage || {};
    const res = salvage.resource_code ? escapeHtml(salvage.resource_code) : '';
    return LANG==='ko'?'이 전장은 회수 자원이 나옵니다'+(res?' ('+res+')':'')+'. 같은 배경 전투를 반복해 제작 재료를 모으세요.'
      : LANG==='ja'?'この戦場は回収資源があります'+(res?' ('+res+')':'')+'。同系統の戦場を周回して素材を集めましょう。'
      : LANG==='zh'?'该战场会掉落回收资源'+(res?' ('+res+')':'')+'。重复同类战场收集制造材料。'
      : 'This battlefield drops salvage'+(res?' ('+res+')':'')+'. Repeat this battlefield type to farm crafting materials.';
  }
  if (breakdown && breakdown.alliance_treasury_bonus) {
    return LANG==='ko'?'동맹 금고 보너스가 발생했습니다. 길드/동맹 전투에 묶어서 반복하면 집단 성장 효율이 큽니다.'
      : LANG==='ja'?'同盟金庫ボーナスが発生しました。ギルド/同盟戦と連動して周回すると集団成長効率が高いです。'
      : LANG==='zh'?'触发联盟金库分红。配合公会/联盟战重复作战可提升集体成长效率。'
      : 'Alliance treasury bonus triggered. Chain these fights with guild/alliance wars for stronger group progression.';
  }
  if (hasMinerals) {
    return LANG==='ko'?'광물을 획득했습니다. 조선소에서 부족 재료를 확인하고 다음 채굴/전투 목표를 맞추세요.'
      : LANG==='ja'?'鉱物を獲得しました。造船所で不足素材を確認し、次の採掘/戦闘目標を合わせましょう。'
      : LANG==='zh'?'获得矿物。去船坞确认缺口，再选择下个采矿/战斗目标。'
      : 'Minerals acquired. Check shipyard material gaps and pick the next mining or battle target.';
  }
  if (reward && reward.is_winner && gp > 0) {
    return LANG==='ko'?'승리 GP를 확보했습니다. 바로 수리/보급 후 고가치 표적으로 연승을 이어가세요.'
      : LANG==='ja'?'勝利GPを獲得。修理/補給後すぐ高価値標的へ連勝を狙いましょう。'
      : LANG==='zh'?'已获得胜利GP。修理补给后继续挑战高价值目标。'
      : 'Victory GP secured. Repair and resupply, then chain into higher-value targets.';
  }
  return LANG==='ko'?'참가 보상이 누적됩니다. 낮은 위험 표적으로 함대 생존율을 올린 뒤 상위 전장에 진입하세요.'
    : LANG==='ja'?'参加報酬は積み上がります。低リスク標的で艦隊生存率を上げて上位戦場へ。'
    : LANG==='zh'?'参与奖励可累积。先用低风险目标提高舰队存活率，再进入高阶战场。'
    : 'Participation rewards stack. Build fleet survival on lower-risk targets, then move into higher-tier battlefields.';
}
function showRewardToast(reward) {
  const title = document.getElementById('rewardToastTitle');
  const items = document.getElementById('rewardToastItems');

  title.textContent = reward.is_winner ? (LANG==='ko'?'🏆 승리 보상!':LANG==='ja'?'🏆 勝利報酬!':LANG==='zh'?'🏆 胜利奖励!':'🏆 Victory Reward!') : (LANG==='ko'?'🎖 참가 보상':LANG==='ja'?'🎖 参加報酬':LANG==='zh'?'🎖 参与奖励':'🎖 Participation Reward');

  let html = '';
  let breakdown = {};
  if (reward.gp_awarded > 0) {
    html += `<div class="reward-item gp"><span>💰 Galactic Points</span><b>+${reward.gp_awarded}</b></div>`;
  }
  try {
    breakdown = (typeof reward.breakdown === 'string') ? JSON.parse(reward.breakdown) : (reward.breakdown || {});
    if (breakdown.sector_conflict_bonus) {
      html += `<div class="reward-item gp"><span>⚔ ${LANG==='ko'?'분쟁 섹터 보너스':LANG==='ja'?'紛争セクター報酬':LANG==='zh'?'争端区奖励':'Conflict Sector Bonus'}</span><b>+${breakdown.sector_conflict_bonus}</b></div>`;
    }
    if (breakdown.alliance_treasury_bonus) {
      html += `<div class="reward-item gp"><span>🛡 ${LANG==='ko'?'동맹 금고 배당':LANG==='ja'?'同盟金庫配当':LANG==='zh'?'联盟金库分红':'Alliance Treasury'}</span><b>+${breakdown.alliance_treasury_bonus}</b></div>`;
    }
    if (breakdown.environment_salvage) {
      const salvage = breakdown.environment_salvage || {};
      html += `<div class="reward-item mineral"><span>🧲 ${LANG==='ko'?'전장 회수':LANG==='ja'?'戦場回収':LANG==='zh'?'战场回收':'Field Salvage'}${breakdown.battlefield_label ? ' · ' + escapeHtml(breakdown.battlefield_label) : ''}</span><b>${escapeHtml(salvage.resource_code || '')} ×${salvage.quantity || 0}</b></div>`;
    }
  } catch (_) {}
  for (const [code, qty] of Object.entries(reward.minerals_awarded || {})) {
    const icon = (typeof MINERAL_ICONS !== 'undefined' && MINERAL_ICONS[code]) || '🟫';
    const name = (typeof MINERAL_KO !== 'undefined' && MINERAL_KO[code]) || code;
    html += `<div class="reward-item mineral"><span>${icon} ${name}</span><b>+${qty}</b></div>`;
  }
  html += `<div class="reward-item" style="border-color:rgba(91,184,232,.22);background:rgba(91,184,232,.055)"><span>▸ ${LANG==='ko'?'다음 행동':LANG==='ja'?'次の行動':LANG==='zh'?'下一步':'Next move'}</span><b style="color:var(--cyan);text-align:right;font-size:10px;line-height:1.35">${battleRewardNextStep(reward, breakdown, reward.minerals_awarded || {})}</b></div>`;

  items.innerHTML = html;
  document.getElementById('rewardToast').classList.add('show');
  // (도파민 v7.387) 전투 보상에 사운드 + GP 숫자 버스트 — 밋밋하던 보상 순간에 juice.
  if (reward.gp_awarded > 0) {
    rewardBurst({ text: '+' + reward.gp_awarded + ' GP', tier: reward.is_winner ? 2 : 1,
      sound: reward.is_winner ? (window._sfx && _sfx.hijackWin) : (window._sfx && _sfx.purchase) });
  } else {
    try { if (window._sfx) (reward.is_winner ? _sfx.hijackWin : _sfx.purchase)(); } catch(_) {}
  }
  setTimeout(closeRewardToast, 10000);
}

function closeRewardToast() {
  document.getElementById('rewardToast').classList.remove('show');
  // Bug5: 결과 카드 → 뷰어까지 같이 닫기 (확인 버튼 클릭 시 전체 종료)
  const resultOverlay = document.getElementById('bvResultOverlay');
  if (resultOverlay && resultOverlay.classList.contains('active')) {
    closeBattleViewer();
  }
}

function getMyWallet() {
  // 1) JWT 우선
  try {
    const token = localStorage.getItem('pw_token');
    if (token) {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const w = payload.wallet_address || payload.wallet || payload.walletAddress;
      if (w) return w;
    }
  } catch (_) {}
  // 2) 지갑 연결만 된 경우 (이메일 로그인 없음)
  if (typeof walletState !== 'undefined' && walletState && walletState.address) {
    return walletState.address;
  }
  return null;
}

// ═════════════════════════════════════════════════════════════════
// Phase C: AI 연습전
// ═════════════════════════════════════════════════════════════════

async function openAiFight() {
  if (!isLoggedIn()) { showFactionToast(t('daily_login_required')||tl('Login required','로그인이 필요합니다','ログインが必要です','请先登录'),'error'); return; }
  document.getElementById('aiFightModal').classList.add('active');
  await loadAiFleets();
}

function closeAiFight() {
  document.getElementById('aiFightModal').classList.remove('active');
}

function aiDifficultyProfile(f) {
  const diff = String((f && f.ai_difficulty) || 'normal').toLowerCase();
  const ships = Math.max(0, parseInt(f && f.ships_alive, 10) || 0);
  const mult = diff === 'elite' ? 2.2 : diff === 'hard' ? 1.55 : diff === 'easy' ? 0.75 : 1;
  const threat = Math.max(1, Math.round(ships * mult));
  const role = diff === 'elite'
    ? tl('Boss raid', '보스 레이드', 'ボスレイド', '首领突袭')
    : diff === 'hard'
      ? tl('High-risk duel', '고위험 결투', '高リスク決闘', '高风险决斗')
      : diff === 'easy'
        ? tl('Training target', '훈련 표적', '訓練目標', '训练目标')
        : tl('Live-fire drill', '실전 훈련', '実戦訓練', '实战演练');
  const reward = diff === 'elite'
    ? tl('High salvage odds', '회수 기대 높음', '回収期待 高', '高回收期望')
    : diff === 'hard'
      ? tl('Bonus practice value', '훈련 가치 보너스', '訓練価値ボーナス', '训练价值加成')
      : diff === 'easy'
        ? tl('Low repair risk', '수리 위험 낮음', '修理リスク低', '低维修风险')
        : tl('Balanced reward', '균형 보상', '均衡報酬', '均衡奖励');
  return { diff: diff, ships: ships, threat: threat, role: role, reward: reward };
}

async function loadAiFleets() {
  const grid = document.getElementById('aiFightGrid');
  grid.innerHTML = '<div class="bh-empty" style="grid-column:1/-1">' + (LANG==='ko'?'로딩 중...':LANG==='ja'?'読み込み中...':LANG==='zh'?'加载中...':'Loading...') + '</div>';

  try {
    const data = await battleHubReadKeyed('ai-fleets', '/api/ai/fleets', 15000);
    if (!data) return;
    const fleets = data.fleets || [];

    if (fleets.length === 0) {
      grid.innerHTML = '<div class="bh-empty" style="grid-column:1/-1">' + (LANG==='ko'?'사용 가능한 AI 함대 없음<br>서버가 AI 함대 생성 중일 수 있습니다':LANG==='ja'?'使用可能なAI艦隊なし<br>サーバーがAI艦隊を生成中かもしれません':LANG==='zh'?'没有可用的AI舰队<br>服务器可能正在创建AI舰队':'No AI fleets available<br>Server may be generating AI fleets') + '</div>';
      return;
    }

    // [v7.214 fix] nickname 인라인 onclick escape 위험 — index cache + delegated listener.
    window._aiFightFleets = fleets.slice();
    grid.innerHTML = fleets.map((f, idx) => {
      const p = aiDifficultyProfile(f);
      const threatLabel = p.threat >= 70 ? 'critical' : p.threat >= 35 ? 'high' : 'low';
      return `
      <div class="ai-card difficulty-${f.ai_difficulty || 'normal'}"
           data-action="challengeAi" data-idx="${idx}">
        <div class="ai-card-top">
          <div>
            <div class="ai-card-nick">${escapeHtml(f.nickname || 'AI')}</div>
            <div class="ai-card-meta">${escapeHtml(f.faction_name || '')}</div>
          </div>
          <span class="difficulty-badge ${p.diff}">${p.diff.toUpperCase()}</span>
        </div>
        <div class="ai-card-intel">
          <span>⚔ ${p.ships}${LANG==='ko'?'척':LANG==='ja'?'隻':LANG==='zh'?'艘':' ships'}</span>
          <span class="ai-threat ${threatLabel}">${LANG==='ko'?'위협':LANG==='ja'?'脅威':LANG==='zh'?'威胁':'Threat'} ${p.threat}</span>
        </div>
        <div class="ai-card-role">${escapeHtml(p.role)}</div>
        <div class="ai-card-reward">${escapeHtml(p.reward)}</div>
      </div>
    `; }).join('');
    if (!grid.dataset.delegated) {
      grid.dataset.delegated = '1';
      grid.addEventListener('click', function(ev){
        var card = ev.target && ev.target.closest ? ev.target.closest('div[data-action="challengeAi"]') : null;
        if (!card) return;
        var idx = parseInt(card.getAttribute('data-idx'), 10);
        var f = (window._aiFightFleets || [])[idx];
        if (!f) return;
        console.log('[BTN] challengeAi triggered', f.fleet_id);
        challengeAi(f.fleet_id, f.nickname || '');
      });
    }
  } catch (err) {
    console.error('loadAiFleets:', err);
    grid.innerHTML = '<div class="bh-empty" style="grid-column:1/-1">' + (LANG==='ko'?'로딩 실패':LANG==='ja'?'読み込み失敗':LANG==='zh'?'加载失败':'Load failed') + '</div>';
  }
}

async function challengeAi(aiFleetId, aiName) {
  try {
    const data = await battleHubReadKeyed('ai-challenge-fleets', '/api/fleets', 8000);
    if (!data) return;
    const myFleets = (data.fleets || []).filter(f => f.ships_alive > 0 && !f.is_in_battle);

    if (myFleets.length === 0) {
      showFactionToast(t('fleet_no_combat_fleet')||'No combat fleet', 'error');
      return;
    }

    const fleetId = await gamePicker({
      title: `🤖 ${aiName} ${LANG==='ko'?'에게 도전':LANG==='ja'?'に挑戦':LANG==='zh'?'挑战':'Challenge'}`,
      items: myFleets.map(f => ({ value: String(f.id), label: f.name + ' (' + f.ships_alive + (LANG==='ko'?'척':LANG==='ja'?'隻':LANG==='zh'?'艘':'ships') + ')', icon: '🚢' }))
    });
    if (!fleetId) return;
    const chosenFleet = myFleets.find(f => String(f.id) === fleetId);
    if (!chosenFleet) { showFactionToast(LANG==='ko'?'잘못된 선택':LANG==='ja'?'無効な選択':LANG==='zh'?'无效选择':'Invalid selection','error'); return; }

    const res2 = await fetch('/api/ai/fight', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({ my_fleet_id: chosenFleet.id, ai_fleet_id: aiFleetId })
    });
    const data2 = await res2.json();

    if (!res2.ok) {
      showFactionToast((LANG==='ko'?`오류: `:LANG==='ja'?`エラー: `:LANG==='zh'?`错误: `:`Error: `) + data2.error, 'error');
      return;
    }

    showFactionToast(`🤖 ${aiName} ${LANG==='ko'?'와의 전투 시작!':LANG==='ja'?'との戦闘開始!':LANG==='zh'?'战斗开始!':'- Battle started!'}`, 'success');
    if (data2.battle_id) markBattleDailyOpsOnce(data2.battle_id, 'ai_practice');
    else { try{ markDailyOpsAction('ai_practice', 1); }catch(_e){} }
    // [v7.221 upgrade #3] 마지막 AI 상대 저장 — 전투 결과 카드의 '리매치' 버튼이 재사용 (battleId 일치 시만 표시).
    window._lastAiChallenge = { aiFleetId: aiFleetId, aiName: aiName, battleId: data2.battle_id };
    closeAiFight();
    if (data2.battle_id) {
      _setActiveTimeout(() => openBattleViewer(data2.battle_id), 3000);
      // Bug4: showRewardIfAny 별도 토스트 제거 — 결과 카드에 보상 인라인 표시
    } else console.warn('[ai] battle_id missing in response:', data2);
  } catch (err) {
    console.error('challengeAi:', err);
    showFactionToast(t('quests_network_error')||tl('Network error','네트워크 오류','ネットワークエラー','网络错误'),'error');
  }
}

// ═════════════════════════════════════════════════════════════════
// Phase C: Tournaments
// ═════════════════════════════════════════════════════════════════

var tnState = { currentTab: 'open' };

async function openTournaments() {
  if (!isLoggedIn()) { showFactionToast(t('daily_login_required')||tl('Login required','로그인이 필요합니다','ログインが必要です','请先登录'),'error'); return; }
  document.getElementById('tournamentModal').classList.add('active');
  await tnLoad();
}

function closeTournaments() {
  document.getElementById('tournamentModal').classList.remove('active');
}

function tnSwitchTab(tab) {
  tnState.currentTab = tab;
  document.querySelectorAll('.tn-tab').forEach(t =>
    t.classList.toggle('active', t.dataset.tab === tab)
  );
  tnLoad();
}

async function tnLoad() {
  const tab = tnState.currentTab;
  const container = document.getElementById('tnListContent');
  container.innerHTML = '<div class="bh-empty">' + (LANG==='ko'?'로딩 중...':LANG==='ja'?'読み込み中...':LANG==='zh'?'加载中...':'Loading...') + '</div>';

  try {
    let statusParam = '';
    if (tab === 'open') statusParam = '?status=registering';
    else if (tab === 'running') statusParam = '?status=running';
    else statusParam = '?status=completed';

    const data = await battleHubReadKeyed('tournaments:' + tab, '/api/tournaments' + statusParam, 30000);
    if (!data) return;
    const list = data.tournaments || [];

    if (list.length === 0) {
      container.innerHTML = `<div class="bh-empty">${tab === 'open' ? (LANG==='ko'?'모집 중인 토너먼트 없음':LANG==='ja'?'募集中のトーナメントなし':LANG==='zh'?'没有招募中的锦标赛':'No open tournaments') : tab === 'running' ? (LANG==='ko'?'진행 중인 토너먼트 없음':LANG==='ja'?'進行中のトーナメントなし':LANG==='zh'?'没有进行中的锦标赛':'No running tournaments') : (LANG==='ko'?'완료된 토너먼트 없음':LANG==='ja'?'完了したトーナメントなし':LANG==='zh'?'没有已完成的锦标赛':'No completed tournaments')}</div>`;
      return;
    }

    container.innerHTML = list.map(t => renderTournamentCard(t)).join('');
  } catch (err) {
    console.error('tnLoad:', err);
    container.innerHTML = '<div class="bh-empty">' + (LANG==='ko'?'로딩 실패':LANG==='ja'?'読み込み失敗':LANG==='zh'?'加载失败':'Load failed') + '</div>';
  }
}

function renderTournamentCard(t) {
  const statusLabel = {
    'registering': `${LANG==='ko'?'모집 중':LANG==='ja'?'募集中':LANG==='zh'?'招募中':'Open'} ${t.current_participants}/${t.max_participants}`,
    'ready': LANG==='ko'?'시작 대기':LANG==='ja'?'開始待ち':LANG==='zh'?'等待开始':'Ready to start',
    'running': `${LANG==='ko'?'진행 중':LANG==='ja'?'進行中':LANG==='zh'?'进行中':'Running'} · R${t.current_round}/${t.total_rounds}`,
    'completed': LANG==='ko'?'완료':LANG==='ja'?'完了':LANG==='zh'?'已完成':'Completed', 'cancelled': LANG==='ko'?'취소':LANG==='ja'?'キャンセル':LANG==='zh'?'已取消':'Cancelled',
  }[t.status] || t.status;

  return `
    <div class="tn-card status-${t.status}">
      <div>
        <div class="tn-card-title">🏆 ${escapeHtml(t.name)}</div>
        <div class="tn-card-meta">
          <span>${statusLabel}</span>
          <span>${LANG==='ko'?'참가비':LANG==='ja'?'参加費':LANG==='zh'?'参赛费':'Entry'} <b>${t.entry_fee_gp || 0}</b> GP</span>
          <span>${LANG==='ko'?'상금':LANG==='ja'?'賞金':LANG==='zh'?'奖金':'Prize'} <b>${t.prize_pool_gp || 0}</b> GP</span>
          <span>${LANG==='ko'?t.max_participants+'강':LANG==='ja'?'TOP'+t.max_participants:LANG==='zh'?t.max_participants+'强':'Top '+t.max_participants}</span>
        </div>
      </div>
      <div style="display:flex;gap:4px">
        ${t.status === 'registering'
          ? `<button class="bc-btn primary" onclick="registerTournament(${t.id})">${LANG==='ko'?'참가':LANG==='ja'?'参加':LANG==='zh'?'参加':'Join'}</button>` : ''}
        <button class="bc-btn" onclick="openBracket(${t.id})">${LANG==='ko'?'브래킷':LANG==='ja'?'ブラケット':LANG==='zh'?'对阵表':'Bracket'}</button>
      </div>
    </div>
  `;
}

async function registerTournament(tournamentId) {
  try {
    const data = await battleHubReadKeyed('tournament-fleets', '/api/fleets', 8000);
    if (!data) return;
    const myFleets = (data.fleets || []).filter(f => f.ships_alive > 0 && !f.is_in_battle);

    if (myFleets.length === 0) {
      showFactionToast(t('fleet_no_combat_fleet')||'No combat fleet', 'error');
      return;
    }

    const fleetId = await gamePicker({
      title: LANG==='ko'?'🏆 토너먼트 참가':LANG==='ja'?'🏆 トーナメント参加':LANG==='zh'?'🏆 参加锦标赛':'🏆 Join Tournament',
      items: myFleets.map(f => ({ value: String(f.id), label: f.name + ' (' + f.ships_alive + (LANG==='ko'?'척':LANG==='ja'?'隻':LANG==='zh'?'艘':'ships') + ')', icon: '🚢' }))
    });
    if (!fleetId) return;
    const chosenFleet = myFleets.find(f => String(f.id) === fleetId);
    if (!chosenFleet) return;

    const res2 = await fetch(`/api/tournaments/${tournamentId}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({ fleet_id: chosenFleet.id })
    });
    const data2 = await res2.json();

    if (!res2.ok) {
      const msgMap = {
        'TOURNAMENT_FULL': LANG==='ko'?'정원 초과':LANG==='ja'?'定員超過':LANG==='zh'?'名额已满':'Tournament full', 'ALREADY_REGISTERED': LANG==='ko'?'이미 참가 중':LANG==='ja'?'すでに参加中':LANG==='zh'?'已参赛':'Already registered',
        'INSUFFICIENT_GP': `${LANG==='ko'?'GP 부족 (필요: ':LANG==='ja'?'GP不足 (必要: ':LANG==='zh'?'GP不足（需要: ':'Insufficient GP (need: '}${data2.meta?.required})`,
        'FLEET_IN_BATTLE': LANG==='ko'?'함대가 전투 중':LANG==='ja'?'艦隊が戦闘中':LANG==='zh'?'舰队正在战斗中':'Fleet in battle', 'DEADLINE_PASSED': LANG==='ko'?'모집 마감됨':LANG==='ja'?'募集締め切り':LANG==='zh'?'招募已截止':'Deadline passed',
      };
      showFactionToast(msgMap[data2.error] || (LANG==='ko'?`오류: ${data2.error}`:LANG==='ja'?`エラー: ${data2.error}`:LANG==='zh'?`错误: ${data2.error}`:`Error: ${data2.error}`), 'error');
      return;
    }

    showFactionToast('🏆 ' + (LANG==='ko'?'참가 완료':LANG==='ja'?'参加完了':LANG==='zh'?'参赛完成':'Registered'), 'success');
    tnLoad();
  } catch (err) {
    console.error('registerTournament:', err);
    showFactionToast(t('quests_network_error')||tl('Network error','네트워크 오류','ネットワークエラー','网络错误'),'error');
  }
}

async function openCreateTournament() {
  const name = await gameInput({ title:LANG==='ko'?'토너먼트 개최':LANG==='ja'?'トーナメント開催':LANG==='zh'?'举办锦标赛':'Host Tournament', label:LANG==='ko'?'토너먼트 이름':LANG==='ja'?'トーナメント名':LANG==='zh'?'锦标赛名称':'Tournament Name', placeholder:LANG==='ko'?'예: 3월 함대 챔피언십':LANG==='ja'?'例: 3月艦隊選手権':LANG==='zh'?'例：3月舰队锦标赛':'e.g. March Fleet Championship', maxLength:60 });
  if (!name || !name.trim()) return;

  const sizeStr = await gamePicker({
    title: LANG==='ko'?'참가 인원':LANG==='ja'?'参加人数':LANG==='zh'?'参赛人数':'Participants',
    items: [{value:'4',label:LANG==='ko'?'4명':LANG==='ja'?'4人':LANG==='zh'?'4人':'4 players',icon:'👥'},{value:'8',label:LANG==='ko'?'8명':LANG==='ja'?'8人':LANG==='zh'?'8人':'8 players',icon:'👥'},{value:'16',label:LANG==='ko'?'16명':LANG==='ja'?'16人':LANG==='zh'?'16人':'16 players',icon:'👥'}],
    selected: '8'
  });
  const size = parseInt(sizeStr);
  if (![4, 8, 16].includes(size)) { showFactionToast(LANG==='ko'?'취소됨':LANG==='ja'?'キャンセル':LANG==='zh'?'已取消':'Cancelled','error'); return; }

  const feeStr = await gameInput({ title:LANG==='ko'?'참가비':LANG==='ja'?'参加費':LANG==='zh'?'报名费':'Entry Fee', label:LANG==='ko'?'참가비 GP (0=무료)':LANG==='ja'?'参加費 GP (0=無料)':LANG==='zh'?'报名费 GP (0=免费)':'Entry Fee GP (0=free)', placeholder:'100', defaultValue:'100', maxLength:8 });
  const fee = parseInt(feeStr) || 0;

  try {
    const res = await fetch('/api/tournaments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({
        name: name.trim(), max_participants: size,
        entry_fee_gp: fee,
        registration_deadline_hours: 24, start_delay_hours: 1,
      })
    });
    const data = await res.json();

    if (!res.ok) { showFactionToast((LANG==='ko'?`오류: `:LANG==='ja'?`エラー: `:LANG==='zh'?`错误: `:`Error: `) + data.error, 'error'); return; }
    showFactionToast('🏆 ' + (LANG==='ko'?'토너먼트 개최됨':LANG==='ja'?'トーナメント開催されました':LANG==='zh'?'锦标赛已创建':'Tournament created'), 'success');
    tnLoad();
  } catch (err) {
    showFactionToast(t('quests_network_error')||tl('Network error','네트워크 오류','ネットワークエラー','网络错误'),'error');
  }
}

async function openBracket(tournamentId) {
  document.getElementById('bracketModal').classList.add('active');
  document.getElementById('bracketContent').innerHTML = `<div class="bh-empty">${LANG==='ko'?'로딩 중...':LANG==='ja'?'読み込み中...':LANG==='zh'?'加载中...':'Loading...'}</div>`;

  try {
    const res = await fetch(`/api/tournaments/${tournamentId}`);
    const data = await res.json();
    const t = data.tournament;
    if (!t) return;

    document.getElementById('bracketTitle').innerHTML = `🏆 ${escapeHtml(t.name)}`;

    const byRound = {};
    for (const m of (t.matches || [])) {
      if (!byRound[m.round]) byRound[m.round] = [];
      byRound[m.round].push(m);
    }

    const roundKeys = Object.keys(byRound).sort((a,b) => parseInt(a) - parseInt(b));
    if (roundKeys.length === 0) {
      document.getElementById('bracketContent').innerHTML = `<div class="bh-empty">${LANG==='ko'?'아직 브래킷이 생성되지 않았습니다':LANG==='ja'?'まだブラケットが作成されていません':LANG==='zh'?'对阵表尚未生成':'Bracket not generated yet'}</div>`;
      return;
    }

    const html = '<div class="bracket">' + roundKeys.map(r => `
      <div class="bracket-round">
        <div style="font-size:10px;color:rgba(255,255,255,.4);letter-spacing:2px;text-align:center;margin-bottom:6px">ROUND ${r}</div>
        ${byRound[r].sort((a,b) => a.match_index - b.match_index).map(m => `
          <div class="bracket-match ${m.status}">
            <div class="bracket-player ${m.winner_wallet === m.p1_wallet ? 'winner' : ''} ${!m.p1_wallet ? 'empty' : ''}">
              <span>${escapeHtml(m.p1_nickname || '-')}</span><span>${m.winner_wallet === m.p1_wallet ? '✓' : ''}</span>
            </div>
            <div class="bracket-player ${m.winner_wallet === m.p2_wallet ? 'winner' : ''} ${!m.p2_wallet ? 'empty' : ''}">
              <span>${escapeHtml(m.p2_nickname || '-')}</span><span>${m.winner_wallet === m.p2_wallet ? '✓' : ''}</span>
            </div>
            ${m.battle_id ? `<button class="bc-btn primary" style="margin-top:4px;width:100%;font-size:9px" onclick="openBattleViewer(${m.battle_id})">${LANG==='ko'?'관전':LANG==='ja'?'観戦':LANG==='zh'?'观战':'Watch'}</button>` : ''}
          </div>
        `).join('')}
      </div>
    `).join('') + '</div>';

    document.getElementById('bracketContent').innerHTML = html;
  } catch (err) {
    console.error('openBracket:', err);
    document.getElementById('bracketContent').innerHTML = `<div class="bh-empty">${LANG==='ko'?'로딩 실패':LANG==='ja'?'読み込み失敗':LANG==='zh'?'加载失败':'Load failed'}</div>`;
  }
}

function closeBracket() {
  document.getElementById('bracketModal').classList.remove('active');
}

// ═════════════════════════════════════════════════════════════════
// Hijack 진입점 (PP 정산 + 영토 이전 포함 — /api/hijack/declare-with-pp)
//
// 레거시 /api/hijack/declare 는 410 Deprecated. 영토 이전 없이 함대만
// 충돌시키는 "전투 전용" PvP는 /api/ai/fight (AI 상대) 또는 토너먼트 브라켓을 사용.
// ═════════════════════════════════════════════════════════════════

function showHijackEntryHint() {
  var msg = LANG==='ko'?'하이잭은 맵에서 대상 영토를 선택한 뒤 영토 정보 패널의 HIJACK 버튼으로 시작하세요.':LANG==='ja'?'マップで対象領土を選択し、領土情報パネルのHIJACKボタンから開始してください。':LANG==='zh'?'在地图上选择目标领土，然后点击领土信息面板的HIJACK按钮开始。':'Select a target territory on the map, then click the HIJACK button in the territory info panel.';
  if (typeof showFactionToast === 'function') showFactionToast(msg, 'warn');
  else if (typeof showToast === 'function') showToast(msg, 'warn');
  else alert(msg);
}
window.showHijackEntryHint = showHijackEntryHint;

// 영토 정보 패널의 "⚔ HIJACK 영토" 버튼 핸들러 — claim 모달 (PP 경로) 로 진입
function hijackFromTerritoryInfo(){
  const btn = document.getElementById('infoHijackBtn');
  if (!btn) return;
  const claimId = parseInt(btn.dataset.claimId);
  const defWallet = btn.dataset.defWallet;
  const plot = selectedPlot;
  if (!claimId || !defWallet || !plot) {
    showFactionToast(LANG==='ko'?'영토 정보가 부족합니다':LANG==='ja'?'領土情報が不足しています':LANG==='zh'?'领地信息不足':'Territory info missing','error');
    return;
  }
  // Territory hijack must use the claim modal path: it calculates PP cost,
  // resolves defender fleet info, and calls /api/hijack/declare-with-pp.
  selectedPlot = {
    ...plot,
    claimId,
    owner: defWallet,
    w: plot.w || plot.width || plot.size || stampW,
    h: plot.h || plot.height || plot.size || stampH,
  };
  openClaimModal();
}
window.hijackFromTerritoryInfo = hijackFromTerritoryInfo;

// ═════════════════════════════════════════════════════════════════
// Battle Viewer (Canvas Renderer)
// ═════════════════════════════════════════════════════════════════

const bv = {
  canvas: null,
  ctx: null,
  timeline: null,
  battle: null,
  events: [],
  wallet: null,
  
  // 재생 상태
  playing: false,
  speed: 2,
  currentTick: 0,
  animHandle: null,
  lastFrameTime: 0,
  _viewerSeq: 0,
  
  // 쇼한 이벤트 추적
  shownEvents: new Set(),
  eventMessages: [],
  
  // 함선 파티클 (격침)
  particles: [],
};

async function forfeitBattle(battleId) {
  battleId = parseInt(battleId || (bv && bv.battle && bv.battle.id));
  if (!battleId) {
    showFactionToast(LANG==='ko'?'후퇴할 전투 ID가 없습니다':LANG==='ja'?'撤退する戦闘IDがありません':LANG==='zh'?'缺少要撤退的战斗ID':'Missing battle ID for retreat','error');
    return false;
  }
  try {
    const res = await fetch('/api/battles/' + encodeURIComponent(battleId) + '/forfeit', {
      method: 'POST',
      headers: Object.assign({ 'Content-Type': 'application/json' }, getAuthHeaders()),
      body: JSON.stringify({})
    });
    const data = await res.json().catch(function(){ return {}; });
    if (!res.ok || data.success !== true) {
      showFactionToast((LANG==='ko'?'후퇴 실패: ':LANG==='ja'?'撤退失敗: ':LANG==='zh'?'撤退失败: ':'Retreat failed: ') + (data.error || res.status), 'error');
      return false;
    }
    closeBattleViewer();
    showFactionToast(LANG==='ko'?'🏳 후퇴 완료 — 조선소에서 함선을 수리하세요':LANG==='ja'?'🏳 撤退完了 — 造船所で艦船を修理してください':LANG==='zh'?'🏳 撤退完成 — 请在船坞修理舰船':'🏳 Retreat complete — repair ships at shipyard', 'info');
    return true;
  } catch (e) {
    console.warn('[battle] forfeitBattle error:', e);
    showFactionToast(t('quests_network_error')||tl('Retreat request network error','후퇴 요청 네트워크 오류','撤退リクエストのネットワークエラー','撤退请求网络错误'),'error');
    return false;
  }
}

async function loadBvSidePanels(battleId) {
  // 사이드 패널 4종 채우기 — 내 함대, 자원, 적 함대, 전투 통계
  var preset = null, my = null, mineral = null, battleInfo = null;
  try {
    [preset, my, mineral, battleInfo] = await Promise.all([
      battleHubReadKeyed('tactical-presets:' + battleId, '/api/tactical-lab/fleet-presets?bid=' + battleId, 30000),
      battleHubReadKeyed('fleets-my-sidepanel', '/api/fleets/my', 15000),
      battleHubReadKeyed('resources-my-sidepanel', '/api/resources/my', 15000),
      battleHubReadKeyed('battle-info:' + battleId, '/api/battles/' + battleId, 1500)
    ]);
  } catch (_) {}

  var w = (walletState && walletState.address || '').toLowerCase();

  // participants 기반으로 내 사이드 / 적 사이드 분리
  var participants = (battleInfo && battleInfo.battle && battleInfo.battle.participants) || [];
  var mySide = null;
  var myParticipants = [], enemyParticipants = [];
  participants.forEach(function(p) {
    if ((p.wallet || '').toLowerCase() === w) { mySide = p.side; myParticipants.push(p); }
    else { enemyParticipants.push(p); }
  });

  // 내 함대 패널
  var myFleetEl = document.getElementById('bvSideMyFleet');
  if (myFleetEl) {
    if (myParticipants.length) {
      myFleetEl.innerHTML = myParticipants.map(function(p) {
        return '<div style="padding:6px 0;border-bottom:1px solid rgba(255,255,255,.05)">'
          + '<div style="color:#4fc3f7;font-weight:700">' + escapeHtmlSafe(p.nickname || ('Fleet#' + p.fleet_id)) + ' <span style="font-size:9px;opacity:.6">[' + (mySide||'').toUpperCase() + ']</span></div>'
          + `<div style="font-size:9px;color:rgba(255,255,255,.5)">${LANG==='ko'?'시작':LANG==='ja'?'開始':LANG==='zh'?'初始':'Start'}: ` + (p.ships_at_start || 0) + `${LANG==='ko'?'척':LANG==='ja'?'隻':LANG==='zh'?'艘':'ships'} · ${LANG==='ko'?'생존':LANG==='ja'?'生存':LANG==='zh'?'存活':'Alive'}: ` + (p.ships_alive || 0) + `${LANG==='ko'?'척':LANG==='ja'?'隻':LANG==='zh'?'艘':'ships'}</div>`
          + '</div>';
      }).join('');
    } else if (my && my.fleets) {
      myFleetEl.innerHTML = my.fleets.slice(0, 5).map(function(f) {
        var hp = parseFloat(f.total_hp || 0), maxHp = parseFloat(f.total_max_hp || 1);
        var pct = Math.round((hp / Math.max(1, maxHp)) * 100);
        return '<div style="padding:6px 0;border-bottom:1px solid rgba(255,255,255,.05)">'
          + '<div style="color:#4fc3f7;font-weight:700">' + escapeHtmlSafe(f.name || ('Fleet#' + f.id)) + '</div>'
          + `<div style="font-size:9px;color:rgba(255,255,255,.5)">` + (f.ships_alive || f.ship_count || 0) + `${LANG==='ko'?' 척':LANG==='ja'?' 隻':LANG==='zh'?' 艘':' ships'} · HP ` + pct + '%</div>'
          + '</div>';
      }).join('') || `<div style="opacity:.4">${LANG==='ko'?'함대 없음':LANG==='ja'?'艦隊なし':LANG==='zh'?'没有舰队':'No fleets'}</div>`;
    } else {
      myFleetEl.innerHTML = `<div style="opacity:.4">${LANG==='ko'?'로그인 필요':LANG==='ja'?'ログイン必要':LANG==='zh'?'需要登录':'Login required'}</div>`;
    }
  }

  // 자원 보유
  var resEl = document.getElementById('bvSideResources');
  if (resEl) {
    if (mineral && mineral.resources && mineral.resources.length) {
      resEl.innerHTML = mineral.resources.slice(0, 8).map(function(r) {
        return '<div style="display:flex;justify-content:space-between;padding:3px 0">'
          + '<span>' + (r.icon_emoji || '●') + ' ' + escapeHtmlSafe(r.name_ko || r.code) + '</span>'
          + '<b style="color:#fff">' + (r.quantity || 0) + '</b></div>';
      }).join('');
    } else {
      resEl.innerHTML = `<div style="opacity:.4">${LANG==='ko'?'광물 없음':LANG==='ja'?'鉱物なし':LANG==='zh'?'没有矿物':'No minerals'}</div>`;
    }
  }

  // 적 함대 — participants에서 내 지갑 제외한 나머지
  var enemyEl = document.getElementById('bvSideEnemyFleet');
  if (enemyEl) {
    if (enemyParticipants.length) {
      enemyEl.innerHTML = enemyParticipants.map(function(p) {
        var sideColor = p.side === 'atk' ? '#4fc3f7' : '#ff7043';
        return '<div style="padding:6px 0;border-bottom:1px solid rgba(255,255,255,.05)">'
          + '<div style="color:' + sideColor + ';font-weight:700">' + escapeHtmlSafe(p.nickname || ('Fleet#' + p.fleet_id)) + ' <span style="font-size:9px;opacity:.6">[' + (p.side||'').toUpperCase() + ']</span></div>'
          + `<div style="font-size:9px;color:rgba(255,255,255,.5)">${LANG==='ko'?'시작':LANG==='ja'?'開始':LANG==='zh'?'初始':'Start'}: ` + (p.ships_at_start || 0) + `${LANG==='ko'?'척':LANG==='ja'?'隻':LANG==='zh'?'艘':'ships'} · ${LANG==='ko'?'생존':LANG==='ja'?'生存':LANG==='zh'?'存活':'Alive'}: ` + (p.ships_alive || 0) + `${LANG==='ko'?'척':LANG==='ja'?'隻':LANG==='zh'?'艘':'ships'}</div>`
          + '</div>';
      }).join('');
    } else {
      enemyEl.innerHTML = `<div style="opacity:.4">${LANG==='ko'?'적 함대 없음':LANG==='ja'?'敵艦隊なし':LANG==='zh'?'没有敌方舰队':'No enemy fleets'}</div>`;
    }
  }

  // 전투 통계
  var statsEl = document.getElementById('bvSideBattleStats');
  if (statsEl && battleInfo && battleInfo.battle) {
    var b = battleInfo.battle;
    rememberBattleContext(b);
    var sectorLabel = b.sector_code ? (b.sector_name ? (b.sector_name + ' · ' + b.sector_code) : b.sector_code) : '';
    var battlefieldKey = b.battlefield_key || pickBattlefieldKey(b.id);
    var battlefieldLabel = b.battlefield_label || BATTLEFIELD_LABELS[battlefieldKey] || battlefieldKey || '';
    var battlefieldMods = formatBattlefieldModifiers(b.environment_modifiers);
    var battlefieldNote = b.environment_modifiers && b.environment_modifiers.note ? String(b.environment_modifiers.note) : '';
    var battlefieldObjective = b.environment_objective || '';
    var battlefieldSalvage = formatBattlefieldSalvageHint(b.environment_salvage_hint);
    statsEl.innerHTML =
      `<div style="display:flex;justify-content:space-between;padding:3px 0"><span>${LANG==='ko'?'전투 ID':LANG==='ja'?'戦闘ID':LANG==='zh'?'战斗ID':'Battle ID'}</span><b>#` + b.id + '</b></div>'
      + `<div style="display:flex;justify-content:space-between;padding:3px 0"><span>${LANG==='ko'?'타입':LANG==='ja'?'タイプ':LANG==='zh'?'类型':'Type'}</span><b>` + (b.battle_type || '?') + '</b></div>'
      + `<div style="display:flex;justify-content:space-between;padding:3px 0"><span>${LANG==='ko'?'상태':LANG==='ja'?'状態':LANG==='zh'?'状态':'Status'}</span><b>` + (b.status || '?') + '</b></div>'
      + (sectorLabel ? `<div style="display:flex;justify-content:space-between;padding:3px 0"><span>${LANG==='ko'?'섹터':LANG==='ja'?'セクター':LANG==='zh'?'区':'Sector'}</span><b style="color:#ffab40">` + escapeHtmlSafe(sectorLabel) + '</b></div>' : '')
      + (battlefieldLabel ? `<div style="display:flex;justify-content:space-between;padding:3px 0"><span>${LANG==='ko'?'전장':LANG==='ja'?'戦場':LANG==='zh'?'战场':'Field'}</span><b style="color:#81d4fa">` + escapeHtmlSafe(battlefieldLabel) + '</b></div>' : '')
      + (battlefieldMods ? `<div style="display:flex;justify-content:space-between;padding:3px 0"><span>${LANG==='ko'?'전장 효과':LANG==='ja'?'戦場効果':LANG==='zh'?'战场效果':'Field Mods'}</span><b style="color:#a5d6a7">` + escapeHtmlSafe(battlefieldMods) + '</b></div>' : '')
      + (battlefieldObjective ? `<div style="padding:5px 0 3px;color:#c5e1ff;font-size:9px;line-height:1.35">🎯 ` + escapeHtmlSafe(battlefieldObjective) + '</div>' : '')
      + (battlefieldSalvage ? `<div style="display:flex;justify-content:space-between;padding:3px 0"><span>${LANG==='ko'?'회수 후보':LANG==='ja'?'回収候補':LANG==='zh'?'可回收':'Salvage'}</span><b style="color:#7dd3fc">` + escapeHtmlSafe(battlefieldSalvage) + '</b></div>' : '')
      + (battlefieldNote ? `<div style="padding:5px 0 3px;color:rgba(255,255,255,.5);font-size:9px;line-height:1.35">` + escapeHtmlSafe(battlefieldNote) + '</div>' : '')
      + `<div style="display:flex;justify-content:space-between;padding:3px 0"><span>${LANG==='ko'?'ATK 함선':LANG==='ja'?'ATK 艦船':LANG==='zh'?'ATK 舰船':'ATK Ships'}</span><b>` + (b.atk_ships_total || 0) + '</b></div>'
      + `<div style="display:flex;justify-content:space-between;padding:3px 0"><span>${LANG==='ko'?'DEF 함선':LANG==='ja'?'DEF 艦船':LANG==='zh'?'DEF 舰船':'DEF Ships'}</span><b>` + (b.def_ships_total || 0) + '</b></div>';
  }
}

// ✅ [리플레이 하이라이트] 특정 tick 에서 전투 뷰어 열기
function openBattleViewerAt(battleId, tick) {
  openBattleViewer(battleId, tick);
}

async function openBattleViewer(battleId, startTick) {
  // 가드: battleId 가 falsy/invalid 면 즉시 안내 — `/api/battles/undefined` 폴링 방지
  battleId = parseInt(battleId);
  if (!battleId || battleId <= 0) {
    showFactionToast(LANG==='ko'?'전투 ID 누락 — 잠시 후 다시 시도해주세요':LANG==='ja'?'戦闘IDが見つかりません — しばらくしてから再試行してください':LANG==='zh'?'战斗ID缺失 — 请稍后再试':'Battle ID missing — please try again shortly','error');
    console.error('[battle] openBattleViewer called with invalid battleId:', battleId);
    return;
  }
  const viewerSeq = ++bv._viewerSeq;
  if (bv.animHandle) { cancelAnimationFrame(bv.animHandle); bv.animHandle = null; }
  bv.playing = false;
  var viewerWallet = (walletState && walletState.address) ? String(walletState.address).toLowerCase() : '';
  bv.wallet = viewerWallet;

  // [v7.406] 결과표시 게이트 리셋 — iframe 로컬 시뮬 완료(battle_final_done)에 맞춰 결과를 띄운다.
  bv._finalShown = false;
  bv._iframeActive = true;
  if (bv._finalFallback) { _clearActiveTimeout(bv._finalFallback); bv._finalFallback = null; }

  // 준비 중이면 잠시 대기
  document.getElementById('battleViewer').classList.add('active');
  document.getElementById('bvResultOverlay').classList.remove('active');

  // tactical-lab iframe module load
  var tf = document.getElementById('bvTacticalFrame');
  var viewerBgKey = typeof pickBattlefieldKey === 'function' ? pickBattlefieldKey(battleId) : null;
  var viewerBgLabel = viewerBgKey ? (BATTLEFIELD_LABELS[viewerBgKey] || viewerBgKey) : '';
  if (tf) {
    tf.src = buildTacticalLabUrl({
      mode: 'battle',
      battleId: battleId,
      wallet: viewerWallet,
      bg: viewerBgKey,
      bgLabel: viewerBgLabel,
      startTick: startTick
    });
  }

  // 사이드 패널 데이터 (데스크탑 전용 — CSS 가 모바일에선 hide)
  loadBvSidePanels(battleId);

  // legacy canvas 초기화 (HUD 코드가 참조해도 안 깨지게)
  bv.canvas = document.getElementById('battleCanvas');
  if (bv.canvas && bv.canvas.getContext) bv.ctx = bv.canvas.getContext('2d');

  // 타임라인 로드 (최대 60초 폴링 = 2s × 30회)
  // 전투가 preparing/in_progress 상태면 iframe(WS)이 처리 — 에러 없이 대기
  let loaded = false;
  let lastErr = null;
  let battleDone = false;
  for (let i = 0; i < 30; i++) {
    if (viewerSeq !== bv._viewerSeq) return;
    if (!_pageIsActive()) { await _activeSleep(2000); i--; continue; }
    if (viewerSeq !== bv._viewerSeq) return;
    if (!document.getElementById('battleViewer')?.classList.contains('active')) return;
    try {
      // 전투 정보
      const infoData = await battleHubReadKeyed('battle-info:' + battleId, `/api/battles/${battleId}`, 1500);
      if (viewerSeq !== bv._viewerSeq) return;
      if (!infoData) { await _activeSleep(2000); continue; }
      if (infoData.error) { lastErr = 'info: ' + infoData.error; break; }
      bv.battle = infoData.battle;
      if (infoData.battle) {
        rememberBattleContext(infoData.battle);
        const contextualBgKey = typeof pickBattlefieldKey === 'function' ? pickBattlefieldKey(battleId) : viewerBgKey;
        if (tf && contextualBgKey && contextualBgKey !== viewerBgKey) {
          viewerBgKey = contextualBgKey;
          viewerBgLabel = BATTLEFIELD_LABELS[viewerBgKey] || viewerBgKey;
          tf.src = buildTacticalLabUrl({
            mode: 'battle',
            battleId: battleId,
            wallet: viewerWallet,
            bg: viewerBgKey,
            bgLabel: viewerBgLabel,
            startTick: startTick
          });
        }
      }
      bv.events = infoData.events || [];
      const bStatus = infoData.battle && (infoData.battle.status || '');
      battleDone = (bStatus === 'ended' || bStatus === 'done');

      // 타임라인
      const tlData = await battleHubReadKeyed('battle-timeline:' + battleId, `/api/battles/${battleId}/timeline`, 1500);
      if (viewerSeq !== bv._viewerSeq) return;
      if (tlData && !tlData.error) {
        if (viewerSeq !== bv._viewerSeq) return;
        bv.timeline = tlData.timeline;
        loaded = true;
        break;
      } else {
        lastErr = 'timeline: ' + ((tlData && tlData.error) || 'pending');
        // 전투가 아직 진행 중이면 에러 아님 — 계속 대기
        if (!battleDone) { await _activeSleep(2000); continue; }
        // 전투 끝났는데 타임라인 없으면 진짜 에러
        break;
      }
    } catch (err) {
      lastErr = lastErr || err.message;
    }
    await _activeSleep(2000);
  }
  if (viewerSeq !== bv._viewerSeq) return;

  if (!loaded) {
    if (battleDone) {
      // 전투 종료됐는데 타임라인 없음 — 에러 표시하되 viewer 유지
      showFactionToast((LANG==='ko'?'전투 데이터 로딩 실패':LANG==='ja'?'戦闘データ読み込み失敗':LANG==='zh'?'战斗数据加载失败':'Battle data load failed') + (lastErr ? ' (' + lastErr + ')' : ''), 'error');
      console.error('[battle] openBattleViewer timeline missing for ended battle', battleId, ':', lastErr);
    } else {
      // 전투 진행 중 — iframe WS가 처리 중, 조용히 대기
      console.log('[battle] openBattleViewer: battle', battleId, 'still in progress, iframe WS handling');
    }
    // viewer 닫지 않음 — iframe 이 WS로 라이브 뷰 처리 중
  }

  // 자동승리 케이스 — viewer 는 정상적으로 풀 시각화 띄우되, frames 가 비정상적으로 짧으면
  // (시뮬레이션 누락 의심) 결과 오버레이 즉시 표시. 1:1 등 정상 전투는 아래 일반 흐름으로 진행.
  const framesN = bv.timeline?.frames?.length || 0;
  if (framesN < 2) {
    const winner = bv.battle?.winner_side;
    const msg = winner === 'atk' ? (LANG==='ko'?'⚔ 자동 승리 — 즉시 점령 (시뮬 frames 없음)':LANG==='ja'?'⚔ 自動勝利 — 即時占領 (シムフレームなし)':LANG==='zh'?'⚔ 自动胜利 — 立即占领 (无模拟帧)':'⚔ Auto-win — instant capture (no sim frames)')
              : winner === 'def' ? (LANG==='ko'?'🛡 자동 패배 (시뮬 frames 없음)':LANG==='ja'?'🛡 自動敗北 (シムフレームなし)':LANG==='zh'?'🛡 自动失败 (无模拟帧)':'🛡 Auto-loss (no sim frames)')
              : (LANG==='ko'?'⚡ 전투 즉시 종료 (시뮬 frames 없음)':LANG==='ja'?'⚡ 戦闘即時終了 (シムフレームなし)':LANG==='zh'?'⚡ 战斗立即结束 (无模拟帧)':'⚡ Battle ended instantly (no sim frames)');
    showFactionToast(msg, 'warn');
    console.warn('[battle] only', framesN, 'frame(s) for battle', battleId, 'winner=', winner);
    // viewer 는 닫지 않음 — 사용자가 결과 확인 후 ✕ 로 닫게 함
  }
  
  // HUD 업데이트
  renderHudSides();

  // Commander actions 뱃지 로드
  try {
    const caJ = await battleHubReadKeyed('commander-actions:' + battleId, `/api/battles/${battleId}/commander-actions`, 10000);
    if (caJ) {
      renderBvCmdBanner(caJ.actions || []);
    } else {
      renderBvCmdBanner([]);
    }
  } catch (_) { renderBvCmdBanner([]); }

  // 총 시간
  const totalTicks = bv.timeline.frames[bv.timeline.frames.length - 1]?.t || 0;
  document.getElementById('bvHudTotal').textContent = '/ ' + formatTickTime(totalTicks);
  
  // 이벤트 타임라인 정렬
  bv.shownEvents.clear();
  bv.eventMessages = [];
  bv.currentTick = 0;
  bv.particles = [];
  
  // 재생 시작
  bv.playing = true;
  bv.lastFrameTime = performance.now();
  bv._playStartMs = performance.now(); // (v7.401) 최소 5초 관전 보장 기준
  document.getElementById('bvPlayBtn').textContent = '⏸';
  if (bv.animHandle) cancelAnimationFrame(bv.animHandle);
  bv.animHandle = requestAnimationFrame(bvAnimLoop);
}

function closeBattleViewer() {
  bv._viewerSeq++;
  document.getElementById('battleViewer').classList.remove('active');
  bv.playing = false;
  if (bv.animHandle) { cancelAnimationFrame(bv.animHandle); bv.animHandle = null; }
  window.removeEventListener('resize', resizeCanvas);
  // [v7.410] tactical-lab iframe 완전 언로드 — 닫아도 WebAudio/시뮬 루프가 살아 사운드가 계속
  //   들리던 버그. src 를 about:blank 으로 바꿔 iframe 문서를 파기(사운드+rAF+WS 종료).
  try {
    unloadTacticalLabFrame(document.getElementById('bvTacticalFrame'));
  } catch (_) {}
  if (bv._finalFallback) { try { _clearActiveTimeout(bv._finalFallback); } catch(_){} bv._finalFallback = null; }

  // 배틀 허브 다시 열기 (있으면 리프레시)
  if (document.getElementById('battleHubModal').classList.contains('active')) {
    bhLoad();
  }
}

function resizeCanvas() {
  if (!bv.canvas) return;
  const dpr = window.devicePixelRatio || 1;
  bv.canvas.width = window.innerWidth * dpr;
  bv.canvas.height = window.innerHeight * dpr;
  bv.ctx.scale(dpr, dpr);
}

function togglePlayback() {
  bv.playing = !bv.playing;
  document.getElementById('bvPlayBtn').textContent = bv.playing ? '⏸' : '⏵';
  if (bv.playing) {
    bv.lastFrameTime = performance.now();
    if (bv.animHandle) cancelAnimationFrame(bv.animHandle);
    bv.animHandle = requestAnimationFrame(bvAnimLoop);
  }
}

function setSpeed(s) {
  bv.speed = s;
  document.querySelectorAll('.bv-speed-btn').forEach(b => {
    b.classList.toggle('active', parseInt(b.dataset.speed) === s);
  });
}

function jumpBattle(seconds) {
  const tickDelta = seconds * (1000 / bv.timeline.tick_ms);
  bv.currentTick = Math.max(0, Math.min(getLastTick(), bv.currentTick + tickDelta));
  redrawCurrentFrame();
}

function seekBattle(event) {
  const bar = document.getElementById('bvTimelineBar');
  const rect = bar.getBoundingClientRect();
  const pct = (event.clientX - rect.left) / rect.width;
  bv.currentTick = Math.max(0, Math.min(getLastTick(), pct * getLastTick()));
  
  // 이전 이벤트들 shown으로 처리 (다시 안 뜨게)
  for (const ev of bv.events) {
    if (ev.tick < bv.currentTick) bv.shownEvents.add(ev.id || `${ev.tick}-${ev.type}`);
  }
  
  redrawCurrentFrame();
}

function getLastTick() {
  const frames = bv.timeline?.frames || [];
  return frames.length > 0 ? frames[frames.length - 1].t : 0;
}

function bvAnimLoop(now) {
  if (!bv.playing) return;
  if (!_pageIsActive()) {
    bv.animHandle = null;
    return;
  }
  bv.animHandle = null;
  
  const dt = Math.min(100, now - bv.lastFrameTime);
  bv.lastFrameTime = now;
  
  // tick 진행
  const tickAdvance = (dt / bv.timeline.tick_ms) * bv.speed;
  bv.currentTick += tickAdvance;
  
  const lastTick = getLastTick();
  if (bv.currentTick >= lastTick) {
    bv.currentTick = lastTick;
    redrawCurrentFrame();
    // (v7.401) 최소 5초 관전 — 즉시 끝난 전투(1척 AI 등)도 마지막 프레임을 유지하다 결과 표시.
    var _MIN_VIEW_MS = 5000;
    if (bv._playStartMs && (performance.now() - bv._playStartMs) < _MIN_VIEW_MS) {
      bv.animHandle = requestAnimationFrame(bvAnimLoop);
      return;
    }
    bv.playing = false;
    document.getElementById('bvPlayBtn').textContent = '⏵';
    // [v7.406] iframe 로컬 시뮬이 활성이면 결과는 battle_final_done(패배측 전멸 후)에 맞춘다 —
    //   레거시 타임라인(2프레임 AI전)이 먼저 결과를 띄워 보이는 전투를 자르지 않도록. fallback 만 건다.
    if (bv._iframeActive) {
      if (!bv._finalShown && !bv._finalFallback) bv._finalFallback = _setActiveTimeout(bvFinalizeResult, 25000);
    } else {
      showBattleResult();
    }
    return;
  }

  redrawCurrentFrame();

  if (bv.playing) {
    bv.animHandle = requestAnimationFrame(bvAnimLoop);
  }
}

_onPageVisible(function(){
  if (bv.playing && document.getElementById('battleViewer')?.classList.contains('active') && !bv.animHandle) {
    bv.lastFrameTime = performance.now();
    bv.animHandle = requestAnimationFrame(bvAnimLoop);
  }
});
_onPageHidden(function(){
  if (bv.animHandle) {
    cancelAnimationFrame(bv.animHandle);
    bv.animHandle = null;
  }
});

function redrawCurrentFrame() {
  // 보간할 프레임 찾기
  const frames = bv.timeline.frames;
  let i = 0;
  while (i < frames.length - 1 && frames[i+1].t <= bv.currentTick) i++;
  const f1 = frames[i];
  const f2 = frames[Math.min(i + 1, frames.length - 1)];
  const t = f2.t > f1.t ? (bv.currentTick - f1.t) / (f2.t - f1.t) : 0;
  
  // 렌더링
  drawBattleFrame(f1, f2, Math.min(1, Math.max(0, t)));
  
  // HUD 업데이트
  document.getElementById('bvHudTime').textContent = formatTickTime(bv.currentTick);
  const pct = (bv.currentTick / getLastTick()) * 100;
  document.getElementById('bvTimelineFill').style.width = pct + '%';
  document.getElementById('bvTimelineCursor').style.left = pct + '%';
  
  // 이벤트 발화 (현재 tick 이전의 미표시 이벤트)
  for (const ev of bv.events) {
    const key = ev.id || `${ev.tick}-${ev.type}`;
    if (bv.shownEvents.has(key)) continue;
    if (ev.tick > bv.currentTick) continue;
    bv.shownEvents.add(key);
    showBvEvent(ev);
  }
  
  // HUD 사이드 (함대 HP) 재렌더
  updateHudFleets(f1, f2, t);
}

function drawBattleFrame(f1, f2, t) {
  const ctx = bv.ctx;
  const canvas = bv.canvas;
  const w = canvas.width / (window.devicePixelRatio || 1);
  const h = canvas.height / (window.devicePixelRatio || 1);
  
  // 배경
  ctx.clearRect(0, 0, w, h);
  
  // 좌표 스케일: 타임라인 field (1000x440) → 화면
  const scaleX = w / bv.timeline.field_w;
  const scaleY = h * 0.85 / bv.timeline.field_h; // 상하 HUD 자리 남김
  const offsetY = h * 0.08;
  const scale = Math.min(scaleX, scaleY);
  const actualW = bv.timeline.field_w * scale;
  const offsetX = (w - actualW) / 2;
  
  // 함대 aura + 진형/기동 라벨 (tactical-lab 스타일)
  for (const fleetSrc of bv.timeline.fleets_meta) {
    const f1Fleet = f1.fleets.find(x => x.id === fleetSrc.id);
    const f2Fleet = f2.fleets.find(x => x.id === fleetSrc.id);
    if (!f1Fleet || !f2Fleet || f1Fleet.dead) continue;

    const cx = offsetX + lerp(f1Fleet.cx, f2Fleet.cx, t) * scale;
    const cy = offsetY + lerp(f1Fleet.cy, f2Fleet.cy, t) * scale;
    const color = getSideColor(fleetSrc.side);
    const radius = 60 * scale;

    // 은은한 오라
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius * 2);
    grad.addColorStop(0, hexToRgba(color, 0.18));
    grad.addColorStop(0.6, hexToRgba(color, 0.05));
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 2, 0, Math.PI * 2);
    ctx.fill();

    // 진형/기동 라벨 (tactical-lab 스타일: 함대 위쪽에 작은 텍스트)
    const formation = (f1Fleet.formation || 'sphere').toLowerCase();
    const movement = (f1Fleet.movement || 'advance').toLowerCase();
    const formationIcons = { sphere: '●', wedge: '▶', screen: '⊟', pincer: '⊕', line: '▬', echelon: '◹', vanguard: '◻', scatter: '✻' };
    const movementIcons = { advance: '↑', flank: '↗', flank_left: '←', flank_right: '→', retreat: '↓', scatter: '✦', rally: '◉' };
    const fIcon = formationIcons[formation] || '●';
    const mIcon = movementIcons[movement] || '→';
    ctx.save();
    ctx.font = `bold ${Math.max(8, 10 * scale)}px monospace`;
    ctx.textAlign = 'center';
    ctx.fillStyle = hexToRgba(color, 0.85);
    ctx.shadowColor = '#000';
    ctx.shadowBlur = 4;
    ctx.fillText(`${fIcon} ${formation.toUpperCase()}  ${mIcon} ${movement.toUpperCase()}`, cx, cy - radius - 6);
    ctx.restore();

    // Escort cluster — 함대 중심 주변에 작은 점들 (시각적 풍성함)
    const escortCount = 8;
    ctx.save();
    ctx.fillStyle = hexToRgba(color, 0.35);
    for (let k = 0; k < escortCount; k++) {
      const ang = (k / escortCount) * Math.PI * 2 + (bv.currentTick * 0.02);
      const ex = cx + Math.cos(ang) * radius * 0.9;
      const ey = cy + Math.sin(ang) * radius * 0.9;
      ctx.beginPath();
      ctx.arc(ex, ey, 1.2 * scale, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // 레이저 빔 — 양쪽 함대가 살아있고 양쪽 다 함선이 있으면 가끔 빔 그리기 (시각 효과)
  if (bv.currentTick > 0) {
    const livingFleets = bv.timeline.fleets_meta.map(fm => {
      const f = f1.fleets.find(x => x.id === fm.id);
      return (f && !f.dead) ? { meta: fm, frame: f } : null;
    }).filter(Boolean);
    if (livingFleets.length >= 2) {
      const sides = {};
      livingFleets.forEach(lf => { (sides[lf.meta.side] = sides[lf.meta.side] || []).push(lf); });
      const atks = sides.atk || [];
      const defs = sides.def || [];
      // 0.4초마다 빔 (tick 진행 기반 pseudo-random)
      const beamPhase = Math.floor(bv.currentTick / 2) % 3;
      if (atks.length && defs.length && beamPhase === 0) {
        ctx.save();
        ctx.globalAlpha = 0.55;
        ctx.lineWidth = 1.2;
        atks.forEach(a => defs.forEach(d => {
          const ax = offsetX + a.frame.cx * scale, ay = offsetY + a.frame.cy * scale;
          const dx = offsetX + d.frame.cx * scale, dy = offsetY + d.frame.cy * scale;
          ctx.strokeStyle = '#4fc3f7';
          ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(dx, dy); ctx.stroke();
          ctx.strokeStyle = '#ff7043';
          ctx.beginPath(); ctx.moveTo(dx, dy); ctx.lineTo(ax, ay); ctx.stroke();
        }));
        ctx.restore();
      }
    }
  }
  
  // 함선 그리기
  const shipMap1 = new Map(f1.ships.map(s => [s.id, s]));
  const shipMap2 = new Map(f2.ships.map(s => [s.id, s]));
  
  // 함대 메타 맵 (function)
  const fleetMetaById = new Map(bv.timeline.fleets_meta.map(f => [f.id, f]));
  
  // 모든 프레임1의 함선 그리기 (frame2에 없으면 서서히 페이드)
  for (const [id, s1] of shipMap1) {
    const s2 = shipMap2.get(id);
    const fleet = fleetMetaById.get(s1.fid);
    if (!fleet) continue;
    
    let x, y, alpha = 1;
    if (s2) {
      x = offsetX + lerp(s1.x, s2.x, t) * scale;
      y = offsetY + lerp(s1.y, s2.y, t) * scale;
    } else {
      // 격침됨 - 파티클로 대체 (생성 한 번만)
      x = offsetX + s1.x * scale;
      y = offsetY + s1.y * scale;
      alpha = Math.max(0, 1 - t * 2);
      if (t < 0.1) createExplosion(x, y, getSideColor(fleet.side));
    }
    
    drawShip(ctx, x, y, s1, fleet, scale, alpha);
  }
  
  // 파티클 업데이트 & 그리기
  updateParticles();
  for (const p of bv.particles) {
    ctx.fillStyle = hexToRgba(p.color, p.life);
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r * p.life, 0, Math.PI * 2);
    ctx.fill();
  }
}

// 조선소(shipSilhouetteSvg) 와 동일한 함선 SVG 를 battle viewer 캔버스에 사용.
// 사용자 요청: "택티컬랩(=조선소)이 쓰는 함선 그리기를 실제 함대전에 그대로 써라"
var _bvShipImgCache = {};
function _bvGetShipImage(sizeClass, factionCode, role, code) {
  var key = (sizeClass||'frigate') + '|' + (factionCode||'mcc') + '|' + (role||'dps') + '|' + (code||'');
  if (_bvShipImgCache[key]) return _bvShipImgCache[key];
  try {
    var svg = (typeof shipSilhouetteSvg === 'function')
      ? shipSilhouetteSvg(sizeClass||'frigate', factionCode||'mcc', { role: role||'dps', code: code||'' })
      : null;
    if (!svg) { _bvShipImgCache[key] = null; return null; }
    // SVG 가 <svg ...> 단독이 아니라 다른 wrapper 가 있을 수 있어 직접 data URL 화
    var img = new Image();
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    _bvShipImgCache[key] = img;
    return img;
  } catch (_e) {
    _bvShipImgCache[key] = null;
    return null;
  }
}
function _bvFactionFromFleet(fleet) {
  return (fleet && (fleet.faction_code || fleet.faction)) || 'mcc';
}
function _bvSizeFromShip(shipData, fleet) {
  // ship_type_code 가 데이터에 있으면 그것 우선, 없으면 hp 로 추정
  if (shipData.ship_type_code || shipData.code) return null; // 코드 자체로 매핑 못 — size 별도 추정
  var hp = parseFloat(shipData.hp) || 4000;
  if (hp >= 50000) return 'titan';
  if (hp >= 25000) return 'battleship';
  if (hp >= 18000) return 'cruiser';
  if (hp >= 10000) return 'destroyer';
  return 'frigate';
}

function drawShip(ctx, x, y, shipData, fleet, scale, alpha) {
  const isFlagship = shipData.ff === 1;
  const faction = _bvFactionFromFleet(fleet);
  const sizeClass = shipData.size_class || _bvSizeFromShip(shipData, fleet) || 'frigate';
  const code = shipData.ship_type_code || shipData.code || '';

  // 조선소와 동일한 SVG 실루엣 사용
  const img = _bvGetShipImage(sizeClass, faction, shipData.role || 'dps', code);

  // 함선 크기 (size_class 기반)
  const sizeMap = { frigate: 22, destroyer: 30, cruiser: 38, battleship: 50, titan: 72 };
  const baseW = (sizeMap[sizeClass] || 22) * scale * (isFlagship ? 1.25 : 1);
  const baseH = baseW * 0.65;

  ctx.save();
  ctx.globalAlpha = alpha;

  if (img && img.complete && img.naturalWidth > 0) {
    // 진영별 색상 tint 는 이미 SVG 에 내장되어 있음
    ctx.drawImage(img, x - baseW/2, y - baseH/2, baseW, baseH);
  } else {
    // SVG 아직 로딩 중 또는 실패 — fallback 으로 진영색 점
    const color = getSideColor(fleet.side);
    ctx.fillStyle = color;
    ctx.strokeStyle = lighten(color, 0.3);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(x, y, baseW * 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  // 기함 표시 — 함선 위 골드 링
  if (isFlagship) {
    ctx.strokeStyle = '#ffd700';
    ctx.lineWidth = 2 * scale;
    ctx.beginPath();
    ctx.arc(x, y, baseW * 0.65, 0, Math.PI * 2);
    ctx.stroke();
  }

  // HP 바 (함선 위)
  const hp = parseFloat(shipData.hp) || 0;
  const maxHp = parseFloat(shipData.max_hp) || hp || 1;
  const hpPct = Math.max(0, Math.min(1, hp / maxHp));
  if (hpPct < 1 && hpPct > 0) {
    const barW = baseW * 0.9;
    const barH = 3 * scale;
    const barX = x - barW/2;
    const barY = y - baseH/2 - barH - 2;
    ctx.fillStyle = 'rgba(0,0,0,.6)';
    ctx.fillRect(barX - 1, barY - 1, barW + 2, barH + 2);
    ctx.fillStyle = hpPct > 0.5 ? '#4caf50' : hpPct > 0.25 ? '#ff9800' : '#f44336';
    ctx.fillRect(barX, barY, barW * hpPct, barH);
  }

  ctx.restore();
}

function createExplosion(x, y, color) {
  for (let i = 0; i < 6; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 1 + Math.random() * 2;
    bv.particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      r: 2 + Math.random() * 2,
      color,
      life: 1,
    });
  }
}

function updateParticles() {
  bv.particles = bv.particles.filter(p => {
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.05;
    p.life -= 0.02;
    return p.life > 0;
  });
}

function getSideColor(side) {
  return side === 'atk' ? '#4fc3f7' : '#ff7043';
}

function getFactionStyle(code) {
  if (code === 'mcc') return 'geometric';
  if (code === 'fsp') return 'organic';
  if (code === 'cv') return 'patchwork';
  return 'geometric';
}

function lerp(a, b, t) { return a + (b - a) * t; }

function hexToRgba(hex, alpha) {
  if (!hex) return `rgba(255,255,255,${alpha})`;
  const h = hex.replace('#', '');
  const r = parseInt(h.substr(0, 2), 16);
  const g = parseInt(h.substr(2, 2), 16);
  const b = parseInt(h.substr(4, 2), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function lighten(hex, amount) {
  const h = hex.replace('#', '');
  const r = Math.min(255, parseInt(h.substr(0, 2), 16) + Math.floor(amount * 255));
  const g = Math.min(255, parseInt(h.substr(2, 2), 16) + Math.floor(amount * 255));
  const b = Math.min(255, parseInt(h.substr(4, 2), 16) + Math.floor(amount * 255));
  return `rgb(${r},${g},${b})`;
}

function formatTickTime(tick) {
  const totalSeconds = Math.floor(tick * (bv.timeline?.tick_ms || 200) / 1000);
  const min = Math.floor(totalSeconds / 60);
  const sec = totalSeconds % 60;
  return `${min}:${sec.toString().padStart(2,'0')}`;
}

// ── HUD ──

function renderHudSides() {
  const atkBox = document.getElementById('bvAtkFleets');
  const defBox = document.getElementById('bvDefFleets');
  const atk = bv.timeline.fleets_meta.filter(f => f.side === 'atk');
  const def = bv.timeline.fleets_meta.filter(f => f.side === 'def');

  atkBox.innerHTML = atk.map(f => renderHudFleetCard(f, false)).join('');
  defBox.innerHTML = def.map(f => renderHudFleetCard(f, true)).join('');
}

function renderHudFleetCard(f, isDef) {
  return `
    <div class="bv-hud-fleet" id="bvFleet${f.id}">
      <div class="bv-hud-fleet-name">${escapeHtml(f.name || '')}</div>
      <div style="color:rgba(255,255,255,.5);font-size:8px">
        ${f.ships_total}척 · <span id="bvFleetHp${f.id}">-</span>
      </div>
      <div class="bv-hud-fleet-bar${isDef ? ' rtl' : ''}">
        <div class="bv-hud-fleet-fill${isDef ? ' def' : ''}" id="bvFleetBar${f.id}" style="width:100%"></div>
      </div>
    </div>
  `;
}

function renderBvCmdBanner(actions) {
  const box = document.getElementById('bvCmdBanner');
  if (!box) return;
  if (!actions.length) { box.innerHTML = ''; return; }
  const iconMap = {
    focus_fire: '🎯 FOCUS',
    emp: '⚡ EMP',
    wedge: '🗡 WEDGE',
    reinforce: '🚀 REINFORCE',
  };
  box.innerHTML = actions.map(a => {
    const sideCls = a.side === 'atk' ? 'atk' : 'def';
    let label = iconMap[a.action_type] || a.action_type;
    const p = a.params || {};
    if (a.action_type === 'focus_fire' && p.targetFleetId) label += ` #${p.targetFleetId}`;
    else if (a.action_type === 'emp' && a.applied_at_tick) label += ` @${a.applied_at_tick}t`;
    else if (a.action_type === 'reinforce' && p.shipTypeCode) label += ` ${p.shipTypeCode}×${p.count||0}`;
    return `<div class="bv-cmd-badge ${sideCls}">${sideCls.toUpperCase()} · ${label}</div>`;
  }).join('');
}

function updateHudFleets(f1, f2, t) {
  for (const fleetMeta of bv.timeline.fleets_meta) {
    const el = document.getElementById(`bvFleet${fleetMeta.id}`);
    if (!el) continue;
    const f1f = f1.fleets.find(x => x.id === fleetMeta.id);
    const f2f = f2.fleets.find(x => x.id === fleetMeta.id);
    if (!f1f || !f2f) continue;
    
    if (f1f.dead || f2f.dead) {
      el.classList.add('dead');
    }
    
    // HP 보간
    const hp = lerp(f1f.hp, f2f.hp, t);
    // maxHp는 fleets_meta에 없음. 첫 프레임 HP를 max로 가정
    const maxHp = bv.timeline.frames[0].fleets.find(x => x.id === fleetMeta.id)?.hp || hp;
    const pct = maxHp > 0 ? (hp / maxHp) * 100 : 0;
    
    const bar = document.getElementById(`bvFleetBar${fleetMeta.id}`);
    const hpText = document.getElementById(`bvFleetHp${fleetMeta.id}`);
    if (bar) {
      bar.style.width = pct + '%';
      const isDef = fleetMeta.side === 'def';
      const defCls = isDef ? ' def' : '';
      bar.className = 'bv-hud-fleet-fill' + defCls + (pct < 30 ? ' crit' : pct < 60 ? ' low' : '');
    }
    if (hpText) hpText.textContent = Math.round(pct) + '%';
  }
}

function showBvEvent(ev) {
  const feed = document.getElementById('bvEventFeed');
  let msg = '', cls = '';
  
  if (ev.event_type === 'flagship_destroyed' || ev.type === 'flagship_destroyed') {
    msg = `🚨 기함 격침 — 함대 괴멸`;
    cls = 'critical';
  } else if (ev.event_type === 'ship_destroyed' || ev.type === 'ship_destroyed') {
    const sc = ev.payload?.size_class || '';
    if (sc === 'titan') {
      msg = `💥 타이탄 격침!`;
      cls = 'critical';
    } else if (sc === 'battleship') {
      msg = `⚔ 전함 격침`;
      cls = 'kill';
    } else {
      msg = `⚔ ${sc} 격침`;
      cls = 'kill';
    }
  } else if (ev.event_type === 'tactic_changed' || ev.type === 'tactic_changed') {
    const p = ev.payload || {};
    const reason = p.reason || '';
    msg = `⟲ 전술 변경 (${reason})`;
    cls = 'tactic';
  } else {
    return; // 다른 이벤트는 무시
  }
  
  const div = document.createElement('div');
  div.className = `bv-event ${cls}`;
  div.innerHTML = `<span class="tick">${formatTickTime(ev.tick)}</span>${msg}`;
  feed.appendChild(div);
  
  // 스크롤 맨 아래로
  feed.scrollTop = feed.scrollHeight;
  
  // 20개 넘으면 오래된 거 삭제
  while (feed.children.length > 20) feed.removeChild(feed.firstChild);
}

function showBattleResult() {
  const overlay = document.getElementById('bvResultOverlay');
  const card = document.getElementById('bvResultCard');
  const title = document.getElementById('bvResultTitle');
  const subtitle = document.getElementById('bvResultSubtitle');
  const stats = document.getElementById('bvResultStats');

  const winner = bv.battle?.winner_side;
  const summary = bv.battle?.battle_summary || {};

  // 내가 ATK인지 DEF인지 판별
  const myWallet = (walletState?.address || '').toLowerCase();
  const participants = bv.battle?.participants || [];
  let mySide = null;
  let atkParticipant = null, defParticipant = null;
  for (const p of participants) {
    if (p.side === 'atk') atkParticipant = p;
    if (p.side === 'def') defParticipant = p;
    if ((p.wallet || '').toLowerCase() === myWallet) mySide = p.side;
  }
  const iWon = mySide && mySide === winner;
  const iLost = mySide && winner && mySide !== winner;

  // 스펙 wireframe: 헤더는 항상 "전투 결과 리포트"
  card.className = 'bv-result-card';
  if (winner === 'atk') card.classList.add('atk-won');
  else if (winner === 'def') card.classList.add('def-won');
  else card.classList.add('draw');

  title.style.color = winner === 'atk' ? '#4fc3f7' : winner === 'def' ? '#ff7043' : '#ffd700';
  title.style.fontSize = '20px';
  title.style.letterSpacing = '2px';
  title.innerHTML = `⚔&nbsp; ${LANG==='ko'?'전투 결과 리포트':LANG==='ja'?'戦闘結果レポート':LANG==='zh'?'战斗结果报告':'Battle Report'}`;

  // 부제목: 함대명 VS 함대명 + 내 승리/패배 배지
  const atkName = (atkParticipant?.fleet_name || atkParticipant?.nickname || 'ATK');
  const defName = (defParticipant?.fleet_name || defParticipant?.nickname || 'DEF');
  const resultBadge = iWon
    ? `<span style="background:#66bb6a;color:#000;font-size:10px;font-weight:900;padding:2px 8px;border-radius:3px;margin-left:8px;letter-spacing:.5px">🏆 ${LANG==='ko'?'승리':LANG==='ja'?'勝利':LANG==='zh'?'胜利':'Victory'}</span>`
    : iLost
    ? `<span style="background:#ef5350;color:#fff;font-size:10px;font-weight:900;padding:2px 8px;border-radius:3px;margin-left:8px;letter-spacing:.5px">💀 ${LANG==='ko'?'패배':LANG==='ja'?'敗北':LANG==='zh'?'败北':'Defeat'}</span>`
    : winner
    ? `<span style="background:#ffd700;color:#000;font-size:10px;font-weight:900;padding:2px 8px;border-radius:3px;margin-left:8px">≋ ${LANG==='ko'?'무승부':LANG==='ja'?'引き分け':LANG==='zh'?'平局':'Draw'}</span>`
    : '';
  // resultBadge를 내 함대 이름 옆에 붙임 (내가 ATK → atk 이름 뒤, 내가 DEF → def 이름 뒤, 관전 → 승자 이름 뒤)
  const atkFinalBadge = mySide === 'atk' ? resultBadge : (!mySide && winner === 'atk' ? resultBadge : '');
  const defFinalBadge = mySide === 'def' ? resultBadge : (!mySide && winner === 'def' ? resultBadge : '');
  subtitle.innerHTML = `<span style="color:rgba(255,255,255,.7);font-weight:600">${escapeHtml(atkName)}</span>${atkFinalBadge} <span style="color:rgba(255,255,255,.3);margin:0 4px">VS</span> <span style="color:rgba(255,255,255,.7);font-weight:600">${escapeHtml(defName)}</span>${defFinalBadge}`;
  subtitle.style.color = '';
  subtitle.style.fontWeight = '';
  subtitle.style.letterSpacing = '0';

  const atkWon = winner === 'atk';
  const defWon = winner === 'def';
  const atkIsMe = mySide === 'atk';
  const defIsMe = mySide === 'def';

  // ATK/DEF 패널 내부에 "나" 배지 + 승리/패배 표시
  const _meBadge = `<span style="background:#4fc3f7;color:#000;font-size:9px;padding:1px 5px;border-radius:3px;margin-left:4px;font-weight:700">나</span>`;
  const _winBadge = `<span style="background:#66bb6a;color:#000;font-size:9px;padding:1px 5px;border-radius:3px;margin-left:4px;font-weight:700">WIN</span>`;
  const _lossBadge = `<span style="background:rgba(239,83,80,.4);color:#ffb3b3;font-size:9px;padding:1px 5px;border-radius:3px;margin-left:4px;font-weight:700">LOSS</span>`;

  const atkResultBadge = atkWon ? _winBadge : (!atkWon && defWon) ? _lossBadge : '';
  const defResultBadge = defWon ? _winBadge : (!defWon && atkWon) ? _lossBadge : '';

  stats.innerHTML = `
    <div class="bv-result-stat-group atk ${atkWon ? 'winner' : ''}${atkIsMe ? ' my-side' : ''}">
      <div class="bv-result-emblem atk">⚔</div>
      <div class="bv-result-stat-label" style="color:#4fc3f7">ATK${atkIsMe ? _meBadge : ''}${atkResultBadge}</div>
      <div class="bv-result-stat-row"><span>투입 함선</span><b>${bv.battle.atk_ships_total || 0}</b></div>
      <div class="bv-result-stat-row"><span>격침</span><b style="color:#ef5350">${bv.battle.atk_ships_lost || 0}</b></div>
      <div class="bv-result-stat-row"><span>생존</span><b style="color:#66bb6a">${(bv.battle.atk_ships_total || 0) - (bv.battle.atk_ships_lost || 0)}</b></div>
      <div class="bv-result-stat-row"><span>총 데미지</span><b>${formatNum(summary.atk?.damage_dealt || 0)}</b></div>
    </div>
    <div class="bv-result-vs">VS</div>
    <div class="bv-result-stat-group def ${defWon ? 'winner' : ''}${defIsMe ? ' my-side' : ''}">
      <div class="bv-result-emblem def">🛡</div>
      <div class="bv-result-stat-label" style="color:#ff7043">DEF${defIsMe ? _meBadge.replace('#4fc3f7','#ff7043') : ''}${defResultBadge}</div>
      <div class="bv-result-stat-row"><span>투입 함선</span><b>${bv.battle.def_ships_total || 0}</b></div>
      <div class="bv-result-stat-row"><span>격침</span><b style="color:#ef5350">${bv.battle.def_ships_lost || 0}</b></div>
      <div class="bv-result-stat-row"><span>생존</span><b style="color:#66bb6a">${(bv.battle.def_ships_total || 0) - (bv.battle.def_ships_lost || 0)}</b></div>
      <div class="bv-result-stat-row"><span>총 데미지</span><b>${formatNum(summary.def?.damage_dealt || 0)}</b></div>
    </div>
    <div id="bvReportSection" style="margin-top:12px;width:100%;border-top:1px solid rgba(255,255,255,.12);padding-top:10px">
      <div id="bvReportContent" style="color:rgba(255,255,255,.4);font-size:11px;text-align:center">${t('bv_report_loading')}</div>
    </div>
  `;

  // [v7.221 upgrade #3] AI 전투 리매치 버튼 — 이번 결과가 방금 끝낸 AI 전투(_lastAiChallenge.battleId 일치)일 때만 표시.
  try {
    var _rb = document.getElementById('bvRematchBtn');
    if (_rb) {
      var _la = window._lastAiChallenge;
      var _canRematch = _la && bv.battle && String(_la.battleId) === String(bv.battle.id);
      _rb.style.display = _canRematch ? '' : 'none';
    }
  } catch(_) {}

  // 시각 시뮬이 충분히 재생되도록 2초 후 결과 카드 표시 (Bug2: HP 감소 전 승리 방지)
  _setActiveTimeout(() => {
    if (!document.getElementById('battleViewer')?.classList.contains('active')) return;
    overlay.classList.add('active');
    // 결과 카드 표시 시 보상 토스트 숨김 (Bug4: 창 중복 방지)
    document.getElementById('rewardToast')?.classList.remove('show');
  }, 2000);

  // 비동기로 상세 리포트 + 보상 정보 로드
  if (bv.battle?.id) _loadBattleReport(bv.battle.id, mySide);
  if (bv.battle?.id) _injectRewardIntoResult(bv.battle.id);

  // 내 전투 기록 갱신 (배틀허브 열려 있으면 history 탭도 새로고침)
  _setActiveTimeout(function() {
    try {
      if (document.getElementById('battleHubModal')?.classList.contains('active')) {
        battleHubState.currentTab = 'history';
        document.querySelectorAll('.bh-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === 'history'));
        bhLoad();
      }
    } catch(_) {}
  }, 3000);
}

// [v7.221 upgrade #3] 리매치 — 결과 뷰어 닫고 같은 AI 상대 재도전. challengeAi 재사용.
function bvRematch(){
  var la = window._lastAiChallenge;
  if (!la || la.aiFleetId == null) { showFactionToast(tl('No rematch target','리매치 상대 없음','再戦相手なし','无对手'),'error'); return; }
  try { closeBattleViewer(); } catch(_){}
  _setActiveTimeout(function(){ try { challengeAi(la.aiFleetId, la.aiName || 'AI'); } catch(e){ console.error('bvRematch:', e); } }, 300);
}

// Bug4: 전투 결과 카드에 보상 인라인 표시 (별도 토스트 대체)
async function _injectRewardIntoResult(battleId) {
  try {
    const myWallet = getMyWallet();
    if (!myWallet) return;
    const data = await battleHubReadKeyed('battle-rewards:' + battleId, `/api/battles/${battleId}/rewards`, 10000);
    if (!data) return;
    const myReward = (data.rewards || []).find(r =>
      r.wallet_address.toLowerCase() === myWallet.toLowerCase()
    );
    if (!myReward) return;

    const breakdown = (typeof myReward.breakdown === 'string') ? JSON.parse(myReward.breakdown) : (myReward.breakdown || {});
    const mineralsAwarded = (typeof myReward.minerals_awarded === 'string') ? JSON.parse(myReward.minerals_awarded || '{}') : (myReward.minerals_awarded || {});

    // 보상 행 HTML
    let html = '';
    if (myReward.gp_awarded > 0) {
      html += `<div style="display:flex;justify-content:space-between;font-size:11px;padding:3px 0"><span>💰 Galactic Points</span><b style="color:#ffd54f">+${myReward.gp_awarded}</b></div>`;
    }
    if (breakdown.sector_conflict_bonus) {
      html += `<div style="display:flex;justify-content:space-between;font-size:11px;padding:3px 0"><span>⚔ ${LANG==='ko'?'분쟁 섹터 보너스':LANG==='ja'?'紛争セクター報酬':LANG==='zh'?'争端区奖励':'Conflict Sector Bonus'}</span><b style="color:#ffab40">+${breakdown.sector_conflict_bonus} GP</b></div>`;
    }
    if (breakdown.alliance_treasury_bonus) {
      html += `<div style="display:flex;justify-content:space-between;font-size:11px;padding:3px 0"><span>🛡 ${LANG==='ko'?'동맹 금고 배당':LANG==='ja'?'同盟金庫配当':LANG==='zh'?'联盟金库分红':'Alliance Treasury'}</span><b style="color:#80cbc4">+${breakdown.alliance_treasury_bonus} GP</b></div>`;
    }
    if (breakdown.environment_salvage) {
      const salvage = breakdown.environment_salvage || {};
      html += `<div style="display:flex;justify-content:space-between;font-size:11px;padding:3px 0"><span>🧲 ${LANG==='ko'?'전장 회수':LANG==='ja'?'戦場回収':LANG==='zh'?'战场回收':'Field Salvage'}${breakdown.battlefield_label ? ' · ' + escapeHtml(breakdown.battlefield_label) : ''}</span><b style="color:#7dd3fc">${escapeHtml(salvage.resource_code || '')} ×${salvage.quantity || 0}</b></div>`;
    }
    for (const [code, qty] of Object.entries(mineralsAwarded || {})) {
      if (!qty) continue;
      const icon = (typeof MINERAL_ICONS !== 'undefined' && MINERAL_ICONS[code]) || '🟫';
      const name = (typeof MINERAL_KO !== 'undefined' && MINERAL_KO[code]) || code;
      html += `<div style="display:flex;justify-content:space-between;font-size:11px;padding:3px 0"><span>${icon} ${name}</span><b style="color:#81c784">+${qty}</b></div>`;
    }
    html += `<div style="margin-top:6px;padding:6px 8px;border-radius:6px;border:1px solid rgba(91,184,232,.22);background:rgba(91,184,232,.055);font-size:10px;line-height:1.45;color:var(--tx2)"><b style="color:var(--cyan)">▸ ${LANG==='ko'?'다음 행동':LANG==='ja'?'次の行動':LANG==='zh'?'下一步':'Next move'}</b><br>${battleRewardNextStep(myReward, breakdown, mineralsAwarded)}</div>`;
    if (!html) return;

    // 결과 카드 actions 앞에 보상 섹션 삽입
    const stats = document.getElementById('bvResultStats');
    if (!stats) return;
    const existing = stats.querySelector('#bvInlineReward');
    if (existing) return; // 중복 방지
    const div = document.createElement('div');
    div.id = 'bvInlineReward';
    div.style.cssText = 'margin-top:12px;width:100%;border-top:1px solid rgba(255,215,0,.2);padding-top:10px';
    div.innerHTML = `<div style="font-size:10px;font-weight:700;color:#ffd54f;letter-spacing:.8px;margin-bottom:6px">🏆 ${myReward.is_winner ? (LANG==='ko'?'승리 보상':LANG==='ja'?'勝利報酬':LANG==='zh'?'胜利奖励':'Victory Reward') : (LANG==='ko'?'참가 보상':LANG==='ja'?'参加報酬':LANG==='zh'?'参与奖励':'Participation Reward')}</div>${html}`;
    stats.appendChild(div);
  } catch (_) {}
}

// 전투 리포트 카드 비동기 로드
async function _loadBattleReport(battleId, mySide) {
  const section = document.getElementById('bvReportContent');
  if (!section) return;
  try {
    const data = await battleHubReadKeyed('battle-report:' + battleId, `/api/battles/${battleId}/report`, 15000);
    if (!data) throw new Error('fetch deferred');
    const r = data.report;
    if (!r) throw new Error('no report');

    const myData = mySide === 'atk' ? r.atk : mySide === 'def' ? r.def : null;
    const classBD = myData ? (myData.class_breakdown || []) : [];
    const allianceHtml = renderBattleReportAllianceBanner(r);

    // 📊 클래스별 성과
    let classHtml = '';
    if (classBD.length > 0) {
      const rows = classBD.map(c => {
        const barWidth = c.survival_pct;
        const barColor = c.survival_pct >= 80 ? '#66bb6a' : c.survival_pct >= 40 ? '#ffa726' : '#ef5350';
        const perfColor = c.survival_pct >= 80 ? '#66bb6a' : c.survival_pct >= 40 ? '#ffd54f' : 'rgba(255,255,255,.4)';
        return `<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">
          <span style="font-size:10px;color:rgba(255,255,255,.7);width:48px;flex-shrink:0">${c.class_label}</span>
          <div style="flex:1;height:6px;background:rgba(255,255,255,.08);border-radius:3px;overflow:hidden">
            <div style="height:100%;width:${barWidth}%;background:${barColor};border-radius:3px;transition:width .6s"></div>
          </div>
          <span style="font-size:9px;color:rgba(255,255,255,.5);width:36px;text-align:right;flex-shrink:0">생존 ${c.survival_pct}%</span>
          <span style="font-size:9px;color:${perfColor};width:52px;text-align:right;flex-shrink:0">${c.perf_label}</span>
        </div>`;
      }).join('');
      classHtml = `
        <div style="margin-bottom:10px">
          <div style="font-size:9px;color:rgba(255,255,255,.4);letter-spacing:1px;margin-bottom:6px;display:flex;align-items:center;gap:4px">
            <span>📊</span><span>클래스별 성과</span>
          </div>
          ${rows}
        </div>`;
    }

    // ⚡ 전술 사용 요약
    let skillHtml = '';
    if (mySide && r.event_stats) {
      const es = r.event_stats || {};
      const mine = (es.skillsUsed && es.skillsUsed[mySide]) || {};
      const oppSide = mySide === 'atk' ? 'def' : 'atk';
      const opp = (es.skillsUsed && es.skillsUsed[oppSide]) || {};
      const mineRepair = Math.round((es.repairDone && es.repairDone[mySide]) || 0);
      const oppRepair = Math.round((es.repairDone && es.repairDone[oppSide]) || 0);
      const skillRows = [
        ['빔포', mine.beam || 0, opp.beam || 0],
        ['미사일', mine.missile || 0, opp.missile || 0],
        ['EMP', mine.emp || 0, opp.emp || 0],
        ['수리', mineRepair, oppRepair],
      ].map(row => `<div style="display:grid;grid-template-columns:56px 1fr 1fr;gap:6px;align-items:center;font-size:10px;padding:2px 0">
        <span style="color:rgba(255,255,255,.42)">${row[0]}</span>
        <span style="color:#4fc3f7;text-align:right">${formatNum(row[1])}</span>
        <span style="color:#ff8a80;text-align:right">${formatNum(row[2])}</span>
      </div>`).join('');
      skillHtml = `
        <div style="margin-bottom:10px;padding:8px 10px;background:rgba(255,255,255,.035);border:1px solid rgba(255,255,255,.08);border-radius:5px">
          <div style="display:grid;grid-template-columns:56px 1fr 1fr;gap:6px;font-size:9px;color:rgba(255,255,255,.36);letter-spacing:1px;margin-bottom:4px">
            <span>⚡ 전술</span><span style="text-align:right">내 함대</span><span style="text-align:right">상대</span>
          </div>
          ${skillRows}
        </div>`;
    }

    // 🧩 역할/상성 구도
    let roleHtml = '';
    if (mySide && r.atk && r.def) {
      const mineSideData = mySide === 'atk' ? r.atk : r.def;
      const oppSideData = mySide === 'atk' ? r.def : r.atk;
      const myRoles = mineSideData.role_counts || {};
      const oppRoles = oppSideData.role_counts || {};
      const roleOrder = ['tackle', 'ewar', 'dps', 'tank', 'sniper', 'bomb', 'logi'];
      const roleRows = roleOrder.filter(role => (myRoles[role] || 0) || (oppRoles[role] || 0)).map(role => {
        const info = (typeof shipRoleInfo === 'function') ? shipRoleInfo(role) : { label: role.toUpperCase() };
        const mineN = myRoles[role] || 0;
        const oppN = oppRoles[role] || 0;
        const color = mineN > oppN ? '#66bb6a' : mineN < oppN ? '#ff8a80' : 'rgba(255,255,255,.68)';
        return `<div style="display:grid;grid-template-columns:70px 1fr 1fr;gap:6px;align-items:center;font-size:10px;padding:2px 0">
          <span style="color:rgba(255,255,255,.42)">${escapeHtml(info.label || role)}</span>
          <span style="color:${color};text-align:right">${mineN}</span>
          <span style="color:rgba(255,138,128,.86);text-align:right">${oppN}</span>
        </div>`;
      }).join('');
      if (roleRows) {
        roleHtml = `
          <div style="margin-bottom:10px;padding:8px 10px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.08);border-radius:5px">
            <div style="display:grid;grid-template-columns:70px 1fr 1fr;gap:6px;font-size:9px;color:rgba(255,255,255,.36);letter-spacing:1px;margin-bottom:4px">
              <span>🧩 역할</span><span style="text-align:right">내 함대</span><span style="text-align:right">상대</span>
            </div>
            ${roleRows}
          </div>`;
      }
    }

    // 💸 영구 손실 / 손실 가치
    let lossValueHtml = '';
    if (mySide && r.atk && r.def) {
      const mineSideData = mySide === 'atk' ? r.atk : r.def;
      const oppSideData = mySide === 'atk' ? r.def : r.atk;
      const mineLossShips = Number(mineSideData.full_loss_ships || 0);
      const oppLossShips = Number(oppSideData.full_loss_ships || 0);
      const mineLossValue = Number(mineSideData.loss_value_gp || 0);
      const oppLossValue = Number(oppSideData.loss_value_gp || 0);
      if (mineLossShips || oppLossShips || mineLossValue || oppLossValue) {
        lossValueHtml = `
          <div style="margin-bottom:10px;padding:8px 10px;background:rgba(255,213,79,.045);border:1px solid rgba(255,213,79,.18);border-radius:5px">
            <div style="display:grid;grid-template-columns:86px 1fr 1fr;gap:6px;font-size:9px;color:rgba(255,255,255,.36);letter-spacing:1px;margin-bottom:4px">
              <span>💸 자산 손실</span><span style="text-align:right">내 함대</span><span style="text-align:right">상대</span>
            </div>
            <div style="display:grid;grid-template-columns:86px 1fr 1fr;gap:6px;align-items:center;font-size:10px;padding:2px 0">
              <span style="color:rgba(255,255,255,.42)">영구 손실</span>
              <span style="color:${mineLossShips ? '#ff8a80' : 'rgba(255,255,255,.45)'};text-align:right">${mineLossShips}척</span>
              <span style="color:${oppLossShips ? '#66bb6a' : 'rgba(255,255,255,.45)'};text-align:right">${oppLossShips}척</span>
            </div>
            <div style="display:grid;grid-template-columns:86px 1fr 1fr;gap:6px;align-items:center;font-size:10px;padding:2px 0">
              <span style="color:rgba(255,255,255,.42)">손실 가치</span>
              <span style="color:${mineLossValue ? '#ff8a80' : 'rgba(255,255,255,.45)'};text-align:right">${formatNum(mineLossValue)} GP</span>
              <span style="color:${oppLossValue ? '#66bb6a' : 'rgba(255,255,255,.45)'};text-align:right">${formatNum(oppLossValue)} GP</span>
            </div>
          </div>`;
      }
    }

    // 🔍 전투 분석 / 패인 분석
    let analysisHtml = '';
    const analysisItems = Array.isArray(r.analysis_items) && r.analysis_items.length
      ? r.analysis_items
      : (r.analysis_ko ? [{ severity:'info', text:r.analysis_ko }] : []);
    if (analysisItems.length > 0 && mySide) {
      const iLost = mySide && r.winner_side && mySide !== r.winner_side;
      const titleText = iLost
        ? (LANG==='ko'?'패인 분석':LANG==='ja'?'敗因分析':LANG==='zh'?'败因分析':'Loss Analysis')
        : (LANG==='ko'?'전투 해석':LANG==='ja'?'戦闘分析':LANG==='zh'?'战斗分析':'Battle Read');
      const borderColor = iLost ? 'rgba(239,83,80,.4)' : 'rgba(79,195,247,.4)';
      const bgColor = iLost ? 'rgba(239,83,80,.06)' : 'rgba(79,195,247,.06)';
      const rows = analysisItems.slice(0, 3).map(item => {
        const sev = item.severity || 'info';
        const dot = sev === 'critical' ? '#ef5350' : sev === 'warning' ? '#ffd54f' : '#4fc3f7';
        return `<div style="display:flex;gap:6px;align-items:flex-start;margin-top:4px">
          <span style="width:6px;height:6px;border-radius:50%;background:${dot};margin-top:6px;flex-shrink:0"></span>
          <span style="font-size:10px;color:rgba(255,255,255,.72);line-height:1.5">${escapeHtml(item.text || '')}</span>
        </div>`;
      }).join('');
        analysisHtml = `
          <div style="margin-bottom:10px;padding:8px 10px;background:${bgColor};border-left:3px solid ${borderColor};border-radius:0 4px 4px 0">
            <div style="font-size:9px;color:rgba(255,255,255,.4);letter-spacing:1px;margin-bottom:5px;display:flex;align-items:center;gap:4px">
              <span>🔍</span><span>${titleText}</span>
            </div>
            ${rows}
          </div>`;
    }

    // 💡 추천 개선
    let recHtml = '';
    const recommendationItems = Array.isArray(r.recommendation_items) && r.recommendation_items.length
      ? r.recommendation_items.map(x => x.text || '')
      : (r.recommendations_ko || []);
    if (recommendationItems.length > 0 && mySide) {
      const iLost = mySide && r.winner_side && mySide !== r.winner_side;
      if (iLost || r.winner_side === 'draw') {
        const recRows = recommendationItems.slice(0, 4).map(rec =>
          `<div style="font-size:10px;color:rgba(255,255,255,.65);padding:2px 0">→ ${escapeHtml(rec)}</div>`
        ).join('');
        recHtml = `
          <div style="margin-bottom:10px">
            <div style="font-size:9px;color:rgba(255,255,255,.4);letter-spacing:1px;margin-bottom:5px;display:flex;align-items:center;gap:4px">
              <span>💡</span><span>추천 개선</span>
            </div>
            ${recRows}
          </div>`;
      }
    }

    // ✅ 리플레이 하이라이트 3장면
    let highlightHtml = '';
    try {
      const hlData = await battleHubReadKeyed('battle-highlights:' + battleId, `/api/battles/${battleId}/highlights`, 15000);
      if (hlData) {
        const hl = (hlData.highlights || []).filter(h => h.type !== 'battle_end').slice(0, 3);
        if (hl.length > 0) {
          const hlIconMap = {
            first_kill: '💥',
            flagship_threatened: '🚨',
            turning_point: '⚡',
          };
          const hlLabelMap = {
            first_kill: LANG==='ko'?'첫 격침':LANG==='ja'?'初撃沈':LANG==='zh'?'首次击沉':'First Kill',
            flagship_threatened: LANG==='ko'?'기함 위기':LANG==='ja'?'旗艦危機':LANG==='zh'?'旗舰危机':'Flagship Threatened',
            turning_point: LANG==='ko'?'전세 역전':LANG==='ja'?'形勢逆転':LANG==='zh'?'形势逆转':'Turning Point',
          };
          const hlRows = hl.map(h => {
            const icon = hlIconMap[h.type] || '▶';
            const label = hlLabelMap[h.type] || h.type;
            return `<button type="button" onclick="openBattleViewerAt(${battleId},${h.tick||0})"
              style="display:flex;align-items:center;gap:6px;width:100%;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.12);border-radius:4px;padding:5px 8px;margin-bottom:4px;cursor:pointer;color:inherit;font-family:var(--fn);text-align:left">
              <span style="font-size:13px">${icon}</span>
              <span style="flex:1;font-size:10px;color:rgba(255,255,255,.75)">${label}</span>
              <span style="font-size:9px;color:rgba(255,255,255,.35)">tick ${h.tick||0}</span>
              <span style="font-size:9px;color:var(--cyan)">▶ ${LANG==='ko'?'이동':LANG==='ja'?'移動':LANG==='zh'?'跳转':'Jump'}</span>
            </button>`;
          }).join('');
          highlightHtml = `
            <div style="margin-bottom:10px">
              <div style="font-size:9px;color:rgba(255,255,255,.4);letter-spacing:1px;margin-bottom:6px;display:flex;align-items:center;gap:4px">
                <span>🎬</span><span>${LANG==='ko'?'하이라이트 장면':LANG==='ja'?'ハイライトシーン':LANG==='zh'?'高光时刻':'Highlights'}</span>
              </div>
              ${hlRows}
            </div>`;
        }
      }
    } catch (_) {}

    // 내 전투 기록 버튼
    const statsBtn = `<div style="margin-top:8px;display:flex;justify-content:center">
      <button type="button" onclick="_showMyBattleStats()" style="background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.18);color:#fff;padding:5px 14px;border-radius:4px;cursor:pointer;font-size:10px;font-family:var(--fn)">📈 ${t('bv_my_stats')}</button>
    </div>`;

    section.innerHTML = allianceHtml + classHtml + skillHtml + roleHtml + lossValueHtml + analysisHtml + recHtml + highlightHtml + statsBtn;

  } catch (_) {
    if (section) section.innerHTML = `
      <div style="color:rgba(255,255,255,.3);font-size:10px;text-align:center">${t('bv_report_error')}</div>
      <div style="margin-top:8px;display:flex;justify-content:center">
        <button type="button" onclick="_showMyBattleStats()" style="background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.2);color:#fff;padding:5px 12px;border-radius:4px;cursor:pointer;font-size:10px">${t('bv_my_stats')}</button>
      </div>`;
  }
}

function renderBattleReportAllianceBanner(report) {
  const atk = report && report.atk;
  const def = report && report.def;
  if (!((atk && (atk.alliance_tag || atk.alliance_name)) || (def && (def.alliance_tag || def.alliance_name)))) return '';
  return `<div style="margin-bottom:10px;padding:8px 10px;background:rgba(128,203,196,.045);border:1px solid rgba(128,203,196,.16);border-radius:5px">
    <div style="font-size:9px;color:rgba(255,255,255,.38);letter-spacing:1px;margin-bottom:6px">🛡 ${LANG==='ko'?'동맹 교전':LANG==='ja'?'同盟交戦':LANG==='zh'?'联盟交战':'Alliance Clash'}</div>
    <div style="display:grid;grid-template-columns:1fr auto 1fr;gap:8px;align-items:center;font-size:10px">
      ${renderBattleReportAllianceSide(atk, 'ATK', '#4fc3f7')}
      <span style="color:rgba(255,255,255,.32);font-size:9px">VS</span>
      ${renderBattleReportAllianceSide(def, 'DEF', '#ff8a80')}
    </div>
  </div>`;
}

function renderBattleReportAllianceSide(side, fallback, sideColor) {
  const colorRaw = String((side && side.alliance_color) || sideColor || '#80cbc4');
  const color = /^#[0-9a-f]{3,8}$/i.test(colorRaw) ? colorRaw : (sideColor || '#80cbc4');
  const name = side && (side.alliance_name || side.alliance_tag);
  const tag = side && side.alliance_tag;
  const label = tag ? '[' + escapeHtml(tag) + '] ' + escapeHtml(name || '') : escapeHtml(name || fallback);
  const fleet = side && side.fleet_name ? escapeHtml(side.fleet_name) : fallback;
  return `<div style="min-width:0;text-align:${fallback === 'ATK' ? 'left' : 'right'}">
    <div title="${escapeAttr(name || fallback)}" style="color:${color};font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${label}</div>
    <div style="color:rgba(255,255,255,.38);font-size:8px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${fleet}</div>
  </div>`;
}

// 내 전투 기록 모달
async function _showMyBattleStats() {
  const wallet = walletState?.address;
  if (!wallet) return;
  try {
    const data = await battleHubReadKeyed('my-stats:' + wallet, `/api/battles/my-stats/${wallet}`, 30000);
    if (!data) throw new Error('fetch deferred');
    const s = data.stats || {};
    const _ratingColor = { S:'#ffd700', A:'#66bb6a', B:'#4fc3f7', C:'#ffa726', D:'#ef5350' };
    const bestCol = _ratingColor[s.best_rating] || '#aaa';
    await gameConfirm({
      icon: '📊',
      title: t('bvstat_title'),
      body: `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px 16px;margin:8px 0">
          <div><span style="color:rgba(255,255,255,.5);font-size:11px">${t('bvstat_total')}</span><br><b>${s.total_battles||0}</b></div>
          <div><span style="color:rgba(255,255,255,.5);font-size:11px">${t('bvstat_winrate')}</span><br><b>${s.win_rate||0}%</b></div>
          <div><span style="color:rgba(255,255,255,.5);font-size:11px">${t('bvstat_w')}/${t('bvstat_l')}/${t('bvstat_d')}</span><br><b>${s.wins||0} / ${s.losses||0} / ${s.draws||0}</b></div>
          <div><span style="color:rgba(255,255,255,.5);font-size:11px">${t('bvstat_kd')}</span><br><b>${s.kill_death_ratio||0}</b></div>
          <div><span style="color:rgba(255,255,255,.5);font-size:11px">${t('bvstat_streak')}</span><br><b>${s.longest_win_streak||0}</b></div>
          <div><span style="color:rgba(255,255,255,.5);font-size:11px">${t('bvstat_best')}</span><br><b style="color:${bestCol};font-size:20px;font-weight:900">${s.best_rating||'—'}</b></div>
        </div>
      `,
      confirmText: t('bvstat_close'),
      disabled: false
    });
  } catch (_) { showToast('Stats unavailable', 'error'); }
}
