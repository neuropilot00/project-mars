// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title MockTestUSDC — 테스트넷 전용 USDC 모형 토큰 (6 decimals)
 * @notice ⚠️ 테스트넷 전용. 메인넷에서는 실제 USDC 주소를 사용할 것(이 컨트랙트 배포 금지).
 *         public mint 가 열려 있어 누구나 발행 가능 — 테스트 편의용.
 */
contract MockTestUSDC is ERC20 {
    constructor() ERC20("Test USDC", "tUSDC") {
        _mint(msg.sender, 1_000_000 * 10 ** 6); // 배포자에게 1,000,000 tUSDC
    }

    function decimals() public pure override returns (uint8) {
        return 6; // USDC 와 동일
    }

    /// @notice 테스트용 무제한 mint (테스트넷 전용)
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
