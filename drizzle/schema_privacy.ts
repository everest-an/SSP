/**
 * Privacy and Review Schema Definitions
 * Sprint 4 - Manual Review Panel + User Privacy Controls
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
  mysqlEnum,
  index,
  uniqueIndex,
} from "drizzle-orm/mysql-core";
import { users } from "./schema";

// ============================================
// 1. Face Match Reviews (Manual Review Queue)
// ============================================
export const faceMatchReviews = mysqlTable(
  "face_match_reviews",
  {
    id: bigint("id", { mode: "number" }).primaryKey().autoincrement(),
    matchAttemptId: bigint("match_attempt_id", { mode: "number" }).notNull(),
    userId: int("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    matchedUserId: int("matched_user_id"),
    similarityScore: decimal("similarity_score", { precision: 5, scale: 4 }).notNull(),
    matchType: mysqlEnum("match_type", ["enrollment", "verification", "payment"]).notNull(),
    reviewStatus: mysqlEnum("review_status", ["pending", "approved", "rejected", "escalated"]).default("pending"),
    reviewPriority: mysqlEnum("review_priority", ["low", "medium", "high", "critical"]).default("medium"),
    autoFlaggedReason: text("auto_flagged_reason"),
    reviewerId: int("reviewer_id"),
    reviewDecision: text("review_decision"),
    reviewedAt: timestamp("reviewed_at"),
    metadata: json("metadata").$type<{
      ipAddress?: string;
      deviceFingerprint?: string;
      geoLocation?: { country?: string; city?: string };
      userAgent?: string;
    }>(),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    reviewStatusIdx: index("idx_review_status").on(table.reviewStatus, table.reviewPriority, table.createdAt),
    userIdIdx: index("idx_user_id").on(table.userId),
    matchAttemptIdx: index("idx_match_attempt").on(table.matchAttemptId),
    reviewerIdx: index("idx_reviewer").on(table.reviewerId, table.reviewedAt),
  })
);

export type FaceMatchReview = typeof faceMatchReviews.$inferSelect;
export type InsertFaceMatchReview = typeof faceMatchReviews.$inferInsert;

// ============================================
// 2. User Privacy Settings
// ============================================
export const userPrivacySettings = mysqlTable(
  "user_privacy_settings",
  {
    id: int("id").primaryKey().autoincrement(),
    userId: int("user_id").notNull().unique().references(() => users.id, { onDelete: "cascade" }),
    faceAuthEnabled: boolean("face_auth_enabled").default(true),
    faceDataConsent: boolean("face_data_consent").default(false),
    faceDataConsentAt: timestamp("face_data_consent_at"),
    dataSharingConsent: boolean("data_sharing_consent").default(false),
    marketingConsent: boolean("marketing_consent").default(false),
    allowFaceForPayment: boolean("allow_face_for_payment").default(true),
    requireSecondFactor: boolean("require_second_factor").default(false),
    dataRetentionPreference: mysqlEnum("data_retention_preference", ["minimal", "standard", "extended"]).default("standard"),
    lastPrivacyReview: timestamp("last_privacy_review"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow(),
  },
  (table) => ({
    userIdIdx: index("idx_user_id").on(table.userId),
    faceConsentIdx: index("idx_face_consent").on(table.faceDataConsent),
  })
);

export type UserPrivacySettings = typeof userPrivacySettings.$inferSelect;
export type InsertUserPrivacySettings = typeof userPrivacySettings.$inferInsert;

// ============================================
// 3. Data Deletion Requests
// ============================================
export const dataDeletionRequests = mysqlTable(
  "data_deletion_requests",
  {
    id: int("id").primaryKey().autoincrement(),
    userId: int("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    requestType: mysqlEnum("request_type", ["face_data", "payment_data", "all_data", "account_closure"]).notNull(),
    status: mysqlEnum("status", ["pending", "processing", "completed", "failed"]).default("pending"),
    requestedAt: timestamp("requested_at").defaultNow(),
    processedAt: timestamp("processed_at"),
    processedBy: int("processed_by"),
    deletionProof: text("deletion_proof"),
    userConfirmationToken: varchar("user_confirmation_token", { length: 255 }),
    confirmedAt: timestamp("confirmed_at"),
    notes: text("notes"),
  },
  (table) => ({
    userStatusIdx: index("idx_user_status").on(table.userId, table.status),
    statusRequestedIdx: index("idx_status_requested").on(table.status, table.requestedAt),
  })
);

export type DataDeletionRequest = typeof dataDeletionRequests.$inferSelect;
export type InsertDataDeletionRequest = typeof dataDeletionRequests.$inferInsert;

// ============================================
// 4. Consent History
// ============================================
export const consentHistory = mysqlTable(
  "consent_history",
  {
    id: bigint("id", { mode: "number" }).primaryKey().autoincrement(),
    userId: int("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    consentType: varchar("consent_type", { length: 100 }).notNull(),
    consentGiven: boolean("consent_given").notNull(),
    consentVersion: varchar("consent_version", { length: 50 }),
    ipAddress: varchar("ip_address", { length: 45 }),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    userTypeIdx: index("idx_user_type").on(table.userId, table.consentType, table.createdAt),
    createdAtIdx: index("idx_created_at").on(table.createdAt),
  })
);

export type ConsentHistory = typeof consentHistory.$inferSelect;
export type InsertConsentHistory = typeof consentHistory.$inferInsert;

// ============================================
// 5. Admin Users
// ============================================
export const adminUsers = mysqlTable(
  "admin_users",
  {
    id: int("id").primaryKey().autoincrement(),
    userId: int("user_id").notNull().unique().references(() => users.id, { onDelete: "cascade" }),
    role: mysqlEnum("role", ["reviewer", "admin", "super_admin"]).notNull().default("reviewer"),
    permissions: json("permissions").$type<{
      can_review?: boolean;
      can_delete_data?: boolean;
      can_manage_users?: boolean;
      can_view_analytics?: boolean;
    }>(),
    active: boolean("active").default(true),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow(),
  },
  (table) => ({
    roleActiveIdx: index("idx_role_active").on(table.role, table.active),
  })
);

export type AdminUser = typeof adminUsers.$inferSelect;
export type InsertAdminUser = typeof adminUsers.$inferInsert;

// ============================================
// Helper Types
// ============================================

export interface ReviewQueueItem extends FaceMatchReview {
  userEmail?: string;
  userName?: string;
  matchedUserEmail?: string;
  reviewerName?: string;
}

export interface PrivacyDashboard {
  userId: number;
  faceDataConsent: boolean;
  faceProfilesCount: number;
  paymentMethodsCount: number;
  lastPrivacyReview: Date | null;
  pendingDeletionRequests: number;
  consentHistory: ConsentHistory[];
}
