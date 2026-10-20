const express = require('express');
const { ethers } = require('ethers');
const { makeRateLimiter } = require('../utils/rateLimiters');
const { pool, getSetting, creditReferralCommission } = require('../db');
const { generateWithdrawSignature, getAvailableLiquidity, CHAINS } = require('../services/signer');
const { requireAuth, getAuthWallet } = require('../utils/apiHelpers');
const { cfg } = require('../utils/settingsCache');
const { financialNumber, financialBoolean } = require('../services/treasury');

const router = express.Router();

// [v7.440 Web3 분리] 캐주얼 모드 ON 이면 실자금 레일(PP→USDT swap / withdraw)을 서버에서 차단(방어선).
//   기본 false 라 동작 불변. 클라 UI 숨김과 별개로 직접 API 호출도 막는다(되돌림: 설정 false).
async function _casualBlocked(res) {
  try {
    if (financialBoolean(await getSetting('casual_mode_enabled', 'false'), 'casual_mode_enabled')) {
      res.status(403).json({ error: 'CASUAL_MODE', message: 'Real-money rails are disabled in casual mode.' });
      return true;
    }
  } catch (_) {
    res.status(503).json({ error: 'financial_configuration_unavailable' });
    return true;
  }
  return false;
}

const writeLimiter = makeRateLimiter({
  windowMs: 60 * 1000,
  max: 30,
  message: { error: 'Too many write requests. Please wait.' }
});

// [v7.354] quest_reward_pool 폐지 — no-op. Keep call sites behavior-compatible.
async function fundQuestPool(_client, _feeAmount) {
  return;
}

//  POST /api/swap — PP → USDT
// ══════════════════════════════════════════════════
router.post('/swap', requireAuth, writeLimiter, async (req, res) => {
  if (await _casualBlocked(res)) return;
  const wallet = getAuthWallet(req);
  const { ppAmount } = req.body;
  if (!wallet || !ppAmount || ppAmount <= 0) return res.status(400).json({ error: 'Invalid input' });

  const parsedPP = Number(ppAmount);
  if (isNaN(parsedPP) || !isFinite(parsedPP) || parsedPP <= 0) {
    return res.status(400).json({ error: 'Amount must be a positive finite number' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const userRes = await client.query(
      'SELECT pp_balance, redeemable_pp FROM users WHERE wallet_address = $1 FOR UPDATE',
      [wallet.toLowerCase()]
    );
    if (!userRes.rows.length) throw new Error('User not found');

    const ppBal = parseFloat(userRes.rows[0].pp_balance);
    const redeemablePP = parseFloat(userRes.rows[0].redeemable_pp || 0) || 0;
    if (ppBal < parsedPP) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Insufficient PP', balance: ppBal });
    }

    // [경제정책 W2-4] redeemable_pp 게이팅 — 입금 연동 PP 만 USDT 환매 가능.
    //   채굴/가챠/추천 PP 는 redeemable_pp 에 안 잡혀 → GP 환전(/exchange/pp-to-gp)만 가능.
    try {
      const _t = require('../services/treasury');
      if (await _t.redeemableGatingEnabled(getSetting) && parsedPP > redeemablePP + 1e-9) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          error: 'pp_not_redeemable',
          message: 'Only deposit-linked PP can be redeemed to USDT. Mined/gacha PP can be converted to GP instead.',
          redeemable: redeemablePP, requested: parsedPP
        });
      }
    } catch (e) {
      await client.query('ROLLBACK');
      console.error('[API] swap redeemable gate error:', e.message);
      return res.status(500).json({ error: 'internal_error' });
    }

    const s = await cfg();
    const swapFeePercent = financialNumber(s.swap_fee_percent ?? 5, 'swap_fee_percent', { max: 100 });
    const SWAP_FEE = swapFeePercent / 100;
    const fee = Math.round(parsedPP * SWAP_FEE * 1000000) / 1000000;
    const received = Math.round((parsedPP - fee) * 1000000) / 1000000;

    // ✅ [솔벤시 가드] PP→USDT 환금은 담보(collateral) 여유분(room) 이내만 허용 — 뱅크런 차단.
    try {
      const _treasury = require('../services/treasury');
      if (await _treasury.guardEnabled(getSetting)) {
        // [v7.189 fix] `w` 미정의 → 유저 pre-lock 스킵되던 버그. wallet 변수가 정확한 식별자.
        const { collateral, liability, room } = await _treasury.lockRoom(client, wallet);
        if (received > room) {
          await client.query('ROLLBACK');
          return res.status(409).json({
            error: 'swap_pool_insufficient',
            message: 'PP→USDT redemption pool is currently insufficient. The operator must fund the redemption collateral.',
            room, collateral, liability, requested: received
          });
        }
      }
    } catch (e) {
      // ⚠️ fail-CLOSED: treasury_ledger 미존재(42P01, 마이그레이션 전)만 가드 면제. 그 외 모든 오류는
      //    미담보 발행을 막기 위해 거래 차단(Codex 검토 — 과거 모든 e.code 면제 = fail-open 버그였음).
      await client.query('ROLLBACK');
      if (e && e.code === '42P01') { return res.status(503).json({ error: 'solvency_guard_unavailable' }); }
      console.error('[API] swap solvency guard error:', e.message);
      return res.status(500).json({ error: 'internal_error' });
    }

    // [경제정책 W4-6] 환매 한도(주간 글로벌 + 유저 일일) — received(USDT) 기준. 잔액 변경 전 호출.
    try {
      const _t = require('../services/treasury');
      const lim = await _t.checkRedemptionLimits(client, { wallet, redeemUsdt: received }, getSetting);
      if (!lim.ok) {
        await client.query('ROLLBACK');
        return res.status(429).json({
          error: lim.code,
          message: lim.code === 'redemption_weekly_cap'
            ? 'Weekly redemption cap reached. Please try again later.'
            : 'Daily redemption limit reached. Please try again tomorrow.',
          ...lim
        });
      }
    } catch (e) {
      await client.query('ROLLBACK');
      console.error('[API] swap redemption limit error:', e.message);
      return res.status(500).json({ error: 'internal_error' });
    }

    // [경제정책 W2-4] redeemable_pp 도 함께 차감(환매한 PP 는 redeemable 소진). 트리거가 ≤pp_balance 보강.
    const deductSwap = await client.query(
      'UPDATE users SET pp_balance = pp_balance - $1, redeemable_pp = GREATEST(redeemable_pp - $1, 0), usdt_balance = usdt_balance + $2 WHERE LOWER(wallet_address) = LOWER($3) AND pp_balance >= $1',
      [parsedPP, received, wallet.toLowerCase()]
    );
    if (deductSwap.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Insufficient balance (concurrent modification)' });
    }

    await client.query(
      `INSERT INTO transactions (type, from_wallet, usdt_amount, pp_amount, fee, meta)
       VALUES ('swap', $1, $2, $3, $4, $5)`,
      [wallet.toLowerCase(), received, parsedPP, fee, JSON.stringify({ swapRate: 1, feePercent: swapFeePercent })]
    );

    // [v7.353] 추천 수수료를 swap fee 에서 carve(추가발행 0): 먼저 PP 추천 분배 후
    //   quest pool 은 잔여분(fee - referral)만 적립. (예전엔 quest pool 에 fee 전액 기반
    //   + 추천을 GP로 별도 발행 = 교차통화 인플레.)
    let _refTotal = 0;
    try {
      const credited = await creditReferralCommission(client, wallet, 'swap', fee, 'pp');
      _refTotal = (credited || []).reduce((s, c) => s + (parseFloat(c.amount) || 0), 0);
    } catch (_e) { /* non-critical */ }

    // Fund quest pool from the remaining swap fee (referral 몫 제외)
    await fundQuestPool(client, Math.max(0, fee - _refTotal));

    await client.query('COMMIT');
    res.json({ success: true, received, fee, ppDeducted: parsedPP });
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
router.post('/withdraw', requireAuth, writeLimiter, async (req, res) => {
  if (await _casualBlocked(res)) return;
  const wallet = getAuthWallet(req);
  const { amount, chain } = req.body;
  if (!wallet || !amount || amount <= 0) return res.status(400).json({ error: 'Invalid input' });

  // [v7.165] 6자리 소수 라운드로 정규화(swap/treasury 컨벤션과 일관) — float 미세 누수 차단.
  const parsedAmount = Math.round(Number(amount) * 1e6) / 1e6;
  if (isNaN(parsedAmount) || !isFinite(parsedAmount) || parsedAmount <= 0) {
    return res.status(400).json({ error: 'Amount must be a positive finite number' });
  }

  const chainKey = chain || 'base';
  const VALID_CHAINS = ['base', 'bnb', 'eth'];
  if (!VALID_CHAINS.includes(chainKey)) {
    return res.status(400).json({ error: 'Invalid chain (must be one of: base, bnb, eth)' });
  }
  const chainCfg = CHAINS[chainKey];
  if (!chainCfg) return res.status(400).json({ error: 'Invalid chain' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const userRes = await client.query(
      'SELECT usdt_balance, withdrawal_nonce, last_withdrawal_at FROM users WHERE wallet_address = $1 FOR UPDATE',
      [wallet.toLowerCase()]
    );
    if (!userRes.rows.length) throw new Error('User not found');

    await client.query("SELECT pg_advisory_xact_lock(hashtext('withdraw_liquidity:' || $1))", [chainKey]);

    const _openPend = await client.query(
      `SELECT amount_units, gross, net, fee, nonce, deadline, signature, chain
         FROM pending_withdrawals
        WHERE LOWER(wallet_address) = LOWER($1) AND status = 'pending'
        ORDER BY id DESC LIMIT 1 FOR UPDATE`,
      [wallet]
    );
    if (_openPend.rows.length) {
      const p = _openPend.rows[0];
      await client.query('COMMIT');
      if (Number(p.deadline) <= Math.floor(Date.now() / 1000)) {
        return res.status(409).json({ error: 'withdrawal_pending_reconciliation', chain: p.chain,
          message: 'Your previous withdrawal remains reserved until finalized chain state proves settlement or expiry. Please retry later.' });
      }
      return res.json({
        success: true, reissued: true, pending: true, chain: p.chain,
        usdtBalance: financialNumber(userRes.rows[0].usdt_balance, 'USDT balance'),
        amount: p.amount_units, contractFee: '0', nonce: Number(p.nonce),
        deadline: Number(p.deadline), chainId: CHAINS[p.chain].chainId, signature: p.signature,
        requested: Number(p.gross), feeDeducted: Number(p.fee), net: Number(p.net),
        message: '기존 출금 서명을 재발급했습니다. 만료 전 온체인 제출하세요.'
      });
    }

    // ── Withdrawal cooldown check ──
    const s = await cfg();
    const cooldownHours = financialNumber(s.withdrawal_cooldown_hours ?? 24, 'withdrawal_cooldown_hours');
    if (cooldownHours > 0 && userRes.rows[0].last_withdrawal_at) {
      const lastWithdrawal = new Date(userRes.rows[0].last_withdrawal_at);
      const nextAllowed = new Date(lastWithdrawal.getTime() + cooldownHours * 60 * 60 * 1000);
      if (Date.now() < nextAllowed.getTime()) {
        await client.query('ROLLBACK');
        return res.status(429).json({
          error: `Withdrawal cooldown active. Next withdrawal allowed after ${nextAllowed.toISOString()}`,
          nextAllowedAt: nextAllowed.toISOString(),
          remainingSeconds: Math.ceil((nextAllowed.getTime() - Date.now()) / 1000)
        });
      }
    }

    const minWithdrawAmount = financialNumber(s.withdraw_min_amount ?? s.min_withdraw ?? 1, 'withdraw_min_amount');
    if (!Number.isFinite(minWithdrawAmount) || minWithdrawAmount < 0) {
      await client.query('ROLLBACK');
      return res.status(500).json({ error: 'Invalid withdraw minimum configuration' });
    }
    if (parsedAmount < minWithdrawAmount) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: `Minimum withdrawal amount is ${minWithdrawAmount} USDT`,
        minAmount: minWithdrawAmount
      });
    }

    const bal = financialNumber(userRes.rows[0].usdt_balance, 'USDT balance');
    if (bal < parsedAmount) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Insufficient balance', balance: bal });
    }

    // ── [P0] 서명 nonce = 온체인 withdrawNonce (DB nonce 미사용 → desync 구조적 불가) ──
    let onchainNonce;
    try {
      onchainNonce = await require('../services/signer').getOnchainWithdrawNonce(wallet, chainKey);
    } catch (nerr) {
      await client.query('ROLLBACK');
      console.error('[API] withdraw onchain-nonce error:', nerr.message);
      return res.status(503).json({ error: 'On-chain state unavailable. Try again shortly.' });
    }

    // Expired/unknown signatures are reconciled only against finalized chain
    // state by chain.reconcilePendingWithdrawals; never refund from a latest nonce.

    // ── 출금 수수료 — 유저 잔액에서는 요청 전액(parsedAmount) 차감, 온체인은 net(=요청액-fee) 전송.
    //   fee 만큼은 담보(collateral)에 잔류해 페그 강화. 0~20% validated; malformed configuration blocks signing. (v7.217 ECON-005)
    const _wfPctRaw = (s && (s.withdraw_fee_percent ?? s.withdrawFeePercent));
    const withdrawFeePct = financialNumber(_wfPctRaw ?? 0, 'withdraw_fee_percent', { max: 20 });
    const feeAmount = Math.round(parsedAmount * (withdrawFeePct / 100) * 1000000) / 1000000;
    const netAmount = Math.round((parsedAmount - feeAmount) * 1000000) / 1000000;

    const amountBN = ethers.utils.parseUnits(netAmount.toString(), chainCfg.decimals);
    const feeBN = ethers.BigNumber.from(0); // 온체인 fee=0 (수수료는 DB 차감으로 처리)

    // ── 유동성 체크 — 다른 미만료 pending 의 net 을 예약분으로 차감해 동시 출금 과다배정 차단 ──
    // The chain advisory lock spans liquidity observation and reservation.
    let availableLiquidity;
    try {
      availableLiquidity = await getAvailableLiquidity(chainKey);
    } catch (liquidityErr) {
      await client.query('ROLLBACK');
      console.error('[API] withdraw liquidity check error:', liquidityErr.message);
      return res.status(503).json({ error: 'On-chain liquidity check unavailable. Try again shortly.' });
    }
    const _resv = await client.query(
      `SELECT COALESCE(SUM(net), 0) AS s FROM pending_withdrawals WHERE chain = $1 AND status = 'pending'`,
      [chainKey]
    );
    const reservedUnits = ethers.utils.parseUnits(
      (Math.round((parseFloat(_resv.rows[0].s) || 0) * 1000000) / 1000000).toString(), chainCfg.decimals
    );
    const effectiveLiquidity = availableLiquidity.sub(reservedUnits);
    if (effectiveLiquidity.lt(amountBN)) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        error: 'Insufficient on-chain liquidity',
        available: ethers.utils.formatUnits(effectiveLiquidity.gt(0) ? effectiveLiquidity : ethers.constants.Zero, chainCfg.decimals),
        required: ethers.utils.formatUnits(amountBN, chainCfg.decimals),
        chain: chainKey
      });
    }

    // ── reserve: 잔액 차감(gross) + 담보 차감(net). withdrawal_nonce 는 더 이상 건드리지 않음 ──
    // [v7.365][P0] rowCount 가드 — 조건부 UPDATE 가 0행이면 차감 없이 서명되던 결함 방지.
    const _wd = await client.query(
      'UPDATE users SET usdt_balance = usdt_balance - $1, last_withdrawal_at = NOW() WHERE LOWER(wallet_address) = LOWER($2) AND usdt_balance >= $1 RETURNING usdt_balance',
      [parsedAmount, wallet.toLowerCase()]
    );
    if (_wd.rowCount !== 1) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Insufficient balance' });
    }
    // ✅ [솔벤시] 담보는 net 만큼만 차감 — fee 는 담보 잔류. fail-CLOSED: throw 시 catch 에서 ROLLBACK.
    await require('../services/treasury').adjustCollateral(client, -netAmount);

    const sigData = await generateWithdrawSignature(
      wallet, amountBN, feeBN, onchainNonce, chainKey
    );

    // pending 예약 기록 (재발급/정산/만료환불의 근거)
    await client.query(
      `INSERT INTO pending_withdrawals (wallet_address, chain, nonce, gross, net, fee, amount_units, deadline, signature, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'pending')`,
      [wallet.toLowerCase(), chainKey, onchainNonce, parsedAmount, netAmount, feeAmount, amountBN.toString(), sigData.deadline, sigData.signature]
    );

    await client.query(
      `INSERT INTO transactions (type, from_wallet, usdt_amount, fee, meta)
       VALUES ('withdraw', $1, $2, $3, $4)`,
      [wallet.toLowerCase(), parsedAmount, feeAmount, JSON.stringify({ chain: chainKey, nonce: onchainNonce, deadline: sigData.deadline, net: netAmount, fee: feeAmount, feePct: withdrawFeePct, pending: true })]
    );

    await client.query('COMMIT');
    // [P0-b] 온체인 호출 파라미터(서명된 값)와 표시용을 분리. 기존엔 응답 fee 가 서명된 fee(0)를
    //   덮어써 프론트가 그 fee 로 온체인 호출 시 서명 불일치 → revert → 잔액 잠김 위험이 있었음.
    res.json({
      success: true, pending: true, chain: chainKey,
      usdtBalance: financialNumber(_wd.rows[0].usdt_balance, 'USDT balance'),
      amount: amountBN.toString(),  // 컨트랙트 amount 인자(net, base-unit)
      contractFee: '0',             // 컨트랙트 fee 인자(서명된 값) — 절대 덮어쓰지 말 것
      nonce: onchainNonce,
      deadline: sigData.deadline,
      chainId: sigData.chainId,
      signature: sigData.signature,
      requested: parsedAmount, feeDeducted: feeAmount, feePct: withdrawFeePct, net: netAmount
    });
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('[API] withdraw error:', e.message);
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
});

// The legacy combined path used a DB nonce, no reservation and an immediate
// territory reset. It cannot safely refund an unsubmitted signature. Keep the
// existing supported swap/withdraw paths explicit until staged reset settlement
// has its own reversible lifecycle; do not issue another untracked signature.
router.post('/withdraw-all', requireAuth, writeLimiter, async (req, res) => {
  if (await _casualBlocked(res)) return;
  return res.status(409).json({
    error: 'legacy_withdraw_all_unavailable',
    message: 'Combined withdrawal and territory reset is temporarily unavailable. Use the existing PP-to-USDT swap for eligible PP, then withdraw your USDT balance through the wallet withdrawal screen.',
    supportedPaths: ['/api/swap', '/api/withdraw']
  });
});

module.exports = router;
