// server/routes/phaseD.js
// ═══════════════════════════════════════════════════════════════
// Phase D API Routes
//
// Alliance:
//   GET  /api/alliances              — 동맹 목록
//   GET  /api/alliances/:id          — 동맹 상세
//   GET  /api/alliances/mine         — 내 동맹
//   POST /api/alliances              — 동맹 생성
//   POST /api/alliances/:id/join     — 동맹 가입
//   POST /api/alliances/leave        — 동맹 탈퇴
//   POST /api/alliances/team-battle  — 동맹 팀전 생성
//
// Replay:
//   POST /api/replays                — 리플레이 공유 생성
//   GET  /api/replays/featured       — 추천 리플레이
//   GET  /api/replays/mine           — 내 리플레이
//   GET  /api/replays/t/:token       — 공유 토큰으로 조회 (인증 불필요)
//   DELETE /api/replays/:id          — 리플레이 삭제
// ═══════════════════════════════════════════════════════════════

const express = require('express');
const router = express.Router();

const alliance = require('../services/alliance');
const replayShare = require('../services/replayShare');

const jwt = require('jsonwebtoken');
const requireAuth = (req, res, next) => {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'UNAUTHORIZED' });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch { return res.status(401).json({ error: 'INVALID_TOKEN' }); }
};

function getWallet(req) {
  return req.user.wallet_address || req.user.wallet || req.user.walletAddress;
}

const ALLIANCE_ERRORS = {
  'NAME_REQUIRED': 400, 'NAME_TOO_LONG': 400, 'INVALID_TAG': 400,
  'NAME_TAKEN': 409, 'TAG_TAKEN': 409,
  'ALREADY_IN_ALLIANCE': 409, 'ALLIANCE_NOT_FOUND': 404,
  'ALLIANCE_FULL': 409, 'NOT_IN_ALLIANCE': 404,
  'LEADER_MUST_TRANSFER': 409, 'INSUFFICIENT_GP': 402,
  'NOT_ENOUGH_PARTICIPANTS': 400, 'NEED_AT_LEAST_2_TEAMS': 400,
  'USER_NOT_FOUND': 404,
  // guild-level alliance (M-157)
  'NOT_AUTHORIZED': 403, 'GUILD_NOT_FOUND': 404, 'ALLIANCE_DISBANDED': 410,
  'ALREADY_IN_THIS_ALLIANCE': 409, 'GUILD_ALREADY_IN_ANOTHER_ALLIANCE': 409,
  'BETRAYAL_COOLDOWN': 429, 'TARGET_ALLIANCE_REQUIRED': 400,
  'SAME_ALLIANCE': 400, 'NOT_GUILD_LEADER': 403, 'NOT_IN_SOURCE_ALLIANCE': 404,
  'TARGET_ALLIANCE_NOT_FOUND': 404, 'TARGET_ALLIANCE_DISBANDED': 410,
  'TARGET_ALLIANCE_FULL': 409,
};

const REPLAY_ERRORS = {
  'BATTLE_NOT_FOUND': 404, 'BATTLE_NOT_ENDED': 409,
  'NOT_PARTICIPANT': 403, 'REPLAY_LIMIT_REACHED': 429,
};

function handleErr(res, err, errorMap, context) {
  const status = errorMap[err.message];
  if (status) return res.status(status).json({ error: err.message, meta: err.meta });
  console.error(`[phaseD] ${context} error:`, err);
  res.status(500).json({ error: 'SERVER_ERROR' });
}

// ═══════════════════════════════════════════════════════════════
// ALLIANCE
// ═══════════════════════════════════════════════════════════════

router.get('/alliances', async (req, res) => {
  try {
    const list = await alliance.listAlliances();
    res.json({ alliances: list });
  } catch (err) { handleErr(res, err, ALLIANCE_ERRORS, 'list'); }
});

router.get('/alliances/mine', requireAuth, async (req, res) => {
  try {
    const wallet = getWallet(req);
    const myAlliance = await alliance.getMyAlliance(wallet);
    res.json({ alliance: myAlliance });
  } catch (err) { handleErr(res, err, ALLIANCE_ERRORS, 'mine'); }
});

router.get('/alliances/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (!id) return res.status(400).json({ error: 'INVALID_ID' });
    const detail = await alliance.getAlliance(id);
    if (!detail) return res.status(404).json({ error: 'ALLIANCE_NOT_FOUND' });
    res.json({ alliance: detail });
  } catch (err) { handleErr(res, err, ALLIANCE_ERRORS, 'detail'); }
});

router.post('/alliances', requireAuth, async (req, res) => {
  try {
    const wallet = getWallet(req);
    const result = await alliance.createAlliance(wallet, req.body || {});
    res.json(result);
  } catch (err) { handleErr(res, err, ALLIANCE_ERRORS, 'create'); }
});

router.post('/alliances/:id/join', requireAuth, async (req, res) => {
  try {
    const wallet = getWallet(req);
    const id = parseInt(req.params.id);
    if (!id) return res.status(400).json({ error: 'INVALID_ID' });
    const result = await alliance.joinAlliance(wallet, id);
    res.json(result);
  } catch (err) { handleErr(res, err, ALLIANCE_ERRORS, 'join'); }
});

router.post('/alliances/leave', requireAuth, async (req, res) => {
  try {
    const wallet = getWallet(req);
    const result = await alliance.leaveAlliance(wallet);
    res.json(result);
  } catch (err) { handleErr(res, err, ALLIANCE_ERRORS, 'leave'); }
});

router.post('/alliances/team-battle', requireAuth, async (req, res) => {
  try {
    const wallet = getWallet(req);
    const { participants, battle_type } = req.body || {};
    if (!Array.isArray(participants)) {
      return res.status(400).json({ error: 'PARTICIPANTS_REQUIRED' });
    }
    
    // 선언자는 participants에 있어야 함
    if (!participants.some(p => p.wallet === wallet)) {
      return res.status(403).json({ error: 'DECLARER_MUST_PARTICIPATE' });
    }
    
    const result = await alliance.createTeamBattle({ participants, battle_type });
    
    // 즉시 실행
    const battleScheduler = require('../services/battleScheduler');
    battleScheduler.runBattle(result.battle_id).catch(err =>
      console.error(`[phaseD] team battle ${result.battle_id} error:`, err)
    );
    
    res.json(result);
  } catch (err) { handleErr(res, err, ALLIANCE_ERRORS, 'team-battle'); }
});

// ═══════════════════════════════════════════════════════════════
// REPLAY
// ═══════════════════════════════════════════════════════════════

router.post('/replays', requireAuth, async (req, res) => {
  try {
    const wallet = getWallet(req);
    const { battle_id, ...options } = req.body || {};
    if (!battle_id) return res.status(400).json({ error: 'BATTLE_ID_REQUIRED' });
    
    const result = await replayShare.createShare(battle_id, wallet, options);
    res.json(result);
  } catch (err) { handleErr(res, err, REPLAY_ERRORS, 'create'); }
});

router.get('/replays/featured', async (req, res) => {
  try {
    const limit = Math.min(50, parseInt(req.query.limit) || 20);
    const replays = await replayShare.getFeaturedReplays(limit);
    res.json({ replays });
  } catch (err) { handleErr(res, err, REPLAY_ERRORS, 'featured'); }
});

router.get('/replays/mine', requireAuth, async (req, res) => {
  try {
    const wallet = getWallet(req);
    const replays = await replayShare.getMyReplays(wallet);
    res.json({ replays });
  } catch (err) { handleErr(res, err, REPLAY_ERRORS, 'mine'); }
});

router.get('/replays/t/:token', async (req, res) => {
  try {
    const token = req.params.token;
    const viewerIp = req.ip || req.headers['x-forwarded-for']?.split(',')[0];
    const viewerUa = req.headers['user-agent']?.substring(0, 200);
    
    const replay = await replayShare.getReplayByToken(token, viewerIp, viewerUa);
    if (!replay) return res.status(404).json({ error: 'REPLAY_NOT_FOUND_OR_EXPIRED' });
    res.json({ replay });
  } catch (err) { handleErr(res, err, REPLAY_ERRORS, 'token'); }
});

router.delete('/replays/:id', requireAuth, async (req, res) => {
  try {
    const wallet = getWallet(req);
    const id = parseInt(req.params.id);
    if (!id) return res.status(400).json({ error: 'INVALID_ID' });
    const result = await replayShare.deleteReplay(id, wallet);
    if (!result.deleted) return res.status(404).json({ error: 'REPLAY_NOT_FOUND' });
    res.json(result);
  } catch (err) { handleErr(res, err, REPLAY_ERRORS, 'delete'); }
});

// ═══════════════════════════════════════════════════════════════
// GUILD-LEVEL ALLIANCE (M-157 alliance_guilds)
// ═══════════════════════════════════════════════════════════════

// GET /api/alliances/:id/guilds — 동맹의 멤버 길드 목록
router.get('/alliances/:id/guilds', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (!id) return res.status(400).json({ error: 'INVALID_ID' });
    const guilds = await alliance.getAllianceGuilds(id);
    res.json({ guilds });
  } catch (err) { handleErr(res, err, ALLIANCE_ERRORS, 'alliance-guilds'); }
});

// GET /api/guilds/:guildId/alliance — 길드가 속한 동맹
router.get('/guilds/:guildId/alliance', async (req, res) => {
  try {
    const guildId = parseInt(req.params.guildId);
    if (!guildId) return res.status(400).json({ error: 'INVALID_GUILD_ID' });
    const a = await alliance.getMyGuildAlliance(guildId);
    res.json({ alliance: a });
  } catch (err) { handleErr(res, err, ALLIANCE_ERRORS, 'guild-alliance'); }
});

// GET /api/guilds/:guildId/alliance/history
router.get('/guilds/:guildId/alliance/history', async (req, res) => {
  try {
    const guildId = parseInt(req.params.guildId);
    const limit = Math.min(50, parseInt(req.query.limit || '20'));
    const history = await alliance.getGuildAllianceHistory(guildId, limit);
    res.json({ history });
  } catch (err) { handleErr(res, err, ALLIANCE_ERRORS, 'guild-alliance-history'); }
});

// POST /api/alliances/:id/guilds/add — 길드 가입 (initiator: 동맹 리더 OR 길드 리더)
router.post('/alliances/:id/guilds/add', requireAuth, async (req, res) => {
  try {
    const allianceId = parseInt(req.params.id);
    const { guildId } = req.body || {};
    if (!allianceId || !guildId) return res.status(400).json({ error: 'allianceId and guildId required' });
    const wallet = getWallet(req);
    const result = await alliance.addGuildToAlliance(allianceId, parseInt(guildId), wallet);
    res.json(result);
  } catch (err) { handleErr(res, err, ALLIANCE_ERRORS, 'add-guild'); }
});

// POST /api/alliances/:id/guilds/remove — 길드 탈퇴 OR 추방
router.post('/alliances/:id/guilds/remove', requireAuth, async (req, res) => {
  try {
    const allianceId = parseInt(req.params.id);
    const { guildId } = req.body || {};
    if (!allianceId || !guildId) return res.status(400).json({ error: 'allianceId and guildId required' });
    const wallet = getWallet(req);
    const result = await alliance.removeGuildFromAlliance(allianceId, parseInt(guildId), wallet);
    res.json(result);
  } catch (err) { handleErr(res, err, ALLIANCE_ERRORS, 'remove-guild'); }
});

// POST /api/alliances/betray — 배신 (한 동맹에서 다른 동맹으로 즉시 이적)
// { guildId, fromAllianceId, toAllianceId }
router.post('/alliances/betray', requireAuth, async (req, res) => {
  try {
    const wallet = getWallet(req);
    const { guildId, fromAllianceId, toAllianceId } = req.body || {};
    if (!guildId || !fromAllianceId || !toAllianceId) {
      return res.status(400).json({ error: 'guildId, fromAllianceId, toAllianceId required' });
    }
    const result = await alliance.betrayAlliance(
      parseInt(guildId), parseInt(fromAllianceId), parseInt(toAllianceId), wallet
    );
    res.json(result);
  } catch (err) { handleErr(res, err, ALLIANCE_ERRORS, 'betray'); }
});

module.exports = router;
