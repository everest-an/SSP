-- Migration: Fix face_recognition table schema
-- Add missing fields: isActive, stripeCustomerId, paymentMethodId, maxPaymentAmount, updatedAt
-- Rename embedding to faceEmbedding for consistency

-- Step 1: Add new columns
ALTER TABLE face_recognition
ADD COLUMN isActive BOOLEAN NOT NULL DEFAULT TRUE AFTER userId,
ADD COLUMN stripeCustomerId VARCHAR(255) AFTER isActive,
ADD COLUMN paymentMethodId VARCHAR(255) AFTER stripeCustomerId,
ADD COLUMN maxPaymentAmount INT NOT NULL DEFAULT 5000 AFTER paymentMethodId,
ADD COLUMN updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER createdAt;

-- Step 2: Rename embedding column to faceEmbedding (if it exists as 'embedding')
-- Check if the column exists first
SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
  WHERE TABLE_SCHEMA = DATABASE() 
  AND TABLE_NAME = 'face_recognition' 
  AND COLUMN_NAME = 'embedding');

SET @sql = IF(@col_exists > 0, 
  'ALTER TABLE face_recognition CHANGE COLUMN embedding faceEmbedding TEXT NOT NULL',
  'SELECT "Column embedding does not exist, skipping rename" AS message');

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
