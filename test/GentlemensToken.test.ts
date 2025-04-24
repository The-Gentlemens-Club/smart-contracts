import { expect } from "chai";
import { ethers } from "hardhat";
import { GentlemensToken } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("GentlemensToken", function () {
  let token: GentlemensToken;
  let owner: SignerWithAddress;
  let addr1: SignerWithAddress;
  let addr2: SignerWithAddress;

  beforeEach(async function () {
    [owner, addr1, addr2] = await ethers.getSigners();
    
    const GentlemensToken = await ethers.getContractFactory("GentlemensToken");
    token = await GentlemensToken.deploy();
    await token.waitForDeployment();
  });

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      expect(await token.owner()).to.equal(owner.address);
    });

    it("Should assign the total supply of tokens to the owner", async function () {
      const ownerBalance = await token.balanceOf(owner.address);
      expect(await token.totalSupply()).to.equal(ownerBalance);
    });

    it("Should have correct name and symbol", async function () {
      expect(await token.name()).to.equal("Gentlemens Token");
      expect(await token.symbol()).to.equal("GENT");
    });
  });

  describe("Transactions", function () {
    it("Should transfer tokens between accounts", async function () {
      // Transfer 50 tokens from owner to addr1
      await token.transfer(addr1.address, 50);
      expect(await token.balanceOf(addr1.address)).to.equal(50);

      // Transfer 50 tokens from addr1 to addr2
      await token.connect(addr1).transfer(addr2.address, 50);
      expect(await token.balanceOf(addr2.address)).to.equal(50);
    });

    it("Should fail if sender doesn't have enough tokens", async function () {
      const initialOwnerBalance = await token.balanceOf(owner.address);
      await expect(
        token.connect(addr1).transfer(owner.address, 1)
      ).to.be.revertedWithCustomError(token, "ERC20InsufficientBalance");

      expect(await token.balanceOf(owner.address)).to.equal(initialOwnerBalance);
    });
  });

  describe("Minting", function () {
    it("Should allow owner to mint tokens", async function () {
      const mintAmount = 1000;
      await token.mint(addr1.address, mintAmount);
      expect(await token.balanceOf(addr1.address)).to.equal(mintAmount);
    });

    it("Should not allow non-owner to mint tokens", async function () {
      await expect(
        token.connect(addr1).mint(addr2.address, 1000)
      ).to.be.revertedWithCustomError(token, "OwnableUnauthorizedAccount");
    });
  });

  describe("Burning", function () {
    it("Should allow users to burn their tokens", async function () {
      const burnAmount = 1000;
      await token.transfer(addr1.address, burnAmount);
      await token.connect(addr1).burn(burnAmount);
      expect(await token.balanceOf(addr1.address)).to.equal(0);
    });

    it("Should fail if user tries to burn more tokens than they have", async function () {
      await expect(
        token.connect(addr1).burn(1000)
      ).to.be.revertedWithCustomError(token, "ERC20InsufficientBalance");
    });
  });
}); 