/**
 * services/title.js
 * User Title (칭호) 시스템 (BIBLE Migration 088)
 *
 * 함수 목록:
 *  - awardTitle(wallet, titleCode, titleData)           → 칭호 부여
 *  - checkAndAwardTitles(wallet, actionType, actionData) → 액션별 칭호 체크
 *  - getUserTitles(wallet)                               → 보유 칭호 목록
 *  - equipTitle(wallet, titleCode)                       → 칭호 장착
 *  - getEquippedTitle(wallet)                            → 현재 장착 칭호
 *  - recordHallOfFame(category, data)                   → Hall of Fame 기록
 *  - getHallOfFame(category, limit)                     → HoF 조회
 *
 * ⚠️  users.id 없음 → wallet_address VARCHAR(42) 기반
 */

'use strict';

const { pool, getSetting } = require('../db');

// Chronicle 서비스 (없으면 무시)
let chronicleService;
try { chronicleService = require('./chronicle'); } catch (_) {}

// ── 칭호 마스터 정의 ──
const TITLE_DEFINITIONS = {
  // 영토
  landowner:        { en: 'Landowner',       ko: '영토주',       ja: '地主',        zh: '地主' },
  colonizer:        { en: 'Colonizer',        ko: '식민지개척자', ja: '開拓者',      zh: '殖民者' },
  territory_king:   { en: 'Territory King',   ko: '영토왕',       ja: '領土王',      zh: '领土之王' },
  // 공성전
  siege_victor:     { en: 'Siege Victor',     ko: '공성전 승자',  ja: '攻城戦の勝者', zh: '攻城胜者' },
  governor:         { en: 'Governor',         ko: '총독',         ja: '総督',        zh: '总督' },
  iron_governor:    { en: 'Iron Governor',    ko: '철혈 총독',    ja: '鉄の総督',    zh: '铁腕总督' },
  eternal_governor: { en: 'Eternal Governor', ko: '영원한 총독',  ja: '永遠の総督',  zh: '永恒总督' },
  // 강화
  master_crafter:   { en: 'Master Crafter',   ko: '마스터 장인',  ja: 'マスター職人', zh: '大师工匠' },
  // 거래
  merchant:         { en: 'Merchant',         ko: '상인',         ja: '商人',        zh: '商人' },
  tycoon:           { en: 'Tycoon',           ko: '거물',         ja: 'タイクーン',  zh: '大亨' },
  // 전투
  warlord:          { en: 'Warlord',          ko: '전쟁군주',     ja: '軍閥',        zh: '军阀' },
  // 길드
  guild_master:     { en: 'Guild Master',     ko: '길드 마스터',  ja: 'ギルドマスター', zh: '公会长' },
  // 시즌
  season_champion:  { en: 'Season Champion',  ko: '시즌 챔피언',  ja: 'シーズン王者', zh: '赛季冠军' },
  // ACE 명예 (클라 ACE 미니게임 — 코스메틱 전용, 이미지 에셋 0)
  ace_recruit:      { en: 'Ace Recruit',      ko: '에이스 신병',  ja: 'エース新兵',   zh: '王牌新兵' },
  ace_pilot:        { en: 'Ace Pilot',        ko: '에이스 파일럿', ja: 'エースパイロット', zh: '王牌飞行员' },
  ace_veteran:      { en: 'Ace Veteran',      ko: '에이스 베테랑', ja: 'エースベテラン', zh: '王牌老兵' },
  top_gun:          { en: 'Top Gun',          ko: '톱건',         ja: 'トップガン',   zh: '头号王牌' },
  ace_ace:          { en: 'Double Ace',       ko: '더블 에이스',  ja: 'ダブルエース', zh: '双料王牌' }
};

// ── 중요 칭호 (Chronicle 기록 대상) ──
const CHRONICLE_TITLES = new Set([
  'siege_victor', 'iron_governor', 'eternal_governor',
  'master_crafter', 'tycoon', 'warlord', 'season_champion'
]);

// ─────────────────────────────────────────────────────────────
// 1. 칭호 부여
// ─────────────────────────────────────────────────────────────
async function awardTitle(wallet, titleCode, titleData = {}) {
  const w = wallet.toLowerCase();
  const def = TITLE_DEFINITIONS[titleCode];
  if (!def) {
    console.warn(`[TITLE] Unknown title code: ${titleCode}`);
    return { success: false, error: 'unknown_title' };
  }

  const titleEn = titleData.title_en || def.en;
  const titleKo = titleData.title_ko || def.ko;
  const titleJa = titleData.title_ja || def.ja;
  const titleZh = titleData.title_zh || def.zh;
  const seasonId = titleData.season_id || null;

  try {
    const res = await pool.query(
      `INSERT INTO user_titles (user_wallet, title_code, title_en, title_ko, title_ja, title_zh, season_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (user_wallet, title_code) DO NOTHING
       RETURNING id, (xmax = 0) AS is_new`,
      [w, titleCode, titleEn, titleKo, titleJa, titleZh, seasonId]
    );

    const isNew = res.rows[0]?.is_new ?? false;
    if (!isNew) return { success: true, already_owned: true };

    console.log(`[TITLE] Awarded "${titleCode}" to ${w}`);

    // Chronicle 기록 (중요 칭호만)
    if (isNew && CHRONICLE_TITLES.has(titleCode) && chronicleService) {
      chronicleService.record('title_earned', {
        actor_wallet: w,
        extra: { title_code: titleCode, title_en: titleEn }
      }).catch(() => {});
    }

    return { success: true, title_code: titleCode, title_en: titleEn };
  } catch (err) {
    console.error('[TITLE] awardTitle error:', err.message);
    return { success: false, error: 'internal_error' };
  }
}

// ─────────────────────────────────────────────────────────────
// 2. 액션별 칭호 체크 + 자동 부여
// ─────────────────────────────────────────────────────────────
async function checkAndAwardTitles(wallet, actionType, actionData = {}) {
  const w = wallet.toLowerCase();
  try {
    switch (actionType) {

      case 'first_territory': {
        // 첫 영토 점령
        const res = await pool.query(
          'SELECT COUNT(*) AS cnt FROM claims WHERE owner = $1 AND deleted_at IS NULL',
          [w]
        );
        if (parseInt(res.rows[0]?.cnt ?? 0) >= 1) {
          await awardTitle(w, 'landowner');
        }
        break;
      }

      case 'territory_milestone': {
        // 영토 수 마일스톤 (10개, 50개)
        const cnt = actionData.count || 0;
        if (cnt >= 10) await awardTitle(w, 'colonizer');
        if (cnt >= 50) await awardTitle(w, 'territory_king');
        break;
      }

      case 'siege_win': {
        // 공성전 승리
        await awardTitle(w, 'siege_victor');
        // Governor 취임
        await awardTitle(w, 'governor');
        break;
      }

      case 'governor_days': {
        // 총독 재임 일수
        const days = actionData.days || 0;
        if (days >= 7)  await awardTitle(w, 'iron_governor');
        if (days >= 30) await awardTitle(w, 'eternal_governor');
        break;
      }

      case 'enhancement_10': {
        // +10 강화 달성
        await awardTitle(w, 'master_crafter');
        break;
      }

      case 'marketplace_sales': {
        // 마켓 거래 수
        const sales = actionData.count || 0;
        if (sales >= 10)  await awardTitle(w, 'merchant');
        if (sales >= 100) await awardTitle(w, 'tycoon');
        break;
      }

      case 'hijack_kills': {
        // 탈취 횟수
        const kills = actionData.count || 0;
        if (kills >= 50) await awardTitle(w, 'warlord');
        break;
      }

      case 'guild_master': {
        await awardTitle(w, 'guild_master');
        break;
      }

      case 'season_rank_1': {
        await awardTitle(w, 'season_champion', { season_id: actionData.season_id });
        break;
      }

      default:
        // 알 수 없는 액션은 조용히 무시
        break;
    }
  } catch (err) {
    console.error('[TITLE] checkAndAwardTitles error:', err.message);
  }
}

// ─────────────────────────────────────────────────────────────
// 3. 보유 칭호 목록
// ─────────────────────────────────────────────────────────────
async function getUserTitles(wallet) {
  const res = await pool.query(
    `SELECT * FROM user_titles WHERE user_wallet = $1 ORDER BY earned_at DESC`,
    [wallet.toLowerCase()]
  );
  return res.rows;
}

// ─────────────────────────────────────────────────────────────
// 4. 칭호 장착 (20 GP)
// ─────────────────────────────────────────────────────────────
async function equipTitle(wallet, titleCode) {
  const w = wallet.toLowerCase();
  const gpCost = parseInt(await getSetting('title_equip_cost_gp') ?? '20');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 칭호 보유 확인
    const titleRes = await client.query(
      'SELECT id FROM user_titles WHERE user_wallet = $1 AND title_code = $2',
      [w, titleCode]
    );
    if (!titleRes.rows.length) {
      await client.query('ROLLBACK');
      return { success: false, error: 'title_not_owned' };
    }

    // 이미 장착 중인지 확인 (장착 → 무료 해제)
    const alreadyEquipped = await client.query(
      'SELECT id FROM user_titles WHERE user_wallet = $1 AND title_code = $2 AND is_equipped = TRUE',
      [w, titleCode]
    );
    if (alreadyEquipped.rows.length) {
      // 해제
      await client.query(
        'UPDATE user_titles SET is_equipped = FALSE WHERE user_wallet = $1 AND title_code = $2',
        [w, titleCode]
      );
      await client.query('COMMIT');
      return { success: true, equipped: false };
    }

    // GP 차감
    const userRes = await client.query(
      'SELECT gp_balance FROM users WHERE LOWER(wallet_address) = LOWER($1) FOR UPDATE',
      [w]
    );
    const gp = parseFloat(userRes.rows[0]?.gp_balance ?? 0);
    if (gp < gpCost) {
      await client.query('ROLLBACK');
      return { success: false, error: 'insufficient_gp', required: gpCost, current: gp };
    }
    const tlDeduct = await client.query(
      'UPDATE users SET gp_balance = gp_balance - $1 WHERE LOWER(wallet_address) = LOWER($2) AND gp_balance >= $1',
      [gpCost, w]
    );
    if (tlDeduct.rowCount === 0) { await client.query('ROLLBACK'); return { success: false, error: 'INSUFFICIENT_GP', required: gpCost }; }

    // 기존 장착 해제 + 새 장착
    await client.query(
      'UPDATE user_titles SET is_equipped = FALSE WHERE user_wallet = $1',
      [w]
    );
    await client.query(
      'UPDATE user_titles SET is_equipped = TRUE WHERE user_wallet = $1 AND title_code = $2',
      [w, titleCode]
    );

    await client.query('COMMIT');
    return { success: true, equipped: true, gp_spent: gpCost };
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[TITLE] equipTitle error:', err.message);
    return { success: false, error: 'internal_error' };
  } finally {
    client.release();
  }
}

// ─────────────────────────────────────────────────────────────
// 5. 현재 장착 칭호 조회
// ─────────────────────────────────────────────────────────────
async function getEquippedTitle(wallet) {
  const res = await pool.query(
    'SELECT * FROM user_titles WHERE user_wallet = $1 AND is_equipped = TRUE LIMIT 1',
    [wallet.toLowerCase()]
  );
  return res.rows[0] || null;
}

// ─────────────────────────────────────────────────────────────
// 6. Hall of Fame 기록
// ─────────────────────────────────────────────────────────────
async function recordHallOfFame(category, data = {}) {
  try {
    await pool.query(
      `INSERT INTO hall_of_fame
         (category, user_wallet, guild_id, sector_code, value_numeric,
          description_en, description_ko, description_ja, description_zh,
          season_id, is_all_time, is_featured)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [
        category,
        data.user_wallet ? data.user_wallet.toLowerCase() : null,
        data.guild_id || null,
        data.sector_code || null,
        data.value_numeric != null ? data.value_numeric : null,
        data.description_en || null,
        data.description_ko || null,
        data.description_ja || null,
        data.description_zh || null,
        data.season_id || null,
        data.is_all_time || false,
        data.is_featured || false
      ]
    );
    return { success: true };
  } catch (err) {
    console.error('[TITLE] recordHallOfFame error:', err.message);
    return { success: false };
  }
}

// ─────────────────────────────────────────────────────────────
// 7. Hall of Fame 조회
// ─────────────────────────────────────────────────────────────
async function getHallOfFame(category = null, limit = 50) {
  const q = category
    ? `SELECT hf.*, u.nickname AS user_nickname, g.name AS guild_name
       FROM hall_of_fame hf
       LEFT JOIN users u ON u.wallet_address = hf.user_wallet
       LEFT JOIN guilds g ON g.id = hf.guild_id
       WHERE hf.category = $1
       ORDER BY hf.achieved_at DESC LIMIT $2`
    : `SELECT hf.*, u.nickname AS user_nickname, g.name AS guild_name
       FROM hall_of_fame hf
       LEFT JOIN users u ON u.wallet_address = hf.user_wallet
       LEFT JOIN guilds g ON g.id = hf.guild_id
       WHERE hf.is_featured = TRUE
       ORDER BY hf.achieved_at DESC LIMIT $1`;

  const params = category ? [category, parseInt(limit)] : [parseInt(limit)];
  const res = await pool.query(q, params);
  return res.rows;
}

// ─────────────────────────────────────────────────────────────
// 8. Governor 재임 일수 체크 (스케줄러에서 호출)
// ─────────────────────────────────────────────────────────────
async function checkGovernorTitleMilestones() {
  try {
    const res = await pool.query(
      `SELECT sg.governor_wallet, sg.governor_since,
              EXTRACT(DAY FROM NOW() - sg.governor_since)::INT AS days
       FROM sector_governance sg
       WHERE sg.governor_wallet IS NOT NULL AND sg.governor_since IS NOT NULL`
    );
    for (const row of res.rows) {
      await checkAndAwardTitles(row.governor_wallet, 'governor_days', { days: row.days });
    }
  } catch (err) {
    console.error('[TITLE] checkGovernorTitleMilestones error:', err.message);
  }
}

module.exports = {
  awardTitle,
  checkAndAwardTitles,
  getUserTitles,
  equipTitle,
  getEquippedTitle,
  recordHallOfFame,
  getHallOfFame,
  checkGovernorTitleMilestones,
  TITLE_DEFINITIONS
};
