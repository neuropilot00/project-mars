'use strict';

// ⚠ STATUS: 🔴 BROKEN — schema mismatch
// 이 서비스는 `battles` 테이블에 attacker_wallet/defender_wallet/status/
// attacker_power/gp_stake/declared_at/expires_at 컬럼이 있다고 가정하지만,
// 실제 `battles` 테이블 스키마는 attacker/defender/claim_id 기반 단순 픽셀
// 전투용 (Migration 026-ish). routes/api.js의 claim 흐름이 이 단순 스키마로
// INSERT (현재 68 records).
//
// services/battle.js의 INSERT INTO battles (attacker_wallet, ...)는 42703으로
// 실패 → /api/battle/{declare,accept,cancel} 500 에러.
// user_ships, battle_ships 테이블도 phantom — 추가 silent 실패.
//
// index.html에 "DECLARE BATTLE" UI 있음 (line ~29380~29404). 클릭하면 500.
//
// 향후 결정 필요:
//  (A) 이 시스템을 fleet_battles로 마이그레이션 (UI 재배선) — 권장
//  (B) battles 테이블에 누락 컬럼 ALTER + user_ships/battle_ships 마이그레이션
//      → 두 시스템 병존 (fragmentation 유지)
//  (C) UI + battle.js + battleRoutes 삭제 — 가장 깨끗
// 현재: (B) 부분 적용 안 됨, 미결정 상태로 코드는 그대로 둠 (CLAUDE.md §13.B 참조).
// ═══════════════════════════════════════════════════════════════

/**
 * services/battle.js
 * Naval Battle Engine (Migration 093)
 *
 * declareBattle(attackerWallet, defenderWallet, attackerShipIds, gpStake)
 * acceptBattle(defenderWallet, battleId, defenderShipIds)
 * resolveBattle(battleId)             ← deterministic — called by scheduler + manual
 * cancelBattle(walletAddress, battleId)
 * getUserBattles(walletAddress)
 * getActiveBattles(limit)
 * getBattle(battleId)
 * settleExpiredBattles()              ← scheduler target (every 30s)
 */

const { pool } = require('../db');

async function getSetting(key, fallback = null) {
  try {
    const r = await pool.query('SELECT value FROM settings WHERE key = $1', [key]);
    return r.rows[0]?.value ?? fallback;
  } catch (_) { return fallback; }
}

// ── Combat formula ──
// Power = sum(ship ATK) + sum(ship DEF)*0.5 + sum(ship HP/max_hp * 20)
function _calcPower(ships) {
  return ships.reduce((total, s) => {
    return total
      + (parseInt(s.attack) || 0)
      + Math.floor((parseInt(s.defense) || 0) * 0.5)
      + Math.floor((parseInt(s.hp) / Math.max(1, parseInt(s.max_hp))) * 20);
  }, 0);
}

// ── declareBattle ──
async function declareBattle(attackerWallet, defenderWallet, attackerShipIds, gpStake) {
  if (attackerWallet === defenderWallet) return { success: false, error: 'cannot_attack_self' };

  const enabled = await getSetting('battle_enabled', 'true');
  if (enabled !== 'true') return { success: false, error: 'battle_system_disabled' };

  const minShips    = parseInt(await getSetting('battle_min_attacker_ships', '1')) || 1;
  const maxShips    = parseInt(await getSetting('battle_max_ships_per_side', '5')) || 5;
  const stakeMin    = parseInt(await getSetting('battle_gp_stake_min', '10')) || 10;
  const stakeMax    = parseInt(await getSetting('battle_gp_stake_max', '500')) || 500;
  const durationSec = parseInt(await getSetting('battle_duration_secs', '60')) || 60;

  gpStake = Math.max(stakeMin, Math.min(stakeMax, gpStake || stakeMin));

  if (!attackerShipIds || attackerShipIds.length < minShips)
    return { success: false, error: 'not_enough_ships', required: minShips };
  if (attackerShipIds.length > maxShips)
    return { success: false, error: 'too_many_ships', max: maxShips };

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Fetch attacker ships
    const shipRes = await client.query(
      `SELECT * FROM user_ships
       WHERE id = ANY($1) AND wallet_address = $2 AND status = 'docked'`,
      [attackerShipIds, attackerWallet]
    );
    if (shipRes.rows.length < minShips) {
      await client.query('ROLLBACK');
      return { success: false, error: 'ships_unavailable' };
    }

    // Check GP balance + deduct stake
    const userRes = await client.query(
      'SELECT gp_balance FROM users WHERE wallet_address = $1 FOR UPDATE',
      [attackerWallet]
    );
    if (!userRes.rows.length) { await client.query('ROLLBACK'); return { success: false, error: 'user_not_found' }; }
    if (parseFloat(userRes.rows[0].gp_balance) < gpStake) {
      await client.query('ROLLBACK');
      return { success: false, error: 'insufficient_gp', required: gpStake };
    }
    await client.query(
      'UPDATE users SET gp_balance = gp_balance - $1 WHERE wallet_address = $2',
      [gpStake, attackerWallet]
    );

    // ✅ Log GP stake
    try { const { logGPActivity } = require('../db'); logGPActivity(attackerWallet, -gpStake, 'battle_stake', `vs ${defenderWallet.slice(0,8)}…`).catch(()=>{}); } catch (_le) {}

    // Calculate attacker power
    const atkPower = _calcPower(shipRes.rows);

    // Create battle
    const battleRes = await client.query(
      `INSERT INTO battles (attacker_wallet, defender_wallet, status, attacker_power, gp_stake,
                            declared_at, expires_at)
       VALUES ($1, $2, 'pending', $3, $4, NOW(), NOW() + ($5 || ' seconds')::INTERVAL)
       RETURNING *`,
      [attackerWallet, defenderWallet, atkPower, gpStake, durationSec]
    );
    const battle = battleRes.rows[0];

    // Mark attacker ships as deployed
    await client.query(
      "UPDATE user_ships SET status = 'deployed' WHERE id = ANY($1)",
      [attackerShipIds]
    );

    // Insert battle_ships (attacker side)
    for (const ship of shipRes.rows) {
      await client.query(
        `INSERT INTO battle_ships (battle_id, ship_id, side, hp_at_start, hp_at_end)
         VALUES ($1, $2, 'attacker', $3, $3)`,
        [battle.id, ship.id, ship.hp]
      );
    }

    await client.query('COMMIT');

    // ✅ Notify defender
    try {
      const { notifyPlayer } = require('../db');
      const attackerNick = (await pool.query('SELECT nickname FROM users WHERE wallet_address=$1', [attackerWallet])).rows[0]?.nickname || attackerWallet.slice(0,8)+'…';
      notifyPlayer(defenderWallet, 'battle_declared',
        `⚔️ ${attackerNick} declared naval war on you! Stakes: ${gpStake} GP. Respond in GOVERN → NAVAL BATTLES.`,
        { battleId: battle.id, attacker: attackerWallet, gpStake }
      ).catch(() => {});
    } catch (_ne) {}

    return { success: true, battleId: battle.id, atkPower, gpStake };
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[BATTLE] declare error:', err.message);
    return { success: false, error: 'internal_error' };
  } finally {
    client.release();
  }
}

// ── acceptBattle (defender responds) ──
async function acceptBattle(defenderWallet, battleId, defenderShipIds) {
  const maxShips    = parseInt(await getSetting('battle_max_ships_per_side', '5')) || 5;
  const durationSec = parseInt(await getSetting('battle_duration_secs', '60')) || 60;

  if (defenderShipIds.length > maxShips)
    return { success: false, error: 'too_many_ships', max: maxShips };

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const battleRes = await client.query(
      "SELECT * FROM battles WHERE id = $1 AND defender_wallet = $2 AND status = 'pending' FOR UPDATE",
      [battleId, defenderWallet]
    );
    if (!battleRes.rows.length) {
      await client.query('ROLLBACK');
      return { success: false, error: 'battle_not_found' };
    }
    const battle = battleRes.rows[0];

    // Check GP balance
    const userRes = await client.query(
      'SELECT gp_balance FROM users WHERE wallet_address = $1 FOR UPDATE',
      [defenderWallet]
    );
    if (parseFloat(userRes.rows[0]?.gp_balance ?? 0) < battle.gp_stake) {
      await client.query('ROLLBACK');
      return { success: false, error: 'insufficient_gp', required: battle.gp_stake };
    }
    await client.query(
      'UPDATE users SET gp_balance = gp_balance - $1 WHERE wallet_address = $2',
      [battle.gp_stake, defenderWallet]
    );

    // Fetch defender ships
    let defPower = 0;
    if (defenderShipIds.length > 0) {
      const shipRes = await client.query(
        `SELECT * FROM user_ships WHERE id = ANY($1) AND wallet_address = $2 AND status = 'docked'`,
        [defenderShipIds, defenderWallet]
      );
      defPower = _calcPower(shipRes.rows);
      await client.query("UPDATE user_ships SET status = 'deployed' WHERE id = ANY($1)", [defenderShipIds]);
      for (const ship of shipRes.rows) {
        await client.query(
          `INSERT INTO battle_ships (battle_id, ship_id, side, hp_at_start, hp_at_end)
           VALUES ($1, $2, 'defender', $3, $3)`,
          [battleId, ship.id, ship.hp]
        );
      }
    }

    // Start battle
    await client.query(
      `UPDATE battles SET status = 'active', defender_power = $1,
                         expires_at = NOW() + ($2 || ' seconds')::INTERVAL
       WHERE id = $3`,
      [defPower, durationSec, battleId]
    );

    await client.query('COMMIT');
    return { success: true, battleId, defPower };
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[BATTLE] accept error:', err.message);
    return { success: false, error: 'internal_error' };
  } finally {
    client.release();
  }
}

// ── resolveBattle ── (can be called by scheduler or admin)
async function resolveBattle(battleId) {
  const winnerHpRestore = parseInt(await getSetting('battle_winner_hp_restore', '50')) || 50;
  const loserDestroyPct = parseInt(await getSetting('battle_loser_ship_destroy', '30')) || 30;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const bRes = await client.query(
      "SELECT * FROM battles WHERE id = $1 AND status IN ('pending','active') FOR UPDATE",
      [battleId]
    );
    if (!bRes.rows.length) { await client.query('ROLLBACK'); return { success: false, error: 'battle_not_found' }; }
    const battle = bRes.rows[0];

    let winnerWallet, loserWallet;
    const log = { rounds: [] };

    if (battle.status === 'pending') {
      // Defender never responded — attacker wins by default
      winnerWallet = battle.attacker_wallet;
      loserWallet  = battle.defender_wallet;
      log.result   = 'defender_no_show';
    } else {
      // Actual combat: compare power with small random variance (±10%)
      const atkPow = battle.attacker_power * (0.9 + Math.random() * 0.2);
      const defPow = battle.defender_power * (0.9 + Math.random() * 0.2);
      if (atkPow >= defPow) {
        winnerWallet = battle.attacker_wallet;
        loserWallet  = battle.defender_wallet;
        log.result   = 'attacker_wins';
      } else {
        winnerWallet = battle.defender_wallet;
        loserWallet  = battle.attacker_wallet;
        log.result   = 'defender_wins';
      }
      log.atkPow   = Math.round(atkPow);
      log.defPow   = Math.round(defPow);
    }

    const winnerSide = winnerWallet === battle.attacker_wallet ? 'attacker' : 'defender';
    const loserSide  = winnerSide === 'attacker' ? 'defender' : 'attacker';

    // Process winner ships: restore partial HP
    const winnerShips = await client.query(
      `SELECT bs.*, us.max_hp FROM battle_ships bs
       JOIN user_ships us ON us.id = bs.ship_id
       WHERE bs.battle_id = $1 AND bs.side = $2`,
      [battleId, winnerSide]
    );
    for (const bs of winnerShips.rows) {
      const restored = Math.floor((bs.max_hp - bs.hp_at_end) * (winnerHpRestore / 100));
      const newHp = Math.min(bs.max_hp, bs.hp_at_end + restored);
      await client.query(
        "UPDATE user_ships SET hp = $1, status = 'docked' WHERE id = $2",
        [newHp, bs.ship_id]
      );
      await client.query(
        'UPDATE battle_ships SET hp_at_end = $1, survived = TRUE WHERE id = $2',
        [newHp, bs.id]
      );
    }

    // Process loser ships: random destroy or damage
    const loserShips = await client.query(
      `SELECT bs.*, us.max_hp, us.build_cost_gp FROM battle_ships bs
       JOIN user_ships us ON us.id = bs.ship_id
       WHERE bs.battle_id = $1 AND bs.side = $2`,
      [battleId, loserSide]
    );
    let destroyedCount = 0;
    for (const bs of loserShips.rows) {
      const destroy = Math.random() * 100 < loserDestroyPct;
      if (destroy) {
        await client.query(
          "UPDATE user_ships SET status = 'destroyed', hp = 0, destroyed_at = NOW() WHERE id = $1",
          [bs.ship_id]
        );
        await client.query(
          'UPDATE battle_ships SET hp_at_end = 0, survived = FALSE WHERE id = $1',
          [bs.id]
        );
        destroyedCount++;
      } else {
        // Damage: reduce HP by 30–70%
        const dmgPct = 0.3 + Math.random() * 0.4;
        const newHp = Math.max(1, Math.floor(bs.hp_at_end * (1 - dmgPct)));
        await client.query(
          "UPDATE user_ships SET hp = $1, status = 'docked' WHERE id = $2",
          [newHp, bs.ship_id]
        );
        await client.query(
          'UPDATE battle_ships SET hp_at_end = $1, survived = TRUE WHERE id = $2',
          [newHp, bs.id]
        );
      }
    }
    log.destroyedCount = destroyedCount;

    // GP rewards: winner gets both stakes
    const totalGP = battle.gp_stake * 2;
    await client.query(
      'UPDATE users SET gp_balance = gp_balance + $1 WHERE wallet_address = $2',
      [totalGP, winnerWallet]
    );

    // Close battle
    await client.query(
      `UPDATE battles SET status = 'completed', winner_wallet = $1, battle_log = $2, resolved_at = NOW()
       WHERE id = $3`,
      [winnerWallet, JSON.stringify(log), battleId]
    );

    await client.query('COMMIT');

    // ✅ Season score for naval victory
    try {
      const seasonSvc = require('./season');
      seasonSvc.addSeasonScore(winnerWallet, 'naval_win', 1).catch(() => {});
    } catch (_re) {}

    // ✅ Daily mission progress: win_naval_battle
    try {
      const dailySvc = require('./daily');
      dailySvc.updateMissionProgress(winnerWallet, 'win_naval_battle', 1).catch(() => {});
    } catch (_de) {}

    // ✅ GP Activity log
    try { const { logGPActivity } = require('../db'); logGPActivity(winnerWallet, totalGP, 'battle_win', `vs ${loserWallet.slice(0,8)}…`).catch(()=>{}); } catch (_le) {}

    // ✅ Notify both winner and loser
    try {
      const { notifyPlayer } = require('../db');
      notifyPlayer(winnerWallet, 'battle_won',
        `🏆 Naval victory! You won battle #${battleId} and earned ${totalGP} GP!`,
        { battleId, gpAwarded: totalGP, destroyedCount }
      ).catch(() => {});
      notifyPlayer(loserWallet, 'battle_lost',
        `💀 Naval defeat. You lost battle #${battleId}. ${destroyedCount} ships were destroyed.`,
        { battleId, destroyedCount }
      ).catch(() => {});
    } catch (_ne) {}

    return {
      success: true,
      battleId,
      winner: winnerWallet,
      loser: loserWallet,
      gpAwarded: totalGP,
      destroyedCount,
      log
    };
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[BATTLE] resolve error:', err.message);
    return { success: false, error: 'internal_error' };
  } finally {
    client.release();
  }
}

// ── cancelBattle ── (attacker can cancel if still pending)
async function cancelBattle(walletAddress, battleId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const bRes = await client.query(
      "SELECT * FROM battles WHERE id = $1 AND attacker_wallet = $2 AND status = 'pending' FOR UPDATE",
      [battleId, walletAddress]
    );
    if (!bRes.rows.length) { await client.query('ROLLBACK'); return { success: false, error: 'battle_not_found' }; }
    const battle = bRes.rows[0];

    // Refund attacker stake
    await client.query(
      'UPDATE users SET gp_balance = gp_balance + $1 WHERE wallet_address = $2',
      [battle.gp_stake, walletAddress]
    );
    // Return ships
    await client.query(
      `UPDATE user_ships SET status = 'docked'
       WHERE id IN (SELECT ship_id FROM battle_ships WHERE battle_id = $1 AND side = 'attacker')`,
      [battleId]
    );
    await client.query("UPDATE battles SET status = 'cancelled' WHERE id = $1", [battleId]);
    await client.query('COMMIT');
    return { success: true };
  } catch (err) {
    await client.query('ROLLBACK');
    return { success: false, error: 'internal_error' };
  } finally {
    client.release();
  }
}

// ── getUserBattles ──
async function getUserBattles(walletAddress) {
  const res = await pool.query(
    `SELECT b.*,
            ua.nickname AS attacker_nick, ud.nickname AS defender_nick,
            uw.nickname AS winner_nick
     FROM battles b
     LEFT JOIN users ua ON ua.wallet_address = b.attacker_wallet
     LEFT JOIN users ud ON ud.wallet_address = b.defender_wallet
     LEFT JOIN users uw ON uw.wallet_address = b.winner_wallet
     WHERE b.attacker_wallet = $1 OR b.defender_wallet = $1
     ORDER BY b.declared_at DESC
     LIMIT 50`,
    [walletAddress]
  );
  return res.rows;
}

// ── getActiveBattles ──
async function getActiveBattles(limit = 20) {
  const res = await pool.query(
    `SELECT b.*,
            ua.nickname AS attacker_nick, ud.nickname AS defender_nick
     FROM battles b
     LEFT JOIN users ua ON ua.wallet_address = b.attacker_wallet
     LEFT JOIN users ud ON ud.wallet_address = b.defender_wallet
     WHERE b.status IN ('pending','active')
     ORDER BY b.declared_at DESC
     LIMIT $1`,
    [limit]
  );
  return res.rows;
}

// ── getBattle ──
async function getBattle(battleId) {
  const [b, ships] = await Promise.all([
    pool.query(
      `SELECT b.*, ua.nickname AS attacker_nick, ud.nickname AS defender_nick, uw.nickname AS winner_nick
       FROM battles b
       LEFT JOIN users ua ON ua.wallet_address = b.attacker_wallet
       LEFT JOIN users ud ON ud.wallet_address = b.defender_wallet
       LEFT JOIN users uw ON uw.wallet_address = b.winner_wallet
       WHERE b.id = $1`, [battleId]
    ),
    pool.query(
      `SELECT bs.*, us.ship_type, us.attack, us.defense, us.speed
       FROM battle_ships bs JOIN user_ships us ON us.id = bs.ship_id
       WHERE bs.battle_id = $1`, [battleId]
    )
  ]);
  if (!b.rows.length) return null;
  return { ...b.rows[0], ships: ships.rows };
}

// ── settleExpiredBattles ── (scheduler)
let _settleDisabled = false;
async function settleExpiredBattles() {
  if (_settleDisabled) return;
  let expired;
  try {
    expired = await pool.query(
      "SELECT id FROM battles WHERE status IN ('pending','active') AND expires_at < NOW() LIMIT 20"
    );
  } catch (e) {
    // battles table on this deployment may use a different schema (no status/expires_at).
    // Disable scheduler permanently — Naval Battle Engine is orphaned legacy code.
    if (e.code === '42P01' || e.code === '42703') {
      _settleDisabled = true;
      console.log('[BATTLE] settle disabled — schema mismatch');
      return;
    }
    throw e;
  }
  for (const row of expired.rows) {
    await resolveBattle(row.id).catch(e => console.error('[BATTLE] auto-resolve error:', row.id, e.message));
  }
}

module.exports = {
  declareBattle,
  acceptBattle,
  resolveBattle,
  cancelBattle,
  getUserBattles,
  getActiveBattles,
  getBattle,
  settleExpiredBattles,
};
