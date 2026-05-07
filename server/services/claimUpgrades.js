'use strict';
/**
 * Territory Upgrade Service — Migration 112
 * Players permanently burn GP to upgrade their territories (mine_booster, fortress, beacon, vault).
 * Upgrades are destroyed when territory is hijacked.
 */

const { pool } = require('../db');

let logGPActivity;
try { logGPActivity = require('../db').logGPActivity; } catch (_) {}
let notifyPlayer;
try { notifyPlayer = require('../db').notifyPlayer; } catch (_) {}

// ── Upgrade type definitions ─────────────────────────────────────────────────

const UPGRADE_TYPES = {
  mine_booster: {
    icon: '⛏️', name: 'Mine Booster',
    desc: 'Increases PP yield per mining cycle',
    costKey: 'upgrade_mine_booster_costs',
    bonusKey: 'upgrade_mine_booster_bonus',
    bonusUnit: '% PP',
    color: '#4cd89a',
  },
  fortress: {
    icon: '🏰', name: 'Fortress Wall',
    desc: 'Increases defense roll against hijack attempts',
    costKey: 'upgrade_fortress_costs',
    bonusKey: 'upgrade_fortress_bonus',
    bonusUnit: '% defense',
    color: '#e85050',
  },
  beacon: {
    icon: '📡', name: 'Signal Beacon',
    desc: 'Boosts GP earned from battles and POI events here',
    costKey: 'upgrade_beacon_costs',
    bonusKey: 'upgrade_beacon_bonus',
    bonusUnit: '% GP',
    color: '#5cbbff',
  },
  vault: {
    icon: '🗄️', name: 'Resource Vault',
    desc: 'Expands PP storage capacity for this territory',
    costKey: 'upgrade_vault_costs',
    bonusKey: 'upgrade_vault_bonus',
    bonusUnit: '% storage',
    color: '#e8c040',
  },
  // ── P5 Territory Utility tracks ──────────────────────────────────────────────
  extractor: {
    icon: '⚙️', name: '채굴기',
    nameEn: 'Extractor',
    desc: '재료 드롭 수량·확률 증가. 조선소 재료 수급 핵심.',
    costKey: 'upgrade_extractor_costs',
    bonusKey: 'upgrade_extractor_bonus',
    matCostKey: 'upgrade_extractor_mat_costs',
    bonusUnit: '% 재료 드롭',
    color: '#64dc82',
    effect: 'material_drop',  // used by production endpoint
  },
  refinery: {
    icon: '🔩', name: '정제소',
    nameEn: 'Refinery',
    desc: '고급 재료 획득 확률 증가. 상위 등급 재료로 변환 가능.',
    costKey: 'upgrade_refinery_costs',
    bonusKey: 'upgrade_refinery_bonus',
    matCostKey: 'upgrade_refinery_mat_costs',
    bonusUnit: '% 고급 재료 확률',
    color: '#ffc140',
    effect: 'advanced_material',
  },
  shield_grid: {
    icon: '🛡️', name: '실드 그리드',
    nameEn: 'Shield Grid',
    desc: '하이잭 방어력 강화. 실드 지속 시간 증가.',
    costKey: 'upgrade_shield_grid_costs',
    bonusKey: 'upgrade_shield_grid_bonus',
    matCostKey: 'upgrade_shield_grid_mat_costs',
    bonusUnit: '% 방어력',
    color: '#5cbbff',
    effect: 'defense',
  },
  relay_tower: {
    icon: '📡', name: '중계 타워',
    nameEn: 'Relay Tower',
    desc: '섹터 가시성·경보·캠페인 목표 지원 범위 확장.',
    costKey: 'upgrade_relay_tower_costs',
    bonusKey: 'upgrade_relay_tower_bonus',
    matCostKey: 'upgrade_relay_tower_mat_costs',
    bonusUnit: '타일 가시 반경',
    color: '#bb86fc',
    effect: 'visibility',
  },
  art_beacon: {
    icon: '🎨', name: '아트 비콘',
    nameEn: 'Art Beacon',
    desc: '이미지 노출·브랜딩 강화. 소량 PP 보너스.',
    costKey: 'upgrade_art_beacon_costs',
    bonusKey: 'upgrade_art_beacon_bonus',
    matCostKey: 'upgrade_art_beacon_mat_costs',
    bonusUnit: '% PP',
    color: '#ff6b6b',
    effect: 'pp_bonus',
  },
};

// ── Settings ──────────────────────────────────────────────────────────────────

async function getSettings() {
  // Load all upgrade-related settings dynamically
  const res = await pool.query(`SELECT key, value FROM settings WHERE key LIKE 'upgrade_%'`);
  const map = {};
  res.rows.forEach(r => { map[r.key] = r.value; });

  const parseCosts = (str, def) =>
    (str || def || '').split(',').map(v => parseFloat(v.trim())).filter(n => !isNaN(n));

  return {
    enabled:          (map.upgrade_enabled || 'true') !== 'false',
    p5Enabled:        (map.upgrade_p5_enabled || 'true') !== 'false',
    maxPerClaim:      parseInt(map.upgrade_max_per_claim) || 4,
    maxLevel:         parseInt(map.upgrade_max_level)     || 5,
    p5MaxLevel:       parseInt(map.upgrade_p5_max_level)  || 5,
    destroyOnHijack:  (map.upgrade_destroy_on_hijack || 'true') !== 'false',
    costs: {
      mine_booster: parseCosts(map.upgrade_mine_booster_costs, '100,250,500,1000,2500'),
      fortress:     parseCosts(map.upgrade_fortress_costs,     '150,350,750,1500,3500'),
      beacon:       parseCosts(map.upgrade_beacon_costs,       '80,200,450,900,2200'),
      vault:        parseCosts(map.upgrade_vault_costs,        '120,300,650,1300,3000'),
      // P5 tracks
      extractor:    parseCosts(map.upgrade_extractor_costs,    '50,150,350,800,2000'),
      refinery:     parseCosts(map.upgrade_refinery_costs,     '80,200,500,1200,3000'),
      shield_grid:  parseCosts(map.upgrade_shield_grid_costs,  '120,300,700,1600,4000'),
      relay_tower:  parseCosts(map.upgrade_relay_tower_costs,  '60,160,380,900,2200'),
      art_beacon:   parseCosts(map.upgrade_art_beacon_costs,   '40,100,250,600,1500'),
    },
    bonuses: {
      mine_booster: parseCosts(map.upgrade_mine_booster_bonus, '20,40,60,80,100'),
      fortress:     parseCosts(map.upgrade_fortress_bonus,     '15,30,50,70,90'),
      beacon:       parseCosts(map.upgrade_beacon_bonus,       '10,20,35,50,75'),
      vault:        parseCosts(map.upgrade_vault_bonus,        '25,50,75,100,150'),
      // P5 tracks
      extractor:    parseCosts(map.upgrade_extractor_bonus,    '15,30,50,75,100'),
      refinery:     parseCosts(map.upgrade_refinery_bonus,     '5,12,22,35,50'),
      shield_grid:  parseCosts(map.upgrade_shield_grid_bonus,  '10,22,38,55,75'),
      relay_tower:  parseCosts(map.upgrade_relay_tower_bonus,  '1,2,3,4,5'),
      art_beacon:   parseCosts(map.upgrade_art_beacon_bonus,   '3,6,10,15,20'),
    },
  };
}

// ── Public: get upgrade catalog with costs + bonuses ─────────────────────────

async function getUpgradeCatalog() {
  const cfg = await getSettings();
  return Object.entries(UPGRADE_TYPES).map(([key, def]) => ({
    key,
    icon: def.icon,
    name: def.name || def.nameEn || key,
    nameEn: def.nameEn || def.name || key,
    desc: def.desc,
    bonusUnit: def.bonusUnit,
    color: def.color,
    effect: def.effect || null,
    isP5: !!def.effect,  // P5 tracks have 'effect' field
    levels: (cfg.costs[key] || []).map((cost, i) => ({
      level: i + 1,
      cost,
      bonus: (cfg.bonuses[key] || [])[i] || 0,
    })),
    maxLevel: cfg.maxLevel,
  }));
}

// ── Get upgrades for a specific claim ────────────────────────────────────────

async function getClaimUpgrades(claimId) {
  const res = await pool.query(
    `SELECT * FROM territory_upgrades WHERE claim_id = $1 AND is_active = true ORDER BY upgrade_type`,
    [claimId]
  );
  return res.rows;
}

// ── Get all upgrades for a wallet ────────────────────────────────────────────

async function getMyUpgrades(wallet) {
  const w = wallet.toLowerCase();
  const res = await pool.query(
    `SELECT u.*, c.center_lng AS sector_x, c.center_lat AS sector_y, c.width, c.height, c.custom_name,
            (c.deleted_at IS NOT NULL) AS territory_lost
       FROM territory_upgrades u
       LEFT JOIN claims c ON c.id = u.claim_id
      WHERE u.owner = $1
      ORDER BY u.claim_id, u.upgrade_type`,
    [w]
  );
  return res.rows;
}

// ── Get bonus value (for use by other services) ───────────────────────────────

async function getUpgradeBonus(claimId, upgradeType) {
  const cfg = await getSettings();
  const res = await pool.query(
    `SELECT level FROM territory_upgrades WHERE claim_id = $1 AND upgrade_type = $2 AND is_active = true LIMIT 1`,
    [claimId, upgradeType]
  );
  if (!res.rows.length) return 0;
  const lvl = res.rows[0].level;
  const bonuses = cfg.bonuses[upgradeType] || [];
  return bonuses[lvl - 1] || 0;
}

// ── Upgrade territory ─────────────────────────────────────────────────────────

async function upgradeTerritory(client, wallet, claimId, upgradeType) {
  const w = wallet.toLowerCase();
  const cfg = await getSettings();

  if (!cfg.enabled) throw new Error('Territory upgrade system is currently disabled');
  if (!UPGRADE_TYPES[upgradeType]) throw new Error(`Unknown upgrade type: ${upgradeType}`);

  // Verify ownership — FOR UPDATE to prevent concurrent over-limit inserts on same claim
  const claimRes = await client.query(
    `SELECT id, owner FROM claims WHERE id = $1 AND deleted_at IS NULL FOR UPDATE`,
    [claimId]
  );
  if (!claimRes.rows.length) throw new Error('Territory not found');
  if (claimRes.rows[0].owner.toLowerCase() !== w) throw new Error('You do not own this territory');

  // Get existing upgrade (if any) for this type on this claim
  const existingRes = await client.query(
    `SELECT id, level, gp_spent FROM territory_upgrades
      WHERE claim_id = $1 AND upgrade_type = $2 AND is_active = true FOR UPDATE`,
    [claimId, upgradeType]
  );
  const existing = existingRes.rows[0] || null;
  const currentLevel = existing ? existing.level : 0;
  const nextLevel    = currentLevel + 1;

  if (nextLevel > cfg.maxLevel) throw new Error(`Already at maximum level ${cfg.maxLevel}`);

  const costs = cfg.costs[upgradeType] || [];
  const cost  = costs[currentLevel]; // index = current level (0-based → level 1 cost is costs[0])
  if (!cost || cost <= 0) throw new Error(`No cost configured for ${upgradeType} level ${nextLevel}`);

  // Check wallet balance
  const userRes = await client.query(
    `SELECT gp_balance FROM users WHERE wallet_address = $1 FOR UPDATE`, [w]
  );
  if (!userRes.rows.length) throw new Error('User not found');
  const balance = parseFloat(userRes.rows[0].gp_balance) || 0;
  if (balance < cost) throw new Error(`Insufficient GP: need ${cost}, have ${balance.toFixed(2)}`);

  // Deduct GP
  await client.query(`UPDATE users SET gp_balance = gp_balance - $2 WHERE LOWER(wallet_address) = LOWER($1) AND gp_balance >= $2`, [w, cost]);

  // Upsert upgrade
  let upgradeId;
  if (existing) {
    await client.query(
      `UPDATE territory_upgrades
          SET level = $3, gp_spent = gp_spent + $4, upgraded_at = NOW()
        WHERE id = $1`,
      [existing.id, w, nextLevel, cost]
    );
    upgradeId = existing.id;
  } else {
    // Check per-claim limit (count distinct upgrade types, not levels)
    const countRes = await client.query(
      `SELECT COUNT(*) AS n FROM territory_upgrades WHERE claim_id = $1 AND is_active = true`,
      [claimId]
    );
    if (parseInt(countRes.rows[0]?.n) >= cfg.maxPerClaim) {
      throw new Error(`Territory already has ${cfg.maxPerClaim} upgrades (maximum)`);
    }
    const ins = await client.query(
      `INSERT INTO territory_upgrades (claim_id, owner, upgrade_type, level, gp_spent)
       VALUES ($1, $2, $3, 1, $4) RETURNING id`,
      [claimId, w, upgradeType, cost]
    );
    upgradeId = ins.rows[0].id;
  }

  const bonuses = cfg.bonuses[upgradeType] || [];
  const bonus = bonuses[nextLevel - 1] || 0;
  return { upgradeId, upgradeType, level: nextLevel, cost, bonus };
}

// ── Destroy upgrades on hijack ────────────────────────────────────────────────

/**
 * Destroys all active upgrades on a claim when it's hijacked.
 * @returns {object[]} destroyed upgrades (for notifications)
 */
async function destroyClaimUpgrades(client, claimId) {
  const res = await client.query(
    `UPDATE territory_upgrades
        SET is_active = false, destroyed_at = NOW()
      WHERE claim_id = $1 AND is_active = true
      RETURNING *`,
    [claimId]
  );

  // Notify original owners (group by owner)
  const owners = {};
  res.rows.forEach(u => {
    if (!owners[u.owner]) owners[u.owner] = [];
    owners[u.owner].push(UPGRADE_TYPES[u.upgrade_type]?.name || u.upgrade_type);
  });
  for (const [owner, names] of Object.entries(owners)) {
    if (notifyPlayer) {
      notifyPlayer(owner,
        `🏴 Territory upgrades lost: ${names.join(', ')} were destroyed when your territory was taken!`,
        'upgrade'
      ).catch(() => {});
    }
  }

  return res.rows;
}

// ── Admin stats ───────────────────────────────────────────────────────────────

async function getAdminStats() {
  const [totalsRes, byTypeRes, recentRes, settingsRes] = await Promise.all([
    pool.query(`
      SELECT COUNT(*)                                    AS total,
             COUNT(*) FILTER (WHERE is_active)          AS active,
             COALESCE(SUM(gp_spent), 0)                 AS total_gp,
             COUNT(*) FILTER (WHERE destroyed_at IS NOT NULL) AS destroyed
        FROM territory_upgrades
    `).catch(() => ({ rows: [{}] })),
    pool.query(`
      SELECT upgrade_type,
             COUNT(*) FILTER (WHERE is_active) AS active_count,
             AVG(level) FILTER (WHERE is_active) AS avg_level,
             COALESCE(SUM(gp_spent) FILTER (WHERE is_active), 0) AS type_gp
        FROM territory_upgrades
       GROUP BY upgrade_type
       ORDER BY upgrade_type
    `).catch(() => ({ rows: [] })),
    pool.query(`
      SELECT u.*, usr.nickname AS owner_nick
        FROM territory_upgrades u
        LEFT JOIN users usr ON usr.wallet_address = u.owner
       ORDER BY u.upgraded_at DESC LIMIT 30
    `).catch(() => ({ rows: [] })),
    pool.query(`SELECT key, value FROM settings WHERE key LIKE 'upgrade_%' ORDER BY key`).catch(() => ({ rows: [] })),
  ]);

  const t = totalsRes.rows[0] || {};
  const settingsMap = {};
  settingsRes.rows.forEach(r => { settingsMap[r.key] = r.value; });

  return {
    total:     parseInt(t.total)     || 0,
    active:    parseInt(t.active)    || 0,
    total_gp:  parseFloat(t.total_gp)|| 0,
    destroyed: parseInt(t.destroyed) || 0,
    by_type:   byTypeRes.rows,
    recent:    recentRes.rows,
    settings:  settingsMap,
  };
}

module.exports = {
  upgradeTerritory,
  destroyClaimUpgrades,
  getClaimUpgrades,
  getMyUpgrades,
  getUpgradeCatalog,
  getUpgradeBonus,
  getAdminStats,
  UPGRADE_TYPES,
};
