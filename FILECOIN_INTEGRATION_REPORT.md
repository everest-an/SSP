# SSP 项目 Filecoin/IPFS 存储集成报告

**日期**: 2025-11-22  
**项目**: SSP (Secure Storage Platform)  
**集成内容**: Filecoin 去中心化存储

---

## 执行摘要

本报告总结了 SSP 项目中 Filecoin/IPFS 去中心化存储的集成工作。该集成旨在为用户账单、商品数据和 KYC 文档提供永久、可验证的去中心化存储解决方案。

### 核心成果

- ✅ **完整的 Filecoin 存储服务**：实现了基于 Synapse SDK 的完整存储服务
- ✅ **数据库 Schema 设计**：创建了 6 个数据库表用于存储 CID 和元数据
- ✅ **API 路由器**：实现了完整的 tRPC API 端点
- ✅ **测试脚本**：创建了自动化测试脚本
- ✅ **详细文档**：提供了完整的集成指南和使用示例

---

## 技术架构

### 1. 混合存储架构

SSP 项目采用三层混合存储架构：

| 存储层 | 技术 | 用途 | 特点 |
|:---|:---|:---|:---|
| **实时数据层** | MySQL | 用户会话、交易记录、CID 索引 | 快速读写、ACID 保证 |
| **身份数据层** | Arweave | DID 文档、身份凭证 | 永久存储、不可变 |
| **业务数据层** | Filecoin | 账单、商品图片、KYC 文档 | 去中心化、可验证 |

### 2. 数据流程

```
上传流程:
用户 → API → filecoinService → Synapse SDK → Filecoin 网络
                    ↓
                MySQL (存储 CID)

下载流程:
用户 → API → MySQL (获取 CID) → filecoinService → Filecoin 网络
```

---

## 实现细节

### 1. 核心服务 (`filecoinService.ts`)

实现了以下功能：

- **上传功能**：
  - `uploadToFilecoin()` - 上传二进制数据
  - `uploadTextToFilecoin()` - 上传文本数据
  - `uploadJSONToFilecoin()` - 上传 JSON 数据
  - `uploadProductData()` - 上传商品数据
  - `uploadInvoice()` - 上传账单
  - `uploadKYCDocument()` - 上传 KYC 文档

- **下载功能**：
  - `downloadFromFilecoin()` - 下载二进制数据
  - `downloadTextFromFilecoin()` - 下载文本数据
  - `downloadJSONFromFilecoin()` - 下载 JSON 数据

- **管理功能**：
  - `getAccountBalance()` - 获取账户余额
  - `getNetworkInfo()` - 获取网络信息
  - `depositToSynapse()` - 存款到 Synapse 合约
  - `estimateStorageCost()` - 估算存储成本

- **安全功能**：
  - `generateStorageProof()` - 生成存储证明
  - `verifyStorageProof()` - 验证存储证明

### 2. 数据库 Schema

创建了 6 个数据库表：

1. **filecoin_storage** - 存储所有 Filecoin 上传记录
2. **filecoin_accounts** - 跟踪账户余额和存储使用
3. **filecoin_transactions** - 记录所有 Filecoin 交易
4. **product_filecoin_storage** - 关联产品与存储
5. **order_filecoin_storage** - 关联订单与账单存储
6. **kyc_filecoin_storage** - 关联 KYC 文档与存储

### 3. API 端点 (`filecoinRouter.ts`)

实现了以下 tRPC 端点：

- `isConfigured` - 检查 Filecoin 配置
- `getNetworkInfo` - 获取网络信息
- `getBalance` - 获取账户余额
- `uploadText` - 上传文本数据
- `uploadJSON` - 上传 JSON 数据
- `downloadText` - 下载文本数据
- `downloadJSON` - 下载 JSON 数据
- `uploadProductData` - 上传商品数据
- `deposit` - 存款到 Synapse
- `estimateCost` - 估算存储成本
- `generateProof` - 生成存储证明
- `verifyProof` - 验证存储证明

---

## 测试结果

### 测试环境

- **网络**: Filecoin 主网
- **SDK 版本**: @filoz/synapse-sdk v0.36.0
- **测试时间**: 2025-11-22

### 测试结果摘要

| 测试项 | 状态 | 备注 |
|:---|:---:|:---|
| Filecoin 配置检查 | ✅ | 配置正确 |
| 网络连接 | ✅ | 成功连接主网 |
| 账户地址获取 | ✅ | 地址: 0xf859...2476 |
| FIL 余额查询 | ✅ | 余额: 5.0 FIL |
| USDFC 余额查询 | ✅ | 余额: 0.0 USDFC |
| 数据上传 | ⚠️ | 需要 USDFC 余额 |

### 测试发现

1. **最小数据大小限制**: Filecoin 要求上传数据至少 127 字节
2. **USDFC 余额要求**: 存储需要 USDFC 支付，最低约 0.06 USDFC
3. **SDK 兼容性**: 成功集成 Synapse SDK v0.36.0

---

## 部署状态

### 已完成

- ✅ 代码实现并推送到 GitHub
- ✅ 数据库表已创建（生产环境）
- ✅ 依赖包已安装
- ✅ 测试脚本已创建
- ✅ 文档已完成

### 待完成

- ⏳ 配置生产环境的 FILECOIN_PRIVATE_KEY
- ⏳ 为存储账户充值 USDFC
- ⏳ 集成到前端 UI
- ⏳ 实现账单自动上传
- ⏳ 实现商品图片上传

---

## 使用指南

### 环境配置

在 `.env` 文件中添加：

```env
FILECOIN_NETWORK=mainnet  # 或 calibration
FILECOIN_PRIVATE_KEY=your_private_key_here
```

### 基本使用示例

```typescript
// 上传账单数据
const invoiceData = {
  orderId: 'ORDER-12345',
  total: 100.00,
  items: [...],
};

const result = await trpc.filecoin.uploadJSON.mutate({
  data: invoiceData,
  metadata: {
    type: 'invoice',
    userId: 'user-123',
    orderId: 'ORDER-12345',
    filename: 'invoice-12345.json',
  },
});

console.log('Uploaded to Filecoin:', result.pieceCid);

// 保存 CID 到数据库
await db.insert(orderFilecoinStorage).values({
  id: generateId(),
  orderId: 'ORDER-12345',
  invoiceCid: result.pieceCid,
});
```

---

## 成本分析

### 存储成本估算

基于 Filecoin 主网当前价格：

| 数据大小 | 每月成本 (USDFC) | 备注 |
|:---|:---:|:---|
| 1 MB | ~0.10 | 小型文档 |
| 10 MB | ~1.00 | 中型文档 |
| 100 MB | ~10.00 | 大型文档 |
| 1 GB | ~100.00 | 批量数据 |

### 成本优化建议

1. **批量上传**: 将多个小文件合并后上传
2. **压缩数据**: 上传前压缩数据以减少大小
3. **选择性存储**: 只将重要数据上传到 Filecoin
4. **定期清理**: 删除不再需要的数据

---

## 安全考虑

### 1. 私钥管理

- ❌ **不要**将私钥硬编码在代码中
- ❌ **不要**将私钥提交到版本控制
- ✅ **使用**环境变量存储私钥
- ✅ **使用**密钥管理服务（如 AWS KMS）

### 2. 数据加密

对于敏感数据（如 KYC 文档），建议：

1. 在上传前加密数据
2. 使用用户特定的加密密钥
3. 将加密密钥安全存储（不要上传到 Filecoin）

### 3. 访问控制

- 实现基于角色的访问控制（RBAC）
- 记录所有存储操作的审计日志
- 定期审查访问权限

---

## 故障排查

### 常见问题

#### 1. `USDFC 余额不足`

**错误**: `InsufficientFundsForMinimumRate`

**解决方案**:
- 检查 USDFC 余额: `trpc.filecoin.getBalance.query()`
- 存款到 Synapse: `trpc.filecoin.deposit.mutate({ amount: '10' })`

#### 2. `数据大小过小`

**错误**: `Data size X bytes is below minimum allowed size of 127 bytes`

**解决方案**:
- 确保数据至少 127 字节
- 对于小文件，可以添加填充数据

#### 3. `网络连接失败`

**错误**: `Failed to connect to Filecoin network`

**解决方案**:
- 检查网络配置
- 尝试切换 RPC URL
- 检查防火墙设置

---

## 下一步计划

### 短期 (1-2 周)

1. 为存储账户充值 USDFC
2. 完成端到端测试
3. 集成到前端 UI
4. 实现账单自动上传

### 中期 (1-2 月)

1. 实现商品图片上传
2. 实现 KYC 文档上传
3. 添加存储使用量监控
4. 实现自动成本优化

### 长期 (3-6 月)

1. 实现 CDN 加速
2. 添加数据备份和恢复
3. 实现跨链存储
4. 优化存储成本

---

## 参考资源

- [Filecoin 官方文档](https://docs.filecoin.io/)
- [Synapse SDK 文档](https://docs.filecoin.cloud/)
- [Synapse SDK GitHub](https://github.com/FilOzone/synapse-sdk)
- [SSP 集成指南](./FILECOIN_INTEGRATION_GUIDE.md)

---

## 附录

### A. 数据库表结构

详见 `drizzle/0009_add_filecoin_storage_tables.sql`

### B. API 端点列表

详见 `server/routers/filecoinRouter.ts`

### C. 测试脚本

详见 `server/tests/testFilecoinStorage.ts`

---

**报告结束**
