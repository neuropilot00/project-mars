'use strict';
const { pool, getSetting } = require('../db');

async function getCfg() {
  const [enabled, costGP, titleMax, contentMax, cooldownH, feedCount] = await Promise.all([
    getSetting('journal_enabled',     'true'),
    getSetting('journal_cost_gp',     '60'),
    getSetting('journal_title_max',   '60'),
    getSetting('journal_content_max', '500'),
    getSetting('journal_cooldown_h',  '24'),
    getSetting('journal_feed_count',  '20'),
  ]);
  return {
    enabled:    enabled === 'true',
    costGP:     parseInt(costGP,     10),
    titleMax:   parseInt(titleMax,   10),
    contentMax: parseInt(contentMax, 10),
    cooldownH:  parseInt(cooldownH,  10),
    feedCount:  parseInt(feedCount,  10),
  };
}

async function getFeed(limit) {
  const cfg = await getCfg();
  const n = limit ? Math.min(parseInt(limit, 10), 100) : cfg.feedCount;
  const { rows } = await pool.query(`
    SELECT j.id, j.wallet, u.nickname AS player_name,
           j.title, j.content, j.gp_paid, j.created_at
    FROM colony_journal j
    LEFT JOIN users u ON u.wallet_address = j.wallet
    ORDER BY j.created_at DESC
    LIMIT $1
  `, [n]);
  return rows;
}

async function getMyEntries(wallet) {
  if (!wallet) throw new Error('wallet required');
  const { rows } = await pool.query(`
    SELECT id, title, content, gp_paid, created_at
    FROM colony_journal
    WHERE wallet=$1
    ORDER BY created_at DESC
    LIMIT 50
  `, [wallet]);
  return rows;
}

async function publishEntry(wallet, title, content) {
  if (!wallet) throw new Error('wallet required');
  if (!title || !title.trim()) throw new Error('title required');
  if (!content || !content.trim()) throw new Error('content required');

  const cfg = await getCfg();
  if (!cfg.enabled) throw new Error('Colony Journal is disabled');

  const safeTitle   = title.trim().slice(0, cfg.titleMax);
  const safeContent = content.trim().slice(0, cfg.contentMax);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Cooldown check
    if (cfg.cooldownH > 0) {
      const last = await client.query(
        `SELECT created_at FROM colony_journal
         WHERE wallet=$1 ORDER BY created_at DESC LIMIT 1`,
        [wallet]
      );
      if (last.rows.length) {
        const elapsed = (Date.now() - new Date(last.rows[0].created_at).getTime()) / 3600000;
        if (elapsed < cfg.cooldownH)
          throw new Error(`Cooldown active — next entry in ${Math.ceil(cfg.cooldownH - elapsed)}h`);
      }
    }

    // Deduct GP
    const bal = await client.query(
      'SELECT gp_balance FROM users WHERE wallet_address=$1 FOR UPDATE', [wallet]
    );
    if (!bal.rows.length) throw new Error('User not found');
    if (bal.rows[0].gp_balance < cfg.costGP)
      throw new Error(`Insufficient GP (need ${cfg.costGP})`);

    await client.query(
      'UPDATE users SET gp_balance = gp_balance - $1 WHERE LOWER(wallet_address)=LOWER($2) AND gp_balance >= $1',
      [cfg.costGP, wallet]
    );
    await client.query(
      `INSERT INTO gp_transactions (wallet, amount, type, note)
       VALUES ($1, $2, 'journal', $3)`,
      [wallet, -cfg.costGP, `Colony journal: "${safeTitle}"`]
    );

    const ins = await client.query(
      `INSERT INTO colony_journal (wallet, title, content, gp_paid)
       VALUES ($1, $2, $3, $4) RETURNING id, created_at`,
      [wallet, safeTitle, safeContent, cfg.costGP]
    );

    await client.query('COMMIT');

    try {
      const { logGPActivity } = require('../db');
      await logGPActivity(wallet, 'spend', cfg.costGP, `journal: ${safeTitle}`);
    } catch(_) {}
    try {
      const seasonService = require('./season');
      await seasonService.trackGPSpend(wallet, cfg.costGP, 'journal');
    } catch(_) {}

    return { success: true, id: ins.rows[0].id, costGP: cfg.costGP, createdAt: ins.rows[0].created_at };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

async function getAdminStats() {
  const { rows } = await pool.query(`
    SELECT
      (SELECT COUNT(*) FROM colony_journal)                                          AS total,
      (SELECT SUM(gp_paid) FROM colony_journal)                                     AS total_gp,
      (SELECT COUNT(*) FROM colony_journal WHERE created_at > NOW()-INTERVAL '24h') AS entries_24h,
      (SELECT COUNT(DISTINCT wallet) FROM colony_journal)                           AS unique_authors
  `);
  const recent = await pool.query(`
    SELECT j.id, j.wallet, u.nickname, j.title,
           LEFT(j.content, 80) AS preview, j.gp_paid, j.created_at
    FROM colony_journal j
    LEFT JOIN users u ON u.wallet_address = j.wallet
    ORDER BY j.created_at DESC LIMIT 20
  `);
  return { stats: rows[0], recent: recent.rows };
}

async function adminDeleteEntry(id) {
  await pool.query('DELETE FROM colony_journal WHERE id=$1', [id]);
  return { success: true };
}

module.exports = { getCfg, getFeed, getMyEntries, publishEntry, getAdminStats, adminDeleteEntry };
