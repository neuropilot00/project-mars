// server/routes/assembly.js
// ═══════════════════════════════════════════════════════════════
// 합체/수집형 한정 유닛 API (unit-aware)
// GET  /api/assembly/units            — 활성 유닛 목록 + 유닛별 요약
// GET  /api/assembly/state            — 단일 유닛 상세 (?unit_code, 미지정 시 첫 활성)
// POST /api/assembly/pull             — 가챠 (body: unit_code, count)
// POST /api/assembly/assemble         — 합체 (body: unit_code)
// POST /api/assembly/disassemble      — 해체 (body: ship_id)
// POST /api/assembly/exchange         — 조각 교환 (body: unit_code, part_code)
// POST /api/assembly/admin/grant      — 어드민 파츠 지급 (x-admin-secret)
// ═══════════════════════════════════════════════════════════════

const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const assembly = require('../services/assembly');

// [v7.364][P0 보안] 지갑 액션은 반드시 JWT에서만 wallet 추출.
// 기존엔 spoofable client wallet으로 타인 GP/조각/합체함선을 차감·파괴 가능한 인증 우회였음.
const requireAuth = (req, res, next) => {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'UNAUTHORIZED' });
  try { req.user = jwt.verify(token, process.env.JWT_SECRET); next(); }
  catch { return res.status(401).json({ error: 'INVALID_TOKEN' }); }
};
function getWallet(req) {
  return (req.user?.wallet_address || req.user?.wallet || req.user?.walletAddress || '').toLowerCase().trim();
}
function requireWallet(req, res) {
  const w = getWallet(req);
  if (!w || w.length < 10) { res.status(400).json({ error: 'wallet_required' }); return null; }
  return w;
}
function requireAdmin(req, res) {
  const s = req.headers['x-admin-secret'] || req.headers['x-admin-key'];
  if (!s || s !== process.env.ADMIN_SECRET) { res.status(403).json({ error: 'forbidden' }); return false; }
  return true;
}
function unitOf(req) { return req.body?.unit_code || req.query.unit_code || null; }

router.get('/assembly/units', requireAuth, async (req, res) => {
  const w = requireWallet(req, res); if (!w) return;
  try { res.json(await assembly.listUnits(w)); }
  catch (e) { console.error('[assembly/units]', e.message); res.status(500).json({ error: 'internal_error' }); }
});

router.get('/assembly/state', requireAuth, async (req, res) => {
  const w = requireWallet(req, res); if (!w) return;
  try {
    const r = await assembly.getState(w, unitOf(req));
    if (r.error) return res.status(r.error === 'UNIT_NOT_FOUND' ? 404 : 400).json(r);
    res.json(r);
  } catch (e) { console.error('[assembly/state]', e.message); res.status(500).json({ error: 'internal_error' }); }
});

router.post('/assembly/pull', requireAuth, async (req, res) => {
  const w = requireWallet(req, res); if (!w) return;
  try {
    const r = await assembly.pull(w, unitOf(req), req.body?.count);
    if (r.error) return res.status(400).json(r);
    res.json(r);
  } catch (e) { console.error('[assembly/pull]', e.message); res.status(500).json({ error: 'internal_error' }); }
});

router.post('/assembly/assemble', requireAuth, async (req, res) => {
  const w = requireWallet(req, res); if (!w) return;
  try {
    const r = await assembly.assemble(w, unitOf(req));
    if (r.error) return res.status(400).json(r);
    res.json(r);
  } catch (e) { console.error('[assembly/assemble]', e.message); res.status(500).json({ error: 'internal_error' }); }
});

router.post('/assembly/disassemble', requireAuth, async (req, res) => {
  const w = requireWallet(req, res); if (!w) return;
  try {
    const r = await assembly.disassemble(req.body?.ship_id, w);
    if (r.error) return res.status(400).json(r);
    res.json(r);
  } catch (e) { console.error('[assembly/disassemble]', e.message); res.status(500).json({ error: 'internal_error' }); }
});

router.post('/assembly/exchange', requireAuth, async (req, res) => {
  const w = requireWallet(req, res); if (!w) return;
  try {
    const r = await assembly.exchangeShards(w, unitOf(req), req.body?.part_code);
    if (r.error) return res.status(400).json(r);
    res.json(r);
  } catch (e) { console.error('[assembly/exchange]', e.message); res.status(500).json({ error: 'internal_error' }); }
});

router.get('/assembly/box', requireAuth, async (req, res) => {
  const w = requireWallet(req, res); if (!w) return;
  try { res.json(await assembly.boxState(w)); }
  catch (e) { console.error('[assembly/box]', e.message); res.status(500).json({ error: 'internal_error' }); }
});

router.post('/assembly/box/pull', requireAuth, async (req, res) => {
  const w = requireWallet(req, res); if (!w) return;
  try {
    const r = await assembly.pullBox(w, req.body?.count);
    if (r.error) return res.status(400).json(r);
    res.json(r);
  } catch (e) { console.error('[assembly/box/pull]', e.message); res.status(500).json({ error: 'internal_error' }); }
});

router.post('/assembly/admin/grant', async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const w = (req.body?.wallet || '').toLowerCase().trim();
  if (!w) return res.status(400).json({ error: 'wallet_required' });
  try {
    const r = await assembly.grantParts(w, req.body?.part_code, req.body?.qty);
    if (r.error) return res.status(400).json(r);
    res.json(r);
  } catch (e) { console.error('[assembly/admin/grant]', e.message); res.status(500).json({ error: 'internal_error' }); }
});

module.exports = router;
