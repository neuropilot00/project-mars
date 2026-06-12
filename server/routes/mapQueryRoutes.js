const express = require('express');
const { makeRateLimiter } = require('../utils/rateLimiters');
const { pool } = require('../db');
const { getAuthWallet, requireAuth, sanitize } = require('../utils/apiHelpers');
const { cfg } = require('../utils/settingsCache');

const router = express.Router();

const readLimiter = makeRateLimiter({
  windowMs: 60 * 1000,
  max: 120,
  message: { error: 'Too many requests. Please slow down.' },
});

function snapGrid(val) {
  return Math.round(parseFloat(val) * 100) / 100;
}

router.get('/user/:wallet', async (req, res, next) => {
  const staticSubs = ['titles', 'my-territories'];
  if (staticSubs.includes(req.params.wallet)) return next();

  try {
    const wallet = req.params.wallet.toLowerCase();
    const userRes = await pool.query('SELECT * FROM users WHERE wallet_address = $1', [wallet]);
    if (!userRes.rows.length) {
      return res.json({ usdtBalance: 0, ppBalance: 0, plots: [], totalDeposited: 0 });
    }
    const user = userRes.rows[0];

    const claimsRes = await pool.query(
      `SELECT center_lat, center_lng, width, height, image_url, link_url, total_paid
       FROM claims WHERE owner = $1 AND deleted_at IS NULL ORDER BY created_at DESC`,
      [wallet]
    );

    const depRes = await pool.query(
      'SELECT COALESCE(SUM(amount), 0) as total FROM deposits WHERE wallet_address = $1',
      [wallet]
    );

    res.json({
      usdtBalance: parseFloat(user.usdt_balance),
      ppBalance: parseFloat(user.pp_balance),
      redeemablePP: parseFloat(user.redeemable_pp || 0) || 0,
      plots: claimsRes.rows.map((claim) => ({
        lat: parseFloat(claim.center_lat),
        lng: parseFloat(claim.center_lng),
        width: claim.width,
        height: claim.height,
        imageUrl: claim.image_url,
        linkUrl: claim.link_url,
        price: parseFloat(claim.total_paid),
      })),
      totalDeposited: parseFloat(depRes.rows[0].total),
    });
  } catch (err) {
    console.error('[API] user error:', err.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

router.get('/pixel/:lat/:lng', async (req, res) => {
  try {
    const lat = snapGrid(req.params.lat);
    const lng = snapGrid(req.params.lng);

    const pxRes = await pool.query(
      'SELECT owner, price, claim_id FROM pixels WHERE lat = $1 AND lng = $2',
      [lat, lng]
    );

    if (!pxRes.rows.length) {
      const settings = await cfg();
      return res.json({ owner: null, price: settings.pixel_base_price || 0.1, claimId: null, imageUrl: null, linkUrl: null });
    }

    const px = pxRes.rows[0];
    let imageUrl = null;
    let originalImageUrl = null;
    let linkUrl = null;
    if (px.claim_id) {
      const claimRes = await pool.query('SELECT image_url, original_image_url, link_url FROM claims WHERE id = $1', [px.claim_id]);
      if (claimRes.rows.length) {
        imageUrl = claimRes.rows[0].image_url;
        originalImageUrl = claimRes.rows[0].original_image_url || null;
        linkUrl = claimRes.rows[0].link_url;
      }
    }

    res.json({
      owner: px.owner,
      price: parseFloat(px.price),
      claimId: px.claim_id,
      imageUrl,
      originalImageUrl,
      linkUrl,
    });
  } catch (err) {
    console.error('[API] pixel error:', err.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

router.get('/search/owner/:query', async (req, res) => {
  try {
    const q = sanitize(req.params.query, 100).toLowerCase();
    if (!q) {
      return res.status(400).json({ error: 'Search query is required (max 100 chars)' });
    }
    const result = await pool.query(
      `SELECT c.center_lat, c.center_lng, c.width, c.height, c.image_url, c.total_paid, c.owner,
              u.nickname
       FROM claims c
       LEFT JOIN users u ON u.wallet_address = c.owner
       WHERE (LOWER(c.owner) LIKE $1 OR LOWER(COALESCE(u.nickname,'')) LIKE $1)
         AND c.deleted_at IS NULL
       ORDER BY c.created_at DESC LIMIT 50`,
      [`%${q}%`]
    );

    res.json(result.rows.map((row) => ({
      lat: parseFloat(row.center_lat),
      lng: parseFloat(row.center_lng),
      width: row.width,
      height: row.height,
      imageUrl: row.image_url,
      price: parseFloat(row.total_paid),
      owner: row.owner,
      nickname: row.nickname || null,
    })));
  } catch (err) {
    console.error('[API] search error:', err.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

router.get('/pixels', async (_req, res) => {
  try {
    const result = await pool.query('SELECT lat, lng, owner, claim_id, price FROM pixels WHERE owner IS NOT NULL');
    const byOwner = {};
    for (const row of result.rows) {
      if (!byOwner[row.owner]) byOwner[row.owner] = [];
      byOwner[row.owner].push([parseFloat(row.lat), parseFloat(row.lng), row.claim_id, parseFloat(row.price)]);
    }
    res.json(byOwner);
  } catch (err) {
    console.error('[API] pixels error:', err.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

router.get('/claims', async (req, res) => {
  try {
    const since = req.query.since;
    let result;
    if (since) {
      result = await pool.query(
        `SELECT c.id, c.owner, c.center_lat, c.center_lng, c.width, c.height,
                c.image_url, c.original_image_url, c.link_url, c.total_paid, c.created_at,
                c.img_scale, c.img_rotate, c.img_offset_x, c.img_offset_y,
                c.custom_name,
                COALESCE(c.marketplace_locked, FALSE) AS marketplace_locked,
                u.nickname, g.id AS guild_id, g.name AS guild_name,
                g.tag AS guild_tag, g.emblem_emoji AS guild_emblem,
                g.emblem_image AS guild_emblem_image,
                ps.id AS shield_id, ps.shield_type, ps.hp AS shield_hp, ps.max_hp AS shield_max_hp, ps.expires_at AS shield_expires, ps.auto_renew AS shield_auto_renew
         FROM claims c LEFT JOIN users u ON c.owner = u.wallet_address
         LEFT JOIN guilds g ON g.id = u.guild_id
         LEFT JOIN pixel_shields ps ON ps.claim_id = c.id AND ps.expires_at > NOW()
         WHERE c.deleted_at IS NULL AND c.created_at > $1
         ORDER BY c.created_at DESC LIMIT 5000`,
        [new Date(parseInt(since))]
      );
    } else {
      result = await pool.query(
        `SELECT c.id, c.owner, c.center_lat, c.center_lng, c.width, c.height,
                c.image_url, c.original_image_url, c.link_url, c.total_paid, c.created_at,
                c.img_scale, c.img_rotate, c.img_offset_x, c.img_offset_y,
                c.custom_name,
                COALESCE(c.marketplace_locked, FALSE) AS marketplace_locked,
                u.nickname, g.id AS guild_id, g.name AS guild_name,
                g.tag AS guild_tag, g.emblem_emoji AS guild_emblem,
                g.emblem_image AS guild_emblem_image,
                ps.id AS shield_id, ps.shield_type, ps.hp AS shield_hp, ps.max_hp AS shield_max_hp, ps.expires_at AS shield_expires, ps.auto_renew AS shield_auto_renew
         FROM claims c LEFT JOIN users u ON c.owner = u.wallet_address
         LEFT JOIN guilds g ON g.id = u.guild_id
         LEFT JOIN pixel_shields ps ON ps.claim_id = c.id AND ps.expires_at > NOW()
         WHERE c.deleted_at IS NULL
         ORDER BY c.created_at DESC LIMIT 5000`
      );
    }

    const claimIds = result.rows.map((row) => row.id);
    const ownerWallets = [...new Set(result.rows.map((row) => row.owner))];
    const cosmeticsMap = {};
    const hijackMap = {};

    if (claimIds.length > 0) {
      try {
        const cosRes = await pool.query(
          'SELECT claim_id, cosmetic_type, cosmetic_code FROM user_cosmetics WHERE claim_id = ANY($1)',
          [claimIds]
        );
        cosRes.rows.forEach((cosmetic) => {
          if (!cosmeticsMap[cosmetic.claim_id]) cosmeticsMap[cosmetic.claim_id] = {};
          cosmeticsMap[cosmetic.claim_id][cosmetic.cosmetic_type] = cosmetic.cosmetic_code;
        });
      } catch (_err) { /* cosmetics table may not exist yet */ }

      try {
        const hjRes = await pool.query(
          'SELECT wallet_address, hijack_count FROM users WHERE wallet_address = ANY($1) AND hijack_count > 0',
          [ownerWallets]
        );
        hjRes.rows.forEach((row) => {
          hijackMap[row.wallet_address] = parseInt(row.hijack_count) || 0;
        });
      } catch (_err) { /* hijack_count column may not exist yet */ }
    }

    res.json(result.rows.map((row) => ({
      id: row.id,
      owner: row.owner,
      lat: parseFloat(row.center_lat),
      lng: parseFloat(row.center_lng),
      w: row.width,
      h: row.height,
      imgUrl: row.image_url,
      originalImgUrl: row.original_image_url || null,
      link: row.link_url,
      price: parseFloat(row.total_paid),
      nickname: row.nickname || null,
      label: row.nickname || `${row.owner.slice(0, 6)}...${row.owner.slice(-4)}`,
      imgScale: row.img_scale ? parseFloat(row.img_scale) : 100,
      imgRotate: row.img_rotate ? parseFloat(row.img_rotate) : 0,
      imgOffsetX: row.img_offset_x || 0,
      imgOffsetY: row.img_offset_y || 0,
      ts: new Date(row.created_at).getTime(),
      customName: row.custom_name || null,
      shield: row.shield_type ? {
        id: row.shield_id,
        type: row.shield_type,
        hp: row.shield_hp,
        maxHp: row.shield_max_hp,
        expires: new Date(row.shield_expires).getTime(),
        autoRenew: row.shield_auto_renew || false,
      } : null,
      hijackCount: hijackMap[row.owner] || 0,
      cosmetics: cosmeticsMap[row.id] || null,
      guildId: row.guild_id || null,
      guildName: row.guild_name || null,
      guildTag: row.guild_tag || null,
      guildEmblem: row.guild_emblem || null,
      guildEmblemImage: row.guild_emblem_image || null,
    })));
  } catch (err) {
    console.error('[API] claims error:', err.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

router.get('/hijack/defender-info', readLimiter, async (req, res) => {
  try {
    const wallet = (req.query.wallet || '').toLowerCase().trim();
    if (!wallet || wallet.length < 10) return res.status(400).json({ error: 'wallet_required' });
    const result = await pool.query(
      `SELECT COUNT(DISTINCT f.id)::int AS fleet_count,
              COUNT(DISTINCT s.id) FILTER (WHERE s.is_alive = true)::int AS alive_ships,
              COUNT(DISTINCT f.id) FILTER (WHERE COALESCE(f.is_in_battle, false) = false)::int AS available_fleets
         FROM fleets f
         LEFT JOIN ships s ON s.fleet_id = f.id
        WHERE f.owner_wallet = $1`,
      [wallet]
    );
    const row = result.rows[0] || {};
    const fleetCount = parseInt(row.fleet_count) || 0;
    const aliveShips = parseInt(row.alive_ships) || 0;
    const availableFleets = parseInt(row.available_fleets) || 0;

    res.json({
      hasFleet: fleetCount > 0,
      fleetCount,
      aliveShips,
      availableFleets,
      willAutoWin: availableFleets === 0 || aliveShips === 0,
    });
  } catch (err) {
    console.error('[API] /hijack/defender-info error:', err.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

router.get('/claims/my', requireAuth, async (req, res) => {
  try {
    const wallet = getAuthWallet(req);
    if (!wallet || wallet.length < 10) return res.status(400).json({ error: 'wallet_required' });
    const result = await pool.query(
      `SELECT c.id, c.center_lat, c.center_lng, c.width, c.height,
              c.custom_name AS name, c.image_url, c.created_at,
              (c.width * c.height) AS pixel_count
         FROM claims c
        WHERE c.owner = $1 AND c.deleted_at IS NULL
        ORDER BY c.created_at DESC`,
      [wallet]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('[API] /claims/my error:', err.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

module.exports = router;
