import hardhatPackage from "hardhat";
const { ethers } = hardhatPackage;

async function main() {
  console.log("=================================================");
  console.log("Distributing Remaining ARUS WORLD Category Allocations");
  console.log("=================================================");

  const [deployer] = await ethers.getSigners();
  console.log(`Deployer Account: ${deployer.address}`);

  const tokenAddress = process.env.TOKEN_ADDRESS;
  const arusToken = await ethers.getContractAt("ARUSToken", tokenAddress);

  const DECIMALS = 8n;
  const MULTIPLIER = 10n ** DECIMALS;

  const allocations = [
    { name: "Ecosystem & Dev", share: "30%", amount: 6_300_000n * MULTIPLIER, recipient: process.env.WALLETS_ECOSYSTEM },
    { name: "Treasury", share: "20%", amount: 4_200_000n * MULTIPLIER, recipient: process.env.WALLETS_TREASURY },
    { name: "Strategic Investors", share: "15%", amount: 3_150_000n * MULTIPLIER, recipient: process.env.WALLETS_STRATEGIC },
    { name: "Exchange Liquidity & MM", share: "10%", amount: 2_100_000n * MULTIPLIER, recipient: process.env.WALLETS_EXCHANGE },
    { name: "Advisors & Partners", share: "5%", amount: 1_050_000n * MULTIPLIER, recipient: process.env.WALLETS_ADVISORS },
    { name: "Community & Growth", share: "5%", amount: 1_050_000n * MULTIPLIER, recipient: process.env.WALLETS_COMMUNITY },
  ];

  for (const item of allocations) {
    if (!item.recipient || item.recipient.toLowerCase() === deployer.address.toLowerCase()) {
      console.log(`Skipping ${item.name} (recipient is deployer address)`);
      continue;
    }

    const currentBal = await arusToken.balanceOf(item.recipient);
    if (currentBal >= item.amount) {
      console.log(`✓ ${item.name} wallet (${item.recipient}) already has ${ethers.formatUnits(currentBal, 8)} $ARUS`);
      continue;
    }

    console.log(`Sending ${ethers.formatUnits(item.amount, 8)} $ARUS (${item.share}) to ${item.name}: ${item.recipient}...`);
    const tx = await arusToken.transfer(item.recipient, item.amount);
    console.log(`Tx sent: ${tx.hash}. Waiting for block confirmation...`);
    await tx.wait();
    console.log(`✓ Transferred successfully to ${item.name}!`);
  }

  console.log("\nChecking Final Mainnet Balances...");
  const wallets = [
    { name: "Deployer", address: deployer.address },
    { name: "Ecosystem & Dev", address: process.env.WALLETS_ECOSYSTEM },
    { name: "Treasury", address: process.env.WALLETS_TREASURY },
    { name: "Strategic Investors", address: process.env.WALLETS_STRATEGIC },
    { name: "Core Team", address: process.env.WALLETS_TEAM },
    { name: "Exchange Liquidity", address: process.env.WALLETS_EXCHANGE },
    { name: "Advisors & Partners", address: process.env.WALLETS_ADVISORS },
    { name: "Community & Growth", address: process.env.WALLETS_COMMUNITY },
  ];

  for (const w of wallets) {
    if (w.address) {
      const bal = await arusToken.balanceOf(w.address);
      console.log(`${w.name} (${w.address}): ${ethers.formatUnits(bal, 8)} $ARUS`);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
