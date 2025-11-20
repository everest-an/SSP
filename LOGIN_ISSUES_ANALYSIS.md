# SSP 登录问题分析报告

## 问题概述

在测试环境 https://ssp.click/ 中，用户点击 "Sign In" 按钮时被重定向到 AWS Cognito OAuth 登录页面，而不是使用项目自己实现的本地认证系统。

## 问题根源

### 1. 首页登录按钮配置错误

**文件**: `client/src/pages/Home.tsx`

**问题代码** (第 60-62 行):
```tsx
<Button asChild variant="default">
  <a href={getLoginUrl()}>Sign In</a>
</Button>
```

**问题描述**: 
- 使用 `getLoginUrl()` 函数生成登录链接
- 该函数默认返回 AWS Cognito OAuth 的登录地址

### 2. getLoginUrl 函数配置问题

**文件**: `client/src/const.ts`

**问题代码** (第 10-36 行):
```typescript
export const getLoginUrl = () => {
  const oauthPortalUrl = import.meta.env.VITE_OAUTH_PORTAL_URL || "https://ap-southeast-2q83puda94.auth.ap-southeast-2.amazoncognito.com";
  const appId = import.meta.env.VITE_APP_ID || "3vdjmnldb67uu2jnuqt3uhaqth";
  // ... 返回 Cognito OAuth URL
};
```

**问题描述**:
- 硬编码了 AWS Cognito 的默认地址
- 没有提供使用本地登录系统的选项

### 3. 路由配置正常

**文件**: `client/src/App.tsx`

**正常配置**:
```tsx
<Route path={"/client/login"} component={ClientLogin} />
<Route path={"/login"} component={ClientLogin} />
```

**说明**: 路由配置是正确的，`/login` 路径已经指向本地登录页面 `ClientLogin.tsx`

### 4. 本地认证系统已实现

**后端文件**: `server/routers.ts`

**已实现的认证方法**:
- ✅ 邮箱/密码注册 (`auth.register`)
- ✅ 邮箱/密码登录 (`auth.loginWithEmail`)
- ✅ 人脸识别登录 (`auth.loginWithFace`)
- ✅ 密码重置功能
- ✅ 会话管理 (`createUserSession`)

**前端文件**: `client/src/pages/ClientLogin.tsx`

**已实现的功能**:
- ✅ 邮箱/密码登录表单
- ✅ 人脸识别登录入口
- ✅ 记住我功能
- ✅ 忘记密码链接
- ✅ 注册链接

## 会话管理分析

### Cookie 配置

**文件**: `server/_core/cookies.ts`

**当前配置**:
```typescript
return {
  httpOnly: true,
  path: "/",
  sameSite: "none",
  secure: isSecureRequest(req),
};
```

**潜在问题**:
- `sameSite: "none"` 需要 `secure: true`
- 在 HTTPS 环境下应该正常工作
- 但可能在某些浏览器中存在跨域问题

### 会话创建流程

**文件**: `server/services/sessionService.ts`

**流程**:
1. 用户登录成功后调用 `createUserSession()`
2. 使用 JWT 创建会话令牌
3. 设置 HTTP-only Cookie
4. Cookie 名称: 从 `@shared/const` 导入的 `COOKIE_NAME`

**会话验证流程**:

**文件**: `server/_core/sdk.ts` (第 260-300 行)

**流程**:
1. 从请求中解析 Cookie
2. 验证 JWT 令牌
3. 根据 openId 格式判断登录类型:
   - `email_{userId}_{timestamp}` - 本地邮箱登录
   - 其他格式 - OAuth 登录
4. 从数据库获取用户信息

## 修复方案

### 方案 1: 修改首页登录按钮 (推荐)

**优点**:
- 简单直接
- 保留 OAuth 作为备选方案
- 符合项目设计意图

**修改内容**:
1. 修改 `Home.tsx` 中的登录按钮，使用 `<Link>` 组件指向 `/login`
2. 保留 `getLoginUrl()` 函数供需要 OAuth 的地方使用

### 方案 2: 修改 getLoginUrl 函数

**优点**:
- 统一登录入口管理
- 可通过环境变量控制

**修改内容**:
1. 添加环境变量 `VITE_USE_LOCAL_AUTH`
2. 当该变量为 true 时，返回 `/login` 路径

### 方案 3: 添加登录方式选择页面

**优点**:
- 用户可以选择登录方式
- 最灵活的方案

**修改内容**:
1. 创建登录方式选择页面
2. 提供"本地登录"和"OAuth 登录"选项

## 其他需要检查的问题

### 1. 环境变量配置

需要检查 `.env` 文件中的配置:
- `JWT_SECRET` - JWT 签名密钥
- `DATABASE_URL` - 数据库连接
- `VITE_APP_ID` - 应用 ID
- `VITE_OAUTH_PORTAL_URL` - OAuth 服务地址

### 2. Cookie 跨域问题

在生产环境中，需要确保:
- 前端和后端使用相同的域名或正确配置 CORS
- Cookie 的 `sameSite` 和 `secure` 属性正确配置
- 如果前后端分离部署，需要特别注意 Cookie 的域设置

### 3. 会话持久性

需要测试:
- 登录后刷新页面是否保持登录状态
- "记住我"功能是否正常工作
- 会话过期后的处理

### 4. 登录后的功能

需要测试:
- Dashboard 访问权限
- 用户角色判断 (admin/merchant/client)
- 受保护路由的访问控制
- API 请求的认证

## 下一步行动

1. ✅ 分析问题根源 (已完成)
2. ⏳ 修复首页登录按钮
3. ⏳ 测试登录功能
4. ⏳ 检查会话管理
5. ⏳ 测试登录后的功能
6. ⏳ 提交修复并部署

## 技术栈确认

- **前端**: React 19 + Vite + TailwindCSS + Wouter (路由)
- **后端**: Express.js + tRPC
- **认证**: JWT (jose 库)
- **数据库**: MySQL + Drizzle ORM
- **会话**: HTTP-only Cookie + JWT

## 结论

问题的核心在于首页的登录按钮错误地指向了 AWS Cognito OAuth 服务，而不是项目自己实现的本地认证系统。修复方案很简单，只需要将登录按钮改为指向 `/login` 路径即可。

本地认证系统的实现是完整的，包括注册、登录、密码重置、会话管理等功能。修复登录入口后，需要进一步测试会话管理和登录后的功能是否正常工作。
