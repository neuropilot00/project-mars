const express = require('express');
const { makeRateLimiter } = require('../utils/rateLimiters');
const { pool, getSetting } = require('../db');
const { requireAuth, getAuthWallet } = require('../utils/apiHelpers');

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

let guildService;
try { guildService = require('../services/guild'); } catch (_e) { /* guild service not available */ }
let seasonService;
try { seasonService = require('../services/season'); } catch (_e) { /* season service not available */ }

// Create guild
router.post('/guild/create', requireAuth, writeLimiter, async (req, res) => {
  const { name, tag, emoji, description } = req.body;
  const w = getAuthWallet(req);
  if (!w || !name || !tag) return res.status(400).json({ error: 'Missing wallet, name, or tag' });
  if (!guildService) return res.status(503).json({ error: 'Guild service unavailable' });
  try {
    const result = await guildService.createGuild(w, name, tag, emoji, description);
    if (result.error) return res.status(400).json(result);
    res.json(result);
    // Season tracking: gp_spend for guild creation + guild_contrib
    if (seasonService && result.success) {
      seasonService.addSeasonScore(w, 'gp_spend', 50).catch(() => {}); // big_spender
      seasonService.addSeasonScore(w, 'guild_contrib', 1).catch(() => {}); // team_player
    }
  } catch (e) {
    console.error('[GUILD] create error:', e.message);
    res.status(500).json({ error: 'Failed to create guild' });
  }
});

// Get my guild
router.get('/guild/my', requireAuth, readLimiter, async (req, res) => {
  const w = getAuthWallet(req);
  if (!w) return res.status(400).json({ error: 'Missing wallet' });
  if (!guildService) return res.status(503).json({ error: 'Guild service unavailable' });
  try {
    const guild = await guildService.getGuildByWallet(w);
    if (guild) {
      const lvl = parseInt(guild.level || 1);
      guild.researchSlots = await guildService.getResearchSlots(lvl);
      guild.maxMembers = await guildService.getGuildMaxMembers(guild.id);
    }
    res.json({ guild });
  } catch (e) {
    console.error('[GUILD] get-my error:', e.message);
    res.status(500).json({ error: 'Failed to get guild' });
  }
});

// Get my invites (must be before /guild/:id)
router.get('/guild/invites', requireAuth, readLimiter, async (req, res) => {
  const w = getAuthWallet(req);
  if (!w) return res.status(400).json({ error: 'Missing wallet' });
  if (!guildService) return res.status(503).json({ error: 'Guild service unavailable' });
  try {
    const invites = await guildService.getMyInvites(w);
    res.json({ invites });
  } catch (e) {
    console.error('[GUILD] invites error:', e.message);
    res.status(500).json({ error: 'Failed to get invites' });
  }
});

// Guild leaderboard (must be before /guild/:id)
router.get('/guild/leaderboard', readLimiter, async (req, res) => {
  if (!guildService) return res.status(503).json({ error: 'Guild service unavailable' });
  try {
    const guilds = await guildService.getGuildLeaderboard(parseInt(req.query.limit) || 20);
    res.json({ guilds });
  } catch (e) {
    console.error('[GUILD] leaderboard error:', e.message);
    res.status(500).json({ error: 'Failed to get leaderboard' });
  }
});

// Search guilds by id / tag / name (used by the join screen)
router.get('/guild/search', readLimiter, async (req, res) => {
  if (!guildService) return res.status(503).json({ error: 'Guild service unavailable' });
  try {
    const q = (req.query.q || '').toString().slice(0, 64);
    if (!q.trim()) return res.json({ guilds: [] });
    const guilds = await guildService.searchGuilds(q, parseInt(req.query.limit) || 20);
    res.json({ guilds });
  } catch (e) {
    console.error('[GUILD] search error:', e.message);
    res.status(500).json({ error: 'Failed to search guilds' });
  }
});

// Get guild by ID
router.get('/guild/:id', readLimiter, async (req, res, next) => {
  // Static sub-routes registered later must not be shadow-matched by :id
  if (req.params.id === 'research-bonuses') return next();
  if (!guildService) return res.status(503).json({ error: 'Guild service unavailable' });
  try {
    const guild = await guildService.getGuild(parseInt(req.params.id));
    if (!guild) return res.status(404).json({ error: 'Guild not found' });
    res.json({ guild });
  } catch (e) {
    console.error('[GUILD] get error:', e.message);
    res.status(500).json({ error: 'Failed to get guild' });
  }
});

// Invite member — accepts either wallet address (0x…) or nickname.
// If the input doesn't look like a wallet we resolve it via the users table.
router.post('/guild/invite', requireAuth, writeLimiter, async (req, res) => {
  const { targetWallet, guildId } = req.body;
  const w = getAuthWallet(req);
  let target = (targetWallet || '').trim();
  if (!w || !target || !guildId) return res.status(400).json({ error: 'Missing fields' });
  if (!guildService) return res.status(503).json({ error: 'Guild service unavailable' });
  try {
    // Resolve nickname → wallet if the input doesn't look like a 0x address.
    const looksLikeWallet = /^0x[0-9a-fA-F]{40}$/.test(target);
    if (!looksLikeWallet) {
      const nickRow = await pool.query(
        'SELECT wallet_address FROM users WHERE LOWER(nickname) = LOWER($1) LIMIT 1',
        [target]
      );
      if (!nickRow.rows.length) {
        return res.status(400).json({ error: 'No user with that nickname' });
      }
      target = nickRow.rows[0].wallet_address;
    }
    const tw = target.toLowerCase();
    const result = await guildService.inviteMember(w, tw, parseInt(guildId));
    if (result.error) return res.status(400).json(result);
    res.json(result);
  } catch (e) {
    console.error('[GUILD] invite error:', e.message);
    res.status(500).json({ error: 'Failed to invite' });
  }
});

// Accept invite
router.post('/guild/invite/accept', requireAuth, writeLimiter, async (req, res) => {
  const { inviteId } = req.body;
  const w = getAuthWallet(req);
  if (!w || !inviteId) return res.status(400).json({ error: 'Missing fields' });
  if (!guildService) return res.status(503).json({ error: 'Guild service unavailable' });
  try {
    const result = await guildService.acceptInvite(w, parseInt(inviteId));
    if (result.error) return res.status(400).json(result);
    res.json(result);
    // Season tracking: guild contribution (non-blocking)
    if (seasonService && !result.error) { seasonService.addSeasonScore(w, 'guild_contrib', 1).catch(() => {}); }
  } catch (e) {
    console.error('[GUILD] accept error:', e.message);
    res.status(500).json({ error: 'Failed to accept invite' });
  }
});

// ── Join requests (player → guild, approval by leader/officer) ──
router.post('/guild/join-request', requireAuth, writeLimiter, async (req, res) => {
  const { guildId } = req.body;
  const w = getAuthWallet(req);
  if (!w || !guildId) return res.status(400).json({ error: 'Missing fields' });
  if (!guildService) return res.status(503).json({ error: 'Guild service unavailable' });
  try {
    const result = await guildService.createJoinRequest(w, parseInt(guildId));
    if (result.error) return res.status(400).json(result);
    res.json(result);
  } catch (e) {
    console.error('[GUILD] join-request error:', e.message);
    res.status(500).json({ error: 'Failed to send request' });
  }
});

router.get('/guild/:id/requests', readLimiter, async (req, res) => {
  if (!guildService) return res.status(503).json({ error: 'Guild service unavailable' });
  const w = (req.query.wallet || '').toLowerCase();
  if (!w) return res.status(400).json({ error: 'Missing wallet' });
  try {
    const requests = await guildService.getGuildJoinRequests(w, parseInt(req.params.id));
    res.json({ requests });
  } catch (e) {
    console.error('[GUILD] get-requests error:', e.message);
    res.status(500).json({ error: 'Failed to load requests' });
  }
});

// Search free users (not in any guild) by nickname or wallet, for invite UI.
// Caller must be leader/officer of the guild.
router.get('/guild/:id/search-users', readLimiter, async (req, res) => {
  if (!guildService) return res.status(503).json({ error: 'Guild service unavailable' });
  const w = (req.query.wallet || '').toLowerCase();
  const q = req.query.q || '';
  if (!w) return res.status(400).json({ error: 'Missing wallet' });
  try {
    const users = await guildService.searchUsersForInvite(
      w, parseInt(req.params.id), q, parseInt(req.query.limit) || 15
    );
    res.json({ users });
  } catch (e) {
    console.error('[GUILD] search-users error:', e.message);
    res.status(500).json({ error: 'Failed to search users' });
  }
});

router.post('/guild/request/approve', requireAuth, writeLimiter, async (req, res) => {
  const { inviteId } = req.body;
  const w = getAuthWallet(req);
  if (!w || !inviteId) return res.status(400).json({ error: 'Missing fields' });
  if (!guildService) return res.status(503).json({ error: 'Guild service unavailable' });
  try {
    const result = await guildService.approveJoinRequest(w, parseInt(inviteId));
    if (result.error) return res.status(400).json(result);
    res.json(result);
  } catch (e) {
    console.error('[GUILD] approve-request error:', e.message);
    res.status(500).json({ error: 'Failed to approve request' });
  }
});

router.post('/guild/request/reject', requireAuth, writeLimiter, async (req, res) => {
  const { inviteId } = req.body;
  const w = getAuthWallet(req);
  if (!w || !inviteId) return res.status(400).json({ error: 'Missing fields' });
  if (!guildService) return res.status(503).json({ error: 'Guild service unavailable' });
  try {
    const result = await guildService.rejectJoinRequest(w, parseInt(inviteId));
    if (result.error) return res.status(400).json(result);
    res.json(result);
  } catch (e) {
    console.error('[GUILD] reject-request error:', e.message);
    res.status(500).json({ error: 'Failed to reject request' });
  }
});

// Decline invite
router.post('/guild/invite/decline', requireAuth, writeLimiter, async (req, res) => {
  const { inviteId } = req.body;
  const w = getAuthWallet(req);
  if (!w || !inviteId) return res.status(400).json({ error: 'Missing fields' });
  if (!guildService) return res.status(503).json({ error: 'Guild service unavailable' });
  try {
    const result = await guildService.declineInvite(w, parseInt(inviteId));
    if (result.error) return res.status(400).json(result);
    res.json(result);
  } catch (e) {
    console.error('[GUILD] decline error:', e.message);
    res.status(500).json({ error: 'Failed to decline invite' });
  }
});

// Leave guild
router.post('/guild/leave', requireAuth, writeLimiter, async (req, res) => {
  const w = getAuthWallet(req);
  if (!w) return res.status(400).json({ error: 'Missing wallet' });
  if (!guildService) return res.status(503).json({ error: 'Guild service unavailable' });
  try {
    const result = await guildService.leaveGuild(w);
    if (result.error) return res.status(400).json(result);
    res.json(result);
  } catch (e) {
    console.error('[GUILD] leave error:', e.message);
    res.status(500).json({ error: 'Failed to leave guild' });
  }
});

// [v7.355] 길드 변절(배신) — 금고 탈취 + 제명 + 배신자 낙인 + 자동 현상금 + 재가입 쿨다운
router.post('/guild/defect', requireAuth, writeLimiter, async (req, res) => {
  const w = getAuthWallet(req);
  if (!w) return res.status(400).json({ error: 'Missing wallet' });
  if (!guildService || !guildService.defectFromGuild) return res.status(503).json({ error: 'Guild service unavailable' });
  try {
    const result = await guildService.defectFromGuild(w);
    if (result.error) return res.status(400).json(result);
    res.json(result);
  } catch (e) {
    console.error('[GUILD] defect error:', e.message);
    res.status(500).json({ error: 'Failed to defect' });
  }
});

// [v7.361] 배신자 낙인 유료 제거(속죄) — GP 소각으로 평판 회복
router.post('/guild/redeem-betrayal', requireAuth, writeLimiter, async (req, res) => {
  const w = getAuthWallet(req);
  if (!w) return res.status(400).json({ error: 'Missing wallet' });
  if (!guildService || !guildService.redeemBetrayalMark) return res.status(503).json({ error: 'Guild service unavailable' });
  try {
    const result = await guildService.redeemBetrayalMark(w);
    if (result.error) return res.status(400).json(result);
    res.json(result);
  } catch (e) {
    console.error('[GUILD] redeem error:', e.message);
    res.status(500).json({ error: 'Failed to redeem' });
  }
});

// Kick member
router.post('/guild/kick', requireAuth, writeLimiter, async (req, res) => {
  const { targetWallet, guildId } = req.body;
  const w = getAuthWallet(req);
  const tw = (targetWallet || '').toLowerCase();
  if (!w || !tw || !guildId) return res.status(400).json({ error: 'Missing fields' });
  if (!guildService) return res.status(503).json({ error: 'Guild service unavailable' });
  try {
    const result = await guildService.kickMember(w, tw, parseInt(guildId));
    if (result.error) return res.status(400).json(result);
    res.json(result);
  } catch (e) {
    console.error('[GUILD] kick error:', e.message);
    res.status(500).json({ error: 'Failed to kick member' });
  }
});

// Promote to officer
router.post('/guild/promote', requireAuth, writeLimiter, async (req, res) => {
  const { targetWallet, guildId } = req.body;
  const w = getAuthWallet(req);
  const tw = (targetWallet || '').toLowerCase();
  if (!w || !tw || !guildId) return res.status(400).json({ error: 'Missing fields' });
  if (!guildService) return res.status(503).json({ error: 'Guild service unavailable' });
  try {
    const result = await guildService.promoteToOfficer(w, tw, parseInt(guildId));
    if (result.error) return res.status(400).json(result);
    res.json(result);
  } catch (e) {
    console.error('[GUILD] promote error:', e.message);
    res.status(500).json({ error: 'Failed to promote' });
  }
});

// Demote to member
router.post('/guild/demote', requireAuth, writeLimiter, async (req, res) => {
  const { targetWallet, guildId } = req.body;
  const w = getAuthWallet(req);
  const tw = (targetWallet || '').toLowerCase();
  if (!w || !tw || !guildId) return res.status(400).json({ error: 'Missing fields' });
  if (!guildService) return res.status(503).json({ error: 'Guild service unavailable' });
  try {
    const result = await guildService.demoteToMember(w, tw, parseInt(guildId));
    if (result.error) return res.status(400).json(result);
    res.json(result);
  } catch (e) {
    console.error('[GUILD] demote error:', e.message);
    res.status(500).json({ error: 'Failed to demote' });
  }
});

// Transfer leadership
router.post('/guild/transfer', requireAuth, writeLimiter, async (req, res) => {
  const { targetWallet, guildId } = req.body;
  const w = getAuthWallet(req);
  const tw = (targetWallet || '').toLowerCase();
  if (!w || !tw || !guildId) return res.status(400).json({ error: 'Missing fields' });
  if (!guildService) return res.status(503).json({ error: 'Guild service unavailable' });
  try {
    const result = await guildService.transferLeadership(w, tw, parseInt(guildId));
    if (result.error) return res.status(400).json(result);
    res.json(result);
  } catch (e) {
    console.error('[GUILD] transfer error:', e.message);
    res.status(500).json({ error: 'Failed to transfer' });
  }
});

// Disband guild
// Update guild info (leader-only, charges GP per changed field)
router.post('/guild/update', requireAuth, writeLimiter, async (req, res) => {
  const { guildId, name, description, emblemEmoji, emblemImage } = req.body || {};
  const w = getAuthWallet(req);
  if (!w || !guildId) return res.status(400).json({ error: 'Missing fields' });
  if (!guildService) return res.status(503).json({ error: 'Guild service unavailable' });
  // Build fields dict (only include keys that were actually sent)
  const fields = {};
  if (typeof name === 'string')          fields.name = name;
  if (typeof description === 'string')   fields.description = description;
  if (typeof emblemEmoji === 'string')   fields.emblemEmoji = emblemEmoji;
  if (emblemImage !== undefined)         fields.emblemImage = emblemImage; // may be null to clear
  try {
    const result = await guildService.updateGuildInfo(w, parseInt(guildId), fields);
    if (result.error) return res.status(400).json(result);
    res.json(result);
  } catch (e) {
    console.error('[GUILD] update error:', e.message);
    res.status(500).json({ error: 'Failed to update guild' });
  }
});

router.post('/guild/disband', requireAuth, writeLimiter, async (req, res) => {
  const { guildId } = req.body;
  const w = getAuthWallet(req);
  if (!w || !guildId) return res.status(400).json({ error: 'Missing fields' });
  if (!guildService) return res.status(503).json({ error: 'Guild service unavailable' });
  try {
    const result = await guildService.disbandGuild(w, parseInt(guildId));
    if (result.error) return res.status(400).json(result);
    res.json(result);
  } catch (e) {
    console.error('[GUILD] disband error:', e.message);
    res.status(500).json({ error: 'Failed to disband' });
  }
});

// [Phase A] 길드 금고 인출 — 리더/오피서만, 섹터 세수 회수 경로
router.post('/guild/treasury/withdraw', requireAuth, writeLimiter, async (req, res) => {
  const { guildId, amount } = req.body;
  const w = getAuthWallet(req);
  if (!w || !guildId || !amount) return res.status(400).json({ error: 'Missing fields' });
  if (!guildService || !guildService.withdrawTreasury) return res.status(503).json({ error: 'Guild service unavailable' });
  try {
    const result = await guildService.withdrawTreasury(w, parseInt(guildId), amount);
    if (result.error) return res.status(400).json(result);
    res.json(result);
  } catch (e) {
    console.error('[GUILD] treasury withdraw error:', e.message);
    res.status(500).json({ error: 'Failed to withdraw' });
  }
});

// ══════════════════════════════════════════════════
//  GUILD CHAT — polling based
// ══════════════════════════════════════════════════
router.post('/guild/chat', requireAuth, writeLimiter, async (req, res) => {
  const { guildId, message } = req.body || {};
  const w = getAuthWallet(req);
  if (!w || !guildId) return res.status(400).json({ error: 'Missing fields' });
  if (!guildService) return res.status(503).json({ error: 'Guild service unavailable' });
  try {
    const result = await guildService.sendGuildMessage(w, parseInt(guildId), message);
    if (result.error) return res.status(400).json(result);
    res.json(result);
  } catch (e) {
    console.error('[GUILD] chat send error:', e.message);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

router.get('/guild/chat/:guildId', readLimiter, async (req, res) => {
  const { wallet, sinceId } = req.query;
  const w = (wallet || '').toLowerCase();
  const guildId = parseInt(req.params.guildId);
  if (!w || !guildId) return res.status(400).json({ error: 'Missing fields' });
  if (!guildService) return res.status(503).json({ error: 'Guild service unavailable' });
  try {
    const result = await guildService.getGuildMessages(w, guildId, sinceId);
    if (result.error) return res.status(400).json(result);
    res.json(result);
  } catch (e) {
    console.error('[GUILD] chat read error:', e.message);
    res.status(500).json({ error: 'Failed to load messages' });
  }
});

// ══════════════════════════════════════════════════
//  GUILD UPGRADES — treasury contribution, level up, research
// ══════════════════════════════════════════════════

// Set the caller's harvest contribution percentage (0-30)
router.post('/guild/contribution', requireAuth, writeLimiter, async (req, res) => {
  const { pct } = req.body || {};
  const w = getAuthWallet(req);
  if (!w || pct === undefined) return res.status(400).json({ error: 'Missing fields' });
  if (!guildService) return res.status(503).json({ error: 'Guild service unavailable' });
  try {
    const result = await guildService.setContributionPct(w, parseInt(pct));
    if (result.error) return res.status(400).json(result);
    res.json(result);
  } catch (e) {
    console.error('[GUILD] contrib-pct error:', e.message);
    res.status(500).json({ error: 'Failed to set contribution' });
  }
});

// Trigger a guild level-up (consumes treasury)
router.post('/guild/levelup', requireAuth, writeLimiter, async (req, res) => {
  const { guildId } = req.body || {};
  const w = getAuthWallet(req);
  if (!w || !guildId) return res.status(400).json({ error: 'Missing fields' });
  if (!guildService) return res.status(503).json({ error: 'Guild service unavailable' });
  try {
    const result = await guildService.upgradeGuildLevel(w, parseInt(guildId));
    if (result.error) return res.status(400).json(result);
    res.json(result);
  } catch (e) {
    console.error('[GUILD] levelup error:', e.message);
    res.status(500).json({ error: 'Failed to level up' });
  }
});

// Unlock a research perk (consumes treasury)
// ── Guild GP Donation ──
router.post('/guild/donate', requireAuth, writeLimiter, async (req, res) => {
  const { guildId, amount } = req.body || {};
  const w = getAuthWallet(req);
  const amt = parseInt(amount);
  if (!w || !guildId || !amt || amt <= 0) return res.status(400).json({ error: 'Missing fields' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Verify user is member
    const mem = await client.query('SELECT guild_id FROM guild_members WHERE wallet=$1 AND guild_id=$2', [w, guildId]);
    if (!mem.rows.length) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'Not a guild member' }); }
    // Check balance
    const usr = await client.query('SELECT gp_balance FROM users WHERE wallet_address=$1 FOR UPDATE', [w]);
    if (!usr.rows.length || parseInt(usr.rows[0].gp_balance) < amt) {
      await client.query('ROLLBACK'); return res.status(400).json({ error: 'Insufficient GP' });
    }
    // Deduct from user
    const guildDonateDeduct = await client.query(
      'UPDATE users SET gp_balance = gp_balance - $1 WHERE LOWER(wallet_address)=LOWER($2) AND gp_balance >= $1',
      [amt, w]
    );
    if (guildDonateDeduct.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'INSUFFICIENT_GP' });
    }
    // Credit guild treasury
    const tRes = await client.query('UPDATE guilds SET gp_treasury = COALESCE(gp_treasury,0) + $1 WHERE id=$2 RETURNING gp_treasury', [amt, guildId]);
    const newTreasury = parseFloat(tRes.rows[0]?.gp_treasury || 0);
    // Ledger
    try {
      await client.query(
        `INSERT INTO guild_treasury_ledger (guild_id, wallet, kind, delta_pp, delta_gp, balance_after, memo) VALUES ($1, $2, 'donate', 0, $3, $4, $5)`,
        [guildId, w, amt, newTreasury, `GP donation: ${amt} GP`]
      );
    } catch (_e) { /* ledger table may not exist */ }
    await client.query('COMMIT');
    const bal = await pool.query('SELECT gp_balance FROM users WHERE wallet_address=$1', [w]);
    res.json({ ok: true, gpBalance: parseInt(bal.rows[0]?.gp_balance || 0) });
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    res.status(500).json({ error: e.message });
  } finally { client.release(); }
});

router.post('/guild/research', requireAuth, writeLimiter, async (req, res) => {
  const { guildId, key } = req.body || {};
  const w = getAuthWallet(req);
  if (!w || !guildId || !key) return res.status(400).json({ error: 'Missing fields' });
  if (!guildService) return res.status(503).json({ error: 'Guild service unavailable' });
  try {
    const result = await guildService.unlockResearch(w, parseInt(guildId), key);
    if (result.error) return res.status(400).json(result);
    res.json(result);
  } catch (e) {
    console.error('[GUILD] research error:', e.message);
    res.status(500).json({ error: 'Failed to unlock research' });
  }
});

// Treasury ledger (recent transactions)
router.get('/guild/:id/ledger', readLimiter, async (req, res) => {
  if (!guildService) return res.status(503).json({ error: 'Guild service unavailable' });
  try {
    const entries = await guildService.getTreasuryLedger(
      parseInt(req.params.id),
      parseInt(req.query.limit) || 50
    );
    res.json({ entries });
  } catch (e) {
    console.error('[GUILD] ledger error:', e.message);
    res.status(500).json({ error: 'Failed to load ledger' });
  }
});

// ═══════════════════════════════════════
//  GUILD WARS
// ═══════════════════════════════════════

router.post('/guild/war/declare', requireAuth, writeLimiter, async (req, res) => {
  const { guildId, targetGuildId, stakeGp, sectorId, durationHours } = req.body || {};
  const w = getAuthWallet(req);
  if (!w || !guildId || !targetGuildId) return res.status(400).json({ error: 'Missing fields' });
  if (!guildService) return res.status(503).json({ error: 'Guild service unavailable' });
  try {
    const opts = {};
    if (stakeGp != null && stakeGp !== '') opts.stakeGp = parseInt(stakeGp);
    if (sectorId != null && sectorId !== '') opts.sectorId = parseInt(sectorId);
    if (durationHours != null && durationHours !== '') opts.durationHours = parseInt(durationHours);
    const r = await guildService.declareWar(w, parseInt(guildId), parseInt(targetGuildId), opts);
    if (r.error) return res.status(400).json(r);
    res.json(r);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// 진행 중인 길드전 기준으로 적 길드 멤버 목록 반환 (함대전 선포 대상용)
router.get('/guild/war/enemies', readLimiter, async (req, res) => {
  const guildId = parseInt(req.query.guildId);
  const warId   = parseInt(req.query.warId);
  if (!guildId || !warId) return res.status(400).json({ error: 'guildId and warId required' });
  try {
    const { rows: war } = await pool.query(
      `SELECT attacker_guild_id, defender_guild_id FROM guild_wars WHERE id=$1 AND status='active'`, [warId]
    );
    if (!war.length) return res.status(404).json({ error: 'War not found or not active' });
    const enemyGuildId = war[0].attacker_guild_id === guildId ? war[0].defender_guild_id : war[0].attacker_guild_id;
    const { rows } = await pool.query(`
      SELECT gm.wallet, u.nickname, u.rank_level,
             (SELECT COUNT(*) FROM fleets f WHERE f.owner_wallet=gm.wallet AND f.is_in_battle=false AND f.ships_alive>0) AS ready_fleets
      FROM guild_members gm
      JOIN users u ON u.wallet_address = gm.wallet
      WHERE gm.guild_id = $1
    `, [enemyGuildId]);
    res.json({ enemies: rows, enemy_guild_id: enemyGuildId });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// 적 함대가 없을 때 자동 승리 포인트 획득 (1회/24h/전쟁)
router.post('/guild/war/auto-win', requireAuth, writeLimiter, async (req, res) => {
  const wallet  = getAuthWallet(req);
  const warId   = parseInt(req.body.war_id);
  const guildId = parseInt(req.body.guild_id);
  if (!wallet || !warId || !guildId) return res.status(400).json({ error: 'wallet, war_id, guild_id required' });

  // ✅ [v7.42] TOCTOU fix: wrap cooldown-check + INSERT in a single transaction,
  //    locking the guild_wars row to serialize concurrent auto-win requests.
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 전쟁 유효성 검사 + 행 잠금 (race condition 방지)
    const { rows: war } = await client.query(
      `SELECT attacker_guild_id, defender_guild_id FROM guild_wars WHERE id=$1 AND status='active' FOR UPDATE`,
      [warId]
    );
    if (!war.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'War not found or not active' });
    }
    const w = war[0];
    if (w.attacker_guild_id !== guildId && w.defender_guild_id !== guildId) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Not in this war' });
    }

    // 멤버 검증
    const { rows: mem } = await client.query(
      `SELECT 1 FROM guild_members WHERE wallet=$1 AND guild_id=$2`, [wallet, guildId]
    );
    if (!mem.length) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Not a member of this guild' });
    }

    // 적 길드에 준비된 함대가 없는지 재확인
    const enemyGuildId = w.attacker_guild_id === guildId ? w.defender_guild_id : w.attacker_guild_id;
    const { rows: ef } = await client.query(`
      SELECT COUNT(*) FROM fleets f
      JOIN guild_members gm ON gm.wallet = f.owner_wallet
      WHERE gm.guild_id=$1 AND f.is_in_battle=false AND f.ships_alive>0
    `, [enemyGuildId]);
    if (parseInt(ef[0].count) > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'ENEMY_HAS_FLEETS' });
    }

    // 24h 쿨다운 — now inside transaction (serialized by guild_wars FOR UPDATE)
    const { rows: recent } = await client.query(`
      SELECT 1 FROM guild_war_actions
      WHERE war_id=$1 AND wallet=$2 AND action_type='fleet_battle_auto_win'
        AND created_at > NOW() - INTERVAL '24 hours'
    `, [warId, wallet]);
    if (recent.length) {
      await client.query('ROLLBACK');
      return res.status(429).json({ error: 'AUTO_WIN_COOLDOWN' });
    }

    // 포인트 지급 (INSERT + score UPDATE inside same transaction)
    const points = parseInt(await getSetting('guild_war_points_ship_battle', '10')) || 10;
    const scoreCol = w.attacker_guild_id === guildId ? 'attacker_score' : 'defender_score';

    await client.query(
      `INSERT INTO guild_war_actions (war_id, guild_id, wallet, action_type, points, meta)
       VALUES ($1, $2, $3, 'fleet_battle_auto_win', $4, $5)`,
      [warId, guildId, wallet, points, JSON.stringify({ auto: true })]
    );
    await client.query(
      `UPDATE guild_wars SET ${scoreCol} = ${scoreCol} + $1 WHERE id = $2`,
      [points, warId]
    );

    await client.query('COMMIT');
    res.json({ success: true, points });
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('[guild/war/auto-win]', e.message);
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
});

router.get('/guild/war/active', readLimiter, async (req, res) => {
  const guildId = parseInt(req.query.guildId);
  if (!guildId) return res.status(400).json({ error: 'Missing guildId' });
  if (!guildService) return res.status(503).json({ error: 'Guild service unavailable' });
  try {
    const wars = await guildService.getActiveWars(guildId);
    res.json({ wars });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/guild/war/history', readLimiter, async (req, res) => {
  const guildId = parseInt(req.query.guildId);
  if (!guildId) return res.status(400).json({ error: 'Missing guildId' });
  if (!guildService) return res.status(503).json({ error: 'Guild service unavailable' });
  try {
    const wars = await guildService.getWarHistory(guildId);
    res.json({ wars });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/guild/war/:id/leaderboard', readLimiter, async (req, res) => {
  if (!guildService) return res.status(503).json({ error: 'Guild service unavailable' });
  try {
    const lb = await guildService.getWarLeaderboard(parseInt(req.params.id));
    res.json({ leaderboard: lb });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════════════════════
//  GUILD RESEARCH BONUSES (public query)
// ═══════════════════════════════════════

router.get('/guild/research-bonuses', readLimiter, async (req, res) => {
  const w = (req.query.wallet || '').toLowerCase();
  if (!w) return res.status(400).json({ error: 'Missing wallet' });
  if (!guildService) return res.json({ bonuses: {} });
  try {
    const bonuses = await guildService.getResearchBonuses(w);
    res.json({ bonuses });
  } catch (e) { res.json({ bonuses: {} }); }
});

// Season pass routes live in routes/seasonRoutes.js.

// ═══════════════════════════════════════
//  GUILD WAR MINIGAMES
// ═══════════════════════════════════════

router.post('/guild/war/score', requireAuth, writeLimiter, async (req, res) => {
  const { warId, gameType, score } = req.body || {};
  const w = getAuthWallet(req);
  if (!w || !warId || !gameType || !score) return res.status(400).json({ error: 'Missing fields (wallet, warId, gameType, score)' });
  if (!guildService) return res.status(503).json({ error: 'Guild service unavailable' });
  try {
    const r = await guildService.submitGameScore(w, parseInt(warId), gameType, score);
    if (r.error) return res.status(400).json(r);
    res.json(r);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/guild/war/:id/scores', readLimiter, async (req, res) => {
  if (!guildService) return res.status(503).json({ error: 'Guild service unavailable' });
  try {
    const r = await guildService.getWarScoreboard(parseInt(req.params.id));
    if (r.error) return res.status(400).json(r);
    res.json(r);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PP → GP exchange routes live in routes/exchangeRoutes.js.

// ═══════════════════════════════════════
//  GUILD WAR CONTINUE (pay GP/PP to continue minigame)
// ═══════════════════════════════════════

router.post('/guild/war/continue', requireAuth, writeLimiter, async (req, res) => {
  const { warId, continueNum } = req.body || {};
  const w = getAuthWallet(req);
  if (!w || !warId || !continueNum) return res.status(400).json({ error: 'Missing fields' });

  const num = parseInt(continueNum);
  if (num < 1 || num > 10) return res.status(400).json({ error: 'Invalid continue number' });

  const client = await pool.connect();
  try {
    const maxContinues = parseInt(await getSetting('guild_war_continue_max') || '10');
    if (num > maxContinues) return res.status(400).json({ error: 'Max continues reached' });

    // Determine cost
    let costType, costAmount;
    const gpCostsStr = await getSetting('guild_war_continue_gp_costs') || '[5,15,30]';
    const gpCosts = JSON.parse(gpCostsStr);

    if (num <= gpCosts.length) {
      costType = 'gp';
      costAmount = gpCosts[num - 1];
    } else {
      costType = 'pp';
      const ppBase = parseFloat(await getSetting('guild_war_continue_pp_base') || '0.1');
      const ppMult = parseFloat(await getSetting('guild_war_continue_pp_multiplier') || '2');
      costAmount = ppBase * Math.pow(ppMult, num - gpCosts.length - 1);
    }

    await client.query('BEGIN');

    // Check balance and deduct
    const { rows: [user] } = await client.query('SELECT pp_balance, gp_balance FROM users WHERE wallet_address=$1 FOR UPDATE', [w]);
    if (!user) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'User not found' }); }

    if (costType === 'gp') {
      if (parseFloat(user.gp_balance) < costAmount) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: `Insufficient GP (need ${costAmount})` });
      }
      const deductGuildWarGp = await client.query('UPDATE users SET gp_balance = gp_balance - $1 WHERE LOWER(wallet_address)=LOWER($2) AND gp_balance >= $1', [costAmount, w]);
      if (deductGuildWarGp.rowCount === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Insufficient balance (concurrent modification)' });
      }
    } else {
      if (parseFloat(user.pp_balance) < costAmount) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: `Insufficient PP (need ${costAmount.toFixed(2)})` });
      }
      const deductGuildWarPp = await client.query('UPDATE users SET pp_balance = pp_balance - $1 WHERE LOWER(wallet_address)=LOWER($2) AND pp_balance >= $1', [costAmount, w]);
      if (deductGuildWarPp.rowCount === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Insufficient balance (concurrent modification)' });
      }
    }

    // Log
    await client.query(
      `INSERT INTO transactions (from_wallet, type, pp_amount, meta) VALUES ($1, 'war_game_continue', $2, $3)`,
      [w, costAmount, JSON.stringify({ war_id: warId, continue_num: num, cost_type: costType, cost_amount: costAmount })]
    );

    await client.query('COMMIT');

    // Calculate next continue cost
    let nextCostType, nextCostAmount;
    if (num + 1 <= gpCosts.length) {
      nextCostType = 'gp'; nextCostAmount = gpCosts[num];
    } else {
      nextCostType = 'pp';
      const ppBase = parseFloat(await getSetting('guild_war_continue_pp_base') || '0.1');
      const ppMult = parseFloat(await getSetting('guild_war_continue_pp_multiplier') || '2');
      nextCostAmount = ppBase * Math.pow(ppMult, num - gpCosts.length);
    }

    const { rows: [newBal] } = await client.query('SELECT pp_balance, gp_balance FROM users WHERE wallet_address=$1', [w]);

    res.json({
      ok: true,
      paid: { type: costType, amount: costAmount },
      nextContinue: num + 1 <= maxContinues ? { type: nextCostType, amount: nextCostAmount } : null,
      ppBalance: parseFloat(newBal.pp_balance),
      gpBalance: parseFloat(newBal.gp_balance)
    });
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
});

// Get continue cost info
router.get('/guild/war/continue-cost', readLimiter, async (req, res) => {
  try {
    const gpCosts = JSON.parse(await getSetting('guild_war_continue_gp_costs') || '[5,15,30]');
    const ppBase = parseFloat(await getSetting('guild_war_continue_pp_base') || '0.1');
    const ppMult = parseFloat(await getSetting('guild_war_continue_pp_multiplier') || '2');
    const maxContinues = parseInt(await getSetting('guild_war_continue_max') || '10');
    res.json({ gpCosts, ppBase, ppMult, maxContinues });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
