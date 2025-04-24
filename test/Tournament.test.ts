import { expect } from "chai";
import { ethers } from "hardhat";
import { Tournament, GentlemensToken } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("Tournament", function () {
  let token: GentlemensToken;
  let tournament: Tournament;
  let owner: SignerWithAddress;
  let addr1: SignerWithAddress;
  let addr2: SignerWithAddress;

  const ENTRY_FEE = ethers.parseEther("100");
  const PRIZE_POOL = ethers.parseEther("1000");
  const MIN_PLAYERS = 2;
  const MAX_PLAYERS = 10;
  const MIN_BET = ethers.parseEther("1");
  const MAX_BET = ethers.parseEther("10");

  beforeEach(async function () {
    [owner, addr1, addr2] = await ethers.getSigners();

    // Deploy token
    const GentlemensToken = await ethers.getContractFactory("GentlemensToken");
    token = await GentlemensToken.deploy();
    await token.waitForDeployment();

    // Deploy tournament
    const Tournament = await ethers.getContractFactory("Tournament");
    tournament = await Tournament.deploy(await token.getAddress());
    await tournament.waitForDeployment();

    // Transfer tokens to test accounts
    await token.transfer(addr1.address, ethers.parseEther("1000"));
    await token.transfer(addr2.address, ethers.parseEther("1000"));
  });

  describe("Tournament Creation", function () {
    it("Should create a tournament with correct parameters", async function () {
      const startTime = await time.latest() + 3600; // 1 hour from now
      const endTime = startTime + 86400; // 24 hours duration

      await tournament.createTournament(
        ENTRY_FEE,
        PRIZE_POOL,
        MIN_PLAYERS,
        MAX_PLAYERS,
        startTime,
        endTime,
        MIN_BET,
        MAX_BET
      );

      expect(await tournament.tournamentCounter()).to.equal(1);
    });

    it("Should fail to create tournament with invalid parameters", async function () {
      const startTime = await time.latest() - 3600; // 1 hour ago
      const endTime = startTime + 86400;

      await expect(
        tournament.createTournament(
          ENTRY_FEE,
          PRIZE_POOL,
          MIN_PLAYERS,
          MAX_PLAYERS,
          startTime,
          endTime,
          MIN_BET,
          MAX_BET
        )
      ).to.be.revertedWith("Invalid start time");
    });
  });

  describe("Tournament Registration", function () {
    let tournamentId: number;
    let startTime: number;
    let endTime: number;

    beforeEach(async function () {
      startTime = await time.latest() + 3600;
      endTime = startTime + 86400;

      await tournament.createTournament(
        ENTRY_FEE,
        PRIZE_POOL,
        MIN_PLAYERS,
        MAX_PLAYERS,
        startTime,
        endTime,
        MIN_BET,
        MAX_BET
      );
      tournamentId = 0;

      // Approve tournament contract to spend tokens
      await token.connect(addr1).approve(await tournament.getAddress(), ENTRY_FEE);
      await token.connect(addr2).approve(await tournament.getAddress(), ENTRY_FEE);
    });

    it("Should allow players to register for tournament", async function () {
      await tournament.connect(addr1).registerForTournament(tournamentId);
      
      const players = await tournament.getTournamentPlayers(tournamentId);
      expect(players).to.include(addr1.address);
    });

    it("Should not allow double registration", async function () {
      await tournament.connect(addr1).registerForTournament(tournamentId);
      await expect(
        tournament.connect(addr1).registerForTournament(tournamentId)
      ).to.be.revertedWith("Already registered");
    });

    it("Should not allow registration after tournament starts", async function () {
      await time.increaseTo(startTime + 1);
      await expect(
        tournament.connect(addr1).registerForTournament(tournamentId)
      ).to.be.revertedWith("Tournament has already started");
    });
  });

  describe("Tournament Management", function () {
    let tournamentId: number;

    beforeEach(async function () {
      const startTime = await time.latest() + 3600;
      const endTime = startTime + 86400;

      await tournament.createTournament(
        ENTRY_FEE,
        PRIZE_POOL,
        MIN_PLAYERS,
        MAX_PLAYERS,
        startTime,
        endTime,
        MIN_BET,
        MAX_BET
      );
      tournamentId = 0;

      // Register players
      await token.connect(addr1).approve(await tournament.getAddress(), ENTRY_FEE);
      await token.connect(addr2).approve(await tournament.getAddress(), ENTRY_FEE);
      await tournament.connect(addr1).registerForTournament(tournamentId);
      await tournament.connect(addr2).registerForTournament(tournamentId);
    });

    it("Should update player scores correctly", async function () {
      await tournament.updatePlayerScore(tournamentId, addr1.address, 100);
      expect(await tournament.getPlayerScore(tournamentId, addr1.address)).to.equal(100);
    });

    it("Should end tournament and distribute prizes correctly", async function () {
      await time.increaseTo((await time.latest()) + 86400);
      
      const initialBalance = await token.balanceOf(addr1.address);
      await tournament.endTournament(tournamentId, [addr1.address]);
      
      const finalBalance = await token.balanceOf(addr1.address);
      expect(finalBalance - initialBalance).to.equal(PRIZE_POOL);
    });

    it("Should not allow non-owner to end tournament", async function () {
      await expect(
        tournament.connect(addr1).endTournament(tournamentId, [addr1.address])
      ).to.be.revertedWithCustomError(tournament, "OwnableUnauthorizedAccount");
    });
  });
}); 