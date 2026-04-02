const express = require('express');
const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { pool, ensureUser, getSettings, getSetting, getActiveEvents, getReferralChain, generateReferralCode } = require('../db');
const { generateWithdrawSignature, CHAINS } = require('../services/signer');

const router = express.Router();
const UPLOADS_DIR = path.join(__dirname, '..', '..', 'uploads');

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
  const res = await pool.query('SELECT id, tier, bounds_polygon, lat_min, lat_max, lng_min, lng_max FROM sectors');
  _sectorsCache = res.rows;
  _sectorsCacheAt = Date.now();
  return _sectorsCache;
}

// Find sector_id for a pixel coordinate
async function findSectorForPixel(lat, lng) {
  const sectors = await getSectorsForLookup();
  for (const s of sectors) {
    // Quick bbox check first
    if (lat < parseFloat(s.lat_min) || lat > parseFloat(s.lat_max)) continue;
    if (lng < parseFloat(s.lng_min) || lng > parseFloat(s.lng_max)) continue;
    // Polygon check
    if (s.bounds_polygon && Array.isArray(s.bounds_polygon) && s.bounds_polygon.length >= 3) {
      if (pointInPolygon(lng, lat, s.bounds_polygon)) return s.id;
    } else {
      // Fallback: bbox match
      return s.id;
    }
  }
  return null;
}

// Award XP and check rank-up
async function awardXP(client, wallet, xpAmount) {
  if (!xpAmount || xpAmount <= 0) return null;
  const res = await client.query(
    'UPDATE users SET xp = xp + $1, total_actions = total_actions + 1 WHERE wallet_address = $2 RETURNING xp, rank_level',
    [xpAmount, wallet]
  );
  if (!res.rows.length) return null;
  const { xp, rank_level } = res.rows[0];
  // Check rank-up
  const rankRes = await client.query(
    'SELECT level, name, reward_pp FROM rank_definitions WHERE level > $1 AND required_xp <= $2 ORDER BY level DESC LIMIT 1',
    [rank_level, xp]
  );
  if (rankRes.rows.length) {
    const newRank = rankRes.rows[0];
    await client.query('UPDATE users SET rank_level = $1 WHERE wallet_address = $2', [newRank.level, wallet]);
    // Award rank-up PP reward
    if (parseFloat(newRank.reward_pp) > 0) {
      await client.query('UPDATE users SET pp_balance = pp_balance + $1 WHERE wallet_address = $2', [newRank.reward_pp, wallet]);
    }
    return { newLevel: newRank.level, name: newRank.name, rewardPp: parseFloat(newRank.reward_pp) };
  }
  return null;
}

function snapGrid(val) {
  return Math.round(parseFloat(val) * 100) / 100;
}

function getClaimPixels(lat, lng, w, h) {
  const pixels = [];
  const halfW = w / 2, halfH = h / 2;
  for (let dy = 0; dy < h; dy++) {
    for (let dx = 0; dx < w; dx++) {
      const plat = Math.round((lat + (dy - halfH + 0.5) * GRID_SIZE) * 100) / 100;
      const plng = Math.round((lng + (dx - halfW + 0.5) * GRID_SIZE) * 100) / 100;
      if (plat >= -70 && plat <= 70) pixels.push({ lat: plat, lng: plng });
    }
  }
  return pixels;
}

// ══════════════════════════════════════════════════
//  GET /api/config — public game config + active events
// ══════════════════════════════════════════════════
router.get('/config', async (req, res) => {
  try {
    const s = await cfg();
    const events = await getActiveEvents();
    const bonusPct = await getDepositBonusPercent();

    res.json({
      pixelBasePrice: s.pixel_base_price || 0.1,
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
      }))
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
//  GET /api/claims — all active claims (for frontend init)
// ══════════════════════════════════════════════════
router.get('/claims', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, owner, center_lat, center_lng, width, height, image_url, original_image_url, link_url, total_paid
       FROM claims WHERE deleted_at IS NULL ORDER BY created_at DESC LIMIT 5000`
    );
    res.json(result.rows.map(r => ({
      id: r.id, owner: r.owner,
      lat: parseFloat(r.center_lat), lng: parseFloat(r.center_lng),
      w: r.width, h: r.height,
      imgUrl: r.image_url, originalImgUrl: r.original_image_url || null,
      link: r.link_url,
      price: parseFloat(r.total_paid), label: r.owner.slice(0, 8)
    })));
  } catch (e) {
    console.error('[API] claims error:', e.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

// ══════════════════════════════════════════════════
//  POST /api/upload — save data:image to file, return URL
// ══════════════════════════════════════════════════
router.post('/upload', async (req, res) => {
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
router.post('/claim', async (req, res) => {
  const { wallet, lat, lng, width, height, imageUrl, originalImageUrl, linkUrl } = req.body;
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

  try {
    // Maintenance check
    if (s.maintenance_mode) {
      return res.status(503).json({ error: 'Maintenance mode — transactions disabled' });
    }

    await client.query('BEGIN');
    await ensureUser(client, wallet.toLowerCase());

    const claimW = parseInt(width), claimH = parseInt(height);
    if (claimW > (s.max_claim_width || 500) || claimH > (s.max_claim_height || 500)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Claim too large', maxWidth: s.max_claim_width, maxHeight: s.max_claim_height });
    }

    const pixels = getClaimPixels(parseFloat(lat), parseFloat(lng), claimW, claimH);
    if (!pixels.length) throw new Error('No pixels in range');

    // Lock and read all affected pixels
    let baseCost = 0, hijackCost = 0, overlapCount = 0, newCount = 0;
    const affectedOwners = {}; // owner → { refund, bonus }

    for (const p of pixels) {
      const pxRes = await client.query(
        'SELECT owner, price FROM pixels WHERE lat = $1 AND lng = $2 FOR UPDATE',
        [p.lat, p.lng]
      );

      if (pxRes.rows.length && pxRes.rows[0].owner) {
        const existing = pxRes.rows[0];
        const pxCost = parseFloat(existing.price) * HIJACK_MULT;
        hijackCost += pxCost;
        overlapCount++;
        const prevOwner = existing.owner;
        if (!affectedOwners[prevOwner]) affectedOwners[prevOwner] = { refund: 0, bonus: 0 };
        affectedOwners[prevOwner].refund += parseFloat(existing.price);
        affectedOwners[prevOwner].bonus += (pxCost - parseFloat(existing.price)) * OWNER_BONUS_PCT;
      } else {
        baseCost += PIXEL_PRICE;
        newCount++;
      }
    }

    const totalCost = Math.round((baseCost + hijackCost) * 1000000) / 1000000;

    // Check user balance (PP first, then USDT)
    const userRes = await client.query(
      'SELECT usdt_balance, pp_balance FROM users WHERE wallet_address = $1 FOR UPDATE',
      [wallet.toLowerCase()]
    );
    const user = userRes.rows[0];
    let ppUsed = 0, usdtUsed = 0;
    const ppBal = parseFloat(user.pp_balance);
    const usdtBal = parseFloat(user.usdt_balance);

    if (ppBal >= totalCost) {
      ppUsed = totalCost;
    } else {
      ppUsed = ppBal;
      usdtUsed = totalCost - ppBal;
    }

    if (usdtUsed > usdtBal) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Insufficient balance', required: totalCost, usdtBalance: usdtBal, ppBalance: ppBal });
    }

    // Deduct from user
    await client.query(
      'UPDATE users SET pp_balance = pp_balance - $1, usdt_balance = usdt_balance - $2 WHERE wallet_address = $3',
      [ppUsed, usdtUsed, wallet.toLowerCase()]
    );

    // Credit hijacked owners (PP refund + bonus)
    for (const [owner, amounts] of Object.entries(affectedOwners)) {
      await client.query(
        'UPDATE users SET pp_balance = pp_balance + $1 WHERE wallet_address = $2',
        [amounts.refund + amounts.bonus, owner]
      );
    }

    // Insert claim
    const claimRes = await client.query(
      `INSERT INTO claims (owner, center_lat, center_lng, width, height, image_url, original_image_url, link_url, total_paid)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
      [wallet.toLowerCase(), lat, lng, width, height, safeImageUrl, safeOriginalImageUrl, safeLinkUrl, totalCost]
    );
    const claimId = claimRes.rows[0].id;

    // Upsert all pixels (with sector_id assignment)
    for (const p of pixels) {
      const pxRes = await client.query(
        'SELECT owner, price FROM pixels WHERE lat = $1 AND lng = $2',
        [p.lat, p.lng]
      );
      const newPrice = (pxRes.rows.length && pxRes.rows[0].owner)
        ? parseFloat(pxRes.rows[0].price) * HIJACK_MULT
        : PIXEL_PRICE;

      const sectorId = await findSectorForPixel(p.lat, p.lng);

      await client.query(
        `INSERT INTO pixels (lat, lng, owner, price, claim_id, sector_id, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,NOW())
         ON CONFLICT (lat, lng) DO UPDATE SET owner=$3, price=$4, claim_id=$5, sector_id=COALESCE($6,pixels.sector_id), updated_at=NOW()`,
        [p.lat, p.lng, wallet.toLowerCase(), newPrice, claimId, sectorId]
      );
    }

    // Award XP for claim/hijack
    const xpPerClaim = s.xp_per_claim || 2;
    const xpPerHijack = s.xp_per_hijack || 3;
    const totalXP = (newCount * xpPerClaim) + (overlapCount * xpPerHijack);
    const rankUp = await awardXP(client, wallet.toLowerCase(), totalXP);

    // Transaction record
    const txRes = await client.query(
      `INSERT INTO transactions (type, from_wallet, usdt_amount, pp_amount, fee, meta)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
      [
        overlapCount > 0 ? 'hijack' : 'claim',
        wallet.toLowerCase(),
        usdtUsed, ppUsed,
        baseCost, // new pixel revenue goes to treasury
        JSON.stringify({
          claimId, totalPixels: pixels.length, newCount, overlapCount,
          affectedOwners, hijackPremiumToTreasury: Object.values(affectedOwners).reduce((s, a) => s + (a.bonus), 0)
        })
      ]
    );
    const txId = txRes.rows[0].id;

    // ── Referral rewards on hijack ──
    const referralRewards = [];
    if (overlapCount > 0 && (s.referral_enabled !== false)) {
      const tierPercents = [
        s.referral_tier1_percent || 15,
        s.referral_tier2_percent || 10,
        s.referral_tier3_percent || 5
      ];
      const chain = await getReferralChain(client, wallet.toLowerCase());
      const hijackPremium = hijackCost - Object.values(affectedOwners).reduce((sum, a) => sum + a.refund, 0);

      for (const ref of chain) {
        const pct = tierPercents[ref.tier - 1] || 0;
        if (pct <= 0) continue;
        const reward = Math.round(hijackPremium * (pct / 100) * 1000000) / 1000000;
        if (reward <= 0) continue;

        // Credit PP to referrer
        await client.query(
          'UPDATE users SET pp_balance = pp_balance + $1 WHERE wallet_address = $2',
          [reward, ref.wallet]
        );

        // Log reward
        await client.query(
          `INSERT INTO referral_rewards (from_wallet, to_wallet, tier, pp_amount, trigger_type, trigger_tx_id)
           VALUES ($1, $2, $3, $4, 'hijack', $5)`,
          [wallet.toLowerCase(), ref.wallet, ref.tier, reward, txId]
        );

        referralRewards.push({ tier: ref.tier, wallet: ref.wallet.slice(0, 6) + '...', reward });
      }
    }

    await client.query('COMMIT');

    res.json({
      success: true, claimId, totalCost,
      newCount, overlapCount,
      ppUsed, usdtUsed,
      xpEarned: totalXP,
      rankUp: rankUp || null,
      referralRewards
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
//  POST /api/swap — PP → USDT
// ══════════════════════════════════════════════════
router.post('/swap', async (req, res) => {
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
router.post('/withdraw', async (req, res) => {
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
router.post('/withdraw-all', async (req, res) => {
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
router.get('/leaderboard', async (req, res) => {
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
    const [usersRes, claimsRes, volumeRes, pixelsRes, activeRes] = await Promise.all([
      pool.query('SELECT COUNT(*) AS cnt FROM users'),
      pool.query('SELECT COUNT(*) AS cnt FROM claims WHERE deleted_at IS NULL'),
      pool.query('SELECT COALESCE(SUM(total_paid), 0) AS total FROM claims WHERE deleted_at IS NULL'),
      pool.query('SELECT COUNT(*) AS cnt FROM pixels WHERE owner IS NOT NULL'),
      pool.query(
        `SELECT COUNT(DISTINCT owner) AS cnt FROM claims
         WHERE deleted_at IS NULL AND created_at >= NOW() - INTERVAL '24 hours'`
      )
    ]);

    res.json({
      totalUsers: parseInt(usersRes.rows[0].cnt),
      totalClaims: parseInt(claimsRes.rows[0].cnt),
      totalVolume: parseFloat(volumeRes.rows[0].total),
      totalPixelsSold: parseInt(pixelsRes.rows[0].cnt),
      activeUsers24h: parseInt(activeRes.rows[0].cnt)
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
router.get('/sectors', async (req, res) => {
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
        SELECT s.id AS sector_id, s.name AS sector_name, s.tier, COUNT(*) AS pixel_count
        FROM pixels p
        JOIN sectors s ON s.id = p.sector_id
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
        todayMined: parseFloat(mining.today_mined_pp)
      } : { lastHarvest: null, totalMined: 0, todayMined: 0 },
      ranks: rankRes.rows.map(r => ({
        level: r.level,
        name: r.name,
        requiredXp: r.required_xp,
        rewardPp: parseFloat(r.reward_pp)
      }))
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
    res.json(result.rows.map(r => ({
      level: r.level,
      name: r.name,
      requiredXp: r.required_xp,
      rewardPp: parseFloat(r.reward_pp)
    })));
  } catch (e) {
    console.error('[API] ranks error:', e.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

// ══════════════════════════════════════════════════
//  POST /api/harvest — Mining harvest (collect PP from owned pixels)
// ══════════════════════════════════════════════════
router.post('/harvest', async (req, res) => {
  const { wallet } = req.body;
  if (!wallet) return res.status(400).json({ error: 'Wallet required' });

  const client = await pool.connect();
  try {
    const s = await cfg();
    if (s.mining_enabled === false) return res.status(403).json({ error: 'Mining is disabled' });

    const w = wallet.toLowerCase();
    await client.query('BEGIN');

    // Check cooldown
    const miningRes = await client.query(
      'SELECT * FROM user_mining WHERE wallet_address = $1 FOR UPDATE',
      [w]
    );
    const intervalHours = s.mining_interval_hours || 4;
    const now = new Date();

    if (miningRes.rows.length) {
      const lastHarvest = miningRes.rows[0].last_harvest_at;
      if (lastHarvest) {
        const elapsed = (now - new Date(lastHarvest)) / (1000 * 60 * 60);
        if (elapsed < intervalHours) {
          await client.query('ROLLBACK');
          const nextAt = new Date(new Date(lastHarvest).getTime() + intervalHours * 3600000);
          return res.status(429).json({ error: 'Harvest on cooldown', nextHarvestAt: nextAt });
        }
      }
    }

    // Count pixels by sector tier
    const pixelRes = await client.query(`
      SELECT s.tier, COUNT(*) AS cnt
      FROM pixels p
      LEFT JOIN sectors s ON s.id = p.sector_id
      WHERE p.owner = $1
      GROUP BY s.tier
    `, [w]);

    let totalPixels = 0;
    let weightedPixels = 0;
    const baseRate = s.mining_base_rate || 0.001;
    const bonusCore = s.mining_bonus_core || 1.5;
    const bonusMid = s.mining_bonus_mid || 1.2;
    const bonusFrontier = s.mining_bonus_frontier || 1.0;

    for (const row of pixelRes.rows) {
      const cnt = parseInt(row.cnt);
      totalPixels += cnt;
      let mult = bonusFrontier;
      if (row.tier === 'core') mult = bonusCore;
      else if (row.tier === 'mid') mult = bonusMid;
      weightedPixels += cnt * mult;
    }

    if (totalPixels === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'No pixels owned' });
    }

    // Check if user is governor of any sector for governor bonus
    const govRes = await client.query(
      'SELECT COUNT(*) AS cnt FROM sectors WHERE governor_wallet = $1', [w]
    );
    const isGovernor = parseInt(govRes.rows[0].cnt) > 0;
    const govMult = isGovernor ? (s.mining_governor_bonus || 1.2) : 1.0;

    let harvestedPP = Math.round(weightedPixels * baseRate * govMult * 1000000) / 1000000;

    // Per-user daily cap
    const dailyCap = s.pp_daily_earn_cap_per_user || 0;
    if (dailyCap > 0) {
      const todayDate = now.toISOString().slice(0, 10);
      let todayMined = 0;
      if (miningRes.rows.length && miningRes.rows[0].today_date === todayDate) {
        todayMined = parseFloat(miningRes.rows[0].today_mined_pp) || 0;
      }
      const remaining = dailyCap - todayMined;
      if (remaining <= 0) {
        await client.query('ROLLBACK');
        return res.status(429).json({ error: 'Daily mining cap reached' });
      }
      harvestedPP = Math.min(harvestedPP, remaining);
    }

    // Update user_mining record
    const todayDate = now.toISOString().slice(0, 10);
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
      [w, harvestedPP, JSON.stringify({ totalPixels, weightedPixels: Math.round(weightedPixels), isGovernor })]
    );

    await client.query('COMMIT');

    const nextHarvestAt = new Date(now.getTime() + intervalHours * 3600000);
    res.json({
      success: true,
      harvestedPP,
      totalPixels,
      isGovernor,
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

module.exports = router;
