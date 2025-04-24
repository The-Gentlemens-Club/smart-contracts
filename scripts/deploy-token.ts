import { ethers } from "hardhat";

async function main() {
  console.log("Deploying GentlemensToken...");

  const GentlemensToken = await ethers.getContractFactory("GentlemensToken");
  const token = await GentlemensToken.deploy();
  await token.waitForDeployment();

  const address = await token.getAddress();
  console.log(`GentlemensToken deployed to: ${address}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 