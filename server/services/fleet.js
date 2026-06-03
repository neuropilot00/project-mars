// server/services/fleet.js
// ═══════════════════════════════════════════════════════════════
// Fleet Service — 함대 CRUD + 함선 편성
// 
// 주요 기능:
//   - listMyFleets()       : 내 함대 목록 (구성 포함)
//   - getFleetDetail()     : 함대 상세 (함선 전부 + 통계)
//   - createFleet()        : 새 함대 생성
//   - updateFleet()        : 이름/진형/기동 수정
//   - deleteFleet()        : 함대 해체 (함선은 다른 함대로 이동)
//   - moveShips()          : 함선들을 다른 함대로 이동
//   - setFlagship()        : 기함 변경
//   - getFormationOptions(): UI용 진형/기동 옵션 목록
// ═══════════════════════════════════════════════════════════════

const { pool, getSetting } = require('../db');

// ─── 상수 ───

const VALID_FORMATIONS = ['sphere', 'wedge', 'screen', 'pincer'];
const VALID_MOVEMENTS  = ['advance', 'retreat', 'flank', 'scatter', 'rally'];

const FORMATION_INFO = {
  sphere:  { name_ko: '구형 집결', icon: '●', desc: '기본 원형 집결 · 균형잡힌 기본 진형' },
  wedge:   { name_ko: '쐐기',     icon: '▶', desc: '소형함 선두 · 돌파 특화' },
  screen:  { name_ko: '방어막',   icon: '⊟', desc: '소형함 앞 · 대형함 보호' },
  pincer:  { name_ko: '협공',     icon: '⊕', desc: '상하 양익 포위' },
};
const MOVEMENT_INFO = {
  advance: { name_ko: '전진',     icon: '↑', desc: '적 전열 위쪽으로 압박 전진 (기본)' },
  retreat: { name_ko: '후퇴',     icon: '↓', desc: '아군 후방 아래쪽으로 거리 벌림' },
  flank:   { name_ko: '측면 우회', icon: '↗', desc: '측면으로 돌아 접근' },
  scatter: { name_ko: '산개',     icon: '✦', desc: '흩어짐 (AOE 회피)' },
  rally:   { name_ko: '재집결',   icon: '◉', desc: '재편성 (속도↓ 방어↑)' },
};

// ─── 내 함대 목록 ───

/**
 * 내 함대 전체 목록 (카드 뷰용 · 구성 요약)
 */
async function listMyFleets(walletAddress) {
  const { rows } = await pool.query(`
    SELECT 
      f.id, f.name, f.sector_id, f.formation, f.movement,
      f.is_in_battle, f.current_battle_id, f.accent_color,
      f.total_kills, f.battles_won, f.battles_lost,
      f.created_at, f.updated_at,
      
      -- 함선 집계
      COUNT(s.id) FILTER (WHERE s.is_alive) AS ships_alive,
      COUNT(s.id) FILTER (WHERE NOT s.is_alive) AS ships_lost,
      COUNT(s.id) FILTER (WHERE s.is_alive AND s.is_flagship) AS flagship_count,
      COALESCE(SUM(s.current_hp) FILTER (WHERE s.is_alive), 0) AS total_hp,
      COALESCE(SUM(s.max_hp) FILTER (WHERE s.is_alive), 0) AS total_max_hp,
      
      -- 크기별 집계
      COUNT(s.id) FILTER (WHERE s.is_alive AND st.size_class='frigate') AS frigate_count,
      COUNT(s.id) FILTER (WHERE s.is_alive AND st.size_class='destroyer') AS destroyer_count,
      COUNT(s.id) FILTER (WHERE s.is_alive AND st.size_class='cruiser') AS cruiser_count,
      COUNT(s.id) FILTER (WHERE s.is_alive AND st.size_class='battleship') AS battleship_count,
      COUNT(s.id) FILTER (WHERE s.is_alive AND st.size_class='titan') AS titan_count,
      COUNT(s.id) FILTER (WHERE s.is_alive AND st.size_class='assembled') AS assembled_count,
      
      -- 기함 정보
      (SELECT json_build_object(
         'id', fs.id, 
         'ship_type_code', fs.ship_type_code,
         'name_ko', fst.name_ko,
         'current_hp', fs.current_hp,
         'max_hp', fs.max_hp
       )
       FROM ships fs
       LEFT JOIN ship_types fst ON fst.code = fs.ship_type_code
       WHERE fs.fleet_id = f.id AND fs.is_flagship AND fs.is_alive LIMIT 1
      ) AS flagship
    FROM fleets f
    LEFT JOIN ships s ON s.fleet_id = f.id
    LEFT JOIN ship_types st ON st.code = s.ship_type_code
    WHERE LOWER(f.owner_wallet) = LOWER($1)
    GROUP BY f.id
    ORDER BY f.created_at ASC
  `, [walletAddress]);
  
  return rows.map(f => ({
    ...f,
    ships_alive:      parseInt(f.ships_alive) || 0,
    ships_lost:       parseInt(f.ships_lost) || 0,
    flagship_count:   parseInt(f.flagship_count) || 0,
    total_hp:         parseInt(f.total_hp) || 0,
    total_max_hp:     parseInt(f.total_max_hp) || 0,
    frigate_count:    parseInt(f.frigate_count) || 0,
    destroyer_count:  parseInt(f.destroyer_count) || 0,
    cruiser_count:    parseInt(f.cruiser_count) || 0,
    battleship_count: parseInt(f.battleship_count) || 0,
    titan_count:      parseInt(f.titan_count) || 0,
    assembled_count:  parseInt(f.assembled_count) || 0,
    has_flagship:     (parseInt(f.flagship_count) || 0) > 0,
    formation_info:   FORMATION_INFO[f.formation],
    movement_info:    MOVEMENT_INFO[f.movement],
  }));
}

// ─── 함대 상세 ───

async function getFleetDetail(fleetId, walletAddress) {
  // 소유권 확인
  const { rows: fleetRows } = await pool.query(`
    SELECT f.*, 
      COUNT(s.id) FILTER (WHERE s.is_alive AND COALESCE(s.is_market_listed, false) = false) AS ships_alive,
      COALESCE(SUM(s.current_hp) FILTER (WHERE s.is_alive AND COALESCE(s.is_market_listed, false) = false), 0) AS total_hp,
      COALESCE(SUM(s.max_hp) FILTER (WHERE s.is_alive AND COALESCE(s.is_market_listed, false) = false), 0) AS total_max_hp
    FROM fleets f
    LEFT JOIN ships s ON s.fleet_id = f.id
    WHERE f.id = $1 AND LOWER(f.owner_wallet) = LOWER($2)
    GROUP BY f.id
  `, [fleetId, walletAddress]);
  
  if (!fleetRows[0]) return null;
  const fleet = fleetRows[0];
  
  // 함선 전부
  const { rows: ships } = await pool.query(`
    SELECT s.*, 
           st.name_ko, st.class_label, st.size_class, st.role, st.tier,
           st.render_radius, st.base_atk, st.base_def, st.base_speed,
           st.is_flagship_capable,
           COALESCE(s.is_market_listed, false) AS is_market_listed,
           f.code AS faction_code, f.color_primary AS faction_color
    FROM ships s
    JOIN ship_types st ON st.code = s.ship_type_code
    LEFT JOIN factions f ON f.code = st.faction_code
    WHERE s.fleet_id = $1
      AND s.is_alive = true
      AND COALESCE(s.is_market_listed, false) = false
    ORDER BY s.is_flagship DESC, st.sort_order DESC, s.id ASC
  `, [fleetId]);
  
  return {
    ...fleet,
    ships_alive:      parseInt(fleet.ships_alive) || 0,
    total_hp:         parseInt(fleet.total_hp) || 0,
    total_max_hp:     parseInt(fleet.total_max_hp) || 0,
    formation_info:   FORMATION_INFO[fleet.formation],
    movement_info:    MOVEMENT_INFO[fleet.movement],
    ships,
  };
}

// ─── 함대 생성 ───

async function createFleet(walletAddress, options = {}) {
  const { name, formation = 'sphere', movement = 'advance' } = options;
  
  if (formation && !VALID_FORMATIONS.includes(formation)) {
    throw new Error('INVALID_FORMATION');
  }
  if (movement && !VALID_MOVEMENTS.includes(movement)) {
    throw new Error('INVALID_MOVEMENT');
  }
  
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Lock user row first — serializes concurrent createFleet calls so fleet count check is race-free.
    // users PK is wallet_address (there is NO id column) — selecting "id" here threw
    // `column "id" does not exist` → 500 on every fleet creation. [v7.316]
    await client.query(
      `SELECT wallet_address FROM users WHERE LOWER(wallet_address) = LOWER($1) FOR UPDATE`,
      [walletAddress]
    );

    // 최대 함대 수 체크 (settings에서 기본 5)
    const { rows: cntRows } = await client.query(
      `SELECT COUNT(*) AS c FROM fleets WHERE LOWER(owner_wallet) = LOWER($1)`,
      [walletAddress]
    );
    const maxFleets = await getSettingInt(client, 'max_fleets_per_player', 5);
    if (parseInt(cntRows[0].c) >= maxFleets) {
      const err = new Error('FLEET_LIMIT_REACHED');
      err.meta = { max: maxFleets, current: parseInt(cntRows[0].c) };
      throw err;
    }
    
    // 유저 닉네임 기반 기본 이름
    let fleetName = typeof name === 'string' ? name.trim() : name;
    if (!fleetName) {
      const { rows: userRows } = await client.query(
        `SELECT nickname FROM users WHERE LOWER(wallet_address) = LOWER($1)`,
        [walletAddress]
      );
      const nickname = userRows[0]?.nickname || 'Commander';
      const nextNum = parseInt(cntRows[0].c) + 1;
      fleetName = `${nickname} 제${nextNum}함대`;
    }
    
    // 이름 길이 체크
    if (fleetName.length > 60) {
      throw new Error('NAME_TOO_LONG');
    }
    if (fleetName.trim().length === 0) {
      throw new Error('NAME_EMPTY');
    }
    
    const { rows } = await client.query(`
      INSERT INTO fleets (owner_wallet, name, formation, movement)
      VALUES ($1, $2, $3, $4)
      RETURNING id, name, formation, movement, created_at
    `, [walletAddress, fleetName, formation, movement]);
    
    await client.query('COMMIT');
    return rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ─── 함대 수정 ───

async function updateFleet(fleetId, walletAddress, updates) {
  const { name, formation, movement } = updates;
  
  // 유효성 체크
  if (formation && !VALID_FORMATIONS.includes(formation)) {
    throw new Error('INVALID_FORMATION');
  }
  if (movement && !VALID_MOVEMENTS.includes(movement)) {
    throw new Error('INVALID_MOVEMENT');
  }
  if (name !== undefined && name.length > 60) {
    throw new Error('NAME_TOO_LONG');
  }
  if (name !== undefined && name.trim().length === 0) {
    throw new Error('NAME_EMPTY');
  }
  
  // 동적 UPDATE
  const sets = [];
  const params = [];
  if (name !== undefined) {
    params.push(name.trim());
    sets.push(`name = $${params.length}`);
  }
  if (formation !== undefined) {
    params.push(formation);
    sets.push(`formation = $${params.length}`);
  }
  if (movement !== undefined) {
    params.push(movement);
    sets.push(`movement = $${params.length}`);
  }
  
  if (sets.length === 0) return { no_changes: true };

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 소유권 + 전투중 체크
    const { rows: fleetRows } = await client.query(
      `SELECT id, is_in_battle FROM fleets WHERE id = $1 AND LOWER(owner_wallet) = LOWER($2) FOR UPDATE`,
      [fleetId, walletAddress]
    );
    if (!fleetRows[0]) throw new Error('FLEET_NOT_FOUND');

    // 전투 중엔 이름 변경 차단 (진형/기동은 허용 — 전술 변경 기능)
    if (fleetRows[0].is_in_battle && name !== undefined) {
      throw new Error('FLEET_IN_BATTLE');
    }

    sets.push(`updated_at = NOW()`);
    params.push(fleetId);
    params.push(walletAddress);

    const { rows } = await client.query(`
      UPDATE fleets SET ${sets.join(', ')}
      WHERE id = $${params.length - 1} AND LOWER(owner_wallet) = LOWER($${params.length})
      RETURNING id, name, formation, movement, updated_at
    `, params);

    await client.query('COMMIT');
    return rows[0];
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch (_) {}
    throw err;
  } finally {
    client.release();
  }
}

// ─── 함대 해체 ───

/**
 * 함대를 해체. 안에 있는 함선들은 기본 함대로 이동.
 * (기본 함대가 없으면 하나 만들어서 이동)
 */
async function deleteFleet(fleetId, walletAddress) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // 소유권 + 전투중 체크
    const { rows: fleetRows } = await client.query(
      `SELECT id, is_in_battle, name FROM fleets 
       WHERE id = $1 AND LOWER(owner_wallet) = LOWER($2) FOR UPDATE`,
      [fleetId, walletAddress]
    );
    if (!fleetRows[0]) throw new Error('FLEET_NOT_FOUND');
    if (fleetRows[0].is_in_battle) throw new Error('FLEET_IN_BATTLE');
    
    // Lock user row — serializes concurrent deleteFleet calls so last-fleet check is race-free
    await client.query(
      `SELECT id FROM users WHERE LOWER(wallet_address) = LOWER($1) FOR UPDATE`,
      [walletAddress]
    );

    // 내 함대 총 개수 확인 (마지막 함대는 해체 금지)
    const { rows: cntRows } = await client.query(
      `SELECT COUNT(*) AS c FROM fleets WHERE LOWER(owner_wallet) = LOWER($1)`,
      [walletAddress]
    );
    const totalFleets = parseInt(cntRows[0].c);
    if (totalFleets <= 1) {
      throw new Error('LAST_FLEET');
    }
    
    // 살아있는 함선 수
    const { rows: shipCntRows } = await client.query(
      `SELECT COUNT(*) AS c FROM ships WHERE fleet_id = $1 AND is_alive = true`,
      [fleetId]
    );
    const aliveShips = parseInt(shipCntRows[0].c);
    
    let movedTo = null;
    
    if (aliveShips > 0) {
      await client.query(
        `SELECT id FROM ships WHERE fleet_id = $1 AND is_alive = true FOR UPDATE`,
        [fleetId]
      );

      // 다른 함대 중 가장 오래된 것으로 이동
      const { rows: targetRows } = await client.query(`
        SELECT id FROM fleets 
        WHERE LOWER(owner_wallet) = LOWER($1) AND id != $2
        ORDER BY created_at ASC LIMIT 1
        FOR UPDATE
      `, [walletAddress, fleetId]);
      
      if (!targetRows[0]) {
        // 이론상 불가능 (총 함대 수 체크했음)
        throw new Error('NO_TARGET_FLEET');
      }
      
      movedTo = targetRows[0].id;
      
      // 이동 시 기함 해제 (타겟 함대에 이미 기함이 있을 수 있음)
      await client.query(`
        UPDATE ships 
        SET fleet_id = $1, is_flagship = false
        WHERE fleet_id = $2 AND is_alive = true
      `, [movedTo, fleetId]);
      
      // 타겟 함대에 기함이 없으면 하나 지정
      await ensureFlagship(client, movedTo);
    }
    
    // 죽은 함선들도 포함해서 모두 이동 (로그 보존 목적)
    if (movedTo) {
      await client.query(
        `UPDATE ships SET fleet_id = $1 WHERE fleet_id = $2`,
        [movedTo, fleetId]
      );
    } else {
      // 이동할 곳 없으면 함선 자체 삭제 (CASCADE)
      // → 실제로는 함대 삭제 시 CASCADE로 연결된 ships도 삭제됨
      // 죽은 함선 로그 보존하려면 별도 처리 필요, 지금은 CASCADE로 처리
    }
    
    // 함대 삭제
    await client.query(`DELETE FROM fleets WHERE id = $1`, [fleetId]);
    
    await client.query('COMMIT');
    
    return {
      success: true,
      deleted_fleet_id: fleetId,
      deleted_fleet_name: fleetRows[0].name,
      ships_moved: aliveShips,
      moved_to_fleet_id: movedTo,
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ─── 함선 이동 ───

/**
 * 함선들을 다른 함대로 이동
 * @param {number[]} shipIds - 이동할 함선 ID 배열
 * @param {number} targetFleetId - 대상 함대 ID
 */
async function moveShips(walletAddress, shipIds, targetFleetId) {
  if (!Array.isArray(shipIds) || shipIds.length === 0) {
    throw new Error('NO_SHIPS_SELECTED');
  }
  if (shipIds.length > 500) {
    throw new Error('TOO_MANY_SHIPS'); // 한번에 최대 500척
  }
  
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // 대상 함대 소유권 + 전투중 체크
    const { rows: targetRows } = await client.query(
      `SELECT id, is_in_battle FROM fleets 
       WHERE id = $1 AND LOWER(owner_wallet) = LOWER($2) FOR UPDATE`,
      [targetFleetId, walletAddress]
    );
    if (!targetRows[0]) throw new Error('TARGET_FLEET_NOT_FOUND');
    if (targetRows[0].is_in_battle) throw new Error('TARGET_FLEET_IN_BATTLE');
    
    // 함선 소유권 확인 + 전투중 함대에서 빼낼 수 없음 + 진영 일치 확인(cross-faction 차단)
    const { rows: shipRows } = await client.query(`
      SELECT s.id, s.fleet_id, s.is_flagship, s.is_alive,
             COALESCE(s.is_market_listed, false) AS is_market_listed,
             COALESCE(f.is_in_battle, false) AS is_in_battle,
             st.faction_code AS ship_faction, st.size_class AS ship_size
      FROM ships s
      JOIN ship_types st ON st.code = s.ship_type_code
      LEFT JOIN fleets f ON f.id = s.fleet_id
      WHERE s.id = ANY($1::bigint[]) AND LOWER(s.owner_wallet) = LOWER($2)
      FOR UPDATE OF s
    `, [shipIds, walletAddress]);

    if (shipRows.length !== shipIds.length) {
      throw new Error('SHIP_NOT_OWNED');
    }

    const listed = shipRows.filter(s => s.is_market_listed);
    if (listed.length > 0) {
      throw new Error('SHIP_LISTED_FOR_SALE');
    }

    const inBattle = shipRows.filter(s => s.is_in_battle);
    if (inBattle.length > 0) {
      throw new Error('SHIPS_IN_BATTLE');
    }

    // Cross-faction 차단: 본인 진영과 다른 함선은 함대에 못 넣음(창고 전용·마켓 판매만)
    // [v7.322] 단, 합체 유닛(pilgrim 진영 또는 size_class='assembled')은 전 유저 공용 — 진영 무관 편입 허용.
    const { rows: ownerRows } = await client.query(`SELECT faction_code FROM users WHERE LOWER(wallet_address) = LOWER($1)`, [walletAddress]);
    const ownerFaction = (ownerRows[0] && (ownerRows[0].faction_code||'').toLowerCase()) || '';
    const isUniversal = (s) => (s.ship_faction||'').toLowerCase() === 'pilgrim' || (s.ship_size||'').toLowerCase() === 'assembled';
    const crossFaction = shipRows.filter(s => !isUniversal(s) && (s.ship_faction||'').toLowerCase() !== ownerFaction);
    if (crossFaction.length > 0) {
      const err = new Error('CROSS_FACTION_SHIP');
      err.meta = { ship_ids: crossFaction.map(s => Number(s.id)), reason: 'cannot deploy other-faction ships; list on market instead' };
      throw err;
    }
    
    const dead = shipRows.filter(s => !s.is_alive);
    if (dead.length > 0) {
      // 죽은 함선은 이동 제외
      const aliveIds = shipRows.filter(s => s.is_alive).map(s => s.id);
      if (aliveIds.length === 0) throw new Error('NO_ALIVE_SHIPS');
      shipIds = aliveIds;
    }
    
    // 이동 (기함 상태는 해제 — 대상 함대에 기함 있을 수 있음)
    await client.query(`
      UPDATE ships 
      SET fleet_id = $1, is_flagship = false
      WHERE id = ANY($2::bigint[])
    `, [targetFleetId, shipIds]);
    
    // 대상 함대에 기함 없으면 하나 지정
    await ensureFlagship(client, targetFleetId);
    
    // 원래 함대들 중 기함 없어진 것들 다시 지정
    const sourceFleetIds = [...new Set(shipRows.map(s => s.fleet_id))]
      .filter(Boolean)
      .filter(fid => fid !== targetFleetId);
    for (const fid of sourceFleetIds) {
      await ensureFlagship(client, fid);
    }
    
    await client.query('COMMIT');
    
    return {
      success: true,
      moved_count: shipIds.length,
      skipped_dead: dead.length,
      target_fleet_id: targetFleetId,
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ─── 기함 설정 ───

async function setFlagship(walletAddress, fleetId, shipId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // 함대 소유권
    const { rows: fleetRows } = await client.query(
      `SELECT id, is_in_battle FROM fleets WHERE id = $1 AND LOWER(owner_wallet) = LOWER($2) FOR UPDATE`,
      [fleetId, walletAddress]
    );
    if (!fleetRows[0]) throw new Error('FLEET_NOT_FOUND');
    if (fleetRows[0].is_in_battle) throw new Error('FLEET_IN_BATTLE');
    
    // 함선이 이 함대에 있고, 살아있고, 기함 가능한지
    const { rows: shipRows } = await client.query(`
      SELECT s.id, s.fleet_id, s.is_alive,
             COALESCE(s.is_market_listed, false) AS is_market_listed,
             st.is_flagship_capable
      FROM ships s
      JOIN ship_types st ON st.code = s.ship_type_code
      WHERE s.id = $1 AND LOWER(s.owner_wallet) = LOWER($2)
      FOR UPDATE OF s
    `, [shipId, walletAddress]);
    
    if (!shipRows[0]) throw new Error('SHIP_NOT_FOUND');
    if (shipRows[0].is_market_listed) throw new Error('SHIP_LISTED_FOR_SALE');
    if (!shipRows[0].is_alive) throw new Error('SHIP_DEAD');
    if (Number(shipRows[0].fleet_id) !== Number(fleetId)) throw new Error('SHIP_NOT_IN_FLEET');
    if (!shipRows[0].is_flagship_capable) throw new Error('SHIP_CANNOT_BE_FLAGSHIP');
    
    // 기존 기함 해제
    await client.query(
      `SELECT id FROM ships WHERE fleet_id = $1 AND is_flagship = true FOR UPDATE`,
      [fleetId]
    );
    await client.query(
      `UPDATE ships SET is_flagship = false WHERE fleet_id = $1 AND is_flagship = true`,
      [fleetId]
    );
    
    // 새 기함 지정
    await client.query(
      `UPDATE ships SET is_flagship = true WHERE id = $1`,
      [shipId]
    );
    
    await client.query('COMMIT');
    return { success: true, fleet_id: fleetId, flagship_ship_id: shipId };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ─── 내부 헬퍼: 함대에 기함 보장 ───

async function ensureFlagship(client, fleetId) {
  // 이미 기함 있으면 패스
  const { rows: existingFlag } = await client.query(
    `SELECT id
     FROM ships
     WHERE fleet_id = $1
       AND is_flagship = true
       AND is_alive = true
       AND COALESCE(is_market_listed, false) = false
     LIMIT 1
     FOR UPDATE`,
    [fleetId]
  );
  if (existingFlag[0]) return existingFlag[0].id;
  
  // 가장 큰 함선을 기함으로
  const { rows: candidateRows } = await client.query(`
    SELECT s.id
    FROM ships s
    JOIN ship_types st ON st.code = s.ship_type_code
    WHERE s.fleet_id = $1
      AND s.is_alive = true
      AND COALESCE(s.is_market_listed, false) = false
      AND st.is_flagship_capable = true
    ORDER BY st.sort_order DESC, s.id ASC
    LIMIT 1
    FOR UPDATE OF s
  `, [fleetId]);
  
  if (candidateRows[0]) {
    await client.query(
      `UPDATE ships SET is_flagship = true WHERE id = $1`,
      [candidateRows[0].id]
    );
    return candidateRows[0].id;
  }
  
  return null; // 함선 하나도 없음
}

// ─── 옵션 조회 (UI용) ───

function getFormationOptions() {
  return Object.entries(FORMATION_INFO).map(([code, info]) => ({ 
    code, ...info 
  }));
}

function getMovementOptions() {
  return Object.entries(MOVEMENT_INFO).map(([code, info]) => ({ 
    code, ...info 
  }));
}

// ─── settings 헬퍼 ───

async function getSettingInt(client, key, fallback) {
  try {
    const val = await getSetting(key, fallback);
    if (typeof val === 'number') return val;
    if (typeof val === 'string') {
      const cleaned = val.replace(/^"|"$/g, '');
      const n = parseInt(cleaned, 10);
      return isNaN(n) ? fallback : n;
    }
    return val || fallback;
  } catch { return fallback; }
}

module.exports = {
  VALID_FORMATIONS,
  VALID_MOVEMENTS,
  FORMATION_INFO,
  MOVEMENT_INFO,
  listMyFleets,
  getFleetDetail,
  createFleet,
  updateFleet,
  deleteFleet,
  moveShips,
  setFlagship,
  getFormationOptions,
  getMovementOptions,
};
