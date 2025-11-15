import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, decimal, boolean, tinyint, binary, blob } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extended with role-based access control for merchants and admins.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }).unique(),
  passwordHash: varchar("passwordHash", { length: 255 }), // For email/password login
  twoFactorSecret: varchar("twoFactorSecret", { length: 255 }), // TOTP secret for 2FA
  twoFactorEnabled: boolean("twoFactorEnabled").default(false).notNull(), // Whether 2FA is enabled
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
 * Login History table - tracks user login activities
 */
export const loginHistory = mysqlTable("login_history", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  loginMethod: varchar("loginMethod", { length: 64 }), // 'email', 'face', 'oauth'
  ipAddress: varchar("ipAddress", { length: 45 }), // IPv4 or IPv6
  userAgent: text("userAgent"), // Browser/device information
  deviceFingerprint: varchar("deviceFingerprint", { length: 255 }),
  location: varchar("location", { length: 255 }), // City, country
  status: mysqlEnum("status", ["success", "failed"]).default("success").notNull(),
  failureReason: text("failureReason"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type LoginHistory = typeof loginHistory.$inferSelect;
export type InsertLoginHistory = typeof loginHistory.$inferInsert;

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
  walletAddress: varchar("walletAddress", { length: 42 }), // Ethereum wallet address for receiving crypto payments
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
export * from "./schema_security"; // 新增导入安全相关的Schema
export * from "./schema_payment"; // 新增导入支付相关的Schema

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
  faceTemplateEncrypted: text("faceTemplateEncrypted").notNull(), // Encrypted embedding (base64 encoded)
  templateKmsKeyId: varchar("templateKmsKeyId", { length: 255 }).notNull(),
  enrollmentMethod: mysqlEnum("enrollmentMethod", ["initial", "update", "admin_override"]).default("initial").notNull(),
  enrollmentQuality: decimal("enrollmentQuality", { precision: 5, scale: 4 }), // Quality score of the enrolled template
  livenessPassed: boolean("livenessPassed").default(false).notNull(),
  livenessConfidence: decimal("livenessConfidence", { precision: 3, scale: 2 }),
  isDefault: boolean("isDefault").default(true).notNull(),
  status: mysqlEnum("status", ["active", "inactive", "pending_review", "revoked"]).default("active").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type FaceProfile = typeof faceProfiles.$inferSelect;
export type InsertFaceProfile = typeof faceProfiles.$inferInsert;

/**
 * Face verification sessions table - stores history of face login/payment attempts
 */
export const faceVerificationSessions = mysqlTable("face_verification_sessions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId"), // Nullable if verification failed to identify user
  faceProfileId: int("faceProfileId"),
  sessionId: varchar("sessionId", { length: 255 }).notNull().unique(),
  verificationType: mysqlEnum("verificationType", ["login", "payment", "enrollment_check"]).notNull(),
  success: boolean("success").default(false).notNull(),
  failureReason: varchar("failureReason", { length: 255 }),
  ipAddress: varchar("ipAddress", { length: 45 }),
  deviceFingerprint: varchar("deviceFingerprint", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type FaceVerificationSession = typeof faceVerificationSessions.$inferSelect;
export type InsertFaceVerificationSession = typeof faceVerificationSessions.$inferInsert;

/**
 * Face liveness sessions table - stores history of liveness checks
 */
export const faceLivenessSessions = mysqlTable("face_liveness_sessions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId"),
  sessionId: varchar("sessionId", { length: 255 }).notNull().unique(),
  livenessType: mysqlEnum("livenessType", ["passive", "active_challenge"]).notNull(),
  success: boolean("success").default(false).notNull(),
  confidenceScore: decimal("confidenceScore", { precision: 3, scale: 2 }),
  failureReason: varchar("failureReason", { length: 255 }),
  videoHash: varchar("videoHash", { length: 255 }), // Hash of the video stream for anti-replay
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type FaceLivenessSession = typeof faceLivenessSessions.$inferSelect;
export type InsertFaceLivenessSession = typeof faceLivenessSessions.$inferInsert;

/**
 * Face enrollment history table - stores history of face enrollment attempts
 */
export const faceEnrollmentHistory = mysqlTable("face_enrollment_history", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  faceProfileId: int("faceProfileId"),
  success: boolean("success").default(false).notNull(),
  failureReason: varchar("failureReason", { length: 255 }),
  enrollmentQuality: decimal("enrollmentQuality", { precision: 5, scale: 4 }),
  ipAddress: varchar("ipAddress", { length: 45 }),
  deviceFingerprint: varchar("deviceFingerprint", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type FaceEnrollmentHistory = typeof faceEnrollmentHistory.$inferSelect;
export type InsertFaceEnrollmentHistory = typeof faceEnrollmentHistory.$inferInsert;

// Remove the old paymentMethods definition to avoid conflict
// The new definition is in schema_payment.ts
// export const paymentMethods = ...

/**
 * Face Verification Attempts table - tracks face verification attempts for security
 */
export const faceVerificationAttempts = mysqlTable("face_verification_attempts", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  success: boolean("success").default(false).notNull(),
  confidence: decimal("confidence", { precision: 5, scale: 4 }),
  failureReason: varchar("failureReason", { length: 255 }),
  ipAddress: varchar("ipAddress", { length: 45 }),
  deviceFingerprint: varchar("deviceFingerprint", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type FaceVerificationAttempt = typeof faceVerificationAttempts.$inferSelect;
export type InsertFaceVerificationAttempt = typeof faceVerificationAttempts.$inferInsert;

/**
 * User Security Settings table - stores security preferences and settings
 */
export const userSecuritySettings = mysqlTable("user_security_settings", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  maxPaymentAmount: int("maxPaymentAmount").default(10000).notNull(), // Max payment amount in cents
  requireFaceVerification: boolean("requireFaceVerification").default(true).notNull(),
  require2FA: boolean("require2FA").default(false).notNull(),
  allowedDevices: text("allowedDevices"), // JSON array of allowed device fingerprints
  suspiciousActivityThreshold: int("suspiciousActivityThreshold").default(5).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type UserSecuritySetting = typeof userSecuritySettings.$inferSelect;
export type InsertUserSecuritySetting = typeof userSecuritySettings.$inferInsert;

/**
 * Face Match Attempts table - tracks face matching attempts for analytics
 */
export const faceMatchAttempts = mysqlTable("face_match_attempts", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  matchedUserId: int("matchedUserId"),
  similarity: decimal("similarity", { precision: 5, scale: 4 }),
  success: boolean("success").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type FaceMatchAttempt = typeof faceMatchAttempts.$inferSelect;
export type InsertFaceMatchAttempt = typeof faceMatchAttempts.$inferInsert;

/**
 * Email Notifications table - stores email notification preferences and history
 */
export const emailNotifications = mysqlTable("email_notifications", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  type: varchar("type", { length: 100 }).notNull(), // e.g., 'order_confirmation', 'payment_alert'
  subject: varchar("subject", { length: 255 }).notNull(),
  content: text("content").notNull(),
  sent: boolean("sent").default(false).notNull(),
  sentAt: timestamp("sentAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type EmailNotification = typeof emailNotifications.$inferSelect;
export type InsertEmailNotification = typeof emailNotifications.$inferInsert;

/**
 * Face Index Map table - maps face profiles to vector index IDs
 */
export const faceIndexMap = mysqlTable("face_index_map", {
  id: int("id").autoincrement().primaryKey(),
  faceProfileId: int("faceProfileId").notNull().unique(),
  vectorIndexId: varchar("vectorIndexId", { length: 255 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type FaceIndexMap = typeof faceIndexMap.$inferSelect;
export type InsertFaceIndexMap = typeof faceIndexMap.$inferInsert;

/**
 * Face Recognition table - stores face recognition data
 */
export const faceRecognition = mysqlTable("face_recognition", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  embedding: text("embedding").notNull(), // JSON array of face embedding
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type FaceRecognition = typeof faceRecognition.$inferSelect;
export type InsertFaceRecognition = typeof faceRecognition.$inferInsert;

/**
 * Wallets table - stores user wallet information
 */
export const wallets = mysqlTable("wallets", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  walletType: mysqlEnum("walletType", ["hosted", "non_hosted", "metamask"]).notNull(),
  walletAddress: varchar("walletAddress", { length: 255 }),
  balance: int("balance").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Wallet = typeof wallets.$inferSelect;
export type InsertWallet = typeof wallets.$inferInsert;

/**
 * Wallet Transactions table - stores wallet transaction history
 */
export const walletTransactions = mysqlTable("wallet_transactions", {
  id: int("id").autoincrement().primaryKey(),
  walletId: int("walletId").notNull(),
  transactionType: mysqlEnum("transactionType", ["deposit", "withdrawal", "payment"]).notNull(),
  amount: int("amount").notNull(),
  status: mysqlEnum("status", ["pending", "completed", "failed"]).default("pending").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type WalletTransaction = typeof walletTransactions.$inferSelect;
export type InsertWalletTransaction = typeof walletTransactions.$inferInsert;

/**
 * Payment Methods table - stores user payment methods
 */
export const paymentMethods = mysqlTable("payment_methods", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  methodType: mysqlEnum("methodType", ["stripe", "wallet", "metamask"]).notNull(),
  methodData: text("methodData"), // JSON data for payment method
  isDefault: boolean("isDefault").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type PaymentMethod = typeof paymentMethods.$inferSelect;
export type InsertPaymentMethod = typeof paymentMethods.$inferInsert;

/**
 * Payment Transactions table - stores payment transaction history
 */
export const paymentTransactions = mysqlTable("payment_transactions", {
  id: int("id").autoincrement().primaryKey(),
  orderId: int("orderId").notNull(),
  paymentMethodId: int("paymentMethodId").notNull(),
  amount: int("amount").notNull(),
  status: mysqlEnum("status", ["pending", "completed", "failed"]).default("pending").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type PaymentTransaction = typeof paymentTransactions.$inferSelect;
export type InsertPaymentTransaction = typeof paymentTransactions.$inferInsert;

/**
 * Consent History table - stores user consent and privacy preferences
 */
export const consentHistory = mysqlTable("consent_history", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  consentType: varchar("consentType", { length: 100 }).notNull(), // e.g., 'face_recognition', 'data_processing'
  granted: boolean("granted").default(false).notNull(),
  version: varchar("version", { length: 50 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ConsentHistory = typeof consentHistory.$inferSelect;
export type InsertConsentHistory = typeof consentHistory.$inferInsert;

/**
 * Face Match Reviews table - stores face match review queue
 */
export const faceMatchReviews = mysqlTable("face_match_reviews", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  matchedUserId: int("matchedUserId"),
  similarity: decimal("similarity", { precision: 5, scale: 4 }),
  status: mysqlEnum("status", ["pending", "approved", "rejected", "escalated"]).default("pending").notNull(),
  priority: mysqlEnum("priority", ["low", "medium", "high", "critical"]).default("medium").notNull(),
  matchType: mysqlEnum("matchType", ["enrollment", "verification", "payment"]).notNull(),
  reviewedBy: int("reviewedBy"),
  reviewNotes: text("reviewNotes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  reviewedAt: timestamp("reviewedAt"),
});

export type FaceMatchReview = typeof faceMatchReviews.$inferSelect;
export type InsertFaceMatchReview = typeof faceMatchReviews.$inferInsert;

/**
 * User Privacy Settings table - stores user privacy preferences
 */
export const userPrivacySettings = mysqlTable("user_privacy_settings", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  dataCollectionConsent: boolean("dataCollectionConsent").default(false).notNull(),
  marketingConsent: boolean("marketingConsent").default(false).notNull(),
  analyticsConsent: boolean("analyticsConsent").default(false).notNull(),
  thirdPartySharing: boolean("thirdPartySharing").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type UserPrivacySetting = typeof userPrivacySettings.$inferSelect;
export type InsertUserPrivacySetting = typeof userPrivacySettings.$inferInsert;

/**
 * Data Deletion Requests table - stores user data deletion requests
 */
export const dataDeletionRequests = mysqlTable("data_deletion_requests", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  status: mysqlEnum("status", ["pending", "processing", "completed", "cancelled"]).default("pending").notNull(),
  requestedAt: timestamp("requestedAt").defaultNow().notNull(),
  processedAt: timestamp("processedAt"),
  completedAt: timestamp("completedAt"),
  reason: text("reason"),
});

export type DataDeletionRequest = typeof dataDeletionRequests.$inferSelect;
export type InsertDataDeletionRequest = typeof dataDeletionRequests.$inferInsert;
