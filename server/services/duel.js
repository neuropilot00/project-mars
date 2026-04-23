'use strict';
const pool = require('../db');

// ── helpers ───────────────────────────────────────────────────────────────────
async function getSetting(key, fallback) {
  try {
    const { rows } = await pool.query(
      'SELECT value FROM game_settings WHERE key=$1', [key]);
    if (rows.length) return rows[0].value;
  } catch (_) {}
  return String(fallback);
}

async function getSettings() {
  const keys = [
    'duel_enabled','duel_min_wager','duel_max_wager','duel_fee_pct',
    'duel_expire_minutes','duel_max_pending','duel_cooldown_minutes'
  ];
  const { rows } = await pool.query(
    `SELECT key, value FROM game_settings WHERE key = ANY($1)`, [keys]);
  const map = {};
  rows.forEach(r => { map[r.key] = r.value; });
  return {
    enabled:         (map.duel_enabled         || 'true')  === 'true',
    minWager:        parseFloat(map.duel_min_wager         || '10'),
    maxWager:        parseFloat(map.duel_max_wager         || '5000'),
    feePct:          parseFloat(map.duel_fee_pct           || '5'),
    expireMinutes:   parseInt(map.duel_expire_minutes      || '30', 10),
    maxPending:      parseInt(map.duel_max_pending         || '3',  10),
    cooldownMinutes: parseInt(map.duel_cooldown_minutes    || '5',  10)
  };
}

// ── Battle resolution ─────────────────────────────────────────────────────────
// Lightweight stat-based RNG battle (no DB dependency on battle engine).
// Each side rolls base_power + random(0, 50). Higher wins.
async function resolveDuel(challenger, defender, seed) {
  // Fetch career stats for base power
  async function getStats(w) {
    try {
      const { rows } = await pool.query(
        `SELECT wins, losses, total_pixels_won
         FROM career_stats WHERE wallet = $1`, [w.toLowerCase()]);
      if (rows.length) {
        const s = rows[0];
        return Math.min(50, Math.floor(Number(s.wins || 0) * 0.3 + Number(s.total_pixels_won || 0) * 0.01));
      }
    } catch (_) {}
    return 0;
  }

  const [cBase, dBase] = await Promise.all([getStats(challenger), getStats(defender)]);

  // Seeded random (simple LCG)
  let rng = seed >>> 0;
  function nextInt(max) {
    rng = (Math.imul(1664525, rng) + 1013904223) >>> 0;
    return rng % max;
  }

  const cScore = cBase + nextInt(51);
  const dScore = dBase + nextInt(51);

  let winner = null;
  if (cScore > dScore) winner = challenger.toLowerCase();
  else if (dScore > cScore) winner = defender.toLowerCase();
  // exact tie → no winner (full refund minus fee split)

  return { cScore, dScore, winner };
}

// ── Challenge ─────────────────────────────────────────────────────────────────
async function challenge(challenger, defender, wagerGp) {
  const cLower = challenger.toLowerCase();
  const dLower = defender.toLowerCase();
  if (cLower === dLower) throw new Error('Cannot duel yourself');

  const cfg = await getSettings();
  if (!cfg.enabled) throw new Error('Duels are currently disabled');
  if (wagerGp < cfg.minWager) throw new Error(`Minimum wager is ${cfg.minWager} GP`);
  if (wagerGp > cfg.maxWager) throw new Error(`Maximum wager is ${cfg.maxWager} GP`);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Challenger balance check + lock
    const { rows: balRows } = await client.query(
      'SELECT balance FROM gp_balances WHERE wallet=$1 FOR UPDATE', [cLower]);
    const bal = balRows.length ? Number(balRows[0].balance) : 0;
    if (bal < wagerGp) throw new Error(`Insufficient GP (need ${wagerGp}, have ${bal.toFixed(2)})`);

    // 2. Pending limit
    const { rows: pendRows } = await client.query(
      `SELECT COUNT(*) AS cnt FROM gp_duels
       WHERE challenger=$1 AND status='pending'`, [cLower]);
    if (parseInt(pendRows[0].cnt, 10) >= cfg.maxPending) {
      throw new Error(`You already have ${cfg.maxPending} pending duels`);
    }

    // 3. Cooldown check
    if (cfg.cooldownMinutes > 0) {
      const { rows: coolRows } = await client.query(
        `SELECT id FROM gp_duels
         WHERE challenger=$1 AND defender=$2
           AND created_at > NOW() - ($3 || ' minutes')::INTERVAL
           AND status IN ('pending','accepted')
         LIMIT 1`,
        [cLower, dLower, cfg.cooldownMinutes]
      );
      if (coolRows.length) {
        throw new Error(`Please wait ${cfg.cooldownMinutes} min before re-challenging the same player`);
      }
    }

    // 4. Deduct challenger wager (escrow)
    await client.query(
      'UPDATE gp_balances SET balance = balance - $1 WHERE wallet=$2',
      [wagerGp, cLower]
    );

    // 5. Insert duel
    const expiresAt = new Date(Date.now() + cfg.expireMinutes * 60 * 1000);
    const { rows: duelRows } = await client.query(
      `INSERT INTO gp_duels (challenger, defender, wager_gp, status, expires_at)
       VALUES ($1, $2, $3, 'pending', $4)
       RETURNING *`,
      [cLower, dLower, wagerGp, expiresAt]
    );

    await client.query('COMMIT');

    // Notify defender
    try {
      await pool.query(
        `INSERT INTO player_notifications (wallet, type, message, meta)
         VALUES ($1, 'duel_challenge', $2, $3)`,
        [dLower,
         `⚔️ You've been challenged to a duel! Wager: ${wagerGp} GP`,
         JSON.stringify({ duel_id: duelRows[0].id, challenger: cLower, wager: wagerGp })]
      );
    } catch (_) {}

    return duelRows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ── Accept ────────────────────────────────────────────────────────────────────
async function acceptDuel(duelId, defender) {
  const dLower = defender.toLowerCase();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Load & lock duel
    const { rows: duelRows } = await client.query(
      `SELECT * FROM gp_duels WHERE id=$1 FOR UPDATE`, [duelId]);
    if (!duelRows.length) throw new Error('Duel not found');
    const duel = duelRows[0];

    if (duel.defender !== dLower) throw new Error('Not the challenged player');
    if (duel.status !== 'pending') throw new Error(`Duel is already ${duel.status}`);
    if (new Date(duel.expires_at) < new Date()) throw new Error('Duel challenge expired');

    // Defender balance check + lock
    const { rows: balRows } = await client.query(
      'SELECT balance FROM gp_balances WHERE wallet=$1 FOR UPDATE', [dLower]);
    const bal = balRows.length ? Number(balRows[0].balance) : 0;
    if (bal < Number(duel.wager_gp)) {
      throw new Error(`Insufficient GP (need ${duel.wager_gp}, have ${bal.toFixed(2)})`);
    }

    // Deduct defender wager
    await client.query(
      'UPDATE gp_balances SET balance = balance - $1 WHERE wallet=$2',
      [duel.wager_gp, dLower]
    );

    // Resolve immediately
    const seed = Math.floor(Math.random() * 0xFFFFFFFF);
    const { cScore, dScore, winner } = await resolveDuel(duel.challenger, dLower, seed);

    const cfg = await getSettings();
    const pot = Number(duel.wager_gp) * 2;
    const fee = parseFloat((pot * cfg.feePct / 100).toFixed(6));
    const payout = parseFloat((pot - fee).toFixed(6));

    // Pay winner (or split pot on draw)
    if (winner) {
      await client.query(
        `INSERT INTO gp_balances (wallet, balance) VALUES ($1, $2)
         ON CONFLICT (wallet) DO UPDATE SET balance = gp_balances.balance + EXCLUDED.balance`,
        [winner, payout]
      );
    } else {
      // Draw: refund both minus fee/2 each
      const halfFee  = parseFloat((fee / 2).toFixed(6));
      const refundEach = parseFloat((Number(duel.wager_gp) - halfFee).toFixed(6));
      await client.query(
        `UPDATE gp_balances SET balance = balance + $1 WHERE wallet IN ($2, $3)`,
        [refundEach, duel.challenger, dLower]
      );
    }

    // Settle duel
    await client.query(
      `UPDATE gp_duels
       SET status='resolved', challenger_score=$1, defender_score=$2,
           winner=$3, fee_gp=$4, payout_gp=$5,
           battle_seed=$6, resolved_at=NOW()
       WHERE id=$7`,
      [cScore, dScore, winner, fee, winner ? payout : 0, seed, duelId]
    );

    await client.query('COMMIT');

    // Notifications
    const loser = winner === duel.challenger ? dLower : duel.challenger;
    try {
      if (winner) {
        await pool.query(
          `INSERT INTO player_notifications (wallet, type, message, meta) VALUES ($1,'duel_result',$2,$3)`,
          [winner, `⚔️ Duel WIN +${payout} GP (score ${winner===duel.challenger?cScore:dScore}–${winner===duel.challenger?dScore:cScore})`,
           JSON.stringify({ duel_id: duelId, result: 'win', payout })]
        );
        await pool.query(
          `INSERT INTO player_notifications (wallet, type, message, meta) VALUES ($1,'duel_result',$2,$3)`,
          [loser, `⚔️ Duel LOSS −${duel.wager_gp} GP`,
           JSON.stringify({ duel_id: duelId, result: 'loss' })]
        );
      } else {
        for (const w of [duel.challenger, dLower]) {
          await pool.query(
            `INSERT INTO player_notifications (wallet, type, message, meta) VALUES ($1,'duel_result',$2,$3)`,
            [w, '⚔️ Duel DRAW — partial refund', JSON.stringify({ duel_id: duelId, result: 'draw' })]
          );
        }
      }
    } catch (_) {}

    return { ...duelRows[0], challenger_score: cScore, defender_score: dScore, winner, fee_gp: fee, payout_gp: payout, status: 'resolved' };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ── Decline ───────────────────────────────────────────────────────────────────
async function declineDuel(duelId, defender) {
  const dLower = defender.toLowerCase();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `SELECT * FROM gp_duels WHERE id=$1 FOR UPDATE`, [duelId]);
    if (!rows.length) throw new Error('Duel not found');
    const duel = rows[0];
    if (duel.defender !== dLower) throw new Error('Not the challenged player');
    if (duel.status !== 'pending') throw new Error(`Duel is already ${duel.status}`);

    // Refund challenger
    await client.query(
      'UPDATE gp_balances SET balance = balance + $1 WHERE wallet=$2',
      [duel.wager_gp, duel.challenger]
    );
    await client.query(
      `UPDATE gp_duels SET status='declined' WHERE id=$1`, [duelId]);
    await client.query('COMMIT');

    // Notify challenger
    try {
      await pool.query(
        `INSERT INTO player_notifications (wallet, type, message, meta) VALUES ($1,'duel_declined',$2,$3)`,
        [duel.challenger, '⚔️ Your duel challenge was declined. Wager refunded.',
         JSON.stringify({ duel_id: duelId })]
      );
    } catch (_) {}

    return { ok: true };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ── Cancel (challenger cancels pending duel) ──────────────────────────────────
async function cancelDuel(duelId, challenger) {
  const cLower = challenger.toLowerCase();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `SELECT * FROM gp_duels WHERE id=$1 FOR UPDATE`, [duelId]);
    if (!rows.length) throw new Error('Duel not found');
    const duel = rows[0];
    if (duel.challenger !== cLower) throw new Error('Not the challenger');
    if (duel.status !== 'pending') throw new Error(`Duel is already ${duel.status}`);

    await client.query(
      'UPDATE gp_balances SET balance = balance + $1 WHERE wallet=$2',
      [duel.wager_gp, cLower]
    );
    await client.query(
      `UPDATE gp_duels SET status='cancelled' WHERE id=$1`, [duelId]);
    await client.query('COMMIT');
    return { ok: true };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ── Expire stale pending duels ────────────────────────────────────────────────
async function expireDuels() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `UPDATE gp_duels SET status='expired'
       WHERE status='pending' AND expires_at < NOW()
       RETURNING *`
    );
    // Refund challengers
    for (const d of rows) {
      await client.query(
        'UPDATE gp_balances SET balance = balance + $1 WHERE wallet=$2',
        [d.wager_gp, d.challenger]
      );
      // Notify challenger
      try {
        await pool.query(
          `INSERT INTO player_notifications (wallet, type, message, meta)
           VALUES ($1,'duel_expired',$2,$3)`,
          [d.challenger, '⚔️ Duel challenge expired — wager refunded',
           JSON.stringify({ duel_id: d.id })]
        );
      } catch (_) {}
    }
    await client.query('COMMIT');
    if (rows.length) console.log(`[Duel] Expired ${rows.length} stale duels`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[Duel] expireDuels error:', err.message);
  } finally {
    client.release();
  }
}

// ── Queries ───────────────────────────────────────────────────────────────────
async function getMyDuels(wallet, limit = 30) {
  const w = wallet.toLowerCase();
  const { rows } = await pool.query(
    `SELECT d.*,
       cn.nickname AS challenger_nick,
       dn.nickname AS defender_nick
     FROM gp_duels d
     LEFT JOIN user_profiles cn ON cn.wallet = d.challenger
     LEFT JOIN user_profiles dn ON dn.wallet = d.defender
     WHERE d.challenger=$1 OR d.defender=$1
     ORDER BY d.created_at DESC LIMIT $2`,
    [w, limit]
  );
  return rows;
}

async function getPendingForMe(wallet) {
  const w = wallet.toLowerCase();
  const { rows } = await pool.query(
    `SELECT d.*,
       cn.nickname AS challenger_nick
     FROM gp_duels d
     LEFT JOIN user_profiles cn ON cn.wallet = d.challenger
     WHERE d.defender=$1 AND d.status='pending' AND d.expires_at > NOW()
     ORDER BY d.created_at DESC`,
    [w]
  );
  return rows;
}

async function getRecentResolved(limit = 20) {
  const { rows } = await pool.query(
    `SELECT d.*,
       cn.nickname AS challenger_nick,
       dn.nickname AS defender_nick
     FROM gp_duels d
     LEFT JOIN user_profiles cn ON cn.wallet = d.challenger
     LEFT JOIN user_profiles dn ON dn.wallet = d.defender
     WHERE d.status='resolved'
     ORDER BY d.resolved_at DESC LIMIT $1`,
    [limit]
  );
  return rows;
}

async function getAdminStats() {
  const [totals, recent, settings] = await Promise.all([
    pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE status='resolved') AS total_resolved,
         COUNT(*) FILTER (WHERE status='pending')  AS total_pending,
         COUNT(*) FILTER (WHERE status='expired')  AS total_expired,
         COUNT(*) FILTER (WHERE status='declined') AS total_declined,
         COALESCE(SUM(fee_gp) FILTER (WHERE status='resolved'), 0) AS total_fees,
         COALESCE(SUM(wager_gp*2) FILTER (WHERE status='resolved'), 0) AS total_pot
       FROM gp_duels`
    ),
    pool.query(
      `SELECT d.*, cn.nickname AS challenger_nick, dn.nickname AS defender_nick
       FROM gp_duels d
       LEFT JOIN user_profiles cn ON cn.wallet = d.challenger
       LEFT JOIN user_profiles dn ON dn.wallet = d.defender
       ORDER BY d.created_at DESC LIMIT 50`
    ),
    pool.query(
      `SELECT key, value FROM game_settings WHERE category='duel' ORDER BY key`
    )
  ]);
  return { totals: totals.rows[0], recent: recent.rows, settings: settings.rows };
}

module.exports = {
  challenge,
  acceptDuel,
  declineDuel,
  cancelDuel,
  expireDuels,
  getMyDuels,
  getPendingForMe,
  getRecentResolved,
  getAdminStats,
  getSettings
};
