// ── 진형/기동 현 언어 라벨 (서버 name_ko 대신 코드→LANG) ──────────────
var _FC_FORMATION_I18N={
  sphere:{ko:'구형 집결',en:'Sphere',ja:'球形集結',zh:'球形集结'},
  wedge: {ko:'쐐기',en:'Wedge',ja:'楔形',zh:'楔形'},
  screen:{ko:'방어막',en:'Screen',ja:'防御陣',zh:'防御阵'},
  pincer:{ko:'협공',en:'Pincer',ja:'挟撃',zh:'夹击'},
  line:    {ko:'전열 횡대',en:'Line Abreast',ja:'横列',zh:'横列'},
  echelon: {ko:'사다리꼴',en:'Echelon',ja:'梯形',zh:'梯队'},
  vanguard:{ko:'호위 방진',en:'Vanguard Box',ja:'護衛方陣',zh:'护卫方阵'}
};
var _FC_MOVEMENT_I18N={
  advance:{ko:'전진',en:'Advance',ja:'前進',zh:'前进'},
  retreat:{ko:'후퇴',en:'Retreat',ja:'後退',zh:'后退'},
  flank:  {ko:'측면 우회',en:'Flank',ja:'側面迂回',zh:'侧翼迂回'},
  flank_left: {ko:'좌현 기동',en:'Port',ja:'左舷機動',zh:'左舷机动'},
  flank_right:{ko:'우현 기동',en:'Starboard',ja:'右舷機動',zh:'右舷机动'},
  scatter:{ko:'산개',en:'Scatter',ja:'散開',zh:'散开'},
  rally:  {ko:'재집결',en:'Rally',ja:'再集結',zh:'再集结'}
};
function _fcFormationName(code){var m=_FC_FORMATION_I18N[code];return m?(m[LANG]||m.en):code;}
function _fcMovementName(code){var m=_FC_MOVEMENT_I18N[code];return m?(m[LANG]||m.en):code;}
function _fleetSummaryRead(key,url,wallet){
  var walletKey=String(wallet||'anon').toLowerCase();
  if(typeof _guardedJsonFetch==='function'){
    return _guardedJsonFetch('fleet-summary:'+key+':'+walletKey, url, {
      minGap:15000,
      backoffMs:120000,
      fetchOptions:{headers:getAuthHeaders()}
    });
  }
  return fetch(url,{headers:getAuthHeaders()}).then(function(r){return r.ok?r.json():null;}).catch(function(){return null;});
}

// ── 함대 탭 요약 로드 ──────────────────────────────────────────────
function _loadFleetTabSummary(){
  var w=(walletState&&walletState.address)||'';
  var sumEl=document.getElementById('fleetTabSummary');
  var evEl=document.getElementById('fleetTabWorldEvents');
  if(!w){if(sumEl)sumEl.innerHTML='<div style="color:var(--tx3);font-size:9px;text-align:center;padding:12px">'+(LANG==='ko'?'로그인하면 함대 현황이 표시됩니다':LANG==='ja'?'ログインすると艦隊状況が表示されます':LANG==='zh'?'登录后将显示舰队状况':'Login to see fleet status')+'</div>';return;}
  if(!sumEl) return;
  var hadContent=!!sumEl.innerHTML.trim();
  if(!hadContent) sumEl.innerHTML='<div style="color:var(--tx3);font-size:9px;text-align:center;padding:12px">Loading...</div>';

  // 월드이벤트 복사 (기존)
  if(evEl){try{var srcEl=document.getElementById('fcmdWorldEventsList');if(srcEl)evEl.innerHTML=srcEl.innerHTML;}catch(_){}}

  // 병렬로 함대 + 함선 + 건조큐 로드
  Promise.all([
    _fleetSummaryRead('fleets','/api/fleets',w),
    _fleetSummaryRead('ships','/api/ships/my',w),
    _fleetSummaryRead('build-jobs','/api/ships/build-jobs',w)
  ]).then(function(results){
    if(!results[0]&&!results[1]&&!results[2]){
      if(!hadContent) sumEl.innerHTML='<div style="color:var(--tx3);font-size:9px;text-align:center;padding:12px">'+(LANG==='ko'?'함대 정보를 새로고침 중입니다':LANG==='ja'?'艦隊情報を更新中です':LANG==='zh'?'正在刷新舰队信息':'Refreshing fleet data')+'</div>';
      return;
    }
    var fleets=(results[0]&&results[0].fleets)||[];
    var ships=(results[1]&&results[1].ships)||[];
    var jobs=(results[2]&&results[2].jobs)||[];

    // 함선을 함대별로 그룹화
    var byFleet={};
    ships.forEach(function(s){
      if(!s.is_alive) return;
      var fid=s.fleet_id||'none';
      if(!byFleet[fid]) byFleet[fid]=[];
      byFleet[fid].push(s);
    });

    var html='';

    // ── 건조 중 큐 ──
    if(jobs.length>0){
      html+='<div style="margin-bottom:10px;padding:10px 10px 6px;border-radius:8px;background:rgba(255,209,102,.05);border:1px solid rgba(255,209,102,.18)">';
      html+='<div style="font-size:9px;color:var(--gold);font-weight:700;letter-spacing:1px;margin-bottom:8px">🔨 '+(LANG==='ko'?'건조 중':LANG==='ja'?'建造中':LANG==='zh'?'建造中':'Building')+' ('+jobs.length+')</div>';
      jobs.forEach(function(j){
        var pct=Math.min(100,j.progress_pct||0);
        var sec=Math.max(0,j.seconds_remaining||0);
        var tStr=sec>3600?Math.floor(sec/3600)+'h '+Math.floor((sec%3600)/60)+'m'
                :sec>60?Math.floor(sec/60)+'m '+Math.floor(sec%60)+'s'
                :Math.floor(sec)+'s';
        var fc=j.faction_color||'#5cbbff';
        html+='<div style="margin-bottom:7px">';
        html+='<div style="display:flex;justify-content:space-between;font-size:9px;margin-bottom:3px">';
        html+='<span style="color:'+fc+'">'+(j.name_ko||j.ship_type_code)+'</span>';
        html+='<span style="color:var(--tx3)">'+(j.class_label||j.size_class)+'</span>';
        html+='<span style="color:var(--gold)">'+tStr+'</span>';
        html+='</div>';
        html+='<div style="height:4px;background:rgba(255,255,255,.07);border-radius:2px;overflow:hidden">';
        html+='<div style="height:100%;width:'+pct+'%;background:linear-gradient(90deg,var(--gold),#ff8c00);border-radius:2px"></div>';
        html+='</div></div>';
      });
      html+='</div>';
    }

    // ── 함대 목록 ──
    if(!fleets.length){
      html+='<div style="text-align:center;color:var(--tx3);font-size:9px;padding:16px">'+t('fleet_no_fleet_hint')+'</div>';
    } else {
      fleets.forEach(function(f){
        var fShips=byFleet[f.id]||[];
        var hpPct=f.total_max_hp>0?Math.round(f.total_hp/f.total_max_hp*100):0;
        var hpC=hpPct>60?'#4cd89a':hpPct>30?'#ffd166':'#e84855';
        var aliveCount=f.ships_alive||0;

        html+='<div style="margin-bottom:8px;border:1px solid rgba(79,195,247,.18);border-radius:8px;overflow:hidden">';

        // 헤더
        html+='<div style="padding:8px 10px;background:rgba(79,195,247,.05);display:flex;align-items:center;gap:8px">';
        html+='<div style="flex:1;min-width:0">';
        html+='<div style="font-size:10px;font-weight:700;color:#5cbbff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">⚓ '+(f.name||(LANG==='ko'?'함대':LANG==='ja'?'艦隊':LANG==='zh'?'舰队':'Fleet'))+'</div>';
        // 함급 구성 칩
        html+='<div style="margin-top:3px;font-size:8px;display:flex;gap:5px;flex-wrap:wrap">';
        if(f.assembled_count>0) html+='<span style="color:#b388ff">'+(LANG==='ko'?'합체':LANG==='ja'?'合体':LANG==='zh'?'合体':'MECH')+'×'+f.assembled_count+'</span>';
        if(f.titan_count>0) html+='<span style="color:#ba68c8">'+(LANG==='ko'?'타이탄':LANG==='ja'?'タイタン':LANG==='zh'?'泰坦':'Titan')+'×'+f.titan_count+'</span>';
        if(f.battleship_count>0) html+='<span style="color:#ef5350">'+(LANG==='ko'?'전함':LANG==='ja'?'戦艦':LANG==='zh'?'战舰':'BS')+'×'+f.battleship_count+'</span>';
        if(f.cruiser_count>0) html+='<span style="color:#ffd166">'+(LANG==='ko'?'순양':LANG==='ja'?'巡洋':LANG==='zh'?'巡洋':'CA')+'×'+f.cruiser_count+'</span>';
        if(f.destroyer_count>0) html+='<span style="color:#81c784">'+(LANG==='ko'?'구축':LANG==='ja'?'駆逐':LANG==='zh'?'驱逐':'DD')+'×'+f.destroyer_count+'</span>';
        if(f.frigate_count>0) html+='<span style="color:#4fc3f7">'+(LANG==='ko'?'프리깃':LANG==='ja'?'フリゲート':LANG==='zh'?'护卫':'FF')+'×'+f.frigate_count+'</span>';
        if(aliveCount===0) html+='<span style="color:var(--red)">'+(LANG==='ko'?'함선 없음':LANG==='ja'?'艦船なし':LANG==='zh'?'无舰船':'No ships')+'</span>';
        html+='</div>';
        // 진형/기동 (현 언어로 — 서버 name_ko 대신 코드→LANG 라벨)
        if(f.formation||f.movement){
          html+='<div style="margin-top:2px;font-size:7px;color:var(--tx3)">';
          if(f.formation) html+=_fcFormationName(f.formation);
          if(f.formation&&f.movement) html+=' · ';
          if(f.movement) html+=_fcMovementName(f.movement);
          html+='</div>';
        }
        html+='</div>';

        // HP 요약 + 편집 버튼
        html+='<div style="text-align:right;flex-shrink:0">';
        if(f.total_max_hp>0){
          html+='<div style="font-size:10px;font-weight:700;color:'+hpC+'">'+hpPct+'%</div>';
          html+='<div style="font-size:7px;color:var(--tx3)">'+f.total_hp+'/'+f.total_max_hp+' HP</div>';
        }
        html+='<button type="button" onclick="openFleetCmd()" style="margin-top:4px;font-size:8px;padding:2px 8px;border-radius:4px;background:rgba(79,195,247,.12);border:1px solid rgba(79,195,247,.3);color:#5cbbff;cursor:pointer;font-family:var(--fn)">'+( LANG==='ko'?'편집':LANG==='ja'?'編集':LANG==='zh'?'编辑':'Edit')+'</button>';
        html+='</div>';
        html+='</div>'; // header end

        // 함대 전체 HP바
        if(f.total_max_hp>0){
          html+='<div style="height:3px;background:rgba(255,255,255,.06)">';
          html+='<div style="height:100%;width:'+hpPct+'%;background:'+hpC+';transition:width .5s"></div>';
          html+='</div>';
        }

        // 함선 목록
        if(fShips.length>0){
          html+='<div style="padding:6px 10px 8px;display:flex;flex-direction:column;gap:5px">';
          var shown=fShips.slice(0,12);
          shown.forEach(function(s){
            var hp=s.max_hp>0?Math.round(s.current_hp/s.max_hp*100):0;
            var hc=hp>60?'#4cd89a':hp>30?'#ffd166':'#e84855';
            var fc2=s.faction_color||'#5cbbff';
            html+='<div style="display:flex;align-items:center;gap:6px">';
            // 파벌 도트
            html+='<div style="width:5px;height:5px;border-radius:50%;background:'+fc2+';flex-shrink:0"></div>';
            html+='<div style="flex:1;min-width:0">';
            html+='<div style="display:flex;justify-content:space-between;align-items:center;font-size:8px;margin-bottom:2px">';
            html+='<span style="color:var(--tx);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:60%">'+(s.is_flagship?'★ ':'')+(s.name_ko||s.ship_type_code)+'</span>';
            html+='<span style="color:'+hc+';flex-shrink:0;font-size:8px">'+s.current_hp+'/'+s.max_hp+'</span>';
            html+='</div>';
            html+='<div style="height:3px;background:rgba(255,255,255,.07);border-radius:2px;overflow:hidden">';
            html+='<div style="height:100%;width:'+hp+'%;background:'+hc+';border-radius:2px"></div>';
            html+='</div>';
            html+='</div></div>';
          });
          if(fShips.length>12){
            html+='<div style="font-size:8px;color:var(--tx3);text-align:center;padding-top:2px">+'+
              (fShips.length-12)+(LANG==='ko'?'척 더 (함대 관리에서 전체 보기)':LANG==='ja'?'隻以上 (艦隊管理で全表示)':LANG==='zh'?'艘以上 (在舰队管理中查看全部)':' more (view all in Fleet Cmd)')+'</div>';
          }
          html+='</div>';
        } else if(aliveCount>0){
          html+='<div style="padding:6px 10px;font-size:8px;color:var(--tx3);text-align:center">'+aliveCount+(LANG==='ko'?'척 배치됨':LANG==='ja'?'隻配備済':LANG==='zh'?'艘部署中':' deployed')+'</div>';
        }

        html+='</div>'; // fleet card end
      });
    }

    sumEl.innerHTML=html;
  }).catch(function(e){
    sumEl.innerHTML='<div style="color:var(--tx3);font-size:9px;text-align:center;padding:12px">'+(LANG==='ko'?'함대 정보 로드 실패':LANG==='ja'?'艦隊情報の読み込み失敗':LANG==='zh'?'舰队信息加载失败':'Failed to load fleet data')+'</div>';
  });
}

// ── 대카테고리 전환 ──────────────────────────────────────────────────
function switchBaseCat(cat, el) {
  window._lastBaseCat = cat;
  // 카테고리 버튼 활성
  document.querySelectorAll('.bcat').forEach(function(b){ b.classList.remove('active'); });
  if(el) el.classList.add('active');
  else {
    var btn=document.querySelector('.bcat[data-cat="'+cat+'"]');
    if(btn) btn.classList.add('active');
  }
  // 서브탭 보임/숨김
  document.querySelectorAll('.base-tab').forEach(function(t){
    if(t.dataset.cat===cat){ t.classList.add('cat-show'); }
    else { t.classList.remove('cat-show'); }
  });
  // 해당 카테고리의 첫 번째 탭 자동 선택
  var first=document.querySelector('.base-tab[data-cat="'+cat+'"]');
  if(first) first.click();
}

// [v7.137] 레벨별 탭 해금 — 고급 탭만 게이트(핵심 초반 루프는 항상 열림). 잠긴 탭은 🔒Lv N.
var BASE_TAB_MIN_LEVEL = { fleet:3, transport:4, pvp:6, guild:8, govern:10 };
function _myBaseLevel(){ return parseInt((document.getElementById('profileLevel')||{}).textContent||'0')||0; }
function _tabGatingOn(){ return window.LEVEL_GATING_ENABLED!==false; }
// 잠겨 있으면 필요 레벨 반환, 아니면 0. 레벨 미확정(0)이면 fail-open(잘못 잠그지 않음).
function baseTabLocked(tab){
  if(!_tabGatingOn()) return 0;
  var req = BASE_TAB_MIN_LEVEL[tab]||0;
  if(!req) return 0;
  var lv=_myBaseLevel();
  if(lv<=0) return 0;
  return lv < req ? req : 0;
}
function applyBaseTabLocks(){
  Object.keys(BASE_TAB_MIN_LEVEL).forEach(function(tab){
    var el=document.getElementById('baseTab'+tab.charAt(0).toUpperCase()+tab.slice(1));
    if(!el) return;
    el.querySelectorAll('.tab-lock').forEach(function(x){x.remove()});
    var need=baseTabLocked(tab);
    if(need){
      el.style.opacity='.5';
      var lk=document.createElement('span'); lk.className='tab-lock'; lk.style.cssText='font-size:8px;margin-left:3px;color:#ffab40;font-weight:700'; lk.textContent='🔒'+need; el.appendChild(lk);
    } else { el.style.opacity=''; }
  });
}
var _questAuxLoadTimers=[];
function _cancelQuestAuxLoads(){
  if(!_questAuxLoadTimers.length) return;
  _questAuxLoadTimers.forEach(function(id){ try{ _clearActiveTimeout(id); }catch(_e){} });
  _questAuxLoadTimers=[];
}
function _scheduleQuestAuxLoads(){
  _cancelQuestAuxLoads();
  [
    'loadAchievements',
    'loadWeeklyChallenges',
    'loadBountyBoard',
    'loadContestSection',
    'loadDuelPanel',
    'loadAlliancePanel',
    'refreshTournaments',
    'loadActiveBroadcasts',
    'refreshWagerPools',
    'refreshRaffles',
    'refreshPolls',
    'loadDonationWall',
    'loadCapsuleUpcoming'
  ].forEach(function(fnName,idx){
    var id=_setActiveTimeout(function(){
      _questAuxLoadTimers=_questAuxLoadTimers.filter(function(tid){return tid!==id;});
      var pane=document.getElementById('basePane_quests');
      if(!pane||!pane.classList.contains('active')) return;
      var fn=window[fnName];
      if(typeof fn!=='function') return;
      try{ fn(); }catch(_e){}
    }, 120*(idx+1));
    _questAuxLoadTimers.push(id);
  });
}
function stopBaseTransientWork(nextTab){
  if(nextTab!=='guild') try{ stopGuildChatPoll(); }catch(_e){}
  if(nextTab!=='ops'){
    try{
      if(window._opsTimer){ _clearActiveInterval(window._opsTimer); window._opsTimer=null; }
      if(typeof _opsPreviewTimer!=='undefined' && _opsPreviewTimer){ _clearActiveTimeout(_opsPreviewTimer); _opsPreviewTimer=null; }
    }catch(_e){}
  }
  if(nextTab!=='territory'){
    try{
      if(typeof _opsBoardCountdownTimer!=='undefined' && _opsBoardCountdownTimer){ _clearActiveInterval(_opsBoardCountdownTimer); _opsBoardCountdownTimer=null; }
    }catch(_e){}
  }
  if(nextTab!=='market'){
    try{
      if(typeof _auctionTimers!=='undefined' && _auctionTimers.length){
        _auctionTimers.forEach(function(id){ _clearActiveInterval(id); });
        _auctionTimers=[];
      }
    }catch(_e){}
  }
  if(nextTab!=='rank'){
    try{
      if(typeof _lotteryCountdownTimer!=='undefined' && _lotteryCountdownTimer){ _clearActiveInterval(_lotteryCountdownTimer); _lotteryCountdownTimer=null; }
    }catch(_e){}
  }
  if(nextTab!=='quests'){
    _cancelQuestAuxLoads();
    try{
      if(typeof _dailyTimerInterval!=='undefined' && _dailyTimerInterval){ _clearActiveInterval(_dailyTimerInterval); _dailyTimerInterval=null; }
      if(typeof _missionRefreshTimer!=='undefined' && _missionRefreshTimer){ _clearActiveTimeout(_missionRefreshTimer); _missionRefreshTimer=null; }
    }catch(_e){}
  }
}
function switchBaseTab(tab,el){
  // 레벨 게이트: 고급 탭은 필요 레벨 미달 시 차단 + 안내
  var _need=baseTabLocked(tab);
  if(_need){
    var _lg=(typeof LANG!=='undefined'?LANG:'ko');
    if(typeof showToast==='function') showToast((_lg==='ko'?'🔒 레벨 '+_need+' 부터 이용 가능합니다':_lg==='ja'?'🔒 レベル '+_need+' から利用可能':_lg==='zh'?'🔒 等级 '+_need+' 起可用':'🔒 Unlocks at Level '+_need),'error');
    return;
  }
  stopBaseTransientWork(tab);
  document.querySelectorAll('.base-tab').forEach(function(t){t.classList.remove('active')});
  document.querySelectorAll('.base-pane').forEach(function(p){p.classList.remove('active')});
  // el can be null when called programmatically — find tab button by id fallback
  if(!el) el = document.getElementById('baseTab'+tab.charAt(0).toUpperCase()+tab.slice(1));
  if(el) {
    el.classList.add('active');
    // 해당 탭의 카테고리도 활성화
    var cat = el.dataset && el.dataset.cat;
    if(cat) {
      var activeCat = document.querySelector('.bcat.active');
      if(!activeCat || activeCat.dataset.cat !== cat) {
        // 카테고리 버튼만 업데이트 (재귀 방지를 위해 switchBaseCat 호출 안 함)
        document.querySelectorAll('.bcat').forEach(function(b){ b.classList.remove('active'); });
        var catBtn = document.querySelector('.bcat[data-cat="'+cat+'"]');
        if(catBtn) catBtn.classList.add('active');
        document.querySelectorAll('.base-tab').forEach(function(t){
          if(t.dataset.cat===cat) t.classList.add('cat-show');
          else t.classList.remove('cat-show');
        });
      }
    }
  }
  var pane = document.getElementById('basePane_'+tab);
  if(pane) pane.classList.add('active');
  // Quest tracking for tab views
  if(tab==='sectors') { try{trackQuestAction('view_sectors',1)}catch(e){} if(!_newsPanelOpen){toggleNewsPanel();} try{ if(typeof loadBaseSectorList==='function') loadBaseSectorList(); }catch(e){} }
  if(tab==='rank'){try{trackQuestAction('view_leaderboard',1)}catch(e){} try{loadSeasonLeaderboard()}catch(e){}}
  if(tab==='quests'){var w=walletState.address;if(w)loadQuests(w); _scheduleQuestAuxLoads(); }
  if(tab==='mining'){ try{ _renderShipMining(); }catch(_e){} }
  if(tab==='govern') loadGovernanceData();
  if(tab==='guild') loadGuildTab();
  if(tab==='pvp') { try{loadDuelPanel()}catch(_e){} try{loadBattlePanel()}catch(_e){} try{if(typeof pvpHubSwitchTab==='function')pvpHubSwitchTab('rec');}catch(_e){} try{if(typeof kbSwitchTab==='function')kbSwitchTab('board');}catch(_e){} }
  if(tab==='fleet') { try{_loadFleetTabSummary();}catch(_e){} }
  try{ clearBaseTabDot(tab); }catch(_e){}
}

// ── BASE tab "new info" blink dots ──────────────────
// Each dot turns on when a tab has new info since user last opened it, and
// clears on open. Uses localStorage for last-seen timestamps so users return
// for new content (guild chat, season rewards, quest claims, etc.).
window._baseDotSeen = (function(){
  try{ return JSON.parse(localStorage.getItem('base_tab_seen')||'{}'); }catch(_e){return {}}
})();
function _saveDotSeen(){ try{ localStorage.setItem('base_tab_seen', JSON.stringify(window._baseDotSeen)); }catch(_e){} }
// Tracks latest polled counts so clearBaseTabDot can snapshot them
var _pollDotState = {};
var BASE_DOT_CLOSED_POLL_MS = 300000;
var _lastBaseDotClosedPollAt = 0;
function _baseModalIsOpen(){
  var el = document.getElementById('baseModal');
  return !!(el && el.classList.contains('open'));
}
function _shouldRunBaseDotPoll(force){
  if (!_pageIsActive()) return false;
  if (!(window.walletState && walletState.address)) return false;
  if (window._authSubmitInFlight) return false;
  if (force || _baseModalIsOpen()) return true;
  var now = Date.now();
  if (now - _lastBaseDotClosedPollAt < BASE_DOT_CLOSED_POLL_MS) return false;
  _lastBaseDotClosedPollAt = now;
  return true;
}
function requestBaseDotPoll(force){
  try{ _pollBaseTabDots(!!force); }catch(_e){}
}
window.requestBaseDotPoll = requestBaseDotPoll;
// [v7.183] 카테고리 dot 동기화 — 어느 sub-tab 이라도 dot 켜져 있으면 부모 .bcat 에 .has-dot 부여.
// setBaseTabDot / clearBaseTabDot / _pollBaseTabDots 직후 항상 호출돼야 함.
function _syncBcatDots(){
  try {
    document.querySelectorAll('.bcat[data-cat]').forEach(function(b){
      var cat = b.getAttribute('data-cat');
      if (!cat) return;
      // 같은 카테고리의 base-tab 중 .tab-dot 이 visible 인 게 하나라도 있나
      var anyOn = Array.prototype.some.call(
        document.querySelectorAll('.base-tab[data-cat="'+cat+'"] .tab-dot'),
        function(d){ return d.style.display !== 'none' && d.style.display !== ''; }
      );
      // 처음 로드 시 style.display 가 '' 라 false. CSS 기본은 display:none 이므로 정확히 매칭.
      // 일부 dot 은 inline style.display='block' 으로 켜짐.
      b.classList.toggle('has-dot', !!anyOn);
    });
  } catch(_) {}
}
window._syncBcatDots = _syncBcatDots;

window.clearBaseTabDot = function(tab){
  var map = {territory:'territoryDot',sectors:'sectorsDot',rank:'rankDot',mining:'miningDot',quests:'questsDot',guild:'guildDot',ops:'opsDot',govern:'governDot',shop:'shopDot',market:'marketDot',pvp:'pvpDot',transport:'transportDot',fleet:'fleetDot',items:'itemsDot'};
  var id = map[tab]; if(!id) return;
  var el = document.getElementById(id); if(el) el.style.display='none';
  window._baseDotSeen[tab] = Date.now();
  // Save current state so dot resets only when things CHANGE
  if(tab==='territory' && window._cmdInfo){
    window._baseDotSeen.territory_cmd = (_cmdInfo.commander||'').toLowerCase();
  }
  if(tab==='sectors' && window._sectorsData){
    (_sectorsData||[]).forEach(function(s){
      if(s.governor) window._baseDotSeen['sectors_gov_'+s.id] = (s.governor||'').toLowerCase();
    });
  }
  if(tab==='guild'){
    window._baseDotSeen.guild_chat = Date.now();
    window._baseDotSeen._guild_invite_seen = _pollDotState.guild_invites || 0;
  }
  // INFO tabs: snapshot count — dot won't re-enable until count increases
  // (govern, guild invites = "you saw it" is enough)
  if(tab==='govern') window._baseDotSeen._govern_seen = _pollDotState.govern_count || 0;
  if(tab==='market') window._baseDotSeen._market_sold_seen = _pollDotState.market_sold || 0;
  if(tab==='shop')   window._baseDotSeen._shop_item_seen   = _pollDotState.shop_items || 0;
  if(tab==='items')  window._baseDotSeen._items_cnt_seen   = _pollDotState.items_cnt || 0; // [v7.274] 누락 시 ITEMS 탭 dot 영구 점멸(SHOP과 동일 클래스)
  if(tab==='pvp')    window._baseDotSeen._pvp_seen         = _pollDotState.pvp_active || 0;
  // ACTION tabs (quests, ops, rank/season): do NOT snapshot — dot re-appears
  // on next poll if unclaimed items still exist, until user actually claims them
  _saveDotSeen();
  if(typeof _updateBaseBtnDot==='function') _updateBaseBtnDot();
  _syncBcatDots(); // [v7.183] 부모 .bcat dot 동기화
};
window.setBaseTabDot = function(tab, on){
  var map = {territory:'territoryDot',sectors:'sectorsDot',rank:'rankDot',mining:'miningDot',quests:'questsDot',guild:'guildDot',ops:'opsDot',govern:'governDot',shop:'shopDot',market:'marketDot',pvp:'pvpDot',transport:'transportDot',fleet:'fleetDot',items:'itemsDot'};
  var id = map[tab]; if(!id) return;
  var el = document.getElementById(id); if(el) el.style.display = on ? 'block' : 'none';
  if(typeof _updateBaseBtnDot==='function') _updateBaseBtnDot();
  _syncBcatDots(); // [v7.183] 부모 .bcat dot 동기화
};
// Poll once a minute for new info across tabs. Minimal server hits —
// piggybacks on existing endpoints.
// Key principle: dots only appear for CHANGES since user last viewed.
// _pollDotState tracks latest counts; clearBaseTabDot snapshots them
// so the same state won't re-trigger a dot.
function _pollBaseTabDots(force){
  if (!_shouldRunBaseDotPoll(force)) return;
  var seen = window._baseDotSeen || {};
  // TERRITORY: commander announcement OR commander changed
  try{
    if(window._cmdInfo){
      var cmdChanged = false;
      var curCmd = (_cmdInfo.commander||'').toLowerCase();
      if(curCmd && curCmd !== (seen.territory_cmd||'')) cmdChanged = true;
      if(_cmdInfo.announcementAt){
        var tt = new Date(_cmdInfo.announcementAt).getTime();
        if(tt && tt > (seen.territory||0)) cmdChanged = true;
      }
      if(cmdChanged) setBaseTabDot('territory', true);
    }
  }catch(_e){}
  // SECTORS: sector announcement OR governor changed
  try{
    var secs = (_sectorsData||[]);
    var sectorsChanged = false;
    secs.forEach(function(s){
      if(s.announcementAt){
        var tt=new Date(s.announcementAt).getTime();
        if(tt > (seen.sectors||0)) sectorsChanged = true;
      }
      var gov = (s.governor||'').toLowerCase();
      var seenGovKey = 'sectors_gov_'+s.id;
      if(gov && gov !== (seen[seenGovKey]||'')) sectorsChanged = true;
    });
    if(sectorsChanged) setBaseTabDot('sectors', true);
  }catch(_e){}
  // Helper: auto-snapshot if user already viewed a tab before this code update
  // (prevents dots from firing for existing state when _X_seen keys don't exist yet)
  function _autoSnap(tab, snapKey, count){
    if(!(snapKey in seen) && seen[tab]){
      seen[snapKey] = count; _saveDotSeen();
    }
  }
  // SEASON: new season or NEW unclaimed rewards (count must increase)
  _guardedJsonFetch('dot-season-active', '/api/season/active', {minGap:55000, backoffMs:180000}).then(function(d){
    if (!d) return;
    try{
      var s = d && d.season;
      if(s){
        var start = new Date(s.startsAt).getTime();
        if(start && start > (seen.rank||0)) setBaseTabDot('rank', true);
      }
      if(d && d.myRewards && d.myRewards.length){
        var unclaimed = d.myRewards.filter(function(r){ return !r.claimed; }).length;
        _pollDotState.rank_unclaimed = unclaimed;
        // ACTION: unclaimed rewards → dot persists until claimed
        if(unclaimed > 0) setBaseTabDot('rank', true);
      }
    }catch(_e){}
  }).catch(function(){});
  // GUILD: NEW invites (count must increase) + new chat messages
  _guardedJsonFetch('dot-guild-invites', '/api/guild/invites', {minGap:55000, backoffMs:180000, fetchOptions:{headers:getAuthHeaders()}}).then(function(d){
    if (!d) return;
    try{
      var invites = (d && d.invites) || [];
      _pollDotState.guild_invites = invites.length;
      _autoSnap('guild','_guild_invite_seen',invites.length);
      if(invites.length > 0 && invites.length > (seen._guild_invite_seen||0)){
        setBaseTabDot('guild', true);
      }
    }catch(_e){}
  }).catch(function(){});
  // Guild chat: new messages since last seen
  try{
    if(window._myGuildData && _myGuildData.id){
      _guardedJsonFetch('dot-guild-chat', '/api/guild/chat/'+_myGuildData.id+'?limit=1', {minGap:55000, backoffMs:180000, fetchOptions:{headers:getAuthHeaders()}}).then(function(d){
        if (!d) return;
        try{
          var msgs = d && d.messages || [];
          if(msgs.length){
            var newest = new Date(msgs[0].created_at).getTime();
            if(newest > (seen.guild_chat||0)) setBaseTabDot('guild', true);
          }
        }catch(_e){}
      }).catch(function(){});
    }
  }catch(_e){}
  // MINING: REMOVED from poll — startMineTimer already shows dot when cooldown expires
  // QUESTS: only dot if claimable count INCREASED since user last viewed
  _guardedJsonFetch('dot-quests', '/api/quests', {minGap:55000, backoffMs:180000, fetchOptions:{headers:getAuthHeaders()}}).then(function(d){
    if (!d) return;
    try{
      var quests = d && d.quests || [];
      var claimable = quests.filter(function(q){ return q.status==='completed'; }).length;
      _pollDotState.quests_claimable = claimable;
      // ACTION: claimable quests → dot persists until claimed
      if(claimable > 0) setBaseTabDot('quests', true);
    }catch(_e){}
  }).catch(function(){});
  // OPS: only dot if claimable count INCREASED since user last viewed
  _guardedJsonFetch('dot-ops-missions', '/api/missions/active', {minGap:55000, backoffMs:180000, fetchOptions:{headers:getAuthHeaders()}}).then(function(d){
    if (!d) return;
    try{
      var missions = d && d.missions || [];
      var claimable = missions.filter(function(m){ return m.status==='complete'; }).length;
      _pollDotState.ops_claimable = claimable;
      // ACTION: claimable missions → dot persists until claimed
      if(claimable > 0) setBaseTabDot('ops', true);
    }catch(_e){}
  }).catch(function(){});
  // GOVERN: only dot if active bounty/event count INCREASED since user last viewed
  Promise.all([
    _guardedJsonFetch('dot-govern-bounties', '/api/governance/bounties', {minGap:55000, backoffMs:180000}).then(function(d){return d || [];}),
    _guardedJsonFetch('dot-govern-events', '/api/governance/events', {minGap:55000, backoffMs:180000}).then(function(d){return d || [];})
  ]).then(function(results){
    try{
      var bounties = Array.isArray(results[0]) ? results[0] : [];
      var events = Array.isArray(results[1]) ? results[1] : [];
      var ab = bounties.filter(function(b){ return b.status==='open' || b.status==='active'; }).length;
      var ae = events.filter(function(e){ return e.status==='active'; }).length;
      var total = ab + ae;
      _pollDotState.govern_count = total;
      _autoSnap('govern','_govern_seen',total);
      if(total > 0 && total > (seen._govern_seen||0)){
        setBaseTabDot('govern', true);
      }
    }catch(_e){}
  }).catch(function(){});

  // MARKET: 내 리스팅 중 판매된 건 있으면 dot
  _guardedJsonFetch('dot-market-listings', '/api/marketplace/my-listings', {minGap:55000, backoffMs:180000, fetchOptions:{headers:getAuthHeaders()}}).then(function(d){
    if (!d) return;
    try{
      var listings = Array.isArray(d) ? d : (d.listings||[]);
      var soldCount = listings.filter(function(l){ return l.status==='sold'; }).length;
      _pollDotState.market_sold = soldCount;
      _autoSnap('market','_market_sold_seen',soldCount);
      if(soldCount > 0 && soldCount > (seen._market_sold_seen||0)) setBaseTabDot('market', true);
    }catch(_e){}
  }).catch(function(){});

  // PVP: 진행중인 함대전 있으면 dot
  _guardedJsonFetch('dot-fleet-battles', '/api/fleet-battles', {minGap:55000, backoffMs:180000, fetchOptions:{headers:getAuthHeaders()}}).then(function(d){
    if (!d) return;
    try{
      var battles = Array.isArray(d) ? d : (d.battles||[]);
      var active = battles.filter(function(b){ return b.status==='active'||b.status==='pending'; }).length;
      _pollDotState.pvp_active = active;
      _autoSnap('pvp','_pvp_seen',active);
      if(active > 0 && active > (seen._pvp_seen||0)) setBaseTabDot('pvp', true);
    }catch(_e){}
  }).catch(function(){});

  // SHOP: 새 아이템(미확인) 있으면 dot — 아이템 총 개수 변화로 감지
  _guardedJsonFetch('dot-shop-items', '/api/shop/items', {minGap:55000, backoffMs:180000}).then(function(d){
    if (!d) return;
    try{
      var items = Array.isArray(d) ? d : (d.items||[]);
      var cnt = items.length;
      _pollDotState.shop_items = cnt; // [v7.272] 누락 시 clearBaseTabDot 스냅샷이 undefined→0 되어 SHOP dot 영구 점멸하던 버그 수정
      _autoSnap('shop','_shop_item_seen',cnt);
      if(cnt > (seen._shop_item_seen||0)) setBaseTabDot('shop', true);
    }catch(_e){}
  }).catch(function(){});

  // FLEET: 건조 완료된 함선 있으면 dot
  _guardedJsonFetch('dot-ship-build-jobs', '/api/ships/build-jobs', {minGap:55000, backoffMs:180000, fetchOptions:{headers:getAuthHeaders()}}).then(function(d){
    if (!d) return;
    try{
      var jobs = Array.isArray(d) ? d : (d.jobs||d.build_jobs||[]);
      var done = jobs.filter(function(j){ return j.status==='completed'||j.status==='ready'; }).length;
      if(done > 0) setBaseTabDot('fleet', true);
    }catch(_e){}
  }).catch(function(){});

  // TRANSPORT: 도착한 수송 있으면 dot
  _guardedJsonFetch('dot-transport-my', '/api/transport/my?limit=30', {minGap:55000, backoffMs:180000, fetchOptions:{headers:getAuthHeaders()}}).then(function(d){
    if (!d) return;
    try{
      var list = Array.isArray(d) ? d : (d.shipments||d.transports||[]);
      var arrived = list.filter(function(s){
        return s.status==='arrived'||s.status==='completed'||s.status==='delivered';
      }).length;
      if(arrived > 0) setBaseTabDot('transport', true);
    }catch(_e){}
  }).catch(function(){});

  // ITEMS: 새 아이템 인스턴스 개수 변화 감지
  _guardedJsonFetch('dot-item-instances', '/api/items/instances', {minGap:55000, backoffMs:180000, fetchOptions:{headers:getAuthHeaders()}}).then(function(d){
    if (!d) return;
    try{
      var items = Array.isArray(d) ? d : (d.instances||d.items||[]);
      var cnt = items.length;
      _pollDotState.items_cnt = cnt;
      _autoSnap('items','_items_cnt_seen',cnt);
      if(cnt > (seen._items_cnt_seen||0)) setBaseTabDot('items', true);
    }catch(_e){}
  }).catch(function(){});

  // 🔔 NOTIFICATION BADGE: poll unread count
  try{ loadNotifCount(); }catch(_e){}

  // QUESTS tab: also check daily missions (completable but unclaimed)
  try{
    if(_dailyState && _dailyState.missions && _dailyState.missions.length){
      var dailyClaimable = _dailyState.missions.filter(function(m){
        var cur = m.current != null ? m.current : 0;
        var tgt = m.target != null ? m.target : 999;
        return !m.claimed && cur >= tgt;
      }).length;
      if(dailyClaimable > 0) setBaseTabDot('quests', true);
    }
  }catch(_e){}
}
_setActiveTimeout(_pollBaseTabDots, 8000);
_setActiveInterval(_pollBaseTabDots, 60000);
