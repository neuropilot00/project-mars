// server/services/enhancementAdvanced.js
// ═══════════════════════════════════════════════════════════════
// Enhancement 심화 — 기존 enhancement.js 확장
// 바이블 COMPLETE_BIBLE PART 5 § 2 기준
//
// 기존 enhancement.js를 건드리지 않고:
//   1. calculateMaterialBonus()  — 자원 소모 → 성공률/보호 보너스
//   2. getAvailableRecipes()     — 현재 레벨에서 쓸 수 있는 레시피 목록
//   3. consumeMaterials()        — 자원 실제 차감
//   4. checkAndConsumeScroll()   — 보호권 체크 + 소모
//   5. applyScrollProtection()   — 보호권 효과 적용
//
// 사용법 (enhancement.js의 attemptEnhancement에 추가):
//   const adv = require('./enhancementAdvanced');
//   const materialBonus = await adv.calculateMaterialBonus(walletAddress, selectedRecipeIds, currentLevel);
//   const scrollEffect   = await adv.checkAndConsumeScroll(walletAddress, useProtect, useBlessed);
// ═══════════════════════════════════════════════════════════════

const { pool } = require('../db');

// ─── 자원 소모 레시피 ───

/**
 * 현재 강화 레벨에서 사용 가능한 레시피 목록
 */
async function getAvailableRecipes(currentLevel) {
  const { rows } = await pool.query(`
    SELECT emr.*, r.name_ko AS resource_name_ko, r.icon_emoji
    FROM enhancement_material_recipes emr
    LEFT JOIN resources r ON r.code = emr.resource_code
    WHERE emr.is_active = true
      AND emr.min_enhance_level <= $1
    ORDER BY emr.min_enhance_level, emr.success_rate_bonus DESC
  `, [currentLevel]);
  return rows;
}

/**
 * 선택한 레시피 ID들의 보너스 계산
 * @param {string} walletAddress
 * @param {number[]} recipeIds - 선택한 레시피 ID 배열 (최대 1개 성공률 + 1개 파괴방지)
 * @param {number} currentLevel
 * @returns {{ successBonus, breakReduction, recipesToConsume, error }}
 */
async function calculateMaterialBonus(walletAddress, recipeIds = [], currentLevel) {
  if (!recipeIds.length) {
    return { successBonus: 0, breakReduction: 0, recipesToConsume: [], error: null };
  }

  // 레시피 조회
  const placeholders = recipeIds.map((_, i) => `$${i + 2}`).join(',');
  const { rows: recipes } = await pool.query(`
    SELECT * FROM enhancement_material_recipes
    WHERE id IN (${placeholders}) AND is_active = true AND min_enhance_level <= $1
  `, [currentLevel, ...recipeIds]);

  if (recipes.length !== recipeIds.length) {
    return { successBonus: 0, breakReduction: 0, recipesToConsume: [], error: 'INVALID_RECIPE' };
  }

  // 동일 타입(성공률/파괴방지) 중복 체크
  const hasMultipleSuccess = recipes.filter(r => r.success_rate_bonus > 0).length > 1;
  const hasMultipleBreak   = recipes.filter(r => r.break_reduction > 0).length > 1;
  if (hasMultipleSuccess || hasMultipleBreak) {
    return { successBonus: 0, breakReduction: 0, recipesToConsume: [], error: 'DUPLICATE_RECIPE_TYPE' };
  }

  // 재고 확인
  for (const recipe of recipes) {
    const have = await getResourceBalance(walletAddress, recipe.resource_code);
    if (have < recipe.quantity_required) {
      return {
        successBonus: 0, breakReduction: 0, recipesToConsume: [],
        error: 'INSUFFICIENT_MATERIAL',
        meta: { resource: recipe.resource_code, have, need: recipe.quantity_required }
      };
    }
  }

  const successBonus  = recipes.reduce((acc, r) => acc + parseFloat(r.success_rate_bonus || 0), 0);
  const breakReduction = recipes.reduce((acc, r) => acc + parseFloat(r.break_reduction || 0), 0);

  return { successBonus, breakReduction, recipesToConsume: recipes, error: null };
}

/**
 * 자원 실제 차감 (강화 시도 직전 호출)
 */
async function consumeMaterials(client, walletAddress, recipes) {
  for (const recipe of recipes) {
    // user_resource_inventory 또는 user_items 테이블 차감 시도
    const deducted = await deductResource(client, walletAddress, recipe.resource_code, recipe.quantity_required);
    if (!deducted) {
      throw new Error(`MATERIAL_DEDUCT_FAILED:${recipe.resource_code}`);
    }
  }
}

// ─── 보호권 ───

/**
 * 보호권 보유 여부 확인
 * @returns {{ hasProtect, hasBlessed }}
 */
async function getScrollStatus(walletAddress) {
  const [protect, blessed] = await Promise.all([
    getScrollCount(walletAddress, 'protect_scroll'),
    getScrollCount(walletAddress, 'blessed_scroll'),
  ]);
  return { hasProtect: protect > 0, hasBlessed: blessed > 0 };
}

/**
 * 보호권 체크 + 소모 + 효과 반환
 * @param {string} walletAddress
 * @param {boolean} useProtect  — 보호 주문서 사용 여부
 * @param {boolean} useBlessed  — 축복 주문서 사용 여부
 * @returns {{ preventDecrease, preventBreak, scrollUsed }}
 */
async function checkAndConsumeScroll(client, walletAddress, useProtect, useBlessed) {
  const enabled = await getSettingBool('enhancement_scroll_enabled', true);
  if (!enabled) return { preventDecrease: false, preventBreak: false, scrollUsed: null };

  // 축복 주문서 (더 강력, 우선)
  if (useBlessed) {
    const count = await getScrollCountClient(client, walletAddress, 'blessed_scroll');
    if (count < 1) throw new Error('NO_BLESSED_SCROLL');

    await consumeScrollClient(client, walletAddress, 'blessed_scroll', 1);
    return { preventDecrease: true, preventBreak: true, scrollUsed: 'blessed_scroll' };
  }

  // 보호 주문서
  if (useProtect) {
    const count = await getScrollCountClient(client, walletAddress, 'protect_scroll');
    if (count < 1) throw new Error('NO_PROTECT_SCROLL');

    await consumeScrollClient(client, walletAddress, 'protect_scroll', 1);
    return { preventDecrease: true, preventBreak: false, scrollUsed: 'protect_scroll' };
  }

  return { preventDecrease: false, preventBreak: false, scrollUsed: null };
}

/**
 * 보호권 효과를 강화 결과에 적용
 * @param {object} result  — { outcome: 'success'|'decrease'|'break', ... }
 * @param {object} scrollEffect — checkAndConsumeScroll 반환값
 * @returns 수정된 result
 */
function applyScrollProtection(result, scrollEffect) {
  if (!scrollEffect) return result;

  if (result.outcome === 'break' && scrollEffect.preventBreak) {
    return { ...result, outcome: 'unchanged', protected_by: scrollEffect.scrollUsed };
  }
  if (result.outcome === 'decrease' && scrollEffect.preventDecrease) {
    return { ...result, outcome: 'unchanged', protected_by: scrollEffect.scrollUsed };
  }

  return result;
}

// ─── 내부 헬퍼 ───

async function getResourceBalance(walletAddress, resourceCode) {
  // user_resource_inventory는 resource_id FK 기반이다.
  try {
    const { rows } = await pool.query(`
      SELECT COALESCE(uri.quantity, 0) AS qty
      FROM resources r
      LEFT JOIN user_resource_inventory uri
        ON uri.resource_id = r.id AND uri.wallet_address = $1
      WHERE r.code = $2
    `, [walletAddress, resourceCode]);
    return parseInt(rows[0]?.qty || 0);
  } catch {
    try {
      const { rows } = await pool.query(`
        SELECT COALESCE(SUM(ui.quantity), 0) AS qty
        FROM user_items ui
        JOIN item_types it ON it.id = ui.item_type_id
        WHERE ui.wallet = $1 AND it.code = $2
      `, [walletAddress.toLowerCase(), resourceCode]);
      return parseInt(rows[0]?.qty || 0);
    } catch { return 0; }
  }
}

async function deductResource(client, walletAddress, resourceCode, quantity) {
  // user_resource_inventory는 resource_id FK 기반이다.
  try {
    const { rowCount } = await client.query(`
      UPDATE user_resource_inventory
      SET quantity = quantity - $3
      WHERE wallet_address = $1
        AND resource_id = (SELECT id FROM resources WHERE code = $2)
        AND quantity >= $3
    `, [walletAddress, resourceCode, quantity]);
    if (rowCount > 0) return true;
  } catch { }

  // user_items 시도 — item_types JOIN으로 code 조회
  try {
    const { rowCount } = await client.query(`
      UPDATE user_items ui
      SET quantity = ui.quantity - $3
      FROM item_types it
      WHERE ui.item_type_id = it.id
        AND ui.wallet = $1
        AND it.code = $2
        AND ui.quantity >= $3
    `, [walletAddress.toLowerCase(), resourceCode, quantity]);
    return rowCount > 0;
  } catch { return false; }
}

async function getScrollCount(walletAddress, scrollCode) {
  return getScrollCountClient(pool, walletAddress, scrollCode);
}

async function getScrollCountClient(db, walletAddress, scrollCode) {
  try {
    const { rows } = await db.query(`
      SELECT COALESCE(SUM(ui.quantity), 0) AS qty
      FROM user_items ui
      JOIN item_types it ON it.id = ui.item_type_id
      WHERE ui.wallet = $1 AND it.code = $2 AND ui.quantity > 0
    `, [walletAddress.toLowerCase(), scrollCode]);
    return parseInt(rows[0]?.qty || 0);
  } catch { return 0; }
}

async function consumeScrollClient(client, walletAddress, scrollCode, quantity) {
  // user_items에서 차감 — wallet + item_types JOIN으로 code 조회
  const { rowCount } = await client.query(`
    UPDATE user_items ui
    SET quantity = ui.quantity - $3
    FROM item_types it
    WHERE ui.item_type_id = it.id
      AND ui.wallet = $1
      AND it.code = $2
      AND ui.quantity >= $3
  `, [walletAddress.toLowerCase(), scrollCode, quantity]);

  if (!rowCount) throw new Error(`SCROLL_NOT_FOUND:${scrollCode}`);
}

async function getSettingBool(key, fallback) {
  try {
    const { rows } = await pool.query(`SELECT value FROM settings WHERE key = $1`, [key]);
    const v = String(rows[0]?.value || '').replace(/"/g, '');
    if (v === 'true') return true;
    if (v === 'false') return false;
    return fallback;
  } catch { return fallback; }
}

module.exports = {
  getAvailableRecipes,
  calculateMaterialBonus,
  consumeMaterials,
  checkAndConsumeScroll,
  applyScrollProtection,
  getScrollStatus,
};
