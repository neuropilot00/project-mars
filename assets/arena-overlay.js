// ═══════════════════════════════════════════════════════════
//  ARENA OVERLAY — Crash & Mines (embedded from arena.html)
// ═══════════════════════════════════════════════════════════
(function(){
'use strict';

const ARENA_API = '/api/arena';
var arenaWallet = null;
var arenaPpBal = 0, arenaUsdtBal = 0;
var arenaInited = false;

// ── Arena Auth Header (JWT) ──
function arenaAuthHeaders() {
  var t = localStorage.getItem('pw_token');
  return t ? { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + t }
           : { 'Content-Type': 'application/json' };
}

function arenaReadJson(key, url, minGap, auth) {
  var walletKey = arenaWallet || ((window.walletState && walletState.address) ? String(walletState.address).toLowerCase() : 'public');
  var fetchOptions = auth === false ? {} : { headers: getAuthHeaders() };
  if (typeof _guardedJsonFetch === 'function') {
    return _guardedJsonFetch('arena:' + key + ':' + walletKey, url, {
      minGap: minGap || 10000,
      backoffMs: 90000,
      fetchOptions: fetchOptions
    });
  }
  return fetch(url, fetchOptions).then(function(r){ return r.ok ? r.json() : null; }).catch(function(){ return null; });
}

// ── Arena Toast ──
function arenaToast(msg, isErr) {
  var t = document.getElementById('arenaToast');
  t.textContent = msg;
  t.className = 'arena-toast show' + (isErr ? ' err' : '');
  clearTimeout(t._t);
  t._t = setTimeout(function(){ t.className = 'arena-toast'; }, 2500);
}

// ── Wallet (bridges index.html's walletState) ──
function arenaSetWalletUI() {
  var short = arenaWallet.slice(0,6) + '...' + arenaWallet.slice(-4);
  document.getElementById('btnConnect').textContent = short;
  document.getElementById('btnConnect').style.color = 'var(--gn)';
}

window.arenaConnectWallet = function() {
  // No MetaMask — must be logged in via email
  if (window.walletState && walletState.connected && walletState.address) {
    arenaWallet = walletState.address.toLowerCase();
    arenaSetWalletUI();
    arenaLoadBalance();
    arenaCheckActiveMines();
  } else {
    arenaToast(tl('Please login first','먼저 로그인하세요','まずログインしてください','请先登录'), true);
    try { openAuthModal(); } catch(e) {}
  }
};

function arenaTryAutoConnect() {
  // Use index.html walletState if available
  if (window.walletState && walletState.connected && walletState.address) {
    arenaWallet = walletState.address.toLowerCase();
    arenaSetWalletUI();
    var nick = localStorage.getItem('pw_token');
    if (nick) {
      try {
        var payload = JSON.parse(atob(nick.split('.')[1]));
        if (payload.nickname) {
          document.getElementById('btnConnect').textContent = payload.nickname;
        }
      } catch(e){}
    }
    arenaLoadBalance();
    arenaCheckActiveMines();
    return;
  }
  // Fallback: try JWT token
  var token = localStorage.getItem('pw_token');
  if (token) {
    try {
      var payload = JSON.parse(atob(token.split('.')[1]));
      if (payload.wallet) {
        arenaWallet = payload.wallet.toLowerCase();
        arenaSetWalletUI();
        if (payload.nickname) {
          document.getElementById('btnConnect').textContent = payload.nickname;
        }
        arenaLoadBalance();
        arenaCheckActiveMines();
        return;
      }
    } catch(e){}
  }
}

function arenaLoadBalance() {
  if (!arenaWallet) return;
  arenaReadJson('balance:' + arenaWallet, '/api/user/' + arenaWallet + '/base', 10000, false).then(function(d){
    if (!d) return;
    var u = d.user || d;
    arenaPpBal = parseFloat(u.pp) || parseFloat(u.pp_balance) || 0;
    arenaUsdtBal = parseFloat(u.usdt) || parseFloat(u.usdt_balance) || 0;
    document.getElementById('dispPP').textContent = arenaPpBal.toFixed(2) + ' PP';
    document.getElementById('dispUSDT').textContent = arenaUsdtBal.toFixed(2) + ' USDT';
    // Also sync index.html balance display if available
    if (window.walletState) {
      walletState.gamePP = arenaPpBal;
      walletState.gameUsdt = arenaUsdtBal;
    }
  }).catch(function(){});
}

// ── Tab switching ──
window.switchGame = function(game) {
  document.querySelectorAll('#arenaOverlay .game-tab').forEach(function(t){ t.classList.toggle('active', t.dataset.game === game); });
  document.querySelectorAll('#arenaOverlay .game-panel').forEach(function(p){ p.classList.remove('active'); });
  var panelMap = {crash:'panelCrash',mines:'panelMines',coinflip:'panelCoinflip',dice:'panelDice',hilo:'panelHilo'};
  var panel = document.getElementById(panelMap[game]);
  if (panel) panel.classList.add('active');
  if (game === 'crash') initCrashCanvas();
  if (game === 'coinflip') initCoinflip();
  if (game === 'dice') initDice();
  if (game === 'hilo') initHilo();
};

// ═══ CRASH GAME ═══
var crashState = 'waiting';
var crashRoundId = null;
var crashStartTime = null;
var crashMultiplier = 1.00;
var crashTargetCrash = null;
var myBet = null;
var crashCurrency = 'PP';
var crashBets = [];
var crashCtx = null;
var crashPoints = [];

function initCrashCanvas() {
  var c = document.getElementById('crashCanvas');
  if (!c) return;
  var wrap = c.parentElement;
  var dpr = window.devicePixelRatio || 1;
  c.width = wrap.clientWidth * dpr;
  c.height = wrap.clientHeight * dpr;
  c.style.width = wrap.clientWidth + 'px';
  c.style.height = wrap.clientHeight + 'px';
  crashCtx = c.getContext('2d');
  crashCtx.scale(dpr, dpr);
}

function drawCrashChart() {
  if (!crashCtx) return;
  var c = document.getElementById('crashCanvas');
  var w = c.clientWidth, h = c.clientHeight;
  var ctx = crashCtx;
  ctx.clearRect(0, 0, w, h);
  if (crashState !== 'running' && crashState !== 'crashed') return;
  ctx.strokeStyle = 'rgba(255,120,60,0.06)';
  ctx.lineWidth = 1;
  var maxMult = Math.max(crashMultiplier, 2);
  for (var m = 1; m <= maxMult + 1; m += 0.5) {
    var y = h - ((m - 1) / (maxMult - 0.8)) * (h - 40) - 20;
    if (y < 0 || y > h) continue;
    ctx.beginPath(); ctx.moveTo(40, y); ctx.lineTo(w, y); ctx.stroke();
    ctx.fillStyle = 'rgba(106,88,72,0.6)';
    ctx.font = '8px "Orbitron"';
    ctx.fillText(m.toFixed(1) + 'x', 2, y + 3);
  }
  if (crashPoints.length < 2) return;
  var elapsed = crashPoints[crashPoints.length - 1].t;
  var tScale = (w - 60) / Math.max(elapsed, 3000);
  ctx.beginPath();
  ctx.strokeStyle = crashState === 'crashed' ? 'rgba(232,72,85,0.8)' : 'rgba(76,216,154,0.9)';
  ctx.lineWidth = 2.5;
  ctx.shadowColor = crashState === 'crashed' ? 'rgba(232,72,85,0.4)' : 'rgba(76,216,154,0.4)';
  ctx.shadowBlur = 12;
  for (var i = 0; i < crashPoints.length; i++) {
    var p = crashPoints[i];
    var x = 50 + p.t * tScale;
    var yy = h - ((p.m - 1) / (maxMult - 0.8)) * (h - 40) - 20;
    if (i === 0) ctx.moveTo(x, yy); else ctx.lineTo(x, yy);
  }
  ctx.stroke(); ctx.shadowBlur = 0;
  var last = crashPoints[crashPoints.length - 1];
  var lx = 50 + last.t * tScale;
  var ly = h - ((last.m - 1) / (maxMult - 0.8)) * (h - 40) - 20;
  ctx.beginPath();
  ctx.fillStyle = crashState === 'crashed' ? '#E84855' : '#4CD89A';
  ctx.arc(lx, ly, 4, 0, Math.PI * 2); ctx.fill();
}

function startCrashAnimation() {
  crashStartTime = Date.now();
  crashPoints = [];
  crashMultiplier = 1.00;
  crashState = 'running';
  updateCrashDisplay();
  updateCrashBtn();
}

function stopCrashAnimation(crashPoint) {
  crashState = 'crashed';
  crashMultiplier = crashPoint;
  _clearActiveTimeout(crashPollTimer);
  if (crashStartTime) crashPoints.push({ t: Date.now() - crashStartTime, m: crashPoint });
  updateCrashDisplay();
  drawCrashChart();
  if (myBet && !myBet.cashed) {
    myBet = null;
  }
  updateCrashBtn();
  setTimeout(function(){
    crashState = 'waiting';
    myBet = null;
    updateCrashDisplay();
    updateCrashBtn();
    pollCrashRound();
  }, 3000);
}

function updateCrashDisplay() {
  var el = document.getElementById('crashMultVal');
  var status = document.getElementById('crashStatusText');
  if (!el || !status) return;
  if (crashState === 'waiting') {
    el.className = 'crash-mult-val waiting';
    el.textContent = tl('WAITING...','대기 중...','待機中...','等待中...');
    status.textContent = tl('Place your bets!','베팅하세요!','ベットしてください！','下注吧！');
    status.style.color = 'var(--tx3)';
  } else if (crashState === 'running') {
    el.className = 'crash-mult-val running';
    el.textContent = crashMultiplier.toFixed(2) + 'x';
    status.textContent = '';
    status.style.color = 'var(--gn)';
  } else if (crashState === 'crashed') {
    el.className = 'crash-mult-val crashed';
    el.textContent = crashMultiplier.toFixed(2) + 'x';
    status.textContent = tl('CRASHED!','폭락!','クラッシュ！','崩盘！');
    status.style.color = 'var(--red)';
  }
}

function updateCrashBtn() {
  var btn = document.getElementById('crashBetBtn');
  if (!btn) return;
  if (crashState === 'running' && myBet && !myBet.cashed) {
    var payout = (myBet.amount * crashMultiplier).toFixed(2);
    btn.className = 'btn-bet cashout';
    btn.textContent = tl('CASHOUT','캐시아웃','キャッシュアウト','提现') + '  ' + payout + ' ' + myBet.currency + '  (' + crashMultiplier.toFixed(2) + 'x)';
    btn.disabled = false;
    btn.onclick = doCrashCashout;
  } else if (crashState === 'running' && myBet && myBet.cashed) {
    var cashedMult = myBet.cashoutAt || crashMultiplier;
    var cashedPayout = myBet.payout || (myBet.amount * cashedMult);
    btn.className = 'btn-bet cashout';
    btn.textContent = tl('CASHED OUT','캐시아웃 완료','キャッシュアウト済','已提现') + ' ✓  +' + Number(cashedPayout).toFixed(2) + ' ' + myBet.currency + '  (' + Number(cashedMult).toFixed(2) + 'x)';
    btn.disabled = true; btn.onclick = null;
  } else if (crashState === 'running') {
    btn.className = 'btn-bet place';
    btn.textContent = tl('ROUND IN PROGRESS','라운드 진행 중','ラウンド進行中','回合进行中');
    btn.disabled = true; btn.onclick = null;
  } else if (crashState === 'crashed') {
    btn.className = 'btn-bet place';
    btn.textContent = tl('NEXT ROUND...','다음 라운드...','次のラウンド...','下一回合...');
    btn.disabled = true; btn.onclick = null;
  } else if (crashState === 'waiting' && myBet) {
    btn.className = 'btn-bet cashout';
    btn.textContent = tl('BET PLACED','베팅 완료','ベット完了','下注完成') + ' (' + myBet.amount + ' ' + myBet.currency + ') -- ' + tl('WAITING...','대기 중...','待機中...','等待中...');
    btn.disabled = true; btn.onclick = null;
  } else {
    btn.className = 'btn-bet place';
    btn.textContent = tl('PLACE BET','베팅하기','ベットする','下注');
    btn.disabled = !arenaWallet;
    btn.onclick = placeCrashBet;
  }
}

// Auto cashout toggle
var autoCashoutOn = false;
window.toggleAutoCashout = function() {
  autoCashoutOn = !autoCashoutOn;
  var toggle = document.getElementById('autoToggle');
  toggle.classList.toggle('on', autoCashoutOn);
  var v = parseFloat(document.getElementById('crashAutoInput').value);
  if (autoCashoutOn && (!v || v < 1.1)) {
    arenaToast(tl('Set auto cashout multiplier first (min 1.1x)','자동 캐시아웃 배율을 먼저 설정하세요 (최소 1.1x)','自動キャッシュアウト倍率を先に設定してください（最低1.1x）','请先设置自动提现倍数（最低1.1x）'));
    autoCashoutOn = false;
    toggle.classList.remove('on');
  }
};

window.setCrashCur = function(cur) {
  crashCurrency = cur;
  document.querySelectorAll('#crashCurToggle .cur-opt').forEach(function(o){
    o.classList.toggle('active', o.dataset.cur === cur);
  });
};
window.qCrash = function(v) { document.getElementById('crashBetInput').value = v; };

// ── Crash API calls ──
window.placeCrashBet = function() {
  if (!arenaWallet) return arenaToast(tl('Connect wallet first','먼저 지갑을 연결하세요','まずウォレットを接続してください','请先连接钱包'), true);
  if (crashState !== 'waiting') return arenaToast(tl('Wait for next round','다음 라운드를 기다리세요','次のラウンドをお待ちください','请等待下一回合'), true);
  var amount = parseFloat(document.getElementById('crashBetInput').value);
  if (!amount || amount <= 0) return arenaToast(tl('Enter bet amount','베팅 금액을 입력하세요','ベット額を入力してください','请输入下注金额'), true);
  fetch(ARENA_API + '/crash/bet', {
    method: 'POST', headers: arenaAuthHeaders(),
    body: JSON.stringify({ wallet: arenaWallet, amount: amount, currency: crashCurrency })
  }).then(function(r){ return r.json().then(function(d){ return {ok:r.ok, data:d}; }); })
  .then(function(res){
    if (!res.ok) return arenaToast(res.data.error, true);
    var d = res.data;
    myBet = { amount: d.bet, currency: d.currency, cashed: false };
    arenaLoadBalance();
    updateCrashBtn();
    pollCrashRound();
  }).catch(function(){ arenaToast(tl('Bet failed','베팅 실패','ベット失敗','下注失败'), true); });
};

function doCrashCashout() {
  if (!myBet || myBet.cashed) return;
  fetch(ARENA_API + '/crash/cashout', {
    method: 'POST', headers: arenaAuthHeaders(),
    body: JSON.stringify({ wallet: arenaWallet, multiplier: crashMultiplier })
  }).then(function(r){ return r.json().then(function(d){ return {ok:r.ok, data:d}; }); })
  .then(function(res){
    if (!res.ok) return arenaToast(res.data.error, true);
    var d = res.data;
    myBet.cashed = true;
    myBet.cashoutAt = d.cashoutAt;
    myBet.payout = d.payout;
    arenaLoadBalance();
    updateCrashBtn();
    pollCrashRound(); // refresh bets sidebar
  }).catch(function(){ arenaToast(tl('Cashout failed','캐시아웃 실패','キャッシュアウト失敗','提现失败'), true); });
}

// ── Crash game loop (polling) ──
var crashPollTimer = null;
var crashCountdown = 0;
var countdownInterval = null;

function _arenaIsActive(){
  var overlay=document.getElementById('arenaOverlay');
  return !!(overlay&&overlay.classList.contains('active'));
}
function _scheduleCrash(fn, ms){
  _clearActiveTimeout(crashPollTimer);
  crashPollTimer = _setActiveTimeout(function(){
    crashPollTimer = null;
    if(_pageIsActive()) fn();
  }, ms);
}

function pollCrashRound() {
  if (!_pageIsActive() || !_arenaIsActive()) return; // stop if hidden/closed
  arenaReadJson('crash-current', ARENA_API + '/crash/current', 800, false).then(function(d){
    if (!d) { _scheduleCrash(pollCrashRound, 1500); return; }
    crashRoundId = d.roundId;
    crashBets = d.bets || [];
    renderCrashBets();
    if (d.status === 'waiting') {
      crashState = 'waiting';
      updateCrashDisplay();
      updateCrashBtn();
      if (!crashCountdown) {
        crashCountdown = 8;
        if (countdownInterval) _clearActiveInterval(countdownInterval);
        countdownInterval = _setActiveInterval(function(){
          crashCountdown--;
          var st = document.getElementById('crashStatusText');
          if (st) st.textContent = tl('Starting in ','시작까지 ','開始まで','开始倒计时 ') + crashCountdown + tl('s...','초...','秒...','秒...');
          if (crashCountdown <= 0) {
            _clearActiveInterval(countdownInterval);
            countdownInterval = null;
            startRoundOnServer();
          }
        }, 1000);
      }
    } else if (d.status === 'running') {
      if (crashState !== 'running') startCrashAnimation();
      _scheduleCrash(tickCrashRound, 500);
    } else if (d.status === 'crashed') {
      if (crashState !== 'crashed') {
        stopCrashAnimation(d.crashPoint);
        loadCrashHistory();
      }
    }
  }).catch(function(){
    if (_arenaIsActive()) {
      _scheduleCrash(pollCrashRound, 3000);
    }
  });
}

function startRoundOnServer() {
  fetch(ARENA_API + '/crash/start', { method: 'POST', headers: arenaAuthHeaders() }).then(function(){
    crashCountdown = 0;
    pollCrashRound();
  }).catch(function(){
    _scheduleCrash(pollCrashRound, 2000);
  });
}

function tickCrashRound() {
  if (crashState !== 'running') return;
  if (!_pageIsActive() || !_arenaIsActive()) return;
  arenaReadJson('crash-tick', ARENA_API + '/crash/tick', 400, false).then(function(d){
    if (!d) { _scheduleCrash(tickCrashRound, 1000); return; }
    if (d.status === 'crashed') {
      stopCrashAnimation(d.crashPoint);
      loadCrashHistory();
      return;
    }
    if (d.status === 'running') {
      crashMultiplier = d.multiplier;
      crashBets = d.bets || [];
      renderCrashBets();
      updateCrashDisplay();
      updateCrashBtn();
      crashPoints.push({ t: d.elapsed, m: d.multiplier });
      if (crashPoints.length > 600) crashPoints = crashPoints.filter(function(_, i){ return i % 2 === 0; });
      drawCrashChart();
      if (autoCashoutOn) {
        var autoVal = parseFloat(document.getElementById('crashAutoInput').value);
        if (autoVal && autoVal >= 1.1 && myBet && !myBet.cashed && d.multiplier >= autoVal) {
          doCrashCashout();
        }
      }
    }
    if (d.status === 'no_round') {
      crashState = 'waiting';
      pollCrashRound();
      return;
    }
  }).catch(function(){});
  if (crashState === 'running') {
    _scheduleCrash(tickCrashRound, 150);
  }
}

_onPageVisible(function(){
  if(_arenaIsActive()&&!crashPollTimer) pollCrashRound();
});
_onPageHidden(function(){
  if(crashPollTimer){ _clearActiveTimeout(crashPollTimer); crashPollTimer=null; }
  if(countdownInterval){ _clearActiveInterval(countdownInterval); countdownInterval=null; }
});

function renderCrashBets() {
  var el = document.getElementById('crashBetsList');
  if (!el) return;
  el.innerHTML = crashBets.map(function(b){
    return '<div class="cb-row"><span class="cb-user">' + b.wallet +
      '</span><span class="cb-amt">' + b.bet.toFixed(2) +
      '</span><span class="cb-status ' + b.status + '">' +
      (b.status === 'cashed' ? b.cashout.toFixed(2) + 'x' :
       b.status === 'busted' ? tl('BUST','파산','バスト','爆掉') : tl('LIVE','진행','ライブ','进行')) +
      '</span></div>';
  }).join('');
}

function loadCrashHistory() {
  arenaReadJson('crash-history', ARENA_API + '/crash/history', 10000, false).then(function(d){
    if (!d) return;
    var el = document.getElementById('crashHistory');
    if (!el) return;
    if (!Array.isArray(d)) d = [];
    el.innerHTML = d.map(function(h){
      var cp = Number(h && h.crashPoint) || 1;
      var cls = cp < 1.5 ? 'low' : cp < 3 ? 'mid' : cp < 10 ? 'high' : 'mega';
      return '<div class="ch-pill ' + cls + '">' + cp.toFixed(2) + 'x</div>';
    }).join('');
    el.scrollLeft = 0;
  }).catch(function(){});
}


// ═══ MINES GAME ═══
var minesGameId = null;
var minesActive = false;
var minesCurrency = 'PP';
var mineCount = 5;
var minesRevealed = [];
var minesGrid = null;
var minesMultVal = 1.0;
var minesNextMultVal = null;
var minesBetAmount = 0;

function initMinesGrid() {
  var el = document.getElementById('minesGrid');
  if (!el) return;
  el.innerHTML = '';
  for (var i = 0; i < 25; i++) {
    var tile = document.createElement('div');
    tile.className = 'mine-tile' + (!minesActive ? ' idle' : '');
    tile.dataset.pos = i;
    tile.innerHTML = '<span class="tile-icon">?</span>';
    (function(idx){ tile.onclick = function(){ revealTile(idx); }; })(i);
    el.appendChild(tile);
  }
  updateMinesRevealed();
}

function updateMinesRevealed() {
  var tiles = document.querySelectorAll('#arenaOverlay .mine-tile');
  // Reset all tiles first
  tiles.forEach(function(tile, i){
    tile.className = 'mine-tile' + (!minesActive && !minesGrid ? ' idle' : '');
    tile.querySelector('.tile-icon').textContent = '?';
    tile.querySelector('.tile-icon').style.opacity = '';
  });
  // Mark revealed tiles (gems + the hit mine)
  minesRevealed.forEach(function(pos){
    if (pos >= tiles.length) return;
    var isMine = minesGrid && minesGrid[pos] === 'mine';
    tiles[pos].classList.add('revealed', isMine ? 'mine' : 'gem');
    tiles[pos].querySelector('.tile-icon').textContent = isMine ? '\uD83D\uDCA3' : '\uD83D\uDC8E';
    tiles[pos].querySelector('.tile-icon').style.opacity = '1';
  });
  // Game over: reveal the full grid
  if (minesGrid && !minesActive) {
    tiles.forEach(function(tile, i){
      var icon = tile.querySelector('.tile-icon');
      if (minesRevealed.includes(i)) return; // already shown above
      var isGem = minesGrid[i] === 'gem';
      tile.classList.add('revealed', isGem ? 'gem-hidden' : 'mine-hidden');
      icon.textContent = isGem ? '\uD83D\uDC8E' : '\uD83D\uDCA3';
      icon.style.opacity = '1';
    });
  }
}

window.setMineCount = function(n) {
  if (minesActive) return;
  mineCount = n;
  document.querySelectorAll('#arenaOverlay .mc-btn').forEach(function(b){
    b.classList.toggle('active', parseInt(b.dataset.mc) === n);
  });
};

window.setMinesCur = function(cur) {
  minesCurrency = cur;
  document.querySelectorAll('#minesCurToggle .cur-opt').forEach(function(o){
    o.classList.toggle('active', o.dataset.cur === cur);
  });
};
window.qMines = function(v) { document.getElementById('minesBetInput').value = v; };

function updateMinesInfo() {
  var el;
  el = document.getElementById('minesGemsFound'); if (el) el.textContent = minesRevealed.length;
  el = document.getElementById('minesMultiplier'); if (el) el.textContent = minesMultVal.toFixed(2) + 'x';
  el = document.getElementById('minesNextMult'); if (el) el.textContent = minesNextMultVal ? minesNextMultVal.toFixed(2) + 'x' : '--';
  el = document.getElementById('minesPotentialWin'); if (el) el.textContent = (minesBetAmount * minesMultVal).toFixed(4);

  var btn = document.getElementById('minesActionBtn');
  if (!btn) return;
  if (minesActive) {
    btn.className = 'btn-mines cashout';
    btn.textContent = tl('CASHOUT','캐시아웃','キャッシュアウト','提现') + '  ' + (minesBetAmount * minesMultVal).toFixed(4) + ' ' + minesCurrency;
    btn.disabled = minesRevealed.length === 0;
  } else {
    btn.className = 'btn-mines start';
    btn.textContent = tl('START GAME','게임 시작','ゲーム開始','开始游戏');
    btn.disabled = !arenaWallet;
  }
}

window.minesAction = function() {
  if (minesActive) cashoutMines(); else startMines();
};

function startMines() {
  if (!arenaWallet) return arenaToast(tl('Connect wallet first','먼저 지갑을 연결하세요','まずウォレットを接続してください','请先连接钱包'), true);
  var amount = parseFloat(document.getElementById('minesBetInput').value);
  if (!amount || amount <= 0) return arenaToast(tl('Enter bet amount','베팅 금액을 입력하세요','ベット額を入力してください','请输入下注金额'), true);
  fetch(ARENA_API + '/mines/start', {
    method: 'POST', headers: arenaAuthHeaders(),
    body: JSON.stringify({ wallet: arenaWallet, amount: amount, currency: minesCurrency, mines: mineCount })
  }).then(function(r){ return r.json().then(function(d){ return {ok:r.ok, data:d}; }); })
  .then(function(res){
    if (!res.ok) return arenaToast(res.data.error, true);
    var d = res.data;
    minesGameId = d.gameId;
    minesActive = true;
    minesRevealed = [];
    minesGrid = null;
    minesMultVal = 1.0;
    minesNextMultVal = d.nextMultiplier;
    minesBetAmount = d.bet;
    minesCurrency = d.currency;
    initMinesGrid();
    updateMinesInfo();
    arenaLoadBalance();
    arenaToast(tl('Game started! Find the gems!','게임 시작! 보석을 찾으세요!','ゲーム開始！宝石を見つけよう！','游戏开始！寻找宝石！'));
  }).catch(function(){ arenaToast(tl('Failed to start game','게임 시작 실패','ゲーム開始に失敗','开始游戏失败'), true); });
}

function revealTile(pos) {
  if (!minesActive || !minesGameId) return;
  if (minesRevealed.includes(pos)) return;
  var tiles = document.querySelectorAll('#arenaOverlay .mine-tile');
  var tile = tiles[pos];
  tile.style.pointerEvents = 'none';
  fetch(ARENA_API + '/mines/reveal', {
    method: 'POST', headers: arenaAuthHeaders(),
    body: JSON.stringify({ wallet: arenaWallet, gameId: minesGameId, position: pos })
  }).then(function(r){ return r.json().then(function(d){ return {ok:r.ok, data:d}; }); })
  .then(function(res){
    if (!res.ok) { arenaToast(res.data.error, true); tile.style.pointerEvents = ''; return; }
    var d = res.data;
    if (d.result === 'mine') {
      minesActive = false;
      minesGrid = d.grid;
      minesRevealed.push(pos);
      tile.classList.add('revealed', 'mine');
      tile.querySelector('.tile-icon').textContent = '\uD83D\uDCA3';
      setTimeout(function(){ updateMinesRevealed(); updateMinesInfo(); }, 500);
      arenaToast(tl('BOOM! You hit a mine!','펑! 지뢰를 밟았습니다!','ドカン！地雷を踏みました！','轰！你踩到地雷了！'), true);
      arenaLoadBalance();
    } else {
      minesRevealed = d.revealed;
      minesMultVal = d.multiplier;
      minesNextMultVal = d.nextMultiplier;
      tile.classList.add('revealed', 'gem');
      tile.querySelector('.tile-icon').textContent = '\uD83D\uDC8E';
      updateMinesInfo();
      if (d.safeRemaining === 0) {
        minesActive = false;
        arenaToast(tl('ALL GEMS FOUND! Auto cashout!','모든 보석 발견! 자동 캐시아웃!','全宝石発見！自動キャッシュアウト！','找到所有宝石！自动提现！'));
        cashoutMines();
      }
    }
  }).catch(function(){ arenaToast(tl('Error revealing tile','타일 공개 오류','タイル公開エラー','翻开方块出错'), true); tile.style.pointerEvents = ''; });
}

function cashoutMines() {
  if (!minesActive || !minesGameId) return;
  if (minesRevealed.length === 0) return arenaToast(tl('Reveal at least one tile','타일을 최소 하나 공개하세요','タイルを最低1つ公開してください','至少翻开一个方块'), true);
  fetch(ARENA_API + '/mines/cashout', {
    method: 'POST', headers: arenaAuthHeaders(),
    body: JSON.stringify({ wallet: arenaWallet, gameId: minesGameId })
  }).then(function(r){ return r.json().then(function(d){ return {ok:r.ok, data:d}; }); })
  .then(function(res){
    if (!res.ok) return arenaToast(res.data.error, true);
    var d = res.data;
    minesActive = false;
    minesGrid = d.grid;
    updateMinesRevealed();
    arenaToast(tl('Cashed out!','캐시아웃 완료!','キャッシュアウト完了！','已提现！') + ' +' + d.payout.toFixed(4) + ' ' + d.currency + ' @ ' + d.multiplier.toFixed(2) + 'x');
    arenaLoadBalance();
    updateMinesInfo();
  }).catch(function(){ arenaToast(tl('Cashout failed','캐시아웃 실패','キャッシュアウト失敗','提现失败'), true); });
}

function arenaCheckActiveMines() {
  if (!arenaWallet) return;
  arenaReadJson('mines-active', ARENA_API + '/mines/active', 10000)
  .then(function(d){
    if (!d) return;
    if (d.active) {
      minesGameId = d.gameId;
      minesActive = true;
      minesRevealed = d.revealed;
      minesMultVal = d.multiplier;
      minesNextMultVal = d.nextMultiplier;
      minesBetAmount = d.bet;
      minesCurrency = d.currency;
      mineCount = d.mines;
      document.querySelectorAll('#arenaOverlay .mc-btn').forEach(function(b){
        b.classList.toggle('active', parseInt(b.dataset.mc) === mineCount);
      });
      initMinesGrid();
      updateMinesInfo();
    }
  }).catch(function(){});
}


// ═══ COINFLIP GAME ═══
var cfCurrency = 'PP';
var cfChoice = 'survive';
var cfPlaying = false;

window.setCfCur = function(cur) {
  cfCurrency = cur;
  document.querySelectorAll('#cfCurToggle .cur-opt').forEach(function(o){
    o.classList.toggle('active', o.dataset.cur === cur);
  });
};
window.qCf = function(v) { document.getElementById('cfBetInput').value = v; };

window.setCfChoice = function(c) {
  cfChoice = c;
  document.getElementById('cfChoiceSurvive').classList.toggle('active', c === 'survive');
  document.getElementById('cfChoicePerish').classList.toggle('active', c === 'perish');
};

function initCoinflip() {
  loadCoinflipHistory();
}

function loadCoinflipHistory() {
  if (!arenaWallet) return;
  arenaReadJson('coinflip-history', ARENA_API + '/coinflip/history', 10000)
  .then(function(data){
    if (!data) return;
    var el = document.getElementById('cfHistory');
    if (!el) return;
    el.innerHTML = '';
    var items = Array.isArray(data) ? data.slice(0, 10) : [];
    items.forEach(function(item){
      var dot = document.createElement('div');
      dot.className = 'cf-dot ' + (item.result || 'survive');
      dot.title = (item.result === 'survive' ? tl('HEADS','앞면','表','正面') : tl('TAILS','뒷면','裏','反面')) + ' | ' + tl('Bet','베팅','ベット','下注') + ': ' + item.bet + ' | ' + tl('Payout','지급','配当','派彩') + ': ' + (item.payout || 0);
      el.appendChild(dot);
    });
  }).catch(function(){});
}

window.playCoinflip = function() {
  if (cfPlaying) return;
  if (!arenaWallet) return arenaToast(tl('Connect wallet first','먼저 지갑을 연결하세요','まずウォレットを接続してください','请先连接钱包'), true);
  var amount = parseFloat(document.getElementById('cfBetInput').value);
  if (!amount || amount <= 0) return arenaToast(tl('Enter bet amount','베팅 금액을 입력하세요','ベット額を入力してください','请输入下注金额'), true);

  cfPlaying = true;
  var btn = document.getElementById('cfPlayBtn');
  btn.disabled = true;
  btn.textContent = tl('FLIPPING...','던지는 중...','フリップ中...','抛掷中...');

  var coin = document.getElementById('cfCoin');
  var resultEl = document.getElementById('cfResult');
  resultEl.textContent = '';
  resultEl.style.color = '';
  coin.className = 'cf-coin spinning';

  fetch(ARENA_API + '/coinflip/play', {
    method: 'POST', headers: arenaAuthHeaders(),
    body: JSON.stringify({ wallet: arenaWallet, amount: amount, currency: cfCurrency, choice: cfChoice })
  }).then(function(r){ return r.json().then(function(d){ return {ok:r.ok, data:d}; }); })
  .then(function(res){
    setTimeout(function(){
      cfPlaying = false;
      btn.disabled = false;
      btn.textContent = tl('FLIP COIN','동전 던지기','コインを投げる','抛硬币');
      if (!res.ok) {
        coin.className = 'cf-coin';
        arenaToast(res.data.error, true);
        return;
      }
      var d = res.data;
      try{trackQuestAction('cantina_play',1)}catch(e){}
      coin.className = 'cf-coin flip-' + d.result;
      if (d.won) {
        try{trackQuestAction('cantina_win',1)}catch(e){}
        resultEl.textContent = tl('WIN!','승리!','勝利！','赢了！') + ' +' + (d.payout || 0).toFixed(4) + ' ' + cfCurrency;
        resultEl.style.color = 'var(--gn)';
        arenaToast(tl('You survived!','생존했습니다!','生き残った！','你活下来了！') + ' +' + (d.payout || 0).toFixed(4) + ' ' + cfCurrency);
      } else {
        resultEl.textContent = tl('LOST!','패배!','敗北！','输了！') + ' -' + amount.toFixed(4) + ' ' + cfCurrency;
        resultEl.style.color = 'var(--red)';
        arenaToast(tl('You perished!','사망했습니다!','やられた！','你死了！'), true);
      }
      arenaLoadBalance();
      loadCoinflipHistory();
    }, 900);
  }).catch(function(){
    setTimeout(function(){
      cfPlaying = false;
      btn.disabled = false;
      btn.textContent = tl('FLIP COIN','동전 던지기','コインを投げる','抛硬币');
      coin.className = 'cf-coin';
      arenaToast(tl('Coinflip failed','동전 던지기 실패','コインフリップ失敗','抛硬币失败'), true);
    }, 900);
  });
};


// ═══ DICE GAME ═══
var diceCurrency = 'PP';
var diceDirection = 'over';
var dicePlaying = false;

window.setDiceCur = function(cur) {
  diceCurrency = cur;
  document.querySelectorAll('#diceCurToggle .cur-opt').forEach(function(o){
    o.classList.toggle('active', o.dataset.cur === cur);
  });
};
window.qDice = function(v) { document.getElementById('diceBetInput').value = v; };

window.setDiceDir = function(dir) {
  diceDirection = dir;
  document.getElementById('diceDirOver').classList.toggle('active', dir === 'over');
  document.getElementById('diceDirUnder').classList.toggle('active', dir === 'under');
  updateDiceUI();
};

function initDice() {
  updateDiceUI();
}

window.updateDiceUI = function() {
  var slider = document.getElementById('diceSlider');
  if (!slider) return;
  var target = parseInt(slider.value);
  var fill = document.getElementById('diceSliderFill');
  var winChance, mult;

  if (diceDirection === 'over') {
    winChance = 99 - target;
    if (fill) fill.style.width = ((target / 99) * 100) + '%';
  } else {
    winChance = target - 1;
    if (fill) fill.style.width = ((1 - target / 99) * 100) + '%';
  }
  if (winChance <= 0) winChance = 1;
  if (winChance >= 99) winChance = 98;
  mult = (99 / winChance) * 0.99; // 1% house edge

  var betAmount = parseFloat(document.getElementById('diceBetInput').value) || 1;

  var el;
  el = document.getElementById('diceTarget'); if (el) el.textContent = target + '.00';
  el = document.getElementById('diceWinChance'); if (el) el.textContent = winChance.toFixed(2) + '%';
  el = document.getElementById('diceMult'); if (el) el.textContent = mult.toFixed(2) + 'x';
  el = document.getElementById('dicePotentialWin'); if (el) el.textContent = (betAmount * mult).toFixed(4);
};

window.playDice = function() {
  if (dicePlaying) return;
  if (!arenaWallet) return arenaToast(tl('Connect wallet first','먼저 지갑을 연결하세요','まずウォレットを接続してください','请先连接钱包'), true);
  var amount = parseFloat(document.getElementById('diceBetInput').value);
  if (!amount || amount <= 0) return arenaToast(tl('Enter bet amount','베팅 금액을 입력하세요','ベット額を入力してください','请输入下注金额'), true);
  var target = parseInt(document.getElementById('diceSlider').value);

  dicePlaying = true;
  var btn = document.getElementById('dicePlayBtn');
  btn.disabled = true;
  btn.textContent = tl('ROLLING...','굴리는 중...','ロール中...','投掷中...');

  var resultEl = document.getElementById('diceRollResult');
  var labelEl = document.getElementById('diceRollLabel');
  resultEl.className = 'dice-roll-result dice-rolling';
  resultEl.textContent = '??';
  labelEl.textContent = '';

  fetch(ARENA_API + '/dice/play', {
    method: 'POST', headers: arenaAuthHeaders(),
    body: JSON.stringify({ wallet: arenaWallet, amount: amount, currency: diceCurrency, target: target, direction: diceDirection })
  }).then(function(r){ return r.json().then(function(d){ return {ok:r.ok, data:d}; }); })
  .then(function(res){
    setTimeout(function(){
      dicePlaying = false;
      btn.disabled = false;
      btn.textContent = tl('ROLL DICE','주사위 굴리기','サイコロを振る','掷骰子');
      if (!res.ok) {
        resultEl.className = 'dice-roll-result';
        resultEl.textContent = '--';
        labelEl.textContent = tl('ROLL TO PLAY','굴려서 플레이','振ってプレイ','投掷开始');
        arenaToast(res.data.error, true);
        return;
      }
      var d = res.data;
      try{trackQuestAction('cantina_play',1)}catch(e){}
      resultEl.className = 'dice-roll-result ' + (d.won ? 'win' : 'lose');
      resultEl.textContent = d.roll.toFixed(2);
      if (d.won) {
        try{trackQuestAction('cantina_win',1)}catch(e){}
        labelEl.textContent = tl('WIN!','승리!','勝利！','赢了！') + ' +' + (d.payout || 0).toFixed(4) + ' ' + diceCurrency + ' @ ' + (d.multiplier || 0).toFixed(2) + 'x';
        labelEl.style.color = 'var(--gn)';
        arenaToast(tl('Roll ','롤 ','ロール ','点数 ') + d.roll.toFixed(2) + ' — ' + tl('WIN!','승리!','勝利！','赢了！') + ' +' + (d.payout || 0).toFixed(4));
      } else {
        labelEl.textContent = tl('LOST!','패배!','敗北！','输了！') + ' -' + amount.toFixed(4) + ' ' + diceCurrency;
        labelEl.style.color = 'var(--red)';
        arenaToast(tl('Roll ','롤 ','ロール ','点数 ') + d.roll.toFixed(2) + ' — ' + tl('LOST!','패배!','敗北！','输了！'), true);
      }
      arenaLoadBalance();
    }, 600);
  }).catch(function(){
    setTimeout(function(){
      dicePlaying = false;
      btn.disabled = false;
      btn.textContent = tl('ROLL DICE','주사위 굴리기','サイコロを振る','掷骰子');
      resultEl.className = 'dice-roll-result';
      resultEl.textContent = '--';
      arenaToast(tl('Dice roll failed','주사위 굴리기 실패','サイコロ失敗','掷骰子失败'), true);
    }, 600);
  });
};


// ═══ HI-LO GAME ═══
var hiloCurrency = 'PP';
var hiloGameId = null;
var hiloActive = false;
var hiloCards = [];
var hiloMultiplier = 1.0;
var hiloBetAmount = 0;

var HILO_SUITS = ['rock', 'dust', 'ice', 'iron'];
var HILO_SUIT_ICONS = {rock:'\u{1FAA8}', dust:'\u{1F32A}', ice:'\u{1F9CA}', iron:'\u{2699}'};

window.setHiloCur = function(cur) {
  hiloCurrency = cur;
  document.querySelectorAll('#hiloCurToggle .cur-opt').forEach(function(o){
    o.classList.toggle('active', o.dataset.cur === cur);
  });
};
window.qHilo = function(v) { document.getElementById('hiloBetInput').value = v; };

function initHilo() {
  checkActiveHilo();
}

function renderHiloCards() {
  var area = document.getElementById('hiloCardsArea');
  if (!area) return;
  area.innerHTML = '';
  hiloCards.forEach(function(card){
    var el = document.createElement('div');
    el.className = 'hilo-card-sm';
    var suitIcon = HILO_SUIT_ICONS[card.suit] || card.suit;
    el.innerHTML = '<span class="hc-val">' + (card.display || card.name) + '</span><span class="hc-suit">' + suitIcon + '</span>';
    area.appendChild(el);
  });
}

function updateHiloDisplay() {
  var card = hiloCards.length ? hiloCards[hiloCards.length - 1] : null;
  var bigCard = document.getElementById('hiloCurrentCard');
  if (bigCard) {
    if (card) {
      var suitIcon = HILO_SUIT_ICONS[card.suit] || card.suit;
      bigCard.querySelector('.hilo-card-val').textContent = card.display || card.name;
      bigCard.querySelector('.hilo-card-suit').textContent = suitIcon + ' ' + (card.suit || '').toUpperCase();
      bigCard.classList.add('reveal');
      setTimeout(function(){ bigCard.classList.remove('reveal'); }, 500);
    } else {
      bigCard.querySelector('.hilo-card-val').textContent = '?';
      bigCard.querySelector('.hilo-card-suit').textContent = '';
    }
  }
  var multEl = document.getElementById('hiloMultVal');
  if (multEl) multEl.textContent = hiloMultiplier.toFixed(2) + 'x';

  var higherBtn = document.getElementById('hiloHigherBtn');
  var lowerBtn = document.getElementById('hiloLowerBtn');
  var cashBtn = document.getElementById('hiloCashoutBtn');
  var startBtn = document.getElementById('hiloStartBtn');

  if (hiloActive) {
    if (higherBtn) higherBtn.disabled = false;
    if (lowerBtn) lowerBtn.disabled = false;
    if (cashBtn) { cashBtn.disabled = hiloCards.length < 2; cashBtn.textContent = tl('CASHOUT','캐시아웃','キャッシュアウト','提现') + ' ' + (hiloBetAmount * hiloMultiplier).toFixed(4) + ' ' + hiloCurrency; }
    if (startBtn) { startBtn.textContent = tl('GAME IN PROGRESS','게임 진행 중','ゲーム進行中','游戏进行中'); startBtn.disabled = true; }
  } else {
    if (higherBtn) higherBtn.disabled = true;
    if (lowerBtn) lowerBtn.disabled = true;
    if (cashBtn) { cashBtn.disabled = true; cashBtn.textContent = tl('CASHOUT','캐시아웃','キャッシュアウト','提现'); }
    if (startBtn) { startBtn.textContent = tl('START GAME','게임 시작','ゲーム開始','开始游戏'); startBtn.disabled = !arenaWallet; }
  }
  renderHiloCards();
}

function checkActiveHilo() {
  if (!arenaWallet) return;
  arenaReadJson('hilo-active', ARENA_API + '/hilo/active', 10000)
  .then(function(d){
    if (!d) return;
    if (d.active || d.gameId) {
      hiloGameId = d.gameId;
      hiloActive = true;
      hiloCards = d.cards || [];
      hiloMultiplier = d.multiplier || 1.0;
      hiloBetAmount = d.bet || 0;
      hiloCurrency = d.currency || 'PP';
      updateHiloDisplay();
    }
  }).catch(function(){});
}

window.startHilo = function() {
  if (hiloActive) return;
  if (!arenaWallet) return arenaToast(tl('Connect wallet first','먼저 지갑을 연결하세요','まずウォレットを接続してください','请先连接钱包'), true);
  var amount = parseFloat(document.getElementById('hiloBetInput').value);
  if (!amount || amount <= 0) return arenaToast(tl('Enter bet amount','베팅 금액을 입력하세요','ベット額を入力してください','请输入下注金额'), true);

  var btn = document.getElementById('hiloStartBtn');
  btn.disabled = true;
  btn.textContent = tl('STARTING...','시작 중...','開始中...','开始中...');

  fetch(ARENA_API + '/hilo/start', {
    method: 'POST', headers: arenaAuthHeaders(),
    body: JSON.stringify({ wallet: arenaWallet, amount: amount, currency: hiloCurrency })
  }).then(function(r){ return r.json().then(function(d){ return {ok:r.ok, data:d}; }); })
  .then(function(res){
    if (!res.ok) {
      btn.disabled = false;
      btn.textContent = tl('START GAME','게임 시작','ゲーム開始','开始游戏');
      return arenaToast(res.data.error, true);
    }
    var d = res.data;
    hiloGameId = d.gameId;
    hiloActive = true;
    hiloCards = d.cards || [];
    hiloMultiplier = d.multiplier || 1.0;
    hiloBetAmount = amount;
    updateHiloDisplay();
    arenaLoadBalance();
    arenaToast(tl('Game started! Higher or Lower?','게임 시작! 높을까 낮을까?','ゲーム開始！ハイかローか？','游戏开始！大还是小？'));
  }).catch(function(){
    btn.disabled = false;
    btn.textContent = tl('START GAME','게임 시작','ゲーム開始','开始游戏');
    arenaToast(tl('Failed to start game','게임 시작 실패','ゲーム開始に失敗','开始游戏失败'), true);
  });
};

window.guessHilo = function(dir) {
  if (!hiloActive || !hiloGameId) return;
  var higherBtn = document.getElementById('hiloHigherBtn');
  var lowerBtn = document.getElementById('hiloLowerBtn');
  if (higherBtn) higherBtn.disabled = true;
  if (lowerBtn) lowerBtn.disabled = true;

  fetch(ARENA_API + '/hilo/guess', {
    method: 'POST', headers: arenaAuthHeaders(),
    body: JSON.stringify({ gameId: hiloGameId, guess: dir })
  }).then(function(r){ return r.json().then(function(d){ return {ok:r.ok, data:d}; }); })
  .then(function(res){
    if (!res.ok) {
      if (hiloActive) { if (higherBtn) higherBtn.disabled = false; if (lowerBtn) lowerBtn.disabled = false; }
      return arenaToast(res.data.error, true);
    }
    var d = res.data;
    if (d.card) hiloCards.push(d.card);
    if (d.cards) hiloCards = d.cards;
    hiloMultiplier = d.multiplier || hiloMultiplier;

    if (d.correct === false || d.status === 'lost') {
      hiloActive = false;
      hiloGameId = null;
      updateHiloDisplay();
      arenaToast(tl('Wrong guess! Game over!','틀렸습니다! 게임 종료!','ハズレ！ゲームオーバー！','猜错了！游戏结束！'), true);
      arenaLoadBalance();
    } else {
      updateHiloDisplay();
      arenaToast(tl('Correct! Multiplier: ','정답! 배율: ','正解！倍率：','猜对了！倍数：') + hiloMultiplier.toFixed(2) + 'x');
    }
  }).catch(function(){
    if (hiloActive) { if (higherBtn) higherBtn.disabled = false; if (lowerBtn) lowerBtn.disabled = false; }
    arenaToast(tl('Guess failed','예측 실패','予想失敗','猜测失败'), true);
  });
};

window.cashoutHilo = function() {
  if (!hiloActive || !hiloGameId) return;
  if (hiloCards.length < 2) return arenaToast(tl('Make at least one guess first','먼저 한 번 이상 예측하세요','まず1回以上予想してください','请先至少猜测一次'), true);
  var cashBtn = document.getElementById('hiloCashoutBtn');
  if (cashBtn) { cashBtn.disabled = true; cashBtn.textContent = tl('CASHING OUT...','캐시아웃 중...','キャッシュアウト中...','提现中...'); }

  fetch(ARENA_API + '/hilo/cashout', {
    method: 'POST', headers: arenaAuthHeaders(),
    body: JSON.stringify({ gameId: hiloGameId })
  }).then(function(r){ return r.json().then(function(d){ return {ok:r.ok, data:d}; }); })
  .then(function(res){
    if (!res.ok) {
      if (cashBtn) { cashBtn.disabled = false; cashBtn.textContent = tl('CASHOUT','캐시아웃','キャッシュアウト','提现'); }
      return arenaToast(res.data.error, true);
    }
    var d = res.data;
    hiloActive = false;
    hiloGameId = null;
    updateHiloDisplay();
    arenaToast(tl('Cashed out!','캐시아웃 완료!','キャッシュアウト完了！','已提现！') + ' +' + (d.payout || 0).toFixed(4) + ' ' + (d.currency || hiloCurrency));
    arenaLoadBalance();
  }).catch(function(){
    if (cashBtn) { cashBtn.disabled = false; cashBtn.textContent = tl('CASHOUT','캐시아웃','キャッシュアウト','提现'); }
    arenaToast(tl('Cashout failed','캐시아웃 실패','キャッシュアウト失敗','提现失败'), true);
  });
};


// ═══ OPEN / CLOSE ARENA ═══
function stopAllArenaTimers() {
  _clearActiveTimeout(crashPollTimer); crashPollTimer = null;
  if(countdownInterval){ _clearActiveInterval(countdownInterval); countdownInterval = null; }
  crashCountdown = 0;
}

window.openArena = function() {
  var overlay = document.getElementById('arenaOverlay');
  overlay.classList.add('active');
  document.body.style.overflow = 'hidden';

  // Initialize arena on first open
  arenaTryAutoConnect();
  initCrashCanvas();
  initMinesGrid();
  updateCrashDisplay();
  updateCrashBtn();
  updateMinesInfo();
  loadCrashHistory();
  pollCrashRound();
  updateDiceUI();
  updateHiloDisplay();
  arenaInited = true;
};

window.closeArena = function() {
  var overlay = document.getElementById('arenaOverlay');
  overlay.classList.remove('active');
  document.body.style.overflow = '';
  stopAllArenaTimers();
};

// Close on Escape key
document.addEventListener('keydown', function(e){
  if(e.key==='Escape'){
    // Land select cancel
    if(landSelectMode){ cancelLandSelect(); _showMobSizeControls(false); return; }
    // Claim modal
    if(document.getElementById('claimModal').classList.contains('open')){ closeClaimModal(); return; }
    // Base modal
    if(document.getElementById('baseModal').classList.contains('open')){ closeBaseModal(); return; }
    // Minigame overlay
    if(document.getElementById('minigameOverlay').classList.contains('active')){ closeMinigameOverlay(); return; }
    // Declare War modal
    if(document.getElementById('declareWarModal').style.display==='flex'){ closeDeclareWarModal(); return; }
    // Exchange modal
    if(document.getElementById('exchangeModal').classList.contains('open')){ closeExchangeModal(); return; }
    // Arena
    if(document.getElementById('arenaOverlay').classList.contains('active')){ closeArena(); return; }
  }
});

// Close on backdrop click
document.getElementById('arenaOverlay').addEventListener('click', function(e){
  if (e.target === this) closeArena();
});

// Resize handler (debounced — canvas reinit is expensive)
window.addEventListener('resize', _debounce(function(){
  if (document.getElementById('arenaOverlay').classList.contains('active')) {
    initCrashCanvas();
    drawCrashChart();
  }
}, 250));

})(); // end ARENA IIFE
