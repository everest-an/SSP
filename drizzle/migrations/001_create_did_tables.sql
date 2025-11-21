-- DID (Decentralized Identity) Tables Migration
-- Created: 2025-11-21
-- Description: Creates tables for DID identity management

-- DID Identities table
CREATE TABLE IF NOT EXISTS `did_identities` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `userId` INT NOT NULL UNIQUE,
  `did` VARCHAR(100) NOT NULL UNIQUE,
  `ethAddress` VARCHAR(42) NOT NULL UNIQUE,
  `publicKey` VARCHAR(132) NOT NULL,
  `faceVectorHash` VARCHAR(64) NOT NULL,
  `arweaveID` VARCHAR(64) NOT NULL,
  `email` VARCHAR(320),
  `status` ENUM('active', 'inactive', 'suspended') NOT NULL DEFAULT 'active',
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX `idx_userId` (`userId`),
  INDEX `idx_did` (`did`),
  INDEX `idx_ethAddress` (`ethAddress`),
  INDEX `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- DID Recovery table
CREATE TABLE IF NOT EXISTS `did_recovery` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `didIdentityId` INT NOT NULL,
  `recoveryMethod` ENUM('backup_id', 'private_key', 'social_recovery') NOT NULL,
  `recoveryData` TEXT,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `usedAt` TIMESTAMP NULL,
  
  INDEX `idx_didIdentityId` (`didIdentityId`),
  INDEX `idx_recoveryMethod` (`recoveryMethod`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- DID Sessions table
CREATE TABLE IF NOT EXISTS `did_sessions` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `didIdentityId` INT NOT NULL,
  `sessionToken` VARCHAR(255) NOT NULL UNIQUE,
  `deviceInfo` TEXT,
  `ipAddress` VARCHAR(45),
  `userAgent` TEXT,
  `expiresAt` TIMESTAMP NOT NULL,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `lastActivityAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  INDEX `idx_didIdentityId` (`didIdentityId`),
  INDEX `idx_sessionToken` (`sessionToken`),
  INDEX `idx_expiresAt` (`expiresAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- DID Transactions table
CREATE TABLE IF NOT EXISTS `did_transactions` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `didIdentityId` INT NOT NULL,
  `transactionType` ENUM('registration', 'update', 'transfer', 'payment') NOT NULL,
  `blockchain` VARCHAR(50) NOT NULL DEFAULT 'ethereum',
  `txHash` VARCHAR(66),
  `fromAddress` VARCHAR(42),
  `toAddress` VARCHAR(42),
  `amount` VARCHAR(78),
  `currency` VARCHAR(10),
  `status` ENUM('pending', 'confirmed', 'failed') NOT NULL DEFAULT 'pending',
  `blockNumber` INT,
  `gasUsed` VARCHAR(78),
  `metadata` TEXT,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `confirmedAt` TIMESTAMP NULL,
  
  INDEX `idx_didIdentityId` (`didIdentityId`),
  INDEX `idx_txHash` (`txHash`),
  INDEX `idx_status` (`status`),
  INDEX `idx_transactionType` (`transactionType`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- DID Audit Logs table
CREATE TABLE IF NOT EXISTS `did_audit_logs` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `didIdentityId` INT,
  `eventType` VARCHAR(100) NOT NULL,
  `eventData` TEXT,
  `ipAddress` VARCHAR(45),
  `userAgent` TEXT,
  `status` ENUM('success', 'failed') NOT NULL DEFAULT 'success',
  `errorMessage` TEXT,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  INDEX `idx_didIdentityId` (`didIdentityId`),
  INDEX `idx_eventType` (`eventType`),
  INDEX `idx_status` (`status`),
  INDEX `idx_createdAt` (`createdAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Add foreign key constraints (optional, can be added later)
-- ALTER TABLE `did_identities` ADD CONSTRAINT `fk_did_identities_userId` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE;
-- ALTER TABLE `did_recovery` ADD CONSTRAINT `fk_did_recovery_didIdentityId` FOREIGN KEY (`didIdentityId`) REFERENCES `did_identities`(`id`) ON DELETE CASCADE;
-- ALTER TABLE `did_sessions` ADD CONSTRAINT `fk_did_sessions_didIdentityId` FOREIGN KEY (`didIdentityId`) REFERENCES `did_identities`(`id`) ON DELETE CASCADE;
-- ALTER TABLE `did_transactions` ADD CONSTRAINT `fk_did_transactions_didIdentityId` FOREIGN KEY (`didIdentityId`) REFERENCES `did_identities`(`id`) ON DELETE CASCADE;
-- ALTER TABLE `did_audit_logs` ADD CONSTRAINT `fk_did_audit_logs_didIdentityId` FOREIGN KEY (`didIdentityId`) REFERENCES `did_identities`(`id`) ON DELETE CASCADE;
