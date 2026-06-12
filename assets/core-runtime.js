/* ── Lightweight Client Error Reporter ─────────────── */
(function() {
  var _errCount = 0;
  var _errMax = 5;
  var _errWindow = 60000; // 1 minute
  var _errTimes = [];
  var _errSentKey = '_om_err_sent';

  function _canSend() {
    var now = Date.now();
    _errTimes = _errTimes.filter(function(t) { return now - t < _errWindow; });
    if (_errTimes.length >= _errMax) return false;
    _errTimes.push(now);
    return true;
  }

  function _isDuplicate(msg) {
    try {
      var sent = JSON.parse(localStorage.getItem(_errSentKey) || '{}');
      var key = String(msg).slice(0, 120);
      var now = Date.now();
      // Clear entries older than 5 minutes
      for (var k in sent) { if (now - sent[k] > 300000) delete sent[k]; }
      if (sent[key] && now - sent[key] < 300000) return true;
      sent[key] = now;
      localStorage.setItem(_errSentKey, JSON.stringify(sent));
      return false;
    } catch(e) { return false; }
  }

  // Ring buffer of recent errors so the bug-report modal can attach context.
  // Bounded at 20 entries to keep memory tiny.
  window.__recentErrors = window.__recentErrors || [];
  function _pushRecentError(data) {
    try {
      window.__recentErrors.push({
        ts: Date.now(),
        message: String(data.message || '').slice(0, 500),
        source: data.source ? String(data.source).slice(0, 300) : null,
        line: data.line || null
      });
      if (window.__recentErrors.length > 20) window.__recentErrors.shift();
    } catch(_) {}
  }

  function _reportError(data) {
    _pushRecentError(data);
    if (!data.message || !_canSend() || _isDuplicate(data.message)) return;
    try {
      var xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/error-report', true);
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.send(JSON.stringify({
        message: String(data.message).slice(0, 1000),
        source: data.source ? String(data.source).slice(0, 1000) : null,
        line: data.line || null,
        stack: data.stack ? String(data.stack).slice(0, 2000) : null,
        userAgent: navigator.userAgent.slice(0, 500),
        url: location.href.slice(0, 1000)
      }));
    } catch(e) { /* silently fail */ }
  }

  window.onerror = function(msg, source, line, col, err) {
    _reportError({
      message: msg,
      source: source,
      line: line,
      stack: err && err.stack ? err.stack : null
    });
  };

  window.onunhandledrejection = function(ev) {
    var reason = ev.reason || {};
    _reportError({
      message: 'Unhandled Promise: ' + (reason.message || String(reason)).slice(0, 900),
      source: reason.fileName || null,
      line: reason.lineNumber || null,
      stack: reason.stack || null
    });
  };
})();

/* ── Page lifecycle helpers ────────────────────────
   Keep background-loop guards consistent without changing foreground cadence. */
function _pageIsActive(){ return document.visibilityState !== 'hidden'; }
var _pageVisibleHandlers = [];
var _pageHiddenHandlers = [];
var _pageFocusHandlers = [];
var _pageShowHandlers = [];
var _pageLifecycleActive = _pageIsActive();
var _pageHiddenByPagehide = false;
function _runPageLifecycleHandlers(list){
  list.slice().forEach(function(fn){ try{ fn(); }catch(_){} });
}
function _dispatchPageLifecycle(active){
  if(_pageLifecycleActive===active) return;
  _pageLifecycleActive = active;
  _runPageLifecycleHandlers(active ? _pageVisibleHandlers : _pageHiddenHandlers);
}
document.addEventListener('visibilitychange', function(){
  _dispatchPageLifecycle(_pageIsActive());
});
window.addEventListener('pagehide', function(){
  _pageHiddenByPagehide = true;
  _dispatchPageLifecycle(false);
});
window.addEventListener('pageshow', function(e){
  _runPageLifecycleHandlers(_pageShowHandlers);
  if(!_pageIsActive()||(!_pageHiddenByPagehide&&!e.persisted)) return;
  _pageHiddenByPagehide = false;
  _dispatchPageLifecycle(true);
});
window.addEventListener('focus', function(){
  if(_pageIsActive()) _runPageLifecycleHandlers(_pageFocusHandlers);
});
function _onPageVisible(fn){ if(typeof fn==='function') _pageVisibleHandlers.push(fn); }
function _onPageHidden(fn){ if(typeof fn==='function') _pageHiddenHandlers.push(fn); }
function _onPageFocus(fn){ if(typeof fn==='function') _pageFocusHandlers.push(fn); }
function _onPageShow(fn){ if(typeof fn==='function') _pageShowHandlers.push(fn); }
function _removePageVisibleHandler(fn){
  for(var i=_pageVisibleHandlers.length-1;i>=0;i--){
    if(_pageVisibleHandlers[i]===fn) _pageVisibleHandlers.splice(i,1);
  }
}
function _onPageVisibleOnce(fn){
  if(typeof fn!=='function') return;
  var wrapped=function(){
    _removePageVisibleHandler(wrapped);
    fn();
  };
  _onPageVisible(wrapped);
  return wrapped;
}
var _activeIntervals = [];
var _activeIntervalSeq = 0;
var _activeTimeouts = [];
var _activeTimeoutSeq = 0;
function _startActiveInterval(entry){
  if(!entry||entry.cleared||entry.nativeId||!_pageIsActive()) return;
  entry.nativeId = setInterval(function(){ if(_pageIsActive()) entry.fn(); }, entry.ms);
}
function _pauseActiveIntervals(){
  _activeIntervals.forEach(function(entry){
    if(entry.nativeId){ clearInterval(entry.nativeId); entry.nativeId=null; }
  });
}
function _resumeActiveIntervals(){
  _activeIntervals.forEach(_startActiveInterval);
}
function _setActiveInterval(fn, ms){
  var entry = { key: ++_activeIntervalSeq, nativeId: null, fn: fn, ms: ms, cleared: false };
  _activeIntervals.push(entry);
  _startActiveInterval(entry);
  return entry.key;
}
function _setActiveTimeout(fn, ms){
  var entry = { key: ++_activeTimeoutSeq, nativeId: null, visibleHandler: null, fn: fn, cleared: false };
  _activeTimeouts.push(entry);
  entry.nativeId = setTimeout(function(){
    entry.nativeId = null;
    if(entry.cleared) return;
    if(_pageIsActive()) { _clearActiveTimeout(entry.key); fn(); return; }
    entry.visibleHandler = _onPageVisibleOnce(function(){
      if(entry.cleared) return;
      _clearActiveTimeout(entry.key);
      fn();
    });
  }, ms);
  return entry.key;
}
function _activeSleep(ms){
  return new Promise(function(resolve){ _setActiveTimeout(resolve, ms); });
}
var _apiFetchGuards = {};
var _apiEndpointGuards = {};
var _apiPublicHudBackoffUntil = 0;
var _apiPublicHudBackoffPaths = {
  '/api/stats': true,
  '/api/leaderboard': true,
  '/api/sectors': true,
  '/api/weather': true,
  '/api/claims': true,
  '/api/pixels': true,
  '/api/exploration/starlink': true,
  '/api/rockets': true,
  '/api/announce/active': true,
  '/api/activity/feed': true
};
function _isPublicHudFetchPath(url) {
  try {
    return !!_apiPublicHudBackoffPaths[new URL(url, location.origin).pathname];
  } catch (_) {
    return false;
  }
}
function _authModalIsOpen() {
  var modal = document.getElementById('authModal');
  return !!(modal && modal.classList && modal.classList.contains('open'));
}
function _shouldDeferPublicHudFetch(url, fetchOptions) {
  var method = (fetchOptions && fetchOptions.method ? fetchOptions.method : 'GET').toUpperCase();
  return method === 'GET' && _isPublicHudFetchPath(url) && _authModalIsOpen();
}
function _clearPublicHudFetchBackoff() {
  _apiPublicHudBackoffUntil = 0;
  Object.keys(_apiEndpointGuards).forEach(function(key) {
    if (key.indexOf('GET /api/') !== 0) return;
    var path = key.replace(/^GET\s+/, '');
    if (_apiPublicHudBackoffPaths[path]) _apiEndpointGuards[key].backoffUntil = 0;
  });
}
function _guardedFetchEndpointKey(url, fetchOptions) {
  try {
    var u = new URL(url, location.origin);
    var method = (fetchOptions && fetchOptions.method ? fetchOptions.method : 'GET').toUpperCase();
    return method + ' ' + u.pathname;
  } catch (_) {
    return null;
  }
}
function _guardedJsonFetch(key, url, options) {
  options = options || {};
  var now = Date.now();
  var g = _apiFetchGuards[key] || (_apiFetchGuards[key] = {
    inFlight: false,
    lastAt: 0,
    backoffUntil: 0
  });
  var fetchOptions = options.fetchOptions || {};
  var isPublicHud = _isPublicHudFetchPath(url);
  if (isPublicHud && (now < _apiPublicHudBackoffUntil || _shouldDeferPublicHudFetch(url, fetchOptions))) {
    return Promise.resolve(null);
  }
  var endpointKey = options.shareEndpoint === false ? null : (options.endpointKey || _guardedFetchEndpointKey(url, fetchOptions));
  var eg = endpointKey ? (_apiEndpointGuards[endpointKey] || (_apiEndpointGuards[endpointKey] = {
    inFlight: false,
    backoffUntil: 0
  })) : null;
  var minGap = options.minGap || 0;
  if (g.inFlight || now < g.backoffUntil || (minGap && now - g.lastAt < minGap) || (eg && (eg.inFlight || now < eg.backoffUntil))) {
    return Promise.resolve(null);
  }
  g.inFlight = true;
  if (eg) eg.inFlight = true;
  g.lastAt = now;
  return fetch(url, fetchOptions).then(function(r){
    if (r.status === 429) {
      var retryAfter = parseInt(r.headers.get('Retry-After') || '0', 10);
      var backoffMs = retryAfter > 0 ? retryAfter * 1000 : (options.backoffMs || 60000);
      var until = Date.now() + backoffMs;
      g.backoffUntil = until;
      if (eg) eg.backoffUntil = until;
      if (isPublicHud) _apiPublicHudBackoffUntil = Math.max(_apiPublicHudBackoffUntil, until);
      return null;
    }
    if (!r.ok) return null;
    return r.json();
  }).catch(function(){
    return null;
  }).finally(function(){
    g.inFlight = false;
    if (eg) eg.inFlight = false;
  });
}
function _clearActiveTimeout(id){
  if(id===null||id===undefined) return;
  for(var i=_activeTimeouts.length-1;i>=0;i--){
    var entry=_activeTimeouts[i];
    if(entry.key===id||(entry.nativeId!==null&&entry.nativeId===id)){
      entry.cleared=true;
      if(entry.nativeId) clearTimeout(entry.nativeId);
      if(entry.visibleHandler) _removePageVisibleHandler(entry.visibleHandler);
      _activeTimeouts.splice(i,1);
    }
  }
}
function _clearActiveInterval(id){
  if(id===null||id===undefined) return;
  for(var i=_activeIntervals.length-1;i>=0;i--){
    var entry=_activeIntervals[i];
    if(entry.key===id||(entry.nativeId!==null&&entry.nativeId===id)){
      entry.cleared=true;
      if(entry.nativeId) clearInterval(entry.nativeId);
      _activeIntervals.splice(i,1);
    }
  }
}
_onPageHidden(_pauseActiveIntervals);
_onPageVisible(_resumeActiveIntervals);

/* ═══════ BUG REPORT BUTTON ALIGNMENT ═══════
   Position the legacy #bugReportBtn 🐛 button (defined near the bottom of
   this file) just to the LEFT of the SECTORS button in the zoom column,
   instead of its old fixed bottom-right corner. The .zc column gets
   dynamic inline styles depending on panel/responsive state so we
   recompute on load + resize + a slow timer (rAF-throttled). */
function alignBugFab(){
  try {
    var fab = document.getElementById('bugReportBtn');
    var sb  = document.getElementById('sectorToggleBtn');
    if (!fab || !sb) return;
    var sr = sb.getBoundingClientRect();
    if (sr.width === 0 || sr.height === 0) return;
    var fw = fab.offsetWidth || 44;
    var fh = fab.offsetHeight || 44;
    var gap = 8;
    var leftPx = Math.max(8, sr.left - gap - fw);
    var topPx  = Math.max(8, sr.top + (sr.height - fh) / 2);
    fab.style.left   = leftPx + 'px';
    fab.style.top    = topPx + 'px';
    fab.style.right  = 'auto';
    fab.style.bottom = 'auto';
  } catch(_) {}
}
var _bugFabAlignTimer = null;
function _scheduleBugFabAlign(){
  if (_bugFabAlignTimer) return;
  _bugFabAlignTimer = requestAnimationFrame(function(){
    _bugFabAlignTimer = null;
    alignBugFab();
  });
}
window.addEventListener('resize', _scheduleBugFabAlign, { passive: true });
window.addEventListener('load',   _scheduleBugFabAlign);
document.addEventListener('DOMContentLoaded', _scheduleBugFabAlign);
_setActiveInterval(_scheduleBugFabAlign, 1500);

/* ═══════ SOUND EFFECTS ENGINE (Web Audio API) ═══════ */
var _audioCtx=null;
function _ensureAudio(){
  if(!_audioCtx) _audioCtx=new (window.AudioContext||window.webkitAudioContext)();
  if(_audioCtx.state==='suspended') _audioCtx.resume();
  return _audioCtx;
}
var _sfx={
  volume:0.2,
  _ok:function(){try{return typeof getNotifSetting==='function'?getNotifSetting('sound'):true}catch(e){return true}},
  _gain:function(v){var ctx=_ensureAudio();var g=ctx.createGain();g.gain.value=(v||0.2)*_sfx.volume;g.connect(ctx.destination);return g},
  click:function(){
    if(!_sfx._ok())return;var ctx=_ensureAudio();var o=ctx.createOscillator();var g=_sfx._gain(0.08);
    o.type='sine';o.frequency.setValueAtTime(1200,ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(800,ctx.currentTime+0.05);
    o.connect(g);o.start(ctx.currentTime);o.stop(ctx.currentTime+0.05);
  },
  claim:function(){
    if(!_sfx._ok())return;var ctx=_ensureAudio();var t=ctx.currentTime;
    var o=ctx.createOscillator();var g=_sfx._gain(0.25);
    o.type='sine';o.frequency.setValueAtTime(400,t);o.frequency.exponentialRampToValueAtTime(1200,t+0.15);
    o.connect(g);g.gain.exponentialRampToValueAtTime(0.001,t+0.3);o.start(t);o.stop(t+0.3);
    var o2=ctx.createOscillator();var g2=_sfx._gain(0.18);
    o2.type='sine';o2.frequency.setValueAtTime(1200,t+0.15);
    o2.connect(g2);g2.gain.exponentialRampToValueAtTime(0.001,t+0.4);o2.start(t+0.15);o2.stop(t+0.4);
  },
  harvest:function(){
    if(!_sfx._ok())return;var ctx=_ensureAudio();var t=ctx.currentTime;
    [880,1100,1320,1760].forEach(function(f,i){
      var o=ctx.createOscillator();var g=_sfx._gain(0.15);
      o.type='sine';o.frequency.value=f;o.connect(g);
      g.gain.exponentialRampToValueAtTime(0.001,t+i*0.06+0.08);
      o.start(t+i*0.06);o.stop(t+i*0.06+0.08);
    });
  },
  hijackWin:function(){
    if(!_sfx._ok())return;var ctx=_ensureAudio();var t=ctx.currentTime;
    [260,330,392,523].forEach(function(f,i){
      var o=ctx.createOscillator();var g=_sfx._gain(0.22);
      o.type='square';o.frequency.value=f;o.connect(g);
      g.gain.exponentialRampToValueAtTime(0.001,t+i*0.08+0.1);
      o.start(t+i*0.08);o.stop(t+i*0.08+0.1);
    });
  },
  hijackFail:function(){
    if(!_sfx._ok())return;var ctx=_ensureAudio();var t=ctx.currentTime;
    var o=ctx.createOscillator();var g=_sfx._gain(0.2);
    o.type='sawtooth';o.frequency.setValueAtTime(150,t);o.frequency.exponentialRampToValueAtTime(60,t+0.2);
    o.connect(g);g.gain.exponentialRampToValueAtTime(0.001,t+0.25);o.start(t);o.stop(t+0.25);
  },
  shield:function(){
    if(!_sfx._ok())return;var ctx=_ensureAudio();var t=ctx.currentTime;
    var o=ctx.createOscillator();var g=_sfx._gain(0.18);
    o.type='sine';o.frequency.setValueAtTime(300,t);o.frequency.exponentialRampToValueAtTime(2400,t+0.15);
    o.connect(g);g.gain.exponentialRampToValueAtTime(0.001,t+0.2);o.start(t);o.stop(t+0.2);
    var o2=ctx.createOscillator();var g2=_sfx._gain(0.1);
    o2.type='triangle';o2.frequency.setValueAtTime(2400,t+0.1);o2.frequency.exponentialRampToValueAtTime(600,t+0.25);
    o2.connect(g2);g2.gain.exponentialRampToValueAtTime(0.001,t+0.3);o2.start(t+0.1);o2.stop(t+0.3);
  },
  notification:function(){
    if(!_sfx._ok())return;var ctx=_ensureAudio();var t=ctx.currentTime;
    var o=ctx.createOscillator();var g=_sfx._gain(0.15);
    o.type='sine';o.frequency.value=880;o.connect(g);
    g.gain.exponentialRampToValueAtTime(0.001,t+0.1);o.start(t);o.stop(t+0.1);
    var o2=ctx.createOscillator();var g2=_sfx._gain(0.15);
    o2.type='sine';o2.frequency.value=1320;o2.connect(g2);
    g2.gain.exponentialRampToValueAtTime(0.001,t+0.2);o2.start(t+0.08);o2.stop(t+0.2);
  },
  purchase:function(){
    if(!_sfx._ok())return;var ctx=_ensureAudio();var t=ctx.currentTime;
    var o=ctx.createOscillator();var g=_sfx._gain(0.15);
    o.type='square';o.frequency.value=1500;o.connect(g);
    g.gain.exponentialRampToValueAtTime(0.001,t+0.04);o.start(t);o.stop(t+0.04);
    var o2=ctx.createOscillator();var g2=_sfx._gain(0.2);
    o2.type='sine';o2.frequency.value=2200;o2.connect(g2);
    g2.gain.exponentialRampToValueAtTime(0.001,t+0.12);o2.start(t+0.04);o2.stop(t+0.12);
    var o3=ctx.createOscillator();var g3=_sfx._gain(0.12);
    o3.type='sine';o3.frequency.value=2640;o3.connect(g3);
    g3.gain.exponentialRampToValueAtTime(0.001,t+0.18);o3.start(t+0.1);o3.stop(t+0.18);
  },
  error:function(){
    if(!_sfx._ok())return;var ctx=_ensureAudio();var t=ctx.currentTime;
    [0,0.12].forEach(function(d){
      var o=ctx.createOscillator();var g=_sfx._gain(0.18);
      o.type='square';o.frequency.value=120;o.connect(g);
      g.gain.exponentialRampToValueAtTime(0.001,t+d+0.08);o.start(t+d);o.stop(t+d+0.08);
    });
  },
  levelUp:function(){
    if(!_sfx._ok())return;var ctx=_ensureAudio();var t=ctx.currentTime;
    [523,659,784,1047].forEach(function(f,i){
      var o=ctx.createOscillator();var g=_sfx._gain(0.2);
      o.type='sine';o.frequency.value=f;o.connect(g);
      g.gain.exponentialRampToValueAtTime(0.001,t+i*0.1+0.15);
      o.start(t+i*0.1);o.stop(t+i*0.1+0.15);
    });
    // Final sustained chord
    var o5=ctx.createOscillator();var g5=_sfx._gain(0.12);
    o5.type='triangle';o5.frequency.value=1047;o5.connect(g5);
    g5.gain.exponentialRampToValueAtTime(0.001,t+0.7);o5.start(t+0.4);o5.stop(t+0.7);
  },
  // [v7.219] 가챠 개봉 충전음 — 상승 rumble (서스펜스 0.7s).
  crateCharge:function(){
    if(!_sfx._ok())return;var ctx=_ensureAudio();var t=ctx.currentTime;
    var o=ctx.createOscillator();var g=_sfx._gain(0.16);
    o.type='sawtooth';o.frequency.setValueAtTime(70,t);
    o.frequency.exponentialRampToValueAtTime(420,t+0.7);
    g.gain.setValueAtTime(0.02,t);g.gain.exponentialRampToValueAtTime(0.18,t+0.62);
    g.gain.exponentialRampToValueAtTime(0.001,t+0.72);
    o.connect(g);o.start(t);o.stop(t+0.72);
  },
  // [v7.219] 개봉 폭발음 — rarity 높을수록 화려(코드 수 차등). tier: 0=common ~ 4=legendary.
  crateBurst:function(tier){
    if(!_sfx._ok())return;var ctx=_ensureAudio();var t=ctx.currentTime;
    tier=Math.max(0,Math.min(4,tier|0));
    // 기본 임팩트 — 하강 노이즈성 폭발
    var o=ctx.createOscillator();var g=_sfx._gain(0.3);
    o.type='square';o.frequency.setValueAtTime(900,t);o.frequency.exponentialRampToValueAtTime(180,t+0.18);
    g.gain.setValueAtTime(0.3,t);g.gain.exponentialRampToValueAtTime(0.001,t+0.25);
    o.connect(g);o.start(t);o.stop(t+0.25);
    // rarity 별 상승 아르페지오 — tier 만큼 음 추가
    var notes=[523,659,784,1047,1319];
    for(var i=0;i<=tier;i++){
      var oo=ctx.createOscillator();var gg=_sfx._gain(0.14);
      oo.type='triangle';oo.frequency.value=notes[i];oo.connect(gg);
      gg.gain.exponentialRampToValueAtTime(0.001,t+0.12+i*0.07+0.18);
      oo.start(t+0.12+i*0.07);oo.stop(t+0.12+i*0.07+0.18);
    }
  }
};

/* ═══════════════════════════════════════════════════════
   OCCUPY MARS — Claim Your Territory (Mars Globe)
   ═══════════════════════════════════════════════════════ */

/* ── Loading Progress System ──────────────────────── */
var _loadPct=0;
var _loadSteps={
  noise:5, craters:10, terrain:25, bump:35, stars:40,
  texture:70, font:75, globe:85, data:92, done:100
};
var _loadLore=[
  // ── TIMELINE: The Fall of Earth ──
  {y:'2089',t:'The Great Collapse begins. Global temperatures hit +4.2°C. Coastal megacities flood within months.'},
  {y:'2091',t:'The Pacific Exodus — 800 million climate refugees flee inland. Resource wars ignite across three continents.'},
  {y:'2094',t:'United Nations dissolves. The last democratic government falls in Oslo. Corporate states rise.'},
  {y:'2097',t:'Project GAIA fails. Earth\'s last geoengineering attempt backfires — the Amazon rainforest burns for 9 months.'},
  {y:'2101',t:'The Oxygen Crisis. Atmospheric O₂ drops below 19%. Outdoor activity requires filtration masks in 40% of the world.'},
  // ── TIMELINE: The Mars Initiative ──
  {y:'2103',t:'Dr. Elena Vasquez proposes the ARES Initiative — humanity\'s last hope. "We don\'t deserve Earth. Maybe we can earn Mars."'},
  {y:'2107',t:'ARES-1 launches from Baikonur with 2,400 colonists. The largest spacecraft ever built. No return trip planned.'},
  {y:'2108',t:'ARES-2 and ARES-3 depart six months apart. Total colonist count: 7,200 souls heading into the void.'},
  {y:'2110',t:'ARES-1 makes landfall at Olympus Mons Basin. First words from Mars: "The soil is red. The sky is home."'},
  {y:'2111',t:'Colony One established. 847 colonists survive the first Martian winter. The rest are buried in red soil.'},
  // ── TIMELINE: The Colony Wars ──
  {y:'2118',t:'The Mineral Rush. Rare Martianium deposits discovered beneath Valles Marineris. Every faction wants control.'},
  {y:'2122',t:'First Sector War. Commander Yuki Tanaka seizes Hellas Basin by force. The age of Governors begins.'},
  {y:'2125',t:'The Hijack Protocol is invented. Raiders develop technology to steal territory claims remotely. No one is safe.'},
  {y:'2129',t:'The Starlink Network goes rogue. Automated satellites begin broadcasting mineral locations to anyone who listens.'},
  {y:'2131',t:'The Cantina opens in Sector 7. A lawless trading post where warriors gamble territory for glory.'},
  // ── TIMELINE: Present Day ──
  {y:'2134',t:'SpaceX Starship "Erebus" suffers RUD over Elysium — scattered debris becomes the first supply loot event.'},
  {y:'2138',t:'Earth goes silent. The last transmission from Houston: "You\'re on your own now. Make it count."'},
  {y:'2141',t:'The Governor\'s Accord — sector leaders agree to tax-based governance. Peace lasts exactly 47 days.'},
  {y:'2149',t:'A massive sandstorm buries Colony Three for two weeks. When it clears, the colony has been hijacked.'},
  {y:'2152',t:'Potato Points (PP) become the universal currency — named after Mark Watney\'s legendary Martian potato farms from the 21st century. The old Earth dollar is worthless. Only Mars resources matter.'},
  {y:'2155',t:'Ancient alien artifacts discovered near the north pole. Their purpose remains unknown. Explorers report strange signals.'},
  {y:'2157',t:'Present day. You arrive on Mars. No welcome party. No instructions. Just red dust and opportunity.'},
  // ── Gameplay Tips ──
  {y:'TIP',t:'Draw a rectangle on Mars to claim land. Bigger = more expensive.'},
  {y:'TIP',t:'Harvest PP from your territory every few hours — don\'t let it cap out.'},
  {y:'TIP',t:'Hijacking costs 1.2x the current land price. Choose targets wisely.'},
  {y:'TIP',t:'Dust storms reduce mining output. Check weather before harvesting.'},
  {y:'TIP',t:'Rocket supply drops contain rare items — first come, first served!'},
  {y:'TIP',t:'Starlink satellites boost PP mining rate when overhead.'},
  {y:'TIP',t:'Governors can set tax rates and activate sector-wide buffs.'},
  {y:'TIP',t:'Solar flares boost mining output — watch for golden weather icons.'},
  {y:'TIP',t:'Polar zones (beyond 70 latitude) are restricted. Claim near the equator.'}
];
// Shuffle lore so each session gets random order
(function(){for(var i=_loadLore.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1));var tmp=_loadLore[i];_loadLore[i]=_loadLore[j];_loadLore[j]=tmp;}})();
var _loadQuotes=_loadLore.map(function(e){return e.y==='TIP'?'TIP: '+e.t:'[ '+e.y+' ]  '+e.t;});
var _loadQuoteIdx=Math.floor(Math.random()*_loadQuotes.length);
var _loadQuoteTimer=_setActiveInterval(function(){
  var el=document.getElementById('loadQuote');
  if(!el) return;
  _loadQuoteIdx=(_loadQuoteIdx+1)%_loadQuotes.length;
  el.style.opacity='0';
  setTimeout(function(){
    if(el){el.textContent=_loadQuotes[_loadQuoteIdx];el.style.opacity='1';}
  },300);
},2200);
(function(){var el=document.getElementById('loadQuote');if(el){el.textContent=_loadQuotes[_loadQuoteIdx];el.style.transition='opacity .3s';}})();
// Load lore from server (override hardcoded if available)
var _loreCrawlData = null;
(function(){
  fetch('/api/lore').then(function(r){return r.json()}).then(function(data){
    if(data.lore && data.lore.length > 0){
      var langKey = 'text_' + (LANG||'en');
      var mapped = data.lore.map(function(e){
        var txt = e[langKey] || e.text_en;
        return e.year==='TIP'?'TIP: '+txt:'[ '+e.year+' ]  '+txt;
      });
      // Shuffle
      for(var i=mapped.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1));var tmp=mapped[i];mapped[i]=mapped[j];mapped[j]=tmp;}
      _loadQuotes = mapped;
      _loadQuoteIdx = 0;
    }
    if(data.crawl && data.crawl.length > 0){
      _loreCrawlData = {};
      data.crawl.forEach(function(c){ _loreCrawlData[c.lang] = c; });
    }
  }).catch(function(){});
})();
function setLoadProgress(pct,msg){
  _loadPct=pct;
  var msgEl=document.getElementById('loadMsg');
  if(msgEl&&msg)msgEl.textContent=msg;
}
function dismissLoader(){
  var el=document.getElementById('loadOverlay');
  if(!el)return;
  _clearActiveInterval(_loadQuoteTimer);
  setLoadProgress(100,'READY');
  setTimeout(function(){
    el.style.opacity='0';
    setTimeout(function(){el.style.display='none';},600);
  },400);
}

setLoadProgress(2,'Initializing...');

// [v7.263 fix] 하드 안전장치 — 로딩 오버레이(z9999, pointer-events:auto)가 어떤 이유로든
//   영구히 화면을 덮어 모든 클릭을 막는 사고를 차단한다. 과거 증상: globe/WebGL init 예외
//   (SW 업데이트 후 stale globe.gl·텍스처, 컨텍스트 손실 등) → _doInitGlobe 내부 throw →
//   그 뒤에 등록되던 8s fallback 이 실행 안 됨 → 로더가 95%에서 고착 → "버튼 안 눌림".
//   이 타이머는 어떤 init 예외와도 독립적으로 최상위에서 무조건 등록되어 오버레이를 해제한다.
setTimeout(function(){
  try {
    if (typeof _loadPct === 'undefined' || _loadPct < 100) {
      if (typeof dismissLoader === 'function') dismissLoader();
    }
  } catch(_) {}
  // 최후 안전망: dismissLoader 가 없거나 실패해도 오버레이를 강제로 클릭 불가 처리.
  var _el = document.getElementById('loadOverlay');
  if (_el && getComputedStyle(_el).display !== 'none') { _el.style.opacity='0'; _el.style.pointerEvents='none'; setTimeout(function(){ try{ _el.style.display='none'; }catch(_){} }, 650); }
}, 8000);
