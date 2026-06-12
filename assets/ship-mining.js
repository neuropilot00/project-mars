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

  function miningReadFetch(key, url, minGap) {
    var walletKey = (window.walletState && walletState.address) ? String(walletState.address).toLowerCase() : 'public';
    if (typeof _guardedJsonFetch === 'function') {
      return _guardedJsonFetch(key + ':' + walletKey, url, {
        minGap: minGap || 10000,
        backoffMs: 90000,
        fetchOptions: { headers: authHeaders(false), cache: 'no-store' }
      });
    }
    return jsonFetch(url, { headers: authHeaders(false), cache: 'no-store' });
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

  function routeDifficultyLabel(d) {
    var lv = Math.max(1, Math.min(5, parseInt(d && d.difficulty, 10) || 1));
    return 'D' + lv;
  }

  function routeLootText(d) {
    var rare = Number(d && d.rareMult) || 1;
    var profile = d && d.lootProfile ? String(d.lootProfile) : '';
    return profile || (rare > 1.2
      ? lang('rare-material pressure', '희귀 재료 확률 높음', 'レア素材圧力高', '稀有材料压力高')
      : rare > 1
        ? lang('improved mineral table', '개선된 광물 테이블', '改善鉱物テーブル', '强化矿物表')
        : lang('baseline ore table', '기본 광석 테이블', '基本鉱石テーブル', '基础矿石表'));
  }

  function routeRoleText(d) {
    return d && d.routeRole ? String(d.routeRole) : lang('general resource run', '범용 채굴 런', '汎用採掘ラン', '通用采矿航线');
  }

  function routeUseText(d) {
    return d && d.targetUse ? String(d.targetUse) : lang('mixed economy supply', '복합 경제 보급', '複合経済補給', '综合经济补给');
  }

  function routeRecommendedText(d) {
    return d && d.recommendedFor ? String(d.recommendedFor) : lang('available fleets', '가용 함대', '利用可能な艦隊', '可用舰队');
  }

  function routePressureLabel(d) {
    var p = d && d.pressure ? String(d.pressure) : '';
    var map = {
      low: lang('LOW PRESSURE', '저압 지역', '低圧地域', '低压区域'),
      contested: lang('CONTESTED', '분쟁 압력', '係争圧力', '争夺压力'),
      warzone: lang('WAR ECONOMY', '전시 경제권', '戦時経済圏', '战时经济区')
    };
    return map[p] || p || routeRiskLabel(d);
  }

  function routeEconomySummary(d) {
    var risk = routeRiskLabel(d);
    var difficulty = routeDifficultyLabel(d);
    var loot = routeLootText(d);
    var pressure = routePressureLabel(d);
    return difficulty + ' · ' + risk + ' · ' + pressure + ' · ' + loot;
  }

  function routeDoctrineText(d) {
    var raid = Number(d && d.raidPct) || 0;
    var wear = Number(d && d.wearMult) || 1;
    var rare = Number(d && d.rareMult) || 1;
    if (raid >= 0.12 || wear >= 2.2) {
      return lang(
        'War economy route: bring healthy escorts, use alliance or owned-sector bonuses, and expect hull repair costs.',
        '전시 경제 항로: 건전한 호위 함대를 붙이고 동맹/내 영토 보너스를 활용하세요. 수리비를 감안해야 합니다.',
        '戦時経済航路: 健全な護衛艦隊と同盟/自領ボーナス前提。修理費を見込んでください。',
        '战时经济航线：带健康护航舰队，利用联盟/自有领地加成，并预留维修成本。'
      );
    }
    if (raid >= 0.04 || wear >= 1.4 || rare > 1.1) {
      return lang(
        'Contested growth route: best for combat-ready fleets that can trade more wear for better materials.',
        '분쟁 성장 항로: 전투 준비가 된 함대가 더 높은 마모를 감수하고 재료 수율을 올릴 때 좋습니다.',
        '係争成長航路: 戦闘準備済み艦隊が摩耗増と引き換えに素材収率を上げる時に有効。',
        '争夺成长航线：适合战备舰队用更高损耗换取更好材料。'
      );
    }
    return lang(
      'Safe grind route: low-risk income for new, damaged, or reserve fleets.',
      '안전 파밍 항로: 신규/손상/예비 함대의 저위험 수급에 적합합니다.',
      '安全周回航路: 新規・損傷・予備艦隊の低リスク収入向き。',
      '安全刷取航线：适合新手、受损或预备舰队的低风险收益。'
    );
  }

  function routeWarEconomyPlan(dest, cap, durationH) {
    var gross = estimateRunGp(cap, durationH, dest);
    var launchCost = Number(state.info && state.info.launchCostGp) || 0;
    var raid = Number(dest && dest.raidPct) || 0;
    var wearMult = Number(dest && dest.wearMult) || 1;
    var resourceMult = Number(dest && (dest.resourceMult || dest.yieldMult)) || 1;
    var rareMult = Number(dest && dest.rareMult) || 1;
    var expectedAfterRaid = Math.round(gross * (1 - raid * 0.5));
    var netExpected = expectedAfterRaid - launchCost;
    var doctrine = raid >= 0.12 || wearMult >= 2.2
      ? lang('Escort first', '호위 우선', '護衛優先', '优先护航')
      : resourceMult >= 1.5 || rareMult >= 1.15
        ? lang('Growth push', '성장 압박', '成長圧力', '成长推进')
        : lang('Safe grind', '안전 파밍', '安全周回', '安全刷取');
    return {
      gross: gross,
      expectedAfterRaid: expectedAfterRaid,
      netExpected: netExpected,
      doctrine: doctrine,
      pressure: routePressureLabel(dest),
    };
  }

  function allianceBonusFor(key) {
    var bonuses = (state.info && state.info.allianceSectorBonuses) || {};
    var mult = Number(bonuses[key]) || 1;
    return mult > 1 ? mult : 1;
  }

  function territoryBonusFor(key) {
    var bonuses = (state.info && state.info.territorySectorBonuses) || {};
    var mult = Number(bonuses[key]) || 1;
    return mult > 1 ? mult : 1;
  }

  function routeControlBonusFor(key) {
    return allianceBonusFor(key) * territoryBonusFor(key);
  }

  function estimateRunGp(capacity, durationH, dest) {
    var cap = Number(capacity) || 0;
    var h = Number(durationH) || 0;
    var gpPerCapH = Number(state.info && state.info.gpPerCapacityHour) || 0;
    var yieldMult = Number(dest && dest.yieldMult) || 1;
    var routeBonus = routeControlBonusFor(dest && dest.key);
    return Math.round(cap * h * gpPerCapH * yieldMult * routeBonus);
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
        var allianceBonus = allianceBonusFor(d.key);
        var territoryBonus = territoryBonusFor(d.key);
        var routeControlBonus = routeControlBonusFor(d.key);
        var allianceText = allianceBonus > 1 ? ' · Alliance +' + Math.round((allianceBonus - 1) * 100) + '%' : '';
        var territoryText = territoryBonus > 1 ? ' · Territory +' + Math.round((territoryBonus - 1) * 100) + '%' : '';
        var line = routeName(d.key) + ' · ' + routeDifficultyLabel(d) + ' · ' + routeRiskLabel(d) + ' · ' + routeRoleText(d) + ' · x' + Number((d.yieldMult || 1) * routeControlBonus).toFixed(1) + ' GP · x' + Number((d.resourceMult || d.yieldMult || 1) * routeControlBonus).toFixed(1) + ' resource · x' + Number(d.rareMult || 1).toFixed(2) + ' rare' + allianceText + territoryText + ' · x' + Number(d.wearMult || 1).toFixed(1) + ' wear · ' + pct(d.raidPct) + '% raid';
        html += '<option value="' + txt(d.key) + '"' + (String(picks.destination || '') === String(d.key) ? ' selected' : '') + '>' + txt(line) + '</option>';
      });
      html += '</select>';

      html += '<div id="smRouteChoices" style="margin-bottom:8px"></div>';
      html += '<div id="smPreview" style="font-size:9px;color:var(--tx3);line-height:1.7;margin-bottom:8px"></div>';
      html += '<div id="smRouteIntel" style="margin-bottom:8px"></div>';
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
      var jobDest = (state.info && state.info.destinations || []).find(function (d) { return String(d.key) === String(j.sector_type); }) || {};
      var jobCap = Number(j.capacity || j.ship_count || 0) || 0;
      var projectedGp = estimateRunGp(jobCap, j.duration_h, jobDest);
      var routeBonus = routeControlBonusFor(jobDest.key);
      var riskColor = routeRiskColor(jobDest);
      html += '<div style="font-size:8px;color:var(--tx3);margin-top:3px">' + routeName(j.sector_type) + ' · ' + routeDifficultyLabel(jobDest) + ' · ' + txt(j.duration_h) + 'h · CAP ' + txt(jobCap) + '</div></div>';
      html += '<div style="text-align:right;flex-shrink:0">';
      if (ready) html += '<button type="button" onclick="smCollectMining(' + Number(j.id) + ')" style="font-size:9px;padding:5px 10px;border-radius:6px;background:rgba(255,209,102,.16);border:1px solid rgba(255,209,102,.45);color:var(--gold);font-family:var(--fn);font-weight:800;cursor:pointer">COLLECT</button>';
      else html += '<div style="font-size:10px;color:' + (done ? '#64dc82' : 'var(--gold)') + ';font-weight:800">' + (done ? 'DONE' : eta) + '</div>';
      html += '</div></div>';
      html += '<div style="display:flex;flex-wrap:wrap;gap:5px;margin-top:6px;font-size:8px">';
      html += '<span style="color:' + riskColor + ';border:1px solid ' + riskColor + '55;border-radius:999px;padding:2px 6px">' + txt(routeDifficultyLabel(jobDest) + ' ' + routeRiskLabel(jobDest)) + '</span>';
      html += '<span style="color:var(--gold);border:1px solid rgba(255,209,102,.25);border-radius:999px;padding:2px 6px">' + lang('Projected', '예상', '予想', '预计') + ' +' + txt(projectedGp) + ' GP</span>';
      if (routeBonus > 1) html += '<span style="color:#64dc82;border:1px solid rgba(100,220,130,.25);border-radius:999px;padding:2px 6px">' + lang('Control', '통제', '支配', '控制') + ' x' + routeBonus.toFixed(2) + '</span>';
      html += '<span style="color:var(--tx3);border:1px solid rgba(255,255,255,.12);border-radius:999px;padding:2px 6px">' + lang('Wear', '마모', '摩耗', '损耗') + ' x' + Number(jobDest.wearMult || 1).toFixed(1) + ' · ' + lang('Raid', '약탈', '襲撃', '袭击') + ' ' + pct(jobDest.raidPct) + '%</span>';
      html += '</div>';
      if (done) html += '<div style="font-size:8px;color:var(--tx3);margin-top:6px">+' + txt(j.reward_gp || 0) + ' GP' + (j.raided ? ' · <span style="color:var(--red)">RAIDED</span>' : '') + (drops ? ' · ' + drops : '') + '</div>';
      else html += '<div style="font-size:8px;color:var(--tx3);margin-top:6px">' + txt(routeRoleText(jobDest)) + ' · ' + txt(routeUseText(jobDest)) + '</div>';
      html += '</div>';
      return html;
    }).join('');
  }

  function routeChoiceScore(dest, cap, h) {
    var routeControlBonus = routeControlBonusFor(dest && dest.key);
    var gross = estimateRunGp(cap, h, dest);
    var launchCost = Number(state.info && state.info.launchCostGp) || 0;
    var wearMult = Number(dest && dest.wearMult) || 1;
    var raid = Number(dest && dest.raidPct) || 0;
    var rare = Number(dest && dest.rareMult) || 1;
    var resource = Number(dest && (dest.resourceMult || dest.yieldMult)) || 1;
    var riskPenalty = raid >= 0.12 || wearMult >= 2.2 ? 0.76 : (raid >= 0.04 || wearMult >= 1.4 ? 0.9 : 1);
    var score = Math.round(((gross - launchCost) + cap * h * resource * 1.4 + rare * 12) * routeControlBonus * riskPenalty);
    return { gross:gross, net:gross - launchCost, score:score, riskPenalty:riskPenalty, control:routeControlBonus };
  }

  function renderRouteChoices(fleet, durationH, selectedDestKey) {
    var wrap = document.getElementById('smRouteChoices');
    if (!wrap || !state.info) return;
    var dests = state.info.destinations || [];
    if (!dests.length || !fleet) {
      wrap.innerHTML = '';
      return;
    }
    var cap = fleetCapacityEstimate(fleet);
    var ranked = dests.map(function (d) {
      return { dest:d, info:routeChoiceScore(d, cap, durationH) };
    }).sort(function (a, b) { return b.info.score - a.info.score; });
    var title = lang('Recommended belts', '추천 채굴권', 'おすすめ採掘圏', '推荐采矿区');
    var hint = lang('based on fleet capacity and duration', '함대 적재량/시간 기준', '艦隊容量と時間基準', '按舰队容量和时长计算');
    wrap.innerHTML =
      '<div style="display:flex;justify-content:space-between;align-items:center;margin:0 0 5px">' +
        '<span style="font-size:9px;color:#64dc82;font-family:var(--fn);font-weight:900;letter-spacing:.8px">▸ ' + title + '</span>' +
        '<span style="font-size:7.5px;color:var(--tx3);font-family:var(--fn)">' + hint + '</span>' +
      '</div>' +
      ranked.map(function (row, idx) {
        var d = row.dest;
        var i = row.info;
        var active = String(selectedDestKey || '') === String(d.key);
        var riskColor = routeRiskColor(d);
        var plan = routeWarEconomyPlan(d, cap, durationH);
        return '<button type="button" onclick="smSelectMiningRoute(\'' + txt(d.key) + '\')" style="width:100%;display:grid;grid-template-columns:minmax(0,1fr) auto auto;gap:7px;align-items:center;text-align:left;margin-bottom:5px;padding:7px 8px;border-radius:7px;border:1px solid ' + (active ? riskColor : 'rgba(100,220,130,.18)') + ';background:' + (active ? 'rgba(100,220,130,.08)' : 'rgba(100,220,130,.035)') + ';cursor:pointer;color:var(--tx);font-family:var(--fn)">' +
          '<span style="min-width:0"><span style="display:block;font-size:9px;font-weight:900;color:' + riskColor + ';white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + txt(routeName(d.key)) + '</span>' +
          '<span style="display:block;font-size:7.5px;color:var(--tx3);margin-top:2px">' + (idx === 0 ? '<b style="color:#64dc82">BEST</b> · ' : '') + txt(routeDifficultyLabel(d) + ' · ' + plan.pressure) + ' · score ' + txt(i.score) + '</span></span>' +
          '<span style="font-size:8px;color:var(--gold);font-weight:900;white-space:nowrap">+' + txt(i.gross) + ' GP<br><span style="color:var(--tx3);font-size:7px">EV +' + txt(plan.expectedAfterRaid) + '</span></span>' +
          '<span style="font-size:7.5px;color:' + riskColor + ';font-weight:900;border:1px solid rgba(255,255,255,.14);border-radius:999px;padding:2px 5px;white-space:nowrap">' + txt(routeRiskLabel(d)) + '</span>' +
        '</button>';
      }).join('');
  }

  window.smUpdatePreview = function () {
    var el = document.getElementById('smPreview');
    if (!el || !state.info) return;
    var intelEl = document.getElementById('smRouteIntel');
    var picks = currentSelections();
    var fleet = (state.fleets || []).find(function (f) { return String(f.id) === String(picks.fleetId); }) || (state.fleets || [])[0];
    var dest = (state.info.destinations || []).find(function (d) { return String(d.key) === String(picks.destination); }) || (state.info.destinations || [])[0] || {};
    var h = Number(picks.durationH || (state.info.durationsH || [1])[0]) || 1;
    if (!fleet) { el.textContent = ''; return; }
    var cap = fleetCapacityEstimate(fleet);
    renderRouteChoices(fleet, h, dest.key);
    var allianceBonus = allianceBonusFor(dest.key);
    var territoryBonus = territoryBonusFor(dest.key);
    var routeControlBonus = routeControlBonusFor(dest.key);
    var gp = Math.round(cap * h * (Number(state.info.gpPerCapacityHour) || 0) * (Number(dest.yieldMult) || 1) * routeControlBonus);
    var launchCost = Number(state.info.launchCostGp) || 0;
    var netGp = gp - launchCost;
    var wearPct = (Number(state.info.hullWearPctPerHour) || 0) * (Number(dest.wearMult) || 1) * h;
    var raidWearPct = wearPct * 1.5;
    var resourceMult = Number(dest.resourceMult || dest.yieldMult || 1) * routeControlBonus;
    var rareMult = Number(dest.rareMult || 1);
    var plan = routeWarEconomyPlan(dest, cap, h);
    var capLine = Number(state.info.gpCapPerDay) > 0 ? ' · ' + lang('daily cap', '일일 상한', '日次上限', '每日上限') + ' ' + state.info.gpCapPerDay + ' GP' : '';
    var allianceLine = allianceBonus > 1
      ? '<br><span style="color:#80cbc4;font-weight:800">Alliance sector +' + Math.round((allianceBonus - 1) * 100) + '%</span> · ' +
        lang('same-tier governed space', '동맹이 통치 중인 같은 티어 섹터', '同盟統治中の同ティア宙域', '同盟治理的同阶区域')
      : '';
    var territoryLine = territoryBonus > 1
      ? '<br><span style="color:#64dc82;font-weight:800">Territory sector +' + Math.round((territoryBonus - 1) * 100) + '%</span> · ' +
        lang('same-tier owned territory foothold', '내가 점유한 같은 티어 영토 거점', '同ティアの自領土拠点', '同阶自有领地据点')
      : '';
    el.innerHTML = '<span style="color:' + routeRiskColor(dest) + ';font-weight:900">' + txt(routeDifficultyLabel(dest) + ' ' + routeRiskLabel(dest)) + '</span> · ' +
      lang('Gross', '총 보상', '総報酬', '总收益') + ': <b style="color:var(--gold)">+' + gp + ' GP</b> · ' +
      lang('Net', '순익', '純益', '净收益') + ': <b style="color:' + (netGp >= 0 ? '#64dc82' : 'var(--red)') + '">' + (netGp >= 0 ? '+' : '') + netGp + ' GP</b> · CAP ' + txt(cap) + capLine + '<br>' +
      lang('resource yield', '재료 수율', '資源収率', '资源产出') + ' x' + resourceMult.toFixed(1) + ' · ' +
      lang('rare pressure', '희귀 압력', 'レア圧力', '稀有压力') + ' x' + rareMult.toFixed(2) + ' · ' +
      lang('hull wear', '선체 마모', '船体摩耗', '船体损耗') + ' x' + Number(dest.wearMult || 1).toFixed(1) + ' · ' +
      lang('raid risk', '약탈 위험', '襲撃リスク', '袭击风险') + ' ' + pct(dest.raidPct) + '% · ' +
      lang('expected wear', '예상 마모', '予想摩耗', '预计损耗') + ' ' + pct(wearPct) + '%' +
      (Number(dest.raidPct) > 0 ? ' (' + lang('raided', '약탈 시', '襲撃時', '被袭时') + ' ' + pct(raidWearPct) + '%)' : '') +
      '<br><span style="color:#80cbc4;font-weight:800">' + txt(routeRoleText(dest)) + '</span> · ' + txt(routeUseText(dest)) +
      '<br><span style="color:var(--tx3)">' + lang('Recommended', '추천', '推奨', '推荐') + ': ' + txt(routeRecommendedText(dest)) + '</span>' +
      '<br><span style="color:var(--tx3)">' + txt(routeLootText(dest)) + '</span>' +
      allianceLine + territoryLine;
    if (intelEl) {
      var riskColor = routeRiskColor(dest);
      var routeBonus = routeControlBonus > 1 ? (' x' + routeControlBonus.toFixed(2)) : ' x1.00';
      intelEl.innerHTML =
        '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(108px,1fr));gap:6px">' +
          '<div style="border:1px solid ' + riskColor + '55;background:rgba(255,255,255,.03);border-radius:7px;padding:7px">' +
            '<div style="font-size:7px;color:var(--tx3);letter-spacing:.8px">' + lang('ROUTE RISK', '항로 위험', '航路リスク', '航线风险') + '</div>' +
            '<div style="font-size:10px;color:' + riskColor + ';font-weight:900">' + txt(routeEconomySummary(dest)) + '</div>' +
          '</div>' +
          '<div style="border:1px solid rgba(255,209,102,.24);background:rgba(255,209,102,.04);border-radius:7px;padding:7px">' +
            '<div style="font-size:7px;color:var(--tx3);letter-spacing:.8px">' + lang('ECONOMY USE', '경제 용도', '経済用途', '经济用途') + '</div>' +
            '<div style="font-size:10px;color:var(--gold);font-weight:800">' + txt(routeUseText(dest)) + '</div>' +
          '</div>' +
          '<div style="border:1px solid rgba(100,220,130,.24);background:rgba(100,220,130,.04);border-radius:7px;padding:7px">' +
            '<div style="font-size:7px;color:var(--tx3);letter-spacing:.8px">' + lang('CONTROL BONUS', '통제 보너스', '支配ボーナス', '控制加成') + '</div>' +
            '<div style="font-size:10px;color:#64dc82;font-weight:900">' + txt(routeBonus) + '</div>' +
            '<div style="font-size:8px;color:var(--tx3);margin-top:2px">' + txt(routeRecommendedText(dest)) + '</div>' +
          '</div>' +
          '<div style="border:1px solid rgba(129,212,250,.24);background:rgba(129,212,250,.04);border-radius:7px;padding:7px">' +
            '<div style="font-size:7px;color:var(--tx3);letter-spacing:.8px">' + lang('COMMAND DECISION', '지휘 판단', '指揮判断', '指挥判断') + '</div>' +
            '<div style="font-size:10px;color:#b3e5fc;font-weight:900;margin:1px 0 3px">' + txt(plan.doctrine) + ' · EV ' + (plan.netExpected >= 0 ? '+' : '') + txt(plan.netExpected) + ' GP</div>' +
            '<div style="font-size:8.5px;color:#b3e5fc;line-height:1.45;margin-top:2px">' + txt(routeDoctrineText(dest)) + '</div>' +
          '</div>' +
        '</div>';
    }
  };

  window.smSelectMiningRoute = function (key) {
    var dest = document.getElementById('smDestinationSelect');
    if (dest) dest.value = String(key || '');
    window.smUpdatePreview();
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
      miningReadFetch('ship-mining-info', '/api/mining/info', 15000),
      miningReadFetch('ship-mining-my', '/api/mining/my', 10000),
      miningReadFetch('ship-mining-fleets', '/api/fleets', 10000)
    ]).then(function (rows) {
      state.info = rows[0] || state.info || {};
      state.jobs = rows[1] && rows[1].jobs ? rows[1].jobs : (state.jobs || []);
      state.fleets = rows[2] && rows[2].fleets ? rows[2].fleets : (state.fleets || []);
      renderMining();
    }).catch(function (e) {
      if (state.info) {
        renderMining();
      } else {
        renderShell(lang('Failed to load resource runs: ', '채굴 런 로드 실패: ', '採掘ランの読み込み失敗: ', '采矿航线加载失败: ') + (e.message || e));
      }
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
      if (Number(d.allianceSectorBonus) > 1) msg += ' · Alliance +' + Math.round((Number(d.allianceSectorBonus) - 1) * 100) + '%';
      if (Number(d.territorySectorBonus) > 1) msg += ' · Territory +' + Math.round((Number(d.territorySectorBonus) - 1) * 100) + '%';
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
