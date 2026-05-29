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
  const col = currency === 'PP' ? 'pp_balance' : 'gp_balance';
  const { rowCount } = await client.query(
    `UPDATE users SET ${col} = ${col} - $2 WHERE wallet_address = $1 AND ${col} >= $2`,
    [wallet, amount]
  );
  return rowCount > 0;
}

async function addBalance(client, wallet, currency, amount) {
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

  if (!start_price || start_price <= 0) throw new Error('INVALID_START_PRICE');
  if (!['GP','PP'].includes(currency)) throw new Error('INVALID_CURRENCY');

  // [경제v2 P3] 통화 번들(GP↔PP) 매물 검증 — 파는 통화는 입찰 통화와 달라야 함.
  if (listing_type === 'currency') {
    if (!['GP','PP'].includes(bundle_currency)) throw new Error('INVALID_BUNDLE_CURRENCY');
    if (bundle_currency === currency) throw new Error('BUNDLE_SAME_CURRENCY');
    if (!(bundle_amount > 0)) throw new Error('INVALID_BUNDLE_AMOUNT');
    const enabled = String(await getSetting('currency_auction_enabled', 'true')) === 'true';
    if (!enabled) throw new Error('CURRENCY_AUCTION_DISABLED');
  }

  const minHours = await getInt('auction_min_duration_hours', 1);
  const maxHours = await getInt('auction_max_duration_hours', 72);
  if (duration_hours < minHours || duration_hours > maxHours) throw new Error('INVALID_DURATION');

  const maxPerUser = await getInt('auction_max_per_user', 10);
  const { rows: countRows } = await pool.query(
    `SELECT COUNT(*) AS cnt FROM auctions WHERE seller_wallet = $1 AND status = 'active'`,
    [sellerWallet]
  );
  if (parseInt(countRows[0].cnt) >= maxPerUser) throw new Error('MAX_AUCTIONS_REACHED');

  const fee = await getAuctionFee(sellerWallet);
  const endsAt = new Date(Date.now() + duration_hours * 3600000);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 에스크로: 경매 아이템 잠금 (타입별)
    if (listing_type === 'ship' && ship_instance_id) {
      const { rowCount } = await client.query(
        `UPDATE ship_instances SET status = 'docked' WHERE id = $1 AND wallet_address = $2 AND status = 'docked'`,
        [ship_instance_id, sellerWallet]
      );
      if (!rowCount) throw new Error('SHIP_NOT_AVAILABLE');
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
        fee_pct, ends_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$11,$13,$14,$15)
      RETURNING *
    `, [
      sellerWallet, listing_type,
      item_instance_id || null, item_type_id || null, claim_id || null,
      resource_id || null, resource_quantity || null, ship_instance_id || null,
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
  // [v7.63] auction 읽기를 트랜잭션 내 FOR UPDATE로 이동 — 동시 입찰 시 이중 잔고 차감 방지
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: aRows } = await client.query(
      `SELECT * FROM auctions WHERE id = $1 AND status = 'active' FOR UPDATE`, [auctionId]
    );
    if (!aRows[0]) { await client.query('ROLLBACK'); throw new Error('AUCTION_NOT_FOUND'); }
    const auction = aRows[0];

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
        `UPDATE bids SET is_winning = FALSE WHERE id = $1`, [prevBids[0].id]
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
      UPDATE auctions SET current_price = $2, ends_at = $3
      WHERE id = $1
    `, [auctionId, bidAmount, newEndsAt]);

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
  const { rows: aRows } = await pool.query(
    `SELECT * FROM auctions WHERE id = $1 AND status = 'active'`, [auctionId]
  );
  if (!aRows[0]) throw new Error('AUCTION_NOT_FOUND');
  const auction = aRows[0];

  if (!auction.buyout_price) throw new Error('NO_BUYOUT_PRICE');
  if (auction.seller_wallet === buyerWallet) throw new Error('CANNOT_BUY_OWN');

  return await _finalizeAuction(auction, buyerWallet, auction.buyout_price);
}

// ─── 낙찰 정산 ───

async function settleAuction(auctionId) {
  const { rows: aRows } = await pool.query(
    `SELECT * FROM auctions WHERE id = $1 AND status = 'active' AND ends_at <= NOW()`,
    [auctionId]
  );
  if (!aRows[0]) return null;
  const auction = aRows[0];

  // 최고 입찰자 확인
  const { rows: topBid } = await pool.query(`
    SELECT * FROM bids WHERE auction_id = $1 AND is_winning = TRUE LIMIT 1
  `, [auctionId]);

  if (!topBid[0]) {
    // 입찰 없음 → 경매 만료
    await pool.query(
      `UPDATE auctions SET status = 'expired' WHERE id = $1`, [auctionId]
    );
    // 에스크로 아이템 반환
    await _returnEscrowItem(auction);
    return { settled: 'expired', auction_id: auctionId };
  }

  return await _finalizeAuction(auction, topBid[0].bidder_wallet, topBid[0].amount);
}

async function _finalizeAuction(auction, buyerWallet, amount) {
  // [v7.166] fee_pct 두 컨벤션(fraction 0~1 vs percent 0~100) 자동 정규화.
  //   값이 >= 1 이면 percent 로 간주해 /100, 아니면 fraction 그대로. 컨벤션 혼선·admin 오타에 견고.
  //   최대 50% 안전 clamp(>0.5 fraction → 0 적용).
  let raw = parseFloat(auction.fee_pct);
  if (!isFinite(raw) || raw < 0) raw = 0;
  let fee = raw >= 1 ? raw / 100 : raw;
  if (fee > 0.5) {
    console.warn('[auctionCombat] fee_pct misconfigured (>50%):', raw, '→ 0 적용');
    fee = 0;
  }
  const feeAmt   = Math.floor(amount * fee * 100) / 100;
  const sellerGet = amount - feeAmt;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // [v7.63] 이중 정산 방지: FOR UPDATE로 경매 행 잠금 후 status 재확인
    const { rows: lockRows } = await client.query(
      `SELECT status FROM auctions WHERE id = $1 FOR UPDATE`, [auction.id]
    );
    if (!lockRows[0] || !['active', 'ended'].includes(lockRows[0].status)) {
      await client.query('ROLLBACK');
      return { settled: 'already_finalized', auction_id: auction.id };
    }

    // 즉시구매인 경우 구매자 잔고 차감
    const existingBid = await client.query(`
      SELECT id, amount FROM bids
      WHERE auction_id = $1 AND bidder_wallet = $2 AND is_winning = TRUE
    `, [auction.id, buyerWallet]);

    if (!existingBid.rows[0]) {
      // 즉시구매: 에스크로 없었으므로 차감
      const ok = await deductBalance(client, buyerWallet, auction.currency, amount);
      if (!ok) throw new Error('INSUFFICIENT_BALANCE');
    }

    // 판매자 지급
    await addBalance(client, auction.seller_wallet, auction.currency, sellerGet);

    // 아이템 소유권 이전
    await _transferItem(client, auction, buyerWallet);

    // 낙찰 처리 — AND status IN ('active','ended') 로 이중 UPDATE 방지 [v7.63]
    const { rowCount } = await client.query(`
      UPDATE auctions SET
        status = 'sold', winner_wallet = $2, final_price = $3, sold_at = NOW()
      WHERE id = $1 AND status IN ('active', 'ended')
    `, [auction.id, buyerWallet, amount]);
    if (rowCount === 0) {
      await client.query('ROLLBACK');
      return { settled: 'already_finalized', auction_id: auction.id };
    }

    // 다른 입찰자 전원 환불
    const { rows: otherBids } = await client.query(`
      SELECT * FROM bids
      WHERE auction_id = $1 AND bidder_wallet != $2 AND is_refunded = FALSE
    `, [auction.id, buyerWallet]);
    for (const bid of otherBids) {
      await addBalance(client, bid.bidder_wallet, auction.currency, bid.amount);
      await client.query(`UPDATE bids SET is_refunded = TRUE WHERE id = $1`, [bid.id]);
    }

    await client.query('COMMIT');
    return {
      settled: 'sold', auction_id: auction.id,
      buyer: buyerWallet, final_price: amount,
      seller_received: sellerGet, fee: feeAmt,
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function _transferItem(client, auction, buyerWallet) {
  switch (auction.listing_type) {
    case 'ship':
      if (auction.ship_instance_id) {
        await client.query(
          `UPDATE ship_instances SET wallet_address = $2 WHERE id = $1`,
          [auction.ship_instance_id, buyerWallet]
        );
      }
      break;
    case 'claim':
      if (auction.claim_id) {
        await client.query(
          `UPDATE claims SET owner = $2 WHERE id = $1`,
          [auction.claim_id, buyerWallet]
        );
      }
      break;
    case 'resource':
      if (auction.resource_id && auction.resource_quantity) {
        await client.query(`
          INSERT INTO user_resource_inventory (wallet_address, resource_id, quantity)
          VALUES ($1, $2, $3)
          ON CONFLICT (wallet_address, resource_id)
          DO UPDATE SET quantity = user_resource_inventory.quantity + $3
        `, [buyerWallet, auction.resource_id, auction.resource_quantity]).catch(() => {});
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
        await client.query(
          `UPDATE item_instances SET wallet = $2 WHERE id = $1`,
          [auction.item_instance_id, buyerWallet]
        ).catch(() => {});
      }
  }
}

async function _returnEscrowItem(auction) {
  if (auction.listing_type === 'ship' && auction.ship_instance_id) {
    await pool.query(
      `UPDATE ship_instances SET status = 'docked' WHERE id = $1`, [auction.ship_instance_id]
    ).catch(() => {});
  }
  // [경제v2 P3] 통화 번들 유찰 시 판매자에게 에스크로 통화 환불.
  if (auction.listing_type === 'currency' && auction.bundle_currency && auction.bundle_amount) {
    const col = auction.bundle_currency === 'PP' ? 'pp_balance' : 'gp_balance';
    await pool.query(
      `UPDATE users SET ${col} = COALESCE(${col},0) + $1 WHERE LOWER(wallet_address) = LOWER($2)`,
      [parseFloat(auction.bundle_amount), auction.seller_wallet]
    ).catch(() => {});
  }
}

// ─── 스케줄러 ───

async function processAllAuctions() {
  const { rows: expired } = await pool.query(`
    SELECT id FROM auctions WHERE status = 'active' AND ends_at <= NOW()
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
           (SELECT COUNT(*) FROM bids b WHERE b.auction_id = a.id) AS bid_count,
           EXTRACT(EPOCH FROM (a.ends_at - NOW()))::INT AS seconds_remaining
    FROM auctions a
    LEFT JOIN users u ON u.wallet_address = a.seller_wallet
    ${where}
    ORDER BY a.ends_at ASC
    LIMIT $${params.length - 1} OFFSET $${params.length}
  `, params);
  return rows;
}

async function getMyAuctions(walletAddress) {
  const { rows: selling } = await pool.query(`
    SELECT a.*,
           (SELECT COUNT(*) FROM bids b WHERE b.auction_id = a.id) AS bid_count,
           EXTRACT(EPOCH FROM (a.ends_at - NOW()))::INT AS seconds_remaining
    FROM auctions a
    WHERE a.seller_wallet = $1
    ORDER BY a.created_at DESC LIMIT 20
  `, [walletAddress]);

  const { rows: bidding } = await pool.query(`
    SELECT a.*, b.amount AS my_bid, b.is_winning,
           EXTRACT(EPOCH FROM (a.ends_at - NOW()))::INT AS seconds_remaining
    FROM bids b
    JOIN auctions a ON a.id = b.auction_id
    WHERE b.bidder_wallet = $1
    ORDER BY b.created_at DESC LIMIT 20
  `, [walletAddress]);

  return { selling, bidding };
}

async function getAuctionDetail(auctionId) {
  const { rows: aRows } = await pool.query(`
    SELECT a.*, u.nickname AS seller_nickname
    FROM auctions a
    LEFT JOIN users u ON u.wallet_address = a.seller_wallet
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

  return { auction: aRows[0], bids };
}

module.exports = {
  createAuction,
  placeBid,
  buyout,
  settleAuction,
  processAllAuctions,
  getAuctions,
  getMyAuctions,
  getAuctionDetail,
};
