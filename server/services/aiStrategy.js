// services/aiStrategy.js
// ─────────────────────────────────────────────────────────────
// AI 전략 — hijack 외 battle (PvP/Siege/Event) 에 자동 진형/기동 명령
// commander_actions 테이블에 직접 INSERT (시뮬 전)
// hijack 은 사용자가 직접 컨트롤하므로 skip.
// ─────────────────────────────────────────────────────────────

const { pool, getSetting } = require('../db');

// 파벌별 doctrine — 어떤 진형/기동을 선호하는지
const FACTION_DOCTRINE = {
  // MCC: 정밀/screen 형태 — laser sniper 활용
  mcc: {
    formations: [['screen', 50], ['sphere', 30], ['wedge', 20]],
    maneuvers:  [['advance', 50], ['flank', 30], ['rally', 20]],
  },
  // FSP: 방어/sphere 중심 — tank/logi 회복 시간
  fsp: {
    formations: [['sphere', 50], ['screen', 30], ['pincer', 20]],
    maneuvers:  [['advance', 40], ['rally', 35], ['retreat', 25]],
  },
  // CV: 공격/wedge swarm
  cv: {
    formations: [['wedge', 50], ['pincer', 30], ['sphere', 20]],
    maneuvers:  [['flank', 50], ['advance', 35], ['scatter', 15]],
  },
};

function _weightedPick(table) {
  const total = table.reduce((s, [, w]) => s + w, 0);
  let roll = Math.random() * total;
  for (const [val, w] of table) {
    roll -= w;
    if (roll <= 0) return val;
  }
  return table[table.length - 1][0];
}

function pickFormation(factionCode) {
  const doc = FACTION_DOCTRINE[factionCode] || FACTION_DOCTRINE.mcc;
  return _weightedPick(doc.formations);
}

function pickManeuver(factionCode) {
  const doc = FACTION_DOCTRINE[factionCode] || FACTION_DOCTRINE.mcc;
  return _weightedPick(doc.maneuvers);
}

/**
 * AI 전략 적용 — battleScheduler 에서 simulate 직전 호출.
 * hijack 은 skip (사용자 manual control).
 *
 * @param {number} battleId
 * @param {string} battleType
 */
async function applyAIStrategy(battleId, battleType) {
  if (battleType === 'hijack') return { skipped: 'hijack_manual' };

  const enabled = String(await getSetting('ai_strategy_enabled', 'true')).toLowerCase();
  if (enabled !== 'true' && enabled !== '1') return { skipped: 'disabled' };

  // 양쪽 참가자 + 각 fleet 의 owner_wallet + faction 조회 (side 별 첫 wallet)
  const { rows } = await pool.query(`
    SELECT DISTINCT ON (p.side)
      p.side, p.wallet_address,
      COALESCE(u.faction_code, 'mcc') AS faction
    FROM fleet_battle_participants p
    LEFT JOIN users u ON u.wallet_address = p.wallet_address
    WHERE p.battle_id = $1
    ORDER BY p.side, p.joined_at, p.fleet_id
  `, [battleId]);

  if (!rows.length) return { skipped: 'no_participants' };

  const applied = [];
  for (const r of rows) {
    if (!r.wallet_address) continue;
    const formation = pickFormation(r.faction);
    const maneuver = pickManeuver(r.faction);
    try {
      // formation_change INSERT (또는 UPDATE 시 ON CONFLICT)
      await pool.query(
        `INSERT INTO commander_actions (battle_id, wallet_address, side, action_type, params, applied_at_tick, gp_cost)
         VALUES ($1, $2, $3, 'formation_change', $4, 0, 0)
         ON CONFLICT DO NOTHING`,
        [battleId, r.wallet_address, r.side, JSON.stringify({ formation })]
      );
      await pool.query(
        `INSERT INTO commander_actions (battle_id, wallet_address, side, action_type, params, applied_at_tick, gp_cost)
         VALUES ($1, $2, $3, 'maneuver_change', $4, 0, 0)
         ON CONFLICT DO NOTHING`,
        [battleId, r.wallet_address, r.side, JSON.stringify({ maneuver })]
      );
      applied.push({ side: r.side, faction: r.faction, formation, maneuver });
    } catch (e) {
      console.warn(`[aiStrategy] battle ${battleId} side ${r.side} failed:`, e.message);
    }
  }

  return { battleId, applied };
}

module.exports = { applyAIStrategy, pickFormation, pickManeuver };
