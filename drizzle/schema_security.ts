/**
 * Security and Audit Schema Definitions
 * Sprint 3 - Enhanced Security Features
 */

import {
  mysqlTable,
  int,
  varchar,
  text,
  timestamp,
  boolean,
  decimal,
  json,
  bigint,
  tinyint,
  smallint,
  mysqlEnum,
  index,
  uniqueIndex,
} from "drizzle-orm/mysql-core";
import { users } from "./schema";
import { faceProfiles } from "./schema";

// ============================================
// 1. Face Index Map
// ============================================
export const faceIndexMap = mysqlTable(
  "face_index_map",
  {
    id: int("id").primaryKey().autoincrement(),
    faceProfileId: int("face_profile_id").notNull().references(() => faceProfiles.id, { onDelete: "cascade" }),
    vectorDbId: varchar("vector_db_id", { length: 255 }).notNull().unique(),
    vectorDbType: mysqlEnum("vector_db_type", ["faiss", "milvus", "pinecone"]).notNull().default("faiss"),
    indexVersion: varchar("index_version", { length: 50 }).notNull().default("v1"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow(),
  },
  (table) => ({
    vectorDbTypeIdx: index("idx_vector_db_type").on(table.vectorDbType, table.indexVersion),
    createdAtIdx: index("idx_created_at").on(table.createdAt),
  })
);

export type FaceIndexMap = typeof faceIndexMap.$inferSelect;
export type InsertFaceIndexMap = typeof faceIndexMap.$inferInsert;

// ============================================
// 2. Payment Methods
// ============================================
export const paymentMethods = mysqlTable(
  "payment_methods",
  {
    id: int("id").primaryKey().autoincrement(),
    userId: int("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    stripePaymentMethodId: varchar("stripe_payment_method_id", { length: 255 }).notNull(),
    stripeCustomerId: varchar("stripe_customer_id", { length: 255 }),
    type: mysqlEnum("type", ["card", "wallet", "bank_account", "platform_balance"]).notNull(),
    last4: varchar("last4", { length: 4 }),
    brand: varchar("brand", { length: 50 }),
    expMonth: tinyint("exp_month"),
    expYear: smallint("exp_year"),
    metadata: json("metadata"),
    isDefault: boolean("is_default").default(false),
    verified: boolean("verified").default(false),
    maxAutoPaymentAmount: decimal("max_auto_payment_amount", { precision: 10, scale: 2 }).default("50.00"),
    status: mysqlEnum("status", ["active", "inactive", "expired"]).default("active"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow(),
  },
  (table) => ({
    userDefaultIdx: index("idx_user_default").on(table.userId, table.isDefault),
    stripeCustomerIdx: index("idx_stripe_customer").on(table.stripeCustomerId),
    statusIdx: index("idx_status").on(table.status),
  })
);

export type PaymentMethod = typeof paymentMethods.$inferSelect;
export type InsertPaymentMethod = typeof paymentMethods.$inferInsert;

// ============================================
// 3. Audit Logs
// ============================================
export const auditLogs = mysqlTable(
  "audit_logs",
  {
    id: bigint("id", { mode: "number" }).primaryKey().autoincrement(),
    userId: int("user_id"),
    action: varchar("action", { length: 100 }).notNull(),
    actor: varchar("actor", { length: 255 }),
    resourceType: varchar("resource_type", { length: 50 }),
    resourceId: varchar("resource_id", { length: 100 }),
    ipAddress: varchar("ip_address", { length: 45 }),
    userAgent: text("user_agent"),
    deviceFingerprint: varchar("device_fingerprint", { length: 255 }),
    geoLocation: json("geo_location").$type<{
      country?: string;
      city?: string;
      lat?: number;
      lon?: number;
    }>(),
    detail: json("detail"),
    riskScore: decimal("risk_score", { precision: 3, scale: 2 }),
    status: mysqlEnum("status", ["success", "failure", "pending"]).default("success"),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    userActionIdx: index("idx_user_action").on(table.userId, table.action, table.createdAt),
    actionStatusIdx: index("idx_action_status").on(table.action, table.status, table.createdAt),
    createdAtIdx: index("idx_created_at").on(table.createdAt),
    riskScoreIdx: index("idx_risk_score").on(table.riskScore, table.createdAt),
  })
);

export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertAuditLog = typeof auditLogs.$inferInsert;

// ============================================
// 4. Device Bindings
// ============================================
export const deviceBindings = mysqlTable(
  "device_bindings",
  {
    id: int("id").primaryKey().autoincrement(),
    userId: int("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    deviceFingerprint: varchar("device_fingerprint", { length: 255 }).notNull(),
    deviceName: varchar("device_name", { length: 255 }),
    deviceType: varchar("device_type", { length: 50 }),
    os: varchar("os", { length: 50 }),
    browser: varchar("browser", { length: 50 }),
    publicKey: text("public_key"),
    firstSeenAt: timestamp("first_seen_at").defaultNow(),
    lastUsedAt: timestamp("last_used_at").defaultNow().onUpdateNow(),
    lastIp: varchar("last_ip", { length: 45 }),
    trusted: boolean("trusted").default(false),
    trustLevel: tinyint("trust_level").default(0),
    status: mysqlEnum("status", ["active", "revoked", "suspicious"]).default("active"),
    metadata: json("metadata"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    uniqueUserDevice: uniqueIndex("unique_user_device").on(table.userId, table.deviceFingerprint),
    deviceFingerprintIdx: index("idx_device_fingerprint").on(table.deviceFingerprint),
    trustedIdx: index("idx_trusted").on(table.userId, table.trusted, table.status),
    lastUsedIdx: index("idx_last_used").on(table.lastUsedAt),
  })
);

export type DeviceBinding = typeof deviceBindings.$inferSelect;
export type InsertDeviceBinding = typeof deviceBindings.$inferInsert;

// ============================================
// 5. Face Match Attempts
// ============================================
export const faceMatchAttempts = mysqlTable(
  "face_match_attempts",
  {
    id: bigint("id", { mode: "number" }).primaryKey().autoincrement(),
    userId: int("user_id"),
    faceProfileId: int("face_profile_id"),
    sessionId: varchar("session_id", { length: 255 }).notNull(),
    attemptType: mysqlEnum("attempt_type", ["login", "payment", "enrollment_check"]).notNull(),
    similarityScore: decimal("similarity_score", { precision: 5, scale: 4 }),
    thresholdUsed: decimal("threshold_used", { precision: 5, scale: 4 }).notNull(),
    success: boolean("success").notNull(),
    failureReason: varchar("failure_reason", { length: 255 }),
    livenessPassed: boolean("liveness_passed"),
    livenessConfidence: decimal("liveness_confidence", { precision: 3, scale: 2 }),
    ipAddress: varchar("ip_address", { length: 45 }),
    deviceFingerprint: varchar("device_fingerprint", { length: 255 }),
    geoLocation: json("geo_location").$type<{
      country?: string;
      city?: string;
      lat?: number;
      lon?: number;
    }>(),
    processingTimeMs: int("processing_time_ms"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    userAttemptsIdx: index("idx_user_attempts").on(table.userId, table.createdAt),
    sessionIdx: index("idx_session").on(table.sessionId),
    failuresIdx: index("idx_failures").on(table.success, table.failureReason, table.createdAt),
    similarityIdx: index("idx_similarity").on(table.similarityScore),
    createdAtIdx: index("idx_created_at").on(table.createdAt),
  })
);

export type FaceMatchAttempt = typeof faceMatchAttempts.$inferSelect;
export type InsertFaceMatchAttempt = typeof faceMatchAttempts.$inferInsert;

// ============================================
// Helper Types for API
// ============================================

export interface AuditLogInput {
  userId?: number;
  action: string;
  actor?: string;
  resourceType?: string;
  resourceId?: string;
  ipAddress?: string;
  userAgent?: string;
  deviceFingerprint?: string;
  geoLocation?: {
    country?: string;
    city?: string;
    lat?: number;
    lon?: number;
  };
  detail?: Record<string, any>;
  riskScore?: number;
  status?: "success" | "failure" | "pending";
  errorMessage?: string;
}

export interface FaceMatchAttemptInput {
  userId?: number;
  faceProfileId?: number;
  sessionId: string;
  attemptType: "login" | "payment" | "enrollment_check";
  similarityScore?: number;
  thresholdUsed: number;
  success: boolean;
  failureReason?: string;
  livenessPassed?: boolean;
  livenessConfidence?: number;
  ipAddress?: string;
  deviceFingerprint?: string;
  geoLocation?: {
    country?: string;
    city?: string;
    lat?: number;
    lon?: number;
  };
  processingTimeMs?: number;
}
