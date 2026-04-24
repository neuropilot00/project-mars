// server/routes/weatherRoutes.js
// ═══════════════════════════════════════════════════════════════
// Weather API Routes (전략적 이벤트 추가)
//
// 기존 API (유지):
//   GET /api/weather/active           — 현재 활성 날씨
//   GET /api/weather/active/:sectorId — 특정 섹터 날씨
//
// 신규 API:
//   GET  /api/weather/forecasts       — 예정된 예보 목록
//   POST /api/weather/forecast        — 예보 생성 (Admin)
//   DELETE /api/weather/forecast/:id  — 예보 취소 (Admin)
// ═══════════════════════════════════════════════════════════════

const express = require('express');
const router = express.Router();
const weatherService = require('../services/weather');

// ── 인증 (inline JWT) ──
const jwt = require('jsonwebtoken');
const requireAuth = (req, res, next) => {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'UNAUTHORIZED' });
  try { req.user = jwt.verify(token, process.env.JWT_SECRET); next(); }
  catch { return res.status(401).json({ error: 'INVALID_TOKEN' }); }
};

// Admin 체크 — x-admin-secret 헤더 (프로젝트 표준)
function isAdmin(req) {
  const s = req.headers['x-admin-secret'] || req.headers['x-admin-key'];
  return s && s === process.env.ADMIN_SECRET;
}

const ERROR_STATUS = {
  'INVALID_WEATHER_TYPE':  400,
  'SECTOR_ID_REQUIRED':    400,
  'STARTS_AT_REQUIRED':    400,
  'INVALID_STARTS_AT':     400,
  'STARTS_AT_MUST_BE_FUTURE': 400,
  'FORECAST_NOT_FOUND':    404,
};

function handleErr(res, err, context) {
  const status = ERROR_STATUS[err.message];
  if (status) return res.status(status).json({ error: err.message });
  console.error(`[weatherRoutes] ${context} error:`, err);
  res.status(500).json({ error: 'SERVER_ERROR' });
}

// ═══════════════════════════════════════════════════════════════

/**
 * GET /api/weather/forecasts
 * 예정된 전략적 예보 목록 (공개)
 */
router.get('/forecasts', async (req, res) => {
  try {
    const forecasts = await weatherService.getUpcomingForecasts();
    res.json({ forecasts });
  } catch (err) { handleErr(res, err, 'forecasts'); }
});

/**
 * GET /api/weather/active
 * 현재 전체 활성 날씨 (기존 API 유지)
 */
router.get('/active', async (req, res) => {
  try {
    const weather = await weatherService.getActiveWeather();
    res.json({ weather });
  } catch (err) { handleErr(res, err, 'active'); }
});

/**
 * GET /api/weather/active/:sectorId
 * 특정 섹터 현재 날씨 (기존 API 유지)
 */
router.get('/active/:sectorId', async (req, res) => {
  try {
    const sectorId = parseInt(req.params.sectorId);
    if (!sectorId) return res.status(400).json({ error: 'INVALID_SECTOR_ID' });
    const weather = await weatherService.getActiveWeather(sectorId);
    res.json({ weather });
  } catch (err) { handleErr(res, err, 'active-sector'); }
});

/**
 * POST /api/weather/forecast  (Admin 전용)
 * 전략적 날씨 예보 생성
 * Body: {
 *   sector_id, weather_type,
 *   starts_at,          // ISO 날짜 (48시간 이상 미래 권장)
 *   duration_hours?,    // 기본 6
 *   title_ko?,
 *   description_ko?
 * }
 */
router.post('/forecast', requireAuth, async (req, res) => {
  try {
    if (!isAdmin(req)) return res.status(403).json({ error: 'ADMIN_ONLY' });

    const result = await weatherService.createForecast(req.body || {});
    res.json({ success: true, forecast: result });
  } catch (err) { handleErr(res, err, 'create-forecast'); }
});

/**
 * DELETE /api/weather/forecast/:id  (Admin 전용)
 * 예보 취소
 */
router.delete('/forecast/:id', requireAuth, async (req, res) => {
  try {
    if (!isAdmin(req)) return res.status(403).json({ error: 'ADMIN_ONLY' });

    const id = parseInt(req.params.id);
    if (!id) return res.status(400).json({ error: 'INVALID_ID' });

    const result = await weatherService.cancelForecast(id);
    res.json({ success: true, cancelled: result });
  } catch (err) { handleErr(res, err, 'cancel-forecast'); }
});

module.exports = router;
