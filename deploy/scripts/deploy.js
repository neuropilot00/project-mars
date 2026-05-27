// MarsDeposit + (테스트넷) MockTestUSDC 배포 스크립트
//   - USDC_ADDRESS 미설정 시: MockTestUSDC 배포 + 컨트랙트에 출금 유동성 충전(테스트넷).
//   - USDC_ADDRESS 설정 시(메인넷 등): 그 토큰 주소로 MarsDeposit 만 배포.
// 사용: cd deploy && npm install && npm run deploy:base-sepolia
const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const treasury = (process.env.TREASURY_ADDRESS || deployer.address);
  const signer   = (process.env.SIGNER_ADDRESS   || deployer.address);

  console.log("── 배포 시작 ──");
  console.log("network :", hre.network.name);
  console.log("deployer:", deployer.address);
  console.log("treasury:", treasury);
  console.log("signer  :", signer, "(SIGNER_PRIVATE_KEY 의 주소와 동일해야 함)");

  // 1) USDC 토큰 (테스트넷이면 Mock 배포)
  let usdtAddr = (process.env.USDC_ADDRESS || "").trim();
  let mock = null;
  if (!usdtAddr) {
    console.log("\nUSDC_ADDRESS 미설정 → MockTestUSDC 배포(테스트넷)...");
    const Mock = await hre.ethers.getContractFactory("MockTestUSDC");
    mock = await Mock.deploy();
    await mock.waitForDeployment();
    usdtAddr = await mock.getAddress();
    console.log("MockTestUSDC :", usdtAddr);
  } else {
    console.log("\n기존 USDC 사용:", usdtAddr);
  }

  // 2) MarsDeposit 배포
  const Mars = await hre.ethers.getContractFactory("MarsDeposit");
  const mars = await Mars.deploy(usdtAddr, treasury, signer);
  await mars.waitForDeployment();
  const marsAddr = await mars.getAddress();
  console.log("MarsDeposit  :", marsAddr);

  // 3) 테스트넷이면 출금 유동성 충전(컨트랙트로 tUSDC 전송)
  if (mock) {
    const liquidity = 100_000n * (10n ** 6n); // 100,000 tUSDC
    const tx = await mock.transfer(marsAddr, liquidity);
    await tx.wait();
    console.log("출금 유동성 충전: 100,000 tUSDC → MarsDeposit");
  }

  console.log("\n════════ server/.env 에 붙여넣기 ════════");
  console.log("BASE_CHAIN_ID=84532");
  console.log("BASE_RPC_URL=" + (process.env.BASE_SEPOLIA_RPC || "https://sepolia.base.org"));
  console.log("BASE_DEPOSIT_ADDRESS=" + marsAddr);
  console.log("# (참고) USDC 토큰 주소:", usdtAddr);
  console.log("# SIGNER_PRIVATE_KEY 는 signer 주소(" + signer + ")의 개인키여야 함");
  console.log("════════════════════════════════════════");
  console.log("\n검증(선택): npm run verify:base-sepolia -- " + marsAddr + " " + usdtAddr + " " + treasury + " " + signer);
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
