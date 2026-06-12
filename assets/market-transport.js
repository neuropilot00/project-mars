// ══════════════════════════════════════
// MARKETPLACE
// ══════════════════════════════════════
var _mktView='browse';

function switchMarketView(view,el){
  _mktView=view;
  document.querySelectorAll('.mkt-view-btn').forEach(function(b){
    b.style.borderColor='rgba(255,255,255,.1)'; b.style.background='rgba(255,255,255,.03)'; b.style.color='var(--tx3)';
  });
  if(el){ el.style.borderColor='rgba(160,100,220,.45)'; el.style.background='rgba(160,100,220,.15)'; el.style.color='#a064dc'; }
  document.getElementById('mktBrowseGrid').style.display=(view==='browse')?'grid':'none';
  document.getElementById('mktFilters').style.display=(view==='browse')?'flex':'none';
  document.getElementById('mktSellView').style.display=(view==='sell')?'block':'none';
  document.getElementById('mktAuctionView').style.display=(view==='auction')?'block':'none';
  document.getElementById('mktMyView').style.display=(view==='mine')?'block':'none';
  var rsWrap=document.getElementById('mktRecentSalesWrap');
  if(rsWrap) rsWrap.style.display=(view==='browse')?'block':'none';
  if(view==='browse'){ loadMarketListings(); loadRecentSales(); }
  if(view==='sell') loadSellView();
  if(view==='auction') loadAuctions();
  if(view==='mine') loadMyListings();
}

function loadMarketTab(){ switchMarketView('browse',document.querySelectorAll('.mkt-view-btn')[0]); }

// ═══════════════════════════════════════════════════════════════
//  TRANSPORT TAB (M-158 Phase C)
// ═══════════════════════════════════════════════════════════════

var _tspSectors = null;
var _tspSettings = null;
var _tspCurrentSub = 'launch';

function switchTransportSub(sub) {
  _tspCurrentSub = sub;
  ['launch','my','raid'].forEach(function(s){
    var tab = document.getElementById('tspSub' + s.charAt(0).toUpperCase() + s.slice(1));
    var pane = document.getElementById('tspPane' + s.charAt(0).toUpperCase() + s.slice(1));
    if (tab) tab.classList.toggle('active', s === sub);
    if (pane) pane.style.display = (s === sub) ? '' : 'none';
  });
  if (sub === 'my') loadMyTransports();
  if (sub === 'raid') loadRaidTargets();
}

function loadTransportTab() {
  var w = (walletState && walletState.address) || '';
  if (!w) return;
  // Fetch settings + sectors in parallel
  Promise.all([
    fetch('/api/transport/settings').then(function(r){ return r.json(); }).catch(function(){ return null; }),
    fetch('/api/sectors').then(function(r){ return r.json(); }).catch(function(){ return null; })
  ]).then(function(res) {
    _tspSettings = res[0] || {};
    var sectorsData = res[1];
    _tspSectors = Array.isArray(sectorsData)
      ? sectorsData
      : (sectorsData && Array.isArray(sectorsData.sectors) ? sectorsData.sectors : []);
    if (!_tspSectors.length) {
      var origin = document.getElementById('tspOriginSector');
      var dest = document.getElementById('tspDestSector');
      var errHTML = '<option value="">'+(LANG==='ko'?'섹터 로딩 실패 · 새로고침':LANG==='ja'?'セクター読込失敗 · 更新':LANG==='zh'?'扇区加载失败 · 刷新':'Failed to load sectors · Refresh')+'</option>';
      if (origin) origin.innerHTML = errHTML;
      if (dest) dest.innerHTML = errHTML;
      return;
    }
    populateTransportSectorSelects();
    updateTransportPreview();
    // attach listeners once
    ['tspOriginSector','tspDestSector','tspCargoGp'].forEach(function(id) {
      var el = document.getElementById(id);
      if (el && !el._tspWired) { el._tspWired = true; el.addEventListener('change', updateTransportPreview); el.addEventListener('input', updateTransportPreview); }
    });
    if (_tspCurrentSub === 'my') loadMyTransports();
    if (_tspCurrentSub === 'raid') loadRaidTargets();
  });
}

function populateTransportSectorSelects() {
  var origin = document.getElementById('tspOriginSector');
  var dest = document.getElementById('tspDestSector');
  if (!origin || !dest || !_tspSectors) return;
  var opts = _tspSectors.map(function(s) {
    var tier = s.tier ? (' · '+formatTransportTier(s.tier)) : '';
    var lv = (s.entryMinLevel||0) > 0 ? (' Lv'+s.entryMinLevel) : '';
    return '<option value="'+(s.id||s.sector_id||'')+'">#'+(s.id||s.sector_id||'')+' '+escapeHtml(s.name||'')+tier+lv+'</option>';
  }).join('');
  origin.innerHTML = '<option value="">— Select origin —</option>' + opts;
  dest.innerHTML = '<option value="">— Select destination —</option>' + opts;
}

function formatTransportTier(tier) {
  var t = String(tier || '').toLowerCase();
  if (t === 'core') return 'CORE';
  if (t === 'mid') return 'MID';
  if (t === 'frontier') return 'FRONTIER';
  return 'T'+escapeHtml(String(tier || ''));
}

function transportAllianceLabel(sector) {
  var alliance = sector && sector.governor && sector.governor.alliance;
  if (!alliance) return '';
  var tag = alliance.tag ? '[' + escapeHtml(alliance.tag) + '] ' : '';
  var governed = parseInt(alliance.governedSectors, 10) || 0;
  var name = escapeHtml(alliance.name || 'Alliance');
  return tag + name + (governed > 0 ? ' · ' + governed + ' sectors' : '');
}

function transportLaneAllianceStatus(originSector, destSector) {
  var oa = originSector && originSector.governor && originSector.governor.alliance;
  var da = destSector && destSector.governor && destSector.governor.alliance;
  if (!oa && !da) return '';
  if (oa && da && String(oa.id) === String(da.id)) {
    return '<span style="color:#80cbc4;font-size:8px;font-weight:700">🛡 Alliance lane · ' + transportAllianceLabel(destSector) + '</span>';
  }
  if (da) {
    return '<span style="color:#80cbc4;font-size:8px;font-weight:700">🏛 Destination governed by ' + transportAllianceLabel(destSector) + '</span>';
  }
  return '<span style="color:var(--tx3);font-size:8px">Origin governed by ' + transportAllianceLabel(originSector) + '</span>';
}

function getTransportLaneRisk(originSector, destSector, distance) {
  var destTier = String((destSector && destSector.tier) || '').toLowerCase();
  var originTier = String((originSector && originSector.tier) || '').toLowerCase();
  var levelGate = parseInt((destSector && destSector.entryMinLevel) || 0) || 0;
  if (destTier === 'core' || originTier === 'core' || distance >= 80 || levelGate >= 20) {
    return { label: LANG==='ko'?'고위험 항로':LANG==='ja'?'高リスク航路':LANG==='zh'?'高风险航线':'High-risk lane', color: '#FF6B6B' };
  }
  if (destTier === 'mid' || originTier === 'mid' || distance >= 40 || levelGate >= 10) {
    return { label: LANG==='ko'?'분쟁 항로':LANG==='ja'?'紛争航路':LANG==='zh'?'争夺航线':'Contested lane', color: '#FFB347' };
  }
  return { label: LANG==='ko'?'개척 항로':LANG==='ja'?'開拓航路':LANG==='zh'?'边境航线':'Frontier lane', color: 'var(--gn)' };
}

function updateTransportPreview() {
  var el = document.getElementById('tspLaunchPreview');
  if (!el) return;
  if (!_tspSettings || !_tspSectors) { el.textContent = ''; return; }
  var origin = parseInt((document.getElementById('tspOriginSector')||{}).value || '0');
  var dest = parseInt((document.getElementById('tspDestSector')||{}).value || '0');
  var cargo = parseInt((document.getElementById('tspCargoGp')||{}).value || '0');
  if (!origin || !dest) { el.innerHTML = '<span style="color:var(--tx3)">Select origin &amp; destination to preview duration/reward.</span>'; return; }
  if (origin === dest) { el.innerHTML = '<span style="color:#FF6B6B">✗ Origin must differ from destination.</span>'; return; }
  if (!cargo) { el.innerHTML = '<span style="color:var(--tx3)">Enter cargo GP to preview.</span>'; return; }
  var minC = parseInt(_tspSettings.minCargo)||50;
  var maxC = parseInt(_tspSettings.maxCargo)||5000;
  if (cargo < minC) { el.innerHTML = '<span style="color:#FF6B6B">✗ Min cargo: '+minC+' GP</span>'; return; }
  if (cargo > maxC) { el.innerHTML = '<span style="color:#FF6B6B">✗ Max cargo: '+maxC+' GP</span>'; return; }
  var o = _tspSectors.find(function(x){ return (x.id||x.sector_id) == origin; });
  var d = _tspSectors.find(function(x){ return (x.id||x.sector_id) == dest; });
  if (!o || !d) { el.textContent = ''; return; }
  var dLat = parseFloat(o.centerLat||o.center_lat||0) - parseFloat(d.centerLat||d.center_lat||0);
  var dLng = parseFloat(o.centerLng||o.center_lng||0) - parseFloat(d.centerLng||d.center_lng||0);
  var dist = Math.sqrt(dLat*dLat + dLng*dLng);
  var baseDur = parseFloat(_tspSettings.baseDur)||15;
  var distMul = parseFloat(_tspSettings.distMul)||0.25;
  var duration = Math.max(1, Math.round(baseDur + dist * distMul));
  var rewardPct = parseFloat(_tspSettings.rewardPct)||10;
  var distBonusPct = parseFloat(_tspSettings.distBonusPct)||5;
  var reward = Math.round(cargo * (rewardPct/100) * (1 + (distBonusPct * dist)/100));
  var raidMin = parseInt(_tspSettings.raidMinProg)||20;
  var raidMax = parseInt(_tspSettings.raidMaxProg)||90;
  var raidLootPct = parseFloat(_tspSettings.raidLootPct)||30;
  var lootAtRisk = Math.floor(cargo * raidLootPct / 100);
  var risk = getTransportLaneRisk(o, d, dist);
  var destLv = parseInt(d.entryMinLevel || 0) || 0;
  var destTax = Number.isFinite(parseFloat(d.taxRate)) ? parseFloat(d.taxRate).toFixed(1) + '%' : '-';
  var allianceLine = transportLaneAllianceStatus(o, d);
  el.innerHTML =
    '<span style="color:var(--tx2)">Distance: <b style="color:#FFB347">'+dist.toFixed(1)+'°</b></span> · '
    + '<span style="color:var(--tx2)">ETA: <b style="color:#FFB347">~'+duration+' min</b></span> · '
    + '<span style="color:var(--tx2)">Reward: <b style="color:var(--gold)">+'+reward+' GP</b></span>'
    + '<br><span style="color:'+risk.color+';font-size:8px;font-weight:700">'+risk.label+'</span>'
    + '<span style="color:var(--tx3);font-size:8px"> · '+formatTransportTier(d.tier)+' destination'
    + (destLv > 0 ? ' · Lv '+destLv+' gate' : '')
    + ' · Tax '+destTax+'</span>'
    + (allianceLine ? '<br>'+allianceLine : '')
    + '<br><span style="color:var(--tx3);font-size:8px">Raid window '+raidMin+'-'+raidMax+'% progress · loot at risk ~'+lootAtRisk+' GP. Merchants get faster ETA + bigger rewards + raid resistance.</span>';
}

function submitTransportLaunch() {
  var w = (walletState && walletState.address) || '';
  if (!w) { showFactionToast(t('err_connect_wallet')||'Connect wallet first', 'error'); return; }
  var origin = parseInt((document.getElementById('tspOriginSector')||{}).value || '0');
  var dest = parseInt((document.getElementById('tspDestSector')||{}).value || '0');
  var cargo = parseInt((document.getElementById('tspCargoGp')||{}).value || '0');
  if (!origin || !dest) { showFactionToast(LANG==='ko'?'출발/도착 섹터를 선택하세요':LANG==='ja'?'出発/到着セクターを選択してください':LANG==='zh'?'请选择出发/到达扇区':'Select origin and destination sectors', 'error'); return; }
  if (origin === dest) { showFactionToast(LANG==='ko'?'출발지와 도착지는 달라야 합니다':LANG==='ja'?'出発地と目的地は異なる必要があります':LANG==='zh'?'出发地和目的地必须不同':'Origin and destination must differ', 'error'); return; }
  if (!cargo) { showFactionToast(LANG==='ko'?'화물 GP를 입력하세요':LANG==='ja'?'貨物GP量を入力してください':LANG==='zh'?'请输入货物GP数量':'Enter cargo GP amount', 'error'); return; }
  var doSubmit = function() {
    fetch('/api/transport/start', {
      method: 'POST',
      headers: Object.assign({'Content-Type':'application/json'},getAuthHeaders()),
      body: JSON.stringify({ originSectorId: origin, destSectorId: dest, cargoGp: cargo })
    }).then(function(r){ return r.json(); }).then(function(d) {
      if (d.success) {
        var _etaUnit = LANG==='ko'?'분':LANG==='ja'?'分':LANG==='zh'?'分钟':'min';
        showFactionToast('🚚 '+(LANG==='ko'?'수송 출발! ETA ':LANG==='ja'?'出発! ETA ':LANG==='zh'?'发车! ETA ':'Launched! ETA ')+d.transport.durationMin+_etaUnit+' · +'+d.transport.rewardGp+' GP', 'success');
        switchTransportSub('my');
        if (typeof refreshGP === 'function') refreshGP();
      } else {
        showFactionToast((LANG==='ko'?'출발 실패: ':LANG==='ja'?'発車失敗: ':LANG==='zh'?'发车失败: ':'Launch failed: ')+(d.error||'unknown'), 'error');
      }
    }).catch(function(e){ showFactionToast((LANG==='ko'?'네트워크 오류: ':LANG==='ja'?'ネットワークエラー: ':LANG==='zh'?'网络错误: ':'Network error: ')+e.message, 'error'); });
  };
  var _tspTitle=LANG==='ko'?'수송 출발':LANG==='ja'?'輸送出発':LANG==='zh'?'发车':'Launch Transport';
  var _tspConfirm=LANG==='ko'?'출발':LANG==='ja'?'出発':LANG==='zh'?'出发':'Launch';
  var _tspBody=(LANG==='ko'?'화물 ':LANG==='ja'?'貨物 ':LANG==='zh'?'货物 ':'Cargo ')+'<b>'+cargo+' GP</b> — '+(LANG==='ko'?'섹터':LANG==='ja'?'セクター':LANG==='zh'?'扇区':'Sector')+' #'+origin+' → #'+dest;
  gameConfirm({icon:'🚚',title:_tspTitle,body:_tspBody,confirmText:_tspConfirm}).then(function(ok){if(ok)doSubmit();});
}

function loadMyTransports() {
  var w = (walletState && walletState.address) || '';
  if (!w) return;
  fetch('/api/transport/my?limit=30', { headers: getAuthHeaders() })
    .then(function(r){ return r.json(); })
    .then(function(d) {
      var list = document.getElementById('tspMyList');
      if (!list) return;
      var rows = d.transports || [];
      if (!rows.length) { list.innerHTML = '<div style="color:var(--tx3);padding:10px;text-align:center" data-i18n="transport_my_empty">No shipments yet. Launch one!</div>'; return; }
      list.innerHTML = rows.map(function(t) {
        var statusColor = (t.status==='in_transit'?'var(--cyan)':(t.status==='completed'?'var(--gn)':(t.status==='raided'?'#FF6B6B':'#888')));
        var prog = parseInt(t.progress_pct)||0;
        var bar = '<div style="width:100%;height:4px;background:rgba(255,255,255,.08);border-radius:2px;overflow:hidden;margin-top:4px">'
          + '<div style="width:'+prog+'%;height:100%;background:linear-gradient(90deg,#FFB347,#E89C2E)"></div></div>';
        var arrive = new Date(t.arrives_at);
        var remainMin = Math.max(0, Math.round((arrive.getTime() - Date.now())/60000));
        var timeLine = (t.status==='in_transit') ? ('ETA ~'+remainMin+'m') : new Date(t.started_at).toLocaleString();
        var actions = '';
        if (t.status==='in_transit' && prog < 20) {
          actions = '<button onclick="cancelMyTransport('+t.id+')" style="padding:4px 8px;font-size:9px;border-radius:4px;background:rgba(255,107,107,.12);border:1px solid rgba(255,107,107,.3);color:#FF6B6B;cursor:pointer;margin-top:6px" data-i18n="transport_cancel_btn">✗ CANCEL</button>';
        }
        var raidLine = '';
        if (t.status==='raided') {
          raidLine = '<div style="font-size:9px;color:#FF6B6B;margin-top:3px">🏴 Raided by '+escapeHtml(t.raider_nick||(t.raided_by||'').slice(0,8))+' · Lost '+(t.raid_loot_gp||0)+' GP</div>';
        }
        return '<div style="padding:10px;border-radius:7px;border:1px solid rgba(255,179,71,.18);background:rgba(255,179,71,.02);margin-bottom:8px">'
          + '<div style="display:flex;justify-content:space-between;align-items:center;gap:6px">'
          + '<div><div style="font-size:10px;color:var(--tx);font-weight:700">#'+t.id+' · '+escapeHtml(t.origin_name||('S'+t.origin_sector_id))+' → '+escapeHtml(t.dest_name||('S'+t.dest_sector_id))+'</div>'
          + '<div style="font-size:8px;color:var(--tx3);margin-top:2px">Cargo '+(t.cargo_value||0)+' GP · Reward +'+(t.reward_gp||0)+' GP'+(t.merchant_bonus?' · <span style="color:#FFB347">★MRC</span>':'')+'</div></div>'
          + '<div style="text-align:right"><div style="font-size:10px;color:'+statusColor+';font-weight:700">'+escapeHtml(t.status||'')+'</div>'
          + '<div style="font-size:8px;color:var(--tx3)">'+timeLine+'</div></div>'
          + '</div>'
          + bar
          + raidLine
          + actions
          + '</div>';
      }).join('');
    }).catch(function(){});
}

function cancelMyTransport(tid) {
  var w = (walletState && walletState.address) || '';
  if (!w) return;
  var doIt = function() {
    fetch('/api/transport/cancel', {
      method: 'POST',
      headers: Object.assign({'Content-Type':'application/json'},getAuthHeaders()),
      body: JSON.stringify({ transportId: tid })
    }).then(function(r){ return r.json(); }).then(function(d) {
      if (d.success) {
        showFactionToast('✓ '+(LANG==='ko'?'취소됨 — ':LANG==='ja'?'キャンセル — ':LANG==='zh'?'已取消 — ':'Cancelled — ')+d.refundedGp+' GP '+(LANG==='ko'?'환불':LANG==='ja'?'払戻':LANG==='zh'?'退款':'refunded'), 'success');
        loadMyTransports();
        if (typeof refreshGP === 'function') refreshGP();
      } else showFactionToast((LANG==='ko'?'취소 실패: ':LANG==='ja'?'キャンセル失敗: ':LANG==='zh'?'取消失败: ':'Cancel failed: ')+(d.error||'unknown'), 'error');
    });
  };
  gameConfirm({icon:'🚚',title:(LANG==='ko'?'수송 #':LANG==='ja'?'輸送 #':LANG==='zh'?'运输 #':'Transport #')+tid+(LANG==='ko'?' 취소':LANG==='ja'?' キャンセル':LANG==='zh'?' 取消':' Cancel'),body:LANG==='ko'?'화물은 환불되지만 완료 보상은 잃습니다.':LANG==='ja'?'貨物は返金されますが完了報酬は失われます。':LANG==='zh'?'货物将退款但完成奖励将丢失。':'Cargo will be refunded but completion reward will be lost.',confirmText:LANG==='ko'?'취소 확인':LANG==='ja'?'キャンセル確認':LANG==='zh'?'确认取消':'Confirm Cancel'}).then(function(ok){if(ok)doIt();});
}

function loadRaidTargets() {
  var w = (walletState && walletState.address) || '';
  if (!w) return;
  fetch('/api/transport/raids/targets?limit=30', { headers: getAuthHeaders() })
    .then(function(r){ return r.json(); })
    .then(function(d) {
      var list = document.getElementById('tspRaidList');
      if (!list) return;
      var rows = d.targets || [];
      if (!rows.length) { list.innerHTML = '<div style="color:var(--tx3);padding:10px;text-align:center" data-i18n="transport_raid_empty">No raidable shipments right now.</div>'; return; }
      list.innerHTML = rows.map(function(t) {
        var prog = parseInt(t.progress_pct)||0;
        var bar = '<div style="width:100%;height:4px;background:rgba(255,255,255,.08);border-radius:2px;overflow:hidden;margin-top:4px">'
          + '<div style="width:'+prog+'%;height:100%;background:linear-gradient(90deg,#FF6B6B,#cc2020)"></div></div>';
        return '<div style="padding:10px;border-radius:7px;border:1px solid rgba(255,107,107,.22);background:rgba(255,107,107,.03);margin-bottom:8px">'
          + '<div style="display:flex;justify-content:space-between;align-items:center;gap:6px">'
          + '<div><div style="font-size:10px;color:var(--tx);font-weight:700">#'+t.id+' · '+escapeHtml(t.origin_name||('S'+t.origin_sector_id))+' → '+escapeHtml(t.dest_name||('S'+t.dest_sector_id))+'</div>'
          + '<div style="font-size:8px;color:var(--tx3);margin-top:2px">Carrier: '+escapeHtml(t.carrier_nick||(t.carrier_wallet||'').slice(0,8))+(t.merchant_bonus?' <span style="color:#FFB347">★MRC</span>':'')+'</div>'
          + '<div style="font-size:8px;color:var(--gold);margin-top:2px">Cargo: '+(t.cargo_value||0)+' GP · Progress '+prog+'%</div></div>'
          + '<button onclick="submitRaidAttempt('+t.id+','+((t.cargo_value||0))+')" style="padding:8px 12px;font-size:10px;border-radius:5px;background:linear-gradient(135deg,#FF6B6B,#cc2020);border:none;color:#fff;font-weight:700;cursor:pointer" data-i18n="transport_raid_btn">🏴 RAID</button>'
          + '</div>' + bar
          + '</div>';
      }).join('');
    }).catch(function(){});
}

function submitRaidAttempt(tid, cargo) {
  var w = (walletState && walletState.address) || '';
  if (!w) { showFactionToast(t('err_connect_wallet')||'Connect wallet first', 'error'); return; }
  var doIt = function() {
    fetch('/api/transport/raid', {
      method: 'POST',
      headers: Object.assign({'Content-Type':'application/json'},getAuthHeaders()),
      body: JSON.stringify({ transportId: tid })
    }).then(function(r){ return r.json(); }).then(function(d) {
      if (d.success) {
        if (d.result === 'success') {
          showFactionToast('🏴 '+(LANG==='ko'?'약탈 성공! +':LANG==='ja'?'略奪成功! +':LANG==='zh'?'掠夺成功! +':'Raid success! +')+d.lootGp+' GP (roll '+d.roll+'/'+d.threshold+')', 'success');
          if (typeof refreshGP === 'function') refreshGP();
        } else {
          showFactionToast('✗ '+(LANG==='ko'?'약탈 실패':LANG==='ja'?'略奪失敗':LANG==='zh'?'掠夺失败':'Raid failed')+' (roll '+d.roll+'/'+d.threshold+') — '+(LANG==='ko'?'쿨다운 시작':LANG==='ja'?'CD開始':LANG==='zh'?'冷却开始':'Cooldown started'), 'error');
        }
        loadRaidTargets();
      } else {
        showFactionToast((LANG==='ko'?'약탈 실패: ':LANG==='ja'?'略奪失敗: ':LANG==='zh'?'掠夺失败: ':'Raid failed: ')+(d.error||'unknown'), 'error');
      }
    }).catch(function(e){ showFactionToast((LANG==='ko'?'네트워크 오류: ':LANG==='ja'?'ネットワークエラー: ':LANG==='zh'?'网络错误: ':'Network error: ')+e.message, 'error'); });
  };
  gameConfirm({icon:'🏴',title:(LANG==='ko'?'수송 #':LANG==='ja'?'輸送 #':LANG==='zh'?'运输 #':'Transport #')+tid+(LANG==='ko'?' 약탈':LANG==='ja'?' 略奪':LANG==='zh'?' 掠夺':' Raid'),body:(LANG==='ko'?'화물: ':LANG==='ja'?'貨物: ':LANG==='zh'?'货物: ':'Cargo: ')+'<b>'+cargo+' GP</b>. '+(LANG==='ko'?'수송당 1회 시도. 쿨다운 적용.':LANG==='ja'?'輸送ごとに1回試行。クールダウンあり。':LANG==='zh'?'每次运输仅限1次尝试，有冷却。':'One attempt per transport. Cooldown applies.'),confirmText:LANG==='ko'?'약탈':LANG==='ja'?'略奪':LANG==='zh'?'掠夺':'Raid'}).then(function(ok){if(ok)doIt();});
}

// ── FLEET COMMAND card loader (M-154 / MY TERRITORY 탭에 통합) ──
// Shipyard 모달을 별도 탭으로 빼면 컨텐츠가 너무 적어 — MY TERRITORY 안의
// 카드로 흡수. 함대 요약 + 조선소 진입 + 활성 Void Raider 이벤트만 표시.
async function loadFleetCommandCard(){
  // 1) 함대 요약 (총 함대 수 / 함선 수)
  try {
    var w = (walletState && walletState.address) || '';
    if (w) {
      var r = await fetch('/api/fleets', { headers: getAuthHeaders() });
      if (r.ok) {
        var d = await r.json();
        var summary = document.getElementById('fcmdSummary');
        if (summary && d.fleets) {
          var total = d.fleets.length;
          var ships = d.fleets.reduce(function(s,f){ return s + (parseInt(f.ships_alive)||parseInt(f.ship_count)||0); }, 0);
          summary.textContent = total + ' fleets · ' + ships + ' ships';
        }
      }
    }
  } catch(_) {}

  // 2) 활성 World Events (Void Raider 등)
  try {
    var wr = await fetch('/api/world-events');
    if (wr.ok) {
      var wd = await wr.json();
      var list = document.getElementById('fcmdWorldEventsList');
      if (list && wd.events) {
        if (wd.events.length === 0) {
          list.innerHTML = '<div style="text-align:center;color:var(--tx3);font-size:9px;padding:6px">' + (t('we_none_active')||'활성 이벤트가 없습니다') + '</div>';
        } else {
          list.innerHTML = wd.events.map(function(ev){
            var sec = parseInt(ev.seconds_remaining)||0;
            var hRem = Math.floor(sec/3600), mRem = Math.floor((sec%3600)/60);
            var pct = parseFloat(ev.hp_pct)||0;
            return '<div style="padding:8px 10px;border-radius:7px;background:linear-gradient(135deg,rgba(232,72,85,.10),rgba(232,72,85,.02));border:1px solid rgba(232,72,85,.25)">' +
              '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">' +
                '<div style="font-size:10px;font-weight:800;color:#ff6b6b">⚠ ' + (ev.event_code||'EVENT') + '</div>' +
                '<div style="font-size:8px;color:var(--tx3)">' + (ev.sector_name||'?') + ' · ' + hRem + 'h ' + mRem + 'm</div>' +
              '</div>' +
              '<div style="height:5px;background:rgba(255,255,255,.05);border-radius:3px;overflow:hidden;margin-bottom:4px">' +
                '<div style="height:100%;width:' + pct + '%;background:linear-gradient(90deg,#ff6b6b,#ff3030);transition:width .3s"></div>' +
              '</div>' +
              '<div style="display:flex;justify-content:space-between;align-items:center;gap:6px">' +
                '<div style="font-size:8px;color:var(--tx3)">HP ' + ev.hp_current + '/' + ev.hp_max + ' · ' + (ev.participant_count||0) + ' fighters</div>' +
                '<button onclick="openWorldEventDetail(' + ev.id + ')" style="font-size:9px;padding:3px 9px;border-radius:6px;background:rgba(232,72,85,.15);border:1px solid rgba(232,72,85,.4);color:#ff6b6b;cursor:pointer;font-family:var(--fn);font-weight:700" data-i18n="we_engage">⚔ ENGAGE</button>' +
              '</div>' +
            '</div>';
          }).join('');
        }
      }
    }
  } catch(e) { console.warn('[fcmd] world events error:', e); }
}
// 하위 호환: 기존 호출자(있다면)를 위한 alias
window.loadShipyardTabPane = loadFleetCommandCard;

// ── World Event Engage Modal ────────────────────────────────────
var _weCurrentEventId = null;

window.openWorldEventDetail = async function(eventId) {
  if (!isLoggedIn() && !(walletState && walletState.address)) {
    showFactionToast(t('daily_login_required')||tl('Login required to engage','로그인이 필요합니다','ログインが必要です','请先登录'),'error');
    return;
  }
  _weCurrentEventId = eventId;
  var modal = document.getElementById('weEngageModal');
  if (!modal) return;

  // 이벤트 상세 로드
  try {
    var r = await fetch('/api/world-events/' + eventId);
    if (!r.ok) throw new Error('fetch fail');
    var ev = await r.json();

    document.getElementById('weEventCode').textContent = '⚠ ' + (ev.event_code || 'EVENT');
    var sec = parseInt(ev.seconds_remaining) || 0;
    document.getElementById('weEventTimer').textContent = Math.floor(sec/3600) + 'h ' + Math.floor((sec%3600)/60) + 'm';
    var pct = parseFloat(ev.hp_pct) || 0;
    document.getElementById('weHpBar').style.width = pct + '%';
    document.getElementById('weHpText').textContent = 'HP ' + Number(ev.hp_current).toLocaleString() + '/' + Number(ev.hp_max).toLocaleString();
    document.getElementById('weParticipants').textContent = (ev.participant_count || 0) + ' fighters';
    var meta = ev.meta || {};
    document.getElementById('weEventMeta').textContent = (ev.sector_name || '?') + ' · ' + (ev.sector_tier || '') + ' · ' + (meta.ship_count || '?') + '× ' + (meta.ship_name_ko || meta.ship_type_code || '?');
  } catch(e) {
    document.getElementById('weEventCode').textContent = '⚠ EVENT #' + eventId;
    document.getElementById('weEventMeta').textContent = LANG==='ko'?'정보를 불러올 수 없습니다':LANG==='ja'?'情報を読み込めません':LANG==='zh'?'无法加载信息':'Failed to load info';
  }

  // 내 함대 목록 로드
  var sel = document.getElementById('weFleetSelect');
  sel.innerHTML = '<option value="">'+(LANG==='ko'?'함대 선택...':LANG==='ja'?'艦隊を選択...':LANG==='zh'?'选择舰队...':'Select fleet...')+'</option>';
  try {
    var w = (walletState && walletState.address) || '';
    if (w) {
      var fr = await fetch('/api/fleets', { headers: getAuthHeaders() });
      if (fr.ok) {
        var fd = await fr.json();
        (fd.fleets || []).forEach(function(f) {
          var ships = parseInt(f.ships_alive) || parseInt(f.ship_count) || parseInt(f.alive_ships) || 0;
          if (ships < 1) return; // 함선 없는 함대 제외
          var opt = document.createElement('option');
          opt.value = f.id;
          opt.textContent = (f.name || (LANG==='ko'?'함대 #':LANG==='ja'?'艦隊 #':LANG==='zh'?'舰队 #':'Fleet #') + f.id) + ' · ' + ships + (LANG==='ko'?'척':LANG==='ja'?'隻':LANG==='zh'?'艘':' ships');
          sel.appendChild(opt);
        });
        document.getElementById('weFleetNote').textContent = sel.options.length <= 1
          ? (LANG==='ko'?'출전 가능한 함대가 없습니다 (함선 1척 이상 필요)':LANG==='ja'?'出撃可能な艦隊がありません（艦船1隻以上必要）':LANG==='zh'?'没有可出击的舰队（需要至少1艘舰船）':'No deployable fleet (need at least 1 ship)')
          : (LANG==='ko'?'선택한 함대를 Void Raider에 출전시킵니다':LANG==='ja'?'選択した艦隊をVoid Raiderに出撃させます':LANG==='zh'?'将选定舰队出击至Void Raider':'Deploy selected fleet against the Void Raider');
      }
    }
  } catch(e) {}

  modal.style.display = 'flex';
};

function closeWeModal() {
  var modal = document.getElementById('weEngageModal');
  if (modal) modal.style.display = 'none';
  _weCurrentEventId = null;
}

async function confirmWeEngage() {
  var eventId = _weCurrentEventId;
  var fleetId = document.getElementById('weFleetSelect').value;
  if (!eventId) return;
  if (!fleetId) { showToast(LANG==='ko'?'함대를 선택하세요':LANG==='ja'?'艦隊を選択してください':LANG==='zh'?'请选择舰队':'Select a fleet', 'warn'); return; }

  var btn = document.getElementById('weEngageBtn');
  btn.disabled = true;
  btn.textContent = LANG==='ko'?'출전 중...':LANG==='ja'?'出撃中...':LANG==='zh'?'出击中...':'Deploying...';

  try {
    var r = await fetch('/api/world-events/' + eventId + '/engage', {
      method: 'POST',
      headers: Object.assign({ 'Content-Type': 'application/json' }, getAuthHeaders()),
      body: JSON.stringify({ fleet_id: parseInt(fleetId) })
    });
    var d = await r.json();
    if (!r.ok || d.error) {
      var errMap = LANG==='ja'?{
        'FLEET_BUSY':'艦隊はすでに戦闘中です',
        'INSUFFICIENT_SHIPS':'艦船が不足しています（最低1隻）',
        'ENGAGE_COOLDOWN':'クールダウン中 — '+(d.meta&&d.meta.remaining_minutes?d.meta.remaining_minutes+'分後に可能':'しばらくお待ちください'),
        'EVENT_NOT_ENGAGEABLE':'すでに終了したイベントです',
        'EVENT_EXPIRED':'イベントが期限切れです',
        'FLEET_NOT_FOUND':'艦隊が見つかりません',
      }:LANG==='zh'?{
        'FLEET_BUSY':'舰队已在战斗中',
        'INSUFFICIENT_SHIPS':'舰船不足（至少1艘）',
        'ENGAGE_COOLDOWN':'冷却中 — '+(d.meta&&d.meta.remaining_minutes?d.meta.remaining_minutes+'分钟后可用':'请稍后再试'),
        'EVENT_NOT_ENGAGEABLE':'事件已结束',
        'EVENT_EXPIRED':'事件已过期',
        'FLEET_NOT_FOUND':'找不到舰队',
      }:LANG==='en'?{
        'FLEET_BUSY':'Fleet is already in battle',
        'INSUFFICIENT_SHIPS':'Insufficient ships (min 1)',
        'ENGAGE_COOLDOWN':'On cooldown — '+(d.meta&&d.meta.remaining_minutes?'available in '+d.meta.remaining_minutes+' min':'try again later'),
        'EVENT_NOT_ENGAGEABLE':'Event already ended',
        'EVENT_EXPIRED':'Event has expired',
        'FLEET_NOT_FOUND':'Fleet not found',
      }:{
        'FLEET_BUSY':'함대가 이미 전투 중입니다',
        'INSUFFICIENT_SHIPS':'함선이 부족합니다 (최소 1척)',
        'ENGAGE_COOLDOWN':'쿨다운 중 — '+(d.meta&&d.meta.remaining_minutes?d.meta.remaining_minutes+'분 후 가능':'잠시 후 시도'),
        'EVENT_NOT_ENGAGEABLE':'이미 종료된 이벤트입니다',
        'EVENT_EXPIRED':'이벤트가 만료됐습니다',
        'FLEET_NOT_FOUND':'함대를 찾을 수 없습니다',
      };
      throw new Error(errMap[d.error] || d.error || (LANG==='ko'?'교전 실패':LANG==='ja'?'交戦失敗':LANG==='zh'?'交战失败':'Engage failed'));
    }

    closeWeModal();
    var result;
    if (d.status === 'defeated') result = LANG==='ko'?'🎉 Void Raider 격퇴 성공! 보상이 지급됩니다':LANG==='ja'?'🎉 Void Raider撃退成功！報酬が支給されます':LANG==='zh'?'🎉 Void Raider击败成功！奖励已发放':'🎉 Void Raider defeated! Rewards issued';
    else result = (LANG==='ko'?'전투 완료! 데미지 ':LANG==='ja'?'戦闘完了！ダメージ ':LANG==='zh'?'战斗完成！伤害 ':'Combat complete! Damage ')+(d.damage_dealt||0).toLocaleString()+(LANG==='ko'?' · HP '+(d.hp_pct||0)+'% 잔여':LANG==='ja'?' · HP '+(d.hp_pct||0)+'% 残存':LANG==='zh'?' · HP '+(d.hp_pct||0)+'% 剩余':' · HP '+(d.hp_pct||0)+'% remaining');
    showToast(result, d.status === 'defeated' ? 'success' : 'info');
    // 함대 지휘부 카드 갱신
    if (typeof loadFleetCommandCard === 'function') _setActiveTimeout(loadFleetCommandCard, 800);
  } catch(e) {
    showToast(e.message || (LANG==='ko'?'교전 실패':LANG==='ja'?'交戦失敗':LANG==='zh'?'交战失败':'Engage failed'), 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = '⚔ ENGAGE';
  }
}

var _mktSectorsPopulated=false;
function populateMktSectorFilter(){
  if(_mktSectorsPopulated) return;
  var sel=document.getElementById('mktFilterSector');
  if(!sel) return;
  _mktSectorsPopulated=true;
  fetch('/api/sectors/control').then(function(r){return r.json()}).then(function(d){
    var secs=(d&&d.sectors)||[];
    if(!secs.length) return;
    // tier 순(frontier→mid→core)으로 정렬해 보기 좋게
    var order={frontier:0,mid:1,core:2};
    secs.sort(function(a,b){ return (order[a.tier]||9)-(order[b.tier]||9) || String(a.name||'').localeCompare(String(b.name||'')); });
    var cur=sel.value;
    var icon={frontier:'🟢',mid:'🟡',core:'🔴'};
    sel.innerHTML='<option value="">🌐 ALL SECTORS</option>'+secs.map(function(s){
      return '<option value="'+s.id+'">'+(icon[s.tier]||'•')+' '+(s.name||('Sector '+s.id))+'</option>';
    }).join('');
    if(cur) sel.value=cur;
  }).catch(function(){ _mktSectorsPopulated=false; });
}
function loadMarketListings(){
  // [v7.176] 통합 마켓 — type='ship' 분기 추가. 함선은 별도 ship_market_listings 시스템이라
  //   /api/ships/market/listings 호출 후 renderShipMarketCard 로 같은 그리드에 렌더.
  //   이전엔 함선이 마켓에 안 나와 거래 동선이 두 곳(조선소·일반 마켓)으로 갈렸음.
  var grid=document.getElementById('mktBrowseGrid');
  grid.innerHTML='<div style="grid-column:1/-1;text-align:center;color:var(--tx3);padding:32px 0;font-size:10px">Loading...</div>';
  populateMktSectorFilter();
  var type=document.getElementById('mktFilterType').value;
  var sort=document.getElementById('mktFilterSort').value;
  var search=(document.getElementById('mktSearch').value||'').trim();
  var sectorEl=document.getElementById('mktFilterSector');
  var sector=sectorEl?sectorEl.value:'';

  // [v7.176] 함선 카테고리 — 별도 시스템 호출
  if (type === 'ship') {
    // [v7.178 Phase 3] 마켓 stats chip + 검색 통합 + sparkline 인프라
    Promise.all([
      fetch('/api/ships/market/listings', { headers: getAuthHeaders() }).then(function(r){return r.ok?r.json():null;}).catch(function(){return null;}),
      fetch('/api/ships/market/stats').then(function(r){return r.ok?r.json():null;}).catch(function(){return null;})
    ]).then(function(results){
      var d = results[0], stats = results[1];
      var ships = (d && d.listings) || [];
      // 검색 적용 — 함선 코드 또는 이름에 부분 매칭
      var q = (search||'').toLowerCase().trim();
      if (q) ships = ships.filter(function(s){
        var nm = (typeof syShipName==='function')?syShipName(s).toLowerCase():'';
        return ((s.ship_type_code||'').toLowerCase().indexOf(q)>=0) ||
               ((s.class_label||'').toLowerCase().indexOf(q)>=0) ||
               (nm.indexOf(q)>=0);
      });
      // stats chip
      var statsBar = stats ? ('<div style="grid-column:1/-1;display:flex;gap:8px;margin-bottom:6px;flex-wrap:wrap"><div style="font-size:9px;padding:4px 9px;border-radius:12px;background:rgba(184,140,255,.12);border:1px solid rgba(184,140,255,.4);color:#caa8ff;font-weight:700">🚀 '+tl('Active','활성','活性','活跃')+': '+(stats.active_listings||0)+'</div><div style="font-size:9px;padding:4px 9px;border-radius:12px;background:rgba(255,209,102,.1);border:1px solid rgba(255,209,102,.35);color:#ffd166;font-weight:700">📊 '+tl('7d sales','7일 거래','7日取引','7天交易')+': '+(stats.sales_7d||0)+'</div><div style="font-size:9px;padding:4px 9px;border-radius:12px;background:rgba(105,240,174,.1);border:1px solid rgba(105,240,174,.35);color:#69f0ae;font-weight:700">💰 '+(stats.volume_gp_7d||0).toLocaleString()+' GP</div></div>') : '';
      if (!ships.length) { grid.innerHTML = statsBar + '<div style="grid-column:1/-1;text-align:center;color:var(--tx3);padding:32px 0;font-size:10px">'+(t('mkt_empty')||'No ship listings')+'</div>'; return; }
      // 정렬 적용
      ships = ships.slice();
      if (sort === 'price_asc')  ships.sort(function(a,b){return (parseFloat(a.price_gp||0))-(parseFloat(b.price_gp||0));});
      else if (sort === 'price_desc') ships.sort(function(a,b){return (parseFloat(b.price_gp||0))-(parseFloat(a.price_gp||0));});
      else                       ships.sort(function(a,b){return (parseInt(b.listing_id||0))-(parseInt(a.listing_id||0));});
        // [v7.177 Phase 2] 마켓 함선 카드 — 인라인 구매 흐름. 클릭 시 확인 모달 → buy API 직접 호출.
        //   이전엔 조선소로 이동 강제했음.
        grid.innerHTML = statsBar + ships.map(function(s){
          var portrait = 'assets/ships/reveal/' + (s.ship_type_code||'') + '.jpg';
          var nm = (typeof syShipName==='function') ? syShipName(s) : (s.name_ko||s.ship_type_code||'Ship');
          var qm = (typeof _crateQualityMeta!=='undefined' && s.quality) ? _crateQualityMeta[s.quality] : null;
          var qBadge = (qm && qm.stars > 0) ? '<span style="position:absolute;top:5px;left:5px;font-size:9px;font-weight:900;color:'+qm.col+';background:rgba(20,18,28,.92);border:1px solid '+qm.col+'80;padding:2px 6px;border-radius:5px">'+('★'.repeat(qm.stars))+'</span>' : '';
          return '<div class="mkt-card" onclick="openMarketShipBuy('+(s.listing_id||0)+',\''+escapeHtmlSafe(nm).replace(/\047/g,"\\\047")+'\','+(parseInt(s.price_gp)||0)+',\''+(s.ship_type_code||'')+'\',\''+(s.faction_code||'')+'\')" style="background:var(--surface1);border:1px solid rgba(184,140,255,.35);border-radius:8px;overflow:hidden;cursor:pointer;display:flex;flex-direction:column">'
            + '<div style="position:relative;aspect-ratio:4/3;background:#0a0e1a;overflow:hidden">'
            +   '<img src="'+portrait+'" alt="" style="width:100%;height:100%;object-fit:cover" onerror="this.style.display=\'none\'">'
            +   qBadge
            +   '<div style="position:absolute;top:5px;right:5px;font-size:8px;font-weight:800;background:rgba(184,140,255,.85);color:#fff;padding:2px 6px;border-radius:4px">🚀 SHIP</div>'
            +   '<div style="position:absolute;left:0;right:0;bottom:0;height:40%;background:linear-gradient(180deg,transparent,rgba(6,8,15,.8));pointer-events:none"></div>'
            + '</div>'
            + '<div style="padding:7px 8px"><div style="font-size:10px;font-weight:800;color:'+(s.faction_color||'#fff')+'">'+escapeHtmlSafe(nm)+'</div>'
            + '<div style="font-size:8px;color:var(--tx3);margin-top:1px">'+escapeHtmlSafe(s.class_label||s.size_class||'')+'</div>'
            + '<div style="font-size:11px;font-weight:900;color:#ffd166;margin-top:3px">'+(parseInt(s.price_gp)||0).toLocaleString()+' GP</div></div>'
            + '</div>';
        }).join('');
      })
      .catch(function(){ grid.innerHTML='<div style="grid-column:1/-1;text-align:center;color:var(--red);font-size:10px">'+tl('Failed to load','불러오기 실패','読み込み失敗','加载失败')+'</div>'; });
    return;
  }

  var url='/api/marketplace/listings?sort='+sort+'&limit=40';
  if(type) url+='&type='+type;
  if(sector) url+='&sectorId='+encodeURIComponent(sector);
  if(search) url+='&search='+encodeURIComponent(search);
  fetch(url).then(function(r){return r.json()}).then(function(d){
    var items=d.listings||[];
    if(!items.length){
      grid.innerHTML='<div style="grid-column:1/-1;text-align:center;color:var(--tx3);padding:32px 0;font-size:10px">'+(t('mkt_empty')||'No listings found')+'</div>';
      return;
    }
    grid.innerHTML=items.map(function(l){ return renderMarketCard(l); }).join('');
  }).catch(function(){grid.innerHTML='<div style="grid-column:1/-1;text-align:center;color:var(--red);font-size:10px">'+tl('Failed to load','불러오기 실패','読み込み失敗','加载失败')+'</div>'});
}

function loadRecentSales(){
  var el=document.getElementById('mktRecentSalesGrid');
  if(!el) return;
  fetch('/api/marketplace/recent-sales?limit=10')
    .then(function(r){return r.json()})
    .then(function(d){
      var sales=(d.sales||d.recent||[]);
      if(!sales.length){
        el.innerHTML='<div style="text-align:center;color:var(--tx3);padding:8px;font-size:9px">'+(t('mkt_no_sales')||'No recent sales')+'</div>';
        return;
      }
      el.innerHTML=sales.map(function(s){
        var meta=s.meta||{};
        var icon=meta.itemIcon||'🗺️';
        var name=meta.itemName||(s.listing_type==='claim'?'Territory':'Item');
        var enh=meta.enhancementLevel>0?' <span style="color:var(--gold);font-weight:800">+'+meta.enhancementLevel+'</span>':'';
        var ago=Math.round((Date.now()-new Date(s.sold_at))/60000);
        var agoStr=ago<60?ago+'m':(Math.floor(ago/60)+'h');
        return '<div style="display:flex;justify-content:space-between;align-items:center;padding:5px 8px;background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.04);border-radius:6px">'
          +'<span style="font-size:9px;color:var(--tx2)">'+icon+' '+name+enh+'</span>'
          +'<div style="display:flex;align-items:center;gap:8px">'
          +'<span style="font-size:10px;font-weight:800;color:var(--gold)">'+parseFloat(s.sale_price||s.price).toLocaleString()+'</span>'
          +'<span style="font-size:8px;color:var(--tx3)">'+s.currency+'</span>'
          +'<span style="font-size:8px;color:var(--tx3)">'+agoStr+'</span>'
          +'</div></div>';
      }).join('');
    }).catch(function(){
      if(el) el.innerHTML='';
    });
}

function renderMarketCard(l){
  var meta=l.meta||{};
  // ✅ [Resource System] 자원 타입 처리
  var isResource=l.listing_type==='resource';
  var icon=isResource?(meta.resourceIcon||'⛏️'):meta.itemIcon||'🗺️';
  var name=isResource?((meta.resourceName||l.resource_code||'Resource')+' ×'+(l.resource_quantity||meta.resourceQty||1))
    :(meta.itemName||(l.listing_type==='claim'?'Territory #'+l.claim_id:'Item'));
  var enhLv=meta.enhancementLevel||0;
  var enhTag=enhLv>0?_enhBadge(enhLv):'';
  var typeLabel=l.listing_type==='claim'?'🗺️':isResource?'⛏️':'🎨';
  var rarityColor=isResource?{common:'var(--tx2)',rare:'var(--cyan)',special:'var(--gold)'}[meta.rarity||'common']:'#a064dc';
  var price=parseFloat(l.price);
  var currency=l.currency||'GP';
  var seller=l.seller_name||((l.seller||'').slice(0,6)+'…');
  var remaining=Math.max(0,Math.round((new Date(l.expires_at)-Date.now())/3600000));
  var timeStr=remaining>24?Math.floor(remaining/24)+'d':remaining+'h';
  var isOwn=walletState&&walletState.address&&l.seller===walletState.address.toLowerCase();
  var claimInfo='';
  if(l.listing_type==='claim'&&meta.pixelCount) claimInfo='<div style="font-size:8px;color:var(--tx3)">'+meta.pixelCount+' px</div>';
  // Price history chart trigger params
  var chartParam=l.listing_type==='claim'?'claimId='+l.claim_id:'itemTypeId='+(meta.itemTypeId||0)+'&enhLevel='+enhLv;
  return '<div class="'+_enhGlowClass(enhLv)+'" style="background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.08);border-radius:8px;padding:10px;display:flex;flex-direction:column;gap:4px">'
    +'<div style="display:flex;justify-content:space-between;align-items:center">'
    +'<span style="font-size:10px;font-weight:700;color:'+rarityColor+'">'+icon+' '+name+enhTag+'</span>'
    +'<button onclick="showMarketDetail('+l.id+',\''+chartParam+'\',\''+name.replace(/'/g,"\\'")+'\')" style="font-size:8px;color:var(--tx3);background:none;border:none;cursor:pointer;padding:2px 4px;font-family:var(--fn)" title="Price history">📊</button>'
    +'</div>'
    +claimInfo
    +'<div style="display:flex;justify-content:space-between;align-items:center;margin-top:auto">'
    +'<div><span style="font-size:12px;font-weight:800;color:var(--gold)">'+price+'</span> <span style="font-size:9px;color:var(--tx3)">'+currency+'</span></div>'
    +'<div style="font-size:8px;color:var(--tx3)">'+seller+' · '+timeStr+'</div>'
    +'</div>'
    +'<div style="display:flex;justify-content:flex-end;gap:4px;margin-top:4px">'
    +(isOwn?'<button onclick="cancelMarketListing('+l.id+')" style="font-size:9px;font-weight:700;padding:4px 10px;border-radius:4px;border:1px solid rgba(232,72,85,.4);background:rgba(232,72,85,.1);color:var(--red);cursor:pointer;font-family:var(--fn)">'+(t('mkt_cancel')||'CANCEL')+'</button>'
    :'<button onclick="buyMarketListing('+l.id+','+price+',\''+currency+'\',\''+name.replace(/'/g,"\\'")+'\')" style="font-size:9px;font-weight:700;padding:4px 10px;border-radius:4px;border:1px solid rgba(160,100,220,.45);background:rgba(160,100,220,.12);color:#a064dc;cursor:pointer;font-family:var(--fn)">'+(t('mkt_buy')||'BUY')+'</button>')
    +'</div></div>';
}

// ── Market Price History Detail (Migration 103) ──
function _renderSparkline(points, width, height){
  if(!points||points.length<2) return '<div style="font-size:8px;color:var(--tx3);text-align:center;padding:8px">No history yet</div>';
  var prices=points.map(function(p){return p.price});
  var mn=Math.min.apply(null,prices), mx=Math.max.apply(null,prices);
  var range=mx-mn||1;
  var pad=4;
  var W=width-pad*2, H=height-pad*2;
  var pts=points.map(function(p,i){
    var x=pad+i*(W/(points.length-1));
    var y=pad+H-(p.price-mn)/range*H;
    return x.toFixed(1)+','+y.toFixed(1);
  });
  // Trend color: last price vs first
  var trendUp=prices[prices.length-1]>=prices[0];
  var lineColor=trendUp?'var(--gn)':'var(--red)';
  // Filled area path
  var areaPath='M'+pts[0]+' L'+pts.join(' L')
    +' L'+(pad+W).toFixed(1)+','+(pad+H).toFixed(1)
    +' L'+pad+','+(pad+H).toFixed(1)+' Z';
  var linePath='M'+pts[0]+' L'+pts.join(' L');
  return '<svg viewBox="0 0 '+width+' '+height+'" style="width:100%;height:'+height+'px;display:block">'
    +'<defs><linearGradient id="spgr" x1="0" y1="0" x2="0" y2="1">'
    +'<stop offset="0%" stop-color="'+lineColor+'" stop-opacity=".3"/>'
    +'<stop offset="100%" stop-color="'+lineColor+'" stop-opacity=".0"/>'
    +'</linearGradient></defs>'
    +'<path d="'+areaPath+'" fill="url(#spgr)"/>'
    +'<path d="'+linePath+'" fill="none" stroke="'+lineColor+'" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/>'
    // Last price dot
    +'<circle cx="'+(pad+W).toFixed(1)+'" cy="'+(pad+H-(prices[prices.length-1]-mn)/range*H).toFixed(1)+'" r="3" fill="'+lineColor+'"/>'
    +'</svg>';
}

function showMarketDetail(listingId, chartParam, name){
  // Show a gameConfirm-style modal with price history
  var dlg=document.createElement('div');
  dlg.id='mktDetailDlg';
  dlg.style.cssText='position:fixed;inset:0;z-index:10000;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.7)';
  dlg.innerHTML='<div style="background:var(--surface1);border:1px solid rgba(255,255,255,.1);border-radius:12px;padding:16px;width:min(340px,calc(100vw - 32px));max-height:80vh;overflow-y:auto">'
    +'<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">'
    +'<span style="font-size:11px;font-weight:700;color:#a064dc">📊 '+(name||'Price History')+'</span>'
    +'<button onclick="document.getElementById(\'mktDetailDlg\').remove()" style="background:none;border:none;color:var(--tx3);cursor:pointer;font-size:14px">✕</button>'
    +'</div>'
    +'<div id="mktDetailChart" style="width:100%;min-height:80px;display:flex;align-items:center;justify-content:center">'
    +'<div style="font-size:9px;color:var(--tx3)">Loading chart...</div>'
    +'</div>'
    +'<div id="mktDetailStats" style="margin-top:10px;display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px"></div>'
    +'</div>';
  document.body.appendChild(dlg);
  dlg.onclick=function(e){if(e.target===dlg) dlg.remove();};

  fetch('/api/marketplace/price-stats?'+chartParam+'&points=20')
    .then(function(r){return r.json()})
    .then(function(d){
      var chartEl=document.getElementById('mktDetailChart');
      var statsEl=document.getElementById('mktDetailStats');
      if(!chartEl||!statsEl) return;
      if(!d.points||!d.points.length){
        chartEl.innerHTML='<div style="font-size:9px;color:var(--tx3);padding:12px;text-align:center">No sales history yet.</div>';
      } else {
        chartEl.innerHTML=_renderSparkline(d.points, 300, 80);
      }
      var currency=(d.points&&d.points[0]&&d.points[0].currency)||'GP';
      statsEl.innerHTML=[
        {k:'SALES',v:d.count||0},
        {k:'AVG',v:d.avg?(Math.round(d.avg)+' '+currency):'—'},
        {k:'MIN',v:d.min?(Math.round(d.min)+' '+currency):'—'},
        {k:'MAX',v:d.max?(Math.round(d.max)+' '+currency):'—'},
        {k:'7D AVG',v:d.avg7d?(Math.round(d.avg7d)+' '+currency):'—'},
      ].map(function(s){
        return '<div style="background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.06);border-radius:6px;padding:6px;text-align:center">'
          +'<div style="font-size:7px;color:var(--tx3);letter-spacing:.5px">'+s.k+'</div>'
          +'<div style="font-size:10px;font-weight:700;color:var(--gold)">'+s.v+'</div>'
          +'</div>';
      }).join('');
    }).catch(function(){
      var chartEl=document.getElementById('mktDetailChart');
      if(chartEl) chartEl.innerHTML='<div style="font-size:9px;color:var(--red);padding:8px">'+tl('Failed to load.','불러오기 실패.','読み込み失敗。','加载失败。')+'</div>';
    });
}

function buyMarketListing(listingId,price,currency,name){
  var w=(walletState&&walletState.address)||'';
  if(!w){showToast('Connect wallet first','error');return;}
  var myBal=currency==='GP'?(walletState.gameGP||0):(walletState.gamePP||0);
  var insufficient=myBal<price;
  function fmt(v){
    var n=parseFloat(v);
    if(!isFinite(n)) n=0;
    return n.toLocaleString(undefined,{maximumFractionDigits:2});
  }
  function openConfirm(quote){
    var info=[
      {k:t('mkt_price')||'Price',v:fmt(price)+' '+currency},
      {k:t('mkt_your_balance')||'Your Balance',v:Math.floor(myBal).toLocaleString()+' '+currency,insufficient:insufficient}
    ];
    if(quote){
      info.push({k:'Buyer pays',v:fmt(quote.buyerPays||price)+' '+currency});
      info.push({k:'Sale fee',v:fmt(quote.fee)+' '+currency});
      if(quote.sectorId){
        var tariffLabel=quote.tariffAmount>0
          ? fmt(quote.tariffAmount)+' '+currency+' → Sector #'+quote.sectorId
          : (quote.tariffExempted?'Exempted':'None');
        info.push({k:'Sector tariff',v:tariffLabel});
      }
      info.push({k:'Seller receives',v:fmt(quote.sellerReceives)+' '+currency});
    } else {
      info.push({k:'Settlement',v:'Server quote unavailable'});
    }
    gameConfirm({
      title:t('mkt_buy_title')||'Purchase Item', icon:'🛒',
      body:name,
      info:info,
      confirmText:t('mkt_buy_confirm')||'BUY NOW', disabled:insufficient
    }).then(function(ok){
      if(!ok) return;
      fetch('/api/marketplace/buy',{method:'POST',headers:Object.assign({'Content-Type':'application/json'},getAuthHeaders()),body:JSON.stringify({wallet:w,listingId:listingId})})
      .then(function(r){return r.json()}).then(function(d){
        if(d.error){showToast(srvErr(d.error),'error');return;}
        showToast('✅ '+(t('mkt_bought')||'Purchase successful!'),'success');
        refreshBalance(); loadMarketListings();
      }).catch(function(){showToast('Purchase failed','error')});
    });
  }
  fetch('/api/marketplace/listings/'+encodeURIComponent(listingId)+'/purchase-quote',{headers:getAuthHeaders()})
    .then(function(r){return r.ok?r.json():null})
    .then(openConfirm)
    .catch(function(){openConfirm(null)});
}

function cancelMarketListing(listingId){
  var w=(walletState&&walletState.address)||'';
  gameConfirm({
    title:t('mkt_cancel_title')||'Cancel Listing', icon:'🗑️',
    body:t('mkt_cancel_body')||'Cancel this listing and return the item to your inventory?',
    info:[], confirmText:t('mkt_cancel_confirm')||'CANCEL LISTING'
  }).then(function(ok){
    if(!ok) return;
    fetch('/api/marketplace/cancel',{method:'POST',headers:Object.assign({'Content-Type':'application/json'},getAuthHeaders()),body:JSON.stringify({wallet:w,listingId:listingId})})
    .then(function(r){return r.json()}).then(function(d){
      if(d.error){showToast(srvErr(d.error),'error');return;}
      showToast('✅ '+(t('mkt_cancelled')||'Listing cancelled'));
      loadMarketListings(); loadItemInstances();
    }).catch(function(){showToast('Cancel failed','error')});
  });
}

function loadSellView(){
  var el=document.getElementById('mktSellView');
  var w=(walletState&&walletState.address)||'';
  if(!w){el.innerHTML='<div style="text-align:center;color:var(--tx3);padding:20px;font-size:10px">Connect wallet first</div>';return;}
  el.innerHTML='<div style="text-align:center;color:var(--tx3);padding:20px;font-size:10px">Loading...</div>';

  // ── 아이템만 API에서, 영토는 이미 로컬에 있는 _ownerGroups 사용 ──
  fetch('/api/items/instances', { headers: getAuthHeaders() }).then(function(r){return r.json()}).catch(function(){return []}).then(function(instances){
    instances=Array.isArray(instances)?instances:(instances||[]);
    var html='';

    // ── TERRITORIES: _ownerGroups 기반 (BASE 내 영토 탭과 동일 로직) ──
    html+='<div style="font-size:10px;color:var(--mars);font-weight:800;letter-spacing:.5px;margin-bottom:6px">🗺️ '+(t('mkt_sellable_terr')||'MY TERRITORIES')+'</div>';
    var myGroups=_ownerGroups[w.toLowerCase()]||_ownerGroups[w]||[];
    // fallback: _ownerGroups 비어 있으면 claims에서 직접 필터
    var myClaims=(window.claims||[]).filter(function(c){return (c.owner||'').toLowerCase()===w.toLowerCase();});
    var entries=[];
    if(myGroups.length>0){
      myGroups.forEach(function(grp){
        var ec=grp.claimIndices.map(function(ci){return claims[ci];}).filter(Boolean);
        if(ec.length>0) entries.push({claims:ec,group:grp});
      });
    } else {
      myClaims.forEach(function(c){entries.push({claims:[c],group:null});});
    }

    if(!entries.length){
      html+='<div style="text-align:center;color:var(--tx3);padding:10px 0 14px;font-size:10px">'+(t('mkt_no_territories')||'No territories owned.')+'</div>';
    }else{
      html+='<div style="display:flex;flex-direction:column;gap:4px;margin-bottom:12px">';
      entries.forEach(function(entry,i){
        var ec=entry.claims;
        var b=entry.group?entry.group.bounds:null;
        var centerLat=b?(b.minLat+b.maxLat)/2:ec[0].lat;
        var centerLng=b?(b.minLng+b.maxLng)/2:ec[0].lng;
        var totalPx=(b&&b.count)||ec.reduce(function(s,c){return s+(c._pixelCount||c.pixel_count||((c.w||c.size||10)*(c.h||c.size||10)));},0);
        var subLabel=ec.length>1?' <span style="color:var(--gold);font-size:8px">('+ec.length+' merged)</span>':'';
        var anyLocked=ec.some(function(c){return _forSaleMap[c.id];});
        var anyAuction=ec.some(function(c){var f=_forSaleMap[c.id];return f&&f.saleType==='auction';});
        var primaryId=ec[0].id;
        var coordStr=centerLat.toFixed(1)+'°, '+centerLng.toFixed(1)+'°';
        html+='<div style="background:rgba(255,120,60,.04);border:1px solid rgba(255,120,60,'+(anyLocked?'.3':'.1')+');border-radius:8px;padding:8px 10px;display:flex;justify-content:space-between;align-items:center;gap:8px">';
        html+='<div style="flex:1;min-width:0">';
        html+='<div style="font-size:10px;color:var(--tx2);font-weight:700">#'+(i+1)+' · '+coordStr+subLabel+'</div>';
        html+='<div style="font-size:8px;color:var(--tx3);margin-top:1px">'+totalPx+'px · '+(ec.some(function(c){return c.imgUrl;})?'📷':'🏴 No image')+'</div>';
        html+='</div>';
        if(anyLocked){
          html+='<div style="font-size:8px;color:#4cd89a;font-weight:700;white-space:nowrap">'+( anyAuction?'🔨 AUCTION':'💰 FOR SALE')+'</div>';
        }else{
          html+='<button type="button" onclick="openListModal(\'claim\','+primaryId+',\'Territory #'+primaryId+'\',\'🗺️\',0)" style="font-size:8px;font-weight:700;padding:4px 10px;border-radius:4px;border:1px solid rgba(255,120,60,.4);background:rgba(255,120,60,.1);color:var(--mars);cursor:pointer;font-family:var(--fn);white-space:nowrap">💰 '+(t('mkt_list_sell')||'SELL')+'</button>';
        }
        html+='</div>';
      });
      html+='</div>';
    }

    // ── ITEMS section ──
    html+='<div style="font-size:10px;color:var(--gold);font-weight:800;letter-spacing:.5px;margin-bottom:6px;border-top:1px solid rgba(255,255,255,.06);padding-top:10px">📦 '+(t('mkt_sellable_items')||'SELLABLE ITEMS')+'</div>';
    if(!instances||!instances.length){
      html+='<div style="text-align:center;color:var(--tx3);padding:10px 0;font-size:10px">'+(t('mkt_no_items')||'No items to sell. Materialize cosmetics from SHOP → MY ITEMS first.')+'</div>';
    }else{
      html+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">';
      instances.forEach(function(inst){
        var lv=inst.enhancement_level||0;
        html+='<div class="'+_enhGlowClass(lv)+'" style="background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.08);border-radius:8px;padding:10px;display:flex;flex-direction:column;gap:4px">'
          +'<div style="font-size:10px;font-weight:700;color:'+_enhLevelColor(lv)+'">'+(inst.icon||'🎨')+' '+(inst.name||'Item')+_enhBadge(lv)+'</div>'
          +'<button type="button" onclick="openListModal(\'cosmetic\','+inst.id+',\''+(inst.name||'').replace(/'/g,"\\'")+'\','+(inst.icon?'\''+inst.icon+'\'':'null')+','+lv+')" style="font-size:9px;font-weight:700;padding:5px 10px;border-radius:4px;border:1px solid rgba(160,100,220,.45);background:rgba(160,100,220,.12);color:#a064dc;cursor:pointer;font-family:var(--fn);margin-top:auto">💰 '+(t('mkt_list_sell')||'SELL')+'</button>'
          +'</div>';
      });
      html+='</div>';
    }

    html+='<div style="font-size:10px;color:#4cd89a;font-weight:800;letter-spacing:.5px;margin:14px 0 6px;border-top:1px solid rgba(255,255,255,.06);padding-top:10px">💱 '+tl('GP↔PP TRADE','GP↔PP 거래','GP↔PP 取引','GP↔PP 交易')+'</div>';
    html+='<div style="background:rgba(76,216,154,.04);border:1px solid rgba(76,216,154,.18);border-radius:8px;padding:10px;display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:12px">'
      +'<div style="min-width:0">'
      +'<div style="font-size:10px;font-weight:700;color:#4cd89a">💱 '+tl('GP↔PP auction bundle','GP↔PP 경매 번들','GP↔PP オークション束','GP↔PP 拍卖包')+'</div>'
      +'<div style="font-size:8px;color:var(--tx3);margin-top:2px">'+tl('Sell one currency for bids in the other.','한 통화를 내놓고 다른 통화로 입찰받습니다.','片方の通貨を出してもう片方で入札を受けます。','出售一种货币，用另一种货币竞价。')+'</div>'
      +'</div>'
      +'<button type="button" onclick="openListModal(\'currency\',0,\'GP↔PP Trade\',\'💱\',0)" style="font-size:9px;font-weight:700;padding:5px 10px;border-radius:4px;border:1px solid rgba(76,216,154,.45);background:rgba(76,216,154,.12);color:#4cd89a;cursor:pointer;font-family:var(--fn);white-space:nowrap">🔨 '+(t('mkt_list_sell')||'SELL')+'</button>'
      +'</div>';

    // [v7.177 Phase 2] 함선 SELL 섹션 — 마켓에서 직접 함선 등록(이전엔 조선소 only)
    html+='<div style="font-size:10px;color:#5cbbff;font-weight:800;letter-spacing:.5px;margin:14px 0 6px">🚀 '+tl('MY SHIPS','내 함선','所有艦船','我的舰船')+'</div>';
    html+='<div id="mktSellShipsPane" style="display:grid;grid-template-columns:1fr 1fr;gap:6px"><div style="grid-column:1/-1;text-align:center;color:var(--tx3);padding:10px 0;font-size:10px">'+tl('Loading ships...','함선 로딩 중...','艦船読み込み中...','加载舰船中...')+'</div></div>';

    el.innerHTML=html;

    // 함선 비동기 로드 — listed=false & alive=true 만 등록 가능
    fetch('/api/ships/my', { headers: getAuthHeaders() }).then(function(r){return r.ok?r.json():null;}).then(function(d){
      var pane=document.getElementById('mktSellShipsPane'); if(!pane) return;
      var ships=((d&&d.ships)||[]).filter(function(s){ return s.is_alive!==false && !s.is_market_listed; });
      if(!ships.length){
        pane.innerHTML='<div style="grid-column:1/-1;text-align:center;color:var(--tx3);padding:10px 0;font-size:10px">'+tl('No ships available to sell.','등록 가능한 함선이 없습니다.','売却可能な艦船がありません。','无可上架的舰船。')+'</div>';
        return;
      }
      pane.innerHTML=ships.slice(0,12).map(function(s){
        var portrait='assets/ships/reveal/'+(s.ship_type_code||'')+'.jpg';
        var nm=(typeof syShipName==='function')?syShipName(s):(s.name_ko||s.ship_type_code||'Ship');
        var qm=(typeof _crateQualityMeta!=='undefined'&&s.quality)?_crateQualityMeta[s.quality]:null;
        var qBadge=(qm&&qm.stars>0)?'<span style="font-size:8px;color:'+qm.col+';margin-left:4px">'+('★'.repeat(qm.stars))+'</span>':'';
        return '<div style="background:rgba(92,187,255,.04);border:1px solid rgba(92,187,255,.25);border-radius:8px;padding:8px;display:flex;flex-direction:column;gap:5px">'
          + '<div style="position:relative;aspect-ratio:4/3;overflow:hidden;border-radius:6px;background:#0a0e1a"><img src="'+portrait+'" style="width:100%;height:100%;object-fit:cover" onerror="this.style.display=\'none\'"></div>'
          + '<div style="font-size:10px;font-weight:700;color:'+(s.faction_color||'#fff')+'">'+escapeHtmlSafe(nm)+qBadge+'</div>'
          + '<div style="font-size:8px;color:var(--tx3)">'+escapeHtmlSafe(s.class_label||s.size_class||'')+'</div>'
          + '<button type="button" onclick="openShipSellModal('+s.id+',\''+escapeHtmlSafe(nm).replace(/\047/g,"\\\047")+'\')" style="font-size:9px;font-weight:700;padding:5px;border-radius:5px;border:1px solid rgba(92,187,255,.45);background:rgba(92,187,255,.12);color:#5cbbff;cursor:pointer;font-family:var(--fn);margin-top:auto">💰 '+tl('LIST SHIP','함선 등록','艦船を出品','上架舰船')+'</button>'
          + '</div>';
      }).join('');
    }).catch(function(){
      var pane=document.getElementById('mktSellShipsPane'); if(!pane) return;
      pane.innerHTML='<div style="grid-column:1/-1;text-align:center;color:var(--red);font-size:10px">'+tl('Failed to load ships','함선 로드 실패','艦船読み込み失敗','加载舰船失败')+'</div>';
    });
  });
}

// [v7.177 Phase 2] 마켓 함선 카드 → 인라인 구매 확인 모달.
//   조선소로 이동 강제 없이 마켓에서 바로 구매. cross-faction(다른 진영) 경고 포함.
function openMarketShipBuy(listingId, name, priceGp, shipTypeCode, shipFaction){
  if (!listingId) return;
  var w = (walletState && walletState.address) || '';
  if (!w) { showToast(tl('Login required','로그인 필요','ログインが必要','请先登录'),'error'); return; }
  var myGP = Number((walletState && walletState.gameGP)||0);
  var insufficient = myGP < priceGp;
  var myFaction = (typeof shipyardState!=='undefined' && shipyardState.myFaction && (shipyardState.myFaction.code||'').toLowerCase()) || '';
  // [v7.322] 합체 유닛(pilgrim/assembled)은 전 유저 공용 — cross-faction 경고 없음.
  var _univBuy = ((shipFaction||'').toLowerCase() === 'pilgrim') || ((shipSize||'').toLowerCase() === 'assembled');
  var crossFaction = !_univBuy && myFaction && shipFaction && (myFaction !== (shipFaction||'').toLowerCase());

  var info = [
    { k: tl('Price','가격','価格','价格'), v: priceGp.toLocaleString() + ' GP' },
    { k: tl('Balance','보유 GP','残高','余额'), v: Math.floor(myGP).toLocaleString() + ' GP', insufficient: insufficient }
  ];
  var body = tl('Buy this ship from the market.','마켓에서 이 함선을 구매합니다.','市場でこの艦船を購入します。','从市场购买这艘舰船。');
  // [v7.178 Phase 3] 가격 히스토리 sparkline — 최근 30건 판매가 inline SVG
  // [v7.190] race 가드 토큰 — gameConfirm 모달에 listingId 기록. 응답 도착 시 토큰 일치할 때만 append.
  try {
    var _gcEl = document.getElementById('gameConfirm'); if (_gcEl) _gcEl.dataset.sparkToken = String(listingId);
    fetch('/api/ships/market/price-history/' + encodeURIComponent(shipTypeCode))
      .then(function(r){return r.ok?r.json():null;})
      .then(function(h){
        if (!h || !h.points || !h.points.length) return;
        var prices = h.points.map(function(p){return Number(p.price)||0;}).filter(function(v){return v>0;});
        if (!prices.length) return;
        var min = Math.min.apply(null, prices), max = Math.max.apply(null, prices);
        var avg = Math.round(prices.reduce(function(a,b){return a+b;},0)/prices.length);
        var W=140, H=28, span=Math.max(1, max-min);
        var pts = prices.map(function(v,i){
          var x = (i/Math.max(1,prices.length-1))*W;
          var y = H - ((v-min)/span)*H;
          return x.toFixed(1)+','+y.toFixed(1);
        }).join(' ');
        var svg = '<svg width="'+W+'" height="'+H+'" style="display:block;margin-top:4px"><polyline points="'+pts+'" fill="none" stroke="#ffd166" stroke-width="1.5"/></svg>';
        var label = tl('Recent','최근','最近','最近')+' '+prices.length+' '+tl('sales','거래','取引','交易');
        var html = '<div style="margin-top:8px;padding:6px 8px;background:rgba(255,209,102,.06);border:1px solid rgba(255,209,102,.25);border-radius:6px;font-size:9px;color:var(--tx2)">'
          + '<div style="display:flex;justify-content:space-between"><span>'+label+'</span><span style="color:#ffd166;font-weight:700">'+tl('avg','평균','平均','均')+' '+avg.toLocaleString()+' GP</span></div>'
          + svg
          + '<div style="display:flex;justify-content:space-between;color:var(--tx3);font-size:8px"><span>'+tl('min','최저','最低','最低')+' '+min.toLocaleString()+'</span><span>'+tl('max','최고','最高','最高')+' '+max.toLocaleString()+'</span></div>'
          + '</div>';
        // [v7.190] race 가드 — gameConfirm 가 닫힌 뒤 응답 도착하면 다른 모달에 잘못 삽입 가능.
        //   token 확인: 현재 #gameConfirm.dataset.sparkToken 이 같은 listingId 인지.
        var gc = document.getElementById('gameConfirm');
        if (!gc || gc.dataset.sparkToken !== String(listingId)) return;
        var bodyEl = gc.querySelector('.gc-body');
        if (bodyEl && !bodyEl.querySelector('[data-sparkline]')) {
          var wrap = document.createElement('div');
          wrap.setAttribute('data-sparkline','1');
          wrap.innerHTML = html;
          bodyEl.appendChild(wrap);
        }
      })
      .catch(function(){});
  } catch(_){}
  if (crossFaction) {
    body += '<br><br><span style="color:#aac4dc;font-size:10px">🔒 ' + tl(
      'Other faction ship — cannot deploy in your fleet. You can resell on market.',
      '다른 진영 함선 — 함대에 편성 불가. 마켓에서 재판매 가능.',
      '他陣営の艦船 — 艦隊に編入不可。市場で再販売可能。',
      '其他阵营舰船 — 无法编入舰队。可在市场再次出售。'
    ) + '</span>';
  }
  gameConfirm({
    title: '🚀 ' + name,
    icon: '💰',
    body: body,
    info: info,
    confirmText: tl('BUY','구매','購入','购买'),
    disabled: insufficient
  }).then(function(ok){
    // [v7.190] sparkline race 가드 토큰 해제 — 모달 닫힘.
    var _gc2 = document.getElementById('gameConfirm'); if (_gc2) delete _gc2.dataset.sparkToken;
    if (!ok) return;
    fetch('/api/ships/market/listings/' + listingId + '/buy', {
      method: 'POST',
      headers: Object.assign({'Content-Type':'application/json'}, getAuthHeaders())
    }).then(function(r){ return r.json(); }).then(function(d){
      if (d && d.success) {
        showToast(tl('Ship purchased!','함선 구매 완료!','艦船購入完了！','已购买舰船！'),'success');
        try { refreshGP(); } catch(_){}
        try { loadMarketListings(); } catch(_){}
      } else {
        var em = {
          INSUFFICIENT_GP: tl('Not enough GP','GP 부족','GP不足','GP不足'),
          LISTING_NOT_FOUND: tl('Listing no longer available','매물 없음(이미 판매됨)','出品が見つかりません','物品已售出'),
          CANNOT_BUY_OWN_LISTING: tl('Cannot buy your own listing','본인 매물은 구매 불가','自分の出品は購入不可','无法购买自己的上架'),
          SHIP_PLAYER_TYPE_LIMIT: tl('Ship type limit reached','함급 보유 한도 도달','艦種保有上限到達','舰种持有上限')
        };
        showToast(em[d&&d.error] || (d&&d.error) || tl('Failed','실패','失敗','失败'),'error');
      }
    }).catch(function(){ showToast(tl('Network error','네트워크 오류','ネットワークエラー','网络错误'),'error'); });
  });
}

// [v7.177 Phase 2] 마켓에서 직접 함선 등록 — 가격 입력 → /api/ships/:id/list
function openShipSellModal(shipId, shipName){
  gameInput({
    title: tl('LIST SHIP','함선 마켓 등록','艦船出品','上架舰船'),
    label: shipName + ' — ' + tl('Enter price (GP)','가격 입력 (GP)','価格(GP)','价格(GP)'),
    placeholder: '5000',
    maxLength: 12
  }).then(function(priceStr){
    if (priceStr === null || priceStr === undefined) return;
    var price = parseInt(priceStr, 10);
    if (!price || price < 10) { showToast(tl('Minimum 10 GP','최소 10 GP','最低10 GP','最低 10 GP'),'error'); return; }
    fetch('/api/ships/'+shipId+'/list', {
      method:'POST',
      headers: Object.assign({'Content-Type':'application/json'}, getAuthHeaders()),
      body: JSON.stringify({ price_gp: price })
    }).then(function(r){return r.json();}).then(function(d){
      if (d && d.success) {
        showToast(tl('Ship listed!','함선 등록 완료!','艦船を出品しました！','已上架舰船！'),'success');
        try { loadSellView(); } catch(_) {}
      } else {
        var em = {
          SHIP_LISTED_FOR_SALE: tl('Already listed','이미 등록됨','既に出品中','已上架'),
          SHIP_NOT_FOUND: tl('Ship not found','함선을 찾을 수 없음','艦船が見つかりません','找不到舰船'),
          SHIP_IN_BATTLE: tl('Ship in battle — wait','전투 중 — 종료 후 등록','戦闘中 — 終了後に出品','战斗中 — 结束后再上架'),
          MARKET_DISABLED: tl('Ship market disabled','함선 마켓 비활성','艦船市場無効','舰船市场关闭'),
          INVALID_PRICE: tl('Invalid price range','가격 범위 오류','価格範囲エラー','价格范围错误')
        };
        showToast(em[d&&d.error] || (d&&d.error) || tl('Failed','실패','失敗','失败'),'error');
      }
    }).catch(function(){ showToast(tl('Network error','네트워크 오류','ネットワークエラー','网络错误'),'error'); });
  });
}

function openListModal(type,idVal,name,icon,enhLv){
  var w=(walletState&&walletState.address)||'';
  var isCurrencyListing=type==='currency';
  gameConfirm({
    title:(t('mkt_list_title')||'판매 등록'), icon:icon||'💰',
    body:'<div style="margin-bottom:10px;font-size:11px;color:#a064dc;font-weight:800">'+(icon||'')+(name||'Item')+(enhLv>0?' +'+enhLv:'')+'</div>'
      // 판매 방식 선택
      +'<div style="display:flex;gap:6px;margin-bottom:10px">'
      +(isCurrencyListing?'':'<button type="button" id="listModeFixed" onclick="document.getElementById(\'listModeFixed\').style.background=\'rgba(160,100,220,.3)\';document.getElementById(\'listModeFixed\').style.borderColor=\'rgba(160,100,220,.7)\';document.getElementById(\'listModeAuction\').style.background=\'rgba(0,0,0,.2)\';document.getElementById(\'listModeAuction\').style.borderColor=\'rgba(255,255,255,.1)\';document.getElementById(\'listAuctionFields\').style.display=\'none\'" style="flex:1;padding:8px;border-radius:7px;background:rgba(160,100,220,.3);border:1px solid rgba(160,100,220,.7);color:#a064dc;font-family:var(--fn);font-size:10px;cursor:pointer;font-weight:700">💰 '+(LANG==='ko'?'고정가':LANG==='ja'?'固定価格':LANG==='zh'?'固定价格':'Fixed')+'</button>')
      +'<button type="button" id="listModeAuction" onclick="document.getElementById(\'listModeAuction\').style.background=\'rgba(255,213,79,.2)\';document.getElementById(\'listModeAuction\').style.borderColor=\'rgba(255,213,79,.6)\';var f=document.getElementById(\'listModeFixed\');if(f){f.style.background=\'rgba(0,0,0,.2)\';f.style.borderColor=\'rgba(255,255,255,.1)\';}document.getElementById(\'listAuctionFields\').style.display=\'block\'" style="flex:1;padding:8px;border-radius:7px;background:'+(isCurrencyListing?'rgba(255,213,79,.2)':'rgba(0,0,0,.2)')+';border:1px solid '+(isCurrencyListing?'rgba(255,213,79,.6)':'rgba(255,255,255,.1)')+';color:'+(isCurrencyListing?'var(--gold)':'var(--tx3)')+';font-family:var(--fn);font-size:10px;cursor:pointer;font-weight:700">🔨 '+(isCurrencyListing?tl('GP↔PP Trade','GP↔PP 거래','GP↔PP 取引','GP↔PP 交易'):(LANG==='ko'?'경매':LANG==='ja'?'オークション':LANG==='zh'?'拍卖':'Auction'))+'</button>'
      +'</div>'
      // 가격
      +'<div style="display:flex;gap:6px;align-items:center;margin-bottom:8px">'
      +'<label style="font-size:9px;color:var(--tx3);min-width:52px">'+(isCurrencyListing?tl('Bid start','입찰 시작가','開始価格','起拍价'):(LANG==='ko'?'시작가':LANG==='ja'?'開始価格':LANG==='zh'?'起拍价':'Starting Price'))+'</label>'
      +'<input id="mktListPrice" type="number" min="1" placeholder="100" style="flex:1;font-size:11px;padding:6px 8px;background:rgba(0,0,0,.3);border:1px solid rgba(160,100,220,.3);color:#fff;border-radius:6px;font-family:var(--fn)">'
      +'<select id="mktListCurrency" style="font-size:10px;padding:6px;background:rgba(0,0,0,.3);border:1px solid rgba(160,100,220,.3);color:#fff;border-radius:6px;font-family:var(--fn)"><option value="GP">GP</option><option value="PP">PP</option></select>'
      +'</div>'
      // 경매 전용 필드
      +'<div id="listAuctionFields" style="display:'+(isCurrencyListing?'block':'none')+';border-top:1px solid rgba(255,213,79,.15);padding-top:8px;margin-bottom:8px">'
      +(isCurrencyListing?'<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:6px">'
        +'<div><label style="font-size:9px;color:var(--tx3);display:block;margin-bottom:3px">'+tl('Sell currency','파는 통화','売る通貨','出售货币')+'</label><select id="mktBundleCurrency" style="width:100%;font-size:10px;padding:6px;background:rgba(0,0,0,.3);border:1px solid rgba(76,216,154,.25);color:#fff;border-radius:6px;font-family:var(--fn)"><option value="PP">PP</option><option value="GP">GP</option></select></div>'
        +'<div><label style="font-size:9px;color:var(--tx3);display:block;margin-bottom:3px">'+tl('Amount','수량','数量','数量')+'</label><input id="mktBundleAmount" type="number" min="1" placeholder="100" style="width:100%;box-sizing:border-box;font-size:11px;padding:6px 8px;background:rgba(0,0,0,.3);border:1px solid rgba(76,216,154,.25);color:#fff;border-radius:6px;font-family:var(--fn)"></div>'
        +'</div>':'')
      +'<div style="display:flex;gap:6px;align-items:center;margin-bottom:6px">'
      +'<label style="font-size:9px;color:var(--tx3);min-width:52px">'+(LANG==='ko'?'즉구가':LANG==='ja'?'即決価格':LANG==='zh'?'立即购买价':'Buyout')+'</label>'
      +'<input id="mktAuctionBuyout" type="number" min="1" placeholder="'+(LANG==='ko'?'즉시구매 (선택)':LANG==='ja'?'即決（任意）':LANG==='zh'?'立即购买（选填）':'Buyout (optional)')+'" style="flex:1;font-size:11px;padding:6px 8px;background:rgba(0,0,0,.3);border:1px solid rgba(255,213,79,.25);color:#fff;border-radius:6px;font-family:var(--fn)">'
      +'</div>'
      +'<div style="display:flex;gap:6px;align-items:center">'
      +'<label style="font-size:9px;color:var(--tx3);min-width:52px">'+(LANG==='ko'?'기간':LANG==='ja'?'期間':LANG==='zh'?'时长':'Duration')+'</label>'
      +'<select id="mktAuctionDur" style="flex:1;font-size:10px;padding:6px;background:rgba(0,0,0,.3);border:1px solid rgba(255,213,79,.25);color:#fff;border-radius:6px;font-family:var(--fn)"><option value="1">1'+(LANG==='ko'?'시간':LANG==='ja'?'時間':LANG==='zh'?'小时':'h')+'</option><option value="6">6'+(LANG==='ko'?'시간':LANG==='ja'?'時間':LANG==='zh'?'小时':'h')+'</option><option value="12">12'+(LANG==='ko'?'시간':LANG==='ja'?'時間':LANG==='zh'?'小时':'h')+'</option><option value="24" selected>24'+(LANG==='ko'?'시간':LANG==='ja'?'時間':LANG==='zh'?'小时':'h')+'</option><option value="48">48'+(LANG==='ko'?'시간':LANG==='ja'?'時間':LANG==='zh'?'小时':'h')+'</option><option value="72">72'+(LANG==='ko'?'시간':LANG==='ja'?'時間':LANG==='zh'?'小时':'h')+'</option></select>'
      +'</div>'
      +'</div>'
      +'<div style="font-size:8px;color:var(--tx3)">'+(LANG==='ko'?'수수료: 낙찰가의 5%':LANG==='ja'?'手数料: 落札額の5%':LANG==='zh'?'手续费: 成交价5%':'Fee: 5% of sale')+'</div>',
    info:[], confirmText:LANG==='ko'?'등록하기':LANG==='ja'?'出品する':LANG==='zh'?'发布':'List Item'
  }).then(function(ok){
    if(!ok) return;
    var priceVal=parseFloat(document.getElementById('mktListPrice').value);
    var curr=document.getElementById('mktListCurrency').value;
    if(!priceVal||priceVal<=0){showToast(LANG==='ko'?'가격을 입력하세요':LANG==='ja'?'価格を入力してください':LANG==='zh'?'请输入价格':'Enter a price','error');return;}
    var isAuction=isCurrencyListing||document.getElementById('listModeAuction').style.borderColor.indexOf('255,213')>=0;
    if(isAuction){
      // 경매 등록
      var buyout=parseFloat(document.getElementById('mktAuctionBuyout').value)||null;
      var dur=parseInt(document.getElementById('mktAuctionDur').value)||24;
      var aBody={listing_type:type,start_price:priceVal,currency:curr,duration_hours:dur};
      if(buyout&&buyout>priceVal) aBody.buyout_price=buyout;
      if(isCurrencyListing){
        var bundleCurrency=document.getElementById('mktBundleCurrency').value;
        var bundleAmount=parseFloat(document.getElementById('mktBundleAmount').value);
        if(!bundleAmount||bundleAmount<=0){showToast(tl('Enter bundle amount','번들 수량을 입력하세요','数量を入力してください','请输入数量'),'error');return;}
        if(bundleCurrency===curr){showToast(tl('Choose the other currency for bids','입찰 통화는 파는 통화와 달라야 합니다','入札通貨は売る通貨と異なる必要があります','竞价货币必须不同'),'error');return;}
        aBody.bundle_currency=bundleCurrency;
        aBody.bundle_amount=bundleAmount;
      } else if(type==='claim') aBody.claim_id=idVal; else aBody.item_instance_id=idVal;
      fetch('/api/auctions',{method:'POST',headers:Object.assign({'Content-Type':'application/json'},getAuthHeaders()),body:JSON.stringify(aBody)})
      .then(function(r){return r.json();}).then(function(d){
        if(d.error||!d.id){showToast(d.error||(LANG==='ko'?'경매 등록 실패':LANG==='ja'?'オークション登録失敗':LANG==='zh'?'拍卖登记失败':'Auction listing failed'),'error');return;}
        showToast('🔨 '+(LANG==='ko'?'경매 등록 완료! ':LANG==='ja'?'オークション登録完了! ':LANG==='zh'?'拍卖登记完成! ':'Auction listed! ')+dur+(LANG==='ko'?'시간 진행':LANG==='ja'?'時間':LANG==='zh'?'小时':'h'));
        refreshBalance(); loadSellView();
        if(type==='claim'){try{loadForSaleOverlay();}catch(_){}try{_updateMyTerritories();}catch(_){}}
      }).catch(function(){showToast(LANG==='ko'?'경매 등록 실패':LANG==='ja'?'オークション登録失敗':LANG==='zh'?'拍卖登记失败':'Auction listing failed','error');});
    } else {
      // 고정가 등록
      var body={wallet:w,type:type,price:priceVal,currency:curr};
      if(type==='claim') body.claimId=idVal; else body.instanceId=idVal;
      fetch('/api/marketplace/list',{method:'POST',headers:Object.assign({'Content-Type':'application/json'},getAuthHeaders()),body:JSON.stringify(body)})
      .then(function(r){return r.json()}).then(function(d){
        if(d.error){showToast(srvErr(d.error),'error');return;}
        var _mktListedMsg=type==='claim'?(LANG==='ko'?'영토를 마켓에 등록했습니다!':LANG==='ja'?'領土をマーケットに登録しました!':LANG==='zh'?'领地已上架市场!':'Territory listed on market!'):(LANG==='ko'?'아이템을 마켓에 등록했습니다!':LANG==='ja'?'アイテムをマーケットに登録しました!':LANG==='zh'?'物品已上架市场!':'Item listed on market!');
        showToast('✅ '+_mktListedMsg);
        refreshBalance(); loadSellView();
        if(type==='claim'){try{loadForSaleOverlay();}catch(_){}try{_updateMyTerritories();}catch(_){}}
      }).catch(function(){showToast(LANG==='ko'?'등록 실패':LANG==='ja'?'登録失敗':LANG==='zh'?'登记失败':'Registration failed','error');});
    }
  });
}

// ── 자원 마켓 등록 (인벤토리 → 마켓 SELL 탭 열기) ──
function openResourceMarketListing(resourceCode){
  var w=(walletState&&walletState.address)||'';
  if(!w){showToast('Connect wallet first','error');return;}
  var resItem=(_resourceInventory||[]).find(function(r){return r.code===resourceCode;});
  if(!resItem||resItem.quantity<=0){showToast('No resources to sell','error');return;}
  var maxQty=resItem.quantity;
  gameConfirm({
    title:'⛏️ '+(t('res_sell_title')||'Sell Resource'), icon:resItem.icon_emoji||'🔷',
    body:'<div style="margin-bottom:8px;font-size:10px;color:#5cbbff;font-weight:700">'+(resItem.icon_emoji||'')+(resItem.name||resItem.code)+'</div>'
      +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:4px">'
      +'<div>'
      +'<label style="font-size:9px;color:var(--tx3)">QTY (max '+maxQty+')</label>'
      +'<input id="resListQty" type="number" min="1" max="'+maxQty+'" value="'+Math.min(maxQty,10)+'" style="width:100%;font-size:11px;padding:4px 8px;background:rgba(0,0,0,.3);border:1px solid rgba(92,187,255,.3);color:#fff;border-radius:4px;font-family:var(--fn);box-sizing:border-box">'
      +'</div>'
      +'<div>'
      +'<label style="font-size:9px;color:var(--tx3)">PRICE EACH</label>'
      +'<input id="resListPrice" type="number" min="1" placeholder="'+resItem.base_pp_value+'" style="width:100%;font-size:11px;padding:4px 8px;background:rgba(0,0,0,.3);border:1px solid rgba(92,187,255,.3);color:#fff;border-radius:4px;font-family:var(--fn);box-sizing:border-box">'
      +'</div>'
      +'</div>'
      +'<select id="resListCurrency" style="width:100%;font-size:10px;padding:4px 6px;background:rgba(0,0,0,.3);border:1px solid rgba(92,187,255,.3);color:#fff;border-radius:4px;font-family:var(--fn);box-sizing:border-box"><option value="GP">GP</option><option value="PP">PP</option></select>'
      +'<div style="font-size:8px;color:var(--tx3);margin-top:4px">'+(t('mkt_fee_note')||'Listing fee: 2 GP · Sale fee: 5%')+'</div>',
    info:[], confirmText:t('mkt_list_confirm')||'LIST FOR SALE'
  }).then(function(ok){
    if(!ok) return;
    var qty=parseInt(document.getElementById('resListQty').value)||1;
    var price=parseFloat(document.getElementById('resListPrice').value);
    var curr=document.getElementById('resListCurrency').value;
    if(!price||price<=0){showToast('Enter a valid price','error');return;}
    if(qty<1||qty>maxQty){showToast('Invalid quantity','error');return;}
    fetch('/api/marketplace/list',{method:'POST',headers:Object.assign({'Content-Type':'application/json'},getAuthHeaders()),body:JSON.stringify({wallet:w,type:'resource',resourceCode:resourceCode,resourceQuantity:qty,price:price,currency:curr})})
    .then(function(r){return r.json()}).then(function(d){
      if(d.error){showToast(srvErr(d.error),'error');return;}
      showToast('✅ '+(qty)+'× '+(resItem.name||resItem.code)+' listed!');
      loadBaseInventory();
    }).catch(function(){showToast('Listing failed','error')});
  });
}

function loadMyListings(){
  var el=document.getElementById('mktMyView');
  var w=(walletState&&walletState.address)||'';
  if(!w){el.innerHTML='<div style="text-align:center;color:var(--tx3);padding:20px;font-size:10px">Connect wallet first</div>';return;}
  el.innerHTML='<div style="text-align:center;color:var(--tx3);padding:20px;font-size:10px">Loading...</div>';
  fetch('/api/marketplace/my-listings', { headers: getAuthHeaders() }).then(function(r){return r.json()}).then(function(listings){
    if(!listings||!listings.length){
      el.innerHTML='<div style="text-align:center;color:var(--tx3);padding:32px 0;font-size:10px">'+(t('mkt_no_listings')||'No listings yet')+'</div>';
      return;
    }
    var html='<div style="display:grid;grid-template-columns:1fr;gap:6px">';
    listings.forEach(function(l){
      var meta=l.meta||{};
      var statusColor=l.status==='active'?'#4cd89a':l.status==='sold'?'var(--gold)':l.status==='expired'?'var(--tx3)':'var(--red)';
      html+='<div style="background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.08);border-radius:8px;padding:10px;display:flex;justify-content:space-between;align-items:center">'
        +'<div>'
        +'<div style="font-size:10px;font-weight:700;color:#a064dc">'+(meta.itemIcon||'🗺️')+' '+(meta.itemName||(l.listing_type==='claim'?'Territory #'+l.claim_id:'Item'))+(meta.enhancementLevel>0?_enhBadge(meta.enhancementLevel):'')+'</div>'
        +'<div style="font-size:9px;color:var(--tx3)">'+parseFloat(l.price)+' '+l.currency+' · <span style="color:'+statusColor+'">'+l.status.toUpperCase()+'</span></div>'
        +'</div>'
        +(l.status==='active'?'<button onclick="cancelMarketListing('+l.id+')" style="font-size:9px;padding:4px 10px;border-radius:4px;border:1px solid rgba(232,72,85,.3);background:rgba(232,72,85,.08);color:var(--red);cursor:pointer;font-family:var(--fn)">'+(t('mkt_cancel')||'CANCEL')+'</button>':'')
        +'</div>';
    });
    html+='</div>';
    el.innerHTML=html;
  }).catch(function(){el.innerHTML='<div style="color:var(--red);font-size:10px">'+tl('Failed to load','불러오기 실패','読み込み失敗','加载失败')+'</div>'});
}

// ══════════════════════════════════════
// AUCTION SYSTEM
// ══════════════════════════════════════
var _auctionTimers=[];

function _auctionTimeLeft(endsAt){
  var diff=Math.max(0,new Date(endsAt)-Date.now());
  if(!diff) return t('auc_ended')||'ENDED';
  var h=Math.floor(diff/3600000),m=Math.floor((diff%3600000)/60000),s=Math.floor((diff%60000)/1000);
  if(h>0) return h+'h '+m+'m';
  if(m>0) return m+'m '+s+'s';
  return s+'s';
}

function loadAuctions(){
  var el=document.getElementById('auctionGrid');
  if(!el) return;
  el.innerHTML='<div style="text-align:center;color:var(--tx3);padding:20px;font-size:10px">Loading...</div>';
  var typeFilter=document.getElementById('auctFilterType');
  var typeVal=typeFilter?typeFilter.value:'';
  var url='/api/auctions?status=active&limit=30'+(typeVal?'&listing_type='+encodeURIComponent(typeVal):'');
  fetch(url).then(function(r){return r.json()}).then(function(d){
    var auctions=d.auctions||[];
    if(!auctions.length){
      el.innerHTML='<div style="text-align:center;color:var(--tx3);padding:32px 0;font-size:10px">'+(t('auc_none')||'No active auctions')+'</div>';
      return;
    }
    var html='<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">';
    auctions.forEach(function(a){
      var w=(walletState&&walletState.address)||'';
      var isSelf=(w&&a.seller_wallet&&w.toLowerCase()===a.seller_wallet.toLowerCase());
      var hasBid=a.current_bid>0;
      var minBid=hasBid?Math.ceil(a.current_bid*1.05):Math.ceil(parseFloat(a.current_price||a.start_price||0)+1);
      var itemLabel=a.listing_type==='cosmetic'?(a.item_icon||'🎨')+' '+(a.item_name||'Cosmetic')
        :a.listing_type==='item'?'📦 '+(a.item_name||'Item')
        :a.listing_type==='claim'?'🗺️ Territory #'+a.claim_id
        :a.listing_type==='resource'?'⚙️ '+(a.resource_quantity||0)+'× '+(a.resource_code||a.resource_name||'Resource')
        :a.listing_type==='currency'?'💱 '+(a.bundle_amount||0)+' '+(a.bundle_currency||'')+' → '+a.currency
        :'⚙️ '+(a.resource_quantity||0)+'× '+(a.resource_code||a.resource_name||'Resource');
      var enhLv=a.enhancement_level||0;
      html+='<div style="background:rgba(255,255,255,.03);border:1px solid rgba(255,165,0,.15);border-radius:8px;padding:10px;display:flex;flex-direction:column;gap:5px">'
        +'<div style="font-size:10px;font-weight:700;color:var(--gold)">'+itemLabel+(enhLv>0?_enhBadge(enhLv):'')+'</div>'
        +'<div style="font-size:9px;color:var(--tx3)">'+(t('auc_current_bid')||'Bid')+': <span style="color:#fff;font-weight:700">'+(hasBid?a.current_bid:a.start_price)+' '+a.currency+'</span></div>'
        +(a.buyout_price?'<div style="font-size:8px;color:#4cd89a">'+(t('auc_buyout')||'Buyout')+': '+a.buyout_price+' '+a.currency+'</div>':'')
        +'<div class="auc-timer-'+a.id+'" style="font-size:8px;color:var(--tx3)">⏱ '+_auctionTimeLeft(a.ends_at)+'</div>'
        +'<div style="display:flex;gap:4px;margin-top:auto">'
        +(!isSelf?'<button onclick="govPlaceAuctionBid('+a.id+','+minBid+',\''+a.currency+'\')" style="flex:1;font-size:8px;font-weight:700;padding:5px 4px;border-radius:4px;border:1px solid rgba(255,165,0,.4);background:rgba(255,165,0,.1);color:var(--gold);cursor:pointer;font-family:var(--fn)">🔨 '+(t('auc_bid')||'BID')+'</button>':'')
        +(a.buyout_price&&!isSelf?'<button onclick="govAuctionBuyout('+a.id+',\''+a.currency+'\')" style="flex:1;font-size:8px;font-weight:700;padding:5px 4px;border-radius:4px;border:1px solid rgba(76,216,154,.4);background:rgba(76,216,154,.1);color:#4cd89a;cursor:pointer;font-family:var(--fn)">⚡ '+(t('auc_buy_now')||'BUY')+'</button>':'')
        +(isSelf&&!hasBid?'<button onclick="govCancelAuction('+a.id+')" style="flex:1;font-size:8px;padding:4px;border-radius:4px;border:1px solid rgba(232,72,85,.3);background:rgba(232,72,85,.08);color:var(--red);cursor:pointer;font-family:var(--fn)">'+(t('auc_cancel')||'CANCEL')+'</button>':'')
        +'</div>'
        +'</div>';
    });
    html+='</div>';
    el.innerHTML=html;
    // live timers
    _auctionTimers.forEach(function(id){_clearActiveInterval(id)});
    _auctionTimers=[];
    auctions.forEach(function(a){
      // Cache span ref once — avoids querySelector on every tick
      var span=el.querySelector('.auc-timer-'+a.id);
      if(!span) return;
      var tid=_setActiveInterval(function(){
        if(span.isConnected) span.textContent='⏱ '+_auctionTimeLeft(a.ends_at);
        else { _clearActiveInterval(tid); }
      },1000);
      _auctionTimers.push(tid);
    });
  }).catch(function(){el.innerHTML='<div style="color:var(--red);font-size:10px">'+tl('Failed to load','불러오기 실패','読み込み失敗','加载失败')+'</div>'});
}

window.govPlaceAuctionBid=function(auctionId,minBid,currency){
  var w=(walletState&&walletState.address)||'';
  if(!w){showToast(t('connect_wallet')||'Connect wallet first','error');return;}
  gameConfirm({
    title:t('auc_bid_title')||'Place Bid',icon:'🔨',
    body:'<div style="margin-bottom:8px;font-size:10px;color:var(--gold)">'+(t('auc_min_bid')||'Minimum bid')+': <strong>'+minBid+' '+currency+'</strong></div>'
      +'<div style="display:flex;gap:6px;align-items:center">'
      +'<label style="font-size:9px;color:var(--tx3);min-width:50px">'+(t('auc_your_bid')||'Your bid')+'</label>'
      +'<input id="aucBidAmt" type="number" min="'+minBid+'" value="'+minBid+'" style="flex:1;font-size:11px;padding:4px 8px;background:rgba(0,0,0,.3);border:1px solid rgba(255,165,0,.3);color:#fff;border-radius:4px;font-family:var(--fn)">'
      +'<span style="font-size:9px;color:var(--tx3)">'+currency+'</span>'
      +'</div>',
    info:[],confirmText:t('auc_confirm_bid')||'PLACE BID'
  }).then(function(ok){
    if(!ok) return;
    var amt=parseInt(document.getElementById('aucBidAmt').value);
    if(!amt||amt<minBid){showToast((t('auc_too_low')||'Bid must be at least ')+minBid,'error');return;}
    fetch('/api/auctions/'+auctionId+'/bid',{method:'POST',headers:Object.assign({'Content-Type':'application/json'},getAuthHeaders()),body:JSON.stringify({amount:amt})})
    .then(function(r){return r.json()}).then(function(d){
      if(d.error){showToast(srvErr(d.error),'error');return;}
      showToast('🔨 '+(t('auc_bid_placed')||'Bid placed!'));
      refreshBalance();loadAuctions();
    }).catch(function(){showToast('Bid failed','error')});
  });
};

window.govAuctionBuyout=function(auctionId,currency){
  var w=(walletState&&walletState.address)||'';
  if(!w){showToast(t('connect_wallet')||'Connect wallet first','error');return;}
  gameConfirm({
    title:t('auc_buyout_title')||'Buy Now',icon:'⚡',
    body:'<div style="font-size:10px;color:#4cd89a">'+(t('auc_buyout_confirm')||'Purchase this item at the buyout price?')+'</div>',
    info:[],confirmText:t('auc_confirm_buyout')||'BUY NOW'
  }).then(function(ok){
    if(!ok) return;
    fetch('/api/auctions/'+auctionId+'/buyout',{method:'POST',headers:Object.assign({'Content-Type':'application/json'},getAuthHeaders()),body:JSON.stringify({})})
    .then(function(r){return r.json()}).then(function(d){
      if(d.error){showToast(srvErr(d.error),'error');return;}
      showToast('⚡ '+(t('auc_bought')||'Item purchased!'));
      refreshBalance();loadAuctions();loadItemInstances();
    }).catch(function(){showToast('Buyout failed','error')});
  });
};

window.govCancelAuction=function(auctionId){
  var w=(walletState&&walletState.address)||'';
  if(!w) return;
  gameConfirm({
    title:t('auc_cancel_title')||'Cancel Auction',icon:'❌',
    body:'<div style="font-size:10px;color:var(--tx3)">'+(t('auc_cancel_confirm')||'Cancel this auction? (Only allowed with no bids)')+'</div>',
    info:[],confirmText:t('auc_confirm_cancel')||'CANCEL AUCTION'
  }).then(function(ok){
    if(!ok) return;
    fetch('/api/auctions/'+auctionId+'/cancel',{method:'POST',headers:Object.assign({'Content-Type':'application/json'},getAuthHeaders()),body:JSON.stringify({})})
    .then(function(r){return r.json()}).then(function(d){
      if(d.error){showToast(srvErr(d.error),'error');return;}
      showToast('✅ '+(t('auc_cancelled')||'Auction cancelled'));
      refreshBalance();loadAuctions();
    }).catch(function(){showToast('Cancel failed','error')});
  });
};

// ══════════════════════════════════════
// ITEM ENHANCEMENT SYSTEM
// ══════════════════════════════════════
var _enhCosts=null,_enhRates=null,_enhInstances=[];

function _enhBadge(lv){
  if(!lv||lv<=0) return '';
  var cls=lv<=3?'enh-badge-low':lv<=6?'enh-badge-mid':lv<=9?'enh-badge-high':'enh-badge-max';
  return '<span class="enh-badge '+cls+'">+'+lv+'</span>';
}
function _enhGlowClass(lv){ return 'enh-'+(lv||0); }
function _enhLevelColor(lv){
  if(!lv||lv<=0) return 'var(--tx3)';
  if(lv<=3) return 'rgba(200,200,220,.8)';
  if(lv<=6) return 'var(--gold)';
  if(lv<=9) return '#a064dc';
  return 'var(--red)';
}

function loadEnhancementData(){
  Promise.all([
    fetch('/api/enhance/costs').then(function(r){return r.json()}).catch(function(){return null}),
    fetch('/api/enhance/rates').then(function(r){return r.json()}).catch(function(){return null})
  ]).then(function(res){
    _enhCosts=res[0]; _enhRates=res[1];
  });
}

function loadItemInstances(cb){
  var w=(walletState&&walletState.address)||'';
  if(!w) return;
  fetch('/api/items/instances', { headers: getAuthHeaders() }).then(function(r){return r.json()}).then(function(d){
    _enhInstances=d||[];
    if(cb) cb();
  }).catch(function(){ _enhInstances=[]; if(cb) cb(); });
}

function materializeItem(itemTypeId){
  var w=(walletState&&walletState.address)||'';
  if(!w) return;
  fetch('/api/items/materialize',{method:'POST',headers:Object.assign({'Content-Type':'application/json'},getAuthHeaders()),body:JSON.stringify({wallet:w,itemTypeId:itemTypeId})})
  .then(function(r){return r.json()}).then(function(d){
    if(d.error){showToast(srvErr(d.error),'error');return;}
    showToast(t('enh_materialized')||'Item ready for enhancement!');
    loadBaseInventory();
    loadItemInstances();
  }).catch(function(){showToast('Failed','error')});
}

function dematerializeItem(instanceId){
  var w=(walletState&&walletState.address)||'';
  if(!w) return;
  fetch('/api/items/dematerialize',{method:'POST',headers:Object.assign({'Content-Type':'application/json'},getAuthHeaders()),body:JSON.stringify({wallet:w,instanceId:instanceId})})
  .then(function(r){return r.json()}).then(function(d){
    if(d.error){showToast(srvErr(d.error),'error');return;}
    showToast(t('enh_returned')||'Item returned to inventory');
    loadBaseInventory();
    loadItemInstances();
  }).catch(function(){showToast('Failed','error')});
}

function openEnhanceModal(instanceId){
  // [v7.171 E-Crit fix] enhancementAdvanced 백엔드(스크롤·레시피) 완비됐는데 UI 노출 0이었음.
  //   이제 /api/enhance/info/:id 로 scroll_status + available_recipes 받아 모달에 노출.
  //   protect/blessed scroll 보유 시 토글로 강화 안전성 즉시 향상 가능.
  var inst=_enhInstances.find(function(i){return i.id===instanceId});
  if(!inst) return showToast('Item not found','error');
  var lv=inst.enhancement_level||0;
  var cost=_enhCosts?_enhCosts.find(function(c){return c.from===lv}):null;
  var rate=(_enhRates&&!_enhRates.hidden)?_enhRates.find(function(r){return r.from===lv}):null;
  var gpCost=cost?cost.cost:0;
  var myGP=walletState.gameGP||0;
  var insufficient=myGP<gpCost;
  var maxed=lv>=10;
  if(maxed){
    return gameConfirm({title:(inst.icon||'')+' '+(inst.name||'Item')+' +10', icon:'✨', body:t('enh_maxed_body')||'This item has reached maximum enhancement.', confirmText:'OK', disabled:true});
  }

  // 스크롤·레시피 정보 비동기 fetch — 폴백: 정보 없으면 기존 흐름 그대로 동작
  var infoUrl='/api/enhance/info/'+instanceId;
  fetch(infoUrl,{headers:getAuthHeaders()}).then(function(r){return r.ok?r.json():null;}).catch(function(){return null;}).then(function(info){
    _showEnhanceModalWithInfo(inst, lv, gpCost, myGP, insufficient, rate, info);
  });
}
function _showEnhanceModalWithInfo(inst, lv, gpCost, myGP, insufficient, rate, info){
  var old=document.getElementById('enhanceAdvModal'); if(old) old.remove();
  var protectOwned=(info&&info.scroll_status&&info.scroll_status.protect&&info.scroll_status.protect.owned)||0;
  var blessedOwned=(info&&info.scroll_status&&info.scroll_status.blessed&&info.scroll_status.blessed.owned)||0;
  var recipes=(info&&Array.isArray(info.available_recipes))?info.available_recipes:[];
  var el=document.createElement('div');
  el.id='enhanceAdvModal';
  el.style.cssText='position:fixed;inset:0;z-index:100000;display:flex;align-items:center;justify-content:center;background:rgba(4,6,12,.82);backdrop-filter:blur(6px);padding:18px;animation:crFade .2s ease';
  el.onclick=function(e){ if(e.target===el) el.remove(); };
  function statRow(icon,label,val,extra){
    return '<div style="display:flex;justify-content:space-between;padding:6px 11px;border-radius:7px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.07);margin-bottom:5px"><span style="font-size:11px;color:var(--tx2)">'+icon+' '+label+'</span><span style="font-size:12px;font-weight:800;color:'+(extra==='insufficient'?'#ff5252':'#fff')+'">'+val+'</span></div>';
  }
  var html='<div style="position:relative;width:min(440px,94vw);max-height:92vh;overflow:auto;border-radius:14px;background:radial-gradient(circle at 50% 0%,rgba(255,209,102,.18),rgba(10,12,22,.98) 65%);border:1.5px solid rgba(255,209,102,.55);box-shadow:0 0 30px rgba(255,209,102,.25),0 18px 60px rgba(0,0,0,.7);padding:20px;animation:crPop .3s cubic-bezier(.2,1.3,.5,1)">'
    + '<div style="text-align:center;font-size:14px;font-weight:900;letter-spacing:1.5px;color:#ffd166">🔨 '+tl('ENHANCE','강화','強化','强化')+' '+(inst.icon||'')+' '+(inst.name||'Item')+' +'+lv+' → +'+(lv+1)+'</div>'
    + '<div style="margin-top:13px">'
    +   statRow('💰', tl('Cost','비용','コスト','费用'), gpCost+' GP')
    +   statRow('💎', tl('Balance','보유 GP','残高','余额'), Math.floor(myGP)+' GP', insufficient?'insufficient':'')
    +   (rate ? statRow('📊', tl('Success rate','성공 확률','成功率','成功率'), rate.rate+'%') : '')
    + '</div>';
  // 스크롤 토글
  if (protectOwned>0 || blessedOwned>0) {
    html += '<div style="margin-top:12px;padding:11px;border-radius:9px;background:rgba(184,140,255,.07);border:1px solid rgba(184,140,255,.3)">'
      + '<div style="font-size:10px;font-weight:800;color:#caa8ff;letter-spacing:.8px;margin-bottom:6px">📜 '+tl('SCROLLS — Enhance safety','스크롤 — 강화 안전 옵션','スクロール — 強化安全オプション','卷轴 — 强化安全选项')+'</div>';
    if (protectOwned>0) {
      html += '<label style="display:flex;align-items:center;gap:7px;font-size:10px;color:#e8d8ff;cursor:pointer;padding:3px 0"><input type="checkbox" id="enhUseProtect" style="cursor:pointer"> 🛡 '+tl('Protect scroll','보호 스크롤','保護スクロール','保护卷轴')+' — '+tl('No level drop on failure','실패 시 레벨 유지','失敗時もレベル維持','失败时保留等级')+' ('+protectOwned+' '+tl('owned','보유','所持','持有')+')</label>';
    }
    if (blessedOwned>0) {
      html += '<label style="display:flex;align-items:center;gap:7px;font-size:10px;color:#e8d8ff;cursor:pointer;padding:3px 0"><input type="checkbox" id="enhUseBlessed" style="cursor:pointer"> ✨ '+tl('Blessed scroll','축복 스크롤','祝福スクロール','祝福卷轴')+' — '+tl('Success rate boost','성공률 +20%','成功率+20%','成功率 +20%')+' ('+blessedOwned+' '+tl('owned','보유','所持','持有')+')</label>';
    }
    html += '</div>';
  }
  // 레시피
  if (recipes && recipes.length) {
    html += '<div style="margin-top:10px;padding:9px;border-radius:9px;background:rgba(76,216,154,.06);border:1px solid rgba(76,216,154,.25)"><div style="font-size:10px;font-weight:800;color:#5cd6a8;letter-spacing:.5px;margin-bottom:4px">🧪 '+tl('AVAILABLE RECIPES (bonus)','적용 가능 레시피 (보너스)','適用可能レシピ(ボーナス)','可用配方（加成）')+'</div>'
      + recipes.slice(0,3).map(function(r){return '<div style="font-size:9.5px;color:rgba(232,245,255,.85);padding:2px 0">• '+escapeHtmlSafe(r.label||r.id||'recipe')+(r.bonus_pct?' (+'+r.bonus_pct+'%)':'')+'</div>';}).join('')
      + '</div>';
  }
  html += '<div style="margin-top:15px;display:flex;gap:8px">'
    + '<button type="button" onclick="document.getElementById(\'enhanceAdvModal\').remove()" style="flex:1;padding:11px;border-radius:8px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.2);color:#fff;font-family:var(--fn);font-size:11px;font-weight:800;cursor:pointer">'+tl('CANCEL','취소','キャンセル','取消')+'</button>'
    + '<button type="button" '+(insufficient?'disabled':'')+' onclick="(function(){var u={useProtectScroll:(document.getElementById(\'enhUseProtect\')||{}).checked||false,useBlessedScroll:(document.getElementById(\'enhUseBlessed\')||{}).checked||false};document.getElementById(\'enhanceAdvModal\').remove();attemptEnhance('+inst.id+',u);})()" style="flex:1.4;padding:11px;border-radius:8px;background:linear-gradient(135deg,rgba(255,209,102,.5),rgba(255,209,102,.15));border:1px solid rgba(255,209,102,.7);color:#fff;font-family:var(--fn);font-size:12px;font-weight:900;cursor:'+(insufficient?'not-allowed':'pointer')+';opacity:'+(insufficient?'.5':'1')+'">🔨 '+tl('ENHANCE','강화','強化','强化')+'</button>'
    + '</div></div>';
  el.innerHTML = html;
  document.body.appendChild(el);
}

function attemptEnhance(instanceId, opts){
  // [v7.171 E-Crit fix] opts 인자 추가 — useProtectScroll/useBlessedScroll/recipeIds 전달 가능.
  var w=(walletState&&walletState.address)||'';
  if(!w) return;
  opts = opts || {};
  var body = { wallet:w, instanceId:instanceId };
  if (opts.useProtectScroll) body.use_protect_scroll = true;
  if (opts.useBlessedScroll) body.use_blessed_scroll = true;
  if (Array.isArray(opts.recipeIds) && opts.recipeIds.length) body.recipe_ids = opts.recipeIds;
  fetch('/api/enhance',{method:'POST',headers:Object.assign({'Content-Type':'application/json'},getAuthHeaders()),body:JSON.stringify(body)})
  .then(function(r){return r.json()}).then(function(d){
    if(d.error){showToast(srvErr(d.error),'error');return;}
    // Refresh GP balance
    refreshBalance();
    loadItemInstances(function(){
      // Show result
      if(d.success){
        showToast('✨ '+(t('enh_success')||'Enhancement succeeded!')+' +'+(d.toLevel),'success');
        try{ markDailyOpsAction('ship_upgrade', 1); }catch(_e){}
        // Re-open modal for next attempt if not maxed
        if(d.toLevel<10 && d.instanceId) setTimeout(function(){ openEnhanceModal(d.instanceId); },600);
      }else if(d.outcome==='stay'){
        showToast('😤 '+(t('enh_fail_stay')||'Enhancement failed. Level unchanged.')+' +'+d.toLevel,'warn');
        try{ markDailyOpsAction('ship_upgrade', 1); }catch(_e){}
        if(d.instanceId) setTimeout(function(){ openEnhanceModal(d.instanceId); },600);
      }else if(d.outcome==='downgrade'){
        showToast('📉 '+(t('enh_fail_down')||'Enhancement failed! Level dropped to')+' +'+d.toLevel,'error');
        try{ markDailyOpsAction('ship_upgrade', 1); }catch(_e){}
        if(d.instanceId) setTimeout(function(){ openEnhanceModal(d.instanceId); },600);
      }else if(d.outcome==='destroy'){
        showToast('💥 '+(t('enh_fail_destroy')||'Enhancement failed! Item destroyed!'),'error');
        try{ markDailyOpsAction('ship_upgrade', 1); }catch(_e){}
      }
    });
  }).catch(function(){showToast('Enhancement failed','error')});
}

// Load enhancement data on init
_setActiveTimeout(function(){ loadEnhancementData(); },3000);
