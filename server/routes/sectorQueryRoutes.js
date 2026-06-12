const express = require('express');
const jwt = require('jsonwebtoken');
const { makeRateLimiter } = require('../utils/rateLimiters');
const { pool } = require('../db');
const { cfg } = require('../utils/settingsCache');

let seasonService;
try { seasonService = require('../services/season'); } catch (_e) { /* season service not available */ }

const router = express.Router();
const GRID_SIZE = 0.22;

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

// GET /api/sectors — all sectors with live stats.
router.get('/sectors', readLimiter, async (req, res) => {
  try {
    const wallet = getOptionalAuthWallet(req);
    const result = await pool.query(`
      SELECT s.*,
        (SELECT COUNT(*) FROM pixels p WHERE p.sector_id = s.id AND p.owner IS NOT NULL) AS occupied_count,
        (SELECT COUNT(DISTINCT p.owner) FROM pixels p WHERE p.sector_id = s.id AND p.owner IS NOT NULL) AS unique_owners,
        (SELECT COALESCE(AVG(p.price),0) FROM pixels p WHERE p.sector_id = s.id AND p.owner IS NOT NULL) AS avg_price,
        (SELECT COUNT(*) FROM pixels p
          WHERE p.sector_id = s.id AND p.owner IS NOT NULL
          AND p.updated_at > NOW() - INTERVAL '24 hours') AS activity_24h,
        ug.nickname AS governor_nickname
      FROM sectors s
      LEFT JOIN users ug ON ug.wallet_address = s.governor_wallet
      ORDER BY s.tier, s.name
    `);

    const topRes = await pool.query(`
      SELECT t.sector_id, t.owner, t.cnt, u.nickname
      FROM (
        SELECT DISTINCT ON (sector_id) sector_id, owner, COUNT(*) AS cnt
        FROM pixels WHERE owner IS NOT NULL AND sector_id IS NOT NULL
        GROUP BY sector_id, owner
        ORDER BY sector_id, cnt DESC
      ) t
      LEFT JOIN users u ON u.wallet_address = t.owner
    `);
    const topMap = {};
    topRes.rows.forEach(row => {
      topMap[row.sector_id] = {
        wallet: row.owner,
        nickname: row.nickname || null,
        pixels: parseInt(row.cnt)
      };
    });

    let myMap = {};
    if (wallet) {
      const myRes = await pool.query(
        'SELECT sector_id, COUNT(*) AS cnt FROM pixels WHERE owner = $1 AND sector_id IS NOT NULL GROUP BY sector_id',
        [wallet]
      );
      myRes.rows.forEach(row => { myMap[row.sector_id] = parseInt(row.cnt); });
    }

    const settings = await cfg();
    const miningBonusMap = {
      core: settings.mining_core_mult || 1.5,
      mid: settings.mining_mid_mult || 1.2,
      frontier: settings.mining_frontier_mult || 1.0
    };

    const rows = result.rows.map(row => {
      const occupied = parseInt(row.occupied_count) || 0;
      let total = parseInt(row.total_pixels) || 0;
      if (total <= 1) {
        const latRange = Math.abs(parseFloat(row.lat_max) - parseFloat(row.lat_min));
        const lngRange = Math.abs(parseFloat(row.lng_max) - parseFloat(row.lng_min));
        total = Math.max(1, Math.round((latRange / GRID_SIZE) * (lngRange / GRID_SIZE)));
      }

      const ratio = Math.min(occupied / total, 1.0);
      let tierMult = 1;
      if (row.tier === 'core') tierMult = settings.dynamic_price_core_mult || 3;
      else if (row.tier === 'mid') tierMult = settings.dynamic_price_mid_mult || 2;

      const dynPrice = (settings.dynamic_price_enabled !== false)
        ? parseFloat(row.base_price) * (1 + ratio * tierMult)
        : parseFloat(row.base_price);

      const top = topMap[row.id] || null;

      return {
        id: row.id,
        name: row.name,
        tier: row.tier,
        centerLat: parseFloat(row.center_lat),
        centerLng: parseFloat(row.center_lng),
        bounds: {
          latMin: parseFloat(row.lat_min),
          latMax: parseFloat(row.lat_max),
          lngMin: parseFloat(row.lng_min),
          lngMax: parseFloat(row.lng_max)
        },
        polygon: row.bounds_polygon || null,
        basePrice: parseFloat(row.base_price),
        currentPrice: Math.round(dynPrice * 1000000) / 1000000,
        miningBonus: miningBonusMap[row.tier] || 1.0,
        governor: row.governor_wallet ? {
          wallet: row.governor_wallet.slice(0, 6) + '...' + row.governor_wallet.slice(-4),
          fullWallet: row.governor_wallet,
          nickname: row.governor_nickname || null,
          since: row.governor_since
        } : null,
        taxRate: parseFloat(row.tax_rate) || 2,
        announcement: row.announcement || null,
        entryMinLevel: parseInt(row.entry_min_level) || 0,
        entryRequiredMidOwns: parseInt(row.entry_required_mid_owns) || 0,
        entryCheckActive: row.entry_check_active !== false,
        topHolder: top ? {
          wallet: top.wallet.slice(0, 6) + '...' + top.wallet.slice(-4),
          fullWallet: top.wallet,
          nickname: top.nickname || null,
          pixels: top.pixels
        } : null,
        myPixels: myMap[row.id] || 0,
        stats: {
          totalPixels: total,
          occupiedPixels: occupied,
          uniqueOwners: parseInt(row.unique_owners) || 0,
          occupancyRate: Math.round(ratio * 10000) / 100,
          avgPrice: Math.round(parseFloat(row.avg_price) * 1000000) / 1000000,
          activity24h: parseInt(row.activity_24h) || 0
        }
      };
    });

    res.json(rows);
    if (wallet && seasonService) {
      seasonService.addSeasonScore(wallet, 'sector_enter', 1).catch(() => {});
    }
  } catch (err) {
    console.error('[API] sectors error:', err.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

// GET /api/sectors/:id — single sector detail.
router.get('/sectors/:id', async (req, res, next) => {
  if (req.params.id === 'control') return next();

  try {
    const sectorId = parseInt(req.params.id);
    if (isNaN(sectorId)) return res.status(400).json({ error: 'Invalid sector ID' });

    const sectorRes = await pool.query('SELECT * FROM sectors WHERE id = $1', [sectorId]);
    if (!sectorRes.rows.length) return res.status(404).json({ error: 'Sector not found' });

    const sector = sectorRes.rows[0];
    const holdersRes = await pool.query(`
      SELECT p.owner, u.nickname, COUNT(*) AS pixel_count
      FROM pixels p
      LEFT JOIN users u ON u.wallet_address = p.owner
      WHERE p.sector_id = $1 AND p.owner IS NOT NULL
      GROUP BY p.owner, u.nickname
      ORDER BY pixel_count DESC
      LIMIT 20
    `, [sectorId]);

    const txRes = await pool.query(`
      SELECT t.type, t.from_wallet, t.usdt_amount, t.pp_amount, t.created_at
      FROM transactions t
      JOIN claims c ON (t.meta->>'claimId')::int = c.id
      WHERE c.center_lat BETWEEN $1 AND $2
        AND c.center_lng BETWEEN $3 AND $4
      ORDER BY t.created_at DESC
      LIMIT 10
    `, [sector.lat_min, sector.lat_max, sector.lng_min, sector.lng_max]);

    res.json({
      sector: {
        id: sector.id,
        name: sector.name,
        tier: sector.tier,
        basePrice: parseFloat(sector.base_price),
        governor: sector.governor_wallet,
        governorSince: sector.governor_since
      },
      topHolders: holdersRes.rows.map(row => ({
        wallet: row.owner.slice(0, 6) + '...' + row.owner.slice(-4),
        nickname: row.nickname,
        pixels: parseInt(row.pixel_count)
      })),
      recentActivity: txRes.rows.map(row => ({
        type: row.type,
        wallet: row.from_wallet.slice(0, 6) + '...' + row.from_wallet.slice(-4),
        usdt: parseFloat(row.usdt_amount),
        pp: parseFloat(row.pp_amount),
        at: row.created_at
      }))
    });
  } catch (err) {
    console.error('[API] sector detail error:', err.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

module.exports = router;
