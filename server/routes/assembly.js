// server/routes/assembly.js
// ═══════════════════════════════════════════════════════════════
// 합체 슈퍼유닛 API — P1 수집·합체 코어
// GET  /api/assembly/state            — 5파츠 보유/조각/합체 가능 여부
// POST /api/assembly/assemble         — 합체 실행
// POST /api/assembly/disassemble      — 해체 (body: ship_id)
// POST /api/assembly/exchange         — 조각으로 파츠 교환 (body: part_code)
// POST /api/assembly/admin/grant      — 어드민 파츠 지급 (x-admin-secret)
// ═══════════════════════════════════════════════════════════════

const express = require('express');
const router = express.Router();
const assembly = require('../services/assembly');

function getWallet(req) {
  return (req.body?.wallet || req.query.wallet || req.headers['x-wallet'] || '').toLowerCase().trim();
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

router.get('/assembly/state', async (req, res) => {
  const w = requireWallet(req, res); if (!w) return;
  try { res.json(await assembly.getState(w)); }
  catch (e) { console.error('[assembly/state]', e.message); res.status(500).json({ error: 'internal_error' }); }
});

router.post('/assembly/assemble', async (req, res) => {
  const w = requireWallet(req, res); if (!w) return;
  try {
    const r = await assembly.assemble(w);
    if (r.error) return res.status(400).json(r);
    res.json(r);
  } catch (e) { console.error('[assembly/assemble]', e.message); res.status(500).json({ error: 'internal_error' }); }
});

router.post('/assembly/disassemble', async (req, res) => {
  const w = requireWallet(req, res); if (!w) return;
  try {
    const r = await assembly.disassemble(req.body?.ship_id, w);
    if (r.error) return res.status(400).json(r);
    res.json(r);
  } catch (e) { console.error('[assembly/disassemble]', e.message); res.status(500).json({ error: 'internal_error' }); }
});

router.post('/assembly/exchange', async (req, res) => {
  const w = requireWallet(req, res); if (!w) return;
  try {
    const r = await assembly.exchangeShards(w, req.body?.part_code);
    if (r.error) return res.status(400).json(r);
    res.json(r);
  } catch (e) { console.error('[assembly/exchange]', e.message); res.status(500).json({ error: 'internal_error' }); }
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
