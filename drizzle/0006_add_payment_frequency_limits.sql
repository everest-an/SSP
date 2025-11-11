-- Migration: Add payment frequency limits and transaction history
-- Sprint 3.5: Payment Frequency Control & Daily Transaction Summary
-- Date: 2025-11-12

-- ============================================
-- 1. Add frequency limit fields to payment_methods
-- ============================================

ALTER TABLE `payment_methods`
ADD COLUMN `max_transactions_per_period` INT DEFAULT 10 COMMENT 'Maximum number of transactions allowed in the time period',
ADD COLUMN `period_minutes` INT DEFAULT 10 COMMENT 'Time period in minutes for transaction frequency limit',
ADD COLUMN `daily_transaction_limit` DECIMAL(10, 2) DEFAULT 500.00 COMMENT 'Maximum total amount per day',
ADD COLUMN `send_daily_summary` BOOLEAN DEFAULT TRUE COMMENT 'Whether to send daily transaction summary email';

-- ============================================
-- 2. Create payment_transactions table
-- ============================================

CREATE TABLE IF NOT EXISTS `payment_transactions` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NOT NULL,
  `payment_method_id` INT NOT NULL,
  `stripe_payment_intent_id` VARCHAR(255) NOT NULL UNIQUE,
  `stripe_charge_id` VARCHAR(255),
  `amount` DECIMAL(10, 2) NOT NULL COMMENT 'Amount in dollars',
  `currency` VARCHAR(3) DEFAULT 'USD',
  `status` ENUM('pending', 'succeeded', 'failed', 'canceled', 'refunded') NOT NULL DEFAULT 'pending',
  `description` TEXT,
  `face_verification_session_token` VARCHAR(255) COMMENT 'Face verification session used for this payment',
  `metadata` JSON COMMENT 'Additional payment metadata',
  `failure_reason` TEXT COMMENT 'Reason for payment failure',
  `ip_address` VARCHAR(45),
  `device_fingerprint` VARCHAR(255),
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX `idx_user_created` (`user_id`, `created_at`),
  INDEX `idx_payment_method` (`payment_method_id`),
  INDEX `idx_status_created` (`status`, `created_at`),
  INDEX `idx_stripe_intent` (`stripe_payment_intent_id`),
  INDEX `idx_created_at` (`created_at`),
  
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`payment_method_id`) REFERENCES `payment_methods`(`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Payment transaction history';

-- ============================================
-- 3. Create daily_transaction_summaries table
-- ============================================

CREATE TABLE IF NOT EXISTS `daily_transaction_summaries` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NOT NULL,
  `summary_date` DATE NOT NULL,
  `transaction_count` INT DEFAULT 0,
  `total_amount` DECIMAL(10, 2) DEFAULT 0.00,
  `successful_count` INT DEFAULT 0,
  `failed_count` INT DEFAULT 0,
  `refunded_count` INT DEFAULT 0,
  `email_sent` BOOLEAN DEFAULT FALSE,
  `email_sent_at` TIMESTAMP NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  UNIQUE KEY `unique_user_date` (`user_id`, `summary_date`),
  INDEX `idx_summary_date` (`summary_date`),
  INDEX `idx_email_sent` (`email_sent`, `summary_date`),
  
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Daily transaction summaries for email reports';

-- ============================================
-- 4. Create email_notifications table
-- ============================================

CREATE TABLE IF NOT EXISTS `email_notifications` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NOT NULL,
  `email_type` ENUM('daily_summary', 'payment_alert', 'security_alert', 'account_update') NOT NULL,
  `recipient_email` VARCHAR(255) NOT NULL,
  `subject` VARCHAR(255) NOT NULL,
  `body_html` TEXT,
  `body_text` TEXT,
  `status` ENUM('pending', 'sent', 'failed', 'bounced') DEFAULT 'pending',
  `sent_at` TIMESTAMP NULL,
  `failure_reason` TEXT,
  `metadata` JSON COMMENT 'Additional email metadata (e.g., transaction IDs)',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  INDEX `idx_user_type` (`user_id`, `email_type`),
  INDEX `idx_status_created` (`status`, `created_at`),
  INDEX `idx_sent_at` (`sent_at`),
  
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Email notification queue and history';

-- ============================================
-- 5. Create view for real-time transaction stats
-- ============================================

CREATE OR REPLACE VIEW `v_user_payment_stats` AS
SELECT 
  u.id AS user_id,
  u.email,
  u.name,
  COUNT(pt.id) AS total_transactions,
  SUM(CASE WHEN pt.status = 'succeeded' THEN 1 ELSE 0 END) AS successful_transactions,
  SUM(CASE WHEN pt.status = 'failed' THEN 1 ELSE 0 END) AS failed_transactions,
  SUM(CASE WHEN pt.status = 'succeeded' THEN pt.amount ELSE 0 END) AS total_spent,
  MAX(pt.created_at) AS last_transaction_at,
  -- Today's stats
  SUM(CASE WHEN DATE(pt.created_at) = CURDATE() AND pt.status = 'succeeded' THEN pt.amount ELSE 0 END) AS today_total,
  SUM(CASE WHEN DATE(pt.created_at) = CURDATE() THEN 1 ELSE 0 END) AS today_count,
  -- Last 10 minutes stats (for frequency check)
  SUM(CASE WHEN pt.created_at >= DATE_SUB(NOW(), INTERVAL 10 MINUTE) THEN 1 ELSE 0 END) AS last_10min_count
FROM users u
LEFT JOIN payment_transactions pt ON u.id = pt.user_id
GROUP BY u.id, u.email, u.name;

-- ============================================
-- 6. Add comments for documentation
-- ============================================

ALTER TABLE `payment_methods` 
COMMENT = 'User payment methods with frequency limits and daily caps';

-- ============================================
-- 7. Sample data for testing (optional)
-- ============================================

-- Uncomment to insert test data:
-- INSERT INTO `payment_methods` (user_id, stripe_payment_method_id, type, max_transactions_per_period, period_minutes, daily_transaction_limit)
-- VALUES (1, 'pm_test_123', 'card', 5, 10, 1000.00);

-- ============================================
-- Migration complete
-- ============================================
