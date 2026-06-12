// ── DOMContentLoaded: 랜딩 + 온보딩 트리거 ──
document.addEventListener('DOMContentLoaded', function() {
  _setActiveTimeout(showBetaNoticeOnce, 400);  // 첫 진입 1회 베타 고지 (랜딩 위에 먼저 노출)
  _setActiveTimeout(checkLandingOverlay, 800);
  // Delay chat/feed polling so Globe.GL WebGL initialisation gets the first
  // ~8 seconds of network+CPU budget without competing fetch requests.
  // Chat: 8s cold start, then every 5s. Feed: 12s cold start, then every 10s.
  _setActiveTimeout(startChatPolling, 8000);
  _setActiveTimeout(startFeedPolling, 12000);
  _setActiveTimeout(connectLiveWS, 9000);  // 실시간 푸시 (채팅/피드) — 폴링과 병행, 끊겨도 폴링 폴백
  if (typeof isLoggedIn === 'function' && isLoggedIn()) {
    _setActiveTimeout(runOnboardingCheck, 2000);
  }
});
