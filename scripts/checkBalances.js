import hardhatPackage from "hardhat";
const { ethers } = hardhatPackage;

async function main() {
  const tokenAddress = process.env.TOKEN_ADDRESS;
  const arusToken = await ethers.getContractAt("ARUSToken", tokenAddress);

  const wallets = [
    { name: "Deployer", address: process.env.ADMIN_MULTISIG_ADDRESS },
    { name: "Ecosystem & Dev", address: process.env.WALLETS_ECOSYSTEM },
    { name: "Treasury", address: process.env.WALLETS_TREASURY },
    { name: "Strategic Investors", address: process.env.WALLETS_STRATEGIC },
    { name: "Core Team", address: process.env.WALLETS_TEAM },
    { name: "Exchange Liquidity", address: process.env.WALLETS_EXCHANGE },
    { name: "Advisors & Partners", address: process.env.WALLETS_ADVISORS },
    { name: "Community & Growth", address: process.env.WALLETS_COMMUNITY },
  ];

  console.log("Checking Mainnet Token Balances...");
  for (const w of wallets) {
    if (w.address) {
      const bal = await arusToken.balanceOf(w.address);
      console.log(`${w.name} (${w.address}): ${ethers.formatUnits(bal, 8)} $ARUS`);
    }
  }
}

main().catch(console.error);
