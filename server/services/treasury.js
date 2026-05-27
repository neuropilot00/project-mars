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
// 호출 전 해당 유저 행을 FOR UPDATE 로 이미 잠근 상태여야 한다.
async function lockRoom(client) {
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
