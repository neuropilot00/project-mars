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
      pool.query(`
        SELECT code, name_en, name_ko, name_ja, name_zh,
               description_en, description_ko,
               color_primary, color_dark, color_bright,
               visual_style, icon_emoji,
               specialty_en, specialty_ko, naming_scheme
          FROM factions
         WHERE is_active = true
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
router.get('/fleet-presets', async (_req, res) => {
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
