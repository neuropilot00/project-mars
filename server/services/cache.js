// server/services/cache.js
// ─────────────────────────────────────────────────────────────
// KV 캐시 추상화 — 수평 확장 대비.
//   REDIS_URL 이 설정되고 ioredis 가 설치돼 있으면 Redis(인스턴스 간 공유),
//   아니면 인메모리 Map(단일 인스턴스) 으로 graceful 폴백한다.
//
// 멀티 인스턴스로 확장할 때:
//   1) Redis 프로비저닝(Railway Redis 등) 후 REDIS_URL 설정
//   2) `npm i ioredis`
//   → 코드 변경 없이 자동으로 Redis 모드 전환.
//
// 사용:
//   const { cacheGet, cacheSet, cacheDel, cacheMode } = require('./cache');
//   await cacheSet('key', {a:1}, 30);  // TTL 30초
//   const v = await cacheGet('key');
// ─────────────────────────────────────────────────────────────

let _redis = null;
let _mode = 'memory';
const _mem = new Map(); // key -> { v, exp(ms, 0=무기한) }

(function init() {
  if (process.env.REDIS_URL) {
    try {
      const Redis = require('ioredis'); // 미설치 시 throw → 폴백
      _redis = new Redis(process.env.REDIS_URL, { family: 0, maxRetriesPerRequest: 2, enableOfflineQueue: false });
      _redis.on('error', () => { /* 연결 오류 시에도 인메모리 폴백 경로가 동작 */ });
      _mode = 'redis';
      console.log('[cache] Redis mode (REDIS_URL set)');
    } catch (e) {
      _redis = null; _mode = 'memory';
      console.warn('[cache] ioredis 미설치/초기화 실패 — 인메모리 폴백:', e.message);
    }
  } else {
    console.log('[cache] in-memory mode (REDIS_URL 미설정 — 단일 인스턴스)');
  }
})();

async function cacheGet(key) {
  if (_redis) {
    try { const v = await _redis.get(key); if (v != null) return JSON.parse(v); } catch (_) {}
  }
  const e = _mem.get(key);
  if (!e) return null;
  if (e.exp && e.exp < Date.now()) { _mem.delete(key); return null; }
  return e.v;
}

async function cacheSet(key, val, ttlSec) {
  if (_redis) {
    try {
      const s = JSON.stringify(val);
      if (ttlSec) await _redis.set(key, s, 'EX', ttlSec); else await _redis.set(key, s);
      return;
    } catch (_) {}
  }
  _mem.set(key, { v: val, exp: ttlSec ? Date.now() + ttlSec * 1000 : 0 });
}

async function cacheDel(key) {
  if (_redis) { try { await _redis.del(key); } catch (_) {} }
  _mem.delete(key);
}

function cacheMode() { return _mode; }

// 실제 Redis 연결 상태 점검 (모니터링/배포 검증용).
//   'off'  = REDIS_URL 미설정(인메모리 모드)
//   'ok'   = Redis 연결 + PING 응답
//   'down' = REDIS_URL 설정됐으나 PING 실패(연결 끊김)
async function cachePing() {
  if (!_redis) return 'off';
  try { const r = await _redis.ping(); return r === 'PONG' ? 'ok' : 'down'; }
  catch (_) { return 'down'; }
}

module.exports = { cacheGet, cacheSet, cacheDel, cacheMode, cachePing };
