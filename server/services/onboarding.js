// server/services/onboarding.js
// ═══════════════════════════════════════════════════════════════
// Onboarding Service — COMPLETE_BIBLE PART 5 § 3 기준
//
// 5단계 온보딩:
//   STEP 0: 착륙 (인트로)
//   STEP 1: 직업 선택
//   STEP 2: 첫 영토 점령 (무료)
//   STEP 3: 위협 경험 + Basic Shield 지급
//   STEP 4: 길드 가입 유도
//   STEP 5: 첫 미션 + 완료 보상
// ═══════════════════════════════════════════════════════════════

const { pool } = require('../db');
let titleExt; try { titleExt = require('./titleExtended'); } catch (_) {}

// ─── 온보딩 상태 조회 ───

async function getOnboardingStatus(walletAddress) {
  const enabled = await isOnboardingEnabled();

  const { rows } = await pool.query(`
    SELECT o.*,
           j.code AS job_code, j.name_ko AS job_name_ko, j.icon_emoji
    FROM user_onboarding o
    LEFT JOIN jobs j ON j.code = o.job_selected
    WHERE o.wallet_address = $1
  `, [walletAddress]);

  if (!rows[0]) {
    // 온보딩 레코드 없으면 신규 유저 — 자동 생성
    return await createOnboarding(walletAddress);
  }

  const o = rows[0];
  return {
    ...o,
    enabled,
    is_new: false,
    progress_pct: Math.round((o.current_step / 5) * 100),
  };
}

async function createOnboarding(walletAddress) {
  const { rows } = await pool.query(`
    INSERT INTO user_onboarding (wallet_address, current_step)
    VALUES ($1, 0)
    ON CONFLICT (wallet_address) DO UPDATE SET updated_at = NOW()
    RETURNING *
  `, [walletAddress]);

  return {
    ...rows[0],
    enabled: true,
    is_new: true,
    progress_pct: 0,
  };
}

// ─── 스텝 진행 ───

/**
 * 각 스텝 완료 처리
 * @param {string} walletAddress
 * @param {number} step  - 완료한 스텝 번호
 * @param {object} data  - 스텝별 추가 데이터
 */
async function completeStep(walletAddress, step, data = {}) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: oRows } = await client.query(`
      SELECT * FROM user_onboarding WHERE wallet_address = $1 FOR UPDATE
    `, [walletAddress]);

    let onboarding = oRows[0];
    if (!onboarding) {
      // 없으면 생성
      const { rows: newRows } = await client.query(`
        INSERT INTO user_onboarding (wallet_address, current_step)
        VALUES ($1, 0) RETURNING *
      `, [walletAddress]);
      onboarding = newRows[0];
    }

    if (onboarding.completed || onboarding.skipped) {
      return { success: false, error: 'ALREADY_DONE' };
    }

    // 순서 체크: 현재 스텝 이상만 처리
    if (step < onboarding.current_step) {
      return { success: true, already_done: true };
    }

    const updates = { current_step: step + 1, updated_at: 'NOW()' };
    const rewards = [];

    // ── 스텝별 처리 ──

    if (step === 1 && data.job_code) {
      // STEP 1: 직업 선택 완료
      updates.job_selected = data.job_code;

      // 직업 서비스 호출
      try {
        const jobService = require('./job');
        await jobService.selectJob(walletAddress, data.job_code);
      } catch (e) {
        // 이미 직업 있으면 무시
        if (e.message !== 'SAME_JOB') throw e;
      }
    }

    if (step === 2 && data.claim_id) {
      // STEP 2: 첫 영토 점령 완료
      updates.tutorial_claim_id = data.claim_id;

      // PP 보상 지급
      if (!onboarding.pp_rewarded) {
        const ppReward = await getSettingFloat(client, 'onboarding_pp_reward', 0.5);
        await client.query(
          `UPDATE users SET pp_balance = pp_balance + $1 WHERE wallet_address = $2`,
          [ppReward, walletAddress]
        );
        updates.pp_rewarded = true;
        rewards.push({ type: 'pp', amount: ppReward });
      }
    }

    if (step === 3 && !onboarding.shield_given) {
      // STEP 3: Basic Shield 지급
      const itemType = await getSettingStr(client, 'onboarding_free_item_type', 'basic_shield');
      await giveItem(client, walletAddress, itemType, 1);
      updates.shield_given = true;
      rewards.push({ type: 'item', code: itemType, quantity: 1 });
    }

    if (step === 5) {
      // STEP 5: 온보딩 완료 — 최종 보상
      const gpReward = await getSettingInt(client, 'onboarding_gp_reward', 200);

      if (!onboarding.gp_rewarded) {
        await client.query(
          `UPDATE users SET gp_balance = gp_balance + $1 WHERE wallet_address = $2`,
          [gpReward, walletAddress]
        );
        updates.gp_rewarded = true;
        rewards.push({ type: 'gp', amount: gpReward });
      }

      // 개척자 칭호 지급
      if (!onboarding.title_given) {
        const titleCode = await getSettingStr(client, 'onboarding_title_code', 'pioneer');
        await giveTitle(client, walletAddress, titleCode);
        updates.title_given = true;
        rewards.push({ type: 'title', code: titleCode, name_ko: '개척자' });
      }

      updates.completed = true;
      updates.completed_at = 'NOW()';
    }

    // DB 업데이트
    const setClauses = Object.entries(updates).map(([k, v], i) => {
      if (v === 'NOW()') return `${k} = NOW()`;
      return `${k} = $${i + 2}`;
    }).join(', ');

    const values = Object.entries(updates)
      .filter(([, v]) => v !== 'NOW()')
      .map(([, v]) => v);

    await client.query(
      `UPDATE user_onboarding SET ${setClauses} WHERE wallet_address = $1`,
      [walletAddress, ...values]
    );

    await client.query('COMMIT');

    // titleExtended: 온보딩 완료 시 개척자 칭호 (non-blocking)
    if (step === 5 && titleExt) {
      titleExt.onOnboardingComplete(walletAddress).catch(() => {});
    }

    return {
      success: true,
      step_completed: step,
      next_step: step + 1,
      completed: step === 5,
      rewards,
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ─── 온보딩 스킵 ───

async function skipOnboarding(walletAddress) {
  const skipAllowed = await getSettingStr(null, 'onboarding_skip_allowed', 'true');
  if (skipAllowed !== 'true') {
    throw new Error('SKIP_NOT_ALLOWED');
  }

  await pool.query(`
    UPDATE user_onboarding 
    SET skipped = true, skipped_at = NOW(), updated_at = NOW()
    WHERE wallet_address = $1
  `, [walletAddress]);

  return { success: true, skipped: true };
}

// ─── 추천 길드 (STEP 4용) ───

async function getRecommendedGuilds(walletAddress) {
  // 유저 직업에 따라 추천
  const { rows: userRows } = await pool.query(`
    SELECT o.job_selected
    FROM user_onboarding o
    WHERE o.wallet_address = $1
  `, [walletAddress]);

  const jobCode = userRows[0]?.job_selected;

  // 활성 길드 중 멤버 수 많은 순 3개
  const { rows } = await pool.query(`
    SELECT g.id, g.name, g.member_count, g.description,
           g.faction_code,
           CASE 
             WHEN $1 = 'miner'    AND g.name ILIKE '%mine%' THEN 1
             WHEN $1 = 'warrior'  AND g.name ILIKE '%war%'  THEN 1
             WHEN $1 = 'crafter'  AND g.name ILIKE '%craft%' THEN 1
             WHEN $1 = 'merchant' AND g.name ILIKE '%trade%' THEN 1
             ELSE 0
           END AS job_match
    FROM guilds g
    WHERE g.disbanded_at IS NULL
      AND g.member_count > 0
    ORDER BY job_match DESC, g.member_count DESC
    LIMIT 3
  `, [jobCode || 'miner']).catch(() => ({ rows: [] }));

  return rows;
}

// ─── 직업별 추천 섹터 ───

const JOB_SECTOR_MAP = {
  miner:    { code: 'arcadia_ridge',   name: 'Arcadia Ridge',  reason_ko: '자원이 풍부합니다.' },
  warrior:  { code: 'coprates_ridge',  name: 'Coprates Ridge', reason_ko: '전투가 활발합니다.' },
  crafter:  { code: 'ascraeus_vault',  name: 'Ascraeus Vault', reason_ko: '강화 비용이 저렴합니다.' },
  merchant: { code: 'pavonis_gate',    name: 'Pavonis Gate',   reason_ko: '거래가 가장 많습니다.' },
};

function getRecommendedSector(jobCode) {
  return JOB_SECTOR_MAP[jobCode] || JOB_SECTOR_MAP['miner'];
}

// ─── 직업별 첫 미션 ───

const JOB_FIRST_MISSION = {
  miner:    { action: 'harvest',   desc_ko: '4시간 후 첫 Harvest',         gp_reward: 50 },
  warrior:  { action: 'hijack',    desc_ko: '이번 주 첫 Hijack 시도',       gp_reward: 100 },
  crafter:  { action: 'enhance',   desc_ko: 'Enhancement +1 시도',          gp_reward: 50 },
  merchant: { action: 'listing',   desc_ko: '마켓에 첫 아이템 등록',         gp_reward: 30 },
};

function getFirstMission(jobCode) {
  return JOB_FIRST_MISSION[jobCode] || JOB_FIRST_MISSION['miner'];
}

// ─── 내부 헬퍼 ───

async function giveItem(client, walletAddress, itemCode, quantity) {
  try {
    // item_types 테이블에서 ID 조회
    const { rows: typeRows } = await client.query(
      `SELECT id FROM item_types WHERE code = $1`, [itemCode]
    );
    if (!typeRows[0]) {
      console.warn(`[onboarding] giveItem: item_type not found for code=${itemCode}`);
      return;
    }
    const itemTypeId = typeRows[0].id;

    await client.query(`
      INSERT INTO user_items (wallet, item_type_id, quantity)
      VALUES ($1, $2, $3)
      ON CONFLICT (wallet, item_type_id)
      DO UPDATE SET quantity = user_items.quantity + $3
    `, [walletAddress, itemTypeId, quantity]);
  } catch (e) {
    console.warn(`[onboarding] giveItem failed: ${itemCode} — ${e.message}`);
  }
}

async function giveTitle(client, walletAddress, titleCode) {
  // user_titles 테이블에 칭호 지급
  try {
    await client.query(`
      INSERT INTO user_titles (user_wallet, title_code, title_ko, title_en, is_equipped)
      VALUES ($1, $2, '개척자', 'Pioneer', true)
      ON CONFLICT (user_wallet, title_code) DO NOTHING
    `, [walletAddress, titleCode]);
  } catch (e) {
    console.warn(`[onboarding] giveTitle failed — ${e.message}`);
  }
}

async function isOnboardingEnabled() {
  try {
    const { rows } = await pool.query(
      `SELECT value FROM settings WHERE key = 'onboarding_enabled'`
    );
    const v = rows[0]?.value;
    return v === true || v === 'true' || v === '"true"';
  } catch { return true; }
}

async function getSettingInt(client, key, fallback) {
  try {
    const q = client
      ? client.query(`SELECT value FROM settings WHERE key = $1`, [key])
      : pool.query(`SELECT value FROM settings WHERE key = $1`, [key]);
    const { rows } = await q;
    if (!rows[0]) return fallback;
    const n = parseInt(String(rows[0].value).replace(/"/g, ''), 10);
    return isNaN(n) ? fallback : n;
  } catch { return fallback; }
}

async function getSettingFloat(client, key, fallback) {
  try {
    const q = client
      ? client.query(`SELECT value FROM settings WHERE key = $1`, [key])
      : pool.query(`SELECT value FROM settings WHERE key = $1`, [key]);
    const { rows } = await q;
    if (!rows[0]) return fallback;
    const n = parseFloat(String(rows[0].value).replace(/"/g, ''));
    return isNaN(n) ? fallback : n;
  } catch { return fallback; }
}

async function getSettingStr(client, key, fallback) {
  try {
    const q = client
      ? client.query(`SELECT value FROM settings WHERE key = $1`, [key])
      : pool.query(`SELECT value FROM settings WHERE key = $1`, [key]);
    const { rows } = await q;
    if (!rows[0]) return fallback;
    return String(rows[0].value).replace(/^"|"$/g, '') || fallback;
  } catch { return fallback; }
}

module.exports = {
  getOnboardingStatus,
  completeStep,
  skipOnboarding,
  getRecommendedGuilds,
  getRecommendedSector,
  getFirstMission,
};
