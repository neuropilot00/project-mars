const express = require('express');
const jwt = require('jsonwebtoken');
const { makeRateLimiter } = require('../utils/rateLimiters');
const { pool } = require('../db');

const router = express.Router();

const readLimiter = makeRateLimiter({
  windowMs: 60 * 1000,
  max: 120,
  message: { error: 'Too many requests. Please slow down.' }
});

function getOptionalAuthWallet(req) {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  if (!token) return '';
  try {
    const user = jwt.verify(token, process.env.JWT_SECRET);
    return (user?.wallet_address || user?.wallet || user?.walletAddress || '').toLowerCase().trim();
  } catch (_) {
    return '';
  }
}

const INFLUENCE_TIERS = [
  { id: 'governor', threshold: 0.75, bonus: '+20% production', bonusKo: '+20% 생산' },
  { id: 'dominant', threshold: 0.50, bonus: '+12% production', bonusKo: '+12% 생산' },
  { id: 'stakeholder', threshold: 0.25, bonus: '+5% production', bonusKo: '+5% 생산' },
  { id: 'presence', threshold: 0.10, bonus: 'Sector influence list', bonusKo: '섹터 영향력 목록' },
];

const BATTLE_WIN_CONTROL_SCORE = 20;

router.get('/sectors/control', readLimiter, async (req, res) => {
  try {
    const sectorsRes = await pool.query(`
      SELECT id, name, tier FROM sectors ORDER BY tier, name
    `);
    if (!sectorsRes.rows.length) return res.json({ sectors: [] });

    const controlRes = await pool.query(`
      SELECT
        p.sector_id,
        c.owner AS wallet,
        COUNT(p.lat) AS pixel_area,
        COALESCE(SUM(u.level), 0) AS upgrade_levels
      FROM pixels p
      JOIN claims c ON c.id = p.claim_id AND c.deleted_at IS NULL
      LEFT JOIN territory_upgrades u ON u.claim_id = c.id AND u.is_active = true
        AND u.upgrade_type IN ('extractor','refinery','shield_grid','relay_tower','art_beacon','mine_booster')
      WHERE p.sector_id IS NOT NULL AND c.owner IS NOT NULL
      GROUP BY p.sector_id, c.owner
    `);

    const activityRes = await pool.query(`
      SELECT from_wallet AS wallet, COUNT(*) AS harvest_count
      FROM transactions
      WHERE type IN ('mining','instant_harvest')
        AND created_at > NOW() - INTERVAL '7 days'
      GROUP BY from_wallet
    `);
    const activityMap = {};
    activityRes.rows.forEach(r => { activityMap[r.wallet] = parseInt(r.harvest_count); });

    const battleRes = await pool.query(`
      SELECT
        fb.sector_id,
        LOWER(p.wallet_address) AS wallet,
        COUNT(*)::int AS win_count
      FROM fleet_battles fb
      JOIN fleet_battle_participants p ON p.battle_id = fb.id AND p.side = fb.winner_side
      WHERE fb.status = 'ended'
        AND fb.sector_id IS NOT NULL
        AND fb.winner_side IN ('atk','def')
        AND fb.battle_type IN ('pvp_duel','hijack','siege')
        AND fb.ended_at > NOW() - INTERVAL '7 days'
      GROUP BY fb.sector_id, LOWER(p.wallet_address)
    `);
    const battleMap = {};
    battleRes.rows.forEach(r => {
      const sid = r.sector_id;
      if (!battleMap[sid]) battleMap[sid] = {};
      battleMap[sid][r.wallet] = parseInt(r.win_count, 10) || 0;
    });

    let guildMap = {};
    try {
      const guildRes = await pool.query(`
        SELECT wallet_address, guild_id FROM guild_members WHERE status = 'active'
      `);
      guildRes.rows.forEach(r => { guildMap[r.wallet_address] = r.guild_id; });
    } catch (_) {}

    const sectorDataMap = {};
    for (const row of controlRes.rows) {
      const sId = row.sector_id;
      if (!sectorDataMap[sId]) sectorDataMap[sId] = {};
      const wallet = row.wallet.toLowerCase();
      const pixelArea = parseInt(row.pixel_area) || 0;
      const upgradeScore = parseInt(row.upgrade_levels) * 5;
      const harvestScore = (activityMap[wallet] || 0) * 3;
      const battleScore = ((battleMap[sId] && battleMap[sId][wallet]) || 0) * BATTLE_WIN_CONTROL_SCORE;
      const totalScore = pixelArea + upgradeScore + harvestScore + battleScore;

      if (!sectorDataMap[sId][wallet]) {
        sectorDataMap[sId][wallet] = { wallet, pixelArea: 0, upgradeScore: 0, harvestScore: 0, battleScore: 0, totalScore: 0 };
      }
      sectorDataMap[sId][wallet].pixelArea += pixelArea;
      sectorDataMap[sId][wallet].upgradeScore += upgradeScore;
      sectorDataMap[sId][wallet].harvestScore += harvestScore;
      sectorDataMap[sId][wallet].battleScore += battleScore;
      sectorDataMap[sId][wallet].totalScore += totalScore;
    }

    const sectors = sectorsRes.rows.map(s => {
      const ownerMap = sectorDataMap[s.id] || {};
      const ownerArr = Object.values(ownerMap).sort((a, b) => b.totalScore - a.totalScore);
      const totalSectorScore = ownerArr.reduce((acc, o) => acc + o.totalScore, 0);
      const top3 = ownerArr.slice(0, 3).map(o => {
        const pct = totalSectorScore > 0 ? o.totalScore / totalSectorScore : 0;
        const tier = INFLUENCE_TIERS.find(t => pct >= t.threshold) || null;
        return {
          wallet: o.wallet,
          shortWallet: o.wallet.slice(0, 6) + '…' + o.wallet.slice(-4),
          pixelArea: o.pixelArea,
          battleScore: o.battleScore,
          totalScore: o.totalScore,
          controlPct: Math.round(pct * 100),
          influenceTier: tier ? tier.id : null,
          influenceBonus: tier ? tier.bonus : null,
          influenceBonusKo: tier ? tier.bonusKo : null,
          guildId: guildMap[o.wallet] || null,
        };
      });
      return {
        id: s.id,
        name: s.name,
        tier: s.tier,
        totalScore: totalSectorScore,
        topOwners: top3,
        ownerCount: ownerArr.length,
      };
    });

    res.json({ sectors, influenceTiers: INFLUENCE_TIERS });
  } catch (e) {
    console.error('[SECTOR CONTROL] error:', e.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

router.get('/sectors/:sectorId/control', readLimiter, async (req, res) => {
  const sectorId = parseInt(req.params.sectorId);
  const wallet = getOptionalAuthWallet(req);
  if (!sectorId) return res.status(400).json({ error: 'sectorId required' });

  try {
    const sectorRes = await pool.query(`SELECT id, name, tier FROM sectors WHERE id = $1`, [sectorId]);
    if (!sectorRes.rows.length) return res.status(404).json({ error: 'Sector not found' });
    const sector = sectorRes.rows[0];

    const ownerRes = await pool.query(`
      SELECT c.owner AS wallet,
             COUNT(p.lat) AS pixel_area,
             COALESCE(SUM(u.level), 0) AS upgrade_levels
      FROM pixels p
      JOIN claims c ON c.id = p.claim_id AND c.deleted_at IS NULL
      LEFT JOIN territory_upgrades u ON u.claim_id = c.id AND u.is_active = true
        AND u.upgrade_type IN ('extractor','refinery','shield_grid','relay_tower','art_beacon','mine_booster')
      WHERE p.sector_id = $1 AND c.owner IS NOT NULL
      GROUP BY c.owner
      ORDER BY COUNT(p.lat) DESC
      LIMIT 20
    `, [sectorId]);

    const wallets = ownerRes.rows.map(r => r.wallet.toLowerCase());
    let activityMap = {};
    if (wallets.length) {
      const actRes = await pool.query(`
        SELECT from_wallet AS wallet, COUNT(*) AS harvest_count
        FROM transactions
        WHERE type IN ('mining','instant_harvest')
          AND created_at > NOW() - INTERVAL '7 days'
          AND from_wallet = ANY($1)
        GROUP BY from_wallet
      `, [wallets]);
      actRes.rows.forEach(r => { activityMap[r.wallet] = parseInt(r.harvest_count); });
    }

    let battleMap = {};
    if (wallets.length) {
      const battleRes = await pool.query(`
        SELECT LOWER(p.wallet_address) AS wallet, COUNT(*)::int AS win_count
        FROM fleet_battles fb
        JOIN fleet_battle_participants p ON p.battle_id = fb.id AND p.side = fb.winner_side
        WHERE fb.status = 'ended'
          AND fb.sector_id = $1
          AND fb.winner_side IN ('atk','def')
          AND fb.battle_type IN ('pvp_duel','hijack','siege')
          AND fb.ended_at > NOW() - INTERVAL '7 days'
          AND LOWER(p.wallet_address) = ANY($2)
        GROUP BY LOWER(p.wallet_address)
      `, [sectorId, wallets]);
      battleRes.rows.forEach(r => { battleMap[r.wallet] = parseInt(r.win_count, 10) || 0; });
    }

    const owners = ownerRes.rows.map(r => {
      const w = r.wallet.toLowerCase();
      return {
        wallet: w,
        pixelArea: parseInt(r.pixel_area),
        upgradeScore: parseInt(r.upgrade_levels) * 5,
        harvestScore: (activityMap[w] || 0) * 3,
        battleScore: (battleMap[w] || 0) * BATTLE_WIN_CONTROL_SCORE,
      };
    });
    owners.forEach(o => { o.totalScore = o.pixelArea + o.upgradeScore + o.harvestScore + o.battleScore; });
    const totalSectorScore = owners.reduce((a, o) => a + o.totalScore, 0);
    owners.forEach(o => {
      const pct = totalSectorScore > 0 ? o.totalScore / totalSectorScore : 0;
      o.controlPct = Math.round(pct * 100);
      o.influenceTier = (INFLUENCE_TIERS.find(t => pct >= t.threshold) || {}).id || null;
    });
    owners.sort((a, b) => b.totalScore - a.totalScore);

    let myEntry = null;
    if (wallet) {
      myEntry = owners.find(o => o.wallet === wallet) || null;
      if (!myEntry) {
        myEntry = { wallet, pixelArea: 0, upgradeScore: 0, harvestScore: 0, battleScore: 0, totalScore: 0, controlPct: 0, influenceTier: null };
      }
    }

    res.json({ sector, owners: owners.slice(0, 10), totalScore: totalSectorScore, myEntry });
  } catch (e) {
    console.error('[SECTOR CONTROL] sector error:', e.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

module.exports = router;
