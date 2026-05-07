// server/routes/bounty.js
// ═══════════════════════════════════════════════════════════════
// 현상금 게시판 (Bounty Board) 라우트
//
// GET  /api/bounty/list             — 활성 현상금 목록
// GET  /api/bounty/my-bounties      — 내가 건 현상금
// GET  /api/bounty/on-me            — 나에게 걸린 현상금
// POST /api/bounty/post             — 현상금 등록 (GP 예치)
// POST /api/bounty/claim            — 전투 승리 후 현상금 수령
// POST /api/bounty/cancel/:id       — 현상금 취소 (만료 전, GP 반환)
// GET  /api/sectors/conflict-map    — 섹터별 갈등 현황 (지구본 오버레이용)
// ═══════════════════════════════════════════════════════════════

const express = require('express');
const router = express.Router();
const { pool, getSetting } = require('../db');

function getWallet(req) {
  return (req.body?.wallet || req.headers['x-wallet'] || req.query.wallet || '').toLowerCase().trim();
}

// ── GET /api/bounty/list ──────────────────────────────────────
router.get('/list', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);
    const { rows } = await pool.query(
      `SELECT bl.id, bl.poster_wallet, bl.target_wallet,
              bl.reward_gp, bl.reason, bl.status, bl.expires_at, bl.created_at,
              u_poster.faction_code AS poster_faction,
              u_target.faction_code AS target_faction,
              (SELECT COUNT(*) FROM fleet_battle_participants fbp
               JOIN fleet_battles fb ON fb.id = fbp.battle_id
               WHERE LOWER(fbp.wallet_address) = bl.target_wallet
                 AND fb.winner_side = fbp.side AND fb.status = 'ended') AS target_wins
       FROM bounty_listings bl
       LEFT JOIN users u_poster ON LOWER(u_poster.wallet_address) = bl.poster_wallet
       LEFT JOIN users u_target ON LOWER(u_target.wallet_address) = bl.target_wallet
       WHERE bl.status = 'active' AND bl.expires_at > NOW()
       ORDER BY bl.reward_gp DESC, bl.created_at DESC
       LIMIT $1`,
      [limit]
    );
    res.json({ success: true, bounties: rows });
  } catch (err) {
    console.error('[bounty] list error:', err.message);
    res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

// ── GET /api/bounty/my-bounties ───────────────────────────────
router.get('/my-bounties', async (req, res) => {
  try {
    const wallet = getWallet(req);
    if (!wallet || wallet.length < 5) return res.status(400).json({ error: 'INVALID_WALLET' });

    const { rows } = await pool.query(
      `SELECT id, target_wallet, reward_gp, reason, status,
              claimed_by, claimed_at, expires_at, created_at
       FROM bounty_listings WHERE poster_wallet = $1
       ORDER BY created_at DESC LIMIT 20`,
      [wallet]
    );
    res.json({ success: true, bounties: rows });
  } catch (err) {
    res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

// ── GET /api/bounty/on-me ─────────────────────────────────────
router.get('/on-me', async (req, res) => {
  try {
    const wallet = getWallet(req);
    if (!wallet || wallet.length < 5) return res.status(400).json({ error: 'INVALID_WALLET' });

    const { rows } = await pool.query(
      `SELECT id, poster_wallet, reward_gp, reason, status, expires_at, created_at
       FROM bounty_listings
       WHERE target_wallet = $1 AND status = 'active' AND expires_at > NOW()
       ORDER BY reward_gp DESC`,
      [wallet]
    );
    const total = rows.reduce((s, r) => s + r.reward_gp, 0);
    res.json({ success: true, bounties: rows, total_on_me: total });
  } catch (err) {
    res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

// ── POST /api/bounty/post ─────────────────────────────────────
router.post('/post', async (req, res) => {
  try {
    const wallet = getWallet(req);
    const { target_wallet, reward_gp, reason } = req.body || {};
    if (!wallet || wallet.length < 5) return res.status(400).json({ error: 'INVALID_WALLET' });
    if (!target_wallet) return res.status(400).json({ error: 'TARGET_REQUIRED' });

    const target = target_wallet.toLowerCase().trim();
    if (target === wallet) return res.status(400).json({ error: 'CANNOT_BOUNTY_SELF' });

    const minGP  = parseInt(await getSetting('min_bounty_gp',  '100'))  || 100;
    const maxGP  = parseInt(await getSetting('max_bounty_gp',  '10000'))|| 10000;
    const maxBounties = parseInt(await getSetting('max_bounties_per_poster', '3')) || 3;
    const feePct = parseFloat(await getSetting('platform_fee_pct', '5')) || 5;
    const expiryDays = parseInt(await getSetting('expiry_days', '7')) || 7;

    const gp = parseInt(reward_gp);
    if (!gp || gp < minGP || gp > maxGP) {
      return res.status(400).json({ error: 'INVALID_BOUNTY_AMOUNT', min: minGP, max: maxGP });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 현재 활성 현상금 수 체크
      const { rows: existing } = await client.query(
        `SELECT COUNT(*) FROM bounty_listings WHERE poster_wallet = $1 AND status = 'active' AND expires_at > NOW()`,
        [wallet]
      );
      if (parseInt(existing[0].count) >= maxBounties) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: 'MAX_BOUNTIES_REACHED', max: maxBounties });
      }

      // 잔액 체크 + GP 차감
      const { rows: userRows } = await client.query(
        `SELECT gp_balance FROM users WHERE LOWER(wallet_address) = $1 FOR UPDATE`,
        [wallet]
      );
      if (!userRows[0]) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'USER_NOT_FOUND' }); }
      if (userRows[0].gp_balance < gp) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'INSUFFICIENT_GP', balance: userRows[0].gp_balance, required: gp });
      }

      const deductBounty = await client.query(
        `UPDATE users SET gp_balance = gp_balance - $1 WHERE LOWER(wallet_address) = LOWER($2) AND gp_balance >= $1`,
        [gp, wallet]
      );
      if (deductBounty.rowCount === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'INSUFFICIENT_GP (concurrent modification)' });
      }

      // 현상금 등록
      const { rows: newBounty } = await client.query(
        `INSERT INTO bounty_listings (poster_wallet, target_wallet, reward_gp, reason, expires_at)
         VALUES ($1, $2, $3, $4, NOW() + ($5 || ' days')::INTERVAL)
         RETURNING id, reward_gp, expires_at`,
        [wallet, target, gp, reason || null, expiryDays]
      );

      await client.query('COMMIT');

      // GP 활동 로그
      try {
        const { logGPActivity } = require('../db');
        logGPActivity(wallet, -gp, 'bounty_post', `현상금 등록: ${target} 대상 ${gp} GP`).catch(() => {});
      } catch (_) {}

      res.json({ success: true, bounty: newBounty[0] });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('[bounty] post error:', err.message);
    res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

// ── POST /api/bounty/claim ────────────────────────────────────
// 전투 승리 후 대상 지갑에 걸린 현상금 수령
router.post('/claim', async (req, res) => {
  try {
    const wallet = getWallet(req);
    const { battle_id, target_wallet } = req.body || {};
    if (!wallet || wallet.length < 5) return res.status(400).json({ error: 'INVALID_WALLET' });
    if (!battle_id || !target_wallet) return res.status(400).json({ error: 'BATTLE_ID_AND_TARGET_REQUIRED' });

    const target = target_wallet.toLowerCase().trim();
    const feePct = parseFloat(await getSetting('platform_fee_pct', '5')) || 5;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 전투 승리 검증
      const { rows: battleRows } = await client.query(
        `SELECT fb.winner_side, fbp.side
         FROM fleet_battles fb
         JOIN fleet_battle_participants fbp ON fbp.battle_id = fb.id AND LOWER(fbp.wallet_address) = $1
         WHERE fb.id = $2 AND fb.status = 'ended'`,
        [wallet, battle_id]
      );
      if (!battleRows[0]) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'BATTLE_NOT_FOUND_OR_NOT_PARTICIPANT' });
      }
      if (battleRows[0].winner_side !== battleRows[0].side) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'NOT_WINNER' });
      }

      // 상대가 target_wallet인지 확인
      const { rows: opponentRows } = await client.query(
        `SELECT fbp.wallet_address FROM fleet_battle_participants fbp
         WHERE fbp.battle_id = $1 AND LOWER(fbp.wallet_address) = $2`,
        [battle_id, target]
      );
      if (!opponentRows[0]) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'TARGET_NOT_IN_BATTLE' });
      }

      // 현상금 가져오기 (lock)
      const { rows: bounties } = await client.query(
        `SELECT id, reward_gp FROM bounty_listings
         WHERE target_wallet = $1 AND status = 'active' AND expires_at > NOW()
         FOR UPDATE`,
        [target]
      );
      if (bounties.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'NO_ACTIVE_BOUNTIES_ON_TARGET' });
      }

      // 전체 현상금 합산
      const totalGP = bounties.reduce((s, b) => s + b.reward_gp, 0);
      const feeGP  = Math.floor(totalGP * feePct / 100);
      const netGP  = totalGP - feeGP;
      const ids    = bounties.map(b => b.id);

      // 현상금 상태 업데이트
      await client.query(
        `UPDATE bounty_listings SET status = 'claimed', claimed_by = $1,
              claim_battle_id = $2, claimed_at = NOW()
         WHERE id = ANY($3)`,
        [wallet, battle_id, ids]
      );

      // GP 지급
      await client.query(
        `UPDATE users SET gp_balance = gp_balance + $1 WHERE LOWER(wallet_address) = $2`,
        [netGP, wallet]
      );

      await client.query('COMMIT');

      try {
        const { logGPActivity } = require('../db');
        logGPActivity(wallet, netGP, 'bounty_claim', `현상금 수령: ${target} 처치 ${netGP} GP`).catch(() => {});
      } catch (_) {}

      res.json({ success: true, claimed_count: ids.length, total_gp: totalGP, net_gp: netGP, fee_gp: feeGP });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('[bounty] claim error:', err.message);
    res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

// ── POST /api/bounty/cancel/:id ───────────────────────────────
router.post('/cancel/:id', async (req, res) => {
  try {
    const wallet = getWallet(req);
    const bountyId = parseInt(req.params.id);
    if (!wallet || wallet.length < 5) return res.status(400).json({ error: 'INVALID_WALLET' });
    if (!bountyId) return res.status(400).json({ error: 'INVALID_ID' });

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const { rows } = await client.query(
        `SELECT id, reward_gp, expires_at FROM bounty_listings
         WHERE id = $1 AND poster_wallet = $2 AND status = 'active' FOR UPDATE`,
        [bountyId, wallet]
      );
      if (!rows[0]) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'BOUNTY_NOT_FOUND_OR_NOT_YOURS' });
      }

      const { reward_gp } = rows[0];

      await client.query(
        `UPDATE bounty_listings SET status = 'cancelled' WHERE id = $1`, [bountyId]
      );
      await client.query(
        `UPDATE users SET gp_balance = gp_balance + $1 WHERE LOWER(wallet_address) = $2`,
        [reward_gp, wallet]
      );

      await client.query('COMMIT');

      try {
        const { logGPActivity } = require('../db');
        logGPActivity(wallet, reward_gp, 'bounty_cancel', `현상금 취소 환불 ${reward_gp} GP`).catch(() => {});
      } catch (_) {}

      res.json({ success: true, refunded_gp: reward_gp });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('[bounty] cancel error:', err.message);
    res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

module.exports = router;
