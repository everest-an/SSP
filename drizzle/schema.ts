import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, decimal, boolean, tinyint, binary } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extended with role-based access control for merchants and admins.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin", "merchant"]).default("user").notNull(),
  stripeCustomerId: varchar("stripeCustomerId", { length: 255 }), // Stripe customer ID for payments
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Merchants table - stores retail store information
 */
export const merchants = mysqlTable("merchants", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(), // Reference to users table
  businessName: varchar("businessName", { length: 255 }).notNull(),
  businessType: varchar("businessType", { length: 100 }), // e.g., "convenience", "grocery", "specialty"
  address: text("address"),
  phone: varchar("phone", { length: 50 }),
  email: varchar("email", { length: 320 }),
  status: mysqlEnum("status", ["active", "inactive", "suspended"]).default("active").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Merchant = typeof merchants.$inferSelect;
export type InsertMerchant = typeof merchants.$inferInsert;

/**
 * Products table - stores retail product information
 */
export const products = mysqlTable("products", {
  id: int("id").autoincrement().primaryKey(),
  merchantId: int("merchantId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  sku: varchar("sku", { length: 100 }),
  barcode: varchar("barcode", { length: 100 }),
  category: varchar("category", { length: 100 }),
  price: int("price").notNull(), // Price in cents to avoid decimal issues
  currency: varchar("currency", { length: 3 }).default("USD").notNull(),
  imageUrl: text("imageUrl"),
  stock: int("stock").default(0).notNull(),
  status: mysqlEnum("status", ["active", "inactive", "out_of_stock"]).default("active").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Product = typeof products.$inferSelect;
export type InsertProduct = typeof products.$inferInsert;

/**
 * Edge devices table - stores POS/camera device information
 */
export const devices = mysqlTable("devices", {
  id: int("id").autoincrement().primaryKey(),
  merchantId: int("merchantId").notNull(),
  deviceName: varchar("deviceName", { length: 255 }).notNull(),
  deviceType: mysqlEnum("deviceType", ["ipad", "android_tablet", "pos_terminal"]).notNull(),
  deviceId: varchar("deviceId", { length: 255 }).notNull().unique(), // Unique device identifier
  location: varchar("location", { length: 255 }), // Physical location in store
  status: mysqlEnum("status", ["online", "offline", "maintenance"]).default("offline").notNull(),
  lastHeartbeat: timestamp("lastHeartbeat"),
  firmwareVersion: varchar("firmwareVersion", { length: 50 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Device = typeof devices.$inferSelect;
export type InsertDevice = typeof devices.$inferInsert;

/**
 * Orders table - stores checkout transactions
 */
export const orders = mysqlTable("orders", {
  id: int("id").autoincrement().primaryKey(),
  merchantId: int("merchantId").notNull(),
  deviceId: int("deviceId"),
  customerId: int("customerId"), // Reference to users table (nullable for anonymous)
  orderNumber: varchar("orderNumber", { length: 100 }).notNull().unique(),
  totalAmount: int("totalAmount").notNull(), // Total in cents
  currency: varchar("currency", { length: 3 }).default("USD").notNull(),
  status: mysqlEnum("status", [
    "pending",
    "processing",
    "completed",
    "failed",
    "refunded",
    "cancelled"
  ]).default("pending").notNull(),
  paymentMethod: varchar("paymentMethod", { length: 50 }),
  paymentStatus: mysqlEnum("paymentStatus", ["pending", "authorized", "captured", "failed", "refunded"]).default("pending").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  completedAt: timestamp("completedAt"),
});

export type Order = typeof orders.$inferSelect;
export type InsertOrder = typeof orders.$inferInsert;

/**
 * Order items table - stores individual items in each order
 */
export const orderItems = mysqlTable("orderItems", {
  id: int("id").autoincrement().primaryKey(),
  orderId: int("orderId").notNull(),
  productId: int("productId").notNull(),
  productName: varchar("productName", { length: 255 }).notNull(), // Snapshot of product name
  quantity: int("quantity").default(1).notNull(),
  unitPrice: int("unitPrice").notNull(), // Price in cents at time of purchase
  totalPrice: int("totalPrice").notNull(), // quantity * unitPrice
  currency: varchar("currency", { length: 3 }).default("USD").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type OrderItem = typeof orderItems.$inferSelect;
export type InsertOrderItem = typeof orderItems.$inferInsert;

/**
 * Transactions table - stores payment transaction details
 */
export const transactions = mysqlTable("transactions", {
  id: int("id").autoincrement().primaryKey(),
  orderId: int("orderId").notNull(),
  transactionId: varchar("transactionId", { length: 255 }).notNull().unique(), // External payment gateway transaction ID
  paymentGateway: varchar("paymentGateway", { length: 50 }).notNull(), // e.g., "stripe", "paypal"
  amount: int("amount").notNull(), // Amount in cents
  currency: varchar("currency", { length: 3 }).default("USD").notNull(),
  status: mysqlEnum("status", ["pending", "success", "failed", "refunded"]).default("pending").notNull(),
  paymentMethod: varchar("paymentMethod", { length: 50 }),
  errorMessage: text("errorMessage"),
  metadata: text("metadata"), // JSON string for additional payment data
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Transaction = typeof transactions.$inferSelect;
export type InsertTransaction = typeof transactions.$inferInsert;

// Import extended schemas
export * from "./face-recognition-schema";

/**
 * Detection events table - stores computer vision detection events
 */
export const detectionEvents = mysqlTable("detectionEvents", {
  id: int("id").autoincrement().primaryKey(),
  deviceId: int("deviceId").notNull(),
  orderId: int("orderId"), // Linked to order if checkout was triggered
  eventType: mysqlEnum("eventType", [
    "hand_detected",
    "item_approached",
    "item_picked",
    "item_put_back",
    "checkout_triggered"
  ]).notNull(),
  productId: int("productId"),
  confidence: int("confidence"), // Confidence score (0-100)
  metadata: text("metadata"), // JSON string for detection details
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type DetectionEvent = typeof detectionEvents.$inferSelect;
export type InsertDetectionEvent = typeof detectionEvents.$inferInsert;

/**
 * Analytics table - stores aggregated analytics data
 */
export const analytics = mysqlTable("analytics", {
  id: int("id").autoincrement().primaryKey(),
  merchantId: int("merchantId").notNull(),
  date: timestamp("date").notNull(),
  metric: varchar("metric", { length: 100 }).notNull(), // e.g., "total_sales", "transaction_count"
  value: int("value").notNull(),
  metadata: text("metadata"), // JSON string for additional data
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Analytics = typeof analytics.$inferSelect;
export type InsertAnalytics = typeof analytics.$inferInsert;

// Audit logs moved to schema_security.ts (Sprint 3 enhanced version)
// Import from schema_security.ts if needed

/**
 * Payment Methods table - stores user payment methods
 * Supports credit/debit cards (via Stripe) and crypto wallets (MetaMask)
 */
export const paymentMethods = mysqlTable("payment_methods", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(), // Reference to users table
  type: mysqlEnum("type", ["card", "metamask", "custodial_wallet"]).notNull(),
  isDefault: tinyint("isDefault").default(0).notNull(), // 1 = default, 0 = not default
  
  // Stripe card details
  stripePaymentMethodId: varchar("stripePaymentMethodId", { length: 255 }),
  stripeCustomerId: varchar("stripeCustomerId", { length: 255 }),
  cardBrand: varchar("cardBrand", { length: 50 }), // visa, mastercard, amex, etc.
  cardLast4: varchar("cardLast4", { length: 4 }),
  cardExpMonth: int("cardExpMonth"),
  cardExpYear: int("cardExpYear"),
  
  // Crypto wallet details
  walletAddress: varchar("walletAddress", { length: 255 }), // Ethereum address
  walletType: varchar("walletType", { length: 50 }), // "non_custodial" for MetaMask
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type PaymentMethod = typeof paymentMethods.$inferSelect;
export type InsertPaymentMethod = typeof paymentMethods.$inferInsert;

// ============================================================================
// Face Recognition & Biometric Authentication Tables
// ============================================================================

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

// Note: auditLogs table already exists above (line 198)
// We will enhance the existing table instead of creating a duplicate

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

// Sprint 3: Export security-related tables
export * from './schema_security';
