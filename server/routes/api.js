const express = require('express');
const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { makeRateLimiter } = require('../utils/rateLimiters');
const { pool, ensureUser, getSetting, getPPToGPRate, getReferralChain, creditReferralCommission, generateReferralCode, awardXP, notifyPlayer } = require('../db');
const { generateWithdrawSignature, getAvailableLiquidity, CHAINS } = require('../services/signer');
const { recalculateGovernor, recalculateCommander, collectTax, getActiveSectorBuffs, hasActiveEvent } = require('../services/governance');
const { requireAuth, getAuthWallet, sanitize, isInternalRequest } = require('../utils/apiHelpers');
const { cfg } = require('../utils/settingsCache');
let weatherService;
try { weatherService = require('../services/weather'); } catch (_e) { /* weather service not available */ }
let explorationService;
try { explorationService = require('../services/exploration'); } catch (_e) { /* exploration service not available */ }
let telegramService;
try { telegramService = require('../services/telegram'); } catch (_e) { /* telegram service not available */ }
let dailyService;
try { dailyService = require('../services/daily'); } catch (_e) { /* daily engagement service not available */ }
let guildService;
try { guildService = require('../services/guild'); } catch (_e) { /* guild service not available */ }
let seasonService;
try { seasonService = require('../services/season'); } catch (_e) { /* season service not available */ }
let achSvc;
try { achSvc = require('../services/achievements'); } catch (_e) {}
let weeklySvc;
try { weeklySvc = require('../services/weeklyChallenges'); } catch (_e) {}
let monumentSvc;
try { monumentSvc = require('../services/monuments'); } catch (_e) {}
let upgradeSvc;
try { upgradeSvc = require('../services/claimUpgrades'); } catch (_e) {}
let bountySvc;
try { bountySvc = require('../services/bounty'); } catch (_e) {}
let shieldSvc;
try { shieldSvc = require('../services/shield'); } catch (_e) {}
let newsSvc;
try { newsSvc = require('../services/news'); } catch (_e) {}
let jobService;
try { jobService = require('../services/job'); } catch (_e) { /* job service not available */ }
let resourceService;
try { resourceService = require('../services/resource'); } catch (_e) { /* resource service not available */ }
let onboardingService;
try { onboardingService = require('../services/onboarding'); } catch (_e) { /* onboarding service not available */ }
let chronicleService;
try { chronicleService = require('../services/chronicle'); } catch (_e) { /* chronicle service not available */ }
let titleService;
try { titleService = require('../services/title'); } catch (_e) { /* title service not available */ }
let titleExt;
try { titleExt = require('../services/titleExtended'); } catch (_e) { /* titleExtended not available */ }
const router = express.Router();
const UPLOADS_DIR = path.join(__dirname, '..', '..', 'uploads');

// ── Rate Limiters ──
const readLimiter = makeRateLimiter({
  windowMs: 60 * 1000, max: 120,
  message: { error: 'Too many requests. Please slow down.' }
});
const writeLimiter = makeRateLimiter({
  windowMs: 60 * 1000, max: 30,
  message: { error: 'Too many write requests. Please wait.' }
});
const authLimiter = makeRateLimiter({
  windowMs: 15 * 60 * 1000, max: 20,
  message: { error: 'Too many login attempts. Try again later.' }
});
const harvestLimiter = makeRateLimiter({
  windowMs: 60 * 60 * 1000, max: 10,
  message: { error: 'Harvest rate limit exceeded.' }
});

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

// Public config and wallet deposit bonus routes live in routes/configRoutes.js.

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
// Allow other modules (admin sector update, governance) to invalidate immediately.
// Without this, admin tier/price/entry-level changes only propagated after 60s TTL,
// causing the "다른 창 한번 열었다 닫아야 반영됨" symptom.
function invalidateSectorsCache() {
  _sectorsCache = null;
  _sectorsCacheAt = 0;
  _sectorPriceSettings = null; // also force re-read of price settings on next claim
}
// Expose globally so any route can call it without circular import dance
global.__invalidateSectorsCache = invalidateSectorsCache;

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
// [v7.354] quest_reward_pool 폐지 — no-op. 보상은 GP 직접 지급이라 풀 적립 불필요.
//   수수료는 그대로 sink(소각) 처리되어 디플레 유지. 호출부는 무해하게 남겨둠.
async function fundQuestPool(_client, _feeAmount) {
  return;
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

// Public /api/config lives in routes/configRoutes.js.

// ══════════════════════════════════════════════════
//  POST /api/referral/register — Register referral
// ══════════════════════════════════════════════════
router.post('/referral/register', requireAuth, writeLimiter, async (req, res) => {
  // [v7.366][P0] wallet을 JWT에서만 — 기존엔 req.body.wallet를 신뢰해 공격자가 타인(고래)의
  //   referred_by를 자기 코드로 설정 → 그 피해자의 실입금/스왑마다 영구 추천 수수료 갈취 가능했음.
  const { referralCode } = req.body;
  const wallet = getAuthWallet(req);
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
    // Season tracking: referral
    if (seasonService) { seasonService.addSeasonScore(w, 'referral', 1).catch(() => {}); }
    // Achievement: check referral count for the person who recruited
    if (achSvc) { achSvc.checkAndUnlock(referrer, 'referral_count').catch(() => {}); }
  } catch (e) {
    console.error('[API] referral register error:', e.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

// GET /api/referral/stats/:wallet — 3단 추천 인원수(트리 비노출, 카운트만). referred_by=추천인 wallet.
router.get('/referral/stats/:wallet', async (req, res) => {
  try {
    const w = String(req.params.wallet||'').toLowerCase().trim();
    if (!w) return res.status(400).json({ error: 'wallet_required' });
    // tier1: 나를 추천인으로 둔 사람들
    const t1 = await pool.query('SELECT wallet_address FROM users WHERE LOWER(referred_by)=LOWER($1)', [w]);
    const t1w = t1.rows.map(r => r.wallet_address);
    let tier2=0, tier3=0, t2w=[];
    if (t1w.length) {
      const t2 = await pool.query('SELECT wallet_address FROM users WHERE referred_by = ANY($1::text[])', [t1w]);
      tier2 = t2.rowCount; t2w = t2.rows.map(r => r.wallet_address);
    }
    if (t2w.length) {
      const t3 = await pool.query('SELECT COUNT(*)::int AS c FROM users WHERE referred_by = ANY($1::text[])', [t2w]);
      tier3 = t3.rows[0] ? t3.rows[0].c : 0;
    }
    const tier1 = t1.rowCount;
    res.json({ tier1, tier2, tier3, total: tier1+tier2+tier3 });
  } catch (e) { console.error('[referral/stats]', e.message); res.status(500).json({ error: 'internal_error' }); }
});

// ══════════════════════════════════════════════════
//  GET /api/referral/:wallet — Get referral info
// ══════════════════════════════════════════════════
router.get('/referral/:wallet', async (req, res) => {
  try {
    const w = req.params.wallet.toLowerCase();
    const userRes = await pool.query(
      `SELECT u.referral_code, u.referred_by, r.nickname AS referred_by_nickname
         FROM users u
         LEFT JOIN users r ON r.wallet_address = u.referred_by
        WHERE u.wallet_address = $1`, [w]
    );
    if (!userRes.rows.length) return res.json({ code: null, referredBy: null, referredByNickname: null, referrals: 0, totalEarned: 0 });

    let code = userRes.rows[0].referral_code;
    // Auto-generate code if none
    if (!code) {
      code = generateReferralCode();
      await pool.query('UPDATE users SET referral_code = $1 WHERE wallet_address = $2', [code, w]);
    }

    // Count direct referrals
    const refCount = await pool.query('SELECT COUNT(*) as cnt FROM users WHERE referred_by = $1', [w]);

    // Total earned from referrals (PP + GP separately) — Migration 099
    const earned = await pool.query(
      `SELECT
         COALESCE(SUM(pp_amount) FILTER (WHERE COALESCE(currency,'pp') != 'gp'), 0) AS total_pp,
         COALESCE(SUM(COALESCE(gp_amount, 0)) FILTER (WHERE currency = 'gp'), 0) AS total_gp
       FROM referral_rewards WHERE to_wallet = $1`, [w]
    );

    // Tier breakdown (PP)
    const tiers = await pool.query(
      `SELECT tier, COUNT(*) as cnt,
              COALESCE(SUM(pp_amount) FILTER (WHERE COALESCE(currency,'pp') != 'gp'), 0) as pp_total,
              COALESCE(SUM(COALESCE(gp_amount, 0)) FILTER (WHERE currency = 'gp'), 0) as gp_total
       FROM referral_rewards WHERE to_wallet = $1 GROUP BY tier ORDER BY tier`, [w]
    );

    res.json({
      code,
      referredBy: userRes.rows[0].referred_by,
      referredByNickname: userRes.rows[0].referred_by_nickname || null,
      referrals: parseInt(refCount.rows[0].cnt),
      totalEarned: parseFloat(earned.rows[0].total_pp),
      totalEarnedGP: parseFloat(earned.rows[0].total_gp || 0),
      tiers: tiers.rows.map(t => ({ tier: t.tier, count: parseInt(t.cnt), earned: parseFloat(t.pp_total), earnedGP: parseFloat(t.gp_total) }))
    });
  } catch (e) {
    console.error('[API] referral info error:', e.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

// ══════════════════════════════════════════════════
//  GET /api/referral/leaderboard — DYNASTY top earners
// ══════════════════════════════════════════════════
router.get('/referral/leaderboard/top', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 100);
    // Exclude NPC uplines — NPCs should never appear on the dynasty leaderboard.
    const rows = await pool.query(
      `SELECT rr.to_wallet AS wallet,
              u.nickname,
              COALESCE(SUM(rr.pp_amount) FILTER (WHERE COALESCE(rr.currency,'pp') != 'gp'), 0) AS total_pp,
              COALESCE(SUM(COALESCE(rr.gp_amount, 0)) FILTER (WHERE rr.currency = 'gp'), 0) AS total_gp,
              COUNT(DISTINCT rr.from_wallet) AS downline_count,
              (SELECT COUNT(*) FROM users u2 WHERE u2.referred_by = rr.to_wallet) AS direct_count
       FROM referral_rewards rr
       LEFT JOIN users u ON u.wallet_address = rr.to_wallet
       WHERE rr.to_wallet NOT LIKE '0xnpc_%'
       GROUP BY rr.to_wallet, u.nickname
       ORDER BY total_pp DESC
       LIMIT $1`,
      [limit]
    );
    res.json({
      leaderboard: rows.rows.map((r, i) => ({
        rank: i + 1,
        wallet: r.wallet,
        nickname: r.nickname || null,
        totalEarned: parseFloat(r.total_pp),
        totalEarnedGP: parseFloat(r.total_gp || 0),
        downlineCount: parseInt(r.downline_count),
        directCount: parseInt(r.direct_count)
      }))
    });
  } catch (e) {
    console.error('[API] referral leaderboard error:', e.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

// ══════════════════════════════════════════════════
//  GET /api/referral/tree/:wallet — DYNASTY downline tree
// ══════════════════════════════════════════════════
router.get('/referral/tree/:wallet', async (req, res) => {
  try {
    const w = req.params.wallet.toLowerCase();
    // Tier 1: direct referrals (include nickname for display)
    const t1 = await pool.query(
      `SELECT u.wallet_address AS wallet,
              u.nickname,
              COALESCE(SUM(rr.pp_amount) FILTER (WHERE rr.to_wallet = $1 AND rr.from_wallet = u.wallet_address), 0) AS earned_from,
              (SELECT COUNT(*) FROM users u2 WHERE u2.referred_by = u.wallet_address) AS sub_count
       FROM users u
       LEFT JOIN referral_rewards rr ON rr.from_wallet = u.wallet_address
       WHERE u.referred_by = $1
       GROUP BY u.wallet_address, u.nickname
       ORDER BY earned_from DESC
       LIMIT 100`,
      [w]
    );
    // Breakdown by trigger type
    const byTrigger = await pool.query(
      `SELECT trigger_type, COALESCE(SUM(pp_amount), 0) AS total
       FROM referral_rewards WHERE to_wallet = $1
       GROUP BY trigger_type ORDER BY total DESC`,
      [w]
    );
    res.json({
      directReferrals: t1.rows.map(r => ({
        wallet: r.wallet,
        nickname: r.nickname || null,
        earnedFrom: parseFloat(r.earned_from),
        subCount: parseInt(r.sub_count)
      })),
      byTrigger: byTrigger.rows.map(r => ({
        trigger: r.trigger_type,
        total: parseFloat(r.total)
      }))
    });
  } catch (e) {
    console.error('[API] referral tree error:', e.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

// ══════════════════════════════════════════════════
//  GET /api/user/:wallet
// ══════════════════════════════════════════════════
router.get('/user/:wallet', async (req, res, next) => {
  // Static sub-routes registered later must not be shadow-matched by :wallet
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
      // [경제정책 W2-4] USDT 환매 가능한(입금 연동) PP. 나머지는 GP 환전만 가능.
      redeemablePP: parseFloat(user.redeemable_pp || 0) || 0,
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
      `SELECT c.center_lat, c.center_lng, c.width, c.height, c.image_url, c.total_paid, c.owner,
              u.nickname
       FROM claims c
       LEFT JOIN users u ON u.wallet_address = c.owner
       WHERE (LOWER(c.owner) LIKE $1 OR LOWER(COALESCE(u.nickname,'')) LIKE $1)
         AND c.deleted_at IS NULL
       ORDER BY c.created_at DESC LIMIT 50`,
      [`%${q}%`]
    );

    res.json(result.rows.map(r => ({
      lat: parseFloat(r.center_lat), lng: parseFloat(r.center_lng),
      width: r.width, height: r.height,
      imageUrl: r.image_url, price: parseFloat(r.total_paid),
      owner: r.owner, nickname: r.nickname || null
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
    // Fetch cosmetics + hijack counts (non-critical, fail-safe)
    const claimIds = result.rows.map(r => r.id);
    const ownerWallets = [...new Set(result.rows.map(r => r.owner))];
    let cosmeticsMap = {};
    let hijackMap = {};
    if (claimIds.length > 0) {
      try {
        const cosRes = await pool.query(
          'SELECT claim_id, cosmetic_type, cosmetic_code FROM user_cosmetics WHERE claim_id = ANY($1)',
          [claimIds]
        );
        cosRes.rows.forEach(c => {
          if (!cosmeticsMap[c.claim_id]) cosmeticsMap[c.claim_id] = {};
          cosmeticsMap[c.claim_id][c.cosmetic_type] = c.cosmetic_code;
        });
      } catch (_ce) { /* cosmetics table may not exist yet */ }
      try {
        const hjRes = await pool.query(
          'SELECT wallet_address, hijack_count FROM users WHERE wallet_address = ANY($1) AND hijack_count > 0',
          [ownerWallets]
        );
        hjRes.rows.forEach(r => { hijackMap[r.wallet_address] = parseInt(r.hijack_count) || 0; });
      } catch (_he) { /* hijack_count column may not exist yet */ }
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
      customName: r.custom_name || null,
      shield: r.shield_type ? { id: r.shield_id, type: r.shield_type, hp: r.shield_hp, maxHp: r.shield_max_hp, expires: new Date(r.shield_expires).getTime(), autoRenew: r.shield_auto_renew || false } : null,
      hijackCount: hijackMap[r.owner] || 0,
      cosmetics: cosmeticsMap[r.id] || null,
      guildId: r.guild_id || null,
      guildName: r.guild_name || null,
      guildTag: r.guild_tag || null,
      guildEmblem: r.guild_emblem || null,
      guildEmblemImage: r.guild_emblem_image || null
    })));
  } catch (e) {
    console.error('[API] claims error:', e.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

// ──────────────────────────────────────────────────────────
// GET /api/hijack/defender-info?wallet=  — hijack 모달에서 상대방 함대 미리보기
// 반환: { hasFleet, aliveShips, fleetCount, willAutoWin }
// ──────────────────────────────────────────────────────────
router.get('/hijack/defender-info', readLimiter, async (req, res) => {
  try {
    const w = (req.query.wallet || '').toLowerCase().trim();
    if (!w || w.length < 10) return res.status(400).json({ error: 'wallet_required' });
    const r = await pool.query(
      `SELECT COUNT(DISTINCT f.id)::int AS fleet_count,
              COUNT(DISTINCT s.id) FILTER (WHERE s.is_alive = true)::int AS alive_ships,
              COUNT(DISTINCT f.id) FILTER (WHERE COALESCE(f.is_in_battle, false) = false)::int AS available_fleets
         FROM fleets f
         LEFT JOIN ships s ON s.fleet_id = f.id
        WHERE f.owner_wallet = $1`,
      [w]
    );
    const row = r.rows[0] || {};
    const fleetCount = parseInt(row.fleet_count) || 0;
    const aliveShips = parseInt(row.alive_ships) || 0;
    const availableFleets = parseInt(row.available_fleets) || 0;
    // auto-win 조건: 사용 가능한 함대 0 또는 alive 함선 0
    const willAutoWin = availableFleets === 0 || aliveShips === 0;
    res.json({
      hasFleet: fleetCount > 0,
      fleetCount,
      aliveShips,
      availableFleets,
      willAutoWin
    });
  } catch (e) {
    console.error('[API] /hijack/defender-info error:', e.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

// ──────────────────────────────────────────────────────────
// GET /api/claims/my?wallet=  — 내 영토 목록 (expedition 등에서 사용)
// 반환: [{id, name, pixel_count, center_lat, center_lng, width, height}]
// ──────────────────────────────────────────────────────────
router.get('/claims/my', async (req, res) => {
  try {
    const wallet = (req.query.wallet || req.headers['x-wallet'] || '').toLowerCase().trim();
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
  } catch (e) {
    console.error('[API] /claims/my error:', e.message);
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
router.post('/claim', requireAuth, writeLimiter, async (req, res) => {
  const wallet = getAuthWallet(req);
  const { lat, lng, width, height, imageUrl, originalImageUrl, linkUrl, payMethod } = req.body;
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

    // ── M-156 Phase A: 섹터 진입 제약 ──
    // 클레임 중심 좌표 기준 sector → entry check (level + mid 영토 보유)
    try {
      const sectorService = require('../services/sector');
      const centerSectorId = findSectorForPixelSync(parseFloat(lat), parseFloat(lng));
      const entryCheck = await sectorService.checkEntryRequirementBySectorId(wallet.toLowerCase(), centerSectorId);
      if (!entryCheck.allowed) {
        await client.query('ROLLBACK');
        return res.status(403).json({
          error: 'sector_access_denied',
          reason: entryCheck.reason,
          sector_name: entryCheck.sector_name,
          tier: entryCheck.tier,
          required_level: entryCheck.required_level,
          current_level: entryCheck.current_level,
          required_mid: entryCheck.required_mid,
          current_mid: entryCheck.current_mid,
        });
      }
    } catch (entryErr) {
      // 체크 자체 실패 시 통과 (안전 기본값) — 로그만 남김
      console.warn('[CLAIM] sector entry check failed (allowing):', entryErr.message);
    }

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
            return res.status(400).json({ error: 'Peace Treaty active — hijacking is temporarily disabled' });
          }
          // Marketplace lock blocks hijacks on listed territory
          if (existing.claim_id) {
            const mlRes = await client.query('SELECT marketplace_locked FROM claims WHERE id = $1', [existing.claim_id]);
            if (mlRes.rows.length && mlRes.rows[0].marketplace_locked) {
              await client.query('ROLLBACK');
              return res.status(400).json({ error: 'This territory is listed on the marketplace and cannot be hijacked' });
            }
          }
          // Shield check: if the claim has an active shield, block the attack
          if (shieldSvc && existing.claim_id) {
            try {
              const shield = await shieldSvc.isClaimShieldedTx(client, existing.claim_id);
              if (shield) {
                const minutesLeft = Math.ceil((new Date(shield.expires_at) - Date.now()) / 60000);
                await client.query('ROLLBACK');
                return res.status(400).json({
                  error: `Territory is shielded for ${minutesLeft} more minute(s)`,
                  shielded: true, shieldExpiresAt: shield.expires_at
                });
              }
            } catch (_shie) { /* shield check non-critical, allow attack to proceed */ }
          }

          // Enemy pixel — attack (war_time gives 20% discount)
          // Floor existing.price to sector base so NPC/free claims (price=0) don't allow free hijacks.
          const _basePxPrice = getSectorPriceSync(p.lat, p.lng, PIXEL_PRICE);
          const _refPrice = Math.max(parseFloat(existing.price) || 0, _basePxPrice);
          let pxCost = _refPrice * HIJACK_MULT;
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

    // Check pixel_doubler effect (50% claim discount)
    let pixelDoublerEffectId = null;
    try {
      const pdRes = await client.query(
        `SELECT id FROM user_active_effects
         WHERE wallet = $1 AND effect_type = 'pixel_doubler' AND active = true
           AND uses_remaining > 0
         ORDER BY id DESC LIMIT 1`, [walletLower]
      );
      if (pdRes.rows.length > 0) {
        pixelDoublerEffectId = pdRes.rows[0].id;
        baseCost = Math.round(baseCost * 0.5 * 1000000) / 1000000;
      }
    } catch(pe) { /* item system unavailable */ }

    // ── Guild research: logistics bonus (claim cost reduction) ──
    try {
      if (guildService && guildService.getResearchBonuses) {
        const rb = await guildService.getResearchBonuses(walletLower);
        if (rb.logistics > 0) {
          baseCost = Math.round(baseCost * (1 - rb.logistics / 100) * 1000000) / 1000000;
        }
      }
    } catch(le) { /* guild service unavailable */ }

    // ✅ [Job] Warrior siege 기간 중 영토 구매 비용 -33% (warrior_siege_participation = 1.5 → discount 33%)
    try {
      if (jobService) {
        const siegeBuff = await jobService.getJobBuff(walletLower, 'warrior_siege_participation', 1.0);
        if (siegeBuff > 1.0) {
          // siege 활성 여부 체크
          const { rows: siegeRows } = await client.query(
            `SELECT 1 FROM governor_sieges WHERE status = 'active' AND sector_code IN (SELECT DISTINCT sector_code FROM pixels WHERE owner = $1) LIMIT 1`,
            [walletLower]
          );
          if (siegeRows.length > 0) {
            baseCost = Math.round(baseCost * (1 - (siegeBuff - 1)) * 1000000) / 1000000;
          }
        }
      }
    } catch (_je) { /* siege check unavailable */ }

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

    // Check attacker's attack_boost item effect
    let attackBoostValue = 0;
    let attackBoostEffectId = null;
    try {
      const boostRes = await client.query(
        `SELECT id, effect_value, uses_remaining FROM user_active_effects
         WHERE wallet = $1 AND effect_type = 'attack_boost' AND active = true
           AND (uses_remaining > 0 OR uses_remaining IS NULL)
         ORDER BY id DESC LIMIT 1`, [wallet.toLowerCase()]
      );
      if (boostRes.rows.length > 0) {
        attackBoostValue = parseFloat(boostRes.rows[0].effect_value);
        attackBoostEffectId = boostRes.rows[0].id;
      }
    } catch(be) { /* item system unavailable */ }

    for (const [prevOwner, ownerPixels] of Object.entries(enemyByOwner)) {
      // Defense bonus buff: check if defender's sector has defense_bonus active
      let effectiveSuccessRate = ATTACK_SUCCESS_RATE + attackBoostValue;
      try {
        const defSectorId = ownerPixels[0] && ownerPixels[0].existing ? findSectorForPixelSync(ownerPixels[0].lat, ownerPixels[0].lng) : null;
        if (defSectorId) {
          const defBuffs = await getActiveSectorBuffs(defSectorId);
          const defBuff = defBuffs.find(b => b.buff_type === 'defense_bonus');
          if (defBuff) effectiveSuccessRate = Math.max(0, effectiveSuccessRate - parseFloat(defBuff.effect_value));
        }
      } catch(ge) { /* governance unavailable, use base rate */ }
      // Weather attack/defense modifiers
      try {
        if (weatherService) {
          const wxSectorId = ownerPixels[0] && ownerPixels[0].existing ? findSectorForPixelSync(ownerPixels[0].lat, ownerPixels[0].lng) : null;
          if (wxSectorId) {
            const wMods = await weatherService.getWeatherModifiers(wxSectorId);
            effectiveSuccessRate += (wMods.attackMod || 0) + (wMods.defenseMod || 0);
          }
        }
      } catch (_we) { /* weather unavailable */ }
      // ✅ [Job System] Warrior hijack success buff (attacker) + defense item effect buff (defender)
      try { if (jobService) effectiveSuccessRate *= await jobService.getJobBuff(walletLower, 'warrior_hijack_success', 1.0); } catch (_je) {}
      try { if (jobService) effectiveSuccessRate /= await jobService.getJobBuff(prevOwner, 'warrior_defense_item_effect', 1.0); } catch (_je) {}
      effectiveSuccessRate = Math.max(10, Math.min(90, effectiveSuccessRate));

      // ✅ [Job] decoy_beacon 체크 — 방어자가 디코이 사용 중이면 공격 차단
      // warrior_spy_resistance = 0.7 → 30% 확률로 디코이를 꿰뚫음
      let decoyBlocked = false;
      try {
        const decoyRes = await client.query(
          `SELECT id FROM user_active_effects WHERE wallet = $1 AND effect_type = 'decoy_beacon'
             AND active = true AND (expires_at IS NULL OR expires_at > NOW()) LIMIT 1`,
          [prevOwner]
        );
        if (decoyRes.rows.length > 0) {
          // 공격자가 Warrior인지 확인 → 30% 꿰뚫기 시도
          let pierced = false;
          try {
            if (jobService) {
              const spyResist = await jobService.getJobBuff(walletLower, 'warrior_spy_resistance', 1.0);
              if (spyResist < 1.0) {
                const resistChance = 1.0 - spyResist; // 0.3 = 30%
                if (Math.random() < resistChance) pierced = true;
              }
            }
          } catch (_je) {}
          if (!pierced) {
            decoyBlocked = true;
            // 디코이 소모 (한 번 발동 시 비활성화)
            await client.query(
              `UPDATE user_active_effects SET active = false WHERE id = $1`,
              [decoyRes.rows[0].id]
            );
          }
        }
      } catch (_de) {}

      const roll = Math.random() * 100;
      if (!decoyBlocked && roll < effectiveSuccessRate) {
        // Attack SUCCESS — take ALL pixels from this owner
        for (const ep of ownerPixels) {
          // Floor to sector base so NPC/free claims still cost something
          const _bp = getSectorPriceSync(ep.lat, ep.lng, PIXEL_PRICE);
          const _ref = Math.max(parseFloat(ep.existing.price) || 0, _bp);
          const pxCost = _ref * HIJACK_MULT;
          attackWon++;
          wonPixels.push(ep);
          affectedOwners[prevOwner].refund += parseFloat(ep.existing.price) || 0;
          affectedOwners[prevOwner].bonus += (pxCost - (parseFloat(ep.existing.price) || 0)) * OWNER_BONUS_PCT;
        }
      } else {
        // Attack FAILED — don't touch ANY of this owner's pixels
        for (const ep of ownerPixels) {
          const _bp = getSectorPriceSync(ep.lat, ep.lng, PIXEL_PRICE);
          const _ref = Math.max(parseFloat(ep.existing.price) || 0, _bp);
          const pxCost = _ref * HIJACK_MULT;
          attackLost++;
          const failRefund = pxCost * 0.9;
          const failFee = pxCost * 0.1;
          refundFromFailed += failRefund;
          platformFee += failFee;
        }
      }
    }

    // Consume attack_boost use if battles occurred
    if (attackBoostEffectId && (attackWon > 0 || attackLost > 0)) {
      try {
        await client.query(
          `UPDATE user_active_effects SET uses_remaining = uses_remaining - 1 WHERE id = $1 AND uses_remaining > 0`, [attackBoostEffectId]
        );
        await client.query(
          `UPDATE user_active_effects SET active = false WHERE id = $1 AND uses_remaining <= 0`, [attackBoostEffectId]
        );
      } catch(be) { /* non-critical */ }
    }

    // ── If ALL battles lost, keep newPixels (non-overlapping empty land is still claimed) ──
    const totalDefeat = attackLost > 0 && attackWon === 0;

    // Actual cost = new pixels + won attacks + failed attack fees (lost 10%)
    const wonAttackCost = wonPixels.reduce((sum, ep) => {
      const _bp = getSectorPriceSync(ep.lat, ep.lng, PIXEL_PRICE);
      const _ref = Math.max(parseFloat(ep.existing.price) || 0, _bp);
      return sum + _ref * HIJACK_MULT;
    }, 0);
    const failedAttackCost = attackLost > 0 ? (attackCost - wonAttackCost) : 0;
    const totalCost = Math.round((baseCost + wonAttackCost + failedAttackCost - refundFromFailed) * 1000000) / 1000000;

    // ── [Onboarding] Tutorial Free First Claim / First Claim Sync ──
    let isTutorialFreeClaim = false;
    let onboardingState = null;
    let isFirstOwnedClaim = false;
    try {
      if (onboardingService && attackLost === 0 && enemyPixels.length === 0 && totalCost > 0) {
        onboardingState = await onboardingService.getOnboardingState(wallet.toLowerCase());
        const existingClaims = await client.query(
          'SELECT COUNT(*) AS cnt FROM claims WHERE owner = $1',
          [wallet.toLowerCase()]
        );
        const claimCount = parseInt(existingClaims.rows[0]?.cnt ?? 0);
        isFirstOwnedClaim = claimCount === 0;

        const freeEnabled = (await getSetting('onboarding_free_claim_enabled') ?? 'true').toString() === 'true';
        const freeSize    = parseInt(await getSetting('onboarding_free_claim_size') ?? '25');
        if (freeEnabled && newPixels.length <= freeSize) {
          if (onboardingState.enabled && !onboardingState.completed && !onboardingState.skipped && isFirstOwnedClaim) {
            isTutorialFreeClaim = true;
          }
        }
      }
    } catch (_oe) { /* onboarding check non-critical */ }

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

    // [경제v2] 땅은 PP/USDT로 누구나 구매 가능(하드락 없음). 무입금 유저는 경매장에서
    //   GP로 PP를 사서 땅 구매 가능 — "재료수급→GP→PP→땅" 사다리. redeemable_pp 는
    //   클레임 시 pp_balance 감소에 따라 트리거(clamp_redeemable_pp)가 자동 보정한다.
    if (isTutorialFreeClaim) {
      // Tutorial free claim — no balance deduction
      ppUsed = 0; usdtUsed = 0;
    } else if (method === 'usdt') {
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

    // Deduct from user (redeemable_pp 는 트리거가 pp_balance 감소에 맞춰 자동 클램프)
    const deductClaim = await client.query(
      'UPDATE users SET pp_balance = pp_balance - $1, usdt_balance = usdt_balance - $2 WHERE LOWER(wallet_address) = LOWER($3) AND pp_balance >= $1 AND usdt_balance >= $2',
      [ppUsed, usdtUsed, wallet.toLowerCase()]
    );
    if (deductClaim.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Insufficient balance (concurrent modification)' });
    }

    // [경제v2 P2] land-PvP 닫힌 루프라 PP 유지: 공격비용 PP↔환불/보너스 PP 균형, redeemable 미적립.
    // Credit hijacked owners (PP refund + bonus) — parallel
    const ownerCredits = Object.entries(affectedOwners).map(([owner, amounts]) =>
      client.query('UPDATE users SET pp_balance = pp_balance + $1 WHERE LOWER(wallet_address) = LOWER($2)',
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

    // ── [Onboarding] Record first claim + advance territory claim step ──
    if (onboardingService && isFirstOwnedClaim && onboardingState?.enabled && !onboardingState.completed && !onboardingState.skipped && onboardingState.current_step >= 2) {
      try {
        await onboardingService.completeStep(wallet.toLowerCase(), 2, { claim_id: claimId });
      } catch (_oe) { /* non-critical */ }
    }

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
        const _basePx = p.sectorPrice || getSectorPriceSync(p.lat, p.lng, PIXEL_PRICE);
        const newPrice = existing
          ? Math.max(parseFloat(existing.price) || 0, _basePx) * HIJACK_MULT
          : _basePx;
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

    // Increment hijack count for attacker (non-critical, uses savepoint)
    if (attackWon > 0) {
      try {
        await client.query('SAVEPOINT hijack_sp');
        await client.query('UPDATE users SET hijack_count = COALESCE(hijack_count, 0) + 1 WHERE wallet_address = $1', [walletLower]);
        await client.query('RELEASE SAVEPOINT hijack_sp');
      } catch (_hce) {
        await client.query('ROLLBACK TO SAVEPOINT hijack_sp');
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
      // [경제v2 P2] land-PvP 닫힌 루프라 PP 유지: 공격 실패 환불은 소비한 PP의 균형 항목.
      await client.query(
        'UPDATE users SET pp_balance = pp_balance + $1 WHERE LOWER(wallet_address) = LOWER($2)',
        [refundFromFailed, walletLower]
      );
    }

    // ── Referral rewards on hijack (needs txId, so runs after) ──
    const referralRewards = [];
    if (overlapCount > 0 && (s.referral_enabled !== false)) {
      const triggerPct = parseFloat(await getSetting('referral_hijack_pct')) || 0;
      if (triggerPct > 0) {
        const tierPercents = [
          s.referral_tier1_percent || 15,
          s.referral_tier2_percent || 10,
          s.referral_tier3_percent || 5
        ];
        const chain = await getReferralChain(client, wallet.toLowerCase());
        let hijackPremium = wonAttackCost - Object.values(affectedOwners).reduce((sum, a) => sum + a.refund, 0);
        // ✅ [Job] Warrior hijack 탈취량 +15% (warrior_hijack_damage = 1.15)
        try { if (jobService) { const dmgBuff = await jobService.getJobBuff(wallet.toLowerCase(), 'warrior_hijack_damage', 1.0); hijackPremium = Math.round(hijackPremium * dmgBuff * 1000000) / 1000000; } } catch (_je) {}
        const commissionPool = Math.round(hijackPremium * (triggerPct / 100) * 1000000) / 1000000;

        for (const ref of chain) {
          const pct = tierPercents[ref.tier - 1] || 0;
          if (pct <= 0) continue;
          const reward = Math.round(commissionPool * (pct / 100) * 1000000) / 1000000;
          if (reward <= 0) continue;

          // [경제v2 P2] land-PvP 닫힌 루프라 PP 유지: 하이잭 프리미엄 분배는 해당 PP 비용 내부에서만 발생.
          await client.query('UPDATE users SET pp_balance = pp_balance + $1 WHERE LOWER(wallet_address) = LOWER($2)', [reward, ref.wallet]);
          await client.query(
            `INSERT INTO referral_rewards (from_wallet, to_wallet, tier, pp_amount, trigger_type, trigger_tx_id)
             VALUES ($1, $2, $3, $4, 'hijack', $5)`,
            [wallet.toLowerCase(), ref.wallet, ref.tier, reward, txId]
          );
          referralRewards.push({ tier: ref.tier, wallet: ref.wallet.slice(0, 6) + '...', reward });
        }
      }
    }

    // ── Governance: collect tax per sector + recalculate positions ──
    // [v7.364] SAVEPOINT 격리 — 기존 bare try/catch는 거버넌스 쿼리(collectTax/recalculate*)가 throw 시
    //   외부 claim 트랜잭션을 오염(aborted)시켜 이후 monument/upgrade 블록과 COMMIT까지 전부 실패 →
    //   성공한 claim이 통째로 롤백되던 위험. monument/upgrade 블록과 동일하게 SAVEPOINT로 감쌈.
    let totalTax = 0;
    try {
      await client.query('SAVEPOINT gov_sp');
      const affectedSectors = new Set();
      for (const p of claimPixels) {
        const sId = findSectorForPixelSync(p.lat, p.lng);
        if (sId) affectedSectors.add(sId);
      }
      var govChanges = [];
      for (const sId of affectedSectors) {
        const sectorPixels = claimPixels.filter(p => findSectorForPixelSync(p.lat, p.lng) === sId);
        const sectorCost = (sectorPixels.length / claimPixels.length) * totalCost;
        if (sectorCost > 0) {
          const tax = await collectTax(client, sId, sectorCost, txType);
          totalTax += tax;
        }
        const govResult = await recalculateGovernor(client, sId);
        if (govResult.changed) {
          // Fetch sector name + governor nickname for feed
          const sInfo = await client.query('SELECT name FROM sectors WHERE id = $1', [sId]);
          const gNickRes = govResult.governor ? await client.query('SELECT nickname FROM users WHERE wallet_address = $1', [govResult.governor]) : null;
          const gNick = gNickRes?.rows?.[0]?.nickname || null;
          govChanges.push({ type: 'governor', sectorId: sId, sectorName: sInfo.rows[0]?.name, wallet: govResult.governor, nickname: gNick });
        }
      }
      const cmdResult = await recalculateCommander(client);
      if (cmdResult.changed && cmdResult.commander) {
        const cNickRes = await client.query('SELECT nickname FROM users WHERE wallet_address = $1', [cmdResult.commander]);
        const cNick = cNickRes.rows?.[0]?.nickname || null;
        govChanges.push({ type: 'commander', wallet: cmdResult.commander, nickname: cNick });
      }
      await client.query('RELEASE SAVEPOINT gov_sp');
    } catch(ge) {
      try { await client.query('ROLLBACK TO SAVEPOINT gov_sp'); } catch(_) {}
      console.warn('[GOV] governance post-claim failed (rolled back to savepoint):', ge.message);
    }

    // Consume pixel_doubler if used
    if (pixelDoublerEffectId) {
      try {
        await client.query(`UPDATE user_active_effects SET uses_remaining = 0, active = false WHERE id = $1`, [pixelDoublerEffectId]);
      } catch(pe) { /* non-critical */ }
    }

    // ── Destroy monuments on hijacked claims (safe: savepoint-guarded) ──
    if (monumentSvc && wonPixels.length > 0) {
      try {
        await client.query('SAVEPOINT monument_sp');
        const hijackedClaimIds = [...new Set(wonPixels.map(ep => ep.existing.claim_id).filter(Boolean))];
        for (const hcId of hijackedClaimIds) {
          await monumentSvc.destroyClaimMonuments(client, hcId, walletLower);
        }
        await client.query('RELEASE SAVEPOINT monument_sp');
      } catch (_mde) {
        await client.query('ROLLBACK TO SAVEPOINT monument_sp');
        console.warn('[Monument] destroy on hijack failed:', _mde.message);
      }
    }

    // ── Destroy territory upgrades on hijacked claims (safe: savepoint-guarded) ──
    if (upgradeSvc && wonPixels.length > 0) {
      try {
        await client.query('SAVEPOINT upgrade_sp');
        const hijackedClaimIds = [...new Set(wonPixels.map(ep => ep.existing.claim_id).filter(Boolean))];
        for (const hcId of hijackedClaimIds) {
          await upgradeSvc.destroyClaimUpgrades(client, hcId);
        }
        await client.query('RELEASE SAVEPOINT upgrade_sp');
      } catch (_ude) {
        await client.query('ROLLBACK TO SAVEPOINT upgrade_sp');
        console.warn('[Upgrade] destroy on hijack failed:', _ude.message);
      }
    }

    await client.query('COMMIT');

    // ── Bounty payouts (fire-and-forget, non-blocking) ──
    if (bountySvc && attackWon > 0) {
      const defenders = [...new Set(wonPixels.map(ep => ep.existing.owner).filter(Boolean))];
      const lastBattleId = battleResults && battleResults.length ? battleResults[battleResults.length-1]?.id : null;
      for (const defender of defenders) {
        bountySvc.processHijackBounty(walletLower, defender, lastBattleId).catch(() => {});
      }
    }

    // 🔔 Hijack 피해자 알림 (방어자에게 영토 탈취 알림)
    if (attackWon > 0) {
      const defenders = [...new Set(wonPixels.map(ep => ep.existing.owner).filter(Boolean))];
      const attackerNickRow = await pool.query('SELECT nickname FROM users WHERE wallet_address = $1', [walletLower]);
      const attackerNick = attackerNickRow.rows[0]?.nickname || walletLower.slice(0,8)+'...';
      for (const defender of defenders) {
        const lostCount = wonPixels.filter(ep => ep.existing.owner === defender).length;
        notifyPlayer(defender, 'hijack_lost',
          `⚔️ ${attackerNick}에게 영토 ${lostCount}px 탈취됨`,
          { attacker: walletLower, pixels: lostCount, claimId }
        ).catch(() => {});
      }
    }

    // Telegram notification for large hijacks (5+ pixels won)
    if (attackWon >= 5 && telegramService) {
      const attackerNick = (await pool.query('SELECT nickname FROM users WHERE wallet_address = $1', [walletLower])).rows[0]?.nickname || walletLower.slice(0,8) + '...';
      telegramService.sendTelegramNotification(
        `<b>⚔️ MASSIVE HIJACK!</b>\n\n${attackerNick} conquered ${attackWon} pixels!\nTotal cost: ${totalCost.toFixed(2)} PP\n\nThe battle for Mars rages on!`
      ).catch(() => {});
    }

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
      newPixels: newPixels.map(p => [p.lat, p.lng]),
      govChanges: govChanges || [],
      tutorialFreeClaim: isTutorialFreeClaim
    });

    // Chronicle: large hijack check (non-blocking, 1줄 추가)
    if (chronicleService && attackWon > 0 && ppUsed > 0) {
      try {
        const firstDefender = Object.keys(affectedOwners || {})[0] || null;
        await chronicleService.checkHijackRecord(walletLower, firstDefender, claimId, ppUsed);
      } catch (_ce) { /* chronicle non-critical */ }
    }

    // Title checks (non-blocking)
    if (titleService) {
      try {
        // 첫 영토 점령 칭호
        if (newCount > 0) {
          const claimCntRes = await pool.query(
            'SELECT COUNT(*) AS cnt FROM claims WHERE owner = $1 AND deleted_at IS NULL',
            [walletLower]
          );
          const totalClaims = parseInt(claimCntRes.rows[0]?.cnt ?? 0);
          if (totalClaims >= 1) titleService.checkAndAwardTitles(walletLower, 'first_territory', {}).catch(() => {});
          if (totalClaims >= 10) titleService.checkAndAwardTitles(walletLower, 'territory_milestone', { count: totalClaims }).catch(() => {});
          if (totalClaims >= 50) titleService.checkAndAwardTitles(walletLower, 'territory_milestone', { count: totalClaims }).catch(() => {});
        }
        // 탈취 횟수 칭호
        if (attackWon > 0) {
          const hijackCntRes = await pool.query(
            'SELECT COUNT(*) AS cnt FROM transactions WHERE type = $1 AND from_wallet = $2',
            ['hijack', walletLower]
          );
          const hijackTotal = parseInt(hijackCntRes.rows[0]?.cnt ?? 0);
          if (hijackTotal >= 50) titleService.checkAndAwardTitles(walletLower, 'hijack_kills', { count: hijackTotal }).catch(() => {});
        }
      } catch (_te) { /* title check non-critical */ }
    }

    // titleExtended: 영토 점령 칭호 (non-blocking)
    if (titleExt && newCount > 0) {
      (async () => {
        try {
          const pxRes = await pool.query(
            'SELECT COALESCE(SUM(width*height),0) AS total FROM claims WHERE owner=$1 AND deleted_at IS NULL',
            [walletLower]
          );
          await titleExt.onClaimCreated(walletLower, parseInt(pxRes.rows[0]?.total) || 0);
        } catch (_) {}
      })();
    }

    // Daily mission progress hooks (non-blocking, never breaks main flow)
    if (dailyService) {
      try {
        if (newCount > 0) await dailyService.updateMissionProgress(walletLower, 'claim_pixels', newCount);
        if (newCount > 0) try { const _dOps = require('./dailyOps'); _dOps.notifyMissionProgress(walletLower, 'territory_claim').catch(()=>{}); } catch(_) {}
        // 활동피드 실시간 푸시 — 구독 클라이언트가 즉시 재조회 (WS, fire-and-forget)
        if (newCount > 0) try { require('../wsServer').broadcastFeed({ type: 'claim' }); } catch(_) {}
        if (attackWon > 0) await dailyService.updateMissionProgress(walletLower, 'hijack', attackWon);
      } catch (_de) { /* daily mission tracking non-critical */ }
    }

    // Guild pixel count refresh (non-blocking)
    if (guildService) {
      try {
        const userGuild = await pool.query('SELECT guild_id FROM users WHERE wallet_address = $1', [walletLower]);
        if (userGuild.rows[0]?.guild_id) {
          guildService.refreshGuildPixelCount(userGuild.rows[0].guild_id).catch(() => {});
        }
        // Also refresh defender guilds if hijack occurred
        if (attackWon > 0 && battleResults?.length) {
          const defenderWallets = [...new Set(battleResults.map(b => b.defender))];
          for (const dw of defenderWallets) {
            const dg = await pool.query('SELECT guild_id FROM users WHERE wallet_address = $1', [dw]);
            if (dg.rows[0]?.guild_id && dg.rows[0].guild_id !== userGuild.rows[0]?.guild_id) {
              guildService.refreshGuildPixelCount(dg.rows[0].guild_id).catch(() => {});
            }
          }
        }
      } catch (_ge) { /* guild refresh non-critical */ }
    }

    // Achievement auto-trigger (non-blocking)
    try {
      const ach = require('../services/achievements');
      if (newCount > 0)    ach.checkAndUnlock(walletLower, 'claim_count').catch(() => {});
      if (attackWon > 0)   ach.checkAndUnlock(walletLower, 'battle_win_count').catch(() => {});
      if (totalCost > 0)   ach.checkAndUnlock(walletLower, 'gp_balance').catch(() => {});
    } catch (_) {}

    // Season score tracking (non-blocking)
    if (seasonService) {
      try {
        if (newCount > 0) seasonService.addSeasonScore(walletLower, 'claim_pixels', newCount).catch(() => {});
        if (attackWon > 0) seasonService.addSeasonScore(walletLower, 'hijack', attackWon).catch(() => {});
        if (attackLost > 0) seasonService.addSeasonScore(walletLower, 'hijack_loss', attackLost).catch(() => {});
        // Track gp_spend for hijack cost
        if (overlapCount > 0) seasonService.addSeasonScore(walletLower, 'gp_spend', Math.round(totalCost || 0)).catch(() => {});
        // Track pixel_loss for defenders
        if (battleResults && battleResults.length > 0) {
          for (const [defender, info] of Object.entries(affectedOwners)) {
            const lost = wonPixels.filter(ep => ep.existing.owner === defender).length;
            if (lost > 0) seasonService.addSeasonScore(defender, 'pixel_loss', lost).catch(() => {});
          }
        }
      } catch (_se) { /* season tracking non-critical */ }
    }
    // Achievement check: territory count
    if (achSvc && newCount > 0) { achSvc.checkAndUnlock(walletLower, 'claim_count').catch(() => {}); }
    if (weeklySvc) { weeklySvc.trackProgress(walletLower, 'claim_count', newCount).catch(() => {}); }
    // News: new territory claimed
    if (newsSvc && newCount > 0) { newsSvc.onTerritoryClaimed(walletLower, null).catch(() => {}); }
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('[API] claim error:', e.message);
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
});

// ══════════════════════════════════════════════════
//  POST /api/hijack/declare-with-pp
//  클레임 스탬프 → 적 영토 → 함대전 하이젝 (PP 즉시 차감)
// ══════════════════════════════════════════════════
router.post('/hijack/declare-with-pp', requireAuth, writeLimiter, async (req, res) => {
  const wallet = getAuthWallet(req);
  const { lat, lng, width, height, atk_fleet_id, imageUrl, originalImageUrl, linkUrl, payMethod } = req.body;
  if (!wallet || lat == null || lng == null || !width || !height || !atk_fleet_id) {
    return res.status(400).json({ error: 'MISSING_PARAMS' });
  }

  // 함대전 하이젝 활성화 체크
  const fleetHijackEnabled = (await getSetting('fleet_hijack_enabled', 'true')).toString() === 'true';
  if (!fleetHijackEnabled) {
    return res.status(403).json({ error: 'FLEET_HIJACK_DISABLED' });
  }

  const parsedLat = parseFloat(lat);
  const parsedLng = parseFloat(lng);
  const parsedW = parseInt(width);
  const parsedH = parseInt(height);
  const walletLower = wallet.toLowerCase();
  const atkFleetId = parseInt(atk_fleet_id);

  if (isNaN(parsedLat) || parsedLat < -70 || parsedLat > 70) return res.status(400).json({ error: 'INVALID_LAT' });
  if (isNaN(parsedLng) || parsedLng < -180 || parsedLng > 180) return res.status(400).json({ error: 'INVALID_LNG' });
  if (!parsedW || parsedW <= 0 || parsedW > 500) return res.status(400).json({ error: 'INVALID_WIDTH' });
  if (!parsedH || parsedH <= 0 || parsedH > 500) return res.status(400).json({ error: 'INVALID_HEIGHT' });
  if (!atkFleetId) return res.status(400).json({ error: 'INVALID_FLEET_ID' });

  const s = await cfg();
  const PIXEL_PRICE = s.pixel_base_price || 0.1;
  const HIJACK_MULT = s.hijack_multiplier || 1.2;
  const OWNER_BONUS_PCT = (s.hijack_owner_bonus || 50) / 100;
  await getSectorsForLookup();
  _sectorPriceSettings = { core: s.price_pixel_core || 0.15, mid: s.price_pixel_mid || 0.05, frontier: s.price_pixel_frontier || 0.02 };

  try {
    // 평화 조약 체크
    let _isPeaceTreaty = false;
    try { _isPeaceTreaty = await hasActiveEvent('peace_treaty'); } catch (_) {}
    if (_isPeaceTreaty) return res.status(400).json({ error: 'Peace Treaty active — hijacking is temporarily disabled' });

    // 공격자 함대 존재 확인
    const atkFleetRes = await pool.query(
      `SELECT id, is_in_battle, owner_wallet FROM fleets WHERE id = $1 AND LOWER(owner_wallet) = LOWER($2)`,
      [atkFleetId, walletLower]
    );
    if (!atkFleetRes.rows[0]) return res.status(404).json({ error: 'ATK_FLEET_NOT_FOUND' });
    if (atkFleetRes.rows[0].is_in_battle) return res.status(409).json({ error: 'ATK_FLEET_IN_BATTLE' });

    // 픽셀 계산
    const pixels = getClaimPixels(parsedLat, parsedLng, parsedW, parsedH);
    if (!pixels.length) return res.status(400).json({ error: 'NO_PIXELS' });

    const pxCoords = pixels.map((p, i) => `($${i*2+1}::numeric, $${i*2+2}::numeric)`).join(',');
    const pxParams = pixels.flatMap(p => [p.lat, p.lng]);
    const existingRes = await pool.query(
      `SELECT lat, lng, owner, price, claim_id FROM pixels WHERE (lat, lng) IN (${pxCoords}) AND owner IS NOT NULL`,
      pxParams
    );
    const existingMap = {};
    for (const row of existingRes.rows) {
      existingMap[parseFloat(row.lat) + ',' + parseFloat(row.lng)] = row;
    }

    let baseCost = 0, attackCost = 0;
    const newPixels = [];
    const enemyByOwner = {};
    const affectedOwners = {};

    for (const p of pixels) {
      const existing = existingMap[p.lat + ',' + p.lng];
      if (existing) {
        if ((existing.owner || '').toLowerCase() === walletLower) {
          // own pixel — skip
        } else {
          // 방패 체크
          if (shieldSvc && existing.claim_id) {
            try {
              const shield = await shieldSvc.isClaimShielded(existing.claim_id);
              if (shield) return res.status(400).json({ error: 'Territory is shielded', shielded: true });
            } catch (_) {}
          }
          // Floor existing.price to sector base so NPC/free claims don't allow free hijacks
          const _basePxPrice = getSectorPriceSync(p.lat, p.lng, PIXEL_PRICE);
          const _existPrice = parseFloat(existing.price) || 0;
          const _refPrice = Math.max(_existPrice, _basePxPrice);
          const pxCost = _refPrice * HIJACK_MULT;
          attackCost += pxCost;
          if (!enemyByOwner[existing.owner]) enemyByOwner[existing.owner] = [];
          enemyByOwner[existing.owner].push({ lat: p.lat, lng: p.lng, prevOwner: existing.owner, price: _refPrice, pxCost, claim_id: existing.claim_id || null });
          if (!affectedOwners[existing.owner]) affectedOwners[existing.owner] = { refund: 0, bonus: 0 };
          affectedOwners[existing.owner].refund += _existPrice;
          affectedOwners[existing.owner].bonus += (pxCost - _existPrice) * OWNER_BONUS_PCT;
        }
      } else {
        const sectorPrice = getSectorPriceSync(p.lat, p.lng, PIXEL_PRICE);
        baseCost += sectorPrice;
        newPixels.push({ lat: p.lat, lng: p.lng, sectorPrice });
      }
    }

    // 겹치는 적 픽셀 없으면 일반 claim으로 보내기
    if (Object.keys(enemyByOwner).length === 0) {
      return res.status(400).json({ error: 'NO_ENEMY_PIXELS — use /api/claim for unclaimed territory' });
    }

    // 주 수비자 선정 (가장 많은 픽셀)
    let primaryDefWallet = null;
    let maxCount = 0;
    for (const [owner, pxList] of Object.entries(enemyByOwner)) {
      if (pxList.length > maxCount) { maxCount = pxList.length; primaryDefWallet = owner; }
    }
    const primaryEnemyPixels = enemyByOwner[primaryDefWallet];
    // 수비자 대표 claim_id (가장 많이 등장하는 것)
    const primaryDefClaimId = (() => {
      const freq = {};
      for (const ep of primaryEnemyPixels) {
        if (ep.claim_id) freq[ep.claim_id] = (freq[ep.claim_id] || 0) + 1;
      }
      return Object.keys(freq).sort((a, b) => freq[b] - freq[a])[0] || null;
    })();

    // 주 수비자 외 나머지는 공격 비용에서 제외 (해당 픽셀 스킵)
    const otherDefOwners = Object.keys(enemyByOwner).filter(o => o !== primaryDefWallet);
    for (const oo of otherDefOwners) {
      for (const ep of enemyByOwner[oo]) attackCost -= ep.pxCost;
      delete affectedOwners[oo];
    }

    // 수비자 함대 찾기 — alive ship이 있는 fleet만 선택 (빈 함대면 auto-win)
    // 명시적으로 ship_count > 0 조건을 걸어야 한다. 안 그러면 빈 함대를 잡고 phase1에서
    // 'no defenders' 상태로 진행되거나 fleet_battle 생성 시 함정 발생.
    let primaryDefFleetId = null;
    let primaryDefShipCount = 0;
    const defFleetRes = await pool.query(
      `SELECT f.id, COUNT(s.id) FILTER (WHERE s.is_alive = true) AS alive_ships
         FROM fleets f
         LEFT JOIN ships s ON s.fleet_id = f.id
        WHERE f.owner_wallet = $1
          AND COALESCE(f.is_in_battle, false) = false
        GROUP BY f.id
        HAVING COUNT(s.id) FILTER (WHERE s.is_alive = true) > 0
        ORDER BY COUNT(s.id) FILTER (WHERE s.is_alive = true) DESC
        LIMIT 1`,
      [primaryDefWallet]
    );
    if (defFleetRes.rows[0]) {
      primaryDefFleetId = defFleetRes.rows[0].id;
      primaryDefShipCount = parseInt(defFleetRes.rows[0].alive_ships) || 0;
    }
    // 디버그 로그 (운영 시 확인용 — '왜 auto-win 됐는지' 추적)
    console.log(`[hijack] defender=${primaryDefWallet} fleetId=${primaryDefFleetId} ships=${primaryDefShipCount} → ${primaryDefFleetId ? 'phase1_battle' : 'auto_win'}`);

    const safeImageUrl = sanitizeUrl(imageUrl, true);
    const safeOriginalImageUrl = sanitizeUrl(originalImageUrl, true) || null;
    const safeLinkUrl = sanitizeUrl(linkUrl, false);

    // ✅ [Field Rating → 하이젝 GP 가중] 수비 영토 FR 구간에 따라 공격 비용 상향
    // FR 0~9: ×1.0 / FR 10~29: ×1.1 / FR 30~59: ×1.25 / FR 60+: ×1.5
    let fieldRatingMult = 1.0;
    if (primaryDefClaimId) {
      try {
        const frRes = await pool.query(
          `SELECT COALESCE(field_rating, 0) AS fr FROM claims WHERE id = $1 LIMIT 1`,
          [primaryDefClaimId]
        );
        const fr = parseInt(frRes.rows[0]?.fr || 0);
        if (fr >= 60) fieldRatingMult = 1.5;
        else if (fr >= 30) fieldRatingMult = 1.25;
        else if (fr >= 10) fieldRatingMult = 1.1;
      } catch (_fr) {}
    }
    if (fieldRatingMult !== 1.0) {
      attackCost = Math.round(attackCost * fieldRatingMult * 10000) / 10000;
    }

    // hijack 서비스 (lazy require)
    const hijackSvc = require('../services/hijack');
    const result = await hijackSvc.declareHijackWithPP({
      attacker_wallet: walletLower,
      lat: parsedLat, lng: parsedLng, width: parsedW, height: parsedH,
      atk_fleet_id: atkFleetId,
      image_url: safeImageUrl || null,
      original_image_url: safeOriginalImageUrl,
      link_url: safeLinkUrl || null,
      pay_method: payMethod || 'pp',
      new_pixels: newPixels,
      enemy_pixels: primaryEnemyPixels,
      primary_defender_wallet: primaryDefWallet,
      primary_def_fleet_id: primaryDefFleetId,
      primary_def_claim_id: primaryDefClaimId,
      base_cost: baseCost,
      attack_cost: attackCost,
      affected_owners: affectedOwners,
    });

    // 시즌/통계 (fire-and-forget)
    try {
      if (seasonService) {
        seasonService.addSeasonScore(walletLower, 'hijack', primaryEnemyPixels.length).catch(() => {});
        seasonService.addSeasonScore(walletLower, 'gp_spend', Math.round(result.total_cost || 0)).catch(() => {});
        if (newPixels.length > 0) seasonService.addSeasonScore(walletLower, 'claim_pixels', newPixels.length).catch(() => {});
      }
    } catch (_) {}

    // ✅ [영토 위협 알림] 공격 대상 영토 소유자에게 hijack 선언 알림
    if (primaryDefWallet) {
      try {
        notifyPlayer(
          primaryDefWallet.toLowerCase(),
          'territory_threatened',
          `영토가 공격받고 있습니다! ${walletLower.slice(0, 8)}…이 침공을 선언했습니다.`,
          {
            attacker: walletLower,
            claim_id: primaryDefClaimId,
            battle_id: result.phase1_battle_id || null,
            lat: parsedLat, lng: parsedLng,
          }
        ).catch(() => {});
      } catch (_nt) {}
    }

    return res.json(result);
  } catch (err) {
    const errMap = {
      'USER_NOT_FOUND': 404,
      'INSUFFICIENT_PP': 400,
      'ATK_FLEET_NOT_FOUND': 404,
      'DEF_FLEET_NOT_FOUND': 404,
      'ATK_FLEET_IN_BATTLE': 409,
      'DEF_FLEET_IN_BATTLE': 409,
      'NO_PHASE1_SHIPS': 409,
      'TOO_MANY_PHASE1_SHIPS': 409,
      'DEFENDER_PROTECTED': 403,
    };
    const status = errMap[err.message];
    if (status) return res.status(status).json({ error: err.message, meta: err.meta, required: err.required, balance: err.balance });
    console.error('[API] hijack/declare-with-pp error:', err.message);
    return res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

// ══════════════════════════════════════════════════
//  PUT /api/claim/:id/image — Update/add image to existing claim
// ══════════════════════════════════════════════════
router.put('/claim/:id/image', requireAuth, writeLimiter, async (req, res) => {
  const claimId = parseInt(req.params.id);
  const wallet = getAuthWallet(req);
  const { imageUrl, originalImageUrl, imgScale, imgRotate, imgOffsetX, imgOffsetY, linkUrl } = req.body;
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

    try { const _dOps = require('./dailyOps'); _dOps.notifyMissionProgress(wallet.toLowerCase(), 'territory_art').catch(()=>{}); } catch(_) {}

    res.json({ success: true, claimId });
  } catch (e) {
    console.error('[API] claim image update error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ══════════════════════════════════════════════════
//  POST /api/swap — PP → USDT
// ══════════════════════════════════════════════════
router.post('/swap', requireAuth, writeLimiter, async (req, res) => {
  const wallet = getAuthWallet(req);
  const { ppAmount } = req.body;
  if (!wallet || !ppAmount || ppAmount <= 0) return res.status(400).json({ error: 'Invalid input' });

  const parsedPP = Number(ppAmount);
  if (isNaN(parsedPP) || !isFinite(parsedPP) || parsedPP <= 0) {
    return res.status(400).json({ error: 'Amount must be a positive finite number' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const userRes = await client.query(
      'SELECT pp_balance, redeemable_pp FROM users WHERE wallet_address = $1 FOR UPDATE',
      [wallet.toLowerCase()]
    );
    if (!userRes.rows.length) throw new Error('User not found');

    const ppBal = parseFloat(userRes.rows[0].pp_balance);
    const redeemablePP = parseFloat(userRes.rows[0].redeemable_pp || 0) || 0;
    if (ppBal < parsedPP) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Insufficient PP', balance: ppBal });
    }

    // [경제정책 W2-4] redeemable_pp 게이팅 — 입금 연동 PP 만 USDT 환매 가능.
    //   채굴/가챠/추천 PP 는 redeemable_pp 에 안 잡혀 → GP 환전(/exchange/pp-to-gp)만 가능.
    try {
      const _t = require('../services/treasury');
      if (await _t.redeemableGatingEnabled(getSetting) && parsedPP > redeemablePP + 1e-9) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          error: 'pp_not_redeemable',
          message: 'Only deposit-linked PP can be redeemed to USDT. Mined/gacha PP can be converted to GP instead.',
          redeemable: redeemablePP, requested: parsedPP
        });
      }
    } catch (e) {
      await client.query('ROLLBACK');
      console.error('[API] swap redeemable gate error:', e.message);
      return res.status(500).json({ error: 'internal_error' });
    }

    const s = await cfg();
    const SWAP_FEE = (s.swap_fee_percent || 5) / 100;
    const fee = Math.round(parsedPP * SWAP_FEE * 1000000) / 1000000;
    const received = Math.round((parsedPP - fee) * 1000000) / 1000000;

    // ✅ [솔벤시 가드] PP→USDT 환금은 담보(collateral) 여유분(room) 이내만 허용 — 뱅크런 차단.
    try {
      const _treasury = require('../services/treasury');
      if (await _treasury.guardEnabled(getSetting)) {
        // [v7.189 fix] `w` 미정의 → 유저 pre-lock 스킵되던 버그. wallet 변수가 정확한 식별자.
        const { collateral, liability, room } = await _treasury.lockRoom(client, wallet);
        if (received > room + 1e-9) {
          await client.query('ROLLBACK');
          return res.status(409).json({
            error: 'swap_pool_insufficient',
            message: 'PP→USDT redemption pool is currently insufficient. The operator must fund the redemption collateral.',
            room, collateral, liability, requested: received
          });
        }
      }
    } catch (e) {
      // ⚠️ fail-CLOSED: treasury_ledger 미존재(42P01, 마이그레이션 전)만 가드 면제. 그 외 모든 오류는
      //    미담보 발행을 막기 위해 거래 차단(Codex 검토 — 과거 모든 e.code 면제 = fail-open 버그였음).
      await client.query('ROLLBACK');
      if (e && e.code === '42P01') { return res.status(503).json({ error: 'solvency_guard_unavailable' }); }
      console.error('[API] swap solvency guard error:', e.message);
      return res.status(500).json({ error: 'internal_error' });
    }

    // [경제정책 W4-6] 환매 한도(주간 글로벌 + 유저 일일) — received(USDT) 기준. 잔액 변경 전 호출.
    try {
      const _t = require('../services/treasury');
      const lim = await _t.checkRedemptionLimits(client, { wallet, redeemUsdt: received }, getSetting);
      if (!lim.ok) {
        await client.query('ROLLBACK');
        return res.status(429).json({
          error: lim.code,
          message: lim.code === 'redemption_weekly_cap'
            ? 'Weekly redemption cap reached. Please try again later.'
            : 'Daily redemption limit reached. Please try again tomorrow.',
          ...lim
        });
      }
    } catch (e) {
      await client.query('ROLLBACK');
      console.error('[API] swap redemption limit error:', e.message);
      return res.status(500).json({ error: 'internal_error' });
    }

    // [경제정책 W2-4] redeemable_pp 도 함께 차감(환매한 PP 는 redeemable 소진). 트리거가 ≤pp_balance 보강.
    const deductSwap = await client.query(
      'UPDATE users SET pp_balance = pp_balance - $1, redeemable_pp = GREATEST(redeemable_pp - $1, 0), usdt_balance = usdt_balance + $2 WHERE LOWER(wallet_address) = LOWER($3) AND pp_balance >= $1',
      [parsedPP, received, wallet.toLowerCase()]
    );
    if (deductSwap.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Insufficient balance (concurrent modification)' });
    }

    await client.query(
      `INSERT INTO transactions (type, from_wallet, usdt_amount, pp_amount, fee, meta)
       VALUES ('swap', $1, $2, $3, $4, $5)`,
      [wallet.toLowerCase(), received, parsedPP, fee, JSON.stringify({ swapRate: 1, feePercent: s.swap_fee_percent || 5 })]
    );

    // [v7.353] 추천 수수료를 swap fee 에서 carve(추가발행 0): 먼저 PP 추천 분배 후
    //   quest pool 은 잔여분(fee - referral)만 적립. (예전엔 quest pool 에 fee 전액 기반
    //   + 추천을 GP로 별도 발행 = 교차통화 인플레.)
    let _refTotal = 0;
    try {
      const credited = await creditReferralCommission(client, wallet, 'swap', fee, 'pp');
      _refTotal = (credited || []).reduce((s, c) => s + (parseFloat(c.amount) || 0), 0);
    } catch (_e) { /* non-critical */ }

    // Fund quest pool from the remaining swap fee (referral 몫 제외)
    await fundQuestPool(client, Math.max(0, fee - _refTotal));

    await client.query('COMMIT');
    res.json({ success: true, received, fee, ppDeducted: parsedPP });
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
router.post('/withdraw', requireAuth, writeLimiter, async (req, res) => {
  const wallet = getAuthWallet(req);
  const { amount, chain } = req.body;
  if (!wallet || !amount || amount <= 0) return res.status(400).json({ error: 'Invalid input' });

  // [v7.165] 6자리 소수 라운드로 정규화(swap/treasury 컨벤션과 일관) — float 미세 누수 차단.
  const parsedAmount = Math.round(Number(amount) * 1e6) / 1e6;
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
      'SELECT usdt_balance, withdrawal_nonce, last_withdrawal_at FROM users WHERE wallet_address = $1 FOR UPDATE',
      [wallet.toLowerCase()]
    );
    if (!userRes.rows.length) throw new Error('User not found');

    // ── Withdrawal cooldown check ──
    const s = await cfg();
    const cooldownHours = Number(s.withdrawal_cooldown_hours) || 24;
    if (cooldownHours > 0 && userRes.rows[0].last_withdrawal_at) {
      const lastWithdrawal = new Date(userRes.rows[0].last_withdrawal_at);
      const nextAllowed = new Date(lastWithdrawal.getTime() + cooldownHours * 60 * 60 * 1000);
      if (Date.now() < nextAllowed.getTime()) {
        await client.query('ROLLBACK');
        return res.status(429).json({
          error: `Withdrawal cooldown active. Next withdrawal allowed after ${nextAllowed.toISOString()}`,
          nextAllowedAt: nextAllowed.toISOString(),
          remainingSeconds: Math.ceil((nextAllowed.getTime() - Date.now()) / 1000)
        });
      }
    }

    const minWithdrawAmount = Number(s.withdraw_min_amount ?? s.min_withdraw ?? 1);
    if (!Number.isFinite(minWithdrawAmount) || minWithdrawAmount < 0) {
      await client.query('ROLLBACK');
      return res.status(500).json({ error: 'Invalid withdraw minimum configuration' });
    }
    if (parsedAmount < minWithdrawAmount) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: `Minimum withdrawal amount is ${minWithdrawAmount} USDT`,
        minAmount: minWithdrawAmount
      });
    }

    const bal = parseFloat(userRes.rows[0].usdt_balance);
    if (bal < parsedAmount) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Insufficient balance', balance: bal });
    }

    // ── [P0] 미만료 pending 출금이 있으면 새 서명 발급 금지 → 기존 서명 재발급(중복 차감 방지) ──
    //   기존 버그: 서명만 받고 온체인 미제출 시 DB 잔액이 증발 + DB/컨트랙트 nonce desync 로
    //   이후 모든 출금이 revert. 예약(pending) 모델로 차단한다.
    const _openPend = await client.query(
      `SELECT amount_units, gross, net, fee, nonce, deadline, signature, chain
         FROM pending_withdrawals
        WHERE LOWER(wallet_address) = LOWER($1) AND status = 'pending'
              AND deadline > EXTRACT(EPOCH FROM NOW())::bigint
        ORDER BY id DESC LIMIT 1 FOR UPDATE`,
      [wallet]
    );
    if (_openPend.rows.length) {
      const p = _openPend.rows[0];
      await client.query('COMMIT'); // 변경 없음 — 락만 해제
      return res.json({
        success: true, reissued: true, chain: p.chain,
        amount: p.amount_units, contractFee: '0', nonce: Number(p.nonce),
        deadline: Number(p.deadline), signature: p.signature,
        requested: Number(p.gross), feeDeducted: Number(p.fee), net: Number(p.net),
        message: '기존 출금 서명을 재발급했습니다. 만료 전 온체인 제출하세요.'
      });
    }

    // ── [P0] 서명 nonce = 온체인 withdrawNonce (DB nonce 미사용 → desync 구조적 불가) ──
    let onchainNonce;
    try {
      onchainNonce = await require('../services/signer').getOnchainWithdrawNonce(wallet, chainKey);
    } catch (nerr) {
      await client.query('ROLLBACK');
      console.error('[API] withdraw onchain-nonce error:', nerr.message);
      return res.status(503).json({ error: 'On-chain state unavailable. Try again shortly.' });
    }

    // ── 이 유저의 만료(미정산) pending 정리 — 같은 nonce 유니크 충돌 방지 + 미청구 자금 환불 ──
    //   온체인 nonce 가 row.nonce 보다 크면 = 이미 실행됨 → settled(환불 금지, 이중환불 차단).
    //   아니면(미실행 + 만료) → reserve 했던 잔액/담보를 환불.
    const _expired = await client.query(
      `SELECT id, nonce, gross, net FROM pending_withdrawals
        WHERE LOWER(wallet_address) = LOWER($1) AND chain = $2 AND status = 'pending'
              AND deadline <= EXTRACT(EPOCH FROM NOW())::bigint
        FOR UPDATE`,
      [wallet, chainKey]
    );
    for (const er of _expired.rows) {
      if (onchainNonce > Number(er.nonce)) {
        await client.query(`UPDATE pending_withdrawals SET status='settled', settled_at=NOW() WHERE id=$1`, [er.id]);
      } else {
        await client.query('UPDATE users SET usdt_balance = usdt_balance + $1 WHERE LOWER(wallet_address) = LOWER($2)', [er.gross, wallet.toLowerCase()]);
        await require('../services/treasury').adjustCollateral(client, Number(er.net));
        await client.query(`UPDATE pending_withdrawals SET status='expired', settled_at=NOW() WHERE id=$1`, [er.id]);
        await client.query(
          `INSERT INTO transactions (type, from_wallet, usdt_amount, meta) VALUES ('withdraw_refund', $1, $2, $3)`,
          [wallet.toLowerCase(), er.gross, JSON.stringify({ chain: chainKey, nonce: Number(er.nonce), reason: 'expired_unclaimed' })]
        );
      }
    }

    // ── 출금 수수료 — 유저 잔액에서는 요청 전액(parsedAmount) 차감, 온체인은 net(=요청액-fee) 전송.
    //   fee 만큼은 담보(collateral)에 잔류해 페그 강화. 0~20% clamp. (v7.217 ECON-005)
    const _wfPctRaw = (s && (s.withdraw_fee_percent ?? s.withdrawFeePercent));
    const withdrawFeePct = Math.max(0, Math.min(20, parseFloat(_wfPctRaw) || 0));
    const feeAmount = Math.round(parsedAmount * (withdrawFeePct / 100) * 1000000) / 1000000;
    const netAmount = Math.round((parsedAmount - feeAmount) * 1000000) / 1000000;

    const amountBN = ethers.utils.parseUnits(netAmount.toString(), chainCfg.decimals);
    const feeBN = ethers.BigNumber.from(0); // 온체인 fee=0 (수수료는 DB 차감으로 처리)

    // ── 유동성 체크 — 다른 미만료 pending 의 net 을 예약분으로 차감해 동시 출금 과다배정 차단 ──
    let availableLiquidity;
    try {
      availableLiquidity = await getAvailableLiquidity(chainKey);
    } catch (liquidityErr) {
      await client.query('ROLLBACK');
      console.error('[API] withdraw liquidity check error:', liquidityErr.message);
      return res.status(503).json({ error: 'On-chain liquidity check unavailable. Try again shortly.' });
    }
    const _resv = await client.query(
      `SELECT COALESCE(SUM(net), 0) AS s FROM pending_withdrawals WHERE chain = $1 AND status = 'pending'`,
      [chainKey]
    );
    const reservedUnits = ethers.utils.parseUnits(
      (Math.round((parseFloat(_resv.rows[0].s) || 0) * 1000000) / 1000000).toString(), chainCfg.decimals
    );
    const effectiveLiquidity = availableLiquidity.sub(reservedUnits);
    if (effectiveLiquidity.lt(amountBN)) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        error: 'Insufficient on-chain liquidity',
        available: ethers.utils.formatUnits(effectiveLiquidity.gt(0) ? effectiveLiquidity : ethers.constants.Zero, chainCfg.decimals),
        required: ethers.utils.formatUnits(amountBN, chainCfg.decimals),
        chain: chainKey
      });
    }

    // ── reserve: 잔액 차감(gross) + 담보 차감(net). withdrawal_nonce 는 더 이상 건드리지 않음 ──
    // [v7.365][P0] rowCount 가드 — 조건부 UPDATE 가 0행이면 차감 없이 서명되던 결함 방지.
    const _wd = await client.query(
      'UPDATE users SET usdt_balance = usdt_balance - $1, last_withdrawal_at = NOW() WHERE LOWER(wallet_address) = LOWER($2) AND usdt_balance >= $1',
      [parsedAmount, wallet.toLowerCase()]
    );
    if (_wd.rowCount !== 1) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Insufficient balance' });
    }
    // ✅ [솔벤시] 담보는 net 만큼만 차감 — fee 는 담보 잔류. fail-CLOSED: throw 시 catch 에서 ROLLBACK.
    await require('../services/treasury').adjustCollateral(client, -netAmount);

    const sigData = await generateWithdrawSignature(
      wallet, amountBN, feeBN, onchainNonce, chainKey
    );

    // pending 예약 기록 (재발급/정산/만료환불의 근거)
    await client.query(
      `INSERT INTO pending_withdrawals (wallet_address, chain, nonce, gross, net, fee, amount_units, deadline, signature, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'pending')`,
      [wallet.toLowerCase(), chainKey, onchainNonce, parsedAmount, netAmount, feeAmount, amountBN.toString(), sigData.deadline, sigData.signature]
    );

    await client.query(
      `INSERT INTO transactions (type, from_wallet, usdt_amount, fee, meta)
       VALUES ('withdraw', $1, $2, $3, $4)`,
      [wallet.toLowerCase(), parsedAmount, feeAmount, JSON.stringify({ chain: chainKey, nonce: onchainNonce, deadline: sigData.deadline, net: netAmount, fee: feeAmount, feePct: withdrawFeePct, pending: true })]
    );

    await client.query('COMMIT');
    // [P0-b] 온체인 호출 파라미터(서명된 값)와 표시용을 분리. 기존엔 응답 fee 가 서명된 fee(0)를
    //   덮어써 프론트가 그 fee 로 온체인 호출 시 서명 불일치 → revert → 잔액 잠김 위험이 있었음.
    res.json({
      success: true, chain: chainKey,
      amount: amountBN.toString(),  // 컨트랙트 amount 인자(net, base-unit)
      contractFee: '0',             // 컨트랙트 fee 인자(서명된 값) — 절대 덮어쓰지 말 것
      nonce: onchainNonce,
      deadline: sigData.deadline,
      chainId: sigData.chainId,
      signature: sigData.signature,
      requested: parsedAmount, feeDeducted: feeAmount, feePct: withdrawFeePct, net: netAmount
    });
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
router.post('/withdraw-all', requireAuth, writeLimiter, async (req, res) => {
  const wallet = getAuthWallet(req);
  const { chain } = req.body;
  if (!wallet) return res.status(400).json({ error: 'Missing wallet' });

  const chainKey = chain || 'base';
  const VALID_CHAINS = ['base', 'bnb', 'eth'];
  if (!VALID_CHAINS.includes(chainKey)) {
    return res.status(400).json({ error: 'Invalid chain (must be one of: base, bnb, eth)' });
  }
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const userRes = await client.query(
      'SELECT usdt_balance, pp_balance, redeemable_pp, withdrawal_nonce, last_withdrawal_at FROM users WHERE wallet_address = $1 FOR UPDATE',
      [wallet.toLowerCase()]
    );
    if (!userRes.rows.length) throw new Error('User not found');

    // ── Withdrawal cooldown check ──
    const s = await cfg();
    const cooldownHours = Number(s.withdrawal_cooldown_hours) || 24;
    if (cooldownHours > 0 && userRes.rows[0].last_withdrawal_at) {
      const lastWithdrawal = new Date(userRes.rows[0].last_withdrawal_at);
      const nextAllowed = new Date(lastWithdrawal.getTime() + cooldownHours * 60 * 60 * 1000);
      if (Date.now() < nextAllowed.getTime()) {
        await client.query('ROLLBACK');
        return res.status(429).json({
          error: `Withdrawal cooldown active. Next withdrawal allowed after ${nextAllowed.toISOString()}`,
          nextAllowedAt: nextAllowed.toISOString(),
          remainingSeconds: Math.ceil((nextAllowed.getTime() - Date.now()) / 1000)
        });
      }
    }

    const usdtBal = parseFloat(userRes.rows[0].usdt_balance);
    const ppBal = parseFloat(userRes.rows[0].pp_balance);
    const redeemablePP = parseFloat(userRes.rows[0].redeemable_pp || 0) || 0;
    const nonce = userRes.rows[0].withdrawal_nonce || 0;
    const swapFeePct = (s.swap_fee_percent || 5) / 100;
    const minWithdrawAmount = Number(s.withdraw_min_amount ?? s.min_withdraw ?? 1);

    // [경제정책 W2-4] 게이팅 on 이면 입금 연동(redeemable_pp) 부분만 USDT 환매 대상.
    //   비환매 PP(ppLeftover)는 출금되지 않고 계정에 남아 이후 GP 환전만 가능.
    const _redeemGating = await require('../services/treasury').redeemableGatingEnabled(getSetting);
    const ppRedeemBase = _redeemGating ? Math.min(ppBal, redeemablePP) : ppBal;
    const ppLeftover = Math.round((ppBal - ppRedeemBase) * 1000000) / 1000000;
    const ppFee = Math.round(ppRedeemBase * swapFeePct * 1000000) / 1000000;
    const ppRedeemed = Math.round((ppRedeemBase - ppFee) * 1000000) / 1000000;
    const totalOut = Math.round((usdtBal + ppRedeemed) * 1000000) / 1000000;

    if (totalOut <= 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Nothing to withdraw' });
    }
    if (!Number.isFinite(minWithdrawAmount) || minWithdrawAmount < 0) {
      await client.query('ROLLBACK');
      return res.status(500).json({ error: 'Invalid withdraw minimum configuration' });
    }
    if (totalOut < minWithdrawAmount) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: `Minimum withdrawal amount is ${minWithdrawAmount} USDT`,
        minAmount: minWithdrawAmount,
        totalOut
      });
    }

    // ✅ [솔벤시 가드] PP유래 발행분(ppRedeemed)은 담보 여유분(room) 이내만 허용 — 뱅크런 차단.
    try {
      const _treasury = require('../services/treasury');
      if (ppRedeemed > 0 && await _treasury.guardEnabled(getSetting)) {
        const { collateral, liability, room } = await _treasury.lockRoom(client, wallet);
        if (ppRedeemed > room + 1e-9) {
          await client.query('ROLLBACK');
          return res.status(409).json({
            error: 'swap_pool_insufficient',
            message: 'Your PP cannot be redeemed to USDT right now: redemption collateral is insufficient. You may withdraw your USDT balance only, or try again after the operator funds the redemption pool.',
            room, collateral, liability, ppRedeemed
          });
        }
      }
    } catch (e) {
      // ⚠️ fail-CLOSED: 42P01(테이블 미존재)만 면제, 그 외 오류는 미담보 발행 방지 위해 차단.
      await client.query('ROLLBACK');
      if (e && e.code === '42P01') { return res.status(503).json({ error: 'solvency_guard_unavailable' }); }
      console.error('[API] withdraw-all solvency guard error:', e.message);
      return res.status(500).json({ error: 'internal_error' });
    }

    // [경제정책 W4-6] 환매 한도(주간 글로벌 + 유저 일일) — ppRedeemed(USDT) 기준. 잔액 변경 전 호출.
    try {
      const _t = require('../services/treasury');
      const lim = await _t.checkRedemptionLimits(client, { wallet, redeemUsdt: ppRedeemed }, getSetting);
      if (!lim.ok) {
        await client.query('ROLLBACK');
        return res.status(429).json({
          error: lim.code,
          message: lim.code === 'redemption_weekly_cap'
            ? 'Weekly redemption cap reached. You may withdraw your USDT balance only, or try again later.'
            : 'Daily redemption limit reached. Please try again tomorrow.',
          ...lim
        });
      }
    } catch (e) {
      await client.query('ROLLBACK');
      console.error('[API] withdraw-all redemption limit error:', e.message);
      return res.status(500).json({ error: 'internal_error' });
    }

    // [경제정책 W2-4] usdt=0, 환매한 PP 만 소진하고 비환매 PP(ppLeftover)는 잔류.
    //   redeemable_pp 는 환매분(ppRedeemBase)만큼 차감. 트리거가 ≤pp_balance 보강.
    await client.query(
      'UPDATE users SET usdt_balance = 0, pp_balance = $2, redeemable_pp = GREATEST(redeemable_pp - $3, 0), withdrawal_nonce = withdrawal_nonce + 1, last_withdrawal_at = NOW() WHERE LOWER(wallet_address) = LOWER($1)',
      [wallet.toLowerCase(), ppLeftover, ppRedeemBase]
    );

    // ✅ [솔벤시] 실제 빠져나가는 USDT(totalOut)만큼 담보 차감.
    // [v7.189 fix] withdraw 와 같은 이유로 fail-CLOSED — 에러 시 throw → 위 ROLLBACK 으로 잔액 변경 취소.
    await require('../services/treasury').adjustCollateral(client, -totalOut);

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
    // [v7.74] Liquidity check — wrap separately to avoid leaking env-var names in error messages
    let availableLiquidity;
    try {
      availableLiquidity = await getAvailableLiquidity(chainKey);
    } catch (liquidityErr) {
      await client.query('ROLLBACK');
      console.error('[API] withdraw-all liquidity check error:', liquidityErr.message);
      return res.status(503).json({ error: 'On-chain liquidity check unavailable. Try again shortly.' });
    }
    if (availableLiquidity.lt(amountBN.add(feeBN))) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        error: 'Insufficient on-chain liquidity',
        available: ethers.utils.formatUnits(availableLiquidity, chainCfg.decimals),
        required: ethers.utils.formatUnits(amountBN.add(feeBN), chainCfg.decimals),
        chain: chainKey
      });
    }
    const sigData = await generateWithdrawSignature(wallet, amountBN, feeBN, nonce, chainKey);

    // [경제정책 W4-6] pp_amount 는 환매분(ppRedeemBase)으로 기록 — 주간 환매 집계(pp_amount-fee)가 정확.
    await client.query(
      `INSERT INTO transactions (type, from_wallet, usdt_amount, pp_amount, fee, meta)
       VALUES ('withdraw_all', $1, $2, $3, $4, $5)`,
      [wallet.toLowerCase(), usdtBal, ppRedeemBase, ppFee,
       JSON.stringify({ totalOut, chain: chainKey, ppRedeemed, ppLeftover, redeemGating: _redeemGating })]
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

    // pixel_count 는 실제 소유 픽셀 (pixels 테이블) 기반 — claim.width*height 는 hijack/타인소유로
    // 침식된 사각형까지 포함해서 BASE 패널의 "총 픽셀" 과 어긋남.
    const result = await pool.query(
      `SELECT
         u.wallet_address,
         u.nickname,
         COUNT(DISTINCT c.id) AS claim_count,
         COALESCE(SUM(c.total_paid), 0) AS total_volume,
         COALESCE(p.pxs, 0) AS pixel_count
       FROM users u
       LEFT JOIN claims c ON c.owner = u.wallet_address AND c.deleted_at IS NULL
       LEFT JOIN (SELECT owner, COUNT(*) AS pxs FROM pixels WHERE owner IS NOT NULL GROUP BY owner) p
              ON p.owner = u.wallet_address
       GROUP BY u.wallet_address, u.nickname, p.pxs
       HAVING COUNT(DISTINCT c.id) > 0 OR COALESCE(p.pxs, 0) > 0
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

    // Total pixel capacity across all sectors
    let totalPixelsCapacity = 0;
    try {
      const capRes = await pool.query('SELECT COALESCE(SUM(total_pixels),0) AS cap FROM sectors');
      totalPixelsCapacity = parseInt(capRes.rows[0].cap) || 0;
    } catch (_) {}

    res.json({
      totalUsers: parseInt(usersRes.rows[0].cnt),
      totalClaims: parseInt(claimsRes.rows[0].cnt),
      totalVolume: parseFloat(volumeRes.rows[0].total),
      totalPixels: totalPixelsCapacity,
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
router.post('/error-report', writeLimiter, async (req, res) => {
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
          AND p.updated_at > NOW() - INTERVAL '24 hours') AS activity_24h,
        ug.nickname AS governor_nickname
      FROM sectors s
      LEFT JOIN users ug ON ug.wallet_address = s.governor_wallet
      ORDER BY s.tier, s.name
    `);

    // Top holder per sector (join users for nickname)
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
    topRes.rows.forEach(r => { topMap[r.sector_id] = { wallet: r.owner, nickname: r.nickname || null, pixels: parseInt(r.cnt) }; });

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
          fullWallet: r.governor_wallet,
          nickname: r.governor_nickname || null,
          since: r.governor_since
        } : null,
        taxRate: parseFloat(r.tax_rate) || 2,
        announcement: r.announcement || null,
        entryMinLevel: parseInt(r.entry_min_level) || 0,
        entryRequiredMidOwns: parseInt(r.entry_required_mid_owns) || 0,
        entryCheckActive: r.entry_check_active !== false,
        topHolder: top ? {
          wallet: top.wallet.slice(0, 6) + '...' + top.wallet.slice(-4),
          fullWallet: top.wallet,
          nickname: top.nickname || null,
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
    // Season tracking: sector exploration (non-blocking, once per request with wallet)
    if (wallet && seasonService) { seasonService.addSeasonScore(wallet, 'sector_enter', 1).catch(() => {}); }
  } catch (e) {
    console.error('[API] sectors error:', e.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

// ══════════════════════════════════════════════════
//  GET /api/sectors/:id — single sector detail
// ══════════════════════════════════════════════════
router.get('/sectors/:id', async (req, res, next) => {
  // 'control' 등 특수 경로는 뒤에 등록된 정적 라우트로 넘김 (라우트 순서 충돌 방지)
  if (req.params.id === 'control') return next();
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

    // Lazy rank recalculation — XP 누적 후 rank_level 자동 갱신.
    // BASE 패널 진입은 가장 빈번한 hot path 이므로 사용자가 직접 화면 보면 즉시 반영.
    try {
      const { recalcUserRank } = require('../services/rank');
      await recalcUserRank(wallet);
    } catch (_) {} // 실패해도 base 응답은 정상 진행

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
        tierCounts,
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
        nextHarvestAt,
        estimatedMin: totalPixels > 0 ? Math.round((parseFloat(s.mining_reward_min) || 0.01) * Math.min(Math.sqrt(totalPixels) / 10, 3.0) * 10000) / 10000 : 0,
        estimatedMax: totalPixels > 0 ? Math.round((parseFloat(s.mining_reward_max) || 0.5) * Math.min(Math.sqrt(totalPixels) / 10, 3.0) * 10000) / 10000 : 0,
        instantCost: parseFloat(s.instant_harvest_cost_pp) || 0.5
      } : { lastHarvest: null, totalMined: 0, todayMined: 0, harvestAvailable, nextHarvestAt: null, estimatedMin: 0, estimatedMax: 0, instantCost: parseFloat(s.instant_harvest_cost_pp) || 0.5 },
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
router.post('/harvest', requireAuth, harvestLimiter, async (req, res) => {
  const w = getAuthWallet(req);
  if (!w) return res.status(401).json({ error: 'Wallet required' });

  const client = await pool.connect();
  try {
    const s = await cfg();
    if (s.mining_enabled === false) return res.status(403).json({ error: 'Mining is disabled' });
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
    // ✅ [Job] Miner 수확 쿨다운 -30% (miner_harvest_cooldown = 0.7)
    try { if (jobService) { const cd = await jobService.getJobBuff(w, 'miner_harvest_cooldown', 1.0); intervalHours = Math.max(1, intervalHours * cd); } } catch (_je) {}

    // Check cooldown
    // 신규 유저에게도 FOR UPDATE가 동작하도록 sentinel 행을 먼저 upsert해서 락 보장
    await client.query(
      `INSERT INTO user_mining (wallet_address) VALUES ($1) ON CONFLICT (wallet_address) DO NOTHING`,
      [w]
    );
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
    // [통일] 전역/영토 harvest 가 동일 today_mined_pp 카운터를 공유하므로 두 캡 중 더 제한적인 값으로 통일(Codex 검토 — 키 불일치 우회 차단). 0=무제한
    const _capA = parseFloat(s.pp_daily_earn_cap_per_user) || 0;
    const _capB = parseFloat(s.mining_daily_cap_per_user) || 0;
    const dailyCap = (_capA > 0 && _capB > 0) ? Math.min(_capA, _capB) : (_capA || _capB);

    // Random base reward scaled by pixel count (diminishing returns)
    // sqrt(pixels) gives diminishing returns: 100px=10x, 10000px=100x (not 100x linear)
    const pixelFactor = Math.min(Math.sqrt(totalPixels) / 10, 3.0); // cap at 3x
    const baseRandom = rewardMin + Math.random() * (rewardMax - rewardMin);
    let harvestedPP = Math.round(baseRandom * pixelFactor * 10000) / 10000;

    // ✅ [P1-1 FIX] Apply hard cap to BASE here (before multipliers).
    // 이전엔 모든 multiplier 적용 후 cap 을 씌워 VIP/buff/governor 등 누적 보너스가
    // cap 에 흡수되어 무용해졌음. 이제 base 만 cap 하고 그 위에 multiplier 들이 곱해진다.
    if (harvestCap > 0) harvestedPP = Math.min(harvestedPP, harvestCap);

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

    // ── Weather modifiers (safe) ──
    try {
      if (weatherService) {
        const sectorRows = await client.query(
          'SELECT DISTINCT sector_id FROM pixels WHERE owner = $1 AND sector_id IS NOT NULL', [w]
        );
        let bestMiningMod = 0;
        for (const row of sectorRows.rows) {
          const wMods = await weatherService.getWeatherModifiers(row.sector_id);
          if (wMods.miningMod > bestMiningMod) bestMiningMod = wMods.miningMod;
        }
        if (bestMiningMod > 0) {
          harvestedPP = Math.round(harvestedPP * (1 + bestMiningMod / 100) * 10000) / 10000;
        }
      }
    } catch (we) { /* weather system unavailable */ }

    // ── Starlink boost (safe) ──
    try {
      if (explorationService) {
        const sectorRows2 = await client.query(
          'SELECT DISTINCT sector_id FROM pixels WHERE owner = $1 AND sector_id IS NOT NULL', [w]
        );
        let bestStarlinkBoost = 0;
        for (const row of sectorRows2.rows) {
          const slBoost = await explorationService.getStarlinkBoost(row.sector_id);
          if (slBoost > bestStarlinkBoost) bestStarlinkBoost = slBoost;
        }
        if (bestStarlinkBoost > 0) {
          harvestedPP = Math.round(harvestedPP * (1 + bestStarlinkBoost) * 10000) / 10000;
        }
      }
    } catch (_se) { /* starlink system unavailable */ }

    // Check personal mining_boost item effect
    try {
      const mbRes = await client.query(
        `SELECT id, effect_value FROM user_active_effects
         WHERE wallet = $1 AND effect_type = 'mining_boost' AND active = true
           AND expires_at > NOW()
         ORDER BY id DESC LIMIT 1`, [w]
      );
      if (mbRes.rows.length > 0) {
        const boost = parseFloat(mbRes.rows[0].effect_value) / 100; // e.g. 50 → 0.5
        harvestedPP = Math.round(harvestedPP * (1 + boost) * 10000) / 10000;
      }
    } catch(me) { /* item system unavailable */ }

    // ── Guild research: mining_eff_1 bonus ──
    try {
      if (guildService && guildService.getResearchBonuses) {
        const rb = await guildService.getResearchBonuses(w);
        if (rb.mining > 0) {
          harvestedPP = Math.round(harvestedPP * (1 + rb.mining / 100) * 10000) / 10000;
        }
      }
    } catch (_grb) { /* guild research unavailable */ }

    // ✅ [Job System] Miner mining rate buff (Phase 1)
    try { if (jobService) harvestedPP = Math.round(harvestedPP * await jobService.getJobBuff(w, 'miner_mining_rate', 1.0) * 10000) / 10000; } catch (_je) { /* job service unavailable */ }
    // ✅ [Job] 직업별 채굴 패널티: warrior -20%, crafter -20%, merchant -15%
    try { if (jobService) { const wM = await jobService.getJobBuff(w,'warrior_mining_rate',1.0), cM = await jobService.getJobBuff(w,'crafter_mining_rate',1.0), mM = await jobService.getJobBuff(w,'merchant_mining_rate',1.0); harvestedPP = Math.round(harvestedPP * wM * cM * mM * 10000) / 10000; } } catch (_je) {}

    // ✅ [VIP] Mining boost bonus
    try {
      const vipSvc = require('../services/vip');
      const vipBoost = await vipSvc.getMiningBoost(w);
      if (vipBoost > 1.0) {
        harvestedPP = Math.round(harvestedPP * vipBoost * 10000) / 10000;
      }
    } catch (_vip) { /* VIP service unavailable */ }

    // ✅ [Colony Prestige] 플레이어 랭크별 채굴 보너스 (Migration 172)
    try {
      const prestigeSvc = require('../services/prestige');
      const pBoost = await prestigeSvc.getMiningBonus(w);
      if (pBoost > 1.0) {
        harvestedPP = Math.round(harvestedPP * pBoost * 10000) / 10000;
      }
    } catch (_pr) { /* prestige service unavailable */ }

    // ✅ [Territory Prestige] 소유 클레임 최고 티어 채굴 보너스 (Migration 172)
    try {
      const tprestigeSvc = require('../services/tprestige');
      const tBoost = await tprestigeSvc.getBestClaimMiningBonus(w);
      if (tBoost > 1.0) {
        harvestedPP = Math.round(harvestedPP * tBoost * 10000) / 10000;
      }
    } catch (_tp) { /* tprestige service unavailable */ }

    // ✅ [P0-3 FIX] Territory Tiers (services/tiers.js) miningBonusPct — 적용 누락 fix.
    // territory_tiers 테이블의 highest tier (유저가 보유) miningBonusPct 가 채굴에 가산되도록 추가.
    try {
      const tiersSvc = require('../services/tiers');
      const cfg = await tiersSvc.getCfg();
      if (cfg && cfg.enabled) {
        const tRes = await client.query(
          `SELECT MAX(tt.tier) AS max_tier FROM territory_tiers tt
             JOIN claims c ON c.id = tt.claim_id
            WHERE LOWER(tt.wallet) = LOWER($1) AND c.deleted_at IS NULL`,
          [w]
        );
        const maxTier = parseInt(tRes.rows[0]?.max_tier || 0);
        if (maxTier > 0) {
          const tierDef = (cfg.tiers || [])[maxTier - 1];
          const bonusPct = parseFloat(tierDef?.miningBonusPct || 0);
          if (bonusPct > 0) {
            harvestedPP = Math.round(harvestedPP * (1 + bonusPct / 100) * 10000) / 10000;
          }
        }
      }
    } catch (_te) { /* tiers service unavailable */ }

    // ✅ [P5-4 FIX] Territory upgrade extractor bonus — 영토 업그레이드 채굴기 레벨을 실수확에 반영.
    // 유저 소유 전 클레임 중 MAX extractor 레벨 적용.
    // Lv1=+15%, Lv2=+30%, Lv3=+50%, Lv4=+75%, Lv5=+100%
    try {
      const extRes = await client.query(
        `SELECT MAX(u.level) AS max_level
         FROM territory_upgrades u
         JOIN claims c ON c.id = u.claim_id
         WHERE LOWER(c.owner) = $1
           AND u.upgrade_type = 'extractor'
           AND u.is_active = true
           AND c.deleted_at IS NULL`,
        [w]
      );
      const extractorLevel = parseInt(extRes.rows[0]?.max_level || 0);
      if (extractorLevel > 0) {
        const bonusMap = { 1: 0.15, 2: 0.30, 3: 0.50, 4: 0.75, 5: 1.00 };
        const bonus = bonusMap[extractorLevel] || 0;
        if (bonus > 0) {
          harvestedPP = Math.round(harvestedPP * (1 + bonus) * 10000) / 10000;
        }
      }
    } catch (_ext) { /* territory upgrade unavailable */ }

    // (구버전 전역 harvest — 채굴 탭 제거 후 미사용. 보너스는 /territory/:id/harvest에만 적용)

    // (P1-1) cap 은 위에서 base 에 이미 적용됨 — 여기선 multipliers 누적 후 추가 cap 적용 안 함.

    // Apply daily cap (0=unlimited)
    const todayDate = now.toISOString().slice(0, 10);
    let todayMined = 0;
    if (miningRes.rows.length && miningRes.rows[0].today_date === todayDate) {
      todayMined = parseFloat(miningRes.rows[0].today_mined_pp) || 0;
    }
    if (dailyCap > 0) {
      const dailyRemaining = Math.max(0, dailyCap - todayMined);
      if (dailyRemaining <= 0) {
        await client.query('ROLLBACK');
        return res.status(429).json({ error: 'Daily mining cap reached (' + dailyCap + ' PP/day)' });
      }
      harvestedPP = Math.min(harvestedPP, dailyRemaining);
    }

    // [v7.354] quest_reward_pool 제거 — 채굴 보상은 GP로 직접 지급(풀 throttle 없음).
    //   PP는 충전(deposit) 전용. 일일 채굴 캡(dailyCap)은 위에서 이미 적용됨.
    harvestedPP = Math.round(harvestedPP * 10000) / 10000;
    if (harvestedPP <= 0) {
      await client.query('ROLLBACK');
      return res.status(429).json({ error: 'No rewards available' });
    }

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

    const ppToGpRate = await getPPToGPRate(client);
    const harvestedGP = Math.round(harvestedPP * ppToGpRate * 1000000) / 1000000;

    // [경제v2 P2] 채굴 수확은 PP 발행 대신 가치 보존 GP로 지급.
    await client.query(
      'UPDATE users SET gp_balance = COALESCE(gp_balance, 0) + $1 WHERE LOWER(wallet_address) = LOWER($2)',
      [harvestedGP, w]
    );

    // ── Guild harvest contribution (auto-siphon into guild treasury) ──
    let guildContrib = null;
    try {
      if (guildService && guildService.contributeHarvest) {
        const gr = await guildService.contributeHarvest(client, w, harvestedPP);
        if (gr.contributed > 0) {
          // Move the contribution out of user balance
          const guildContribGP = Math.round((gr.gpCredit || (gr.contributed * ppToGpRate)) * 1000000) / 1000000;
          const deductGuildContrib = await client.query(
            'UPDATE users SET gp_balance = gp_balance - $1 WHERE LOWER(wallet_address) = LOWER($2) AND gp_balance >= $1',
            [guildContribGP, w]
          );
          if (deductGuildContrib.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'Insufficient balance (concurrent modification)' });
          }
          guildContrib = gr;
        }
      }
    } catch (_gce) { /* non-critical */ }

    // ✅ [P5-2] 자원 드롭 — COMMIT 전에 roll하고 트랜잭션 안에서 인벤토리에 추가.
    // 이전: COMMIT 후 별도 pool로 처리 → 트랜잭션 메타에 drops 포함 불가.
    // 변경: rollResourceDrop은 SELECT만 하므로 COMMIT 전 호출 안전.
    //       addResourcesToInventory에 client 전달 → 같은 트랜잭션으로 처리.
    let resourceDrops = [];
    try {
      if (resourceService) {
        const tiersToRoll = ['core', 'mid', 'frontier'].filter(t => (tierCounts[t] || 0) > 0);
        const merged = {};
        for (const tier of tiersToRoll) {
          const drops = await resourceService.rollResourceDrop(w, tier);
          for (const d of drops) {
            merged[d.code] = (merged[d.code] || 0) + d.quantity;
          }
        }
        resourceDrops = Object.keys(merged).map(code => ({ code, quantity: merged[code] }));
        if (resourceDrops.length > 0) {
          await resourceService.addResourcesToInventory(client, w, resourceDrops);
        }
      }
    } catch (_re) { /* resource system unavailable — non-critical */ }

    // Transaction log (includes resource drops in meta)
    await client.query(
      `INSERT INTO transactions (type, from_wallet, pp_amount, fee, meta)
       VALUES ('mining', $1, $2, 0, $3)`,
      [w, harvestedPP, JSON.stringify({ currency: 'gp', gpAmount: harvestedGP, ppEquivalent: harvestedPP, totalPixels, bestTier, tierCounts, isGovernor, pixelFactor: Math.round(pixelFactor * 100) / 100, guildContrib, resourceDrops })]
    );

    // Award XP for harvesting (5 XP per harvest)
    const harvestRankUp = await awardXP(client, w, 5);

    // Referral commission — [경제v2 P2] harvest referral also pays GP, not PP.
    try {
      await creditReferralCommission(client, w, 'harvest', harvestedGP, 'gp');
    } catch (_e) { /* non-critical */ }

    await client.query('COMMIT');

    const nextHarvestAt = new Date(now.getTime() + intervalHours * 3600000);
    res.json({
      success: true,
      harvestedPP,
      netPP: guildContrib ? (harvestedPP - guildContrib.contributed) : harvestedPP,
      guildContribPP: guildContrib ? guildContrib.contributed : 0,
      totalPixels,
      bestTier,
      rankUp: harvestRankUp || null,
      isGovernor,
      intervalHours,
      nextHarvestAt,
      resources: resourceDrops
    });

    // Daily mission progress hook (non-blocking)
    if (dailyService) {
      try { await dailyService.updateMissionProgress(w, 'harvest', 1); } catch (_de) { /* non-critical */ }
    }
    // Weekly challenge: harvest
    if (weeklySvc) { weeklySvc.trackProgress(w, 'harvest_pp', 1).catch(() => {}); }
    // Season score hooks (non-blocking)
    if (seasonService) {
      try {
        seasonService.addSeasonScore(w, 'harvest', 1).catch(() => {});
        if (harvestedPP > 0) seasonService.addSeasonScore(w, 'pp_earn', 1).catch(() => {});
        // Season pass XP
        if (seasonService.addPassXP) seasonService.addPassXP(w, 'harvest').catch(() => {});
      } catch (_se) { /* non-critical */ }
    }
    // Guild war: harvest points
    try {
      if (guildService && guildService.recordWarAction) {
        const warPts = parseInt(await getSetting('guild_war_harvest_points') || '1');
        guildService.recordWarAction(w, 'harvest', warPts, { pp: harvestedPP }).catch(() => {});
      }
    } catch (_gw) { /* non-critical */ }
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('[API] harvest error:', e.message);
    res.status(500).json({ error: 'Internal error' });
  } finally {
    client.release();
  }
});

// ══════════════════════════════════════════════════════════
//  POST /api/territory/:claimId/harvest — 영토별 개별 수확
//  각 claim 에 독립 cooldown (claims.last_harvest_at)
// ══════════════════════════════════════════════════════════
router.post('/territory/:claimId/harvest', requireAuth, harvestLimiter, async (req, res) => {
  const claimId = parseInt(req.params.claimId);
  const w = getAuthWallet(req);
  if (!w || w.length < 10) return res.status(401).json({ error: 'wallet_required' });
  if (!claimId || isNaN(claimId)) return res.status(400).json({ error: 'invalid_claim_id' });

  const client = await pool.connect();
  try {
    const s = await cfg();
    if (s.mining_enabled === false) return res.status(403).json({ error: 'Mining is disabled' });

    await client.query('BEGIN');

    // 소유권 확인 + last_harvest_at 가져오기 (FOR UPDATE으로 동시 이중 수확 경쟁 방지)
    const claimRes = await client.query(
      `SELECT c.id, c.owner, c.sector_code, c.last_harvest_at, ps.sector_id,
              COALESCE(sd.sector_type, 'frontier') AS sector_tier,
              COALESCE(ps.pixel_cnt, 0) AS pixel_cnt
       FROM claims c
       LEFT JOIN (
         SELECT claim_id, COUNT(*) AS pixel_cnt, MIN(sector_id) AS sector_id
         FROM pixels
         WHERE claim_id = $1
         GROUP BY claim_id
       ) ps ON ps.claim_id = c.id
       LEFT JOIN sector_definitions sd ON sd.code = c.sector_code
       WHERE c.id = $1 AND c.deleted_at IS NULL
       FOR UPDATE OF c`,
      [claimId]
    );
    if (!claimRes.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'claim_not_found' });
    }
    const claim = claimRes.rows[0];
    if ((claim.owner || '').toLowerCase() !== w) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'not_your_territory' });
    }

    const totalPixels = parseInt(claim.pixel_cnt) || 0;
    if (totalPixels === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'no_pixels' });
    }

    // 섹터 tier 기반 쿨다운
    const tierCounts = { core: 0, mid: 0, frontier: 0 };
    const tier = (claim.sector_tier || 'frontier').toLowerCase();
    tierCounts[tier] = totalPixels;

    const intervalCore = parseInt(s.mining_interval_core) || 24;
    const intervalMid  = parseInt(s.mining_interval_mid)  || 48;
    const intervalFrontier = parseInt(s.mining_interval_frontier) || 72;
    let intervalHours = tier === 'core' ? intervalCore : tier === 'mid' ? intervalMid : intervalFrontier;
    try { if (jobService) { const cd = await jobService.getJobBuff(w, 'miner_harvest_cooldown', 1.0); intervalHours = Math.max(1, intervalHours * cd); } } catch (_) {}

    // 쿨다운 체크
    const now = new Date();
    if (claim.last_harvest_at) {
      const elapsed = (now - new Date(claim.last_harvest_at)) / 3600000;
      if (elapsed < intervalHours) {
        await client.query('ROLLBACK');
        const nextAt = new Date(new Date(claim.last_harvest_at).getTime() + intervalHours * 3600000);
        return res.status(429).json({ error: 'harvest_on_cooldown', nextHarvestAt: nextAt, intervalHours });
      }
    }

    // PP 계산 (기존 harvest 동일 공식)
    const rewardMin = parseFloat(s.mining_reward_min) || 0.01;
    const rewardMax = parseFloat(s.mining_reward_max) || 0.5;
    const harvestCap = parseFloat(s.mining_reward_cap_per_harvest) || 1.0;

    const pixelFactor = Math.min(Math.sqrt(totalPixels) / 10, 3.0);
    const baseRandom = rewardMin + Math.random() * (rewardMax - rewardMin);
    let harvestedPP = Math.round(baseRandom * pixelFactor * 10000) / 10000;
    if (harvestCap > 0) harvestedPP = Math.min(harvestedPP, harvestCap);

    // Governor bonus
    try {
      const govRes = await client.query('SELECT COUNT(*) AS cnt FROM sectors WHERE governor_wallet = $1', [w]);
      if (parseInt(govRes.rows[0].cnt) > 0) harvestedPP = Math.round(harvestedPP * 1.2 * 10000) / 10000;
    } catch (_) {}

    // Sector mining buff
    try {
      if (claim.sector_id) {
        const buffs = await getActiveSectorBuffs(claim.sector_id);
        if (buffs.some(b => b.buff_type === 'mining_boost')) harvestedPP = Math.round(harvestedPP * 1.2 * 10000) / 10000;
      }
      const isDoubleMining = await hasActiveEvent('double_mining');
      if (isDoubleMining) harvestedPP = Math.round(harvestedPP * 2 * 10000) / 10000;
    } catch (_) {}

    // Weather
    try {
      if (weatherService && claim.sector_id) {
        const wMods = await weatherService.getWeatherModifiers(claim.sector_id);
        if (wMods.miningMod > 0) harvestedPP = Math.round(harvestedPP * (1 + wMods.miningMod / 100) * 10000) / 10000;
      }
    } catch (_) {}

    // VIP / Prestige / Territory tier / Extractor upgrade
    try { const v = require('../services/vip'); const vb = await v.getMiningBoost(w); if (vb > 1) harvestedPP = Math.round(harvestedPP * vb * 10000) / 10000; } catch (_) {}
    try { const p = require('../services/prestige'); const pb = await p.getMiningBonus(w); if (pb > 1) harvestedPP = Math.round(harvestedPP * pb * 10000) / 10000; } catch (_) {}
    try {
      const t = require('../services/tiers'); const tc = await t.getCfg();
      if (tc && tc.enabled) {
        const tRes = await client.query(`SELECT MAX(tt.tier) AS max_tier FROM territory_tiers tt JOIN claims c2 ON c2.id = tt.claim_id WHERE LOWER(tt.wallet) = $1 AND c2.deleted_at IS NULL`, [w]);
        const maxTier = parseInt(tRes.rows[0]?.max_tier || 0);
        if (maxTier > 0) { const td = (tc.tiers||[])[maxTier-1]; const bp = parseFloat(td?.miningBonusPct||0); if (bp>0) harvestedPP = Math.round(harvestedPP*(1+bp/100)*10000)/10000; }
      }
    } catch (_) {}
    try {
      const extRes = await client.query(`SELECT MAX(u.level) AS max_level FROM territory_upgrades u WHERE u.claim_id = $1 AND u.upgrade_type = 'extractor' AND u.is_active = true`, [claimId]);
      const lvl = parseInt(extRes.rows[0]?.max_level || 0);
      if (lvl > 0) { const bmap = {1:0.15,2:0.30,3:0.50,4:0.75,5:1.00}; const b = bmap[lvl]||0; if (b>0) harvestedPP = Math.round(harvestedPP*(1+b)*10000)/10000; }
    } catch (_) {}

    // ✅ [장기 보유 보상] hold_bonus_pct — 이 클레임의 장기 보유 보너스 적용
    try {
      const holdRes = await client.query(
        `SELECT COALESCE(hold_bonus_pct, 0) AS bonus FROM claims WHERE id = $1 AND deleted_at IS NULL`,
        [claimId]
      );
      const holdBonus = parseFloat(holdRes.rows[0]?.bonus || 0);
      if (holdBonus > 0) harvestedPP = Math.round(harvestedPP * (1 + holdBonus / 100) * 10000) / 10000;
    } catch (_) {}

    // ✅ [영토 등급] grade 별 수확 PP 배수 (migration 237). 관리 잘한 고등급일수록 수확↑.
    //    grade 는 아래 resourceDrops 의 레어 배수에도 재사용.
    let _claimGrade = 'B';
    try {
      const gradeRes = await client.query(`SELECT grade FROM claims WHERE id = $1 AND deleted_at IS NULL`, [claimId]);
      _claimGrade = gradeRes.rows[0]?.grade || 'B';
      const _tc = require('../services/territoryCondition');
      const gm = await _tc.harvestMultiplier(_claimGrade);
      if (gm && gm !== 1) harvestedPP = Math.round(harvestedPP * gm * 10000) / 10000;
    } catch (_) {}

    // ✅ [주간 이벤트] 월요일 채굴 +50%
    try {
      if (new Date().getUTCDay() === 1) harvestedPP = Math.round(harvestedPP * 1.5 * 10000) / 10000;
    } catch (_) {}

    // ✅ [PP 일일 채굴 상한] pp_daily_earn_cap_per_user (0=무제한) — 무제한 farm/봇 파밍 방지
    // user_mining.today_mined_pp(오늘 누적)을 기준으로 남은 한도만큼만 지급한다.
    const _ppCapDate = now.toISOString().slice(0, 10);
    try {
      // [통일] 전역 /harvest 와 동일 캡 적용(둘 중 더 제한적). 공유 today_mined_pp 우회 차단.
      const _capA = parseFloat(await getSetting('pp_daily_earn_cap_per_user', '0')) || 0;
      const _capB = parseFloat(await getSetting('mining_daily_cap_per_user', '0')) || 0;
      const ppDailyCap = (_capA > 0 && _capB > 0) ? Math.min(_capA, _capB) : (_capA || _capB);
      if (ppDailyCap > 0) {
        const minedRes = await client.query(
          `SELECT CASE WHEN today_date = $2 THEN COALESCE(today_mined_pp, 0) ELSE 0 END AS mined_today
             FROM user_mining WHERE LOWER(wallet_address) = LOWER($1)`,
          [w, _ppCapDate]
        );
        const minedToday = parseFloat(minedRes.rows[0]?.mined_today || 0);
        const remaining = Math.round(Math.max(0, ppDailyCap - minedToday) * 10000) / 10000;
        if (remaining <= 0) {
          await client.query('ROLLBACK');
          return res.status(429).json({ error: 'daily_pp_cap_reached', cap: ppDailyCap, minedToday });
        }
        if (harvestedPP > remaining) harvestedPP = remaining;
      }
    } catch (_) {}

    // [v7.354] quest_reward_pool 제거 — 클레임 수확 보상은 GP로 직접 지급(풀 throttle 없음).
    //   일일 PP 캡(ppDailyCap)은 위에서 이미 적용됨.
    harvestedPP = Math.round(harvestedPP * 10000) / 10000;
    if (harvestedPP <= 0) { await client.query('ROLLBACK'); return res.status(429).json({ error: 'no_rewards' }); }

    // claims.last_harvest_at 갱신
    await client.query('UPDATE claims SET last_harvest_at = NOW() WHERE id = $1', [claimId]);

    // user_mining stats 갱신 (기존 채굴 통계와 호환)
    const todayDate = now.toISOString().slice(0, 10);
    await client.query(`
      INSERT INTO user_mining (wallet_address, last_harvest_at, total_mined_pp, today_mined_pp, today_date)
      VALUES ($1, NOW(), $2, $2, $3)
      ON CONFLICT (wallet_address) DO UPDATE SET
        total_mined_pp = user_mining.total_mined_pp + $2,
        today_mined_pp = CASE WHEN user_mining.today_date = $3 THEN user_mining.today_mined_pp + $2 ELSE $2 END,
        today_date = $3
    `, [w, harvestedPP, todayDate]);

    const ppToGpRate = await getPPToGPRate(client);
    const harvestedGP = Math.round(harvestedPP * ppToGpRate * 1000000) / 1000000;

    // [경제v2 P2] 즉시 수확은 PP 발행 대신 가치 보존 GP로 지급.
    await client.query('UPDATE users SET gp_balance = COALESCE(gp_balance, 0) + $1 WHERE LOWER(wallet_address) = LOWER($2)', [harvestedGP, w]);

    // 자원 드롭
    let resourceDrops = [];
    try {
      if (resourceService) {
        // ✅ [영토 등급 v7.140] 고등급 영토는 rare/special 재료 드롭 "확률"↑ (drop chance, 수량 아님 → 이중적용 방지)
        let _gradeRareMult = 1;
        try { _gradeRareMult = await require('../services/territoryCondition').rareMultiplier(_claimGrade); } catch (_) {}
        const drops = await resourceService.rollResourceDrop(w, tier, { gradeRareMult: _gradeRareMult });
        const merged = {};
        for (const d of drops) merged[d.code] = (merged[d.code] || 0) + d.quantity;
        resourceDrops = Object.keys(merged).map(code => ({ code, quantity: merged[code] }));
        if (resourceDrops.length > 0) await resourceService.addResourcesToInventory(client, w, resourceDrops);
      }
    } catch (_) {}

    // 트랜잭션 로그
    await client.query(
      `INSERT INTO transactions (type, from_wallet, pp_amount, fee, meta) VALUES ('mining', $1, $2, 0, $3)`,
      [w, harvestedPP, JSON.stringify({ currency: 'gp', gpAmount: harvestedGP, ppEquivalent: harvestedPP, claimId, totalPixels, tier, pixelFactor: Math.round(pixelFactor*100)/100, resourceDrops })]
    );

    await awardXP(client, w, 5).catch(() => {});
    // [경제v2 P2] harvest referral also pays GP, not PP.
    try { await creditReferralCommission(client, w, 'harvest', harvestedGP, 'gp'); } catch (_) {}

    await client.query('COMMIT');

    const nextHarvestAt = new Date(now.getTime() + intervalHours * 3600000);
    // [v7.320] 즉시 수확은 GP로 지급되므로 harvestedGP를 함께 내려 UI가 "+N GP"로 표시하게 한다.
    res.json({ success: true, harvestedPP, harvestedGP, totalPixels, tier, intervalHours, nextHarvestAt, resources: resourceDrops });

    // Non-blocking hooks
    try { if (dailyService) dailyService.updateMissionProgress(w, 'harvest', 1).catch(() => {}); } catch (_) {}
    try { const _dOps = require('./dailyOps'); _dOps.notifyMissionProgress(w, 'harvest_pp').catch(()=>{}); _dOps.notifyMissionProgress(w, 'harvest_3').catch(()=>{}); _dOps.notifyMissionProgress(w, 'harvest_5').catch(()=>{}); } catch(_) {}
    try { if (seasonService) { seasonService.addSeasonScore(w, 'harvest', 1).catch(() => {}); if (harvestedPP > 0) seasonService.addSeasonScore(w, 'pp_earn', 1).catch(() => {}); } } catch (_) {}
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('[API] territory harvest error:', e.message);
    res.status(500).json({ error: 'internal_error' });
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
  const w = sanitize(wallet, 255).toLowerCase();
  const client = await pool.connect();
  try {
    // Check existing active quests
    const existing = await client.query(
      "SELECT tier FROM user_quests WHERE LOWER(wallet) = LOWER($1) AND status IN ('active','completed')",
      [w]
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
         WHERE LOWER(wallet) = LOWER($1) AND tier = $2 AND status = 'claimed'
         AND claimed_at > NOW() - INTERVAL '1 hour' * (SELECT cooldown_hours FROM quest_templates WHERE id = user_quests.template_id)`,
        [w, tier]
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
          wallet: w, template_id: tpl.id, tier,
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
    const w = sanitize(req.query.wallet, 255).toLowerCase();
    if (!w) return res.status(400).json({ error: 'wallet required' });

    // Auto-generate quests if user has fewer than expected
    await generateQuestsForUser(w);

    // Expire old quests
    await pool.query(
      "UPDATE user_quests SET status = 'expired' WHERE LOWER(wallet) = LOWER($1) AND status = 'active' AND expires_at < NOW()",
      [w]
    );

    // Fetch active + completed (unclaimed)
    const result = await pool.query(
      `SELECT id, tier, title, description, requirement_type, requirement_value,
              current_progress, reward_pp, status, assigned_at, expires_at
       FROM user_quests
       WHERE LOWER(wallet) = LOWER($1) AND status IN ('active','completed')
       ORDER BY
         CASE tier WHEN 'free' THEN 1 WHEN 'activity' THEN 2 WHEN 'spending' THEN 3 END,
         assigned_at DESC`,
      [w]
    );

    // Also get recently claimed (last 24h) for "completed" display
    const claimed = await pool.query(
      `SELECT id, tier, title, reward_pp, claimed_at
       FROM user_quests
       WHERE LOWER(wallet) = LOWER($1) AND status = 'claimed' AND claimed_at > NOW() - INTERVAL '24 hours'
       ORDER BY claimed_at DESC LIMIT 10`,
      [w]
    );

    // [v7.354] quest_reward_pool 제거 — 풀 헬스 배율 폐지(항상 1.0). 보상은 GP 직접 지급.
    const s = await cfg();
    const poolBalance = 1;       // 호환용 sentinel (UI active=true 표기)
    const poolMultiplier = 1.0;  // 풀 배율 폐지 — 항상 풀 보상

    // [v7.275] 퀘스트 보상은 GP로 지급(경제v2 P2)되므로 GP 환산값을 함께 내려 UI가 'GP'로 정확히 표기하게 함.
    const questRate = await getPPToGPRate();
    // [v7.325] 무료/활동 미션도 의미있는 GP를 주도록 티어별 최소 GP 바닥값 적용 (소액 PP가 0 GP로 반올림되던 문제 해소).
    const _qFloor = {
      free:     parseInt(await getSetting('quest_min_gp_free', '3'), 10)     || 3,
      activity: parseInt(await getSetting('quest_min_gp_activity', '8'), 10)  || 8,
      spending: parseInt(await getSetting('quest_min_gp_spending', '20'), 10) || 20
    };
    res.json({
      quests: result.rows.map(r => {
        const ar = Math.min(
          Math.round(parseFloat(r.reward_pp) * poolMultiplier * 10000) / 10000,
          r.tier === 'free' ? (parseFloat(s.quest_max_reward_free) || 0.05) :
          r.tier === 'activity' ? (parseFloat(s.quest_max_reward_activity) || 0.3) :
          (parseFloat(s.quest_max_reward_spending) || 1.0)
        );
        return {
          ...r,
          reward_pp: parseFloat(r.reward_pp),
          actual_reward: ar,
          reward_gp: Math.max(_qFloor[r.tier] || 0, Math.round(ar * questRate * 1e6) / 1e6),
          requirement_value: parseFloat(r.requirement_value),
          current_progress: parseFloat(r.current_progress),
          progress_pct: Math.min(100, Math.round((parseFloat(r.current_progress) / parseFloat(r.requirement_value)) * 100))
        };
      }),
      recentlyClaimed: claimed.rows.map(r => ({
        ...r,
        reward_pp: parseFloat(r.reward_pp),
        reward_gp: Math.max(_qFloor[r.tier] || 0, Math.round(parseFloat(r.reward_pp) * questRate * 1e6) / 1e6)
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
router.post('/quests/:id/progress', requireAuth, writeLimiter, async (req, res) => {
  const client = await pool.connect();
  try {
    const questId = parseInt(req.params.id);
    const { amount } = req.body;
    const w = getAuthWallet(req);
    if (!w || !questId) return res.status(400).json({ error: 'Invalid params' });
    const increment = parseFloat(amount) || 1;

    await client.query('BEGIN');

    const qRes = await client.query(
      "SELECT * FROM user_quests WHERE id = $1 AND LOWER(wallet) = LOWER($2) AND status = 'active' FOR UPDATE",
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

    // 🔔 퀘스트 완료 알림
    if (isComplete) {
      notifyPlayer(wallet.toLowerCase(), 'quest_complete',
        `✅ 퀘스트 완료! 보상을 수령하세요.`,
        { questId }
      ).catch(() => {});
    }

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
router.post('/quests/:id/claim', requireAuth, writeLimiter, async (req, res) => {
  const client = await pool.connect();
  try {
    const questId = parseInt(req.params.id);
    const w = getAuthWallet(req);
    if (!w || !questId) return res.status(400).json({ error: 'Invalid params' });

    await client.query('BEGIN');

    const qRes = await client.query(
      "SELECT * FROM user_quests WHERE id = $1 AND LOWER(wallet) = LOWER($2) AND status = 'completed' FOR UPDATE",
      [questId, w]
    );
    if (qRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Quest not completed or already claimed' });
    }

    const quest = qRes.rows[0];
    const baseReward = parseFloat(quest.reward_pp);
    const s = await cfg();

    // [v7.354] quest_reward_pool 제거 — 퀘스트 보상은 GP로 직접 지급(풀 배율/예산/차감 없음).
    //   tier 하드캡 + 유저 일일캡은 남용 방지를 위해 유지. PP는 충전(deposit) 전용.
    const multiplier = 1.0;   // 풀 헬스 배율 폐지 — 항상 1.0
    const poolBalance = 0;    // 호환용 (아래 transaction meta 로그 참조)

    // Hard caps per tier — platform NEVER pays more than this
    const tierCaps = {
      free: parseFloat(s.quest_max_reward_free) || 0.05,
      activity: parseFloat(s.quest_max_reward_activity) || 0.3,
      spending: parseFloat(s.quest_max_reward_spending) || 1.0
    };
    const tierCap = tierCaps[quest.tier] || 0.05;
    const userDailyCap = parseFloat(s.quest_max_daily_per_user) || 2.0;

    // Check user's daily total claimed (유저 일일 한도 — 남용 방지)
    const userTodayRes = await client.query(
      "SELECT COALESCE(SUM(pp_amount),0) AS total FROM transactions WHERE type='quest' AND LOWER(from_wallet)=LOWER($1) AND created_at > CURRENT_DATE",
      [w]
    );
    const userTodayTotal = parseFloat(userTodayRes.rows[0].total);
    const userDailyRemaining = Math.max(0, userDailyCap - userTodayTotal);

    let actualReward = Math.round(baseReward * multiplier * 10000) / 10000;
    actualReward = Math.min(actualReward, tierCap);            // tier hard cap
    actualReward = Math.min(actualReward, userDailyRemaining); // user daily cap
    actualReward = Math.round(actualReward * 10000) / 10000;

    if (actualReward <= 0) {
      await client.query('ROLLBACK');
      return res.status(429).json({ error: 'Daily reward limit reached ($'+userDailyCap+'/day)' });
    }

    const ppToGpRate = await getPPToGPRate(client);
    // [v7.325] 무료/활동 미션도 의미있는 GP 지급 — 티어별 최소 GP 바닥값(표시값과 동일 기준).
    const _qFloorClaim = {
      free:     parseInt(await getSetting('quest_min_gp_free', '3'), 10)     || 3,
      activity: parseInt(await getSetting('quest_min_gp_activity', '8'), 10)  || 8,
      spending: parseInt(await getSetting('quest_min_gp_spending', '20'), 10) || 20
    };
    const actualRewardGP = Math.max(_qFloorClaim[quest.tier] || 0, Math.round(actualReward * ppToGpRate * 1000000) / 1000000);

    // [경제v2 P2] 퀘스트 보상은 PP 발행 대신 가치 보존 GP로 지급.
    await client.query(
      'UPDATE users SET gp_balance = COALESCE(gp_balance, 0) + $1 WHERE LOWER(wallet_address) = LOWER($2)',
      [actualRewardGP, w]
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
        currency: 'gp', gp_amount: actualRewardGP, pp_equivalent: actualReward,
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
      rewardGP: actualRewardGP,
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
router.post('/quests/track', requireAuth, writeLimiter, async (req, res) => {
  try {
    const { action, amount } = req.body;
    const w = getAuthWallet(req);
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

// Item shop, item instances, and enhancement routes live in routes/itemEconomyRoutes.js.

// Weather, exploration, and rocket routes live in routes/worldOpsRoutes.js.

// ══════════════════════════════════════
// COSMETICS
// ══════════════════════════════════════

// POST /api/cosmetic/equip — equip a cosmetic to a claim
router.post('/cosmetic/equip', requireAuth, writeLimiter, async (req, res) => {
  const { claimId, itemCode } = req.body;
  const w = getAuthWallet(req);
  if (!w || !claimId || !itemCode) return res.status(400).json({ error: 'Missing params' });

  // Derive cosmetic_type from item code
  let cosmeticType;
  if (itemCode.endsWith('_border')) cosmeticType = 'border';
  else if (itemCode.endsWith('_glow') || itemCode === 'dark_aura') cosmeticType = 'glow';
  else if (itemCode.endsWith('_terrain')) cosmeticType = 'terrain';
  else return res.status(400).json({ error: 'Not a cosmetic item' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const s = await cfg();

    // Verify claim ownership
    const claimRes = await client.query('SELECT owner FROM claims WHERE id = $1 AND deleted_at IS NULL', [claimId]);
    if (!claimRes.rows[0] || claimRes.rows[0].owner.toLowerCase() !== w) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Not your claim' });
    }

    // ✅ [P0-2 FIX] Verify ownership AND decrement user_items.quantity.
    // 이전엔 quantity > 0 체크만 하고 차감 안 해 1개로 N개 클레임에 무한 장착 가능했음.
    // 이전 동일 type cosmetic 은 ON CONFLICT 로 교체되며 인벤토리로 환수 (아래에서 처리).
    const invRes = await client.query(
      `SELECT ui.id, ui.quantity, ui.item_type_id FROM user_items ui
       JOIN item_types it ON it.id = ui.item_type_id
       WHERE ui.wallet = $1 AND it.code = $2 AND ui.quantity > 0
       FOR UPDATE`, [w, itemCode]
    );
    if (!invRes.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'You don\'t own this cosmetic' });
    }
    const newItemTypeId = invRes.rows[0].item_type_id;

    // 이미 같은 claim/type 에 다른 cosmetic 이 장착돼 있으면 인벤토리로 환수.
    const prevRes = await client.query(
      `SELECT cosmetic_code FROM user_cosmetics
        WHERE claim_id = $1 AND cosmetic_type = $2`,
      [claimId, cosmeticType]
    );
    const prevCode = prevRes.rows[0]?.cosmetic_code || null;
    if (prevCode && prevCode !== itemCode) {
      // 이전 cosmetic 을 user_items 로 환수 (+1)
      await client.query(
        `INSERT INTO user_items (wallet, item_type_id, quantity)
         SELECT $1, it.id, 1 FROM item_types it WHERE it.code = $2
         ON CONFLICT (wallet, item_type_id)
         DO UPDATE SET quantity = user_items.quantity + 1`,
        [w, prevCode]
      );
    }
    // 새 cosmetic quantity -1 (이전과 같은 코드면 차감/환수 없음 = 변동 없음)
    if (prevCode !== itemCode) {
      const deductCos = await client.query(
        `UPDATE user_items SET quantity = quantity - 1 WHERE id = $1 AND quantity > 0`,
        [invRes.rows[0].id]
      );
      if (deductCos.rowCount === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'You don\'t own this cosmetic' });
      }
    }

    // PP fee for equipping cosmetics
    const equipFee = parseFloat(s.cosmetic_equip_fee_pp) || 0;
    if (equipFee > 0) {
      const balRes = await client.query('SELECT pp_balance FROM users WHERE wallet_address = $1 FOR UPDATE', [w]);
      const ppBal = parseFloat(balRes.rows[0]?.pp_balance || 0);
      if (ppBal < equipFee) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: `Insufficient PP. Need ${equipFee} PP to equip cosmetic.` });
      }
      const deductEquip = await client.query('UPDATE users SET pp_balance = pp_balance - $1 WHERE LOWER(wallet_address) = LOWER($2) AND pp_balance >= $1', [equipFee, w]);
      if (deductEquip.rowCount === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Insufficient balance (concurrent modification)' });
      }
      await client.query(
        `INSERT INTO transactions (type, from_wallet, pp_amount, fee, meta)
         VALUES ('shop_purchase', $1, $2, 0, $3)`,
        [w, equipFee, JSON.stringify({ action: 'cosmetic_equip', itemCode, claimId })]
      );
    }

    // Equip (upsert — replaces existing cosmetic of same type on this claim)
    await client.query(
      `INSERT INTO user_cosmetics (wallet, claim_id, cosmetic_type, cosmetic_code)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (claim_id, cosmetic_type) DO UPDATE SET cosmetic_code = $4, wallet = $1, equipped_at = NOW()`,
      [w, claimId, cosmeticType, itemCode]
    );

    await client.query('COMMIT');
    res.json({ success: true, cosmeticType, cosmeticCode: itemCode, feePP: equipFee });
    // Daily mission + Season tracking (non-blocking)
    try { const ds = require('../services/daily'); ds.updateMissionProgress(w, 'equip_cosmetic', 1); } catch (_de) {}
    if (seasonService) {
      seasonService.addSeasonScore(w, 'cosmetic', 1).catch(() => {}); // fashionista
      if (equipFee > 0) seasonService.addSeasonScore(w, 'pp_spend', 1).catch(() => {});
    }
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('[COSMETIC] equip error:', e.message);
    res.status(500).json({ error: 'Equip failed' });
  } finally {
    client.release();
  }
});

// POST /api/cosmetic/unequip — remove a cosmetic from a claim
router.post('/cosmetic/unequip', requireAuth, writeLimiter, async (req, res) => {
  const { claimId, cosmeticType } = req.body;
  const w = getAuthWallet(req);
  if (!w || !claimId || !cosmeticType) return res.status(400).json({ error: 'Missing params' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // ✅ [P0-2 FIX] DELETE 시 user_items 로 환수 (+1) — equip 에서 차감했으므로.
    const result = await client.query(
      'DELETE FROM user_cosmetics WHERE wallet = $1 AND claim_id = $2 AND cosmetic_type = $3 RETURNING cosmetic_code',
      [w, claimId, cosmeticType]
    );
    if (!result.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'No cosmetic to remove' });
    }
    const code = result.rows[0].cosmetic_code;
    await client.query(
      `INSERT INTO user_items (wallet, item_type_id, quantity)
       SELECT $1, it.id, 1 FROM item_types it WHERE it.code = $2
       ON CONFLICT (wallet, item_type_id)
       DO UPDATE SET quantity = user_items.quantity + 1`,
      [w, code]
    );
    await client.query('COMMIT');
    res.json({ success: true, refundedItem: code });
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch (_) {}
    console.error('[COSMETIC] unequip error:', e.message);
    res.status(500).json({ error: 'Unequip failed' });
  } finally {
    client.release();
  }
});

// GET /api/cosmetic/equipped?wallet= — get all equipped cosmetics for a user
router.get('/cosmetic/equipped', readLimiter, async (req, res) => {
  const w = (req.query.wallet || '').toLowerCase();
  if (!w) return res.status(400).json({ error: 'Wallet required' });
  try {
    const result = await pool.query(
      'SELECT claim_id, cosmetic_type, cosmetic_code, equipped_at FROM user_cosmetics WHERE wallet = $1 ORDER BY equipped_at DESC',
      [w]
    );
    res.json(result.rows);
  } catch (e) {
    console.error('[COSMETIC] equipped error:', e.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

// Public loading lore and lore flag routes live in routes/campaignRoutes.js.

// ══════════════════════════════════════
// MICRO-TRANSACTIONS (Drizzle Revenue)
// ══════════════════════════════════════

// POST /api/harvest-instant — skip cooldown for 0.5 PP
router.post('/harvest-instant', requireAuth, harvestLimiter, async (req, res) => {
  const w = getAuthWallet(req);
  if (!w) return res.status(401).json({ error: 'Wallet required' });

  const client = await pool.connect();
  try {
    const s = await cfg();
    if (s.mining_enabled === false) return res.status(403).json({ error: 'Mining is disabled' });
    const instantCost = parseFloat(s.instant_harvest_cost_pp) || 0.5;

    await client.query('BEGIN');

    // Check PP balance
    const balRes = await client.query('SELECT pp_balance FROM users WHERE wallet_address = $1 FOR UPDATE', [w]);
    if (!balRes.rows.length) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'User not found' }); }
    const ppBal = parseFloat(balRes.rows[0].pp_balance);
    if (ppBal < instantCost) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: `Insufficient PP. Need ${instantCost} PP.`, cost: instantCost, balance: ppBal });
    }

    // Deduct cost
    const deductHarvest = await client.query('UPDATE users SET pp_balance = pp_balance - $1 WHERE LOWER(wallet_address) = LOWER($2) AND pp_balance >= $1', [instantCost, w]);
    if (deductHarvest.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Insufficient balance (concurrent modification)' });
    }

    // Log micro-transaction
    await client.query(
      `INSERT INTO transactions (type, from_wallet, pp_amount, fee, meta)
       VALUES ('instant_harvest', $1, $2, 0, $3)`,
      [w, instantCost, JSON.stringify({ action: 'skip_harvest_cooldown' })]
    );

    // Reset cooldown by updating last_harvest_at to a past time
    await client.query(
      `UPDATE user_mining SET last_harvest_at = NOW() - INTERVAL '999 hours' WHERE wallet_address = $1`,
      [w]
    );

    await client.query('COMMIT');

    res.json({ success: true, cost: instantCost, message: 'Cooldown skipped! You can harvest now.' });
    // Season tracking: pp_spend (non-blocking)
    if (seasonService) { seasonService.addSeasonScore(w, 'pp_spend', 1).catch(() => {}); }
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('[MICRO] instant-harvest error:', e.message);
    res.status(500).json({ error: 'Internal error' });
  } finally {
    client.release();
  }
});

// POST /api/claims/:id/rename — rename territory for 0.3 PP
router.post('/claims/:id/rename', requireAuth, writeLimiter, async (req, res) => {
  const { name } = req.body;
  const wallet = getAuthWallet(req);
  const claimId = parseInt(req.params.id);
  if (!wallet || !claimId || !name) return res.status(400).json({ error: 'Missing wallet, claimId, or name' });

  // Sanitize name: max 20 chars, no HTML
  const cleanName = sanitize(name, 20);
  if (cleanName.length === 0) return res.status(400).json({ error: 'Name cannot be empty' });
  if (cleanName.length > 20) return res.status(400).json({ error: 'Name too long (max 20 chars)' });

  const client = await pool.connect();
  try {
    const s = await cfg();
    const w = wallet.toLowerCase();
    const renameCost = parseFloat(s.rename_cost_pp) || 0.3;

    await client.query('BEGIN');

    // Verify claim ownership
    const claimRes = await client.query('SELECT owner, custom_name FROM claims WHERE id = $1 AND deleted_at IS NULL', [claimId]);
    if (!claimRes.rows.length) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Claim not found' }); }
    if (claimRes.rows[0].owner.toLowerCase() !== w) { await client.query('ROLLBACK'); return res.status(403).json({ error: 'Not your territory' }); }

    // Check PP balance
    const balRes = await client.query('SELECT pp_balance FROM users WHERE wallet_address = $1 FOR UPDATE', [w]);
    const ppBal = parseFloat(balRes.rows[0]?.pp_balance || 0);
    if (ppBal < renameCost) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: `Insufficient PP. Need ${renameCost} PP.`, cost: renameCost });
    }

    // Deduct PP
    const deductRename = await client.query('UPDATE users SET pp_balance = pp_balance - $1 WHERE LOWER(wallet_address) = LOWER($2) AND pp_balance >= $1', [renameCost, w]);
    if (deductRename.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Insufficient balance (concurrent modification)' });
    }

    // Update custom_name
    await client.query('UPDATE claims SET custom_name = $1 WHERE id = $2', [cleanName, claimId]);

    // Log transaction
    await client.query(
      `INSERT INTO transactions (type, from_wallet, pp_amount, fee, meta)
       VALUES ('rename_fee', $1, $2, 0, $3)`,
      [w, renameCost, JSON.stringify({ claimId, newName: cleanName })]
    );

    await client.query('COMMIT');

    res.json({ success: true, cost: renameCost, name: cleanName });
    // Season tracking: rename + pp_spend (non-blocking)
    if (seasonService) {
      seasonService.addSeasonScore(w, 'rename', 1).catch(() => {}); // namer
      seasonService.addSeasonScore(w, 'pp_spend', 1).catch(() => {});
    }
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('[MICRO] rename error:', e.message);
    res.status(500).json({ error: 'Rename failed' });
  } finally {
    client.release();
  }
});

// ══════════════════════════════════════════════════
// POST /api/territory/tend-all — 보유 영토 일괄 정비 (GP 여유 한도까지) [v7.147]
// ══════════════════════════════════════════════════
router.post('/territory/tend-all', requireAuth, writeLimiter, async (req, res) => {
  const w = getAuthWallet(req);
  if (!w || w.length < 10) return res.status(401).json({ error: 'wallet_required' });
  try {
    const r = await require('../services/territoryCondition').tendAll(w);
    if (!r.success) {
      const code = (r.error === 'insufficient_gp') ? 402 : (r.error === 'nothing_to_tend') ? 409 : 400;
      return res.status(code).json(r);
    }
    res.json(r);
  } catch (e) {
    console.error('[API] territory tend-all error:', e.message);
    res.status(500).json({ error: 'internal_error' });
  }
});

// ══════════════════════════════════════════════════
// POST /api/territory/:claimId/tend — 영토 정비(GP 소모 → condition 회복) [migration 237]
// ══════════════════════════════════════════════════
router.post('/territory/:claimId/tend', requireAuth, writeLimiter, async (req, res) => {
  const claimId = parseInt(req.params.claimId);
  const w = getAuthWallet(req);
  if (!w || w.length < 10) return res.status(401).json({ error: 'wallet_required' });
  if (!claimId || isNaN(claimId)) return res.status(400).json({ error: 'invalid_claim_id' });
  try {
    const r = await require('../services/territoryCondition').tend(w, claimId);
    if (!r.success) {
      const code = (r.error === 'insufficient_gp') ? 402 : (r.error === 'not_owner') ? 403 : (r.error === 'cooldown' || r.error === 'already_full') ? 409 : 400;
      return res.status(code).json(r);
    }
    res.json(r);
  } catch (e) {
    console.error('[API] territory tend error:', e.message);
    res.status(500).json({ error: 'internal_error' });
  }
});

// ══════════════════════════════════════════════════
// GET /api/territory/:claimId/production?wallet=...
// 영토 생산 요약 — 소유 여부, 섹터 유형, 예상 PP, 드롭 재료 목록, 모디파이어, 마지막 수확
// ══════════════════════════════════════════════════
router.get('/territory/:claimId/production', readLimiter, async (req, res) => {
  const claimId = parseInt(req.params.claimId);
  const wallet = (req.query.wallet || '').toLowerCase().trim();
  if (!claimId) return res.status(400).json({ error: 'claimId required' });

  try {
    // 1. Claim + pixel count + sector
    const claimRes = await pool.query(`
      SELECT c.id, c.owner, c.image_url, c.adjacency_bonus,
             COALESCE(c.hold_bonus_pct, 0) AS hold_bonus_pct,
             COALESCE(c.longest_hold_days, 0) AS longest_hold_days,
             COALESCE(c.condition, 100) AS condition, COALESCE(c.grade, 'B') AS grade, c.last_tended_at,
             c.sector_code, c.last_harvest_at,
             COALESCE(ps.pixel_count, 0) AS pixel_count,
             COALESCE(sd.sector_type, s.tier, 'frontier') AS sector_type,
             COALESCE(sd.name_en, s.name, 'Uncharted') AS sector_name,
             COALESCE(sd.id, s.id) AS sector_id
      FROM claims c
      LEFT JOIN (
        SELECT claim_id, COUNT(*) AS pixel_count, MIN(sector_id) AS sector_id
        FROM pixels
        WHERE claim_id = $1
        GROUP BY claim_id
      ) ps ON ps.claim_id = c.id
      LEFT JOIN sector_definitions sd ON sd.code = c.sector_code
      LEFT JOIN sectors s ON s.id = ps.sector_id
      WHERE c.id = $1 AND c.deleted_at IS NULL
    `, [claimId]);

    if (!claimRes.rows.length) return res.status(404).json({ error: 'Claim not found' });
    const claim = claimRes.rows[0];
    const owned = wallet ? claim.owner.toLowerCase() === wallet : false;
    const pixelCount = parseInt(claim.pixel_count) || 0;
    const sectorType = claim.sector_type;

    // 2. Resource drop rates for this sector type
    let materials = [];
    try {
      const ratesRes = await pool.query(`
        SELECT srr.resource_code AS code, srr.base_rate AS chance,
               r.name_en, r.name_ko, r.rarity, r.icon_emoji
        FROM sector_resource_rates srr
        JOIN resources r ON r.code = srr.resource_code
        WHERE srr.sector_type = $1 AND srr.is_active = TRUE AND r.is_active = TRUE
        ORDER BY srr.base_rate DESC
      `, [sectorType]);
      materials = ratesRes.rows.map(r => ({
        code: r.code,
        nameEn: r.name_en || r.code,
        nameKo: r.name_ko || r.code,
        rarity: r.rarity,
        icon: r.icon_emoji || '🔹',
        chance: parseFloat(r.chance)
      }));
    } catch (_) { /* resource table unavailable — safe fallback */ }

    // 3. PP estimate (same formula as harvest)
    const s = await cfg();
    const rewardMin = parseFloat(s.mining_reward_min) || 0.01;
    const rewardMax = parseFloat(s.mining_reward_max) || 0.5;
    const pixelFactor = pixelCount > 0 ? Math.min(Math.sqrt(pixelCount) / 10, 3.0) : 0;
    const miningBonusMap = { core: parseFloat(s.mining_core_mult) || 1.5, mid: parseFloat(s.mining_mid_mult) || 1.2, frontier: parseFloat(s.mining_frontier_mult) || 1.0 };
    const sectorMult = miningBonusMap[sectorType] || 1.0;
    const ppMin = Math.round(rewardMin * pixelFactor * sectorMult * 10000) / 10000;
    const ppMax = Math.round(rewardMax * pixelFactor * sectorMult * 10000) / 10000;

    // 4. Territory upgrades — fetch P5 tracks for this claim
    let claimUpgrades = [];
    let upgradeModifiers = [];
    try {
      const upRes = await pool.query(
        `SELECT upgrade_type, level FROM territory_upgrades WHERE claim_id = $1 AND is_active = true`,
        [claimId]
      );
      claimUpgrades = upRes.rows;
      const P5_UPGRADE_LABELS = {
        extractor:   { ko: '채굴기', effect: 'material_drop', unit: '% 재료' },
        refinery:    { ko: '정제소', effect: 'advanced_material', unit: '% 고급 재료' },
        shield_grid: { ko: '실드 그리드', effect: 'defense', unit: '% 방어력' },
        relay_tower: { ko: '중계 타워', effect: 'visibility', unit: '타일 반경' },
        art_beacon:  { ko: '아트 비콘', effect: 'pp_bonus', unit: '% PP' },
        mine_booster:{ ko: '채굴 부스터', effect: 'pp_bonus', unit: '% PP' },
        fortress:    { ko: '요새', effect: 'defense', unit: '% 방어력' },
      };
      // Precompute bonus % from settings for each upgrade type
      const upgradeSettingsRes = await pool.query(
        `SELECT key, value FROM settings WHERE key LIKE 'upgrade_%_bonus'`
      );
      const upgradeSettingsMap = {};
      upgradeSettingsRes.rows.forEach(r => { upgradeSettingsMap[r.key] = r.value; });
      const parseBonuses = (key, def) => (upgradeSettingsMap[key] || def || '').split(',').map(v => parseFloat(v.trim())).filter(n => !isNaN(n));
      const BONUS_DEFAULTS = {
        extractor: '15,30,50,75,100', refinery: '5,12,22,35,50', shield_grid: '10,22,38,55,75',
        relay_tower: '1,2,3,4,5', art_beacon: '3,6,10,15,20',
        mine_booster: '20,40,60,80,100', fortress: '15,30,50,70,90',
      };
      for (const u of claimUpgrades) {
        const info = P5_UPGRADE_LABELS[u.upgrade_type];
        if (!info) continue;
        const bonusArr = parseBonuses(`upgrade_${u.upgrade_type}_bonus`, BONUS_DEFAULTS[u.upgrade_type]);
        const bonus = bonusArr[u.level - 1] || 0;
        upgradeModifiers.push({
          upgradeType: u.upgrade_type,
          level: u.level,
          effect: info.effect,
          label: info.ko + ' Lv' + u.level,
          value: '+' + bonus + info.unit,
          bonus,
        });
      }
    } catch (_) { /* upgrades table unavailable */ }

    // 4b. Modifiers
    const modifiers = [];
    if (sectorType === 'core') modifiers.push({ label: 'Core sector', labelKo: '코어 섹터', value: '+50%' });
    else if (sectorType === 'mid') modifiers.push({ label: 'Mid sector', labelKo: '미드 섹터', value: '+20%' });
    if (claim.image_url) modifiers.push({ label: 'Image active', labelKo: '이미지 등록됨', value: '+5%' });
    if (parseFloat(claim.adjacency_bonus) > 0) modifiers.push({ label: 'Adjacency bonus', labelKo: '인접 보너스', value: '+' + Math.round(parseFloat(claim.adjacency_bonus) * 100) + '%' });
    // Hold bonus
    const holdBonusPct = parseFloat(claim.hold_bonus_pct) || 0;
    if (holdBonusPct > 0) modifiers.push({ label: 'Long hold bonus', labelKo: '장기 보유 보너스', value: '+' + holdBonusPct + '%' });
    // Include upgrade modifiers
    for (const um of upgradeModifiers) modifiers.push({ label: um.label, labelKo: um.label, value: um.value });

    // 5. Last harvest (claim-level cooldown from claims.last_harvest_at)
    let lastHarvest = null;
    let nextHarvestAt = null;
    if (owned && wallet) {
      try {
        const intervalCore = parseInt(s.mining_interval_core) || 24;
        const intervalMid = parseInt(s.mining_interval_mid) || 48;
        const intervalFrontier = parseInt(s.mining_interval_frontier) || 72;
        const interval = sectorType === 'core' ? intervalCore : sectorType === 'mid' ? intervalMid : intervalFrontier;
        const lastAt = claim.last_harvest_at;
        if (lastAt) {
          const elapsed = (Date.now() - new Date(lastAt).getTime()) / (1000 * 60 * 60);
          if (elapsed < interval) {
            nextHarvestAt = new Date(new Date(lastAt).getTime() + interval * 3600000);
          }
          const harvestRes = await pool.query(`
            SELECT pp_amount, meta, created_at
            FROM transactions
            WHERE (type = 'mining' OR type = 'instant_harvest')
              AND from_wallet = $1
            ORDER BY created_at DESC LIMIT 1
          `, [wallet]);
          const row = harvestRes.rows[0] || {};
          const metaMaterials = (row.meta && row.meta.resourceDrops) ? row.meta.resourceDrops : [];
          lastHarvest = {
            pp: parseFloat(row.pp_amount || 0),
            at: lastAt,
            materials: metaMaterials
          };
        }
      } catch (_) { /* no harvest data */ }
    }

    res.json({
      claimId,
      owned,
      condition: parseFloat(claim.condition != null ? claim.condition : 100),
      grade: claim.grade || 'B',
      lastTendedAt: claim.last_tended_at || null,
      tendCostGp: parseInt(await getSetting('territory_tend_cost_gp', '50')) || 50, // [v7.278] 프론트 TEND 비용 사전표시용

      sector: {
        type: sectorType,
        name: claim.sector_name,
        id: claim.sector_id
      },
      production: {
        pixelCount,
        ppMin,
        ppMax,
        modifiers,
        nextHarvestAt,
        holdBonusPct: holdBonusPct || 0,
        holdDays: parseInt(claim.longest_hold_days) || 0,
      },
      upgrades: claimUpgrades,
      upgradeModifiers,
      materials,
      lastHarvest
    });
  } catch (e) {
    console.error('[TERRITORY] production error:', e.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

// ══════════════════════════════════════════════════
// POST /api/territory/merge
// 여러 영토 클레임을 하나로 병합
// body: { wallet, claimIds: [id1, id2, ...] }
// ══════════════════════════════════════════════════
router.post('/territory/merge', requireAuth, writeLimiter, async (req, res) => {
  const wallet = getAuthWallet(req);
  if (!wallet || wallet.length < 10) return res.status(400).json({ error: 'wallet_required' });

  const rawIds = (req.body && req.body.claimIds) || [];
  const claimIds = rawIds.map(id => parseInt(id, 10)).filter(id => !isNaN(id) && id > 0);
  if (claimIds.length < 2) return res.status(400).json({ error: 'merge_min_2', message: 'Select at least 2 territories to merge' });
  if (claimIds.length > 50) return res.status(400).json({ error: 'merge_max_50', message: 'Cannot merge more than 50 territories at once' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Verify all claims exist, are owned by wallet, not deleted
    const claimsRes = await client.query(
      `SELECT id, owner, custom_name, total_paid, sector_code, image_url, marketplace_locked
       FROM claims WHERE id = ANY($1) AND deleted_at IS NULL`,
      [claimIds]
    );
    if (claimsRes.rows.length !== claimIds.length) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'claim_not_found', message: 'One or more territories not found' });
    }
    const notOwned = claimsRes.rows.find(c => c.owner.toLowerCase() !== wallet);
    if (notOwned) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'not_owner', message: 'You do not own all selected territories' });
    }
    const locked = claimsRes.rows.find(c => c.marketplace_locked);
    if (locked) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'claim_locked', message: 'One or more territories are marketplace-locked' });
    }

    // 2. Check for active rentals
    const rentalCheck = await client.query(
      `SELECT id FROM territory_rentals WHERE claim_id = ANY($1) AND status IN ('listed','rented') LIMIT 1`,
      [claimIds]
    ).catch(() => ({ rows: [] }));
    if (rentalCheck.rows.length) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'claim_rented', message: 'Cancel active rental listings before merging' });
    }

    // 3. Check for active battles/hijacks
    const battleCheck = await client.query(
      `SELECT id FROM fleet_battles WHERE claim_id = ANY($1) AND status NOT IN ('ended','cancelled') LIMIT 1`,
      [claimIds]
    ).catch(() => ({ rows: [] }));
    if (battleCheck.rows.length) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'claim_in_battle', message: 'Cannot merge territories currently in battle' });
    }

    // 4. Calculate bounding box from all pixels
    const pixelRes = await client.query(
      `SELECT MIN(lat) as min_lat, MAX(lat) as max_lat,
              MIN(lng) as min_lng, MAX(lng) as max_lng,
              COUNT(*) as total_pixels,
              COUNT(DISTINCT lat) as height_count,
              COUNT(DISTINCT lng) as width_count
       FROM pixels WHERE claim_id = ANY($1)`,
      [claimIds]
    );
    const bbox = pixelRes.rows[0];
    if (!bbox || !parseInt(bbox.total_pixels)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'no_pixels', message: 'Selected territories have no pixels' });
    }

    const centerLat  = (parseFloat(bbox.min_lat) + parseFloat(bbox.max_lat)) / 2;
    const centerLng  = (parseFloat(bbox.min_lng) + parseFloat(bbox.max_lng)) / 2;
    const width      = parseInt(bbox.width_count) || 1;
    const height     = parseInt(bbox.height_count) || 1;
    const totalPaid  = claimsRes.rows.reduce((s, c) => s + parseFloat(c.total_paid || 0), 0);

    // Use longest-named custom name, or first claim's name
    const baseName = claimsRes.rows
      .filter(c => c.custom_name)
      .sort((a, b) => b.custom_name.length - a.custom_name.length)[0]?.custom_name || null;

    // Use first claim's sector_code (for material purposes)
    const sectorCode = claimsRes.rows.find(c => c.sector_code)?.sector_code || null;

    // 5. Insert merged claim
    const insertRes = await client.query(
      `INSERT INTO claims (owner, center_lat, center_lng, width, height, total_paid, sector_code, custom_name, cluster_size)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id`,
      [wallet, centerLat.toFixed(2), centerLng.toFixed(2), width, height, totalPaid.toFixed(6), sectorCode, baseName, parseInt(bbox.total_pixels)]
    );
    const mergedClaimId = insertRes.rows[0].id;

    // 6. Reassign all pixels to merged claim
    await client.query(
      `UPDATE pixels SET claim_id = $1, owner = $2 WHERE claim_id = ANY($3)`,
      [mergedClaimId, wallet, claimIds]
    );

    // 7. Transfer territory upgrades to merged claim (copy highest levels)
    try {
      const upgradeColumnRes = await client.query(
        `SELECT column_name FROM information_schema.columns WHERE table_name = 'territory_upgrades'`
      );
      const upgradeColumns = new Set(upgradeColumnRes.rows.map(r => r.column_name));
      const timestampColumn = upgradeColumns.has('updated_at') ? 'updated_at'
        : upgradeColumns.has('upgraded_at') ? 'upgraded_at'
        : 'created_at';
      await client.query(
        `INSERT INTO territory_upgrades (claim_id, owner, upgrade_type, level, gp_spent, is_active, ${timestampColumn})
         SELECT $1, $3, upgrade_type, MAX(level), COALESCE(SUM(gp_spent), 0), bool_or(is_active), MAX(${timestampColumn})
         FROM territory_upgrades WHERE claim_id = ANY($2)
         GROUP BY upgrade_type
         ON CONFLICT (claim_id, upgrade_type) DO UPDATE
           SET level = GREATEST(territory_upgrades.level, EXCLUDED.level),
               gp_spent = GREATEST(territory_upgrades.gp_spent, EXCLUDED.gp_spent),
               is_active = EXCLUDED.is_active,
               ${timestampColumn} = EXCLUDED.${timestampColumn}`,
        [mergedClaimId, claimIds, wallet]
      );
    } catch (_) {}

    // 8. Soft-delete old claims
    await client.query(
      `UPDATE claims SET deleted_at = NOW() WHERE id = ANY($1)`,
      [claimIds]
    );

    await client.query('COMMIT');

    res.json({
      success: true,
      mergedClaimId,
      pixelCount: parseInt(bbox.total_pixels),
      width,
      height,
      mergedFrom: claimIds.length,
      message: `${claimIds.length}개 영토가 ID #${mergedClaimId}로 병합됐습니다`
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[TERRITORY] merge error:', err.message);
    res.status(500).json({ error: 'internal_error', message: err.message });
  } finally {
    client.release();
  }
});

// ══════════════════════════════════════════════════
// GET /api/territory/:claimId/upgrades?wallet=...
// 영토 업그레이드 현황 + 카탈로그 (소유자 전용 업그레이드 버튼)
// ══════════════════════════════════════════════════
router.get('/territory/:claimId/upgrades', readLimiter, async (req, res) => {
  const claimId = parseInt(req.params.claimId);
  const wallet = (req.query.wallet || '').toLowerCase().trim();
  if (!claimId) return res.status(400).json({ error: 'claimId required' });
  try {
    // Ownership check
    const claimRes = await pool.query(`SELECT owner FROM claims WHERE id = $1 AND deleted_at IS NULL`, [claimId]);
    if (!claimRes.rows.length) return res.status(404).json({ error: 'Claim not found' });
    const owned = wallet ? claimRes.rows[0].owner.toLowerCase() === wallet : false;

    // Current upgrades
    const current = {};
    try {
      const upgradesRes = await pool.query(
        `SELECT column_name FROM information_schema.columns WHERE table_name = 'territory_upgrades'`
      );
      const upgradeColumns = new Set(upgradesRes.rows.map(r => r.column_name));
      const timestampColumn = upgradeColumns.has('updated_at') ? 'updated_at'
        : upgradeColumns.has('upgraded_at') ? 'upgraded_at'
        : 'created_at';
      const currentUpgradesRes = await pool.query(
        `SELECT upgrade_type, level, gp_spent, created_at, ${timestampColumn} AS updated_at
           FROM territory_upgrades
          WHERE claim_id = $1 AND is_active = true
          ORDER BY upgrade_type`,
        [claimId]
      );
      for (const u of currentUpgradesRes.rows) current[u.upgrade_type] = u;
    } catch (e) {
      if (!['42P01', '42703'].includes(e.code)) throw e;
    }

    // Catalog (P5 tracks only for this endpoint)
    let catalog = [];
    if (upgradeSvc) {
      try { catalog = await upgradeSvc.getUpgradeCatalog(); } catch (_) {}
    }
    // Filter to P5 tracks
    const p5Catalog = catalog.filter(c => c.isP5);

    res.json({ claimId, owned, current, catalog: p5Catalog });
  } catch (e) {
    console.error('[TERRITORY] upgrades error:', e.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

// ══════════════════════════════════════════════════
// POST /api/territory/:claimId/upgrade
// 영토 업그레이드 실행 (소유자 전용)
// body: { wallet, upgradeType }
// ══════════════════════════════════════════════════
router.post('/territory/:claimId/upgrade', requireAuth, writeLimiter, async (req, res) => {
  const claimId = parseInt(req.params.claimId);
  const wallet = getAuthWallet(req);
  const { upgradeType } = req.body;
  if (!claimId || !wallet || !upgradeType) return res.status(400).json({ error: 'claimId, wallet, upgradeType required' });
  if (!upgradeSvc) return res.status(503).json({ error: 'Upgrade service unavailable' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await upgradeSvc.upgradeTerritory(client, wallet, claimId, upgradeType);
    await client.query('COMMIT');
    // Side effects (fire-and-forget)
    try { if (result && result.cost) { const { logGPActivity } = require('../db'); logGPActivity(wallet, -result.cost, 'territory_upgrade', { claimId, upgradeType, level: result.level }).catch(() => {}); } } catch (_) {}
    try { const _dOps = require('./dailyOps'); _dOps.notifyMissionProgress(wallet, 'territory_upgrade').catch(()=>{}); _dOps.notifyMissionProgress(wallet, 'territory_upgrade_3').catch(()=>{}); } catch(_) {}
    res.json({ ok: true, ...result });
  } catch (err) {
    await client.query('ROLLBACK');
    const code = err.message;
    const statusMap = { 'Territory not found': 404, 'You do not own this territory': 403, 'Territory upgrade system is currently disabled': 409 };
    res.status(statusMap[code] || 400).json({ error: code });
  } finally {
    client.release();
  }
});

// ══════════════════════════════════════════════════════════════════════════
// P5-5 SECTOR CONTROL
// ══════════════════════════════════════════════════════════════════════════

// GET /api/sectors/control
// 전체 섹터 컨트롤 스코어 요약 (top owners per sector)
// Control Score = pixel_area + production_power + active_harvest + guild_share
router.get('/sectors/control', readLimiter, async (req, res) => {
  try {
    // Get all sectors
    const sectorsRes = await pool.query(`
      SELECT id, name, tier FROM sectors ORDER BY tier, name
    `);
    if (!sectorsRes.rows.length) return res.json({ sectors: [] });

    // For each sector compute top owners by pixel count + recent activity
    // pixel_area = count of owned pixels in sector
    // harvest_score = recent mining transactions (last 7 days)
    // upgrade_score = sum of upgrade levels in sector
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

    // Recent harvest activity (last 7 days)
    const activityRes = await pool.query(`
      SELECT from_wallet AS wallet, COUNT(*) AS harvest_count
      FROM transactions
      WHERE type IN ('mining','instant_harvest')
        AND created_at > NOW() - INTERVAL '7 days'
      GROUP BY from_wallet
    `);
    const activityMap = {};
    activityRes.rows.forEach(r => { activityMap[r.wallet] = parseInt(r.harvest_count); });

    // Guild membership
    let guildMap = {};
    try {
      const guildRes = await pool.query(`
        SELECT wallet_address, guild_id FROM guild_members WHERE status = 'active'
      `);
      guildRes.rows.forEach(r => { guildMap[r.wallet_address] = r.guild_id; });
    } catch (_) {}

    // Aggregate per sector
    const sectorDataMap = {};
    for (const row of controlRes.rows) {
      const sId = row.sector_id;
      if (!sectorDataMap[sId]) sectorDataMap[sId] = {};
      const wallet = row.wallet.toLowerCase();
      const pixelArea = parseInt(row.pixel_area) || 0;
      const upgradeScore = parseInt(row.upgrade_levels) * 5;
      const harvestScore = (activityMap[wallet] || 0) * 3;
      const totalScore = pixelArea + upgradeScore + harvestScore;
      if (!sectorDataMap[sId][wallet]) sectorDataMap[sId][wallet] = { wallet, pixelArea: 0, upgradeScore: 0, harvestScore: 0, totalScore: 0 };
      sectorDataMap[sId][wallet].pixelArea += pixelArea;
      sectorDataMap[sId][wallet].upgradeScore += upgradeScore;
      sectorDataMap[sId][wallet].harvestScore += harvestScore;
      sectorDataMap[sId][wallet].totalScore += totalScore;
    }

    // Compute control % per sector and tier
    const INFLUENCE_TIERS = [
      { id: 'governor',    threshold: 0.75, bonus: '+20% production/defense', bonusKo: '+20% 생산/방어' },
      { id: 'dominant',    threshold: 0.50, bonus: '+12% production/defense', bonusKo: '+12% 생산/방어' },
      { id: 'stakeholder', threshold: 0.25, bonus: '+5% production',           bonusKo: '+5% 생산' },
      { id: 'presence',    threshold: 0.10, bonus: 'Sector influence list',    bonusKo: '섹터 영향력 목록' },
    ];

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

// GET /api/sectors/:sectorId/control?wallet=
// 단일 섹터 컨트롤 상세 + 내 위치 (로그인 유저)
router.get('/sectors/:sectorId/control', readLimiter, async (req, res) => {
  const sectorId = parseInt(req.params.sectorId);
  const wallet = (req.query.wallet || '').toLowerCase().trim();
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

    // Recent activity
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

    const INFLUENCE_TIERS = [
      { id: 'governor',    threshold: 0.75 },
      { id: 'dominant',    threshold: 0.50 },
      { id: 'stakeholder', threshold: 0.25 },
      { id: 'presence',    threshold: 0.10 },
    ];

    const owners = ownerRes.rows.map(r => {
      const w = r.wallet.toLowerCase();
      return {
        wallet: w,
        pixelArea: parseInt(r.pixel_area),
        upgradeScore: parseInt(r.upgrade_levels) * 5,
        harvestScore: (activityMap[w] || 0) * 3,
      };
    });
    owners.forEach(o => { o.totalScore = o.pixelArea + o.upgradeScore + o.harvestScore; });
    const totalSectorScore = owners.reduce((a, o) => a + o.totalScore, 0);
    owners.forEach(o => {
      const pct = totalSectorScore > 0 ? o.totalScore / totalSectorScore : 0;
      o.controlPct = Math.round(pct * 100);
      o.influenceTier = (INFLUENCE_TIERS.find(t => pct >= t.threshold) || {}).id || null;
    });
    owners.sort((a, b) => b.totalScore - a.totalScore);

    // My position
    let myEntry = null;
    if (wallet) {
      myEntry = owners.find(o => o.wallet === wallet) || null;
      if (!myEntry) myEntry = { wallet, pixelArea: 0, upgradeScore: 0, harvestScore: 0, totalScore: 0, controlPct: 0, influenceTier: null };
    }

    res.json({ sector, owners: owners.slice(0, 10), totalScore: totalSectorScore, myEntry });
  } catch (e) {
    console.error('[SECTOR CONTROL] sector error:', e.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

// Exploration hint and rocket priority routes live in routes/worldOpsRoutes.js.

// Shop auto-renew routes live in routes/itemEconomyRoutes.js.

// Season routes live in routes/seasonRoutes.js. Season score hooks remain inline
// in gameplay routes so existing non-blocking side effects stay close to actions.

// ══════════════════════════════════════════════════════════════
//  GUILD SYSTEM
// ══════════════════════════════════════════════════════════════

// Create guild
router.post('/guild/create', requireAuth, writeLimiter, async (req, res) => {
  const { name, tag, emoji, description } = req.body;
  const w = getAuthWallet(req);
  if (!w || !name || !tag) return res.status(400).json({ error: 'Missing wallet, name, or tag' });
  if (!guildService) return res.status(503).json({ error: 'Guild service unavailable' });
  try {
    const result = await guildService.createGuild(w, name, tag, emoji, description);
    if (result.error) return res.status(400).json(result);
    res.json(result);
    // Season tracking: gp_spend for guild creation + guild_contrib
    if (seasonService && result.success) {
      seasonService.addSeasonScore(w, 'gp_spend', 50).catch(() => {}); // big_spender
      seasonService.addSeasonScore(w, 'guild_contrib', 1).catch(() => {}); // team_player
    }
  } catch (e) {
    console.error('[GUILD] create error:', e.message);
    res.status(500).json({ error: 'Failed to create guild' });
  }
});

// Get my guild
router.get('/guild/my', readLimiter, async (req, res) => {
  const w = (req.query.wallet || '').toLowerCase();
  if (!w) return res.status(400).json({ error: 'Missing wallet' });
  if (!guildService) return res.status(503).json({ error: 'Guild service unavailable' });
  try {
    const guild = await guildService.getGuildByWallet(w);
    if (guild) {
      const lvl = parseInt(guild.level || 1);
      guild.researchSlots = await guildService.getResearchSlots(lvl);
      guild.maxMembers = await guildService.getGuildMaxMembers(guild.id);
    }
    res.json({ guild });
  } catch (e) {
    console.error('[GUILD] get-my error:', e.message);
    res.status(500).json({ error: 'Failed to get guild' });
  }
});

// Get my invites (must be before /guild/:id)
router.get('/guild/invites', readLimiter, async (req, res) => {
  const w = (req.query.wallet || '').toLowerCase();
  if (!w) return res.status(400).json({ error: 'Missing wallet' });
  if (!guildService) return res.status(503).json({ error: 'Guild service unavailable' });
  try {
    const invites = await guildService.getMyInvites(w);
    res.json({ invites });
  } catch (e) {
    console.error('[GUILD] invites error:', e.message);
    res.status(500).json({ error: 'Failed to get invites' });
  }
});

// Guild leaderboard (must be before /guild/:id)
router.get('/guild/leaderboard', readLimiter, async (req, res) => {
  if (!guildService) return res.status(503).json({ error: 'Guild service unavailable' });
  try {
    const guilds = await guildService.getGuildLeaderboard(parseInt(req.query.limit) || 20);
    res.json({ guilds });
  } catch (e) {
    console.error('[GUILD] leaderboard error:', e.message);
    res.status(500).json({ error: 'Failed to get leaderboard' });
  }
});

// Search guilds by id / tag / name (used by the join screen)
router.get('/guild/search', readLimiter, async (req, res) => {
  if (!guildService) return res.status(503).json({ error: 'Guild service unavailable' });
  try {
    const q = (req.query.q || '').toString().slice(0, 64);
    if (!q.trim()) return res.json({ guilds: [] });
    const guilds = await guildService.searchGuilds(q, parseInt(req.query.limit) || 20);
    res.json({ guilds });
  } catch (e) {
    console.error('[GUILD] search error:', e.message);
    res.status(500).json({ error: 'Failed to search guilds' });
  }
});

// Get guild by ID
router.get('/guild/:id', readLimiter, async (req, res, next) => {
  // Static sub-routes registered later must not be shadow-matched by :id
  if (req.params.id === 'research-bonuses') return next();
  if (!guildService) return res.status(503).json({ error: 'Guild service unavailable' });
  try {
    const guild = await guildService.getGuild(parseInt(req.params.id));
    if (!guild) return res.status(404).json({ error: 'Guild not found' });
    res.json({ guild });
  } catch (e) {
    console.error('[GUILD] get error:', e.message);
    res.status(500).json({ error: 'Failed to get guild' });
  }
});

// Invite member — accepts either wallet address (0x…) or nickname.
// If the input doesn't look like a wallet we resolve it via the users table.
router.post('/guild/invite', requireAuth, writeLimiter, async (req, res) => {
  const { targetWallet, guildId } = req.body;
  const w = getAuthWallet(req);
  let target = (targetWallet || '').trim();
  if (!w || !target || !guildId) return res.status(400).json({ error: 'Missing fields' });
  if (!guildService) return res.status(503).json({ error: 'Guild service unavailable' });
  try {
    // Resolve nickname → wallet if the input doesn't look like a 0x address.
    const looksLikeWallet = /^0x[0-9a-fA-F]{40}$/.test(target);
    if (!looksLikeWallet) {
      const nickRow = await pool.query(
        'SELECT wallet_address FROM users WHERE LOWER(nickname) = LOWER($1) LIMIT 1',
        [target]
      );
      if (!nickRow.rows.length) {
        return res.status(400).json({ error: 'No user with that nickname' });
      }
      target = nickRow.rows[0].wallet_address;
    }
    const tw = target.toLowerCase();
    const result = await guildService.inviteMember(w, tw, parseInt(guildId));
    if (result.error) return res.status(400).json(result);
    res.json(result);
  } catch (e) {
    console.error('[GUILD] invite error:', e.message);
    res.status(500).json({ error: 'Failed to invite' });
  }
});

// Accept invite
router.post('/guild/invite/accept', requireAuth, writeLimiter, async (req, res) => {
  const { inviteId } = req.body;
  const w = getAuthWallet(req);
  if (!w || !inviteId) return res.status(400).json({ error: 'Missing fields' });
  if (!guildService) return res.status(503).json({ error: 'Guild service unavailable' });
  try {
    const result = await guildService.acceptInvite(w, parseInt(inviteId));
    if (result.error) return res.status(400).json(result);
    res.json(result);
    // Season tracking: guild contribution (non-blocking)
    if (seasonService && !result.error) { seasonService.addSeasonScore(w, 'guild_contrib', 1).catch(() => {}); }
  } catch (e) {
    console.error('[GUILD] accept error:', e.message);
    res.status(500).json({ error: 'Failed to accept invite' });
  }
});

// ── Join requests (player → guild, approval by leader/officer) ──
router.post('/guild/join-request', requireAuth, writeLimiter, async (req, res) => {
  const { guildId } = req.body;
  const w = getAuthWallet(req);
  if (!w || !guildId) return res.status(400).json({ error: 'Missing fields' });
  if (!guildService) return res.status(503).json({ error: 'Guild service unavailable' });
  try {
    const result = await guildService.createJoinRequest(w, parseInt(guildId));
    if (result.error) return res.status(400).json(result);
    res.json(result);
  } catch (e) {
    console.error('[GUILD] join-request error:', e.message);
    res.status(500).json({ error: 'Failed to send request' });
  }
});

router.get('/guild/:id/requests', readLimiter, async (req, res) => {
  if (!guildService) return res.status(503).json({ error: 'Guild service unavailable' });
  const w = (req.query.wallet || '').toLowerCase();
  if (!w) return res.status(400).json({ error: 'Missing wallet' });
  try {
    const requests = await guildService.getGuildJoinRequests(w, parseInt(req.params.id));
    res.json({ requests });
  } catch (e) {
    console.error('[GUILD] get-requests error:', e.message);
    res.status(500).json({ error: 'Failed to load requests' });
  }
});

// Search free users (not in any guild) by nickname or wallet, for invite UI.
// Caller must be leader/officer of the guild.
router.get('/guild/:id/search-users', readLimiter, async (req, res) => {
  if (!guildService) return res.status(503).json({ error: 'Guild service unavailable' });
  const w = (req.query.wallet || '').toLowerCase();
  const q = req.query.q || '';
  if (!w) return res.status(400).json({ error: 'Missing wallet' });
  try {
    const users = await guildService.searchUsersForInvite(
      w, parseInt(req.params.id), q, parseInt(req.query.limit) || 15
    );
    res.json({ users });
  } catch (e) {
    console.error('[GUILD] search-users error:', e.message);
    res.status(500).json({ error: 'Failed to search users' });
  }
});

router.post('/guild/request/approve', requireAuth, writeLimiter, async (req, res) => {
  const { inviteId } = req.body;
  const w = getAuthWallet(req);
  if (!w || !inviteId) return res.status(400).json({ error: 'Missing fields' });
  if (!guildService) return res.status(503).json({ error: 'Guild service unavailable' });
  try {
    const result = await guildService.approveJoinRequest(w, parseInt(inviteId));
    if (result.error) return res.status(400).json(result);
    res.json(result);
  } catch (e) {
    console.error('[GUILD] approve-request error:', e.message);
    res.status(500).json({ error: 'Failed to approve request' });
  }
});

router.post('/guild/request/reject', requireAuth, writeLimiter, async (req, res) => {
  const { inviteId } = req.body;
  const w = getAuthWallet(req);
  if (!w || !inviteId) return res.status(400).json({ error: 'Missing fields' });
  if (!guildService) return res.status(503).json({ error: 'Guild service unavailable' });
  try {
    const result = await guildService.rejectJoinRequest(w, parseInt(inviteId));
    if (result.error) return res.status(400).json(result);
    res.json(result);
  } catch (e) {
    console.error('[GUILD] reject-request error:', e.message);
    res.status(500).json({ error: 'Failed to reject request' });
  }
});

// Decline invite
router.post('/guild/invite/decline', requireAuth, writeLimiter, async (req, res) => {
  const { inviteId } = req.body;
  const w = getAuthWallet(req);
  if (!w || !inviteId) return res.status(400).json({ error: 'Missing fields' });
  if (!guildService) return res.status(503).json({ error: 'Guild service unavailable' });
  try {
    const result = await guildService.declineInvite(w, parseInt(inviteId));
    if (result.error) return res.status(400).json(result);
    res.json(result);
  } catch (e) {
    console.error('[GUILD] decline error:', e.message);
    res.status(500).json({ error: 'Failed to decline invite' });
  }
});

// Leave guild
router.post('/guild/leave', requireAuth, writeLimiter, async (req, res) => {
  const w = getAuthWallet(req);
  if (!w) return res.status(400).json({ error: 'Missing wallet' });
  if (!guildService) return res.status(503).json({ error: 'Guild service unavailable' });
  try {
    const result = await guildService.leaveGuild(w);
    if (result.error) return res.status(400).json(result);
    res.json(result);
  } catch (e) {
    console.error('[GUILD] leave error:', e.message);
    res.status(500).json({ error: 'Failed to leave guild' });
  }
});

// [v7.355] 길드 변절(배신) — 금고 탈취 + 제명 + 배신자 낙인 + 자동 현상금 + 재가입 쿨다운
router.post('/guild/defect', requireAuth, writeLimiter, async (req, res) => {
  const w = getAuthWallet(req);
  if (!w) return res.status(400).json({ error: 'Missing wallet' });
  if (!guildService || !guildService.defectFromGuild) return res.status(503).json({ error: 'Guild service unavailable' });
  try {
    const result = await guildService.defectFromGuild(w);
    if (result.error) return res.status(400).json(result);
    res.json(result);
  } catch (e) {
    console.error('[GUILD] defect error:', e.message);
    res.status(500).json({ error: 'Failed to defect' });
  }
});

// [v7.361] 배신자 낙인 유료 제거(속죄) — GP 소각으로 평판 회복
router.post('/guild/redeem-betrayal', requireAuth, writeLimiter, async (req, res) => {
  const w = getAuthWallet(req);
  if (!w) return res.status(400).json({ error: 'Missing wallet' });
  if (!guildService || !guildService.redeemBetrayalMark) return res.status(503).json({ error: 'Guild service unavailable' });
  try {
    const result = await guildService.redeemBetrayalMark(w);
    if (result.error) return res.status(400).json(result);
    res.json(result);
  } catch (e) {
    console.error('[GUILD] redeem error:', e.message);
    res.status(500).json({ error: 'Failed to redeem' });
  }
});

// Kick member
router.post('/guild/kick', requireAuth, writeLimiter, async (req, res) => {
  const { targetWallet, guildId } = req.body;
  const w = getAuthWallet(req);
  const tw = (targetWallet || '').toLowerCase();
  if (!w || !tw || !guildId) return res.status(400).json({ error: 'Missing fields' });
  if (!guildService) return res.status(503).json({ error: 'Guild service unavailable' });
  try {
    const result = await guildService.kickMember(w, tw, parseInt(guildId));
    if (result.error) return res.status(400).json(result);
    res.json(result);
  } catch (e) {
    console.error('[GUILD] kick error:', e.message);
    res.status(500).json({ error: 'Failed to kick member' });
  }
});

// Promote to officer
router.post('/guild/promote', requireAuth, writeLimiter, async (req, res) => {
  const { targetWallet, guildId } = req.body;
  const w = getAuthWallet(req);
  const tw = (targetWallet || '').toLowerCase();
  if (!w || !tw || !guildId) return res.status(400).json({ error: 'Missing fields' });
  if (!guildService) return res.status(503).json({ error: 'Guild service unavailable' });
  try {
    const result = await guildService.promoteToOfficer(w, tw, parseInt(guildId));
    if (result.error) return res.status(400).json(result);
    res.json(result);
  } catch (e) {
    console.error('[GUILD] promote error:', e.message);
    res.status(500).json({ error: 'Failed to promote' });
  }
});

// Demote to member
router.post('/guild/demote', requireAuth, writeLimiter, async (req, res) => {
  const { targetWallet, guildId } = req.body;
  const w = getAuthWallet(req);
  const tw = (targetWallet || '').toLowerCase();
  if (!w || !tw || !guildId) return res.status(400).json({ error: 'Missing fields' });
  if (!guildService) return res.status(503).json({ error: 'Guild service unavailable' });
  try {
    const result = await guildService.demoteToMember(w, tw, parseInt(guildId));
    if (result.error) return res.status(400).json(result);
    res.json(result);
  } catch (e) {
    console.error('[GUILD] demote error:', e.message);
    res.status(500).json({ error: 'Failed to demote' });
  }
});

// Transfer leadership
router.post('/guild/transfer', requireAuth, writeLimiter, async (req, res) => {
  const { targetWallet, guildId } = req.body;
  const w = getAuthWallet(req);
  const tw = (targetWallet || '').toLowerCase();
  if (!w || !tw || !guildId) return res.status(400).json({ error: 'Missing fields' });
  if (!guildService) return res.status(503).json({ error: 'Guild service unavailable' });
  try {
    const result = await guildService.transferLeadership(w, tw, parseInt(guildId));
    if (result.error) return res.status(400).json(result);
    res.json(result);
  } catch (e) {
    console.error('[GUILD] transfer error:', e.message);
    res.status(500).json({ error: 'Failed to transfer' });
  }
});

// Disband guild
// Update guild info (leader-only, charges GP per changed field)
router.post('/guild/update', requireAuth, writeLimiter, async (req, res) => {
  const { guildId, name, description, emblemEmoji, emblemImage } = req.body || {};
  const w = getAuthWallet(req);
  if (!w || !guildId) return res.status(400).json({ error: 'Missing fields' });
  if (!guildService) return res.status(503).json({ error: 'Guild service unavailable' });
  // Build fields dict (only include keys that were actually sent)
  const fields = {};
  if (typeof name === 'string')          fields.name = name;
  if (typeof description === 'string')   fields.description = description;
  if (typeof emblemEmoji === 'string')   fields.emblemEmoji = emblemEmoji;
  if (emblemImage !== undefined)         fields.emblemImage = emblemImage; // may be null to clear
  try {
    const result = await guildService.updateGuildInfo(w, parseInt(guildId), fields);
    if (result.error) return res.status(400).json(result);
    res.json(result);
  } catch (e) {
    console.error('[GUILD] update error:', e.message);
    res.status(500).json({ error: 'Failed to update guild' });
  }
});

router.post('/guild/disband', requireAuth, writeLimiter, async (req, res) => {
  const { guildId } = req.body;
  const w = getAuthWallet(req);
  if (!w || !guildId) return res.status(400).json({ error: 'Missing fields' });
  if (!guildService) return res.status(503).json({ error: 'Guild service unavailable' });
  try {
    const result = await guildService.disbandGuild(w, parseInt(guildId));
    if (result.error) return res.status(400).json(result);
    res.json(result);
  } catch (e) {
    console.error('[GUILD] disband error:', e.message);
    res.status(500).json({ error: 'Failed to disband' });
  }
});

// [Phase A] 길드 금고 인출 — 리더/오피서만, 섹터 세수 회수 경로
router.post('/guild/treasury/withdraw', requireAuth, writeLimiter, async (req, res) => {
  const { guildId, amount } = req.body;
  const w = getAuthWallet(req);
  if (!w || !guildId || !amount) return res.status(400).json({ error: 'Missing fields' });
  if (!guildService || !guildService.withdrawTreasury) return res.status(503).json({ error: 'Guild service unavailable' });
  try {
    const result = await guildService.withdrawTreasury(w, parseInt(guildId), amount);
    if (result.error) return res.status(400).json(result);
    res.json(result);
  } catch (e) {
    console.error('[GUILD] treasury withdraw error:', e.message);
    res.status(500).json({ error: 'Failed to withdraw' });
  }
});

// ══════════════════════════════════════════════════
//  GUILD CHAT — polling based
// ══════════════════════════════════════════════════
router.post('/guild/chat', requireAuth, writeLimiter, async (req, res) => {
  const { guildId, message } = req.body || {};
  const w = getAuthWallet(req);
  if (!w || !guildId) return res.status(400).json({ error: 'Missing fields' });
  if (!guildService) return res.status(503).json({ error: 'Guild service unavailable' });
  try {
    const result = await guildService.sendGuildMessage(w, parseInt(guildId), message);
    if (result.error) return res.status(400).json(result);
    res.json(result);
  } catch (e) {
    console.error('[GUILD] chat send error:', e.message);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

router.get('/guild/chat/:guildId', readLimiter, async (req, res) => {
  const { wallet, sinceId } = req.query;
  const w = (wallet || '').toLowerCase();
  const guildId = parseInt(req.params.guildId);
  if (!w || !guildId) return res.status(400).json({ error: 'Missing fields' });
  if (!guildService) return res.status(503).json({ error: 'Guild service unavailable' });
  try {
    const result = await guildService.getGuildMessages(w, guildId, sinceId);
    if (result.error) return res.status(400).json(result);
    res.json(result);
  } catch (e) {
    console.error('[GUILD] chat read error:', e.message);
    res.status(500).json({ error: 'Failed to load messages' });
  }
});

// ══════════════════════════════════════════════════
//  GUILD UPGRADES — treasury contribution, level up, research
// ══════════════════════════════════════════════════

// Set the caller's harvest contribution percentage (0-30)
router.post('/guild/contribution', requireAuth, writeLimiter, async (req, res) => {
  const { pct } = req.body || {};
  const w = getAuthWallet(req);
  if (!w || pct === undefined) return res.status(400).json({ error: 'Missing fields' });
  if (!guildService) return res.status(503).json({ error: 'Guild service unavailable' });
  try {
    const result = await guildService.setContributionPct(w, parseInt(pct));
    if (result.error) return res.status(400).json(result);
    res.json(result);
  } catch (e) {
    console.error('[GUILD] contrib-pct error:', e.message);
    res.status(500).json({ error: 'Failed to set contribution' });
  }
});

// Trigger a guild level-up (consumes treasury)
router.post('/guild/levelup', requireAuth, writeLimiter, async (req, res) => {
  const { guildId } = req.body || {};
  const w = getAuthWallet(req);
  if (!w || !guildId) return res.status(400).json({ error: 'Missing fields' });
  if (!guildService) return res.status(503).json({ error: 'Guild service unavailable' });
  try {
    const result = await guildService.upgradeGuildLevel(w, parseInt(guildId));
    if (result.error) return res.status(400).json(result);
    res.json(result);
  } catch (e) {
    console.error('[GUILD] levelup error:', e.message);
    res.status(500).json({ error: 'Failed to level up' });
  }
});

// Unlock a research perk (consumes treasury)
// ── Guild GP Donation ──
router.post('/guild/donate', requireAuth, writeLimiter, async (req, res) => {
  const { guildId, amount } = req.body || {};
  const w = getAuthWallet(req);
  const amt = parseInt(amount);
  if (!w || !guildId || !amt || amt <= 0) return res.status(400).json({ error: 'Missing fields' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Verify user is member
    const mem = await client.query('SELECT guild_id FROM guild_members WHERE wallet=$1 AND guild_id=$2', [w, guildId]);
    if (!mem.rows.length) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'Not a guild member' }); }
    // Check balance
    const usr = await client.query('SELECT gp_balance FROM users WHERE wallet_address=$1 FOR UPDATE', [w]);
    if (!usr.rows.length || parseInt(usr.rows[0].gp_balance) < amt) {
      await client.query('ROLLBACK'); return res.status(400).json({ error: 'Insufficient GP' });
    }
    // Deduct from user
    const guildDonateDeduct = await client.query(
      'UPDATE users SET gp_balance = gp_balance - $1 WHERE LOWER(wallet_address)=LOWER($2) AND gp_balance >= $1',
      [amt, w]
    );
    if (guildDonateDeduct.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'INSUFFICIENT_GP' });
    }
    // Credit guild treasury
    const tRes = await client.query('UPDATE guilds SET gp_treasury = COALESCE(gp_treasury,0) + $1 WHERE id=$2 RETURNING gp_treasury', [amt, guildId]);
    const newTreasury = parseFloat(tRes.rows[0]?.gp_treasury || 0);
    // Ledger
    try {
      await client.query(
        `INSERT INTO guild_treasury_ledger (guild_id, wallet, kind, delta_pp, delta_gp, balance_after, memo) VALUES ($1, $2, 'donate', 0, $3, $4, $5)`,
        [guildId, w, amt, newTreasury, `GP donation: ${amt} GP`]
      );
    } catch (_e) { /* ledger table may not exist */ }
    await client.query('COMMIT');
    const bal = await pool.query('SELECT gp_balance FROM users WHERE wallet_address=$1', [w]);
    res.json({ ok: true, gpBalance: parseInt(bal.rows[0]?.gp_balance || 0) });
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    res.status(500).json({ error: e.message });
  } finally { client.release(); }
});

router.post('/guild/research', requireAuth, writeLimiter, async (req, res) => {
  const { guildId, key } = req.body || {};
  const w = getAuthWallet(req);
  if (!w || !guildId || !key) return res.status(400).json({ error: 'Missing fields' });
  if (!guildService) return res.status(503).json({ error: 'Guild service unavailable' });
  try {
    const result = await guildService.unlockResearch(w, parseInt(guildId), key);
    if (result.error) return res.status(400).json(result);
    res.json(result);
  } catch (e) {
    console.error('[GUILD] research error:', e.message);
    res.status(500).json({ error: 'Failed to unlock research' });
  }
});

// Treasury ledger (recent transactions)
router.get('/guild/:id/ledger', readLimiter, async (req, res) => {
  if (!guildService) return res.status(503).json({ error: 'Guild service unavailable' });
  try {
    const entries = await guildService.getTreasuryLedger(
      parseInt(req.params.id),
      parseInt(req.query.limit) || 50
    );
    res.json({ entries });
  } catch (e) {
    console.error('[GUILD] ledger error:', e.message);
    res.status(500).json({ error: 'Failed to load ledger' });
  }
});

// ═══════════════════════════════════════
//  GUILD WARS
// ═══════════════════════════════════════

router.post('/guild/war/declare', requireAuth, writeLimiter, async (req, res) => {
  const { guildId, targetGuildId, stakeGp, sectorId, durationHours } = req.body || {};
  const w = getAuthWallet(req);
  if (!w || !guildId || !targetGuildId) return res.status(400).json({ error: 'Missing fields' });
  if (!guildService) return res.status(503).json({ error: 'Guild service unavailable' });
  try {
    const opts = {};
    if (stakeGp != null && stakeGp !== '') opts.stakeGp = parseInt(stakeGp);
    if (sectorId != null && sectorId !== '') opts.sectorId = parseInt(sectorId);
    if (durationHours != null && durationHours !== '') opts.durationHours = parseInt(durationHours);
    const r = await guildService.declareWar(w, parseInt(guildId), parseInt(targetGuildId), opts);
    if (r.error) return res.status(400).json(r);
    res.json(r);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// 진행 중인 길드전 기준으로 적 길드 멤버 목록 반환 (함대전 선포 대상용)
router.get('/guild/war/enemies', readLimiter, async (req, res) => {
  const guildId = parseInt(req.query.guildId);
  const warId   = parseInt(req.query.warId);
  if (!guildId || !warId) return res.status(400).json({ error: 'guildId and warId required' });
  try {
    const { rows: war } = await pool.query(
      `SELECT attacker_guild_id, defender_guild_id FROM guild_wars WHERE id=$1 AND status='active'`, [warId]
    );
    if (!war.length) return res.status(404).json({ error: 'War not found or not active' });
    const enemyGuildId = war[0].attacker_guild_id === guildId ? war[0].defender_guild_id : war[0].attacker_guild_id;
    const { rows } = await pool.query(`
      SELECT gm.wallet, u.nickname, u.rank_level,
             (SELECT COUNT(*) FROM fleets f WHERE f.owner_wallet=gm.wallet AND f.is_in_battle=false AND f.ships_alive>0) AS ready_fleets
      FROM guild_members gm
      JOIN users u ON u.wallet_address = gm.wallet
      WHERE gm.guild_id = $1
    `, [enemyGuildId]);
    res.json({ enemies: rows, enemy_guild_id: enemyGuildId });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// 적 함대가 없을 때 자동 승리 포인트 획득 (1회/24h/전쟁)
router.post('/guild/war/auto-win', requireAuth, writeLimiter, async (req, res) => {
  const wallet  = getAuthWallet(req);
  const warId   = parseInt(req.body.war_id);
  const guildId = parseInt(req.body.guild_id);
  if (!wallet || !warId || !guildId) return res.status(400).json({ error: 'wallet, war_id, guild_id required' });

  // ✅ [v7.42] TOCTOU fix: wrap cooldown-check + INSERT in a single transaction,
  //    locking the guild_wars row to serialize concurrent auto-win requests.
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 전쟁 유효성 검사 + 행 잠금 (race condition 방지)
    const { rows: war } = await client.query(
      `SELECT attacker_guild_id, defender_guild_id FROM guild_wars WHERE id=$1 AND status='active' FOR UPDATE`,
      [warId]
    );
    if (!war.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'War not found or not active' });
    }
    const w = war[0];
    if (w.attacker_guild_id !== guildId && w.defender_guild_id !== guildId) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Not in this war' });
    }

    // 멤버 검증
    const { rows: mem } = await client.query(
      `SELECT 1 FROM guild_members WHERE wallet=$1 AND guild_id=$2`, [wallet, guildId]
    );
    if (!mem.length) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Not a member of this guild' });
    }

    // 적 길드에 준비된 함대가 없는지 재확인
    const enemyGuildId = w.attacker_guild_id === guildId ? w.defender_guild_id : w.attacker_guild_id;
    const { rows: ef } = await client.query(`
      SELECT COUNT(*) FROM fleets f
      JOIN guild_members gm ON gm.wallet = f.owner_wallet
      WHERE gm.guild_id=$1 AND f.is_in_battle=false AND f.ships_alive>0
    `, [enemyGuildId]);
    if (parseInt(ef[0].count) > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'ENEMY_HAS_FLEETS' });
    }

    // 24h 쿨다운 — now inside transaction (serialized by guild_wars FOR UPDATE)
    const { rows: recent } = await client.query(`
      SELECT 1 FROM guild_war_actions
      WHERE war_id=$1 AND wallet=$2 AND action_type='fleet_battle_auto_win'
        AND created_at > NOW() - INTERVAL '24 hours'
    `, [warId, wallet]);
    if (recent.length) {
      await client.query('ROLLBACK');
      return res.status(429).json({ error: 'AUTO_WIN_COOLDOWN' });
    }

    // 포인트 지급 (INSERT + score UPDATE inside same transaction)
    const { getSetting } = require('../db');
    const points = parseInt(await getSetting('guild_war_points_ship_battle', '10')) || 10;
    const scoreCol = w.attacker_guild_id === guildId ? 'attacker_score' : 'defender_score';

    await client.query(
      `INSERT INTO guild_war_actions (war_id, guild_id, wallet, action_type, points, meta)
       VALUES ($1, $2, $3, 'fleet_battle_auto_win', $4, $5)`,
      [warId, guildId, wallet, points, JSON.stringify({ auto: true })]
    );
    await client.query(
      `UPDATE guild_wars SET ${scoreCol} = ${scoreCol} + $1 WHERE id = $2`,
      [points, warId]
    );

    await client.query('COMMIT');
    res.json({ success: true, points });
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('[guild/war/auto-win]', e.message);
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
});

router.get('/guild/war/active', readLimiter, async (req, res) => {
  const guildId = parseInt(req.query.guildId);
  if (!guildId) return res.status(400).json({ error: 'Missing guildId' });
  if (!guildService) return res.status(503).json({ error: 'Guild service unavailable' });
  try {
    const wars = await guildService.getActiveWars(guildId);
    res.json({ wars });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/guild/war/history', readLimiter, async (req, res) => {
  const guildId = parseInt(req.query.guildId);
  if (!guildId) return res.status(400).json({ error: 'Missing guildId' });
  if (!guildService) return res.status(503).json({ error: 'Guild service unavailable' });
  try {
    const wars = await guildService.getWarHistory(guildId);
    res.json({ wars });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/guild/war/:id/leaderboard', readLimiter, async (req, res) => {
  if (!guildService) return res.status(503).json({ error: 'Guild service unavailable' });
  try {
    const lb = await guildService.getWarLeaderboard(parseInt(req.params.id));
    res.json({ leaderboard: lb });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════════════════════
//  GUILD RESEARCH BONUSES (public query)
// ═══════════════════════════════════════

router.get('/guild/research-bonuses', readLimiter, async (req, res) => {
  const w = (req.query.wallet || '').toLowerCase();
  if (!w) return res.status(400).json({ error: 'Missing wallet' });
  if (!guildService) return res.json({ bonuses: {} });
  try {
    const bonuses = await guildService.getResearchBonuses(w);
    res.json({ bonuses });
  } catch (e) { res.json({ bonuses: {} }); }
});

// Season pass routes live in routes/seasonRoutes.js.

// ═══════════════════════════════════════
//  GUILD WAR MINIGAMES
// ═══════════════════════════════════════

router.post('/guild/war/score', requireAuth, writeLimiter, async (req, res) => {
  const { warId, gameType, score } = req.body || {};
  const w = getAuthWallet(req);
  if (!w || !warId || !gameType || !score) return res.status(400).json({ error: 'Missing fields (wallet, warId, gameType, score)' });
  if (!guildService) return res.status(503).json({ error: 'Guild service unavailable' });
  try {
    const r = await guildService.submitGameScore(w, parseInt(warId), gameType, score);
    if (r.error) return res.status(400).json(r);
    res.json(r);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/guild/war/:id/scores', readLimiter, async (req, res) => {
  if (!guildService) return res.status(503).json({ error: 'Guild service unavailable' });
  try {
    const r = await guildService.getWarScoreboard(parseInt(req.params.id));
    if (r.error) return res.status(400).json(r);
    res.json(r);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PP → GP exchange routes live in routes/exchangeRoutes.js.

// ═══════════════════════════════════════
//  GUILD WAR CONTINUE (pay GP/PP to continue minigame)
// ═══════════════════════════════════════

router.post('/guild/war/continue', requireAuth, writeLimiter, async (req, res) => {
  const { warId, continueNum } = req.body || {};
  const w = getAuthWallet(req);
  if (!w || !warId || !continueNum) return res.status(400).json({ error: 'Missing fields' });

  const num = parseInt(continueNum);
  if (num < 1 || num > 10) return res.status(400).json({ error: 'Invalid continue number' });

  const client = await pool.connect();
  try {
    const maxContinues = parseInt(await getSetting('guild_war_continue_max') || '10');
    if (num > maxContinues) return res.status(400).json({ error: 'Max continues reached' });

    // Determine cost
    let costType, costAmount;
    const gpCostsStr = await getSetting('guild_war_continue_gp_costs') || '[5,15,30]';
    const gpCosts = JSON.parse(gpCostsStr);

    if (num <= gpCosts.length) {
      costType = 'gp';
      costAmount = gpCosts[num - 1];
    } else {
      costType = 'pp';
      const ppBase = parseFloat(await getSetting('guild_war_continue_pp_base') || '0.1');
      const ppMult = parseFloat(await getSetting('guild_war_continue_pp_multiplier') || '2');
      costAmount = ppBase * Math.pow(ppMult, num - gpCosts.length - 1);
    }

    await client.query('BEGIN');

    // Check balance and deduct
    const { rows: [user] } = await client.query('SELECT pp_balance, gp_balance FROM users WHERE wallet_address=$1 FOR UPDATE', [w]);
    if (!user) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'User not found' }); }

    if (costType === 'gp') {
      if (parseFloat(user.gp_balance) < costAmount) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: `Insufficient GP (need ${costAmount})` });
      }
      const deductGuildWarGp = await client.query('UPDATE users SET gp_balance = gp_balance - $1 WHERE LOWER(wallet_address)=LOWER($2) AND gp_balance >= $1', [costAmount, w]);
      if (deductGuildWarGp.rowCount === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Insufficient balance (concurrent modification)' });
      }
    } else {
      if (parseFloat(user.pp_balance) < costAmount) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: `Insufficient PP (need ${costAmount.toFixed(2)})` });
      }
      const deductGuildWarPp = await client.query('UPDATE users SET pp_balance = pp_balance - $1 WHERE LOWER(wallet_address)=LOWER($2) AND pp_balance >= $1', [costAmount, w]);
      if (deductGuildWarPp.rowCount === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Insufficient balance (concurrent modification)' });
      }
    }

    // Log
    await client.query(
      `INSERT INTO transactions (from_wallet, type, pp_amount, meta) VALUES ($1, 'war_game_continue', $2, $3)`,
      [w, costAmount, JSON.stringify({ war_id: warId, continue_num: num, cost_type: costType, cost_amount: costAmount })]
    );

    await client.query('COMMIT');

    // Calculate next continue cost
    let nextCostType, nextCostAmount;
    if (num + 1 <= gpCosts.length) {
      nextCostType = 'gp'; nextCostAmount = gpCosts[num];
    } else {
      nextCostType = 'pp';
      const ppBase = parseFloat(await getSetting('guild_war_continue_pp_base') || '0.1');
      const ppMult = parseFloat(await getSetting('guild_war_continue_pp_multiplier') || '2');
      nextCostAmount = ppBase * Math.pow(ppMult, num - gpCosts.length);
    }

    const { rows: [newBal] } = await client.query('SELECT pp_balance, gp_balance FROM users WHERE wallet_address=$1', [w]);

    res.json({
      ok: true,
      paid: { type: costType, amount: costAmount },
      nextContinue: num + 1 <= maxContinues ? { type: nextCostType, amount: nextCostAmount } : null,
      ppBalance: parseFloat(newBal.pp_balance),
      gpBalance: parseFloat(newBal.gp_balance)
    });
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
});

// Get continue cost info
router.get('/guild/war/continue-cost', readLimiter, async (req, res) => {
  try {
    const gpCosts = JSON.parse(await getSetting('guild_war_continue_gp_costs') || '[5,15,30]');
    const ppBase = parseFloat(await getSetting('guild_war_continue_pp_base') || '0.1');
    const ppMult = parseFloat(await getSetting('guild_war_continue_pp_multiplier') || '2');
    const maxContinues = parseInt(await getSetting('guild_war_continue_max') || '10');
    res.json({ gpCosts, ppBase, ppMult, maxContinues });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Protection scroll routes live in routes/itemEconomyRoutes.js.

// User title and hall-of-fame routes live in routes/titleRoutes.js.

// ── GET /api/for-sale-territories ──
// Returns territories currently listed on marketplace or in active auction
// Used by frontend to draw FOR SALE / AUCTION map overlays
router.get('/for-sale-territories', readLimiter, async (req, res) => {
  try {
    const rows = [];
    // Marketplace listings (active, claim type)
    try {
      const mkt = await pool.query(
        `SELECT c.id AS claim_id, c.owner, c.center_lat AS lat, c.center_lng AS lng,
                c.width, c.height, ml.price, ml.currency, 'marketplace' AS sale_type,
                ml.expires_at AS ends_at, ml.id AS listing_id,
                u.nickname AS seller_nick
         FROM claims c
         JOIN marketplace_listings ml ON ml.claim_id = c.id AND ml.status = 'active'
         LEFT JOIN users u ON u.wallet_address = c.owner
         WHERE c.deleted_at IS NULL`
      );
      rows.push(...mkt.rows);
    } catch (_e) { /* marketplace_listings may not exist */ }

    // Auction listings (active, claim type)
    try {
      const auc = await pool.query(
        `SELECT c.id AS claim_id, c.owner, c.center_lat AS lat, c.center_lng AS lng,
                c.width, c.height,
                COALESCE(a.current_price, a.start_price) AS price,
                a.currency, 'auction' AS sale_type, a.ends_at,
                a.id AS auction_id,
                u.nickname AS seller_nick
         FROM claims c
         JOIN auctions a ON a.claim_id = c.id AND a.status = 'active'
         LEFT JOIN users u ON u.wallet_address = c.owner
         WHERE c.deleted_at IS NULL`
      );
      rows.push(...auc.rows);
    } catch (_e) { /* auctions may not exist */ }

    res.json(rows);
  } catch (e) {
    console.error('[ForSale] territories error:', e.message);
    res.status(500).json({ error: 'internal_error' });
  }
});

// Player notification and away briefing routes live in routes/notificationRoutes.js.

// ═══════════════════════════════════════════════════════
// GP ACTIVITY LOG (Migration 097)
// ═══════════════════════════════════════════════════════

// GET /api/gp/activity — fetch GP activity log for current user
router.get('/gp/activity', readLimiter, async (req, res) => {
  const wallet = (req.headers['x-wallet'] || req.query.wallet || '').toLowerCase().trim();
  if (!wallet || wallet.length < 10) return res.status(400).json({ error: 'wallet_required' });
  try {
    const limit = Math.min(parseInt(req.query.limit || '20'), 50);
    const rows = await pool.query(
      `SELECT id, delta, source, note, created_at
       FROM gp_activity_log
       WHERE wallet = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [wallet, limit]
    );
    res.json({ entries: rows.rows });
  } catch (err) {
    res.status(500).json({ error: 'internal_error' });
  }
});

// GET /api/user/my-territories?wallet= — user's claim list for marketplace sell view (Migration 101)
router.get('/user/my-territories', readLimiter, async (req, res) => {
  const wallet = (req.headers['x-wallet'] || req.query.wallet || '').toLowerCase().trim();
  if (!wallet || wallet.length < 10) return res.status(400).json({ error: 'wallet_required' });
  try {
    const enabled = await pool.query("SELECT value FROM settings WHERE key='territory_sell_enabled'");
    if (enabled.rows[0]?.value === 'false') return res.json({ territories: [], disabled: true });

    const result = await pool.query(
      `SELECT c.id, c.center_lat, c.center_lng, c.width, c.height,
              c.image_url, c.link_url, c.marketplace_locked,
              c.total_paid,
              COUNT(p.lat) AS pixel_count,
              u.nickname AS owner_nick
         FROM claims c
         LEFT JOIN pixels p ON p.claim_id = c.id
         LEFT JOIN users  u ON u.wallet_address = c.owner
        WHERE c.owner = $1 AND c.deleted_at IS NULL
        GROUP BY c.id, u.nickname
        ORDER BY c.created_at DESC
        LIMIT 50`,
      [wallet]
    );
    res.json({ territories: result.rows });
  } catch (err) {
    console.error('[API] my-territories error:', err.message);
    res.status(500).json({ error: 'internal_error' });
  }
});

// ══════════════════════════════════════════════════════
// GP TRANSFER (Migration 102)
// POST /api/gp/transfer  — send GP to another player
// GET  /api/gp/transfers — transfer history for wallet
// ══════════════════════════════════════════════════════

router.post('/gp/transfer', requireAuth, writeLimiter, async (req, res) => {
  const fromWallet = getAuthWallet(req);
  if (!fromWallet || fromWallet.length < 10)
    return res.status(400).json({ error: 'wallet_required' });

  const { toWallet: rawTo, amount: rawAmount, note: rawNote } = req.body || {};
  const toWallet = (rawTo || '').toLowerCase().trim();
  const amount   = Number(rawAmount);
  const note     = (rawNote || '').slice(0, 200).trim();

  if (!toWallet || toWallet.length < 10)
    return res.status(400).json({ error: 'to_wallet_required' });
  if (toWallet === fromWallet)
    return res.status(400).json({ error: 'cannot_send_to_self' });
  if (!Number.isFinite(amount) || amount <= 0)
    return res.status(400).json({ error: 'invalid_amount' });

  try {
    // Settings check
    const [enabledRow, minRow, maxRow, limitRow, feeRow] = await Promise.all([
      pool.query("SELECT value FROM settings WHERE key='gp_transfer_enabled'"),
      pool.query("SELECT value FROM settings WHERE key='gp_transfer_min_amount'"),
      pool.query("SELECT value FROM settings WHERE key='gp_transfer_max_amount'"),
      pool.query("SELECT value FROM settings WHERE key='gp_transfer_daily_limit'"),
      pool.query("SELECT value FROM settings WHERE key='gp_transfer_fee_pct'"),
    ]);
    if (enabledRow.rows[0]?.value === 'false')
      return res.status(400).json({ error: 'gp_transfer_disabled' });

    const minAmt   = parseFloat(minRow.rows[0]?.value   || '1');
    const maxAmt   = parseFloat(maxRow.rows[0]?.value   || '10000');
    const dayLimit = parseFloat(limitRow.rows[0]?.value || '50000');
    const feePct   = parseFloat(feeRow.rows[0]?.value   || '0');

    if (amount < minAmt) return res.status(400).json({ error: 'amount_too_small', min: minAmt });
    if (amount > maxAmt) return res.status(400).json({ error: 'amount_too_large', max: maxAmt });

    // Check recipient exists
    const recipRes = await pool.query(
      'SELECT wallet_address, nickname FROM users WHERE LOWER(wallet_address) = LOWER($1)', [toWallet]
    );
    if (!recipRes.rows.length)
      return res.status(400).json({ error: 'recipient_not_found' });
    const recipNick = recipRes.rows[0].nickname || toWallet.slice(0, 8) + '…';

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // [v7.165] 송신자 행을 먼저 FOR UPDATE 로 잠가 동일 사용자 동시 송금 race 차단.
      // 그 후 daily limit 집계 — race window 제거(둘 다 통과해 한도 +amount 초과되던 결함 수정).
      const senderRes = await client.query(
        'SELECT gp_balance FROM users WHERE LOWER(wallet_address) = LOWER($1) FOR UPDATE',
        [fromWallet]
      );
      if (!senderRes.rows.length) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'sender_not_found' });
      }

      // Daily limit check (LOWER 양쪽 비교 — 대소문자 우회 차단)
      const dayRes = await client.query(
        `SELECT COALESCE(SUM(amount), 0) AS sent_today
           FROM gp_transfers
          WHERE LOWER(from_wallet) = LOWER($1) AND created_at >= CURRENT_DATE`,
        [fromWallet]
      );
      const sentToday = parseFloat(dayRes.rows[0].sent_today) || 0;
      if (sentToday + amount > dayLimit) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          error: 'daily_limit_exceeded',
          remaining: Math.max(0, dayLimit - sentToday),
          limit: dayLimit
        });
      }
      const senderGP = parseFloat(senderRes.rows[0].gp_balance) || 0;
      if (senderGP < amount) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'insufficient_gp', balance: senderGP });
      }
      const fee      = Math.floor(amount * feePct / 100 * 1000000) / 1000000;
      const received = amount - fee;

      const deductTransfer = await client.query(
        'UPDATE users SET gp_balance = gp_balance - $1 WHERE LOWER(wallet_address) = LOWER($2) AND gp_balance >= $1',
        [amount, fromWallet]
      );
      if (deductTransfer.rowCount === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Insufficient balance (concurrent modification)' });
      }
      // Credit recipient
      await client.query(
        'UPDATE users SET gp_balance = gp_balance + $1 WHERE LOWER(wallet_address) = LOWER($2)',
        [received, toWallet]
      );
      // Log transfer
      await client.query(
        'INSERT INTO gp_transfers (from_wallet, to_wallet, amount, note) VALUES ($1, $2, $3, $4)',
        [fromWallet, toWallet, amount, note || null]
      );

      await client.query('COMMIT');

      // Fire-and-forget activity logs
      try {
        const { logGPActivity, notifyPlayer } = require('../db');
        logGPActivity(fromWallet, -amount, 'gp_transfer_out', `→ ${recipNick}`).catch(() => {});
        logGPActivity(toWallet,   received, 'gp_transfer_in',  `← ${fromWallet.slice(0,8)}…`).catch(() => {});
        notifyPlayer(toWallet, 'gp_received', `You received ${received} GP from ${fromWallet.slice(0,8)}…`, { amount: received }).catch(() => {});
      } catch (_le) {}

      res.json({
        success:   true,
        sent:      amount,
        fee,
        received,
        to:        toWallet,
        toNick:    recipNick,
      });
      // News: big GP transfer
      if (newsSvc) { newsSvc.onBigTransfer(fromWallet, toWallet, amount).catch(() => {}); }
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('[GP TRANSFER] error:', err.message);
      res.status(500).json({ error: 'internal_error' });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('[GP TRANSFER] outer error:', err.message);
    res.status(500).json({ error: 'internal_error' });
  }
});

router.get('/gp/transfers', readLimiter, async (req, res) => {
  const wallet = (req.headers['x-wallet'] || req.query.wallet || '').toLowerCase().trim();
  if (!wallet || wallet.length < 10)
    return res.status(400).json({ error: 'wallet_required' });
  try {
    const result = await pool.query(
      `SELECT t.*,
              uf.nickname AS from_nick,
              ut.nickname AS to_nick
         FROM gp_transfers t
         LEFT JOIN users uf ON uf.wallet_address = t.from_wallet
         LEFT JOIN users ut ON ut.wallet_address = t.to_wallet
        WHERE t.from_wallet = $1 OR t.to_wallet = $1
        ORDER BY t.created_at DESC
        LIMIT 30`,
      [wallet]
    );
    res.json({ transfers: result.rows });
  } catch (err) {
    console.error('[GP TRANSFER] transfers list error:', err.message);
    res.status(500).json({ error: 'internal_error' });
  }
});


// ── ACHIEVEMENTS (Migration 104) ─────────────────────────────────────────────
let achievementService;
try { achievementService = require('../services/achievements'); } catch (_) {}

// GET /api/achievements?wallet= — all achievements with unlock status
router.get('/achievements', readLimiter, async (req, res) => {
  const wallet = (req.query.wallet || '').toLowerCase();
  if (!wallet || wallet.length < 10) return res.status(400).json({ error: 'wallet required' });
  try {
    if (!achievementService) return res.status(503).json({ error: 'Achievement service unavailable' });
    const list = await achievementService.getUserAchievements(wallet);
    res.json({ achievements: list });
  } catch (e) {
    console.error('[Achievements] list error:', e.message);
    res.status(500).json({ error: 'Internal error' });
  }
});


// ── PLANET NEWS (Migration 106) ──────────────────────────────────────────────
let newsSvcApi;
try { newsSvcApi = require('../services/news'); } catch (_) {}

// GET /api/news?limit=&offset=&type= — public news feed
router.get('/news', readLimiter, async (req, res) => {
  const limit  = Math.min(100, parseInt(req.query.limit)  || 30);
  const offset = Math.max(0,   parseInt(req.query.offset) || 0);
  const type   = req.query.type || null;
  try {
    if (!newsSvcApi) return res.json({ news: [] });
    const news = await newsSvcApi.getNews({ limit, offset, eventType: type });
    res.json({ news });
  } catch (e) {
    console.error('[NEWS] get error:', e.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

// GET /api/onboarding/status — lightweight first-session progress hint
// [Gemini review] JWT 전용 wallet 추출, 정확한 컬럼명 사용
router.get('/onboarding/status', requireAuth, async (req, res) => {
  const wallet = getAuthWallet(req);
  if (!wallet) return res.json({ step: 0, completed: false });

  try {
    const [claimRes, miningRes, shipRes] = await Promise.all([
      pool.query(
        'SELECT COUNT(*)::int AS cnt FROM claims WHERE LOWER(owner) = LOWER($1) AND deleted_at IS NULL',
        [wallet]
      ),
      pool.query(
        "SELECT COUNT(*)::int AS cnt FROM transactions WHERE type = 'mining' AND LOWER(from_wallet) = LOWER($1)",
        [wallet]
      ),
      pool.query(
        'SELECT COUNT(*)::int AS cnt FROM ships WHERE LOWER(owner_wallet) = LOWER($1)',
        [wallet]
      ),
    ]);

    const territoryCount = claimRes.rows[0]?.cnt || 0;
    const miningCount    = miningRes.rows[0]?.cnt || 0;
    const shipCount      = shipRes.rows[0]?.cnt   || 0;

    if (territoryCount <= 0) return res.json({ step: 0, completed: false });
    if (miningCount <= 0)    return res.json({ step: 1, completed: false });
    if (shipCount <= 0)      return res.json({ step: 2, completed: false });
    return res.json({ step: 3, completed: true });
  } catch (err) {
    console.error('[onboarding] status error:', err.message);
    return res.json({ step: 0, completed: false });
  }
});

// POST /api/onboarding/dismiss — best-effort (users.settings 컬럼 없어도 graceful)
// [Gemini review] JWT 전용 wallet 추출
router.post('/onboarding/dismiss', requireAuth, async (req, res) => {
  const wallet = getAuthWallet(req);
  if (wallet) {
    try {
      await pool.query(
        "UPDATE users SET settings = COALESCE(settings, '{}'::jsonb) || jsonb_build_object('onboarding_dismissed', true) WHERE LOWER(wallet_address) = LOWER($1)",
        [wallet]
      );
    } catch (_) { /* users.settings 컬럼 없는 환경에서도 무시 — 프론트 로컬 상태로 처리 */ }
  }
  return res.json({ success: true });
});

// GET /api/activity/feed — global polling-based activity feed (best-effort per source)
// [Gemini review] 5초 인메모리 캐시로 DB 부하 방지
let _feedCache = null;
let _feedCacheAt = 0;
const FEED_CACHE_TTL_MS = 5000;

router.get('/activity/feed', async (req, res) => {
  const sinceParam = req.query.since ? String(req.query.since) : '';
  const sinceDate = sinceParam ? new Date(sinceParam) : null;
  const since = sinceDate && !Number.isNaN(sinceDate.getTime())
    ? sinceDate.toISOString()
    : new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const limit = Math.min(20, Math.max(1, parseInt(req.query.limit, 10) || 15));

  // 캐시 히트 (since 없는 초기 요청에만 적용)
  if (!sinceParam && _feedCache && Date.now() - _feedCacheAt < FEED_CACHE_TTL_MS) {
    return res.json({ events: _feedCache.slice(0, limit) });
  }

  const safeQuery = async (sql, params) => {
    try {
      const result = await pool.query(sql, params);
      return result.rows || [];
    } catch (err) {
      console.warn('[activity/feed] source query failed:', err.message);
      return [];
    }
  };

  try {
    const [claims, harvests, battles, builds] = await Promise.all([
      safeQuery(
        `SELECT 'claim' AS type,
            COALESCE(u.nickname, LEFT(c.owner, 8)) AS actor,
            COALESCE(c.custom_name, 'territory') AS target,
            NULL AS meta,
            c.created_at
         FROM claims c
         LEFT JOIN users u ON LOWER(u.wallet_address) = LOWER(c.owner)
         WHERE c.created_at > $1
         ORDER BY c.created_at DESC
         LIMIT 5`,
        [since]
      ),
      safeQuery(
        `SELECT 'harvest' AS type,
            LEFT(from_wallet, 8) AS actor,
            NULL AS target,
            pp_amount::text || ' PP' AS meta,
            created_at
         FROM transactions
         WHERE type = 'mining' AND created_at > $1
         ORDER BY created_at DESC
         LIMIT 5`,
        [since]
      ),
      safeQuery(
        // [Gemini review] DISTINCT ON으로 전투당 1개만 반환 (JOIN 시 중복 방지)
        `SELECT DISTINCT ON (fb.id)
            'battle' AS type,
            COALESCE(u.nickname, LEFT(fbp.wallet_address, 8)) AS actor,
            NULL AS target,
            NULL AS meta,
            COALESCE(fb.ended_at, fb.created_at) AS created_at
         FROM fleet_battles fb
         JOIN fleet_battle_participants fbp
           ON fbp.battle_id = fb.id AND fbp.side = fb.winner_side
         LEFT JOIN users u ON LOWER(u.wallet_address) = LOWER(fbp.wallet_address)
         WHERE fb.status = 'ended'
           AND fb.winner_side IS NOT NULL
           AND fb.winner_side != 'draw'
           AND COALESCE(fb.ended_at, fb.created_at) > $1
         ORDER BY fb.id, COALESCE(fb.ended_at, fb.created_at) DESC
         LIMIT 5`,
        [since]
      ),
      safeQuery(
        `SELECT 'build' AS type,
            COALESCE(u.nickname, LEFT(s.owner_wallet, 8)) AS actor,
            COALESCE(st.name_ko, s.ship_type_code) AS target,
            NULL AS meta,
            s.built_at AS created_at
         FROM ships s
         LEFT JOIN ship_types st ON s.ship_type_code = st.code
         LEFT JOIN users u ON LOWER(u.wallet_address) = LOWER(s.owner_wallet)
         WHERE s.built_at > $1
         ORDER BY s.built_at DESC
         LIMIT 5`,
        [since]
      ),
    ]);

    const events = []
      .concat(claims, harvests, battles, builds)
      .filter(e => e && e.created_at)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, limit);

    // 초기 요청 캐시 저장
    if (!sinceParam) { _feedCache = events; _feedCacheAt = Date.now(); }

    return res.json({ events });
  } catch (err) {
    console.error('[activity/feed] error:', err.message);
    return res.json({ events: [] });
  }
});

module.exports = router;
