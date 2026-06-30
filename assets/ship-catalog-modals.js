(function() {
  let regState = { ships: null, currentFaction: 'mcc', resources: null };

  const FACTION_META = {
    mcc: {
      full: 'Mars Corporate Consortium',
      desc: LANG === 'ko' ? '기업 연합 · 장거리 레일건' : LANG === 'ja' ? '企業連合・長距離レールガン' : LANG === 'zh' ? '企业联合·远程轨道炮' : 'Corporate Alliance · Long-range Railgun',
      color: '#4fc3f7',
    },
    fsp: {
      full: 'Free Settlers Pact',
      desc: LANG === 'ko' ? '자유 정착자 · 드론/로지' : LANG === 'ja' ? '自由入植者・ドローン/ロジ' : LANG === 'zh' ? '自由定居者·无人机/后勤' : 'Free Settlers · Drone/Logi',
      color: '#81c784',
    },
    cv: {
      full: 'Crimson Verdict',
      desc: LANG === 'ko' ? '해적 연합 · 근접 돌격' : LANG === 'ja' ? '海賊連合・近接突撃' : LANG === 'zh' ? '海盗联合·近战突击' : 'Pirate Alliance · Close Assault',
      color: '#ef5350',
    },
  };

  async function fetchRegistryShips() {
    if (regState.ships) return regState.ships;
    try {
      const res = await fetch('/api/tactical-lab/catalog');
      if (!res.ok) throw new Error('fetch failed');
      const data = await res.json();
      regState.ships = (data.ships || []).map(function(ship) {
        return Object.assign({}, ship, { can_build: true, locks: [] });
      });
      if (!regState.resources && data.resources) regState.resources = data.resources;
      return regState.ships;
    } catch (err) {
      console.error('[registry]', err);
      return null;
    }
  }

  async function fetchResourceCatalog() {
    if (regState.resources) return regState.resources;
    try {
      const res = await fetch('/api/resources/catalog');
      if (!res.ok) throw new Error('fetch failed');
      const data = await res.json();
      regState.resources = data.resources || [];
      return regState.resources;
    } catch (err) {
      console.error('[minerals]', err);
      return null;
    }
  }

  function escapeHtml(s) {
    if (s == null) return '';
    return String(s).replace(/[&<>"']/g, function(c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function renderRegistry() {
    const grid = document.getElementById('regGrid');
    if (!grid) return;
    if (!regState.ships) {
      grid.innerHTML = '<div class="reg-loading">' + tl('Loading...', '로딩 중...', '読み込み中...', '加载中...') + '</div>';
      return;
    }

    const faction = regState.currentFaction;
    const meta = FACTION_META[faction];
    const desc = document.getElementById('regFactionDesc');
    if (desc) desc.textContent = meta.full + ' · ' + meta.desc;
    const list = regState.ships.filter(function(ship) {
      return ship.faction_code === faction;
    });
    if (!list.length) {
      grid.innerHTML = '<div class="reg-loading">' + tl('No ships for this faction.', '이 파벌의 함선이 없습니다.', 'この派閥の艦船はありません。', '该派系没有舰船。') + '</div>';
      return;
    }

    const resMap = {};
    (regState.resources || []).forEach(function(resource) {
      resMap[resource.code] = resource;
    });

    grid.innerHTML = list.map(function(ship) {
      const recipe = ship.recipe_minerals || {};
      const recipeRows = Object.entries(recipe).map(function(entry) {
        const code = entry[0];
        const qty = entry[1];
        const mineral = resMap[code];
        const icon = mineral ? (mineral.icon_emoji || '●') : '●';
        const name = mineral ? (mineral.name_ko || mineral.name_en || code) : code;
        return icon + ' ' + name + '×' + qty;
      }).join(' · ');
      const buildHrs = ship.build_time_seconds
        ? (ship.build_time_seconds >= 3600 ? (ship.build_time_seconds / 3600).toFixed(1) + 'h' : Math.ceil(ship.build_time_seconds / 60) + 'min')
        : '-';
      const isCap = !!ship.is_capital;
      const size = (ship.size_class || '').toUpperCase();
      const role = (ship.role || 'dps').toLowerCase();
      const lockBadge = ship.can_build ? '' : '<div class="reg-lock">🔒 ' + (ship.locks || []).join(' · ') + '</div>';
      const capBadge = isCap ? '<span class="reg-cap">👑 ' + tl('CAPITAL', '캐피털', '主力艦', '主力舰') + '</span>' : '';
      const serverCount = ship.max_per_server ? ' · ' + (ship.server_alive_count || 0) + '/' + ship.max_per_server : '';
      return `
        <div class="reg-card ${faction}">
          <div class="reg-sname" style="color:${meta.color}">${escapeHtml(ship.name_en || ship.code)}${capBadge}</div>
          <div class="reg-scls">${escapeHtml(ship.class_label || size)} · T${ship.tier || 1}${serverCount}</div>
          <span class="reg-srole ${role}">${role.toUpperCase()}</span>
          <div class="reg-stats">
            <div class="reg-stat-row"><span>HP</span><span>${Number(ship.base_hp || 0).toLocaleString()}</span></div>
            <div class="reg-stat-row"><span>ATK</span><span>${ship.base_atk || 0}</span></div>
            <div class="reg-stat-row"><span>DEF</span><span>${ship.base_def || 0}</span></div>
            <div class="reg-stat-row"><span>SPD</span><span>${ship.base_speed || 0}</span></div>
          </div>
          <div class="reg-recipe">
            <b>${tl('BUILD', '건조', '建造', '建造')} ${buildHrs}</b> · GP ${Number(ship.build_gp_cost || 0).toLocaleString()}<br>
            ${escapeHtml(recipeRows || tl('No recipe', '레시피 없음', 'レシピなし', '无配方'))}
          </div>
          ${lockBadge}
        </div>
      `;
    }).join('');
  }

  function getMineralTitle(tier) {
    const titles = {
      0: LANG === 'ko' ? 'TIER 0 — 기본 광물 (모든 섹터)' : LANG === 'ja' ? 'TIER 0 — 基本鉱物 (全セクター)' : LANG === 'zh' ? 'TIER 0 — 基础矿物 (所有扇区)' : 'TIER 0 — Basic Minerals (All Sectors)',
      1: LANG === 'ko' ? 'TIER 1 — 희귀 광물 (Mid/Frontier)' : LANG === 'ja' ? 'TIER 1 — 希少鉱物 (Mid/Frontier)' : LANG === 'zh' ? 'TIER 1 — 稀有矿物 (Mid/Frontier)' : 'TIER 1 — Rare Minerals (Mid/Frontier)',
      2: LANG === 'ko' ? 'TIER 2 — 특수 소재 (Frontier·이벤트)' : LANG === 'ja' ? 'TIER 2 — 特殊素材 (Frontier·イベント)' : LANG === 'zh' ? 'TIER 2 — 特殊材料 (Frontier·活动)' : 'TIER 2 — Special Materials (Frontier·Events)',
      3: LANG === 'ko' ? 'TIER 3 — 중간 부품 (유저 제작)' : LANG === 'ja' ? 'TIER 3 — 中間部品 (プレイヤー製作)' : LANG === 'zh' ? 'TIER 3 — 中间零件 (玩家制作)' : 'TIER 3 — Crafted Components (Player-made)',
    };
    return titles[tier];
  }

  function renderMinerals() {
    const body = document.getElementById('minBody');
    if (!body) return;
    if (!regState.resources) {
      body.innerHTML = '<div class="reg-loading">' + tl('Loading...', '로딩 중...', '読み込み中...', '加载中...') + '</div>';
      return;
    }

    const byTier = { 0: [], 1: [], 2: [], 3: [] };
    regState.resources.forEach(function(resource) {
      const tier = resource.tier != null ? resource.tier : 0;
      if (!byTier[tier]) byTier[tier] = [];
      byTier[tier].push(resource);
    });

    body.innerHTML = [0, 1, 2, 3].map(function(tier) {
      const list = byTier[tier] || [];
      if (!list.length) return '';
      const cards = list.map(function(mineral) {
        let source = '';
        if (mineral.is_craftable && mineral.craft_recipe) {
          const parts = Object.entries(mineral.craft_recipe).map(function(entry) {
            return entry[0] + '×' + entry[1];
          });
          source = '<div class="min-card-recipe">🔧 ' + escapeHtml(parts.join(' + ')) + '</div>';
        } else if (mineral.description_ko || mineral.description_en) {
          const desc = LANG === 'ko'
            ? (mineral.description_ko || mineral.description_en || '')
            : LANG === 'ja'
              ? (mineral.description_ja || mineral.description_en || mineral.description_ko || '')
              : LANG === 'zh'
                ? (mineral.description_zh || mineral.description_en || mineral.description_ko || '')
                : (mineral.description_en || mineral.description_ko || '');
          source = '<div class="min-card-src">' + escapeHtml(desc) + '</div>';
        }

        const name = LANG === 'ko'
          ? (mineral.name_ko || mineral.code)
          : LANG === 'ja'
            ? (mineral.name_ja || mineral.name_en || mineral.code)
            : LANG === 'zh'
              ? (mineral.name_zh || mineral.name_en || mineral.code)
              : (mineral.name_en || mineral.code);
        return `
          <div class="min-card">
            <div class="min-card-icon" style="color:${mineral.color_hex || '#fff'}">${mineral.icon_emoji || '●'}</div>
            <div class="min-card-info">
              <div class="min-card-name" style="color:${mineral.color_hex || '#fff'}">${escapeHtml(name)}</div>
              <div class="min-card-en">${escapeHtml(LANG !== 'en' ? (mineral.name_en || '') : '')}</div>
              ${source}
            </div>
          </div>
        `;
      }).join('');
      return `
        <div class="min-section">
          <div class="min-sect-title">// ${getMineralTitle(tier)}</div>
          <div class="min-grid">${cards}</div>
        </div>
      `;
    }).join('');
  }

  window.openShipCatalog = async function() {
    const modal = document.getElementById('shipRegistryModal');
    const grid = document.getElementById('regGrid');
    if (!modal || !grid) return;
    modal.classList.add('active');
    grid.innerHTML = '<div class="reg-loading">' + tl('Loading...', '로딩 중...', '読み込み中...', '加载中...') + '</div>';
    await Promise.all([fetchRegistryShips(), fetchResourceCatalog()]);
    renderRegistry();
  };

  window.closeShipCatalog = function() {
    const modal = document.getElementById('shipRegistryModal');
    if (modal) modal.classList.remove('active');
  };

  window.showShipCatalogFaction = function(faction, btn) {
    regState.currentFaction = faction;
    document.querySelectorAll('.reg-tab').forEach(function(tab) {
      tab.classList.remove('on');
    });
    btn.classList.add('on');
    renderRegistry();
  };

  window.openMineralCatalog = async function() {
    const modal = document.getElementById('mineralsModal');
    const body = document.getElementById('minBody');
    if (!modal || !body) return;
    modal.classList.add('active');
    body.innerHTML = '<div class="reg-loading">' + tl('Loading...', '로딩 중...', '読み込み中...', '加载中...') + '</div>';
    await fetchResourceCatalog();
    renderMinerals();
  };

  window.closeMineralCatalog = function() {
    const modal = document.getElementById('mineralsModal');
    if (modal) modal.classList.remove('active');
  };
})();
