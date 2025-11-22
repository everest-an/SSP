/**
 * Filecoin Storage Schema
 * 
 * 用于存储 Filecoin CID 和元数据的数据库表定义
 */

import { pgTable, varchar, text, integer, timestamp, jsonb, boolean } from 'drizzle-orm/pg-core';

/**
 * Filecoin 存储记录表
 * 存储所有上传到 Filecoin 的文件的 CID 和元数据
 */
export const filecoinStorage = pgTable('filecoin_storage', {
  id: varchar('id', { length: 64 }).primaryKey(), // UUID
  pieceCid: varchar('piece_cid', { length: 128 }).notNull().unique(), // Filecoin Piece CID
  storageType: varchar('storage_type', { length: 50 }).notNull(), // invoice, product_image, etc.
  
  // 关联 ID
  userId: varchar('user_id', { length: 64 }),
  merchantId: varchar('merchant_id', { length: 64 }),
  productId: varchar('product_id', { length: 64 }),
  orderId: varchar('order_id', { length: 64 }),
  
  // 文件信息
  filename: varchar('filename', { length: 255 }).notNull(),
  mimeType: varchar('mime_type', { length: 100 }).notNull(),
  size: integer('size').notNull(), // 文件大小（字节）
  
  // 元数据
  metadata: jsonb('metadata'), // 额外的元数据（JSON）
  description: text('description'),
  
  // 存储证明
  storageProof: varchar('storage_proof', { length: 64 }), // SHA256 哈希
  
  // 时间戳
  uploadedAt: timestamp('uploaded_at').notNull().defaultNow(),
  lastAccessedAt: timestamp('last_accessed_at'),
  
  // 状态
  isActive: boolean('is_active').notNull().default(true),
  isDeleted: boolean('is_deleted').notNull().default(false),
});

/**
 * Filecoin 账户余额记录表
 * 跟踪 Filecoin 账户的余额和存储使用情况
 */
export const filecoinAccounts = pgTable('filecoin_accounts', {
  id: varchar('id', { length: 64 }).primaryKey(), // UUID
  address: varchar('address', { length: 42 }).notNull().unique(), // Filecoin 地址
  
  // 余额信息
  filBalance: varchar('fil_balance', { length: 50 }), // FIL 余额
  usdfcBalance: varchar('usdfc_balance', { length: 50 }), // USDFC 余额
  storageUsage: varchar('storage_usage', { length: 50 }), // 存储使用量
  
  // 网络信息
  network: varchar('network', { length: 20 }).notNull(), // mainnet 或 calibration
  
  // 时间戳
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  lastSyncedAt: timestamp('last_synced_at'),
});

/**
 * Filecoin 交易记录表
 * 记录所有 Filecoin 相关的交易
 */
export const filecoinTransactions = pgTable('filecoin_transactions', {
  id: varchar('id', { length: 64 }).primaryKey(), // UUID
  txHash: varchar('tx_hash', { length: 66 }).notNull().unique(), // 交易哈希
  
  // 交易类型
  txType: varchar('tx_type', { length: 50 }).notNull(), // deposit, upload, download
  
  // 关联信息
  userId: varchar('user_id', { length: 64 }),
  merchantId: varchar('merchant_id', { length: 64 }),
  storageCid: varchar('storage_cid', { length: 128 }), // 关联的存储 CID
  
  // 交易详情
  amount: varchar('amount', { length: 50 }), // 交易金额
  gasUsed: varchar('gas_used', { length: 50 }), // Gas 使用量
  status: varchar('status', { length: 20 }).notNull(), // pending, confirmed, failed
  
  // 元数据
  metadata: jsonb('metadata'),
  errorMessage: text('error_message'),
  
  // 时间戳
  createdAt: timestamp('created_at').notNull().defaultNow(),
  confirmedAt: timestamp('confirmed_at'),
});

/**
 * 产品 Filecoin 存储关联表
 * 将产品与其在 Filecoin 上的存储关联
 */
export const productFilecoinStorage = pgTable('product_filecoin_storage', {
  id: varchar('id', { length: 64 }).primaryKey(),
  productId: varchar('product_id', { length: 64 }).notNull(),
  
  // 存储 CID
  imageCid: varchar('image_cid', { length: 128 }), // 商品图片 CID
  dataCid: varchar('data_cid', { length: 128 }), // 商品数据 CID
  
  // 时间戳
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

/**
 * 订单 Filecoin 存储关联表
 * 将订单与其账单在 Filecoin 上的存储关联
 */
export const orderFilecoinStorage = pgTable('order_filecoin_storage', {
  id: varchar('id', { length: 64 }).primaryKey(),
  orderId: varchar('order_id', { length: 64 }).notNull(),
  
  // 存储 CID
  invoiceCid: varchar('invoice_cid', { length: 128 }), // 账单 CID
  receiptCid: varchar('receipt_cid', { length: 128 }), // 收据 CID
  
  // 时间戳
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

/**
 * KYC 文档 Filecoin 存储关联表
 */
export const kycFilecoinStorage = pgTable('kyc_filecoin_storage', {
  id: varchar('id', { length: 64 }).primaryKey(),
  userId: varchar('user_id', { length: 64 }),
  merchantId: varchar('merchant_id', { length: 64 }),
  
  // 存储 CID
  documentCid: varchar('document_cid', { length: 128 }).notNull(),
  documentType: varchar('document_type', { length: 50 }).notNull(), // passport, license, etc.
  
  // 时间戳
  uploadedAt: timestamp('uploaded_at').notNull().defaultNow(),
  verifiedAt: timestamp('verified_at'),
  
  // 状态
  isVerified: boolean('is_verified').notNull().default(false),
});
