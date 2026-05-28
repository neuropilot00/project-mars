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

    // 임계 이상이면 양 쪽 wallet 에 의심 플래그.
    // [v7.193 fix] suspicious_wallet_flags 실제 스키마(mig 250) 에 맞춤 — wallet, pair_wallet, flag_type, severity(1~5), evidence JSONB.
    //   wash-trade score (0~100) → severity 1~5 매핑: 60~69=2, 70~79=3, 80~89=4, 90~100=5.
    if (score >= minScore) {
      const severity = score >= 90 ? 5 : score >= 80 ? 4 : score >= 70 ? 3 : 2;
      const evidence = { score, shared_ip: !!ip, shared_referrer: !!ref, reciprocal: reciprocalFlag,
                         asset_type: assetType, asset_id: assetId, price_gp: priceGp };
      // 두 wallet 각각 기록 (pair_wallet 가 상대) — UNIQUE(wallet, pair_wallet, flag_type) 기준 upsert.
      const pairs = [[buyer, seller], [seller, buyer]];
      for (const [w, p] of pairs) {
        try {
          await pool.query(`
            INSERT INTO suspicious_wallet_flags (wallet, pair_wallet, flag_type, severity, evidence, detected_at)
            VALUES (LOWER($1), LOWER($2), 'wash_trade', $3, $4::jsonb, NOW())
            ON CONFLICT (wallet, pair_wallet, flag_type) DO UPDATE
              SET severity = GREATEST(suspicious_wallet_flags.severity, EXCLUDED.severity),
                  evidence = EXCLUDED.evidence,
                  detected_at = NOW(),
                  reviewed = FALSE
          `, [w, p, severity, JSON.stringify(evidence)]);
        } catch (e) {
          console.warn('[washTrade] flag upsert error:', e.message);
        }
      }
      console.warn(`[washTrade] flagged ${buyer.slice(0,8)} ↔ ${seller.slice(0,8)} score=${score} sev=${severity}`);
    }
    return { score, ip: !!ip, ref: !!ref, reciprocal: reciprocalFlag };
  } catch (e) {
    console.warn('[washTrade] observe error:', e.message);
    return null;
  }
}

// [v7.193 F4] 6시간 누적 sweep — 단발 거래는 점수 낮아 통과했어도, 같은 쌍이 N회 반복되면
//   reciprocal 점수가 누적돼 임계 넘기는 케이스 캐치. 스케줄러가 호출.
async function sweepRecentObservations() {
  try {
    const minScore = parseInt(await getSetting('wash_trade_min_score', 60));
    // 최근 24h 안 같은 buyer/seller 쌍이 reciprocal=true 기록 다수 → 재플래그.
    const { rows } = await pool.query(`
      SELECT LEAST(LOWER(buyer_wallet), LOWER(seller_wallet)) AS w1,
             GREATEST(LOWER(buyer_wallet), LOWER(seller_wallet)) AS w2,
             COUNT(*)::int AS cnt,
             AVG(score)::int AS avg_score,
             MAX(score)::int AS max_score
        FROM wash_trade_observations
       WHERE created_at > NOW() - INTERVAL '24 hours'
       GROUP BY w1, w2
      HAVING COUNT(*) >= 3 AND AVG(score) >= 30
       ORDER BY cnt DESC
       LIMIT 200
    `);
    let flagged = 0;
    for (const r of rows) {
      // 누적 위험 점수: 거래 횟수 × 평균. 5회 + 평균 50점 = 의심.
      const accumScore = Math.min(100, r.avg_score + r.cnt * 8);
      if (accumScore < minScore) continue;
      const severity = accumScore >= 90 ? 5 : accumScore >= 80 ? 4 : accumScore >= 70 ? 3 : 2;
      const evidence = { sweep: true, pair_count: r.cnt, avg_score: r.avg_score, max_score: r.max_score, accum_score: accumScore };
      for (const [w, p] of [[r.w1, r.w2], [r.w2, r.w1]]) {
        try {
          await pool.query(`
            INSERT INTO suspicious_wallet_flags (wallet, pair_wallet, flag_type, severity, evidence, detected_at)
            VALUES ($1, $2, 'wash_trade_cumulative', $3, $4::jsonb, NOW())
            ON CONFLICT (wallet, pair_wallet, flag_type) DO UPDATE
              SET severity = GREATEST(suspicious_wallet_flags.severity, EXCLUDED.severity),
                  evidence = EXCLUDED.evidence,
                  detected_at = NOW(),
                  reviewed = FALSE
          `, [w, p, severity, JSON.stringify(evidence)]);
        } catch (_) {}
      }
      flagged++;
    }
    if (flagged) console.log(`[washTrade] sweep flagged ${flagged} cumulative pair(s)`);
    return { swept: rows.length, flagged };
  } catch (e) {
    console.warn('[washTrade] sweep error:', e.message);
    return { swept: 0, flagged: 0, error: e.message };
  }
}

module.exports = { observeTrade, sweepRecentObservations };
