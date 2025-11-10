# SSP快速部署指南

## 🚀 一键部署脚本

### 方式1: 直接在服务器上运行(推荐)

1. **SSH连接到服务器**
   ```bash
   ssh -i ssp-key.pem ec2-user@3.25.163.9
   ```

2. **下载并运行部署脚本**
   ```bash
   curl -o deploy.sh https://raw.githubusercontent.com/everest-an/SSP/main/deploy.sh
   chmod +x deploy.sh
   ./deploy.sh
   ```

### 方式2: 手动部署步骤

如果无法SSH连接,按以下步骤操作:

#### 步骤1: 获取Cognito User Pool ID

1. 登录AWS控制台: https://reurl.cc/k8Z6gd
2. 搜索并进入"Cognito"服务
3. 点击"User pools"
4. 找到"User pool - aua8rd"
5. 复制**User Pool ID**(格式: `ap-southeast-2_xxxxxxxxx`)

#### 步骤2: 在服务器上配置

连接到服务器后执行:

```bash
# 进入项目目录
cd ~/SSP

# 拉取最新代码
git pull origin main

# 创建.env文件
cat > .env << 'EOF'
# OAuth Configuration
VITE_OAUTH_PORTAL_URL=https://ap-southeast-2q83puda94.auth.ap-southeast-2.amazoncognito.com
VITE_APP_ID=3vdjmnldb67uu2jnuqt3uhaqth
VITE_APP_TITLE=SSP - Smart Store Payment

# Cognito Configuration
COGNITO_USER_POOL_ID=在这里填入步骤1获取的User Pool ID
COGNITO_REGION=ap-southeast-2
COGNITO_DOMAIN=ap-southeast-2q83puda94.auth.ap-southeast-2.amazoncognito.com

# Database (根据实际情况修改)
DATABASE_URL=postgresql://user:password@localhost:5432/ssp
REDIS_URL=redis://localhost:6379

# Server
PORT=3000
NODE_ENV=production
EOF

# 安装依赖
pnpm install

# 构建项目
pnpm run build

# 重启服务
pm2 restart ssp
# 或者如果是首次启动
pm2 start npm --name "ssp" -- start
pm2 save
```

#### 步骤3: 验证部署

1. 访问 https://ssp.click
2. 点击"Sign In"按钮
3. 应该跳转到Cognito登录页面(漂亮的渐变背景)
4. 使用邮箱注册/登录测试

## 🔧 故障排查

### 问题1: 登录跳转404

**原因**: `VITE_` 环境变量未生效

**解决**:
```bash
cd ~/SSP
pnpm run build  # 必须重新构建!
pm2 restart ssp
```

### 问题2: 无法SSH连接

**原因**: 安全组未开放SSH端口

**解决**:
1. AWS控制台 → EC2 → Security Groups
2. 找到SSP实例的安全组
3. Edit inbound rules → Add rule
4. Type: SSH, Port: 22, Source: 0.0.0.0/0
5. Save

### 问题3: User Pool ID不知道在哪

**位置**:
- AWS控制台 → Cognito → User pools
- 点击"User pool - aua8rd"
- 在"User pool overview"页面顶部可以看到

## 📋 配置信息汇总

| 配置项 | 值 |
|--------|-----|
| OAuth Portal URL | `https://ap-southeast-2q83puda94.auth.ap-southeast-2.amazoncognito.com` |
| App Client ID | `3vdjmnldb67uu2jnuqt3uhaqth` |
| Cognito Region | `ap-southeast-2` |
| Callback URL | `https://ssp.click/api/oauth/callback` |
| Server IP | `3.25.163.9` |
| Instance ID | `i-0d53f47830e65988e` |

## 💡 提示

- 修改 `VITE_` 开头的环境变量后,**必须**运行 `pnpm run build`
- PM2进程名称是 `ssp`,可以用 `pm2 logs ssp` 查看日志
- 如果端口被占用,修改 `.env` 中的 `PORT` 值
