// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title MarsDeposit — USDT 입출금 컨트랙트
 * @notice 입금/출금 모두 온체인 처리, 게임 로직은 서버 DB
 *
 *  ┌──────────────────────────────────────────────┐
 *  │  온체인 (이 컨트랙트)                          │
 *  │  ├─ deposit(amount)                          │
 *  │  │   → USDT 유저→컨트랙트 보관                 │
 *  │  │   → Deposited 이벤트 → 서버 감지            │
 *  │  │                                           │
 *  │  ├─ withdraw(user, amount, nonce, sig)        │
 *  │  │   → 서버 서명 검증 후 USDT 컨트랙트→유저     │
 *  │  │   → Withdrawn 이벤트                       │
 *  │  │                                           │
 *  │  └─ collectRevenue(amount)  [onlyOwner]       │
 *  │      → 수익금(수수료 등) Treasury로 인출        │
 *  │                                              │
 *  │  오프체인 (서버 DB)                            │
 *  │  ├─ USDT/PP Balance 관리                      │
 *  │  ├─ 클레임/하이재킹/환전 로직                    │
 *  │  └─ 출금 승인 시 서명 생성 → 유저가 tx 실행     │
 *  └──────────────────────────────────────────────┘
 *
 *  멀티체인: Base, BNB, Ethereum 각각 배포
 */
contract MarsDeposit is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable usdt;
    address public treasury;
    address public signer;  // 출금 승인 서명자 (서버 키)

    uint256 public totalDeposited;
    uint256 public totalWithdrawn;

    mapping(address => uint256) public userTotalDeposited;
    mapping(address => uint256) public userTotalWithdrawn;

    // 출금 nonce (리플레이 방지)
    mapping(address => uint256) public withdrawNonce;

    // ── Events ──

    event Deposited(
        address indexed user,
        uint256 amount,
        uint256 timestamp,
        uint256 chainId
    );

    event Withdrawn(
        address indexed user,
        uint256 amount,
        uint256 fee,
        uint256 nonce,
        uint256 chainId
    );

    event RevenueCollected(uint256 amount);
    event SignerUpdated(address indexed oldSigner, address indexed newSigner);
    event TreasuryUpdated(address indexed oldTreasury, address indexed newTreasury);

    // ── Constructor ──

    constructor(
        address _usdt,
        address _treasury,
        address _signer
    ) Ownable(msg.sender) {
        require(_usdt != address(0), "Zero USDT");
        require(_treasury != address(0), "Zero treasury");
        require(_signer != address(0), "Zero signer");
        usdt = IERC20(_usdt);
        treasury = _treasury;
        signer = _signer;
    }

    // ══════════════════════════════════════════════════════
    //  Deposit: USDT → 컨트랙트 보관
    // ══════════════════════════════════════════════════════

    /**
     * @notice USDT 입금. 컨트랙트가 보관.
     *         서버가 Deposited 이벤트 감지 → DB에 잔고 반영 + 10% PP 보너스.
     * @param amount 입금 수량 (USDT 6 decimals)
     */
    function deposit(uint256 amount) external nonReentrant {
        require(amount > 0, "Zero amount");

        usdt.safeTransferFrom(msg.sender, address(this), amount);

        userTotalDeposited[msg.sender] += amount;
        totalDeposited += amount;

        emit Deposited(msg.sender, amount, block.timestamp, block.chainid);
    }

    // ══════════════════════════════════════════════════════
    //  Withdraw: 서버 서명 검증 → USDT 유저에게 전송
    // ══════════════════════════════════════════════════════

    /**
     * @notice USDT 출금. 서버가 발급한 서명 필요.
     * @dev 흐름: 유저가 서버에 출금 요청 → 서버가 DB 검증 후 서명 발급
     *      → 유저가 이 함수 호출 (가스비 유저 부담)
     *      → 서명 검증 성공 시 USDT 전송
     *
     * @param amount 출금할 USDT (수수료 차감 후 유저 수령액)
     * @param fee    수수료 (Treasury로 전송)
     * @param nonce  리플레이 방지 nonce (서버가 관리)
     * @param deadline 서명 유효기간 (unix timestamp)
     * @param signature 서버의 EIP-191 서명
     */
    function withdraw(
        uint256 amount,
        uint256 fee,
        uint256 nonce,
        uint256 deadline,
        bytes calldata signature
    ) external nonReentrant {
        require(amount > 0, "Zero amount");
        require(block.timestamp <= deadline, "Signature expired");
        require(nonce == withdrawNonce[msg.sender], "Invalid nonce");

        // 서명 검증
        bytes32 hash = keccak256(abi.encodePacked(
            "\x19Ethereum Signed Message:\n32",
            keccak256(abi.encodePacked(
                msg.sender,
                amount,
                fee,
                nonce,
                deadline,
                block.chainid,
                address(this)
            ))
        ));
        require(_recoverSigner(hash, signature) == signer, "Invalid signature");

        // 상태 변경 (CEI 패턴)
        withdrawNonce[msg.sender]++;
        userTotalWithdrawn[msg.sender] += amount + fee;
        totalWithdrawn += amount + fee;

        // USDT 전송
        usdt.safeTransfer(msg.sender, amount);
        if (fee > 0) {
            usdt.safeTransfer(treasury, fee);
        }

        emit Withdrawn(msg.sender, amount, fee, nonce, block.chainid);
    }

    // ══════════════════════════════════════════════════════
    //  Admin
    // ══════════════════════════════════════════════════════

    /**
     * @notice 수익금(수수료 누적분) Treasury로 인출
     * @dev 유저 예치금을 초과 인출하지 않도록 서버에서 관리
     */
    function collectRevenue(uint256 amount) external onlyOwner nonReentrant {
        require(amount > 0, "Zero amount");
        usdt.safeTransfer(treasury, amount);
        emit RevenueCollected(amount);
    }

    function setSigner(address _signer) external onlyOwner {
        require(_signer != address(0), "Zero address");
        emit SignerUpdated(signer, _signer);
        signer = _signer;
    }

    function setTreasury(address _treasury) external onlyOwner {
        require(_treasury != address(0), "Zero address");
        emit TreasuryUpdated(treasury, _treasury);
        treasury = _treasury;
    }

    // ══════════════════════════════════════════════════════
    //  View
    // ══════════════════════════════════════════════════════

    function getUserDeposited(address user) external view returns (uint256) {
        return userTotalDeposited[user];
    }

    function getUserWithdrawn(address user) external view returns (uint256) {
        return userTotalWithdrawn[user];
    }

    function getContractBalance() external view returns (uint256) {
        return usdt.balanceOf(address(this));
    }

    function getUserNonce(address user) external view returns (uint256) {
        return withdrawNonce[user];
    }

    // ══════════════════════════════════════════════════════
    //  Internal: ECDSA 서명 복원
    // ══════════════════════════════════════════════════════

    function _recoverSigner(bytes32 hash, bytes calldata sig) internal pure returns (address) {
        require(sig.length == 65, "Invalid sig length");
        bytes32 r;
        bytes32 s;
        uint8 v;
        assembly {
            r := calldataload(sig.offset)
            s := calldataload(add(sig.offset, 32))
            v := byte(0, calldataload(add(sig.offset, 64)))
        }
        if (v < 27) v += 27;
        require(v == 27 || v == 28, "Invalid sig v");
        address recovered = ecrecover(hash, v, r, s);
        require(recovered != address(0), "Invalid sig");
        return recovered;
    }
}
