'use strict';
const { pool, getSetting } = require('../db');

const CATEGORIES = ['CONQUEST', 'DISCOVERY', 'LOSS', 'ALLIANCE', 'ACHIEVEMENT', 'LEGACY'];
const CAT_ICONS  = { CONQUEST:'⚔️', DISCOVERY:'🔭', LOSS:'💔', ALLIANCE:'🤝', ACHIEVEMENT:'🏆', LEGACY:'👑' };
const CAT_COLORS = { CONQUEST:'#ef9a9a', DISCOVERY:'#80deea', LOSS:'#90a4ae', ALLIANCE:'#a5d6a7', ACHIEVEMENT:'#ffd54f', LEGACY:'#ce93d8' };

async function getCfg() {
  const [enabled, costGP, titleMax, descMax, cooldownH, feedCount] = await Promise.all([
    getSetting('milestone_enabled',    'true'),
    getSetting('milestone_cost_gp',    '45'),
    getSetting('milestone_title_max',  '50'),
    getSetting('milestone_desc_max',   '200'),
    getSetting('milestone_cooldown_h', '12'),
    getSetting('milestone_feed_count', '30'),
  ]);
  return {
    enabled:    enabled === 'true',
    costGP:     parseInt(costGP,     10),
    titleMax:   parseInt(titleMax,   10),
    descMax:    parseInt(descMax,    10),
    cooldownH:  parseInt(cooldownH,  10),
    feedCount:  parseInt(feedCount,  10),
    categories: CATEGORIES,
    catIcons:   CAT_ICONS,
    catColors:  CAT_COLORS,
  };
}

async function getFeed(limit, category) {
  const cfg = await getCfg();
  const n = limit ? Math.min(parseInt(limit, 10), 100) : cfg.feedCount;
  let q = `
    SELECT m.id, m.wallet, u.nickname AS player_name,
           m.category, m.title, m.description, m.gp_paid, m.created_at
    FROM colony_milestones m
    LEFT JOIN users u ON u.wallet_address = m.wallet
  `;
  const params = [];
  if (category && CATEGORIES.includes(category.toUpperCase())) {
    params.push(category.toUpperCase());
    q += ` WHERE m.category=$${params.length}`;
  }
  params.push(n);
  q += ` ORDER BY m.created_at DESC LIMIT $${params.length}`;
  const { rows } = await pool.query(q, params);
  return rows;
}

async function getMyMilestones(wallet) {
  if (!wallet) throw new Error('wallet required');
  const { rows } = await pool.query(
    `SELECT id, category, title, description, gp_paid, created_at
     FROM colony_milestones WHERE wallet=$1 ORDER BY created_at DESC LIMIT 50`,
    [wallet]
  );
  return rows;
}

async function recordMilestone(wallet, category, title, description) {
  if (!wallet) throw new Error('wallet required');
  if (!title || !title.trim()) throw new Error('title required');
  if (!description || !description.trim()) throw new Error('description required');

  const cfg = await getCfg();
  if (!cfg.enabled) throw new Error('Colony Milestones are disabled');

  const safeCat   = CATEGORIES.includes((category||'').toUpperCase())
    ? category.toUpperCase() : 'ACHIEVEMENT';
  const safeTitle = title.trim().slice(0, cfg.titleMax);
  const safeDesc  = description.trim().slice(0, cfg.descMax);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    if (cfg.cooldownH > 0) {
      const last = await client.query(
        `SELECT created_at FROM colony_milestones WHERE wallet=$1 ORDER BY created_at DESC LIMIT 1`,
        [wallet]
      );
      if (last.rows.length) {
        const elapsed = (Date.now() - new Date(last.rows[0].created_at).getTime()) / 3600000;
        if (elapsed < cfg.cooldownH)
          throw new Error(`Cooldown active — next milestone in ${Math.ceil(cfg.cooldownH - elapsed)}h`);
      }
    }

    const bal = await client.query(
      'SELECT gp_balance FROM users WHERE wallet_address=$1 FOR UPDATE', [wallet]
    );
    if (!bal.rows.length) throw new Error('User not found');
    if (bal.rows[0].gp_balance < cfg.costGP)
      throw new Error(`Insufficient GP (need ${cfg.costGP})`);

    await client.query(
      'UPDATE users SET gp_balance = gp_balance - $1 WHERE wallet_address=$2',
      [cfg.costGP, wallet]
    );
    await client.query(
      `INSERT INTO gp_transactions (wallet, amount, type, note)
       VALUES ($1, $2, 'milestone', $3)`,
      [wallet, -cfg.costGP, `Milestone [${safeCat}]: "${safeTitle}"`]
    );

    const ins = await client.query(
      `INSERT INTO colony_milestones (wallet, category, title, description, gp_paid)
       VALUES ($1, $2, $3, $4, $5) RETURNING id, created_at`,
      [wallet, safeCat, safeTitle, safeDesc, cfg.costGP]
    );

    await client.query('COMMIT');

    try {
      const { logGPActivity } = require('./gpActivity');
      await logGPActivity(wallet, 'spend', cfg.costGP, `milestone [${safeCat}]: ${safeTitle}`);
    } catch(_) {}
    try {
      const seasonService = require('./season');
      await seasonService.trackGPSpend(wallet, cfg.costGP, 'milestone');
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
      (SELECT COUNT(*) FROM colony_milestones)                                             AS total,
      (SELECT SUM(gp_paid) FROM colony_milestones)                                        AS total_gp,
      (SELECT COUNT(*) FROM colony_milestones WHERE created_at > NOW()-INTERVAL '24h')    AS posted_24h,
      (SELECT COUNT(DISTINCT wallet) FROM colony_milestones)                              AS unique_authors
  `);
  const byCat = await pool.query(
    `SELECT category, COUNT(*) AS cnt, SUM(gp_paid) AS gp FROM colony_milestones GROUP BY category ORDER BY cnt DESC`
  );
  const recent = await pool.query(`
    SELECT m.id, m.wallet, u.nickname, m.category, m.title,
           LEFT(m.description,80) AS preview, m.gp_paid, m.created_at
    FROM colony_milestones m
    LEFT JOIN users u ON u.wallet_address = m.wallet
    ORDER BY m.created_at DESC LIMIT 20
  `);
  return { stats: rows[0], byCat: byCat.rows, recent: recent.rows };
}

async function adminDeleteMilestone(id) {
  await pool.query('DELETE FROM colony_milestones WHERE id=$1', [id]);
  return { success: true };
}

module.exports = {
  getCfg, getFeed, getMyMilestones, recordMilestone,
  getAdminStats, adminDeleteMilestone,
  CATEGORIES, CAT_ICONS, CAT_COLORS
};
