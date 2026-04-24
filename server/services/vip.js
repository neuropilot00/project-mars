'use strict';
// server/services/vip.js
// VIP Pass System — 올바른 테이블 사용 버전
// - settings (not game_settings)
// - users.gp_balance (not gp_balances)

const { pool, getSetting, logGPActivity } = require('../db');

// ── VIP 티어 목록 ─────────────────────────────────────────────────────────────
async function getTiers() {
  const { rows } = await pool.query(
    'SELECT * FROM vip_tiers WHERE is_active = true ORDER BY sort_order, cost_gp'
  );
  return rows;
}

// ── 플레이어 활성 VIP 패스 조회 ───────────────────────────────────────────────
async function getMyPass(wallet) {
  const { rows } = await pool.query(
    `SELECT vp.*, vt.name AS tier_name, vt.badge, vt.badge_color,
            vt.mining_boost_pct, vt.fee_discount_pct, vt.gp_earn_bonus_pct, vt.max_lucky_per_day
     FROM vip_passes vp
     JOIN vip_tiers vt ON vt.id = vp.tier_id
     WHERE vp.wallet = $1 AND vp.is_active = true AND vp.expires_at > NOW()`,
    [wallet.toLowerCase()]
  );
  return rows[0] || null;
}

// ── 방어/채굴 체크용 ──────────────────────────────────────────────────────────
async function getVipInfo(wallet) {
  return getMyPass(wallet);
}

// ── VIP 채굴 보너스 배율 (1.0 = 없음) ────────────────────────────────────────
async function getMiningBoost(wallet) {
  const pass = await getMyPass(wallet);
  if (!pass) return 1.0;
  return 1 + pass.mining_boost_pct / 100;
}

// ── VIP GP 획득 보너스 배율 ───────────────────────────────────────────────────
async function getGPEarnBonus(wallet) {
  const pass = await getMyPass(wallet);
  if (!pass) return 1.0;
  return 1 + pass.gp_earn_bonus_pct / 100;
}

// ── VIP 패스 구매 / 갱신 ─────────────────────────────────────────────────────
async function purchasePass(wallet, tierId) {
  const w = wallet.toLowerCase();

  const enabled = await getSetting('vip_enabled', 'true');
  if (String(enabled) === 'false') throw new Error('VIP system is disabled');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 티어 확인
    const { rows: tierRows } = await client.query(
      'SELECT * FROM vip_tiers WHERE id = $1 AND is_active = true', [tierId]
    );
    if (!tierRows.length) throw new Error('VIP tier not found');
    const tier = tierRows[0];

    // GP 잔액 확인
    const { rows: balRows } = await client.query(
      'SELECT gp_balance FROM users WHERE wallet_address = $1 FOR UPDATE', [w]
    );
    if (!balRows.length) throw new Error('User not found');
    const gpBal = parseFloat(balRows[0].gp_balance) || 0;
    const cost = parseFloat(tier.cost_gp);
    if (gpBal < cost) throw new Error(`GP 부족 (필요: ${cost}, 보유: ${gpBal.toFixed(0)})`);

    // GP 차감
    await client.query(
      'UPDATE users SET gp_balance = gp_balance - $1 WHERE wallet_address = $2', [cost, w]
    );

    // 기존 패스 만료
    await client.query("UPDATE vip_passes SET is_active = false WHERE wallet = $1", [w]);

    // 새 패스 발급
    const { rows: passRows } = await client.query(
      `INSERT INTO vip_passes (wallet, tier_id, gp_spent, expires_at)
       VALUES ($1, $2, $3, NOW() + ($4 || ' days')::interval)
       ON CONFLICT (wallet) DO UPDATE SET
         tier_id = EXCLUDED.tier_id,
         gp_spent = EXCLUDED.gp_spent,
         activated_at = NOW(),
         expires_at = NOW() + ($4 || ' days')::interval,
         is_active = true
       RETURNING *`,
      [w, tierId, cost, tier.period_days]
    );

    await client.query(
      `INSERT INTO vip_log (wallet, tier_id, event_type, gp_spent) VALUES ($1, $2, 'purchased', $3)`,
      [w, tierId, cost]
    );

    await client.query('COMMIT');

    try { logGPActivity(w, -cost, 'vip_pass', `VIP ${tier.name} ${tier.badge} 구매`).catch(() => {}); } catch (_) {}

    return {
      success: true,
      action: 'purchased',
      tierName: tier.name,
      badge: tier.badge,
      gpSpent: cost,
      expiresAt: passRows[0].expires_at
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ── 만료된 패스 정리 (스케줄러) ──────────────────────────────────────────────
async function expireOldPasses() {
  const { rowCount } = await pool.query(
    "UPDATE vip_passes SET is_active = false WHERE is_active = true AND expires_at < NOW()"
  );
  if (rowCount > 0) console.log(`[VIP] ${rowCount} expired passes deactivated`);
}

module.exports = { getTiers, getMyPass, getVipInfo, getMiningBoost, getGPEarnBonus, purchasePass, expireOldPasses };
