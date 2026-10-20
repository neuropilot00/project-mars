// server/services/treasury.js
// ─────────────────────────────────────────────────────────────
// USDT 담보(collateral) 원장 헬퍼 — 뱅크런 구조적 차단(migration 230).
//
// Reservations debit accounting collateral by net and user balance by gross.
// Pending gross remains a refundable customer claim until final settlement.
// Tracked reserve before reservations = accounting collateral + pending net;
// total customer claims = available USDT balances + pending gross.
// room is the difference, including a hold for refundable pending fees.
// This ledger is NOT a measurement of physical on-chain token custody.
//   PP→USDT 환금(/swap, /withdraw-all 의 PP유래분)은 room 이내만 허용.
//
// 모든 함수는 호출자의 트랜잭션 client 를 받아 같은 BEGIN/COMMIT 안에서 동작한다.
// 락 순서: 항상 users 행을 먼저 잠근 뒤 treasury_ledger 를 잠근다(데드락 회피).
// ─────────────────────────────────────────────────────────────

// treasury_ledger 행을 FOR UPDATE 로 잠그고 현재 담보/부채/여유분을 반환.
// [v7.166] contract 강제화 — 호출자가 lockedWallet 을 명시하면 해당 행도 FOR UPDATE 잠금 확정.
//   호출자가 깜빡해도 여기서 추가 잠금이 idempotent (이미 잠긴 경우 no-op).
//   기존 callers(호환): wallet 인자 안 줘도 동작 (legacy contract — 호출자 책임).
async function lockRoom(client, lockedWallet) {
  if (lockedWallet) {
    // 안전망 — 호출자가 이미 잠갔다고 contract 이지만 한 번 더 보장. 잠겨있으면 즉시 통과.
    await client.query('SELECT 1 FROM users WHERE LOWER(wallet_address) = LOWER($1) FOR UPDATE', [lockedWallet]);
  }
  const col = await client.query('SELECT collateral_usdt FROM treasury_ledger WHERE id = 1 FOR UPDATE');
  if (col.rows.length !== 1) throw new Error('Treasury ledger unavailable');
  const collateral = financialNumber(col.rows[0].collateral_usdt, 'collateral');
  const liab = await client.query('SELECT COALESCE(SUM(usdt_balance), 0) AS s FROM users');
  const liability = financialNumber(liab.rows[0]?.s, 'available USDT claims');
  const pending = await client.query(`SELECT COALESCE(SUM(gross), 0) AS gross, COALESCE(SUM(net), 0) AS net FROM pending_withdrawals WHERE status = 'pending'`);
  const pendingGross = financialNumber(pending.rows[0]?.gross, 'pending gross');
  const pendingNet = financialNumber(pending.rows[0]?.net, 'pending net');
  const trackedReserve = collateral + pendingNet;
  const customerClaims = liability + pendingGross;
  return { collateral, liability, pendingGross, pendingNet, trackedReserve, customerClaims,
    pendingPayoutClaims: pendingNet, totalPayoutClaims: liability + pendingNet, pendingFeeHold: pendingGross - pendingNet,
    physicalReserve: null, // No RPC/custody measurement is performed by this DB helper.
    room: Math.round((trackedReserve - customerClaims) * 1000000) / 1000000 };
}

function financialNumber(raw, name, { min = 0, max = Infinity } = {}) {
  if (raw == null || typeof raw === 'boolean' || String(raw).trim() === '') throw new Error('Invalid financial configuration: ' + name);
  const value = Number(raw);
  if (!Number.isFinite(value) || value < min || value > max) throw new Error('Invalid financial configuration: ' + name);
  return value;
}

function financialBoolean(raw, name) {
  if (String(raw) !== 'true' && String(raw) !== 'false') throw new Error('Invalid financial configuration: ' + name);
  return String(raw) === 'true';
}

// 담보 가감(deposit=+amount, withdraw=-amount, operator topup=+amount).
async function adjustCollateral(client, delta) {
  const d = financialNumber(delta, 'collateral adjustment', { min: -Infinity });
  if (d === 0) return;
  const result = await client.query(
    'UPDATE treasury_ledger SET collateral_usdt = collateral_usdt + $1, updated_at = NOW() WHERE id = 1',
    [d]
  );
  if (result.rowCount !== 1) throw new Error('Treasury ledger unavailable');
}

// 솔벤시 가드 on/off (기본 on). settings.swap_solvency_guard_enabled
async function guardEnabled(getSetting) {
  try {
    const v = await getSetting('swap_solvency_guard_enabled', 'true');
    return financialBoolean(v, 'swap_solvency_guard_enabled');
  } catch (_) {
    return true; // 안전 기본값: 켜짐
  }
}

// ─────────────────────────────────────────────────────────────
// [경제정책 W4-6] 환매(PP→USDT) 한도 체크 — docs/ECONOMY_TOKEN_POLICY_2026-05-29.md
//   주간 환매 한도: max(floor, 주간 신규입금 USDT × pct%) — 환매 부채를 매출에 연동.
//   유저 일일 한도: redemption_daily_limit_usdt (0 = 무제한).
// 호출자의 트랜잭션 client 안에서, 잔액 변경 "전"에 호출(현재 진행 row 미포함 집계).
// 환매로 집계하는 USDT: swap.usdt_amount + withdraw_all 의 PP유래분(pp_amount - fee).
// 반환: { ok:true } 또는 { ok:false, code, ...진단 }. fail-CLOSED 는 호출자 책임(여기선 throw 안 함).
// ─────────────────────────────────────────────────────────────
const REDEEM_SUM_EXPR = `COALESCE(SUM(
  CASE WHEN type = 'swap' THEN COALESCE(usdt_amount, 0)
       WHEN type = 'withdraw_all' THEN GREATEST(COALESCE(pp_amount, 0) - COALESCE(fee, 0), 0)
       ELSE 0 END), 0)`;

async function checkRedemptionLimits(client, opts, getSetting) {
  const wallet = (opts && opts.wallet ? String(opts.wallet) : '').toLowerCase();
  const redeemUsdt = financialNumber(opts && opts.redeemUsdt, 'redemption amount');
  if (redeemUsdt <= 0) return { ok: true };

  // ── 유저 일일 한도 ──
  // Serialize global weekly-cap check + transaction insertion even if the
  // collateral guard is disabled. User locks are already held by callers.
  await client.query("SELECT pg_advisory_xact_lock(hashtext('redemption_limits'))");
  const dailyLimit = financialNumber(await getSetting('redemption_daily_limit_usdt', '0'), 'redemption_daily_limit_usdt');
  if (dailyLimit > 0 && wallet) {
    const dr = await client.query(
      `SELECT ${REDEEM_SUM_EXPR} AS used FROM transactions
       WHERE LOWER(from_wallet) = $1 AND created_at > NOW() - INTERVAL '24 hours'`,
      [wallet]
    );
    const used = parseFloat(dr.rows[0]?.used || 0) || 0;
    if (used + redeemUsdt > dailyLimit + 1e-9) {
      return { ok: false, code: 'redemption_daily_limit', limit: dailyLimit, used, requested: redeemUsdt };
    }
  }

  // ── 주간 글로벌 한도 (게이트 off 면 스킵) ──
  const weeklyEnabled = financialBoolean(await getSetting('redemption_weekly_cap_enabled', 'false'), 'redemption_weekly_cap_enabled');
  if (weeklyEnabled) {
    const pct = financialNumber(await getSetting('redemption_weekly_cap_pct', '30'), 'redemption_weekly_cap_pct');
    const floorUsdt = financialNumber(await getSetting('redemption_weekly_cap_floor_usdt', '100'), 'redemption_weekly_cap_floor_usdt');
    const dep = await client.query(
      `SELECT COALESCE(SUM(COALESCE(usdt_amount, 0)), 0) AS s FROM transactions
       WHERE type = 'deposit' AND created_at > NOW() - INTERVAL '7 days'`
    );
    const weeklyDeposits = parseFloat(dep.rows[0]?.s || 0) || 0;
    const cap = Math.max(floorUsdt, weeklyDeposits * (pct / 100));
    const red = await client.query(
      `SELECT ${REDEEM_SUM_EXPR} AS used FROM transactions
       WHERE created_at > NOW() - INTERVAL '7 days'`
    );
    const weeklyRedeemed = parseFloat(red.rows[0]?.used || 0) || 0;
    if (weeklyRedeemed + redeemUsdt > cap + 1e-9) {
      return { ok: false, code: 'redemption_weekly_cap', cap, weeklyRedeemed, weeklyDeposits, requested: redeemUsdt };
    }
  }

  return { ok: true };
}

// redeemable_pp 게이팅 on/off (기본 on). settings.redeemable_pp_gating_enabled
async function redeemableGatingEnabled(getSetting) {
  try {
    return financialBoolean(await getSetting('redeemable_pp_gating_enabled', 'true'), 'redeemable_pp_gating_enabled');
  } catch (_) {
    return true; // 안전 기본값: 켜짐(채굴 PP USDT 직행 차단)
  }
}

module.exports = { lockRoom, adjustCollateral, guardEnabled, checkRedemptionLimits, redeemableGatingEnabled, financialNumber, financialBoolean };
