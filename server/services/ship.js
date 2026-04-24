// server/services/ship.js
// ═══════════════════════════════════════════════════════════════
// Ship Service — 함선 건조/조회/완료 처리
// 
// 주요 기능:
//   - getBlueprints()    : 건조 가능 함선 목록 (파벌 필터)
//   - getMyShips()       : 내 함선 목록
//   - getBuildJobs()     : 진행 중 건조 작업
//   - startBuild()       : 함선 건조 시작 (GP + 광물 차감)
//   - completeBuildJob() : 건조 완료 처리 (스케줄러용)
//   - cancelBuildJob()   : 건조 취소 (환불)
//   - checkCompleted()   : 완료된 작업 자동 처리 (스케줄러)
// ═══════════════════════════════════════════════════════════════

const { pool } = require('../db');

// ─── 건조 가능 함선 블루프린트 조회 ───

/**
 * 유저가 건조 가능한 함선 목록
 * @param {string} walletAddress
 * @param {Object} options - { factionCode?, sizeClass?, includeLocked? }
 */
async function getBlueprints(walletAddress, options = {}) {
  // 유저 파벌 확인
  const { rows: userRows } = await pool.query(
    `SELECT faction_code, rank_level, gp_balance FROM users WHERE wallet_address = $1`,
    [walletAddress]
  );
  if (!userRows[0]) throw new Error('USER_NOT_FOUND');
  const user = userRows[0];
  
  // 기본 쿼리: 활성 함선만
  let query = `
    SELECT 
      st.code, st.faction_code, st.size_class, st.role, st.tier,
      st.name_en, st.name_ko, st.class_label, st.description_ko,
      st.base_hp, st.base_atk, st.base_def, st.base_speed,
      st.fire_type, st.render_radius,
      st.build_time_seconds, st.max_per_server, st.max_per_player, st.min_player_rank,
      st.build_gp_cost, st.recipe_minerals,
      st.is_capital, st.sort_order,
      f.name_ko AS faction_name_ko, f.color_primary AS faction_color,
      -- 서버 생존 함선 수 (Titan 한도 체크)
      (SELECT COUNT(*) FROM ships WHERE ship_type_code = st.code AND is_alive = true) AS server_alive_count,
      -- 내가 가진 수
      (SELECT COUNT(*) FROM ships WHERE ship_type_code = st.code AND owner_wallet = $1 AND is_alive = true) AS my_count
    FROM ship_types st
    LEFT JOIN factions f ON f.code = st.faction_code
    WHERE st.is_active = true
  `;
  const params = [walletAddress];
  
  // 파벌 필터: 유저 파벌이 있으면 해당 파벌만
  if (user.faction_code && !options.includeLocked) {
    params.push(user.faction_code);
    query += ` AND st.faction_code = $${params.length}`;
  }
  if (options.factionCode) {
    params.push(options.factionCode);
    query += ` AND st.faction_code = $${params.length}`;
  }
  if (options.sizeClass) {
    params.push(options.sizeClass);
    query += ` AND st.size_class = $${params.length}`;
  }
  
  query += ` ORDER BY st.faction_code, st.sort_order`;
  
  const { rows } = await pool.query(query, params);
  
  // 각 함선에 "건조 가능 여부" 플래그 추가
  return rows.map(ship => {
    const locks = [];
    
    // 파벌 미선택
    if (!user.faction_code) locks.push('NO_FACTION');
    // 다른 파벌 함선
    else if (ship.faction_code !== user.faction_code) locks.push('WRONG_FACTION');
    // 레벨 부족
    if ((user.rank_level || 1) < ship.min_player_rank) {
      locks.push(`RANK_REQUIRED_${ship.min_player_rank}`);
    }
    // 서버 한도 (Titan)
    if (ship.max_per_server && parseInt(ship.server_alive_count) >= ship.max_per_server) {
      locks.push('SERVER_LIMIT');
    }
    // 유저 한도 (Titan/Battleship)
    if (ship.max_per_player && parseInt(ship.my_count) >= ship.max_per_player) {
      locks.push('PLAYER_LIMIT');
    }
    
    return {
      ...ship,
      server_alive_count: parseInt(ship.server_alive_count),
      my_count: parseInt(ship.my_count),
      can_build: locks.length === 0,
      locks,
    };
  });
}

// ─── 내 함선 조회 ───

async function getMyShips(walletAddress, options = {}) {
  let query = `
    SELECT 
      s.id, s.fleet_id, s.ship_type_code,
      s.current_hp, s.max_hp, s.is_flagship, s.is_alive,
      s.shield_hp, s.shield_max,
      s.upgrade_level, s.bonus_atk, s.bonus_def, s.bonus_hp,
      s.kills_dealt, s.damage_dealt,
      s.built_at,
      st.name_ko, st.class_label, st.size_class, st.role, st.render_radius,
      st.base_atk, st.base_def, st.base_speed,
      f.code AS faction_code, f.name_ko AS faction_name, f.color_primary AS faction_color,
      fl.name AS fleet_name
    FROM ships s
    JOIN ship_types st ON st.code = s.ship_type_code
    LEFT JOIN factions f ON f.code = st.faction_code
    LEFT JOIN fleets fl ON fl.id = s.fleet_id
    WHERE s.owner_wallet = $1
  `;
  const params = [walletAddress];
  
  if (!options.includeDead) {
    query += ` AND s.is_alive = true`;
  }
  if (options.fleetId) {
    params.push(options.fleetId);
    query += ` AND s.fleet_id = $${params.length}`;
  }
  
  query += ` ORDER BY st.sort_order DESC, s.built_at DESC`;
  
  const { rows } = await pool.query(query, params);
  return rows;
}

// ─── 진행 중 건조 작업 ───

async function getBuildJobs(walletAddress) {
  const { rows } = await pool.query(`
    SELECT 
      j.id, j.ship_type_code, j.fleet_id,
      j.started_at, j.completes_at, j.status,
      j.gp_cost, j.minerals_used,
      st.name_ko, st.class_label, st.size_class,
      f.color_primary AS faction_color,
      EXTRACT(EPOCH FROM (j.completes_at - NOW())) AS seconds_remaining,
      EXTRACT(EPOCH FROM (NOW() - j.started_at)) AS seconds_elapsed,
      EXTRACT(EPOCH FROM (j.completes_at - j.started_at)) AS total_seconds
    FROM ship_build_jobs j
    JOIN ship_types st ON st.code = j.ship_type_code
    LEFT JOIN factions f ON f.code = st.faction_code
    WHERE j.wallet_address = $1 AND j.status = 'building'
    ORDER BY j.completes_at ASC
  `, [walletAddress]);
  
  return rows.map(j => ({
    ...j,
    seconds_remaining: Math.max(0, parseFloat(j.seconds_remaining) || 0),
    seconds_elapsed: parseFloat(j.seconds_elapsed) || 0,
    total_seconds: parseFloat(j.total_seconds) || 1,
    progress_pct: Math.min(100, 
      ((parseFloat(j.seconds_elapsed) || 0) / (parseFloat(j.total_seconds) || 1)) * 100
    ),
  }));
}

// ─── 건조 시작 ───

/**
 * @returns {Object} { job_id, completes_at, gp_cost, minerals_used }
 */
async function startBuild(walletAddress, shipTypeCode, fleetId = null) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // 1. 유저 정보
    const { rows: userRows } = await client.query(
      `SELECT wallet_address, faction_code, rank_level, gp_balance
       FROM users WHERE wallet_address = $1 FOR UPDATE`,
      [walletAddress]
    );
    if (!userRows[0]) throw new Error('USER_NOT_FOUND');
    const user = userRows[0];
    
    if (!user.faction_code) throw new Error('NO_FACTION');
    
    // 2. 함선 타입 정보
    const { rows: stRows } = await client.query(
      `SELECT * FROM ship_types WHERE code = $1 AND is_active = true`,
      [shipTypeCode]
    );
    if (!stRows[0]) throw new Error('INVALID_SHIP_TYPE');
    const st = stRows[0];
    
    // 3. 파벌 일치 확인
    if (st.faction_code !== user.faction_code) {
      throw new Error('WRONG_FACTION');
    }
    
    // 4. 레벨 체크
    if ((user.rank_level || 1) < st.min_player_rank) {
      const err = new Error('RANK_REQUIRED');
      err.meta = { required: st.min_player_rank, current: user.rank_level };
      throw err;
    }
    
    // 5. 서버 한도 체크 (Titan)
    if (st.max_per_server) {
      const { rows: cntRows } = await client.query(
        `SELECT COUNT(*) AS c FROM ships WHERE ship_type_code = $1 AND is_alive = true`,
        [shipTypeCode]
      );
      // 건조 중인 것도 포함해야 공정
      const { rows: jobCntRows } = await client.query(
        `SELECT COUNT(*) AS c FROM ship_build_jobs WHERE ship_type_code = $1 AND status = 'building'`,
        [shipTypeCode]
      );
      const total = parseInt(cntRows[0].c) + parseInt(jobCntRows[0].c);
      if (total >= st.max_per_server) {
        const err = new Error('SERVER_LIMIT_REACHED');
        err.meta = { max: st.max_per_server, current: total };
        throw err;
      }
    }
    
    // 6. 유저 한도 체크
    if (st.max_per_player) {
      const { rows: cntRows } = await client.query(
        `SELECT COUNT(*) AS c FROM ships 
         WHERE owner_wallet = $1 AND ship_type_code = $2 AND is_alive = true`,
        [walletAddress, shipTypeCode]
      );
      const { rows: jobCntRows } = await client.query(
        `SELECT COUNT(*) AS c FROM ship_build_jobs 
         WHERE wallet_address = $1 AND ship_type_code = $2 AND status = 'building'`,
        [walletAddress, shipTypeCode]
      );
      const total = parseInt(cntRows[0].c) + parseInt(jobCntRows[0].c);
      if (total >= st.max_per_player) {
        throw new Error('PLAYER_LIMIT_REACHED');
      }
    }
    
    // 7. 유저 총 함선 수 체크 (기본 200척)
    const { rows: totalCntRows } = await client.query(
      `SELECT COUNT(*) AS c FROM ships WHERE owner_wallet = $1 AND is_alive = true`,
      [walletAddress]
    );
    const { rows: totalJobCntRows } = await client.query(
      `SELECT COUNT(*) AS c FROM ship_build_jobs WHERE wallet_address = $1 AND status = 'building'`,
      [walletAddress]
    );
    const maxPerPlayer = await getSettingInt(client, 'max_ships_per_player', 200);
    const totalCount = parseInt(totalCntRows[0].c) + parseInt(totalJobCntRows[0].c);
    if (totalCount >= maxPerPlayer) {
      throw new Error('PLAYER_FLEET_FULL');
    }
    
    // 8. GP 차감
    const gpCost = st.build_gp_cost || 0;
    if (parseInt(user.gp_balance) < gpCost) {
      const err = new Error('INSUFFICIENT_GP');
      err.meta = { required: gpCost, balance: user.gp_balance };
      throw err;
    }
    if (gpCost > 0) {
      await client.query(
        `UPDATE users SET gp_balance = gp_balance - $1 WHERE wallet_address = $2`,
        [gpCost, walletAddress]
      );
    }
    
    // 9. 광물 차감
    const recipe = st.recipe_minerals || {};
    const mineralEntries = Object.entries(recipe);

    // 재고 확인 (resource_id FK 기반 — resources 테이블 조인)
    if (mineralEntries.length > 0) {
      const mineralCodes = mineralEntries.map(([code]) => code);
      const { rows: invRows } = await client.query(`
        SELECT r.code AS resource_code, COALESCE(uri.quantity, 0) AS quantity, r.id AS resource_id
        FROM resources r
        LEFT JOIN user_resource_inventory uri
          ON uri.resource_id = r.id AND uri.wallet_address = $1
        WHERE r.code = ANY($2::text[])
        FOR UPDATE OF uri
      `, [walletAddress, mineralCodes]);

      const inv = {};
      for (const r of invRows) inv[r.resource_code] = { qty: parseInt(r.quantity), id: r.resource_id };

      // 부족 체크
      const missing = [];
      for (const [code, need] of mineralEntries) {
        const have = inv[code]?.qty || 0;
        if (have < need) {
          missing.push({ code, need, have });
        }
      }
      if (missing.length > 0) {
        const err = new Error('INSUFFICIENT_MINERALS');
        err.meta = { missing };
        throw err;
      }

      // 차감 (resource_id 기반)
      for (const [code, need] of mineralEntries) {
        const resourceId = inv[code]?.id;
        if (!resourceId) throw new Error(`UNKNOWN_MINERAL: ${code}`);
        await client.query(`
          UPDATE user_resource_inventory
          SET quantity = quantity - $1
          WHERE wallet_address = $2 AND resource_id = $3
        `, [need, walletAddress, resourceId]);
      }
    }
    
    // 10. fleet_id 확인 (주어졌으면 소유권 확인)
    if (fleetId) {
      const { rows: fleetRows } = await client.query(
        `SELECT id FROM fleets WHERE id = $1 AND owner_wallet = $2`,
        [fleetId, walletAddress]
      );
      if (!fleetRows[0]) {
        throw new Error('FLEET_NOT_FOUND');
      }
    }
    
    // 11. 건조 작업 생성
    const buildSeconds = st.build_time_seconds || 600;
    const { rows: jobRows } = await client.query(`
      INSERT INTO ship_build_jobs (
        wallet_address, fleet_id, ship_type_code,
        started_at, completes_at, status,
        gp_cost, minerals_used
      ) VALUES ($1, $2, $3, NOW(), NOW() + ($4 || ' seconds')::INTERVAL, 'building', $5, $6)
      RETURNING id, started_at, completes_at
    `, [walletAddress, fleetId, shipTypeCode, String(buildSeconds), gpCost, JSON.stringify(recipe)]);
    const job = jobRows[0];
    
    // 12. 로그
    await client.query(`
      INSERT INTO ship_build_log (wallet_address, ship_type_code, gp_cost, minerals_used, result)
      VALUES ($1, $2, $3, $4, 'success')
    `, [walletAddress, shipTypeCode, gpCost, JSON.stringify(recipe)]);
    
    // GP activity log (있으면)
    if (gpCost > 0) {
      await client.query(`
        INSERT INTO fleet_gp_activity (wallet_address, activity_type, gp_delta, meta)
        VALUES ($1, 'ship_build_gp_spent', $2, $3)
      `, [walletAddress, -gpCost, JSON.stringify({ 
        ship_type: shipTypeCode, 
        job_id: job.id 
      })]).catch(() => {});
    }
    
    await client.query('COMMIT');

    // ── GP 활동 로그 + 시즌 점수 (fire-and-forget, COMMIT 후) ──
    if (gpCost > 0) {
      try {
        const { logGPActivity } = require('../db');
        logGPActivity(walletAddress, -gpCost, 'ship_build', `함선 건조: ${shipTypeCode}`).catch(()=>{});
      } catch (_) {}
    }
    try {
      const seasonSvc = require('./season');
      if (gpCost > 0) seasonSvc.addSeasonScore(walletAddress, 'gp_spend', gpCost).catch(()=>{});
      seasonSvc.addSeasonScore(walletAddress, 'fleet_action', 1).catch(()=>{});
    } catch (_) {}

    return {
      job_id: job.id,
      ship_type_code: shipTypeCode,
      started_at: job.started_at,
      completes_at: job.completes_at,
      build_seconds: buildSeconds,
      gp_cost: gpCost,
      minerals_used: recipe,
    };
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch {}
    throw err;
  } finally {
    client.release();
  }
}

// ─── 건조 완료 처리 (단일 작업) ───

/**
 * 특정 작업을 완료 처리. 스케줄러 또는 유저 클릭으로 호출 가능
 */
async function completeBuildJob(jobId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // 작업 조회 (락)
    const { rows: jobRows } = await client.query(
      `SELECT * FROM ship_build_jobs WHERE id = $1 FOR UPDATE`,
      [jobId]
    );
    if (!jobRows[0]) throw new Error('JOB_NOT_FOUND');
    const job = jobRows[0];
    
    if (job.status !== 'building') {
      await client.query('ROLLBACK');
      return { already_completed: true, job };
    }
    
    // 완료 시간 체크
    if (new Date(job.completes_at) > new Date()) {
      await client.query('ROLLBACK');
      throw new Error('NOT_YET_COMPLETE');
    }
    
    // 함선 타입 정보
    const { rows: stRows } = await client.query(
      `SELECT * FROM ship_types WHERE code = $1`,
      [job.ship_type_code]
    );
    const st = stRows[0];
    
    // fleet_id 결정: 지정된 함대 없으면 기본 함대 사용/생성
    let fleetId = job.fleet_id;
    if (!fleetId) {
      fleetId = await getOrCreateDefaultFleet(client, job.wallet_address);
    } else {
      // 지정된 함대가 아직 존재하는지 확인
      const { rows: flRows } = await client.query(
        `SELECT id FROM fleets WHERE id = $1 AND owner_wallet = $2`,
        [fleetId, job.wallet_address]
      );
      if (!flRows[0]) {
        fleetId = await getOrCreateDefaultFleet(client, job.wallet_address);
      }
    }
    
    // 기함 여부: 함대에 기함이 없으면 이 함선을 기함으로
    const { rows: flagRows } = await client.query(
      `SELECT COUNT(*) AS c FROM ships 
       WHERE fleet_id = $1 AND is_flagship = true AND is_alive = true`,
      [fleetId]
    );
    const isFlagship = parseInt(flagRows[0].c) === 0 && st.is_flagship_capable;
    
    // 함선 생성 (트리거가 Titan/유저 한도 체크)
    const { rows: shipRows } = await client.query(`
      INSERT INTO ships (
        fleet_id, ship_type_code, owner_wallet,
        current_hp, max_hp, is_flagship, is_alive,
        built_at, built_by_wallet
      ) VALUES ($1, $2, $3, $4, $4, $5, true, NOW(), $3)
      RETURNING id
    `, [fleetId, job.ship_type_code, job.wallet_address, st.base_hp, isFlagship]);
    
    const shipId = shipRows[0].id;
    
    // 작업 완료 처리
    await client.query(`
      UPDATE ship_build_jobs 
      SET status = 'completed', completed_at = NOW(), result_ship_id = $1
      WHERE id = $2
    `, [shipId, jobId]);
    
    await client.query('COMMIT');
    
    return {
      success: true,
      job_id: jobId,
      ship_id: shipId,
      fleet_id: fleetId,
      is_flagship: isFlagship,
    };
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch {}
    throw err;
  } finally {
    client.release();
  }
}

// ─── 완료된 작업 일괄 처리 (스케줄러) ───

/**
 * 스케줄러에서 주기적으로 호출. 완료 시각 지난 작업들 자동 처리
 */
async function processCompletedJobs() {
  const { rows } = await pool.query(`
    SELECT id FROM ship_build_jobs 
    WHERE status = 'building' AND completes_at <= NOW()
    ORDER BY completes_at ASC
    LIMIT 100
  `);
  
  const results = { success: 0, failed: 0, errors: [] };
  
  for (const row of rows) {
    try {
      await completeBuildJob(row.id);
      results.success++;
    } catch (err) {
      results.failed++;
      results.errors.push({ job_id: row.id, error: err.message });
      console.error(`[ship] completeBuildJob ${row.id} failed:`, err.message);
    }
  }
  
  return results;
}

// ─── 건조 취소 (환불) ───

async function cancelBuildJob(jobId, walletAddress) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const { rows: jobRows } = await client.query(
      `SELECT * FROM ship_build_jobs 
       WHERE id = $1 AND wallet_address = $2 FOR UPDATE`,
      [jobId, walletAddress]
    );
    if (!jobRows[0]) throw new Error('JOB_NOT_FOUND');
    const job = jobRows[0];
    
    if (job.status !== 'building') {
      throw new Error('JOB_NOT_CANCELLABLE');
    }
    
    // 환불율 (기본 50%)
    const refundPct = await getSettingInt(client, 'ship_build_cancel_refund_pct', 50);
    
    // GP 환불
    const refundedGp = Math.floor((job.gp_cost || 0) * refundPct / 100);
    if (refundedGp > 0) {
      await client.query(
        `UPDATE users SET gp_balance = gp_balance + $1 WHERE wallet_address = $2`,
        [refundedGp, walletAddress]
      );
    }
    
    // 광물 환불 (resource_id FK 기반 UPSERT)
    const minerals = job.minerals_used || {};
    const refundedMinerals = {};
    for (const [code, qty] of Object.entries(minerals)) {
      const refundQty = Math.floor(qty * refundPct / 100);
      if (refundQty > 0) {
        refundedMinerals[code] = refundQty;
        await client.query(`
          INSERT INTO user_resource_inventory (wallet_address, resource_id, quantity, updated_at)
          SELECT $1, r.id, $2, NOW()
          FROM resources r WHERE r.code = $3
          ON CONFLICT (wallet_address, resource_id)
          DO UPDATE SET
            quantity   = user_resource_inventory.quantity + EXCLUDED.quantity,
            updated_at = NOW()
        `, [walletAddress, refundQty, code]);
      }
    }
    
    // 작업 취소 처리
    await client.query(`
      UPDATE ship_build_jobs 
      SET status = 'cancelled', completed_at = NOW()
      WHERE id = $1
    `, [jobId]);
    
    // 로그
    await client.query(`
      INSERT INTO ship_build_log (wallet_address, ship_type_code, gp_cost, minerals_used, result)
      VALUES ($1, $2, $3, $4, 'cancelled')
    `, [walletAddress, job.ship_type_code, -refundedGp, JSON.stringify(refundedMinerals)]);
    
    // GP activity log
    if (refundedGp > 0) {
      await client.query(`
        INSERT INTO fleet_gp_activity (wallet_address, activity_type, gp_delta, meta)
        VALUES ($1, 'ship_build_refund', $2, $3)
      `, [walletAddress, refundedGp, JSON.stringify({ 
        job_id: jobId, 
        refund_pct: refundPct,
        cancelled: true
      })]).catch(() => {});
    }
    
    await client.query('COMMIT');

    // ── GP 활동 로그 (환불, fire-and-forget) ──
    if (refundedGp > 0) {
      try {
        const { logGPActivity } = require('../db');
        logGPActivity(walletAddress, refundedGp, 'ship_build_refund', `건조 취소 환불 (${refundPct}%)`).catch(()=>{});
      } catch (_) {}
    }

    return {
      success: true,
      refunded_gp: refundedGp,
      refunded_minerals: refundedMinerals,
      refund_pct: refundPct,
    };
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch {}
    throw err;
  } finally {
    client.release();
  }
}

// ─── 함대 자동 생성 (유저의 첫 함선용) ───

async function getOrCreateDefaultFleet(client, walletAddress) {
  // 기존 함대가 있으면 첫 번째 반환
  const { rows: existing } = await client.query(
    `SELECT id FROM fleets WHERE owner_wallet = $1 ORDER BY id ASC LIMIT 1`,
    [walletAddress]
  );
  if (existing[0]) return existing[0].id;
  
  // 없으면 기본 함대 생성
  const { rows: nick } = await client.query(
    `SELECT nickname FROM users WHERE wallet_address = $1`,
    [walletAddress]
  );
  const name = `${nick[0]?.nickname || 'Commander'} 제1함대`;
  
  const { rows } = await client.query(`
    INSERT INTO fleets (owner_wallet, name, formation, movement)
    VALUES ($1, $2, 'sphere', 'advance')
    RETURNING id
  `, [walletAddress, name]);
  
  return rows[0].id;
}

// ─── 유저 함대 요약 (간단 stats) ───

async function getFleetSummary(walletAddress) {
  const { rows } = await pool.query(`
    SELECT 
      COUNT(DISTINCT f.id) AS fleet_count,
      COUNT(s.id) FILTER (WHERE s.is_alive) AS ships_alive,
      COUNT(s.id) FILTER (WHERE s.is_alive AND st.is_capital) AS capital_ships,
      COALESCE(SUM(s.current_hp) FILTER (WHERE s.is_alive), 0) AS total_hp,
      (SELECT COUNT(*) FROM ship_build_jobs 
       WHERE wallet_address = $1 AND status = 'building') AS jobs_in_progress
    FROM fleets f
    LEFT JOIN ships s ON s.fleet_id = f.id
    LEFT JOIN ship_types st ON st.code = s.ship_type_code
    WHERE f.owner_wallet = $1
  `, [walletAddress]);
  
  return rows[0] || { 
    fleet_count: 0, ships_alive: 0, capital_ships: 0, 
    total_hp: 0, jobs_in_progress: 0 
  };
}

// ─── 함선 수리 ───

/**
 * 함선을 수리한다.
 * @param {string} walletAddress
 * @param {number} shipId
 * @param {number} targetHpPct  - 수리 목표 HP% (기본 100 = 풀회복)
 * @returns {{ success, healed, new_hp, gp_cost, iron_used }}
 */
async function repairShip(walletAddress, shipId, targetHpPct = 100) {
  const { getSetting } = require('../db');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. 함선 조회 (소유권 + 생존 확인)
    const { rows: shipRows } = await client.query(`
      SELECT s.id, s.current_hp, s.max_hp, s.bonus_hp,
             st.name_ko
      FROM ships s
      JOIN ship_types st ON st.code = s.ship_type_code
      WHERE s.id = $1 AND s.owner_wallet = $2 AND s.is_alive = true
      FOR UPDATE OF s
    `, [shipId, walletAddress]);

    if (!shipRows[0]) {
      const err = new Error('SHIP_NOT_FOUND');
      throw err;
    }
    const ship = shipRows[0];

    // 2. 이미 풀체력이면 에러
    const effectiveMax = parseInt(ship.max_hp) + parseInt(ship.bonus_hp || 0);
    if (parseInt(ship.current_hp) >= effectiveMax) {
      const err = new Error('ALREADY_FULL');
      err.meta = { current_hp: ship.current_hp, max_hp: effectiveMax };
      throw err;
    }

    // 3. 목표 HP 계산
    const repairMaxPct = parseInt(await getSetting('ship_repair_max_pct', '100')) || 100;
    const clampedPct = Math.min(targetHpPct, repairMaxPct);
    const targetHp = Math.min(Math.floor(effectiveMax * clampedPct / 100), effectiveMax);
    const healAmount = targetHp - parseInt(ship.current_hp);

    if (healAmount <= 0) {
      const err = new Error('ALREADY_FULL');
      err.meta = { current_hp: ship.current_hp, target_hp: targetHp };
      throw err;
    }

    // 4. 비용 계산
    const gpPerHp     = parseInt(await getSetting('ship_repair_gp_per_hp', '2'))     || 2;
    const ironPer10hp = parseInt(await getSetting('ship_repair_iron_per_10hp', '1')) || 1;

    const gpCost   = healAmount * gpPerHp;
    const ironNeed = Math.ceil(healAmount / 10) * ironPer10hp;

    // 5. GP 확인
    const { rows: userRows } = await client.query(
      `SELECT gp_balance FROM users WHERE wallet_address = $1 FOR UPDATE`,
      [walletAddress]
    );
    if (!userRows[0]) throw new Error('USER_NOT_FOUND');
    if (parseInt(userRows[0].gp_balance) < gpCost) {
      const err = new Error('INSUFFICIENT_GP');
      err.meta = { required: gpCost, balance: userRows[0].gp_balance };
      throw err;
    }

    // 6. iron_ore 재고 확인 (resource_id FK 기반)
    const { rows: invRows } = await client.query(`
      SELECT r.id AS resource_id, COALESCE(uri.quantity, 0) AS quantity
      FROM resources r
      LEFT JOIN user_resource_inventory uri
        ON uri.resource_id = r.id AND uri.wallet_address = $1
      WHERE r.code = 'iron_ore'
      FOR UPDATE OF uri
    `, [walletAddress]);

    if (!invRows[0]) {
      const err = new Error('INSUFFICIENT_IRON');
      err.meta = { required: ironNeed, have: 0 };
      throw err;
    }
    const ironInv = invRows[0];
    if (parseInt(ironInv.quantity) < ironNeed) {
      const err = new Error('INSUFFICIENT_IRON');
      err.meta = { required: ironNeed, have: ironInv.quantity };
      throw err;
    }

    // 7. GP 차감
    await client.query(
      `UPDATE users SET gp_balance = gp_balance - $1 WHERE wallet_address = $2`,
      [gpCost, walletAddress]
    );

    // 8. iron_ore 차감
    await client.query(`
      UPDATE user_resource_inventory
      SET quantity = quantity - $1, updated_at = NOW()
      WHERE wallet_address = $2 AND resource_id = $3
    `, [ironNeed, walletAddress, ironInv.resource_id]);

    // 9. 함선 HP 업데이트
    await client.query(
      `UPDATE ships SET current_hp = $1 WHERE id = $2`,
      [targetHp, shipId]
    );

    await client.query('COMMIT');

    // 10. GP 활동 로그 (fire-and-forget)
    try {
      const { logGPActivity } = require('../db');
      logGPActivity(walletAddress, -gpCost, 'ship_repair',
        `함선 수리 (ID:${shipId}) +${healAmount}HP`).catch(() => {});
    } catch (_) {}

    return {
      success:  true,
      healed:   healAmount,
      new_hp:   targetHp,
      gp_cost:  gpCost,
      iron_used: ironNeed,
    };
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch (_) {}
    throw err;
  } finally {
    client.release();
  }
}

// ─── 함선 실드 충전 ───

/**
 * 함선 실드를 충전한다.
 * @param {string} walletAddress
 * @param {number} shipId
 * @param {number} units  - 충전할 실드 HP 양
 * @returns {{ success, shield_added, new_shield, gp_cost }}
 */
async function chargeShield(walletAddress, shipId, units) {
  const { getSetting } = require('../db');

  if (!units || units <= 0) {
    const err = new Error('INVALID_UNITS');
    err.meta = { units };
    throw err;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. 함선 조회
    const { rows: shipRows } = await client.query(`
      SELECT s.id, s.max_hp, s.bonus_hp, s.shield_hp, s.shield_max
      FROM ships s
      WHERE s.id = $1 AND s.owner_wallet = $2 AND s.is_alive = true
      FOR UPDATE OF s
    `, [shipId, walletAddress]);

    if (!shipRows[0]) throw new Error('SHIP_NOT_FOUND');
    const ship = shipRows[0];

    // 2. 실드 최대치 계산
    const shieldMaxRatio = parseInt(await getSetting('shield_max_ratio', '50')) || 50;
    const effectiveMax = parseInt(ship.max_hp) + parseInt(ship.bonus_hp || 0);
    const shieldMax    = Math.floor(effectiveMax * shieldMaxRatio / 100);

    const currentShield = parseInt(ship.shield_hp) || 0;
    const canAdd = shieldMax - currentShield;

    if (canAdd <= 0) {
      const err = new Error('SHIELD_FULL');
      err.meta = { current_shield: currentShield, shield_max: shieldMax };
      throw err;
    }
    if (units > canAdd) {
      const err = new Error('SHIELD_FULL');
      err.meta = { requested: units, can_add: canAdd, shield_max: shieldMax };
      throw err;
    }

    // 3. GP 비용 계산
    const gpPerUnit = parseInt(await getSetting('shield_gp_per_unit', '3')) || 3;
    const gpCost    = units * gpPerUnit;

    // 4. GP 확인
    const { rows: userRows } = await client.query(
      `SELECT gp_balance FROM users WHERE wallet_address = $1 FOR UPDATE`,
      [walletAddress]
    );
    if (!userRows[0]) throw new Error('USER_NOT_FOUND');
    if (parseInt(userRows[0].gp_balance) < gpCost) {
      const err = new Error('INSUFFICIENT_GP');
      err.meta = { required: gpCost, balance: userRows[0].gp_balance };
      throw err;
    }

    // 5. GP 차감
    await client.query(
      `UPDATE users SET gp_balance = gp_balance - $1 WHERE wallet_address = $2`,
      [gpCost, walletAddress]
    );

    // 6. 실드 업데이트
    const newShield = currentShield + units;
    await client.query(
      `UPDATE ships SET shield_hp = $1, shield_max = $2 WHERE id = $3`,
      [newShield, shieldMax, shipId]
    );

    await client.query('COMMIT');

    // GP 활동 로그 (fire-and-forget)
    try {
      const { logGPActivity } = require('../db');
      logGPActivity(walletAddress, -gpCost, 'ship_shield',
        `실드 충전 (ID:${shipId}) +${units}`).catch(() => {});
    } catch (_) {}

    return {
      success:       true,
      shield_added:  units,
      new_shield:    newShield,
      gp_cost:       gpCost,
    };
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch (_) {}
    throw err;
  } finally {
    client.release();
  }
}

// ─── 헬퍼 ───

async function getSettingInt(client, key, fallback) {
  try {
    const { rows } = await client.query(
      `SELECT value FROM settings WHERE category = 'fleet' AND key = $1`,
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
    return val || fallback;
  } catch { return fallback; }
}

module.exports = {
  getBlueprints,
  getMyShips,
  getBuildJobs,
  startBuild,
  completeBuildJob,
  processCompletedJobs,
  cancelBuildJob,
  getFleetSummary,
  repairShip,
  chargeShield,
};
