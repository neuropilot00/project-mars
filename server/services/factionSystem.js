// server/services/factionSystem.js
// ═══════════════════════════════════════════════════════════════
// 파벌 시스템 서비스 (Migration 092)
//
// getFactions()        — 파벌 목록 + 현재 유저 선택 정보
// chooseFaction()      — 파벌 선택/변경
// getFactionBuff()     — 파벌 버프 값 조회 (다른 서비스에서 호출)
// logFactionActivity() — 파벌 활동 기록
// getFactionStats()    — 파벌별 통계 (세력 균형 표시용)
// ═══════════════════════════════════════════════════════════════

const { pool } = require('../db');

async function getSetting(key, fallback) {
  try {
    const { rows } = await pool.query(`SELECT value FROM settings WHERE key = $1`, [key]);
    return rows[0]?.value ?? fallback;
  } catch { return fallback; }
}
async function getInt(key, fallback)   { return parseInt(await getSetting(key, fallback))   || fallback; }
async function getFloat(key, fallback) { return parseFloat(await getSetting(key, fallback)) || fallback; }

// factions 테이블 PK 컬럼명 자동 감지
async function getFactionPK() {
  const { rows } = await pool.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'factions' AND column_name IN ('code','id')
    ORDER BY ordinal_position LIMIT 1
  `);
  return rows[0]?.column_name || 'code';
}

// ─── 파벌 목록 ───

async function getFactions(walletAddress) {
  const pk = await getFactionPK();

  const { rows: factions } = await pool.query(`
    SELECT f.*,
           COUNT(u.wallet_address) AS member_count
    FROM factions f
    LEFT JOIN users u ON u.faction_code = f.${pk}
    WHERE f.is_active = true OR f.is_playable = true
    GROUP BY f.${pk}
    ORDER BY f.sort_order
  `).catch(() => pool.query(`SELECT * FROM factions ORDER BY sort_order`));

  let myFaction = null;
  if (walletAddress) {
    const { rows } = await pool.query(`
      SELECT faction_code, faction_chosen_at, faction_change_count
      FROM users WHERE wallet_address = $1
    `, [walletAddress]);
    myFaction = rows[0] || null;
  }

  return {
    factions,
    my_faction: myFaction?.faction_code || null,
    chosen_at:  myFaction?.faction_chosen_at || null,
    change_count: myFaction?.faction_change_count || 0,
  };
}

// ─── 파벌 선택/변경 ───

async function chooseFaction(walletAddress, factionCode) {
  const pk = await getFactionPK();

  // 파벌 존재 확인
  const { rows: fRows } = await pool.query(
    `SELECT * FROM factions WHERE ${pk} = $1`, [factionCode]
  );
  if (!fRows[0]) throw new Error('FACTION_NOT_FOUND');

  // 현재 유저 상태
  const { rows: uRows } = await pool.query(`
    SELECT faction_code, faction_chosen_at, faction_change_count, gp_balance
    FROM users WHERE wallet_address = $1
  `, [walletAddress]);
  if (!uRows[0]) throw new Error('USER_NOT_FOUND');
  const user = uRows[0];

  // 같은 파벌 재선택
  if (user.faction_code === factionCode) throw new Error('SAME_FACTION');

  const isFirstChoice = !user.faction_code;
  const _ffVal = await getSetting('faction_first_choice_free', true);
  const firstFree = _ffVal === true || _ffVal === 'true';

  let gpCost = 0;
  if (!isFirstChoice || !firstFree) {
    // 쿨다운 체크
    if (user.faction_chosen_at) {
      const cooldownHours = await getInt('faction_change_cooldown_hours', 168);
      const msSince = Date.now() - new Date(user.faction_chosen_at).getTime();
      const hoursSince = msSince / 3600000;
      if (hoursSince < cooldownHours) {
        const hoursLeft = Math.ceil(cooldownHours - hoursSince);
        throw Object.assign(new Error('FACTION_COOLDOWN'), { meta: { hours_left: hoursLeft } });
      }
    }
    gpCost = await getInt('faction_change_fee_gp', 500);
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    if (gpCost > 0) {
      const { rowCount } = await client.query(
        `UPDATE users SET gp_balance = gp_balance - $2 WHERE wallet_address = $1 AND gp_balance >= $2`,
        [walletAddress, gpCost]
      );
      if (!rowCount) throw new Error('INSUFFICIENT_GP');
    }

    await client.query(`
      UPDATE users SET
        faction_code = $2,
        faction_chosen_at = NOW(),
        faction_change_count = COALESCE(faction_change_count, 0) + 1
      WHERE wallet_address = $1
    `, [walletAddress, factionCode]);

    await client.query('COMMIT');

    return {
      chosen: true,
      faction_code: factionCode,
      faction_name_ko: fRows[0].name_ko,
      gp_cost: gpCost,
      is_first_choice: isFirstChoice,
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ─── 파벌 버프 조회 (다른 서비스에서 호출) ───

/**
 * 특정 활동에 대한 파벌 버프 반환
 * @param {string} walletAddress
 * @param {string} buffType - 'mining' | 'hijack' | 'defense' | 'market_fee' | 'territory_max'
 * @returns {number} 버프 값 (배율 또는 증가량)
 */
async function getFactionBuff(walletAddress, buffType) {
  try {
    const { rows } = await pool.query(`
      SELECT f.mining_bonus, f.hijack_bonus, f.defense_bonus,
             f.market_fee_mult, f.territory_max_mult
      FROM users u
      JOIN factions f ON f.code = u.faction_code
      WHERE u.wallet_address = $1
    `, [walletAddress]);

    if (!rows[0]) return buffType.includes('mult') ? 1.0 : 0.0;

    const buffMap = {
      mining:         rows[0].mining_bonus      || 0,
      hijack:         rows[0].hijack_bonus       || 0,
      defense:        rows[0].defense_bonus      || 0,
      market_fee:     rows[0].market_fee_mult    || 1.0,
      territory_max:  rows[0].territory_max_mult || 1.0,
    };

    return buffMap[buffType] ?? (buffType.includes('mult') ? 1.0 : 0.0);
  } catch { return buffType.includes('mult') ? 1.0 : 0.0; }
}

// ─── 파벌 활동 기록 ───

async function logFactionActivity(walletAddress, activityType, sectorCode, points = 1) {
  try {
    const { rows } = await pool.query(
      `SELECT faction_code FROM users WHERE wallet_address = $1`, [walletAddress]
    );
    if (!rows[0]?.faction_code) return;

    await pool.query(`
      INSERT INTO faction_activity_log
        (wallet_address, faction_code, activity_type, points, sector_code)
      VALUES ($1, $2, $3, $4, $5)
    `, [walletAddress, rows[0].faction_code, activityType, points, sectorCode || null]);
  } catch { }
}

// ─── 파벌 통계 (세력 균형 표시) ───

async function getFactionStats() {
  const pk = await getFactionPK();

  const { rows } = await pool.query(`
    SELECT
      f.${pk} AS faction_code,
      f.name_ko, f.name_en,
      f.color_primary,
      f.mining_bonus, f.hijack_bonus, f.defense_bonus,
      COUNT(DISTINCT u.wallet_address) AS member_count,
      COALESCE(SUM(al.points), 0) AS weekly_points
    FROM factions f
    LEFT JOIN users u ON u.faction_code = f.${pk}
    LEFT JOIN faction_activity_log al ON al.faction_code = f.${pk}
      AND al.created_at > NOW() - INTERVAL '7 days'
    GROUP BY f.${pk}, f.name_ko, f.name_en, f.color_primary,
             f.mining_bonus, f.hijack_bonus, f.defense_bonus, f.sort_order
    ORDER BY f.sort_order
  `);

  const total = rows.reduce((s, r) => s + parseInt(r.member_count), 0) || 1;
  return rows.map(r => ({
    ...r,
    member_pct: Math.round(parseInt(r.member_count) / total * 100),
  }));
}

module.exports = {
  getFactions,
  chooseFaction,
  getFactionBuff,
  logFactionActivity,
  getFactionStats,
};
