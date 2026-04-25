'use strict';
// ═══════════════════════════════════════════════════════════════
// Governance Auto-Expire — 거버너/사령관 자동 자리 비우기
// ═══════════════════════════════════════════════════════════════
// admin 이 매번 수동으로 클리어해야 하는 문제 (사용자 신고) 해결.
//
// 작동 방식 (1시간마다 스케줄러):
//   1) governor wallet 이 users 테이블에 없음 (탈퇴) → 자리 비움
//   2) governor last_login_at 이 N일 이전 → 자리 비움
//   3) governor_since + max_term_days < NOW() (옵션, 0=비활성) → 자리 비움
//   동일 로직을 commander 에도 적용.
//
// 자리 비울 때:
//   - sectors: governor_wallet/since/announcement → NULL (commander 동일)
//   - governance_positions 에서 해당 wallet 삭제
//   - sector cache 무효화
//
// 모든 변경은 transactional. 클리어된 자리는 다음 siege 또는 admin 임명 때까지 비어 있음.

const { pool } = require('../db');

async function getSetting(key, fallback) {
  try {
    const r = await pool.query(`SELECT value #>> '{}' AS v FROM settings WHERE key = $1`, [key]);
    if (!r.rows.length || r.rows[0].v === null) return fallback;
    return r.rows[0].v;
  } catch (_) { return fallback; }
}

/**
 * 만료된 governor 들을 찾아 자리 비움.
 * @returns {object} { clearedSectors: [...], clearedCommander: bool, reasons: {...} }
 */
async function expireStaleGovernance() {
  const enabledRaw = await getSetting('governance_auto_expire_enabled', 'true');
  if (enabledRaw === 'false') return { skipped: true };

  const govDays = parseInt(await getSetting('governor_inactive_days', '14')) || 0;
  const cmdDays = parseInt(await getSetting('commander_inactive_days', '14')) || 0;
  const govTerm = parseInt(await getSetting('governor_max_term_days', '0')) || 0;
  const cmdTerm = parseInt(await getSetting('commander_max_term_days', '0')) || 0;

  const result = { clearedSectors: [], clearedCommander: false, reasons: {} };
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // ── 1) 섹터 거버너 자동 만료 ──
    // 조건: 다음 중 하나라도 충족되면 자리 비움
    //   a) governor_wallet 이 users 에 없음 (탈퇴)
    //   b) COALESCE(last_login_at, governor_since) 이 govDays 일 이전 (govDays > 0)
    //      ⇒ last_login_at NULL 인 옛 데이터는 governor_since 기준으로 판정
    //   c) governor_since + govTerm 일 < NOW (govTerm > 0)
    const lastActiveExpr = `COALESCE(u.last_login_at, s.governor_since)`;
    const conditions = [`u.wallet_address IS NULL`]; // (a) orphaned
    if (govDays > 0) conditions.push(`(${lastActiveExpr} < NOW() - INTERVAL '${govDays} days')`);
    if (govTerm > 0) conditions.push(`(s.governor_since IS NOT NULL AND s.governor_since < NOW() - INTERVAL '${govTerm} days')`);

    const stale = await client.query(`
      SELECT s.id AS sector_id, s.governor_wallet,
             u.last_login_at,
             s.governor_since,
             CASE
               WHEN u.wallet_address IS NULL THEN 'orphaned'
               WHEN ${lastActiveExpr} < NOW() - INTERVAL '${govDays || 99999} days' THEN 'inactive'
               WHEN s.governor_since IS NOT NULL AND s.governor_since < NOW() - INTERVAL '${govTerm || 99999} days' THEN 'term_expired'
               ELSE 'unknown'
             END AS reason
        FROM sectors s
        LEFT JOIN users u ON u.wallet_address = s.governor_wallet
       WHERE s.governor_wallet IS NOT NULL
         AND (${conditions.join(' OR ')})
    `);

    for (const row of stale.rows) {
      await client.query(
        `UPDATE sectors SET governor_wallet = NULL, governor_since = NULL,
                            vice_governor_wallet = NULL, vice_governor_since = NULL,
                            announcement = NULL
         WHERE id = $1`,
        [row.sector_id]
      );
      await client.query(`DELETE FROM governance_positions WHERE sector_id = $1`, [row.sector_id]);
      result.clearedSectors.push({ sectorId: row.sector_id, prevGovernor: row.governor_wallet, reason: row.reason });
      result.reasons[row.sector_id] = row.reason;
    }

    // ── 2) 사령관 자동 만료 ──
    const cmdStale = [];
    const cmd = await client.query(`SELECT commander_wallet, commander_since FROM commander WHERE id = 1`);
    if (cmd.rows[0] && cmd.rows[0].commander_wallet) {
      const w = cmd.rows[0].commander_wallet;
      const since = cmd.rows[0].commander_since;
      // (a) wallet 이 users 에 없음
      const exists = await client.query(`SELECT last_login_at FROM users WHERE wallet_address = $1`, [w]);
      if (!exists.rows.length) {
        cmdStale.push('orphaned');
      } else if (cmdDays > 0) {
        // (b) COALESCE(last_login_at, commander_since) 이 cmdDays 일 이전
        // last_login_at NULL 인 옛 데이터는 commander_since 기준으로 판정.
        const ll = exists.rows[0].last_login_at || since;
        if (ll && new Date(ll).getTime() < Date.now() - cmdDays * 24 * 3600 * 1000) {
          cmdStale.push('inactive');
        }
      }
      // (c) commander_since 가 cmdTerm 일 이전
      if (cmdTerm > 0 && since && new Date(since).getTime() < Date.now() - cmdTerm * 24 * 3600 * 1000) {
        cmdStale.push('term_expired');
      }

      if (cmdStale.length > 0) {
        await client.query(`
          UPDATE commander SET commander_wallet = NULL, commander_since = NULL,
                               vice_commander_wallet = NULL, vice_commander_since = NULL,
                               announcement = NULL
           WHERE id = 1
        `);
        result.clearedCommander = true;
        result.reasons.commander = cmdStale[0];
      }
    }

    // ── 3) 고아 announcement 정리 ──
    // governor_wallet IS NULL 인데 announcement 가 남아 있는 케이스 (이전에 manual clear 등으로 발생)
    const orphanAnnounce = await client.query(
      `UPDATE sectors SET announcement = NULL
        WHERE governor_wallet IS NULL AND announcement IS NOT NULL
       RETURNING id`
    );
    if (orphanAnnounce.rows.length > 0) {
      result.orphanAnnouncementsCleared = orphanAnnounce.rows.map(r => r.id);
    }

    await client.query('COMMIT');

    // sector cache 무효화 → 클라이언트 즉시 반영
    if (result.clearedSectors.length > 0 || result.clearedCommander || (result.orphanAnnouncementsCleared && result.orphanAnnouncementsCleared.length > 0)) {
      try { if (typeof global.__invalidateSectorsCache === 'function') global.__invalidateSectorsCache(); } catch(_) {}
      console.log(`[GOV-EXPIRE] cleared sectors: ${result.clearedSectors.length}, commander: ${result.clearedCommander}`,
        JSON.stringify(result.reasons));
    }
    return result;
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch(_) {}
    console.error('[GOV-EXPIRE] error:', e.message);
    return { error: e.message };
  } finally { client.release(); }
}

module.exports = { expireStaleGovernance };
