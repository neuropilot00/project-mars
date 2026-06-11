const express = require('express');
const { makeRateLimiter } = require('../utils/rateLimiters');
const { pool, getActiveEvents } = require('../db');
const { requireAuth, getAuthWallet } = require('../utils/apiHelpers');
const { cfg, getDepositBonusPercent } = require('../utils/settingsCache');

const router = express.Router();

const readLimiter = makeRateLimiter({
  windowMs: 60 * 1000,
  max: 120,
  message: { error: 'Too many requests. Please slow down.' },
});

router.get('/public/swap-info', async (_req, res) => {
  try {
    const settings = await cfg();
    res.json({
      fee_percent: parseFloat(settings.swap_fee_percent) || 5,
      guard_enabled: String(settings.swap_solvency_guard_enabled || 'true').toLowerCase() === 'true',
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/wallet/deposit-bonus-info', requireAuth, async (req, res) => {
  try {
    const wallet = getAuthWallet(req).toLowerCase();
    const basePct = await getDepositBonusPercent();
    let firstPct = 0;
    let eligible = false;

    try {
      const result = await pool.query("SELECT value FROM settings WHERE key='first_deposit_bonus_pct'");
      firstPct = parseFloat(String(result.rows[0]?.value || '0').replace(/"/g, '')) || 0;
    } catch (_) {}

    if (firstPct > 0) {
      try {
        const prior = await pool.query('SELECT 1 FROM deposits WHERE LOWER(wallet_address) = LOWER($1) LIMIT 1', [wallet]);
        eligible = prior.rows.length === 0;
      } catch (_) {}
    }

    res.json({
      base_bonus_pct: basePct,
      first_deposit_bonus_pct: firstPct,
      first_deposit_eligible: eligible,
      total_bonus_pct_if_first: basePct + (eligible ? firstPct : 0),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/config', readLimiter, async (_req, res) => {
  try {
    const settings = await cfg();
    const events = await getActiveEvents();
    const bonusPct = await getDepositBonusPercent();

    let govData = { commander: null, commanderAnnouncement: '', activeGovEvents: [], activeBounties: 0 };
    try {
      const { getActiveGovEvents, getCommanderInfo } = require('../services/governance');
      const govEvents = await getActiveGovEvents();
      const cmdInfo = await getCommanderInfo();
      govData = {
        commander: cmdInfo.commander,
        commanderAnnouncement: cmdInfo.announcement,
        activeGovEvents: govEvents.map((event) => ({ type: event.event_type, endsAt: event.ends_at })),
        activeBounties: (cmdInfo.activeBounties || []).length,
      };
    } catch (err) {
      console.warn('[GOV] config governance data failed:', err.message);
    }

    res.json({
      pixelBasePrice: settings.pixel_base_price || 0.1,
      sectorPrices: {
        core: settings.price_pixel_core || 0.15,
        mid: settings.price_pixel_mid || 0.05,
        frontier: settings.price_pixel_frontier || 0.02,
      },
      hijackMultiplier: settings.hijack_multiplier || 1.2,
      depositPPBonus: bonusPct,
      swapFeePercent: settings.swap_fee_percent || 5,
      withdrawFeePercent: settings.withdraw_fee_percent || 0,
      minDeposit: settings.min_deposit || 1,
      maxDeposit: settings.max_deposit || 100000,
      maxClaimWidth: settings.max_claim_width || 500,
      maxClaimHeight: settings.max_claim_height || 500,
      minWithdraw: Number(settings.withdraw_min_amount ?? settings.min_withdraw ?? 10),
      announcement: settings.announcement || '',
      maintenanceMode: settings.maintenance_mode || false,
      activeEvents: events.map((event) => ({
        id: event.id,
        name: event.name,
        type: event.type,
        config: event.config,
        startsAt: event.starts_at,
        endsAt: event.ends_at,
      })),
      governance: govData,
      telegram_group_url: settings.telegram_group_url || '',
    });
  } catch (err) {
    console.error('[API] config error:', err.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

module.exports = router;
