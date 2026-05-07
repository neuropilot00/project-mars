// services/rank.js
// Single-user rank recalculation. Mirrors admin/recalc-ranks logic but for one wallet.
// Used by:
//   1. Lazy trigger on hot read paths (e.g. GET /user/:wallet/base)
//   2. Periodic scheduler (server/index.js)
//   3. Admin batch endpoint can also delegate here

const { pool, getSetting } = require('../db');

/**
 * Recalculate rank_level for a single user, evaluating XP threshold + breakthrough conditions.
 * Idempotent. Safe to call frequently (fire-and-forget OK).
 *
 * @param {string} walletAddress
 * @param {object} [opts] { client?: pgClient }  // pass active client to participate in caller transaction
 * @returns {Promise<{oldLevel:number,newLevel:number,xp:number,changed:boolean,gates:Array}|null>}
 */
async function recalcUserRank(walletAddress, opts = {}) {
  if (!walletAddress) return null;
  const w = String(walletAddress).toLowerCase();

  const useExternalClient = !!opts.client;
  const client = opts.client || await pool.connect();
  let ownTransaction = false;
  try {
    if (!useExternalClient) {
      await client.query('BEGIN');
      ownTransaction = true;
    }

    const userRes = await client.query(
      'SELECT xp, rank_level, created_at FROM users WHERE wallet_address = $1',
      [w]
    );
    if (!userRes.rows[0]) {
      if (ownTransaction) await client.query('ROLLBACK');
      return null;
    }
    const user = userRes.rows[0];
    const xp = parseInt(user.xp) || 0;
    const oldLevel = parseInt(user.rank_level) || 1;

    const ranksRes = await client.query('SELECT * FROM rank_definitions ORDER BY level ASC');
    const ranks = ranksRes.rows;

    let newLevel = 1;
    const gates = []; // diagnostic: which gate blocked / passed

    for (const rank of ranks) {
      const required = parseInt(rank.required_xp) || 0;
      if (required > xp) { gates.push({ level: rank.level, blocked: 'xp', need: required, have: xp }); break; }

      if (rank.breakthrough) {
        // Already unlocked?
        const unlocked = await client.query(
          'SELECT 1 FROM user_breakthroughs WHERE wallet_address = $1 AND level = $2',
          [w, rank.level]
        );
        if (!unlocked.rows.length) {
          const cond = rank.breakthrough_condition || {};
          const conditions = cond.conditions || [cond];
          let allMet = true;
          const checked = [];
          for (const c of conditions) {
            let met = false;
            let have = null;
            try {
              if (c.type === 'pixels') {
                const r = await client.query('SELECT COUNT(*)::int AS cnt FROM pixels WHERE owner = $1', [w]);
                have = parseInt(r.rows[0].cnt);
                met = have >= c.min;
              } else if (c.type === 'sectors') {
                const r = await client.query('SELECT COUNT(DISTINCT sector_id)::int AS cnt FROM pixels WHERE owner = $1', [w]);
                have = parseInt(r.rows[0].cnt);
                met = have >= c.min;
              } else if (c.type === 'quests') {
                const r = await client.query("SELECT COUNT(*)::int AS cnt FROM user_quests WHERE wallet = $1 AND status = 'claimed'", [w]);
                have = parseInt(r.rows[0].cnt);
                met = have >= c.min;
              } else if (c.type === 'deposit') {
                const r = await client.query('SELECT COALESCE(SUM(amount),0)::float AS total FROM deposits WHERE wallet_address = $1', [w]);
                have = parseFloat(r.rows[0].total);
                met = have >= c.min;
              } else if (c.type === 'play_days') {
                have = (Date.now() - new Date(user.created_at).getTime()) / (1000 * 60 * 60 * 24);
                met = have >= c.min;
              } else if (c.type === 'hijacks') {
                const r = await client.query("SELECT COUNT(*)::int AS cnt FROM transactions WHERE from_wallet = $1 AND type = 'hijack'", [w]);
                have = parseInt(r.rows[0].cnt);
                met = have >= c.min;
              } else if (c.type === 'games_played') {
                const r = await client.query("SELECT (SELECT COUNT(*) FROM crash_bets WHERE wallet = $1) + (SELECT COUNT(*) FROM mines_games WHERE wallet = $1) AS cnt", [w]);
                have = parseInt(r.rows[0].cnt);
                met = have >= c.min;
              } else if (c.type === 'referrals') {
                const r = await client.query('SELECT COUNT(*)::int AS cnt FROM users WHERE referred_by = (SELECT referral_code FROM users WHERE wallet_address = $1)', [w]);
                have = parseInt(r.rows[0].cnt);
                met = have >= c.min;
              } else {
                met = true; // unknown gate type → permissive
              }
            } catch (gateErr) {
              // Missing table or query error → treat as not-met but don't crash
              met = false;
              checked.push({ type: c.type, error: gateErr.message });
              continue;
            }
            checked.push({ type: c.type, min: c.min, have, met });
            if (!met) { allMet = false; break; }
          }

          if (allMet) {
            await client.query(
              'INSERT INTO user_breakthroughs (wallet_address, level) VALUES ($1, $2) ON CONFLICT DO NOTHING',
              [w, rank.level]
            );
            gates.push({ level: rank.level, breakthrough: 'unlocked', checks: checked });
          } else {
            gates.push({ level: rank.level, blocked: 'breakthrough', checks: checked });
            break;
          }
        }
      }
      newLevel = rank.level;
    }

    let changed = false;
    if (newLevel !== oldLevel) {
      await client.query('UPDATE users SET rank_level = $1 WHERE LOWER(wallet_address) = LOWER($2)', [newLevel, w]);
      changed = true;
    }

    if (ownTransaction) await client.query('COMMIT');
    return { oldLevel, newLevel, xp, changed, gates };
  } catch (err) {
    if (ownTransaction) {
      try { await client.query('ROLLBACK'); } catch (_) {}
    }
    console.error('[rank] recalcUserRank error for', w, ':', err.message);
    return null;
  } finally {
    if (!useExternalClient) client.release();
  }
}

/**
 * Periodic batch recalc — call from scheduler. Limits scope to recently active users
 * by xp delta or last_login_at to avoid full table scan every interval.
 */
async function recalcRecentlyActive() {
  const enabled = String(await getSetting('rank_auto_recalc_enabled', 'true')).toLowerCase();
  if (enabled !== 'true' && enabled !== '1') return { skipped: true };

  const lookbackHours = parseInt(await getSetting('rank_recalc_lookback_hours', '24')) || 24;
  const batchSize = parseInt(await getSetting('rank_recalc_batch_size', '500')) || 500;

  const r = await pool.query(`
    SELECT wallet_address FROM users
    WHERE last_login_at IS NOT NULL
      AND last_login_at > NOW() - INTERVAL '1 hour' * $1
    ORDER BY last_login_at DESC
    LIMIT $2
  `, [lookbackHours, batchSize]);

  let processed = 0, leveledUp = 0;
  for (const row of r.rows) {
    const result = await recalcUserRank(row.wallet_address);
    if (result) {
      processed++;
      if (result.changed) leveledUp++;
    }
  }
  return { processed, leveledUp };
}

module.exports = { recalcUserRank, recalcRecentlyActive };
