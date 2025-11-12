-- Add wallet address field to merchants table for receiving MetaMask payments
-- Migration: 0007_add_merchant_wallet_address
-- Created: 2025-11-12

ALTER TABLE `merchants` 
ADD COLUMN `walletAddress` VARCHAR(42) NULL COMMENT 'Ethereum wallet address for receiving crypto payments' AFTER `email`,
ADD INDEX `idx_wallet_address` (`walletAddress`);

-- Add comment
ALTER TABLE `merchants` 
MODIFY COLUMN `walletAddress` VARCHAR(42) NULL COMMENT 'Ethereum wallet address (0x...) for receiving MetaMask payments';
