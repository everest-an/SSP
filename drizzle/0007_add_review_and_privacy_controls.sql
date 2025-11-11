-- Migration: Add manual review and privacy control features
-- Sprint 4: Manual Review Panel + User Privacy Controls + Payment Pause
-- Date: 2025-11-12

-- ============================================
-- 1. Add payment pause switch to users table
-- ============================================

ALTER TABLE `users`
ADD COLUMN `payment_enabled` BOOLEAN DEFAULT TRUE COMMENT 'Whether user can make payments (user-controlled pause switch)',
ADD COLUMN `payment_paused_at` TIMESTAMP NULL COMMENT 'When payment was paused by user',
ADD COLUMN `payment_pause_reason` TEXT COMMENT 'User-provided reason for pausing payments';

-- ============================================
-- 2. Create face_match_reviews table (manual review queue)
-- ============================================

CREATE TABLE IF NOT EXISTS `face_match_reviews` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `match_attempt_id` BIGINT NOT NULL COMMENT 'Reference to face_match_attempts',
  `user_id` INT NOT NULL,
  `matched_user_id` INT COMMENT 'The user that was matched (if any)',
  `similarity_score` DECIMAL(5, 4) NOT NULL COMMENT 'Similarity score from matching',
  `match_type` ENUM('enrollment', 'verification', 'payment') NOT NULL,
  `review_status` ENUM('pending', 'approved', 'rejected', 'escalated') DEFAULT 'pending',
  `review_priority` ENUM('low', 'medium', 'high', 'critical') DEFAULT 'medium',
  `auto_flagged_reason` TEXT COMMENT 'Why this was auto-flagged for review',
  `reviewer_id` INT COMMENT 'Admin user who reviewed this',
  `review_decision` TEXT COMMENT 'Reviewer notes and decision',
  `reviewed_at` TIMESTAMP NULL,
  `metadata` JSON COMMENT 'Additional context (IP, device, location, etc.)',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  INDEX `idx_review_status` (`review_status`, `review_priority`, `created_at`),
  INDEX `idx_user_id` (`user_id`),
  INDEX `idx_match_attempt` (`match_attempt_id`),
  INDEX `idx_reviewer` (`reviewer_id`, `reviewed_at`),
  
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Manual review queue for suspicious face matches';

-- ============================================
-- 3. Create user_privacy_settings table
-- ============================================

CREATE TABLE IF NOT EXISTS `user_privacy_settings` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NOT NULL UNIQUE,
  `face_auth_enabled` BOOLEAN DEFAULT TRUE COMMENT 'User can enable/disable face auth',
  `face_data_consent` BOOLEAN DEFAULT FALSE COMMENT 'User consent to store face data',
  `face_data_consent_at` TIMESTAMP NULL COMMENT 'When consent was given',
  `data_sharing_consent` BOOLEAN DEFAULT FALSE COMMENT 'Consent to share data with third parties',
  `marketing_consent` BOOLEAN DEFAULT FALSE COMMENT 'Consent to receive marketing emails',
  `allow_face_for_payment` BOOLEAN DEFAULT TRUE COMMENT 'Allow using face for payment authorization',
  `require_second_factor` BOOLEAN DEFAULT FALSE COMMENT 'Always require second factor even with face',
  `data_retention_preference` ENUM('minimal', 'standard', 'extended') DEFAULT 'standard',
  `last_privacy_review` TIMESTAMP NULL COMMENT 'Last time user reviewed privacy settings',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX `idx_user_id` (`user_id`),
  INDEX `idx_face_consent` (`face_data_consent`),
  
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='User privacy preferences and consent tracking';

-- ============================================
-- 4. Create data_deletion_requests table
-- ============================================

CREATE TABLE IF NOT EXISTS `data_deletion_requests` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NOT NULL,
  `request_type` ENUM('face_data', 'payment_data', 'all_data', 'account_closure') NOT NULL,
  `status` ENUM('pending', 'processing', 'completed', 'failed') DEFAULT 'pending',
  `requested_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `processed_at` TIMESTAMP NULL,
  `processed_by` INT COMMENT 'Admin user who processed this',
  `deletion_proof` TEXT COMMENT 'Proof of deletion (hashes, logs, etc.)',
  `user_confirmation_token` VARCHAR(255) COMMENT 'Token for user to confirm deletion',
  `confirmed_at` TIMESTAMP NULL,
  `notes` TEXT,
  
  INDEX `idx_user_status` (`user_id`, `status`),
  INDEX `idx_status_requested` (`status`, `requested_at`),
  
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='User data deletion requests (GDPR/CCPA compliance)';

-- ============================================
-- 5. Create consent_history table
-- ============================================

CREATE TABLE IF NOT EXISTS `consent_history` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NOT NULL,
  `consent_type` VARCHAR(100) NOT NULL COMMENT 'Type of consent (face_data, payment, marketing, etc.)',
  `consent_given` BOOLEAN NOT NULL,
  `consent_version` VARCHAR(50) COMMENT 'Version of privacy policy/terms',
  `ip_address` VARCHAR(45),
  `user_agent` TEXT,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  INDEX `idx_user_type` (`user_id`, `consent_type`, `created_at`),
  INDEX `idx_created_at` (`created_at`),
  
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Audit trail of user consent changes';

-- ============================================
-- 6. Create admin_users table (for reviewers)
-- ============================================

CREATE TABLE IF NOT EXISTS `admin_users` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NOT NULL UNIQUE COMMENT 'Reference to users table',
  `role` ENUM('reviewer', 'admin', 'super_admin') NOT NULL DEFAULT 'reviewer',
  `permissions` JSON COMMENT 'Granular permissions',
  `active` BOOLEAN DEFAULT TRUE,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX `idx_role_active` (`role`, `active`),
  
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Admin users with review and management permissions';

-- ============================================
-- 7. Add indexes for performance
-- ============================================

-- Index for payment status checks
CREATE INDEX `idx_users_payment_enabled` ON `users`(`payment_enabled`);

-- ============================================
-- 8. Create views for admin dashboard
-- ============================================

-- View: Pending reviews summary
CREATE OR REPLACE VIEW `v_pending_reviews_summary` AS
SELECT 
  review_priority,
  match_type,
  COUNT(*) as pending_count,
  AVG(similarity_score) as avg_similarity,
  MIN(created_at) as oldest_pending,
  MAX(created_at) as newest_pending
FROM face_match_reviews
WHERE review_status = 'pending'
GROUP BY review_priority, match_type;

-- View: User privacy compliance status
CREATE OR REPLACE VIEW `v_user_privacy_compliance` AS
SELECT 
  u.id as user_id,
  u.email,
  ups.face_data_consent,
  ups.face_data_consent_at,
  ups.data_sharing_consent,
  ups.last_privacy_review,
  CASE 
    WHEN ups.last_privacy_review IS NULL THEN 'never_reviewed'
    WHEN ups.last_privacy_review < DATE_SUB(NOW(), INTERVAL 1 YEAR) THEN 'review_needed'
    ELSE 'compliant'
  END as compliance_status,
  COUNT(DISTINCT fp.id) as face_profiles_count,
  u.payment_enabled
FROM users u
LEFT JOIN user_privacy_settings ups ON u.id = ups.user_id
LEFT JOIN face_profiles fp ON u.id = fp.user_id
GROUP BY u.id, u.email, ups.face_data_consent, ups.face_data_consent_at, 
         ups.data_sharing_consent, ups.last_privacy_review, u.payment_enabled;

-- View: Review performance metrics
CREATE OR REPLACE VIEW `v_review_performance` AS
SELECT 
  reviewer_id,
  DATE(reviewed_at) as review_date,
  COUNT(*) as reviews_completed,
  SUM(CASE WHEN review_status = 'approved' THEN 1 ELSE 0 END) as approved_count,
  SUM(CASE WHEN review_status = 'rejected' THEN 1 ELSE 0 END) as rejected_count,
  AVG(TIMESTAMPDIFF(MINUTE, created_at, reviewed_at)) as avg_review_time_minutes
FROM face_match_reviews
WHERE reviewed_at IS NOT NULL
GROUP BY reviewer_id, DATE(reviewed_at);

-- ============================================
-- 9. Sample data for testing (optional)
-- ============================================

-- Uncomment to insert test admin user:
-- INSERT INTO admin_users (user_id, role, permissions)
-- VALUES (1, 'admin', '{"can_review": true, "can_delete_data": true, "can_manage_users": true}');

-- ============================================
-- Migration complete
-- ============================================
