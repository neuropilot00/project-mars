// server/services/faction.js
// ═══════════════════════════════════════════════════════════
// Faction Service — 파벌 선택/변경/조회
// ═══════════════════════════════════════════════════════════

const { pool } = require('../db');

/**
 * 전체 파벌 목록 조회 (UI 표시용)
 */
async function listFactions() {
  const { rows } = await pool.query(`
    SELECT code, name_en, name_ko, name_ja, name_zh,
           description_en, description_ko,
           color_primary, color_dark, color_bright,
           visual_style, icon_emoji,
           specialty_en, specialty_ko,
           atk_multiplier, def_multiplier, spd_multiplier
    FROM factions
    WHERE is_active = true
    ORDER BY sort_order
  `);
  return rows;
}

/**
 * 유저의 현재 파벌 조회
 * @returns {Object|null} { code, name_ko, chosen_at, can_change_at }
 */
async function getUserFaction(walletAddress) {
  const { rows } = await pool.query(`
    SELECT 
      u.faction_code,
      u.faction_chosen_at,
      f.name_ko, f.name_en,
      f.color_primary, f.visual_style,
      f.specialty_ko
    FROM users u
    LEFT JOIN factions f ON f.code = u.faction_code
    WHERE u.wallet_address = $1
  `, [walletAddress]);
  
  if (!rows[0]) return null;
  const row = rows[0];
  if (!row.faction_code) return null;
  
  // 변경 가능 시각 계산
  const cooldownHours = await getSetting('faction_change_cooldown_hours', 168);
  const canChangeAt = row.faction_chosen_at 
    ? new Date(new Date(row.faction_chosen_at).getTime() + cooldownHours * 3600000)
    : new Date();
  
  return {
    code: row.faction_code,
    name_ko: row.name_ko,
    name_en: row.name_en,
    color: row.color_primary,
    visual_style: row.visual_style,
    specialty_ko: row.specialty_ko,
    chosen_at: row.faction_chosen_at,
    can_change_at: canChangeAt,
    is_locked: canChangeAt > new Date()
  };
}

/**
 * 파벌 선택 (최초 선택 또는 변경)
 * @param {string} walletAddress
 * @param {string} factionCode - mcc | fsp | cv
 * @returns {Object} { success, previous_faction, new_faction, fee_paid }
 */
async function chooseFaction(walletAddress, factionCode) {
  // 파벌 유효성 검증
  const { rows: factionRows } = await pool.query(
    `SELECT code FROM factions WHERE code = $1 AND is_active = true`,
    [factionCode]
  );
  if (!factionRows[0]) {
    throw new Error('INVALID_FACTION');
  }
  
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // 유저 현재 상태 조회 (FOR UPDATE로 락)
    const { rows: userRows } = await client.query(
      `SELECT wallet_address, faction_code, faction_chosen_at, gp_balance
       FROM users WHERE LOWER(wallet_address) = LOWER($1) FOR UPDATE`,
      [walletAddress]
    );
    if (!userRows[0]) {
      throw new Error('USER_NOT_FOUND');
    }
    const user = userRows[0];
    
    // 같은 파벌 재선택 방지
    if (user.faction_code === factionCode) {
      throw new Error('SAME_FACTION');
    }
    
    let feePaid = 0;
    const isFirstChoice = !user.faction_code;
    
    if (!isFirstChoice) {
      // 변경 쿨다운 확인
      const cooldownHours = await getSettingWithClient(client, 'faction_change_cooldown_hours', 168);
      const canChangeAt = new Date(new Date(user.faction_chosen_at).getTime() + cooldownHours * 3600000);
      if (canChangeAt > new Date()) {
        const err = new Error('FACTION_CHANGE_COOLDOWN');
        err.meta = { can_change_at: canChangeAt };
        throw err;
      }
      
      // 변경 수수료 차감
      const feeGp = await getSettingWithClient(client, 'faction_change_fee_gp', 500);
      if (parseInt(user.gp_balance) < feeGp) {
        const err = new Error('INSUFFICIENT_GP');
        err.meta = { required: feeGp, balance: user.gp_balance };
        throw err;
      }
      
      await client.query(
        `UPDATE users SET gp_balance = gp_balance - $1 WHERE LOWER(wallet_address) = LOWER($2) AND gp_balance >= $1`,
        [feeGp, walletAddress]
      );
      
      // GP 활동 로그 (테이블 있으면 기록)
      await client.query(`
        INSERT INTO fleet_gp_activity (wallet_address, activity_type, gp_delta, meta)
        VALUES ($1, 'faction_change_fee', $2, $3)
      `, [walletAddress, -feeGp, JSON.stringify({ 
        from: user.faction_code, 
        to: factionCode 
      })]).catch(() => {}); // 테이블 없어도 무시
      
      feePaid = feeGp;
    }
    
    // 파벌 업데이트
    await client.query(
      `UPDATE users
       SET faction_code = $1, faction_chosen_at = NOW()
       WHERE wallet_address = $2`,
      [factionCode, walletAddress]
    );

    // ── 파벌 선택 시 스타터 함선 지급 (함선이 0척인 경우) ────────
    let starterShipGiven = null;
    try {
      // 살아있는 함선이 있는지 확인
      const { rows: shipCheck } = await client.query(
        `SELECT 1 FROM ships WHERE owner_wallet = $1 AND is_alive = true LIMIT 1`,
        [walletAddress]
      );

      if (shipCheck.length === 0) {
        // 함대가 있는지 확인
        const { rows: existingFleets } = await client.query(
          `SELECT id FROM fleets WHERE owner_wallet = $1 AND is_npc = false LIMIT 1`,
          [walletAddress]
        );

        let fleetId;
        if (existingFleets.length === 0) {
          const { rows: newFleet } = await client.query(
            `INSERT INTO fleets (owner_wallet, name, is_npc) VALUES ($1, '1함대', false) RETURNING id`,
            [walletAddress]
          );
          fleetId = newFleet[0].id;
        } else {
          fleetId = existingFleets[0].id;
        }

        // 해당 파벌의 가장 저렴한 프리깃 지급
        const { rows: starterTypes } = await client.query(
          `SELECT code, name_ko, base_hp
           FROM ship_types
           WHERE faction_code = $1 AND is_active = true AND size_class = 'frigate'
           ORDER BY build_gp_cost ASC LIMIT 1`,
          [factionCode]
        );

        if (starterTypes.length > 0) {
          const st = starterTypes[0];
          await client.query(
            `INSERT INTO ships (fleet_id, ship_type_code, owner_wallet, current_hp, max_hp, is_flagship, built_by_wallet)
             VALUES ($1, $2, $3, $4, $4, true, $3)`,
            [fleetId, st.code, walletAddress, st.base_hp]
          );
          starterShipGiven = { type_code: st.code, name_ko: st.name_ko, fleet_id: fleetId };
          console.log(`[faction] starter ship granted: ${st.code} → ${walletAddress}`);
        }
      }
    } catch (shipErr) {
      // 함선 지급 실패해도 파벌 선택은 성공으로 처리
      console.error('[faction] starter ship grant failed:', shipErr.message);
    }

    await client.query('COMMIT');

    return {
      success: true,
      is_first_choice: isFirstChoice,
      previous_faction: user.faction_code,
      new_faction: factionCode,
      fee_paid: feePaid,
      starter_ship: starterShipGiven
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * 파벌 통계 (파벌별 유저 수, 함선 수 등)
 */
async function getFactionStats() {
  const { rows } = await pool.query(`
    SELECT 
      f.code,
      f.name_ko,
      f.color_primary,
      COUNT(DISTINCT u.wallet_address) AS player_count,
      COUNT(DISTINCT s.id) FILTER (WHERE s.is_alive) AS ships_alive
    FROM factions f
    LEFT JOIN users u ON u.faction_code = f.code
    LEFT JOIN ship_types st ON st.faction_code = f.code
    LEFT JOIN ships s ON s.ship_type_code = st.code
    WHERE f.is_active = true
    GROUP BY f.code, f.name_ko, f.color_primary, f.sort_order
    ORDER BY f.sort_order
  `);
  return rows;
}

// ───── 헬퍼: settings 조회 ─────

async function getSetting(key, fallback) {
  try {
    const { rows } = await pool.query(
      `SELECT value FROM settings WHERE category='fleet' AND key=$1`,
      [key]
    );
    if (!rows[0]) return fallback;
    // value가 jsonb이면 파싱, 아니면 직접 숫자 변환
    const val = rows[0].value;
    if (typeof val === 'number') return val;
    if (typeof val === 'string') {
      // "168" 혹은 '"168"' 두 형태 모두 처리
      const cleaned = val.replace(/^"|"$/g, '');
      const n = parseInt(cleaned, 10);
      return isNaN(n) ? fallback : n;
    }
    return val;
  } catch { return fallback; }
}

async function getSettingWithClient(client, key, fallback) {
  try {
    const { rows } = await client.query(
      `SELECT value FROM settings WHERE category='fleet' AND key=$1`,
      [key]
    );
    if (!rows[0]) return fallback;
    const val = rows[0].value;
    if (typeof val === 'number') return val;
    if (typeof val === 'string') {
      const cleaned = val.replace(/^"|"$/g, '');
      const n = parseInt(cleaned, 10);
      return isNaN(n) ? fallback : n;
    }
    return val;
  } catch { return fallback; }
}

module.exports = {
  listFactions,
  getUserFaction,
  chooseFaction,
  getFactionStats,
};
