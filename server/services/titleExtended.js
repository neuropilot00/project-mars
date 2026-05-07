// server/services/titleExtended.js
// ═══════════════════════════════════════════════════════════════
// Title System 확장 — 기존 title.js를 건드리지 않고 확장
// 바이블 COMPLETE_BIBLE PART 5 § 4 기준
//
// 추가된 칭호 (기존 title.js에 없는 것):
//   pioneer          — 온보딩 완료
//   first_colonist   — 서버 최초 영토 점령
//   domain           — 영토 1000px 이상
//   underdog         — 3배 격차 Siege 역전 승리
//   forge_legend     — Enhancement +10 3개 이상
//   grand_merchant   — 누적 거래액 10,000 GP
//   bounty_hunter    — Bounty 5개 달성
//   veteran_colonist — 180일 이상 플레이
//   iron_miner       — 누적 채굴 10,000 PP
//   deep_digger      — Deep Dig 100회
//   guild_champion   — Guild War 10회 승리
//   season_*_sN      — 시즌 종료 자동 부여
//
// Hall of Fame 심화:
//   recordHallOfFame() 래퍼 + 카테고리별 집계
//   getHallOfFameBoard() — 전체 보드
// ═══════════════════════════════════════════════════════════════

const { pool } = require('../db');

// 기존 title.js 가져오기 (있으면)
let titleService = null;
try {
  titleService = require('./title');
} catch { }

// ─── 누락 칭호 정의 ───

const EXTENDED_TITLES = {
  pioneer: {
    code: 'pioneer',
    title_en: 'Pioneer',
    title_ko: '개척자',
    title_ja: '開拓者',
    title_zh: '开拓者',
  },
  first_colonist: {
    code: 'first_colonist',
    title_en: 'First Colonist',
    title_ko: '최초 식민지 개척자',
    title_ja: '最初の入植者',
    title_zh: '第一殖民者',
  },
  domain: {
    code: 'domain',
    title_en: 'Domain',
    title_ko: '영지 영주',
    title_ja: '領地主',
    title_zh: '领主',
  },
  underdog: {
    code: 'underdog',
    title_en: 'Underdog',
    title_ko: '역전의 용사',
    title_ja: 'アンダードッグ',
    title_zh: '逆袭者',
  },
  forge_legend: {
    code: 'forge_legend',
    title_en: 'Forge Legend',
    title_ko: '단조의 전설',
    title_ja: '鍛冶の伝説',
    title_zh: '锻造传说',
  },
  grand_merchant: {
    code: 'grand_merchant',
    title_en: 'Grand Merchant',
    title_ko: '대상인',
    title_ja: '大商人',
    title_zh: '大商人',
  },
  bounty_hunter: {
    code: 'bounty_hunter',
    title_en: 'Bounty Hunter',
    title_ko: '현상금 사냥꾼',
    title_ja: '賞金稼ぎ',
    title_zh: '赏金猎人',
  },
  veteran_colonist: {
    code: 'veteran_colonist',
    title_en: 'Veteran Colonist',
    title_ko: '베테랑 개척자',
    title_ja: 'ベテラン入植者',
    title_zh: '老牌殖民者',
  },
  iron_miner: {
    code: 'iron_miner',
    title_en: 'Iron Miner',
    title_ko: '철의 광부',
    title_ja: '鉄の坑夫',
    title_zh: '铁矿工',
  },
  deep_digger: {
    code: 'deep_digger',
    title_en: 'Deep Digger',
    title_ko: '심층 채굴사',
    title_ja: 'ディープディガー',
    title_zh: '深挖者',
  },
  guild_champion: {
    code: 'guild_champion',
    title_en: 'Guild Champion',
    title_ko: '길드 챔피언',
    title_ja: 'ギルドチャンピオン',
    title_zh: '公会冠军',
  },
};

// ─── 칭호 부여 (핵심) ───

/**
 * 칭호 부여 (기존 title.js의 awardTitle 래퍼)
 * user_titles에 INSERT, UNIQUE 충돌 시 무시
 */
async function awardTitle(walletAddress, titleCode, customData = {}) {
  // EXTENDED_TITLES에 없는 칭호만 기존 title.js에 위임 (확장 칭호는 직접 처리)
  if (titleService?.awardTitle && !EXTENDED_TITLES[titleCode]) {
    try {
      return await titleService.awardTitle(walletAddress, titleCode, customData);
    } catch { }
  }

  // 직접 INSERT (확장 칭호 또는 fallback)
  const titleDef = EXTENDED_TITLES[titleCode] || customData;
  try {
    await pool.query(`
      INSERT INTO user_titles (
        user_wallet, title_code, title_en, title_ko, title_ja, title_zh,
        earned_at, is_equipped
      ) VALUES ($1,$2,$3,$4,$5,$6,NOW(),false)
      ON CONFLICT (user_wallet, title_code) DO NOTHING
    `, [
      walletAddress, titleCode,
      titleDef.title_en || titleCode,
      titleDef.title_ko || titleCode,
      titleDef.title_ja || titleCode,
      titleDef.title_zh || titleCode,
    ]);
    return { awarded: true, title_code: titleCode };
  } catch (err) {
    console.error('[titleExtended] awardTitle error:', err.message);
    return { awarded: false, error: err.message };
  }
}

// ─── 트리거별 칭호 자동 부여 ───

/**
 * 온보딩 완료 → 개척자 칭호
 */
async function onOnboardingComplete(walletAddress) {
  return awardTitle(walletAddress, 'pioneer', EXTENDED_TITLES.pioneer);
}

/**
 * 영토 점령 시 체크
 * - first_colonist: 서버 최초 영토 점령자
 * - domain: 1000px 이상
 */
async function onClaimCreated(walletAddress, totalPx) {
  const results = [];

  // 서버 최초 점령자 체크
  const { rows: hofRows } = await pool.query(
    `SELECT id FROM hall_of_fame WHERE category = 'first_colonist' LIMIT 1`
  );
  if (!hofRows[0]) {
    // 서버 최초
    results.push(await awardTitle(walletAddress, 'first_colonist', EXTENDED_TITLES.first_colonist));
    await recordHallOfFame({
      category: 'first_colonist',
      user_wallet: walletAddress,
      description_ko: '화성 서버 최초 영토 점령',
      description_en: 'First territory claim on this server',
      is_all_time: true,
      is_featured: true,
    });
  }

  // 1000px 이상
  if (totalPx >= 1000) {
    results.push(await awardTitle(walletAddress, 'domain', EXTENDED_TITLES.domain));
  }

  return results;
}

/**
 * Siege 역전 승리 → underdog
 * @param {number} challengerPx - 도전자 영토
 * @param {number} defenderPx  - 방어자 영토
 */
async function onSiegeWin(walletAddress, challengerPx, defenderPx) {
  if (defenderPx >= challengerPx * 3) {
    return awardTitle(walletAddress, 'underdog', EXTENDED_TITLES.underdog);
  }
}

/**
 * Enhancement +10 달성 시 체크
 * - forge_legend: +10 3개 이상 보유
 */
async function onMaxEnhancement(walletAddress) {
  const threshold = await getSettingInt('title_forge_legend_count', 3);
  try {
    // 기존 enhancement 관련 테이블 조회 (구조 다를 수 있음)
    const { rows } = await pool.query(`
      SELECT COUNT(*) AS cnt
      FROM user_items ui
      WHERE ui.wallet_address = $1
        AND (ui.enhancement_level >= 10 OR ui.plus_level >= 10)
    `, [walletAddress]).catch(() => ({ rows: [{ cnt: 0 }] }));

    if (parseInt(rows[0]?.cnt) >= threshold) {
      return awardTitle(walletAddress, 'forge_legend', EXTENDED_TITLES.forge_legend);
    }
  } catch { }
}

/**
 * 마켓 거래 누적 체크 → grand_merchant
 */
async function onMarketSale(walletAddress, cumulativeGp) {
  const threshold = await getSettingInt('title_grand_merchant_gp', 10000);
  if (cumulativeGp >= threshold) {
    return awardTitle(walletAddress, 'grand_merchant', EXTENDED_TITLES.grand_merchant);
  }
}

/**
 * Bounty 달성 체크 → bounty_hunter
 */
async function onBountyComplete(walletAddress, totalBounties) {
  const threshold = await getSettingInt('title_bounty_hunter_count', 5);
  if (totalBounties >= threshold) {
    return awardTitle(walletAddress, 'bounty_hunter', EXTENDED_TITLES.bounty_hunter);
  }
}

/**
 * 플레이 일수 체크 → veteran_colonist (스케줄러 호출)
 */
async function checkVeteranTitles() {
  const days = await getSettingInt('title_veteran_days', 180);
  const { rows } = await pool.query(`
    SELECT wallet_address FROM users
    WHERE created_at <= NOW() - INTERVAL '1 day' * $1
      AND wallet_address NOT IN (
        SELECT user_wallet FROM user_titles WHERE title_code = 'veteran_colonist'
      )
  `, [days]);

  for (const row of rows) {
    await awardTitle(row.wallet_address, 'veteran_colonist', EXTENDED_TITLES.veteran_colonist);
  }
  return rows.length;
}

/**
 * 채굴 누적 체크 → iron_miner
 */
async function onMiningAccumulate(walletAddress, totalPp) {
  const threshold = await getSettingInt('title_iron_miner_pp', 10000);
  if (totalPp >= threshold) {
    return awardTitle(walletAddress, 'iron_miner', EXTENDED_TITLES.iron_miner);
  }
}

/**
 * Deep Dig 횟수 체크 → deep_digger
 */
async function onDeepDig(walletAddress, totalCount) {
  const threshold = await getSettingInt('title_deep_digger_count', 100);
  if (totalCount >= threshold) {
    return awardTitle(walletAddress, 'deep_digger', EXTENDED_TITLES.deep_digger);
  }
}

/**
 * Guild War 승리 체크 → guild_champion
 */
async function onGuildWarWin(walletAddress, totalWins) {
  const threshold = await getSettingInt('title_guild_champion_count', 10);
  if (totalWins >= threshold) {
    return awardTitle(walletAddress, 'guild_champion', EXTENDED_TITLES.guild_champion);
  }
}

// ─── 시즌 종료 칭호 자동 부여 ───

/**
 * 시즌 종료 시 호출 — 상위 플레이어에게 시즌 칭호 부여
 * @param {number} seasonId
 * @param {number} seasonNum
 */
async function awardSeasonTitles(seasonId, seasonNum) {
  const N = seasonNum;
  const results = [];

  // 각 카테고리별 1위 조회 + 칭호 부여
  const categories = [
    {
      query: `SELECT wallet_address FROM users ORDER BY pp_balance DESC LIMIT 1`,
      code: `season_champion_s${N}`,
      nameKo: `시즌 ${N} 챔피언`,
      nameEn: `Season ${N} Champion`,
      hofCategory: 'season_champion',
    },
    {
      query: `
        SELECT actor_wallet AS wallet_address FROM server_chronicles
        WHERE event_type LIKE '%mining%' AND season_id = ${seasonId}
        GROUP BY actor_wallet ORDER BY SUM(value_pp) DESC LIMIT 1
      `,
      code: `mining_legend_s${N}`,
      nameKo: `시즌 ${N} 채굴 전설`,
      nameEn: `Season ${N} Mining Legend`,
      hofCategory: 'season_mining',
    },
    {
      query: `
        SELECT actor_wallet AS wallet_address FROM server_chronicles
        WHERE event_type = 'large_hijack' AND season_id = ${seasonId}
        GROUP BY actor_wallet ORDER BY COUNT(*) DESC LIMIT 1
      `,
      code: `conqueror_s${N}`,
      nameKo: `시즌 ${N} 정복자`,
      nameEn: `Season ${N} Conqueror`,
      hofCategory: 'season_conqueror',
    },
  ];

  for (const cat of categories) {
    try {
      const { rows } = await pool.query(cat.query);
      if (!rows[0]?.wallet_address) continue;

      const wallet = rows[0].wallet_address;
      await awardTitle(wallet, cat.code, {
        title_en: cat.nameEn,
        title_ko: cat.nameKo,
        title_ja: cat.nameEn,
        title_zh: cat.nameEn,
        season_id: seasonId,
      });

      await recordHallOfFame({
        category: cat.hofCategory,
        user_wallet: wallet,
        season_id: seasonId,
        description_ko: cat.nameKo,
        description_en: cat.nameEn,
        is_all_time: false,
        is_featured: true,
      });

      results.push({ category: cat.code, wallet });
    } catch (err) {
      console.error(`[titleExtended] season title ${cat.code} error:`, err.message);
    }
  }

  return results;
}

// ─── Hall of Fame ───

/**
 * Hall of Fame 기록
 */
async function recordHallOfFame(params) {
  // 기존 title.js에 있으면 위임
  if (titleService?.recordHallOfFame) {
    try { return await titleService.recordHallOfFame(params); } catch { }
  }

  const {
    category, user_wallet, guild_id, sector_code,
    value_numeric, description_ko, description_en,
    season_id, is_all_time = false, is_featured = false,
    rank_position, extra_data = {},
  } = params;

  const { rows } = await pool.query(`
    INSERT INTO hall_of_fame (
      category, user_wallet, guild_id, sector_code,
      value_numeric, description_ko, description_en,
      season_id, is_all_time, is_featured,
      rank_position, extra_data, achieved_at
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,NOW())
    RETURNING id
  `, [
    category, user_wallet || null, guild_id || null, sector_code || null,
    value_numeric || null, description_ko, description_en,
    season_id || null, is_all_time, is_featured,
    rank_position || null, JSON.stringify(extra_data),
  ]);

  return rows[0];
}

/**
 * Hall of Fame 전체 보드
 */
async function getHallOfFameBoard(options = {}) {
  const { category, seasonId, limit = 20, allTime = false } = options;

  let where = 'WHERE 1=1';
  const params = [];

  if (category) {
    params.push(category);
    where += ` AND h.category = $${params.length}`;
  }
  if (seasonId) {
    params.push(seasonId);
    where += ` AND h.season_id = $${params.length}`;
  }
  if (allTime) {
    where += ' AND h.is_all_time = true';
  }

  params.push(limit);
  const { rows } = await pool.query(`
    SELECT h.*, u.nickname, u.wallet_address,
           g.name AS guild_name
    FROM hall_of_fame h
    LEFT JOIN users u ON u.wallet_address = h.user_wallet
    LEFT JOIN guilds g ON g.id = h.guild_id
    ${where}
    ORDER BY h.is_featured DESC, h.achieved_at DESC
    LIMIT $${params.length}
  `, params);

  return rows;
}

/**
 * 내 칭호 목록 (장착 가능한 칭호 + 장착 상태)
 */
async function getMyTitles(walletAddress) {
  if (titleService?.getUserTitles) {
    try { return await titleService.getUserTitles(walletAddress); } catch { }
  }

  const { rows } = await pool.query(`
    SELECT * FROM user_titles
    WHERE user_wallet = $1
    ORDER BY earned_at DESC
  `, [walletAddress]);

  return rows;
}

/**
 * 칭호 장착 (20 GP 소모)
 */
async function equipTitle(walletAddress, titleCode) {
  if (titleService?.equipTitle) {
    try { return await titleService.equipTitle(walletAddress, titleCode); } catch { }
  }

  const cost = await getSettingInt('title_change_cost_gp', 20);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 칭호 보유 확인
    const { rows: titleRows } = await client.query(
      `SELECT id FROM user_titles WHERE user_wallet = $1 AND title_code = $2`,
      [walletAddress, titleCode]
    );
    if (!titleRows[0]) throw new Error('TITLE_NOT_OWNED');

    // GP 차감
    const { rows: userRows } = await client.query(
      `SELECT gp_balance FROM users WHERE LOWER(wallet_address) = LOWER($1) FOR UPDATE`,
      [walletAddress]
    );
    if ((parseInt(userRows[0]?.gp_balance) || 0) < cost) {
      throw new Error('INSUFFICIENT_GP');
    }
    const txDeduct = await client.query(
      `UPDATE users SET gp_balance = gp_balance - $1 WHERE LOWER(wallet_address) = LOWER($2) AND gp_balance >= $1`,
      [cost, walletAddress]
    );
    if (txDeduct.rowCount === 0) throw new Error('INSUFFICIENT_GP');

    // 기존 장착 해제 + 새 장착
    await client.query(
      `UPDATE user_titles SET is_equipped = false WHERE user_wallet = $1`,
      [walletAddress]
    );
    await client.query(
      `UPDATE user_titles SET is_equipped = true WHERE user_wallet = $1 AND title_code = $2`,
      [walletAddress, titleCode]
    );

    await client.query('COMMIT');
    return { success: true, cost_paid: cost, equipped: titleCode };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ─── 헬퍼 ───

async function getSettingInt(key, fallback) {
  try {
    const { rows } = await pool.query(`SELECT value FROM settings WHERE key = $1`, [key]);
    if (!rows[0]) return fallback;
    const n = parseInt(String(rows[0].value).replace(/"/g, ''), 10);
    return isNaN(n) ? fallback : n;
  } catch { return fallback; }
}

module.exports = {
  EXTENDED_TITLES,
  awardTitle,
  // 트리거
  onOnboardingComplete,
  onClaimCreated,
  onSiegeWin,
  onMaxEnhancement,
  onMarketSale,
  onBountyComplete,
  onMiningAccumulate,
  onDeepDig,
  onGuildWarWin,
  // 스케줄러
  checkVeteranTitles,
  awardSeasonTitles,
  // Hall of Fame
  recordHallOfFame,
  getHallOfFameBoard,
  // 유저
  getMyTitles,
  equipTitle,
};
