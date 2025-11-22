# 数据库问题修复指南

## 问题描述

在生产环境测试中发现，商户创建功能失败，错误信息显示数据库插入操作失败。经过分析，问题的根本原因是：

**数据库表结构与代码 Schema 定义不一致**

具体来说：
- 代码中的 `merchants` 表 Schema 包含 `kycVerified` 和 `kycVerifiedAt` 字段
- 但这些字段的数据库迁移文件从未创建
- 导致生产数据库中的 `merchants` 表缺少这两个字段
- 当 Drizzle ORM 尝试插入数据时，SQL 语句包含了不存在的列名，导致执行失败

## 错误信息

```
[API Mutation Error] TRPCClientError: Failed query: 
insert into `merchants` (`id`, `userId`, `businessName`, `businessType`, `address`, 
`phone`, `email`, `walletAddress`, `kycVerified`, `kycVerifiedAt`, `status`, 
`createdAt`, `updatedAt`) values (default, ?, ?, ?, ?, ?, ?, default, default, 
default, default, default, default)
```

## 修复方案

### 方案 1：执行数据库迁移（推荐）

这是最彻底的解决方案，确保数据库表结构与代码完全一致。

#### 步骤 1：确保所有迁移文件已创建

已创建的新迁移文件：
- `drizzle/0008_add_kyc_fields_to_merchants.sql` - 添加 KYC 验证字段

#### 步骤 2：在生产数据库上执行迁移

**选项 A：使用提供的迁移脚本（推荐）**

```bash
# 设置数据库连接 URL
export DATABASE_URL="mysql://user:password@host:port/database"

# 运行迁移脚本
./scripts/run-migrations.sh
```

**选项 B：手动执行迁移**

```bash
# 连接到生产数据库
mysql -h your-host -u your-user -p your-database

# 执行以下迁移（按顺序）：

# 1. 添加 walletAddress 字段（如果尚未执行）
source drizzle/0007_add_merchant_wallet_address.sql;

# 2. 添加 KYC 字段
source drizzle/0008_add_kyc_fields_to_merchants.sql;
```

#### 步骤 3：验证表结构

```sql
-- 查看 merchants 表结构
DESCRIBE merchants;

-- 应该看到以下字段：
-- id, userId, businessName, businessType, address, phone, email, 
-- walletAddress, kycVerified, kycVerifiedAt, status, createdAt, updatedAt
```

#### 步骤 4：测试商户创建功能

访问 https://ssp.click/merchants/create 并尝试创建商户，应该可以成功。

### 方案 2：临时代码修复（不推荐）

如果无法立即访问生产数据库执行迁移，可以临时修改代码以兼容旧表结构。

#### 修改 `server/db.ts` 中的 `createMerchant` 函数

```typescript
export async function createMerchant(merchant: InsertMerchant): Promise<Merchant> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // 移除可能不存在的字段
  const { kycVerified, kycVerifiedAt, walletAddress, ...merchantData } = merchant;
  
  const result = await db.insert(merchants).values(merchantData);
  const insertedId = Number(result[0].insertId);
  
  const created = await db.select().from(merchants).where(eq(merchants.id, insertedId)).limit(1);
  return created[0];
}
```

**注意**：这只是临时解决方案，最终仍需执行数据库迁移。

## 迁移文件详情

### 0007_add_merchant_wallet_address.sql

```sql
ALTER TABLE `merchants` 
ADD COLUMN `walletAddress` VARCHAR(42) NULL COMMENT 'Ethereum wallet address for receiving crypto payments' AFTER `email`,
ADD INDEX `idx_wallet_address` (`walletAddress`);
```

### 0008_add_kyc_fields_to_merchants.sql（新增）

```sql
ALTER TABLE `merchants` 
ADD COLUMN `kycVerified` BOOLEAN NOT NULL DEFAULT FALSE COMMENT 'Whether KYC verification is completed' AFTER `walletAddress`,
ADD COLUMN `kycVerifiedAt` TIMESTAMP NULL COMMENT 'When KYC was verified' AFTER `kycVerified`;

ALTER TABLE `merchants` 
ADD INDEX `idx_kyc_verified` (`kycVerified`, `kycVerifiedAt`);
```

## 验证修复

### 1. 检查数据库表结构

```sql
SHOW CREATE TABLE merchants;
```

应该包含所有必需的字段。

### 2. 测试商户创建 API

```bash
curl -X POST https://ssp.click/api/trpc/merchant.create \
  -H "Content-Type: application/json" \
  -H "Cookie: your-session-cookie" \
  -d '{
    "businessName": "Test Store",
    "businessType": "convenience",
    "address": "123 Main St",
    "email": "test@example.com"
  }'
```

应该返回成功响应。

### 3. 通过 Web 界面测试

1. 访问 https://ssp.click
2. 登录账户
3. 访问 Dashboard
4. 点击 "Create Merchant Account"
5. 填写表单并提交
6. 应该成功创建商户

## 预防未来问题

### 1. 确保 Schema 更改同步

每次修改 `drizzle/schema.ts` 时，都应该：
1. 生成相应的迁移文件
2. 在开发环境测试迁移
3. 在生产环境执行迁移

### 2. 使用 Drizzle Kit 生成迁移

```bash
# 安装 drizzle-kit
npm install -D drizzle-kit

# 生成迁移
npx drizzle-kit generate:mysql

# 推送到数据库
npx drizzle-kit push:mysql
```

### 3. 设置 CI/CD 检查

在 CI/CD 流程中添加检查：
- 验证 Schema 定义与迁移文件一致
- 在部署前自动运行迁移
- 测试数据库操作

## 联系支持

如果在执行迁移时遇到问题，请：
1. 检查数据库连接配置
2. 确认数据库用户有 ALTER TABLE 权限
3. 备份数据库后再执行迁移
4. 查看详细的错误日志

## 修复时间线

- **2025-11-22**: 发现问题并创建修复方案
- **待定**: 在生产环境执行迁移
- **待定**: 验证修复并关闭问题

---

**作者**: Manus AI Agent  
**日期**: 2025-11-22  
**版本**: 1.0
