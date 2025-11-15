# 立即部署SSP新功能

## 🎯 快速开始

### 方法1: 通过AWS Session Manager(推荐)

#### 步骤1: 打开AWS控制台

1. 访问: https://ap-southeast-2.console.aws.amazon.com/ec2/home?region=ap-southeast-2#Instances
2. 使用您的AWS凭证登录:
   - Email: everest9812@gmail.com
   - Password: Amn86178130

#### 步骤2: 连接到EC2实例

1. 在EC2实例列表中找到SSP服务器(IP: 3.25.163.9)
2. 选中该实例
3. 点击顶部的 "Connect" 按钮
4. 选择 "Session Manager" 标签
5. 点击 "Connect" 按钮

#### 步骤3: 执行部署命令

在Session Manager终端中依次执行:

```bash
# 切换到SSP目录
cd /home/ubuntu/SSP

# 拉取最新代码
git pull origin main

# 运行自动化部署脚本
chmod +x deploy-new-features.sh
./deploy-new-features.sh
```

**完成!** 脚本会自动完成所有部署步骤。

---

### 方法2: 通过SSH(如果端口已开放)

```bash
# 使用您的SSH密钥连接
ssh -i ssp-key.pem ubuntu@3.25.163.9

# 执行部署
cd /home/ubuntu/SSP
git pull origin main
chmod +x deploy-new-features.sh
./deploy-new-features.sh
```

---

### 方法3: 手动逐步部署

如果自动化脚本失败,请手动执行:

```bash
# 1. 备份
cd /home/ubuntu
mkdir -p backups
tar -czf backups/ssp_backup_$(date +%Y%m%d_%H%M%S).tar.gz SSP

# 2. 更新代码
cd /home/ubuntu/SSP
git pull origin main

# 3. 安装依赖
pnpm install

# 4. 数据库迁移
mysql -u root -p ssp < drizzle/migrations/add_2fa_fields.sql
# 密码可能是: root 或 password 或为空(直接按回车)

# 5. 构建应用
pnpm run build

# 6. 重启服务
pm2 restart ssp

# 7. 检查状态
pm2 status
pm2 logs ssp --lines 20
```

---

## 📋 部署后验证

### 检查应用状态

```bash
pm2 status
```

应该看到 `ssp` 进程状态为 `online`

### 检查日志

```bash
pm2 logs ssp --lines 50
```

不应该有错误信息

### 测试新路由

```bash
# 测试登录历史
curl http://localhost:5000/login-history

# 测试支付历史
curl http://localhost:5000/payment-history

# 测试2FA设置
curl http://localhost:5000/2fa-settings

# 测试活体检测
curl http://localhost:5000/liveness-test
```

### 在浏览器中访问

打开浏览器访问:
- https://ssp.click/login-history
- https://ssp.click/payment-history
- https://ssp.click/2fa-settings
- https://ssp.click/liveness-test

---

## ⚙️ 配置邮件服务(可选)

如果要启用邮件通知功能:

```bash
# 编辑环境变量
cd /home/ubuntu/SSP
nano .env
```

添加以下配置:

```env
# Email Service
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
EMAIL_FROM=noreply@ssp.click
```

保存后重启:

```bash
pm2 restart ssp
```

---

## 🐛 常见问题

### Q1: git pull失败

**解决:**
```bash
cd /home/ubuntu/SSP
git stash
git pull origin main
```

### Q2: pnpm install失败

**解决:**
```bash
pnpm store prune
rm -rf node_modules
pnpm install
```

### Q3: 数据库迁移报错"Duplicate column"

**解决:** 这是正常的,说明迁移已经应用过,继续下一步即可。

### Q4: pm2 restart失败

**解决:**
```bash
pm2 delete ssp
pm2 start npm --name "ssp" -- start
pm2 save
```

### Q5: 端口5000被占用

**解决:**
```bash
sudo lsof -i :5000
# 找到进程ID后
sudo kill -9 <PID>
pm2 restart ssp
```

---

## 📊 部署检查清单

完成部署后,请确认:

- [ ] `pm2 status` 显示 ssp 为 online
- [ ] `pm2 logs ssp` 没有错误信息
- [ ] https://ssp.click 可以访问
- [ ] https://ssp.click/login-history 可以访问
- [ ] https://ssp.click/payment-history 可以访问
- [ ] https://ssp.click/2fa-settings 可以访问
- [ ] https://ssp.click/liveness-test 可以访问

---

## 🎉 部署成功后

### 新功能已上线:

1. **登录历史追踪** - 记录所有登录活动
2. **支付历史展示** - 查看和导出支付记录
3. **CSV/PDF导出** - 导出支付数据
4. **邮件通知** - 欢迎邮件、密码重置、登录提醒
5. **活体检测UI** - 交互式人脸验证界面
6. **2FA双因素认证** - TOTP认证保护账户

### 通知用户:

新功能已部署到生产环境,用户现在可以:
- 查看完整的登录历史和安全统计
- 导出支付记录为CSV或PDF
- 启用2FA保护账户安全
- 体验改进的活体检测界面

---

## 📞 需要帮助?

如果遇到问题:

1. 查看日志: `pm2 logs ssp`
2. 查看文档: `FEATURE_DEVELOPMENT_SUMMARY.md`
3. GitHub Issues: https://github.com/everest-an/SSP/issues

---

**祝部署顺利!** 🚀

最新代码已在GitHub: https://github.com/everest-an/SSP
Commit: 174a7d1
