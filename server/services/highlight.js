'use strict';
const { pool, getSetting } = require('../db');

// Allowed highlight colors (safe set)
const ALLOWED_COLORS = [
  '#ff7840','#e84855','#ffd166','#06d6a0','#5bb8e8',
  '#c088e0','#f48fb1','#80deea','#a5d6a7','#ffcc80',
  '#ffffff','#ff6b6b','#4ecdc4','#45b7d1','#96ceb4',
];

async function getCfg() {
  const [enabled, costGP, durH, maxActive] = await Promise.all([
    getSetting('highlight_enabled',    'true'),
    getSetting('highlight_cost_gp',    '40'),
    getSetting('highlight_duration_h', '24'),
    getSetting('highlight_max_active', '50'),
  ]);
  return {
    enabled:   enabled === 'true',
    costGP:    parseInt(costGP,    10),
    durH:      parseInt(durH,      10),
    maxActive: parseInt(maxActive, 10),
    colors:    ALLOWED_COLORS,
  };
}

async function expireHighlights() {
  const { rows } = await pool.query(
    `UPDATE territory_highlights SET is_active=false
     WHERE is_active=true AND expires_at <= NOW()
     RETURNING id`
  );
  return rows;
}

async function getActiveHighlights() {
  const { rows } = await pool.query(`
    SELECT h.claim_id, h.color, h.expires_at
    FROM territory_highlights h
    WHERE h.is_active = true AND h.expires_at > NOW()
    ORDER BY h.expires_at ASC
  `);
  return rows;
}

async function getClaimHighlight(claimId) {
  const { rows } = await pool.query(`
    SELECT h.claim_id, h.color, h.expires_at, h.gp_paid_total, h.is_active
    FROM territory_highlights h
    WHERE h.claim_id = $1 AND h.is_active = true AND h.expires_at > NOW()
  `, [claimId]);
  return rows[0] || null;
}

async function setHighlight(wallet, claimId, color) {
  if (!wallet) throw new Error('wallet required');
  if (!claimId) throw new Error('claimId required');

  const cfg = await getCfg();
  if (!cfg.enabled) throw new Error('Highlight system is disabled');

  // Validate color
  const safeColor = color && ALLOWED_COLORS.includes(color) ? color : ALLOWED_COLORS[0];

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Verify ownership
    const claimRes = await client.query(
      'SELECT id, owner FROM claims WHERE id=$1 AND deleted_at IS NULL', [claimId]
    );
    if (!claimRes.rows.length) throw new Error('Territory not found');
    if (claimRes.rows[0].owner !== wallet) throw new Error('Not your territory');

    // Check global cap (only applies when setting a new highlight)
    const existing = await client.query(
      'SELECT id FROM territory_highlights WHERE claim_id=$1', [claimId]
    );
    if (!existing.rows.length) {
      const activeCount = await client.query(
        'SELECT COUNT(*) FROM territory_highlights WHERE is_active=true AND expires_at>NOW()'
      );
      if (parseInt(activeCount.rows[0].count, 10) >= cfg.maxActive)
        throw new Error(`Global highlight limit reached (${cfg.maxActive})`);
    }

    // Deduct GP
    const bal = await client.query(
      'SELECT gp_balance FROM users WHERE LOWER(wallet_address)=LOWER($1) FOR UPDATE', [wallet]
    );
    if (!bal.rows.length) throw new Error('User not found');
    if (bal.rows[0].gp_balance < cfg.costGP)
      throw new Error(`Insufficient GP (need ${cfg.costGP})`);

    const deductHighlight = await client.query(
      'UPDATE users SET gp_balance = gp_balance - $1 WHERE LOWER(wallet_address) = LOWER($2) AND gp_balance >= $1',
      [cfg.costGP, wallet]
    );
    if (deductHighlight.rowCount === 0) throw new Error('INSUFFICIENT_GP');
    await client.query(
      `INSERT INTO gp_transactions (wallet, amount, type, note)
       VALUES ($1, $2, 'highlight', $3)`,
      [wallet, -cfg.costGP, `Highlight claim #${claimId}`]
    );

    // Upsert highlight (extend if exists)
    const expiresAt = new Date(Date.now() + cfg.durH * 3600 * 1000);
    await client.query(
      `INSERT INTO territory_highlights (claim_id, wallet, color, gp_paid_total, expires_at, is_active, updated_at)
       VALUES ($1, $2, $3, $4, $5, true, NOW())
       ON CONFLICT (claim_id) DO UPDATE
         SET color = EXCLUDED.color,
             gp_paid_total = territory_highlights.gp_paid_total + $4,
             expires_at = $5,
             is_active = true,
             updated_at = NOW()`,
      [claimId, wallet, safeColor, cfg.costGP, expiresAt]
    );

    await client.query('COMMIT');

    try {
      const { logGPActivity } = require('../db');
      await logGPActivity(wallet, 'spend', cfg.costGP, `highlight claim#${claimId}`);
    } catch(_) {}
    try {
      const seasonService = require('./season');
      await seasonService.trackGPSpend(wallet, cfg.costGP, 'highlight');
    } catch(_) {}

    return { success: true, color: safeColor, expiresAt, costGP: cfg.costGP };
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
      (SELECT COUNT(*) FROM territory_highlights)                                              AS total,
      (SELECT COUNT(*) FROM territory_highlights WHERE is_active=true AND expires_at>NOW())    AS active,
      (SELECT SUM(gp_paid_total) FROM territory_highlights)                                    AS total_gp,
      (SELECT COUNT(*) FROM territory_highlights WHERE created_at > NOW()-INTERVAL '24h')      AS created_24h
  `);
  const recent = await pool.query(`
    SELECT h.id, h.claim_id, h.wallet, u.nickname,
           h.color, h.gp_paid_total, h.is_active, h.expires_at
    FROM territory_highlights h
    LEFT JOIN users u ON u.wallet_address = h.wallet
    ORDER BY h.updated_at DESC LIMIT 20
  `);
  return { stats: rows[0], recent: recent.rows };
}

async function adminRemoveHighlight(id) {
  await pool.query('UPDATE territory_highlights SET is_active=false WHERE id=$1', [id]);
  return { success: true };
}

module.exports = { getCfg, expireHighlights, getActiveHighlights, getClaimHighlight, setHighlight, getAdminStats, adminRemoveHighlight, ALLOWED_COLORS };
