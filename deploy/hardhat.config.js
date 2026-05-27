require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

// 배포자 개인키 (테스트넷 전용, 가스용 ETH 보유). .env 에 DEPLOYER_PRIVATE_KEY 설정.
const PK = (process.env.DEPLOYER_PRIVATE_KEY || "").trim();

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.20",
    settings: { optimizer: { enabled: true, runs: 200 } }
  },
  // 컨트랙트 소스: deploy/contracts 는 리포 루트 contracts/ 로의 심볼릭 링크
  // (MarsDeposit.sol, MockTestUSDC.sol). Hardhat 은 프로젝트 내부 경로만 허용하므로 심링크 사용.
  paths: { sources: "contracts" },
  networks: {
    baseSepolia: {
      url: process.env.BASE_SEPOLIA_RPC || "https://sepolia.base.org",
      chainId: 84532,
      accounts: PK ? [PK] : []
    },
    // 메인넷 전환 시 사용
    base: {
      url: process.env.BASE_RPC || "https://mainnet.base.org",
      chainId: 8453,
      accounts: PK ? [PK] : []
    }
  },
  etherscan: {
    apiKey: {
      baseSepolia: process.env.BASESCAN_API_KEY || "",
      base: process.env.BASESCAN_API_KEY || ""
    },
    customChains: [
      { network: "baseSepolia", chainId: 84532, urls: { apiURL: "https://api-sepolia.basescan.org/api", browserURL: "https://sepolia.basescan.org" } },
      { network: "base", chainId: 8453, urls: { apiURL: "https://api.basescan.org/api", browserURL: "https://basescan.org" } }
    ]
  }
};
