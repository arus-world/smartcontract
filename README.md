# ARUS WORLD — Smart Contracts

Solidity smart contracts for the **$ARUS** ecosystem on Ethereum (ERC-20), built with
[Hardhat](https://hardhat.org/) and [OpenZeppelin Contracts](https://docs.openzeppelin.com/contracts/).

## Overview

| Contract | Description |
| --- | --- |
| `ARUSToken.sol` | Fixed-supply ERC-20 token ($ARUS) with burnable and pausable extensions and role-based access control. |
| `ARUSMilestoneBurn.sol` | Proof-of-Production milestone burn engine that programmatically burns reserve tokens when clean-energy generation thresholds are reached. |

## Contracts

### ARUSToken

- **Standard**: ERC-20 (`ARUS WORLD` / `ARUS`)
- **Decimals**: 8
- **Total supply**: Hard-capped at **21,000,000 $ARUS**, minted once in the constructor
- **Minting**: No post-deployment mint function (non-inflationary)
- **Extensions**: `ERC20Burnable`, `ERC20Pausable`, `AccessControlEnumerable`
- **Roles**: `DEFAULT_ADMIN_ROLE` and `PAUSER_ROLE`, granted to the admin (multi-sig) at deployment

### ARUSMilestoneBurn

- **Trigger**: Authorized off-chain reporter (backend relayer) submits verified kWh production via `recordEnergyProduction`
- **Deflation**: Automatically calls `burnFrom` on the burn-reserve vault once a cumulative milestone is crossed
- **Circuit breaker**: Daily burn ceiling (`maxDailyBurnLimit`) caps burnable amount per 24h
- **Protections**: `ReentrancyGuard`, `Pausable`
- **Roles**: `DEFAULT_ADMIN_ROLE`, `PAUSER_ROLE`, `REPORTER_ROLE`

## Token allocation

| Category | Share |
| --- | --- |
| Ecosystem & Development | 30% |
| Treasury | 20% |
| Strategic Investors | 15% |
| Core Team | 15% |
| Exchange Liquidity & Market Making | 10% |
| Advisors & Partners | 5% |
| Community & Growth | 5% |

## Getting started

### Prerequisites

- Node.js 18+
- npm

### Install

```bash
npm install
```

### Configure

Copy the example environment file and fill in your values:

```bash
cp .env.example .env
```

| Variable | Purpose |
| --- | --- |
| `PRIVATE_KEY` | Deployer private key |
| `ADMIN_MULTISIG_ADDRESS` | Gnosis Safe / multi-sig governance admin |
| `REPORTER_WALLET_ADDRESS` | Off-chain relayer wallet (proof-of-production oracle) |
| `WALLETS_*` | Category wallet addresses |
| `SEPOLIA_RPC_URL`, `ETH_MAINNET_RPC_URL` | Network RPC endpoints |
| `ETHERSCAN_API_KEY` | Etherscan verification API key |
| `TOKEN_ADDRESS`, `BURN_ENGINE_ADDRESS` | Deployed contract addresses (for post-deploy scripts) |

> `.env` is gitignored — never commit real keys or addresses.

## Usage

```bash
npm run compile          # Compile contracts
npm test                 # Run the test suite

npm run deploy:sepolia   # Deploy to Ethereum Sepolia
npm run deploy:mainnet   # Deploy to Ethereum mainnet
```

Additional scripts (run with `npx hardhat run <script> --network <network>`):

| Script | Purpose |
| --- | --- |
| `scripts/deployLocal.js` | Deploy to the in-process Hardhat network |
| `scripts/distributeAllocations.js` | Distribute remaining category allocations |
| `scripts/checkBalances.js` | Print token balances for configured wallets |
| `scripts/simulateEnergyProduction.js` | Simulate a kWh report and milestone burn |
| `scripts/verify.js` | Verify deployed contracts on Etherscan |

## Project structure

```
contracts/    Solidity source
scripts/      Deployment, distribution, verification, simulation
test/         Hardhat test suite
```

## License

MIT
