-- Supabase Database Schema for PayWhen
-- Paste this script inside your Supabase project SQL Editor to create the necessary tables.

CREATE TABLE IF NOT EXISTS orders (
    id BIGINT PRIMARY KEY, -- The unique order ID from the smart contract
    sender VARCHAR(42) NOT NULL, -- Sender wallet address (lowercase)
    receiver VARCHAR(42) NOT NULL, -- Receiver wallet address (lowercase)
    amount NUMERIC NOT NULL, -- Token amount to transfer
    token_symbol VARCHAR(10) NOT NULL, -- USDC or EURC
    token_address VARCHAR(42) NOT NULL, -- Token smart contract address
    execute_at BIGINT NOT NULL, -- Epoch timestamp (seconds) when transaction executes
    created_at BIGINT NOT NULL, -- Epoch timestamp (seconds) when order was scheduled
    status VARCHAR(20) NOT NULL DEFAULT 'pending' -- pending, executed, cancelled
);

-- Indexing for fast dashboard retrieval of user address transactions
CREATE INDEX IF NOT EXISTS idx_orders_sender ON orders(sender);
CREATE INDEX IF NOT EXISTS idx_orders_receiver ON orders(receiver);

-- Disable Row Level Security (RLS) for testing or configure open policies:
ALTER TABLE orders DISABLE ROW LEVEL SECURITY;
