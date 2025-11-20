# EC2 AWS Rekognition 错误修复

**日期**: 2025-11-21  
**问题**: EC2 上出现 AWS Rekognition AccessDeniedException 错误

---

## 问题描述

EC2 服务器日志显示:

```
Rekognition createLivenessSession error: AccessDeniedException: Unknown
```

**错误详情**:
- 错误类型: `AccessDeniedException`
- HTTP 状态码: 400
- 原因: AWS 凭证未配置或权限不足

---

## 根本原因

1. **缺少 AWS 凭证**: EC2 服务器上没有配置 AWS 访问密钥
2. **旧代码版本**: EC2 上运行的是旧版本代码,没有错误处理和降级逻辑
3. **用户尝试面部登录**: 当用户点击 "Face Login" 时,系统尝试调用 AWS Rekognition API

---

## 修复方案

### 方案 1: 部署最新代码(推荐)

最新代码已经包含了完整的错误处理和降级逻辑。

#### 步骤:

```bash
# SSH 到 EC2 服务器
ssh ec2-user@your-ec2-ip

# 进入项目目录
cd ~/SSP

# 拉取最新代码
git pull origin main

# 安装依赖
pnpm install

# 构建项目
pnpm run build

# 重启服务
pm2 restart ssp

# 查看日志
pm2 logs ssp --lines 50
```

#### 最新代码的改进:

1. **后端路由改进** (`server/routers.ts`):
   - `videoFrames` 和 `challenges` 改为可选参数
   - 添加降级处理,如果活体检测失败,使用简化模式

2. **前端页面改进** (`client/src/pages/FaceLogin.tsx`):
   - 捕获 AWS Rekognition 错误
   - 自动降级到简化模式
   - 改进错误提示

3. **新增简化服务** (`server/services/simpleFaceLogin.ts`):
   - 不依赖 AWS Rekognition
   - 基于余弦相似度的人脸匹配
   - 简单的活体检测

4. **改进的错误处理** (`server/routes/faceAuth.ts`):
   - 识别 AWS 凭证/权限错误
   - 返回更友好的错误消息
   - 建议用户使用密码登录

---

### 方案 2: 配置 AWS Rekognition(生产环境)

如果需要专业的人脸识别服务,可以配置 AWS Rekognition。

#### 步骤 1: 创建 AWS IAM 用户

1. 登录 [AWS Console](https://console.aws.amazon.com/)
2. 进入 IAM 服务
3. 创建新用户,选择 "Programmatic access"
4. 附加策略: `AmazonRekognitionFullAccess`
5. 保存 Access Key ID 和 Secret Access Key

#### 步骤 2: 在 EC2 上配置环境变量

```bash
# SSH 到 EC2
ssh ec2-user@your-ec2-ip

# 进入项目目录
cd ~/SSP

# 创建 .env 文件
nano .env
```

添加以下内容:

```env
# AWS Configuration
AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
AWS_REGION=ap-southeast-2

# S3 Configuration (可选)
S3_BUCKET_NAME=ssp-face-audit
S3_REGION=ap-southeast-2
```

保存并退出 (Ctrl+X, Y, Enter)

#### 步骤 3: 重启服务

```bash
pm2 restart ssp
pm2 logs ssp
```

#### 验证:

访问 https://ssp.click/face-login 测试面部登录功能。

---

## 修复内容

### 1. 改进错误处理 (`server/routes/faceAuth.ts`)

**修改前**:
```typescript
} catch (error) {
  throw new TRPCError({
    code: "INTERNAL_SERVER_ERROR",
    message: "Failed to create liveness session",
  });
}
```

**修改后**:
```typescript
} catch (error: any) {
  console.error('Failed to create Rekognition liveness session:', error);
  
  // Check if it's an AWS credentials/permissions error
  if (error.name === 'AccessDeniedException' || 
      error.name === 'CredentialsProviderError' ||
      error.$metadata?.httpStatusCode === 400) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "AWS Rekognition is not configured. Please use password login or contact administrator.",
    });
  }
  
  throw new TRPCError({
    code: "INTERNAL_SERVER_ERROR",
    message: "Failed to create liveness session",
  });
}
```

### 2. 改进前端错误处理 (`client/src/pages/FaceLogin.tsx`)

**修改前**:
```typescript
if (err.message && err.message.includes('liveness session')) {
  // 降级处理
}
```

**修改后**:
```typescript
if (err.message && (err.message.includes('liveness session') || 
                    err.message.includes('AWS Rekognition is not configured') ||
                    err.message.includes('PRECONDITION_FAILED'))) {
  // 降级处理
}
```

---

## 预期行为

### 修复后的流程:

1. **用户点击 "Face Login"**
2. **系统尝试创建 AWS Rekognition 会话**
3. **如果 AWS 未配置**:
   - 捕获 `AccessDeniedException` 错误
   - 返回友好的错误消息
   - 前端自动降级到简化模式
   - 继续人脸捕获和验证(使用简化算法)
4. **如果 AWS 已配置**:
   - 正常使用 AWS Rekognition
   - 专业的活体检测
   - 高准确度的人脸识别

---

## 测试验证

### 测试场景 1: AWS 未配置(当前状态)

**步骤**:
1. 部署最新代码
2. 访问 https://ssp.click/face-login
3. 点击 "Start Face Login"

**预期结果**:
- ✅ 不再显示 500 错误
- ✅ 自动降级到简化模式
- ✅ 可以继续人脸捕获(如果有摄像头)
- ✅ 或显示友好的错误消息

### 测试场景 2: AWS 已配置

**步骤**:
1. 配置 AWS 凭证
2. 重启服务
3. 访问 https://ssp.click/face-login
4. 点击 "Start Face Login"

**预期结果**:
- ✅ 成功创建 Rekognition 会话
- ✅ 使用专业的活体检测
- ✅ 高准确度的人脸识别

---

## 部署命令

### 快速部署(推荐):

```bash
cd ~/SSP && git pull origin main && pnpm install && pnpm run build && pm2 restart ssp && pm2 logs ssp
```

### 分步部署:

```bash
# 1. 进入项目目录
cd ~/SSP

# 2. 拉取最新代码
git pull origin main

# 3. 查看修改
git log --oneline -5

# 4. 安装依赖
pnpm install

# 5. 构建项目
pnpm run build

# 6. 重启服务
pm2 restart ssp

# 7. 查看日志
pm2 logs ssp --lines 50

# 8. 检查服务状态
pm2 status
```

---

## 故障排查

### 问题 1: Git pull 失败

```bash
# 检查当前分支
git branch

# 检查远程仓库
git remote -v

# 强制拉取(谨慎使用)
git fetch origin
git reset --hard origin/main
```

### 问题 2: pnpm install 失败

```bash
# 清除缓存
pnpm store prune

# 删除 node_modules
rm -rf node_modules

# 重新安装
pnpm install
```

### 问题 3: 构建失败

```bash
# 查看详细错误
pnpm run build --verbose

# 检查 TypeScript 错误
pnpm run type-check
```

### 问题 4: PM2 重启失败

```bash
# 查看 PM2 日志
pm2 logs ssp --err --lines 100

# 停止并重新启动
pm2 stop ssp
pm2 start ecosystem.config.js

# 或者使用 npm script
pm2 delete ssp
pnpm run start
```

---

## 日志监控

### 查看实时日志:

```bash
pm2 logs ssp
```

### 查看错误日志:

```bash
pm2 logs ssp --err
```

### 查看最近 100 行:

```bash
pm2 logs ssp --lines 100
```

### 过滤特定关键词:

```bash
pm2 logs ssp | grep "Rekognition"
pm2 logs ssp | grep "error"
pm2 logs ssp | grep "Face login"
```

---

## 预期日志输出

### 修复前(错误):

```
Rekognition createLivenessSession error: AccessDeniedException: Unknown
```

### 修复后(AWS 未配置):

```
Failed to create Rekognition liveness session: AccessDeniedException
No video frames or challenges provided, using simplified face login
```

### 修复后(AWS 已配置):

```
Rekognition liveness session created: session-id-xxxxx
Face login successful for user: 123
```

---

## 相关文件

### 修改的文件:
- ✅ `server/routes/faceAuth.ts` - 改进错误处理
- ✅ `client/src/pages/FaceLogin.tsx` - 改进错误检测

### 之前创建的文件:
- `server/services/simpleFaceLogin.ts` - 简化的面部登录服务
- `server/routers.ts` - 修改登录路由
- `FACE_LOGIN_FIX_REPORT.md` - 详细修复报告
- `TODO_AND_ISSUES.md` - 待修复功能清单

---

## Git 提交

```bash
cd ~/SSP
git add server/routes/faceAuth.ts client/src/pages/FaceLogin.tsx EC2_ERROR_FIX.md
git commit -m "Improve AWS Rekognition error handling for EC2 deployment

- Add specific error detection for AccessDeniedException
- Return user-friendly error message when AWS is not configured
- Improve frontend error detection and fallback logic
- Add EC2 deployment troubleshooting guide"
git push origin main
```

---

## 总结

### 问题:
- EC2 上出现 AWS Rekognition AccessDeniedException 错误
- 旧代码没有正确处理 AWS 凭证缺失的情况

### 修复:
- ✅ 改进后端错误处理,识别 AWS 凭证错误
- ✅ 返回友好的错误消息
- ✅ 改进前端错误检测
- ✅ 自动降级到简化模式

### 部署:
1. 拉取最新代码: `git pull origin main`
2. 安装依赖: `pnpm install`
3. 构建项目: `pnpm run build`
4. 重启服务: `pm2 restart ssp`

### 验证:
- 访问 https://ssp.click/face-login
- 不再显示 500 错误
- 自动使用简化模式

---

**修复完成时间**: 2025-11-21 16:30 GMT+8  
**状态**: ✅ 已修复,待部署
