const express = require('express');
const jwt = require('jsonwebtoken');
const { makeRateLimiter } = require('../utils/rateLimiters');
const { pool } = require('../db');
const { getAuthWallet, requireAuth, sanitize } = require('../utils/apiHelpers');
const { cfg } = require('../utils/settingsCache');

const router = express.Router();
const PIXELS_CACHE_MS = 15 * 1000;
const CLAIMS_FULL_CACHE_MS = 10 * 1000;
const CLAIMS_DELTA_CACHE_MS = 5 * 1000;
const pixelsCache = new Map();
const pixelsInFlight = new Map();
const claimsCache = new Map();
const claimsInFlight = new Map();

const readLimiter = makeRateLimiter({
  windowMs: 60 * 1000,
  max: 120,
  message: { error: 'Too many requests. Please slow down.' },
});

function snapGrid(val) {
  return Math.round(parseFloat(val) * 100) / 100;
}

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

function visibleOwnerPredicate(ownerExpr, paramIndex) {
  return `(
    LOWER(${ownerExpr}) = LOWER($${paramIndex})
    OR NOT EXISTS (
      SELECT 1 FROM user_active_effects sae
       WHERE LOWER(sae.wallet) = LOWER(${ownerExpr})
         AND sae.effect_type = 'stealth_cloak'
         AND sae.active = true
         AND sae.expires_at > NOW()
    )
  )`;
}

function isOptionalVisibilityError(err) {
  return err && ['42P01', '42703', '42P10'].includes(err.code);
}

function isOptionalClaimDecorationError(err) {
  return err && ['42P01', '42703', '42P10'].includes(err.code);
}

function buildClaimsFallbackSql(hasSince) {
  return `SELECT c.id, c.owner, c.center_lat, c.center_lng, c.width, c.height,
                c.image_url, NULL::text AS original_image_url, c.link_url, c.total_paid, c.created_at,
                100::numeric AS img_scale, 0::numeric AS img_rotate, 0::numeric AS img_offset_x, 0::numeric AS img_offset_y,
                NULL::text AS custom_name,
                false AS marketplace_locked,
                u.nickname, NULL::int AS guild_id, NULL::text AS guild_name,
                NULL::text AS guild_tag, NULL::text AS guild_emblem,
                NULL::text AS guild_emblem_image,
                NULL::int AS shield_id, NULL::text AS shield_type, NULL::int AS shield_hp,
                NULL::int AS shield_max_hp, NULL::timestamptz AS shield_expires, false AS shield_auto_renew
         FROM claims c LEFT JOIN users u ON LOWER(c.owner) = LOWER(u.wallet_address)
         WHERE c.deleted_at IS NULL${hasSince ? ' AND c.created_at > $1' : ''}
         ORDER BY c.created_at DESC LIMIT 5000`;
}

async function cachedSnapshot(cache, inFlight, key, ttlMs, builder) {
  const now = Date.now();
  const cached = cache.get(key);
  if (cached && now - cached.at < ttlMs) return cached.data;

  if (!inFlight.has(key)) {
    inFlight.set(key, builder()
      .then((data) => {
        cache.set(key, { data, at: Date.now() });
        if (cache.size > 200) {
          const first = cache.keys().next().value;
          if (first !== undefined) cache.delete(first);
        }
        return data;
      })
      .finally(() => { inFlight.delete(key); }));
  }

  try {
    return await inFlight.get(key);
  } catch (err) {
    if (cached) return cached.data;
    throw err;
  }
}

router.get('/user/:wallet', async (req, res, next) => {
  const staticSubs = ['titles', 'my-territories'];
  if (staticSubs.includes(req.params.wallet)) return next();

  try {
    const wallet = req.params.wallet.toLowerCase();
    const userRes = await pool.query('SELECT * FROM users WHERE LOWER(wallet_address) = LOWER($1)', [wallet]);
    if (!userRes.rows.length) {
      return res.json({ usdtBalance: 0, ppBalance: 0, plots: [], totalDeposited: 0 });
    }
    const user = userRes.rows[0];

    const claimsRes = await pool.query(
      `SELECT center_lat, center_lng, width, height, image_url, link_url, total_paid
       FROM claims WHERE LOWER(owner) = LOWER($1) AND deleted_at IS NULL ORDER BY created_at DESC`,
      [wallet]
    );

    const depRes = await pool.query(
      'SELECT COALESCE(SUM(amount), 0) as total FROM deposits WHERE LOWER(wallet_address) = LOWER($1)',
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
    const viewerWallet = getOptionalAuthWallet(req);

    const pxRes = await pool.query(
      'SELECT owner, price, claim_id FROM pixels WHERE lat = $1 AND lng = $2',
      [lat, lng]
    );

    if (!pxRes.rows.length) {
      const settings = await cfg();
      return res.json({ owner: null, price: settings.pixel_base_price || 0.1, claimId: null, imageUrl: null, linkUrl: null });
    }

    const px = pxRes.rows[0];
    if (px.owner) {
      try {
        const stealthRes = await pool.query(
          `SELECT 1 FROM user_active_effects
           WHERE LOWER(wallet) = LOWER($1)
             AND LOWER(wallet) <> LOWER($2)
             AND effect_type = 'stealth_cloak'
             AND active = true
             AND expires_at > NOW()
           LIMIT 1`,
          [px.owner, viewerWallet]
        );
        if (stealthRes.rows.length) {
          const settings = await cfg();
          return res.json({ owner: null, price: settings.pixel_base_price || 0.1, claimId: null, imageUrl: null, linkUrl: null });
        }
      } catch (visErr) {
        if (!isOptionalVisibilityError(visErr)) throw visErr;
      }
    }
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
    const viewerWallet = getOptionalAuthWallet(req);
    if (!q) {
      return res.status(400).json({ error: 'Search query is required (max 100 chars)' });
    }
    const visibleOwner = visibleOwnerPredicate('c.owner', 2);
    const result = await pool.query(
      `SELECT c.center_lat, c.center_lng, c.width, c.height, c.image_url, c.total_paid, c.owner,
              u.nickname
       FROM claims c
       LEFT JOIN users u ON u.wallet_address = c.owner
       WHERE (LOWER(c.owner) LIKE $1 OR LOWER(COALESCE(u.nickname,'')) LIKE $1)
         AND c.deleted_at IS NULL
         AND ${visibleOwner}
       ORDER BY c.created_at DESC LIMIT 50`,
      [`%${q}%`, viewerWallet]
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

router.get('/pixels', async (req, res) => {
  try {
    const viewerWallet = getOptionalAuthWallet(req);
    const cacheKey = `pixels:${viewerWallet || 'public'}`;
    const byOwner = await cachedSnapshot(pixelsCache, pixelsInFlight, cacheKey, PIXELS_CACHE_MS, async () => {
      const visibleOwner = visibleOwnerPredicate('p.owner', 1);
      let result;
      try {
        result = await pool.query(
          `SELECT p.lat, p.lng, p.owner, p.claim_id, p.price
           FROM pixels p
           WHERE p.owner IS NOT NULL
             AND ${visibleOwner}`,
          [viewerWallet]
        );
      } catch (visErr) {
        if (!isOptionalVisibilityError(visErr)) throw visErr;
        result = await pool.query(
          `SELECT p.lat, p.lng, p.owner, p.claim_id, p.price
           FROM pixels p
           WHERE p.owner IS NOT NULL`
        );
      }
      const nextByOwner = {};
      for (const row of result.rows) {
        if (!nextByOwner[row.owner]) nextByOwner[row.owner] = [];
        nextByOwner[row.owner].push([parseFloat(row.lat), parseFloat(row.lng), row.claim_id, parseFloat(row.price)]);
      }
      return nextByOwner;
    });
    res.json(byOwner);
  } catch (err) {
    console.error('[API] pixels error:', err.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

router.get('/claims', async (req, res) => {
  try {
    const rawSince = req.query.since;
    let since = null;
    if (rawSince !== undefined) {
      const parsedSince = Number.parseInt(String(rawSince), 10);
      if (Number.isFinite(parsedSince) && parsedSince > 0) {
        since = Math.min(parsedSince, Date.now() + 60 * 1000);
      }
    }
    const viewerWallet = getOptionalAuthWallet(req);
    const visibleOwner = visibleOwnerPredicate('c.owner', since ? 2 : 1);
    const cacheKey = `claims:${since ? 'delta:' + since : 'full'}:${viewerWallet || 'public'}`;
    const cacheTtl = since ? CLAIMS_DELTA_CACHE_MS : CLAIMS_FULL_CACHE_MS;
    const claims = await cachedSnapshot(claimsCache, claimsInFlight, cacheKey, cacheTtl, async () => {
    let result;
    if (since) {
      const sql = `SELECT c.id, c.owner, c.center_lat, c.center_lng, c.width, c.height,
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
           AND ${visibleOwner}
         ORDER BY c.created_at DESC LIMIT 5000`;
      try {
        result = await pool.query(sql, [new Date(parseInt(since)), viewerWallet]);
      } catch (visErr) {
        if (!isOptionalClaimDecorationError(visErr)) throw visErr;
        result = await pool.query(buildClaimsFallbackSql(true), [new Date(parseInt(since))]);
      }
    } else {
      const sql = `SELECT c.id, c.owner, c.center_lat, c.center_lng, c.width, c.height,
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
           AND ${visibleOwner}
         ORDER BY c.created_at DESC LIMIT 5000`;
      try {
        result = await pool.query(sql, [viewerWallet]);
      } catch (visErr) {
        if (!isOptionalClaimDecorationError(visErr)) throw visErr;
        result = await pool.query(buildClaimsFallbackSql(false));
      }
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

    return result.rows.map((row) => ({
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
    }));
    });
    res.json(claims);
  } catch (err) {
    console.error('[API] claims error:', err.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

router.get('/hijack/defender-info', readLimiter, async (req, res) => {
  try {
    const targetWallet = (req.query.targetWallet || '').toLowerCase().trim();
    if (!targetWallet || targetWallet.length < 10) return res.status(400).json({ error: 'target_wallet_required' });
    const result = await pool.query(
      `SELECT COUNT(DISTINCT f.id)::int AS fleet_count,
              COUNT(DISTINCT s.id) FILTER (WHERE s.is_alive = true)::int AS alive_ships,
              COUNT(DISTINCT f.id) FILTER (WHERE COALESCE(f.is_in_battle, false) = false)::int AS available_fleets
         FROM fleets f
         LEFT JOIN ships s ON s.fleet_id = f.id
        WHERE f.owner_wallet = $1`,
      [targetWallet]
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
        WHERE LOWER(c.owner) = LOWER($1) AND c.deleted_at IS NULL
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
