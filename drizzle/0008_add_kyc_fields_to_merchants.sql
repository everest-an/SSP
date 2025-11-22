-- Add KYC verification fields to merchants table
-- Migration: 0008_add_kyc_fields_to_merchants
-- Created: 2025-11-22
-- Purpose: Add kycVerified and kycVerifiedAt fields to support KYC verification workflow

ALTER TABLE `merchants` 
ADD COLUMN `kycVerified` BOOLEAN NOT NULL DEFAULT FALSE COMMENT 'Whether KYC verification is completed' AFTER `walletAddress`,
ADD COLUMN `kycVerifiedAt` TIMESTAMP NULL COMMENT 'When KYC was verified' AFTER `kycVerified`;

-- Add index for querying verified merchants
ALTER TABLE `merchants` 
ADD INDEX `idx_kyc_verified` (`kycVerified`, `kycVerifiedAt`);
