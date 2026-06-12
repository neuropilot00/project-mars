const express = require('express');
const jwt = require('jsonwebtoken');
const { makeRateLimiter } = require('../utils/rateLimiters');
const { pool, getSetting } = require('../db');
const { requireAuth, getAuthWallet, sanitize } = require('../utils/apiHelpers');
const { cfg } = require('../utils/settingsCache');

const router = express.Router();

const readLimiter = makeRateLimiter({
  windowMs: 60 * 1000,
  max: 120,
  message: { error: 'Too many requests. Please slow down.' }
});
const writeLimiter = makeRateLimiter({
  windowMs: 60 * 1000,
  max: 30,
  message: { error: 'Too many write requests. Please wait.' }
});

let seasonService;
try { seasonService = require('../services/season'); } catch (_e) { /* season service not available */ }
let upgradeSvc;
try { upgradeSvc = require('../services/claimUpgrades'); } catch (_e) { /* upgrade service not available */ }

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
// GET /api/territory/:claimId/production
// 영토 생산 요약 — 소유 여부, 섹터 유형, 예상 PP, 드롭 재료 목록, 모디파이어, 마지막 수확
// ══════════════════════════════════════════════════
router.get('/territory/:claimId/production', readLimiter, async (req, res) => {
  const claimId = parseInt(req.params.claimId);
  const wallet = getOptionalAuthWallet(req);
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
        sectorMult,
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
// GET /api/territory/:claimId/upgrades
// 영토 업그레이드 현황 + 카탈로그 (소유자 전용 업그레이드 버튼)
// ══════════════════════════════════════════════════
router.get('/territory/:claimId/upgrades', readLimiter, async (req, res) => {
  const claimId = parseInt(req.params.claimId);
  const wallet = getOptionalAuthWallet(req);
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

module.exports = router;
