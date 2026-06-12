// ══════════════════════════════════════════════════════════
//  DAILY ENGAGEMENT SYSTEM
// ══════════════════════════════════════════════════════════
var _dailyState = {
  streak: 0,
  todayClaimed: false,
  missions: [],
  gpBalance: 0,
  lastReward: 0
};

// 14-day check-in rewards (GP per day)
var _dailyRewards = [5, 10, 10, 15, 15, 20, 30, 10, 15, 15, 20, 20, 25, 50];
// Milestone days with bonus rewards
var _dailyMilestones = {
  3:  { bonus: 30,  label: '3-DAY STREAK!' },
  7:  { bonus: 100, label: 'WEEKLY STREAK!' },
  10: { bonus: 150, label: '10-DAY STREAK!' },
  14: { bonus: 300, label: 'FULL STAMP CARD!' }
};

// ── Check Daily Login (query-only, no auto-claim) ──
function checkDailyLogin(){
  if(!emailAuth.token || !walletState.address) return;
  var today = new Date().toISOString().slice(0,10);
  // NOTE: always fetch status from server so streak/defs stay in sync.
  // The previous "localStorage fast-path" returned before loading the streak,
  // which left streak=0 while todayClaimed=true → entire 14-day row shows locked.
  // Just check status, don't auto-claim
  fetch('/api/daily/status',{
    headers:{'Authorization':'Bearer '+emailAuth.token}
  }).then(function(r){return r.json()}).then(function(d){
    _dailyState.streak = d.streak || 0;
    // cycleDay: position within current cycle (e.g. streak=8 with maxDays=7 → cycleDay=1)
    var _maxDays = (d.maxDays || 7);
    _dailyState.cycleDay = d.cycleDay !== undefined ? d.cycleDay :
      (_dailyState.streak > 0 ? ((_dailyState.streak - 1) % _maxDays + 1) : 0);
    // Load reward defs from server (admin-configurable)
    if(d.dayRewards && d.dayRewards.length) {
      _dayRewardDefs = d.dayRewards.map(function(dr){
        var icon = dr.milestone ? '🏆' : '💰';
        if(dr.day === _maxDays) icon = '👑';
        return { icon: icon, gp: dr.gp || 0, milestone: dr.milestone, day: dr.day };
      });
    } else {
      _dayRewardDefs = _dayRewardDefaults;
    }
    _dailyState.lastReward = (_dayRewardDefs[Math.min(_dailyState.streak, _dayRewardDefs.length-1)] || {}).gp || 10;
    if(d.todayClaimed){
      _dailyState.todayClaimed = true;
      localStorage.setItem('daily_login_date_'+walletState.address, today);
    } else {
      _dailyState.todayClaimed = false;
    }
    _dailyDotReady = true;
    updateDailyHudDot();
    renderInlineCheckin();
    loadDailyMissions();
  }).catch(function(e){
    console.log('[Daily] Status endpoint not available, using local defaults');
    _dayRewardDefs = _dayRewardDefaults;
    var lastStreak = localStorage.getItem('daily_last_streak_'+walletState.address);
    _dailyState.streak = lastStreak ? parseInt(lastStreak) : 0;
    _dailyState.lastReward = (_dayRewardDefs[Math.min(_dailyState.streak, _dayRewardDefs.length-1)] || {}).gp || 10;
    _dailyState.todayClaimed = false;
    _dailyDotReady = true;
    updateDailyHudDot();
    renderInlineCheckin();
    loadDailyMissions();
  });
}

// ── Render 14-day stamp board ──
function renderDailyStreakRow(){
  var board = document.getElementById('dailyStampBoard');
  var streak = _dailyState.streak;
  var html = '';
  var milestoneKeys = [3, 7, 10, 14];
  for(var i=1;i<=14;i++){
    var cls = 'stamp-cell';
    var stamp = '';
    var isMilestone = milestoneKeys.indexOf(i) >= 0;
    var reward = _dailyRewards[Math.min(i-1, _dailyRewards.length-1)];
    if(i < streak){ cls += ' stamped'; stamp = '✅'; }
    else if(i === streak){ cls += ' today'; stamp = '🎁'; }
    else { cls += ' future'; stamp = '·'; }
    if(isMilestone && i >= streak) cls += ' milestone';
    if(isMilestone && i < streak) cls += ' milestone';
    html += '<div class="'+cls+'">';
    if(isMilestone) html += '<span class="sc-milestone">+' + _dailyMilestones[i].bonus + '</span>';
    html += '<div class="sc-day">D'+i+'</div>';
    html += '<div class="sc-stamp">'+stamp+'</div>';
    html += '<div class="sc-reward">'+reward+'GP</div>';
    html += '</div>';
  }
  board.innerHTML = html;

  var rewardText = document.getElementById('dailyRewardText');
  var todayReward = _dailyState.lastReward || _dailyRewards[Math.min(streak-1, _dailyRewards.length-1)];
  rewardText.innerHTML = '🎁 TODAY: <strong>+' + todayReward + ' GP</strong>';

  var milestone = _dailyMilestones[streak];
  var milestoneEl = document.getElementById('dailyMilestoneText');
  if(milestone){
    milestoneEl.innerHTML = '🏆 ' + milestone.label + ' <strong>+' + milestone.bonus + ' GP BONUS!</strong>';
    milestoneEl.style.display = '';
  } else {
    milestoneEl.style.display = 'none';
  }
}

// ── Render inline check-in inside QUESTS tab ──
// Day reward definitions — loaded from server, fallback to defaults
var _dayRewardDefs = [];
var _dayRewardDefaults = [
  { icon: '💰', gp: 5 }, { icon: '💰', gp: 10 }, { icon: '💰', gp: 10 },
  { icon: '💰', gp: 15 }, { icon: '💰', gp: 15 }, { icon: '💰', gp: 20 },
  { icon: '🏆', gp: 30, milestone: { bonus: 100 } }, { icon: '💰', gp: 10 },
  { icon: '💰', gp: 15 }, { icon: '💰', gp: 15 }, { icon: '💰', gp: 20 },
  { icon: '💰', gp: 20 }, { icon: '💰', gp: 25 },
  { icon: '👑', gp: 50, milestone: { bonus: 300 } }
];

function renderInlineCheckin(){
  var board = document.getElementById('inlineStampBoard');
  if(!board) return;
  var streak = _dailyState.streak;          // total consecutive days (for header label)
  var cycleDay = _dailyState.cycleDay !== undefined ? _dailyState.cycleDay : streak; // position in 7-day cycle
  var claimed = _dailyState.todayClaimed;
  var html = '';
  var defs = _dayRewardDefs.length ? _dayRewardDefs : _dayRewardDefaults;
  var maxDays = defs.length || 7;

  for(var d=1;d<=maxDays;d++){
    var def = defs[d-1] || { icon: '💰', gp: 10 };
    // Use cycleDay (1-7) instead of raw streak to prevent "8-of-7" display
    var done = claimed ? d <= cycleDay : d < cycleDay + 1;
    if(!claimed && d <= cycleDay) done = true;
    var isToday = !claimed && d === cycleDay + 1;
    var isFuture = claimed ? d > cycleDay : d > cycleDay + 1;

    // Styles
    var bg, bdr, opacity;
    if(done) {
      bg = 'linear-gradient(180deg,rgba(76,216,154,.15),rgba(76,216,154,.05))';
      bdr = 'rgba(76,216,154,.4)';
      opacity = '1';
    } else if(isToday) {
      bg = 'linear-gradient(180deg,rgba(255,209,102,.2),rgba(255,160,40,.1))';
      bdr = 'rgba(255,209,102,.6)';
      opacity = '1';
    } else {
      bg = 'rgba(255,255,255,.02)';
      bdr = 'rgba(255,255,255,.06)';
      opacity = '0.4';
    }

    var todayGlow = isToday ? 'box-shadow:0 0 8px rgba(255,209,102,.4);animation:checkinPulse 1.5s ease-in-out infinite;' : '';

    html += '<div style="text-align:center;padding:4px 2px;border-radius:6px;background:'+bg+';border:1px solid '+bdr+';opacity:'+opacity+';position:relative;'+todayGlow+'">';

    // Day number
    html += '<div style="font-size:7px;color:'+(done?'var(--gn)':isToday?'var(--gold)':'var(--tx3)')+';font-family:var(--fn);margin-bottom:2px">'+t('daily_day_prefix')+' '+d+'</div>';

    // Reward icon (large)
    if(done) {
      html += '<div style="font-size:18px;line-height:1.2;filter:grayscale(0.3)">✅</div>';
    } else {
      html += '<div style="font-size:18px;line-height:1.2">'+(isFuture?'🔒':def.icon)+'</div>';
    }

    // Reward label
    if(!done) {
      var amtLabel = '+' + (def.gp || 0) + ' ' + t('daily_gp_suffix');
      var amtColor = def.milestone ? 'var(--gold)' : 'var(--tx)';
      html += '<div style="font-size:7px;color:'+amtColor+';font-weight:700;margin-top:1px">'+amtLabel+'</div>';
      if(def.milestone) html += '<div style="font-size:6px;color:var(--gold)">+'+def.milestone.bonus+' '+t('daily_bonus_suffix')+'</div>';
    } else {
      html += '<div style="font-size:7px;color:var(--gn);margin-top:1px">'+t('daily_done')+'</div>';
    }

    // Milestone star
    if(def.milestone) {
      html += '<div style="position:absolute;top:-3px;right:-3px;font-size:10px">⭐</div>';
    }

    html += '</div>';
  }
  board.innerHTML = html;

  // Streak label (도파민 #5: 🔥 연속일수 강조 — 길수록 뜨겁게)
  var label = document.getElementById('checkinStreakLabel');
  if(label){
    var _flame = streak>=14?'🔥🔥🔥':streak>=7?'🔥🔥':streak>=2?'🔥':'';
    label.textContent = (_flame?_flame+' ':'') + t('daily_streak_days').replace('{n}',streak);
    label.style.color = streak>=7?'#ff7a45':'var(--mars)';
  }

  // Period label + 손실회피 경고 (오늘 안 하면 streak 리셋)
  var periodEl = document.getElementById('checkinPeriodLabel');
  if(periodEl){
    var _baseP = t('daily_day_of').replace('{cur}',(claimed ? cycleDay : cycleDay+1)).replace('{total}',maxDays);
    if(!claimed && streak>=2){
      _baseP += ' · <span style="color:#ff8a65;font-weight:700">⚠ ' + (LANG==='ko'?('오늘 놓치면 '+streak+'일 연속 리셋!'):LANG==='ja'?('今日逃すと'+streak+'日連続リセット!'):LANG==='zh'?('今天错过将重置'+streak+'日连续!'):('Miss today → lose '+streak+'-day streak!')) + '</span>';
    }
    periodEl.innerHTML = _baseP;
  }

  // Reward text + button
  var rewardEl = document.getElementById('inlineCheckinReward');
  var btn = document.getElementById('inlineCheckinBtn');
  if(claimed){
    if(rewardEl) rewardEl.innerHTML = '<span style="color:var(--gn)">'+t('daily_checked_in')+'</span>';
    if(btn) btn.style.display = 'none';
  } else {
    var nextDef = defs[Math.min(streak, defs.length-1)] || { icon: '💰', gp: 10 };
    var rwText = nextDef.icon + ' +' + (nextDef.gp||0) + ' ' + t('daily_gp_suffix');
    if(nextDef.milestone) rwText += ' + 🎁' + nextDef.milestone.bonus + ' ' + t('daily_bonus_suffix');
    if(rewardEl) rewardEl.innerHTML = '<span style="font-size:11px">'+t('daily_today_label')+' <b style="color:var(--gold)">' + rwText + '</b></span>';
    if(btn) btn.style.display = '';
  }
}

// ── Today's OPS Board ──
function _dailyOpsTodayKey(){
  return new Date().toISOString().slice(0,10);
}
function _dailyOpsWeekStartKey(){
  var now = new Date();
  var day = now.getDay(); // 0 Sun, 1 Mon
  var delta = day === 0 ? 6 : day - 1;
  now.setHours(0,0,0,0);
  now.setDate(now.getDate() - delta);
  return now.toISOString().slice(0,10);
}
function _dailyOpsStorageKey(){
  var w = (walletState && walletState.address ? walletState.address : 'guest').toLowerCase();
  return 'daily_ops_board_' + w + '_' + _dailyOpsTodayKey();
}
function _dailyOpsWeekStorageKey(){
  var w = (walletState && walletState.address ? walletState.address : 'guest').toLowerCase();
  return 'daily_ops_week_' + w + '_' + _dailyOpsWeekStartKey();
}
function _dailyOpsCanonicalTypes(type){
  var map = {
    login_check: ['daily_login'],
    territory_harvest: ['harvest_pp','harvest_3','harvest_5'],
    harvest_pp: ['harvest_pp','harvest_3','harvest_5'],
    ship_upgrade: ['upgrade_ship','upgrade_ship_3','upgrade_ship_5'],
    upgrade_ship: ['upgrade_ship','upgrade_ship_3','upgrade_ship_5'],
    ai_practice: ['ai_battle','ai_battle_3'],
    ai_battle: ['ai_battle','ai_battle_3'],
    build_ship: ['build_ship'],
    repair_ship: ['repair_ship','repair_ship_3'],
    fleet_formation: ['fleet_formation'],
    craft_resource: ['craft_resource','craft_resource_3','craft_resource_5'],
    market_list: ['market_list','market_activity'],
    market_buy: ['market_buy','market_activity'],
    territory_claim: ['territory_claim'],
    territory_art: ['territory_art'],
    territory_upgrade: ['territory_upgrade','territory_upgrade_3'],
    campaign_progress: ['campaign_progress'],
    campaign_complete: ['campaign_complete'],
    battle_participate: ['battle_participate','battle_participate_3'],
    battle_win: ['battle_win','battle_win_3'],
    battle_forfeit: ['battle_forfeit'],
    salvage_wreck: ['salvage_wreck','salvage_wreck_3']
  };
  return map[type] || [type];
}
function _dailyOpsKnownTasks(){
  return [
    'daily_login',
    'harvest_pp','harvest_3','harvest_5',
    'territory_art','territory_upgrade','territory_upgrade_3','territory_claim',
    'battle_participate','battle_participate_3','battle_win','battle_win_3','battle_forfeit',
    'salvage_wreck','salvage_wreck_3',
    'ai_battle','ai_battle_3',
    'upgrade_ship','upgrade_ship_3','upgrade_ship_5','build_ship','repair_ship','repair_ship_3','fleet_formation',
    'craft_resource','craft_resource_3','craft_resource_5','market_list','market_buy','market_activity',
    'campaign_progress','campaign_complete',
    'login_check','territory_harvest','ship_upgrade','ai_practice'
  ];
}
function _scheduleOpsBoardRefresh(){
  try { loadOpsCommandBoard(); } catch(_e) {}
  [450, 1300].forEach(function(ms){
    _setActiveTimeout(function(){ try { loadOpsCommandBoard(); } catch(_e) {} }, ms);
  });
}
function _loadDailyOpsState(){
  var raw = null;
  try { raw = JSON.parse(localStorage.getItem(_dailyOpsStorageKey()) || 'null'); } catch(_e) {}
  var base = {
    date: _dailyOpsTodayKey(),
    loginRewardClaimed: false,
    tasks: {}
  };
  _dailyOpsKnownTasks().forEach(function(k){ base.tasks[k] = { current: 0, target: 1 }; });
  if (raw && raw.tasks) {
    Object.keys(base.tasks).forEach(function(k){
      var cur = raw.tasks[k] || {};
      base.tasks[k].current = Math.max(0, Number(cur.current || 0));
      if (cur.target != null) base.tasks[k].target = Math.max(1, Number(cur.target || 1));
    });
    base.loginRewardClaimed = !!raw.loginRewardClaimed;
  }
  if (isLoggedIn()) base.tasks.login_check.current = 1;
  return base;
}
function _saveDailyOpsState(state){
  try { localStorage.setItem(_dailyOpsStorageKey(), JSON.stringify(state)); } catch(_e) {}
}
function _loadDailyOpsWeekState(){
  var raw = null;
  try { raw = JSON.parse(localStorage.getItem(_dailyOpsWeekStorageKey()) || 'null'); } catch(_e) {}
  if (!raw || typeof raw !== 'object') raw = {};
  if (!raw.completedDates || typeof raw.completedDates !== 'object') raw.completedDates = {};
  raw.rewardClaimed = !!raw.rewardClaimed;
  return raw;
}
function _saveDailyOpsWeekState(state){
  try { localStorage.setItem(_dailyOpsWeekStorageKey(), JSON.stringify(state)); } catch(_e) {}
}
function _isDailyOpsTaskComplete(task){
  return Number(task.current || 0) >= Number(task.target || 1);
}
function _syncDailyOpsWeekProgress(state){
  var week = _loadDailyOpsWeekState();
  var allDone = Object.keys(state.tasks).every(function(key){
    return _isDailyOpsTaskComplete(state.tasks[key]);
  });
  if (allDone) {
    week.completedDates[state.date] = true;
    _saveDailyOpsWeekState(week);
  }
  return week;
}
function markDailyOpsAction(type, amount){
  var state = _loadDailyOpsState();
  var types = _dailyOpsCanonicalTypes(type);
  var delta = Math.max(1, Number(amount || 1));
  types.forEach(function(t){
    if (!state.tasks[t]) state.tasks[t] = { current: 0, target: 1 };
    var task = state.tasks[t];
    task.current = Math.min(Number(task.target || 1), Number(task.current || 0) + delta);
    if (type === 'login_check' || t === 'daily_login') task.current = 1;
  });
  _saveDailyOpsState(state);
  _syncDailyOpsWeekProgress(state);
  _scheduleOpsBoardRefresh();
}
function openOpsRewardInventory(){
  openBaseModal();
  setTimeout(function(){
    try {
      var shopTab = document.getElementById('baseTabShop');
      switchBaseTab('shop', shopTab || null);
      if(typeof loadBaseShopItems === 'function') loadBaseShopItems();
      if(typeof clearBaseTabDot === 'function') clearBaseTabDot('shop');
      requestAnimationFrame(function(){
        requestAnimationFrame(function(){
          try{
            var btn = document.querySelector('.base-shop-view[onclick*=\"inventory\"]');
            switchBaseShopView('inventory', btn || null);
          }catch(_inner){}
        });
      });
    } catch(_e) {}
  }, 80);
}
// ── Claim Daily Login ──
function claimDailyLogin(){
  if(!emailAuth.token || !walletState.address) { showToast(t('daily_login_required')); return; }
  if(_dailyState.todayClaimed) { showToast(t('daily_already_checked')); return; }

  fetch('/api/daily/login',{
    method:'POST',
    headers:{'Content-Type':'application/json','Authorization':'Bearer '+emailAuth.token},
    body:JSON.stringify({wallet:walletState.address})
  }).then(function(r){return r.json()}).then(function(d){
    if(d.error && !d.already_claimed) { showToast(d.error); return; }
    var today = new Date().toISOString().slice(0,10);
    // Service returns streakDay; status endpoint returns streak
    var newStreak = d.streak || d.streakDay || (_dailyState.streak + 1);
    _dailyState.streak = newStreak;
    // Compute cycleDay from the updated streak
    var _md = (_dayRewardDefs.length || 7);
    _dailyState.cycleDay = d.cycleDay !== undefined ? d.cycleDay :
      (newStreak > 0 ? ((newStreak - 1) % _md + 1) : 1);
    _dailyState.lastReward = d.reward || d.rewardGP || _dailyRewards[Math.min(newStreak - 1, 13)] || 10;
    _dailyState.todayClaimed = true;
    localStorage.setItem('daily_login_date_'+walletState.address, today);
    localStorage.setItem('daily_last_streak_'+walletState.address, String(_dailyState.streak));
    closeDailyLogin();
    var msg = t('daily_gp_claimed').replace('{n}', _dailyState.lastReward);
    var milestone = _dailyMilestones[_dailyState.streak];
    if(milestone) msg += ' ' + t('daily_streak_bonus').replace('{n}', milestone.bonus);
    showToast(msg);
    // [v7.220 upgrade #2] 48h 유예 발동 시 안내 — 하루 놓쳤지만 streak 살아남.
    if (d.graceUsed) {
      setTimeout(function(){
        showToast(tl('🛟 Streak saved! (1-day grace used)','🛟 연속 보너스 유지! (하루 유예 사용)','🛟 連続維持！(1日猶予)','🛟 连续保留！(1日宽限)'),'success');
      }, 900);
    }
    showNotification('system',t('daily_checkin_complete'),t('daily_streak_msg').replace('{n}',_dailyState.streak)+' '+msg);
    try{_sfx.harvest()}catch(e){}
    renderInlineCheckin();
    updateDailyHudDot();
    try{ loadOpsCommandBoard(); }catch(_ops){}
    try{ loadDailyOpsBoard(); }catch(_dops){}
    try{ refreshEmailBalances(); }catch(_rb){}
  }).catch(function(){ showToast(t('daily_check_in_failed')); });
}

function closeDailyLogin(){
  document.getElementById('dailyLoginPopup').classList.remove('open');
}

// ── Daily Missions ──
var _defaultMissions = [
  {id:'claim_land', type:'claim_fallback', icon:'🏴', title:'CLAIM TERRITORY', desc:'Claim land pixels on the Mars globe', target:1, current:0, reward:20, claimed:false},
  {id:'visit_sectors', type:'explore_fallback', icon:'🔭', title:'EXPLORE SECTORS', desc:'Discover a POI marker on the globe', target:1, current:0, reward:15, claimed:false},
  {id:'play_game', type:'play_fallback', icon:'🎮', title:'DAILY ACTIVITY', desc:'Perform any game action (claim, mine, hijack, etc.)', target:3, current:0, reward:25, claimed:false}
];

function loadDailyMissions(){
  if(!emailAuth.token) return;
  document.getElementById('dailyMissionsPanel').style.display = '';

  fetch('/api/daily/missions',{
    headers:{'Authorization':'Bearer '+emailAuth.token}
  }).then(function(r){return r.json()}).then(function(d){
    if(d.missions && d.missions.length){
      _dailyState.missions = d.missions;
    } else {
      _dailyState.missions = JSON.parse(JSON.stringify(_defaultMissions));
    }
    renderDailyMissions();
  }).catch(function(){
    // Backend not ready — use default missions with localStorage tracking
    console.log('[Daily] Missions endpoint not available, using local defaults');
    var stored = localStorage.getItem('daily_missions_'+walletState.address+'_'+new Date().toISOString().slice(0,10));
    if(stored){
      try{ _dailyState.missions = JSON.parse(stored); }catch(e){ _dailyState.missions = JSON.parse(JSON.stringify(_defaultMissions)); }
    } else {
      _dailyState.missions = JSON.parse(JSON.stringify(_defaultMissions));
    }
    renderDailyMissions();
  });

  startDailyTimer();
}

// ── ACHIEVEMENTS (Migration 104) ────────────────────────────────────────────────
var _achievements = [];
var _achFilter = 'all';

var ACH_CAT_COLOR = {
  territory:  '#4cd89a',
  economy:    'var(--gold)',
  combat:     'var(--mars)',
  social:     'var(--cyan)',
  collection: '#a064dc'
};
var ACH_RARITY_COLOR = {
  common:    'rgba(255,255,255,.5)',
  rare:      '#5cbbff',
  epic:      '#a064dc',
  legendary: 'var(--gold)'
};
var ACH_RARITY_GLOW = {
  common:    'none',
  rare:      '0 0 8px rgba(92,187,255,.4)',
  epic:      '0 0 10px rgba(160,100,220,.5)',
  legendary: '0 0 14px rgba(255,209,102,.6)'
};
function _engagementRead(key,url,auth){
  var walletKey = String((walletState&&walletState.address)||'public').toLowerCase();
  if(typeof _guardedJsonFetch==='function'){
    return _guardedJsonFetch('engagement:'+key+':'+walletKey, url, {
      minGap:15000,
      backoffMs:120000,
      fetchOptions: auth ? { headers:getAuthHeaders() } : {}
    });
  }
  return fetch(url, auth ? { headers:getAuthHeaders() } : {}).then(function(r){return r.ok?r.json():null;}).catch(function(){return null;});
}

// ── WEEKLY CHALLENGES (Migration 109) ────────────────────────────────────────
var WEEKLY_DIFF_COLOR = { easy: '#4cd89a', normal: 'var(--cyan)', hard: 'var(--gold)', epic: 'var(--mars)' };

function loadWeeklyChallenges() {
  var sec = document.getElementById('weeklyChallengesSection');
  if (!sec) return;
  // Weekly challenges service was removed with the legacy phantom tables.
  sec.style.display = 'none';
}

function renderWeeklyChallenges(challenges) {
  var container = document.getElementById('weeklyChallengesContainer');
  if (!container || !challenges.length) {
    if (container) container.innerHTML = '<div style="color:var(--tx3);font-size:10px;text-align:center;padding:12px">No challenges this week</div>';
    return;
  }

  // Group by type
  var personal    = challenges.filter(function(c){ return c.challenge_type === 'personal'; });
  var collective  = challenges.filter(function(c){ return c.challenge_type === 'collective'; });
  var competitive = challenges.filter(function(c){ return c.challenge_type === 'competitive'; });

  function renderGroup(title, list, color) {
    if (!list.length) return '';
    var html = '<div style="font-size:9px;font-weight:700;color:'+color+';letter-spacing:1px;margin:8px 0 4px">'+title+'</div>';
    list.forEach(function(c) {
      var pct = c.challenge_type === 'collective' ? c.collective_pct : c.pct;
      var progress = c.challenge_type === 'collective' ? c.collective_progress : c.user_progress;
      var diffColor = WEEKLY_DIFF_COLOR[c.difficulty] || 'var(--tx2)';
      var canClaim = c.user_completed && !c.reward_claimed && c.challenge_type !== 'competitive';
      var collectiveDone = c.collective_completed;
      var collectiveCanClaim = c.challenge_type === 'collective' && collectiveDone && !c.reward_claimed;

      html += '<div style="padding:8px;background:rgba(255,255,255,.03);border-radius:6px;margin-bottom:4px;border:1px solid rgba(255,255,255,.06)'
        + (c.user_completed ? ';border-color:rgba(76,216,154,.3)' : '')
        + (collectiveDone ? ';border-color:rgba(91,184,232,.3)' : '')
        + '">'
        + '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:4px">'
        + '<div style="flex:1">'
        + '<div style="font-size:10px;color:var(--tx);font-weight:700">' + c.icon + ' ' + c.name + '</div>'
        + '<div style="font-size:9px;color:var(--tx3)">' + c.desc + '</div>'
        + '</div>'
        + '<div style="text-align:right;min-width:60px">'
        + '<div style="font-size:9px;color:'+diffColor+';font-weight:700">'+c.difficulty.toUpperCase()+'</div>'
        + '<div style="font-size:9px;color:var(--gold)">+'+c.reward_gp+' GP</div>'
        + '</div>'
        + '</div>'
        // Progress bar
        + '<div style="background:rgba(255,255,255,.06);border-radius:3px;height:4px;margin-bottom:4px">'
        + '<div style="background:'+color+';width:'+pct+'%;height:4px;border-radius:3px;transition:width .3s"></div>'
        + '</div>'
        + '<div style="display:flex;justify-content:space-between;align-items:center">'
        + '<span style="font-size:9px;color:var(--tx3)">'+progress+' / '+c.target_value+'</span>'
        + (canClaim || collectiveCanClaim ? '<button onclick="claimWeeklyReward('+c.instance_id+')" style="font-size:9px;padding:3px 10px;background:rgba(76,216,154,.2);border:1px solid rgba(76,216,154,.35);color:var(--gn);border-radius:4px;cursor:pointer;font-weight:700">CLAIM +'+c.reward_gp+' GP</button>' : '')
        + (c.reward_claimed ? '<span style="font-size:9px;color:var(--gn)">✅ Claimed</span>' : '')
        + (c.challenge_type === 'competitive' ? '<span style="font-size:8px;color:var(--tx3)">Top scorer wins</span>' : '')
        + '</div>'
        + '</div>';
    });
    return html;
  }

  container.innerHTML =
    renderGroup('PERSONAL', personal, 'var(--cyan)')
    + renderGroup('🌐 COLLECTIVE (Server-Wide)', collective, '#a064dc')
    + renderGroup('🏆 COMPETITIVE', competitive, 'var(--gold)');
}

function claimWeeklyReward(instanceId) {
  showToast('Weekly challenges are currently unavailable', 'warn');
}

// ── Bounty Board ──────────────────────────────────────────────────────────────

var _bountyTab = 'active';

function switchBountyTab(tab) {
  _bountyTab = tab;
  ['active','mine','onme'].forEach(function(t) {
    var btn = document.getElementById('bbtab' + t.charAt(0).toUpperCase() + t.slice(1));
    if (!btn) return;
    btn.style.background = t === tab ? 'rgba(232,72,85,.18)' : 'rgba(255,255,255,.05)';
    btn.style.borderColor = t === tab ? 'rgba(232,72,85,.45)' : 'rgba(255,255,255,.1)';
    btn.style.color = t === tab ? 'var(--mars)' : 'var(--tx3)';
    btn.style.fontWeight = t === tab ? '700' : '400';
  });
  loadBountyBoard();
}

function loadBountyBoard() {
  var el = document.getElementById('bountyBoardContainer');
  if (!el) return;

  if (!walletState.address && _bountyTab !== 'active') {
    el.innerHTML = '<div style="color:var(--tx3);font-size:10px;text-align:center;padding:12px">Connect wallet to view</div>';
    return;
  }
  var hadContent = !!el.innerHTML.trim();
  if(!hadContent) el.innerHTML = '<div style="color:var(--tx3);font-size:10px;text-align:center;padding:12px">Loading...</div>';

  var url = '/api/bounty/list';
  if (_bountyTab === 'mine') url = '/api/bounty/my-bounties';
  else if (_bountyTab === 'onme') url = '/api/bounty/on-me';

  _engagementRead('bounty-' + _bountyTab, url, true)
    .then(function(data) {
      if(!data){
        if(!hadContent) el.innerHTML = '<div style="color:var(--tx3);font-size:10px;text-align:center;padding:12px">Refreshing bounty board...</div>';
        return;
      }
      var list = data.bounties || [];
      if (!list.length) {
        el.innerHTML = '<div style="color:var(--tx3);font-size:10px;text-align:center;padding:12px">No bounties</div>';
        return;
      }
      renderBountyList(list, el);
    }).catch(function() {
      el.innerHTML = '<div style="color:var(--mars);font-size:10px;text-align:center;padding:8px">Failed to load</div>';
    });
}

function renderBountyList(bounties, el) {
  var html = '<div style="display:flex;flex-direction:column;gap:6px">';
  var now = Date.now();
  bounties.forEach(function(b) {
    var posterWallet = b.poster || b.poster_wallet || '';
    var targetNick = b.target_nick || (b.target_wallet||'').slice(0,10) + '…';
    var posterNick = b.poster_nick || posterWallet.slice(0,10) + '…';
    var gpAmount = b.gp_amount || b.reward_gp || 0;
    var message = b.message || b.reason || '';
    var statusColor = b.status === 'active' ? 'var(--gn)' : b.status === 'claimed' ? '#5cbbff' : 'var(--tx3)';
    var expires = b.expires_at ? Math.max(0, new Date(b.expires_at) - now) : 0;
    var expiresStr = expires > 0 ? Math.floor(expires / 86400000) + 'd ' + Math.floor((expires % 86400000) / 3600000) + 'h' : 'expired';

    html += '<div style="background:rgba(232,72,85,.05);border:1px solid rgba(232,72,85,.2);border-radius:8px;padding:8px 10px">';
    html += '<div style="display:flex;align-items:flex-start;gap:8px;margin-bottom:4px">';
    html += '<div style="flex:1">';
    html += '<div style="font-size:10px;font-weight:700;color:var(--mars)">🎯 ' + escHtml(targetNick) + '</div>';
    html += '<div style="font-size:8px;color:var(--tx3);margin-top:2px">by ' + escHtml(posterNick) + ' · ' + (b.status === 'active' ? 'expires in ' + expiresStr : b.status.toUpperCase()) + '</div>';
    html += '</div>';
    html += '<div style="text-align:right"><div style="font-size:12px;font-weight:800;color:var(--gold)">' + parseFloat(gpAmount).toFixed(0) + ' GP</div>';
    html += '<div style="font-size:8px;color:' + statusColor + '">' + b.status.toUpperCase() + '</div>';
    html += '</div></div>';
    if (message) html += '<div style="font-size:9px;color:var(--tx2);font-style:italic;padding-top:4px;border-top:1px solid rgba(255,255,255,.05)">"' + escHtml(message) + '"</div>';

    // Cancel button for own active bounties
    if (_bountyTab === 'mine' && b.status === 'active' && walletState.address && posterWallet === walletState.address.toLowerCase()) {
      html += '<button onclick="cancelBounty(' + b.id + ')" style="margin-top:6px;font-size:8px;padding:2px 8px;background:rgba(255,80,30,.12);border:1px solid rgba(255,80,30,.3);color:var(--mars);border-radius:4px;cursor:pointer">CANCEL</button>';
    }
    html += '</div>';
  });
  html += '</div>';
  el.innerHTML = html;
}

function openPostBountyModal() {
  if (!walletState.address) { showToast('Connect wallet first', 'error'); return; }
  var modal = document.getElementById('postBountyModal');
  if (!modal) return;
  modal.style.display = 'flex';
  document.getElementById('bountyTargetInput').value = '';
  document.getElementById('bountyAmountInput').value = '';
  document.getElementById('bountyMsgInput').value = '';
}

function closePostBountyModal() {
  var modal = document.getElementById('postBountyModal');
  if (modal) modal.style.display = 'none';
}

function submitPostBounty() {
  var target = (document.getElementById('bountyTargetInput') || {}).value.trim();
  var amount = parseFloat((document.getElementById('bountyAmountInput') || {}).value);
  var msg    = ((document.getElementById('bountyMsgInput') || {}).value || '').trim();

  if (!target) { showToast('Enter a target wallet or nickname', 'error'); return; }
  if (isNaN(amount) || amount < 50) { showToast('Minimum bounty is 50 GP', 'error'); return; }
  if (!walletState.address) { showToast('Connect wallet', 'error'); return; }

  gameConfirm({icon:'🎯', title:'POST BOUNTY',
    body: 'Spend ' + amount + ' GP to place a bounty on "' + escHtml(target) + '"? GP is held in escrow until claimed or expired.',
    confirmText: 'POST'})
    .then(function(confirmed) {
      if (!confirmed) return;
      return fetch('/api/bounty/post', {
        method: 'POST',
        headers: Object.assign({ 'Content-Type': 'application/json' }, getAuthHeaders()),
        body: JSON.stringify({ wallet: walletState.address, target_wallet: target, reward_gp: amount, reason: msg })
      }).then(function(r){ return r.json(); }).then(function(d) {
        if (d.error) { showToast(d.error, 'error'); return; }
        showToast('🎯 Bounty posted! ' + amount + ' GP escrowed', 'success');
        closePostBountyModal();
        switchBountyTab('mine');
        loadWalletData();
      });
    }).catch(function(e) { showToast(e.message || 'Failed', 'error'); });
}

function cancelBounty(bountyId) {
  if (!walletState.address) return;
  gameConfirm({icon:'🎯', title:'CANCEL BOUNTY', body:'Cancel this bounty? A cancellation fee may apply.', confirmText:'Cancel'})
    .then(function(confirmed) {
      if (!confirmed) return;
      return fetch('/api/bounty/cancel/' + bountyId, {
        method: 'POST',
        headers: Object.assign({ 'Content-Type': 'application/json' }, getAuthHeaders()),
        body: JSON.stringify({ wallet: walletState.address })
      }).then(function(r){ return r.json(); }).then(function(d) {
        if (d.error) { showToast(d.error, 'error'); return; }
        showToast('Bounty cancelled. ' + (d.refunded_gp || 0) + ' GP refunded', 'success');
        loadBountyBoard();
        if (typeof loadWalletData === 'function') loadWalletData();
      });
    }).catch(function(e) { showToast(e.message || 'Failed', 'error'); });
}

// ── GP Duel System ────────────────────────────────────────────────────────────

var _duelTab = 'pending';

function switchDuelTab(tab) {
  _duelTab = tab;
  ['pending','my','recent'].forEach(function(t){
    var btn = document.getElementById('dtab' + t.charAt(0).toUpperCase() + t.slice(1));
    if (!btn) return;
    var active = t === tab;
    btn.style.background  = active ? 'rgba(255,140,66,.18)' : 'rgba(255,255,255,.05)';
    btn.style.borderColor = active ? 'rgba(255,140,66,.45)' : 'rgba(255,255,255,.1)';
    btn.style.color       = active ? '#ff8c42' : 'var(--tx3)';
    btn.style.fontWeight  = active ? '700' : '400';
  });
  loadDuelPanel();
}

function loadDuelPanel() {
  var container = document.getElementById('duelContainer');
  if (!container) return;
  var w = (walletState && walletState.address) || '';
  if (!w && _duelTab !== 'recent') {
    container.innerHTML = '<div style="color:var(--tx3);font-size:10px;text-align:center;padding:16px">Connect wallet</div>';
    return;
  }
  container.innerHTML = '<div style="color:var(--tx3);font-size:10px;text-align:center;padding:12px">Loading…</div>';

  var url;
  if (_duelTab === 'pending') url = '/api/duels/pending';
  else if (_duelTab === 'my')  url = '/api/duels/my?limit=20';
  else                          url = '/api/duels/recent?limit=20';

  fetch(url, _duelTab === 'recent' ? undefined : { headers: getAuthHeaders() }).then(function(r){ return r.json(); }).then(function(data) {
    if (!Array.isArray(data)) { container.innerHTML = '<div style="color:var(--mars);font-size:10px;padding:8px">Error loading duels</div>'; return; }
    if (!data.length) {
      var emptyMsg = _duelTab === 'pending' ? (t('duel_no_pending') || 'No incoming challenges') :
                     _duelTab === 'my'      ? (t('duel_no_history') || 'No duel history') :
                                              (t('duel_no_recent')  || 'No recent duels');
      container.innerHTML = '<div style="color:var(--tx3);font-size:10px;text-align:center;padding:12px">'+emptyMsg+'</div>';
      return;
    }
    container.innerHTML = data.map(function(d) {
      return renderDuelCard(d, w);
    }).join('');
  }).catch(function() {
    container.innerHTML = '<div style="color:var(--mars);font-size:10px;padding:8px">Failed to load</div>';
  });
}

function renderDuelCard(d, myWallet) {
  var isMine = d.challenger === myWallet.toLowerCase();
  var isDefender = d.defender === myWallet.toLowerCase();
  var cNick = _escHtml(d.challenger_nick || d.challenger.slice(0,10)+'…');
  var dNick = _escHtml(d.defender_nick   || d.defender.slice(0,10)+'…');
  var statusColor = { resolved:'#a0e8a0', pending:'#ffb74d', expired:'#555', declined:'#888', cancelled:'#555' }[d.status] || '#888';

  var resultStr = '';
  if (d.status === 'resolved') {
    if (!d.winner) resultStr = '🤝 DRAW';
    else if (d.winner === myWallet.toLowerCase()) resultStr = '🏆 YOU WON +'+Number(d.payout_gp).toFixed(0)+' GP';
    else resultStr = '💀 LOST −'+Number(d.wager_gp).toFixed(0)+' GP';
  }

  var scoreStr = (d.challenger_score != null)
    ? cNick+': '+d.challenger_score+' vs '+dNick+': '+d.defender_score : '';

  var actions = '';
  if (d.status === 'pending' && isDefender) {
    actions = '<div style="display:flex;gap:4px;margin-top:6px">'
      +'<button onclick="respondDuel('+d.id+',true)" style="flex:1;padding:5px;font-size:9px;font-family:var(--fn);font-weight:700;background:rgba(160,232,160,.18);border:1px solid rgba(160,232,160,.45);color:#a0e8a0;border-radius:5px;cursor:pointer" data-i18n="duel_accept_btn">⚔️ ACCEPT</button>'
      +'<button onclick="respondDuel('+d.id+',false)" style="flex:1;padding:5px;font-size:9px;font-family:var(--fn);background:rgba(255,80,30,.12);border:1px solid rgba(255,80,30,.3);color:var(--mars);border-radius:5px;cursor:pointer" data-i18n="duel_decline_btn">✕ DECLINE</button>'
      +'</div>';
  } else if (d.status === 'pending' && isMine) {
    var mins = Math.max(0, Math.ceil((new Date(d.expires_at) - Date.now()) / 60000));
    actions = '<div style="display:flex;gap:4px;margin-top:6px;align-items:center">'
      +'<span style="flex:1;font-size:9px;color:#888">Expires in '+mins+'m</span>'
      +'<button onclick="cancelMyDuel('+d.id+')" style="padding:4px 10px;font-size:9px;background:rgba(255,80,30,.12);border:1px solid rgba(255,80,30,.3);color:var(--mars);border-radius:5px;cursor:pointer" data-i18n="duel_cancel_btn">CANCEL</button>'
      +'</div>';
  }

  return '<div style="background:rgba(255,140,66,.04);border:1px solid rgba(255,140,66,.15);border-radius:8px;padding:10px;margin-bottom:6px">'
    +'<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:4px">'
      +'<div style="font-size:10px;color:#ff8c42;font-weight:700">'+cNick+' ⚔️ '+dNick+'</div>'
      +'<span style="font-size:9px;color:'+statusColor+';font-weight:700">'+d.status.toUpperCase()+'</span>'
    +'</div>'
    +'<div style="font-size:9px;color:var(--gold);margin-bottom:2px">💰 '+Number(d.wager_gp).toFixed(0)+' GP each → pot: '+Number(d.wager_gp*2).toFixed(0)+' GP</div>'
    +(scoreStr?'<div style="font-size:9px;color:#888">'+scoreStr+'</div>':'')
    +(resultStr?'<div style="font-size:10px;font-weight:700;margin-top:3px">'+resultStr+'</div>':'')
    +actions
    +'</div>';
}

function respondDuel(duelId, accept) {
  var w = walletState && walletState.address;
  if (!w) return;
  var endpoint = accept ? '/api/duels/accept' : '/api/duels/decline';
  var confirmMsg = accept ? (t('duel_accept_confirm') || 'Accept duel and match the wager?') : (t('duel_decline_confirm') || 'Decline this duel challenge?');
  gameConfirm({icon:'⚔️', title: accept ? 'ACCEPT DUEL' : 'DECLINE DUEL', body: confirmMsg, confirmText: accept ? 'ACCEPT' : 'DECLINE'})
    .then(function(ok) {
      if (!ok) return;
      return fetch(endpoint, {
        method: 'POST',
        headers: Object.assign({ 'Content-Type': 'application/json' }, getAuthHeaders()),
        body: JSON.stringify({ wallet: w, duelId: duelId })
      }).then(function(r){ return r.json(); }).then(function(d) {
        if (d.error) { showToast(d.error, 'error'); return; }
        if (accept) {
          var msg = d.winner
            ? (d.winner === w.toLowerCase() ? '🏆 YOU WON! +'+Number(d.payout_gp).toFixed(0)+' GP' : '💀 You lost the duel')
            : '🤝 Draw — partial refund';
          showToast(msg, d.winner === w.toLowerCase() ? 'success' : 'warning');
        } else {
          showToast(t('duel_declined_msg') || 'Duel declined', 'info');
        }
        loadDuelPanel();
        if (typeof updateBalanceDisplays === 'function') updateBalanceDisplays();
      });
    }).catch(function(e) { showToast(e.message || 'Failed', 'error'); });
}

function cancelMyDuel(duelId) {
  var w = walletState && walletState.address;
  if (!w) return;
  fetch('/api/duels/cancel', {
    method: 'POST',
    headers: Object.assign({ 'Content-Type': 'application/json' }, getAuthHeaders()),
    body: JSON.stringify({ wallet: w, duelId: duelId })
  }).then(function(r){ return r.json(); }).then(function(d) {
    if (d.error) { showToast(d.error, 'error'); return; }
    showToast(t('duel_cancelled_refund') || 'Duel cancelled. GP refunded.', 'success');
    loadDuelPanel();
    if (typeof updateBalanceDisplays === 'function') updateBalanceDisplays();
  }).catch(function(e) { showToast(e.message || 'Failed', 'error'); });
}

function openDuelModal(prefilledDefender) {
  var modal = document.getElementById('duelModal');
  if (!modal) return;
  document.getElementById('duelTargetInput').value = prefilledDefender || '';
  document.getElementById('duelWagerInput').value = '';
  document.getElementById('duelPotPreview').textContent = '';
  modal.style.display = 'flex';
  // Wire up wager preview
  var wagerInput = document.getElementById('duelWagerInput');
  wagerInput.oninput = function() {
    var v = parseFloat(wagerInput.value) || 0;
    var preview = document.getElementById('duelPotPreview');
    if (preview && v > 0) {
      var fee = (v * 2 * 0.05).toFixed(0);
      var payout = (v * 2 - v * 2 * 0.05).toFixed(0);
      preview.textContent = 'Pot: '+v*2+' GP → winner gets '+payout+' GP (5% fee: '+fee+' GP)';
    } else if (preview) {
      preview.textContent = '';
    }
  };
}

function closeDuelModal() {
  var modal = document.getElementById('duelModal');
  if (modal) modal.style.display = 'none';
}

function setDuelWager(amount) {
  var input = document.getElementById('duelWagerInput');
  if (input) { input.value = amount; input.oninput && input.oninput(); }
}

function submitDuelChallenge() {
  var w = walletState && walletState.address;
  if (!w) { gameAlert(t('connect_wallet_first') || 'Connect wallet first'); return; }
  var target = (document.getElementById('duelTargetInput').value || '').trim();
  var wager  = parseFloat(document.getElementById('duelWagerInput').value);
  if (!target) { gameAlert(t('duel_enter_target') || 'Enter opponent wallet or nickname'); return; }
  if (!wager || wager <= 0) { gameAlert(t('duel_enter_wager') || 'Enter a valid wager'); return; }

  var btn = document.querySelector('#duelModal button[onclick="submitDuelChallenge()"]');
  if (btn) { btn.disabled = true; btn.textContent = '…'; }

  fetch('/api/duels/challenge', {
    method: 'POST',
    headers: Object.assign({ 'Content-Type': 'application/json' }, getAuthHeaders()),
    body: JSON.stringify({ wallet: w, defender: target, wagerGp: wager })
  }).then(function(r){ return r.json(); }).then(function(d) {
    if (btn) { btn.disabled = false; btn.textContent = '⚔️ SEND CHALLENGE'; }
    if (d.error) { gameAlert(d.error); return; }
    showToast(t('duel_challenge_sent') || '⚔️ Challenge sent! Opponent has 30 min to accept.', 'success');
    closeDuelModal();
    loadDuelPanel();
    if (typeof updateBalanceDisplays === 'function') updateBalanceDisplays();
  }).catch(function(e) {
    if (btn) { btn.disabled = false; btn.textContent = '⚔️ SEND CHALLENGE'; }
    gameAlert(e.message || 'Failed to send challenge');
  });
}

// ── Territory Shield ──────────────────────────────────────────────────────────

var _shieldCatalog = null;

function toggleShield() {
  var panel = document.getElementById('shieldPanel');
  var tog   = document.getElementById('shieldToggle');
  if (!panel) return;
  var open = panel.style.display !== 'none';
  panel.style.display = open ? 'none' : '';
  if (tog) tog.textContent = open ? '▼' : '▲';
  if (!open) loadShieldPanel();
}

function loadShieldPanel() {
  var el = document.getElementById('shieldContent');
  if (!el) return;
  if (!walletState.address) {
    el.innerHTML = '<div style="color:var(--tx3);font-size:10px;text-align:center;padding:12px">Connect wallet to manage shields</div>';
    return;
  }
  el.innerHTML = '<div style="text-align:center;color:var(--tx3);font-size:10px;padding:12px">Loading...</div>';
  Promise.all([
    fetch('/api/shield/catalog').then(function(r){ return r.json(); }),
    fetch('/api/shield/my-shields', { headers: getAuthHeaders() }).then(function(r){ return r.json(); })
  ]).then(function(results) {
    _shieldCatalog = results[0];
    renderShieldPanel(_shieldCatalog, results[1].shields || []);
  }).catch(function() {
    el.innerHTML = '<div style="color:var(--mars);font-size:10px;text-align:center;padding:12px">Failed to load</div>';
  });
}

function renderShieldPanel(catalog, shields) {
  var el = document.getElementById('shieldContent');
  if (!el) return;
  var now = Date.now();
  var active = shields.filter(function(s){ return s.is_active && new Date(s.expires_at) > now; });

  var html = '<button onclick="openShieldModal()" style="width:100%;margin-bottom:10px;padding:9px;border-radius:8px;background:linear-gradient(135deg,rgba(92,187,255,.14),rgba(92,187,255,.04));border:1px solid rgba(92,187,255,.35);color:#5cbbff;font-family:var(--fn);font-size:10px;font-weight:700;cursor:pointer;letter-spacing:.5px">🛡️ <span data-i18n="shield_activate_btn">ACTIVATE SHIELD</span></button>';

  if (active.length === 0) {
    html += '<div style="text-align:center;color:var(--tx3);font-size:10px;padding:8px 0">No active shields</div>';
  } else {
    html += '<div style="font-size:9px;color:var(--tx3);margin-bottom:6px;letter-spacing:.5px">ACTIVE SHIELDS</div>';
    html += '<div style="display:flex;flex-direction:column;gap:6px">';
    active.forEach(function(s) {
      var ms = new Date(s.expires_at) - now;
      var hrs = Math.floor(ms / 3600000);
      var mins = Math.floor((ms % 3600000) / 60000);
      var timeStr = hrs > 0 ? hrs + 'h ' + mins + 'm' : mins + 'm';
      var claimName = s.custom_name || ('Territory ' + s.claim_id);
      var pct = Math.min(100, (ms / (s.duration_h * 3600000)) * 100);
      html += '<div style="background:rgba(92,187,255,.05);border:1px solid rgba(92,187,255,.2);border-radius:8px;padding:8px 10px">';
      html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">';
      html += '<span style="font-size:10px;font-weight:700;color:var(--tx)">🛡️ ' + escHtml(claimName) + '</span>';
      html += '<span style="font-size:10px;color:#5cbbff;font-weight:700">' + timeStr + '</span>';
      html += '</div>';
      html += '<div style="height:4px;background:rgba(255,255,255,.08);border-radius:2px;overflow:hidden">';
      html += '<div style="height:100%;width:' + pct.toFixed(0) + '%;background:linear-gradient(90deg,#5cbbff,#a0c8ff);border-radius:2px;transition:.5s"></div>';
      html += '</div>';
      html += '</div>';
    });
    html += '</div>';
  }

  el.innerHTML = html;
}

async function openShieldModal() {
  if (!walletState.address) { showToast('Connect wallet first', 'error'); return; }
  // 영토 패널 🛡 버튼 등에서 SHIELD 패널을 먼저 안 연 채 직접 호출하면 _shieldCatalog 가 null 이라
  // "Shield system is disabled" 오인 토스트만 떴음. catalog 가 없으면 즉시 로드한다. [v7.122]
  if (!_shieldCatalog) {
    try { var _scr = await fetch('/api/shield/catalog'); if (_scr.ok) _shieldCatalog = await _scr.json(); } catch (_) {}
  }
  if (!_shieldCatalog || !_shieldCatalog.enabled) { showToast('Shield system is disabled', 'error'); return; }
  var grps = _myTerritoryGroups(walletState.address);
  if (!grps.length) { showToast('You have no territories to shield', 'error'); return; }

  gamePicker({ title: 'SELECT TERRITORY TO SHIELD', items: grps.map(function(g) {
    return { value: g.primaryId, label: g.label };
  }) }).then(function(claimId) {
    if (!claimId) return;
    var items = (_shieldCatalog.options || []).map(function(opt) {
      return { value: opt.hours, label: '🛡️ ' + opt.label + ' — ' + opt.cost + ' GP' };
    });
    gamePicker({ title: 'SELECT SHIELD DURATION', items: items }).then(function(hours) {
      if (!hours) return;
      var opt = (_shieldCatalog.options || []).find(function(o){ return o.hours == hours; });
      var claimName = (myClaims.find(function(c){ return c.id == claimId; }) || {}).custom_name || 'Territory ' + claimId;
      gameConfirm({
        icon: '🛡️', title: 'ACTIVATE SHIELD',
        body: LANG==='ko'? '"' + escHtml(claimName) + '" 을 ' + (opt ? opt.label : hours + 'h') + ' 동안 보호합니다.' : LANG==='ja'? '"' + escHtml(claimName) + '" を ' + (opt ? opt.label : hours + 'h') + ' 間保護します。' : LANG==='zh'? '"' + escHtml(claimName) + '" 将被保护 ' + (opt ? opt.label : hours + 'h') + '。' : '"' + escHtml(claimName) + '" will be shielded for ' + (opt ? opt.label : hours + 'h') + '.',
        info: [{ k: '💰 '+(LANG==='ko'?'GP 비용':LANG==='ja'?'GPコスト':LANG==='zh'?'GP费用':'GP Cost'), v: (opt ? opt.cost : '?') + ' GP', ok: true }],
        confirmText: LANG==='ko'?'보호막 활성화':LANG==='ja'?'シールド起動':LANG==='zh'?'激活护盾':'Activate Shield'
      }).then(function(confirmed) {
          if (!confirmed) return;
          return fetch('/api/shield/activate', {
            method: 'POST',
            headers: Object.assign({ 'Content-Type': 'application/json' }, getAuthHeaders()),
            body: JSON.stringify({ wallet: walletState.address, claimId: parseInt(claimId), durationH: parseInt(hours) })
          }).then(function(r){ return r.json(); }).then(function(d) {
            if (d.error) { showToast(d.error, 'error'); return; }
            showToast('🛡️ Shield activated! Territory protected for ' + (opt ? opt.label : hours + 'h'), 'success');
            loadShieldPanel();
            loadWalletData();
          });
        }).catch(function(e) { showToast(e.message || 'Failed', 'error'); });
    });
  });
}

// ── Pixel Art Contests ────────────────────────────────────────────────────────

var _contestViewId = null; // currently viewing entries for this contest

function loadContestSection() {
  var container = document.getElementById('contestContainer');
  if (!container) return;
  var w = (walletState && walletState.address) || '';
  container.innerHTML = '<div style="color:var(--tx3);font-size:10px;text-align:center;padding:12px">Loading…</div>';

  if (_contestViewId) {
    _loadContestEntries(_contestViewId, w);
    return;
  }

  fetch('/api/contests').then(function(r){return r.json();}).then(function(contests) {
    if (!Array.isArray(contests) || !contests.length) {
      container.innerHTML = '<div style="color:var(--tx3);font-size:10px;text-align:center;padding:12px" data-i18n="contest_none">No contests yet. Check back soon!</div>';
      return;
    }
    container.innerHTML = contests.map(function(c) {
      var statusColor = {upcoming:'#888',open:'#ffb74d',voting:'#81d4fa',finished:'#a0e8a0',cancelled:'#555'}[c.status]||'#888';
      var prizeStr = Number(c.prize_pool_gp).toFixed(0)+' GP';
      var entryFeeStr = Number(c.entry_fee_gp) > 0 ? Number(c.entry_fee_gp).toFixed(0)+' GP' : 'Free';
      var voteFeeStr  = Number(c.vote_fee_gp)  > 0 ? Number(c.vote_fee_gp).toFixed(0)+' GP'  : 'Free';
      var canSubmit = c.status === 'open';
      var canVote   = c.status === 'voting';
      return '<div style="background:rgba(206,147,216,.04);border:1px solid rgba(206,147,216,.12);border-radius:8px;padding:10px;margin-bottom:8px">'
        +'<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:4px">'
          +'<div style="font-size:10px;font-weight:700;color:#ce93d8">🎨 '+_escHtml(c.title)+'</div>'
          +'<span style="font-size:9px;color:'+statusColor+';font-weight:700">'+c.status.toUpperCase()+'</span>'
        +'</div>'
        +(c.theme?'<div style="font-size:9px;color:#888;margin-bottom:3px">Theme: '+_escHtml(c.theme)+'</div>':'')
        +'<div style="display:flex;gap:10px;font-size:9px;color:var(--tx3);margin-bottom:5px">'
          +'<span>🏆 '+prizeStr+' pool</span>'
          +'<span>📝 Entry: '+entryFeeStr+'</span>'
          +'<span>🗳️ Vote: '+voteFeeStr+'</span>'
        +'</div>'
        +'<div style="display:flex;gap:4px">'
          +'<button onclick="viewContestEntries('+c.id+')" style="flex:1;padding:4px;font-size:9px;font-family:var(--fn);background:rgba(206,147,216,.12);border:1px solid rgba(206,147,216,.3);color:#ce93d8;border-radius:5px;cursor:pointer" data-i18n="contest_view_btn">👁 VIEW ENTRIES</button>'
          +(canSubmit && w ?'<button onclick="openContestSubmitModal('+c.id+','+c.entry_fee_gp+')" style="flex:1;padding:4px;font-size:9px;font-family:var(--fn);font-weight:700;background:rgba(206,147,216,.2);border:1px solid rgba(206,147,216,.5);color:#ce93d8;border-radius:5px;cursor:pointer" data-i18n="contest_submit_btn">✏️ SUBMIT</button>':'')
        +'</div>'
        +'</div>';
    }).join('');
  }).catch(function() {
    container.innerHTML = '<div style="color:var(--mars);font-size:10px;padding:8px">Failed to load contests</div>';
  });
}

function viewContestEntries(contestId) {
  _contestViewId = contestId;
  var w = (walletState && walletState.address) || '';
  _loadContestEntries(contestId, w);
}

function _loadContestEntries(contestId, wallet) {
  var container = document.getElementById('contestContainer');
  if (!container) return;
  container.innerHTML = '<div style="color:var(--tx3);font-size:10px;text-align:center;padding:12px">Loading…</div>';
  Promise.all([
    fetch('/api/contests/'+contestId).then(function(r){return r.json();}),
    fetch('/api/contests/'+contestId+'/entries', { headers: getAuthHeaders() }).then(function(r){return r.json();})
  ]).then(function(res) {
    var contest = res[0] || {};
    var entries = Array.isArray(res[1]) ? res[1] : [];
    var statusColor = {upcoming:'#888',open:'#ffb74d',voting:'#81d4fa',finished:'#a0e8a0'}[contest.status]||'#888';
    var iVotedInContest = entries.some(function(e){ return e.i_voted_in_contest; });

    var backBtn = '<button onclick="_contestViewId=null;loadContestSection()" style="font-size:9px;padding:3px 8px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);color:var(--tx3);border-radius:4px;cursor:pointer;margin-bottom:8px">← Back</button>';
    var header = '<div style="font-size:10px;font-weight:700;color:#ce93d8;margin-bottom:4px">🎨 '+_escHtml(contest.title||'')+'</div>'
      +'<div style="font-size:9px;color:'+statusColor+';margin-bottom:8px">'+((contest.status||'').toUpperCase())+' · '+entries.length+' entries · 🏆 '+Number(contest.prize_pool_gp||0).toFixed(0)+' GP pool</div>';

    var entriesHtml = entries.length ? entries.map(function(e, idx) {
      var rank = idx+1;
      var rankBadge = e.rank ? ['🥇','🥈','🥉'][e.rank-1]||('#'+e.rank) : (rank<=3?['🥇','🥈','🥉'][rank-1]:'');
      var canVote = contest.status === 'voting' && wallet && e.wallet !== wallet.toLowerCase() && !iVotedInContest;
      return '<div style="background:rgba(206,147,216,.04);border:1px solid rgba(206,147,216,'+(rank===1?'.25':'.08')+');border-radius:8px;padding:8px;margin-bottom:5px">'
        +'<div style="display:flex;justify-content:space-between;align-items:flex-start">'
          +'<div style="font-size:10px;font-weight:700;color:#ce93d8">'+(rankBadge?' '+rankBadge+' ':'')+_escHtml(e.title||'Untitled')+'</div>'
          +'<span style="font-size:9px;color:#888">'+e.vote_count+' votes</span>'
        +'</div>'
        +'<div style="font-size:9px;color:var(--tx3)">by '+(e.submitter_nick||e.wallet.slice(0,10)+'…')+'</div>'
        +(e.description?'<div style="font-size:9px;color:#888;margin:3px 0">'+_escHtml(e.description)+'</div>':'')
        +(e.image_url?'<a href="'+e.image_url+'" target="_blank" rel="noopener" style="font-size:9px;color:#ce93d8">View Image →</a>':'')
        +(e.prize_paid>0?'<div style="font-size:9px;color:var(--gold);margin-top:3px">Prize: '+e.prize_paid+' GP</div>':'')
        +(canVote?'<button onclick="voteForEntry('+e.id+')" style="margin-top:5px;width:100%;padding:4px;font-size:9px;font-family:var(--fn);font-weight:700;background:rgba(206,147,216,.18);border:1px solid rgba(206,147,216,.45);color:#ce93d8;border-radius:5px;cursor:pointer" data-i18n="contest_vote_btn">🗳️ VOTE</button>':'')
        +'</div>';
    }).join('') : '<div style="color:var(--tx3);font-size:10px;text-align:center;padding:12px">No entries yet</div>';

    container.innerHTML = backBtn + header + entriesHtml;
  }).catch(function() {
    container.innerHTML = '<div style="color:var(--mars);font-size:10px;padding:8px">Failed to load entries</div>';
  });
}

async function openContestSubmitModal(contestId, entryFeeGp) {
  var w = walletState && walletState.address;
  if (!w) { gameAlert(t('connect_wallet_first')||'Connect wallet first'); return; }
  var feeMsg = Number(entryFeeGp) > 0 ? ' · Entry fee: '+entryFeeGp+' GP' : '';
  var title = await gameInput({title:LANG==='ko'?'작품 제출':LANG==='ja'?'作品提出':LANG==='zh'?'提交作品':'Submit Entry',label:t('contest_title_prompt')||(LANG==='ko'?'작품 제목':LANG==='ja'?'作品タイトル':LANG==='zh'?'作品标题':'Title'),placeholder:'My Artwork',maxLength:80});
  if (!title || !title.trim()) return;
  var imageUrl = await gameInput({title:'IMAGE URL',label:t('contest_image_prompt')||(LANG==='ko'?'이미지 URL (선택)':LANG==='ja'?'画像URL（任意）':LANG==='zh'?'图片URL（可选）':'Image URL (optional)'),placeholder:'https://',maxLength:300});
  var desc = await gameInput({title:LANG==='ko'?'설명':LANG==='ja'?'説明':LANG==='zh'?'描述':'Description',label:t('contest_desc_prompt')||(LANG==='ko'?'간단한 설명 (선택)':LANG==='ja'?'簡単な説明（任意）':LANG==='zh'?'简短描述（可选）':'Brief description (optional)'),placeholder:'',maxLength:200});

  var ok = await gameConfirm({icon:'🎨',title:LANG==='ko'?'작품 제출':LANG==='ja'?'作品提出':LANG==='zh'?'提交作品':'Submit Entry',body:(LANG==='ko'?'제목: ':LANG==='ja'?'タイトル: ':LANG==='zh'?'标题: ':'Title: ')+'<b>'+escapeHTML(title.trim())+'</b>'+feeMsg,confirmText:LANG==='ko'?'제출':LANG==='ja'?'提出':LANG==='zh'?'提交':'Submit'});
  Promise.resolve(ok).then(function(ok) {
      if (!ok) return;
      return fetch('/api/contests/submit', {
        method: 'POST',
        headers: Object.assign({ 'Content-Type': 'application/json' }, getAuthHeaders()),
        body: JSON.stringify({ wallet: w, contestId: contestId, title: title.trim(),
          description: desc || null, imageUrl: imageUrl || null })
      }).then(function(r){ return r.json(); }).then(function(d) {
        if (d.error) { showToast(d.error, 'error'); return; }
        showToast('🎨 Entry submitted!', 'success');
        loadContestSection();
        if (typeof updateBalanceDisplays === 'function') updateBalanceDisplays();
      });
    });
}

function voteForEntry(entryId) {
  var w = walletState && walletState.address;
  if (!w) { gameAlert(t('connect_wallet_first')||'Connect wallet first'); return; }
  fetch('/api/contests/vote', {
    method: 'POST',
    headers: Object.assign({ 'Content-Type': 'application/json' }, getAuthHeaders()),
    body: JSON.stringify({ wallet: w, entryId: entryId })
  }).then(function(r){ return r.json(); }).then(function(d) {
    if (d.error) { showToast(d.error, 'error'); return; }
    showToast('🗳️ Vote cast!', 'success');
    if (_contestViewId) _loadContestEntries(_contestViewId, w);
  }).catch(function(e){ showToast(e.message, 'error'); });
}

// ── Territory Rental ──────────────────────────────────────────────────────────

var _rentalPanelOpen = false;
var _rentalTab = 'browse'; // 'browse' | 'my'

function toggleRentalPanel() {
  var panel = document.getElementById('rentalPanel');
  var tog   = document.getElementById('rentalToggle');
  if (!panel) return;
  _rentalPanelOpen = !_rentalPanelOpen;
  panel.style.display = _rentalPanelOpen ? 'block' : 'none';
  if (tog) tog.textContent = _rentalPanelOpen ? '▲' : '▼';
  if (_rentalPanelOpen) loadRentalPanel();
}

function loadRentalPanel() {
  var content = document.getElementById('rentalContent');
  if (!content) return;
  var w = (walletState && walletState.address) || '';

  Promise.all([
    fetch('/api/rental/listings').then(function(r){return r.json();}).catch(function(){return [];}),
    w ? fetch('/api/rental/my', { headers: getAuthHeaders() }).then(function(r){return r.json();}).catch(function(){return [];}) : Promise.resolve([]),
    fetch('/api/rental/settings').then(function(r){return r.json();}).catch(function(){return {};})
  ]).then(function(results) {
    var listings = Array.isArray(results[0]) ? results[0] : [];
    var myRentals = Array.isArray(results[1]) ? results[1] : [];
    var cfg = results[2] || {};
    renderRentalPanel(content, listings, myRentals, cfg, w);
  }).catch(function() {
    content.innerHTML = '<div style="color:var(--mars);font-size:10px;padding:8px">Failed to load</div>';
  });
}

function renderRentalPanel(content, listings, myRentals, cfg, wallet) {
  var tabBtns = '<div style="display:flex;gap:4px;margin-bottom:8px">'
    +'<button onclick="switchRentalTab(\'browse\')" id="rntabBrowse" style="font-size:8px;padding:3px 8px;border-radius:4px;background:rgba(129,212,250,.18);border:1px solid rgba(129,212,250,.45);color:#81d4fa;cursor:pointer;font-weight:700" data-i18n="rental_tab_browse">BROWSE</button>'
    +'<button onclick="switchRentalTab(\'my\')"     id="rntabMy"    style="font-size:8px;padding:3px 8px;border-radius:4px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);color:var(--tx3);cursor:pointer" data-i18n="rental_tab_my">MY RENTALS</button>'
    +'<button onclick="openListForRentModal()" style="margin-left:auto;font-size:8px;padding:3px 10px;border-radius:4px;background:rgba(129,212,250,.15);border:1px solid rgba(129,212,250,.35);color:#81d4fa;cursor:pointer;font-weight:700" data-i18n="rental_list_btn">+ LIST TERRITORY</button>'
    +'</div>';

  var browseHtml = listings.length
    ? listings.map(function(l){
        var hoursLeft = l.status==='rented' && l.expires_at
          ? Math.max(0, Math.ceil((new Date(l.expires_at)-Date.now())/3600000))+'h' : '—';
        var canRent = wallet && l.owner !== wallet.toLowerCase() && l.status==='listed';
        return '<div style="background:rgba(129,212,250,.04);border:1px solid rgba(129,212,250,.12);border-radius:8px;padding:10px;margin-bottom:6px">'
          +'<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:4px">'
            +'<div style="font-size:10px;font-weight:700;color:#81d4fa">🏘️ Claim #'+l.claim_id+' ('+l.pixel_count+' px)</div>'
            +'<span style="font-size:9px;color:'+(l.status==='listed'?'#ffb74d':'#a0e8a0')+';font-weight:700">'+l.status.toUpperCase()+'</span>'
          +'</div>'
          +'<div style="font-size:9px;color:var(--tx3);margin-bottom:4px">Owner: '+(l.owner_nick||l.owner.slice(0,10)+'…')+'</div>'
          +'<div style="font-size:9px;color:var(--gold);margin-bottom:4px">💰 '+l.gp_per_period+' GP/'+l.period_hours+'h · +'+l.boost_pct+'% mining boost</div>'
          +(l.status==='rented'?'<div style="font-size:9px;color:#888">Rented · '+hoursLeft+' left</div>':'')
          +(canRent
            ?'<button onclick="openRentModal('+l.id+','+l.gp_per_period+','+l.period_hours+')" style="width:100%;margin-top:6px;padding:5px;font-size:9px;font-family:var(--fn);font-weight:700;background:rgba(129,212,250,.18);border:1px solid rgba(129,212,250,.45);color:#81d4fa;border-radius:5px;cursor:pointer" data-i18n="rental_rent_btn">🏘️ RENT</button>'
            :'')
          +'</div>';
      }).join('')
    : '<div style="color:var(--tx3);font-size:10px;text-align:center;padding:12px" data-i18n="rental_no_listings">No territories listed for rent</div>';

  var myHtml = myRentals.length
    ? myRentals.map(function(r){
        var isOwner = r.owner === (wallet||'').toLowerCase();
        var canCancel = isOwner && r.status === 'listed';
        var statusColor = {listed:'#ffb74d', rented:'#a0e8a0', expired:'#555', cancelled:'#888'}[r.status]||'#888';
        return '<div style="background:rgba(129,212,250,.04);border:1px solid rgba(129,212,250,.1);border-radius:8px;padding:10px;margin-bottom:6px">'
          +'<div style="display:flex;justify-content:space-between;margin-bottom:4px">'
            +'<span style="font-size:10px;font-weight:700;color:#81d4fa">Claim #'+r.claim_id+'</span>'
            +'<span style="font-size:9px;color:'+statusColor+';font-weight:700">'+r.status.toUpperCase()+'</span>'
          +'</div>'
          +'<div style="font-size:9px;color:#888">'+(isOwner?'You own':'You rented')+' · '+r.gp_per_period+' GP/'+r.period_hours+'h</div>'
          +(r.expires_at?'<div style="font-size:9px;color:var(--tx3)">Expires: '+new Date(r.expires_at).toLocaleString()+'</div>':'')
          +(canCancel
            ?'<button onclick="cancelRentalListing('+r.id+')" style="margin-top:6px;padding:4px 10px;font-size:9px;background:rgba(255,80,30,.12);border:1px solid rgba(255,80,30,.3);color:var(--mars);border-radius:5px;cursor:pointer" data-i18n="rental_cancel_btn">CANCEL LISTING</button>'
            :'')
          +'</div>';
      }).join('')
    : '<div style="color:var(--tx3);font-size:10px;text-align:center;padding:12px" data-i18n="rental_no_my">No rental activity yet</div>';

  content.innerHTML = tabBtns
    +'<div id="rentalBrowseView">'+browseHtml+'</div>'
    +'<div id="rentalMyView" style="display:none">'+myHtml+'</div>';
}

function switchRentalTab(tab) {
  _rentalTab = tab;
  var browseEl = document.getElementById('rentalBrowseView');
  var myEl = document.getElementById('rentalMyView');
  ['browse','my'].forEach(function(t){
    var btn = document.getElementById('rntab'+t.charAt(0).toUpperCase()+t.slice(1));
    if (!btn) return;
    var active = t === tab;
    btn.style.background  = active ? 'rgba(129,212,250,.18)' : 'rgba(255,255,255,.05)';
    btn.style.borderColor = active ? 'rgba(129,212,250,.45)' : 'rgba(255,255,255,.1)';
    btn.style.color       = active ? '#81d4fa' : 'var(--tx3)';
    btn.style.fontWeight  = active ? '700' : '400';
  });
  if (browseEl) browseEl.style.display = tab==='browse' ? 'block' : 'none';
  if (myEl)     myEl.style.display     = tab==='my'     ? 'block' : 'none';
}

var _rentModalId = null;
function openRentModal(rentalId, gpPerPeriod, periodHours) {
  _rentModalId = rentalId;
  var w = walletState && walletState.address;
  if (!w) { gameAlert(t('connect_wallet_first')||'Connect wallet first'); return; }

  gamePicker({
    title: '🏘️ How many periods to rent?',
    items: [1,3,7,14,30].map(function(n){
      return { label: n+' period(s) = '+n*periodHours+'h — '+(n*gpPerPeriod)+' GP', value: n };
    })
  }).then(function(periods) {
    if (!periods) return;
    var totalGp = periods * gpPerPeriod;
    gameConfirm({icon:'🏘️', title:'RENT TERRITORY',
      body:'Rent for '+periods+' × '+periodHours+'h<br>Total: '+totalGp+' GP · +mining boost during rental', confirmText:'RENT'})
      .then(function(ok) {
        if (!ok) return;
        return fetch('/api/rental/rent', {
          method: 'POST',
          headers: Object.assign({ 'Content-Type': 'application/json' }, getAuthHeaders()),
          body: JSON.stringify({ wallet: w, rentalId: rentalId, periods: periods })
        }).then(function(r){ return r.json(); }).then(function(d) {
          if (d.error) { showToast(d.error, 'error'); return; }
          showToast('🏘️ Territory rented for '+d.periods+' period(s)! Expires: '+new Date(d.expiresAt).toLocaleString(), 'success');
          loadRentalPanel();
          if (typeof updateBalanceDisplays==='function') updateBalanceDisplays();
        });
      });
  });
}

function openListForRentModal() {
  var w = walletState && walletState.address;
  if (!w) { gameAlert(t('connect_wallet_first')||'Connect wallet first'); return; }
  // Reuse territory picker pattern
  fetch('/api/user/my-territories', { headers: getAuthHeaders() })
    .then(function(r){return r.json();}).then(function(data){
      // API returns { territories: [...] } wrapper
      var territories = (data && data.territories) ? data.territories : (Array.isArray(data) ? data : []);
      if (!territories || !territories.length) {
        gameAlert(t('rental_no_territories')||'You have no territories to list'); return;
      }
      gamePicker({
        title: '🏘️ Select territory to list',
        items: territories.map(function(c){
          var label = (c.custom_name || ('Territory ' + c.id)) + ' (' + (c.pixel_count || 1) + ' px)';
          return { label: label, value: c.id };
        })
      }).then(function(claimId){
        if (!claimId) return;
        return gamePicker({
          title: '⏱️ Period length',
          items: [{label:'6 hours',value:6},{label:'12 hours',value:12},{label:'24 hours',value:24},{label:'48 hours',value:48},{label:'72 hours',value:72}]
        }).then(function(periodHours){
          if (!periodHours) return;
          return gameInput({title:LANG==='ko'?'렌탈 요금':LANG==='ja'?'レンタル料金':LANG==='zh'?'租赁费用':'Rental Fee',label:t('rental_gp_prompt')||(LANG==='ko'?'GP / '+periodHours+'h 기간 (예: 50)':LANG==='ja'?'GP / '+periodHours+'h 期間 (例: 50)':LANG==='zh'?'GP / '+periodHours+'h 周期（例：50）':'GP / '+periodHours+'h period (e.g. 50)'),placeholder:'50',maxLength:10}).then(function(gpStr){
          if (!gpStr) return;
          return Promise.resolve().then(function(){
            var gp = parseFloat(gpStr);
            if (!gp || gp <= 0) { gameAlert('Invalid GP amount'); return; }
            return fetch('/api/rental/list', {
              method: 'POST',
              headers: Object.assign({ 'Content-Type': 'application/json' }, getAuthHeaders()),
              body: JSON.stringify({ wallet: w, claimId: claimId, gpPerPeriod: gp, periodHours: periodHours })
            }).then(function(r){return r.json();}).then(function(d){
              if (d.error) { showToast(srvErr(d.error),'error'); return; }
              showToast('🏘️ Territory listed for rent!','success');
              loadRentalPanel();
            });
          });
          }); // gameInput
        });
      });
    }).catch(function(){ gameAlert('Failed to load territories'); });
}

function cancelRentalListing(rentalId) {
  var w = walletState && walletState.address;
  if (!w) return;
  fetch('/api/rental/cancel', {
    method: 'POST',
    headers: Object.assign({ 'Content-Type': 'application/json' }, getAuthHeaders()),
    body: JSON.stringify({ wallet: w, rentalId: rentalId })
  }).then(function(r){return r.json();}).then(function(d){
    if (d.error) { showToast(srvErr(d.error),'error'); return; }
    showToast(t('rental_cancelled')||'Listing cancelled','success');
    loadRentalPanel();
  }).catch(function(e){ showToast(e.message,'error'); });
}

// ── Expedition System (Migration 122) ────────────────────────────────────────

var _expeditionInfo = null;
var _expSelectedType = 'salvage';
var _expSelectedDur  = 1;
var _expActiveId     = null;

function toggleExpeditionPanel() {
  var panel = document.getElementById('expeditionPanel');
  var tog   = document.getElementById('expeditionToggle');
  if (!panel) return;
  var open = panel.style.display !== 'none';
  panel.style.display = open ? 'none' : '';
  if (tog) tog.textContent = open ? '▼' : '▲';
  if (!open) loadExpeditionPanel();
}

function loadExpeditionPanel() {
  var w = walletState && walletState.address;
  if (!w) return;

  // Load expedition info (types, costs)
  _engagementRead('expedition-info', '/api/expeditions/info', false).then(function(info){
    if (!info) return;
    _expeditionInfo = info;
    renderExpeditionTypes(info);
    renderExpeditionDurations(info);
    updateExpeditionCostPreview();
  }).catch(function(){});

  // Load player's territories
  var select = document.getElementById('expClaimSelect');
  if (select) {
    select.innerHTML = '<option value="">Loading…</option>';
    _engagementRead('expedition-claims', '/api/claims/my', true)
      .then(function(claims){
        if (!claims) {
          select.innerHTML = '<option value="">Refresh cooling down</option>';
          return;
        }
        if (!Array.isArray(claims) || !claims.length) {
          select.innerHTML = '<option value="">No territories owned</option>';
          return;
        }
        select.innerHTML = claims.map(function(c) {
          return '<option value="'+c.id+'">'+(c.name||('Territory #'+c.id))+' ('+c.pixel_count+' px)</option>';
        }).join('');
      }).catch(function(){ select.innerHTML = '<option value="">Error loading territories</option>'; });
  }

  // Load active expedition
  _engagementRead('expedition-active', '/api/expeditions/my', true)
    .then(function(exps){
      if (!exps) return;
      var active = (exps||[]).find(function(e){ return e.status === 'active'; });
      var activeEl = document.getElementById('expeditionActive');
      var launchEl = document.getElementById('expeditionLauncher');
      if (active) {
        _expActiveId = active.id;
        document.getElementById('expActiveIcon').textContent = getExpIcon(active.expedition_type);
        document.getElementById('expActiveLabel').textContent = getExpLabel(active.expedition_type) + ' · ' + active.duration_h + 'h';
        document.getElementById('expActiveReturns').textContent = new Date(active.returns_at).toLocaleString();
        if (activeEl) activeEl.style.display = '';
        if (launchEl) launchEl.style.opacity = '0.4';
      } else {
        _expActiveId = null;
        if (activeEl) activeEl.style.display = 'none';
        if (launchEl) launchEl.style.opacity = '1';
      }
    }).catch(function(){});
}

function getExpIcon(type) {
  return {salvage:'🔍',survey:'📡',raid:'⚔️',deep_dive:'🚀'}[type] || '🚀';
}
function getExpLabel(type) {
  return {salvage:'Salvage Run',survey:'Resource Survey',raid:'Border Raid',deep_dive:'Deep Space Dive'}[type] || type;
}

function renderExpeditionTypes(info) {
  var el = document.getElementById('expTypeButtons');
  if (!el || !info) return;
  var types = info.types || {};
  el.innerHTML = Object.keys(types).map(function(key) {
    var tp = types[key];
    var isActive = key === _expSelectedType;
    return '<button onclick="selectExpType(\''+key+'\')" id="expType_'+key+'" style="font-size:9px;padding:5px 8px;border-radius:5px;'
      +(isActive?'background:rgba(128,222,234,.2);border:1px solid rgba(128,222,234,.5);color:#80deea;font-weight:700;'
               :'background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1);color:var(--tx3);')
      +'cursor:pointer;font-family:var(--fn)">'
      + tp.icon + ' ' + tp.label
      + '</button>';
  }).join('');
}

function renderExpeditionDurations(info) {
  var el = document.getElementById('expDurationButtons');
  if (!el || !info) return;
  var durs = info.durations || [1, 3, 6, 12, 24];
  el.innerHTML = durs.map(function(d) {
    var isActive = d === _expSelectedDur;
    return '<button onclick="selectExpDur('+d+')" id="expDur_'+d+'" style="font-size:9px;padding:4px 8px;border-radius:5px;'
      +(isActive?'background:rgba(128,222,234,.2);border:1px solid rgba(128,222,234,.5);color:#80deea;font-weight:700;'
               :'background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1);color:var(--tx3);')
      +'cursor:pointer;font-family:var(--fn)">'+d+'h</button>';
  }).join('');
}

function selectExpType(type) {
  _expSelectedType = type;
  if (_expeditionInfo) {
    renderExpeditionTypes(_expeditionInfo);
    updateExpeditionCostPreview();
  }
}

function selectExpDur(dur) {
  _expSelectedDur = dur;
  if (_expeditionInfo) {
    renderExpeditionDurations(_expeditionInfo);
    updateExpeditionCostPreview();
  }
}

function updateExpeditionCostPreview() {
  var el = document.getElementById('expCostPreview');
  if (!el || !_expeditionInfo) return;
  var costs = (_expeditionInfo.costs || {})[_expSelectedType] || [];
  var entry = costs.find(function(c) { return c.hours === _expSelectedDur; });
  el.textContent = entry ? entry.cost + ' GP' : '—';
}

function launchExpeditionAction() {
  var w = walletState && walletState.address;
  if (!w) { showToast(t('err_connect_wallet')||'Connect wallet first','error'); return; }
  if (_expActiveId) { showToast('You already have an active expedition!','error'); return; }
  var select = document.getElementById('expClaimSelect');
  var claimId = select && select.value;
  if (!claimId) { showToast('Select a territory first','error'); return; }
  var costs = (_expeditionInfo && _expeditionInfo.costs || {})[_expSelectedType] || [];
  var entry = costs.find(function(c){ return c.hours === _expSelectedDur; });
  var cost = entry ? entry.cost : '?';
  gameConfirm({ title: t('expedition_launch_confirm')||'Launch Expedition?',
    body: getExpIcon(_expSelectedType) + ' <b>' + getExpLabel(_expSelectedType) + '</b> for <b>' + _expSelectedDur + 'h</b> · <b>' + cost + ' GP</b>'
  }).then(function(ok){
    if (!ok) return;
    fetch('/api/expeditions/launch', {
      method: 'POST',
      headers: Object.assign({'Content-Type':'application/json'},getAuthHeaders()),
      body: JSON.stringify({ wallet: w, claimId: parseInt(claimId), expeditionType: _expSelectedType, durationH: _expSelectedDur })
    }).then(function(r){return r.json();}).then(function(d){
      if (d.error) { showToast(srvErr(d.error),'error'); return; }
      showToast(d.icon + ' Expedition launched! Returns in ' + d.durationH + 'h', 'success');
      loadExpeditionPanel();
    }).catch(function(e){ showToast(e.message,'error'); });
  });
}

function cancelActiveExpedition() {
  var w = walletState && walletState.address;
  if (!w || !_expActiveId) return;
  gameConfirm({ title: t('expedition_cancel_confirm')||'Cancel Expedition?', body: '50% of remaining GP will be refunded.' }).then(function(ok){
    if (!ok) return;
    fetch('/api/expeditions/cancel', {
      method: 'POST',
      headers: Object.assign({'Content-Type':'application/json'},getAuthHeaders()),
      body: JSON.stringify({ wallet: w, expeditionId: _expActiveId })
    }).then(function(r){return r.json();}).then(function(d){
      if (d.error) { showToast(srvErr(d.error),'error'); return; }
      showToast('Expedition cancelled. Refunded: ' + d.refund.toFixed(2) + ' GP', 'success');
      loadExpeditionPanel();
    }).catch(function(e){ showToast(e.message,'error'); });
  });
}

function toggleExpeditionHistory() {
  var panel = document.getElementById('expeditionHistoryPanel');
  if (!panel) return;
  var open = panel.style.display !== 'none';
  panel.style.display = open ? 'none' : 'block';
  if (!open) loadExpeditionHistory();
}

function loadExpeditionHistory() {
  var el = document.getElementById('expeditionHistoryPanel');
  if (!el) return;
  var w = walletState && walletState.address;
  if (!w) { el.innerHTML = '<div style="color:var(--tx3);font-size:10px">Connect wallet first</div>'; return; }
  el.innerHTML = '<div style="color:var(--tx3);font-size:10px;text-align:center;padding:8px">Loading…</div>';
  _engagementRead('expedition-history', '/api/expeditions/my', true)
    .then(function(rows){
      if (!rows) { el.innerHTML = '<div style="color:var(--tx3);font-size:10px;text-align:center;padding:8px">Refresh cooling down</div>'; return; }
      if (!rows.length) { el.innerHTML = '<div style="color:var(--tx3);font-size:10px;text-align:center;padding:8px">No expeditions yet</div>'; return; }
      el.innerHTML = rows.map(function(e) {
        var statusColor = {active:'#ffb74d',completed:'#a0e8a0',cancelled:'#888'}[e.status]||'#888';
        return '<div style="display:flex;align-items:center;gap:6px;padding:4px 0;border-bottom:1px solid rgba(255,255,255,.04)">'
          + '<span style="font-size:14px">' + getExpIcon(e.expedition_type) + '</span>'
          + '<div style="flex:1;min-width:0">'
            + '<div style="font-size:9px;color:var(--tx)">' + getExpLabel(e.expedition_type) + ' · ' + e.duration_h + 'h · ' + e.gp_spent + ' GP</div>'
            + '<div style="font-size:8px;color:'+statusColor+'">' + e.status + (e.completed_at ? ' · ' + new Date(e.completed_at).toLocaleDateString() : '') + '</div>'
          + '</div>'
          + (e.reward_label ? '<span style="font-size:9px;color:#ffcc02;white-space:nowrap">' + _escHtml(e.reward_label) + '</span>' : '')
          + '</div>';
      }).join('');
    }).catch(function(e){ el.innerHTML = '<div style="color:var(--red);font-size:10px">'+e.message+'</div>'; });
}

// ── Territory Branding (Migration 123) ──────────────────────────────────────

var _brandingCfg   = null;
var _brandingClaim = null;  // currently selected claimId

function toggleBrandingPanel() {
  var panel = document.getElementById('brandingPanel');
  var tog   = document.getElementById('brandingToggle');
  if (!panel) return;
  var open = panel.style.display !== 'none';
  panel.style.display = open ? 'none' : 'block';
  tog.textContent = open ? '▼' : '▲';
  if (!open) loadBrandingPanel();
}

function loadBrandingPanel() {
  var w = walletState && walletState.address;
  // Load cost config
  fetch('/api/branding/costs').then(function(r){return r.json();}).then(function(cfg){
    _brandingCfg = cfg;
    _updateBrandCostLabels();
  }).catch(function(){});
  // Populate territory selector — _myTerritoryGroups 기반으로 그룹 표시
  var sel = document.getElementById('brandClaimSelect');
  if (!sel) return;
  if (!w) { sel.innerHTML = '<option value="">— connect wallet —</option>'; return; }
  var grps = _myTerritoryGroups(w);
  if (grps.length) {
    sel.innerHTML = '<option value="">— select territory —</option>'
      + grps.map(function(g){ return '<option value="'+g.primaryId+'">'+g.label+'</option>'; }).join('');
  } else {
    sel.innerHTML = '<option value="">— no territories —</option>';
  }
  // Load existing branding for display
  fetch('/api/branding/my', { headers: getAuthHeaders() })
    .then(function(r){return r.json();}).then(function(){}).catch(function(){});
}

function _updateBrandCostLabels() {
  var cfg = _brandingCfg;
  if (!cfg) return;
  var nameEl  = document.getElementById('brandNameCostLabel');
  var tagEl   = document.getElementById('brandTagCostLabel');
  var colorEl = document.getElementById('brandColorCostLabel');
  if (nameEl)  nameEl.textContent  = (cfg.nameCost  || 50)  + ' GP (first set) / ' + (cfg.updateCost || 15) + ' GP (update)';
  if (tagEl)   tagEl.textContent   = (cfg.tagCost   || 25)  + ' GP (first set) / ' + (cfg.updateCost || 15) + ' GP (update)';
  if (colorEl) colorEl.textContent = (cfg.colorCost || 100) + ' GP (first set) / ' + (cfg.updateCost || 15) + ' GP (update)';
}

function onBrandClaimSelect(claimId) {
  _brandingClaim = claimId || null;
  var preview = document.getElementById('brandingPreview');
  if (!claimId) { if (preview) preview.style.display = 'none'; return; }
  fetch('/api/branding/claim/' + claimId)
    .then(function(r){return r.json();})
    .then(function(d){
      if (!d) { if (preview) preview.style.display = 'none'; return; }
      if (preview) preview.style.display = '';
      var nameEl = document.getElementById('brandNameDisplay');
      var tagEl  = document.getElementById('brandTaglineDisplay');
      var dotEl  = document.getElementById('brandColorDot');
      if (nameEl)  nameEl.textContent  = d.territory_name || '';
      if (tagEl)   tagEl.textContent   = d.tagline || '';
      if (dotEl)   dotEl.style.background = d.theme_color || '#a5d6a7';
      // Pre-fill inputs
      var inp = document.getElementById('brandNameInput');
      var tag = document.getElementById('brandTagInput');
      var col = document.getElementById('brandColorInput');
      if (inp && d.territory_name) inp.value = d.territory_name;
      if (tag && d.tagline)        tag.value = d.tagline;
      if (col && d.theme_color)    { col.value = d.theme_color; document.getElementById('brandColorHex') && (document.getElementById('brandColorHex').textContent = d.theme_color); }
    }).catch(function(){});
  // Wire color picker sync
  var colInp = document.getElementById('brandColorInput');
  if (colInp) colInp.oninput = function() {
    var hex = document.getElementById('brandColorHex');
    if (hex) hex.textContent = colInp.value;
  };
}

function setBrandingName() {
  var w  = walletState && walletState.address;
  var id = _brandingClaim;
  if (!w) return showToast(t('err_connect_wallet') || 'Connect wallet first', 'error');
  if (!id) return showToast('Select a territory first', 'error');
  var name = (document.getElementById('brandNameInput') || {}).value || '';
  if (!name.trim()) return showToast('Enter a name', 'error');
  var cfg = _brandingCfg;
  gameConfirm({ title: t('branding_set_name_title') || 'Set Territory Name?', body: 'Name: <b>'+_escHtml(name)+'</b><br>Cost: <b>'+(cfg ? cfg.nameCost : 50)+' GP</b>' })
    .then(function(ok){ if (!ok) return;
      fetch('/api/branding/name', { method:'POST', headers:Object.assign({'Content-Type':'application/json'},getAuthHeaders()), body: JSON.stringify({wallet:w,claimId:id,name:name}) })
        .then(function(r){return r.json();}).then(function(d){
          if (d.error) return showToast(d.error, 'error');
          showToast('🏷️ Territory named! -' + d.gpSpent + ' GP', 'success');
          onBrandClaimSelect(id);
          if (typeof loadBaseStats === 'function') loadBaseStats();
        }).catch(function(e){ showToast(e.message,'error'); });
    });
}

function setBrandingTagline() {
  var w  = walletState && walletState.address;
  var id = _brandingClaim;
  if (!w) return showToast(t('err_connect_wallet') || 'Connect wallet first', 'error');
  if (!id) return showToast('Select a territory first', 'error');
  var tag = (document.getElementById('brandTagInput') || {}).value || '';
  if (!tag.trim()) return showToast('Enter a tagline', 'error');
  var cfg = _brandingCfg;
  gameConfirm({ title: t('branding_set_tag_title') || 'Set Tagline?', body: '"<i>'+_escHtml(tag)+'</i>"<br>Cost: <b>'+(cfg ? cfg.tagCost : 25)+' GP</b>' })
    .then(function(ok){ if (!ok) return;
      fetch('/api/branding/tagline', { method:'POST', headers:Object.assign({'Content-Type':'application/json'},getAuthHeaders()), body: JSON.stringify({wallet:w,claimId:id,tagline:tag}) })
        .then(function(r){return r.json();}).then(function(d){
          if (d.error) return showToast(d.error, 'error');
          showToast('💬 Tagline set! -' + d.gpSpent + ' GP', 'success');
          onBrandClaimSelect(id);
          if (typeof loadBaseStats === 'function') loadBaseStats();
        }).catch(function(e){ showToast(e.message,'error'); });
    });
}

function setBrandingColor() {
  var w  = walletState && walletState.address;
  var id = _brandingClaim;
  if (!w) return showToast(t('err_connect_wallet') || 'Connect wallet first', 'error');
  if (!id) return showToast('Select a territory first', 'error');
  var color = (document.getElementById('brandColorInput') || {}).value || '#80cbc4';
  var cfg = _brandingCfg;
  gameConfirm({ title: t('branding_set_color_title') || 'Set Theme Color?', body: 'Color: <span style="display:inline-block;width:16px;height:16px;background:'+color+';border-radius:3px;vertical-align:middle"></span> <b>'+color+'</b><br>Cost: <b>'+(cfg ? cfg.colorCost : 100)+' GP</b>' })
    .then(function(ok){ if (!ok) return;
      fetch('/api/branding/color', { method:'POST', headers:Object.assign({'Content-Type':'application/json'},getAuthHeaders()), body: JSON.stringify({wallet:w,claimId:id,color:color}) })
        .then(function(r){return r.json();}).then(function(d){
          if (d.error) return showToast(d.error, 'error');
          showToast('🎨 Color set! -' + d.gpSpent + ' GP', 'success');
          onBrandClaimSelect(id);
          if (typeof loadBaseStats === 'function') loadBaseStats();
        }).catch(function(e){ showToast(e.message,'error'); });
    });
}

// ── Territory Spells (Migration 124) ──────────────────────────────────────────

var _spellsCfg    = null;
var _spellTarget  = null;

function toggleSpellsPanel() {
  var panel = document.getElementById('spellsPanel');
  var tog   = document.getElementById('spellsToggle');
  if (!panel) return;
  var open = panel.style.display !== 'none';
  panel.style.display = open ? 'none' : 'block';
  tog.textContent = open ? '▼' : '▲';
  if (!open) loadSpellsPanel();
}

function loadSpellsPanel() {
  fetch('/api/spells/info').then(function(r){return r.json();}).then(function(d){
    _spellsCfg = d.cfg;
    renderSpellsGrid(d.spells, d.cfg);
  }).catch(function(){});
}

function renderSpellsGrid(spells, cfg) {
  var grid = document.getElementById('spellsGrid');
  if (!grid || !spells) return;
  grid.innerHTML = spells.map(function(s) {
    var cost = cfg && cfg.costs ? cfg.costs[s.key] : '?';
    var isHex = s.type === 'hex';
    var col = isHex ? '#f48fb1' : '#a5d6a7';
    var bg  = isHex ? 'rgba(244,143,177,.08)' : 'rgba(165,214,167,.08)';
    var bdr = isHex ? 'rgba(244,143,177,.25)' : 'rgba(165,214,167,.25)';
    return '<button onclick="castSpellAction(\''+s.key+'\')" style="display:flex;flex-direction:column;align-items:center;gap:3px;padding:8px 4px;border-radius:6px;background:'+bg+';border:1px solid '+bdr+';color:'+col+';font-family:var(--fn);font-size:9px;cursor:pointer;text-align:center">'
      + '<span style="font-size:18px">'+s.icon+'</span>'
      + '<span style="font-weight:700">'+s.label+'</span>'
      + '<span style="color:var(--gold)">'+cost+' GP</span>'
      + '<span style="color:var(--tx3);font-size:8px">'+s.desc+'</span>'
      + '</button>';
  }).join('');
}

function loadSpellsOnClaim() {
  var val = (document.getElementById('spellClaimInput') || {}).value;
  if (!val) return;
  _spellTarget = parseInt(val, 10);
  var el = document.getElementById('spellsActiveOnTarget');
  var listEl = document.getElementById('spellsActiveList');
  if (!el || !listEl) return;
  el.style.display = '';
  listEl.innerHTML = '<span style="color:var(--tx3)">Loading…</span>';
  fetch('/api/spells/claim/' + _spellTarget)
    .then(function(r){return r.json();})
    .then(function(rows){
      if (!rows.length) { listEl.innerHTML = '<span style="color:var(--tx3)">No active spells</span>'; return; }
      listEl.innerHTML = rows.map(function(s){
        var exp = s.expires_at ? new Date(s.expires_at).toLocaleTimeString() : '';
        return '<span style="margin-right:8px">'+s.icon+' <b>'+s.label+'</b> <span style="color:var(--tx3)">until '+exp+'</span></span>';
      }).join('');
    }).catch(function(){ listEl.innerHTML = '<span style="color:var(--red);font-size:9px">Failed to load</span>'; });
}

function castSpellAction(spellType) {
  var w = walletState && walletState.address;
  if (!w) return showToast(t('err_connect_wallet')||'Connect wallet first','error');
  var claimId = _spellTarget || parseInt((document.getElementById('spellClaimInput')||{}).value, 10);
  if (!claimId) return showToast(t('spells_select_target')||'Enter a target territory first','error');
  var cfg  = _spellsCfg;
  var cost = cfg && cfg.costs ? (cfg.costs[spellType] || '?') : '?';
  // Spell icon/label lookup from grid
  var btn = document.querySelector('#spellsGrid button[onclick="castSpellAction(\''+spellType+'\')"]');
  var label = btn ? btn.querySelector('span:nth-child(2)').textContent : spellType;
  gameConfirm({ title: t('spells_cast_confirm')||'Cast Spell?', body: 'Cast <b>'+label+'</b> on territory #'+claimId+'<br>Cost: <b>'+cost+' GP</b>' })
    .then(function(ok){ if (!ok) return;
      fetch('/api/spells/cast', { method:'POST', headers:Object.assign({'Content-Type':'application/json'},getAuthHeaders()), body: JSON.stringify({wallet:w,claimId:claimId,spellType:spellType}) })
        .then(function(r){return r.json();})
        .then(function(d){
          if (d.error) return showToast(srvErr(d.error),'error');
          showToast(d.icon+' '+d.label+' cast! -'+d.gpSpent+' GP','success');
          loadSpellsOnClaim();
          if (typeof loadBaseStats === 'function') loadBaseStats();
        }).catch(function(e){ showToast(e.message,'error'); });
    });
}

function toggleMySpellsHistory() {
  var panel = document.getElementById('spellsHistoryPanel');
  if (!panel) return;
  var open = panel.style.display !== 'none';
  panel.style.display = open ? 'none' : 'block';
  if (!open) loadMySpellsHistory();
}

function loadMySpellsHistory() {
  var el = document.getElementById('spellsHistoryPanel');
  if (!el) return;
  var w = walletState && walletState.address;
  if (!w) { el.innerHTML = '<div style="color:var(--tx3);font-size:10px">Connect wallet first</div>'; return; }
  el.innerHTML = '<div style="color:var(--tx3);font-size:10px;text-align:center;padding:8px">Loading…</div>';
  fetch('/api/spells/my', { headers: getAuthHeaders() })
    .then(function(r){return r.json();})
    .then(function(rows){
      if (!rows.length) { el.innerHTML = '<div style="color:var(--tx3);font-size:10px;text-align:center;padding:8px">No spells cast yet</div>'; return; }
      el.innerHTML = rows.map(function(s){
        var active = s.is_active && new Date(s.expires_at) > new Date();
        var statusColor = active ? '#a0e8a0' : '#555';
        return '<div style="display:flex;align-items:center;gap:6px;padding:4px 0;border-bottom:1px solid rgba(255,255,255,.04)">'
          + '<span style="font-size:14px">'+s.icon+'</span>'
          + '<div style="flex:1">'
            + '<div style="font-size:9px;color:var(--tx)">'+s.label+' → #'+s.target_claim_id+'</div>'
            + '<div style="font-size:8px;color:'+statusColor+'">'+(active ? '⚡ active' : '✓ expired')+' · '+s.gp_cost+' GP</div>'
          + '</div>'
          + '</div>';
      }).join('');
    }).catch(function(e){ el.innerHTML = '<div style="color:var(--red);font-size:10px">'+e.message+'</div>'; });
}

// ── Tournament System (Migration 125) ──────────────────────────────────────────

function refreshTournaments() {
  var el = document.getElementById('tournamentList');
  if (!el) return;
  el.innerHTML = '<div style="text-align:center;padding:12px;color:var(--tx3);font-size:10px">Loading…</div>';
  fetch('/api/tournaments')
    .then(function(r){return r.json();})
    .then(function(rows){
      if (!rows.length) {
        el.innerHTML = '<div style="text-align:center;padding:12px;color:var(--tx3);font-size:10px" data-i18n="tournament_none">No open tournaments right now</div>';
        return;
      }
      var w = walletState && walletState.address;
      el.innerHTML = rows.map(function(t){
        var statusColor = {open:'#a0e8a0',running:'#80deea'}[t.status]||'#888';
        return '<div style="padding:8px;border-radius:6px;background:rgba(255,183,77,.04);border:1px solid rgba(255,183,77,.15)">'
          + '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:4px">'
          + '<div>'
          + '<div style="font-size:11px;color:#ffb74d;font-family:var(--fn);font-weight:700">'+_escHtml(t.icon||'🏆')+' '+_escHtml(t.name)+'</div>'
          + (t.description ? '<div style="font-size:9px;color:var(--tx3)">'+_escHtml(t.description)+'</div>' : '')
          + '</div>'
          + '<span style="font-size:9px;color:'+statusColor+';font-family:var(--fn)">'+t.status.toUpperCase()+'</span>'
          + '</div>'
          + '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:4px;margin-bottom:6px">'
          + '<div style="font-size:9px;color:var(--tx3)">Entry: <b style="color:var(--gold)">'+t.entry_fee_gp+' GP</b></div>'
          + '<div style="font-size:9px;color:var(--tx3)">Prize: <b style="color:#a0e8a0">'+t.prize_pool_gp+' GP</b></div>'
          + '<div style="font-size:9px;color:var(--tx3)">Players: <b style="color:#aaa">'+(t.entry_count||0)+(t.max_players?'/'+t.max_players:'')+'</b></div>'
          + '</div>'
          + (t.status === 'open' ? '<button onclick="joinTournamentAction('+t.id+',\''+_escHtml(t.name)+'\','+t.entry_fee_gp+')" style="width:100%;padding:6px;border-radius:6px;background:rgba(255,183,77,.15);border:1px solid rgba(255,183,77,.35);color:#ffb74d;font-family:var(--fn);font-size:10px;cursor:pointer;font-weight:700" data-i18n="tournament_join_btn">JOIN TOURNAMENT</button>' : '')
          + '</div>';
      }).join('');
    }).catch(function(e){ if (el) el.innerHTML = '<div style="color:var(--red);font-size:10px;padding:8px">'+e.message+'</div>'; });
}

function joinTournamentAction(id, name, fee) {
  var w = walletState && walletState.address;
  if (!w) return showToast(t('err_connect_wallet')||'Connect wallet first','error');
  gameConfirm({ title: t('tournament_join_confirm')||'Join Tournament?', body: 'Join <b>'+_escHtml(name)+'</b><br>Entry fee: <b>'+fee+' GP</b>' })
    .then(function(ok){ if (!ok) return;
      fetch('/api/tournaments/join', { method:'POST', headers:Object.assign({'Content-Type':'application/json'},getAuthHeaders()), body: JSON.stringify({wallet:w,tournamentId:id}) })
        .then(function(r){return r.json();})
        .then(function(d){
          if (d.error) return showToast(srvErr(d.error),'error');
          showToast('🏆 Joined '+d.tournamentName+'! -'+d.gpSpent+' GP','success');
          refreshTournaments();
          if (typeof loadBaseStats === 'function') loadBaseStats();
        }).catch(function(e){ showToast(e.message,'error'); });
    });
}

function toggleMyTournaments() {
  var panel = document.getElementById('myTournamentsPanel');
  if (!panel) return;
  var open = panel.style.display !== 'none';
  panel.style.display = open ? 'none' : 'block';
  if (!open) loadMyTournaments();
}

function loadMyTournaments() {
  var el = document.getElementById('myTournamentsPanel');
  if (!el) return;
  var w = walletState && walletState.address;
  if (!w) { el.innerHTML = '<div style="color:var(--tx3);font-size:10px">Connect wallet first</div>'; return; }
  el.innerHTML = '<div style="color:var(--tx3);font-size:10px;text-align:center;padding:8px">Loading…</div>';
  fetch('/api/tournaments/my', { headers: getAuthHeaders() })
    .then(function(r){return r.json();})
    .then(function(rows){
      if (!rows.length) { el.innerHTML = '<div style="color:var(--tx3);font-size:10px;text-align:center;padding:8px">No tournaments joined yet</div>'; return; }
      el.innerHTML = rows.map(function(t){
        var statusColor = {open:'#a0e8a0',running:'#80deea',completed:'#ffb74d',cancelled:'#555'}[t.status]||'#888';
        var won = t.winner_wallet && t.winner_wallet.toLowerCase() === w.toLowerCase();
        return '<div style="display:flex;align-items:center;gap:6px;padding:4px 0;border-bottom:1px solid rgba(255,255,255,.04)">'
          + '<span style="font-size:14px">'+(won ? '🏆' : (t.icon||'🎮'))+'</span>'
          + '<div style="flex:1">'
            + '<div style="font-size:9px;color:var(--tx)">'+_escHtml(t.name)+'</div>'
            + '<div style="font-size:8px;color:'+statusColor+'">'+t.status+(won ? ' · YOU WON!' : '')+'</div>'
          + '</div>'
          + '<span style="font-size:9px;color:var(--gold)">'+t.entry_fee_gp+' GP</span>'
          + '</div>';
      }).join('');
    }).catch(function(e){ el.innerHTML = '<div style="color:var(--red);font-size:10px">'+e.message+'</div>'; });
}

// Auto-load tournaments when quests tab opens
try {
  var _origSwitchTab = typeof switchTab === 'function' ? switchTab : null;
} catch(_) {}

// ── Territory Events (Migration 131) ─────────────────────────────────────────

var _tevtCfg = null;
var _tevtCurrentClaim = null;

function toggleTevtPanel() {
  var panel = document.getElementById('tevtPanel');
  var arrow = document.getElementById('tevtPanelArrow');
  if (!panel) return;
  var open = panel.style.display !== 'none';
  panel.style.display = open ? 'none' : 'block';
  if (arrow) arrow.textContent = open ? '▼' : '▲';
  if (!open) loadTevtConfig();
}

function loadTevtConfig() {
  fetch('/api/tevt/config').then(function(r){return r.json();}).then(function(cfg){
    _tevtCfg = cfg;
    renderTevtEventCards();
  }).catch(function(){});
}

function renderTevtEventCards() {
  var el = document.getElementById('tevtEventCards');
  if (!el || !_tevtCfg) return;
  var evts = _tevtCfg.events || {};
  var keys = Object.keys(evts);
  if (!keys.length) { el.innerHTML = ''; return; }
  el.innerHTML = keys.map(function(k){
    var ev = evts[k];
    return '<div style="padding:6px 8px;background:rgba(128,203,196,.05);border:1px solid rgba(128,203,196,.15);border-radius:6px;cursor:pointer" onclick="activateTevt(\''+k+'\')">'
      + '<div style="font-size:16px;text-align:center;margin-bottom:2px">'+(ev.icon||'⚡')+'</div>'
      + '<div style="font-size:8px;color:var(--tx);text-align:center;font-weight:600">'+ev.label+'</div>'
      + '<div style="font-size:7px;color:var(--tx3);text-align:center;margin-top:1px">'+ev.durationH+'h · '+(ev.gpCost||'?')+' GP</div>'
      + '</div>';
  }).join('');
}

function loadTevtForClaim() {
  var claimId = parseInt((document.getElementById('tevtClaimInput')||{}).value||'0');
  if (!claimId) { showToast('Enter a claim number', 'error'); return; }
  _tevtCurrentClaim = claimId;
  var el = document.getElementById('tevtActivePanel');
  if (el) el.innerHTML = '<div style="color:var(--tx3);font-size:9px;text-align:center;padding:4px">Loading…</div>';
  fetch('/api/tevt/claim/'+claimId).then(function(r){return r.json();}).then(function(rows){
    if (!el) return;
    if (!rows || !rows.length) {
      el.innerHTML = '<div style="color:var(--tx3);font-size:9px;text-align:center;padding:4px">'+(t('tevt_none')||'No active events on this territory.')+'</div>';
      return;
    }
    var evtIcons = { mining_rush:'⛏️', harvest_festival:'🌾', beacon_pulse:'📡', fortify_surge:'🛡️', tax_holiday:'💸' };
    el.innerHTML = rows.map(function(ev){
      var now = Date.now();
      var expMs = new Date(ev.expires_at).getTime();
      var remMin = Math.ceil(Math.max(0, expMs-now)/60000);
      var icon = evtIcons[ev.event_type]||'⚡';
      return '<div style="display:flex;align-items:center;gap:6px;padding:4px 0;border-bottom:1px solid rgba(255,255,255,.04)">'
        + '<span>'+icon+'</span>'
        + '<div style="flex:1;font-size:9px;color:var(--tx)">'+ev.event_type.replace(/_/g,' ')+'</div>'
        + '<span style="font-size:8px;color:#80cbc4">⏱ '+remMin+'m</span>'
        + '</div>';
    }).join('');
  }).catch(function(e){
    if (el) el.innerHTML = '<div style="color:var(--red);font-size:9px">'+e.message+'</div>';
  });
}

function activateTevt(eventType) {
  var w = walletState && walletState.address;
  if (!w) { showToast('Connect wallet first', 'error'); return; }
  var claimId = parseInt((document.getElementById('tevtClaimInput')||{}).value||'0');
  if (!claimId) { showToast('Enter a claim number first', 'error'); return; }
  if (!_tevtCfg) { showToast('Loading config…'); loadTevtConfig(); return; }
  var evtInfo = (_tevtCfg.events||{})[eventType];
  if (!evtInfo) return;
  gameConfirm({
    title: t('tevt_activate_confirm')||'Activate Event?',
    body: evtInfo.icon+' <b>'+evtInfo.label+'</b> on Claim #'+claimId+'<br>'
      + evtInfo.desc+'<br>'
      + 'Duration: <b>'+evtInfo.durationH+'h</b> · Cost: <b>'+evtInfo.gpCost+' GP</b>'
  }).then(function(ok){
    if (!ok) return;
    fetch('/api/tevt/activate', {
      method: 'POST', headers: Object.assign({'Content-Type':'application/json'},getAuthHeaders()),
      body: JSON.stringify({ wallet: w, claimId: claimId, eventType: eventType })
    }).then(function(r){return r.json();}).then(function(d){
      if (d.error) { showToast(srvErr(d.error),'error'); return; }
      showToast(evtInfo.icon+' '+evtInfo.label+' activated!','success');
      loadTevtForClaim();
      if (typeof refreshWalletInfo === 'function') refreshWalletInfo();
    }).catch(function(e){ showToast(e.message,'error'); });
  }).catch(function(){});
}

// ── Territory Tiers (Migration 128) ──────────────────────────────────────────

var _tiersCfg = null;

function toggleTiersPanel() {
  var panel = document.getElementById('tiersPanel');
  var arrow = document.getElementById('tiersPanelArrow');
  if (!panel) return;
  var open = panel.style.display !== 'none';
  panel.style.display = open ? 'none' : 'block';
  if (arrow) arrow.textContent = open ? '▼' : '▲';
  if (!open) { loadMyTiers(); loadTiersBenefits(); }
}

function loadMyTiers() {
  var w = walletState && walletState.address;
  var el = document.getElementById('myTiersPanel');
  if (!el) return;
  if (!w) { el.innerHTML = '<div style="color:var(--tx3);font-size:9px;text-align:center">Connect wallet to view</div>'; return; }
  el.innerHTML = '<div style="color:var(--tx3);font-size:9px;text-align:center;padding:6px">Loading…</div>';
  fetch('/api/tiers/my', { headers: getAuthHeaders() })
    .then(function(r){return r.json();})
    .then(function(rows){
      if (!rows || !rows.length) {
        el.innerHTML = '<div style="color:var(--tx3);font-size:9px;text-align:center;padding:6px">'+(t('tiers_none')||'No tiered territories yet. Select a territory below to upgrade.')+'</div>';
        return;
      }
      var icons = ['🥉','🥈','🥇','💠','💎'];
      el.innerHTML = rows.map(function(row){
        var icon = icons[row.tier-1]||'⭐';
        return '<div style="display:flex;align-items:center;gap:8px;padding:5px 8px;background:rgba(128,222,234,.06);border:1px solid rgba(128,222,234,.15);border-radius:6px">'
          + '<span style="font-size:16px">'+icon+'</span>'
          + '<div style="flex:1">'
            + '<div style="font-size:9px;color:var(--tx)">Claim #'+row.claim_id+'</div>'
            + '<div style="font-size:8px;color:#80deea">Tier '+row.tier+' · Sec '+row.sector_id+'</div>'
          + '</div>'
          + (row.tier < 5 ? '<button onclick="upgradeTierAction('+row.claim_id+','+row.tier+')" style="font-size:8px;padding:4px 8px;border-radius:6px;background:rgba(128,222,234,.12);border:1px solid rgba(128,222,234,.3);color:#80deea;cursor:pointer;font-family:var(--fn)">'+(t('tiers_upgrade_btn')||'⬆ UPGRADE')+'</button>' : '<span style="font-size:8px;color:#80deea">MAX</span>')
          + '</div>';
      }).join('');
      // If user has claims not yet tiered, show upgrade option for selected claim
    }).catch(function(e){ el.innerHTML = '<div style="color:var(--red);font-size:9px">'+e.message+'</div>'; });
}

function loadTiersBenefits() {
  var el = document.getElementById('tiersBenefitsTable');
  if (!el) return;
  fetch('/api/tiers/config')
    .then(function(r){return r.json();})
    .then(function(cfg){
      _tiersCfg = cfg;
      el.innerHTML = cfg.tiers.map(function(tier){
        return '<div style="display:flex;align-items:center;gap:8px;padding:4px 6px;background:rgba(255,255,255,.02);border-radius:4px">'
          + '<span style="font-size:14px;min-width:24px">'+tier.icon+'</span>'
          + '<div style="flex:1">'
            + '<div style="font-size:9px;color:var(--tx)">Tier '+tier.level+' · '+tier.name+'</div>'
            + '<div style="font-size:8px;color:var(--tx3)">⛏ +'+tier.miningBonusPct+'% mining · 🔲 +'+tier.pixelBonusPct+'% pixels</div>'
          + '</div>'
          + '<div style="text-align:right">'
            + (tier.level > 1 ? '<div style="font-size:9px;color:var(--gold)">'+tier.costGp+' GP</div>' : '<div style="font-size:9px;color:var(--tx3)">BASE</div>')
          + '</div>'
          + '</div>';
      }).join('');
    }).catch(function(){});
}

function upgradeTierAction(claimId, currentTier) {
  var w = walletState && walletState.address;
  if (!w) { showToast('Connect wallet first', 'error'); return; }
  if (!_tiersCfg) { showToast('Loading config…'); loadTiersBenefits(); return; }
  var nextTierInfo = _tiersCfg.tiers[currentTier]; // 0-indexed, currentTier is the index of NEXT
  if (!nextTierInfo) { showToast('Already at max tier', 'info'); return; }
  gameConfirm({
    title: t('tiers_upgrade_confirm')||'Upgrade Territory Tier?',
    body: 'Upgrade Claim #'+claimId+' to '+nextTierInfo.icon+' <b>'+nextTierInfo.name+'</b><br>'
      + 'Cost: <b>'+nextTierInfo.costGp+' GP</b><br>'
      + '⛏ +'+nextTierInfo.miningBonusPct+'% mining · 🔲 +'+nextTierInfo.pixelBonusPct+'% pixels'
  }).then(function(ok){
    if (!ok) return;
    fetch('/api/tiers/upgrade', {
      method: 'POST', headers: Object.assign({'Content-Type':'application/json'},getAuthHeaders()),
      body: JSON.stringify({ wallet: w, claimId: claimId })
    }).then(function(r){return r.json();}).then(function(d){
      if (d.error) { showToast(srvErr(d.error),'error'); return; }
      showToast(d.tierIcon+' Upgraded to '+d.tierName+'!','success');
      loadMyTiers();
      if (typeof refreshWalletInfo === 'function') refreshWalletInfo();
    }).catch(function(e){ showToast(e.message,'error'); });
  }).catch(function(){});
}

// Called from territory panel to upgrade a specific claim
function showTierUpgradeForClaim(claimId) {
  // Open tiers panel if closed
  var panel = document.getElementById('tiersPanel');
  if (panel && panel.style.display === 'none') toggleTiersPanel();
  // Scroll to it
  if (panel) panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  // Fetch current tier of this claim and trigger upgrade
  fetch('/api/tiers/claim/'+claimId).then(function(r){return r.json();}).then(function(d){
    upgradeTierAction(claimId, d.tier||1);
  }).catch(function(e){ showToast(e.message,'error'); });
}

// ── GP Profile Customization (Migration 127) ─────────────────────────────────

var _profileCfg = null;

function loadMyProfile() {
  var w = walletState && walletState.address;
  var nickDisp = document.getElementById('profileNicknameDisplay');
  var mottoDisp = document.getElementById('profileMottoDisplay');
  var walletDisp = document.getElementById('profileWalletDisplay');
  var avatarCircle = document.getElementById('profileAvatarCircle');
  var nickInput = document.getElementById('profileNicknameInput');
  var mottoInput = document.getElementById('profileMottoInput');
  var colorInput = document.getElementById('profileColorInput');
  var nickHint = document.getElementById('profileNicknameCostHint');
  var mottoHint = document.getElementById('profileMottoCostHint');
  var colorHint = document.getElementById('profileColorCostHint');

  if (walletDisp) walletDisp.textContent = w ? (w.slice(0,6)+'…'+w.slice(-4)) : '—';

  fetch('/api/profile/costs').then(function(r){return r.json();}).then(function(cfg){
    _profileCfg = cfg;
    if (nickHint) nickHint.textContent = cfg.nickname.firstGp > 0 ? 'First: '+cfg.nickname.firstGp+' GP · Change: '+cfg.nickname.changeGp+' GP' : 'First set free · Change: '+cfg.nickname.changeGp+' GP';
    if (mottoHint) mottoHint.textContent = cfg.motto.firstGp > 0 ? 'First: '+cfg.motto.firstGp+' GP · Change: '+cfg.motto.changeGp+' GP' : 'First set free · Change: '+cfg.motto.changeGp+' GP';
    if (colorHint) colorHint.textContent = cfg.avatar.gp+' GP';
  }).catch(function(){});

  if (!w) return;

  fetch('/api/profile', { headers: getAuthHeaders() }).then(function(r){return r.json();}).then(function(p){
    if (!p || p.error) return;
    if (nickDisp) nickDisp.textContent = p.nickname || '(no nickname)';
    if (mottoDisp) mottoDisp.textContent = p.motto || (t('profile_no_motto')||'No motto set');
    var color = p.avatar_color || '#FF7840';
    if (avatarCircle) avatarCircle.style.background = color;
    if (colorInput) colorInput.value = color;
    if (nickInput && p.nickname) nickInput.value = p.nickname;
    if (mottoInput && p.motto) mottoInput.value = p.motto;
  }).catch(function(){});

  // Load status
  loadMyStatusDisplay();
  fetch('/api/status/config').then(function(r){return r.json();}).then(function(cfg){
    var hint = document.getElementById('statusCostHint');
    if (hint) hint.textContent = cfg.costGP + ' GP · '+cfg.durH+'h duration';
  }).catch(function(){});

  // Load vanity tag
  try { loadVtagCfg(); loadMyVtagDisplay(); } catch(_) {}
}

function loadMyStatusDisplay() {
  var w = walletState && walletState.address;
  if (!w) return;
  var el = document.getElementById('myStatusDisplay');
  if (!el) return;
  fetch('/api/status/my',{headers:getAuthHeaders()}).then(function(r){return r.json();}).then(function(s){
    if (!s || !s.isActive) { el.textContent = t('status_none')||'No active status'; el.style.color = 'var(--tx3)'; return; }
    var expMs = new Date(s.expiresAt) - Date.now();
    var expStr = expMs > 0 ? Math.ceil(expMs/3600000)+'h left' : 'expired';
    el.innerHTML = '"'+s.status+'" <span style="color:#ffcc02;font-size:8px">'+expStr+'</span>';
    el.style.color = 'var(--tx)';
    var input = document.getElementById('statusInput');
    if (input) input.value = s.status;
  }).catch(function(){ el.textContent = ''; });
}

function setMyStatus() {
  var w = walletState && walletState.address;
  if (!w) { showToast(t('connect_wallet')||'Connect wallet first','error'); return; }
  var val = document.getElementById('statusInput').value.trim();
  if (!val) { showToast(t('status_required')||'Enter a status message','error'); return; }
  gameConfirm({
    title: t('status_set_confirm')||'Set Status Message?',
    body: '"'+val+'"<br>Cost: <b>20 GP</b>'
  }).then(function(ok){
    if (!ok) return;
    fetch('/api/status/set', {
      method: 'POST', headers: Object.assign({'Content-Type':'application/json'}, getAuthHeaders()),
      body: JSON.stringify({ wallet: w, status: val })
    }).then(function(r){return r.json();}).then(function(d){
      if (d.error) { showToast(srvErr(d.error),'error'); return; }
      showToast('💬 Status set!','success');
      loadMyStatusDisplay();
      if (typeof refreshWalletInfo === 'function') refreshWalletInfo();
    }).catch(function(e){ showToast(e.message,'error'); });
  });
}

// ═══════ VANITY TAG (Migration 140) ═══════
var _vtagCfg = null;
function loadVtagCfg() {
  fetch('/api/vtag/config').then(function(r){return r.json();}).then(function(c){
    _vtagCfg = c;
    var hint = document.getElementById('vtagCostHint');
    if (hint) hint.textContent = c.enabled
      ? (t('vtag_cost_hint')||'First tag: '+c.firstGP+' GP • Change: '+c.changeGP+' GP')
      : (t('vtag_disabled')||'Vanity tags disabled');
  }).catch(function(){});
}

function loadMyVtagDisplay() {
  var w = walletState && walletState.address;
  if (!w) return;
  var el = document.getElementById('myVtagDisplay');
  var clearBtn = document.getElementById('vtagClearBtn');
  if (!el) return;
  fetch('/api/vtag/get', { headers: getAuthHeaders() })
    .then(function(r){return r.json();})
    .then(function(d){
      if (!d || !d.tag) {
        el.textContent = t('vtag_none')||'No vanity tag set';
        el.style.color = 'var(--tx3)';
        if (clearBtn) clearBtn.style.display = 'none';
        return;
      }
      el.textContent = '🏷️ '+d.tag;
      el.style.color = '#ce93d8';
      if (clearBtn) clearBtn.style.display = '';
      var input = document.getElementById('vtagInput');
      if (input) input.value = d.tag;
    }).catch(function(){ el.textContent = ''; });
}

function setMyVtag() {
  var w = walletState && walletState.address;
  if (!w) { showToast(t('connect_wallet')||'Connect wallet first','error'); return; }
  var val = (document.getElementById('vtagInput')||{}).value || '';
  val = val.trim();
  if (!val) { showToast(t('vtag_required')||'Enter a tag','error'); return; }
  var cost = _vtagCfg ? _vtagCfg.firstGP : 50; // will be recalculated server-side
  var costStr = cost > 0 ? cost+' GP' : t('vtag_free')||'Free';
  gameConfirm({
    title: t('vtag_set_confirm')||'Set Vanity Tag?',
    body: 'Tag: <b>'+_escHtml(val)+'</b><br>Cost: <b>'+costStr+'</b>'
  }).then(function(ok){
    if (!ok) return;
    fetch('/api/vtag/set', {
      method: 'POST', headers: Object.assign({'Content-Type':'application/json'}, getAuthHeaders()),
      body: JSON.stringify({ wallet: w, tag: val })
    }).then(function(r){return r.json();}).then(function(d){
      if (d.error) { showToast(srvErr(d.error),'error'); return; }
      showToast((t('vtag_set_success')||'🏷️ Vanity tag set!'),'success');
      loadMyVtagDisplay();
      if (typeof refreshWalletInfo === 'function') refreshWalletInfo();
    }).catch(function(e){ showToast(e.message,'error'); });
  });
}

function clearMyVtag() {
  var w = walletState && walletState.address;
  if (!w) { showToast(t('connect_wallet')||'Connect wallet first','error'); return; }
  var clearGP = _vtagCfg ? _vtagCfg.clearGP : 0;
  var costStr = clearGP > 0 ? clearGP+' GP' : t('vtag_free')||'Free';
  gameConfirm({
    title: t('vtag_clear_confirm')||'Remove Vanity Tag?',
    body: 'Clear your current vanity tag.<br>Cost: <b>'+costStr+'</b>'
  }).then(function(ok){
    if (!ok) return;
    fetch('/api/vtag/clear', {
      method: 'POST', headers: Object.assign({'Content-Type':'application/json'}, getAuthHeaders()),
      body: JSON.stringify({ wallet: w })
    }).then(function(r){return r.json();}).then(function(d){
      if (d.error) { showToast(srvErr(d.error),'error'); return; }
      showToast((t('vtag_cleared')||'Tag removed'),'success');
      loadMyVtagDisplay();
      document.getElementById('vtagInput').value = '';
      if (typeof refreshWalletInfo === 'function') refreshWalletInfo();
    }).catch(function(e){ showToast(e.message,'error'); });
  });
}

function saveProfileNickname() {
  var w = walletState && walletState.address;
  if (!w) { showToast('Connect wallet first', 'error'); return; }
  var val = (document.getElementById('profileNicknameInput')||{}).value || '';
  val = val.trim();
  if (!val) { showToast('Enter a nickname', 'error'); return; }
  var currentNick = (document.getElementById('profileNicknameDisplay')||{}).textContent;
  var isFirst = (currentNick === '(no nickname)');
  var cost = _profileCfg ? (isFirst ? _profileCfg.nickname.firstGp : _profileCfg.nickname.changeGp) : 100;
  var costStr = cost > 0 ? cost+' GP' : 'Free';
  gameConfirm({ title: t('profile_nick_confirm')||'Set Nickname?', body: 'Set nickname: <b>'+_escHtml(val)+'</b><br>Cost: <b>'+costStr+'</b>' })
    .then(function(ok){
      if (!ok) return;
      fetch('/api/profile/nickname', {
        method: 'POST', headers: Object.assign({'Content-Type':'application/json'}, getAuthHeaders()),
        body: JSON.stringify({ wallet: w, nickname: val })
      }).then(function(r){return r.json();}).then(function(d){
        if (d.error) { showToast(srvErr(d.error),'error'); return; }
        showToast('Nickname set! 👤','success');
        loadMyProfile();
        if (typeof refreshWalletInfo === 'function') refreshWalletInfo();
      }).catch(function(e){ showToast(e.message,'error'); });
    }).catch(function(){});
}

function saveProfileMotto() {
  var w = walletState && walletState.address;
  if (!w) { showToast('Connect wallet first', 'error'); return; }
  var val = (document.getElementById('profileMottoInput')||{}).value || '';
  val = val.trim();
  if (!val) { showToast('Enter a motto', 'error'); return; }
  var currentMotto = (document.getElementById('profileMottoDisplay')||{}).textContent;
  var isFirst = (currentMotto === (t('profile_no_motto')||'No motto set'));
  var cost = _profileCfg ? (isFirst ? _profileCfg.motto.firstGp : _profileCfg.motto.changeGp) : 30;
  var costStr = cost > 0 ? cost+' GP' : 'Free';
  gameConfirm({ title: t('profile_motto_confirm')||'Set Motto?', body: 'Motto: <b>'+_escHtml(val)+'</b><br>Cost: <b>'+costStr+'</b>' })
    .then(function(ok){
      if (!ok) return;
      fetch('/api/profile/motto', {
        method: 'POST', headers: Object.assign({'Content-Type':'application/json'},getAuthHeaders()),
        body: JSON.stringify({ wallet: w, motto: val })
      }).then(function(r){return r.json();}).then(function(d){
        if (d.error) { showToast(srvErr(d.error),'error'); return; }
        showToast('Motto saved! 📝','success');
        loadMyProfile();
      }).catch(function(e){ showToast(e.message,'error'); });
    }).catch(function(){});
}

function saveProfileColor() {
  var w = walletState && walletState.address;
  if (!w) { showToast('Connect wallet first', 'error'); return; }
  var val = (document.getElementById('profileColorInput')||{}).value || '#FF7840';
  var cost = _profileCfg ? _profileCfg.avatar.gp : 50;
  gameConfirm({ title: t('profile_color_confirm')||'Set Avatar Color?', body: 'Color: <b style="color:'+_escHtml(val)+'">'+_escHtml(val)+'</b><br>Cost: <b>'+cost+' GP</b>' })
    .then(function(ok){
      if (!ok) return;
      fetch('/api/profile/avatar-color', {
        method: 'POST', headers: Object.assign({'Content-Type':'application/json'}, getAuthHeaders()),
        body: JSON.stringify({ wallet: w, color: val })
      }).then(function(r){return r.json();}).then(function(d){
        if (d.error) { showToast(srvErr(d.error),'error'); return; }
        showToast('Avatar color updated! 🎨','success');
        loadMyProfile();
      }).catch(function(e){ showToast(e.message,'error'); });
    }).catch(function(){});
}

// ── auth modal profile customize helpers ──────────────────────────
function _authSaveMotto() {
  var v = (document.getElementById('authMottoInput')||{}).value||'';
  var target = document.getElementById('profileMottoInput');
  if (target) { target.value = v; saveProfileMotto(); }
  else {
    var w = walletState && walletState.address;
    if (!w || !v.trim()) return;
    fetch('/api/profile/motto', { method:'POST', headers:Object.assign({'Content-Type':'application/json'},getAuthHeaders()), body: JSON.stringify({ wallet:w, motto:v.trim() }) })
      .then(function(r){return r.json();}).then(function(d){ showToast(d.error?d.error:'Motto saved! 📝', d.error?'error':'success'); });
  }
}
function _authSaveStatus() {
  var v = (document.getElementById('authStatusInput')||{}).value||'';
  var target = document.getElementById('statusInput');
  if (target) { target.value = v; setMyStatus(); }
  else {
    var w = walletState && walletState.address;
    if (!w || !v.trim()) return;
    // 정확한 엔드포인트는 /api/status/set (setMyStatus 와 동일). 과거 /api/profile/status 는
    // 백엔드에 없어 404 → 거짓 성공 토스트가 뜨던 버그였음. [v7.98]
    fetch('/api/status/set', { method:'POST', headers:Object.assign({'Content-Type':'application/json'},getAuthHeaders()), body: JSON.stringify({ wallet:w, status:v.trim() }) })
      .then(function(r){return r.json();}).then(function(d){ showToast(d.error?d.error:'Status updated!', d.error?'error':'success'); });
  }
}
function _authSaveVtag() {
  var v = (document.getElementById('authVtagInput')||{}).value||'';
  var target = document.getElementById('vtagInput');
  if (target) { target.value = v; setMyVtag(); }
}
function _authSaveColor() {
  var v = (document.getElementById('authColorInput')||{}).value||'#FF7840';
  var target = document.getElementById('profileColorInput');
  if (target) { target.value = v; saveProfileColor(); }
}

function toggleProfileHistory() {
  var panel = document.getElementById('profileHistoryPanel');
  if (!panel) return;
  if (panel.style.display === 'none') {
    panel.style.display = 'block';
    loadProfileHistory();
  } else {
    panel.style.display = 'none';
  }
}

function loadProfileHistory() {
  var w = walletState && walletState.address;
  var el = document.getElementById('profileHistoryPanel');
  if (!el || !w) return;
  el.innerHTML = '<div style="color:var(--tx3);font-size:9px;text-align:center;padding:6px">Loading…</div>';
  fetch('/api/profile/history', { headers: getAuthHeaders() })
    .then(function(r){return r.json();})
    .then(function(rows){
      if (!rows || !rows.length) { el.innerHTML = '<div style="color:var(--tx3);font-size:9px;text-align:center;padding:6px">No changes yet</div>'; return; }
      el.innerHTML = rows.map(function(r){
        var t2 = new Date(r.created_at).toLocaleDateString();
        return '<div style="display:flex;align-items:center;gap:6px;padding:3px 0;border-bottom:1px solid rgba(255,255,255,.04);font-size:9px">'
          + '<span style="color:#f48fb1;min-width:60px">'+r.field+'</span>'
          + '<span style="color:var(--tx);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+(r.new_value||'cleared')+'</span>'
          + '<span style="color:var(--gold)">'+(r.gp_spent?r.gp_spent+' GP':'free')+'</span>'
          + '<span style="color:var(--tx3);min-width:60px;text-align:right">'+t2+'</span>'
          + '</div>';
      }).join('');
    }).catch(function(e){ el.innerHTML = '<div style="color:var(--red);font-size:9px">'+e.message+'</div>'; });
}

// ── Colony Prestige (Migration 132) ──────────────────────────────────────────

var _prestigeCfg = null;

function loadMyPrestige() {
  var w = walletState && walletState.address;
  fetch('/api/prestige/config').then(function(r){return r.json();}).then(function(cfg){
    _prestigeCfg = cfg;
    var hint = document.getElementById('prestigeCostHint');
    if (hint) hint.textContent = cfg.costGP + ' GP per Prestige Point';
    var btn = document.getElementById('prestigeBuyBtn');
    if (btn) btn.disabled = !cfg.enabled;
  }).catch(function(){});
  if (w) {
    fetch('/api/prestige/my', { headers: getAuthHeaders() }).then(function(r){return r.json();}).then(function(d){
      var icon = document.getElementById('prestigeIconCircle');
      var name = document.getElementById('prestigeRankName');
      var pts  = document.getElementById('prestigePointsLabel');
      var fill = document.getElementById('prestigeProgressFill');
      if (icon) icon.textContent = d.rankIcon || '🪨';
      if (name) { name.textContent = d.rankName || 'Colonist'; name.style.color = d.rankColor || '#ffd54f'; }
      if (pts) {
        if (d.isMaxRank) pts.textContent = d.prestige_points + ' pts — MAX RANK';
        else pts.textContent = d.prestige_points + ' pts — ' + d.pointsToNext + ' pts to ' + d.nextRankName;
      }
      if (fill) {
        var cfg = _prestigeCfg;
        var pct = 0;
        if (cfg && !d.isMaxRank) {
          var cur = cfg.thresholds[d.prestige_rank] || 0;
          var nxt = d.nextThresh || 1;
          pct = Math.min(100, Math.round((d.prestige_points - cur) / (nxt - cur) * 100));
        } else if (d.isMaxRank) { pct = 100; }
        fill.style.width = pct + '%';
      }
    }).catch(function(){});
  }
  // Load leaderboard
  fetch('/api/prestige/leaderboard').then(function(r){return r.json();}).then(function(rows){
    var el = document.getElementById('prestigeLeaderboard');
    if (!el) return;
    if (!rows.length) { el.innerHTML = '<div style="color:var(--tx3);font-size:9px;text-align:center;padding:10px">'+t('prestige_lb_none')+'</div>'; return; }
    el.innerHTML = '<table style="width:100%;border-collapse:collapse;font-size:9px">'
      + rows.slice(0,10).map(function(r,i){
          return '<tr style="border-bottom:1px solid rgba(255,255,255,.05)">'
            +'<td style="padding:4px 6px;color:#ffd54f;width:22px">'+(i+1)+'.</td>'
            +'<td style="padding:4px 6px;color:var(--tx)">'+(r.nickname||r.wallet.slice(0,8)+'…')+'</td>'
            +'<td style="padding:4px 6px;text-align:center">'+r.rankIcon+'</td>'
            +'<td style="padding:4px 6px;color:#ffd54f;text-align:right">'+r.prestige_points+' pts</td>'
            +'</tr>';
        }).join('')
      + '</table>';
  }).catch(function(){ var el=document.getElementById('prestigeLeaderboard'); if(el) el.innerHTML=''; });
}

function buyPrestige() {
  var w = walletState && walletState.address;
  if (!w) { showToast(t('connect_wallet')||'Connect wallet first','error'); return; }
  var cfg = _prestigeCfg;
  var cost = cfg ? cfg.costGP : 50;
  gameConfirm({
    title: t('prestige_buy_confirm')||'Buy Prestige Point?',
    body: 'Spend <b>'+cost+' GP</b> to gain 1 Prestige Point.<br>Earn ranks and show your colony status!'
  }).then(function(ok){
    if (!ok) return;
    fetch('/api/prestige/buy', {
      method:'POST', headers:Object.assign({'Content-Type':'application/json'},getAuthHeaders()),
      body: JSON.stringify({ wallet: w })
    }).then(function(r){return r.json();}).then(function(d){
      if (d.error) { showToast(srvErr(d.error),'error'); return; }
      var msg = d.rankedUp ? (d.rankIcon+' Ranked up to '+d.rankName+'!') : ('⭐ +1 Prestige Point!');
      showToast(msg,'success');
      loadMyPrestige();
      if (typeof refreshWalletInfo === 'function') refreshWalletInfo();
    }).catch(function(e){ showToast(e.message,'error'); });
  });
}

// ── Map Beacons (Migration 133) ──────────────────────────────────────────────

var _beaconCfg = null;
var _selectedBeaconIcon = '📡';

function toggleBeaconPanel() {
  var panel = document.getElementById('beaconPanel');
  var arrow = document.getElementById('beaconPanelArrow');
  if (!panel) return;
  var open = panel.style.display !== 'none';
  panel.style.display = open ? 'none' : 'block';
  if (arrow) arrow.textContent = open ? '▼' : '▲';
  if (!open) { loadBeaconCfg(); loadActiveBeacons(); }
}

function loadBeaconCfg() {
  fetch('/api/beacons/config').then(function(r){return r.json();}).then(function(cfg){
    _beaconCfg = cfg;
    var hint = document.getElementById('beaconCostHint');
    if (hint) hint.textContent = cfg.costGP + ' GP · ' + cfg.durH + 'h duration';
    // Render icon picker
    var row = document.getElementById('beaconIconRow');
    if (row) {
      row.innerHTML = cfg.icons.map(function(ic) {
        return '<span onclick="selectBeaconIcon(\''+ic+'\')" id="beaconIcon_'+encodeURIComponent(ic)+'"'
          +' style="cursor:pointer;font-size:18px;padding:4px 6px;border-radius:6px;border:1px solid '+(ic===_selectedBeaconIcon?'#81d4fa':'rgba(255,255,255,.1)')+';background:'+(ic===_selectedBeaconIcon?'rgba(129,212,250,.15)':'transparent')+'">'
          +ic+'</span>';
      }).join('');
    }
  }).catch(function(){});
}

function selectBeaconIcon(icon) {
  _selectedBeaconIcon = icon;
  document.querySelectorAll('[id^="beaconIcon_"]').forEach(function(el) {
    el.style.borderColor = 'rgba(255,255,255,.1)';
    el.style.background = 'transparent';
  });
  var target = document.getElementById('beaconIcon_'+encodeURIComponent(icon));
  if (target) { target.style.borderColor = '#81d4fa'; target.style.background = 'rgba(129,212,250,.15)'; }
}

function useCurrentPlotForBeacon() {
  if (typeof selectedPlot !== 'undefined' && selectedPlot) {
    var xEl = document.getElementById('beaconXInput');
    var yEl = document.getElementById('beaconYInput');
    if (xEl) xEl.value = selectedPlot.x || 0;
    if (yEl) yEl.value = selectedPlot.y || 0;
  } else {
    showToast(t('beacon_no_plot')||'Select a plot on the map first','error');
  }
}

function loadActiveBeacons() {
  var el = document.getElementById('activeBeaconsPanel');
  if (!el) return;
  el.innerHTML = '<span style="color:#555;font-size:9px">Loading…</span>';
  fetch('/api/beacons/active').then(function(r){return r.json();}).then(function(rows){
    if (!rows.length) { el.innerHTML = '<span style="color:#555;font-size:9px" data-i18n="beacon_none">'+t('beacon_none')+'</span>'; return; }
    el.innerHTML = rows.slice(0,10).map(function(b) {
      var expMs = new Date(b.expires_at) - Date.now();
      var expStr = expMs > 0 ? Math.ceil(expMs/3600000)+'h left' : 'expired';
      return '<div style="display:flex;align-items:center;gap:6px;padding:4px 0;border-bottom:1px solid rgba(255,255,255,.04)">'
        +'<span style="font-size:16px">'+b.icon+'</span>'
        +'<div style="flex:1"><div style="font-size:9px;color:var(--tx)">'+(b.nickname||b.wallet.slice(0,8)+'…')+'</div>'
        +(b.message ? '<div style="font-size:8px;color:var(--tx3)">'+b.message+'</div>' : '')
        +'<div style="font-size:8px;color:#81d4fa">('+b.x+','+b.y+') · '+expStr+'</div></div></div>';
    }).join('');
  }).catch(function(){ el.innerHTML = ''; });
}

function placeBeacon() {
  var w = walletState && walletState.address;
  if (!w) { showToast(t('connect_wallet')||'Connect wallet first','error'); return; }
  var x = parseInt(document.getElementById('beaconXInput').value, 10);
  var y = parseInt(document.getElementById('beaconYInput').value, 10);
  if (isNaN(x) || isNaN(y)) { showToast(t('beacon_coords_required')||'Enter coordinates first','error'); return; }
  var msg = document.getElementById('beaconMsgInput').value.trim() || null;
  var cfg = _beaconCfg;
  var cost = cfg ? cfg.costGP : 30;
  gameConfirm({
    title: t('beacon_place_confirm')||'Place Map Beacon?',
    body: _selectedBeaconIcon+' at ('+x+','+y+')<br>Cost: <b>'+cost+' GP</b>'+(msg ? '<br>Message: '+msg : '')
  }).then(function(ok){
    if (!ok) return;
    fetch('/api/beacons/place', {
      method: 'POST', headers: Object.assign({'Content-Type':'application/json'}, getAuthHeaders()),
      body: JSON.stringify({ wallet: w, x: x, y: y, message: msg, icon: _selectedBeaconIcon })
    }).then(function(r){return r.json();}).then(function(d){
      if (d.error) { showToast(srvErr(d.error),'error'); return; }
      showToast('📡 Beacon placed for '+d.durH+'h!','success');
      document.getElementById('beaconMsgInput').value = '';
      loadActiveBeacons();
      if (typeof refreshWalletInfo === 'function') refreshWalletInfo();
    }).catch(function(e){ showToast(e.message,'error'); });
  });
}

// ── GP Wager System (Migration 130) ──────────────────────────────────────────

var _activeWagerPool = null;

function refreshWagerPools() {
  var el = document.getElementById('openWagerPoolsPanel');
  if (!el) return;
  el.innerHTML = '<div style="color:var(--tx3);font-size:9px;text-align:center;padding:6px">Loading…</div>';
  fetch('/api/wager/pools').then(function(r){return r.json();}).then(function(rows){
    if (!rows || !rows.length) {
      el.innerHTML = '<div style="color:var(--tx3);font-size:9px;text-align:center;padding:6px">'+(t('wager_none')||'No active wager pools right now.')+'</div>';
      return;
    }
    el.innerHTML = rows.map(function(wp){
      var now = Date.now();
      var closesMs = new Date(wp.closes_at).getTime();
      var remMs = Math.max(0, closesMs - now);
      var remH = Math.floor(remMs/3600000);
      var remM = Math.floor((remMs%3600000)/60000);
      var remStr = wp.status === 'locked' ? '🔒 LOCKED' : (remH > 0 ? remH+'h '+remM+'m left' : remM+'m left');
      return '<div style="padding:8px 10px;background:rgba(239,154,154,.04);border:1px solid rgba(239,154,154,.18);border-radius:8px">'
        + '<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">'
          + '<span style="font-size:16px">'+(wp.icon||'🎯')+'</span>'
          + '<div style="flex:1">'
            + '<div style="font-size:10px;color:var(--tx);font-weight:600">'+_escHtml(wp.title)+'</div>'
            + (wp.description ? '<div style="font-size:8px;color:var(--tx3)">'+_escHtml(wp.description)+'</div>' : '')
          + '</div>'
          + '<div style="text-align:right">'
            + '<div style="font-size:9px;color:#ef9a9a">'+wp.total_pot_gp+' GP pot</div>'
            + '<div style="font-size:8px;color:var(--tx3)">⏱ '+remStr+'</div>'
          + '</div>'
        + '</div>'
        + '<div style="display:flex;justify-content:space-between;align-items:center">'
          + '<div style="font-size:8px;color:var(--tx3)">🎯 '+(wp.bet_count||0)+' bets · '+(wp.candidate_count||0)+' candidates</div>'
          + (wp.status === 'open' ? '<button onclick="openWagerBetModal('+wp.id+',\''+_escHtml(wp.title)+'\')" style="font-size:9px;padding:4px 10px;border-radius:10px;background:rgba(239,154,154,.15);border:1px solid rgba(239,154,154,.35);color:#ef9a9a;cursor:pointer;font-family:var(--fn);font-weight:700">'+(t('wager_bet_btn')||'🎯 BET')+'</button>' : '<span style="font-size:8px;color:#555">'+wp.status.toUpperCase()+'</span>')
        + '</div>'
        + '</div>';
    }).join('');
  }).catch(function(e){
    if (el) el.innerHTML = '<div style="color:var(--red);font-size:9px">'+e.message+'</div>';
  });
}

function openWagerBetModal(poolId, title) {
  _activeWagerPool = { id: poolId, title: title };
  var modal = document.getElementById('wagerBetModal');
  var titleEl = document.getElementById('wagerBetTitle');
  var infoEl = document.getElementById('wagerBetInfo');
  var targetEl = document.getElementById('wagerTargetInput');
  if (!modal) return;
  if (titleEl) titleEl.textContent = '🎯 '+title;
  if (infoEl) infoEl.textContent = 'Bet on who you think will top the leaderboard. Correct bettors share the prize pool proportionally.';
  if (targetEl) targetEl.value = '';
  modal.style.display = 'flex';
}

function closeWagerBetModal() {
  var modal = document.getElementById('wagerBetModal');
  if (modal) modal.style.display = 'none';
  _activeWagerPool = null;
}

function submitWagerBet() {
  var w = walletState && walletState.address;
  if (!w) { showToast('Connect wallet first', 'error'); return; }
  if (!_activeWagerPool) return;
  var target = ((document.getElementById('wagerTargetInput')||{}).value||'').trim();
  var amount = parseInt((document.getElementById('wagerAmountInput')||{}).value||'10') || 10;
  if (!target) { showToast('Enter a target wallet or nickname', 'error'); return; }
  gameConfirm({
    title: t('wager_confirm')||'Place Bet?',
    body: 'Bet <b>'+amount+' GP</b> on <b>'+_escHtml(target)+'</b><br>Pool: <b>'+_escHtml(_activeWagerPool.title)+'</b>'
  }).then(function(ok){
    if (!ok) return;
    fetch('/api/wager/bet', {
      method: 'POST', headers: Object.assign({'Content-Type':'application/json'},getAuthHeaders()),
      body: JSON.stringify({ wallet: w, poolId: _activeWagerPool.id, targetWallet: target, gpAmount: amount })
    }).then(function(r){return r.json();}).then(function(d){
      if (d.error) { showToast(srvErr(d.error),'error'); return; }
      showToast('🎯 Bet placed! Good luck!','success');
      closeWagerBetModal();
      refreshWagerPools();
      if (typeof refreshWalletInfo === 'function') refreshWalletInfo();
    }).catch(function(e){ showToast(e.message,'error'); });
  }).catch(function(){});
}

function toggleMyWagers() {
  var panel = document.getElementById('myWagersPanel');
  if (!panel) return;
  if (panel.style.display === 'none') {
    panel.style.display = 'block';
    loadMyWagers();
  } else {
    panel.style.display = 'none';
  }
}

function loadMyWagers() {
  var w = walletState && walletState.address;
  var el = document.getElementById('myWagersPanel');
  if (!el) return;
  if (!w) { el.innerHTML = '<div style="color:var(--tx3);font-size:9px;text-align:center">Connect wallet</div>'; return; }
  el.innerHTML = '<div style="color:var(--tx3);font-size:9px;text-align:center;padding:6px">Loading…</div>';
  fetch('/api/wager/my', { headers: getAuthHeaders() })
    .then(function(r){return r.json();})
    .then(function(rows){
      if (!rows || !rows.length) { el.innerHTML = '<div style="color:var(--tx3);font-size:9px;text-align:center;padding:6px">No bets placed yet</div>'; return; }
      el.innerHTML = rows.map(function(b){
        var won = b.payout > 0;
        var lost = b.status === 'settled' && !won;
        var statusColor = won ? '#a0e8a0' : (lost ? '#e84855' : '#ffb74d');
        var short = b.target_wallet ? (b.target_wallet.slice(0,6)+'…'+b.target_wallet.slice(-4)) : '?';
        return '<div style="display:flex;align-items:center;gap:6px;padding:3px 0;border-bottom:1px solid rgba(255,255,255,.04)">'
          + '<span style="font-size:12px">'+(b.icon||'🎯')+'</span>'
          + '<div style="flex:1">'
            + '<div style="font-size:9px;color:var(--tx)">'+_escHtml(b.title)+'</div>'
            + '<div style="font-size:8px;color:var(--tx3)">Bet on: '+short+'</div>'
          + '</div>'
          + '<div style="text-align:right">'
            + '<div style="font-size:9px;color:var(--gold)">'+b.gp_amount+' GP</div>'
            + (won ? '<div style="font-size:8px;color:#a0e8a0">Won: '+b.payout+' GP</div>' : '')
            + (lost ? '<div style="font-size:8px;color:#e84855">Lost</div>' : '')
          + '</div>'
          + '</div>';
      }).join('');
    }).catch(function(e){ el.innerHTML = '<div style="color:var(--red);font-size:9px">'+e.message+'</div>'; });
}

// ── GP Raffle System (Migration 129) ─────────────────────────────────────────

var _activeRaffle = null;

function refreshRaffles() {
  var el = document.getElementById('openRafflesPanel');
  if (!el) return;
  el.innerHTML = '<div style="color:var(--tx3);font-size:9px;text-align:center;padding:6px">Loading…</div>';
  fetch('/api/raffles').then(function(r){return r.json();}).then(function(rows){
    if (!rows || !rows.length) {
      el.innerHTML = '<div style="color:var(--tx3);font-size:9px;text-align:center;padding:6px">'+(t('raffle_none')||'No open raffles right now.')+'</div>';
      return;
    }
    el.innerHTML = rows.map(function(rf){
      var now = Date.now();
      var endsMs = new Date(rf.ends_at).getTime();
      var remMs = Math.max(0, endsMs - now);
      var remH = Math.floor(remMs/3600000);
      var remM = Math.floor((remMs%3600000)/60000);
      var remStr = remH > 0 ? remH+'h '+remM+'m' : remM+'m';
      var pctFull = rf.max_tickets ? Math.min(100, Math.round(rf.tickets_sold/rf.max_tickets*100)) : null;
      return '<div style="padding:8px 10px;background:rgba(255,204,2,.05);border:1px solid rgba(255,204,2,.18);border-radius:8px">'
        + '<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">'
          + '<span style="font-size:16px">'+(rf.icon||'🎟️')+'</span>'
          + '<div style="flex:1">'
            + '<div style="font-size:10px;color:var(--tx);font-weight:600">'+_escHtml(rf.title)+'</div>'
            + (rf.prize_desc ? '<div style="font-size:8px;color:var(--tx3)">Prize: '+_escHtml(rf.prize_desc)+'</div>' : '')
          + '</div>'
          + '<div style="text-align:right">'
            + '<div style="font-size:9px;color:var(--gold)">'+rf.ticket_cost_gp+' GP / ticket</div>'
            + '<div style="font-size:8px;color:var(--tx3)">⏱ '+remStr+' left</div>'
          + '</div>'
        + '</div>'
        + '<div style="display:flex;justify-content:space-between;align-items:center">'
          + '<div style="font-size:8px;color:var(--tx3)">🎟️ '+rf.tickets_sold+(rf.max_tickets?' / '+rf.max_tickets:'')+' sold · Prize: <span style="color:#a0e8a0">'+rf.prize_pool_gp+' GP</span></div>'
          + '<button onclick="openRaffleBuyModal('+rf.id+',\''+_escHtml(rf.title)+'\','+rf.ticket_cost_gp+')" style="font-size:9px;padding:4px 10px;border-radius:10px;background:rgba(255,204,2,.15);border:1px solid rgba(255,204,2,.35);color:#ffcc02;cursor:pointer;font-family:var(--fn);font-weight:700">'+(t('raffle_buy_btn')||'🎟️ BUY')+'</button>'
        + '</div>'
        + (pctFull !== null ? '<div style="margin-top:5px;height:3px;background:rgba(255,255,255,.06);border-radius:2px"><div style="width:'+pctFull+'%;height:100%;background:#ffcc02;border-radius:2px"></div></div>' : '')
        + '</div>';
    }).join('');
  }).catch(function(e){
    if (el) el.innerHTML = '<div style="color:var(--red);font-size:9px">'+e.message+'</div>';
  });
}

function openRaffleBuyModal(raffleId, title, costGp) {
  _activeRaffle = { id: raffleId, title: title, costGp: costGp };
  var modal = document.getElementById('raffleBuyModal');
  var titleEl = document.getElementById('raffleBuyTitle');
  var infoEl = document.getElementById('raffleBuyInfo');
  var countEl = document.getElementById('raffleBuyCount');
  if (!modal) return;
  if (titleEl) titleEl.textContent = '🎟️ '+title;
  if (infoEl) infoEl.textContent = costGp+' GP per ticket. Buy multiple for better odds!';
  if (countEl) countEl.value = 1;
  _updateRaffleCostPreview();
  modal.style.display = 'flex';
}

function closeRaffleBuyModal() {
  var modal = document.getElementById('raffleBuyModal');
  if (modal) modal.style.display = 'none';
  _activeRaffle = null;
}

function _updateRaffleCostPreview() {
  var el = document.getElementById('raffleCostPreview');
  if (!el || !_activeRaffle) return;
  var count = parseInt((document.getElementById('raffleBuyCount')||{}).value||'1') || 1;
  el.textContent = (count * _activeRaffle.costGp)+' GP total';
}

function submitBuyTickets() {
  var w = walletState && walletState.address;
  if (!w) { showToast('Connect wallet first', 'error'); return; }
  if (!_activeRaffle) return;
  var count = parseInt((document.getElementById('raffleBuyCount')||{}).value||'1') || 1;
  var cost = count * _activeRaffle.costGp;
  gameConfirm({
    title: t('raffle_buy_confirm')||'Buy Raffle Tickets?',
    body: 'Buy <b>'+count+' ticket(s)</b> for <b>'+_escHtml(_activeRaffle.title)+'</b><br>Cost: <b>'+cost+' GP</b>'
  }).then(function(ok){
    if (!ok) return;
    fetch('/api/raffles/buy', {
      method: 'POST', headers: Object.assign({'Content-Type':'application/json'},getAuthHeaders()),
      body: JSON.stringify({ wallet: w, raffleId: _activeRaffle.id, count: count })
    }).then(function(r){return r.json();}).then(function(d){
      if (d.error) { showToast(srvErr(d.error),'error'); return; }
      showToast('🎟️ Got '+count+' ticket(s)! Total: '+d.totalTickets,'success');
      closeRaffleBuyModal();
      refreshRaffles();
      if (typeof refreshWalletInfo === 'function') refreshWalletInfo();
    }).catch(function(e){ showToast(e.message,'error'); });
  }).catch(function(){});
}

function toggleMyRaffles() {
  var panel = document.getElementById('myRafflesPanel');
  if (!panel) return;
  if (panel.style.display === 'none') {
    panel.style.display = 'block';
    loadMyRaffles();
  } else {
    panel.style.display = 'none';
  }
}

function loadMyRaffles() {
  var w = walletState && walletState.address;
  var el = document.getElementById('myRafflesPanel');
  if (!el) return;
  if (!w) { el.innerHTML = '<div style="color:var(--tx3);font-size:9px;text-align:center">Connect wallet</div>'; return; }
  el.innerHTML = '<div style="color:var(--tx3);font-size:9px;text-align:center;padding:6px">Loading…</div>';
  fetch('/api/raffles/my', { headers: getAuthHeaders() })
    .then(function(r){return r.json();})
    .then(function(rows){
      if (!rows || !rows.length) { el.innerHTML = '<div style="color:var(--tx3);font-size:9px;text-align:center;padding:6px">No raffle entries yet</div>'; return; }
      el.innerHTML = rows.map(function(e){
        var isWinner = e.winner_wallet && e.winner_wallet.toLowerCase() === w.toLowerCase();
        var statusColor = {open:'#a0e8a0',completed:'#ffb74d',cancelled:'#555',drawing:'#80deea'}[e.status]||'#888';
        return '<div style="display:flex;align-items:center;gap:6px;padding:4px 0;border-bottom:1px solid rgba(255,255,255,.04)">'
          + '<span style="font-size:14px">'+(isWinner ? '🏆' : (e.icon||'🎟️'))+'</span>'
          + '<div style="flex:1">'
            + '<div style="font-size:9px;color:var(--tx)">'+_escHtml(e.title)+(isWinner ? ' <span style="color:#ffcc02">· WINNER!</span>' : '')+'</div>'
            + '<div style="font-size:8px;color:'+statusColor+'">'+e.status+'</div>'
          + '</div>'
          + '<span style="font-size:9px;color:var(--tx3)">'+e.tickets+' ticket(s)</span>'
          + '</div>';
      }).join('');
    }).catch(function(e){ el.innerHTML = '<div style="color:var(--red);font-size:9px">'+e.message+'</div>'; });
}

// ── Time Capsule (Migration 138) ─────────────────────────────────────────────

var _capsuleCfg = null;

function toggleCapsulePanel() {
  var p = document.getElementById('capsulePanel');
  var a = document.getElementById('capsulePanelArrow');
  if (!p) return;
  if (p.style.display === 'none') {
    p.style.display = 'block';
    if (a) a.textContent = '▲';
    loadCapsuleCfg();
    loadCapsuleRevealed();
    loadCapsuleUpcoming();
  } else {
    p.style.display = 'none';
    if (a) a.textContent = '▼';
  }
}

function loadCapsuleCfg() {
  fetch('/api/capsule/config').then(function(r){return r.json();}).then(function(cfg){
    _capsuleCfg = cfg;
    var hint = document.getElementById('capsuleCostHint');
    if (hint) hint.textContent = cfg.costGP + ' GP';
  }).catch(function(){});
}

function loadCapsuleUpcoming() {
  var el = document.getElementById('capsuleUpcoming');
  if (!el) return;
  fetch('/api/capsule/upcoming').then(function(r){return r.json();}).then(function(d){
    if (d.pending > 0) {
      var nextStr = d.next_reveal ? new Date(d.next_reveal).toLocaleDateString() : '?';
      el.innerHTML = '🔒 <b>'+d.pending+'</b> capsule'+(d.pending>1?'s':'')+' sealed · next reveal: '+nextStr;
    } else {
      el.textContent = t('capsule_none_pending')||'No capsules buried yet. Be the first!';
    }
  }).catch(function(){});
}

function loadCapsuleRevealed() {
  var el = document.getElementById('capsuleRevealedList');
  if (!el) return;
  el.innerHTML = '<span style="color:var(--tx3)">Loading…</span>';
  fetch('/api/capsule/revealed').then(function(r){return r.json();}).then(function(rows){
    if (!rows.length) { el.innerHTML = '<span style="color:var(--tx3)" data-i18n="capsule_none">No revealed capsules yet.</span>'; return; }
    el.innerHTML = rows.map(function(r){
      var revStr = new Date(r.revealed_at).toLocaleDateString();
      return '<div style="padding:6px 8px;background:rgba(128,222,234,.04);border:1px solid rgba(128,222,234,.08);border-radius:6px;margin-bottom:4px">'
        +'<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:2px">'
          +'<span style="font-size:9px;color:#80deea;font-family:var(--fn);font-weight:700">'+_escHtml(r.nickname||shortAddr(r.wallet))+'</span>'
          +'<span style="font-size:8px;color:var(--tx3)">'+revStr+'</span>'
        +'</div>'
        +'<div style="font-size:9px;color:var(--tx2);font-style:italic">'+_escHtml(r.message)+'</div>'
      +'</div>';
    }).join('');
  }).catch(function(e){ el.innerHTML = '<span style="color:var(--mars)">'+e.message+'</span>'; });
}

function buryCapsule() {
  var wallet = ((walletState&&walletState.address)||getMyWallet()||'').toLowerCase();
  var msg    = ((document.getElementById('capsuleMsgInput')||{}).value || '').trim();
  var days   = parseInt((document.getElementById('capsuleDaysInput')||{}).value, 10);
  if (!wallet) { showToast(t('connect_wallet')||'Connect wallet first', 'error'); return; }
  if (!msg)    { showToast(t('capsule_msg_required')||'Enter a message', 'error'); return; }
  if (isNaN(days) || days < 1) { showToast(t('capsule_days_required')||'Enter days > 0', 'error'); return; }
  var costGP = _capsuleCfg ? _capsuleCfg.costGP : 35;
  var revealDate = new Date(Date.now() + days * 86400000).toLocaleDateString();
  gameConfirm({
    title: t('capsule_bury_confirm') || 'Bury Time Capsule?',
    body:  '"'+msg.slice(0,40)+(msg.length>40?'…':'')+'"<br>Reveals: <b>'+revealDate+'</b><br>Cost: <b>'+costGP+' GP</b>'
  }).then(function(ok){
    if (!ok) return;
    fetch('/api/capsule/bury', {
      method: 'POST',
      headers: Object.assign({'Content-Type':'application/json'},getAuthHeaders()),
      body: JSON.stringify({ wallet, message: msg, revealInDays: days })
    }).then(function(r){return r.json();}).then(function(d){
      if (d.error) { showToast(srvErr(d.error),'error'); return; }
      showToast(t('capsule_buried')||'⏳ Capsule buried!');
      document.getElementById('capsuleMsgInput').value = '';
      document.getElementById('capsuleCharCount').textContent = '0/280';
      loadCapsuleUpcoming();
      if (typeof refreshWalletInfo === 'function') refreshWalletInfo();
    }).catch(function(e){ showToast(e.message,'error'); });
  });
}

// ── Colony Fund Donation Wall (Migration 134) ────────────────────────────────

function loadDonationWall() {
  var statsEl = document.getElementById('colonyfundStats');
  var wallEl  = document.getElementById('donationWallPanel');
  if (!wallEl) return;
  wallEl.innerHTML = '<span style="color:#555;font-size:9px">Loading…</span>';
  fetch('/api/donation/wall').then(function(r){return r.json();}).then(function(d){
    var tot = d.totals || {};
    if (statsEl) {
      statsEl.innerHTML = [
        '<span style="font-size:9px;color:#80cbc4;font-family:var(--fn)">🔥 <b>'+((tot.colony_fund_total||0).toLocaleString())+'</b> GP burned</span>',
        '<span style="font-size:9px;color:var(--tx3)">'+((tot.donor_count||0))+' donors · '+(tot.donation_count||0)+' donations</span>',
      ].join('');
    }
    var rows = d.recent || [];
    if (!rows.length) { wallEl.innerHTML = '<span style="color:#555;font-size:9px" data-i18n="donation_none">'+t('donation_none')+'</span>'; return; }
    wallEl.innerHTML = rows.slice(0,15).map(function(r) {
      var when = new Date(r.created_at);
      var timeStr = when.toLocaleDateString();
      return '<div style="display:flex;align-items:center;gap:6px;padding:4px 0;border-bottom:1px solid rgba(255,255,255,.04)">'
        +'<span style="font-size:14px">🏛️</span>'
        +'<div style="flex:1">'
          +'<span style="font-size:9px;color:var(--tx);font-weight:700">'+(r.nickname||r.wallet.slice(0,10)+'…')+'</span>'
          +'<span style="font-size:9px;color:#80cbc4;margin-left:6px;font-family:var(--fn)">+'+r.amount_gp+' GP</span>'
          +(r.message ? '<div style="font-size:8px;color:var(--tx3);font-style:italic">'+r.message+'</div>' : '')
        +'</div>'
        +'<span style="font-size:8px;color:var(--tx3)">'+timeStr+'</span>'
        +'</div>';
    }).join('');
  }).catch(function(){ if(wallEl) wallEl.innerHTML = ''; });
}

function submitDonation() {
  var w = walletState && walletState.address;
  if (!w) { showToast(t('connect_wallet')||'Connect wallet first','error'); return; }
  var amount = parseInt(document.getElementById('donationAmountInput').value, 10);
  if (!amount || amount < 1) { showToast(t('donation_min_hint')||'Enter an amount','error'); return; }
  var msg = document.getElementById('donationMsgInput').value.trim() || null;
  gameConfirm({
    title: t('donation_confirm')||'Donate to Colony Fund?',
    body: 'Donate <b>'+amount+' GP</b> to the Colony Fund. This GP is permanently burned.'+(msg?'<br>Message: '+msg:'')
  }).then(function(ok){
    if (!ok) return;
    fetch('/api/donation/donate', {
      method:'POST', headers:Object.assign({'Content-Type':'application/json'}, getAuthHeaders()),
      body: JSON.stringify({ wallet: w, amount: amount, message: msg })
    }).then(function(r){return r.json();}).then(function(d){
      if (d.error) { showToast(srvErr(d.error),'error'); return; }
      showToast('🏛️ '+amount+' GP donated to Colony Fund!','success');
      document.getElementById('donationAmountInput').value = '';
      document.getElementById('donationMsgInput').value = '';
      loadDonationWall();
      if (typeof refreshWalletInfo === 'function') refreshWalletInfo();
    }).catch(function(e){ showToast(e.message,'error'); });
  });
}

var _topDonorsOpen = false;
function toggleTopDonors() {
  _topDonorsOpen = !_topDonorsOpen;
  var el = document.getElementById('topDonorsPanel');
  if (!el) return;
  el.style.display = _topDonorsOpen ? 'block' : 'none';
  if (_topDonorsOpen) loadTopDonors();
}

function loadTopDonors() {
  var el = document.getElementById('topDonorsPanel');
  if (!el) return;
  fetch('/api/donation/wall').then(function(r){return r.json();}).then(function(d){
    var top = d.top || [];
    el.innerHTML = top.length ? '<div style="font-size:9px;color:#80cbc4;font-family:var(--fn);font-weight:700;letter-spacing:1.5px;margin-bottom:4px">'+t('donation_top_title')+'</div>'
      + top.map(function(r, i) {
          var medal = ['🥇','🥈','🥉'][i] || (i+1)+'.';
          return '<div style="display:flex;align-items:center;gap:6px;padding:3px 0">'
            +'<span>'+medal+'</span>'
            +'<span style="flex:1;font-size:9px;color:var(--tx)">'+(r.nickname||r.wallet.slice(0,10)+'…')+'</span>'
            +'<span style="font-size:9px;color:#80cbc4;font-family:var(--fn)">'+r.total_gp.toLocaleString()+' GP</span>'
            +'</div>';
        }).join('')
      : '<span style="color:#555;font-size:9px">'+t('donation_none')+'</span>';
  }).catch(function(){ el.innerHTML = ''; });
}

// ── Colony Journal (Migration 146) ───────────────────────────────────────────

var _journalCfg = null;

function toggleJournalPanel() {
  var p = document.getElementById('journalPanel');
  var a = document.getElementById('journalPanelArrow');
  if (!p) return;
  var open = p.style.display !== 'none';
  p.style.display = open ? 'none' : '';
  if (a) a.textContent = open ? '▼' : '▲';
  if (!open) { loadJournalFeed(); loadJournalCfg(); }
}

function loadJournalCfg() {
  if (_journalCfg) { _applyJournalCfg(); return; }
  fetch('/api/journal/config').then(function(r){return r.json();}).then(function(d){
    _journalCfg = d;
    _applyJournalCfg();
  }).catch(function(){});
}

function _applyJournalCfg() {
  var hint = document.getElementById('journalCostHint');
  if (hint && _journalCfg) hint.textContent = t('journal_cost_hint').replace('{gp}', _journalCfg.costGP || 60);
}

function openJournalWrite() {
  loadJournalCfg();
  var f = document.getElementById('journalWriteForm');
  var b = document.getElementById('journalWriteBtn');
  if (f) f.style.display = '';
  if (b) b.style.display = 'none';
}

function loadJournalFeed() {
  var el = document.getElementById('journalFeedList');
  if (!el) return;
  if (typeof _publicHudQuietRemainingMs === 'function' && _publicHudQuietRemainingMs() > 0) return;
  el.innerHTML = '<span style="color:#555;font-size:9px">Loading…</span>';
  var req = typeof _guardedJsonFetch === 'function'
    ? _guardedJsonFetch('journal-feed', '/api/journal/feed', {minGap:30000, backoffMs:120000})
    : fetch('/api/journal/feed').then(function(r){return r.json();});
  req.then(function(entries){
    if (!entries) return;
    if (!entries.length) {
      el.innerHTML = '<span style="color:#555;font-size:9px">'+t('journal_empty')+'</span>';
      return;
    }
    el.innerHTML = entries.map(function(e) {
      var ago = _timeAgo(new Date(e.created_at));
      return '<div style="background:rgba(128,203,196,.04);border:1px solid rgba(128,203,196,.12);border-radius:8px;padding:8px 10px">'
        +'<div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:4px">'
        +'<span style="font-size:9px;color:#80cbc4;font-family:var(--fn);font-weight:700">'+escHtml(e.title)+'</span>'
        +'<span style="font-size:8px;color:var(--tx3)">'+ago+'</span>'
        +'</div>'
        +'<div style="font-size:9px;color:var(--tx2);line-height:1.5;margin-bottom:4px">'+escHtml(e.content)+'</div>'
        +'<div style="font-size:8px;color:var(--tx3)">— '+(e.player_name||e.wallet.slice(0,10)+'…')+' · '+e.gp_paid+' GP</div>'
        +'</div>';
    }).join('');
  }).catch(function(){ el.innerHTML = '<span style="color:var(--mars);font-size:9px">Failed to load</span>'; });
}

function publishJournalEntry() {
  var w = walletState && walletState.address;
  if (!w) { gameAlert(t('journal_login_required')); return; }
  var title   = ((document.getElementById('journalTitleInput')||{}).value || '').trim();
  var content = ((document.getElementById('journalContentInput')||{}).value || '').trim();
  if (!title)   { gameAlert(t('journal_title_required')); return; }
  if (!content) { gameAlert(t('journal_content_required')); return; }
  var costGP = (_journalCfg && _journalCfg.costGP) || 60;
  gameConfirm({icon:'📖', title: t('journal_confirm_title') || 'PUBLISH JOURNAL',
    body: (t('journal_confirm_body') || 'Spend {gp} GP to publish?').replace('{gp}', costGP).replace('{title}', title),
    confirmText: 'PUBLISH'
  }).then(function(ok) {
    if (!ok) return;
    fetch('/api/journal/publish', {
      method: 'POST',
      headers: Object.assign({ 'Content-Type': 'application/json' }, getAuthHeaders()),
      body: JSON.stringify({ wallet: w, title: title, content: content })
    }).then(function(r){return r.json();}).then(function(d){
      if (d.error) { gameAlert(d.error); return; }
      showToast('📖 ' + t('journal_published'));
      document.getElementById('journalTitleInput').value = '';
      document.getElementById('journalContentInput').value = '';
      document.getElementById('journalCharCount').textContent = '0/500';
      document.getElementById('journalWriteForm').style.display = 'none';
      document.getElementById('journalWriteBtn').style.display = '';
      loadJournalFeed();
      refreshGP && refreshGP();
    }).catch(function(e){ gameAlert(e.message); });
  });
}

// ── Colony Milestone (Migration 150) ─────────────────────────────────────────
var _milestoneCfg = null;
var _milestoneFilter = null;

var _MILESTONE_CAT_ICONS  = { CONQUEST:'⚔️', DISCOVERY:'🔭', LOSS:'💔', ALLIANCE:'🤝', ACHIEVEMENT:'🏆', LEGACY:'👑' };
var _MILESTONE_CAT_COLORS = { CONQUEST:'#ef9a9a', DISCOVERY:'#80deea', LOSS:'#90a4ae', ALLIANCE:'#a5d6a7', ACHIEVEMENT:'#ffd54f', LEGACY:'#ce93d8' };

function toggleMilestonePanel() {
  var p = document.getElementById('milestonePanel');
  var a = document.getElementById('milestonePanelArrow');
  if (!p) return;
  var open = p.style.display !== 'none';
  p.style.display = open ? 'none' : '';
  if (a) a.textContent = open ? '▼' : '▲';
  if (!open) { loadMilestoneFeed(); loadMilestoneCfg(); _buildMilestoneFilters(); }
}

function loadMilestoneCfg() {
  if (_milestoneCfg) { _applyMilestoneCfg(); return; }
  fetch('/api/milestone/config').then(function(r){return r.json();}).then(function(d){
    _milestoneCfg = d;
    _applyMilestoneCfg();
  }).catch(function(){});
}

function _applyMilestoneCfg() {
  var hint = document.getElementById('milestoneCostHint');
  if (hint && _milestoneCfg) hint.textContent = t('milestone_cost_hint').replace('{gp}', _milestoneCfg.costGP||45);
}

function _buildMilestoneFilters() {
  var el = document.getElementById('milestoneCatFilters');
  if (!el) return;
  var cats = ['CONQUEST','DISCOVERY','LOSS','ALLIANCE','ACHIEVEMENT','LEGACY'];
  el.innerHTML = '<button onclick="setMilestoneFilter(null)" style="font-size:8px;padding:2px 8px;border-radius:10px;border:1px solid rgba(255,213,79,.3);background:rgba(255,213,79,.08);color:#ffd54f;cursor:pointer">ALL</button>'
    + cats.map(function(c) {
      var ic = _MILESTONE_CAT_ICONS[c] || '';
      var col = _MILESTONE_CAT_COLORS[c] || '#ffd54f';
      return '<button onclick="setMilestoneFilter(\''+c+'\')" style="font-size:8px;padding:2px 8px;border-radius:10px;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.04);color:'+col+';cursor:pointer">'+ic+' '+c+'</button>';
    }).join('');
}

function setMilestoneFilter(cat) {
  _milestoneFilter = cat;
  loadMilestoneFeed();
}

function openMilestoneWrite() {
  loadMilestoneCfg();
  var f = document.getElementById('milestoneWriteForm');
  var b = document.getElementById('milestoneWriteBtn');
  if (f) f.style.display = '';
  if (b) b.style.display = 'none';
}

function loadMilestoneFeed() {
  var el = document.getElementById('milestoneFeedList');
  if (!el) return;
  if (typeof _publicHudQuietRemainingMs === 'function' && _publicHudQuietRemainingMs() > 0) return;
  el.innerHTML = '<span style="color:#555;font-size:9px">Loading…</span>';
  var url = '/api/milestone/feed?limit=20';
  if (_milestoneFilter) url += '&category='+encodeURIComponent(_milestoneFilter);
  var req = typeof _guardedJsonFetch === 'function'
    ? _guardedJsonFetch('milestone-feed' + (_milestoneFilter || ''), url, {minGap:30000, backoffMs:120000})
    : fetch(url).then(function(r){return r.json();});
  req.then(function(items){
    if (!items) return;
    if (!items.length) {
      el.innerHTML = '<span style="color:#555;font-size:9px">'+t('milestone_empty')+'</span>';
      return;
    }
    el.innerHTML = items.map(function(m) {
      var ic    = _MILESTONE_CAT_ICONS[m.category]  || '🏆';
      var col   = _MILESTONE_CAT_COLORS[m.category] || '#ffd54f';
      var ago   = _timeAgo(new Date(m.created_at));
      return '<div style="background:rgba(255,213,79,.03);border:1px solid rgba(255,213,79,.1);border-left:3px solid '+col+';border-radius:6px;padding:7px 9px">'
        +'<div style="display:flex;justify-content:space-between;margin-bottom:3px">'
        +'<span style="font-size:9px;color:'+col+';font-family:var(--fn);font-weight:700">'+ic+' '+escHtml(m.title)+'</span>'
        +'<span style="font-size:8px;color:var(--tx3)">'+ago+'</span>'
        +'</div>'
        +'<div style="font-size:9px;color:var(--tx2);line-height:1.4;margin-bottom:3px">'+escHtml(m.description)+'</div>'
        +'<div style="font-size:8px;color:var(--tx3)">— '+(m.player_name||m.wallet.slice(0,10)+'…')+' · '+m.gp_paid+' GP</div>'
        +'</div>';
    }).join('');
  }).catch(function(){ el.innerHTML = '<span style="color:var(--mars);font-size:9px">Failed to load</span>'; });
}

function recordMilestone() {
  var w = walletState && walletState.address;
  if (!w) { gameAlert(t('milestone_login_required')); return; }
  var cat   = (document.getElementById('milestoneCatSelect')||{}).value || 'ACHIEVEMENT';
  var title = ((document.getElementById('milestoneTitleInput')||{}).value||'').trim();
  var desc  = ((document.getElementById('milestoneDescInput')||{}).value||'').trim();
  if (!title) { gameAlert(t('milestone_title_required')); return; }
  if (!desc)  { gameAlert(t('milestone_desc_required'));  return; }
  var costGP = (_milestoneCfg && _milestoneCfg.costGP) || 45;
  var ic = _MILESTONE_CAT_ICONS[cat] || '🏆';
  gameConfirm({icon: ic, title: t('milestone_confirm_title') || 'RECORD MILESTONE',
    body: (t('milestone_confirm_body') || 'Spend {gp} GP to record?').replace('{gp}', costGP).replace('{cat}', ic+' '+cat).replace('{title}', title),
    confirmText: 'RECORD'
  }).then(function(ok) {
    if (!ok) return;
    fetch('/api/milestone/record', {
      method: 'POST',
      headers: Object.assign({ 'Content-Type': 'application/json' }, getAuthHeaders()),
      body: JSON.stringify({ wallet: w, category: cat, title: title, description: desc })
    }).then(function(r){return r.json();}).then(function(d){
      if (d.error) { gameAlert(d.error); return; }
      showToast('🏆 '+t('milestone_recorded'));
      document.getElementById('milestoneTitleInput').value = '';
      document.getElementById('milestoneDescInput').value  = '';
      document.getElementById('milestoneCharCount').textContent = '0/200';
      document.getElementById('milestoneWriteForm').style.display = 'none';
      document.getElementById('milestoneWriteBtn').style.display  = '';
      loadMilestoneFeed();
      refreshGP && refreshGP();
    }).catch(function(e){ gameAlert(e.message); });
  });
}

// ── Colony Announcement (Migration 148) ──────────────────────────────────────
var _gpAnnounceCfg = null;

function toggleAnnouncePanel() {
  var p = document.getElementById('gpAnnouncePanel');
  var a = document.getElementById('gpAnnouncePanelArrow');
  if (!p) return;
  var open = p.style.display !== 'none';
  p.style.display = open ? 'none' : '';
  if (a) a.textContent = open ? '▼' : '▲';
  if (!open) loadGPAnnounceCfg();
}

function loadGPAnnounceCfg() {
  if (_gpAnnounceCfg) { _applyGPAnnounceCfg(); return; }
  fetch('/api/announce/config').then(function(r){return r.json();}).then(function(d){
    _gpAnnounceCfg = d;
    _applyGPAnnounceCfg();
  }).catch(function(){});
}

function _applyGPAnnounceCfg() {
  updateGPAnnounceCost();
}

function updateGPAnnounceCost() {
  if (!_gpAnnounceCfg) return;
  var dur = parseInt((document.getElementById('gpAnnounceDurInput')||{}).value||30, 10);
  var blocks = Math.ceil(dur / 30);
  var cost = (_gpAnnounceCfg.costGP || 80) * blocks;
  var hint = document.getElementById('gpAnnounceCostHint');
  if (hint) hint.textContent = 'Cost: ' + cost + ' GP';
}

function postGPAnnouncement() {
  var w = walletState && walletState.address;
  if (!w) { gameAlert(t('gpannounce_login_required')); return; }
  var msg = ((document.getElementById('gpAnnounceMsgInput')||{}).value||'').trim();
  var dur = parseInt((document.getElementById('gpAnnounceDurInput')||{}).value||30, 10);
  if (!msg) { gameAlert(t('gpannounce_msg_required')); return; }
  var blocks = Math.ceil(dur / 30);
  var costGP = ((_gpAnnounceCfg && _gpAnnounceCfg.costGP) || 80) * blocks;
  gameConfirm({icon:'📢', title: t('gpannounce_confirm_title') || 'POST ANNOUNCEMENT',
    body: (t('gpannounce_confirm_body') || 'Spend {gp} GP for {dur}m announcement?').replace('{gp}', costGP).replace('{dur}', dur),
    confirmText: 'POST'
  }).then(function(ok) {
    if (!ok) return;
    fetch('/api/announce/post', {
      method: 'POST',
      headers: Object.assign({ 'Content-Type': 'application/json' }, getAuthHeaders()),
      body: JSON.stringify({ wallet: w, message: msg, durationM: dur })
    }).then(function(r){return r.json();}).then(function(d){
      if (d.error) { gameAlert(d.error); return; }
      showToast('📢 ' + t('gpannounce_posted'));
      document.getElementById('gpAnnounceMsgInput').value = '';
      document.getElementById('gpAnnounceCharCount').textContent = '0/80';
      refreshGP && refreshGP();
      // Show it immediately
      if (typeof showAnnounce === 'function') showAnnounce('📢 ' + msg);
    }).catch(function(e){ gameAlert(e.message); });
  });
}

// ── Community Polls (Migration 135) ──────────────────────────────────────────

var _pollsCfg = null;

function _pollEsc(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, function(ch) {
    return ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[ch];
  });
}

function _pollReadFetch(key, url, auth) {
  var walletKey = (walletState && walletState.address) ? String(walletState.address).toLowerCase() : 'public';
  if (typeof _guardedJsonFetch === 'function') {
    return _guardedJsonFetch('polls:' + key + ':' + walletKey, url, {
      minGap: 15000,
      backoffMs: 120000,
      fetchOptions: auth ? { headers: getAuthHeaders() } : {}
    });
  }
  return fetch(url, auth ? { headers: getAuthHeaders() } : {}).then(function(r){ return r.json(); });
}

function refreshPolls() {
  var el = document.getElementById('activePollsPanel');
  if (!el) return;
  el.innerHTML = '<div style="color:var(--tx3);font-size:9px;text-align:center;padding:6px">Loading polls…</div>';
  _pollReadFetch('list', '/api/polls', true).then(function(polls){
    if (!polls) return;
    if (!polls.length) {
      el.innerHTML = '<div style="color:var(--tx3);font-size:9px;text-align:center;padding:6px" data-i18n="poll_none">'+t('poll_none')+'</div>';
      return;
    }
    el.innerHTML = polls.map(function(p) {
      var opts = p.options || [];
      var expMs = new Date(p.ends_at) - Date.now();
      var expStr = expMs > 0 ? (Math.ceil(expMs/3600000))+'h left' : 'closed';
      var total = p.vote_count || 0;
      var myVote = p.my_vote;
      return '<div style="background:rgba(165,214,167,.05);border:1px solid rgba(165,214,167,.15);border-radius:8px;padding:10px">'
        +'<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px">'
          +'<div style="font-size:10px;color:var(--tx);font-weight:700;flex:1">'+_pollEsc(p.question)+'</div>'
          +'<span style="font-size:8px;color:#a5d6a7;white-space:nowrap;margin-left:6px">'+expStr+'</span>'
        +'</div>'
        +'<div style="font-size:8px;color:var(--tx3);margin-bottom:8px">by '+_pollEsc(p.nickname || (p.wallet ? p.wallet.slice(0,10)+'…' : '?'))+' · '+total+' votes</div>'
        + opts.map(function(opt, i) {
            var pct = total > 0 ? 0 : 0;
            var isMyVote = myVote === i;
            return '<button onclick="votePoll('+p.id+','+i+')" style="width:100%;margin-bottom:3px;padding:6px 10px;text-align:left;background:'+(isMyVote?'rgba(165,214,167,.2)':'rgba(255,255,255,.04)')+';border:1px solid '+(isMyVote?'rgba(165,214,167,.5)':'rgba(255,255,255,.1)')+';border-radius:6px;color:var(--tx);cursor:pointer;font-family:var(--fn);font-size:9px">'
              +'<span>'+(isMyVote?'✓ ':'')+_pollEsc(opt)+'</span>'
              +'</button>';
          }).join('')
        +'</div>';
    }).join('');
  }).catch(function(){ el.innerHTML = ''; });
  // Load config for cost display
  if (!_pollsCfg) {
    _pollReadFetch('config', '/api/polls/config', false).then(function(cfg){
      if (!cfg) return;
      _pollsCfg = cfg;
      var hint = document.getElementById('pollCostHint');
      if (hint) hint.textContent = cfg.costGP + ' GP';
    }).catch(function(){});
  }
}

function votePoll(pollId, optionIdx) {
  var w = walletState && walletState.address;
  if (!w) { showToast(t('connect_wallet')||'Connect wallet first','error'); return; }
  fetch('/api/polls/vote', {
    method: 'POST', headers: Object.assign({'Content-Type':'application/json'},getAuthHeaders()),
    body: JSON.stringify({ wallet: w, pollId: pollId, optionIdx: optionIdx })
  }).then(function(r){return r.json();}).then(function(d){
    if (d.error) { showToast(srvErr(d.error),'error'); return; }
    showToast('📊 Vote cast!','success');
    refreshPolls();
  }).catch(function(e){ showToast(e.message,'error'); });
}

function openCreatePollModal() {
  var w = walletState && walletState.address;
  if (!w) { showToast(t('connect_wallet')||'Connect wallet first','error'); return; }
  var hint = document.getElementById('pollCostHint');
  if (hint && _pollsCfg) hint.textContent = _pollsCfg.costGP + ' GP';
  document.getElementById('createPollModal').style.display = 'flex';
}

function closeCreatePollModal() {
  document.getElementById('createPollModal').style.display = 'none';
}

function addPollOption() {
  var container = document.getElementById('pollOptionsContainer');
  var count = container.querySelectorAll('.poll-option-input').length;
  var max = _pollsCfg ? _pollsCfg.maxOpts : 6;
  if (count >= max) { showToast('Max '+max+' options','warn'); return; }
  var input = document.createElement('input');
  input.className = 'poll-option-input';
  input.placeholder = 'Option '+(count+1);
  input.style.cssText = 'width:100%;margin-bottom:4px;background:rgba(165,214,167,.06);border:1px solid rgba(165,214,167,.2);color:var(--tx);padding:6px 10px;border-radius:6px;font-size:10px;font-family:var(--fn);box-sizing:border-box';
  container.appendChild(input);
}

function submitCreatePoll() {
  var w = walletState && walletState.address;
  if (!w) return;
  var q = document.getElementById('pollQuestionInput').value.trim();
  if (!q) { showToast(t('poll_question_required')||'Enter a question','error'); return; }
  var opts = Array.from(document.querySelectorAll('.poll-option-input')).map(function(el){ return el.value.trim(); }).filter(Boolean);
  if (opts.length < 2) { showToast(t('poll_min_options_hint')||'Need at least 2 options','error'); return; }
  var dur = parseInt(document.getElementById('pollDurationInput').value, 10) || 24;
  var cost = _pollsCfg ? _pollsCfg.costGP : 40;
  gameConfirm({
    title: t('poll_publish_confirm')||'Publish Poll?',
    body: 'Cost: <b>'+cost+' GP</b><br>'+opts.length+' options · '+dur+'h duration'
  }).then(function(ok){
    if (!ok) return;
    fetch('/api/polls/create', {
      method: 'POST', headers: Object.assign({'Content-Type':'application/json'},getAuthHeaders()),
      body: JSON.stringify({ wallet: w, question: q, options: opts, durationH: dur })
    }).then(function(r){return r.json();}).then(function(d){
      if (d.error) { showToast(srvErr(d.error),'error'); return; }
      showToast('📊 Poll published!','success');
      closeCreatePollModal();
      refreshPolls();
      if (typeof refreshWalletInfo === 'function') refreshWalletInfo();
    }).catch(function(e){ showToast(e.message,'error'); });
  });
}

// ── Territory Description (Migration 137) ────────────────────────────────────

var _tdescCfg = null;

function toggleTdescPanel() {
  var p = document.getElementById('tdescPanel');
  var a = document.getElementById('tdescPanelArrow');
  if (!p) return;
  if (p.style.display === 'none') {
    p.style.display = 'block';
    if (a) a.textContent = '▲';
    loadTdescCfg();
    loadMyTdescs();
  } else {
    p.style.display = 'none';
    if (a) a.textContent = '▼';
  }
}

function loadTdescCfg() {
  var hint = document.getElementById('tdescCostHint');
  fetch('/api/tdesc/config').then(function(r){return r.json();}).then(function(d){
    _tdescCfg = d;
    if (hint) {
      if (d.firstGP === 0) {
        var rawHint = t('tdesc_free_hint') || 'First description is free. Updates cost {cost} GP.';
        hint.textContent = rawHint.replace('{cost}', d.changeGP || 0);
      } else {
        hint.textContent = 'First: '+d.firstGP+' GP · Updates: '+d.changeGP+' GP';
      }
    }
  }).catch(function(){});
}

function useMyClaim() {
  // Pre-fill with the currently selected claim if available
  var sel = window.selectedPlot;
  if (!sel || !sel.claimId) { showToast(t('tdesc_no_claim')||'Select a territory first', 'error'); return; }
  var inp = document.getElementById('tdescClaimInput');
  if (inp) { inp.value = sel.claimId; loadClaimDescriptionPreview(); }
}

function loadClaimDescriptionPreview() {
  var inp = document.getElementById('tdescClaimInput');
  if (!inp || !inp.value) return;
  var claimId = parseInt(inp.value, 10);
  if (isNaN(claimId) || claimId < 1) return;
  var wrap = document.getElementById('tdescCurrentWrap');
  var text = document.getElementById('tdescCurrentText');
  fetch('/api/tdesc/claim/'+claimId).then(function(r){return r.json();}).then(function(d){
    if (d.description) {
      if (wrap) wrap.style.display = 'block';
      if (text) text.textContent = d.description.description || '';
    } else {
      if (wrap) wrap.style.display = 'none';
    }
  }).catch(function(){});
}

function loadMyTdescs() {
  var listEl = document.getElementById('myTdescList');
  if (!listEl) return;
  var wallet = ((walletState&&walletState.address)||getMyWallet()||'').toLowerCase();
  if (!wallet) { listEl.textContent = '—'; return; }
  listEl.innerHTML = '<span style="color:var(--tx3)">Loading…</span>';
  fetch('/api/tdesc/my', { headers: getAuthHeaders() }).then(function(r){return r.json();}).then(function(rows){
    if (!rows.length) { listEl.innerHTML = '<span style="color:var(--tx3)" data-i18n="tdesc_none">No descriptions set yet.</span>'; return; }
    // [v7.214 fix] description text 인라인 onclick 안에 들어가 escape 깨짐 위험.
    //   index-based cache + data-action + delegated listener.
    window._tdescEditRows = rows.slice();
    listEl.innerHTML = rows.map(function(r, idx){
      var name = r.claim_name ? r.claim_name : '#'+r.claim_id;
      return '<div style="padding:6px 8px;background:rgba(255,171,145,.04);border:1px solid rgba(255,171,145,.1);border-radius:6px;margin-bottom:4px">'
        +'<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:2px">'
          +'<span style="font-size:9px;color:#ffab91;font-family:var(--fn);font-weight:700">'+_escHtml(name)+'</span>'
          +'<button type="button" data-action="tdescEdit" data-idx="'+idx+'" style="font-size:8px;background:rgba(255,171,145,.1);border:1px solid rgba(255,171,145,.2);color:#ffab91;padding:2px 6px;border-radius:4px;cursor:pointer">EDIT</button>'
        +'</div>'
        +'<div style="font-size:9px;color:var(--tx2)">'+_escHtml(r.description)+'</div>'
      +'</div>';
    }).join('');
    // Delegated listener — 한 번만 등록.
    if (!listEl.dataset.delegated) {
      listEl.dataset.delegated = '1';
      listEl.addEventListener('click', function(ev){
        var btn = ev.target && ev.target.closest ? ev.target.closest('button[data-action="tdescEdit"]') : null;
        if (!btn) return;
        ev.stopPropagation();
        var idx = parseInt(btn.getAttribute('data-idx'), 10);
        var row = (window._tdescEditRows || [])[idx];
        if (!row) return;
        console.log('[BTN] tdescEdit triggered', row.claim_id);
        prefillTdescEdit(row.claim_id, row.description);
      });
    }
  }).catch(function(e){ listEl.innerHTML = '<span style="color:var(--mars)">'+e.message+'</span>'; });
}

function prefillTdescEdit(claimId, text) {
  var inp = document.getElementById('tdescClaimInput');
  var ta  = document.getElementById('tdescTextInput');
  var cnt = document.getElementById('tdescCharCount');
  if (inp) inp.value  = claimId;
  if (ta)  { ta.value = text; if (cnt) cnt.textContent = text.length+'/200'; }
  loadClaimDescriptionPreview();
  document.getElementById('tdescPanel').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

async function saveTdescDescription() {
  var wallet  = ((walletState&&walletState.address)||getMyWallet()||'').toLowerCase();
  var claimId = parseInt((document.getElementById('tdescClaimInput')||{}).value, 10);
  var text    = ((document.getElementById('tdescTextInput')||{}).value || '').trim();
  if (!wallet) { showToast(t('connect_wallet')||'Connect wallet first','error'); return; }
  if (isNaN(claimId) || claimId < 1) { showToast(t('tdesc_claim_required')||'Enter a claim #','error'); return; }
  if (!text) { showToast(t('tdesc_required')||'Enter a description','error'); return; }
  var cfg = _tdescCfg || {};
  var cost = cfg.firstGP != null ? cfg.firstGP : 0; // assume first for confirmation (actual check server-side)
  var costLabel = cost > 0 ? cost+' GP' : (t('tdesc_free')||'Free');
  var ok = await gameConfirm({
    title: t('tdesc_save_confirm') || 'Save Territory Description?',
    body:  '<div style="margin-bottom:6px;color:#ccc;font-size:11px">' + text + '</div>',
    info:  [{ k: t('cost')||'Cost', v: costLabel }],
    confirmText: t('save')||'SAVE',
  });
  if (!ok) return;
  try {
    var r = await fetch('/api/tdesc/set', {
      method: 'POST',
      headers: Object.assign({'Content-Type':'application/json'}, getAuthHeaders()),
      body: JSON.stringify({ wallet, claimId, text })
    });
    var d = await r.json();
    if (d.error) { showToast(srvErr(d.error),'error'); return; }
    showToast(t('tdesc_saved')||'✅ Description saved!');
    loadMyTdescs();
    loadClaimDescriptionPreview();
    if (typeof refreshWalletInfo === 'function') refreshWalletInfo();
  } catch(e) { showToast(e.message||'Save failed','error'); }
}

// Load description into territory info panel when clicking a claim
function loadClaimDescriptionForInfo(claimId) {
  var row  = document.getElementById('infoDescRow');
  var text = document.getElementById('infoDescText');
  if (!row || !text || !claimId) return;
  row.style.display = 'none';
  fetch('/api/tdesc/claim/'+claimId).then(function(r){return r.json();}).then(function(d){
    if (d.description && d.description.description) {
      text.textContent = d.description.description;
      row.style.display = 'block';
    }
  }).catch(function(){});
}

// ── Territory Sponsor (Migration 139) ────────────────────────────────────────

var _sponsorCfg = null;
var _sponsorClaimId = null;

function loadSponsorsForInfo(claimId) {
  var row  = document.getElementById('infoSponsorRow');
  var list = document.getElementById('infoSponsorList');
  if (!row || !list) return;
  fetch('/api/sponsor/claim/'+claimId).then(function(r){return r.json();}).then(function(d){
    var sponsors = d.sponsors || [];
    if (!sponsors.length) { row.style.display='none'; return; }
    row.style.display = 'block';
    list.innerHTML = sponsors.map(function(s){
      var name = s.nickname || s.sponsor_wallet.slice(0,6)+'…'+s.sponsor_wallet.slice(-4);
      var msg  = s.message ? ' — '+s.message : '';
      var expH = Math.max(0, Math.ceil((new Date(s.expires_at)-Date.now())/3600000));
      return '<div>🎗️ <b>'+_escHtml(name)+'</b>'+_escHtml(msg)+' <span style="color:var(--tx3);font-size:8px">'+expH+'h left</span></div>';
    }).join('');
  }).catch(function(){});
}

function openSponsorModal() {
  var plot = window.selectedPlot;
  if (!plot || !plot.claimId) return;
  _sponsorClaimId = plot.claimId;
  var modal = document.getElementById('sponsorModal');
  var descEl = document.getElementById('sponsorModalDesc');
  var hintEl = document.getElementById('sponsorCostHint');
  var msgEl  = document.getElementById('sponsorMsgInput');
  if (msgEl) msgEl.value = '';
  if (descEl) descEl.textContent = (t('sponsor_modal_desc')||'Sponsor territory #')+_sponsorClaimId;
  // Load config for cost hint
  if (_sponsorCfg) {
    if (hintEl) hintEl.textContent = _sponsorCfg.costGP+' GP · '+_sponsorCfg.durH+'h duration';
  } else {
    fetch('/api/sponsor/config').then(function(r){return r.json();}).then(function(cfg){
      _sponsorCfg = cfg;
      if (hintEl) hintEl.textContent = cfg.costGP+' GP · '+cfg.durH+'h duration';
    }).catch(function(){});
  }
  if (modal) modal.style.display = 'flex';
}

function closeSponsorModal() {
  var modal = document.getElementById('sponsorModal');
  if (modal) modal.style.display = 'none';
}

async function submitSponsor() {
  var wallet  = ((walletState&&walletState.address)||getMyWallet()||'').toLowerCase();
  var claimId = _sponsorClaimId;
  var message = ((document.getElementById('sponsorMsgInput')||{}).value||'').trim();
  if (!wallet) { showToast(t('connect_wallet')||'Connect wallet first','error'); return; }
  if (!claimId) return;
  var cost = _sponsorCfg ? _sponsorCfg.costGP : '?';
  var ok = await gameConfirm({
    icon: '🎗️',
    title: t('sponsor_confirm')||'Sponsor Territory?',
    body: 'Territory <b>#'+claimId+'</b>'+(message?' — "'+message+'"':''),
    info: [{ k: t('cost')||'Cost', v: cost+' GP' }],
    confirmText: t('sponsor_btn')||'SPONSOR',
  });
  if (!ok) return;
  try {
    var r = await fetch('/api/sponsor/place', {
      method: 'POST',
      headers: Object.assign({'Content-Type':'application/json'}, getAuthHeaders()),
      body: JSON.stringify({ wallet, claimId, message })
    });
    var d = await r.json();
    if (d.error) { showToast(srvErr(d.error),'error'); return; }
    closeSponsorModal();
    showToast(t('sponsor_placed')||'🎗️ Sponsored!');
    loadSponsorsForInfo(claimId);
    if (typeof refreshWalletInfo === 'function') refreshWalletInfo();
  } catch(e) { showToast(e.message||'Sponsor failed','error'); }
}

// ── GP Victory Banner (Migration 145) ────────────────────────────────────────
var _bannerCfg = null;
var _bannerClaimId = null;
var _bannerSelectedEmoji = '🚩';

function loadBannersForInfo(claimId) {
  var row  = document.getElementById('infoBannerRow');
  var list = document.getElementById('infoBannerList');
  if (!row||!list) return;
  fetch('/api/banner/claim/'+claimId)
    .then(function(r){return r.json();})
    .then(function(items){
      if (!items||items.length===0) { row.style.display='none'; return; }
      row.style.display='';
      list.innerHTML = items.map(function(x){
        var expD = Math.max(0, Math.ceil((new Date(x.expires_at)-Date.now())/86400000));
        return '<div style="display:flex;align-items:center;gap:5px;padding:2px 0">'
          +'<span style="font-size:14px">'+x.emoji+'</span>'
          +'<span style="color:#ef9a9a;font-size:9px;font-weight:600">'+(x.player_name||x.wallet.slice(0,8)+'…')+'</span>'
          +(x.message?'<span style="color:#888;font-size:8px;flex:1;overflow:hidden;white-space:nowrap;text-overflow:ellipsis">"'+x.message+'"</span>':'')
          +'<span style="color:#555;font-size:8px;margin-left:auto">'+expD+'d</span>'
          +'</div>';
      }).join('');
    }).catch(function(){ row.style.display='none'; });
}

function openBannerModal() {
  var claimId = (typeof selectedPlot!=='undefined'&&selectedPlot)?(selectedPlot.claimId||selectedPlot.id):null;
  if (!claimId) { showToast('No territory selected','error'); return; }
  _bannerClaimId = claimId;
  fetch('/api/banner/config').then(function(r){return r.json();}).then(function(c){
    _bannerCfg = c;
    var hint = document.getElementById('bannerCostHint');
    if (hint) hint.textContent = c.costGP+' GP · lasts '+c.durD+' days';
    var picker = document.getElementById('bannerEmojiPicker');
    if (picker && c.emojis) {
      picker.innerHTML = c.emojis.map(function(e){
        var sel = e===_bannerSelectedEmoji ? 'background:rgba(239,154,154,.2);outline:2px solid #ef9a9a;' : '';
        return '<div onclick="selectBannerEmoji(\''+e+'\')" style="font-size:20px;cursor:pointer;padding:4px;border-radius:6px;'+sel+'transition:background .15s" id="bne_'+encodeURIComponent(e)+'">'+e+'</div>';
      }).join('');
    }
  }).catch(function(){});
  var desc = document.getElementById('bannerModalDesc');
  if (desc) desc.textContent = (t('banner_modal_desc')||'Plant a victory banner on territory')+ ' #'+claimId;
  var modal = document.getElementById('bannerModal');
  if (modal) modal.style.display='flex';
  var msgInp = document.getElementById('bannerMsgInput');
  if (msgInp) msgInp.value='';
}

function selectBannerEmoji(emoji) {
  _bannerSelectedEmoji = emoji;
  var picker = document.getElementById('bannerEmojiPicker');
  if (!picker||!_bannerCfg||!_bannerCfg.emojis) return;
  picker.innerHTML = _bannerCfg.emojis.map(function(e){
    var sel = e===emoji ? 'background:rgba(239,154,154,.2);outline:2px solid #ef9a9a;' : '';
    return '<div onclick="selectBannerEmoji(\''+e+'\')" style="font-size:20px;cursor:pointer;padding:4px;border-radius:6px;'+sel+'transition:background .15s">'+e+'</div>';
  }).join('');
}

function closeBannerModal() {
  var modal = document.getElementById('bannerModal');
  if (modal) modal.style.display='none';
}

function submitBanner() {
  var wallet  = window._walletAddress||(walletState&&walletState.address);
  var claimId = _bannerClaimId;
  if (!wallet) { showToast(t('connect_wallet')||'Connect wallet first','error'); return; }
  if (!claimId) return;
  var message = ((document.getElementById('bannerMsgInput')||{}).value||'').trim();
  var cost = _bannerCfg ? _bannerCfg.costGP : 30;
  gameConfirm({
    icon: '🚩',
    title: t('banner_confirm')||'Plant Victory Banner?',
    body:  _bannerSelectedEmoji+' on territory #'+claimId+(message?' — "'+message+'"':''),
    info:  [{ k: t('cost')||'Cost', v: cost+' GP' }]
  }).then(function(ok){
    if (!ok) return;
    fetch('/api/banner/plant', {
      method: 'POST',
      headers: Object.assign({ 'Content-Type': 'application/json' }, getAuthHeaders()),
      body: JSON.stringify({ wallet, claimId, emoji: _bannerSelectedEmoji, message })
    }).then(function(r){return r.json();}).then(function(d){
      if (d.error) { showToast(srvErr(d.error),'error'); return; }
      closeBannerModal();
      showToast(t('banner_planted')||'🚩 Banner planted!','success');
      loadBannersForInfo(claimId);
      if (typeof refreshWalletInfo==='function') refreshWalletInfo();
    }).catch(function(e){ showToast(e.message,'error'); });
  });
}

// ── GP Territory Tombstone (Migration 149) ───────────────────────────────────
var _tombstoneCfg = null;
var _tombstoneClaimId = null;

function loadTombstonesForInfo(claimId) {
  var row = document.getElementById('infoTombstoneRow');
  var list = document.getElementById('infoTombstoneList');
  if (!row) return;
  fetch('/api/tombstone/claim/'+claimId)
    .then(function(r){return r.json();})
    .then(function(stones){
      if (!stones.length) { row.style.display='none'; return; }
      row.style.display='';
      list.innerHTML = stones.map(function(s){
        return '<div style="padding:2px 0;border-bottom:1px solid rgba(255,255,255,.04)">'
          +'<span style="color:#90a4ae">🪦</span> '
          +'<em style="color:#ccc;font-size:9px">"'+escHtml(s.epitaph)+'"</em> '
          +'<span style="color:var(--tx3);font-size:8px">— '+(s.player_name||s.wallet.slice(0,10)+'…')+'</span>'
          +'</div>';
      }).join('');
    }).catch(function(){ row.style.display='none'; });
}

function openTombstoneModal() {
  var w = walletState && walletState.address;
  if (!w || !_tombstoneClaimId) return;
  var modal = document.getElementById('tombstoneModal');
  var hint  = document.getElementById('tombstoneCostHint');
  if (!modal) return;
  var doOpen = function(cfg) {
    if (hint) hint.textContent = t('tombstone_cost_hint').replace('{gp}', cfg.costGP||35);
    modal.style.display = 'flex';
  };
  if (_tombstoneCfg) { doOpen(_tombstoneCfg); return; }
  fetch('/api/tombstone/config').then(function(r){return r.json();}).then(function(c){
    _tombstoneCfg = c;
    doOpen(c);
  }).catch(function(){ doOpen({}); });
}

function closeTombstoneModal() {
  var modal = document.getElementById('tombstoneModal');
  if (modal) modal.style.display = 'none';
}

function submitTombstone() {
  var w = walletState && walletState.address;
  if (!w || !_tombstoneClaimId) return;
  var epitaph = ((document.getElementById('tombstoneEpitaphInput')||{}).value||'').trim() || 'I was here.';
  var costGP = (_tombstoneCfg && _tombstoneCfg.costGP) || 35;
  gameConfirm({icon:'🪦', title: t('tombstone_confirm_title') || 'PLACE TOMBSTONE',
    body: (t('tombstone_confirm_body') || 'Spend {gp} GP to place tombstone?').replace('{gp}', costGP),
    confirmText: 'PLACE'
  }).then(function(ok) {
    if (!ok) return;
    fetch('/api/tombstone/place', {
      method: 'POST',
      headers: Object.assign({ 'Content-Type': 'application/json' }, getAuthHeaders()),
      body: JSON.stringify({ wallet: w, claimId: _tombstoneClaimId, epitaph: epitaph })
    }).then(function(r){return r.json();}).then(function(d){
      if (d.error) { gameAlert(d.error); return; }
      closeTombstoneModal();
      document.getElementById('tombstoneEpitaphInput').value = '';
      document.getElementById('tombstoneCharCount').textContent = '0/60';
      showToast('🪦 '+t('tombstone_placed'));
      loadTombstonesForInfo(_tombstoneClaimId);
      refreshGP && refreshGP();
      // Hide the button — only one tombstone per wallet per claim
      var btn = document.getElementById('infoTombstoneBtn');
      if (btn) btn.style.display = 'none';
    }).catch(function(e){ gameAlert(e.message); });
  });
}

// ── GP Territory Prestige Frame (Migration 147) ──────────────────────────────
var _tprestigeCfg = null;
var _prestigeClaimId = null;
var _prestigeCurrentTier = 0;

var _PRESTIGE_NAMES  = ['None','Bronze','Silver','Gold','Platinum','Diamond'];
var _PRESTIGE_COLORS = ['#888','#cd7f32','#c0c0c0','#ffd700','#e5e4e2','#b9f2ff'];
var _PRESTIGE_GLOWS  = ['','rgba(205,127,50,.4)','rgba(192,192,192,.4)','rgba(255,215,0,.4)','rgba(229,228,226,.4)','rgba(185,242,255,.5)'];

function loadPrestigeForInfo(claimId) {
  var row      = document.getElementById('infoPrestigeRow');
  var tierEl   = document.getElementById('infoPrestigeTier');
  var upgradeBtn = document.getElementById('infoPrestigeBtn');
  if (!row) return;
  fetch('/api/tprestige/claim/'+claimId)
    .then(function(r){return r.json();})
    .then(function(d){
      _prestigeClaimId     = claimId;
      _prestigeCurrentTier = d.tier || 0;
      if (d.tier && d.tier > 0) {
        row.style.display = '';
        row.style.boxShadow = '0 0 8px '+(_PRESTIGE_GLOWS[d.tier]||'transparent');
        row.style.borderColor = 'rgba('+(_hexToRgb(_PRESTIGE_COLORS[d.tier])||'185,242,255')+',.25)';
        tierEl.style.color = _PRESTIGE_COLORS[d.tier] || '#b9f2ff';
        tierEl.textContent = _PRESTIGE_NAMES[d.tier] + (d.tier < 5 ? '' : ' ✦');
      } else {
        row.style.display = 'none';
      }
    }).catch(function(){ row.style.display='none'; });
}

function openPrestigeModal() {
  var w = walletState && walletState.address;
  if (!w) { gameAlert(t('prestige_login_required')); return; }
  var nextTier = _prestigeCurrentTier + 1;
  if (nextTier > 5) { gameAlert(t('prestige_max_reached')); return; }
  var modal = document.getElementById('prestigeModal');
  var body  = document.getElementById('prestigeModalBody');
  if (!modal || !body) return;
  // Load config if needed
  var doOpen = function(cfg) {
    var costGP = cfg.tierCosts ? cfg.tierCosts[nextTier] : '?';
    var fromName = _PRESTIGE_NAMES[_prestigeCurrentTier];
    var toName   = _PRESTIGE_NAMES[nextTier];
    var toColor  = _PRESTIGE_COLORS[nextTier];
    body.innerHTML = '<div style="margin-bottom:10px">'
      + '<span style="color:#888">'+fromName+'</span>'
      + ' → <span style="color:'+toColor+';font-weight:700;font-size:12px">'+toName+'</span>'
      + '</div>'
      + '<div style="color:#f0c040;font-family:var(--fn);font-size:11px;margin-bottom:6px">'+costGP+' GP</div>'
      + '<div style="color:var(--tx3);font-size:9px">'+t('prestige_permanent_note')+'</div>';
    modal.style.display = 'flex';
  };
  if (_tprestigeCfg) { doOpen(_tprestigeCfg); return; }
  fetch('/api/tprestige/config').then(function(r){return r.json();}).then(function(c){
    _tprestigeCfg = c;
    doOpen(c);
  }).catch(function(){ doOpen({}); });
}

function closePrestigeModal() {
  var modal = document.getElementById('prestigeModal');
  if (modal) modal.style.display = 'none';
}

function confirmPrestigeUpgrade() {
  var w = walletState && walletState.address;
  if (!w || !_prestigeClaimId) return;
  var btn = document.getElementById('prestigeConfirmBtn');
  if (btn) { btn.disabled = true; btn.textContent = '…'; }
  fetch('/api/tprestige/upgrade', {
    method: 'POST',
    headers: Object.assign({ 'Content-Type': 'application/json' }, getAuthHeaders()),
    body: JSON.stringify({ wallet: w, claimId: _prestigeClaimId })
  }).then(function(r){return r.json();}).then(function(d){
    if (d.error) { gameAlert(d.error); return; }
    closePrestigeModal();
    _prestigeCurrentTier = d.tier;
    showToast('💎 ' + t('prestige_upgraded').replace('{name}', d.name));
    loadPrestigeForInfo(_prestigeClaimId);
    refreshGP && refreshGP();
  }).catch(function(e){ gameAlert(e.message); })
  .finally(function(){ if(btn){ btn.disabled=false; btn.textContent=t('prestige_confirm_btn')||'UPGRADE'; } });
}

function _hexToRgb(hex) {
  if (!hex) return null;
  var r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return r ? parseInt(r[1],16)+','+parseInt(r[2],16)+','+parseInt(r[3],16) : null;
}

// ── GP Territory Star Rating (Migration 144) ─────────────────────────────────
var _ratingCfg = null;

function loadRatingForInfo(claimId) {
  var row     = document.getElementById('infoRatingRow');
  var stars   = document.getElementById('infoRatingStars');
  var rtext   = document.getElementById('infoRatingText');
  var widget  = document.getElementById('infoRateWidget');
  var rStars  = document.getElementById('infoRateStars');
  if (!row) return;
  // Load config once
  if (!_ratingCfg) {
    fetch('/api/rating/config').then(function(r){return r.json();}).then(function(c){ _ratingCfg = c; }).catch(function(){});
  }
  fetch('/api/rating/claim/'+claimId)
    .then(function(r){return r.json();})
    .then(function(d){
      if (!d) return;
      if (d.isPublic && d.avgRating !== null) {
        row.style.display = '';
        var filled = Math.round(d.avgRating);
        if (stars) stars.textContent = '★'.repeat(filled)+'☆'.repeat(5-filled);
        if (rtext) rtext.textContent = d.avgRating.toFixed(1)+' ('+d.voteCount+' votes)';
      } else {
        row.style.display = 'none';
      }
    }).catch(function(){ row.style.display='none'; });

  // Load my rating
  var myW = walletState&&walletState.address;
  if (myW && widget && rStars) {
    fetch('/api/rating/my?claimId='+claimId+'&wallet='+encodeURIComponent(myW))
      .then(function(r){return r.json();})
      .then(function(existing){
        var myRating = existing ? existing.rating : 0;
        rStars.innerHTML = [1,2,3,4,5].map(function(v){
          return '<span onclick="submitRating('+claimId+','+v+')" style="font-size:20px;cursor:pointer;color:'+(v<=myRating?'#ffd54f':'#333')+';transition:color .15s" onmouseover="this.style.color=\'#ffd54f\'" onmouseout="this.style.color=\''+(v<=myRating?'#ffd54f':'#333')+'\'">★</span>';
        }).join('');
      }).catch(function(){
        rStars.innerHTML = [1,2,3,4,5].map(function(v){
          return '<span onclick="submitRating('+claimId+','+v+')" style="font-size:20px;cursor:pointer;color:#333;transition:color .15s" onmouseover="this.style.color=\'#ffd54f\'" onmouseout="this.style.color=\'#333\'">★</span>';
        }).join('');
      });
  }
}

function submitRating(claimId, rating) {
  var wallet = walletState&&walletState.address;
  if (!wallet) { showToast(t('connect_wallet')||'Connect wallet first','error'); return; }
  var cost = _ratingCfg ? _ratingCfg.costGP : 5;
  gameConfirm({
    icon: '⭐',
    title: t('rating_confirm')||'Rate Territory?',
    body:  rating+'★ for territory #'+claimId,
    info:  [{ k: t('cost')||'Cost', v: cost+' GP' }]
  }).then(function(ok){
    if (!ok) return;
    fetch('/api/rating/rate', {
      method: 'POST',
      headers: Object.assign({ 'Content-Type': 'application/json' }, getAuthHeaders()),
      body: JSON.stringify({ wallet, claimId, rating })
    }).then(function(r){return r.json();}).then(function(d){
      if (d.error) { showToast(srvErr(d.error),'error'); return; }
      showToast(t('rating_submitted')||'⭐ Rating submitted!','success');
      loadRatingForInfo(claimId);
      if (typeof refreshWalletInfo === 'function') refreshWalletInfo();
    }).catch(function(e){ showToast(e.message,'error'); });
  });
}

// ── GP Territory Highlight (Migration 143) ───────────────────────────────────
var _highlightCfg = null;
var _highlightClaimId = null;
var _highlightSelectedColor = '#ff7840';

function loadHighlightForInfo(claimId) {
  var row   = document.getElementById('infoHighlightRow');
  var label = document.getElementById('infoHighlightLabel');
  var dot   = document.getElementById('infoHighlightDot');
  if (!row) return;
  fetch('/api/highlight/claim/'+claimId)
    .then(function(r){return r.json();})
    .then(function(h){
      if (!h) { row.style.display='none'; return; }
      var expH = Math.max(0, Math.ceil((new Date(h.expires_at)-Date.now())/3600000));
      row.style.display = '';
      row.style.background = h.color+'18';
      row.style.border = '1px solid '+h.color+'44';
      if (dot) { dot.style.background = h.color; dot.style.boxShadow = '0 0 6px '+h.color; }
      if (label) label.textContent = '✨ '+(t('highlight_active_label')||'HIGHLIGHTED')+ ' — '+expH+'h left';
    }).catch(function(){ row.style.display='none'; });
}

function openHighlightModal() {
  var claimId = (typeof selectedPlot!=='undefined'&&selectedPlot)?(selectedPlot.claimId||selectedPlot.id):null;
  if (!claimId) { showToast('No territory selected','error'); return; }
  _highlightClaimId = claimId;
  fetch('/api/highlight/config').then(function(r){return r.json();}).then(function(c){
    _highlightCfg = c;
    var hint = document.getElementById('highlightCostHint');
    if (hint) hint.textContent = c.costGP+' GP · lasts '+c.durH+'h';
    // Build color picker
    var picker = document.getElementById('highlightColorPicker');
    if (picker && c.colors) {
      picker.innerHTML = c.colors.map(function(col){
        var sel = col===_highlightSelectedColor ? 'outline:2px solid #fff;outline-offset:2px;' : '';
        return '<div onclick="selectHighlightColor(\''+col+'\')" style="width:24px;height:24px;border-radius:50%;background:'+col+';cursor:pointer;'+sel+'transition:outline .15s" id="hcol_'+col.replace('#','')+'"></div>';
      }).join('');
    }
  }).catch(function(){});
  var desc = document.getElementById('highlightModalDesc');
  if (desc) desc.textContent = (t('highlight_modal_desc')||'Make territory #'+claimId+' glow on the map');
  var modal = document.getElementById('highlightModal');
  if (modal) modal.style.display = 'flex';
}

function selectHighlightColor(color) {
  _highlightSelectedColor = color;
  var picker = document.getElementById('highlightColorPicker');
  if (!picker || !_highlightCfg || !_highlightCfg.colors) return;
  picker.innerHTML = _highlightCfg.colors.map(function(col){
    var sel = col===color ? 'outline:2px solid #fff;outline-offset:2px;' : '';
    return '<div onclick="selectHighlightColor(\''+col+'\')" style="width:24px;height:24px;border-radius:50%;background:'+col+';cursor:pointer;'+sel+'transition:outline .15s" id="hcol_'+col.replace('#','')+'"></div>';
  }).join('');
}

function closeHighlightModal() {
  var modal = document.getElementById('highlightModal');
  if (modal) modal.style.display = 'none';
}

function submitHighlight() {
  var wallet  = window._walletAddress||(walletState&&walletState.address);
  var claimId = _highlightClaimId;
  if (!wallet) { showToast(t('connect_wallet')||'Connect wallet first','error'); return; }
  if (!claimId) return;
  var cost = _highlightCfg ? _highlightCfg.costGP : 40;
  gameConfirm({
    icon: '✨',
    title: t('highlight_confirm')||'Highlight Territory?',
    body:  'Territory #'+claimId+' will glow <span style="color:'+_highlightSelectedColor+'">■</span>',
    info:  [{ k: t('cost')||'Cost', v: cost+' GP' }]
  }).then(function(ok){
    if (!ok) return;
    fetch('/api/highlight/set', {
      method: 'POST',
      headers: Object.assign({ 'Content-Type': 'application/json' }, getAuthHeaders()),
      body: JSON.stringify({ wallet, claimId, color: _highlightSelectedColor })
    }).then(function(r){return r.json();}).then(function(d){
      if (d.error) { showToast(srvErr(d.error),'error'); return; }
      closeHighlightModal();
      showToast(t('highlight_activated')||'✨ Territory highlighted!','success');
      loadHighlightForInfo(claimId);
      if (typeof refreshWalletInfo === 'function') refreshWalletInfo();
    }).catch(function(e){ showToast(e.message,'error'); });
  });
}

// ── GP Territory Graffiti (Migration 142) ────────────────────────────────────
var _graffitiCfg = null;
var _graffitiClaimId = null;

function loadGraffitiForInfo(claimId) {
  var row  = document.getElementById('infoGraffitiRow');
  var list = document.getElementById('infoGraffitiList');
  if (!row || !list) return;
  fetch('/api/graffiti/claim/'+claimId)
    .then(function(r){return r.json();})
    .then(function(items){
      if (!items || items.length === 0) { row.style.display='none'; return; }
      row.style.display = '';
      list.innerHTML = items.map(function(x){
        var expH = Math.max(0, Math.ceil((new Date(x.expires_at) - Date.now()) / 3600000));
        return '<div style="display:flex;align-items:center;gap:6px;padding:2px 0;border-bottom:1px solid rgba(255,255,255,.04)">'
          +'<span style="color:#b0bec5;font-weight:600;font-size:10px">'+x.text+'</span>'
          +'<span style="color:#555;font-size:8px;margin-left:auto">'+expH+'h left</span>'
          +'</div>';
      }).join('');
    }).catch(function(){ row.style.display='none'; });
}

function openGraffitiModal() {
  var claimId = (typeof selectedPlot !== 'undefined' && selectedPlot) ? (selectedPlot.claimId||selectedPlot.id) : null;
  if (!claimId) { showToast('No territory selected','error'); return; }
  _graffitiClaimId = claimId;
  fetch('/api/graffiti/config').then(function(r){return r.json();}).then(function(c){
    _graffitiCfg = c;
    var hint = document.getElementById('graffitiCostHint');
    if (hint) hint.textContent = c.costGP+' GP · lasts '+c.durH+'h';
  }).catch(function(){});
  var desc = document.getElementById('graffitiModalDesc');
  if (desc) desc.textContent = (t('graffiti_modal_desc')||'Spray graffiti on territory')+ ' #'+claimId;
  var modal = document.getElementById('graffitiModal');
  if (modal) modal.style.display = 'flex';
  var inp = document.getElementById('graffitiTextInput');
  if (inp) inp.value = '';
}

function closeGraffitiModal() {
  var modal = document.getElementById('graffitiModal');
  if (modal) modal.style.display = 'none';
}

function submitGraffiti() {
  var wallet  = window._walletAddress || (walletState&&walletState.address);
  var claimId = _graffitiClaimId;
  if (!wallet) { showToast(t('connect_wallet')||'Connect wallet first','error'); return; }
  if (!claimId) return;
  var text = ((document.getElementById('graffitiTextInput')||{}).value||'').trim();
  if (!text) { showToast(t('graffiti_text_required')||'Enter graffiti text','error'); return; }
  var cost = _graffitiCfg ? _graffitiCfg.costGP : 20;
  gameConfirm({
    icon: '✍️',
    title: t('graffiti_confirm')||'Spray Graffiti?',
    body:  '"'+text+'" on territory #'+claimId,
    info:  [{ k: t('cost')||'Cost', v: cost+' GP' }]
  }).then(function(ok){
    if (!ok) return;
    fetch('/api/graffiti/place', {
      method: 'POST',
      headers: Object.assign({ 'Content-Type': 'application/json' }, getAuthHeaders()),
      body: JSON.stringify({ wallet, claimId, text })
    }).then(function(r){return r.json();}).then(function(d){
      if (d.error) { showToast(srvErr(d.error),'error'); return; }
      closeGraffitiModal();
      showToast(t('graffiti_placed')||'✍️ Graffiti placed!','success');
      loadGraffitiForInfo(claimId);
      if (typeof refreshWalletInfo === 'function') refreshWalletInfo();
    }).catch(function(e){ showToast(e.message,'error'); });
  });
}

// ── GP Territory Tribute (Migration 141) ─────────────────────────────────────
var _tributeCfg = null;
var _tributeClaimId = null;

function loadTributesForInfo(claimId) {
  var row  = document.getElementById('infoTributeRow');
  var list = document.getElementById('infoTributeList');
  if (!row || !list) return;
  fetch('/api/tribute/claim/'+claimId+'?limit=5')
    .then(function(r){return r.json();})
    .then(function(items){
      if (!items || items.length === 0) { row.style.display='none'; return; }
      row.style.display = '';
      list.innerHTML = items.map(function(x){
        return '<div style="display:flex;align-items:center;gap:6px;padding:2px 0;border-bottom:1px solid rgba(255,255,255,.04)">'
          +'<span style="color:#ffcc80;font-weight:700;font-size:10px">🪙'+x.amount_gp+'</span>'
          +'<span style="color:#aaa;font-size:9px">'+(x.from_nickname||x.from_wallet.slice(0,8)+'…')+'</span>'
          +(x.message?'<span style="color:#666;font-size:8px;flex:1;overflow:hidden;white-space:nowrap;text-overflow:ellipsis">"'+x.message+'"</span>':'')
          +'</div>';
      }).join('');
    }).catch(function(){ row.style.display='none'; });
}

function openTributeModal() {
  var claimId = (typeof selectedPlot !== 'undefined' && selectedPlot) ? (selectedPlot.claimId||selectedPlot.id) : null;
  if (!claimId) { showToast('No territory selected','error'); return; }
  _tributeClaimId = claimId;
  // Load config
  fetch('/api/tribute/config').then(function(r){return r.json();}).then(function(c){
    _tributeCfg = c;
    var hint = document.getElementById('tributeCostHint');
    if (hint) hint.textContent = 'Min: '+c.minGP+' GP  ·  Max: '+c.maxGP+' GP';
    var inp = document.getElementById('tributeAmountInput');
    if (inp) { inp.min = c.minGP; inp.max = c.maxGP; }
  }).catch(function(){});
  var desc = document.getElementById('tributeModalDesc');
  if (desc) desc.textContent = (t('tribute_modal_desc')||'Send a GP tribute to the owner of territory')+ ' #'+claimId;
  var modal = document.getElementById('tributeModal');
  if (modal) modal.style.display = 'flex';
  var amtInp = document.getElementById('tributeAmountInput');
  var msgInp = document.getElementById('tributeMsgInput');
  if (amtInp) amtInp.value = '50';
  if (msgInp) msgInp.value = '';
}

function closeTributeModal() {
  var modal = document.getElementById('tributeModal');
  if (modal) modal.style.display = 'none';
}

function submitTribute() {
  var wallet  = window._walletAddress || (walletState&&walletState.address);
  var claimId = _tributeClaimId;
  if (!wallet) { showToast(t('connect_wallet')||'Connect wallet first','error'); return; }
  if (!claimId) return;
  var amountGP = parseInt((document.getElementById('tributeAmountInput')||{}).value||0, 10);
  var message  = ((document.getElementById('tributeMsgInput')||{}).value||'').trim();
  if (!amountGP || amountGP < (_tributeCfg?_tributeCfg.minGP:10)) {
    showToast((t('tribute_amount_required')||'Enter a valid GP amount'),'error'); return;
  }
  gameConfirm({
    icon: '🪙',
    title: t('tribute_confirm')||'Send GP Tribute?',
    body:  '#'+claimId+(message?' — "'+message+'"':''),
    info:  [{ k: t('cost')||'Cost', v: amountGP+' GP' }]
  }).then(function(ok){
    if (!ok) return;
    fetch('/api/tribute/send', {
      method: 'POST',
      headers: Object.assign({ 'Content-Type': 'application/json' }, getAuthHeaders()),
      body: JSON.stringify({ wallet, claimId, amountGP, message })
    }).then(function(r){return r.json();}).then(function(d){
      if (d.error) { showToast(srvErr(d.error),'error'); return; }
      closeTributeModal();
      showToast(t('tribute_sent')||'🪙 Tribute sent!','success');
      loadTributesForInfo(claimId);
      if (typeof refreshWalletInfo === 'function') refreshWalletInfo();
    }).catch(function(e){ showToast(e.message,'error'); });
  });
}

// ── GP Broadcast System (Migration 126) ──────────────────────────────────────

var _broadcastCosts = null;

function openBroadcastModal() {
  var modal = document.getElementById('broadcastModal');
  if (!modal) return;
  var msgEl = document.getElementById('broadcastMessageInput');
  var durEl = document.getElementById('broadcastDurationSelect');
  if (msgEl) msgEl.value = '';
  modal.style.display = 'flex';
  // Load costs for preview
  fetch('/api/broadcasts/costs').then(function(r){return r.json();}).then(function(c){
    _broadcastCosts = c;
    _updateBroadcastCostPreview();
  }).catch(function(){});
  if (durEl) {
    durEl.onchange = _updateBroadcastCostPreview;
    _updateBroadcastCostPreview();
  }
}

function _updateBroadcastCostPreview() {
  var el = document.getElementById('broadcastCostPreview');
  if (!el) return;
  var durEl = document.getElementById('broadcastDurationSelect');
  var dur = durEl ? parseInt(durEl.value)||1 : 1;
  if (!_broadcastCosts) { el.textContent = ''; return; }
  var cost = Math.max(_broadcastCosts.minGp||50, dur * (_broadcastCosts.costPerH||25));
  el.textContent = cost + ' GP';
}

function closeBroadcastModal() {
  var modal = document.getElementById('broadcastModal');
  if (modal) modal.style.display = 'none';
}

function submitBroadcast() {
  var w = walletState && walletState.address;
  if (!w) { showToast('Connect wallet first', 'error'); return; }
  var msgEl = document.getElementById('broadcastMessageInput');
  var durEl = document.getElementById('broadcastDurationSelect');
  var msg = msgEl ? msgEl.value.trim() : '';
  var dur = durEl ? parseInt(durEl.value)||1 : 1;
  if (!msg) { showToast('Message cannot be empty', 'error'); return; }
  var costEl = document.getElementById('broadcastCostPreview');
  var costStr = costEl ? costEl.textContent : '';
  gameConfirm({
    title: t('broadcast_confirm_title')||'Buy Broadcast?',
    body: 'Message: <b>' + _escHtml(msg) + '</b><br>Duration: <b>' + dur + 'h</b><br>Cost: <b>' + costStr + '</b>'
  }).then(function(ok) {
    if (!ok) return;
    fetch('/api/broadcasts/create', {
      method: 'POST',
      headers: Object.assign({'Content-Type':'application/json'},getAuthHeaders()),
      body: JSON.stringify({ wallet: w, message: msg, durationH: dur })
    }).then(function(r){return r.json();}).then(function(d){
      if (d.error) { showToast(d.error, 'error'); return; }
      showToast('Broadcast live! 📢', 'success');
      closeBroadcastModal();
      loadActiveBroadcasts();
      if (typeof refreshWalletInfo === 'function') refreshWalletInfo();
    }).catch(function(e){ showToast(e.message,'error'); });
  }).catch(function(){});
}

function loadActiveBroadcasts() {
  var el = document.getElementById('activeBroadcastsPanel');
  if (!el) return;
  fetch('/api/broadcasts/active').then(function(r){return r.json();}).then(function(rows){
    if (!rows || !rows.length) {
      el.innerHTML = '<div style="color:var(--tx3);font-size:9px;text-align:center;padding:6px">' + (t('broadcast_none')||'No active broadcasts right now.') + '</div>';
      return;
    }
    el.innerHTML = rows.map(function(b){
      var now = Date.now();
      var until = new Date(b.show_until).getTime();
      var remMs = Math.max(0, until - now);
      var remH = Math.floor(remMs/3600000);
      var remM = Math.floor((remMs%3600000)/60000);
      var remStr = remH > 0 ? remH+'h '+remM+'m' : remM+'m';
      var addr = b.wallet ? (b.wallet.slice(0,6)+'…'+b.wallet.slice(-4)) : '?';
      return '<div style="padding:5px 8px;background:rgba(144,202,249,.06);border:1px solid rgba(144,202,249,.15);border-radius:6px;margin-bottom:3px">'
        + '<div style="font-size:10px;color:var(--tx);line-height:1.4">' + _escHtml(b.message) + '</div>'
        + '<div style="display:flex;justify-content:space-between;margin-top:3px">'
          + '<span style="font-size:8px;color:var(--tx3)">' + addr + ' · ' + b.gp_paid + ' GP</span>'
          + '<span style="font-size:8px;color:#90caf9">⏱ ' + remStr + '</span>'
        + '</div>'
        + '</div>';
    }).join('');
  }).catch(function(e){
    if (el) el.innerHTML = '<div style="color:var(--red);font-size:9px;padding:6px">' + e.message + '</div>';
  });
}

// ── Alliance System (Migration 119) ──────────────────────────────────────────

var _allianceSettings = null;

function loadAlliancePanel() {
  var w = walletState && walletState.address;
  // Load settings for cost label
  fetch('/api/alliances/settings').then(function(r){return r.json();}).then(function(s){
    _allianceSettings = s;
    var costEl = document.getElementById('allianceCreateCostLabel');
    if (costEl) costEl.textContent = '(' + (s.createCost||200) + ' GP)';
  }).catch(function(){});

  if (!w) {
    document.getElementById('myAllianceCard')   && (document.getElementById('myAllianceCard').style.display = 'none');
    document.getElementById('noAlliancePanel')  && (document.getElementById('noAlliancePanel').style.display = '');
    return;
  }
  fetch('/api/alliances/my', { headers: getAuthHeaders() })
    .then(function(r){return r.json();})
    .then(function(d){
      if (!d || !d.id) {
        document.getElementById('myAllianceCard').style.display  = 'none';
        document.getElementById('noAlliancePanel').style.display = '';
      } else {
        renderMyAlliance(d, w);
      }
    }).catch(function(e){ showToast(e.message,'error'); });
}

function renderMyAlliance(a, wallet) {
  document.getElementById('myAllianceCard').style.display  = '';
  document.getElementById('noAlliancePanel').style.display = 'none';
  document.getElementById('myAllianceEmblem').textContent  = a.emblem || '⚔️';
  document.getElementById('myAllianceName').textContent    = a.name;
  document.getElementById('myAllianceTag').textContent     = '[' + a.tag + ']';
  document.getElementById('myAllianceDesc').textContent    = a.description || '';
  document.getElementById('myAllianceMembers').textContent = (a.member_count || 0) + '/' + (a.max_members || 5);
  document.getElementById('myAllianceTreasury').textContent = parseFloat(a.treasury_gp || a.alliance_gp || 0).toFixed(2) + ' GP';
  document.getElementById('myAllianceDefense').textContent = '+' + (a.defense_bonus||5) + '%';

  // Show withdraw button for leader/officer
  var isLeader = false;
  var memberList = document.getElementById('myAllianceMemberList');
  var members = a.members || [];
  memberList.innerHTML = members.map(function(m) {
    var memberWallet = String(m.wallet || m.wallet_address || '').toLowerCase();
    var isMe = memberWallet === String(wallet || '').toLowerCase();
    if (isMe && (m.role === 'leader' || m.role === 'officer')) isLeader = true;
    var roleColor = {leader:'var(--gold)',officer:'#80cbc4',member:'var(--tx3)'}[m.role] || 'var(--tx3)';
    var nick = m.nick || m.nickname || (memberWallet ? memberWallet.slice(0,8) + '…' : 'Member');
    return '<div style="display:flex;align-items:center;gap:6px;padding:3px 0;border-bottom:1px solid rgba(255,255,255,.04)">'
      + '<span style="font-size:10px;color:var(--tx);flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + _escHtml(nick) + (isMe?' <span style="color:var(--tx3);font-size:8px">(you)</span>':'') + '</span>'
      + '<span style="font-size:8px;color:'+roleColor+';font-family:var(--fn);font-weight:700">' + m.role.toUpperCase() + '</span>'
      + '</div>';
  }).join('');

  var wBtn = document.getElementById('allianceWithdrawBtn');
  if (wBtn) wBtn.style.display = isLeader ? '' : 'none';

  loadAllianceLog(a.id);
}

function renderAllianceLogRow(row) {
  var type = String(row.event_type || '').toLowerCase();
  var color = type === 'deposit' ? '#80cbc4' : type === 'withdraw' ? 'var(--gold)' : type === 'battle' ? '#ff8a80' : type === 'join' ? 'var(--gn)' : type === 'leave' ? 'var(--red)' : 'var(--tx2)';
  var icon = { create:'🛡️', join:'➕', leave:'🚪', deposit:'💰', withdraw:'📤', battle:'⚔️', kicked:'⚠️' }[type] || '•';
  var nick = row.nickname || (row.wallet ? String(row.wallet).slice(0, 8) + '…' : 'System');
  var amt = Number(row.amount_gp || 0);
  var amountText = amt ? ' · ' + (amt > 0 ? '+' : '') + amt + ' GP' : '';
  var at = row.created_at ? allianceTimeAgo(new Date(row.created_at)) : '';
  var note = row.note ? '<div style="font-size:8px;color:var(--tx3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + _escHtml(row.note) + '</div>' : '';
  return '<div style="padding:4px 5px;border-bottom:1px solid rgba(255,255,255,.04)">'
    + '<div style="display:flex;justify-content:space-between;gap:6px;align-items:center">'
    + '<span style="min-width:0;font-size:9px;color:var(--tx2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis"><span style="color:'+color+'">'+icon+' '+type.toUpperCase()+'</span> · '+_escHtml(nick)+_escHtml(amountText)+'</span>'
    + '<span style="font-size:8px;color:var(--tx3);white-space:nowrap">'+_escHtml(at)+'</span>'
    + '</div>'
    + note
    + '</div>';
}

function allianceTimeAgo(date) {
  var diff = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  if (diff < 60) return diff + 's';
  if (diff < 3600) return Math.floor(diff / 60) + 'm';
  if (diff < 86400) return Math.floor(diff / 3600) + 'h';
  return Math.floor(diff / 86400) + 'd';
}

function loadAllianceLog(allianceId) {
  var el = document.getElementById('myAllianceLog');
  if (!el || !allianceId) return;
  el.innerHTML = '<div style="font-size:9px;color:var(--tx3)">Loading…</div>';
  fetch('/api/alliances/' + encodeURIComponent(allianceId) + '/log?limit=12')
    .then(function(r){return r.json();})
    .then(function(rows){
      if (!document.getElementById('myAllianceLog')) return;
      if (!Array.isArray(rows) || rows.length === 0) {
        el.innerHTML = '<div style="font-size:9px;color:var(--tx3)">No activity yet</div>';
        return;
      }
      el.innerHTML = rows.map(renderAllianceLogRow).join('');
    })
    .catch(function(){
      if (el) el.innerHTML = '<div style="font-size:9px;color:var(--red)">Log unavailable</div>';
    });
}

function searchAlliances() {
  var q = (document.getElementById('allianceSearchInput') && document.getElementById('allianceSearchInput').value) || '';
  var list = document.getElementById('allianceBrowseList');
  if (!list) return;
  list.innerHTML = '<div style="color:var(--tx3);font-size:10px;text-align:center;padding:8px">Loading…</div>';
  fetch('/api/alliances?search=' + encodeURIComponent(q))
    .then(function(r){return r.json();})
    .then(function(rows){
      if (!rows.length) {
        list.innerHTML = '<div style="color:var(--tx3);font-size:10px;text-align:center;padding:8px">No alliances found</div>';
        return;
      }
      list.innerHTML = rows.map(function(a) {
        return '<div style="display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:5px;background:rgba(255,255,255,.03);border:1px solid rgba(128,203,196,.1)">'
          + '<span style="font-size:18px">' + (a.emblem||'⚔️') + '</span>'
          + '<div style="flex:1;min-width:0">'
            + '<div style="font-size:11px;color:var(--tx);font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'
              + _escHtml(a.name) + ' <span style="color:#80cbc4;font-size:9px;font-family:var(--fn)">[' + _escHtml(a.tag) + ']</span></div>'
            + '<div style="font-size:9px;color:var(--tx3)">' + (a.member_count||1) + '/' + (a.max_members||5) + ' members · ' + parseFloat(a.total_gp_burned||0).toFixed(0) + ' GP burned</div>'
          + '</div>'
          + '<button data-action="joinAllianceAction" data-alliance-id="' + escapeHTML(a.id) + '" data-alliance-name="' + escapeHTML(a.name) + '" style="font-size:9px;padding:4px 8px;border-radius:4px;background:rgba(128,203,196,.15);border:1px solid rgba(128,203,196,.35);color:#80cbc4;cursor:pointer;font-weight:700;white-space:nowrap" data-i18n="alliance_join_btn">JOIN</button>'
          + '</div>';
      }).join('');
    }).catch(function(e){ list.innerHTML = '<div style="color:var(--red);font-size:10px;text-align:center;padding:8px">'+e.message+'</div>'; });
}

function joinAllianceAction(id, name) {
  var w = walletState && walletState.address;
  if (!w) { showToast(t('err_connect_wallet')||'Connect wallet first','error'); return; }
  gameConfirm({ title: t('alliance_join_confirm')||'Join Alliance?', body: 'Join <b>' + _escHtml(name) + '</b>?' }).then(function(ok){
    if (!ok) return;
    fetch('/api/alliances/join', {
      method: 'POST',
      headers: Object.assign({'Content-Type':'application/json'},getAuthHeaders()),
      body: JSON.stringify({ wallet: w, allianceId: id })
    }).then(function(r){return r.json();}).then(function(d){
      if (d.error) { showToast(srvErr(d.error),'error'); return; }
      showToast('🛡️ Joined ' + _escHtml(name) + '!', 'success');
      loadAlliancePanel();
    }).catch(function(e){ showToast(e.message,'error'); });
  });
}

function createAllianceAction() {
  var w = walletState && walletState.address;
  if (!w) { showToast(t('err_connect_wallet')||'Connect wallet first','error'); return; }
  var name    = (document.getElementById('newAllianceName')  && document.getElementById('newAllianceName').value)  || '';
  var tag     = (document.getElementById('newAllianceTag')   && document.getElementById('newAllianceTag').value)   || '';
  var emblem  = (document.getElementById('newAllianceEmblem')&& document.getElementById('newAllianceEmblem').value)||'⚔️';
  var desc    = (document.getElementById('newAllianceDesc')  && document.getElementById('newAllianceDesc').value)  || '';
  if (!name || name.length < 2) { showToast('Alliance name must be at least 2 characters','error'); return; }
  if (!tag  || tag.length  < 2) { showToast('Tag must be at least 2 characters','error'); return; }
  var cost = (_allianceSettings && _allianceSettings.createCost) || 200;
  gameConfirm({ title: t('alliance_create_title')||'Create Alliance', body: 'Create <b>'+_escHtml(name)+'</b> for <b>'+cost+' GP</b>?' }).then(function(ok){
    if (!ok) return;
    fetch('/api/alliances/create', {
      method: 'POST',
      headers: Object.assign({'Content-Type':'application/json'},getAuthHeaders()),
      body: JSON.stringify({ wallet: w, name: name, tag: tag, emblem: emblem, description: desc })
    }).then(function(r){return r.json();}).then(function(d){
      if (d.error) { showToast(srvErr(d.error),'error'); return; }
      showToast('🛡️ Alliance created!','success');
      loadAlliancePanel();
    }).catch(function(e){ showToast(e.message,'error'); });
  });
}

async function openAllianceDepositModal() {
  var w = walletState && walletState.address;
  if (!w) return;
  var amt = await gameInput({title:LANG==='ko'?'금고 입금':LANG==='ja'?'金庫入金':LANG==='zh'?'金库存入':'Treasury Deposit',label:t('alliance_deposit_prompt')||(LANG==='ko'?'입금할 GP 금액':LANG==='ja'?'入金GP額':LANG==='zh'?'存入GP数量':'GP amount to deposit'),placeholder:'50',defaultValue:'50',maxLength:10});
  if (!amt) return;
  amt = parseFloat(amt);
  if (isNaN(amt) || amt <= 0) { showToast('Invalid amount','error'); return; }
  fetch('/api/alliances/deposit', {
    method: 'POST',
    headers: Object.assign({'Content-Type':'application/json'},getAuthHeaders()),
    body: JSON.stringify({ wallet: w, amount: amt })
  }).then(function(r){return r.json();}).then(function(d){
    if (d.error) { showToast(srvErr(d.error),'error'); return; }
    showToast('💰 '+amt+' GP deposited to treasury!','success');
    loadAlliancePanel();
  }).catch(function(e){ showToast(e.message,'error'); });
}

async function openAllianceWithdrawModal() {
  var w = walletState && walletState.address;
  if (!w) return;
  var min = (_allianceSettings && _allianceSettings.withdrawMin) || 10;
  var fee = (_allianceSettings && _allianceSettings.withdrawFeePct) || 5;
  var amt = await gameInput({title:LANG==='ko'?'금고 출금':LANG==='ja'?'金庫出金':LANG==='zh'?'金库提取':'Treasury Withdraw',label:t('alliance_withdraw_prompt')||(LANG==='ko'?'출금 GP (최소 '+min+', 수수료 '+fee+'%)':'GP to withdraw (min '+min+', fee '+fee+'%)'),placeholder:String(min),defaultValue:String(min),maxLength:10});
  if (!amt) return;
  amt = parseFloat(amt);
  if (isNaN(amt) || amt < min) { showToast((LANG==='ko'?'최소 출금액: ':LANG==='ja'?'最低出金額: ':LANG==='zh'?'最低提取额: ':'Min withdrawal: ')+min+' GP','error'); return; }
  var note = await gameInput({title:LANG==='ko'?'출금 메모':LANG==='ja'?'出金メモ':LANG==='zh'?'提取备注':'Withdraw Note',label:t('alliance_withdraw_note_prompt')||(LANG==='ko'?'메모 (선택)':LANG==='ja'?'メモ（任意）':LANG==='zh'?'备注（可选）':'Note (optional)'),placeholder:'',maxLength:100});
  fetch('/api/alliances/withdraw', {
    method: 'POST',
    headers: Object.assign({'Content-Type':'application/json'},getAuthHeaders()),
    body: JSON.stringify({ wallet: w, amount: amt, note: note })
  }).then(function(r){return r.json();}).then(function(d){
    if (d.error) { showToast(srvErr(d.error),'error'); return; }
    showToast('📤 Withdrew '+d.payout.toFixed(2)+' GP (fee: '+d.fee.toFixed(2)+')','success');
    loadAlliancePanel();
  }).catch(function(e){ showToast(e.message,'error'); });
}

function leaveAllianceConfirm() {
  var w = walletState && walletState.address;
  if (!w) return;
  gameConfirm({ title: t('alliance_leave_title')||'Leave Alliance?', body: t('alliance_leave_confirm')||'You will be removed from the alliance. The leader must transfer leadership or dissolve before leaving.' }).then(function(ok){
    if (!ok) return;
    var headers = {'Content-Type':'application/json'};
    var tok = localStorage.getItem('pw_token'); if (tok) headers['Authorization'] = 'Bearer '+tok;
    fetch('/api/alliances/leave', {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({ wallet: w })
    }).then(function(r){return r.json();}).then(function(d){
      if (d.error) { showToast(srvErr(d.error),'error'); return; }
      showToast('You left the alliance','success');
      loadAlliancePanel();
    }).catch(function(e){ showToast(e.message,'error'); });
  });
}

// ── Territory Upgrades ────────────────────────────────────────────────────────

var _upgradeCatalog = [];
var _upgradeMyList  = [];

function toggleTerritoryUpgrades() {
  var panel = document.getElementById('upgradesPanel');
  var tog   = document.getElementById('upgradesToggle');
  if (!panel) return;
  var open = panel.style.display !== 'none';
  panel.style.display = open ? 'none' : '';
  if (tog) tog.textContent = open ? '▼' : '▲';
  if (!open) _loadBaseUpgradesPanel();
}

function _loadBaseUpgradesPanel() {
  var el = document.getElementById('upgradesContent');
  if (!el) return;
  if (!walletState.address) {
    el.innerHTML = '<div style="color:var(--tx3);font-size:10px;text-align:center;padding:12px">Connect wallet to view upgrades</div>';
    return;
  }
  el.innerHTML = '<div style="text-align:center;color:var(--tx3);font-size:10px;padding:12px">Loading...</div>';
  Promise.all([
    fetch('/api/upgrades/catalog').then(function(r){ return r.json(); }),
    fetch('/api/upgrades/my-upgrades', { headers: getAuthHeaders() }).then(function(r){ return r.json(); })
  ]).then(function(results) {
    _upgradeCatalog = results[0].catalog || [];
    _upgradeMyList  = results[1].upgrades || [];
    renderBaseUpgradesPanel();
  }).catch(function() {
    el.innerHTML = '<div style="color:var(--mars);font-size:10px;text-align:center;padding:12px">Failed to load</div>';
  });
}

function renderBaseUpgradesPanel() {
  var el = document.getElementById('upgradesContent');
  if (!el) return;
  var active = _upgradeMyList.filter(function(u){ return u.is_active; });

  var html = '<button onclick="openUpgradeModal()" style="width:100%;margin-bottom:10px;padding:9px;border-radius:8px;background:linear-gradient(135deg,rgba(92,187,255,.14),rgba(92,187,255,.04));border:1px solid rgba(92,187,255,.35);color:var(--cyan);font-family:var(--fn);font-size:10px;font-weight:700;cursor:pointer;letter-spacing:.5px">⬆️ <span data-i18n="upgrades_upgrade_btn">UPGRADE TERRITORY</span></button>';

  if (active.length === 0) {
    html += '<div style="text-align:center;color:var(--tx3);font-size:10px;padding:8px 0">No territory upgrades yet</div>';
  } else {
    // Group by claim
    var byClaim = {};
    active.forEach(function(u) {
      var key = u.claim_id;
      if (!byClaim[key]) byClaim[key] = { name: u.custom_name || 'Territory ' + u.claim_id, upgrades: [] };
      byClaim[key].upgrades.push(u);
    });

    html += '<div style="font-size:9px;color:var(--tx3);margin-bottom:6px;letter-spacing:.5px">ACTIVE UPGRADES</div>';
    Object.entries(byClaim).forEach(function(kv) {
      var claimName = kv[1].name;
      var ups = kv[1].upgrades;
      html += '<div style="background:rgba(92,187,255,.04);border:1px solid rgba(92,187,255,.15);border-radius:8px;padding:8px 10px;margin-bottom:6px">';
      html += '<div style="font-size:9px;color:var(--cyan);font-weight:700;margin-bottom:6px">' + escHtml(claimName) + '</div>';
      ups.forEach(function(u) {
        var cat = _upgradeCatalog.find(function(c){ return c.key === u.upgrade_type; }) || {};
        var stars = '★'.repeat(u.level) + '☆'.repeat(5 - u.level);
        var bonus = (cat.levels && cat.levels[u.level-1]) ? '+' + cat.levels[u.level-1].bonus + (cat.bonusUnit||'') : '';
        html += '<div style="display:flex;align-items:center;gap:8px;padding:3px 0">';
        html += '<span style="font-size:14px">' + (cat.icon||'⬆️') + '</span>';
        html += '<div style="flex:1"><span style="font-size:9px;color:var(--tx)">' + (cat.name||u.upgrade_type) + '</span>';
        html += '<span style="font-size:8px;color:var(--gold);margin-left:6px">' + stars + '</span></div>';
        html += '<span style="font-size:9px;color:var(--gn)">' + bonus + '</span>';
        html += '</div>';
      });
      html += '</div>';
    });
  }

  el.innerHTML = html;
}

var _upgradeSelectedClaim = null;

function openUpgradeModal() {
  if (!walletState.address) { showToast('Connect wallet first', 'error'); return; }
  var grps = _myTerritoryGroups(walletState.address);
  if (!grps.length) { showToast('You have no territories to upgrade', 'error'); return; }
  _showClaimPickerForUpgrade(grps);
}

function _showClaimPickerForUpgrade(grps) {
  var items = grps.map(function(g) {
    return { value: g.primaryId, label: g.label };
  });
  gamePicker({ title: 'SELECT TERRITORY TO UPGRADE', items: items }).then(function(claimId) {
    if (!claimId) return;
    _upgradeSelectedClaim = parseInt(claimId);
    _showUpgradeTypePicker(_upgradeSelectedClaim);
  });
}

function _showUpgradeTypePicker(claimId) {
  fetch('/api/upgrades/claim/' + claimId)
    .then(function(r){ return r.json(); })
    .then(function(data) {
      var existing = {};
      (data.upgrades || []).forEach(function(u) { existing[u.upgrade_type] = u.level; });

      var items = _upgradeCatalog.map(function(cat) {
        var curLevel = existing[cat.key] || 0;
        var maxLevel = cat.maxLevel || 5;
        if (curLevel >= maxLevel) return null;
        var nextCostInfo = cat.levels && cat.levels[curLevel] ? cat.levels[curLevel] : null;
        var cost = nextCostInfo ? nextCostInfo.cost : '?';
        var bonus = nextCostInfo ? nextCostInfo.bonus : '?';
        var stars = '★'.repeat(curLevel) + '→★'.slice(0, curLevel < maxLevel ? 2 : 0);
        return {
          value: cat.key,
          label: cat.icon + ' ' + cat.name + ' (Lv.' + curLevel + '→' + (curLevel+1) + ') · ' + cost + 'GP / +' + bonus + (cat.bonusUnit||'')
        };
      }).filter(Boolean);

      if (!items.length) { showToast('All upgrades maxed for this territory!', 'info'); return; }

      gamePicker({ title: 'SELECT UPGRADE TYPE', items: items }).then(function(upgradeType) {
        if (!upgradeType) return;
        _confirmAndUpgrade(claimId, upgradeType);
      });
    }).catch(function() { showToast('Failed to load upgrade data', 'error'); });
}

function _confirmAndUpgrade(claimId, upgradeType) {
  var cat = _upgradeCatalog.find(function(c){ return c.key === upgradeType; });
  if (!cat) { showToast('Unknown upgrade type', 'error'); return; }

  // Get current level from myUpgrades
  var existing = _upgradeMyList.find(function(u){ return u.claim_id == claimId && u.upgrade_type === upgradeType && u.is_active; });
  var curLevel = existing ? existing.level : 0;
  var nextInfo = cat.levels && cat.levels[curLevel] ? cat.levels[curLevel] : null;
  if (!nextInfo) { showToast('Already at max level', 'error'); return; }

  var claimName = ((window.claims||[]).find(function(c){ return c.id == claimId; }) || {}).custom_name || 'Territory ' + claimId;

  gameConfirm({icon: cat.icon, title: 'UPGRADE: ' + cat.name.toUpperCase(),
    body: 'Upgrade "' + escHtml(claimName) + '" to ' + cat.name + ' Level ' + (curLevel+1) + '? Costs ' + nextInfo.cost + ' GP (permanent, lost if territory is hijacked).', confirmText:'UPGRADE'
  }).then(function(confirmed) {
    if (!confirmed) return;
    return fetch('/api/upgrades/upgrade', {
      method: 'POST',
      headers: Object.assign({ 'Content-Type': 'application/json' }, getAuthHeaders()),
      body: JSON.stringify({
        wallet: ((walletState&&walletState.address)||getMyWallet()||'').toLowerCase(),
        claimId: claimId,
        upgradeType: upgradeType
      })
    }).then(function(r){ return r.json(); }).then(function(d) {
      if (d.error) { showToast(d.error, 'error'); return; }
      showToast(cat.icon + ' ' + cat.name + ' upgraded to Lv.' + d.level + '! (' + d.cost + ' GP)', 'success');
      _loadBaseUpgradesPanel();
      loadWalletData();
    });
  }).catch(function(e) { showToast(e.message || 'Upgrade failed', 'error'); });
}

// ── Territory Monuments ──────────────────────────────────────────────────────

var _monumentTypes = [];
var _selectedMonumentType = 'pillar';
var _monumentClaims = [];

function toggleMonuments() {
  var panel = document.getElementById('monumentsPanel');
  var tog = document.getElementById('monumentsToggle');
  if (!panel) return;
  var open = panel.style.display !== 'none';
  panel.style.display = open ? 'none' : '';
  if (tog) tog.textContent = open ? '▼' : '▲';
  if (!open) loadMonumentsPanel();
}

function loadMonumentsPanel() {
  var el = document.getElementById('monumentsContent');
  if (!el) return;
  if (!walletState.address) {
    el.innerHTML = '<div style="color:var(--tx3);font-size:10px;text-align:center;padding:12px">Connect wallet to view monuments</div>';
    return;
  }
  el.innerHTML = '<div style="text-align:center;color:var(--tx3);font-size:10px;padding:12px">Loading...</div>';
  Promise.all([
    fetch('/api/monuments/my-monuments', { headers: getAuthHeaders() }).then(function(r){ return r.json(); }),
    fetch('/api/monuments/recent?limit=5').then(function(r){ return r.json(); })
  ]).then(function(results) {
    var myData = results[0];
    var recent = results[1];
    renderMonumentsPanel(myData.monuments || [], recent.monuments || []);
  }).catch(function() {
    el.innerHTML = '<div style="color:var(--mars);font-size:10px;text-align:center;padding:12px">Failed to load monuments</div>';
  });
}

function renderMonumentsPanel(myMonuments, recentMonuments) {
  var el = document.getElementById('monumentsContent');
  if (!el) return;
  var active = myMonuments.filter(function(m){ return m.is_active; });
  var html = '';

  html += '<button onclick="openMonumentModal()" style="width:100%;margin-bottom:10px;padding:9px;border-radius:8px;background:linear-gradient(135deg,rgba(255,160,50,.14),rgba(255,160,50,.04));border:1px solid rgba(255,160,50,.35);color:var(--gold);font-family:var(--fn);font-size:10px;font-weight:700;cursor:pointer;letter-spacing:.5px">🗿 <span data-i18n="monument_place_btn">PLACE MONUMENT</span></button>';

  if (active.length === 0) {
    html += '<div style="text-align:center;color:var(--tx3);font-size:10px;padding:8px 0">No active monuments yet</div>';
  } else {
    html += '<div style="font-size:9px;color:var(--tx3);margin-bottom:6px;letter-spacing:.5px">MY ACTIVE MONUMENTS (' + active.length + ')</div>';
    html += '<div style="display:flex;flex-direction:column;gap:6px">';
    active.forEach(function(m) {
      html += '<div style="background:rgba(255,160,50,.05);border:1px solid rgba(255,160,50,.18);border-radius:8px;padding:8px 10px">';
      html += '<div style="display:flex;align-items:center;gap:6px;margin-bottom:3px">';
      html += '<span style="font-size:16px">' + (m.icon || '🗿') + '</span>';
      html += '<div style="flex:1"><div style="font-size:10px;font-weight:700;color:var(--tx)">' + escHtml(m.name) + '</div>';
      html += '<div style="font-size:8px;color:var(--tx3)">Sector ' + (m.sector_x||'?') + ',' + (m.sector_y||'?') + ' · ' + m.gp_spent + ' GP spent</div></div>';
      html += '</div>';
      if (m.message) html += '<div style="font-size:9px;color:var(--tx2);font-style:italic;border-top:1px solid rgba(255,255,255,.05);padding-top:4px;margin-top:4px">"' + escHtml(m.message) + '"</div>';
      html += '</div>';
    });
    html += '</div>';
  }

  if (recentMonuments && recentMonuments.length > 0) {
    html += '<div style="font-size:9px;color:var(--tx3);margin-top:10px;margin-bottom:6px;letter-spacing:.5px">RECENT MONUMENTS</div>';
    html += '<div style="display:flex;flex-direction:column;gap:4px">';
    recentMonuments.slice(0,5).forEach(function(m) {
      var nick = m.owner_nick || (m.owner||'').slice(0,8)+'…';
      html += '<div style="display:flex;align-items:center;gap:6px;font-size:9px;color:var(--tx2);padding:4px 0;border-bottom:1px solid rgba(255,255,255,.04)">';
      html += '<span style="font-size:13px">' + (m.icon||'🗿') + '</span>';
      html += '<span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + escHtml(m.name) + '</span>';
      html += '<span style="color:var(--tx3)">' + nick + '</span>';
      html += '</div>';
    });
    html += '</div>';
  }

  el.innerHTML = html;
}

function openMonumentModal() {
  if (!walletState.address) { showToast('Connect wallet first', 'error'); return; }
  var modal = document.getElementById('monumentModal');
  if (!modal) return;
  modal.style.display = 'flex';
  _selectedMonumentType = 'pillar';

  // Load types
  fetch('/api/monuments/types').then(function(r){ return r.json(); }).then(function(d) {
    _monumentTypes = d.types || [];
    renderMonumentTypeGrid();
  }).catch(function(){});

  // Populate territory picker
  var sel = document.getElementById('monumentClaimSelect');
  if (!sel) return;
  var grps = _myTerritoryGroups(walletState.address);
  _monumentClaims = grps.map(function(g){return g.claims[0];}); // 기존 코드 호환용
  sel.innerHTML = '<option value="">-- Select territory --</option>';
  grps.forEach(function(g) {
    var opt = document.createElement('option');
    opt.value = g.primaryId;
    opt.textContent = g.label;
    sel.appendChild(opt);
  });

  document.getElementById('monumentCostRow').style.display = 'none';
  document.getElementById('monumentNameInput').value = '';
  document.getElementById('monumentMsgInput').value = '';
}

function renderMonumentTypeGrid() {
  var grid = document.getElementById('monumentTypeGrid');
  if (!grid) return;
  grid.innerHTML = '';
  _monumentTypes.forEach(function(t) {
    var div = document.createElement('div');
    div.setAttribute('onclick', 'selectMonumentType("' + t.key + '",this)');
    div.style.cssText = 'cursor:pointer;border-radius:8px;border:2px solid rgba(255,255,255,.12);padding:8px 4px;text-align:center;transition:.15s';
    div.id = 'mtype_' + t.key;
    if (t.key === _selectedMonumentType) div.style.borderColor = 'rgba(255,160,50,.65)';
    div.innerHTML = '<div style="font-size:18px">' + t.icon + '</div><div style="font-size:7px;color:var(--tx3);margin-top:2px">' + t.name + '</div>';
    grid.appendChild(div);
  });
}

function selectMonumentType(key, el) {
  _selectedMonumentType = key;
  document.querySelectorAll('#monumentTypeGrid > div').forEach(function(d) {
    d.style.borderColor = 'rgba(255,255,255,.12)';
  });
  if (el) el.style.borderColor = 'rgba(255,160,50,.65)';
}

function onMonumentClaimChange() {
  var sel = document.getElementById('monumentClaimSelect');
  var costRow = document.getElementById('monumentCostRow');
  var costVal = document.getElementById('monumentCostVal');
  if (!sel || !sel.value) { if (costRow) costRow.style.display = 'none'; return; }
  var claimId = sel.value;
  fetch('/api/monuments/cost?claimId=' + claimId)
    .then(function(r){ return r.json(); })
    .then(function(d) {
      if (costRow) costRow.style.display = 'flex';
      if (costVal) costVal.textContent = (d.cost || '?') + ' GP';
    }).catch(function(){});
}

function closeMonumentModal() {
  var modal = document.getElementById('monumentModal');
  if (modal) modal.style.display = 'none';
}

function submitPlaceMonument() {
  var sel = document.getElementById('monumentClaimSelect');
  var nameEl = document.getElementById('monumentNameInput');
  var msgEl = document.getElementById('monumentMsgInput');
  if (!sel || !sel.value) { showToast('Select a territory', 'error'); return; }
  var name = (nameEl ? nameEl.value : '').trim();
  if (!name) { showToast('Monument name is required', 'error'); return; }
  if (!walletState.address) { showToast('Connect wallet', 'error'); return; }

  gameConfirm({icon:'🗿', title:'PLACE MONUMENT', body:'Permanently spend GP to place "' + escHtml(name) + '" on your territory? GP is burned and cannot be recovered.', confirmText:'PLACE'})
    .then(function(confirmed) {
      if (!confirmed) return;
      return fetch('/api/monuments/place', {
        method: 'POST',
        headers: Object.assign({ 'Content-Type': 'application/json' }, getAuthHeaders()),
        body: JSON.stringify({
          wallet: walletState.address,
          claimId: parseInt(sel.value),
          monumentType: _selectedMonumentType,
          name: name,
          message: msgEl ? msgEl.value.trim() : ''
        })
      }).then(function(r){ return r.json(); }).then(function(d) {
        if (d.error) { showToast(d.error, 'error'); return; }
        showToast('🗿 Monument placed! (' + d.cost + ' GP burned)', 'success');
        closeMonumentModal();
        loadMonumentsPanel();
        loadWalletData();
      });
    }).catch(function(e) { showToast(e.message || 'Failed to place monument', 'error'); });
}

function loadAchievements() {
  var sec = document.getElementById('achievementsSection');
  if (!sec) return;
  sec.style.display = '';
  var grid = document.getElementById('achievementsGrid');
  if (!walletState.address) {
    grid.innerHTML = '<div style="color:var(--tx3);font-size:10px;text-align:center;padding:16px;grid-column:1/-1">Connect wallet to view achievements</div>';
    return;
  }
  var hadContent = !!grid.innerHTML.trim();
  if(!hadContent) grid.innerHTML = '<div style="color:var(--tx3);font-size:10px;text-align:center;padding:16px;grid-column:1/-1">Loading...</div>';

  _engagementRead('achievements', '/api/achievements', true)
    .then(function(data) {
      if(!data){
        if(!hadContent) grid.innerHTML = '<div style="color:var(--tx3);font-size:10px;text-align:center;padding:16px;grid-column:1/-1">Refreshing achievements...</div>';
        return;
      }
      _achievements = data.achievements || [];
      renderAchievementCards();
    })
    .catch(function(e) {
      grid.innerHTML = '<div style="color:var(--mars);font-size:10px;text-align:center;padding:16px;grid-column:1/-1">Failed to load</div>';
    });
}

function filterAchievements(cat, btn) {
  _achFilter = cat;
  document.querySelectorAll('.ach-cat-btn').forEach(function(b) {
    b.style.opacity = (b === btn) ? '1' : '0.5';
    b.style.fontWeight = (b === btn) ? '700' : '400';
  });
  renderAchievementCards();
}

function renderAchievementCards() {
  var grid = document.getElementById('achievementsGrid');
  if (!grid) return;
  var list = _achFilter === 'all' ? _achievements : _achievements.filter(function(a){ return a.category === _achFilter; });
  // Sort: unlocked first, then by category+sort_order
  list = list.slice().sort(function(a,b){
    if (a.unlocked && !b.unlocked) return -1;
    if (!a.unlocked && b.unlocked) return 1;
    return 0;
  });
  if (!list.length) {
    grid.innerHTML = '<div style="color:var(--tx3);font-size:10px;text-align:center;padding:16px;grid-column:1/-1">No achievements in this category yet</div>';
    return;
  }
  var lang = (typeof uiLang !== 'undefined' ? uiLang : 'en') || 'en';
  grid.innerHTML = list.map(function(a) {
    var unlocked = !!a.unlocked;
    var catColor = ACH_CAT_COLOR[a.category] || 'var(--tx1)';
    var rarityColor = ACH_RARITY_COLOR[a.rarity] || ACH_RARITY_COLOR.common;
    var glowStyle = unlocked ? (ACH_RARITY_GLOW[a.rarity] || 'none') : 'none';
    var name = a['name_' + lang] || a.name_en || a.key;
    var desc = a['desc_' + lang] || a.desc_en || '';
    var bgStyle = unlocked
      ? 'background:rgba(255,209,102,.06);border-color:rgba(255,209,102,.25)'
      : 'background:rgba(255,255,255,.02);border-color:rgba(255,255,255,.06);filter:grayscale(.6)';
    var unlockedDate = unlocked && a.unlocked_at
      ? new Date(a.unlocked_at).toLocaleDateString()
      : '';
    return '<div onclick="showAchievementDetail(\'' + escapeHtmlSafe(a.key||'') + '\')" style="border:1px solid;border-radius:8px;padding:8px;box-shadow:' + glowStyle + ';' + bgStyle + ';position:relative;cursor:pointer" title="' + desc + '">'
      + '<div style="font-size:20px;text-align:center;margin-bottom:4px;' + (unlocked ? '' : 'opacity:.4') + '">' + (a.icon || '🏆') + '</div>'
      + '<div style="font-size:8px;font-weight:700;color:' + (unlocked ? catColor : 'var(--tx3)') + ';text-align:center;line-height:1.3;margin-bottom:2px">' + name + '</div>'
      + '<div style="font-size:7px;color:' + rarityColor + ';text-align:center;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">' + (a.rarity || 'common') + '</div>'
      + (a.reward_gp > 0 ? '<div style="font-size:8px;color:' + (unlocked ? 'var(--gold)' : 'var(--tx3)') + ';text-align:center">+' + Math.round(a.reward_gp) + ' GP</div>' : '')
      + (unlocked && unlockedDate ? '<div style="font-size:7px;color:var(--tx3);text-align:center;margin-top:2px">' + unlockedDate + '</div>' : '')
      + (!unlocked ? '<div style="position:absolute;top:4px;right:4px;font-size:10px;opacity:.3">🔒</div>' : '<div style="position:absolute;top:4px;right:4px;font-size:10px">✅</div>')
      + '</div>';
  }).join('');

  // Show unlocked count summary
  var totalUnlocked = _achievements.filter(function(a){ return a.unlocked; }).length;
  var totalAch = _achievements.length;
  var summary = document.createElement('div');
  summary.style.cssText = 'grid-column:1/-1;text-align:center;font-size:9px;color:var(--tx3);padding:4px 0;border-top:1px solid var(--bdr);margin-top:4px';
  summary.textContent = totalUnlocked + ' / ' + totalAch + ' unlocked';
  grid.appendChild(summary);
}

// 업적 상세 모달 — 카드 클릭 시 달성 조건/보상/상태 표시
function _achConditionLabel(condType, condValue) {
  var v = condValue || 0;
  var lang = (typeof uiLang !== 'undefined' ? uiLang : 'en') || 'en';
  // 한국어/영어 라벨
  var KO = {
    claim_count:    v + '회 영토 클레임',
    pixel_count:    v + ' 픽셀 보유',
    battle_wins:    v + '회 전투 승리',
    battle_count:   v + '회 전투 참여',
    fleet_battles:  v + '회 함대전 참여',
    fleet_wins:     v + '회 함대전 승리',
    hijack_wins:    v + '회 하이잭 성공',
    ship_built:     v + '척 함선 건조',
    gp_spent:       v + ' GP 누적 사용',
    gp_earned:      v + ' GP 누적 획득',
    pp_earned:      v + ' PP 누적 획득',
    sectors_owned:  v + '개 섹터 소유',
    guild_join:     '길드 가입',
    guild_leader:   '길드 리더',
    referrals:      v + '명 추천 가입',
    daily_streak:   v + '일 연속 일일 미션',
    market_buy:     v + '회 마켓 구매',
    market_sell:    v + '회 마켓 판매',
    items_used:     v + '회 아이템 사용',
    capsule_made:   v + '회 타임캡슐 작성',
    sponsor_count:  v + '회 영토 스폰서',
    siege_wins:     v + '회 공성 승리',
    rocket_drops:   v + '회 로켓드롭 참여',
    enhance_count:  v + '회 강화 성공',
    auction_wins:   v + '회 경매 낙찰',
    duel_wins:      v + '회 결투 승리',
    crafting_done:  v + '회 제작 완료',
    governance_vote: v + '회 거버넌스 투표',
    season_top:     '시즌 상위',
  };
  var EN = {
    claim_count:    'Claim ' + v + ' territories',
    pixel_count:    'Hold ' + v + ' pixels',
    battle_wins:    'Win ' + v + ' battles',
    battle_count:   'Participate in ' + v + ' battles',
    fleet_battles:  'Participate in ' + v + ' fleet battles',
    fleet_wins:     'Win ' + v + ' fleet battles',
    hijack_wins:    'Successful hijacks: ' + v,
    ship_built:     'Build ' + v + ' ships',
    gp_spent:       'Spend ' + v + ' GP cumulative',
    gp_earned:      'Earn ' + v + ' GP cumulative',
    pp_earned:      'Earn ' + v + ' PP cumulative',
    sectors_owned:  'Own ' + v + ' sectors',
    guild_join:     'Join a guild',
    guild_leader:   'Become guild leader',
    referrals:      'Refer ' + v + ' players',
    daily_streak:   v + '-day daily mission streak',
    market_buy:     v + ' marketplace purchases',
    market_sell:    v + ' marketplace sales',
    items_used:     'Use ' + v + ' items',
    capsule_made:   'Create ' + v + ' time capsules',
    sponsor_count:  'Sponsor ' + v + ' territories',
    siege_wins:     'Win ' + v + ' sieges',
    rocket_drops:   'Participate in ' + v + ' rocket drops',
    enhance_count:  v + ' successful enhancements',
    auction_wins:   v + ' auction wins',
    duel_wins:      'Win ' + v + ' duels',
    crafting_done:  v + ' crafts completed',
    governance_vote: v + ' governance votes',
    season_top:     'Season top placement',
  };
  var JA = {
    claim_count:    v + '回 領土クレーム',
    pixel_count:    v + ' ピクセル保有',
    battle_wins:    v + '回 戦闘勝利',
    battle_count:   v + '回 戦闘参加',
    fleet_battles:  v + '回 艦隊戦参加',
    fleet_wins:     v + '回 艦隊戦勝利',
    hijack_wins:    v + '回 ハイジャック成功',
    ship_built:     v + '隻 艦船建造',
    gp_spent:       v + ' GP 累計使用',
    gp_earned:      v + ' GP 累計獲得',
    pp_earned:      v + ' PP 累計獲得',
    sectors_owned:  v + '個 セクター所有',
    guild_join:     'ギルド加入',
    guild_leader:   'ギルドリーダー',
    referrals:      v + '名 紹介加入',
    daily_streak:   v + '日 連続デイリー',
    market_buy:     v + '回 マーケット購入',
    market_sell:    v + '回 マーケット販売',
    items_used:     v + '回 アイテム使用',
    capsule_made:   v + '回 タイムカプセル作成',
    sponsor_count:  v + '回 領土スポンサー',
    siege_wins:     v + '回 攻城勝利',
    rocket_drops:   v + '回 ロケットドロップ参加',
    enhance_count:  v + '回 強化成功',
    auction_wins:   v + '回 競売落札',
    duel_wins:      v + '回 決闘勝利',
    crafting_done:  v + '回 製作完了',
    governance_vote: v + '回 ガバナンス投票',
    season_top:     'シーズン上位',
  };
  var ZH = {
    claim_count:    '领地索取 ' + v + ' 次',
    pixel_count:    '持有 ' + v + ' 像素',
    battle_wins:    '战斗胜利 ' + v + ' 次',
    battle_count:   '参与战斗 ' + v + ' 次',
    fleet_battles:  '参与舰队战 ' + v + ' 次',
    fleet_wins:     '舰队战胜利 ' + v + ' 次',
    hijack_wins:    '劫持成功 ' + v + ' 次',
    ship_built:     '建造舰船 ' + v + ' 艘',
    gp_spent:       '累计使用 ' + v + ' GP',
    gp_earned:      '累计获得 ' + v + ' GP',
    pp_earned:      '累计获得 ' + v + ' PP',
    sectors_owned:  '拥有 ' + v + ' 个扇区',
    guild_join:     '加入公会',
    guild_leader:   '公会领袖',
    referrals:      '推荐 ' + v + ' 名玩家',
    daily_streak:   '连续 ' + v + ' 天每日任务',
    market_buy:     '市场购买 ' + v + ' 次',
    market_sell:    '市场出售 ' + v + ' 次',
    items_used:     '使用物品 ' + v + ' 次',
    capsule_made:   '创建时间胶囊 ' + v + ' 次',
    sponsor_count:  '领地赞助 ' + v + ' 次',
    siege_wins:     '攻城胜利 ' + v + ' 次',
    rocket_drops:   '参与火箭投放 ' + v + ' 次',
    enhance_count:  '强化成功 ' + v + ' 次',
    auction_wins:   '拍卖成交 ' + v + ' 次',
    duel_wins:      '决斗胜利 ' + v + ' 次',
    crafting_done:  '制作完成 ' + v + ' 次',
    governance_vote: '治理投票 ' + v + ' 次',
    season_top:     '赛季排名靠前',
  };
  var dict = lang === 'ko' ? KO : lang === 'ja' ? JA : lang === 'zh' ? ZH : EN;
  return dict[condType] || (condType + ' >= ' + v);
}

function showAchievementDetail(key) {
  var a = _achievements.find(function(x){ return x.key === key; });
  if (!a) return;
  var lang = (typeof uiLang !== 'undefined' ? uiLang : 'en') || 'en';
  var name = a['name_' + lang] || a.name_en || a.key;
  var desc = a['desc_' + lang] || a.desc_en || '';
  var unlocked = !!a.unlocked;
  var rarityColor = ACH_RARITY_COLOR[a.rarity] || ACH_RARITY_COLOR.common;
  var unlockedDate = unlocked && a.unlocked_at ? new Date(a.unlocked_at).toLocaleString() : '';
  var condition = _achConditionLabel(a.condition_type, a.condition_value);
  var labels = lang === 'ko'
    ? { criteria:'달성 조건', reward:'보상', status:'상태', unlocked:'달성됨', locked:'미달성', closeBtn:'닫기', date:'달성일' }
    : lang === 'ja'
    ? { criteria:'達成条件', reward:'報酬', status:'ステータス', unlocked:'達成済', locked:'未達成', closeBtn:'閉じる', date:'達成日' }
    : lang === 'zh'
    ? { criteria:'达成条件', reward:'奖励', status:'状态', unlocked:'已达成', locked:'未达成', closeBtn:'关闭', date:'达成日' }
    : { criteria:'Criteria', reward:'Reward', status:'Status', unlocked:'Unlocked', locked:'Locked', closeBtn:'Close', date:'Date' };

  // 기존 모달 있으면 먼저 정리
  var prev = document.getElementById('achDetailModal');
  if (prev) prev.remove();

  var modal = document.createElement('div');
  modal.id = 'achDetailModal';
  modal.style.cssText = 'position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,.85);display:flex;align-items:center;justify-content:center;padding:16px;backdrop-filter:blur(8px);font-family:var(--fn)';
  modal.onclick = function(e){ if (e.target === modal) modal.remove(); };

  var card = '<div style="background:linear-gradient(180deg,#181820,#0e0e16);border:1px solid '+rarityColor+';border-radius:12px;padding:20px;max-width:380px;width:100%;box-shadow:0 8px 50px '+rarityColor+'aa">'
    + '<div style="text-align:center;margin-bottom:14px">'
    + '<div style="font-size:48px;line-height:1;margin-bottom:6px;'+(unlocked?'':'opacity:.4')+'">' + (a.icon || '🏆') + '</div>'
    + '<div style="font-size:14px;font-weight:800;color:#fff;margin-bottom:3px">' + escapeHtmlSafe(name) + '</div>'
    + '<div style="font-size:9px;color:'+rarityColor+';text-transform:uppercase;letter-spacing:2px">' + (a.rarity || 'common') + '</div>'
    + '</div>'
    + (desc ? '<div style="font-size:11px;color:var(--tx2);line-height:1.6;text-align:center;padding:8px 4px;border-top:1px solid rgba(255,255,255,.08);border-bottom:1px solid rgba(255,255,255,.08);margin-bottom:12px">' + escapeHtmlSafe(desc) + '</div>' : '')
    + '<div style="display:grid;grid-template-columns:auto 1fr;gap:6px 12px;font-size:10px;margin-bottom:14px">'
    + '<div style="color:var(--tx3)">'+labels.criteria+'</div><div style="color:#ffd166;font-weight:600">' + escapeHtmlSafe(condition) + '</div>'
    + (a.reward_gp > 0 ? '<div style="color:var(--tx3)">'+labels.reward+'</div><div style="color:var(--gold);font-weight:600">+' + Math.round(a.reward_gp) + ' GP</div>' : '')
    + '<div style="color:var(--tx3)">'+labels.status+'</div><div style="color:'+(unlocked?'#7cd7a4':'#ff6b6b')+';font-weight:600">' + (unlocked ? '✅ '+labels.unlocked : '🔒 '+labels.locked) + '</div>'
    + (unlocked && unlockedDate ? '<div style="color:var(--tx3)">'+labels.date+'</div><div style="color:var(--tx2)">' + escapeHtmlSafe(unlockedDate) + '</div>' : '')
    + '</div>'
    + '<button onclick="document.getElementById(\'achDetailModal\').remove()" style="width:100%;padding:10px;border-radius:8px;border:1px solid rgba(255,255,255,.18);background:rgba(255,255,255,.06);color:#fff;font-family:var(--fn);font-size:10px;font-weight:700;letter-spacing:1px;cursor:pointer">' + labels.closeBtn + '</button>'
    + '</div>';
  modal.innerHTML = card;
  document.body.appendChild(modal);
}


function renderDailyMissions(){
  var container = document.getElementById('dailyMissionCards');
  var html = '';
  var allClaimed = true;
  _dailyState.missions.forEach(function(m){
    // Support both server field names and local defaults
    var icon = m.icon || '📋';
    var mType = m.type || '';
    var i18nKey = 'dm_' + mType;
    var titleRaw = m.title || m.label || mType;
    var title = (t(i18nKey) !== i18nKey) ? t(i18nKey) : titleRaw;
    var descRaw = m.desc || '';
    var descKey = i18nKey + '_d';
    var desc = (t(descKey) !== descKey) ? t(descKey) : descRaw;
    var target = m.target != null ? m.target : m.targetValue;
    var current = m.current != null ? m.current : m.currentValue;
    var _r = m.reward != null ? m.reward : m.rewardGP;
    var reward = (_r != null && !isNaN(Number(_r))) ? Number(_r) : 0;
    var pct = Math.min((current/target)*100, 100);
    var claimable = current >= target && !m.claimed;
    var cls = 'daily-mission-card';
    if(m.claimed) cls += ' claimed';
    else if(claimable) cls += ' claimable';
    if(!m.claimed) allClaimed = false;

    html += '<div class="'+cls+'" id="dm_'+m.id+'">';
    html += '<div class="dm-icon">'+icon+'</div>';
    html += '<div class="dm-info">';
    html += '<div class="dm-title">'+title+'</div>';
    if(desc) html += '<div class="dm-desc" style="font-size:9px;color:var(--tx3);margin:2px 0 4px;line-height:1.3">'+desc+'</div>';
    html += '<div class="dm-prog-bar"><div class="dm-prog-fill" style="width:'+pct+'%"></div></div>';
    html += '<div class="dm-prog-text">'+Math.min(current,target)+' / '+target+'</div>';
    html += '</div>';
    html += '<div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px">';
    html += '<div class="dm-reward">+'+reward+' '+t('daily_gp_suffix')+'</div>';
    if(m.claimed){
      html += '<span class="dm-claimed-check">✓</span>';
    } else if(claimable){
      html += '<button class="dm-claim-btn" onclick="claimMission(\''+m.id+'\')">'+t('quests_claim_btn')+'</button>';
    } else {
      html += '<button class="dm-claim-btn" disabled>'+Math.min(current,target)+'/'+target+'</button>';
    }
    html += '</div></div>';
  });
  container.innerHTML = html;

  // Bonus card
  var bonusEl = document.getElementById('dailyBonusCard');
  if(allClaimed && _dailyState.missions.length > 0){
    bonusEl.style.display = '';
    bonusEl.innerHTML = '<div class="daily-bonus-card"><div class="db-title">'+t('daily_all_bonus_title')+'</div><div class="db-sub">'+t('daily_all_bonus_sub')+'</div></div>';
  } else {
    bonusEl.style.display = 'none';
  }
  updateDailyHudDot();
}

function claimMission(missionId){
  var mission = null;
  missionId = Number(missionId);
  _dailyState.missions.forEach(function(m){ if(m.id===missionId) mission=m; });
  if(!mission || mission.claimed || mission.current < mission.target) return;

  if(emailAuth.token && walletState.address){
    fetch('/api/daily/missions/'+missionId+'/claim',{
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':'Bearer '+emailAuth.token},
      body: JSON.stringify({wallet: walletState.address})
    }).then(function(r){return r.json()}).then(function(d){
      if(d.success || d.reward){
        // Server confirmed — use server's reward values so GP stays in sync
        if(d.rewardGP != null) mission.reward = parseFloat(d.rewardGP);
        finalizeMissionClaim(mission);
        // Refresh authoritative GP balance from server
        try{ if(typeof checkDailyLogin==='function') checkDailyLogin(); }catch(_){}
      } else {
        // Server rejected — show error, do NOT mark locally (otherwise it reverts on refresh)
        showToast(d.error||t('daily_mission_claim_failed'),'error');
      }
    }).catch(function(){
      showToast(t('daily_mission_claim_conn_failed'),'error');
    });
  } else {
    // No backend → local-only fallback (offline/demo mode)
    finalizeMissionClaim(mission);
  }
}

function finalizeMissionClaim(mission){
  mission.claimed = true;
  _dailyState.gpBalance += mission.reward;
  updateGPDisplay();
  showToast(t('daily_mission_complete_toast').replace('{n}',mission.reward));
  try{_sfx.claim()}catch(e){}
  // [v7.194 fix] daily mission claim 직후 메인 화면 + dot 도 즉시 갱신 — claim 3종(claimMission/claimDailyOps/claimOpsMission)
  //   중 이 경로는 v7.192 에서 누락. 페이지 리로드 안 해도 메인 추천 카드, 카테고리 dot, GP HUD 동기화.
  try { if(typeof updateDailyHint==='function') updateDailyHint(); } catch(_){}
  try { if(typeof refreshGP==='function') refreshGP(); } catch(_){}
  try { if(typeof _pollBaseTabDots==='function') _pollBaseTabDots(); } catch(_){}
  try { if(typeof loadDailyOpsBoard==='function') loadDailyOpsBoard(); } catch(_){}

  // Check if all claimed for bonus
  var allClaimed = true;
  _dailyState.missions.forEach(function(m){ if(!m.claimed) allClaimed=false; });
  if(allClaimed && _dailyState.missions.length > 0){
    _dailyState.gpBalance += 50;
    updateGPDisplay();
    setTimeout(function(){
      showToast(t('daily_all_missions_bonus_toast'));
      try{_sfx.levelUp()}catch(e){}
    }, 800);
  }
  saveMissionsLocal();
  renderDailyMissions();
}

function saveMissionsLocal(){
  if(!walletState.address) return;
  var key = 'daily_missions_'+walletState.address+'_'+new Date().toISOString().slice(0,10);
  try{ localStorage.setItem(key, JSON.stringify(_dailyState.missions)); }catch(e){}
}

// ── action → server mission_type mapping ──
var _actionToMissionType = {
  'claim':           'claim_pixels',
  'claim_pixel':     'claim_pixels',
  'claim_pixels':    'claim_pixels',
  'harvest':         'harvest',
  'mine':            'harvest',
  'hijack':          'hijack',
  'explore_poi':     'explore_poi',
  'view_sectors':    'explore_poi',
  'play_cantina':    'play_cantina',
  'cantina':         'play_cantina',
  'equip_cosmetic':  'equip_cosmetic',
  'view_weather':    'view_weather',
  'enhance_item':    'enhance_item',
  'marketplace_trade': 'marketplace_trade',
  'buy':             'marketplace_trade',
  'win_naval_battle': 'win_naval_battle',
  'build_ship':      'build_ship'
};

// debounced mission refresh (avoid spamming /api/daily/missions on rapid actions)
var _missionRefreshTimer = null;
function _scheduleMissionRefresh(){
  _clearActiveTimeout(_missionRefreshTimer);
  _missionRefreshTimer = _setActiveTimeout(function(){
    _missionRefreshTimer = null;
    if(_pageIsActive() && emailAuth && emailAuth.token) loadDailyMissions();
  }, 3000);
}

// ── Update mission progress (called from game actions) ──
function updateMissionProgress(actionType, amount){
  if(!_dailyState.missions.length) return;
  var serverType = _actionToMissionType[actionType] || actionType;
  var changed = false;
  _dailyState.missions.forEach(function(m){
    if(m.claimed) return;
    if(m.type === serverType){
      m.current = Math.min((m.current||0) + (amount||1), m.target);
      changed = true;
    }
  });
  if(changed){
    saveMissionsLocal();
    renderDailyMissions();
    // Schedule a server refresh to sync authoritative state
    _scheduleMissionRefresh();
  }
}

// ── GP Display ──
function updateGPDisplay(){
  // 권위 소스 우선(walletState.gameGP) — GP 소비 경로가 walletState 를 갱신하므로 stale 방지. fallback _dailyState.
  var gpVal = Number((typeof walletState !== 'undefined' && walletState.gameGP) || (_dailyState && _dailyState.gpBalance) || 0);
  // Profile modal
  var authGP = document.getElementById('authGPBal');
  if(authGP) authGP.textContent = gpVal.toFixed(0);
  // Sidebar wallet
  var walletGPRow = document.getElementById('walletGPRow');
  var walletGP = document.getElementById('walletGP');
  if(walletGPRow && walletGP){
    walletGPRow.style.display = '';
    walletGP.textContent = gpVal.toFixed(0);
  }
}
// Legacy alias — 일부 코드 경로가 refreshGP() 호출 (정의 안 됨 → ReferenceError)
window.refreshGP = function(){ try { updateGPDisplay(); } catch(_){} };
// ── Missing function aliases (v6.56-58) — 정의 없이 호출되어 ReferenceError 발생 방지 ──
// loadWalletData: 스테이킹/복권 등 GP 소비 후 잔액 갱신용 — 7곳 직접 호출 (typeof 가드 없음)
window.loadWalletData = function(){ try { refreshEmailBalances(); } catch(_){ try { updateGPDisplay(); } catch(__){} } };
// refreshBalance: 마켓/경매/함선 ops 후 GP 잔액 갱신 — 11곳 직접 호출 (typeof 가드 없음)
window.refreshBalance = window.loadWalletData;
// refreshWalletInfo: 영토 이벤트/티어업그레이드 등 이후 잔액 갱신 — 21곳 typeof 가드 호출
window.refreshWalletInfo = window.loadWalletData;
// updateBalanceDisplays: GP/PP 표시 갱신 — 6곳 typeof 가드 호출
window.updateBalanceDisplays = function(){ try { updateGPDisplay(); } catch(_){} };
// loadUserData / loadBaseStats: 유저 데이터 재로드 — typeof 가드만 있어 조용히 실패
window.loadUserData = window.loadWalletData;
window.loadBaseStats = window.loadWalletData;
// gameAlert: alert() 대체 알림 — 40곳 직접 호출, 정의 없음 → showToast 위임
window.gameAlert = function(msg) { try { var s = String(msg||''); showToast(s, s.startsWith('✅')||s.startsWith('🎉')||s.startsWith('✔')?'success':'error'); } catch(_) {} };
// loadGPBalance: 업그레이드/거래 후 GP 잔액 갱신 — typeof 가드로 보호되지만 정의 없어 no-op
window.loadGPBalance = window.loadWalletData;
// refreshPP: PP 잔액 갱신 — typeof 가드로 보호
window.refreshPP = window.loadWalletData;
// loadClaims / refreshClaims: 영토 병합 후 클레임 목록 재로드 — typeof 가드로 보호
window.loadClaims = function(){ try { compositeClaimsOnTexture(); } catch(_){} };
window.refreshClaims = window.loadClaims;
// renderBlueprintsGrid / renderShipList: 조선소 청사진·보유함 갱신 — typeof 가드로 보호
// 실제 함수명: renderBlueprints(), renderShips(), renderQueue()
window.renderBlueprintsGrid = function(){ try { renderBlueprints(); } catch(_){} };
window.renderShipList = function(){ try { renderShips(); } catch(_){} };

// ── Daily Reset Timer ──
var _dailyTimerInterval = null;
function startDailyTimer(){
  if(_dailyTimerInterval) _clearActiveInterval(_dailyTimerInterval);
  function tick(){
    var now = new Date();
    var utcMidnight = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()+1, 0, 0, 0));
    var diff = utcMidnight - now;
    var h = Math.floor(diff/3600000);
    var m = Math.floor((diff%3600000)/60000);
    var s = Math.floor((diff%60000)/1000);
    var timerEl = document.getElementById('dailyMissionTimer');
    if(timerEl) timerEl.textContent = t('daily_resets_prefix')+' '+String(h).padStart(2,'0')+':'+String(m).padStart(2,'0')+':'+String(s).padStart(2,'0');
  }
  tick();
  _dailyTimerInterval = _setActiveInterval(tick, 1000);
}

// ── Notification Dots (OPEN BASE button + QUESTS tab) ──
var _dailyDotReady = false; // Don't show dot until daily state is actually loaded
function updateDailyHudDot(){
  var hasClaimable = false;
  // Only check if daily state has been initialized from server
  if(_dailyDotReady) {
    // Check daily login unclaimed
    if(!_dailyState.todayClaimed) hasClaimable = true;
    // Check daily missions — only if a mission is COMPLETED and not yet claimed
    if(!hasClaimable && _dailyState.missions.length > 0){
      _dailyState.missions.forEach(function(m){
        var cur = m.current != null ? m.current : (m.currentValue != null ? m.currentValue : 0);
        var tgt = m.target != null ? m.target : (m.targetValue != null ? m.targetValue : 999);
        if(!m.claimed && cur >= tgt) hasClaimable = true;
      });
    }
  }
  // QUESTS tab dot inside BASE modal
  var questsDot = document.getElementById('questsDot');
  if(questsDot) questsDot.style.display = hasClaimable ? 'block' : 'none';
  // Update main BASE button dot — shows if ANY tab has a dot active
  _updateBaseBtnDot();
}
function _updateBaseBtnDot(){
  var anyDot = false;
  // [v7.189 fix] 누락된 economy/fleet/mission 신규 카테고리 추가 — 이전엔 marketDot/itemsDot 등 켜져도
  //   상단 OPEN BASE 버튼이 안 빛나 sub-tab 알림을 놓치는 문제.
  var dotIds = ['territoryDot','sectorsDot','rankDot','miningDot','questsDot','guildDot','opsDot','governDot',
                'shopDot','marketDot','itemsDot','pvpDot','transportDot','fleetDot'];
  dotIds.forEach(function(id){
    var el = document.getElementById(id);
    if(el && getComputedStyle(el).display !== 'none') anyDot = true;
  });
  // OPEN BASE button dot (desktop) — use FAB .cf-dot since dailyHudDot gets
  // destroyed by i18n text replacement on openBaseBtn
  var baseDot = document.querySelector('.col-fab.base .cf-dot');
  if(baseDot) baseDot.style.display = anyDot ? 'block' : 'none';
  // Mobile bottom nav BASE dot
  var mobBaseDot = document.getElementById('mobBaseDot');
  if(mobBaseDot) mobBaseDot.style.display = anyDot ? 'block' : 'none';
}

function openDailyPanel(){
  // Open base modal to quests tab which contains daily missions
  try{
    openBaseModal();
    var qt = document.getElementById('baseTabQuests');
    if(qt) switchBaseTab('quests', qt);
  }catch(e){
    console.error('[Daily] openDailyPanel error:', e);
  }
}

// ── Integration: hook into game actions ──
var _origTrackQuestAction = window.trackQuestAction;
if(typeof _origTrackQuestAction === 'function'){
  window.trackQuestAction = function(action, val){
    _origTrackQuestAction(action, val);
    try{
      // Pass action directly — updateMissionProgress now maps via _actionToMissionType
      updateMissionProgress(action, val);
    }catch(e){}
  };
}
