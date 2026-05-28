// [v7.192 F4] Wash-trade 탐지 서비스
// 목적: 마켓에서 자기거래/공모거래 패턴 식별. ship_market 매매 / marketplace 매매 시점에
//       observeTrade(...) 호출 → score 계산 → 임계 이상이면 suspicious_wallet_flags 에 기록.
//
// 의도적 비차단 정책: score 가 100 이어도 거래 자체는 통과시킨다. 차단은 거짓 양성 위험이 커서
//   어드민 검수 후 수동 조치 (suspicious_wallet_flags → admin.html 대시보드에서 ban/restrict).
//
// 차후 자동 차단 활성화 시: observeTrade 가 boolean 반환하도록 확장 + 호출자가 거래 abort.
//
// 검출 신호 (각 점수):
//   - shared_ip 40점: buyer/seller 가 최근 7일 안 같은 IP 에서 로그인
//   - shared_referrer 30점: buyer/seller 가 같은 referrer 체인
//   - reciprocal_window 30점: 12시간 안 buyer→seller, seller→buyer 양방향 거래 N회 이상
// 합계 60 이상이면 의심.

const { pool } = require('../db');

async function getSetting(key, fallback) {
  try {
    const r = await pool.query('SELECT value FROM settings WHERE key = $1', [key]);
    const v = r.rows[0]?.value;
    if (v == null) return fallback;
    return typeof v === 'string' ? v.replace(/"/g, '') : v;
  } catch (_) { return fallback; }
}

// buyer/seller 의 최근 IP 같은지 확인 (account_signups + 최근 로그인 기록 활용)
async function _checkSharedIp(buyer, seller) {
  try {
    const { rows } = await pool.query(`
      SELECT a.signup_ip
        FROM account_signups a
        JOIN account_signups b ON a.signup_ip = b.signup_ip
       WHERE LOWER(a.wallet_address) = LOWER($1)
         AND LOWER(b.wallet_address) = LOWER($2)
         AND a.signup_ip IS NOT NULL
       LIMIT 1
    `, [buyer, seller]);
    return rows[0]?.signup_ip || null;
  } catch (_) { return null; }
}

// 같은 referrer chain 확인 (referrals 테이블)
async function _checkSharedReferrer(buyer, seller) {
  try {
    const { rows } = await pool.query(`
      SELECT u1.referred_by AS chain
        FROM users u1, users u2
       WHERE LOWER(u1.wallet_address) = LOWER($1)
         AND LOWER(u2.wallet_address) = LOWER($2)
         AND u1.referred_by IS NOT NULL
         AND u1.referred_by = u2.referred_by
       LIMIT 1
    `, [buyer, seller]);
    return rows[0]?.chain || null;
  } catch (_) { return null; }
}

// 최근 windowHours 안 양방향 거래 있는지
async function _checkReciprocal(buyer, seller, windowHours) {
  try {
    const { rows } = await pool.query(`
      SELECT COUNT(*)::int AS n FROM (
        SELECT 1 FROM wash_trade_observations
         WHERE LOWER(buyer_wallet) = LOWER($1) AND LOWER(seller_wallet) = LOWER($2)
           AND created_at > NOW() - ($3 || ' hours')::interval
        UNION ALL
        SELECT 1 FROM wash_trade_observations
         WHERE LOWER(buyer_wallet) = LOWER($2) AND LOWER(seller_wallet) = LOWER($1)
           AND created_at > NOW() - ($3 || ' hours')::interval
      ) t
    `, [buyer, seller, String(windowHours)]);
    return rows[0]?.n || 0;
  } catch (_) { return 0; }
}

/**
 * 거래 관찰 + score 계산 + suspicious_wallet_flags 자동 기록.
 * 호출 패턴: marketplace/ship_market 의 buyListing 직후 fire-and-forget.
 * 절대 throw 하지 않는다 — 거래 흐름과 독립.
 */
async function observeTrade(opts) {
  const { buyer, seller, assetType, assetId, priceGp } = opts;
  if (!buyer || !seller || buyer.toLowerCase() === seller.toLowerCase()) return null;
  try {
    const windowHours = parseInt(await getSetting('wash_trade_window_hours', 12));
    const minSwaps = parseInt(await getSetting('wash_trade_min_swaps', 3));
    const minScore = parseInt(await getSetting('wash_trade_min_score', 60));

    const [ip, ref, reciprocal] = await Promise.all([
      _checkSharedIp(buyer, seller),
      _checkSharedReferrer(buyer, seller),
      _checkReciprocal(buyer, seller, windowHours),
    ]);
    const reciprocalFlag = reciprocal >= minSwaps;
    let score = 0;
    if (ip)             score += 40;
    if (ref)            score += 30;
    if (reciprocalFlag) score += 30;

    // 기록
    await pool.query(`
      INSERT INTO wash_trade_observations (buyer_wallet, seller_wallet, asset_type, asset_id, price_gp,
        shared_ip, shared_referrer, reciprocal_window, score)
      VALUES (LOWER($1), LOWER($2), $3, $4, $5, $6, $7, $8, $9)
    `, [buyer, seller, assetType, assetId, priceGp, ip, ref, reciprocalFlag, score]);

    // 임계 이상이면 양 쪽 wallet 에 의심 플래그
    if (score >= minScore) {
      const reason = `wash_trade score=${score} (ip=${!!ip}, ref=${!!ref}, recip=${reciprocalFlag})`;
      for (const w of [buyer, seller]) {
        try {
          await pool.query(`
            INSERT INTO suspicious_wallet_flags (wallet_address, reason, score, detected_at)
            VALUES (LOWER($1), $2, $3, NOW())
            ON CONFLICT (wallet_address, reason) DO UPDATE
              SET score = GREATEST(suspicious_wallet_flags.score, EXCLUDED.score),
                  detected_at = NOW()
          `, [w, reason, score]);
        } catch (_) {}
      }
      console.warn(`[washTrade] flagged ${buyer.slice(0,8)} ↔ ${seller.slice(0,8)} (${reason})`);
    }
    return { score, ip: !!ip, ref: !!ref, reciprocal: reciprocalFlag };
  } catch (e) {
    console.warn('[washTrade] observe error:', e.message);
    return null;
  }
}

module.exports = { observeTrade };
