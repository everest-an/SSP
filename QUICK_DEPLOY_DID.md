# SSP DID 系统 - 一键部署

**部署时间**: < 5 分钟  
**难度**: ⭐ 简单

---

## 🚀 一行命令部署

```bash
cd ~/SSP && git pull origin main && bash deploy-did-system.sh
```

---

## 📋 手动步骤

### 1. SSH 到 EC2

```bash
ssh ec2-user@3.25.163.9
```

### 2. 运行部署脚本

```bash
cd ~/SSP
git pull origin main
bash deploy-did-system.sh
```

### 3. 输入数据库信息

- MySQL Username: [您的用户名]
- MySQL Password: [您的密码]
- Database Name: [您的数据库]

### 4. 等待完成 (3-5 分钟)

---

## ✅ 验证

```bash
pm2 status
pm2 logs ssp
curl https://ssp.click/api/health
```

---

## 🔗 测试页面

- 注册: https://ssp.click/did-registration
- 登录: https://ssp.click/did-login

---

