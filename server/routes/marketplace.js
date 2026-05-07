const express = require('express');
const rateLimit = require('express-rate-limit');
const { pool, getSetting } = require('../db');

const router = express.Router();

let marketService;
try { marketService = require('../services/marketplace'); } catch (_e) {}
let seasonService;
try { seasonService = require('../services/season'); } catch (_e) {}
let achSvc;
try { achSvc = require('../services/achievements'); } catch (_e) {}
let newsSvc;
try { newsSvc = require('../services/news'); } catch (_e) {}
let weeklySvc;
try { weeklySvc = require('../services/weeklyChallenges'); } catch (_e) {}

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
    const listingId = parseInt(req.params.id, 10);
    if (!Number.isInteger(listingId)) return res.status(400).json({ error: 'Invalid listing id' });
    const listing = await marketService.getListingDetail(listingId);
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
    // Achievement check: first listing
    if (achSvc) achSvc.checkAndUnlock(w, 'marketplace_sell_count').catch(() => {});

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
  const parsedListingId = parseInt(listingId, 10);
  if (!Number.isInteger(parsedListingId)) return res.status(400).json({ error: 'Invalid listing id' });
  if (!marketService) return res.status(503).json({ error: 'Marketplace service unavailable' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await marketService.cancelListing(client, parsedListingId, w);
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
  const parsedListingId = parseInt(listingId, 10);
  if (!Number.isInteger(parsedListingId)) return res.status(400).json({ error: 'Invalid listing id' });
  if (!marketService) return res.status(503).json({ error: 'Marketplace service unavailable' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await marketService.buyListing(client, parsedListingId, w);
    await client.query('COMMIT');

    // Season tracking
    if (seasonService) {
      const spent = Math.round(result.price);
      if (result.currency === 'GP') seasonService.addSeasonScore(w, 'gp_spend', spent).catch(() => {});
      else seasonService.addSeasonScore(w, 'pp_spend', 1).catch(() => {});
    }

    res.json({ success: true, price: result.price, fee: result.fee, currency: result.currency });
    // Achievement check: marketplace purchase + gp balance
    if (achSvc) {
      achSvc.checkAndUnlock(w, 'marketplace_buy_count').catch(() => {});
      achSvc.checkAndUnlock(w, 'gp_balance').catch(() => {});
    }
    // Weekly challenge: marketplace buy
    if (weeklySvc) { weeklySvc.trackProgress(w, 'marketplace_buy', 1).catch(() => {}); }
    // News: big marketplace sale
    if (newsSvc && result.currency === 'GP') {
      const itemName = result.itemName || result.name || 'item';
      newsSvc.onMarketSale(result.seller || '', w, itemName, result.price, result.currency).catch(() => {});
    }
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

// GET /api/marketplace/price-stats — sparkline + summary stats (Migration 103)
// Query params: itemTypeId (+ enhLevel) OR claimId
router.get('/price-stats', readLimiter, async (req, res) => {
  const itemTypeId = parseInt(req.query.itemTypeId) || null;
  const claimId    = parseInt(req.query.claimId)    || null;
  const enhLevel   = parseInt(req.query.enhLevel)   || 0;
  const points     = Math.min(50, parseInt(req.query.points) || 20);

  if (!itemTypeId && !claimId)
    return res.status(400).json({ error: 'itemTypeId or claimId required' });

  // ✅ [Job] Merchant 가격 히스토리 기간 확장 (merchant_price_history_days = 60일)
  const wallet = (req.headers['x-wallet'] || req.query.wallet || '').toLowerCase().trim();
  let historyDays = 30; // 기본 30일
  try {
    const jobSvc = require('../services/job');
    if (wallet && jobSvc) {
      const merchantDays = await jobSvc.getJobBuff(wallet, 'merchant_price_history_days', 0);
      if (merchantDays > 0) historyDays = merchantDays;
    }
  } catch (_) {}

  try {
    let where, params;
    if (claimId) {
      where  = 'claim_id = $1';
      params = [claimId];
    } else {
      where  = 'item_type_id = $1 AND enhancement_level = $2';
      params = [itemTypeId, enhLevel];
    }

    // ✅ [Job] Merchant market_insight: 최근 10건 상세 거래내역 (seller, buyer, 가격)
    let hasMerchantInsight = false;
    try {
      const jobSvc = require('../services/job');
      if (wallet && jobSvc) {
        const insight = await jobSvc.getJobBuff(wallet, 'merchant_market_insight', 0);
        if (insight > 0) hasMerchantInsight = true;
      }
    } catch (_) {}

    const queries = [
      pool.query(
        `SELECT COUNT(*) AS cnt,
                AVG(sale_price) AS avg_price,
                MIN(sale_price) AS min_price,
                MAX(sale_price) AS max_price,
                AVG(sale_price) FILTER (WHERE sold_at >= NOW() - INTERVAL '7 days') AS avg_7d
           FROM marketplace_price_history WHERE ${where}
             AND sold_at >= NOW() - ($${params.length + 1} || ' days')::INTERVAL`,
        [...params, historyDays]
      ),
      pool.query(
        `SELECT sale_price, currency, sold_at
           FROM marketplace_price_history WHERE ${where}
             AND sold_at >= NOW() - ($${params.length + 1} || ' days')::INTERVAL
          ORDER BY sold_at DESC LIMIT $${params.length + 2}`,
        [...params, historyDays, points]
      ),
    ];

    // Merchant insight: fetch recent 10 full trade records
    if (hasMerchantInsight) {
      queries.push(pool.query(
        `SELECT mph.sale_price, mph.currency, mph.sold_at,
                ml.seller, ml.buyer
           FROM marketplace_price_history mph
           LEFT JOIN marketplace_listings ml
             ON ml.item_type_id = mph.item_type_id
            AND ml.status = 'sold'
            AND ml.sold_at = mph.sold_at
         WHERE mph.${where.replace(/\$1/g, '$1').replace(/\$2/g, '$2')}
         ORDER BY mph.sold_at DESC LIMIT 10`,
        params
      ).catch(() => null));
    }

    const results = await Promise.all(queries);
    const [statsRes, recentRes, insightRes] = results;

    const s = statsRes.rows[0] || {};
    const recent = recentRes.rows.reverse(); // oldest→newest for chart

    const response = {
      count:    parseInt(s.cnt)           || 0,
      avg:      parseFloat(s.avg_price)   || 0,
      min:      parseFloat(s.min_price)   || 0,
      max:      parseFloat(s.max_price)   || 0,
      avg7d:    parseFloat(s.avg_7d)      || 0,
      points:   recent.map(r => ({ price: parseFloat(r.sale_price), currency: r.currency, t: r.sold_at })),
    };

    // Attach merchant insight data if available
    if (hasMerchantInsight && insightRes && insightRes.rows) {
      response.recentTrades = insightRes.rows.map(r => ({
        price:    parseFloat(r.sale_price),
        currency: r.currency,
        t:        r.sold_at,
        seller:   r.seller || null,
        buyer:    r.buyer  || null,
      }));
    }

    res.json(response);
  } catch (e) {
    console.error('[MARKET] price-stats error:', e.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

module.exports = router;
