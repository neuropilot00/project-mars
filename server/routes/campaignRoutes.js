const express = require('express');
const { makeRateLimiter } = require('../utils/rateLimiters');
const { pool } = require('../db');
const {
  requireAuth,
  getAuthWallet,
  sanitize,
  isInternalRequest
} = require('../utils/apiHelpers');

let campaignService;
try { campaignService = require('../services/campaign'); } catch (_e) { /* campaign service not available */ }

const router = express.Router();

const readLimiter = makeRateLimiter({
  windowMs: 60 * 1000, max: 120,
  message: { error: 'Too many requests. Please slow down.' }
});
const writeLimiter = makeRateLimiter({
  windowMs: 60 * 1000, max: 30,
  message: { error: 'Too many write requests. Please wait.' }
});

router.get('/campaign/editor-layout', async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store, max-age=0');
    const r = await pool.query("SELECT value FROM settings WHERE key = 'campaign_editor_layout'");
    res.json(r.rows[0]?.value || {});
  } catch (e) {
    res.set('Cache-Control', 'no-store, max-age=0');
    res.json({});
  }
});

router.post('/campaign/editor-layout', writeLimiter, async (req, res) => {
  try {
    if (!isInternalRequest(req)) return res.status(403).json({ error: 'forbidden' });
    const payload = req.body;
    if (!payload || typeof payload !== 'object') return res.status(400).json({ error: 'invalid payload' });
    await pool.query(
      "INSERT INTO settings (category, key, value, description) VALUES ('campaign', 'campaign_editor_layout', $1::jsonb, 'Campaign scene editor layout') ON CONFLICT (key) DO UPDATE SET value = $1::jsonb",
      [JSON.stringify(payload)]
    );
    res.json({ ok: true });
  } catch (e) {
    console.error('[campaign-editor-layout] save error:', e.message);
    res.status(500).json({ error: 'save_failed' });
  }
});

router.get('/campaign/status/:wallet', readLimiter, async (req, res) => {
  try {
    if (!campaignService) return res.status(503).json({ error: 'Campaign service unavailable' });
    const wallet = sanitize(req.params.wallet, 255).toLowerCase();
    if (!wallet || wallet.length < 10) return res.status(400).json({ error: 'wallet required' });
    res.json(await campaignService.getStatus(wallet));
  } catch (e) {
    console.error('[CAMPAIGN] status error:', e.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

router.post('/campaign/start', requireAuth, writeLimiter, async (req, res) => {
  try {
    if (!campaignService) return res.status(503).json({ error: 'Campaign service unavailable' });
    const wallet = getAuthWallet(req);
    const questId = sanitize(req.body.quest_id || 'mcc_campaign_ch1', 80);
    if (!wallet || wallet.length < 10) return res.status(400).json({ error: 'wallet required' });
    const result = await campaignService.startChapter(wallet, questId);
    if (result.error) return res.status(400).json(result);
    res.json(result);
  } catch (e) {
    console.error('[CAMPAIGN] start error:', e && e.stack || e && e.message || e);
    res.status(500).json({ error: 'Internal error' });
  }
});

router.post('/campaign/choice', requireAuth, writeLimiter, async (req, res) => {
  try {
    if (!campaignService) return res.status(503).json({ error: 'Campaign service unavailable' });
    const wallet = getAuthWallet(req);
    const sessionId = sanitize(req.body.session_id || req.body.sessionId, 100);
    const choiceId = sanitize(req.body.choice_id || req.body.choiceId, 100);
    if (!wallet || wallet.length < 10 || !sessionId || !choiceId) return res.status(400).json({ error: 'missing fields' });
    const result = await campaignService.choose(wallet, sessionId, choiceId);
    if (result.error) return res.status(400).json(result);
    res.json(result);
  } catch (e) {
    console.error('[CAMPAIGN] choice error:', e && e.stack || e && e.message || e);
    res.status(500).json({ error: 'Internal error' });
  }
});

router.post('/campaign/progress', requireAuth, writeLimiter, async (req, res) => {
  try {
    if (!campaignService) return res.status(503).json({ error: 'Campaign service unavailable' });
    const wallet = getAuthWallet(req);
    const sessionId = sanitize(req.body.session_id || req.body.sessionId, 100);
    if (!wallet || wallet.length < 10 || !sessionId) return res.status(400).json({ error: 'missing fields' });
    const result = await campaignService.getProgress(wallet, sessionId);
    if (result.error) return res.status(404).json(result);
    res.json(result);
  } catch (e) {
    console.error('[CAMPAIGN] progress error:', e.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

router.post('/campaign/complete', requireAuth, writeLimiter, async (req, res) => {
  try {
    if (!campaignService) return res.status(503).json({ error: 'Campaign service unavailable' });
    const wallet = getAuthWallet(req);
    const sessionId = sanitize(req.body.session_id || req.body.sessionId, 100);
    if (!wallet || wallet.length < 10 || !sessionId) return res.status(400).json({ error: 'missing fields' });
    const result = await campaignService.complete(wallet, sessionId);
    if (result.error) return res.status(404).json(result);
    res.json(result);
  } catch (e) {
    const msg = (e && e.message) || String(e);
    console.error('[CAMPAIGN] complete error:', e && e.stack || msg);
    const hint = msg.includes('does not exist') || msg.includes('column') ? ` (schema: ${msg.slice(0, 120)})` : '';
    res.status(500).json({ error: `Internal error${hint}` });
  }
});

router.post('/campaign/reward/claim', requireAuth, writeLimiter, async (req, res) => {
  try {
    if (!campaignService) return res.status(503).json({ error: 'Campaign service unavailable' });
    const wallet = getAuthWallet(req);
    const rewardId = parseInt(req.body.reward_id || req.body.rewardId, 10);
    if (!wallet || wallet.length < 10 || !rewardId) return res.status(400).json({ error: 'missing fields' });
    const result = await campaignService.claimReward(wallet, rewardId);
    if (result.error) return res.status(404).json(result);
    res.json(result);
  } catch (e) {
    console.error('[CAMPAIGN] reward claim error:', e && e.stack || e && e.message || e);
    res.status(500).json({ error: 'Internal error' });
  }
});

router.post('/campaign/abandon', requireAuth, writeLimiter, async (req, res) => {
  try {
    if (!campaignService) return res.status(503).json({ error: 'Campaign service unavailable' });
    const wallet = getAuthWallet(req);
    const sessionId = sanitize(req.body.session_id || req.body.sessionId, 100);
    if (!wallet || wallet.length < 10 || !sessionId) return res.status(400).json({ error: 'missing fields' });
    const result = await campaignService.abandon(wallet, sessionId);
    if (result.error) return res.status(404).json(result);
    res.json(result);
  } catch (e) {
    console.error('[CAMPAIGN] abandon error:', e.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

router.get('/reputation/history/:wallet', readLimiter, async (req, res) => {
  try {
    const wallet = String(req.params.wallet || '').toLowerCase().trim();
    if (!wallet || wallet.length < 10) return res.status(400).json({ error: 'wallet required' });
    const limit = Math.min(parseInt(req.query.limit) || 30, 100);
    const { rows } = await pool.query(
      `SELECT id, faction, delta, before_value, after_value,
              COALESCE(source_type, '') AS source_type,
              COALESCE(source_id, '') AS source_id,
              created_at
         FROM reputation_history
        WHERE LOWER(wallet) = LOWER($1)
        ORDER BY created_at DESC, id DESC
        LIMIT $2`,
      [wallet, limit]
    );
    res.json({ history: rows, count: rows.length });
  } catch (e) {
    if (e && e.code === '42P01') return res.json({ history: [], count: 0, _note: 'reputation_history table missing' });
    console.error('[reputation/history] error:', e.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

router.get('/reputation/:wallet', readLimiter, async (req, res) => {
  try {
    if (!campaignService) return res.status(503).json({ error: 'Campaign service unavailable' });
    const wallet = sanitize(req.params.wallet, 255).toLowerCase();
    if (!wallet || wallet.length < 10) return res.status(400).json({ error: 'wallet required' });
    res.json(await campaignService.getReputation(wallet));
  } catch (e) {
    console.error('[CAMPAIGN] reputation error:', e.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

router.post('/reputation/delta', writeLimiter, async (req, res) => {
  try {
    if (!isInternalRequest(req)) return res.status(403).json({ error: 'forbidden' });
    if (!campaignService) return res.status(503).json({ error: 'Campaign service unavailable' });
    const wallet = sanitize(req.body.wallet || req.body.player_id, 255).toLowerCase();
    const faction = sanitize(req.body.faction, 40);
    const delta = parseInt(req.body.delta, 10) || 0;
    const sourceType = sanitize(req.body.source_type || 'admin', 40);
    const sourceId = sanitize(req.body.source_id || 'manual', 80);
    if (!wallet || wallet.length < 10 || !faction || !delta) return res.status(400).json({ error: 'missing fields' });
    res.json(await campaignService.applyReputationDelta(wallet, faction, delta, sourceType, sourceId));
  } catch (e) {
    console.error('[CAMPAIGN] reputation delta error:', e.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

router.get('/tags/:wallet', readLimiter, async (req, res) => {
  try {
    if (!campaignService) return res.status(503).json({ error: 'Campaign service unavailable' });
    const wallet = sanitize(req.params.wallet, 255).toLowerCase();
    if (!wallet || wallet.length < 10) return res.status(400).json({ error: 'wallet required' });
    res.json(await campaignService.getTags(wallet));
  } catch (e) {
    console.error('[CAMPAIGN] tags error:', e.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

router.post('/tags/grant', writeLimiter, async (req, res) => {
  try {
    if (!isInternalRequest(req)) return res.status(403).json({ error: 'forbidden' });
    if (!campaignService) return res.status(503).json({ error: 'Campaign service unavailable' });
    const wallet = sanitize(req.body.wallet || req.body.player_id, 255).toLowerCase();
    const tagId = sanitize(req.body.tag_id || req.body.tagId, 100);
    const source = sanitize(req.body.source || 'admin', 100);
    if (!wallet || wallet.length < 10 || !tagId) return res.status(400).json({ error: 'missing fields' });
    res.json(await campaignService.grantTag(wallet, tagId, source, req.body.metadata || {}));
  } catch (e) {
    console.error('[CAMPAIGN] tag grant error:', e.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

router.post('/tags/revoke', writeLimiter, async (req, res) => {
  try {
    if (!isInternalRequest(req)) return res.status(403).json({ error: 'forbidden' });
    if (!campaignService) return res.status(503).json({ error: 'Campaign service unavailable' });
    const wallet = sanitize(req.body.wallet || req.body.player_id, 255).toLowerCase();
    const tagId = sanitize(req.body.tag_id || req.body.tagId, 100);
    if (!wallet || wallet.length < 10 || !tagId) return res.status(400).json({ error: 'missing fields' });
    const result = await campaignService.revokeTag(wallet, tagId);
    if (result.error) return res.status(400).json(result);
    res.json(result);
  } catch (e) {
    console.error('[CAMPAIGN] tag revoke error:', e.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

router.post('/tags/set-active-title', requireAuth, writeLimiter, async (req, res) => {
  try {
    if (!campaignService) return res.status(503).json({ error: 'Campaign service unavailable' });
    const wallet = getAuthWallet(req);
    const rawTag = req.body.tag_id || req.body.tagId;
    const tagId = (rawTag == null || rawTag === '') ? null : sanitize(String(rawTag), 100);
    if (!wallet || wallet.length < 10) return res.status(400).json({ error: 'missing fields' });
    const result = await campaignService.setActiveTitle(wallet, tagId);
    if (result.error) return res.status(400).json(result);
    res.json(result);
  } catch (e) {
    console.error('[CAMPAIGN] active title error:', e.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

router.get('/lore/flags/:wallet', readLimiter, async (req, res) => {
  try {
    if (!campaignService) return res.status(503).json({ error: 'Campaign service unavailable' });
    const wallet = sanitize(req.params.wallet, 255).toLowerCase();
    if (!wallet || wallet.length < 10) return res.status(400).json({ error: 'wallet required' });
    res.json(await campaignService.getLoreFlags(wallet));
  } catch (e) {
    console.error('[CAMPAIGN] lore flags error:', e.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

router.post('/lore/flag/set', writeLimiter, async (req, res) => {
  try {
    if (!isInternalRequest(req)) return res.status(403).json({ error: 'forbidden' });
    if (!campaignService) return res.status(503).json({ error: 'Campaign service unavailable' });
    const wallet = sanitize(req.body.wallet || req.body.player_id, 255).toLowerCase();
    const flagId = sanitize(req.body.flag_id || req.body.flagId, 100);
    const sourceChapter = sanitize(req.body.source_chapter || req.body.sourceChapter || 'admin', 100);
    if (!wallet || wallet.length < 10 || !flagId) return res.status(400).json({ error: 'missing fields' });
    res.json(await campaignService.setLoreFlag(wallet, flagId, sourceChapter, req.body.metadata || {}));
  } catch (e) {
    console.error('[CAMPAIGN] lore set error:', e.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

router.post('/lore/flag/check', readLimiter, async (req, res) => {
  try {
    if (!campaignService) return res.status(503).json({ error: 'Campaign service unavailable' });
    const wallet = sanitize(req.body.wallet || req.body.player_id, 255).toLowerCase();
    const flagIds = Array.isArray(req.body.flag_ids || req.body.flagIds) ? (req.body.flag_ids || req.body.flagIds).map(x => sanitize(String(x), 100)) : [];
    if (!wallet || wallet.length < 10) return res.status(400).json({ error: 'wallet required' });
    res.json(await campaignService.checkLoreFlags(wallet, flagIds));
  } catch (e) {
    console.error('[CAMPAIGN] lore check error:', e.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

router.get('/branch/active/:wallet/:targetChapter', readLimiter, async (req, res) => {
  try {
    if (!campaignService) return res.status(503).json({ error: 'Campaign service unavailable' });
    const wallet = sanitize(req.params.wallet, 255).toLowerCase();
    const targetChapter = sanitize(req.params.targetChapter, 100);
    if (!wallet || !targetChapter) return res.status(400).json({ error: 'missing fields' });
    res.json(await campaignService.getActiveBranchModifiers(wallet, targetChapter));
  } catch (e) {
    console.error('[CAMPAIGN] branch active error:', e.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

router.post('/branch/set', writeLimiter, async (req, res) => {
  try {
    if (!isInternalRequest(req)) return res.status(403).json({ error: 'forbidden' });
    if (!campaignService) return res.status(503).json({ error: 'Campaign service unavailable' });
    const wallet = sanitize(req.body.wallet || req.body.player_id, 255).toLowerCase();
    const modifierId = sanitize(req.body.modifier_id || req.body.modifierId, 100);
    const targetChapter = sanitize(req.body.target_chapter || req.body.targetChapter, 100);
    const sourceChapter = sanitize(req.body.source_chapter || req.body.sourceChapter || '', 100);
    if (!wallet || wallet.length < 10 || !modifierId || !targetChapter) return res.status(400).json({ error: 'missing fields' });
    res.json(await campaignService.setBranchModifier(wallet, modifierId, targetChapter, sourceChapter));
  } catch (e) {
    console.error('[CAMPAIGN] branch set error:', e.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

module.exports = router;
