'use strict';
const pool = require('../db');

async function getSetting(key, fallback) {
  try {
    const { rows } = await pool.query('SELECT value FROM game_settings WHERE key=$1', [key]);
    if (rows.length) return rows[0].value;
  } catch (_) {}
  return String(fallback);
}

// ── Get all active VIP tiers ──────────────────────────────────────────────────
async function getTiers() {
  const { rows } = await pool.query(
    'SELECT * FROM vip_tiers WHERE is_active=true ORDER BY sort_order, cost_gp');
  return rows;
}

// ── Get player's active VIP pass ──────────────────────────────────────────────
async function getMyPass(wallet) {
  const { rows } = await pool.query(
    `SELECT vp.*, vt.name AS tier_name, vt.badge, vt.badge_color,
            vt.mining_boost_pct, vt.fee_discount_pct, vt.gp_earn_bonus_pct, vt.max_lucky_per_day
     FROM vip_passes vp
     JOIN vip_tiers vt ON vt.id = vp.tier_id
     WHERE vp.wallet=$1 AND vp.is_active=true AND vp.expires_at > NOW()`,
    [wallet.toLowerCase()]);
  return rows[0] || null;
}

// ── Get VIP info for a wallet (for defense/mining bonus checks) ───────────────
async function getVipInfo(wallet) {
  return getMyPass(wallet);
}

// ── Purchase or upgrade a VIP pass ───────────────────────────────────────────
async function purchasePass(wallet, tierId) {
  const wLower = wallet.toLowerCase();
  const enabled = await getSetting('vip_enabled', 'true');
  if (enabled !== 'true') throw new Error('VIP system is disabled');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Load tier
    const { rows: tierRows } = await client.query(
      'SELECT * FROM vip_tiers WHERE id=$1 AND is_active=true', [tierId]);
    if (!tierRows.length) throw new Error('VIP tier not found');
    const tier = tierRows[0];

    // Check GP balance
    const { rows: balRows } = await client.query(
      'SELECT balance FROM gp_balances WHERE wallet=$1 FOR UPDATE', [wLower]);
    const bal = balRows.length ? Number(balRows[0].balance) : 0;
    if (bal < Number(tier.cost_gp)) {
      throw new Error(`Insufficient GP (need ${tier.cost_gp}, have ${bal.toFixed(2)})`);
    }

    // Check if already has a pass
    const { rows: existing } = await client.query(
      `SELECT vp.*, vt.tier_id AS current_tier_id, vt.cost_gp AS current_cost,
              vt.sort_order AS current_sort
       FROM vip_passes vp
       JOIN vip_tiers vt ON vt.id = vp.tier_id
       WHERE vp.wallet=$1 AND vp.is_active=true AND vp.expires_at > NOW()`,
      [wLower]);

    let refund = 0;
    if (existing.length) {
      const cur = existing[0];
      if (Number(cur.tier_id) === tierId) {
        // Renew — extend expiry by period_days from current expires_at
        await client.query('BEGIN'); // nested save — just continue
        const { rows: newExp } = await client.query(
          `UPDATE vip_passes SET expires_at = expires_at + ($1 || ' days')::interval, auto_renewed=true
           WHERE wallet=$2 AND is_active=true RETURNING expires_at`,
          [tier.period_days, wLower]);
        await client.query(
          'UPDATE gp_balances SET balance = balance - $1 WHERE wallet=$2',
          [tier.cost_gp, wLower]);
        await client.query(
          `INSERT INTO vip_log (wallet, tier_id, event_type, gp_spent) VALUES ($1,$2,'renewed',$3)`,
          [wLower, tierId, tier.cost_gp]);
        await client.query('COMMIT');
        return { action: 'renewed', tierId, tierName: tier.name, badge: tier.badge,
                 expiresAt: newExp[0].expires_at, gpSpent: Number(tier.cost_gp) };
      }

      // Upgrade or downgrade — deactivate current pass, optional refund
      const refundPct = parseFloat(await getSetting('vip_upgrade_refund_pct', '50')) / 100;
      const now = new Date();
      const expiresAt = new Date(cur.expires_at);
      const totalMs = expiresAt - new Date(cur.activated_at);
      const remainMs = expiresAt - now;
      if (remainMs > 0 && totalMs > 0 && refundPct > 0) {
        const remainFraction = remainMs / totalMs;
        refund = parseFloat((Number(cur.gp_spent) * remainFraction * refundPct).toFixed(6));
      }
      await client.query(
        `UPDATE vip_passes SET is_active=false WHERE wallet=$1 AND is_active=true`, [wLower]);
      if (refund > 0) {
        await client.query(
          `INSERT INTO gp_balances (wallet, balance) VALUES ($1,$2)
           ON CONFLICT (wallet) DO UPDATE SET balance = gp_balances.balance + EXCLUDED.balance`,
          [wLower, refund]);
      }
    }

    // Deduct cost
    await client.query(
      'UPDATE gp_balances SET balance = balance - $1 WHERE wallet=$2',
      [tier.cost_gp, wLower]);

    // Insert new pass
    const expiresAt = new Date(Date.now() + tier.period_days * 86400000);
    await client.query(
      `INSERT INTO vip_passes (wallet, tier_id, gp_spent, expires_at)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (wallet) DO UPDATE SET
         tier_id=EXCLUDED.tier_id, gp_spent=EXCLUDED.gp_spent,
         activated_at=NOW(), expires_at=EXCLUDED.expires_at, is_active=true, auto_renewed=false`,
      [wLower, tierId, tier.cost_gp, expiresAt]);

    await client.query(
      `INSERT INTO vip_log (wallet, tier_id, event_type, gp_spent) VALUES ($1,$2,'purchased',$3)`,
      [wLower, tierId, tier.cost_gp]);

    await client.query('COMMIT');
    return {
      action: existing.length ? 'upgraded' : 'purchased',
      tierId, tierName: tier.name, badge: tier.badge,
      expiresAt, gpSpent: Number(tier.cost_gp), refund
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ── Expire stale passes (scheduler) ─────────────────────────────────────────
async function expireOldPasses() {
  try {
    const { rowCount } = await pool.query(
      `UPDATE vip_passes SET is_active=false
       WHERE is_active=true AND expires_at <= NOW()`);
    if (rowCount > 0) {
      console.log(`[VIP] Expired ${rowCount} pass(es)`);
      // Log expirations
      await pool.query(
        `INSERT INTO vip_log (wallet, tier_id, event_type)
         SELECT wallet, tier_id, 'expired' FROM vip_passes
         WHERE is_active=false AND expires_at <= NOW() AND expires_at >= NOW() - INTERVAL '5 minutes'`
      );
    }
  } catch (e) {
    console.error('[VIP] Expire error:', e.message);
  }
}

// ── Admin stats ───────────────────────────────────────────────────────────────
async function getAdminStats() {
  const [totals, active, tiers, settings, recent] = await Promise.all([
    pool.query(
      `SELECT COUNT(*) AS total_purchases, SUM(gp_spent) AS total_gp_spent,
              (SELECT COUNT(*) FROM vip_passes WHERE is_active=true AND expires_at > NOW()) AS active_passes
       FROM vip_log WHERE event_type IN ('purchased','renewed')`),
    pool.query(
      `SELECT vp.wallet, up.nickname, vt.name AS tier_name, vt.badge,
              vp.expires_at, vp.gp_spent
       FROM vip_passes vp
       JOIN vip_tiers vt ON vt.id = vp.tier_id
       LEFT JOIN user_profiles up ON up.wallet = vp.wallet
       WHERE vp.is_active=true AND vp.expires_at > NOW()
       ORDER BY vt.sort_order DESC, vp.expires_at DESC LIMIT 50`),
    pool.query('SELECT * FROM vip_tiers ORDER BY sort_order'),
    pool.query(`SELECT key, value FROM game_settings WHERE category='vip' ORDER BY key`),
    pool.query(
      `SELECT vl.*, vt.name AS tier_name, vt.badge, up.nickname
       FROM vip_log vl
       JOIN vip_tiers vt ON vt.id = vl.tier_id
       LEFT JOIN user_profiles up ON up.wallet = vl.wallet
       ORDER BY vl.created_at DESC LIMIT 30`)
  ]);
  return {
    totals: totals.rows[0],
    active: active.rows,
    tiers: tiers.rows,
    settings: settings.rows,
    recent: recent.rows
  };
}

module.exports = {
  getTiers, getMyPass, getVipInfo, purchasePass, expireOldPasses, getAdminStats
};
