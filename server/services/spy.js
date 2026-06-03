// PvP 스파이/정찰 — 적 함대 구성 노출(GP 소각) + 탐지 통보 + 이중첩자(캠페인 태그) 할인.
// 배신 시스템 Phase 3 / 시스템2.
const { pool, getSetting, notifyPlayer, logGPActivity } = require('../db');
const { randomInt } = require('crypto');

// 정찰: scoutWallet 이 targetWallet 의 전체 함대 구성/전투력을 노출.
async function scoutTarget(scoutWallet, targetWallet) {
  const enabled = String(await getSetting('spy_enabled', 'true')).toLowerCase() !== 'false';
  if (!enabled) return { error: 'SPY_DISABLED' };
  const scout = (scoutWallet || '').toLowerCase().trim();
  const target = (targetWallet || '').toLowerCase().trim();
  if (!scout || !target) return { error: 'INVALID_WALLET' };
  if (scout === target) return { error: 'CANNOT_SCOUT_SELF' };

  const baseCost = parseInt(await getSetting('spy_scout_cost_gp', '500'), 10) || 500;
  const detectPct = parseFloat(await getSetting('spy_detection_chance_pct', '35')) || 0;
  const ttlHours = parseInt(await getSetting('spy_intel_ttl_hours', '12'), 10) || 12;
  const daDiscount = parseFloat(await getSetting('spy_double_agent_discount_pct', '50')) || 0;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 표적 존재 확인
    const tgt = await client.query('SELECT 1 FROM users WHERE LOWER(wallet_address) = LOWER($1)', [target]);
    if (!tgt.rows.length) { await client.query('ROLLBACK'); return { error: 'TARGET_NOT_FOUND' }; }

    // 이중첩자 할인: 캠페인 스파이 태그(the_handler) 보유 시 정찰 비용 할인
    let cost = baseCost, doubleAgent = false;
    const da = await client.query(`SELECT 1 FROM player_tags WHERE wallet = $1 AND tag_id = 'the_handler'`, [scout]);
    if (da.rows.length) { doubleAgent = true; cost = Math.max(0, Math.floor(baseCost * (100 - daDiscount) / 100)); }

    // GP 차감(소각 싱크)
    if (cost > 0) {
      const ded = await client.query(
        'UPDATE users SET gp_balance = gp_balance - $1 WHERE LOWER(wallet_address) = LOWER($2) AND gp_balance >= $1 RETURNING gp_balance',
        [cost, scout]
      );
      if (!ded.rowCount) { await client.query('ROLLBACK'); return { error: 'INSUFFICIENT_GP', required: cost }; }
    }

    // 표적 함대 인텔 스냅샷 (살아있는 함선 집계)
    const intelRes = await client.query(`
      SELECT
        COUNT(*) FILTER (WHERE s.is_alive)                                              AS ships_alive,
        COUNT(DISTINCT s.fleet_id) FILTER (WHERE s.is_alive)                            AS fleet_count,
        COUNT(*) FILTER (WHERE st.size_class='frigate'    AND s.is_alive)               AS frigates,
        COUNT(*) FILTER (WHERE st.size_class='destroyer'  AND s.is_alive)               AS destroyers,
        COUNT(*) FILTER (WHERE st.size_class='cruiser'    AND s.is_alive)               AS cruisers,
        COUNT(*) FILTER (WHERE st.size_class='battleship' AND s.is_alive)               AS battleships,
        COUNT(*) FILTER (WHERE st.size_class='titan'      AND s.is_alive)               AS titans,
        COUNT(*) FILTER (WHERE st.size_class='assembled'  AND s.is_alive)               AS assembled,
        COALESCE(SUM((st.base_hp  + COALESCE(s.bonus_hp,0))) FILTER (WHERE s.is_alive),0)  AS total_max_hp,
        COALESCE(SUM(s.current_hp) FILTER (WHERE s.is_alive),0)                         AS total_current_hp,
        COALESCE(SUM((st.base_atk + COALESCE(s.bonus_atk,0))) FILTER (WHERE s.is_alive),0) AS total_atk,
        COALESCE(SUM((st.base_def + COALESCE(s.bonus_def,0))) FILTER (WHERE s.is_alive),0) AS total_def
      FROM ships s
      JOIN fleets f ON f.id = s.fleet_id
      JOIN ship_types st ON st.code = s.ship_type_code
      WHERE LOWER(f.owner_wallet) = LOWER($1)
    `, [target]);
    const r = intelRes.rows[0] || {};
    const intel = {
      ships_alive:  parseInt(r.ships_alive)  || 0,
      fleet_count:  parseInt(r.fleet_count)  || 0,
      composition:  {
        frigate:    parseInt(r.frigates)    || 0,
        destroyer:  parseInt(r.destroyers)  || 0,
        cruiser:    parseInt(r.cruisers)    || 0,
        battleship: parseInt(r.battleships) || 0,
        titan:      parseInt(r.titans)      || 0,
        assembled:  parseInt(r.assembled)   || 0,
      },
      total_max_hp:     parseInt(r.total_max_hp)     || 0,
      total_current_hp: parseInt(r.total_current_hp) || 0,
      total_atk:        parseInt(r.total_atk)        || 0,
      total_def:        parseInt(r.total_def)        || 0,
    };

    // 탐지 롤: 표적 통보 여부
    const detected = detectPct > 0 && randomInt(1, 101) <= Math.round(detectPct);

    // 보고서 저장
    const ins = await client.query(
      `INSERT INTO spy_reports (scout_wallet, target_wallet, intel, cost_gp, detected, expires_at)
       VALUES ($1,$2,$3,$4,$5, NOW() + ($6 || ' hours')::INTERVAL)
       RETURNING id, created_at, expires_at`,
      [scout, target, JSON.stringify(intel), cost, detected, String(ttlHours)]
    );

    await client.query('COMMIT');

    // 부수효과 (fire-and-forget)
    if (cost > 0) {
      try { logGPActivity(scout, -cost, 'spy_scout', `정찰: ${target.slice(0,8)}`).catch(()=>{}); } catch (_) {}
    }
    if (detected) {
      try {
        notifyPlayer(target, 'spy_detected',
          `🛰️ 누군가 당신의 함대를 정찰했습니다 (${scout.slice(0,8)}…).`,
          { scout_wallet: scout }
        ).catch(()=>{});
      } catch (_) {}
    }

    return {
      success: true,
      report_id: ins.rows[0].id,
      cost_gp: cost,
      double_agent: doubleAgent,
      detected,
      intel,
      expires_at: ins.rows[0].expires_at,
    };
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch {}
    console.error('[SPY] scout error:', e.message);
    return { error: e.message };
  } finally {
    client.release();
  }
}

// 내 정찰 보고서(유효한 것)
async function getReports(scoutWallet, limit = 30) {
  const w = (scoutWallet || '').toLowerCase().trim();
  if (!w) return [];
  const { rows } = await pool.query(
    `SELECT id, target_wallet, intel, cost_gp, detected, created_at, expires_at,
            (expires_at < NOW()) AS stale
       FROM spy_reports WHERE scout_wallet = $1
      ORDER BY created_at DESC LIMIT $2`,
    [w, Math.min(parseInt(limit) || 30, 100)]
  );
  return rows;
}

module.exports = { scoutTarget, getReports };
