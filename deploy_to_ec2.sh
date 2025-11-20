#!/bin/bash

# SSP 项目部署脚本
# 在 EC2 实例上执行此脚本以部署最新代码

set -e  # 遇到错误立即退出

echo "=========================================="
echo "SSP 项目部署脚本"
echo "=========================================="
echo ""

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 检测项目目录
if [ -d "/home/ec2-user/SSP" ]; then
    PROJECT_DIR="/home/ec2-user/SSP"
elif [ -d "$HOME/SSP" ]; then
    PROJECT_DIR="$HOME/SSP"
else
    echo -e "${RED}错误: 找不到 SSP 项目目录${NC}"
    exit 1
fi

echo -e "${YELLOW}项目目录: $PROJECT_DIR${NC}"
cd "$PROJECT_DIR"

# 1. 拉取最新代码
echo ""
echo -e "${YELLOW}[1/6] 拉取最新代码...${NC}"
git fetch origin
CURRENT_COMMIT=$(git rev-parse HEAD)
LATEST_COMMIT=$(git rev-parse origin/main)

if [ "$CURRENT_COMMIT" = "$LATEST_COMMIT" ]; then
    echo -e "${GREEN}✓ 代码已是最新版本${NC}"
else
    echo -e "${YELLOW}发现新提交，正在拉取...${NC}"
    git pull origin main
    echo -e "${GREEN}✓ 代码更新完成${NC}"
    echo "  旧版本: ${CURRENT_COMMIT:0:7}"
    echo "  新版本: ${LATEST_COMMIT:0:7}"
fi

# 2. 设置环境变量
echo ""
echo -e "${YELLOW}[2/6] 设置环境变量...${NC}"
export VITE_OAUTH_PORTAL_URL="https://ap-southeast-2q83puda94.auth.ap-southeast-2.amazoncognito.com"
export VITE_APP_ID="3vdjmnldb67uu2jnuqt3uhaqth"
export VITE_APP_TITLE="SSP - Smart Store Payment"
echo -e "${GREEN}✓ 环境变量已设置${NC}"

# 3. 安装依赖
echo ""
echo -e "${YELLOW}[3/6] 安装依赖包...${NC}"
if command -v pnpm &> /dev/null; then
    pnpm install --frozen-lockfile || pnpm install
    echo -e "${GREEN}✓ 依赖安装完成 (pnpm)${NC}"
elif command -v npm &> /dev/null; then
    npm install
    echo -e "${GREEN}✓ 依赖安装完成 (npm)${NC}"
else
    echo -e "${RED}错误: 找不到 pnpm 或 npm${NC}"
    exit 1
fi

# 4. 构建项目
echo ""
echo -e "${YELLOW}[4/6] 构建项目...${NC}"
if command -v pnpm &> /dev/null; then
    pnpm run build
else
    npm run build
fi
echo -e "${GREEN}✓ 项目构建完成${NC}"

# 5. 重启服务
echo ""
echo -e "${YELLOW}[5/6] 重启服务...${NC}"
if command -v pm2 &> /dev/null; then
    # 检查 pm2 中是否已有 ssp 进程
    if pm2 list | grep -q "ssp"; then
        pm2 restart ssp
        echo -e "${GREEN}✓ 服务已重启 (pm2 restart)${NC}"
    else
        pm2 start npm --name ssp -- start
        echo -e "${GREEN}✓ 服务已启动 (pm2 start)${NC}"
    fi
    
    # 保存 pm2 配置
    pm2 save
    echo -e "${GREEN}✓ PM2 配置已保存${NC}"
else
    echo -e "${YELLOW}警告: 找不到 pm2，尝试直接启动...${NC}"
    if command -v pnpm &> /dev/null; then
        pnpm start &
    else
        npm start &
    fi
    echo -e "${GREEN}✓ 服务已启动 (后台运行)${NC}"
fi

# 6. 验证部署
echo ""
echo -e "${YELLOW}[6/6] 验证部署...${NC}"
sleep 3

if command -v pm2 &> /dev/null; then
    echo ""
    echo "PM2 进程状态:"
    pm2 list
fi

echo ""
echo -e "${GREEN}=========================================="
echo "✓ 部署完成！"
echo "==========================================${NC}"
echo ""
echo "访问地址: https://ssp.click/"
echo ""
echo "有用的命令:"
echo "  查看日志: pm2 logs ssp"
echo "  查看状态: pm2 status"
echo "  重启服务: pm2 restart ssp"
echo "  停止服务: pm2 stop ssp"
echo ""
