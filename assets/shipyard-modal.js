// ═════ Shipyard State ═════
var shipyardState = {
  currentTab: 'blueprints',
  currentSize: '',
  blueprints: [],
  queue: [],
  ships: [],
  marketListings: [],
  summary: null,
  myFaction: null,
  myInventory: {},
  queueTimer: null,
  marketFaction: '',
  marketSize: '',
  marketSort: 'price_asc',
  materialSectorHints: {},  // resource_code → primary sector_type (frontier/mid/core)
};

var SM_DEFAULT_DESTINATIONS = [
  { key: 'frontier', yieldMult: 1.0, wearMult: 1.0, raidPct: 0.0 },
  { key: 'mid', yieldMult: 1.5, wearMult: 1.5, raidPct: 0.05 },
  { key: 'core', yieldMult: 2.2, wearMult: 2.5, raidPct: 0.15 }
];
function _smDestMeta(key){
  var map = {
    frontier: { label:tl('NEAR','근거리','近距離','近'), c:'#3fb6a8', ico:'🏳' },
    mid:      { label:tl('MID','중거리','中距離','中'), c:'#e0a93b', ico:'⚒' },
    core:     { label:tl('FAR','원거리','遠距離','远'), c:'#d9483b', ico:'☢' }
  };
  return map[key] || { label:key || 'UNKNOWN', c:'#888', ico:'•' };
}
function _smAllianceBonus(info, key){
  var bonuses = (info && info.allianceSectorBonuses) || {};
  var mult = Number(bonuses[key]) || 1;
  return mult > 1 ? mult : 1;
}
function _smTerritoryBonus(info, key){
  var bonuses = (info && info.territorySectorBonuses) || {};
  var mult = Number(bonuses[key]) || 1;
  return mult > 1 ? mult : 1;
}
function _smRouteControlBonus(info, key){
  return _smAllianceBonus(info, key) * _smTerritoryBonus(info, key);
}
function _smRiskLabel(d){
  var raid = Number(d && d.raidPct) || 0;
  var wear = Number(d && d.wearMult) || 1;
  if (raid >= 0.12 || wear >= 2.2) return tl('HIGH RISK','고위험','高リスク','高风险');
  if (raid >= 0.04 || wear >= 1.4) return tl('CONTESTED','분쟁권','係争圏','争夺区');
  return tl('SAFE','안전권','安全圏','安全区');
}
function _smParseResources(v){
  if (!v) return [];
  if (Array.isArray(v)) return v;
  try {
    var parsed = typeof v === 'string' ? JSON.parse(v) : v;
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) { return []; }
}
function _smResourceSummary(v){
  var arr = _smParseResources(v).filter(function(x){ return x && Number(x.quantity) > 0; });
  if (!arr.length) return '';
  return arr.slice(0, 3).map(function(x){ return escapeHtmlSafe(x.code || 'mat') + ' ×' + (Number(x.quantity) || 0); }).join(' · ')
    + (arr.length > 3 ? ' +' + (arr.length - 3) : '');
}
function _smReadJson(key, url, minGap) {
  var headers = (typeof getAuthHeaders === 'function') ? getAuthHeaders() : {};
  if (typeof _guardedJsonFetch === 'function') {
    return _guardedJsonFetch('shipyard-mining:' + key, url, {
      minGap: minGap || 10000,
      backoffMs: 90000,
      fetchOptions: { headers: headers, cache: 'no-store' }
    });
  }
  return fetch(url, { headers: headers, cache: 'no-store' }).then(function(r){ return r.json(); });
}

// ⛏ 함선 채굴 런 (경제 v2 P5) — 땅 없는 F2P 노가다. 함대를 보내 재료+GP 수급.
// 채굴은 임무 > ⛏ MINING 서브탭으로 통합(모달 폐기). 외부 진입점은 BASE 열고 해당 탭으로 라우팅.
async function openShipMining() {
  if (!isLoggedIn()) { showFactionToast(tl('Login required','로그인이 필요합니다','ログインが必要です','请先登录'),'error'); return; }
  try { if (typeof openBaseModal==='function' && !document.getElementById('baseModal').classList.contains('open')) openBaseModal(); } catch(_e){}
  try { switchBaseTab('mining'); } catch(_e){}
}

async function _renderShipMining() {
  var w = (walletState && walletState.address) || '';
  var c = document.getElementById('smContent'); if (!c) return;
  try {
    var res = await Promise.all([
      _smReadJson('info:' + (w || 'public'), '/api/mining/info', 15000),
      _smReadJson('my:' + (w || 'public'), '/api/mining/my?wallet='+encodeURIComponent(w), 10000),
      _smReadJson('fleets:' + (w || 'public'), '/api/fleets', 10000)
    ]);
    var info = res[0]||{}, my = (res[1]&&res[1].jobs)||[], fleets = (res[2]&&res[2].fleets)||[];
    if (info.enabled === false) { c.innerHTML = '<div style="color:var(--tx3);text-align:center;padding:16px 0">'+tl('Mining is disabled.','채굴이 비활성화됨.','採掘は無効です。','采矿已禁用。')+'</div>'; return; }
    // 함선 보유 함대만 (ship_count>0)
    var usable = fleets.filter(function(f){ return (parseInt(f.ships_alive)||parseInt(f.ship_count)||0) > 0; });
    var durs = info.durationsH || [1,4,8];
    var dests = (info.destinations && info.destinations.length) ? info.destinations : SM_DEFAULT_DESTINATIONS;
    var h = '';
    // 진행/완료 런
    if (my.length) {
      h += '<div style="font-size:9px;color:#64dc82;font-weight:700;letter-spacing:.5px;margin-bottom:6px">'+tl('ACTIVE / RECENT RUNS','진행/최근 런','進行/最近','进行/最近')+'</div>';
      my.forEach(function(j){
        var ready = j.status==='mining' && (j.seconds_remaining||0) <= 0;
        var done = j.status==='collected';
        var mins = Math.ceil((j.seconds_remaining||0)/60);
        var destKey = j.sector_type || j.destination || 'frontier';
        var dm = _smDestMeta(destKey);
        var destCfg = dests.find(function(d){ return d.key===destKey; }) || { yieldMult:1, wearMult:1, raidPct:0 };
        var allianceBonus = _smAllianceBonus(info, destKey);
        var territoryBonus = _smTerritoryBonus(info, destKey);
        var risk = _smRiskLabel(destCfg);
        var raidPct = Math.round((Number(destCfg.raidPct)||0)*100);
        var routeTags = '<span style="font-size:8px;color:'+dm.c+'">'+dm.ico+' '+dm.label+'</span>'
          + ' <span style="font-size:8px;color:var(--tx3)">· '+risk+' · '+tl('Hull','내구','耐久','耐久')+' ×'+(Number(destCfg.wearMult)||1)+'</span>'
          + (raidPct>0 ? ' <span style="font-size:8px;color:#d9483b">· ⚠ '+raidPct+'%</span>' : '')
          + (allianceBonus>1 ? ' <span style="font-size:8px;color:#80cbc4">· 🛡 +'+Math.round((allianceBonus-1)*100)+'%</span>' : '')
          + (territoryBonus>1 ? ' <span style="font-size:8px;color:#64dc82">· 🏴 +'+Math.round((territoryBonus-1)*100)+'%</span>' : '');
        var mats = _smResourceSummary(j.reward_resources);
        var doneLine = '✅ '+tl('Collected','수령완료','受取済','已领取')+': '+_fmtGp(j.reward_gp)+' GP'
          + (j.raided ? ' · <span style="color:#d9483b">⚠ '+tl('raided','약탈 피해','襲撃被害','遭袭')+'</span>' : '')
          + (mats?(' · '+mats):'');
        h += '<div style="background:rgba(255,255,255,.03);border:1px solid rgba(100,220,130,.18);border-radius:8px;padding:8px 10px;margin-bottom:6px;display:flex;align-items:center;gap:8px">'
          + '<div style="flex:1;font-size:10px"><b style="color:#fff">'+escapeHtmlSafe(j.fleet_name||('Fleet #'+j.fleet_id))+'</b> <span style="color:var(--tx3)">· '+j.ship_count+'🛸 · '+j.duration_h+'h</span><br>'
          + routeTags + '<br>'
          + '<span style="font-size:8.5px;color:var(--tx3)">'+(done?doneLine:(ready?('⛏ '+tl('Ready to collect','수령 가능','受取可能','可领取')):('⏳ '+mins+tl('m left','분 남음','分残り','分钟')))) + '</span></div>'
          + (ready?'<button type="button" class="sm-collect" data-job="'+j.id+'" style="font-size:9px;font-weight:700;padding:6px 10px;border-radius:6px;border:1px solid rgba(100,220,130,.5);background:rgba(100,220,130,.15);color:#64dc82;cursor:pointer;font-family:var(--fn)">'+tl('COLLECT','수령','受取','领取')+'</button>':'')
          + '</div>';
      });
    }
    // 출항 폼
    h += '<div style="font-size:9px;color:#64dc82;font-weight:700;letter-spacing:.5px;margin:12px 0 6px">'+tl('LAUNCH NEW RUN','새 출항','新規出航','新出航')+'</div>';
    if (!usable.length) {
      h += '<div style="font-size:10px;color:var(--tx3);padding:8px 0">'+tl('No fleet with ships. Build a ship in the Shipyard first.','함선 있는 함대가 없습니다. 조선소에서 함선부터 건조하세요.','艦船のある艦隊がありません。まず造船所で建造を。','没有带舰船的舰队。请先在造船厂建造。')+'</div>';
    } else {
      // ① 함대 + 시간
      h += '<div style="display:flex;gap:6px;align-items:center;margin-bottom:8px">'
        + '<select id="smFleet" style="flex:1;font-size:10px;padding:6px;background:rgba(0,0,0,.3);border:1px solid rgba(100,220,130,.3);color:#fff;border-radius:6px;font-family:var(--fn)">'
        + usable.map(function(f){ return '<option value="'+f.id+'">'+escapeHtmlSafe(f.name||('Fleet #'+f.id))+' ('+(f.ships_alive||f.ship_count||0)+'🛸)</option>'; }).join('')
        + '</select>'
        + '<select id="smDur" style="font-size:10px;padding:6px;background:rgba(0,0,0,.3);border:1px solid rgba(100,220,130,.3);color:#fff;border-radius:6px;font-family:var(--fn)">'
        + durs.map(function(d){ return '<option value="'+d+'">'+d+'h</option>'; }).join('')
        + '</select></div>';
      // ② 목적지(거리) 카드 — near/mid/core. 멀수록 고수율·희귀재료·마모↑·약탈위험.
      h += '<div style="font-size:8px;color:var(--tx3);margin-bottom:3px">'+tl('DESTINATION','목적지','目的地','目的地')+'</div>';
      h += '<div id="smDests" style="display:flex;gap:5px;margin-bottom:8px">';
      dests.forEach(function(d, i){
        var m = _smDestMeta(d.key);
        var raid = Math.round((Number(d.raidPct)||0)*100);
        var wear = Number(d.wearMult)||1;
        var allianceBonus = _smAllianceBonus(info, d.key);
        var territoryBonus = _smTerritoryBonus(info, d.key);
        var routeControlBonus = _smRouteControlBonus(info, d.key);
        var yieldMult = (Number(d.yieldMult)||1) * routeControlBonus;
        var allyLine = allianceBonus > 1 ? '<div style="font-size:7.5px;color:#80cbc4;margin-top:1px">🛡 +'+Math.round((allianceBonus-1)*100)+'% '+tl('alliance','동맹','同盟','联盟')+'</div>' : '';
        var terrLine = territoryBonus > 1 ? '<div style="font-size:7.5px;color:#64dc82;margin-top:1px">🏴 +'+Math.round((territoryBonus-1)*100)+'% '+tl('territory','영토','領土','领地')+'</div>' : '';
        h += '<div class="sm-dest" data-dest="'+d.key+'" data-sel="'+(i===0?'1':'0')+'" style="flex:1;cursor:pointer;border:1.5px solid '+(i===0?m.c:'rgba(255,255,255,.12)')+';border-radius:8px;padding:7px 4px;text-align:center;background:'+(i===0?(m.c+'22'):'rgba(0,0,0,.2)')+';transition:all .15s">'
          + '<div style="font-size:15px;line-height:1">'+m.ico+'</div>'
          + '<div style="font-size:9px;font-weight:700;color:'+m.c+';margin-top:2px">'+m.label+'</div>'
          + '<div style="font-size:7.5px;color:var(--tx3);margin-top:1px">'+_smRiskLabel(d)+' · ×'+yieldMult.toFixed(1)+(raid>0?(' · ⚠'+raid+'%'):'')+'</div>'
          + allyLine
          + terrLine
          + '<div style="font-size:7.5px;color:#ffab40;margin-top:1px">'+tl('Hull','내구','耐久','耐久')+' ×'+wear+'</div>'
          + '</div>';
      });
      h += '</div>';
      // ③ 미리보기 (capacity·예상 GP·위험)
      h += '<div id="smPreview" style="font-size:8.5px;color:var(--tx3);margin-bottom:4px"></div>';
      h += '<div style="font-size:8px;color:#ffab40;margin-bottom:8px">⚠ '+tl('Mining wears ship hull — repair at the Shipyard when worn.','채굴은 함선 내구도를 소모합니다 — 닳으면 조선소에서 수리하세요.','採掘は艦船の耐久度を消耗します — 摩耗したら造船所で修理を。','采矿会损耗舰船耐久 — 磨损后请在造船厂修理。')+'</div>';
      h += '<button type="button" id="smLaunch" style="width:100%;padding:9px;border-radius:8px;border:1px solid rgba(100,220,130,.5);background:rgba(100,220,130,.15);color:#64dc82;font-family:var(--fn);font-size:11px;font-weight:700;cursor:pointer">⛏ '+tl('DEPLOY RESOURCE RUN','자원 출항','資源出航','资源出航')+'</button>';
    }
    c.innerHTML = h;

    // 목적지 카드 선택 + 미리보기 갱신 (§19: addEventListener)
    var _selDest = (dests[0] && dests[0].key) || 'frontier';
    var capWeights = info.capacityWeights || {};
    var gpPerCapH = info.gpPerCapacityHour || 3;
    function _smFleetCapacity(fleetId){
      // 클라 추정(함급 미상 시 ship_count 근사). 정확값은 서버가 계산.
      var f = usable.find(function(x){ return String(x.id)===String(fleetId); });
      return f ? (parseInt(f.ships_alive)||parseInt(f.ship_count)||1) : 1; // 근사(서버가 함급 weight 정밀 반영)
    }
    function _smUpdatePreview(){
      var pv = document.getElementById('smPreview'); if(!pv) return;
      var fleetId = document.getElementById('smFleet') && document.getElementById('smFleet').value;
      var durEl = document.getElementById('smDur'); var dur = durEl ? parseFloat(durEl.value) : (durs[0]||1);
      var dest = dests.find(function(d){ return d.key===_selDest; }) || {yieldMult:1,raidPct:0};
      var approxCap = _smFleetCapacity(fleetId);
      var allianceBonus = _smAllianceBonus(info, dest.key);
      var territoryBonus = _smTerritoryBonus(info, dest.key);
      var routeControlBonus = _smRouteControlBonus(info, dest.key);
      var estGp = Math.round(approxCap * dur * gpPerCapH * (Number(dest.yieldMult)||1) * routeControlBonus);
      var raid = Math.round((Number(dest.raidPct)||0)*100);
      var wear = Number(dest.wearMult)||1;
      pv.innerHTML = tl('Est.','예상','推定','预计')+' ~'+estGp.toLocaleString()+' GP · '+tl('materials','재료','素材','素材')+' 🪨'
        + ' · <span style="color:#ffab40">'+tl('hull wear','내구 마모','耐久摩耗','耐久损耗')+' ×'+wear+'</span>'
        + (raid>0 ? (' · <span style="color:#d9483b">⚠ '+tl('raid','약탈','襲撃','袭击')+' '+raid+'%</span>') : '')
        + (allianceBonus>1 ? (' · <span style="color:#80cbc4">🛡 '+tl('alliance','동맹','同盟','联盟')+' +'+Math.round((allianceBonus-1)*100)+'%</span>') : '')
        + (territoryBonus>1 ? (' · <span style="color:#64dc82">🏴 '+tl('territory','영토','領土','领地')+' +'+Math.round((territoryBonus-1)*100)+'%</span>') : '')
        + ' <span style="color:var(--tx3)">('+tl('exact yield uses ship class','정확 수율은 함급 반영','正確な収率は艦級反映','精确产量按舰级')+')</span>';
    }
    Array.prototype.forEach.call(c.querySelectorAll('.sm-dest'), function(card){
      card.addEventListener('click', function(){
        _selDest = card.getAttribute('data-dest');
        Array.prototype.forEach.call(c.querySelectorAll('.sm-dest'), function(o){
          var k=o.getAttribute('data-dest'); var dm={frontier:'#3fb6a8',mid:'#e0a93b',core:'#d9483b'}[k]||'#888';
          var on=(k===_selDest);
          o.style.borderColor = on?dm:'rgba(255,255,255,.12)';
          o.style.background = on?(dm+'22'):'rgba(0,0,0,.2)';
        });
        _smUpdatePreview();
      });
    });
    var smFleetEl=document.getElementById('smFleet'); if(smFleetEl) smFleetEl.addEventListener('change', _smUpdatePreview);
    var smDurEl=document.getElementById('smDur'); if(smDurEl) smDurEl.addEventListener('change', _smUpdatePreview);
    _smUpdatePreview();

    // 핸들러 (갓 생성한 요소에 직접 — §19: inline concat 금지, addEventListener 사용)
    var launchBtn = document.getElementById('smLaunch');
    if (launchBtn) launchBtn.addEventListener('click', function(){
      var fleetId = parseInt(document.getElementById('smFleet').value,10);
      var durationH = parseFloat(document.getElementById('smDur').value);
      launchBtn.disabled = true; launchBtn.textContent = '...';
      fetch('/api/mining/launch',{method:'POST',headers:Object.assign({'Content-Type':'application/json'},getAuthHeaders()),body:JSON.stringify({fleetId:fleetId,durationH:durationH,destination:_selDest})})
        .then(function(r){return r.json();}).then(function(d){
          if (d.error){ showToast(_smErr(d.error),'error'); launchBtn.disabled=false; launchBtn.textContent='⛏ '+tl('DEPLOY RESOURCE RUN','자원 출항','資源出航','资源出航'); return; }
          showToast('⛏ '+tl('Mining run launched!','채굴 출항 완료!','採掘出航!','采矿出航!'));
          _renderShipMining();
        }).catch(function(){ showToast(tl('Launch failed','출항 실패','失敗','失败'),'error'); launchBtn.disabled=false; launchBtn.textContent='⛏ '+tl('DEPLOY RESOURCE RUN','자원 출항','資源出航','资源出航'); });
    });
    Array.prototype.forEach.call(c.querySelectorAll('.sm-collect'), function(btn){
      btn.addEventListener('click', function(){
        var jobId = parseInt(btn.getAttribute('data-job'),10);
        btn.disabled = true; btn.textContent = '...';
        fetch('/api/mining/collect',{method:'POST',headers:Object.assign({'Content-Type':'application/json'},getAuthHeaders()),body:JSON.stringify({jobId:jobId})})
          .then(function(r){return r.json();}).then(function(d){
            if (d.error){ showToast(_smErr(d.error),'error'); btn.disabled=false; btn.textContent=tl('COLLECT','수령','受取','领取'); return; }
            var matN = (d.resources||[]).reduce(function(a,x){return a+(x.quantity||0);},0);
            var msg = '⛏ +'+_fmtGp(d.rewardGp)+' GP'+(matN>0?(' · +'+matN+' '+tl('materials','재료','素材','素材')):'');
            if (Number(d.allianceSectorBonus) > 1) msg += ' · 🛡 '+tl('alliance','동맹','同盟','联盟')+' +'+Math.round((Number(d.allianceSectorBonus)-1)*100)+'%';
            if (Number(d.territorySectorBonus) > 1) msg += ' · 🏴 '+tl('territory','영토','領土','领地')+' +'+Math.round((Number(d.territorySectorBonus)-1)*100)+'%';
            if (d.raided) msg += ' · ⚠ '+tl('raided','약탈 피해','襲撃被害','遭袭');
            showToast(msg, d.raided ? 'warn' : 'success');
            try{ refreshBalance(); }catch(_){}
            _renderShipMining();
          }).catch(function(){ showToast(tl('Collect failed','수령 실패','失敗','失败'),'error'); btn.disabled=false; });
      });
    });
  } catch(e) {
    c.innerHTML = '<div style="color:var(--red);font-size:10px">'+tl('Failed to load','불러오기 실패','読み込み失敗','加载失败')+'</div>';
  }
}
function _fmtGp(v){ var n=Math.round(Number(v)||0); return n.toLocaleString(); }
function _smErr(code){
  var m = {
    fleet_already_mining: tl('This fleet is already mining','이미 채굴 중인 함대','既に採掘中','已在采矿'),
    mining_limit_reached: tl('Mining run limit reached','채굴 런 한도 도달','上限到達','已达上限'),
    no_alive_ships: tl('Fleet has no usable ships','사용 가능한 함선 없음','使用可能な艦なし','无可用舰船'),
    fleet_in_battle: tl('Fleet is in battle','전투 중인 함대','戦闘中','战斗中'),
    not_ready: tl('Not finished yet','아직 진행 중','まだ未完了','尚未完成'),
    already_collected: tl('Already collected','이미 수령함','受取済','已领取'),
    insufficient_gp: tl('Not enough GP','GP 부족','GP不足','GP不足'),
    fleet_not_found: tl('Fleet not found','함대를 찾을 수 없음','艦隊が見つかりません','找不到舰队'),
    fleet_in_siege: tl('Fleet is committed to a siege','공성에 투입된 함대','攻城に投入中の艦隊','已投入攻城的舰队'),
    job_not_found: tl('Mining run not found','채굴 런을 찾을 수 없음','採掘ランが見つかりません','找不到采矿任务')
  };
  return m[code] || code;
}

function openShipyard() {
  if (!isLoggedIn()) {
    showFactionToast(t('daily_login_required')||tl('Login required','로그인이 필요합니다','ログインが必要です','请先登录'),'error');
    return;
  }
  document.getElementById('shipyardModal').classList.add('active');
  switchSyTab('blueprints');
  refreshShipyard();
  if (shipyardState.queueTimer) _clearActiveInterval(shipyardState.queueTimer);
  shipyardState.queueTimer = _setActiveInterval(updateQueueProgress, 1000);
}

// 메인 화면 → 가챠(상자) 바로 진입
function openGacha() {
  if (!isLoggedIn()) {
    showFactionToast(t('daily_login_required')||tl('Login required','로그인이 필요합니다','ログインが必要です','请先登录'),'error');
    return;
  }
  openShipyard();
  try { switchSyTab('crates'); } catch(_) {}
}

function closeShipyard() {
  document.getElementById('shipyardModal').classList.remove('active');
  if (shipyardState.queueTimer) {
    _clearActiveInterval(shipyardState.queueTimer);
    shipyardState.queueTimer = null;
  }
}

function switchSyTab(tab) {
  shipyardState.currentTab = tab;
  document.querySelectorAll('.sy-tab').forEach(function(t) {
    t.classList.toggle('active', t.dataset.tab === tab);
  });
  document.getElementById('syBlueprintsTab').style.display = tab === 'blueprints' ? '' : 'none';
  document.getElementById('syQueueTab').style.display      = tab === 'queue'      ? '' : 'none';
  document.getElementById('syFleetTab').style.display      = tab === 'fleet'      ? '' : 'none';
  document.getElementById('syMarketTab').style.display     = tab === 'market'     ? '' : 'none';
  var _cratesTab = document.getElementById('syCratesTab'); if (_cratesTab) _cratesTab.style.display = tab === 'crates' ? '' : 'none';
  var _asmTab = document.getElementById('syAssemblyTab'); if (_asmTab) _asmTab.style.display = tab === 'assembly' ? '' : 'none';
  document.getElementById('syFilters').style.display       = tab === 'blueprints' ? '' : 'none';
  if (tab === 'queue') renderQueue();
  else if (tab === 'fleet') renderShips();
  else if (tab === 'market') renderShipMarket();
  else if (tab === 'crates') loadShipCrates();
  else if (tab === 'assembly') loadAssembly();
  else renderBlueprints();
}

// ═════ 합체 슈퍼유닛(Assembly) UI — P1+P2 ═════
// 아트 에셋(Codex 제작 예정): 합체체 assets/ships/top/pilgrim_voltaris.png,
// 파츠 assets/assembly/parts/<part_code>.png. 없으면 이모지 아이콘 폴백.
var _asmState = null;
var _asmUnit = null;        // 현재 선택된 유닛 코드
var _asmUnits = [];         // 활성 유닛 목록
var _asmBusy = false;
var _asmBoxBusy = false;
function _asmName(o){ return LANG==='ko'?(o.name_ko||o.name_en):LANG==='ja'?(o.name_ja||o.name_en):LANG==='zh'?(o.name_zh||o.name_en):o.name_en; }
// 이미지(PNG) → 없으면 이모지 폴백. art: assets/ships/top/<ship>.png, assets/assembly/parts/<part>.png
function _asmImg(src, emoji, px){
  return '<img src="'+src+'" data-emoji="'+escapeHtmlSafe(emoji||'🜲')+'" alt="" style="width:'+px+'px;height:'+px+'px;object-fit:contain;display:inline-block;vertical-align:middle" onerror="_asmImgFail(this)">';
}
function _asmImgFail(img){
  try{ var s=document.createElement('span'); s.textContent=img.getAttribute('data-emoji')||'🜲'; s.style.fontSize=Math.round((parseInt(img.style.width)||24)*0.8)+'px'; img.replaceWith(s); }catch(_){ }
}

async function loadAssembly() {
  var wrap = document.getElementById('asmWrap');
  if (!wrap) return;
  var w = (typeof getMyWallet === 'function' ? getMyWallet() : '') || '';
  if (!w) { wrap.innerHTML = '<div style="text-align:center;color:var(--tx3);padding:24px;font-size:10px">'+tl('Login required','로그인이 필요합니다','ログインが必要です','请先登录')+'</div>'; return; }
  wrap.innerHTML = '<div style="text-align:center;color:var(--tx3);padding:24px;font-size:10px">'+tl('Loading…','로딩 중…','読み込み中…','加载中…')+'</div>';
  try {
    var ur = await fetch('/api/assembly/units?wallet=' + encodeURIComponent(w), { headers: Object.assign({'x-wallet':w}, getAuthHeaders()) });
    var ud = await ur.json();
    _asmUnits = (ud && ud.units) || [];
    if (!_asmUnits.length) { wrap.innerHTML = '<div style="text-align:center;color:var(--tx3);padding:24px;font-size:10px">'+tl('No units available','이용 가능한 유닛이 없습니다','利用可能なユニットなし','无可用单位')+'</div>'; return; }
    if (!_asmUnit || !_asmUnits.some(function(u){return u.unit_code===_asmUnit;})) _asmUnit = _asmUnits[0].unit_code;
    renderAssembly(_asmUnits);
  } catch(e) { wrap.innerHTML = '<div style="text-align:center;color:#ef5350;padding:24px;font-size:10px">'+tl('Network error','네트워크 오류','ネットワークエラー','网络错误')+'</div>'; }
}
var ASSET_VER = '7407'; // 합체 유닛 아트 버전 — 아트 교체 시 올려 브라우저 캐시 무효화 (v7.407: tactical-lab 스프라이트 캐시버스트 합류)
function _asmKindLabel(k){ return ({robot:tl('Robot','로봇','ロボ','机器人'),ship:tl('Ship','함선','艦船','舰船'),astronaut:tl('Astronaut','우주인','宇宙飛行士','宇航员'),mech:tl('Mech','메크','メック','机甲'),alien:tl('Alien','외계생명체','エイリアン','外星生命')})[k]||k; }
// 역할 특성 라벨 + 한줄 설명(전투 매치업 기반)
function _asmRoleInfo(role){
  var m = {
    dps:    [tl('Striker','주력 화력','主力','主力'),     tl('Balanced damage dealer','균형 잡힌 주력 딜러','バランス型','均衡输出')],
    tackle: [tl('Vanguard','고속 선봉','先鋒','先锋'),    tl('Fast, hunts small ships & flagships','빠르게 소형함·기함 사냥','小型・旗艦狩り','猎杀小型与旗舰')],
    bomb:   [tl('Bomber','대형 폭격','爆撃','轰炸'),      tl('Crushes battleships & titans','전함·타이탄 특효','大型艦に特効','克制战列与泰坦')],
    tank:   [tl('Fortress','요새 방어','要塞','要塞'),    tl('Soaks damage, anchors the line','피해 흡수, 전열 유지','耐久・前列','吸收伤害守前排')],
    ewar:   [tl('Disruptor','전자전','電子戦','电子战'),  tl('Jams enemy fire & targeting','적 사격·조준 교란','妨害','干扰敌火力')],
    sniper: [tl('Sniper','장거리 저격','狙撃','狙击'),    tl('Long-range, kills capitals','장거리에서 대형함 격파','遠距離','远程击杀大型')]
  };
  return m[(role||'dps').toLowerCase()] || m.dps;
}
// [v7.319] 역할 → 권장 전투 진형 (전투 미리보기 배지)
function _asmFormationInfo(role){
  var M={
    sniper:{icon:'🔻',label:tl('Rear Artillery','후방 포격','後方砲撃','后方炮击')},
    bomb:  {icon:'🔻',label:tl('Rear Bombard','후방 폭격','後方爆撃','后方轰炸')},
    ewar:  {icon:'↔',label:tl('Flank Screen','측면 교란','側面攪乱','侧翼干扰')},
    tank:  {icon:'🛡',label:tl('Vanguard Wall','전열 방패','前列の壁','前列盾墙')},
    tackle:{icon:'▲',label:tl('Wedge Charge','쐐기 돌격','楔形突撃','楔形冲锋')},
    dps:   {icon:'⬡',label:tl('Sphere Core','구형 중심','球形中心','球形核心')}
  };
  return M[(role||'dps').toLowerCase()] || M.dps;
}
function _asmWeaponLabel(ft){
  return ({ laser:tl('Laser Cannon','레이저포','レーザー','激光炮'), missile:tl('Missile Pods','미사일','ミサイル','导弹'),
    railgun:tl('Railgun','레일건','レールガン','轨道炮'), disruptor:tl('Disruptor','디스럽터','ディスラプター','干扰器'),
    lance:tl('Precision Lance','정밀 랜스','ランス','精准枪'), swarm:tl('Swarm Autocannon','스웜 기관포','スウォーム','蜂群机炮'),
    spread:tl('Acid Spread','산성 분사','酸噴射','酸液'), plasma:tl('Plasma Burst','플라즈마','プラズマ','等离子'),
    torpedo:tl('Void Torpedo','보이드 어뢰','魚雷','虚空鱼雷') })[ft] || ft || '';
}
// 합체 모달 전투 미리보기: 전술랩 전투에서 쓰이는 탑뷰 스프라이트 + 우주 배경
function _asmBattlePreview(d, unit){
  var code = d.ship_type_code || d.unit_code || '';
  var _fmRole = (unit && unit.role) || d.role || 'dps';
  var _fm = _asmFormationInfo(_fmRole);
  var _fmBadge = '<div style="position:absolute;right:8px;top:8px;display:flex;align-items:center;gap:4px;background:rgba(0,0,0,.55);border:1px solid rgba(125,211,252,.4);border-radius:20px;padding:3px 9px;z-index:6">'+
    '<span style="font-size:12px">'+_fm.icon+'</span><span style="font-size:9px;font-weight:700;color:#7dd3fc">'+_fm.label+'</span></div>';
  return '<div style="padding:11px 13px;border:1px solid rgba(125,211,252,.22);border-radius:10px;background:rgba(125,211,252,.04)">' +
    '<div style="font-size:9px;letter-spacing:1px;color:#7dd3fc;margin-bottom:8px">⚔ '+tl('IN BATTLE (top-down)','전장에서의 모습 (탑뷰)','戦場での姿（トップビュー）','战场样貌（俯视）')+'</div>' +
    '<div style="position:relative;height:150px;border-radius:8px;overflow:hidden;background:radial-gradient(ellipse at 50% 40%,rgba(70,40,90,.5),#05060c 75%)">' +
      '<div style="position:absolute;inset:0;background-image:radial-gradient(1px 1px at 20% 30%,rgba(255,255,255,.5),transparent),radial-gradient(1px 1px at 70% 60%,rgba(255,255,255,.4),transparent),radial-gradient(1px 1px at 40% 80%,rgba(255,255,255,.35),transparent),radial-gradient(1px 1px at 85% 25%,rgba(255,255,255,.45),transparent);opacity:.7"></div>' +
      '<img src="assets/ships/top/'+code+'.png?v='+ASSET_VER+'" alt="" style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);height:128px;width:auto;object-fit:contain;filter:drop-shadow(0 0 14px rgba(179,136,255,.6))" onerror="this.style.display=\'none\';this.parentNode.querySelector(\'.asm-bp-fb\').style.display=\'flex\'">' +
      '<div class="asm-bp-fb" style="display:none;position:absolute;inset:0;align-items:center;justify-content:center;font-size:42px;color:rgba(255,255,255,.3)">'+(d.icon||'🜲')+'</div>' +
      _fmBadge +
    '</div>' +
    '<div style="font-size:8px;color:rgba(255,255,255,.4);margin-top:6px">'+tl('This is how the unit appears on the tactical battlefield.','전술 전장에서 이 유닛이 실제로 보이는 모습입니다.','戦術戦場での実際の表示です。','这是战术战场上的实际显示。')+'</div>' +
  '</div>';
}
// 합체 모달 특성 패널: 역할 특성 + 무기 + 설명 + 상성 칩
function _asmTraitPanel(d, unit){
  var role = (unit && unit.role) || 'dps';
  var ft = (unit && unit.fire_type) || '';
  var ri = _asmRoleInfo(role);
  var desc = (LANG==='ko' ? (unit&&unit.description_ko) : (unit&&unit.description_en)) || ri[1];
  var matchup = (typeof shipRoleMatchupChips==='function') ? shipRoleMatchupChips(role) : '';
  return '<div style="margin-bottom:14px;padding:11px 13px;border:1px solid rgba(179,136,255,.2);border-radius:10px;background:rgba(179,136,255,.05)">' +
    '<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-bottom:7px">' +
      '<span style="font-size:9px;font-weight:800;padding:3px 9px;border-radius:999px;background:rgba(179,136,255,.18);border:1px solid #b388ff;color:#e1bee7">⚔ '+escapeHtmlSafe(ri[0])+'</span>' +
      (ft ? '<span style="font-size:9px;padding:3px 9px;border-radius:999px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.16);color:rgba(255,255,255,.78)">🔫 '+escapeHtmlSafe(_asmWeaponLabel(ft))+'</span>' : '') +
    '</div>' +
    '<div style="font-size:9px;line-height:1.55;color:rgba(255,255,255,.66)">'+escapeHtmlSafe(desc)+'</div>' +
    (matchup ? '<div style="margin-top:6px">'+matchup+'</div>' : '') +
  '</div>';
}
function _asmSeasonLabel(s){ return !s || s === 'permanent' ? tl('Permanent','상시','常設','常驻') : escapeHtmlSafe(s); }
function renderAssembly(units) {
  var wrap = document.getElementById('asmWrap');
  if (!wrap) return;
  units = units || _asmUnits || [];
  wrap.innerHTML = '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px">' + units.map(function(u){
    var total = parseInt(u.total_parts,10) || 0;
    var owned = parseInt(u.distinct_owned,10) || 0;
    var pct = total ? Math.min(100, Math.round(owned / total * 100)) : 0;
    var complete = owned >= total && total > 0;
    return '<div class="bp-card" data-action="asm-unit-open" data-unit-code="'+escapeHtmlSafe(u.unit_code||'')+'" style="cursor:pointer;padding:0;overflow:hidden;border:1px solid '+(complete?'rgba(179,136,255,.55)':'rgba(179,136,255,.18)')+';border-radius:14px;background:#0a0e1a;position:relative;transition:transform .15s,box-shadow .15s" onmouseover="this.style.transform=\'translateY(-3px)\';this.style.boxShadow=\'0 8px 28px rgba(179,136,255,.28)\'" onmouseout="this.style.transform=\'\';this.style.boxShadow=\'\'">' +
      '<div style="position:relative;aspect-ratio:3/4;overflow:hidden;background:radial-gradient(circle at 50% 35%,rgba(179,136,255,.18),#05060c 72%)">' +
        '<img src="assets/assembly/portrait/'+(u.unit_code||'')+'.png?v='+ASSET_VER+'" alt="" style="width:100%;height:100%;object-fit:cover;object-position:center top;display:block" onerror="this.style.display=\'none\'">' +
        '<div style="position:absolute;inset:0;background:linear-gradient(180deg,transparent 45%,rgba(5,6,12,.92))"></div>' +
        '<div style="position:absolute;top:9px;left:9px;display:flex;gap:5px">' +
          '<span style="font-size:8px;padding:2px 7px;border-radius:999px;background:rgba(0,0,0,.5);border:1px solid rgba(255,255,255,.18);color:rgba(255,255,255,.8);backdrop-filter:blur(4px)">'+escapeHtmlSafe(_asmKindLabel(u.kind||''))+'</span>' +
          (parseInt(u.built_count,10)>0 ? '<span style="font-size:8px;padding:2px 7px;border-radius:999px;background:rgba(129,199,132,.22);border:1px solid rgba(129,199,132,.5);color:#a5d6a7;backdrop-filter:blur(4px)">'+tl('OWNED','보유중','所持','拥有')+'</span>' : '') +
        '</div>' +
        '<div style="position:absolute;bottom:8px;left:11px;right:11px">' +
          '<div style="font-family:Orbitron,monospace;font-size:14px;font-weight:800;color:#fff;text-shadow:0 2px 8px #000;letter-spacing:.6px">'+escapeHtmlSafe(_asmName(u)||u.unit_code||'Unit')+'</div>' +
          '<div style="font-size:10px;color:'+(complete?'#b388ff':'rgba(255,255,255,.7)')+';margin-top:3px;font-weight:700">'+owned+'/'+total+' '+tl('parts','파츠','パーツ','零件')+(complete?' ✓':'')+'</div>' +
          '<div style="height:5px;background:rgba(255,255,255,.14);border-radius:999px;margin-top:5px;overflow:hidden"><div style="height:100%;width:'+pct+'%;background:linear-gradient(90deg,#7dd3fc,#b388ff)"></div></div>' +
        '</div>' +
      '</div>' +
    '</div>';
  }).join('') + '</div>';
  if (!wrap.dataset.delegated) {
    wrap.dataset.delegated = '1';
    wrap.addEventListener('click', _asmOnClick);
  }
  _asmBindModalDelegation();
}

async function _asmOnClick(ev) {
  var card = ev.target.closest('[data-action="asm-unit-open"]');
  if (!card) return;
  ev.preventDefault(); ev.stopPropagation();
  console.log('[BTN] asm-unit-open triggered');
  await _asmOpenUnitModal(card.getAttribute('data-unit-code'));
}

function _asmBindModalDelegation(){
  var modal = document.getElementById('asmUnitModal');
  if (!modal || modal.dataset.delegated) return;
  modal.dataset.delegated = '1';
  modal.addEventListener('click', _asmOnModalClick);
}
async function _asmFetchUnitState(unitCode){
  var w = (typeof getMyWallet === 'function' ? getMyWallet() : '') || '';
  if (!w || !unitCode) return null;
  var r = await fetch('/api/assembly/state?wallet=' + encodeURIComponent(w) + '&unit_code=' + encodeURIComponent(unitCode), { headers: Object.assign({'x-wallet':w}, getAuthHeaders()) });
  var d = await r.json();
  if (d && !d.error) { _asmState = d; _asmUnit = unitCode; }
  return d;
}
async function _asmOpenUnitModal(unitCode){
  var modal = document.getElementById('asmUnitModal');
  var c = document.getElementById('asmUnitModalContent');
  if (!modal || !c) return;
  _asmUnit = unitCode || _asmUnit;
  modal.style.display = 'flex';
  c.innerHTML = '<div style="padding:24px;text-align:center;color:var(--tx3);font-size:10px">'+tl('Loading…','로딩 중…','読み込み中…','加载中…')+'</div>';
  try {
    var d = await _asmFetchUnitState(_asmUnit);
    if (!d || d.error) { c.innerHTML = '<div style="padding:24px;color:#ef5350;font-size:10px">'+tl('Unavailable','이용 불가','利用不可','不可用')+(d&&d.error?(' ('+escapeHtmlSafe(d.error)+')'):'')+'</div>'; return; }
    _asmRenderUnitModal(d);
  } catch(e) { c.innerHTML = '<div style="padding:24px;color:#ef5350;font-size:10px">'+tl('Network error','네트워크 오류','ネットワークエラー','网络错误')+'</div>'; }
}
function _asmCloseUnitModal(){
  var modal = document.getElementById('asmUnitModal');
  if (modal) modal.style.display = 'none';
}
function _asmQualityStars(q){
  var qm = (typeof _crateQualityMeta !== 'undefined' && q) ? _crateQualityMeta[q] : null;
  return (qm && qm.stars > 0) ? ' '+('★'.repeat(qm.stars))+' ' : ' ';
}
function _asmQualityLabel(q){
  var qm = (typeof _crateQualityMeta !== 'undefined' && q) ? _crateQualityMeta[q] : null;
  if (!qm) return '';
  return LANG === 'ko' ? qm.ko : qm.en;
}
function _asmRenderUnitModal(d){
  var c = document.getElementById('asmUnitModalContent');
  if (!c) return;
  var unit = d.unit || {};
  var pct = d.total_parts ? Math.round((d.distinct_owned||0) / d.total_parts * 100) : 0;
  var maxReached = parseInt(d.built_count,10) >= parseInt(d.max_per_player,10);
  var mob = (typeof window!=="undefined") && window.innerWidth <= 760;
  var slots = (d.parts||[]).map(function(p){
    var has = parseInt(p.owned,10) >= 1;
    return '<div style="min-height:118px;text-align:center;padding:10px 6px;border-radius:8px;border:1px solid '+(has?'rgba(179,136,255,.58)':'rgba(255,255,255,.1)')+';background:'+(has?'rgba(179,136,255,.12)':'rgba(255,255,255,.025)')+'">' +
      '<div style="height:42px;display:flex;align-items:center;justify-content:center;filter:'+(has?'none':'grayscale(1) opacity(.38)')+'">'+_asmImg('assets/assembly/parts/'+(p.part_code||'')+'.png', p.icon||'🜲', 38)+'</div>' +
      '<div style="font-size:8px;color:'+(has?'#e1bee7':'rgba(255,255,255,.42)')+';margin-top:7px;line-height:1.35">'+escapeHtmlSafe(_asmName(p)||p.part_code||'Part')+'</div>' +
      '<div style="font-size:8px;color:'+(has?'#81c784':'#ef9a9a')+';margin-top:5px">'+(has?tl('OWNED','보유','所持','拥有'):tl('MISSING','미보유','未所持','缺少'))+'</div>' +
    '</div>';
  }).join('');
  var exchangeBtns = (d.parts||[]).filter(function(p){ return parseInt(p.owned,10) < 1; }).map(function(p){
    var cost = parseInt(p.exchange_cost,10) || parseInt(d.shard_exchange_cost,10) || 40;
    var enough = (parseInt(d.shards,10)||0) >= cost;
    return '<button type="button" class="fd-btn" data-action="asm-exchange" data-part-code="'+escapeHtmlSafe(p.part_code||'')+'" '+(enough?'':'disabled')+' style="font-size:8px">'+(p.icon||'🜲')+' '+escapeHtmlSafe(_asmName(p)||p.part_code||'Part')+' · '+formatNum(cost)+'</button>';
  }).join('');
  var built = parseInt(d.built_count,10)>0;
  var actionHtml = built
    ? '<div style="padding:11px 13px;border:1px solid rgba(129,199,132,.32);border-radius:10px;background:rgba(129,199,132,.07)">' +
        '<div style="font-size:10px;color:#a5d6a7;letter-spacing:.6px;margin-bottom:8px">✓ '+tl("ACTIVATED — deployed in your fleet","기동 완료 — 함대에 배치됨","起動完了 — 艦隊配備","已启动 — 已部署")+'</div>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
          '<button type="button" class="fd-btn primary" data-action="asm-upgrade" style="flex:1;min-width:130px">⬆ '+tl("Go to Upgrade","강화하러 가기","強化へ","前往强化")+'</button>' +
          '<button type="button" class="fd-btn danger" data-action="asm-disassemble" style="flex:1;min-width:130px">🔧 '+tl("DISASSEMBLE","해체","分解","拆解")+'</button>' +
        '</div></div>'
    : '<button type="button" class="fd-btn primary" data-action="asm-assemble" '+(d.can_assemble && !maxReached ? '' : 'disabled')+' style="width:100%;padding:13px;font-size:13px;letter-spacing:1px">🜲 '+(maxReached?tl('MAX OWNED','최대 보유','上限所持','已达上限'):tl('ACTIVATE','기동','起動','启动'))+(d.assemble_gp_cost>0?(' · '+formatNum(d.assemble_gp_cost)+' GP'):'')+'</button>';
  var shardHtml = '<div style="padding:10px;border:1px solid rgba(255,255,255,.08);border-radius:8px;background:rgba(255,255,255,.025)">' +
        '<div style="font-size:9px;color:rgba(255,255,255,.58);letter-spacing:.8px">💎 '+tl('SHARDS','조각','シャード','碎片')+': <b style="color:#fff">'+formatNum(d.shards)+'</b> · '+tl('exchange cost','교환 비용','交換コスト','兑换消耗')+' <b style="color:#e1bee7">'+formatNum(d.shard_exchange_cost)+'</b></div>' +
        (exchangeBtns ? '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:9px">'+exchangeBtns+'</div>' : '<div style="font-size:8px;color:rgba(255,255,255,.35);margin-top:8px">'+tl('All parts collected','모든 파츠 보유','全パーツ所持','已集齐')+'</div>') +
      '</div>';
  c.innerHTML =
    '<div class="asm-modal-grid" style="display:grid;grid-template-columns:'+(mob?'1fr':'minmax(280px,42%) 1fr')+';gap:0">' +
      // ── 좌: 대형 히어로샷 ──
      '<div style="position:relative;min-height:'+(mob?'40vh':'520px')+';background:radial-gradient(circle at 50% 32%,rgba(179,136,255,.22),#05060c 72%);overflow:hidden;border-radius:'+(mob?'14px 14px 0 0':'14px 0 0 14px')+'">' +
        '<img src="assets/assembly/portrait/'+(d.unit_code||d.ship_type_code||'')+'.png?v='+ASSET_VER+'" alt="" style="width:100%;height:100%;object-fit:cover;object-position:center top;display:block;position:absolute;inset:0" onerror="this.style.display=\'none\'">' +
        '<div style="position:absolute;inset:0;background:linear-gradient(180deg,transparent 55%,rgba(5,6,12,.96))"></div>' +
        '<div style="position:absolute;top:12px;left:12px;display:flex;gap:6px">' +
          '<span style="font-size:9px;padding:3px 9px;border-radius:999px;background:rgba(0,0,0,.55);border:1px solid rgba(255,255,255,.2);color:#fff;backdrop-filter:blur(4px)">'+escapeHtmlSafe(_asmKindLabel(d.kind||''))+'</span>' +
          (d.season&&d.season!=='permanent'?'<span style="font-size:9px;padding:3px 9px;border-radius:999px;background:rgba(255,209,102,.2);border:1px solid #ffd166;color:#ffd166">'+tl('Limited','한정','限定','限定')+'</span>':'') +
        '</div>' +
        '<div style="position:absolute;bottom:14px;left:16px;right:16px">' +
          '<div style="font-family:Orbitron,monospace;font-size:24px;font-weight:900;color:#fff;text-shadow:0 0 18px rgba(179,136,255,.9),0 2px 10px #000;letter-spacing:1px">'+escapeHtmlSafe(_asmName(unit)||d.unit_code||'Unit')+'</div>' +
          (unit.base_hp?'<div style="font-size:10px;color:#e1bee7;margin-top:5px;text-shadow:0 1px 4px #000">HP '+formatNum(unit.base_hp)+' · ATK '+formatNum(unit.base_atk)+' · DEF '+formatNum(unit.base_def)+'</div>':'') +
        '</div>' +
      '</div>' +
      // ── 우: 정보/파츠/액션 ──
      '<div style="padding:16px 18px;display:flex;flex-direction:column;gap:12px;position:relative">' +
        '<button type="button" class="shipyard-close" data-action="asm-modal-close" style="position:absolute;top:12px;right:14px">✕</button>' +
        _asmTraitPanel(d, unit) +
        _asmBattlePreview(d, unit) +
        '<div style="display:flex;align-items:center;gap:10px"><div style="flex:1;height:8px;background:rgba(255,255,255,.08);border-radius:999px;overflow:hidden"><div style="height:100%;width:'+pct+'%;background:linear-gradient(90deg,#7dd3fc,#b388ff)"></div></div><div style="font-size:13px;color:#b388ff;font-weight:800">'+(d.distinct_owned||0)+'/'+(d.total_parts||0)+'</div></div>' +
        '<div class="asm-modal-parts" style="display:grid;grid-template-columns:repeat(5,1fr);gap:8px">'+slots+'</div>' +
        actionHtml +
        shardHtml +
      '</div>' +
    '</div>';
}
async function _asmOnModalClick(ev){
  var modal = document.getElementById('asmUnitModal');
  if (ev.target === modal) { _asmCloseUnitModal(); return; }
  var btn = ev.target.closest('[data-action]');
  if (!btn || btn.disabled) return;
  var act = btn.getAttribute('data-action');
  if (act === 'asm-modal-close') { _asmCloseUnitModal(); return; }
  if (act === 'asm-upgrade') { _asmCloseUnitModal(); try { switchSyTab('fleet'); } catch(_){} return; }
  if (_asmBusy) return;
  ev.preventDefault(); ev.stopPropagation();
  console.log('[BTN] '+act+' triggered');
  var w = (typeof getMyWallet === 'function' ? getMyWallet() : '') || '';
  if (!w || !_asmUnit) return;
  var prev = btn.textContent;
  _asmBusy = true; btn.disabled = true; btn.textContent = '…';
  try {
    var res = null;
    if (act === 'asm-assemble') {
      res = await _asmPost('/api/assembly/assemble', w, { unit_code: _asmUnit });
      if (res.error) showFactionToast(_asmErr(res), 'error');
      else {
        var qTxt = res.quality ? (_asmQualityStars(res.quality)+_asmQualityLabel(res.quality)).trim()+' ' : '';
        showFactionToast('🜲 '+qTxt+tl('Activated!','기동 완료!','起動完了！','启动完成！'), 'success');
      }
    } else if (act === 'asm-disassemble') {
      var ok = await gameConfirm({ icon:'🔧', title:tl('Disassemble','해체','分解','拆解'), body:tl('Return parts and remove the assembled unit?','파츠로 환원하고 합체체를 해체할까요?','パーツに戻して合体ユニットを解体しますか？','拆解为零件并移除合体单位？'), confirmText:tl('Disassemble','해체','分解','拆解') });
      if (!ok) return;
      res = await _asmDisassemble(w);
      if (res.error) showFactionToast(_asmErr(res), 'error');
      else showFactionToast(tl('Disassembled','해체 완료','分解完了','已拆解'), 'success');
    } else if (act === 'asm-exchange') {
      res = await _asmPost('/api/assembly/exchange', w, { unit_code: _asmUnit, part_code: btn.getAttribute('data-part-code') });
      if (res.error) showFactionToast(_asmErr(res), 'error');
      else showFactionToast(tl('Exchanged','교환 완료','交換完了','已兑换'), 'success');
    }
    var d = await _asmFetchUnitState(_asmUnit);
    if (d && !d.error) _asmRenderUnitModal(d);
    await loadAssembly();
    try { refreshShipyard(); } catch(_){}
  } catch(e) {
    showFactionToast(tl('Network error','네트워크 오류','ネットワークエラー','网络错误'), 'error');
    btn.disabled = false; btn.textContent = prev;
  } finally {
    _asmBusy = false;
  }
}

async function _asmRefreshAfterBoxPull(){
  _asmState = null;
  if (shipyardState && shipyardState.currentTab === 'assembly') await loadAssembly();
  try { refreshShipyard(); } catch(_){}
}

function _asmPost(url, w, body) {
  return fetch(url, { method:'POST', headers:Object.assign({'Content-Type':'application/json','x-wallet':w}, getAuthHeaders()), body:JSON.stringify(Object.assign({wallet:w}, body)) }).then(function(r){return r.json();});
}
async function _asmDisassemble(w) {
  var sid = _asmState && (_asmState.ship_id || _asmState.assembled_ship_id || _asmState.shipId);
  if (sid) return await _asmPost('/api/assembly/disassemble', w, { ship_id: String(sid) });
  return await _asmPost('/api/assembly/disassemble', w, { unit_code: _asmUnit });
}
function _asmErr(r) {
  var m = {
    INSUFFICIENT_GP: tl('Not enough GP','GP 부족','GP不足','GP不足'),
    INSUFFICIENT_SHARDS: tl('Not enough shards','조각 부족','シャード不足','碎片不足'),
    MISSING_PARTS: tl('Missing parts','파츠 부족','パーツ不足','零件不足'),
    MAX_ASSEMBLED_REACHED: tl('Already own max','이미 최대 보유','最大数所持','已达上限'),
    SHIP_NOT_FOUND: tl('Unit not found','유닛 없음','ユニットなし','未找到单位'),
    GACHA_DISABLED: tl('Gacha disabled','가챠 비활성','ガチャ無効','扭蛋已关闭')
  };
  return m[r.error] || r.error || tl('Error','오류','エラー','错误');
}

// ═════ 함선 가챠(Ship Crate) UI ═════
var _rarityMeta = {
  frigate:    { ko:'프리깃',   en:'Frigate',    col:'#9aa7b4', emoji:'🛰' },
  destroyer:  { ko:'구축함',   en:'Destroyer',  col:'#5cbbff', emoji:'🚀' },
  cruiser:    { ko:'순양함',   en:'Cruiser',    col:'#a78bfa', emoji:'⚓' },
  battleship: { ko:'전함',     en:'Battleship', col:'#ffd54f', emoji:'⚔' },
  titan:      { ko:'타이탄',   en:'Titan',      col:'#ff7a45', emoji:'👑' }
};
function _rarityLabel(c){ var m=_rarityMeta[c]; return m ? (LANG==='ko'?m.ko:m.en) : c; }
async function loadShipCrates() {
  var grid = document.getElementById('crateGrid');
  if (!grid) return;
  grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;color:var(--tx3);padding:24px;font-size:10px">'+(LANG==='ko'?'로딩 중…':'Loading…')+'</div>';
  try {
    // [v7.168] wallet 전달 — pity_remaining(천장까지 N회) 포함하도록
    var r = await fetch('/api/ships/crates', { headers: getAuthHeaders() });
    var d = await r.json();
    if (!d || d.enabled === false || !(d.crates||[]).length) {
      grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;color:var(--tx3);padding:24px;font-size:10px">'+(LANG==='ko'?'이용 가능한 상자가 없습니다.':'No crates available.')+'</div>';
      await _appendPerfectGachaBoxCard(grid);
      return;
    }
    // 가챠 상자 카드 — 상자 배너 + 등급 글로우, 개봉 버튼 하단 정렬
    // 배너/글로우를 상자 코드별로 매핑(인덱스 의존 제거). 신규 상자는 등급 톤에 맞춰 재사용.
    var _crateArt = {
      recruit_crate:   { banner:'assets/banners/crate_recruit.png',   hero:'assets/ships/top/mcc_frg.png', glow:'#4fd1c5' },
      standard_crate:  { banner:'assets/banners/crate_standard.png',  hero:'assets/ships/top/cv_frg.png',  glow:'#7da6ff' },
      premium_crate:   { banner:'assets/banners/crate_premium.png',   hero:'assets/ships/top/fsp_bs.png',  glow:'#b98cff' },
      elite_crate:     { banner:'assets/banners/crate_elite.png',     hero:'assets/ships/top/mcc_crs.png', glow:'#ff5d8f' },
      legendary_crate: { banner:'assets/banners/crate_legendary.png', hero:'assets/ships/top/cv_titan.png',glow:'#ff7a45' }
    };
    var _crateDefault = { banner:'assets/banners/crate_standard.png', hero:'assets/ships/top/cv_frg.png', glow:'#7da6ff' };
    grid.innerHTML = d.crates.map(function(c, idx){
      var oddsHtml = Object.keys(c.odds||{}).sort(function(a,b){ return (c.odds[b]-c.odds[a]); }).map(function(cls){
        var m=_rarityMeta[cls]||{col:'#888',emoji:'•'};
        return '<span style="display:inline-flex;align-items:center;gap:3px;font-size:9px;color:'+m.col+';margin-right:8px">'+m.emoji+' '+_rarityLabel(cls)+' '+c.odds[cls]+'%</span>';
      }).join('');
      // (도파민 #2 v7.390) pity 천장 게이지 — 텍스트만이던 것을 진행 바로 시각화(매몰비용 "한 번 더").
      var pityHtml = '';
      if (c.pity_pulls > 0) {
        var rem = (typeof c.pity_remaining === 'number') ? c.pity_remaining : c.pity_pulls;
        var since = c.pulls_since_rare || 0;
        var pPct = Math.min(100, Math.round(since / c.pity_pulls * 100));
        var pHot = rem <= 2; // 천장 임박 → 펄스 강조
        var pTop = (LANG==='ko'?'순양함+ 확정':LANG==='ja'?'巡洋艦+確定':LANG==='zh'?'巡洋舰+保底':'Cruiser+ guaranteed');
        var pSoon = pHot ? ' '+(LANG==='ko'?'임박!':LANG==='ja'?'目前!':LANG==='zh'?'临近!':'SOON!') : '';
        pityHtml = '<div style="margin-top:3px">'
          + '<div style="font-size:8px;display:flex;justify-content:space-between;align-items:center">'
          +   '<span style="color:var(--gold)">🎯 '+pTop+'</span>'
          +   '<span style="color:'+(pHot?'#ffd166':'var(--gold)')+';font-weight:800">'+since+'/'+c.pity_pulls+pSoon+'</span>'
          + '</div>'
          + '<div style="height:5px;border-radius:4px;background:rgba(255,255,255,.08);overflow:hidden;margin-top:2px'+(pHot?';box-shadow:0 0 8px rgba(255,209,102,.65)':'')+'">'
          +   '<div style="height:100%;width:'+pPct+'%;border-radius:4px;background:linear-gradient(90deg,#ffb300,#ffd166)'+(pHot?';animation:pityPulse 1s ease-in-out infinite':'')+'"></div>'
          + '</div></div>';
      }
      var isFree = !(c.price_gp>0);
      var dailyHtml = (c.daily_limit>0) ? '<div style="font-size:8px;color:#4fd1c5;margin-top:2px">🆓 '+(LANG==='ko'?('1일 '+c.daily_limit+'회 무료'):('Free · '+c.daily_limit+'/day'))+'</div>' : '';
      var label = LANG==='ko' ? (c.label_ko||c.code) : (c.label_en||c.code);
      var art = _crateArt[c.code] || _crateDefault;
      var banner = art.banner, hero = art.hero, glow = art.glow;
      var priceLabel = isFree ? (LANG==='ko'?'무료':'FREE') : (c.price_gp+' GP');
      var btnLabel = (LANG==='ko'?'개봉':'OPEN') + ' · ' + priceLabel;
      return '<div class="bp-card" style="padding:0;overflow:hidden;border:1px solid '+glow+'55;box-shadow:0 0 20px '+glow+'22">'
        + '<div style="position:relative;height:140px;background:radial-gradient(circle at 50% 28%, '+glow+'40, transparent 72%), #0a0e1a;display:flex;align-items:center;justify-content:center;overflow:hidden">'
        +   '<img src="'+banner+'" alt="" style="width:100%;height:140px;object-fit:cover;border-radius:8px 8px 0 0;display:block" onerror="this.onerror=null;this.src=\''+hero+'\';this.style.width=\'auto\';this.style.height=\'120px\';this.style.objectFit=\'contain\';this.style.filter=\'drop-shadow(0 0 14px '+glow+'cc)\'">'
        +   '<div style="position:absolute;inset:0;background:linear-gradient(180deg,transparent 52%,rgba(8,10,20,.94))"></div>'
        +   (isFree ? '<div style="position:absolute;top:9px;right:9px;font-size:9px;font-weight:900;color:#04221f;background:#4fd1c5;padding:2px 7px;border-radius:6px;letter-spacing:.5px">'+(LANG==='ko'?'무료':'FREE')+'</div>' : '')
        +   '<div style="position:absolute;bottom:9px;left:12px;right:12px;font-size:14px;font-weight:900;color:#fff;text-shadow:0 2px 8px #000;letter-spacing:.5px">🎲 '+label+'</div>'
        + '</div>'
        + '<div style="padding:12px;display:flex;flex-direction:column;flex:1;gap:6px">'
        +   '<div style="line-height:1.8">'+oddsHtml+'</div>'
        +   pityHtml
        +   dailyHtml
        +   '<button type="button" onclick="openShipCrate(\''+c.code+'\','+c.price_gp+')" style="margin-top:auto;padding:11px;border-radius:8px;background:linear-gradient(135deg,'+glow+'4d,'+glow+'14);border:1px solid '+glow+'99;color:#fff;font-family:var(--fn);font-size:12px;font-weight:900;cursor:pointer;text-shadow:0 1px 4px #000;letter-spacing:.5px">'+btnLabel+'</button>'
        + '</div>'
        + '</div>';
    }).join('');
    await _appendPerfectGachaBoxCard(grid);
  } catch(e) {
    grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;color:var(--rd);padding:24px;font-size:10px">'+(LANG==='ko'?'불러오기 실패':'Failed to load')+'</div>';
  }
}
function _injectPremiumGachaCss(){
  if (document.getElementById('premiumGachaCss')) return;
  var s = document.createElement('style'); s.id = 'premiumGachaCss';
  s.textContent =
    '.premium-gacha-card{position:relative;border-radius:14px!important;' +
      'background:linear-gradient(125deg,#b388ff,#7dd3fc,#ffd166,#ff5d8f,#b388ff)!important;background-size:300% 300%!important;' +
      'animation:pgcBorder 6s ease infinite;box-shadow:0 0 24px rgba(179,136,255,.4),0 0 60px rgba(179,136,255,.18)!important}' +
    '.premium-gacha-card>.pgc-inner{background:#0a0e1a;border-radius:12px;overflow:hidden;position:relative}' +
    '.premium-gacha-card::after{content:"";position:absolute;inset:0;border-radius:14px;pointer-events:none;z-index:4;' +
      'background:linear-gradient(115deg,transparent 30%,rgba(255,255,255,.20) 48%,transparent 62%);background-size:250% 250%;animation:pgcShine 4.5s ease-in-out infinite}' +
    '.pgc-ribbon{position:absolute;top:13px;right:-32px;transform:rotate(38deg);z-index:5;background:linear-gradient(90deg,#ffd166,#ff8a3d);color:#221400;font-weight:900;font-size:9px;letter-spacing:1px;padding:3px 36px;box-shadow:0 2px 8px rgba(0,0,0,.5)}' +
    '@keyframes pgcBorder{0%{background-position:0% 50%}50%{background-position:100% 50%}100%{background-position:0% 50%}}' +
    '@keyframes pgcShine{0%{background-position:130% 0}60%,100%{background-position:-30% 0}}';
  document.head.appendChild(s);
}
async function _appendPerfectGachaBoxCard(grid) {
  if (!grid) return;
  _injectPremiumGachaCss();
  var card = document.createElement('div');
  card.className = 'bp-card premium-gacha-card';
  card.id = 'perfectGachaBoxCard';
  card.style.cssText = 'padding:2px;overflow:visible';
  _injectPremiumGachaCss();
  card.innerHTML = _perfectGachaBoxHtml(null, true);
  grid.appendChild(card);
  _bindPerfectGachaBoxCard(card);
  var w = (typeof getMyWallet === 'function' ? getMyWallet() : '') || '';
  if (!w) { card.innerHTML = _perfectGachaBoxHtml({ enabled:false, error:'LOGIN_REQUIRED' }, false); return; }
  try {
    var r = await fetch('/api/assembly/box?wallet=' + encodeURIComponent(w), { headers: Object.assign({'x-wallet':w}, getAuthHeaders()) });
    var d = await r.json();
    card.innerHTML = _perfectGachaBoxHtml(d || {}, false);
  } catch(e) {
    card.innerHTML = _perfectGachaBoxHtml({ enabled:false, error:'NETWORK' }, false);
  }
}
function _perfectGachaBoxHtml(d, loading) {
  d = d || {};
  var price = parseInt(d.price_gp,10) || 0;
  var enabled = !loading && d.enabled !== false && !d.error;
  var pity = (typeof d.pity_remaining === 'number') ? d.pity_remaining : '-';
  var pool = (typeof d.pool_size === 'number') ? d.pool_size : '-';
  var status = loading ? tl('Loading…','로딩 중…','読み込み中…','加载中…') :
    (d.error === 'LOGIN_REQUIRED' ? tl('Login required','로그인이 필요합니다','ログインが必要です','请先登录') :
    (d.error ? tl('Unavailable','이용 불가','利用不可','不可用') : (tl('Pity in','천장까지','天井まで','保底还需')+' '+pity+' '+tl('pulls','회','回','次')+' · Pool '+pool)));
  return '<div class="pgc-inner" style="display:flex;flex-direction:column;height:100%">' +
    '<div class="pgc-ribbon">'+tl('PREMIUM','프리미엄','プレミアム','尊享')+'</div>' +
    '<div style="position:relative;height:152px;background-image:url(assets/banners/crate_perfect_assembly.png);background-size:cover;background-position:center;display:flex;align-items:center;justify-content:center;overflow:hidden">' +
      '<div style="position:absolute;inset:0;background:radial-gradient(circle at 50% 28%,rgba(179,136,255,.3),transparent 60%),linear-gradient(180deg,transparent 46%,rgba(8,10,20,.96));box-shadow:inset 0 0 50px rgba(179,136,255,.32)"></div>' +
      '<div style="position:absolute;bottom:11px;left:13px;right:13px">' +
        '<div style="font-family:Orbitron,monospace;font-size:17px;font-weight:900;color:#fff;text-shadow:0 0 16px rgba(179,136,255,.95),0 2px 8px #000;letter-spacing:1px">🜲 '+tl('PERFECT GACHA','퍼펙트 가챠','合体ガチャ','合体扭蛋')+'</div>' +
        '<div style="font-size:8px;color:#e1bee7;letter-spacing:2px;margin-top:2px;text-shadow:0 1px 4px #000">PILGRIM ARMS · LIMITED ARSENAL</div>' +
      '</div>' +
    '</div>' +
    '<div style="padding:12px;display:flex;flex-direction:column;flex:1;gap:8px">' +
      '<div style="font-size:10px;line-height:1.55;color:rgba(255,255,255,.72)">'+tl('Collect parts of robots & alien lifeforms to assemble super-units','로봇·외계생명체 파츠를 모아 기동 슈퍼유닛 완성','ロボ・エイリアンのパーツを集めて合体','收集机器人与外星生命零件合体')+'</div>' +
      '<div style="font-size:9px;color:var(--gold)">🎯 '+status+'</div>' +
      '<div style="font-size:9px;color:rgba(255,255,255,.48)">GP <b style="color:#fff">'+(loading?'-':formatNum(price))+'</b></div>' +
      '<div style="display:flex;gap:8px;margin-top:auto">' +
        '<button type="button" class="fd-btn" data-action="gacha-box-pull" data-count="1" '+(enabled?'':'disabled')+' style="flex:1">1회 · '+formatNum(price)+'GP</button>' +
        '<button type="button" class="fd-btn primary" data-action="gacha-box-pull" data-count="10" '+(enabled?'':'disabled')+' style="flex:1">10연차 · '+formatNum(price*10)+'GP</button>' +
      '</div>' +
    '</div>' +
  '</div>';
}
function _bindPerfectGachaBoxCard(card) {
  if (!card || card.dataset.delegated) return;
  card.dataset.delegated = '1';
  card.addEventListener('click', _onPerfectGachaBoxClick);
}
// 박스 오픈 영상 오버레이 — 모바일=세로(box_open_tall), 데스크탑=가로(box_open_wide). 탭/종료 시 닫힘, 10s 안전장치.
function _playBoxOpenVideo() {
  return new Promise(function(resolve){
    try {
      var portrait = !(window.innerWidth > 768);
      var src = portrait ? 'assets/assembly/box_open_tall.mp4' : 'assets/assembly/box_open_wide.mp4';
      var ov = document.createElement('div');
      ov.style.cssText = 'position:fixed;inset:0;z-index:99999;background:#000;display:flex;align-items:center;justify-content:center;cursor:pointer';
      var v = document.createElement('video');
      v.src = src; v.autoplay = true; v.muted = false; v.playsInline = true; v.setAttribute('playsinline','');
      v.style.cssText = 'width:100%;height:100%;object-fit:' + (portrait ? 'cover' : 'contain');
      var done = false;
      function fin(){ if(done) return; done = true; clearTimeout(safety); try{ ov.remove(); }catch(_){} resolve(); }
      var safety = setTimeout(fin, 10000);
      v.onended = fin; v.onerror = fin; ov.onclick = fin;
      // [v7.320] 보이는 건너뛰기 버튼 (우상단)
      var _lang=(typeof LANG!=='undefined'?LANG:'ko');
      var _skip=document.createElement('button');
      _skip.type='button';
      _skip.textContent=(_lang==='ko'?'건너뛰기 ▶▶':_lang==='ja'?'スキップ ▶▶':_lang==='zh'?'跳过 ▶▶':'SKIP ▶▶');
      _skip.style.cssText='position:absolute;top:18px;right:18px;z-index:2;background:rgba(0,0,0,.55);border:1px solid rgba(255,255,255,.45);color:#fff;font-size:13px;letter-spacing:1px;padding:8px 16px;border-radius:8px;cursor:pointer';
      _skip.onclick=function(ev){ ev.stopPropagation(); try{v.pause();}catch(_){} fin(); };
      ov.appendChild(v); ov.appendChild(_skip); document.body.appendChild(ov);
      var p = v.play();
      if (p && p.catch) p.catch(function(){ v.muted = true; var p2 = v.play(); if (p2 && p2.catch) p2.catch(fin); });
    } catch(e){ resolve(); }
  });
}
async function _onPerfectGachaBoxClick(ev) {
  var btn = ev.target.closest('button[data-action="gacha-box-pull"]');
  if (!btn || btn.disabled || _asmBoxBusy) return;
  ev.preventDefault(); ev.stopPropagation();
  console.log('[BTN] gacha-box pull triggered');
  var w = (typeof getMyWallet === 'function' ? getMyWallet() : '') || '';
  if (!w) { showFactionToast(tl('Login required','로그인이 필요합니다','ログインが必要です','请先登录'), 'error'); return; }
  var count = parseInt(btn.getAttribute('data-count'),10) || 1;
  var card = document.getElementById('perfectGachaBoxCard');
  _asmBoxBusy = true;
  var prev = btn.textContent;
  btn.disabled = true; btn.textContent = '…';
  try {
    var _boxVid = _playBoxOpenVideo();
    var r = await _asmPost('/api/assembly/box/pull', w, { count: count });
    try { await _boxVid; } catch(_){}
    if (r.error || r.success === false) {
      showFactionToast(_asmErr(r), 'error');
    } else {
      var results = r.results || [];
      var newCnt = results.filter(function(x){ return x.is_new; }).length;
      var dupCnt = results.filter(function(x){ return x.is_dup; }).length;
      var shards = r.shards_gained || results.reduce(function(a,x){ return a + (parseInt(x.shards_gain,10)||0); }, 0);
      showFactionToast(tl('Pulled','뽑기 완료','排出完了','抽取完成')+' ×'+(r.count||count)+' · '+tl('new','신규','新規','新')+' '+newCnt+' / '+tl('dup','중복','重複','重复')+' '+dupCnt+' / +'+formatNum(shards)+' '+tl('shards','조각','シャード','碎片'), 'success');
      await _refreshPerfectGachaBoxCard(card);
      await _asmRefreshAfterBoxPull();
    }
  } catch(e) {
    showFactionToast(tl('Network error','네트워크 오류','ネットワークエラー','网络错误'), 'error');
  } finally {
    _asmBoxBusy = false;
    if (btn && btn.isConnected) { btn.disabled = false; btn.textContent = prev; }
  }
}
async function _refreshPerfectGachaBoxCard(card) {
  card = card || document.getElementById('perfectGachaBoxCard');
  if (!card) return;
  var w = (typeof getMyWallet === 'function' ? getMyWallet() : '') || '';
  try {
    var r = await fetch('/api/assembly/box?wallet=' + encodeURIComponent(w), { headers: Object.assign({'x-wallet':w}, getAuthHeaders()) });
    var d = await r.json();
    card.innerHTML = _perfectGachaBoxHtml(d || {}, false);
  } catch(e) {
    card.innerHTML = _perfectGachaBoxHtml({ enabled:false, error:'NETWORK' }, false);
  }
}
async function openShipCrate(code, priceGp) {
  var ok = await gameConfirm({
    icon: '🎲',
    title: LANG==='ko'?'상자 개봉':'Open Crate',
    body: (LANG==='ko'?'무작위 함선 1척을 획득합니다.':'You will receive 1 random ship.'),
    info: [{ k: LANG==='ko'?'비용':'Cost', v: (priceGp>0 ? (priceGp + ' GP') : (LANG==='ko'?'무료':'FREE')) }],
    confirmText: LANG==='ko'?'개봉':'OPEN'
  });
  if (!ok) return;
  try {
    var r = await fetch('/api/ships/crates/'+encodeURIComponent(code)+'/open', {
      method:'POST', headers: Object.assign({'Content-Type':'application/json'}, getAuthHeaders())
    });
    var d = await r.json();
    if (!r.ok || d.error) {
      var em = { INSUFFICIENT_GP: (LANG==='ko'?'GP가 부족합니다':'Not enough GP'),
        NO_FACTION:(LANG==='ko'?'먼저 파벌을 선택하세요':'Pick a faction first'),
        DAILY_LIMIT_REACHED:(LANG==='ko'?'오늘 무료 개봉을 모두 사용했습니다':'Daily free opens used up'),
        SHIP_TYPE_LIMIT:(LANG==='ko'?'해당 함급 보유 한도에 도달했습니다 (GP 미차감)':'Ship type limit reached (no GP charged)'),
        CRATE_DISABLED:(LANG==='ko'?'가챠가 비활성화됨':'Crates disabled') };
      showToast(em[d.error] || d.error || (LANG==='ko'?'개봉 실패':'Open failed'), 'error');
      return;
    }
    // 잔액/함대 갱신은 모달 뒤에서 진행
    try { refreshGP(); } catch(_) {}
    try { if (typeof refreshShipyard==='function') refreshShipyard(); } catch(_) {}
    // [v7.219] 결과 카드 전에 개봉 서스펜스 연출 — rarity/quality 따라 강도 차등. 끝나면 reveal.
    try { await playCrateOpening(d); } catch(_) {}
    showCrateReveal(d, code, priceGp);
  } catch(e) { showToast(LANG==='ko'?'개봉 실패':'Open failed', 'error'); }
}

// ── [v7.219] 가챠 개봉 서스펜스 연출 — 박스 흔들림(충전) → 빛 폭발 → reveal.
//   rarity/quality tier 가 높을수록 흔들림·폭발 화려. Promise — 끝나면 showCrateReveal 호출.
//   reduced-motion / 자산 없음에도 안전(최소 시간 후 resolve).
function playCrateOpening(d){
  return new Promise(function(resolve){
    try {
      var s = (d && d.ship) || {};
      var rm = (_rarityMeta && _rarityMeta[s.rarity]) || { col:'#9aa7b4' };
      var qm = (_crateQualityMeta && _crateQualityMeta[s.quality]) || _crateQualityMeta.common;
      // tier 0~4 — rarity + quality 중 큰 값 기준 연출 강도.
      var rarityTier = ({common:0,uncommon:1,rare:2,epic:3,legendary:4})[s.rarity] || 0;
      var qualTier = qm.stars || 0;
      var tier = Math.max(rarityTier, qualTier);
      var glow = (qualTier>0 ? qm.col : rm.col) || '#9aa7b4';
      var shk = (2 + tier*1.5) + 'px'; // 흔들림 강도
      var chargeMs = 700, burstMs = 420;

      // reduced-motion 존중 — 즉시 resolve.
      if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        return resolve();
      }

      // [v7.233] 영상이 준비된 티어만 풀스크린 리빌 영상 → 끝나면 resolve. 나머지 티어는 아래 캔버스 연출.
      //   현재는 레전더리만 영상(사용자 제공 4종 풀). 에픽/레어/언커먼/커먼은 영상 도착 시 _GACHA_TIER_VIDEO 에 추가.
      var _tierKey = ['common','uncommon','rare','epic','legendary'][Math.min(tier,4)] || 'common';
      if (_GACHA_TIER_VIDEO[_tierKey]) { _playGachaVideo(resolve, tier, _tierKey); return; }

      var ov = document.createElement('div');
      ov.id = 'crateOpeningOverlay';
      ov.style.cssText = 'position:fixed;inset:0;z-index:100001;display:flex;align-items:center;justify-content:center;background:rgba(4,6,12,.9);backdrop-filter:blur(6px);animation:crFade .2s ease';
      // 박스(상자) — 📦 이모지 + glow. 흔들림.
      ov.innerHTML =
        '<div style="position:relative;width:200px;height:200px;display:flex;align-items:center;justify-content:center">'
        +  (tier>=3 ? '<div style="position:absolute;width:340px;height:340px;background:conic-gradient('+glow+'00,'+glow+'66,'+glow+'00,'+glow+'66,'+glow+'00);border-radius:50%;animation:crateRayspin '+(tier>=4?3:4)+'s linear infinite;opacity:.5"></div>' : '')
        +  '<div id="_crateBox" style="font-size:96px;filter:drop-shadow(0 0 18px '+glow+'cc);--shk:'+shk+';animation:crateShake '+(chargeMs)+'ms ease-in-out;transform-origin:50% 60%">📦</div>'
        +  '<div id="_crateBurst" style="position:absolute;width:120px;height:120px;border-radius:50%;background:radial-gradient(circle,'+glow+'ff,'+glow+'88 40%,transparent 72%);opacity:0"></div>'
        + '</div>';
      document.body.appendChild(ov);
      try { _sfx.crateCharge(); } catch(_){}

      // 충전 끝 → 폭발
      setTimeout(function(){
        try { _sfx.crateBurst(tier); } catch(_){}
        var box = document.getElementById('_crateBox');
        var burst = document.getElementById('_crateBurst');
        if (box) box.style.animation = 'crateBoxOut '+burstMs+'ms ease-out forwards';
        if (burst) burst.style.animation = 'crateBurstFx '+burstMs+'ms ease-out forwards';
        // 폭발 끝 → overlay 제거 + resolve.
        setTimeout(function(){ try { ov.remove(); } catch(_){}; resolve(); }, burstMs);
      }, chargeMs);

      // 안전망 — 어떤 이유로든 멈추면 1.5s 후 강제 resolve.
      setTimeout(function(){ try { if(document.getElementById('crateOpeningOverlay')) ov.remove(); } catch(_){}; resolve(); }, chargeMs + burstMs + 400);
    } catch(_) { resolve(); }
  });
}

// [v7.233] 티어별 가챠 리빌 영상 매핑. 항목이 있는 티어만 영상 재생, 없으면 캔버스 연출 폴백.
//   pool_h/pool_v: 가로/세로 후보 파일(랜덤). 단일 마스터만 있으면 h/v 키로 지정(반대 방향은 object-fit:cover 크롭).
//   레전더리 = 사용자가 준 4종(가로 2 / 세로 3) 통합 풀. 다른 티어는 영상 도착 시 한 줄 추가.
var _GACHA_TIER_VIDEO = {
  legendary: {
    pool_h: ['gacha_reveal_legendary', 'gacha_reveal'],
    pool_v: ['gacha_reveal_legendary_v', 'gacha_reveal_v01', 'gacha_reveal_v02']
  },
  epic: { h:'gacha_reveal_epic', v:'gacha_reveal_epic_v' },  // 보라 상자, 대형 순양함 (가로/세로 마스터)
  rare: { h:'gacha_reveal_rare', v:'gacha_reveal_rare_v' },     // 파랑 상자, 중형 구축함 (가로/세로 마스터)
  uncommon: { h:'gacha_reveal_uncommon', v:'gacha_reveal_uncommon_v' },  // 초록 상자, 소형 프리깃 (가로/세로 마스터)
  common: { h:'gacha_reveal_common', v:'gacha_reveal_common_v' }         // 회색 상자, 소형 정찰기 (가로/세로 마스터)
  // uncommon:  { h:'gacha_reveal_uncommon' },  // 초록 상자, 소형함
  // common:    { h:'gacha_reveal_common' }     // 회색 상자, 소형 정찰기
};
// [v7.233] 가챠 풀스크린 리빌 영상 — tierKey 의 _GACHA_TIER_VIDEO 항목으로 가로/세로 소스 선택. 끝나거나 탭하면 resolve.
function _playGachaVideo(resolve, tier, tierKey){
  try {
    var ov = document.createElement('div');
    ov.id = 'gachaVideoOverlay';
    ov.style.cssText = 'position:fixed;inset:0;z-index:100002;background:#05040b;display:flex;align-items:center;justify-content:center;overflow:hidden;animation:crFade .2s ease';
    var cfg = _GACHA_TIER_VIDEO[tierKey] || _GACHA_TIER_VIDEO.legendary;
    var mobile = !(window.innerWidth > 768);
    var src, pick = function(arr){ return arr[Math.floor(Math.random()*arr.length)]; };
    if (mobile) src = '/assets/fx/' + (cfg.pool_v ? pick(cfg.pool_v) : (cfg.v || cfg.h || (cfg.pool_h && pick(cfg.pool_h)))) + '.mp4';
    else        src = '/assets/fx/' + (cfg.pool_h ? pick(cfg.pool_h) : (cfg.h || cfg.v || (cfg.pool_v && pick(cfg.pool_v)))) + '.mp4';
    ov.innerHTML =
      '<video id="_gachaVid" playsinline autoplay style="width:100%;height:100%;object-fit:cover"><source src="'+src+'" type="video/mp4"></video>'
      + '<button type="button" id="_gachaSkipBtn" style="position:absolute;top:max(16px,env(safe-area-inset-top));right:max(16px,env(safe-area-inset-right));z-index:2;display:flex;align-items:center;gap:6px;padding:9px 16px;font-family:var(--fn);font-size:12px;font-weight:800;letter-spacing:1px;color:#fff;background:rgba(0,0,0,.5);border:1px solid rgba(255,255,255,.35);border-radius:20px;backdrop-filter:blur(4px);cursor:pointer">'+tl("SKIP","건너뛰기","スキップ","跳过")+' ▸</button>';
    document.body.appendChild(ov);
    var done=false;
    var finish=function(){ if(done)return; done=true; try{ov.remove();}catch(_){}; resolve(); };
    var skipBtn=document.getElementById('_gachaSkipBtn');
    if(skipBtn) skipBtn.addEventListener('click', function(ev){ ev.stopPropagation(); finish(); });
    ov.addEventListener('click', finish);
    var vid=document.getElementById('_gachaVid');
    // [v7.239] 영상 자체 오디오 사용(가챠는 사용자 클릭 제스처 직후라 소리 자동재생 허용).
    //   소리 자동재생이 막히면 음소거로 재시도해 화면은 계속 보이게 한다. WebAudio _sfx 는 더 이상 안 씀.
    if (vid){
      vid.addEventListener('ended', finish, {once:true});
      var pp=vid.play();
      if(pp&&pp.catch) pp.catch(function(){ try{ vid.muted=true; var pp2=vid.play(); if(pp2&&pp2.catch) pp2.catch(function(){ setTimeout(finish,800); }); }catch(_){ setTimeout(finish,800); } });
    }
    setTimeout(finish, 8200); // Veo 리빌 영상 8s 완주 (탭하면 즉시 스킵)
  } catch(_) { resolve(); }
}

// [v7.227] 하이젝 영토 탈취 개시 인트로 영상 — 풀스크린, 가로/세로 분기. 끝나거나 탭하면 resolve.
//   영상 로드 실패/없으면 즉시 resolve (battle viewer 진행 막지 않음). 최대 5초 자동.
function playHijackIntro(){
  return new Promise(function(resolve){
    try {
      if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return resolve();
      var ov = document.createElement('div');
      ov.id = 'hijackIntroOverlay';
      ov.style.cssText = 'position:fixed;inset:0;z-index:100002;background:#05040b;display:flex;align-items:center;justify-content:center;overflow:hidden;animation:crFade .25s ease';
      var src = window.innerWidth > 768 ? '/assets/fx/hijack_intro.mp4' : '/assets/fx/hijack_intro_v.mp4';
      ov.innerHTML =
        '<video id="_hjIntroVid" playsinline autoplay style="width:100%;height:100%;object-fit:cover"><source src="'+src+'" type="video/mp4"></video>'
        + '<div style="position:absolute;left:0;right:0;bottom:0;height:42%;background:linear-gradient(180deg,transparent,rgba(5,4,11,.85));pointer-events:none"></div>'
        + '<div style="position:absolute;top:50%;left:0;right:0;transform:translateY(-50%);text-align:center;font-family:var(--fn);font-size:22px;font-weight:900;letter-spacing:4px;color:#ff6b6b;text-shadow:0 0 24px rgba(232,72,85,.7);pointer-events:none">⚔ '+tl("TERRITORY HIJACK","영토 탈취 개시","領土ハイジャック","领地劫持")+'</div>'
        + '<button type="button" id="_hjSkipBtn" style="position:absolute;top:max(16px,env(safe-area-inset-top));right:max(16px,env(safe-area-inset-right));z-index:2;display:flex;align-items:center;gap:6px;padding:9px 16px;font-family:var(--fn);font-size:12px;font-weight:800;letter-spacing:1px;color:#fff;background:rgba(0,0,0,.5);border:1px solid rgba(255,255,255,.35);border-radius:20px;backdrop-filter:blur(4px);cursor:pointer">'+tl("SKIP","건너뛰기","スキップ","跳过")+' ▸</button>';
      document.body.appendChild(ov);
      var done = false;
      var finish = function(){ if(done) return; done=true; try{ov.remove();}catch(_){}; resolve(); };
      var hjSkip=document.getElementById('_hjSkipBtn');
      if(hjSkip) hjSkip.addEventListener('click', function(ev){ ev.stopPropagation(); finish(); });
      ov.addEventListener('click', finish);
      var vid = document.getElementById('_hjIntroVid');
      // [v7.239] 영상 자체 오디오 사용(하이젝은 사용자 클릭 직후). 막히면 음소거 재시도. WebAudio _sfx 미사용.
      if (vid) {
        vid.addEventListener('ended', finish, { once:true });
        var pp = vid.play();
        if (pp && pp.catch) pp.catch(function(){ try{ vid.muted=true; var pp2=vid.play(); if(pp2&&pp2.catch) pp2.catch(function(){ setTimeout(finish,800); }); }catch(_){ setTimeout(finish,800); } });
      }
      setTimeout(finish, 8200); // Veo 인트로 8s 완주 (탭/SKIP 시 즉시)
    } catch(_) { resolve(); }
  });
}

// ── 가챠 획득 리빌 모달 — 함선 이미지 + 능력치 + 각인 품질 ──
var _crateQualityMeta = {
  common:    { ko:'표준 각인',  en:'Standard',  col:'#9aa7b4', stars:0 },
  uncommon:  { ko:'정예 각인',  en:'Fine',      col:'#5cd6a8', stars:1 },
  rare:      { ko:'걸작 각인',  en:'Superior',  col:'#5c9dff', stars:2 },
  epic:      { ko:'전설 각인',  en:'Prime',     col:'#c08bff', stars:3 },
  legendary: { ko:'신화 각인',  en:'Pristine',  col:'#ffb347', stars:4 },
  mythic:    { ko:'초월 각인',  en:'Mythic',    col:'#ff5cdf', stars:5 }
};
function _qLabel(q){ var m=_crateQualityMeta[q]||_crateQualityMeta.common; return (LANG==='ko'?m.ko:m.en); }
function _fmtStat(n){ if(n===undefined||n===null) return '-'; return (Math.round(n*100)/100).toLocaleString(); }
function _statRow(icon,label,total,bonus){
  var hasB = bonus && bonus>0;
  return '<div style="display:flex;align-items:center;justify-content:space-between;padding:7px 11px;border-radius:7px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.07)">'
    + '<span style="font-size:11px;color:var(--tx2)">'+icon+' '+label+'</span>'
    + '<span style="font-size:12px;font-weight:800;color:#fff">'+_fmtStat(total)
    +   (hasB?' <span style="color:#5cd6a8;font-size:10px;font-weight:800">(+'+_fmtStat(bonus)+')</span>':'')
    + '</span></div>';
}
function showCrateReveal(d, code, priceGp){
  var s = d.ship||{}; var rm = _rarityMeta[s.rarity]||{col:'#fff',emoji:'🚀'};
  var qm = _crateQualityMeta[s.quality]||_crateQualityMeta.common;
  var _bp = ((shipyardState&&shipyardState.blueprints)||[]).find(function(b){ return b.code===s.code||b.ship_type_code===s.code; });
  var name = _bp ? syShipName(_bp) : s.code;
  var enhanced = qm.stars>0;
  var crossFaction = !!s.isCrossFaction;
  var glow = crossFaction ? '#88aacc' : (enhanced ? qm.col : rm.col);
  var stars = qm.stars>0 ? ('<span style="color:'+qm.col+';letter-spacing:2px">'+'★'.repeat(qm.stars)+'<span style="opacity:.25">'+'★'.repeat(Math.max(0,5-qm.stars))+'</span></span>') : '';
  var base=s.base||{}, bonus=s.bonus||{}, st=s.stats||{};
  var old = document.getElementById('crateRevealModal'); if(old) old.remove();
  var balOk = (typeof walletState!=='undefined' && Number(walletState.gameGP||0) >= (priceGp||0));
  var againLabel = priceGp>0 ? (tl('OPEN AGAIN','다시 개봉','もう一度','再开')+' · '+priceGp+' GP') : tl('OPEN AGAIN','다시 개봉','もう一度','再开');
  var el = document.createElement('div');
  el.id='crateRevealModal';
  el.style.cssText='position:fixed;inset:0;z-index:100000;display:flex;align-items:center;justify-content:center;background:rgba(4,6,12,.82);backdrop-filter:blur(6px);padding:18px;animation:crFade .2s ease';
  el.onclick=function(e){ if(e.target===el) el.remove(); };
  el.innerHTML =
    '<div style="position:relative;width:min(440px,94vw);max-height:92vh;overflow:auto;border-radius:16px;'
    + 'background:radial-gradient(circle at 50% 0%, '+glow+'22, rgba(10,12,22,.98) 62%);'
    + 'border:1.5px solid '+glow+'88;box-shadow:0 0 50px '+glow+'55,0 18px 60px rgba(0,0,0,.7);'
    + 'padding:20px 20px 18px;text-align:center;animation:crPop .32s cubic-bezier(.2,1.3,.5,1)">'
    +   '<div style="font-size:13px;font-weight:900;letter-spacing:3px;color:'+glow+';text-shadow:0 0 14px '+glow+'">'+(enhanced?'✨ ':'')+tl('ACQUIRED!','획득!','獲得！','获得！')+(enhanced?' ✨':'')+'</div>'
    +   '<div style="margin-top:7px;display:flex;align-items:center;justify-content:center;gap:7px;flex-wrap:wrap">'
    +     '<span style="font-size:10px;font-weight:800;color:'+rm.col+';background:'+rm.col+'1f;border:1px solid '+rm.col+'55;padding:2px 9px;border-radius:20px">'+rm.emoji+' '+_rarityLabel(s.rarity)+'</span>'
    +     '<span style="font-size:10px;font-weight:800;color:'+qm.col+';background:'+qm.col+'1f;border:1px solid '+qm.col+'55;padding:2px 9px;border-radius:20px">'+_qLabel(s.quality)+(stars?(' '+stars):'')+'</span>'
    +     (d.was_pity?'<span style="font-size:10px;font-weight:800;color:var(--gold);background:rgba(255,209,102,.14);border:1px solid rgba(255,209,102,.5);padding:2px 9px;border-radius:20px">🎯 '+tl('PITY','천장','天井','保底')+'</span>':'')
    +   '</div>'
    +   '<div style="margin:12px auto 4px;width:100%;height:172px;border-radius:12px;overflow:hidden;position:relative;border:1px solid '+glow+'66;box-shadow:inset 0 0 26px '+glow+'33">'
    +     '<div style="position:absolute;inset:0;background:radial-gradient(circle at 50% 45%, '+glow+'33, #06080f 72%)"></div>'
    +     '<img src="assets/ships/reveal/'+s.code+'.jpg" alt="" style="width:100%;height:100%;object-fit:cover;display:block;position:relative;animation:crHeroIn .5s ease" onerror="this.onerror=null;this.src=\'assets/ships/top/'+s.code+'.png\';this.style.objectFit=\'contain\';this.style.padding=\'12px\';this.style.filter=\'drop-shadow(0 0 16px '+glow+'cc)\';this.style.animation=\'crFloat 3s ease-in-out infinite\'">'
    +     '<div style="position:absolute;left:0;right:0;bottom:0;height:42%;background:linear-gradient(180deg,transparent,rgba(6,8,15,.62));pointer-events:none"></div>'
    +   '</div>'
    +   '<div style="font-size:17px;font-weight:900;color:#fff;text-shadow:0 2px 8px #000;letter-spacing:.4px">'+name+'</div>'
    +   (s.isFlagship?'<div style="font-size:9px;color:var(--gold);font-weight:800;margin-top:2px">👑 '+tl('FLAGSHIP','기함','旗艦','旗舰')+'</div>':'')
    +   (enhanced?'<div style="font-size:10px;color:'+qm.col+';font-weight:800;margin-top:5px">⚡ '+tl('ENHANCED SHIP — bonus stats rolled!','강화된 함선 — 추가 능력치 획득!','強化艦 — ボーナス能力獲得！','强化舰 — 获得额外属性！')+'</div>':'')
    +   (crossFaction?'<div style="margin-top:9px;padding:9px 12px;border-radius:9px;background:rgba(136,170,204,.12);border:1px solid rgba(136,170,204,.55);text-align:left">'
    +     '<div style="font-size:10px;font-weight:900;color:#aac4dc;letter-spacing:.8px">🔒 '+tl('OTHER FACTION SHIP','다른 진영 함선','他陣営の艦船','其他阵营舰船')+' ('+(s.faction||'').toUpperCase()+')</div>'
    +     '<div style="font-size:9px;color:rgba(204,220,236,.78);margin-top:3px;line-height:1.4">'+tl('You cannot deploy this ship. List it on the ship market — others in this faction can buy it.','이 함선은 직접 사용할 수 없습니다. 마켓에 등록하면 해당 진영 유저가 구매 가능합니다 — 거래로 가치 실현.','このフレットには配置できません。マーケットに出品すれば該当陣営のユーザーが購入可能です。','无法直接部署。在市场上架后,该阵营玩家可购买 — 通过交易实现价值。')+'</div>'
    +   '</div>':'')
    +   '<div style="margin-top:13px;display:grid;grid-template-columns:1fr 1fr;gap:6px;text-align:left">'
    +     _statRow('⚔', tl('ATK','공격','攻撃','攻击'),   st.atk,   bonus.atk)
    +     _statRow('🛡', tl('DEF','방어','防御','防御'),   st.def,   bonus.def)
    +     _statRow('❤', 'HP',                              st.hp,    bonus.hp)
    +     _statRow('💨', tl('SPD','속도','速度','速度'),   st.speed, bonus.speed)
    +   '</div>'
    +   '<div style="margin-top:15px;display:flex;gap:8px">'
    +     '<button type="button" onclick="document.getElementById(\'crateRevealModal\').remove()" style="flex:1;padding:12px;border-radius:9px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.2);color:#fff;font-family:var(--fn);font-size:12px;font-weight:800;cursor:pointer">'+tl('CONFIRM','확인','確認','确认')+'</button>'
    +     '<button type="button" '+(balOk?'':'disabled')+' onclick="document.getElementById(\'crateRevealModal\').remove();openShipCrate(\''+code+'\','+(priceGp||0)+')" style="flex:1.3;padding:12px;border-radius:9px;background:linear-gradient(135deg,'+glow+'55,'+glow+'1a);border:1px solid '+glow+'aa;color:#fff;font-family:var(--fn);font-size:12px;font-weight:900;cursor:'+(balOk?'pointer':'not-allowed')+';opacity:'+(balOk?'1':'.45')+'">🎲 '+againLabel+'</button>'
    +   '</div>'
    + '</div>';
  document.body.appendChild(el);
}

// ── 🪐 MY MARS PORTFOLIO 모달 (P2O = Play-to-Own 프레임) ──
// 자산 가시화: 보유 함선/영토/PP/USDT를 "소유 자산"으로 표시. "벌어라/수익률/일당" 등 P2E 카피는 사용하지 않는다(법무/경제 권고).
// 체인 미가동 상태에서는 USDT 환금 잠금 + 디스클로저 필수(허위광고 회피).
function openPortfolioModal(){
  if(!isLoggedIn()){
    showFactionToast(t('daily_login_required')||tl('Login required','로그인이 필요합니다','ログインが必要です','请先登录'),'error');
    return;
  }
  // 잔액 — 올바른 필드명(gamePP/gameUsdt) + 폴백
  var pp = Number((walletState && (walletState.gamePP!=null?walletState.gamePP:walletState.PP)) || (_dailyState && _dailyState.ppBalance) || 0);
  var usdt = Number((walletState && (walletState.gameUsdt!=null?walletState.gameUsdt:walletState.usdtBalance)) || 0);
  // 함선·영토는 로그인 직후엔 캐시가 없을 수 있어 API에서 fresh fetch. 우선 placeholder로 렌더 후 패치.
  var owner = (walletState && (walletState.address||walletState.gameAddress)) || (typeof gameWallet!=='undefined'?gameWallet:null) || '';
  // 캐시된 값이 있으면 즉시 표시(부분 정확) — 모달 깜빡임 최소화
  var cachedShips = ((shipyardState && shipyardState.ships) || []).filter(function(s){ return s.is_alive!==false; }).length;
  var cachedTerr = (typeof claims!=='undefined' && claims && owner) ? claims.filter(function(c){ return (c.owner||'').toLowerCase()===(owner||'').toLowerCase(); }).length : 0;
  var shipCount = cachedShips || '—';
  var terrCount = cachedTerr || '—';
  // 환금 가능 잠재가치(PP는 운영 환율·변동, USDT는 보유액). 수익률/일당 환산 금지.
  var redeemable = pp + usdt;
  var chainLive = (typeof walletState!=='undefined' && walletState.chainContractLive===true); // 기본 false
  var old=document.getElementById('portfolioModal'); if(old) old.remove();
  var el=document.createElement('div');
  el.id='portfolioModal';
  el.style.cssText='position:fixed;inset:0;z-index:100000;display:flex;align-items:center;justify-content:center;background:rgba(4,6,12,.85);backdrop-filter:blur(6px);padding:18px;animation:crFade .2s ease';
  el.onclick=function(e){ if(e.target===el) el.remove(); };
  var disclosureColor = chainLive ? '#5cd6a8' : '#ffb347';
  var disclosureText = chainLive
    ? tl('USDT withdrawal active on Base mainnet.','USDT 출금이 Base 메인넷에서 활성화되어 있습니다.','USDT出金がBaseメインネットで有効です。','USDT 提现已在 Base 主网启用。')
    : tl('USDT withdrawal activates at Base mainnet contract launch. PP balance has no current redemption value.','USDT 출금은 Base 메인넷 컨트랙트 가동 시 활성화됩니다. PP 잔액은 현재 환금 가치가 없습니다.','USDTの出金はBaseメインネット契約稼働時に有効になります。PP残高は現在換金価値がありません。','USDT 提现将在 Base 主网合约启动后激活。PP 余额目前无兑现价值。');
  el.innerHTML =
    '<div style="position:relative;width:min(520px,94vw);max-height:92vh;overflow:auto;border-radius:16px;'
    + 'background:radial-gradient(circle at 50% 0%,rgba(184,140,255,.22),rgba(10,12,22,.98) 65%);'
    + 'border:1.5px solid rgba(184,140,255,.6);box-shadow:0 0 50px rgba(184,140,255,.32),0 18px 60px rgba(0,0,0,.7);'
    + 'padding:22px 22px 18px;animation:crPop .32s cubic-bezier(.2,1.3,.5,1)">'
    +   '<div style="text-align:center;font-size:14px;font-weight:900;letter-spacing:2.5px;color:#e7d6ff">🪐 '+tl('MY MARS PORTFOLIO','내 화성 자산 현황','マイ火星ポートフォリオ','我的火星资产')+'</div>'
    +   '<div style="text-align:center;font-size:9.5px;color:rgba(231,214,255,.65);margin-top:4px;letter-spacing:.5px">'+tl('Play · Collect · Trade · Own','플레이 · 수집 · 거래 · 소유','プレイ · 収集 · 取引 · 所有','游戏 · 收集 · 交易 · 拥有')+'</div>'
    // 보유 자산 카드 (수치는 자산 수량 — 수익률 가시화 금지)
    +   '<div style="margin-top:14px;display:grid;grid-template-columns:1fr 1fr;gap:8px">'
    +     _portfolioCard('🛸', tl('SHIPS','함선','艦船','舰船'),       shipCount, tl('On-chain · Tradable','온체인 · 거래가능','オンチェーン · 取引可','链上 · 可交易'), '#5cbbff', 'pfShipsVal')
    +     _portfolioCard('🪨', tl('TERRITORIES','영토','領土','领土'), terrCount,  tl('Pixel-claimed · Mining','픽셀 클레임 · 채굴 중','ピクセル領有 · 採掘','像素占领 · 挖矿中'), '#ff7a45', 'pfTerrVal')
    +     _portfolioCard('💎', 'PP',                                pp.toFixed(2),  tl('Variable rate','운영 환율(변동)','変動レート','可变汇率'), '#caa8ff')
    +     _portfolioCard('💵', 'USDT',                              usdt.toFixed(2),tl('On Base · Yours','Base 체인 · 보유','Baseチェーン · 保有','Base 链 · 持有'), '#5cd6a8')
    +   '</div>'
    // 환금 가능 잠재가치 (잠금 상태 시각화)
    +   '<div style="margin-top:14px;padding:14px;border-radius:11px;background:rgba(255,179,71,.07);border:1px solid '+disclosureColor+'55">'
    +     '<div style="font-size:10px;font-weight:800;color:'+disclosureColor+';letter-spacing:1.2px">'+(chainLive?'🟢 ':'🔒 ')+tl('REDEEMABLE VALUE','환금 가능 잠재가치','換金可能潜在価値','可兑现潜在价值')+'</div>'
    +     '<div style="margin-top:5px;font-size:22px;font-weight:900;color:#fff">$'+redeemable.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})+'</div>'
    +     '<div style="margin-top:3px;font-size:9px;color:rgba(255,255,255,.55);line-height:1.45">'+disclosureText+'</div>'
    +   '</div>'
    // P2O 3-스텝 설명 (법무 권고: "Earn" 미사용, "Own/Trade" 사용)
    +   '<div style="margin-top:14px;padding:12px;border-radius:11px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.08)">'
    +     '<div style="font-size:10px;font-weight:800;color:#e7d6ff;letter-spacing:1.2px;margin-bottom:7px">'+tl('HOW IT WORKS','자산이 쌓이는 방식','資産が積み上がる仕組み','资产积累方式')+'</div>'
    +     _p2oStep('⛏', tl('MINE','채굴','採掘','挖矿'),    tl('Claim Mars territory · accumulate PP','화성 영토 클레임 · PP 누적','火星領土を占領 · PPを蓄積','占领火星领土 · 积累 PP'))
    +     _p2oStep('🛸', tl('COLLECT','수집','収集','收集'), tl('Open crates · build · upgrade fleet','상자 개봉 · 함선 건조 · 강화','箱を開封 · 艦隊建造 · 強化','开箱 · 建造舰队 · 强化'))
    +     _p2oStep('🔁', tl('TRADE','거래','取引','交易'),   tl('Sell ships and assets on the on-chain market','함선·자산을 온체인 마켓에서 거래','艦船・資産をオンチェーン市場で取引','在链上市场交易舰船与资产'))
    +     _p2oStep('🤝', tl('INVITE','초대','招待','邀请'),   tl('Refer friends · earn from their activity (3 tiers)','친구 초대 · 추천 활동 보상 (3단계)','友達を招待 · 紹介報酬（3段階）','邀请好友 · 推荐奖励（3级）'))
    +   '</div>'
    // 추천 네트워크 (1/2/3단 인원수)
    +   '<div style="margin-top:14px;padding:12px;border-radius:11px;background:rgba(79,195,247,.05);border:1px solid rgba(79,195,247,.2)">'
    +     '<div style="font-size:10px;font-weight:800;color:#7dd3fc;letter-spacing:1.2px;margin-bottom:8px">🤝 '+tl('REFERRAL NETWORK','추천 네트워크','リファラル','推荐网络')+'</div>'
    +     '<div id="pfReferralTiers" style="display:flex;gap:6px">'
    +       ['1','2','3'].map(function(n){ return '<div style="flex:1;text-align:center;padding:7px 4px;border-radius:7px;background:rgba(79,195,247,.08)"><div style="font-size:8px;color:rgba(255,255,255,.5)">'+n+tl('-tier','단계','次','级')+'</div><div style="font-size:15px;font-weight:800;color:#4fc3f7">-</div></div>'; }).join('')
    +     '</div>'
    +   '</div>'
    +   '<div style="margin-top:12px;font-size:8.5px;color:rgba(255,255,255,.42);text-align:center;line-height:1.5">'+tl('In-game assets only. No guaranteed earnings. See Terms.','게임 내 자산만 표시. 수익 보장 없음. 약관 참조.','ゲーム内資産のみ。収益保証なし。利用規約参照。','仅显示游戏内资产。无收益保证。详见条款。')+'</div>'
    +   '<button type="button" onclick="document.getElementById(\'portfolioModal\').remove()" style="margin-top:13px;width:100%;padding:12px;border-radius:9px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.2);color:#fff;font-family:var(--fn);font-size:12px;font-weight:800;cursor:pointer">'+tl('CLOSE','닫기','閉じる','关闭')+'</button>'
    + '</div>';
  document.body.appendChild(el);
  // 함선·영토 정확 카운트 비동기 패치(로그인 직후 캐시 비어있어도 정확하게 표시)
  _portfolioFetchFresh(owner);
  // 추천 네트워크 1/2/3단 인원수 비동기 로드
  (function(){
    var w = (owner || (typeof getMyWallet==='function'?getMyWallet():'') || '').toLowerCase();
    if (!w) return;
    fetch('/api/referral/stats/'+encodeURIComponent(w), { headers:{'x-wallet':w} })
      .then(function(r){return r.json()})
      .then(function(s){
        var box=document.getElementById('pfReferralTiers'); if(!box||s.error) return;
        box.innerHTML = ['1','2','3'].map(function(n){
          return '<div style="flex:1;text-align:center;padding:7px 4px;border-radius:7px;background:rgba(79,195,247,.08)">'+
            '<div style="font-size:8px;color:rgba(255,255,255,.5)">'+n+tl('-tier','단계','次','级')+'</div>'+
            '<div style="font-size:15px;font-weight:800;color:#4fc3f7">'+(s['tier'+n]||0)+'</div></div>';
        }).join('') +
        '<div style="flex:1;text-align:center;padding:7px 4px;border-radius:7px;background:rgba(79,195,247,.14);border:1px solid rgba(79,195,247,.3)">'+
          '<div style="font-size:8px;color:rgba(255,255,255,.5)">'+tl('total','총','合計','共')+'</div>'+
          '<div style="font-size:15px;font-weight:800;color:#7dd3fc">'+(s.total||0)+'</div></div>';
      }).catch(function(){});
  })();
}
function _portfolioCard(icon,label,value,sub,color,valId){
  var idAttr = valId ? (' id="'+valId+'"') : '';
  return '<div style="padding:11px 12px;border-radius:10px;background:rgba(255,255,255,.04);border:1px solid '+color+'40">'
    + '<div style="font-size:9px;font-weight:800;color:'+color+';letter-spacing:1px">'+icon+' '+label+'</div>'
    + '<div'+idAttr+' style="margin-top:4px;font-size:18px;font-weight:900;color:#fff">'+value+'</div>'
    + '<div style="font-size:8.5px;color:rgba(255,255,255,.5);margin-top:2px">'+sub+'</div>'
    + '</div>';
}
async function _portfolioFetchFresh(owner){
  // 함선·영토 fresh fetch — 캐시가 없거나 부정확할 때 정확한 카운트로 패치.
  var headers = (typeof getAuthHeaders==='function') ? getAuthHeaders() : {};
  try {
    var shipsResp = await fetch('/api/ships/my', { headers: headers });
    if (shipsResp.ok) {
      var sd = await shipsResp.json();
      var alive = (sd.ships||[]).filter(function(s){ return s.is_alive!==false; }).length;
      var el = document.getElementById('pfShipsVal');
      if (el) el.textContent = alive;
    }
  } catch(_) {}
  try {
    var w = (owner||'').toLowerCase();
    if (!w) return;
    var qs = '?wallet=' + encodeURIComponent(w);
    var terrResp = await fetch('/api/claims/my' + qs, { headers: headers });
    if (terrResp.ok) {
      var td = await terrResp.json();
      var count = Array.isArray(td) ? td.length : ((td && td.length) || 0);
      var el2 = document.getElementById('pfTerrVal');
      if (el2) el2.textContent = count;
    }
  } catch(_) {}
}
function _p2oStep(icon,title,desc){
  return '<div style="display:flex;align-items:flex-start;gap:9px;padding:5px 0">'
    + '<span style="font-size:15px;line-height:1.2;flex:0 0 22px;text-align:center">'+icon+'</span>'
    + '<div><div style="font-size:10.5px;font-weight:800;color:#fff">'+title+'</div>'
    + '<div style="font-size:9.5px;color:rgba(255,255,255,.6);margin-top:1px">'+desc+'</div></div>'
    + '</div>';
}

// ── [v7.174 A-C3] 이메일 인증 배너 + 모달 ──────────────────────────
// 미인증 사용자에게 wallet 패널 위에 작은 배너를 띄우고, 클릭 시 6자리 코드 입력 모달.
// emailAuth.user.emailVerified 기반 자동 갱신.
function updateEmailVerifyBanner(){
  var el = document.getElementById('emailVerifyBanner');
  var u = (typeof emailAuth!=='undefined' && emailAuth && emailAuth.user) || null;
  var show = u && u.email && u.emailVerified === false;
  if (!el && show) {
    el = document.createElement('div');
    el.id = 'emailVerifyBanner';
    el.style.cssText = 'margin:6px 8px 4px;padding:8px 11px;border-radius:8px;background:rgba(255,209,102,.12);border:1px solid rgba(255,209,102,.45);cursor:pointer;display:flex;align-items:center;gap:8px';
    el.onclick = function(){ openEmailVerifyModal(); };
    el.innerHTML = '<span style="font-size:14px">✉️</span><div style="flex:1"><div style="font-size:10px;font-weight:800;color:#ffd166">'+tl('Verify your email','이메일 인증 필요','メール認証が必要','需要邮箱验证')+'</div><div style="font-size:8.5px;color:rgba(255,255,255,.55);margin-top:1px">'+tl('Click to enter the 6-digit code we sent.','코드 6자리 입력하기','6桁コードを入力','输入6位验证码')+'</div></div><span style="font-size:9px;color:#ffd166">→</span>';
    var anchor = document.getElementById('walletSection');
    if (anchor && anchor.parentNode) anchor.parentNode.insertBefore(el, anchor);
  }
  if (el) el.style.display = show ? '' : 'none';
}
function openEmailVerifyModal(){
  var u = (typeof emailAuth!=='undefined' && emailAuth && emailAuth.user) || null;
  if (!u || !u.email) return;
  var old = document.getElementById('emailVerifyModal'); if (old) old.remove();
  var el = document.createElement('div');
  el.id = 'emailVerifyModal';
  el.style.cssText = 'position:fixed;inset:0;z-index:100000;display:flex;align-items:center;justify-content:center;background:rgba(4,6,12,.82);backdrop-filter:blur(6px);padding:18px;animation:crFade .2s ease';
  el.onclick = function(e){ if (e.target===el) el.remove(); };
  el.innerHTML =
    '<div style="position:relative;width:min(380px,94vw);border-radius:14px;background:radial-gradient(circle at 50% 0%,rgba(255,209,102,.2),rgba(10,12,22,.98) 65%);border:1.5px solid rgba(255,209,102,.55);box-shadow:0 0 30px rgba(255,209,102,.25),0 18px 60px rgba(0,0,0,.7);padding:20px;animation:crPop .3s cubic-bezier(.2,1.3,.5,1)">'
    +   '<div style="text-align:center;font-size:14px;font-weight:900;letter-spacing:1.5px;color:#ffd166">✉️ '+tl('VERIFY EMAIL','이메일 인증','メール認証','邮箱验证')+'</div>'
    +   '<div style="text-align:center;font-size:10px;color:rgba(255,255,255,.6);margin-top:6px;line-height:1.5">'+tl('A 6-digit code was sent to','인증 코드가 다음 이메일로 발송되었습니다','6桁コードを以下に送信','6位验证码已发送到')+'<br><b style="color:#fff">'+escapeHtmlSafe(u.email)+'</b></div>'
    +   '<input type="text" id="evCodeInput" maxlength="6" inputmode="numeric" placeholder="000000" style="margin-top:14px;width:100%;padding:11px;border-radius:8px;background:rgba(255,255,255,.05);border:1px solid rgba(255,209,102,.4);color:#fff;font-family:var(--fn);font-size:18px;font-weight:900;letter-spacing:6px;text-align:center" autofocus>'
    +   '<div id="evErr" style="font-size:10px;color:#ff5252;margin-top:8px;min-height:14px;text-align:center"></div>'
    +   '<div style="margin-top:10px;display:flex;gap:8px">'
    +     '<button type="button" onclick="document.getElementById(\'emailVerifyModal\').remove()" style="flex:1;padding:11px;border-radius:8px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.2);color:#fff;font-family:var(--fn);font-size:11px;font-weight:800;cursor:pointer">'+tl('LATER','나중에','後で','稍后')+'</button>'
    +     '<button type="button" id="evVerifyBtn" onclick="_evSubmitVerify()" style="flex:1.5;padding:11px;border-radius:8px;background:linear-gradient(135deg,rgba(255,209,102,.5),rgba(255,209,102,.15));border:1px solid rgba(255,209,102,.7);color:#fff;font-family:var(--fn);font-size:11px;font-weight:900;cursor:pointer">✓ '+tl('VERIFY','인증','認証','验证')+'</button>'
    +   '</div>'
    +   '<button type="button" id="evResendBtn" onclick="_evSubmitResend()" style="margin-top:8px;width:100%;padding:8px;border-radius:7px;background:transparent;border:1px solid rgba(255,255,255,.12);color:rgba(255,255,255,.55);font-family:var(--fn);font-size:9.5px;cursor:pointer">↻ '+tl('Resend code','코드 재발송','コード再送','重新发送')+'</button>'
    + '</div>';
  document.body.appendChild(el);
}
function _evSubmitVerify(){
  var u = (typeof emailAuth!=='undefined' && emailAuth && emailAuth.user) || null;
  var code = (document.getElementById('evCodeInput')||{}).value || '';
  code = String(code).replace(/\D/g,'').trim();
  var errEl = document.getElementById('evErr');
  if (!/^[0-9]{6}$/.test(code)) { if (errEl) errEl.textContent = tl('Enter the 6-digit code.','6자리 코드를 입력하세요.','6桁コードを入力してください。','请输入6位代码。'); return; }
  var btn = document.getElementById('evVerifyBtn'); if (btn) btn.disabled = true;
  fetch('/api/auth/verify-email', {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ email: u.email, code: code })
  }).then(function(r){ return r.json(); }).then(function(d){
    if (d && d.success) {
      if (emailAuth && emailAuth.user) emailAuth.user.emailVerified = true;
      try { document.getElementById('emailVerifyModal').remove(); } catch(_){}
      try { updateEmailVerifyBanner(); } catch(_){}
      showToast(tl('Email verified! ✓','이메일 인증 완료! ✓','メール認証完了！✓','邮箱已验证！✓'), 'success');
    } else {
      var em = {
        invalid_code: tl('Wrong code.','코드가 일치하지 않습니다.','コードが一致しません。','验证码错误。'),
        code_expired: tl('Code expired — resend.','코드 만료 — 재발송하세요.','コード期限切れ — 再送してください。','验证码已过期 — 请重新发送。'),
        no_pending_verification: tl('No pending verification — resend.','대기 중인 인증이 없습니다 — 재발송하세요.','保留中の認証がありません — 再送してください。','无待验证 — 请重新发送。'),
        user_not_found: tl('Account not found.','계정을 찾을 수 없음.','アカウントが見つかりません。','找不到账户。'),
        invalid_code_format: tl('Format: 6 digits.','6자리 숫자만.','6桁数字のみ。','仅限6位数字。')
      };
      if (errEl) errEl.textContent = em[d&&d.error] || (d&&d.error) || tl('Failed','실패','失敗','失败');
      if (btn) btn.disabled = false;
    }
  }).catch(function(){ if (errEl) errEl.textContent = tl('Network error.','네트워크 오류','ネットワークエラー','网络错误'); if (btn) btn.disabled = false; });
}
function _evSubmitResend(){
  var u = (typeof emailAuth!=='undefined' && emailAuth && emailAuth.user) || null;
  if (!u) return;
  var btn = document.getElementById('evResendBtn'); if (btn) btn.disabled = true;
  fetch('/api/auth/resend-verification', {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ email: u.email })
  }).then(function(r){ return r.json(); }).then(function(d){
    var errEl = document.getElementById('evErr');
    if (d && d.success) {
      showToast(tl('Code resent.','코드 재발송됨.','コード再送しました。','已重新发送。'), 'success');
      if (errEl) errEl.textContent = '';
    } else if (d && d.error === 'cooldown') {
      if (errEl) errEl.textContent = tl('Wait '+d.wait_seconds+'s before resending.','재발송까지 '+d.wait_seconds+'초 대기','再送まで'+d.wait_seconds+'秒','请等待'+d.wait_seconds+'秒后重发');
    } else {
      if (errEl) errEl.textContent = (d&&d.error) || tl('Resend failed','재발송 실패','再送失敗','重发失败');
    }
    if (btn) btn.disabled = false;
  }).catch(function(){ var errEl=document.getElementById('evErr'); if (errEl) errEl.textContent = tl('Network error.','네트워크 오류','ネットワークエラー','网络错误'); if (btn) btn.disabled = false; });
}

function filterBySize(size) {
  shipyardState.currentSize = size;
  document.querySelectorAll('.sy-filter-chip').forEach(function(c) {
    c.classList.toggle('active', c.dataset.size === size);
  });
  renderBlueprints();
}

async function refreshShipyard() {
  try {
    var headers = getAuthHeaders();
    var [bpRes, jobsRes, shipsRes, marketRes, summaryRes, factionRes] = await Promise.all([
      fetch('/api/ships/blueprints?includeLocked=1', { headers: headers }),
      fetch('/api/ships/build-jobs', { headers: headers }),
      fetch('/api/ships/my', { headers: headers }),
      fetch('/api/ships/market/listings', { headers: headers }),
      fetch('/api/ships/summary', { headers: headers }),
      fetch('/api/factions/mine', { headers: headers }),
    ]);
    var bpData      = await bpRes.json();
    var jobsData    = await jobsRes.json();
    var shipsData   = await shipsRes.json();
    var marketData  = await marketRes.json();
    var summaryData = await summaryRes.json();
    var factionData = await factionRes.json();
    shipyardState.blueprints = bpData.ships || [];
    shipyardState.materialSectorHints = bpData.materialSectorHints || {};
    shipyardState.queue      = jobsData.jobs || [];
    shipyardState.ships      = shipsData.ships || [];
    shipyardState.marketListings = marketData.listings || [];
    shipyardState.summary    = summaryData;
    shipyardState.myFaction  = factionData.faction;
    await loadMyInventory();
    var badge = document.getElementById('syQueueBadge');
    if (shipyardState.queue.length > 0) {
      badge.textContent = shipyardState.queue.length;
      badge.style.display = 'inline-block';
    } else {
      badge.style.display = 'none';
    }
    updateFooter();
    if (shipyardState.currentTab === 'blueprints') renderBlueprints();
    else if (shipyardState.currentTab === 'queue') renderQueue();
    else if (shipyardState.currentTab === 'market') renderShipMarket();
    else renderShips();
  } catch (err) {
    console.error('refreshShipyard error:', err);
  }
}

async function loadMyInventory() {
  try {
    var res = await fetch('/api/resources/my', { headers: getAuthHeaders() });
    if (res.ok) {
      var data = await res.json();
      shipyardState.myInventory = {};
      for (var item of (data.inventory || [])) {
        var invCode = String(item.resource_code || item.code || '').toLowerCase();
        if (invCode) shipyardState.myInventory[invCode] = parseInt(item.quantity);
      }
    }
  } catch(e) {}
}

function renderBlueprints() {
  var grid = document.getElementById('bpGrid');
  var size = shipyardState.currentSize;
  var myFactionCode = shipyardState.myFaction && shipyardState.myFaction.code;
  var ships = shipyardState.blueprints;
  if (myFactionCode) ships = ships.filter(function(s){ return s.faction_code === myFactionCode; });
  if (size) ships = ships.filter(function(s){ return s.size_class === size; });
  if (!myFactionCode) {
    grid.innerHTML = '<div class="sy-empty" style="grid-column:1/-1">파벌을 먼저 선택해주세요<br><button style="margin-top:12px;padding:6px 14px;background:rgba(79,195,247,.1);border:1px solid #4fc3f7;color:#4fc3f7;cursor:pointer;border-radius:4px" onclick="closeShipyard();factionState.returnToShipyard=true;setTimeout(openFactionModal,200)">파벌 선택하기</button></div>';
    return;
  }
  if (ships.length === 0) {
    grid.innerHTML = '<div class="sy-empty" style="grid-column:1/-1">조건에 맞는 함선이 없습니다</div>';
    return;
  }
  grid.innerHTML = ships.map(renderBlueprintCard).join('');
}

// 함선 크기별 아이콘 (이미지 에셋 대체용) — buildShip 다이얼로그 등 텍스트 자리
function shipSizeIcon(sizeClass) {
  return ({
    frigate:    '🛸',
    destroyer:  '✈️',
    cruiser:    '🛰️',
    battleship: '🚀',
    titan:      '⭐'
  })[sizeClass] || '🚢';
}
function shipFactionAccent(factionCode) {
  return ({
    mcc: 'linear-gradient(135deg,#1a3b5c,#0a1a2a)',
    fsp: 'linear-gradient(135deg,#1d4a2c,#071b0f)',
    cv:  'linear-gradient(135deg,#5c1a1a,#2a0a0a)'
  })[factionCode] || 'linear-gradient(135deg,#333,#111)';
}
function shipFactionColors(factionCode) {
  return ({
    mcc: { fill:'#4fc3f7', stroke:'#b3e5fc', glow:'#0288d1' },
    fsp: { fill:'#ff5252', stroke:'#ffcdd2', glow:'#c62828' },
    cv:  { fill:'#00e676', stroke:'#b9f6ca', glow:'#00c853' }
  })[factionCode] || { fill:'#9e9e9e', stroke:'#e0e0e0', glow:'#616161' };
}
// 함선 크기/파벌/역할별 SVG 실루엣 — v11.1 tactical-lab의 drawMCCShip/drawFSPShip/drawCVShip을 SVG로 포팅
// 각 파벌이 시각적으로 완전히 구별되도록 기하학 형태를 분기:
//   MCC: 직선/각진 폴리곤 (군사 산업형)
//   FSP: 2차 베지어 곡선/타원 (유기체형)
//   CV:  불규칙 다각형 + 덧붙인 블록 (패치워크/스크랩형)
// 같은 (파벌, size_class) 내 여러 함선은 role/code로 오버레이 액세서리 분기:
//   tackle: 스피드 스트릭 / ewar: 센서 돔 / logi: 메딕 크로스
//   tank:   장갑 밸트  / sniper: 긴 레일  / bomb(er): 폭탄 포드
// 3번째 인자는 하위호환을 위해 scale(number) 또는 { scale, role, code } 모두 허용.
function shipSilhouetteSvg(sizeClass, factionCode, opts) {
  var scale, role, code;
  if (typeof opts === 'number') { scale = opts || 1; role = 'dps'; code = ''; }
  else if (opts && typeof opts === 'object') {
    scale = opts.scale || 1; role = (opts.role || 'dps').toLowerCase(); code = (opts.code || '').toLowerCase();
  } else { scale = 1; role = 'dps'; code = ''; }
  var c = shipFactionColors(factionCode);
  // v11.1 color naming: color(fill)/colorDark(hull panels)/colorBright(accent lines)
  var col = c.fill, colDark = c.glow, colBright = c.stroke;
  var w = 120, h = 56;
  var cx = 55, cy = 28;
  // size_class별 render radius (r). DB render_radius 비율(1:1.7:2.2:3.9:6.0)을 viewBox 제약 내에서 준수.
  // 타이탄은 내부적으로 sc=1.2(MCC/FSP) 또는 1.3(CV) 추가 배율 적용되어 전함 대비 1.47~1.60x 체감.
  //   base r:     8   9.5   11   13   16
  //   effective:  8   9.5   11   13   19.2~20.8 (with sc)
  //   DB ratio OK + 120×56 viewBox에 여유있게 수납 (검증: CV titan top rect at y=-r*1.35=-21.6 → svg y=6.4)
  var rMap = { frigate:8, destroyer:9.5, cruiser:11, battleship:13, titan:16 };
  var r = (rMap[sizeClass] || 10) * scale;

  // SVG helper shorthands (좌표는 함선 중심 기준 → translate로 오프셋)
  function poly(pts, fill) {
    return '<polygon points="' + pts.map(function(p){ return p[0].toFixed(2)+','+p[1].toFixed(2); }).join(' ') + '" fill="'+fill+'"/>';
  }
  function rect(x, y, wv, hv, fill) {
    return '<rect x="'+x.toFixed(2)+'" y="'+y.toFixed(2)+'" width="'+wv.toFixed(2)+'" height="'+hv.toFixed(2)+'" fill="'+fill+'"/>';
  }
  function ellipse(ex, ey, rx, ry, fill) {
    return '<ellipse cx="'+ex.toFixed(2)+'" cy="'+ey.toFixed(2)+'" rx="'+rx.toFixed(2)+'" ry="'+ry.toFixed(2)+'" fill="'+fill+'"/>';
  }
  function circ(ex, ey, rv, fill) {
    return '<circle cx="'+ex.toFixed(2)+'" cy="'+ey.toFixed(2)+'" r="'+rv.toFixed(2)+'" fill="'+fill+'"/>';
  }
  function pathQ(d, fill) {
    return '<path d="'+d+'" fill="'+fill+'"/>';
  }

  // ─── MCC (직선/각진 기하형) ───────────────────────────────
  function buildMCC() {
    var out = [];
    if (sizeClass === 'frigate') {
      out.push(poly([[r*1.8,0],[r*.4,-r*.5],[-r*.3,-r*.6],[-r*.7,-r*.3],[-r*.5,0],[-r*.7,r*.3],[-r*.3,r*.3],[r*.4,r*.4]], col));
      out.push(rect(r*.3, -r*.08, r*1.3, r*.16, colDark));
    } else if (sizeClass === 'destroyer') {
      out.push(poly([[r*1.8,0],[r*.5,-r*.35],[-r*.7,-r*.35],[-r*.9,0],[-r*.7,r*.35],[r*.5,r*.35]], col));
      out.push(rect(r*.2, -r*.8, r*.8, r*.45, colDark));
      out.push(rect(r*.9, -r*.05, r*.9, r*.1, colBright));
    } else if (sizeClass === 'cruiser') {
      out.push(poly([[r*1.8,0],[r*.3,-r*.45],[-r*.6,-r*.45],[-r*.9,0],[-r*.6,r*.45],[r*.3,r*.45]], col));
      out.push(poly([[r*.5,-r*.45],[-r*.3,-r*.45],[-r*.5,-r*1.0],[r*.3,-r*1.0]], colDark));
      out.push(poly([[r*.5,r*.45],[-r*.3,r*.45],[-r*.5,r*1.0],[r*.3,r*1.0]], colDark));
      out.push(rect(r*.4, -r*.12, r*1.3, r*.1, colBright));
      out.push(rect(r*.4, r*.02, r*1.3, r*.1, colBright));
    } else if (sizeClass === 'battleship' || sizeClass === 'titan') {
      var sc = sizeClass === 'titan' ? 1.2 : 1.0;
      out.push(poly([[r*2.0*sc,0],[r*.5*sc,-r*.5],[-r*.6*sc,-r*.5],[-r*.9*sc,0],[-r*.6*sc,r*.5],[r*.5*sc,r*.5]], col));
      out.push(poly([[r*.7*sc,-r*.5],[-r*.5*sc,-r*.5],[-r*.65*sc,-r*1.1],[r*.5*sc,-r*1.1]], colDark));
      out.push(poly([[r*.7*sc,r*.5],[-r*.5*sc,r*.5],[-r*.65*sc,r*1.1],[r*.5*sc,r*1.1]], colDark));
      out.push(poly([[r*.3*sc,-r*1.1],[-r*.2*sc,-r*1.1],[-r*.4*sc,-r*1.5],[r*.25*sc,-r*1.5]], colDark));
      out.push(rect(r*.2*sc, -r*.14, r*1.8*sc, r*.08, colBright));
      out.push(rect(r*.2*sc, -r*.04, r*1.8*sc, r*.08, colBright));
      out.push(rect(r*.2*sc, r*.06, r*1.8*sc, r*.08, colBright));
      if (sizeClass === 'titan') out.push(circ(0, 0, r*.25, 'rgba(255,255,255,.8)'));
    } else {
      out.push(poly([[r*1.5,0],[0,-r*.5],[-r*.6,0],[0,r*.5]], col));
    }
    return out;
  }

  // ─── FSP (곡선/유기체형) ──────────────────────────────────
  function buildFSP() {
    var out = [];
    if (sizeClass === 'frigate') {
      out.push(pathQ('M '+(r*1.6)+',0 Q '+(r*.8)+','+(-r*.55)+' 0,'+(-r*.45)+' Q '+(-r*.7)+','+(-r*.3)+' '+(-r*.7)+',0 Q '+(-r*.7)+','+(r*.3)+' 0,'+(r*.45)+' Q '+(r*.8)+','+(r*.55)+' '+(r*1.6)+',0 Z', col));
      out.push(ellipse(-r*.1, 0, r*.5, r*.2, colDark));
    } else if (sizeClass === 'destroyer') {
      out.push(pathQ('M '+(r*1.6)+',0 Q '+(r*1.0)+','+(-r*.6)+' '+(r*.2)+','+(-r*.55)+' Q '+(-r*.7)+','+(-r*.5)+' '+(-r*.9)+',0 Q '+(-r*.7)+','+(r*.5)+' '+(r*.2)+','+(r*.55)+' Q '+(r*1.0)+','+(r*.6)+' '+(r*1.6)+',0 Z', col));
      out.push(ellipse(-r*.1, 0, r*.6, r*.3, colDark));
    } else if (sizeClass === 'cruiser') {
      out.push(pathQ('M '+(r*1.7)+',0 Q '+(r*1.0)+','+(-r*.7)+' '+(r*.3)+','+(-r*.7)+' Q '+(-r*.6)+','+(-r*.65)+' '+(-r*.9)+',0 Q '+(-r*.6)+','+(r*.65)+' '+(r*.3)+','+(r*.7)+' Q '+(r*1.0)+','+(r*.7)+' '+(r*1.7)+',0 Z', col));
      out.push(ellipse(r*.2, -r*.85, r*.5, r*.25, colDark));
      out.push(ellipse(r*.2, r*.85, r*.5, r*.25, colDark));
      out.push(circ(0, 0, r*.25, colBright));
    } else if (sizeClass === 'battleship' || sizeClass === 'titan') {
      var sc = sizeClass === 'titan' ? 1.2 : 1.0;
      out.push(pathQ('M '+(r*2.0*sc)+',0 Q '+(r*1.2*sc)+','+(-r*.85)+' '+(r*.3*sc)+','+(-r*.85)+' Q '+(-r*.7*sc)+','+(-r*.8)+' '+(-r*1.0*sc)+',0 Q '+(-r*.7*sc)+','+(r*.8)+' '+(r*.3*sc)+','+(r*.85)+' Q '+(r*1.2*sc)+','+(r*.85)+' '+(r*2.0*sc)+',0 Z', col));
      out.push(ellipse(r*.3*sc, -r*1.1, r*.7*sc, r*.3, colDark));
      out.push(ellipse(r*.3*sc, r*1.1, r*.7*sc, r*.3, colDark));
      out.push(ellipse(-r*.5*sc, -r*1.3, r*.5*sc, r*.25, colDark));
      out.push(ellipse(-r*.5*sc, r*1.3, r*.5*sc, r*.25, colDark));
      out.push(circ(0, 0, r*.35, colBright));
      out.push(circ(0, 0, r*.2, 'rgba(255,255,255,.4)'));
    } else {
      out.push(ellipse(0, 0, r*1.2, r*.6, col));
    }
    return out;
  }

  // ─── CV (패치워크/들쭉날쭉) ──────────────────────────────
  function buildCV() {
    var out = [];
    if (sizeClass === 'frigate') {
      out.push(poly([[r*1.5,0],[r*.6,-r*.3],[r*.2,-r*.6],[-r*.3,-r*.4],[-r*.8,-r*.5],[-r*.7,0],[-r*.8,r*.5],[-r*.3,r*.4],[r*.2,r*.6],[r*.6,r*.3]], col));
      out.push(rect(r*.3, -r*.25, r*.3, r*.15, colDark));
      out.push(rect(-r*.3, r*.1, r*.2, r*.2, colDark));
    } else if (sizeClass === 'destroyer') {
      out.push(poly([[r*1.6,0],[r*.5,-r*.4],[r*.1,-r*.7],[-r*.4,-r*.5],[-r*.8,-r*.4],[-r*1.0,0],[-r*.8,r*.4],[-r*.4,r*.5],[r*.1,r*.7],[r*.5,r*.4]], col));
      out.push(rect(r*.2, -r*.85, r*.4, r*.25, colDark));
      out.push(rect(-r*.2, r*.6, r*.3, r*.2, colDark));
      out.push(rect(r*.6, -r*.05, r*1.0, r*.1, colBright));
    } else if (sizeClass === 'cruiser') {
      out.push(poly([[r*1.7,0],[r*.6,-r*.35],[r*.2,-r*.65],[-r*.4,-r*.55],[-r*.7,-r*.7],[-r*1.0,-r*.5],[-r*.8,0],[-r*1.0,r*.5],[-r*.7,r*.7],[-r*.4,r*.55],[r*.2,r*.65],[r*.6,r*.35]], col));
      out.push(rect(-r*.2, -r*.95, r*.5, r*.3, colDark));
      out.push(rect(r*.3, -r*.85, r*.3, r*.25, colDark));
      out.push(rect(-r*.5, r*.7, r*.6, r*.3, colDark));
      out.push(rect(r*.2, r*.75, r*.4, r*.25, colDark));
      out.push(rect(r*.3, -r*.1, r*.1, r*.2, '#ffcc02'));
      out.push(rect(r*.55, -r*.1, r*.1, r*.2, '#ffcc02'));
    } else if (sizeClass === 'battleship' || sizeClass === 'titan') {
      var sc = sizeClass === 'titan' ? 1.3 : 1.0;
      out.push(poly([[r*2.0*sc,0],[r*.7*sc,-r*.45],[r*.3*sc,-r*.85],[-r*.3*sc,-r*.7],[-r*.7*sc,-r*.9],[-r*1.0*sc,-r*.6],[-r*.9*sc,0],[-r*1.0*sc,r*.6],[-r*.7*sc,r*.9],[-r*.3*sc,r*.7],[r*.3*sc,r*.85],[r*.7*sc,r*.45]], col));
      out.push(rect(-r*.2, -r*1.2, r*.6, r*.35, colDark));
      out.push(rect(r*.3, -r*1.05, r*.4, r*.3, colDark));
      out.push(rect(-r*.6, -r*1.35, r*.4, r*.3, colDark));
      out.push(rect(-r*.2, r*.85, r*.6, r*.35, colDark));
      out.push(rect(r*.3, r*.75, r*.4, r*.3, colDark));
      out.push(rect(-r*.6, r*1.05, r*.4, r*.3, colDark));
      for (var i = 0; i < 3; i++) {
        out.push(rect(r*.2 + i*r*.6, -r*.14, r*.5, r*.08, colBright));
        out.push(rect(r*.2 + i*r*.6, r*.06, r*.5, r*.08, colBright));
      }
      out.push(rect(-r*.4, -r*.3, r*.3, r*.2, 'rgba(139,69,19,.55)'));
      out.push(rect(r*.2, r*.1, r*.4, r*.3, 'rgba(139,69,19,.55)'));
      if (sizeClass === 'titan') {
        out.push(rect(r*.3, -r*.2, r*2.5, r*.15, '#ffd700'));
      }
    } else {
      out.push(poly([[r*1.5,0],[0,-r*.5],[-r*.7,0],[0,r*.5]], col));
    }
    return out;
  }

  // ─── 역할/코드 오버레이 (같은 size_class 내 다른 함선 간 식별성 확보) ───
  function buildRoleOverlay() {
    var out = [];
    // Variant detection: explicit role from DB + code-hint fallback (e.g. 'mcc_snp' → sniper, 'cv_bomb' → bomb)
    var variant = role;
    if (code.indexOf('bomb') !== -1) variant = 'bomb';
    else if (code.indexOf('snp') !== -1 || code.indexOf('sniper') !== -1) variant = 'sniper';
    switch (variant) {
      case 'tackle':
        // 프리즘/슬래셔: 전방 스피드 스트릭 (빠른 인터셉터 느낌)
        out.push(rect(r*1.05, -r*.06, r*.6, r*.12, 'rgba(255,255,255,.6)'));
        out.push(rect(r*.75, -r*.03, r*.25, r*.06, 'rgba(255,255,255,.85)'));
        break;
      case 'ewar':
        // 재머: 상단 센서 돔 + 마스트
        out.push(rect(-r*.04, -r*1.15, r*.08, r*.3, colBright)); // mast
        out.push(circ(0, -r*1.2, r*.32, colBright));
        out.push(circ(0, -r*1.2, r*.18, 'rgba(0,0,0,.45)'));
        out.push(rect(-r*.28, -r*1.22, r*.56, r*.04, colBright)); // dish crossbar
        break;
      case 'logi':
        // 버던트/노바: 녹색 메딕 크로스 (수리/지원 함선)
        out.push(rect(-r*.09, -r*.34, r*.18, r*.68, '#7efc9d'));
        out.push(rect(-r*.34, -r*.09, r*.68, r*.18, '#7efc9d'));
        out.push(circ(0, 0, r*.08, '#ffffff'));
        break;
      case 'tank':
        // 벌웍/세쿼이아/가이아: 다중 장갑 밸트 (방어력 과시)
        out.push(rect(-r*.75, -r*.28, r*.09, r*.56, 'rgba(0,0,0,.55)'));
        out.push(rect(-r*.35, -r*.32, r*.09, r*.64, 'rgba(0,0,0,.55)'));
        out.push(rect(r*.1, -r*.28, r*.09, r*.56, 'rgba(0,0,0,.55)'));
        out.push(rect(r*.5, -r*.22, r*.09, r*.44, 'rgba(0,0,0,.55)'));
        break;
      case 'sniper':
        // 롱아이: 초장거리 레일건 (전방으로 쭉 뻗은 포신)
        out.push(rect(r*.5, -r*.06, r*1.6, r*.12, colBright));
        out.push(circ(r*2.1, 0, r*.14, colBright));
        out.push(rect(r*.4, -r*.12, r*.2, r*.24, colDark)); // breech
        break;
      case 'bomb':
        // 리퍼: 상/하 폭탄 포드 (CV 전용 폭격형)
        out.push(rect(-r*.1, -r*.92, r*.32, r*.22, 'rgba(255,190,80,.9)'));
        out.push(rect(-r*.1, r*.7, r*.32, r*.22, 'rgba(255,190,80,.9)'));
        out.push(circ(r*.05, -r*.81, r*.07, '#ff4d2e'));
        out.push(circ(r*.05, r*.81, r*.07, '#ff4d2e'));
        break;
      // 'dps' 및 기타: 오버레이 없음 (기본 실루엣 그대로)
    }
    return out;
  }

  var shapes;
  if (factionCode === 'mcc') shapes = buildMCC();
  else if (factionCode === 'fsp') shapes = buildFSP();
  else if (factionCode === 'cv') shapes = buildCV();
  else shapes = buildMCC(); // fallback

  // 역할 오버레이 적용
  shapes = shapes.concat(buildRoleOverlay());

  // 함선 그룹: cx/cy에 함선 중심 배치
  var shipGroup = '<g transform="translate('+cx+','+cy+')">' + shapes.join('') + '</g>';

  // 엔진 트레일: 함선 후미(rear)에서 시작 — 크기별 + 파벌별 보정
  var rearOffsetR = {
    frigate:    { mcc:0.7, fsp:0.7, cv:0.8 },
    destroyer:  { mcc:0.9, fsp:0.9, cv:1.0 },
    cruiser:    { mcc:0.9, fsp:0.9, cv:1.0 },
    battleship: { mcc:0.9, fsp:1.0, cv:1.0 },
    titan:      { mcc:1.08, fsp:1.2, cv:1.3 } // titan 내부 sc 반영
  }[sizeClass] || { mcc:0.8, fsp:0.8, cv:0.8 };
  var rearR = rearOffsetR[factionCode] || 0.9;
  var rearX = cx - rearR * r;
  var engineLen = { frigate:14, destroyer:18, cruiser:22, battleship:26, titan:32 }[sizeClass] || 14;
  var engineRy = { frigate:2.2, destroyer:2.6, cruiser:3.0, battleship:3.6, titan:4.4 }[sizeClass] || 2.2;

  var gid = 'eg_' + (factionCode || 'x') + '_' + (sizeClass || 'x');
  var deterministicDelay = (((sizeClass || '').length * 7 + (factionCode || '').length * 13) % 9) * 0.2;

  return '<svg class="bp-ship-svg" viewBox="0 0 '+w+' '+h+'" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet" style="color:'+colDark+';--bpd:'+deterministicDelay+'s;">'
    + '<defs>'
    +   '<linearGradient id="'+gid+'" x1="0" x2="1" y1="0" y2="0">'
    +     '<stop offset="0" stop-color="'+colDark+'" stop-opacity="0"/>'
    +     '<stop offset="0.5" stop-color="'+colDark+'" stop-opacity=".55"/>'
    +     '<stop offset="1" stop-color="#fff" stop-opacity=".85"/>'
    +   '</linearGradient>'
    + '</defs>'
    // 배경 트윙클 별들 (함선과 분리됨)
    + '<circle class="bp-star"    cx="15"  cy="10" r="1"   fill="#fff" opacity=".6"/>'
    + '<circle class="bp-star s2" cx="105" cy="46" r="0.8" fill="#fff" opacity=".4"/>'
    + '<circle class="bp-star s3" cx="95"  cy="8"  r="0.6" fill="#fff" opacity=".5"/>'
    + '<circle class="bp-star s2" cx="40"  cy="50" r="0.5" fill="#fff" opacity=".45"/>'
    + '<circle class="bp-star s3" cx="72"  cy="5"  r="0.5" fill="#fff" opacity=".4"/>'
    // 함선 본체 + 엔진 트레일 (함께 drifting)
    + '<g class="bp-ship-body flight">'
    +   '<ellipse class="bp-engine" cx="'+(rearX - engineLen/2).toFixed(2)+'" cy="'+cy+'" rx="'+(engineLen/2)+'" ry="'+engineRy+'" fill="url(#'+gid+')"/>'
    +   shipGroup
    + '</g>'
    + '</svg>';
}

// PNG가 있으면 덮어쓰고, 실패 시 자동으로 SVG fallback. assets/ships/README.txt 파일명 규칙 참조.
function shipVisual(sizeClass, factionCode, opts) {
  opts = opts || {};
  var svg = shipSilhouetteSvg(sizeClass, factionCode, opts);
  var code = (opts.code || '').toLowerCase();
  var slug = code || (factionCode + '_' + sizeClass);
  return svg
    + '<img class="bp-ship-img" src="assets/ships/top/' + slug + '.png?v=' + (typeof ASSET_VER!=='undefined'?ASSET_VER:'1') + '" alt="" '
    +   'onload="var s=this.parentNode&&this.parentNode.querySelector(\'svg.bp-ship-svg\');if(s)s.style.opacity=\'0\'" '
    +   'onerror="this.remove()">';
}

var _SHIP_ROLE_INFO_I18N = {
  en: {
    dps:    { label:'DPS',    desc:'Main firepower · Melts enemy ships fast' },
    tackle: { label:'Tackle', desc:'Fast vanguard · Flagship hunting & early skirmish' },
    ewar:   { label:'EW',     desc:'Electronic warfare · Disrupts enemy targeting' },
    logi:   { label:'Logi',   desc:'Repair support · Boosts fleet survivability' },
    tank:   { label:'Tank',   desc:'Front-line shield · Protects heavy ships' },
    sniper: { label:'Sniper', desc:'Long-range precision · Destroys capital ships' },
    bomb:   { label:'Bomber', desc:'Bomb · Battleship/Titan killer, weak vs screens' }
  },
  ko: {
    dps:    { label:'DPS',    desc:'주력 화력 · 적 함선을 빠르게 줄임' },
    tackle: { label:'태클',   desc:'고속 선봉 · 기함 추격과 초반 교전 담당' },
    ewar:   { label:'전자전', desc:'전자전 · 적 사격 지연과 화력 저하 중첩' },
    logi:   { label:'로지',   desc:'수리 지원 · 장기전에서 아군 생존력 증가' },
    tank:   { label:'탱크',   desc:'방어 핵심 · 전열 유지와 대형함 보호' },
    sniper: { label:'저격',   desc:'장거리 저격 · 대형함과 탱커를 찢음' },
    bomb:   { label:'폭격',   desc:'폭격 · 전함/타이탄 킬러, 소형 스크린에 약함' }
  },
  ja: {
    dps:    { label:'DPS',      desc:'主力火力 · 敵艦を素早く撃破' },
    tackle: { label:'タックル', desc:'高速前衛 · 旗艦追撃と初動交戦担当' },
    ewar:   { label:'電子戦',   desc:'電子戦 · 敵の射撃を妨害・弱体化' },
    logi:   { label:'ロジ',     desc:'修理支援 · 長期戦での艦隊生存力向上' },
    tank:   { label:'タンク',   desc:'防衛要' },
    sniper: { label:'スナイパー', desc:'長距離精密 · 大型艦を破壊' },
    bomb:   { label:'爆撃',     desc:'爆撃 · 戦艦/タイタンキラー' }
  },
  zh: {
    dps:    { label:'DPS',   desc:'主力火力 · 快速消灭敌舰' },
    tackle: { label:'牵制',  desc:'高速先锋 · 追击旗舰和初期交战' },
    ewar:   { label:'电战',  desc:'电子战 · 干扰敌方射击' },
    logi:   { label:'后勤',  desc:'修理支援 · 提升舰队生存力' },
    tank:   { label:'坦克',  desc:'防御核心 · 保护大型舰船' },
    sniper: { label:'狙击',  desc:'远程精确 · 摧毁主力舰' },
    bomb:   { label:'轰炸',  desc:'轰炸 · 战列舰/泰坦克星' }
  }
};
function shipRoleInfo(role) {
  var lang = (typeof LANG !== 'undefined' && _SHIP_ROLE_INFO_I18N[LANG]) ? LANG : 'en';
  var map = _SHIP_ROLE_INFO_I18N[lang];
  return map[(role || 'dps').toLowerCase()] || map.dps;
}

// ── 역할 상성(강함/약함) — server/services/battleEngine.js getShipMatchupMult 기준 ──
var _ROLE_MATCHUP = {
  tackle: { strong:['ewar','logi','small'], weak:['tank','capital'] },
  ewar:   { strong:['dps','sniper','capital'], weak:['tackle','small'] },
  logi:   { strong:['support'], weak:['direct'] },
  tank:   { strong:['tackle','small'], weak:['sniper','bomb'] },
  sniper: { strong:['tank','capital'], weak:['tackle','small'] },
  bomb:   { strong:['capital','tank'], weak:['small','tackle'] },
  dps:    { strong:['ewar','logi'], weak:['tank'] }
};
var _ROLE_TOKEN_I18N = {
  en: { ewar:'EW', logi:'Logi', small:'Small/Screen', capital:'Capitals', tank:'Tank', sniper:'Sniper', bomb:'Bomber', dps:'DPS', tackle:'Tackle', support:'Support only', direct:'Direct combat' },
  ko: { ewar:'전자전', logi:'로지', small:'소형/스크린', capital:'대형함', tank:'탱크', sniper:'저격', bomb:'폭격', dps:'DPS', tackle:'태클', support:'지원 전용', direct:'직접 전투' },
  ja: { ewar:'電子戦', logi:'ロジ', small:'小型/スクリーン', capital:'大型艦', tank:'タンク', sniper:'狙撃', bomb:'爆撃', dps:'DPS', tackle:'タックル', support:'支援専用', direct:'直接戦闘' },
  zh: { ewar:'电子战', logi:'后勤', small:'小型/拦截', capital:'大型舰', tank:'坦克', sniper:'狙击', bomb:'轰炸', dps:'DPS', tackle:'牵制', support:'仅支援', direct:'直接战斗' }
};
function shipRoleMatchupChips(role) {
  var m = _ROLE_MATCHUP[(role || 'dps').toLowerCase()];
  if (!m) return '';
  var lang = _ROLE_TOKEN_I18N[LANG] ? LANG : 'en';
  var t = _ROLE_TOKEN_I18N[lang];
  function names(arr){ return (arr||[]).map(function(x){ return t[x]; }).filter(Boolean).join(', '); }
  var s = names(m.strong), w = names(m.weak), chips = '';
  if (s) chips += '<span style="display:inline-block;font-size:7px;letter-spacing:.3px;padding:1px 5px;border-radius:999px;margin:2px 3px 0 0;background:rgba(102,187,106,.14);border:1px solid rgba(102,187,106,.4);color:#81c784">▲ '+s+'</span>';
  if (w) chips += '<span style="display:inline-block;font-size:7px;letter-spacing:.3px;padding:1px 5px;border-radius:999px;margin:2px 3px 0 0;background:rgba(239,83,80,.12);border:1px solid rgba(239,83,80,.4);color:#e57373">▼ '+w+'</span>';
  return chips ? '<div style="margin-top:4px;line-height:1.6">'+chips+'</div>' : '';
}
// 함대 역할 커버리지 + 빈칸(결핍) 안내 → 조선소 동선
function fleetRoleGapHtml(f) {
  var ships = (f && f.ships) || [];
  if (!ships.length) return '';
  var ROLES = ['tackle','ewar','dps','tank','sniper','logi','bomb'];
  var have = {};
  ships.forEach(function(s){ var r=(s.role||'dps').toLowerCase(); have[r]=(have[r]||0)+1; });
  var chips = ROLES.map(function(r){
    var n = have[r]||0, on = n>0, label = shipRoleInfo(r).label;
    return '<span style="display:inline-block;font-size:8px;padding:2px 7px;border-radius:999px;margin:2px;'+(on?'background:rgba(79,195,247,.16);border:1px solid #4fc3f7;color:#cfeffd':'background:rgba(255,255,255,.03);border:1px dashed rgba(255,255,255,.2);color:rgba(255,255,255,.35)')+'">'+(on?'●':'○')+' '+label+(on?(' ×'+n):'')+'</span>';
  }).join('');
  var warns = [];
  if (!have.sniper && !have.bomb) warns.push(tl('No anti-capital (Sniper/Bomber) → weak vs Battleship/Titan','대형함 카운터(저격/폭격) 부재 → 전함·타이탄에 취약','大型艦カウンター(狙撃/爆撃)不在 → 戦艦・タイタンに弱い','缺少反大型(狙击/轰炸) → 对战列/泰坦薄弱'));
  if (!have.tank) warns.push(tl('No Tank → front line unprotected','탱크 부재 → 전열 보호 없음','タンク不在 → 前列が無防備','缺少坦克 → 前排无保护'));
  if (!have.logi) warns.push(tl('No Logi → low sustain in long battles','로지 부재 → 장기전 생존력 낮음','ロジ不在 → 長期戦の生存力低下','缺少后勤 → 持久战生存力低'));
  if (!have.tackle) warns.push(tl('No Tackle → cannot pin enemy flagship','태클 부재 → 적 기함 추격 불가','タックル不在 → 敵旗艦を追撃できない','缺少牵制 → 无法咬住敌旗舰'));
  var warnHtml = warns.length ? '<div style="margin-top:6px;font-size:8px;line-height:1.6;color:#ffb74d">'+warns.map(function(x){return '⚠ '+x;}).join('<br>')+'</div>' +
    '<button type="button" class="fd-btn" style="margin-top:6px;width:100%;font-size:9px" onclick="event.preventDefault();event.stopPropagation();fleetGapGoShipyard()">⚒ '+tl('Reinforce in Shipyard','조선소에서 보강','造船所で補強','在造船厂补强')+'</button>' : '';
  return '<div style="margin-top:10px;padding:9px 11px;border:1px solid rgba(255,255,255,.08);border-radius:8px">' +
    '<div style="font-size:9px;letter-spacing:1px;color:rgba(255,255,255,.5);margin-bottom:4px">'+tl('ROLE COVERAGE','역할 커버리지','ロールカバレッジ','角色覆盖')+'</div>' +
    '<div>'+chips+'</div>'+warnHtml+'</div>';
}
function fleetGapGoShipyard() {
  try { var m=document.getElementById('fleetCmdModal'); if(m) m.classList.remove('active'); } catch(_){}
  try { openShipyard(); } catch(_){}
}

function fleetTacticBrief(type, code, info) {
  var c = String(code || '').toLowerCase();
  var formation = {
    wedge: tl('Breakthrough damage up, but side exposure is high. Use with escorts.', '돌파 화력은 강하지만 측면이 비기 쉽습니다. 호위함과 같이 써야 합니다.', '突破火力は高いが側面が空きます。護衛と併用。', '突破火力强，但侧翼容易空。需要护卫。'),
    screen: tl('Protects flagship/support ships. Damage is spread and kills are slower.', '기함/지원함 보호에 좋습니다. 대신 화력이 분산되어 처치 속도는 느립니다.', '旗艦/支援艦保護向き。火力は分散します。', '适合保护旗舰/支援舰，但火力会分散。'),
    pincer: tl('Good for surrounding slow fleets. Weak while spreading out.', '느린 함대를 포위하기 좋습니다. 전개 중에는 빈틈이 생깁니다.', '低速艦隊包囲向き。展開中に隙が出ます。', '适合包围慢速舰队，展开时有破绽。'),
    sphere: tl('Balanced flagship protection. Low finishing pressure.', '기함 보호와 균형은 좋지만 결정타 압박이 낮습니다.', '旗艦保護と均衡重視。決定力は低め。', '旗舰保护和均衡较好，但终结能力较低。'),
    line: tl('Strong front volley. Vulnerable to flank and splash pressure.', '전방 일제사격이 강합니다. 측면/광역 압박에 취약합니다.', '正面斉射が強い。側面/範囲攻撃に弱い。', '正面齐射强，怕侧翼/范围压制。'),
    echelon: tl('Creates side angle. Center protection is weaker.', '측면 사격각을 만들지만 중앙 보호가 약합니다.', '側面射角を作るが中央保護が弱い。', '能制造侧翼角度，但中央保护弱。'),
    vanguard: tl('Box guard for valuable ships. Slower to reposition.', '비싼 함선을 감싸기 좋습니다. 재배치 속도는 느립니다.', '高価値艦保護向き。再配置は遅い。', '适合保护高价值舰，重新部署较慢。')
  };
  var movement = {
    advance: tl('Closes distance and forces trades. Higher loss risk.', '거리를 좁혀 교전을 강제합니다. 손실 위험이 커집니다.', '距離を詰めて交戦強制。損失リスク増。', '拉近距离强制交战，损失风险上升。'),
    retreat: tl('Preserves ships and kites. Lower pressure.', '함선을 보존하며 거리를 벌립니다. 압박은 낮아집니다.', '艦船保全と距離確保。圧力は低下。', '保船并拉开距离，压制力下降。'),
    flank: tl('Seeks side angle. Formation can stretch.', '측면각을 노립니다. 진형이 길게 늘어질 수 있습니다.', '側面角を狙う。陣形が伸びやすい。', '寻求侧翼角度，阵型可能拉长。'),
    flank_left: tl('Left flank pressure. Watch isolated small ships.', '좌측 우회 압박입니다. 고립되는 소형함을 봐야 합니다.', '左翼圧力。孤立小型艦に注意。', '左翼压制，注意孤立小船。'),
    flank_right: tl('Right flank pressure. Watch isolated small ships.', '우측 우회 압박입니다. 고립되는 소형함을 봐야 합니다.', '右翼圧力。孤立小型艦に注意。', '右翼压制，注意孤立小船。'),
    scatter: tl('Reduces splash/beam value. Focus fire becomes weaker.', '광역/빔 피해를 줄입니다. 집중화력은 약해집니다.', '範囲/ビーム被害を抑える。集中火力は低下。', '降低范围/光束收益，但集火变弱。'),
    rally: tl('Regroups damaged formation. Gives up tempo while gathering.', '흩어진 진형을 재집결합니다. 모이는 동안 템포를 내줍니다.', '崩れた陣形を再集結。集合中はテンポを失う。', '重新集结阵型，集结期间会丢节奏。')
  };
  var text = (type === 'formation' ? formation[c] : movement[c]);
  return text || (info && (info.desc_ko || info.desc || info.name_ko)) || '-';
}

function fleetDoctrineAdviceHtml(f, counts, roles) {
  var ships = (f && f.ships) || [];
  var total = ships.length;
  var adv = [];
  function push(level, title, text) {
    adv.push({ level: level, title: title, text: text });
  }
  var support = (roles.ewar || 0) + (roles.logi || 0);
  var finishers = (roles.dps || 0) + (roles.sniper || 0) + (roles.bomb || 0);
  var antiCapital = (roles.sniper || 0) + (roles.bomb || 0);
  var capitals = (counts.battleship || 0) + (counts.titan || 0);
  var smalls = counts.frigate || 0;
  var hasFlagship = ships.some(function(s){ return !!s.is_flagship; });
  var formation = String((f && f.formation) || '').toLowerCase();
  var movement = String((f && f.movement) || '').toLowerCase();

  if (!total) {
    push('danger', tl('No ships', '함선 없음', '艦船なし', '无舰船'), tl('Add ships before deployment.', '출격 전에 함선을 편입해야 합니다.', '出撃前に艦船を追加してください。', '部署前需要加入舰船。'));
  }
  if (total && !hasFlagship) {
    push('danger', tl('No flagship', '기함 미지정', '旗艦未指定', '未指定旗舰'), tl('Pick a durable flagship. Losing command early breaks the fleet.', '튼튼한 함선을 기함으로 지정하세요. 지휘축이 먼저 무너지면 전투가 급격히 기웁니다.', '耐久力のある旗艦を指定してください。', '请选择耐久旗舰，指挥核心早倒会快速崩盘。'));
  }
  if (total >= 5 && support === 0) {
    push('warning', tl('No support layer', '지원층 없음', '支援層なし', '无支援层'), tl('No EW/Logi means long fights are inefficient.', '전자전/로지가 없어서 장기전 교환 효율이 낮습니다.', '電子戦/ロジなしでは長期戦効率が落ちます。', '没有电战/后勤，持久战效率低。'));
  }
  if (capitals > 0 && (roles.tackle || 0) < Math.max(1, capitals)) {
    push('warning', tl('Capital escort low', '대형함 호위 부족', '大型艦護衛不足', '大型舰护卫不足'), tl('Add tackle/screen ships so expensive ships are not isolated.', '태클/스크린 함선을 붙여 비싼 함선이 고립되지 않게 해야 합니다.', 'タックル/スクリーン艦を追加してください。', '需要牵制/掩护舰，避免高价值舰孤立。'));
  }
  if (antiCapital === 0 && total >= 4) {
    push('info', tl('Weak vs capitals', '대형함 카운터 약함', '大型艦対策弱い', '反大型较弱'), tl('Sniper or bomber roles are needed against battleships and titans.', '전함/타이탄 상대로는 저격 또는 폭격 역할이 필요합니다.', '戦艦/タイタンには狙撃または爆撃が必要です。', '对战列/泰坦需要狙击或轰炸角色。'));
  }
  if (smalls >= total * 0.65 && finishers <= 1) {
    push('warning', tl('Low finishing power', '결정력 부족', '決定力不足', '终结能力不足'), tl('Small ships can catch targets, but need cruiser+ damage to finish.', '소형함은 붙잡을 수 있지만 마무리할 중형 이상 화력이 필요합니다.', '小型艦は捕捉向きだが中型以上の火力が必要。', '小船能抓目标，但需要巡洋级以上输出收割。'));
  }
  if (movement === 'advance' && !roles.tank && !roles.logi && total >= 4) {
    push('warning', tl('Advance is risky', '전진 리스크 큼', '前進リスク高', '前进风险高'), tl('Advance without tank/logi can trade ships too fast.', '탱커/로지 없이 전진하면 손실 교환이 너무 빨라질 수 있습니다.', 'タンク/ロジなし前進は損失が早まります。', '无坦克/后勤前进会过快换损。'));
  }
  if (formation === 'wedge' && !roles.tackle && total >= 4) {
    push('info', tl('Wedge needs pinning', '쐐기는 고정력이 필요', '楔形には拘束力が必要', '楔形需要牵制'), tl('Wedge breaks lines best when tackle keeps targets from slipping out.', '쐐기는 태클이 목표를 묶어줄 때 돌파력이 가장 좋습니다.', 'タックルで敵を固定すると楔形が活きます。', '牵制锁住目标时楔形突破最好。'));
  }
  if (!adv.length) {
    push('good', tl('Doctrine looks stable', '편성 균형 양호', '編成バランス良好', '编成较均衡'), tl('Role coverage is usable. Adjust formation based on enemy composition.', '역할 커버리지는 사용 가능합니다. 상대 조합에 맞춰 진형만 바꾸면 됩니다.', 'ロールは実用範囲です。敵編成に合わせて陣形調整。', '角色覆盖可用，按敌方阵容调整阵型。'));
  }
  return '<div class="fleet-advice-list">' + adv.slice(0, 4).map(function(a){
    return '<div class="fleet-advice ' + a.level + '"><strong>' + fcEsc(a.title) + '</strong><span>' + fcEsc(a.text) + '</span></div>';
  }).join('') + '</div>';
}

// class_label 다국어 변환 (DB는 영어로 저장)
var _CLASS_LABEL_MAP = {
  ko: {
    'Frigate':'프리깃','Destroyer':'구축함','Cruiser':'순양함',
    'Battleship':'전함','Titan':'타이탄',
    'Interceptor':'인터셉터','EW Frigate':'전자전 프리깃','Sniper Cruiser':'저격 순양함',
    'Missile Cruiser':'미사일 순양함','Assault Destroyer':'강습 구축함',
    'Fast Attack':'고속 공격함','Stealth Bomber':'스텔스 폭격기',
    'Drone Cruiser':'드론 순양함','Light Frigate':'경량 프리깃',
    'Armored Destroyer':'장갑 구축함','Logi Frigate':'로지 프리깃',
    'Logi Cruiser':'로지 순양함','SERVER MAX 3':'서버 최대 3'
  },
  ja: {
    'Frigate':'フリゲート','Destroyer':'駆逐艦','Cruiser':'巡洋艦',
    'Battleship':'戦艦','Titan':'タイタン',
    'Interceptor':'迎撃艦','EW Frigate':'電子戦フリゲート','Sniper Cruiser':'狙撃巡洋艦',
    'Missile Cruiser':'ミサイル巡洋艦','Assault Destroyer':'強襲駆逐艦',
    'Fast Attack':'高速攻撃艦','Stealth Bomber':'ステルス爆撃機',
    'Drone Cruiser':'ドローン巡洋艦','Light Frigate':'軽フリゲート',
    'Armored Destroyer':'装甲駆逐艦','Logi Frigate':'ロジフリゲート',
    'Logi Cruiser':'ロジ巡洋艦','SERVER MAX 3':'サーバー最大3'
  },
  zh: {
    'Frigate':'护卫舰','Destroyer':'驱逐舰','Cruiser':'巡洋舰',
    'Battleship':'战列舰','Titan':'泰坦',
    'Interceptor':'截击舰','EW Frigate':'电子战护卫舰','Sniper Cruiser':'狙击巡洋舰',
    'Missile Cruiser':'导弹巡洋舰','Assault Destroyer':'突击驱逐舰',
    'Fast Attack':'快速攻击舰','Stealth Bomber':'隐形轰炸机',
    'Drone Cruiser':'无人机巡洋舰','Light Frigate':'轻型护卫舰',
    'Armored Destroyer':'装甲驱逐舰','Logi Frigate':'后勤护卫舰',
    'Logi Cruiser':'后勤巡洋舰','SERVER MAX 3':'服务器上限3'
  }
};
function syClassLabel(label) {
  if (!label) return '';
  var map = _CLASS_LABEL_MAP[LANG];
  if (!map) return label;
  // "Interceptor · T1" → localized · T1
  return label.replace(/([A-Za-z][A-Za-z ]+?)(\s*[·\-]\s*|$)/g, function(m, word, sep) {
    var trimmed = word.trim();
    return (map[trimmed] || trimmed) + (sep || '');
  });
}
// legacy alias
function syClassLabelKo(label) { return syClassLabel(label); }

// Ship name helper — uses name_en for non-KO, falls back to name_ko
function syShipName(s) {
  if (!s) return '';
  if (LANG === 'ko') return s.name_ko || s.name_en || s.ship_type_code || '';
  if (LANG === 'ja') return s.name_ja || s.name_en || s.name_ko || s.ship_type_code || '';
  if (LANG === 'zh') return s.name_zh || s.name_en || s.name_ko || s.ship_type_code || '';
  return s.name_en || s.name_ko || s.ship_type_code || '';
}

function syGpBalance() {
  return Math.floor(Number((shipyardState.summary && shipyardState.summary.gp_balance) || walletState.gameGP || 0));
}

function syOwnedResourceQty(code) {
  var key = String(code || '').toLowerCase();
  return parseInt((shipyardState.myInventory && shipyardState.myInventory[key]) || 0, 10) || 0;
}

function syResourceName(code) {
  var nameMap = LANG === 'ko' ? MINERAL_KO : MINERAL_EN;
  return (MINERAL_ICONS[code] || '') + ' ' + (nameMap[code] || MINERAL_EN[code] || code);
}

function syRequirementStatusText(have, need) {
  if (LANG==='ko') return syFmt(have) + ' 보유 / ' + syFmt(need) + ' 필요';
  if (LANG==='ja') return syFmt(have) + ' 所持 / ' + syFmt(need) + ' 必要';
  if (LANG==='zh') return '持有 ' + syFmt(have) + ' / 需要 ' + syFmt(need);
  return syFmt(have) + ' owned / ' + syFmt(need) + ' needed';
}

function syNeedChip(label, have, need, okClass) {
  var enough = Number(have) >= Number(need);
  var state = enough ? (LANG==='ko'?'보유':LANG==='ja'?'所持':LANG==='zh'?'足够':'OK') : (LANG==='ko'?'부족':LANG==='ja'?'不足':LANG==='zh'?'不足':'Low');
  return '<span class="bp-cost-item ' + (enough ? 'ok' : 'short') + (okClass ? ' ' + okClass : '') + '" title="' + syRequirementStatusText(have, need) + '">' +
    '<span class="req-state">' + state + '</span><span>' + fcEsc(label) + '</span><b>' + syFmt(have) + '</b><span class="need">/ ' + syFmt(need) + '</span>' +
  '</span>';
}

// 재료 섹터 힌트 뱃지: 어느 섹터 영토에서 채굴 가능한지 표시
var _SECTOR_BADGE_STYLE = {
  frontier: 'background:rgba(100,220,130,.15);color:#64dc82;border:1px solid rgba(100,220,130,.35)',
  mid:      'background:rgba(255,193,64,.15);color:#ffc140;border:1px solid rgba(255,193,64,.35)',
  core:     'background:rgba(255,107,107,.15);color:#ff6b6b;border:1px solid rgba(255,107,107,.35)',
};
var _SECTOR_BADGE_LABEL = { frontier:'⛏ 개척지', mid:'⛏ 중간지', core:'⛏ 핵심지' };
function sySectorBadge(resourceCode) {
  var hint = shipyardState.materialSectorHints[resourceCode];
  if (!hint) return '';
  var style = _SECTOR_BADGE_STYLE[hint] || '';
  var label = _SECTOR_BADGE_LABEL[hint] || hint;
  return '<span style="display:inline-block;font-size:7px;font-family:var(--fn);font-weight:700;letter-spacing:.4px;padding:1px 4px;border-radius:3px;margin-left:3px;vertical-align:middle;' + style + '">' + label + '</span>';
}

function syBuildRequirementInfo(ship) {
  var recipe = ship.recipe_minerals || {};
  var gpHave = syGpBalance();
  var gpNeed = Number(ship.build_gp_cost || 0);
  var rows = [{ k:'💰 GP', v: syRequirementStatusText(gpHave, gpNeed), insufficient: gpHave < gpNeed, ok: gpHave >= gpNeed }];
  Object.entries(recipe).forEach(function(e) {
    var code = e[0], need = Number(e[1] || 0), have = syOwnedResourceQty(code);
    var hint = shipyardState.materialSectorHints[code];
    var sectorLabel = hint ? (' ' + (_SECTOR_BADGE_LABEL[hint] || hint)) : '';
    rows.push({ k: syResourceName(code) + sectorLabel, v: syRequirementStatusText(have, need), insufficient: have < need, ok: have >= need });
  });
  return rows;
}

function renderBlueprintCard(s) {
  var recipe = s.recipe_minerals || {};
  var mineralCheck = Object.entries(recipe).map(function(e) {
    var code = e[0], need = e[1];
    var have = syOwnedResourceQty(code);
    return syNeedChip(syResourceName(code), have, need) + sySectorBadge(code);
  }).join('');
  var gpHave = syGpBalance();
  var gpShort = s.build_gp_cost > gpHave;
  var buildMinutes = Math.round(s.build_time_seconds / 60);
  var buildTime = buildMinutes >= 60 ? (Math.floor(buildMinutes/60) + '시간 ' + (buildMinutes%60) + '분') : (buildMinutes + '분');
  var limitsText = '';
  if (s.max_per_server) limitsText += '⚠ 서버 한도: ' + s.server_alive_count + ' / ' + s.max_per_server;
  if (s.max_per_player) { if (limitsText) limitsText += ' · '; limitsText += '유저 한도: ' + s.my_count + ' / ' + s.max_per_player; }
  var lockReasons = { 'NO_FACTION':'파벌 미선택', 'WRONG_FACTION':'다른 파벌', 'SERVER_LIMIT':'서버 한도', 'PLAYER_LIMIT':'보유 한도' };
  var lockMsg = '';
  for (var lock of (s.locks || [])) {
    if (lock.startsWith('RANK_REQUIRED_')) { lockMsg = '레벨 ' + lock.replace('RANK_REQUIRED_','') + ' 필요'; break; }
    lockMsg = lockReasons[lock] || lock; break;
  }
  // GP + 광물 부족 여부 (버튼 비활성화용)
  var mineralShort = Object.entries(recipe).some(function(e){
    var code = e[0], need = e[1];
    return syOwnedResourceQty(code) < need;
  });
  var canAfford = !gpShort && !mineralShort;
  var buildDisabled = !s.can_build || !canAfford;
  var buildLabel = !s.can_build ? (lockMsg || '불가') : (!canAfford ? '재료 확인' : '⚒ 건조 시작');

  var silhouette = shipVisual(s.size_class, s.faction_code, { role: s.role, code: s.code });
  var accent = shipFactionAccent(s.faction_code);
  var roleInfo = shipRoleInfo(s.role);
  var roleKey = (s.role || 'dps').toLowerCase();
  return '<div class="bp-card ' + s.faction_code + ' ' + (buildDisabled ? 'locked' : '') + '">' +
    '<div class="bp-visual shipyard-top-preview" style="position:relative;background:' + accent + ';display:flex;align-items:center;justify-content:center;overflow:hidden"><div class="bp-starfield"></div>' + silhouette + '</div>' +
    '<div class="bp-header"><div class="bp-name ' + s.faction_code + '">' + syShipName(s) + '</div><div class="bp-tier t' + s.tier + '">T' + s.tier + '</div></div>' +
    '<div class="bp-class">' + syClassLabel(s.class_label || '') + '</div>' +
    '<div class="bp-role ' + roleKey + '"><span class="bp-role-badge">' + roleInfo.label + '</span><span class="bp-role-text">' + fcEsc((LANG==='ko' ? s.description_ko : LANG==='ja' ? (s.description_ja||s.description_en||null) : LANG==='zh' ? (s.description_zh||s.description_en||null) : s.description_en) || roleInfo.desc) + '</span></div>' +
    shipRoleMatchupChips(s.role) +
    '<div class="bp-stats">' +
      '<div class="bp-stat"><div class="bp-stat-label">HP</div><div class="bp-stat-value">' + syFmt(s.base_hp) + '</div></div>' +
      '<div class="bp-stat"><div class="bp-stat-label">ATK</div><div class="bp-stat-value">' + s.base_atk + '</div></div>' +
      '<div class="bp-stat"><div class="bp-stat-label">DEF</div><div class="bp-stat-value">' + s.base_def + '</div></div>' +
      '<div class="bp-stat"><div class="bp-stat-label">SPD</div><div class="bp-stat-value">' + s.base_speed + '</div></div>' +
    '</div>' +
    '<div class="bp-cost"><div class="bp-cost-line">' + syNeedChip('💰 GP', gpHave, s.build_gp_cost) + '</div>' +
      (mineralCheck ? '<div class="bp-cost-line" style="margin-top:4px">' + mineralCheck + '</div>' : '') +
      '<div class="bp-build-time">⏱ 건조: ' + buildTime + '</div></div>' +
    (limitsText ? '<div class="bp-limits">' + limitsText + '</div>' : '') +
    '<button type="button" class="bp-build-btn ' + (buildDisabled ? 'locked-detail' : '') + '" onclick="buildShip(\'' + s.code + '\')">' +
      buildLabel +
    '</button></div>';
}

async function buildShip(shipTypeCode) {
  var ship = shipyardState.blueprints.find(function(s){ return s.code === shipTypeCode; });
  if (!ship) return;
  var silhouette = shipVisual(ship.size_class, ship.faction_code, { role: ship.role, code: ship.code });
  var accent = shipFactionAccent(ship.faction_code);
  var buildMin = Math.round((ship.build_time_seconds||0)/60);
  var buildTimeTxt = buildMin >= 60 ? (Math.floor(buildMin/60)+'h '+(buildMin%60)+'m') : (buildMin+' min');
  // 재료 체크
  var requirementInfo = syBuildRequirementInfo(ship);
  var lockReasons = { 'NO_FACTION':'파벌 미선택', 'WRONG_FACTION':'다른 파벌', 'SERVER_LIMIT':'서버 한도 초과', 'PLAYER_LIMIT':'보유 한도 초과' };
  var lockInfo = (ship.locks || []).map(function(lock) {
    if (String(lock).indexOf('RANK_REQUIRED_') === 0) return { k:'잠금', v:'레벨 ' + String(lock).replace('RANK_REQUIRED_','') + ' 필요', insufficient:true };
    return { k:'잠금', v: lockReasons[lock] || lock, insufficient:true };
  });
  var blocked = !ship.can_build || requirementInfo.some(function(r){ return r.insufficient; });
  var info = requirementInfo
    .concat(lockInfo)
    .concat([
      { k:'⚙ Role',       v: shipRoleInfo(ship.role).label + ' · ' + shipRoleInfo(ship.role).desc },
      { k:'⏱ Build Time', v: buildTimeTxt },
      { k:'🎯 Class',      v: syClassLabel(ship.class_label||ship.size_class||'—') + ' · T'+ship.tier }
    ]);
  var bodyHtml =
    '<div style="display:flex;align-items:center;gap:10px;padding:10px;border-radius:8px;background:'+accent+';margin-bottom:8px">'
    + '<div class="bp-visual" style="position:relative;width:84px;height:52px;border-radius:6px;display:flex;align-items:center;justify-content:center;flex-shrink:0;background:rgba(0,0,0,.35);overflow:hidden"><div class="bp-starfield"></div>'+silhouette+'</div>'
    + '<div style="flex:1;min-width:0">'
    +   '<div style="font-weight:700;font-size:14px;color:#fff;letter-spacing:.04em">'+syShipName(ship)+'</div>'
    +   '<div style="font-size:10px;color:rgba(255,255,255,.7);text-transform:uppercase;margin-top:2px">'+ship.faction_code+' · '+syClassLabel(ship.class_label||ship.size_class||'')+'</div>'
    + '</div></div>'
    + '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:4px;margin-bottom:6px">'
    +   '<div style="text-align:center;background:rgba(255,255,255,.05);border-radius:4px;padding:4px"><div style="font-size:8px;color:#888">HP</div><div style="font-size:12px;color:#6cf;font-weight:700">'+ship.base_hp+'</div></div>'
    +   '<div style="text-align:center;background:rgba(255,255,255,.05);border-radius:4px;padding:4px"><div style="font-size:8px;color:#888">ATK</div><div style="font-size:12px;color:#f66;font-weight:700">'+ship.base_atk+'</div></div>'
    +   '<div style="text-align:center;background:rgba(255,255,255,.05);border-radius:4px;padding:4px"><div style="font-size:8px;color:#888">DEF</div><div style="font-size:12px;color:#fc6;font-weight:700">'+ship.base_def+'</div></div>'
    +   '<div style="text-align:center;background:rgba(255,255,255,.05);border-radius:4px;padding:4px"><div style="font-size:8px;color:#888">SPD</div><div style="font-size:12px;color:#6f6;font-weight:700">'+ship.base_speed+'</div></div>'
    + '</div>';
  // [v7.72] Fetch fleets so multi-fleet players can choose destination fleet
  var buildFleets = [];
  try {
    var fleetRes = await fetch('/api/fleets', { headers: getAuthHeaders() });
    if (fleetRes.ok) {
      var fleetData = await fleetRes.json();
      buildFleets = (fleetData.fleets || []).filter(function(f){ return !f.is_in_battle; });
    }
  } catch(_) {}
  var ok = await gameConfirm({
    title: '⚒ ' + (t && t('gov_ship_build') || 'BUILD SHIP'),
    icon: shipSizeIcon(ship.size_class),
    body: bodyHtml,
    info: info,
    confirmText: blocked ? '조건 부족' : ('⚒ ' + (t && t('gov_ship_build') || 'START BUILD')),
    disabled: blocked
  });
  if (!ok) return;
  // [v7.72] If player has 2+ fleets, let them pick which fleet receives the ship
  var chosenFleetId = null;
  if (buildFleets.length >= 2) {
    var pickedFleetStr = await gamePicker({
      title: LANG==='ko'?'배치할 함대 선택':LANG==='ja'?'配属先艦隊を選択':LANG==='zh'?'选择目标舰队':'Select Fleet',
      items: buildFleets.map(function(f){
        return { value: String(f.id), label: f.name + ' (' + (f.ships_alive||0) + (LANG==='ko'?'척':LANG==='ja'?'隻':LANG==='zh'?'艘':' ships') + ')', icon: '🚢' };
      })
    });
    if (pickedFleetStr === null) return; // cancelled
    chosenFleetId = parseInt(pickedFleetStr, 10) || null;
  } else if (buildFleets.length === 1) {
    chosenFleetId = buildFleets[0].id;
  }
  try {
    var res = await fetch('/api/ships/build', {
      method: 'POST',
      headers: Object.assign({'Content-Type':'application/json'}, getAuthHeaders()),
      body: JSON.stringify({ ship_type_code: shipTypeCode, fleet_id: chosenFleetId || undefined })
    });
    var data = await res.json();
    if (!res.ok) {
      var msgMap = {
        'NO_FACTION': LANG==='ko'?'파벌을 먼저 선택하세요':LANG==='ja'?'先に派閥を選択してください':LANG==='zh'?'请先选择派系':'Select a faction first',
        'WRONG_FACTION': LANG==='ko'?'다른 파벌의 함선입니다':LANG==='ja'?'他の派閥の艦船です':LANG==='zh'?'这是其他派系的舰船':'Ship belongs to another faction',
        'RANK_REQUIRED': (LANG==='ko'?'레벨 ':LANG==='ja'?'レベル ':LANG==='zh'?'等级 ':'Level ') + ((data.meta && data.meta.required) || '?') + (LANG==='ko'?' 필요':LANG==='ja'?' が必要':LANG==='zh'?' 需要':' required'),
        'SERVER_LIMIT_REACHED': LANG==='ko'?'서버 한도에 도달했습니다':LANG==='ja'?'サーバー上限に達しました':LANG==='zh'?'已达到服务器上限':'Server limit reached',
        'PLAYER_LIMIT_REACHED': LANG==='ko'?'보유 한도에 도달했습니다':LANG==='ja'?'保有上限に達しました':LANG==='zh'?'已达到持有上限':'Player limit reached',
        'PLAYER_FLEET_FULL': LANG==='ko'?'함대가 가득 찼습니다 (최대 200척)':LANG==='ja'?'艦隊が満杯です（最大200隻）':LANG==='zh'?'舰队已满（最多200艘）':'Fleet is full (max 200 ships)',
        'INSUFFICIENT_GP': (LANG==='ko'?'GP 부족: ':LANG==='ja'?'GP不足: ':LANG==='zh'?'GP不足: ':'Insufficient GP: ') + ((data.meta && data.meta.required) || '?') + (LANG==='ko'?' 필요':LANG==='ja'?' 必要':LANG==='zh'?' 需要':' needed'),
        'INSUFFICIENT_MINERALS': (LANG==='ko'?'광물 부족: ':LANG==='ja'?'鉱物不足: ':LANG==='zh'?'矿物不足: ':'Insufficient materials: ') + ((data.meta && data.meta.missing) || []).map(function(m){ return m.code + ' ' + m.have + '/' + m.need; }).join(', '),
      };
      showFactionToast(msgMap[data.error] || ((LANG==='ko'?'오류: ':LANG==='ja'?'エラー: ':LANG==='zh'?'错误: ':'Error: ') + data.error), 'error');
      return;
    }
    showFactionToast(ship.name_ko + ' ' + (LANG==='ko'?'건조 시작!':LANG==='ja'?'建造開始!':LANG==='zh'?'建造开始!':'build started!'), 'success');
    // Stay on blueprints so players can queue multiple builds in a row.
    await refreshShipyard();
  } catch(err) {
    console.error('buildShip error:', err);
    showFactionToast(t('quests_network_error')||tl('Network error','네트워크 오류','ネットワークエラー','网络错误'),'error');
  }
}

function renderQueue() {
  var list = document.getElementById('queueList');
  if (shipyardState.queue.length === 0) {
    list.innerHTML = '<div class="sy-empty">건조 중인 함선이 없습니다</div>';
    return;
  }
  list.innerHTML = shipyardState.queue.map(function(j) {
    var isReady = j.seconds_remaining <= 0;
    var timeText = isReady ? '✓ 완료됨' : syFmtTime(j.seconds_remaining);
    return '<div class="queue-item" data-job-id="' + j.id + '">' +
      '<div class="queue-item-header">' +
        '<div class="queue-name" style="color:' + (j.faction_color || '#fff') + '">' + syShipName(j) + '</div>' +
        '<div class="queue-time ' + (isReady ? 'ready' : '') + '">' + timeText + '</div>' +
      '</div>' +
      '<div class="queue-bar-bg"><div class="queue-bar-fill ' + (isReady ? 'ready' : '') + '" style="width:' + Math.min(100, j.progress_pct) + '%"></div></div>' +
      '<div style="font-size:8px;color:rgba(255,255,255,.35);margin-top:2px">' + syClassLabel(j.class_label || '') + ' · ' + syFmt(j.gp_cost) + ' GP</div>' +
      '<div class="queue-actions">' +
        (isReady ? '<button class="queue-btn primary" onclick="claimJob(' + j.id + ')">🎁 수령하기</button>'
                 : '<button class="queue-btn danger" onclick="cancelJob(' + j.id + ')">✕ 취소 (50% 환불)</button>') +
      '</div></div>';
  }).join('');
}

function updateQueueProgress() {
  for (var j of shipyardState.queue) {
    j.seconds_remaining = Math.max(0, j.seconds_remaining - 1);
    j.seconds_elapsed += 1;
    j.progress_pct = Math.min(100, (j.seconds_elapsed / j.total_seconds) * 100);
  }
  if (shipyardState.currentTab === 'queue') renderQueue();
}

async function claimJob(jobId) {
  try {
    var res = await fetch('/api/ships/build-jobs/' + jobId + '/complete', { method: 'POST', headers: getAuthHeaders() });
    var data = await res.json();
    if (!res.ok) { showFactionToast(tl('Claim failed: ','수령 실패: ','受取失敗: ','领取失败：') + (data.error || 'UNKNOWN'), 'error'); return; }
    showFactionToast(data.is_flagship ? tl('🚀 Ship claimed! (flagship assigned)','🚀 함선 수령! (기함 지정됨)','🚀 艦船受取!（旗艦指定）','🚀 已领取舰船！（已设为旗舰）') : tl('🚀 Ship claim complete','🚀 함선 수령 완료','🚀 艦船受取完了','🚀 舰船领取完成'), 'success');
    await refreshShipyard();
  } catch(err) { showFactionToast(t('quests_network_error')||tl('Network error','네트워크 오류','ネットワークエラー','网络错误'),'error'); }
}

async function cancelJob(jobId) {
  var ok=await gameConfirm({icon:'🔧',title:'건조 취소',body:'건조를 취소합니다. <b>50% GP만 환불</b>됩니다.',confirmText:'취소 확인'});
  if(!ok) return;
  try {
    var res = await fetch('/api/ships/build-jobs/' + jobId + '/cancel', { method: 'POST', headers: getAuthHeaders() });
    var data = await res.json();
    if (!res.ok) { showFactionToast(tl('Cancel failed: ','취소 실패: ','キャンセル失敗: ','取消失败：') + (data.error || 'UNKNOWN'), 'error'); return; }
    showFactionToast(tl('Refund complete: +','환불 완료: +','返金完了: +','退款完成：+') + data.refunded_gp + ' GP', 'success');
    await refreshShipyard();
  } catch(err) { showFactionToast(t('quests_network_error')||tl('Network error','네트워크 오류','ネットワークエラー','网络错误'),'error'); }
}

function renderShips() {
  var list = document.getElementById('shipList');
  if (shipyardState.ships.length === 0) {
    list.innerHTML = '<div class="sy-empty" style="grid-column:1/-1">보유 함선이 없습니다<br><span style="font-size:9px;opacity:.6">블루프린트에서 건조를 시작하세요</span></div>';
    return;
  }
  var _myFac = (shipyardState.myFaction && (shipyardState.myFaction.code||'').toLowerCase()) || '';
  var repairSummary = renderShipRepairSummary(shipyardState.ships);
  list.innerHTML = repairSummary + shipyardState.ships.map(function(s) {
    // [v7.322] 합체 유닛(pilgrim/assembled)은 전 유저 공용 — 진영 잠금 없이 UNIVERSAL 배지.
    var _universal = ((s.faction_code||'').toLowerCase() === 'pilgrim') || ((s.size_class||'').toLowerCase() === 'assembled');
    var crossFaction = !_universal && _myFac && s.faction_code && (s.faction_code.toLowerCase() !== _myFac);
    var crossBadge = crossFaction
      ? '<span style="position:absolute;top:6px;left:6px;font-size:8px;font-weight:900;color:#aac4dc;background:rgba(20,28,40,.92);border:1px solid rgba(136,170,204,.6);padding:2px 6px;border-radius:5px;letter-spacing:.5px" title="'+tl('Other faction — cannot deploy, list on market','다른 진영 — 사용 불가, 마켓 판매 가능','他陣営 — 配置不可、市場で販売可','其他阵营 — 无法部署，可上架销售')+'">🔒 '+(s.faction_code||'').toUpperCase()+'</span>'
      : (_universal ? '<span style="position:absolute;top:6px;left:6px;font-size:8px;font-weight:900;color:#b388ff;background:rgba(20,18,28,.92);border:1px solid rgba(179,136,255,.6);padding:2px 6px;border-radius:5px;letter-spacing:.5px" title="'+tl('Assembly super-unit — usable by any faction','합체 슈퍼유닛 — 모든 진영 사용 가능','合体スーパーユニット — 全陣営使用可','合体超级单位 — 全阵营可用')+'">🜲 '+tl('UNIVERSAL','공용','共用','通用')+'</span>' : '');
    // [v7.167] 각인 품질 배지 — common(없음) 외엔 별점으로 강화 함선 식별. 마켓 가치 직관 노출.
    var qm = (typeof _crateQualityMeta !== 'undefined' && s.quality) ? _crateQualityMeta[s.quality] : null;
    var qBadge = (qm && qm.stars > 0)
      ? '<span style="position:absolute;top:6px;right:6px;font-size:8px;font-weight:900;color:'+qm.col+';background:rgba(20,18,28,.92);border:1px solid '+qm.col+'80;padding:2px 6px;border-radius:5px;letter-spacing:.3px" title="'+(LANG==='ko'?qm.ko:qm.en)+' — '+tl('Enhanced ship (gacha)','강화 함선 (가챠 각인)','強化艦(ガチャ)','强化舰（抽卡）')+'">'+'★'.repeat(qm.stars)+'</span>'
      : '';
    var effectiveMaxHp = parseFloat(s.effective_max_hp || (parseFloat(s.max_hp || 0) + parseFloat(s.bonus_hp || 0)) || s.max_hp || 1);
    var hpPct = Math.max(0, Math.min(100, (s.current_hp / effectiveMaxHp) * 100));
    var hpClass = hpPct < 30 ? 'crit' : hpPct < 60 ? 'low' : '';
    var isDamaged = s.current_hp < effectiveMaxHp;
    var shieldHp  = parseInt(s.shield_hp) || 0;
    var shieldMax = parseInt(s.shield_max) || 0;
    var shieldPct = shieldMax > 0 ? Math.min(100, (shieldHp / shieldMax) * 100) : 0;
    var shieldBar = shieldMax > 0
      ? '<div style="margin-top:3px"><div style="font-size:8px;color:#64b5f6;display:flex;justify-content:space-between"><span>🛡 SHIELD</span><span>' + syFmt(shieldHp) + ' / ' + syFmt(shieldMax) + '</span></div>'
        + '<div style="height:3px;background:rgba(100,181,246,.15);border-radius:2px;overflow:hidden"><div style="height:100%;width:' + shieldPct + '%;background:linear-gradient(90deg,#1565c0,#64b5f6);transition:width .3s"></div></div></div>'
      : '';
    var listed = !!s.is_market_listed;
    var listedSticker = listed ? '<span class="ship-sale-sticker">'+(LANG==="ko"?"판매중":LANG==="ja"?"販売中":LANG==="zh"?"在售":"For Sale")+'</span>' : '';
    var repairBtn = isDamaged && !listed
      ? '<button data-action="syRepairShip" data-ship-id="' + escapeHTML(s.id) + '" data-ship-name="' + escapeHTML(s.name_ko) + '" data-current-hp="' + escapeHTML(s.current_hp) + '" data-effective-max-hp="' + escapeHTML(effectiveMaxHp) + '" style="flex:1;padding:5px 4px;font-size:9px;font-weight:700;border-radius:5px;background:rgba(76,175,80,.18);border:1px solid rgba(76,175,80,.4);color:#81c784;cursor:pointer;font-family:var(--fn)">🔧 수리</button>'
      : '<button disabled style="flex:1;padding:5px 4px;font-size:9px;border-radius:5px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);color:rgba(255,255,255,.25);font-family:var(--fn)">' + (listed ? '판매중' : '✅ 최대HP') + '</button>';
    // [v7.346] 좌상단 배지(공용/타진영/별점)가 절대배치(top:6px,left:6px)라 .ship-name과 겹쳐 함선 이름이 가려짐 → 배지 있으면 상단 패딩으로 이름을 아래로 민다.
    var _hasTopBadge = !!(crossBadge || qBadge || listedSticker);
    return '<div class="ship-item ' + (s.is_flagship ? 'flagship ' : '') + (listed ? 'listed' : '') + (crossFaction ? ' cross-faction' : '') + '" style="position:relative' + (_hasTopBadge ? ';padding-top:28px' : '') + '">' +
      listedSticker +
      crossBadge +
      qBadge +
      '<div class="ship-name" style="color:' + (s.faction_color || '#fff') + '">' + (s.is_flagship ? '⚔ ' : '') + syShipName(s) + '</div>' +
      '<div class="ship-class">' + syClassLabel(s.class_label || '') + '</div>' +
      '<div class="ship-hp-bar"><div class="ship-hp-fill ' + hpClass + '" style="width:' + hpPct + '%"></div></div>' +
      '<div class="ship-hp-text">HP ' + syFmt(s.current_hp) + ' / ' + syStatValue(s.max_hp, s.bonus_hp) + '</div>' +
      shieldBar +
      '<div class="bp-stats" style="margin:7px 0 0">' +
        '<div class="bp-stat"><div class="bp-stat-label">ATK</div><div class="bp-stat-value">' + syStatValue(s.base_atk, s.bonus_atk) + '</div></div>' +
        '<div class="bp-stat"><div class="bp-stat-label">DEF</div><div class="bp-stat-value">' + syStatValue(s.base_def, s.bonus_def) + '</div></div>' +
        '<div class="bp-stat"><div class="bp-stat-label">SPD</div><div class="bp-stat-value">' + syStatValue(s.base_speed, s.bonus_speed, 2) + '</div></div>' +
        '<div class="bp-stat"><div class="bp-stat-label">MOD</div><div class="bp-stat-value">' + syFmt(s.upgrade_level || 0) + '</div></div>' +
      '</div>' +
      '<div class="ship-upgrade-grid">' +
        syUpgradeBtn(s, 'atk', 'ATK') +
        syUpgradeBtn(s, 'def', 'DEF') +
        syUpgradeBtn(s, 'speed', 'SPD') +
        syUpgradeBtn(s, 'hp', 'HP') +
      '</div>' +
      '<div style="display:flex;gap:4px;margin-top:6px">' +
        repairBtn +
        '<button ' + (listed ? 'disabled' : '') + ' data-action="syChargeShield" data-ship-id="' + escapeHTML(s.id) + '" data-ship-name="' + escapeHTML(s.name_ko) + '" data-effective-max-hp="' + escapeHTML(effectiveMaxHp) + '" data-shield-hp="' + escapeHTML(shieldHp) + '" data-shield-max="' + escapeHTML(shieldMax) + '" style="flex:1;padding:5px 4px;font-size:9px;font-weight:700;border-radius:5px;background:rgba(100,181,246,.15);border:1px solid rgba(100,181,246,.35);color:#64b5f6;cursor:pointer;font-family:var(--fn)">🛡 실드</button>' +
        '<button ' + (listed ? 'disabled' : '') + ' data-action="syScrapShip" data-ship-id="' + escapeHTML(s.id) + '" data-ship-name="' + escapeHTML(s.name_ko) + '" title="해체 (환불+소각)" style="padding:5px 6px;font-size:9px;font-weight:700;border-radius:5px;background:rgba(255,107,107,.15);border:1px solid rgba(255,107,107,.35);color:#ff8a80;cursor:pointer;font-family:var(--fn)">🔥</button>' +
      '</div>' +
      '<div class="ship-sale-actions">' +
        (listed
          ? '<button class="ship-sale-btn cancel" onclick="syCancelShipListing(' + s.market_listing_id + ')">판매 취소</button><button class="ship-sale-btn" disabled>' + syFmt(s.market_price_gp) + ' GP</button>'
          : '<button class="ship-sale-btn" onclick="syListShipForSale(' + s.id + ')">판매 등록</button>') +
      '</div>' +
    '</div>';
  }).join('');
}

function renderShipRepairSummary(ships) {
  var damaged = 0;
  var listedDamaged = 0;
  var missingHp = 0;
  var lowestPct = 100;
  (ships || []).forEach(function(s) {
    var effectiveMaxHp = parseFloat(s.effective_max_hp || (parseFloat(s.max_hp || 0) + parseFloat(s.bonus_hp || 0)) || s.max_hp || 1);
    var currentHp = parseFloat(s.current_hp || 0);
    var miss = Math.max(0, effectiveMaxHp - currentHp);
    if (miss <= 0) return;
    if (s.is_market_listed) listedDamaged++;
    else damaged++;
    missingHp += miss;
    lowestPct = Math.min(lowestPct, Math.max(0, Math.min(100, currentHp / effectiveMaxHp * 100)));
  });
  var color = damaged > 0 ? (lowestPct < 30 ? '#ff8a80' : lowestPct < 60 ? '#ffb74d' : '#81c784') : '#80cbc4';
  var title = LANG==='ko'?'FLEET MAINTENANCE':LANG==='ja'?'FLEET MAINTENANCE':LANG==='zh'?'FLEET MAINTENANCE':'FLEET MAINTENANCE';
  var status = damaged > 0
    ? (LANG==='ko'?'정비 필요':LANG==='ja'?'整備必要':LANG==='zh'?'需要维护':'Repair Needed')
    : (LANG==='ko'?'출격 가능':LANG==='ja'?'出撃可能':LANG==='zh'?'可出击':'Ready');
  var hint = damaged > 0
    ? (LANG==='ko'?'전투와 채굴로 깎인 내구도는 조선소 수리에서 GP와 iron_ore를 소모합니다.':LANG==='ja'?'戦闘と採掘で削れた耐久は造船所修理でGPとiron_oreを消費します。':LANG==='zh'?'战斗和采矿造成的耐久损耗会在船坞维修中消耗GP和iron_ore。':'Battle and resource runs damage hulls. Repairs spend GP and iron_ore.')
    : (LANG==='ko'?'손상된 비판매 함선이 없습니다.':LANG==='ja'?'損傷した非売却艦はありません。':LANG==='zh'?'没有受损的非在售舰船。':'No damaged unlisted ships.');
  return '<div style="grid-column:1/-1;border:1px solid '+color+'55;background:linear-gradient(135deg,'+color+'18,rgba(255,255,255,.025));border-radius:7px;padding:8px 10px;margin-bottom:2px">'
    + '<div style="display:flex;justify-content:space-between;gap:8px;align-items:center;flex-wrap:wrap">'
    + '<div style="font-size:9px;color:'+color+';font-family:var(--fn);font-weight:900;letter-spacing:1px">🔧 '+title+'</div>'
    + '<div style="font-size:9px;color:'+color+';font-family:var(--fn);font-weight:800">'+status+'</div>'
    + '</div>'
    + '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(86px,1fr));gap:5px;margin-top:7px">'
    + '<div style="padding:5px;border:1px solid rgba(255,255,255,.08);border-radius:5px;background:rgba(0,0,0,.18)"><div style="font-size:7px;color:var(--tx3)">DAMAGED</div><div style="font-size:11px;color:var(--tx);font-weight:800">'+damaged+'</div></div>'
    + '<div style="padding:5px;border:1px solid rgba(255,255,255,.08);border-radius:5px;background:rgba(0,0,0,.18)"><div style="font-size:7px;color:var(--tx3)">MISSING HP</div><div style="font-size:11px;color:var(--gold);font-weight:800">'+syFmt(missingHp)+'</div></div>'
    + '<div style="padding:5px;border:1px solid rgba(255,255,255,.08);border-radius:5px;background:rgba(0,0,0,.18)"><div style="font-size:7px;color:var(--tx3)">LOWEST HULL</div><div style="font-size:11px;color:'+color+';font-weight:800">'+Math.round(lowestPct)+'%</div></div>'
    + (listedDamaged > 0 ? '<div style="padding:5px;border:1px solid rgba(255,209,102,.16);border-radius:5px;background:rgba(255,209,102,.06)"><div style="font-size:7px;color:var(--tx3)">LISTED DAMAGED</div><div style="font-size:11px;color:var(--gold);font-weight:800">'+listedDamaged+'</div></div>' : '')
    + '</div>'
    + '<div style="font-size:8px;color:var(--tx3);line-height:1.4;margin-top:6px">'+hint+'</div>'
    + '</div>';
}

function syStatValue(base, bonus, decimals) {
  var b = parseFloat(base) || 0;
  var add = parseFloat(bonus) || 0;
  var baseText = decimals ? b.toFixed(decimals) : syFmt(b);
  if (add <= 0) return baseText;
  var bonusText = decimals ? add.toFixed(decimals) : syFmt(add);
  return baseText + '<span class="stat-bonus">(+' + bonusText + ')</span>';
}

function syUpgradeTierBadge(tier) {
  var t = parseInt(tier) || 1;
  var colors = { 1:'#8bc34a', 2:'#42a5f5', 3:'#ce93d8' };
  var labels = { 1:'T1', 2:'T2', 3:'T3' };
  return '<span style="font-size:8px;padding:1px 4px;border-radius:3px;background:' + (colors[t]||'#8bc34a') + '22;border:1px solid ' + (colors[t]||'#8bc34a') + '55;color:' + (colors[t]||'#8bc34a') + ';margin-right:2px">' + (labels[t]||'T1') + '</span>';
}
function syUpgradeBtn(ship, stat, label) {
  var offer = ship.upgrade_offers && ship.upgrade_offers[stat];
  var cost = offer ? syFmt(offer.cost) + ' GP' : (ship.upgrade_costs && ship.upgrade_costs[stat] ? syFmt(ship.upgrade_costs[stat]) + ' GP' : 'GP');
  var gpShort = offer && syGpBalance() < Number(offer.cost || 0);
  var matHave = offer ? syOwnedResourceQty(offer.material_code) : 0;
  var matNeed = offer ? Number(offer.material_qty || 0) : 0;
  var matShort = offer && matHave < matNeed;
  var tierBadge = offer ? syUpgradeTierBadge(offer.material_tier || 1) : '';
  var _matOkLbl = LANG==='ko'?'보유':LANG==='ja'?'所持':LANG==='zh'?'足够':'OK';
  var _matShortLbl = LANG==='ko'?'부족':LANG==='ja'?'不足':LANG==='zh'?'不足':'Low';
  var _successLbl = LANG==='ko'?'% 성공':LANG==='ja'?'% 成功':LANG==='zh'?'% 成功':'% success';
  var _upgradeTip = LANG==='ko'?label+' 영구 강화':LANG==='ja'?label+' 永続強化':LANG==='zh'?label+' 永久强化':label+' permanent upgrade';
  var material = offer ? (tierBadge + (matShort ? _matShortLbl+' ' : _matOkLbl+' ') + syResourceName(offer.material_code) + ' ' + syFmt(matHave) + '/' + syFmt(matNeed)) : '';
  return '<button class="ship-upgrade-btn ' + (gpShort || matShort ? 'need' : '') + '" ' + (ship.is_market_listed ? 'disabled' : '') + ' onclick="syUpgradeShipStat(' + ship.id + ',\'' + stat + '\')" title="' + _upgradeTip + '">' +
    label + ' +' +
    '<span class="cost ' + (gpShort ? 'short' : '') + '">' + cost + '</span>' +
    (offer ? '<span class="chance">' + offer.chance + _successLbl + '</span><span class="mat ' + (matShort ? 'short' : 'ok') + '">' + material + '</span>' : '') +
  '</button>';
}

document.addEventListener('click', function(ev) {
  var el = ev.target && ev.target.closest ? ev.target.closest('[data-action]') : null;
  if (!el) return;
  var action = el.getAttribute('data-action');
  if (action === 'syRepairShip') {
    ev.stopPropagation();
    var repairParams = {
      shipId: parseInt(el.getAttribute('data-ship-id'), 10),
      name: el.getAttribute('data-ship-name') || '',
      currentHp: parseFloat(el.getAttribute('data-current-hp')),
      effectiveMaxHp: parseFloat(el.getAttribute('data-effective-max-hp'))
    };
    console.log('[BTN] syRepairShip triggered', repairParams);
    syRepairShip(repairParams.shipId, repairParams.name, repairParams.currentHp, repairParams.effectiveMaxHp);
    return;
  }
  if (action === 'syChargeShield') {
    ev.stopPropagation();
    var shieldParams = {
      shipId: parseInt(el.getAttribute('data-ship-id'), 10),
      name: el.getAttribute('data-ship-name') || '',
      effectiveMaxHp: parseFloat(el.getAttribute('data-effective-max-hp')),
      shieldHp: parseInt(el.getAttribute('data-shield-hp'), 10),
      shieldMax: parseInt(el.getAttribute('data-shield-max'), 10)
    };
    console.log('[BTN] syChargeShield triggered', shieldParams);
    syChargeShield(shieldParams.shipId, shieldParams.name, shieldParams.effectiveMaxHp, shieldParams.shieldHp, shieldParams.shieldMax);
    return;
  }
  if (action === 'syScrapShip') {
    ev.stopPropagation();
    var scrapParams = {
      shipId: parseInt(el.getAttribute('data-ship-id'), 10),
      name: el.getAttribute('data-ship-name') || ''
    };
    console.log('[BTN] syScrapShip triggered', scrapParams);
    syScrapShip(scrapParams.shipId, scrapParams.name);
    return;
  }
  if (action === 'selectTargetFleet') {
    ev.stopPropagation();
    var targetParams = {
      fleetId: parseInt(el.getAttribute('data-fleet-id'), 10),
      nickname: el.getAttribute('data-nickname') || '',
      shipsAlive: parseInt(el.getAttribute('data-ships-alive'), 10)
    };
    console.log('[BTN] selectTargetFleet triggered', targetParams);
    selectTargetFleet(targetParams.fleetId, targetParams.nickname, targetParams.shipsAlive);
    return;
  }
  if (action === 'joinAllianceAction') {
    ev.stopPropagation();
    var allianceActionParams = {
      allianceId: parseInt(el.getAttribute('data-alliance-id'), 10),
      name: el.getAttribute('data-alliance-name') || ''
    };
    console.log('[BTN] joinAllianceAction triggered', allianceActionParams);
    joinAllianceAction(allianceActionParams.allianceId, allianceActionParams.name);
    return;
  }
  if (action === 'joinAllianceConfirm') {
    ev.stopPropagation();
    var allianceConfirmParams = {
      allianceId: parseInt(el.getAttribute('data-alliance-id'), 10),
      name: el.getAttribute('data-alliance-name') || ''
    };
    console.log('[BTN] joinAllianceConfirm triggered', allianceConfirmParams);
    joinAllianceConfirm(allianceConfirmParams.allianceId, allianceConfirmParams.name);
  }
});

// ── Forge Animation Modal ──────────────────────────────────────
var _forgeAnimFrame = null;
function closeForgeModal() {
  var m = document.getElementById('forgeModal');
  if (m) m.style.display = 'none';
  if (_forgeAnimFrame) { cancelAnimationFrame(_forgeAnimFrame); _forgeAnimFrame = null; }
}
function _forgeSparkBurst(canvas, color) {
  if (!canvas) return;
  canvas.style.opacity = '1';
  var ctx = canvas.getContext('2d');
  var sparks = Array.from({length:18}, function() {
    var a = Math.random() * Math.PI * 2;
    var sp = 1.5 + Math.random() * 3.5;
    return { x:150, y:30, vx:Math.cos(a)*sp, vy:Math.sin(a)*sp - 2.5, al:1, c:color||'#ffd166' };
  });
  function frame() {
    ctx.clearRect(0,0,300,60);
    var alive = false;
    sparks.forEach(function(s) {
      s.x += s.vx; s.y += s.vy; s.vy += 0.18; s.al -= 0.045;
      if (s.al > 0) { alive = true; ctx.save(); ctx.globalAlpha = s.al; ctx.fillStyle = s.c; ctx.beginPath(); ctx.arc(s.x,s.y,2.2,0,Math.PI*2); ctx.fill(); ctx.restore(); }
    });
    if (alive) _forgeAnimFrame = requestAnimationFrame(frame);
    else { ctx.clearRect(0,0,300,60); canvas.style.opacity='0'; }
  }
  _forgeAnimFrame = requestAnimationFrame(frame);
}
function _forgeHammerSwing(hammer, onHit) {
  var swings = 0, maxSwings = 5, swingMs = 320;
  function doSwing() {
    if (swings >= maxSwings) { if(onHit) onHit(); return; }
    hammer.style.transition = 'transform ' + (swingMs*0.35) + 'ms cubic-bezier(.2,1,.4,1)';
    hammer.style.transform = 'rotate(-55deg) translateY(-10px)';
    setTimeout(function() {
      hammer.style.transition = 'transform ' + (swingMs*0.45) + 'ms cubic-bezier(.5,0,1,.7)';
      hammer.style.transform = 'rotate(12deg) translateY(4px)';
      setTimeout(function() { swings++; doSwing(); }, swingMs * 0.55);
    }, swingMs * 0.45);
  }
  doSwing();
}

async function syUpgradeShipStat(shipId, stat) {
  var labelMap = { atk: '공격력', def: '방어력', hp: '체력', speed: '속도' };
  // Fix: id strict-equality — server returns string, onclick passes number
  var ship = (shipyardState.ships || []).find(function(s){ return String(s.id) === String(shipId); });
  var offer = ship && ship.upgrade_offers && ship.upgrade_offers[stat];
  if (ship && ship.is_market_listed) { showFactionToast(LANG==='ko'?'판매중인 함선은 강화할 수 없습니다':LANG==='ja'?'販売中の艦船は強化できません':LANG==='zh'?'上架中的舰船无法强化':'Cannot upgrade a listed ship','error'); return; }
  var haveQty = offer ? syOwnedResourceQty(offer.material_code) : 0;
  var needQty = offer ? parseInt(offer.material_qty || 0, 10) : 0;
  var gpHave = syGpBalance();
  var gpNeed = offer ? Number(offer.cost || 0) : 0;
  var enoughGp = !offer || gpHave >= gpNeed;
  var enoughMaterial = !offer || haveQty >= needQty;
  var materialName = offer ? syResourceName(offer.material_code) : '-';
  var blocked = !enoughGp || !enoughMaterial;
  var tierIdx = offer ? (parseInt(offer.material_tier) || 1) : 1;
  var tierColors = ['','#8bc34a','#42a5f5','#ce93d8'];
  var tierNames  = ['','T1 기본','T2 희귀','T3 전설'];
  var curLv = offer ? (parseInt(offer.upgrade_level) || 0) : 0;
  var tierNextMsg = '';
  if (offer) {
    if (tierIdx === 1 && curLv >= 4) tierNextMsg = '다음 강화 5회 후 T2 재료 필요';
    else if (tierIdx === 1) tierNextMsg = (5 - curLv) + '회 후 T2 희귀 재료 필요';
    else if (tierIdx === 2) tierNextMsg = (10 - curLv) + '회 후 T3 전설 재료 필요';
    else tierNextMsg = '최고 등급 재료 — 함선 가치 ↑';
  }
  var ok = await gameConfirm({
    title: '함선 강화', icon: '⚙️',
    body: '<div style="font-size:11px;color:#9be7a0;font-weight:700;margin-bottom:5px">'
        + (labelMap[stat]||stat) + ' 영구 강화</div>'
        + '<div style="font-size:10px;color:var(--tx3)">실패해도 GP와 재료가 소모됩니다.</div>'
        + (offer ? '<div style="margin-top:6px;font-size:10px;color:' + (tierColors[tierIdx]||'#8bc34a') + '">'
            + '● ' + (tierNames[tierIdx]||'T1') + ' · ' + tierNextMsg + '</div>' : ''),
    info: offer ? [
      { k: '성공 확률', v: offer.chance + '%', ok: offer.chance >= 70 },
      { k: '💰 GP 비용', v: syFmt(gpNeed) + ' (보유 ' + syFmt(gpHave) + ')', insufficient: !enoughGp, ok: enoughGp },
      { k: materialName, v: '필요 ' + needQty + '개  ·  보유 ' + haveQty + '개', insufficient: !enoughMaterial, ok: enoughMaterial }
    ] : undefined,
    confirmText: blocked ? '재료 부족' : '🔨 강화 시작',
    disabled: blocked
  });
  if (!ok) return;
  // ── Forge Animation ──────────────────────
  var modal = document.getElementById('forgeModal');
  var hammer = document.getElementById('forgeHammer');
  var gauge = document.getElementById('forgeGauge');
  var canvas = document.getElementById('forgeSparks');
  var titleEl = document.getElementById('forgeTitleText');
  var statLabel = document.getElementById('forgeStatLabel');
  var resultEl = document.getElementById('forgeResult');
  var resultSub = document.getElementById('forgeResultSub');
  var closeBtn = document.getElementById('forgeCloseBtn');
  var glowBg = document.getElementById('forgeGlowBg');
  // reset
  gauge.style.width = '0%';
  gauge.style.background = 'linear-gradient(90deg,#ffd166,#ff9800)';
  gauge.style.boxShadow = '0 0 12px rgba(255,209,102,.45)';
  resultEl.style.display = 'none';
  resultSub.style.display = 'none';
  closeBtn.style.display = 'none';
  glowBg.style.opacity = '0';
  glowBg.style.background = '';
  hammer.style.transform = 'scaleX(-1) rotate(0deg)'; // [v7.192] 좌측 방향 유지하면서 회전 초기화
  // [v7.192] 매 호출마다 hero 상태 초기화 — 망치+톱니 다시 보이게, 결과 emoji 숨김.
  var _hw = document.getElementById('forgeHammerWrap'); if (_hw) _hw.style.opacity = '1';
  var _av = document.getElementById('forgeAnvil');     if (_av) _av.style.opacity = '1';
  var _re = document.getElementById('forgeResultEmoji');
  if (_re) { _re.style.display = 'none'; _re.style.transform = 'translate(-50%,-50%) scale(0)'; }
  titleEl.textContent = LANG==='ko'?'🔨 강화 중...':LANG==='ja'?'🔨 強化中...':LANG==='zh'?'🔨 强化中...':'🔨 Upgrading...';
  statLabel.textContent = (ship ? (syShipName(ship) || '') + '  ' : '') + (labelMap[stat]||stat).toUpperCase() + ' · MOD ' + curLv + '  →  ' + materialName + ' × ' + needQty;
  modal.style.display = 'flex';

  // gauge fills over ~2.4s with hammer swings
  var gaugeStart = Date.now(), gaugeDur = 2400;
  var apiPromise = fetch('/api/ships/' + shipId + '/upgrade-stat', {
    method: 'POST',
    headers: Object.assign({'Content-Type':'application/json'}, getAuthHeaders()),
    body: JSON.stringify({ stat: stat })
  }).then(function(r){ return r.json().then(function(d){ return {ok:r.ok, d:d}; }); });

  function tickGauge() {
    var pct = Math.min(100, ((Date.now() - gaugeStart) / gaugeDur) * 100);
    gauge.style.width = pct + '%';
    if (pct < 100) { _forgeAnimFrame = requestAnimationFrame(tickGauge); }
  }
  _forgeAnimFrame = requestAnimationFrame(tickGauge);

  // hammer swings during loading — spark on each hit
  var swingCount = 0;
  function doHammerSwing() {
    if (!document.getElementById('forgeModal') || modal.style.display==='none') return;
    // [v7.192] scaleX(-1) (좌측 방향) 유지하면서 회전 — 합성 transform.
    hammer.style.transition = 'transform 135ms cubic-bezier(.2,1,.4,1)';
    hammer.style.transform = 'scaleX(-1) rotate(-58deg) translateY(-12px)';
    setTimeout(function(){
      hammer.style.transition = 'transform 155ms cubic-bezier(.5,0,1,.7)';
      hammer.style.transform = 'scaleX(-1) rotate(10deg) translateY(4px)';
      swingCount++;
      _forgeSparkBurst(canvas, swingCount % 2 === 0 ? '#ffd166' : '#ff9800');
      if (swingCount < 6) setTimeout(doHammerSwing, 340);
    }, 140);
  }
  doHammerSwing();

  // wait for both animation + API
  var results = await Promise.all([
    new Promise(function(res){ setTimeout(res, gaugeDur); }),
    apiPromise
  ]);
  gauge.style.width = '100%';
  cancelAnimationFrame(_forgeAnimFrame);

  var apiRes = results[1];
  if (!apiRes || !apiRes.ok || apiRes.d.error) {
    // error
    glowBg.style.background = 'radial-gradient(circle, rgba(239,83,80,.18) 0%, transparent 70%)';
    glowBg.style.opacity = '1';
    gauge.style.background = '#ef5350';
    hammer.style.transition = 'transform .15s';
    hammer.style.transform = 'rotate(0deg)';
    titleEl.textContent = LANG==='ko'?'⚠ 강화 오류':LANG==='ja'?'⚠ 強化エラー':LANG==='zh'?'⚠ 强化错误':'⚠ Upgrade Error';
    resultEl.style.display = 'block';
    resultEl.style.color = '#ef9a9a';
    resultEl.textContent = (LANG==='ko'?'오류: ':LANG==='ja'?'エラー: ':LANG==='zh'?'错误: ':'Error: ') + (apiRes.d && apiRes.d.error ? apiRes.d.error : 'UNKNOWN');
    resultSub.style.display = 'block';
    resultSub.textContent = LANG==='ko'?'재료/GP가 차감됐을 수 있습니다. 새로고침 확인 바랍니다.':LANG==='ja'?'素材/GPが消費された可能性があります。更新して確認してください。':LANG==='zh'?'素材/GP可能已被扣除，请刷新确认。':'Materials/GP may have been deducted. Please refresh to verify.';
  } else {
    var d = apiRes.d;
    // [v7.192] 결과 emoji 헬퍼 — 성공 ⭐ / 실패 💔. 망치+톱니 페이드아웃 후 emoji 팝.
    var hammerWrap = document.getElementById('forgeHammerWrap');
    var anvilEl    = document.getElementById('forgeAnvil');
    var resultEmoji= document.getElementById('forgeResultEmoji');
    function _showForgeResultEmoji(emoji, color) {
      if (hammerWrap) hammerWrap.style.opacity = '0';
      if (anvilEl)    anvilEl.style.opacity = '0';
      if (resultEmoji) {
        resultEmoji.textContent = emoji;
        resultEmoji.style.color = color; // drop-shadow 가 currentColor 사용
        resultEmoji.style.display = 'block';
        // 다음 프레임에 transform 적용 → 0 → 1 scale 팝 애니메이션
        requestAnimationFrame(function(){
          resultEmoji.style.transform = 'translate(-50%,-50%) scale(1.15)';
          setTimeout(function(){ resultEmoji.style.transform = 'translate(-50%,-50%) scale(1)'; }, 350);
        });
      }
    }
    if (d.upgraded) {
      glowBg.style.background = 'radial-gradient(circle, rgba(102,187,106,.28) 0%, transparent 70%)';
      glowBg.style.opacity = '1';
      gauge.style.background = 'linear-gradient(90deg,#66bb6a,#a5d6a7,#ffd166)';
      gauge.style.boxShadow = '0 0 20px rgba(165,214,167,.7), 0 0 8px rgba(255,209,102,.5)';
      _forgeSparkBurst(canvas, '#a5d6a7');
      setTimeout(function(){ _forgeSparkBurst(canvas, '#ffd166'); }, 200);
      setTimeout(function(){ _forgeSparkBurst(canvas, '#fff'); }, 400);
      _showForgeResultEmoji('⭐', '#ffd166'); // [v7.192] 강화 성공 = 별 (level up 의미)
      titleEl.textContent = LANG==='ko'?'✅ 강화 성공!':LANG==='ja'?'✅ 強化成功!':LANG==='zh'?'✅ 强化成功!':'✅ Upgrade Successful!';
      resultEl.style.display = 'block';
      resultEl.style.color = '#9be7a0';
      resultEl.textContent = (labelMap[stat]||stat) + ' +' + d.delta + '  (MOD ' + (curLv+1) + ')';
      resultSub.style.display = 'block';
      resultSub.textContent = '-' + syFmt(d.gp_cost) + ' GP  ·  '+(LANG==='ko'?'확률':LANG==='ja'?'確率':LANG==='zh'?'概率':'Chance')+' ' + d.chance + '%  ·  '+(LANG==='ko'?'굴림':LANG==='ja'?'ロール':LANG==='zh'?'骰值':'Roll')+' ' + d.roll;
    } else {
      // (도파민 v7.389) near-miss — 굴림이 필요%를 근소하게(≤8%) 초과한 "아깝게 실패"는 긴장 연출.
      var _gap = (Number(d.roll) - Number(d.chance));
      var _nearMiss = (_gap > 0 && _gap <= 8);
      glowBg.style.background = 'radial-gradient(circle, rgba(244,67,54,'+(_nearMiss?'.32':'.18')+') 0%, transparent 70%)';
      glowBg.style.opacity = '1';
      gauge.style.background = 'linear-gradient(90deg,#ff9800,#f44336)';
      gauge.style.boxShadow = '0 0 10px rgba(244,67,54,.45)';
      resultEl.style.display = 'block';
      resultSub.style.display = 'block';
      if (_nearMiss) {
        _showForgeResultEmoji('😖', '#ffd166');
        titleEl.textContent = LANG==='ko'?'😖 아깝다! 강화 실패':LANG==='ja'?'😖 惜しい！強化失敗':LANG==='zh'?'😖 差一点！强化失败':'😖 SO CLOSE!';
        resultEl.style.color = '#ffd166';
        resultEl.textContent = LANG==='ko'?('단 '+_gap.toFixed(1)+'% 차이로 실패!'):LANG==='ja'?('わずか'+_gap.toFixed(1)+'%差で失敗！'):LANG==='zh'?('仅差'+_gap.toFixed(1)+'%失败！'):('Missed by just '+_gap.toFixed(1)+'%!');
        try{ if(window._sfx) _sfx.error(); }catch(_){}
        try{ resultEl.animate([{transform:'translateX(0)'},{transform:'translateX(-7px)'},{transform:'translateX(7px)'},{transform:'translateX(-4px)'},{transform:'translateX(0)'}],{duration:300,easing:'ease-out'}); }catch(_){}
      } else {
        _showForgeResultEmoji('💔', '#ef9a9a');
        titleEl.textContent = LANG==='ko'?'💔 강화 실패':LANG==='ja'?'💔 強化失敗':LANG==='zh'?'💔 强化失败':'💔 Upgrade Failed';
        resultEl.style.color = '#ffb3b3';
        resultEl.textContent = LANG==='ko'?'재료와 GP는 소모되었습니다':LANG==='ja'?'素材とGPが消費されました':LANG==='zh'?'素材和GP已消耗':'Materials and GP were consumed';
      }
      resultSub.textContent = '-' + syFmt(d.gp_cost) + ' GP  ·  '+(LANG==='ko'?'확률':LANG==='ja'?'確率':LANG==='zh'?'概率':'Chance')+' ' + d.chance + '%  ·  '+(LANG==='ko'?'굴림':LANG==='ja'?'ロール':LANG==='zh'?'骰值':'Roll')+' ' + d.roll;
    }
  }
  closeBtn.style.display = 'block';
  try{ markDailyOpsAction('ship_upgrade', 1); }catch(_e){}
  refreshBalance();
  refreshShipyard();
}

async function syRepairShip(shipId, name, currentHp, maxHp) {
  var missing = maxHp - currentHp;
  var quote = null;
  try {
    var qr = await fetch('/api/ships/' + shipId + '/repair-quote?target_hp_pct=100', {
      headers: getAuthHeaders()
    });
    var qd = await qr.json();
    if (qr.ok && !qd.error) quote = qd;
  } catch(_e) {}
  var gpCost  = quote ? quote.gp_cost : Math.ceil(missing * 0.03);
  var ironNeed = quote ? quote.iron_used : Math.ceil(missing / 10 * 0.2);
  var targetHp = quote ? quote.target_hp : maxHp;
  var healed = quote ? quote.healed : missing;
  var ok = await gameConfirm({
    title: LANG==='ko'?'🔧 함선 수리':LANG==='ja'?'🔧 艦船修理':LANG==='zh'?'🔧 修复舰船':'🔧 Repair Ship', icon: '🔧',
    body: '<div style="font-size:11px;color:#81c784;font-weight:700;margin-bottom:5px">' + name + '</div>'
      + '<div style="font-size:10px;color:var(--tx3)">HP ' + syFmt(currentHp) + ' → ' + syFmt(targetHp) + ' (+' + syFmt(healed) + ')</div>'
      + (!quote ? '<div style="font-size:9px;color:var(--gold);margin-top:4px">'+(LANG==='ko'?'견적 API 실패 — 기본 공식으로 표시합니다.':LANG==='ja'?'見積API失敗 — 基本式で表示します。':LANG==='zh'?'报价接口失败 — 使用默认公式显示。':'Quote unavailable — showing default estimate.')+'</div>' : ''),
    info: [
      { k: LANG==='ko'?'GP 비용':LANG==='ja'?'GP費用':LANG==='zh'?'GP费用':'GP Cost', v: gpCost + ' GP' },
      { k: '🪨 iron_ore', v: ironNeed + (LANG==='ko'?'개':LANG==='ja'?'個':LANG==='zh'?'个':'x') }
    ],
    confirmText: LANG==='ko'?'🔧 수리하기':LANG==='ja'?'🔧 修理する':LANG==='zh'?'🔧 修复':'🔧 Repair'
  });
  if (!ok) return;
  try {
    var r = await fetch('/api/ships/' + shipId + '/repair', {
      method: 'POST',
      headers: Object.assign({'Content-Type':'application/json'}, getAuthHeaders()),
      body: JSON.stringify({ target_hp_pct: 100 })
    });
    var d = await r.json();
    if (d.error) { showFactionToast((LANG==='ko'?'수리 실패: ':LANG==='ja'?'修理失敗: ':LANG==='zh'?'修复失败: ':'Repair failed: ') + d.error, 'error'); return; }
    showFactionToast('🔧 수리 완료! +' + syFmt(d.healed) + ' HP (-' + d.gp_cost + ' GP)', 'success');
    try{ markDailyOpsAction('repair_ship', 1); }catch(_e){}
    refreshBalance();
    await refreshShipyard();
  } catch(e) { showFactionToast(LANG==='ko'?'수리 요청 실패':LANG==='ja'?'修理リクエスト失敗':LANG==='zh'?'修复请求失败':'Repair request failed','error'); }
}

async function syScrapShip(shipId, name) {
  var ok = await gameConfirm({
    title: LANG==='ko'?'🔥 함선 해체':LANG==='ja'?'🔥 艦船解体':LANG==='zh'?'🔥 拆解舰船':'🔥 Scrap Ship', icon: '🔥',
    body: '<div style="font-size:11px;color:#ff8a80;font-weight:700;margin-bottom:5px">' + name + '</div>'
      + '<div style="font-size:10px;color:var(--tx3)">'+(LANG==="ko"?"해체 시 GP와 광물의 일부가 환불됩니다. 나머지는 소각."
        :LANG==="ja"?"解体時にGPと素材の一部が返金されます。残りはバーン。"
        :LANG==="zh"?"解体时返还部分GP和矿物，其余销毁。"
        :"Some GP/materials refunded on scrap. Rest is burned.")+'</div>'
      + '<div style="font-size:9px;color:rgba(255,255,255,.4);margin-top:4px">'+(LANG==="ko"?"기본 환불 40% · admin 조정 가능":LANG==="ja"?"基本返金率40%":LANG==="zh"?"基础返还率40%":"Default refund 40%")+'</div>',
    confirmText: LANG==='ko'?'🔥 해체하기':LANG==='ja'?'🔥 解体する':LANG==='zh'?'🔥 拆解':'🔥 Scrap'
  });
  if (!ok) return;
  try {
    var r = await fetch('/api/ships/' + shipId + '/scrap', {
      method: 'POST',
      headers: Object.assign({'Content-Type':'application/json'}, getAuthHeaders())
    });
    var d = await r.json();
    if (d.error) { showFactionToast((LANG==='ko'?'해체 실패: ':LANG==='ja'?'解体失敗: ':LANG==='zh'?'解体失败: ':'Scrap failed: ') + d.error, 'error'); return; }
    var refundedParts = [];
    if (d.gpRefunded) refundedParts.push('+' + d.gpRefunded + ' GP');
    if (d.mineralsRefunded) {
      for (var k in d.mineralsRefunded) refundedParts.push('+' + d.mineralsRefunded[k] + ' ' + k);
    }
    showFactionToast('🔥 ' + (LANG==='ko'?'해체 완료 — 환불: ':LANG==='ja'?'解体完了 — 返金: ':LANG==='zh'?'解体完成 — 返还: ':'Scrapped — Refund: ') + (refundedParts.join(', ') || (LANG==='ko'?'없음':LANG==='ja'?'なし':LANG==='zh'?'无':'none')), 'success');
    refreshBalance();
    await refreshShipyard();
  } catch(e) { showFactionToast(LANG==='ko'?'해체 요청 실패':LANG==='ja'?'解体リクエスト失敗':LANG==='zh'?'解体请求失败':'Scrap request failed','error'); }
}

async function syChargeShield(shipId, name, maxHp, currentShield, shieldMax) {
  var maxRatio = 50;
  var calcShieldMax = shieldMax > 0 ? shieldMax : Math.floor(maxHp * maxRatio / 100);
  var canAdd = calcShieldMax - currentShield;
  if (canAdd <= 0) { showFactionToast(LANG==='ko'?'🛡 실드가 이미 최대입니다':LANG==='ja'?'🛡 シールドは既に最大です':LANG==='zh'?'🛡 护盾已满':'🛡 Shield already at max', 'info'); return; }
  var units = canAdd;
  var gpCost = Math.ceil(units * 0.05);
  var ok = await gameConfirm({
    title: LANG==='ko'?'🛡 실드 충전':LANG==='ja'?'🛡 シールド充電':LANG==='zh'?'🛡 充能护盾':'🛡 Charge Shield', icon: '🛡',
    body: '<div style="font-size:11px;color:#64b5f6;font-weight:700;margin-bottom:5px">' + name + '</div>'
      + '<div style="font-size:10px;color:var(--tx3)">'+(LANG==="ko"?"실드":LANG==="ja"?"シールド":LANG==="zh"?"护盾":"Shield")+' ' + syFmt(currentShield) + ' → ' + syFmt(currentShield + units) + '</div>'
      + '<div style="font-size:9px;color:rgba(255,255,255,.4);margin-top:4px">'+(LANG==="ko"?"실드는 전투 시 HP 대신 먼저 소모됩니다 · 시간당 3% 자연 감소":LANG==="ja"?"シールドは戦闘時HPより先に消費 · 毎時3%自然減少":LANG==="zh"?"护盾优先于HP消耗 · 每小时衰减3%":"Shield absorbs damage before HP · 3% decay/hr")+'</div>',
    info: [{ k: LANG==='ko'?'GP 비용':LANG==='ja'?'GP費用':LANG==='zh'?'GP费用':'GP Cost', v: gpCost + ' GP' }],
    confirmText: LANG==='ko'?'🛡 충전하기':LANG==='ja'?'🛡 充電する':LANG==='zh'?'🛡 充能':'🛡 Charge'
  });
  if (!ok) return;
  try {
    var r = await fetch('/api/ships/' + shipId + '/shield', {
      method: 'POST',
      headers: Object.assign({'Content-Type':'application/json'}, getAuthHeaders()),
      body: JSON.stringify({ units: units })
    });
    var d = await r.json();
    if (d.error) { showFactionToast((LANG==='ko'?'충전 실패: ':LANG==='ja'?'充電失敗: ':LANG==='zh'?'充电失败: ':'Charge failed: ') + d.error, 'error'); return; }
    showFactionToast('🛡 '+(LANG==='ko'?'실드 충전 완료! ':LANG==='ja'?'シールド充電完了! ':LANG==='zh'?'护盾充能完成! ':'Shield charged! ')+'+' + syFmt(d.shield_added) + ' (-' + d.gp_cost + ' GP)', 'success');
    refreshBalance();
    await refreshShipyard();
  } catch(e) { showFactionToast(LANG==='ko'?'실드 충전 요청 실패':LANG==='ja'?'シールド充電リクエスト失敗':LANG==='zh'?'护盾充电请求失败':'Shield charge request failed','error'); }
}

function filterMarketFaction(faction) {
  shipyardState.marketFaction = faction;
  document.querySelectorAll('[data-mfaction]').forEach(function(c) {
    c.classList.toggle('active', c.dataset.mfaction === faction);
  });
  renderShipMarket();
}

function filterMarketSize(size) {
  shipyardState.marketSize = size;
  document.querySelectorAll('[data-msize]').forEach(function(c) {
    c.classList.toggle('active', c.dataset.msize === size);
  });
  renderShipMarket();
}

function filterMarketSort(sort) {
  shipyardState.marketSort = sort;
  renderShipMarket();
}

function renderShipMarket() {
  var list = document.getElementById('shipMarketList');
  if (!list) return;
  var listings = (shipyardState.marketListings || []).slice();
  // apply faction filter
  var mf = shipyardState.marketFaction;
  if (mf) listings = listings.filter(function(s){ return (s.faction_code||'').toLowerCase() === mf; });
  // apply size filter
  var ms = shipyardState.marketSize;
  if (ms) listings = listings.filter(function(s){ return (s.size_class||s.size||'').toLowerCase() === ms; });
  // apply sort
  var msort = shipyardState.marketSort || 'price_asc';
  listings.sort(function(a,b){
    if (msort === 'price_asc')   return parseFloat(a.price_gp||0) - parseFloat(b.price_gp||0);
    if (msort === 'price_desc')  return parseFloat(b.price_gp||0) - parseFloat(a.price_gp||0);
    if (msort === 'power_desc') {
      var pa = (parseFloat(a.bonus_atk||0)+parseFloat(a.bonus_def||0)+parseFloat(a.bonus_hp||0)+parseFloat(a.bonus_speed||0));
      var pb = (parseFloat(b.bonus_atk||0)+parseFloat(b.bonus_def||0)+parseFloat(b.bonus_hp||0)+parseFloat(b.bonus_speed||0));
      return pb - pa;
    }
    if (msort === 'newest') return (b.listing_id||0) - (a.listing_id||0);
    return 0;
  });
  // show count label
  var allCount = (shipyardState.marketListings || []).length;
  var countLabel = listings.length < allCount
    ? '<div style="font-size:9px;color:rgba(255,255,255,.35);letter-spacing:1px;padding:6px 0 2px">' + listings.length + ' / ' + allCount + ' '+(LANG==='ko'?'항목':LANG==='ja'?'件':LANG==='zh'?'件':'items')+'</div>'
    : '';
  if (!listings.length) {
    list.innerHTML = countLabel + '<div class="sy-empty" style="grid-column:1/-1">' + (allCount ? (LANG==='ko'?'조건에 맞는 함선이 없습니다':LANG==='ja'?'条件に合う艦船がありません':LANG==='zh'?'没有符合条件的舰船':'No ships match the filter') : (LANG==='ko'?'판매 중인 함선이 없습니다':LANG==='ja'?'販売中の艦船がありません':LANG==='zh'?'没有在售舰船':'No ships for sale')) + '<br><span style="font-size:9px;opacity:.6">'+( LANG==='ko'?'강화한 함선을 MY FLEET에서 판매 등록할 수 있습니다':LANG==='ja'?'強化した艦船をMY FLEETで売りに出せます':LANG==='zh'?'可以在MY FLEET中上架强化后的舰船':'You can list upgraded ships from MY FLEET')+'</span></div>';
    return;
  }
  list.innerHTML = countLabel + listings.map(function(s) {
    var effectiveMaxHp = parseFloat(s.effective_max_hp || (parseFloat(s.max_hp || 0) + parseFloat(s.bonus_hp || 0)) || s.max_hp || 1);
    var hpPct = Math.max(0, Math.min(100, (s.current_hp / effectiveMaxHp) * 100));
    // [v7.175 Task 3c] 마켓 카드 시각 업그레이드 — 가챠 리빌 포트레이트(800x600 실사풍) 활용.
    //   기존 SVG silhouette 은 fallback (포트레이트 미존재 시). object-fit:cover 로 깔끔.
    var portraitSrc = 'assets/ships/reveal/' + (s.ship_type_code||'') + '.jpg';
    var silhouette = shipVisual(s.size_class, s.faction_code, { role: s.role, code: s.ship_type_code });
    var seller = s.seller_name || s.seller_short || 'UNKNOWN';
    return '<div class="ship-market-card">' +
      '<span class="ship-sale-sticker">'+(LANG==="ko"?"판매중":LANG==="ja"?"販売中":LANG==="zh"?"在售":"For Sale")+'</span>' +
      '<div class="bp-visual" style="position:relative;overflow:hidden;border-radius:8px">' +
        '<img src="'+portraitSrc+'" alt="" style="width:100%;height:100%;object-fit:cover;display:block;border-radius:8px" ' +
        'onerror="this.onerror=null;this.style.display=\'none\';this.parentNode.innerHTML=\''+silhouette.replace(/'/g,"\\'")+'\'">' +
        '<div style="position:absolute;left:0;right:0;bottom:0;height:42%;background:linear-gradient(180deg,transparent,rgba(6,8,15,.7));pointer-events:none"></div>' +
      '</div>' +
      '<div class="ship-name" style="color:' + (s.faction_color || '#fff') + '">' + fcEsc(syShipName(s)) + '</div>' +
      '<div class="ship-class">' + fcEsc(syClassLabel(s.class_label || '')) + ' · MOD ' + syFmt(s.upgrade_level || 0) + '</div>' +
      '<div class="bp-stats" style="margin:7px 0 0">' +
        '<div class="bp-stat"><div class="bp-stat-label">HP</div><div class="bp-stat-value">' + syStatValue(s.max_hp, s.bonus_hp) + '</div></div>' +
        '<div class="bp-stat"><div class="bp-stat-label">ATK</div><div class="bp-stat-value">' + syStatValue(s.base_atk, s.bonus_atk) + '</div></div>' +
        '<div class="bp-stat"><div class="bp-stat-label">DEF</div><div class="bp-stat-value">' + syStatValue(s.base_def, s.bonus_def) + '</div></div>' +
        '<div class="bp-stat"><div class="bp-stat-label">SPD</div><div class="bp-stat-value">' + syStatValue(s.base_speed, s.bonus_speed, 2) + '</div></div>' +
      '</div>' +
      '<div class="ship-hp-bar"><div class="ship-hp-fill" style="width:' + hpPct + '%"></div></div>' +
      '<div class="ship-market-price">' + syFmt(s.price_gp) + ' GP</div>' +
      '<div class="ship-market-meta"><span>SELLER</span><span>' + fcEsc(seller) + '</span></div>' +
      '<div class="ship-sale-actions">' +
        (s.is_mine
          ? '<button class="ship-sale-btn cancel" onclick="syCancelShipListing(' + s.listing_id + ')" data-i18n="ship_mkt_cancel">Cancel Listing</button>'
          : '<button class="ship-sale-btn" onclick="syBuyShipListing(' + s.listing_id + ')" data-i18n="ship_mkt_buy">Buy</button>') +
      '</div>' +
    '</div>';
  }).join('');
}

async function syListShipForSale(shipId) {
  var ship = (shipyardState.ships || []).find(function(s){ return s.id === shipId; });
  var _shipFb = LANG==='ko'?'함선':LANG==='ja'?'艦船':LANG==='zh'?'舰船':'Ship';
  var name = ship ? (syShipName(ship) || ship.name || _shipFb) : _shipFb;
  var priceText = await gameInput({
    title:LANG==='ko'?'함선 판매 등록':LANG==='ja'?'艦船出品':LANG==='zh'?'上架舰船':'List Ship for Sale',
    label:name + (LANG==='ko'?' 판매가 (GP)':LANG==='ja'?' 売値 (GP)':LANG==='zh'?' 售价 (GP)':' Sale Price (GP)'),
    placeholder:LANG==='ko'?'예: 1200':LANG==='ja'?'例: 1200':LANG==='zh'?'例如: 1200':'e.g. 1200',
    maxLength:16
  });
  if (priceText === null) return;
  var price = Number(String(priceText).replace(/,/g, '').trim());
  if (!Number.isFinite(price) || price <= 0) { showFactionToast(LANG==='ko'?'판매가가 올바르지 않습니다':LANG==='ja'?'販売価格が正しくありません':LANG==='zh'?'售价无效':'Invalid listing price','error'); return; }
  try {
    var r = await fetch('/api/ships/' + shipId + '/list', {
      method:'POST',
      headers:Object.assign({'Content-Type':'application/json'}, getAuthHeaders()),
      body:JSON.stringify({ price_gp: price })
    });
    var d = await r.json();
    if (!r.ok || d.error) { showFactionToast((LANG==='ko'?'판매 등록 실패: ':LANG==='ja'?'出品失敗: ':LANG==='zh'?'上架失败: ':'Listing failed: ') + srvErr(d.error), 'error'); return; }
    showFactionToast((LANG==='ko'?'판매 등록 완료: ':LANG==='ja'?'出品完了: ':LANG==='zh'?'上架完成: ':'Listed: ') + syFmt(d.price_gp) + ' GP', 'success');
    await refreshShipyard();
  } catch(e) { showFactionToast(LANG==='ko'?'판매 등록 요청 실패':LANG==='ja'?'出品リクエスト失敗':LANG==='zh'?'上架请求失败':'Listing request failed','error'); }
}

async function syCancelShipListing(listingId) {
  if (!listingId) return;
  var ok = await gameConfirm({ title:LANG==='ko'?'판매 취소':LANG==='ja'?'出品キャンセル':LANG==='zh'?'取消上架':'Cancel Listing', icon:'🏷', body:LANG==='ko'?'판매 등록을 취소하고 함선을 내 기본 함대로 되돌립니다.':LANG==='ja'?'出品をキャンセルし、艦船を艦隊に戻します。':LANG==='zh'?'取消上架，舰船将返回我的舰队。':'Cancel the listing and return the ship to your fleet.', confirmText:LANG==='ko'?'취소하기':LANG==='ja'?'キャンセル':LANG==='zh'?'取消':'Cancel' });
  if (!ok) return;
  try {
    var r = await fetch('/api/ships/market/listings/' + listingId + '/cancel', {
      method:'POST',
      headers:getAuthHeaders()
    });
    var d = await r.json();
    if (!r.ok || d.error) { showFactionToast((LANG==='ko'?'판매 취소 실패: ':LANG==='ja'?'出品キャンセル失敗: ':LANG==='zh'?'取消上架失败: ':'Cancel listing failed: ') + srvErr(d.error), 'error'); return; }
    showFactionToast(LANG==='ko'?'판매 취소 완료':LANG==='ja'?'出品キャンセル完了':LANG==='zh'?'取消上架完成':'Listing cancelled','success');
    await refreshShipyard();
  } catch(e) { showFactionToast(LANG==='ko'?'판매 취소 요청 실패':LANG==='ja'?'キャンセルリクエスト失敗':LANG==='zh'?'取消请求失败':'Cancel request failed','error'); }
}

async function syBuyShipListing(listingId) {
  var listing = (shipyardState.marketListings || []).find(function(s){ return s.listing_id === listingId; }) || {};
  var name = syShipName(listing) || (LANG==='ko'?'함선':LANG==='ja'?'艦船':LANG==='zh'?'舰船':'Ship');
  var price = Number(listing.price_gp || 0);
  var ok = await gameConfirm({
    title:LANG==='ko'?'함선 구매':LANG==='ja'?'艦船購入':LANG==='zh'?'购买舰船':'Buy Ship',
    icon:'🚀',
    body:'<b>' + fcEsc(name) + '</b> '+(LANG==='ko'?'함선을 구매합니다.':LANG==='ja'?'を購入します。':LANG==='zh'?'舰船将加入您的舰队。':'will be added to your fleet.'),
    info:[{ k:LANG==='ko'?'가격':LANG==='ja'?'価格':LANG==='zh'?'价格':'Price', v: syFmt(price) + ' GP' }],
    confirmText:LANG==='ko'?'구매하기':LANG==='ja'?'購入する':LANG==='zh'?'购买':'Buy'
  });
  if (!ok) return;
  try {
    var r = await fetch('/api/ships/market/listings/' + listingId + '/buy', {
      method:'POST',
      headers:getAuthHeaders()
    });
    var d = await r.json();
    if (!r.ok || d.error) { showFactionToast((LANG==='ko'?'구매 실패: ':LANG==='ja'?'購入失敗: ':LANG==='zh'?'购买失败: ':'Purchase failed: ') + srvErr(d.error), 'error'); return; }
    showFactionToast(LANG==='ko'?'구매 완료: 내 함대에 배치됨':LANG==='ja'?'購入完了: 艦隊に配備されました':LANG==='zh'?'购买完成：已加入我的舰队':'Purchase complete: added to fleet','success');
    refreshBalance();
    await refreshShipyard();
  } catch(e) { showFactionToast(LANG==='ko'?'구매 요청 실패':LANG==='ja'?'購入リクエスト失敗':LANG==='zh'?'购买请求失败':'Purchase request failed','error'); }
}

function updateFooter() {
  // GP 는 권위 소스(syGpBalance: summary.gp_balance ?? walletState.gameGP)에서 — DOM 복사(stale "-") 버그 수정
  document.getElementById('syGpBalance').textContent = syFmt(syGpBalance());
  var totalMinerals = Object.values(shipyardState.myInventory).reduce(function(a,b){ return a+b; }, 0);
  document.getElementById('syMineralSummary').textContent = syFmt(totalMinerals);
  var alive = parseInt((shipyardState.summary && shipyardState.summary.ships_alive) || 0);
  var inProg = parseInt((shipyardState.summary && shipyardState.summary.jobs_in_progress) || 0);
  document.getElementById('syShipCount').textContent = alive + ' (+' + inProg + ' '+(LANG==='ko'?'건조중':LANG==='ja'?'建造中':LANG==='zh'?'建造中':'building')+') / 200';
}

function syFmt(n) {
  n = parseInt(n) || 0;
  if (n >= 1000000) return (n/1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n/1000).toFixed(1) + 'K';
  return n.toString();
}

function syFmtTime(seconds) {
  seconds = Math.max(0, Math.floor(seconds));
  if (seconds >= 3600) return Math.floor(seconds/3600) + 'h ' + Math.floor((seconds%3600)/60) + 'm';
  if (seconds >= 60) return Math.floor(seconds/60) + 'm ' + (seconds%60) + 's';
  return seconds + 's';
}

var MINERAL_ICONS = {
  iron_dust:'🟤', red_sand:'🔴', regolith_ore:'⚪', basalt_chip:'🟫',
  ice_crystal:'🔵', volcanic_shard:'🌋', plasma_dust:'🟣', ancient_metal:'⭐',
  meteorite_fragment:'☄️', xenomatter:'💠', hull_plate:'▣', plasma_coil:'⚡', alloy_frame:'⬢',
  // tier 1 건조 재료 (Frontier)
  iron_ore:'🪨', carbon_fiber:'🧵', silicon_chip:'💠',
  // tier 2 건조 재료 (Mid)
  titanium_alloy:'⚙️', plasma_crystal:'🔮', nano_polymer:'🧬',
  // tier 3 건조 재료 (Core — 타이탄 전용)
  dark_matter:'🌑', quantum_core:'⚡', exotic_alloy:'✨'
};
var MINERAL_KO = {
  iron_dust:'철먼지', red_sand:'붉모래', regolith_ore:'레골리스', basalt_chip:'현무암',
  ice_crystal:'얼음', volcanic_shard:'화산파편', plasma_dust:'플라즈마', ancient_metal:'고대금속',
  meteorite_fragment:'운석', xenomatter:'외계물질', hull_plate:'장갑판', plasma_coil:'플라즈마코일', alloy_frame:'합금프레임',
  iron_ore:'철광석', carbon_fiber:'탄소섬유', silicon_chip:'실리콘칩',
  titanium_alloy:'티타늄합금', plasma_crystal:'플라즈마결정', nano_polymer:'나노폴리머',
  dark_matter:'암흑물질', quantum_core:'퀀텀코어', exotic_alloy:'이그조틱합금'
};
var MINERAL_EN = {
  iron_dust:'Iron Dust', red_sand:'Red Sand', regolith_ore:'Regolith Ore', basalt_chip:'Basalt Chip',
  ice_crystal:'Ice Crystal', volcanic_shard:'Volcanic Shard', plasma_dust:'Plasma Dust', ancient_metal:'Ancient Metal',
  meteorite_fragment:'Meteorite', xenomatter:'Xenomatter', hull_plate:'Hull Plate', plasma_coil:'Plasma Coil', alloy_frame:'Alloy Frame',
  iron_ore:'Iron Ore', carbon_fiber:'Carbon Fiber', silicon_chip:'Silicon Chip',
  titanium_alloy:'Titanium Alloy', plasma_crystal:'Plasma Crystal', nano_polymer:'Nano Polymer',
  dark_matter:'Dark Matter', quantum_core:'Quantum Core', exotic_alloy:'Exotic Alloy'
};
