const express = require('express');
const { makeRateLimiter } = require('../utils/rateLimiters');
const { pool } = require('../db');
const { requireAuth, getAuthWallet } = require('../utils/apiHelpers');
const { cfg } = require('../utils/settingsCache');

let seasonService;
try { seasonService = require('../services/season'); } catch (_e) { /* season service not available */ }

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

function getCosmeticType(itemCode) {
  if (itemCode.endsWith('_border')) return 'border';
  if (itemCode.endsWith('_glow') || itemCode === 'dark_aura') return 'glow';
  if (itemCode.endsWith('_terrain')) return 'terrain';
  return null;
}

router.post('/cosmetic/equip', requireAuth, writeLimiter, async (req, res) => {
  const { claimId, itemCode } = req.body;
  const wallet = getAuthWallet(req);
  if (!wallet || !claimId || !itemCode) return res.status(400).json({ error: 'Missing params' });

  const cosmeticType = getCosmeticType(itemCode);
  if (!cosmeticType) return res.status(400).json({ error: 'Not a cosmetic item' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const settings = await cfg();

    const claimRes = await client.query('SELECT owner FROM claims WHERE id = $1 AND deleted_at IS NULL', [claimId]);
    if (!claimRes.rows[0] || claimRes.rows[0].owner.toLowerCase() !== wallet) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Not your claim' });
    }

    const invRes = await client.query(
      `SELECT ui.id, ui.quantity, ui.item_type_id FROM user_items ui
       JOIN item_types it ON it.id = ui.item_type_id
       WHERE ui.wallet = $1 AND it.code = $2 AND ui.quantity > 0
       FOR UPDATE`,
      [wallet, itemCode]
    );
    if (!invRes.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'You don\'t own this cosmetic' });
    }

    const prevRes = await client.query(
      `SELECT cosmetic_code FROM user_cosmetics
        WHERE claim_id = $1 AND cosmetic_type = $2`,
      [claimId, cosmeticType]
    );
    const prevCode = prevRes.rows[0]?.cosmetic_code || null;

    if (prevCode && prevCode !== itemCode) {
      await client.query(
        `INSERT INTO user_items (wallet, item_type_id, quantity)
         SELECT $1, it.id, 1 FROM item_types it WHERE it.code = $2
         ON CONFLICT (wallet, item_type_id)
         DO UPDATE SET quantity = user_items.quantity + 1`,
        [wallet, prevCode]
      );
    }

    if (prevCode !== itemCode) {
      const deductCosmetic = await client.query(
        'UPDATE user_items SET quantity = quantity - 1 WHERE id = $1 AND quantity > 0',
        [invRes.rows[0].id]
      );
      if (deductCosmetic.rowCount === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'You don\'t own this cosmetic' });
      }
    }

    const equipFee = parseFloat(settings.cosmetic_equip_fee_pp) || 0;
    if (equipFee > 0) {
      const balRes = await client.query('SELECT pp_balance FROM users WHERE wallet_address = $1 FOR UPDATE', [wallet]);
      const ppBal = parseFloat(balRes.rows[0]?.pp_balance || 0);
      if (ppBal < equipFee) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: `Insufficient PP. Need ${equipFee} PP to equip cosmetic.` });
      }

      const deductEquip = await client.query(
        'UPDATE users SET pp_balance = pp_balance - $1 WHERE LOWER(wallet_address) = LOWER($2) AND pp_balance >= $1',
        [equipFee, wallet]
      );
      if (deductEquip.rowCount === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Insufficient balance (concurrent modification)' });
      }

      await client.query(
        `INSERT INTO transactions (type, from_wallet, pp_amount, fee, meta)
         VALUES ('shop_purchase', $1, $2, 0, $3)`,
        [wallet, equipFee, JSON.stringify({ action: 'cosmetic_equip', itemCode, claimId })]
      );
    }

    await client.query(
      `INSERT INTO user_cosmetics (wallet, claim_id, cosmetic_type, cosmetic_code)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (claim_id, cosmetic_type) DO UPDATE SET cosmetic_code = $4, wallet = $1, equipped_at = NOW()`,
      [wallet, claimId, cosmeticType, itemCode]
    );

    await client.query('COMMIT');
    res.json({ success: true, cosmeticType, cosmeticCode: itemCode, feePP: equipFee });

    try {
      const dailyService = require('../services/daily');
      dailyService.updateMissionProgress(wallet, 'equip_cosmetic', 1);
    } catch (_err) {
      // Best-effort daily progress.
    }
    if (seasonService) {
      seasonService.addSeasonScore(wallet, 'cosmetic', 1).catch(() => {});
      if (equipFee > 0) seasonService.addSeasonScore(wallet, 'pp_spend', 1).catch(() => {});
    }
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[COSMETIC] equip error:', err.message);
    res.status(500).json({ error: 'Equip failed' });
  } finally {
    client.release();
  }
});

router.post('/cosmetic/unequip', requireAuth, writeLimiter, async (req, res) => {
  const { claimId, cosmeticType } = req.body;
  const wallet = getAuthWallet(req);
  if (!wallet || !claimId || !cosmeticType) return res.status(400).json({ error: 'Missing params' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(
      'DELETE FROM user_cosmetics WHERE wallet = $1 AND claim_id = $2 AND cosmetic_type = $3 RETURNING cosmetic_code',
      [wallet, claimId, cosmeticType]
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
      [wallet, code]
    );

    await client.query('COMMIT');
    res.json({ success: true, refundedItem: code });
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch (_) {}
    console.error('[COSMETIC] unequip error:', err.message);
    res.status(500).json({ error: 'Unequip failed' });
  } finally {
    client.release();
  }
});

router.get('/cosmetic/equipped', requireAuth, readLimiter, async (req, res) => {
  const wallet = getAuthWallet(req);
  if (!wallet) return res.status(401).json({ error: 'Auth required' });

  try {
    const result = await pool.query(
      'SELECT claim_id, cosmetic_type, cosmetic_code, equipped_at FROM user_cosmetics WHERE wallet = $1 ORDER BY equipped_at DESC',
      [wallet]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('[COSMETIC] equipped error:', err.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

module.exports = router;
