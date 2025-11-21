# SSP DID 系统部署指南

**更新日期**: 2025-11-21  
**目标环境**: EC2 (Ubuntu)  
**预计时间**: 30-45 分钟

---

## 📋 部署前检查清单

在开始部署之前,请确认以下条件:

- [ ] 有 EC2 服务器的 SSH 访问权限
- [ ] MySQL 数据库已安装并运行
- [ ] Node.js 和 pnpm 已安装
- [ ] PM2 已安装
- [ ] Git 仓库可访问
- [ ] 有数据库管理员权限

---

## 🚀 快速部署 (推荐)

### 步骤 1: SSH 到 EC2

```bash
ssh ec2-user@your-ec2-ip
# 或使用密钥
ssh -i /path/to/key.pem ec2-user@your-ec2-ip
```

### 步骤 2: 运行数据库迁移

```bash
cd ~/SSP

# 备份现有数据库 (重要!)
mysqldump -u your_user -p your_database > backup_$(date +%Y%m%d_%H%M%S).sql

# 运行迁移
mysql -u your_user -p your_database < drizzle/migrations/001_create_did_tables.sql

# 验证表创建
mysql -u your_user -p your_database -e "SHOW TABLES LIKE 'did_%';"
```

**预期输出**:
```
+---------------------------+
| Tables_in_db (did_%)      |
+---------------------------+
| did_audit_logs            |
| did_identities            |
| did_recovery              |
| did_sessions              |
| did_transactions          |
+---------------------------+
```

### 步骤 3: 拉取最新代码

```bash
cd ~/SSP
git pull origin main
```

**预期输出**:
```
From https://github.com/everest-an/SSP
   3acd82a..86575b9  main       -> origin/main
Updating 3acd82a..86575b9
```

### 步骤 4: 安装依赖

```bash
pnpm install
```

### 步骤 5: 构建项目

```bash
pnpm run build
```

**预期输出**:
```
✓ built in XXXms
```

### 步骤 6: 重启服务

```bash
pm2 restart ssp
pm2 logs ssp --lines 50
```

**预期输出**:
```
[PM2] Restarting ssp
[PM2] ✓ ssp restarted
```

### 步骤 7: 验证部署

```bash
# 检查服务状态
pm2 status

# 检查日志
pm2 logs ssp --lines 20

# 测试 API
curl https://ssp.click/api/health
```

---

## 📝 详细部署步骤

### 1. 数据库迁移

#### 1.1 连接到 MySQL

```bash
mysql -u your_user -p
```

#### 1.2 选择数据库

```sql
USE your_database;
```

#### 1.3 查看现有表

```sql
SHOW TABLES;
```

#### 1.4 运行迁移脚本

```sql
SOURCE /home/ec2-user/SSP/drizzle/migrations/001_create_did_tables.sql;
```

#### 1.5 验证表结构

```sql
DESCRIBE did_identities;
DESCRIBE did_recovery;
DESCRIBE did_sessions;
DESCRIBE did_transactions;
DESCRIBE did_audit_logs;
```

#### 1.6 退出 MySQL

```sql
EXIT;
```

### 2. 环境变量配置 (可选)

如果需要配置 Arweave 或其他服务:

```bash
cd ~/SSP
nano .env
```

添加以下内容:

```env
# Arweave Configuration (Optional)
ARWEAVE_KEY_FILE=/path/to/arweave-keyfile.json

# Database Configuration (如果需要)
DATABASE_URL=mysql://user:password@localhost:3306/database

# Session Secret
SESSION_SECRET=your-secret-key-here
```

保存并退出 (Ctrl+X, Y, Enter)

### 3. 代码更新

#### 3.1 查看当前状态

```bash
cd ~/SSP
git status
git log --oneline -5
```

#### 3.2 拉取最新代码

```bash
git pull origin main
```

#### 3.3 查看更新内容

```bash
git log --oneline -10
git diff HEAD~5 HEAD --stat
```

### 4. 依赖安装

#### 4.1 清理旧依赖 (可选)

```bash
rm -rf node_modules
rm pnpm-lock.yaml
```

#### 4.2 安装新依赖

```bash
pnpm install
```

#### 4.3 验证安装

```bash
pnpm list | grep -E "qrcode|ethers|arweave"
```

### 5. 构建项目

#### 5.1 清理旧构建 (可选)

```bash
rm -rf dist
rm -rf client/dist
```

#### 5.2 构建前端和后端

```bash
pnpm run build
```

#### 5.3 验证构建

```bash
ls -lh dist/
ls -lh client/dist/
```

### 6. 服务管理

#### 6.1 查看当前服务状态

```bash
pm2 status
pm2 describe ssp
```

#### 6.2 重启服务

```bash
pm2 restart ssp
```

#### 6.3 查看日志

```bash
pm2 logs ssp --lines 50
```

#### 6.4 监控服务

```bash
pm2 monit
```

### 7. 验证部署

#### 7.1 检查服务器响应

```bash
curl -I https://ssp.click
```

**预期输出**:
```
HTTP/2 200
```

#### 7.2 检查 API 端点

```bash
# 测试健康检查
curl https://ssp.click/api/health

# 测试 tRPC 端点
curl https://ssp.click/api/trpc
```

#### 7.3 检查前端页面

```bash
# 测试注册页面
curl -I https://ssp.click/did-registration

# 测试登录页面
curl -I https://ssp.click/did-login
```

#### 7.4 使用浏览器测试

1. 打开 https://ssp.click/did-registration
2. 检查页面是否正常加载
3. 打开浏览器开发者工具 (F12)
4. 查看 Console 是否有错误

---

## 🧪 功能测试

### 测试 DID 注册

1. 访问 https://ssp.click/did-registration
2. 点击 "Start Registration"
3. 输入邮箱 (可选)
4. 允许摄像头访问
5. 对准摄像头
6. 点击 "Capture Face"
7. 等待处理完成
8. 查看 BackupID 和 QR 码
9. 下载 BackupID 文件
10. 点击 "Complete Registration"

**预期结果**:
- ✅ 注册成功
- ✅ BackupID 显示
- ✅ QR 码生成
- ✅ 本地存储已保存
- ✅ 跳转到 Dashboard

### 测试面部扫描登录

1. 访问 https://ssp.click/did-login
2. 选择 "Face Scan" 标签
3. 点击 "Login with Face"
4. 允许摄像头访问
5. 对准摄像头
6. 点击 "Capture & Login"
7. 等待验证完成

**预期结果**:
- ✅ 登录成功
- ✅ 跳转到 Dashboard
- ✅ 会话已创建

### 测试 BackupID 恢复

1. 清除浏览器本地存储
2. 访问 https://ssp.click/did-login
3. 选择 "BackupID" 标签
4. 输入之前保存的 BackupID
5. 点击 "Recover & Login"
6. 等待恢复完成

**预期结果**:
- ✅ 恢复成功
- ✅ 登录成功
- ✅ 本地存储已恢复
- ✅ 跳转到 Dashboard

---

## 🐛 故障排查

### 问题 1: 数据库迁移失败

**症状**: `ERROR 1050: Table 'did_identities' already exists`

**解决方案**:
```bash
# 删除旧表 (谨慎!)
mysql -u your_user -p your_database -e "DROP TABLE IF EXISTS did_identities, did_recovery, did_sessions, did_transactions, did_audit_logs;"

# 重新运行迁移
mysql -u your_user -p your_database < drizzle/migrations/001_create_did_tables.sql
```

### 问题 2: 构建失败

**症状**: `Error: Cannot find module 'qrcode'`

**解决方案**:
```bash
# 清理并重新安装
rm -rf node_modules pnpm-lock.yaml
pnpm install
pnpm run build
```

### 问题 3: PM2 服务无法启动

**症状**: `Error: listen EADDRINUSE: address already in use :::5000`

**解决方案**:
```bash
# 查找占用端口的进程
lsof -i :5000

# 杀死进程
kill -9 <PID>

# 重启服务
pm2 restart ssp
```

### 问题 4: 摄像头无法访问

**症状**: 浏览器提示 "Camera not found"

**解决方案**:
- 确保使用 HTTPS 连接
- 检查浏览器权限设置
- 使用真实设备 (不是虚拟机)

### 问题 5: API 返回 500 错误

**症状**: `Internal Server Error`

**解决方案**:
```bash
# 查看详细日志
pm2 logs ssp --lines 100

# 检查数据库连接
mysql -u your_user -p -e "SELECT 1;"

# 重启服务
pm2 restart ssp
```

---

## 📊 监控和维护

### 日志管理

```bash
# 查看实时日志
pm2 logs ssp

# 查看错误日志
pm2 logs ssp --err

# 清空日志
pm2 flush ssp
```

### 性能监控

```bash
# 查看资源使用
pm2 monit

# 查看详细信息
pm2 describe ssp

# 查看进程列表
pm2 list
```

### 数据库维护

```bash
# 查看 DID 身份数量
mysql -u your_user -p your_database -e "SELECT COUNT(*) FROM did_identities;"

# 查看最近的会话
mysql -u your_user -p your_database -e "SELECT * FROM did_sessions ORDER BY createdAt DESC LIMIT 10;"

# 清理过期会话
mysql -u your_user -p your_database -e "DELETE FROM did_sessions WHERE expiresAt < NOW();"
```

---

## 🔒 安全建议

1. **定期备份数据库**
   ```bash
   # 每天自动备份
   crontab -e
   # 添加: 0 2 * * * mysqldump -u user -p'password' database > /backups/db_$(date +\%Y\%m\%d).sql
   ```

2. **更新依赖**
   ```bash
   pnpm update
   pnpm audit
   ```

3. **监控日志**
   ```bash
   # 查找异常
   pm2 logs ssp | grep -i error
   ```

4. **配置防火墙**
   ```bash
   # 只允许 HTTPS
   sudo ufw allow 443/tcp
   sudo ufw enable
   ```

---

## 📞 支持

如果遇到问题:

1. 查看日志: `pm2 logs ssp --lines 100`
2. 检查 GitHub Issues: https://github.com/everest-an/SSP/issues
3. 查看文档: `/home/ubuntu/SSP/DID_DEVELOPMENT_PROGRESS.md`

---

## 🎉 部署完成!

恭喜!您已成功部署 SSP DID 系统。

**下一步**:
- 使用真实设备测试完整流程
- 配置 Arweave 钱包 (可选)
- 开发智能合约
- 进行安全审计

---

**文档版本**: 1.0  
**最后更新**: 2025-11-21  
**维护者**: Development Team
