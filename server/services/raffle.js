'use strict';
const { pool, getSetting } = require('../db');

async function getCfg() {
  const [enabled, maxPP, minCost, houseCut, autoDraw, minDraw] = await Promise.all([
    getSetting('raffle_enabled', 'true'),
    getSetting('raffle_max_tickets_pp', '100'),
    getSetting('raffle_min_cost_gp', '5'),
    getSetting('raffle_house_cut_pct', '10'),
    getSetting('raffle_auto_draw', 'true'),
    getSetting('raffle_min_tickets_draw', '1'),
  ]);
  return {
    enabled: enabled === 'true',
    maxTicketsPerPlayer: parseInt(maxPP) || 100,
    minCostGp: parseInt(minCost) || 5,
    houseCutPct: parseInt(houseCut) || 10,
    autoDraw: autoDraw === 'true',
    minTicketsDraw: parseInt(minDraw) || 1,
  };
}

async function getOpenRaffles() {
  const r = await pool.query(
    `SELECT * FROM raffles WHERE status='open' AND ends_at > NOW() ORDER BY ends_at ASC`
  );
  return r.rows;
}

async function getRaffle(id) {
  const r = await pool.query(`SELECT * FROM raffles WHERE id=$1`, [id]);
  return r.rows[0] || null;
}

async function getMyEntries(wallet) {
  const r = await pool.query(
    `SELECT e.*, rf.title, rf.icon, rf.status, rf.winner_wallet, rf.ticket_cost_gp, rf.ends_at
       FROM raffle_entries e
       JOIN raffles rf ON rf.id = e.raffle_id
       WHERE LOWER(e.wallet)=LOWER($1)
       ORDER BY e.created_at DESC LIMIT 20`,
    [wallet]
  );
  return r.rows;
}

async function getEntrants(raffleId) {
  const r = await pool.query(
    `SELECT e.wallet, e.tickets, u.nickname
       FROM raffle_entries e
       LEFT JOIN users u ON LOWER(e.wallet)=LOWER(u.wallet_address)
       WHERE e.raffle_id=$1
       ORDER BY e.tickets DESC`,
    [raffleId]
  );
  return r.rows;
}

async function buyTickets(wallet, raffleId, count) {
  if (!Number.isInteger(count) || count < 1) throw new Error('Invalid ticket count');
  const cfg = await getCfg();
  if (!cfg.enabled) throw new Error('Raffle system disabled');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Lock raffle
    const rfRes = await client.query(
      `SELECT * FROM raffles WHERE id=$1 AND status='open' FOR UPDATE`,
      [raffleId]
    );
    if (!rfRes.rows.length) throw new Error('Raffle not found or no longer open');
    const rf = rfRes.rows[0];
    if (new Date(rf.ends_at) <= new Date()) throw new Error('Raffle has ended');

    // Max tickets check
    const existRes = await client.query(
      `SELECT COALESCE(SUM(tickets),0) AS total FROM raffle_entries WHERE raffle_id=$1 AND LOWER(wallet)=LOWER($2)`,
      [raffleId, wallet]
    );
    const alreadyOwned = parseInt(existRes.rows[0].total) || 0;
    if (alreadyOwned + count > cfg.maxTicketsPerPlayer) {
      throw new Error(`Max ${cfg.maxTicketsPerPlayer} tickets per player (you have ${alreadyOwned})`);
    }

    // Max total tickets
    if (rf.max_tickets && rf.tickets_sold + count > rf.max_tickets) {
      const avail = rf.max_tickets - rf.tickets_sold;
      throw new Error(`Only ${avail} ticket(s) remaining`);
    }

    const gpCost = rf.ticket_cost_gp * count;
    const houseCut = Math.floor(gpCost * cfg.houseCutPct / 100);
    const toPrize = gpCost - houseCut;

    // User balance
    const userRes = await client.query(
      `SELECT gp_balance FROM users WHERE LOWER(wallet_address)=LOWER($1) FOR UPDATE`,
      [wallet]
    );
    if (!userRes.rows.length) throw new Error('User not found');
    if (userRes.rows[0].gp_balance < gpCost) throw new Error('Insufficient GP');

    // Deduct GP
    await client.query(
      `UPDATE users SET gp_balance = gp_balance - $1 WHERE LOWER(wallet_address)=LOWER($2)`,
      [gpCost, wallet]
    );
    await client.query(
      `INSERT INTO gp_transactions (wallet, amount, transaction_type, description)
       VALUES ($1, $2, 'raffle_ticket', $3)`,
      [wallet, -gpCost, `Bought ${count} ticket(s) for raffle #${raffleId}: ${rf.title}`]
    );

    // Add to prize pool
    await client.query(
      `UPDATE raffles SET tickets_sold = tickets_sold + $1, prize_pool_gp = prize_pool_gp + $2 WHERE id=$3`,
      [count, toPrize, raffleId]
    );

    // Upsert entry
    const eRes = await client.query(
      `SELECT id FROM raffle_entries WHERE raffle_id=$1 AND LOWER(wallet)=LOWER($2)`,
      [raffleId, wallet]
    );
    if (eRes.rows.length) {
      await client.query(
        `UPDATE raffle_entries SET tickets = tickets + $1, gp_spent = gp_spent + $2 WHERE id=$3`,
        [count, gpCost, eRes.rows[0].id]
      );
    } else {
      await client.query(
        `INSERT INTO raffle_entries (raffle_id, wallet, tickets, gp_spent) VALUES ($1, $2, $3, $4)`,
        [raffleId, wallet, count, gpCost]
      );
    }

    await client.query('COMMIT');

    // Side effects
    try { const { logGPActivity } = require('./gpActivity'); await logGPActivity(wallet, -gpCost, 'raffle_ticket', `Raffle #${raffleId}`); } catch(_) {}
    try { const seasonService = require('./season'); await seasonService.trackGPSpend(wallet, gpCost); } catch(_) {}

    return { success: true, gpCost, count, totalTickets: alreadyOwned + count, prizePool: rf.prize_pool_gp + toPrize };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

async function drawWinner(raffleId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const rfRes = await client.query(
      `SELECT * FROM raffles WHERE id=$1 FOR UPDATE`,
      [raffleId]
    );
    if (!rfRes.rows.length) throw new Error('Raffle not found');
    const rf = rfRes.rows[0];
    if (rf.status !== 'open' && rf.status !== 'drawing') throw new Error('Raffle is not drawable');

    // Set to drawing
    await client.query(`UPDATE raffles SET status='drawing' WHERE id=$1`, [raffleId]);

    // Build ticket pool (each entry contributes ticket count slots)
    const entriesRes = await client.query(
      `SELECT wallet, tickets FROM raffle_entries WHERE raffle_id=$1`,
      [raffleId]
    );
    const entries = entriesRes.rows;
    if (!entries.length || rf.tickets_sold < 1) {
      await client.query(`UPDATE raffles SET status='cancelled' WHERE id=$1`, [raffleId]);
      await client.query('COMMIT');
      return { drawn: false, reason: 'No tickets sold' };
    }

    // Build weighted pool
    let pool2 = [];
    entries.forEach(function(e) {
      for (let i = 0; i < e.tickets; i++) pool2.push(e.wallet);
    });

    // Draw random winner
    const winnerIdx = Math.floor(Math.random() * pool2.length);
    const winnerWallet = pool2[winnerIdx];
    const prizeGp = rf.prize_pool_gp;

    // Award prize
    if (prizeGp > 0) {
      await client.query(
        `UPDATE users SET gp_balance = gp_balance + $1 WHERE LOWER(wallet_address)=LOWER($2)`,
        [prizeGp, winnerWallet]
      );
      await client.query(
        `INSERT INTO gp_transactions (wallet, amount, transaction_type, description)
         VALUES ($1, $2, 'raffle_prize', $3)`,
        [winnerWallet, prizeGp, `Won raffle #${raffleId}: ${rf.title}`]
      );
    }

    await client.query(
      `UPDATE raffles SET status='completed', winner_wallet=$1, winner_ticket=$2 WHERE id=$3`,
      [winnerWallet, winnerIdx + 1, raffleId]
    );

    await client.query('COMMIT');

    try { const { logGPActivity } = require('./gpActivity'); await logGPActivity(winnerWallet, prizeGp, 'raffle_prize', `Raffle #${raffleId} winner`); } catch(_) {}

    return { drawn: true, winner: winnerWallet, prizeGp };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

let _raffleDisabled = false;
async function autoDrawExpired() {
  if (_raffleDisabled) return;
  const cfg = await getCfg();
  if (!cfg.autoDraw) return;
  let expired;
  try {
    expired = await pool.query(
      `SELECT id FROM raffles WHERE status='open' AND ends_at <= NOW()`
    );
  } catch (e) {
    if (e.code === '42P01' || e.code === '42703') {
      _raffleDisabled = true;
      console.log('[RAFFLE] disabled — schema not provisioned');
      return;
    }
    throw e;
  }
  for (const row of expired.rows) {
    try { await drawWinner(row.id); } catch (_) {}
  }
}

// Admin functions
async function adminCreateRaffle(params) {
  const { title, description, icon, ticketCostGp, maxTickets, prizeDesc, houseCutPct, endsAt } = params;
  if (!title || !ticketCostGp || !endsAt) throw new Error('title, ticketCostGp, endsAt required');
  const r = await pool.query(
    `INSERT INTO raffles (title, description, icon, ticket_cost_gp, max_tickets, prize_desc, house_cut_pct, ends_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [title, description||null, icon||'🎟️', ticketCostGp, maxTickets||null, prizeDesc||null, houseCutPct||10, endsAt]
  );
  return r.rows[0];
}

async function adminCancelRaffle(raffleId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const rfRes = await client.query(`SELECT * FROM raffles WHERE id=$1 FOR UPDATE`, [raffleId]);
    if (!rfRes.rows.length) throw new Error('Not found');
    const rf = rfRes.rows[0];
    if (rf.status === 'completed') throw new Error('Already completed');
    // Refund all entrants
    const entries = await client.query(
      `SELECT wallet, gp_spent FROM raffle_entries WHERE raffle_id=$1`, [raffleId]
    );
    for (const e of entries.rows) {
      await client.query(`UPDATE users SET gp_balance = gp_balance + $1 WHERE LOWER(wallet_address)=LOWER($2)`, [e.gp_spent, e.wallet]);
      await client.query(`INSERT INTO gp_transactions (wallet, amount, transaction_type, description) VALUES ($1,$2,'raffle_refund',$3)`,
        [e.wallet, e.gp_spent, `Refund: raffle #${raffleId} cancelled`]);
    }
    await client.query(`UPDATE raffles SET status='cancelled' WHERE id=$1`, [raffleId]);
    await client.query('COMMIT');
    return { ok: true, refunded: entries.rows.length };
  } catch(e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
}

async function getAdminStats() {
  const r = await pool.query(`
    SELECT
      COUNT(*) FILTER (WHERE status='open')      AS open_raffles,
      COUNT(*) FILTER (WHERE status='completed') AS completed,
      COUNT(*) FILTER (WHERE status='cancelled') AS cancelled,
      COALESCE(SUM(prize_pool_gp) FILTER (WHERE status='completed'),0) AS total_prizes_gp,
      COALESCE(SUM(tickets_sold),0) AS total_tickets,
      COUNT(DISTINCT winner_wallet) FILTER (WHERE status='completed') AS unique_winners
    FROM raffles
  `);
  return r.rows[0];
}

module.exports = { getCfg, getOpenRaffles, getRaffle, getMyEntries, getEntrants, buyTickets, drawWinner, autoDrawExpired, adminCreateRaffle, adminCancelRaffle, getAdminStats };
