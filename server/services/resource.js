/**
 * services/resource.js
 * 광물 & 자원 시스템 — MASTER_PLAN Phase 2
 *
 * rollResourceDrop(wallet, sectorType)   → [{code, quantity}, ...]
 * addResourcesToInventory(client, wallet, drops) → void
 * getUserInventory(wallet)               → [{resource, quantity}, ...]
 * getAllResources(lang)                  → resources[]
 * getResourceStats()                    → admin stats
 */

const { pool, getSetting } = require('../db');

// ── optional job service (safe load) ──
let jobService;
try { jobService = require('./job'); } catch (_e) {}

// ─────────────────────────────────────────
// 5분 캐시: 자원 드롭 레이트 테이블
// ─────────────────────────────────────────
let _rateCache = null;
let _rateCacheAt = 0;
const RATE_CACHE_TTL = 5 * 60 * 1000;

async function _getRates() {
  if (_rateCache && Date.now() - _rateCacheAt < RATE_CACHE_TTL) return _rateCache;
  const res = await pool.query(`
    SELECT srr.sector_type, srr.resource_code, srr.base_rate, srr.miner_bonus,
           r.rarity, r.is_active AS resource_active
    FROM sector_resource_rates srr
    JOIN resources r ON r.code = srr.resource_code
    WHERE srr.is_active = TRUE AND r.is_active = TRUE
  `);
  _rateCache = res.rows;
  _rateCacheAt = Date.now();
  return _rateCache;
}

// ─────────────────────────────────────────
// rollResourceDrop(wallet, sectorType)
// 반환: [{code, quantity}, ...]  (빈 배열 가능)
// ─────────────────────────────────────────
async function rollResourceDrop(wallet, sectorType, opts) {
  const enabled = (await getSetting('resource_drop_enabled') || 'true') === 'true';
  if (!enabled) return [];

  // [영토 등급 v7.140] 고등급 영토는 rare/special 재료 드롭 "확률"이 올라간다(상한 0.99).
  const gradeRareMult = (opts && Number(opts.gradeRareMult)) || 1;
  const type = (sectorType || 'frontier').toLowerCase();
  const maxDrops    = parseInt(await getSetting('resource_max_drop_per_harvest') || '3');
  const qMin        = parseInt(await getSetting('resource_drop_quantity_min')    || '1');
  const qMax        = parseInt(await getSetting('resource_drop_quantity_max')    || '5');
  const rareMult    = parseFloat(await getSetting('resource_rare_multiplier')    || '1.3');

  // Miner 희귀 자원 배율 (직업 시스템 연동)
  let minerRareBonus = 1.0;
  try {
    if (jobService) {
      minerRareBonus = await jobService.getJobBuff(wallet, 'miner_rare_resource_chance', 1.0);
    }
  } catch (_e) {}

  const rates = await _getRates();
  const sectorRates = rates.filter(r => r.sector_type === type);
  if (!sectorRates.length) return [];

  const drops = [];
  const checked = new Set();

  for (const row of sectorRates) {
    if (checked.size >= maxDrops) break;
    if (checked.has(row.resource_code)) continue;

    // 기본 확률
    let prob = parseFloat(row.base_rate);

    const _isRare = (row.rarity === 'rare' || row.rarity === 'special');
    // Miner 직업 보너스: flat 추가
    if (minerRareBonus > 1.0) {
      if (_isRare) {
        prob += parseFloat(row.miner_bonus) * minerRareBonus;
        prob = Math.min(prob * rareMult, 0.99); // 배율 적용 + 상한
      } else {
        prob += parseFloat(row.miner_bonus);
      }
    }
    // [영토 등급] rare/special 드롭 확률을 등급 배수만큼 상향(상한 0.99)
    if (_isRare && gradeRareMult !== 1) {
      prob = Math.min(prob * gradeRareMult, 0.99);
    }

    if (Math.random() < prob) {
      let qty = Math.floor(Math.random() * (qMax - qMin + 1)) + qMin;
      // ✅ [Job] Miner 자원 드롭 수량 +20% (miner_resource_drop_quantity = 1.2)
      try {
        if (jobService) {
          const dropQtyBuff = await jobService.getJobBuff(wallet, 'miner_resource_drop_quantity', 1.0);
          if (dropQtyBuff !== 1.0) qty = Math.max(1, Math.round(qty * dropQtyBuff));
        }
      } catch (_e) {}
      drops.push({ code: row.resource_code, quantity: qty });
      checked.add(row.resource_code);
    }
  }

  return drops;
}

// ─────────────────────────────────────────
// addResourcesToInventory(client, wallet, drops)
// client: pg 트랜잭션 클라이언트 (없으면 pool 사용)
// drops: [{code, quantity}, ...]
// ─────────────────────────────────────────
async function addResourcesToInventory(clientOrNull, wallet, drops) {
  if (!drops || drops.length === 0) return;
  const db = clientOrNull || pool;

  for (const drop of drops) {
    await db.query(`
      INSERT INTO user_resource_inventory (wallet_address, resource_id, quantity, updated_at)
      SELECT $1, r.id, $2, NOW()
      FROM resources r
      WHERE r.code = $3
      ON CONFLICT (wallet_address, resource_id)
      DO UPDATE SET
        quantity   = user_resource_inventory.quantity + EXCLUDED.quantity,
        updated_at = NOW()
    `, [wallet, drop.quantity, drop.code]);
  }
}

// ─────────────────────────────────────────
// getUserInventory(wallet, lang)
// 자원 인벤토리 + 자원 메타 반환
// ─────────────────────────────────────────
async function getUserInventory(wallet, lang = 'en') {
  const nameCol = ['en','ko','ja','zh'].includes(lang) ? `name_${lang}` : 'name_en';
  const res = await pool.query(`
    SELECT r.code, r.${nameCol} AS name, r.rarity, r.icon_emoji,
           r.base_pp_value, r.is_tradeable,
           COALESCE(inv.quantity, 0) AS quantity
    FROM resources r
    LEFT JOIN user_resource_inventory inv
      ON inv.resource_id = r.id AND inv.wallet_address = $1
    WHERE r.is_active = TRUE
    ORDER BY
      CASE r.rarity WHEN 'common' THEN 1 WHEN 'rare' THEN 2 ELSE 3 END,
      r.code
  `, [wallet]);
  return res.rows;
}

// ─────────────────────────────────────────
// getAllResources(lang)
// 전체 자원 목록 (UI / 마켓 브라우징용)
// ─────────────────────────────────────────
async function getAllResources(lang = 'en') {
  const nameCol = ['en','ko','ja','zh'].includes(lang) ? `name_${lang}` : 'name_en';
  const res = await pool.query(`
    SELECT code, ${nameCol} AS name, rarity, icon_emoji, base_pp_value, is_tradeable
    FROM resources
    WHERE is_active = TRUE
    ORDER BY CASE rarity WHEN 'common' THEN 1 WHEN 'rare' THEN 2 ELSE 3 END, code
  `);
  return res.rows;
}

// ─────────────────────────────────────────
// getResourceStats()  — 어드민용
// ─────────────────────────────────────────
async function getResourceStats() {
  // 총 인벤토리 합계
  const totals = await pool.query(`
    SELECT r.code, r.name_en, r.rarity, r.icon_emoji,
           COALESCE(SUM(inv.quantity), 0) AS total_held,
           COUNT(DISTINCT inv.wallet_address)       AS holder_count
    FROM resources r
    LEFT JOIN user_resource_inventory inv ON inv.resource_id = r.id
    GROUP BY r.id, r.code, r.name_en, r.rarity, r.icon_emoji
    ORDER BY r.id
  `);

  // 최근 마켓 거래
  const recent = await pool.query(`
    SELECT ml.id, ml.seller, ml.resource_code, ml.resource_quantity, ml.price, ml.currency,
           ml.sold_at, ml.buyer
    FROM marketplace_listings ml
    WHERE ml.listing_type = 'resource' AND ml.status = 'sold'
    ORDER BY ml.sold_at DESC LIMIT 20
  `);

  return { resources: totals.rows, recentSales: recent.rows };
}

// ─────────────────────────────────────────
// invalidateRateCache()  — 어드민이 rates 수정 시 호출
// ─────────────────────────────────────────
function invalidateRateCache() {
  _rateCache = null;
  _rateCacheAt = 0;
}

module.exports = {
  rollResourceDrop,
  addResourcesToInventory,
  getUserInventory,
  getAllResources,
  getResourceStats,
  invalidateRateCache,
};
