-- Test Data: Add Merchant Wallet Address
-- This script adds a test Ethereum wallet address to the merchant for MetaMask payment testing
-- Created: 2025-11-12

-- Update merchant with test wallet address
-- Note: This is the test wallet address from your development memory
UPDATE merchants 
SET walletAddress = '0x66794fC75C351ad9677cB00B2043868C11dfcadA'
WHERE id = 1;

-- Verify the update
SELECT 
    id,
    businessName,
    walletAddress,
    status
FROM merchants
WHERE id = 1;

-- Optional: Add wallet addresses for all active merchants
-- Uncomment below if you want to set wallet addresses for multiple merchants

/*
UPDATE merchants 
SET walletAddress = CASE 
    WHEN id = 1 THEN '0x66794fC75C351ad9677cB00B2043868C11dfcadA'
    WHEN id = 2 THEN '0xYourSecondMerchantWalletAddress'
    WHEN id = 3 THEN '0xYourThirdMerchantWalletAddress'
    ELSE walletAddress
END
WHERE status = 'active';
*/

-- Check all merchants with wallet addresses
SELECT 
    id,
    businessName,
    email,
    walletAddress,
    status,
    createdAt
FROM merchants
ORDER BY id;
