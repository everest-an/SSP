-- Migration: Add security and audit tables for enhanced facial auth
-- Created: 2025-11-12
-- Sprint: 3

-- ============================================
-- 1. face_index_map: 向量索引映射表
-- ============================================
CREATE TABLE `face_index_map` (
  `id` INT PRIMARY KEY AUTO_INCREMENT,
  `face_profile_id` INT NOT NULL,
  `vector_db_id` VARCHAR(255) UNIQUE NOT NULL COMMENT 'ID in FAISS/Milvus/Pinecone',
  `vector_db_type` ENUM('faiss', 'milvus', 'pinecone') NOT NULL DEFAULT 'faiss',
  `index_version` VARCHAR(50) NOT NULL DEFAULT 'v1' COMMENT 'Index rebuild version',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (`face_profile_id`) REFERENCES `face_profiles`(`id`) ON DELETE CASCADE,
  INDEX `idx_vector_db_type` (`vector_db_type`, `index_version`),
  INDEX `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Maps face profiles to vector database indices';

-- ============================================
-- 2. payment_methods: 支付方式表
-- ============================================
CREATE TABLE `payment_methods` (
  `id` INT PRIMARY KEY AUTO_INCREMENT,
  `user_id` INT NOT NULL,
  `stripe_payment_method_id` VARCHAR(255) NOT NULL COMMENT 'Stripe PM token (pm_xxx)',
  `stripe_customer_id` VARCHAR(255) COMMENT 'Stripe customer ID (cus_xxx)',
  `type` ENUM('card', 'wallet', 'bank_account', 'platform_balance') NOT NULL,
  `last4` VARCHAR(4) COMMENT 'Last 4 digits for cards',
  `brand` VARCHAR(50) COMMENT 'Card brand: visa, mastercard, etc',
  `exp_month` TINYINT COMMENT 'Expiration month',
  `exp_year` SMALLINT COMMENT 'Expiration year',
  `metadata` JSON COMMENT 'Additional payment method metadata',
  `is_default` BOOLEAN DEFAULT FALSE,
  `verified` BOOLEAN DEFAULT FALSE COMMENT 'Whether payment method is verified',
  `max_auto_payment_amount` DECIMAL(10,2) DEFAULT 50.00 COMMENT 'Max amount for face-only payment',
  `status` ENUM('active', 'inactive', 'expired') DEFAULT 'active',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  INDEX `idx_user_default` (`user_id`, `is_default`),
  INDEX `idx_stripe_customer` (`stripe_customer_id`),
  INDEX `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='User payment methods linked to Stripe';

-- ============================================
-- 3. audit_logs: 审计日志表
-- ============================================
CREATE TABLE `audit_logs` (
  `id` BIGINT PRIMARY KEY AUTO_INCREMENT,
  `user_id` INT COMMENT 'User who performed the action (NULL for system)',
  `action` VARCHAR(100) NOT NULL COMMENT 'Action type: face_enroll, face_login, payment_charge, etc',
  `actor` VARCHAR(255) COMMENT 'Actor identifier: user, system, admin, service_name',
  `resource_type` VARCHAR(50) COMMENT 'Resource type: user, face_profile, payment_method, etc',
  `resource_id` VARCHAR(100) COMMENT 'Resource ID',
  `ip_address` VARCHAR(45) COMMENT 'IPv4 or IPv6 address',
  `user_agent` TEXT COMMENT 'Browser user agent string',
  `device_fingerprint` VARCHAR(255) COMMENT 'Device fingerprint hash',
  `geo_location` JSON COMMENT 'Geolocation data: {country, city, lat, lon}',
  `detail` JSON COMMENT 'Additional action details',
  `risk_score` DECIMAL(3,2) COMMENT 'Risk score 0.00-1.00',
  `status` ENUM('success', 'failure', 'pending') DEFAULT 'success',
  `error_message` TEXT COMMENT 'Error message if status=failure',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  INDEX `idx_user_action` (`user_id`, `action`, `created_at`),
  INDEX `idx_action_status` (`action`, `status`, `created_at`),
  INDEX `idx_created_at` (`created_at`),
  INDEX `idx_risk_score` (`risk_score` DESC, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Comprehensive audit log for security and compliance';

-- ============================================
-- 4. device_bindings: 设备绑定表
-- ============================================
CREATE TABLE `device_bindings` (
  `id` INT PRIMARY KEY AUTO_INCREMENT,
  `user_id` INT NOT NULL,
  `device_fingerprint` VARCHAR(255) NOT NULL COMMENT 'Unique device identifier',
  `device_name` VARCHAR(255) COMMENT 'User-friendly device name',
  `device_type` VARCHAR(50) COMMENT 'Device type: mobile, tablet, desktop',
  `os` VARCHAR(50) COMMENT 'Operating system',
  `browser` VARCHAR(50) COMMENT 'Browser name',
  `public_key` TEXT COMMENT 'Device public key for attestation',
  `first_seen_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `last_used_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `last_ip` VARCHAR(45) COMMENT 'Last known IP address',
  `trusted` BOOLEAN DEFAULT FALSE COMMENT 'Whether device is explicitly trusted',
  `trust_level` TINYINT DEFAULT 0 COMMENT 'Trust level 0-100',
  `status` ENUM('active', 'revoked', 'suspicious') DEFAULT 'active',
  `metadata` JSON COMMENT 'Additional device metadata',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  UNIQUE KEY `unique_user_device` (`user_id`, `device_fingerprint`),
  INDEX `idx_device_fingerprint` (`device_fingerprint`),
  INDEX `idx_trusted` (`user_id`, `trusted`, `status`),
  INDEX `idx_last_used` (`last_used_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Tracks and manages user devices for security';

-- ============================================
-- 5. face_match_attempts: 人脸匹配尝试记录表
-- ============================================
CREATE TABLE `face_match_attempts` (
  `id` BIGINT PRIMARY KEY AUTO_INCREMENT,
  `user_id` INT COMMENT 'Target user (NULL if no match found)',
  `face_profile_id` INT COMMENT 'Matched face profile (NULL if failed)',
  `session_id` VARCHAR(255) NOT NULL COMMENT 'Verification session ID',
  `attempt_type` ENUM('login', 'payment', 'enrollment_check') NOT NULL,
  `similarity_score` DECIMAL(5,4) COMMENT 'Cosine similarity score 0.0000-1.0000',
  `threshold_used` DECIMAL(5,4) NOT NULL COMMENT 'Threshold applied for this attempt',
  `success` BOOLEAN NOT NULL,
  `failure_reason` VARCHAR(255) COMMENT 'Reason for failure: low_similarity, liveness_failed, etc',
  `liveness_passed` BOOLEAN COMMENT 'Whether liveness check passed',
  `liveness_confidence` DECIMAL(3,2) COMMENT 'Liveness confidence 0.00-1.00',
  `ip_address` VARCHAR(45),
  `device_fingerprint` VARCHAR(255),
  `geo_location` JSON,
  `processing_time_ms` INT COMMENT 'Total processing time in milliseconds',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  INDEX `idx_user_attempts` (`user_id`, `created_at`),
  INDEX `idx_session` (`session_id`),
  INDEX `idx_failures` (`success`, `failure_reason`, `created_at`),
  INDEX `idx_similarity` (`similarity_score` DESC),
  INDEX `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Records all face matching attempts for monitoring and fraud detection';

-- ============================================
-- 6. 更新现有表: 添加缺失字段
-- ============================================

-- Add video_hash to face_verification_sessions for anti-replay
ALTER TABLE `face_verification_sessions`
ADD COLUMN `video_hash` VARCHAR(64) COMMENT 'SHA-256 hash of verification video' AFTER `session_token`,
ADD INDEX `idx_video_hash` (`video_hash`, `created_at`);

-- Add quality metrics to face_profiles
ALTER TABLE `face_profiles`
ADD COLUMN `enrollment_quality` DECIMAL(3,2) COMMENT 'Quality score 0.00-1.00' AFTER `encrypted_embedding`,
ADD COLUMN `model_version` VARCHAR(50) NOT NULL DEFAULT 'mediapipe-v1' COMMENT 'Model used for embedding' AFTER `enrollment_quality`,
ADD COLUMN `last_verified_at` TIMESTAMP NULL COMMENT 'Last successful verification' AFTER `created_at`;

-- Add risk tracking to users
ALTER TABLE `users`
ADD COLUMN `risk_score` DECIMAL(3,2) DEFAULT 0.00 COMMENT 'Current risk score 0.00-1.00' AFTER `role`,
ADD COLUMN `account_status` ENUM('active', 'suspended', 'locked', 'deleted') DEFAULT 'active' AFTER `risk_score`,
ADD COLUMN `last_login_at` TIMESTAMP NULL AFTER `last_signed_in`,
ADD COLUMN `failed_login_attempts` INT DEFAULT 0 AFTER `last_login_at`;

-- ============================================
-- 7. 创建视图: 用户安全概览
-- ============================================
CREATE OR REPLACE VIEW `user_security_overview` AS
SELECT 
  u.id AS user_id,
  u.email,
  u.account_status,
  u.risk_score,
  u.failed_login_attempts,
  u.last_login_at,
  COUNT(DISTINCT fp.id) AS face_profiles_count,
  COUNT(DISTINCT pm.id) AS payment_methods_count,
  COUNT(DISTINCT db.id) AS trusted_devices_count,
  MAX(fp.last_verified_at) AS last_face_verification,
  (
    SELECT COUNT(*) 
    FROM face_match_attempts fma 
    WHERE fma.user_id = u.id 
    AND fma.success = FALSE 
    AND fma.created_at > DATE_SUB(NOW(), INTERVAL 24 HOUR)
  ) AS failed_attempts_24h
FROM users u
LEFT JOIN face_profiles fp ON u.id = fp.user_id
LEFT JOIN payment_methods pm ON u.id = pm.user_id AND pm.status = 'active'
LEFT JOIN device_bindings db ON u.id = db.user_id AND db.trusted = TRUE AND db.status = 'active'
GROUP BY u.id;

-- ============================================
-- 8. 插入初始配置数据
-- ============================================

-- Insert audit log for migration
INSERT INTO `audit_logs` (
  `action`,
  `actor`,
  `resource_type`,
  `detail`,
  `status`
) VALUES (
  'database_migration',
  'system',
  'database',
  JSON_OBJECT(
    'migration_file', '0005_add_security_tables.sql',
    'tables_added', JSON_ARRAY('face_index_map', 'payment_methods', 'audit_logs', 'device_bindings', 'face_match_attempts'),
    'timestamp', NOW()
  ),
  'success'
);
