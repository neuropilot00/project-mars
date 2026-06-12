// [v7.175 Task 3a] 로딩 배경 6종 중 랜덤 1장 — 이미지 로드 성공 시에만 fade-in (실패 시 단색 폴백 유지).
(function(){
  try {
    var n = 1 + Math.floor(Math.random()*6);
    var pad = (n < 10 ? '0' : '') + n;
    var img = new Image();
    img.onload = function(){
      var bg = document.getElementById('loadBg');
      if (bg) { bg.style.backgroundImage = 'url("/assets/loading/load_'+pad+'.jpg")'; bg.style.opacity = '0.55'; }
    };
    img.src = '/assets/loading/load_'+pad+'.jpg';
    // [v7.230] 로딩 배경 영상 — 3종 콘텐츠(deep_space/drift/frozen_mars)를 비율별로. 데스크탑 가로 3종, 모바일 세로 3종.
    var vid = document.getElementById('loadVideo');
    if (vid) {
      if (window.innerWidth > 768) {
        var vn = 1 + Math.floor(Math.random()*3); // 가로 load_loop_01~03
        vid.src = '/assets/loading/load_loop_0'+vn+'.mp4';
      } else {
        var vvn = 1 + Math.floor(Math.random()*3); // 세로 load_loop_v01~03
        vid.src = '/assets/loading/load_loop_v0'+vvn+'.mp4';
      }
      vid.addEventListener('canplay', function(){ vid.style.opacity = '0.6'; }, { once:true });
      var pp = vid.play(); if (pp && pp.catch) pp.catch(function(){});
    }
  } catch(_) {}
})();
