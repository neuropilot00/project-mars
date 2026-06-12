// ── DOMContentLoaded: 랜딩 + 온보딩 트리거 ──
document.addEventListener('DOMContentLoaded', function() {
  _setActiveTimeout(showBetaNoticeOnce, 400);  // 첫 진입 1회 베타 고지 (랜딩 위에 먼저 노출)
  _setActiveTimeout(checkLandingOverlay, 800);
  // Delay chat/feed polling so Globe.GL WebGL initialisation gets the first
  // ~8 seconds of network+CPU budget without competing fetch requests.
  // Chat/feed use WebSocket push first, with slow polling as fallback.
  _setActiveTimeout(function(){ try{ startSocialLive(); }catch(_){} }, 10000);
  if (typeof isLoggedIn === 'function' && isLoggedIn()) {
    _setActiveTimeout(runOnboardingCheck, 2000);
  }
});
