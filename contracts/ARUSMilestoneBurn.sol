// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/extensions/AccessControlEnumerable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "./ARUSToken.sol";

/**
 * @title ARUSMilestoneBurn
 * @dev Proof-of-Production Clean Energy Milestone Burn Engine.
 *
 * Security & Design Specifications:
 * - Off-Chain to On-Chain Direct Trigger: Backend servers with REPORTER_ROLE submit verified kWh production metrics.
 * - Programmatic Deflation: Automatically triggers burnFrom() on $ARUS when cumulative energy milestones are reached.
 * - Circuit Breakers & Daily Limits: Hard-capped daily maximum burn limits prevent catastrophic execution in case of server key compromise.
 * - Reentrancy Guard: All burn execution routes protected by ReentrancyGuard.
 * - Audit Ready: Conforms strictly to CertiK security standards on Ethereum mainnet.
 */
contract ARUSMilestoneBurn is AccessControlEnumerable, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    /// @notice Custom errors for CertiK audit compliance and gas optimization
    error ZeroAddressAdmin();
    error ZeroAddressReporter();
    error ZeroAddressToken();
    error ZeroAddressReserveVault();
    error InvalidKWhInterval();
    error InvalidIncrementalKWh();
    error DailyBurnLimitExceeded();

    /// @notice The ARUSToken contract reference
    ARUSToken public immutable arusToken;

    /// @notice Role for authorized off-chain backend workers logging energy generation
    bytes32 public constant REPORTER_ROLE = keccak256("REPORTER_ROLE");

    /// @notice Role for emergency pause operations
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    /// @notice Address holding pre-allocated burn reserve tokens
    address public burnReserveVault;

    /// @notice Cumulative clean energy produced across all SPVs in kilowatt-hours (kWh)
    uint256 public totalEnergyProducedKWh;

    /// @notice Cumulative energy processed for burn triggers in kWh
    uint256 public lastProcessedKWh;

    /// @notice kWh target interval per milestone burn trigger (e.g. 10,000,000 kWh)
    uint256 public milestoneKWhInterval;

    /// @notice Token amount to burn per completed milestone (8 decimals)
    uint256 public burnAmountPerMilestone;

    /// @notice Total tokens permanently burned via this contract
    uint256 public totalTokensBurned;

    /// @notice Daily burn ceiling circuit breaker (maximum atomic token units burnable per 24 hours)
    uint256 public maxDailyBurnLimit;

    /// @notice Last timestamp when daily burn accumulator reset
    uint256 public currentDayTimestamp;

    /// @notice Accumulated tokens burned during current 24-hour window
    uint256 public currentDayBurnedAmount;

    // --- Events ---
    event EnergyProductionRecorded(address indexed reporter, uint256 incrementalKWh, uint256 newTotalKWh);
    event MilestoneBurnExecuted(uint256 milestoneIndex, uint256 tokensBurned, uint256 remainingReserve);
    event MilestoneConfigUpdated(uint256 newKWhInterval, uint256 newBurnAmount);
    event MaxDailyBurnLimitUpdated(uint256 newLimit);
    event BurnReserveVaultUpdated(address indexed newVault);

    /**
     * @notice Deploys the ARUSMilestoneBurn contract.
     * @param admin Multi-sig admin wallet.
     * @param reporter Off-chain backend server wallet address.
     * @param tokenAddress $ARUS ERC-20 token address.
     * @param reserveVault Address holding tokens allocated for energy burn.
     * @param initialKWhInterval kWh interval milestone target (e.g., 10,000,000).
     * @param initialBurnAmount Token amount to burn per milestone (8 decimals).
     * @param dailyBurnLimit Maximum burn cap per 24 hours.
     */
    constructor(
        address admin,
        address reporter,
        address tokenAddress,
        address reserveVault,
        uint256 initialKWhInterval,
        uint256 initialBurnAmount,
        uint256 dailyBurnLimit
    ) {
        if (admin == address(0)) revert ZeroAddressAdmin();
        if (reporter == address(0)) revert ZeroAddressReporter();
        if (tokenAddress == address(0)) revert ZeroAddressToken();
        if (reserveVault == address(0)) revert ZeroAddressReserveVault();
        if (initialKWhInterval == 0) revert InvalidKWhInterval();

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(PAUSER_ROLE, admin);
        _grantRole(REPORTER_ROLE, reporter);

        arusToken = ARUSToken(tokenAddress);
        burnReserveVault = reserveVault;
        milestoneKWhInterval = initialKWhInterval;
        burnAmountPerMilestone = initialBurnAmount;
        maxDailyBurnLimit = dailyBurnLimit;
        currentDayTimestamp = block.timestamp;
    }

    /**
     * @notice Direct off-chain trigger called by backend worker to log incremental clean energy production (kWh).
     * @param incrementalKWh Energy generated since last report.
     */
    function recordEnergyProduction(uint256 incrementalKWh) external onlyRole(REPORTER_ROLE) whenNotPaused nonReentrant {
        if (incrementalKWh == 0) revert InvalidIncrementalKWh();

        totalEnergyProducedKWh += incrementalKWh;
        emit EnergyProductionRecorded(msg.sender, incrementalKWh, totalEnergyProducedKWh);

        // Check if milestone thresholds have been crossed
        _checkAndExecuteBurn();
    }

    /**
     * @dev Internal function calculating milestone triggers and executing programmatic burns.
     */
    function _checkAndExecuteBurn() internal {
        uint256 pendingKWh = totalEnergyProducedKWh - lastProcessedKWh;
        if (pendingKWh < milestoneKWhInterval) {
            return;
        }

        uint256 milestonesReached = pendingKWh / milestoneKWhInterval;
        if (milestonesReached == 0 || burnAmountPerMilestone == 0) {
            return;
        }

        uint256 totalBurnTokens = milestonesReached * burnAmountPerMilestone;

        // Reset daily burn limit accumulator if 24 hours have passed
        if (block.timestamp >= currentDayTimestamp + 1 days) {
            currentDayTimestamp = block.timestamp;
            currentDayBurnedAmount = 0;
        }

        // Circuit breaker check
        if (currentDayBurnedAmount + totalBurnTokens > maxDailyBurnLimit) {
            revert DailyBurnLimitExceeded();
        }

        // Advance processed kWh index
        lastProcessedKWh += milestonesReached * milestoneKWhInterval;

        // Update accounting
        currentDayBurnedAmount += totalBurnTokens;
        totalTokensBurned += totalBurnTokens;

        // Execute burnFrom on the reserve vault (Vault must approve this contract)
        arusToken.burnFrom(burnReserveVault, totalBurnTokens);

        uint256 remainingReserve = arusToken.balanceOf(burnReserveVault);
        emit MilestoneBurnExecuted(lastProcessedKWh / milestoneKWhInterval, totalBurnTokens, remainingReserve);
    }

    /**
     * @notice Admin update for milestone kWh interval and burn amounts.
     * @param newInterval New kWh interval milestone target.
     * @param newBurnAmount New token amount to burn per milestone.
     */
    function updateMilestoneConfig(uint256 newInterval, uint256 newBurnAmount) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (newInterval == 0) revert InvalidKWhInterval();
        milestoneKWhInterval = newInterval;
        burnAmountPerMilestone = newBurnAmount;
        emit MilestoneConfigUpdated(newInterval, newBurnAmount);
    }

    /**
     * @notice Admin update for daily burn limit circuit breaker.
     * @param newLimit New maximum burn cap per 24 hours.
     */
    function updateMaxDailyBurnLimit(uint256 newLimit) external onlyRole(DEFAULT_ADMIN_ROLE) {
        maxDailyBurnLimit = newLimit;
        emit MaxDailyBurnLimitUpdated(newLimit);
    }

    /**
     * @notice Admin update for burn reserve vault address.
     * @param newVault New burn reserve vault address.
     */
    function updateBurnReserveVault(address newVault) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (newVault == address(0)) revert ZeroAddressReserveVault();
        burnReserveVault = newVault;
        emit BurnReserveVaultUpdated(newVault);
    }

    /**
     * @notice Pause contract operations.
     */
    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    /**
     * @notice Unpause contract operations.
     */
    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }
}
