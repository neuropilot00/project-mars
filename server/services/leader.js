// server/services/leader.js
// ─────────────────────────────────────────────────────────────
// 스케줄러/온체인 입금 리스너 단일 실행 보장 (멀티 인스턴스 leader election).
//
// 결정 규칙:
//   - RUN_SCHEDULERS=false 명시  → 절대 실행 안 함(순수 web 인스턴스).
//   - REDIS_URL 있음             → Redis 리더 락(SET NX PX)으로 "정확히 1개" 자동 선출.
//                                  락 보유 인스턴스만 스케줄러 실행, 10초 하트비트 갱신.
//                                  락 상실 감지 시 process.exit(1) → 오케스트레이터 재시작 →
//                                  재경합(자동 페일오버). 워커 0개/2개+ 사고를 코드로 차단.
//   - REDIS_URL 없음             → true(단일 인스턴스 기본, 기존 동작).
//
// 이전의 honor-based RUN_SCHEDULERS env 단독 의존을 대체(팀+Codex 교차검수 CRITICAL 반영).
// ─────────────────────────────────────────────────────────────
const crypto = require('crypto');

const LOCK_KEY = 'om:scheduler:leader';
const TTL_MS = 30000;
const RENEW_MS = 10000;

const INSTANCE_ID = (process.env.INSTANCE_ID || '') + '-' + crypto.randomBytes(4).toString('hex') + '-' + process.pid;

// 내 소유일 때만 갱신, 아니면 0 (소유권 상실 감지)
const LUA_RENEW = "if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('PEXPIRE', KEYS[1], ARGV[2]) else return 0 end";

let _isLeader = false;
function isLeader() { return _isLeader; }
function instanceId() { return INSTANCE_ID; }

async function shouldRunSchedulers() {
  // 명시적 opt-out
  if (process.env.RUN_SCHEDULERS === 'false') {
    console.log('[leader] RUN_SCHEDULERS=false — 스케줄러 미실행 (순수 web 인스턴스)');
    return false;
  }
  // Redis 없으면 단일 인스턴스 기본 동작
  if (!process.env.REDIS_URL) {
    console.log('[leader] REDIS_URL 미설정 — 단일 인스턴스로 스케줄러 실행');
    _isLeader = true;
    return true;
  }
  // Redis 리더 락 경합
  let Redis;
  try { Redis = require('ioredis'); }
  catch (e) {
    console.warn('[leader] ioredis 미설치 — RUN_SCHEDULERS env 기준으로 폴백');
    _isLeader = (process.env.RUN_SCHEDULERS !== 'false');
    return _isLeader;
  }
  const redis = new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: 3 });
  redis.on('error', () => {});
  try {
    const ok = await redis.set(LOCK_KEY, INSTANCE_ID, 'NX', 'PX', TTL_MS);
    if (ok !== 'OK') {
      const holder = await redis.get(LOCK_KEY).catch(() => '?');
      console.log(`[leader] 리더 락 미획득 — web-only 모드 (현재 리더: ${holder})`);
      _isLeader = false;
      // 비리더도 주기적으로 재경합: 리더가 죽으면(락 만료) 다음 시도에서 획득 → 그때 재시작 유도
      setInterval(async () => {
        try {
          const got = await redis.set(LOCK_KEY, INSTANCE_ID, 'NX', 'PX', TTL_MS);
          if (got === 'OK') {
            console.error('[leader] 리더 공석 감지 → 락 획득. 스케줄러 기동 위해 프로세스 재시작.');
            process.exit(0); // 오케스트레이터 재시작 → shouldRunSchedulers 가 true 로 부팅
          }
        } catch (_) {}
      }, RENEW_MS);
      return false;
    }
    // 리더 획득
    _isLeader = true;
    console.log(`[leader] ✅ 리더 획득 (${INSTANCE_ID}) — 스케줄러/입금 리스너 실행`);
    // 하트비트: 내 소유면 갱신, 상실 시 종료(재경합)
    setInterval(async () => {
      try {
        const renewed = await redis.eval(LUA_RENEW, 1, LOCK_KEY, INSTANCE_ID, String(TTL_MS));
        if (Number(renewed) !== 1) {
          console.error('[leader] ❌ 리더 락 상실 — 중복 실행 방지 위해 종료(재시작 후 재경합)');
          process.exit(1);
        }
      } catch (e) {
        // Redis 일시 장애: 다음 주기 재시도. (TTL 만료 전 복구되면 유지)
        console.warn('[leader] 하트비트 갱신 실패(재시도):', e.message);
      }
    }, RENEW_MS);
    return true;
  } catch (e) {
    // 락 시도 자체 실패 → 안전하게 미실행(중복 위험 회피). 단일 워커 보장 우선.
    console.error('[leader] 락 경합 실패 — 스케줄러 미실행(안전):', e.message);
    _isLeader = false;
    return false;
  }
}

module.exports = { shouldRunSchedulers, isLeader, instanceId };
