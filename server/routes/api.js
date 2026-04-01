const express = require('express');
const { ethers } = require('ethers');
const { pool, ensureUser } = require('../db');
const { generateWithdrawSignature, CHAINS } = require('../services/signer');

const router = express.Router();

const PIXEL_PRICE = 0.1;
const HIJACK_MULT = 1.2;
const GRID_SIZE = 0.22;
const SWAP_FEE = 0.05;

// ── Helpers ──

function snapGrid(val) {
  return Math.round(parseFloat(val) * 100) / 100;
}

function getClaimPixels(lat, lng, w, h) {
  const pixels = [];
  const halfW = w / 2, halfH = h / 2;
  for (let dy = 0; dy < h; dy++) {
    for (let dx = 0; dx < w; dx++) {
      const plat = Math.round((lat + (dy - halfH + 0.5) * GRID_SIZE) * 100) / 100;
      const plng = Math.round((lng + (dx - halfW + 0.5) * GRID_SIZE) * 100) / 100;
      if (plat >= -70 && plat <= 70) pixels.push({ lat: plat, lng: plng });
    }
  }
  return pixels;
}

// ══════════════════════════════════════════════════
//  GET /api/user/:wallet
// ══════════════════════════════════════════════════
router.get('/user/:wallet', async (req, res) => {
  try {
    const wallet = req.params.wallet.toLowerCase();
    const userRes = await pool.query('SELECT * FROM users WHERE wallet_address = $1', [wallet]);
    if (!userRes.rows.length) {
      return res.json({ usdtBalance: 0, ppBalance: 0, plots: [], totalDeposited: 0 });
    }
    const user = userRes.rows[0];

    const claimsRes = await pool.query(
      `SELECT center_lat, center_lng, width, height, image_url, link_url, total_paid
       FROM claims WHERE owner = $1 AND deleted_at IS NULL ORDER BY created_at DESC`,
      [wallet]
    );

    const depRes = await pool.query(
      'SELECT COALESCE(SUM(amount), 0) as total FROM deposits WHERE wallet_address = $1',
      [wallet]
    );

    res.json({
      usdtBalance: parseFloat(user.usdt_balance),
      ppBalance: parseFloat(user.pp_balance),
      plots: claimsRes.rows.map(c => ({
        lat: parseFloat(c.center_lat), lng: parseFloat(c.center_lng),
        width: c.width, height: c.height,
        imageUrl: c.image_url, linkUrl: c.link_url,
        price: parseFloat(c.total_paid)
      })),
      totalDeposited: parseFloat(depRes.rows[0].total)
    });
  } catch (e) {
    console.error('[API] user error:', e.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

// ══════════════════════════════════════════════════
//  GET /api/pixel/:lat/:lng
// ══════════════════════════════════════════════════
router.get('/pixel/:lat/:lng', async (req, res) => {
  try {
    const lat = snapGrid(req.params.lat);
    const lng = snapGrid(req.params.lng);

    const pxRes = await pool.query(
      'SELECT owner, price, claim_id FROM pixels WHERE lat = $1 AND lng = $2',
      [lat, lng]
    );

    if (!pxRes.rows.length) {
      return res.json({ owner: null, price: PIXEL_PRICE, claimId: null, imageUrl: null, linkUrl: null });
    }

    const px = pxRes.rows[0];
    let imageUrl = null, linkUrl = null;
    if (px.claim_id) {
      const claimRes = await pool.query('SELECT image_url, link_url FROM claims WHERE id = $1', [px.claim_id]);
      if (claimRes.rows.length) {
        imageUrl = claimRes.rows[0].image_url;
        linkUrl = claimRes.rows[0].link_url;
      }
    }

    res.json({
      owner: px.owner, price: parseFloat(px.price),
      claimId: px.claim_id, imageUrl, linkUrl
    });
  } catch (e) {
    console.error('[API] pixel error:', e.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

// ══════════════════════════════════════════════════
//  GET /api/search/owner/:query
// ══════════════════════════════════════════════════
router.get('/search/owner/:query', async (req, res) => {
  try {
    const q = req.params.query.toLowerCase();
    const result = await pool.query(
      `SELECT center_lat, center_lng, width, height, image_url, total_paid, owner
       FROM claims WHERE LOWER(owner) LIKE $1 AND deleted_at IS NULL
       ORDER BY created_at DESC LIMIT 50`,
      [`%${q}%`]
    );

    res.json(result.rows.map(r => ({
      lat: parseFloat(r.center_lat), lng: parseFloat(r.center_lng),
      width: r.width, height: r.height,
      imageUrl: r.image_url, price: parseFloat(r.total_paid), owner: r.owner
    })));
  } catch (e) {
    console.error('[API] search error:', e.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

// ══════════════════════════════════════════════════
//  GET /api/claims — all active claims (for frontend init)
// ══════════════════════════════════════════════════
router.get('/claims', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, owner, center_lat, center_lng, width, height, image_url, link_url, total_paid
       FROM claims WHERE deleted_at IS NULL ORDER BY created_at DESC LIMIT 5000`
    );
    res.json(result.rows.map(r => ({
      id: r.id, owner: r.owner,
      lat: parseFloat(r.center_lat), lng: parseFloat(r.center_lng),
      w: r.width, h: r.height,
      imgUrl: r.image_url, link: r.link_url,
      price: parseFloat(r.total_paid), label: r.owner.slice(0, 8)
    })));
  } catch (e) {
    console.error('[API] claims error:', e.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

// ══════════════════════════════════════════════════
//  POST /api/claim
// ══════════════════════════════════════════════════
router.post('/claim', async (req, res) => {
  const { wallet, lat, lng, width, height, imageUrl, linkUrl } = req.body;
  if (!wallet || lat == null || lng == null || !width || !height) {
    return res.status(400).json({ error: 'Missing fields' });
  }

  const w = parseInt(wallet.toLowerCase());
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    await ensureUser(client, wallet.toLowerCase());

    const pixels = getClaimPixels(parseFloat(lat), parseFloat(lng), parseInt(width), parseInt(height));
    if (!pixels.length) throw new Error('No pixels in range');

    // Lock and read all affected pixels
    let baseCost = 0, hijackCost = 0, overlapCount = 0, newCount = 0;
    const affectedOwners = {}; // owner → { refund, bonus }

    for (const p of pixels) {
      const pxRes = await client.query(
        'SELECT owner, price FROM pixels WHERE lat = $1 AND lng = $2 FOR UPDATE',
        [p.lat, p.lng]
      );

      if (pxRes.rows.length && pxRes.rows[0].owner) {
        const existing = pxRes.rows[0];
        const pxCost = parseFloat(existing.price) * HIJACK_MULT;
        hijackCost += pxCost;
        overlapCount++;
        const prevOwner = existing.owner;
        if (!affectedOwners[prevOwner]) affectedOwners[prevOwner] = { refund: 0, bonus: 0 };
        affectedOwners[prevOwner].refund += parseFloat(existing.price);
        affectedOwners[prevOwner].bonus += (pxCost - parseFloat(existing.price)) * 0.5;
      } else {
        baseCost += PIXEL_PRICE;
        newCount++;
      }
    }

    const totalCost = Math.round((baseCost + hijackCost) * 1000000) / 1000000;

    // Check user balance (PP first, then USDT)
    const userRes = await client.query(
      'SELECT usdt_balance, pp_balance FROM users WHERE wallet_address = $1 FOR UPDATE',
      [wallet.toLowerCase()]
    );
    const user = userRes.rows[0];
    let ppUsed = 0, usdtUsed = 0;
    const ppBal = parseFloat(user.pp_balance);
    const usdtBal = parseFloat(user.usdt_balance);

    if (ppBal >= totalCost) {
      ppUsed = totalCost;
    } else {
      ppUsed = ppBal;
      usdtUsed = totalCost - ppBal;
    }

    if (usdtUsed > usdtBal) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Insufficient balance', required: totalCost, usdtBalance: usdtBal, ppBalance: ppBal });
    }

    // Deduct from user
    await client.query(
      'UPDATE users SET pp_balance = pp_balance - $1, usdt_balance = usdt_balance - $2 WHERE wallet_address = $3',
      [ppUsed, usdtUsed, wallet.toLowerCase()]
    );

    // Credit hijacked owners (PP refund + bonus)
    for (const [owner, amounts] of Object.entries(affectedOwners)) {
      await client.query(
        'UPDATE users SET pp_balance = pp_balance + $1 WHERE wallet_address = $2',
        [amounts.refund + amounts.bonus, owner]
      );
    }

    // Insert claim
    const claimRes = await client.query(
      `INSERT INTO claims (owner, center_lat, center_lng, width, height, image_url, link_url, total_paid)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
      [wallet.toLowerCase(), lat, lng, width, height, imageUrl || null, linkUrl || null, totalCost]
    );
    const claimId = claimRes.rows[0].id;

    // Upsert all pixels
    for (const p of pixels) {
      const pxRes = await client.query(
        'SELECT owner, price FROM pixels WHERE lat = $1 AND lng = $2',
        [p.lat, p.lng]
      );
      const newPrice = (pxRes.rows.length && pxRes.rows[0].owner)
        ? parseFloat(pxRes.rows[0].price) * HIJACK_MULT
        : PIXEL_PRICE;

      await client.query(
        `INSERT INTO pixels (lat, lng, owner, price, claim_id, updated_at)
         VALUES ($1,$2,$3,$4,$5,NOW())
         ON CONFLICT (lat, lng) DO UPDATE SET owner=$3, price=$4, claim_id=$5, updated_at=NOW()`,
        [p.lat, p.lng, wallet.toLowerCase(), newPrice, claimId]
      );
    }

    // Transaction record
    await client.query(
      `INSERT INTO transactions (type, from_wallet, usdt_amount, pp_amount, fee, meta)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [
        overlapCount > 0 ? 'hijack' : 'claim',
        wallet.toLowerCase(),
        usdtUsed, ppUsed,
        baseCost, // new pixel revenue goes to treasury
        JSON.stringify({
          claimId, totalPixels: pixels.length, newCount, overlapCount,
          affectedOwners, hijackPremiumToTreasury: Object.values(affectedOwners).reduce((s, a) => s + (a.bonus), 0)
        })
      ]
    );

    await client.query('COMMIT');

    res.json({
      success: true, claimId, totalCost,
      newCount, overlapCount,
      ppUsed, usdtUsed
    });
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('[API] claim error:', e.message);
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
});

// ══════════════════════════════════════════════════
//  POST /api/swap — PP → USDT
// ══════════════════════════════════════════════════
router.post('/swap', async (req, res) => {
  const { wallet, ppAmount } = req.body;
  if (!wallet || !ppAmount || ppAmount <= 0) return res.status(400).json({ error: 'Invalid input' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const userRes = await client.query(
      'SELECT pp_balance FROM users WHERE wallet_address = $1 FOR UPDATE',
      [wallet.toLowerCase()]
    );
    if (!userRes.rows.length) throw new Error('User not found');

    const ppBal = parseFloat(userRes.rows[0].pp_balance);
    if (ppBal < ppAmount) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Insufficient PP', balance: ppBal });
    }

    const fee = Math.round(ppAmount * SWAP_FEE * 1000000) / 1000000;
    const received = Math.round((ppAmount - fee) * 1000000) / 1000000;

    await client.query(
      'UPDATE users SET pp_balance = pp_balance - $1, usdt_balance = usdt_balance + $2 WHERE wallet_address = $3',
      [ppAmount, received, wallet.toLowerCase()]
    );

    await client.query(
      `INSERT INTO transactions (type, from_wallet, usdt_amount, pp_amount, fee, meta)
       VALUES ('swap', $1, $2, $3, $4, $5)`,
      [wallet.toLowerCase(), received, ppAmount, fee, JSON.stringify({ swapRate: 1, feePercent: 5 })]
    );

    await client.query('COMMIT');
    res.json({ success: true, received, fee, ppDeducted: ppAmount });
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('[API] swap error:', e.message);
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
});

// ══════════════════════════════════════════════════
//  POST /api/withdraw — USDT withdrawal (server signs)
// ══════════════════════════════════════════════════
router.post('/withdraw', async (req, res) => {
  const { wallet, amount, chain } = req.body;
  if (!wallet || !amount || amount <= 0) return res.status(400).json({ error: 'Invalid input' });

  const chainKey = chain || 'base';
  const chainCfg = CHAINS[chainKey];
  if (!chainCfg) return res.status(400).json({ error: 'Invalid chain' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const userRes = await client.query(
      'SELECT usdt_balance FROM users WHERE wallet_address = $1 FOR UPDATE',
      [wallet.toLowerCase()]
    );
    if (!userRes.rows.length) throw new Error('User not found');

    const bal = parseFloat(userRes.rows[0].usdt_balance);
    if (bal < amount) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Insufficient balance', balance: bal });
    }

    // Deduct from DB
    await client.query(
      'UPDATE users SET usdt_balance = usdt_balance - $1 WHERE wallet_address = $2',
      [amount, wallet.toLowerCase()]
    );

    // Generate on-chain withdrawal signature
    const amountBN = ethers.utils.parseUnits(amount.toString(), chainCfg.decimals);
    const feeBN = ethers.BigNumber.from(0); // no fee on withdrawal for now
    const nonce = 0; // TODO: read from on-chain contract

    const sigData = await generateWithdrawSignature(
      wallet, amountBN, feeBN, nonce, chainKey
    );

    await client.query(
      `INSERT INTO transactions (type, from_wallet, usdt_amount, fee, meta)
       VALUES ('withdraw', $1, $2, 0, $3)`,
      [wallet.toLowerCase(), amount, JSON.stringify({ chain: chainKey, nonce, deadline: sigData.deadline })]
    );

    await client.query('COMMIT');
    res.json({ success: true, ...sigData });
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('[API] withdraw error:', e.message);
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
});

// ══════════════════════════════════════════════════
//  POST /api/withdraw-all — full withdrawal + pixel reset
// ══════════════════════════════════════════════════
router.post('/withdraw-all', async (req, res) => {
  const { wallet, chain } = req.body;
  if (!wallet) return res.status(400).json({ error: 'Missing wallet' });

  const chainKey = chain || 'base';
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const userRes = await client.query(
      'SELECT usdt_balance, pp_balance FROM users WHERE wallet_address = $1 FOR UPDATE',
      [wallet.toLowerCase()]
    );
    if (!userRes.rows.length) throw new Error('User not found');

    const usdtBal = parseFloat(userRes.rows[0].usdt_balance);
    const ppBal = parseFloat(userRes.rows[0].pp_balance);
    const ppFee = Math.round(ppBal * SWAP_FEE * 1000000) / 1000000;
    const totalOut = Math.round((usdtBal + ppBal - ppFee) * 1000000) / 1000000;

    if (totalOut <= 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Nothing to withdraw' });
    }

    // Zero balances
    await client.query(
      'UPDATE users SET usdt_balance = 0, pp_balance = 0 WHERE wallet_address = $1',
      [wallet.toLowerCase()]
    );

    // Reset owned pixels
    await client.query(
      "UPDATE pixels SET owner = NULL, price = $1, updated_at = NOW() WHERE owner = $2",
      [PIXEL_PRICE, wallet.toLowerCase()]
    );

    // Soft-delete claims
    await client.query(
      'UPDATE claims SET deleted_at = NOW() WHERE owner = $1 AND deleted_at IS NULL',
      [wallet.toLowerCase()]
    );

    // Generate signature
    const chainCfg = CHAINS[chainKey];
    const amountBN = ethers.utils.parseUnits(totalOut.toString(), chainCfg.decimals);
    const feeBN = ethers.utils.parseUnits(ppFee.toString(), chainCfg.decimals);
    const sigData = await generateWithdrawSignature(wallet, amountBN, feeBN, 0, chainKey);

    await client.query(
      `INSERT INTO transactions (type, from_wallet, usdt_amount, pp_amount, fee, meta)
       VALUES ('withdraw_all', $1, $2, $3, $4, $5)`,
      [wallet.toLowerCase(), usdtBal, ppBal, ppFee,
       JSON.stringify({ totalOut, chain: chainKey })]
    );

    await client.query('COMMIT');
    res.json({ success: true, totalOut, ppFee, ...sigData });
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('[API] withdraw-all error:', e.message);
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
});

module.exports = router;
