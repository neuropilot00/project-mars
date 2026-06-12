const express = require('express');
const jwt = require('jsonwebtoken');
const { makeRateLimiter } = require('../utils/rateLimiters');
const { pool, creditReferralCommission, logGPActivity } = require('../db');
const { requireAuth, getAuthWallet } = require('../utils/apiHelpers');

let seasonService;
try { seasonService = require('../services/season'); } catch (_e) { /* season service not available */ }
let achSvc;
try { achSvc = require('../services/achievements'); } catch (_e) { /* achievements service not available */ }
let missionService;
try { missionService = require('../services/missions'); } catch (_e) { /* mission service not available */ }
let enhancementService;
try { enhancementService = require('../services/enhancement'); } catch (_e) { /* enhancement service not available */ }

const router = express.Router();
const USE_EFFECT_DEFAULT_HOURS = 24;

const readLimiter = makeRateLimiter({
  windowMs: 60 * 1000, max: 120,
  message: { error: 'Too many requests. Please slow down.' }
});
const writeLimiter = makeRateLimiter({
  windowMs: 60 * 1000, max: 30,
  message: { error: 'Too many write requests. Please wait.' }
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

function getUseEffectExpiry(item) {
  const hours = Number(item?.duration_hours) > 0 ? Number(item.duration_hours) : USE_EFFECT_DEFAULT_HOURS;
  return new Date(Date.now() + hours * 3600000);
}

async function settleGpGenerators(wallet) {
  const w = String(wallet || '').toLowerCase().trim();
  if (!w) return 0;
  const client = await pool.connect();
  let totalGp = 0;
  try {
    await client.query('BEGIN');
    const effects = await client.query(
      `SELECT id, effect_value, activated_at, expires_at, COALESCE(last_settled_at, activated_at) AS last_settled_at
       FROM user_active_effects
       WHERE wallet = $1
         AND effect_type = 'gp_generator'
         AND active = true
         AND expires_at IS NOT NULL
         AND COALESCE(last_settled_at, activated_at) < expires_at
       FOR UPDATE`,
      [w]
    );
    const now = Date.now();
    for (const effect of effects.rows) {
      const lastAt = new Date(effect.last_settled_at || effect.activated_at).getTime();
      const expiresAt = new Date(effect.expires_at).getTime();
      if (!Number.isFinite(lastAt) || !Number.isFinite(expiresAt)) continue;
      const settleAt = Math.min(now, expiresAt);
      const elapsedMs = settleAt - lastAt;
      const expired = expiresAt <= now;
      if (elapsedMs < 60000) {
        if (expired) await client.query('UPDATE user_active_effects SET active = false WHERE id = $1', [effect.id]);
        continue;
      }
      const gpPerHour = Math.max(0, parseFloat(effect.effect_value) || 0);
      const gpEarned = Math.round(gpPerHour * (elapsedMs / 3600000) * 1000000) / 1000000;
      if (gpEarned > 0) {
        await client.query(
          'UPDATE users SET gp_balance = COALESCE(gp_balance, 0) + $1 WHERE LOWER(wallet_address) = LOWER($2)',
          [gpEarned, w]
        );
        totalGp += gpEarned;
      }
      await client.query(
        `UPDATE user_active_effects
         SET last_settled_at = to_timestamp($2 / 1000.0),
             active = CASE WHEN expires_at <= NOW() THEN false ELSE active END
         WHERE id = $1`,
        [effect.id, settleAt]
      );
    }
    await client.query('COMMIT');
    if (totalGp > 0 && logGPActivity) {
      logGPActivity(w, Math.round(totalGp * 1000000) / 1000000, 'gp_generator', 'GP Generator settlement').catch(() => {});
    }
    return Math.round(totalGp * 1000000) / 1000000;
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch (_) {}
    console.warn('[SHOP] gp_generator settlement skipped:', e.message);
    return 0;
  } finally {
    client.release();
  }
}

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

// GET /api/shop/inventory — get authenticated user's items
router.get('/shop/inventory', requireAuth, readLimiter, async (req, res) => {
  const wallet = getAuthWallet(req);
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
router.post('/shop/buy', requireAuth, writeLimiter, async (req, res) => {
  const { itemCode, currency, quantity } = req.body;
  const w = getAuthWallet(req);
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

    // Calculate cost. Supported currencies: PP (default), USDT, GP.
    const cur = (currency || 'PP').toUpperCase();
    let unitPrice, balCol;
    if (cur === 'USDT')      { unitPrice = parseFloat(item.price_usdt); balCol = 'usdt_balance'; }
    else if (cur === 'GP')   { unitPrice = parseFloat(item.price_gp || 0); balCol = 'gp_balance'; }
    else                     { unitPrice = parseFloat(item.price_pp);   balCol = 'pp_balance'; }
    if (unitPrice <= 0) { await client.query('ROLLBACK'); return res.status(400).json({ error: `Item not purchasable with ${cur}` }); }
    const totalCost = unitPrice * qty;

    // Check balance — FOR UPDATE prevents concurrent double-spend
    const balRes = await client.query(`SELECT ${balCol} as bal FROM users WHERE LOWER(wallet_address) = LOWER($1) FOR UPDATE`, [w]);
    if (balRes.rows.length === 0) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'User not found' }); }
    if (parseFloat(balRes.rows[0].bal) < totalCost) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: `Insufficient ${cur}. Need ${totalCost}, have ${parseFloat(balRes.rows[0].bal).toFixed(2)}` });
    }

    // Deduct balance (AND guard prevents negative balance from concurrent edge cases)
    const deductShop = await client.query(`UPDATE users SET ${balCol} = ${balCol} - $1 WHERE LOWER(wallet_address) = LOWER($2) AND ${balCol} >= $1`, [totalCost, w]);
    if (deductShop.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Insufficient balance (concurrent modification)' });
    }

    // material 카테고리: user_resource_inventory에 지급
    if (item.category === 'material') {
      // code 패턴: mat_{resource_code}  e.g. mat_iron_ore → iron_ore
      // effect_value = 지급 수량 per purchase
      const resourceCode = item.code.replace(/^mat_/, '');
      const grantQty = (parseInt(item.effect_value) || 1) * qty;
      // resources 테이블에서 resource_id 조회
      const rRes = await client.query('SELECT id FROM resources WHERE code = $1', [resourceCode]);
      if (rRes.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: `Unknown resource: ${resourceCode}` });
      }
      const resourceId = rRes.rows[0].id;
      await client.query(
        `INSERT INTO user_resource_inventory (wallet_address, resource_id, quantity)
         VALUES ($1, $2, $3)
         ON CONFLICT (wallet_address, resource_id) DO UPDATE SET quantity = user_resource_inventory.quantity + $3`,
        [w, resourceId, grantQty]
      );
    } else {
      // 일반 아이템: user_items에 추가
      await client.query(
        `INSERT INTO user_items (wallet, item_type_id, quantity) VALUES ($1, $2, $3)
         ON CONFLICT (wallet, item_type_id) DO UPDATE SET quantity = user_items.quantity + $3`,
        [w, item.id, qty]
      );
    }

    // Log transaction
    await client.query(
      `INSERT INTO transactions (type, from_wallet, usdt_amount, pp_amount, fee, meta)
       VALUES ('shop_purchase', $1, $2, $3, 0, $4)`,
      [w, cur === 'USDT' ? totalCost : 0, cur === 'PP' ? totalCost : 0,
       JSON.stringify({ item: item.code, qty, name: item.name, currency: cur, gp: cur === 'GP' ? totalCost : 0 })]
    );

    // Referral commission — only on USDT purchases (real value spend → uplines get PP)
    if (cur === 'USDT') {
      try {
        await creditReferralCommission(client, w, 'shop', totalCost, 'pp');
      } catch (_e) { /* non-critical */ }
    }

    await client.query('COMMIT');
    res.json({ success: true, item: item.name, quantity: qty, cost: totalCost, currency: cur });
    // Season tracking: shop purchase (non-blocking)
    if (seasonService) {
      seasonService.addSeasonScore(w, 'item_use', qty).catch(() => {}); // shopper category
      if (cur === 'PP') seasonService.addSeasonScore(w, 'pp_spend', 1).catch(() => {});
      else seasonService.addSeasonScore(w, 'gp_spend', Math.round(totalCost)).catch(() => {});
    }
    // Achievement check: cosmetic count + GP balance
    if (achSvc) {
      achSvc.checkAndUnlock(w, 'cosmetic_count').catch(() => {});
      achSvc.checkAndUnlock(w, 'gp_balance').catch(() => {});
    }
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('[SHOP] buy error:', e.message);
    res.status(500).json({ error: 'Purchase failed' });
  } finally {
    client.release();
  }
});

// POST /api/shop/use — use an item
router.post('/shop/use', requireAuth, writeLimiter, async (req, res) => {
  const { itemCode, claimId } = req.body;
  const w = getAuthWallet(req);
  if (!w || !itemCode) return res.status(400).json({ error: 'Missing params' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Get item type
    const itemRes = await client.query('SELECT * FROM item_types WHERE code = $1', [itemCode]);
    if (itemRes.rows.length === 0) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Item not found' }); }
    const item = itemRes.rows[0];

    // Check user has item (FOR UPDATE prevents concurrent double-use race)
    const invRes = await client.query('SELECT * FROM user_items WHERE wallet = $1 AND item_type_id = $2 AND quantity > 0 FOR UPDATE', [w, item.id]);
    if (invRes.rows.length === 0) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'You don\'t have this item' }); }

    // Deduct quantity (AND quantity > 0 guard prevents going negative)
    const deductRes = await client.query('UPDATE user_items SET quantity = quantity - 1 WHERE wallet = $1 AND item_type_id = $2 AND quantity > 0', [w, item.id]);
    if (deductRes.rowCount === 0) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'Item already used' }); }

    // Apply item effect based on code
    let effectResult = {};
    if (item.code === 'shield_basic' || item.code === 'shield_advanced') {
      if (!claimId) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'claimId required for shield' }); }
      // Check claim ownership
      const claimRes = await client.query('SELECT owner FROM claims WHERE id = $1', [claimId]);
      if (claimRes.rows.length === 0 || (claimRes.rows[0].owner || '').toLowerCase() !== w) {
        await client.query('ROLLBACK'); return res.status(403).json({ error: 'Not your territory' });
      }
      // Resolve the merged territory: a single shield item covers every claim
      // in the connected group, so player feedback matches what they see on
      // the map (one merged territory = one shield = one item consumed).
      let groupIds = [parseInt(claimId)];
      try {
        if (missionService && missionService.resolveClaimGroup) {
          const group = await missionService.resolveClaimGroup(w, parseInt(claimId));
          if (group && group.length) groupIds = group.map(g => g.id);
        }
      } catch (_e) { /* fall back to single claim */ }

      const hp = item.effect_value;
      const expiresAt = new Date(Date.now() + item.duration_hours * 3600000);
      // Remove old shields on every member, then re-shield each one
      await client.query('DELETE FROM pixel_shields WHERE claim_id = ANY($1::int[])', [groupIds]);
      for (const cid of groupIds) {
        await client.query(
          'INSERT INTO pixel_shields (claim_id, owner, shield_type, hp, max_hp, expires_at) VALUES ($1,$2,$3,$4,$5,$6)',
          [cid, w, item.code, hp, hp, expiresAt]
        );
      }
      effectResult = { shielded: true, hp, expiresAt, claimsShielded: groupIds.length };
    } else if (item.code === 'emp_strike') {
      if (!claimId) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'claimId required for EMP' }); }
      // EMP also nukes the entire merged target territory
      const tgtOwnerRes = await client.query('SELECT owner FROM claims WHERE id = $1', [claimId]);
      const tgtOwner = (tgtOwnerRes.rows[0]?.owner || '').toLowerCase();
      let groupIds = [parseInt(claimId)];
      try {
        if (missionService && missionService.resolveClaimGroup && tgtOwner) {
          const group = await missionService.resolveClaimGroup(tgtOwner, parseInt(claimId));
          if (group && group.length) groupIds = group.map(g => g.id);
        }
      } catch (_e) { /* fall back to single claim */ }
      await client.query('DELETE FROM pixel_shields WHERE claim_id = ANY($1::int[])', [groupIds]);
      effectResult = { empApplied: true, targetClaim: claimId, claimsHit: groupIds.length };
    } else if (item.code === 'attack_boost') {
      // +20% attack success for next 3 attacks (uses-based)
      const expiresAt = getUseEffectExpiry(item);
      await client.query(
        `UPDATE user_active_effects SET active = false WHERE wallet = $1 AND effect_type = 'attack_boost' AND active = true`, [w]
      );
      await client.query(
        `INSERT INTO user_active_effects (wallet, effect_type, effect_value, uses_remaining, expires_at, source_item_code)
         VALUES ($1, 'attack_boost', $2, 3, $3, $4)`,
        [w, item.effect_value, expiresAt, item.code]
      );
      effectResult = { applied: true, code: item.code, uses: 3, expiresAt, value: item.effect_value };
    } else if (item.code === 'pixel_doubler') {
      // 2x pixels on next claim (1 use)
      const expiresAt = getUseEffectExpiry(item);
      await client.query(
        `UPDATE user_active_effects SET active = false WHERE wallet = $1 AND effect_type = 'pixel_doubler' AND active = true`, [w]
      );
      await client.query(
        `INSERT INTO user_active_effects (wallet, effect_type, effect_value, uses_remaining, expires_at, source_item_code)
         VALUES ($1, 'pixel_doubler', 2, 1, $2, $3)`,
        [w, expiresAt, item.code]
      );
      effectResult = { applied: true, code: item.code, uses: 1, expiresAt, value: 2 };
    } else if (item.code === 'mining_boost') {
      // +mining speed for duration_hours (duration-based)
      const expiresAt = new Date(Date.now() + item.duration_hours * 3600000);
      await client.query(
        `UPDATE user_active_effects SET active = false WHERE wallet = $1 AND effect_type = 'mining_boost' AND active = true`, [w]
      );
      await client.query(
        `INSERT INTO user_active_effects (wallet, effect_type, effect_value, expires_at, source_item_code) VALUES ($1, 'mining_boost', $2, $3, $4)`,
        [w, item.effect_value, expiresAt, item.code]
      );
      effectResult = { applied: true, code: item.code, expiresAt, value: item.effect_value };
    } else if (item.code === 'stealth_cloak') {
      // Hide territory for duration_hours
      const expiresAt = new Date(Date.now() + item.duration_hours * 3600000);
      await client.query(
        `UPDATE user_active_effects SET active = false WHERE wallet = $1 AND effect_type = 'stealth_cloak' AND active = true`, [w]
      );
      await client.query(
        `INSERT INTO user_active_effects (wallet, effect_type, effect_value, expires_at, source_item_code) VALUES ($1, 'stealth_cloak', 1, $2, $3)`,
        [w, expiresAt, item.code]
      );
      effectResult = { applied: true, code: item.code, expiresAt };
    } else if (item.code === 'radar_scan') {
      // Instant effect — reveal nearby enemies (no active state needed)
      effectResult = { applied: true, code: item.code, instant: true };
    } else if (item.code === 'shield_regen') {
      // Regenerating shield — same as shield_basic but with regen properties
      if (!claimId) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'claimId required for shield' }); }
      const claimRes = await client.query('SELECT owner FROM claims WHERE id = $1', [claimId]);
      if (claimRes.rows.length === 0 || (claimRes.rows[0].owner || '').toLowerCase() !== w) {
        await client.query('ROLLBACK'); return res.status(403).json({ error: 'Not your territory' });
      }
      let groupIds = [parseInt(claimId)];
      try {
        if (missionService && missionService.resolveClaimGroup) {
          const group = await missionService.resolveClaimGroup(w, parseInt(claimId));
          if (group && group.length) groupIds = group.map(g => g.id);
        }
      } catch (_e) { /* fall back to single claim */ }
      const hp = item.effect_value;
      const expiresAt = new Date(Date.now() + item.duration_hours * 3600000);
      await client.query('DELETE FROM pixel_shields WHERE claim_id = ANY($1::int[])', [groupIds]);
      for (const cid of groupIds) {
        await client.query(
          'INSERT INTO pixel_shields (claim_id, owner, shield_type, hp, max_hp, expires_at) VALUES ($1,$2,$3,$4,$5,$6)',
          [cid, w, item.code, hp, hp, expiresAt]
        );
      }
      effectResult = { shielded: true, hp, expiresAt, claimsShielded: groupIds.length, regen: true };
    } else if (item.code === 'decoy_beacon') {
      // Decoy beacon — duration-based active effect (like stealth_cloak)
      if (!claimId) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'claimId required for decoy' }); }
      const claimRes = await client.query('SELECT owner FROM claims WHERE id = $1', [claimId]);
      if (claimRes.rows.length === 0 || (claimRes.rows[0].owner || '').toLowerCase() !== w) {
        await client.query('ROLLBACK'); return res.status(403).json({ error: 'Not your territory' });
      }
      const expiresAt = new Date(Date.now() + item.duration_hours * 3600000);
      await client.query(
        `UPDATE user_active_effects SET active = false WHERE wallet = $1 AND effect_type = 'decoy_beacon' AND active = true`, [w]
      );
      await client.query(
        `INSERT INTO user_active_effects (wallet, effect_type, effect_value, expires_at, source_item_code) VALUES ($1, 'decoy_beacon', 1, $2, $3)`,
        [w, expiresAt, item.code]
      );
      effectResult = { applied: true, code: item.code, expiresAt };
    } else if (item.code === 'orbital_strike') {
      // Orbital strike — guaranteed shield break on enemy territory
      if (!claimId) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'claimId required for orbital strike' }); }
      const tgtOwnerRes = await client.query('SELECT owner FROM claims WHERE id = $1', [claimId]);
      if (tgtOwnerRes.rows.length === 0) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Target claim not found' }); }
      const tgtOwner = (tgtOwnerRes.rows[0].owner || '').toLowerCase();
      if (tgtOwner === w) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'Cannot target your own territory' }); }
      let groupIds = [parseInt(claimId)];
      try {
        if (missionService && missionService.resolveClaimGroup && tgtOwner) {
          const group = await missionService.resolveClaimGroup(tgtOwner, parseInt(claimId));
          if (group && group.length) groupIds = group.map(g => g.id);
        }
      } catch (_e) { /* fall back to single claim */ }
      await client.query('DELETE FROM pixel_shields WHERE claim_id = ANY($1::int[])', [groupIds]);
      effectResult = { applied: true, code: item.code, targetClaim: claimId, claimsHit: groupIds.length };
    } else if (item.code === 'virus_payload') {
      // Virus payload — reduce target's mining rate by 50% for 6h
      if (!claimId) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'claimId required for virus payload' }); }
      const tgtOwnerRes = await client.query('SELECT owner FROM claims WHERE id = $1', [claimId]);
      if (tgtOwnerRes.rows.length === 0) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Target claim not found' }); }
      const tgtOwner = (tgtOwnerRes.rows[0].owner || '').toLowerCase();
      if (tgtOwner === w) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'Cannot target your own territory' }); }
      const expiresAt = new Date(Date.now() + item.duration_hours * 3600000);
      await client.query(
        `UPDATE user_active_effects SET active = false WHERE wallet = $1 AND effect_type = 'virus_payload' AND active = true`, [tgtOwner]
      );
      await client.query(
        `INSERT INTO user_active_effects (wallet, effect_type, effect_value, expires_at, source_item_code) VALUES ($1, 'virus_payload', $2, $3, $4)`,
        [tgtOwner, item.effect_value, expiresAt, item.code]
      );
      effectResult = { applied: true, code: item.code, targetClaim: claimId, expiresAt };
    } else if (item.code === 'siege_ram') {
      // Siege ram — +40% attack for next claim (1 use, like attack_boost)
      const expiresAt = getUseEffectExpiry(item);
      await client.query(
        `UPDATE user_active_effects SET active = false WHERE wallet = $1 AND effect_type = 'siege_ram' AND active = true`, [w]
      );
      await client.query(
        `INSERT INTO user_active_effects (wallet, effect_type, effect_value, uses_remaining, expires_at, source_item_code)
         VALUES ($1, 'siege_ram', $2, 1, $3, $4)`,
        [w, item.effect_value, expiresAt, item.code]
      );
      effectResult = { applied: true, code: item.code, uses: 1, expiresAt, value: item.effect_value };
    } else if (item.code === 'supply_crate') {
      // Supply crate — instant random PP grant
      const randomPP = +(Math.random() * 0.4 + 0.1).toFixed(4);
      // [v7.366] 미존재 컬럼 game_pp → pp_balance (supply_crate가 항상 런타임 에러였음)
      await client.query('UPDATE users SET pp_balance = pp_balance + $1 WHERE LOWER(wallet_address) = LOWER($2)', [randomPP, w]);
      effectResult = { applied: true, code: item.code, ppGained: randomPP };
    } else if (item.code === 'recall_beacon') {
      // Recall beacon — instantly complete oldest traveling mission
      // [v7.366] status 'in_transit'은 CHECK 미허용(allow: traveling) + UPDATE는 ORDER BY/LIMIT 불가 →
      //   서브쿼리로 가장 오래된 traveling 미션 1건만 갱신.
      const missionRes = await client.query(
        `UPDATE missions SET arrival_at = NOW()
          WHERE id = (SELECT id FROM missions WHERE wallet = $1 AND status = 'traveling' ORDER BY arrival_at ASC LIMIT 1)
          RETURNING id`,
        [w]
      );
      effectResult = { applied: true, code: item.code, missionRecalled: missionRes.rows.length > 0 };
    } else if (item.code === 'territory_scan') {
      // Territory scan — instant effect (like radar_scan)
      effectResult = { applied: true, code: item.code, instant: true };
    } else if (item.code === 'harvest_surge') {
      // Harvest surge — 3x PP on next harvest (1 use, like pixel_doubler)
      const expiresAt = getUseEffectExpiry(item);
      await client.query(
        `UPDATE user_active_effects SET active = false WHERE wallet = $1 AND effect_type = 'harvest_surge' AND active = true`, [w]
      );
      await client.query(
        `INSERT INTO user_active_effects (wallet, effect_type, effect_value, uses_remaining, expires_at, source_item_code)
         VALUES ($1, 'harvest_surge', $2, 1, $3, $4)`,
        [w, item.effect_value, expiresAt, item.code]
      );
      effectResult = { applied: true, code: item.code, uses: 1, expiresAt, value: item.effect_value };
    } else if (item.code === 'xp_amplifier') {
      // XP amplifier — 2x XP for 4h (duration-based, like mining_boost)
      const expiresAt = new Date(Date.now() + item.duration_hours * 3600000);
      await client.query(
        `UPDATE user_active_effects SET active = false WHERE wallet = $1 AND effect_type = 'xp_amplifier' AND active = true`, [w]
      );
      await client.query(
        `INSERT INTO user_active_effects (wallet, effect_type, effect_value, expires_at, source_item_code) VALUES ($1, 'xp_amplifier', $2, $3, $4)`,
        [w, item.effect_value, expiresAt, item.code]
      );
      effectResult = { applied: true, code: item.code, expiresAt, value: item.effect_value };
    } else if (item.code === 'gp_generator') {
      // GP generator — 5 GP/hr for 12h (duration-based, like mining_boost)
      const expiresAt = new Date(Date.now() + item.duration_hours * 3600000);
      await client.query(
        `UPDATE user_active_effects SET active = false WHERE wallet = $1 AND effect_type = 'gp_generator' AND active = true`, [w]
      );
      await client.query(
        `INSERT INTO user_active_effects (wallet, effect_type, effect_value, expires_at, source_item_code) VALUES ($1, 'gp_generator', $2, $3, $4)`,
        [w, item.effect_value, expiresAt, item.code]
      );
      effectResult = { applied: true, code: item.code, expiresAt, value: item.effect_value };
    } else if (item.code === 'lucky_charm') {
      // Lucky charm — +15% cantina win rate for 3h (duration-based)
      const expiresAt = new Date(Date.now() + item.duration_hours * 3600000);
      await client.query(
        `UPDATE user_active_effects SET active = false WHERE wallet = $1 AND effect_type = 'lucky_charm' AND active = true`, [w]
      );
      await client.query(
        `INSERT INTO user_active_effects (wallet, effect_type, effect_value, expires_at, source_item_code) VALUES ($1, 'lucky_charm', $2, $3, $4)`,
        [w, item.effect_value, expiresAt, item.code]
      );
      effectResult = { applied: true, code: item.code, expiresAt, value: item.effect_value };
    } else {
      effectResult = { applied: true, code: item.code };
    }

    // Log usage
    await client.query('INSERT INTO item_usage_log (wallet, item_type_id, claim_id) VALUES ($1,$2,$3)', [w, item.id, claimId || null]);

    // Season tracking: item used
    if (seasonService) {
      seasonService.addSeasonScore(w, 'item_use', 1).catch(() => {});
      if (item.code === 'shield_basic' || item.code === 'shield_advanced' || item.code === 'shield_regen') {
        seasonService.addSeasonScore(w, 'shield', 1).catch(() => {}); // fortifier
      }
    }

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

// GET /api/shop/active-effects — get authenticated user's active item effects
router.get('/shop/active-effects', requireAuth, readLimiter, async (req, res) => {
  const w = getAuthWallet(req);
  if (!w) return res.status(400).json({ error: 'wallet required' });
  try {
    await settleGpGenerators(w);
    // Auto-expire duration/uses based effects before returning UI state.
    await pool.query(
      `UPDATE user_active_effects
       SET active = false
       WHERE wallet = $1
         AND active = true
         AND (
           (expires_at IS NOT NULL AND expires_at <= NOW())
           OR (uses_remaining IS NOT NULL AND uses_remaining <= 0)
         )`, [w]
    );
    const result = await pool.query(
      `SELECT e.*, t.name, t.icon, t.code, t.price_pp FROM user_active_effects e
       LEFT JOIN item_types t ON t.code = COALESCE(e.source_item_code, e.effect_type)
       WHERE e.wallet = $1 AND e.active = true
         AND (e.expires_at IS NULL OR e.expires_at > NOW())
         AND (e.uses_remaining IS NULL OR e.uses_remaining > 0)
       ORDER BY e.activated_at DESC`, [w]
    );
    res.json(result.rows);
  } catch (e) {
    console.error('[SHOP] active-effects error:', e.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

// ══════════════════════════════════════
// ITEM INSTANCES & ENHANCEMENT
// ══════════════════════════════════════

// GET /api/items/instances — get authenticated user's materialized item instances
router.get('/items/instances', requireAuth, readLimiter, async (req, res) => {
  const wallet = getAuthWallet(req);
  if (!wallet) return res.status(400).json({ error: 'Wallet required' });
  try {
    if (!enhancementService) return res.status(503).json({ error: 'Enhancement service unavailable' });
    const instances = await enhancementService.getInstances(wallet);
    res.json(instances);
  } catch (e) {
    console.error('[ITEMS] instances error:', e.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

// POST /api/items/materialize — split 1 from stack into individual instance
router.post('/items/materialize', requireAuth, writeLimiter, async (req, res) => {
  const { itemTypeId } = req.body;
  const w = getAuthWallet(req);
  if (!w || !itemTypeId) return res.status(400).json({ error: 'Missing wallet or itemTypeId' });
  if (!enhancementService) return res.status(503).json({ error: 'Enhancement service unavailable' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await enhancementService.materializeItem(client, w, parseInt(itemTypeId));
    await client.query('COMMIT');
    res.json({ success: true, ...result });
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('[ITEMS] materialize error:', e.message);
    res.status(400).json({ error: e.message });
  } finally {
    client.release();
  }
});

// POST /api/items/dematerialize — return +0 instance back to stack
router.post('/items/dematerialize', requireAuth, writeLimiter, async (req, res) => {
  const { instanceId } = req.body;
  const w = getAuthWallet(req);
  if (!w || !instanceId) return res.status(400).json({ error: 'Missing wallet or instanceId' });
  if (!enhancementService) return res.status(503).json({ error: 'Enhancement service unavailable' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await enhancementService.dematerializeItem(client, w, parseInt(instanceId));
    await client.query('COMMIT');
    res.json({ success: true });
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('[ITEMS] dematerialize error:', e.message);
    res.status(400).json({ error: e.message });
  } finally {
    client.release();
  }
});

// GET /api/enhance/costs — enhancement cost table
router.get('/enhance/costs', readLimiter, async (req, res) => {
  try {
    if (!enhancementService) return res.status(503).json({ error: 'Enhancement service unavailable' });
    const costs = await enhancementService.getEnhancementCosts();
    res.json(costs);
  } catch (e) {
    console.error('[ENHANCE] costs error:', e.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

// GET /api/enhance/rates — enhancement success rates (may be hidden by setting)
router.get('/enhance/rates', readLimiter, async (req, res) => {
  try {
    if (!enhancementService) return res.status(503).json({ error: 'Enhancement service unavailable' });
    const rates = await enhancementService.getEnhancementRates();
    if (rates === null) return res.json({ hidden: true });
    res.json(rates);
  } catch (e) {
    console.error('[ENHANCE] rates error:', e.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

// POST /api/enhance — attempt enhancement on an item instance
// GET /api/enhance/info/:instanceId — 강화 전 정보 (레시피 + 주문서 현황)
router.get('/enhance/info/:instanceId', requireAuth, readLimiter, async (req, res) => {
  const wallet = getAuthWallet(req);
  if (!wallet) return res.status(400).json({ error: 'Wallet required' });
  if (!enhancementService) return res.status(503).json({ error: 'Enhancement service unavailable' });
  try {
    const { pool: db } = require('../db');
    const advEnhance = require('../services/enhancementAdvanced');
    const instRes = await db.query(
      'SELECT ii.enhancement_level, it.name FROM item_instances ii JOIN item_types it ON it.id = ii.item_type_id WHERE ii.id = $1 AND ii.wallet = $2',
      [parseInt(req.params.instanceId), wallet]
    );
    if (!instRes.rows.length) return res.status(404).json({ error: 'Instance not found' });
    const currentLevel = instRes.rows[0].enhancement_level;
    const [cost, available_recipes, scroll_status] = await Promise.all([
      enhancementService.getEnhancementCost(currentLevel),
      advEnhance.getAvailableRecipes(currentLevel),
      advEnhance.getScrollStatus(wallet),
    ]);
    res.json({ currentLevel, cost, available_recipes, scroll_status, item_name: instRes.rows[0].name });
  } catch (e) {
    console.error('[ENHANCE] info error:', e.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

router.post('/enhance', requireAuth, writeLimiter, async (req, res) => {
  const {
    instanceId,
    recipe_ids = [],
    use_protect_scroll = false,
    use_blessed_scroll = false,
  } = req.body;
  const w = getAuthWallet(req);
  if (!w || !instanceId) return res.status(400).json({ error: 'Missing wallet or instanceId' });
  if (!enhancementService) return res.status(503).json({ error: 'Enhancement service unavailable' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await enhancementService.enhanceItem(client, w, parseInt(instanceId), {
      recipeIds: Array.isArray(recipe_ids) ? recipe_ids.map(Number) : [],
      useProtectScroll: !!use_protect_scroll,
      useBlessedScroll: !!use_blessed_scroll,
    });
    await client.query('COMMIT');

    // Season tracking: GP spent on enhancement (non-blocking)
    if (seasonService) {
      seasonService.addSeasonScore(w, 'gp_spend', Math.round(result.cost)).catch(() => {});
    }
    // Achievement check: enhancement count + max level
    if (achSvc && result.success) {
      achSvc.checkAndUnlock(w, 'enhancement_count').catch(() => {});
      achSvc.checkAndUnlock(w, 'max_enhancement_level').catch(() => {});
    }

    res.json(result);
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('[ENHANCE] attempt error:', e.message);
    res.status(400).json({ error: e.message });
  } finally {
    client.release();
  }
});

// POST /api/shop/auto-renew — toggle auto-renewal for shield or active effect
router.post('/shop/auto-renew', requireAuth, writeLimiter, async (req, res) => {
  const { effectId, shieldId, enabled } = req.body;
  const w = getAuthWallet(req);
  if (!w) return res.status(400).json({ error: 'Missing wallet' });
  if (!effectId && !shieldId) return res.status(400).json({ error: 'Missing effectId or shieldId' });

  try {
    const autoRenew = enabled === true || enabled === 'true';

    if (shieldId) {
      // Toggle auto_renew on shield
      const result = await pool.query(
        'UPDATE pixel_shields SET auto_renew = $1 WHERE id = $2 AND owner = $3 RETURNING id',
        [autoRenew, shieldId, w]
      );
      if (!result.rows.length) return res.status(404).json({ error: 'Shield not found or not yours' });
    } else {
      // Toggle auto_renew on active effect
      const result = await pool.query(
        'UPDATE user_active_effects SET auto_renew = $1 WHERE id = $2 AND wallet = $3 RETURNING id',
        [autoRenew, effectId, w]
      );
      if (!result.rows.length) return res.status(404).json({ error: 'Effect not found or not yours' });
    }

    res.json({ success: true, autoRenew });
  } catch (e) {
    console.error('[MICRO] auto-renew toggle error:', e.message);
    res.status(500).json({ error: 'Failed to toggle auto-renew' });
  }
});

// ─────────────────────────────────────────────────────────────
// PROTECTION SCROLLS (Migration 089)
// ─────────────────────────────────────────────────────────────

// GET /api/items/scrolls
router.get('/items/scrolls', readLimiter, async (req, res) => {
  const wallet = getOptionalAuthWallet(req);
  try {
    // Scroll item definitions
    const scrollsRes = await pool.query(
      `SELECT id, code, name, description, price_gp, price_usdt, icon, effect_value
       FROM item_types WHERE code IN ('protect_scroll','blessed_scroll') AND active = true`
    );
    // User inventory quantities (if wallet provided)
    let inventory = {};
    if (wallet) {
      const invRes = await pool.query(
        `SELECT it.code, ui.quantity
         FROM user_items ui
         JOIN item_types it ON it.id = ui.item_type_id
         WHERE ui.wallet = $1 AND it.code IN ('protect_scroll','blessed_scroll')`,
        [wallet]
      );
      invRes.rows.forEach(r => { inventory[r.code] = parseInt(r.quantity) || 0; });
    }
    const scrolls = scrollsRes.rows.map(s => ({
      ...s,
      price_gp:   s.price_gp   ? parseFloat(s.price_gp)   : null,
      price_usdt: s.price_usdt ? parseFloat(s.price_usdt) : null,
      owned: inventory[s.code] || 0
    }));
    res.json({ scrolls });
  } catch (e) {
    console.error('[SCROLLS] GET error:', e.message);
    res.status(500).json({ error: 'internal_error' });
  }
});

module.exports = router;
