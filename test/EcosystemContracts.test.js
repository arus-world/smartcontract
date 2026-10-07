import { expect } from "chai";
import hardhatPackage from "hardhat";
const { ethers } = hardhatPackage;

describe("ARUS WORLD Ecosystem Smart Contracts (Ethereum ERC-20)", function () {
  let admin;
  let signer2;
  let signer3;
  let reporter;
  let reserveVault;
  let beneficiary;
  let arusToken;
  let milestoneBurn;
  let multiSigWallet;

  const DECIMALS = 8n;
  const TOTAL_SUPPLY_CAP = 21000000n * 10n ** DECIMALS;

  beforeEach(async function () {
    [admin, signer2, signer3, reporter, reserveVault, beneficiary] = await ethers.getSigners();

    // 1. Deploy ARUSMultiSigWallet (2-of-3 MultiSig)
    const MultiSigFactory = await ethers.getContractFactory("ARUSMultiSigWallet");
    multiSigWallet = await MultiSigFactory.deploy(
      [admin.address, signer2.address, signer3.address],
      2 // 2 of 3 required confirmations
    );
    await multiSigWallet.waitForDeployment();

    // 2. Deploy ARUSToken
    const ARUSTokenFactory = await ethers.getContractFactory("ARUSToken");
    arusToken = await ARUSTokenFactory.deploy(admin.address, reserveVault.address);
    await arusToken.waitForDeployment();

    // 3. Deploy ARUSMilestoneBurn
    const initialKWhInterval = 10000000n; // 10M kWh
    const initialBurnAmount = 50000n * 10n ** DECIMALS; // 50,000 $ARUS
    const dailyBurnLimit = 500000n * 10n ** DECIMALS; // 500,000 $ARUS max per day

    const MilestoneBurnFactory = await ethers.getContractFactory("ARUSMilestoneBurn");
    milestoneBurn = await MilestoneBurnFactory.deploy(
      admin.address,
      reporter.address,
      await arusToken.getAddress(),
      reserveVault.address,
      initialKWhInterval,
      initialBurnAmount,
      dailyBurnLimit
    );
    await milestoneBurn.waitForDeployment();
  });

  describe("ARUSMultiSigWallet Core Tests", function () {
    it("should deploy with 3 owners and require 2 confirmations", async function () {
      expect(await multiSigWallet.numConfirmationsRequired()).to.equal(2);
      const owners = await multiSigWallet.getOwners();
      expect(owners.length).to.equal(3);
      expect(owners[0]).to.equal(admin.address);
      expect(owners[1]).to.equal(signer2.address);
      expect(owners[2]).to.equal(signer3.address);
    });

    it("should execute transaction only after 2 confirmations", async function () {
      const transferAmount = 1000n * 10n ** DECIMALS;
      await arusToken.connect(reserveVault).transfer(await multiSigWallet.getAddress(), transferAmount);

      // Encode token transfer call to beneficiary
      const data = arusToken.interface.encodeFunctionData("transfer", [beneficiary.address, transferAmount]);

      // 1. Submit tx
      await multiSigWallet.connect(admin).submitTransaction(await arusToken.getAddress(), 0, data);

      // 2. Confirm tx by Signer 1
      await multiSigWallet.connect(admin).confirmTransaction(0);

      // Execution should fail with only 1 confirmation
      await expect(
        multiSigWallet.connect(admin).executeTransaction(0)
      ).to.be.revertedWithCustomError(multiSigWallet, "CannotExecuteWithoutRequiredConfirmations");

      // 3. Confirm tx by Signer 2
      await multiSigWallet.connect(signer2).confirmTransaction(0);

      // 4. Execute tx successfully with 2 confirmations
      await multiSigWallet.connect(signer2).executeTransaction(0);

      expect(await arusToken.balanceOf(beneficiary.address)).to.equal(transferAmount);
    });
  });

  describe("ARUSToken Core Tests (Ethereum ERC-20)", function () {
    it("should deploy with fixed total supply cap of 21,000,000 $ARUS and 8 decimals", async function () {
      expect(await arusToken.name()).to.equal("ARUS WORLD");
      expect(await arusToken.symbol()).to.equal("ARUS");
      expect(await arusToken.decimals()).to.equal(8);
      expect(await arusToken.totalSupply()).to.equal(TOTAL_SUPPLY_CAP);
      expect(await arusToken.balanceOf(reserveVault.address)).to.equal(TOTAL_SUPPLY_CAP);
    });

    it("should allow emergency pause and unpause by PAUSER_ROLE", async function () {
      await arusToken.connect(admin).pause();
      expect(await arusToken.paused()).to.be.true;

      await expect(
        arusToken.connect(reserveVault).transfer(beneficiary.address, 1000)
      ).to.be.revertedWithCustomError(arusToken, "EnforcedPause");

      await arusToken.connect(admin).unpause();
      expect(await arusToken.paused()).to.be.false;
    });
  });

  describe("Proof-of-Production Milestone Burn Tests", function () {
    it("should execute programmatic burn when energy production reaches milestone threshold", async function () {
      const burnAmount = 50000n * 10n ** DECIMALS;
      const milestoneBurnAddress = await milestoneBurn.getAddress();

      await arusToken.connect(reserveVault).approve(milestoneBurnAddress, TOTAL_SUPPLY_CAP);
      await milestoneBurn.connect(reporter).recordEnergyProduction(10000000n);

      expect(await arusToken.totalSupply()).to.equal(TOTAL_SUPPLY_CAP - burnAmount);
      expect(await milestoneBurn.totalTokensBurned()).to.equal(burnAmount);
    });

    it("should reject energy production reports from unauthorized addresses", async function () {
      await expect(
        milestoneBurn.connect(beneficiary).recordEnergyProduction(10000000n)
      ).to.be.revertedWithCustomError(milestoneBurn, "AccessControlUnauthorizedAccount");
    });
  });
});
