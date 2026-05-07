// server/services/warBetting.js
// ═══════════════════════════════════════════════════════════════
// Territory War Betting Service
// 바이블 COMPLETE_BIBLE PART 4 § 5 기준
//
// 베팅 대상:
//   1. Governor Siege 결과
//   2. Guild War 승패
//   3. 주간 최다 Hijack 유저
//
// 하우스 엣지: 5% (총 베팅의 95% 승자 분배)
// 통화: GP 전용
// ═══════════════════════════════════════════════════════════════

const { pool } = require('../db');

// ─── 이벤트 생성 ───

/**
 * 베팅 이벤트 생성 (Admin 또는 자동 트리거)
 */
async function createEvent(params) {
  const {
    event_type,        // 'siege' | 'guild_war' | 'weekly_top'
    event_ref_id,
    title_ko, title_en,
    option_a_label, option_b_label, option_c_label,
    closes_at,
  } = params;

  if (!['siege', 'guild_war', 'weekly_top'].includes(event_type)) {
    throw new Error('INVALID_EVENT_TYPE');
  }
  if (!option_a_label || !option_b_label) throw new Error('OPTIONS_REQUIRED');
  if (!closes_at) throw new Error('CLOSES_AT_REQUIRED');

  // 동일 ref_id 중복 방지 (event_id 컬럼 = 외부 참조 ID)
  if (event_ref_id) {
    const { rows: existing } = await pool.query(
      `SELECT id FROM war_bet_events
       WHERE event_type = $1 AND event_id = $2 AND status != 'cancelled'`,
      [event_type, event_ref_id]
    );
    if (existing[0]) {
      throw new Error('EVENT_ALREADY_EXISTS');
    }
  }

  const { rows } = await pool.query(`
    INSERT INTO war_bet_events (
      event_type, event_id, title_ko, title_en,
      option_a_label, option_b_label, option_c_label,
      closes_at, status
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'open')
    RETURNING *
  `, [event_type, event_ref_id || null, title_ko, title_en,
      option_a_label, option_b_label, option_c_label || null,
      closes_at]);

  return rows[0];
}

// ─── 베팅 ───

/**
 * GP 베팅
 */
async function placeBet(walletAddress, eventId, option, amountGp) {
  const minGp = await getSettingInt('war_betting_min_gp', 10);
  const maxGp = await getSettingInt('war_betting_max_gp', 2000);

  if (!['a', 'b', 'c'].includes(option)) throw new Error('INVALID_OPTION');
  if (amountGp < minGp) {
    const err = new Error('BET_TOO_SMALL');
    err.meta = { min: minGp };
    throw err;
  }
  if (amountGp > maxGp) {
    const err = new Error('BET_TOO_LARGE');
    err.meta = { max: maxGp };
    throw err;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 이벤트 체크
    const { rows: eventRows } = await client.query(
      `SELECT * FROM war_bet_events WHERE id = $1 FOR UPDATE`,
      [eventId]
    );
    const event = eventRows[0];
    if (!event) throw new Error('EVENT_NOT_FOUND');
    if (event.status !== 'open') throw new Error('BETTING_CLOSED');
    if (new Date(event.closes_at) <= new Date()) throw new Error('BETTING_CLOSED');

    // option_c 없는 이벤트에 c 베팅 방지
    if (option === 'c' && !event.option_c_label) throw new Error('INVALID_OPTION');

    // 중복 베팅 방지
    const { rows: dupRows } = await client.query(
      `SELECT id FROM war_bets WHERE event_id = $1 AND LOWER(user_wallet) = LOWER($2)`,
      [eventId, walletAddress]
    );
    if (dupRows[0]) throw new Error('ALREADY_BET');

    // GP 차감
    const { rows: userRows } = await client.query(
      `SELECT gp_balance FROM users WHERE LOWER(wallet_address) = LOWER($1) FOR UPDATE`,
      [walletAddress]
    );
    if (!userRows[0]) throw new Error('USER_NOT_FOUND');
    const balance = parseInt(userRows[0].gp_balance) || 0;
    if (balance < amountGp) {
      const err = new Error('INSUFFICIENT_GP');
      err.meta = { required: amountGp, balance };
      throw err;
    }

    const deductWarBet = await client.query(
      `UPDATE users SET gp_balance = gp_balance - $1 WHERE LOWER(wallet_address) = LOWER($2) AND gp_balance >= $1`,
      [amountGp, walletAddress]
    );
    if (deductWarBet.rowCount === 0) throw new Error('INSUFFICIENT_GP');

    // 베팅 기록
    await client.query(`
      INSERT INTO war_bets (event_id, user_wallet, option, amount_gp, status)
      VALUES ($1, $2, $3, $4, 'pending')
    `, [eventId, walletAddress, option, amountGp]);

    // 이벤트 총액 업데이트
    await client.query(`
      UPDATE war_bet_events 
      SET total_bet_${option} = total_bet_${option} + $1
      WHERE id = $2
    `, [amountGp, eventId]);

    await client.query('COMMIT');

    // 현재 오즈 계산해서 반환
    const updatedEvent = await getEventWithOdds(eventId);
    return {
      success: true,
      bet_amount: amountGp,
      option,
      current_odds: updatedEvent?.odds,
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ─── 결과 처리 ───

/**
 * 이벤트 결과 확정 + 보상 분배
 */
async function resolveEvent(eventId, winnerOption) {
  if (!['a', 'b', 'c'].includes(winnerOption)) throw new Error('INVALID_OPTION');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: eventRows } = await client.query(
      `SELECT * FROM war_bet_events WHERE id = $1 FOR UPDATE`,
      [eventId]
    );
    const event = eventRows[0];
    if (!event) throw new Error('EVENT_NOT_FOUND');
    if (event.status === 'resolved') throw new Error('ALREADY_RESOLVED');

    // 총 베팅액
    const totalPool = parseInt(event.total_bet_a) +
                      parseInt(event.total_bet_b) +
                      (parseInt(event.total_bet_c) || 0);

    const houseEdge = await getSettingFloat('war_betting_house_edge', 0.05);
    const payoutPool = Math.floor(totalPool * (1 - houseEdge));

    // 승자 총액
    const winnerTotal = parseInt(event[`total_bet_${winnerOption}`]) || 0;

    // 승자에게 배분
    let totalPaidOut = 0;
    if (winnerTotal > 0) {
      const { rows: winners } = await client.query(
        `SELECT * FROM war_bets WHERE event_id = $1 AND option = $2 FOR UPDATE`,
        [eventId, winnerOption]
      );

      for (const bet of winners) {
        const share = bet.amount_gp / winnerTotal;
        const payout = Math.floor(payoutPool * share);
        totalPaidOut += payout;

        await client.query(
          `UPDATE users SET gp_balance = gp_balance + $1 WHERE LOWER(wallet_address) = LOWER($2)`,
          [payout, bet.user_wallet]
        );
        await client.query(
          `UPDATE war_bets SET status = 'won', payout_gp = $1 WHERE id = $2`,
          [payout, bet.id]
        );
      }
    }

    // 패자 처리
    await client.query(
      `UPDATE war_bets SET status = 'lost' WHERE event_id = $1 AND option != $2 AND status = 'pending'`,
      [eventId, winnerOption]
    );

    // 이벤트 완료
    await client.query(`
      UPDATE war_bet_events SET
        status = 'resolved',
        winner_option = $1,
        resolved_at = NOW()
      WHERE id = $2
    `, [winnerOption, eventId]);

    await client.query('COMMIT');

    return {
      success: true,
      event_id: eventId,
      winner_option: winnerOption,
      total_pool: totalPool,
      payout_pool: payoutPool,
      total_paid_out: totalPaidOut,
      house_take: totalPool - totalPaidOut,
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ─── 조회 ───

async function listActiveEvents() {
  const { rows } = await pool.query(`
    SELECT e.*,
      (SELECT COUNT(*) FROM war_bets WHERE event_id = e.id) AS bet_count
    FROM war_bet_events e
    WHERE e.status = 'open' AND e.closes_at > NOW()
    ORDER BY e.closes_at ASC
    LIMIT 20
  `);
  return rows.map(e => ({ ...e, odds: calcOdds(e) }));
}

async function listRecentEvents(limit = 20) {
  const { rows } = await pool.query(`
    SELECT e.*,
      (SELECT COUNT(*) FROM war_bets WHERE event_id = e.id) AS bet_count
    FROM war_bet_events e
    WHERE e.status IN ('resolved', 'closed')
    ORDER BY e.resolved_at DESC NULLS LAST, e.closes_at DESC
    LIMIT $1
  `, [limit]);
  return rows.map(e => ({ ...e, odds: calcOdds(e) }));
}

async function getEventWithOdds(eventId) {
  const { rows } = await pool.query(
    `SELECT e.*, (SELECT COUNT(*) FROM war_bets WHERE event_id = e.id) AS bet_count
     FROM war_bet_events e WHERE e.id = $1`,
    [eventId]
  );
  if (!rows[0]) return null;
  return { ...rows[0], odds: calcOdds(rows[0]) };
}

async function getMyBets(walletAddress, limit = 30) {
  const { rows } = await pool.query(`
    SELECT wb.*, 
           e.title_ko, e.event_type, e.status AS event_status,
           e.winner_option, e.closes_at,
           CASE wb.option
             WHEN 'a' THEN e.option_a_label
             WHEN 'b' THEN e.option_b_label
             WHEN 'c' THEN e.option_c_label
           END AS option_label
    FROM war_bets wb
    JOIN war_bet_events e ON e.id = wb.event_id
    WHERE LOWER(wb.user_wallet) = LOWER($1)
    ORDER BY wb.created_at DESC
    LIMIT $2
  `, [walletAddress, limit]);
  return rows;
}

// ─── 오즈 계산 ───

function calcOdds(event) {
  const a = parseInt(event.total_bet_a) || 0;
  const b = parseInt(event.total_bet_b) || 0;
  const c = parseInt(event.total_bet_c) || 0;
  const total = a + b + c;
  const houseEdge = 0.05;

  if (total === 0) {
    return { a: null, b: null, c: event.option_c_label ? null : undefined };
  }

  const payoutPool = total * (1 - houseEdge);
  return {
    a: a > 0 ? Math.round((payoutPool / a) * 100) / 100 : null,
    b: b > 0 ? Math.round((payoutPool / b) * 100) / 100 : null,
    c: (c > 0 && event.option_c_label)
      ? Math.round((payoutPool / c) * 100) / 100 : undefined,
    total_pool: total,
    payout_pool: Math.floor(payoutPool),
  };
}

// ─── 만료된 이벤트 자동 마감 ───

let _warBetDisabled = false;
async function closeExpiredEvents() {
  if (_warBetDisabled) return;
  let rows;
  try {
    const r = await pool.query(`
      UPDATE war_bet_events SET status = 'closed'
      WHERE status = 'open' AND closes_at <= NOW()
      RETURNING id, title_ko
    `);
    rows = r.rows;
  } catch (e) {
    if (e.code === '42P01' || e.code === '42703') {
      _warBetDisabled = true;
      console.log('[warBetting] disabled — schema not provisioned');
      return;
    }
    throw e;
  }
  if (rows.length > 0) {
    console.log(`[warBetting] closed ${rows.length} expired events`);
  }
}

// ─── 헬퍼 ───

async function getSettingInt(key, fallback) {
  try {
    const { rows } = await pool.query(`SELECT value FROM settings WHERE key = $1`, [key]);
    if (!rows[0]) return fallback;
    const n = parseInt(String(rows[0].value).replace(/"/g, ''), 10);
    return isNaN(n) ? fallback : n;
  } catch { return fallback; }
}

async function getSettingFloat(key, fallback) {
  try {
    const { rows } = await pool.query(`SELECT value FROM settings WHERE key = $1`, [key]);
    if (!rows[0]) return fallback;
    const n = parseFloat(String(rows[0].value).replace(/"/g, ''));
    return isNaN(n) ? fallback : n;
  } catch { return fallback; }
}

module.exports = {
  createEvent,
  placeBet,
  resolveEvent,
  listActiveEvents,
  listRecentEvents,
  getEventWithOdds,
  getMyBets,
  closeExpiredEvents,
  calcOdds,
};
