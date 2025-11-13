import { int, mysqlTable, text, timestamp, varchar, mysqlEnum } from "drizzle-orm/mysql-core";

/**
 * Face embeddings table
 * Stores individual face samples for each user
 * Supports multiple samples for improved accuracy
 */
export const faceEmbeddings = mysqlTable("faceEmbeddings", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(), // Reference to users table
  embedding: text("embedding").notNull(), // JSON array of 128/512 dimensional vector
  confidence: int("confidence").notNull(), // Detection confidence 0-100
  metadata: text("metadata"), // JSON with age, gender, expressions, etc.
  capturedAt: timestamp("capturedAt").defaultNow().notNull(),
});

export type FaceEmbedding = typeof faceEmbeddings.$inferSelect;
export type InsertFaceEmbedding = typeof faceEmbeddings.$inferInsert;

/**
 * Face recognition data for users
 * Stores facial embeddings for payment authentication
 */
export const faceRecognition = mysqlTable("faceRecognition", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(), // Reference to users table
  faceEmbedding: text("faceEmbedding").notNull(), // JSON array of facial feature vectors
  isActive: int("isActive").default(1).notNull(), // 1 = active, 0 = inactive
  stripeCustomerId: varchar("stripeCustomerId", { length: 255 }), // Stripe customer ID for payment
  paymentMethodId: varchar("paymentMethodId", { length: 255 }), // Default payment method
  maxPaymentAmount: int("maxPaymentAmount").default(5000).notNull(), // Max amount in cents for auto-payment
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastUsedAt: timestamp("lastUsedAt"),
});

export type FaceRecognition = typeof faceRecognition.$inferSelect;
export type InsertFaceRecognition = typeof faceRecognition.$inferInsert;

/**
 * Wallet system for users
 * Supports both custodial (托管) and non-custodial (非托管) wallets
 */
export const wallets = mysqlTable("wallets", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  walletType: mysqlEnum("walletType", ["custodial", "non_custodial"]).notNull(),
  walletAddress: varchar("walletAddress", { length: 255 }), // For non-custodial wallets
  balance: int("balance").default(0).notNull(), // Balance in cents (for custodial wallets)
  currency: varchar("currency", { length: 3 }).default("USD").notNull(),
  isDefault: int("isDefault").default(0).notNull(), // 1 = default wallet
  status: mysqlEnum("status", ["active", "frozen", "closed"]).default("active").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Wallet = typeof wallets.$inferSelect;
export type InsertWallet = typeof wallets.$inferInsert;

/**
 * Wallet transactions history
 */
export const walletTransactions = mysqlTable("walletTransactions", {
  id: int("id").autoincrement().primaryKey(),
  walletId: int("walletId").notNull(),
  type: mysqlEnum("type", ["deposit", "withdraw", "payment", "refund", "transfer"]).notNull(),
  amount: int("amount").notNull(), // Amount in cents
  currency: varchar("currency", { length: 3 }).default("USD").notNull(),
  status: mysqlEnum("status", ["pending", "completed", "failed", "cancelled"]).default("pending").notNull(),
  relatedOrderId: int("relatedOrderId"), // Link to orders table if this is a payment
  description: text("description"),
  metadata: text("metadata"), // JSON for additional data
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  completedAt: timestamp("completedAt"),
});

export type WalletTransaction = typeof walletTransactions.$inferSelect;
export type InsertWalletTransaction = typeof walletTransactions.$inferInsert;

/**
 * Gesture recognition events
 * Tracks hand gestures for payment confirmation
 */
export const gestureEvents = mysqlTable("gestureEvents", {
  id: int("id").autoincrement().primaryKey(),
  deviceId: int("deviceId").notNull(),
  userId: int("userId"), // Identified user from face recognition
  gestureType: mysqlEnum("gestureType", ["pick_up", "put_down", "yes", "no", "hold"]).notNull(),
  confidence: int("confidence").notNull(), // Confidence score 0-100
  productId: int("productId"), // Detected product
  state: mysqlEnum("state", ["S0_waiting", "S1_approaching", "S2_picked", "S3_checkout", "S4_completed"]).notNull(),
  metadata: text("metadata"), // JSON with hand landmarks and other data
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type GestureEvent = typeof gestureEvents.$inferSelect;
export type InsertGestureEvent = typeof gestureEvents.$inferInsert;

/**
 * Device product associations
 * Maps which products are available at each device
 */
export const deviceProducts = mysqlTable("deviceProducts", {
  id: int("id").autoincrement().primaryKey(),
  deviceId: int("deviceId").notNull(),
  productId: int("productId").notNull(),
  isActive: int("isActive").default(1).notNull(),
  displayOrder: int("displayOrder").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type DeviceProduct = typeof deviceProducts.$inferSelect;
export type InsertDeviceProduct = typeof deviceProducts.$inferInsert;
