/* ═══════════════════════════════════════════════
   ANNOUNCEMENT BANNER
   ═══════════════════════════════════════════════ */
(function(){
  var _announceDismissed = sessionStorage.getItem('announce_dismissed');
  var POLL_INTERVAL = 120000; // 2분마다 갱신

  function wlfReadFetch(key, url, minGap, auth) {
    var walletKey = (window.walletState && walletState.address) ? String(walletState.address).toLowerCase() : 'public';
    if (typeof _guardedJsonFetch === 'function') {
      return _guardedJsonFetch('world-live:' + key + ':' + walletKey, url, {
        minGap: minGap || 10000,
        backoffMs: 90000,
        fetchOptions: auth ? { headers: getAuthHeaders() } : {}
      });
    }
    return fetch(url, auth ? { headers: getAuthHeaders() } : {}).then(function(r){ return r.json(); });
  }
  function wlfHasPlayerSession() {
    if (window.walletState && walletState.connected && walletState.address) return true;
    try { return !!localStorage.getItem('pw_token'); } catch (_) { return false; }
  }

  function showAnnounce(text){
    if(!text || _announceDismissed === text) return;
    var banner = document.getElementById('announceBanner');
    var track  = document.getElementById('announceTrack');
    if(!banner||!track) return;

    // 텍스트 길이에 따라 속도 조절 (짧으면 빠르게, 길면 느리게)
    var dur = Math.max(15, Math.min(60, text.length * 0.4));
    banner.style.setProperty('--dur', dur + 's');

    // 2번 반복하여 끊김 없는 루프
    track.innerHTML = '';
    for(var i=0;i<2;i++){
      var span = document.createElement('span');
      span.className = 'announce-item';
      span.textContent = text;
      track.appendChild(span);
    }

    banner.classList.add('show');
  }

  window.closeAnnounce = function(){
    var banner = document.getElementById('announceBanner');
    if(banner) banner.classList.remove('show');
    // 이번 세션에서는 다시 안 보임
    var track = document.getElementById('announceTrack');
    if(track && track.firstChild) _announceDismissed = track.firstChild.textContent;
    sessionStorage.setItem('announce_dismissed', _announceDismissed||'');
  };

  // ═══════ GOVERNANCE VISIBILITY ═══════

  // Commander banner: poll + display (global for _drawSectorOverlay access)
  window._cmdInfo = null;
  window._cmdExpanded = localStorage.getItem('pw_cmd_expanded')==='1';
  window.toggleCmdExpand = function(){
    window._cmdExpanded = !window._cmdExpanded;
    localStorage.setItem('pw_cmd_expanded', window._cmdExpanded?'1':'0');
    if(typeof loadCommanderBanner==='function') loadCommanderBanner();
  };
  function _hideCommanderUI() {
    var el = document.getElementById('tbCommander');
    if (el) el.classList.remove('show');
    var box = document.getElementById('baseCmdAnnounceBox');
    if (box) box.style.display = 'none';
    var txt = document.getElementById('baseCmdAnnounceText');
    if (txt) txt.textContent = '';
    var nameEl = document.getElementById('baseCmdAnnounceName');
    if (nameEl) nameEl.textContent = '';
  }
  function loadCommanderBanner() {
    _guardedJsonFetch('commander-banner', '/api/governance/commander', {minGap:15000, backoffMs:120000}).then(function(info){
      if (!info) return;
      _cmdInfo = info;
      // commander 가 비어있으면 즉시 모든 UI 숨김 (orphan 방어)
      if (!info || !info.commander) { _hideCommanderUI(); return; }
      var el = document.getElementById('tbCommander');
      var nameEl = document.getElementById('tbCmdName');
      if (!el || !nameEl) return;
      // Respect user display toggle — hide banner + announcement if off
      var showBar = (typeof getDisplaySetting==='function') ? getDisplaySetting('commanderBar') : true;
      if (info.commander && showBar) {
        var name = info.commanderNickname || (info.commander.slice(0,6)+'...'+info.commander.slice(-4));
        nameEl.textContent = name;
        el.classList.add('show');
      } else {
        el.classList.remove('show');
      }
      // Commander announcement is now shown ONLY inside BASE > TERRITORY tab.
      // Never display on main screen — keep overlay hidden.
      var cmdAnnEl = document.getElementById('tbCmdAnnounce');
      if (cmdAnnEl) cmdAnnEl.style.display = 'none';
      // Also mirror into BASE > TERRITORY tab.
      // Commander 가 없거나(임기 종료) announcement 가 비면 박스 숨김 — 옛 메시지가 남지 않도록.
      var baseAnnBox = document.getElementById('baseCmdAnnounceBox');
      var baseAnnText = document.getElementById('baseCmdAnnounceText');
      var baseAnnName = document.getElementById('baseCmdAnnounceName');
      if (baseAnnBox && baseAnnText) {
        if (info && info.commander && info.announcement) {
          baseAnnText.textContent = info.announcement;
          if (baseAnnName) baseAnnName.textContent = info.commanderNickname ? ('— ' + info.commanderNickname) : '';
          baseAnnBox.style.display = '';
        } else {
          baseAnnText.textContent = '';
          if (baseAnnName) baseAnnName.textContent = '';
          baseAnnBox.style.display = 'none';
        }
      }
      updateGovRoles();
    }).catch(function(){ _hideCommanderUI(); });
  }
  // Load on boot + poll every 60s + refresh on tab visibility/focus.
  // 커맨더 임기 종료 / announcement 변경이 즉시 반영되도록 다층 트리거.
  _setActiveTimeout(loadCommanderBanner, 2000);
  _setActiveInterval(loadCommanderBanner, 60000);
  // 탭 복귀 / 창 포커스 시 즉시 fresh 데이터 (사용자가 admin 에서 변경하고 게임 탭 돌아왔을 때)
  _onPageVisible(loadCommanderBanner);
  _onPageFocus(loadCommanderBanner);
  // 외부에서 호출 가능 (예: admin 변경 직후)
  window.refreshCommander = loadCommanderBanner;

  // ── GP Colony Announcements polling ──
  var _gpAnnounceIdx = 0;
  function pollGPAnnouncements() {
    if (!_pageIsActive()) return;
    _guardedJsonFetch('gp-announcements', '/api/announce/active', {minGap:30000, backoffMs:120000}).then(function(items){
      if (!items || !items.length) return;
      // Cycle through active announcements round-robin
      var item = items[_gpAnnounceIdx % items.length];
      _gpAnnounceIdx++;
      var author = item.player_name || item.wallet.slice(0,10)+'…';
      if (typeof showAnnounce === 'function') {
        showAnnounce('📢 ' + author + ': ' + item.message);
      }
    }).catch(function(){});
  }
  _setActiveTimeout(pollGPAnnouncements, 5000);
  _setActiveInterval(pollGPAnnouncements, 120000);

  // ═══════ WEATHER POLLING + BANNER ═══════
  function loadWeatherData() {
    if (!_pageIsActive()) return;
    _guardedJsonFetch('weather-data', '/api/weather', {minGap:30000, backoffMs:120000, fetchOptions:{headers:getAuthHeaders()}}).then(function(data){
      if (!data) return;
      _weatherData = data.active || [];
      updateWeatherBanner();
      // Trigger texture refresh if weather changed
      if (_weatherData.length > 0) compositeClaimsOnTexture();
    }).catch(function(){});
  }
  // Collapsed state persists in localStorage
  window._toggleWeatherBar = function(){
    var collapsed = localStorage.getItem('pw_wx_collapsed')==='1';
    localStorage.setItem('pw_wx_collapsed', collapsed?'0':'1');
    updateWeatherBanner();
  };
  function updateWeatherBanner() {
    var el = document.getElementById('weatherBanner');
    if (!el) return;
    // Respect user display toggle
    var showBar = (typeof getDisplaySetting==='function') ? getDisplaySetting('weatherBar') : true;
    if (!showBar || !_weatherData.length) { el.classList.remove('show'); el.innerHTML = ''; return; }
    var now = Date.now();
    // Default to collapsed — expand only when user opts in. Keeps HUD clean.
    if (localStorage.getItem('pw_wx_collapsed') === null) {
      localStorage.setItem('pw_wx_collapsed', '1');
    }
    var collapsed = localStorage.getItem('pw_wx_collapsed')==='1';
    if (collapsed) {
      // Compact chip: just count + icon, click to expand
      var iconSet = _weatherData.slice(0,3).map(function(w){return w.icon||'🌡️'}).join('');
      // NOTE: stopPropagation is required. _toggleWeatherBar replaces the
      // banner's innerHTML, which detaches the click target. The document-level
      // "click outside banner" listener would then see wxBar.contains(target)
      // as false (detached) and auto-collapse the banner we just expanded.
      el.innerHTML = '<div class="wx-item" onclick="event.stopPropagation();_toggleWeatherBar()" title="'+tl('Expand weather bar','날씨 바 펼치기','天気バーを展開','展开天气栏')+'">'
        + '<span class="wx-icon">'+iconSet+'</span>'
        + '<span class="wx-sector">'+_weatherData.length+' '+t('wx_active')+'</span>'
        + '<span style="color:var(--tx3);font-size:8px;margin-left:4px">▸</span>'
        + '</div>';
      el.classList.add('show');
      el.classList.add('compact');
      return;
    }
    el.classList.remove('compact');
    var items = _weatherData.slice(0, 5).map(function(wx, idx) {
      var remaining = Math.max(0, new Date(wx.endsAt).getTime() - now);
      var mins = Math.floor(remaining / 60000);
      var timeStr = mins >= 60 ? Math.floor(mins / 60) + 'h ' + (mins % 60) + 'm' : mins + 'm';
      return '<div class="wx-item" onclick="_showWeatherDetail('+idx+')">'
        + '<span class="wx-icon">' + (wx.icon || '🌡️') + '</span>'
        + '<span class="wx-sector">' + (wx.sectorName || t('wx_sector')+' ' + wx.sectorId) + '</span>'
        + '<span class="wx-time">' + timeStr + '</span>'
        + '</div>';
    }).join('');
    // Minimize button at the end
    items += '<div class="wx-item" onclick="event.stopPropagation();_toggleWeatherBar()" title="'+tl('Minimize','최소화','最小化','最小化')+'" style="padding:0 8px;color:var(--tx3);border-left:1px solid rgba(255,140,60,.25)">—</div>';
    el.innerHTML = items;
    el.classList.add('show');
  }

  function _buildWxEffectMap(){return {
    sandstorm:   { name: t('wx_sandstorm'), desc: t('wx_sandstorm_desc'),
      effects: [{label:t('wx_mining_yield'),val:'+50%',type:'buff'},{label:t('wx_movement_speed'),val:'-20%',type:'debuff'},{label:t('wx_visibility'),val:tl('Reduced','감소','低下','降低'),type:'debuff'}]},
    solar_flare: { name: t('wx_solar_flare'), desc: t('wx_solar_flare_desc'),
      effects: [{label:t('wx_mining_yield'),val:'+100%',type:'buff'},{label:t('wx_shield_strength'),val:'-50%',type:'debuff'},{label:t('wx_hijack_cost'),val:'+25%',type:'buff'}]},
    meteor_shower:{ name: t('wx_meteor_shower'), desc: t('wx_meteor_shower_desc'),
      effects: [{label:t('wx_rare_drop'),val:'+30%',type:'buff'},{label:t('wx_harvest_bonus'),val:'+20%',type:'buff'},{label:t('wx_structure_damage'),val:tl('Possible','가능성 있음','可能性あり','可能'),type:'debuff'}]},
    dust_devil:  { name: t('wx_dust_devil'), desc: t('wx_dust_devil_desc'),
      effects: [{label:t('wx_claim_cost'),val:'-15%',type:'buff'},{label:t('wx_mining_yield'),val:'-10%',type:'debuff'},{label:t('wx_exploration_speed'),val:'+25%',type:'buff'}]}
  };}
  var _wxEffectMap = _buildWxEffectMap();

  window._showWeatherDetail = function(idx) {
    var wx = _weatherData[idx];
    if(!wx) return;
    var wxMap = _buildWxEffectMap();
    var info = wxMap[wx.weatherType] || {name:wx.weatherType,desc:tl('Unknown weather event','알 수 없는 기상 현상','不明な気象現象','未知天气现象'),effects:[]};
    var remaining = Math.max(0, new Date(wx.endsAt).getTime() - Date.now());
    var mins = Math.floor(remaining / 60000);
    var timeStr = mins >= 60 ? Math.floor(mins / 60) + 'h ' + (mins % 60) + 'm' : mins + 'm';

    var html = '<div class="wx-d-title">' + (wx.icon||'🌡️') + ' ' + info.name + '</div>';
    html += '<div style="font-size:9px;color:var(--tx2);margin-bottom:8px;line-height:1.4">' + info.desc + '</div>';
    html += '<div class="wx-d-row"><div class="wx-d-label">'+t('wx_sector')+'</div><div class="wx-d-val neutral">' + (wx.sectorName||t('wx_sector')+' '+wx.sectorId) + '</div></div>';
    html += '<div class="wx-d-row"><div class="wx-d-label">'+t('wx_time_left')+'</div><div class="wx-d-val neutral">' + timeStr + '</div></div>';
    info.effects.forEach(function(e){
      html += '<div class="wx-d-row"><div class="wx-d-label">'+e.label+'</div><div class="wx-d-val '+e.type+'">'+e.val+'</div></div>';
    });

    var pop = document.getElementById('wxDetailPopup');
    document.getElementById('wxDetailContent').innerHTML = html;
    // Anchor the popover to the right of the weather chip — grows outward, not
    // a giant bottom sheet that eats the screen.
    var chip = document.getElementById('weatherBanner');
    if(chip){
      var r = chip.getBoundingClientRect();
      var isMobile = window.innerWidth <= 768;
      if(isMobile){
        // On mobile, center horizontally, above the chip so thumbs don't cover it
        pop.style.left = '50%';
        pop.style.right = 'auto';
        pop.style.top = 'auto';
        pop.style.bottom = (window.innerHeight - r.top + 8) + 'px';
        pop.style.transform = 'translateX(-50%)';
      } else {
        // Desktop: to the right of the chip, aligned to its top
        pop.style.left = (r.right + 10) + 'px';
        pop.style.right = 'auto';
        pop.style.top = Math.max(80, r.top - 20) + 'px';
        pop.style.bottom = 'auto';
        pop.style.transform = '';
      }
    }
    pop.classList.add('open');
  };
  // Close on outside tap
  document.addEventListener('click', function(e){
    var popup = document.getElementById('wxDetailPopup');
    if(popup && popup.classList.contains('open') && !popup.contains(e.target) && !e.target.closest('.wx-item')){
      popup.classList.remove('open');
    }
    // Auto-collapse expanded weather bar when tapping outside
    // (mobile UX: don't force users to hunt for the tiny "—" button)
    var wxBar = document.getElementById('weatherBanner');
    if(wxBar && wxBar.classList.contains('show') && !wxBar.classList.contains('compact')
       && !wxBar.contains(e.target) && (!popup || !popup.contains(e.target))){
      var isCollapsed = localStorage.getItem('pw_wx_collapsed')==='1';
      if(!isCollapsed){
        localStorage.setItem('pw_wx_collapsed','1');
        try{ updateWeatherBanner(); }catch(_e){}
      }
    }
  });
  _setActiveTimeout(loadWeatherData, 4000);
  _setActiveInterval(loadWeatherData, 60000);
  _setActiveInterval(updateWeatherBanner, 30000);
  // Animate weather/POI/starlink overlay texture (throttled — mobile much slower)
  var _compositeInterval = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) ? 30000 : 8000;
  _setActiveInterval(function() {
    var passes = (_starlinkData && Array.isArray(_starlinkData.passes)) ? _starlinkData.passes : [];
    if (_weatherData.length > 0 || _poiData.length > 0 || passes.length > 0) compositeClaimsOnTexture();
  }, _compositeInterval);

  // ═══════ EXPLORATION POLLING ═══════
  window._myOwnedSectors = window._myOwnedSectors || [];
  window._explorationFee = 0;
  window._userPP = 0;
  function loadExplorationData() {
    if (!_pageIsActive()) return;
    if (!wlfHasPlayerSession()) {
      var hadPoi = Array.isArray(_poiData) && _poiData.length > 0;
      _poiData = [];
      window._myOwnedSectors = [];
      window._explorationFee = 0;
      window._userPP = 0;
      if (hadPoi && typeof compositeClaimsOnTexture === 'function') compositeClaimsOnTexture();
      return;
    }
    _guardedJsonFetch('exploration-pois', '/api/exploration/pois', {minGap:30000, backoffMs:120000, fetchOptions:{headers:getAuthHeaders()}}).then(function(data){
      if (!data) return;
      var now = new Date().getTime();
      // Filter out expired POIs client-side too
      _poiData = (data.pois || []).filter(function(p){
        if(p.expiresAt && new Date(p.expiresAt).getTime() < now) return false;
        return true;
      });
      if (Array.isArray(data.ownedSectorIds)) window._myOwnedSectors = data.ownedSectorIds;
      if (typeof data.explorationFee === 'number') window._explorationFee = data.explorationFee;
      if (typeof data.userPP === 'number') window._userPP = data.userPP;
      if (_poiData.length > 0) {
        console.log('[POI] Active:', _poiData.filter(function(p){return !p.discovered}).length, '/', _poiData.length, 'total, fee:', window._explorationFee, 'PP, userPP:', window._userPP);
        compositeClaimsOnTexture();
      }
    }).catch(function(){});
  }
  window.loadExplorationData = loadExplorationData;
  function loadStarlinkData() {
    if (!_pageIsActive()) return;
    _guardedJsonFetch('exploration-starlink', '/api/exploration/starlink', {minGap:/Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) ? 60000 : 30000, backoffMs:120000}).then(function(data){
      if (!data) return;
      _starlinkData = {
        satellites: Array.isArray(data && data.satellites) ? data.satellites : [],
        passes: Array.isArray(data && data.passes) ? data.passes : [],
        serverTime: data && data.serverTime
      };
      _updateStarlinkPositions();
    }).catch(function(){});
  }
  _setActiveTimeout(loadExplorationData, 5000);
  _setActiveInterval(loadExplorationData, 60000);
  _setActiveTimeout(loadStarlinkData, 6000);
  // Starlink position updates: 30s desktop, 60s mobile (3D mesh update is heavy)
  _setActiveInterval(loadStarlinkData, /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) ? 60000 : 30000);
  // Init Starlink 3D orbit around globe
  function _tryInitStarlinkOrbit() {
    if (_slDots.length) return;
    _initStarlinkOrbit();
    if (!_slDots.length) _setActiveTimeout(_tryInitStarlinkOrbit, 2000);
  }
  _setActiveTimeout(_tryInitStarlinkOrbit, 3000);
  // Starlink position updates handled by _animateStarlink RAF loop

  // ═══════ ROCKET EVENT POLLING ═══════
  function loadRocketData() {
    if (!_pageIsActive()) return;
    _guardedJsonFetch('rockets-active', '/api/rockets', {minGap:25000, backoffMs:120000}).then(function(data){
      if (!data) return;
      _rocketData = data;
      updateRocketBanner();
      if (typeof _updateRocketMesh === 'function') _updateRocketMesh();
      if (_rocketData.events && _rocketData.events.length > 0) compositeClaimsOnTexture();
    }).catch(function(){});
  }
  function updateRocketBanner() {
    var el = document.getElementById('rocketBanner');
    if (!el) return;
    var events = (_rocketData.events || []).filter(function(e){ return e.status !== 'completed'; });
    if (!events.length) { el.classList.remove('show'); el.innerHTML = ''; return; }
    var ev = events[0];
    var now = Date.now();
    var icon, typeLabel, timeStr;
    if (ev.status === 'incoming') {
      icon = '<img src="/assets/textures/rocket_drop.svg" onerror="this.src=&quot;/assets/textures/starship.png&quot;" style="width:16px;height:16px;vertical-align:middle;transform:rotate(-30deg)">';
      typeLabel = ev.eventType === 'rud_explosion' ? tl('UNKNOWN OBJECT','미확인 물체','未確認物体','未知物体') : tl('SUPPLY DROP','보급 투하','補給投下','补给投放');
      var remaining = Math.max(0, new Date(ev.landingAt).getTime() - now);
      var mins = Math.floor(remaining / 60000);
      timeStr = mins >= 60 ? Math.floor(mins/60) + 'h ' + (mins%60) + 'm' : mins + 'm';
    } else if (ev.status === 'looting') {
      icon = ev.eventType === 'rud_explosion' ? '\u{1F4A5}' : '\u{1F4E6}';
      typeLabel = ev.eventType === 'rud_explosion' ? tl('RUD — DEBRIS FIELD','RUD — 파편 지대','RUD — 残骸エリア','RUD — 碎片区') : tl('SUPPLY DROP LANDED','보급 투하 착륙','補給投下 着地','补给已着陆');
      var remain2 = Math.max(0, new Date(ev.lootingEndsAt).getTime() - now);
      var mins2 = Math.floor(remain2 / 60000);
      timeStr = mins2 + tl('m left','분 남음','分 残り','分钟剩余');
    }
    var remaining2 = ev.totalRewards - ev.claimedRewards;
    var priorityBtn = '';
    if (ev.status === 'incoming' && walletState.address) {
      priorityBtn = '<button onclick="event.stopPropagation();buyLootPriority(' + ev.id + ')" style="font-size:8px;padding:2px 8px;background:rgba(255,209,102,.15);border:1px solid rgba(255,209,102,.3);border-radius:4px;color:var(--gold);cursor:pointer;font-family:var(--fn);white-space:nowrap">'+tl('PRIORITY (0.3 PP)','우선권 (0.3 PP)','優先権 (0.3 PP)','优先权 (0.3 PP)')+'</button>';
    }
    var tooltipText = ev.status === 'incoming'
      ? tl('A rocket is arriving! When it lands, click the drop zone on the map to claim loot (items, GP, PP). First come, first served!','로켓이 도착 중입니다! 착륙하면 지도의 투하 지점을 눌러 전리품(아이템, GP, PP)을 획득하세요. 선착순!','ロケットが到着中！着地したらマップの投下地点をクリックして戦利品（アイテム・GP・PP）を獲得。早い者勝ち！','火箭即将抵达！着陆后点击地图上的投放区领取战利品（道具、GP、PP）。先到先得！')
      : tl('The supply drop has landed! Click the 📦 marker on the map to claim loot. ','보급 투하가 착륙했습니다! 지도의 📦 마커를 눌러 전리품을 획득하세요. ','補給投下が着地しました！マップの📦マーカーをクリックして戦利品を獲得。','补给已着陆！点击地图上的📦标记领取战利品。') + remaining2 + tl(' items remaining!','개 남음!','個 残り！','个剩余！');
    el.innerHTML = '<span class="rk-icon">' + icon + '</span>'
      + '<span class="rk-type">' + typeLabel + '</span>'
      + '<span class="rk-sector" style="margin:0 4px">' + (ev.sectorName || '') + '</span>'
      + '<span class="rk-time">' + timeStr + '</span>'
      + (ev.status === 'looting' ? '<span class="rk-loot">' + remaining2 + '/' + ev.totalRewards + tl(' loot',' 전리품',' 戦利品',' 战利品')+'</span>' : '')
      + priorityBtn;
    el.title = tooltipText;
    // Push event into announce banner so users see it in their normal scan path.
    // Hide the standalone rocket chip to avoid duplication — announce banner is
    // the single source of truth for active events.
    try{
      var sectorPart = ev.sectorName ? (' — ' + ev.sectorName) : '';
      var announceText;
      if (ev.status === 'incoming') {
        announceText = '🛸 ' + typeLabel + tl(' INCOMING',' 접근 중',' 接近中',' 接近中') + sectorPart + tl(' · LANDS IN ',' · 착륙까지 ',' · 着地まで ',' · 着陆倒计时 ') + timeStr;
      } else {
        announceText = '📦 ' + tl('SUPPLY DROP LANDED','보급 투하 착륙','補給投下 着地','补给已着陆') + sectorPart + ' · ' + timeStr + ' · ' + remaining2 + '/' + ev.totalRewards + tl(' LOOT',' 전리품',' 戦利品',' 战利品');
      }
      if (typeof showAnnounce === 'function') showAnnounce(announceText);
      // Hide the duplicate chip since the announce marquee carries the info
      el.classList.remove('show');
    }catch(_e){
      el.classList.add('show');
    }
  }
  _setActiveTimeout(loadRocketData, 7000);
  _setActiveInterval(loadRocketData, 30000);
  _setActiveInterval(updateRocketBanner, 15000);
  _setActiveTimeout(function(){ if (typeof _initRocketMesh === 'function') _initRocketMesh(); }, 3500);
  // Rocket 3D mesh: 2s desktop, 5s mobile (reduces WebGL draw calls)
  _setActiveInterval(function(){
    if (typeof _updateRocketMesh !== 'function') return;
    var events = (_rocketData && _rocketData.events || []).filter(function(e){ return e.status !== 'completed'; });
    if (!events.length) return;
    _updateRocketMesh();
  }, /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) ? 5000 : 2000);

  // Keep mission routes visible on the map even when OPS tab isn't open.
  function _refreshOpsMissionsGlobal(){
    if (!_pageIsActive()) return;
    var w = walletState && walletState.address; if(!w) return;
    _guardedJsonFetch('ops-missions-global', '/api/missions/active', {minGap:25000, backoffMs:120000, fetchOptions:{headers:getAuthHeaders()}})
      .then(function(d){
        if (!d) return;
        window._opsMissions = d.missions || [];
        if(typeof requestRedraw==='function') requestRedraw();
      }).catch(function(){});
  }
  _setActiveTimeout(_refreshOpsMissionsGlobal, 4000);
  _setActiveInterval(_refreshOpsMissionsGlobal, 30000);

  // ═══════ GENERIC MOBILE-FRIENDLY MODAL ═══════
  // Works on both mobile and desktop — uses the .mbg/.mdl pattern, z-index above HUD.
  window.showMobModal = function(title, html){
    // Remove any existing instance to prevent stacking
    var existing = document.getElementById('_mobModal');
    if(existing) existing.remove();
    var bg = document.createElement('div');
    bg.id = '_mobModal';
    bg.className = 'mbg open';
    bg.style.cssText = 'z-index:1300;display:flex';
    var mdl = document.createElement('div');
    mdl.className = 'mdl';
    mdl.style.cssText = 'max-width:420px;width:94vw;max-height:80vh;overflow-y:auto;padding:0';
    mdl.addEventListener('click', function(e){e.stopPropagation();});
    mdl.innerHTML =
      '<div style="display:flex;justify-content:space-between;align-items:center;padding:12px 16px;border-bottom:1px solid var(--bdr)">' +
        '<div style="font-size:var(--fs-md);font-weight:700;color:var(--mars);letter-spacing:1px">' + title + '</div>' +
        '<button id="_mobModalX" style="background:none;border:none;color:var(--tx3);font-size:20px;cursor:pointer;padding:0;line-height:1">&times;</button>' +
      '</div>' +
      '<div style="padding:0">' + html + '</div>';
    bg.appendChild(mdl);
    bg.addEventListener('click', function(e){ if(e.target===bg) bg.remove(); });
    document.body.appendChild(bg);
    var x = document.getElementById('_mobModalX');
    if(x) x.addEventListener('click', function(){ bg.remove(); });
  };

  // ═══════ ROCKET LOOT CLAIM ═══════
  window._showRocketLootPopup = function(ev) {
    if (!ev || ev.status !== 'looting') { showToast(tl('Rocket not available for looting','수확 가능한 로켓이 없습니다','回収可能なロケットがありません','无可回收的火箭')); return; }
    fetch('/api/rockets/' + ev.id + '/loot').then(function(r){return r.json()}).then(function(data){
      var loot = data.loot || [];
      if (!loot.length) { showToast(tl('No loot remaining!','남은 전리품이 없습니다!','残りの戦利品がありません！','没有剩余战利品！')); return; }
      var html = '<div style="text-align:center;padding:16px">'
        + '<div style="font-size:28px;margin-bottom:8px">' + (ev.eventType === 'rud_explosion' ? '\u{1F4A5}' : '\u{1F4E6}') + '</div>'
        + '<div style="font-size:13px;font-weight:700;color:#FF6644;margin-bottom:4px">'
        + (ev.eventType === 'rud_explosion' ? tl('RUD DEBRIS FIELD','RUD 파편 지대','RUD 残骸エリア','RUD 碎片区') : tl('SUPPLY DROP','보급 투하','補給投下','补给投放')) + '</div>'
        + '<div style="font-size:9px;color:var(--tx3);margin-bottom:12px">' + loot.length + tl(' items remaining — first come first served!','개 남음 — 선착순!','個 残り — 早い者勝ち！','个剩余 — 先到先得！') + '</div>'
        + '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(60px,1fr));gap:6px;max-height:200px;overflow-y:auto">';
      loot.forEach(function(l) {
        var lIcon = l.hasItem ? '\u{2B50}' : '\u{1F4B0}';
        html += '<button onclick="_claimLoot(' + ev.id + ',' + l.index + ',this)" style="padding:8px 4px;background:rgba(255,100,60,0.15);border:1px solid rgba(255,100,60,0.3);border-radius:6px;color:#FF9944;font-family:var(--fn);font-size:10px;cursor:pointer;text-align:center">'
          + lIcon + '<br><span style="font-size:7px;color:var(--tx3)">#' + (l.index + 1) + '</span></button>';
      });
      html += '</div></div>';
      // infoPanel no longer exists — use the shared modal on both mobile and desktop
      showMobModal(tl('ROCKET LOOT','로켓 전리품','ロケット戦利品','火箭战利品'), html);
    }).catch(function(err){
      console.error('[ROCKET] loot load error:', err);
      showToast(tl('Failed to load loot','전리품 로드 실패','戦利品の読み込み失敗','加载战利品失败'),'error');
    });
  };

  window._claimLoot = function(eventId, lootIndex, btn) {
    if (!walletState.address) { showToast(tl('Connect wallet first','지갑을 먼저 연결하세요','先にウォレットを接続してください','请先连接钱包')); return; }
    if (btn) { btn.disabled = true; btn.style.opacity = '0.4'; }
    fetch('/api/rockets/claim-loot', {
      method: 'POST',
      headers: Object.assign({ 'Content-Type': 'application/json' }, getAuthHeaders()),
      body: JSON.stringify({ wallet: walletState.address, rocketEventId: eventId, lootIndex: lootIndex })
    }).then(function(r){return r.json()}).then(function(data){
      if (data.error) { showToast(data.error); if(btn){btn.disabled=false;btn.style.opacity='1';} return; }
      var r = data.reward;
      var msg;
      if (r.type === 'gp') msg = tl('+'+r.amount+' GP from supply drop','보급 투하에서 +'+r.amount+' GP 획득','補給投下から +'+r.amount+' GP 獲得','从补给投放获得 +'+r.amount+' GP');
      else if (r.type === 'xp') msg = tl('+'+r.amount+' XP from supply drop','보급 투하에서 +'+r.amount+' XP 획득','補給投下から +'+r.amount+' XP 獲得','从补给投放获得 +'+r.amount+' XP');
      else if (r.type === 'pp') msg = tl('+'+r.amount+' PP from supply drop','보급 투하에서 +'+r.amount+' PP 획득','補給投下から +'+r.amount+' PP 獲得','从补给投放获得 +'+r.amount+' PP');
      else if (r.type === 'cosmetic') msg = tl('Got '+(r.itemName||r.itemCode||'cosmetic')+' (rare cosmetic)!','희귀 코스메틱 획득: '+(r.itemName||r.itemCode||'cosmetic')+'!','レアコスメを獲得: '+(r.itemName||r.itemCode||'cosmetic')+'!','获得稀有外观：'+(r.itemName||r.itemCode||'cosmetic')+'！');
      else if (r.type === 'item') msg = tl('Got '+(r.itemName||r.itemCode||'item')+' x'+(r.amount||1),(r.itemName||r.itemCode||'item')+' x'+(r.amount||1)+' 획득',(r.itemName||r.itemCode||'item')+' x'+(r.amount||1)+' 獲得','获得 '+(r.itemName||r.itemCode||'item')+' x'+(r.amount||1));
      else msg = tl('Loot claimed!','보상을 획득했습니다!','戦利品を獲得しました！','已领取战利品！');
      showNotification('rocket',tl('Loot claimed','보상 획득','戦利品獲得','已领取战利品'),msg);
      try{_sfx.harvest()}catch(e){}
      if (btn) { btn.textContent = '\u2713'; btn.style.background = 'rgba(0,255,100,0.2)'; btn.style.borderColor = '#00FF88'; }
      try{ refreshEmailBalances(); }catch(_rb){}
    }).catch(function(){ showToast(tl('Claim failed','획득 실패','受取失敗','领取失败')); if(btn){btn.disabled=false;btn.style.opacity='1';} });
  };

  // ═══════ ROCKET INFO POPUP ═══════
  window.showRocketInfo = function() {
    var events = (_rocketData.events || []).filter(function(e){ return e.status !== 'completed'; });
    if (!events.length) return;
    var ev = events[0];
    var now = Date.now();
    var isIncoming = ev.status === 'incoming';
    var isLooting = ev.status === 'looting';
    var remaining = isLooting ? (ev.totalRewards - ev.claimedRewards) : ev.totalRewards;
    var icon = isLooting ? (ev.eventType === 'rud_explosion' ? '\u{1F4A5}' : '\u{1F4E6}') : '\u{1F680}';
    var timeLeft = '';
    if (isIncoming) {
      var ms = Math.max(0, new Date(ev.landingAt).getTime() - now);
      timeLeft = Math.floor(ms / 60000) + tl(' min until landing','분 후 착륙','分後に着地','分钟后着陆');
    } else if (isLooting) {
      var ms2 = Math.max(0, new Date(ev.lootingEndsAt).getTime() - now);
      timeLeft = Math.floor(ms2 / 60000) + tl(' min remaining','분 남음','分 残り','分钟剩余');
    }
    var html = '<div style="text-align:center;padding:16px">'
      + '<div style="font-size:36px;margin-bottom:8px">' + icon + '</div>'
      + '<div style="font-size:14px;font-weight:700;color:#FF6644;margin-bottom:8px">'
      + (ev.eventType === 'rud_explosion' ? tl('RUD EVENT','RUD 이벤트','RUDイベント','RUD事件') : tl('SUPPLY DROP','보급 투하','補給投下','补给投放')) + '</div>'
      + '<div style="font-size:10px;color:var(--tx2);margin-bottom:12px;line-height:1.5">'
      + (isIncoming
        ? tl('A rocket is on its way to Mars! When it lands, a 📦 marker will appear on the map in <b>','로켓이 화성으로 향하고 있습니다! 착륙하면 지도의 <b>','ロケットが火星へ向かっています！着地するとマップの<b>','火箭正飞向火星！着陆后地图上的<b>') + (ev.sectorName || tl('a sector','한 섹터','あるセクター','某区域')) + tl('</b> location. Click it to claim loot!','</b> 위치에 📦 마커가 표시됩니다. 눌러서 전리품을 획득하세요!','</b>に📦マーカーが表示されます。クリックして戦利品を獲得！','</b>位置会出现📦标记。点击领取战利品！')
        : tl('The supply drop has landed in <b>','보급 투하가 <b>','補給投下が<b>','补给已着陆于<b>') + (ev.sectorName || tl('a sector','한 섹터','あるセクター','某区域')) + tl('</b>! Click the 📦 marker on the map to claim items.','</b>에 착륙했습니다! 지도의 📦 마커를 눌러 아이템을 획득하세요.','</b>に着地しました！マップの📦マーカーをクリックしてアイテムを獲得。','</b>！点击地图上的📦标记领取道具。'))
      + '</div>'
      + '<div style="display:flex;gap:12px;justify-content:center;margin-bottom:12px">'
      + '<div style="text-align:center"><div style="font-size:16px;font-weight:700;color:var(--gold)">' + remaining + '/' + ev.totalRewards + '</div><div style="font-size:8px;color:var(--tx3)">'+tl('LOOT LEFT','남은 전리품','残り戦利品','剩余战利品')+'</div></div>'
      + '<div style="text-align:center"><div style="font-size:16px;font-weight:700;color:var(--mars)">' + timeLeft + '</div><div style="font-size:8px;color:var(--tx3)">'+tl('TIME','시간','時間','时间')+'</div></div>'
      + '</div>'
      + '<div style="font-size:9px;color:var(--tx3);line-height:1.4;padding:8px;background:rgba(255,255,255,.03);border-radius:6px">'
      + '💡 <b>'+tl('How it works:','이용 방법:','使い方:','玩法说明:')+'</b> '+tl('Loot contains GP, items, or rare PP. Click the marker on the map to claim. Each player can claim one loot per drop. First come, first served!','전리품에는 GP, 아이템, 희귀 PP가 들어 있습니다. 지도의 마커를 눌러 획득하세요. 각 플레이어는 투하당 1개씩 획득 가능. 선착순!','戦利品にはGP・アイテム・レアPPが含まれます。マップのマーカーをクリックして獲得。各プレイヤーは投下ごとに1個獲得可能。早い者勝ち！','战利品包含GP、道具或稀有PP。点击地图标记领取。每位玩家每次投放可领取一个。先到先得！')
      + '</div></div>';
    showMobModal(tl('SUPPLY DROP','보급 투하','補給投下','补给投放'), html);
  };

  // Badge system: wallet → roles map
  var _govWalletRoles = {}; // { wallet: ['commander','governor',...] }
  function updateGovRoles() {
    // Build from sectors data + commander info
    _govWalletRoles = {};
    if (_cmdInfo) {
      if (_cmdInfo.commander) {
        if (!_govWalletRoles[_cmdInfo.commander]) _govWalletRoles[_cmdInfo.commander] = [];
        _govWalletRoles[_cmdInfo.commander].push('commander');
      }
      if (_cmdInfo.vice) {
        if (!_govWalletRoles[_cmdInfo.vice]) _govWalletRoles[_cmdInfo.vice] = [];
        _govWalletRoles[_cmdInfo.vice].push('vice_commander');
      }
    }
    (_sectorsData || []).forEach(function(s) {
      if (s.governor && s.governor.fullWallet) {
        var w = s.governor.fullWallet;
        if (!_govWalletRoles[w]) _govWalletRoles[w] = [];
        if (_govWalletRoles[w].indexOf('governor') < 0) _govWalletRoles[w].push('governor');
      }
    });
  }
  window.govBadgeHTML = function(wallet) {
    if (!wallet) return '';
    var roles = _govWalletRoles[wallet.toLowerCase()] || _govWalletRoles[wallet] || [];
    if (!roles.length) return '';
    if (roles.indexOf('commander') >= 0) return '<span class="title-badge commander" title="'+tl('Commander','맹주','司令官','指挥官')+'">👑 '+tl('CMDR','맹주','総督','统帅')+'</span>';
    if (roles.indexOf('governor') >= 0) return '<span class="title-badge governor" title="'+tl('Governor','거버너','総督','总督')+'">🏛 '+tl('GOV','거버너','知事','总督')+'</span>';
    if (roles.indexOf('vice_commander') >= 0) return '<span class="title-badge vice" title="'+tl('Vice Commander','부맹주','副総督','副统帅')+'">⭐ '+tl('VICE','부맹주','副総督','副统帅')+'</span>';
    return '';
  }

  // Governance leaderboard (sidebar + BASE > SEASON mirror)
  function loadGovLeaderboard() {
    if (!_pageIsActive()) return;
    wlfReadFetch('gov-leaderboard', '/api/governance/leaderboard?sort=tax', 30000, false).then(function(rows){
      var el = document.getElementById('govLeaderboardList');
      var bsEl = document.getElementById('bsGovLeaderboardList');
      if (!rows || !rows.length) {
        var empty = '<div style="font-size:9px;color:var(--tx3);padding:4px 0">'+tl('No governors yet','아직 거버너가 없습니다','まだ知事がいません','暂无总督')+'</div>';
        if (el) el.innerHTML = empty;
        if (bsEl) bsEl.innerHTML = empty;
        return;
      }
      var cmdWallet = _cmdInfo ? _cmdInfo.commander : null;
      var html = rows.slice(0, 8).map(function(r, i) {
        var isCmd = cmdWallet && r.wallet === cmdWallet;
        var name = r.nickname || (r.wallet.slice(0,6)+'...'+r.wallet.slice(-4));
        var tax = parseFloat(r.total_tax || 0);
        var taxStr = tax >= 1000 ? (tax/1000).toFixed(1)+'K' : tax.toFixed(0);
        var rankColors = ['var(--gold)','#C0C0C0','#CD7F32'];
        var rankColor = i < 3 ? rankColors[i] : 'var(--tx3)';
        return '<div class="gov-lb-row'+(isCmd?' commander':'')+'">'
          + '<span class="glb-rank" style="color:'+rankColor+'">'+(i+1)+'</span>'
          + (isCmd ? '<span class="glb-badge">👑</span>' : '')
          + '<span class="glb-name">'+name+' '+govBadgeHTML(r.wallet)+'</span>'
          + '<span class="glb-val">'+taxStr+' GP</span>'
          + '</div>';
      }).join('');
      if (el) el.innerHTML = html;
      if (bsEl) {
        // Slightly different layout for BASE tab
        bsEl.innerHTML = rows.slice(0,8).map(function(r,i){
          var isCmd = cmdWallet && r.wallet === cmdWallet;
          var name = r.nickname || (r.wallet.slice(0,6)+'...'+r.wallet.slice(-4));
          var tax = parseFloat(r.total_tax || 0);
          var taxStr = tax >= 1000 ? (tax/1000).toFixed(1)+'K' : tax.toFixed(0);
          var medal = i===0?'🥇':i===1?'🥈':i===2?'🥉':('#'+(i+1));
          return '<div style="display:flex;align-items:center;gap:6px;padding:4px 6px;margin-bottom:3px;background:rgba(255,209,102,.04);border-left:2px solid '+(isCmd?'var(--red)':'var(--gold)')+';border-radius:4px;font-size:9px">'
            +'<span style="width:22px;color:var(--gold);font-weight:700">'+medal+'</span>'
            +(isCmd?'<span title="'+tl('Commander','맹주','司令官','指挥官')+'">👑</span>':'')
            +'<span style="flex:1;color:var(--tx2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+name+'</span>'
            +'<span style="color:var(--gold);font-family:var(--fn)">'+taxStr+' GP</span>'
            +'</div>';
        }).join('');
      }
    }).catch(function(){});
  }
  _setActiveTimeout(loadGovLeaderboard, 3000);
  _setActiveInterval(loadGovLeaderboard, 120000);

  // Sector announcements — hidden from main screen; visible inside BASE sector list.
  window.updateSectorAnnounces = function() {
    var el = document.getElementById('tbSectorAnnounce');
    if (el) el.style.display = 'none';
  };

  // Gov change feed alerts
  window.addGovFeed = function(changes) {
    if (!changes || !changes.length) return;
    changes.forEach(function(c) {
      var text;
      var name = c.nickname || (c.wallet ? c.wallet.slice(0,6)+'...'+c.wallet.slice(-4) : '???');
      if (c.type === 'commander') {
        text = '⭐ ' + tl('NEW COMMANDER: ','신규 맹주: ','新総督: ','新统帅: ') + name + tl(' commands all of Mars!',' 님이 화성 전역을 지휘합니다!',' が火星全土を指揮します！',' 统领整个火星！');
      } else if (c.type === 'governor') {
        text = '👑 ' + tl('NEW GOVERNOR: ','신규 거버너: ','新知事: ','新总督: ') + name + tl(' rules ',' 님이 ',' が',' 统治 ') + (c.sectorName || tl('sector','섹터','セクター','区域')) + tl('!',' 섹터를 통치합니다!','を統治します！','！');
      }
      if (text) {
        var feed = document.getElementById('liveFeed');
        if (!feed) return;
        var empty = document.getElementById('liveFeedEmpty');
        if (empty) empty.remove();
        var div = document.createElement('div');
        div.className = 'feed-item feed-gov';
        div.style.cssText = 'border-left:2px solid var(--gold);padding-left:6px;font-weight:bold;color:var(--gold)';
        div.textContent = text;
        feed.insertBefore(div, feed.firstChild);
        // Keep max 20
        while (feed.children.length > 20) feed.removeChild(feed.lastChild);
      }
    });
  }

  // ─────────────────────────────────────────────────────────
  // SECTOR SIEGE UI
  // ─────────────────────────────────────────────────────────
  var _siegeSectorCode = null;
  var _siegeSectorDefs = null; // cached from /api/sector-defs
  var _baseSectorRows = null;
  var _baseSectorFilter = 'all';

  function _loadSectorDefs(cb) {
    if (_siegeSectorDefs) { cb(_siegeSectorDefs); return; }
    _guardedJsonFetch('sector-defs-governance', '/api/sector-defs', {minGap:30000, backoffMs:120000}).then(function(d){
      d = d || { sectors: [] };
      _siegeSectorDefs = (d.sectors || []);
      cb(_siegeSectorDefs);
    }).catch(function(){ cb([]); });
  }

  function _sectorDisplayName(s) {
    return (LANG==='ko'?s.name_ko:LANG==='ja'?s.name_ja:LANG==='zh'?s.name_zh:(s.name_en || s.name)) || s.name || s.code;
  }

  function _sectorFmtMult(v) {
    var n = parseFloat(v);
    if (!Number.isFinite(n)) n = 1;
    return n.toFixed(2).replace(/\.00$/, '') + 'x';
  }

  function _sectorEconomyLine(s) {
    var mining = s.miningMultiplier != null ? s.miningMultiplier : s.mining_multiplier;
    var price = s.priceMultiplier != null ? s.priceMultiplier : s.price_multiplier;
    var tax = s.taxRate != null ? s.taxRate : s.tax_rate;
    var parts = [
      '⛏ ' + _sectorFmtMult(mining),
      '🏷 ' + _sectorFmtMult(price)
    ];
    if (tax != null) parts.push('세율 ' + (parseFloat(tax) || 0).toFixed(1) + '%');
    return parts.join(' · ');
  }

  function _sectorPressureLine(s) {
    var battles = parseInt(s.activeBattles || s.active_battles || 0, 10) || 0;
    var bounties = parseInt(s.activeBounties || s.active_bounties || 0, 10) || 0;
    var bountyGp = parseFloat(s.bountyGp || s.total_bounty_gp || 0) || 0;
    var level = s.pressureLevel || s.pressure_level || 'quiet';
    var labels = {
      warzone: tl('WARZONE', '전쟁구역', '戦争区域', '战区'),
      contested: tl('CONTESTED', '분쟁중', '係争中', '争夺中'),
      active: tl('ACTIVE', '활성', '活性', '活跃'),
      quiet: tl('QUIET', '조용함', '静穏', '安静')
    };
    var parts = [labels[level] || labels.quiet];
    if (battles) parts.push('⚔ ' + battles);
    if (bounties) parts.push('🎯 ' + bounties);
    if (bountyGp) parts.push(Math.round(bountyGp) + ' GP');
    return parts.join(' · ');
  }

  function _renderBaseSectorList() {
    var list = document.getElementById('baseSectorList');
    if (!list) return;
    var rows = _baseSectorRows || [];
    if (_baseSectorFilter !== 'all') {
      rows = rows.filter(function(s) {
        if (_baseSectorFilter === 'mine') {
          var w = walletState.address ? walletState.address.toLowerCase() : '';
          var mineByWallet = !!(w && s.governor && s.governor.wallet && s.governor.wallet.toLowerCase() === w);
          var gid = (typeof _myGuildData !== 'undefined' && _myGuildData && _myGuildData.id) ? String(_myGuildData.id) : '';
          var mineByGuild = !!(gid && s.governorGuild && String(s.governorGuild.id) === gid);
          return mineByWallet || mineByGuild;
        }
        return (s.tier || s.sector_type) === _baseSectorFilter;
      });
    }
    if (!rows.length) {
      list.innerHTML = '<div style="font-size:10px;color:var(--tx3);padding:20px;text-align:center">'+tl('No sectors found.','섹터를 찾을 수 없습니다.','セクターが見つかりません。','未找到区域。')+'</div>';
      return;
    }
    var tierCol = { core:'var(--gold)', mid:'var(--cyan)', frontier:'var(--gn)' };
    list.innerHTML = rows.map(function(s) {
      var tier = s.tier || s.sector_type || 'frontier';
      var owner = s.governorGuild ? ((s.governorGuild.emblem||'🔴')+' ['+escapeHtml(s.governorGuild.tag||'')+'] '+escapeHtml(s.governorGuild.name||''))
        : (s.governor ? ('👤 '+escapeHtml(s.governor.nickname||'')) : '<span style="color:var(--tx3)">'+tl('Vacant','무주공산','空白','空白')+'</span>');
      var policy = s.sectorPolicy || s.sector_policy;
      return '<div style="padding:9px 10px;margin-bottom:7px;border-radius:8px;background:rgba(255,255,255,.035);border:1px solid rgba(255,255,255,.08);border-left:3px solid '+(tierCol[tier]||'var(--tx3)')+'">'
        + '<div style="display:flex;justify-content:space-between;gap:8px;align-items:flex-start">'
        + '<div style="min-width:0"><div style="font-size:11px;color:var(--tx);font-weight:800;letter-spacing:.3px">'+escapeHtml(_sectorDisplayName(s))+'</div>'
        + '<div style="font-size:9px;color:var(--tx3);margin-top:3px;font-family:var(--fn)">'+escapeHtml(String(s.code||'').toUpperCase())+' · '+escapeHtml(tier.toUpperCase())+'</div></div>'
        + '<div style="font-size:9px;color:'+(tierCol[tier]||'var(--tx3)')+';font-weight:800;text-transform:uppercase">'+escapeHtml(tier)+'</div></div>'
        + '<div style="font-size:9px;color:var(--tx2);margin-top:7px">'+owner+'</div>'
        + '<div style="font-size:9px;color:var(--gold);margin-top:5px">'+escapeHtml(_sectorEconomyLine(s))+'</div>'
        + (policy ? '<div style="font-size:8px;color:var(--tx3);margin-top:4px">'+tl('Policy: ','정책: ','方針: ','政策: ')+escapeHtml(_siegePolicyLabel(policy))+'</div>' : '')
        + '</div>';
    }).join('');
  }

  window.loadBaseSectorList = function(force) {
    var list = document.getElementById('baseSectorList');
    if (!list) return;
    if (_baseSectorRows && !force) { _renderBaseSectorList(); return; }
    list.innerHTML = '<div style="font-size:10px;color:var(--tx3);padding:20px;text-align:center">'+tl('Loading sectors...','섹터 불러오는 중...','セクター読み込み中...','加载区域中...')+'</div>';
    Promise.all([
      _guardedJsonFetch('sector-defs-list', '/api/sector-defs', {minGap:30000, backoffMs:120000}).then(function(d){ return d || {sectors:[]}; }),
      _guardedJsonFetch('sector-defs-sov-map-base', '/api/sector-defs/sov-map', {minGap:30000, backoffMs:120000}).then(function(d){ return d || {sectors:[]}; })
    ]).then(function(res) {
      var defs = res[0].sectors || [];
      var sovByCode = {};
      (res[1].sectors || []).forEach(function(s){ sovByCode[s.code] = s; });
      _baseSectorRows = defs.map(function(s) {
        var sov = sovByCode[s.code] || {};
        return Object.assign({}, s, sov, { tier: sov.tier || s.sector_type });
      });
      _renderBaseSectorList();
    }).catch(function() {
      list.innerHTML = '<div style="font-size:10px;color:var(--red);padding:20px;text-align:center">'+tl('Sector load failed.','섹터 로드 실패.','セクター読み込み失敗。','区域加载失败。')+'</div>';
    });
  };

  window.filterSectors = function(filter, btn) {
    _baseSectorFilter = filter || 'all';
    document.querySelectorAll('.base-filter-btn').forEach(function(b){ b.classList.remove('active'); });
    if (btn) btn.classList.add('active');
    if (!_baseSectorRows) window.loadBaseSectorList();
    else _renderBaseSectorList();
  };

  window.toggleSiegeSection = function() {
    var el = document.getElementById('govSiegeSection');
    var tog = document.getElementById('siegeToggle');
    if (!el) return;
    if (el.style.display === 'none') {
      el.style.display = '';
      if (tog) tog.textContent = '▲';
      // Auto-load sector list if not yet selected
      if (!_siegeSectorCode) {
        _loadSectorDefs(function(defs) {
          if (defs.length && !_siegeSectorCode) {
            _siegeSectorCode = defs[0].code;
            var lbl = document.getElementById('siegeSectorLabel');
            if (lbl) lbl.textContent = defs[0].name || defs[0].name_en || defs[0].code;
            loadSiegeInfoPanel(_siegeSectorCode);
          }
        });
      }
    } else {
      el.style.display = 'none';
      if (tog) tog.textContent = '▼';
    }
  };

  window.openSiegeSectorPicker = function() {
    _loadSectorDefs(function(defs) {
      var items = defs.map(function(s) {
        var typeTag = s.sector_type === 'core' ? ' [CORE]' : s.sector_type === 'mid' ? ' [MID]' : '';
        return { value: s.code, label: (s.name || s.name_en || s.code) + typeTag };
      });
      gamePicker({ title: tl('SELECT SECTOR','섹터 선택','セクター選択','选择区域'), items: items, selected: _siegeSectorCode || '' }).then(function(v) {
        if (v == null) return;
        _siegeSectorCode = v;
        var chosen = defs.find(function(s){ return s.code === v; });
        var lbl = document.getElementById('siegeSectorLabel');
        if (lbl) lbl.textContent = chosen ? (chosen.name || chosen.name_en || v) : v;
        loadSiegeInfoPanel(v);
      });
    });
  };

  window.loadSiegeInfoPanel = function(code) {
    var panel = document.getElementById('siegeInfoPanel');
    if (!panel) return;
    panel.innerHTML = '<div style="font-size:10px;color:var(--tx3)">'+tl('Loading...','불러오는 중...','読み込み中...','加载中...')+'</div>';

    Promise.all([
      wlfReadFetch('sector-governance:' + code, '/api/sector-defs/' + encodeURIComponent(code) + '/governance', 15000, false).catch(function(){return null}),
      wlfReadFetch('siege-info:' + code, '/api/siege/' + encodeURIComponent(code), 10000, false).catch(function(){return {active:false}})
    ]).then(function(results) {
      var gov = results[0];
      var siegeData = results[1];
      var w = walletState.address ? walletState.address.toLowerCase() : null;
      var html = '';

      // [v7.249] 섹터 정체성 헤더 — 지오 섹터명(현 언어) + 티어 배지 (어디를 두고 싸우는지 각인)
      if (gov) {
        var _szName = (LANG==='ko'?gov.sector_name_ko:LANG==='ja'?gov.sector_name_ja:LANG==='zh'?gov.sector_name_zh:gov.sector_name_en) || gov.sector_name_en || code;
        var _szTier = (gov.sector_type||'').toLowerCase();
        var _tierCol = _szTier==='core'?'var(--gold)':_szTier==='mid'?'var(--cyan)':'var(--tx3)';
        html += '<div style="display:flex;align-items:center;gap:6px;margin-bottom:8px">';
        html += '<span style="font-size:13px;font-weight:800;color:var(--tx)">🪐 '+escapeHtml(_szName)+'</span>';
        if (_szTier) html += '<span style="font-size:8px;font-weight:700;color:'+_tierCol+';border:1px solid '+_tierCol+';border-radius:8px;padding:1px 6px;text-transform:uppercase;font-family:var(--fn)">'+_szTier+'</span>';
        html += '</div>';
      }

      // Governor info
      html += '<div style="display:flex;flex-direction:column;gap:4px;margin-bottom:10px;padding:8px;background:rgba(91,184,232,.04);border-radius:6px;border:1px solid rgba(91,184,232,.12)">';
      if (gov && gov.governor) {
        // [v7.249] 길드 거버너면 길드명/태그 우선 표시 (혈맹이 섹터 소유)
        var govName = gov.governor_guild
          ? ('['+escapeHtml(gov.governor_guild.tag||'')+'] '+escapeHtml(gov.governor_guild.name||''))
          : (gov.governor.nickname || gov.governor.wallet.slice(0,8)+'...');
        var daysTxt = gov.governor.days != null ? ' · '+gov.governor.days+'d' : '';
        html += '<div style="display:flex;justify-content:space-between"><span style="font-size:9px;color:var(--tx3)">'+(gov.governor_guild?tl('GOVERNOR GUILD','거버너 길드','知事ギルド','总督公会'):tl('GOVERNOR','거버너','知事','总督'))+'</span><span style="font-size:10px;color:var(--cyan);font-family:var(--fn)">👑 '+govName+daysTxt+'</span></div>';
        if (gov.governor_guild) {
          html += '<div style="display:flex;justify-content:space-between"><span style="font-size:9px;color:var(--tx3)">섹터 세수 → 금고</span><span style="font-size:10px;color:var(--gold);font-family:var(--fn)">🏛 '+(Math.round(gov.governor_guild.sectorTaxCollected||0)).toLocaleString()+' GP</span></div>';
        }
        html += '<div style="display:flex;justify-content:space-between"><span style="font-size:9px;color:var(--tx3)">'+tl('TAX RATE','세율','税率','税率')+'</span><span style="font-size:10px;color:var(--gold)">'+parseFloat(gov.tax_rate||2).toFixed(1)+'%</span></div>';
        html += '<div style="display:flex;justify-content:space-between"><span style="font-size:9px;color:var(--tx3)">'+tl('POLICY','정책','方針','政策')+'</span><span style="font-size:10px;color:var(--tx2)">'+_siegePolicyLabel(gov.sector_policy)+'</span></div>';
        if (gov.declaration_text) {
          html += '<div style="margin-top:4px;padding:6px 8px;background:rgba(232,72,85,.04);border-radius:4px;font-size:9px;color:var(--tx2);font-style:italic">"'+escapeHtml(gov.declaration_text.slice(0,120))+(gov.declaration_text.length>120?'…':'')+'"</div>';
        }
      } else {
        html += '<div style="font-size:10px;color:var(--tx3)">'+tl('No Governor — first to challenge wins!','거버너 없음 — 먼저 도전하면 승리!','知事不在 — 先に挑戦すれば勝利！','无总督 — 先挑战者获胜！')+'</div>';
      }
      html += '</div>';

      // Active siege
      if (siegeData && siegeData.active && siegeData.siege) {
        var s = siegeData.siege;
        var chalName = s.challenger_nickname || (s.challenger_wallet||'').slice(0,8)+'...';
        var defName  = s.defender_nickname  || (s.defender_wallet  ? s.defender_wallet.slice(0,8)+'...' : tl('None','없음','なし','无'));
        var endsAt   = s.siege_ends_at ? new Date(s.siege_ends_at) : null;
        var remaining = endsAt ? Math.max(0, Math.ceil((endsAt - Date.now()) / (1000*60))) : null;
        var timeStr  = remaining != null ? (remaining > 60 ? Math.floor(remaining/60)+'h '+remaining%60+'m' : remaining+'m') : '—';
        var statusColor = s.status === 'active' ? 'var(--red)' : 'var(--gold)';
        html += '<div style="padding:8px;background:rgba(232,72,85,.06);border-radius:6px;border:1px solid rgba(232,72,85,.25);margin-bottom:8px">';
        html += '<div style="font-size:9px;color:var(--red);font-family:var(--fn);font-weight:700;margin-bottom:4px">⚔️ '+tl('ACTIVE SIEGE','진행 중인 공성','進行中の攻城','进行中的攻城')+' · '+s.status.toUpperCase()+'</div>';
        // [v7.248] resolution_mode 배지 — 이번 공성이 함대 결전(손실 위험)인지 무혈 판정인지 선언 시점부터 노출
        var _szMode = s.fleet_battle_id ? '⚔ 함대 결전 — 패배 시 함선 손실' : (s.resolution_mode === 'fleet_battle' ? '⚔ 함대전 대기' : '◌ 무혈 판정 (함대 미배치 시 점유율 비교)');
        html += '<div style="font-size:8px;color:'+(s.fleet_battle_id?'#ff6b6b':'var(--tx3)')+';margin-bottom:6px;font-family:var(--fn)">'+_szMode+'</div>';
        html += '<div style="display:flex;justify-content:space-between;margin-bottom:4px"><span style="font-size:9px;color:var(--tx3)">'+tl('CHALLENGER','도전자','挑戦者','挑战者')+'</span><span style="font-size:10px;color:var(--red)">'+chalName+'</span></div>';
        html += '<div style="display:flex;justify-content:space-between;margin-bottom:4px"><span style="font-size:9px;color:var(--tx3)">'+tl('DEFENDER','방어자','防衛者','防御者')+'</span><span style="font-size:10px;color:var(--cyan)">'+defName+'</span></div>';
        if (s.status === 'active') {
          html += '<div style="display:flex;justify-content:space-between"><span style="font-size:9px;color:var(--tx3)">'+tl('ENDS IN','종료까지','終了まで','结束倒计时')+'</span><span style="font-size:10px;color:'+statusColor+';font-family:var(--fn)">'+timeStr+'</span></div>';
        } else {
          var startsAt = s.siege_starts_at ? new Date(s.siege_starts_at) : null;
          var startsIn = startsAt ? Math.max(0, Math.ceil((startsAt - Date.now()) / (1000*60))) : null;
          var stStr = startsIn != null ? (startsIn > 60 ? Math.floor(startsIn/60)+'h '+startsIn%60+'m' : startsIn+'m') : '—';
          html += '<div style="display:flex;justify-content:space-between"><span style="font-size:9px;color:var(--tx3)">'+tl('STARTS IN','시작까지','開始まで','开始倒计时')+'</span><span style="font-size:10px;color:var(--gold);font-family:var(--fn)">'+stStr+'</span></div>';
        }
        html += '</div>';

        // [v7.244] 결전 함대 합류/로스터/관전 패널 (async 로드, siege 우주 자족)
        html += '<div id="siegeFleetPanel_'+s.id+'"></div>';

        // Betting panel placeholder (filled async below)
        if (s.betting_event_id) {
          html += '<div id="siegeBettingPanel_'+code+'" style="margin-bottom:8px"><div style="font-size:9px;color:var(--tx3);padding:4px 0">'+tl('Loading betting...','베팅 불러오는 중...','ベッティング読み込み中...','加载投注中...')+'</div></div>';
        }
      } else {
        // Challenge button
        if (w) {
          html += '<button class="sz-btn" onclick="govDeclareSiege(\''+escapeHtml(code)+'\')" style="width:100%;color:var(--red);border-color:rgba(232,72,85,.4);font-size:9px;padding:8px 12px;margin-bottom:6px" data-i18n="gov_challenge_btn">⚔️ CHALLENGE FOR GOVERNOR</button>';
        } else {
          html += '<div style="font-size:10px;color:var(--tx3);padding:4px 0">'+tl('Connect wallet to challenge.','도전하려면 지갑을 연결하세요.','挑戦するにはウォレットを接続してください。','请连接钱包以发起挑战。')+'</div>';
        }
      }

      // Governor controls (if current user is governor of this sector)
      if (w && gov && gov.governor && gov.governor.wallet && gov.governor.wallet.toLowerCase() === w) {
        html += '<div style="padding:8px;background:rgba(91,184,232,.04);border-radius:6px;border:1px solid rgba(91,184,232,.15);margin-top:4px">';
        html += '<div style="font-size:9px;color:var(--cyan);font-family:var(--fn);font-weight:700;margin-bottom:6px">'+tl('GOVERNOR CONTROLS','거버너 컨트롤','知事コントロール','总督控制')+'</div>';
        // Tax rate
        html += '<div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">';
        html += '<span style="font-size:9px;color:var(--tx3);white-space:nowrap">'+tl('TAX RATE','세율','税率','税率')+'</span>';
        html += '<input type="range" id="siegeTaxSlider_'+code+'" min="0" max="10" step="0.5" value="'+parseFloat(gov.tax_rate||2)+'" style="flex:1;accent-color:var(--cyan)" oninput="document.getElementById(\'siegeTaxVal_'+code+'\').textContent=this.value+\'%\'">';
        html += '<span id="siegeTaxVal_'+code+'" style="font-size:10px;color:var(--cyan);font-family:var(--fn);min-width:32px">'+parseFloat(gov.tax_rate||2)+'%</span>';
        html += '<button class="sz-btn" onclick="govSaveTaxRate(\''+escapeHtml(code)+'\')" style="font-size:8px;padding:4px 8px;color:var(--cyan);border-color:rgba(91,184,232,.3)">'+tl('SET','설정','設定','设置')+'</button>';
        html += '</div>';
        // Policy
        html += '<div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">';
        html += '<span style="font-size:9px;color:var(--tx3);white-space:nowrap">'+tl('POLICY','정책','方針','政策')+'</span>';
        html += '<select id="siegePolicy_'+code+'" style="flex:1;background:var(--surface1);border:1px solid var(--bdr);color:var(--tx);font-size:10px;padding:4px 6px;border-radius:4px;font-family:var(--fn)">';
        ['open','ally_only','closed'].forEach(function(p){
          html += '<option value="'+p+'"'+(gov.sector_policy===p?' selected':'')+'>'+_siegePolicyLabel(p)+'</option>';
        });
        html += '</select>';
        html += '<button class="sz-btn" onclick="govSavePolicy(\''+escapeHtml(code)+'\')" style="font-size:8px;padding:4px 8px;color:var(--gold);border-color:rgba(255,209,102,.3)">'+tl('SET','설정','設定','设置')+'</button>';
        html += '</div>';
        // Declaration
        html += '<div style="display:flex;flex-direction:column;gap:4px">';
        html += '<span style="font-size:9px;color:var(--tx3)">'+tl('DECLARATION (5 GP)','선언문 (5 GP)','宣言文 (5 GP)','宣言 (5 GP)')+'</span>';
        html += '<textarea id="siegeDecl_'+code+'" maxlength="1000" rows="2" style="width:100%;background:var(--surface1);border:1px solid var(--bdr);color:var(--tx);font-size:9px;padding:6px 8px;border-radius:4px;font-family:var(--fn);resize:none;box-sizing:border-box">'+escapeHtml(gov.declaration_text||'')+'</textarea>';
        html += '<button class="sz-btn" onclick="govSaveDeclarationByCode(\''+escapeHtml(code)+'\')" style="font-size:8px;padding:4px 8px;color:var(--red);border-color:rgba(232,72,85,.3);align-self:flex-end">'+tl('DECLARE','선언','宣言','宣言')+'</button>';
        html += '</div>';
        html += '</div>';
      }

      panel.innerHTML = html;

      // [v7.244] 결전 함대 패널 async 로드 (활성 공성일 때만)
      if (siegeData && siegeData.active && siegeData.siege) {
        _loadSiegeFleetPanel(siegeData.siege, code, w);
      }

      // Load betting panel async if there's a betting_event_id
      if (siegeData && siegeData.siege && siegeData.siege.betting_event_id) {
        _loadSiegeBettingPanel(code, siegeData.siege.betting_event_id, w);
      }
    });
  };

  // ── [v7.244] 결전 함대 패널 — 로스터 + JOIN(공격/수비) + 관전 (siege 우주 자족) ──
  //   §19 규칙: inline onclick 금지 → data-action + delegated listener.
  function _siegeSeatRow(sideKey, label, fleetName, fleetId) {
    var col = sideKey === 'attack' ? 'var(--red)' : 'var(--cyan)';
    var val = fleetId
      ? '✓ ' + escapeHtml(fleetName || ('Fleet #' + fleetId))
      : '<span style="color:var(--tx3)">미배치</span>';
    return '<div style="display:flex;justify-content:space-between;margin-bottom:3px"><span style="font-size:9px;color:'+col+'">'+label+'</span><span style="font-size:9px">'+val+'</span></div>';
  }
  // [Phase 2] 한 진영의 합류 함대 목록 (혈맹원 여럿이 같은 전장에)
  function _siegeSideList(sideKey, label, commits) {
    var col = sideKey === 'attack' ? 'var(--red)' : 'var(--cyan)';
    var h = '<div style="margin-bottom:5px"><div style="font-size:9px;color:'+col+';font-weight:700">'+label+' · '+commits.length+'함대</div>';
    if (commits.length) {
      h += '<div style="padding-left:8px">';
      commits.slice(0, 12).forEach(function(c){
        var nm = escapeHtml(c.fleet_name || ('Fleet #' + c.fleet_id));
        h += '<div style="font-size:8px;color:var(--tx2);display:flex;justify-content:space-between"><span>· '+nm+'</span><span style="color:var(--tx3)">'+(c.ship_count||0)+'척</span></div>';
      });
      if (commits.length > 12) h += '<div style="font-size:8px;color:var(--tx3)">… 외 '+(commits.length-12)+'함대</div>';
      h += '</div>';
    } else {
      h += '<div style="font-size:8px;color:var(--tx3);padding-left:8px">미배치</div>';
    }
    return h + '</div>';
  }
  function _siegeJoinErr(code) {
    var m = { not_a_participant:'이 공성의 참가자가 아닙니다', fleet_in_battle:'해당 함대가 전투 중입니다',
      fleet_empty:'함대에 함선이 없습니다', battle_already_created:'이미 결전이 시작되었습니다',
      fleet_not_found:'함대를 찾을 수 없습니다', siege_resolved:'이미 종료된 공성입니다',
      side_full:'이 진영 합류 함대가 가득 찼습니다' };
    return m[code] || ('합류 실패' + (code ? (': ' + code) : ''));
  }
  function _siegeParticipationIntel(roster, atkN, defN) {
    var fleetMode = roster && roster.resolution_mode === 'fleet_battle';
    var battleMade = !!(roster && roster.fleet_battle_id);
    var pressure = atkN === defN ? '전력 균형' : (atkN > defN ? '공격 우세' : '수비 우세');
    if (fleetMode || battleMade) {
      return '승리 시 거버너/세율/섹터 권한 장악 · 결전 함대는 패배 시 손실 위험 · 현재 ' + pressure;
    }
    return '함대 미배치 시 영토 점유율로 판정 · 함선 손실 없음 · 현재 ' + pressure;
  }
  function _siegeRewardIntel(roster) {
    var code = roster && roster.sector_code ? String(roster.sector_code).toUpperCase() : 'SECTOR';
    return code + ' 지배권, 세율 정책, 선언문, 길드 금고 세수 흐름이 이 전투 결과로 바뀝니다.';
  }
  async function _loadSiegeFleetPanel(siege, code, w) {
    var el = document.getElementById('siegeFleetPanel_' + siege.id);
    if (!el) return;
    if (!w) { el.innerHTML = ''; return; }
    try {
      var rosterResp = await wlfReadFetch('siege-roster-' + siege.id, '/api/siege/' + siege.id + '/roster', 5000, false).catch(function(){return null});
      var roster = rosterResp && rosterResp.roster ? rosterResp.roster : null;
      if (!roster) { el.innerHTML = ''; return; }
      var myFleets = [];
      try {
        var fd = await wlfReadFetch('siege-fleets', '/api/fleets', 8000, true);
        myFleets = ((fd && fd.fleets) || []).filter(function(f){ return (parseInt(f.ships_alive)||parseInt(f.ship_count)||0) > 0; });
      } catch(_) {}

      var battleMade = !!roster.fleet_battle_id;
      var modeBadge = roster.resolution_mode === 'fleet_battle' ? '⚔ 함대전' : '◌ 무혈판정';
      var h = '<div style="padding:8px;background:rgba(255,209,102,.05);border-radius:6px;border:1px solid rgba(255,209,102,.2);margin-bottom:8px">';
      // [Phase 2] 다함대 — 양 진영 합류 함대 목록/카운트
      var _commits = Array.isArray(roster.commits) ? roster.commits : [];
      var _atkN = roster.atk_count || _commits.filter(function(c){return c.side==='atk';}).length;
      var _defN = roster.def_count || _commits.filter(function(c){return c.side==='def';}).length;
      h += '<div style="font-size:9px;color:var(--gold);font-family:var(--fn);font-weight:700;margin-bottom:6px">⚔ 결전 함대 ('+_atkN+' vs '+_defN+')<span style="float:right;color:var(--tx3)">'+modeBadge+'</span></div>';
      h += '<div style="font-size:8px;color:var(--tx2);line-height:1.45;margin-bottom:6px;padding:5px 6px;border-radius:5px;background:rgba(255,255,255,.035);border:1px solid rgba(255,255,255,.06)">'
        + escapeHtml(_siegeParticipationIntel(roster, _atkN, _defN)) + '<br>'
        + '<span style="color:var(--tx3)">'+escapeHtml(_siegeRewardIntel(roster))+'</span>'
        + '</div>';
      h += _siegeSideList('attack', '⚔ 공격', _commits.filter(function(c){return c.side==='atk';}));
      h += _siegeSideList('defense', '🛡 수비', _commits.filter(function(c){return c.side==='def';}));

      if (!battleMade) {
        if (myFleets.length) {
          h += '<select data-siege-fleet-sel="'+siege.id+'" style="width:100%;background:var(--surface1);border:1px solid var(--bdr);color:var(--tx);font-size:10px;padding:4px 6px;border-radius:4px;font-family:var(--fn);margin:4px 0">';
          myFleets.forEach(function(f){ h += '<option value="'+f.id+'">'+escapeHtml(f.name||('Fleet #'+f.id))+' ('+(f.ships_alive||f.ship_count||0)+')</option>'; });
          h += '</select>';
          h += '<div style="display:flex;gap:6px">';
          h += '<button type="button" class="sz-btn" data-action="siegeJoin" data-side="attack" data-siege="'+siege.id+'" style="flex:1;font-size:9px;padding:6px;color:var(--red);border-color:rgba(232,72,85,.4)">⚔ 공격 합류</button>';
          h += '<button type="button" class="sz-btn" data-action="siegeJoin" data-side="defense" data-siege="'+siege.id+'" style="flex:1;font-size:9px;padding:6px;color:var(--cyan);border-color:rgba(91,184,232,.4)">🛡 수비 합류</button>';
          h += '</div>';
        } else {
          h += '<div style="font-size:9px;color:var(--tx3);padding:4px 0">함대가 없어도 <b>영토 점유율로 도전/방어</b> 가능 (◌ 무혈 판정, 함선 손실 없음). 함대전을 원하면 조선소에서 함선을 건조하세요.</div>';
        }
      }
      if (battleMade && siege.status === 'active') {
        h += '<button type="button" class="sz-btn" data-action="siegeSpectate" data-battle="'+roster.fleet_battle_id+'" style="width:100%;font-size:9px;padding:6px;margin-top:6px;color:var(--gold);border-color:rgba(255,209,102,.4)">👁 관전</button>';
      }
      h += '</div>';
      el.innerHTML = h;

      if (!el.dataset.delegated) {
        el.dataset.delegated = '1';
        el.addEventListener('click', function(ev) {
          var btn = ev.target.closest('button[data-action]');
          if (!btn) return;
          ev.stopPropagation();
          var act = btn.getAttribute('data-action');
          if (act === 'siegeSpectate') {
            var bid = parseInt(btn.getAttribute('data-battle'), 10);
            if (bid && typeof openBattleViewer === 'function') { try { openBattleViewer(bid); } catch(e){ console.error('openBattleViewer', e); } }
            return;
          }
          if (act === 'siegeJoin') {
            if (btn.disabled) return;
            var sid = parseInt(btn.getAttribute('data-siege'), 10);
            var side = btn.getAttribute('data-side');
            var sel = el.querySelector('select[data-siege-fleet-sel="'+sid+'"]');
            var fleetId = sel ? parseInt(sel.value, 10) : null;
            if (!fleetId) { if (typeof showToast==='function') showToast('함대를 선택하세요','warn'); return; }
            console.log('[BTN] siegeJoin', sid, side, fleetId);
            // [v7.248] full-loss 라이브 — 합류 = 패배 시 함선 영구 손실. 무손실 대안(점유율 판정) 안내 후 confirm.
            var doCommit = function() {
              btn.disabled = true; var prev = btn.textContent; btn.textContent = '...';
              fetch('/api/siege/'+sid+'/commit-fleet', {
                method: 'POST',
                headers: Object.assign({ 'Content-Type':'application/json' }, getAuthHeaders()),
                body: JSON.stringify({ fleetId: fleetId })
              }).then(function(r){ return r.json().then(function(j){ return { ok:r.ok, j:j }; }); })
                .then(function(res){
                  if (!res.ok || !res.j || !res.j.success) {
                    if (typeof showToast==='function') showToast(_siegeJoinErr(res.j && res.j.error), 'warn');
                    btn.disabled = false; btn.textContent = prev; return;
                  }
                  if (typeof showToast==='function') showToast(side==='attack'?'⚔ 공격 함대 합류 완료':'🛡 수비 함대 합류 완료','success');
                  loadSiegeInfoPanel(code);
                }).catch(function(){ if (typeof showToast==='function') showToast('합류 실패','warn'); btn.disabled = false; btn.textContent = prev; });
            };
            if (typeof gameConfirm === 'function') {
              Promise.resolve(gameConfirm({
                icon: '⚠',
                title: side==='attack' ? '공격 함대 합류' : '수비 함대 합류',
                body: '결전에서 <b>패배하면 합류한 함대의 함선이 <span style="color:#ff6b6b">영구 손실(전사)</span></b>될 수 있습니다.<br><br>함대를 걸지 않으면 영토 점유율로만 판정되어 <b>함선 손실이 없습니다</b>.',
                confirmText: side==='attack' ? '⚔ 합류' : '🛡 합류'
              })).then(function(ok){ if (ok) doCommit(); });
            } else { doCommit(); }
          }
        });
      }
    } catch(e) { console.error('[siegeFleetPanel]', e); el.innerHTML = ''; }
  }

  // ── Betting panel loader ──
  function _loadSiegeBettingPanel(code, betEventId, w) {
    var container = document.getElementById('siegeBettingPanel_'+code);
    if (!container) return;

    Promise.all([
      wlfReadFetch('betting-odds:' + betEventId, '/api/betting/events/'+betEventId+'/odds', 10000, false).catch(function(){return null}),
      w ? wlfReadFetch('betting-mine', '/api/betting/mine', 10000, true).catch(function(){return {bets:[]}}) : Promise.resolve({bets:[]})
    ]).then(function(res) {
      var odds = res[0];
      var userBets = (res[1] && res[1].bets) || [];
      if (!odds || odds.status === 'resolved' || odds.status === 'cancelled') {
        container.innerHTML = '';
        return;
      }

      // Check if user already bet on this event
      var myBet = userBets.find(function(b){ return b.event_id === betEventId; });

      var html = '<div style="padding:8px;background:rgba(255,209,102,.04);border-radius:6px;border:1px solid rgba(255,209,102,.2)">';
      html += '<div style="font-size:9px;color:var(--gold);font-family:var(--fn);font-weight:700;margin-bottom:8px">🎰 '+tl('SIEGE BETTING','공성 베팅','攻城ベッティング','攻城投注')+'</div>';

      // Odds display
      var aGP  = odds.option_a.total_gp || 0;
      var bGP  = odds.option_b.total_gp || 0;
      var total = aGP + bGP;
      var aOdds = odds.option_a.odds ? odds.option_a.odds.toFixed(2)+'×' : '—';
      var bOdds = odds.option_b.odds ? odds.option_b.odds.toFixed(2)+'×' : '—';
      var aLabel = (odds.option_a.label || tl('Challenger','도전자','挑戦者','挑战者')).slice(0,22);
      var bLabel = (odds.option_b.label || tl('Governor','거버너','総督','总督')).slice(0,22);

      // Pool bar
      var aFrac = total > 0 ? Math.round(aGP/total*100) : 50;
      var bFrac = 100 - aFrac;
      html += '<div style="margin-bottom:8px">';
      html += '<div style="display:flex;justify-content:space-between;font-size:8px;color:var(--tx3);margin-bottom:3px">';
      html += '<span>'+escapeHtml(aLabel)+'</span><span>'+escapeHtml(bLabel)+'</span>';
      html += '</div>';
      html += '<div style="display:flex;height:6px;border-radius:3px;overflow:hidden;background:rgba(255,255,255,.06)">';
      html += '<div style="width:'+aFrac+'%;background:var(--red);transition:width .4s"></div>';
      html += '<div style="flex:1;background:var(--cyan)"></div>';
      html += '</div>';
      html += '<div style="display:flex;justify-content:space-between;font-size:9px;margin-top:3px">';
      html += '<span style="color:var(--red)">'+aFrac+'% · '+aOdds+'</span>';
      html += '<span style="color:var(--tx3);font-size:8px">'+total+tl(' GP pool',' GP 풀',' GPプール',' GP奖池')+'</span>';
      html += '<span style="color:var(--cyan)">'+bFrac+'% · '+bOdds+'</span>';
      html += '</div>';
      html += '</div>';

      if (myBet) {
        // Show existing bet
        var optColor = myBet.option === 'a' ? 'var(--red)' : 'var(--cyan)';
        var optName  = myBet.option === 'a' ? aLabel : bLabel;
        var statusTxt = myBet.status === 'won' ? '✅ '+tl('WON','승리','勝利','获胜')+' +'+myBet.payout_gp+' GP' : myBet.status === 'lost' ? '❌ '+tl('LOST','패배','敗北','失败') : '⏳ '+tl('PENDING','진행 중','進行中','进行中');
        html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 8px;background:rgba(255,255,255,.04);border-radius:4px;font-size:9px">';
        html += '<span style="color:var(--tx3)">'+tl('MY BET','내 베팅','私のベット','我的投注')+'</span>';
        html += '<span style="color:'+optColor+'">'+escapeHtml(optName.slice(0,16))+'</span>';
        html += '<span style="color:var(--gold);font-family:var(--fn)">'+myBet.amount_gp+' GP</span>';
        html += '<span style="color:var(--tx2)">'+statusTxt+'</span>';
        html += '</div>';
      } else if (w && odds.status === 'open') {
        // Bet input
        html += '<div style="display:flex;flex-direction:column;gap:6px">';
        html += '<div style="display:flex;gap:4px">';
        html += '<button onclick="window._setSiegeBetOption(\''+code+'\',\'a\')" id="betOptA_'+code+'" class="sz-btn" style="flex:1;font-size:8px;padding:5px;color:var(--red);border-color:rgba(232,72,85,.4)">⚔️ '+escapeHtml(aLabel.slice(0,16))+'</button>';
        html += '<button onclick="window._setSiegeBetOption(\''+code+'\',\'b\')" id="betOptB_'+code+'" class="sz-btn" style="flex:1;font-size:8px;padding:5px;color:var(--cyan);border-color:rgba(91,184,232,.4)">🛡 '+escapeHtml(bLabel.slice(0,16))+'</button>';
        html += '</div>';
        html += '<div style="display:flex;gap:4px;align-items:center">';
        html += '<input type="number" id="betAmt_'+code+'" min="10" max="1000" placeholder="GP" style="flex:1;background:var(--surface1);border:1px solid var(--bdr);color:var(--tx);font-size:10px;padding:5px 8px;border-radius:4px;font-family:var(--fn)">';
        html += '<button onclick="govPlaceBet(\''+code+'\','+betEventId+')" class="sz-btn" style="font-size:8px;padding:5px 10px;color:var(--gold);border-color:rgba(255,209,102,.4)">'+tl('BET','베팅','ベット','投注')+'</button>';
        html += '</div>';
        html += '<div id="betOptSel_'+code+'" style="font-size:9px;color:var(--tx3);text-align:center">'+tl('Select a side above','위에서 진영을 선택하세요','上で陣営を選択','请在上方选择阵营')+'</div>';
        html += '</div>';
      } else if (!w) {
        html += '<div style="font-size:9px;color:var(--tx3)">'+tl('Connect wallet to bet','베팅하려면 지갑을 연결하세요','ベットするにはウォレット接続','请连接钱包以投注')+'</div>';
      }

      html += '</div>';
      container.innerHTML = html;
    });
  }

  // ── Bet option selector (toggle highlight) ──
  window._siegeBetOptions = {};
  window._setSiegeBetOption = function(code, opt) {
    window._siegeBetOptions[code] = opt;
    var aBtn = document.getElementById('betOptA_'+code);
    var bBtn = document.getElementById('betOptB_'+code);
    var info = document.getElementById('betOptSel_'+code);
    if (aBtn) aBtn.style.opacity = opt === 'a' ? '1' : '0.4';
    if (bBtn) bBtn.style.opacity = opt === 'b' ? '1' : '0.4';
    if (info) info.textContent = tl('Betting on: ','베팅 대상: ','ベット対象: ','投注于: ') + (opt === 'a' ? '⚔️ '+tl('Challenger','도전자','挑戦者','挑战者') : '🛡 '+tl('Governor','거버너','総督','总督'));
  };

  // ── Place bet ──
  window.govPlaceBet = function(code, betEventId) {
    var w = walletState.address;
    if (!w) { showToast(tl('Connect wallet first','지갑을 먼저 연결하세요','先にウォレットを接続してください','请先连接钱包')); return; }
    var opt = window._siegeBetOptions[code];
    if (!opt) { showToast(tl('Select a side to bet on','베팅할 진영을 선택하세요','ベットする陣営を選択','请选择投注阵营')); return; }
    var amtEl = document.getElementById('betAmt_'+code);
    var amt = amtEl ? parseInt(amtEl.value) : 0;
    if (!amt || amt < 10) { showToast(tl('Minimum bet is 10 GP','최소 베팅은 10 GP입니다','最低ベットは10 GP','最低投注10 GP')); return; }

    fetch('/api/betting/bet', {
      method: 'POST',
      headers: Object.assign({'Content-Type': 'application/json'}, getAuthHeaders()),
      body: JSON.stringify({ eventId: betEventId, option: opt, amount: amt })
    }).then(function(r){return r.json()}).then(function(d) {
      if (!d.success) {
        var msg = {
          insufficient_gp: tl('Not enough GP','GP가 부족합니다','GPが足りません','GP不足'),
          already_bet: tl('Already placed a bet on this siege','이 공성에 이미 베팅했습니다','この攻城に既にベット済み','已对此攻城投注'),
          max_bets_reached: tl('Max active bets reached','활성 베팅 한도 도달','アクティブベット上限に到達','已达活跃投注上限'),
          bet_too_small: tl('Minimum bet is ','최소 베팅은 ','最低ベットは ','最低投注 ')+d.min+' GP',
          bet_too_large: tl('Maximum bet is ','최대 베팅은 ','最高ベットは ','最高投注 ')+d.max+' GP',
          event_closed: tl('Betting is closed','베팅이 마감되었습니다','ベッティングは締め切られました','投注已截止'),
          betting_disabled: tl('Betting is currently disabled','현재 베팅이 비활성화되어 있습니다','現在ベッティングは無効です','当前投注已禁用')
        }[d.error] || d.error;
        showToast('⚠️ '+msg);
        return;
      }
      showToast('🎰 '+tl('Bet placed! ','베팅 완료! ','ベット完了！ ','投注成功！ ')+amt+tl(' GP on ',' GP · ',' GP · ',' GP · ')+(opt==='a'?tl('Challenger','도전자','挑戦者','挑战者'):tl('Governor','거버너','総督','总督')));
      delete window._siegeBetOptions[code];
      loadSiegeInfoPanel(code);
    }).catch(function(){ showToast(tl('Failed to place bet','베팅 실패','ベット失敗','投注失败')); });
  };

  function _siegePolicyLabel(p) {
    if (p === 'open') return '🌐 '+tl('Open','개방','開放','开放');
    if (p === 'ally_only') return '🤝 '+tl('Allies Only','동맹만','同盟のみ','仅盟友');
    if (p === 'closed') return '🔒 '+tl('Closed','폐쇄','閉鎖','关闭');
    return p || tl('Open','개방','開放','开放');
  }

  window.govDeclareSiege = function(code) {
    var w = walletState.address;
    if (!w) { showToast(tl('Connect wallet first','지갑을 먼저 연결하세요','先にウォレットを接続してください','请先连接钱包')); return; }
    var gpBal = parseFloat(walletState.gameGP || 0);
    var cost = 100; // default, should match settings
    gameConfirm({
      title: tl('CHALLENGE FOR GOVERNOR','거버너 도전','知事に挑戦','挑战总督'),
      icon: '⚔️',
      body: tl('Challenge for control of <b style="color:var(--red)">','<b style="color:var(--red)">','<b style="color:var(--red)">','挑战 <b style="color:var(--red)">')+code+tl('</b>?<br>You need 3+ territories in the sector.','</b> 지배권에 도전하시겠습니까?<br>섹터에 영토 3개 이상이 필요합니다.','</b> の支配権に挑戦しますか？<br>セクターに領土3つ以上が必要です。','</b> 的控制权？<br>需要在该区域拥有3块以上领地。'),
      info: [
        { k: tl('SIEGE COST','공성 비용','攻城コスト','攻城费用'), v: cost+' GP' },
        { k: tl('YOUR GP','내 GP','あなたのGP','你的GP'), v: gpBal.toFixed(0), ok: gpBal >= cost, insufficient: gpBal < cost },
        { k: tl('WARNING PERIOD','경고 기간','警告期間','警告期'), v: tl('48h before battle starts','전투 시작 48시간 전','戦闘開始48時間前','战斗开始前48小时') }
      ],
      confirmText: gpBal < cost ? tl('INSUFFICIENT GP','GP 부족','GP不足','GP不足') : tl('DECLARE SIEGE','공성 선언','攻城宣言','宣战攻城'),
      disabled: gpBal < cost
    }).then(function(ok) {
      if (!ok) return;
      fetch('/api/siege/declare', {
        method: 'POST',
        headers: Object.assign({ 'Content-Type': 'application/json' }, getAuthHeaders()),
        body: JSON.stringify({ wallet: w, sectorCode: code })
      }).then(function(r){return r.json()}).then(function(d) {
        if (d.error) {
          var msg = d.error === 'insufficient_territories' ? tl('Need ','필요: ','必要: ','需要 ')+d.detail.required+tl(' territories in this sector (you have ',' 영토 (현재 ',' 領土（現在 ',' 块该区域领地（你拥有 ')+d.detail.current+')' :
                    d.error === 'insufficient_gp' ? tl('Not enough GP (need ','GP 부족 (필요 ','GP不足（必要 ','GP不足（需要 ')+d.detail.required+')' :
                    d.error === 'siege_already_active' ? tl('A siege is already active in this sector','이 섹터에 이미 공성이 진행 중입니다','このセクターで既に攻城が進行中です','此区域已有进行中的攻城') :
                    d.error;
          showToast('⚠️ ' + msg);
          return;
        }
        showToast('⚔️ '+tl('Siege declared! Battle starts in 48h','공성 선언! 48시간 후 전투 시작','攻城宣言！48時間後に戦闘開始','攻城已宣战！48小时后开战'));
        loadSiegeInfoPanel(code);
      }).catch(function(){ showToast(tl('Failed to declare siege','공성 선언 실패','攻城宣言失敗','攻城宣战失败')); });
    });
  };

  window.govSaveTaxRate = function(code) {
    var w = walletState.address;
    if (!w) { showToast(tl('Not connected','연결되지 않음','未接続','未连接')); return; }
    var slider = document.getElementById('siegeTaxSlider_'+code);
    if (!slider) return;
    var rate = parseFloat(slider.value);
    fetch('/api/governor/tax-rate', {
      method: 'PUT',
      headers: Object.assign({ 'Content-Type': 'application/json' }, getAuthHeaders()),
      body: JSON.stringify({ wallet: w, sectorCode: code, taxRate: rate })
    }).then(function(r){return r.json()}).then(function(d) {
      if (d.error) { showToast(tl('Error: ','오류: ','エラー: ','错误: ')+d.error); return; }
      showToast(tl('Tax rate set to ','세율 설정: ','税率設定: ','税率已设为 ')+d.tax_rate+'%');
      loadSiegeInfoPanel(code);
    }).catch(function(){ showToast(tl('Failed','실패','失敗','失败')); });
  };

  window.govSavePolicy = function(code) {
    var w = walletState.address;
    if (!w) { showToast(tl('Not connected','연결되지 않음','未接続','未连接')); return; }
    var sel = document.getElementById('siegePolicy_'+code);
    if (!sel) return;
    fetch('/api/governor/policy', {
      method: 'PUT',
      headers: Object.assign({ 'Content-Type': 'application/json' }, getAuthHeaders()),
      body: JSON.stringify({ wallet: w, sectorCode: code, policy: sel.value })
    }).then(function(r){return r.json()}).then(function(d) {
      if (d.error) { showToast(tl('Error: ','오류: ','エラー: ','错误: ')+d.error); return; }
      showToast(tl('Policy updated: ','정책 변경: ','方針更新: ','政策已更新: ')+_siegePolicyLabel(d.policy));
      loadSiegeInfoPanel(code);
    }).catch(function(){ showToast(tl('Failed','실패','失敗','失败')); });
  };

  window.govSaveDeclarationByCode = function(code) {
    var w = walletState.address;
    if (!w) { showToast(tl('Not connected','연결되지 않음','未接続','未连接')); return; }
    var ta = document.getElementById('siegeDecl_'+code);
    if (!ta) return;
    var text = ta.value.trim();
    if (!text) { showToast(tl('Enter declaration text','선언문을 입력하세요','宣言文を入力してください','请输入宣言文')); return; }
    fetch('/api/governor/declaration', {
      method: 'POST',
      headers: Object.assign({ 'Content-Type': 'application/json' }, getAuthHeaders()),
      body: JSON.stringify({ wallet: w, sectorCode: code, text: text })
    }).then(function(r){return r.json()}).then(function(d) {
      if (d.error) { showToast(tl('Error: ','오류: ','エラー: ','错误: ')+d.error); return; }
      showToast(tl('Declaration saved! (-5 GP)','선언문 저장 완료! (-5 GP)','宣言文を保存しました！(-5 GP)','宣言已保存！(-5 GP)'));
      loadSiegeInfoPanel(code);
    }).catch(function(){ showToast(tl('Failed','실패','失敗','失败')); });
  };

  // Helper to escape HTML
  function escapeHtml(s) {
    return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  // ──────────────────────────────────────────────────────
  // MY TITLES
  // ──────────────────────────────────────────────────────
  window.toggleTitlesSection = function() {
    var el = document.getElementById('govTitlesSection');
    var tog = document.getElementById('titlesToggle');
    if (!el) return;
    if (el.style.display === 'none') {
      el.style.display = '';
      if (tog) tog.textContent = '▲';
      loadTitlesPanel();
    } else {
      el.style.display = 'none';
      if (tog) tog.textContent = '▼';
    }
  };

  function loadTitlesPanel() {
    var panel = document.getElementById('titlesPanel');
    if (!panel) return;
    var w = walletState.address;
    if (!w) {
      panel.innerHTML = '<div style="font-size:10px;color:var(--tx3)">'+tl('Connect wallet to view titles.','칭호를 보려면 지갑을 연결하세요.','称号を見るにはウォレットを接続してください。','请连接钱包以查看称号。')+'</div>';
      return;
    }
    panel.innerHTML = '<div style="font-size:10px;color:var(--tx3)">'+tl('Loading...','불러오는 중...','読み込み中...','加载中...')+'</div>';
    var lang = window._currentLang || 'en';

    wlfReadFetch('user-titles', '/api/user/titles', 15000, true)
      .then(function(d) {
        if (!d) { panel.innerHTML = '<div style="font-size:10px;color:var(--tx3);padding:6px 0">'+tl('Please wait a moment.','잠시만 기다려 주세요.','少々お待ちください。','请稍候。')+'</div>'; return; }
        var titles = d.titles || [];
        if (!titles.length) {
          panel.innerHTML = '<div style="font-size:10px;color:var(--tx3);padding:6px 0">'+tl('No titles yet. Complete achievements to earn them!','아직 칭호가 없습니다. 업적을 달성해 획득하세요!','まだ称号がありません。実績を達成して獲得しましょう！','暂无称号。完成成就以获得！')+'</div>';
          return;
        }
        var gpCost = 20;
        var html = '<div style="display:flex;flex-direction:column;gap:6px">';
        titles.forEach(function(t) {
          var name = t['title_'+lang] || t.title_en || t.title_code;
          var equipped = t.is_equipped;
          var btnStyle = equipped
            ? 'color:var(--gold);border-color:rgba(255,209,102,.5);background:rgba(255,209,102,.08)'
            : 'color:var(--tx3);border-color:rgba(255,255,255,.1)';
          html += '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:6px 8px;background:rgba(255,255,255,.03);border-radius:4px">';
          html += '<span style="font-size:10px;color:'+(equipped?'var(--gold)':'var(--tx)')+'">'+
            (equipped?'🎖 ':'')+ escapeHtml(name)+'</span>';
          html += '<button class="sz-btn" onclick="govEquipTitle(\''+escapeHtml(t.title_code)+'\')" style="font-size:8px;padding:3px 8px;'+btnStyle+'">'+
            (equipped ? tl('UNEQUIP','해제','解除','卸下') : tl('EQUIP (','장착 (','装備 (','装备 (')+gpCost+' GP)')+'</button>';
          html += '</div>';
        });
        html += '</div>';
        html += '<div style="font-size:9px;color:var(--tx3);margin-top:6px">'+tl('Equip cost: ','장착 비용: ','装備コスト: ','装备费用: ')+gpCost+tl(' GP · Unequip is free',' GP · 해제는 무료',' GP · 解除は無料',' GP · 卸下免费')+'</div>';
        panel.innerHTML = html;
      }).catch(function() {
        panel.innerHTML = '<div style="font-size:10px;color:var(--tx3)">'+tl('Failed to load titles.','칭호 로드 실패.','称号の読み込み失敗。','加载称号失败。')+'</div>';
      });
  }

  window.govEquipTitle = function(titleCode) {
    var w = walletState.address;
    if (!w) { showToast(tl('Connect wallet first','지갑을 먼저 연결하세요','先にウォレットを接続してください','请先连接钱包')); return; }
    fetch('/api/user/titles/equip', {
      method: 'POST',
      headers: Object.assign({ 'Content-Type': 'application/json' }, getAuthHeaders()),
      body: JSON.stringify({ wallet: w, titleCode: titleCode })
    }).then(function(r){return r.json()}).then(function(d) {
      if (!d.success) {
        var msg = d.error === 'insufficient_gp' ? tl('Not enough GP (need ','GP 부족 (필요 ','GP不足（必要 ','GP不足（需要 ')+d.required+')' :
                  d.error === 'title_not_owned'  ? tl('You don\'t own this title','이 칭호를 보유하고 있지 않습니다','この称号を所有していません','你未拥有此称号') : d.error;
        showToast('⚠️ '+msg); return;
      }
      if (d.equipped) {
        showToast('🎖 '+tl('Title equipped! (-','칭호 장착 완료! (-','称号を装備しました！(-','已装备称号！(-')+d.gp_spent+' GP)');
      } else {
        showToast(tl('Title unequipped','칭호 해제됨','称号を解除しました','已卸下称号'));
      }
      loadTitlesPanel();
      // Refresh badge
      try { updateWalletUI(); } catch(e) {}
    }).catch(function(){ showToast(tl('Failed','실패','失敗','失败')); });
  };

  // ──────────────────────────────────────────────────────
  // MY FLEET (Migration 092)
  // ──────────────────────────────────────────────────────
  var _blueprints = null;

  window.toggleFleetSection = function() {
    var el = document.getElementById('govFleetSection');
    var tog = document.getElementById('fleetToggle');
    if (!el) return;
    if (el.style.display === 'none') {
      el.style.display = '';
      if (tog) tog.textContent = '▲';
      loadFleetPanel();
    } else {
      el.style.display = 'none';
      if (tog) tog.textContent = '▼';
    }
  };

  var _upgradeCosts = null;

  function loadFleetPanel() {
    var panel = document.getElementById('fleetPanel');
    if (!panel) return;
    var w = walletState.address;
    if (!w) {
      panel.innerHTML = '<div style="font-size:10px;color:var(--tx3)">'+(t('gov_fleet_hint')||'Connect wallet to view your fleet.')+'</div>';
      return;
    }
    // 새 fleet 시스템 (/api/fleets) 사용 — 기존 /api/ships 직접 ship 목록 호출 제거.
    // 함선 관리는 SHIPYARD 모달, 함대 관리는 FLEET COMMAND 모달에서 진행.
    panel.innerHTML = '<div style="font-size:10px;color:var(--tx3)">'+tl('Loading...','불러오는 중...','読み込み中...','加载中...')+'</div>';
    wlfReadFetch('fleet-panel', '/api/fleets', 8000, true)
      .catch(function(){ return { fleets: [] } })
      .then(function(data) {
        var fleets = data.fleets || data || [];
        if (!Array.isArray(fleets)) fleets = [];
        var totalShips = fleets.reduce(function(sum,f){ return sum + (parseInt(f.ships_alive)||parseInt(f.ship_count)||0); }, 0);
        var html = '';
        if (fleets.length) {
          html += '<div style="margin-bottom:8px"><div style="font-size:9px;color:#5cbbff;font-weight:700;margin-bottom:6px">'
            + (t('gov_fleet_my')||'MY FLEETS') + ' <span style="color:var(--tx3)">'+fleets.length+tl(' fleets · ',' 함대 · ',' 艦隊 · ',' 支舰队 · ')+totalShips+tl(' ships',' 척',' 隻',' 艘')+'</span></div>';
          fleets.slice(0,3).forEach(function(f){
            var nm = f.name || ('Fleet #'+f.id);
            html += '<div style="background:rgba(92,187,255,.04);border:1px solid rgba(92,187,255,.12);border-radius:6px;padding:6px 8px;margin-bottom:4px;display:flex;justify-content:space-between;align-items:center">'
              + '<span style="font-size:10px;font-weight:700;color:#5cbbff">⚓ '+nm+'</span>'
              + '<span style="font-size:9px;color:var(--tx3)">'+(parseInt(f.ships_alive)||parseInt(f.ship_count)||0)+tl(' ships',' 척',' 隻',' 艘')+'</span>'
              + '</div>';
          });
          if (fleets.length > 3) {
            html += '<div style="font-size:8px;color:var(--tx3);text-align:center">+'+(fleets.length-3)+tl(' more...',' 개 더...',' 件...',' 个...')+'</div>';
          }
          html += '</div>';
        } else {
          html += '<div style="font-size:10px;color:var(--tx3);padding:6px 0;text-align:center">'
            + (t('gov_fleet_empty')||'No fleets yet — open Shipyard to start building.') + '</div>';
        }
        // Action buttons (open the proper modals)
        html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:5px;margin-top:6px">'
          + '<button onclick="(typeof openShipyard===\'function\')&&openShipyard()" style="font-size:9px;padding:6px;border-radius:5px;border:1px solid rgba(79,195,247,.4);background:rgba(79,195,247,.1);color:#4fc3f7;cursor:pointer;font-family:var(--fn);font-weight:700">⚓ '+(t('fcmd_open_shipyard')||'SHIPYARD')+'</button>'
          + '<button onclick="(typeof openFleetCmd===\'function\')&&openFleetCmd()" style="font-size:9px;padding:6px;border-radius:5px;border:1px solid rgba(167,139,250,.4);background:rgba(167,139,250,.1);color:#a78bfa;cursor:pointer;font-family:var(--fn);font-weight:700">⚔ '+(t('fcmd_my_fleets')||'MY FLEETS')+'</button>'
          + '</div>';
        panel.innerHTML = html;
      });
  }
  // Legacy wallet-query ships UI는 제거됨. loadFleetPanel은 신 /api/fleets API 사용.
  // govBuildShip/govRepairShip/govUpgradeShip은 openShipyard()/openFleetCmd() 모달로 redirect.
  window.govBuildShip = function(_shipType) {
    showToast('🔨 ' + (t('use_shipyard')||'Use Shipyard'), 'info');
    if (typeof openShipyard === 'function') openShipyard();
  };
  window.govRepairShip = function(_shipId) {
    showToast('🔧 ' + (t('use_fleet_cmd')||'Use Fleet Command'), 'info');
    if (typeof openFleetCmd === 'function') openFleetCmd();
  };
  window.govUpgradeShip = function(_shipId) {
    showToast('⬆ ' + (t('use_fleet_cmd')||'Use Fleet Command'), 'info');
    if (typeof openFleetCmd === 'function') openFleetCmd();
  };

  // (legacy govBuildShip/govRepairShip/govUpgradeShip 본문 제거됨 — stubs above redirect to openShipyard/openFleetCmd)

  // ──────────────────────────────────────────────────────
  // NAVAL BATTLES (legacy — 함대전은 fleet_battles + Hijack로 통합)
  // ──────────────────────────────────────────────────────
  window.toggleBattleSection = function() { /* replaced by pvpHubSwitchTab */ };

  // Legacy battle panel — replaced by Fleet Combat system (see fleet_battles).
  // Old /api/battle/* endpoints removed in cleanup commit (services/battle.js was
  // schema-mismatched and 500'ing). PVP now goes through Fleet system + Hijack.
  function loadBattlePanel() {
    var panel = document.getElementById('battlePanel');
    if (!panel) return;
    panel.innerHTML = '<div style="font-size:10px;color:var(--tx3);padding:6px 0;line-height:1.6">'
      + '⚔️ ' + (t('gov_battle_use_fleet')||'PVP는 Fleet 시스템 + Hijack에서 진행됩니다.')
      + '<br><span style="color:var(--tx4);font-size:9px">'
      + (t('gov_battle_use_fleet_hint')||(LANG==='ko'?'함대 탭에서 함선을 건조하고, 영토 탈취는 HIJACK 버튼을 사용하세요.':LANG==='ja'?'艦隊タブで艦船を建造し、領土奪取はHIJACKボタンを使用してください。':LANG==='zh'?'在舰队标签页建造舰船，使用HIJACK按钮夺取领地。':'Build ships in the Fleet tab and use the HIJACK button to capture territory.'))
      + '</span></div>';
  }
  window.loadBattlePanel = loadBattlePanel;

  // Hall of Fame toggle + loader (uses game picker instead of native select)
  var _hofSelectedSectorId = null;
  window.toggleHallOfFame = function() {
    var el = document.getElementById('govHallOfFame');
    var tog = document.getElementById('hofToggle');
    if (!el) return;
    var show = el.style.display === 'none';
    el.style.display = show ? 'block' : 'none';
    if (tog) tog.textContent = show ? '▲' : '▼';
  }
  window.openHofSectorPicker = function(){
    var items = (_sectorsData||[]).map(function(s){return {value:String(s.id),label:s.name}});
    gamePicker({title:tl('HALL OF FAME · SELECT SECTOR','명예의 전당 · 섹터 선택','栄誉の殿堂 · セクター選択','名人堂 · 选择区域'), items:items, selected:_hofSelectedSectorId}).then(function(v){
      if(!v) return;
      _hofSelectedSectorId = v;
      var lbl = document.getElementById('hofSectorLabel');
      var sec = (_sectorsData||[]).find(function(s){return String(s.id)===String(v)});
      if(lbl) lbl.textContent = sec ? sec.name : tl('Sector ','섹터 ','セクター ','区域 ')+v;
      loadHallOfFame();
    });
  };
  window.loadHallOfFame = function() {
    var list = document.getElementById('hofList');
    if (!list) return;
    var sectorId = _hofSelectedSectorId;
    if (!sectorId) { list.innerHTML = '<div style="padding:4px 0">'+tl('Select a sector to view history.','이력을 보려면 섹터를 선택하세요.','履歴を見るにはセクターを選択してください。','请选择区域以查看历史。')+'</div>'; return; }
    list.innerHTML = '<div style="padding:4px 0">'+tl('Loading...','불러오는 중...','読み込み中...','加载中...')+'</div>';
    wlfReadFetch('governance-history:' + sectorId, '/api/governance/history/' + sectorId, 30000, false).then(function(rows){
      if (!rows || !rows.length) { list.innerHTML = '<div style="padding:4px 0">'+tl('No governor history for this sector.','이 섹터의 거버너 이력이 없습니다.','このセクターの知事履歴がありません。','此区域无总督历史。')+'</div>'; return; }
      list.innerHTML = rows.map(function(r) {
        var name = r.nickname || (r.wallet.slice(0,6)+'...'+r.wallet.slice(-4));
        var start = new Date(r.started_at).toLocaleDateString();
        var end = r.ended_at ? new Date(r.ended_at).toLocaleDateString() : tl('Present','현재','現在','至今');
        var tax = parseFloat(r.total_tax_earned || 0);
        var taxStr = tax >= 1000 ? (tax/1000).toFixed(1)+'K' : tax.toFixed(0);
        var dur = r.tenure_seconds ? Math.floor(r.tenure_seconds/3600)+'h' : '-';
        return '<div style="display:flex;justify-content:space-between;align-items:center;padding:4px 0;border-bottom:1px solid var(--bdr)">'
          + '<div><span style="color:var(--gold)">👑</span> <b>'+name+'</b></div>'
          + '<div style="text-align:right;color:var(--tx3);font-size:9px">'+start+' – '+end+'<br>'+taxStr+' GP · '+dur+'</div>'
          + '</div>';
      }).join('');
    }).catch(function(){ list.innerHTML = '<div style="padding:4px 0;color:var(--red)">'+tl('Failed to load history.','이력 로드 실패.','履歴の読み込み失敗。','加载历史失败。')+'</div>'; });
  }

  // ══ PVP HUB — spec 4-2 ════════════════════════════════════════

  var _pvpHubTab = 'rec'; // current active tab
  var _pvpHubSectorFilter = '';

  window.pvpHubSwitchTab = function(tab) {
    _pvpHubTab = tab;
    var tabCfg = {
      rec:      { bg: 'rgba(255,215,0,.08)',  bdr: '#ffd700', col: '#ffd700' },
      bounty:   { bg: 'rgba(255,171,64,.08)', bdr: '#ffab40', col: '#ffab40' },
      conflict: { bg: 'rgba(232,72,85,.08)',  bdr: '#ff8a80', col: '#ff8a80' }
    };
    ['rec','bounty','conflict'].forEach(function(k) {
      var btn = document.getElementById('pvpHubTab_' + k);
      if (!btn) return;
      if (k === tab) {
        btn.style.background = tabCfg[k].bg;
        btn.style.borderBottomColor = tabCfg[k].bdr;
        btn.style.color = tabCfg[k].col;
      } else {
        btn.style.background = 'transparent';
        btn.style.borderBottomColor = 'transparent';
        btn.style.color = 'var(--tx3)';
      }
    });
    _renderPvpHubTab(tab);
  };

  async function _renderPvpHubTab(tab) {
    var content = document.getElementById('pvpHubContent');
    if (!content) return;
    if (tab === 'rec') {
      content.innerHTML = '<div style="color:var(--tx3);font-size:9px;text-align:center;padding:10px">'+(LANG==='ko'?'탐색 중…':LANG==='ja'?'探索中…':LANG==='zh'?'搜索中…':'Searching…')+'</div>';
      await _loadPvpRecTab();
    } else if (tab === 'bounty') {
      content.innerHTML = _pvpHubBountyHtml();
      switchBountyTab('all');
    } else if (tab === 'conflict') {
      content.innerHTML = '<div style="color:var(--tx3);font-size:9px;text-align:center;padding:10px">'+(LANG==='ko'?'로딩 중…':LANG==='ja'?'読込中…':LANG==='zh'?'加载中…':'Loading…')+'</div>';
      await _loadPvpConflictTab();
    }
  }

  async function _loadPvpRecTab() {
    var content = document.getElementById('pvpHubContent');
    var wallet = walletState && walletState.address;
    if (!wallet) {
      if (content && _pvpHubTab === 'rec') content.innerHTML = '<div style="color:var(--tx3);font-size:9px;text-align:center;padding:14px">'+(LANG==='ko'?'지갑을 연결하세요':LANG==='ja'?'ウォレットを接続してください':LANG==='zh'?'请连接钱包':'Connect your wallet')+'</div>';
      return;
    }
    try {
      var recUrl = '/api/battles/recommended-opponents/' + encodeURIComponent(wallet)
        + (_pvpHubSectorFilter ? ('?sector=' + encodeURIComponent(_pvpHubSectorFilter)) : '');
      var data = await wlfReadFetch('pvp-rec:' + wallet + ':' + (_pvpHubSectorFilter || 'all'), recUrl, 15000, false);
      if (!data) {
        if (content && _pvpHubTab === 'rec') content.innerHTML = '<div style="color:var(--tx3);font-size:9px;text-align:center;padding:14px">'+(LANG==='ko'?'잠시 후 다시 시도하세요':LANG==='ja'?'少し待って再試行してください':LANG==='zh'?'请稍后重试':'Please wait a moment and retry')+'</div>';
        return;
      }
      var opponents = data.opponents || [];
      if (!content || _pvpHubTab !== 'rec') return;
      if (opponents.length === 0) {
        content.innerHTML = '<div style="color:var(--tx3);font-size:9px;text-align:center;padding:14px">' + t('pvp_rec_no_opponents') + '</div>';
        return;
      }
      var factionColors = { mcc: '#4fc3f7', fsp: '#66bb6a', cv: '#ff7043' };
      var factionNames  = { mcc: 'MCC',     fsp: 'FSP',     cv: 'CV' };
      var recTitle = _pvpHubSectorFilter
        ? ((LANG==='ko'?'분쟁 섹터 타깃: ':LANG==='ja'?'紛争セクター標的: ':LANG==='zh'?'争端区目标: ':'Conflict targets: ') + escapeHtml(_pvpHubSectorFilter))
        : (LANG==='ko'?'추천 상대 (내 CPI 기준 ±20%)':LANG==='ja'?'推奨対戦相手（自分のCPI ±20%）':LANG==='zh'?'推荐对手（我的CPI ±20%）':'Recommended opponents (±20% of your CPI)');
      content.innerHTML = '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px">'
        + '<div style="font-size:9px;color:var(--tx3)">' + recTitle + '</div>'
        + (_pvpHubSectorFilter ? '<button type="button" onclick="clearPvpSectorFilter()" style="font-size:8px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.12);color:var(--tx3);padding:3px 8px;border-radius:4px;cursor:pointer">'+(LANG==='ko'?'필터 해제':LANG==='ja'?'解除':LANG==='zh'?'清除':'Clear')+'</button>' : '')
        + '</div>'
        + opponents.map(function(o) {
          var col   = factionColors[o.faction_code] || '#aaa';
          var fName = factionNames[o.faction_code]  || (o.faction_code||'').toUpperCase();
          var onlineDot = o.is_online
            ? '<span style="color:#66bb6a;font-size:8px">●'+(LANG==='ko'?'온라인':LANG==='ja'?'オンライン':LANG==='zh'?'在线':'Online')+'</span>'
            : '<span style="color:var(--tx3);font-size:8px">●'+(LANG==='ko'?'오프라인':LANG==='ja'?'オフライン':LANG==='zh'?'离线':'Offline')+'</span>';
          var sectorStr = o.sector_code ? (o.sector_code.split('-')[0] + (LANG==='ko'?' 섹터':LANG==='ja'?' セクター':LANG==='zh'?' 区':' Sector')) : '';
          var agoStr = o.last_battle_ago || (o.wins > 0 ? (LANG==='ko'?'오늘 활동':LANG==='ja'?'本日活動':LANG==='zh'?'今日活动':'Active today') : '');
          var sub = [sectorStr, agoStr].filter(Boolean).join(' · ');
          var displayName = o.fleet_name || (o.wallet.slice(0,6) + '…' + o.wallet.slice(-4));
          var allianceBadge = renderPvpAllianceBadge(o);
          var reasons = o.recommendation_reasons || [];
          var tags = [];
          var bountyGp = Math.max(0, parseInt(o.active_bounty_gp, 10) || 0);
          if (reasons.indexOf('same_sector_pressure') >= 0 || (_pvpHubSectorFilter && o.sector_code === _pvpHubSectorFilter)) tags.push(LANG==='ko'?'섹터 압박':LANG==='ja'?'セクター圧力':LANG==='zh'?'区压制':'Sector pressure');
          if (reasons.indexOf('bounty_target') >= 0 || o.active_bounties > 0) {
            tags.push(bountyGp
              ? ((LANG==='ko'?'현상금 ':LANG==='ja'?'賞金 ':LANG==='zh'?'悬赏 ':'Bounty ') + bountyGp.toLocaleString() + ' GP')
              : ((LANG==='ko'?'현상금 ':LANG==='ja'?'賞金 ':LANG==='zh'?'悬赏 ':'Bounty ') + (o.active_bounties || '')));
          }
          if (reasons.indexOf('active_recently') >= 0) tags.push(LANG==='ko'?'최근 교전':LANG==='ja'?'最近交戦':LANG==='zh'?'近期交战':'Recent combat');
          var tagHtml = tags.length ? '<div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:5px">' + tags.slice(0,3).map(function(tag) {
            return '<span style="font-size:8px;color:#ffab40;border:1px solid rgba(255,171,64,.28);background:rgba(255,171,64,.08);border-radius:3px;padding:1px 5px">' + escapeHtml(tag) + '</span>';
          }).join('') + '</div>' : '';
          return '<div style="padding:9px 10px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);border-radius:6px;margin-bottom:6px">'
            + '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px">'
            + '<div style="flex:1;min-width:0">'
            + '<div style="font-size:10px;color:var(--tx);font-weight:700;font-family:var(--fn);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'
            + escapeHtml(displayName)
            + ' <span style="font-size:8px;color:' + col + ';background:rgba(0,0,0,.3);padding:1px 5px;border-radius:3px;font-weight:400">' + fName + '</span>'
            + allianceBadge
            + '\u00a0' + onlineDot
            + '</div>'
            + '<div style="font-size:9px;color:var(--tx3);margin-top:2px">CPI <b style="color:#ffd700">' + Math.round(o.cpi||0) + '</b>'
            + (sub ? '\u00a0\u00a0' + sub : '')
            + '</div>'
            + tagHtml
            + '</div>'
            + '<button type="button" data-fleet="' + escapeHtml(o.fleet_id) + '" data-name="' + escapeHtml(displayName) + '" data-ships="' + escapeHtml(o.ships_alive || 0) + '" data-sector="' + escapeHtml(o.sector_code || '') + '" data-bounty="' + escapeHtml(o.active_bounty_gp || 0) + '" data-cpi="' + escapeHtml(Math.round(o.cpi || 0)) + '" onclick="openBattleHubWithFleet(this.dataset.fleet,this.dataset.name,this.dataset.ships,this.dataset.sector,this.dataset.bounty,this.dataset.cpi)" style="flex-shrink:0;font-size:9px;background:rgba(232,72,85,.15);border:1px solid rgba(232,72,85,.4);color:#ff8a80;padding:5px 12px;border-radius:4px;cursor:pointer;font-weight:700;font-family:var(--fn);white-space:nowrap">'+(LANG==='ko'?'도전장 보내기':LANG==='ja'?'対戦申込':LANG==='zh'?'发出挑战':'Challenge')+'</button>'
            + '</div>'
            + '</div>';
        }).join('');
    } catch(err) {
      if (content && _pvpHubTab === 'rec') content.innerHTML = '<div style="color:var(--tx3);font-size:9px;text-align:center;padding:14px">' + t('pvp_rec_no_opponents') + '</div>';
    }
  }

  function renderPvpAllianceBadge(o) {
    var tag = o && o.alliance_tag;
    var name = o && o.alliance_name;
    if (!tag && !name) return '';
    var rawColor = String((o && o.alliance_color) || '#80cbc4');
    var color = /^#[0-9a-f]{3,8}$/i.test(rawColor) ? rawColor : '#80cbc4';
    var label = tag ? '[' + escapeHtml(tag) + ']' : escapeHtml(name || tl('Alliance','동맹','同盟','联盟'));
    return ' <span title="' + escapeHtml(name || tag || tl('Alliance','동맹','同盟','联盟')) + '" style="font-size:8px;color:' + color + ';border:1px solid ' + color + '66;background:' + color + '16;border-radius:3px;padding:1px 5px;font-weight:700">🛡 ' + label + '</span>';
  }

  async function _loadPvpConflictTab() {
    var content = document.getElementById('pvpHubContent');
    if (!content) return;
    try {
      var data = await wlfReadFetch('pvp-conflict-map', '/api/sectors/conflict-map', 15000, false);
      if (!data) {
        if (_pvpHubTab === 'conflict') content.innerHTML = '<div style="color:var(--tx3);font-size:9px;text-align:center;padding:14px">'+(LANG==='ko'?'잠시 후 다시 시도하세요':LANG==='ja'?'少し待って再試行してください':LANG==='zh'?'请稍后重试':'Please wait a moment and retry')+'</div>';
        return;
      }
      var sectors = (data.sectors || []).filter(function(s){ return s.heat > 0; })
        .sort(function(a,b){ return b.heat - a.heat; }).slice(0,8);
      if (!content || _pvpHubTab !== 'conflict') return;
      if (sectors.length === 0) {
        content.innerHTML = '<div style="color:var(--tx3);font-size:9px;text-align:center;padding:14px">'+(LANG==='ko'?'활성 분쟁 없음':LANG==='ja'?'活動中の紛争なし':LANG==='zh'?'无活跃争端':'No active conflicts')+'</div>';
        return;
      }
      content.innerHTML = '<div style="font-size:9px;color:var(--tx3);margin-bottom:8px">'+(LANG==='ko'?'섹터별 분쟁 현황 (Heat 기준)':LANG==='ja'?'セクター別紛争状況（Heat順）':LANG==='zh'?'各区争端状况（按Heat排序）':'Conflict by sector (by Heat)')+'</div>'
        + sectors.map(function(s) {
          var heat = Math.min(100, s.heat);
          var heatCol = heat >= 70 ? '#ff5252' : heat >= 40 ? '#ffd700' : '#66bb6a';
          var bountyGp = Math.max(0, parseInt(s.total_bounty_gp, 10) || 0);
          var owners = Math.max(0, parseInt(s.owner_count, 10) || 0);
          return '<div style="padding:7px 10px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);border-radius:6px;margin-bottom:5px">'
            + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:3px">'
            + '<div style="font-size:10px;color:var(--tx);font-weight:700;font-family:var(--fn)">' + escapeHtml(s.sector_code) + '</div>'
            + '<div style="font-size:9px;color:' + heatCol + ';font-weight:700">🔥 Heat ' + heat + '</div>'
            + '</div>'
            + '<div style="display:flex;gap:10px;flex-wrap:wrap;font-size:9px;color:var(--tx3)">'
            + (s.active_battles  ? '<span style="color:#ff8a80">⚔ '+(LANG==='ko'?'전투 ':LANG==='ja'?'戦闘 ':LANG==='zh'?'战斗 ':'Battles ')  + s.active_battles  + '</span>' : '')
            + (s.active_bounties ? '<span style="color:#ffab40">💰 '+(LANG==='ko'?'현상금 ':LANG==='ja'?'賞金 ':LANG==='zh'?'悬赏 ':'Bounties ') + s.active_bounties + '</span>' : '')
            + (bountyGp ? '<span style="color:#ffd54f">+' + bountyGp.toLocaleString() + ' GP</span>' : '')
            + (owners ? '<span>'+(LANG==='ko'?'소유자 ':LANG==='ja'?'所有者 ':LANG==='zh'?'所有者 ':'Owners ') + owners + '</span>' : '')
            + '<span>'+(LANG==='ko'?'클레임 ':LANG==='ja'?'クレーム ':LANG==='zh'?'领地 ':'Claims ') + s.claim_count + '</span>'
            + '</div>'
            + '<button type="button" data-sector="' + escapeHtml(s.sector_code) + '" onclick="huntPvpSector(this.dataset.sector)" style="margin-top:6px;width:100%;font-size:9px;background:rgba(232,72,85,.12);border:1px solid rgba(232,72,85,.32);color:#ff8a80;padding:5px 8px;border-radius:4px;cursor:pointer;font-family:var(--fn);font-weight:700">'
            + (LANG==='ko'?'이 섹터 타깃 찾기':LANG==='ja'?'このセクターの標的':LANG==='zh'?'寻找本区目标':'Find Sector Targets')
            + '</button>'
            + '</div>';
        }).join('');
    } catch(err) {
      if (content && _pvpHubTab === 'conflict') content.innerHTML = '<div style="color:var(--tx3);font-size:9px;text-align:center;padding:14px">'+(LANG==='ko'?'로딩 실패':LANG==='ja'?'読込失敗':LANG==='zh'?'加载失败':'Load failed')+'</div>';
    }
  }

  window.clearPvpSectorFilter = function() {
    _pvpHubSectorFilter = '';
    pvpHubSwitchTab('rec');
  };
  window.huntPvpSector = function(sectorCode) {
    _pvpHubSectorFilter = String(sectorCode || '').trim();
    pvpHubSwitchTab('rec');
  };

  function _pvpHubBountyHtml() {
    return '<div style="padding:8px;border-radius:6px;background:rgba(255,171,64,.05);border:1px solid rgba(255,171,64,.15);margin-bottom:8px">'
      + '<div style="font-size:9px;color:#ffab40;font-weight:700;font-family:var(--fn);letter-spacing:1px;margin-bottom:6px">💰 '+(LANG==='ko'?'현상금 등록':LANG==='ja'?'賞金登録':LANG==='zh'?'悬赏登记':'Bounty Board')+'</div>'
      + '<div style="display:flex;flex-direction:column;gap:5px">'
      + '<input type="text" id="bountyTargetWallet" placeholder="0x..." style="background:var(--surface1);border:1px solid var(--bdr);color:var(--tx);font-size:10px;padding:6px;border-radius:5px;font-family:var(--fn)">'
      + '<div style="display:flex;gap:5px">'
      + '<input type="number" id="bountyRewardGP" min="100" step="100" placeholder="'+(LANG==='ko'?'GP (최소 100)':LANG==='ja'?'GP (最低100)':LANG==='zh'?'GP（最少100）':'GP (min 100)')+'" style="flex:1;background:var(--surface1);border:1px solid var(--bdr);color:var(--tx);font-size:10px;padding:6px;border-radius:5px;font-family:var(--fn)">'
      + '<input type="text" id="bountyReason" placeholder="'+(LANG==='ko'?'사유':LANG==='ja'?'理由':LANG==='zh'?'原因':'Reason')+'" style="flex:1;background:var(--surface1);border:1px solid var(--bdr);color:var(--tx);font-size:10px;padding:6px;border-radius:5px;font-family:var(--fn)">'
      + '</div>'
      + '<button type="button" onclick="postBounty()" style="padding:6px;border-radius:5px;background:rgba(255,171,64,.2);border:1px solid rgba(255,171,64,.4);color:#ffab40;font-family:var(--fn);font-size:9px;font-weight:700;cursor:pointer">'+(LANG==='ko'?'등록':LANG==='ja'?'登録':LANG==='zh'?'登记':'Register')+'</button>'
      + '</div>'
      + '</div>'
      + '<div style="display:flex;gap:4px;margin-bottom:6px">'
      + '<button id="btyTabAll" type="button" onclick="switchBountyTab(\'all\')" style="font-size:8px;padding:3px 8px;border-radius:4px;background:rgba(255,171,64,.18);border:1px solid rgba(255,171,64,.4);color:#ffab40;cursor:pointer;font-weight:700">'+(LANG==='ko'?'전체':LANG==='ja'?'全体':LANG==='zh'?'全部':'All')+'</button>'
      + '<button id="btyTabMe" type="button" onclick="switchBountyTab(\'on-me\')" style="font-size:8px;padding:3px 8px;border-radius:4px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);color:var(--tx3);cursor:pointer">'+(LANG==='ko'?'내 현상금':LANG==='ja'?'懸賞対象':LANG==='zh'?'针对我':'On Me')+'</button>'
      + '<button id="btyTabMine" type="button" onclick="switchBountyTab(\'mine\')" style="font-size:8px;padding:3px 8px;border-radius:4px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);color:var(--tx3);cursor:pointer">'+(LANG==='ko'?'내가 등록':LANG==='ja'?'私の登録':LANG==='zh'?'我的悬赏':'Mine')+'</button>'
      + '</div>'
      + '<div id="bountyList" style="font-size:10px;color:var(--tx3)">'+(LANG==='ko'?'로딩 중…':LANG==='ja'?'読込中…':LANG==='zh'?'加载中…':'Loading…')+'</div>';
  }

  // legacy compat
  window.toggleRecommendedSection = function() { pvpHubSwitchTab('rec'); };
  window.loadRecommendedOpponents = function() { _pvpHubTab = 'rec'; _loadPvpRecTab(); };
  window.openBattleHubWithFleet = function(targetFleetId, targetName, shipsAlive, sectorCode, bountyGp, cpi) {
    if (typeof openDeclareBattleWithFleet === 'function') {
      openDeclareBattleWithFleet(targetFleetId, targetName, shipsAlive, sectorCode, bountyGp, cpi);
      return;
    }
    if (typeof openDeclareBattle === 'function') openDeclareBattle();
  };

  // ══ BOUNTY BOARD ═══════════════════════════════════════════════

  window.toggleBountySection = function() {
    // bountyBoardSection may be inside pvpHubContent now — just switch the hub tab
    if (typeof pvpHubSwitchTab === 'function') { pvpHubSwitchTab('bounty'); return; }
    var el = document.getElementById('bountyBoardSection');
    if (!el) return;
    el.style.display = el.style.display === 'none' ? '' : 'none';
    if (el.style.display !== 'none') loadBountyList('all');
  };

  var _currentBountyTab = 'all';

  window.switchBountyTab = function(tab) {
    _currentBountyTab = tab;
    ['all','on-me','mine'].forEach(function(t2) {
      var btn = document.getElementById('btyTab' + (t2==='all'?'All':t2==='on-me'?'Me':'Mine'));
      if (btn) {
        btn.style.background = t2===tab ? 'rgba(255,171,64,.18)' : 'rgba(255,255,255,.05)';
        btn.style.borderColor = t2===tab ? 'rgba(255,171,64,.4)' : 'rgba(255,255,255,.1)';
        btn.style.color = t2===tab ? '#ffab40' : 'var(--tx3)';
        btn.style.fontWeight = t2===tab ? '700' : '';
      }
    });
    loadBountyList(tab);
  };

  window.loadBountyList = async function(tab) {
    var wallet = walletState && walletState.address;
    var list = document.getElementById('bountyList');
    if (!list) return;
    list.innerHTML = '<span style="color:var(--tx3);font-size:10px">'+tl('Loading…','불러오는 중…','読み込み中…','加载中…')+'</span>';
    try {
      var url = tab === 'on-me' ? '/api/bounty/on-me'
              : tab === 'mine' ? '/api/bounty/my-bounties'
              : '/api/bounty/list';
      var data = await wlfReadFetch('bounty:' + tab, url, 15000, true);
      if (!data) { list.innerHTML = '<div style="color:var(--tx3);font-size:10px;text-align:center;padding:8px">'+tl('Please wait a moment.','잠시만 기다려 주세요.','少々お待ちください。','请稍候。')+'</div>'; return; }
      var bounties = data.bounties || [];
      if (bounties.length === 0) { list.innerHTML = '<div style="color:var(--tx3);font-size:10px;text-align:center;padding:8px">' + t('bounty_no_bounties') + '</div>'; return; }

      list.innerHTML = bounties.map(function(b) {
        var expDate = b.expires_at ? new Date(b.expires_at).toLocaleDateString() : '';
        var isMine = tab === 'mine';
        return '<div style="padding:8px;background:rgba(255,171,64,.04);border:1px solid rgba(255,171,64,.15);border-radius:6px;margin-bottom:4px">'
          + '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:4px">'
          + '<div>'
          + '<div style="font-size:10px;color:var(--tx)">🎯 ' + (b.target_wallet || '').slice(0,8) + '…</div>'
          + (b.reason ? '<div style="font-size:9px;color:var(--tx3)">' + escapeHtml(b.reason) + '</div>' : '')
          + '</div>'
          + '<div style="text-align:right"><div style="font-size:12px;color:#ffab40;font-weight:700">+' + (b.reward_gp||0).toLocaleString() + ' GP</div>'
          + (expDate ? '<div style="font-size:8px;color:var(--tx3)">' + t('bounty_expires') + ': ' + expDate + '</div>' : '')
          + '</div></div>'
          + (isMine && b.status==='active' ? '<button onclick="cancelBounty(' + b.id + ')" style="font-size:8px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);color:var(--tx3);padding:2px 8px;border-radius:4px;cursor:pointer">' + t('bounty_cancel') + '</button>' : '')
          + '</div>';
      }).join('');

      // On Me — show total
      if (tab === 'on-me' && data.total_on_me > 0) {
        list.innerHTML = '<div style="padding:6px 8px;background:rgba(232,72,85,.08);border:1px solid rgba(232,72,85,.2);border-radius:6px;margin-bottom:8px;font-size:10px;color:#ff8a80">' + t('bounty_on_me') + ': <b>' + data.total_on_me.toLocaleString() + ' GP</b></div>' + list.innerHTML;
      }
    } catch(err) { list.innerHTML = '<div style="color:var(--tx3);font-size:10px">'+tl('Failed to load bounties','현상금 로드 실패','賞金の読み込み失敗','加载悬赏失败')+'</div>'; }
  };

  window.postBounty = async function() {
    var wallet = walletState && walletState.address;
    if (!wallet) { showToast(t('connect_wallet_first')||'Connect wallet', 'error'); return; }
    var target = (document.getElementById('bountyTargetWallet') || {}).value || '';
    var gp = parseInt((document.getElementById('bountyRewardGP') || {}).value) || 0;
    var reason = (document.getElementById('bountyReason') || {}).value || '';
    if (!target) { showToast(tl('Enter target wallet','대상 지갑을 입력하세요','対象ウォレットを入力','请输入目标钱包'), 'error'); return; }
    if (gp < 100) { showToast(tl('Minimum 100 GP','최소 100 GP','最低100 GP','最低100 GP'), 'error'); return; }

    var ok = await gameConfirm({ icon:'💰', title:t('bounty_post'),
      body: '🎯 '+tl('Target: ','대상: ','対象: ','目标: ') + target.slice(0,10) + '…<br>💰 '+tl('Reward: ','보상: ','報酬: ','奖励: ')+'<b>' + gp + ' GP</b>',
      confirmText: t('bounty_post_submit') });
    if (!ok) return;

    try {
      var res = await fetch('/api/bounty/post', {
        method: 'POST',
        headers: Object.assign({ 'Content-Type': 'application/json' }, getAuthHeaders()),
        body: JSON.stringify({ wallet: wallet, target_wallet: target, reward_gp: gp, reason: reason })
      });
      var data = await res.json();
      if (!data.success) { showToast(data.error || tl('Failed','실패','失敗','失败'), 'error'); return; }
      showToast('💰 '+tl('Bounty posted!','현상금 등록 완료!','賞金を登録しました！','悬赏已登记！'), 'success');
      document.getElementById('bountyTargetWallet').value = '';
      document.getElementById('bountyRewardGP').value = '';
      document.getElementById('bountyReason').value = '';
      loadBountyList('all');
      if (typeof loadUserData === 'function') loadUserData();
    } catch(e) { showToast(tl('Failed','실패','失敗','失败'), 'error'); }
  };

  window.cancelBounty = async function(id) {
    var wallet = walletState && walletState.address;
    if (!wallet) return;
    var ok = await gameConfirm({ icon:'💰', title:t('bounty_cancel'), confirmText:tl('Cancel & Refund','취소 및 환불','キャンセルと返金','取消并退款') });
    if (!ok) return;
    try {
      var res = await fetch('/api/bounty/cancel/' + id, {
        method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json' }, getAuthHeaders()),
        body: JSON.stringify({ wallet: wallet })
      });
      var data = await res.json();
      if (!data.success) { showToast(data.error || tl('Failed','실패','失敗','失败'), 'error'); return; }
      showToast('+' + data.refunded_gp + tl(' GP refunded',' GP 환불됨',' GP 返金',' GP 已退款'), 'success');
      loadBountyList('mine');
      if (typeof loadUserData === 'function') loadUserData();
    } catch(e) { showToast(tl('Failed','실패','失敗','失败'), 'error'); }
  };

  // Governance UI state
  var _govState = null;
  var _govMyPositions = [];
  var _govMySectorId = null; // currently selected governed sector
  var _govMySectorIds = []; // all sectors I govern

  function _updateGovernanceUI(gov) {
    _govState = gov;
    // Show active event banner on map if any
    if(gov && gov.activeGovEvents && gov.activeGovEvents.length > 0) {
      var evNames = gov.activeGovEvents.map(function(e){
        var icons = {double_mining:'⛏ '+tl('DOUBLE MINING','채굴 2배','採掘2倍','双倍采矿'),war_time:'⚔ '+tl('WAR TIME','전시','戦時','战时'),peace_treaty:'🕊 '+tl('PEACE','평화','平和','和平')};
        return icons[e.type]||e.type;
      });
      showAnnounce(tl('EVENT ACTIVE: ','이벤트 진행 중: ','イベント発生中: ','活动进行中: ') + evNames.join(' | '));
    }
  }

  // ── Load governance data for GOVERN tab ──
  // [Phase 3] 맹주 공성 선언 — 맹주(sov1위) vs 도전(sov2위) 결전 이벤트 시작
  window.declareCommanderSiegeUI = function(){
    if(!walletState.address){ if(typeof showToast==='function') showToast(tl("Connect wallet","지갑 연결 필요","ウォレット接続","需要连接钱包"),'warn'); return; }
    fetch('/api/siege/commander/declare', { method:'POST', headers: Object.assign({'Content-Type':'application/json'}, getAuthHeaders()) })
      .then(function(r){ return r.json().then(function(j){ return {ok:r.ok, j:j}; }); })
      .then(function(res){
        if(!res.ok || !res.j.success){
          var m={ commander_siege_disabled:tl("Commander siege disabled","맹주 공성 비활성","無効","已禁用"), commander_siege_active:tl("Already in progress","이미 진행 중","進行中","进行中"), no_challenger:tl("No challenger","도전자 없음","挑戦者なし","无挑战者"), challenger_below_min:tl("Challenger lacks sectors","도전자 섹터 부족","セクター不足","区域不足") };
          if(typeof showToast==='function') showToast(m[res.j.error]||('맹주 공성 실패: '+(res.j.error||'')),'warn'); return;
        }
        if(typeof showToast==='function') showToast(tl("⚔ Commander Siege declared!","⚔ 맹주 공성 선언! 양측 길드원 함대 합류","⚔ 攻城戦宣言","⚔ 攻城宣言"),'success');
        if(typeof openSovMap==='function') openSovMap();
      }).catch(function(){ if(typeof showToast==='function') showToast(tl("Network error","네트워크 오류","ネットワークエラー","网络错误"),'warn'); });
  };

  // [Phase 3] SOV MAP — 24섹터 길드 지배 현황 모달 (읽기 전용 표시)
  window.openSovMap = function(){
    var ex = document.getElementById('sovMapModal'); if(ex) ex.remove();
    var ov = document.createElement('div');
    ov.id = 'sovMapModal';
    ov.style.cssText = 'position:fixed;inset:0;z-index:100000;background:rgba(4,6,12,.92);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;padding:16px';
    ov.innerHTML = '<div style="background:linear-gradient(180deg,#12131a,#0b0c12);border:1px solid rgba(255,109,0,.3);border-radius:14px;max-width:680px;width:100%;max-height:88vh;overflow:auto;padding:18px">'
      + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px"><span style="font-size:14px;font-weight:900;color:#ffb74d;font-family:var(--fn)">🗺 '+tl("SOV MAP — Mars Control","🗺 SOV MAP — 화성 지배 현황","SOV MAP — 火星支配","SOV MAP — 火星支配")+'</span><button type="button" id="sovMapClose" style="background:none;border:none;color:var(--tx3);font-size:18px;cursor:pointer">✕</button></div>'
      + '<div id="sovMapBody" style="font-size:11px;color:var(--tx3)">'+tl("Loading…","불러오는 중…","読み込み中…","加载中…")+'</div></div>';
    document.body.appendChild(ov);
    ov.addEventListener('click', function(e){ if(e.target===ov) ov.remove(); });
    var cb = document.getElementById('sovMapClose'); if(cb) cb.addEventListener('click', function(){ ov.remove(); });
    Promise.all([
      _guardedJsonFetch('sector-defs-sov-map-modal', '/api/sector-defs/sov-map', {minGap:10000, backoffMs:120000}).then(function(d){ return d || {sectors:[], leaderboard:[]}; }),
      _guardedJsonFetch('siege-schedule-sov-modal', '/api/siege/schedule?count=3', {minGap:30000, backoffMs:120000}).then(function(d){ return d || null; })
    ]).then(function(res){
      var d = res[0]; var sched = res[1];
      var body = document.getElementById('sovMapBody'); if(!body) return;
      var L = function(s){ return (LANG==='ko'?s.name_ko:LANG==='ja'?s.name_ja:LANG==='zh'?s.name_zh:s.name_en)||s.name_en||s.code; };
      var tierCol = { core:'var(--gold)', mid:'var(--cyan)', frontier:'var(--tx3)' };
      var h = '';
      // [Phase 3] 화성 맹주(Commander) — sov 지배 1위 길드
      if(d.commander){
        h += '<div style="text-align:center;padding:10px;margin-bottom:10px;border-radius:10px;background:linear-gradient(135deg,rgba(255,209,102,.18),rgba(255,109,0,.06));border:1px solid rgba(255,209,102,.5)">'
          + '<div style="font-size:9px;color:#ffb74d;letter-spacing:2px;font-weight:700">👑 '+tl("MARS COMMANDER","화성 맹주","火星総督","火星统帅")+'</div>'
          + '<div style="font-size:13px;color:var(--gold);font-weight:900;margin-top:3px">'+(d.commander.emblem||"🔴")+' ['+escapeHtml(d.commander.tag||"")+'] '+escapeHtml(d.commander.name||"")+'</div>'
          + '<div style="font-size:9px;color:var(--tx3);margin-top:2px">'+d.commander.sectors+' '+tl("sectors","섹터","セクター","区域")+' · core '+d.commander.core+'</div></div>';
      }
      var ps = d.pressureSummary || {};
      h += '<div style="margin-bottom:8px;color:var(--tx2)">'+tl("Held","점령","占領","占领")+' '+d.claimed+' / '+d.total+' · '+tl("Vacant","무주공산","空白","空白")+' '+d.vacant+'</div>';
      h += '<div style="display:flex;flex-wrap:wrap;gap:5px;margin-bottom:10px">'
        + '<span style="font-size:9px;color:#ff8a80;background:rgba(232,72,85,.08);border:1px solid rgba(232,72,85,.25);border-radius:10px;padding:3px 8px">⚔ '+(ps.activeBattles||0)+'</span>'
        + '<span style="font-size:9px;color:#ffd166;background:rgba(255,209,102,.08);border:1px solid rgba(255,209,102,.25);border-radius:10px;padding:3px 8px">🎯 '+(ps.activeBounties||0)+' · '+Math.round(ps.bountyGp||0)+' GP</span>'
        + '<span style="font-size:9px;color:var(--cyan);background:rgba(64,196,255,.08);border:1px solid rgba(64,196,255,.25);border-radius:10px;padding:3px 8px">'+tl("Hot sectors","압력 섹터","高圧セクター","热点区域")+' '+(ps.hotSectors||0)+'</span>'
        + '</div>';
      // [Phase 3] 맹주 공성 선언 (sov1위 vs sov2위 결전)
      h += '<button type="button" onclick="declareCommanderSiegeUI()" style="width:100%;padding:8px;margin-bottom:12px;border-radius:8px;background:linear-gradient(135deg,rgba(232,72,85,.16),rgba(255,109,0,.05));border:1px solid rgba(232,72,85,.4);color:#ff8a80;font-family:var(--fn);font-size:10px;font-weight:800;cursor:pointer">👑 '+tl("DECLARE COMMANDER SIEGE","맹주 공성 선언","攻城戦宣言","宣战统帅")+'</button>';
      // [Phase 3] 다가오는 공성 결전 일정
      if(sched && sched.enabled && sched.next_slots && sched.next_slots.length){
        h += '<div style="font-size:10px;color:#ff8a80;font-weight:700;margin-bottom:4px">⚔ '+tl("Next Siege Windows","다음 공성 결전","次の攻城戦","下次攻城")+'</div><div style="margin-bottom:10px">';
        sched.next_slots.forEach(function(iso){ try{ var dt=new Date(iso); h += '<span style="display:inline-block;font-size:9px;color:var(--tx2);background:rgba(232,72,85,.08);border:1px solid rgba(232,72,85,.25);border-radius:10px;padding:2px 8px;margin:0 4px 4px 0">'+dt.toLocaleString(LANG==='ko'?'ko-KR':undefined,{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})+'</span>'; }catch(_){} });
        h += '</div>';
      }
      if(d.leaderboard && d.leaderboard.length){
        h += '<div style="font-size:10px;color:#ffb74d;font-weight:700;margin-bottom:6px">🏛 '+tl("Ruling Guilds","지배 길드","支配ギルド","支配公会")+'</div>';
        d.leaderboard.slice(0,8).forEach(function(g,i){
          h += '<div style="display:flex;justify-content:space-between;padding:5px 8px;background:rgba(255,209,102,.05);border-radius:6px;margin-bottom:3px"><span style="font-size:10px;color:var(--tx)">'+(i+1)+'. '+(g.emblem||"🔴")+' ['+escapeHtml(g.tag||"")+'] '+escapeHtml(g.name||"")+'</span><span style="font-size:10px;color:var(--gold)">'+g.count+' · C'+(g.core||0)+'/M'+(g.mid||0)+'/F'+(g.frontier||0)+'</span></div>';
        });
      }
      ['core','mid','frontier'].forEach(function(tier){
        var secs = (d.sectors||[]).filter(function(s){ return s.tier===tier; });
        if(!secs.length) return;
        h += '<div style="font-size:10px;color:'+tierCol[tier]+';font-weight:700;margin:10px 0 5px;text-transform:uppercase">'+tier+' ('+secs.length+')</div>';
        h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:5px">';
        secs.forEach(function(s){
          var gov = s.governorGuild ? ((s.governorGuild.emblem||"🔴")+' ['+escapeHtml(s.governorGuild.tag||"")+']')
            : (s.governor ? ('👤 '+escapeHtml(s.governor.nickname||"")) : ('<span style="color:var(--tx3)">'+tl("Vacant","무주공산","空白","空白")+'</span>'));
          var pressureColor = s.pressureLevel === 'warzone' ? '#ff5c6c' : (s.pressureLevel === 'contested' ? '#ffb74d' : (s.pressureLevel === 'active' ? 'var(--cyan)' : 'var(--tx3)'));
          h += '<div style="padding:6px 8px;background:rgba(255,255,255,.03);border-radius:6px;border-left:3px solid '+tierCol[tier]+'"><div style="font-size:10px;color:var(--tx);font-weight:600">'+escapeHtml(L(s))+'</div><div style="font-size:9px;color:var(--tx2);margin-top:2px">'+gov+'</div><div style="font-size:8px;color:var(--gold);margin-top:3px">'+escapeHtml(_sectorEconomyLine(s))+'</div><div style="font-size:8px;color:'+pressureColor+';margin-top:3px">'+escapeHtml(_sectorPressureLine(s))+'</div></div>';
        });
        h += '</div>';
      });
      body.innerHTML = h;
    }).catch(function(){ var b=document.getElementById('sovMapBody'); if(b) b.innerHTML='<div style="color:var(--red)">'+tl("Load failed","불러오기 실패","読み込み失敗","加载失败")+'</div>'; });
  };

  window.loadGovernanceData = function(){
    var w = walletState.address;
    if(!w) {
      document.getElementById('govMyPositions').innerHTML='<div style="font-size:10px;color:var(--tx3);padding:8px 0">'+tl('Connect wallet to view governance.','거버넌스를 보려면 지갑을 연결하세요.','ガバナンスを見るにはウォレットを接続してください。','请连接钱包以查看治理。')+'</div>';
      return;
    }

    // Fetch all in parallel
    Promise.all([
      wlfReadFetch('gov-my-positions:' + w, '/api/governance/my-positions/'+encodeURIComponent(w), 15000, false).catch(function(){return []}),
      wlfReadFetch('gov-commander', '/api/governance/commander', 15000, true).catch(function(){return {}}),
      wlfReadFetch('gov-events', '/api/governance/events', 15000, false).catch(function(){return []}),
      wlfReadFetch('gov-bounties', '/api/governance/bounties', 15000, false).catch(function(){return []})
    ]).then(function(results){
      var positions = results[0];
      var cmdInfo = results[1];
      var events = results[2];
      var bounties = results[3];

      _govMyPositions = Array.isArray(positions) ? positions : [];
      _govMySectorIds = [];
      _govMySectorId = null;

      // ── MY POSITIONS ──
      var posEl = document.getElementById('govMyPositions');
      if(_govMyPositions.length === 0){
        posEl.innerHTML='<div style="font-size:10px;color:var(--tx3);padding:8px 0">'+tl('No governance positions. Claim more territory to become Governor!','거버넌스 직책이 없습니다. 영토를 더 확보해 거버너가 되세요!','ガバナンス役職がありません。領土を増やして知事になりましょう！','暂无治理职位。占领更多领地以成为总督！')+'</div>';
      } else {
        var html = '';
        _govMyPositions.forEach(function(p){
          var roleColor = p.role==='commander'?'var(--gold)':p.role==='governor'?'var(--cyan)':'var(--tx2)';
          var label = p.role.toUpperCase() + (p.sector_id?' · '+tl('Sector ','섹터 ','セクター ','区域 ')+p.sector_id:'');
          html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 8px;background:rgba(91,184,232,.04);border-radius:6px;margin-bottom:4px;border:1px solid '+roleColor+'22">';
          html += '<span style="font-size:10px;color:'+roleColor+';font-family:var(--fn);font-weight:700">'+label+' '+govBadgeHTML(p.wallet)+'</span>';
          html += '<span style="font-size:10px;color:var(--cyan);font-family:var(--fn)">'+parseFloat(p.gp_balance||0).toFixed(0)+' GP</span>';
          html += '</div>';
          if(p.role==='governor' && p.sector_id) _govMySectorIds.push(p.sector_id);
        });
        posEl.innerHTML = html;

        // GP is now managed by updateGPDisplay() from /api/auth/me
      }

      // ── COMMANDER / GOVERNOR DASHBOARDS ──
      var isCommander = _govMyPositions.some(function(p){return p.role==='commander'});
      var isGovernor = _govMyPositions.some(function(p){return p.role==='governor'});
      document.getElementById('govCommanderDash').style.display = isCommander?'':'none';
      document.getElementById('govGovernorDash').style.display = isGovernor?'':'none';
      if(isGovernor && _govMySectorIds.length){
        // Set initial selected sector (keep previous if still valid)
        if(!_govMySectorId || _govMySectorIds.indexOf(_govMySectorId)===-1) _govMySectorId = _govMySectorIds[0];
        // Update picker button label (replaces native dropdown)
        var pickerBtn = document.getElementById('govSectorPickerBtn');
        if(pickerBtn){
          var curSec = (_sectorsData||[]).find(function(s){return s.id===_govMySectorId});
          pickerBtn.textContent = (curSec ? curSec.name : tl('Sector ','섹터 ','セクター ','区域 ')+_govMySectorId) + ' ▾';
        }
        // Pre-fill sector announcement & tax rate
        var mySector = _sectorsData && _sectorsData.find(function(s){return s.id===_govMySectorId});
        if(mySector){
          var saInput = document.getElementById('govSectorAnnounce');
          if(saInput && !saInput.value) saInput.value = mySector.announcement || '';
          var taxSlider = document.getElementById('govTaxSlider');
          var taxVal = document.getElementById('govTaxVal');
          if(taxSlider && mySector.taxRate){
            taxSlider.value = mySector.taxRate;
            if(taxVal) taxVal.textContent = mySector.taxRate+'%';
          }
        }
      }

      // Pre-fill commander announcement
      if(isCommander && cmdInfo && cmdInfo.announcement){
        var caInput = document.getElementById('govCmdAnnounce');
        if(caInput && !caInput.value) caInput.value = cmdInfo.announcement;
      }

      // ── COMMANDER INFO ──
      var cmdEl = document.getElementById('govCommanderInfo');
      if(cmdInfo && cmdInfo.commander){
        var chtml = '<div style="display:flex;flex-direction:column;gap:4px">';
        var cmdName = cmdInfo.commanderNickname || shortAddr(cmdInfo.commander);
        chtml += '<div style="display:flex;justify-content:space-between"><span style="font-size:9px;color:var(--tx3)">'+tl('COMMANDER','맹주','総督','统帅')+'</span><span style="font-size:10px;color:var(--gold);font-family:var(--fn)" title="'+(cmdInfo.commander||'')+'">'+cmdName+'</span></div>';
        if(cmdInfo.vice){
          var viceName = cmdInfo.viceNickname || shortAddr(cmdInfo.vice);
          chtml += '<div style="display:flex;justify-content:space-between"><span style="font-size:9px;color:var(--tx3)">'+tl('VICE','부맹주','副総督','副统帅')+'</span><span style="font-size:10px;color:var(--tx2);font-family:var(--fn)" title="'+(cmdInfo.vice||'')+'">'+viceName+'</span></div>';
        }
        if(cmdInfo.commanderGP!=null) chtml += '<div style="display:flex;justify-content:space-between"><span style="font-size:9px;color:var(--tx3)">'+tl('GP BALANCE','GP 잔액','GP残高','GP余额')+'</span><span style="font-size:10px;color:var(--cyan);font-family:var(--fn)">'+parseFloat(cmdInfo.commanderGP).toFixed(0)+'</span></div>';
        if(cmdInfo.poolGP!=null) chtml += '<div style="display:flex;justify-content:space-between"><span style="font-size:9px;color:var(--tx3)">'+tl('POOL','풀','プール','奖池')+'</span><span style="font-size:10px;color:var(--gn);font-family:var(--fn)">'+parseFloat(cmdInfo.poolGP).toFixed(0)+' GP</span></div>';
        if(cmdInfo.announcement) chtml += '<div style="margin-top:4px;padding:6px 8px;background:rgba(255,209,102,.06);border-radius:4px;font-size:10px;color:var(--gold)">📢 '+cmdInfo.announcement+'</div>';
        chtml += '</div>';
        cmdEl.innerHTML = chtml;
      } else {
        cmdEl.innerHTML = '<div style="font-size:10px;color:var(--tx3);padding:8px 0">'+tl('No Commander elected yet.','아직 맹주가 선출되지 않았습니다.','まだ総督が選出されていません。','尚未选出统帅。')+'</div>';
      }

      // ── ACTIVE EVENTS ──
      var evSection = document.getElementById('govActiveEvents');
      var evList = document.getElementById('govEventsList');
      if(events && events.length > 0){
        evSection.style.display = '';
        var ehtml = '';
        events.forEach(function(ev){
          var icons = {double_mining:'⛏',war_time:'⚔',peace_treaty:'🕊'};
          var colors = {double_mining:'var(--gn)',war_time:'var(--red)',peace_treaty:'var(--cyan)'};
          var names = {double_mining:tl('DOUBLE MINING','채굴 2배','採掘2倍','双倍采矿'),war_time:tl('WAR TIME','전시','戦時','战时'),peace_treaty:tl('PEACE TREATY','평화 협정','平和条約','和平条约')};
          var icon = icons[ev.event_type]||'📌';
          var color = colors[ev.event_type]||'var(--tx)';
          var name = names[ev.event_type]||ev.event_type;
          var endsAt = new Date(ev.ends_at);
          var remaining = Math.max(0, Math.ceil((endsAt - Date.now())/(60*1000)));
          var timeStr = remaining > 60 ? Math.floor(remaining/60)+'h '+remaining%60+'m' : remaining+'m';
          ehtml += '<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 8px;background:'+color+'08;border-radius:6px;border:1px solid '+color+'22">';
          ehtml += '<span style="font-size:10px;color:'+color+';font-family:var(--fn)">'+icon+' '+name+'</span>';
          ehtml += '<span style="font-size:9px;color:var(--tx3)">'+timeStr+tl(' left',' 남음',' 残り',' 剩余')+'</span>';
          ehtml += '</div>';
        });
        evList.innerHTML = ehtml;
      } else {
        evSection.style.display = 'none';
      }

      // ── BOUNTY BOARD ──
      var bList = document.getElementById('govBountyList');
      if(bounties && bounties.length > 0){
        var bhtml = '';
        bounties.forEach(function(b){
          var exp = new Date(b.expires_at);
          var daysLeft = Math.max(0, Math.ceil((exp - Date.now())/(24*60*60*1000)));
          bhtml += '<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 8px;background:rgba(232,72,85,.04);border-radius:6px;margin-bottom:4px;border:1px solid rgba(232,72,85,.15)">';
          bhtml += '<div style="display:flex;flex-direction:column;gap:2px">';
          var bName = b.target_nickname || shortAddr(b.target_wallet);
          bhtml += '<span style="font-size:10px;color:var(--red);font-family:var(--fn)" title="'+(b.target_wallet||'')+'">🎯 '+bName+'</span>';
          if(b.reason) bhtml += '<span style="font-size:8px;color:var(--tx3)">'+b.reason+'</span>';
          bhtml += '</div>';
          bhtml += '<div style="display:flex;flex-direction:column;align-items:flex-end;gap:2px">';
          bhtml += '<span style="font-size:10px;color:var(--gold);font-family:var(--fn)">'+parseFloat(b.gp_reward||b.pp_reward||0).toFixed(0)+' GP</span>';
          bhtml += '<span style="font-size:8px;color:var(--tx3)">'+daysLeft+tl('d left','일 남음','日 残り','天剩余')+'</span>';
          bhtml += '</div>';
          bhtml += '</div>';
        });
        bList.innerHTML = bhtml;
      } else {
        bList.innerHTML = '<div style="font-size:10px;color:var(--tx3);padding:8px 0">'+tl('No active bounties.','활성 현상금이 없습니다.','アクティブな賞金がありません。','无活跃悬赏。')+'</div>';
      }

    }).catch(function(err){
      console.warn('[GOV] loadGovernanceData error:', err);
    });
  };

  // ── Governance Action Costs (defaults; server is authoritative) ──
  // Commander pays from commander position GP pool; governor pays from
  // governor position GP pool (per sector). User's personal GP is NOT used.
  var GOV_EVENT_COSTS = { double_mining: 300, war_time: 300, peace_treaty: 300 };
  var GOV_EVENT_HOURS = { double_mining: 1, war_time: 1, peace_treaty: 1 };
  var GOV_BUFF_COSTS  = { mining_boost: 100, defense_bonus: 100, claim_discount: 100 };
  var GOV_BUFF_HOURS  = { mining_boost: 24, defense_bonus: 24, claim_discount: 24 };
  var GOV_EVENT_LABELS = { double_mining: '⛏ '+tl('DOUBLE MINING','채굴 2배','採掘2倍','双倍采矿'), war_time: '⚔ '+tl('WAR TIME','전시','戦時','战时'), peace_treaty: '🕊 '+tl('PEACE TREATY','평화 협정','平和条約','和平条约') };
  var GOV_BUFF_LABELS  = { mining_boost: '⛏ '+tl('MINING +20%','채굴 +20%','採掘 +20%','采矿 +20%'), defense_bonus: '🛡 '+tl('DEFENSE +10%','방어 +10%','防御 +10%','防御 +10%'), claim_discount: '💰 '+tl('CLAIM -10%','클레임 -10%','クレーム -10%','领地 -10%') };

  function _getCommanderGP(){
    // Look up commander position in _govMyPositions
    var p = (_govMyPositions||[]).find(function(pp){return pp.role==='commander'});
    return p ? parseFloat(p.gp_balance||0) : 0;
  }
  function _getGovernorGP(sectorId){
    var p = (_govMyPositions||[]).find(function(pp){return pp.role==='governor' && pp.sector_id===sectorId});
    return p ? parseFloat(p.gp_balance||0) : 0;
  }

  // ── Governance Actions ──
  window.govTriggerEvent = function(eventType){
    var w = walletState.address;
    if(!w){showToast(tl('Connect wallet first','지갑을 먼저 연결하세요','先にウォレットを接続してください','请先连接钱包'));return}
    var cost = GOV_EVENT_COSTS[eventType] || 300;
    var hours = GOV_EVENT_HOURS[eventType] || 1;
    var label = GOV_EVENT_LABELS[eventType] || eventType;
    var cmdGP = _getCommanderGP();
    var insufficient = cmdGP < cost;
    gameConfirm({
      title: tl('TRIGGER GLOBAL EVENT','글로벌 이벤트 발동','グローバルイベント発動','触发全球活动'),
      icon: '📡',
      body: tl('Activate <b style="color:var(--mars)">','<b style="color:var(--mars)">','<b style="color:var(--mars)">','激活 <b style="color:var(--mars)">')+label+tl('</b> for the entire planet?<br>Duration: <b>','</b> 이벤트를 행성 전역에 발동하시겠습니까?<br>지속 시간: <b>','</b> を惑星全体に発動しますか？<br>持続時間: <b>','</b>（覆盖整个行星）？<br>持续时间: <b>')+hours+tl('h</b> · Daily limit: <b>1/day</b>','시간</b> · 일일 한도: <b>1/일</b>','時間</b> · 1日制限: <b>1/日</b>','小时</b> · 每日限制: <b>1/天</b>'),
      info: [
        { k:tl('COST','비용','コスト','费用'), v: cost+' GP' },
        { k:tl('COMMANDER GP','맹주 GP','総督GP','统帅GP'), v: cmdGP.toFixed(0), insufficient: insufficient, ok: !insufficient },
        { k:tl('AFTER','이후','後','之后'), v: (cmdGP - cost).toFixed(0)+' GP', insufficient: insufficient }
      ],
      confirmText: insufficient ? tl('INSUFFICIENT GP','GP 부족','GP不足','GP不足') : tl('LAUNCH EVENT','이벤트 발동','イベント発動','发动活动'),
      disabled: insufficient
    }).then(function(ok){
      if(!ok) return;
      fetch('/api/governance/commander/event',{
        method:'POST',
        headers:Object.assign({'Content-Type':'application/json'},getAuthHeaders()),
        body:JSON.stringify({wallet:w,eventType:eventType})
      }).then(function(r){return r.json()}).then(function(d){
        if(d.error){showToast(d.error);return}
        showToast(tl('Event triggered: ','이벤트 발동: ','イベント発動: ','活动已触发: ')+label+' ('+d.hours+'h · -'+d.gpSpent+' GP)');
        loadGovernanceData();
      }).catch(function(){showToast(tl('Failed to trigger event','이벤트 발동 실패','イベント発動失敗','触发活动失败'))});
    });
  };

  window.govTriggerRocket = function(){
    var w = walletState.address;
    if(!w){showToast(tl('Connect wallet first','지갑을 먼저 연결하세요','先にウォレットを接続してください','请先连接钱包'));return}
    var cmdGP = _getCommanderGP();
    gameConfirm({
      title:tl('LAUNCH SUPPLY DROP','보급 투하 발사','補給投下を発射','发射补给投放'),
      icon:'🚀',
      body:tl('Schedule a rocket supply drop across Mars? Players will receive rewards at the landing zone.','화성 전역에 로켓 보급 투하를 예약하시겠습니까? 플레이어는 착륙 지점에서 보상을 받습니다.','火星全土にロケット補給投下を予約しますか？プレイヤーは着地地点で報酬を受け取ります。','在火星全境安排火箭补给投放？玩家将在着陆区获得奖励。'),
      info:[
        { k:tl('COMMANDER GP','맹주 GP','総督GP','统帅GP'), v: cmdGP.toFixed(0), ok:true }
      ],
      confirmText:tl('LAUNCH ROCKET','로켓 발사','ロケット発射','发射火箭')
    }).then(function(ok){
      if(!ok) return;
      fetch('/api/rockets/trigger',{
        method:'POST',
        headers:Object.assign({'Content-Type':'application/json'},getAuthHeaders()),
        body:JSON.stringify({wallet:w})
      }).then(function(r){return r.json()}).then(function(d){
        if(d.error){showToast(d.error);return}
        showToast('🚀 '+tl('Rocket supply drop scheduled!','로켓 보급 투하 예약 완료!','ロケット補給投下を予約しました！','火箭补给投放已安排！'));
      }).catch(function(){showToast(tl('Failed to trigger rocket','로켓 발사 실패','ロケット発射失敗','发射火箭失败'))});
    });
  };

  window.govSetCmdAnnouncement = function(){
    var w = walletState.address;
    if(!w){showToast(tl('Connect wallet first','지갑을 먼저 연결하세요','先にウォレットを接続してください','请先连接钱包'));return}
    var text = document.getElementById('govCmdAnnounce').value.trim();
    fetch('/api/governance/commander/announcement',{
      method:'POST',
      headers:Object.assign({'Content-Type':'application/json'},getAuthHeaders()),
      body:JSON.stringify({wallet:w,text:text})
    }).then(function(r){return r.json()}).then(function(d){
      if(d.error){showToast(d.error);return}
      showToast(tl('Announcement updated','공지가 업데이트되었습니다','お知らせを更新しました','公告已更新'));
      loadGovernanceData();
    }).catch(function(){showToast(tl('Failed to set announcement','공지 설정 실패','お知らせ設定失敗','设置公告失败'))});
  };

  window.govPlaceBounty = function(){
    var w = walletState.address;
    if(!w){showToast(tl('Connect wallet first','지갑을 먼저 연결하세요','先にウォレットを接続してください','请先连接钱包'));return}
    var target = document.getElementById('govBountyTarget').value.trim();
    var amount = parseFloat(document.getElementById('govBountyAmount').value);
    if(!target||!amount||amount<=0){showToast(tl('Enter target nickname and GP amount','대상 닉네임과 GP 금액을 입력하세요','対象ニックネームとGP額を入力してください','请输入目标昵称和GP数量'));return}
    fetch('/api/governance/commander/bounty',{
      method:'POST',
      headers:Object.assign({'Content-Type':'application/json'},getAuthHeaders()),
      body:JSON.stringify({wallet:w,targetNickname:target,gpAmount:amount})
    }).then(function(r){return r.json()}).then(function(d){
      if(d.error){showToast(srvErr?srvErr(d.error):d.error,'error');return}
      showToast(tl('Bounty placed: ','현상금 등록: ','賞金設定: ','悬赏已设: ')+(d.gpReward!=null?d.gpReward:d.ppReward||0)+tl(' GP reward',' GP 보상',' GP 報酬',' GP 奖励'));
      document.getElementById('govBountyTarget').value='';
      document.getElementById('govBountyAmount').value='';
      loadGovernanceData();
    }).catch(function(){showToast(tl('Failed to place bounty','현상금 등록 실패','賞金設定失敗','设置悬赏失败'))});
  };

  window.govSetTaxRate = function(){
    var w = walletState.address;
    if(!w||!_govMySectorId){showToast(tl('Not a governor','거버너가 아닙니다','知事ではありません','你不是总督'));return}
    var rate = parseFloat(document.getElementById('govTaxSlider').value);
    fetch('/api/governance/sector/'+_govMySectorId+'/tax-rate',{
      method:'POST',
      headers:Object.assign({'Content-Type':'application/json'},getAuthHeaders()),
      body:JSON.stringify({wallet:w,rate:rate})
    }).then(function(r){return r.json()}).then(function(d){
      if(d.error){showToast(d.error);return}
      showToast(tl('Tax rate set to ','세율 설정: ','税率設定: ','税率已设为 ')+d.taxRate+'%');
    }).catch(function(){showToast(tl('Failed to set tax rate','세율 설정 실패','税率設定失敗','设置税率失败'))});
  };

  window.govBuyBuff = function(buffType){
    var w = walletState.address;
    if(!w||!_govMySectorId){showToast(tl('Not a governor','거버너가 아닙니다','知事ではありません','你不是总督'));return}
    var cost = GOV_BUFF_COSTS[buffType] || 100;
    var hours = GOV_BUFF_HOURS[buffType] || 24;
    var label = GOV_BUFF_LABELS[buffType] || buffType;
    var govGP = _getGovernorGP(_govMySectorId);
    var sec = (_sectorsData||[]).find(function(s){return s.id===_govMySectorId});
    var sectorName = sec ? sec.name : tl('Sector ','섹터 ','セクター ','区域 ')+_govMySectorId;
    var insufficient = govGP < cost;
    gameConfirm({
      title: tl('ACTIVATE SECTOR BUFF','섹터 버프 활성화','セクターバフ発動','激活区域增益'),
      icon: '⚡',
      body: tl('Apply <b style="color:var(--gn)">','<b style="color:var(--gn)">','<b style="color:var(--gn)">','应用 <b style="color:var(--gn)">')+label+tl('</b> to <b style="color:var(--cyan)">','</b> 버프를 <b style="color:var(--cyan)">','</b> を <b style="color:var(--cyan)">','</b> 到 <b style="color:var(--cyan)">')+sectorName+tl('</b>?<br>Duration: <b>','</b>에 적용하시겠습니까?<br>지속 시간: <b>','</b> に適用しますか？<br>持続時間: <b>','</b>？<br>持续时间: <b>')+hours+tl('h</b>','시간</b>','時間</b>','小时</b>'),
      info: [
        { k:tl('COST','비용','コスト','费用'), v: cost+' GP' },
        { k:tl('GOVERNOR GP','거버너 GP','知事GP','总督GP'), v: govGP.toFixed(0), insufficient: insufficient, ok: !insufficient },
        { k:tl('AFTER','이후','後','之后'), v: (govGP - cost).toFixed(0)+' GP', insufficient: insufficient }
      ],
      confirmText: insufficient ? tl('INSUFFICIENT GP','GP 부족','GP不足','GP不足') : tl('ACTIVATE BUFF','버프 활성화','バフ発動','激活增益'),
      disabled: insufficient
    }).then(function(ok){
      if(!ok) return;
      fetch('/api/governance/sector/'+_govMySectorId+'/buff',{
        method:'POST',
        headers:Object.assign({'Content-Type':'application/json'},getAuthHeaders()),
        body:JSON.stringify({wallet:w,buffType:buffType})
      }).then(function(r){return r.json()}).then(function(d){
        if(d.error){showToast(d.error);return}
        showToast(tl('Buff activated: ','버프 활성화: ','バフ発動: ','增益已激活: ')+label+' ('+d.hours+'h · -'+d.gpSpent+' GP)');
        loadGovernanceData();
      }).catch(function(){showToast(tl('Failed to buy buff','버프 구매 실패','バフ購入失敗','购买增益失败'))});
    });
  };

  window.govSwitchSector = function(sectorId) {
    _govMySectorId = parseInt(sectorId);
    var mySector = _sectorsData && _sectorsData.find(function(s){return s.id===_govMySectorId});
    if(mySector){
      var saInput = document.getElementById('govSectorAnnounce');
      if(saInput) saInput.value = mySector.announcement || '';
      var taxSlider = document.getElementById('govTaxSlider');
      var taxVal = document.getElementById('govTaxVal');
      if(taxSlider && mySector.taxRate){
        taxSlider.value = mySector.taxRate;
        if(taxVal) taxVal.textContent = mySector.taxRate+'%';
      }
    }
    // Update picker button label
    var pickerBtn = document.getElementById('govSectorPickerBtn');
    if(pickerBtn){
      pickerBtn.textContent = (mySector ? mySector.name : tl('Sector ','섹터 ','セクター ','区域 ')+_govMySectorId) + ' ▾';
    }
  };

  window.openGovSectorPicker = function(){
    if(!_govMySectorIds.length){ showToast(tl('No sectors to manage','관리할 섹터가 없습니다','管理するセクターがありません','无可管理的区域')); return; }
    var items = _govMySectorIds.map(function(sid){
      var sn = (_sectorsData||[]).find(function(s){return s.id===sid});
      return { value: String(sid), label: sn ? sn.name : tl('Sector ','섹터 ','セクター ','区域 ')+sid };
    });
    gamePicker({title:tl('SELECT SECTOR TO MANAGE','관리할 섹터 선택','管理するセクターを選択','选择要管理的区域'), items:items, selected:String(_govMySectorId||'')}).then(function(v){
      if(v==null) return;
      govSwitchSector(v);
    });
  };

  window.govSetSectorAnnouncement = function(){
    var w = walletState.address;
    if(!w||!_govMySectorId){showToast(tl('Not a governor','거버너가 아닙니다','知事ではありません','你不是总督'));return}
    var text = document.getElementById('govSectorAnnounce').value.trim();
    fetch('/api/governance/sector/'+_govMySectorId+'/announcement',{
      method:'POST',
      headers:Object.assign({'Content-Type':'application/json'},getAuthHeaders()),
      body:JSON.stringify({wallet:w,text:text})
    }).then(function(r){return r.json()}).then(function(d){
      if(d.error){showToast(d.error);return}
      showToast(tl('Sector announcement updated','섹터 공지가 업데이트되었습니다','セクターお知らせを更新しました','区域公告已更新'));
      // Update local data and refresh overlay
      var sec = (_sectorsData || []).find(function(s){return s.id===_govMySectorId});
      if(sec) sec.announcement = text;
      if(typeof updateSectorAnnounces==='function') updateSectorAnnounces();
    }).catch(function(){showToast(tl('Failed to set announcement','공지 설정 실패','お知らせ設定失敗','设置公告失败'))});
  };

  window.govSaveDeclaration = function(){
    var w = walletState.address;
    if(!w||!_govMySectorId){showToast(tl('Not a governor','거버너가 아닙니다','知事ではありません','你不是总督'));return}
    var ta = document.getElementById('govDeclarationText');
    var text = ta ? ta.value.trim() : '';
    if(!text){showToast(tl('Enter declaration text','선언문을 입력하세요','宣言文を入力してください','请输入宣言文'));return}
    var sec = (_sectorsData||[]).find(function(s){return s.id===_govMySectorId});
    var code = sec && (sec.code || sec.sector_code || sec.name);
    if(!code){showToast(tl('Sector code not found','섹터 코드를 찾을 수 없습니다','セクターコードが見つかりません','未找到区域代码'));return}
    fetch('/api/governor/declaration',{
      method:'POST',
      headers:Object.assign({'Content-Type':'application/json'},getAuthHeaders()),
      body:JSON.stringify({wallet:w,sectorCode:code,text:text})
    }).then(function(r){return r.json()}).then(function(d){
      if(d.error){showToast(tl('Error: ','오류: ','エラー: ','错误: ')+d.error);return}
      showToast(tl('Declaration saved! (-5 GP)','선언문 저장 완료! (-5 GP)','宣言文を保存しました！(-5 GP)','宣言已保存！(-5 GP)'));
      try { loadGovernanceData(); } catch(_) {}
    }).catch(function(){showToast(tl('Failed','실패','失敗','失败'))});
  };

  // Tax slider live update
  (function(){
    var sl = document.getElementById('govTaxSlider');
    if(sl) sl.addEventListener('input',function(){
      document.getElementById('govTaxVal').textContent = this.value+'%';
    });
  })();

  function fetchAnnounce(){
    if (!_pageIsActive()) return;
    wlfReadFetch('config', '/api/config', 120000, false).then(function(cfg){
      if (!cfg) return;
      if(cfg && cfg.announcement) showAnnounce(cfg.announcement);
      else {
        var banner = document.getElementById('announceBanner');
        if(banner) banner.classList.remove('show');
      }
      // Update pricing from server config
      if(cfg.pixelBasePrice) PIXEL_PRICE=cfg.pixelBasePrice;
      if(cfg.hijackMultiplier) HIJACK_MULT=cfg.hijackMultiplier;
      if(cfg.sectorPrices) SECTOR_PRICES=cfg.sectorPrices;
      // Governance state
      if(cfg.governance) _updateGovernanceUI(cfg.governance);
    }).catch(function(){});
  }

  // 초기 로드 + 주기적 갱신
  _setActiveTimeout(fetchAnnounce, 1500);
  _setActiveInterval(fetchAnnounce, POLL_INTERVAL);
})();
