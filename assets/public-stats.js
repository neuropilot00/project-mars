/* ── Live Stats & Leaderboard from API ───────────── */
function fmtNum(n){return Number(n).toLocaleString();}

var _publicStatsRetryTimer = null;
var _leaderboardRetryTimer = null;

function _publicHudDelay(extraMs) {
  var quietMs = (typeof _publicHudQuietRemainingMs === 'function') ? _publicHudQuietRemainingMs() : 0;
  return Math.max(0, quietMs) + (extraMs || 0);
}

function _schedulePublicStatsRetry(delay) {
  if (_publicStatsRetryTimer) return;
  _publicStatsRetryTimer = _setActiveTimeout(function(){
    _publicStatsRetryTimer = null;
    loadPublicStats();
  }, _publicHudDelay(delay == null ? 5000 : delay));
}

function _scheduleLeaderboardRetry(delay) {
  if (_leaderboardRetryTimer) return;
  _leaderboardRetryTimer = _setActiveTimeout(function(){
    _leaderboardRetryTimer = null;
    loadLeaderboard();
  }, _publicHudDelay(delay == null ? 7000 : delay));
}

function loadPublicStats(){
  if (!_pageIsActive()) return;
  if (typeof _publicHudQuietRemainingMs === 'function' && _publicHudQuietRemainingMs() > 0) {
    _schedulePublicStatsRetry(250);
    return;
  }
  _guardedJsonFetch('public-stats', '/api/stats', {minGap:25000, backoffMs:90000}).then(function(d){
    if (!d) { _schedulePublicStatsRetry(15000); return; }
    var setT=function(id,val){var el=document.getElementById(id);if(el)el.textContent=val;};
    if(d.totalPixels!=null){ setT('statTotalPx',fmtNum(d.totalPixels)); setT('bsStatTotalPx',fmtNum(d.totalPixels)); }
    if(d.totalPixelsSold!=null){ setT('statPlots',fmtNum(d.totalPixelsSold)); setT('bsStatPlots',fmtNum(d.totalPixelsSold)); }
    if(d.totalVolume!=null){ setT('statTVL','$'+fmtNum(d.totalVolume)); setT('bsStatTVL','$'+fmtNum(d.totalVolume)); }
    if(d.hijacksPerHour!=null){ setT('statHijacks',fmtNum(d.hijacksPerHour)); setT('bsStatHijacks',fmtNum(d.hijacksPerHour)); }
    if(d.activeUsers24h!=null){ setT('statActiveUsers',fmtNum(d.activeUsers24h)); setT('bsStatActiveUsers',fmtNum(d.activeUsers24h)); }
  }).catch(function(e){console.warn('[Stats] fetch failed:',e);});
}

function loadLeaderboard(){
  if (!_pageIsActive()) return;
  if (typeof _publicHudQuietRemainingMs === 'function' && _publicHudQuietRemainingMs() > 0) {
    _scheduleLeaderboardRetry(750);
    return;
  }
  _guardedJsonFetch('leaderboard-pixels', '/api/leaderboard?sort=pixels&limit=10', {minGap:30000, backoffMs:90000}).then(function(arr){
    if (!arr) { _scheduleLeaderboardRetry(20000); return; }
    var container=document.getElementById('leaderboardList');
    var bsContainer=document.getElementById('bsLeaderboardList');
    if(!Array.isArray(arr)||arr.length===0){
      var empty='<div style="font-size:var(--fs-xs);color:var(--tx3);padding:8px 0;text-align:center">'+tl('No claims yet','아직 점령 없음','まだ占領なし','暂无领地')+'</div>';
      if(container){ container.innerHTML=empty; var tg=document.getElementById('lbToggle'); if(tg) tg.style.display='none'; }
      if(bsContainer) bsContainer.innerHTML=empty;
      return;
    }
    var rankClasses=['gold','silver','bronze'];
    var html='';
    var bsHtml='';
    arr.forEach(function(entry,i){
      var rank=i+1;
      var rankCls=rankClasses[i]||'';
      var rankStyle=rankCls?'':' style="color:var(--tx3)"';
      var name=entry.nickname||entry.wallet;
      if(!entry.nickname&&name&&name.length>10) name=name.slice(0,6)+'..'+name.slice(-4);
      var px=entry.pixelCount||0;
      var hide=i>=3?' style="display:none" class="lb-row lb-extra"':' class="lb-row"';
      html+='<div'+hide+'><span class="lb-rank'+(rankCls?' '+rankCls:'')+'"'+rankStyle+'>'+rank+'</span>'
        +'<span class="lb-name">'+name+'</span>'
        +'<span class="lb-val">'+fmtNum(px)+' px</span></div>';
      // Base season mirror (no hide)
      var medal=i===0?'🥇':i===1?'🥈':i===2?'🥉':('#'+rank);
      bsHtml+='<div style="display:flex;align-items:center;gap:6px;padding:4px 6px;margin-bottom:3px;background:rgba(255,255,255,.03);border-radius:4px;font-size:9px">'
        +'<span style="width:22px;color:'+(i<3?'var(--gold)':'var(--tx3)')+';font-weight:700">'+medal+'</span>'
        +'<span style="flex:1;color:var(--tx2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+name+'</span>'
        +'<span style="color:var(--gn);font-family:var(--fn)">'+fmtNum(px)+' px</span>'
        +'</div>';
    });
    if(container){
      container.innerHTML=html;
      var toggle=document.getElementById('lbToggle');
      if(toggle) toggle.style.display=arr.length>3?'block':'none';
    }
    if(bsContainer) bsContainer.innerHTML=bsHtml;
  }).catch(function(e){console.warn('[Leaderboard] fetch failed:',e);});
}
var _lbExpanded=false;
function toggleLeaderboard(){
  _lbExpanded=!_lbExpanded;
  var extras=document.querySelectorAll('#leaderboardList .lb-extra');
  extras.forEach(function(el){el.style.display=_lbExpanded?'flex':'none'});
  var toggle=document.getElementById('lbToggle');
  if(toggle) toggle.innerHTML=_lbExpanded?('▲ '+tl('TOP','상위','トップ','前')+' 3'):('▼ '+tl('TOP','상위','トップ','前')+' 10');
}

setLoadProgress(95,'Loading stats...');
_schedulePublicStatsRetry(1000);
_scheduleLeaderboardRetry(2200);
_setActiveInterval(loadPublicStats,30000);
_setActiveInterval(loadLeaderboard,60000);
// Poll referral info periodically so commission toasts fire in real time
_setActiveInterval(function(){
  if(walletState.connected && walletState.address){
    try{ loadReferralInfo(); }catch(e){}
  }
}, 45000);
