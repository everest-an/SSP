# AWS部署配置指南

本文档说明如何在AWS EC2上部署SSP项目并配置OAuth登录功能。

## 环境变量配置

在AWS服务器上需要创建 `.env` 文件并配置以下环境变量:

### 必需的OAuth配置

```bash
# OAuth配置 (Manus平台)
VITE_OAUTH_PORTAL_URL=https://oauth.manus.im
VITE_APP_ID=ssp-app
VITE_APP_TITLE=SSP - Smart Store Payment
```

### 完整的生产环境配置示例

```bash
# Database Configuration
DATABASE_URL=mysql://user:password@localhost:3306/ssp

# Stripe Configuration
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# AWS S3 Configuration
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
S3_BUCKET_NAME=your_bucket_name
S3_REGION=us-east-1

# JWT Configuration
JWT_SECRET=your_strong_jwt_secret_key

# Admin Configuration
OWNER_OPEN_ID=your_admin_openid

# Server Configuration
PORT=5000
NODE_ENV=production

# CORS Configuration
CORS_ORIGIN=https://ssp.click

# Session Configuration
SESSION_SECRET=your_strong_session_secret

# OAuth Configuration (Manus Platform)
VITE_OAUTH_PORTAL_URL=https://oauth.manus.im
VITE_APP_ID=ssp-app
VITE_APP_TITLE=SSP - Smart Store Payment
```

## 部署步骤

### 1. 连接到EC2服务器

```bash
ssh -i ssp-key.pem ec2-user@3.25.163.9
```

### 2. 拉取最新代码

```bash
cd /path/to/SSP
git pull origin main
```

### 3. 创建或更新 .env 文件

```bash
nano .env
# 粘贴上面的环境变量配置
```

### 4. 安装依赖

```bash
pnpm install
```

### 5. 构建项目

```bash
pnpm run build
```

### 6. 重启服务

如果使用PM2:
```bash
pm2 restart ssp
```

如果使用systemd:
```bash
sudo systemctl restart ssp
```

如果直接运行:
```bash
pnpm run start
```

## 验证部署

1. 访问 https://ssp.click
2. 点击 "Sign In" 按钮
3. 应该会跳转到Manus OAuth登录页面
4. 登录后应该能正常返回网站

## 故障排查

### 登录跳转到404页面

**原因**: 缺少OAuth环境变量配置

**解决**: 确保 `.env` 文件中包含 `VITE_OAUTH_PORTAL_URL` 和 `VITE_APP_ID`

### 登录后无法返回

**原因**: CORS配置不正确

**解决**: 检查 `CORS_ORIGIN` 是否设置为 `https://ssp.click`

### 环境变量不生效

**原因**: Vite环境变量需要在构建时注入

**解决**: 
1. 确保环境变量以 `VITE_` 开头
2. 修改环境变量后需要重新构建: `pnpm run build`

## 注意事项

1. **环境变量前缀**: 前端使用的环境变量必须以 `VITE_` 开头
2. **重新构建**: 修改任何 `VITE_` 开头的环境变量后,必须重新构建项目
3. **安全性**: 不要将 `.env` 文件提交到Git仓库
4. **生产密钥**: 生产环境使用 `sk_live_` 和 `pk_live_` 开头的Stripe密钥
