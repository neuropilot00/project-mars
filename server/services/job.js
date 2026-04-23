/**
 * services/job.js
 * 직업 시스템 핵심 서비스 — MASTER_PLAN Phase 1.5
 *
 * 모든 버프 수치는 DB(job_buffs)에서 조회. 하드코딩 절대 금지.
 * 캐싱: 유저별 버프는 10분 메모리 캐시 (빈번한 harvest/hijack 호출 최적화)
 */

const { pool, getSetting } = require('../db');

// ─────────────────────────────────────────
// 10분 메모리 캐시
// key: `${userId}:${buffKey}` (또는 wallet_address)
// ─────────────────────────────────────────
const jobBuffCache = new Map();
const JOB_CACHE_TTL = 10 * 60 * 1000; // 10분

function _cacheGet(key) {
  const entry = jobBuffCache.get(key);
  if (!entry) return undefined;
  if (entry.expiresAt < Date.now()) {
    jobBuffCache.delete(key);
    return undefined;
  }
  return entry.value;
}

function _cacheSet(key, value) {
  jobBuffCache.set(key, { value, expiresAt: Date.now() + JOB_CACHE_TTL });
}

/**
 * 직업 변경 또는 선택 시 해당 유저의 캐시 전체 무효화
 * @param {string} wallet
 */
function invalidateUserJobCache(wallet) {
  const prefix = `${wallet}:`;
  for (const key of jobBuffCache.keys()) {
    if (key.startsWith(prefix)) jobBuffCache.delete(key);
  }
  // getUserJob 캐시도 무효화
  jobBuffCache.delete(`job:${wallet}`);
}

// ─────────────────────────────────────────
// 핵심 함수 1 — getJobBuff
// ─────────────────────────────────────────
/**
 * 유저의 특정 버프 값 조회
 * @param {string} wallet  — wallet_address (users 테이블 PK)
 * @param {string} buffKey — 예: 'miner_mining_rate'
 * @param {number} defaultValue — 직업 없거나 버프 없을 때 반환값 (보통 1.0)
 * @returns {Promise<number>}
 *
 * 사용 예:
 *   const rate = await getJobBuff(wallet, 'miner_mining_rate', 1.0);
 *   harvestedPP = Math.floor(harvestedPP * rate * 10000) / 10000;
 */
async function getJobBuff(wallet, buffKey, defaultValue = 1.0) {
  // 직업 시스템 비활성화 체크
  const enabled = (await getSetting('job_system_enabled') || 'true') === 'true';
  if (!enabled) return defaultValue;

  const cacheKey = `${wallet}:${buffKey}`;
  const cached = _cacheGet(cacheKey);
  if (cached !== undefined) return cached;

  const result = await pool.query(`
    SELECT jb.buff_value
    FROM users u
    JOIN job_buffs jb ON jb.job_id = u.current_job_id
    WHERE u.wallet_address = $1 AND jb.buff_key = $2
  `, [wallet, buffKey]);

  const value = result.rows.length > 0
    ? parseFloat(result.rows[0].buff_value)
    : defaultValue;

  _cacheSet(cacheKey, value);
  return value;
}

// ─────────────────────────────────────────
// 핵심 함수 2 — getUserJob
// ─────────────────────────────────────────
/**
 * 유저의 현재 직업 정보 + 전체 버프 목록 조회
 * @param {string} wallet
 * @param {string} [lang='en'] — 이름/설명 언어
 * @returns {Promise<{job: Object, buffs: Object, changeStatus: Object} | null>}
 */
async function getUserJob(wallet, lang = 'en') {
  const cacheKey = `job:${wallet}`;
  const cached = _cacheGet(cacheKey);
  if (cached !== undefined) return cached;

  const safeCol = ['en','ko','ja','zh'].includes(lang) ? lang : 'en';

  const userRes = await pool.query(`
    SELECT u.current_job_id, u.job_selected_at, u.job_changed_at,
           u.weekly_job_change_count, u.weekly_job_reset_at,
           u.xp, u.rank_level,
           j.code, j.name_${safeCol} AS job_name,
           j.description_${safeCol} AS job_desc,
           j.icon_emoji, j.color_hex
    FROM users u
    LEFT JOIN jobs j ON j.id = u.current_job_id
    WHERE u.wallet_address = $1
  `, [wallet]);

  if (!userRes.rows.length) return null;
  const u = userRes.rows[0];

  if (!u.current_job_id) {
    const result = { job: null, buffs: {}, changeStatus: await _getChangeStatus(u) };
    _cacheSet(cacheKey, result);
    return result;
  }

  // 버프 전체 조회
  const buffRes = await pool.query(
    'SELECT buff_key, buff_value FROM job_buffs WHERE job_id = $1',
    [u.current_job_id]
  );
  const buffs = {};
  buffRes.rows.forEach(b => { buffs[b.buff_key] = parseFloat(b.buff_value); });

  const result = {
    job: {
      id:          u.current_job_id,
      code:        u.code,
      name:        u.job_name,
      description: u.job_desc,
      icon_emoji:  u.icon_emoji,
      color_hex:   u.color_hex,
      selected_at: u.job_selected_at
    },
    buffs,
    changeStatus: await _getChangeStatus(u)
  };

  _cacheSet(cacheKey, result);
  return result;
}

async function _getChangeStatus(u) {
  const [costGpSetting, weeklyFreeSetting, cooldownSetting] = await Promise.all([
    getSetting('job_change_cost_gp'),
    getSetting('job_change_weekly_free'),
    getSetting('job_change_cooldown_hours')
  ]);

  const costGp       = parseInt(costGpSetting  || '50');
  const weeklyFree   = parseInt(weeklyFreeSetting || '1');
  const cooldownHours= parseInt(cooldownSetting  || '24');

  // 주간 무료 횟수 리셋 여부 계산
  const now = Date.now();
  const resetAt = u.weekly_job_reset_at ? new Date(u.weekly_job_reset_at).getTime() : 0;
  const weekMs  = 7 * 24 * 60 * 60 * 1000;
  const usedFree = (now - resetAt) < weekMs ? (u.weekly_job_change_count || 0) : 0;
  const freeLeft = Math.max(0, weeklyFree - usedFree);

  // 쿨다운 체크
  let cooldownEndsAt = null;
  if (u.job_changed_at) {
    const endsAt = new Date(u.job_changed_at).getTime() + cooldownHours * 3600000;
    if (endsAt > now) cooldownEndsAt = new Date(endsAt).toISOString();
  }

  // 다음 주간 리셋
  const nextReset = new Date(resetAt + weekMs).toISOString();

  return {
    canChangeFree:   freeLeft > 0 && !cooldownEndsAt,
    freeChangesLeft: freeLeft,
    freeResetsAt:    nextReset,
    canChangePaid:   !cooldownEndsAt,
    paidCostGp:      costGp,
    cooldownEndsAt
  };
}

// ─────────────────────────────────────────
// 핵심 함수 3 — selectJob
// ─────────────────────────────────────────
/**
 * 직업 선택/변경
 * @param {string} wallet
 * @param {string} jobCode — 'miner' | 'warrior' | 'crafter' | 'merchant'
 * @returns {Promise<{success: boolean, message: string, costPaid: number, job: Object}>}
 */
async function selectJob(wallet, jobCode) {
  const [requiredLevelSetting, costGpSetting, weeklyFreeSetting, cooldownSetting, enabledSetting] =
    await Promise.all([
      getSetting('job_required_level'),
      getSetting('job_change_cost_gp'),
      getSetting('job_change_weekly_free'),
      getSetting('job_change_cooldown_hours'),
      getSetting('job_system_enabled')
    ]);

  if ((enabledSetting || 'true') !== 'true') {
    return { success: false, message: 'Job system is currently disabled.', costPaid: 0 };
  }

  const requiredLevel = parseInt(requiredLevelSetting || '5');
  const costGp        = parseInt(costGpSetting        || '50');
  const weeklyFree    = parseInt(weeklyFreeSetting     || '1');
  const cooldownHours = parseInt(cooldownSetting       || '24');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 유저 정보 조회 (lock for update)
    const userRes = await client.query(
      `SELECT u.rank_level, u.gp_balance, u.current_job_id,
              u.job_changed_at, u.weekly_job_change_count, u.weekly_job_reset_at
       FROM users u WHERE u.wallet_address = $1 FOR UPDATE`,
      [wallet]
    );
    if (!userRes.rows.length) throw new Error('User not found');
    const u = userRes.rows[0];

    // 레벨 체크
    if ((u.rank_level || 1) < requiredLevel) {
      await client.query('ROLLBACK');
      return {
        success: false,
        message: `Level ${requiredLevel} required to choose a job. (current: ${u.rank_level || 1})`,
        costPaid: 0
      };
    }

    // 직업 존재 확인
    const jobRes = await client.query('SELECT id, code FROM jobs WHERE code = $1 AND is_active = TRUE', [jobCode]);
    if (!jobRes.rows.length) throw new Error(`Unknown job code: ${jobCode}`);
    const targetJob = jobRes.rows[0];

    // 같은 직업이면 취소
    if (u.current_job_id === targetJob.id) {
      await client.query('ROLLBACK');
      return { success: false, message: 'Already selected that job.', costPaid: 0 };
    }

    const now = new Date();

    // 쿨다운 체크 (최초 선택이면 쿨다운 없음)
    if (u.current_job_id && u.job_changed_at) {
      const cooldownEndsAt = new Date(u.job_changed_at).getTime() + cooldownHours * 3600000;
      if (Date.now() < cooldownEndsAt) {
        const endsAt = new Date(cooldownEndsAt).toISOString();
        await client.query('ROLLBACK');
        return {
          success: false,
          message: `Job change on cooldown until ${endsAt}`,
          costPaid: 0,
          cooldownEndsAt: endsAt
        };
      }
    }

    // 무료/유료 판단
    const weekMs  = 7 * 24 * 60 * 60 * 1000;
    const resetAt = u.weekly_job_reset_at ? new Date(u.weekly_job_reset_at).getTime() : 0;
    const withinWeek = (Date.now() - resetAt) < weekMs;
    const usedFree = withinWeek ? (u.weekly_job_change_count || 0) : 0;

    let changeType = 'free';
    let gp_cost    = 0;
    let newWeeklyCount = withinWeek ? usedFree + 1 : 1;
    let newResetAt = withinWeek ? u.weekly_job_reset_at : now;

    // 최초 선택이면 무조건 무료
    const isFirstSelection = !u.current_job_id;
    if (!isFirstSelection && usedFree >= weeklyFree) {
      // 유료 변경
      if (parseFloat(u.gp_balance) < costGp) {
        await client.query('ROLLBACK');
        return {
          success: false,
          message: `Insufficient GP. Need ${costGp} GP.`,
          costPaid: 0
        };
      }
      changeType = 'paid';
      gp_cost    = costGp;
      await client.query(
        'UPDATE users SET gp_balance = gp_balance - $1 WHERE wallet_address = $2',
        [costGp, wallet]
      );
      // 유료 변경 시 주간 카운트는 증가하지 않음
      newWeeklyCount = withinWeek ? usedFree : 0;
    }

    // 직업 변경 적용
    await client.query(`
      UPDATE users
      SET current_job_id         = $1,
          job_selected_at        = COALESCE(job_selected_at, $2),
          job_changed_at         = $2,
          weekly_job_change_count= $3,
          weekly_job_reset_at    = $4
      WHERE wallet_address = $5
    `, [targetJob.id, now, newWeeklyCount, newResetAt, wallet]);

    // 로그
    await client.query(`
      INSERT INTO job_change_log (user_id, from_job_id, to_job_id, change_type, gp_cost)
      VALUES ($1, $2, $3, $4, $5)
    `, [wallet, u.current_job_id || null, targetJob.id, changeType, gp_cost]);

    await client.query('COMMIT');

    // 캐시 무효화
    invalidateUserJobCache(wallet);

    return {
      success:  true,
      message:  `Job changed to ${jobCode}.`,
      costPaid: gp_cost,
      changeType,
      job: targetJob
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ─────────────────────────────────────────
// 핵심 함수 4 — getAllJobs
// ─────────────────────────────────────────
/**
 * 모든 직업 목록 조회 (직업 선택 UI용)
 * @param {string} [lang='en']
 * @returns {Promise<Array>}
 */
async function getAllJobs(lang = 'en') {
  const safeCol = ['en','ko','ja','zh'].includes(lang) ? lang : 'en';

  const res = await pool.query(`
    SELECT j.id, j.code, j.icon_emoji, j.color_hex, j.sort_order,
           j.name_${safeCol}        AS name,
           j.description_${safeCol} AS description,
           COUNT(u.wallet_address)  AS user_count
    FROM jobs j
    LEFT JOIN users u ON u.current_job_id = j.id
    WHERE j.is_active = TRUE
    GROUP BY j.id
    ORDER BY j.sort_order
  `);

  // 각 직업의 버프도 첨부
  const buffsRes = await pool.query('SELECT job_id, buff_key, buff_value, description FROM job_buffs ORDER BY job_id');
  const buffsMap = {};
  buffsRes.rows.forEach(b => {
    if (!buffsMap[b.job_id]) buffsMap[b.job_id] = [];
    buffsMap[b.job_id].push({ key: b.buff_key, value: parseFloat(b.buff_value), description: b.description });
  });

  return res.rows.map(j => ({
    ...j,
    user_count: parseInt(j.user_count) || 0,
    buffs: buffsMap[j.id] || []
  }));
}

// ─────────────────────────────────────────
// 핵심 함수 5 — resetWeeklyJobChangeCounts
// ─────────────────────────────────────────
/**
 * 주간 무료 변경 횟수 리셋 — 매주 월요일 UTC 00:00 실행 (server/index.js 스케줄러 등록 필요)
 */
async function resetWeeklyJobChangeCounts() {
  const result = await pool.query(`
    UPDATE users
    SET weekly_job_change_count = 0,
        weekly_job_reset_at     = NOW()
    WHERE weekly_job_change_count > 0
  `);
  console.log(`[JOB] Weekly job change counts reset. Affected: ${result.rowCount} users`);
  return result.rowCount;
}

// ─────────────────────────────────────────
// 어드민 통계
// ─────────────────────────────────────────
/**
 * 직업별 유저 분포 + 평균 GP 잔고
 */
async function getJobStats() {
  const res = await pool.query(`
    SELECT
      j.code,
      j.name_en AS name,
      j.icon_emoji,
      j.color_hex,
      COUNT(u.wallet_address)              AS user_count,
      ROUND(AVG(u.gp_balance)::numeric, 2) AS avg_gp,
      ROUND(AVG(u.pp_balance)::numeric, 6) AS avg_pp
    FROM jobs j
    LEFT JOIN users u ON u.current_job_id = j.id
    GROUP BY j.id
    ORDER BY j.sort_order
  `);

  const noJobRes = await pool.query(
    'SELECT COUNT(*) AS cnt FROM users WHERE current_job_id IS NULL'
  );

  const changeLogRes = await pool.query(`
    SELECT change_type, COUNT(*) AS cnt
    FROM job_change_log
    WHERE changed_at >= NOW() - INTERVAL '7 days'
    GROUP BY change_type
  `);

  return {
    byJob:   res.rows.map(r => ({ ...r, user_count: parseInt(r.user_count) || 0 })),
    noJob:   parseInt(noJobRes.rows[0].cnt) || 0,
    recentChanges: changeLogRes.rows
  };
}

/**
 * 직업 버프 수치 어드민 수정
 */
async function updateJobBuff(jobId, buffKey, newValue) {
  const result = await pool.query(
    'UPDATE job_buffs SET buff_value = $1, updated_at = NOW() WHERE job_id = $2 AND buff_key = $3 RETURNING *',
    [newValue, jobId, buffKey]
  );
  if (!result.rows.length) throw new Error('Buff not found');

  // 해당 직업 유저 캐시 전체 무효화 (직업 변경 없이 버프 값만 바뀌는 경우)
  // 캐시 키 패턴 전체 삭제로 안전하게 처리
  for (const key of jobBuffCache.keys()) {
    if (key.includes(`:${buffKey}`)) jobBuffCache.delete(key);
  }
  return result.rows[0];
}

module.exports = {
  getJobBuff,
  getUserJob,
  selectJob,
  getAllJobs,
  resetWeeklyJobChangeCounts,
  getJobStats,
  updateJobBuff,
  invalidateUserJobCache
};
