// server/services/aiFleetManager.js
// ═══════════════════════════════════════════════════════════════
// AI Fleet Manager — NPC 함대 자동 생성/유지
//
// 각 파벌마다 N척의 AI 함대를 유지.
// AI가 패배하면 ai_respawn_hours 후 재생성.
// 플레이어는 이 AI를 선택해서 연습 전투 가능.
// ═══════════════════════════════════════════════════════════════

const { pool } = require('../db');

// AI 함대 "난이도" 프리셋
const AI_PRESETS = {
  easy: {
    label: '루키',
    ship_composition: [
      { ship_code: 'FACTION_int', count: 5 },
      { ship_code: 'FACTION_frg', count: 3 },
    ],
    flagship_ship: 'FACTION_frg',
  },
  normal: {
    label: '베테랑',
    ship_composition: [
      { ship_code: 'FACTION_int', count: 8 },
      { ship_code: 'FACTION_frg', count: 6 },
      { ship_code: 'FACTION_dst', count: 2 },
    ],
    flagship_ship: 'FACTION_dst',
  },
  hard: {
    label: '엘리트',
    ship_composition: [
      { ship_code: 'FACTION_int', count: 10 },
      { ship_code: 'FACTION_frg', count: 8 },
      { ship_code: 'FACTION_dst', count: 4 },
      { ship_code: 'FACTION_crs', count: 1 },
    ],
    flagship_ship: 'FACTION_crs',
  },
  elite: {
    label: '마스터',
    ship_composition: [
      { ship_code: 'FACTION_int', count: 15 },
      { ship_code: 'FACTION_frg', count: 10 },
      { ship_code: 'FACTION_dst', count: 6 },
      { ship_code: 'FACTION_crs', count: 2 },
      { ship_code: 'FACTION_bs',  count: 1 },
    ],
    flagship_ship: 'FACTION_bs',
  },
};

// ─── AI 유저 확보 (지갑 생성 또는 로드) ───

/**
 * AI 유저 생성/로드
 * 실제 BLOCKCHAIN 없이 AI 전용 가짜 지갑 사용
 */
async function ensureAiUser(factionCode, difficulty, index) {
  const aiWallet = `0xAI00${factionCode.padStart(3,'0')}${difficulty.substr(0,1).toUpperCase()}${String(index).padStart(4,'0')}00000000000000000000000`.substr(0, 42);
  const nickname = `[AI] ${AI_PRESETS[difficulty].label} #${index+1}`;
  
  const { rows: existing } = await pool.query(
    `SELECT wallet_address FROM users WHERE wallet_address = $1`,
    [aiWallet]
  );
  
  if (existing[0]) {
    // faction 업데이트
    await pool.query(
      `UPDATE users SET faction_code = $1 WHERE wallet_address = $2 AND (faction_code IS NULL OR faction_code != $1)`,
      [factionCode, aiWallet]
    );
    return aiWallet;
  }
  
  // 새로 생성
  try {
    await pool.query(`
      INSERT INTO users (
        wallet_address, email, password_hash, nickname,
        is_ai, ai_difficulty,
        faction_code, faction_chosen_at,
        gp_balance, pp_balance, usdt_balance
      ) VALUES (
        $1, $2, '$ai$', $3, 
        true, $4,
        $5, NOW(),
        100000, 0, 0
      )
      ON CONFLICT (wallet_address) DO UPDATE SET
        is_ai = true,
        ai_difficulty = $4,
        faction_code = $5
    `, [
      aiWallet, 
      `${aiWallet}@ai.local`,
      nickname, 
      difficulty,
      factionCode,
    ]);
  } catch (err) {
    // nickname unique 같은 constraint 실패 가능 - 무시하고 지갑 반환
    console.warn(`[aiFleet] ensureAiUser fallback:`, err.message);
  }
  
  return aiWallet;
}

// ─── AI 함대 생성 ───

/**
 * AI 함대 하나 생성 (파벌 × 난이도)
 * @returns {number} fleet_id
 */
async function createAiFleet(factionCode, difficulty, index) {
  const preset = AI_PRESETS[difficulty];
  if (!preset) throw new Error('INVALID_DIFFICULTY');
  
  const aiWallet = await ensureAiUser(factionCode, difficulty, index);
  
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // 함대 생성
    const { rows: fleetRows } = await client.query(`
      INSERT INTO fleets (owner_wallet, name, formation, movement)
      VALUES ($1, $2, 'sphere', 'advance')
      RETURNING id
    `, [
      aiWallet,
      `[AI] ${preset.label} ${factionCode.toUpperCase()} #${index+1}`,
    ]);
    const fleetId = fleetRows[0].id;
    
    // 함선 타입 매핑 (FACTION_xxx → 실제 코드)
    // 파벌별 코드 별칭 (ship_types 테이블에 존재하지 않는 코드 → 대체 코드)
    const FACTION_CODE_ALIASES = {
      fsp: { 'fsp_frg': 'fsp_int' },  // FSP는 frg 없음, int(스프라이트) 사용
    };
    const resolveShipCode = (template) => {
      const code = template.replace('FACTION', factionCode);
      return FACTION_CODE_ALIASES[factionCode]?.[code] || code;
    };
    
    // 함선 생성
    let flagshipAssigned = false;
    const flagshipCode = resolveShipCode(preset.flagship_ship);
    
    for (const comp of preset.ship_composition) {
      const shipCode = resolveShipCode(comp.ship_code);
      
      // ship_type 존재 확인
      const { rows: stRows } = await client.query(
        `SELECT * FROM ship_types WHERE code = $1`,
        [shipCode]
      );
      if (!stRows[0]) {
        console.warn(`[aiFleet] ship_type not found: ${shipCode} - skipping`);
        continue;
      }
      const st = stRows[0];
      
      // N척 생성
      for (let i = 0; i < comp.count; i++) {
        const isFlagship = !flagshipAssigned && shipCode === flagshipCode;
        
        try {
          await client.query(`
            INSERT INTO ships (
              fleet_id, ship_type_code, owner_wallet,
              current_hp, max_hp, is_flagship, is_alive, built_at
            ) VALUES ($1, $2, $3, $4, $4, $5, true, NOW())
          `, [fleetId, shipCode, aiWallet, st.base_hp, isFlagship]);
          
          if (isFlagship) flagshipAssigned = true;
        } catch (err) {
          // Titan 한도 등 제약으로 실패 가능. 무시하고 다음.
          console.warn(`[aiFleet] ship creation failed: ${shipCode}`, err.message);
        }
      }
    }
    
    await client.query('COMMIT');
    
    console.log(`[aiFleet] created AI fleet ${fleetId} (${factionCode}/${difficulty} #${index+1})`);
    return fleetId;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ─── 전체 AI 함대 수 유지 ───

/**
 * 설정된 수만큼 AI 함대 생성 (없는 것만)
 * 초기 셋업 및 주기적 호출
 */
async function ensureAiFleets() {
  const settings = await loadAiSettings();
  if (!settings.ai_enabled) {
    console.log('[aiFleet] AI disabled');
    return { created: 0 };
  }
  
  const factions = ['mcc', 'fsp', 'cv'];
  const difficulties = ['easy', 'normal', 'hard'];
  const countPerDifficulty = Math.max(1, Math.floor(settings.ai_fleet_count_per_faction / difficulties.length));
  
  let created = 0;
  
  for (const factionCode of factions) {
    for (const difficulty of difficulties) {
      for (let i = 0; i < countPerDifficulty; i++) {
        // 이미 존재하는 AI 함대 확인
        const aiWallet = `0xAI00${factionCode.padStart(3,'0')}${difficulty.substr(0,1).toUpperCase()}${String(i).padStart(4,'0')}00000000000000000000000`.substr(0, 42);
        
        const { rows } = await pool.query(`
          SELECT f.id, 
                 COUNT(s.id) FILTER (WHERE s.is_alive) AS ships_alive,
                 u.ai_respawn_at
          FROM fleets f
          LEFT JOIN ships s ON s.fleet_id = f.id
          LEFT JOIN users u ON u.wallet_address = f.owner_wallet
          WHERE f.owner_wallet = $1
          GROUP BY f.id, u.ai_respawn_at
        `, [aiWallet]);
        
        const fleet = rows[0];
        
        if (!fleet) {
          // 함대 없음 → 생성
          try {
            await createAiFleet(factionCode, difficulty, i);
            created++;
          } catch (err) {
            console.error(`[aiFleet] create failed (${factionCode}/${difficulty}/${i}):`, err.message);
          }
        } else if (parseInt(fleet.ships_alive) === 0) {
          // 함대 있지만 전멸 → respawn 시간 확인 후 재생성
          const respawnAt = fleet.ai_respawn_at ? new Date(fleet.ai_respawn_at) : null;
          if (!respawnAt || respawnAt <= new Date()) {
            // 기존 함대 삭제하고 재생성
            await pool.query(`DELETE FROM fleets WHERE id = $1`, [fleet.id]);
            try {
              await createAiFleet(factionCode, difficulty, i);
              created++;
            } catch (err) {
              console.error(`[aiFleet] respawn failed:`, err.message);
            }
          }
        }
      }
    }
  }
  
  return { created };
}

/**
 * AI 함대 패배 시 respawn 시간 설정
 * (battleScheduler에서 전투 종료 후 호출)
 */
async function scheduleRespawnIfNeeded(battleId) {
  const settings = await loadAiSettings();
  
  // 이 전투의 참가자 중 AI 있는지 확인
  const { rows } = await pool.query(`
    SELECT p.wallet_address, u.is_ai, 
           COUNT(s.id) FILTER (WHERE s.is_alive) AS ships_alive
    FROM fleet_battle_participants p
    JOIN users u ON u.wallet_address = p.wallet_address
    LEFT JOIN fleets f ON f.id = p.fleet_id
    LEFT JOIN ships s ON s.fleet_id = f.id
    WHERE p.battle_id = $1 AND u.is_ai = true
    GROUP BY p.wallet_address, u.is_ai
  `, [battleId]);
  
  for (const row of rows) {
    if (parseInt(row.ships_alive) === 0) {
      // 완전 패배 → respawn 예약
      await pool.query(`
        UPDATE users SET ai_respawn_at = NOW() + ($1 || ' hours')::INTERVAL
        WHERE wallet_address = $2
      `, [String(settings.ai_respawn_hours), row.wallet_address]);
      
      console.log(`[aiFleet] ${row.wallet_address} scheduled for respawn in ${settings.ai_respawn_hours}h`);
    }
  }
}

/**
 * 플레이어가 선택 가능한 AI 함대 목록
 */
async function listAvailableAiFleets(playerFactionCode) {
  // 같은 파벌이 아닌 AI만 (연습 상대는 다른 파벌)
  // 원한다면 파벌 무관하게 다 보이게 할 수도 있음
  const { rows } = await pool.query(`
    SELECT 
      f.id AS fleet_id, f.name AS fleet_name, f.owner_wallet,
      u.ai_difficulty, u.nickname,
      fa.code AS faction_code, fa.name_ko AS faction_name, fa.color_primary AS faction_color,
      COUNT(s.id) FILTER (WHERE s.is_alive) AS ships_alive
    FROM fleets f
    JOIN users u ON u.wallet_address = f.owner_wallet
    LEFT JOIN factions fa ON fa.code = u.faction_code
    LEFT JOIN ships s ON s.fleet_id = f.id
    WHERE u.is_ai = true
      AND NOT f.is_in_battle
    GROUP BY f.id, u.ai_difficulty, u.nickname, fa.code, fa.name_ko, fa.color_primary
    HAVING COUNT(s.id) FILTER (WHERE s.is_alive) > 0
    ORDER BY 
      CASE u.ai_difficulty 
        WHEN 'easy' THEN 1 WHEN 'normal' THEN 2 
        WHEN 'hard' THEN 3 WHEN 'elite' THEN 4 
      END,
      fa.sort_order
  `);
  
  return rows.map(r => ({
    ...r,
    ships_alive: parseInt(r.ships_alive) || 0,
    is_ai: true,
  }));
}

// ─── 헬퍼 ───

async function loadAiSettings() {
  const { rows } = await pool.query(`
    SELECT key, value FROM settings 
    WHERE category IN ('ai', 'tournament')
  `);
  
  const settings = {
    ai_enabled: true,
    ai_fleet_count_per_faction: 3,
    ai_respawn_hours: 2,
  };
  
  for (const row of rows) {
    const val = row.value;
    if (val === 'true' || val === '"true"') settings[row.key] = true;
    else if (val === 'false' || val === '"false"') settings[row.key] = false;
    else {
      const n = parseInt(String(val).replace(/^"|"$/g, ''), 10);
      if (!isNaN(n)) settings[row.key] = n;
    }
  }
  
  return settings;
}

module.exports = {
  ensureAiFleets,
  createAiFleet,
  scheduleRespawnIfNeeded,
  listAvailableAiFleets,
  AI_PRESETS,
};
