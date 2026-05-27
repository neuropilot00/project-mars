// server/services/exchangeRate.js
// ─────────────────────────────────────────────────────────────
// 동적 PP↔GP 환율 재계산(migration 233). 기본 OFF.
//
// 규칙: 24h PP→GP 환전 수요 D 를 목표(target)와 비교.
//   D > target → GP 수요 과열 → rate↓(PP당 GP 적게) → GP 인플레 억제.
//   D < target → rate↑(ceil 한도).
//   1회 변동 ≤ max_step_pct, [floor, ceil] 하드밴드, 봇 단일 펌핑 방어.
//   결과를 settings.pp_to_gp_exchange_rate 에 기록(기존 read 경로 무변경) + history INSERT.
// ─────────────────────────────────────────────────────────────
const { pool, getSetting } = require('../db');

async function recomputeRate() {
  const dynamicOn = String(await getSetting('pp_to_gp_dynamic_enabled', 'false')) === 'true';
  if (!dynamicOn) return { skipped: true, reason: 'disabled' };

  const prev   = parseFloat(await getSetting('pp_to_gp_exchange_rate', '10')) || 10;
  const floor  = parseFloat(await getSetting('pp_to_gp_rate_floor', '5')) || 5;
  const ceil   = parseFloat(await getSetting('pp_to_gp_rate_ceil', '20')) || 20;
  const maxStep = (parseFloat(await getSetting('pp_to_gp_rate_max_step_pct', '2')) || 2) / 100;
  const target = parseFloat(await getSetting('pp_to_gp_exchange_daily_vol_target', '1000')) || 1000;
  // 최소 활동 임계치: 24h 거래량이 이보다 적으면 "신호 없음"으로 보고 환율 유지(저활동 시 ceil 로
  // 무의미하게 드리프트하는 것 방지). 기본 0 이지만 운영 시 target 의 일부로 설정 권장.
  const minActivity = parseFloat(await getSetting('pp_to_gp_exchange_min_activity', '0')) || 0;

  if (!(floor > 0) || !(ceil >= floor)) return { skipped: true, reason: 'bad_band' };

  // 24h PP→GP 환전 거래량(PP 기준)
  let D = 0;
  try {
    const r = await pool.query(
      `SELECT COALESCE(SUM(pp_amount), 0) AS v FROM transactions
        WHERE type = 'pp_to_gp_exchange' AND created_at > NOW() - INTERVAL '24 hours'`);
    D = parseFloat(r.rows[0]?.v || 0) || 0;
  } catch (_) { return { skipped: true, reason: 'vol_query_failed' }; }

  // 신호 부족 → 환율 유지(드리프트 방지)
  if (D < minActivity) return { skipped: true, reason: 'low_activity', rate: prev, vol24h: D, minActivity };

  // 수요 편차를 변동률로 환산(부호: D>target → 음수 → rate 하락), step cap 적용
  let deltaFrac = -maxStep * ((D - target) / target);
  if (deltaFrac > maxStep) deltaFrac = maxStep;
  if (deltaFrac < -maxStep) deltaFrac = -maxStep;

  let newRate = prev * (1 + deltaFrac);
  if (newRate < floor) newRate = floor;
  if (newRate > ceil) newRate = ceil;
  newRate = Math.round(newRate * 10000) / 10000;

  if (Math.abs(newRate - prev) < 1e-9) {
    return { skipped: true, reason: 'no_change', rate: prev, vol24h: D };
  }

  // settings 갱신(JSONB 숫자) + 히스토리 기록
  await pool.query(`UPDATE settings SET value = $1::jsonb WHERE key = 'pp_to_gp_exchange_rate'`, [String(newRate)]);
  await pool.query(
    `INSERT INTO pp_gp_rate_history (rate, prev_rate, exchange_vol_24h, vol_target) VALUES ($1, $2, $3, $4)`,
    [newRate, prev, D, target]
  ).catch(() => {});

  console.log(`[exchangeRate] PP→GP rate ${prev} → ${newRate} (24h vol ${D}, target ${target})`);
  return { rate: newRate, prevRate: prev, vol24h: D, target };
}

module.exports = { recomputeRate };
