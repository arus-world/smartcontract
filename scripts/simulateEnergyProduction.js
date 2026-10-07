import hardhatPackage from "hardhat";
const { ethers } = hardhatPackage;

async function main() {
  const tokenAddress = process.env.TOKEN_ADDRESS;
  const burnEngineAddress = process.env.BURN_ENGINE_ADDRESS;
  if (!tokenAddress || !burnEngineAddress) {
    throw new Error("TOKEN_ADDRESS and BURN_ENGINE_ADDRESS must be defined in environment");
  }

  const [reporter] = await ethers.getSigners();
  const milestoneBurn = await ethers.getContractAt("ARUSMilestoneBurn", burnEngineAddress);
  const arusToken = await ethers.getContractAt("ARUSToken", tokenAddress);

  console.log("=================================================");
  console.log("Simulating Proof-of-Production Clean Energy Burn");
  console.log("=================================================");
  console.log(`Reporter / Reserve Account: ${reporter.address}`);
  console.log(`ARUSToken Address: ${tokenAddress}`);
  console.log(`ARUSMilestoneBurn Address: ${burnEngineAddress}`);

  const DECIMALS = 8n;
  const MULTIPLIER = 10n ** DECIMALS;
  const burnAmountPerMilestone = 50_000n * MULTIPLIER;

  // Check allowance and approve burn engine if needed
  const currentAllowance = await arusToken.allowance(reporter.address, burnEngineAddress);
  if (currentAllowance < burnAmountPerMilestone) {
    console.log("\nApproving ARUSMilestoneBurn engine to call burnFrom on reserve vault...");
    const approveTx = await arusToken.approve(burnEngineAddress, ethers.MaxUint256);
    await approveTx.wait();
    console.log("✓ Approval confirmed.");
  }

  console.log("\nSubmitting clean energy production update (10,000,000 kWh)...");
  const incrementalKWh = 10_000_000n; // 10 Million kWh milestone threshold

  const tx = await milestoneBurn.recordEnergyProduction(incrementalKWh);
  console.log(`Transaction sent! Tx Hash: ${tx.hash}`);
  console.log("Waiting for block confirmation...");
  await tx.wait();

  console.log("\n✓ Transaction confirmed on Sepolia!");
  const totalKWh = await milestoneBurn.totalEnergyProducedKWh();
  const totalBurned = await milestoneBurn.totalTokensBurned();
  const totalSupply = await arusToken.totalSupply();

  console.log("=================================================");
  console.log(`Total Clean Energy Logged: ${totalKWh.toString()} kWh`);
  console.log(`Total $ARUS Permanently Burned: ${ethers.formatUnits(totalBurned, 8)} $ARUS`);
  console.log(`New Total Supply of $ARUS: ${ethers.formatUnits(totalSupply, 8)} $ARUS`);
  console.log("=================================================");
  console.log(`View Burn Engine on Sepolia Etherscan: https://sepolia.etherscan.io/address/${burnEngineAddress}`);
  console.log(`View Token Contract on Sepolia Etherscan: https://sepolia.etherscan.io/address/${tokenAddress}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
