// server/services/weeklyChallenge.js
// ═══════════════════════════════════════════════════════════════
// Phase3 리텐션 훅 2종 — 주간 누적 챌린지 + 정시 섹터 서지
//
//  (A) 주간 누적 챌린지:
//      이번 주(UTC 월요일~) 누적 클레임/채굴/격침 카운트를 "조회 시점에"
//      claims/transactions/ship_wrecks 에서 lazy 집계한다(다른 도메인 경로에
//      진행도 증가 훅을 박지 않는 자족 구현). 목표 도달 시 GP carve 보상 1회 수령.
//      수령 멱등은 weekly_challenge_progress(wallet, week_start, metric) ledger +
//      FOR UPDATE 로 보장.
//
//  (B) 정시 섹터 서지:
//      설정(weekly_surge_*) 기반 시간창 동안 회전 섹터의 채굴/시즌점수가 N배.
//      본 도메인은 "현재 활성 서지" 상태만 계산/노출(읽기 전용). 실제 배율을
//      mining/season 계산에 적용하는 것은 해당 도메인 파일 소관 → 범위 밖.
//
//  경제: 보상은 carve(발행 0, 환금불가 GP). redeemable_pp 미발행.
// ═══════════════════════════════════════════════════════════════

const { pool, getSetting, logGPActivity, notifyPlayer } = require('../db');

// ── 메트릭 정의 ────────────────────────────────────────────────
//   각 metric 의 목표/보상 설정 키와, lazy 집계 SQL 을 한 곳에 모은다.
const METRICS = [
  {
    key: 'claim',
    label_ko: '이번 주 영토 클레임',
    label_en: 'Weekly territory claims',
    targetSetting: 'weekly_challenge_claim_target',
    targetDefault: 5,
    rewardSetting: 'weekly_challenge_claim_reward_gp',
    rewardDefault: 300,
  },
  {
    key: 'harvest',
    label_ko: '이번 주 영토 채굴',
    label_en: 'Weekly territory harvests',
    targetSetting: 'weekly_challenge_harvest_target',
    targetDefault: 20,
    rewardSetting: 'weekly_challenge_harvest_reward_gp',
    rewardDefault: 400,
  },
  {
    key: 'kill',
    label_ko: '이번 주 적 함선 격침',
    label_en: 'Weekly ship kills',
    targetSetting: 'weekly_challenge_kill_target',
    targetDefault: 3,
    rewardSetting: 'weekly_challenge_kill_reward_gp',
    rewardDefault: 500,
  },
];

function metricDef(metricKey) {
  return METRICS.find(m => m.key === metricKey) || null;
}

// ── 주간 경계 헬퍼 ─────────────────────────────────────────────
//   dailyOps.js 와 동일하게 Postgres date_trunc('week') (= 월요일, UTC) 사용.
//   요청 1회당 단일 week_start 로 핀(read·claim 경계 불일치 방지).
async function getWeekStart() {
  const { rows } = await pool.query(
    `SELECT date_trunc('week', CURRENT_DATE AT TIME ZONE 'UTC')::date AS ws`
  );
  return rows[0].ws; // Date 객체
}

// ── lazy 카운트 (이번 주 누적) ─────────────────────────────────
//   wallet 은 항상 LOWER 비교(코드베이스 컨벤션). week_start 이상 created_at 필터.
async function countClaim(wallet, weekStart) {
  try {
    const { rows } = await pool.query(
      `SELECT COUNT(*)::int AS cnt FROM claims
       WHERE LOWER(owner) = $1
         AND deleted_at IS NULL
         AND created_at >= $2`,
      [wallet, weekStart]
    );
    return rows[0]?.cnt || 0;
  } catch (_) { return 0; }
}

async function countHarvest(wallet, weekStart) {
  try {
    const { rows } = await pool.query(
      `SELECT COUNT(*)::int AS cnt FROM transactions
       WHERE type IN ('mining', 'instant_harvest')
         AND LOWER(from_wallet) = $1
         AND created_at >= $2`,
      [wallet, weekStart]
    );
    return rows[0]?.cnt || 0;
  } catch (_) { return 0; }
}

async function countKill(wallet, weekStart) {
  try {
    const { rows } = await pool.query(
      `SELECT COUNT(*)::int AS cnt FROM ship_wrecks
       WHERE LOWER(killer_wallet) = $1
         AND created_at >= $2`,
      [wallet, weekStart]
    );
    return rows[0]?.cnt || 0;
  } catch (_) { return 0; }
}

async function countMetric(metricKey, wallet, weekStart) {
  if (metricKey === 'claim')   return countClaim(wallet, weekStart);
  if (metricKey === 'harvest') return countHarvest(wallet, weekStart);
  if (metricKey === 'kill')    return countKill(wallet, weekStart);
  return 0;
}

// ── 주간 챌린지 enable 게이트 ──────────────────────────────────
async function isChallengeEnabled() {
  try {
    const v = await getSetting('weekly_challenge_enabled', 'true');
    return v !== 'false' && v !== false; // 기본 on, fail-open
  } catch (_) { return true; }
}

async function metricTargetReward(def) {
  let target = parseInt(await getSetting(def.targetSetting, String(def.targetDefault)), 10);
  if (!Number.isFinite(target) || target <= 0) target = def.targetDefault;
  let reward = parseInt(await getSetting(def.rewardSetting, String(def.rewardDefault)), 10);
  if (!Number.isFinite(reward) || reward < 0) reward = def.rewardDefault;
  return { target, reward };
}

// ── GET 상태 ───────────────────────────────────────────────────
//   각 metric 의 이번 주 현재 카운트 / 목표 / 보상 / 수령 여부 반환.
async function getStatus(wallet) {
  const w = (wallet || '').toLowerCase().trim();
  if (!w || w.length < 5) return { enabled: false, error: 'INVALID_WALLET' };

  const enabled = await isChallengeEnabled();
  if (!enabled) return { enabled: false, week_start: null, challenges: [] };

  const weekStart = await getWeekStart();

  // 이번 주 수령 ledger 한 번에 조회
  let claimedSet = {};
  try {
    const { rows } = await pool.query(
      `SELECT metric, claimed FROM weekly_challenge_progress
       WHERE LOWER(wallet) = $1 AND week_start = $2`,
      [w, weekStart]
    );
    for (const r of rows) claimedSet[r.metric] = !!r.claimed;
  } catch (_) {}

  const challenges = [];
  for (const def of METRICS) {
    const { target, reward } = await metricTargetReward(def);
    const current = await countMetric(def.key, w, weekStart);
    const claimed = !!claimedSet[def.key];
    const reached = current >= target;
    challenges.push({
      metric: def.key,
      label_ko: def.label_ko,
      label_en: def.label_en,
      current,
      target,
      reward_gp: reward,
      reached,
      claimed,
      claimable: reached && !claimed,
    });
  }

  return {
    enabled: true,
    week_start: weekStart,
    challenges,
  };
}

// ── POST 수령 (멱등) ───────────────────────────────────────────
//   BEGIN → ledger row FOR UPDATE(없으면 INSERT 후 재조회) → claimed=FALSE 확인 →
//   목표 재검증(현재 카운트 ≥ 목표) → claimed=TRUE + GP carve → COMMIT.
//   UNIQUE(wallet, week_start, metric) + FOR UPDATE 로 동시/이중 수령 차단.
async function claim(wallet, metricKey) {
  const w = (wallet || '').toLowerCase().trim();
  if (!w || w.length < 5) return { success: false, error: 'INVALID_WALLET' };

  const def = metricDef(metricKey);
  if (!def) return { success: false, error: 'INVALID_METRIC' };

  if (!(await isChallengeEnabled())) return { success: false, error: 'CHALLENGE_DISABLED' };

  const weekStart = await getWeekStart();
  const { target, reward } = await metricTargetReward(def);

  // 목표 미달이면 트랜잭션 진입 전 차단(현재 카운트는 read 경계와 동일 weekStart 로 고정)
  const current = await countMetric(def.key, w, weekStart);
  if (current < target) {
    return { success: false, error: 'TARGET_NOT_REACHED', current, target };
  }
  if (reward <= 0) {
    return { success: false, error: 'NO_REWARD_CONFIGURED' };
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // ledger row 확보(없으면 생성). ON CONFLICT 로 동시성 안전, 이후 FOR UPDATE 잠금.
    await client.query(
      `INSERT INTO weekly_challenge_progress (wallet, week_start, metric, count, reward_gp)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (wallet, week_start, metric) DO NOTHING`,
      [w, weekStart, def.key, current, reward]
    );

    const { rows: locked } = await client.query(
      `SELECT id, claimed FROM weekly_challenge_progress
       WHERE LOWER(wallet) = $1 AND week_start = $2 AND metric = $3
       FOR UPDATE`,
      [w, weekStart, def.key]
    );
    const row = locked[0];
    if (!row) throw new Error('LEDGER_ROW_MISSING');

    if (row.claimed) {
      await client.query('ROLLBACK');
      return { success: false, error: 'ALREADY_CLAIMED' };
    }

    // 수령 확정 + 스냅샷 갱신
    await client.query(
      `UPDATE weekly_challenge_progress
       SET claimed = TRUE, claimed_at = NOW(), count = $2, reward_gp = $3
       WHERE id = $1`,
      [row.id, current, reward]
    );

    // GP carve 지급 (발행 0 — gp_balance 만 증가, redeemable_pp 미발행)
    const payout = await client.query(
      `UPDATE users SET gp_balance = gp_balance + $1 WHERE LOWER(wallet_address) = LOWER($2)`,
      [reward, w]
    );
    if (payout.rowCount === 0) throw new Error('USER_NOT_FOUND');

    await client.query('COMMIT');

    // 부수효과 (fire-and-forget)
    try { logGPActivity(w, reward, 'weekly_challenge', `주간 챌린지(${def.key}) 보상 수령`).catch(() => {}); } catch (_) {}
    try { notifyPlayer(w, 'weekly_challenge', `주간 챌린지 보상 +${reward} GP`, { metric: def.key }); } catch (_) {}

    return { success: true, metric: def.key, reward_gp: reward, current, target };
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch (_) {}
    console.error('[weeklyChallenge] claim error:', err.message);
    if (err.message === 'USER_NOT_FOUND') return { success: false, error: 'USER_NOT_FOUND' };
    return { success: false, error: 'INTERNAL_ERROR' };
  } finally {
    client.release();
  }
}

// ═══════════════════════════════════════════════════════════════
// (B) 정시 섹터 서지 — 순수 설정 기반 시간창 계산 (읽기 전용)
// ═══════════════════════════════════════════════════════════════
//   주기(period_hours) 시작마다 window_hours 동안 서지 활성.
//   대상 섹터는 period 인덱스로 sectors 목록을 순환(deterministic).
//   주의: 본 함수는 "현재 서지 상태"만 계산한다. 실제 채굴/시즌점수 배율 적용은
//   mining/season 도메인 파일 소관이므로 본 도메인 범위 밖(데이터만 노출).
async function getActiveSurge(now = new Date()) {
  let enabled = true;
  try {
    const v = await getSetting('weekly_surge_enabled', 'true');
    enabled = v !== 'false' && v !== false;
  } catch (_) {}
  if (!enabled) return { enabled: false, active: false };

  let multiplier = parseFloat(await getSetting('weekly_surge_multiplier', '2.5'));
  if (!Number.isFinite(multiplier) || multiplier <= 1) multiplier = 2.5;

  let windowHours = parseFloat(await getSetting('weekly_surge_window_hours', '2'));
  if (!Number.isFinite(windowHours) || windowHours <= 0) windowHours = 2;

  let periodHours = parseFloat(await getSetting('weekly_surge_period_hours', '6'));
  if (!Number.isFinite(periodHours) || periodHours <= 0) periodHours = 6;
  // window 가 period 보다 길면 항상 활성처럼 되지 않도록 clamp
  if (windowHours > periodHours) windowHours = periodHours;

  let sectors;
  try {
    const raw = await getSetting('weekly_surge_sectors', '["frontier","mid","core"]');
    sectors = typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch (_) { sectors = ['frontier', 'mid', 'core']; }
  if (!Array.isArray(sectors) || sectors.length === 0) sectors = ['frontier', 'mid', 'core'];

  // UTC epoch hour 기준으로 period 인덱스 계산 (deterministic, 인스턴스 무관)
  const periodMs = periodHours * 3600 * 1000;
  const windowMs = windowHours * 3600 * 1000;
  const t = now.getTime();
  const periodIndex = Math.floor(t / periodMs);
  const periodStartMs = periodIndex * periodMs;
  const elapsedInPeriod = t - periodStartMs;
  const active = elapsedInPeriod < windowMs;

  const sector = sectors[((periodIndex % sectors.length) + sectors.length) % sectors.length];
  const windowEndsMs = periodStartMs + windowMs;
  const nextPeriodStartMs = periodStartMs + periodMs;

  return {
    enabled: true,
    active,
    sector,                 // 이번 period 대상 섹터(활성/비활성 무관)
    multiplier,
    window_hours: windowHours,
    period_hours: periodHours,
    // 활성이면 종료까지 남은 초, 비활성이면 다음 서지 시작까지 남은 초
    seconds_remaining: active
      ? Math.max(0, Math.round((windowEndsMs - t) / 1000))
      : Math.max(0, Math.round((nextPeriodStartMs - t) / 1000)),
    window_ends_at: active ? new Date(windowEndsMs).toISOString() : null,
    next_surge_at: active ? null : new Date(nextPeriodStartMs).toISOString(),
  };
}

// ── 오래된 ledger 정리 (스케줄러용, 선택) ──────────────────────
//   lazy 카운트가 week_start 필터로 롤오버를 처리하므로 리셋은 불필요.
//   ledger 무한 누적만 방지(8주 이상 지난 행 삭제).
async function pruneOldProgress() {
  try {
    const { rowCount } = await pool.query(
      `DELETE FROM weekly_challenge_progress
       WHERE week_start < (date_trunc('week', CURRENT_DATE AT TIME ZONE 'UTC')::date - INTERVAL '8 weeks')`
    );
    return rowCount || 0;
  } catch (e) {
    console.warn('[weeklyChallenge] prune error:', e.message);
    return 0;
  }
}

module.exports = {
  getStatus,
  claim,
  getActiveSurge,
  pruneOldProgress,
  getWeekStart,
  // 테스트/내부 노출
  METRICS,
};
