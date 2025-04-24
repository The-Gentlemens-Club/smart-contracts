import { ethers } from "hardhat";

async function main() {
  // Get the token address from command line arguments or environment variables
  const tokenAddress = process.env.TOKEN_ADDRESS;
  if (!tokenAddress) {
    throw new Error("TOKEN_ADDRESS not set");
  }

  console.log("Deploying Tournament contract...");
  const Tournament = await ethers.getContractFactory("Tournament");
  const tournament = await Tournament.deploy(tokenAddress);
  await tournament.waitForDeployment();

  const tournamentAddress = await tournament.getAddress();
  console.log(`Tournament deployed to: ${tournamentAddress}`);

  console.log("Deploying Game contract...");
  const Game = await ethers.getContractFactory("Game");
  const game = await Game.deploy(tokenAddress, tournamentAddress);
  await game.waitForDeployment();

  const gameAddress = await game.getAddress();
  console.log(`Game deployed to: ${gameAddress}`);

  console.log("\nDeployment Summary:");
  console.log("------------------");
  console.log(`Token Address: ${tokenAddress}`);
  console.log(`Tournament Address: ${tournamentAddress}`);
  console.log(`Game Address: ${gameAddress}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 