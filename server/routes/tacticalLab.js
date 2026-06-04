// server/routes/tacticalLab.js
// ═══════════════════════════════════════════════════════════════
// Tactical Lab Public Catalog API (no auth)
// Serves real ship_types / resources / factions data to the
// iframe simulator so v11.1 uses our actual game catalog.
//
// GET /api/tactical-lab/catalog       — ships + minerals + factions
// GET /api/tactical-lab/fleet-presets — canonical demo fleet compositions
// ═══════════════════════════════════════════════════════════════

const express = require('express');
const router = express.Router();
const { pool } = require('../db');

/**
 * GET /api/tactical-lab/catalog
 * Returns the full static catalog (ships, minerals, factions) used
 * by the tactical lab simulator. Public — no auth required.
 */
router.get('/catalog', async (_req, res) => {
  try {
    const [shipsR, resR, facR] = await Promise.all([
      pool.query(`
        SELECT code, faction_code, size_class, role, tier,
               name_en, name_ko, name_ja, name_zh, class_label,
               description_en, description_ko,
               base_hp, base_atk, base_def, base_speed,
               fire_interval, fire_type, shots, render_radius,
               build_time_seconds, build_gp_cost, recipe_minerals,
               is_capital, is_flagship_capable, max_per_server, max_per_player
          FROM ship_types
         WHERE is_active = true
         ORDER BY faction_code, sort_order, code
      `),
      pool.query(`
        SELECT code, name_en, name_ko, name_ja, name_zh,
               tier, rarity, icon_emoji, color_hex,
               description_en, description_ko, is_craftable, craft_recipe
          FROM resources
         WHERE is_active = true
         ORDER BY tier, code
      `),
      // [v7.405] is_active 필터 제거 — pilgrim(Pilgrim Arms, is_active=false) 등 NPC 파벌도
      //   시뮬레이터 렌더 색을 알아야 함선이 고유색으로 그려진다. 이 쿼리는 색/이름 표시 전용이라
      //   inactive 파벌을 포함해도 안전(플레이어 선택 검증은 faction.js 의 is_active 게이트가 별도로 막음).
      pool.query(`
        SELECT code, name_en, name_ko, name_ja, name_zh,
               description_en, description_ko,
               color_primary, color_dark, color_bright,
               visual_style, icon_emoji,
               specialty_en, specialty_ko, naming_scheme
          FROM factions
         ORDER BY sort_order, code
      `),
    ]);

    // Format build_time_seconds into human "Xh Ym" label for UI display
    const ships = shipsR.rows.map(s => {
      const sec = s.build_time_seconds || 0;
      let buildTimeLabel;
      if (sec >= 3600) {
        const h = Math.floor(sec / 3600);
        const m = Math.round((sec % 3600) / 60);
        buildTimeLabel = m > 0 ? `${h}h ${m}m` : `${h}h`;
      } else if (sec >= 60) {
        buildTimeLabel = `${Math.round(sec / 60)}m`;
      } else {
        buildTimeLabel = `${sec}s`;
      }
      return { ...s, build_time_label: buildTimeLabel };
    });

    res.json({
      ships,
      resources: resR.rows,
      factions: facR.rows,
      counts: {
        ships: ships.length,
        resources: resR.rows.length,
        factions: facR.rows.length,
      },
    });
  } catch (err) {
    console.error('[tactical-lab] catalog error:', err.message);
    res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

/**
 * GET /api/tactical-lab/fleet-presets
 * Canonical demo fleet compositions for the simulator.
 * These are sandbox/preview compositions — not tied to any real player.
 * Uses real ship codes that exist in ship_types so the simulator renders
 * authentic silhouettes.
 */
router.get('/fleet-presets', async (req, res) => {
  try {
    // Verify which ship codes actually exist so presets never reference dead codes
    const { rows } = await pool.query(
      `SELECT code FROM ship_types WHERE is_active = true`
    );
    const valid = new Set(rows.map(r => r.code));

    const filter = obj => {
      const out = {};
      for (const [k, v] of Object.entries(obj)) if (valid.has(k)) out[k] = v;
      return out;
    };

    // ── battleId 쿼리 분기: 실제 hijack/fleet_battle 의 attacker/defender 함대 구성 반환 ──
    // tactical-lab v11 가 ?bid=N 으로 호출하면 그 battle 의 진짜 함대를 시뮬에 사용.
    const battleId = parseInt(req.query.bid || req.query.battleId);
    if (battleId && battleId > 0) {
      try {
        const partRes = await pool.query(`
          SELECT fbp.fleet_id, fbp.side, f.name AS fleet_name, f.owner_wallet,
                 COALESCE(u.nickname, LEFT(f.owner_wallet,6)) AS nick,
                 u.faction_code AS owner_faction
          FROM fleet_battle_participants fbp
          JOIN fleets f ON f.id = fbp.fleet_id
          LEFT JOIN users u ON u.wallet_address = f.owner_wallet
          WHERE fbp.battle_id = $1
        `, [battleId]);

        const partsBySide = { atk: [], def: [] };
        for (const p of partRes.rows) {
          const shipsRes = await pool.query(
            `SELECT ship_type_code, COUNT(*)::int AS cnt,
                    SUM(CASE WHEN is_flagship THEN 1 ELSE 0 END)::int AS flagship_cnt,
                    (ARRAY_AGG(ship_type_code) FILTER (WHERE is_flagship))[1] AS flagship_code
             FROM ships
             WHERE fleet_id = $1
             GROUP BY ship_type_code`,
            [p.fleet_id]
          );
          const escort = {};
          let flagship = null;
          for (const s of shipsRes.rows) {
            if (!valid.has(s.ship_type_code)) continue;
            if (s.flagship_code === s.ship_type_code && !flagship) {
              flagship = s.ship_type_code;
              const remaining = s.cnt - 1;
              if (remaining > 0) escort[s.ship_type_code] = remaining;
            } else {
              escort[s.ship_type_code] = (escort[s.ship_type_code] || 0) + s.cnt;
            }
          }
          if (!flagship) {
            // 기함 없으면 첫 함선을 기함으로
            const firstCode = Object.keys(escort)[0];
            if (firstCode) {
              flagship = firstCode;
              if (escort[firstCode] > 1) escort[firstCode] -= 1;
              else delete escort[firstCode];
            }
          }
          if (flagship) {
            partsBySide[p.side === 'atk' ? 'atk' : 'def'].push({
              id: p.nick || ('Fleet#' + p.fleet_id),
              tag: (p.owner_faction || flagship.split('_')[0] || 'mcc').toUpperCase(),
              flagship,
              escort,
              dbFleetId: p.fleet_id,           // ws frame.fleets[].id 매칭용 (Phase 2-C)
              // [v7.61] 전체 wallet 주소 노출 방지 — 공개 비인증 엔드포인트이므로 마스킹
              ownerWallet: p.owner_wallet ? p.owner_wallet.slice(0, 6) + '...' + p.owner_wallet.slice(-4) : null,
            });
          }
        }
        if (partsBySide.atk.length || partsBySide.def.length) {
          return res.json({ atk: partsBySide.atk, def: partsBySide.def, source: 'battle:' + battleId });
        }
      } catch (battleErr) {
        console.warn('[tactical-lab] battleId fetch failed, falling back to demo:', battleErr.message);
      }
    }

    const atk = [
      { id: 'KimWarrior',  tag: 'MCC', flagship: 'mcc_titan', escort: filter({ mcc_bs:2, mcc_snp:3, mcc_crs:5, mcc_dst:10, mcc_ewar:3, mcc_frg:18, mcc_int:35 }) },
      { id: 'RebelKing',   tag: 'MCC', flagship: 'mcc_bs',    escort: filter({ mcc_crs:3, mcc_snp:2, mcc_dst:8, mcc_ewar:2, mcc_frg:14, mcc_int:28 }) },
      { id: 'NovaStrike',  tag: 'FSP', flagship: 'fsp_bs',    escort: filter({ fsp_logi_crs:2, fsp_crs:4, fsp_dst:8, fsp_logi:5, fsp_int:20 }) },
      { id: 'DarkPilot',   tag: 'MCC', flagship: 'mcc_crs',   escort: filter({ mcc_dst:3, mcc_frg:8, mcc_ewar:2, mcc_int:16 }) },
      { id: 'SpeedDemon',  tag: 'FSP', flagship: 'fsp_dst',   escort: filter({ fsp_logi:2, fsp_int:12 }) },
    ].filter(f => valid.has(f.flagship));

    const def = [
      { id: 'FSP_Guard',   tag: 'FSP', flagship: 'fsp_titan', escort: filter({ fsp_bs:2, fsp_logi_crs:3, fsp_crs:6, fsp_dst:12, fsp_logi:6, fsp_int:32 }) },
      { id: 'IronWall',    tag: 'CV',  flagship: 'cv_bs',     escort: filter({ cv_crs:4, cv_dst:8, cv_bomb:3, cv_frg:14, cv_int:28 }) },
      { id: 'VoidHunter',  tag: 'CV',  flagship: 'cv_titan',  escort: filter({ cv_bs:1, cv_crs:3, cv_dst:6, cv_bomb:4, cv_frg:12, cv_int:24 }) },
      { id: 'StealthOps',  tag: 'CV',  flagship: 'cv_dst',    escort: filter({ cv_bomb:2, cv_frg:6, cv_int:14 }) },
      { id: 'QuickStrike', tag: 'FSP', flagship: 'fsp_int',   escort: filter({ fsp_logi:1, fsp_int:10 }) },
    ].filter(f => valid.has(f.flagship));

    res.json({ atk, def });
  } catch (err) {
    console.error('[tactical-lab] fleet-presets error:', err.message);
    res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

module.exports = router;
