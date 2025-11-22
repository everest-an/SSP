# Filecoin/IPFS 存储集成指南

## 概述

SSP 项目已成功集成 Filecoin 去中心化存储，使用 Synapse SDK 实现用户账单、商品数据和 KYC 文档的永久存储。

## 架构设计

### 混合存储架构

```
┌─────────────────────────────────────────────────────────┐
│                     SSP 应用层                           │
└─────────────────────────────────────────────────────────┘
                         │
        ┌────────────────┼────────────────┐
        │                │                │
        ▼                ▼                ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│  MySQL 数据库 │  │   Arweave    │  │  Filecoin    │
│              │  │              │  │              │
│ • 实时数据    │  │ • DID 文档   │  │ • 账单 PDF   │
│ • 用户会话    │  │ • 身份数据   │  │ • 商品图片   │
│ • 交易记录    │  │ • 永久存储   │  │ • KYC 文档   │
│ • CID 索引   │  │              │  │ • 可验证存储 │
└──────────────┘  └──────────────┘  └──────────────┘
```

### 数据流程

1. **上传流程**:
   ```
   用户 → API → filecoinService → Synapse SDK → Filecoin 网络
                     ↓
                 MySQL (存储 CID)
   ```

2. **下载流程**:
   ```
   用户 → API → MySQL (获取 CID) → filecoinService → Synapse SDK → Filecoin 网络
   ```

## 环境配置

### 1. 安装依赖

```bash
npm install @filoz/synapse-sdk ethers@6 --legacy-peer-deps
```

### 2. 配置环境变量

在 `.env` 文件中添加以下配置：

```env
# Filecoin 网络配置
FILECOIN_NETWORK=calibration  # 或 mainnet
FILECOIN_PRIVATE_KEY=your_private_key_here

# 注意：不要提交私钥到版本控制！
```

### 3. 获取测试代币（Calibration 测试网）

#### 获取 tFIL（用于 Gas 费用）
访问 [Filecoin Calibration Faucet](https://faucet.calibration.fildev.network/)

#### 获取 USDFC（用于存储付款）
访问 [USDFC Faucet](https://faucet.calibration.fildev.network/usdfc)

## API 使用示例

### 1. 检查 Filecoin 配置

```typescript
const { configured } = await trpc.filecoin.isConfigured.query();
console.log('Filecoin configured:', configured);
```

### 2. 获取账户余额

```typescript
const balance = await trpc.filecoin.getBalance.query();
console.log('FIL Balance:', balance.fil);
console.log('USDFC Balance:', balance.usdfc);
console.log('Storage Usage:', balance.storageUsage);
```

### 3. 上传账单数据

```typescript
// 生成账单 PDF（示例）
const invoiceData = {
  orderId: 'ORDER-12345',
  items: [...],
  total: 100.00,
  date: new Date().toISOString(),
};

// 上传到 Filecoin
const result = await trpc.filecoin.uploadJSON.mutate({
  data: invoiceData,
  metadata: {
    type: 'invoice',
    userId: 'user-123',
    orderId: 'ORDER-12345',
    filename: 'invoice-12345.json',
    description: 'Invoice for order 12345',
  },
});

console.log('Invoice uploaded - CID:', result.pieceCid);
console.log('Size:', result.size, 'bytes');

// 保存 CID 到数据库
await db.insert(orderFilecoinStorage).values({
  id: generateId(),
  orderId: 'ORDER-12345',
  invoiceCid: result.pieceCid,
});
```

### 4. 下载账单数据

```typescript
// 从数据库获取 CID
const storage = await db
  .select()
  .from(orderFilecoinStorage)
  .where(eq(orderFilecoinStorage.orderId, 'ORDER-12345'))
  .limit(1);

if (storage[0]?.invoiceCid) {
  // 从 Filecoin 下载
  const { data } = await trpc.filecoin.downloadJSON.query({
    pieceCid: storage[0].invoiceCid,
  });
  
  console.log('Invoice data:', data);
}
```

### 5. 上传商品数据

```typescript
const result = await trpc.filecoin.uploadProductData.mutate({
  productId: 'PROD-789',
  merchantId: 'MERCHANT-456',
  productData: {
    name: 'Smart Watch',
    description: 'Advanced fitness tracking',
    price: 199.99,
    category: 'Electronics',
    images: ['image1.jpg', 'image2.jpg'],
    attributes: {
      color: 'Black',
      size: '42mm',
    },
  },
});

console.log('Product data uploaded - CID:', result.pieceCid);

// 保存到数据库
await db.insert(productFilecoinStorage).values({
  id: generateId(),
  productId: 'PROD-789',
  dataCid: result.pieceCid,
});
```

### 6. 存款到 Synapse（支付存储费用）

```typescript
const { txHash } = await trpc.filecoin.deposit.mutate({
  amount: '10', // 10 USDFC
});

console.log('Deposit transaction:', txHash);
```

### 7. 估算存储成本

```typescript
const dataSize = 1024 * 1024; // 1 MB
const cost = await trpc.filecoin.estimateCost.query({
  dataSize,
});

console.log('Estimated cost:', cost.costUSDFC, 'USDFC');
console.log('Duration:', cost.duration);
```

### 8. 生成和验证存储证明

```typescript
// 生成证明
const { proof } = await trpc.filecoin.generateProof.query({
  pieceCid: 'bafk...',
  metadata: { /* ... */ },
});

console.log('Storage proof:', proof);

// 验证证明
const { isValid } = await trpc.filecoin.verifyProof.query({
  pieceCid: 'bafk...',
  metadata: { /* ... */ },
  proof,
});

console.log('Proof valid:', isValid);
```

## 数据库 Schema

### filecoin_storage 表

存储所有 Filecoin 上传记录：

```sql
CREATE TABLE filecoin_storage (
  id VARCHAR(64) PRIMARY KEY,
  piece_cid VARCHAR(128) NOT NULL UNIQUE,
  storage_type VARCHAR(50) NOT NULL,
  user_id VARCHAR(64),
  merchant_id VARCHAR(64),
  product_id VARCHAR(64),
  order_id VARCHAR(64),
  filename VARCHAR(255) NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  size INTEGER NOT NULL,
  metadata JSON,
  description TEXT,
  storage_proof VARCHAR(64),
  uploaded_at TIMESTAMP NOT NULL DEFAULT NOW(),
  last_accessed_at TIMESTAMP,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE
);
```

### product_filecoin_storage 表

关联产品与 Filecoin 存储：

```sql
CREATE TABLE product_filecoin_storage (
  id VARCHAR(64) PRIMARY KEY,
  product_id VARCHAR(64) NOT NULL,
  image_cid VARCHAR(128),
  data_cid VARCHAR(128),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

### order_filecoin_storage 表

关联订单与账单存储：

```sql
CREATE TABLE order_filecoin_storage (
  id VARCHAR(64) PRIMARY KEY,
  order_id VARCHAR(64) NOT NULL,
  invoice_cid VARCHAR(128),
  receipt_cid VARCHAR(128),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

## 最佳实践

### 1. 数据分类

根据数据特性选择存储方案：

| 数据类型 | 推荐存储 | 原因 |
| :--- | :--- | :--- |
| 实时交易数据 | MySQL | 需要快速读写 |
| DID 文档 | Arweave | 永久存储，不可变 |
| 账单 PDF | Filecoin | 大文件，长期归档 |
| 商品图片 | Filecoin | 大文件，频繁访问 |
| KYC 文档 | Filecoin | 合规要求，可验证 |

### 2. 成本优化

- 批量上传文件以减少交易费用
- 定期清理不活跃的存储
- 使用存储证明验证数据完整性

### 3. 安全性

- 敏感数据加密后再上传
- 使用存储证明确保数据完整性
- 定期备份 CID 到多个位置

### 4. 性能优化

- 在 MySQL 中缓存常用数据
- 使用 CDN 加速 Filecoin 内容检索
- 异步上传大文件

## 故障排查

### 问题 1: 上传失败

**原因**: USDFC 余额不足

**解决方案**:
```typescript
const balance = await trpc.filecoin.getBalance.query();
if (parseFloat(balance.usdfc) < 1) {
  await trpc.filecoin.deposit.mutate({ amount: '10' });
}
```

### 问题 2: 下载超时

**原因**: Filecoin 网络延迟

**解决方案**:
- 增加超时时间
- 使用 CDN 缓存
- 实现重试机制

### 问题 3: 私钥未配置

**原因**: 环境变量未设置

**解决方案**:
```bash
# 在 .env 文件中添加
FILECOIN_PRIVATE_KEY=your_private_key
```

## 参考资源

- [Filecoin 官方文档](https://docs.filecoin.io/)
- [Synapse SDK 文档](https://docs.filecoin.cloud/)
- [fs-upload-dapp 示例](https://github.com/FIL-Builders/fs-upload-dapp)
- [Filecoin Pin 工具](https://docs.filecoin.io/builder-cookbook/filecoin-pin)

## 下一步

1. 在前端添加文件上传组件
2. 实现账单自动生成和上传
3. 集成商品图片上传到 Filecoin
4. 添加 KYC 文档上传功能
5. 实现存储使用量监控和告警
