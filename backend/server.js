import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { ethers } from 'ethers';

const app = express();
const PORT = process.env.PORT || 3002;

app.use(cors());
app.use(express.json());

// --- Ethereum/ARC Setup ---
const ARC_RPC_URL = process.env.ARC_RPC_URL || 'https://rpc.testnet.arc.network';
const provider = new ethers.providers.JsonRpcProvider(ARC_RPC_URL);

// Relayer wallet (uses the admin private key to execute orders and pay gas)
const RELAYER_PRIVATE_KEY = process.env.ADMIN_PRIVATE_KEY || '***REDACTED_PRIVATE_KEY***';
const wallet = new ethers.Wallet(RELAYER_PRIVATE_KEY, provider);

const SCHEDULER_ADDRESS = process.env.SCHEDULER_ADDRESS || '0x0000000000000000000000000000000000000000'; // updated on deploy
const SCHEDULER_ABI = [
  "function executeOrder(uint256 orderId) external",
  "function nextOrderId() external view returns (uint256)",
  "function orders(uint256) external view returns (uint256 id, address sender, address receiver, address token, uint256 amount, uint256 executeAt, bool executed, bool cancelled)"
];
const schedulerContract = new ethers.Contract(SCHEDULER_ADDRESS, SCHEDULER_ABI, wallet);

// --- Poller Loop (Yöntem 2 Core Automation) ---
// Scans for executeAt <= block.timestamp periodically and executes them automatically
async function pollAndExecuteOrders() {
  try {
    if (SCHEDULER_ADDRESS === '0x0000000000000000000000000000000000000000') {
      console.log('[Poller] Waiting for contract deployment...');
      return;
    }

    const nextId = await schedulerContract.nextOrderId();
    const count = nextId.toNumber();
    const currentBlock = await provider.getBlock('latest');
    const now = currentBlock.timestamp;

    console.log(`[Poller] Scanning ${count} orders. Current Block Time: ${now}`);

    for (let i = 1; i <= count; i++) {
      const order = await schedulerContract.orders(i);
      const executeAt = order.executeAt.toNumber();
      
      // If time reached and not executed/cancelled
      if (now >= executeAt && !order.executed && !order.cancelled) {
        console.log(`[Poller] Found pending order #${i} to execute. executeAt: ${executeAt}`);
        
        try {
          const tx = await schedulerContract.executeOrder(i);
          console.log(`[Poller] Sent execution transaction for Order #${i}: ${tx.hash}`);
          
          await tx.wait();
          console.log(`[Poller] Order #${i} successfully executed on-chain!`);
        } catch (err) {
          console.error(`[Poller] Error executing Order #${i}:`, err.message);
        }
      }
    }
  } catch (err) {
    console.error('[Poller] Error in polling cycle:', err.message);
  }
}

// Run poller every 15 seconds
setInterval(pollAndExecuteOrders, 15000);

// API Endpoints for frontend status
app.get('/api/status', async (req, res) => {
  try {
    const balance = await provider.getBalance(wallet.address);
    res.json({
      relayerAddress: wallet.address,
      relayerBalanceETH: ethers.utils.formatEther(balance),
      schedulerAddress: SCHEDULER_ADDRESS,
      status: 'active'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`[Backend] PayDay Scheduler Backend running on port ${PORT}`);
  pollAndExecuteOrders(); // Initial poll
});
