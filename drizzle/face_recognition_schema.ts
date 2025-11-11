import { mysqlTable, int, varchar, text, timestamp, boolean, mysqlEnum, binary, decimal } from "drizzle-orm/mysql-core";

/**
 * User identities table - stores external OAuth identities (Cognito, Google, Apple, etc.)
 * Allows users to link multiple identity providers to a single account
 */
export const userIdentities = mysqlTable("user_identities", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(), // Reference to users table
  provider: varchar("provider", { length: 50 }).notNull(), // cognito, google, apple, facebook
  providerSubject: varchar("providerSubject", { length: 255 }).notNull(), // Unique ID from provider
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// Unique constraint: one provider account can only be linked to one user
export const userIdentitiesUniqueIndex = {
  name: "idx_user_identities_provider_subject",
  columns: ["provider", "providerSubject"],
  unique: true,
};

export type UserIdentity = typeof userIdentities.$inferSelect;
export type InsertUserIdentity = typeof userIdentities.$inferInsert;

/**
 * Face profiles table - stores encrypted face embeddings/templates
 * Each user can have multiple face profiles (e.g., different angles, updated over time)
 * 
 * Security:
 * - faceTemplateEncrypted: AES-256-GCM encrypted embedding vector (128 or 512 dimensions)
 * - templateKmsKeyId: Reference to AWS KMS key used for encryption
 * - Only the face recognition service has decrypt permission via IAM role
 */
export const faceProfiles = mysqlTable("face_profiles", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(), // Reference to users table
  faceTemplateEncrypted: binary("faceTemplateEncrypted", { length: 2048 }).notNull(), // Encrypted embedding (max 2KB)
  templateKmsKeyId: varchar("templateKmsKeyId", { length: 255 }).notNull(), // AWS KMS key ARN
  modelVersion: varchar("modelVersion", { length: 50 }).notNull(), // Model version used to generate embedding
  enrollmentQuality: decimal("enrollmentQuality", { precision: 3, scale: 2 }), // Quality score 0.00-1.00
  deviceFingerprint: varchar("deviceFingerprint", { length: 255 }), // Device used for enrollment
  status: mysqlEnum("status", ["active", "inactive", "revoked"]).default("active").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  lastUsedAt: timestamp("lastUsedAt"),
  revokedAt: timestamp("revokedAt"),
  revokedReason: text("revokedReason"),
});

export type FaceProfile = typeof faceProfiles.$inferSelect;
export type InsertFaceProfile = typeof faceProfiles.$inferInsert;

/**
 * Face index mapping table - maps face profiles to vector database IDs
 * Used for ANN (Approximate Nearest Neighbor) search in FAISS/Milvus/Pinecone
 * 
 * The actual embedding vectors are stored in a specialized vector database,
 * and this table maintains the mapping between our face_profiles and vector DB IDs
 */
export const faceIndexMap = mysqlTable("face_index_map", {
  id: int("id").autoincrement().primaryKey(),
  faceProfileId: int("faceProfileId").notNull().unique(), // Reference to face_profiles
  vectorDbId: varchar("vectorDbId", { length: 255 }).notNull().unique(), // ID in FAISS/Milvus/Pinecone
  vectorDbName: varchar("vectorDbName", { length: 100 }).notNull(), // Which vector DB (faiss, milvus, pinecone)
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type FaceIndexMap = typeof faceIndexMap.$inferSelect;
export type InsertFaceIndexMap = typeof faceIndexMap.$inferInsert;

/**
 * Face verification attempts table - audit log for all face verification attempts
 * Critical for security monitoring, fraud detection, and compliance
 * 
 * Tracks both successful and failed verification attempts with detailed context
 */
export const faceVerificationAttempts = mysqlTable("face_verification_attempts", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId"), // Null if verification failed before user identification
  faceProfileId: int("faceProfileId"), // Which face profile was matched (if successful)
  action: varchar("action", { length: 50 }).notNull(), // login, payment, enrollment, verification
  result: mysqlEnum("result", ["success", "failed", "rejected"]).notNull(),
  confidenceScore: decimal("confidenceScore", { precision: 5, scale: 4 }), // 0.0000-1.0000
  livenessScore: decimal("livenessScore", { precision: 5, scale: 4 }), // 0.0000-1.0000
  livenessMethod: varchar("livenessMethod", { length: 50 }), // active_challenge, passive_detection
  failureReason: varchar("failureReason", { length: 255 }), // low_quality, no_match, liveness_failed, etc.
  ipAddress: varchar("ipAddress", { length: 45 }), // IPv4 or IPv6
  userAgent: text("userAgent"),
  deviceFingerprint: varchar("deviceFingerprint", { length: 255 }),
  geoLocation: varchar("geoLocation", { length: 255 }), // City, Country
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type FaceVerificationAttempt = typeof faceVerificationAttempts.$inferSelect;
export type InsertFaceVerificationAttempt = typeof faceVerificationAttempts.$inferInsert;

/**
 * Audit logs table - comprehensive audit trail for all sensitive operations
 * Covers user actions, system events, admin operations, and security events
 * 
 * Essential for:
 * - Security incident investigation
 * - Compliance (GDPR, CCPA, SOC2)
 * - User data access tracking
 * - System debugging
 */
export const auditLogs = mysqlTable("audit_logs", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId"), // User who performed the action (null for system events)
  action: varchar("action", { length: 100 }).notNull(), // user.login, face.enroll, payment.create, etc.
  actor: varchar("actor", { length: 100 }), // system, user, admin, service_name
  resourceType: varchar("resourceType", { length: 50 }), // user, face_profile, payment, order
  resourceId: varchar("resourceId", { length: 255 }), // ID of the affected resource
  detail: text("detail"), // JSON string with additional context
  ipAddress: varchar("ipAddress", { length: 45 }),
  userAgent: text("userAgent"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertAuditLog = typeof auditLogs.$inferInsert;

/**
 * User security settings table - stores user-specific security preferences
 * Includes MFA settings, device trust, and security notifications
 */
export const userSecuritySettings = mysqlTable("user_security_settings", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(), // One-to-one with users table
  mfaEnabled: boolean("mfaEnabled").default(false).notNull(),
  mfaSecret: varchar("mfaSecret", { length: 255 }), // Encrypted TOTP secret
  mfaBackupCodes: text("mfaBackupCodes"), // Encrypted JSON array of backup codes
  faceAuthEnabled: boolean("faceAuthEnabled").default(false).notNull(),
  passwordLastChanged: timestamp("passwordLastChanged"),
  lastSecurityReview: timestamp("lastSecurityReview"),
  trustedDevices: text("trustedDevices"), // JSON array of device fingerprints
  securityNotifications: boolean("securityNotifications").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type UserSecuritySettings = typeof userSecuritySettings.$inferSelect;
export type InsertUserSecuritySettings = typeof userSecuritySettings.$inferInsert;
