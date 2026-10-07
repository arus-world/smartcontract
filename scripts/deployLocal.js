import hardhatPackage from "hardhat";
const { ethers } = hardhatPackage;

async function main() {
  console.log("=================================================");
  console.log("Local Testnet Deployment - ARUS WORLD (Ethereum)");
  console.log("=================================================");

  const [deployer, reporter, ecosystem, treasury, strategic, team, exchange, advisors, community] = await ethers.getSigners();

  const DECIMALS = 8n;
  const MULTIPLIER = 10n ** DECIMALS;

  // 1. Deploy ARUSToken
  const ARUSTokenFactory = await ethers.getContractFactory("ARUSToken");
  const arusToken = await ARUSTokenFactory.deploy(deployer.address, deployer.address);
  await arusToken.waitForDeployment();
  const tokenAddress = await arusToken.getAddress();
  console.log(`✓ ARUSToken deployed: ${tokenAddress}`);

  // 2. Deploy ARUSMilestoneBurn Engine
  const initialKWhInterval = 10_000_000n;
  const initialBurnAmount = 50_000n * MULTIPLIER;
  const maxDailyBurnLimit = 500_000n * MULTIPLIER;

  const MilestoneBurnFactory = await ethers.getContractFactory("ARUSMilestoneBurn");
  const milestoneBurn = await MilestoneBurnFactory.deploy(
    deployer.address,
    reporter.address,
    tokenAddress,
    ecosystem.address,
    initialKWhInterval,
    initialBurnAmount,
    maxDailyBurnLimit
  );
  await milestoneBurn.waitForDeployment();
  const burnAddress = await milestoneBurn.getAddress();
  console.log(`✓ ARUSMilestoneBurn deployed: ${burnAddress}`);

  // 3. Distribute Allocations
  await arusToken.transfer(ecosystem.address, 6_300_000n * MULTIPLIER);
  await arusToken.transfer(treasury.address, 4_200_000n * MULTIPLIER);
  await arusToken.transfer(strategic.address, 3_150_000n * MULTIPLIER);
  await arusToken.transfer(team.address, 3_150_000n * MULTIPLIER);
  await arusToken.transfer(exchange.address, 2_100_000n * MULTIPLIER);
  await arusToken.transfer(advisors.address, 1_050_000n * MULTIPLIER);
  await arusToken.transfer(community.address, 1_050_000n * MULTIPLIER);

  console.log("✓ All 21M $ARUS allocations distributed to 7 category wallets!");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
