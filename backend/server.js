import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { ethers } from 'ethers';
import path from 'path';
import { fileURLToPath } from 'url';
import { initDb, saveOrder, getOrders, updateOrderStatus } from './database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3002;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend')));

// --- Ethereum/ARC Setup ---
const ARC_RPC_URL = process.env.ARC_RPC_URL || 'https://rpc.testnet.arc.network';
const provider = new ethers.providers.JsonRpcProvider(ARC_RPC_URL);

// Relayer wallet (uses the admin private key to execute orders and pay gas)
const RELAYER_PRIVATE_KEY = process.env.ADMIN_PRIVATE_KEY;
if (!RELAYER_PRIVATE_KEY) {
  console.error('CRITICAL ERROR: ADMIN_PRIVATE_KEY is not defined in backend/.env!');
}
const wallet = new ethers.Wallet(RELAYER_PRIVATE_KEY, provider);

const SCHEDULER_ADDRESS = process.env.SCHEDULER_ADDRESS || '0x0e13299e56724Ce459e621b370f89552F87ede8B';
const SCHEDULER_ABI = [
  "function executeOrder(uint256 orderId) external",
  "function nextOrderId() external view returns (uint256)",
  "function orders(uint256) external view returns (uint256 id, address sender, address receiver, address token, uint256 amount, uint256 executeAt, uint256 createdAt, bool executed, bool cancelled)"
];
const schedulerContract = new ethers.Contract(SCHEDULER_ADDRESS, SCHEDULER_ABI, wallet);

// --- Poller Loop (Blockchain Sync & Automation) ---
async function pollAndExecuteOrders() {
  try {
    if (!SCHEDULER_ADDRESS || SCHEDULER_ADDRESS === '0x0000000000000000000000000000000000000000') {
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
      
      // Auto-sync database with blockchain states if they differ
      if (order.executed) {
        await updateOrderStatus(i, 'executed');
      } else if (order.cancelled) {
        await updateOrderStatus(i, 'cancelled');
      }

      // If time reached and not executed/cancelled
      if (now >= executeAt && !order.executed && !order.cancelled) {
        console.log(`[Poller] Found pending order #${i} to execute. executeAt: ${executeAt}`);
        
        try {
          const tx = await schedulerContract.executeOrder(i);
          console.log(`[Poller] Sent execution transaction for Order #${i}: ${tx.hash}`);
          
          await tx.wait();
          console.log(`[Poller] Order #${i} successfully executed on-chain!`);
          await updateOrderStatus(i, 'executed');
        } catch (err) {
          console.error(`[Poller] Error executing Order #${i}:`, err.message);
        }
      }
    }
  } catch (err) {
    console.error('[Poller] Error in polling cycle:', err.message);
  }
}

// REST API Endpoints
app.get('/api/agent-spec', (req, res) => {
  res.json({
    name: "PayWhen Scheduled Payment Protocol",
    version: "1.0.0",
    description: "An on-chain automatic payment scheduling protocol that allows locking USDC or EURC to be sent to a receiver wallet address at a specific future timestamp. Relayers automatically execute the payment on-chain at the specified time, sponsored by a gas fee relayer pool.",
    contracts: {
      network: "ARC Testnet (5042002)",
      schedulerAddress: SCHEDULER_ADDRESS,
      abi: [
        "function scheduleOrder(address token, address receiver, uint256 amount, uint256 executeAt) external returns (uint256)",
        "function cancelOrder(uint256 orderId) external",
        "function orders(uint256) external view returns (uint256 id, address sender, address receiver, address token, uint256 amount, uint256 executeAt, uint256 createdAt, bool executed, bool cancelled)"
      ]
    },
    tokens: {
      USDC: "0x8172189cCE9b68F94Ee23fB5077748495B85098F",
      EURC: "0xe2935B5077748495B85098F8172189cCE9b68F94"
    },
    endpoints: {
      status: {
        path: "/api/status",
        method: "GET",
        description: "Get current status, contract address, and relayer gas balance."
      },
      getOrders: {
        path: "/api/orders",
        method: "GET",
        queryParams: {
          address: "string (Required: Lowercase sender wallet address)"
        },
        description: "Retrieve all scheduled orders for a specific sender."
      },
      createOrder: {
        path: "/api/orders",
        method: "POST",
        body: {
          id: "number (On-chain orderId returned from scheduleOrder transaction)",
          sender: "string (Lowercase sender wallet address)",
          receiver: "string (Lowercase receiver wallet address)",
          amount: "number (Float amount of tokens, e.g., 10.5)",
          token_symbol: "string ('USDC' or 'EURC')",
          token_address: "string (The token contract address)",
          execute_at: "number (Unix timestamp in seconds for execution time)",
          created_at: "number (Unix timestamp in seconds for order creation time)",
          status: "string ('pending')"
        },
        description: "Register a successfully scheduled on-chain transaction into the database for monitoring."
      },
      cancelOrder: {
        path: "/api/orders/{id}/cancel",
        method: "POST",
        description: "Cancel a scheduled order inside the database. Must also execute the cancelOrder transaction on-chain."
      }
    },
    agentWorkflow: [
      "Step 1: AI Agent approves the Scheduler Contract to spend the required token amount.",
      "Step 2: AI Agent executes the 'scheduleOrder' transaction on the Solidity contract.",
      "Step 3: AI Agent listens to the 'OrderScheduled' event to retrieve the generated orderId.",
      "Step 4: AI Agent registers the scheduled order by calling POST '/api/orders' with the order details.",
      "Step 5: The PayWhen automatic relayer will execute the payment at the scheduled time."
    ]
  });
});

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

// GET user orders (persistent)
app.get('/api/orders', async (req, res) => {
  const { address } = req.query;
  if (!address || typeof address !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid address query parameter' });
  }
  try {
    const orders = await getOrders(address);
    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST save scheduled order
app.post('/api/orders', async (req, res) => {
  const order = req.body;
  if (!order || !order.id) {
    return res.status(400).json({ error: 'Invalid order object' });
  }
  try {
    await saveOrder(order);
    console.log(`[Backend] Saved scheduled order #${order.id} to SQLite`);
    res.status(201).json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST cancel scheduled order
app.post('/api/orders/:id/cancel', async (req, res) => {
  const { id } = req.params;
  try {
    await updateOrderStatus(parseInt(id), 'cancelled');
    console.log(`[Backend] Cancelled order #${id} in SQLite`);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Initialize Database & Run Express App
async function startServer() {
  await initDb();
  
  app.listen(PORT, () => {
    console.log(`[Backend] PayWhen Scheduler Backend running on port ${PORT}`);
    pollAndExecuteOrders(); // Initial poll
    setInterval(pollAndExecuteOrders, 15000); // Run poller every 15 seconds
  });
}

startServer();
