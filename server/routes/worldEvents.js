// server/routes/worldEvents.js
// ═══════════════════════════════════════════════════════════════
// World Events API (Migration 154)
//
// GET    /api/world-events              — 활성 이벤트 목록 (공개)
// GET    /api/world-events/:id          — 이벤트 상세 + 참여자 랭킹 (공개)
// POST   /api/world-events/:id/engage   — 교전 신청 (지갑 필요)
//
// 어드민 전용 (x-admin-secret 헤더):
// POST   /api/admin/world-events/spawn   — 수동 스폰
// POST   /api/admin/world-events/:id/force-end — 강제 종료
// ═══════════════════════════════════════════════════════════════

const express = require('express');
const router = express.Router();
const we = require('../services/worldEvents');

const jwt = require('jsonwebtoken');
function getWallet(req) {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  if (token && process.env.JWT_SECRET) {
    try {
      const p = jwt.verify(token, process.env.JWT_SECRET);
      return (p.wallet_address || p.wallet || p.walletAddress || '').toLowerCase().trim();
    } catch (_) {}
  }
  return String(req.body?.wallet || req.headers['x-wallet'] || req.query?.wallet || '')
    .toLowerCase().trim();
}

const ERROR_STATUS = {
  EVENT_NOT_FOUND: 404,
  EVENT_NOT_ENGAGEABLE: 409,
  EVENT_EXPIRED: 410,
  EVENT_HAS_NO_FLEET: 500,
  FLEET_NOT_FOUND: 404,
  NOT_FLEET_OWNER: 403,
  NPC_CANNOT_ENGAGE: 400,
  FLEET_BUSY: 409,
  INSUFFICIENT_SHIPS: 400,
  ENGAGE_COOLDOWN: 429,
  VOID_RAIDER_DISABLED: 403,
  MAX_CONCURRENT_REACHED: 409,
  NO_TARGET_SECTOR: 500,
  SHIP_TYPE_NOT_FOUND: 404,
  BATTLE_SCHEDULER_NOT_AVAILABLE: 500,
};

function sendErr(res, err) {
  const code = err.message || 'server_error';
  const status = ERROR_STATUS[code] || 500;
  if (status >= 500) console.error('[worldEventsRoute]', err);
  const body = { error: code };
  if (err.meta) body.meta = err.meta;
  res.status(status).json(body);
}

// ─── 공개 ───
router.get('/world-events', async (_req, res) => {
  try {
    const events = await we.listActiveEvents();
    res.json({ events });
  } catch (err) { sendErr(res, err); }
});

router.get('/world-events/:id', async (req, res) => {
  const id = parseInt(req.params.id);
  if (!id) return res.status(400).json({ error: 'invalid_id' });
  try {
    const event = await we.getEventDetail(id);
    if (!event) return res.status(404).json({ error: 'EVENT_NOT_FOUND' });
    res.json(event);
  } catch (err) { sendErr(res, err); }
});

// ─── 교전 ───
router.post('/world-events/:id/engage', async (req, res) => {
  const wallet = getWallet(req);
  if (!wallet || wallet.length < 10) return res.status(401).json({ error: 'wallet_required' });
  const id = parseInt(req.params.id);
  if (!id) return res.status(400).json({ error: 'invalid_id' });
  const { fleet_id, fleetId } = req.body || {};
  const fid = parseInt(fleet_id || fleetId);
  if (!fid) return res.status(400).json({ error: 'fleet_id_required' });
  try {
    const result = await we.engageEvent(id, wallet, fid);
    res.json({ success: true, ...result });
  } catch (err) { sendErr(res, err); }
});

// ─── 어드민: 수동 스폰 ───
function requireAdmin(req, res) {
  const s = req.headers['x-admin-secret'] || req.headers['x-admin-key'];
  if (!s || s !== process.env.ADMIN_SECRET) {
    res.status(403).json({ error: 'forbidden' });
    return false;
  }
  return true;
}

router.post('/admin/world-events/spawn', async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const { sector_id, ship_type_code, ship_count, duration_hours } = req.body || {};
  try {
    const event = await we.spawnVoidRaider({
      sectorId: sector_id ? parseInt(sector_id) : undefined,
      shipTypeCode: ship_type_code,
      shipCount: ship_count,
      durationHours: duration_hours,
      createdBy: 'admin',
    });
    res.json({ success: true, event });
  } catch (err) { sendErr(res, err); }
});

router.post('/admin/world-events/:id/force-end', async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const id = parseInt(req.params.id);
  if (!id) return res.status(400).json({ error: 'invalid_id' });
  try {
    const { rows } = await require('../db').pool.query(
      `UPDATE world_events SET status='expired', resolution='expired', resolved_at=NOW(), ends_at=NOW()
        WHERE id=$1 AND status IN ('active','engaged') RETURNING *`,
      [id]
    );
    if (!rows.length) return res.status(404).json({ error: 'EVENT_NOT_FOUND_OR_ENDED' });
    // 결산 한 번 돌리기
    setImmediate(() => we.settleExpiredEvents().catch(()=>{}));
    res.json({ success: true, event: rows[0] });
  } catch (err) { sendErr(res, err); }
});

module.exports = router;
