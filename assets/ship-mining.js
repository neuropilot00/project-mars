'use strict';

(function () {
  var state = { info: null, jobs: [], fleets: [], loading: false };

  function txt(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (ch) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch];
    });
  }

  function lang(en, ko, ja, zh) {
    var l = typeof LANG !== 'undefined' ? LANG : 'en';
    return l === 'ko' ? ko : l === 'ja' ? ja : l === 'zh' ? zh : en;
  }

  function authHeaders(json) {
    var base = (typeof getAuthHeaders === 'function') ? getAuthHeaders() : {};
    return json ? Object.assign({ 'Content-Type': 'application/json' }, base) : base;
  }

  function toast(message, type) {
    if (typeof showToast === 'function') showToast(message, type);
  }

  function jsonFetch(url, options) {
    return fetch(url, options || {}).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (data) {
        if (!res.ok) throw new Error(data.error || ('HTTP_' + res.status));
        return data;
      });
    });
  }

  function routeName(key) {
    return {
      frontier: lang('Frontier Belt', '외곽 벨트', '辺境ベルト', '边境带'),
      mid: lang('Contested Midline', '분쟁 중간권', '係争中間圏', '争夺中线'),
      core: lang('Core Extraction Zone', '핵심 채굴권', '中核採掘圏', '核心开采区')
    }[key] || String(key || '-').toUpperCase();
  }

  function pct(v) {
    return Math.round((Number(v) || 0) * 100);
  }

  function routeRiskLabel(d) {
    var raid = Number(d && d.raidPct) || 0;
    var wear = Number(d && d.wearMult) || 1;
    if (raid >= 0.12 || wear >= 2.2) return lang('HIGH RISK', '고위험', '高リスク', '高风险');
    if (raid >= 0.04 || wear >= 1.4) return lang('CONTESTED', '분쟁권', '係争圏', '争夺区');
    return lang('SAFE', '안전권', '安全圏', '安全区');
  }

  function routeRiskColor(d) {
    var raid = Number(d && d.raidPct) || 0;
    var wear = Number(d && d.wearMult) || 1;
    if (raid >= 0.12 || wear >= 2.2) return '#ff8a80';
    if (raid >= 0.04 || wear >= 1.4) return 'var(--gold)';
    return '#64dc82';
  }

  function fleetCount(f) {
    return parseInt(f.ships_alive || f.ship_count || 0, 10) || 0;
  }

  function fleetCapacityEstimate(f) {
    var w = (state.info && state.info.capacityWeights) || {};
    var cap = 0;
    cap += (parseInt(f.frigate_count, 10) || 0) * (Number(w.frigate) || 1);
    cap += (parseInt(f.destroyer_count, 10) || 0) * (Number(w.destroyer) || 2);
    cap += (parseInt(f.cruiser_count, 10) || 0) * (Number(w.cruiser) || 4);
    cap += (parseInt(f.battleship_count, 10) || 0) * (Number(w.battleship) || 14);
    cap += (parseInt(f.titan_count, 10) || 0) * (Number(w.titan) || 60);
    cap += (parseInt(f.assembled_count, 10) || 0) * (Number(w.assembled) || 8);
    return Math.max(cap, fleetCount(f));
  }

  function currentSelections() {
    var fleet = document.getElementById('smFleetSelect');
    var dur = document.getElementById('smDurationSelect');
    var dest = document.getElementById('smDestinationSelect');
    return {
      fleetId: fleet && fleet.value,
      durationH: dur && dur.value,
      destination: dest && dest.value
    };
  }

  function activeFleetIds() {
    var ids = {};
    (state.jobs || []).forEach(function (j) {
      if (j.status === 'mining') ids[String(j.fleet_id)] = true;
    });
    return ids;
  }

  function renderShell(message) {
    var el = document.getElementById('smContent');
    if (el) el.innerHTML = '<div style="padding:12px;text-align:center;color:var(--tx3);border:1px solid var(--bdr);border-radius:8px;background:rgba(255,255,255,.03)">' + txt(message) + '</div>';
  }

  function renderMining() {
    var el = document.getElementById('smContent');
    if (!el) return;
    var info = state.info || {};
    if (!info.enabled) {
      renderShell(lang('Resource runs are disabled.', 'RESOURCE RUN이 비활성화되어 있습니다.', 'RESOURCE RUNは無効です。', '资源航线已停用。'));
      return;
    }

    var picks = currentSelections();
    var busy = activeFleetIds();
    var fleets = state.fleets || [];
    var readyFleets = fleets.filter(function (f) { return fleetCount(f) > 0; });
    var durations = info.durationsH || [1, 4, 8];
    var dests = info.destinations || [];
    var html = '';

    html += '<div style="border:1px solid rgba(100,220,130,.24);border-radius:8px;background:rgba(100,220,130,.04);padding:10px;margin-bottom:10px">';
    html += '<div style="display:flex;justify-content:space-between;gap:8px;align-items:center;margin-bottom:8px">';
    html += '<div style="font-size:10px;color:#64dc82;font-weight:900;letter-spacing:1px">' + lang('MINING ROUTE', '채굴 항로', '採掘航路', '采矿航线') + '</div>';
    html += '<button type="button" onclick="_renderShipMining()" style="font-size:8px;padding:3px 8px;border-radius:5px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.12);color:var(--tx3);font-family:var(--fn);cursor:pointer">REFRESH</button>';
    html += '</div>';
    html += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(82px,1fr));gap:5px;margin-bottom:9px">';
    html += '<div style="padding:6px;border-radius:6px;background:rgba(255,255,255,.035);border:1px solid rgba(255,255,255,.08)"><div style="font-size:8px;color:var(--tx3)">ACTIVE LIMIT</div><div style="font-size:10px;color:var(--tx);font-weight:800">' + txt(info.maxPerWallet || 0) + '</div></div>';
    html += '<div style="padding:6px;border-radius:6px;background:rgba(255,255,255,.035);border:1px solid rgba(255,255,255,.08)"><div style="font-size:8px;color:var(--tx3)">DAILY CAP</div><div style="font-size:10px;color:var(--gold);font-weight:800">' + (Number(info.gpCapPerDay) > 0 ? txt(info.gpCapPerDay) + ' GP' : 'OPEN') + '</div></div>';
    html += '<div style="padding:6px;border-radius:6px;background:rgba(255,255,255,.035);border:1px solid rgba(255,255,255,.08)"><div style="font-size:8px;color:var(--tx3)">LAUNCH COST</div><div style="font-size:10px;color:' + (Number(info.launchCostGp) > 0 ? 'var(--red)' : '#64dc82') + ';font-weight:800">' + (Number(info.launchCostGp) > 0 ? txt(info.launchCostGp) + ' GP' : 'FREE') + '</div></div>';
    html += '<div style="padding:6px;border-radius:6px;background:rgba(255,255,255,.035);border:1px solid rgba(255,255,255,.08)"><div style="font-size:8px;color:var(--tx3)">MIN HULL</div><div style="font-size:10px;color:#64dc82;font-weight:800">' + pct(info.minHpPct) + '%</div></div>';
    html += '</div>';

    if (!readyFleets.length) {
      html += '<div style="font-size:10px;color:var(--tx3);line-height:1.6">' + lang('Build or assign ships to a fleet first.', '먼저 함선을 건조하거나 함대에 배치해야 합니다.', '先に艦船を建造または艦隊へ配置してください。', '请先建造舰船或编入舰队。') + '</div>';
    } else {
      html += '<div style="display:grid;grid-template-columns:1fr 90px;gap:6px;margin-bottom:6px">';
      html += '<select id="smFleetSelect" onchange="smUpdatePreview()" style="min-width:0;background:var(--surface1);border:1px solid var(--bdr);color:var(--tx);border-radius:6px;padding:8px;font-family:var(--fn);font-size:10px">';
      readyFleets.forEach(function (f) {
        var disabled = f.is_in_battle || busy[String(f.id)];
        var label = (f.name || ('Fleet #' + f.id)) + ' · ' + fleetCount(f) + ' ships';
        if (f.is_in_battle) label += ' · BATTLE';
        if (busy[String(f.id)]) label += ' · MINING';
        html += '<option value="' + txt(f.id) + '"' + (String(picks.fleetId || '') === String(f.id) ? ' selected' : '') + (disabled ? ' disabled' : '') + '>' + txt(label) + '</option>';
      });
      html += '</select>';
      html += '<select id="smDurationSelect" onchange="smUpdatePreview()" style="background:var(--surface1);border:1px solid var(--bdr);color:var(--tx);border-radius:6px;padding:8px;font-family:var(--fn);font-size:10px">';
      durations.forEach(function (h) {
        html += '<option value="' + txt(h) + '"' + (String(picks.durationH || '') === String(h) ? ' selected' : '') + '>' + txt(h) + 'h</option>';
      });
      html += '</select></div>';

      html += '<select id="smDestinationSelect" onchange="smUpdatePreview()" style="width:100%;background:var(--surface1);border:1px solid var(--bdr);color:var(--tx);border-radius:6px;padding:8px;font-family:var(--fn);font-size:10px;margin-bottom:8px">';
      dests.forEach(function (d) {
        var line = routeName(d.key) + ' · ' + routeRiskLabel(d) + ' · x' + Number(d.yieldMult || 1).toFixed(1) + ' GP · x' + Number(d.resourceMult || d.yieldMult || 1).toFixed(1) + ' resource · x' + Number(d.wearMult || 1).toFixed(1) + ' wear · ' + pct(d.raidPct) + '% raid';
        html += '<option value="' + txt(d.key) + '"' + (String(picks.destination || '') === String(d.key) ? ' selected' : '') + '>' + txt(line) + '</option>';
      });
      html += '</select>';

      html += '<div id="smPreview" style="font-size:9px;color:var(--tx3);line-height:1.7;margin-bottom:8px"></div>';
      html += '<button id="smLaunchBtn" type="button" onclick="smLaunchMining()" style="width:100%;padding:10px;border-radius:8px;background:linear-gradient(135deg,#64dc82,#35a85b);border:none;color:#001;font-family:var(--fn);font-size:11px;font-weight:900;letter-spacing:1px;cursor:pointer">' + lang('LAUNCH RESOURCE RUN', '채굴 출항', '採掘へ出航', '启动采矿航线') + '</button>';
    }
    html += '</div>';

    html += '<div style="font-size:10px;color:var(--tx3);letter-spacing:1px;margin:0 0 6px">' + lang('ACTIVE / RECENT RUNS', '진행 / 최근 런', '進行中 / 最近のラン', '进行中 / 最近航线') + '</div>';
    html += renderJobs();
    el.innerHTML = html;
    smUpdatePreview();
  }

  function renderJobs() {
    var jobs = state.jobs || [];
    if (!jobs.length) {
      return '<div style="padding:12px;text-align:center;color:var(--tx3);border:1px solid var(--bdr);border-radius:8px;background:rgba(255,255,255,.03)">' + lang('No resource runs yet.', '아직 채굴 런이 없습니다.', '採掘ランはまだありません。', '暂无采矿航线。') + '</div>';
    }
    return jobs.map(function (j) {
      var ready = j.status === 'mining' && (parseInt(j.seconds_remaining, 10) || 0) <= 0;
      var done = j.status !== 'mining';
      var sec = Math.max(0, parseInt(j.seconds_remaining, 10) || 0);
      var eta = sec >= 3600 ? Math.floor(sec / 3600) + 'h ' + Math.floor((sec % 3600) / 60) + 'm' : sec >= 60 ? Math.floor(sec / 60) + 'm' : sec + 's';
      var drops = '';
      try {
        var rr = Array.isArray(j.reward_resources) ? j.reward_resources : JSON.parse(j.reward_resources || '[]');
        if (rr && rr.length) drops = rr.map(function (x) { return txt(x.code) + ' x' + txt(x.quantity); }).join(' · ');
      } catch (_) {}
      var html = '<div style="border:1px solid rgba(255,255,255,.1);border-radius:8px;background:rgba(0,0,0,.18);padding:9px;margin-bottom:7px">';
      html += '<div style="display:flex;justify-content:space-between;gap:8px;align-items:center">';
      html += '<div style="min-width:0"><div style="font-size:10px;color:var(--tx);font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + txt(j.fleet_name || ('Fleet #' + j.fleet_id)) + '</div>';
      html += '<div style="font-size:8px;color:var(--tx3);margin-top:3px">' + routeName(j.sector_type) + ' · ' + txt(j.duration_h) + 'h · CAP ' + txt(j.capacity || j.ship_count || 0) + '</div></div>';
      html += '<div style="text-align:right;flex-shrink:0">';
      if (ready) html += '<button type="button" onclick="smCollectMining(' + Number(j.id) + ')" style="font-size:9px;padding:5px 10px;border-radius:6px;background:rgba(255,209,102,.16);border:1px solid rgba(255,209,102,.45);color:var(--gold);font-family:var(--fn);font-weight:800;cursor:pointer">COLLECT</button>';
      else html += '<div style="font-size:10px;color:' + (done ? '#64dc82' : 'var(--gold)') + ';font-weight:800">' + (done ? 'DONE' : eta) + '</div>';
      html += '</div></div>';
      if (done) html += '<div style="font-size:8px;color:var(--tx3);margin-top:6px">+' + txt(j.reward_gp || 0) + ' GP' + (drops ? ' · ' + drops : '') + '</div>';
      html += '</div>';
      return html;
    }).join('');
  }

  window.smUpdatePreview = function () {
    var el = document.getElementById('smPreview');
    if (!el || !state.info) return;
    var picks = currentSelections();
    var fleet = (state.fleets || []).find(function (f) { return String(f.id) === String(picks.fleetId); }) || (state.fleets || [])[0];
    var dest = (state.info.destinations || []).find(function (d) { return String(d.key) === String(picks.destination); }) || (state.info.destinations || [])[0] || {};
    var h = Number(picks.durationH || (state.info.durationsH || [1])[0]) || 1;
    if (!fleet) { el.textContent = ''; return; }
    var cap = fleetCapacityEstimate(fleet);
    var gp = Math.round(cap * h * (Number(state.info.gpPerCapacityHour) || 0) * (Number(dest.yieldMult) || 1));
    var launchCost = Number(state.info.launchCostGp) || 0;
    var netGp = gp - launchCost;
    var wearPct = (Number(state.info.hullWearPctPerHour) || 0) * (Number(dest.wearMult) || 1) * h;
    var raidWearPct = wearPct * 1.5;
    var resourceMult = Number(dest.resourceMult || dest.yieldMult || 1);
    var capLine = Number(state.info.gpCapPerDay) > 0 ? ' · ' + lang('daily cap', '일일 상한', '日次上限', '每日上限') + ' ' + state.info.gpCapPerDay + ' GP' : '';
    el.innerHTML = '<span style="color:' + routeRiskColor(dest) + ';font-weight:900">' + txt(routeRiskLabel(dest)) + '</span> · ' +
      lang('Gross', '총 보상', '総報酬', '总收益') + ': <b style="color:var(--gold)">+' + gp + ' GP</b> · ' +
      lang('Net', '순익', '純益', '净收益') + ': <b style="color:' + (netGp >= 0 ? '#64dc82' : 'var(--red)') + '">' + (netGp >= 0 ? '+' : '') + netGp + ' GP</b> · CAP ' + txt(cap) + capLine + '<br>' +
      lang('resource yield', '재료 수율', '資源収率', '资源产出') + ' x' + resourceMult.toFixed(1) + ' · ' +
      lang('hull wear', '선체 마모', '船体摩耗', '船体损耗') + ' x' + Number(dest.wearMult || 1).toFixed(1) + ' · ' +
      lang('raid risk', '약탈 위험', '襲撃リスク', '袭击风险') + ' ' + pct(dest.raidPct) + '% · ' +
      lang('expected wear', '예상 마모', '予想摩耗', '预计损耗') + ' ' + pct(wearPct) + '%' +
      (Number(dest.raidPct) > 0 ? ' (' + lang('raided', '약탈 시', '襲撃時', '被袭时') + ' ' + pct(raidWearPct) + '%)' : '');
  };

  window._renderShipMining = function () {
    if (state.loading) return;
    var hasWallet = window.walletState && walletState.address;
    if (!hasWallet) {
      renderShell(lang('Login to send fleets on resource runs.', '로그인하면 함대를 채굴 런에 보낼 수 있습니다.', 'ログインすると艦隊を採掘ランへ送れます。', '登录后可派遣舰队执行采矿航线。'));
      return;
    }
    state.loading = true;
    renderShell('Loading resource routes...');
    Promise.all([
      jsonFetch('/api/mining/info', { cache: 'no-store' }),
      jsonFetch('/api/mining/my', { headers: authHeaders(false), cache: 'no-store' }),
      jsonFetch('/api/fleets', { headers: authHeaders(false), cache: 'no-store' })
    ]).then(function (rows) {
      state.info = rows[0] || {};
      state.jobs = (rows[1] && rows[1].jobs) || [];
      state.fleets = (rows[2] && rows[2].fleets) || [];
      renderMining();
    }).catch(function (e) {
      renderShell(lang('Failed to load resource runs: ', '채굴 런 로드 실패: ', '採掘ランの読み込み失敗: ', '采矿航线加载失败: ') + (e.message || e));
    }).finally(function () {
      state.loading = false;
    });
  };

  window.smLaunchMining = function () {
    var picks = currentSelections();
    if (!picks.fleetId) { toast(lang('Select a fleet first.', '함대를 먼저 선택하세요.', '艦隊を選択してください。', '请先选择舰队。'), 'error'); return; }
    var btn = document.getElementById('smLaunchBtn');
    if (btn) btn.disabled = true;
    jsonFetch('/api/mining/launch', {
      method: 'POST',
      headers: authHeaders(true),
      body: JSON.stringify({ fleetId: picks.fleetId, durationH: Number(picks.durationH), destination: picks.destination })
    }).then(function () {
      toast(lang('Resource run launched.', '채굴 런 출항 완료.', '採掘ランを開始しました。', '采矿航线已启动。'), 'success');
      window._renderShipMining();
    }).catch(function (e) {
      toast((typeof srvErr === 'function' ? srvErr(e.message) : e.message) || 'LAUNCH_FAILED', 'error');
      if (btn) btn.disabled = false;
    });
  };

  window.smCollectMining = function (jobId) {
    jsonFetch('/api/mining/collect', {
      method: 'POST',
      headers: authHeaders(true),
      body: JSON.stringify({ jobId: jobId })
    }).then(function (d) {
      var msg = '+' + (d.rewardGp || 0) + ' GP';
      if (d.raided) msg += ' · ' + lang('raided', '약탈 피해', '襲撃被害', '遭袭');
      if (d.resources && d.resources.length) msg += ' · ' + d.resources.map(function (r) { return r.code + ' x' + r.quantity; }).join(', ');
      toast(msg, d.raided ? 'warn' : 'success');
      window._renderShipMining();
    }).catch(function (e) {
      toast((typeof srvErr === 'function' ? srvErr(e.message) : e.message) || 'COLLECT_FAILED', 'error');
    });
  };

  window.openShipMining = function () {
    try { if (typeof openBaseModal === 'function') openBaseModal(); } catch (_) {}
    try {
      var tab = document.getElementById('baseTabMining');
      if (typeof switchBaseTab === 'function') switchBaseTab('mining', tab);
    } catch (_) {}
  };
})();
