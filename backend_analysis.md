# SSP项目后端代码分析报告

## 项目概述

**SSP (Smart Store Payment)** 是一个基于计算机视觉和生物识别技术的智能零售支付系统。该项目实现了通过面部识别和手势识别完成无接触支付的完整解决方案。

### 技术栈

- **后端框架**: Express.js + tRPC
- **数据库**: MySQL + Drizzle ORM
- **认证系统**: JWT (jose库)
- **支付网关**: Stripe
- **AI/ML**: MediaPipe (面部识别、手势识别)
- **存储**: AWS S3
- **前端**: React + Vite + TailwindCSS

---

## 后端架构分析

### 1. 核心目录结构

```
server/
├── _core/                    # 核心基础设施
│   ├── context.ts           # tRPC上下文
│   ├── cookies.ts           # Cookie管理
│   ├── dataApi.ts           # 数据API
│   ├── env.ts               # 环境变量
│   ├── imageGeneration.ts   # 图像生成
│   ├── index.ts             # 服务器入口
│   ├── llm.ts               # LLM集成
│   ├── map.ts               # 映射工具
│   ├── notification.ts      # 通知系统
│   ├── oauth.ts             # OAuth认证
│   ├── sdk.ts               # SDK工具
│   ├── systemRouter.ts      # 系统路由
│   ├── trpc.ts              # tRPC配置
│   ├── vite.ts              # Vite集成
│   └── voiceTranscription.ts # 语音转文字
├── adminDb.ts               # 管理员数据库操作
├── adminRouters.ts          # 管理员路由
├── db.ts                    # 主数据库操作
├── faceAndWalletDb.ts       # 面部识别和钱包数据库操作
├── faceAndWalletRouters.ts  # 面部识别和钱包路由
├── products.ts              # 商品数据
├── routers.ts               # 主路由配置
├── storage.ts               # 存储服务
├── stripe.ts                # Stripe支付集成
└── stripeRouters.ts         # Stripe路由
```

---

## 数据库设计

### 核心表结构

#### 1. **用户表 (users)**
- 字段: id, openId, name, email, loginMethod, role, createdAt, updatedAt, lastSignedIn
- 角色: user, admin, merchant
- 支持OAuth认证

#### 2. **商户表 (merchants)**
- 字段: id, userId, businessName, businessType, address, phone, email, status
- 状态: active, inactive, suspended

#### 3. **商品表 (products)**
- 字段: id, merchantId, name, description, sku, barcode, category, price, currency, imageUrl, stock, status
- 价格以分为单位存储(避免浮点数精度问题)

#### 4. **设备表 (devices)**
- 字段: id, merchantId, deviceName, deviceType, deviceId, location, status, lastHeartbeat, firmwareVersion
- 设备类型: ipad, android_tablet, pos_terminal
- 状态: online, offline, maintenance

#### 5. **订单表 (orders)**
- 字段: id, merchantId, deviceId, customerId, orderNumber, totalAmount, currency, status, paymentMethod, paymentStatus
- 订单状态: pending, processing, completed, failed, refunded, cancelled
- 支付状态: pending, authorized, captured, failed, refunded

#### 6. **订单项表 (orderItems)**
- 字段: id, orderId, productId, productName, quantity, unitPrice, totalPrice, currency

#### 7. **交易表 (transactions)**
- 字段: id, orderId, transactionId, paymentGateway, amount, currency, status, paymentMethod, errorMessage, metadata

#### 8. **检测事件表 (detectionEvents)**
- 字段: id, deviceId, orderId, eventType, productId, confidence, metadata
- 事件类型: hand_detected, item_approached, item_picked, item_put_back, checkout_triggered

#### 9. **审计日志表 (auditLogs)**
- 字段: id, userId, action, entityType, entityId, changes, ipAddress, userAgent

---

## 面部识别和钱包系统

### 面部识别表 (faceRecognition)
- 存储用户面部特征向量(faceEmbedding)
- 关联Stripe客户ID和支付方式
- 设置最大自动支付金额(maxPaymentAmount)
- 支持激活/停用状态

### 钱包表 (wallets)
- 支持两种类型:
  - **托管钱包 (custodial)**: 平台管理余额
  - **非托管钱包 (non_custodial)**: 用户自己管理区块链地址
- 余额以分为单位存储
- 支持多币种
- 钱包状态: active, frozen, closed

### 钱包交易表 (walletTransactions)
- 交易类型: deposit, withdraw, payment, refund, transfer
- 关联订单ID
- 状态追踪: pending, completed, failed, cancelled

### 手势识别表 (gestureEvents)
- 手势类型: pick_up, put_down, yes, no, hold
- 状态机: S0_waiting → S1_approaching → S2_picked → S3_checkout → S4_completed
- 存储置信度分数(0-100)
- 存储手部关键点数据(metadata)

### 设备商品关联表 (deviceProducts)
- 映射设备可访问的商品
- 支持显示顺序配置
- 激活/停用状态

---

## API路由设计

### 认证路由 (auth)
- `auth.me` - 获取当前用户信息
- `auth.logout` - 用户登出

### 商户路由 (merchants)
- `merchants.create` - 创建商户
- `merchants.getById` - 获取商户详情
- `merchants.getMyMerchants` - 获取我的商户列表
- `merchants.getAll` - 获取所有商户(仅管理员)
- `merchants.update` - 更新商户信息

### 商品路由 (products)
- `products.create` - 创建商品
- `products.getById` - 获取商品详情
- `products.getByMerchant` - 获取商户的商品列表
- `products.update` - 更新商品信息
- `products.delete` - 删除商品

### 设备路由 (devices)
- `devices.register` - 注册设备
- `devices.getById` - 获取设备详情
- `devices.getByMerchant` - 获取商户的设备列表
- `devices.update` - 更新设备信息
- `devices.heartbeat` - 设备心跳(保持在线状态)

### 订单路由 (orders)
- `orders.create` - 创建订单
- `orders.getById` - 获取订单详情
- `orders.getByMerchant` - 获取商户的订单列表
- `orders.update` - 更新订单状态

### 面部识别路由 (faceRecognition)
- `faceRecognition.register` - 注册面部特征
- `faceRecognition.verify` - 验证面部识别
- `faceRecognition.getByUser` - 获取用户面部识别信息
- `faceRecognition.update` - 更新面部识别设置
- `faceRecognition.delete` - 删除面部识别数据

### 钱包路由 (wallet)
- `wallet.create` - 创建钱包
- `wallet.getByUser` - 获取用户钱包列表
- `wallet.getBalance` - 获取钱包余额
- `wallet.deposit` - 充值
- `wallet.withdraw` - 提现
- `wallet.getTransactions` - 获取交易历史

### 手势识别路由 (gesture)
- `gesture.recordEvent` - 记录手势事件
- `gesture.getByDevice` - 获取设备的手势事件
- `gesture.processPayment` - 处理手势支付

### 设备商品路由 (deviceProduct)
- `deviceProduct.assign` - 分配商品到设备
- `deviceProduct.getByDevice` - 获取设备的商品列表
- `deviceProduct.update` - 更新设备商品配置
- `deviceProduct.remove` - 移除设备商品关联

### Stripe路由 (stripe)
- `stripe.createCheckoutSession` - 创建支付会话
- `stripe.handleWebhook` - 处理Webhook回调
- `stripe.getPaymentMethods` - 获取支付方式

### 管理员路由 (admin)
- `admin.users.getAll` - 获取所有用户
- `admin.users.getById` - 获取用户详情
- `admin.users.update` - 更新用户信息
- `admin.transactions.getAll` - 获取所有交易
- `admin.analytics.getDashboard` - 获取分析仪表板数据

---

## 权限控制

### 三级权限系统

1. **publicProcedure** - 公开接口(无需认证)
2. **protectedProcedure** - 需要登录
3. **merchantProcedure** - 需要商户或管理员角色
4. **adminProcedure** - 仅管理员可访问

### 实现方式
```typescript
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== 'admin') {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Admin access required' });
  }
  return next({ ctx });
});
```

---

## 核心功能实现状态

### ✅ 已完成
- 基础数据库Schema设计
- 商户/商品/设备/订单CRUD API
- Stripe支付集成
- 面部识别数据存储
- 钱包系统(托管/非托管)
- 手势识别事件记录
- 设备商品关联
- 审计日志系统
- 数据分析API

### 🚧 进行中
- 设备商品配置页面
- 客户端钱包注册页面
- 面部注册页面
- 支付手势注册页面

### ❌ 待实现
- 实时订单创建流程(手势触发)
- WebSocket订单状态推送
- 客户端账户管理系统
- 多因素认证(MFA)
- 异常交易告警
- 设备状态实时监控
- 高级数据分析Dashboard

---

## 技术亮点

### 1. **类型安全的API**
使用tRPC实现端到端类型安全,前后端共享类型定义,减少运行时错误。

### 2. **灵活的数据库抽象**
使用Drizzle ORM,提供类型安全的SQL查询构建器,同时保持SQL的灵活性。

### 3. **完善的审计系统**
所有关键操作都记录审计日志,包括用户ID、操作类型、实体类型、变更内容等。

### 4. **设备心跳机制**
设备定期发送心跳信号,更新lastHeartbeat和status,实现设备在线状态监控。

### 5. **价格精度处理**
所有金额以分(cents)为单位存储为整数,避免浮点数精度问题。

### 6. **状态机设计**
手势识别使用5状态状态机(S0-S4),清晰定义支付流程的各个阶段。

---

## 安全考虑

1. **角色权限控制**: 三级权限系统(user/merchant/admin)
2. **面部特征加密**: 存储加密的面部特征向量
3. **支付限额**: 设置maxPaymentAmount防止大额欺诈
4. **审计追踪**: 完整的操作日志记录
5. **设备认证**: 唯一设备ID验证
6. **Webhook验证**: Stripe Webhook签名验证

---

## 性能优化建议

1. **数据库索引**: 为常用查询字段添加索引(merchantId, deviceId, userId等)
2. **查询优化**: 使用limit限制返回数据量
3. **缓存策略**: 对商品信息、设备配置等静态数据添加缓存
4. **批量操作**: 订单项创建使用批量插入
5. **连接池**: 配置数据库连接池参数

---

## 待完善的功能

### 高优先级 ⭐⭐⭐⭐⭐

1. **实时订单创建流程**
   - 手势触发自动创建订单
   - 钱包自动扣款
   - 订单失败回滚机制

2. **WebSocket集成**
   - 实时订单状态推送
   - 设备状态实时同步
   - 交易通知

3. **客户端账户系统**
   - 用户注册/登录
   - 个人资料管理
   - 支付方式管理
   - 订单历史查看

4. **面部识别集成**
   - 前端面部注册页面
   - 设备端面部识别
   - 安全设置(重新注册、删除数据)

5. **手势支付流程**
   - 手势注册页面
   - 手势与订单创建集成
   - 超时取消机制

### 中优先级 ⭐⭐⭐

1. **设备配置页面**
   - 设备商品关联管理
   - 设备权限配置
   - 设备日志查看

2. **高级分析功能**
   - 用户行为分析
   - 销售趋势预测
   - 商品销售排行
   - 自定义报表

3. **异常监控**
   - 异常交易告警
   - 设备离线告警
   - 支付失败分析

### 低优先级 ⭐⭐

1. **技术债务**
   - 错误日志系统
   - API限流
   - 数据备份机制
   - 性能监控

---

## 部署建议

### 环境变量配置
```env
DATABASE_URL=mysql://user:password@host:port/database
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
S3_BUCKET_NAME=...
JWT_SECRET=...
```

### 数据库迁移
```bash
pnpm run db:push
```

### 生产部署
```bash
pnpm run build
pnpm run start
```

---

## 总结

SSP项目的后端代码结构清晰,功能模块划分合理。核心的商户管理、商品管理、订单处理、支付集成等功能已经完成。面部识别和钱包系统的数据层已经实现,但前端界面和完整的业务流程还需要进一步开发。

**主要优势:**
- 类型安全的API设计
- 完善的数据库Schema
- 清晰的权限控制
- 良好的代码组织

**需要改进:**
- 完成实时订单创建流程
- 实现WebSocket推送
- 开发客户端账户系统
- 完善面部识别和手势支付的前端界面
- 添加监控和告警系统

该项目具有很好的技术基础,完成待办功能后将成为一个功能完整的智能零售支付解决方案。
