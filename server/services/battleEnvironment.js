'use strict';

const BATTLEFIELD_KEYS = [
  'orbit_territory', 'garrison', 'mining_site', 'canyon_outpost', 'polar_ice',
  'lava_tube', 'crater_relay', 'refinery_yard', 'colony_dome',
  'excavation_grid', 'dust_storm', 'occupied_airspace', 'shipyard_drydock',
  'convoy_route', 'ancient_ruins'
];

const BATTLEFIELD_LABELS = {
  orbit_territory: 'Orbit Territory',
  garrison: 'Garrison Airspace',
  mining_site: 'Mining Site',
  canyon_outpost: 'Canyon Outpost',
  polar_ice: 'Polar Ice Field',
  lava_tube: 'Lava Tube',
  crater_relay: 'Crater Relay',
  refinery_yard: 'Refinery Yard',
  colony_dome: 'Colony Dome',
  excavation_grid: 'Excavation Grid',
  dust_storm: 'Dust Storm',
  occupied_airspace: 'Occupied Airspace',
  shipyard_drydock: 'Shipyard Drydock',
  convoy_route: 'Convoy Route',
  ancient_ruins: 'Ancient Ruins'
};

const SECTOR_BATTLEFIELD_BY_CODE = {
  olympus_crown: 'garrison',
  tharsis_citadel: 'garrison',
  pavonis_gate: 'orbit_territory',
  ascraeus_vault: 'refinery_yard',
  arsia_forge: 'lava_tube',
  noctis_prime: 'canyon_outpost',
  marineris_east: 'canyon_outpost',
  marineris_west: 'canyon_outpost',
  candor_fields: 'excavation_grid',
  ophir_station: 'shipyard_drydock',
  hebes_crossing: 'colony_dome',
  coprates_ridge: 'canyon_outpost',
  eos_plateau: 'crater_relay',
  melas_basin: 'canyon_outpost',
  tithonium_scars: 'crater_relay',
  syria_planum: 'excavation_grid',
  hellas_abyss: 'crater_relay',
  elysium_wastes: 'dust_storm',
  utopia_flats: 'colony_dome',
  arcadia_ridge: 'dust_storm',
  cerberus_scars: 'lava_tube',
  phlegra_deep: 'polar_ice',
  amazonis_sink: 'excavation_grid',
  borealis_edge: 'polar_ice'
};

const FIELD_TAGS = {
  orbit_territory: ['orbital', 'territory'],
  garrison: ['defended', 'airspace'],
  mining_site: ['mining', 'open-ground'],
  canyon_outpost: ['ambush', 'terrain'],
  polar_ice: ['ice', 'low-visibility'],
  lava_tube: ['volcanic', 'hazard'],
  crater_relay: ['relay', 'crater'],
  refinery_yard: ['industrial', 'resource'],
  colony_dome: ['colony', 'civilian-risk'],
  excavation_grid: ['excavation', 'resource'],
  dust_storm: ['storm', 'low-visibility'],
  occupied_airspace: ['occupation', 'contested'],
  shipyard_drydock: ['shipyard', 'close-range'],
  convoy_route: ['logistics', 'interdiction'],
  ancient_ruins: ['relic', 'unknown']
};

function stableIndex(seed) {
  seed = String(seed || '');
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0;
  return Math.abs(hash) % BATTLEFIELD_KEYS.length;
}

function normalizeSummary(summary) {
  if (!summary) return {};
  if (typeof summary === 'object') return summary;
  try { return JSON.parse(summary); } catch (_) { return {}; }
}

function pickBattlefieldKey(battle) {
  const b = battle || {};
  const summary = normalizeSummary(b.battle_summary);
  const type = String(b.battle_type || '').toLowerCase();
  const sectorCode = String(b.sector_code || summary.sector_code || '').toLowerCase();
  const sectorName = String(b.sector_name || '').toLowerCase();

  if (type === 'siege' && SECTOR_BATTLEFIELD_BY_CODE[sectorCode]) return SECTOR_BATTLEFIELD_BY_CODE[sectorCode];
  if (type === 'siege') return 'occupied_airspace';
  if (type === 'hijack') return 'occupied_airspace';
  if (SECTOR_BATTLEFIELD_BY_CODE[sectorCode]) return SECTOR_BATTLEFIELD_BY_CODE[sectorCode];
  if (type === 'pvp_duel') return 'shipyard_drydock';
  if (type === 'raid') return 'mining_site';
  if (type === 'event') return 'ancient_ruins';
  if (type === 'world_event') return 'convoy_route';
  if (/ice|polar|borealis|phlegra|빙|얼음/.test(sectorName)) return 'polar_ice';
  if (/forge|arsia|lava|volcan|용암|화산|대장간/.test(sectorName)) return 'lava_tube';
  if (/storm|dust|waste|arcadia|elysium|폭풍|먼지|황무지/.test(sectorName)) return 'dust_storm';
  if (/colony|dome|station|crossing|utopia|주둔|식민|돔|기지/.test(sectorName)) return 'colony_dome';
  if (/shipyard|drydock|dock|yard|조선|도크|정박/.test(sectorName)) return 'shipyard_drydock';
  if (/convoy|route|road|supply|수송|보급|항로/.test(sectorName)) return 'convoy_route';
  if (/ruin|ancient|relic|artifact|유적|고대|유물/.test(sectorName)) return 'ancient_ruins';
  if (/excavat|mine|field|sink|candor|syria|amazonis|채굴|굴착|광산|함몰/.test(sectorName)) return 'excavation_grid';
  if (/crater|abyss|hellas|scar|relay|분화구|심연|상흔/.test(sectorName)) return 'crater_relay';
  if (/canyon|marineris|noctis|ridge|basin|협곡|능선|분지/.test(sectorName)) return 'canyon_outpost';
  if (/plain|flat|평원|평지/.test(sectorName)) return 'mining_site';
  if (sectorCode) {
    const match = sectorCode.match(/\d+/);
    if (match) return BATTLEFIELD_KEYS[parseInt(match[0], 10) % BATTLEFIELD_KEYS.length];
    return BATTLEFIELD_KEYS[stableIndex(sectorCode)];
  }
  return BATTLEFIELD_KEYS[stableIndex(b.id)];
}

function decorateBattle(row) {
  if (!row || typeof row !== 'object') return row;
  const battlefieldKey = row.battlefield_key || pickBattlefieldKey(row);
  return Object.assign({}, row, {
    battlefield_key: battlefieldKey,
    battlefield_label: BATTLEFIELD_LABELS[battlefieldKey] || battlefieldKey,
    environment_tags: FIELD_TAGS[battlefieldKey] || []
  });
}

function decorateBattles(rows) {
  return (rows || []).map(decorateBattle);
}

module.exports = {
  BATTLEFIELD_KEYS,
  BATTLEFIELD_LABELS,
  pickBattlefieldKey,
  decorateBattle,
  decorateBattles
};
