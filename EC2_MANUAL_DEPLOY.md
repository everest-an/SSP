# SSP EC2 手动部署指南

## 快速部署命令

### 方法 1: 使用现有部署脚本 (推荐)

```bash
# SSH 连接到 EC2
ssh -i your-key.pem ec2-user@your-ec2-ip

# 进入项目目录
cd ~/SSP

# 拉取最新代码
git pull origin main

# 运行部署脚本
bash deploy_to_ec2.sh
```

### 方法 2: 手动逐步部署

```bash
# 1. SSH 连接到 EC2
ssh -i your-key.pem ec2-user@your-ec2-ip

# 2. 进入项目目录
cd ~/SSP

# 3. 拉取最新代码
git fetch origin
git pull origin main

# 4. 安装依赖
pnpm install

# 5. 构建项目
pnpm run build

# 6. 重启服务
pm2 restart ssp

# 7. 查看状态
pm2 status
pm2 logs ssp --lines 50
```

### 方法 3: 一键部署 (复制粘贴)

```bash
cd ~/SSP && \
git pull origin main && \
pnpm install && \
pnpm run build && \
pm2 restart ssp && \
pm2 logs ssp --lines 20
```

---

## 详细部署步骤

### 前置条件

1. **EC2 实例信息**
   - IP 地址: `your-ec2-ip`
   - SSH 密钥: `your-key.pem`
   - 用户名: `ec2-user` 或 `ubuntu`

2. **已安装的软件**
   - Node.js (v18+)
   - pnpm
   - pm2
   - git

### 步骤 1: 连接到 EC2

```bash
# 使用 SSH 密钥连接
ssh -i /path/to/your-key.pem ec2-user@your-ec2-ip

# 或者如果已配置 SSH config
ssh ssp-server
```

### 步骤 2: 检查当前状态

```bash
# 查看当前运行的服务
pm2 list

# 查看最近的日志
pm2 logs ssp --lines 50

# 查看当前 Git 版本
cd ~/SSP
git log -1 --oneline
```

### 步骤 3: 备份当前版本 (可选)

```bash
cd ~/SSP

# 创建备份分支
git branch backup-$(date +%Y%m%d-%H%M%S)

# 或者创建备份目录
cp -r ~/SSP ~/SSP-backup-$(date +%Y%m%d-%H%M%S)
```

### 步骤 4: 拉取最新代码

```bash
cd ~/SSP

# 查看远程更新
git fetch origin

# 查看将要拉取的提交
git log HEAD..origin/main --oneline

# 拉取最新代码
git pull origin main

# 验证最新提交
git log -1 --oneline
```

**预期输出**:
```
b034ddd fix: add missing /client/profile route for user login redirect
```

### 步骤 5: 安装依赖

```bash
cd ~/SSP

# 使用 pnpm (推荐)
pnpm install

# 或使用 npm
npm install
```

### 步骤 6: 构建项目

```bash
cd ~/SSP

# 构建前端和后端
pnpm run build

# 或
npm run build
```

**预期输出**:
```
✓ built in XXXms
```

### 步骤 7: 重启服务

```bash
# 使用 pm2 重启
pm2 restart ssp

# 查看重启状态
pm2 status

# 实时查看日志
pm2 logs ssp
```

### 步骤 8: 验证部署

```bash
# 1. 检查进程状态
pm2 status

# 2. 查看最近日志
pm2 logs ssp --lines 50

# 3. 测试 API 端点
curl http://localhost:5000/api/health

# 4. 测试网站
curl -I https://ssp.click
```

---

## 常见问题排查

### 问题 1: Git 拉取失败

```bash
# 检查 Git 状态
git status

# 如果有未提交的修改，暂存它们
git stash

# 重新拉取
git pull origin main

# 恢复暂存的修改
git stash pop
```

### 问题 2: 依赖安装失败

```bash
# 清除缓存
pnpm store prune
rm -rf node_modules
rm pnpm-lock.yaml

# 重新安装
pnpm install
```

### 问题 3: 构建失败

```bash
# 检查 Node.js 版本
node -v  # 应该是 v18 或更高

# 检查磁盘空间
df -h

# 清除构建缓存
rm -rf dist
rm -rf .vite

# 重新构建
pnpm run build
```

### 问题 4: PM2 重启失败

```bash
# 停止所有进程
pm2 stop all

# 删除旧进程
pm2 delete ssp

# 重新启动
pm2 start npm --name ssp -- start

# 保存配置
pm2 save
```

### 问题 5: 端口被占用

```bash
# 查看端口占用
sudo lsof -i :5000

# 杀死占用端口的进程
sudo kill -9 <PID>

# 重启服务
pm2 restart ssp
```

---

## 环境变量配置

### 检查环境变量

```bash
cd ~/SSP

# 查看 .env 文件
cat .env

# 或
ls -la | grep env
```

### 必需的环境变量

创建或编辑 `.env` 文件:

```bash
nano ~/SSP/.env
```

添加以下内容:

```env
# Database
DATABASE_URL=mysql://user:password@localhost:3306/ssp

# JWT
JWT_SECRET=your-secret-key-here

# Stripe (可选)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...

# AWS S3 (可选)
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
S3_BUCKET_NAME=...

# OAuth (可选)
VITE_OAUTH_PORTAL_URL=https://...
VITE_APP_ID=...

# Admin
OWNER_OPEN_ID=your-admin-openid
```

保存后重启服务:

```bash
pm2 restart ssp
```

---

## PM2 常用命令

### 基本命令

```bash
# 查看所有进程
pm2 list

# 查看详细信息
pm2 show ssp

# 查看日志
pm2 logs ssp

# 查看最近 100 行日志
pm2 logs ssp --lines 100

# 实时监控
pm2 monit

# 重启服务
pm2 restart ssp

# 停止服务
pm2 stop ssp

# 删除进程
pm2 delete ssp

# 保存配置
pm2 save

# 设置开机自启
pm2 startup
```

### 日志管理

```bash
# 清空日志
pm2 flush

# 查看错误日志
pm2 logs ssp --err

# 查看输出日志
pm2 logs ssp --out

# 导出日志
pm2 logs ssp --lines 1000 > ~/ssp-logs.txt
```

---

## 数据库操作 (如需要)

### 连接数据库

```bash
# 使用 MySQL 客户端
mysql -u username -p ssp

# 或使用环境变量中的连接字符串
mysql -u user -p -h localhost ssp
```

### 运行迁移

```bash
cd ~/SSP

# 推送数据库架构
pnpm run db:push

# 或运行迁移脚本
pnpm run db:migrate
```

---

## 回滚到上一个版本

### 方法 1: Git 回滚

```bash
cd ~/SSP

# 查看提交历史
git log --oneline -10

# 回滚到上一个提交
git reset --hard HEAD~1

# 重新构建和部署
pnpm install
pnpm run build
pm2 restart ssp
```

### 方法 2: 使用备份

```bash
# 停止当前服务
pm2 stop ssp

# 恢复备份
rm -rf ~/SSP
cp -r ~/SSP-backup-YYYYMMDD-HHMMSS ~/SSP

# 重启服务
cd ~/SSP
pm2 restart ssp
```

---

## 监控和日志

### 实时监控

```bash
# PM2 监控面板
pm2 monit

# 系统资源
htop

# 磁盘使用
df -h

# 内存使用
free -h
```

### 查看访问日志

```bash
# Nginx 访问日志 (如果使用 Nginx)
sudo tail -f /var/log/nginx/access.log

# Nginx 错误日志
sudo tail -f /var/log/nginx/error.log
```

---

## 性能优化

### 清理磁盘空间

```bash
# 清理 npm/pnpm 缓存
pnpm store prune
npm cache clean --force

# 清理旧的日志
pm2 flush

# 清理系统日志
sudo journalctl --vacuum-time=7d
```

### 优化 PM2 配置

创建 `ecosystem.config.js`:

```javascript
module.exports = {
  apps: [{
    name: 'ssp',
    script: 'npm',
    args: 'start',
    instances: 2,
    exec_mode: 'cluster',
    max_memory_restart: '500M',
    env: {
      NODE_ENV: 'production',
    }
  }]
};
```

使用配置文件启动:

```bash
pm2 start ecosystem.config.js
pm2 save
```

---

## 安全检查

### 更新依赖

```bash
cd ~/SSP

# 检查过期的包
pnpm outdated

# 更新所有依赖
pnpm update

# 检查安全漏洞
pnpm audit

# 自动修复
pnpm audit fix
```

### 防火墙配置

```bash
# 检查防火墙状态
sudo ufw status

# 允许 HTTP/HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# 允许 SSH
sudo ufw allow 22/tcp
```

---

## 自动化部署脚本

创建一个完整的部署脚本 `~/deploy-ssp.sh`:

```bash
#!/bin/bash

set -e

echo "🚀 开始部署 SSP..."

cd ~/SSP

# 1. 拉取代码
echo "📥 拉取最新代码..."
git pull origin main

# 2. 安装依赖
echo "📦 安装依赖..."
pnpm install

# 3. 构建项目
echo "🔨 构建项目..."
pnpm run build

# 4. 重启服务
echo "🔄 重启服务..."
pm2 restart ssp

# 5. 查看状态
echo "✅ 部署完成!"
pm2 status
pm2 logs ssp --lines 20

echo ""
echo "访问: https://ssp.click"
```

使用:

```bash
chmod +x ~/deploy-ssp.sh
~/deploy-ssp.sh
```

---

## 联系信息

如果遇到问题,请检查:
1. PM2 日志: `pm2 logs ssp`
2. 系统日志: `journalctl -xe`
3. Nginx 日志: `/var/log/nginx/error.log`

---

**最后更新**: 2025-11-21  
**版本**: 1.0  
**修复提交**: b034ddd
