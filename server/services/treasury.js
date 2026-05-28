// server/services/treasury.js
// ─────────────────────────────────────────────────────────────
// USDT 담보(collateral) 원장 헬퍼 — 뱅크런 구조적 차단(migration 230).
//
// 불변식: SUM(users.usdt_balance) ≤ treasury_ledger.collateral_usdt
//   room = collateral - SUM(usdt_balance) = "담보 없이 추가 발행 가능한 USDT".
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
  const collateral = parseFloat(col.rows[0]?.collateral_usdt ?? 0) || 0;
  const liab = await client.query('SELECT COALESCE(SUM(usdt_balance), 0) AS s FROM users');
  const liability = parseFloat(liab.rows[0]?.s ?? 0) || 0;
  return { collateral, liability, room: Math.round((collateral - liability) * 1000000) / 1000000 };
}

// 담보 가감(deposit=+amount, withdraw=-amount, operator topup=+amount).
async function adjustCollateral(client, delta) {
  const d = Number(delta) || 0;
  if (d === 0) return;
  await client.query(
    'UPDATE treasury_ledger SET collateral_usdt = collateral_usdt + $1, updated_at = NOW() WHERE id = 1',
    [d]
  );
}

// 솔벤시 가드 on/off (기본 on). settings.swap_solvency_guard_enabled
async function guardEnabled(getSetting) {
  try {
    const v = await getSetting('swap_solvency_guard_enabled', 'true');
    return String(v) === 'true';
  } catch (_) {
    return true; // 안전 기본값: 켜짐
  }
}

module.exports = { lockRoom, adjustCollateral, guardEnabled };
