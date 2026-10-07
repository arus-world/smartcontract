import hardhatPackage from "hardhat";
const { run } = hardhatPackage;

async function main() {
  const tokenAddress = process.env.TOKEN_ADDRESS;
  const burnEngineAddress = process.env.BURN_ENGINE_ADDRESS;
  const adminAddress = process.env.ADMIN_MULTISIG_ADDRESS;
  const reporterAddress = process.env.REPORTER_WALLET_ADDRESS;
  const reserveVaultAddress = process.env.WALLETS_ECOSYSTEM;

  if (!tokenAddress || !burnEngineAddress) {
    throw new Error("TOKEN_ADDRESS and BURN_ENGINE_ADDRESS must be set in .env");
  }

  console.log("Verifying ARUSToken on Etherscan...");
  try {
    await run("verify:verify", {
      address: tokenAddress,
      constructorArguments: [adminAddress, adminAddress],
    });
    console.log("✓ ARUSToken verified successfully.");
  } catch (error) {
    console.error("ARUSToken verification error:", error.message);
  }

  console.log("Verifying ARUSMilestoneBurn on Etherscan...");
  try {
    const DECIMALS = 8n;
    const MULTIPLIER = 10n ** DECIMALS;
    const initialKWhInterval = 10_000_000n;
    const initialBurnAmount = 50_000n * MULTIPLIER;
    const maxDailyBurnLimit = 500_000n * MULTIPLIER;

    await run("verify:verify", {
      address: burnEngineAddress,
      constructorArguments: [
        adminAddress,
        reporterAddress,
        tokenAddress,
        reserveVaultAddress,
        initialKWhInterval,
        initialBurnAmount,
        maxDailyBurnLimit,
      ],
    });
    console.log("✓ ARUSMilestoneBurn verified successfully.");
  } catch (error) {
    console.error("ARUSMilestoneBurn verification error:", error.message);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
