'use strict';
const { pool, getSetting } = require('../db');
let seasonService; try { seasonService = require('./season'); } catch(_) {}

async function getCfg() {
  const [enabled, costGP, minOpts, maxOpts, maxQ, maxDur, minDur, maxActive, cooldownH] = await Promise.all([
    getSetting('poll_enabled',          'true'),
    getSetting('poll_cost_gp',          '40'),
    getSetting('poll_min_options',      '2'),
    getSetting('poll_max_options',      '6'),
    getSetting('poll_max_question_len', '200'),
    getSetting('poll_max_duration_h',   '168'),
    getSetting('poll_min_duration_h',   '1'),
    getSetting('poll_max_active',       '10'),
    getSetting('poll_cooldown_h',       '2'),
  ]);
  return {
    enabled:   enabled === 'true',
    costGP:    parseInt(costGP, 10),
    minOpts:   parseInt(minOpts, 10),
    maxOpts:   parseInt(maxOpts, 10),
    maxQ:      parseInt(maxQ, 10),
    maxDur:    parseInt(maxDur, 10),
    minDur:    parseInt(minDur, 10),
    maxActive: parseInt(maxActive, 10),
    cooldownH: parseInt(cooldownH, 10),
  };
}

async function getActivePolls(walletOpt) {
  const { rows } = await pool.query(
    `SELECT p.id, p.wallet, COALESCE(u.nickname,p.wallet) AS nickname,
            p.question, p.options, p.gp_cost, p.ends_at,
            p.vote_count, p.created_at
     FROM gp_polls p
     LEFT JOIN users u ON u.wallet=p.wallet
     WHERE p.is_active=true AND p.ends_at > NOW()
     ORDER BY p.vote_count DESC, p.created_at DESC`
  );
  // Attach my_vote if wallet provided
  if (walletOpt) {
    const { rows: votes } = await pool.query(
      `SELECT poll_id, option_idx FROM poll_votes WHERE wallet=$1 AND poll_id = ANY($2::int[])`,
      [walletOpt, rows.map(r => r.id)]
    );
    const voteMap = {};
    votes.forEach(v => { voteMap[v.poll_id] = v.option_idx; });
    return rows.map(r => ({ ...r, my_vote: voteMap[r.id] ?? null }));
  }
  return rows;
}

async function getPollResults(pollId) {
  const { rows } = await pool.query(
    `SELECT option_idx, COUNT(*)::int AS votes FROM poll_votes WHERE poll_id=$1 GROUP BY option_idx`, [pollId]
  );
  return rows;
}

async function createPoll(wallet, { question, options, durationH }) {
  const cfg = await getCfg();
  if (!cfg.enabled) throw new Error('Poll system disabled');
  if (!question || question.length > cfg.maxQ) throw new Error('Invalid question');
  if (!Array.isArray(options) || options.length < cfg.minOpts || options.length > cfg.maxOpts)
    throw new Error(`Need ${cfg.minOpts}–${cfg.maxOpts} options`);
  durationH = Math.max(cfg.minDur, Math.min(cfg.maxDur, parseInt(durationH, 10) || 24));

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const balRow = await client.query('SELECT gp_balance FROM users WHERE wallet=$1 FOR UPDATE', [wallet]);
    if (!balRow.rows.length) throw new Error('User not found');
    if (balRow.rows[0].gp_balance < cfg.costGP) throw new Error(`Need ${cfg.costGP} GP`);

    // Active limit
    const { rows: cnt } = await client.query(
      `SELECT COUNT(*)::int AS n FROM gp_polls WHERE is_active=true AND ends_at>NOW()`
    );
    if (cnt[0].n >= cfg.maxActive) throw new Error('Poll limit reached — wait for others to expire');

    // Cooldown
    const { rows: last } = await client.query(
      `SELECT created_at FROM gp_polls WHERE wallet=$1 ORDER BY created_at DESC LIMIT 1`, [wallet]
    );
    if (last.length) {
      const ms = Date.now() - new Date(last[0].created_at).getTime();
      if (ms < cfg.cooldownH * 3600000) {
        const waitMin = Math.ceil((cfg.cooldownH * 3600000 - ms) / 60000);
        throw new Error(`Cooldown: wait ${waitMin} more minute(s)`);
      }
    }

    await client.query('UPDATE users SET gp_balance = gp_balance - $1 WHERE wallet=$2', [cfg.costGP, wallet]);
    const endsAt = new Date(Date.now() + durationH * 3600000);
    const { rows: [poll] } = await client.query(
      `INSERT INTO gp_polls(wallet, question, options, gp_cost, duration_h, ends_at)
       VALUES($1,$2,$3,$4,$5,$6) RETURNING id`,
      [wallet, question, JSON.stringify(options), cfg.costGP, durationH, endsAt]
    );
    await client.query(
      `INSERT INTO gp_transactions(wallet, amount, type, ref_id, note) VALUES($1,$2,'poll',$3,'Community Poll')`,
      [wallet, -cfg.costGP, poll.id]
    );
    await client.query('COMMIT');
    try { const { logGPActivity } = require('./gpActivity'); await logGPActivity(wallet, -cfg.costGP, 'poll', question.slice(0,30)); } catch(_) {}
    seasonService?.trackGPSpend?.(wallet, cfg.costGP, 'poll').catch(() => {});
    return { id: poll.id, endsAt, costGP: cfg.costGP };
  } catch(e) { await client.query('ROLLBACK'); throw e; }
  finally { client.release(); }
}

async function vote(wallet, pollId, optionIdx) {
  const { rows: [poll] } = await pool.query(
    `SELECT id, options, is_active, ends_at FROM gp_polls WHERE id=$1`, [pollId]
  );
  if (!poll) throw new Error('Poll not found');
  if (!poll.is_active || new Date(poll.ends_at) < new Date()) throw new Error('Poll closed');
  const opts = poll.options;
  if (optionIdx < 0 || optionIdx >= opts.length) throw new Error('Invalid option');

  await pool.query(
    `INSERT INTO poll_votes(poll_id, wallet, option_idx) VALUES($1,$2,$3)
     ON CONFLICT(poll_id, wallet) DO UPDATE SET option_idx=$3, voted_at=NOW()`,
    [pollId, wallet, optionIdx]
  );
  await pool.query(`UPDATE gp_polls SET vote_count=(SELECT COUNT(*) FROM poll_votes WHERE poll_id=$1) WHERE id=$1`, [pollId]);
  return { ok: true };
}

async function expirePolls() {
  const { rowCount } = await pool.query(
    `UPDATE gp_polls SET is_active=false WHERE is_active=true AND ends_at <= NOW()`
  );
  return rowCount;
}

async function getAdminStats() {
  const { rows: [stats] } = await pool.query(
    `SELECT COUNT(*)::int AS total_polls,
            COUNT(CASE WHEN is_active AND ends_at>NOW() THEN 1 END)::int AS active_polls,
            COALESCE(SUM(gp_cost),0)::int AS total_gp_sunk,
            COALESCE(SUM(vote_count),0)::int AS total_votes
     FROM gp_polls`
  );
  const { rows: recent } = await pool.query(
    `SELECT p.id, p.wallet, COALESCE(u.nickname,p.wallet) AS nickname,
            p.question, p.gp_cost, p.vote_count, p.ends_at, p.is_active
     FROM gp_polls p LEFT JOIN users u ON u.wallet=p.wallet
     ORDER BY p.created_at DESC LIMIT 20`
  );
  return { stats, recent };
}

module.exports = { getCfg, getActivePolls, getPollResults, createPoll, vote, expirePolls, getAdminStats };
