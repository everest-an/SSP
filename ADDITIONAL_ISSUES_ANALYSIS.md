# SSP 其他潜在问题分析

## 分析日期
2024-11-20

## 1. 环境变量配置问题

### 问题表现
页面标题显示为 `%VITE_APP_TITLE%`，说明 Vite 环境变量没有被正确替换。

### 原因分析
- Vite 在构建时会替换 `%VITE_*%` 占位符
- 如果环境变量未设置，占位符会保留在 HTML 中
- 这通常发生在生产环境部署时未正确配置环境变量

### 影响范围
- 页面标题显示异常
- 可能影响其他使用环境变量的功能
- Analytics 追踪可能无法正常工作

### 需要检查的环境变量
```env
VITE_APP_TITLE=SSP - Smart Store Payment
VITE_OAUTH_PORTAL_URL=https://ap-southeast-2q83puda94.auth.ap-southeast-2.amazoncognito.com
VITE_APP_ID=3vdjmnldb67uu2jnuqt3uhaqth
VITE_ANALYTICS_ENDPOINT=
VITE_ANALYTICS_WEBSITE_ID=
```

### 解决方案

#### 方案 1: 在 AWS 部署配置中设置环境变量
在 AWS 的部署配置（如 Elastic Beanstalk、ECS、或 Lambda）中设置环境变量。

#### 方案 2: 使用 .env 文件
创建 `.env.production` 文件：
```env
VITE_APP_TITLE=SSP - Smart Store Payment
VITE_APP_ID=3vdjmnldb67uu2jnuqt3uhaqth
```

#### 方案 3: 修改 index.html 使用默认值
```html
<title>SSP - Smart Store Payment</title>
```

## 2. 数据库连接问题

### 潜在问题
从代码分析来看，数据库连接是在模块加载时同步初始化的：

```typescript
if (process.env.DATABASE_URL) {
  try {
    _db = drizzle(process.env.DATABASE_URL);
  } catch (error) {
    console.warn("[Database] Failed to connect:", error);
    _db = null;
  }
}
```

### 可能的问题
1. **DATABASE_URL 未设置**: 如果环境变量未设置，`_db` 将为 `null`
2. **连接失败**: 如果数据库连接失败，所有数据库操作都会失败
3. **错误处理不足**: 当 `_db` 为 `null` 时，某些函数可能会抛出异常

### 影响
- 用户注册/登录失败
- 所有需要数据库的功能无法使用
- 可能导致服务器崩溃

### 建议改进
1. 添加数据库连接健康检查
2. 在启动时验证数据库连接
3. 改进错误处理和日志记录

## 3. Cookie 跨域问题

### 当前配置
```typescript
return {
  httpOnly: true,
  path: "/",
  sameSite: "none",
  secure: isSecureRequest(req),
};
```

### 潜在问题
1. **sameSite: "none"** 要求 `secure: true`
2. 如果前后端不在同一域名，可能需要额外的 CORS 配置
3. 某些浏览器可能阻止第三方 Cookie

### 测试建议
1. 检查浏览器控制台是否有 Cookie 相关警告
2. 验证 Cookie 是否被正确设置
3. 测试不同浏览器的兼容性

## 4. 会话验证问题

### OpenId 格式
代码中使用了两种 OpenId 格式：
- **本地登录**: `email_{userId}_{timestamp}`
- **OAuth 登录**: 原始 openId

### 潜在问题
在 `sdk.ts` 的 `authenticateRequest` 函数中：

```typescript
const isLocalLogin = sessionUserId.startsWith("email_");

if (isLocalLogin) {
  const userIdMatch = sessionUserId.match(/^email_(\d+)_/);
  if (userIdMatch) {
    const userId = parseInt(userIdMatch[1], 10);
    user = await db.getUserById(userId);
  }
}
```

**问题**: 如果正则匹配失败或 `getUserById` 返回 `undefined`，`user` 将是 `undefined`，可能导致后续代码出错。

### 建议改进
添加更完善的错误处理：
```typescript
if (isLocalLogin) {
  const userIdMatch = sessionUserId.match(/^email_(\d+)_/);
  if (!userIdMatch) {
    throw ForbiddenError("Invalid session format");
  }
  const userId = parseInt(userIdMatch[1], 10);
  user = await db.getUserById(userId);
  if (!user) {
    throw ForbiddenError("User not found");
  }
}
```

## 5. 注册时 OpenId 生成问题

### 当前实现
```typescript
openId: `email_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
```

### 问题
这个 OpenId 格式与登录时创建的不一致：
- **注册时**: `email_{timestamp}_{random}`
- **登录时**: `email_{userId}_{timestamp}`

### 影响
会话验证时无法正确提取 userId，导致认证失败。

### 修复方案
修改注册逻辑，在创建用户后更新 OpenId：

```typescript
// Create user
const [newUser] = await db.insert(users).values({
  email: data.email,
  passwordHash,
  name: data.name,
  loginMethod: 'email',
  role: data.role || 'user',
  openId: `temp_${Date.now()}`, // Temporary openId
});

// Update with correct openId format
await db
  .update(users)
  .set({ openId: `email_${newUser.insertId}_${Date.now()}` })
  .where(eq(users.id, newUser.insertId));
```

或者在登录时创建会话时使用正确的格式：

```typescript
// In sessionService.ts - createUserSession
const openId = `email_${userId}_${Date.now()}`;
```

## 6. 密码重置功能

### 需要检查的问题
1. **Token 存储**: 密码重置 token 存储在哪里？
2. **Token 过期**: 是否有过期机制？
3. **邮件发送**: 邮件服务是否配置正确？
4. **安全性**: Token 是否足够安全？

### 建议测试
1. 请求密码重置
2. 检查是否收到邮件
3. 验证 token 是否有效
4. 测试 token 过期处理
5. 测试重置后能否用新密码登录

## 7. 人脸识别登录

### 需要检查的问题
1. **MediaPipe 加载**: 前端是否能正确加载 MediaPipe
2. **摄像头权限**: 是否正确请求摄像头权限
3. **人脸数据存储**: 人脸特征向量存储在哪里？
4. **活体检测**: 活体检测是否正常工作
5. **相似度阈值**: 当前阈值是否合适

### 测试建议
1. 访问 `/face-login` 页面
2. 检查摄像头是否能正常启动
3. 测试人脸识别流程
4. 验证活体检测功能

## 8. 角色权限控制

### 当前实现
```typescript
// Admin-only procedure
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== 'admin') {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Admin access required' });
  }
  return next({ ctx });
});

// Merchant or admin procedure
const merchantProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== 'merchant' && ctx.user.role !== 'admin') {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Merchant or admin access required' });
  }
  return next({ ctx });
});
```

### 需要测试
1. 普通用户访问管理员页面应被拒绝
2. 商户用户应能访问商户页面
3. 管理员应能访问所有页面
4. 前端路由保护是否生效

## 9. 支付功能

### 需要检查
1. **Stripe 配置**: API 密钥是否正确配置
2. **Webhook**: Stripe webhook 是否正确设置
3. **支付流程**: 完整的支付流程是否正常
4. **错误处理**: 支付失败时的处理

### 测试建议
1. 测试添加支付方式
2. 测试创建订单
3. 测试支付流程
4. 测试支付失败情况

## 10. WebSocket 实时功能

### 需要检查
1. **WebSocket 连接**: 是否能正常建立连接
2. **消息推送**: 实时消息是否能正常接收
3. **断线重连**: 断线后是否能自动重连
4. **性能**: 大量连接时的性能表现

### 测试建议
1. 打开浏览器控制台查看 WebSocket 连接状态
2. 测试订单状态实时更新
3. 测试通知实时推送

## 优先级排序

### 高优先级（阻塞性问题）
1. ✅ 登录按钮跳转问题（已修复）
2. ⚠️ OpenId 格式不一致问题
3. ⚠️ 数据库连接验证
4. ⚠️ 环境变量配置

### 中优先级（功能性问题）
5. Cookie 跨域配置
6. 会话验证错误处理
7. 密码重置功能测试
8. 角色权限控制测试

### 低优先级（体验优化）
9. 人脸识别功能测试
10. 支付功能测试
11. WebSocket 功能测试
12. 性能优化

## 下一步行动计划

### 立即执行
1. 修复 OpenId 格式不一致问题
2. 添加数据库连接健康检查
3. 改进会话验证错误处理

### 等待部署后测试
1. 验证登录功能是否正常
2. 测试注册功能
3. 测试密码重置
4. 测试各种角色的权限控制

### 后续优化
1. 改进 Cookie 配置
2. 添加更多错误处理
3. 优化性能
4. 添加监控和日志

## 建议的测试流程

### 1. 基础功能测试
- [ ] 访问首页
- [ ] 点击 Sign In 按钮（应跳转到 /login）
- [ ] 点击 Register 链接
- [ ] 填写注册信息并提交
- [ ] 验证是否自动登录
- [ ] 登出
- [ ] 用注册的账号登录
- [ ] 验证登录状态

### 2. 会话管理测试
- [ ] 登录后刷新页面
- [ ] 验证是否保持登录状态
- [ ] 关闭浏览器后重新打开
- [ ] 验证"记住我"功能

### 3. 权限控制测试
- [ ] 以普通用户登录
- [ ] 尝试访问 /admin 路径
- [ ] 验证是否被拒绝
- [ ] 以管理员登录
- [ ] 验证能否访问管理页面

### 4. 错误处理测试
- [ ] 输入错误的密码
- [ ] 验证错误提示
- [ ] 输入不存在的邮箱
- [ ] 验证错误提示
- [ ] 网络断开时的处理

## 总结

通过代码分析，发现了以下主要问题：

1. **已修复**: 登录按钮跳转到 OAuth 的问题
2. **需要修复**: OpenId 格式不一致导致会话验证可能失败
3. **需要验证**: 环境变量配置、数据库连接、Cookie 设置
4. **需要测试**: 完整的登录流程、权限控制、错误处理

建议按照优先级逐步修复和测试这些问题，确保系统的稳定性和安全性。
