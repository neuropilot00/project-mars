// ── Season System ──────────────────────────────────
var _seasonData=null;
var _seasonTimerInterval=null;

function loadSeasonData(){
  fetch('/api/season/active').then(function(r){return r.json()}).then(function(d){
    _seasonData=d.season;
    if(_seasonData){
      showSeasonBanner(_seasonData);
      showSeasonTint(_seasonData);
      showSeasonGuide(_seasonData);
      try{ loadSeasonPass(); }catch(_e){}
    }
  }).catch(function(){});
}

// ── Tap/Click tracking for "Most Active" season category ──
var _tapCount=0;
var _tapTimer=null;
document.addEventListener('click',function(){
  _tapCount++;
  if(!_tapTimer){
    _tapTimer=_setActiveTimeout(function(){
      if(_tapCount>0&&walletState.address){
        fetch('/api/season/taps',{method:'POST',headers:Object.assign({'Content-Type':'application/json'},getAuthHeaders()),
          body:JSON.stringify({wallet:walletState.address,count:_tapCount})}).catch(function(){});
      }
      _tapCount=0;_tapTimer=null;
    },30000); // batch every 30s
  }
});
// Flush taps on page unload
window.addEventListener('beforeunload',function(){
  if(_tapCount>0&&walletState.address){
    navigator.sendBeacon('/api/season/taps',JSON.stringify({wallet:walletState.address,count:_tapCount}));
  }
});

// [v7.264 CRITICAL fix] 네비/UI data-action 위임 디스패처 — 누락 회귀 복구.
//   v7.215(239cc5e)에서 col-fab/상단바/모바일 네비 버튼을 inline onclick → data-action 으로
//   마이그(§19)했으나, 이 무인자(no-arg) 액션들을 실제 함수로 잇는 위임 리스너가 추가되지 않아
//   MY LAND/CANTINA/CLAIM/ITEMS/BASE 등 거의 모든 진입 버튼이 "클릭 무반응" 상태였다(브라우저 재현 확인).
//   인자형 액션(syRepairShip/siegeJoin/selectTargetFleet 등)은 별도 디스패처가 인자와 함께 처리하므로
//   여기서는 화이트리스트의 무인자 글로벌 함수만 호출 → 이중 호출/충돌 없음.
(function(){
  var NAV_NOARG_ACTIONS = {
    toggleMyLand:1, openArena:1, openBaseModal:1, openMyItems:1, activateLandSelect:1,
    openAuthModal:1, openPortfolioModal:1, openTelegramGroup:1, toggleLangDropdown:1,
    toggleLeaderboard:1, toggleDynastyView:1, toggleLeft:1, toggleRight:1,
    closeLeft:1, closeRight:1, closeAnnounce:1, startTutorial:1, nextTutStep:1,
    endTutorial:1, showRocketInfo:1, showLorePopup:1, copyRefCode:1, registerReferral:1,
    copyDepositAddr:1
  };
  document.addEventListener('click', function(ev){
    var el = ev.target && ev.target.closest ? ev.target.closest('[data-action]') : null;
    if(!el) return;
    var act = el.getAttribute('data-action');
    if(!act || NAV_NOARG_ACTIONS[act] !== 1) return;       // 화이트리스트 외(인자형/동적)은 손대지 않음
    var fn = window[act];
    if(typeof fn !== 'function') return;
    if(el.disabled) return;
    ev.preventDefault(); ev.stopPropagation();
    try { fn(); } catch(e){ console.error('[NAV] '+act+' error:', e); }
  }, false);
})();

function toggleRankTable(){
  var wrap=document.getElementById('rankTableWrap');
  var tog=document.getElementById('rankTableToggle');
  if(!wrap)return;
  if(wrap.style.display==='none'){wrap.style.display='';tog.textContent='▲ HIDE';}
  else{wrap.style.display='none';tog.textContent='▼ SHOW';}
}
function toggleMySectors(){
  var wrap=document.getElementById('baseMySectors');
  var tog=document.getElementById('mySectorsToggle');
  if(!wrap)return;
  if(wrap.style.display==='none'){wrap.style.display='';tog.textContent='▲ HIDE';}
  else{wrap.style.display='none';tog.textContent='▼ SHOW';}
}

function showSeasonGuide(season){
  var guide=document.getElementById('seasonGuide');
  if(!season){
    // No active season — show placeholder
    document.getElementById('seasonGuideName').textContent=t('season_no_active');
    document.getElementById('seasonGuideTimer').textContent=t('season_check_back');
    document.getElementById('seasonScoreRules').innerHTML='<div style="grid-column:1/-1;text-align:center;color:var(--tx3);font-size:9px;padding:8px">'+t('season_activities_placeholder')+'</div>';
    return;
  }
  guide.style.display='';
  var themeNames={volcanic:t('season_theme_volcanic'),ice_age:t('season_theme_ice_age'),solar_storm:t('season_theme_solar_storm'),dust_epoch:t('season_theme_dust_epoch')};
  var themeDescs={
    volcanic:t('season_theme_volcanic_desc'),
    ice_age:t('season_theme_ice_age_desc'),
    solar_storm:t('season_theme_solar_storm_desc'),
    dust_epoch:t('season_theme_dust_epoch_desc')
  };
  document.getElementById('seasonGuideName').textContent=season.name+' — '+(themeNames[season.theme]||season.theme);
  var remaining=new Date(season.endsAt).getTime()-Date.now();
  var days=Math.floor(remaining/86400000);
  var hours=Math.floor((remaining%86400000)/3600000);
  document.getElementById('seasonGuideTimer').textContent=days>0?t('season_days_remaining').replace('{d}',days).replace('{h}',hours):t('season_ending_soon');

  // Score rules — show season's active categories (6 per season)
  var rules=document.getElementById('seasonScoreRules');
  var cats=season.activeCategories||[];
  rules.innerHTML='<div style="grid-column:1/-1;font-size:9px;color:var(--tx2);margin-bottom:4px;line-height:1.5">'+(themeDescs[season.theme]||t('season_default_desc'))+'</div>'+
    '<div style="grid-column:1/-1;font-size:8px;color:var(--gold);margin-bottom:2px">'+t('season_categories_title')+' ('+cats.length+')</div>'+
    cats.map(function(c){
    var catLabel = t('season_cat_'+c.key) !== 'season_cat_'+c.key ? t('season_cat_'+c.key) : (c.label||c.key);
    var catDesc = t('season_cat_'+c.key+'_d') !== 'season_cat_'+c.key+'_d' ? t('season_cat_'+c.key+'_d') : (c.desc||'');
    return '<div style="padding:8px 8px;border-radius:6px;background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.05)">'+
      '<div style="display:flex;align-items:center;gap:4px;margin-bottom:3px"><span style="font-size:14px">'+(c.icon||'🏆')+'</span>'+
      '<span style="font-size:9px;color:var(--tx);font-weight:700">'+catLabel+'</span></div>'+
      (catDesc ? '<div style="font-size:8px;color:var(--tx3);line-height:1.3">'+catDesc+'</div>' : '')+
      '</div>';
  }).join('');
}

function showSeasonBanner(season){
  var banner=document.getElementById('seasonBanner');
  if(!season){banner.style.display='none';return;}
  banner.style.display='';
  var themeIcons={volcanic:'🌋',ice_age:'❄️',solar_storm:'☀️',dust_epoch:'🌪️'};
  document.getElementById('seasonBannerIcon').textContent=themeIcons[season.theme]||'🌋';
  document.getElementById('seasonBannerName').textContent=season.name;
  // Start countdown timer
  if(_seasonTimerInterval) _clearActiveInterval(_seasonTimerInterval);
  function updateTimer(){
    var remaining=new Date(season.endsAt).getTime()-Date.now();
    if(remaining<=0){document.getElementById('seasonBannerTimer').textContent=t('season_ended');_clearActiveInterval(_seasonTimerInterval);return;}
    var d=Math.floor(remaining/86400000);
    var h=Math.floor((remaining%86400000)/3600000);
    var m=Math.floor((remaining%3600000)/60000);
    document.getElementById('seasonBannerTimer').textContent=d+'d '+h+'h '+m+'m';
  }
  updateTimer();
  _seasonTimerInterval=_setActiveInterval(updateTimer,60000);
}

function showSeasonTint(season){
  var overlay=document.getElementById('seasonTintOverlay');
  if(!season||!season.visualTint){overlay.style.display='none';return;}
  overlay.style.display='';
  overlay.style.background=season.visualTint;
}

// ═══════════════════════════════════════
//  SEASON PASS
// ═══════════════════════════════════════

function loadSeasonPass(){
  if(!walletState.address) return;
  fetch('/api/season/pass', { headers: getAuthHeaders() }).then(function(r){return r.json()}).then(function(d){
    if(d.error) return;
    if(d.premiumCost) window._seasonPassCost=d.premiumCost;
    renderSeasonPass(d);
  }).catch(function(){});
}

function renderSeasonPass(data){
  var xpLabel=document.getElementById('seasonPassXPLabel');
  var tierLabel=document.getElementById('seasonPassTierLabel');
  var fill=document.getElementById('seasonPassXPFill');
  var premBtn=document.getElementById('seasonPassPremiumBtn');
  if(!xpLabel) return;

  xpLabel.textContent=data.xp+' XP';
  tierLabel.textContent='Tier '+data.currentTier+(data.isPremium?' ⭐':'');
  premBtn.style.display=data.isPremium?'none':'';

  // Find next tier XP requirement
  var tiers=data.tiers||[];
  var nextTier=tiers.find(function(t){return !t.is_premium && t.xp_required>data.xp});
  if(nextTier){
    var prevXp=data.currentTier>0?tiers.filter(function(t){return !t.is_premium&&t.tier===data.currentTier})[0]:{xp_required:0};
    var pXp=prevXp?prevXp.xp_required:0;
    var pct=Math.min(100,Math.round((data.xp-pXp)/(nextTier.xp_required-pXp)*100));
    fill.style.width=pct+'%';
  } else {
    fill.style.width='100%';
  }

  // Render tier nodes
  var box=document.getElementById('seasonPassTiers');
  var uniqueTiers={};
  tiers.forEach(function(t){ if(!uniqueTiers[t.tier]) uniqueTiers[t.tier]={free:null,premium:null}; if(t.is_premium) uniqueTiers[t.tier].premium=t; else uniqueTiers[t.tier].free=t; });

  var html='';
  Object.keys(uniqueTiers).sort(function(a,b){return a-b}).forEach(function(tierNum){
    var tt=uniqueTiers[tierNum];
    var free=tt.free||{};
    var prem=tt.premium||{};
    var unlocked=data.xp>=free.xp_required;
    var freeClaimed=free.claimed;
    var premClaimed=prem.claimed;

    var rewardIcon=free.reward_type==='pp'?'💎':free.reward_type==='gp'?'🪙':'🎁';
    var premIcon=prem.reward_type==='pp'?'💎':prem.reward_type==='gp'?'🪙':prem.reward_type==='item'?'📦':'🎁';
    var fmtAmt=function(amt,type){ var n=parseFloat(amt||0); if(type==='gp') return Math.floor(n); return n%1===0?n:n.toFixed(2); };
    var freeAmt=fmtAmt(free.reward_amount,free.reward_type);
    var premAmt=fmtAmt(prem.reward_amount,prem.reward_type);

    var bg=unlocked?(freeClaimed?'rgba(76,216,154,.08)':'rgba(255,209,102,.1)'):'rgba(255,255,255,.02)';
    var bdr=unlocked?(freeClaimed?'rgba(76,216,154,.3)':'rgba(255,209,102,.3)'):'rgba(255,255,255,.06)';

    html+='<div style="min-width:60px;padding:6px;border-radius:6px;background:'+bg+';border:1px solid '+bdr+';text-align:center;flex-shrink:0">'+
      '<div style="font-size:7px;color:var(--tx3)">Tier '+tierNum+'</div>'+
      // Free track
      '<div style="margin:3px 0">';
    if(freeClaimed){
      html+='<span style="font-size:9px;color:var(--gn)">✓</span>';
    } else if(unlocked){
      html+='<button onclick="claimPassTier('+tierNum+',false)" style="font-size:7px;padding:2px 6px;border-radius:3px;background:var(--gold);border:none;color:#000;cursor:pointer;font-weight:700">'+rewardIcon+' '+freeAmt+'</button>';
    } else {
      html+='<span style="font-size:8px;color:var(--tx3)">'+rewardIcon+' '+freeAmt+'</span>';
    }
    html+='</div>';
    // Premium track
    if(data.isPremium){
      html+='<div style="border-top:1px solid rgba(184,136,224,.15);padding-top:2px;margin-top:2px">';
      if(premClaimed){
        html+='<span style="font-size:9px;color:var(--gn)">✓</span>';
      } else if(unlocked){
        html+='<button onclick="claimPassTier('+tierNum+',true)" style="font-size:7px;padding:2px 6px;border-radius:3px;background:var(--pp);border:none;color:#fff;cursor:pointer;font-weight:700">'+premIcon+' '+premAmt+'</button>';
      } else {
        html+='<span style="font-size:8px;color:var(--tx3)">'+premIcon+' '+premAmt+'</span>';
      }
      html+='</div>';
    }
    html+='</div>';
  });
  box.innerHTML=html;
}

function claimPassTier(tier,isPremium){
  fetch('/api/season/pass/claim',{method:'POST',headers:Object.assign({'Content-Type':'application/json'},getAuthHeaders()),
    body:JSON.stringify({wallet:walletState.address,tier:tier,isPremium:isPremium})
  }).then(function(r){return r.json()}).then(function(d){
    if(d.error){ showAlert(d.error); return; }
    showAlert('🎁 Tier '+tier+' 보상 수령: '+d.label,'success');
    loadSeasonPass();
  }).catch(function(e){ showAlert(e.message); });
}

function purchaseSeasonPass(){
  var cost=window._seasonPassCost||500;
  var myGP=walletState.gameGP||0;
  var insufficient=myGP<cost;
  gameConfirm({
    title:t('season_pass_buy_title'),
    icon:'⭐',
    body:t('season_pass_buy_body'),
    info:[
      {k:t('season_pass_cost_label'),v:cost+' GP'},
      {k:t('season_pass_balance_label'),v:Math.floor(myGP)+' GP',insufficient:insufficient}
    ],
    confirmText:t('season_pass_buy_confirm'),
    disabled:insufficient
  }).then(function(ok){
    if(!ok) return;
    fetch('/api/season/pass/purchase',{method:'POST',headers:Object.assign({'Content-Type':'application/json'},getAuthHeaders()),
      body:JSON.stringify({wallet:walletState.address})
    }).then(function(r){return r.json()}).then(function(d){
      if(d.error){ showAlert(d.error); return; }
      showAlert('⭐ '+t('season_pass_buy_title')+' OK!','success');
      loadSeasonPass();
    }).catch(function(e){ showAlert(e.message); });
  });
}

// ── Category Leaderboard (Migration 098) ──
var _currentCatLb = 'overall';
function switchCatLb(key, el) {
  _currentCatLb = key;
  document.querySelectorAll('.cat-lb-pill').forEach(function(p) {
    var isActive = p.id === 'catPill_' + key;
    p.style.background = isActive ? 'rgba(255,120,60,.15)' : 'rgba(91,184,232,.08)';
    p.style.borderColor = isActive ? 'rgba(255,120,60,.4)' : 'rgba(91,184,232,.25)';
    p.style.color = isActive ? 'var(--mars)' : 'var(--tx3)';
  });
  loadSeasonLeaderboard();
}

// Career stats toggle
var _careerStatsLoaded = false;
function toggleCareerStats() {
  var panel = document.getElementById('careerStatsPanel');
  var toggle = document.getElementById('careerStatsToggle');
  if (panel.style.display === 'none') {
    panel.style.display = '';
    toggle.textContent = '▲';
    if (!_careerStatsLoaded) loadCareerStats();
  } else { panel.style.display = 'none'; toggle.textContent = '▼'; }
}

async function loadCareerStats() {
  var w = walletState.address;
  var el = document.getElementById('careerStatsList');
  if (!w) { el.innerHTML = '<div style="text-align:center;color:var(--tx3);padding:8px;font-size:9px" data-i18n="gp_activity_login">Login to view.</div>'; applyI18n(el); return; }
  el.innerHTML = '<div style="text-align:center;color:var(--tx3);padding:8px;font-size:9px">...</div>';
  try {
    var r = await fetch('/api/stats/career', { headers: getAuthHeaders() });
    var d = await r.json();
    var html = '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">';
    var rows = [
      ['⚓ ' + (t('cat_naval') || 'Naval Wins'), d.battles.wins + ' W / ' + d.battles.losses + ' L', d.battles.wins > 0 ? 'var(--cyan)' : 'var(--tx3)'],
      ['⚗️ ' + (t('cat_enhance') || 'Enhancements'), d.enhancements.total + ' ('+d.enhancements.successRate+'%)', 'var(--gold)'],
      ['🚢 ' + (t('cat_ships') || 'Ships Built'), d.ships.built + '', 'var(--gn)'],
      ['🛒 ' + (t('cat_trades') || 'Trades'), d.trades.total + '', 'var(--pp)'],
      ['💰 GP in Battles', '+' + Math.floor(d.battles.gpWon) + ' GP', d.battles.gpWon > 0 ? 'var(--gn)' : 'var(--tx3)'],
      ['⚗️ GP on Enhance', Math.floor(d.enhancements.totalGP) + ' GP', 'var(--mars)']
    ];
    rows.forEach(function(row) {
      html += '<div style="padding:6px;background:rgba(255,255,255,.02);border:1px solid var(--bdr);border-radius:6px">' +
        '<div style="font-size:8px;color:var(--tx3);margin-bottom:2px">'+row[0]+'</div>' +
        '<div style="font-size:11px;color:'+row[2]+';font-family:var(--fn);font-weight:700">'+row[1]+'</div>' +
        '</div>';
    });
    html += '</div>';
    el.innerHTML = html;
    _careerStatsLoaded = true;
  } catch(e) { el.innerHTML = '<div style="color:var(--mars);font-size:9px;text-align:center">Failed to load</div>'; }
}

function loadSeasonLeaderboard(){
  var w=walletState.address||'';
  var el=document.getElementById('seasonLeaderboard');
  var labelEl=document.getElementById('catLbLabel');

  if(_currentCatLb!=='overall'){
    // Category leaderboard
    fetch('/api/season/category/'+encodeURIComponent(_currentCatLb)+'?limit=10')
      .then(function(r){return r.json()}).then(function(d){
        if(labelEl && d.category) labelEl.textContent = d.category.icon + ' ' + d.category.desc;
        document.getElementById('mySeasonRank').style.display='none';
        var entries=d.entries||[];
        if(!entries.length){el.innerHTML='<div style="text-align:center;color:var(--tx3);padding:8px;font-size:10px">'+t('season_no_scores')+'</div>';return;}
        var medals=['🥇','🥈','🥉'];
        el.innerHTML=entries.map(function(p,i){
          var isMe=p.wallet===w;
          var medal=i<3?medals[i]:'';
          return '<div style="display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:6px;margin-bottom:2px;'+(isMe?'background:rgba(255,120,60,.08);border:1px solid rgba(255,120,60,.15)':'background:rgba(255,255,255,.01)')+'">'+
            '<span style="font-size:'+(i<3?'14px':'10px')+';min-width:24px;text-align:center">'+(medal||'<span style="color:var(--tx3);font-weight:700">#'+p.rank+'</span>')+'</span>'+
            '<div style="flex:1;min-width:0"><div style="font-size:10px;color:'+(isMe?'var(--mars)':'var(--tx)')+';font-weight:'+(isMe?'700':'400')+'">'+p.nickname+'</div></div>'+
            '<div style="font-size:11px;color:var(--gold);font-weight:700">'+p.value.toLocaleString()+'</div>'+
          '</div>';
        }).join('');
      }).catch(function(){el.innerHTML='<div style="text-align:center;color:var(--tx3);padding:8px;font-size:9px">Failed</div>';});
    return;
  }

  if(labelEl) labelEl.textContent='';
  fetch('/api/season/leaderboard?limit=20').then(function(r){return r.json()}).then(function(d){
    var lb=d.leaderboard||[];
    if(!lb.length){el.innerHTML='<div style="text-align:center;color:var(--tx3);padding:8px;font-size:10px">'+t('season_no_scores')+'</div>';document.getElementById('mySeasonRank').style.display='none';return;}

    // Find my rank
    var myRankEl=document.getElementById('mySeasonRank');
    var myEntry=lb.find(function(p){return p.wallet===w});
    if(myEntry){
      myRankEl.style.display='';
      document.getElementById('mySeasonRankNum').textContent='#'+myEntry.rank;
      document.getElementById('mySeasonScore').textContent=myEntry.score.toLocaleString()+' '+t('season_pts_suffix')+' · '+myEntry.pixelsClaimed+'px · '+myEntry.harvests+'h · '+myEntry.hijacksWon+'hj';
    } else { myRankEl.style.display='none'; }

    var medals=['🥇','🥈','🥉'];
    el.innerHTML=lb.map(function(p,i){
      var isMe=p.wallet===w;
      var medal=i<3?medals[i]:'';
      return '<div style="display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:6px;margin-bottom:2px;'+(isMe?'background:rgba(255,120,60,.08);border:1px solid rgba(255,120,60,.15)':'background:rgba(255,255,255,.01)')+'">'+
        '<span style="font-size:'+(i<3?'14px':'10px')+';min-width:24px;text-align:center">'+(medal||'<span style="color:var(--tx3);font-weight:700">#'+p.rank+'</span>')+'</span>'+
        '<div style="flex:1;min-width:0"><div style="font-size:10px;color:'+(isMe?'var(--mars)':'var(--tx)')+';white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:'+(isMe?'700':'400')+'">'+p.nickname+'</div>'+
        '<div style="font-size:7px;color:var(--tx3)">'+p.pixelsClaimed+'px · '+p.harvests+'h · '+p.hijacksWon+'hj</div></div>'+
        '<div style="font-size:11px;color:var(--gold);font-weight:700">'+p.score.toLocaleString()+'</div>'+
      '</div>';
    }).join('');
  }).catch(function(){});

  // Load my rewards
  if(w){
    fetch('/api/season/rewards', { headers: getAuthHeaders() }).then(function(r){return r.json()}).then(function(d){
      var rewards=d.rewards||[];
      var sec=document.getElementById('seasonRewardsSection');
      var list=document.getElementById('seasonRewardsList');
      var unclaimed=rewards.filter(function(r){return !r.claimed});
      if(!unclaimed.length){sec.style.display='none';return;}
      sec.style.display='';
      list.innerHTML=unclaimed.map(function(r){
        return '<div style="display:flex;align-items:center;gap:8px;padding:6px 8px;background:rgba(255,209,102,.04);border:1px solid rgba(255,209,102,.15);border-radius:6px;margin-bottom:4px">'+
          '<div style="flex:1"><div style="font-size:10px;color:var(--tx)">'+r.seasonName+' — '+t('season_rank_suffix')+' #'+r.rank+'</div>'+
          '<div style="font-size:9px;color:var(--gold)">'+r.amount+' '+r.type.toUpperCase()+'</div></div>'+
          '<button onclick="claimSeasonReward('+r.id+')" style="padding:4px 10px;border-radius:4px;background:rgba(76,216,154,.12);border:1px solid rgba(76,216,154,.3);color:var(--gn);font-size:9px;cursor:pointer;font-family:var(--fn)">'+t('season_claim_btn')+'</button>'+
        '</div>';
      }).join('');
    }).catch(function(){});
  }
}

function claimSeasonReward(rewardId){
  var w=walletState.address;
  if(!w) return;
  fetch('/api/season/claim',{method:'POST',headers:Object.assign({'Content-Type':'application/json'},getAuthHeaders()),body:JSON.stringify({wallet:w,rewardId:rewardId})})
  .then(function(r){return r.json()}).then(function(data){
    if(data.error){showToast(data.error,'error');return;}
    showToast(t('season_claim_success').replace('{amount}',data.amount).replace('{type}',data.type.toUpperCase()),'success');
    loadSeasonLeaderboard();
    try{ refreshEmailBalances(); }catch(_re){}
  }).catch(function(){showToast(t('season_claim_failed'),'error')});
}

function loadBaseData(){
  // Use walletState.address, fallback to JWT token wallet
  var w=walletState.address||null;
  if(!w&&emailAuth.token){
    try{
      var payload=JSON.parse(atob(emailAuth.token.split('.')[1]));
      if(payload.wallet){w=payload.wallet;walletState.address=w;walletState.connected=true;}
    }catch(e){}
  }

  // Load sectors (with wallet for "my pixels" count) + influence scores for MMO territory pressure.
  Promise.all([
    fetch('/api/sectors', { headers: getAuthHeaders() }).then(function(r){return r.json()}),
    fetch('/api/sectors/control', { headers: getAuthHeaders() }).then(function(r){return r.ok?r.json():null}).catch(function(){return null;})
  ]).then(function(res){
    var data=res[0]||[];
    var control=(res[1]&&res[1].sectors)||[];
    window._sectorControlMap={};
    control.forEach(function(c){ window._sectorControlMap[c.id]=c; });
    data.forEach(function(s){ if(window._sectorControlMap[s.id]) s.control=window._sectorControlMap[s.id]; });
    _sectorsData=data;
    renderSectorList(data);
    drawSectorBoundaries();
  }).catch(function(){});

  // Load ranks
  fetch('/api/ranks', { headers: getAuthHeaders() }).then(function(r){return r.json()}).then(function(data){
    _ranksData=data;
    renderRankTable(data);
  }).catch(function(){});

  // Load Fleet Command card (M-154 — MY TERRITORY 카드: 함대 요약 + Void Raider 이벤트)
  try { if (typeof loadFleetCommandCard === 'function') loadFleetCommandCard(); } catch(_){}

  // Load user data if logged in
  if(w){
    fetch('/api/user/'+encodeURIComponent(w)+'/base').then(function(r){return r.json()}).then(function(data){
      _baseUserData=data;
      renderBaseUser(data);
    }).catch(function(e){console.error('[BASE] Failed to load user data:', e)});

    // Load quests
    loadQuests(w);
  }
}

var _prevUserRank=0;
function renderBaseUser(data){
  if(!data||!data.user) return;
  var u=data.user;
  // Detect rank up
  if(_prevUserRank>0&&u.rank>_prevUserRank){
    try{_sfx.levelUp()}catch(e){}
    showNotification('system',t('rank_up_title'),t('rank_up_msg').replace('{n}',u.rank));
  }
  _prevUserRank=u.rank;
  document.getElementById('baseTotalPx').textContent=data.territory.totalPixels.toLocaleString();
  document.getElementById('baseUsdt').textContent=u.usdt.toFixed(2);
  document.getElementById('basePP').textContent=u.pp.toFixed(2);
  var gpEl=document.getElementById('baseGP');
  if(gpEl) gpEl.textContent=(u.gp||0).toLocaleString();

  // Rank info (Season tab compact + Profile card)
  var rank=_ranksData.find(function(r){return r.level===u.rank})||{name:'Dust Walker',requiredXp:0};
  var nextRank=_ranksData.find(function(r){return r.level===u.rank+1});
  var xpPct=0;
  if(nextRank){
    xpPct=Math.min(100,Math.max(0,((u.xp-rank.requiredXp)/(nextRank.requiredXp-rank.requiredXp))*100));
  }else{xpPct=100;}

  // Season tab level (compact)
  var rl=document.getElementById('baseRankLevel');if(rl)rl.textContent=u.rank;
  var rn=document.getElementById('baseRankName');if(rn)rn.textContent=rank.name;
  var xc=document.getElementById('baseXpCurrent');if(xc)xc.textContent=u.xp+' XP';
  var xn=document.getElementById('baseXpNext');if(xn)xn.textContent=nextRank?nextRank.requiredXp+' XP':t('max_level');
  var rb=document.getElementById('baseRankBar');if(rb)rb.style.width=xpPct+'%';

  // Profile level card (MY TERRITORY tab)
  var plb=document.getElementById('profileLevelBadge');if(plb)plb.textContent=u.rank;
  var pl=document.getElementById('profileLevel');if(pl)pl.textContent=u.rank;
  var pn=document.getElementById('profileNickname');if(pn)pn.textContent=u.nickname||u.wallet.slice(0,8)+'...';
  var prn=document.getElementById('profileRankName');if(prn)prn.textContent=rank.name;
  var pxc=document.getElementById('profileXpCurrent');if(pxc)pxc.textContent=u.xp+' XP';
  var pxn=document.getElementById('profileXpNext');if(pxn)pxn.textContent=nextRank?t('xp_next').replace('{n}',nextRank.requiredXp):t('max_level');
  var pxb=document.getElementById('profileXpBar');if(pxb)pxb.style.width=xpPct+'%';

  // ACCOUNT modal hero — level + xp + rank title
  var pxLv=document.getElementById('profileXpLv');if(pxLv)pxLv.textContent=u.rank;
  var pxFill=document.getElementById('profileXpFill');if(pxFill)pxFill.style.width=xpPct+'%';
  var pxVal=document.getElementById('profileXpVal');if(pxVal)pxVal.textContent=(nextRank?(u.xp+'/'+nextRank.requiredXp):(u.xp+' XP'));
  var pRankTitle=document.getElementById('profileRankTitle');if(pRankTitle)pRankTitle.textContent=rank.name;
  // Pixels owned + joined days
  try{
    var pxCnt=document.getElementById('profilePxCount');
    if(pxCnt && data.territory) pxCnt.textContent=(data.territory.totalPixels||0).toLocaleString();
    var jDays=document.getElementById('profileJoinedDays');
    if(jDays && u.joinedAt){
      var d=Math.floor((Date.now()-new Date(u.joinedAt).getTime())/(24*3600*1000));
      jDays.textContent=(isFinite(d)&&d>=0?d:0);
    }
  }catch(_ej){}
  // Guild chip (from _myGuildData if set)
  try{
    var gChip=document.getElementById('profileGuildChip');
    var gName=document.getElementById('profileGuildName');
    if(gChip && gName){
      if(typeof _myGuildData!=='undefined' && _myGuildData && _myGuildData.name){
        gName.textContent=(_myGuildData.tag?('['+_myGuildData.tag+'] '):'')+_myGuildData.name;
        gChip.style.display='';
      }else{
        gChip.style.display='none';
      }
    }
  }catch(_eg){}

  // Highlight current rank in table
  document.querySelectorAll('.rank-table tbody tr').forEach(function(tr){
    tr.classList.toggle('current',parseInt(tr.dataset.level)===u.rank);
  });

  // My sectors
  var mySec=document.getElementById('baseMySectors');
  if(data.territory.bySector.length===0){
    mySec.innerHTML='<div style="color:var(--tx3);font-size:10px;padding:8px 0">'+t('no_sectors_yet')+'</div>';
  }else{
    var html='<div class="sector-list">';
    data.territory.bySector.forEach(function(s){
      html+='<div class="sector-item" onclick="focusSector('+s.sectorId+')">';
      html+='<span class="si-tier '+s.tier+'">'+s.tier.toUpperCase()+'</span>';
      html+='<span class="si-name">'+s.sectorName+'</span>';
      html+='<span class="si-price" style="color:var(--gold)">'+s.pixels+' px</span>';
      html+='</div>';
    });
    html+='</div>';
    mySec.innerHTML=html;
  }

  // Mining
  if(data.mining){
    document.getElementById('baseMineTotalMined').textContent=data.mining.totalMined.toFixed(2);

    // Show estimated harvest range on button
    var hBtn=document.getElementById('baseHarvestBtn');
    var iBtn=document.getElementById('baseInstantHarvestBtn');
    window._miningEstMin=data.mining.estimatedMin||0;
    window._miningEstMax=data.mining.estimatedMax||0;
    window._instantHarvestCost=data.mining.instantCost||0.5;
    var rangeStr='';
    if(window._miningEstMin>0){
      rangeStr=' ('+window._miningEstMin.toFixed(2)+'~'+window._miningEstMax.toFixed(2)+' PP + 🪨)';
    }
    if(data.mining.harvestAvailable){
      document.getElementById('baseMineTimer').textContent=t('harvest_available');
      document.getElementById('baseMineAvail').textContent=t('harvest_ready');
      hBtn.disabled=false;
      hBtn.innerHTML='<span>'+t('harvest_pp')+rangeStr+'</span>';
      iBtn.style.display='none';
    }else if(data.mining.nextHarvestAt){
      startMineTimer(new Date(data.mining.nextHarvestAt));
      document.getElementById('baseMineAvail').textContent='0.00';
      hBtn.disabled=true;
      hBtn.innerHTML='<span>'+t('harvest_pp')+'</span>';
      // Show instant harvest with real cost
      iBtn.innerHTML='<span>'+t('harvest_now').replace('{cost}',window._instantHarvestCost)+'</span>';
    }else if(data.territory.totalPixels===0){
      document.getElementById('baseMineTimer').textContent=t('claim_to_mine');
      document.getElementById('baseMineAvail').textContent='--';
      hBtn.disabled=true;
      hBtn.innerHTML='<span>'+t('harvest_pp')+'</span>';
      iBtn.style.display='none';
    }
  }

  // Mining rates from server
  if(data.miningRates){
    var mr=data.miningRates;
    var bestInt=data.miningInterval.best||72;
    var ratesHtml='';
    ratesHtml+='<div class="stat-row"><span class="stat-label">'+t('rate_reward_range')+'</span><span class="stat-val" style="font-size:10px">'+mr.rewardMin+' ~ '+mr.rewardMax+' PP</span></div>';
    ratesHtml+='<div class="stat-row"><span class="stat-label">'+t('rate_interval')+'</span><span class="stat-val" style="font-size:10px;color:var(--cyan)">'+bestInt+'h</span></div>';
    ratesHtml+='<div class="stat-row"><span class="stat-label">'+t('rate_core')+'</span><span class="stat-val" style="font-size:10px;color:var(--red)">×'+mr.coreMult+'</span></div>';
    ratesHtml+='<div class="stat-row"><span class="stat-label">'+t('rate_mid')+'</span><span class="stat-val" style="font-size:10px;color:var(--gold)">×'+mr.midMult+'</span></div>';
    ratesHtml+='<div class="stat-row"><span class="stat-label">'+t('rate_frontier')+'</span><span class="stat-val" style="font-size:10px;color:var(--gn)">×'+mr.frontierMult+'</span></div>';
    document.getElementById('baseMineRates').innerHTML=ratesHtml;
  }

  // ── Mineral Drop 정보 표시 ──
  (function renderMineralDrops(){
    var dropEl=document.getElementById('baseMineralDrops');
    if(!dropEl) return;
    // 유저가 보유한 구역 파악
    var tc=(data.territory&&data.territory.tierCounts)||{};
    var hasCore=tc.core>0, hasMid=tc.mid>0, hasFrontier=(tc.frontier||0)>0||(data.territory&&data.territory.totalPixels>0&&!hasCore&&!hasMid);

    // 구역별 광물 드롭 테이블 (migration 164 기준)
    var DROPS={
      frontier:[
        {code:'iron_ore',   icon:'🪨', name:{en:'Iron Ore',    ko:'철광석',    ja:'鉄鉱石',   zh:'铁矿石'},   rate:30},
        {code:'carbon_fiber',icon:'🖤',name:{en:'Carbon Fiber',ko:'탄소섬유', ja:'炭素繊維',  zh:'碳纤维'},   rate:20},
        {code:'silicon_chip',icon:'💎',name:{en:'Silicon Chip',ko:'실리콘칩', ja:'シリコンチップ',zh:'硅芯片'}, rate:10},
      ],
      mid:[
        {code:'titanium_alloy', icon:'⚙️', name:{en:'Titanium Alloy',  ko:'티타늄합금',  ja:'チタン合金',    zh:'钛合金'},    rate:20},
        {code:'plasma_crystal', icon:'🔷', name:{en:'Plasma Crystal',  ko:'플라즈마크리스탈', ja:'プラズマクリスタル',zh:'等离子晶体'}, rate:15},
        {code:'nano_polymer',   icon:'🧬', name:{en:'Nano Polymer',    ko:'나노폴리머',  ja:'ナノポリマー',   zh:'纳米聚合物'}, rate:15},
      ],
      core:[
        {code:'dark_matter',  icon:'🌑', name:{en:'Dark Matter',   ko:'암흑물질',   ja:'暗黒物質',    zh:'暗物质'},    rate:15},
        {code:'quantum_core', icon:'⚡', name:{en:'Quantum Core',  ko:'양자코어',   ja:'量子コア',    zh:'量子核心'},  rate:12},
        {code:'exotic_alloy', icon:'🌟', name:{en:'Exotic Alloy',  ko:'이국합금',   ja:'異国合金',    zh:'异星合金'},  rate:10},
      ]
    };
    var lang=(window.currentLang||'en').toLowerCase();
    var html='';

    function renderZoneDrops(zoneKey, zoneLabel, zoneColor, hasTiles){
      var drops=DROPS[zoneKey];
      var opacity=hasTiles?'1':'0.35';
      var noLand=hasTiles?'':' <span style="font-size:8px;color:var(--tx3)">(no land)</span>';
      html+='<div style="margin-top:6px;opacity:'+opacity+'">';
      html+='<div style="font-size:9px;font-weight:700;color:'+zoneColor+';letter-spacing:1px;margin-bottom:2px">'+zoneLabel+noLand+'</div>';
      drops.forEach(function(d){
        var name=d.name[lang]||d.name.en;
        html+='<div class="stat-row" style="padding:1px 0">';
        html+='<span class="stat-label" style="display:flex;align-items:center;gap:4px">'+d.icon+' '+name+'</span>';
        html+='<span class="stat-val" style="font-size:10px;color:var(--tx2)">'+d.rate+'%</span>';
        html+='</div>';
      });
      html+='</div>';
    }

    renderZoneDrops('frontier','FRONTIER','var(--gn)', hasFrontier);
    renderZoneDrops('mid',     'MID ZONE','var(--gold)',hasMid);
    renderZoneDrops('core',    'CORE',    'var(--red)', hasCore);

    html+='<div style="font-size:8px;color:var(--tx3);margin-top:8px;line-height:1.7;padding:6px 0;border-top:1px solid var(--bdr)">⛏ '+(lang==='ko'?'채굴 시 PP와 함께 광물이 확률적으로 드롭됩니다.<br>광물은 함선 건조와 마켓에 사용됩니다.':lang==='ja'?'採掘時にPPとともに鉱物がランダムでドロップされます。<br>鉱物は艦船建造とマーケットで使用されます。':lang==='zh'?'采矿时PP和矿物会随机掉落。<br>矿物用于舰船建造和市场交易。':'Mining yields PP and random mineral drops.<br>Minerals are used in ship construction and the marketplace.')+'</div>';
    dropEl.innerHTML=html;
  })();

  // ✅ [Job System] Load job card after base data renders
  var jw = walletState && walletState.address ? walletState.address : null;
  if(jw && u.rank >= 1) loadUserJob(jw, u.rank);
}

// ══════════════════════════════════════════════════════
// JOB SYSTEM — Phase 1 Frontend
// ══════════════════════════════════════════════════════
var _jobData = null; // current user's job data
var _allJobs = [];   // all available jobs
var _selectedJobCode = null; // selection in modal

// Server (getMyJob) returns a flat shape: { has_job, job_code, job_name_ko,
// job_name_en, icon_emoji, color_hex, description_ko, buffs:[{buff_key,buff_value}],
// weekly_changes, weekly_free_limit, can_change_free, on_cooldown,
// cooldown_remaining_hours, changed_at, change_cost_gp }.
// The UI (renderJobCard, job modal selection logic) expects a nested shape:
// { job:{code,name,icon_emoji,color_hex}, buffs:{key:mult}, changeStatus:{...} }.
// This adapter bridges the two so updates after job selection actually render.
function _transformJobData(raw, lang){
  if(!raw || raw.error) return { job:null, buffs:{}, changeStatus:{} };
  lang = (lang||'en').toLowerCase();
  var job = null;
  if(raw.has_job && raw.job_code){
    var nameLocalized = raw['job_name_'+lang] || raw.job_name_en || raw.job_name_ko || raw.job_code;
    job = {
      code: raw.job_code,
      name: nameLocalized,
      name_en: raw.job_name_en,
      name_ko: raw.job_name_ko,
      icon_emoji: raw.icon_emoji || '⚔️',
      color_hex: raw.color_hex || '#f0c840',
      description: raw['description_'+lang] || raw.description_ko || '',
    };
  }
  // buffs: array of {buff_key, buff_value} → object {key: multiplier}
  var buffs = {};
  if(Array.isArray(raw.buffs)){
    raw.buffs.forEach(function(b){
      if(b && b.buff_key) buffs[b.buff_key] = parseFloat(b.buff_value);
    });
  } else if(raw.buffs && typeof raw.buffs === 'object'){
    Object.keys(raw.buffs).forEach(function(k){ buffs[k] = parseFloat(raw.buffs[k]); });
  }
  // changeStatus: flat → nested
  var cooldownEndsAt = null;
  if(raw.on_cooldown && raw.changed_at){
    var base = new Date(raw.changed_at).getTime();
    cooldownEndsAt = new Date(base + (raw.cooldown_remaining_hours||0)*3600000).toISOString();
  }
  var freeLeft = Math.max(0, (raw.weekly_free_limit||0) - (raw.weekly_changes||0));
  var changeStatus = {
    canChangeFree: !!raw.can_change_free,
    freeChangesLeft: freeLeft,
    paidCostGp: raw.change_cost_gp || 0,
    cooldownEndsAt: cooldownEndsAt,
  };
  return { job: job, buffs: buffs, changeStatus: changeStatus, raw: raw };
}

function loadUserJob(wallet, rank){
  if(!wallet) return;
  var lang = (window.LANG || window._lang || 'en');
  fetch('/api/user/job?lang='+lang, { headers: getAuthHeaders() })
    .then(function(r){return r.json()})
    .then(function(raw){
      var data = _transformJobData(raw, lang);
      _jobData = data;
      renderJobCard(data, rank);
      // If level >= required and no job: show modal (only once per session)
      if(rank >= 5 && !data.job && !sessionStorage.getItem('jobModalShown')){
        sessionStorage.setItem('jobModalShown','1');
        setTimeout(function(){ openJobSelectModal(); }, 1200);
      }
    }).catch(function(){});
}

function renderJobCard(data, rank){
  var card = document.getElementById('jobCardMini');
  if(!card) return;
  var requiredLevel = 5; // matches settings job_required_level default

  // Show card only if level >= 1 (always visible as a prompt or status)
  card.style.display = '';

  var icon = document.getElementById('jobCardIcon');
  var name = document.getElementById('jobCardName');
  var buffs = document.getElementById('jobCardBuffs');
  var btn = document.getElementById('jobCardBtn');
  var status = document.getElementById('jobCardChangeStatus');

  if(data && data.job){
    // Has a job
    card.classList.remove('no-job','job-choose-pulse');
    card.style.borderColor = data.job.color_hex ? data.job.color_hex+'55' : 'rgba(255,255,255,.15)';
    if(icon) icon.textContent = data.job.icon_emoji || '⚔️';
    if(name){ name.textContent = data.job.name; name.style.color = data.job.color_hex || 'var(--tx)'; }

    // Show top 3 positive buffs
    if(buffs && data.buffs){
      var pills = [];
      Object.entries(data.buffs).forEach(function(e){
        if(e[1] > 1.0) pills.push('<span class="job-buff-pill" style="background:rgba(100,220,100,.1);color:#6dc86d">+'+Math.round((e[1]-1)*100)+'% '+_buffLabelShort(e[0])+'</span>');
      });
      buffs.innerHTML = pills.slice(0,3).join('');
    }

    if(btn) btn.textContent = t('job_change_btn');

    // Change status
    if(status && data.changeStatus){
      var cs = data.changeStatus;
      status.style.display = '';
      if(cs.cooldownEndsAt){
        var d = new Date(cs.cooldownEndsAt);
        status.textContent = t('job_cooldown').replace('{t}', d.toLocaleDateString());
        status.style.color = 'var(--red)';
      } else if(cs.canChangeFree){
        status.textContent = t('job_free_change').replace('{n}', cs.freeChangesLeft);
        status.style.color = 'var(--gn)';
      } else {
        status.textContent = t('job_paid_change').replace('{n}', cs.paidCostGp);
        status.style.color = 'var(--gold)';
      }
    }
  } else {
    // No job
    card.classList.add('no-job');
    if(rank >= requiredLevel) card.classList.add('job-choose-pulse');
    else card.classList.remove('job-choose-pulse');
    if(icon) icon.textContent = '❓';
    if(name){ name.textContent = rank >= requiredLevel ? t('job_none') : t('job_locked').replace('{n}', requiredLevel); name.style.color = rank >= requiredLevel ? 'var(--gold)' : 'var(--tx3)'; }
    if(buffs) buffs.innerHTML = '';
    if(btn) btn.textContent = rank >= requiredLevel ? t('job_choose_btn') : '';
    if(status) status.style.display = 'none';
  }
}

function _buffLabelShort(key){
  var m = {
    miner_mining_rate:'MINE', miner_harvest_speed:'HARVEST', miner_poi_reward:'POI',
    warrior_combat_power:'COMBAT', warrior_hijack_success:'HIJACK', warrior_defense_item_effect:'DEF',
    crafter_enhancement_success:'ENHANCE', crafter_enhancement_cost:'COST', crafter_enhancement_break_protection:'BREAK',
    merchant_market_fee:'FEE', merchant_listing_limit:'LISTING', merchant_price_history_days:'HISTORY'
  };
  return m[key] || key.split('_').slice(-1)[0].toUpperCase();
}

// ══════════════════════════════════════════════════════════════
// ONBOARDING TUTORIAL SYSTEM (Migration 083 — MASTER_PLAN Phase 3)
// ══════════════════════════════════════════════════════════════
var _obState = null; // cached onboarding state from server

async function initOnboarding(wallet) {
  if (!wallet) return;
  try {
    var _obTok = localStorage.getItem('pw_token');
    var _obHdrs = _obTok ? {'Authorization':'Bearer '+_obTok} : {};
    var r = await fetch('/api/onboarding', {headers: _obHdrs});
    if (!r.ok) return;
    var state = await r.json();
    _obState = state;
    if (!state.enabled || state.completed || state.skipped) return;
    // Show onboarding for incomplete users
    var step = state.currentStep || 0;
    if (step === 0) {
      // Brand new user — show step 1 intro
      setTimeout(function() { showOnboardingStep(1); }, 800);
    } else if (step < 5) {
      // Returning mid-onboarding user — show resume prompt
      setTimeout(function() { showOnboardingStep(step + 1); }, 800);
    }
  } catch (e) { /* non-critical */ }
}

function _obSetDots(activeStep) {
  for (var i = 1; i <= 5; i++) {
    var dot = document.getElementById('obDot' + i);
    if (!dot) continue;
    dot.className = 'ob-dot';
    if (i < activeStep) dot.classList.add('done');
    else if (i === activeStep) dot.classList.add('active');
  }
}

var _OB_STEPS = {
  1: {
    emoji: '🚀',
    title_en: 'CLAIM YOUR FIRST TERRITORY',
    title_ko: '첫 영토를 점령하세요',
    body_en: '<b>Mars starts with one small claim.</b><br>Tap any red zone on the map and plant your flag on your first territory.<br><br>⭐ Your first claim is <b>FREE</b> — no PP required.',
    body_ko: '<b>화성의 시작은 작은 영토 하나입니다.</b><br>지도의 빨간 영역을 탭해 첫 영토에 깃발을 세우세요.<br><br>⭐ 첫 번째 클레임은 <b>무료</b>입니다 — PP가 필요 없습니다.',
    next_en: 'GOT IT — SHOW ME THE MAP',
    next_ko: '알겠어요 — 지도 보기'
  },
  2: {
    emoji: '⛏️',
    title_en: 'HARVEST FROM YOUR TERRITORY',
    title_ko: '영토에서 수확하세요',
    body_en: 'Your territory generates <b>PP</b> over time.<br><br>→ Tap <b>[HARVEST]</b> to collect it.<br>→ PP is the fuel for expansion, ships, and growth.',
    body_ko: '영토에서는 시간이 지나면 <b>PP</b>가 생성됩니다.<br><br>→ <b>[수확하기]</b>를 눌러 회수하세요.<br>→ PP는 확장, 함선, 성장의 연료입니다.',
    next_en: 'UNDERSTOOD',
    next_ko: '이해했어요'
  },
  3: {
    emoji: '🚢',
    title_en: 'BUILD YOUR FIRST FLEET',
    title_ko: '첫 함대 준비하기',
    body_en: 'Territory growth leads to combat power.<br><br>Use your resources to prepare ships, organize a fleet, and get ready to defend what you own.',
    body_ko: '영토 성장은 전력으로 이어집니다.<br><br>자원을 모아 함선을 준비하고, 함대를 구성해 당신의 영토를 지킬 준비를 하세요.',
    next_en: 'NEXT',
    next_ko: '다음'
  },
  4: {
    emoji: '⚔️',
    title_en: 'FOLLOW YOUR FIRST MISSION',
    title_ko: '첫 임무를 따라가세요',
    body_en: 'Your next objective lives in <b>Campaign</b>.<br><br>Follow the mission steps to learn the core loop: claim territory, harvest, and push toward conflict.',
    body_ko: '다음 목표는 <b>캠페인</b>에 있습니다.<br><br>임무 순서를 따라가며 영토 확보, 수확, 그리고 첫 분쟁까지 핵심 루프를 익히세요.',
    next_en: 'NEXT',
    next_ko: '다음'
  },
  5: {
    emoji: '🎯',
    title_en: 'READY TO EXPAND',
    title_ko: '이제 확장할 시간입니다',
    body_en: 'You now know the core loop.<br><br><b>Claim territory → Harvest resources → Build your fleet → Follow missions</b><br><br>Take your starter reward and begin expanding on Mars.',
    body_ko: '이제 핵심 루프를 이해했습니다.<br><br><b>영토 확보 → 자원 수확 → 함대 준비 → 임무 진행</b><br><br>시작 보상을 받고 화성에서 세력을 확장하세요.',
    next_en: '🎉 CLAIM REWARD',
    next_ko: '🎉 보상 수령'
  }
};

function _obStepContent(step) {
  var lang = (typeof _lang !== 'undefined' ? _lang : 'en') || 'en';
  var s = _OB_STEPS[step];
  if (!s) return '';
  var title = s['title_' + lang] || s.title_en;
  var body  = s['body_'  + lang] || s.body_en;
  var next  = s['next_'  + lang] || s.next_en;
  var rewardHtml = '';
  if (step === 5 && _obState && _obState.rewards) {
    var r = _obState.rewards;
    rewardHtml = '<div class="ob-reward-row">'
      + (r.pp  ? '<div class="ob-reward-chip">🟣 ' + r.pp  + ' PP</div>'  : '')
      + (r.gp  ? '<div class="ob-reward-chip">🟡 ' + r.gp  + ' GP</div>'  : '')
      + (r.xp  ? '<div class="ob-reward-chip">⚡ ' + r.xp  + ' XP</div>'  : '')
      + '</div>';
  }
  var skipBtn = (_obState && _obState.skipAllowed && step < 5)
    ? '<button class="ob-btn-skip" onclick="obSkip()">SKIP</button>'
    : '';
  return '<div class="ob-emoji">' + s.emoji + '</div>'
    + '<div class="ob-title">' + title + '</div>'
    + '<div class="ob-sub">' + body + '</div>'
    + rewardHtml
    + '<div class="ob-actions">'
    + skipBtn
    + '<button class="ob-btn-next" onclick="obNextStep(' + step + ')">' + next + '</button>'
    + '</div>';
}

function showOnboardingStep(step) {
  var ov = document.getElementById('obOverlay');
  var ct = document.getElementById('obContent');
  if (!ov || !ct) return;
  _obSetDots(step);
  ct.innerHTML = _obStepContent(step);
  ov.style.display = 'flex';
}

async function obNextStep(currentStep) {
  var wallet = walletState && walletState.address;
  if (!wallet) return;

  // Step 5 = final step → claim reward
  if (currentStep === 5) {
    try {
      var _obTok2 = localStorage.getItem('pw_token');
      var r = await fetch('/api/onboarding/reward', {
        method: 'POST',
        headers: Object.assign({'Content-Type':'application/json'}, _obTok2 ? {'Authorization':'Bearer '+_obTok2} : {}),
        body: JSON.stringify({ wallet: wallet })
      });
      var d = await r.json();
      if (d.ok) {
        document.getElementById('obOverlay').style.display = 'none';
        showToast('🎉 ' + (d.rewards.pp || 0) + ' PP + ' + (d.rewards.gp || 0) + ' GP '+(LANG==='ko'?'보상 지급!':LANG==='ja'?'報酬付与！':LANG==='zh'?'奖励发放！':'reward granted!'));
        try { refreshEmailBalances(); } catch(e) {}
        return;
      }
      if (d.error === 'already_claimed') {
        document.getElementById('obOverlay').style.display = 'none'; return;
      }
    } catch(e) {}
    document.getElementById('obOverlay').style.display = 'none';
    return;
  }

  // Steps 1~4 → mark complete + advance
  var next = currentStep + 1;
  try {
    var _obTok3 = localStorage.getItem('pw_token');
    await fetch('/api/onboarding/step', {
      method: 'POST',
      headers: Object.assign({'Content-Type':'application/json'}, _obTok3 ? {'Authorization':'Bearer '+_obTok3} : {}),
      body: JSON.stringify({ wallet: wallet, step: currentStep })
    });
  } catch(e) {}

  // Step 1 → hide overlay so user can interact with map
  if (currentStep === 1) {
    document.getElementById('obOverlay').style.display = 'none';
    showToast(LANG==='ko'?'👆 영토를 탭해서 첫 클레임을 시작하세요!':LANG==='ja'?'👆 領土をタップして最初のクレームを開始してください！':LANG==='zh'?'👆 点击领地开始您的第一次占领！':'👆 Tap territory to start your first claim!');
    return;
  }

  // Steps 2~4 → show next step
  if (_obState) _obState.currentStep = currentStep;
  showOnboardingStep(next);
}

async function obSkip() {
  var wallet = walletState && walletState.address;
  if (!wallet) return;
  try {
    var _obTok4 = localStorage.getItem('pw_token');
    await fetch('/api/onboarding/skip', {
      method: 'POST',
      headers: Object.assign({'Content-Type':'application/json'}, _obTok4 ? {'Authorization':'Bearer '+_obTok4} : {}),
      body: JSON.stringify({ wallet: wallet })
    });
  } catch(e) {}
  document.getElementById('obOverlay').style.display = 'none';
  _obState = null;
}

// Called from claim success handler when tutorialFreeClaim = true
function onTutorialClaimSuccess() {
  // Mark step 1 done (backend already did it), show step 2
  try {
    var _obTok5 = localStorage.getItem('pw_token');
    fetch('/api/onboarding/step', {
      method: 'POST',
      headers: Object.assign({'Content-Type':'application/json'}, _obTok5 ? {'Authorization':'Bearer '+_obTok5} : {}),
      body: JSON.stringify({ wallet: walletState.address, step: 1 })
    });
  } catch(e) {}
  if (_obState) _obState.currentStep = 1;
  setTimeout(function() { showOnboardingStep(2); }, 400);
}
// ══════════════════════════════════════════════════════════════
// END ONBOARDING SYSTEM
// ══════════════════════════════════════════════════════════════

function openJobSelectModal(){
  if(!walletState||!walletState.address) return;
  var modal = document.getElementById('jobSelectModal');
  if(!modal) return;
  _selectedJobCode = null;
  var confirmBtn = document.getElementById('jobModalConfirmBtn');
  if(confirmBtn){ confirmBtn.disabled=true; confirmBtn.style.opacity='.5'; }

  var costInfo = document.getElementById('jobModalCostInfo');
  if(costInfo) costInfo.style.display='none';
  var selInfo = document.getElementById('jobModalSelectedInfo');
  if(selInfo) selInfo.style.display='none';

  // Close button always visible (was hidden for new users — UX friction)
  var cancelBtn = document.getElementById('jobModalCancelBtn');
  if(cancelBtn) cancelBtn.style.display = '';

  modal.style.display = 'flex';

  var lang = window.LANG || window._lang || 'en';
  fetch('/api/jobs?lang='+lang)
    .then(function(r){return r.json()})
    .then(function(d){
      _allJobs = d.jobs || [];
      renderJobChoiceGrid();
    }).catch(function(){});
}

// Normalize raw API job object (API returns name_ko/name_en/buff_key/buff_value) → UI shape
function _normalizeJob(job){
  if(!job) return null;
  var lang = (window.LANG || window._lang || window._currentLang || 'en').toLowerCase();
  var name = job['name_'+lang] || job.name_en || job.name_ko || job.code;
  var desc = job['description_'+lang] || job.description_en || job.description_ko || '';
  var rawBuffs = job.buffs || [];
  var buffs = rawBuffs.map(function(b){
    var key = b.buff_key || b.key;
    var val = (b.buff_value !== undefined) ? parseFloat(b.buff_value) : b.value;
    return { key:key, value:val, description:b.description||'' };
  });
  return Object.assign({}, job, { name:name, description:desc, buffs:buffs });
}

function renderJobChoiceGrid(){
  var grid = document.getElementById('jobChoiceGrid');
  if(!grid) return;
  var html = '';
  _allJobs.forEach(function(rawJob){
    var job = _normalizeJob(rawJob);
    var isCurrent = _jobData && _jobData.job && _jobData.job.code === job.code;
    var posBuffs = (job.buffs||[]).filter(function(b){return b.value>1.0;});
    var negBuffs = (job.buffs||[]).filter(function(b){return b.value<1.0;});
    html += '<div class="job-choice-card'+(isCurrent?' selected':'')+'"';
    html += ' style="--jc:'+job.color_hex+'"';
    html += ' onclick="selectJobCard(\''+job.code+'\',this)">';
    html += '<div class="job-choice-icon">'+job.icon_emoji+'</div>';
    html += '<div class="job-choice-name" style="color:'+job.color_hex+'">'+job.name+'</div>';
    if(isCurrent) html += '<div style="font-size:8px;color:var(--gn);margin-bottom:4px">✓ '+t('job_current')+'</div>';
    html += '<div class="job-choice-buff">';
    posBuffs.slice(0,2).forEach(function(b){
      html += '<span class="job-buff-pill" style="background:rgba(100,220,100,.12);color:#6dc86d">+'+Math.round((b.value-1)*100)+'% '+_buffLabelShort(b.key)+'</span>';
    });
    negBuffs.slice(0,1).forEach(function(b){
      html += '<span class="job-buff-pill" style="background:rgba(232,72,85,.1);color:var(--red)">'+Math.round((b.value-1)*100)+'% '+_buffLabelShort(b.key)+'</span>';
    });
    html += '</div></div>';
  });
  grid.innerHTML = html;
}

function selectJobCard(jobCode, el){
  _selectedJobCode = jobCode;
  document.querySelectorAll('.job-choice-card').forEach(function(c){ c.classList.remove('selected'); });
  el.classList.add('selected');

  var rawJob = _allJobs.find(function(j){return j.code===jobCode;});
  var job = _normalizeJob(rawJob);
  var confirmBtn = document.getElementById('jobModalConfirmBtn');
  if(confirmBtn){ confirmBtn.disabled=false; confirmBtn.style.opacity='1'; }

  // Show cost info if changing (not first selection)
  var costInfo = document.getElementById('jobModalCostInfo');
  var selInfo = document.getElementById('jobModalSelectedInfo');
  if(_jobData && _jobData.job && _jobData.job.code !== jobCode){
    var cs = _jobData.changeStatus || {};
    if(costInfo){
      costInfo.style.display = '';
      if(cs.cooldownEndsAt){
        costInfo.textContent = t('job_modal_cooldown_warn');
        if(confirmBtn){ confirmBtn.disabled=true; confirmBtn.style.opacity='.5'; }
      } else if(cs.canChangeFree){
        costInfo.textContent = t('job_modal_free').replace('{n}', cs.freeChangesLeft);
      } else {
        costInfo.textContent = t('job_modal_paid').replace('{n}', cs.paidCostGp);
      }
    }
  } else if(costInfo) {
    costInfo.style.display = 'none';
  }

  if(selInfo && job){
    selInfo.style.display = '';
    var allBuffs = (job.buffs||[]).map(function(b){
      var sign = b.value>=1?'+':'';
      return sign+Math.round((b.value-1)*100)+'% '+_buffLabelShort(b.key);
    }).join(' · ');
    selInfo.textContent = job.name + ': ' + allBuffs;
  }
}

function closeJobSelectModal(){
  var modal = document.getElementById('jobSelectModal');
  if(modal) modal.style.display='none';
  _selectedJobCode = null;
}

function confirmJobSelect(){
  if(!_selectedJobCode || !walletState || !walletState.address) return;
  var confirmBtn = document.getElementById('jobModalConfirmBtn');
  if(confirmBtn){ confirmBtn.disabled=true; confirmBtn.textContent='...'; }

  fetch('/api/user/job', {
    method:'POST',
    headers:Object.assign({'Content-Type':'application/json'},getAuthHeaders()),
    body: JSON.stringify({ wallet: walletState.address, jobCode: _selectedJobCode })
  }).then(function(r){return r.json()})
  .then(function(d){
    if(d.error){
      // Map raw server error codes to friendly messages
      var lang = (window.LANG||'en');
      var msgMap = {
        'JOB_SYSTEM_DISABLED':{en:'Job system is currently disabled',ko:'직업 시스템이 비활성화 상태입니다',ja:'ジョブシステムは現在無効です',zh:'职业系统当前已禁用'},
        'USER_NOT_FOUND':{en:'Wallet not registered yet',ko:'지갑이 등록되지 않았습니다',ja:'ウォレットが未登録です',zh:'钱包尚未注册'},
        'JOB_NOT_FOUND':{en:'Unknown job code',ko:'알 수 없는 직업 코드',ja:'不明なジョブコード',zh:'未知职业代码'},
        'SAME_JOB':{en:'You already have this job',ko:'이미 이 직업입니다',ja:'既にこのジョブです',zh:'您已是此职业'},
        'JOB_CHANGE_COOLDOWN':{en:'Job change on cooldown',ko:'직업 변경 쿨다운 중입니다',ja:'ジョブ変更クールダウン中',zh:'职业变更冷却中'},
        'INSUFFICIENT_GP':{en:'Not enough GP',ko:'GP가 부족합니다',ja:'GP不足',zh:'GP不足'},
      };
      var msg = (msgMap[d.error] && msgMap[d.error][lang]) || (msgMap[d.error] && msgMap[d.error].en) || d.error;
      showAlert(msg,'error');
      if(confirmBtn){confirmBtn.disabled=false;confirmBtn.textContent=t('job_modal_confirm');}
      return;
    }
    // Cache selected code & localized name BEFORE closing modal (closeJobSelectModal nulls _selectedJobCode)
    var chosenCode = _selectedJobCode;
    var chosenJob = _allJobs && _allJobs.find(function(j){return j.code===chosenCode;});
    var chosenName = chosenJob ? _normalizeJob(chosenJob).name : chosenCode;
    closeJobSelectModal();
    showToast(t('job_selected_toast').replace('{n}', chosenName));
    try{_sfx.success()}catch(e){}
    // Reload job card — parseInt's || fallback must wrap the entire parseInt arg, not just textContent
    if(walletState && walletState.address){
      var lvlEl = document.getElementById('profileLevel');
      var rank = parseInt((lvlEl && lvlEl.textContent) || '1') || 1;
      loadUserJob(walletState.address, rank);
    }
  }).catch(function(e){ showAlert(e.message,'error'); if(confirmBtn){confirmBtn.disabled=false;confirmBtn.textContent=t('job_modal_confirm');} });
}

function renderSectorList(sectors){
  var html='';
  var myLevel = parseInt((document.getElementById('profileLevel')||{}).textContent || '1') || 1;
  var TIER_LABELS = LANG==='ko'?{ governor:'총독', dominant:'지배', stakeholder:'이해관계자', presence:'존재감' }:LANG==='ja'?{ governor:'総督', dominant:'支配', stakeholder:'利害関係者', presence:'プレゼンス' }:LANG==='zh'?{ governor:'总督', dominant:'主导', stakeholder:'利益相关者', presence:'存在感' }:{ governor:'Governor', dominant:'Dominant', stakeholder:'Stakeholder', presence:'Presence' };
  var TIER_COLORS = { governor:'#ffd700', dominant:'#ff6b6b', stakeholder:'#ffc140', presence:'#64dc82' };
  sectors.forEach(function(s){
    var occ=s.stats.occupancyRate;
    var occPx=s.stats.occupiedPixels;
    var totPx=s.stats.totalPixels||1;
    var ctrl = s.control || (window._sectorControlMap && window._sectorControlMap[s.id]) || null;
    // Entry requirement evaluation
    var entryActive = (s.entryCheckActive !== false);
    var entryMin = s.entryMinLevel || 0;
    var entryMidReq = s.entryRequiredMidOwns || 0;
    var entryBlocked = entryActive && (myLevel < entryMin);
    html+='<div class="sector-card" data-tier="'+s.tier+'" data-owned="'+(s.myPixels>0?'1':'0')+'" data-entry-blocked="'+(entryBlocked?'1':'0')+'">';
    // Header
    html+='<div class="sc-header">';
    html+='<span class="sc-tier '+s.tier+'">'+s.tier+'</span>';
    html+='<span class="sc-name">'+s.name+'</span>';
    // Entry badge: only show if active and has requirement
    if(entryActive && (entryMin > 0 || entryMidReq > 0)){
      var satisfied = !entryBlocked;
      var badgeCls = satisfied ? 'sc-entry satisfied' : 'sc-entry';
      var badgeText = '';
      if(entryMin > 0) badgeText += '🔒 Lv ' + entryMin;
      if(entryMidReq > 0) badgeText += (badgeText?' · ':'') + '+' + entryMidReq + ' MID';
      var tipText = satisfied ? ('Entry requirement met (Lv '+myLevel+')') : ('Requires Lv '+entryMin+' — you are Lv '+myLevel);
      html+='<span class="'+badgeCls+'" title="'+tipText+'">'+badgeText+'</span>';
    } else if(!entryActive && (entryMin > 0 || entryMidReq > 0)){
      // Requirement exists but globally disabled — show greyed
      html+='<span class="sc-entry inactive" title="Entry check disabled globally">🔓 Lv '+entryMin+'</span>';
    }
    html+='<span class="sc-mining">'+s.miningBonus+'x</span>';
    html+='<span class="sc-go" onclick="focusSector('+s.id+')">'+t('sector_go')+'</span>';
    html+='</div>';
    // Activity badge (inline, below header)
    if(s.stats.activity24h>0) html+='<div class="sc-activity"><span class="sc-activity-dot"></span>'+t('sector_claims_24h').replace('{n}',s.stats.activity24h)+'</div>';
    // Occupancy bar
    html+='<div class="sc-occ-wrap">';
    html+='<div class="sc-occ-labels"><span>'+t('sector_occupied')+'</span><span>'+occPx.toLocaleString()+' / '+totPx.toLocaleString()+' ('+occ+'%)</span></div>';
    html+='<div class="sc-occ-bar"><div class="sc-occ-fill '+s.tier+'" style="width:'+Math.min(occ,100)+'%"></div></div>';
    html+='</div>';
    // Stats grid
    html+='<div class="sc-stats">';
    html+='<div class="sc-stat"><span class="sc-stat-label">'+t('sector_avg_price')+'</span><span class="sc-stat-val" style="color:var(--gn)">$'+s.stats.avgPrice.toFixed(4)+'</span></div>';
    html+='<div class="sc-stat"><span class="sc-stat-label">'+t('sector_cur_price')+'</span><span class="sc-stat-val" style="color:var(--gn)">$'+s.currentPrice.toFixed(4)+'</span></div>';
    html+='<div class="sc-stat"><span class="sc-stat-label">'+t('sector_owners')+'</span><span class="sc-stat-val">'+s.stats.uniqueOwners+'</span></div>';
    html+='</div>';
    // Top holder / Governor / Tax — prefer nickname, fall back to short wallet
    if(s.topHolder){
      var thName = s.topHolder.nickname || s.topHolder.wallet;
      var govName = '';
      if(s.governor){
        govName = s.governor.nickname || s.governor.wallet;
      }
      html+='<div class="sc-stats" style="margin-top:2px">';
      html+='<div class="sc-stat" style="grid-column:span 2"><span class="sc-stat-label">'+t('sector_top_holder')+(govName?' / '+t('sector_gov'):'')+'</span><span class="sc-stat-val" style="font-size:10px;color:var(--gold)" title="'+(s.topHolder.fullWallet||'')+'">👑 '+thName+' ('+s.topHolder.pixels+'px)</span></div>';
      html+='<div class="sc-stat"><span class="sc-stat-label">'+t('sector_tax')+'</span><span class="sc-stat-val" style="color:var(--cyan)">'+(s.taxRate||2)+'%</span></div>';
      if(govName && (!s.topHolder.fullWallet || (s.governor.fullWallet||'').toLowerCase()!==(s.topHolder.fullWallet||'').toLowerCase())){
        html+='<div class="sc-stat" style="grid-column:span 2"><span class="sc-stat-label">'+t('sector_gov')+'</span><span class="sc-stat-val" style="font-size:10px;color:var(--cyan)" title="'+(s.governor.fullWallet||'')+'">🏛️ '+govName+'</span></div>';
      }
      if(s.viceGovernor) html+='<div class="sc-stat"><span class="sc-stat-label">'+t('sector_vice_gov')+'</span><span class="sc-stat-val" style="font-size:10px">'+(s.viceGovernor.nickname||s.viceGovernor.wallet||s.viceGovernor)+'</span></div>';
      html+='</div>';
    }
    // Active buffs
    if(s.activeBuffs&&s.activeBuffs.length>0){
      var buffIcons={mining_boost:'⛏️+20%',defense_bonus:'🛡️+10%',claim_discount:'💰-10%'};
      html+='<div style="display:flex;gap:4px;margin-top:4px;flex-wrap:wrap">';
      s.activeBuffs.forEach(function(b){ html+='<span style="font-size:9px;padding:2px 6px;background:rgba(91,184,232,.1);border:1px solid rgba(91,184,232,.2);border-radius:4px;color:var(--cyan);font-family:var(--fn)">'+(buffIcons[b.buff_type]||b.buff_type)+'</span>'; });
      html+='</div>';
    }
    // Sector announcement from governor (visible to everyone in BASE tab) — governor 가 없으면 잔존 공지 무시
    if(s.announcement && s.governor){
      html+='<div style="font-size:9px;color:var(--gold);margin-top:4px;font-style:italic;font-family:var(--fn)">📢 "'+s.announcement+'"</div>';
    }
    // Influence pressure: battles, upgrades, harvests and land all push sector control.
    if(ctrl && ctrl.topOwners && ctrl.topOwners.length){
      var lead = ctrl.topOwners[0];
      var tierColor = lead.influenceTier ? (TIER_COLORS[lead.influenceTier]||'var(--tx2)') : 'var(--tx3)';
      var tierLabel = lead.influenceTier ? (TIER_LABELS[lead.influenceTier]||lead.influenceTier) : (LANG==='ko'?'영향력':LANG==='ja'?'影響力':LANG==='zh'?'影响力':'Influence');
      var bonus = LANG==='ko' ? (lead.influenceBonusKo || lead.influenceBonus || '') : (lead.influenceBonus || lead.influenceBonusKo || '');
      html+='<div style="margin-top:5px;padding:5px 6px;border:1px solid rgba(255,255,255,.08);border-radius:6px;background:rgba(0,0,0,.18)">';
      html+='<div style="display:flex;justify-content:space-between;gap:8px;align-items:center">';
      html+='<span style="font-size:8px;color:var(--tx3);font-family:var(--fn)">⚔ '+(LANG==='ko'?'섹터 영향력':LANG==='ja'?'セクター影響':LANG==='zh'?'区域影响力':'Sector Influence')+'</span>';
      html+='<span style="font-size:8px;color:'+tierColor+';font-family:var(--fn);font-weight:700">'+tierLabel+' '+lead.controlPct+'%</span>';
      html+='</div>';
      html+='<div style="display:flex;justify-content:space-between;gap:8px;margin-top:2px">';
      html+='<span style="font-size:8px;color:var(--tx2)" title="'+(lead.wallet||'')+'">'+(lead.shortWallet||'--')+(lead.battleScore>0?' · ⚔+'+lead.battleScore:'')+'</span>';
      html+='<span style="font-size:8px;color:var(--gold);text-align:right">'+bonus+'</span>';
      html+='</div></div>';
    }
    // My holdings
    if(s.myPixels>0){
      html+='<div class="sc-my"><span class="sc-my-label">'+t('sector_my_px')+'</span><span class="sc-my-val">'+s.myPixels+'</span></div>';
    }
    html+='</div>';
  });
  document.getElementById('baseSectorList').innerHTML=html;
}

// ── PLANET NEWS (Migration 106) ─────────────────────────────────────────────
var _newsPanelOpen = false;
var _newsRefreshTimer = null;

var NEWS_ICON = {
  lottery_win:       '🎰',
  battle_won:        '⚔️',
  territory_claimed: '🌍',
  market_sale:       '🛒',
  achievement:       '🏅',
  big_trade:         '💸',
  guild_event:       '⚔️',
};

function toggleNewsPanel() {
  _newsPanelOpen = !_newsPanelOpen;
  document.getElementById('newsPanelWrap').style.display = _newsPanelOpen ? '' : 'none';
  document.getElementById('newsPanelToggle').textContent = _newsPanelOpen ? '▲' : '▼';
  if (_newsPanelOpen) {
    loadNewsFeed();
    // Auto-refresh every 30s while panel is open
    if (_newsRefreshTimer) _clearActiveInterval(_newsRefreshTimer);
    _newsRefreshTimer = _setActiveInterval(loadNewsFeed, 30000);
  } else {
    if (_newsRefreshTimer) { _clearActiveInterval(_newsRefreshTimer); _newsRefreshTimer = null; }
  }
}

function loadNewsFeed() {
  var el = document.getElementById('newsFeed');
  if (!el) return;
  fetch('/api/news?limit=30')
    .then(function(r){ return r.json(); })
    .then(function(data) {
      var items = data.news || [];
      if (!items.length) {
        el.innerHTML = '<div style="text-align:center;color:var(--tx3);padding:12px;font-size:9px">No events yet — play more to generate news!</div>';
        return;
      }
      el.innerHTML = items.map(function(n) {
        var icon = NEWS_ICON[n.event_type] || '📰';
        var timeStr = timeSinceShort(new Date(n.created_at));
        var headline = n.headline || '';
        return '<div style="display:flex;justify-content:space-between;gap:6px;padding:2px 0;border-bottom:1px solid rgba(255,255,255,.04)">'
          + '<span>' + icon + ' ' + escHtml(headline) + '</span>'
          + '<span style="flex-shrink:0;color:var(--tx3);font-size:8px">' + timeStr + '</span>'
          + '</div>';
      }).join('');
    })
    .catch(function() {
      if (el) el.innerHTML = '<div style="text-align:center;color:var(--tx3);font-size:9px;padding:8px">Failed to load</div>';
    });
}

function timeSinceShort(date) {
  var secs = Math.floor((new Date() - date) / 1000);
  if (secs < 60) return secs + 's';
  if (secs < 3600) return Math.floor(secs/60) + 'm';
  if (secs < 86400) return Math.floor(secs/3600) + 'h';
  return Math.floor(secs/86400) + 'd';
}


function filterSectors(tier,el){
  document.querySelectorAll('.base-filter-btn').forEach(function(b){b.classList.remove('active');b.style.opacity='.5'});
  el.classList.add('active');el.style.opacity='1';
  var cards=document.querySelectorAll('#baseSectorList .sector-card');
  var shown=0;
  cards.forEach(function(item){
    var match=false;
    if(tier==='all') match=true;
    else if(tier==='mine') match=item.dataset.owned==='1';
    else match=item.dataset.tier===tier;
    item.style.display=match?'':'none';
    if(match) shown++;
  });
  // Empty-state hint for MY SECTORS
  var list=document.getElementById('baseSectorList');
  var hint=document.getElementById('baseSectorEmptyHint');
  if(tier==='mine' && shown===0){
    if(!hint){
      hint=document.createElement('div');
      hint.id='baseSectorEmptyHint';
      hint.style.cssText='font-size:10px;color:var(--tx3);padding:20px;text-align:center';
      hint.textContent=t('sector_empty_hint');
      list.appendChild(hint);
    } else { hint.style.display=''; }
  } else if(hint){ hint.style.display='none'; }
}

function renderRankTable(ranks){
  var userRank=(_baseUserData&&_baseUserData.user)?_baseUserData.user.rank:0;
  var html='';
  ranks.forEach(function(r){
    var isCurrent=r.level===userRank;
    var cls=isCurrent?' class="current"':'';
    html+='<tr data-level="'+r.level+'"'+cls+'>';
    html+='<td>'+r.level+'</td>';
    if(r.breakthrough){
      html+='<td><span style="color:var(--gold)">🔒 </span>'+r.name+'</td>';
    }else{
      html+='<td>'+r.name+'</td>';
    }
    html+='<td>'+r.requiredXp.toLocaleString()+'</td>';
    html+='<td style="color:var(--pp)">'+r.rewardPp+' PP</td>';
    html+='</tr>';
    // Show breakthrough condition row
    if(r.breakthrough){
      html+='<tr class="bt-row"><td colspan="4">';
      html+='<div class="bt-info">';
      html+='<span class="bt-label">'+r.breakthroughLabel+'</span>';
      html+='<span class="bt-desc">'+r.breakthroughDesc+'</span>';
      html+='</div></td></tr>';
    }
  });
  document.getElementById('baseRankTable').innerHTML=html;

  // Show next breakthrough gate
  renderNextBreakthrough(ranks, userRank);
}

function renderNextBreakthrough(ranks, userRank){
  var w=walletState.address;
  if(!w){document.getElementById('breakthroughPanel').style.display='none';return}
  fetch('/api/breakthrough/'+encodeURIComponent(w)).then(function(r){return r.json()}).then(function(d){
    var panel=document.getElementById('breakthroughPanel');
    if(!d.nextGate){panel.style.display='none';return}
    panel.style.display='block';
    document.getElementById('btGateTitle').textContent=d.nextGate.title||'BREAKTHROUGH';
    document.getElementById('btGateLevel').textContent='Lv.'+d.nextGate.level+' '+d.nextGate.name;
    var html='';
    d.progress.forEach(function(p){
      var pct=Math.min(100,Math.round((p.current/p.target)*100));
      var isDone=p.done;
      html+='<div class="bt-prog-item">';
      html+='<span style="width:90px;color:'+(isDone?'var(--gn)':'var(--tx2)')+'">'+p.label+'</span>';
      html+='<div class="bt-prog-bar"><div class="bt-prog-fill '+(isDone?'done':'pending')+'" style="width:'+pct+'%"></div></div>';
      html+='<span style="width:70px;text-align:right;color:'+(isDone?'var(--gn)':'var(--tx3)')+'">'+p.current+'/'+p.target+(isDone?' ✓':'')+'</span>';
      html+='</div>';
    });
    document.getElementById('btProgressList').innerHTML=html;
  }).catch(function(){});
}

function focusSector(sectorId){
  var s=_sectorsData.find(function(x){return x.id===sectorId});
  if(!s) return;
  closeBaseModal();
  globe.pointOfView({lat:s.centerLat,lng:s.centerLng-180,altitude:1.2},1000);
}
