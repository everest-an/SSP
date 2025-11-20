# SSP 登录问题修复总结

## 修复日期
2024-11-20

## 问题描述
测试环境 https://ssp.click/ 中，用户点击 "Sign In" 按钮时被错误地重定向到 AWS Cognito OAuth 登录页面，而不是使用项目自己实现的本地认证系统。

## 根本原因
首页和其他组件中的登录按钮使用了 `getLoginUrl()` 函数，该函数默认返回 AWS Cognito OAuth 的登录地址，而项目已经实现了完整的本地认证系统（邮箱/密码登录和人脸识别登录）。

## 修复内容

### 1. 修复首页登录按钮 (`client/src/pages/Home.tsx`)

**修改内容**:
- 移除 `getLoginUrl` 导入
- 将导航栏的 "Sign In" 按钮改为指向 `/login`
- 将 Hero 区域的 "Get Started" 按钮改为指向 `/login`
- 将底部 CTA 的 "Start Free Trial" 按钮改为指向 `/register`

**修改前**:
```tsx
<Button asChild variant="default">
  <a href={getLoginUrl()}>Sign In</a>
</Button>
```

**修改后**:
```tsx
<Link href="/login">
  <Button variant="default">Sign In</Button>
</Link>
```

### 2. 修复未授权重定向 (`client/src/main.tsx`)

**修改内容**:
- 移除 `getLoginUrl` 导入
- 将未授权错误的重定向目标改为 `/login`

**修改前**:
```typescript
window.location.href = getLoginUrl();
```

**修改后**:
```typescript
window.location.href = "/login";
```

### 3. 修复 Dashboard 登录提示 (`client/src/components/DashboardLayout.tsx`)

**修改内容**:
- 移除 `getLoginUrl` 导入
- 将登录按钮的重定向目标改为 `/login`

**修改前**:
```tsx
<Button onClick={() => { window.location.href = getLoginUrl(); }}>
  Sign in
</Button>
```

**修改后**:
```tsx
<Button onClick={() => { window.location.href = "/login"; }}>
  Sign in
</Button>
```

## 保留的功能

### OAuth 登录支持
- `getLoginUrl()` 函数保留在 `client/src/const.ts` 中
- 可以在需要 OAuth 登录的地方继续使用
- 支持 AWS Cognito 和 Manus OAuth

### 本地认证系统
项目已实现完整的本地认证功能：
- ✅ 邮箱/密码注册 (`/register`)
- ✅ 邮箱/密码登录 (`/login`)
- ✅ 人脸识别登录 (`/face-login`)
- ✅ 密码重置功能 (`/forgot-password`, `/reset-password`)
- ✅ 会话管理 (JWT + HTTP-only Cookie)
- ✅ 记住我功能
- ✅ 登录历史记录

## 技术细节

### 认证流程
1. 用户在 `/login` 页面输入邮箱和密码
2. 前端调用 `trpc.auth.loginWithEmail` mutation
3. 后端验证凭据并创建会话
4. 设置 HTTP-only Cookie (名称: `COOKIE_NAME`)
5. 重定向到 Dashboard 或用户个人页面

### 会话管理
- **会话令牌**: JWT (使用 jose 库)
- **存储方式**: HTTP-only Cookie
- **Cookie 配置**:
  - `httpOnly: true` (防止 XSS)
  - `sameSite: "none"` (支持跨域)
  - `secure: true` (HTTPS only)
  - `path: "/"`
- **会话期限**: 
  - 默认: 1 年
  - 记住我: 30 天

### OpenId 格式
- **本地邮箱登录**: `email_{userId}_{timestamp}`
- **OAuth 登录**: 原始 openId

## 测试建议

### 1. 登录功能测试
- [ ] 访问首页，点击 "Sign In" 按钮，应跳转到 `/login`
- [ ] 访问首页，点击 "Get Started" 按钮，应跳转到 `/login`
- [ ] 访问首页，点击 "Start Free Trial" 按钮，应跳转到 `/register`
- [ ] 在登录页面输入正确的邮箱和密码，应成功登录
- [ ] 登录后应跳转到 Dashboard 或用户页面
- [ ] 刷新页面，应保持登录状态

### 2. 会话管理测试
- [ ] 登录后检查浏览器 Cookie，应存在会话 Cookie
- [ ] 勾选"记住我"，会话应持续 30 天
- [ ] 不勾选"记住我"，会话应持续 1 年
- [ ] 登出后，Cookie 应被清除
- [ ] 会话过期后，访问受保护页面应重定向到 `/login`

### 3. 人脸识别登录测试
- [ ] 点击 "Face Login" 按钮，应跳转到 `/face-login`
- [ ] 人脸识别登录流程应正常工作
- [ ] 登录后应跳转到 Dashboard

### 4. 注册功能测试
- [ ] 访问 `/register` 页面
- [ ] 填写注册信息并提交
- [ ] 注册成功后应自动登录
- [ ] 应收到欢迎邮件（如果配置了邮件服务）

### 5. 密码重置测试
- [ ] 访问 `/forgot-password` 页面
- [ ] 输入邮箱并提交
- [ ] 应收到密码重置邮件
- [ ] 点击邮件中的链接，应跳转到 `/reset-password`
- [ ] 输入新密码并提交
- [ ] 密码重置成功后应能用新密码登录

### 6. 权限控制测试
- [ ] 未登录状态访问 `/dashboard`，应重定向到 `/login`
- [ ] 登录后访问 `/dashboard`，应正常显示
- [ ] 不同角色用户应看到不同的菜单项
- [ ] Admin 用户应能访问 `/admin/*` 路径
- [ ] Merchant 用户应能访问商户相关页面
- [ ] Client 用户应只能访问客户相关页面

## 部署说明

### 环境变量检查
确保以下环境变量已正确配置：
- `JWT_SECRET` - JWT 签名密钥（必需）
- `DATABASE_URL` - 数据库连接字符串（必需）
- `VITE_APP_ID` - 应用 ID（可选，OAuth 使用）
- `VITE_OAUTH_PORTAL_URL` - OAuth 服务地址（可选）

### 数据库迁移
确保数据库表已创建：
```bash
pnpm run db:push
```

### 构建和部署
```bash
# 安装依赖
pnpm install

# 构建
pnpm run build

# 启动
pnpm run start
```

## 后续优化建议

### 1. 添加登录方式选择
可以在登录页面添加 OAuth 登录选项，让用户选择登录方式：
- 本地邮箱/密码登录
- OAuth 登录（Cognito/Manus）
- 人脸识别登录

### 2. 改进 Cookie 配置
根据部署环境优化 Cookie 配置：
- 如果前后端同域，可以设置 `sameSite: "lax"` 或 `"strict"`
- 如果需要跨域，确保 `sameSite: "none"` 和 `secure: true`
- 考虑设置 `domain` 属性以支持子域名

### 3. 添加多因素认证
增强安全性：
- 实现 2FA (TOTP)
- 实现 SMS 验证
- 实现邮箱验证码

### 4. 改进错误处理
- 添加更详细的错误提示
- 实现登录失败次数限制
- 添加验证码防止暴力破解

### 5. 添加审计日志
- 记录所有登录尝试
- 记录会话创建和销毁
- 记录可疑活动

## 相关文件

### 修改的文件
- `client/src/pages/Home.tsx` - 首页登录按钮
- `client/src/main.tsx` - 未授权重定向
- `client/src/components/DashboardLayout.tsx` - Dashboard 登录提示

### 相关文件（未修改）
- `client/src/const.ts` - 保留 `getLoginUrl()` 函数
- `client/src/pages/ClientLogin.tsx` - 本地登录页面
- `client/src/pages/ClientRegister.tsx` - 注册页面
- `client/src/pages/FaceLogin.tsx` - 人脸识别登录
- `server/routers.ts` - 认证路由
- `server/services/sessionService.ts` - 会话管理
- `server/services/authService.ts` - 认证服务
- `server/_core/sdk.ts` - SDK 认证
- `server/_core/cookies.ts` - Cookie 配置

## 提交信息

```
fix: 修复登录按钮错误跳转到 OAuth 的问题

- 修改首页登录按钮指向本地登录页面 /login
- 修改未授权重定向目标为 /login
- 修改 Dashboard 登录提示按钮
- 保留 OAuth 登录支持作为可选方案

问题: 用户点击 Sign In 按钮时被重定向到 AWS Cognito OAuth 页面
原因: 登录按钮使用了 getLoginUrl() 函数，默认返回 OAuth 地址
修复: 将所有登录入口改为指向本地认证系统 /login

测试: 在 https://ssp.click/ 上验证登录流程正常工作
```

## 联系信息
- 修复者: Manus Agent
- 日期: 2024-11-20
- 相关 Issue: 登录功能故障排查
