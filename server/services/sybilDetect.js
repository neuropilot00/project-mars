// server/services/sybilDetect.js
// 자기거래 chain 감지 — A↔B 폐쇄 루프로 수수료/추천 보너스 짜내는 sybil 패턴.
// 일일 스케줄러가 호출. 의심 쌍을 suspicious_wallet_flags 에 적립(unique key 로 멱등).
// 운영자가 admin 에서 review 후 가드 액션. 자동 차단은 하지 않음(false positive 위험).

const { pool, getSetting } = require('../db');

async function detectSelfTradeChains() {
  if (String(await getSetting('sybil_detect_enabled', 'true')).toLowerCase() !== 'true') {
    return { skipped: true, reason: 'disabled' };
  }
  const windowDays = parseInt(await getSetting('self_trade_window_days', '7'), 10) || 7;
  const minPairs   = parseInt(await getSetting('self_trade_min_pairs', '3'), 10) || 3;
  const minValue   = parseFloat(await getSetting('self_trade_min_value', '100')) || 100;

  const client = await pool.connect();
  try {
    // 폐쇄 루프 후보: gp_transfers 양방향 + marketplace seller/buyer 양방향 + 추천 관계 결합.
    // 핵심 쿼리는 두 wallet 사이에 윈도우 내 양방향 송금이 minPairs 회 이상 있는 쌍을 추출.
    const { rows } = await client.query(`
      WITH bidirectional AS (
        SELECT
          LEAST(LOWER(from_wallet), LOWER(to_wallet))    AS w1,
          GREATEST(LOWER(from_wallet), LOWER(to_wallet)) AS w2,
          COUNT(*) AS xfer_count,
          SUM(amount) AS total_amount
        FROM gp_transfers
        WHERE created_at >= NOW() - ($1 || ' days')::interval
          AND from_wallet IS NOT NULL AND to_wallet IS NOT NULL
          AND LOWER(from_wallet) <> LOWER(to_wallet)
        GROUP BY w1, w2
        HAVING COUNT(DISTINCT LOWER(from_wallet)) >= 2  -- 양방향 발생 확인
      )
      SELECT w1, w2, xfer_count, total_amount FROM bidirectional
       WHERE xfer_count >= $2 AND total_amount >= $3
       ORDER BY total_amount DESC LIMIT 500
    `, [windowDays, minPairs, minValue]);

    let flagged = 0;
    for (const r of rows) {
      // 두 wallet 각각 flag — 같은 (wallet, pair_wallet, flag_type) UNIQUE 로 멱등
      const severity = r.total_amount >= minValue * 5 ? 4 : r.total_amount >= minValue * 2 ? 3 : 2;
      const evidence = { xfer_count: Number(r.xfer_count), total_amount: Number(r.total_amount), window_days: windowDays };
      for (const [a, b] of [[r.w1, r.w2], [r.w2, r.w1]]) {
        const ins = await client.query(`
          INSERT INTO suspicious_wallet_flags (wallet, pair_wallet, flag_type, severity, evidence)
          VALUES ($1, $2, 'self_trade_loop', $3, $4::jsonb)
          ON CONFLICT (wallet, pair_wallet, flag_type) DO UPDATE
            SET severity = GREATEST(suspicious_wallet_flags.severity, EXCLUDED.severity),
                evidence = EXCLUDED.evidence,
                detected_at = NOW()
          RETURNING (xmax = 0) AS inserted
        `, [a, b, severity, JSON.stringify(evidence)]);
        if (ins.rows[0]?.inserted) flagged++;
      }
    }

    return { scanned_pairs: rows.length, new_flags: flagged, window_days: windowDays };
  } catch (err) {
    // 테이블 미존재(42P01) 환경에선 silent skip — gp_transfers/마켓 미구축 dev DB 호환
    if (err && err.code === '42P01') return { skipped: true, reason: 'table_not_found:'+err.message.split(' ')[1] };
    console.error('[sybilDetect] error:', err.message);
    return { error: err.message };
  } finally {
    client.release();
  }
}

module.exports = { detectSelfTradeChains };
