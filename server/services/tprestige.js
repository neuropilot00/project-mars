'use strict';
const { pool, getSetting } = require('../db');

const TIER_NAMES  = ['None', 'Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond'];
const TIER_COLORS = ['', '#cd7f32', '#c0c0c0', '#ffd700', '#e5e4e2', '#b9f2ff'];

async function getCfg() {
  const [enabled, t1, t2, t3, t4, t5] = await Promise.all([
    getSetting('tprestige_enabled',  'true'),
    getSetting('tprestige_tier1_gp', '50'),
    getSetting('tprestige_tier2_gp', '150'),
    getSetting('tprestige_tier3_gp', '400'),
    getSetting('tprestige_tier4_gp', '1000'),
    getSetting('tprestige_tier5_gp', '2500'),
  ]);
  const tierCosts = [0, parseInt(t1,10), parseInt(t2,10), parseInt(t3,10), parseInt(t4,10), parseInt(t5,10)];
  return {
    enabled: enabled === 'true',
    tierCosts,
    tierNames:  TIER_NAMES,
    tierColors: TIER_COLORS,
  };
}

async function getPrestige(claimId) {
  const { rows } = await pool.query(
    'SELECT tier, gp_paid, updated_at FROM territory_prestige WHERE claim_id=$1', [claimId]
  );
  if (!rows.length) return { tier: 0, name: TIER_NAMES[0], color: TIER_COLORS[0], gpPaid: 0 };
  const r = rows[0];
  return {
    tier:   r.tier,
    name:   TIER_NAMES[r.tier]   || 'Unknown',
    color:  TIER_COLORS[r.tier]  || '',
    gpPaid: r.gp_paid,
    updatedAt: r.updated_at,
  };
}

async function upgradePrestige(wallet, claimId) {
  if (!wallet) throw new Error('wallet required');
  if (!claimId) throw new Error('claimId required');

  const cfg = await getCfg();
  if (!cfg.enabled) throw new Error('Territory prestige is disabled');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Verify ownership
    const claimRes = await client.query(
      'SELECT owner FROM claims WHERE id=$1 AND deleted_at IS NULL', [claimId]
    );
    if (!claimRes.rows.length) throw new Error('Territory not found');
    if (claimRes.rows[0].owner !== wallet) throw new Error('You must own this territory');

    // Get current tier
    const existing = await client.query(
      'SELECT tier FROM territory_prestige WHERE claim_id=$1 FOR UPDATE', [claimId]
    );
    const currentTier = existing.rows.length ? existing.rows[0].tier : 0;
    const nextTier = currentTier + 1;

    if (nextTier > 5) throw new Error('Territory already at maximum prestige (Diamond)');

    const costGP = cfg.tierCosts[nextTier];

    // Deduct GP
    const bal = await client.query(
      'SELECT gp_balance FROM users WHERE wallet_address=$1 FOR UPDATE', [wallet]
    );
    if (!bal.rows.length) throw new Error('User not found');
    if (bal.rows[0].gp_balance < costGP)
      throw new Error(`Insufficient GP (need ${costGP} for ${TIER_NAMES[nextTier]})`);

    await client.query(
      'UPDATE users SET gp_balance = gp_balance - $1 WHERE wallet_address=$2',
      [costGP, wallet]
    );
    await client.query(
      `INSERT INTO gp_transactions (wallet, amount, type, note)
       VALUES ($1, $2, 'tprestige', $3)`,
      [wallet, -costGP, `Territory #${claimId} → ${TIER_NAMES[nextTier]} prestige`]
    );

    // Upsert prestige
    await client.query(
      `INSERT INTO territory_prestige (claim_id, wallet, tier, gp_paid)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (claim_id) DO UPDATE
         SET tier=$3, wallet=$2,
             gp_paid = territory_prestige.gp_paid + $4,
             updated_at = NOW()`,
      [claimId, wallet, nextTier, costGP]
    );

    await client.query(
      `INSERT INTO territory_prestige_log (claim_id, wallet, from_tier, to_tier, gp_cost)
       VALUES ($1, $2, $3, $4, $5)`,
      [claimId, wallet, currentTier, nextTier, costGP]
    );

    await client.query('COMMIT');

    try {
      const { logGPActivity } = require('./gpActivity');
      await logGPActivity(wallet, 'spend', costGP, `tprestige claim#${claimId} → ${TIER_NAMES[nextTier]}`);
    } catch(_) {}
    try {
      const seasonService = require('./season');
      await seasonService.trackGPSpend(wallet, costGP, 'tprestige');
    } catch(_) {}

    return {
      success: true,
      tier: nextTier,
      name: TIER_NAMES[nextTier],
      color: TIER_COLORS[nextTier],
      costGP,
    };
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
      (SELECT COUNT(*) FROM territory_prestige)                                               AS total_prestige,
      (SELECT SUM(gp_paid) FROM territory_prestige)                                          AS total_gp,
      (SELECT COUNT(*) FROM territory_prestige WHERE tier=5)                                 AS diamond_count,
      (SELECT COUNT(*) FROM territory_prestige_log WHERE created_at > NOW()-INTERVAL '24h')  AS upgrades_24h
  `);
  const byTier = await pool.query(`
    SELECT tier, COUNT(*) AS cnt, SUM(gp_paid) AS gp
    FROM territory_prestige GROUP BY tier ORDER BY tier
  `);
  const recent = await pool.query(`
    SELECT p.claim_id, p.wallet, u.nickname, p.tier, p.gp_paid, p.updated_at
    FROM territory_prestige p
    LEFT JOIN users u ON u.wallet = p.wallet
    ORDER BY p.updated_at DESC LIMIT 20
  `);
  return { stats: rows[0], byTier: byTier.rows, recent: recent.rows };
}

async function adminResetPrestige(claimId) {
  await pool.query('DELETE FROM territory_prestige WHERE claim_id=$1', [claimId]);
  return { success: true };
}

// ── Migration 172: 티어별 실보너스 조회 ──
function _parseCsvPct(raw, fallback) {
  if (!raw) return fallback;
  try {
    const cleaned = String(raw).replace(/^"+|"+$/g, '');
    const arr = cleaned.split(',').map(x => parseFloat(x) || 0);
    return arr.length ? arr : fallback;
  } catch (_) { return fallback; }
}

async function _getTierArr(key, fallbackArr) {
  const raw = await getSetting(key, null);
  return _parseCsvPct(raw, fallbackArr);
}

async function getClaimTier(claimId) {
  if (!claimId) return 0;
  try {
    const { rows } = await pool.query(
      'SELECT tier FROM territory_prestige WHERE claim_id = $1', [claimId]
    );
    return rows[0]?.tier || 0;
  } catch (_) { return 0; }
}

async function getClaimMiningBonus(claimId) {
  const tier = await getClaimTier(claimId);
  if (tier <= 0) return 1.0;
  const arr = await _getTierArr('tprestige_tier_mining_bonus_pct', [0,5,10,18,28,40]);
  return 1 + (arr[tier] || 0) / 100;
}

async function getClaimHijackDefensePct(claimId) {
  const tier = await getClaimTier(claimId);
  if (tier <= 0) return 0;
  const arr = await _getTierArr('tprestige_tier_hijack_def_pct', [0,3,7,12,18,25]);
  return arr[tier] || 0;
}

async function getClaimShieldBonusPct(claimId) {
  const tier = await getClaimTier(claimId);
  if (tier <= 0) return 0;
  const arr = await _getTierArr('tprestige_tier_shield_bonus_pct', [0,5,10,15,22,30]);
  return arr[tier] || 0;
}

// 유저가 소유한 모든 클레임 중 최고 티어 보너스 반환 (채굴 등에 적용)
async function getBestClaimMiningBonus(wallet) {
  if (!wallet) return 1.0;
  try {
    const { rows } = await pool.query(
      `SELECT MAX(tp.tier) AS max_tier
       FROM territory_prestige tp
       JOIN claims c ON c.id = tp.claim_id AND c.deleted_at IS NULL
       WHERE LOWER(c.owner) = LOWER($1)`, [wallet]
    );
    const maxTier = rows[0]?.max_tier || 0;
    if (maxTier <= 0) return 1.0;
    const arr = await _getTierArr('tprestige_tier_mining_bonus_pct', [0,5,10,18,28,40]);
    return 1 + (arr[maxTier] || 0) / 100;
  } catch (_) { return 1.0; }
}

module.exports = {
  getCfg, getPrestige, upgradePrestige,
  getAdminStats, adminResetPrestige,
  TIER_NAMES, TIER_COLORS,
  getClaimTier, getClaimMiningBonus, getClaimHijackDefensePct,
  getClaimShieldBonusPct, getBestClaimMiningBonus
};
