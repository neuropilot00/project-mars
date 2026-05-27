// server/services/rateLimitStore.js
// express-rate-limit v7 용 ioredis 기반 공유 Store (멀티 인스턴스 전역 레이트리밋).
//   REDIS_URL 미설정 / ioredis 미설치 → makeLimiterStore() 가 undefined 반환 →
//   express-rate-limit 는 기본 MemoryStore 로 폴백(현 단일 인스턴스 동작).
// rate-limit-redis 는 express-rate-limit 버전 peer 충돌이 있어 직접 구현.
// INCR + (첫 히트/TTL 없음 시) PEXPIRE + PTTL 을 원자 실행. [totalHits, ttlMs] 반환.
const LUA_INCR = "local n = redis.call('INCR', KEYS[1]) " +
  "if n == 1 or redis.call('PTTL', KEYS[1]) < 0 then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end " +
  "return {n, redis.call('PTTL', KEYS[1])}";
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
    // Lua 원자화: INCR + (첫 히트거나 TTL 없으면) PEXPIRE + PTTL 반환을 1 RTT 원자 실행.
    // 기존 INCR→PEXPIRE 분리 호출의 레이스(크래시 시 TTL 누락 → 키 영구 잔존)를 제거.
    try {
      const res = await this.client.eval(LUA_INCR, 1, k, String(this.windowMs));
      const totalHits = Array.isArray(res) ? Number(res[0]) : Number(res);
      let ttl = Array.isArray(res) ? Number(res[1]) : this.windowMs;
      if (!(ttl > 0)) ttl = this.windowMs;
      return { totalHits, resetTime: new Date(Date.now() + ttl) };
    } catch (e) {
      // Redis 장애 시 fail-open: 이 요청은 카운트 0으로 통과시킨다(전 API 500 방지).
      // express-rate-limit 의 passOnStoreError 와 함께 가용성 우선.
      return { totalHits: 0, resetTime: new Date(Date.now() + this.windowMs) };
    }
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
