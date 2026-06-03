// server/services/territoryVisual.js
// ═══════════════════════════════════════════════════════════════
// 영토 매매 비주얼 서비스 (Migration 091)
//
// calcPrice()          — 영토 가격 계산 (구매 전 미리보기)
// checkAdjacency()     — 인접 여부 확인
// calcAdjacencyBonus() — 클러스터 인접 보너스 계산
// updateAdjacencyBonuses() — 스케줄러: 전체 인접 보너스 갱신
// getTerritoryInfo()   — 영토 상세 정보 (가격 + 인접 보너스)
// ═══════════════════════════════════════════════════════════════

const { pool } = require('../db');

async function getSetting(key, fallback) {
  try {
    const { rows } = await pool.query(`SELECT value FROM settings WHERE key = $1`, [key]);
    return rows[0] ? String(rows[0].value) : fallback;
  } catch { return fallback; }
}
async function getFloat(key, fallback) { return parseFloat(await getSetting(key, fallback)) || fallback; }

// ─── 영토 가격 계산 ───

/**
 * 구매 예정 영토의 가격 계산
 * @param {string} ownerWallet - 구매자 (인접 보너스 체크용)
 * @param {number} pixelCount  - 구매할 픽셀 수
 * @param {object} bounds      - {x, y, width, height}
 * @param {string} sectorCode  - 섹터 코드
 */
async function calcPrice(ownerWallet, pixelCount, bounds, sectorCode) {
  const base     = await getFloat('land_base_price_pp', 0.08);
  const minSize  = parseInt(await getSetting('land_min_size', '25'));
  const maxSize  = parseInt(await getSetting('land_max_single_purchase', '10000'));

  if (pixelCount < minSize)  return { error: 'TOO_SMALL', min: minSize };
  if (pixelCount > maxSize)  return { error: 'TOO_LARGE', max: maxSize };

  // 섹터 배율
  let sectorMult = 1.0;
  let sectorType = 'frontier';
  if (sectorCode) {
    const { rows } = await pool.query(
      `SELECT sector_type, price_multiplier FROM sector_definitions WHERE code = $1`,
      [sectorCode]
    ).catch(() => ({ rows: [] }));
    if (rows[0]) {
      sectorMult = parseFloat(rows[0].price_multiplier) || 1.0;
      sectorType = rows[0].sector_type || 'frontier';
    } else {
      // sector_definitions 없으면 code 기반 추정
      if (sectorCode.includes('core') || sectorCode.includes('crown')) { sectorMult = 5.0; sectorType = 'core'; }
      else if (sectorCode.includes('mid') || sectorCode.includes('gate')) { sectorMult = 2.0; sectorType = 'mid'; }
    }
  }

  // 인접 할인
  const isAdjacent = ownerWallet ? await checkAdjacency(ownerWallet, bounds) : false;
  const adjMult    = isAdjacent ? await getFloat('land_adjacent_discount', 0.85) : 1.0;

  const totalPrice = base * pixelCount * sectorMult * adjMult;

  // 보유 한도 체크
  const maxKey = sectorType === 'core' ? 'land_max_core_px' : sectorType === 'mid' ? 'land_max_mid_px' : null;
  let overLimit = false;
  if (maxKey && ownerWallet) {
    const maxPx = parseInt(await getSetting(maxKey, '999999'));
    const { rows: owned } = await pool.query(`
      SELECT COALESCE(SUM(width * height), 0) AS total
      FROM claims
      WHERE owner = $1 AND sector_code = $2
        AND deleted_at IS NULL
    `, [ownerWallet, sectorCode]).catch(() => ({ rows: [{ total: 0 }] }));
    const currentOwned = parseInt(owned[0]?.total || 0);
    if (currentOwned + pixelCount > maxPx) overLimit = true;
  }

  return {
    pixel_count:    pixelCount,
    base_price:     parseFloat((base * pixelCount).toFixed(8)),
    sector_mult:    sectorMult,
    sector_type:    sectorType,
    adjacent_discount: isAdjacent,
    adj_mult:       adjMult,
    total_price:    parseFloat(totalPrice.toFixed(8)),
    over_limit:     overLimit,
  };
}

// ─── 인접 여부 확인 ───

/**
 * 구매 예정 영역이 기존 내 영토에 인접하는지 확인
 * @param {string} ownerWallet
 * @param {object} bounds {x, y, width, height}
 */
async function checkAdjacency(ownerWallet, bounds) {
  if (!bounds) return false;
  const { x, y, width, height } = bounds;

  // 내 영토 중 좌표가 인접한 것이 있는지 확인
  // claims 테이블 실제 컬럼: center_lng(x), center_lat(y), width, height
  const { rows } = await pool.query(`
    SELECT id FROM claims
    WHERE owner = $1
      AND deleted_at IS NULL
      AND (
        -- 오른쪽에 내 영토 (my right edge ≈ new area left edge)
        (center_lng + width/2.0 >= $2 - 1 AND center_lng + width/2.0 <= $2 + 1
         AND center_lat - height/2.0 < $4 + $6 AND center_lat + height/2.0 > $4) OR
        -- 왼쪽에 내 영토 (my left edge ≈ new area right edge)
        (center_lng - width/2.0 >= $3 - 1 AND center_lng - width/2.0 <= $3 + 1
         AND center_lat - height/2.0 < $4 + $6 AND center_lat + height/2.0 > $4) OR
        -- 아래에 내 영토 (my bottom edge ≈ new area top edge)
        (center_lat + height/2.0 >= $4 - 1 AND center_lat + height/2.0 <= $4 + 1
         AND center_lng - width/2.0 < $3 AND center_lng + width/2.0 > $2) OR
        -- 위에 내 영토 (my top edge ≈ new area bottom edge)
        (center_lat - height/2.0 >= $4 + $6 - 1 AND center_lat - height/2.0 <= $4 + $6 + 1
         AND center_lng - width/2.0 < $3 AND center_lng + width/2.0 > $2)
      )
    LIMIT 1
  `, [ownerWallet, x, x + width, y, width, height]).catch(() => ({ rows: [] }));

  return rows.length > 0;
}

// ─── 클러스터 인접 보너스 계산 ───

/**
 * BFS로 연결된 클러스터 크기 계산 후 보너스 반환
 * @param {string} ownerWallet
 * @returns {object} {cluster_size, bonus_rate, bonus_type}
 */
async function calcAdjacencyBonus(ownerWallet) {
  const { rows: claims } = await pool.query(`
    SELECT id, center_lng::FLOAT AS x, center_lat::FLOAT AS y, width, height
    FROM claims
    WHERE owner = $1 AND deleted_at IS NULL
    ORDER BY id
  `, [ownerWallet]).catch(() => ({ rows: [] }));

  if (!claims.length) return { cluster_size: 0, bonus_rate: 0, bonus_type: null };

  // 인접 관계 BFS
  const adj = new Map();
  for (const c of claims) adj.set(c.id, []);

  for (let i = 0; i < claims.length; i++) {
    for (let j = i + 1; j < claims.length; j++) {
      const a = claims[i], b = claims[j];
      // 수평/수직 인접 체크
      const hAdj = (a.x + a.width >= b.x - 1 && a.x <= b.x + b.width + 1);
      const vAdj = (a.y + a.height >= b.y - 1 && a.y <= b.y + b.height + 1);
      const touching = (
        (Math.abs(a.x + a.width - b.x) <= 1 && a.y < b.y + b.height && a.y + a.height > b.y) ||
        (Math.abs(b.x + b.width - a.x) <= 1 && b.y < a.y + a.height && b.y + b.height > a.y) ||
        (Math.abs(a.y + a.height - b.y) <= 1 && a.x < b.x + b.width && a.x + a.width > b.x) ||
        (Math.abs(b.y + b.height - a.y) <= 1 && b.x < a.x + a.width && b.x + b.width > a.x)
      );
      if (touching) {
        adj.get(a.id).push(b.id);
        adj.get(b.id).push(a.id);
      }
    }
  }

  // BFS로 최대 클러스터 크기
  const visited = new Set();
  let maxCluster = 0;
  for (const c of claims) {
    if (visited.has(c.id)) continue;
    const queue = [c.id]; visited.add(c.id); let size = 0;
    while (queue.length) {
      const cur = queue.shift(); size++;
      for (const nb of (adj.get(cur) || [])) {
        if (!visited.has(nb)) { visited.add(nb); queue.push(nb); }
      }
    }
    maxCluster = Math.max(maxCluster, size);
  }

  // 보너스 결정
  const b20 = await getFloat('land_adjacency_20_bonus', 0.20);
  const b10 = await getFloat('land_adjacency_10_bonus', 0.10);
  const b5  = await getFloat('land_adjacency_5_bonus',  0.05);

  let bonusRate = 0, bonusType = null;
  if (maxCluster >= 20) { bonusRate = b20; bonusType = 'adjacency_20'; }
  else if (maxCluster >= 10) { bonusRate = b10; bonusType = 'adjacency_10'; }
  else if (maxCluster >= 5)  { bonusRate = b5;  bonusType = 'adjacency_5'; }

  return { cluster_size: maxCluster, bonus_rate: bonusRate, bonus_type: bonusType };
}

// ─── 스케줄러: 전체 인접 보너스 갱신 ───

/**
 * 매 10분마다 스케줄러 호출
 * 모든 유저의 인접 보너스를 재계산해서 claims 업데이트
 */
async function updateAdjacencyBonuses() {
  const { rows: owners } = await pool.query(`
    SELECT DISTINCT owner FROM claims
    WHERE deleted_at IS NULL AND owner IS NOT NULL
  `).catch(() => ({ rows: [] }));

  let updated = 0;
  for (const o of owners) {
    try {
      const { bonus_rate, cluster_size } = await calcAdjacencyBonus(o.owner);
      await pool.query(`
        UPDATE claims SET adjacency_bonus = $2, cluster_size = $3
        WHERE owner = $1 AND deleted_at IS NULL
      `, [o.owner, bonus_rate, cluster_size]);
      updated++;
    } catch { }
  }
  return updated;
}

// ─── 영토 정보 + 가격 미리보기 ───

async function getTerritoryInfo(ownerWallet, pixelCount, x, y, width, height, sectorCode) {
  const bounds = { x, y, width, height };
  const price  = await calcPrice(ownerWallet, pixelCount, bounds, sectorCode);
  const bonus  = ownerWallet ? await calcAdjacencyBonus(ownerWallet) : null;

  return { price, current_bonus: bonus };
}

module.exports = {
  calcPrice,
  checkAdjacency,
  calcAdjacencyBonus,
  updateAdjacencyBonuses,
  getTerritoryInfo,
};
