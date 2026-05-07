/**
 * services/siege.js
 * Governor Siege 시스템 (BIBLE Migration 082)
 *
 * 함수 목록:
 *  - declareSiege(challengerWallet, sectorCode)  → { success, siege, error }
 *  - resolveSiege(siegeId)                       → { success, winner, error }
 *  - getActiveSiege(sectorCode)                  → siege | null
 *  - getSiegeStatus(siegeId)                     → siege detail | null
 *  - resolveExpiredSieges()                      → 스케줄러에서 호출 (만료 자동 resolve)
 *
 * ⚠️  users.id 없음 → wallet_address 기반
 */

'use strict';

const { pool, getSetting } = require('../db');

// Chronicle 서비스 (없으면 콘솔 로그로 대체)
let chronicleService;
try { chronicleService = require('./chronicle'); } catch (_) {}

// Betting 서비스 (없으면 무시)
let bettingService;
try {
  const _wb = require('./warBetting');
  bettingService = {
    createBettingEvent: (type, ref, optA, optB, endsAt) => _wb.createEvent({ event_type: type, event_ref_id: ref, option_a_label: optA, option_b_label: optB, closes_at: endsAt }),
    settleBettingEvent: (id, winner) => _wb.resolveEvent(id, winner),
  };
} catch (_) {}

// Title 서비스 (없으면 무시)
let titleService;
try { titleService = require('./title'); } catch (_) {}

// Chronicle Enhanced (없으면 무시)
let ceService;
try { ceService = require('./chronicleEnhanced'); } catch (_) {}

// Title Extended (없으면 무시)
let titleExt;
try { titleExt = require('./titleExtended'); } catch (_) {}

// ─────────────────────────────────────────────────────────────
// 1. Siege 선언
// ─────────────────────────────────────────────────────────────
async function declareSiege(challengerWallet, sectorCode) {
  const w = challengerWallet.toLowerCase();
  const code = sectorCode.toLowerCase();

  // 설정값 로드
  const gpCost       = parseInt(await getSetting('siege_declaration_cost_gp') ?? '100');
  const warnHours    = parseInt(await getSetting('siege_warning_hours')        ?? '48');
  const battleHours  = parseInt(await getSetting('siege_battle_hours')         ?? '24');
  const minTerritories = parseInt(await getSetting('siege_min_territories')    ?? '3');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // ── 섹터 존재 확인 (FOR UPDATE OF sd: sector_definitions는 항상 존재하므로 ungoverned 섹터도 안전하게 락) ──
    const secRes = await client.query(
      'SELECT sd.*, sg.governor_wallet, sg.active_siege_id FROM sector_definitions sd LEFT JOIN sector_governance sg ON sg.sector_code = sd.code WHERE sd.code = $1 FOR UPDATE OF sd',
      [code]
    );
    if (!secRes.rows.length) {
      await client.query('ROLLBACK');
      return { success: false, error: 'sector_not_found' };
    }
    const sector = secRes.rows[0];

    // ── 이미 진행 중인 Siege 체크 ──
    if (sector.active_siege_id) {
      await client.query('ROLLBACK');
      return { success: false, error: 'siege_already_active' };
    }

    // ── 도전자 = 현재 Governor 금지 ──
    if (sector.governor_wallet && sector.governor_wallet.toLowerCase() === w) {
      await client.query('ROLLBACK');
      return { success: false, error: 'already_governor' };
    }

    // ── 도전자 영토 수 체크 ──
    const terRes = await client.query(
      'SELECT COUNT(*) AS cnt FROM claims WHERE LOWER(owner) = LOWER($1) AND sector_code = $2 AND deleted_at IS NULL',
      [w, code]
    );
    const territoryCount = parseInt(terRes.rows[0]?.cnt ?? 0);
    if (territoryCount < minTerritories) {
      await client.query('ROLLBACK');
      return {
        success: false,
        error: 'insufficient_territories',
        required: minTerritories,
        current: territoryCount
      };
    }

    // ── GP 잔액 확인 및 차감 ──
    const userRes = await client.query(
      'SELECT gp_balance FROM users WHERE LOWER(wallet_address) = LOWER($1) FOR UPDATE',
      [w]
    );
    if (!userRes.rows.length) {
      await client.query('ROLLBACK');
      return { success: false, error: 'user_not_found' };
    }
    const gpBalance = parseFloat(userRes.rows[0].gp_balance) || 0;
    if (gpBalance < gpCost) {
      await client.query('ROLLBACK');
      return { success: false, error: 'insufficient_gp', required: gpCost, current: gpBalance };
    }

    const deductSiegeStart = await client.query(
      'UPDATE users SET gp_balance = gp_balance - $1 WHERE LOWER(wallet_address) = LOWER($2) AND gp_balance >= $1',
      [gpCost, w]
    );
    if (deductSiegeStart.rowCount === 0) throw new Error('INSUFFICIENT_GP');

    // ── governor_sieges INSERT ──
    const now          = new Date();
    const siegeStartsAt = new Date(now.getTime() + warnHours * 3600000);
    const siegeEndsAt   = new Date(siegeStartsAt.getTime() + battleHours * 3600000);

    const siegeRes = await client.query(
      `INSERT INTO governor_sieges
         (sector_code, challenger_wallet, defender_wallet, status,
          gp_cost, declared_at, siege_starts_at, siege_ends_at)
       VALUES ($1, $2, $3, 'pending', $4, NOW(), $5, $6)
       RETURNING *`,
      [code, w, sector.governor_wallet || null, gpCost, siegeStartsAt, siegeEndsAt]
    );
    const siege = siegeRes.rows[0];

    // ── sector_governance active_siege_id 업데이트 ──
    await client.query(
      'UPDATE sector_governance SET active_siege_id = $1 WHERE sector_code = $2',
      [siege.id, code]
    );

    await client.query('COMMIT');

    // Betting 이벤트 생성 (non-blocking, war_betting_enabled 설정에 따라 null 가능)
    if (bettingService) {
      try {
        const challengerNick = (await pool.query(
          'SELECT nickname FROM users WHERE LOWER(wallet_address) = LOWER($1)', [w]
        )).rows[0]?.nickname || w.slice(0, 8);
        const defenderNick = siege.defender_wallet
          ? ((await pool.query(
              'SELECT nickname FROM users WHERE LOWER(wallet_address) = LOWER($1)', [siege.defender_wallet]
            )).rows[0]?.nickname || siege.defender_wallet.slice(0, 8))
          : 'Vacant';
        const betEvent = await bettingService.createBettingEvent(
          'siege', siege.id,
          `${challengerNick} (Challenger)`,
          `${defenderNick} (Governor)`,
          siegeEndsAt
        );
        if (betEvent) {
          await pool.query(
            'UPDATE governor_sieges SET betting_event_id = $1 WHERE id = $2',
            [betEvent.id, siege.id]
          );
          siege.betting_event_id = betEvent.id;
        }
      } catch (betErr) {
        console.warn('[SIEGE] Betting event creation failed (non-critical):', betErr.message);
      }
    }

    // Chronicle 기록 (non-blocking)
    _recordChronicle('siege_declared', {
      actor_wallet: w,
      sector_code: code,
      value_gp: gpCost,
      extra: { siege_id: siege.id, siege_starts_at: siegeStartsAt, siege_ends_at: siegeEndsAt }
    }).catch(() => {});

    return { success: true, siege };
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[SIEGE] declareSiege error:', err.message);
    return { success: false, error: 'internal_error' };
  } finally {
    client.release();
  }
}

// ─────────────────────────────────────────────────────────────
// 2. Siege 해결 (종료 시 자동 호출)
// ─────────────────────────────────────────────────────────────
async function resolveSiege(siegeId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // ── Siege 조회 ──
    const siegeRes = await client.query(
      'SELECT * FROM governor_sieges WHERE id = $1 FOR UPDATE',
      [siegeId]
    );
    if (!siegeRes.rows.length) {
      await client.query('ROLLBACK');
      return { success: false, error: 'siege_not_found' };
    }
    const siege = siegeRes.rows[0];
    if (siege.status === 'resolved') {
      await client.query('ROLLBACK');
      return { success: true, alreadyResolved: true };
    }

    const code = siege.sector_code;

    // ── 도전자 / 수비자 영토 수 비교 ──
    const [chalRes, defRes] = await Promise.all([
      client.query(
        'SELECT COUNT(*) AS cnt FROM claims WHERE LOWER(owner) = LOWER($1) AND sector_code = $2 AND deleted_at IS NULL',
        [siege.challenger_wallet, code]
      ),
      siege.defender_wallet
        ? client.query(
            'SELECT COUNT(*) AS cnt FROM claims WHERE LOWER(owner) = LOWER($1) AND sector_code = $2 AND deleted_at IS NULL',
            [siege.defender_wallet, code]
          )
        : Promise.resolve({ rows: [{ cnt: 0 }] })
    ]);

    const chalPx = parseInt(chalRes.rows[0]?.cnt ?? 0);
    const defPx  = parseInt(defRes.rows[0]?.cnt ?? 0);

    // ── 승자 결정: 도전자 영토 수 > 수비자이면 도전자 승 ──
    const winnerWallet = chalPx > defPx
      ? siege.challenger_wallet
      : (siege.defender_wallet || null);

    // ── governor_sieges 업데이트 ──
    await client.query(
      `UPDATE governor_sieges
       SET status = 'resolved', winner_wallet = $1,
           final_challenger_px = $2, final_defender_px = $3,
           resolved_at = NOW()
       WHERE id = $4`,
      [winnerWallet, chalPx, defPx, siegeId]
    );

    // ── 기존 Governor Hall of Fame 기록 ──
    if (siege.defender_wallet) {
      const govRes = await client.query(
        'SELECT governor_since, total_tax_collected, tax_rate FROM sector_governance WHERE sector_code = $1',
        [code]
      );
      if (govRes.rows.length && govRes.rows[0].governor_since) {
        const g = govRes.rows[0];
        const durationDays = Math.floor(
          (Date.now() - new Date(g.governor_since).getTime()) / (1000 * 60 * 60 * 24)
        );
        await client.query(
          `INSERT INTO governor_hall_of_fame
             (user_wallet, sector_code, term_start, term_end, duration_days,
              total_tax_earned, ended_by, max_tax_rate)
           VALUES ($1, $2, $3, NOW(), $4, $5, 'siege', $6)`,
          [siege.defender_wallet, code, g.governor_since, durationDays,
           parseFloat(g.total_tax_collected) || 0, parseFloat(g.tax_rate) || 0]
        );
      }
    }

    // ── sector_governance 업데이트 ──
    if (winnerWallet && winnerWallet !== siege.defender_wallet) {
      // 새 Governor 취임
      await client.query(
        `UPDATE sector_governance
         SET governor_wallet = $1, governor_since = NOW(),
             active_siege_id = NULL, total_tax_collected = 0
         WHERE sector_code = $2`,
        [winnerWallet, code]
      );
    } else {
      // 수비자 승리 또는 Governor 없는 섹터
      await client.query(
        'UPDATE sector_governance SET active_siege_id = NULL WHERE sector_code = $1',
        [code]
      );
    }

    await client.query('COMMIT');

    // Betting 정산 (non-blocking)
    if (bettingService && siege.betting_event_id) {
      try {
        const winnerOption = winnerWallet === siege.challenger_wallet ? 'a' : 'b';
        await bettingService.settleBettingEvent(siege.betting_event_id, winnerOption);
      } catch (betErr) {
        console.warn('[SIEGE] Betting settlement failed (non-critical):', betErr.message);
      }
    }

    // 칭호 부여 (non-blocking)
    if (titleService && winnerWallet) {
      titleService.checkAndAwardTitles(winnerWallet, 'siege_win', { sector_code: code }).catch(() => {});
    }

    // Chronicle 기록 (non-blocking)
    _recordChronicle('governor_overthrown', {
      actor_wallet: winnerWallet,
      target_wallet: siege.defender_wallet,
      sector_code: code,
      extra: {
        siege_id: siegeId,
        challenger_px: chalPx,
        defender_px: defPx
      }
    }).catch(() => {});

    // titleExtended: Siege 승리 칭호 (non-blocking)
    if (titleExt && winnerWallet) {
      titleExt.onSiegeWin(winnerWallet, chalPx, defPx).catch(() => {});
    }

    // Chronicle Enhanced 이벤트 훅 (non-blocking)
    if (ceService && winnerWallet && siege.defender_wallet && winnerWallet !== siege.defender_wallet) {
      (async () => {
        try {
          const [winnerRes, loserRes, sectorRes] = await Promise.all([
            pool.query('SELECT wallet_address, nickname, created_at FROM users WHERE LOWER(wallet_address) = LOWER($1)', [winnerWallet]),
            pool.query('SELECT wallet_address, nickname FROM users WHERE LOWER(wallet_address) = LOWER($1)', [siege.defender_wallet]),
            pool.query('SELECT code, name FROM sector_definitions WHERE code = $1', [code]),
          ]);
          const winner = winnerRes.rows[0];
          const loser  = loserRes.rows[0];
          const sector = sectorRes.rows[0] || { code, name: code };
          if (winner && loser) {
            await ceService.governorOverthrown({
              sector: { code: sector.code, name: sector.name, name_ko: sector.name },
              winner, loser,
              participants: siege.participant_count || 0,
            }).catch(() => {});
            await ceService.underdogGovernor({
              winner,
              sectorCode: code,
              sectorName: sector.name,
            }).catch(() => {});
          }
        } catch (_) {}
      })();
    }

    console.log(`[SIEGE] Siege #${siegeId} resolved. Sector=${code}, Winner=${winnerWallet ?? 'no-change'}`);
    return { success: true, winner: winnerWallet, chalPx, defPx };
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[SIEGE] resolveSiege error:', err.message);
    return { success: false, error: 'internal_error' };
  } finally {
    client.release();
  }
}

// ─────────────────────────────────────────────────────────────
// 3. 활성 Siege 조회
// ─────────────────────────────────────────────────────────────
async function getActiveSiege(sectorCode) {
  const res = await pool.query(
    `SELECT gs.*,
            uc.nickname AS challenger_nickname,
            ud.nickname AS defender_nickname
     FROM governor_sieges gs
     LEFT JOIN users uc ON uc.wallet_address = gs.challenger_wallet
     LEFT JOIN users ud ON ud.wallet_address = gs.defender_wallet
     WHERE gs.sector_code = $1 AND gs.status IN ('pending','active')
     ORDER BY gs.declared_at DESC LIMIT 1`,
    [sectorCode.toLowerCase()]
  );
  return res.rows[0] || null;
}

// ─────────────────────────────────────────────────────────────
// 4. Siege 상세
// ─────────────────────────────────────────────────────────────
async function getSiegeStatus(siegeId) {
  const res = await pool.query(
    `SELECT gs.*,
            uc.nickname AS challenger_nickname,
            ud.nickname AS defender_nickname,
            uw.nickname AS winner_nickname
     FROM governor_sieges gs
     LEFT JOIN users uc ON uc.wallet_address = gs.challenger_wallet
     LEFT JOIN users ud ON ud.wallet_address = gs.defender_wallet
     LEFT JOIN users uw ON uw.wallet_address = gs.winner_wallet
     WHERE gs.id = $1`,
    [parseInt(siegeId)]
  );
  return res.rows[0] || null;
}

// ─────────────────────────────────────────────────────────────
// 5. 만료된 Siege 자동 resolve (스케줄러용)
// ─────────────────────────────────────────────────────────────
async function resolveExpiredSieges() {
  const expiredRes = await pool.query(
    `SELECT id FROM governor_sieges
     WHERE status IN ('pending','active') AND siege_ends_at < NOW()`
  );
  for (const row of expiredRes.rows) {
    await resolveSiege(row.id);
  }

  // pending → active 전환 (siege_starts_at 지남)
  await pool.query(
    `UPDATE governor_sieges
     SET status = 'active'
     WHERE status = 'pending' AND siege_starts_at <= NOW()`
  );

  return expiredRes.rows.length;
}

// ─────────────────────────────────────────────────────────────
// 6. Siege 역사 조회
// ─────────────────────────────────────────────────────────────
async function getSiegeHistory(sectorCode, limit = 10) {
  const res = await pool.query(
    `SELECT gs.*,
            uc.nickname AS challenger_nickname,
            ud.nickname AS defender_nickname,
            uw.nickname AS winner_nickname
     FROM governor_sieges gs
     LEFT JOIN users uc ON uc.wallet_address = gs.challenger_wallet
     LEFT JOIN users ud ON ud.wallet_address = gs.defender_wallet
     LEFT JOIN users uw ON uw.wallet_address = gs.winner_wallet
     WHERE gs.sector_code = $1 AND gs.status = 'resolved'
     ORDER BY gs.resolved_at DESC LIMIT $2`,
    [sectorCode.toLowerCase(), parseInt(limit)]
  );
  return res.rows;
}

// ─────────────────────────────────────────────────────────────
// 7. Governor 선언문 업데이트
// ─────────────────────────────────────────────────────────────
async function updateGovernorDeclaration(wallet, sectorCode, text) {
  const w = wallet.toLowerCase();
  const code = sectorCode.toLowerCase();
  const gpCost = parseInt(await getSetting('governor_declaration_cost_gp') ?? '5');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 현재 Governor 확인
    const govRes = await client.query(
      'SELECT governor_wallet FROM sector_governance WHERE sector_code = $1',
      [code]
    );
    if (!govRes.rows.length || (govRes.rows[0].governor_wallet || '').toLowerCase() !== w) {
      await client.query('ROLLBACK');
      return { success: false, error: 'not_governor' };
    }

    // GP 차감
    const userRes = await client.query(
      'SELECT gp_balance FROM users WHERE LOWER(wallet_address) = LOWER($1) FOR UPDATE',
      [w]
    );
    const gp = parseFloat(userRes.rows[0]?.gp_balance ?? 0);
    if (gp < gpCost) {
      await client.query('ROLLBACK');
      return { success: false, error: 'insufficient_gp', required: gpCost, current: gp };
    }
    const deductSiegeDeclaration = await client.query(
      'UPDATE users SET gp_balance = gp_balance - $1 WHERE LOWER(wallet_address) = LOWER($2) AND gp_balance >= $1',
      [gpCost, w]
    );
    if (deductSiegeDeclaration.rowCount === 0) throw new Error('INSUFFICIENT_GP');

    // 선언문 업데이트
    await client.query(
      `UPDATE sector_governance
       SET declaration_text = $1, declaration_updated = NOW()
       WHERE sector_code = $2`,
      [text, code]
    );

    await client.query('COMMIT');
    return { success: true };
  } catch (err) {
    await client.query('ROLLBACK');
    return { success: false, error: 'internal_error' };
  } finally {
    client.release();
  }
}

// ─────────────────────────────────────────────────────────────
// 8. Governor 세율 변경
// ─────────────────────────────────────────────────────────────
async function updateTaxRate(wallet, sectorCode, taxRate) {
  const w = wallet.toLowerCase();
  const code = sectorCode.toLowerCase();
  const maxRate = parseFloat(await getSetting('governor_max_tax_rate') ?? '10');
  const rate = parseFloat(taxRate);

  if (isNaN(rate) || rate < 0 || rate > maxRate) {
    return { success: false, error: 'invalid_tax_rate', max: maxRate };
  }

  const govRes = await pool.query(
    'SELECT governor_wallet FROM sector_governance WHERE sector_code = $1',
    [code]
  );
  if (!govRes.rows.length || (govRes.rows[0].governor_wallet || '').toLowerCase() !== w) {
    return { success: false, error: 'not_governor' };
  }

  await pool.query(
    'UPDATE sector_governance SET tax_rate = $1 WHERE sector_code = $2',
    [rate, code]
  );
  return { success: true, tax_rate: rate };
}

// ─────────────────────────────────────────────────────────────
// 9. Governor 정책 변경
// ─────────────────────────────────────────────────────────────
async function updateSectorPolicy(wallet, sectorCode, policy) {
  const w = wallet.toLowerCase();
  const code = sectorCode.toLowerCase();
  const validPolicies = ['open', 'ally_only', 'closed'];

  if (!validPolicies.includes(policy)) {
    return { success: false, error: 'invalid_policy' };
  }

  const govRes = await pool.query(
    'SELECT governor_wallet FROM sector_governance WHERE sector_code = $1',
    [code]
  );
  if (!govRes.rows.length || (govRes.rows[0].governor_wallet || '').toLowerCase() !== w) {
    return { success: false, error: 'not_governor' };
  }

  await pool.query(
    'UPDATE sector_governance SET sector_policy = $1 WHERE sector_code = $2',
    [policy, code]
  );
  return { success: true, policy };
}

// ─────────────────────────────────────────────────────────────
// 내부 헬퍼: Chronicle 기록
// ─────────────────────────────────────────────────────────────
async function _recordChronicle(eventType, data) {
  if (chronicleService && typeof chronicleService.record === 'function') {
    await chronicleService.record(eventType, data);
  } else {
    console.log(`[CHRONICLE] ${eventType}:`, JSON.stringify(data));
  }
}

module.exports = {
  declareSiege,
  resolveSiege,
  getActiveSiege,
  getSiegeStatus,
  getSiegeHistory,
  resolveExpiredSieges,
  updateGovernorDeclaration,
  updateTaxRate,
  updateSectorPolicy
};
