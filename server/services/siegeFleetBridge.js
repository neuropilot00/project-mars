// server/services/siegeFleetBridge.js
// ═══════════════════════════════════════════════════════════════
// Siege ↔ Fleet Battle Bridge
// 
// governor_sieges 에서 siege 선언 시 fleet_battle을 자동 생성/연결
// 기존 siege 서비스에서 이 모듈을 호출하도록 수정 필요
// ═══════════════════════════════════════════════════════════════

const { pool } = require('../db');

/**
 * Siege를 fleet_battle로 연결
 * 기존 siege 선언 로직에서 성공 시 호출
 * 
 * @param {Object} params {
 *   governor_siege_id,  // governor_sieges.id
 *   atk_wallet,         // 공격자 지갑
 *   def_wallet,         // 방어자 지갑
 *   atk_fleet_id,       // 공격 함대 ID (유저가 선택)
 *   def_fleet_id,       // 방어 함대 ID (유저가 선택)
 *   sector_id,
 *   claim_id,
 *   delay_hours         // 기본 24시간
 * }
 * @returns {number} battle_id
 */
async function createSiegeBattle(params) {
  const {
    governor_siege_id,
    atk_wallet, def_wallet,
    atk_fleet_id, def_fleet_id,
    sector_id, claim_id,
    delay_hours = 24,
  } = params;
  
  // 검증
  if (!governor_siege_id || !atk_wallet || !def_wallet || !atk_fleet_id || !def_fleet_id) {
    throw new Error('MISSING_PARAMS');
  }
  
  // [v7.68] 함대 상태 체크를 트랜잭션 내 FOR UPDATE로 직렬화 — is_in_battle TOCTOU 방지
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: atkFleet } = await client.query(
      `SELECT id, is_in_battle FROM fleets WHERE id = $1 AND LOWER(owner_wallet) = LOWER($2) FOR UPDATE`,
      [atk_fleet_id, atk_wallet]
    );
    if (!atkFleet[0]) { await client.query('ROLLBACK'); throw new Error('ATK_FLEET_NOT_FOUND'); }
    if (atkFleet[0].is_in_battle) { await client.query('ROLLBACK'); throw new Error('ATK_FLEET_IN_BATTLE'); }

    const { rows: defFleet } = await client.query(
      `SELECT id, is_in_battle FROM fleets WHERE id = $1 AND LOWER(owner_wallet) = LOWER($2) FOR UPDATE`,
      [def_fleet_id, def_wallet]
    );
    if (!defFleet[0]) { await client.query('ROLLBACK'); throw new Error('DEF_FLEET_NOT_FOUND'); }
    if (defFleet[0].is_in_battle) { await client.query('ROLLBACK'); throw new Error('DEF_FLEET_IN_BATTLE'); }

    // Migration 096의 헬퍼 함수 사용
    const { rows } = await client.query(`
      SELECT create_siege_battle($1, $2, $3, $4, $5, $6, $7, $8) AS battle_id
    `, [
      governor_siege_id, atk_wallet, def_wallet,
      atk_fleet_id, def_fleet_id, sector_id, claim_id, delay_hours
    ]);

    await client.query('COMMIT');
    const battleId = rows[0].battle_id;
    console.log(`[siegeBridge] siege ${governor_siege_id} linked to fleet_battle ${battleId}`);
    return battleId;
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

/**
 * Siege 결과를 governor_sieges에 반영
 * battleScheduler 의 전투 종료 훅에서 siege 전투일 때 호출.
 * [Phase1] 전투 승자를 지갑으로 매핑해 siege.resolveSiege() 에 위임 — 거버너 이전/명예전당/평판 등
 *          기존 해결 로직을 한 경로로 재사용한다.
 */
async function applySiegeResult(battleId) {
  const { rows } = await pool.query(`
    SELECT fb.winner_side, fb.governor_siege_id,
           gs.id AS siege_id, gs.challenger_wallet, gs.defender_wallet, gs.status
      FROM fleet_battles fb
      JOIN governor_sieges gs ON gs.id = fb.governor_siege_id
     WHERE fb.id = $1
  `, [battleId]);

  if (!rows[0] || !rows[0].siege_id) return; // siege 연동 없는 전투
  const r = rows[0];
  if (r.status === 'resolved') return; // 이미 해결됨

  // winner_side(atk/def/draw) → 지갑. def/draw = 수비자 유지.
  const battleWinnerWallet = r.winner_side === 'atk'
    ? r.challenger_wallet
    : (r.defender_wallet || null);

  try {
    const siege = require('./siege');
    const res = await siege.resolveSiege(r.siege_id, { battleWinnerWallet });
    console.log(`[siegeBridge] siege ${r.siege_id} resolved via battle ${battleId} (winner_side=${r.winner_side}, winner=${res?.winner ?? 'n/a'})`);
  } catch (err) {
    console.error('[siegeBridge] applySiegeResult resolveSiege failed:', err.message);
  }
}

/**
 * 진행 중인 siege 전투 조회 (유저가 참여한 것)
 */
async function getMySiegeBattles(walletAddress) {
  const { rows } = await pool.query(`
    SELECT 
      fb.id, fb.status, fb.phase, fb.winner_side,
      fb.scheduled_start_at, fb.battle_started_at, fb.ended_at,
      fb.sector_id, fb.claim_id, fb.governor_siege_id,
      p.side AS my_side, p.fleet_id AS my_fleet_id
    FROM fleet_battles fb
    JOIN fleet_battle_participants p ON p.battle_id = fb.id
    WHERE fb.battle_type = 'siege'
      AND p.wallet_address = $1
      AND fb.status IN ('preparing', 'active')
    ORDER BY fb.scheduled_start_at ASC
  `, [walletAddress]);
  
  return rows;
}

module.exports = {
  createSiegeBattle,
  applySiegeResult,
  getMySiegeBattles,
};
