// server/services/job.js
// ═══════════════════════════════════════════════════════════════
// Job System Service — 바이블 V4 PART 3 § 3.5 기준
//
// 핵심 원칙: 모든 수치는 DB에서 조회. 하드코딩 금지.
// 성능: 10분 메모리 캐시 (빈번 조회 최적화)
// ═══════════════════════════════════════════════════════════════

const { pool } = require('../db');

// ─── 캐시 ───

const jobBuffCache = new Map();
const jobListCache = { data: null, expiresAt: 0 };
const CACHE_TTL = 10 * 60 * 1000;  // 10분

// ─── 버프 조회 ───

/**
 * 유저의 특정 버프 값 조회
 * @param {string} walletAddress
 * @param {string} buffKey
 * @param {number} defaultValue - 직업 없거나 버프 없을 때 기본값
 */
async function getJobBuff(walletAddress, buffKey, defaultValue = 1.0) {
  // job_system_enabled 체크
  const enabled = await isJobSystemEnabled();
  if (!enabled) return defaultValue;

  const cacheKey = `${walletAddress}:${buffKey}`;
  const cached = jobBuffCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const { rows } = await pool.query(`
    SELECT jb.buff_value
    FROM users u
    LEFT JOIN job_buffs jb 
      ON jb.job_id = u.current_job_id 
      AND jb.buff_key = $2
    WHERE u.wallet_address = $1
  `, [walletAddress, buffKey]);

  const value = rows.length > 0 && rows[0].buff_value !== null
    ? parseFloat(rows[0].buff_value)
    : defaultValue;

  jobBuffCache.set(cacheKey, { value, expiresAt: Date.now() + CACHE_TTL });
  return value;
}

/**
 * 유저의 모든 버프 한번에 조회 (여러 버프 필요할 때 최적화)
 */
async function getAllJobBuffs(walletAddress) {
  const enabled = await isJobSystemEnabled();
  if (!enabled) return {};

  const { rows } = await pool.query(`
    SELECT jb.buff_key, jb.buff_value
    FROM users u
    LEFT JOIN job_buffs jb ON jb.job_id = u.current_job_id
    WHERE u.wallet_address = $1 AND jb.buff_key IS NOT NULL
  `, [walletAddress]);

  return rows.reduce((acc, r) => {
    acc[r.buff_key] = parseFloat(r.buff_value);
    return acc;
  }, {});
}

// ─── 직업 목록 ───

async function listJobs() {
  if (jobListCache.data && jobListCache.expiresAt > Date.now()) {
    return jobListCache.data;
  }

  const { rows } = await pool.query(`
    SELECT * FROM jobs WHERE is_active = true ORDER BY sort_order
  `);

  // 각 직업에 버프 목록 포함
  for (const job of rows) {
    const { rows: buffs } = await pool.query(
      `SELECT buff_key, buff_value, description FROM job_buffs WHERE job_id = $1 ORDER BY buff_key`,
      [job.id]
    );
    job.buffs = buffs;
  }

  jobListCache.data = rows;
  jobListCache.expiresAt = Date.now() + CACHE_TTL;
  return rows;
}

// ─── 내 직업 조회 ───

async function getMyJob(walletAddress) {
  const { rows } = await pool.query(`
    SELECT 
      u.current_job_id,
      u.job_selected_at,
      u.job_changed_at,
      u.weekly_job_changes,
      u.weekly_reset_at,
      j.code AS job_code,
      j.name_en, j.name_ko, j.icon_emoji, j.color_hex,
      j.description_ko, j.recommended_sector
    FROM users u
    LEFT JOIN jobs j ON j.id = u.current_job_id
    WHERE u.wallet_address = $1
  `, [walletAddress]);

  if (!rows[0]) return null;
  const user = rows[0];

  // 버프 목록
  let buffs = [];
  if (user.current_job_id) {
    const { rows: buffRows } = await pool.query(
      `SELECT buff_key, buff_value, description FROM job_buffs WHERE job_id = $1`,
      [user.current_job_id]
    );
    buffs = buffRows;
  }

  // 주간 리셋 체크
  const weeklyLimit = await getSettingInt('job_change_weekly_free', 1);
  const cooldownHours = await getSettingInt('job_change_cooldown_hours', 24);
  const canChangeFree = user.weekly_job_changes < weeklyLimit;
  
  // 24시간 쿨다운 체크
  let onCooldown = false;
  let cooldownRemainingHours = 0;
  if (user.job_changed_at) {
    const hoursSinceChange = (Date.now() - new Date(user.job_changed_at).getTime()) / 3600000;
    if (hoursSinceChange < cooldownHours) {
      onCooldown = true;
      cooldownRemainingHours = Math.ceil(cooldownHours - hoursSinceChange);
    }
  }

  return {
    has_job: !!user.current_job_id,
    job_code: user.job_code,
    job_name_ko: user.name_ko,
    job_name_en: user.name_en,
    icon_emoji: user.icon_emoji,
    color_hex: user.color_hex,
    description_ko: user.description_ko,
    recommended_sector: user.recommended_sector,
    selected_at: user.job_selected_at,
    changed_at: user.job_changed_at,
    weekly_changes: user.weekly_job_changes,
    weekly_free_limit: weeklyLimit,
    can_change_free: canChangeFree,
    on_cooldown: onCooldown,
    cooldown_remaining_hours: cooldownRemainingHours,
    change_cost_gp: await getSettingInt('job_change_cost_gp', 50),
    buffs,
  };
}

// ─── 직업 선택/변경 ───

async function selectJob(walletAddress, jobCode) {
  const enabled = await isJobSystemEnabled();
  if (!enabled) throw new Error('JOB_SYSTEM_DISABLED');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 유저 조회 (level 컬럼은 일부 환경에 없을 수 있어 제외 — rank_level 사용)
    const { rows: userRows } = await client.query(`
      SELECT wallet_address, current_job_id, weekly_job_changes,
             weekly_reset_at, job_changed_at, gp_balance, rank_level
      FROM users WHERE wallet_address = $1 FOR UPDATE
    `, [walletAddress]);

    if (!userRows[0]) throw new Error('USER_NOT_FOUND');
    const user = userRows[0];

    // 직업 조회
    const { rows: jobRows } = await client.query(
      `SELECT * FROM jobs WHERE code = $1 AND is_active = true`,
      [jobCode]
    );
    if (!jobRows[0]) throw new Error('JOB_NOT_FOUND');
    const job = jobRows[0];

    // 같은 직업이면 패스
    if (user.current_job_id === job.id) throw new Error('SAME_JOB');

    // 쿨다운 체크 (첫 선택은 제외)
    const cooldownHours = await getSettingIntClient(client, 'job_change_cooldown_hours', 24);
    if (user.job_changed_at && user.current_job_id) {
      const hoursSince = (Date.now() - new Date(user.job_changed_at).getTime()) / 3600000;
      if (hoursSince < cooldownHours) {
        const err = new Error('JOB_CHANGE_COOLDOWN');
        err.meta = { remaining_hours: Math.ceil(cooldownHours - hoursSince) };
        throw err;
      }
    }

    // 주간 리셋 체크
    const weeklyResetAt = new Date(user.weekly_reset_at);
    if (Date.now() - weeklyResetAt.getTime() > 7 * 24 * 3600 * 1000) {
      await client.query(
        `UPDATE users SET weekly_job_changes = 0, weekly_reset_at = NOW() WHERE wallet_address = $1`,
        [walletAddress]
      );
      user.weekly_job_changes = 0;
    }

    // 무료/유료 판단 (첫 선택은 항상 무료)
    const isFirstChoice = !user.current_job_id;
    const weeklyLimit = await getSettingIntClient(client, 'job_change_weekly_free', 1);
    const isFree = isFirstChoice || user.weekly_job_changes < weeklyLimit;
    let costPaid = 0;

    if (!isFree) {
      const cost = await getSettingIntClient(client, 'job_change_cost_gp', 50);
      const gpBalance = parseInt(user.gp_balance) || 0;
      if (gpBalance < cost) {
        const err = new Error('INSUFFICIENT_GP');
        err.meta = { required: cost, balance: gpBalance };
        throw err;
      }
      await client.query(
        `UPDATE users SET gp_balance = gp_balance - $1 WHERE wallet_address = $2`,
        [cost, walletAddress]
      );
      costPaid = cost;
    }

    const fromJobId = user.current_job_id;

    // 직업 변경
    await client.query(`
      UPDATE users SET
        current_job_id = $1,
        job_selected_at = COALESCE(job_selected_at, NOW()),
        job_changed_at = NOW(),
        weekly_job_changes = weekly_job_changes + 1
      WHERE wallet_address = $2
    `, [job.id, walletAddress]);

    // 변경 로그
    await client.query(`
      INSERT INTO job_change_log (wallet_address, from_job_id, to_job_id, change_type, gp_cost)
      VALUES ($1, $2, $3, $4, $5)
    `, [walletAddress, fromJobId, job.id, 
        isFirstChoice ? 'onboarding' : (isFree ? 'free' : 'paid'), 
        costPaid]);

    await client.query('COMMIT');

    // 캐시 무효화
    invalidateJobCache(walletAddress);

    return {
      success: true,
      job_code: job.code,
      job_name_ko: job.name_ko,
      icon_emoji: job.icon_emoji,
      is_first_choice: isFirstChoice,
      is_free: isFree,
      cost_paid: costPaid,
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ─── 캐시 무효화 ───

function invalidateJobCache(walletAddress) {
  for (const key of jobBuffCache.keys()) {
    if (key.startsWith(`${walletAddress}:`)) {
      jobBuffCache.delete(key);
    }
  }
}

// ─── job_system_enabled 체크 ───

let jobSystemEnabledCache = null;
let jobSystemEnabledAt = 0;

async function isJobSystemEnabled() {
  if (jobSystemEnabledAt > Date.now()) return jobSystemEnabledCache;
  try {
    const { rows } = await pool.query(
      `SELECT value FROM settings WHERE key = 'job_system_enabled'`
    );
    const val = rows[0]?.value;
    jobSystemEnabledCache = val === true || val === 'true' || val === '"true"';
    jobSystemEnabledAt = Date.now() + 60000; // 1분 캐시
    return jobSystemEnabledCache;
  } catch { return true; }
}

// ─── 헬퍼 ───

async function getSettingInt(key, fallback) {
  try {
    const { rows } = await pool.query(`SELECT value FROM settings WHERE key = $1`, [key]);
    if (!rows[0]) return fallback;
    const v = String(rows[0].value).replace(/"/g, '');
    const n = parseInt(v, 10);
    return isNaN(n) ? fallback : n;
  } catch { return fallback; }
}

async function getSettingIntClient(client, key, fallback) {
  try {
    const { rows } = await client.query(`SELECT value FROM settings WHERE key = $1`, [key]);
    if (!rows[0]) return fallback;
    const v = String(rows[0].value).replace(/"/g, '');
    const n = parseInt(v, 10);
    return isNaN(n) ? fallback : n;
  } catch { return fallback; }
}

module.exports = {
  getJobBuff,
  getAllJobBuffs,
  listJobs,
  getAllJobs: listJobs,   // 구버전 routes/job.js 호환 별칭
  getMyJob,
  getUserJob: getMyJob,  // 구버전 routes/job.js 호환 별칭
  selectJob,
  invalidateJobCache,
};
