/**
 * Payment Schema Definitions
 * Sprint 3.5 - Payment Frequency Control & Transaction History
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
  date,
  mysqlEnum,
  index,
  uniqueIndex,
} from "drizzle-orm/mysql-core";
import { users } from "./schema";
import { paymentMethods } from "./schema_security";

// ============================================
// 1. Payment Transactions
// ============================================
export const paymentTransactions = mysqlTable(
  "payment_transactions",
  {
    id: bigint("id", { mode: "number" }).primaryKey().autoincrement(),
    userId: int("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    paymentMethodId: int("payment_method_id").notNull().references(() => paymentMethods.id, { onDelete: "restrict" }),
    stripePaymentIntentId: varchar("stripe_payment_intent_id", { length: 255 }).notNull().unique(),
    stripeChargeId: varchar("stripe_charge_id", { length: 255 }),
    amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
    currency: varchar("currency", { length: 3 }).default("USD"),
    status: mysqlEnum("status", ["pending", "succeeded", "failed", "canceled", "refunded"]).notNull().default("pending"),
    description: text("description"),
    faceVerificationSessionToken: varchar("face_verification_session_token", { length: 255 }),
    metadata: json("metadata"),
    failureReason: text("failure_reason"),
    ipAddress: varchar("ip_address", { length: 45 }),
    deviceFingerprint: varchar("device_fingerprint", { length: 255 }),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow(),
  },
  (table) => ({
    userCreatedIdx: index("idx_user_created").on(table.userId, table.createdAt),
    paymentMethodIdx: index("idx_payment_method").on(table.paymentMethodId),
    statusCreatedIdx: index("idx_status_created").on(table.status, table.createdAt),
    stripeIntentIdx: index("idx_stripe_intent").on(table.stripePaymentIntentId),
    createdAtIdx: index("idx_created_at").on(table.createdAt),
  })
);

export type PaymentTransaction = typeof paymentTransactions.$inferSelect;
export type InsertPaymentTransaction = typeof paymentTransactions.$inferInsert;

// ============================================
// 2. Daily Transaction Summaries
// ============================================
export const dailyTransactionSummaries = mysqlTable(
  "daily_transaction_summaries",
  {
    id: int("id").primaryKey().autoincrement(),
    userId: int("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    summaryDate: date("summary_date").notNull(),
    transactionCount: int("transaction_count").default(0),
    totalAmount: decimal("total_amount", { precision: 10, scale: 2 }).default("0.00"),
    successfulCount: int("successful_count").default(0),
    failedCount: int("failed_count").default(0),
    refundedCount: int("refunded_count").default(0),
    emailSent: boolean("email_sent").default(false),
    emailSentAt: timestamp("email_sent_at"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow(),
  },
  (table) => ({
    uniqueUserDate: uniqueIndex("unique_user_date").on(table.userId, table.summaryDate),
    summaryDateIdx: index("idx_summary_date").on(table.summaryDate),
    emailSentIdx: index("idx_email_sent").on(table.emailSent, table.summaryDate),
  })
);

export type DailyTransactionSummary = typeof dailyTransactionSummaries.$inferSelect;
export type InsertDailyTransactionSummary = typeof dailyTransactionSummaries.$inferInsert;

// ============================================
// 3. Email Notifications
// ============================================
export const emailNotifications = mysqlTable(
  "email_notifications",
  {
    id: bigint("id", { mode: "number" }).primaryKey().autoincrement(),
    userId: int("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    emailType: mysqlEnum("email_type", ["daily_summary", "payment_alert", "security_alert", "account_update"]).notNull(),
    recipientEmail: varchar("recipient_email", { length: 255 }).notNull(),
    subject: varchar("subject", { length: 255 }).notNull(),
    bodyHtml: text("body_html"),
    bodyText: text("body_text"),
    status: mysqlEnum("status", ["pending", "sent", "failed", "bounced"]).default("pending"),
    sentAt: timestamp("sent_at"),
    failureReason: text("failure_reason"),
    metadata: json("metadata").$type<{
      transactionIds?: number[];
      summaryDate?: string;
      alertType?: string;
    }>(),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    userTypeIdx: index("idx_user_type").on(table.userId, table.emailType),
    statusCreatedIdx: index("idx_status_created").on(table.status, table.createdAt),
    sentAtIdx: index("idx_sent_at").on(table.sentAt),
  })
);

export type EmailNotification = typeof emailNotifications.$inferSelect;
export type InsertEmailNotification = typeof emailNotifications.$inferInsert;

// ============================================
// 4. Enhanced Payment Methods (extend existing)
// ============================================
// Note: These fields should be added to the existing paymentMethods table via migration
// - maxTransactionsPerPeriod: int
// - periodMinutes: int
// - dailyTransactionLimit: decimal
// - sendDailySummary: boolean

export interface PaymentMethodWithLimits extends PaymentMethod {
  maxTransactionsPerPeriod?: number;
  periodMinutes?: number;
  dailyTransactionLimit?: string;
  sendDailySummary?: boolean;
}

// Helper type for payment method updates
export interface PaymentMethodLimitUpdate {
  maxTransactionsPerPeriod?: number;
  periodMinutes?: number;
  dailyTransactionLimit?: number;
  sendDailySummary?: boolean;
}

// Import PaymentMethod from schema_security
import type { PaymentMethod } from "./schema_security";
