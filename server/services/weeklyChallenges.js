'use strict';
/**
 * Weekly Challenge Service — Migration 109
 * Three challenge types:
 *   personal    — solo progress, claim reward on completion
 *   collective  — server-wide progress bar, all participants share reward
 *   competitive — leaderboard race, top 3 win prizes at week end
 */

const { pool } = require('../db');

let logGPActivity;
try { logGPActivity = require('../db').logGPActivity; } catch (_) {}
let notifyPlayer;
try { notifyPlayer = require('./notifications').notifyPlayer; } catch (_) {}
let seasonService;
try { seasonService = require('./season'); } catch (_) {}
let achSvc;
try { achSvc = require('./achievements'); } catch (_) {}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getWeekBounds(date = new Date()) {
  const d = new Date(date);
  const day = d.getUTCDay(); // 0=Sun, 1=Mon...
  // Align to Monday
  const diff = (day === 0 ? -6 : 1 - day);
  const monday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + diff));
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  return {
    start: monday.toISOString().slice(0, 10),
    end:   sunday.toISOString().slice(0, 10),
  };
}

async function isEnabled() {
  const res = await pool.query(`SELECT value FROM settings WHERE key = 'weekly_challenges_enabled'`);
  return (res.rows[0]?.value || 'true') !== 'false';
}

// ── Ensure instances exist for current week ───────────────────────────────────

async function ensureWeekInstances() {
  const { start, end } = getWeekBounds();
  let defs;
  try {
    defs = await pool.query(
      `SELECT id FROM weekly_challenge_defs WHERE active = true`
    );
  } catch (e) {
    // Tables not provisioned on this deployment (archived migration 109). Skip silently.
    if (e.code === '42P01' || e.code === '42703') return;
    throw e;
  }
  for (const d of defs.rows) {
    try {
      await pool.query(
        `INSERT INTO weekly_challenge_instances (challenge_def_id, week_start, week_end)
         VALUES ($1, $2, $3) ON CONFLICT (challenge_def_id, week_start) DO NOTHING`,
        [d.id, start, end]
      );
    } catch (e) {
      if (e.code === '42P01' || e.code === '42703') return;
      throw e;
    }
  }
}

// ── Get challenges for a wallet ───────────────────────────────────────────────

async function getChallenges(wallet) {
  if (!(await isEnabled())) return { enabled: false, challenges: [] };

  await ensureWeekInstances();
  const { start, end } = getWeekBounds();
  const w = wallet ? wallet.toLowerCase() : null;

  const res = await pool.query(
    `SELECT
       d.*,
       i.id             AS instance_id,
       i.collective_progress,
       i.collective_completed,
       p.progress,
       p.completed      AS user_completed,
       p.reward_claimed,
       p.completed_at   AS user_completed_at
     FROM weekly_challenge_defs d
     JOIN weekly_challenge_instances i
       ON i.challenge_def_id = d.id AND i.week_start = $1
     LEFT JOIN weekly_challenge_progress p
       ON p.instance_id = i.id AND p.wallet = $2
     WHERE d.active = true
     ORDER BY d.sort_order ASC`,
    [start, w]
  );

  return {
    enabled: true,
    week_start: start,
    week_end: end,
    challenges: res.rows.map(r => ({
      id:                  r.id,
      key:                 r.key,
      challenge_type:      r.challenge_type,
      name:                r.name_en,
      name_ko:             r.name_ko,
      name_ja:             r.name_ja,
      name_zh:             r.name_zh,
      desc:                r.desc_en,
      icon:                r.icon,
      condition_type:      r.condition_type,
      target_value:        r.target_value,
      reward_gp:           r.reward_gp,
      reward_item:         r.reward_item,
      reward_item_qty:     r.reward_item_qty,
      difficulty:          r.difficulty,
      instance_id:         r.instance_id,
      collective_progress: parseInt(r.collective_progress) || 0,
      collective_completed: !!r.collective_completed,
      user_progress:       parseInt(r.progress) || 0,
      user_completed:      !!r.user_completed,
      reward_claimed:      !!r.reward_claimed,
      pct:                 Math.min(100, Math.round(((parseInt(r.progress)||0) / r.target_value) * 100)),
      collective_pct:      Math.min(100, Math.round(((parseInt(r.collective_progress)||0) / r.target_value) * 100)),
    })),
  };
}

// ── Track progress ────────────────────────────────────────────────────────────

/**
 * Add progress to active weekly challenges matching the conditionType.
 * Call fire-and-forget from event hooks.
 * @param {string} wallet
 * @param {string} conditionType - e.g. 'claim_count', 'battle_win_count', 'gp_earn', ...
 * @param {number} delta
 */
async function trackProgress(wallet, conditionType, delta = 1) {
  if (!(await isEnabled())) return;
  const w = wallet.toLowerCase();
  const { start } = getWeekBounds();

  // Find all active challenge instances for this condition type this week
  const challenges = await pool.query(
    `SELECT i.id AS instance_id, d.id AS def_id, d.challenge_type, d.target_value, d.reward_gp, d.key
       FROM weekly_challenge_defs d
       JOIN weekly_challenge_instances i ON i.challenge_def_id = d.id AND i.week_start = $1
      WHERE d.active = true AND d.condition_type = $2`,
    [start, conditionType]
  );
  if (!challenges.rows.length) return;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    for (const ch of challenges.rows) {
      // Upsert player progress
      const upsert = await client.query(
        `INSERT INTO weekly_challenge_progress (instance_id, wallet, progress)
         VALUES ($1, $2, $3)
         ON CONFLICT (instance_id, wallet) DO UPDATE
           SET progress = LEAST(
             weekly_challenge_progress.progress + $3,
             (SELECT target_value FROM weekly_challenge_defs WHERE id = $4)
           )
         RETURNING progress, completed`,
        [ch.instance_id, w, delta, ch.def_id]
      );
      const row = upsert.rows[0];
      const newProgress = parseInt(row.progress);

      // Check if newly completed
      if (!row.completed && newProgress >= ch.target_value) {
        await client.query(
          `UPDATE weekly_challenge_progress SET completed = true, completed_at = NOW()
            WHERE instance_id = $1 AND wallet = $2`,
          [ch.instance_id, w]
        );

        // For collective, update server-wide progress
        if (ch.challenge_type === 'collective') {
          await client.query(
            `UPDATE weekly_challenge_instances
               SET collective_progress = collective_progress + $2
             WHERE id = $1`,
            [ch.instance_id, delta]
          );
        }

        // Notify player
        if (notifyPlayer) {
          notifyPlayer(w, `🎯 Weekly Challenge "${ch.key.replace(/_/g,' ')}" completed! Claim your ${ch.reward_gp} GP reward!`, 'challenge').catch(() => {});
        }
      }

      // For collective, always add to server progress (not just on completion)
      if (ch.challenge_type === 'collective') {
        await client.query(
          `UPDATE weekly_challenge_instances
             SET collective_progress = LEAST(collective_progress + $2, (SELECT target_value FROM weekly_challenge_defs WHERE id = $3))
           WHERE id = $1`,
          [ch.instance_id, delta, ch.def_id]
        );
        // Check if collective now completed
        const collState = await client.query(
          `SELECT ci.collective_progress, d.target_value
             FROM weekly_challenge_instances ci
             JOIN weekly_challenge_defs d ON d.id = ci.challenge_def_id
            WHERE ci.id = $1`,
          [ch.instance_id]
        );
        const cs = collState.rows[0];
        if (cs && !cs.collective_completed && parseInt(cs.collective_progress) >= parseInt(cs.target_value)) {
          await client.query(
            `UPDATE weekly_challenge_instances SET collective_completed = true, completed_at = NOW() WHERE id = $1`,
            [ch.instance_id]
          );
        }
      }
    }

    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    console.warn('[WEEKLY] trackProgress error:', e.message);
  } finally {
    client.release();
  }
}

// ── Claim reward ──────────────────────────────────────────────────────────────

async function claimReward(wallet, instanceId) {
  const w = wallet.toLowerCase();

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Lock progress row
    const pRes = await client.query(
      `SELECT p.*, d.reward_gp, d.challenge_type, d.target_value, d.reward_item, d.reward_item_qty, d.name_en, d.key,
              i.collective_completed, p.progress
         FROM weekly_challenge_progress p
         JOIN weekly_challenge_instances i ON i.id = p.instance_id
         JOIN weekly_challenge_defs d ON d.id = i.challenge_def_id
        WHERE p.instance_id = $1 AND p.wallet = $2
          FOR UPDATE OF p`,
      [instanceId, w]
    );
    if (!pRes.rows.length) throw new Error('No progress record found');
    const row = pRes.rows[0];

    if (row.reward_claimed) throw new Error('Reward already claimed');

    // Eligibility check
    let eligible = false;
    if (row.challenge_type === 'personal') {
      eligible = row.completed;
    } else if (row.challenge_type === 'collective') {
      eligible = row.collective_completed;
    } else if (row.challenge_type === 'competitive') {
      // Competitive claims are handled at week-end by settleCompetitive()
      throw new Error('Competitive rewards are distributed at week end');
    }

    if (!eligible) throw new Error('Challenge not yet completed');

    // Mark claimed
    await client.query(
      `UPDATE weekly_challenge_progress SET reward_claimed = true, claimed_at = NOW()
        WHERE instance_id = $1 AND wallet = $2`,
      [instanceId, w]
    );

    // Award GP
    if (row.reward_gp > 0) {
      await client.query(
        `UPDATE users SET gp_balance = gp_balance + $2 WHERE wallet_address = $1`,
        [w, row.reward_gp]
      );
    }

    await client.query('COMMIT');

    // Fire-and-forget
    if (logGPActivity && row.reward_gp > 0) {
      logGPActivity(w, row.reward_gp, 'weekly_challenge', `${row.name_en} completed`).catch(() => {});
    }
    if (seasonService && row.reward_gp > 0) {
      seasonService.addSeasonScore(w, 'gp_earn', row.reward_gp).catch(() => {});
    }

    return { reward_gp: row.reward_gp, reward_item: row.reward_item, name: row.name_en };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

// ── Settle competitive challenges at week end ─────────────────────────────────

async function settleCompetitiveChallenges() {
  const { start: lastWeekStart, end: lastWeekEnd } = getWeekBounds(new Date(Date.now() - 7 * 24 * 3600 * 1000));

  // Find competitive instances from last week that aren't yet settled
  const instances = await pool.query(
    `SELECT i.id, d.reward_gp, d.name_en, d.key
       FROM weekly_challenge_instances i
       JOIN weekly_challenge_defs d ON d.id = i.challenge_def_id
      WHERE i.week_start = $1 AND d.challenge_type = 'competitive' AND i.collective_completed = false`,
    [lastWeekStart]
  );

  const cfg = await pool.query(`SELECT key, value FROM settings WHERE key IN ('weekly_top_reward_2nd_pct','weekly_top_reward_3rd_pct')`);
  const cfgMap = {};
  cfg.rows.forEach(r => { cfgMap[r.key] = r.value; });
  const pct2 = parseInt(cfgMap.weekly_top_reward_2nd_pct) || 60;
  const pct3 = parseInt(cfgMap.weekly_top_reward_3rd_pct) || 40;

  for (const inst of instances.rows) {
    // Get top 3 by progress
    const top = await pool.query(
      `SELECT wallet, progress FROM weekly_challenge_progress
        WHERE instance_id = $1 AND progress > 0
        ORDER BY progress DESC LIMIT 3`,
      [inst.id]
    );
    if (!top.rows.length) continue;

    const rewards = [inst.reward_gp, Math.round(inst.reward_gp * pct2 / 100), Math.round(inst.reward_gp * pct3 / 100)];

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (let i = 0; i < Math.min(top.rows.length, 3); i++) {
        const w = top.rows[i].wallet;
        const gp = rewards[i];
        if (gp > 0) {
          await client.query(`UPDATE users SET gp_balance = gp_balance + $2 WHERE wallet_address = $1`, [w, gp]);
          await client.query(
            `UPDATE weekly_challenge_progress SET reward_claimed = true, claimed_at = NOW() WHERE instance_id = $1 AND wallet = $2`,
            [inst.id, w]
          );
          if (logGPActivity) logGPActivity(w, gp, 'weekly_competitive', `Top ${i+1} in ${inst.name_en}`).catch(() => {});
          if (notifyPlayer) notifyPlayer(w, `🏆 #${i+1} in ${inst.name_en}! +${gp} GP!`, 'challenge').catch(() => {});
        }
      }
      // Mark settled via collective_completed flag
      await client.query(`UPDATE weekly_challenge_instances SET collective_completed = true WHERE id = $1`, [inst.id]);
      await client.query('COMMIT');
      console.log(`[WEEKLY] Settled competitive: ${inst.key}, top ${top.rows.length} rewarded`);
    } catch (e) {
      await client.query('ROLLBACK');
      console.warn(`[WEEKLY] settleCompetitive error for ${inst.key}:`, e.message);
    } finally {
      client.release();
    }
  }
}

// ── Admin stats ───────────────────────────────────────────────────────────────

async function getAdminStats() {
  const { start, end } = getWeekBounds();
  const [defsRes, instancesRes, progressRes, settingsRes] = await Promise.all([
    pool.query(`SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE active) AS active FROM weekly_challenge_defs`).catch(() => ({ rows: [{}] })),
    pool.query(`SELECT i.*, d.name_en, d.challenge_type, d.target_value FROM weekly_challenge_instances i JOIN weekly_challenge_defs d ON d.id = i.challenge_def_id WHERE i.week_start = $1 ORDER BY d.sort_order`, [start]).catch(() => ({ rows: [] })),
    pool.query(`SELECT COUNT(DISTINCT wallet) AS participants, COUNT(*) FILTER (WHERE completed) AS completions, COUNT(*) FILTER (WHERE reward_claimed) AS claims FROM weekly_challenge_progress p JOIN weekly_challenge_instances i ON i.id = p.instance_id WHERE i.week_start = $1`, [start]).catch(() => ({ rows: [{}] })),
    pool.query(`SELECT key, value FROM settings WHERE key LIKE 'weekly_%' ORDER BY key`).catch(() => ({ rows: [] })),
  ]);

  const settingsMap = {};
  settingsRes.rows.forEach(r => { settingsMap[r.key] = r.value; });

  return {
    week_start:    start,
    week_end:      end,
    defs:          defsRes.rows[0] || {},
    instances:     instancesRes.rows,
    progress_stats: progressRes.rows[0] || {},
    settings:      settingsMap,
  };
}

module.exports = {
  getChallenges,
  trackProgress,
  claimReward,
  ensureWeekInstances,
  settleCompetitiveChallenges,
  getAdminStats,
};
