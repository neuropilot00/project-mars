const { ethers } = require('ethers');
const { pool, ensureUser, awardXP, creditReferralCommission } = require('../db');

const DEPOSIT_ABI = [
  'event Deposited(address indexed user, uint256 amount, uint256 timestamp, uint256 chainId)',
  'event Withdrawn(address indexed user, uint256 amount, uint256 fee, uint256 nonce, uint256 chainId)'
];

const CHAIN_CONFIGS = {
  base: {
    rpcEnv: 'BASE_RPC_URL',
    addrEnv: 'BASE_DEPOSIT_ADDRESS',
    decimals: 6,
    name: 'Base'
  },
  bnb: {
    rpcEnv: 'BNB_RPC_URL',
    addrEnv: 'BNB_DEPOSIT_ADDRESS',
    decimals: 18,
    name: 'BNB Chain'
  },
  eth: {
    rpcEnv: 'ETH_RPC_URL',
    addrEnv: 'ETH_DEPOSIT_ADDRESS',
    decimals: 6,
    name: 'Ethereum'
  }
};

const listeners = {};
const retryState = {}; // { [chainKey]: { delay, timer } }
let listenersStarted = false;

const RETRY_INITIAL_MS = 1000;
const RETRY_MAX_MS = 60000;
const HEALTH_CHECK_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const DEFAULT_PP_BONUS_PCT = 10;

// ── PP Bonus from DB ──

let cachedPpBonusPct = null;
let ppBonusFetchedAt = 0;
const PP_BONUS_CACHE_MS = 60000; // re-read from DB at most once per minute

async function getPpBonusPct() {
  const now = Date.now();
  if (cachedPpBonusPct !== null && now - ppBonusFetchedAt < PP_BONUS_CACHE_MS) {
    return cachedPpBonusPct;
  }
  try {
    const res = await pool.query(
      `SELECT value FROM settings WHERE key = 'deposit_pp_bonus'`
    );
    if (res.rows.length && res.rows[0].value != null) {
      cachedPpBonusPct = parseFloat(res.rows[0].value);
      if (isNaN(cachedPpBonusPct)) cachedPpBonusPct = DEFAULT_PP_BONUS_PCT;
    } else {
      cachedPpBonusPct = DEFAULT_PP_BONUS_PCT;
    }
  } catch (e) {
    // Table may not exist yet — fall back silently
    if (cachedPpBonusPct === null) cachedPpBonusPct = DEFAULT_PP_BONUS_PCT;
    console.warn(`[Chain] Could not read deposit_pp_bonus from settings: ${e.message}`);
  }
  ppBonusFetchedAt = now;
  return cachedPpBonusPct;
}

// ── Connection with retry ──

async function connectChain(key, cfg) {
  if (listeners[key]) return;

  const rpcUrl = process.env[cfg.rpcEnv];
  const contractAddr = process.env[cfg.addrEnv];

  if (!rpcUrl || !contractAddr || contractAddr === '0x0000000000000000000000000000000000000000') {
    console.log(`[Chain] ${cfg.name}: skipped (no RPC or contract address)`);
    return;
  }

  try {
    const provider = new ethers.providers.JsonRpcProvider(rpcUrl);

    // Test the connection by fetching block number
    await provider.getBlockNumber();

    const contract = new ethers.Contract(contractAddr, DEPOSIT_ABI, provider);

    // Listen for new Deposited events
    contract.on('Deposited', async (user, amount, timestamp, chainId, event) => {
      try {
        await processDeposit({
          wallet: user.toLowerCase(),
          amount: ethers.utils.formatUnits(amount, cfg.decimals),
          chain: key,
          txHash: event.transactionHash,
          blockNumber: event.blockNumber
        });
      } catch (e) {
        console.error(`[Chain] ${cfg.name} deposit processing error:`, e.message);
      }
    });

    // [P0] Listen for on-chain Withdrawn — pending 예약을 정산(settled) 처리.
    contract.on('Withdrawn', async (user, amount, fee, nonce, chainId, event) => {
      try {
        await settleWithdrawal({
          wallet: user.toLowerCase(),
          nonce: ethers.BigNumber.from(nonce).toNumber(),
          chain: key
        });
      } catch (e) {
        console.error(`[Chain] ${cfg.name} withdrawal settle error:`, e.message);
      }
    });

    // Listen for provider errors to trigger reconnection
    provider.on('error', (error) => {
      console.error(`[Chain] ${cfg.name} provider error:`, error.message);
      handleDisconnect(key, cfg);
    });

    // For WebSocket providers, listen for close events
    if (provider._websocket) {
      provider._websocket.on('close', () => {
        console.warn(`[Chain] ${cfg.name} websocket closed`);
        handleDisconnect(key, cfg);
      });
    }

    listeners[key] = { provider, contract };
    // Reset retry state on successful connection
    delete retryState[key];
    console.log(`[Chain] ${cfg.name}: listening on ${contractAddr.slice(0, 10)}...`);

    // Backfill recent events (last 1000 blocks)
    backfillEvents(key, contract, provider, cfg.decimals).catch(e => {
      console.warn(`[Chain] ${cfg.name} backfill error:`, e.message);
    });
  } catch (e) {
    console.error(`[Chain] ${cfg.name} connection failed:`, e.message);
    scheduleRetry(key, cfg);
  }
}

function handleDisconnect(key, cfg) {
  // Clean up existing listener
  if (listeners[key]) {
    try {
      listeners[key].contract.removeAllListeners();
      listeners[key].provider.removeAllListeners();
    } catch (_) { /* ignore cleanup errors */ }
    delete listeners[key];
  }
  scheduleRetry(key, cfg);
}

function scheduleRetry(key, cfg) {
  // Don't schedule if already pending
  if (retryState[key] && retryState[key].timer) return;

  const state = retryState[key] || { delay: RETRY_INITIAL_MS };
  const delay = Math.min(state.delay, RETRY_MAX_MS);

  console.log(`[Chain] ${cfg.name}: retrying in ${delay / 1000}s...`);

  const timer = setTimeout(() => {
    retryState[key] = { delay: delay * 2 }; // exponential backoff for next failure
    connectChain(key, cfg);
  }, delay);
  if (timer.unref) timer.unref();

  retryState[key] = { delay, timer };
}

// ── Health check ──

let healthCheckTimer = null;
let healthCheckInProgress = false;

function startHealthCheck() {
  if (healthCheckTimer) return;
  healthCheckTimer = setInterval(async () => {
    if (healthCheckInProgress) {
      console.warn('[Chain] Health check skipped: previous check still active');
      return;
    }
    healthCheckInProgress = true;
    try {
      for (const [key, { provider }] of Object.entries(listeners)) {
        try {
          const blockNumber = await provider.getBlockNumber();
          console.log(`[Chain] Health: ${CHAIN_CONFIGS[key].name} latest block #${blockNumber}`);
        } catch (e) {
          console.error(`[Chain] Health: ${CHAIN_CONFIGS[key].name} unreachable — ${e.message}`);
          handleDisconnect(key, CHAIN_CONFIGS[key]);
        }
      }
    } finally {
      healthCheckInProgress = false;
    }
  }, HEALTH_CHECK_INTERVAL_MS);
  if (healthCheckTimer.unref) healthCheckTimer.unref();
}

// ── Start all listeners ──

let reconcileTimer = null;
let reconcileInProgress = false;

async function startListeners() {
  if (listenersStarted) {
    console.log('[Chain] listeners already started');
    return;
  }
  listenersStarted = true;

  for (const [key, cfg] of Object.entries(CHAIN_CONFIGS)) {
    await connectChain(key, cfg);
  }
  startHealthCheck();
  // [P0] 만료 미청구 출금 자동 환불 — 리더에서만(startListeners 자체가 리더 게이트됨) 주기 실행.
  if (!reconcileTimer) {
    const everyMs = parseInt(process.env.WITHDRAW_RECONCILE_MS || '60000', 10) || 60000;
    reconcileTimer = setInterval(async () => {
      if (reconcileInProgress) {
        console.warn('[Chain] withdraw reconcile skipped: previous run still active');
        return;
      }
      reconcileInProgress = true;
      try {
        await reconcilePendingWithdrawals();
      } catch (e) {
        console.error('[Chain] withdraw reconcile error:', e.message);
      } finally {
        reconcileInProgress = false;
      }
    }, everyMs);
    if (reconcileTimer.unref) reconcileTimer.unref();
  }
}

// ── [P0] 출금 예약 정산/환불 ──

// Withdrawn 이벤트로 pending → settled (차감 확정, 환불 없음).
async function settleWithdrawal({ wallet, nonce, chain }) {
  await pool.query(
    `UPDATE pending_withdrawals SET status='settled', settled_at=NOW()
      WHERE chain=$1 AND LOWER(wallet_address)=LOWER($2) AND nonce=$3 AND status='pending'`,
    [chain, wallet, nonce]
  );
}

// deadline+grace 경과한 pending 을 점검: 온체인 nonce 가 미증가(=미실행)면 reserve 환불, 증가했으면 settled.
//   이벤트 누락(워커 다운 등) 보완 + 미청구 자금 자동 복구. 온체인 조회 실패 시 절대 환불하지 않음(이중환불 차단).
async function reconcilePendingWithdrawals() {
  const grace = parseInt(process.env.WITHDRAW_RECONCILE_GRACE_SEC || '120', 10) || 120;
  let rows;
  try {
    rows = (await pool.query(
      `SELECT id, wallet_address, chain, nonce, gross, net FROM pending_withdrawals
        WHERE status='pending' AND deadline + $1 < EXTRACT(EPOCH FROM NOW())::bigint
        ORDER BY id ASC LIMIT 100`,
      [grace]
    )).rows;
  } catch (e) {
    // 테이블 미생성(마이그 전) 등 — 조용히 패스.
    return;
  }
  if (!rows.length) return;

  const signer = require('./signer');
  for (const r of rows) {
    let onchainNonce;
    try {
      onchainNonce = await signer.getOnchainWithdrawNonce(r.wallet_address, r.chain);
    } catch (_) {
      continue; // RPC/컨트랙트 조회 불가 → 다음 주기에 재시도. 환불 금지.
    }
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const cur = await client.query(`SELECT status FROM pending_withdrawals WHERE id=$1 FOR UPDATE`, [r.id]);
      if (!cur.rows.length || cur.rows[0].status !== 'pending') { await client.query('ROLLBACK'); client.release(); continue; }
      if (onchainNonce > Number(r.nonce)) {
        // 이미 실행됨 → 정산만(환불 금지).
        await client.query(`UPDATE pending_withdrawals SET status='settled', settled_at=NOW() WHERE id=$1`, [r.id]);
      } else {
        // 미실행 + 만료 → reserve 환불.
        await client.query(`SELECT 1 FROM users WHERE LOWER(wallet_address)=LOWER($1) FOR UPDATE`, [r.wallet_address]);
        await client.query(`UPDATE users SET usdt_balance = usdt_balance + $1 WHERE LOWER(wallet_address)=LOWER($2)`, [r.gross, r.wallet_address]);
        await require('./treasury').adjustCollateral(client, Number(r.net));
        await client.query(`UPDATE pending_withdrawals SET status='expired', settled_at=NOW() WHERE id=$1`, [r.id]);
        await client.query(
          `INSERT INTO transactions (type, from_wallet, usdt_amount, meta) VALUES ('withdraw_refund', $1, $2, $3)`,
          [String(r.wallet_address).toLowerCase(), r.gross, JSON.stringify({ chain: r.chain, nonce: Number(r.nonce), reason: 'expired_unclaimed_reconciler' })]
        );
        console.log(`[Chain] withdraw refund (expired): ${String(r.wallet_address).slice(0,8)}… +${r.gross} USDT (${r.chain} nonce ${r.nonce})`);
      }
      await client.query('COMMIT');
    } catch (e) {
      try { await client.query('ROLLBACK'); } catch (_) {}
      console.error('[Chain] reconcile refund error:', e.message);
    } finally {
      client.release();
    }
  }
}

async function backfillEvents(chainKey, contract, provider, decimals) {
  // Get last processed block for this chain
  const res = await pool.query(
    `SELECT MAX(block_number) as last_block FROM deposits WHERE chain = $1`,
    [chainKey]
  );
  const lastBlock = res.rows[0].last_block || 0;
  const currentBlock = await provider.getBlockNumber();
  // 커서: deposits.MAX(block_number) 가 곧 커서다. 이전 입금이 있으면 그 다음 블록부터
  // "전부" 스캔(누락 0). 과거의 currentBlock-1000 floor 는 워커 장기 다운 시 그 사이 블록을
  // 통째로 건너뛰어 입금이 영구 유실되던 CRITICAL 결함 → 제거.
  // 최초(입금 이력 0)에만 cold-start 로 최근 BACKFILL_BLOCKS 블록만 본다.
  const BACKFILL_BLOCKS = parseInt(process.env.BACKFILL_BLOCKS || '1000', 10) || 1000;
  let fromBlock = lastBlock > 0 ? (lastBlock + 1) : Math.max(0, currentBlock - BACKFILL_BLOCKS);
  if (fromBlock > currentBlock) return;

  // RPC 블록범위 제한(보통 ~1만 블록) 대응: 큰 공백은 청크로 나눠 조회.
  const CHUNK = parseInt(process.env.BACKFILL_CHUNK || '5000', 10) || 5000;
  console.log(`[Chain] ${CHAIN_CONFIGS[chainKey].name}: backfilling blocks ${fromBlock} → ${currentBlock} (chunk ${CHUNK})`);
  for (let start = fromBlock; start <= currentBlock; start += CHUNK) {
    const end = Math.min(start + CHUNK - 1, currentBlock);
    let events;
    try {
      events = await contract.queryFilter('Deposited', start, end);
    } catch (qe) {
      console.error(`[Chain] backfill queryFilter ${start}~${end} 실패(다음 청크 계속):`, qe.message);
      continue;
    }
    for (const event of events) {
      try {
        await processDeposit({
          wallet: event.args.user.toLowerCase(),
          amount: ethers.utils.formatUnits(event.args.amount, decimals),
          chain: chainKey,
          txHash: event.transactionHash,
          blockNumber: event.blockNumber
        });
      } catch (e) {
        if (!e.message.includes('duplicate')) {
          console.error(`[Chain] Backfill error:`, e.message);
        }
      }
    }
  }
}

async function processDeposit({ wallet, amount, chain, txHash, blockNumber }) {
  const amountNum = parseFloat(amount);
  // [v7.163 hotfix] 음수/0/NaN amount 차단(외부 RPC/admin replay 오염 방지 — 음수 시 잔액 차감 가능).
  if (!(amountNum > 0) || !isFinite(amountNum)) {
    console.warn('[chain] processDeposit refused — invalid amount:', amount, 'tx:', txHash);
    return;
  }
  const ppBonusPct = await getPpBonusPct();
  const ppBonus = Math.round(amountNum * (ppBonusPct / 100) * 1000000) / 1000000;

  // [경제v2 P4] 출금 한도 — 입금 origin PP 의 일정 %만 USDT 환매(redeemable)로 적립. 나머지는 영구 버퍼.
  //   PP=입금 발행 전용(무료 faucet 없음)이라 redeemable 버킷이 곧 입금 담보분의 출금 가능 한도.
  let withdrawablePct = 80;
  try {
    const wr = await pool.query(`SELECT value FROM settings WHERE key = 'pp_withdrawable_pct'`);
    if (wr.rows.length && wr.rows[0].value != null) {
      const v = parseFloat(wr.rows[0].value);
      if (!isNaN(v) && v >= 0 && v <= 100) withdrawablePct = v;
    }
  } catch (_) { /* 설정 부재 시 기본 80 */ }
  const redeemableBonus = Math.round(ppBonus * (withdrawablePct / 100) * 1000000) / 1000000;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Check duplicate tx_hash
    const dup = await client.query('SELECT id FROM deposits WHERE tx_hash = $1', [txHash]);
    if (dup.rows.length > 0) {
      await client.query('ROLLBACK');
      return; // Already processed
    }

    // Ensure user exists
    await ensureUser(client, wallet);

    // [v7.165] users 행 FOR UPDATE 잠금 — 동시 deposit listener / 첫 입금 보너스 체크 race window 차단.
    //   prior deposits 0건 SELECT ↔ deposits INSERT 사이에 다른 워커가 같은 wallet 처리 시
    //   양쪽 모두 prior 0 → 보너스 중복 지급 가능 위험 차단.
    await client.query(`SELECT 1 FROM users WHERE LOWER(wallet_address) = LOWER($1) FOR UPDATE`, [wallet]);

    // Update user balances
    // [경제정책 W2-4 / v2 P4] 입금 보너스 PP 전액은 pp_balance 에, 그 중 withdrawablePct(기본 80%)만
    //   redeemable_pp(USDT 환매 가능 버킷)에 적립. 채굴/가챠/경매취득 PP 는 버킷 미적립 → USDT 직행 불가.
    await client.query(
      `UPDATE users SET usdt_balance = usdt_balance + $1, pp_balance = pp_balance + $2, redeemable_pp = redeemable_pp + $4 WHERE LOWER(wallet_address) = LOWER($3)`,
      [amountNum, ppBonus, wallet, redeemableBonus]
    );

    // ✅ [솔벤시] 실입금 USDT 만큼 담보(collateral) 증액 — usdt_balance 와 함께 늘어 불변식 유지.
    // 실패를 삼키면 collateral 누락(과소담보)이 되므로 던져서 트랜잭션 전체 롤백 → 입금은
    // tx_hash 중복 가드로 멱등 재처리되니 안전(Codex 검토 반영).
    await require('./treasury').adjustCollateral(client, amountNum);

    // [첫 결제 후크] 첫 입금이면 추가 PP 보너스(first_deposit_bonus_pct, 기본 20%). PP만 추가 → 담보 불변식 무관.
    //   이 deposit row INSERT 전에 조회하므로 prior 0건 = 진짜 첫 입금.
    let firstDepBonus = 0;
    try {
      const prior = await client.query('SELECT 1 FROM deposits WHERE LOWER(wallet_address) = LOWER($1) LIMIT 1', [wallet]);
      if (prior.rows.length === 0) {
        const fr = await client.query(`SELECT value FROM settings WHERE key = 'first_deposit_bonus_pct'`);
        const firstPct = fr.rows.length ? (parseFloat(fr.rows[0].value) || 0) : 0;
        if (firstPct > 0) {
          firstDepBonus = Math.round(amountNum * (firstPct / 100) * 1000000) / 1000000;
          // [경제정책 W2-4 / v2 P4] 첫 입금 보너스도 입금 origin → withdrawablePct 만 redeemable 적립.
          const firstRedeemable = Math.round(firstDepBonus * (withdrawablePct / 100) * 1000000) / 1000000;
          await client.query('UPDATE users SET pp_balance = pp_balance + $1, redeemable_pp = redeemable_pp + $3 WHERE LOWER(wallet_address) = LOWER($2)', [firstDepBonus, wallet, firstRedeemable]);
          console.log(`[Chain] First-deposit bonus +${firstDepBonus} PP (${firstPct}%) to ${wallet.slice(0,8)}…`);
        }
      }
    } catch (_) {}

    // Insert deposit record
    await client.query(
      `INSERT INTO deposits (wallet_address, amount, pp_bonus, chain, tx_hash, block_number) VALUES ($1,$2,$3,$4,$5,$6)`,
      [wallet, amountNum, ppBonus, chain, txHash, blockNumber]
    );

    // Insert transaction
    await client.query(
      `INSERT INTO transactions (type, from_wallet, usdt_amount, pp_amount, meta)
       VALUES ('deposit', $1, $2, $3, $4)`,
      [wallet, amountNum, ppBonus, JSON.stringify({ chain, txHash, blockNumber })]
    );

    // Award XP for deposit ($1 = 1 XP)
    const depositXP = Math.max(1, Math.floor(amountNum));
    await awardXP(client, wallet, depositXP);

    // Referral commission (DYNASTY) — uplines get a PP cut of the deposit USDT
    try {
      await creditReferralCommission(client, wallet, 'deposit', amountNum, 'pp');
    } catch (_e) { /* non-critical */ }

    await client.query('COMMIT');
    console.log(`[Chain] Deposit: ${wallet.slice(0, 8)}... +${amountNum} USDT +${ppBonus} PP +${depositXP} XP (${chain}, ${ppBonusPct}%)`);
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

module.exports = { startListeners, processDeposit, settleWithdrawal, reconcilePendingWithdrawals };
