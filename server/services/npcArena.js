// server/services/npcArena.js
// ═══════════════════════════════════════════════════════════════
// NPC Arena — NPC끼리 다투기 (인파이팅) + 초반 밀도 유지
//
// 목적: 실유저 유입 시 세계가 살아있어 보이게(유령도시 방지).
//   - runArenaTick(): 살아있는 NPC 함대 2개를 골라 NPC vs NPC 전투 1건 생성/시뮬.
//   - ensureNpcDensity(): 활성 NPC 함대 수가 설정 최소치 미만이면 aiFleetManager로 보충.
//
// 🔴 경제 보호 (반드시 준수):
//   NPC↔NPC 전투는 절대 통화/재료/보상을 발행하지 않는다.
//   battle_summary.is_ai_battle = true 로 표시해 battleRewards.distributeRewards()의
//   anti-mint 가드(v7.121)가 보상 mint 를 차단하게 한다.
//   battle_type 은 fleet_battles_battle_type_check 제약(siege/hijack/pvp_duel/raid/event)을
//   만족해야 하므로 'pvp_duel' 을 쓰되, summary.arena=true + is_ai_battle=true 로 마킹한다.
//
//   ⚠️ 스케줄러 등록은 반드시 index.js 의 if(_runSchedulers) 블록(leader 인스턴스)에서만.
// ═══════════════════════════════════════════════════════════════

const { pool } = require('../db');
const battleScheduler = require('./battleScheduler');
const aiFleetManager = require('./aiFleetManager');

// ─── 설정 로드 ───────────────────────────────────────────────
async function loadArenaSettings() {
  const defaults = {
    npc_arena_enabled: false,
    npc_arena_interval_sec: 120,
    npc_arena_max_concurrent: 2,
    npc_min_active_fleets: 8,
    battle_max_concurrent: 3, // 기존 전투 동시 cap (실유저 전투와 자원 경쟁 방지)
  };

  try {
    const { rows } = await pool.query(`
      SELECT key, value FROM settings
      WHERE key IN ('npc_arena_enabled', 'npc_arena_interval_sec',
                    'npc_arena_max_concurrent', 'npc_min_active_fleets',
                    'battle_max_concurrent')
    `);
    for (const row of rows) {
      const raw = row.value;
      if (raw === true || raw === 'true' || raw === '"true"') { defaults[row.key] = true; continue; }
      if (raw === false || raw === 'false' || raw === '"false"') { defaults[row.key] = false; continue; }
      const n = parseInt(String(raw).replace(/^"|"$/g, ''), 10);
      if (!isNaN(n)) defaults[row.key] = n;
    }
  } catch (err) {
    console.warn('[npcArena] loadArenaSettings error:', err.message);
  }
  return defaults;
}

// 현재 진행 중(preparing/active)인 전투 수 — 실유저 전투 포함 전체 부하 기준
async function countLiveBattles() {
  const { rows } = await pool.query(`
    SELECT COUNT(*)::int AS n FROM fleet_battles WHERE status IN ('preparing', 'active')
  `);
  return rows[0] ? rows[0].n : 0;
}

// 현재 진행 중인 arena(NPC vs NPC) 전투 수
async function countLiveArenaBattles() {
  const { rows } = await pool.query(`
    SELECT COUNT(*)::int AS n FROM fleet_battles
    WHERE status IN ('preparing', 'active')
      AND COALESCE((battle_summary->>'arena')::boolean, false) = true
  `);
  return rows[0] ? rows[0].n : 0;
}

// ─── 활성 NPC 함대 조회 (전투 가능: 살아있는 함선 보유 + 비전투 + 비매물) ───
async function listBattleReadyNpcFleets() {
  const { rows } = await pool.query(`
    SELECT f.id AS fleet_id, f.owner_wallet, u.faction_code,
           COUNT(s.id) FILTER (WHERE s.is_alive) AS ships_alive
    FROM fleets f
    JOIN users u ON LOWER(u.wallet_address) = LOWER(f.owner_wallet)
    LEFT JOIN ships s ON s.fleet_id = f.id
    WHERE u.is_ai = true
      AND f.is_in_battle = false
    GROUP BY f.id, f.owner_wallet, u.faction_code
    HAVING COUNT(s.id) FILTER (WHERE s.is_alive) > 0
  `);
  return rows.map(r => ({
    fleet_id: parseInt(r.fleet_id),
    owner_wallet: r.owner_wallet,
    faction_code: r.faction_code || null,
    ships_alive: parseInt(r.ships_alive) || 0,
  }));
}

// 활성(살아있는 함선 보유) NPC 함대 총수 — 밀도 판정용
async function countActiveNpcFleets() {
  const { rows } = await pool.query(`
    SELECT COUNT(*)::int AS n FROM (
      SELECT f.id
      FROM fleets f
      JOIN users u ON LOWER(u.wallet_address) = LOWER(f.owner_wallet)
      JOIN ships s ON s.fleet_id = f.id AND s.is_alive = true
      WHERE u.is_ai = true
      GROUP BY f.id
    ) q
  `);
  return rows[0] ? rows[0].n : 0;
}

// ─── 두 함대 매칭 (가능하면 다른 파벌) ───────────────────────
function pickPair(fleets) {
  if (fleets.length < 2) return null;
  // 첫 함대 랜덤 선택
  const a = fleets[Math.floor(Math.random() * fleets.length)];
  // 다른 파벌 후보 우선
  const otherFaction = fleets.filter(f =>
    f.fleet_id !== a.fleet_id &&
    (!a.faction_code || !f.faction_code || f.faction_code !== a.faction_code)
  );
  const sameOk = fleets.filter(f => f.fleet_id !== a.fleet_id);
  const poolB = otherFaction.length > 0 ? otherFaction : sameOk;
  if (poolB.length === 0) return null;
  const b = poolB[Math.floor(Math.random() * poolB.length)];
  return [a, b];
}

// ─── Arena tick: NPC vs NPC 전투 1건 생성/시뮬 ───────────────
async function runArenaTick() {
  const settings = await loadArenaSettings();
  if (!settings.npc_arena_enabled) {
    return { skipped: 'disabled' };
  }

  // arena 동시 진행 cap
  const liveArena = await countLiveArenaBattles();
  if (liveArena >= settings.npc_arena_max_concurrent) {
    return { skipped: 'arena_concurrent_cap', liveArena };
  }
  // 전체 전투 부하 cap (실유저 전투와 자원 경쟁 방지) — 여유가 없으면 양보
  const liveTotal = await countLiveBattles();
  if (liveTotal >= settings.battle_max_concurrent) {
    return { skipped: 'global_battle_cap', liveTotal };
  }

  const fleets = await listBattleReadyNpcFleets();
  const pair = pickPair(fleets);
  if (!pair) {
    return { skipped: 'no_pair', readyFleets: fleets.length };
  }
  const [atk, def] = pair;

  // 전투 생성 — battle_type='pvp_duel' (제약 만족), arena/is_ai_battle 마킹으로 보상 차단
  const summary = {
    arena: true,
    is_ai_battle: true,            // ← battleRewards anti-mint 가드 트리거
    npc_vs_npc: true,
    created_by: 'npc_arena',
  };

  let battleId = null;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // FOR UPDATE 로 두 함대 lock + 재확인 (TOCTOU 방지)
    const { rows: locked } = await client.query(
      `SELECT id, is_in_battle FROM fleets WHERE id = ANY($1::int[]) FOR UPDATE`,
      [[atk.fleet_id, def.fleet_id]]
    );
    // fleets.id 는 bigint → node-pg 가 문자열로 반환. Number() 로 양변 정규화 후 비교.
    const aLock = locked.find(f => Number(f.id) === atk.fleet_id);
    const bLock = locked.find(f => Number(f.id) === def.fleet_id);
    if (!aLock || aLock.is_in_battle || !bLock || bLock.is_in_battle) {
      await client.query('ROLLBACK');
      return { skipped: 'fleet_locked' };
    }

    try {
      const { rows: miningLocks } = await client.query(
        `SELECT fleet_id
           FROM ship_mining_jobs
          WHERE fleet_id = ANY($1::int[])
            AND status = 'mining'
          LIMIT 1`,
        [[atk.fleet_id, def.fleet_id]]
      );
      if (miningLocks.length) {
        await client.query('ROLLBACK');
        return { skipped: 'fleet_mining' };
      }
    } catch (e) {
      if (e.code !== '42P01') throw e;
    }

    const { rows: battleRows } = await client.query(`
      INSERT INTO fleet_battles (
        battle_type, status, phase,
        prepare_started_at, scheduled_start_at, battle_summary
      ) VALUES ('pvp_duel', 'preparing', 'main', NOW(), NOW(), $1::jsonb)
      RETURNING id
    `, [JSON.stringify(summary)]);
    battleId = battleRows[0].id;

    // is_in_battle + current_battle_id 를 함께 세팅한다. battleScheduler.runBattle 의
    // 시작부 충돌 체크가 (is_in_battle && current_battle_id != battleId) 를 conflict 로 보므로,
    // current_battle_id 를 비워두면 자기 전투가 'fleet_already_in_battle' 로 취소된다.
    await client.query(
      `UPDATE fleets SET is_in_battle = true, current_battle_id = $2 WHERE id = ANY($1::int[])`,
      [[atk.fleet_id, def.fleet_id], battleId]
    );

    await client.query(`
      INSERT INTO fleet_battle_participants (battle_id, fleet_id, wallet_address, side)
      VALUES ($1, $2, $3, 'atk'), ($1, $4, $5, 'def')
    `, [battleId, atk.fleet_id, atk.owner_wallet, def.fleet_id, def.owner_wallet]);

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[npcArena] create battle error:', err.message);
    return { error: err.message };
  } finally {
    client.release();
  }

  // 즉시 시뮬 실행 (battleScheduler 의 표준 파이프라인 재사용)
  battleScheduler.runBattle(battleId).catch(err => {
    console.error(`[npcArena] runBattle ${battleId} error:`, err.message);
  });

  // 라이브 피드 노출 (best-effort) — 유령도시 방지
  try {
    const ws = require('../wsServer');
    ws.broadcastFeed({
      type: 'arena_battle',
      battle_id: battleId,
      atk_faction: atk.faction_code,
      def_faction: def.faction_code,
    });
  } catch (_) {}

  console.log(`[npcArena] spawned NPC-vs-NPC battle ${battleId} (${atk.faction_code || '?'} #${atk.fleet_id} vs ${def.faction_code || '?'} #${def.fleet_id})`);
  return { spawned: true, battle_id: battleId, atk: atk.fleet_id, def: def.fleet_id };
}

// ─── 초반 밀도 유지: 활성 NPC 함대 보충 ──────────────────────
async function ensureNpcDensity() {
  const settings = await loadArenaSettings();
  if (!settings.npc_arena_enabled) {
    return { skipped: 'disabled' };
  }

  const active = await countActiveNpcFleets();
  if (active >= settings.npc_min_active_fleets) {
    return { ok: true, active, min: settings.npc_min_active_fleets };
  }

  // 부족분 보충 — aiFleetManager 재사용. ensureAiFleets() 가 없는 함대 생성 +
  // 전멸 함대 respawn 을 모두 처리하므로 그대로 호출한다.
  let created = 0;
  try {
    const r = await aiFleetManager.ensureAiFleets();
    created = (r && typeof r.created === 'number') ? r.created : 0;
  } catch (err) {
    console.warn('[npcArena] ensureNpcDensity ensureAiFleets error:', err.message);
  }

  const after = await countActiveNpcFleets();
  console.log(`[npcArena] density check: ${active} → ${after} active NPC fleets (min ${settings.npc_min_active_fleets}, created ${created})`);
  return { topped_up: true, before: active, after, created, min: settings.npc_min_active_fleets };
}

module.exports = {
  loadArenaSettings,
  runArenaTick,
  ensureNpcDensity,
  // 내부 헬퍼 (테스트용 export)
  listBattleReadyNpcFleets,
  countActiveNpcFleets,
  countLiveArenaBattles,
};
