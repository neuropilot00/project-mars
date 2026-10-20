const { ethers } = require('ethers');
const { pool, ensureUser, awardXP, creditReferralCommission } = require('../db');
const { financialNumber } = require('./treasury');

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
      cachedPpBonusPct = financialNumber(res.rows[0].value, 'deposit_pp_bonus');
    } else {
      cachedPpBonusPct = DEFAULT_PP_BONUS_PCT;
    }
  } catch (e) {
    throw new Error('Deposit bonus configuration unavailable: ' + e.message);
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
        await backfillEvents(key, contract, provider, cfg.decimals);
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
          await backfillEvents(key, listeners[key].contract, provider, CHAIN_CONFIGS[key].decimals);
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

// An observed event is only a hint. Settlement also requires finalized nonce
// advancement; a latest event can disappear in a reorg.
async function settleWithdrawal({ wallet, nonce, chain }) {
  const state = await require('./signer').getFinalizedWithdrawState(wallet, chain);
  if (state.nonce <= nonce) return;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT 1 FROM users WHERE LOWER(wallet_address)=LOWER($1) FOR UPDATE', [wallet]);
    await client.query("SELECT pg_advisory_xact_lock(hashtext('withdraw_liquidity:' || $1))", [chain]);
    await client.query(
      `UPDATE pending_withdrawals SET status='settled', settled_at=NOW()
        WHERE chain=$1 AND LOWER(wallet_address)=LOWER($2) AND nonce=$3 AND status='pending'`,
      [chain, wallet, nonce]
    );
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally { client.release(); }
}

// Only a finalized block strictly AFTER deadline with the SAME nonce proves
// non-execution: the contract accepts block.timestamp == deadline. Unknown RPC,
// nonce behind the reservation, or finality before expiry leaves funds reserved.
async function reconcilePendingWithdrawals() {
  const grace = financialNumber(process.env.WITHDRAW_RECONCILE_GRACE_SEC ?? 120, 'WITHDRAW_RECONCILE_GRACE_SEC');
  const rows = (await pool.query(
    `SELECT id, wallet_address, chain, nonce, gross, net, deadline FROM pending_withdrawals
      WHERE status='pending' AND deadline + $1 < EXTRACT(EPOCH FROM NOW())::bigint
      ORDER BY id ASC LIMIT 100`, [grace]
  )).rows;
  for (const r of rows) {
    let state;
    try { state = await require('./signer').getFinalizedWithdrawState(r.wallet_address, r.chain); }
    catch (_) { continue; }
    if (!Number.isSafeInteger(state.nonce) || !Number.isSafeInteger(state.timestamp)) continue;
    const executed = state.nonce > Number(r.nonce);
    const expired = state.nonce === Number(r.nonce) && state.timestamp > Number(r.deadline);
    if (!executed && !expired) continue;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      // Match withdraw lock order: user -> chain reservation -> pending -> treasury.
      const user = await client.query('SELECT 1 FROM users WHERE LOWER(wallet_address)=LOWER($1) FOR UPDATE', [r.wallet_address]);
      if (!user.rows.length) throw new Error('Pending withdrawal user missing');
      await client.query("SELECT pg_advisory_xact_lock(hashtext('withdraw_liquidity:' || $1))", [r.chain]);
      const cur = await client.query('SELECT status FROM pending_withdrawals WHERE id=$1 FOR UPDATE', [r.id]);
      if (!cur.rows.length || cur.rows[0].status !== 'pending') { await client.query('ROLLBACK'); continue; }
      if (executed) {
        await client.query(`UPDATE pending_withdrawals SET status='settled', settled_at=NOW() WHERE id=$1`, [r.id]);
      } else {
        await client.query('UPDATE users SET usdt_balance=usdt_balance+$1 WHERE LOWER(wallet_address)=LOWER($2)', [r.gross, r.wallet_address]);
        await require('./treasury').adjustCollateral(client, Number(r.net));
        await client.query(`UPDATE pending_withdrawals SET status='expired', settled_at=NOW() WHERE id=$1`, [r.id]);
        await client.query(
          `INSERT INTO transactions (type, from_wallet, usdt_amount, meta) VALUES ('withdraw_refund', $1, $2, $3)`,
          [String(r.wallet_address).toLowerCase(), r.gross, JSON.stringify({ chain: r.chain, nonce: Number(r.nonce), reason: 'finalized_expired_unclaimed', blockNumber: state.blockNumber, blockHash: state.blockHash })]
        );
      }
      await client.query('COMMIT');
    } catch (e) {
      try { await client.query('ROLLBACK'); } catch (_) {}
      console.error('[Chain] reconcile withdrawal error:', e.message);
    } finally { client.release(); }
  }
}

async function backfillEvents(chainKey, contract, provider, decimals) {
  // Get last processed block for this chain
  const res = await pool.query(
    `SELECT MAX(block_number) as last_block FROM deposits WHERE chain = $1`,
    [chainKey]
  );
  const lastBlock = res.rows[0].last_block || 0;
  const currentBlock = (await require('./signer').getFinalizedBlock(chainKey)).number;
  // 커서: deposits.MAX(block_number) 가 곧 커서다. 이전 입금이 있으면 그 블록부터(같은 블록의 다른 로그 재처리 포함)
  // "전부" 스캔(누락 0). 과거의 currentBlock-1000 floor 는 워커 장기 다운 시 그 사이 블록을
  // 통째로 건너뛰어 입금이 영구 유실되던 CRITICAL 결함 → 제거.
  // 최초(입금 이력 0)에만 cold-start 로 최근 BACKFILL_BLOCKS 블록만 본다.
  const BACKFILL_BLOCKS = parseInt(process.env.BACKFILL_BLOCKS || '1000', 10) || 1000;
  let fromBlock = lastBlock > 0 ? Number(lastBlock) : Math.max(0, currentBlock - BACKFILL_BLOCKS);
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
      throw new Error(`Finalized backfill gap ${start}~${end}: ${qe.message}`);
    }
    for (const event of events) {
      try {
        await processDeposit({
          wallet: event.args.user.toLowerCase(),
          amount: ethers.utils.formatUnits(event.args.amount, decimals),
          chain: chainKey,
          txHash: event.transactionHash,
          blockNumber: event.blockNumber, blockHash: event.blockHash, logIndex: event.logIndex
        });
      } catch (e) {
        // Never advance the deposit-derived cursor past an unprocessed event.
        throw e;
      }
    }
  }
}

async function processDeposit({ wallet, amount, chain, txHash, blockNumber, blockHash, logIndex }) {
  if (!CHAIN_CONFIGS[chain] || !Number.isSafeInteger(logIndex) || logIndex < 0 || !/^0x[0-9a-fA-F]{64}$/.test(txHash || '')) throw new Error('Missing deposit log identity');
  await require('./signer').verifyFinalizedEvent(chain, blockNumber, blockHash);
  const amountNum = financialNumber(amount, 'deposit amount');
  // [v7.163 hotfix] 음수/0/NaN amount 차단(외부 RPC/admin replay 오염 방지 — 음수 시 잔액 차감 가능).
  if (!(amountNum > 0) || !isFinite(amountNum)) {
    console.warn('[chain] processDeposit refused — invalid amount:', amount, 'tx:', txHash);
    return;
  }
  const ppBonusPct = await getPpBonusPct();
  const ppBonus = Math.round(amountNum * (ppBonusPct / 100) * 1000000) / 1000000;

  // [경제v2 P4] 출금 한도 — 입금 origin PP 의 일정 %만 USDT 환매(redeemable)로 적립. 나머지는 영구 버퍼.
  //   PP=입금 발행 전용(무료 faucet 없음)이라 redeemable 버킷이 곧 입금 담보분의 출금 가능 한도.
  const wr = await pool.query(`SELECT value FROM settings WHERE key = 'pp_withdrawable_pct'`);
  const withdrawablePct = financialNumber(wr.rows[0]?.value ?? 80, 'pp_withdrawable_pct', { max: 100 });
  const redeemableBonus = Math.round(ppBonus * (withdrawablePct / 100) * 1000000) / 1000000;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Ensure user exists
    await ensureUser(client, wallet);

    // [v7.165] users 행 FOR UPDATE 잠금 — 동시 deposit listener / 첫 입금 보너스 체크 race window 차단.
    //   prior deposits 0건 SELECT ↔ deposits INSERT 사이에 다른 워커가 같은 wallet 처리 시
    //   양쪽 모두 prior 0 → 보너스 중복 지급 가능 위험 차단.
    await client.query(`SELECT 1 FROM users WHERE LOWER(wallet_address) = LOWER($1) FOR UPDATE`, [wallet]);

    // Legacy rows lack log identity: conservatively treat their transaction as
    // already credited. New receipts identify each log independently across chains.
    const legacy = await client.query('SELECT id FROM deposits WHERE chain=$1 AND tx_hash=$2 AND log_index=-1', [chain, txHash]);
    if (legacy.rows.length) { await client.query('ROLLBACK'); return; }
    const inserted = await client.query(
      `INSERT INTO deposits (wallet_address, amount, pp_bonus, chain, tx_hash, block_number, block_hash, log_index)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (chain, tx_hash, log_index) DO NOTHING RETURNING id`,
      [wallet, amountNum, ppBonus, chain, txHash, blockNumber, blockHash, logIndex]
    );
    if (!inserted.rowCount) { await client.query('ROLLBACK'); return; }

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
    //   Exclude the newly inserted log when checking for a prior deposit.
    let firstDepBonus = 0;
    try {
      const prior = await client.query('SELECT 1 FROM deposits WHERE LOWER(wallet_address) = LOWER($1) AND id <> $2 LIMIT 1', [wallet, inserted.rows[0].id]);
      if (prior.rows.length === 0) {
        const fr = await client.query(`SELECT value FROM settings WHERE key = 'first_deposit_bonus_pct'`);
        const firstPct = financialNumber(fr.rows[0]?.value ?? 0, 'first_deposit_bonus_pct');
        if (firstPct > 0) {
          firstDepBonus = Math.round(amountNum * (firstPct / 100) * 1000000) / 1000000;
          // [경제정책 W2-4 / v2 P4] 첫 입금 보너스도 입금 origin → withdrawablePct 만 redeemable 적립.
          const firstRedeemable = Math.round(firstDepBonus * (withdrawablePct / 100) * 1000000) / 1000000;
          await client.query('UPDATE users SET pp_balance = pp_balance + $1, redeemable_pp = redeemable_pp + $3 WHERE LOWER(wallet_address) = LOWER($2)', [firstDepBonus, wallet, firstRedeemable]);
          console.log(`[Chain] First-deposit bonus +${firstDepBonus} PP (${firstPct}%) to ${wallet.slice(0,8)}…`);
        }
      }
    } catch (e) { throw e; }

    // Insert transaction
    await client.query(
      `INSERT INTO transactions (type, from_wallet, usdt_amount, pp_amount, meta)
       VALUES ('deposit', $1, $2, $3, $4)`,
      [wallet, amountNum, ppBonus, JSON.stringify({ chain, txHash, blockNumber, blockHash, logIndex, finalized: true })]
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
