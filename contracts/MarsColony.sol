// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title MarsColony — PIXEL WAR v9.3: RED COLONIZATION
 * @notice 화성 영토 분양 + 이원화 재화 (USDT / PP) + 하이재킹 배당 시스템
 *
 *  ┌─────────────────────────────────────────────────────┐
 *  │  재화 구조                                           │
 *  │  ├─ USDT Balance : 실제 USDT, 출금 가능              │
 *  │  └─ PP Balance   : 보너스 포인트, 출금 시 5% 수수료    │
 *  │                                                     │
 *  │  입금: depositUSDT(amount)                           │
 *  │    → USDT Balance += amount                         │
 *  │    → PP Balance   += amount * 10%  (보너스)          │
 *  │                                                     │
 *  │  클레임/하이재킹: USDT 또는 PP로 결제 가능              │
 *  │    → 결제 우선순위: PP 먼저 차감 → 부족분 USDT 차감    │
 *  │                                                     │
 *  │  하이재킹 보상: 기존 소유자에게 PP로 지급               │
 *  │    → 원금 100% + 프리미엄 50% → PP Balance            │
 *  │    → 프리미엄 50% → Treasury                         │
 *  │                                                     │
 *  │  환전: swapPPtoUSDT(amount)                          │
 *  │    → 95% USDT 유저 지갑 전송                          │
 *  │    → 5% USDT Treasury 전송 (수수료)                   │
 *  │                                                     │
 *  │  전액 출금: withdrawAll()                             │
 *  │    → PP+USDT 전부 출금 (5% 수수료)                    │
 *  │    → 해당 유저의 모든 픽셀 소유권 리셋                  │
 *  └─────────────────────────────────────────────────────┘
 */
contract MarsColony is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ══════════════════════════════════════════════════════
    //  Constants
    // ══════════════════════════════════════════════════════

    IERC20 public immutable usdt;
    address public treasury;

    uint256 public constant BASE_PRICE      = 100e6;    // 100 USDT (6 decimals)
    uint256 public constant HIJACK_NUM      = 120;      // 1.2×
    uint256 public constant HIJACK_DEN      = 100;
    uint256 public constant PREMIUM_SPLIT   = 50;       // 50% to prev owner, 50% to treasury
    uint256 public constant DEPOSIT_BONUS   = 10;       // 10% PP bonus on deposit
    uint256 public constant SWAP_FEE        = 5;        // 5% withdrawal fee
    uint256 public constant PERCENT_BASE    = 100;

    // ══════════════════════════════════════════════════════
    //  State
    // ══════════════════════════════════════════════════════

    struct Plot {
        address owner;
        uint256 price;       // 마지막 거래 가격 (USDT 단위)
        string  imageUri;
        uint64  claimedAt;
    }

    // plotId = keccak256(lat, lng)
    mapping(bytes32 => Plot) public plots;
    bytes32[] public plotList;

    // 이원화 잔고
    mapping(address => uint256) public usdtBalance;  // 출금 가능 USDT
    mapping(address => uint256) public ppBalance;     // 보너스 포인트 (게임 내 재화)

    // 유저별 소유 플롯 추적 (전액 출금 시 리셋용)
    mapping(address => bytes32[]) private userPlots;

    uint256 public totalPlots;
    uint256 public totalVolume;
    uint256 public totalDeposited;

    // ══════════════════════════════════════════════════════
    //  Events
    // ══════════════════════════════════════════════════════

    event Deposited(address indexed user, uint256 usdtAmount, uint256 ppBonus);
    event Withdrawn(address indexed user, uint256 usdtOut, uint256 feeTreasury);

    event Claimed(
        bytes32 indexed plotId,
        address indexed owner,
        int256 lat, int256 lng,
        uint256 price,
        string imageUri
    );

    event Hijacked(
        bytes32 indexed plotId,
        address indexed newOwner,
        address indexed prevOwner,
        uint256 hijackPrice,
        uint256 prevOwnerPayout
    );

    event PlotReset(bytes32 indexed plotId, address indexed previousOwner);
    event FullWithdraw(address indexed user, uint256 totalOut, uint256 plotsReset);
    event SwappedPP(address indexed user, uint256 ppAmount, uint256 usdtOut, uint256 fee);

    // ══════════════════════════════════════════════════════
    //  Constructor
    // ══════════════════════════════════════════════════════

    constructor(address _usdt, address _treasury) Ownable(msg.sender) {
        require(_usdt != address(0), "Zero USDT");
        require(_treasury != address(0), "Zero treasury");
        usdt = IERC20(_usdt);
        treasury = _treasury;
    }

    // ══════════════════════════════════════════════════════
    //  Deposit: USDT 입금 + 10% PP 보너스
    // ══════════════════════════════════════════════════════

    /**
     * @notice USDT를 컨트랙트에 예치. 10% PP 보너스 자동 지급.
     * @param amount 입금할 USDT 수량 (6 decimals)
     */
    function depositUSDT(uint256 amount) external nonReentrant {
        require(amount > 0, "Zero amount");

        // 외부 전송 먼저 (CEI 패턴: 외부 호출 → 상태 변경은 아래)
        usdt.safeTransferFrom(msg.sender, address(this), amount);

        // 상태 변경
        usdtBalance[msg.sender] += amount;
        uint256 ppBonus = (amount * DEPOSIT_BONUS) / PERCENT_BASE;
        ppBalance[msg.sender] += ppBonus;
        totalDeposited += amount;

        emit Deposited(msg.sender, amount, ppBonus);
    }

    // ══════════════════════════════════════════════════════
    //  Claim / Hijack: PP 우선 차감 → 부족분 USDT
    // ══════════════════════════════════════════════════════

    function plotKey(int256 lat, int256 lng) public pure returns (bytes32) {
        return keccak256(abi.encodePacked(lat, lng));
    }

    /**
     * @notice 영토 점령 또는 하이재킹
     * @dev 결제 우선순위: PP 잔고 먼저 → 부족분은 USDT 잔고에서 차감
     */
    function claim(int256 lat, int256 lng, string calldata imageUri) external nonReentrant {
        require(lat >= -9000 && lat <= 9000, "Invalid lat");
        require(lng >= -18000 && lng <= 18000, "Invalid lng");

        bytes32 id = plotKey(lat, lng);
        Plot storage p = plots[id];

        if (p.owner == address(0)) {
            // ── 신규 점령 ──
            _deductFromUser(msg.sender, BASE_PRICE);

            // Treasury로 전송
            usdt.safeTransfer(treasury, BASE_PRICE);

            p.owner     = msg.sender;
            p.price     = BASE_PRICE;
            p.imageUri  = imageUri;
            p.claimedAt = uint64(block.timestamp);

            plotList.push(id);
            userPlots[msg.sender].push(id);
            totalPlots++;
            totalVolume += BASE_PRICE;

            emit Claimed(id, msg.sender, lat, lng, BASE_PRICE, imageUri);

        } else {
            // ── 하이재킹 (1.2×) ──
            require(p.owner != msg.sender, "Already own this plot");

            uint256 hijackPrice = (p.price * HIJACK_NUM) / HIJACK_DEN;
            uint256 premium     = hijackPrice - p.price;
            uint256 ownerBonus  = (premium * PREMIUM_SPLIT) / PERCENT_BASE;
            uint256 treasuryFee = premium - ownerBonus;

            address prevOwner      = p.owner;
            uint256 prevOwnerTotal = p.price + ownerBonus; // 원금 + 보너스

            // 하이재커에게서 차감 (PP 우선 → USDT)
            _deductFromUser(msg.sender, hijackPrice);

            // 기존 소유자에게 PP로 보상 (내부 순환)
            ppBalance[prevOwner] += prevOwnerTotal;

            // Treasury에 수수료 전송 (실제 USDT)
            usdt.safeTransfer(treasury, treasuryFee);

            // 소유권 이전
            p.owner     = msg.sender;
            p.price     = hijackPrice;
            p.imageUri  = imageUri;
            p.claimedAt = uint64(block.timestamp);

            // 유저 플롯 목록 업데이트
            _removeUserPlot(prevOwner, id);
            userPlots[msg.sender].push(id);

            totalVolume += hijackPrice;

            emit Hijacked(id, msg.sender, prevOwner, hijackPrice, prevOwnerTotal);
        }
    }

    // ══════════════════════════════════════════════════════
    //  PP → USDT 환전 (5% 수수료)
    // ══════════════════════════════════════════════════════

    /**
     * @notice PP를 USDT로 환전. 5% 수수료 차감 후 지갑으로 전송.
     * @param ppAmount 환전할 PP 수량
     */
    function swapPPtoUSDT(uint256 ppAmount) external nonReentrant {
        require(ppAmount > 0, "Zero amount");
        require(ppBalance[msg.sender] >= ppAmount, "Insufficient PP");

        // 상태 먼저 변경 (Checks-Effects-Interactions)
        ppBalance[msg.sender] -= ppAmount;

        uint256 fee = (ppAmount * SWAP_FEE) / PERCENT_BASE;
        uint256 userReceives = ppAmount - fee;

        // 외부 전송
        usdt.safeTransfer(msg.sender, userReceives);
        usdt.safeTransfer(treasury, fee);

        emit SwappedPP(msg.sender, ppAmount, userReceives, fee);
    }

    // ══════════════════════════════════════════════════════
    //  USDT 출금 (순수 USDT 잔고만)
    // ══════════════════════════════════════════════════════

    /**
     * @notice 내부 USDT 잔고 출금 (수수료 없음, PP 아님)
     */
    function withdrawUSDT(uint256 amount) external nonReentrant {
        require(amount > 0, "Zero amount");
        require(usdtBalance[msg.sender] >= amount, "Insufficient USDT balance");

        usdtBalance[msg.sender] -= amount;
        usdt.safeTransfer(msg.sender, amount);

        emit Withdrawn(msg.sender, amount, 0);
    }

    // ══════════════════════════════════════════════════════
    //  전액 출금 + 픽셀 리셋
    // ══════════════════════════════════════════════════════

    /**
     * @notice USDT + PP 전액 출금. PP는 5% 수수료 적용.
     *         모든 소유 픽셀이 무소유로 리셋됨.
     * @dev 프론트에서 경고 팝업 후 호출해야 함
     */
    function withdrawAll() external nonReentrant {
        uint256 userUSDT = usdtBalance[msg.sender];
        uint256 userPP   = ppBalance[msg.sender];
        require(userUSDT > 0 || userPP > 0, "Nothing to withdraw");

        // ── 상태 먼저 변경 (CEI) ──
        usdtBalance[msg.sender] = 0;
        ppBalance[msg.sender]   = 0;

        // PP → USDT 환전 (5% 수수료)
        uint256 ppFee = (userPP * SWAP_FEE) / PERCENT_BASE;
        uint256 ppNet = userPP - ppFee;

        uint256 totalOut = userUSDT + ppNet;

        // ── 픽셀 리셋 ──
        bytes32[] storage myPlots = userPlots[msg.sender];
        uint256 resetCount = myPlots.length;
        for (uint256 i = 0; i < myPlots.length; i++) {
            bytes32 pid = myPlots[i];
            Plot storage p = plots[pid];
            if (p.owner == msg.sender) {
                p.owner    = address(0);
                p.price    = 0;
                p.imageUri = "";
                // claimedAt 유지 (히스토리)
                emit PlotReset(pid, msg.sender);
            }
        }
        delete userPlots[msg.sender];

        // ── 외부 전송 (상태 변경 후) ──
        if (totalOut > 0) {
            usdt.safeTransfer(msg.sender, totalOut);
        }
        if (ppFee > 0) {
            usdt.safeTransfer(treasury, ppFee);
        }

        emit FullWithdraw(msg.sender, totalOut, resetCount);
    }

    // ══════════════════════════════════════════════════════
    //  Internal: PP 우선 차감 → USDT 보충
    // ══════════════════════════════════════════════════════

    /**
     * @dev 유저 잔고에서 cost만큼 차감.
     *      PP를 먼저 사용하고, 부족분은 USDT에서 차감.
     *      USDT도 부족하면 revert.
     */
    function _deductFromUser(address user, uint256 cost) internal {
        uint256 pp = ppBalance[user];

        if (pp >= cost) {
            // PP로 전액 결제
            ppBalance[user] -= cost;
        } else {
            // PP 전부 사용 + 나머지 USDT
            uint256 remaining = cost - pp;
            ppBalance[user] = 0;
            require(usdtBalance[user] >= remaining, "Insufficient balance (PP+USDT)");
            usdtBalance[user] -= remaining;
        }
    }

    /**
     * @dev 유저의 플롯 목록에서 특정 플롯 제거
     */
    function _removeUserPlot(address user, bytes32 plotId) internal {
        bytes32[] storage arr = userPlots[user];
        for (uint256 i = 0; i < arr.length; i++) {
            if (arr[i] == plotId) {
                arr[i] = arr[arr.length - 1];
                arr.pop();
                return;
            }
        }
    }

    // ══════════════════════════════════════════════════════
    //  Admin
    // ══════════════════════════════════════════════════════

    function setTreasury(address _treasury) external onlyOwner {
        require(_treasury != address(0), "Zero address");
        treasury = _treasury;
    }

    // ══════════════════════════════════════════════════════
    //  View Functions
    // ══════════════════════════════════════════════════════

    function getPlot(int256 lat, int256 lng) external view returns (Plot memory) {
        return plots[plotKey(lat, lng)];
    }

    function plotCount() external view returns (uint256) {
        return plotList.length;
    }

    function getPlotByIndex(uint256 idx) external view returns (bytes32) {
        return plotList[idx];
    }

    function getUserBalance(address user) external view returns (uint256 _usdt, uint256 _pp) {
        return (usdtBalance[user], ppBalance[user]);
    }

    function getUserPlotCount(address user) external view returns (uint256) {
        return userPlots[user].length;
    }

    function getUserPlotAt(address user, uint256 idx) external view returns (bytes32) {
        return userPlots[user][idx];
    }

    /**
     * @notice 환전 시뮬레이션 (수수료 포함)
     */
    function previewSwap(uint256 ppAmount) external pure returns (uint256 userReceives, uint256 fee) {
        fee = (ppAmount * SWAP_FEE) / PERCENT_BASE;
        userReceives = ppAmount - fee;
    }

    /**
     * @notice 전액 출금 시뮬레이션
     */
    function previewWithdrawAll(address user) external view returns (
        uint256 totalOut,
        uint256 ppFee,
        uint256 plotsToReset
    ) {
        uint256 userUSDT = usdtBalance[user];
        uint256 userPP   = ppBalance[user];
        ppFee = (userPP * SWAP_FEE) / PERCENT_BASE;
        totalOut = userUSDT + userPP - ppFee;
        plotsToReset = userPlots[user].length;
    }
}
