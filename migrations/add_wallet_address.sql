-- SSP Database Migration: Add Merchant Wallet Address
-- Date: 2025-11-12
-- Purpose: Add walletAddress column to merchants table for MetaMask payment support

-- Add walletAddress column
ALTER TABLE merchants 
ADD COLUMN IF NOT EXISTS "walletAddress" VARCHAR(255);

-- Add comment to the column
COMMENT ON COLUMN merchants."walletAddress" IS 'Ethereum wallet address for receiving cryptocurrency payments';

-- Verify the column was added successfully
SELECT 
    column_name, 
    data_type, 
    character_maximum_length,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'merchants' 
AND column_name = 'walletAddress';

-- Expected output:
-- column_name    | data_type       | character_maximum_length | is_nullable | column_default
-- walletAddress  | character varying | 255                    | YES         | NULL
