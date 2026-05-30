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
  // Redis 없으면 단일 인스턴스 기본 동작.
  // [v7.191 fix] 프로덕션에서 REDIS_URL 누락 + 멀티 워커는 입금 N배 처리 위험.
  //   NODE_ENV=production 환경에서는 REDIS_URL 또는 명시적 RUN_SCHEDULERS=true 둘 중 하나는 있어야 함.
  //   둘 다 없으면 fail-CLOSED (안전 우선) — 운영자가 명시적으로 single-node 임을 선언해야 동작.
  if (!process.env.REDIS_URL) {
    if (process.env.NODE_ENV === 'production' && process.env.RUN_SCHEDULERS !== 'true') {
      console.error('[leader] ⚠ 프로덕션 환경에서 REDIS_URL 누락 + RUN_SCHEDULERS != "true" — 스케줄러 미실행 (단일 워커 명시 안 됨).');
      console.error('[leader] 단일 워커 명시: RUN_SCHEDULERS=true / 멀티 워커: REDIS_URL 설정.');
      _isLeader = false;
      return false;
    }
    console.log('[leader] REDIS_URL 미설정 — 단일 인스턴스로 스케줄러 실행');
    _isLeader = true;
    return true;
  }
  // Redis 리더 락 경합
  let Redis;
  try { Redis = require('ioredis'); }
  catch (e) {
    // [v7.189 fix] fail-CLOSED 통일. 이전엔 RUN_SCHEDULERS!=='false' (기본 true) → ioredis 미설치 시 모든 워커가 리더로 동작 → 입금 N배 처리 위험.
    //   ioredis 가 없으면 단일 인스턴스 가정 — RUN_SCHEDULERS=true 명시적 설정한 워커만 실행.
    const lead = process.env.RUN_SCHEDULERS === 'true';
    console.warn(`[leader] ioredis 미설치 — RUN_SCHEDULERS=true 인 워커만 스케줄러 실행 (현재: ${lead})`);
    _isLeader = lead;
    return lead;
  }
  // family:0 = IPv4/IPv6 모두 시도(Railway 내부망은 IPv6 전용 redis.railway.internal).
  const redis = new Redis(process.env.REDIS_URL, {
    maxRetriesPerRequest: 3, family: 0, connectTimeout: 8000
  });
  redis.on('error', () => {});
  // ⚠️ 락 경합 전에 Redis 연결(ready)을 최대 12초 대기한다.
  //    Railway 내부망 DNS/연결이 부팅 직후 몇 초 늦게 잡히므로, 즉시 set() 하면 실패 →
  //    리더 미획득 → 스케줄러 영구 미실행 사고가 났었음(연결은 됐는데 선출은 못 함).
  const ready = await new Promise((res) => {
    if (redis.status === 'ready') return res(true);
    const t = setTimeout(() => res(false), 12000);
    redis.once('ready', () => { clearTimeout(t); res(true); });
  });
  if (!ready) {
    // [v7.189 fix] fail-CLOSED 통일. 이전엔 `!=='false'` (기본 true) → Redis 다운 시 모든 워커가 리더 → 중복 처리.
    //   Redis 불통이면 RUN_SCHEDULERS=true 명시한 워커만. 입금은 backfillEvents 가 다음 시도에 복구하므로 일시 중단 OK.
    const lead = process.env.RUN_SCHEDULERS === 'true';
    console.warn(`[leader] Redis 연결 실패(12s) — fail-CLOSED 폴백 (RUN_SCHEDULERS=true 인 워커만): ${lead ? '실행' : '미실행'}`);
    _isLeader = lead;
    return lead;
  }
  try {
    const ok = await redis.set(LOCK_KEY, INSTANCE_ID, 'NX', 'PX', TTL_MS);
    if (ok !== 'OK') {
      const holder = await redis.get(LOCK_KEY).catch(() => '?');
      console.log(`[leader] 리더 락 미획득 — web-only 모드 (현재 리더: ${holder})`);
      _isLeader = false;
      // 비리더도 주기적으로 재경합: 리더가 죽어 락이 만료(공석)되면 재시작 → 부팅 path 의 SET NX 가 공석 락을 깨끗이 획득.
      // ⚠ [v7.270 FIX] 여기서 직접 SET 으로 락을 "미리 잡고" exit 하면 안 된다.
      //    INSTANCE_ID 는 부팅마다 새로 생성되므로(21줄), 곧 죽을 현재 ID 로 락을 물면
      //    재시작된 프로세스(새 ID)는 그 락을 자기 것으로 인식 못 해 SET NX 실패 → 또 web-only →
      //    재경합 → 획득 → exit … 무한 재시작 루프(전 엔드포인트 502)가 발생했다.
      //    → 락이 진짜 공석(GET null)일 때만 exit. 락 획득은 재시작 후 부팅 path 가 단독 수행한다.
      setInterval(async () => {
        try {
          const holder = await redis.get(LOCK_KEY);
          if (!holder) {
            console.error('[leader] 리더 공석 감지 → 재시작하여 부팅 시 리더 재경합.');
            // [v7.274] exit(0)은 ON_FAILURE 정책에서 재시작되지 않아 web replica가 영구 web-only로 남았다.
            //   non-zero로 종료해 오케스트레이터가 반드시 재시작 → 부팅 path SET NX가 공석 락 획득.
            process.exit(1);
          }
        } catch (_) {}
      }, RENEW_MS);
      return false;
    }
    // 리더 획득
    _isLeader = true;
    console.log(`[leader] ✅ 리더 획득 (${INSTANCE_ID}) — 스케줄러/입금 리스너 실행`);
    // 하트비트: 내 소유면 갱신, 소유권 상실(renewed!==1) 시 즉시 종료(재경합).
    //   renewed!==1 = Redis가 응답했으나 락이 내 것이 아님 = 다른 인스턴스가 이미 인수 → 중복 스케줄러/입금
    //   이중처리를 막기 위해 즉시 exit. (일시 Redis 장애는 throw → catch에서 재시도하므로 여기 안 옴.)
    //   restartPolicyMaxRetries 소진 우려는 railway.json restartPolicyType=ALWAYS(무제한)로 해소.
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
