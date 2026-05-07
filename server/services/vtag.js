'use strict';
const { pool, getSetting } = require('../db');

async function getCfg() {
  const [enabled, firstGP, changeGP, maxLen, clearGP] = await Promise.all([
    getSetting('vtag_enabled',    'true'),
    getSetting('vtag_first_gp',   '50'),
    getSetting('vtag_change_gp',  '25'),
    getSetting('vtag_max_length', '12'),
    getSetting('vtag_clear_gp',   '0'),
  ]);
  return {
    enabled:  enabled === 'true',
    firstGP:  parseInt(firstGP,  10),
    changeGP: parseInt(changeGP, 10),
    maxLen:   parseInt(maxLen,   10),
    clearGP:  parseInt(clearGP,  10),
  };
}

async function getTag(wallet) {
  const { rows } = await pool.query(
    'SELECT tag, gp_paid_total, created_at, updated_at FROM vanity_tags WHERE wallet = $1',
    [wallet]
  );
  return rows[0] || null;
}

async function getBulkTags(wallets) {
  if (!wallets || wallets.length === 0) return {};
  const { rows } = await pool.query(
    'SELECT wallet, tag FROM vanity_tags WHERE wallet = ANY($1)',
    [wallets]
  );
  const map = {};
  for (const r of rows) map[r.wallet] = r.tag;
  return map;
}

async function setTag(wallet, tag) {
  if (!wallet) throw new Error('wallet required');

  const cfg = await getCfg();
  if (!cfg.enabled) throw new Error('Vanity tag system is disabled');

  if (!tag || typeof tag !== 'string') throw new Error('tag required');
  const trimmed = tag.trim();
  if (trimmed.length === 0) throw new Error('tag cannot be empty');
  if (trimmed.length > cfg.maxLen) throw new Error(`tag too long (max ${cfg.maxLen} chars)`);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const existing = await client.query(
      'SELECT tag FROM vanity_tags WHERE wallet = $1',
      [wallet]
    );
    const isNew    = existing.rows.length === 0;
    const gpCost   = isNew ? cfg.firstGP : cfg.changeGP;
    const oldTag   = isNew ? null : existing.rows[0].tag;

    if (gpCost > 0) {
      const bal = await client.query(
        'SELECT gp_balance FROM users WHERE LOWER(wallet_address) = LOWER($1) FOR UPDATE', [wallet]
      );
      if (!bal.rows.length) throw new Error('User not found');
      if (bal.rows[0].gp_balance < gpCost)
        throw new Error(`Insufficient GP (need ${gpCost})`);

      const vtagDeduct1 = await client.query(
        'UPDATE users SET gp_balance = gp_balance - $1 WHERE LOWER(wallet_address) = LOWER($2) AND gp_balance >= $1',
        [gpCost, wallet]
      );
      if (vtagDeduct1.rowCount === 0) throw new Error('INSUFFICIENT_GP');
      await client.query(
        `INSERT INTO gp_transactions (wallet, amount, type, note)
         VALUES ($1, $2, 'vtag_set', $3)`,
        [wallet, -gpCost, `Set vanity tag: ${trimmed}`]
      );
    }

    await client.query(
      `INSERT INTO vanity_tags (wallet, tag, gp_paid_total, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (wallet) DO UPDATE
         SET tag = EXCLUDED.tag,
             gp_paid_total = vanity_tags.gp_paid_total + $3,
             updated_at = NOW()`,
      [wallet, trimmed, gpCost]
    );

    await client.query(
      `INSERT INTO vtag_log (wallet, old_tag, new_tag, gp_cost)
       VALUES ($1, $2, $3, $4)`,
      [wallet, oldTag, trimmed, gpCost]
    );

    await client.query('COMMIT');

    try {
      const { logGPActivity } = require('../db');
      if (gpCost > 0) await logGPActivity(wallet, 'spend', gpCost, `vtag: ${trimmed}`);
    } catch(_) {}
    try {
      const seasonService = require('./season');
      if (gpCost > 0) await seasonService.trackGPSpend(wallet, gpCost, 'vtag_set');
    } catch(_) {}

    return { success: true, tag: trimmed, gpCost, isNew };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

async function clearTag(wallet) {
  if (!wallet) throw new Error('wallet required');

  const cfg = await getCfg();
  if (!cfg.enabled) throw new Error('Vanity tag system is disabled');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const existing = await client.query(
      'SELECT tag FROM vanity_tags WHERE wallet = $1', [wallet]
    );
    if (!existing.rows.length) throw new Error('No vanity tag set');

    const oldTag = existing.rows[0].tag;
    const gpCost = cfg.clearGP;

    if (gpCost > 0) {
      const bal = await client.query(
        'SELECT gp_balance FROM users WHERE LOWER(wallet_address) = LOWER($1) FOR UPDATE', [wallet]
      );
      if (!bal.rows.length) throw new Error('User not found');
      if (bal.rows[0].gp_balance < gpCost)
        throw new Error(`Insufficient GP (need ${gpCost})`);

      const vtagDeduct2 = await client.query(
        'UPDATE users SET gp_balance = gp_balance - $1 WHERE LOWER(wallet_address) = LOWER($2) AND gp_balance >= $1',
        [gpCost, wallet]
      );
      if (vtagDeduct2.rowCount === 0) throw new Error('INSUFFICIENT_GP');
    }

    await client.query('DELETE FROM vanity_tags WHERE wallet = $1', [wallet]);
    await client.query(
      `INSERT INTO vtag_log (wallet, old_tag, new_tag, gp_cost)
       VALUES ($1, $2, '', $3)`,
      [wallet, oldTag, gpCost]
    );

    await client.query('COMMIT');
    return { success: true, gpCost };
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
      (SELECT COUNT(*)              FROM vanity_tags)                                    AS total_tags,
      (SELECT SUM(gp_paid_total)    FROM vanity_tags)                                    AS total_gp_burned,
      (SELECT COUNT(*)              FROM vtag_log WHERE created_at > NOW()-INTERVAL '24h') AS sets_24h,
      (SELECT COUNT(*)              FROM vtag_log)                                       AS total_changes
  `);
  const recent = await pool.query(`
    SELECT tl.wallet, u.nickname, tl.old_tag, tl.new_tag, tl.gp_cost, tl.created_at
    FROM vtag_log tl
    LEFT JOIN users u ON u.wallet_address = tl.wallet
    ORDER BY tl.created_at DESC
    LIMIT 20
  `);
  return { stats: rows[0], recent: recent.rows };
}

async function adminDeleteTag(wallet) {
  await pool.query('DELETE FROM vanity_tags WHERE wallet = $1', [wallet]);
  return { success: true };
}

module.exports = { getCfg, getTag, getBulkTags, setTag, clearTag, getAdminStats, adminDeleteTag };
