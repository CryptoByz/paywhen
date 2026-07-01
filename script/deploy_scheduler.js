const fs = require('fs');
const path = require('path');
const solc = require('solc');
const { ethers } = require('ethers');

async function main() {
  console.log('Compiling TimeLockedScheduler.sol...');
  
  const contractPath = path.join(__dirname, '../contracts/TimeLockedScheduler.sol');
  const source = fs.readFileSync(contractPath, 'utf8');

  const input = {
    language: 'Solidity',
    sources: {
      'TimeLockedScheduler.sol': {
        content: source
      }
    },
    settings: {
      outputSelection: {
        '*': {
          '*': ['abi', 'evm.bytecode']
        }
      }
    }
  };

  const output = JSON.parse(solc.compile(JSON.stringify(input)));
  
  if (output.errors) {
    let hasError = false;
    for (const error of output.errors) {
      console.log(error.formattedMessage);
      if (error.severity === 'error') {
        hasError = true;
      }
    }
    if (hasError) {
      throw new Error('Compilation failed');
    }
  }

  const contractFile = output.contracts['TimeLockedScheduler.sol'];
  const contractName = 'TimeLockedScheduler';
  const contract = contractFile[contractName];
  const abi = contract.abi;
  const bytecode = contract.evm.bytecode.object;

  console.log(`Contract compiled successfully! Contract name: ${contractName}`);

  // Connect to ARC Testnet
  const rpcUrl = 'https://rpc.testnet.arc.network';
  const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
  const privateKey = '***REDACTED_PRIVATE_KEY***';
  const wallet = new ethers.Wallet(privateKey, provider);

  console.log(`Deploying from account: ${wallet.address}`);
  console.log(`Account balance: ${ethers.utils.formatEther(await wallet.getBalance())} ETH`);

  const factory = new ethers.ContractFactory(abi, bytecode, wallet);
  
  console.log('Sending deployment transaction...');
  const deployed = await factory.deploy();
  
  console.log(`Transaction Hash (txHash): ${deployed.deployTransaction.hash}`);
  
  console.log('Waiting for transaction confirmation...');
  await deployed.deployed();

  console.log(`Contract Deployed Successfully!`);
  console.log(`Deployed Contract Address: ${deployed.address}`);

  // Write variables to .env file in backend/
  const envPath = path.join(__dirname, '../backend/.env');
  const envContent = `PORT=3002
ARC_RPC_URL=https://rpc.testnet.arc.network
ADMIN_PRIVATE_KEY=***REDACTED_PRIVATE_KEY***
SCHEDULER_ADDRESS=${deployed.address}
`;
  fs.writeFileSync(envPath, envContent);
  console.log('Successfully generated backend/.env file!');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
