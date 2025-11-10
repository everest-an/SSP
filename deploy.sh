#!/bin/bash

# SSP完整部署脚本
# 用途:在AWS EC2服务器上部署SSP应用并配置Cognito OAuth

set -e  # 遇到错误立即退出

echo "========================================="
echo "SSP应用部署脚本"
echo "========================================="

# 1. 获取Cognito User Pool ID
echo ""
echo "步骤1: 获取Cognito配置信息..."
REGION="ap-southeast-2"
USER_POOL_ID=$(aws cognito-idp list-user-pools --max-results 10 --region $REGION --query "UserPools[?Name=='User pool - aua8rd'].Id" --output text 2>/dev/null || echo "")

if [ -z "$USER_POOL_ID" ]; then
    echo "⚠️  警告: 无法自动获取User Pool ID"
    echo "请手动从AWS控制台获取并在.env文件中配置"
    USER_POOL_ID="ap-southeast-2_XXXXXXXXX"
else
    echo "✅ User Pool ID: $USER_POOL_ID"
fi

# 2. 进入项目目录
echo ""
echo "步骤2: 进入项目目录..."
cd ~/SSP || cd /home/ec2-user/SSP || { echo "❌ 错误: 找不到SSP项目目录"; exit 1; }
echo "✅ 当前目录: $(pwd)"

# 3. 拉取最新代码
echo ""
echo "步骤3: 拉取GitHub最新代码..."
git pull origin main
echo "✅ 代码已更新"

# 4. 创建.env文件
echo ""
echo "步骤4: 配置环境变量..."
cat > .env << EOF
# OAuth Configuration (AWS Cognito)
VITE_OAUTH_PORTAL_URL=https://ap-southeast-2q83puda94.auth.ap-southeast-2.amazoncognito.com
VITE_APP_ID=3vdjmnldb67uu2jnuqt3uhaqth
VITE_APP_TITLE=SSP - Smart Store Payment

# Cognito Backend Configuration
COGNITO_USER_POOL_ID=$USER_POOL_ID
COGNITO_REGION=ap-southeast-2
COGNITO_DOMAIN=ap-southeast-2q83puda94.auth.ap-southeast-2.amazoncognito.com

# Database Configuration (请根据实际情况修改)
DATABASE_URL=postgresql://user:password@localhost:5432/ssp
REDIS_URL=redis://localhost:6379

# Server Configuration
PORT=3000
NODE_ENV=production

# API Keys (如果需要)
# STRIPE_SECRET_KEY=your_stripe_secret_key
# STRIPE_PUBLISHABLE_KEY=your_stripe_publishable_key
EOF

echo "✅ .env文件已创建"

# 5. 安装依赖
echo ""
echo "步骤5: 安装项目依赖..."
if command -v pnpm &> /dev/null; then
    pnpm install
elif command -v npm &> /dev/null; then
    npm install
else
    echo "❌ 错误: 未找到pnpm或npm"
    exit 1
fi
echo "✅ 依赖安装完成"

# 6. 构建项目
echo ""
echo "步骤6: 构建项目..."
if command -v pnpm &> /dev/null; then
    pnpm run build
else
    npm run build
fi
echo "✅ 项目构建完成"

# 7. 重启服务
echo ""
echo "步骤7: 重启应用服务..."

# 检测使用的进程管理器
if command -v pm2 &> /dev/null; then
    echo "使用PM2重启服务..."
    pm2 restart ssp || pm2 start ecosystem.config.js || pm2 start npm --name "ssp" -- start
    pm2 save
    echo "✅ PM2服务已重启"
elif systemctl list-units --type=service | grep -q ssp; then
    echo "使用systemd重启服务..."
    sudo systemctl restart ssp
    echo "✅ systemd服务已重启"
else
    echo "⚠️  警告: 未检测到PM2或systemd服务"
    echo "请手动启动应用"
fi

# 8. 显示部署信息
echo ""
echo "========================================="
echo "🎉 部署完成!"
echo "========================================="
echo ""
echo "📋 部署信息:"
echo "  - OAuth Portal: https://ap-southeast-2q83puda94.auth.ap-southeast-2.amazoncognito.com"
echo "  - App Client ID: 3vdjmnldb67uu2jnuqt3uhaqth"
echo "  - User Pool ID: $USER_POOL_ID"
echo "  - 回调URL: https://ssp.click/api/oauth/callback"
echo ""
echo "🧪 测试步骤:"
echo "  1. 访问 https://ssp.click"
echo "  2. 点击 'Sign In' 按钮"
echo "  3. 应该跳转到Cognito登录页面"
echo "  4. 使用邮箱注册/登录"
echo ""
echo "📝 如果User Pool ID显示为占位符,请:"
echo "  1. 登录AWS控制台"
echo "  2. 进入Cognito服务"
echo "  3. 找到'User pool - aua8rd'"
echo "  4. 复制User Pool ID"
echo "  5. 编辑.env文件更新COGNITO_USER_POOL_ID"
echo "  6. 重新运行: pnpm run build && pm2 restart ssp"
echo ""
echo "========================================="
