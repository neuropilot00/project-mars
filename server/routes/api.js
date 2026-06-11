const express = require('express');
const { ethers } = require('ethers');
const { makeRateLimiter } = require('../utils/rateLimiters');
const { pool, ensureUser, getSetting, getPPToGPRate, getReferralChain, creditReferralCommission, awardXP, notifyPlayer } = require('../db');
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

// Referral profile/register/leaderboard routes live in routes/referralRoutes.js.

// Map/user/claim query routes live in routes/mapQueryRoutes.js.

// Upload route lives in routes/uploadRoutes.js.

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

// Public leaderboard/stats/error-report routes live in routes/statsRoutes.js.

// Legacy sector query routes live in routes/sectorQueryRoutes.js.

// User BASE summary route lives in routes/userBaseRoutes.js.

// Rank/breakthrough routes live in routes/statsRoutes.js.

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

// Legacy random quest routes live in routes/questRoutes.js.

// Item shop, item instances, and enhancement routes live in routes/itemEconomyRoutes.js.

// Weather, exploration, and rocket routes live in routes/worldOpsRoutes.js.

// Territory cosmetic equip/unequip routes live in routes/cosmeticRoutes.js.

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

// Territory management routes live in routes/territoryManagementRoutes.js.

// Sector control score routes live in routes/sectorControlRoutes.js.

// Exploration hint and rocket priority routes live in routes/worldOpsRoutes.js.

// Shop auto-renew routes live in routes/itemEconomyRoutes.js.

// Season routes live in routes/seasonRoutes.js. Season score hooks remain inline
// in gameplay routes so existing non-blocking side effects stay close to actions.

// ══════════════════════════════════════════════════════════════
//  GUILD SYSTEM
// ══════════════════════════════════════════════════════════════

// Guild routes live in routes/guildRoutes.js.

// Protection scroll routes live in routes/itemEconomyRoutes.js.

// User title and hall-of-fame routes live in routes/titleRoutes.js.

// Marketplace overlay, GP activity, my-territories, and GP transfer routes live in routes/economyUtilityRoutes.js.

// Player status/feed routes live in routes/playerStatusRoutes.js.

module.exports = router;
