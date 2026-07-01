// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC20 {
    function transfer(address to, uint256 value) external returns (bool);
    function transferFrom(address from, address to, uint256 value) external returns (bool);
    function balanceOf(address owner) external view returns (uint256);
}

/**
 * @title TimeLockedScheduler
 * @notice Trustless on-chain scheduler for future-dated token transfers.
 * Users deposit tokens and schedule a transfer. The backend relayer executes it at the target time.
 * Users can cancel and withdraw their funds anytime prior to execution.
 */
contract TimeLockedScheduler {

    // --- Custom Errors ---
    error InvalidReceiver();
    error InvalidAmount();
    error InvalidExecutionTime();
    error OrderNotFound();
    error OrderAlreadyExecuted();
    error OrderAlreadyCancelled();
    error ExecutionTimeNotReached();
    error Unauthorized();
    error TransferFailed();

    // --- Structs ---
    struct Order {
        uint256 id;
        address sender;
        address receiver;
        address token;
        uint256 amount;
        uint256 executeAt;
        bool executed;
        bool cancelled;
    }

    // --- State Variables ---
    uint256 public nextOrderId;
    mapping(uint256 => Order) public orders;

    // --- Events ---
    event OrderScheduled(uint256 indexed orderId, address indexed sender, address indexed receiver, address token, uint256 amount, uint256 executeAt);
    event OrderExecuted(uint256 indexed orderId, address indexed receiver, uint256 amount);
    event OrderCancelled(uint256 indexed orderId, address indexed sender, uint256 amount);

    // --- External Functions ---

    /**
     * @notice Schedules a future-dated transfer. Deposits tokens into this contract.
     */
    function scheduleOrder(
        address token,
        address receiver,
        uint256 amount,
        uint256 executeAt
    ) external returns (uint256) {
        if (receiver == address(0)) revert InvalidReceiver();
        if (amount == 0) revert InvalidAmount();
        if (executeAt <= block.timestamp) revert InvalidExecutionTime();

        // Pull tokens from sender
        bool success = IERC20(token).transferFrom(msg.sender, address(this), amount);
        if (!success) revert TransferFailed();

        uint256 orderId = ++nextOrderId;
        orders[orderId] = Order({
            id: orderId,
            sender: msg.sender,
            receiver: receiver,
            token: token,
            amount: amount,
            executeAt: executeAt,
            executed: false,
            cancelled: false
        });

        emit OrderScheduled(orderId, msg.sender, receiver, token, amount, executeAt);
        return orderId;
    }

    /**
     * @notice Executes a scheduled transfer if the target time is reached.
     * @dev Can be called by anyone (normally our backend relayer), paying the gas fee.
     */
    function executeOrder(uint256 orderId) external {
        Order storage order = orders[orderId];
        if (order.sender == address(0)) revert OrderNotFound();
        if (order.executed) revert OrderAlreadyExecuted();
        if (order.cancelled) revert OrderAlreadyCancelled();
        if (block.timestamp < order.executeAt) revert InvalidExecutionTime();

        order.executed = true;

        bool success = IERC20(order.token).transfer(order.receiver, order.amount);
        if (!success) revert TransferFailed();

        emit OrderExecuted(orderId, order.receiver, order.amount);
    }

    /**
     * @notice Cancels a scheduled transfer and retrieves the locked tokens.
     * @dev Only callable by the original order creator (sender).
     */
    function cancelOrder(uint256 orderId) external {
        Order storage order = orders[orderId];
        if (order.sender == address(0)) revert OrderNotFound();
        if (order.sender != msg.sender) revert Unauthorized();
        if (order.executed) revert OrderAlreadyExecuted();
        if (order.cancelled) revert OrderAlreadyCancelled();

        order.cancelled = true;

        bool success = IERC20(order.token).transfer(order.sender, order.amount);
        if (!success) revert TransferFailed();

        emit OrderCancelled(orderId, order.sender, order.amount);
    }

    // --- View Helpers ---

    function getOrder(uint256 orderId) external view returns (Order memory) {
        return orders[orderId];
    }
}
