/**
 * services/auction.js
 * Auction System (BIBLE Migration 090)
 *
 * 함수 목록:
 *  - createAuction(sellerWallet, auctionData)      → 옥션 등록 + 에스크로
 *  - placeBid(bidderWallet, auctionId, bidAmount)  → 입찰 + 스나이핑 방지
 *  - settleAuction(auctionId)                      → 낙찰/유찰 정산
 *  - buyout(bidderWallet, auctionId)               → 즉구
 *  - cancelAuction(sellerWallet, auctionId)        → 등록 취소 (입찰 없을 때만)
 *  - getAuctions(filters)                          → 목록 조회
 *  - getAuction(auctionId)                         → 상세 조회
 *  - getUserAuctions(wallet)                       → 내 옥션 목록
 *  - settleExpiredAuctions()                       → 스케줄러용
 *
 * ⚠️  users.id 없음 → wallet_address VARCHAR(42) 기반
 */

'use strict';

const { pool, getSetting } = require('../db');

let jobService;
try { jobService = require('./job'); } catch (_) {}
let titleService;
try { titleService = require('./title'); } catch (_) {}

// ─────────────────────────────────────────────────────────────
// 1. 옥션 등록
// ─────────────────────────────────────────────────────────────
async function createAuction(sellerWallet, data) {
  const w = sellerWallet.toLowerCase();

  const enabled = (await getSetting('auction_enabled') || 'true') === 'true';
  if (!enabled) return { success: false, error: 'auction_disabled' };

  const maxActive   = parseInt(await getSetting('auction_max_active') || '5');
  const minHours    = parseInt(await getSetting('auction_min_duration_hours') || '1');
  const maxHours    = parseInt(await getSetting('auction_max_duration_hours') || '168');
  const feePct      = parseFloat(await getSetting('auction_platform_fee_pct') || '5') / 100;

  let listingFee = parseInt(await getSetting('auction_listing_fee_gp') || '5');
  // Job: Merchant listing fee discount
  try { if (jobService) listingFee = Math.max(0, Math.floor(listingFee * await jobService.getJobBuff(w, 'merchant_fee_discount', 1.0))); } catch (_) {}

  const { itemType, startPrice, currency = 'GP', buyoutPrice, durationHours } = data;
  if (!['cosmetic', 'item', 'claim', 'resource'].includes(itemType)) {
    return { success: false, error: 'invalid_item_type' };
  }
  if (!startPrice || parseInt(startPrice) <= 0) {
    return { success: false, error: 'invalid_start_price' };
  }
  const hours = Math.min(maxHours, Math.max(minHours, parseInt(durationHours) || 24));

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Max active auctions check
    const activeRes = await client.query(
      "SELECT COUNT(*) AS cnt FROM auctions WHERE seller_wallet = $1 AND status = 'active'", [w]
    );
    if (parseInt(activeRes.rows[0].cnt) >= maxActive) {
      await client.query('ROLLBACK');
      return { success: false, error: 'max_auctions_reached', max: maxActive };
    }

    // GP for listing fee
    const userRes = await client.query('SELECT gp_balance FROM users WHERE LOWER(wallet_address) = LOWER($1) FOR UPDATE', [w]);
    if (!userRes.rows.length) { await client.query('ROLLBACK'); return { success: false, error: 'user_not_found' }; }
    if (listingFee > 0 && parseFloat(userRes.rows[0].gp_balance) < listingFee) {
      await client.query('ROLLBACK');
      return { success: false, error: 'insufficient_gp', required: listingFee };
    }
    if (listingFee > 0) {
      const auctionListDeduct = await client.query(
        'UPDATE users SET gp_balance = gp_balance - $1 WHERE LOWER(wallet_address) = LOWER($2) AND gp_balance >= $1',
        [listingFee, w]
      );
      if (auctionListDeduct.rowCount === 0) {
        await client.query('ROLLBACK');
        return { success: false, error: 'INSUFFICIENT_GP' };
      }
      // ✅ GP Activity log
      try { const { logGPActivity } = require('../db'); logGPActivity(w, -listingFee, 'auction_list', `listing fee`).catch(()=>{}); } catch (_le) {}
    }

    let itemInstanceId = null;
    let claimId        = null;
    let resourceCode   = null;
    let resourceQty    = null;

    if (itemType === 'cosmetic' || itemType === 'item') {
      // Verify instance ownership + escrow
      const instId = parseInt(data.instanceId);
      if (!instId) { await client.query('ROLLBACK'); return { success: false, error: 'instanceId_required' }; }
      const instRes = await client.query(
        "SELECT id FROM item_instances WHERE id = $1 AND wallet = $2",
        [instId, w]
      );
      if (!instRes.rows.length) { await client.query('ROLLBACK'); return { success: false, error: 'item_not_found' }; }
      // Escrow: move to 'auction_escrow'
      await client.query('UPDATE item_instances SET wallet = $1 WHERE id = $2', ['auction_escrow', instId]);
      itemInstanceId = instId;

    } else if (itemType === 'claim') {
      const cId = parseInt(data.claimId);
      if (!cId) { await client.query('ROLLBACK'); return { success: false, error: 'claimId_required' }; }
      const claimRes = await client.query(
        'SELECT id, marketplace_locked, auction_locked FROM claims WHERE id = $1 AND owner = $2 AND deleted_at IS NULL',
        [cId, w]
      );
      if (!claimRes.rows.length) { await client.query('ROLLBACK'); return { success: false, error: 'claim_not_found' }; }
      const c = claimRes.rows[0];
      if (c.marketplace_locked || c.auction_locked) {
        await client.query('ROLLBACK'); return { success: false, error: 'claim_already_listed' };
      }
      await client.query('UPDATE claims SET auction_locked = TRUE WHERE id = $1', [cId]);
      claimId = cId;

    } else if (itemType === 'resource') {
      resourceCode = data.resourceCode;
      resourceQty  = parseInt(data.resourceQuantity) || 0;
      if (!resourceCode || resourceQty <= 0) {
        await client.query('ROLLBACK'); return { success: false, error: 'invalid_resource' };
      }
      // Verify resource balance — user_resource_inventory uses wallet_address + resource_id (FK to resources)
      const rsRes = await client.query(
        `SELECT uri.quantity FROM user_resource_inventory uri
           JOIN resources r ON r.id = uri.resource_id
          WHERE uri.wallet_address = $1 AND r.code = $2 FOR UPDATE`,
        [w, resourceCode]
      );
      if (!rsRes.rows.length || parseInt(rsRes.rows[0].quantity) < resourceQty) {
        await client.query('ROLLBACK'); return { success: false, error: 'insufficient_resource' };
      }
      // Deduct for escrow (AND quantity >= $1 guard prevents negative on race)
      const escrowDeduct = await client.query(
        `UPDATE user_resource_inventory SET quantity = quantity - $1
           WHERE wallet_address = $2 AND resource_id = (SELECT id FROM resources WHERE code = $3) AND quantity >= $1`,
        [resourceQty, w, resourceCode]
      );
      if (escrowDeduct.rowCount === 0) {
        await client.query('ROLLBACK'); return { success: false, error: 'insufficient_resource' };
      }
    }

    const endsAt = new Date(Date.now() + hours * 3600000);
    const snipeMin = parseInt(await getSetting('auction_snipe_extension_min') || '5');

    const auctionRes = await client.query(
      `INSERT INTO auctions
         (seller_wallet, item_type, item_instance_id, resource_code, resource_quantity,
          claim_id, start_price, currency, current_bid, buyout_price,
          listing_fee, platform_fee_rate, ends_at, snipe_extension_min)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       RETURNING *`,
      [w, itemType, itemInstanceId, resourceCode, resourceQty,
       claimId, parseInt(startPrice), currency, parseInt(startPrice),
       buyoutPrice ? parseInt(buyoutPrice) : null,
       listingFee, feePct, endsAt, snipeMin]
    );

    await client.query('COMMIT');
    return { success: true, auction: auctionRes.rows[0] };
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[AUCTION] createAuction error:', err.message);
    return { success: false, error: 'internal_error' };
  } finally {
    client.release();
  }
}

// ─────────────────────────────────────────────────────────────
// 2. 입찰
// ─────────────────────────────────────────────────────────────
async function placeBid(bidderWallet, auctionId, bidAmount) {
  const w   = bidderWallet.toLowerCase();
  const id  = parseInt(auctionId);
  const amt = parseInt(bidAmount);

  const minIncrPct = parseFloat(await getSetting('auction_min_increment_pct') || '5') / 100;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Fetch auction
    const aRes = await client.query(
      "SELECT * FROM auctions WHERE id = $1 AND status = 'active' FOR UPDATE",
      [id]
    );
    if (!aRes.rows.length) {
      await client.query('ROLLBACK');
      return { success: false, error: 'auction_not_found_or_ended' };
    }
    const auction = aRes.rows[0];

    if (new Date(auction.ends_at) < new Date()) {
      await client.query('ROLLBACK');
      return { success: false, error: 'auction_ended' };
    }
    if (auction.seller_wallet === w) {
      await client.query('ROLLBACK');
      return { success: false, error: 'cannot_bid_own_auction' };
    }
    if (auction.current_bidder_wallet === w) {
      await client.query('ROLLBACK');
      return { success: false, error: 'already_winning_bidder' };
    }

    // Minimum bid: current_bid + increment
    const minBid = Math.ceil(auction.current_bid * (1 + minIncrPct));
    const effectiveMinBid = Math.max(minBid, auction.start_price);
    if (amt < effectiveMinBid) {
      await client.query('ROLLBACK');
      return { success: false, error: 'bid_too_low', min_bid: effectiveMinBid };
    }

    // GP check
    const userRes = await client.query('SELECT gp_balance FROM users WHERE LOWER(wallet_address) = LOWER($1) FOR UPDATE', [w]);
    if (!userRes.rows.length) { await client.query('ROLLBACK'); return { success: false, error: 'user_not_found' }; }
    if (parseFloat(userRes.rows[0].gp_balance) < amt) {
      await client.query('ROLLBACK');
      return { success: false, error: 'insufficient_gp', required: amt };
    }

    // Deduct new bidder's GP
    const bidDeductRes = await client.query(
      'UPDATE users SET gp_balance = gp_balance - $1 WHERE LOWER(wallet_address) = LOWER($2) AND gp_balance >= $1',
      [amt, w]
    );
    if (bidDeductRes.rowCount === 0) {
      await client.query('ROLLBACK');
      return { success: false, error: 'INSUFFICIENT_GP' };
    }

    // Refund previous bidder
    if (auction.current_bidder_wallet && auction.current_bid > auction.start_price) {
      await client.query('UPDATE users SET gp_balance = gp_balance + $1 WHERE LOWER(wallet_address) = LOWER($2)',
        [auction.current_bid, auction.current_bidder_wallet]);
      await client.query(
        'UPDATE bids SET is_winning = FALSE WHERE auction_id = $1 AND is_winning = TRUE',
        [id]
      );
    }

    // Insert bid
    await client.query(
      'INSERT INTO bids (auction_id, bidder_wallet, bid_amount, is_winning) VALUES ($1,$2,$3,TRUE)',
      [id, w, amt]
    );

    // Snipe protection: if within snipe_extension_min of end, extend
    const minsRemaining = (new Date(auction.ends_at) - new Date()) / 60000;
    let newEndsAt = auction.ends_at;
    if (minsRemaining < auction.snipe_extension_min) {
      newEndsAt = new Date(Date.now() + auction.snipe_extension_min * 60000);
      await client.query('UPDATE auctions SET current_bid = $1, current_bidder_wallet = $2, ends_at = $3 WHERE id = $4',
        [amt, w, newEndsAt, id]);
    } else {
      await client.query('UPDATE auctions SET current_bid = $1, current_bidder_wallet = $2 WHERE id = $3',
        [amt, w, id]);
    }

    await client.query('COMMIT');

    // ✅ GP Activity log (bid held)
    try { const { logGPActivity } = require('../db'); logGPActivity(w, -amt, 'auction_bid', `auction #${id}`).catch(()=>{}); } catch (_le) {}

    // ✅ Notify outbid player
    if (auction.current_bidder_wallet && auction.current_bidder_wallet !== w) {
      try {
        const { notifyPlayer } = require('../db');
        notifyPlayer(auction.current_bidder_wallet, 'auction_outbid',
          `🔔 You were outbid on auction #${id}! New bid: ${amt} GP. Your ${auction.current_bid} GP was refunded.`,
          { auctionId: id, newBid: amt, refunded: auction.current_bid }
        ).catch(() => {});
      } catch (_ne) {}
    }

    return { success: true, bid_amount: amt, ends_at: newEndsAt, extended: newEndsAt !== auction.ends_at };
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[AUCTION] placeBid error:', err.message);
    return { success: false, error: 'internal_error' };
  } finally {
    client.release();
  }
}

// ─────────────────────────────────────────────────────────────
// 3. 즉구 (Buyout)
// ─────────────────────────────────────────────────────────────
async function buyout(buyerWallet, auctionId) {
  const w  = buyerWallet.toLowerCase();
  const id = parseInt(auctionId);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const aRes = await client.query(
      "SELECT * FROM auctions WHERE id = $1 AND status = 'active' FOR UPDATE",
      [id]
    );
    if (!aRes.rows.length) { await client.query('ROLLBACK'); return { success: false, error: 'auction_not_found' }; }
    const auction = aRes.rows[0];
    if (!auction.buyout_price) { await client.query('ROLLBACK'); return { success: false, error: 'no_buyout_price' }; }
    if (auction.seller_wallet === w) { await client.query('ROLLBACK'); return { success: false, error: 'cannot_buy_own' }; }

    const buyoutAmt = auction.buyout_price;
    const userRes = await client.query('SELECT gp_balance FROM users WHERE LOWER(wallet_address) = LOWER($1) FOR UPDATE', [w]);
    if (parseFloat(userRes.rows[0]?.gp_balance ?? 0) < buyoutAmt) {
      await client.query('ROLLBACK'); return { success: false, error: 'insufficient_gp', required: buyoutAmt };
    }

    // Deduct buyer
    await client.query('UPDATE users SET gp_balance = gp_balance - $1 WHERE LOWER(wallet_address) = LOWER($2) AND gp_balance >= $1', [buyoutAmt, w]);

    // Refund current highest bidder
    if (auction.current_bidder_wallet && auction.current_bid > auction.start_price) {
      await client.query('UPDATE users SET gp_balance = gp_balance + $1 WHERE LOWER(wallet_address) = LOWER($2)',
        [auction.current_bid, auction.current_bidder_wallet]);
    }

    // Platform fee + seller payout
    const fee = Math.floor(buyoutAmt * auction.platform_fee_rate);
    const sellerPayout = buyoutAmt - fee;
    await client.query('UPDATE users SET gp_balance = gp_balance + $1 WHERE LOWER(wallet_address) = LOWER($2)', [sellerPayout, auction.seller_wallet]);

    // Transfer item
    await _transferItem(client, auction, w);

    // Close auction
    await client.query(
      "UPDATE auctions SET status = 'settled', current_bid = $1, current_bidder_wallet = $2, settled_at = NOW() WHERE id = $3",
      [buyoutAmt, w, id]
    );

    await client.query('COMMIT');

    // ✅ Referral commission + season score
    try {
      const { creditReferralCommission } = require('../db');
      const seasonSvc = require('./season');
      await creditReferralCommission(client, w, 'auction_buy', buyoutAmt, 'gp');
      seasonSvc.addSeasonScore(w, 'gp_spend', buyoutAmt).catch(() => {});
      seasonSvc.addSeasonScore(w, 'trade', 1).catch(() => {});
    } catch (_re) {}

    // ✅ GP Activity log
    try { const { logGPActivity } = require('../db');
      logGPActivity(w, -buyoutAmt, 'auction_buy', `auction #${id} buyout`).catch(()=>{});
      logGPActivity(auction.seller_wallet, sellerPayout, 'auction_sell', `auction #${id} buyout`).catch(()=>{});
    } catch (_le) {}

    // ✅ Daily mission progress: marketplace_trade
    try {
      const dailySvc = require('./daily');
      dailySvc.updateMissionProgress(w, 'marketplace_trade', 1).catch(() => {});
    } catch (_de) {}

    // ✅ Notify buyer (buyout = instant win)
    try {
      const { notifyPlayer } = require('../db');
      notifyPlayer(w, 'auction_won',
        `🎉 You bought out auction #${id} for ${buyoutAmt} GP! Item transferred to your inventory.`,
        { auctionId: id, buyoutAmount: buyoutAmt }
      ).catch(() => {});
    } catch (_ne) {}

    // Marketplace sales title check
    if (titleService) {
      _checkMarketplaceSalesTitle(auction.seller_wallet).catch(() => {});
    }

    return { success: true, buyout_amount: buyoutAmt, seller_payout: sellerPayout, fee };
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[AUCTION] buyout error:', err.message);
    return { success: false, error: 'internal_error' };
  } finally {
    client.release();
  }
}

// ─────────────────────────────────────────────────────────────
// 4. 취소 (입찰 없을 때만)
// ─────────────────────────────────────────────────────────────
async function cancelAuction(sellerWallet, auctionId) {
  const w  = sellerWallet.toLowerCase();
  const id = parseInt(auctionId);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const aRes = await client.query(
      "SELECT * FROM auctions WHERE id = $1 AND status = 'active' AND seller_wallet = $2 FOR UPDATE",
      [id, w]
    );
    if (!aRes.rows.length) { await client.query('ROLLBACK'); return { success: false, error: 'auction_not_found' }; }
    const auction = aRes.rows[0];

    // Has bids?
    const bidCount = await client.query('SELECT COUNT(*) AS cnt FROM bids WHERE auction_id = $1', [id]);
    if (parseInt(bidCount.rows[0].cnt) > 0) {
      await client.query('ROLLBACK'); return { success: false, error: 'cannot_cancel_with_bids' };
    }

    // Return escrow
    await _returnEscrow(client, auction, w);
    await client.query("UPDATE auctions SET status = 'cancelled' WHERE id = $1", [id]);
    await client.query('COMMIT');
    return { success: true };
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[AUCTION] cancelAuction error:', err.message);
    return { success: false, error: 'internal_error' };
  } finally {
    client.release();
  }
}

// ─────────────────────────────────────────────────────────────
// 5. 정산 (스케줄러 호출)
// ─────────────────────────────────────────────────────────────
async function settleAuction(auctionId) {
  const id = parseInt(auctionId);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const aRes = await client.query(
      "SELECT * FROM auctions WHERE id = $1 AND status = 'active' FOR UPDATE",
      [id]
    );
    if (!aRes.rows.length) { await client.query('ROLLBACK'); return { success: true, skipped: true }; }
    const auction = aRes.rows[0];

    if (auction.current_bidder_wallet && auction.current_bid > 0) {
      // 낙찰: 판매자에게 입금 (플랫폼 수수료 차감)
      const fee = Math.floor(auction.current_bid * auction.platform_fee_rate);
      const payout = auction.current_bid - fee;
      await client.query('UPDATE users SET gp_balance = gp_balance + $1 WHERE LOWER(wallet_address) = LOWER($2)', [payout, auction.seller_wallet]);
      // Transfer item to winner
      await _transferItem(client, auction, auction.current_bidder_wallet);
      await client.query(
        "UPDATE auctions SET status = 'settled', settled_at = NOW() WHERE id = $1", [id]
      );
      await client.query('COMMIT');

      // ✅ Referral commission + season score for winner
      try {
        const { creditReferralCommission } = require('../db');
        const seasonSvc = require('./season');
        await creditReferralCommission(client, auction.current_bidder_wallet, 'auction_buy', auction.current_bid, 'gp');
        seasonSvc.addSeasonScore(auction.current_bidder_wallet, 'gp_spend', auction.current_bid).catch(() => {});
        seasonSvc.addSeasonScore(auction.current_bidder_wallet, 'trade', 1).catch(() => {});
      } catch (_re) {}

      // ✅ GP Activity log
      try { const { logGPActivity } = require('../db');
        logGPActivity(auction.current_bidder_wallet, -auction.current_bid, 'auction_buy', `auction #${id}`).catch(()=>{});
        logGPActivity(auction.seller_wallet, payout, 'auction_sell', `auction #${id}`).catch(()=>{});
      } catch (_le) {}

      // ✅ Daily mission progress: marketplace_trade
      try {
        const dailySvc = require('./daily');
        dailySvc.updateMissionProgress(auction.current_bidder_wallet, 'marketplace_trade', 1).catch(() => {});
      } catch (_de) {}

      // ✅ Notify winner
      try {
        const { notifyPlayer } = require('../db');
        notifyPlayer(auction.current_bidder_wallet, 'auction_won',
          `🎉 You won auction #${id}! Item transferred to your inventory.`,
          { auctionId: id, finalBid: auction.current_bid }
        ).catch(() => {});
      } catch (_ne) {}

      if (titleService) {
        _checkMarketplaceSalesTitle(auction.seller_wallet).catch(() => {});
      }
      console.log(`[AUCTION] #${id} settled. Winner: ${auction.current_bidder_wallet}, Payout: ${payout} GP`);
      return { success: true, settled: true, payout };
    } else {
      // 유찰: 에스크로 반환
      await _returnEscrow(client, auction, auction.seller_wallet);
      await client.query("UPDATE auctions SET status = 'no_bids', settled_at = NOW() WHERE id = $1", [id]);
      await client.query('COMMIT');
      console.log(`[AUCTION] #${id} expired with no bids`);
      return { success: true, settled: false, no_bids: true };
    }
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[AUCTION] settleAuction error:', err.message);
    return { success: false, error: 'internal_error' };
  } finally {
    client.release();
  }
}

// ─────────────────────────────────────────────────────────────
// 6. 만료된 옥션 일괄 정산 (스케줄러)
// ─────────────────────────────────────────────────────────────
async function settleExpiredAuctions() {
  const res = await pool.query(
    "SELECT id FROM auctions WHERE status = 'active' AND ends_at < NOW()"
  );
  for (const row of res.rows) {
    await settleAuction(row.id);
  }
  return res.rows.length;
}

// ─────────────────────────────────────────────────────────────
// 7. 조회
// ─────────────────────────────────────────────────────────────
async function getAuctions(filters = {}) {
  const { itemType, status = 'active', limit = 30, offset = 0 } = filters;
  const params = [status, parseInt(limit), parseInt(offset)];
  let where = 'a.status = $1';
  if (itemType) {
    where += ' AND a.item_type = $4';
    params.push(itemType);
  }
  const res = await pool.query(
    `SELECT a.*,
            us.nickname AS seller_nickname,
            ub.nickname AS bidder_nickname,
            it.name AS item_name, it.icon AS item_icon, it.code AS item_code
     FROM auctions a
     LEFT JOIN users us ON us.wallet_address = a.seller_wallet
     LEFT JOIN users ub ON ub.wallet_address = a.current_bidder_wallet
     LEFT JOIN item_instances ii ON ii.id = a.item_instance_id
     LEFT JOIN item_types it ON it.id = ii.item_type_id
     WHERE ${where}
     ORDER BY a.ends_at ASC
     LIMIT $2 OFFSET $3`,
    params
  );
  return res.rows;
}

async function getAuction(auctionId) {
  const [aRes, bRes] = await Promise.all([
    pool.query(
      `SELECT a.*,
              us.nickname AS seller_nickname,
              ub.nickname AS bidder_nickname,
              it.name AS item_name, it.icon AS item_icon, it.code AS item_code,
              c.width, c.height, c.sector_code AS claim_sector
       FROM auctions a
       LEFT JOIN users us ON us.wallet_address = a.seller_wallet
       LEFT JOIN users ub ON ub.wallet_address = a.current_bidder_wallet
       LEFT JOIN item_instances ii ON ii.id = a.item_instance_id
       LEFT JOIN item_types it ON it.id = ii.item_type_id
       LEFT JOIN claims c ON c.id = a.claim_id
       WHERE a.id = $1`,
      [parseInt(auctionId)]
    ),
    pool.query(
      `SELECT b.bid_amount, b.bidder_wallet, b.bid_at, b.is_winning,
              u.nickname AS bidder_nickname
       FROM bids b
       LEFT JOIN users u ON u.wallet_address = b.bidder_wallet
       WHERE b.auction_id = $1
       ORDER BY b.bid_at DESC LIMIT 20`,
      [parseInt(auctionId)]
    )
  ]);
  if (!aRes.rows.length) return null;
  return { ...aRes.rows[0], bids: bRes.rows };
}

async function getUserAuctions(wallet) {
  const w = wallet.toLowerCase();
  const res = await pool.query(
    `SELECT a.*,
            it.name AS item_name, it.icon AS item_icon
     FROM auctions a
     LEFT JOIN item_instances ii ON ii.id = a.item_instance_id
     LEFT JOIN item_types it ON it.id = ii.item_type_id
     WHERE LOWER(a.seller_wallet) = $1
        OR LOWER(a.winner_wallet) = $1
        OR EXISTS (SELECT 1 FROM bids b WHERE b.auction_id = a.id AND LOWER(b.bidder_wallet) = $1)
     ORDER BY a.created_at DESC LIMIT 50`,
    [w]
  );
  return res.rows;
}

// ─────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────
async function _transferItem(client, auction, buyerWallet) {
  const w = buyerWallet.toLowerCase();
  if (auction.item_instance_id) {
    await client.query('UPDATE item_instances SET wallet = $1 WHERE id = $2', [w, auction.item_instance_id]);
  } else if (auction.claim_id) {
    await client.query('UPDATE claims SET owner = $1, auction_locked = FALSE WHERE id = $2', [w, auction.claim_id]);
    await client.query('UPDATE pixels SET owner = $1 WHERE claim_id = $2', [w, auction.claim_id]);
  } else if (auction.resource_code) {
    await client.query(
      `INSERT INTO user_resource_inventory (wallet_address, resource_id, quantity)
       VALUES ($1, (SELECT id FROM resources WHERE code = $2), $3)
       ON CONFLICT (wallet_address, resource_id)
       DO UPDATE SET quantity = user_resource_inventory.quantity + $3`,
      [w, auction.resource_code, auction.resource_quantity]
    );
  }
}

async function _returnEscrow(client, auction, ownerWallet) {
  const w = ownerWallet.toLowerCase();
  if (auction.item_instance_id) {
    await client.query('UPDATE item_instances SET wallet = $1 WHERE id = $2', [w, auction.item_instance_id]);
  } else if (auction.claim_id) {
    await client.query('UPDATE claims SET auction_locked = FALSE WHERE id = $1', [auction.claim_id]);
  } else if (auction.resource_code) {
    await client.query(
      `INSERT INTO user_resource_inventory (wallet_address, resource_id, quantity)
       VALUES ($1, (SELECT id FROM resources WHERE code = $2), $3)
       ON CONFLICT (wallet_address, resource_id)
       DO UPDATE SET quantity = user_resource_inventory.quantity + $3`,
      [w, auction.resource_code, auction.resource_quantity]
    );
  }
}

async function _checkMarketplaceSalesTitle(sellerWallet) {
  if (!titleService) return;
  const res = await pool.query(
    "SELECT COUNT(*) AS cnt FROM auctions WHERE seller_wallet = $1 AND status = 'settled'",
    [sellerWallet.toLowerCase()]
  );
  const count = parseInt(res.rows[0]?.cnt ?? 0);
  await titleService.checkAndAwardTitles(sellerWallet, 'marketplace_sales', { count });
}

module.exports = {
  createAuction,
  placeBid,
  buyout,
  cancelAuction,
  settleAuction,
  settleExpiredAuctions,
  getAuctions,
  getAuction,
  getUserAuctions
};
