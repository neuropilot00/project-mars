// server/services/territoryCondition.js
// ─────────────────────────────────────────────────────────────
// 영토 컨디션(HP)/등급/감쇠 (migration 237).
//   - condition 0~100, grade F~S. 매일 감쇠 → 관리(TEND) 안 하면 등급 하락.
//   - grade 가 수확 PP / 레어 드롭에 배수로 작용.
// ─────────────────────────────────────────────────────────────
const { pool, getSetting } = require('../db');

const GRADES = ['F', 'D', 'C', 'B', 'A', 'S'];

function gradeFromCondition(c) {
  const v = Number(c);
  if (v >= 90) return 'S';
  if (v >= 75) return 'A';
  if (v >= 60) return 'B';
  if (v >= 40) return 'C';
  if (v >= 20) return 'D';
  return 'F';
}

async function isEnabled() {
  try { return String(await getSetting('territory_condition_enabled', 'true')) === 'true'; }
  catch (_) { return false; }
}

// 등급별 배수 맵 읽기 (수확/레어)
async function getGradeBonuses() {
  const def = { harvest: { S:1.5,A:1.25,B:1.1,C:1.0,D:0.85,F:0.6 }, rare: { S:1.5,A:1.3,B:1.15,C:1.0,D:0.9,F:0.75 } };
  let harvest = def.harvest, rare = def.rare;
  try { const h = await getSetting('territory_grade_harvest_bonus', null); if (h) harvest = (typeof h === 'string') ? JSON.parse(h) : h; } catch (_) {}
  try { const r = await getSetting('territory_grade_rare_bonus', null); if (r) rare = (typeof r === 'string') ? JSON.parse(r) : r; } catch (_) {}
  return { harvest, rare };
}

// 특정 claim 의 수확 PP 배수
async function harvestMultiplier(grade) {
  if (!(await isEnabled())) return 1;
  const { harvest } = await getGradeBonuses();
  return Number(harvest[grade] || 1) || 1;
}
async function rareMultiplier(grade) {
  if (!(await isEnabled())) return 1;
  const { rare } = await getGradeBonuses();
  return Number(rare[grade] || 1) || 1;
}

// 일일 감쇠: 모든 활성 영토 condition -= decay_per_day, grade 재계산. 스케줄러에서 호출.
async function applyDailyDecay() {
  if (!(await isEnabled())) return { skipped: true };
  const decay = parseFloat(await getSetting('territory_decay_per_day', '3')) || 0;
  if (decay <= 0) return { skipped: true, reason: 'no_decay' };
  // condition 하향 후 grade 를 CASE 로 재계산 (단일 UPDATE)
  const r = await pool.query(
    `UPDATE claims SET
        condition = GREATEST(0, condition - $1),
        grade = CASE
          WHEN GREATEST(0, condition - $1) >= 90 THEN 'S'
          WHEN GREATEST(0, condition - $1) >= 75 THEN 'A'
          WHEN GREATEST(0, condition - $1) >= 60 THEN 'B'
          WHEN GREATEST(0, condition - $1) >= 40 THEN 'C'
          WHEN GREATEST(0, condition - $1) >= 20 THEN 'D'
          ELSE 'F' END
      WHERE deleted_at IS NULL AND condition > 0`,
    [decay]
  );
  console.log(`[territoryCondition] daily decay -${decay} applied to ${r.rowCount} claims`);
  return { decayed: r.rowCount, perDay: decay };
}

// TEND(정비): GP 소모 → condition 회복 + grade 갱신 + 쿨다운.
async function tend(wallet, claimId) {
  const w = String(wallet || '').toLowerCase();
  const cid = parseInt(claimId);
  if (!w || !cid) return { success: false, error: 'bad_input' };
  if (!(await isEnabled())) return { success: false, error: 'disabled' };

  const costGp = parseFloat(await getSetting('territory_tend_cost_gp', '50')) || 0;
  const restore = parseFloat(await getSetting('territory_tend_restore', '25')) || 0;
  const cooldownMin = parseFloat(await getSetting('territory_tend_cooldown_min', '60')) || 0;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const cr = await client.query(
      `SELECT id, owner, condition, last_tended_at FROM claims WHERE id = $1 AND deleted_at IS NULL FOR UPDATE`, [cid]
    );
    if (!cr.rows.length) { await client.query('ROLLBACK'); return { success: false, error: 'claim_not_found' }; }
    const claim = cr.rows[0];
    if (String(claim.owner).toLowerCase() !== w) { await client.query('ROLLBACK'); return { success: false, error: 'not_owner' }; }
    if (cooldownMin > 0 && claim.last_tended_at) {
      const next = new Date(new Date(claim.last_tended_at).getTime() + cooldownMin * 60000);
      if (Date.now() < next.getTime()) {
        await client.query('ROLLBACK');
        return { success: false, error: 'cooldown', nextAllowedAt: next.toISOString() };
      }
    }
    if (Number(claim.condition) >= 100) { await client.query('ROLLBACK'); return { success: false, error: 'already_full', condition: 100 }; }

    // GP 차감 (잔액 가드)
    const ded = await client.query(
      `UPDATE users SET gp_balance = gp_balance - $1 WHERE LOWER(wallet_address) = LOWER($2) AND gp_balance >= $1 RETURNING gp_balance`,
      [costGp, w]
    );
    if (!ded.rows.length) { await client.query('ROLLBACK'); return { success: false, error: 'insufficient_gp', costGp }; }

    const newCond = Math.min(100, Number(claim.condition) + restore);
    const newGrade = gradeFromCondition(newCond);
    await client.query(
      `UPDATE claims SET condition = $1, grade = $2, last_tended_at = NOW() WHERE id = $3`,
      [newCond, newGrade, cid]
    );
    await client.query('COMMIT');

    try { const { logGPActivity } = require('../db'); logGPActivity(w, -costGp, 'territory_tend', `영토 #${cid} 정비`).catch(() => {}); } catch (_) {}
    return { success: true, claimId: cid, condition: newCond, grade: newGrade, gpSpent: costGp, gpBalance: parseFloat(ded.rows[0].gp_balance) };
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('[territoryCondition] tend error:', e.message);
    return { success: false, error: 'internal_error' };
  } finally {
    client.release();
  }
}

module.exports = { gradeFromCondition, isEnabled, getGradeBonuses, harvestMultiplier, rareMultiplier, applyDailyDecay, tend };
