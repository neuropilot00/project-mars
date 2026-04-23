const { pool, getSetting } = require('../db');
let jobService; try { jobService = require('./job'); } catch (_e) {}
let resourceService; try { resourceService = require('./resource'); } catch (_e) {}

// ── Create a listing (item/cosmetic or claim) ──
async function createListing(client, seller, type, params) {
  const w = seller.toLowerCase();

  // Check marketplace enabled
  const enabled = (await getSetting('marketplace_enabled') || 'true') === 'true';
  if (!enabled) throw new Error('Marketplace is currently disabled');

  // Check max active listings
  let maxListings = parseInt(await getSetting('marketplace_max_active_listings') || '20');
  // ✅ [Job System] Merchant listing limit buff
  try { if (jobService) maxListings = Math.floor(maxListings * await jobService.getJobBuff(w, 'merchant_listing_limit', 1.0)); } catch (_je) {}
  const activeRes = await client.query(
    "SELECT COUNT(*) AS cnt FROM marketplace_listings WHERE seller = $1 AND status = 'active'", [w]
  );
  if (parseInt(activeRes.rows[0].cnt) >= maxListings) throw new Error(`Maximum ${maxListings} active listings reached`);

  // Validate price
  const price = parseFloat(params.price);
  const currency = (params.currency || 'GP').toUpperCase();
  if (!['GP', 'PP'].includes(currency)) throw new Error('Invalid currency');
  const minPrice = parseFloat(await getSetting('marketplace_min_price') || '1');
  const maxPrice = parseFloat(await getSetting('marketplace_max_price') || '999999');
  if (isNaN(price) || price < minPrice || price > maxPrice) throw new Error(`Price must be between ${minPrice} and ${maxPrice}`);

  // Listing fee — dynamic based on current active listing count
  let listingFee = parseFloat(await getSetting('marketplace_listing_fee_gp') || '2');
  const currentListings = parseInt(activeRes.rows[0].cnt) || 0;
  if (currentListings >= 10) {
    const mult10 = parseFloat(await getSetting('marketplace_dynamic_fee_10') || '2.0');
    listingFee = Math.ceil(listingFee * mult10);
  } else if (currentListings >= 5) {
    const mult5 = parseFloat(await getSetting('marketplace_dynamic_fee_5') || '1.5');
    listingFee = Math.ceil(listingFee * mult5);
  }
  // ✅ [Job System] Merchant fee discount buff
  try { if (jobService) { const disc = await jobService.getJobBuff(w, 'merchant_fee_discount', 1.0); listingFee = Math.max(0, Math.floor(listingFee * disc)); } } catch (_je) {}
  if (listingFee > 0) {
    const balRes = await client.query('SELECT gp_balance FROM users WHERE wallet_address = $1 FOR UPDATE', [w]);
    if (!balRes.rows.length) throw new Error('User not found');
    if (parseFloat(balRes.rows[0].gp_balance) < listingFee) throw new Error(`Insufficient GP for listing fee (${listingFee} GP)`);
    await client.query('UPDATE users SET gp_balance = gp_balance - $1 WHERE wallet_address = $2', [listingFee, w]);
    await client.query(
      `INSERT INTO transactions (type, from_wallet, pp_amount, fee, meta) VALUES ('marketplace_listing_fee', $1, 0, 0, $2)`,
      [w, JSON.stringify({ fee: listingFee, active_listings: currentListings })]
    );
  }

  // Expiry
  const expiryHours = parseInt(await getSetting('marketplace_default_expiry_hours') || '168');
  const expiresAt = new Date(Date.now() + expiryHours * 3600000);

  let meta = {};
  let itemInstanceId = null;
  let claimId = null;

  if (type === 'cosmetic' || type === 'item') {
    // Validate instance ownership
    const instanceId = parseInt(params.instanceId);
    if (!instanceId) throw new Error('instanceId required');
    const instRes = await client.query(
      `SELECT ii.*, it.name, it.icon, it.code, it.category FROM item_instances ii
       JOIN item_types it ON it.id = ii.item_type_id WHERE ii.id = $1 AND ii.wallet = $2`,
      [instanceId, w]
    );
    if (!instRes.rows.length) throw new Error('Item instance not found or not owned');
    const inst = instRes.rows[0];

    // Check not already listed
    const dupeRes = await client.query(
      "SELECT id FROM marketplace_listings WHERE item_instance_id = $1 AND status = 'active'", [instanceId]
    );
    if (dupeRes.rows.length) throw new Error('This item is already listed');

    // Escrow: move to 'escrow' wallet
    await client.query("UPDATE item_instances SET wallet = 'escrow' WHERE id = $1", [instanceId]);

    itemInstanceId = instanceId;
    meta = {
      itemName: inst.name, itemIcon: inst.icon, itemCode: inst.code,
      category: inst.category, enhancementLevel: inst.enhancement_level,
      itemTypeId: inst.item_type_id
    };

  } else if (type === 'claim') {
    // Validate claim
    const claimSaleEnabled = (await getSetting('marketplace_claim_sale_enabled') || 'true') === 'true';
    if (!claimSaleEnabled) throw new Error('Territory sales are currently disabled');

    claimId = parseInt(params.claimId);
    if (!claimId) throw new Error('claimId required');
    const claimRes = await client.query(
      'SELECT * FROM claims WHERE id = $1 AND owner = $2 AND deleted_at IS NULL', [claimId, w]
    );
    if (!claimRes.rows.length) throw new Error('Claim not found or not owned');
    const claim = claimRes.rows[0];
    if (claim.marketplace_locked) throw new Error('This territory is already listed');

    // Escrow: lock claim
    await client.query('UPDATE claims SET marketplace_locked = true WHERE id = $1', [claimId]);

    // Count pixels
    const pxRes = await client.query('SELECT COUNT(*) AS cnt FROM pixels WHERE claim_id = $1', [claimId]);
    meta = {
      claimCenter: [parseFloat(claim.center_lat), parseFloat(claim.center_lng)],
      claimSize: [claim.width, claim.height],
      pixelCount: parseInt(pxRes.rows[0].cnt),
      imageUrl: claim.image_url || null
    };
  } else if (type === 'resource') {
    // Validate resource ownership
    const resourceCode = params.resourceCode;
    const resourceQty = parseInt(params.resourceQuantity) || 1;
    if (!resourceCode) throw new Error('resourceCode required');
    if (resourceQty < 1) throw new Error('resourceQuantity must be >= 1');

    // Verify resource exists
    const resInfo = await client.query('SELECT * FROM resources WHERE code = $1 AND is_active = TRUE AND is_tradeable = TRUE', [resourceCode]);
    if (!resInfo.rows.length) throw new Error('Resource not found or not tradeable');

    // Verify user has enough
    const invRes = await client.query(
      `SELECT inv.quantity FROM user_resource_inventory inv
       JOIN resources r ON r.id = inv.resource_id
       WHERE inv.wallet_address = $1 AND r.code = $2`, [w, resourceCode]
    );
    const currentQty = invRes.rows.length ? parseInt(invRes.rows[0].quantity) : 0;
    if (currentQty < resourceQty) throw new Error(`Insufficient ${resourceCode} (have ${currentQty}, need ${resourceQty})`);

    // Escrow: deduct from inventory
    await client.query(
      `UPDATE user_resource_inventory SET quantity = quantity - $1, updated_at = NOW()
       WHERE wallet_address = $2 AND resource_id = (SELECT id FROM resources WHERE code = $3)`,
      [resourceQty, w, resourceCode]
    );

    const r = resInfo.rows[0];
    meta = { resourceName: r.name_en, resourceIcon: r.icon_emoji, resourceCode, resourceQty, rarity: r.rarity };

  } else {
    throw new Error('Invalid listing type');
  }

  // Create listing (resource type includes resource_code + resource_quantity)
  const isResource = type === 'resource';
  const listRes = await client.query(
    `INSERT INTO marketplace_listings
       (seller, listing_type, item_instance_id, claim_id, price, currency, expires_at, meta${isResource ? ', resource_code, resource_quantity' : ''})
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8${isResource ? ', $9, $10' : ''}) RETURNING *`,
    isResource
      ? [w, type, null, null, price, currency, expiresAt, JSON.stringify(meta), params.resourceCode, parseInt(params.resourceQuantity) || 1]
      : [w, type, itemInstanceId, claimId, price, currency, expiresAt, JSON.stringify(meta)]
  );

  return listRes.rows[0];
}

// ── Cancel a listing ──
async function cancelListing(client, listingId, wallet) {
  const w = wallet.toLowerCase();
  const res = await client.query(
    "SELECT * FROM marketplace_listings WHERE id = $1 AND seller = $2 AND status = 'active'",
    [listingId, w]
  );
  if (!res.rows.length) throw new Error('Listing not found or not yours');
  const listing = res.rows[0];

  // Return escrowed asset
  if (listing.item_instance_id) {
    await client.query('UPDATE item_instances SET wallet = $1 WHERE id = $2', [w, listing.item_instance_id]);
  }
  if (listing.claim_id) {
    await client.query('UPDATE claims SET marketplace_locked = false WHERE id = $1', [listing.claim_id]);
  }
  // ✅ [Resource System] 자원 에스크로 반환
  if (listing.listing_type === 'resource' && listing.resource_code && listing.resource_quantity > 0) {
    await client.query(
      `INSERT INTO user_resource_inventory (wallet_address, resource_id, quantity, updated_at)
       SELECT $1, r.id, $2, NOW() FROM resources r WHERE r.code = $3
       ON CONFLICT (wallet_address, resource_id) DO UPDATE SET quantity = user_resource_inventory.quantity + EXCLUDED.quantity, updated_at = NOW()`,
      [w, listing.resource_quantity, listing.resource_code]
    );
  }

  await client.query("UPDATE marketplace_listings SET status = 'cancelled' WHERE id = $1", [listingId]);
  return { success: true };
}

// ── Buy a listing (instant purchase) ──
async function buyListing(client, listingId, buyer) {
  const b = buyer.toLowerCase();

  const res = await client.query(
    "SELECT * FROM marketplace_listings WHERE id = $1 AND status = 'active'", [listingId]
  );
  if (!res.rows.length) throw new Error('Listing not found or no longer available');
  const listing = res.rows[0];

  if (listing.seller === b) throw new Error('Cannot buy your own listing');

  // Check expiry
  if (new Date(listing.expires_at) < new Date()) {
    await client.query("UPDATE marketplace_listings SET status = 'expired' WHERE id = $1", [listingId]);
    throw new Error('This listing has expired');
  }

  const price = parseFloat(listing.price);
  const currency = listing.currency;
  const balCol = currency === 'PP' ? 'pp_balance' : 'gp_balance';

  // Check buyer balance
  const balRes = await client.query(`SELECT ${balCol} AS bal FROM users WHERE wallet_address = $1`, [b]);
  if (!balRes.rows.length) throw new Error('User not found');
  if (parseFloat(balRes.rows[0].bal) < price) throw new Error(`Insufficient ${currency}. Need ${price}`);

  // Deduct buyer balance
  await client.query(`UPDATE users SET ${balCol} = ${balCol} - $1 WHERE wallet_address = $2`, [price, b]);

  // Calculate fee
  let feePct = parseFloat(await getSetting('marketplace_fee_pct') || '5');
  // ✅ [Job System] Merchant market fee discount (applied to seller)
  try { if (jobService) feePct = Math.max(0, feePct * await jobService.getJobBuff(listing.seller, 'merchant_market_fee', 1.0)); } catch (_je) {}
  const fee = Math.floor(price * feePct / 100 * 1000000) / 1000000;
  const sellerReceives = price - fee;

  // Credit seller
  await client.query(`UPDATE users SET ${balCol} = ${balCol} + $1 WHERE wallet_address = $2`, [sellerReceives, listing.seller]);

  // Transfer asset
  if (listing.item_instance_id) {
    await client.query('UPDATE item_instances SET wallet = $1 WHERE id = $2', [b, listing.item_instance_id]);
  }
  if (listing.claim_id) {
    // Transfer claim ownership
    await client.query('UPDATE claims SET owner = $1, marketplace_locked = false WHERE id = $2', [b, listing.claim_id]);
    // Transfer all pixels in that claim
    await client.query('UPDATE pixels SET owner = $1 WHERE claim_id = $2', [b, listing.claim_id]);
    // Transfer cosmetics
    await client.query('UPDATE user_cosmetics SET wallet = $1 WHERE claim_id = $2', [b, listing.claim_id]);
  }
  // ✅ [Resource System] 자원 소유권 이전 (에스크로 → 구매자)
  if (listing.listing_type === 'resource' && listing.resource_code && listing.resource_quantity > 0) {
    await client.query(
      `INSERT INTO user_resource_inventory (wallet_address, resource_id, quantity, updated_at)
       SELECT $1, r.id, $2, NOW() FROM resources r WHERE r.code = $3
       ON CONFLICT (wallet_address, resource_id) DO UPDATE SET quantity = user_resource_inventory.quantity + EXCLUDED.quantity, updated_at = NOW()`,
      [b, listing.resource_quantity, listing.resource_code]
    );
  }

  // Update listing
  await client.query(
    "UPDATE marketplace_listings SET status = 'sold', buyer = $1, sold_at = NOW() WHERE id = $2",
    [b, listingId]
  );

  // Log transactions
  await client.query(
    `INSERT INTO transactions (type, from_wallet, pp_amount, fee, meta) VALUES ('marketplace_sale', $1, 0, 0, $2)`,
    [b, JSON.stringify({ listingId, price, currency, seller: listing.seller })]
  );
  if (fee > 0) {
    await client.query(
      `INSERT INTO transactions (type, from_wallet, pp_amount, fee, meta) VALUES ('marketplace_fee', $1, 0, $2, $3)`,
      [listing.seller, fee, JSON.stringify({ listingId, feePct })]
    );
  }

  // Price history
  const meta = listing.meta || {};
  await client.query(
    `INSERT INTO marketplace_price_history (listing_type, item_type_id, enhancement_level, claim_id, sale_price, currency)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [listing.listing_type, meta.itemTypeId || null, meta.enhancementLevel || 0, listing.claim_id, price, currency]
  );

  return { success: true, price, fee, sellerReceives, currency, listing };
}

// ── Get listings (with filters, pagination) ──
async function getListings(filters = {}) {
  const conditions = ["status = 'active'", "expires_at > NOW()"];
  const params = [];
  let idx = 1;

  if (filters.type) { conditions.push(`listing_type = $${idx++}`); params.push(filters.type); }
  if (filters.currency) { conditions.push(`currency = $${idx++}`); params.push(filters.currency.toUpperCase()); }
  if (filters.minPrice) { conditions.push(`price >= $${idx++}`); params.push(parseFloat(filters.minPrice)); }
  if (filters.maxPrice) { conditions.push(`price <= $${idx++}`); params.push(parseFloat(filters.maxPrice)); }
  if (filters.seller) { conditions.push(`seller = $${idx++}`); params.push(filters.seller.toLowerCase()); }
  if (filters.search) {
    conditions.push(`(meta->>'itemName' ILIKE $${idx} OR meta->>'itemCode' ILIKE $${idx})`);
    params.push('%' + filters.search + '%');
    idx++;
  }

  const sortMap = { price_asc: 'price ASC', price_desc: 'price DESC', newest: 'listed_at DESC', ending: 'expires_at ASC' };
  const orderBy = sortMap[filters.sort] || 'listed_at DESC';
  const limit = Math.min(parseInt(filters.limit) || 40, 100);
  const offset = parseInt(filters.offset) || 0;

  const q = `SELECT ml.*, u.nickname AS seller_name
    FROM marketplace_listings ml
    LEFT JOIN users u ON u.wallet_address = ml.seller
    WHERE ${conditions.join(' AND ')}
    ORDER BY ${orderBy}
    LIMIT ${limit} OFFSET ${offset}`;

  const res = await pool.query(q, params);

  // Total count for pagination
  const cntQ = `SELECT COUNT(*) AS cnt FROM marketplace_listings WHERE ${conditions.join(' AND ')}`;
  const cntRes = await pool.query(cntQ, params);

  return { listings: res.rows, total: parseInt(cntRes.rows[0].cnt) };
}

// ── Get single listing detail ──
async function getListingDetail(listingId) {
  const res = await pool.query(
    `SELECT ml.*, u.nickname AS seller_name
     FROM marketplace_listings ml
     LEFT JOIN users u ON u.wallet_address = ml.seller
     WHERE ml.id = $1`, [listingId]
  );
  if (!res.rows.length) return null;
  return res.rows[0];
}

// ── Get my listings ──
async function getMyListings(wallet) {
  const w = wallet.toLowerCase();
  const res = await pool.query(
    `SELECT * FROM marketplace_listings WHERE seller = $1 ORDER BY listed_at DESC LIMIT 50`, [w]
  );
  return res.rows;
}

// ── Recent sales ──
async function getRecentSales(limit = 20) {
  const res = await pool.query(
    `SELECT ml.*, u.nickname AS seller_name, u2.nickname AS buyer_name
     FROM marketplace_listings ml
     LEFT JOIN users u ON u.wallet_address = ml.seller
     LEFT JOIN users u2 ON u2.wallet_address = ml.buyer
     WHERE ml.status = 'sold'
     ORDER BY ml.sold_at DESC LIMIT $1`, [Math.min(limit, 50)]
  );
  return res.rows;
}

// ── Price history ──
async function getPriceHistory(itemTypeId, enhancementLevel) {
  const res = await pool.query(
    `SELECT sale_price, currency, sold_at FROM marketplace_price_history
     WHERE item_type_id = $1 AND enhancement_level = $2
     ORDER BY sold_at DESC LIMIT 30`,
    [itemTypeId, enhancementLevel || 0]
  );
  return res.rows;
}

// ── Expire old listings (called periodically) ──
async function expireListings() {
  const res = await pool.query(
    "UPDATE marketplace_listings SET status = 'expired' WHERE status = 'active' AND expires_at < NOW() RETURNING id, item_instance_id, claim_id, seller"
  );
  // Return escrowed assets
  for (const row of res.rows) {
    try {
      if (row.item_instance_id) {
        await pool.query('UPDATE item_instances SET wallet = $1 WHERE id = $2', [row.seller, row.item_instance_id]);
      }
      if (row.claim_id) {
        await pool.query('UPDATE claims SET marketplace_locked = false WHERE id = $1', [row.claim_id]);
      }
    } catch (_e) { /* non-critical */ }
  }
  return res.rowCount;
}

// ── Admin stats ──
async function getMarketplaceStats() {
  const stats = await pool.query(`
    SELECT
      COUNT(*) FILTER (WHERE status = 'active') AS active_listings,
      COUNT(*) FILTER (WHERE status = 'sold') AS total_sold,
      COUNT(*) FILTER (WHERE status = 'expired') AS total_expired,
      COUNT(*) FILTER (WHERE status = 'cancelled') AS total_cancelled,
      COALESCE(SUM(price) FILTER (WHERE status = 'sold'), 0) AS total_volume
    FROM marketplace_listings
  `);

  const feeRes = await pool.query(
    "SELECT COALESCE(SUM(fee), 0) AS total_fees FROM transactions WHERE type = 'marketplace_fee'"
  );

  const recentSales = await getRecentSales(10);

  return {
    ...stats.rows[0],
    total_fees: feeRes.rows[0].total_fees,
    recentSales
  };
}

// ── Admin: force cancel a listing ──
async function adminCancelListing(client, listingId) {
  const res = await client.query(
    "SELECT * FROM marketplace_listings WHERE id = $1 AND status = 'active'", [listingId]
  );
  if (!res.rows.length) throw new Error('Listing not found or not active');
  const listing = res.rows[0];

  if (listing.item_instance_id) {
    await client.query('UPDATE item_instances SET wallet = $1 WHERE id = $2', [listing.seller, listing.item_instance_id]);
  }
  if (listing.claim_id) {
    await client.query('UPDATE claims SET marketplace_locked = false WHERE id = $1', [listing.claim_id]);
  }

  await client.query("UPDATE marketplace_listings SET status = 'moderated' WHERE id = $1", [listingId]);
  return { success: true };
}

module.exports = {
  createListing,
  cancelListing,
  buyListing,
  getListings,
  getListingDetail,
  getMyListings,
  getRecentSales,
  getPriceHistory,
  expireListings,
  getMarketplaceStats,
  adminCancelListing
};
