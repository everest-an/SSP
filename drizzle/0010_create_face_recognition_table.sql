-- Migration: Create face_recognition table
-- This table stores face recognition data for users

CREATE TABLE IF NOT EXISTS face_recognition (
  id INT AUTO_INCREMENT PRIMARY KEY,
  userId INT NOT NULL,
  faceEmbedding TEXT NOT NULL COMMENT 'JSON array of face embedding',
  isActive BOOLEAN NOT NULL DEFAULT TRUE,
  stripeCustomerId VARCHAR(255),
  paymentMethodId VARCHAR(255),
  maxPaymentAmount INT NOT NULL DEFAULT 5000 COMMENT 'Maximum payment amount in cents',
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_userId (userId),
  INDEX idx_isActive (isActive)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
