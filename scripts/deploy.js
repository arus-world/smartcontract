import hardhatPackage from "hardhat";
const { ethers } = hardhatPackage;

async function main() {
  console.log("=================================================");
  console.log("Starting ARUS WORLD Ecosystem Smart Contract Deployment (Ethereum)");
  console.log("=================================================");

  const [deployer] = await ethers.getSigners();
  console.log(`Deployer Account: ${deployer.address}`);
  console.log(`Account Balance: ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} ETH`);

  const DECIMALS = 8n;
  const MULTIPLIER = 10n ** DECIMALS;

  // Target Admin & Reporter Addresses
  const ADMIN_MULTISIG = process.env.ADMIN_MULTISIG_ADDRESS || deployer.address;
  const REPORTER_ADDRESS = process.env.REPORTER_WALLET_ADDRESS || deployer.address;

  // 7 Dedicated Category Wallet Addresses (to be locked via 3rd-party locking apps)
  const categoryWallets = {
    ecosystem: process.env.WALLETS_ECOSYSTEM || deployer.address,
    treasury: process.env.WALLETS_TREASURY || deployer.address,
    strategic: process.env.WALLETS_STRATEGIC || deployer.address,
    team: process.env.WALLETS_TEAM || deployer.address,
    exchange: process.env.WALLETS_EXCHANGE || deployer.address,
    advisors: process.env.WALLETS_ADVISORS || deployer.address,
    community: process.env.WALLETS_COMMUNITY || deployer.address,
  };

  console.log(`Configured Admin Multi-Sig: ${ADMIN_MULTISIG}`);
  console.log(`Configured Relayer/Reporter: ${REPORTER_ADDRESS}`);

  // 1. Deploy ARUSToken
  console.log("\n[1/3] Deploying ARUSToken (ERC-20)...");
  const ARUSTokenFactory = await ethers.getContractFactory("ARUSToken");
  const arusToken = await ARUSTokenFactory.deploy(deployer.address, deployer.address);
  await arusToken.waitForDeployment();
  const tokenAddress = await arusToken.getAddress();
  console.log(`✓ ARUSToken deployed to: ${tokenAddress}`);

  // 2. Deploy ARUSMilestoneBurn Engine
  console.log("\n[2/3] Deploying ARUSMilestoneBurn Engine...");
  const initialKWhInterval = 10_000_000n; // 10 Million kWh threshold
  const initialBurnAmount = 50_000n * MULTIPLIER; // 50,000 $ARUS per milestone
  const maxDailyBurnLimit = 500_000n * MULTIPLIER; // 500,000 $ARUS daily ceiling

  const MilestoneBurnFactory = await ethers.getContractFactory("ARUSMilestoneBurn");
  const milestoneBurn = await MilestoneBurnFactory.deploy(
    deployer.address,
    REPORTER_ADDRESS,
    tokenAddress,
    categoryWallets.ecosystem, // Ecosystem vault holds burn reserve
    initialKWhInterval,
    initialBurnAmount,
    maxDailyBurnLimit
  );
  await milestoneBurn.waitForDeployment();
  const burnEngineAddress = await milestoneBurn.getAddress();
  console.log(`✓ ARUSMilestoneBurn deployed to: ${burnEngineAddress}`);

  // 3. Populate 7 Allocation Category Wallets
  console.log("\n[3/3] Distributing Token Allocations to Category Wallets...");

  const allocations = [
    { name: "Ecosystem & Dev", share: "30%", amount: 6_300_000n * MULTIPLIER, recipient: categoryWallets.ecosystem },
    { name: "Treasury", share: "20%", amount: 4_200_000n * MULTIPLIER, recipient: categoryWallets.treasury },
    { name: "Strategic Investors", share: "15%", amount: 3_150_000n * MULTIPLIER, recipient: categoryWallets.strategic },
    { name: "Core Team", share: "15%", amount: 3_150_000n * MULTIPLIER, recipient: categoryWallets.team },
    { name: "Exchange Liquidity & MM", share: "10%", amount: 2_100_000n * MULTIPLIER, recipient: categoryWallets.exchange },
    { name: "Advisors & Partners", share: "5%", amount: 1_050_000n * MULTIPLIER, recipient: categoryWallets.advisors },
    { name: "Community & Growth", share: "5%", amount: 1_050_000n * MULTIPLIER, recipient: categoryWallets.community },
  ];

  for (const item of allocations) {
    if (item.recipient.toLowerCase() !== deployer.address.toLowerCase()) {
      await arusToken.transfer(item.recipient, item.amount);
      console.log(`  -> Transferred ${item.amount / MULTIPLIER} $ARUS (${item.share}) to ${item.name} wallet: ${item.recipient}`);
    } else {
      console.log(`  -> ${item.name} (${item.share}) retained at deployer wallet for manual distribution / locking.`);
    }
  }

  // 4. Role Transfer to Admin Multi-Sig (if different from deployer)
  if (ADMIN_MULTISIG.toLowerCase() !== deployer.address.toLowerCase()) {
    console.log("\nTransferring Administrative & Pauser Roles to Admin Wallet...");
    const DEFAULT_ADMIN_ROLE = await arusToken.DEFAULT_ADMIN_ROLE();
    const PAUSER_ROLE = await arusToken.PAUSER_ROLE();

    // Grant roles to target admin wallet
    await arusToken.grantRole(DEFAULT_ADMIN_ROLE, ADMIN_MULTISIG);
    await arusToken.grantRole(PAUSER_ROLE, ADMIN_MULTISIG);
    await milestoneBurn.grantRole(DEFAULT_ADMIN_ROLE, ADMIN_MULTISIG);
    await milestoneBurn.grantRole(PAUSER_ROLE, ADMIN_MULTISIG);

    // Renounce deployer admin roles
    await arusToken.renounceRole(DEFAULT_ADMIN_ROLE, deployer.address);
    await arusToken.renounceRole(PAUSER_ROLE, deployer.address);
    await milestoneBurn.renounceRole(DEFAULT_ADMIN_ROLE, deployer.address);
    await milestoneBurn.renounceRole(PAUSER_ROLE, deployer.address);
    console.log(`✓ Admin & Pauser roles transferred to: ${ADMIN_MULTISIG}`);
  }

  console.log("\n=================================================");
  console.log("ARUS WORLD Ethereum Deployment & Allocation Complete!");
  console.log("=================================================");
  console.log(`ARUSToken: ${tokenAddress}`);
  console.log(`ARUSMilestoneBurn: ${burnEngineAddress}`);
  console.log("Note: Lock wallet allocation categories using your chosen 3rd-party locking app (UNCX / PinkLock / Team Finance).");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
