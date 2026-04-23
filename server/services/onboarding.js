/**
 * services/onboarding.js
 * 온보딩 튜토리얼 서비스 (MASTER_PLAN Phase 3 — Migration 083)
 *
 * 신규 유저 5단계 흐름 관리:
 *   Step 1: 첫 영토 점령 안내
 *   Step 2: Mining/수확 설명
 *   Step 3: 직업 소개
 *   Step 4: 길드 가입 유도
 *   Step 5: 첫 미션 안내 → 완료 → 보상
 *
 * 모든 보상 수치는 settings 테이블에서 조회. 하드코딩 금지.
 */

'use strict';

const { pool, getSetting, awardXP } = require('../db');

const TOTAL_STEPS = 5;

// ─────────────────────────────────────────────────────────────
// 1. 온보딩 상태 조회 (없으면 자동 생성)
// ─────────────────────────────────────────────────────────────
async function getOrCreateOnboarding(wallet) {
  const w = wallet.toLowerCase();

  // Check if user exists in users table first (FK constraint)
  const userCheck = await pool.query(
    'SELECT 1 FROM users WHERE wallet_address = $1', [w]
  );
  if (!userCheck.rows.length) return null;

  // Upsert: 없으면 row 생성, 있으면 기존 반환
  const res = await pool.query(
    `INSERT INTO user_onboarding (wallet_address)
     VALUES ($1)
     ON CONFLICT (wallet_address) DO UPDATE SET updated_at = user_onboarding.updated_at
     RETURNING *`,
    [w]
  );
  return res.rows[0];
}

// ─────────────────────────────────────────────────────────────
// 2. 현재 온보딩 상태 + 진행률 반환
// ─────────────────────────────────────────────────────────────
async function getOnboardingState(wallet) {
  const w = wallet.toLowerCase();

  const enabled = (await getSetting('onboarding_enabled') ?? 'true').toString() === 'true';
  if (!enabled) return { enabled: false };

  const row = await getOrCreateOnboarding(w);
  if (!row) return { enabled: false, reason: 'user_not_found' };

  const ppReward  = parseInt(await getSetting('onboarding_pp_reward')  ?? '50');
  const gpReward  = parseInt(await getSetting('onboarding_gp_reward')  ?? '100');
  const xpReward  = parseInt(await getSetting('onboarding_xp_reward')  ?? '200');
  const skipOk    = (await getSetting('onboarding_skip_allowed') ?? 'true').toString() === 'true';
  const freeClaimEnabled = (await getSetting('onboarding_free_claim_enabled') ?? 'true').toString() === 'true';

  return {
    enabled: true,
    currentStep: row.current_step,
    totalSteps: TOTAL_STEPS,
    completed: row.completed,
    skipped: row.skipped,
    rewardClaimed: row.reward_claimed,
    tutorialClaimId: row.tutorial_claim_id,
    stepCompletedAt: row.step_completed_at || {},
    skippedAt: row.skipped_at,
    completedAt: row.completed_at,
    skipAllowed: skipOk,
    freeClaimEnabled,
    rewards: { pp: ppReward, gp: gpReward, xp: xpReward }
  };
}

// ─────────────────────────────────────────────────────────────
// 3. 단계 완료 처리
// ─────────────────────────────────────────────────────────────
async function completeStep(wallet, step) {
  const w = wallet.toLowerCase();

  const enabled = (await getSetting('onboarding_enabled') ?? 'true').toString() === 'true';
  if (!enabled) return { ok: false, reason: 'disabled' };

  const row = await getOrCreateOnboarding(w);
  if (!row) return { ok: false, reason: 'user_not_found' };

  if (row.completed || row.skipped) {
    return { ok: false, reason: row.completed ? 'already_completed' : 'skipped' };
  }

  // step은 현재 단계 이후여야만 유효 (1~5)
  if (step < 1 || step > TOTAL_STEPS) {
    return { ok: false, reason: 'invalid_step' };
  }
  if (step !== row.current_step + 1 && step !== row.current_step) {
    // allow re-completing current step (idempotent)
    if (step > row.current_step + 1) {
      return { ok: false, reason: 'step_skipped' };
    }
  }

  const now = new Date().toISOString();
  const newStep = Math.max(row.current_step, step);
  const newStepMap = { ...(row.step_completed_at || {}), [step]: now };

  const isComplete = newStep >= TOTAL_STEPS;

  const updateRes = await pool.query(
    `UPDATE user_onboarding
     SET current_step     = $1,
         step_completed_at = $2,
         completed        = $3,
         completed_at     = $4,
         updated_at       = NOW()
     WHERE wallet_address = $5
     RETURNING *`,
    [newStep, JSON.stringify(newStepMap), isComplete, isComplete ? now : null, w]
  );

  return {
    ok: true,
    step: newStep,
    completed: isComplete,
    state: updateRes.rows[0]
  };
}

// ─────────────────────────────────────────────────────────────
// 4. 건너뛰기
// ─────────────────────────────────────────────────────────────
async function skipOnboarding(wallet) {
  const w = wallet.toLowerCase();

  const skipOk = (await getSetting('onboarding_skip_allowed') ?? 'true').toString() === 'true';
  if (!skipOk) return { ok: false, reason: 'skip_not_allowed' };

  const row = await getOrCreateOnboarding(w);
  if (!row) return { ok: false, reason: 'user_not_found' };
  if (row.completed) return { ok: false, reason: 'already_completed' };
  if (row.skipped)   return { ok: true, reason: 'already_skipped' };

  await pool.query(
    `UPDATE user_onboarding
     SET skipped = true, skipped_at = NOW(), updated_at = NOW()
     WHERE wallet_address = $1`,
    [w]
  );
  return { ok: true };
}

// ─────────────────────────────────────────────────────────────
// 5. 완료 보상 지급 (1회만 지급, idempotent)
// ─────────────────────────────────────────────────────────────
async function claimCompletionReward(wallet) {
  const w = wallet.toLowerCase();

  const row = await getOrCreateOnboarding(w);
  if (!row.completed)      return { ok: false, reason: 'not_completed' };
  if (row.reward_claimed)  return { ok: false, reason: 'already_claimed' };

  const ppReward = parseInt(await getSetting('onboarding_pp_reward') ?? '50');
  const gpReward = parseInt(await getSetting('onboarding_gp_reward') ?? '100');
  const xpReward = parseInt(await getSetting('onboarding_xp_reward') ?? '200');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // PP 지급
    if (ppReward > 0) {
      await client.query(
        'UPDATE users SET pp_balance = pp_balance + $1 WHERE wallet_address = $2',
        [ppReward, w]
      );
      await client.query(
        `INSERT INTO transactions (from_wallet, type, pp_amount, meta)
         VALUES ($1, 'onboarding_reward', $2, $3)`,
        [w, ppReward, JSON.stringify({ source: 'onboarding_complete' })]
      );
    }

    // GP 지급
    if (gpReward > 0) {
      await client.query(
        'UPDATE users SET gp_balance = gp_balance + $1 WHERE wallet_address = $2',
        [gpReward, w]
      );
    }

    // XP 지급
    let levelUp = null;
    if (xpReward > 0) {
      const xpResult = await awardXP(client, w, xpReward);
      if (xpResult && xpResult.newLevel > xpResult.oldLevel) {
        levelUp = xpResult;
      }
    }

    // 보상 지급 완료 플래그
    await client.query(
      `UPDATE user_onboarding SET reward_claimed = true, updated_at = NOW()
       WHERE wallet_address = $1`,
      [w]
    );

    await client.query('COMMIT');

    const bal = await pool.query(
      'SELECT pp_balance, gp_balance FROM users WHERE wallet_address = $1',
      [w]
    );

    return {
      ok: true,
      rewards: { pp: ppReward, gp: gpReward, xp: xpReward },
      ppBalance: parseFloat(bal.rows[0]?.pp_balance ?? 0),
      gpBalance: parseInt(bal.rows[0]?.gp_balance ?? 0),
      levelUp
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ─────────────────────────────────────────────────────────────
// 6. 튜토리얼 클레임 ID 저장 (claims 테이블의 id 기록)
// ─────────────────────────────────────────────────────────────
async function recordTutorialClaim(wallet, claimId) {
  const w = wallet.toLowerCase();
  await pool.query(
    `UPDATE user_onboarding SET tutorial_claim_id = $1, updated_at = NOW()
     WHERE wallet_address = $2`,
    [claimId, w]
  );
}

// ─────────────────────────────────────────────────────────────
// 7. 어드민 통계
// ─────────────────────────────────────────────────────────────
async function getOnboardingStats() {
  const res = await pool.query(`
    SELECT
      COUNT(*)                                               AS total,
      COUNT(*) FILTER (WHERE completed = true)              AS completed,
      COUNT(*) FILTER (WHERE skipped  = true)               AS skipped,
      COUNT(*) FILTER (WHERE completed = false AND skipped = false) AS in_progress,
      COUNT(*) FILTER (WHERE reward_claimed = true)         AS reward_claimed,
      ROUND(
        COUNT(*) FILTER (WHERE completed = true)::NUMERIC /
        NULLIF(COUNT(*), 0) * 100, 1
      )                                                     AS completion_rate_pct,
      -- 단계별 완료 현황
      COUNT(*) FILTER (WHERE current_step >= 1)             AS reached_step1,
      COUNT(*) FILTER (WHERE current_step >= 2)             AS reached_step2,
      COUNT(*) FILTER (WHERE current_step >= 3)             AS reached_step3,
      COUNT(*) FILTER (WHERE current_step >= 4)             AS reached_step4,
      COUNT(*) FILTER (WHERE current_step >= 5)             AS reached_step5
    FROM user_onboarding
  `);

  const recent = await pool.query(`
    SELECT uo.wallet_address, u.nickname, uo.current_step, uo.completed,
           uo.skipped, uo.created_at, uo.completed_at
    FROM user_onboarding uo
    LEFT JOIN users u ON u.wallet_address = uo.wallet_address
    ORDER BY uo.created_at DESC
    LIMIT 50
  `);

  return {
    stats: res.rows[0],
    recent: recent.rows
  };
}

module.exports = {
  getOrCreateOnboarding,
  getOnboardingState,
  completeStep,
  skipOnboarding,
  claimCompletionReward,
  recordTutorialClaim,
  getOnboardingStats
};
