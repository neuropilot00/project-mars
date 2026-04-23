const express = require('express');
const rateLimit = require('express-rate-limit');
const { pool, getSetting } = require('../db');

const router = express.Router();

let marketService;
try { marketService = require('../services/marketplace'); } catch (_e) {}
let seasonService;
try { seasonService = require('../services/season'); } catch (_e) {}

const isDev = process.env.NODE_ENV !== 'production';
const readLimiter = rateLimit({ windowMs: 60 * 1000, max: isDev ? 600 : 120, message: { error: 'Too many requests' } });
const writeLimiter = rateLimit({ windowMs: 60 * 1000, max: isDev ? 300 : 30, message: { error: 'Too many requests' } });

// GET /api/marketplace/listings — browse active listings
router.get('/listings', readLimiter, async (req, res) => {
  try {
    if (!marketService) return res.status(503).json({ error: 'Marketplace service unavailable' });
    const result = await marketService.getListings({
      type: req.query.type,
      currency: req.query.currency,
      minPrice: req.query.minPrice,
      maxPrice: req.query.maxPrice,
      search: req.query.search,
      sort: req.query.sort,
      limit: req.query.limit,
      offset: req.query.offset
    });
    res.json(result);
  } catch (e) {
    console.error('[MARKET] listings error:', e.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

// GET /api/marketplace/listings/:id — single listing detail
router.get('/listings/:id', readLimiter, async (req, res) => {
  try {
    if (!marketService) return res.status(503).json({ error: 'Marketplace service unavailable' });
    const listing = await marketService.getListingDetail(parseInt(req.params.id));
    if (!listing) return res.status(404).json({ error: 'Listing not found' });
    res.json(listing);
  } catch (e) {
    console.error('[MARKET] detail error:', e.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

// POST /api/marketplace/list — create a new listing
router.post('/list', writeLimiter, async (req, res) => {
  const { wallet, type, price, currency, instanceId, claimId } = req.body;
  const w = (wallet || '').toLowerCase();
  if (!w || !type || !price) return res.status(400).json({ error: 'Missing required fields' });
  if (!marketService) return res.status(503).json({ error: 'Marketplace service unavailable' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const listing = await marketService.createListing(client, w, type, { price, currency, instanceId, claimId });
    await client.query('COMMIT');

    // Season tracking
    if (seasonService) seasonService.addSeasonScore(w, 'gp_spend', 1).catch(() => {});

    res.json({ success: true, listing });
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('[MARKET] list error:', e.message);
    res.status(400).json({ error: e.message });
  } finally {
    client.release();
  }
});

// POST /api/marketplace/cancel — cancel own listing
router.post('/cancel', writeLimiter, async (req, res) => {
  const { wallet, listingId } = req.body;
  const w = (wallet || '').toLowerCase();
  if (!w || !listingId) return res.status(400).json({ error: 'Missing required fields' });
  if (!marketService) return res.status(503).json({ error: 'Marketplace service unavailable' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await marketService.cancelListing(client, parseInt(listingId), w);
    await client.query('COMMIT');
    res.json({ success: true });
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('[MARKET] cancel error:', e.message);
    res.status(400).json({ error: e.message });
  } finally {
    client.release();
  }
});

// POST /api/marketplace/buy — instant purchase
router.post('/buy', writeLimiter, async (req, res) => {
  const { wallet, listingId } = req.body;
  const w = (wallet || '').toLowerCase();
  if (!w || !listingId) return res.status(400).json({ error: 'Missing required fields' });
  if (!marketService) return res.status(503).json({ error: 'Marketplace service unavailable' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await marketService.buyListing(client, parseInt(listingId), w);
    await client.query('COMMIT');

    // Season tracking
    if (seasonService) {
      const spent = Math.round(result.price);
      if (result.currency === 'GP') seasonService.addSeasonScore(w, 'gp_spend', spent).catch(() => {});
      else seasonService.addSeasonScore(w, 'pp_spend', 1).catch(() => {});
    }

    res.json({ success: true, price: result.price, fee: result.fee, currency: result.currency });
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('[MARKET] buy error:', e.message);
    res.status(400).json({ error: e.message });
  } finally {
    client.release();
  }
});

// GET /api/marketplace/my-listings — user's own listings
router.get('/my-listings', readLimiter, async (req, res) => {
  const wallet = (req.query.wallet || '').toLowerCase();
  if (!wallet) return res.status(400).json({ error: 'Wallet required' });
  try {
    if (!marketService) return res.status(503).json({ error: 'Marketplace service unavailable' });
    const listings = await marketService.getMyListings(wallet);
    res.json(listings);
  } catch (e) {
    console.error('[MARKET] my-listings error:', e.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

// GET /api/marketplace/recent-sales — recent completed sales
router.get('/recent-sales', readLimiter, async (req, res) => {
  try {
    if (!marketService) return res.status(503).json({ error: 'Marketplace service unavailable' });
    const sales = await marketService.getRecentSales(parseInt(req.query.limit) || 20);
    res.json(sales);
  } catch (e) {
    console.error('[MARKET] recent-sales error:', e.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

// GET /api/marketplace/history — price history for an item type
router.get('/history', readLimiter, async (req, res) => {
  const itemTypeId = parseInt(req.query.itemTypeId);
  const enhLevel = parseInt(req.query.enhancementLevel) || 0;
  if (!itemTypeId) return res.status(400).json({ error: 'itemTypeId required' });
  try {
    if (!marketService) return res.status(503).json({ error: 'Marketplace service unavailable' });
    const history = await marketService.getPriceHistory(itemTypeId, enhLevel);
    res.json(history);
  } catch (e) {
    console.error('[MARKET] history error:', e.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

module.exports = router;
