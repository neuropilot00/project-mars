// Service Worker — silent update strategy (no auto-reload, no double-load).
// HTML 은 network-first 라 다음 자연스러운 nav/refresh 에 새 콘텐츠가 자동 적용됨.
// 사용자에게 보이지 않게 background 에서 SW 업데이트만 처리.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').then(function(reg){
    if (!reg) return;
    // 새 worker 가 install 끝나면 즉시 활성화 — 사용자에게 reload 강제 안 함
    reg.addEventListener('updatefound', function(){
      var nw = reg.installing;
      if (!nw) return;
      nw.addEventListener('statechange', function(){
        if (nw.state === 'installed') {
          try { nw.postMessage({ type: 'SKIP_WAITING' }); } catch(_) {}
        }
      });
    });
    // 1시간마다 SW update 체크 (긴 세션 사용자 대응 — 새 sw.js 가 있으면 다음 nav 시 적용)
    _setActiveInterval(function(){ try { reg.update(); } catch(_) {} }, 60 * 60 * 1000);
  }).catch(function(){});
  // [v7.263 fix] 완전 silent 업데이트 — controllerchange 시 강제 reload 안 함.
  //   기존엔 새 sw.js 배포 시 복귀 유저에게 controllerchange→location.reload() 가 발생해
  //   "로딩 두 번 + 화면 겹침"을 유발했다(주석은 silent 라면서 실제론 reload 했음 — 모순 해소).
  //   HTML 은 network-first 라 다음 자연스러운 새로고침/이동에서 새 콘텐츠가 자동 적용된다.
  navigator.serviceWorker.addEventListener('controllerchange', function() {
    /* no-op: silent update — 다음 nav 에서 새 버전 자동 반영. 강제 reload 없음. */
  });
}
