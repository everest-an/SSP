# 🚀 SSP 项目快速部署指南

## 📋 部署前准备

### 必需信息
- ✅ EC2实例公网IP地址
- ✅ SSH密钥文件（.pem）
- ✅ AWS RDS数据库凭证（已配置）
- ✅ GitHub Token（已配置）

### 数据库信息
```
数据库类型: PostgreSQL 17.6
主机: protocol-bank-db.cfk8ciaqq2lx.ap-southeast-2.rds.amazonaws.com
端口: 5432
用户名: postgres
密码: SSP2024!Protocol#Bank
数据库名: protocolbank
```

---

## 🔧 快速部署步骤

### 第1步：SSH连接到EC2
\`\`\`bash
ssh -i your-key.pem ubuntu@<EC2_PUBLIC_IP>
\`\`\`

### 第2步：克隆最新代码
\`\`\`bash
cd /home/ubuntu
git clone https://github.com/everest-an/SSP.git
cd SSP
git pull origin main
\`\`\`

### 第3步：安装依赖
\`\`\`bash
pnpm install
\`\`\`

### 第4步：配置环境变量
\`\`\`bash
# 创建 .env 文件
cat > .env << 'ENVEOF'
DATABASE_URL="postgresql://postgres:SSP2024!Protocol#Bank@protocol-bank-db.cfk8ciaqq2lx.ap-southeast-2.rds.amazonaws.com:5432/protocolbank"
PORT=5000
NODE_ENV=production
VITE_API_URL=https://ssp.click
ENVEOF
\`\`\`

### 第5步：执行数据库迁移
\`\`\`bash
export DATABASE_URL="postgresql://postgres:SSP2024!Protocol#Bank@protocol-bank-db.cfk8ciaqq2lx.ap-southeast-2.rds.amazonaws.com:5432/protocolbank"
pnpm run db:push
\`\`\`

### 第6步：构建前端
\`\`\`bash
pnpm run build
\`\`\`

### 第7步：启动应用
\`\`\`bash
pm2 start pnpm --name "ssp" -- start
pm2 save
pm2 startup
\`\`\`

### 第8步：验证部署
\`\`\`bash
pm2 logs ssp
curl http://localhost:5000/api/health
\`\`\`

---

## ✅ 已完成的功能

- ✅ 摄像头激活和检测
- ✅ 人脸识别和账户绑定
- ✅ 实时订单创建
- ✅ WebSocket实时推送
- ✅ 用户账户系统
- ✅ 支付方式管理
- ✅ 社交登录
- ✅ MFA认证
- ✅ 数据分析
- ✅ 欺诈检测
- ✅ 国际化支持

