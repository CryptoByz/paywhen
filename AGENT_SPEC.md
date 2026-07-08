# PayWhen: AI Agent Scheduled Payment Specification

This specification allows AI Agents (using LLMs, function calling, or custom scripts) to programmatically schedule future on-chain payments using the PayWhen protocol.

---

## 🛠 Protocol Architecture

PayWhen consists of:
1. **Solidity Smart Contract (`Scheduler.sol`)**: Handles the locking of assets (USDC/EURC) and safe release or cancellation on-chain.
2. **Relayer Service (Backend)**: Periodically checks scheduled orders and automatically executes them on-chain (paying gas fees on behalf of users).
3. **REST API**: Tracks scheduled orders, monitors status, and acts as the interface for AI Agents.

---

## ⛓ On-Chain Deployment Info

- **Network**: ARC Testnet (Chain ID: `5042002`)
- **Scheduler Contract Address**: `0x0e13299e56724Ce459e621b370f89552F87ede8B`
- **Supported Tokens**:
  - **USDC**: `0x8172189cCE9b68F94Ee23fB5077748495B85098F` (6 Decimals)
  - **EURC**: `0xe2935B5077748495B85098F8172189cCE9b68F94` (6 Decimals)

### Solidity ABI for Agents:
```json
[
  "function scheduleOrder(address token, address receiver, uint256 amount, uint256 executeAt) external returns (uint256)",
  "function cancelOrder(uint256 orderId) external",
  "function orders(uint256) external view returns (uint256 id, address sender, address receiver, address token, uint256 amount, uint256 executeAt, uint256 createdAt, bool executed, bool cancelled)"
]
```

---

## 🌐 API Specifications (Off-Chain Sync)

The backend provides a live endpoint showing full tool specs at:
`GET https://api.paywhen.xyz/api/agent-spec`

### Endpoints:
1. **`GET /api/status`**
   - Retrieve contract address, active state, and relayer gas balance.
2. **`GET /api/orders?address={sender_address}`**
   - List all scheduled orders for a specific sender cüzdan.
3. **`POST /api/orders`**
   - Register a newly scheduled order in the backend database.
   - Body format:
     ```json
     {
       "id": 12,
       "sender": "0xSenderAddress...",
       "receiver": "0xReceiverAddress...",
       "amount": 25.5,
       "token_symbol": "USDC",
       "token_address": "0x8172189cCE9b68F94Ee23fB5077748495B85098F",
       "execute_at": 1783260000,
       "created_at": 1783173600,
       "status": "pending"
     }
     ```
4. **`POST /api/orders/{id}/cancel`**
   - Cancel the order inside the database (should be done alongside the on-chain cancellation).

---

## 🐍 Python AI Agent Integration Example

Here is a complete example showing how an AI Agent can write a tool to schedule a future token transfer:

```python
import time
import requests
from web3 import Web3

# 1. Setup Configurations
RPC_URL = "https://rpc.testnet.arc.network"
SCHEDULER_ADDRESS = "0x0e13299e56724Ce459e621b370f89552F87ede8B"
API_BASE_URL = "https://api.paywhen.xyz"

USDC_ADDRESS = "0x8172189cCE9b68F94Ee23fB5077748495B85098F"
DECIMALS = 6

w3 = Web3(Web3.HTTPProvider(RPC_URL))

# ABI definitions
SCHEDULER_ABI = [...]
ERC20_ABI = [...]

def schedule_payment_agent_tool(private_key, receiver, amount, delay_seconds):
    """
    AI Agent Tool: Schedules a future token payment.
    """
    account = w3.eth.account.from_key(private_key)
    sender = account.address
    
    # Calculate execution timestamp
    execute_at = int(time.time()) + delay_seconds
    token_amount_raw = int(amount * (10 ** DECIMALS))
    
    # 2. Token Approval
    token_contract = w3.eth.contract(address=USDC_ADDRESS, abi=ERC20_ABI)
    allowance = token_contract.functions.allowance(sender, SCHEDULER_ADDRESS).call()
    
    if allowance < token_amount_raw:
        print("Approving token spend...")
        tx = token_contract.functions.approve(SCHEDULER_ADDRESS, token_amount_raw).build_transaction({
            'from': sender,
            'nonce': w3.eth.get_transaction_count(sender),
            'gasPrice': w3.eth.gas_price
        })
        signed_tx = w3.eth.account.sign_transaction(tx, private_key)
        w3.eth.send_raw_transaction(signed_tx.rawTransaction)
        w3.eth.wait_for_transaction_receipt(signed_tx.hash)
        
    # 3. Schedule Order on Smart Contract
    scheduler_contract = w3.eth.contract(address=SCHEDULER_ADDRESS, abi=SCHEDULER_ABI)
    tx = scheduler_contract.functions.scheduleOrder(
        USDC_ADDRESS,
        receiver,
        token_amount_raw,
        execute_at
    ).build_transaction({
        'from': sender,
        'nonce': w3.eth.get_transaction_count(sender),
        'gasPrice': w3.eth.gas_price
    })
    
    signed_tx = w3.eth.account.sign_transaction(tx, private_key)
    tx_hash = w3.eth.send_raw_transaction(signed_tx.rawTransaction)
    receipt = w3.eth.wait_for_transaction_receipt(signed_tx.hash)
    
    # 4. Extract generated orderId from logs
    # Retrieve the orderId from the OrderScheduled log events...
    order_id = 1  # (Extract from receipt.logs)
    
    # 5. Sync to PayWhen database via REST API
    payload = {
        "id": order_id,
        "sender": sender.lower(),
        "receiver": receiver.lower(),
        "amount": amount,
        "token_symbol": "USDC",
        "token_address": USDC_ADDRESS,
        "execute_at": execute_at,
        "created_at": int(time.time()),
        "status": "pending"
    }
    
    response = requests.post(f"{API_BASE_URL}/api/orders", json=payload)
    if response.status_code == 201:
        print(f"Payment scheduled successfully! Order ID: #{order_id}")
        return True
    return False
```
