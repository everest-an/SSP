#!/bin/bash

# SSP 快速部署脚本
# 使用方法: bash quick-deploy.sh

set -e

# 颜色
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${YELLOW}=========================================="
echo "SSP 快速部署"
echo "==========================================${NC}"

# 检测项目目录
if [ -d "/home/ec2-user/SSP" ]; then
    PROJECT_DIR="/home/ec2-user/SSP"
elif [ -d "$HOME/SSP" ]; then
    PROJECT_DIR="$HOME/SSP"
elif [ -d "/home/ubuntu/SSP" ]; then
    PROJECT_DIR="/home/ubuntu/SSP"
else
    echo -e "${RED}❌ 找不到 SSP 项目目录${NC}"
    exit 1
fi

echo -e "${GREEN}📁 项目目录: $PROJECT_DIR${NC}"
cd "$PROJECT_DIR"

# 显示当前版本
echo ""
echo -e "${YELLOW}当前版本:${NC}"
git log -1 --oneline

# 拉取最新代码
echo ""
echo -e "${YELLOW}📥 拉取最新代码...${NC}"
git fetch origin
git pull origin main

# 显示新版本
echo ""
echo -e "${GREEN}最新版本:${NC}"
git log -1 --oneline

# 安装依赖
echo ""
echo -e "${YELLOW}📦 安装依赖...${NC}"
if command -v pnpm &> /dev/null; then
    pnpm install
else
    npm install
fi

# 构建项目
echo ""
echo -e "${YELLOW}🔨 构建项目...${NC}"
if command -v pnpm &> /dev/null; then
    pnpm run build
else
    npm run build
fi

# 重启服务
echo ""
echo -e "${YELLOW}🔄 重启服务...${NC}"
if command -v pm2 &> /dev/null; then
    if pm2 list | grep -q "ssp"; then
        pm2 restart ssp
    else
        pm2 start npm --name ssp -- start
    fi
    pm2 save
else
    echo -e "${RED}❌ 找不到 pm2${NC}"
    exit 1
fi

# 等待服务启动
sleep 3

# 显示状态
echo ""
echo -e "${GREEN}=========================================="
echo "✅ 部署完成!"
echo "==========================================${NC}"
echo ""
pm2 status
echo ""
echo -e "${GREEN}访问: https://ssp.click${NC}"
echo ""
echo "查看日志: ${YELLOW}pm2 logs ssp${NC}"
echo ""
