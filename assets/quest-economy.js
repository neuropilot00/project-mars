// ═══ QUEST SYSTEM ═══
var _questPoolData={active:true,multiplier:1};
function _questReadFetch(wallet){
  var walletKey = (wallet || (walletState && walletState.address) || 'anon').toLowerCase();
  if (typeof _guardedJsonFetch === 'function') {
    return _guardedJsonFetch('quests-list:' + walletKey, '/api/quests', {
      minGap: 15000,
      backoffMs: 120000,
      fetchOptions: { headers: getAuthHeaders() }
    });
  }
  return fetch('/api/quests', { headers: getAuthHeaders() }).then(function(r){ return r.ok ? r.json() : null; }).catch(function(){ return null; });
}
function _questEconomyReadJson(key, url, minGap, auth) {
  var walletKey = ((walletState && walletState.address) || 'public').toLowerCase();
  if (typeof _guardedJsonFetch === 'function') {
    return _guardedJsonFetch('quest-economy:' + key + ':' + walletKey, url, {
      minGap: minGap || 10000,
      backoffMs: 120000,
      fetchOptions: auth === false ? {} : { headers: getAuthHeaders() }
    });
  }
  return fetch(url, auth === false ? {} : { headers: getAuthHeaders() }).then(function(r){ return r.ok ? r.json() : null; }).catch(function(){ return null; });
}
function loadQuests(wallet){
  var container=document.getElementById('questsList');
  var loading=document.getElementById('questsLoading');
  var claimedDiv=document.getElementById('questsClaimed');
  if(!container) return;
  var hadContent = !!container.innerHTML.trim();
  if(loading) loading.style.display='block';
  _questReadFetch(wallet)
    .then(function(data){
      if(loading) loading.style.display='none';
      if(!data){
        if(!hadContent){
          container.innerHTML='<div style="text-align:center;padding:16px;color:var(--tx3);font-size:var(--fs-xs)">'+tl('Refreshing too often. Please wait a moment.','너무 자주 새로고침했습니다. 잠시만 기다려주세요.','更新が頻繁すぎます。少々お待ちください。','刷新过于频繁，请稍候。')+'</div>';
        }
        return;
      }
      if(data.pool) _questPoolData=data.pool;
      loadCampaignStatus();
      renderQuests(data.quests||[], container);
      renderClaimedQuests(data.recentlyClaimed||[], claimedDiv);
    })
    .catch(function(){
      if(loading) loading.style.display='none';
      container.innerHTML='<div style="text-align:center;padding:16px;color:var(--tx3);font-size:var(--fs-xs)">'+t('quests_failed')+'</div>';
    });
}

function renderQuests(quests, container){
  if(quests.length===0){
    container.innerHTML='<div style="text-align:center;padding:24px;color:var(--tx3);font-size:var(--fs-xs)">'+t('quests_none_active')+'</div>';
    return;
  }
  var html='';
  // [v7.354] quest_reward_pool 폐지 — 풀 상태 경고 제거(보상은 항상 GP 전액 지급).
  var currentTier='';
  var tierNames={free:t('quests_tier_free'),activity:t('quests_tier_activity'),spending:t('quests_tier_spending')};
  quests.forEach(function(q){
    if(q.tier!==currentTier){
      currentTier=q.tier;
      html+='<div class="quest-section-title">'+tierNames[q.tier]+'</div>';
    }
    var isComplete=q.status==='completed';
    var timeLeft=getTimeLeft(q.expires_at);
    var displayReward=q.reward_gp!==undefined?q.reward_gp:(q.actual_reward!==undefined?q.actual_reward:q.reward_pp);
    html+='<div class="quest-card'+(isComplete?' completed':'')+'" data-qid="'+q.id+'">';
    html+='<div class="qc-header">';
    html+='<span class="quest-tier-label '+q.tier+'">'+q.tier.toUpperCase()+'</span>';
    html+='<span class="qc-title">'+_questTitle(q)+'</span>';
    if(displayReward>0){
      html+='<span class="qc-reward">+'+Math.round(displayReward).toLocaleString()+' GP</span>';
    }else{
      html+='<span class="qc-reward" style="color:var(--tx3)">—</span>';
    }
    html+='</div>';
    html+='<div class="qc-desc">'+_questDesc(q)+'</div>';
    html+='<div class="qc-progress">';
    html+='<div class="qc-bar"><div class="qc-fill '+q.tier+'" style="width:'+q.progress_pct+'%"></div></div>';
    html+='<span class="qc-pct">'+q.progress_pct+'%</span>';
    html+='</div>';
    if(isComplete&&displayReward>0){
      html+='<button class="qc-claim-btn" onclick="claimQuest('+q.id+')">'+t('quests_claim_prefix')+' +'+Math.round(displayReward).toLocaleString()+' GP</button>';
    }else if(isComplete){
      html+='<div style="text-align:center;padding:6px;font-size:10px;color:var(--tx3)">'+t('quests_pool_empty_unavailable')+'</div>';
    }
    html+='<div class="qc-expire">'+timeLeft+'</div>';
    html+='</div>';
  });
  container.innerHTML=html;
  // Update quest dot when any quest is claimable
  var hasClaimableQuest = quests.some(function(q){ return q.status==='completed'; });
  if(hasClaimableQuest) { setBaseTabDot('quests', true); _updateBaseBtnDot(); }
}

function renderClaimedQuests(claimed, container){
  if(!claimed||claimed.length===0){container.innerHTML='';return}
  var html='<div class="quest-section-title">'+t('quests_recently_completed')+'</div>';
  claimed.forEach(function(c){
    html+='<div class="quest-claimed-item">';
    html+='<span class="qci-check">✓</span>';
    html+='<span>'+_questTitle(c)+'</span>';
    html+='<span class="qci-reward">+'+Math.round(c.reward_gp!=null?c.reward_gp:c.reward_pp).toLocaleString()+' GP</span>';
    html+='</div>';
  });
  container.innerHTML=html;
}

function getTimeLeft(expiresAt){
  var diff=new Date(expiresAt)-Date.now();
  if(diff<=0) return t('quests_expired');
  var h=Math.floor(diff/3600000);
  var m=Math.floor((diff%3600000)/60000);
  if(h>0) return h+'h '+m+'m '+t('quests_remaining');
  return m+'m '+t('quests_remaining');
}

async function claimQuest(questId){
  try{_sfx.click()}catch(e){}
  var w=walletState.address;
  if(!w){showToast(t('quests_login_first'));return}
  var btn=document.querySelector('.quest-card[data-qid="'+questId+'"] .qc-claim-btn');
  if(btn){btn.disabled=true;btn.textContent=t('quests_claiming');}
  try{
    var headers={'Content-Type':'application/json'};
    if(emailAuth.token) headers['Authorization']='Bearer '+emailAuth.token;
    var resp=await fetch('/api/quests/'+questId+'/claim',{
      method:'POST',headers:headers,
      body:JSON.stringify({wallet:w})
    });
    var d=await resp.json();
    if(!resp.ok){showToast(d.error||t('quests_claim_failed'));try{_sfx.error()}catch(e){}return}
    showToast(t('quests_claim_success').replace('{gp}',Math.round(d.rewardGP!=null?d.rewardGP:d.rewardPP).toLocaleString()).replace('{title}',_questTitle(d)));
    try{_sfx.harvest()}catch(e){}
    loadQuests(w); // Refresh
    try{refreshEmailBalances()}catch(e){}
  }catch(e){showToast(t('quests_network_error'))}
  finally{if(btn){btn.disabled=false;btn.textContent=t('quests_claim_btn')}}
}

// Track quest progress on user actions
function trackQuestAction(action, amount){
  var w=walletState.address;
  if(!w) return;
  var headers={'Content-Type':'application/json'};
  if(emailAuth.token) headers['Authorization']='Bearer '+emailAuth.token;
  fetch('/api/quests/track',{
    method:'POST',headers:headers,
    body:JSON.stringify({wallet:w,action:action,amount:amount||1})
  }).then(function(r){return r.json()}).then(function(d){
    if(d.quests){
      var anyCompleted = false;
      d.quests.forEach(function(q){
        if(q.justCompleted){
          anyCompleted = true;
          showToast(t('quests_completed_toast').replace('{title}',_questTitle(q)));
          try{_sfx.notification()}catch(e){}
        }
      });
      if(anyCompleted){ setBaseTabDot('quests', true); _updateBaseBtnDot(); }
    }
  }).catch(function(){});
}

// ── GP Activity Log (Migration 097) ──
var _gpActivityLoaded = false;
function toggleGpActivityLog(){
  var panel=document.getElementById('gpActivityPanel');
  var toggle=document.getElementById('gpActivityToggle');
  if(panel.style.display==='none'){
    panel.style.display='';toggle.textContent='▲';
    if(!_gpActivityLoaded){loadGpActivity();}
  } else {panel.style.display='none';toggle.textContent='▼';}
}
async function loadGpActivity(){
  var w=walletState.address;
  var el=document.getElementById('gpActivityList');
  if(!w){el.innerHTML='<div style="text-align:center;color:var(--tx3);padding:12px" data-i18n="gp_activity_login">Login to view GP activity.</div>';applyI18n(el);return;}
  try{
    var d=await _questEconomyReadJson('gp-activity', '/api/gp/activity?limit=15', 15000);
    if(!d){el.innerHTML='<div style="text-align:center;color:var(--tx3);padding:8px;font-size:9px">'+tl('Please wait a moment.','잠시만 기다려주세요.','少々お待ちください。','请稍候。')+'</div>';return;}
    if(!d.entries||!d.entries.length){
      el.innerHTML='<div style="text-align:center;color:var(--tx3);padding:12px" data-i18n="gp_activity_empty">No GP activity yet.</div>';applyI18n(el);
      _gpActivityLoaded=true;return;
    }
    var SOURCE_LABEL={'daily_login':tl('Daily Login','일일 로그인','デイリーログイン','每日登录'),'mission_reward':tl('Mission','미션','ミッション','任务'),'enhance':tl('Enhancement','강화','強化','强化'),'ship_build':tl('Ship Build','함선 건조','艦船建造','舰船建造'),'ship_upgrade':tl('Ship Upgrade','함선 강화','艦船強化','舰船强化'),'battle_stake':tl('Battle Stake','전투 베팅','戦闘ベット','战斗投注'),'battle_win':tl('Battle Win','전투 승리','戦闘勝利','战斗胜利'),'marketplace_buy':tl('Market Buy','마켓 구매','マーケット購入','市场购买'),'marketplace_sell':tl('Market Sell','마켓 판매','マーケット販売','市场出售'),'marketplace_list':tl('Listing Fee','등록 수수료','出品手数料','上架手续费'),'auction_list':tl('Auction Fee','경매 수수료','オークション手数料','拍卖手续费'),'auction_bid':tl('Auction Bid','경매 입찰','オークション入札','拍卖竞价'),'auction_buy':tl('Auction Buy','경매 구매','オークション購入','拍卖购买'),'auction_sell':tl('Auction Sold','경매 판매','オークション売却','拍卖售出'),'gp_transfer_out':tl('Sent GP','GP 송금','GP送金','已转出 GP'),'gp_transfer_in':tl('Received GP','GP 수령','GP受取','已收到 GP')};
    var html='';
    d.entries.forEach(function(e){
      var plus=e.delta>0;
      var amt=(plus?'+':'')+Math.floor(e.delta)+' GP';
      var clr=plus?'var(--gn)':'var(--mars)';
      var lbl=SOURCE_LABEL[e.source]||e.source;
      var note=e.note?(' · '+e.note):'';
      var dt=new Date(e.created_at);
      var dtStr=(dt.getMonth()+1)+'/'+(dt.getDate())+' '+dt.getHours().toString().padStart(2,'0')+':'+dt.getMinutes().toString().padStart(2,'0');
      html+='<div class="stat-row" style="font-size:9px;opacity:.95"><span class="stat-label" style="color:var(--tx3);font-size:9px">'+lbl+note+'<br><span style="opacity:.6">'+dtStr+'</span></span><span class="stat-val" style="color:'+clr+';font-size:10px;font-weight:700">'+amt+'</span></div>';
    });
    el.innerHTML=html;
    _gpActivityLoaded=true;
  }catch(e){el.innerHTML='<div style="text-align:center;color:var(--mars);padding:8px;font-size:9px">'+tl('Failed to load','불러오기 실패','読み込み失敗','加载失败')+'</div>';}
}

// ── GP Transfer (Migration 102) ──
var _gpTransferLoaded = false;

function toggleSendGP(){
  var panel  = document.getElementById('sendGPPanel');
  var toggle = document.getElementById('sendGPToggle');
  if (!panel) return;
  if (panel.style.display === 'none') {
    panel.style.display = ''; toggle.textContent = '▲';
    if (!_gpTransferLoaded) loadGPTransfers();
  } else {
    panel.style.display = 'none'; toggle.textContent = '▼';
  }
}

async function loadGPTransfers() {
  var w = walletState.address;
  var el = document.getElementById('gpTransferList');
  if (!el) return;
  if (!w) { el.innerHTML = '<div style="text-align:center;color:var(--tx3);padding:8px;font-size:9px">'+tl('Connect wallet to view.','지갑을 연결하면 볼 수 있습니다.','ウォレットを接続すると表示されます。','连接钱包后查看。')+'</div>'; return; }
  try {
    var d = await _questEconomyReadJson('gp-transfers', '/api/gp/transfers', 15000);
    if (!d) { el.innerHTML = '<div style="text-align:center;color:var(--tx3);padding:8px;font-size:9px">'+tl('Please wait a moment.','잠시만 기다려주세요.','少々お待ちください。','请稍候。')+'</div>'; return; }
    var transfers = d.transfers || [];
    if (!transfers.length) {
      el.innerHTML = '<div style="text-align:center;color:var(--tx3);padding:8px;font-size:9px">' + (t('gp_transfer_empty') || 'No transfers yet.') + '</div>';
      _gpTransferLoaded = true; return;
    }
    var html = '<div style="font-size:8px;color:var(--tx3);margin-bottom:4px">' + (t('gp_transfer_history') || 'TRANSFER HISTORY') + '</div>';
    transfers.forEach(function(tr) {
      var isSent = (tr.from_wallet || '').toLowerCase() === w.toLowerCase();
      var counterNick = isSent ? (tr.to_nick || tr.to_wallet.slice(0,8)+'…') : (tr.from_nick || tr.from_wallet.slice(0,8)+'…');
      var sign = isSent ? '-' : '+';
      var clr  = isSent ? 'var(--mars)' : 'var(--gn)';
      var dir  = isSent ? '→ ' : '← ';
      var note = tr.note ? (' · <span style="opacity:.7">' + tr.note + '</span>') : '';
      var dt   = new Date(tr.created_at);
      var dtStr = (dt.getMonth()+1) + '/' + dt.getDate() + ' ' + dt.getHours().toString().padStart(2,'0') + ':' + dt.getMinutes().toString().padStart(2,'0');
      html += '<div class="stat-row" style="font-size:9px">'
        + '<span class="stat-label" style="color:var(--tx3);font-size:8px">' + dir + counterNick + note + '<br><span style="opacity:.6">' + dtStr + '</span></span>'
        + '<span class="stat-val" style="color:' + clr + ';font-size:10px;font-weight:700">' + sign + Math.floor(tr.amount) + ' GP</span>'
        + '</div>';
    });
    el.innerHTML = html;
    _gpTransferLoaded = true;
  } catch (err) {
    if (el) el.innerHTML = '<div style="color:var(--mars);font-size:9px;padding:4px">'+tl('Failed to load.','불러오기 실패','読み込み失敗','加载失败')+'</div>';
  }
}

async function sendGP() {
  var w = walletState.address;
  if (!w) { showToast(t('connect_wallet') || 'Connect wallet first', 'error'); return; }
  var recipient = (document.getElementById('sendGPRecipient').value || '').trim();
  var amount    = parseFloat(document.getElementById('sendGPAmount').value);
  var note      = (document.getElementById('sendGPNote').value || '').trim();
  if (!recipient) { showToast(t('gp_send_no_recipient') || 'Enter recipient', 'error'); return; }
  if (!amount || amount <= 0) { showToast(t('gp_send_invalid_amount') || 'Enter a valid amount', 'error'); return; }

  gameConfirm({
    title: t('gp_send_title') || '💸 SEND GP', icon: '💸',
    body: '<div style="font-size:10px;color:#5cbbff;margin-bottom:8px">→ ' + recipient + '</div>'
      + (note ? '<div style="font-size:9px;color:var(--tx3);margin-bottom:4px">"' + note + '"</div>' : ''),
    info: [{ k: t('gp_send_amount_label') || 'Amount', v: amount + ' GP' }],
    confirmText: '💸 ' + (t('gp_send_btn') || 'SEND')
  }).then(async function(ok) {
    if (!ok) return;
    try {
      var r = await fetch('/api/gp/transfer', {
        method: 'POST',
        headers: Object.assign({ 'Content-Type': 'application/json' }, getAuthHeaders()),
        body: JSON.stringify({ wallet: w, toWallet: recipient, amount: amount, note: note })
      });
      var d = await r.json();
      if (d.error) { showToast(d.error, 'error'); return; }
      showToast('💸 ' + amount + ' GP → ' + (d.toNick || recipient));
      // Clear form
      document.getElementById('sendGPRecipient').value = '';
      document.getElementById('sendGPAmount').value = '';
      document.getElementById('sendGPNote').value = '';
      refreshBalance();
      _gpTransferLoaded = false;
      loadGPTransfers();
    } catch (err) {
      showToast(tl('Transfer failed','송금 실패','送金失敗','转账失败'), 'error');
    }
  });
}

// ── LOTTERY (Migration 105) ─────────────────────────────────────────────────
var _lotteryPanelOpen = true; // [v7.318] 기본 펼침 — 자동 운영 컨텐츠 노출
var _lotteryCountdownTimer = null;

function toggleLottery() {
  _lotteryPanelOpen = !_lotteryPanelOpen;
  document.getElementById('lotteryPanel').style.display = _lotteryPanelOpen ? '' : 'none';
  document.getElementById('lotteryToggle').textContent = _lotteryPanelOpen ? '▲' : '▼';
  if (_lotteryPanelOpen) loadLottery();
}

function loadLottery() {
  var el = document.getElementById('lotteryContent');
  if (!el) return;
  el.innerHTML = '<div style="text-align:center;color:var(--tx3);font-size:10px;padding:12px">'+tl('Loading...','불러오는 중...','読み込み中...','加载中...')+'</div>';
  var wallet = walletState.address || '';

  _questEconomyReadJson('lottery-current', '/api/lottery/current', 10000)
    .then(function(data) {
      if (!data) {
        el.innerHTML = '<div style="text-align:center;color:var(--tx3);font-size:10px;padding:12px">'+tl('Please wait a moment.','잠시만 기다려주세요.','少々お待ちください。','请稍候。')+'</div>';
        return;
      }
      var round = data.round;
      if (!round) {
        el.innerHTML = '<div style="text-align:center;color:var(--tx3);font-size:10px;padding:12px" data-i18n="lottery_disabled">Lottery is currently disabled</div>';
        return;
      }
      renderLotteryPanel(round);
    })
    .catch(function() {
      el.innerHTML = '<div style="text-align:center;color:var(--mars);font-size:10px;padding:8px">'+tl('Failed to load','불러오기 실패','読み込み失敗','加载失败')+'</div>';
    });
}

function renderLotteryPanel(round) {
  var el = document.getElementById('lotteryContent');
  if (!el) return;

  // Clear existing timer
  if (_lotteryCountdownTimer) { _clearActiveInterval(_lotteryCountdownTimer); _lotteryCountdownTimer = null; }

  var endsAt = new Date(round.ends_at);
  var prize = parseFloat(round.prize_pool_gp) || 0;
  var userTickets = parseInt(round.user_tickets) || 0;
  var maxTickets = parseInt(round.max_per_user) || 50;
  var ticketPrice = parseFloat(round.ticket_price || round.ticket_price_gp) || 10;

  var html = '<div style="background:linear-gradient(135deg,rgba(255,209,102,.08),rgba(160,100,220,.06));border:1px solid rgba(255,209,102,.2);border-radius:8px;padding:10px;margin-bottom:8px">'
    + '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">'
    + '<div><div style="font-size:8px;color:var(--tx3);text-transform:uppercase;letter-spacing:1px" data-i18n="lottery_round">Round #' + round.round_number + '</div>'
    + '<div style="font-size:20px;font-weight:900;color:var(--gold);font-family:var(--fn)">' + Math.round(prize) + '<span style="font-size:10px;margin-left:2px">GP</span></div>'
    + '<div style="font-size:8px;color:var(--tx3)">' + round.ticket_count + ' ' + tl('tickets sold','티켓 판매','枚販売','张已售')+'</div></div>'
    + '<div style="text-align:right"><div style="font-size:8px;color:var(--tx3)" data-i18n="lottery_ends">Ends in</div>'
    + '<div id="lotteryCountdown" style="font-size:11px;color:var(--cyan);font-family:var(--fn);font-weight:700">...</div>'
    + '<div style="font-size:8px;color:var(--tx3)">' + ticketPrice + ' ' + tl('GP / ticket','GP / 티켓','GP / 枚','GP / 张')+'</div></div></div>'
    + '<div style="display:flex;gap:6px;align-items:center">'
    + '<button onclick="quickBuyTickets(1)" style="flex:1;font-size:10px;padding:7px 0;background:linear-gradient(135deg,rgba(255,209,102,.2),rgba(160,100,220,.15));border:1px solid rgba(255,209,102,.3);color:var(--gold);border-radius:6px;cursor:pointer;font-weight:700">+1</button>'
    + '<button onclick="quickBuyTickets(5)" style="flex:1;font-size:10px;padding:7px 0;background:linear-gradient(135deg,rgba(255,209,102,.2),rgba(160,100,220,.15));border:1px solid rgba(255,209,102,.3);color:var(--gold);border-radius:6px;cursor:pointer;font-weight:700">+5</button>'
    + '<button onclick="quickBuyTickets(10)" style="flex:1;font-size:10px;padding:7px 0;background:linear-gradient(135deg,rgba(255,209,102,.2),rgba(160,100,220,.15));border:1px solid rgba(255,209,102,.3);color:var(--gold);border-radius:6px;cursor:pointer;font-weight:700">+10</button>'
    + '<div style="text-align:center;font-size:8px;color:var(--tx3);padding:0 4px">' + tl('My','내 티켓','マイ枚数','我的') + '<br><span style="font-size:11px;color:var(--gold);font-weight:700">' + userTickets + '</span></div>'
    + '</div></div>';

  // Recent winners
  var winners = round.recent_winners || [];
  if (winners.length) {
    html += '<div style="font-size:9px;color:var(--gold);font-weight:700;margin-bottom:4px" data-i18n="lottery_recent_winners">RECENT WINNERS</div>';
    html += '<div style="font-size:9px;color:var(--tx2);line-height:1.8">';
    winners.forEach(function(w) {
      var nick = w.winner_nick || (w.winner_wallet||'').slice(0,8)+'...';
      html += '<div style="display:flex;justify-content:space-between"><span>🏆 ' + nick + '</span><span style="color:var(--gold)">+' + Math.round(parseFloat(w.prize_pool_gp)) + ' GP</span></div>';
    });
    html += '</div>';
  }

  // 지난 회차 / 내 티켓 — 접힘 섹션
  html += '<div style="margin-top:8px;border-top:1px solid rgba(255,255,255,0.08);padding-top:6px">'
    + '<div onclick="toggleLotteryHistory()" style="display:flex;justify-content:space-between;align-items:center;cursor:pointer;font-size:9px;color:var(--gold);font-weight:700;letter-spacing:0.5px">'
    + '<span>' + tl('PAST ROUNDS / MY TICKETS','지난 회차 / 내 티켓','過去のラウンド / マイチケット','往期 / 我的彩票') + '</span>'
    + '<span id="lotteryHistoryToggle">▼</span></div>'
    + '<div id="lotteryHistoryContent" style="display:none;margin-top:6px"></div>'
    + '</div>';

  el.innerHTML = html;

  // Countdown timer
  function updateCountdown() {
    var rem = Math.max(0, endsAt - new Date());
    var h = Math.floor(rem / 3600000);
    var m = Math.floor((rem % 3600000) / 60000);
    var s = Math.floor((rem % 60000) / 1000);
    var cdEl = document.getElementById('lotteryCountdown');
    if (cdEl) cdEl.textContent = (h > 0 ? h + 'h ' : '') + m + 'm ' + s + 's';
    if (rem <= 0) {
      _clearActiveInterval(_lotteryCountdownTimer);
      _lotteryCountdownTimer = null;
      // Auto-reload after draw
      _setActiveTimeout(loadLottery, 5000);
    }
  }
  updateCountdown();
  _lotteryCountdownTimer = _setActiveInterval(updateCountdown, 1000);
}

function quickBuyTickets(count) {
  if (!walletState.address) return showToast(tl('Connect wallet first','지갑을 먼저 연결하세요','先にウォレットを接続してください','请先连接钱包'), 'error');
  var btn = event.target;
  btn.disabled = true;

  fetch('/api/lottery/buy', {
    method: 'POST',
    headers: Object.assign({'Content-Type':'application/json'},getAuthHeaders()),
    body: JSON.stringify({ wallet: walletState.address, count: count })
  })
    .then(function(r){ return r.json(); })
    .then(function(d) {
      btn.disabled = false;
      if (d.error) return showToast(d.error, 'error');
      showToast(tl('+' + count + ' ticket(s)! Spent ' + d.totalCost + ' GP 🎰','+' + count + '장 구매! ' + d.totalCost + ' GP 사용 🎰','チケット+' + count + '枚！' + d.totalCost + ' GP 消費 🎰','+' + count + '张！消费 ' + d.totalCost + ' GP 🎰'), 'success');
      loadLottery();
      loadWalletData(); // refresh GP balance
    })
    .catch(function(e) {
      btn.disabled = false;
      showToast(tl('Error: ','오류: ','エラー: ','错误: ') + e.message, 'error');
    });
}

var _lotteryHistoryOpen = false;
function toggleLotteryHistory() {
  _lotteryHistoryOpen = !_lotteryHistoryOpen;
  var c = document.getElementById('lotteryHistoryContent');
  var tg = document.getElementById('lotteryHistoryToggle');
  if (!c) return;
  c.style.display = _lotteryHistoryOpen ? '' : 'none';
  if (tg) tg.textContent = _lotteryHistoryOpen ? '▲' : '▼';
  if (_lotteryHistoryOpen) loadLotteryHistory();
}

function loadLotteryHistory() {
  var c = document.getElementById('lotteryHistoryContent');
  if (!c) return;
  c.innerHTML = '<div style="text-align:center;color:var(--tx3);font-size:9px;padding:8px">'+tl('Loading...','불러오는 중...','読み込み中...','加载中...')+'</div>';
  var wallet = walletState.address || '';
  var reqs = [_questEconomyReadJson('lottery-history', '/api/lottery/history?limit=10', 15000, false).then(function(d){ return d || { history: [] }; })];
  reqs.push(wallet
    ? _questEconomyReadJson('lottery-my-tickets', '/api/lottery/my-tickets', 15000).then(function(d){ return d || { tickets: [] }; })
    : Promise.resolve({ tickets: [] }));
  Promise.all(reqs).then(function(res) {
    var history = (res[0] && res[0].history) || [];
    var tickets = (res[1] && res[1].tickets) || [];
    var html = '';

    // 내 티켓
    html += '<div style="font-size:9px;color:var(--cyan);font-weight:700;margin-bottom:4px">' + tl('MY TICKETS','내 티켓','マイチケット','我的彩票') + '</div>';
    if (!wallet) {
      html += '<div style="font-size:9px;color:var(--tx3);padding:2px 0 6px">' + tl('Connect wallet to view','지갑 연결 필요','ウォレット接続が必要','请连接钱包') + '</div>';
    } else if (!tickets.length) {
      html += '<div style="font-size:9px;color:var(--tx3);padding:2px 0 6px">' + tl('No tickets yet','보유 티켓 없음','チケットなし','暂无彩票') + '</div>';
    } else {
      html += '<div style="font-size:9px;color:var(--tx2);line-height:1.7;margin-bottom:6px">';
      tickets.forEach(function(tk) {
        var rn = tk.round_number != null ? tk.round_number : '?';
        var stat = tk.round_status || '';
        var won = stat === 'completed' && wallet && tk.winner_wallet && tk.winner_wallet.toLowerCase() === wallet.toLowerCase();
        var tag = won ? '<span style="color:var(--gold)">🏆 ' + tl('WON','당첨','当選','中奖') + '</span>'
          : (stat === 'open' ? '<span style="color:var(--cyan)">' + tl('OPEN','진행중','進行中','进行中') + '</span>'
          : '<span style="color:var(--tx3)">' + (stat === 'cancelled' ? tl('CANCELLED','취소','キャンセル','已取消') : tl('CLOSED','종료','終了','已结束')) + '</span>');
        html += '<div style="display:flex;justify-content:space-between"><span>#' + rn + '</span>' + tag + '</div>';
      });
      html += '</div>';
    }

    // 지난 회차
    html += '<div style="font-size:9px;color:var(--gold);font-weight:700;margin-bottom:4px">' + tl('PAST ROUNDS','지난 회차','過去のラウンド','往期') + '</div>';
    if (!history.length) {
      html += '<div style="font-size:9px;color:var(--tx3);padding:2px 0">' + tl('No past rounds','지난 회차 없음','過去のラウンドなし','暂无往期') + '</div>';
    } else {
      html += '<div style="font-size:9px;color:var(--tx2);line-height:1.7">';
      history.forEach(function(h) {
        var rn = h.round_number != null ? h.round_number : '?';
        var prize = Math.round(parseFloat(h.prize_pool_gp) || 0);
        var nick = h.winner_nick || (h.winner_wallet ? (h.winner_wallet.slice(0,6) + '...') : (h.status === 'cancelled' ? tl('cancelled','취소됨','キャンセル','已取消') : '—'));
        html += '<div style="display:flex;justify-content:space-between"><span>#' + rn + ' · ' + nick + '</span><span style="color:var(--gold)">' + prize + ' GP</span></div>';
      });
      html += '</div>';
    }

    c.innerHTML = html;
  }).catch(function() {
    c.innerHTML = '<div style="text-align:center;color:var(--mars);font-size:9px;padding:8px">'+tl('Failed to load','불러오기 실패','読み込み失敗','加载失败')+'</div>';
  });
}


// ── GP STAKING (Migration 107) ──────────────────────────────────────────────
var _stakingPanelOpen = false;
var _stakingInfo = null;

function toggleStaking() {
  _stakingPanelOpen = !_stakingPanelOpen;
  document.getElementById('stakingPanel').style.display = _stakingPanelOpen ? '' : 'none';
  document.getElementById('stakingToggle').textContent = _stakingPanelOpen ? '▲' : '▼';
  if (_stakingPanelOpen) loadStakingPanel();
}

function loadStakingPanel() {
  var el = document.getElementById('stakingContent');
  if (!el) return;
  el.innerHTML = '<div style="text-align:center;color:var(--tx3);font-size:10px;padding:12px">'+tl('Loading...','불러오는 중...','読み込み中...','加载中...')+'</div>';
  var wallet = walletState.address || '';

  Promise.all([
    _questEconomyReadJson('staking-info', '/api/staking/info', 15000),
    wallet ? _questEconomyReadJson('staking-my-stakes', '/api/staking/my-stakes', 15000) : Promise.resolve({ stakes: [] }),
    _questEconomyReadJson('dividends-info', '/api/dividends/info', 15000).catch(function(){ return null; })
  ])
    .then(function(results) {
      _stakingInfo = results[0];
      if (!_stakingInfo) {
        el.innerHTML = '<div style="text-align:center;color:var(--tx3);font-size:10px;padding:12px">'+tl('Please wait a moment.','잠시만 기다려주세요.','少々お待ちください。','请稍候。')+'</div>';
        return;
      }
      var stakes = (results[1] && results[1].stakes) || [];
      var divInfo = results[2];
      if (!_stakingInfo.enabled) {
        el.innerHTML = '<div style="text-align:center;color:var(--tx3);font-size:10px;padding:12px">'+tl('Staking currently disabled','스테이킹이 현재 비활성화됨','ステーキングは現在無効です','质押当前已禁用')+'</div>';
        return;
      }
      renderStakingPanel(_stakingInfo, stakes, divInfo);
    })
    .catch(function() {
      el.innerHTML = '<div style="text-align:center;color:var(--mars);font-size:10px;padding:8px">'+tl('Failed to load','불러오기 실패','読み込み失敗','加载失败')+'</div>';
    });
}

function renderStakingPanel(info, stakes, divInfo) {
  var el = document.getElementById('stakingContent');
  if (!el) return;

  var opts = info.lock_days_options || [7, 14, 30];
  var bonuses = info.bonus_multipliers || {};
  var yields = info.yield_per_1000 || {};
  var apy = info.apy_pct || 15;

  // Build lock options
  var optsHtml = opts.map(function(d) {
    var mult = bonuses[d] || 1;
    var yld  = (yields[d] || 0).toFixed(2);
    var label = d === 30 ? '🔥' : d === 14 ? '⭐' : '';
    return '<div onclick="selectLockDays(this,' + d + ')" data-days="' + d + '" class="stake-day-opt" style="flex:1;text-align:center;padding:8px 4px;border-radius:6px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1);cursor:pointer;transition:all .2s">'
      + '<div style="font-size:11px;color:var(--gold);font-weight:700">' + label + d + 'd</div>'
      + '<div style="font-size:8px;color:var(--tx3)">×' + mult.toFixed(1) + '</div>'
      + '<div style="font-size:8px;color:var(--gn)">+' + yld + '/1k</div>'
      + '</div>';
  }).join('');

  var html = '<div style="background:linear-gradient(135deg,rgba(91,184,232,.08),rgba(76,216,154,.05));border:1px solid rgba(91,184,232,.2);border-radius:8px;padding:10px;margin-bottom:8px">'
    + '<div style="font-size:8px;color:var(--tx3);margin-bottom:6px;letter-spacing:1px">'+tl('APY','APY','APY','年化')+': <span style="color:var(--gn);font-weight:700">' + apy + '%</span> &nbsp;|&nbsp; '+tl('Active','진행 중','アクティブ','活跃')+': <span style="color:var(--cyan)">' + (info.active_stakes || 0) + '/' + (info.max_active || 5) + '</span></div>'
    + '<div style="display:flex;gap:4px;margin-bottom:10px">' + optsHtml + '</div>'
    + '<div style="display:flex;gap:6px;align-items:center;margin-bottom:6px">'
    + '<input type="number" id="stakeAmountInput" min="' + (info.min_amount||100) + '" max="' + (info.max_amount||10000) + '" placeholder="' + (info.min_amount||100) + '–' + (info.max_amount||10000) + ' GP" style="flex:1;background:var(--surface1);border:1px solid var(--bdr);color:var(--tx);font-size:11px;padding:8px 10px;border-radius:6px;font-family:var(--fn)">'
    + '<div id="stakeYieldPreview" style="font-size:10px;color:var(--gn);min-width:60px;text-align:center"></div>'
    + '</div>'
    + '<button onclick="doStake()" style="width:100%;padding:10px;border-radius:6px;background:linear-gradient(135deg,rgba(91,184,232,.25),rgba(76,216,154,.2));border:1px solid rgba(91,184,232,.35);color:#fff;font-family:var(--fn);font-size:11px;font-weight:700;cursor:pointer;letter-spacing:1px" data-i18n="staking_stake_btn">💎 STAKE GP</button>'
    + '</div>';

  // Active stakes list
  var activeStakes = stakes.filter(function(s){ return s.status === 'active' || s.status === 'ready'; });
  var pastStakes   = stakes.filter(function(s){ return s.status === 'withdrawn'; }).slice(0, 3);

  if (activeStakes.length) {
    html += '<div style="font-size:9px;color:var(--gold);font-weight:700;margin-bottom:4px;letter-spacing:1px">'+tl('ACTIVE STAKES','진행 중인 스테이킹','アクティブなステーキング','活跃质押')+'</div>';
    activeStakes.forEach(function(s) {
      var isReady = s.status === 'ready';
      var secsRem = parseFloat(s.seconds_remaining) || 0;
      var timeStr;
      if (isReady || secsRem <= 0) {
        timeStr = '<span style="color:var(--gn);font-weight:700">✅ '+tl('READY','준비됨','準備完了','可领取')+'</span>';
      } else {
        var h = Math.floor(secsRem / 3600);
        var d2 = Math.floor(secsRem / 86400);
        timeStr = d2 > 0 ? d2 + 'd ' + (h % 24) + 'h' : h + 'h ' + Math.floor((secsRem % 3600)/60) + 'm';
      }
      html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:8px;background:rgba(255,255,255,.03);border-radius:6px;margin-bottom:4px;border:1px solid rgba(255,255,255,.07)">'
        + '<div><div style="font-size:11px;color:var(--tx);font-weight:700">' + Math.round(s.amount) + ' GP <span style="font-size:9px;color:var(--tx3)">'+tl('locked','잠금','ロック','锁定')+' ' + s.lock_days + 'd</span></div>'
        + '<div style="font-size:9px;color:var(--gn)">+' + s.yield_earned.toFixed(2) + ' GP '+tl('yield','수익','利息','收益')+'</div></div>'
        + '<div style="text-align:right">'
        + (isReady ? '<button onclick="doWithdraw(' + s.id + ')" style="font-size:9px;padding:5px 10px;background:rgba(76,216,154,.2);border:1px solid rgba(76,216,154,.35);color:var(--gn);border-radius:5px;cursor:pointer;font-weight:700">'+tl('WITHDRAW','출금','引き出す','取出')+'</button>' : '<div style="font-size:9px">' + timeStr + '</div>')
        + '</div></div>';
    });
  }

  if (pastStakes.length) {
    html += '<div style="font-size:9px;color:var(--tx3);margin-top:6px;margin-bottom:4px;letter-spacing:1px">'+tl('RECENT WITHDRAWALS','최근 출금','最近の引き出し','近期取出')+'</div>';
    pastStakes.forEach(function(s) {
      html += '<div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid rgba(255,255,255,.05);font-size:9px;color:var(--tx3)">'
        + '<span>' + Math.round(s.amount) + ' GP × ' + s.lock_days + 'd</span>'
        + '<span style="color:var(--gn)">+' + s.yield_earned.toFixed(2) + ' GP</span>'
        + '</div>';
    });
  }

  // Dividend info
  if (divInfo && divInfo.enabled) {
    var pool = parseFloat(divInfo.current_pool || 0);
    html += '<div style="margin-top:8px;padding:8px;background:rgba(160,100,220,.06);border-radius:6px;border:1px solid rgba(160,100,220,.2)">'
      + '<div style="font-size:9px;color:#a064dc;font-weight:700;margin-bottom:4px;letter-spacing:1px">💰 '+tl('WEEKLY DIVIDENDS','주간 배당','週間配当','每周分红')+'</div>'
      + '<div style="font-size:9px;color:var(--tx3)">'+tl('This week\'s pool','이번 주 풀','今週のプール','本周奖池')+': <span style="color:var(--gold);font-weight:700">' + Math.round(pool) + ' GP</span> · '+tl('Distributed every Monday to active stakers','매주 월요일 활성 스테이커에게 분배','毎週月曜日にアクティブなステーカーへ分配','每周一分配给活跃质押者')+'</div>';
    if (divInfo.my_history && divInfo.my_history.length) {
      var lastDiv = divInfo.my_history[0];
      html += '<div style="font-size:9px;color:var(--gn);margin-top:2px">'+tl('Last dividend','최근 배당','直近の配当','最近分红')+': +' + parseFloat(lastDiv.dividend_gp).toFixed(2) + ' GP ('+tl('week','주','週','周')+' ' + lastDiv.week_start + ')</div>';
    }
    html += '</div>';
  }

  el.innerHTML = html;

  // Default select first lock option
  var firstOpt = el.querySelector('.stake-day-opt');
  if (firstOpt) selectLockDays(firstOpt, opts[0]);

  // Live yield preview
  var amtInput = document.getElementById('stakeAmountInput');
  if (amtInput) amtInput.addEventListener('input', updateStakePreview);
}

var _selectedLockDays = 7;

function selectLockDays(el, days) {
  _selectedLockDays = days;
  document.querySelectorAll('.stake-day-opt').forEach(function(b) {
    b.style.background = 'rgba(255,255,255,.04)';
    b.style.borderColor = 'rgba(255,255,255,.1)';
  });
  el.style.background = 'rgba(91,184,232,.15)';
  el.style.borderColor = 'rgba(91,184,232,.4)';
  updateStakePreview();
}

function updateStakePreview() {
  var amtEl = document.getElementById('stakeAmountInput');
  var previewEl = document.getElementById('stakeYieldPreview');
  if (!amtEl || !previewEl || !_stakingInfo) return;
  var amt = parseFloat(amtEl.value) || 0;
  if (amt <= 0) { previewEl.textContent = ''; return; }
  var info = _stakingInfo;
  var apy = info.apy_pct || 15;
  var mult = (info.bonus_multipliers || {})[_selectedLockDays] || 1;
  var yld = +(amt * (apy / 100) * (_selectedLockDays / 365) * mult).toFixed(2);
  previewEl.textContent = '+' + yld + ' GP';
}

async function doStake() {
  if (!walletState.address) return showToast(tl('Connect wallet first','지갑을 먼저 연결하세요','先にウォレットを接続してください','请先连接钱包'), 'error');
  var amt = parseFloat(document.getElementById('stakeAmountInput')?.value);
  if (!amt || amt <= 0) return showToast(tl('Enter an amount','금액을 입력하세요','金額を入力してください','请输入金额'), 'error');
  var info = _stakingInfo || {};
  if (amt < (info.min_amount || 100)) return showToast(tl('Minimum ','최소 ','最低 ','最低 ') + (info.min_amount||100) + ' GP', 'error');
  if (amt > (info.max_amount || 10000)) return showToast(tl('Maximum ' + (info.max_amount||10000) + ' GP per stake','스테이킹당 최대 ' + (info.max_amount||10000) + ' GP','1回のステーキングで最大 ' + (info.max_amount||10000) + ' GP','每次质押最多 ' + (info.max_amount||10000) + ' GP'), 'error');

  var yld = document.getElementById('stakeYieldPreview')?.textContent || '';
  var ok = await gameConfirm({
    icon: '💎',
    title: (window.i18n?.staking_confirm_title) || 'STAKE GP',
    body: tl('Lock <b>' + Math.round(amt) + ' GP</b> for <b>' + _selectedLockDays + ' days</b>','<b>' + Math.round(amt) + ' GP</b>를 <b>' + _selectedLockDays + '일</b> 동안 잠금','<b>' + Math.round(amt) + ' GP</b>を<b>' + _selectedLockDays + '日間</b>ロック','锁定 <b>' + Math.round(amt) + ' GP</b> 共 <b>' + _selectedLockDays + ' 天</b>') + '<br>' + tl('Expected yield','예상 수익','予想利息','预计收益') + ': <b style="color:var(--gn)">' + yld + '</b>',
    confirmText: (window.i18n?.staking_confirm_btn) || 'STAKE',
  });
  if (!ok) return;
  try {
    var r = await fetch('/api/staking/stake', {
      method: 'POST',
      headers: Object.assign({'Content-Type':'application/json'}, getAuthHeaders()),
      body: JSON.stringify({ wallet: walletState.address, amount: amt, lockDays: _selectedLockDays })
    });
    var d = await r.json();
    if (d.error) return showToast(d.error, 'error');
    showToast(tl('💎 Staked ' + Math.round(amt) + ' GP for ' + _selectedLockDays + 'd!','💎 ' + Math.round(amt) + ' GP를 ' + _selectedLockDays + '일 스테이킹했습니다!','💎 ' + Math.round(amt) + ' GP を ' + _selectedLockDays + '日間ステーキングしました！','💎 已质押 ' + Math.round(amt) + ' GP 共 ' + _selectedLockDays + ' 天！'), 'success');
    loadStakingPanel();
    loadWalletData();
  } catch(e) { showToast(tl('Stake failed','스테이킹 실패','ステーキング失敗','质押失败'), 'error'); }
}

async function doWithdraw(stakeId) {
  if (!walletState.address) return showToast(tl('Connect wallet first','지갑을 먼저 연결하세요','先にウォレットを接続してください','请先连接钱包'), 'error');
  var ok = await gameConfirm({
    icon: '✅',
    title: (window.i18n?.staking_withdraw_title) || 'WITHDRAW STAKE',
    body: tl('Withdraw your matured stake and collect principal + yield?','만기된 스테이킹을 출금하고 원금 + 수익을 받으시겠습니까?','満期のステーキングを引き出し、元本＋利息を受け取りますか？','取出已到期的质押并领取本金 + 收益？'),
    confirmText: (window.i18n?.staking_withdraw_btn) || 'WITHDRAW',
  });
  if (!ok) return;
  try {
    var r = await fetch('/api/staking/withdraw', {
      method: 'POST',
      headers: Object.assign({'Content-Type':'application/json'}, getAuthHeaders()),
      body: JSON.stringify({ wallet: walletState.address, stakeId: stakeId })
    });
    var d = await r.json();
    if (d.error) return showToast(d.error, 'error');
    showToast(tl('✅ Received ','✅ ','✅ ','✅ 已收到 ') + d.totalReturn.toFixed(2) + tl(' GP!',' GP 수령!',' GP 受取！',' GP！'), 'success');
    loadStakingPanel();
    loadWalletData();
  } catch(e) { showToast(tl('Withdrawal failed','출금 실패','引き出し失敗','取出失败'), 'error'); }
}

// ── GP BURN (Migration 108) ──────────────────────────────────────────────────
var _burnPanelOpen = false;

function toggleBurn() {
  _burnPanelOpen = !_burnPanelOpen;
  document.getElementById('burnPanel').style.display = _burnPanelOpen ? '' : 'none';
  document.getElementById('burnToggle').textContent = _burnPanelOpen ? '▲' : '▼';
  if (_burnPanelOpen) loadBurnPanel();
}

function loadBurnPanel() {
  // GP Burn is deprecated (service removed). No-op.
  return;
}

function renderBurnPanel(types) {
  var el = document.getElementById('burnContent');
  if (!el) return;

  var html = '<div style="font-size:9px;color:var(--tx3);margin-bottom:8px;padding:0 2px">Permanently burn GP to activate exclusive time-limited buffs.</div>';

  types.forEach(function(t) {
    var isActive = t.active;
    var secsRem = t.seconds_remaining || 0;
    var timeStr = '';
    if (isActive && secsRem > 0) {
      var h = Math.floor(secsRem / 3600);
      var m = Math.floor((secsRem % 3600) / 60);
      timeStr = h > 0 ? h + 'h ' + m + 'm' : m + 'm';
    }

    html += '<div style="display:flex;align-items:center;gap:8px;padding:8px;background:rgba(255,255,255,.03);border-radius:6px;margin-bottom:4px;border:1px solid rgba(255,255,255,.07)'
      + (isActive ? ';border-color:' + t.color + '40;background:rgba(255,255,255,.06)' : '') + '">'
      + '<div style="font-size:20px;min-width:28px;text-align:center">' + t.icon + '</div>'
      + '<div style="flex:1">'
      + '<div style="font-size:10px;font-weight:700;color:' + t.color + '">' + t.name + '</div>'
      + '<div style="font-size:9px;color:var(--tx3)">' + t.desc + '</div>'
      + (isActive ? '<div style="font-size:9px;color:var(--gn);margin-top:2px">✅ Active — ' + timeStr + ' left</div>' : '')
      + '</div>'
      + '<div style="text-align:right">'
      + '<button onclick="doBurnGP(\'' + t.key + '\',' + t.cost + ')" '
      + 'style="font-size:9px;padding:5px 8px;border-radius:5px;cursor:pointer;font-weight:700;white-space:nowrap;'
      + (isActive
        ? 'background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.2);color:var(--tx3)'
        : 'background:rgba(255,80,30,.2);border:1px solid rgba(255,80,30,.35);color:var(--mars)')
      + '">'
      + (isActive ? '+' + t.hours + 'h ' : '') + '🔥 ' + Math.round(t.cost) + ' GP</button>'
      + '</div>'
      + '</div>';
  });

  el.innerHTML = html;
}

function doBurnGP(burnType, cost) {
  showToast('GP Burn is currently unavailable', 'warn');
}

async function harvestMining(){
  try{_sfx.click()}catch(e){}
  var w=walletState.address;
  if(!w){showToast(t('daily_login_required')||tl('Login required','로그인이 필요합니다','ログインが必要です','请先登录'));return}
  var btn=document.getElementById('baseHarvestBtn');
  btn.disabled=true;btn.textContent=tl('HARVESTING...','수확 중...','収穫中...','收获中...');
  try{
    var headers={'Content-Type':'application/json'};
    if(emailAuth.token) headers['Authorization']='Bearer '+emailAuth.token;
    var resp=await fetch('/api/harvest',{method:'POST',headers:headers,body:JSON.stringify({wallet:w})});
    var d=await resp.json();
    if(!resp.ok){showToast(d.error||tl('Harvest failed','수확 실패','収穫失敗','收获失败'));try{_sfx.error()}catch(e){}return}
    showNotification('mining',tl('Harvest complete','수확 완료','収穫完了','收获完成'),tl('+'+d.harvestedPP.toFixed(4)+' PP collected from your territory','영토에서 +'+d.harvestedPP.toFixed(4)+' PP 수확','領土から +'+d.harvestedPP.toFixed(4)+' PP を採掘','已从你的领地收获 +'+d.harvestedPP.toFixed(4)+' PP'));
    // ✅ [Resource System] 자원 드롭 알림 (Phase 2)
    if(d.resources&&d.resources.length>0){
      var _RICONS={iron_ore:'🪨',carbon_fiber:'🖤',silicon_chip:'💎',titanium_alloy:'⚙️',plasma_crystal:'🔷',nano_polymer:'🧬',dark_matter:'🌑',quantum_core:'⚡',exotic_alloy:'🌟'};
      var _RNAMES_KO={iron_ore:'철광석',carbon_fiber:'탄소섬유',silicon_chip:'실리콘칩',titanium_alloy:'티타늄합금',plasma_crystal:'플라즈마크리스탈',nano_polymer:'나노폴리머',dark_matter:'암흑물질',quantum_core:'양자코어',exotic_alloy:'이국합금'};
      var _lang=(window.currentLang||'en').toLowerCase();
      var resMsg=d.resources.map(function(r){
        var icon=_RICONS[r.code]||'💠';
        var name=_lang==='ko'?(_RNAMES_KO[r.code]||r.code):r.code.replace(/_/g,' ');
        return icon+' +'+r.quantity+' '+name;
      }).join('  ');
      showToast('⛏ '+resMsg,'success');
      // (도파민 v7.387) 희귀 드롭 잭팟 연출 — 드롭률/수량은 그대로, 레어/에픽/전설만 시각 강조.
      var _maxTier=0, _topCode='';
      d.resources.forEach(function(r){ var tt=_resourceTier(r.code); if(tt>_maxTier){_maxTier=tt;_topCode=r.code;} });
      if(_maxTier>=2){
        var _tn=_lang==='ko'?(_RNAMES_KO[_topCode]||_topCode):_topCode.replace(/_/g,' ');
        var _msg=_maxTier>=3 ? (tl('MOTHERLODE!','대박 광맥!','大当たり鉱脈!','大矿脉!')+' '+(_RICONS[_topCode]||'🌟')+' '+_tn)
                             : ((_RICONS[_topCode]||'🔷')+' '+_tn+' '+tl('rare!','희귀!','レア!','稀有!'));
        rewardBurst({ text:_msg, tier:_maxTier, sound: window._sfx && (_maxTier>=3 ? _sfx.levelUp : _sfx.success) });
      }
    }
    try{_sfx.harvest()}catch(e){}
    try{trackQuestAction('harvest',1)}catch(e){}
    try{markDailyOpsAction('territory_harvest',1)}catch(_e){}
    // Update UI
    document.getElementById('baseMineAvail').textContent='0.00';
    var totalEl=document.getElementById('baseMineTotalMined');
    var prev=parseFloat(totalEl.textContent)||0;
    totalEl.textContent=(prev+d.harvestedPP).toFixed(2);
    // Update timer & hide mining dot
    if(d.nextHarvestAt) startMineTimer(new Date(d.nextHarvestAt));
    var md=document.getElementById('miningDot');if(md)md.style.display='none';
    // Refresh balances
    try{refreshEmailBalances()}catch(e){}
  }catch(e){showToast(t('quests_network_error')||tl('Network error','네트워크 오류','ネットワークエラー','网络错误'))}
  finally{
    btn.disabled=false;
    var rng='';if(window._miningEstMin>0) rng=' ('+window._miningEstMin.toFixed(2)+'~'+window._miningEstMax.toFixed(2)+' PP + 🪨)';
    btn.innerHTML='<span>'+t('harvest_pp')+rng+'</span>';
  }
}

// ── Instant Harvest (skip cooldown micro-transaction) ──
async function instantHarvest(){
  try{_sfx.click()}catch(e){}
  var w=walletState.address;
  if(!w){showToast(t('daily_login_required')||tl('Login required','로그인이 필요합니다','ログインが必要です','请先登录'));return}
  var ihCost=window._instantHarvestCost||0.5;
  var ok=await shopConfirm('',tl('Skip Cooldown','쿨다운 건너뛰기','クールダウンスキップ','跳过冷却'),
    '<div style="font-size:14px;font-weight:700;color:var(--tx);margin-bottom:4px">'+tl('INSTANT HARVEST','즉시 수확','即時収穫','立即收获')+'</div>'
    +'<div style="font-size:var(--fs-sm);color:var(--tx3);margin-bottom:8px">'+tl('Skip the harvest cooldown and harvest immediately.','수확 쿨다운을 건너뛰고 즉시 수확합니다.','収穫のクールダウンをスキップしてすぐに収穫します。','跳过收获冷却并立即收获。')+'</div>'
    +'<div style="font-size:var(--fs-md);color:var(--gold)">'+ihCost+' PP</div>',tl('SKIP COOLDOWN','쿨다운 건너뛰기','クールダウンスキップ','跳过冷却'));
  if(!ok)return;
  var btn=document.getElementById('baseInstantHarvestBtn');
  btn.disabled=true;btn.textContent=tl('PROCESSING...','처리 중...','処理中...','处理中...');
  try{
    var headers={'Content-Type':'application/json'};
    if(emailAuth.token) headers['Authorization']='Bearer '+emailAuth.token;
    var resp=await fetch('/api/harvest-instant',{method:'POST',headers:headers,body:JSON.stringify({wallet:w})});
    var d=await resp.json();
    if(!resp.ok){showToast(d.error||tl('Failed','실패했습니다','失敗しました','失败了'),'error');return}
    showToast(tl('Cooldown skipped! Harvest now.','쿨다운을 건너뛰었습니다! 지금 수확하세요.','クールダウンをスキップしました！今すぐ収穫できます。','已跳过冷却！现在即可收获。'),'success');
    btn.style.display='none';
    document.getElementById('baseMineTimer').textContent=tl('Harvest available now!','지금 수확 가능!','今すぐ収穫できます！','现在可以收获！');
    if(window._mineTimerInterval) _clearActiveInterval(window._mineTimerInterval);
    try{refreshEmailBalances()}catch(e){}
  }catch(e){showToast(t('quests_network_error')||tl('Network error','네트워크 오류','ネットワークエラー','网络错误'),'error')}
  finally{btn.disabled=false;var ic=window._instantHarvestCost||0.5;btn.innerHTML='<span>'+tl('HARVEST NOW','지금 수확','今すぐ収穫','立即收获')+' ('+ic+' PP)</span>'}
}

// ── Territory Rename (micro-transaction) ──
async function renameTerritory(plot){
  if(!plot||!plot.id)return;
  var w=walletState.address;
  if(!w){showToast(t('daily_login_required')||tl('Login required','로그인이 필요합니다','ログインが必要です','请先登录'));return}
  var currentName=plot.customName||'';
  var name=await gameInput({title:LANG==='ko'?'영토 이름 변경':LANG==='ja'?'領土名変更':LANG==='zh'?'更改领土名称':'Rename Territory',label:LANG==='ko'?'이름 (최대 20자, 비용 0.3 PP)':LANG==='ja'?'名前（最大20文字、費用0.3PP）':LANG==='zh'?'名称（最多20字符，费用0.3PP）':'Name (max 20 chars, 0.3 PP)',placeholder:currentName,defaultValue:currentName,maxLength:20});
  if(name===null||name===undefined||name.trim()==='')return;
  name=name.trim().substring(0,20);
  try{
    var headers={'Content-Type':'application/json'};
    if(emailAuth.token) headers['Authorization']='Bearer '+emailAuth.token;
    var resp=await fetch('/api/claims/'+plot.id+'/rename',{method:'POST',headers:headers,body:JSON.stringify({wallet:w,name:name})});
    var d=await resp.json();
    if(!resp.ok){showToast(d.error||tl('Rename failed','이름 변경 실패','名前変更失敗','重命名失败'),'error');return}
    showToast(tl('Territory renamed to "'+d.name+'"','영토 이름이 "'+d.name+'"(으)로 변경되었습니다','領土名を「'+d.name+'」に変更しました','领地名称已更改为“'+d.name+'”'),'success');
    // Update local data
    plot.customName=d.name;
    var nameRow=document.getElementById('infoNameRow');
    nameRow.style.display='';
    document.getElementById('infoCustomName').textContent=d.name;
    try{refreshEmailBalances()}catch(e){}
  }catch(e){showToast(t('quests_network_error')||tl('Network error','네트워크 오류','ネットワークエラー','网络错误'),'error')}
}

// ── POI Hint (micro-transaction) ──
async function getPOIHint(){
  var w=walletState.address;
  if(!w){showToast(t('daily_login_required')||tl('Login required','로그인이 필요합니다','ログインが必要です','请先登录'));return}
  // Use camera/globe center as user position
  var lat=0,lng=0;
  try{
    if(typeof camera!=='undefined'&&camera.position){
      // Convert camera to lat/lng approximation
      var pos=camera.position;
      lat=Math.asin(pos.y/pos.length())*180/Math.PI;
      lng=Math.atan2(pos.x,pos.z)*180/Math.PI;
    }
  }catch(e){}
  var ok=await shopConfirm('',tl('POI Hint','POI 힌트','POIヒント','POI 提示'),
    '<div style="font-size:14px;font-weight:700;color:var(--tx);margin-bottom:4px">'+tl('POI DIRECTION HINT','POI 방향 힌트','POI方向ヒント','POI 方向提示')+'</div>'
    +'<div style="font-size:var(--fs-sm);color:var(--tx3);margin-bottom:8px">'+tl('Get the approximate direction to the nearest undiscovered POI.','가장 가까운 미발견 POI의 대략적인 방향을 얻습니다.','最も近い未発見POIのおおよその方向を取得します。','获取最近未发现 POI 的大致方向。')+'</div>'
    +'<div style="font-size:var(--fs-md);color:var(--gold)">0.2 PP</div>',tl('GET HINT','힌트 받기','ヒント取得','获取提示'));
  if(!ok)return;
  try{
    var headers={'Content-Type':'application/json'};
    if(emailAuth.token) headers['Authorization']='Bearer '+emailAuth.token;
    var resp=await fetch('/api/exploration/hint',{method:'POST',headers:headers,body:JSON.stringify({wallet:w,lat:lat,lng:lng})});
    var d=await resp.json();
    if(!resp.ok){showToast(d.error||tl('Hint failed','힌트 요청 실패','ヒント取得失敗','提示获取失败'),'error');return}
    var icon=d.hint.poiType?({'ancient_ruins':'','ore_deposit':'','crashed_probe':'','water_ice':'','alien_artifact':''}[d.hint.poiType]||''):'';
    showNotification('exploration',tl('POI hint','POI 힌트','POIヒント','POI 提示'),icon+' '+d.hint.direction+' — '+d.hint.distance);
    try{refreshEmailBalances()}catch(e){}
  }catch(e){showToast(t('quests_network_error')||tl('Network error','네트워크 오류','ネットワークエラー','网络错误'),'error')}
}

// ── Rocket Loot Priority (micro-transaction) ──
async function buyLootPriority(rocketEventId){
  var w=walletState.address;
  if(!w){showToast(t('daily_login_required')||tl('Login required','로그인이 필요합니다','ログインが必要です','请先登录'));return}
  var ok=await shopConfirm('',tl('Priority Queue','우선 대기열','優先キュー','优先队列'),
    '<div style="font-size:14px;font-weight:700;color:var(--tx);margin-bottom:4px">'+tl('LOOT PRIORITY','전리품 우선권','戦利品優先権','战利品优先权')+'</div>'
    +'<div style="font-size:var(--fs-sm);color:var(--tx3);margin-bottom:8px">'+tl('Get a 5-second head start notification when rocket loot drops.','로켓 전리품이 떨어질 때 5초 빠른 알림을 받습니다.','ロケットの戦利品が落ちる際に5秒早い通知を受け取ります。','火箭战利品掉落时提前 5 秒收到通知。')+'</div>'
    +'<div style="font-size:var(--fs-md);color:var(--gold)">0.3 PP</div>',tl('GET PRIORITY','우선권 받기','優先権取得','获取优先权'));
  if(!ok)return;
  try{
    var headers={'Content-Type':'application/json'};
    if(emailAuth.token) headers['Authorization']='Bearer '+emailAuth.token;
    var resp=await fetch('/api/rockets/priority',{method:'POST',headers:headers,body:JSON.stringify({wallet:w,rocketEventId:rocketEventId})});
    var d=await resp.json();
    if(!resp.ok){showToast(d.error||tl('Priority failed','우선권 구매 실패','優先権の購入に失敗しました','优先权购买失败'),'error');return}
    showToast(tl('Priority notification activated!','우선 알림이 활성화되었습니다!','優先通知を有効化しました！','优先通知已启用！'),'success');
    try{refreshEmailBalances()}catch(e){}
  }catch(e){showToast(t('quests_network_error')||tl('Network error','네트워크 오류','ネットワークエラー','网络错误'),'error')}
}

// ── Auto-Renew Toggle ──
async function toggleAutoRenew(type,id,currentState){
  var w=walletState.address;
  if(!w)return;
  var newState=!currentState;
  try{
    var body={wallet:w,enabled:newState};
    if(type==='shield') body.shieldId=id;
    else body.effectId=id;
    var resp=await fetch('/api/shop/auto-renew',{method:'POST',headers:Object.assign({'Content-Type':'application/json'},getAuthHeaders()),body:JSON.stringify(body)});
    var d=await resp.json();
    if(!resp.ok){showToast(d.error||tl('Toggle failed','토글 변경 실패','切り替え失敗','切换失败'),'error');return}
    showToast(tl('Auto-renew '+(newState?'ON':'OFF'),newState?'자동 갱신 ON':'자동 갱신 OFF',newState?'自動更新 ON':'自動更新 OFF',newState?'自动续订 ON':'自动续订 OFF'),'success');
    // Refresh inventory view if open
    if(typeof renderShopInventory==='function') renderShopInventory();
  }catch(e){showToast(t('quests_network_error')||tl('Network error','네트워크 오류','ネットワークエラー','网络错误'),'error')}
}

function startMineTimer(nextAt){
  var el=document.getElementById('baseMineTimer');
  var instantBtn=document.getElementById('baseInstantHarvestBtn');
  if(window._mineTimerInterval) _clearActiveInterval(window._mineTimerInterval);
  // Show instant harvest button if on cooldown
  if(nextAt&&nextAt>Date.now()){
    instantBtn.style.display='';
  }else{
    instantBtn.style.display='none';
  }
  window._mineTimerInterval=_setActiveInterval(function(){
    var diff=nextAt-Date.now();
    if(diff<=0){
      el.textContent=t('harvest_available');
      instantBtn.style.display='none';
      var md=document.getElementById('miningDot');if(md)md.style.display='block';
      // Enable harvest button with range
      var hBtn=document.getElementById('baseHarvestBtn');
      if(hBtn){
        hBtn.disabled=false;
        var rng='';if(window._miningEstMin>0) rng=' ('+window._miningEstMin.toFixed(2)+'~'+window._miningEstMax.toFixed(2)+' PP + 🪨)';
        hBtn.innerHTML='<span>'+t('harvest_pp')+rng+'</span>';
      }
      _clearActiveInterval(window._mineTimerInterval);
      window._mineTimerInterval=null;
      return;
    }
    var h=Math.floor(diff/3600000);var m=Math.floor((diff%3600000)/60000);var s=Math.floor((diff%60000)/1000);
    el.textContent=t('mine_timer_prefix')+' '+h+'h '+m+'m '+s+'s';
  },1000);
}

function openBaseTab(tab){
  openBaseModal();
  // Switch to specified tab
  document.querySelectorAll('.base-tab').forEach(function(t){t.classList.remove('active')});
  document.querySelectorAll('.base-pane').forEach(function(p){p.classList.remove('active')});
  var pane=document.getElementById('basePane_'+tab);
  if(pane) pane.classList.add('active');
  // Find and activate matching tab button
  document.querySelectorAll('.base-tab').forEach(function(t){
    if(t.textContent.trim().toLowerCase().replace(/\s/g,'')===tab.toLowerCase()) t.classList.add('active');
  });
}

/* ── Sector Boundaries on Globe Texture ── */
