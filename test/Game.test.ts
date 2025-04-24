import { expect } from "chai";
import { ethers } from "hardhat";
import { Game, Tournament, GentlemensToken } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("Game", function () {
  let token: GentlemensToken;
  let tournament: Tournament;
  let game: Game;
  let owner: SignerWithAddress;
  let addr1: SignerWithAddress;
  let addr2: SignerWithAddress;

  const ENTRY_FEE = ethers.parseEther("100");
  const PRIZE_POOL = ethers.parseEther("1000");
  const MIN_PLAYERS = 2;
  const MAX_PLAYERS = 10;
  const MIN_BET = ethers.parseEther("1");
  const MAX_BET = ethers.parseEther("10");
  const BET_AMOUNT = ethers.parseEther("5");

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

    // Deploy game
    const Game = await ethers.getContractFactory("Game");
    game = await Game.deploy(await token.getAddress(), await tournament.getAddress());
    await game.waitForDeployment();

    // Transfer tokens to test accounts
    await token.transfer(addr1.address, ethers.parseEther("1000"));
    await token.transfer(addr2.address, ethers.parseEther("1000"));
  });

  describe("Game Setup", function () {
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

      // Start tournament
      await time.increaseTo(startTime + 1);
    });

    it("Should start a game with correct parameters", async function () {
      await token.connect(addr1).approve(await game.getAddress(), BET_AMOUNT);
      const gameId = await game.connect(addr1).startGame(tournamentId, BET_AMOUNT);
      
      const gameInfo = await game.getGameInfo(0);
      expect(gameInfo.player).to.equal(addr1.address);
      expect(gameInfo.betAmount).to.equal(BET_AMOUNT);
      expect(gameInfo.settled).to.be.false;
    });

    it("Should not start game with invalid bet amount", async function () {
      const invalidBetAmount = ethers.parseEther("20"); // Above MAX_BET
      await token.connect(addr1).approve(await game.getAddress(), invalidBetAmount);
      
      await expect(
        game.connect(addr1).startGame(tournamentId, invalidBetAmount)
      ).to.be.revertedWith("Invalid bet amount");
    });
  });

  describe("Game Settlement", function () {
    let tournamentId: number;
    let gameId: number;

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

      // Register and start tournament
      await token.connect(addr1).approve(await tournament.getAddress(), ENTRY_FEE);
      await tournament.connect(addr1).registerForTournament(tournamentId);
      await time.increaseTo(startTime + 1);

      // Start game
      await token.connect(addr1).approve(await game.getAddress(), BET_AMOUNT);
      await game.connect(addr1).startGame(tournamentId, BET_AMOUNT);
      gameId = 0;
    });

    it("Should settle game with WIN outcome correctly", async function () {
      const initialBalance = await token.balanceOf(addr1.address);
      await game.settleGame(gameId, 0); // WIN outcome

      const finalBalance = await token.balanceOf(addr1.address);
      expect(finalBalance - initialBalance).to.equal(BET_AMOUNT * BigInt(2));
    });

    it("Should settle game with LOSE outcome correctly", async function () {
      const initialBalance = await token.balanceOf(addr1.address);
      await game.settleGame(gameId, 1); // LOSE outcome

      const finalBalance = await token.balanceOf(addr1.address);
      expect(initialBalance - finalBalance).to.equal(BET_AMOUNT);
    });

    it("Should settle game with DRAW outcome correctly", async function () {
      const initialBalance = await token.balanceOf(addr1.address);
      await game.settleGame(gameId, 2); // DRAW outcome

      const finalBalance = await token.balanceOf(addr1.address);
      expect(finalBalance).to.equal(initialBalance);
    });

    it("Should not allow settling game twice", async function () {
      await game.settleGame(gameId, 0);
      await expect(game.settleGame(gameId, 0)).to.be.revertedWith("Game already settled");
    });

    it("Should not allow non-owner to settle game", async function () {
      await expect(
        game.connect(addr1).settleGame(gameId, 0)
      ).to.be.revertedWithCustomError(game, "OwnableUnauthorizedAccount");
    });
  });

  describe("Game Statistics", function () {
    it("Should track player games correctly", async function () {
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

      await token.connect(addr1).approve(await tournament.getAddress(), ENTRY_FEE);
      await tournament.connect(addr1).registerForTournament(0);
      await time.increaseTo(startTime + 1);

      await token.connect(addr1).approve(await game.getAddress(), BET_AMOUNT);
      await game.connect(addr1).startGame(0, BET_AMOUNT);

      const playerGames = await game.getPlayerGames(addr1.address);
      expect(playerGames.length).to.equal(1);
      expect(playerGames[0]).to.equal(0);
    });

    it("Should track tournament games per player correctly", async function () {
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

      await token.connect(addr1).approve(await tournament.getAddress(), ENTRY_FEE);
      await tournament.connect(addr1).registerForTournament(0);
      await time.increaseTo(startTime + 1);

      await token.connect(addr1).approve(await game.getAddress(), BET_AMOUNT);
      await game.connect(addr1).startGame(0, BET_AMOUNT);

      expect(await game.getPlayerTournamentGames(0, addr1.address)).to.equal(1);
    });
  });
}); 