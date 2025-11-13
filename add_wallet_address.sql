-- Add walletAddress column to merchants table
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS "walletAddress" VARCHAR(255);

-- Add comment
COMMENT ON COLUMN merchants."walletAddress" IS 'Ethereum wallet address for receiving cryptocurrency payments';

-- Verify the column was added
SELECT column_name, data_type, character_maximum_length 
FROM information_schema.columns 
WHERE table_name = 'merchants' AND column_name = 'walletAddress';
