'use strict';
/**
 * GP Bounty Board Routes — Migration 113
 */

const express = require('express');
const router  = express.Router();
const { pool } = require('../db');

let bountySvc;
try { bountySvc = require('../services/bounty'); } catch (_) {}

let logGPActivity;
try { logGPActivity = require('../db').logGPActivity; } catch (_) {}

// ── GET /api/bounties?limit=&target= ─────────────────────────────────────────
router.get('/bounties', async (req, res) => {
  try {
    if (!bountySvc) return res.status(503).json({ error: 'Service unavailable' });
    const limit  = Math.min(parseInt(req.query.limit) || 50, 100);
    const target = req.query.target || null;
    const bounties = await bountySvc.getActiveBounties(limit, target);
    res.json({ bounties });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/bounties/my-bounties?wallet= ────────────────────────────────────
router.get('/bounties/my-bounties', async (req, res) => {
  try {
    if (!bountySvc) return res.status(503).json({ error: 'Service unavailable' });
    const { wallet } = req.query;
    if (!wallet) return res.status(400).json({ error: 'wallet required' });
    const bounties = await bountySvc.getMyBounties(wallet);
    res.json({ bounties });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/bounties/on-me?wallet= ──────────────────────────────────────────
router.get('/bounties/on-me', async (req, res) => {
  try {
    if (!bountySvc) return res.status(503).json({ error: 'Service unavailable' });
    const { wallet } = req.query;
    if (!wallet) return res.status(400).json({ error: 'wallet required' });
    const bounties = await bountySvc.getBountiesOnMe(wallet);
    res.json({ bounties });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/bounties/post ───────────────────────────────────────────────────
router.post('/bounties/post', async (req, res) => {
  if (!bountySvc) return res.status(503).json({ error: 'Service unavailable' });
  const { wallet, targetWallet, gpAmount, message, claimId } = req.body;
  if (!wallet || !targetWallet || !gpAmount) {
    return res.status(400).json({ error: 'wallet, targetWallet, gpAmount required' });
  }
  const amount = parseFloat(gpAmount);
  if (isNaN(amount) || amount <= 0) return res.status(400).json({ error: 'Invalid gpAmount' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const bounty = await bountySvc.postBounty(
      client, wallet, targetWallet, amount, message, claimId ? parseInt(claimId) : null
    );
    await client.query('COMMIT');

    const w = wallet.toLowerCase();
    if (logGPActivity) logGPActivity(w, -amount, 'bounty_post', { bountyId: bounty.id, target: targetWallet }).catch(() => {});

    res.json({ ok: true, bounty });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(400).json({ error: err.message });
  } finally {
    client.release();
  }
});

// ── POST /api/bounties/cancel ─────────────────────────────────────────────────
router.post('/bounties/cancel', async (req, res) => {
  if (!bountySvc) return res.status(503).json({ error: 'Service unavailable' });
  const { wallet, bountyId } = req.body;
  if (!wallet || !bountyId) return res.status(400).json({ error: 'wallet, bountyId required' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { refund, fee } = await bountySvc.cancelBounty(client, wallet, parseInt(bountyId));
    await client.query('COMMIT');

    const w = wallet.toLowerCase();
    if (logGPActivity) logGPActivity(w, refund, 'bounty_cancel_refund', { bountyId, fee }).catch(() => {});

    res.json({ ok: true, refund, fee });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(400).json({ error: err.message });
  } finally {
    client.release();
  }
});

module.exports = router;
