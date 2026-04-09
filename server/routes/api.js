const express = require('express');
const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const { pool, ensureUser, getSettings, getSetting, getActiveEvents, getReferralChain, generateReferralCode, awardXP } = require('../db');
const { generateWithdrawSignature, CHAINS } = require('../services/signer');
const { recalculateGovernor, recalculateCommander, collectTax, getActiveSectorBuffs, hasActiveEvent } = require('../services/governance');

const router = express.Router();
const UPLOADS_DIR = path.join(__dirname, '..', '..', 'uploads');

// ── Rate Limiters ──
const readLimiter = rateLimit({
  windowMs: 60 * 1000, max: 120,
  standardHeaders: true, legacyHeaders: false,
  message: { error: 'Too many requests. Please slow down.' }
});
const writeLimiter = rateLimit({
  windowMs: 60 * 1000, max: 30,
  standardHeaders: true, legacyHeaders: false,
  message: { error: 'Too many write requests. Please wait.' }
});
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 20,
  standardHeaders: true, legacyHeaders: false,
  message: { error: 'Too many login attempts. Try again later.' }
});
const harvestLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, max: 10,
  standardHeaders: true, legacyHeaders: false,
  message: { error: 'Harvest rate limit exceeded.' }
});

// ── Shared input sanitizer ──
function sanitize(str, maxLen) {
  if (typeof str !== 'string') return '';
  return str.trim().slice(0, maxLen).replace(/<[^>]*>/g, '');
}

const GRID_SIZE = 0.22;

// ── URL sanitization ──
function sanitizeUrl(url, allowData) {
  if (!url) return null;
  url = url.trim();
  if (allowData && url.startsWith('data:image/')) return url;
  if (url.startsWith('https://')) return url;
  if (url.startsWith('/uploads/')) return url;
  return null;
}

// ── Dynamic settings (cached, refreshed every 30s) ──
let cachedSettings = null;
let settingsLastFetch = 0;
async function cfg() {
  if (!cachedSettings || Date.now() - settingsLastFetch > 30000) {
    cachedSettings = await getSettings();
    settingsLastFetch = Date.now();
  }
  return cachedSettings;
}

// ── Active events with bonus calculation ──
async function getDepositBonusPercent() {
  const s = await cfg();
  let bonus = s.deposit_pp_bonus || 10;
  // Check active events for bonus boost
  const events = await getActiveEvents();
  for (const ev of events) {
    if (ev.type === 'deposit_bonus' && ev.config && ev.config.extra_pp_percent) {
      bonus += ev.config.extra_pp_percent;
    }
  }
  return bonus;
}

// ── Helpers ──

// Point-in-polygon (ray-casting algorithm)
function pointInPolygon(lng, lat, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0], yi = polygon[i][1];
    const xj = polygon[j][0], yj = polygon[j][1];
    if ((yi > lat) !== (yj > lat) && lng < (xj - xi) * (lat - yi) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

// Cached sectors for sector lookup
let _sectorsCache = null;
let _sectorsCacheAt = 0;
async function getSectorsForLookup() {
  if (_sectorsCache && Date.now() - _sectorsCacheAt < 60000) return _sectorsCache;
  const res = await pool.query('SELECT id, tier, bounds_polygon, lat_min, lat_max, lng_min, lng_max, base_price FROM sectors');
  _sectorsCache = res.rows;
  _sectorsCacheAt = Date.now();
  return _sectorsCache;
}

// Find sector_id for a pixel coordinate
async function findSectorForPixel(lat, lng) {
  const sectors = await getSectorsForLookup();
  return _findSectorSync(sectors, lat, lng);
}

// Sync version using pre-cached sectors
function findSectorForPixelSync(lat, lng) {
  if (!_sectorsCache) return null;
  return _findSectorSync(_sectorsCache, lat, lng);
}

function _findSectorSync(sectors, lat, lng) {
  for (const s of sectors) {
    if (lat < parseFloat(s.lat_min) || lat > parseFloat(s.lat_max)) continue;
    if (lng < parseFloat(s.lng_min) || lng > parseFloat(s.lng_max)) continue;
    if (s.bounds_polygon && Array.isArray(s.bounds_polygon) && s.bounds_polygon.length >= 3) {
      if (pointInPolygon(lng, lat, s.bounds_polygon)) return s.id;
    } else {
      return s.id;
    }
  }
  return null;
}

// Get sector tier-based price for a pixel coordinate using admin settings
// _sectorPriceSettings is set at claim time from cfg()
let _sectorPriceSettings = null;
function getSectorPriceSync(lat, lng, fallback) {
  if (!_sectorsCache) return fallback;
  for (const s of _sectorsCache) {
    if (lat < parseFloat(s.lat_min) || lat > parseFloat(s.lat_max)) continue;
    if (lng < parseFloat(s.lng_min) || lng > parseFloat(s.lng_max)) continue;
    let match = false;
    if (s.bounds_polygon && Array.isArray(s.bounds_polygon) && s.bounds_polygon.length >= 3) {
      match = pointInPolygon(lng, lat, s.bounds_polygon);
    } else {
      match = true;
    }
    if (match) {
      // Use admin settings per tier, fallback to sector's own base_price
      if (_sectorPriceSettings) {
        if (s.tier === 'core') return _sectorPriceSettings.core;
        if (s.tier === 'mid') return _sectorPriceSettings.mid;
        if (s.tier === 'frontier') return _sectorPriceSettings.frontier;
      }
      return parseFloat(s.base_price) || fallback;
    }
  }
  return fallback;
}

// awardXP is now imported from db.js

// ── Quest Reward Pool: fund from fees ──
async function fundQuestPool(client, feeAmount) {
  if (!feeAmount || feeAmount <= 0) return;
  try {
    const s = await cfg();
    const rate = parseFloat(s.quest_pool_fee_rate) || 0.20;
    const contribution = Math.round(feeAmount * rate * 10000) / 10000;
    if (contribution <= 0) return;
    await client.query(`
      UPDATE quest_reward_pool SET
        balance = balance + $1,
        total_funded = total_funded + $1,
        updated_at = NOW()
      WHERE id = 1
    `, [contribution]);
  } catch (e) {
    console.warn('[QuestPool] fund error:', e.message);
  }
}

function snapGrid(val) {
  return Math.round(parseFloat(val) * 100) / 100;
}

function getClaimPixels(lat, lng, w, h) {
  const pixels = [];
  const gs = GRID_SIZE;
  const gsI = Math.round(gs * 100); // integer grid step (22 for 0.22)
  const halfW = (w * gs) / 2, halfH = (h * gs) / 2;
  const minLat = lat - halfH, maxLat = lat + halfH;
  const minLng = lng - halfW, maxLng = lng + halfW;
  // Use integer math to avoid floating-point accumulation errors
  const startLatI = Math.ceil(Math.round(minLat * 100) / gsI) * gsI;
  const startLngI = Math.ceil(Math.round(minLng * 100) / gsI) * gsI;
  const maxLatI = Math.round(maxLat * 100);
  const maxLngI = Math.round(maxLng * 100);
  for (let iLat = startLatI; iLat < maxLatI; iLat += gsI) {
    for (let iLng = startLngI; iLng < maxLngI; iLng += gsI) {
      const sLat = iLat / 100, sLng = iLng / 100;
      if (sLat >= -70 && sLat <= 70) pixels.push({ lat: sLat, lng: sLng });
    }
  }
  return pixels;
}

// ══════════════════════════════════════════════════
//  GET /api/config — public game config + active events
// ══════════════════════════════════════════════════
router.get('/config', readLimiter, async (req, res) => {
  try {
    const s = await cfg();
    const events = await getActiveEvents();
    const bonusPct = await getDepositBonusPercent();

    // Governance data for frontend (wrapped to prevent config endpoint failure)
    let govData = { commander: null, commanderAnnouncement: '', activeGovEvents: [], activeBounties: 0 };
    try {
      const { getActiveGovEvents, getCommanderInfo } = require('../services/governance');
      const govEvents = await getActiveGovEvents();
      const cmdInfo = await getCommanderInfo();
      govData = {
        commander: cmdInfo.commander,
        commanderAnnouncement: cmdInfo.announcement,
        activeGovEvents: govEvents.map(e => ({ type: e.event_type, endsAt: e.ends_at })),
        activeBounties: (cmdInfo.activeBounties || []).length
      };
    } catch (ge) { console.warn('[GOV] config governance data failed:', ge.message); }

    res.json({
      pixelBasePrice: s.pixel_base_price || 0.1,
      sectorPrices: {
        core: s.price_pixel_core || 0.15,
        mid: s.price_pixel_mid || 0.05,
        frontier: s.price_pixel_frontier || 0.02
      },
      hijackMultiplier: s.hijack_multiplier || 1.2,
      depositPPBonus: bonusPct,
      swapFeePercent: s.swap_fee_percent || 5,
      withdrawFeePercent: s.withdraw_fee_percent || 0,
      minDeposit: s.min_deposit || 1,
      maxDeposit: s.max_deposit || 100000,
      maxClaimWidth: s.max_claim_width || 500,
      maxClaimHeight: s.max_claim_height || 500,
      minWithdraw: s.min_withdraw || 10,
      announcement: s.announcement || '',
      maintenanceMode: s.maintenance_mode || false,
      activeEvents: events.map(e => ({
        id: e.id, name: e.name, type: e.type,
        config: e.config,
        startsAt: e.starts_at, endsAt: e.ends_at
      })),
      governance: govData
    });
  } catch (e) {
    console.error('[API] config error:', e.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

// ══════════════════════════════════════════════════
//  POST /api/referral/register — Register referral
// ══════════════════════════════════════════════════
router.post('/referral/register', async (req, res) => {
  const { wallet, referralCode } = req.body;
  if (!wallet || !referralCode) return res.status(400).json({ error: 'Missing wallet or referralCode' });

  try {
    const w = wallet.toLowerCase();
    await ensureUser(pool, w);

    // Check if already has a referrer
    const userRes = await pool.query('SELECT referred_by FROM users WHERE wallet_address = $1', [w]);
    if (userRes.rows[0].referred_by) {
      return res.status(400).json({ error: 'Already has a referrer' });
    }

    // Find referrer by code
    const refRes = await pool.query('SELECT wallet_address FROM users WHERE referral_code = $1', [referralCode.toUpperCase()]);
    if (!refRes.rows.length) return res.status(404).json({ error: 'Invalid referral code' });

    const referrer = refRes.rows[0].wallet_address;
    if (referrer === w) return res.status(400).json({ error: 'Cannot refer yourself' });

    // Set referrer
    await pool.query('UPDATE users SET referred_by = $1 WHERE wallet_address = $2', [referrer, w]);

    res.json({ success: true, referrer: referrer.slice(0, 6) + '...' + referrer.slice(-4) });
  } catch (e) {
    console.error('[API] referral register error:', e.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

// ══════════════════════════════════════════════════
//  GET /api/referral/:wallet — Get referral info
// ══════════════════════════════════════════════════
router.get('/referral/:wallet', async (req, res) => {
  try {
    const w = req.params.wallet.toLowerCase();
    const userRes = await pool.query(
      'SELECT referral_code, referred_by FROM users WHERE wallet_address = $1', [w]
    );
    if (!userRes.rows.length) return res.json({ code: null, referredBy: null, referrals: 0, totalEarned: 0 });

    let code = userRes.rows[0].referral_code;
    // Auto-generate code if none
    if (!code) {
      code = generateReferralCode();
      await pool.query('UPDATE users SET referral_code = $1 WHERE wallet_address = $2', [code, w]);
    }

    // Count direct referrals
    const refCount = await pool.query('SELECT COUNT(*) as cnt FROM users WHERE referred_by = $1', [w]);

    // Total earned from referrals
    const earned = await pool.query(
      'SELECT COALESCE(SUM(pp_amount), 0) as total FROM referral_rewards WHERE to_wallet = $1', [w]
    );

    // Tier breakdown
    const tiers = await pool.query(
      `SELECT tier, COUNT(*) as cnt, COALESCE(SUM(pp_amount), 0) as total
       FROM referral_rewards WHERE to_wallet = $1 GROUP BY tier ORDER BY tier`, [w]
    );

    res.json({
      code,
      referredBy: userRes.rows[0].referred_by,
      referrals: parseInt(refCount.rows[0].cnt),
      totalEarned: parseFloat(earned.rows[0].total),
      tiers: tiers.rows.map(t => ({ tier: t.tier, count: parseInt(t.cnt), earned: parseFloat(t.total) }))
    });
  } catch (e) {
    console.error('[API] referral info error:', e.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

// ══════════════════════════════════════════════════
//  GET /api/user/:wallet
// ══════════════════════════════════════════════════
router.get('/user/:wallet', async (req, res) => {
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
      plots: claimsRes.rows.map(c => ({
        lat: parseFloat(c.center_lat), lng: parseFloat(c.center_lng),
        width: c.width, height: c.height,
        imageUrl: c.image_url, linkUrl: c.link_url,
        price: parseFloat(c.total_paid)
      })),
      totalDeposited: parseFloat(depRes.rows[0].total)
    });
  } catch (e) {
    console.error('[API] user error:', e.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

// ══════════════════════════════════════════════════
//  GET /api/pixel/:lat/:lng
// ══════════════════════════════════════════════════
router.get('/pixel/:lat/:lng', async (req, res) => {
  try {
    const lat = snapGrid(req.params.lat);
    const lng = snapGrid(req.params.lng);

    const pxRes = await pool.query(
      'SELECT owner, price, claim_id FROM pixels WHERE lat = $1 AND lng = $2',
      [lat, lng]
    );

    if (!pxRes.rows.length) {
      const s = await cfg();
      return res.json({ owner: null, price: s.pixel_base_price || 0.1, claimId: null, imageUrl: null, linkUrl: null });
    }

    const px = pxRes.rows[0];
    let imageUrl = null, originalImageUrl = null, linkUrl = null;
    if (px.claim_id) {
      const claimRes = await pool.query('SELECT image_url, original_image_url, link_url FROM claims WHERE id = $1', [px.claim_id]);
      if (claimRes.rows.length) {
        imageUrl = claimRes.rows[0].image_url;
        originalImageUrl = claimRes.rows[0].original_image_url || null;
        linkUrl = claimRes.rows[0].link_url;
      }
    }

    res.json({
      owner: px.owner, price: parseFloat(px.price),
      claimId: px.claim_id, imageUrl, originalImageUrl, linkUrl
    });
  } catch (e) {
    console.error('[API] pixel error:', e.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

// ══════════════════════════════════════════════════
//  GET /api/search/owner/:query
// ══════════════════════════════════════════════════
router.get('/search/owner/:query', async (req, res) => {
  try {
    const q = sanitize(req.params.query, 100).toLowerCase();
    if (!q) {
      return res.status(400).json({ error: 'Search query is required (max 100 chars)' });
    }
    const result = await pool.query(
      `SELECT center_lat, center_lng, width, height, image_url, total_paid, owner
       FROM claims WHERE LOWER(owner) LIKE $1 AND deleted_at IS NULL
       ORDER BY created_at DESC LIMIT 50`,
      [`%${q}%`]
    );

    res.json(result.rows.map(r => ({
      lat: parseFloat(r.center_lat), lng: parseFloat(r.center_lng),
      width: r.width, height: r.height,
      imageUrl: r.image_url, price: parseFloat(r.total_paid), owner: r.owner
    })));
  } catch (e) {
    console.error('[API] search error:', e.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

// ══════════════════════════════════════════════════
// ══════════════════════════════════════════════════
//  GET /api/pixels — actual pixel ownership (authoritative)
// ══════════════════════════════════════════════════
router.get('/pixels', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT lat, lng, owner, claim_id, price FROM pixels WHERE owner IS NOT NULL`
    );
    // Compact format: group by owner → [[lat, lng, claimId, price], ...]
    const byOwner = {};
    for (const r of result.rows) {
      const o = r.owner;
      if (!byOwner[o]) byOwner[o] = [];
      byOwner[o].push([parseFloat(r.lat), parseFloat(r.lng), r.claim_id, parseFloat(r.price)]);
    }
    res.json(byOwner);
  } catch (e) {
    console.error('[API] pixels error:', e.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

//  GET /api/claims — all active claims (for frontend init)
// ══════════════════════════════════════════════════
router.get('/claims', async (req, res) => {
  try {
    const since = req.query.since;
    let result;
    if (since) {
      result = await pool.query(
        `SELECT c.id, c.owner, c.center_lat, c.center_lng, c.width, c.height,
                c.image_url, c.original_image_url, c.link_url, c.total_paid, c.created_at,
                c.img_scale, c.img_rotate, c.img_offset_x, c.img_offset_y,
                u.nickname,
                ps.shield_type, ps.hp AS shield_hp, ps.max_hp AS shield_max_hp, ps.expires_at AS shield_expires
         FROM claims c LEFT JOIN users u ON c.owner = u.wallet_address
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
                u.nickname,
                ps.shield_type, ps.hp AS shield_hp, ps.max_hp AS shield_max_hp, ps.expires_at AS shield_expires
         FROM claims c LEFT JOIN users u ON c.owner = u.wallet_address
         LEFT JOIN pixel_shields ps ON ps.claim_id = c.id AND ps.expires_at > NOW()
         WHERE c.deleted_at IS NULL
         ORDER BY c.created_at DESC LIMIT 5000`
      );
    }
    res.json(result.rows.map(r => ({
      id: r.id, owner: r.owner,
      lat: parseFloat(r.center_lat), lng: parseFloat(r.center_lng),
      w: r.width, h: r.height,
      imgUrl: r.image_url, originalImgUrl: r.original_image_url || null,
      link: r.link_url,
      price: parseFloat(r.total_paid),
      nickname: r.nickname || null,
      label: r.nickname || (r.owner.slice(0, 6) + '...' + r.owner.slice(-4)),
      imgScale: r.img_scale ? parseFloat(r.img_scale) : 100,
      imgRotate: r.img_rotate ? parseFloat(r.img_rotate) : 0,
      imgOffsetX: r.img_offset_x || 0,
      imgOffsetY: r.img_offset_y || 0,
      ts: new Date(r.created_at).getTime(),
      shield: r.shield_type ? { type: r.shield_type, hp: r.shield_hp, maxHp: r.shield_max_hp, expires: new Date(r.shield_expires).getTime() } : null
    })));
  } catch (e) {
    console.error('[API] claims error:', e.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

// ══════════════════════════════════════════════════
//  POST /api/upload — save data:image to file, return URL
// ══════════════════════════════════════════════════
router.post('/upload', writeLimiter, async (req, res) => {
  const { dataUrl } = req.body;
  if (!dataUrl || typeof dataUrl !== 'string') {
    return res.status(400).json({ error: 'Missing dataUrl' });
  }

  // Validate data URL format
  const match = dataUrl.match(/^data:image\/(png|jpeg|jpg|gif|webp);base64,(.+)$/);
  if (!match) {
    return res.status(400).json({ error: 'Invalid data URL format' });
  }

  const ext = match[1] === 'jpeg' ? 'jpg' : match[1];
  const base64Data = match[2];
  const buffer = Buffer.from(base64Data, 'base64');

  // Max 5MB
  if (buffer.length > 5 * 1024 * 1024) {
    return res.status(400).json({ error: 'Image too large (max 5MB)' });
  }

  try {
    // Ensure uploads dir exists
    if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

    const filename = crypto.randomBytes(16).toString('hex') + '.' + ext;
    const filepath = path.join(UPLOADS_DIR, filename);
    fs.writeFileSync(filepath, buffer);

    const url = '/uploads/' + filename;
    res.json({ success: true, url });
  } catch (e) {
    console.error('[API] upload error:', e.message);
    res.status(500).json({ error: 'Upload failed' });
  }
});

// ══════════════════════════════════════════════════
//  POST /api/claim
// ══════════════════════════════════════════════════
router.post('/claim', writeLimiter, async (req, res) => {
  const { wallet, lat, lng, width, height, imageUrl, originalImageUrl, linkUrl, payMethod } = req.body;
  if (!wallet || lat == null || lng == null || !width || !height) {
    return res.status(400).json({ error: 'Missing fields' });
  }

  // ── Input validation ──
  const parsedLat = parseFloat(lat);
  const parsedLng = parseFloat(lng);
  if (isNaN(parsedLat) || parsedLat < -70 || parsedLat > 70) {
    return res.status(400).json({ error: 'Invalid latitude (must be between -70 and 70)' });
  }
  if (isNaN(parsedLng) || parsedLng < -180 || parsedLng > 180) {
    return res.status(400).json({ error: 'Invalid longitude (must be between -180 and 180)' });
  }

  const parsedW = parseInt(width);
  const parsedH = parseInt(height);
  if (!Number.isInteger(parsedW) || parsedW <= 0 || parsedW > 500) {
    return res.status(400).json({ error: 'Invalid width (must be positive integer, max 500)' });
  }
  if (!Number.isInteger(parsedH) || parsedH <= 0 || parsedH > 500) {
    return res.status(400).json({ error: 'Invalid height (must be positive integer, max 500)' });
  }

  // Validate URL lengths
  if (imageUrl && typeof imageUrl === 'string' && imageUrl.length > 2048) {
    return res.status(400).json({ error: 'Image URL too long (max 2048 chars)' });
  }
  if (linkUrl && typeof linkUrl === 'string' && linkUrl.length > 512) {
    return res.status(400).json({ error: 'Link URL too long (max 512 chars)' });
  }

  // Sanitize URLs
  const safeImageUrl = sanitizeUrl(imageUrl, true);
  if (imageUrl && !safeImageUrl) {
    return res.status(400).json({ error: 'Invalid image URL (must start with data:image/ or https://)' });
  }
  const safeLinkUrl = sanitizeUrl(linkUrl, false);
  if (linkUrl && !safeLinkUrl) {
    return res.status(400).json({ error: 'Invalid link URL (must start with https://)' });
  }
  const safeOriginalImageUrl = sanitizeUrl(originalImageUrl, true) || null;

  const client = await pool.connect();
  const s = await cfg();
  const PIXEL_PRICE = s.pixel_base_price || 0.1;
  const HIJACK_MULT = s.hijack_multiplier || 1.2;
  const OWNER_BONUS_PCT = (s.hijack_owner_bonus || 50) / 100;
  await getSectorsForLookup(); // ensure sector cache for price lookup
  _sectorPriceSettings = {
    core: s.price_pixel_core || 0.15,
    mid: s.price_pixel_mid || 0.05,
    frontier: s.price_pixel_frontier || 0.02
  };

  try {
    // Maintenance check
    if (s.maintenance_mode) {
      return res.status(503).json({ error: 'Maintenance mode — transactions disabled' });
    }

    // Check peace treaty — blocks all hijacks (safe: fallback to false if governance tables missing)
    let _isPeaceTreaty = false;
    try { _isPeaceTreaty = await hasActiveEvent('peace_treaty'); } catch(ge) { console.warn('[GOV] peace check failed:', ge.message); }

    await client.query('BEGIN');
    await ensureUser(client, wallet.toLowerCase());

    const claimW = parseInt(width), claimH = parseInt(height);
    if (claimW > (s.max_claim_width || 500) || claimH > (s.max_claim_height || 500)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Claim too large', maxWidth: s.max_claim_width, maxHeight: s.max_claim_height });
    }

    const pixels = getClaimPixels(parseFloat(lat), parseFloat(lng), claimW, claimH);
    if (!pixels.length) throw new Error('No pixels in range');

    // ── BATCH: Lock and read all affected pixels in one query ──
    let baseCost = 0, attackCost = 0, overlapCount = 0, newCount = 0, ownSkipCount = 0;
    const affectedOwners = {}; // owner → { refund, bonus }
    const ATTACK_SUCCESS_RATE = s.attack_success_rate || 50; // % chance to win attack

    // Build VALUES list for batch lookup
    const pxCoords = pixels.map((p, i) => `($${i*2+1}::numeric, $${i*2+2}::numeric)`).join(',');
    const pxParams = pixels.flatMap(p => [p.lat, p.lng]);
    const existingRes = await client.query(
      `SELECT lat, lng, owner, price FROM pixels WHERE (lat, lng) IN (${pxCoords}) AND owner IS NOT NULL FOR UPDATE`,
      pxParams
    );

    // Build lookup map of existing pixels
    // IMPORTANT: parseFloat() to normalize DECIMAL(8,2) strings (e.g. "1.10" → 1.1)
    // so keys match JS number toString format used in lookups
    const existingMap = {};
    for (const row of existingRes.rows) {
      existingMap[parseFloat(row.lat) + ',' + parseFloat(row.lng)] = row;
    }

    // ── Governance: cache sector buffs for discount (safe: fallback if governance fails) ──
    const _sectorBuffCache = {};
    async function _getBuffDiscount(sectorId) {
      try {
        if (!sectorId) return 0;
        if (_sectorBuffCache[sectorId] !== undefined) return _sectorBuffCache[sectorId];
        const buffs = await getActiveSectorBuffs(sectorId);
        const disc = buffs.find(b => b.buff_type === 'claim_discount');
        _sectorBuffCache[sectorId] = disc ? parseFloat(disc.effect_value) / 100 : 0;
        return _sectorBuffCache[sectorId];
      } catch(ge) { return 0; }
    }
    let _isWarTime = false;
    try { _isWarTime = await hasActiveEvent('war_time'); } catch(ge) { console.warn('[GOV] war check failed:', ge.message); }

    // Separate pixels into: new, own (skip), enemy (attack)
    const newPixels = [];
    const enemyPixels = [];
    const walletLower = wallet.toLowerCase();

    for (const p of pixels) {
      const existing = existingMap[p.lat + ',' + p.lng];
      if (existing) {
        if (existing.owner === walletLower) {
          ownSkipCount++;
        } else {
          // Peace treaty blocks all hijacks
          if (_isPeaceTreaty) {
            await client.query('ROLLBACK');
            client.release();
            return res.status(400).json({ error: 'Peace Treaty active — hijacking is temporarily disabled' });
          }
          // Enemy pixel — attack (war_time gives 20% discount)
          let pxCost = parseFloat(existing.price) * HIJACK_MULT;
          if (_isWarTime) pxCost = Math.round(pxCost * 0.8 * 1000000) / 1000000;
          attackCost += pxCost;
          overlapCount++;
          const prevOwner = existing.owner;
          if (!affectedOwners[prevOwner]) affectedOwners[prevOwner] = { refund: 0, bonus: 0, attackedPixels: 0 };
          affectedOwners[prevOwner].attackedPixels++;
          enemyPixels.push({ ...p, existing });
        }
      } else {
        let sectorPrice = getSectorPriceSync(p.lat, p.lng, PIXEL_PRICE);
        // Apply claim discount buff
        const sId = findSectorForPixelSync(p.lat, p.lng);
        const disc = await _getBuffDiscount(sId);
        if (disc > 0) sectorPrice = Math.round(sectorPrice * (1 - disc) * 1000000) / 1000000;
        baseCost += sectorPrice;
        newCount++;
        newPixels.push({ ...p, sectorPrice });
      }
    }

    // ── BATTLE: Roll ONCE per defender (all-or-nothing per owner overlap) ──
    let attackWon = 0, attackLost = 0, refundFromFailed = 0, platformFee = 0;
    const wonPixels = [];

    // Group enemy pixels by owner
    const enemyByOwner = {};
    for (const ep of enemyPixels) {
      const prevOwner = ep.existing.owner;
      if (!enemyByOwner[prevOwner]) enemyByOwner[prevOwner] = [];
      enemyByOwner[prevOwner].push(ep);
    }

    for (const [prevOwner, ownerPixels] of Object.entries(enemyByOwner)) {
      // Defense bonus buff: check if defender's sector has defense_bonus active
      let effectiveSuccessRate = ATTACK_SUCCESS_RATE;
      try {
        const defSectorId = ownerPixels[0] && ownerPixels[0].existing ? findSectorForPixelSync(ownerPixels[0].lat, ownerPixels[0].lng) : null;
        if (defSectorId) {
          const defBuffs = await getActiveSectorBuffs(defSectorId);
          const defBuff = defBuffs.find(b => b.buff_type === 'defense_bonus');
          if (defBuff) effectiveSuccessRate = Math.max(0, effectiveSuccessRate - parseFloat(defBuff.effect_value));
        }
      } catch(ge) { /* governance unavailable, use base rate */ }
      const roll = Math.random() * 100;
      if (roll < effectiveSuccessRate) {
        // Attack SUCCESS — take ALL pixels from this owner
        for (const ep of ownerPixels) {
          const pxCost = parseFloat(ep.existing.price) * HIJACK_MULT;
          attackWon++;
          wonPixels.push(ep);
          affectedOwners[prevOwner].refund += parseFloat(ep.existing.price);
          affectedOwners[prevOwner].bonus += (pxCost - parseFloat(ep.existing.price)) * OWNER_BONUS_PCT;
        }
      } else {
        // Attack FAILED — don't touch ANY of this owner's pixels
        for (const ep of ownerPixels) {
          const pxCost = parseFloat(ep.existing.price) * HIJACK_MULT;
          attackLost++;
          const failRefund = pxCost * 0.9;
          const failFee = pxCost * 0.1;
          refundFromFailed += failRefund;
          platformFee += failFee;
        }
      }
    }

    // ── If ALL battles lost, keep newPixels (non-overlapping empty land is still claimed) ──
    const totalDefeat = attackLost > 0 && attackWon === 0;

    // Actual cost = new pixels + won attacks + failed attack fees (lost 10%)
    const wonAttackCost = wonPixels.reduce((sum, ep) => sum + parseFloat(ep.existing.price) * HIJACK_MULT, 0);
    const failedAttackCost = attackLost > 0 ? (attackCost - wonAttackCost) : 0;
    const totalCost = Math.round((baseCost + wonAttackCost + failedAttackCost - refundFromFailed) * 1000000) / 1000000;

    // Check user balance based on selected payment method
    const userRes = await client.query(
      'SELECT usdt_balance, pp_balance FROM users WHERE wallet_address = $1 FOR UPDATE',
      [wallet.toLowerCase()]
    );
    const user = userRes.rows[0];
    let ppUsed = 0, usdtUsed = 0;
    const ppBal = parseFloat(user.pp_balance);
    const usdtBal = parseFloat(user.usdt_balance);
    const method = payMethod || 'pp';

    if (method === 'usdt') {
      // USDT only
      if (usdtBal < totalCost) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Insufficient USDT balance', required: totalCost, usdtBalance: usdtBal });
      }
      usdtUsed = totalCost;
    } else {
      // PP only
      if (ppBal < totalCost) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Insufficient PP balance', required: totalCost, ppBalance: ppBal });
      }
      ppUsed = totalCost;
    }

    // Deduct from user
    await client.query(
      'UPDATE users SET pp_balance = pp_balance - $1, usdt_balance = usdt_balance - $2 WHERE wallet_address = $3',
      [ppUsed, usdtUsed, wallet.toLowerCase()]
    );

    // Credit hijacked owners (PP refund + bonus) — parallel
    const ownerCredits = Object.entries(affectedOwners).map(([owner, amounts]) =>
      client.query('UPDATE users SET pp_balance = pp_balance + $1 WHERE wallet_address = $2',
        [amounts.refund + amounts.bonus, owner])
    );
    if (ownerCredits.length) await Promise.all(ownerCredits);

    // Insert claim
    const claimRes = await client.query(
      `INSERT INTO claims (owner, center_lat, center_lng, width, height, image_url, original_image_url, link_url, total_paid)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
      [wallet.toLowerCase(), lat, lng, width, height, safeImageUrl, safeOriginalImageUrl, safeLinkUrl, totalCost]
    );
    const claimId = claimRes.rows[0].id;

    // ── Update claim dimensions if some battles were lost ──
    const claimPixels = [...newPixels, ...wonPixels];
    if (attackLost > 0 && claimPixels.length > 0) {
      let mnLat = Infinity, mxLat = -Infinity, mnLng = Infinity, mxLng = -Infinity;
      for (const p of claimPixels) {
        if (p.lat < mnLat) mnLat = p.lat;
        if (p.lat > mxLat) mxLat = p.lat;
        if (p.lng < mnLng) mnLng = p.lng;
        if (p.lng > mxLng) mxLng = p.lng;
      }
      const newCenterLat = (mnLat + mxLat) / 2;
      const newCenterLng = (mnLng + mxLng) / 2;
      const newW = Math.round((mxLng - mnLng) / GRID_SIZE) + 1;
      const newH = Math.round((mxLat - mnLat) / GRID_SIZE) + 1;
      await client.query(
        'UPDATE claims SET center_lat=$1, center_lng=$2, width=$3, height=$4 WHERE id=$5',
        [newCenterLat, newCenterLng, newW, newH, claimId]
      );
    } else if (claimPixels.length === 0) {
      // Total defeat with no new pixels — delete empty claim
      await client.query('DELETE FROM claims WHERE id=$1', [claimId]);
    }

    // ── BATCH: Upsert only new + won pixels (skip own, skip failed attacks) ──
    // Use large batch (500) to minimize DB round trips
    // IMPORTANT: sequential execution on transaction client to avoid pg DeprecationWarning
    const batchSize = 500;
    for (let i = 0; i < claimPixels.length; i += batchSize) {
      const chunk = claimPixels.slice(i, i + batchSize);
      const values = [];
      const params = [];
      let paramIdx = 1;
      for (const p of chunk) {
        const existing = existingMap[p.lat + ',' + p.lng];
        const newPrice = existing ? parseFloat(existing.price) * HIJACK_MULT : (p.sectorPrice || getSectorPriceSync(p.lat, p.lng, PIXEL_PRICE));
        const sectorId = findSectorForPixelSync(p.lat, p.lng);
        values.push(`($${paramIdx},$${paramIdx+1},$${paramIdx+2},$${paramIdx+3},$${paramIdx+4},$${paramIdx+5},NOW())`);
        params.push(p.lat, p.lng, walletLower, newPrice, claimId, sectorId);
        paramIdx += 6;
      }
      if (values.length > 0) {
        await client.query(
          `INSERT INTO pixels (lat, lng, owner, price, claim_id, sector_id, updated_at)
           VALUES ${values.join(',')}
           ON CONFLICT (lat, lng) DO UPDATE SET owner=EXCLUDED.owner, price=EXCLUDED.price, claim_id=EXCLUDED.claim_id, sector_id=COALESCE(EXCLUDED.sector_id,pixels.sector_id), updated_at=NOW()`,
          params
        );
      }
    }

    // Record battle results (sequential)
    const battleResults = [];
    if (overlapCount > 0) {
      for (const [defender, info] of Object.entries(affectedOwners)) {
        const wonVs = wonPixels.filter(ep => ep.existing.owner === defender).length;
        const lostVs = info.attackedPixels - wonVs;
        const res2 = await client.query(
          `INSERT INTO battles (attacker, defender, claim_id, pixels_attacked, pixels_won, pixels_lost, attack_cost, refund_amount, platform_fee, success)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
          [walletLower, defender, claimId, info.attackedPixels, wonVs, lostVs,
           wonVs > 0 ? info.refund + info.bonus : 0,
           lostVs > 0 ? (lostVs * PIXEL_PRICE * HIJACK_MULT * 0.9) : 0,
           lostVs > 0 ? (lostVs * PIXEL_PRICE * HIJACK_MULT * 0.1) : 0,
           wonVs > lostVs]
        );
        battleResults.push({ id: res2.rows[0].id, defender: defender.slice(0,6)+'...', attacked: info.attackedPixels, won: wonVs, lost: lostVs });
      }
    }

    // XP calculation
    const xpPerClaim = s.xp_per_claim || 2;
    const xpPerHijack = s.xp_per_hijack || 3;
    const totalXP = (newCount * xpPerClaim) + (attackWon * xpPerHijack);

    // Transaction record
    const txType = attackWon > 0 ? 'hijack' : (attackLost > 0 ? 'battle_failed' : 'claim');
    const txRes = await client.query(
      `INSERT INTO transactions (type, from_wallet, usdt_amount, pp_amount, fee, meta)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
      [txType, wallet.toLowerCase(), usdtUsed, ppUsed, baseCost,
        JSON.stringify({
          claimId, totalPixels: claimPixels.length, newCount, attackWon, attackLost, ownSkipCount,
          affectedOwners, platformFee, refundFromFailed
        })]
    );
    const txId = txRes.rows[0].id;

    // XP + quest pool + refund (sequential)
    const rankUp = await awardXP(client, walletLower, totalXP);
    await fundQuestPool(client, baseCost);
    if (refundFromFailed > 0) {
      await client.query(
        'UPDATE users SET pp_balance = pp_balance + $1 WHERE wallet_address = $2',
        [refundFromFailed, walletLower]
      );
    }

    // ── Referral rewards on hijack (needs txId, so runs after) ──
    const referralRewards = [];
    if (overlapCount > 0 && (s.referral_enabled !== false)) {
      const tierPercents = [
        s.referral_tier1_percent || 15,
        s.referral_tier2_percent || 10,
        s.referral_tier3_percent || 5
      ];
      const chain = await getReferralChain(client, wallet.toLowerCase());
      const hijackPremium = wonAttackCost - Object.values(affectedOwners).reduce((sum, a) => sum + a.refund, 0);

      for (const ref of chain) {
        const pct = tierPercents[ref.tier - 1] || 0;
        if (pct <= 0) continue;
        const reward = Math.round(hijackPremium * (pct / 100) * 1000000) / 1000000;
        if (reward <= 0) continue;

        await client.query('UPDATE users SET pp_balance = pp_balance + $1 WHERE wallet_address = $2', [reward, ref.wallet]);
        await client.query(
          `INSERT INTO referral_rewards (from_wallet, to_wallet, tier, pp_amount, trigger_type, trigger_tx_id)
           VALUES ($1, $2, $3, $4, 'hijack', $5)`,
          [wallet.toLowerCase(), ref.wallet, ref.tier, reward, txId]
        );
        referralRewards.push({ tier: ref.tier, wallet: ref.wallet.slice(0, 6) + '...', reward });
      }
    }

    // ── Governance: collect tax per sector + recalculate positions (safe: won't break claim if governance fails) ──
    let totalTax = 0;
    try {
      const affectedSectors = new Set();
      for (const p of claimPixels) {
        const sId = findSectorForPixelSync(p.lat, p.lng);
        if (sId) affectedSectors.add(sId);
      }
      for (const sId of affectedSectors) {
        const sectorPixels = claimPixels.filter(p => findSectorForPixelSync(p.lat, p.lng) === sId);
        const sectorCost = (sectorPixels.length / claimPixels.length) * totalCost;
        if (sectorCost > 0) {
          const tax = await collectTax(client, sId, sectorCost, txType);
          totalTax += tax;
        }
        await recalculateGovernor(client, sId);
      }
      await recalculateCommander(client);
    } catch(ge) { console.warn('[GOV] governance post-claim failed:', ge.message); }

    await client.query('COMMIT');

    res.json({
      success: true, claimId, totalCost,
      newCount, overlapCount, ownSkipCount,
      attackWon, attackLost,
      refundFromFailed: Math.round(refundFromFailed * 100) / 100,
      platformFee: Math.round(platformFee * 100) / 100,
      ppUsed, usdtUsed, totalTax: Math.round(totalTax * 100) / 100,
      xpEarned: totalXP,
      rankUp: rankUp || null,
      referralRewards,
      battleResults,
      wonPixels: wonPixels.map(p => [p.lat, p.lng]),
      newPixels: newPixels.map(p => [p.lat, p.lng])
    });
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('[API] claim error:', e.message);
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
});

// ══════════════════════════════════════════════════
//  PUT /api/claim/:id/image — Update/add image to existing claim
// ══════════════════════════════════════════════════
router.put('/claim/:id/image', writeLimiter, async (req, res) => {
  const claimId = parseInt(req.params.id);
  const { wallet, imageUrl, originalImageUrl, imgScale, imgRotate, imgOffsetX, imgOffsetY, linkUrl } = req.body;
  if (!wallet || !claimId) return res.status(400).json({ error: 'Missing fields' });

  const safeImageUrl = sanitizeUrl(imageUrl, true);
  if (imageUrl && !safeImageUrl) {
    return res.status(400).json({ error: 'Invalid image URL' });
  }
  const safeOriginalImageUrl = sanitizeUrl(originalImageUrl, true) || null;
  const safeLinkUrl = linkUrl !== undefined ? (sanitizeUrl(linkUrl, false) || null) : undefined;

  try {
    // Verify ownership
    const claimRes = await pool.query(
      'SELECT id, owner FROM claims WHERE id = $1 AND deleted_at IS NULL',
      [claimId]
    );
    if (!claimRes.rows.length) return res.status(404).json({ error: 'Claim not found' });
    if (claimRes.rows[0].owner !== wallet.toLowerCase()) {
      return res.status(403).json({ error: 'Not your claim' });
    }

    // Update image, editing params, and link
    await pool.query(
      `UPDATE claims SET
        image_url = COALESCE($1, image_url),
        original_image_url = COALESCE($2, original_image_url),
        img_scale = COALESCE($3, img_scale),
        img_rotate = COALESCE($4, img_rotate),
        img_offset_x = COALESCE($5, img_offset_x),
        img_offset_y = COALESCE($6, img_offset_y),
        link_url = COALESCE($8, link_url)
      WHERE id = $7`,
      [safeImageUrl, safeOriginalImageUrl,
       imgScale != null ? imgScale : null,
       imgRotate != null ? imgRotate : null,
       imgOffsetX != null ? imgOffsetX : null,
       imgOffsetY != null ? imgOffsetY : null,
       claimId,
       safeLinkUrl !== undefined ? safeLinkUrl : null]
    );

    res.json({ success: true, claimId });
  } catch (e) {
    console.error('[API] claim image update error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ══════════════════════════════════════════════════
//  POST /api/swap — PP → USDT
// ══════════════════════════════════════════════════
router.post('/swap', writeLimiter, async (req, res) => {
  const { wallet, ppAmount } = req.body;
  if (!wallet || !ppAmount || ppAmount <= 0) return res.status(400).json({ error: 'Invalid input' });

  const parsedPP = Number(ppAmount);
  if (isNaN(parsedPP) || !isFinite(parsedPP) || parsedPP <= 0) {
    return res.status(400).json({ error: 'Amount must be a positive finite number' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const userRes = await client.query(
      'SELECT pp_balance FROM users WHERE wallet_address = $1 FOR UPDATE',
      [wallet.toLowerCase()]
    );
    if (!userRes.rows.length) throw new Error('User not found');

    const ppBal = parseFloat(userRes.rows[0].pp_balance);
    if (ppBal < ppAmount) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Insufficient PP', balance: ppBal });
    }

    const s = await cfg();
    const SWAP_FEE = (s.swap_fee_percent || 5) / 100;
    const fee = Math.round(ppAmount * SWAP_FEE * 1000000) / 1000000;
    const received = Math.round((ppAmount - fee) * 1000000) / 1000000;

    await client.query(
      'UPDATE users SET pp_balance = pp_balance - $1, usdt_balance = usdt_balance + $2 WHERE wallet_address = $3',
      [ppAmount, received, wallet.toLowerCase()]
    );

    await client.query(
      `INSERT INTO transactions (type, from_wallet, usdt_amount, pp_amount, fee, meta)
       VALUES ('swap', $1, $2, $3, $4, $5)`,
      [wallet.toLowerCase(), received, ppAmount, fee, JSON.stringify({ swapRate: 1, feePercent: s.swap_fee_percent || 5 })]
    );

    // Fund quest pool from swap fees
    await fundQuestPool(client, fee);

    await client.query('COMMIT');
    res.json({ success: true, received, fee, ppDeducted: ppAmount });
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('[API] swap error:', e.message);
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
});

// ══════════════════════════════════════════════════
//  POST /api/withdraw — USDT withdrawal (server signs)
// ══════════════════════════════════════════════════
router.post('/withdraw', writeLimiter, async (req, res) => {
  const { wallet, amount, chain } = req.body;
  if (!wallet || !amount || amount <= 0) return res.status(400).json({ error: 'Invalid input' });

  const parsedAmount = Number(amount);
  if (isNaN(parsedAmount) || !isFinite(parsedAmount) || parsedAmount <= 0) {
    return res.status(400).json({ error: 'Amount must be a positive finite number' });
  }

  const chainKey = chain || 'base';
  const VALID_CHAINS = ['base', 'bnb', 'eth'];
  if (!VALID_CHAINS.includes(chainKey)) {
    return res.status(400).json({ error: 'Invalid chain (must be one of: base, bnb, eth)' });
  }
  const chainCfg = CHAINS[chainKey];
  if (!chainCfg) return res.status(400).json({ error: 'Invalid chain' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const userRes = await client.query(
      'SELECT usdt_balance, withdrawal_nonce FROM users WHERE wallet_address = $1 FOR UPDATE',
      [wallet.toLowerCase()]
    );
    if (!userRes.rows.length) throw new Error('User not found');

    const bal = parseFloat(userRes.rows[0].usdt_balance);
    if (bal < amount) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Insufficient balance', balance: bal });
    }

    // Read and increment nonce
    const nonce = userRes.rows[0].withdrawal_nonce || 0;

    // Deduct from DB and increment nonce
    await client.query(
      'UPDATE users SET usdt_balance = usdt_balance - $1, withdrawal_nonce = withdrawal_nonce + 1 WHERE wallet_address = $2',
      [amount, wallet.toLowerCase()]
    );

    // Generate on-chain withdrawal signature
    const amountBN = ethers.utils.parseUnits(amount.toString(), chainCfg.decimals);
    const feeBN = ethers.BigNumber.from(0); // no fee on withdrawal for now

    const sigData = await generateWithdrawSignature(
      wallet, amountBN, feeBN, nonce, chainKey
    );

    await client.query(
      `INSERT INTO transactions (type, from_wallet, usdt_amount, fee, meta)
       VALUES ('withdraw', $1, $2, 0, $3)`,
      [wallet.toLowerCase(), amount, JSON.stringify({ chain: chainKey, nonce, deadline: sigData.deadline })]
    );

    await client.query('COMMIT');
    res.json({ success: true, ...sigData });
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('[API] withdraw error:', e.message);
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
});

// ══════════════════════════════════════════════════
//  POST /api/withdraw-all — full withdrawal + pixel reset
// ══════════════════════════════════════════════════
router.post('/withdraw-all', writeLimiter, async (req, res) => {
  const { wallet, chain } = req.body;
  if (!wallet) return res.status(400).json({ error: 'Missing wallet' });

  const chainKey = chain || 'base';
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const userRes = await client.query(
      'SELECT usdt_balance, pp_balance, withdrawal_nonce FROM users WHERE wallet_address = $1 FOR UPDATE',
      [wallet.toLowerCase()]
    );
    if (!userRes.rows.length) throw new Error('User not found');

    const usdtBal = parseFloat(userRes.rows[0].usdt_balance);
    const ppBal = parseFloat(userRes.rows[0].pp_balance);
    const nonce = userRes.rows[0].withdrawal_nonce || 0;
    const s = await cfg();
    const swapFeePct = (s.swap_fee_percent || 5) / 100;
    const ppFee = Math.round(ppBal * swapFeePct * 1000000) / 1000000;
    const totalOut = Math.round((usdtBal + ppBal - ppFee) * 1000000) / 1000000;

    if (totalOut <= 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Nothing to withdraw' });
    }

    // Zero balances and increment nonce
    await client.query(
      'UPDATE users SET usdt_balance = 0, pp_balance = 0, withdrawal_nonce = withdrawal_nonce + 1 WHERE wallet_address = $1',
      [wallet.toLowerCase()]
    );

    // Reset owned pixels
    await client.query(
      "UPDATE pixels SET owner = NULL, price = $1, updated_at = NOW() WHERE owner = $2",
      [s.pixel_base_price || 0.1, wallet.toLowerCase()]
    );

    // Soft-delete claims
    await client.query(
      'UPDATE claims SET deleted_at = NOW() WHERE owner = $1 AND deleted_at IS NULL',
      [wallet.toLowerCase()]
    );

    // Generate signature
    const chainCfg = CHAINS[chainKey];
    const amountBN = ethers.utils.parseUnits(totalOut.toString(), chainCfg.decimals);
    const feeBN = ethers.utils.parseUnits(ppFee.toString(), chainCfg.decimals);
    const sigData = await generateWithdrawSignature(wallet, amountBN, feeBN, nonce, chainKey);

    await client.query(
      `INSERT INTO transactions (type, from_wallet, usdt_amount, pp_amount, fee, meta)
       VALUES ('withdraw_all', $1, $2, $3, $4, $5)`,
      [wallet.toLowerCase(), usdtBal, ppBal, ppFee,
       JSON.stringify({ totalOut, chain: chainKey })]
    );

    // Fund quest pool from withdrawal fees
    await fundQuestPool(client, ppFee);

    await client.query('COMMIT');
    res.json({ success: true, totalOut, ppFee, ...sigData });
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('[API] withdraw-all error:', e.message);
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
});

// ══════════════════════════════════════════════════
//  GET /api/leaderboard — top players by various criteria
// ══════════════════════════════════════════════════
router.get('/leaderboard', readLimiter, async (req, res) => {
  try {
    const allowedSorts = ['claims', 'volume', 'pixels'];
    const sort = allowedSorts.includes(req.query.sort) ? req.query.sort : 'claims';
    const limit = Math.max(1, Math.min(100, parseInt(req.query.limit) || 20));

    let orderBy;
    switch (sort) {
      case 'volume':  orderBy = 'total_volume DESC'; break;
      case 'pixels':  orderBy = 'pixel_count DESC'; break;
      case 'claims':
      default:        orderBy = 'claim_count DESC'; break;
    }

    const result = await pool.query(
      `SELECT
         u.wallet_address,
         u.nickname,
         COUNT(DISTINCT c.id) AS claim_count,
         COALESCE(SUM(c.total_paid), 0) AS total_volume,
         COALESCE(SUM(c.width * c.height), 0) AS pixel_count
       FROM users u
       LEFT JOIN claims c ON c.owner = u.wallet_address AND c.deleted_at IS NULL
       GROUP BY u.wallet_address, u.nickname
       HAVING COUNT(DISTINCT c.id) > 0
       ORDER BY ${orderBy}
       LIMIT $1`,
      [limit]
    );

    const rows = result.rows.map((r, i) => ({
      rank: i + 1,
      nickname: r.nickname || null,
      wallet: r.wallet_address.slice(0, 6) + '...' + r.wallet_address.slice(-4),
      claimCount: parseInt(r.claim_count),
      totalVolume: parseFloat(r.total_volume),
      pixelCount: parseInt(r.pixel_count)
    }));

    res.json(rows);
  } catch (e) {
    console.error('[API] leaderboard error:', e.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

// ══════════════════════════════════════════════════
//  GET /api/stats — public global statistics
// ══════════════════════════════════════════════════
router.get('/stats', async (req, res) => {
  try {
    const [usersRes, claimsRes, volumeRes, pixelsRes, activeRes, hijacksRes] = await Promise.all([
      pool.query('SELECT COUNT(*) AS cnt FROM users'),
      pool.query('SELECT COUNT(*) AS cnt FROM claims WHERE deleted_at IS NULL'),
      pool.query('SELECT COALESCE(SUM(total_paid), 0) AS total FROM claims WHERE deleted_at IS NULL'),
      pool.query('SELECT COUNT(*) AS cnt FROM pixels WHERE owner IS NOT NULL'),
      pool.query(
        `SELECT COUNT(DISTINCT owner) AS cnt FROM claims
         WHERE deleted_at IS NULL AND created_at >= NOW() - INTERVAL '24 hours'`
      ),
      pool.query(
        `SELECT COUNT(*) AS cnt FROM transactions
         WHERE type = 'hijack' AND created_at >= NOW() - INTERVAL '1 hour'`
      )
    ]);

    res.json({
      totalUsers: parseInt(usersRes.rows[0].cnt),
      totalClaims: parseInt(claimsRes.rows[0].cnt),
      totalVolume: parseFloat(volumeRes.rows[0].total),
      totalPixelsSold: parseInt(pixelsRes.rows[0].cnt),
      activeUsers24h: parseInt(activeRes.rows[0].cnt),
      hijacksPerHour: parseInt(hijacksRes.rows[0].cnt)
    });
  } catch (e) {
    console.error('[API] stats error:', e.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

// ══════════════════════════════════════════════════
//  POST /api/error-report — Client-side error logging
// ══════════════════════════════════════════════════
router.post('/error-report', async (req, res) => {
  try {
    const { message, source, line, stack, userAgent, url } = req.body;

    // Validate: message is required
    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ error: 'message is required' });
    }

    // Truncate fields to max 1000 chars each
    const trunc = (val, max = 1000) => {
      if (!val || typeof val !== 'string') return null;
      return val.slice(0, max);
    };

    const safeMessage = trunc(message, 1000);
    const safeSource = trunc(source, 1000);
    const safeLine = Number.isInteger(line) ? line : null;
    const safeStack = trunc(stack, 2000);
    const safeUserAgent = trunc(userAgent, 500);
    const safeUrl = trunc(url, 1000);
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

    console.error(`[CLIENT_ERROR] ${safeMessage} | source=${safeSource || 'N/A'} line=${safeLine || 'N/A'} | url=${safeUrl || 'N/A'}`);

    await pool.query(
      `INSERT INTO client_errors (message, source, line, stack, user_agent, url, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [safeMessage, safeSource, safeLine, safeStack, safeUserAgent, safeUrl, ip]
    );

    res.json({ ok: true });
  } catch (e) {
    console.error('[API] error-report save failed:', e.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

// ══════════════════════════════════════════════════
//  GET /api/sectors — all sectors with live stats
// ══════════════════════════════════════════════════
router.get('/sectors', readLimiter, async (req, res) => {
  try {
    const wallet = (req.query.wallet || '').toLowerCase();
    const result = await pool.query(`
      SELECT s.*,
        (SELECT COUNT(*) FROM pixels p WHERE p.sector_id = s.id AND p.owner IS NOT NULL) AS occupied_count,
        (SELECT COUNT(DISTINCT p.owner) FROM pixels p WHERE p.sector_id = s.id AND p.owner IS NOT NULL) AS unique_owners,
        (SELECT COALESCE(AVG(p.price),0) FROM pixels p WHERE p.sector_id = s.id AND p.owner IS NOT NULL) AS avg_price,
        (SELECT COUNT(*) FROM pixels p
          WHERE p.sector_id = s.id AND p.owner IS NOT NULL
          AND p.updated_at > NOW() - INTERVAL '24 hours') AS activity_24h
      FROM sectors s
      ORDER BY s.tier, s.name
    `);

    // Top holder per sector
    const topRes = await pool.query(`
      SELECT DISTINCT ON (sector_id) sector_id, owner, COUNT(*) AS cnt
      FROM pixels WHERE owner IS NOT NULL AND sector_id IS NOT NULL
      GROUP BY sector_id, owner
      ORDER BY sector_id, cnt DESC
    `);
    const topMap = {};
    topRes.rows.forEach(r => { topMap[r.sector_id] = { wallet: r.owner, pixels: parseInt(r.cnt) }; });

    // User's pixels per sector
    let myMap = {};
    if (wallet) {
      const myRes = await pool.query(
        'SELECT sector_id, COUNT(*) AS cnt FROM pixels WHERE owner = $1 AND sector_id IS NOT NULL GROUP BY sector_id',
        [wallet]
      );
      myRes.rows.forEach(r => { myMap[r.sector_id] = parseInt(r.cnt); });
    }

    const s = await cfg();
    const miningBonusMap = { core: s.mining_core_mult || 1.5, mid: s.mining_mid_mult || 1.2, frontier: s.mining_frontier_mult || 1.0 };

    const rows = result.rows.map(r => {
      const occupied = parseInt(r.occupied_count) || 0;
      // Calculate total pixels from bounding box if not set
      let total = parseInt(r.total_pixels) || 0;
      if (total <= 1) {
        const latRange = Math.abs(parseFloat(r.lat_max) - parseFloat(r.lat_min));
        const lngRange = Math.abs(parseFloat(r.lng_max) - parseFloat(r.lng_min));
        total = Math.max(1, Math.round((latRange / GRID_SIZE) * (lngRange / GRID_SIZE)));
      }
      const ratio = Math.min(occupied / total, 1.0);

      let tierMult = 1;
      if (r.tier === 'core') tierMult = s.dynamic_price_core_mult || 3;
      else if (r.tier === 'mid') tierMult = s.dynamic_price_mid_mult || 2;

      const dynPrice = (s.dynamic_price_enabled !== false)
        ? parseFloat(r.base_price) * (1 + ratio * tierMult)
        : parseFloat(r.base_price);

      const top = topMap[r.id] || null;

      return {
        id: r.id,
        name: r.name,
        tier: r.tier,
        centerLat: parseFloat(r.center_lat),
        centerLng: parseFloat(r.center_lng),
        bounds: {
          latMin: parseFloat(r.lat_min), latMax: parseFloat(r.lat_max),
          lngMin: parseFloat(r.lng_min), lngMax: parseFloat(r.lng_max)
        },
        polygon: r.bounds_polygon || null,
        basePrice: parseFloat(r.base_price),
        currentPrice: Math.round(dynPrice * 1000000) / 1000000,
        miningBonus: miningBonusMap[r.tier] || 1.0,
        governor: r.governor_wallet ? {
          wallet: r.governor_wallet.slice(0, 6) + '...' + r.governor_wallet.slice(-4),
          since: r.governor_since
        } : null,
        topHolder: top ? {
          wallet: top.wallet.slice(0, 6) + '...' + top.wallet.slice(-4),
          pixels: top.pixels
        } : null,
        myPixels: myMap[r.id] || 0,
        stats: {
          totalPixels: total,
          occupiedPixels: occupied,
          uniqueOwners: parseInt(r.unique_owners) || 0,
          occupancyRate: Math.round(ratio * 10000) / 100,
          avgPrice: Math.round(parseFloat(r.avg_price) * 1000000) / 1000000,
          activity24h: parseInt(r.activity_24h) || 0
        }
      };
    });

    res.json(rows);
  } catch (e) {
    console.error('[API] sectors error:', e.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

// ══════════════════════════════════════════════════
//  GET /api/sectors/:id — single sector detail
// ══════════════════════════════════════════════════
router.get('/sectors/:id', async (req, res) => {
  try {
    const sectorId = parseInt(req.params.id);
    if (isNaN(sectorId)) return res.status(400).json({ error: 'Invalid sector ID' });

    const sRes = await pool.query('SELECT * FROM sectors WHERE id = $1', [sectorId]);
    if (!sRes.rows.length) return res.status(404).json({ error: 'Sector not found' });

    const sector = sRes.rows[0];

    // Top holders in this sector
    const holdersRes = await pool.query(`
      SELECT p.owner, u.nickname, COUNT(*) AS pixel_count
      FROM pixels p
      LEFT JOIN users u ON u.wallet_address = p.owner
      WHERE p.sector_id = $1 AND p.owner IS NOT NULL
      GROUP BY p.owner, u.nickname
      ORDER BY pixel_count DESC
      LIMIT 20
    `, [sectorId]);

    // Recent transactions in this sector
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
      topHolders: holdersRes.rows.map(r => ({
        wallet: r.owner.slice(0, 6) + '...' + r.owner.slice(-4),
        nickname: r.nickname,
        pixels: parseInt(r.pixel_count)
      })),
      recentActivity: txRes.rows.map(r => ({
        type: r.type,
        wallet: r.from_wallet.slice(0, 6) + '...' + r.from_wallet.slice(-4),
        usdt: parseFloat(r.usdt_amount),
        pp: parseFloat(r.pp_amount),
        at: r.created_at
      }))
    });
  } catch (e) {
    console.error('[API] sector detail error:', e.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

// ══════════════════════════════════════════════════
//  GET /api/user/:wallet/base — BASE tab unified data
// ══════════════════════════════════════════════════
router.get('/user/:wallet/base', async (req, res) => {
  try {
    const wallet = req.params.wallet.toLowerCase();

    const [userRes, pixelRes, miningRes, rankRes] = await Promise.all([
      pool.query(
        'SELECT wallet_address, nickname, usdt_balance, pp_balance, xp, rank_level, referral_code, created_at FROM users WHERE wallet_address = $1',
        [wallet]
      ),
      pool.query(`
        SELECT s.id AS sector_id, COALESCE(s.name, 'Uncharted') AS sector_name, COALESCE(s.tier, 'frontier') AS tier, COUNT(*) AS pixel_count
        FROM pixels p
        LEFT JOIN sectors s ON s.id = p.sector_id
        WHERE p.owner = $1
        GROUP BY s.id, s.name, s.tier
        ORDER BY pixel_count DESC
      `, [wallet]),
      pool.query('SELECT * FROM user_mining WHERE wallet_address = $1', [wallet]),
      pool.query('SELECT * FROM rank_definitions ORDER BY level')
    ]);

    if (!userRes.rows.length) return res.status(404).json({ error: 'User not found' });

    const user = userRes.rows[0];
    const mining = miningRes.rows[0] || null;
    const totalPixels = pixelRes.rows.reduce((s, r) => s + parseInt(r.pixel_count), 0);

    const s = await cfg();

    // Determine best tier for harvest interval
    const tierCounts = { core: 0, mid: 0, frontier: 0 };
    for (const row of pixelRes.rows) {
      if (row.tier) tierCounts[row.tier] = (tierCounts[row.tier] || 0) + parseInt(row.pixel_count);
    }
    const intervalCore = parseInt(s.mining_interval_core) || 24;
    const intervalMid = parseInt(s.mining_interval_mid) || 48;
    const intervalFrontier = parseInt(s.mining_interval_frontier) || 72;
    let bestInterval = intervalFrontier;
    if (tierCounts.core > 0) bestInterval = intervalCore;
    else if (tierCounts.mid > 0) bestInterval = intervalMid;

    // Calculate harvest availability
    let harvestAvailable = totalPixels > 0;
    let nextHarvestAt = null;
    if (mining && mining.last_harvest_at) {
      const elapsed = (Date.now() - new Date(mining.last_harvest_at).getTime()) / (1000 * 60 * 60);
      if (elapsed < bestInterval) {
        harvestAvailable = false;
        nextHarvestAt = new Date(new Date(mining.last_harvest_at).getTime() + bestInterval * 3600000);
      }
    }

    res.json({
      user: {
        wallet: user.wallet_address,
        nickname: user.nickname,
        usdt: parseFloat(user.usdt_balance),
        pp: parseFloat(user.pp_balance),
        xp: user.xp || 0,
        rank: user.rank_level || 1,
        referralCode: user.referral_code,
        joinedAt: user.created_at
      },
      miningInterval: {
        core: intervalCore,
        mid: intervalMid,
        frontier: intervalFrontier,
        best: bestInterval
      },
      miningRates: {
        rewardMin: parseFloat(s.mining_reward_min) || 0.01,
        rewardMax: parseFloat(s.mining_reward_max) || 0.5,
        coreMult: parseFloat(s.mining_core_mult) || 1.5,
        midMult: parseFloat(s.mining_mid_mult) || 1.2,
        frontierMult: parseFloat(s.mining_frontier_mult) || 1.0
      },
      territory: {
        totalPixels,
        bySector: pixelRes.rows.map(r => ({
          sectorId: r.sector_id,
          sectorName: r.sector_name,
          tier: r.tier,
          pixels: parseInt(r.pixel_count)
        }))
      },
      mining: mining ? {
        lastHarvest: mining.last_harvest_at,
        totalMined: parseFloat(mining.total_mined_pp),
        todayMined: parseFloat(mining.today_mined_pp),
        harvestAvailable,
        nextHarvestAt
      } : { lastHarvest: null, totalMined: 0, todayMined: 0, harvestAvailable, nextHarvestAt: null },
      ranks: rankRes.rows.map(r => {
        const obj = { level: r.level, name: r.name, requiredXp: r.required_xp, rewardPp: parseFloat(r.reward_pp) };
        if (r.breakthrough) {
          obj.breakthrough = true;
          obj.breakthroughLabel = r.breakthrough_condition?.label || '';
          obj.breakthroughDesc = r.breakthrough_condition?.desc || '';
        }
        return obj;
      })
    });
  } catch (e) {
    console.error('[API] user base error:', e.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

// ══════════════════════════════════════════════════
//  GET /api/ranks — rank definitions table
// ══════════════════════════════════════════════════
router.get('/ranks', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM rank_definitions ORDER BY level');
    const wallet = req.query.wallet ? req.query.wallet.toLowerCase() : null;

    // Get user's breakthrough status if wallet provided
    let userBreakthroughs = [];
    if (wallet) {
      const btRes = await pool.query('SELECT level FROM user_breakthroughs WHERE wallet_address = $1', [wallet]);
      userBreakthroughs = btRes.rows.map(r => r.level);
    }

    res.json(result.rows.map(r => {
      const obj = {
        level: r.level,
        name: r.name,
        requiredXp: r.required_xp,
        rewardPp: parseFloat(r.reward_pp)
      };
      if (r.breakthrough) {
        obj.breakthrough = true;
        obj.breakthroughLabel = r.breakthrough_condition?.label || '';
        obj.breakthroughDesc = r.breakthrough_condition?.desc || '';
        if (wallet) {
          obj.breakthroughUnlocked = userBreakthroughs.includes(r.level);
        }
      }
      return obj;
    }));
  } catch (e) {
    console.error('[API] ranks error:', e.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

// ══════════════════════════════════════════════════
//  GET /api/breakthrough/:wallet — Check breakthrough progress
// ══════════════════════════════════════════════════
router.get('/breakthrough/:wallet', readLimiter, async (req, res) => {
  try {
    const w = req.params.wallet.toLowerCase();
    const userRes = await pool.query('SELECT rank_level, xp, created_at FROM users WHERE wallet_address = $1', [w]);
    if (!userRes.rows.length) return res.status(404).json({ error: 'User not found' });

    const user = userRes.rows[0];
    const gateRes = await pool.query(
      'SELECT level, name, required_xp, breakthrough_condition FROM rank_definitions WHERE breakthrough = true AND level > $1 ORDER BY level ASC LIMIT 1',
      [user.rank_level]
    );

    if (!gateRes.rows.length) return res.json({ nextGate: null, message: 'All breakthroughs cleared!' });

    const gate = gateRes.rows[0];
    const cond = gate.breakthrough_condition;
    const conditions = cond.conditions || [cond];

    const progress = [];
    for (const c of conditions) {
      let current = 0, target = c.min || 0, label = c.type;

      if (c.type === 'pixels') {
        const r = await pool.query('SELECT COUNT(*) AS cnt FROM pixels WHERE owner = $1', [w]);
        current = parseInt(r.rows[0].cnt); label = 'Pixels owned';
      } else if (c.type === 'sectors') {
        const r = await pool.query('SELECT COUNT(DISTINCT sector_id) AS cnt FROM pixels WHERE owner = $1', [w]);
        current = parseInt(r.rows[0].cnt); label = 'Sectors';
      } else if (c.type === 'quests') {
        const r = await pool.query("SELECT COUNT(*) AS cnt FROM user_quests WHERE wallet = $1 AND status = 'claimed'", [w]);
        current = parseInt(r.rows[0].cnt); label = 'Quests completed';
      } else if (c.type === 'deposit') {
        const r = await pool.query('SELECT COALESCE(SUM(amount),0) AS total FROM deposits WHERE wallet_address = $1', [w]);
        current = parseFloat(r.rows[0].total); label = 'USDT deposited';
      } else if (c.type === 'play_days') {
        current = Math.floor((Date.now() - new Date(user.created_at).getTime()) / (1000*60*60*24));
        label = 'Days played';
      } else if (c.type === 'hijacks') {
        const r = await pool.query("SELECT COUNT(*) AS cnt FROM transactions WHERE from_wallet = $1 AND type = 'hijack'", [w]);
        current = parseInt(r.rows[0].cnt); label = 'Hijacks';
      } else if (c.type === 'games_played') {
        const r = await pool.query("SELECT (SELECT COUNT(*) FROM crash_bets WHERE wallet = $1) + (SELECT COUNT(*) FROM mines_games WHERE wallet = $1) AS cnt", [w]);
        current = parseInt(r.rows[0].cnt); label = 'Games played';
      } else if (c.type === 'referrals') {
        const r = await pool.query('SELECT COUNT(*) AS cnt FROM users WHERE referred_by = (SELECT referral_code FROM users WHERE wallet_address = $1)', [w]);
        current = parseInt(r.rows[0].cnt); label = 'Referrals';
      }
      progress.push({ type: c.type, label, current, target, done: current >= target });
    }

    res.json({
      nextGate: { level: gate.level, name: gate.name, title: cond.label, requiredXp: gate.required_xp },
      progress,
      allMet: progress.every(p => p.done)
    });
  } catch (e) {
    console.error('[API] breakthrough error:', e.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

// ══════════════════════════════════════════════════
//  POST /api/harvest — Mining harvest (collect PP from owned pixels)
// ══════════════════════════════════════════════════
router.post('/harvest', harvestLimiter, async (req, res) => {
  const { wallet } = req.body;
  if (!wallet) return res.status(400).json({ error: 'Wallet required' });

  const client = await pool.connect();
  try {
    const s = await cfg();
    if (s.mining_enabled === false) return res.status(403).json({ error: 'Mining is disabled' });

    const w = wallet.toLowerCase();
    await client.query('BEGIN');

    // Count pixels by sector tier
    const pixelRes = await client.query(`
      SELECT s.tier, COUNT(*) AS cnt
      FROM pixels p
      LEFT JOIN sectors s ON s.id = p.sector_id
      WHERE p.owner = $1
      GROUP BY s.tier
    `, [w]);

    let totalPixels = 0;
    const tierCounts = { core: 0, mid: 0, frontier: 0 };
    for (const row of pixelRes.rows) {
      const cnt = parseInt(row.cnt);
      totalPixels += cnt;
      if (row.tier) tierCounts[row.tier] = (tierCounts[row.tier] || 0) + cnt;
    }

    if (totalPixels === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'No pixels owned' });
    }

    // Determine harvest interval based on best tier owned
    // Core=24h, Mid=48h, Frontier=72h (best tier wins)
    const intervalCore = parseInt(s.mining_interval_core) || 24;
    const intervalMid = parseInt(s.mining_interval_mid) || 48;
    const intervalFrontier = parseInt(s.mining_interval_frontier) || 72;
    let intervalHours = intervalFrontier;
    let bestTier = 'frontier';
    if (tierCounts.core > 0) { intervalHours = intervalCore; bestTier = 'core'; }
    else if (tierCounts.mid > 0) { intervalHours = intervalMid; bestTier = 'mid'; }

    // Check cooldown
    const miningRes = await client.query(
      'SELECT * FROM user_mining WHERE wallet_address = $1 FOR UPDATE', [w]
    );
    const now = new Date();

    if (miningRes.rows.length) {
      const lastHarvest = miningRes.rows[0].last_harvest_at;
      if (lastHarvest) {
        const elapsed = (now - new Date(lastHarvest)) / (1000 * 60 * 60);
        if (elapsed < intervalHours) {
          await client.query('ROLLBACK');
          const nextAt = new Date(new Date(lastHarvest).getTime() + intervalHours * 3600000);
          return res.status(429).json({ error: 'Harvest on cooldown', nextHarvestAt: nextAt, intervalHours });
        }
      }
    }

    // ── Pool-funded random reward ──
    const rewardMin = parseFloat(s.mining_reward_min) || 0.01;
    const rewardMax = parseFloat(s.mining_reward_max) || 0.5;
    const harvestCap = parseFloat(s.mining_reward_cap_per_harvest) || 1.0;
    const dailyCap = parseFloat(s.mining_daily_cap_per_user) || 1.0;

    // Random base reward scaled by pixel count (diminishing returns)
    // sqrt(pixels) gives diminishing returns: 100px=10x, 10000px=100x (not 100x linear)
    const pixelFactor = Math.min(Math.sqrt(totalPixels) / 10, 3.0); // cap at 3x
    const baseRandom = rewardMin + Math.random() * (rewardMax - rewardMin);
    let harvestedPP = Math.round(baseRandom * pixelFactor * 10000) / 10000;

    // Governor bonus
    const govRes = await client.query(
      'SELECT COUNT(*) AS cnt FROM sectors WHERE governor_wallet = $1', [w]
    );
    const isGovernor = parseInt(govRes.rows[0].cnt) > 0;
    if (isGovernor) harvestedPP = Math.round(harvestedPP * 1.2 * 10000) / 10000;

    // ── Governance buffs: sector mining_boost + global double_mining (safe) ──
    try {
      const sectorBuffRes = await client.query(
        `SELECT DISTINCT p.sector_id FROM pixels p WHERE p.owner = $1 AND p.sector_id IS NOT NULL`, [w]
      );
      let hasMiningBuff = false;
      for (const row of sectorBuffRes.rows) {
        const buffs = await getActiveSectorBuffs(row.sector_id);
        if (buffs.some(b => b.buff_type === 'mining_boost')) { hasMiningBuff = true; break; }
      }
      if (hasMiningBuff) harvestedPP = Math.round(harvestedPP * 1.2 * 10000) / 10000;
      const isDoubleMining = await hasActiveEvent('double_mining');
      if (isDoubleMining) harvestedPP = Math.round(harvestedPP * 2 * 10000) / 10000;
    } catch(ge) { console.warn('[GOV] harvest buff check failed:', ge.message); }

    // Apply hard cap per harvest
    harvestedPP = Math.min(harvestedPP, harvestCap);

    // Apply daily cap
    const todayDate = now.toISOString().slice(0, 10);
    let todayMined = 0;
    if (miningRes.rows.length && miningRes.rows[0].today_date === todayDate) {
      todayMined = parseFloat(miningRes.rows[0].today_mined_pp) || 0;
    }
    const dailyRemaining = Math.max(0, dailyCap - todayMined);
    if (dailyRemaining <= 0) {
      await client.query('ROLLBACK');
      return res.status(429).json({ error: 'Daily mining cap reached ($' + dailyCap + '/day)' });
    }
    harvestedPP = Math.min(harvestedPP, dailyRemaining);

    // ── Deduct from reward pool ──
    const poolRes = await client.query('SELECT * FROM quest_reward_pool WHERE id = 1 FOR UPDATE');
    const poolBalance = parseFloat(poolRes.rows[0].balance);

    if (poolBalance <= 0) {
      await client.query('ROLLBACK');
      return res.status(429).json({ error: 'Mining reward pool depleted. Try again later.' });
    }
    harvestedPP = Math.min(harvestedPP, poolBalance);
    harvestedPP = Math.round(harvestedPP * 10000) / 10000;

    if (harvestedPP <= 0) {
      await client.query('ROLLBACK');
      return res.status(429).json({ error: 'No rewards available' });
    }

    // Deduct pool
    await client.query(`
      UPDATE quest_reward_pool SET
        balance = balance - $1,
        total_paid = total_paid + $1,
        today_paid = today_paid + $1,
        updated_at = NOW()
      WHERE id = 1
    `, [harvestedPP]);

    // Update user_mining record
    await client.query(`
      INSERT INTO user_mining (wallet_address, last_harvest_at, total_mined_pp, today_mined_pp, today_date)
      VALUES ($1, NOW(), $2, $2, $3)
      ON CONFLICT (wallet_address) DO UPDATE SET
        last_harvest_at = NOW(),
        total_mined_pp = user_mining.total_mined_pp + $2,
        today_mined_pp = CASE WHEN user_mining.today_date = $3 THEN user_mining.today_mined_pp + $2 ELSE $2 END,
        today_date = $3
    `, [w, harvestedPP, todayDate]);

    // Credit PP to user
    await client.query(
      'UPDATE users SET pp_balance = pp_balance + $1 WHERE wallet_address = $2',
      [harvestedPP, w]
    );

    // Transaction log
    await client.query(
      `INSERT INTO transactions (type, from_wallet, pp_amount, fee, meta)
       VALUES ('mining', $1, $2, 0, $3)`,
      [w, harvestedPP, JSON.stringify({ totalPixels, bestTier, tierCounts, isGovernor, pixelFactor: Math.round(pixelFactor * 100) / 100 })]
    );

    // Award XP for harvesting (5 XP per harvest)
    const harvestRankUp = await awardXP(client, w, 5);

    await client.query('COMMIT');

    const nextHarvestAt = new Date(now.getTime() + intervalHours * 3600000);
    res.json({
      success: true,
      harvestedPP,
      totalPixels,
      bestTier,
      rankUp: harvestRankUp || null,
      isGovernor,
      intervalHours,
      nextHarvestAt
    });
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('[API] harvest error:', e.message);
    res.status(500).json({ error: 'Internal error' });
  } finally {
    client.release();
  }
});

// ══════════════════════════════════════
//  QUEST SYSTEM — Random Generation
// ══════════════════════════════════════

// Helper: random int in [min, max]
function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
// Helper: random float in [min, max], rounded to 4 decimals
function randReward(min, max) {
  return Math.round((Math.random() * (max - min) + min) * 10000) / 10000;
}

// Generate quests for a user (called on login / daily refresh)
async function generateQuestsForUser(wallet) {
  const client = await pool.connect();
  try {
    // Check existing active quests
    const existing = await client.query(
      "SELECT tier FROM user_quests WHERE wallet = $1 AND status IN ('active','completed')",
      [wallet]
    );
    const activeTiers = new Set(existing.rows.map(r => r.tier));

    // Get templates
    const tplRes = await client.query('SELECT * FROM quest_templates WHERE active = true');
    const templates = tplRes.rows;

    const questsToAdd = [];

    // Assign quests per tier: 2 free, 1 activity, 1 spending (if slots open)
    const tierSlots = { free: 3, activity: 2, spending: 1 };

    for (const [tier, maxSlots] of Object.entries(tierSlots)) {
      const currentCount = existing.rows.filter(r => r.tier === tier).length;
      const slotsNeeded = maxSlots - currentCount;
      if (slotsNeeded <= 0) continue;

      const tierTemplates = templates.filter(t => t.tier === tier);
      if (tierTemplates.length === 0) continue;

      // Check cooldowns — avoid recently completed quest types
      const recentRes = await client.query(
        `SELECT template_id FROM user_quests
         WHERE wallet = $1 AND tier = $2 AND status = 'claimed'
         AND claimed_at > NOW() - INTERVAL '1 hour' * (SELECT cooldown_hours FROM quest_templates WHERE id = user_quests.template_id)`,
        [wallet, tier]
      );
      const cooldownIds = new Set(recentRes.rows.map(r => r.template_id));
      const available = tierTemplates.filter(t => !cooldownIds.has(t.id));
      if (available.length === 0) continue;

      const usedIds = new Set();
      for (let i = 0; i < slotsNeeded; i++) {
        const unused = available.filter(t => !usedIds.has(t.id));
        const pick = unused.length > 0 ? unused : available;
        const tpl = pick[randInt(0, pick.length - 1)];
        usedIds.add(tpl.id);
        const reqValue = randInt(parseInt(tpl.requirement_min), parseInt(tpl.requirement_max));
        const rewardPP = randReward(parseFloat(tpl.reward_pp_min), parseFloat(tpl.reward_pp_max));
        const title = tpl.title_template;
        const desc = tpl.description_template.replace('{n}', reqValue);

        // Expiry: free=24h, activity=48h, spending=72h
        const expiryHours = tier === 'free' ? 24 : tier === 'activity' ? 48 : 72;

        questsToAdd.push({
          wallet, template_id: tpl.id, tier,
          title, description: desc,
          requirement_type: tpl.requirement_type,
          requirement_value: reqValue,
          reward_pp: rewardPP,
          expires_at: new Date(Date.now() + expiryHours * 3600000)
        });
      }
    }

    // Insert new quests
    for (const q of questsToAdd) {
      await client.query(
        `INSERT INTO user_quests (wallet, template_id, tier, title, description, requirement_type, requirement_value, reward_pp, expires_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [q.wallet, q.template_id, q.tier, q.title, q.description, q.requirement_type, q.requirement_value, q.reward_pp, q.expires_at]
      );
    }

    return questsToAdd.length;
  } finally {
    client.release();
  }
}

// GET /api/quests?wallet=xxx — Get user's active quests (+ auto-generate if needed)
router.get('/quests', readLimiter, async (req, res) => {
  try {
    const w = sanitize(req.query.wallet, 255);
    if (!w) return res.status(400).json({ error: 'wallet required' });

    // Auto-generate quests if user has fewer than expected
    await generateQuestsForUser(w);

    // Expire old quests
    await pool.query(
      "UPDATE user_quests SET status = 'expired' WHERE wallet = $1 AND status = 'active' AND expires_at < NOW()",
      [w]
    );

    // Fetch active + completed (unclaimed)
    const result = await pool.query(
      `SELECT id, tier, title, description, requirement_type, requirement_value,
              current_progress, reward_pp, status, assigned_at, expires_at
       FROM user_quests
       WHERE wallet = $1 AND status IN ('active','completed')
       ORDER BY
         CASE tier WHEN 'free' THEN 1 WHEN 'activity' THEN 2 WHEN 'spending' THEN 3 END,
         assigned_at DESC`,
      [w]
    );

    // Also get recently claimed (last 24h) for "completed" display
    const claimed = await pool.query(
      `SELECT id, tier, title, reward_pp, claimed_at
       FROM user_quests
       WHERE wallet = $1 AND status = 'claimed' AND claimed_at > NOW() - INTERVAL '24 hours'
       ORDER BY claimed_at DESC LIMIT 10`,
      [w]
    );

    // Get pool status for dynamic reward display
    const poolRes = await pool.query('SELECT balance, today_paid, today_date FROM quest_reward_pool WHERE id = 1');
    const poolRow = poolRes.rows[0] || { balance: 0 };
    const poolBalance = parseFloat(poolRow.balance);
    const s = await cfg();
    const minBal = parseFloat(s.quest_pool_min_balance) || 1;
    const multMin = parseFloat(s.quest_reward_multiplier_min) || 0.1;
    const multMax = parseFloat(s.quest_reward_multiplier_max) || 1.5;
    let poolMultiplier = 1.0;
    if (poolBalance <= 0) poolMultiplier = 0;
    else if (poolBalance < minBal) poolMultiplier = multMin;
    else poolMultiplier = multMin + (multMax - multMin) * Math.min(poolBalance / 100, 1.0);

    res.json({
      quests: result.rows.map(r => ({
        ...r,
        reward_pp: parseFloat(r.reward_pp),
        actual_reward: Math.min(
          Math.round(parseFloat(r.reward_pp) * poolMultiplier * 10000) / 10000,
          r.tier === 'free' ? (parseFloat(s.quest_max_reward_free) || 0.05) :
          r.tier === 'activity' ? (parseFloat(s.quest_max_reward_activity) || 0.3) :
          (parseFloat(s.quest_max_reward_spending) || 1.0)
        ),
        requirement_value: parseFloat(r.requirement_value),
        current_progress: parseFloat(r.current_progress),
        progress_pct: Math.min(100, Math.round((parseFloat(r.current_progress) / parseFloat(r.requirement_value)) * 100))
      })),
      recentlyClaimed: claimed.rows.map(r => ({
        ...r,
        reward_pp: parseFloat(r.reward_pp)
      })),
      pool: {
        balance: poolBalance,
        multiplier: poolMultiplier,
        active: poolBalance > 0
      }
    });
  } catch (e) {
    console.error('[API] quests error:', e.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

// POST /api/quests/:id/progress — Update quest progress
router.post('/quests/:id/progress', writeLimiter, async (req, res) => {
  const client = await pool.connect();
  try {
    const questId = parseInt(req.params.id);
    const { wallet, amount } = req.body;
    const w = sanitize(wallet, 255);
    if (!w || !questId) return res.status(400).json({ error: 'Invalid params' });
    const increment = parseFloat(amount) || 1;

    await client.query('BEGIN');

    const qRes = await client.query(
      "SELECT * FROM user_quests WHERE id = $1 AND wallet = $2 AND status = 'active' FOR UPDATE",
      [questId, w]
    );
    if (qRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Quest not found or not active' });
    }

    const quest = qRes.rows[0];
    const newProgress = Math.min(parseFloat(quest.current_progress) + increment, parseFloat(quest.requirement_value));
    const isComplete = newProgress >= parseFloat(quest.requirement_value);

    await client.query(
      `UPDATE user_quests SET current_progress = $1, status = $2, completed_at = $3
       WHERE id = $4`,
      [newProgress, isComplete ? 'completed' : 'active', isComplete ? new Date() : null, questId]
    );

    await client.query('COMMIT');

    res.json({
      questId,
      current_progress: newProgress,
      requirement_value: parseFloat(quest.requirement_value),
      status: isComplete ? 'completed' : 'active',
      progress_pct: Math.min(100, Math.round((newProgress / parseFloat(quest.requirement_value)) * 100))
    });
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('[API] quest progress error:', e.message);
    res.status(500).json({ error: 'Internal error' });
  } finally {
    client.release();
  }
});

// POST /api/quests/:id/claim — Claim completed quest reward (pool-funded)
router.post('/quests/:id/claim', writeLimiter, async (req, res) => {
  const client = await pool.connect();
  try {
    const questId = parseInt(req.params.id);
    const { wallet } = req.body;
    const w = sanitize(wallet, 255);
    if (!w || !questId) return res.status(400).json({ error: 'Invalid params' });

    await client.query('BEGIN');

    const qRes = await client.query(
      "SELECT * FROM user_quests WHERE id = $1 AND wallet = $2 AND status = 'completed' FOR UPDATE",
      [questId, w]
    );
    if (qRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Quest not completed or already claimed' });
    }

    const quest = qRes.rows[0];
    const baseReward = parseFloat(quest.reward_pp);
    const s = await cfg();

    // ── Pool-based reward calculation ──
    const poolRes = await client.query('SELECT * FROM quest_reward_pool WHERE id = 1 FOR UPDATE');
    const poolRow = poolRes.rows[0];
    let poolBalance = parseFloat(poolRow.balance);
    const dailyBudget = parseFloat(s.quest_daily_budget) || 50;
    const minBalance = parseFloat(s.quest_pool_min_balance) || 1;
    const multMin = parseFloat(s.quest_reward_multiplier_min) || 0.1;
    const multMax = parseFloat(s.quest_reward_multiplier_max) || 1.5;

    // Reset daily counter if new day
    const today = new Date().toISOString().slice(0, 10);
    let todayPaid = parseFloat(poolRow.today_paid);
    if (poolRow.today_date.toISOString().slice(0, 10) !== today) {
      todayPaid = 0;
      await client.query("UPDATE quest_reward_pool SET today_paid = 0, today_date = $1 WHERE id = 1", [today]);
    }

    // Dynamic multiplier based on pool health
    // poolBalance low → multiplier shrinks toward multMin
    // poolBalance high → multiplier grows toward multMax
    let multiplier = 1.0;
    if (poolBalance <= 0) {
      multiplier = 0; // Pool empty = no rewards
    } else if (poolBalance < minBalance) {
      multiplier = multMin; // Below minimum = barely any reward
    } else {
      // Scale between multMin and multMax based on pool (cap at 100 PP pool for max)
      const healthRatio = Math.min(poolBalance / 100, 1.0);
      multiplier = multMin + (multMax - multMin) * healthRatio;
    }

    // Check daily budget
    if (todayPaid >= dailyBudget) {
      multiplier = 0; // Daily budget exhausted
    }

    // Hard caps per tier — platform NEVER pays more than this
    const tierCaps = {
      free: parseFloat(s.quest_max_reward_free) || 0.05,
      activity: parseFloat(s.quest_max_reward_activity) || 0.3,
      spending: parseFloat(s.quest_max_reward_spending) || 1.0
    };
    const tierCap = tierCaps[quest.tier] || 0.05;
    const userDailyCap = parseFloat(s.quest_max_daily_per_user) || 2.0;

    // Check user's daily total claimed
    const userTodayRes = await client.query(
      "SELECT COALESCE(SUM(pp_amount),0) AS total FROM transactions WHERE type='quest' AND from_wallet=$1 AND created_at > CURRENT_DATE",
      [w]
    );
    const userTodayTotal = parseFloat(userTodayRes.rows[0].total);
    const userDailyRemaining = Math.max(0, userDailyCap - userTodayTotal);

    let actualReward = Math.round(baseReward * multiplier * 10000) / 10000;
    actualReward = Math.min(actualReward, tierCap);          // tier hard cap
    actualReward = Math.min(actualReward, userDailyRemaining); // user daily cap
    actualReward = Math.round(actualReward * 10000) / 10000;

    if (actualReward <= 0) {
      await client.query('ROLLBACK');
      const reason = userDailyRemaining <= 0 ? 'Daily reward limit reached ($'+userDailyCap+'/day)' : 'Quest reward pool depleted. Try again later.';
      return res.status(429).json({ error: reason });
    }

    // Deduct from pool
    await client.query(`
      UPDATE quest_reward_pool SET
        balance = balance - $1,
        total_paid = total_paid + $1,
        today_paid = today_paid + $1,
        updated_at = NOW()
      WHERE id = 1
    `, [actualReward]);

    // Credit PP to user
    await client.query(
      'UPDATE users SET pp_balance = pp_balance + $1 WHERE wallet_address = $2',
      [actualReward, w]
    );

    // Mark claimed
    await client.query(
      "UPDATE user_quests SET status = 'claimed', claimed_at = NOW() WHERE id = $1",
      [questId]
    );

    // Transaction log
    await client.query(
      `INSERT INTO transactions (type, from_wallet, pp_amount, fee, meta)
       VALUES ('quest', $1, $2, 0, $3)`,
      [w, actualReward, JSON.stringify({
        quest_id: questId, tier: quest.tier, title: quest.title,
        base_reward: baseReward, multiplier, pool_balance: poolBalance
      })]
    );

    // Award XP for quest completion (tier-based: free=3, activity=5, challenge=10)
    const questXP = quest.tier === 'challenge' ? 10 : quest.tier === 'activity' ? 5 : 3;
    const questRankUp = await awardXP(client, w, questXP);

    await client.query('COMMIT');

    res.json({
      success: true,
      questId,
      rewardPP: actualReward,
      xpEarned: questXP,
      rankUp: questRankUp || null,
      baseReward,
      multiplier,
      tier: quest.tier,
      title: quest.title
    });
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('[API] quest claim error:', e.message);
    res.status(500).json({ error: 'Internal error' });
  } finally {
    client.release();
  }
});

// POST /api/quests/track — Server-side quest progress tracking (called by other endpoints)
// This is an internal helper, also exposed for client-side tracking of view-type quests
router.post('/quests/track', writeLimiter, async (req, res) => {
  try {
    const { wallet, action, amount } = req.body;
    const w = sanitize(wallet, 255);
    if (!w || !action) return res.status(400).json({ error: 'Invalid params' });
    const increment = parseFloat(amount) || 1;

    // Find matching active quests for this action type
    const result = await pool.query(
      `UPDATE user_quests SET
         current_progress = LEAST(current_progress + $1, requirement_value),
         status = CASE WHEN LEAST(current_progress + $1, requirement_value) >= requirement_value THEN 'completed' ELSE status END,
         completed_at = CASE WHEN LEAST(current_progress + $1, requirement_value) >= requirement_value AND completed_at IS NULL THEN NOW() ELSE completed_at END
       WHERE wallet = $2 AND requirement_type = $3 AND status = 'active'
       RETURNING id, title, tier, current_progress, requirement_value, status, reward_pp`,
      [increment, w, action]
    );

    const updated = result.rows.map(r => ({
      id: r.id,
      title: r.title,
      tier: r.tier,
      progress: parseFloat(r.current_progress),
      required: parseFloat(r.requirement_value),
      status: r.status,
      reward_pp: parseFloat(r.reward_pp),
      justCompleted: r.status === 'completed'
    }));

    res.json({ tracked: updated.length, quests: updated });
  } catch (e) {
    console.error('[API] quest track error:', e.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

// ══════════════════════════════════════
// ITEM SHOP
// ══════════════════════════════════════

// GET /api/shop/items — list all available items
router.get('/shop/items', readLimiter, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM item_types WHERE active = true ORDER BY category, price_pp');
    res.json(result.rows);
  } catch (e) {
    console.error('[SHOP] list items error:', e.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

// GET /api/shop/inventory?wallet= — get user's items
router.get('/shop/inventory', readLimiter, async (req, res) => {
  const wallet = (req.query.wallet || '').toLowerCase();
  if (!wallet) return res.status(400).json({ error: 'Wallet required' });
  try {
    const result = await pool.query(
      `SELECT ui.*, it.code, it.name, it.description, it.category, it.icon, it.duration_hours, it.effect_value, it.max_stack
       FROM user_items ui JOIN item_types it ON ui.item_type_id = it.id
       WHERE ui.wallet = $1 AND ui.quantity > 0
       ORDER BY it.category, it.name`, [wallet]
    );
    res.json(result.rows);
  } catch (e) {
    console.error('[SHOP] inventory error:', e.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

// POST /api/shop/buy — purchase an item
router.post('/shop/buy', writeLimiter, async (req, res) => {
  const { wallet, itemCode, currency, quantity } = req.body;
  const w = (wallet || '').toLowerCase();
  const qty = parseInt(quantity) || 1;
  if (!w || !itemCode) return res.status(400).json({ error: 'Missing wallet or itemCode' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Get item info
    const itemRes = await client.query('SELECT * FROM item_types WHERE code = $1 AND active = true', [itemCode]);
    if (itemRes.rows.length === 0) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Item not found' }); }
    const item = itemRes.rows[0];

    // Check max stack
    const existingRes = await client.query('SELECT quantity FROM user_items WHERE wallet = $1 AND item_type_id = $2', [w, item.id]);
    const currentQty = existingRes.rows.length > 0 ? existingRes.rows[0].quantity : 0;
    if (currentQty + qty > item.max_stack) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: `Max ${item.max_stack} of this item. You have ${currentQty}.` });
    }

    // Calculate cost
    const cur = (currency || 'PP').toUpperCase();
    const unitPrice = cur === 'USDT' ? parseFloat(item.price_usdt) : parseFloat(item.price_pp);
    const totalCost = unitPrice * qty;
    const balCol = cur === 'USDT' ? 'usdt_balance' : 'pp_balance';

    // Check balance
    const balRes = await client.query(`SELECT ${balCol} as bal FROM users WHERE wallet_address = $1`, [w]);
    if (balRes.rows.length === 0) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'User not found' }); }
    if (parseFloat(balRes.rows[0].bal) < totalCost) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: `Insufficient ${cur}. Need ${totalCost}, have ${parseFloat(balRes.rows[0].bal).toFixed(2)}` });
    }

    // Deduct balance
    await client.query(`UPDATE users SET ${balCol} = ${balCol} - $1 WHERE wallet_address = $2`, [totalCost, w]);

    // Add item to inventory (upsert)
    await client.query(
      `INSERT INTO user_items (wallet, item_type_id, quantity) VALUES ($1, $2, $3)
       ON CONFLICT (wallet, item_type_id) DO UPDATE SET quantity = user_items.quantity + $3`,
      [w, item.id, qty]
    );

    // Log transaction
    await client.query(
      `INSERT INTO transactions (type, from_wallet, usdt_amount, pp_amount, fee, meta)
       VALUES ('shop_purchase', $1, $2, $3, 0, $4)`,
      [w, cur === 'USDT' ? totalCost : 0, cur === 'PP' ? totalCost : 0,
       JSON.stringify({ item: item.code, qty, name: item.name })]
    );

    await client.query('COMMIT');
    res.json({ success: true, item: item.name, quantity: qty, cost: totalCost, currency: cur });
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('[SHOP] buy error:', e.message);
    res.status(500).json({ error: 'Purchase failed' });
  } finally {
    client.release();
  }
});

// POST /api/shop/use — use an item
router.post('/shop/use', writeLimiter, async (req, res) => {
  const { wallet, itemCode, claimId } = req.body;
  const w = (wallet || '').toLowerCase();
  if (!w || !itemCode) return res.status(400).json({ error: 'Missing params' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Get item type
    const itemRes = await client.query('SELECT * FROM item_types WHERE code = $1', [itemCode]);
    if (itemRes.rows.length === 0) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Item not found' }); }
    const item = itemRes.rows[0];

    // Check user has item
    const invRes = await client.query('SELECT * FROM user_items WHERE wallet = $1 AND item_type_id = $2 AND quantity > 0', [w, item.id]);
    if (invRes.rows.length === 0) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'You don\'t have this item' }); }

    // Deduct quantity
    await client.query('UPDATE user_items SET quantity = quantity - 1 WHERE wallet = $1 AND item_type_id = $2', [w, item.id]);

    // Apply item effect based on code
    let effectResult = {};
    if (item.code === 'shield_basic' || item.code === 'shield_advanced') {
      if (!claimId) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'claimId required for shield' }); }
      // Check claim ownership
      const claimRes = await client.query('SELECT owner FROM claims WHERE id = $1', [claimId]);
      if (claimRes.rows.length === 0 || claimRes.rows[0].owner !== w) {
        await client.query('ROLLBACK'); return res.status(403).json({ error: 'Not your territory' });
      }
      const hp = item.effect_value;
      const expiresAt = new Date(Date.now() + item.duration_hours * 3600000);
      // Remove old shield if exists, add new
      await client.query('DELETE FROM pixel_shields WHERE claim_id = $1', [claimId]);
      await client.query(
        'INSERT INTO pixel_shields (claim_id, owner, shield_type, hp, max_hp, expires_at) VALUES ($1,$2,$3,$4,$5,$6)',
        [claimId, w, item.code, hp, hp, expiresAt]
      );
      effectResult = { shielded: true, hp, expiresAt };
    } else if (item.code === 'emp_strike') {
      if (!claimId) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'claimId required for EMP' }); }
      // Disable shield on target claim
      await client.query('DELETE FROM pixel_shields WHERE claim_id = $1', [claimId]);
      effectResult = { empApplied: true, targetClaim: claimId };
    } else {
      // Generic: just log the usage, client handles effect
      effectResult = { applied: true, code: item.code, duration: item.duration_hours, value: item.effect_value };
    }

    // Log usage
    await client.query('INSERT INTO item_usage_log (wallet, item_type_id, claim_id) VALUES ($1,$2,$3)', [w, item.id, claimId || null]);

    await client.query('COMMIT');
    res.json({ success: true, item: item.name, effect: effectResult });
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('[SHOP] use error:', e.message);
    res.status(500).json({ error: 'Failed to use item' });
  } finally {
    client.release();
  }
});

// GET /api/shop/shields?claimId= — check if a claim has an active shield
router.get('/shop/shields', readLimiter, async (req, res) => {
  const claimId = req.query.claimId;
  if (!claimId) return res.status(400).json({ error: 'claimId required' });
  try {
    const result = await pool.query(
      'SELECT * FROM pixel_shields WHERE claim_id = $1 AND expires_at > NOW()', [claimId]
    );
    res.json(result.rows.length > 0 ? result.rows[0] : null);
  } catch (e) {
    res.status(500).json({ error: 'Internal error' });
  }
});

module.exports = router;
