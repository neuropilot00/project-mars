const express = require('express');
const { makeRateLimiter } = require('../utils/rateLimiters');
const { pool } = require('../db');
const { requireAuth, getAuthWallet } = require('../utils/apiHelpers');

let titleService;
try { titleService = require('../services/title'); } catch (_e) { /* title service not available */ }

const router = express.Router();

const readLimiter = makeRateLimiter({
  windowMs: 60 * 1000, max: 120,
  message: { error: 'Too many requests. Please slow down.' }
});
const writeLimiter = makeRateLimiter({
  windowMs: 60 * 1000, max: 30,
  message: { error: 'Too many write requests. Please wait.' }
});

router.get('/user/titles', requireAuth, readLimiter, async (req, res) => {
  const wallet = getAuthWallet(req);
  if (!wallet) return res.status(400).json({ error: 'wallet_required' });
  try {
    if (!titleService) return res.json({ titles: [] });
    const titles = await titleService.getUserTitles(wallet);
    const equipped = titles.find(t => t.is_equipped) || null;
    res.json({ titles, equipped });
  } catch (e) {
    console.error('[TITLE] GET /user/titles error:', e.message);
    res.status(500).json({ error: 'internal_error' });
  }
});

router.post('/user/titles/equip', requireAuth, writeLimiter, async (req, res) => {
  const { titleCode } = req.body;
  const wallet = getAuthWallet(req);
  if (!wallet || !titleCode) return res.status(400).json({ error: 'missing_fields' });
  try {
    if (!titleService) return res.status(503).json({ error: 'title_service_unavailable' });
    const result = await titleService.equipTitle(wallet, titleCode);
    if (!result.success) return res.status(400).json(result);
    res.json(result);
  } catch (e) {
    console.error('[TITLE] POST /user/titles/equip error:', e.message);
    res.status(500).json({ error: 'internal_error' });
  }
});

router.get('/hall-of-fame', readLimiter, async (req, res) => {
  const category = req.query.category || null;
  const limit = Math.min(parseInt(req.query.limit ?? '50'), 100);
  try {
    if (!titleService) return res.json({ entries: [] });
    const entries = await titleService.getHallOfFame(category, limit);
    res.json({ entries });
  } catch (e) {
    console.error('[TITLE] GET /hall-of-fame error:', e.message);
    res.status(500).json({ error: 'internal_error' });
  }
});

router.get('/hall-of-fame/categories', readLimiter, async (_req, res) => {
  try {
    const result = await pool.query(
      'SELECT DISTINCT category, COUNT(*) AS cnt FROM hall_of_fame GROUP BY category ORDER BY category'
    );
    res.json({ categories: result.rows });
  } catch (_e) {
    res.status(500).json({ error: 'internal_error' });
  }
});

module.exports = router;
