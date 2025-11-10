# 通过EC2 Instance Connect部署SSP

## 方法:使用AWS控制台的浏览器终端(无需SSH密钥)

### 步骤1: 打开EC2 Instance Connect

1. 访问AWS控制台: https://reurl.cc/k8Z6gd
2. 搜索并进入"EC2"服务
3. 点击左侧"Instances"
4. 找到SSP实例(i-0d53f47830e65988e)
5. 选中该实例,点击顶部的"Connect"按钮
6. 选择"EC2 Instance Connect"标签
7. 点击"Connect"按钮

### 步骤2: 在浏览器终端中运行部署命令

连接成功后,会打开一个浏览器终端。复制粘贴以下命令并回车:

```bash
# 一键部署命令
curl -sSL https://raw.githubusercontent.com/everest-an/SSP/main/deploy.sh | bash
```

### 步骤3: 等待部署完成

脚本会自动执行以下操作:
1. ✅ 进入项目目录
2. ✅ 拉取最新代码
3. ✅ 配置环境变量(包含Cognito配置)
4. ✅ 安装依赖
5. ✅ 构建项目
6. ✅ 重启PM2服务

整个过程大约需要2-5分钟。

### 步骤4: 验证部署

1. 访问 https://ssp.click
2. 点击"Sign In"按钮
3. 应该跳转到Cognito登录页面
4. 使用邮箱注册/登录测试

---

## 备选方案:手动部署命令

如果一键命令失败,可以逐步执行:

```bash
# 1. 进入项目目录
cd ~/SSP || cd /home/ec2-user/SSP

# 2. 拉取最新代码
git pull origin main

# 3. 创建.env文件
cat > .env << 'EOF'
VITE_OAUTH_PORTAL_URL=https://ap-southeast-2q83puda94.auth.ap-southeast-2.amazoncognito.com
VITE_APP_ID=3vdjmnldb67uu2jnuqt3uhaqth
VITE_APP_TITLE=SSP - Smart Store Payment
COGNITO_USER_POOL_ID=ap-southeast-2_q83pUDA94
COGNITO_REGION=ap-southeast-2
COGNITO_DOMAIN=ap-southeast-2q83puda94.auth.ap-southeast-2.amazoncognito.com
DATABASE_URL=postgresql://user:password@localhost:5432/ssp
REDIS_URL=redis://localhost:6379
PORT=3000
NODE_ENV=production
EOF

# 4. 安装依赖
pnpm install || npm install

# 5. 构建项目
pnpm run build || npm run build

# 6. 重启服务
pm2 restart ssp || pm2 start npm --name "ssp" -- start
pm2 save
```

---

## 故障排查

### 问题1: 找不到项目目录

```bash
# 查找SSP项目位置
find ~ -name "SSP" -type d 2>/dev/null
```

### 问题2: PM2命令不存在

```bash
# 安装PM2
npm install -g pm2
```

### 问题3: pnpm命令不存在

```bash
# 安装pnpm
npm install -g pnpm
```

### 问题4: 查看部署日志

```bash
# 查看PM2日志
pm2 logs ssp

# 查看PM2状态
pm2 status
```

---

## 完整配置信息

| 配置项 | 值 |
|--------|-----|
| User Pool ID | `ap-southeast-2_q83pUDA94` |
| App Client ID | `3vdjmnldb67uu2jnuqt3uhaqth` |
| OAuth Portal | `https://ap-southeast-2q83puda94.auth.ap-southeast-2.amazoncognito.com` |
| Callback URL | `https://ssp.click/api/oauth/callback` |

---

## 注意事项

1. ✅ EC2 Instance Connect不需要SSH密钥
2. ✅ 所有配置已包含在部署脚本中
3. ⚠️ 确保实例有足够的磁盘空间和内存
4. ⚠️ 部署过程中不要关闭浏览器窗口
