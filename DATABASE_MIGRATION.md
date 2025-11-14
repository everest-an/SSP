# 数据库迁移指南

本文档说明如何执行数据库schema更新和迁移。

## 前置条件

- Node.js 18+
- pnpm 包管理器
- PostgreSQL 数据库
- Drizzle ORM 配置

## 迁移步骤

### 1. 生成迁移文件

```bash
# 根据schema变化生成迁移文件
pnpm db:generate

# 输出示例：
# ✓ Generated migration: drizzle/migrations/0001_initial.sql
```

### 2. 执行迁移

```bash
# 应用迁移到数据库
pnpm db:migrate

# 输出示例：
# ✓ Migrations applied successfully
```

### 3. 验证迁移

```bash
# 检查数据库状态
pnpm db:check

# 或者使用Drizzle Studio查看
pnpm db:studio
```

---

## 新增的表和字段

### 1. faceEmbeddings 表

存储用户的人脸特征向量。

```sql
CREATE TABLE face_embeddings (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  embedding FLOAT8[] NOT NULL,  -- 128维向量
  confidence FLOAT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_face_embeddings_user_id ON face_embeddings(user_id);
```

### 2. payment_methods 表

存储用户的支付方式。

```sql
CREATE TABLE payment_methods (
  id UUID PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  type VARCHAR(50) NOT NULL,  -- credit_card, debit_card, digital_wallet, bank_transfer
  name VARCHAR(255),
  card_last4 VARCHAR(4),
  card_brand VARCHAR(50),
  card_expiry VARCHAR(5),
  wallet_address VARCHAR(255),
  wallet_type VARCHAR(50),
  bank_name VARCHAR(255),
  account_last4 VARCHAR(4),
  is_default BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_payment_methods_user_id ON payment_methods(user_id);
```

### 3. fraud_alerts 表

存储欺诈告警记录。

```sql
CREATE TABLE fraud_alerts (
  id VARCHAR(21) PRIMARY KEY,  -- nanoid
  order_id INTEGER NOT NULL REFERENCES orders(id),
  user_id INTEGER REFERENCES users(id),
  risk_level VARCHAR(20) NOT NULL,  -- low, medium, high, critical
  risk_score INTEGER NOT NULL,
  reasons JSONB NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',  -- pending, reviewed, confirmed, dismissed
  reviewed_at TIMESTAMP,
  reviewed_by VARCHAR(255),
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_fraud_alerts_order_id ON fraud_alerts(order_id);
CREATE INDEX idx_fraud_alerts_user_id ON fraud_alerts(user_id);
CREATE INDEX idx_fraud_alerts_status ON fraud_alerts(status);
```

### 4. 扩展现有表

#### users 表

```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(50) DEFAULT 'customer';
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_blocked BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS blocked_reason TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS login_count INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS language VARCHAR(10) DEFAULT 'en';
ALTER TABLE users ADD COLUMN IF NOT EXISTS currency VARCHAR(10) DEFAULT 'USD';
```

#### orders 表

```sql
ALTER TABLE orders ADD COLUMN IF NOT EXISTS device_id INTEGER REFERENCES devices(id);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_method_id UUID REFERENCES payment_methods(id);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS face_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS risk_score INTEGER DEFAULT 0;
```

---

## 迁移脚本

### 生成迁移

```bash
#!/bin/bash
# scripts/migrate.sh

set -e

echo "🔄 生成迁移文件..."
pnpm db:generate

echo "✅ 迁移文件已生成"
echo "📝 请检查 drizzle/migrations 目录中的新文件"
```

### 应用迁移

```bash
#!/bin/bash
# scripts/apply-migration.sh

set -e

echo "🔄 应用迁移..."
pnpm db:migrate

echo "✅ 迁移已应用"
echo "🔍 验证数据库..."
pnpm db:check

echo "✅ 数据库验证成功"
```

### 回滚迁移

```bash
#!/bin/bash
# scripts/rollback-migration.sh

set -e

echo "⚠️  回滚迁移..."
# Drizzle ORM 不直接支持回滚，需要手动执行回滚SQL
# 或者恢复数据库备份

echo "❌ 迁移已回滚"
```

---

## 数据迁移

### 迁移现有数据

如果现有表中有数据，需要进行数据迁移。

```sql
-- 示例：将用户数据迁移到新的语言/货币字段
UPDATE users 
SET language = 'en', currency = 'USD'
WHERE language IS NULL;
```

### 数据验证

```sql
-- 验证迁移后的数据
SELECT COUNT(*) FROM face_embeddings;
SELECT COUNT(*) FROM payment_methods;
SELECT COUNT(*) FROM fraud_alerts;

-- 检查数据完整性
SELECT * FROM users WHERE language IS NULL;
```

---

## 常见问题

### Q: 如何检查迁移状态？
A: 使用以下命令：
```bash
pnpm db:check
```

### Q: 如何查看数据库结构？
A: 使用Drizzle Studio：
```bash
pnpm db:studio
```

### Q: 如何回滚迁移？
A: 如果迁移出现问题，可以：
1. 恢复数据库备份
2. 或者手动执行回滚SQL脚本

### Q: 如何在生产环境中安全地迁移？
A: 建议步骤：
1. 备份生产数据库
2. 在测试环境中测试迁移
3. 在低流量时段执行迁移
4. 监控迁移过程
5. 验证数据完整性

---

## 性能考虑

### 大表迁移

如果表中有大量数据，迁移可能需要较长时间：

```sql
-- 分批迁移数据
UPDATE users 
SET language = 'en'
WHERE id IN (
  SELECT id FROM users 
  WHERE language IS NULL 
  LIMIT 10000
);
```

### 索引优化

迁移后创建必要的索引以提高查询性能：

```sql
CREATE INDEX idx_users_language ON users(language);
CREATE INDEX idx_users_currency ON users(currency);
CREATE INDEX idx_orders_device_id ON orders(device_id);
CREATE INDEX idx_orders_payment_method_id ON orders(payment_method_id);
```

---

## 监控和日志

### 启用迁移日志

```bash
# 设置环境变量以启用详细日志
export DEBUG=drizzle:*
pnpm db:migrate
```

### 检查迁移历史

```sql
-- 查看已应用的迁移
SELECT * FROM _drizzle_migrations;
```

---

## 回滚计划

如果迁移失败，可以按以下步骤回滚：

1. **停止应用** - 立即停止应用服务
2. **恢复备份** - 恢复最近的数据库备份
3. **验证数据** - 确保数据完整性
4. **重启应用** - 重新启动应用服务
5. **分析问题** - 调查迁移失败的原因
6. **修复并重试** - 修复问题后重新执行迁移

---

## 检查清单

- [ ] 备份生产数据库
- [ ] 在测试环境中测试迁移
- [ ] 生成迁移文件
- [ ] 审查迁移SQL
- [ ] 执行迁移
- [ ] 验证数据完整性
- [ ] 检查应用日志
- [ ] 监控性能指标
- [ ] 更新文档
- [ ] 通知团队
