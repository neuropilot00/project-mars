'use strict';
const { pool } = require('../db');

async function getSetting(key, fallback) {
  try {
    const { rows } = await pool.query('SELECT value FROM game_settings WHERE key=$1', [key]);
    if (rows.length) return rows[0].value;
  } catch (_) {}
  return String(fallback);
}

// ── Queries ───────────────────────────────────────────────────────────────────
async function getContests(status) {
  let q = 'SELECT * FROM art_contests WHERE 1=1';
  const params = [];
  if (status) { params.push(status); q += ` AND status=$${params.length}`; }
  q += ' ORDER BY created_at DESC LIMIT 20';
  const { rows } = await pool.query(q, params);
  return rows;
}

async function getContest(id) {
  const { rows } = await pool.query('SELECT * FROM art_contests WHERE id=$1', [id]);
  return rows[0] || null;
}

async function getEntries(contestId, wallet) {
  const { rows } = await pool.query(
    `SELECT e.*,
       up.nickname AS submitter_nick,
       $2 IS NOT NULL AND EXISTS(
         SELECT 1 FROM art_votes v
         WHERE v.entry_id=e.id AND LOWER(v.voter)=LOWER($2)
       ) AS i_voted_this,
       $2 IS NOT NULL AND EXISTS(
         SELECT 1 FROM art_votes v2
         WHERE v2.contest_id=e.contest_id AND LOWER(v2.voter)=LOWER($2)
       ) AS i_voted_in_contest
     FROM art_entries e
     LEFT JOIN users up ON LOWER(up.wallet_address) = LOWER(e.wallet)
     WHERE e.contest_id=$1 AND e.is_disqualified=false
     ORDER BY e.vote_count DESC, e.created_at ASC`,
    [contestId, wallet ? wallet.toLowerCase() : null]
  );
  return rows;
}

// ── Submit entry ──────────────────────────────────────────────────────────────
async function submitEntry(wallet, contestId, title, description, imageUrl, claimId) {
  const wLower = wallet.toLowerCase();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Load contest
    const { rows: cRows } = await client.query(
      `SELECT * FROM art_contests WHERE id=$1 FOR UPDATE`, [contestId]);
    if (!cRows.length) throw new Error('Contest not found');
    const contest = cRows[0];
    if (contest.status !== 'open') throw new Error(`Contest is ${contest.status}, not accepting entries`);

    // Entry count limit
    const { rows: countRows } = await client.query(
      `SELECT COUNT(*) AS cnt FROM art_entries WHERE contest_id=$1`, [contestId]);
    if (parseInt(countRows[0].cnt, 10) >= contest.max_entries) {
      throw new Error('Contest has reached maximum entries');
    }

    // Already submitted?
    const { rows: existRows } = await client.query(
      `SELECT id FROM art_entries WHERE contest_id=$1 AND LOWER(wallet)=LOWER($2)`, [contestId, wLower]);
    if (existRows.length) throw new Error('You already have an entry in this contest');

    // GP fee
    const fee = Number(contest.entry_fee_gp);
    if (fee > 0) {
      const { rows: balRows } = await client.query(
        'SELECT gp_balance AS balance FROM users WHERE LOWER(wallet_address)=LOWER($1) FOR UPDATE', [wLower]);
      const bal = balRows.length ? Number(balRows[0].balance) : 0;
      if (bal < fee) throw new Error(`Insufficient GP (need ${fee}, have ${bal.toFixed(2)})`);
      const deductContestEntry = await client.query(
        'UPDATE users SET gp_balance = gp_balance - $1 WHERE LOWER(wallet_address)=LOWER($2) AND gp_balance >= $1', [fee, wLower]);
      if (deductContestEntry.rowCount === 0) throw new Error('INSUFFICIENT_GP');
      // Add to prize pool
      await client.query(
        'UPDATE art_contests SET prize_pool_gp = prize_pool_gp + $1 WHERE id=$2',
        [fee, contestId]);
    }

    const { rows: entryRows } = await client.query(
      `INSERT INTO art_entries
         (contest_id, wallet, title, description, image_url, claim_id, gp_paid)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING *`,
      [contestId, wLower, title || null, description || null,
       imageUrl || null, claimId || null, fee]
    );
    await client.query('COMMIT');
    return entryRows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ── Vote ──────────────────────────────────────────────────────────────────────
async function voteForEntry(voter, entryId) {
  const vLower = voter.toLowerCase();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: entryRows } = await client.query(
      `SELECT e.*, c.status AS contest_status, c.voting_end, c.vote_fee_gp
       FROM art_entries e
       JOIN art_contests c ON c.id = e.contest_id
       WHERE e.id=$1 FOR UPDATE`, [entryId]);
    if (!entryRows.length) throw new Error('Entry not found');
    const entry = entryRows[0];
    if (entry.contest_status !== 'voting') throw new Error('Contest is not in voting phase');
    if (entry.is_disqualified) throw new Error('Entry is disqualified');
    if (entry.wallet.toLowerCase() === vLower) throw new Error('Cannot vote for your own entry');
    if (new Date(entry.voting_end) < new Date()) throw new Error('Voting has ended');

    // One vote per contest
    const { rows: dupRows } = await client.query(
      `SELECT id FROM art_votes WHERE contest_id=$1 AND LOWER(voter)=LOWER($2)`,
      [entry.contest_id, vLower]);
    if (dupRows.length) throw new Error('You have already voted in this contest');

    // Vote fee
    const fee = Number(entry.vote_fee_gp);
    if (fee > 0) {
      const { rows: balRows } = await client.query(
        'SELECT gp_balance AS balance FROM users WHERE LOWER(wallet_address)=LOWER($1) FOR UPDATE', [vLower]);
      const bal = balRows.length ? Number(balRows[0].balance) : 0;
      if (bal < fee) throw new Error(`Insufficient GP (need ${fee} to vote)`);
      const deductContestVote = await client.query(
        'UPDATE users SET gp_balance = gp_balance - $1 WHERE LOWER(wallet_address)=LOWER($2) AND gp_balance >= $1', [fee, vLower]);
      if (deductContestVote.rowCount === 0) throw new Error('INSUFFICIENT_GP');
      await client.query(
        'UPDATE art_contests SET prize_pool_gp = prize_pool_gp + $1 WHERE id=$2',
        [fee, entry.contest_id]);
    }

    await client.query(
      `INSERT INTO art_votes (contest_id, entry_id, voter, gp_paid)
       VALUES ($1,$2,$3,$4)`,
      [entry.contest_id, entryId, vLower, fee]);
    await client.query(
      `UPDATE art_entries SET vote_count = vote_count + 1 WHERE id=$1`, [entryId]);

    await client.query('COMMIT');
    return { ok: true };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ── Finalize contest (admin triggered OR scheduled) ───────────────────────────
async function finalizeContest(contestId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: cRows } = await client.query(
      `SELECT * FROM art_contests WHERE id=$1 FOR UPDATE`, [contestId]);
    if (!cRows.length) throw new Error('Contest not found');
    const contest = cRows[0];
    if (contest.status === 'finished') throw new Error('Contest already finished');

    // Top 3 by vote count
    const { rows: top3 } = await client.query(
      `SELECT id, wallet, vote_count FROM art_entries
       WHERE contest_id=$1 AND is_disqualified=false
       ORDER BY vote_count DESC, created_at ASC
       LIMIT 3`,
      [contestId]
    );

    const pool_gp = Number(contest.prize_pool_gp);
    const pcts = [contest.prize_1st_pct, contest.prize_2nd_pct, contest.prize_3rd_pct];

    for (let i = 0; i < top3.length; i++) {
      const entry = top3[i];
      const prize = parseFloat((pool_gp * pcts[i] / 100).toFixed(6));
      if (prize > 0) {
        await client.query(
          `UPDATE users SET gp_balance = gp_balance + $2 WHERE LOWER(wallet_address) = LOWER($1)`,
          [entry.wallet, prize]
        );
        await client.query(
          `UPDATE art_entries SET rank=$1, prize_paid=$2 WHERE id=$3`,
          [i + 1, prize, entry.id]
        );
        try {
          await pool.query(
            `INSERT INTO player_notifications (wallet, type, message, meta)
             VALUES ($1,'contest_winner',$2,$3)`,
            [entry.wallet,
             `🏆 Contest "${contest.title}": #${i+1} place! +${prize} GP`,
             JSON.stringify({ contest_id: contestId, rank: i+1, prize })]
          );
        } catch (_) {}
      }
    }

    await client.query(
      `UPDATE art_contests SET status='finished' WHERE id=$1`, [contestId]);
    await client.query('COMMIT');
    return { ok: true, winners: top3.map((e, i) => ({ ...e, rank: i+1 })) };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ── Auto-advance contest statuses ─────────────────────────────────────────────
async function advanceContestStatuses() {
  const now = new Date();
  // upcoming → open when submission_start passed
  await pool.query(
    `UPDATE art_contests SET status='open'
     WHERE status='upcoming' AND submission_start <= $1`, [now]);
  // open → voting when submission_end passed
  await pool.query(
    `UPDATE art_contests SET status='voting'
     WHERE status='open' AND submission_end <= $1`, [now]);
  // voting → auto-finalize when voting_end passed
  const { rows: toFinish } = await pool.query(
    `SELECT id FROM art_contests
     WHERE status='voting' AND voting_end <= $1`, [now]);
  for (const c of toFinish) {
    try { await finalizeContest(c.id); } catch (e) {
      console.warn(`[Contest] auto-finalize #${c.id} failed:`, e.message);
    }
  }
}

// ── Admin CRUD ────────────────────────────────────────────────────────────────
async function adminCreateContest(data) {
  const seedGp = parseFloat(await getSetting('contest_admin_seed_gp', '500'));
  const { rows } = await pool.query(
    `INSERT INTO art_contests
       (title, description, theme, entry_fee_gp, vote_fee_gp, prize_pool_gp,
        prize_1st_pct, prize_2nd_pct, prize_3rd_pct, max_entries,
        status, submission_start, submission_end, voting_end, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
     RETURNING *`,
    [
      data.title, data.description || null, data.theme || null,
      data.entry_fee_gp ?? 20, data.vote_fee_gp ?? 0,
      data.prize_pool_gp ?? seedGp,
      data.prize_1st_pct ?? 60, data.prize_2nd_pct ?? 25, data.prize_3rd_pct ?? 15,
      data.max_entries ?? 50,
      data.status || 'upcoming',
      data.submission_start, data.submission_end, data.voting_end,
      data.created_by || 'admin'
    ]
  );
  return rows[0];
}

async function adminUpdateContest(id, data) {
  const allowed = ['title','description','theme','entry_fee_gp','vote_fee_gp','prize_pool_gp',
    'prize_1st_pct','prize_2nd_pct','prize_3rd_pct','max_entries','status',
    'submission_start','submission_end','voting_end'];
  const fields = []; const vals = []; let idx = 1;
  for (const k of allowed) {
    if (data[k] !== undefined) { fields.push(`${k}=$${idx++}`); vals.push(data[k]); }
  }
  if (!fields.length) throw new Error('No fields to update');
  vals.push(id);
  const { rows } = await pool.query(
    `UPDATE art_contests SET ${fields.join(',')} WHERE id=$${idx} RETURNING *`, vals);
  return rows[0];
}

async function adminDisqualifyEntry(entryId, reason) {
  await pool.query(
    `UPDATE art_entries SET is_disqualified=true WHERE id=$1`, [entryId]);
}

async function getAdminStats() {
  const [totals, contests, settings] = await Promise.all([
    pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE status='open')     AS open_contests,
         COUNT(*) FILTER (WHERE status='voting')   AS voting_contests,
         COUNT(*) FILTER (WHERE status='finished') AS finished_contests,
         COALESCE(SUM(prize_pool_gp),0)            AS total_prize_pools,
         COALESCE((SELECT SUM(prize_paid) FROM art_entries),0) AS total_prizes_paid,
         (SELECT COUNT(*) FROM art_entries)        AS total_entries,
         (SELECT COUNT(*) FROM art_votes)          AS total_votes
       FROM art_contests`
    ),
    pool.query('SELECT * FROM art_contests ORDER BY created_at DESC LIMIT 20'),
    pool.query(`SELECT key, value FROM game_settings WHERE category='contest' ORDER BY key`)
  ]);
  return { totals: totals.rows[0], contests: contests.rows, settings: settings.rows };
}

module.exports = {
  getContests, getContest, getEntries,
  submitEntry, voteForEntry, finalizeContest, advanceContestStatuses,
  adminCreateContest, adminUpdateContest, adminDisqualifyEntry, getAdminStats
};
