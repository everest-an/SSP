# SSP 认证系统修复方案

## 🔍 问题诊断

### 问题1: 登录后闪退
**根本原因**: 
- `auth.me` API依赖session cookie
- 当前没有创建session的登录API
- 用户"登录"后实际没有session,导致`useAuth`无法获取用户信息
- `useAuth`的`redirectOnUnauthenticated`逻辑触发无限重定向

### 问题2: 面部登录报错
**根本原因**:
- `faceAuth.verifyFace`使用`protectedProcedure`(需要已登录)
- 但FaceLogin页面是用于登录的,用户还未登录
- 这是一个循环依赖:需要登录才能验证面部,但验证面部是为了登录

## 🔧 修复方案

### 方案A: 最小修复(快速解决)

#### 1. 创建公开的面部登录API
```typescript
// server/routers.ts
auth: router({
  me: publicProcedure.query(opts => opts.ctx.user),
  logout: publicProcedure.mutation(({ ctx }) => {
    // ... existing code
  }),
  
  // 新增: 面部登录API
  loginWithFace: publicProcedure
    .input(z.object({
      embedding: z.array(z.number()),
      videoFrames: z.array(z.string()),
      challenges: z.array(z.any()),
      deviceFingerprint: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      // 1. 验证liveness
      // 2. 查找匹配的face embedding
      // 3. 获取对应的用户
      // 4. 创建session
      // 5. 返回用户信息
    }),
    
  // 新增: 邮箱密码登录API  
  loginWithEmail: publicProcedure
    .input(z.object({
      email: z.string().email(),
      password: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      // 1. 验证邮箱密码
      // 2. 创建session
      // 3. 返回用户信息
    }),
    
  // 新增: 用户注册API
  register: publicProcedure
    .input(z.object({
      email: z.string().email(),
      password: z.string(),
      name: z.string(),
      phone: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      // 1. 检查邮箱是否已存在
      // 2. 哈希密码
      // 3. 创建用户
      // 4. 创建session
      // 5. 返回用户信息
    }),
}),
```

#### 2. 修复FaceLogin页面
```typescript
// 使用新的auth.loginWithFace API
const loginMutation = trpc.auth.loginWithFace.useMutation({
  onSuccess: (data) => {
    // 登录成功,刷新auth状态
    utils.auth.me.invalidate();
    // 重定向到dashboard
    setLocation('/dashboard');
  },
});
```

#### 3. 修复useAuth重定向逻辑
```typescript
// client/src/_core/hooks/useAuth.ts
// 添加防止无限循环的逻辑
useEffect(() => {
  if (!redirectOnUnauthenticated) return;
  if (meQuery.isLoading || logoutMutation.isPending) return;
  if (state.user) return;
  if (typeof window === "undefined") return;
  if (window.location.pathname === redirectPath) return;
  
  // 新增: 防止重定向循环
  const isLoginPage = ['/face-login', '/login', '/register'].includes(window.location.pathname);
  if (isLoginPage) return;

  window.location.href = redirectPath;
}, [/* deps */]);
```

### 方案B: 完整重构(推荐,但需要更多时间)

#### 1. 分离验证和登录逻辑
- `faceAuth.verifyFace` - 仅用于已登录用户的二次验证(支付等)
- `auth.loginWithFace` - 用于面部登录(公开API)

#### 2. 统一认证流程
```
用户访问 → 检查session → 无session → 重定向到登录页
                      → 有session → 允许访问
                      
登录页 → 选择登录方式 → 面部/邮箱/钱包
      → 验证成功 → 创建session → 重定向到dashboard
```

#### 3. 添加认证中间件
```typescript
// 在App.tsx中添加认证检查
function ProtectedRoute({ component: Component, ...rest }) {
  const { user, loading } = useAuth();
  
  if (loading) return <LoadingSpinner />;
  if (!user) return <Redirect to="/login" />;
  
  return <Component {...rest} />;
}
```

## 📋 实施步骤

### 立即修复(1-2小时)

1. ✅ 在`server/routers.ts`中添加`auth.loginWithFace` API
2. ✅ 在`server/routers.ts`中添加`auth.loginWithEmail` API  
3. ✅ 在`server/routers.ts`中添加`auth.register` API
4. ✅ 修复`FaceLogin.tsx`使用新的API
5. ✅ 修复`ClientLogin.tsx`使用新的API
6. ✅ 修复`ClientRegister.tsx`使用新的API
7. ✅ 修复`useAuth.ts`的重定向逻辑
8. ✅ 测试登录流程

### 后续优化(可选)

1. 添加密码重置功能
2. 添加邮箱验证功能
3. 添加2FA支持
4. 添加OAuth登录(Google, GitHub等)
5. 改进session管理(Redis)
6. 添加rate limiting

## 🎯 预期结果

修复后:
- ✅ 用户可以通过面部登录
- ✅ 用户可以通过邮箱密码登录
- ✅ 用户可以注册新账户
- ✅ 登录后不会闪退
- ✅ 认证状态正确管理
- ✅ 重定向逻辑正常工作

## 🔒 安全考虑

1. **密码哈希**: 使用bcrypt或argon2
2. **Session安全**: HttpOnly, Secure, SameSite cookies
3. **Rate limiting**: 防止暴力破解
4. **CSRF保护**: 使用CSRF token
5. **输入验证**: Zod schema验证所有输入
6. **错误处理**: 不泄露敏感信息

## 📊 测试清单

- [ ] 面部登录成功
- [ ] 面部登录失败(错误的face)
- [ ] 邮箱密码登录成功
- [ ] 邮箱密码登录失败(错误密码)
- [ ] 用户注册成功
- [ ] 用户注册失败(邮箱已存在)
- [ ] 登录后访问受保护页面
- [ ] 未登录访问受保护页面(重定向)
- [ ] 登出功能
- [ ] Session持久化(刷新页面)

## 💡 建议

1. **优先修复方案A** - 快速解决当前问题
2. **逐步实施方案B** - 长期改进架构
3. **添加日志** - 记录所有认证尝试
4. **监控** - 跟踪登录成功率和失败原因
5. **文档** - 更新API文档和用户指南
