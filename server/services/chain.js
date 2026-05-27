const { ethers } = require('ethers');
const { pool, ensureUser, awardXP, creditReferralCommission } = require('../db');

const DEPOSIT_ABI = [
  'event Deposited(address indexed user, uint256 amount, uint256 timestamp, uint256 chainId)'
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

  retryState[key] = { delay, timer };
}

// ── Health check ──

let healthCheckTimer = null;

function startHealthCheck() {
  if (healthCheckTimer) return;
  healthCheckTimer = setInterval(async () => {
    for (const [key, { provider }] of Object.entries(listeners)) {
      try {
        const blockNumber = await provider.getBlockNumber();
        console.log(`[Chain] Health: ${CHAIN_CONFIGS[key].name} latest block #${blockNumber}`);
      } catch (e) {
        console.error(`[Chain] Health: ${CHAIN_CONFIGS[key].name} unreachable — ${e.message}`);
        handleDisconnect(key, CHAIN_CONFIGS[key]);
      }
    }
  }, HEALTH_CHECK_INTERVAL_MS);
}

// ── Start all listeners ──

async function startListeners() {
  for (const [key, cfg] of Object.entries(CHAIN_CONFIGS)) {
    await connectChain(key, cfg);
  }
  startHealthCheck();
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
  const ppBonusPct = await getPpBonusPct();
  const ppBonus = Math.round(amountNum * (ppBonusPct / 100) * 1000000) / 1000000;

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

    // Update user balances
    await client.query(
      `UPDATE users SET usdt_balance = usdt_balance + $1, pp_balance = pp_balance + $2 WHERE LOWER(wallet_address) = LOWER($3)`,
      [amountNum, ppBonus, wallet]
    );

    // ✅ [솔벤시] 실입금 USDT 만큼 담보(collateral) 증액 — usdt_balance 와 함께 늘어 불변식 유지.
    // 실패를 삼키면 collateral 누락(과소담보)이 되므로 던져서 트랜잭션 전체 롤백 → 입금은
    // tx_hash 중복 가드로 멱등 재처리되니 안전(Codex 검토 반영).
    await require('./treasury').adjustCollateral(client, amountNum);

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

module.exports = { startListeners, processDeposit };
