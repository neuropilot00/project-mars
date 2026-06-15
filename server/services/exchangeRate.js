// server/services/exchangeRate.js
// ─────────────────────────────────────────────────────────────
// 동적 PP↔GP 환율 재계산(migration 233) + 자가보정(self-calibration, mig327).
//
// EVE 충실 + 무인 운영(hands-off):
//   - 자가보정 ON(pp_to_gp_auto_calibrate, 기본 ON)이면 target/min_activity 를 사람이 안 잡는다.
//     · 부트스트랩: 최근 window_days 중 활동일(volume>0)이 min_active_days 미만이면 실시장이 아직
//       없다고 보고 환율을 base(중립)로 "유지"만 한다 → 저볼륨 천장 드리프트(=GP 인플레) 원천 차단.
//     · 실데이터 충분: target = 최근 일일 환전량의 "중앙값"(스파이크에 강건), min_activity = target×frac.
//       그 위에서 24h 수요 D 를 target 과 비교해 양방향 밴딩(EVE식 수급 변동).
//   - 자가보정 OFF면 기존처럼 고정 settings(target/min_activity)를 사용.
//
// 밴딩 규칙(공통): D>target → rate↓(GP 인플레 억제), D<target → rate↑. 1회 ≤ max_step,
//   [floor, ceil] 하드밴드. 결과를 settings.pp_to_gp_exchange_rate 에 기록(기존 read 경로 무변경).
// ─────────────────────────────────────────────────────────────
const { pool, getSetting } = require('../db');

function median(nums) {
  if (!nums.length) return 0;
  const a = nums.slice().sort((x, y) => x - y);
  const m = a.length >> 1;
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}

async function setSetting(key, valueStr) {
  // settings.value 는 JSONB. 숫자/불린 문자열을 jsonb 로 저장. best-effort.
  try { await pool.query(`UPDATE settings SET value = $1::jsonb WHERE key = $2`, [String(valueStr), key]); } catch (_) {}
}

async function recomputeRate() {
  const dynamicOn = String(await getSetting('pp_to_gp_dynamic_enabled', 'false')) === 'true';
  if (!dynamicOn) return { skipped: true, reason: 'disabled' };

  const prev    = parseFloat(await getSetting('pp_to_gp_exchange_rate', '10')) || 10;
  const floor   = parseFloat(await getSetting('pp_to_gp_rate_floor', '5')) || 5;
  const ceil    = parseFloat(await getSetting('pp_to_gp_rate_ceil', '20')) || 20;
  const maxStep = (parseFloat(await getSetting('pp_to_gp_rate_max_step_pct', '2')) || 2) / 100;
  const base    = parseFloat(await getSetting('pp_to_gp_rate_base', '10')) || 10; // 부트스트랩 중립 환율
  const autoCal = String(await getSetting('pp_to_gp_auto_calibrate', 'true')) === 'true';

  if (!(floor > 0) || !(ceil >= floor)) return { skipped: true, reason: 'bad_band' };

  let target, minActivity;

  if (autoCal) {
    // ── 자가보정: 최근 window 의 일별 환전량으로 target/min_activity 자동 산출 ──
    const winDays      = Math.max(3, parseInt(await getSetting('pp_to_gp_calib_window_days', '14'), 10) || 14);
    const minActiveDays = Math.max(1, parseInt(await getSetting('pp_to_gp_calib_min_active_days', '5'), 10) || 5);
    const minActFrac   = Math.min(0.9, Math.max(0, parseFloat(await getSetting('pp_to_gp_calib_min_activity_frac', '0.25')) || 0.25));

    let dayVols = [];
    try {
      const r = await pool.query(
        `SELECT COALESCE(SUM(pp_amount), 0) AS v
           FROM transactions
          WHERE type = 'pp_to_gp_exchange' AND created_at > NOW() - ($1 || ' days')::interval
          GROUP BY date_trunc('day', created_at)`, [String(winDays)]);
      dayVols = r.rows.map(x => parseFloat(x.v) || 0).filter(v => v > 0);
    } catch (_) { return { skipped: true, reason: 'calib_query_failed' }; }

    // 부트스트랩: 실시장 신호 부족 → 중립 base 로 유지(드리프트 금지)
    if (dayVols.length < minActiveDays) {
      const want = Math.round(base * 10000) / 10000;
      if (Math.abs(prev - want) > 1e-9) await setSetting('pp_to_gp_exchange_rate', want);
      return { skipped: true, reason: 'bootstrapping', activeDays: dayVols.length, needed: minActiveDays, heldRate: want };
    }

    target = median(dayVols);
    if (!(target > 0)) return { skipped: true, reason: 'zero_target' };
    minActivity = target * minActFrac;
    // 산출값을 settings 에 반영(어드민/모니터 가시성). 기존 read 경로와 호환.
    await setSetting('pp_to_gp_exchange_daily_vol_target', Math.round(target * 100) / 100);
    await setSetting('pp_to_gp_exchange_min_activity', Math.round(minActivity * 100) / 100);
  } else {
    target      = parseFloat(await getSetting('pp_to_gp_exchange_daily_vol_target', '1000')) || 1000;
    minActivity = parseFloat(await getSetting('pp_to_gp_exchange_min_activity', '0')) || 0;
  }

  // 24h PP→GP 환전 거래량(PP 기준)
  let D = 0;
  try {
    const r = await pool.query(
      `SELECT COALESCE(SUM(pp_amount), 0) AS v FROM transactions
        WHERE type = 'pp_to_gp_exchange' AND created_at > NOW() - INTERVAL '24 hours'`);
    D = parseFloat(r.rows[0]?.v || 0) || 0;
  } catch (_) { return { skipped: true, reason: 'vol_query_failed' }; }

  // 신호 부족 → 환율 유지(노이즈 드리프트 방지)
  if (D < minActivity) return { skipped: true, reason: 'low_activity', rate: prev, vol24h: D, minActivity, target };

  // 수요 편차를 변동률로 환산(D>target → 음수 → rate 하락), step cap 적용
  let deltaFrac = -maxStep * ((D - target) / target);
  if (deltaFrac > maxStep) deltaFrac = maxStep;
  if (deltaFrac < -maxStep) deltaFrac = -maxStep;

  let newRate = prev * (1 + deltaFrac);
  if (newRate < floor) newRate = floor;
  if (newRate > ceil) newRate = ceil;
  newRate = Math.round(newRate * 10000) / 10000;

  if (Math.abs(newRate - prev) < 1e-9) {
    return { skipped: true, reason: 'no_change', rate: prev, vol24h: D, target };
  }

  await setSetting('pp_to_gp_exchange_rate', newRate);
  await pool.query(
    `INSERT INTO pp_gp_rate_history (rate, prev_rate, exchange_vol_24h, vol_target) VALUES ($1, $2, $3, $4)`,
    [newRate, prev, D, target]
  ).catch(() => {});

  console.log(`[exchangeRate] PP→GP ${prev} → ${newRate} (24h ${Math.round(D)}, target ${Math.round(target)}${autoCal ? ' auto' : ''})`);
  return { rate: newRate, prevRate: prev, vol24h: D, target, autoCalibrated: autoCal };
}

module.exports = { recomputeRate };
