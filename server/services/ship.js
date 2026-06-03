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

const { pool, getSetting } = require('../db');

// ─── 건조 가능 함선 블루프린트 조회 ───

/**
 * 유저가 건조 가능한 함선 목록
 * @param {string} walletAddress
 * @param {Object} options - { factionCode?, sizeClass?, includeLocked? }
 */
async function getBlueprints(walletAddress, options = {}) {
  // 유저 파벌 확인
  const { rows: userRows } = await pool.query(
    `SELECT faction_code, rank_level, gp_balance FROM users WHERE LOWER(wallet_address) = LOWER($1)`,
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
      (SELECT COUNT(*) FROM ships WHERE ship_type_code = st.code AND LOWER(owner_wallet) = LOWER($1) AND is_alive = true) AS my_count
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
      COALESCE(s.is_market_listed, false) AS is_market_listed,
      s.shield_hp, s.shield_max,
      s.upgrade_level, s.bonus_atk, s.bonus_def, s.bonus_hp,
      COALESCE(s.bonus_speed, 0) AS bonus_speed,
      s.quality,
      s.kills_dealt, s.damage_dealt,
      s.built_at,
      st.name_ko, st.class_label, st.size_class, st.role, st.render_radius,
      st.base_atk, st.base_def, st.base_speed,
      f.code AS faction_code, f.name_ko AS faction_name, f.color_primary AS faction_color,
      fl.name AS fleet_name,
      sml.id AS market_listing_id,
      sml.price_gp AS market_price_gp,
      sml.listed_at AS market_listed_at
    FROM ships s
    JOIN ship_types st ON st.code = s.ship_type_code
    LEFT JOIN factions f ON f.code = st.faction_code
    LEFT JOIN fleets fl ON fl.id = s.fleet_id
    LEFT JOIN ship_market_listings sml ON sml.ship_id = s.id AND sml.status = 'active'
    WHERE LOWER(s.owner_wallet) = LOWER($1)
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
  const ships = [];
  for (const ship of rows) {
    const upgradeOffers = {};
    for (const stat of Object.keys(SHIP_UPGRADE_STATS)) {
      const offer = await calcShipUpgradeOffer(pool, ship, stat);
      upgradeOffers[stat] = {
        cost: offer.cost,
        chance: offer.chance,
        material_code: offer.material_code,
        material_qty: offer.material_qty,
        material_tier: offer.material_tier,
        upgrade_level: offer.upgrade_level,
      };
    }
    ships.push({
      ...addShipUpgradeView(ship),
      upgrade_costs: {
        atk: upgradeOffers.atk.cost,
        def: upgradeOffers.def.cost,
        hp: upgradeOffers.hp.cost,
        speed: upgradeOffers.speed.cost,
      },
      upgrade_offers: upgradeOffers,
    });
  }
  return ships;
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
    WHERE LOWER(j.wallet_address) = LOWER($1) AND j.status = 'building'
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
       FROM users WHERE LOWER(wallet_address) = LOWER($1) FOR UPDATE`,
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
      // (TOCTOU 차단 v7.375) 유저 row FOR UPDATE는 서로 다른 지갑을 직렬화하지 못해, 두 유저가
      // 동시에 마지막 슬롯을 통과하면 서버 캡(3/종)을 초과한다. 종(種) 단위 advisory 트랜잭션
      // 락으로 같은 ship_type의 동시 건조를 직렬화한다(COMMIT/ROLLBACK 시 자동 해제).
      await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, ['shipbuild:' + shipTypeCode]);
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
         WHERE LOWER(owner_wallet) = LOWER($1) AND ship_type_code = $2 AND is_alive = true`,
        [walletAddress, shipTypeCode]
      );
      const { rows: jobCntRows } = await client.query(
        `SELECT COUNT(*) AS c FROM ship_build_jobs 
         WHERE LOWER(wallet_address) = LOWER($1) AND ship_type_code = $2 AND status = 'building'`,
        [walletAddress, shipTypeCode]
      );
      const total = parseInt(cntRows[0].c) + parseInt(jobCntRows[0].c);
      if (total >= st.max_per_player) {
        throw new Error('PLAYER_LIMIT_REACHED');
      }
    }
    
    // 7. 유저 총 함선 수 체크 (기본 200척)
    const { rows: totalCntRows } = await client.query(
      `SELECT COUNT(*) AS c FROM ships WHERE LOWER(owner_wallet) = LOWER($1) AND is_alive = true`,
      [walletAddress]
    );
    const { rows: totalJobCntRows } = await client.query(
      `SELECT COUNT(*) AS c FROM ship_build_jobs WHERE LOWER(wallet_address) = LOWER($1) AND status = 'building'`,
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
      const deductBuild = await client.query(
        `UPDATE users SET gp_balance = gp_balance - $1 WHERE LOWER(wallet_address) = LOWER($2) AND gp_balance >= $1`,
        [gpCost, walletAddress]
      );
      if (deductBuild.rowCount === 0) throw new Error('INSUFFICIENT_GP');
    }
    
    // 9. 광물 차감
    const recipe = st.recipe_minerals || {};
    const mineralEntries = Object.entries(recipe);

    // 재고 확인 (resource_id FK 기반 — resources 테이블 조인)
    if (mineralEntries.length > 0) {
      const mineralCodes = mineralEntries.map(([code]) => code);
      const { rows: invRows } = await client.query(`
        SELECT r.code AS resource_code,
               r.id AS resource_id,
               COALESCE((
                 SELECT uri.quantity
                 FROM user_resource_inventory uri
                 WHERE uri.resource_id = r.id AND LOWER(uri.wallet_address) = LOWER($1)
               ), 0) AS quantity
        FROM resources r
        WHERE r.code = ANY($2::text[])
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
        const spent = await client.query(`
          UPDATE user_resource_inventory
          SET quantity = quantity - $1
          WHERE LOWER(wallet_address) = LOWER($2) AND resource_id = $3 AND quantity >= $1
          RETURNING quantity
        `, [need, walletAddress, resourceId]);
        if (spent.rowCount === 0) {
          const err = new Error('INSUFFICIENT_MINERALS');
          err.meta = { missing: [{ code, need, have: 0 }] };
          throw err;
        }
      }
    }
    
    // 10. fleet_id 확인 (주어졌으면 소유권 확인)
    if (fleetId) {
      const { rows: fleetRows } = await client.query(
        `SELECT id FROM fleets WHERE id = $1 AND LOWER(owner_wallet) = LOWER($2)`,
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

    // [코어행동 XP] 함선 건조 착수 시 XP — 진행감을 건조 행동과 연결
    try { const { awardXP } = require('../db'); const buildXp = parseInt(await getSetting('ship_build_xp', '10')) || 10; if (buildXp > 0) await awardXP(client, walletAddress, buildXp); } catch (_) {}

    await client.query('COMMIT');

    // ── GP 활동 로그 + 시즌 점수 (fire-and-forget, COMMIT 후) ──
    if (gpCost > 0) {
      logFleetGpActivity(walletAddress, 'ship_build_gp_spent', -gpCost, {
        ship_type: shipTypeCode,
        job_id: job.id,
      });
    }
    if (gpCost > 0) {
      try {
        const { logGPActivity } = require('../db');
        logGPActivity(walletAddress, -gpCost, 'ship_build', `함선 건조: ${shipTypeCode}`).catch(()=>{});
      } catch (_) {}
    }
    try { const _dOps = require('../routes/dailyOps'); _dOps.notifyMissionProgress(walletAddress, 'build_ship').catch(()=>{}); } catch(_) {}
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
    if (!st) throw new Error('INVALID_SHIP_TYPE');

    const claimed = await client.query(`
      UPDATE ship_build_jobs
      SET status = 'completed', completed_at = NOW()
      WHERE id = $1 AND status = 'building'
      RETURNING *
    `, [jobId]);
    if (!claimed.rows[0]) {
      await client.query('ROLLBACK');
      return { already_completed: true, job };
    }
    
    // fleet_id 결정: 지정된 함대 없으면 기본 함대 사용/생성
    let fleetId = job.fleet_id;
    if (!fleetId) {
      fleetId = await getOrCreateDefaultFleet(client, job.wallet_address);
    } else {
      // 지정된 함대가 아직 존재하는지 확인
      const { rows: flRows } = await client.query(
        `SELECT id FROM fleets WHERE id = $1 AND LOWER(owner_wallet) = LOWER($2) FOR UPDATE`,
        [fleetId, job.wallet_address]
      );
      if (!flRows[0]) {
        fleetId = await getOrCreateDefaultFleet(client, job.wallet_address);
      }
    }

    await client.query(
      `SELECT id FROM fleets WHERE id = $1 AND LOWER(owner_wallet) = LOWER($2) FOR UPDATE`,
      [fleetId, job.wallet_address]
    );
    
    // 기함 여부: 함대에 기함이 없으면 이 함선을 기함으로
    const { rows: flagRows } = await client.query(
      `SELECT id FROM ships 
       WHERE fleet_id = $1 AND is_flagship = true AND is_alive = true
       FOR UPDATE`,
      [fleetId]
    );
    const isFlagship = flagRows.length === 0 && st.is_flagship_capable;
    
    // 함선 생성 (트리거가 Titan/유저 한도 체크)
    let shipRows;
    try {
      ({ rows: shipRows } = await client.query(`
        INSERT INTO ships (
          fleet_id, ship_type_code, owner_wallet,
          current_hp, max_hp, is_flagship, is_alive,
          built_at, built_by_wallet
        ) VALUES ($1, $2, $3, $4, $4, $5, true, NOW(), $3)
        RETURNING id
      `, [fleetId, job.ship_type_code, job.wallet_address, st.base_hp, isFlagship]));
    } catch (insErr) {
      // 함선 생성 실패: Titan 서버 한도 / 유저 함선 한도 등 영구 조건 트리거.
      // startBuild 시점에 GP/광물을 이미 차감했으므로, 현재 abort된 트랜잭션을
      // ROLLBACK 한 뒤 별도 트랜잭션에서 전액 환불하고 작업을 'refunded'로 닫는다.
      // (그대로 throw 하면 작업이 'building'으로 되돌아가 스케줄러가 영구 재시도 →
      //  GP 영구 잠김.)
      try { await client.query('ROLLBACK'); } catch {}
      const refundRes = await refundFailedBuildJob(client, job, insErr);
      return {
        success: false,
        completion_failed: true,
        job_id: jobId,
        error: 'BUILD_COMPLETION_FAILED',
        reason: insErr.message,
        refund: refundRes,
      };
    }

    const shipId = shipRows[0].id;
    
    // 작업 완료 처리
    await client.query(`
      UPDATE ship_build_jobs 
      SET result_ship_id = $1
      WHERE id = $2
    `, [shipId, jobId]);
    
    await client.query('COMMIT');

    // 🔔 함선 건조 완료 알림
    try {
      const { notifyPlayer } = require('../db');
      const shipName = st ? (st.name || job.ship_type_code) : job.ship_type_code;
      notifyPlayer(job.wallet_address, 'ship_built',
        `🚀 ${shipName} 건조 완료! 함대에 배치 가능합니다.`,
        { shipId, shipTypeCode: job.ship_type_code, fleetId, isFlagship }
      ).catch(() => {});
    } catch (_ne) {}

    // 🏆 Achievement: ship_count
    try {
      const ach = require('./achievements');
      ach.checkAndUnlock(job.wallet_address, 'ship_count').catch(() => {});
    } catch (_ae) {}

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

// ─── 건조 완성 실패 시 전액 환불 (시스템 장애 보상) ───
//
// completeBuildJob 의 함선 INSERT 가 영구 조건(Titan 서버 한도 / 유저 함선 한도
// 트리거 등)으로 실패하면, startBuild 시점에 차감된 GP/광물이 영구 잠긴다.
// 이 함수는 별도 트랜잭션에서 GP/광물을 전액(기본 100%) 환불하고 작업을
// 'refunded' 로 닫아 스케줄러 재시도(좀비화)를 막는다.
async function refundFailedBuildJob(client, job, cause) {
  try {
    await client.query('BEGIN');

    // 작업 재락 — 여전히 building 인 경우에만 환불(동시 취소/완료 방어)
    const { rows: lockRows } = await client.query(
      `SELECT * FROM ship_build_jobs WHERE id = $1 FOR UPDATE`,
      [job.id]
    );
    const cur = lockRows[0];
    if (!cur || cur.status !== 'building') {
      await client.query('ROLLBACK');
      return { refunded: false, reason: 'NOT_BUILDING' };
    }

    const refundPct = await getSettingInt(client, 'ship_build_fail_refund_pct', 100);

    // GP 환불
    const refundedGp = Math.floor((cur.gp_cost || 0) * refundPct / 100);
    if (refundedGp > 0) {
      await client.query(
        `UPDATE users SET gp_balance = gp_balance + $1 WHERE LOWER(wallet_address) = LOWER($2)`,
        [refundedGp, cur.wallet_address]
      );
    }

    // 광물 환불 (resource_id FK 기반 UPSERT)
    const minerals = cur.minerals_used || {};
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
        `, [cur.wallet_address, refundQty, code]);
      }
    }

    // 작업 'refunded' 처리 — 스케줄러 재시도 중단
    await client.query(`
      UPDATE ship_build_jobs
      SET status = 'refunded', completed_at = NOW()
      WHERE id = $1
    `, [cur.id]);

    // 로그
    try {
      await client.query(`
        INSERT INTO ship_build_log (wallet_address, ship_type_code, gp_cost, minerals_used, result)
        VALUES ($1, $2, $3, $4, 'refunded')
      `, [cur.wallet_address, cur.ship_type_code, -refundedGp, JSON.stringify(refundedMinerals)]);
    } catch (_le) {}

    await client.query('COMMIT');

    // ── fire-and-forget 로그/알림 ──
    if (refundedGp > 0) {
      logFleetGpActivity(cur.wallet_address, 'ship_build_fail_refund', refundedGp, {
        job_id: cur.id,
        refund_pct: refundPct,
        reason: (cause && cause.message) ? cause.message : 'build_completion_failed',
      });
      try {
        const { logGPActivity } = require('../db');
        logGPActivity(cur.wallet_address, refundedGp, 'ship_build_fail_refund',
          `건조 완성 실패 전액 환불 (${refundPct}%)`).catch(() => {});
      } catch (_) {}
    }
    try {
      const { notifyPlayer } = require('../db');
      notifyPlayer(cur.wallet_address, 'ship_build_refund',
        `⚠️ 함선 건조가 완료되지 못해 자원을 전액 환불했습니다 (${refundedGp} GP).`,
        { jobId: cur.id, shipTypeCode: cur.ship_type_code, refundedGp }
      ).catch(() => {});
    } catch (_ne) {}

    return { refunded: true, refunded_gp: refundedGp, refunded_minerals: refundedMinerals, refund_pct: refundPct };
  } catch (refundErr) {
    try { await client.query('ROLLBACK'); } catch {}
    console.error(`[ship] refundFailedBuildJob ${job && job.id} failed:`, refundErr.message);
    return { refunded: false, error: refundErr.message };
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
       WHERE id = $1 AND LOWER(wallet_address) = LOWER($2) FOR UPDATE`,
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
        `UPDATE users SET gp_balance = gp_balance + $1 WHERE LOWER(wallet_address) = LOWER($2)`,
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
    
    await client.query('COMMIT');

    // ── GP 활동 로그 (환불, fire-and-forget) ──
    if (refundedGp > 0) {
      logFleetGpActivity(walletAddress, 'ship_build_refund', refundedGp, {
        job_id: jobId,
        refund_pct: refundPct,
        cancelled: true,
      });
    }
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
    `SELECT id FROM fleets WHERE LOWER(owner_wallet) = LOWER($1) ORDER BY id ASC LIMIT 1 FOR UPDATE`,
    [walletAddress]
  );
  if (existing[0]) return existing[0].id;
  
  // 없으면 기본 함대 생성
  const { rows: nick } = await client.query(
    `SELECT nickname FROM users WHERE LOWER(wallet_address) = LOWER($1)`,
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
      COALESCE(u.gp_balance, 0) AS gp_balance,
      COUNT(DISTINCT f.id) AS fleet_count,
      COUNT(s.id) FILTER (WHERE s.is_alive) AS ships_alive,
      COUNT(s.id) FILTER (WHERE s.is_alive AND st.is_capital) AS capital_ships,
      COALESCE(SUM(s.current_hp) FILTER (WHERE s.is_alive), 0) AS total_hp,
      (SELECT COUNT(*) FROM ship_build_jobs 
       WHERE LOWER(wallet_address) = LOWER($1) AND status = 'building') AS jobs_in_progress
    FROM users u
    LEFT JOIN fleets f ON LOWER(f.owner_wallet) = LOWER(u.wallet_address)
    LEFT JOIN ships s ON s.fleet_id = f.id
    LEFT JOIN ship_types st ON st.code = s.ship_type_code
    WHERE LOWER(u.wallet_address) = LOWER($1)
    GROUP BY u.gp_balance
  `, [walletAddress]);
  
  return rows[0] || { 
    gp_balance: 0,
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
  const walletLower = String(walletAddress || '').toLowerCase();
  const targetPct = Number(targetHpPct);
  if (!Number.isFinite(targetPct) || targetPct <= 0) {
    const err = new Error('INVALID_TARGET_HP_PCT');
    err.meta = { targetHpPct };
    throw err;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. 함선 조회 (소유권 + 생존 확인 + build_gp_cost)
    const { rows: shipRows } = await client.query(`
      SELECT s.id, s.fleet_id, s.current_hp, s.max_hp, s.bonus_hp,
             COALESCE(s.is_market_listed, false) AS is_market_listed,
             st.name_ko, st.build_gp_cost
      FROM ships s
      JOIN ship_types st ON st.code = s.ship_type_code
      WHERE s.id = $1 AND LOWER(s.owner_wallet) = LOWER($2) AND s.is_alive = true
      FOR UPDATE OF s
    `, [shipId, walletLower]);

    if (!shipRows[0]) {
      const err = new Error('SHIP_NOT_FOUND');
      throw err;
    }
    const ship = shipRows[0];
    if (ship.is_market_listed) throw new Error('SHIP_LISTED_FOR_SALE');
    // (격침회피/조작 차단 v7.374) 전투(preparing/active) 중인 함대의 함선은 수리 불가 —
    // 전투 직전/도중 HP를 채워 full-loss 손실을 줄이는 조작 방지.
    await assertShipNotInBattle(client, ship.fleet_id);

    // 2. 이미 풀체력이면 에러
    const effectiveMax = parseInt(ship.max_hp) + parseInt(ship.bonus_hp || 0);
    if (parseInt(ship.current_hp) >= effectiveMax) {
      const err = new Error('ALREADY_FULL');
      err.meta = { current_hp: ship.current_hp, max_hp: effectiveMax };
      throw err;
    }

    // 3. 목표 HP 계산
    const repairMaxPct = parseInt(await getSetting('ship_repair_max_pct', '100')) || 100;
    const clampedPct = Math.min(targetPct, repairMaxPct);
    const targetHp = Math.min(Math.floor(effectiveMax * clampedPct / 100), effectiveMax);
    const healAmount = targetHp - parseInt(ship.current_hp);

    if (healAmount <= 0) {
      const err = new Error('ALREADY_FULL');
      err.meta = { current_hp: ship.current_hp, target_hp: targetHp };
      throw err;
    }

    // 4. 비용 계산 + 신조 대비 경제성 캡 (Migration 173)
    const gpPerHpRaw = Number(await getSetting('ship_repair_gp_per_hp', '2'));
    const ironPer10hpRaw = Number(await getSetting('ship_repair_iron_per_10hp', '1'));
    const gpPerHp = Number.isFinite(gpPerHpRaw) && gpPerHpRaw > 0 ? gpPerHpRaw : 2;
    const ironPer10hp = Number.isFinite(ironPer10hpRaw) && ironPer10hpRaw >= 0 ? ironPer10hpRaw : 1;
    const capPct      = parseInt(await getSetting('ship_repair_cost_cap_pct_of_build', '60')) || 60;

    let gpCost   = Math.ceil(healAmount * gpPerHp);
    const ironNeed = Math.ceil((healAmount / 10) * ironPer10hp);

    // 신조 비용 대비 수리비 캡: 항상 신조보다 싸야 유의미
    const buildCost = parseInt(ship.build_gp_cost) || 0;
    if (buildCost > 0 && capPct > 0) {
      const maxRepairGp = Math.floor(buildCost * capPct / 100);
      if (gpCost > maxRepairGp) gpCost = maxRepairGp;
    }

    // 5. GP 확인
    const { rows: userRows } = await client.query(
      `SELECT gp_balance FROM users WHERE LOWER(wallet_address) = LOWER($1) FOR UPDATE`,
      [walletLower]
    );
    if (!userRows[0]) throw new Error('USER_NOT_FOUND');
    if (parseInt(userRows[0].gp_balance) < gpCost) {
      const err = new Error('INSUFFICIENT_GP');
      err.meta = { required: gpCost, balance: userRows[0].gp_balance };
      throw err;
    }

    // 6. iron_ore 재고 확인 (resource_id FK 기반)
    const { rows: invRows } = await client.query(`
      SELECT r.id AS resource_id,
             COALESCE((
               SELECT uri.quantity
               FROM user_resource_inventory uri
               WHERE uri.resource_id = r.id AND LOWER(uri.wallet_address) = LOWER($1)
             ), 0) AS quantity
      FROM resources r
      WHERE r.code = 'iron_ore'
    `, [walletLower]);

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
    const deductRepair = await client.query(
      `UPDATE users SET gp_balance = gp_balance - $1 WHERE LOWER(wallet_address) = LOWER($2) AND gp_balance >= $1`,
      [gpCost, walletLower]
    );
    if (deductRepair.rowCount === 0) throw new Error('INSUFFICIENT_GP');

    // 8. iron_ore 차감
    const spentIron = await client.query(`
      UPDATE user_resource_inventory
      SET quantity = quantity - $1, updated_at = NOW()
      WHERE LOWER(wallet_address) = LOWER($2) AND resource_id = $3 AND quantity >= $1
      RETURNING quantity
    `, [ironNeed, walletLower, ironInv.resource_id]);
    if (spentIron.rowCount === 0) {
      const err = new Error('INSUFFICIENT_IRON');
      err.meta = { required: ironNeed, have: 0 };
      throw err;
    }

    // 9. 함선 HP 업데이트
    await client.query(
      `UPDATE ships SET current_hp = $1 WHERE id = $2`,
      [targetHp, shipId]
    );

    await client.query('COMMIT');

    // 10. GP 활동 로그 (fire-and-forget)
    try {
      const { logGPActivity } = require('../db');
      logGPActivity(walletLower, -gpCost, 'ship_repair',
        `함선 수리 (ID:${shipId}) +${healAmount}HP`).catch(() => {});
    } catch (_) {}
    try { const _dOps = require('../routes/dailyOps'); _dOps.notifyMissionProgress(walletLower, 'repair_ship').catch(()=>{}); _dOps.notifyMissionProgress(walletLower, 'repair_ship_3').catch(()=>{}); } catch(_) {}

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
  const walletLower = String(walletAddress || '').toLowerCase();
  const chargeUnits = Number(units);

  if (!Number.isFinite(chargeUnits) || chargeUnits <= 0) {
    const err = new Error('INVALID_UNITS');
    err.meta = { units };
    throw err;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. 함선 조회
    const { rows: shipRows } = await client.query(`
      SELECT s.id, s.fleet_id, s.max_hp, s.bonus_hp, s.shield_hp, s.shield_max,
             COALESCE(s.is_market_listed, false) AS is_market_listed
      FROM ships s
      WHERE s.id = $1 AND LOWER(s.owner_wallet) = LOWER($2) AND s.is_alive = true
      FOR UPDATE OF s
    `, [shipId, walletLower]);

    if (!shipRows[0]) throw new Error('SHIP_NOT_FOUND');
    const ship = shipRows[0];
    if (ship.is_market_listed) throw new Error('SHIP_LISTED_FOR_SALE');
    // (조작 차단 v7.374) 전투(preparing/active) 중인 함대의 함선엔 실드 충전 불가.
    await assertShipNotInBattle(client, ship.fleet_id);

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
    // Clamp requested units to available capacity instead of rejecting the entire call
    const actualUnits = chargeUnits > canAdd ? canAdd : chargeUnits;

    // 3. GP 비용 계산
    const gpPerUnitRaw = Number(await getSetting('shield_gp_per_unit', '3'));
    const gpPerUnit = Number.isFinite(gpPerUnitRaw) && gpPerUnitRaw > 0 ? gpPerUnitRaw : 3;
    const gpCost    = Math.ceil(actualUnits * gpPerUnit);

    // 4. GP 확인
    const { rows: userRows } = await client.query(
      `SELECT gp_balance FROM users WHERE LOWER(wallet_address) = LOWER($1) FOR UPDATE`,
      [walletLower]
    );
    if (!userRows[0]) throw new Error('USER_NOT_FOUND');
    if (parseInt(userRows[0].gp_balance) < gpCost) {
      const err = new Error('INSUFFICIENT_GP');
      err.meta = { required: gpCost, balance: userRows[0].gp_balance };
      throw err;
    }

    // 5. GP 차감
    const deductShield = await client.query(
      `UPDATE users SET gp_balance = gp_balance - $1 WHERE LOWER(wallet_address) = LOWER($2) AND gp_balance >= $1`,
      [gpCost, walletLower]
    );
    if (deductShield.rowCount === 0) throw new Error('INSUFFICIENT_GP');

    // 6. 실드 업데이트
    const newShield = currentShield + actualUnits;
    await client.query(
      `UPDATE ships SET shield_hp = $1, shield_max = $2 WHERE id = $3`,
      [newShield, shieldMax, shipId]
    );

    await client.query('COMMIT');

    // GP 활동 로그 (fire-and-forget)
    try {
      const { logGPActivity } = require('../db');
      logGPActivity(walletLower, -gpCost, 'ship_shield',
        `실드 충전 (ID:${shipId}) +${actualUnits}`).catch(() => {});
    } catch (_) {}

    return {
      success:       true,
      shield_added:  actualUnits,
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

// ─── 함선 영구 스탯 강화 ───

const SHIP_UPGRADE_STATS = {
  atk:   { column: 'bonus_atk',   setting: 'ship_upgrade_atk_step',   fallback: 1,    multiplier: 1.00, label: 'ATK' },
  def:   { column: 'bonus_def',   setting: 'ship_upgrade_def_step',   fallback: 1,    multiplier: 1.00, label: 'DEF' },
  hp:    { column: 'bonus_hp',    setting: 'ship_upgrade_hp_step',    fallback: 200,  multiplier: 1.20, label: 'HP' },
  speed: { column: 'bonus_speed', setting: 'ship_upgrade_speed_step', fallback: 0.05, multiplier: 1.45, label: 'SPD' },
};

function toNum(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function upgradePoints(ship, steps) {
  const atk = Math.max(0, Math.floor(toNum(ship.bonus_atk) / Math.max(1, steps.atk)));
  const def = Math.max(0, Math.floor(toNum(ship.bonus_def) / Math.max(1, steps.def)));
  const hp = Math.max(0, Math.floor(toNum(ship.bonus_hp) / Math.max(1, steps.hp)));
  const speedStep = Math.max(0.01, steps.speed);
  const speed = Math.max(0, Math.floor(toNum(ship.bonus_speed) / speedStep));
  return atk + def + hp + speed;
}

async function getShipUpgradeSteps(client) {
  return {
    atk: await getSettingNumber(client, 'ship_upgrade_atk_step', 1),
    def: await getSettingNumber(client, 'ship_upgrade_def_step', 1),
    hp: await getSettingNumber(client, 'ship_upgrade_hp_step', 200),
    speed: await getSettingNumber(client, 'ship_upgrade_speed_step', 0.05),
  };
}

async function getShipUpgradeEconomy(client) {
  return {
    base: await getSettingNumber(client, 'ship_upgrade_base_gp', 25),
    growth: await getSettingNumber(client, 'ship_upgrade_growth', 1.14),
    steps: await getShipUpgradeSteps(client),
  };
}

function calcShipUpgradeCost(ship, stat, economy) {
  const cfg = SHIP_UPGRADE_STATS[stat];
  if (!cfg) throw new Error('INVALID_STAT');
  const points = Math.min(180, upgradePoints(ship, economy.steps));
  return Math.max(1, Math.ceil(economy.base * Math.pow(economy.growth, points) * cfg.multiplier));
}

async function getShipUpgradeCost(client, ship, stat) {
  return calcShipUpgradeCost(ship, stat, await getShipUpgradeEconomy(client));
}

function addShipUpgradeView(ship) {
  const bonusAtk = toNum(ship.bonus_atk);
  const bonusDef = toNum(ship.bonus_def);
  const bonusHp = toNum(ship.bonus_hp);
  const bonusSpeed = toNum(ship.bonus_speed);
  return {
    ...ship,
    bonus_atk: bonusAtk,
    bonus_def: bonusDef,
    bonus_hp: bonusHp,
    bonus_speed: bonusSpeed,
    effective_atk: toNum(ship.base_atk) + bonusAtk,
    effective_def: toNum(ship.base_def) + bonusDef,
    effective_speed: +(toNum(ship.base_speed) + bonusSpeed).toFixed(2),
    effective_max_hp: toNum(ship.max_hp) + bonusHp,
  };
}

function makeShipSnapshot(ship) {
  const view = addShipUpgradeView(ship);
  return {
    ship_id: ship.id,
    ship_type_code: ship.ship_type_code,
    name_ko: ship.name_ko,
    class_label: ship.class_label,
    size_class: ship.size_class,
    role: ship.role,
    faction_code: ship.faction_code,
    upgrade_level: toNum(ship.upgrade_level),
    base_atk: toNum(ship.base_atk),
    base_def: toNum(ship.base_def),
    base_speed: toNum(ship.base_speed),
    max_hp: toNum(ship.max_hp),
    bonus_atk: view.bonus_atk,
    bonus_def: view.bonus_def,
    bonus_hp: view.bonus_hp,
    bonus_speed: view.bonus_speed,
    effective_atk: view.effective_atk,
    effective_def: view.effective_def,
    effective_speed: view.effective_speed,
    effective_max_hp: view.effective_max_hp,
    kills_dealt: toNum(ship.kills_dealt),
    damage_dealt: toNum(ship.damage_dealt),
  };
}

// ── 강화 재료 티어 테이블 ──────────────────────────────────────
// upgrade_level 0-4  (강화 1~5회)  → T1 광물
// upgrade_level 5-9  (강화 6~10회) → T2 광물
// upgrade_level 10+  (강화 11회~)  → T3 광물
// 함선 가치는 높은 레벨일수록 희귀 재료가 누적됨
const UPGRADE_MATERIAL_TIERS = {
  atk:   ['carbon_fiber',    'plasma_crystal',      'exotic_alloy'],
  def:   ['iron_ore',        'titanium_alloy',       'hull_plate'],
  hp:    ['silicon_chip',    'meteorite_fragment',   'alloy_frame'],
  speed: ['basalt_chip',     'nano_polymer',         'dark_matter'],
};
// 각 티어의 기본 소모량 (강화 레벨이 높을수록 tier 내에서도 증가)
const UPGRADE_MATERIAL_BASE_QTY  = [2, 2, 1];   // T1, T2, T3 기본
const UPGRADE_MATERIAL_GROWTH    = [1, 1, 1];   // 5회 강화마다 +N

function getUpgradeMaterialTier(upgradeLevel) {
  const lv = Math.max(0, parseInt(upgradeLevel) || 0);
  if (lv < 5)  return 0;  // T1
  if (lv < 10) return 1;  // T2
  return 2;               // T3
}

async function calcShipUpgradeOffer(client, ship, stat) {
  const economy = await getShipUpgradeEconomy(client);
  const totalPoints = upgradePoints(ship, economy.steps);
  const baseChance = await getSettingNumber(client, 'ship_upgrade_success_base_pct', 92);
  const decay = await getSettingNumber(client, 'ship_upgrade_success_decay_pct', 1.8);
  const floor = await getSettingNumber(client, 'ship_upgrade_success_floor_pct', 35);
  const chance = Math.max(floor, Math.min(99, +(baseChance - totalPoints * decay).toFixed(2)));

  // 티어 계산 — upgrade_level 기준
  const tierIdx = getUpgradeMaterialTier(ship.upgrade_level);
  const tierMaterials = UPGRADE_MATERIAL_TIERS[stat] || UPGRADE_MATERIAL_TIERS.atk;
  const materialCode = tierMaterials[tierIdx];

  // 수량: 기본 + (티어 내 5회마다 +1)
  const baseQty    = UPGRADE_MATERIAL_BASE_QTY[tierIdx];
  const growthUnit = UPGRADE_MATERIAL_GROWTH[tierIdx];
  const lv = Math.max(0, parseInt(ship.upgrade_level) || 0);
  const tierOffset = tierIdx === 0 ? lv : tierIdx === 1 ? lv - 5 : lv - 10;
  const materialQty = Math.max(1, baseQty + Math.floor(Math.max(0, tierOffset) / 5) * growthUnit);

  return {
    cost: calcShipUpgradeCost(ship, stat, economy),
    chance,
    material_code: materialCode,
    material_qty: materialQty,
    material_tier: tierIdx + 1,  // 1/2/3 — UI 표시용
    upgrade_level: lv,
    economy,
  };
}

async function consumeShipUpgradeMaterial(client, walletAddress, materialCode, quantity) {
  const { rows } = await client.query(`
    SELECT r.id AS resource_id, r.code,
           COALESCE(uri.quantity, 0) AS quantity
    FROM resources r
    LEFT JOIN user_resource_inventory uri
      ON uri.resource_id = r.id AND LOWER(uri.wallet_address) = LOWER($1)
    WHERE r.code = $2
    LIMIT 1
  `, [walletAddress, materialCode]);
  if (!rows[0] || parseInt(rows[0].quantity) < quantity) {
    const err = new Error('INSUFFICIENT_MATERIALS');
    err.meta = { code: materialCode, required: quantity, have: rows[0] ? parseInt(rows[0].quantity) : 0 };
    throw err;
  }
  const spent = await client.query(`
    UPDATE user_resource_inventory
    SET quantity = quantity - $1, updated_at = NOW()
    WHERE LOWER(wallet_address) = LOWER($2) AND resource_id = $3 AND quantity >= $1
  `, [quantity, walletAddress, rows[0].resource_id]);
  if (spent.rowCount === 0) {
    const err = new Error('INSUFFICIENT_MATERIALS');
    err.meta = { code: materialCode, required: quantity, have: 0 };
    throw err;
  }
}

async function upgradeShipStat(walletAddress, shipId, stat) {
  stat = String(stat || '').toLowerCase();
  const cfg = SHIP_UPGRADE_STATS[stat];
  if (!cfg) throw new Error('INVALID_STAT');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: shipRows } = await client.query(`
      SELECT s.id, s.owner_wallet, s.fleet_id, s.ship_type_code, s.current_hp, s.max_hp,
             COALESCE(s.is_market_listed, false) AS is_market_listed,
             s.upgrade_level, s.bonus_atk, s.bonus_def, s.bonus_hp,
             COALESCE(s.bonus_speed, 0) AS bonus_speed,
             st.name_ko, st.class_label, st.size_class, st.role, st.render_radius,
             st.base_atk, st.base_def, st.base_speed
      FROM ships s
      JOIN ship_types st ON st.code = s.ship_type_code
      WHERE s.id = $1 AND LOWER(s.owner_wallet) = LOWER($2) AND s.is_alive = true
      FOR UPDATE OF s
    `, [shipId, walletAddress]);
    if (!shipRows[0]) throw new Error('SHIP_NOT_FOUND');
    const ship = shipRows[0];
    if (ship.is_market_listed) throw new Error('SHIP_LISTED_FOR_SALE');

    // (v7.374) 전투(preparing/active) 중 강화 차단 — 공유 헬퍼 사용(유령 'pending'→실제
    // 'preparing'/'active' + SAVEPOINT 격리). 전투 직전 스탯 강화로 결과를 흔드는 조작 방지.
    await assertShipNotInBattle(client, ship.fleet_id);

    const { rows: userRows } = await client.query(
      `SELECT gp_balance FROM users WHERE LOWER(wallet_address) = LOWER($1) FOR UPDATE`,
      [walletAddress]
    );
    if (!userRows[0]) throw new Error('USER_NOT_FOUND');

    const offer = await calcShipUpgradeOffer(client, ship, stat);
    const economy = offer.economy;
    const delta = economy.steps[stat] || cfg.fallback;
    const cost = offer.cost;

    // ✅ [주간 이벤트] 금요일 강화 비용 -20%
    let finalGpCost = cost;
    try {
      if (new Date().getUTCDay() === 5) { // FRI
        finalGpCost = Math.floor(cost * 0.8);
      }
    } catch (_) {}

    if (parseInt(userRows[0].gp_balance) < finalGpCost) {
      const err = new Error('INSUFFICIENT_GP');
      err.meta = { required: finalGpCost, balance: userRows[0].gp_balance };
      throw err;
    }

    const fromBonus = toNum(ship[cfg.column]);
    const toBonus = +(fromBonus + delta).toFixed(stat === 'speed' ? 2 : 0);
    const materialsUsed = { [offer.material_code]: offer.material_qty };
    await consumeShipUpgradeMaterial(client, walletAddress, offer.material_code, offer.material_qty);

    const deductUpgradeStat = await client.query(
      `UPDATE users SET gp_balance = gp_balance - $1 WHERE LOWER(wallet_address) = LOWER($2) AND gp_balance >= $1`,
      [finalGpCost, walletAddress]
    );
    if (deductUpgradeStat.rowCount === 0) throw new Error('INSUFFICIENT_GP');

    const roll = +(Math.random() * 100).toFixed(2);
    const success = roll <= offer.chance;
    let updatedShip = { ...ship };
    if (success) {
      const hpCurrentDelta = stat === 'hp' ? Math.round(delta) : 0;
      const { rows: updatedRows } = await client.query(`
        UPDATE ships
        SET ${cfg.column} = $1,
            current_hp = current_hp + $2,
            upgrade_level = COALESCE(upgrade_level, 0) + 1
        WHERE id = $3
        RETURNING *
      `, [toBonus, hpCurrentDelta, shipId]);
      updatedShip = updatedRows[0];
    }

    await client.query(`
      INSERT INTO ship_stat_upgrade_log
        (ship_id, wallet_address, stat, from_bonus, to_bonus, gp_cost,
         success, success_chance, roll, materials_used)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb)
    `, [
      shipId,
      walletAddress,
      stat,
      fromBonus,
      success ? toBonus : fromBonus,
      finalGpCost,
      success,
      offer.chance,
      roll,
      JSON.stringify(materialsUsed),
    ]);

    await client.query('COMMIT');

    try {
      const { logGPActivity } = require('../db');
      logGPActivity(walletAddress, -finalGpCost, 'ship_stat_upgrade',
        `함선 ${cfg.label} 강화 (ID:${shipId}) +${delta}`).catch(() => {});
    } catch (_) {}
    try { const _dOps = require('../routes/dailyOps'); _dOps.notifyMissionProgress(walletAddress, 'upgrade_ship').catch(()=>{}); _dOps.notifyMissionProgress(walletAddress, 'upgrade_ship_3').catch(()=>{}); _dOps.notifyMissionProgress(walletAddress, 'upgrade_ship_5').catch(()=>{}); } catch(_) {}
    logFleetGpActivity(walletAddress, 'ship_stat_upgrade', -finalGpCost, {
      ship_id: shipId,
      stat,
      from_bonus: fromBonus,
      to_bonus: success ? toBonus : fromBonus,
      success,
      chance: offer.chance,
      materials_used: materialsUsed,
    });

    const nextOffer = await calcShipUpgradeOffer(pool, updatedShip, stat);
    return {
      success: true,
      upgraded: success,
      ship_id: shipId,
      stat,
      delta: success ? delta : 0,
      gp_cost: finalGpCost,
      base_gp_cost: cost,
      chance: offer.chance,
      roll,
      materials_used: materialsUsed,
      next_cost: nextOffer.cost,
      next_chance: nextOffer.chance,
      ship: addShipUpgradeView({ ...ship, ...updatedShip }),
    };
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch (_) {}
    throw err;
  } finally {
    client.release();
  }
}

async function getShipMarketListings(walletAddress, options = {}) {
  const wallet = (walletAddress || '').toLowerCase();
  const params = [];
  let query = `
    SELECT
      sml.id AS listing_id, sml.ship_id, sml.seller_wallet, sml.price_gp,
      sml.fee_gp, sml.status, sml.snapshot, sml.listed_at,
      s.fleet_id, s.ship_type_code, s.current_hp, s.max_hp, s.is_flagship, s.is_alive,
      COALESCE(s.is_market_listed, false) AS is_market_listed,
      s.shield_hp, s.shield_max, s.upgrade_level,
      s.bonus_atk, s.bonus_def, s.bonus_hp, COALESCE(s.bonus_speed, 0) AS bonus_speed,
      s.kills_dealt, s.damage_dealt, s.built_at,
      st.name_ko, st.class_label, st.size_class, st.role, st.render_radius,
      st.base_atk, st.base_def, st.base_speed,
      f.code AS faction_code, f.name_ko AS faction_name, f.color_primary AS faction_color,
      u.nickname AS seller_name
    FROM ship_market_listings sml
    JOIN ships s ON s.id = sml.ship_id
    JOIN ship_types st ON st.code = s.ship_type_code
    LEFT JOIN factions f ON f.code = st.faction_code
    LEFT JOIN users u ON LOWER(u.wallet_address) = LOWER(sml.seller_wallet)
    WHERE sml.status = 'active' AND s.is_alive = true
  `;
  if (options.faction) {
    params.push(options.faction);
    query += ` AND st.faction_code = $${params.length}`;
  }
  if (options.size) {
    params.push(options.size);
    query += ` AND st.size_class = $${params.length}`;
  }
  if (options.maxPrice) {
    const maxPrice = Number(options.maxPrice);
    if (!Number.isFinite(maxPrice)) throw new Error('INVALID_MAX_PRICE');
    params.push(maxPrice);
    query += ` AND sml.price_gp <= $${params.length}`;
  }
  const sort = String(options.sort || 'listed').toLowerCase();
  if (sort === 'price_asc') query += ` ORDER BY sml.price_gp ASC, sml.listed_at DESC`;
  else if (sort === 'price_desc') query += ` ORDER BY sml.price_gp DESC, sml.listed_at DESC`;
  else query += ` ORDER BY sml.listed_at DESC`;
  query += ` LIMIT 120`;

  const { rows } = await pool.query(query, params);
  return rows.map(row => ({
    ...addShipUpgradeView(row),
    is_mine: wallet && String(row.seller_wallet || '').toLowerCase() === wallet,
    price_gp: Number(row.price_gp || 0),
    seller_short: String(row.seller_wallet || '').replace(/^(.{6}).+(.{4})$/, '$1...$2'),
  }));
}

async function ensureFleetHasFlagship(client, fleetId) {
  if (!fleetId) return;
  const { rows: existing } = await client.query(
    `SELECT id FROM ships WHERE fleet_id = $1 AND is_flagship = true AND is_alive = true FOR UPDATE`,
    [fleetId]
  );
  if (existing.length) return;
  const { rows: candidate } = await client.query(`
    SELECT s.id
    FROM ships s
    JOIN ship_types st ON st.code = s.ship_type_code
    WHERE s.fleet_id = $1 AND s.is_alive = true
      AND COALESCE(s.is_market_listed, false) = false
      AND st.is_flagship_capable = true
    ORDER BY st.sort_order DESC, s.id ASC
    LIMIT 1
    FOR UPDATE OF s
  `, [fleetId]);
  if (candidate[0]) {
    await client.query(`UPDATE ships SET is_flagship = true WHERE id = $1`, [candidate[0].id]);
  }
}

async function getShipForMarketLock(client, walletAddress, shipId) {
  const { rows } = await client.query(`
    SELECT s.*, st.name_ko, st.class_label, st.size_class, st.role, st.render_radius,
           st.base_atk, st.base_def, st.base_speed, f.code AS faction_code
    FROM ships s
    JOIN ship_types st ON st.code = s.ship_type_code
    LEFT JOIN factions f ON f.code = st.faction_code
    WHERE s.id = $1 AND LOWER(s.owner_wallet) = LOWER($2) AND s.is_alive = true
    FOR UPDATE OF s
  `, [shipId, walletAddress]);
  return rows[0] || null;
}

async function assertShipNotInBattle(client, fleetId) {
  if (!fleetId) return;
  // (격침회피 차단 v7.374) 기존엔 미사용 유령상태 'pending'을 보고 실제 전투-대기 상태인
  // 'preparing'(hijack declare가 fbp 행을 만드는 10초 윈도)을 빠뜨려, 그 사이 함선을 마켓에
  // 등록(fleet_id=NULL)해 full-loss를 회피할 수 있었다. 'preparing','active' 둘 다 차단.
  // SELECT 실패가 상위 트랜잭션을 오염시키지 않도록 SAVEPOINT로 격리.
  try {
    await client.query('SAVEPOINT _shipbattlechk');
    const { rows } = await client.query(`
      SELECT 1
      FROM fleet_battle_participants fbp
      JOIN fleet_battles fb ON fb.id = fbp.battle_id
      WHERE fbp.fleet_id = $1 AND fb.status IN ('preparing', 'active')
      LIMIT 1
    `, [fleetId]);
    await client.query('RELEASE SAVEPOINT _shipbattlechk');
    if (rows.length) throw new Error('SHIP_IN_BATTLE');
  } catch (err) {
    if (err.message === 'SHIP_IN_BATTLE') throw err;
    try { await client.query('ROLLBACK TO SAVEPOINT _shipbattlechk'); } catch (_) {}
  }
}

async function listShipForSale(walletAddress, shipId, priceGp) {
  const wallet = String(walletAddress || '').toLowerCase();
  const price = Math.round(Number(priceGp) * 100) / 100;
  if (!Number.isFinite(price) || price <= 0) throw new Error('INVALID_PRICE');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const enabled = await getSettingText(client, 'ship_market_enabled', 'true');
    if (String(enabled).toLowerCase() !== 'true') throw new Error('MARKET_DISABLED');
    const minPrice = await getSettingNumber(client, 'ship_market_min_price_gp', 10);
    const maxPrice = await getSettingNumber(client, 'ship_market_max_price_gp', 10000000);
    if (price < minPrice || price > maxPrice) {
      const err = new Error('INVALID_PRICE');
      err.meta = { min: minPrice, max: maxPrice };
      throw err;
    }

    const ship = await getShipForMarketLock(client, wallet, shipId);
    if (!ship) throw new Error('SHIP_NOT_FOUND');
    if (ship.is_market_listed) throw new Error('SHIP_LISTED_FOR_SALE');
    await assertShipNotInBattle(client, ship.fleet_id);

    const snapshot = makeShipSnapshot(ship);
    await client.query(`
      UPDATE ships
      SET is_market_listed = true, fleet_id = NULL, is_flagship = false
      WHERE id = $1
    `, [shipId]);
    const { rows } = await client.query(`
      INSERT INTO ship_market_listings (ship_id, seller_wallet, price_gp, snapshot)
      VALUES ($1, $2, $3, $4::jsonb)
      RETURNING id, price_gp, listed_at
    `, [shipId, wallet, price, JSON.stringify(snapshot)]);
    await ensureFleetHasFlagship(client, ship.fleet_id);
    await client.query('COMMIT');
    try { const _dOps = require('../routes/dailyOps'); _dOps.notifyMissionProgress(wallet, 'market_list').catch(()=>{}); } catch(_) {}
    return { success: true, listing_id: rows[0].id, ship_id: shipId, price_gp: Number(rows[0].price_gp), listed_at: rows[0].listed_at };
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch (_) {}
    throw err;
  } finally {
    client.release();
  }
}

async function cancelShipListing(walletAddress, listingId) {
  const wallet = String(walletAddress || '').toLowerCase();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(`
      SELECT sml.*, s.owner_wallet, st.faction_code AS ship_faction
      FROM ship_market_listings sml
      JOIN ships s ON s.id = sml.ship_id
      JOIN ship_types st ON st.code = s.ship_type_code
      WHERE sml.id = $1 AND sml.status = 'active' AND LOWER(sml.seller_wallet) = LOWER($2)
      FOR UPDATE OF sml, s
    `, [listingId, wallet]);
    if (!rows[0]) throw new Error('LISTING_NOT_FOUND');
    const listing = rows[0];
    // Cross-faction: 판매자 진영과 함선 진영이 다르면 함대 복귀 X (fleet_id=NULL "창고" 유지). 사용 불가 상태 유지, 재등록만 가능.
    const { rows: sellerRows } = await client.query(`SELECT faction_code FROM users WHERE LOWER(wallet_address) = LOWER($1)`, [wallet]);
    const sellerFactionMatches = (sellerRows[0] && (sellerRows[0].faction_code||'').toLowerCase() === (listing.ship_faction||'').toLowerCase());
    const fleetId = sellerFactionMatches ? await getOrCreateDefaultFleet(client, wallet) : null;
    await client.query(`
      UPDATE ship_market_listings
      SET status = 'cancelled', cancelled_at = NOW()
      WHERE id = $1
    `, [listingId]);
    await client.query(`
      UPDATE ships
      SET is_market_listed = false, fleet_id = $1
      WHERE id = $2 AND LOWER(owner_wallet) = LOWER($3)
    `, [fleetId, listing.ship_id, wallet]);
    await ensureFleetHasFlagship(client, fleetId);
    await client.query('COMMIT');
    return { success: true, listing_id: listingId, ship_id: listing.ship_id };
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch (_) {}
    throw err;
  } finally {
    client.release();
  }
}

async function buyShipListing(walletAddress, listingId) {
  const buyer = String(walletAddress || '').toLowerCase();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(`
      SELECT sml.*, s.owner_wallet, s.ship_type_code, st.faction_code AS ship_faction
      FROM ship_market_listings sml
      JOIN ships s ON s.id = sml.ship_id
      JOIN ship_types st ON st.code = s.ship_type_code
      WHERE sml.id = $1 AND sml.status = 'active' AND s.is_alive = true
      FOR UPDATE OF sml, s
    `, [listingId]);
    if (!rows[0]) throw new Error('LISTING_NOT_FOUND');
    const listing = rows[0];
    const seller = String(listing.seller_wallet || '').toLowerCase();
    if (seller === buyer) throw new Error('CANNOT_BUY_OWN_LISTING');

    const { rows: buyerRows } = await client.query(
      `SELECT wallet_address, gp_balance, faction_code FROM users WHERE LOWER(wallet_address) = LOWER($1) FOR UPDATE`,
      [buyer]
    );
    if (!buyerRows[0]) throw new Error('USER_NOT_FOUND');
    const { rows: sellerRows } = await client.query(
      `SELECT wallet_address FROM users WHERE LOWER(wallet_address) = LOWER($1) FOR UPDATE`,
      [seller]
    );
    if (!sellerRows[0]) throw new Error('SELLER_NOT_FOUND');

    const price = Number(listing.price_gp || 0);
    if (Number(buyerRows[0].gp_balance || 0) < price) {
      const err = new Error('INSUFFICIENT_GP');
      err.meta = { required: price, balance: buyerRows[0].gp_balance };
      throw err;
    }
    const feePct = await getSettingNumber(client, 'ship_market_fee_pct', 5);
    // [v7.365] 소액(10~19 GP)에서 floor로 수수료 0이 되던 누수 방지 — feePct>0이면 최소 1 GP.
    const fee = Math.max(price > 0 && feePct > 0 ? 1 : 0, Math.floor(price * feePct / 100));
    const sellerReceive = price - fee;
    // Cross-faction: 구매자 진영과 함선 진영이 다르면 함대 편입 X (fleet_id=NULL "창고"). 사용 불가, 다시 마켓 판매만 가능.
    const buyerFactionMatches = (buyerRows[0].faction_code || '').toLowerCase() === (listing.ship_faction || '').toLowerCase();
    const buyerFleetId = buyerFactionMatches ? await getOrCreateDefaultFleet(client, buyer) : null;

    const deductBuyListing = await client.query(`UPDATE users SET gp_balance = gp_balance - $1 WHERE LOWER(wallet_address) = LOWER($2) AND gp_balance >= $1`, [price, buyer]);
    if (deductBuyListing.rowCount === 0) throw new Error('INSUFFICIENT_GP');
    await client.query(`UPDATE users SET gp_balance = gp_balance + $1 WHERE LOWER(wallet_address) = LOWER($2)`, [sellerReceive, seller]);
    await client.query(`
      UPDATE ships
      SET owner_wallet = $1, fleet_id = $2, is_flagship = false, is_market_listed = false
      WHERE id = $3
    `, [buyer, buyerFleetId, listing.ship_id]);
    await client.query(`
      UPDATE ship_market_listings
      SET status = 'sold', buyer_wallet = $1, fee_gp = $2, sold_at = NOW()
      WHERE id = $3
    `, [buyer, fee, listingId]);
    await client.query(`
      INSERT INTO ship_market_sale_log (listing_id, ship_id, seller_wallet, buyer_wallet, price_gp, fee_gp, snapshot)
      VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
    `, [listingId, listing.ship_id, seller, buyer, price, fee, JSON.stringify(listing.snapshot || {})]);
    await ensureFleetHasFlagship(client, buyerFleetId);
    await client.query('COMMIT');

    try {
      const { logGPActivity } = require('../db');
      logGPActivity(buyer, -price, 'ship_market_buy', `Ship listing #${listingId}`).catch(() => {});
      logGPActivity(seller, sellerReceive, 'ship_market_sell', `Ship listing #${listingId}`).catch(() => {});
    } catch (_) {}
    logFleetGpActivity(buyer, 'ship_market_buy', -price, { listing_id: listingId, ship_id: listing.ship_id });
    try { const _dOps = require('../routes/dailyOps'); _dOps.notifyMissionProgress(buyer, 'market_buy').catch(()=>{}); } catch(_) {}
    logFleetGpActivity(seller, 'ship_market_sell', sellerReceive, { listing_id: listingId, ship_id: listing.ship_id, fee_gp: fee });
    // [v7.193 F4] wash-trade 탐지 fire-and-forget — buyer/seller IP / referrer / reciprocal 점수.
    //   ≥60 점이면 suspicious_wallet_flags 자동 기록 (어드민 검수). 거래 자체는 비차단.
    try {
      const _wash = require('./washTradeDetect');
      _wash.observeTrade({ buyer, seller, assetType: 'ship', assetId: listing.ship_id, priceGp: price }).catch(()=>{});
    } catch (_) {}
    return { success: true, listing_id: listingId, ship_id: listing.ship_id, price_gp: price, fee_gp: fee };
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

async function getSettingNumber(client, key, fallback) {
  try {
    const raw = await getSetting(key, fallback);
    const val = typeof raw === 'string' ? raw.replace(/^"|"$/g, '') : raw;
    const n = Number(val);
    return Number.isFinite(n) ? n : fallback;
  } catch { return fallback; }
}

async function getSettingText(client, key, fallback) {
  try {
    const raw = await getSetting(key, fallback);
    if (raw === null || raw === undefined) return fallback;
    return String(raw).replace(/^"|"$/g, '');
  } catch { return fallback; }
}

function logFleetGpActivity(walletAddress, activityType, gpDelta, meta = {}) {
  pool.query(`
    INSERT INTO fleet_gp_activity (wallet_address, activity_type, gp_delta, meta)
    VALUES ($1, $2, $3, $4)
  `, [walletAddress, activityType, gpDelta, JSON.stringify(meta)]).catch(err => {
    console.warn('[ship] fleet_gp_activity log skipped:', err.message);
  });
}

// ── Migration 173: 함선 해체 (Core 광물 sink) ──
// 해체 시 build 광물의 X%가 환불되고, 나머지는 소각됨.
// ship_scrap_refund_pct로 admin 조정 가능. 기본 40% 환불 → 60% 소각 = Core sink.
async function scrapShip(walletAddress, shipId) {
  const { getSetting, pool: _pool } = require('../db');
  const client = await _pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: shipRows } = await client.query(`
      SELECT s.id, s.owner_wallet, s.ship_type_code, s.is_alive, s.fleet_id,
             COALESCE(s.is_market_listed, false) AS is_market_listed,
             st.name_ko, st.build_gp_cost, st.recipe_minerals
      FROM ships s
      JOIN ship_types st ON st.code = s.ship_type_code
      WHERE s.id = $1 AND LOWER(s.owner_wallet) = LOWER($2) AND s.is_alive = true
      FOR UPDATE OF s
    `, [shipId, walletAddress]);

    if (!shipRows[0]) throw new Error('SHIP_NOT_FOUND');
    const ship = shipRows[0];
    if (ship.is_market_listed) throw new Error('SHIP_LISTED_FOR_SALE');

    // 전투 중이면 해체 불가 — fleet_battle_participants엔 ship_id가 없으므로 함선의 함대(fleet_id)로 확인.
    // [v7.363] 기존 fbp.ship_id 쿼리는 미존재 컬럼이라 항상 throw → 트랜잭션 오염으로 해체/환불 깨짐(SAVEPOINT로 격리).
    try {
      await client.query('SAVEPOINT _scrapchk');
      const { rows: battleRows } = await client.query(
        `SELECT 1 FROM fleet_battle_participants fbp
         JOIN fleet_battles fb ON fb.id = fbp.battle_id
         WHERE fbp.fleet_id = $1 AND fb.status IN ('active','preparing')
         LIMIT 1`, [ship.fleet_id]
      );
      await client.query('RELEASE SAVEPOINT _scrapchk');
      if (battleRows.length) throw new Error('SHIP_IN_BATTLE');
    } catch (e) {
      if (e.message === 'SHIP_IN_BATTLE') throw e;
      try { await client.query('ROLLBACK TO SAVEPOINT _scrapchk'); } catch (_) {}
      // 스키마 차이 등 — 전투 체크만 건너뜀(해체 자체는 진행)
    }

    const refundPct = parseInt(await getSetting('ship_scrap_refund_pct', '40')) || 40;
    const gpRefund = Math.floor((parseInt(ship.build_gp_cost) || 0) * refundPct / 100);

    // 광물 환불/소각 로그
    let recipe = ship.recipe_minerals;
    if (typeof recipe === 'string') {
      try { recipe = JSON.parse(recipe); } catch(_) { recipe = null; }
    }
    const refundedMinerals = {};
    const burnedMinerals = {};
    if (recipe && typeof recipe === 'object') {
      for (const [code, amtRaw] of Object.entries(recipe)) {
        const amt = parseInt(amtRaw) || 0;
        if (amt <= 0) continue;
        const refund = Math.floor(amt * refundPct / 100);
        const burned = amt - refund;
        if (refund > 0) {
          refundedMinerals[code] = refund;
          // 광물 환불 (인벤토리 +)
          await client.query(
            `INSERT INTO user_resource_inventory (wallet_address, resource_id, quantity, updated_at)
             SELECT $1, r.id, $2, NOW() FROM resources r WHERE r.code = $3
             ON CONFLICT (wallet_address, resource_id) DO UPDATE
               SET quantity = user_resource_inventory.quantity + EXCLUDED.quantity,
                   updated_at = NOW()`,
            [walletAddress.toLowerCase(), refund, code]
          );
        }
        if (burned > 0) burnedMinerals[code] = burned;
      }
    }

    // GP 환불
    if (gpRefund > 0) {
      await client.query(
        `UPDATE users SET gp_balance = gp_balance + $1 WHERE LOWER(wallet_address) = LOWER($2)`,
        [gpRefund, walletAddress.toLowerCase()]
      );
    }

    // 함선 삭제 (is_alive=false, scrapped)
    await client.query(
      `UPDATE ships SET is_alive = false, destroyed_at = NOW(), destroyed_reason = 'scrapped'
       WHERE id = $1`, [shipId]
    );

    // 해체 로그
    try {
      await client.query(
        `INSERT INTO ship_scrap_log (ship_id, wallet, ship_type_code, gp_refunded, minerals_refunded, minerals_burned)
         VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb)`,
        [shipId, walletAddress.toLowerCase(), ship.ship_type_code, gpRefund,
         JSON.stringify(refundedMinerals), JSON.stringify(burnedMinerals)]
      );
    } catch (_) { /* log table may not exist on older DBs */ }

    await client.query('COMMIT');

    try {
      const { logGPActivity } = require('../db');
      if (gpRefund > 0) logGPActivity(walletAddress, gpRefund, 'ship_scrap', `${ship.name_ko} 해체 환불`).catch(()=>{});
    } catch(_) {}

    return {
      success: true,
      shipName: ship.name_ko,
      gpRefunded: gpRefund,
      mineralsRefunded: refundedMinerals,
      mineralsBurned: burnedMinerals
    };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
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
  upgradeShipStat,
  getShipMarketListings,
  listShipForSale,
  cancelShipListing,
  buyShipListing,
  scrapShip,
};
