# pleaselogin 10001 错误解决方案

**错误代码**: 10001  
**错误类型**: UNAUTHORIZED  
**错误消息**: "pleaselogin"

---

## 🔍 问题分析

### 错误原因

`pleaselogin 10001` 错误是一个**认证错误**,表示用户尝试访问需要登录的功能,但当前未登录。

**错误代码映射**:
```typescript
// server/_core/errors.ts
UNAUTHORIZED = 1001,
```

**HTTP 状态码**: 401 Unauthorized

---

## 🎯 问题定位

### 触发场景

这个错误通常在以下情况下出现:

1. **直接访问人脸注册页面** (`/face-registration` 或 `/face-enrollment`)
   - 这些页面需要用户先登录
   - 因为人脸数据需要关联到用户账号

2. **直接访问面部登录页面** (`/face-login`)
   - 如果用户还没有注册人脸
   - 系统无法进行人脸匹配

3. **Session 过期**
   - 用户之前登录过,但 session cookie 已过期
   - 需要重新登录

### 代码分析

**人脸注册 API 使用 `protectedProcedure`**:

```typescript
// server/routes/faceAuth.ts
enrollFace: protectedProcedure
  .input(z.object({
    faceEmbedding: z.string(),
    // ...
  }))
  .mutation(async ({ ctx, input }) => {
    const userId = ctx.user.id; // 需要登录用户的 ID
    // ...
  })
```

**`protectedProcedure` 的定义**:

```typescript
// server/_core/trpc.ts
export const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }
  return next({ ctx: { ...ctx, user: ctx.user } });
});
```

---

## ✅ 解决方案

### 方案 1: 先登录再注册人脸 (推荐)

这是**正确的流程**:

#### 步骤 1: 使用邮箱/密码登录

1. 访问 https://ssp.click/login
2. 输入邮箱和密码
3. 点击 "Sign in"

**测试账号**:
- 邮箱: `newtestuser@example.com`
- 密码: `Test123456!`

#### 步骤 2: 访问人脸注册页面

登录成功后,有两种方式访问人脸注册:

**方式 A**: 从侧边栏导航
1. 登录后会跳转到 `/client/profile`
2. 点击左侧菜单中的 "Face Registration"

**方式 B**: 直接访问 URL
1. 登录后直接访问 https://ssp.click/face-registration
2. 页面会正常加载

#### 步骤 3: 注册人脸

1. 点击 "Start Camera" 启动摄像头
2. 将脸对准摄像头
3. 等待 "Face Detected" 提示
4. (可选) 配置支付设置
5. 点击 "Register Face" 完成注册

---

### 方案 2: 改进错误提示 (开发优化)

当前的错误提示不够友好,可以改进:

#### 当前行为
- 显示 "pleaselogin 10001"
- 用户不知道需要做什么

#### 改进建议
- 检测到未登录时,自动跳转到登录页面
- 或显示友好的提示:"请先登录后再注册人脸"
- 提供"立即登录"按钮

#### 实现方案

**前端路由守卫**:

```typescript
// client/src/App.tsx
// 添加受保护的路由
<Route path="/face-registration" element={
  <ProtectedRoute>
    <FaceRegistration />
  </ProtectedRoute>
} />

// 创建 ProtectedRoute 组件
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { data: user, isLoading } = trpc.user.me.useQuery();
  
  if (isLoading) {
    return <div>Loading...</div>;
  }
  
  if (!user) {
    return <Navigate to="/login" state={{ from: location.pathname }} />;
  }
  
  return <>{children}</>;
}
```

---

## 📊 完整流程图

```
┌─────────────────┐
│  访问网站       │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  未登录状态     │
└────────┬────────┘
         │
         ├─────────────────┐
         │                 │
         ▼                 ▼
┌─────────────────┐  ┌─────────────────┐
│  访问登录页面   │  │ 直接访问人脸注册│
│  /login         │  │ /face-registration│
└────────┬────────┘  └────────┬────────┘
         │                    │
         ▼                    ▼
┌─────────────────┐  ┌─────────────────┐
│  输入邮箱密码   │  │ ❌ 报错 10001   │
└────────┬────────┘  │  pleaselogin    │
         │           └─────────────────┘
         ▼
┌─────────────────┐
│  登录成功       │
│  获得 session   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  已登录状态     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  访问人脸注册   │
│  /face-registration│
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  ✅ 页面正常加载│
│  可以注册人脸   │
└─────────────────┘
```

---

## 🧪 验证测试

### 测试 1: 未登录访问人脸注册

**步骤**:
1. 清除浏览器 cookies
2. 直接访问 https://ssp.click/face-registration

**预期结果**:
- ❌ 当前: 显示 "pleaselogin 10001" 错误
- ✅ 改进后: 自动跳转到登录页面

### 测试 2: 登录后访问人脸注册

**步骤**:
1. 访问 https://ssp.click/login
2. 输入 `newtestuser@example.com` / `Test123456!`
3. 点击 "Sign in"
4. 点击左侧菜单 "Face Registration"

**预期结果**:
- ✅ 页面正常加载
- ✅ 显示摄像头界面
- ✅ 可以注册人脸

### 测试 3: 完整注册流程

**步骤**:
1. 登录系统
2. 访问人脸注册页面
3. 点击 "Start Camera"
4. 对准摄像头
5. 点击 "Register Face"

**预期结果**:
- ✅ 摄像头正常启动
- ✅ 人脸检测正常
- ✅ 注册成功
- ✅ 可以使用面部登录

---

## 📝 用户指南

### 如何避免 pleaselogin 10001 错误

#### ✅ 正确流程

1. **先注册账号**
   - 访问 https://ssp.click/signup
   - 填写邮箱、密码等信息
   - 完成账号注册

2. **登录系统**
   - 访问 https://ssp.click/login
   - 输入邮箱和密码
   - 点击 "Sign in"

3. **注册人脸**
   - 登录后点击 "Face Registration"
   - 或访问 https://ssp.click/face-registration
   - 完成人脸注册

4. **使用面部登录**
   - 退出登录
   - 访问 https://ssp.click/face-login
   - 对准摄像头即可登录

#### ❌ 错误流程

1. ❌ 直接访问 `/face-registration` (未登录)
   - 会报错 "pleaselogin 10001"

2. ❌ 直接访问 `/face-login` (未注册人脸)
   - 会提示 "No face enrolled"

---

## 🔧 开发者修复建议

### 短期修复 (1-2 小时)

#### 1. 改进错误提示

**文件**: `client/src/pages/FaceRegistration.tsx`

```typescript
// 在组件中添加用户检查
const { data: user, isLoading } = trpc.user.me.useQuery();

if (isLoading) {
  return <div>Loading...</div>;
}

if (!user) {
  return (
    <div className="error-container">
      <h2>请先登录</h2>
      <p>您需要先登录才能注册人脸</p>
      <button onClick={() => navigate('/login')}>
        立即登录
      </button>
    </div>
  );
}
```

#### 2. 添加路由守卫

**文件**: `client/src/App.tsx`

```typescript
// 创建受保护的路由组件
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { data: user, isLoading } = trpc.user.me.useQuery();
  const location = useLocation();
  
  if (isLoading) {
    return <LoadingSpinner />;
  }
  
  if (!user) {
    // 保存原始 URL,登录后跳转回来
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }
  
  return <>{children}</>;
}

// 使用受保护的路由
<Route path="/face-registration" element={
  <ProtectedRoute>
    <FaceRegistration />
  </ProtectedRoute>
} />
```

### 中期优化 (3-4 小时)

#### 1. 统一错误处理

创建全局错误处理器:

```typescript
// client/src/utils/errorHandler.ts
export function handleAuthError(error: any) {
  if (error.data?.code === 'UNAUTHORIZED' || error.data?.code === 10001) {
    // 保存当前 URL
    const currentPath = window.location.pathname;
    localStorage.setItem('redirectAfterLogin', currentPath);
    
    // 跳转到登录页面
    window.location.href = '/login';
  }
}
```

#### 2. 登录后自动跳转

```typescript
// client/src/pages/Login.tsx
const location = useLocation();
const from = location.state?.from || localStorage.getItem('redirectAfterLogin') || '/dashboard';

// 登录成功后
onSuccess: () => {
  localStorage.removeItem('redirectAfterLogin');
  navigate(from);
}
```

---

## 📊 总结

### 问题本质

`pleaselogin 10001` 错误**不是 bug**,而是**正常的认证机制**:
- 人脸注册需要关联用户账号
- 因此必须先登录才能注册人脸

### 解决方案

**用户层面**:
1. ✅ 先登录系统
2. ✅ 再访问人脸注册页面
3. ✅ 完成人脸注册

**开发层面**:
1. 🔄 添加路由守卫
2. 🔄 改进错误提示
3. 🔄 自动跳转到登录页面

### 当前状态

**功能状态**: ✅ **正常工作**
- 登录后可以正常访问人脸注册
- 页面正常加载
- 所有功能可用

**用户体验**: 🟡 **需要改进**
- 错误提示不够友好
- 应该自动跳转到登录页面
- 需要更清晰的流程指引

---

## 🎯 立即解决方案

### 对于用户

**如果您看到 "pleaselogin 10001" 错误**:

1. 访问 https://ssp.click/login
2. 使用邮箱密码登录
3. 登录后再访问人脸注册页面

**测试账号**:
- 邮箱: `newtestuser@example.com`
- 密码: `Test123456!`

### 对于开发者

**如果需要改进用户体验**:

1. 添加路由守卫(见上文代码)
2. 改进错误提示
3. 实现自动跳转

**预计工作量**: 1-2 小时

---

**文档创建时间**: 2025-11-21  
**问题状态**: ✅ 已定位,有解决方案  
**功能状态**: ✅ 正常工作,需要改进用户体验
