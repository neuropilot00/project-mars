'use strict';
const express = require('express');
const router  = express.Router();
const rentalSvc = require('../services/rental');
const jwt = require('jsonwebtoken');

let logGPActivity, seasonService, weeklySvc;
try { ({ logGPActivity } = require('../db')); } catch (_) {}
try { seasonService = require('../services/season'); } catch (_) {}
// weeklySvc intentionally not available (service removed)

// ✅ [v7.47] JWT 인증 미들웨어
const requireAuth = (req, res, next) => {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'UNAUTHORIZED' });
  try { req.user = jwt.verify(token, process.env.JWT_SECRET); next(); }
  catch { return res.status(401).json({ error: 'INVALID_TOKEN' }); }
};
function getAuthWallet(req) {
  return (req.user?.wallet_address || req.user?.wallet || req.user?.walletAddress || '').toLowerCase().trim();
}

// GET /api/rental/listings?status=listed
router.get('/rental/listings', async (req, res) => {
  try {
    res.json(await rentalSvc.getListings({ status: req.query.status || null }));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/rental/my
router.get('/rental/my', requireAuth, async (req, res) => {
  try {
    const wallet = getAuthWallet(req);
    if (!wallet) return res.status(400).json({ error: 'wallet required' });
    res.json(await rentalSvc.getMyRentals(wallet));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/rental/settings
router.get('/rental/settings', async (req, res) => {
  try { res.json(await rentalSvc.getSettings()); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/rental/list — owner lists a claim for rent
// { claimId, gpPerPeriod, periodHours, boostPct }
router.post('/rental/list', requireAuth, async (req, res) => {
  const wallet = getAuthWallet(req);
  const { claimId, gpPerPeriod, periodHours, boostPct } = req.body || {};
  if (!wallet || !claimId || !gpPerPeriod || !periodHours) {
    return res.status(400).json({ error: 'wallet, claimId, gpPerPeriod, periodHours required' });
  }
  try {
    const listing = await rentalSvc.listForRent(
      wallet, parseInt(claimId, 10),
      parseFloat(gpPerPeriod), parseInt(periodHours, 10),
      boostPct ? parseInt(boostPct, 10) : undefined
    );
    res.json(listing);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// POST /api/rental/rent — tenant rents a listed claim
// { rentalId, periods }
router.post('/rental/rent', requireAuth, async (req, res) => {
  const wallet = getAuthWallet(req);
  const { rentalId, periods } = req.body || {};
  if (!wallet || !rentalId || !periods) {
    return res.status(400).json({ error: 'wallet, rentalId, periods required' });
  }
  try {
    const result = await rentalSvc.rentClaim(
      wallet, parseInt(rentalId, 10), parseInt(periods, 10));

    // Side effects
    const gpPaid = Number(result.totalGp);
    if (logGPActivity) {
      logGPActivity(wallet.toLowerCase(), -gpPaid, 'rental_payment',
        `Rented claim #${result.claimId} for ${periods} period(s)`).catch(() => {});
    }
    if (seasonService && seasonService.trackGPSpend) {
      seasonService.trackGPSpend(wallet.toLowerCase(), gpPaid).catch(() => {});
    }

    res.json(result);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// POST /api/rental/cancel — owner cancels unlisted listing
// { rentalId }
router.post('/rental/cancel', requireAuth, async (req, res) => {
  const wallet = getAuthWallet(req);
  const { rentalId } = req.body || {};
  if (!wallet || !rentalId) return res.status(400).json({ error: 'wallet and rentalId required' });
  try {
    res.json(await rentalSvc.cancelListing(wallet, parseInt(rentalId, 10)));
  } catch (e) { res.status(400).json({ error: e.message }); }
});

module.exports = router;
