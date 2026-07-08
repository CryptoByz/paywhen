# PayWhen Scheduler | Zaman Kilitli Transfer Otomasyonu

Trustless, on-chain time-locked payment scheduler built on the **ARC Network**. 
Users can deposit USDC or EURC and schedule future transfer instructions. The PayWhen Backend Relayer automatically triggers and executes the transaction on-chain once the deadline is reached, paying the gas fee.

---

## ⚡ Core Concept & Flow

```
[ 1. Schedule Order ] ───► [ 2. Lock Funds ] ───► [ 3. Auto Execute ] ───► [ 4. Settle / Pay ]
  User specifies amount     Tokens stored in        Backend triggers        Tokens sent to
  & target executeTime      smart contract          executeOrder()          designated receiver
```

1. **🔒 Secure Deposit:** The user calls `scheduleOrder()`, locking their USDC safely in the smart contract. For flexibility, the user retains ownership to **cancel and refund** their funds within a 24-hour cancellation window. After 24 hours, the order is locked permanently to guarantee payment to the receiver.
2. **🕒 Automated Execution:** The backend runs a lightweight polling loop. Once `block.timestamp >= executeAt`, it broadcasts `executeOrder(orderId)` using a relayer wallet, paying the gas fee (which is free on ARC testnet using faucets).
3. **🚫 Double-spending Protection:** Because tokens are held in escrow within the contract, there is zero risk of the user spending the funds before the execution date.

---

## 📁 Repository Structure

```
payday/
├── contracts/
│   └── TimeLockedScheduler.sol  # On-chain Escrow & Automation contract
├── backend/
│   ├── server.js                # Express app & Automatic Poller loop
│   └── package.json             # Backend dependencies (Ethers, Express)
├── frontend/
│   └── index.html               # Sleek Dashboard & Countdown UI
└── README.md                    # Documentation
```

---

## 🛠️ Installation & Run Guide

### 1. Deploy Contract
Compile and deploy `TimeLockedScheduler.sol` to ARC Testnet using your deployer wallet. Configure the deployed address in the backend config.

### 2. Run Backend
Create `.env` file under `backend/`:
```env
PORT=3002
ARC_RPC_URL=https://rpc.testnet.arc.network
ADMIN_PRIVATE_KEY=your_relayer_private_key
SCHEDULER_ADDRESS=deployed_scheduler_contract_address
```

Run NPM commands:
```bash
cd backend
npm install
npm start
```

### 3. Run Frontend
Serve the `frontend/index.html` file using any static file server or open it directly in your browser. Connect MetaMask to ARC Network and start scheduling transfers!
