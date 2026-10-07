// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Pausable.sol";
import "@openzeppelin/contracts/access/extensions/AccessControlEnumerable.sol";

/**
 * @title ARUSToken
 * @dev Implementation of the ARUS WORLD ecosystem token ($ARUS) on Ethereum (ERC-20).
 *
 * Security & Design Specifications:
 * - Standard: ERC-20 Standard (Ethereum Mainnet / Sepolia)
 * - Decimals: 8
 * - Total Supply: Fixed Hard Cap of 21,000,000 $ARUS (21,000,000 * 10^8 atomic units)
 * - Minting: Minted strictly ONCE during constructor deployment to initial distribution vault/wallets.
 *           Zero mint functions exist post-deployment (guaranteeing non-inflationary economics).
 * - Burnable: ERC20Burnable enabled for token holders and authorized ecosystem burn vaults.
 * - Pausable: Emergency circuit breaker restricted to DEFAULT_ADMIN_ROLE (Gnosis Safe Multi-Sig).
 * - Role-Based Access Control: AccessControlEnumerable for auditability.
 * - Token Lockup / Vesting: Enforced via 3rd-party wallet locking protocols (e.g. UNCX / PinkLock / Team Finance).
 */
contract ARUSToken is ERC20, ERC20Burnable, ERC20Pausable, AccessControlEnumerable {
    /// @notice Custom Decimals constant set to 8
    uint8 private constant DECIMALS = 8;

    /// @notice Hard-capped Total Supply: 21,000,000 $ARUS with 8 decimals
    uint256 public constant TOTAL_SUPPLY_CAP = 21_000_000 * (10 ** DECIMALS);

    /// @notice Role for emergency protocol pause/unpause operations
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    // Custom errors for gas efficiency and CertiK audit compliance
    error ZeroAddressAdmin();
    error ZeroAddressVault();

    /**
     * @dev Emitted when total supply is minted at deployment.
     * @param recipient The address receiving the initial hard-capped supply.
     * @param amount The total supply minted in atomic units.
     */
    event InitialSupplyMinted(address indexed recipient, uint256 amount);

    /**
     * @notice Deploys the ARUSToken contract and mints the entire fixed cap supply once.
     * @param admin The multi-sig admin address granted DEFAULT_ADMIN_ROLE and PAUSER_ROLE.
     * @param initialDistributionVault The vault address receiving the 21M initial tokens for ecosystem allocation.
     */
    constructor(address admin, address initialDistributionVault) ERC20("ARUS WORLD", "ARUS") {
        if (admin == address(0)) revert ZeroAddressAdmin();
        if (initialDistributionVault == address(0)) revert ZeroAddressVault();

        // Grant administrative and pauser roles
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(PAUSER_ROLE, admin);

        // Mint entire total supply cap once and lock minting permanently
        _mint(initialDistributionVault, TOTAL_SUPPLY_CAP);
        emit InitialSupplyMinted(initialDistributionVault, TOTAL_SUPPLY_CAP);
    }

    /**
     * @notice Returns the number of decimals used to get its user representation (8).
     */
    function decimals() public pure override returns (uint8) {
        return DECIMALS;
    }

    /**
     * @notice Emergency trigger to pause all token transfers.
     */
    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    /**
     * @notice Triggers unpause of token transfers.
     */
    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    /**
     * @dev Override required by Solidity for ERC20 and ERC20Pausable.
     */
    function _update(address from, address to, uint256 value) internal override(ERC20, ERC20Pausable) {
        super._update(from, to, value);
    }
}
