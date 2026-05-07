// server/services/tournament.js
// ═══════════════════════════════════════════════════════════════
// Tournament System — 단일 엘리미네이션 브래킷
// 
// 흐름:
//   1. createTournament — 토너먼트 생성 (관리자 또는 자동)
//   2. registerParticipant — 유저 참가 (entry_fee 지불)
//   3. startTournament — 정원 도달 or 마감 시 자동 시작
//      - 시드 배정 (random or skill-based)
//      - 브래킷 생성 (tournament_matches)
//   4. advanceMatch — 각 매치 종료 시 승자를 다음 라운드로
//   5. finalizeTournament — 결승 완료 시 상금 지급
// ═══════════════════════════════════════════════════════════════

const { pool, logGPActivity } = require('../db');
const siegeFleetBridge = require('./siegeFleetBridge'); // 재사용: battle 생성 유틸

// ─── 토너먼트 생성 ───

async function createTournament(params) {
  const {
    name, description,
    max_participants = 8,
    min_participants = 4,
    entry_fee_gp = 0,
    reward_1st_gp = 1000,
    reward_2nd_gp = 500,
    reward_3rd_gp = 250,
    registration_deadline_hours = 24,
    start_delay_hours = 1,
  } = params;
  
  if (!name) throw new Error('NAME_REQUIRED');
  if (![4, 8, 16].includes(max_participants)) {
    throw new Error('INVALID_SIZE'); // 2^n만 허용
  }
  
  const totalRounds = Math.log2(max_participants);
  
  const { rows } = await pool.query(`
    INSERT INTO tournaments (
      name, description, max_participants, min_participants,
      total_rounds, entry_fee_gp,
      reward_1st_gp, reward_2nd_gp, reward_3rd_gp,
      registration_deadline,
      start_at
    ) VALUES (
      $1, $2, $3, $4,
      $5, $6,
      $7, $8, $9,
      NOW() + ($10 || ' hours')::INTERVAL,
      NOW() + (($10::int + $11::int) || ' hours')::INTERVAL
    ) RETURNING id, name, status, max_participants, total_rounds
  `, [
    name, description, max_participants, min_participants,
    totalRounds, entry_fee_gp,
    reward_1st_gp, reward_2nd_gp, reward_3rd_gp,
    String(registration_deadline_hours), String(start_delay_hours)
  ]);
  
  return rows[0];
}

// ─── 참가 신청 ───

async function registerParticipant(tournamentId, walletAddress, fleetId) {
  const client = await pool.connect();
  const walletLower = String(walletAddress || '').toLowerCase();
  let shouldStart = false;
  let entryFeeGp = 0;
  let committed = false;
  try {
    await client.query('BEGIN');
    
    // 토너먼트 상태
    const { rows: tRows } = await client.query(
      `SELECT * FROM tournaments WHERE id = $1 FOR UPDATE`, [tournamentId]
    );
    if (!tRows[0]) throw new Error('TOURNAMENT_NOT_FOUND');
    const t = tRows[0];
    
    if (t.status !== 'registering') throw new Error('REGISTRATION_CLOSED');
    if (t.current_participants >= t.max_participants) throw new Error('TOURNAMENT_FULL');
    if (new Date() > new Date(t.registration_deadline)) {
      throw new Error('DEADLINE_PASSED');
    }
    
    // 이미 참가?
    const { rows: exists } = await client.query(
      `SELECT 1 FROM tournament_participants WHERE tournament_id = $1 AND LOWER(wallet_address) = LOWER($2)`,
      [tournamentId, walletLower]
    );
    if (exists[0]) throw new Error('ALREADY_REGISTERED');
    
    // 함대 소유권 + 함선 확인
    const { rows: fleetRows } = await client.query(`
      SELECT f.id, f.owner_wallet, f.is_in_battle,
             COUNT(s.id) FILTER (WHERE s.is_alive) AS ships_alive
      FROM fleets f LEFT JOIN ships s ON s.fleet_id = f.id
      WHERE f.id = $1 AND LOWER(f.owner_wallet) = LOWER($2)
      GROUP BY f.id
    `, [fleetId, walletLower]);
    if (!fleetRows[0]) throw new Error('FLEET_NOT_FOUND');
    if (fleetRows[0].is_in_battle) throw new Error('FLEET_IN_BATTLE');
    if (parseInt(fleetRows[0].ships_alive) === 0) throw new Error('FLEET_EMPTY');
    const participantWallet = (fleetRows[0].owner_wallet || walletLower).toLowerCase();
    
    // Entry fee 차감
    if (t.entry_fee_gp > 0) {
      const { rows: userRows } = await client.query(
        `SELECT gp_balance FROM users WHERE LOWER(wallet_address) = LOWER($1) FOR UPDATE`,
        [participantWallet]
      );
      if (!userRows[0]) throw new Error('USER_NOT_FOUND');
      if (parseInt(userRows[0].gp_balance) < t.entry_fee_gp) {
        const err = new Error('INSUFFICIENT_GP');
        err.meta = { required: t.entry_fee_gp, balance: userRows[0].gp_balance };
        throw err;
      }
      
      const deductTournament = await client.query(
        `UPDATE users SET gp_balance = gp_balance - $1 WHERE LOWER(wallet_address) = LOWER($2) AND gp_balance >= $1`,
        [t.entry_fee_gp, participantWallet]
      );
      if (deductTournament.rowCount === 0) throw new Error('INSUFFICIENT_GP');
      entryFeeGp = parseInt(t.entry_fee_gp) || 0;
      
      // Prize pool 증가
      await client.query(
        `UPDATE tournaments SET prize_pool_gp = prize_pool_gp + $1 WHERE id = $2`,
        [t.entry_fee_gp, tournamentId]
      );
    }
    
    // 참가 등록
    await client.query(`
      INSERT INTO tournament_participants (tournament_id, wallet_address, fleet_id)
      VALUES ($1, $2, $3)
    `, [tournamentId, participantWallet, fleetId]);
    
    // 카운트 +1
    await client.query(`
      UPDATE tournaments SET current_participants = current_participants + 1
      WHERE id = $1
    `, [tournamentId]);
    
    // 정원 찼으면 ready 상태로
    if (t.current_participants + 1 >= t.max_participants) {
      await client.query(
        `UPDATE tournaments SET status = 'ready' WHERE id = $1`,
        [tournamentId]
      );
      shouldStart = true;
    }
    
    await client.query('COMMIT');
    committed = true;
    if (entryFeeGp > 0) {
      logGPActivity(participantWallet, -entryFeeGp, 'tournament_entry', `Tournament #${tournamentId} entry`).catch(() => {});
    }
    if (shouldStart) {
      await startTournament(tournamentId);
    }
    return { success: true, tournament_id: tournamentId, started: shouldStart };
  } catch (err) {
    if (!committed) {
      try { await client.query('ROLLBACK'); } catch (_) {}
    }
    throw err;
  } finally {
    client.release();
  }
}

// ─── 토너먼트 시작 (브래킷 생성) ───

async function startTournament(tournamentId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // 상태 확인
    const { rows: tRows } = await client.query(
      `SELECT * FROM tournaments WHERE id = $1 FOR UPDATE`, [tournamentId]
    );
    if (!tRows[0]) throw new Error('TOURNAMENT_NOT_FOUND');
    const t = tRows[0];
    
    if (t.status !== 'ready' && t.status !== 'registering') {
      throw new Error('CANNOT_START');
    }
    
    // 참가자 조회
    const { rows: participants } = await client.query(`
      SELECT wallet_address, fleet_id FROM tournament_participants
      WHERE tournament_id = $1
    `, [tournamentId]);
    
    if (participants.length < t.min_participants) {
      throw new Error('NOT_ENOUGH_PARTICIPANTS');
    }
    
    // 시드 섞기 (random)
    const shuffled = [...participants].sort(() => Math.random() - 0.5);
    
    // max_participants까지 채우기 (부족하면 bye)
    while (shuffled.length < t.max_participants) {
      shuffled.push(null); // bye 표시
    }
    
    // 시드 부여
    for (let i = 0; i < shuffled.length; i++) {
      if (shuffled[i]) {
        await client.query(
          `UPDATE tournament_participants SET seed = $1 
           WHERE tournament_id = $2 AND wallet_address = $3`,
          [i, tournamentId, shuffled[i].wallet_address]
        );
      }
    }
    
    // 1라운드 매치 생성
    const matchIds = [];
    for (let i = 0; i < shuffled.length; i += 2) {
      const p1 = shuffled[i];
      const p2 = shuffled[i + 1];
      const matchIndex = i / 2;
      
      const { rows: matchRows } = await client.query(`
        INSERT INTO tournament_matches (
          tournament_id, round, match_index,
          p1_wallet, p1_fleet_id, p2_wallet, p2_fleet_id,
          status, scheduled_at
        ) VALUES ($1, 1, $2, $3, $4, $5, $6, $7, NOW())
        RETURNING id
      `, [
        tournamentId, matchIndex,
        p1?.wallet_address || null, p1?.fleet_id || null,
        p2?.wallet_address || null, p2?.fleet_id || null,
        (p1 && p2) ? 'ready' : (p1 || p2) ? 'bye' : 'pending'
      ]);
      matchIds.push(matchRows[0].id);
    }
    
    // 2~마지막 라운드 매치 자리만 미리 생성 (linking을 위해)
    let prevRoundMatches = matchIds;
    const roundCount = t.total_rounds;
    
    for (let round = 2; round <= roundCount; round++) {
      const newRoundMatchIds = [];
      const prevCount = prevRoundMatches.length;
      
      for (let mi = 0; mi < prevCount / 2; mi++) {
        const { rows: matchRows } = await client.query(`
          INSERT INTO tournament_matches (
            tournament_id, round, match_index, status, scheduled_at
          ) VALUES ($1, $2, $3, 'pending', NOW())
          RETURNING id
        `, [tournamentId, round, mi]);
        const newMatchId = matchRows[0].id;
        newRoundMatchIds.push(newMatchId);
        
        // 이전 라운드 매치 2개에 next_match_id 연결
        await client.query(
          `UPDATE tournament_matches SET next_match_id = $1 
           WHERE id = ANY($2::bigint[])`,
          [newMatchId, [prevRoundMatches[mi * 2], prevRoundMatches[mi * 2 + 1]]]
        );
      }
      
      prevRoundMatches = newRoundMatchIds;
    }
    
    // 토너먼트 running 상태로
    await client.query(`
      UPDATE tournaments SET status = 'running', current_round = 1 WHERE id = $1
    `, [tournamentId]);
    
    // Bye 매치들은 즉시 다음 라운드로 진출 처리
    await client.query(`COMMIT`);
    
    // BEGIN 밖에서 처리
    await processByeMatches(tournamentId);
    
    return { success: true, tournament_id: tournamentId, round: 1 };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function processByeMatches(tournamentId) {
  const { rows } = await pool.query(`
    SELECT id FROM tournament_matches
    WHERE tournament_id = $1 AND status = 'bye'
  `, [tournamentId]);
  
  for (const row of rows) {
    // bye인 매치는 존재하는 플레이어를 승자로
    const { rows: matchRows } = await pool.query(
      `SELECT * FROM tournament_matches WHERE id = $1`, [row.id]
    );
    const match = matchRows[0];
    const winner = match.p1_wallet || match.p2_wallet;
    
    await pool.query(`
      UPDATE tournament_matches 
      SET status = 'completed', winner_wallet = $1, completed_at = NOW()
      WHERE id = $2
    `, [winner, row.id]);
    
    // 다음 라운드로 승자 이동
    await promoteWinner(row.id);
  }
}

// ─── 매치 시작 (브래킷 매치 → fleet_battle 생성) ───

/**
 * 준비 완료된 매치를 실행
 */
async function runReadyMatches(tournamentId) {
  const { rows: matches } = await pool.query(`
    SELECT * FROM tournament_matches
    WHERE tournament_id = $1 AND status = 'ready'
    ORDER BY round ASC, match_index ASC
    LIMIT 10
  `, [tournamentId]);
  
  const results = [];
  for (const match of matches) {
    try {
      await runSingleMatch(match);
      results.push({ match_id: match.id, status: 'started' });
    } catch (err) {
      console.error(`[tournament] match ${match.id} error:`, err.message);
      results.push({ match_id: match.id, status: 'error', error: err.message });
    }
  }
  return results;
}

async function runSingleMatch(match) {
  const client = await pool.connect();
  let battleId = null;
  try {
    await client.query('BEGIN');

  // fleet_battle 생성
  const { rows: battleRows } = await client.query(`
    INSERT INTO fleet_battles (
      battle_type, status, phase,
      prepare_started_at, scheduled_start_at
    ) VALUES ('event', 'preparing', 'main', NOW(), NOW())
    RETURNING id
  `);
  battleId = battleRows[0].id;
  
  await client.query(`
    INSERT INTO fleet_battle_participants (battle_id, fleet_id, wallet_address, side)
    VALUES ($1, $2, $3, 'atk'), ($1, $4, $5, 'def')
  `, [battleId, match.p1_fleet_id, match.p1_wallet, match.p2_fleet_id, match.p2_wallet]);
  
  // 매치에 battle_id 연결
  await client.query(`
    UPDATE tournament_matches 
    SET battle_id = $1, status = 'running', started_at = NOW()
    WHERE id = $2
  `, [battleId, match.id]);

  await client.query('COMMIT');
  
  // 즉시 실행
  const battleScheduler = require('./battleScheduler');
  battleScheduler.runBattle(battleId).then(() => {
    // 전투 완료 → 매치 완료 처리 (비동기)
    completeMatch(match.id).catch(err => 
      console.error(`[tournament] completeMatch ${match.id} error:`, err)
    );
  }).catch(err => {
    console.error(`[tournament] runBattle ${battleId} error:`, err);
  });
  
  return battleId;
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch (_) {}
    throw err;
  } finally {
    client.release();
  }
}

// ─── 매치 완료 처리 ───

async function completeMatch(matchId) {
  const { rows } = await pool.query(`
    SELECT tm.*, fb.winner_side, fb.status AS battle_status
    FROM tournament_matches tm
    LEFT JOIN fleet_battles fb ON fb.id = tm.battle_id
    WHERE tm.id = $1
  `, [matchId]);
  
  if (!rows[0]) throw new Error('MATCH_NOT_FOUND');
  const match = rows[0];
  
  if (match.status === 'completed') return; // 이미 완료
  if (match.battle_status !== 'ended') return; // 전투 아직 안 끝남
  
  const winner = match.winner_side === 'atk' ? match.p1_wallet : 
                 match.winner_side === 'def' ? match.p2_wallet :
                 match.p1_wallet; // 무승부 시 p1 승리 (or 랜덤)
  const loser = winner === match.p1_wallet ? match.p2_wallet : match.p1_wallet;
  
  // 매치 완료
  await pool.query(`
    UPDATE tournament_matches 
    SET status = 'completed', winner_wallet = $1, completed_at = NOW()
    WHERE id = $2
  `, [winner, matchId]);
  
  // 참가자 통계 업데이트
  await pool.query(`
    UPDATE tournament_participants SET wins = wins + 1 
    WHERE tournament_id = $1 AND wallet_address = $2
  `, [match.tournament_id, winner]);
  
  await pool.query(`
    UPDATE tournament_participants 
    SET losses = losses + 1, eliminated_at_round = $1
    WHERE tournament_id = $2 AND wallet_address = $3
  `, [match.round, match.tournament_id, loser]);
  
  // 승자를 다음 라운드로
  await promoteWinner(matchId);
}

async function promoteWinner(matchId) {
  const { rows } = await pool.query(`
    SELECT tm.*, next_m.id AS next_id, next_m.p1_wallet AS next_p1, next_m.p2_wallet AS next_p2
    FROM tournament_matches tm
    LEFT JOIN tournament_matches next_m ON next_m.id = tm.next_match_id
    WHERE tm.id = $1
  `, [matchId]);
  
  if (!rows[0]) return;
  const match = rows[0];
  const winner = match.winner_wallet;
  
  if (!match.next_id || !winner) {
    // 결승전 완료 → 토너먼트 종료
    if (!match.next_id) {
      await finalizeTournament(match.tournament_id);
    }
    return;
  }
  
  // 승자 함대 ID 가져오기
  const { rows: fleetRows } = await pool.query(`
    SELECT fleet_id FROM tournament_participants 
    WHERE tournament_id = $1 AND LOWER(wallet_address) = LOWER($2)
  `, [match.tournament_id, winner]);
  const winnerFleetId = fleetRows[0]?.fleet_id;
  
  // p1 자리가 비어있으면 p1로, 아니면 p2로
  const slot = !match.next_p1 ? 1 : 2;
  
  await pool.query(`
    UPDATE tournament_matches 
    SET ${slot === 1 ? 'p1_wallet = $1, p1_fleet_id = $2' : 'p2_wallet = $1, p2_fleet_id = $2'}
    WHERE id = $3
  `, [winner, winnerFleetId, match.next_id]);
  
  // 다음 매치가 양쪽 다 찼으면 ready로
  await pool.query(`
    UPDATE tournament_matches 
    SET status = 'ready'
    WHERE id = $1 AND p1_wallet IS NOT NULL AND p2_wallet IS NOT NULL AND status = 'pending'
  `, [match.next_id]);
}

// ─── 토너먼트 종료 ───

async function finalizeTournament(tournamentId) {
  const { rows: tRows } = await pool.query(
    `SELECT * FROM tournaments WHERE id = $1`, [tournamentId]
  );
  const t = tRows[0];
  if (!t || t.status === 'completed') return;
  
  // 결승전 승자 = 1등
  const { rows: finalRows } = await pool.query(`
    SELECT winner_wallet FROM tournament_matches
    WHERE tournament_id = $1 AND round = $2
    ORDER BY match_index ASC LIMIT 1
  `, [tournamentId, t.total_rounds]);
  const firstWallet = finalRows[0]?.winner_wallet;
  
  // 결승 패자 = 2등
  const { rows: finalMatch } = await pool.query(`
    SELECT p1_wallet, p2_wallet, winner_wallet FROM tournament_matches
    WHERE tournament_id = $1 AND round = $2 LIMIT 1
  `, [tournamentId, t.total_rounds]);
  const secondWallet = finalMatch[0] 
    ? (finalMatch[0].winner_wallet === finalMatch[0].p1_wallet ? finalMatch[0].p2_wallet : finalMatch[0].p1_wallet)
    : null;
  
  // 준결승 패자 둘 중 하나 = 3등 (간단화: 랜덤)
  const { rows: semiLosers } = await pool.query(`
    SELECT p1_wallet, p2_wallet, winner_wallet FROM tournament_matches
    WHERE tournament_id = $1 AND round = $2
  `, [tournamentId, t.total_rounds - 1]);
  let thirdWallet = null;
  for (const sm of semiLosers) {
    const loser = sm.winner_wallet === sm.p1_wallet ? sm.p2_wallet : sm.p1_wallet;
    if (loser && loser !== secondWallet) { thirdWallet = loser; break; }
  }
  
  // 상금 지급
  const prizes = [];
  if (firstWallet) prizes.push({ wallet: firstWallet, rank: 1, gp: t.reward_1st_gp });
  if (secondWallet) prizes.push({ wallet: secondWallet, rank: 2, gp: t.reward_2nd_gp });
  if (thirdWallet) prizes.push({ wallet: thirdWallet, rank: 3, gp: t.reward_3rd_gp });
  
  for (const p of prizes) {
    if (p.gp > 0) {
      await pool.query(
        `UPDATE users SET gp_balance = gp_balance + $1 WHERE LOWER(wallet_address) = LOWER($2)`,
        [p.gp, p.wallet]
      );
      await pool.query(`
        INSERT INTO fleet_gp_activity (wallet_address, activity_type, gp_delta, meta)
        VALUES ($1, 'tournament_prize', $2, $3)
      `, [p.wallet, p.gp, JSON.stringify({ 
        tournament_id: tournamentId, rank: p.rank 
      })]).catch(()=>{});
    }
    
    await pool.query(
      `UPDATE tournament_participants SET final_rank = $1
       WHERE tournament_id = $2 AND wallet_address = $3`,
      [p.rank, tournamentId, p.wallet]
    );
  }
  
  await pool.query(`
    UPDATE tournaments 
    SET status = 'completed', winner_wallet = $1, completed_at = NOW()
    WHERE id = $2
  `, [firstWallet, tournamentId]);
  
  console.log(`[tournament] ${tournamentId} finalized. 1st: ${firstWallet}`);
}

// ─── 조회 ───

async function listTournaments(status = null) {
  let query = `SELECT * FROM tournaments `;
  const params = [];
  if (status) {
    params.push(status);
    query += `WHERE status = $${params.length} `;
  }
  query += `ORDER BY created_at DESC LIMIT 50`;
  
  const { rows } = await pool.query(query, params);
  return rows;
}

async function getTournamentDetail(tournamentId) {
  const { rows: tRows } = await pool.query(
    `SELECT * FROM tournaments WHERE id = $1`, [tournamentId]
  );
  if (!tRows[0]) return null;
  
  const { rows: participants } = await pool.query(`
    SELECT tp.*, u.nickname, f.name AS fleet_name
    FROM tournament_participants tp
    LEFT JOIN users u ON u.wallet_address = tp.wallet_address
    LEFT JOIN fleets f ON f.id = tp.fleet_id
    WHERE tp.tournament_id = $1
    ORDER BY tp.seed
  `, [tournamentId]);
  
  const { rows: matches } = await pool.query(`
    SELECT * FROM v_tournament_bracket WHERE tournament_id = $1
  `, [tournamentId]);
  
  return {
    ...tRows[0],
    participants,
    matches,
  };
}

module.exports = {
  createTournament,
  registerParticipant,
  startTournament,
  runReadyMatches,
  completeMatch,
  finalizeTournament,
  listTournaments,
  getTournamentDetail,
};
