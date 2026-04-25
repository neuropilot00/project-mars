// Bump CACHE_NAME on every UI/CSS-affecting deploy so old caches (with stale
// index.html) are wiped on next visit via the 'activate' event.
// 2026-04-25 v4: 모바일 사이드바 z-index/태블릿 breakpoint, 토스트 통합, 하이젝 미리보기
const CACHE_NAME = 'mars-v4';
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

  // Cache-first for static assets (images, CSS, JS)
  if (e.request.destination === 'image' ||
      e.request.destination === 'style' ||
      e.request.destination === 'script' ||
      url.pathname.match(/\.(png|jpg|jpeg|gif|svg|ico|css|js|woff2?)$/)) {
    e.respondWith(
      caches.match(e.request).then((cached) => {
        if (cached) return cached;
        return fetch(e.request).then((res) => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone));
          return res;
        });
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
