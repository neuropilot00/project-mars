const { ethers } = require('ethers');
const { pool, ensureUser } = require('../db');

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

async function startListeners() {
  for (const [key, cfg] of Object.entries(CHAIN_CONFIGS)) {
    const rpcUrl = process.env[cfg.rpcEnv];
    const contractAddr = process.env[cfg.addrEnv];

    if (!rpcUrl || !contractAddr || contractAddr === '0x0000000000000000000000000000000000000000') {
      console.log(`[Chain] ${cfg.name}: skipped (no RPC or contract address)`);
      continue;
    }

    try {
      const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
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

      listeners[key] = { provider, contract };
      console.log(`[Chain] ${cfg.name}: listening on ${contractAddr.slice(0, 10)}...`);

      // Backfill recent events (last 1000 blocks)
      backfillEvents(key, contract, provider, cfg.decimals).catch(e => {
        console.warn(`[Chain] ${cfg.name} backfill error:`, e.message);
      });
    } catch (e) {
      console.error(`[Chain] ${cfg.name} init error:`, e.message);
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
  const fromBlock = Math.max(lastBlock + 1, currentBlock - 1000);

  if (fromBlock > currentBlock) return;

  console.log(`[Chain] ${CHAIN_CONFIGS[chainKey].name}: backfilling blocks ${fromBlock} → ${currentBlock}`);
  const events = await contract.queryFilter('Deposited', fromBlock, currentBlock);

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

async function processDeposit({ wallet, amount, chain, txHash, blockNumber }) {
  const amountNum = parseFloat(amount);
  const ppBonus = Math.round(amountNum * 0.10 * 1000000) / 1000000; // 10% PP bonus

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
      `UPDATE users SET usdt_balance = usdt_balance + $1, pp_balance = pp_balance + $2 WHERE wallet_address = $3`,
      [amountNum, ppBonus, wallet]
    );

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

    await client.query('COMMIT');
    console.log(`[Chain] Deposit: ${wallet.slice(0, 8)}... +${amountNum} USDT +${ppBonus} PP (${chain})`);
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

module.exports = { startListeners, processDeposit };
