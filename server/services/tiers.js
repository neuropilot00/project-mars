'use strict';
const { pool, getSetting } = require('../db');

async function getCfg() {
  const [enabled, names, icons, costsRaw, miningRaw, pixelRaw, maxTier, perWalletMax] = await Promise.all([
    getSetting('tier_enabled', 'true'),
    getSetting('tier_names', 'Bronze,Silver,Gold,Platinum,Diamond'),
    getSetting('tier_icons', '🥉,🥈,🥇,💠,💎'),
    getSetting('tier_costs_gp', '100,300,800,2000,5000'),
    getSetting('tier_mining_bonus_pct', '0,10,25,50,100'),
    getSetting('tier_pixel_bonus_pct', '0,5,15,30,60'),
    getSetting('tier_max', '5'),
    getSetting('tier_per_wallet_max', '0'),
  ]);
  const costs   = costsRaw.split(',').map(Number);
  const mining  = miningRaw.split(',').map(Number);
  const pixels  = pixelRaw.split(',').map(Number);
  const tierNames = names.split(',').map(s => s.trim());
  const tierIcons = icons.split(',').map(s => s.trim());
  return {
    enabled: enabled === 'true',
    maxTier: parseInt(maxTier) || 5,
    perWalletMax: parseInt(perWalletMax) || 0,
    tiers: Array.from({ length: parseInt(maxTier)||5 }, function(_, i) {
      return {
        level: i + 1,
        name: tierNames[i] || ('Tier '+(i+1)),
        icon: tierIcons[i] || '⭐',
        costGp: costs[i] || 0,
        miningBonusPct: mining[i] || 0,
        pixelBonusPct: pixels[i] || 0,
      };
    }),
  };
}

async function getTier(claimId) {
  const r = await pool.query(
    `SELECT t.*, u.nickname FROM territory_tiers t
       LEFT JOIN users u ON LOWER(t.wallet)=LOWER(u.wallet_address)
       WHERE t.claim_id=$1`,
    [claimId]
  );
  return r.rows[0] || null;
}

async function getMyTiers(wallet) {
  const r = await pool.query(
    `SELECT tt.*, c.sector_id
       FROM territory_tiers tt
       JOIN claims c ON c.id = tt.claim_id
       WHERE LOWER(tt.wallet)=LOWER($1)
       ORDER BY tt.tier DESC, tt.upgraded_at DESC`,
    [wallet]
  );
  return r.rows;
}

async function upgradeTier(wallet, claimId) {
  const cfg = await getCfg();
  if (!cfg.enabled) throw new Error('Territory tier upgrades disabled');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Verify ownership
    const claimRes = await client.query(
      `SELECT id, owner FROM claims WHERE id=$1 FOR UPDATE`,
      [claimId]
    );
    if (!claimRes.rows.length) throw new Error('Claim not found');
    if (claimRes.rows[0].owner.toLowerCase() !== wallet.toLowerCase()) throw new Error('Not your territory');

    // Current tier
    const tierRes = await client.query(
      `SELECT tier FROM territory_tiers WHERE claim_id=$1 FOR UPDATE`,
      [claimId]
    );
    const currentTier = tierRes.rows.length ? tierRes.rows[0].tier : 1;
    const nextTier = currentTier + 1;

    // Already at first tier if no row → treat as tier 1, upgrade to tier 2
    // But if currentTier === maxTier, can't upgrade
    if (currentTier >= cfg.maxTier) throw new Error('Already at maximum tier');

    // Cost = cost to reach nextTier
    const tierInfo = cfg.tiers[nextTier - 1]; // 0-indexed
    if (!tierInfo) throw new Error('Invalid tier config');
    const gpCost = tierInfo.costGp;

    // Load user balance
    const userRes = await client.query(
      `SELECT gp_balance FROM users WHERE LOWER(wallet_address)=LOWER($1) FOR UPDATE`,
      [wallet]
    );
    if (!userRes.rows.length) throw new Error('User not found');
    if (userRes.rows[0].gp_balance < gpCost) throw new Error('Insufficient GP');

    // Deduct GP
    await client.query(
      `UPDATE users SET gp_balance = gp_balance - $1 WHERE LOWER(wallet_address)=LOWER($2)`,
      [gpCost, wallet]
    );
    await client.query(
      `INSERT INTO gp_transactions (wallet, amount, transaction_type, description)
       VALUES ($1, $2, 'territory_tier', $3)`,
      [wallet, -gpCost, `Upgraded territory #${claimId} to ${tierInfo.name}`]
    );

    // Upsert tier
    if (tierRes.rows.length) {
      await client.query(
        `UPDATE territory_tiers SET tier=$1, wallet=$2, upgraded_at=NOW() WHERE claim_id=$3`,
        [nextTier, wallet, claimId]
      );
    } else {
      // Creating first upgrade (from implicit tier 1 to tier 2)
      await client.query(
        `INSERT INTO territory_tiers (claim_id, wallet, tier) VALUES ($1, $2, $3)`,
        [claimId, wallet, nextTier]
      );
    }

    // Log
    await client.query(
      `INSERT INTO territory_tier_log (claim_id, wallet, from_tier, to_tier, gp_spent)
       VALUES ($1, $2, $3, $4, $5)`,
      [claimId, wallet, currentTier, nextTier, gpCost]
    );

    await client.query('COMMIT');

    // Side effects
    try { const { logGPActivity } = require('./gpActivity'); await logGPActivity(wallet, -gpCost, 'territory_tier', `Tier upgrade claim ${claimId}`); } catch(_) {}
    try { const seasonService = require('./season'); await seasonService.trackGPSpend(wallet, gpCost); } catch(_) {}

    return { success: true, fromTier: currentTier, toTier: nextTier, gpCost, tierName: tierInfo.name, tierIcon: tierInfo.icon, miningBonus: tierInfo.miningBonusPct, pixelBonus: tierInfo.pixelBonusPct };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

async function getAdminStats() {
  const r = await pool.query(`
    SELECT
      COUNT(*)                    AS total_tiered,
      SUM(tier)                   AS total_tier_levels,
      COALESCE(SUM(l.gp_total),0) AS total_gp_spent,
      COUNT(DISTINCT tt.wallet)   AS unique_wallets,
      MAX(tier)                   AS highest_tier
    FROM territory_tiers tt
    LEFT JOIN (
      SELECT wallet, SUM(gp_spent) AS gp_total FROM territory_tier_log GROUP BY wallet
    ) l ON LOWER(l.wallet)=LOWER(tt.wallet)
  `);
  const dist = await pool.query(
    `SELECT tier, COUNT(*) AS cnt FROM territory_tiers GROUP BY tier ORDER BY tier`
  );
  return { stats: r.rows[0], distribution: dist.rows };
}

module.exports = { getCfg, getTier, getMyTiers, upgradeTier, getAdminStats };
