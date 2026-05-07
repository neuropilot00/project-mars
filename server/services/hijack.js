// server/services/hijack.js
// ═══════════════════════════════════════════════════════════════
// Hijack 2-Phase Battle System  [STATUS: 🟢 LIVE]
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
//
// ─── 진입점 / 라우트 정리 ──────────────────────────────────
// • POST /api/hijack/declare-with-pp  (routes/api.js)
//     → 정식 영토 하이잭. PP 정산 + 픽셀 이전 포함. UI 진입은 영토 정보 패널의
//       "⚔ HIJACK 영토" 버튼 → claim 모달 → 이 경로.
// • POST /api/hijack/declare          (routes/phaseC.js)
//     → 410 Deprecated. 과거 영토 이전 없는 전투-only 경로.
//       함대 결투 대용은 /api/ai/fight 또는 토너먼트 브라켓.
//   declareHijack() 함수 자체는 declareHijackWithPP() 가 내부에서 사용하므로
//   서비스 export 는 유지하지만, 외부 라우트는 deprecate.
//
// ─── Flow (declare-with-pp) ────────────────────────────────
// 1. 침입자 stamp 영역 vs 수비자 픽셀 overlap 계산
//    - 수비 함대 0 → auto-win (Phase 1/2 스킵, 즉시 픽셀 이전)
//    - 수비 함대 있음 → fleet_battle 생성 + phase1_battle_id 반환
// 2. Phase1 종료 후 Phase2 자동 시작 (수비 본대 vs 침입자 본대)
// 3. handlePhase2Complete() — 픽셀 소유권 이전, claim 레코드는 보존
//
// ─── Recent fixes ─────────────────────────────────────────
// - 8d2148b: 프론트에서 phase1_battle_id 받아 자동으로 battle viewer 오픈
// - c2d35c8: 부분 점령 시 빈 claim 레코드 자동 삭제 비활성화 (defender 기록 보존)
// - 240ae43 / migration 175: hijack_battles.target_claim_id NULL 허용
//
// ─── 주의 ─────────────────────────────────────────────────
// - 픽셀 grid: 0.22°/cell (GRID_SIZE). enemy_pixels = stamp ∩ defender pixels.
// - tombstone.js의 hijack_log 참조는 phantom (실제 테이블은 hijack_battles).
// ═══════════════════════════════════════════════════════════════

const { pool, getSetting } = require('../db');

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
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Lock hijack row inside transaction — prevents double-processing on concurrent calls
    const { rows: hjRows } = await client.query(`
      SELECT hb.*, fb.winner_side
      FROM hijack_battles hb
      JOIN fleet_battles fb ON fb.id = hb.phase1_battle_id
      WHERE hb.phase1_battle_id = $1
        AND hb.phase = 'phase1'
      FOR UPDATE OF hb
    `, [phase1BattleId]);

    if (!hjRows[0]) {
      await client.query('ROLLBACK');
      return; // Not a hijack phase1 battle, or already processed
    }

    const hijack = hjRows[0];
    const winner = hijack.winner_side;

    // Phase 1 종료 처리 — status + winner in single atomic update
    await client.query(`
      UPDATE hijack_battles
      SET phase1_ended_at = NOW(), phase1_winner = $1
      WHERE id = $2
    `, [winner, hijack.id]);

    let autoStartPayload = null;

    if (winner === 'atk') {
      await client.query(`UPDATE hijack_battles SET phase = 'phase2' WHERE id = $1`, [hijack.id]);

      // Collect Phase 2 auto-start data while inside transaction
      if (hijack.pending_pixels) {
        const { rows: parts } = await client.query(`
          SELECT fleet_id, wallet_address, side
          FROM fleet_battle_participants WHERE battle_id = $1
        `, [phase1BattleId]);
        const atkPart = parts.find(p => p.side === 'atk');
        const defPart = parts.find(p => p.side === 'def');
        if (atkPart && defPart) {
          autoStartPayload = { hijackId: hijack.id, atkWallet: atkPart.wallet_address, atkFleet: atkPart.fleet_id, defFleet: defPart.fleet_id };
        }
      }
    } else {
      // 하이잭 실패 — Phase 1 패배: status + refund in one transaction
      await client.query(`
        UPDATE hijack_battles
        SET phase = 'failed', completed_at = NOW(), final_result = 'defender_won'
        WHERE id = $1
      `, [hijack.id]);

      // declare-with-pp 방식이면 90% 환불
      if (hijack.pending_pixels && parseFloat(hijack.attack_cost || 0) > 0) {
        const refund90 = Math.round(parseFloat(hijack.attack_cost) * 0.9 * 1000000) / 1000000;
        await client.query(
          `UPDATE users SET pp_balance = pp_balance + $1 WHERE LOWER(wallet_address) = LOWER($2)`,
          [refund90, hijack.attacker_wallet]
        );
        console.log(`[hijack] ${hijack.id} Phase 1 lost → 90% refund ${refund90} PP → ${hijack.attacker_wallet}`);
      }
      console.log(`[hijack] ${hijack.id} Phase 1 lost → hijack failed`);
    }

    await client.query('COMMIT');

    // Auto-start Phase 2 AFTER commit (uses its own transaction)
    if (autoStartPayload) {
      console.log(`[hijack] ${autoStartPayload.hijackId} Phase 1 won → Phase 2 starting`);
      setTimeout(() => {
        startPhase2(autoStartPayload.hijackId, autoStartPayload.atkWallet, autoStartPayload.atkFleet, autoStartPayload.defFleet)
          .catch(err => console.error(`[hijack] auto Phase 2 start error:`, err.message));
      }, 3000);
    }
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(`[hijack] handlePhase1Complete error:`, err.message);
  } finally {
    client.release();
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
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Lock hijack row inside transaction — prevents double pixel-transfer on concurrent calls
    const { rows } = await client.query(`
      SELECT hb.*, fb.winner_side
      FROM hijack_battles hb
      JOIN fleet_battles fb ON fb.id = hb.phase2_battle_id
      WHERE hb.phase2_battle_id = $1
        AND hb.phase NOT IN ('completed', 'failed')
      FOR UPDATE OF hb
    `, [phase2BattleId]);

    if (!rows[0]) {
      await client.query('ROLLBACK');
      return; // Not a hijack phase2 battle, or already processed
    }
    const hijack = rows[0];
    const winner = hijack.winner_side;

    const finalResult = winner === 'atk' ? 'attacker_won' : 'defender_won';

    await client.query(`
      UPDATE hijack_battles SET
        phase2_ended_at = NOW(),
        phase2_winner = $1,
        phase = 'completed',
        completed_at = NOW(),
        final_result = $2
      WHERE id = $3
    `, [winner, finalResult, hijack.id]);

    // ── declare-with-pp 방식 판별 ──
    const isDeclareWithPP = !!hijack.pending_pixels;

    if (winner === 'atk' && isDeclareWithPP) {
      // ── 공격 성공: 수비자 지급 + 픽셀 이전 ──
      const pixels = Array.isArray(hijack.pending_pixels) ? hijack.pending_pixels : [];
      if (pixels.length > 0) {
        const attackerWallet = hijack.attacker_wallet;

        // 수비자 환불+보너스 지급 (이제 승리 시에만 지급)
        const hijackMult = parseFloat(await getSetting('hijack_multiplier', '1.2')) || 1.2;
        const ownerBonusPct = (parseFloat(await getSetting('hijack_owner_bonus', '50')) || 50) / 100;
        const ownerCredits = {};
        for (const px of pixels) {
          if (!px.prev_owner) continue;
          const pxCost = parseFloat(px.price) * hijackMult;
          if (!ownerCredits[px.prev_owner]) ownerCredits[px.prev_owner] = 0;
          ownerCredits[px.prev_owner] += parseFloat(px.price) + (pxCost - parseFloat(px.price)) * ownerBonusPct;
        }
        for (const [owner, credit] of Object.entries(ownerCredits)) {
          if (credit > 0) {
            await client.query(
              `UPDATE users SET pp_balance = pp_balance + $1 WHERE LOWER(wallet_address) = LOWER($2)`,
              [Math.round(credit * 1000000) / 1000000, owner]
            );
          }
        }

        // 픽셀 소유권 이전
        let newClaimId = hijack.new_claim_id;
        for (const px of pixels) {
          await client.query(
            `UPDATE pixels SET owner = $1, claim_id = $2 WHERE lat = $3 AND lng = $4`,
            [attackerWallet, newClaimId || null, px.lat, px.lng]
          );
        }

        // 새 claim이 없으면 생성
        if (!newClaimId && pixels.length > 0) {
          const lats = pixels.map(p => p.lat);
          const lngs = pixels.map(p => p.lng);
          const centerLat = (Math.min(...lats) + Math.max(...lats)) / 2;
          const centerLng = (Math.min(...lngs) + Math.max(...lngs)) / 2;
          const w = Math.round((Math.max(...lngs) - Math.min(...lngs)) / 0.22) + 1;
          const h = Math.round((Math.max(...lats) - Math.min(...lats)) / 0.22) + 1;
          const { rows: cr } = await client.query(
            `INSERT INTO claims (owner, center_lat, center_lng, width, height, total_paid)
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
            [attackerWallet, centerLat, centerLng, w, h, hijack.pp_paid || 0]
          );
          const createdId = cr[0].id;
          newClaimId = createdId;
          for (const px of pixels) {
            await client.query(
              `UPDATE pixels SET claim_id = $1 WHERE lat = $2 AND lng = $3 AND owner = $4`,
              [createdId, px.lat, px.lng, attackerWallet]
            );
          }
          await client.query(
            `UPDATE hijack_battles SET new_claim_id = $1 WHERE id = $2`,
            [createdId, hijack.id]
          );
        }

        // 원 소유자 claim은 보존 (Phase 2 승리 시에도 동일)

        console.log(`[hijack] ${hijack.id} ATK WIN: ${pixels.length}px → ${attackerWallet}`);
      }

    } else if (winner === 'def' && isDeclareWithPP) {
      // ── 공격 실패: 90% 환불 ──
      const attackCost = parseFloat(hijack.attack_cost || 0);
      if (attackCost > 0) {
        const refund90 = Math.round(attackCost * 0.9 * 1000000) / 1000000;
        await client.query(
          `UPDATE users SET pp_balance = pp_balance + $1 WHERE LOWER(wallet_address) = LOWER($2)`,
          [refund90, hijack.attacker_wallet]
        );
        console.log(`[hijack] ${hijack.id} DEF WIN: 90% refund ${refund90} PP → ${hijack.attacker_wallet}`);
      }
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(`[hijack] handlePhase2Complete error:`, err.message);
  } finally {
    client.release();
  }

  // hijack_stats 업데이트 (fire-and-forget)
  if (winner === 'atk') {
    pool.query(`
      INSERT INTO hijack_stats (wallet_address, hijacks_attempted, hijacks_succeeded, phase2_wins)
      VALUES ($1, 1, 1, 1)
      ON CONFLICT (wallet_address) DO UPDATE SET
        hijacks_attempted = hijack_stats.hijacks_attempted + 1,
        hijacks_succeeded = hijack_stats.hijacks_succeeded + 1,
        phase2_wins = hijack_stats.phase2_wins + 1,
        updated_at = NOW()
    `, [hijack.attacker_wallet]).catch(() => {});
  } else {
    pool.query(`
      INSERT INTO hijack_stats (wallet_address, hijacks_attempted, hijacks_failed)
      VALUES ($1, 1, 1)
      ON CONFLICT (wallet_address) DO UPDATE SET
        hijacks_attempted = hijack_stats.hijacks_attempted + 1,
        hijacks_failed = hijack_stats.hijacks_failed + 1,
        updated_at = NOW()
    `, [hijack.attacker_wallet]).catch(() => {});
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

// ─── 클레임 모달에서 직접 하이젝 + PP 결제 ───

/**
 * 클레임 스탬프 → 적 영토 겹침 → 함대전 하이젝
 * 1. 겹치는 픽셀 비용 PP 차감 (공격 비용 선불)
 * 2. 새 픽셀 즉시 claim 생성
 * 3. 적 픽셀: hijack_battle 생성 → fleet battle
 *    - 승리: 수비자 환불+보너스 지급 + 픽셀 이전
 *    - 패배: 공격 비용 90% 환불 (10% 소각)
 * ※ 수비자 지급은 승리 시에만 (handlePhase2Complete에서 처리)
 */
async function declareHijackWithPP(params) {
  const {
    attacker_wallet,
    lat, lng, width, height,
    atk_fleet_id,
    image_url, link_url,
    pay_method,
    new_pixels,              // [{lat, lng, sectorPrice}]
    enemy_pixels,            // [{lat, lng, prevOwner, price, pxCost, claim_id}] — primary defender only
    primary_defender_wallet,
    primary_def_fleet_id,    // null → auto-win
    primary_def_claim_id,    // 수비자 대표 claim_id (target_claim_id 용)
    base_cost,
    attack_cost,
    affected_owners,         // 자동승리 시에만 사용 (즉시 지급)
  } = params;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // ── 1. 잔액 확인 + 차감 ──
    const totalCost = Math.round((base_cost + attack_cost) * 1000000) / 1000000;
    const { rows: userRows } = await client.query(
      `SELECT pp_balance, usdt_balance FROM users WHERE LOWER(wallet_address) = LOWER($1) FOR UPDATE`,
      [attacker_wallet]
    );
    if (!userRows[0]) throw new Error('USER_NOT_FOUND');

    const ppBal = parseFloat(userRows[0].pp_balance);
    if (ppBal < totalCost) {
      throw Object.assign(new Error('INSUFFICIENT_PP'), { required: totalCost, balance: ppBal });
    }

    const deductHijack = await client.query(
      `UPDATE users SET pp_balance = pp_balance - $1 WHERE LOWER(wallet_address) = LOWER($2) AND pp_balance >= $1`,
      [totalCost, attacker_wallet]
    );
    if (deductHijack.rowCount === 0) throw new Error('INSUFFICIENT_PP');

    // ── 2. 새 픽셀 즉시 claim 생성 ──
    // (수비자 지급은 함대전 승리 후 handlePhase2Complete에서 처리)
    // ── 3. 새 픽셀 즉시 claim 생성 ──
    let newClaimId = null;
    if (new_pixels && new_pixels.length > 0) {
      const { rows: cr } = await client.query(
        `INSERT INTO claims (owner, center_lat, center_lng, width, height, image_url, link_url, total_paid)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
        [attacker_wallet, lat, lng, width, height, image_url || null, link_url || null, base_cost]
      );
      newClaimId = cr[0].id;

      for (const px of new_pixels) {
        await client.query(
          `INSERT INTO pixels (lat, lng, owner, price, claim_id)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (lat, lng) DO UPDATE SET owner = $3, price = $4, claim_id = $5`,
          [px.lat, px.lng, attacker_wallet, px.sectorPrice, newClaimId]
        );
      }
    }

    // ── 4. target_claim_id 결정 — 수비자 claim 조회 또는 stub 생성 ──
    // NPC 픽셀은 claim_id가 없으므로 DB에서 직접 조회, 없으면 stub claim 생성
    let resolvedTargetClaimId = primary_def_claim_id || newClaimId;
    if (!resolvedTargetClaimId && primary_defender_wallet) {
      const { rows: defClaims } = await client.query(
        `SELECT id FROM claims WHERE LOWER(owner) = LOWER($1) ORDER BY id DESC LIMIT 1`,
        [primary_defender_wallet]
      );
      if (defClaims[0]) {
        resolvedTargetClaimId = defClaims[0].id;
      } else {
        // 수비자 claim이 아예 없으면 stub 생성 (NPC 케이스)
        const ep = enemy_pixels[0];
        const { rows: stub } = await client.query(
          `INSERT INTO claims (owner, center_lat, center_lng, width, height, total_paid)
           VALUES ($1, $2, $3, 1, 1, 0) RETURNING id`,
          [primary_defender_wallet, ep ? ep.lat : 0, ep ? ep.lng : 0]
        );
        resolvedTargetClaimId = stub[0].id;
      }
    }

    // ── 5. 적 픽셀 처리 ──
    let hijackId = null;
    let phase1BattleId = null;
    let autoWin = false;

    if (enemy_pixels && enemy_pixels.length > 0) {
      const pendingPixels = enemy_pixels.map(ep => ({
        lat: ep.lat,
        lng: ep.lng,
        prev_owner: ep.prevOwner,
        price: ep.price,
      }));

      if (!primary_def_fleet_id) {
        // ── 자동 승리: 수비자 함대 없음 → 즉시 픽셀 이전 + 수비자 지급 ──
        autoWin = true;

        // 자동승리는 확정이므로 수비자 즉시 지급
        for (const [owner, amounts] of Object.entries(affected_owners || {})) {
          const credit = (amounts.refund || 0) + (amounts.bonus || 0);
          if (credit > 0) {
            await client.query(
              `UPDATE users SET pp_balance = pp_balance + $1 WHERE LOWER(wallet_address) = LOWER($2)`,
              [credit, owner]
            );
          }
        }

        if (!newClaimId && enemy_pixels.length > 0) {
          const lats = enemy_pixels.map(p => p.lat);
          const lngs = enemy_pixels.map(p => p.lng);
          const centerLat = (Math.min(...lats) + Math.max(...lats)) / 2;
          const centerLng = (Math.min(...lngs) + Math.max(...lngs)) / 2;
          const claimW = Math.round((Math.max(...lngs) - Math.min(...lngs)) / 0.22) + 1;
          const claimH = Math.round((Math.max(...lats) - Math.min(...lats)) / 0.22) + 1;
          const { rows: cr } = await client.query(
            `INSERT INTO claims (owner, center_lat, center_lng, width, height, image_url, link_url, total_paid)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
            [attacker_wallet, centerLat, centerLng, claimW, claimH, image_url || null, link_url || null, attack_cost || totalCost]
          );
          newClaimId = cr[0].id;
        }

        for (const px of enemy_pixels) {
          await client.query(
            `UPDATE pixels SET owner = $1, claim_id = $2 WHERE lat = $3 AND lng = $4`,
            [attacker_wallet, newClaimId, px.lat, px.lng]
          );
        }

        // 원 소유자 claim은 보존 — 픽셀만 이전됐을 뿐, 클레임 레코드는 유지
        // (이전엔 빈 클레임 자동 삭제했으나, 부분 점령 시 잘못 삭제되는 케이스로 인해 비활성화)

        // hijack_battles 기록 (완료 상태)
        const { rows: hjRows } = await client.query(`
          INSERT INTO hijack_battles (
            attacker_wallet, target_claim_id,
            phase, final_result, completed_at,
            pending_pixels, pp_paid, attack_cost, new_claim_id,
            allowed_size_classes_phase1
          ) VALUES ($1, $2, 'completed', 'attacker_won', NOW(), $3, $4, $5, $6, $7)
          RETURNING id`,
          [attacker_wallet, resolvedTargetClaimId, JSON.stringify(pendingPixels), totalCost, attack_cost, newClaimId, PHASE1_ALLOWED_SIZES]
        );
        hijackId = hjRows[0].id;
      } else {
        // ── 함대전: hijack_battles + fleet_battle 생성 ──
        // Phase 1 함선 확인 (공격자)
        const { rows: atkShips } = await client.query(`
          SELECT s.id, st.size_class
          FROM ships s JOIN ship_types st ON st.code = s.ship_type_code
          WHERE s.fleet_id = $1 AND s.is_alive = true
        `, [atk_fleet_id]);

        const atkPhase1Ships = atkShips.filter(s => PHASE1_ALLOWED_SIZES.includes(s.size_class));
        if (atkPhase1Ships.length === 0) throw new Error('NO_PHASE1_SHIPS');
        if (atkPhase1Ships.length > PHASE1_MAX_SHIPS) {
          const e = new Error('TOO_MANY_PHASE1_SHIPS');
          e.meta = { max: PHASE1_MAX_SHIPS, count: atkPhase1Ships.length };
          throw e;
        }

        // 함대 전투 중 체크
        const { rows: atkFleet } = await client.query(
          `SELECT is_in_battle FROM fleets WHERE id = $1 AND LOWER(owner_wallet) = LOWER($2) FOR UPDATE`,
          [atk_fleet_id, attacker_wallet]
        );
        if (!atkFleet[0]) throw new Error('ATK_FLEET_NOT_FOUND');
        if (atkFleet[0].is_in_battle) throw new Error('ATK_FLEET_IN_BATTLE');

        const { rows: defFleet } = await client.query(
          `SELECT is_in_battle FROM fleets WHERE id = $1 AND LOWER(owner_wallet) = LOWER($2) FOR UPDATE`,
          [primary_def_fleet_id, primary_defender_wallet]
        );
        if (!defFleet[0]) throw new Error('DEF_FLEET_NOT_FOUND');
        if (defFleet[0].is_in_battle) throw new Error('DEF_FLEET_IN_BATTLE');

        // hijack_battles 생성 (attack_cost 저장 — 패배 시 환불 계산용)
        const { rows: hjRows } = await client.query(`
          INSERT INTO hijack_battles (
            attacker_wallet, target_claim_id,
            phase, pending_pixels, pp_paid, attack_cost, new_claim_id,
            allowed_size_classes_phase1, started_at
          ) VALUES ($1, $2, 'phase1', $3, $4, $5, $6, $7, NOW())
          RETURNING id`,
          [attacker_wallet, resolvedTargetClaimId, JSON.stringify(pendingPixels), totalCost, attack_cost, newClaimId, PHASE1_ALLOWED_SIZES]
        );
        hijackId = hjRows[0].id;

        // Phase 1 fleet_battle 생성
        const { rows: bRows } = await client.query(`
          INSERT INTO fleet_battles (
            battle_type, status, phase,
            prepare_started_at, scheduled_start_at
          ) VALUES ('hijack', 'preparing', 'hijack_phase1', NOW(), NOW() + INTERVAL '10 seconds')
          RETURNING id
        `);
        phase1BattleId = bRows[0].id;

        await client.query(`
          INSERT INTO fleet_battle_participants (battle_id, fleet_id, wallet_address, side)
          VALUES ($1, $2, $3, 'atk'), ($1, $4, $5, 'def')
        `, [phase1BattleId, atk_fleet_id, attacker_wallet, primary_def_fleet_id, primary_defender_wallet]);

        await client.query(`
          UPDATE hijack_battles
          SET phase1_battle_id = $1, phase1_started_at = NOW()
          WHERE id = $2
        `, [phase1BattleId, hijackId]);
      }
    }

    await client.query('COMMIT');

    return {
      success: true,
      hijack_id: hijackId,
      phase1_battle_id: phase1BattleId,
      new_claim_id: newClaimId,
      auto_win: autoWin,
      new_count: new_pixels ? new_pixels.length : 0,
      hijack_count: enemy_pixels ? enemy_pixels.length : 0,
      total_cost: totalCost,
      // auto_win 시 클라이언트 즉시 반영용 — API 재요청 없이 _serverPixels 업데이트
      hijacked_pixels: autoWin && enemy_pixels ? enemy_pixels.map(p => [p.lat, p.lng]) : [],
      new_pixels_list: autoWin && new_pixels ? new_pixels.map(p => [p.lat, p.lng]) : [],
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = {
  declareHijack,
  declareHijackWithPP,
  handlePhase1Complete,
  startPhase2,
  handlePhase2Complete,
  getHijackDetail,
  getMyHijacks,
  PHASE1_ALLOWED_SIZES,
  PHASE1_MAX_SHIPS,
};
