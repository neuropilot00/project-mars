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

function notifyOpsProgress(wallet, missionTypes) {
  if (!wallet || !Array.isArray(missionTypes)) return;
  try {
    const dailyOps = require('../routes/dailyOps');
    missionTypes.forEach(type => {
      try { dailyOps.notifyMissionProgress(wallet, type).catch(()=>{}); } catch(_) {}
    });
  } catch (_) {}
}

function addSeasonScore(wallet, category, amount) {
  if (!wallet || !category || !amount) return;
  try {
    const seasonSvc = require('./season');
    seasonSvc.addSeasonScore(wallet, category, amount).catch(()=>{});
  } catch (_) {}
}

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
// [Phase 3] 주간 공성 캘린더 — after 이후 가장 이른 고정 슬롯(UTC dows 요일 + hourUtc 시, 분 0) 반환.
function _nextSiegeSlot(after, dows, hourUtc) {
  if (!Array.isArray(dows) || !dows.length) return new Date(after.getTime() + 48 * 3600000);
  for (let i = 0; i <= 14; i++) {
    const d = new Date(after.getTime());
    d.setUTCDate(d.getUTCDate() + i);
    d.setUTCHours(hourUtc, 0, 0, 0);
    if (dows.includes(d.getUTCDay()) && d.getTime() >= after.getTime()) return d;
  }
  return new Date(after.getTime() + 48 * 3600000);
}

// [Phase 3] 다가오는 공성 결전 슬롯 N개 + 스케줄 설정 — UI 노출용
async function getSiegeSchedule(count = 4) {
  const enabled = String(await getSetting('siege_schedule_enabled') ?? 'false') === 'true';
  const dows = String(await getSetting('siege_schedule_dows') ?? '3,6').split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n));
  const hourUtc = parseInt(await getSetting('siege_schedule_hour_utc') ?? '12');
  const minNotice = parseInt(await getSetting('siege_schedule_min_notice_hours') ?? '6');
  const slots = [];
  if (enabled) {
    let cursor = new Date(Date.now() + minNotice * 3600000);
    for (let n = 0; n < count; n++) {
      const slot = _nextSiegeSlot(cursor, dows, hourUtc);
      slots.push(slot.toISOString());
      cursor = new Date(slot.getTime() + 3600000); // 다음 슬롯 탐색은 1시간 뒤부터
    }
  }
  return { enabled, dows, hour_utc: hourUtc, min_notice_hours: minNotice, next_slots: slots };
}

async function declareSiege(challengerWallet, sectorCode) {
  const w = challengerWallet.toLowerCase();
  const code = sectorCode.toLowerCase();

  // 설정값 로드
  const gpCost       = parseInt(await getSetting('siege_declaration_cost_gp') ?? '100');
  const warnHours    = parseInt(await getSetting('siege_warning_hours')        ?? '48');
  const battleHours  = parseInt(await getSetting('siege_battle_hours')         ?? '24');
  const minTerritories = parseInt(await getSetting('siege_min_territories')    ?? '3');
  // [Phase1b] 길드 거버넌스 모드 — true 면 거버너/도전/수비가 길드 단위. (mig 259, 기본 false)
  const guildGov     = String(await getSetting('guild_governance_enabled')     ?? 'false') === 'true';

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // ── 섹터 존재 확인 (FOR UPDATE OF sd: sector_definitions는 항상 존재하므로 ungoverned 섹터도 안전하게 락) ──
    const secRes = await client.query(
      'SELECT sd.*, sg.governor_wallet, sg.governor_guild_id, sg.active_siege_id FROM sector_definitions sd LEFT JOIN sector_governance sg ON sg.sector_code = sd.code WHERE sd.code = $1 FOR UPDATE OF sd',
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

    // ── [Phase1b] 길드 거버넌스: 도전 길드(리더/오피서만) + 수비 길드(현 거버너 길드) 확정 ──
    //   guildGov OFF 면 두 값 모두 null → 기존 개인 기반 동작 그대로.
    let challengerGuildId = null, defenderGuildId = null;
    if (guildGov) {
      const gmRes = await client.query(
        'SELECT guild_id, role FROM guild_members WHERE LOWER(wallet) = LOWER($1)', [w]
      );
      const gm = gmRes.rows[0];
      if (!gm) { await client.query('ROLLBACK'); return { success: false, error: 'not_in_guild' }; }
      if (!['leader', 'officer'].includes(String(gm.role))) {
        await client.query('ROLLBACK'); return { success: false, error: 'guild_rank_required' };
      }
      challengerGuildId = gm.guild_id;
      defenderGuildId   = sector.governor_guild_id || null;
      // 자기 길드가 이미 거버너면 공성 금지
      if (defenderGuildId && defenderGuildId === challengerGuildId) {
        await client.query('ROLLBACK'); return { success: false, error: 'already_governor_guild' };
      }
    }

    // ── governor_sieges INSERT ──
    const now = new Date();
    // [Phase 3] 주간 공성 캘린더 — 결전 시각을 고정 슬롯으로 스냅(관전 집중). 비활성 시 기존 now+warning_hours.
    let siegeStartsAt;
    const schedEnabled = String(await getSetting('siege_schedule_enabled') ?? 'false') === 'true';
    if (schedEnabled) {
      const dows = String(await getSetting('siege_schedule_dows') ?? '3,6').split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n));
      const hourUtc = parseInt(await getSetting('siege_schedule_hour_utc') ?? '12');
      const minNotice = parseInt(await getSetting('siege_schedule_min_notice_hours') ?? '6');
      siegeStartsAt = _nextSiegeSlot(new Date(now.getTime() + minNotice * 3600000), dows, hourUtc);
    } else {
      siegeStartsAt = new Date(now.getTime() + warnHours * 3600000);
    }
    const siegeEndsAt   = new Date(siegeStartsAt.getTime() + battleHours * 3600000);

    const siegeRes = await client.query(
      `INSERT INTO governor_sieges
         (sector_code, challenger_wallet, defender_wallet, status,
          gp_cost, declared_at, siege_starts_at, siege_ends_at,
          challenger_guild_id, defender_guild_id)
       VALUES ($1, $2, $3, 'pending', $4, NOW(), $5, $6, $7, $8)
       RETURNING *`,
      [code, w, sector.governor_wallet || null, gpCost, siegeStartsAt, siegeEndsAt,
       challengerGuildId, defenderGuildId]
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
async function resolveSiege(siegeId, opts = {}) {
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

    // [Phase 3] 커맨더 공성은 전용 resolver 로 위임 (섹터 픽셀/거버너 로직 미적용)
    if (siege.siege_kind === 'commander') {
      await client.query('ROLLBACK');
      let winnerSide = null;
      if (siege.fleet_battle_id) {
        const b = (await pool.query('SELECT status, winner_side FROM fleet_battles WHERE id = $1', [siege.fleet_battle_id])).rows[0];
        // [QA fix] 진행 중(preparing/active)만 보류. cancelled/소실은 무승부(수비자 유지)로 해결 — dead-lock 방지.
        if (b && (b.status === 'preparing' || b.status === 'active')) return { success: true, pending: true, reason: 'battle_not_ended' };
        winnerSide = b ? b.winner_side : null; // ended → winner_side / cancelled·없음 → null(수비자 유지)
      }
      return await resolveCommanderSiege(siegeId, { winnerSide });
    }

    const code = siege.sector_code;

    // [Phase1b] 거버너 이전 race 방지 — 해결 동안 sector_governance 행 잠금 (Codex 검토 지적)
    await client.query('SELECT 1 FROM sector_governance WHERE sector_code = $1 FOR UPDATE', [code]);
    const guildGov = String(await getSetting('guild_governance_enabled') ?? 'false') === 'true';

    // ── [Phase1] fleet-combat 모드: 결전 전투 결과로 승자 결정 ──
    //   전투가 아직 안 끝났으면 해결 보류(pending) — battleScheduler 종료 훅이 다시 호출.
    let battleWinnerWallet; // undefined = 전투모드 아님 / null = draw(수비자 유지)
    if (siege.resolution_mode === 'fleet_battle' && !opts.force) {
      if (opts.battleWinnerWallet !== undefined) {
        battleWinnerWallet = opts.battleWinnerWallet; // 훅에서 매핑해 전달
      } else if (siege.fleet_battle_id) {
        const bRes = await client.query(
          'SELECT status, winner_side FROM fleet_battles WHERE id = $1', [siege.fleet_battle_id]
        );
        const b = bRes.rows[0];
        if (b && (b.status === 'preparing' || b.status === 'active')) {
          await client.query('ROLLBACK');
          return { success: true, pending: true, reason: 'battle_not_ended' };
        }
        if (!b || b.status === 'cancelled') {
          // [QA fix] 전투 취소/소실 → 픽셀 폴백으로 해결 진행(섹터 dead-lock 방지). 링크/모드 리셋.
          await client.query("UPDATE governor_sieges SET fleet_battle_id = NULL, resolution_mode = 'pixel_fallback' WHERE id = $1", [siegeId]);
          // battleWinnerWallet 미설정 → 아래 픽셀 비교로 승자 결정
        } else {
          battleWinnerWallet = b.winner_side === 'atk' ? siege.challenger_wallet
                             : (siege.defender_wallet || null); // ended: def/draw → 수비자 유지
        }
      }
    }

    // ── 도전자 / 수비자 영토 수 비교 (픽셀 폴백) ──
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

    // ── 승자 결정: 전투 모드면 전투 결과, 아니면 영토 수 비교 ──
    const winnerWallet = (battleWinnerWallet !== undefined)
      ? battleWinnerWallet
      : (chalPx > defPx ? siege.challenger_wallet : (siege.defender_wallet || null));

    // [Phase1b] 승자 길드 매핑 — guildGov 일 때만. 승자 지갑이 도전자면 도전 길드, 아니면 수비 길드.
    const winnerGuildId = !guildGov ? null
      : (winnerWallet && winnerWallet === siege.challenger_wallet
          ? (siege.challenger_guild_id || null)
          : (winnerWallet ? (siege.defender_guild_id || null) : null));

    // ── governor_sieges 업데이트 ──
    await client.query(
      `UPDATE governor_sieges
       SET status = 'resolved', winner_wallet = $1,
           final_challenger_px = $2, final_defender_px = $3,
           winner_guild_id = $5, resolved_at = NOW()
       WHERE id = $4`,
      [winnerWallet, chalPx, defPx, siegeId, winnerGuildId]
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
      // 새 Governor 취임. [Phase1b] guildGov 면 거버너 길드도 이전(governor_guild_id), 대표 멤버 표시.
      await client.query(
        `UPDATE sector_governance
         SET governor_wallet = $1, governor_guild_id = $2, governor_member_wallet = $3,
             governor_since = NOW(), active_siege_id = NULL, total_tax_collected = 0
         WHERE sector_code = $4`,
        [winnerWallet, winnerGuildId, (guildGov ? winnerWallet : null), code]
      );
    } else {
      // 수비자 승리 또는 Governor 없는 섹터
      await client.query(
        'UPDATE sector_governance SET active_siege_id = NULL WHERE sector_code = $1',
        [code]
      );
    }

    // [Phase A] 지오 정본 동기화 — 거버너가 실제로 바뀐 경우 sectors/세금 경로에도 반영.
    //   siege_governor_canonical_enabled 게이트. 같은 트랜잭션이라 원자적.
    const canonicalGov = String(await getSetting('siege_governor_canonical_enabled') ?? 'false') === 'true';
    if (canonicalGov && winnerWallet && winnerWallet !== siege.defender_wallet) {
      const sidRow = (await client.query(
        'SELECT sector_id FROM sector_governance WHERE sector_code = $1', [code]
      )).rows[0];
      if (sidRow && sidRow.sector_id) {
        await _installGeoGovernor(client, sidRow.sector_id, winnerWallet);
      }
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

  // [Phase A] 지오 정본: 실제 세금 징수가 읽는 sectors.tax_rate 도 동기화 (canonical 게이트).
  const canonicalGov = String(await getSetting('siege_governor_canonical_enabled') ?? 'false') === 'true';
  if (canonicalGov) {
    const sidRow = (await pool.query('SELECT sector_id FROM sector_governance WHERE sector_code = $1', [code])).rows[0];
    if (sidRow && sidRow.sector_id) {
      await pool.query('UPDATE sectors SET tax_rate = $1 WHERE id = $2', [rate, sidRow.sector_id]).catch(() => {});
    }
  }
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

// ─────────────────────────────────────────────────────────────
// [Phase1] 공성 함대 커밋 — 도전자/수비자가 결전에 투입할 함대 지정
//   결전 전투 생성(fleet_battle_id) 전까지 변경 가능. 소유/상태 검증.
// ─────────────────────────────────────────────────────────────
async function commitSiegeFleet(siegeId, wallet, fleetId) {
  const w = String(wallet || '').toLowerCase();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const sRes = await client.query('SELECT * FROM governor_sieges WHERE id = $1 FOR UPDATE', [siegeId]);
    if (!sRes.rows.length) { await client.query('ROLLBACK'); return { success: false, error: 'siege_not_found' }; }
    const siege = sRes.rows[0];
    if (siege.status === 'resolved') { await client.query('ROLLBACK'); return { success: false, error: 'siege_resolved' }; }
    if (siege.fleet_battle_id)       { await client.query('ROLLBACK'); return { success: false, error: 'battle_already_created' }; }

    // 측 판별: 도전자/수비자 본인, 또는 [Phase1b] guildGov 면 해당 길드 리더/오피서
    let side;
    if (siege.challenger_wallet && siege.challenger_wallet.toLowerCase() === w) side = 'challenger';
    else if (siege.defender_wallet && siege.defender_wallet.toLowerCase() === w) side = 'defender';
    else {
      const guildGov = String(await getSetting('guild_governance_enabled') ?? 'false') === 'true';
      if (guildGov) {
        const gm = (await client.query(
          'SELECT guild_id, role FROM guild_members WHERE LOWER(wallet) = LOWER($1)', [w]
        )).rows[0];
        if (gm && ['leader', 'officer'].includes(String(gm.role))) {
          if (gm.guild_id === siege.challenger_guild_id) side = 'challenger';
          else if (gm.guild_id === siege.defender_guild_id) side = 'defender';
        }
      }
      if (!side) { await client.query('ROLLBACK'); return { success: false, error: 'not_a_participant' }; }
    }

    // 함대 소유/상태 검증 (FOR UPDATE — is_in_battle TOCTOU 방지)
    const fRes = await client.query(
      'SELECT id, is_in_battle FROM fleets WHERE id = $1 AND LOWER(owner_wallet) = LOWER($2) FOR UPDATE',
      [fleetId, w]
    );
    if (!fRes.rows.length) { await client.query('ROLLBACK'); return { success: false, error: 'fleet_not_found' }; }
    if (fRes.rows[0].is_in_battle) { await client.query('ROLLBACK'); return { success: false, error: 'fleet_in_battle' }; }
    // [P0-1 fix] 채굴 중 함대는 공성 합류 불가 — 채굴↔전투 이중 점유 + 마모 함선 full-loss 소각 방지.
    try {
      const mRes = await client.query(
        `SELECT 1 FROM ship_mining_jobs WHERE fleet_id = $1 AND status = 'mining' LIMIT 1`, [fleetId]
      );
      if (mRes.rows.length) { await client.query('ROLLBACK'); return { success: false, error: 'fleet_mining' }; }
    } catch (_) { /* ship_mining_jobs 미존재(마이그 전) — 무시 */ }
    const shipRes = await client.query(
      'SELECT COUNT(*) AS cnt FROM ships WHERE fleet_id = $1 AND is_alive = true AND is_market_listed = false',
      [fleetId]
    );
    if (parseInt(shipRes.rows[0]?.cnt ?? 0) < 1) { await client.query('ROLLBACK'); return { success: false, error: 'fleet_empty' }; }

    // [Phase 2] 다중 함대 — siege_fleet_commits 에 upsert(지갑당 1함대). 진영 정원 체크.
    const battleSide = side === 'challenger' ? 'atk' : 'def';
    const maxPerSide = parseInt(await getSetting('siege_max_fleets_per_side') ?? '20');
    const cntRes = await client.query(
      'SELECT COUNT(*)::int AS c FROM siege_fleet_commits WHERE siege_id = $1 AND side = $2 AND wallet <> LOWER($3)',
      [siegeId, battleSide, w]
    );
    if (parseInt(cntRes.rows[0].c) >= maxPerSide) { await client.query('ROLLBACK'); return { success: false, error: 'side_full', max: maxPerSide }; }
    await client.query(
      `INSERT INTO siege_fleet_commits (siege_id, wallet, fleet_id, side) VALUES ($1, LOWER($2), $3, $4)
       ON CONFLICT (siege_id, wallet) DO UPDATE SET fleet_id = $3, side = $4, committed_at = NOW()`,
      [siegeId, w, fleetId, battleSide]
    );
    // 대표 함대(단일 컬럼) — prepareSiegeBattles 게이트/요약 호환. 비어있을 때만 채움.
    const col = side === 'challenger' ? 'challenger_fleet_id' : 'defender_fleet_id';
    await client.query(`UPDATE governor_sieges SET ${col} = COALESCE(${col}, $1) WHERE id = $2`, [fleetId, siegeId]);
    await client.query('COMMIT');
    notifyOpsProgress(w, ['siege_fleet_commit']);
    addSeasonScore(w, 'guild_contrib', 1);
    return { success: true, side: battleSide, fleetId };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('[SIEGE] commitSiegeFleet error:', err.message);
    return { success: false, error: 'internal_error' };
  } finally {
    client.release();
  }
}

// ─────────────────────────────────────────────────────────────
// [Phase1] 활성 공성 중 양측 함대 커밋된 건에 대해 결전 함대전 생성
//   siege_fleet_combat_enabled=true 일 때만. battleScheduler 가 생성된 전투를 실행.
//   스케줄러 tick 에서 resolveExpiredSieges(pending→active 전환) 직후 호출한다.
// ─────────────────────────────────────────────────────────────
async function prepareSiegeBattles() {
  const enabled = String(await getSetting('siege_fleet_combat_enabled') ?? 'false') === 'true';
  if (!enabled) return 0;

  const rows = (await pool.query(
    `SELECT id, challenger_wallet, defender_wallet, challenger_fleet_id, defender_fleet_id
       FROM governor_sieges
      WHERE status = 'active'
        AND fleet_battle_id IS NULL
        AND challenger_fleet_id IS NOT NULL
        AND defender_fleet_id IS NOT NULL`
  )).rows;
  if (!rows.length) return 0;

  let bridge;
  try { bridge = require('./siegeFleetBridge'); } catch (_) { return 0; }
  let created = 0;
  for (const s of rows) {
    try {
      // [Phase 2] 다함대 — siege_fleet_commits 의 모든 함대를 양 진영 참가자로. (게이트: 대표 함대 = ≥1/측)
      await bridge.createSiegeBattleMulti({
        governor_siege_id: s.id,
        sector_id: null, claim_id: null,
        delay_hours: 0, // 고정 결전 시각 = 지금. battleScheduler 가 곧 실행.
      });
      await pool.query(`UPDATE governor_sieges SET resolution_mode = 'fleet_battle' WHERE id = $1`, [s.id]);
      created++;
    } catch (e) {
      console.warn(`[SIEGE] prepareSiegeBattles: siege ${s.id} battle create failed (${e.message}) — 픽셀 폴백 유지`);
    }
  }
  if (created > 0) console.log(`[SIEGE] prepareSiegeBattles: ${created} siege fleet battle(s) created`);
  return created;
}

// ─────────────────────────────────────────────────────────────
// [Phase A] 지오 정본 동기화 — 공성 승자를 sectors/governance_positions(라이브 세금 경로)에 설치.
//   sector_governance(코드 우주) 갱신과 별개로, 실제 세수가 흐르는 sectors(지오) 거버너를 교체하고
//   siege_governor_locked=true 로 픽셀 자동 재산정의 덮어쓰기를 막는다. (siege_governor_canonical_enabled 게이트)
// ─────────────────────────────────────────────────────────────
async function _installGeoGovernor(client, sectorId, newGov) {
  if (!sectorId || !newGov) return;
  const cur = (await client.query('SELECT governor_wallet FROM sectors WHERE id = $1', [sectorId])).rows[0];
  if (!cur) return;
  const oldGov = cur.governor_wallet;
  const nw = String(newGov).toLowerCase();
  if (oldGov && oldGov.toLowerCase() === nw) {
    // 동일 거버너 — 누적 세수 리셋 없이 잠금만 보장
    await client.query('UPDATE sectors SET siege_governor_locked = true WHERE id = $1', [sectorId]);
    return;
  }
  // 옛 거버너 포지션 정리: 잔여 GP → sector_pool, 히스토리 종료, 포지션 제거
  if (oldGov) {
    const oldPos = (await client.query(
      `SELECT gp_balance FROM governance_positions WHERE role='governor' AND sector_id=$1 FOR UPDATE`, [sectorId]
    )).rows[0];
    const oldGP = oldPos ? (parseFloat(oldPos.gp_balance) || 0) : 0;
    if (oldGP > 0) {
      await client.query('UPDATE sectors SET sector_pool_gp = sector_pool_gp + $1 WHERE id = $2', [oldGP, sectorId]);
    }
    await client.query(
      `UPDATE governance_history SET ended_at=NOW(), tenure_seconds=EXTRACT(EPOCH FROM (NOW()-started_at))::int
       WHERE wallet=$1 AND role='governor' AND sector_id=$2 AND ended_at IS NULL`, [oldGov, sectorId]
    );
    await client.query(`DELETE FROM governance_positions WHERE role='governor' AND sector_id=$1`, [sectorId]);
  }
  // [QA fix] 옛 정권 vice_governor 포지션도 정리 — siege_governor_locked 로 픽셀 재산정이 멈추므로
  //   stale vice 가 새 거버너 섹터 세금 20%를 영구 수취하는 누수 차단. 잔여 GP → sector_pool 후 제거.
  try {
    const oldVice = (await client.query(
      `SELECT gp_balance FROM governance_positions WHERE role='vice_governor' AND sector_id=$1 FOR UPDATE`, [sectorId]
    )).rows[0];
    if (oldVice) {
      const vgp = parseFloat(oldVice.gp_balance) || 0;
      if (vgp > 0) await client.query('UPDATE sectors SET sector_pool_gp = sector_pool_gp + $1 WHERE id = $2', [vgp, sectorId]);
      await client.query(
        `UPDATE governance_history SET ended_at=NOW(), tenure_seconds=EXTRACT(EPOCH FROM (NOW()-started_at))::int
         WHERE role='vice_governor' AND sector_id=$1 AND ended_at IS NULL`, [sectorId]
      );
      await client.query(`DELETE FROM governance_positions WHERE role='vice_governor' AND sector_id=$1`, [sectorId]);
    }
  } catch (_) { /* vice 없음 */ }
  // 새 거버너 설치 (포지션 + 히스토리 + sectors)
  await client.query(
    `INSERT INTO governance_positions (wallet, role, sector_id, gp_balance, appointed_at)
     VALUES ($1, 'governor', $2, 0, NOW())
     ON CONFLICT (role, sector_id) DO UPDATE SET wallet=$1, gp_balance=0, appointed_at=NOW()`, [nw, sectorId]
  );
  await client.query(
    `INSERT INTO governance_history (wallet, role, sector_id, started_at) VALUES ($1, 'governor', $2, NOW())`, [nw, sectorId]
  );
  await client.query(
    'UPDATE sectors SET governor_wallet=$1, governor_since=NOW(), siege_governor_locked=true WHERE id=$2', [nw, sectorId]
  );
}

// ═══════════════════════════════════════════════════════════════
// [Phase 3] 커맨더 공성(맹주전) — 맹주(sov 1위)=수비 vs 최강 도전자(sov 2위)=공격.
//   governor_sieges(siege_kind='commander', sector_code='__commander__') 재사용.
//   양측 길드원이 commitSiegeFleet 으로 합류 → prepareSiegeBattles → createSiegeBattleMulti →
//   simulateBattleLive → applySiegeResult(commander 분기) → resolveCommanderSiege → mars_commander 갱신.
// ═══════════════════════════════════════════════════════════════
async function declareCommanderSiege() {
  const enabled = String(await getSetting('commander_siege_enabled') ?? 'false') === 'true';
  if (!enabled) return { success: false, error: 'commander_siege_disabled' };
  // 이미 진행 중?
  const active = (await pool.query("SELECT id FROM governor_sieges WHERE siege_kind='commander' AND status IN ('pending','active')")).rows;
  if (active.length) return { success: false, error: 'commander_siege_active', siegeId: active[0].id };
  // sov 현황으로 맹주(수비)·도전자(공격) 산정
  const sov = await require('./sector').getSovMap();
  const mc = (await pool.query('SELECT guild_id FROM mars_commander WHERE id = 1')).rows[0];
  const champGuildId = (mc && mc.guild_id) || (sov.commander && sov.commander.id) || (sov.leaderboard[0] && sov.leaderboard[0].id) || null;
  const challenger = (sov.leaderboard || []).find(g => g.id !== champGuildId) || null;
  if (!challenger) return { success: false, error: 'no_challenger' };
  const minSectors = parseInt(await getSetting('commander_min_sectors', '3')) || 3;
  if ((challenger.count || 0) < minSectors) return { success: false, error: 'challenger_below_min', required: minSectors };

  const noticeH = parseInt(await getSetting('commander_siege_notice_hours', '24')) || 24;
  const battleHours = parseInt(await getSetting('siege_battle_hours') ?? '24');
  const startsAt = new Date(Date.now() + noticeH * 3600000);
  const endsAt = new Date(startsAt.getTime() + battleHours * 3600000);
  const champLeader = champGuildId ? (await pool.query('SELECT leader_wallet FROM guilds WHERE id = $1', [champGuildId])).rows[0]?.leader_wallet : null;
  const chalLeader = (await pool.query('SELECT leader_wallet FROM guilds WHERE id = $1', [challenger.id])).rows[0]?.leader_wallet;
  const res = await pool.query(
    `INSERT INTO governor_sieges (sector_code, siege_kind, challenger_wallet, defender_wallet, status, gp_cost, declared_at, siege_starts_at, siege_ends_at, challenger_guild_id, defender_guild_id)
     VALUES ('__commander__','commander',$1,$2,'pending',0,NOW(),$3,$4,$5,$6) RETURNING id`,
    [chalLeader, champLeader, startsAt, endsAt, challenger.id, champGuildId]
  );
  return { success: true, siegeId: res.rows[0].id, championGuildId: champGuildId, challengerGuildId: challenger.id, startsAt, endsAt };
}

async function resolveCommanderSiege(siegeId, opts = {}) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const s = (await client.query('SELECT * FROM governor_sieges WHERE id = $1 FOR UPDATE', [siegeId])).rows[0];
    if (!s || s.status === 'resolved') { await client.query('ROLLBACK'); return { success: true, alreadyResolved: true }; }
    const winnerSide = opts.winnerSide; // 'atk'|'def'|'draw'|null
    // atk 승리 → 도전 길드 즉위 / def·draw·미정 → 현 맹주(수비 길드) 유지
    const winnerGuildId = winnerSide === 'atk' ? s.challenger_guild_id : (s.defender_guild_id || null);
    await client.query("UPDATE governor_sieges SET status='resolved', resolved_at=NOW(), winner_guild_id=$1 WHERE id=$2", [winnerGuildId, siegeId]);
    if (winnerGuildId) {
      const g = (await client.query('SELECT name, tag FROM guilds WHERE id = $1', [winnerGuildId])).rows[0];
      // since: 같은 길드 방어성공이면 유지, 새 맹주면 NOW
      await client.query(
        `UPDATE mars_commander SET guild_id=$1, guild_tag=$2, guild_name=$3, elected_siege_id=$4,
            since = COALESCE((SELECT since FROM mars_commander WHERE id=1 AND guild_id=$1), NOW()), updated_at=NOW()
          WHERE id = 1`,
        [winnerGuildId, g && g.tag, g && g.name, siegeId]
      );
    }
    await client.query('COMMIT');
    // 칭호(non-blocking)
    if (titleService && winnerGuildId) {
      const lw = (await pool.query('SELECT leader_wallet FROM guilds WHERE id=$1', [winnerGuildId])).rows[0]?.leader_wallet;
      if (lw) titleService.checkAndAwardTitles(lw, 'commander_win', { guild_id: winnerGuildId }).catch(() => {});
    }
    console.log(`[COMMANDER] siege ${siegeId} resolved — commander guild=${winnerGuildId} (winnerSide=${winnerSide})`);
    return { success: true, commanderGuildId: winnerGuildId };
  } catch (e) {
    await client.query('ROLLBACK'); console.error('[COMMANDER] resolveCommanderSiege error:', e.message);
    return { success: false, error: 'internal_error' };
  } finally { client.release(); }
}

// [Phase 3] 월간 자동 커맨더 공성 — 스케줄러 tick 에서 호출. 매월 dom일 hourUtc시(UTC) 슬롯 1회.
//   도전자 있으면 declareCommanderSiege 개최 / 없으면 무도전 streak++ → 임계 시 맹주 vacant(sov 파생 폴백).
async function maybeOpenCommanderSiege() {
  try {
    if (String(await getSetting('commander_siege_auto_enabled') ?? 'false') !== 'true') return;
    const active = (await pool.query("SELECT id FROM governor_sieges WHERE siege_kind='commander' AND status IN ('pending','active')")).rows;
    if (active.length) return; // 진행 중이면 skip
    const dom = parseInt(await getSetting('commander_siege_dom', '1')) || 1;
    const hourUtc = parseInt(await getSetting('commander_siege_hour_utc', '12')) || 12;
    const now = new Date();
    const slot = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), dom, hourUtc, 0, 0, 0));
    if (now.getTime() < slot.getTime()) return; // 이번 달 슬롯 전
    const mc = (await pool.query('SELECT last_attempt_at, no_challenge_streak FROM mars_commander WHERE id = 1')).rows[0] || {};
    if (mc.last_attempt_at && new Date(mc.last_attempt_at).getTime() >= slot.getTime()) return; // 이번 달 이미 시도
    await pool.query('UPDATE mars_commander SET last_attempt_at = NOW() WHERE id = 1');
    const res = await declareCommanderSiege();
    if (res && res.success) {
      await pool.query('UPDATE mars_commander SET no_challenge_streak = 0 WHERE id = 1');
      console.log(`[COMMANDER] auto commander siege opened — siege ${res.siegeId}`);
    } else {
      const vac = parseInt(await getSetting('commander_vacate_after_no_challenge', '3')) || 3;
      const streak = (parseInt(mc.no_challenge_streak) || 0) + 1;
      if (streak >= vac) {
        await pool.query('UPDATE mars_commander SET guild_id=NULL, guild_tag=NULL, guild_name=NULL, no_challenge_streak=0, updated_at=NOW() WHERE id = 1');
        console.log(`[COMMANDER] no challenge ${streak}x → commander vacated (sov fallback)`);
      } else {
        await pool.query('UPDATE mars_commander SET no_challenge_streak = $1 WHERE id = 1', [streak]);
        console.log(`[COMMANDER] auto siege no challenger (streak ${streak}/${vac}, reason=${res && res.error})`);
      }
    }
  } catch (e) { console.warn('[COMMANDER] maybeOpenCommanderSiege error:', e.message); }
}

module.exports = {
  declareSiege,
  resolveSiege,
  declareCommanderSiege,
  resolveCommanderSiege,
  maybeOpenCommanderSiege,
  getActiveSiege,
  getSiegeStatus,
  getSiegeHistory,
  resolveExpiredSieges,
  commitSiegeFleet,
  prepareSiegeBattles,
  getSiegeSchedule,
  updateGovernorDeclaration,
  updateTaxRate,
  updateSectorPolicy
};
