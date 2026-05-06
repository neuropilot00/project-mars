'use strict';
const express = require('express');
const router  = express.Router();
const rentalSvc = require('../services/rental');

let logGPActivity, seasonService, weeklySvc;
try { ({ logGPActivity } = require('../db')); } catch (_) {}
try { seasonService = require('../services/season'); } catch (_) {}
// weeklySvc intentionally not available (service removed)

// GET /api/rental/listings?status=listed
router.get('/rental/listings', async (req, res) => {
  try {
    res.json(await rentalSvc.getListings({ status: req.query.status || null }));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/rental/my?wallet=
router.get('/rental/my', async (req, res) => {
  try {
    const { wallet } = req.query;
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
// { wallet, claimId, gpPerPeriod, periodHours, boostPct }
router.post('/rental/list', async (req, res) => {
  const { wallet, claimId, gpPerPeriod, periodHours, boostPct } = req.body || {};
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
// { wallet, rentalId, periods }
router.post('/rental/rent', async (req, res) => {
  const { wallet, rentalId, periods } = req.body || {};
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
    if (weeklySvc && weeklySvc.trackProgress) {
      weeklySvc.trackProgress(wallet.toLowerCase(), 'gp_burn', gpPaid).catch(() => {});
    }

    res.json(result);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// POST /api/rental/cancel — owner cancels unlisted listing
// { wallet, rentalId }
router.post('/rental/cancel', async (req, res) => {
  const { wallet, rentalId } = req.body || {};
  if (!wallet || !rentalId) return res.status(400).json({ error: 'wallet and rentalId required' });
  try {
    res.json(await rentalSvc.cancelListing(wallet, parseInt(rentalId, 10)));
  } catch (e) { res.status(400).json({ error: e.message }); }
});

module.exports = router;
