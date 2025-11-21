/**
 * DID (Decentralized Identity) Schema
 * 
 * Database schema for storing DID-related information
 */

import { mysqlTable, int, varchar, text, timestamp, boolean, mysqlEnum } from "drizzle-orm/mysql-core";

/**
 * DID Identities table - stores user DID information
 */
export const didIdentities = mysqlTable("did_identities", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(), // Reference to users table
  did: varchar("did", { length: 100 }).notNull().unique(), // DID (e.g., did:ethr:0x...)
  ethAddress: varchar("ethAddress", { length: 42 }).notNull().unique(), // Ethereum address
  publicKey: varchar("publicKey", { length: 132 }).notNull(), // Public key (hex)
  faceVectorHash: varchar("faceVectorHash", { length: 64 }).notNull(), // SHA-256 hash of face vector
  arweaveID: varchar("arweaveID", { length: 64 }).notNull(), // Arweave transaction ID
  email: varchar("email", { length: 320 }), // Optional email for recovery
  status: mysqlEnum("status", ["active", "inactive", "suspended"]).default("active").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type DIDIdentity = typeof didIdentities.$inferSelect;
export type InsertDIDIdentity = typeof didIdentities.$inferInsert;

/**
 * DID Recovery table - stores recovery information
 */
export const didRecovery = mysqlTable("did_recovery", {
  id: int("id").autoincrement().primaryKey(),
  didIdentityId: int("didIdentityId").notNull(), // Reference to did_identities table
  recoveryMethod: mysqlEnum("recoveryMethod", ["backup_id", "private_key", "social_recovery"]).notNull(),
  recoveryData: text("recoveryData"), // Encrypted recovery data
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  usedAt: timestamp("usedAt"), // When recovery was used
});

export type DIDRecovery = typeof didRecovery.$inferSelect;
export type InsertDIDRecovery = typeof didRecovery.$inferInsert;

/**
 * DID Sessions table - stores active DID sessions
 */
export const didSessions = mysqlTable("did_sessions", {
  id: int("id").autoincrement().primaryKey(),
  didIdentityId: int("didIdentityId").notNull(), // Reference to did_identities table
  sessionToken: varchar("sessionToken", { length: 255 }).notNull().unique(),
  deviceInfo: text("deviceInfo"), // Device information
  ipAddress: varchar("ipAddress", { length: 45 }), // IPv4 or IPv6
  userAgent: text("userAgent"), // Browser/device information
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  lastActivityAt: timestamp("lastActivityAt").defaultNow().notNull(),
});

export type DIDSession = typeof didSessions.$inferSelect;
export type InsertDIDSession = typeof didSessions.$inferInsert;

/**
 * DID Transactions table - stores DID-related blockchain transactions
 */
export const didTransactions = mysqlTable("did_transactions", {
  id: int("id").autoincrement().primaryKey(),
  didIdentityId: int("didIdentityId").notNull(), // Reference to did_identities table
  transactionType: mysqlEnum("transactionType", ["registration", "update", "transfer", "payment"]).notNull(),
  blockchain: varchar("blockchain", { length: 50 }).default("ethereum").notNull(), // e.g., "ethereum", "polygon"
  txHash: varchar("txHash", { length: 66 }), // Transaction hash (0x...)
  fromAddress: varchar("fromAddress", { length: 42 }),
  toAddress: varchar("toAddress", { length: 42 }),
  amount: varchar("amount", { length: 78 }), // Amount in wei (as string to avoid overflow)
  currency: varchar("currency", { length: 10 }), // e.g., "ETH", "MATIC"
  status: mysqlEnum("status", ["pending", "confirmed", "failed"]).default("pending").notNull(),
  blockNumber: int("blockNumber"),
  gasUsed: varchar("gasUsed", { length: 78 }),
  metadata: text("metadata"), // JSON metadata
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  confirmedAt: timestamp("confirmedAt"),
});

export type DIDTransaction = typeof didTransactions.$inferSelect;
export type InsertDIDTransaction = typeof didTransactions.$inferInsert;

/**
 * DID Audit Logs table - stores DID-related audit events
 */
export const didAuditLogs = mysqlTable("did_audit_logs", {
  id: int("id").autoincrement().primaryKey(),
  didIdentityId: int("didIdentityId"), // Reference to did_identities table (nullable for system events)
  eventType: varchar("eventType", { length: 100 }).notNull(), // e.g., "registration", "login", "recovery"
  eventData: text("eventData"), // JSON event data
  ipAddress: varchar("ipAddress", { length: 45 }),
  userAgent: text("userAgent"),
  status: mysqlEnum("status", ["success", "failed"]).default("success").notNull(),
  errorMessage: text("errorMessage"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type DIDAuditLog = typeof didAuditLogs.$inferSelect;
export type InsertDIDAuditLog = typeof didAuditLogs.$inferInsert;
