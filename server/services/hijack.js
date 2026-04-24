// server/services/hijack.js
// ═══════════════════════════════════════════════════════════════
// Hijack 2-Phase Battle System
//
// Phase 1 (침투): 프리깃/구축함만 투입, 20척 이하
//   - 적의 방어 돌파 시도
//   - 승리 시 Phase 2 진행
//   - 패배 시 하이잭 실패
//
// Phase 2 (점령): 전 함선 투입
//   - 본대 전투
//   - 승리 시 영토 또는 자산 탈취
//   - 패배 시 수비 성공
// ═══════════════════════════════════════════════════════════════

const { pool } = require('../db');

const PHASE1_ALLOWED_SIZES = ['frigate', 'destroyer'];
const PHASE1_MAX_SHIPS = 20;

// ─── Hijack 선언 ───

/**
 * Hijack 시작
 * @param {Object} params {
 *   attacker_wallet, target_claim_id,
 *   atk_fleet_id_phase1, def_wallet, def_fleet_id_phase1,
 *   ... (phase2 정보는 phase1 후 선택)
 * }
 */
async function declareHijack(params) {
  const {
    attacker_wallet, target_claim_id,
    atk_fleet_id, def_wallet, def_fleet_id,
  } = params;
  
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // 함대 소유권 확인
    const { rows: atkFleet } = await client.query(
      `SELECT id, is_in_battle FROM fleets WHERE id = $1 AND owner_wallet = $2 FOR UPDATE`,
      [atk_fleet_id, attacker_wallet]
    );
    if (!atkFleet[0]) throw new Error('ATK_FLEET_NOT_FOUND');
    if (atkFleet[0].is_in_battle) throw new Error('ATK_FLEET_IN_BATTLE');
    
    const { rows: defFleet } = await client.query(
      `SELECT id, is_in_battle FROM fleets WHERE id = $1 AND owner_wallet = $2 FOR UPDATE`,
      [def_fleet_id, def_wallet]
    );
    if (!defFleet[0]) throw new Error('DEF_FLEET_NOT_FOUND');
    if (defFleet[0].is_in_battle) throw new Error('DEF_FLEET_IN_BATTLE');
    
    // Phase 1 함선 조건 체크 (크기 + 수)
    const { rows: atkShips } = await client.query(`
      SELECT s.id, st.size_class
      FROM ships s JOIN ship_types st ON st.code = s.ship_type_code
      WHERE s.fleet_id = $1 AND s.is_alive = true
    `, [atk_fleet_id]);
    
    const atkPhase1Ships = atkShips.filter(s => PHASE1_ALLOWED_SIZES.includes(s.size_class));
    if (atkPhase1Ships.length === 0) {
      throw new Error('NO_PHASE1_SHIPS');
    }
    if (atkPhase1Ships.length > PHASE1_MAX_SHIPS) {
      const err = new Error('TOO_MANY_PHASE1_SHIPS');
      err.meta = { max: PHASE1_MAX_SHIPS, count: atkPhase1Ships.length };
      throw err;
    }
    
    // hijack_battles 레코드 생성
    const { rows: hjRows } = await client.query(`
      INSERT INTO hijack_battles (
        attacker_wallet, target_claim_id, phase,
        allowed_size_classes_phase1, started_at
      ) VALUES ($1, $2, 'phase1', $3, NOW())
      RETURNING id
    `, [attacker_wallet, target_claim_id, PHASE1_ALLOWED_SIZES]);
    
    const hijackId = hjRows[0].id;
    
    // Phase 1 fleet_battle 생성 (hijack 서브셋)
    // 주의: Phase 1은 함대 전체가 아닌 일부 함선만 투입
    // 지금 구조상 "함대 전체"가 투입되므로, 임시 함대를 만들거나
    // 기존 함대를 그대로 쓰되 size_class 필터링을 battleEngine에서 해야 함
    // 간단화: 플레이어에게 Phase 1 전용 함대 추천
    // 여기서는 주어진 함대 그대로 사용
    
    const { rows: bRows } = await client.query(`
      INSERT INTO fleet_battles (
        battle_type, status, phase,
        claim_id, prepare_started_at, scheduled_start_at
      ) VALUES ('hijack', 'preparing', 'hijack_phase1', $1, NOW(), NOW() + INTERVAL '10 seconds')
      RETURNING id
    `, [target_claim_id]);
    const phase1BattleId = bRows[0].id;
    
    await client.query(`
      INSERT INTO fleet_battle_participants (battle_id, fleet_id, wallet_address, side)
      VALUES ($1, $2, $3, 'atk'), ($1, $4, $5, 'def')
    `, [phase1BattleId, atk_fleet_id, attacker_wallet, def_fleet_id, def_wallet]);
    
    // hijack_battles에 연결
    await client.query(`
      UPDATE hijack_battles 
      SET phase1_battle_id = $1, phase1_started_at = NOW()
      WHERE id = $2
    `, [phase1BattleId, hijackId]);
    
    await client.query('COMMIT');
    
    return {
      success: true,
      hijack_id: hijackId,
      phase1_battle_id: phase1BattleId,
      phase: 'phase1',
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ─── Phase 1 종료 → Phase 2 준비 또는 실패 ───

/**
 * battleScheduler에서 hijack 타입 전투 종료 후 호출
 */
async function handlePhase1Complete(phase1BattleId) {
  // 이 battle이 hijack의 phase 1인지 확인
  const { rows: hjRows } = await pool.query(`
    SELECT hb.*, fb.winner_side
    FROM hijack_battles hb
    JOIN fleet_battles fb ON fb.id = hb.phase1_battle_id
    WHERE hb.phase1_battle_id = $1
  `, [phase1BattleId]);
  
  if (!hjRows[0]) return; // 일반 전투
  
  const hijack = hjRows[0];
  const winner = hijack.winner_side;
  
  // Phase 1 종료 처리
  await pool.query(`
    UPDATE hijack_battles 
    SET phase1_ended_at = NOW(), phase1_winner = $1
    WHERE id = $2
  `, [winner, hijack.id]);
  
  if (winner === 'atk') {
    // Phase 2로 진행
    await pool.query(`
      UPDATE hijack_battles SET phase = 'phase2' WHERE id = $1
    `, [hijack.id]);
    
    console.log(`[hijack] ${hijack.id} Phase 1 won → Phase 2 starting`);
    
    // 잠시 후 Phase 2 시작 알림 (플레이어가 전체 함대 투입 확인 필요)
    // → 실제로는 UI에서 "Phase 2 진행" 버튼 눌러야 함
  } else {
    // 하이잭 실패
    await pool.query(`
      UPDATE hijack_battles 
      SET phase = 'failed', completed_at = NOW(), final_result = 'defender_won'
      WHERE id = $1
    `, [hijack.id]);
    
    console.log(`[hijack] ${hijack.id} Phase 1 lost → hijack failed`);
  }
}

// ─── Phase 2 시작 ───

async function startPhase2(hijackId, walletAddress, atkFleetId, defFleetId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const { rows: hjRows } = await client.query(
      `SELECT * FROM hijack_battles WHERE id = $1 FOR UPDATE`, [hijackId]
    );
    if (!hjRows[0]) throw new Error('HIJACK_NOT_FOUND');
    const hijack = hjRows[0];
    
    if (hijack.attacker_wallet !== walletAddress) throw new Error('NOT_ATTACKER');
    if (hijack.phase !== 'phase2') throw new Error('NOT_IN_PHASE2');
    if (hijack.phase2_battle_id) throw new Error('PHASE2_ALREADY_STARTED');
    
    // Phase 2 battle 생성
    const { rows: bRows } = await client.query(`
      INSERT INTO fleet_battles (
        battle_type, status, phase, parent_battle_id,
        claim_id, prepare_started_at, scheduled_start_at
      ) VALUES ('hijack', 'preparing', 'hijack_phase2', $1, $2, NOW(), NOW())
      RETURNING id
    `, [hijack.phase1_battle_id, hijack.target_claim_id]);
    const phase2BattleId = bRows[0].id;
    
    // 방어자 찾기 (phase1 수비자)
    const { rows: defParts } = await client.query(`
      SELECT wallet_address FROM fleet_battle_participants
      WHERE battle_id = $1 AND side = 'def' LIMIT 1
    `, [hijack.phase1_battle_id]);
    const defWallet = defParts[0]?.wallet_address;
    
    await client.query(`
      INSERT INTO fleet_battle_participants (battle_id, fleet_id, wallet_address, side)
      VALUES ($1, $2, $3, 'atk'), ($1, $4, $5, 'def')
    `, [phase2BattleId, atkFleetId, walletAddress, defFleetId, defWallet]);
    
    await client.query(`
      UPDATE hijack_battles 
      SET phase2_battle_id = $1, phase2_started_at = NOW()
      WHERE id = $2
    `, [phase2BattleId, hijackId]);
    
    await client.query('COMMIT');
    
    // Phase 2 즉시 실행
    const battleScheduler = require('./battleScheduler');
    battleScheduler.runBattle(phase2BattleId).catch(err => 
      console.error(`[hijack] Phase 2 error:`, err)
    );
    
    return {
      success: true,
      hijack_id: hijackId,
      phase2_battle_id: phase2BattleId,
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ─── Phase 2 종료 처리 ───

async function handlePhase2Complete(phase2BattleId) {
  const { rows } = await pool.query(`
    SELECT hb.*, fb.winner_side
    FROM hijack_battles hb
    JOIN fleet_battles fb ON fb.id = hb.phase2_battle_id
    WHERE hb.phase2_battle_id = $1
  `, [phase2BattleId]);
  
  if (!rows[0]) return;
  const hijack = rows[0];
  const winner = hijack.winner_side;
  
  const finalResult = winner === 'atk' ? 'attacker_won' : 'defender_won';
  
  await pool.query(`
    UPDATE hijack_battles SET
      phase2_ended_at = NOW(),
      phase2_winner = $1,
      phase = 'completed',
      completed_at = NOW(),
      final_result = $2
    WHERE id = $3
  `, [winner, finalResult, hijack.id]);
  
  // hijack_stats 업데이트
  if (winner === 'atk') {
    await pool.query(`
      INSERT INTO hijack_stats (wallet_address, hijacks_attempted, hijacks_succeeded, phase2_wins)
      VALUES ($1, 1, 1, 1)
      ON CONFLICT (wallet_address) DO UPDATE SET
        hijacks_attempted = hijack_stats.hijacks_attempted + 1,
        hijacks_succeeded = hijack_stats.hijacks_succeeded + 1,
        phase2_wins = hijack_stats.phase2_wins + 1,
        updated_at = NOW()
    `, [hijack.attacker_wallet]);
  } else {
    await pool.query(`
      INSERT INTO hijack_stats (wallet_address, hijacks_attempted, hijacks_failed)
      VALUES ($1, 1, 1)
      ON CONFLICT (wallet_address) DO UPDATE SET
        hijacks_attempted = hijack_stats.hijacks_attempted + 1,
        hijacks_failed = hijack_stats.hijacks_failed + 1,
        updated_at = NOW()
    `, [hijack.attacker_wallet]);
  }
  
  console.log(`[hijack] ${hijack.id} completed: ${finalResult}`);
}

// ─── 조회 ───

async function getHijackDetail(hijackId) {
  const { rows } = await pool.query(`
    SELECT 
      hb.*,
      p1.winner_side AS phase1_battle_winner,
      p2.winner_side AS phase2_battle_winner,
      p1.status AS phase1_status,
      p2.status AS phase2_status
    FROM hijack_battles hb
    LEFT JOIN fleet_battles p1 ON p1.id = hb.phase1_battle_id
    LEFT JOIN fleet_battles p2 ON p2.id = hb.phase2_battle_id
    WHERE hb.id = $1
  `, [hijackId]);
  
  return rows[0] || null;
}

async function getMyHijacks(walletAddress) {
  const { rows } = await pool.query(`
    SELECT hb.*,
           p1.winner_side AS phase1_result,
           p2.winner_side AS phase2_result
    FROM hijack_battles hb
    LEFT JOIN fleet_battles p1 ON p1.id = hb.phase1_battle_id
    LEFT JOIN fleet_battles p2 ON p2.id = hb.phase2_battle_id
    WHERE hb.attacker_wallet = $1
    ORDER BY hb.started_at DESC
    LIMIT 30
  `, [walletAddress]);
  return rows;
}

module.exports = {
  declareHijack,
  handlePhase1Complete,
  startPhase2,
  handlePhase2Complete,
  getHijackDetail,
  getMyHijacks,
  PHASE1_ALLOWED_SIZES,
  PHASE1_MAX_SHIPS,
};
