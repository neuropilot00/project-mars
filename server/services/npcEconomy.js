// server/services/npcEconomy.js
// ═══════════════════════════════════════════════════════════════
// NPC Economy Operator — 콜드스타트(죽은 시장) 방지용.
//   신규 유저가 MARKET 을 열었을 때 "텅 빔" 대신 살아있는 거래를 보게 한다.
//   기존 AI(is_ai) 계정들이 마켓에 자원을 주기적으로 등록한다.
//
//   ⚠️ 이건 "세계를 살아있게 보이게" 하는 장치다. 재미/리텐션 검증이 아니다.
//   carve 정신 유지: 리스팅이 팔리면 GP 는 실제 구매자 → NPC 로 carve(발행 아님).
//   NPC 재고/수수료 GP 는 콜드스타트 스캐폴딩으로 bounded seed(자원은 환금 불가).
//
//   게이트: settings.npc_economy_enabled (조회 실패 fallback=false; migration 329 시드=true).
//   migration 354의 일회성 발행 원장이 없으면 발행/등록 모두 실패한다.
// ═══════════════════════════════════════════════════════════════

const { pool } = require('../db');
let marketplace; try { marketplace = require('./marketplace'); } catch (_) { marketplace = null; }

async function getSetting(key, fallback) {
  try {
    const r = await pool.query('SELECT value FROM settings WHERE key = $1', [key]);
    return r.rows[0]?.value ?? fallback;
  } catch (_) { return fallback; }
}
function asBool(v) { return v === true || v === 'true'; }
function asInt(v, fb) { const n = parseInt(v); return isNaN(n) ? fb : n; }

// 거래 가능 기본 자원 + 공정 GP 가격(티어 대략). createListing 이 is_tradeable 검증하므로
// 거래불가/비활성 자원은 자동 스킵된다.
const NPC_RES = [
  { code: 'iron_ore', price: 6 },
  { code: 'carbon_fiber', price: 10 },
  { code: 'silicon_chip', price: 14 },
  { code: 'titanium_alloy', price: 28 },
  { code: 'plasma_crystal', price: 36 },
];

// Must share the listing transaction: a failed listing cannot consume or issue seed.
// The owner lock serializes ticks; the normalized ledger PK also survives user deletion.
async function ensureNpcStock(client, npcWallet) {
  const w = npcWallet.toLowerCase();
  const { rows: owners } = await client.query(
    'SELECT wallet_address, is_ai, gp_balance FROM users WHERE LOWER(wallet_address) = $1 ORDER BY wallet_address FOR UPDATE', [w]
  );
  if (owners.length !== 1 || owners[0].is_ai !== true || owners[0].wallet_address !== w) {
    throw new Error('NPC seed requires exactly one normalized AI owner');
  }
  const balance = owners[0].gp_balance;
  if (balance == null || String(balance).trim() === '' || !Number.isFinite(Number(balance)) || Number(balance) < 0) {
    throw new Error('Invalid NPC GP balance');
  }
  const { rows: stock } = await client.query(
    `SELECT id, code FROM resources
      WHERE code = ANY($1::text[]) AND is_active = TRUE AND is_tradeable = TRUE
      ORDER BY id`, [NPC_RES.map(r => r.code)]
  );
  // Lock existing stock before reading it; do not turn malformed quantities/debt into gifts.
  const { rows: inventory } = await client.query(
    `SELECT resource_id, quantity FROM user_resource_inventory
      WHERE wallet_address = $1 AND resource_id = ANY($2::int[]) FOR UPDATE`, [w, stock.map(r => r.id)]
  );
  const quantities = new Map(inventory.map(r => [r.resource_id, r.quantity]));
  for (const quantity of quantities.values()) {
    if (quantity == null || String(quantity).trim() === '' || !Number.isSafeInteger(Number(quantity)) || Number(quantity) < 0) {
      throw new Error('Invalid NPC resource quantity');
    }
  }
  const { rows: seeded } = await client.query('SELECT wallet_address FROM npc_economy_seed_ledger WHERE wallet_address = $1', [w]);
  if (seeded.length) return;

  const resourcesIssued = {};
  for (const r of stock) {
    const issued = Math.max(0, 40 - Number(quantities.get(r.id) ?? 0));
    resourcesIssued[r.code] = issued;
    if (issued > 0) {
      await client.query(
        `INSERT INTO user_resource_inventory (wallet_address, resource_id, quantity, updated_at)
         VALUES ($1, $2, $3, NOW()) ON CONFLICT (wallet_address, resource_id)
         DO UPDATE SET quantity = user_resource_inventory.quantity + EXCLUDED.quantity, updated_at = NOW()`,
        [w, r.id, issued]
      );
    }
  }
  // Compute GP delta in PostgreSQL to preserve the actual numeric amount in the audit.
  const { rows: [issued] } = await client.query(
    `UPDATE users SET gp_balance = GREATEST(gp_balance, 200) WHERE wallet_address = $1
      RETURNING gp_balance - $2::numeric AS gp_issued`, [w, balance]
  );
  await client.query(
    `INSERT INTO npc_economy_seed_ledger (wallet_address, seed_kind, gp_issued, resources_issued)
     VALUES ($1, 'initial_seed', $2, $3::jsonb)`, [w, issued.gp_issued, JSON.stringify(resourcesIssued)]
  );
}

// 활성 NPC 마켓 리스팅 수를 target 이상으로 유지(부족하면 채운다).
async function runMarketTick() {
  if (!marketplace || typeof marketplace.createListing !== 'function') return { error: 'no_marketplace' };
  if (!asBool(await getSetting('npc_economy_enabled', 'false'))) return { skipped: 'disabled' };

  const target = asInt(await getSetting('npc_market_target_listings', '10'), 10);
  const perTick = asInt(await getSetting('npc_market_per_tick', '4'), 4);

  const { rows: [c] } = await pool.query(
    `SELECT COUNT(*)::int AS n
       FROM marketplace_listings ml
       JOIN users u ON LOWER(u.wallet_address) = LOWER(ml.seller)
      WHERE ml.status = 'active' AND u.is_ai = TRUE`
  );
  const have = c?.n || 0;
  if (have >= target) return { skipped: 'full', have, target };

  const need = Math.min(target - have, perTick);
  const { rows: npcs } = await pool.query(
    `SELECT wallet_address FROM users WHERE is_ai = TRUE ORDER BY random() LIMIT $1`,
    [need * 2]
  );

  let created = 0;
  for (const npc of npcs) {
    if (created >= need) break;
    const w = npc.wallet_address;
    const r = NPC_RES[Math.floor(Math.random() * NPC_RES.length)];
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await ensureNpcStock(client, w);
      await marketplace.createListing(client, w, 'resource', {
        resourceCode: r.code,
        resourceQuantity: 10,
        price: r.price,
        currency: 'GP',
      });
      await client.query('COMMIT');
      created++;
    } catch (e) {
      try { await client.query('ROLLBACK'); } catch (_) {}
      // 자원 비활성/거래불가/최대리스팅 도달 등은 정상적 스킵
    } finally {
      client.release();
    }
  }
  return { created, have, target };
}

module.exports = { runMarketTick };
