'use strict';
/**
 * Lottery Service — Migration 105
 * GP-based raffle: players buy tickets, winner drawn when round expires.
 */

const { pool, getSetting } = require('../db');

let notifyPlayer;
try { notifyPlayer = require('../db').notifyPlayer; } catch (_) {}
let logGPActivity;
try { logGPActivity = require('../db').logGPActivity; } catch (_) {}
let seasonService;
try { seasonService = require('./season'); } catch (_) {}
let newsService;
try { newsService = require('./news'); } catch (_) {}

// ── Helpers ──────────────────────────────────────────────────────────────────

async function getSettings(queryable = pool) {
  const keys = ['lottery_enabled','lottery_ticket_price_gp','lottery_max_tickets_per_user',
                 'lottery_round_hours','lottery_house_cut_pct','lottery_min_tickets','lottery_jackpot_rollover'];
  const res = await queryable.query(`SELECT key, value FROM settings WHERE key = ANY($1)`, [keys]);
  const map = {};
  res.rows.forEach(r => { map[r.key] = String(r.value); });
  return {
    enabled:          (map.lottery_enabled || 'true') !== 'false',
    ticketPrice:      parseFloat(map.lottery_ticket_price_gp) || 10,
    maxPerUser:       parseInt(map.lottery_max_tickets_per_user) || 50,
    roundHours:       parseInt(map.lottery_round_hours) || 24,
    houseCutPct:      parseFloat(map.lottery_house_cut_pct) || 5,
    minTickets:       parseInt(map.lottery_min_tickets) || 3,
    jackpotRollover:  (map.lottery_jackpot_rollover || 'true') !== 'false',
  };
}

// ── Round Management ──────────────────────────────────────────────────────────

/**
 * Get current open round, or create one if none exists.
 * Returns null if lottery is disabled.
 */
async function getCurrentRound(wallet) {
  const cfg = await getSettings();
  if (!cfg.enabled) return null;

  // Try to get open round
  let round = (await pool.query(
    `SELECT * FROM lottery_rounds WHERE status = 'open' ORDER BY id DESC LIMIT 1`
  )).rows[0];

  if (!round) {
    // Create first round
    round = await createRound(cfg);
  }

  // Get user ticket count for this round
  let userTickets = 0;
  if (wallet) {
    const tRes = await pool.query(
      `SELECT COUNT(*) AS n FROM lottery_tickets WHERE round_id = $1 AND wallet = $2`,
      [round.id, wallet.toLowerCase()]
    );
    userTickets = parseInt(tRes.rows[0]?.n) || 0;
  }

  // Get last few winners for display
  const recentRes = await pool.query(
    `SELECT r.round_number, r.prize_pool_gp, r.winner_wallet, r.drawn_at,
            u.nickname AS winner_nick
       FROM lottery_rounds r
       LEFT JOIN users u ON u.wallet_address = r.winner_wallet
      WHERE r.status = 'completed' AND r.winner_wallet IS NOT NULL
      ORDER BY r.drawn_at DESC LIMIT 5`
  ).catch(() => ({ rows: [] }));

  return {
    ...round,
    ticket_price: cfg.ticketPrice,
    user_tickets: userTickets,
    max_per_user: cfg.maxPerUser,
    recent_winners: recentRes.rows,
  };
}

async function createRound(cfg) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT pg_advisory_xact_lock(hashtext('lottery_round_create'))");
    const open = await client.query("SELECT * FROM lottery_rounds WHERE status='open' ORDER BY id DESC LIMIT 1");
    if (open.rows.length) { await client.query('COMMIT'); return open.rows[0]; }
    const lastRound = (await client.query(`SELECT MAX(round_number) AS n FROM lottery_rounds`)).rows[0];
    const nextNum = (parseInt(lastRound?.n) || 0) + 1;
    const endsAt = new Date(Date.now() + cfg.roundHours * 3600 * 1000);
    const ins = await client.query(
      `INSERT INTO lottery_rounds (round_number, ticket_price_gp, ends_at)
       VALUES ($1, $2, $3) RETURNING *`,
      [nextNum, cfg.ticketPrice, endsAt]
    );
    await client.query('COMMIT');
    return ins.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
}

// ── Ticket Purchase ───────────────────────────────────────────────────────────

/**
 * Buy lottery tickets for a wallet.
 * @param {object} client - pg client (already connected, BEGIN already called)
 * @param {string} wallet
 * @param {number} count
 * @returns {object} { ticketNumbers, newTotal, prizePool }
 */
async function buyTickets(client, wallet, count) {
  const w = wallet.toLowerCase();
  count = Math.max(1, Math.min(100, parseInt(count) || 1));
  const cfg = await getSettings(client);
  if (!cfg.enabled) throw new Error('Lottery is disabled');

  // Get current round
  let round = (await client.query(
    `SELECT * FROM lottery_rounds WHERE status = 'open' ORDER BY id DESC LIMIT 1 FOR UPDATE`
  )).rows[0];
  if (!round) throw new Error('No active lottery round');

  // Check round not expired
  if (new Date(round.ends_at) < new Date()) throw new Error('Round has expired, please wait for next round');

  // Check max tickets per user
  const existing = (await client.query(
    `SELECT COUNT(*) AS n FROM lottery_tickets WHERE round_id = $1 AND wallet = $2`,
    [round.id, w]
  )).rows[0]?.n || 0;
  if (parseInt(existing) + count > cfg.maxPerUser) {
    throw new Error(`Max ${cfg.maxPerUser} tickets per round`);
  }

  const totalCost = +(cfg.ticketPrice * count).toFixed(6);
  const paidUnits = Math.round(totalCost * 1e6);
  if (!(totalCost > 0) || !Number.isSafeInteger(paidUnits) || !Number.isFinite(cfg.houseCutPct) || cfg.houseCutPct < 0 || cfg.houseCutPct > 100) {
    throw new Error('Invalid lottery purchase configuration');
  }

  // Check balance
  const userRes = await client.query(
    `SELECT gp_balance FROM users WHERE LOWER(wallet_address) = LOWER($1) FOR UPDATE`, [w]
  );
  if (!userRes.rows.length) throw new Error('User not found');
  const balance = parseFloat(userRes.rows[0].gp_balance) || 0;
  if (balance < totalCost) throw new Error(`Insufficient GP: need ${totalCost}, have ${balance.toFixed(2)}`);

  // Deduct GP
  const deductLottery = await client.query(
    `UPDATE users SET gp_balance = gp_balance - $2 WHERE LOWER(wallet_address) = LOWER($1) AND gp_balance >= $2`,
    [w, totalCost]
  );
  if (deductLottery.rowCount === 0) throw new Error('INSUFFICIENT_GP');

  // Split house cut and prize pool
  const houseGp  = +(totalCost * cfg.houseCutPct / 100).toFixed(6);
  const prizeGp  = +(totalCost - houseGp).toFixed(6);

  // Allocate tickets
  const startTicket = round.ticket_count + 1;
  const ticketNumbers = [];
  for (let i = 0; i < count; i++) {
    const tn = startTicket + i;
    ticketNumbers.push(tn);
    await client.query(
      `INSERT INTO lottery_tickets (round_id, wallet, ticket_number, paid_gp) VALUES ($1, $2, $3, $4)`,
      [round.id, w, tn, (Math.floor(paidUnits / count) + (i < paidUnits % count ? 1 : 0)) / 1e6]
    );
  }

  // Persist this purchase's actual split in the same transaction as its debit.
  // Migration 358 leaves unverifiable historical house amounts at zero.
  await client.query(
    `UPDATE lottery_rounds
        SET ticket_count   = ticket_count + $2,
            prize_pool_gp  = prize_pool_gp + $3,
            house_gp       = house_gp + $4
      WHERE id = $1`,
    [round.id, count, prizeGp, houseGp]
  );

  const newRound = (await client.query(`SELECT * FROM lottery_rounds WHERE id = $1`, [round.id])).rows[0];
  return { ticketNumbers, count, totalCost, newTotal: parseInt(existing) + count, prizePool: newRound.prize_pool_gp };
}

// ── Drawing ───────────────────────────────────────────────────────────────────

/**
 * Draw the winner for an expired round.
 * Called by the scheduler every minute.
 */
let _lotteryDisabled = false;
async function drawExpiredRounds() {
  if (_lotteryDisabled) return 0;
  const now = new Date();

  // Find rounds that are open and expired
  let expired;
  try {
    expired = await pool.query(
      `SELECT * FROM lottery_rounds WHERE status = 'open' AND ends_at <= $1 ORDER BY id ASC`,
      [now]
    );
  } catch (e) {
    if (e.code === '42P01' || e.code === '42703') {
      _lotteryDisabled = true;
      console.log('[LOTTERY] disabled — schema not provisioned');
      return 0;
    }
    throw e;
  }
  const cfg = await getSettings();
  let drawn = 0;

  for (const round of expired.rows) {
    if (await drawRound(round, cfg)) drawn++;
  }
  // New-round creation is separate from money settlement. A later scheduler
  // call retries it even when there are no expired rounds left to draw.
  if (cfg.enabled) {
    try { await createRound(cfg); }
    catch (error) { console.error('[LOTTERY] next round creation failed; will retry:', error.message); }
  }
  return drawn;
}

async function drawRound(round, cfg) {
  const client = await pool.connect();
  let committed = false;
  try {
    await client.query('BEGIN');

    // Lock round
    const lockRes = await client.query(
      `SELECT * FROM lottery_rounds WHERE id = $1 AND status = 'open' FOR UPDATE`,
      [round.id]
    );
    if (!lockRes.rows.length) { await client.query('ROLLBACK'); return false; }

    // Use fresh locked values — round param may be stale snapshot from scheduler SELECT
    const lockedRound = lockRes.rows[0];
    const totalTickets = parseInt(lockedRound.ticket_count);

    if (totalTickets < cfg.minTickets) {
      // Not enough tickets — cancel round, refund everyone
      await client.query(
        `UPDATE lottery_rounds SET status = 'cancelled', drawn_at = NOW() WHERE id = $1`,
        [lockedRound.id]
      );
      // Refund all tickets
      const ticks = await client.query(
        `SELECT wallet, SUM(COALESCE(paid_gp, $2)) AS refund_gp FROM lottery_tickets WHERE round_id = $1 GROUP BY wallet`,
        [lockedRound.id, lockedRound.ticket_price_gp]
      );
      for (const r of ticks.rows) {
        const refund = Number(r.refund_gp);
        if (!Number.isFinite(refund) || refund < 0) throw new Error('Invalid lottery refund');
        await client.query(
          `UPDATE users SET gp_balance = gp_balance + $2 WHERE LOWER(wallet_address) = LOWER($1)`,
          [r.wallet, refund]
        );
      }
      await client.query('COMMIT');
      committed = true;
      console.log(`[LOTTERY] Round #${lockedRound.round_number} cancelled (not enough tickets), refunded`);
    } else {
      // Pick random winner — [v7.64] crypto.randomInt for unpredictable draw
      const { randomInt } = require('crypto');
      const winnerTicket = randomInt(1, totalTickets + 1);
      const winnerRes = await client.query(
        `SELECT wallet FROM lottery_tickets WHERE round_id = $1 AND ticket_number = $2`,
        [lockedRound.id, winnerTicket]
      );
      const winnerWallet = winnerRes.rows[0]?.wallet;

      const prize = parseFloat(lockedRound.prize_pool_gp);

      if (winnerWallet && prize > 0) {
        // Award prize
        await client.query(
          `UPDATE users SET gp_balance = gp_balance + $2 WHERE LOWER(wallet_address) = LOWER($1)`,
          [winnerWallet, prize]
        );
        // Mark winner ticket
        await client.query(
          `UPDATE lottery_tickets SET is_winner = true
            WHERE round_id = $1 AND ticket_number = $2`,
          [lockedRound.id, winnerTicket]
        );
      }

      // Complete round
      await client.query(
        `UPDATE lottery_rounds
            SET status = 'completed', winner_wallet = $2, winning_ticket_number = $3, drawn_at = NOW()
          WHERE id = $1`,
        [lockedRound.id, winnerWallet || null, winnerTicket]
      );

      // A captured house cut must settle with the prize and round status.
      // Do not infer absent house_gp from ticket counts or change prize amounts.
      const houseGp = parseFloat(lockedRound.house_gp) || 0;
      if (houseGp > 0) {
        const divSvc = require('./dividends');
        await divSvc.addToPool(houseGp, 'lottery', client, houseGp, { requireSchema: true });
      }

      await client.query('COMMIT');
      committed = true;

      console.log(`[LOTTERY] Round #${lockedRound.round_number} drawn — winner: ${winnerWallet?.slice(0,8)}... prize: ${prize} GP`);

      // Notifications fire-and-forget
      if (winnerWallet && notifyPlayer) {
        notifyPlayer(winnerWallet, `🎰 You won the lottery! +${Math.round(prize)} GP`, 'lottery').catch(() => {});
      }
      if (logGPActivity && winnerWallet && prize > 0) {
        logGPActivity(winnerWallet, prize, 'lottery_win', `Lottery Round #${lockedRound.round_number}`).catch(() => {});
      }
      if (newsService && winnerWallet) {
        newsService.onLotteryWin(winnerWallet, prize, lockedRound.round_number).catch(() => {});
      }
      if (seasonService && winnerWallet) {
        seasonService.addSeasonScore(winnerWallet, 'gp_earn', Math.round(prize)).catch(() => {});
      }
    }

    return committed;
  } catch (e) {
    if (!committed) await client.query('ROLLBACK');
    console.error(`[LOTTERY] drawRound error for round #${round.round_number}:`, e.message);
    return committed;
  } finally {
    client.release();
  }
}

// ── Queries ───────────────────────────────────────────────────────────────────

async function getHistory(limit = 20) {
  const res = await pool.query(
    `SELECT r.*, u.nickname AS winner_nick
       FROM lottery_rounds r
       LEFT JOIN users u ON u.wallet_address = r.winner_wallet
      WHERE r.status IN ('completed', 'cancelled')
      ORDER BY r.id DESC
      LIMIT $1`,
    [limit]
  );
  return res.rows;
}

async function getMyTickets(wallet, limit = 50) {
  const w = wallet.toLowerCase();
  const res = await pool.query(
    `SELECT t.*, r.round_number, r.status AS round_status,
            r.prize_pool_gp, r.winning_ticket_number AS winner_ticket, r.winner_wallet, r.ends_at, r.ticket_price_gp
       FROM lottery_tickets t
       JOIN lottery_rounds r ON r.id = t.round_id
      WHERE t.wallet = $1
      ORDER BY t.created_at DESC
      LIMIT $2`,
    [w, limit]
  );
  return res.rows;
}

async function getAdminStats() {
  const [totalsRes, activeRes, recentRes, settingsRes] = await Promise.all([
    pool.query(`
      SELECT COUNT(DISTINCT id)                      AS total_rounds,
             COALESCE(SUM(ticket_count), 0)          AS total_tickets,
             COALESCE(SUM(prize_pool_gp), 0)         AS total_prizes_given,
             COALESCE(SUM(house_gp) FILTER (WHERE status='completed'), 0) AS total_house_gp,
             COUNT(*) FILTER (WHERE status='completed' AND winner_wallet IS NOT NULL) AS rounds_with_winner
        FROM lottery_rounds
    `).catch(() => ({ rows: [{}] })),
    pool.query(`SELECT * FROM lottery_rounds WHERE status='open' ORDER BY id DESC LIMIT 1`).catch(() => ({ rows: [] })),
    pool.query(`
      SELECT r.round_number, r.prize_pool_gp, r.ticket_count, r.drawn_at, r.winner_wallet,
             u.nickname AS winner_nick
        FROM lottery_rounds r
        LEFT JOIN users u ON u.wallet_address = r.winner_wallet
       WHERE r.status IN ('completed','cancelled')
       ORDER BY r.id DESC LIMIT 20
    `).catch(() => ({ rows: [] })),
    pool.query(`SELECT key, value FROM settings WHERE key LIKE 'lottery_%' ORDER BY key`).catch(() => ({ rows: [] })),
  ]);

  const settingsMap = {};
  settingsRes.rows.forEach(r => { settingsMap[r.key] = r.value; });
  const t = totalsRes.rows[0] || {};

  return {
    total_rounds:       parseInt(t.total_rounds) || 0,
    total_tickets:      parseInt(t.total_tickets) || 0,
    total_prizes_given: parseFloat(t.total_prizes_given) || 0,
    total_house_gp:     parseFloat(t.total_house_gp) || 0,
    rounds_with_winner: parseInt(t.rounds_with_winner) || 0,
    active_round:       activeRes.rows[0] || null,
    recent_rounds:      recentRes.rows,
    settings:           settingsMap,
  };
}

module.exports = { getCurrentRound, buyTickets, drawExpiredRounds, getHistory, getMyTickets, getAdminStats, createRound };
