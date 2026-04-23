/**
 * services/sector.js
 * 섹터 정의 서비스 (BIBLE Migration 081 — Migration 084)
 *
 * 함수 목록:
 *  - getSector(sectorCode)                   → 섹터 정보 반환
 *  - getAllSectors(lang)                      → 전체 섹터 목록
 *  - getSectorGovernance(sectorCode)          → 거버넌스 상태 반환
 *  - checkEntryRequirement(wallet, sectorCode)→ { allowed, reason }
 *  - calculateLandPrice(pixelCount, sectorCode, isAdjacent)
 *  - getSectorMiningBuff(sectorCode)          → Mining 버프 배율
 *
 * 모든 수치는 settings 테이블에서 조회. 하드코딩 금지.
 */

'use strict';

const { pool, getSetting } = require('../db');

// ── 섹터 정보 캐시 (5분) ──
let _sectorCache = null;
let _sectorCacheAt = 0;
const CACHE_TTL = 5 * 60 * 1000;

async function _loadSectors() {
  const now = Date.now();
  if (_sectorCache && now - _sectorCacheAt < CACHE_TTL) return _sectorCache;

  const res = await pool.query(
    `SELECT * FROM sector_definitions WHERE is_active = true ORDER BY
       CASE sector_type WHEN 'core' THEN 1 WHEN 'mid' THEN 2 ELSE 3 END,
       code`
  );
  _sectorCache = res.rows;
  _sectorCacheAt = now;
  return _sectorCache;
}

function invalidateSectorCache() {
  _sectorCache = null;
  _sectorCacheAt = 0;
}

// ─────────────────────────────────────────────────────────────
// 1. 단일 섹터 조회
// ─────────────────────────────────────────────────────────────
async function getSector(sectorCode) {
  const sectors = await _loadSectors();
  return sectors.find(s => s.code === sectorCode) || null;
}

// ─────────────────────────────────────────────────────────────
// 2. 전체 섹터 목록 (언어별 name 변환)
// ─────────────────────────────────────────────────────────────
async function getAllSectors(lang = 'en') {
  const sectors = await _loadSectors();
  return sectors.map(s => ({
    code:               s.code,
    name:               s[`name_${lang}`] || s.name_en,
    name_en:            s.name_en,
    name_ko:            s.name_ko,
    name_ja:            s.name_ja,
    name_zh:            s.name_zh,
    sector_type:        s.sector_type,
    price_multiplier:   parseFloat(s.price_multiplier),
    mining_multiplier:  parseFloat(s.mining_multiplier),
    defense_multiplier: parseFloat(s.defense_multiplier),
    lore:               s[`lore_${lang}`] || s.lore_en || null,
    special_feature:    s.special_feature || null,
    is_active:          s.is_active
  }));
}

// ─────────────────────────────────────────────────────────────
// 3. 거버넌스 현황 조회
// ─────────────────────────────────────────────────────────────
async function getSectorGovernance(sectorCode) {
  const res = await pool.query(
    `SELECT sg.*,
            u.nickname AS governor_nickname,
            u.wallet_address AS governor_wallet_addr,
            sd.name_en, sd.name_ko, sd.name_ja, sd.name_zh, sd.sector_type
     FROM sector_governance sg
     LEFT JOIN users u ON u.wallet_address = sg.governor_wallet
     LEFT JOIN sector_definitions sd ON sd.code = sg.sector_code
     WHERE sg.sector_code = $1`,
    [sectorCode]
  );
  if (!res.rows.length) return null;

  const row = res.rows[0];

  // Governor 임기 계산
  let governorDays = null;
  if (row.governor_since) {
    governorDays = Math.floor(
      (Date.now() - new Date(row.governor_since).getTime()) / (1000 * 60 * 60 * 24)
    );
  }

  return {
    sector_code:        row.sector_code,
    sector_name_en:     row.name_en,
    sector_type:        row.sector_type,
    governor: row.governor_wallet ? {
      wallet:    row.governor_wallet,
      nickname:  row.governor_nickname || row.governor_wallet.slice(0, 8),
      since:     row.governor_since,
      days:      governorDays
    } : null,
    tax_rate:           parseFloat(row.tax_rate),
    market_cut_rate:    parseFloat(row.market_cut_rate),
    sector_policy:      row.sector_policy,
    declaration_text:   row.declaration_text || null,
    declaration_updated:row.declaration_updated || null,
    total_tax_collected:parseFloat(row.total_tax_collected),
    active_siege_id:    row.active_siege_id || null,
    created_at:         row.created_at
  };
}

// ─────────────────────────────────────────────────────────────
// 4. 진입 요건 체크
// ─────────────────────────────────────────────────────────────
async function checkEntryRequirement(wallet, sectorCode) {
  // 기능 비활성화 시 모두 허용
  const enabled = (await getSetting('sector_entry_check_enabled') ?? 'true').toString() === 'true';
  if (!enabled) return { allowed: true, reason: 'entry_check_disabled' };

  // 섹터 조회
  const sector = await getSector(sectorCode);
  if (!sector) return { allowed: false, reason: 'sector_not_found' };

  // Frontier는 레벨 제한 없음
  if (sector.sector_type === 'frontier') return { allowed: true, reason: 'frontier_open' };

  // 진입 요건 로드
  const reqRes = await pool.query(
    'SELECT * FROM sector_entry_requirements WHERE sector_code = $1 AND is_active = true',
    [sectorCode]
  );
  if (!reqRes.rows.length) return { allowed: true, reason: 'no_requirements' };

  const req = reqRes.rows[0];

  // 유저 레벨 체크
  const userRes = await pool.query(
    'SELECT rank_level FROM users WHERE wallet_address = $1',
    [wallet.toLowerCase()]
  );
  if (!userRes.rows.length) return { allowed: false, reason: 'user_not_found' };

  const userLevel = parseInt(userRes.rows[0].rank_level) || 0;
  if (userLevel < req.min_level) {
    return {
      allowed: false,
      reason: 'level_too_low',
      required_level: req.min_level,
      current_level: userLevel
    };
  }

  // Core 섹터: Mid 영토 보유 체크
  if (sector.sector_type === 'core' && req.required_mid_territories > 0) {
    const midRes = await pool.query(
      `SELECT COUNT(*) AS cnt FROM claims c
       JOIN sector_definitions sd ON sd.code = c.sector_code
       WHERE c.owner = $1 AND sd.sector_type = 'mid'`,
      [wallet.toLowerCase()]
    );
    const midCount = parseInt(midRes.rows[0]?.cnt ?? 0);
    if (midCount < req.required_mid_territories) {
      return {
        allowed: false,
        reason: 'insufficient_mid_territories',
        required_mid: req.required_mid_territories,
        current_mid: midCount
      };
    }
  }

  return { allowed: true, reason: 'ok' };
}

// ─────────────────────────────────────────────────────────────
// 5. 영토 가격 계산
// ─────────────────────────────────────────────────────────────
async function calculateLandPrice(pixelCount, sectorCode, isAdjacent = false) {
  const basePrice  = parseFloat(await getSetting('land_base_price_pp')     ?? '0.1');
  const adjDisc    = parseFloat(await getSetting('land_adjacent_discount')  ?? '0.85');

  let multiplier = 1.0;

  if (sectorCode) {
    const sector = await getSector(sectorCode);
    if (sector) {
      multiplier = parseFloat(sector.price_multiplier) || 1.0;
    } else {
      // BIBLE 기준 섹터 타입별 배율 settings
      const coreM     = parseFloat(await getSetting('land_core_price_mult')     ?? '5.0');
      const midM      = parseFloat(await getSetting('land_mid_price_mult')      ?? '2.0');
      const frontierM = parseFloat(await getSetting('land_frontier_price_mult') ?? '1.0');
      // sectorCode가 unknown이면 기본 frontier 배율 적용
      multiplier = frontierM;
    }
  }

  const rawPrice = pixelCount * basePrice * multiplier;
  const finalPrice = isAdjacent ? rawPrice * adjDisc : rawPrice;

  return Math.round(finalPrice * 1000000) / 1000000; // 6자리 반올림
}

// ─────────────────────────────────────────────────────────────
// 6. 섹터 Mining 버프 배율
// ─────────────────────────────────────────────────────────────
async function getSectorMiningBuff(sectorCode) {
  if (!sectorCode) return 1.0;
  const sector = await getSector(sectorCode);
  if (!sector) return 1.0;
  return parseFloat(sector.mining_multiplier) || 1.0;
}

// ─────────────────────────────────────────────────────────────
// 7. 어드민: 섹터 통계
// ─────────────────────────────────────────────────────────────
async function getSectorStats() {
  const res = await pool.query(`
    SELECT
      sd.code,
      sd.name_en,
      sd.sector_type,
      sd.price_multiplier,
      sd.mining_multiplier,
      COUNT(c.id)                            AS claim_count,
      COALESCE(SUM(c.width * c.height), 0)  AS total_pixels,
      sg.governor_wallet,
      u.nickname                             AS governor_nickname,
      sg.tax_rate,
      sg.sector_policy
    FROM sector_definitions sd
    LEFT JOIN claims c ON c.sector_code = sd.code
    LEFT JOIN sector_governance sg ON sg.sector_code = sd.code
    LEFT JOIN users u ON u.wallet_address = sg.governor_wallet
    WHERE sd.is_active = true
    GROUP BY sd.code, sd.name_en, sd.sector_type, sd.price_multiplier,
             sd.mining_multiplier, sg.governor_wallet, u.nickname,
             sg.tax_rate, sg.sector_policy
    ORDER BY CASE sd.sector_type WHEN 'core' THEN 1 WHEN 'mid' THEN 2 ELSE 3 END, sd.code
  `);
  return res.rows;
}

module.exports = {
  getSector,
  getAllSectors,
  getSectorGovernance,
  checkEntryRequirement,
  calculateLandPrice,
  getSectorMiningBuff,
  getSectorStats,
  invalidateSectorCache
};
