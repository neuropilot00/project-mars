// Bump CACHE_NAME on every UI/CSS-affecting deploy so old caches (with stale
// index.html) are wiped on next visit via the 'activate' event.
// 2026-04-25 v4: 모바일 사이드바 z-index/태블릿 breakpoint, 토스트 통합, 하이잭 미리보기
// 2026-05-01 v5: 캠페인 480장 Imagen 4 Ultra 신규 PNG — 옛 image cache 무효화 필수
// 2026-05-02 v6: 캠페인 배경 184장 Codex gpt-image-1 전면 재생성 (gritty cinematic sci-fi, 9:16/1:1 portrait)
// 2026-05-02 v7: campaign backgrounds → network-first (cache-first로 구 이미지 고착 문제 해소)
// 2026-05-02 v8: campaign asset fetch uses cache:reload to bypass HTTP cache too.
// 2026-05-11 v9: 모바일/데스크탑 nav 아이템 버튼 BASE 내 아이템 탭으로 직접 라우팅 — 옛 캐시 무효화.
// 2026-05-27 v10: 정적 에셋 핸들러가 500/404 응답까지 cache.put 하던 버그 수정.
//   NASA 화성 텍스처(mars_nasa_2k.jpg)가 일시적 500을 받은 뒤 SW가 그 500을 영구 캐시 →
//   cache-first 라 매번 깨진 500을 반환 → 프로시저럴 텍스처로 폴백되던 문제. v10 으로 올려
//   activate 시 오염된 v9 캐시를 전부 삭제하고, 이제 2xx 응답만 캐시한다.
// 2026-05-28 v11: /assets/base/ 와 /assets/banners/ 도 network-first 로 전환.
//   BASE 모달 배너(fleet/pvp/governance 등) 실사풍 재생성 후에도 cache-first 에 막혀
//   사용자 화면이 옛 픽셀아트로 고착되던 문제. v10 cache 전체 폐기 + 배너 경로 fresh fetch.
// 2026-05-28 v12: 신규 시각 업그레이드 폴더 추가(/assets/loading/, /factions/, /poi/, /login_bg/).
//   v7.175 시각 업그레이드 라운드 — 신규 에셋이 cache-first 에 잡히지 않게 동일 정책.
// 2026-05-28 v13: /assets/fx/ 전투 VFX (폭발/임팩트) network-first 등록.
// 2026-05-28 v14: tactical-lab-v11.html (VFX v7.179~v7.190) 가 옛 캐시에 가려 사용자가 못 봄 — 캐시 전면 폐기.
// 2026-05-28 v15: v7.192~v7.194 daily mission claim 자동 갱신 / forge ⭐ UI / wash-trade / dead endpoint 410 — index.html 강제 새로고침.
// 2026-05-28 v16: v7.195 오늘의 추천 카드 제거 — 좌측 컬럼 3개 → 캠페인/가챠/(zb 컬럼).
// 2026-05-28 v17: v7.196 한국어 "함선 상자" → "함선 가챠" 통일.
// 2026-05-28 v18: v7.197 tactical-lab 라이브 버전 표시 (제목 "v11.1 + VFX v7.196") + iframe URL Date.now() — 캐시 확실 폐기.
// 2026-05-28 v19: v7.198 영토 업그레이드 모달 정보 풍부화 + HP 패널 헤더 표시 + 에러 처리.
// 2026-05-28 v20: v7.199 데탑 캠페인/가챠 버튼 width 명시 (stretch 차단).
// 2026-05-28 v21: v7.200 영토 업그레이드 외부 try-catch + event.stopPropagation + console.error/alert 진단.
// 2026-05-29 v22: v7.201 옛 버전 자동 unregister + inline button alert + no-cache meta.
// 2026-05-29 v23: v7.202 모바일 영토 업그레이드 — mobTerritoryModal '🔧 업그레이드' 클릭 시 panel-r 강제 open.
// 2026-05-29 v24: v7.203 BASE > 내 영토 카드에 HP/등급 + TEND 버튼 표시.
// 2026-05-29 v25: v7.204 CRITICAL — 신규 가입 PP 보너스 100→0 + 추천 PP 150→0 (USDT 1:1 mint 차단).
// 2026-05-29 v26: v7.205 영토 업그레이드 전용 모달 — 사이드바 슬라이드 인 폐기, 모바일/데스크탑 통일.
// 2026-05-29 v27: v7.206 데스크탑도 영토 클릭 시 모달 — 사이드 패널 슬라이드 폐기.
// 2026-05-29 v28: v7.207 영토 모달 정보 풍부화(HP/생산/섹터/광물) + 버튼 컴팩트 + 업그레이드 모달 z-index 조정.
// 2026-05-29 v29: v7.208 '2번 로딩' 픽스 — v7.201 self-heal 제거 + 첫 SW 등록 시 reload 안 함.
// 2026-05-29 v30: v7.209 영토 업그레이드 트랙 상한 4 → 5 (5번째 트랙 막혀 있던 버그).
// 2026-05-29 v31: v7.210 좌측 컬럼 위치 아래로 + 🐛 버그신고 zc 컬럼 안으로 이동.
// 2026-05-29 v32: v7.211 주간 진척도 시인성 + 칭호 장착 onclick fix (data-* delegated).
// 2026-05-29 v33: v7.212 모바일 캠페인/가챠/🐛 위치 원복 (데스크탑만 변경 유지).
// 2026-05-29 v34: v7.213 업그레이드 모달 자동 갱신 + 중복 클릭 가드.
// 2026-05-29 v35: v7.214 inline onclick 회귀 3차 마이그 (tdesc/AI fight/replay) + 카탈로그 disabled + CLAUDE.md §19 + pre-commit hook.
// 2026-05-29 v36: v7.215 iOS phantom-click 가드 (350ms) + campaignProfileModal inner stopPropagation.
// 2026-05-29 v37: v7.219 가챠 개봉 서스펜스 연출(박스 흔들림→빛 폭발) + crateCharge/Burst 사운드.
// 2026-05-29 v38: v7.220 Daily Streak 48h 유예 (하루 놓쳐도 streak 유지) + grace 안내.
// 2026-05-29 v39: v7.221 함대전 AI 리매치 훅 (결과 카드 → 같은 상대 즉시 재도전).
// 2026-05-29 v40: v7.222 생산 배수 시각화(#4) + 캠페인 진행률 바(#5).
// 2026-05-29 v41: v7.223 로딩 배경 영상(데스크탑) + v7.175 시각자산 15개 git 복구(allowlist 누락 수정).
// 2026-05-29 v42: v7.224 로딩 배경 영상 4종 랜덤(load_loop_01~04).
// 2026-05-29 v43: v7.225 모바일 세로 로딩 영상 3종(load_loop_v01~03) — 데스크탑 가로 4종과 분기.
// 2026-05-29 v47: v7.229 함대전 박력 강화 — 발사 머즐 플래시 + 빔/폭발 강화 + 대형함 격침 히트스톱(타격감).
// 2026-05-29 v48: v7.230 로딩 영상 frozen Mars 3번째 추가(load_loop_03/v03) + 가챠 레전더리 전용 영상(gacha_reveal_legendary).
// 2026-05-29 v49: v7.231 가챠 레전더리 모바일 세로 전용 영상(gacha_reveal_legendary_v) — 데/모 분기.
// 2026-05-29 v50: v7.233 가챠 영상 4종 전부 레전더리 풀로 통합 + 티어별 영상 매핑 구조(준비된 티어만 재생).
// 2026-05-29 v51: v7.234 에픽 가챠 리빌 영상(gacha_reveal_epic/_v, 보라 상자·대형 순양함) — tier 3 연결.
// 2026-05-29 v52: v7.235 레어 가챠 리빌 영상(gacha_reveal_rare/_v, 파랑 상자·중형 구축함) — tier 2 연결.
// 2026-05-29 v53: v7.236 언커먼 가챠 리빌 영상(gacha_reveal_uncommon/_v, 초록 상자·소형 프리깃) — tier 1 연결.
// 2026-05-29 v54: v7.237 커먼 가챠 리빌 영상(gacha_reveal_common/_v, 회색 상자·소형 정찰기) — tier 0 연결, 5티어 전부 영상 완성.
// 2026-05-29 v55: v7.238 가챠/하이젝 리빌 영상 우측 상단 명시적 SKIP 버튼 추가 (텍스트만 있던 것 → 또렷한 버튼).
// 2026-05-29 v56: v7.239 가챠/하이젝 영상 원본 오디오 복원 — -an 무음 인코딩 제거(AAC 96k), 플레이어 unmute, WebAudio "방구소리" _sfx 제거.
// 2026-05-29 v57: v7.244 공성 패널 결전 함대 합류(JOIN 공격/수비)+로스터+관전 UI (siege 우주 자족, data-action delegated).
// 2026-05-29 v58: v7.248 라이브 UX — 합류 전 full-loss 경고(무손실 점유율 대안 안내) + ACTIVE SIEGE 헤더 resolution_mode 배지.
const CACHE_NAME = 'mars-v58';
const STATIC_ASSETS = [
  '/',
  '/manifest.json'
];
// NOTE: '/index.html' is intentionally NOT pre-cached. The fetch handler below
// uses NETWORK-FIRST for HTML documents so layout/JS fixes deploy immediately.

// Install: pre-cache core assets
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// Allow page to force activation of waiting SW (used by index.html updatefound flow)
self.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});

// Activate: clean up old caches
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch: network-first for API + HTML, cache-first for static assets
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  // Cache API only supports GET. Skip SW logic for non-GET (POST/PUT/DELETE etc.)
  if (e.request.method !== 'GET') return;

  // Network-first for API calls — only cache 2xx so 404/5xx never get cached
  if (url.pathname.startsWith('/api/')) {
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          if (res && res.ok && res.status >= 200 && res.status < 300) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone)).catch(() => {});
          }
          return res;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  // ── Network-first for HTML documents (index.html, /, /admin) ──
  // 이전엔 cache-first로 잡혔다가 stale UI(사이드바/토스트 옛 버전)가 iOS 사용자에게 남아 있었음.
  // HTML은 항상 fresh하게 받아오고, 오프라인에서만 cache fallback.
  const isHtml = e.request.destination === 'document'
              || url.pathname === '/'
              || url.pathname === '/index.html'
              || url.pathname === '/admin'
              || url.pathname === '/admin.html'
              || url.pathname.endsWith('.html');
  if (isHtml) {
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          if (res && res.ok) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone)).catch(() => {});
          }
          return res;
        })
        .catch(() => caches.match(e.request).then((c) => c || caches.match('/')))
    );
    return;
  }

  // Network-first for campaign assets (AI 재생성으로 자주 교체됨 — cache-first 금지)
  // [v7.173 SW-fix] /assets/base/ (BASE 모달 9 배너) + /assets/banners/ (가챠 5 배너)도
  //   같은 정책. 실사풍 재생성 후 cache-first 에 막혀 옛 픽셀아트 고착되던 문제 차단.
  if (url.pathname.startsWith('/assets/campaign/') ||
      url.pathname.startsWith('/assets/base/') ||
      url.pathname.startsWith('/assets/banners/') ||
      url.pathname.startsWith('/assets/loading/') ||      // [v7.175 SW] 로딩 스크린 새 폴더
      url.pathname.startsWith('/assets/factions/') ||     // [v7.175 SW] 파벌 일러스트
      url.pathname.startsWith('/assets/poi/') ||          // [v7.175 SW] POI 마커
      url.pathname.startsWith('/assets/login_bg/') ||     // [v7.175 SW] 로그인 배경
      url.pathname.startsWith('/assets/fx/')) {           // [v7.180 SW] 전투 VFX (폭발/임팩트)
    e.respondWith(
      fetch(new Request(e.request, { cache: 'reload' }))
        .then((res) => {
          if (res && res.ok) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone)).catch(() => {});
          }
          return res;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  // Cache-first for static assets (images, CSS, JS)
  if (e.request.destination === 'image' ||
      e.request.destination === 'style' ||
      e.request.destination === 'script' ||
      url.pathname.match(/\.(png|jpg|jpeg|webp|gif|svg|ico|css|js|woff2?)$/)) {
    e.respondWith(
      caches.match(e.request).then((cached) => {
        if (cached) return cached;
        return fetch(e.request).then((res) => {
          // Only cache successful 2xx responses — never poison the cache with
          // 4xx/5xx (a transient 500 on an image used to get stuck forever).
          if (res && res.ok && res.status >= 200 && res.status < 300) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone)).catch(() => {});
          }
          return res;
        }).catch(() => cached);
      })
    );
    return;
  }

  // Default: network with cache fallback
  e.respondWith(
    fetch(e.request)
      .catch(() => caches.match(e.request))
      .then((res) => res || caches.match('/'))
  );
});
