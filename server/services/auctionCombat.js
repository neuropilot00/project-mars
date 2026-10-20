// server/services/auction.js
// ═══════════════════════════════════════════════════════════════
// 옥션 서비스 (Migration 090)
//
// createAuction()      — 경매 생성 (에스크로 선취)
// placeBid()           — 입찰 (이전 최고가 즉시 환불 + 스나이핑 방지)
// buyout()             — 즉시 구매
// settleAuction()      — 낙찰 정산 (스케줄러)
// processAllAuctions() — 만료 경매 일괄 정산 (스케줄러)
// getAuctions()        — 경매 목록
// getMyAuctions()      — 내 경매/입찰 목록
// ═══════════════════════════════════════════════════════════════

const { pool } = require('../db');

function withEscrowReview(auction) {
  const review = auction.status === 'active' && Number(auction.escrow_version) !== 1;
  return { ...auction, escrow_review_required: review, read_only: review };
}

// ─── 헬퍼 ───

async function getSetting(key, fallback) {
  try {
    const { rows } = await pool.query(`SELECT value FROM settings WHERE key = $1`, [key]);
    return rows[0]?.value ?? fallback;
  } catch { return fallback; }
}
async function getFloat(key, fallback) { return parseFloat(await getSetting(key, fallback)) || fallback; }
async function getInt(key, fallback)   { return parseInt(await getSetting(key, fallback))   || fallback; }

// GP/PP 잔고 컬럼명 (실제 DB 기준)
async function getBalance(client, wallet, currency) {
  const col = currency === 'PP' ? 'pp_balance' : 'gp_balance';
  const { rows } = await client.query(
    `SELECT COALESCE(${col}, 0) AS balance FROM users WHERE wallet_address = $1`, [wallet]
  );
  return parseFloat(rows[0]?.balance || 0);
}

async function deductBalance(client, wallet, currency, amount) {
  if (!Number.isFinite(Number(amount)) || Number(amount) <= 0) throw new Error('INVALID_AMOUNT');
  const col = currency === 'PP' ? 'pp_balance' : 'gp_balance';
  const { rowCount } = await client.query(
    `UPDATE users SET ${col} = ${col} - $2 WHERE wallet_address = $1 AND ${col} >= $2`,
    [wallet, amount]
  );
  return rowCount > 0;
}

async function addBalance(client, wallet, currency, amount) {
  if (!Number.isFinite(Number(amount)) || Number(amount) < 0) throw new Error('INVALID_AMOUNT');
  const col = currency === 'PP' ? 'pp_balance' : 'gp_balance';
  await client.query(
    `UPDATE users SET ${col} = ${col} + $2 WHERE wallet_address = $1`,
    [wallet, amount]
  );
}

// Merchant 수수료 체크
async function getAuctionFee(walletAddress) {
  let fee = await getFloat('auction_fee_pct', 0.05);
  try {
    const jobService = require('./job');
    const isMerchant = await jobService.getJobBuff(walletAddress, 'merchant_auction_fee', null);
    if (isMerchant) fee = await getFloat('auction_merchant_fee_pct', 0.0325);
  } catch { }
  return fee;
}

// ─── 경매 생성 ───

async function createAuction(sellerWallet, params) {
  const {
    listing_type = 'item',
    item_instance_id, item_type_id, claim_id, resource_id, resource_quantity, ship_instance_id,
    bundle_currency, bundle_amount,
    start_price, currency = 'GP',
    buyout_price,
    duration_hours = 24,
  } = params;

  if (!Number.isFinite(Number(start_price)) || Number(start_price) <= 0) throw new Error('INVALID_START_PRICE');
  if (!['GP','PP'].includes(currency)) throw new Error('INVALID_CURRENCY');
  if (!['item','cosmetic','claim','resource','ship','currency'].includes(listing_type)) throw new Error('INVALID_ITEM_TYPE');
  if (buyout_price != null && (!Number.isFinite(Number(buyout_price)) || Number(buyout_price) < Number(start_price))) throw new Error('INVALID_BUYOUT_PRICE');

  // [경제v2 P3] 통화 번들(GP↔PP) 매물 검증 — 파는 통화는 입찰 통화와 달라야 함.
  if (listing_type === 'currency') {
    if (!['GP','PP'].includes(bundle_currency)) throw new Error('INVALID_BUNDLE_CURRENCY');
    if (bundle_currency === currency) throw new Error('BUNDLE_SAME_CURRENCY');
    if (!Number.isFinite(Number(bundle_amount)) || !(bundle_amount > 0)) throw new Error('INVALID_BUNDLE_AMOUNT');
    const enabled = String(await getSetting('currency_auction_enabled', 'true')) === 'true';
    if (!enabled) throw new Error('CURRENCY_AUCTION_DISABLED');
  }

  const minHours = await getInt('auction_min_duration_hours', 1);
  const maxHours = await getInt('auction_max_duration_hours', 72);
  if (!Number.isFinite(Number(duration_hours)) || duration_hours < minHours || duration_hours > maxHours) throw new Error('INVALID_DURATION');

  const maxPerUser = await getInt('auction_max_per_user', 10);

  const fee = await getAuctionFee(sellerWallet);
  if (!Number.isFinite(fee) || fee < 0) throw new Error('INVALID_FEE_CONFIGURATION');
  const endsAt = new Date(Date.now() + duration_hours * 3600000);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Same lock as marketplace/legacy auctions: serialize caps and all seller escrow.
    const seller = await client.query('SELECT wallet_address FROM users WHERE wallet_address=$1 FOR UPDATE', [sellerWallet]);
    if (!seller.rowCount) throw new Error('USER_NOT_FOUND');
    const { rows: countRows } = await client.query("SELECT COUNT(*) AS cnt FROM auctions WHERE seller_wallet=$1 AND status='active' AND escrow_version=1", [sellerWallet]);
    if (Number(countRows[0].cnt) >= maxPerUser) throw new Error('MAX_AUCTIONS_REACHED');

    // 에스크로: 경매 아이템 잠금 (타입별)
    if (listing_type === 'ship') {
      const { rowCount } = await client.query(
        `UPDATE ship_instances SET wallet_address = 'auction_escrow' WHERE id = $1 AND wallet_address = $2 AND status = 'docked'`,
        [ship_instance_id, sellerWallet]
      );
      if (!rowCount) throw new Error('SHIP_NOT_AVAILABLE');
    }
    if (listing_type === 'item' || listing_type === 'cosmetic') {
      const item = await client.query("UPDATE item_instances SET wallet='auction_escrow' WHERE id=$1 AND wallet=$2 RETURNING id", [item_instance_id, sellerWallet]);
      if (!item.rowCount) throw new Error('ITEM_NOT_AVAILABLE');
    }
    if (listing_type === 'claim') {
      const claim = await client.query('SELECT id FROM claims WHERE id=$1 AND owner=$2 AND deleted_at IS NULL AND NOT COALESCE(marketplace_locked,false) AND NOT COALESCE(auction_locked,false) FOR UPDATE', [claim_id, sellerWallet]);
      if (!claim.rowCount) throw new Error('CLAIM_NOT_AVAILABLE');
      await client.query('UPDATE claims SET auction_locked=true WHERE id=$1', [claim_id]);
    }
    if (listing_type === 'resource') {
      if (!Number.isSafeInteger(Number(resource_quantity)) || Number(resource_quantity) <= 0) throw new Error('INVALID_RESOURCE_QUANTITY');
      const resource = await client.query('SELECT id FROM resources WHERE id=$1 AND is_active=true AND is_tradeable=true', [resource_id]);
      if (!resource.rowCount) throw new Error('RESOURCE_NOT_AVAILABLE');
      const spent = await client.query('UPDATE user_resource_inventory SET quantity=quantity-$3 WHERE wallet_address=$1 AND resource_id=$2 AND quantity >= $3 RETURNING quantity', [sellerWallet, resource_id, resource_quantity]);
      if (!spent.rowCount) throw new Error('INSUFFICIENT_MATERIALS');
    }
    // [경제v2 P3] 통화 번들 에스크로 — 파는 통화(bundle_currency) 수량을 판매자 잔고에서 잠금.
    if (listing_type === 'currency') {
      const ok = await deductBalance(client, sellerWallet, bundle_currency, bundle_amount);
      if (!ok) throw new Error('INSUFFICIENT_BALANCE');
    }

    const { rows } = await client.query(`
      INSERT INTO auctions (
        seller_wallet, listing_type,
        item_instance_id, item_type_id, claim_id,
        resource_id, resource_quantity, ship_instance_id,
        bundle_currency, bundle_amount,
        start_price, currency, current_price, buyout_price,
        fee_pct, ends_at, escrow_version
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$11,$13,$14,$15,1)
      RETURNING *
    `, [
      sellerWallet, listing_type,
      (['item','cosmetic'].includes(listing_type) ? item_instance_id : null), (['item','cosmetic'].includes(listing_type) ? item_type_id || null : null), (listing_type === 'claim' ? claim_id : null),
      (listing_type === 'resource' ? resource_id : null), (listing_type === 'resource' ? resource_quantity : null), (listing_type === 'ship' ? ship_instance_id : null),
      (listing_type === 'currency' ? bundle_currency : null),
      (listing_type === 'currency' ? bundle_amount : null),
      start_price, currency,
      buyout_price || null, fee, endsAt,
    ]);

    await client.query('COMMIT');
    return rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ─── 입찰 ───

async function placeBid(bidderWallet, auctionId, bidAmount) {
  if (!Number.isFinite(Number(bidAmount)) || Number(bidAmount) <= 0) throw new Error('INVALID_BID_AMOUNT');
  // [v7.63] auction 읽기를 트랜잭션 내 FOR UPDATE로 이동 — 동시 입찰 시 이중 잔고 차감 방지
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: aRows } = await client.query(
      `SELECT * FROM auctions WHERE id = $1 AND status = 'active' FOR UPDATE`, [auctionId]
    );
    if (!aRows[0]) { await client.query('ROLLBACK'); throw new Error('AUCTION_NOT_FOUND'); }
    const auction = aRows[0];
    if (Number(auction.escrow_version) !== 1) throw new Error('ESCROW_REVIEW_REQUIRED');

    if (auction.seller_wallet === bidderWallet) { await client.query('ROLLBACK'); throw new Error('CANNOT_BID_OWN'); }
    if (new Date() > new Date(auction.ends_at)) { await client.query('ROLLBACK'); throw new Error('AUCTION_EXPIRED'); }

    const minIncrement = await getFloat(
      `auction_min_bid_${auction.currency.toLowerCase()}`, 1
    );
    const minBid = parseFloat(auction.current_price) + minIncrement;
    if (bidAmount < minBid) { await client.query('ROLLBACK'); throw new Error(`BID_TOO_LOW:${minBid}`); }

    // 입찰자 잔고 차감 (에스크로)
    const ok = await deductBalance(client, bidderWallet, auction.currency, bidAmount);
    if (!ok) throw new Error('INSUFFICIENT_BALANCE');

    // 이전 최고 입찰자 환불
    const { rows: prevBids } = await client.query(`
      SELECT * FROM bids WHERE auction_id = $1 AND is_winning = TRUE
    `, [auctionId]);
    if (prevBids[0]) {
      await addBalance(client, prevBids[0].bidder_wallet, auction.currency, prevBids[0].amount);
      await client.query(
        `UPDATE bids SET is_winning = FALSE, is_refunded = TRUE WHERE id = $1`, [prevBids[0].id]
      );
    }

    // 새 입찰 등록
    await client.query(`
      INSERT INTO bids (auction_id, bidder_wallet, amount, is_winning)
      VALUES ($1, $2, $3, TRUE)
    `, [auctionId, bidderWallet, bidAmount]);

    // 현재가 업데이트
    let newEndsAt = auction.ends_at;

    // 스나이핑 방지: 마감 N분 전 입찰 시 연장
    const antiSnipeMin    = await getInt('auction_anti_snipe_min', 5);
    const antiSnipeExtend = await getInt('auction_anti_snipe_extend', 5);
    const msUntilEnd = new Date(auction.ends_at) - new Date();
    if (msUntilEnd < antiSnipeMin * 60000) {
      newEndsAt = new Date(Date.now() + antiSnipeExtend * 60000);
    }

    await client.query(`
      UPDATE auctions SET
        current_price = $2,
        current_bid = $2,
        current_bidder_wallet = $4,
        ends_at = $3
      WHERE id = $1
    `, [auctionId, bidAmount, newEndsAt, bidderWallet]);

    await client.query('COMMIT');
    return {
      bid_placed: true,
      auction_id: auctionId,
      amount: bidAmount,
      new_ends_at: newEndsAt,
      extended: newEndsAt !== auction.ends_at,
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ─── 즉시 구매 ───

async function buyout(buyerWallet, auctionId) {
  return _finalizeAuction({ id: auctionId }, buyerWallet, true);
}

// All price, bid and expiry decisions are made under the auction row lock.
async function settleAuction(auctionId) {
  return _finalizeAuction({ id: auctionId }, null, false);
}

async function _finalizeAuction(reference, buyerWallet, isBuyout) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query('SELECT * FROM auctions WHERE id=$1 FOR UPDATE', [reference.id]);
    const auction = rows[0];
    if (!auction || auction.status !== 'active') {
      await client.query('ROLLBACK');
      if (isBuyout) throw new Error('AUCTION_NOT_FOUND');
      return { settled: 'already_finalized', auction_id: reference.id };
    }
    if (Number(auction.escrow_version) !== 1) throw new Error('ESCROW_REVIEW_REQUIRED');
    const expired = new Date(auction.ends_at) <= new Date();
    if (isBuyout && expired) throw new Error('AUCTION_EXPIRED');
    if (!isBuyout && !expired) { await client.query('ROLLBACK'); return null; }
    const { rows: winning } = await client.query('SELECT * FROM bids WHERE auction_id=$1 AND is_winning=TRUE AND is_refunded=FALSE FOR UPDATE', [auction.id]);
    const held = winning[0];
    if (!isBuyout && !held) {
      await _returnEscrowItem(client, auction);
      await client.query("UPDATE auctions SET status='expired' WHERE id=$1", [auction.id]);
      await client.query('COMMIT');
      return { settled: 'expired', auction_id: auction.id };
    }
    if (isBuyout && auction.seller_wallet === buyerWallet) throw new Error('CANNOT_BUY_OWN');
    const amount = Number(isBuyout ? auction.buyout_price : held.amount);
    if (!Number.isFinite(amount) || amount <= 0) throw new Error(isBuyout ? 'NO_BUYOUT_PRICE' : 'INVALID_BID_AMOUNT');
    if (!isBuyout) buyerWallet = held.bidder_wallet;

    let raw = Number(auction.fee_pct);
    if (!Number.isFinite(raw) || raw < 0) raw = 0;
    let fee = raw >= 1 ? raw / 100 : raw;
    if (fee > 0.5) fee = 0; // Preserve the existing malformed-fee fallback.
    const feeAmt = Math.floor(amount * fee * 100) / 100;
    const sellerGet = amount - feeAmt;
    if (isBuyout) {
      // A winning bid is partial escrow, not payment for a higher buyout price.
      const credit = held && held.bidder_wallet === buyerWallet ? Number(held.amount) : 0;
      const due = amount - credit;
      if (due > 0 && !await deductBalance(client, buyerWallet, auction.currency, due)) throw new Error('INSUFFICIENT_BALANCE');
      if (due < 0) await addBalance(client, buyerWallet, auction.currency, -due);
    }
    await addBalance(client, auction.seller_wallet, auction.currency, sellerGet);
    await _transferItem(client, auction, buyerWallet);
    // Only the currently held bid can be refunded. Earlier outbid rows were
    // already returned, including historical rows created before this fix.
    if (held && held.bidder_wallet !== buyerWallet) {
      await addBalance(client, held.bidder_wallet, auction.currency, held.amount);
      await client.query('UPDATE bids SET is_refunded=TRUE,is_winning=FALSE WHERE id=$1', [held.id]);
    }
    await client.query("UPDATE auctions SET status='sold',winner_wallet=$2,final_price=$3,sold_at=NOW() WHERE id=$1", [auction.id, buyerWallet, amount]);
    await client.query('COMMIT');
    return { settled: 'sold', auction_id: auction.id, buyer: buyerWallet, final_price: amount, seller_received: sellerGet, fee: feeAmt };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function _transferItem(client, auction, buyerWallet) {
  let transferred;
  switch (auction.listing_type) {
    case 'ship':
      if (auction.ship_instance_id) {
        transferred = await client.query(
          `UPDATE ship_instances SET wallet_address = $2, status = 'docked' WHERE id = $1 AND wallet_address = 'auction_escrow'`,
          [auction.ship_instance_id, buyerWallet]
        );
        if (!transferred.rowCount) throw new Error('ASSET_NOT_ESCROWED');
      }
      break;
    case 'claim':
      if (auction.claim_id) {
        transferred = await client.query(
          `UPDATE claims SET owner = $2, auction_locked = FALSE WHERE id = $1 AND owner=$3 AND auction_locked=TRUE`,
          [auction.claim_id, buyerWallet, auction.seller_wallet]
        );
        if (!transferred.rowCount) throw new Error('ASSET_NOT_ESCROWED');
        await client.query('UPDATE pixels SET owner=$2 WHERE claim_id=$1', [auction.claim_id, buyerWallet]);
      }
      break;
    case 'resource':
      if (auction.resource_id && auction.resource_quantity) {
        await client.query(`
          INSERT INTO user_resource_inventory (wallet_address, resource_id, quantity)
          VALUES ($1, $2, $3)
          ON CONFLICT (wallet_address, resource_id)
          DO UPDATE SET quantity = user_resource_inventory.quantity + $3
        `, [buyerWallet, auction.resource_id, auction.resource_quantity]);
      }
      break;
    case 'currency':
      // [경제v2 P3] 낙찰자에게 번들 통화 지급. addBalance 는 pp_balance/gp_balance 만 갱신 →
      //   매수한 PP 는 redeemable_pp(환매 버킷)에 적립되지 않아 비환매 유지(모델 정합).
      if (auction.bundle_currency && auction.bundle_amount) {
        await addBalance(client, buyerWallet, auction.bundle_currency, parseFloat(auction.bundle_amount));
      }
      break;
    default:
      // cosmetic/item: item_instance 소유권 이전
      if (auction.item_instance_id) {
        transferred = await client.query(
          `UPDATE item_instances SET wallet = $2 WHERE id = $1 AND wallet='auction_escrow'`,
          [auction.item_instance_id, buyerWallet]
        );
        if (!transferred.rowCount) throw new Error('ASSET_NOT_ESCROWED');
      }
  }
}

async function _returnEscrowItem(client, auction) {
  if (auction.listing_type === 'ship' && auction.ship_instance_id) {
    await client.query("UPDATE ship_instances SET wallet_address=$2,status='docked' WHERE id=$1 AND wallet_address='auction_escrow'", [auction.ship_instance_id, auction.seller_wallet]);
  } else if (auction.listing_type === 'currency' && auction.bundle_currency && auction.bundle_amount) {
    await addBalance(client, auction.seller_wallet, auction.bundle_currency, Number(auction.bundle_amount));
  } else if (auction.listing_type === 'resource' && auction.resource_id) {
    await client.query(`INSERT INTO user_resource_inventory(wallet_address,resource_id,quantity) VALUES($1,$2,$3)
      ON CONFLICT(wallet_address,resource_id) DO UPDATE SET quantity=user_resource_inventory.quantity+EXCLUDED.quantity`, [auction.seller_wallet, auction.resource_id, auction.resource_quantity]);
  } else if (auction.listing_type === 'claim' && auction.claim_id) {
    await client.query('UPDATE claims SET auction_locked=false WHERE id=$1 AND owner=$2', [auction.claim_id, auction.seller_wallet]);
  } else if (auction.item_instance_id) {
    await client.query("UPDATE item_instances SET wallet=$2 WHERE id=$1 AND wallet='auction_escrow'", [auction.item_instance_id, auction.seller_wallet]);
  }
}

// ─── 스케줄러 ───

async function processAllAuctions() {
  const { rows: expired } = await pool.query(`
    SELECT id FROM auctions WHERE status = 'active' AND escrow_version = 1 AND ends_at <= NOW()
  `);
  let settled = 0;
  for (const a of expired) {
    await settleAuction(a.id).catch(err =>
      console.error(`[auction] settle error ${a.id}:`, err.message)
    );
    settled++;
  }
  return settled;
}

// ─── 조회 ───

async function getAuctions({ listing_type, currency, page = 1, limit = 20 } = {}) {
  const offset = (page - 1) * limit;
  const params = [];
  let where = `WHERE a.status = 'active'`;
  if (listing_type) { params.push(listing_type); where += ` AND a.listing_type = $${params.length}`; }
  if (currency)     { params.push(currency);     where += ` AND a.currency = $${params.length}`; }

  params.push(limit, offset);
  const { rows } = await pool.query(`
    SELECT a.*,
           u.nickname AS seller_nickname,
           it.name AS item_name,
           it.icon AS item_icon,
           ii.enhancement_level,
           r.code AS resource_code,
           r.name_en AS resource_name,
           (SELECT COUNT(*) FROM bids b WHERE b.auction_id = a.id) AS bid_count,
           EXTRACT(EPOCH FROM (a.ends_at - NOW()))::INT AS seconds_remaining
    FROM auctions a
    LEFT JOIN users u ON u.wallet_address = a.seller_wallet
    LEFT JOIN item_instances ii ON ii.id = a.item_instance_id
    LEFT JOIN item_types it ON it.id = ii.item_type_id
    LEFT JOIN resources r ON r.id = a.resource_id
    ${where}
    ORDER BY a.ends_at ASC
    LIMIT $${params.length - 1} OFFSET $${params.length}
  `, params);
  return rows.map(withEscrowReview);
}

async function getMyAuctions(walletAddress) {
  const { rows: selling } = await pool.query(`
    SELECT a.*,
           it.name AS item_name,
           it.icon AS item_icon,
           ii.enhancement_level,
           r.code AS resource_code,
           r.name_en AS resource_name,
           (SELECT COUNT(*) FROM bids b WHERE b.auction_id = a.id) AS bid_count,
           EXTRACT(EPOCH FROM (a.ends_at - NOW()))::INT AS seconds_remaining
    FROM auctions a
    LEFT JOIN item_instances ii ON ii.id = a.item_instance_id
    LEFT JOIN item_types it ON it.id = ii.item_type_id
    LEFT JOIN resources r ON r.id = a.resource_id
    WHERE a.seller_wallet = $1
    ORDER BY a.created_at DESC LIMIT 20
  `, [walletAddress]);

  const { rows: bidding } = await pool.query(`
    SELECT a.*, b.amount AS my_bid, b.is_winning,
           it.name AS item_name,
           it.icon AS item_icon,
           ii.enhancement_level,
           r.code AS resource_code,
           r.name_en AS resource_name,
           EXTRACT(EPOCH FROM (a.ends_at - NOW()))::INT AS seconds_remaining
    FROM bids b
    JOIN auctions a ON a.id = b.auction_id
    LEFT JOIN item_instances ii ON ii.id = a.item_instance_id
    LEFT JOIN item_types it ON it.id = ii.item_type_id
    LEFT JOIN resources r ON r.id = a.resource_id
    WHERE b.bidder_wallet = $1
    ORDER BY b.created_at DESC LIMIT 20
  `, [walletAddress]);

  return { selling: selling.map(withEscrowReview), bidding: bidding.map(withEscrowReview) };
}

async function getAuctionDetail(auctionId) {
  const { rows: aRows } = await pool.query(`
    SELECT a.*, u.nickname AS seller_nickname,
           it.name AS item_name,
           it.icon AS item_icon,
           ii.enhancement_level,
           r.code AS resource_code,
           r.name_en AS resource_name
    FROM auctions a
    LEFT JOIN users u ON u.wallet_address = a.seller_wallet
    LEFT JOIN item_instances ii ON ii.id = a.item_instance_id
    LEFT JOIN item_types it ON it.id = ii.item_type_id
    LEFT JOIN resources r ON r.id = a.resource_id
    WHERE a.id = $1
  `, [auctionId]);
  if (!aRows[0]) return null;

  const { rows: bids } = await pool.query(`
    SELECT b.amount, b.is_winning, b.created_at, u.nickname
    FROM bids b
    LEFT JOIN users u ON u.wallet_address = b.bidder_wallet
    WHERE b.auction_id = $1
    ORDER BY b.amount DESC LIMIT 10
  `, [auctionId]);

  return { auction: withEscrowReview(aRows[0]), bids };
}

// ─── 취소 (입찰 없을 때만, 에스크로 환불) ───
// [경제v2 P3] 프론트 경매를 auctionCombat 으로 일원화하면서 cancel 추가(기존 auction.js 정책 동일: 입찰 0건만).
async function cancelAuction(walletAddress, auctionId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `SELECT * FROM auctions WHERE id = $1 AND status = 'active' FOR UPDATE`, [auctionId]
    );
    if (!rows[0]) { await client.query('ROLLBACK'); throw new Error('AUCTION_NOT_FOUND'); }
    const a = rows[0];
    if (Number(a.escrow_version) !== 1) throw new Error('ESCROW_REVIEW_REQUIRED');
    if (a.seller_wallet !== walletAddress) { await client.query('ROLLBACK'); throw new Error('NOT_OWNER'); }
    const { rows: bc } = await client.query(
      `SELECT COUNT(*)::int AS c FROM bids WHERE auction_id = $1 AND is_refunded = FALSE`, [auctionId]
    );
    if (bc[0].c > 0) { await client.query('ROLLBACK'); throw new Error('HAS_BIDS'); }

    await _returnEscrowItem(client, a);
    await client.query(`UPDATE auctions SET status = 'cancelled' WHERE id = $1`, [auctionId]);
    await client.query('COMMIT');
    return { cancelled: true, auction_id: auctionId };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

module.exports = {
  createAuction,
  placeBid,
  buyout,
  cancelAuction,
  settleAuction,
  processAllAuctions,
  getAuctions,
  getMyAuctions,
  getAuctionDetail,
};
