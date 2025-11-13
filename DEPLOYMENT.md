# SSP 项目部署架构文档

## 🏗️ 部署架构总览

**重要：SSP 项目部署在 AWS EC2，不是 Vercel！**

```
┌─────────────────────────────────────────────────────────────┐
│                        SSP 架构图                            │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  用户访问                                                     │
│     ↓                                                        │
│  ssp.click (域名)                                            │
│     ↓                                                        │
│  AWS EC2 实例 (ap-southeast-2)                               │
│  ├── 前端: React + Vite                                      │
│  ├── 后端: Node.js + Express                                 │
│  └── 端口: 5000                                              │
│     ↓                                                        │
│  AWS RDS PostgreSQL                                          │
│  ├── 实例: protocol-bank-db                                  │
│  ├── 引擎: PostgreSQL 17.6                                   │
│  ├── 类型: db.t3.micro                                       │
│  ├── 端点: protocol-bank-db.cfk8ciaqq2lx...                 │
│  └── 数据库: protocolbank                                    │
│     ↓                                                        │
│  AWS Cognito (认证)                                          │
│  └── User Pool: ap-southeast-2_q83pUDA94                    │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 📍 AWS 资源清单

### EC2 实例
- **区域**: ap-southeast-2 (Sydney)
- **实例类型**: 待确认
- **公网 IP**: 待确认
- **域名**: ssp.click
- **应用端口**: 5000

### RDS 数据库
- **DB Identifier**: protocol-bank-db
- **引擎**: PostgreSQL 17.6
- **实例类型**: db.t3.micro (1 vCPU, 1 GB RAM)
- **端点**: protocol-bank-db.cfk8ciaqq2lx.ap-southeast-2.rds.amazonaws.com
- **端口**: 5432
- **数据库名**: protocolbank
- **用户名**: postgres
- **密码**: SSP2024!Protocol#Bank
- **Multi-AZ**: 否（单点故障风险）
- **状态**: Available

### Cognito 用户池
- **User Pool ID**: ap-southeast-2_q83pUDA94
- **User Pool Name**: User pool - aua8rd
- **区域**: ap-southeast-2
- **OAuth Domain**: ap-southeast-2q83puda94.auth.ap-southeast-2.amazoncognito.com
- **认证方式**: OAuth 2.0

### VPC 和安全组
- **RDS 安全组**: ProtocolBank-RDS-SG
- **访问限制**: 仅允许 VPC 内部访问

---

## 🔐 环境变量配置

### 数据库连接
```bash
DATABASE_URL=postgresql://postgres:SSP2024!Protocol#Bank@protocol-bank-db.cfk8ciaqq2lx.ap-southeast-2.rds.amazonaws.com:5432/protocolbank
```

### Cognito 配置
```bash
VITE_COGNITO_USER_POOL_ID=ap-southeast-2_q83pUDA94
VITE_COGNITO_CLIENT_ID=<待确认>
VITE_COGNITO_DOMAIN=ap-southeast-2q83puda94.auth.ap-southeast-2.amazoncognito.com
```

### Stripe 配置
```bash
STRIPE_SECRET_KEY=<待确认>
STRIPE_PUBLISHABLE_KEY=<待确认>
STRIPE_WEBHOOK_SECRET=<待确认>
```

### 其他配置
```bash
PORT=5000
NODE_ENV=production
CORS_ORIGIN=https://ssp.click
JWT_SECRET=<待确认>
SESSION_SECRET=<待确认>
```

---

## 🚀 部署流程

### 1. 代码推送到 GitHub
```bash
git add .
git commit -m "feat: your feature"
git push origin main
```

### 2. SSH 登录到 EC2 实例
```bash
ssh -i <your-key.pem> ubuntu@<ec2-public-ip>
```

### 3. 拉取最新代码
```bash
cd /path/to/SSP
git pull origin main
```

### 4. 安装依赖
```bash
pnpm install
```

### 5. 执行数据库迁移
```bash
pnpm run db:push
```

### 6. 构建前端
```bash
pnpm run build
```

### 7. 重启应用
```bash
pm2 restart ssp
# 或
systemctl restart ssp
```

---

## 🗄️ 数据库迁移

### 手动执行迁移

#### 方法 1: 在 EC2 实例上执行
```bash
# SSH 登录到 EC2
ssh -i <your-key.pem> ubuntu@<ec2-public-ip>

# 进入项目目录
cd /path/to/SSP

# 执行迁移
export DATABASE_URL='postgresql://postgres:SSP2024!Protocol#Bank@protocol-bank-db.cfk8ciaqq2lx.ap-southeast-2.rds.amazonaws.com:5432/protocolbank'
pnpm run db:push
```

#### 方法 2: 使用 psql 直接连接
```bash
# 在 EC2 实例上
psql "postgresql://postgres:SSP2024!Protocol#Bank@protocol-bank-db.cfk8ciaqq2lx.ap-southeast-2.rds.amazonaws.com:5432/protocolbank"

# 执行 SQL
\i migrations/add_wallet_address.sql
```

#### 方法 3: 使用迁移脚本
```bash
# 在项目根目录
node migrations/add_wallet_address.sql
```

### 当前待执行的迁移
```sql
-- 添加商户钱包地址字段
ALTER TABLE merchants 
ADD COLUMN IF NOT EXISTS "walletAddress" VARCHAR(255);
```

---

## 🔧 故障排查

### 数据库连接失败
1. 检查安全组配置（ProtocolBank-RDS-SG）
2. 确认 EC2 实例在正确的 VPC 中
3. 验证数据库凭证是否正确

### 应用无法访问
1. 检查 EC2 实例状态
2. 检查安全组入站规则（端口 80/443）
3. 检查 nginx/apache 配置

### Cognito 登录失败
1. 检查用户状态（Confirmed/Unconfirmed）
2. 检查 OAuth 回调 URL 配置
3. 检查邮件发送配置（SES）

---

## 📊 监控和日志

### 应用日志
```bash
# PM2 日志
pm2 logs ssp

# 系统日志
journalctl -u ssp -f
```

### 数据库日志
- AWS RDS Console → Logs & events

### Cognito 日志
- AWS Cognito Console → User pool → Monitoring

---

## 🔄 自动化部署（待实现）

### 使用 GitHub Actions
```yaml
# .github/workflows/deploy.yml
name: Deploy to AWS EC2

on:
  push:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      
      - name: Deploy to EC2
        uses: appleboy/ssh-action@master
        with:
          host: ${{ secrets.EC2_HOST }}
          username: ubuntu
          key: ${{ secrets.EC2_SSH_KEY }}
          script: |
            cd /path/to/SSP
            git pull origin main
            pnpm install
            pnpm run db:push
            pnpm run build
            pm2 restart ssp
```

---

## 📝 重要提醒

1. **不要使用 Vercel 部署配置** - 项目部署在 AWS EC2
2. **数据库迁移必须在 EC2 实例上执行** - 因为安全组限制
3. **环境变量配置在 EC2 的 .env 文件中** - 不在 Vercel
4. **域名 ssp.click 指向 EC2 公网 IP** - 不是 Vercel

---

## 🎯 下一步优化

### 短期（1-2 周）
- [ ] 配置自动化部署（GitHub Actions）
- [ ] 添加 SSL 证书（Let's Encrypt）
- [ ] 配置 nginx 反向代理
- [ ] 实现健康检查

### 中期（1-2 月）
- [ ] 升级 RDS 实例（db.r6g.large）
- [ ] 启用 Multi-AZ 部署
- [ ] 添加 Redis 缓存层
- [ ] 配置 CloudWatch 监控

### 长期（3-6 月）
- [ ] 实现 Auto Scaling
- [ ] 添加 Load Balancer
- [ ] 配置 CDN（CloudFront）
- [ ] 实现蓝绿部署

---

## 📞 联系信息

- **AWS 账户**: everest9812@gmail.com
- **GitHub 仓库**: https://github.com/everest-an/SSP
- **域名**: ssp.click

---

## 🏢 企业级架构优化方案

### 当前架构评估

**现状**:
- 单点 EC2 实例 (ap-southeast-2)
- PostgreSQL 单主机 (db.t3.micro)
- 无缓存层
- 无消息队列
- 无 CDN

**瓶颈**:
- 数据库容量: ~1000 TPS
- 应用容量: ~5000 并发
- 无故障转移能力
- 无自动扩展

### 推荐升级方案

#### Phase 1: 高可用性 (1-2周)
1. **RDS Multi-AZ** - 启用自动故障转移
2. **Application Load Balancer** - 分散流量
3. **Auto Scaling Group** - 自动扩展 EC2 实例
4. **CloudWatch 监控** - 实时告警

#### Phase 2: 性能优化 (2-3周)
1. **ElastiCache Redis** - 缓存热数据
2. **SQS 消息队列** - 异步任务处理
3. **CloudFront CDN** - 静态资源加速
4. **数据库读写分离** - 提升查询性能

#### Phase 3: 扩展性 (3-4周)
1. **ECS Fargate** - 容器化部署
2. **数据库分片** - 水平扩展
3. **微服务架构** - 业务拆分
4. **多区域部署** - 全球可用性

### 成本估算

| 服务 | 当前 | 升级后 | 月度成本 |
|------|------|--------|----------|
| EC2 | t3.micro | t3.large x 3 | $150 |
| RDS | db.t3.micro | db.r6i.large | $400 |
| ElastiCache | 无 | cache.r6g.large | $200 |
| ALB | 无 | 1个 | $100 |
| CloudFront | 无 | 100GB | $100 |
| **总计** | ~$50 | | **~$950** |

### 详细架构文档

请参考 `ENTERPRISE_ARCHITECTURE.md` 获取完整的企业级架构设计和实现指南。

---

**最后更新**: 2025-11-13  
**维护者**: Manus AI Agent
