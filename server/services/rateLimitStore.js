// server/services/rateLimitStore.js
// express-rate-limit v7 용 ioredis 기반 공유 Store (멀티 인스턴스 전역 레이트리밋).
//   REDIS_URL 미설정 / ioredis 미설치 → makeLimiterStore() 가 undefined 반환 →
//   express-rate-limit 는 기본 MemoryStore 로 폴백(현 단일 인스턴스 동작).
// rate-limit-redis 는 express-rate-limit 버전 peer 충돌이 있어 직접 구현.
let _client = null, _tried = false;
function _getClient() {
  if (_tried) return _client;
  _tried = true;
  if (!process.env.REDIS_URL) return null;
  try {
    const Redis = require('ioredis');
    _client = new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: 2, enableOfflineQueue: false });
    _client.on('error', () => {}); // 오류 시에도 프로세스 죽지 않게
    console.log('[ratelimit] Redis 공유 스토어 활성');
  } catch (e) {
    console.warn('[ratelimit] ioredis 미설치 — 메모리 스토어 폴백:', e.message);
    _client = null;
  }
  return _client;
}

// express-rate-limit v7 Store 인터페이스: init / increment / decrement / resetKey
class RedisRateStore {
  constructor(prefix) {
    this.prefix = 'rl:' + (prefix || 'x') + ':';
    this.windowMs = 60000;
    this.client = _getClient();
  }
  init(opts) { if (opts && opts.windowMs) this.windowMs = opts.windowMs; }
  async increment(key) {
    const k = this.prefix + key;
    // INCR (원자적). 첫 히트면 윈도우 TTL 설정.
    const totalHits = await this.client.incr(k);
    if (totalHits === 1) { try { await this.client.pexpire(k, this.windowMs); } catch (_) {} }
    let ttl = -1;
    try { ttl = await this.client.pttl(k); } catch (_) {}
    if (ttl < 0) { ttl = this.windowMs; try { await this.client.pexpire(k, this.windowMs); } catch (_) {} }
    return { totalHits, resetTime: new Date(Date.now() + ttl) };
  }
  async decrement(key) { try { await this.client.decr(this.prefix + key); } catch (_) {} }
  async resetKey(key) { try { await this.client.del(this.prefix + key); } catch (_) {} }
}

// Redis 사용 가능하면 prefix별 store 인스턴스, 아니면 undefined(메모리 폴백).
function makeLimiterStore(prefix) {
  const c = _getClient();
  if (!c) return undefined;
  return new RedisRateStore(prefix);
}

module.exports = { makeLimiterStore };
