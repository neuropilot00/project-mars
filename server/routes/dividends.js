'use strict';
const express   = require('express');
const rateLimit = require('express-rate-limit');
const jwt       = require('jsonwebtoken');
const router    = express.Router();

let divSvc;
try { divSvc = require('../services/dividends'); } catch (_e) {}

const isDev = process.env.NODE_ENV !== 'production';
const readLimiter = rateLimit({ windowMs: 60 * 1000, max: isDev ? 300 : 60, message: { error: 'Too many requests' } });

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

// GET /api/dividends/info — current pool + history for wallet
router.get('/dividends/info', readLimiter, async (req, res) => {
  const wallet = getOptionalAuthWallet(req);
  try {
    if (!divSvc) return res.status(503).json({ error: 'Dividend service unavailable' });
    const info = await divSvc.getDividendInfo(wallet || null);
    res.json(info);
  } catch (e) {
    console.error('[DIV] info error:', e.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

module.exports = router;
