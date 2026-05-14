const { ethers } = require('ethers');

// Chain configs matching frontend + smart contract
const CHAINS = {
  base: { chainId: 8453, decimals: 6, rpcEnvKey: 'BASE_RPC_URL', depositEnvKey: 'BASE_DEPOSIT_ADDRESS' },
  bnb:  { chainId: 56,   decimals: 18, rpcEnvKey: 'BNB_RPC_URL',  depositEnvKey: 'BNB_DEPOSIT_ADDRESS' },
  eth:  { chainId: 1,    decimals: 6, rpcEnvKey: 'ETH_RPC_URL',   depositEnvKey: 'ETH_DEPOSIT_ADDRESS' }
};

const DEPOSIT_ABI = [
  'function getContractBalance() view returns (uint256)'
];

let signerWallet = null;
const providers = new Map();

function init() {
  if (!process.env.SIGNER_PRIVATE_KEY) {
    console.warn('[Signer] No SIGNER_PRIVATE_KEY set — withdrawal signing disabled');
    return;
  }
  signerWallet = new ethers.Wallet(process.env.SIGNER_PRIVATE_KEY);
  console.log('[Signer] Initialized, address:', signerWallet.address);
}

/**
 * Generate EIP-191 withdrawal signature matching MarsDeposit.sol
 *
 * Contract verifies:
 *   hash = keccak256(abi.encodePacked(
 *     "\x19Ethereum Signed Message:\n32",
 *     keccak256(abi.encodePacked(user, amount, fee, nonce, deadline, chainId, contractAddress))
 *   ))
 *
 * ethers.signMessage auto-prepends the EIP-191 prefix
 */
async function generateWithdrawSignature(userAddress, amountBN, feeBN, nonce, chainKey) {
  if (!signerWallet) throw new Error('Signer not initialized');

  const cfg = CHAINS[chainKey];
  if (!cfg) throw new Error('Unknown chain: ' + chainKey);

  const contractAddress = getDepositAddress(chainKey);
  const deadline = Math.floor(Date.now() / 1000) + 600; // 10 min expiry

  // Inner hash (matches contract's abi.encodePacked)
  const innerHash = ethers.utils.solidityKeccak256(
    ['address', 'uint256', 'uint256', 'uint256', 'uint256', 'uint256', 'address'],
    [userAddress, amountBN, feeBN, nonce, deadline, cfg.chainId, contractAddress]
  );

  // signMessage auto-prepends "\x19Ethereum Signed Message:\n32"
  const signature = await signerWallet.signMessage(ethers.utils.arrayify(innerHash));

  return {
    amount: amountBN.toString(),
    fee: feeBN.toString(),
    nonce: nonce,
    deadline: deadline,
    chainId: cfg.chainId,
    signature: signature
  };
}

function getDepositAddress(chainKey) {
  const cfg = CHAINS[chainKey];
  if (!cfg) throw new Error('Unknown chain: ' + chainKey);
  const address = (process.env[cfg.depositEnvKey] || '').trim();
  if (!address) {
    throw new Error(`Missing deposit contract address for ${chainKey} (${cfg.depositEnvKey})`);
  }
  if (!ethers.utils.isAddress(address) || address === ethers.constants.AddressZero) {
    throw new Error(`Invalid deposit contract address for ${chainKey} (${cfg.depositEnvKey})`);
  }
  return address;
}

function getRpcUrl(chainKey) {
  const cfg = CHAINS[chainKey];
  if (!cfg) throw new Error('Unknown chain: ' + chainKey);
  const rpcUrl = (process.env[cfg.rpcEnvKey] || '').trim();
  if (!rpcUrl) {
    throw new Error(`Missing RPC URL for ${chainKey} (${cfg.rpcEnvKey})`);
  }
  return rpcUrl;
}

function getProvider(chainKey) {
  if (!providers.has(chainKey)) {
    providers.set(chainKey, new ethers.providers.JsonRpcProvider(getRpcUrl(chainKey)));
  }
  return providers.get(chainKey);
}

async function getAvailableLiquidity(chainKey) {
  const provider = getProvider(chainKey);
  const contractAddress = getDepositAddress(chainKey);
  const contract = new ethers.Contract(contractAddress, DEPOSIT_ABI, provider);
  return contract.getContractBalance();
}

function getSignerAddress() {
  return signerWallet ? signerWallet.address : null;
}

module.exports = { init, generateWithdrawSignature, getAvailableLiquidity, getDepositAddress, getSignerAddress, CHAINS };
