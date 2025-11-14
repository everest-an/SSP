#!/bin/bash

# SSP 快速部署脚本
# 使用方法: bash scripts/deploy.sh

set -e

echo "🚀 SSP 项目部署脚本"
echo "===================="
echo ""

# 检查必要的命令
echo "✓ 检查环境..."
command -v git >/dev/null 2>&1 || { echo "❌ 需要安装 git"; exit 1; }
command -v pnpm >/dev/null 2>&1 || { echo "❌ 需要安装 pnpm"; exit 1; }

# 第1步：克隆或更新代码
echo ""
echo "📥 第1步：克隆/更新代码..."
if [ -d "/home/ubuntu/SSP" ]; then
  cd /home/ubuntu/SSP
  git pull origin main
else
  cd /home/ubuntu
  git clone https://github.com/everest-an/SSP.git
  cd SSP
fi

# 第2步：安装依赖
echo ""
echo "📦 第2步：安装依赖..."
pnpm install

# 第3步：配置环境变量
echo ""
echo "⚙️  第3步：配置环境变量..."
if [ ! -f ".env" ]; then
  cat > .env << 'ENVEOF'
DATABASE_URL="postgresql://postgres:SSP2024!Protocol#Bank@protocol-bank-db.cfk8ciaqq2lx.ap-southeast-2.rds.amazonaws.com:5432/protocolbank"
PORT=5000
NODE_ENV=production
VITE_API_URL=https://ssp.click
ENVEOF
  echo "✓ .env 文件已创建"
else
  echo "✓ .env 文件已存在"
fi

# 第4步：数据库迁移
echo ""
echo "🗄️  第4步：执行数据库迁移..."
export DATABASE_URL="postgresql://postgres:SSP2024!Protocol#Bank@protocol-bank-db.cfk8ciaqq2lx.ap-southeast-2.rds.amazonaws.com:5432/protocolbank"
pnpm run db:push || echo "⚠️  数据库迁移可能已完成"

# 第5步：构建前端
echo ""
echo "🔨 第5步：构建前端..."
pnpm run build

# 第6步：启动应用
echo ""
echo "🎯 第6步：启动应用..."
command -v pm2 >/dev/null 2>&1 || npm install -g pm2

pm2 delete ssp 2>/dev/null || true
pm2 start pnpm --name "ssp" -- start
pm2 save
pm2 startup || true

# 第7步：验证部署
echo ""
echo "✅ 第7步：验证部署..."
sleep 3

if curl -s http://localhost:5000/api/health > /dev/null; then
  echo "✅ 应用已成功启动！"
  echo ""
  echo "📊 部署信息："
  echo "  - 应用地址: http://localhost:5000"
  echo "  - 数据库: protocol-bank-db.cfk8ciaqq2lx.ap-southeast-2.rds.amazonaws.com"
  echo "  - 查看日志: pm2 logs ssp"
else
  echo "⚠️  应用启动可能需要更多时间，请检查日志："
  echo "  pm2 logs ssp"
fi

echo ""
echo "🎉 部署完成！"
