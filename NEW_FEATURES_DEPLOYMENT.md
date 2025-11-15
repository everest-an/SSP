# SSP New Features Deployment Guide

**Date:** November 15, 2025  
**Version:** 1.2.0  
**Features:** Login History, Payment History, Export, Email, Liveness UI, 2FA

---

## 🚀 快速部署

### 自动化部署(推荐)

1. **连接到EC2服务器**
   ```bash
   ssh -i ssp-key.pem ubuntu@3.25.163.9
   ```

2. **运行部署脚本**
   ```bash
   cd /home/ubuntu/SSP
   git pull origin main
   chmod +x deploy-new-features.sh
   ./deploy-new-features.sh
   ```

---

## 📋 手动部署步骤

### Step 1: 备份

```bash
cd /home/ubuntu
mkdir -p backups
tar -czf backups/ssp_backup_$(date +%Y%m%d_%H%M%S).tar.gz SSP
```

### Step 2: 更新代码

```bash
cd /home/ubuntu/SSP
git pull origin main
```

### Step 3: 安装新依赖

```bash
pnpm install
```

新增依赖:
- `jspdf` + `jspdf-autotable` (PDF导出)
- `nodemailer` (邮件服务)
- `otplib` + `qrcode` (2FA)

### Step 4: 数据库迁移

```bash
mysql -u root -p ssp < drizzle/migrations/add_2fa_fields.sql
```

### Step 5: 配置邮件服务(可选)

编辑 `.env`:

```env
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
EMAIL_FROM=noreply@ssp.click
```

### Step 6: 构建和重启

```bash
pnpm run build
pm2 restart ssp
```

---

## 🧪 测试新功能

### 1. 登录历史

访问: https://ssp.click/login-history

测试:
- [ ] 显示登录记录
- [ ] 显示统计信息
- [ ] 过滤功能正常
- [ ] 分页正常

### 2. 支付历史

访问: https://ssp.click/payment-history

测试:
- [ ] 显示支付记录
- [ ] 过滤器正常
- [ ] CSV导出正常
- [ ] PDF导出正常

### 3. 活体检测

访问: https://ssp.click/liveness-test

测试:
- [ ] 摄像头权限请求
- [ ] 挑战显示正常
- [ ] 进度追踪正常
- [ ] 验证流程完整

### 4. 2FA设置

访问: https://ssp.click/2fa-settings

测试:
- [ ] QR码生成
- [ ] 验证码验证
- [ ] 启用/禁用功能
- [ ] 备份码下载

---

## 📧 邮件服务配置

### Gmail配置

1. 启用2步验证
2. 生成应用专用密码
3. 配置.env文件

### 测试邮件

- 注册新用户 → 检查欢迎邮件
- 请求密码重置 → 检查重置邮件
- 登录账户 → 检查登录通知

---

## 🐛 故障排除

### 应用无法启动

```bash
pm2 logs ssp --lines 100
```

### 数据库迁移失败

如果提示字段已存在,说明迁移已应用,可以忽略。

### 邮件发送失败

检查:
- SMTP凭证是否正确
- 是否使用应用专用密码
- 防火墙是否阻止端口587

---

## ✅ 部署检查清单

- [ ] 代码已更新
- [ ] 依赖已安装
- [ ] 数据库迁移已应用
- [ ] 环境变量已配置
- [ ] 应用已重启
- [ ] 所有新路由可访问
- [ ] 功能测试通过

---

**部署完成!** 🎉
