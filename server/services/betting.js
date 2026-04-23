/**
 * services/betting.js
 * Territory War Betting 시스템 (BIBLE Migration 087)
 *
 * 함수 목록:
 *  - createBettingEvent(eventType, eventId, labelA, labelB, closesAt)
 *  - placeBet(userWallet, eventId, option, amountGP)
 *  - settleBettingEvent(eventId, winnerOption)
 *  - getBettingOdds(eventId)
 *  - getActiveBettingEvents()
 *  - getUserBets(userWallet)
 *  - cancelBettingEvent(eventId)
 *
 * ⚠️  users.id 없음 → user_wallet VARCHAR(42) 기반
 */

'use strict';

const { pool, getSetting } = require('../db');

// ─────────────────────────────────────────────────────────────
// 1. 베팅 이벤트 생성
// ─────────────────────────────────────────────────────────────
async function createBettingEvent(eventType, eventId, labelA, labelB, closesAt) {
  const enabled = (await getSetting('war_betting_enabled') ?? 'false').toString() === 'true';
  if (!enabled) return null; // 비활성화 시 null 반환 (에러 아님)

  const res = await pool.query(
    `INSERT INTO war_bet_events
       (event_type, event_id, option_a_label, option_b_label,
        status, opens_at, closes_at)
     VALUES ($1, $2, $3, $4, 'open', NOW(), $5)
     RETURNING *`,
    [eventType, eventId, labelA || 'Option A', labelB || 'Option B', closesAt || null]
  );
  return res.rows[0];
}

// ─────────────────────────────────────────────────────────────
// 2. 베팅 등록
// ─────────────────────────────────────────────────────────────
async function placeBet(userWallet, eventId, option, amountGP) {
  const w = userWallet.toLowerCase();

  // 기능 활성화 확인
  const enabled = (await getSetting('war_betting_enabled') ?? 'false').toString() === 'true';
  if (!enabled) return { success: false, error: 'betting_disabled' };

  // 설정값 로드
  const minGP    = parseInt(await getSetting('war_betting_min_gp') ?? '10');
  const maxGP    = parseInt(await getSetting('war_betting_max_gp') ?? '1000');
  const maxBets  = parseInt(await getSetting('war_betting_max_per_user') ?? '3');
  const amount   = parseInt(amountGP);

  if (!['a', 'b'].includes(option)) {
    return { success: false, error: 'invalid_option' };
  }
  if (isNaN(amount) || amount < minGP) {
    return { success: false, error: 'bet_too_small', min: minGP };
  }
  if (amount > maxGP) {
    return { success: false, error: 'bet_too_large', max: maxGP };
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 이벤트 유효성 확인
    const evRes = await client.query(
      "SELECT * FROM war_bet_events WHERE id = $1 AND status = 'open' FOR UPDATE",
      [parseInt(eventId)]
    );
    if (!evRes.rows.length) {
      await client.query('ROLLBACK');
      return { success: false, error: 'event_not_found_or_closed' };
    }
    const ev = evRes.rows[0];
    if (ev.closes_at && new Date(ev.closes_at) < new Date()) {
      await client.query('ROLLBACK');
      return { success: false, error: 'event_closed' };
    }

    // 이미 이 이벤트에 베팅했는지 확인
    const existingBet = await client.query(
      'SELECT id FROM war_bets WHERE event_id = $1 AND user_wallet = $2',
      [parseInt(eventId), w]
    );
    if (existingBet.rows.length) {
      await client.query('ROLLBACK');
      return { success: false, error: 'already_bet' };
    }

    // 현재 활성 베팅 수 확인
    const activeBetCount = await client.query(
      "SELECT COUNT(*) AS cnt FROM war_bets wb JOIN war_bet_events we ON we.id = wb.event_id WHERE wb.user_wallet = $1 AND wb.status = 'pending' AND we.status = 'open'",
      [w]
    );
    if (parseInt(activeBetCount.rows[0]?.cnt ?? 0) >= maxBets) {
      await client.query('ROLLBACK');
      return { success: false, error: 'max_bets_reached', max: maxBets };
    }

    // GP 잔액 확인 및 차감
    const userRes = await client.query(
      'SELECT gp_balance FROM users WHERE wallet_address = $1 FOR UPDATE',
      [w]
    );
    if (!userRes.rows.length) {
      await client.query('ROLLBACK');
      return { success: false, error: 'user_not_found' };
    }
    const gpBalance = parseFloat(userRes.rows[0].gp_balance) || 0;
    if (gpBalance < amount) {
      await client.query('ROLLBACK');
      return { success: false, error: 'insufficient_gp', required: amount, current: gpBalance };
    }

    await client.query(
      'UPDATE users SET gp_balance = gp_balance - $1 WHERE wallet_address = $2',
      [amount, w]
    );

    // 베팅 INSERT
    const betRes = await client.query(
      `INSERT INTO war_bets (event_id, user_wallet, option, amount_gp, status)
       VALUES ($1, $2, $3, $4, 'pending') RETURNING *`,
      [parseInt(eventId), w, option, amount]
    );

    // 이벤트 총 베팅 업데이트
    const col = option === 'a' ? 'total_bet_a' : 'total_bet_b';
    await client.query(
      `UPDATE war_bet_events SET ${col} = ${col} + $1 WHERE id = $2`,
      [amount, parseInt(eventId)]
    );

    await client.query('COMMIT');
    return { success: true, bet: betRes.rows[0] };
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[BETTING] placeBet error:', err.message);
    return { success: false, error: 'internal_error' };
  } finally {
    client.release();
  }
}

// ─────────────────────────────────────────────────────────────
// 3. 베팅 이벤트 정산
// ─────────────────────────────────────────────────────────────
async function settleBettingEvent(eventId, winnerOption) {
  if (!eventId) return { success: false, error: 'no_event_id' };
  const id = parseInt(eventId);
  if (isNaN(id)) return { success: false, error: 'invalid_event_id' };
  if (!['a', 'b'].includes(winnerOption)) return { success: false, error: 'invalid_option' };

  const houseEdge = parseFloat(await getSetting('war_betting_house_edge') ?? '0.05');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const evRes = await client.query(
      "SELECT * FROM war_bet_events WHERE id = $1 AND status IN ('open','closed') FOR UPDATE",
      [id]
    );
    if (!evRes.rows.length) {
      await client.query('ROLLBACK');
      return { success: false, error: 'event_not_found_or_resolved' };
    }
    const ev = evRes.rows[0];

    const totalA = parseInt(ev.total_bet_a) || 0;
    const totalB = parseInt(ev.total_bet_b) || 0;
    const totalPool = totalA + totalB;

    if (totalPool === 0) {
      // 베팅 없으면 취소
      await client.query(
        "UPDATE war_bet_events SET status = 'cancelled', resolved_at = NOW() WHERE id = $1",
        [id]
      );
      await client.query("UPDATE war_bets SET status = 'refunded' WHERE event_id = $1", [id]);
      await client.query('COMMIT');
      return { success: true, payout_count: 0, total_payout: 0, cancelled: true };
    }

    // 하우스 엣지 계산
    const houseAmount = Math.floor(totalPool * houseEdge);
    const payoutPool  = totalPool - houseAmount;

    // 승자 베팅 총액
    const winnerTotal = winnerOption === 'a' ? totalA : totalB;
    const loserTotal  = winnerOption === 'a' ? totalB : totalA;

    let payoutCount = 0;
    let totalPayout = 0;

    if (winnerTotal > 0) {
      // 승자 배당: 자기 베팅 + (자기 베팅 / 승자 총액) × 패자 풀 × (1 - 하우스 엣지)
      const betsRes = await client.query(
        'SELECT * FROM war_bets WHERE event_id = $1 AND option = $2',
        [id, winnerOption]
      );

      for (const bet of betsRes.rows) {
        const myShare = bet.amount_gp / winnerTotal;
        const payout = Math.floor(bet.amount_gp + myShare * loserTotal * (1 - houseEdge));
        await client.query(
          'UPDATE users SET gp_balance = gp_balance + $1 WHERE wallet_address = $2',
          [payout, bet.user_wallet]
        );
        await client.query(
          "UPDATE war_bets SET status = 'won', payout_gp = $1 WHERE id = $2",
          [payout, bet.id]
        );
        payoutCount++;
        totalPayout += payout;
      }
    }

    // 패자 베팅 상태 업데이트
    await client.query(
      "UPDATE war_bets SET status = 'lost' WHERE event_id = $1 AND option != $2",
      [id, winnerOption]
    );

    // 이벤트 해결 완료
    await client.query(
      "UPDATE war_bet_events SET status = 'resolved', winner_option = $1, resolved_at = NOW() WHERE id = $2",
      [winnerOption, id]
    );

    await client.query('COMMIT');
    console.log(`[BETTING] Event #${id} settled. Winner: ${winnerOption}, Payout: ${totalPayout} GP to ${payoutCount} users`);
    return { success: true, payout_count: payoutCount, total_payout: totalPayout, house_amount: houseAmount };
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[BETTING] settleBettingEvent error:', err.message);
    return { success: false, error: 'internal_error' };
  } finally {
    client.release();
  }
}

// ─────────────────────────────────────────────────────────────
// 4. 배당률 조회
// ─────────────────────────────────────────────────────────────
async function getBettingOdds(eventId) {
  const res = await pool.query(
    'SELECT * FROM war_bet_events WHERE id = $1',
    [parseInt(eventId)]
  );
  if (!res.rows.length) return null;

  const ev = res.rows[0];
  const totalA = parseInt(ev.total_bet_a) || 0;
  const totalB = parseInt(ev.total_bet_b) || 0;
  const total  = totalA + totalB;
  const houseEdge = parseFloat(await getSetting('war_betting_house_edge') ?? '0.05');

  const oddsA = total > 0 && totalA > 0
    ? parseFloat(((total * (1 - houseEdge)) / totalA).toFixed(2)) : null;
  const oddsB = total > 0 && totalB > 0
    ? parseFloat(((total * (1 - houseEdge)) / totalB).toFixed(2)) : null;

  return {
    event_id:      ev.id,
    event_type:    ev.event_type,
    option_a:      { label: ev.option_a_label, total_gp: totalA, odds: oddsA },
    option_b:      { label: ev.option_b_label, total_gp: totalB, odds: oddsB },
    total_pool_gp: total,
    house_edge_pct: houseEdge * 100,
    status:        ev.status,
    closes_at:     ev.closes_at
  };
}

// ─────────────────────────────────────────────────────────────
// 5. 활성 베팅 이벤트 목록
// ─────────────────────────────────────────────────────────────
async function getActiveBettingEvents() {
  const res = await pool.query(
    "SELECT * FROM war_bet_events WHERE status = 'open' ORDER BY opens_at DESC"
  );
  return res.rows;
}

// ─────────────────────────────────────────────────────────────
// 6. 유저 베팅 목록
// ─────────────────────────────────────────────────────────────
async function getUserBets(userWallet) {
  const res = await pool.query(
    `SELECT wb.*, we.event_type, we.option_a_label, we.option_b_label,
            we.status AS event_status, we.winner_option, we.closes_at
     FROM war_bets wb
     JOIN war_bet_events we ON we.id = wb.event_id
     WHERE wb.user_wallet = $1
     ORDER BY wb.created_at DESC LIMIT 50`,
    [userWallet.toLowerCase()]
  );
  return res.rows;
}

// ─────────────────────────────────────────────────────────────
// 7. 베팅 이벤트 취소 (베팅 전액 환불)
// ─────────────────────────────────────────────────────────────
async function cancelBettingEvent(eventId) {
  const id = parseInt(eventId);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 모든 pending 베팅 환불
    const betsRes = await client.query(
      "SELECT * FROM war_bets WHERE event_id = $1 AND status = 'pending'",
      [id]
    );
    for (const bet of betsRes.rows) {
      await client.query(
        'UPDATE users SET gp_balance = gp_balance + $1 WHERE wallet_address = $2',
        [bet.amount_gp, bet.user_wallet]
      );
    }
    await client.query(
      "UPDATE war_bets SET status = 'refunded' WHERE event_id = $1 AND status = 'pending'",
      [id]
    );
    await client.query(
      "UPDATE war_bet_events SET status = 'cancelled', resolved_at = NOW() WHERE id = $1",
      [id]
    );

    await client.query('COMMIT');
    return { success: true, refunded: betsRes.rows.length };
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[BETTING] cancelBettingEvent error:', err.message);
    return { success: false, error: 'internal_error' };
  } finally {
    client.release();
  }
}

// ─────────────────────────────────────────────────────────────
// 8. 만료된 이벤트 자동 마감 (closes_at 지난 open 이벤트)
// ─────────────────────────────────────────────────────────────
async function closeExpiredEvents() {
  const res = await pool.query(
    "UPDATE war_bet_events SET status = 'closed' WHERE status = 'open' AND closes_at < NOW() RETURNING id"
  );
  return res.rows.length;
}

module.exports = {
  createBettingEvent,
  placeBet,
  settleBettingEvent,
  getBettingOdds,
  getActiveBettingEvents,
  getUserBets,
  cancelBettingEvent,
  closeExpiredEvents
};
