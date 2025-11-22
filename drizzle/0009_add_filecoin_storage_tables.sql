-- Filecoin Storage Tables Migration
-- Created: 2025-11-22

-- Filecoin 存储记录表
CREATE TABLE IF NOT EXISTS filecoin_storage (
  id VARCHAR(64) PRIMARY KEY,
  piece_cid VARCHAR(128) NOT NULL UNIQUE,
  storage_type VARCHAR(50) NOT NULL,
  
  -- 关联 ID
  user_id VARCHAR(64),
  merchant_id VARCHAR(64),
  product_id VARCHAR(64),
  order_id VARCHAR(64),
  
  -- 文件信息
  filename VARCHAR(255) NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  size INTEGER NOT NULL,
  
  -- 元数据
  metadata JSON,
  description TEXT,
  
  -- 存储证明
  storage_proof VARCHAR(64),
  
  -- 时间戳
  uploaded_at TIMESTAMP NOT NULL DEFAULT NOW(),
  last_accessed_at TIMESTAMP,
  
  -- 状态
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE
);

-- 创建索引
CREATE INDEX idx_filecoin_storage_piece_cid ON filecoin_storage(piece_cid);
CREATE INDEX idx_filecoin_storage_user_id ON filecoin_storage(user_id);
CREATE INDEX idx_filecoin_storage_merchant_id ON filecoin_storage(merchant_id);
CREATE INDEX idx_filecoin_storage_product_id ON filecoin_storage(product_id);
CREATE INDEX idx_filecoin_storage_order_id ON filecoin_storage(order_id);
CREATE INDEX idx_filecoin_storage_type ON filecoin_storage(storage_type);

-- Filecoin 账户余额记录表
CREATE TABLE IF NOT EXISTS filecoin_accounts (
  id VARCHAR(64) PRIMARY KEY,
  address VARCHAR(42) NOT NULL UNIQUE,
  
  -- 余额信息
  fil_balance VARCHAR(50),
  usdfc_balance VARCHAR(50),
  storage_usage VARCHAR(50),
  
  -- 网络信息
  network VARCHAR(20) NOT NULL,
  
  -- 时间戳
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  last_synced_at TIMESTAMP
);

-- 创建索引
CREATE INDEX idx_filecoin_accounts_address ON filecoin_accounts(address);

-- Filecoin 交易记录表
CREATE TABLE IF NOT EXISTS filecoin_transactions (
  id VARCHAR(64) PRIMARY KEY,
  tx_hash VARCHAR(66) NOT NULL UNIQUE,
  
  -- 交易类型
  tx_type VARCHAR(50) NOT NULL,
  
  -- 关联信息
  user_id VARCHAR(64),
  merchant_id VARCHAR(64),
  storage_cid VARCHAR(128),
  
  -- 交易详情
  amount VARCHAR(50),
  gas_used VARCHAR(50),
  status VARCHAR(20) NOT NULL,
  
  -- 元数据
  metadata JSON,
  error_message TEXT,
  
  -- 时间戳
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  confirmed_at TIMESTAMP
);

-- 创建索引
CREATE INDEX idx_filecoin_transactions_tx_hash ON filecoin_transactions(tx_hash);
CREATE INDEX idx_filecoin_transactions_user_id ON filecoin_transactions(user_id);
CREATE INDEX idx_filecoin_transactions_merchant_id ON filecoin_transactions(merchant_id);
CREATE INDEX idx_filecoin_transactions_status ON filecoin_transactions(status);

-- 产品 Filecoin 存储关联表
CREATE TABLE IF NOT EXISTS product_filecoin_storage (
  id VARCHAR(64) PRIMARY KEY,
  product_id VARCHAR(64) NOT NULL,
  
  -- 存储 CID
  image_cid VARCHAR(128),
  data_cid VARCHAR(128),
  
  -- 时间戳
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 创建索引
CREATE INDEX idx_product_filecoin_storage_product_id ON product_filecoin_storage(product_id);

-- 订单 Filecoin 存储关联表
CREATE TABLE IF NOT EXISTS order_filecoin_storage (
  id VARCHAR(64) PRIMARY KEY,
  order_id VARCHAR(64) NOT NULL,
  
  -- 存储 CID
  invoice_cid VARCHAR(128),
  receipt_cid VARCHAR(128),
  
  -- 时间戳
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 创建索引
CREATE INDEX idx_order_filecoin_storage_order_id ON order_filecoin_storage(order_id);

-- KYC 文档 Filecoin 存储关联表
CREATE TABLE IF NOT EXISTS kyc_filecoin_storage (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64),
  merchant_id VARCHAR(64),
  
  -- 存储 CID
  document_cid VARCHAR(128) NOT NULL,
  document_type VARCHAR(50) NOT NULL,
  
  -- 时间戳
  uploaded_at TIMESTAMP NOT NULL DEFAULT NOW(),
  verified_at TIMESTAMP,
  
  -- 状态
  is_verified BOOLEAN NOT NULL DEFAULT FALSE
);

-- 创建索引
CREATE INDEX idx_kyc_filecoin_storage_user_id ON kyc_filecoin_storage(user_id);
CREATE INDEX idx_kyc_filecoin_storage_merchant_id ON kyc_filecoin_storage(merchant_id);
CREATE INDEX idx_kyc_filecoin_storage_document_cid ON kyc_filecoin_storage(document_cid);
