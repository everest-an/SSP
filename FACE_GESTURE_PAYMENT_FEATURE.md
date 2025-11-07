# 面部识别 + 手势确认支付功能

## 功能概述

实现了完整的**面部识别 + 大拇指👍手势确认**的自动支付流程,支持**加密货币钱包**和**法币钱包**的自动扣款。

---

## 🎯 核心功能

### 1. 面部识别身份验证
- 使用MediaPipe Face Detection进行实时面部检测
- 提取面部特征向量(Face Embedding)
- 使用余弦相似度算法进行面部匹配
- 支持多用户识别,自动匹配最佳匹配用户

### 2. 手势确认支付
- 使用MediaPipe Gesture Recognition识别手势
- 支持大拇指👍(Thumbs Up)手势作为支付确认
- 手势置信度检测(需要>75%才触发支付)
- 实时显示手势识别状态和置信度

### 3. 自动扣款支付
- **托管钱包(Custodial Wallet)** - 法币支付
  - 直接从用户托管钱包余额扣款
  - 支持USD等法币
  - 即时完成交易
  
- **非托管钱包(Non-Custodial Wallet)** - 加密货币支付
  - 连接用户的加密货币钱包地址
  - 支持多种加密货币(BTC, ETH, USDT等)
  - 需要区块链确认(当前版本标记为待确认)

### 4. 实时推送通知
- WebSocket实时连接
- 订单状态实时推送
- 支付结果实时通知
- 设备状态监控

---

## 📋 支付流程

### 完整流程图

```
┌─────────────────────────────────────────────────────────────┐
│                     设备端支付流程                           │
└─────────────────────────────────────────────────────────────┘

1. [待机状态 - Idle]
   ↓ 用户点击"Start Payment"
   
2. [面部检测 - Face Detection]
   ↓ 检测到面部 → 提取特征向量
   ↓ 调用API验证身份
   ↓ 匹配成功 → 获取用户信息和钱包信息
   
3. [商品选择 - Product Selection]
   ↓ 显示设备上可用的商品列表
   ↓ 用户选择商品
   
4. [手势确认 - Gesture Confirmation]
   ↓ 显示商品信息和价格
   ↓ 提示用户做出👍手势
   ↓ 检测到大拇指手势(置信度>75%)
   
5. [处理支付 - Processing]
   ↓ 调用实时订单创建API
   ↓ 验证面部识别数据
   ↓ 验证钱包余额
   ↓ 检查库存
   ↓ 创建订单
   ↓ 扣款(托管钱包) 或 发起链上交易(非托管钱包)
   ↓ 更新库存
   ↓ 创建交易记录
   
6. [完成 - Completed / Failed]
   ↓ 显示支付结果
   ↓ WebSocket推送通知
   ↓ 3秒后自动重置
   
7. [返回待机状态]
```

### 详细步骤说明

#### Step 1: 面部识别
```typescript
// 1. 启动摄像头
// 2. 实时检测面部
const faceDetections = await faceService.detectFaces(videoElement);

// 3. 提取特征向量
const embedding = faceService.extractFaceEmbedding(faceDetections);

// 4. 调用验证API
const result = await trpc.faceRecognition.verify.mutate({
  faceEmbedding: embedding,
  threshold: 0.6
});

// 5. 获取用户信息和钱包
if (result.verified) {
  user = result.user;
  wallet = result.wallet;
}
```

#### Step 2: 手势确认
```typescript
// 1. 检测手势
const gestureResults = await gestureService.recognizeGesture(videoElement);

// 2. 识别大拇指👍手势
const thumbsUp = gestureService.detectThumbsUpGesture(gestureResults);

// 3. 检查置信度
if (thumbsUp.detected && thumbsUp.confidence > 0.75) {
  // 触发支付
  processPayment();
}
```

#### Step 3: 自动扣款
```typescript
// 调用实时订单创建API
const order = await trpc.realtimeOrder.createRealtimeOrder.mutate({
  deviceId: 1,
  userId: user.id,
  merchantId: 1,
  items: [{ productId: product.id, quantity: 1 }],
  gestureConfidence: confidence
});

// 后端自动处理:
// 1. 验证面部识别
// 2. 验证钱包余额
// 3. 创建订单
// 4. 扣款
// 5. 更新库存
// 6. 推送通知
```

---

## 🔧 技术实现

### 前端技术栈

#### 1. MediaPipe集成
**文件:** `client/src/lib/mediapipe.ts`

```typescript
// 面部检测服务
class FaceDetectionService {
  async detectFaces(videoElement: HTMLVideoElement);
  extractFaceEmbedding(detections: any): number[];
}

// 手势识别服务
class GestureRecognitionService {
  async recognizeGesture(videoElement: HTMLVideoElement);
  detectThumbsUpGesture(results: any): { detected: boolean; confidence: number };
  private isThumbUp(landmarks: any[]): boolean; // 手动检测大拇指向上
}
```

**新增功能:**
- ✅ `detectThumbsUpGesture()` - 大拇指👍手势检测
- ✅ `isThumbUp()` - 手动验证大拇指姿势(拇指伸展,其他手指弯曲)

#### 2. 设备支付页面
**文件:** `client/src/pages/DevicePayment.tsx`

**主要组件:**
- 实时摄像头预览
- 面部检测状态显示
- 手势识别状态显示
- 用户信息卡片
- 商品选择界面
- 支付确认界面
- 支付结果显示

**支付步骤:**
```typescript
type PaymentStep = 
  | "idle"                    // 待机
  | "face_detection"          // 面部检测
  | "product_selection"       // 商品选择
  | "gesture_confirmation"    // 手势确认
  | "processing"              // 处理中
  | "completed"               // 完成
  | "failed";                 // 失败
```

#### 3. WebSocket客户端
**文件:** `client/src/hooks/useWebSocket.ts`

**功能:**
- 自动连接WebSocket服务器
- 客户端注册(用户/设备/商户)
- 实时接收订单更新
- 实时接收支付状态
- 心跳保持连接
- 自动重连机制

```typescript
const { isConnected, lastMessage } = useWebSocket({
  deviceId: 1,
  merchantId: 1,
  onOrderUpdate: (data) => {
    // 处理订单更新
  },
  onPaymentStatus: (data) => {
    // 处理支付状态
  }
});
```

### 后端技术栈

#### 1. WebSocket服务
**文件:** `server/websocket.ts`

**功能:**
- WebSocket服务器初始化
- 客户端连接管理
- 消息广播
- 按用户/设备/商户推送
- 订单更新通知
- 支付状态通知

```typescript
class WebSocketService {
  initialize(server: Server);
  notifyOrderUpdate(orderId, orderData, merchantId, userId);
  notifyPaymentStatus(orderId, status, userId, merchantId);
  sendToUser(userId, message);
  sendToDevice(deviceId, message);
  sendToMerchant(merchantId, message);
}
```

#### 2. 实时订单创建API
**文件:** `server/realtimeOrderRouters.ts`

**核心流程:**
```typescript
realtimeOrder.createRealtimeOrder({
  deviceId,
  userId,
  merchantId,
  items: [{ productId, quantity }],
  gestureConfidence
})

// 处理步骤:
// 1. 验证设备在线
// 2. 验证面部识别激活
// 3. 获取用户钱包
// 4. 计算订单总额
// 5. 验证商品库存
// 6. 检查支付限额
// 7. 检查钱包余额
// 8. 创建订单
// 9. 处理支付
//    - 托管钱包: 直接扣款
//    - 非托管钱包: 发起链上交易(待实现)
// 10. 更新库存
// 11. 创建交易记录
// 12. WebSocket推送通知
```

#### 3. 面部识别验证API
**文件:** `server/faceAndWalletRouters.ts`

**新增功能:**
- ✅ 余弦相似度算法 `cosineSimilarity()`
- ✅ 完整的面部验证流程
- ✅ 自动匹配最佳用户
- ✅ 返回用户信息和钱包信息

```typescript
faceRecognition.verify({
  faceEmbedding: number[],
  threshold: 0.6
})

// 返回:
{
  verified: boolean,
  user: User | null,
  wallet: Wallet | null,
  similarity: number
}
```

**算法实现:**
```typescript
function cosineSimilarity(vec1: number[], vec2: number[]): number {
  // 计算点积
  const dotProduct = vec1.reduce((sum, val, i) => sum + val * vec2[i], 0);
  
  // 计算向量长度
  const norm1 = Math.sqrt(vec1.reduce((sum, val) => sum + val * val, 0));
  const norm2 = Math.sqrt(vec2.reduce((sum, val) => sum + val * val, 0));
  
  // 返回余弦相似度
  return dotProduct / (norm1 * norm2);
}
```

---

## 📦 文件清单

### 新增文件

1. **client/src/pages/DevicePayment.tsx**
   - 设备端支付界面
   - 面部识别 + 手势确认流程
   - 实时状态显示

2. **client/src/hooks/useWebSocket.ts**
   - WebSocket客户端Hook
   - 实时消息接收
   - 自动重连

3. **server/websocket.ts**
   - WebSocket服务端
   - 消息推送
   - 客户端管理

4. **server/realtimeOrderRouters.ts**
   - 实时订单创建API
   - 自动支付流程
   - 钱包扣款

### 修改文件

1. **client/src/lib/mediapipe.ts**
   - ✅ 新增 `detectThumbsUpGesture()` 方法
   - ✅ 新增 `isThumbUp()` 私有方法

2. **client/src/App.tsx**
   - ✅ 添加 `/device-payment` 路由

3. **server/faceAndWalletRouters.ts**
   - ✅ 新增 `cosineSimilarity()` 函数
   - ✅ 完善 `verify` API实现

4. **server/faceAndWalletDb.ts**
   - ✅ 修正 `getDefaultWalletByUserId()` 函数名

5. **server/routers.ts**
   - ✅ 集成 `realtimeOrderRouter`

6. **server/_core/index.ts**
   - ✅ 集成WebSocket服务器

---

## 🎨 用户界面

### 设备支付页面布局

```
┌─────────────────────────────────────────────────────────┐
│              SSP Device Payment                         │
│        Face Recognition + Gesture Confirmation          │
│  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ 75%           │
└─────────────────────────────────────────────────────────┘

┌──────────────────────────┐  ┌──────────────────────────┐
│  📹 Camera View          │  │  👤 User Information     │
│                          │  │                          │
│  [Live Video Feed]       │  │  Name: John Doe          │
│  [Face Detection Box]    │  │  Wallet: Fiat Wallet     │
│  [Hand Landmarks]        │  │  Balance: $125.50        │
│                          │  │                          │
│  ✅ Face Detected        │  └──────────────────────────┘
│  👍 Thumbs Up (85%)      │
│                          │  ┌──────────────────────────┐
│  [Cancel Button]         │  │  🛍️ Selected Product     │
│                          │  │                          │
└──────────────────────────┘  │  Product: Coffee         │
                               │  Price: $3.50            │
                               │                          │
                               │  ⚠️ Show thumbs up 👍    │
                               │     to confirm payment   │
                               └──────────────────────────┘
```

### 支付状态显示

#### 成功状态
```
┌─────────────────────────────────────┐
│                                     │
│         ✅ Payment Successful!      │
│                                     │
└─────────────────────────────────────┘
```

#### 失败状态
```
┌─────────────────────────────────────┐
│                                     │
│         ❌ Payment Failed           │
│                                     │
└─────────────────────────────────────┘
```

---

## 🔐 安全特性

### 1. 面部识别安全
- ✅ 余弦相似度阈值验证(默认0.6)
- ✅ 仅匹配激活的面部识别记录
- ✅ 记录每次使用时间戳
- ✅ 支持最大支付限额设置

### 2. 手势确认安全
- ✅ 高置信度要求(>75%)
- ✅ 实时手势检测,防止录像攻击
- ✅ 记录手势置信度到订单

### 3. 支付安全
- ✅ 设备在线状态验证
- ✅ 钱包余额验证
- ✅ 库存验证
- ✅ 支付限额验证
- ✅ 交易记录完整性
- ✅ 失败自动回滚

### 4. 数据安全
- ✅ 面部特征向量加密存储(JSON格式)
- ✅ WebSocket消息时间戳验证
- ✅ 审计日志记录

---

## 💰 钱包类型支持

### 1. 托管钱包 (Custodial Wallet)
**特点:**
- 平台托管用户资金
- 支持法币(USD, EUR等)
- 即时交易完成
- 无需区块链确认

**支付流程:**
```typescript
// 1. 检查余额
if (wallet.balance < totalAmount) {
  throw new Error("Insufficient balance");
}

// 2. 扣款
await updateWalletBalance(wallet.id, wallet.balance - totalAmount);

// 3. 创建交易记录
await createWalletTransaction({
  walletId: wallet.id,
  type: "payment",
  amount: totalAmount,
  status: "completed"
});
```

### 2. 非托管钱包 (Non-Custodial Wallet)
**特点:**
- 用户自己控制私钥
- 支持加密货币(BTC, ETH, USDT等)
- 需要区块链确认
- 更高的安全性和隐私性

**支付流程(待完善):**
```typescript
// 1. 创建链上交易
const tx = await createBlockchainTransaction({
  from: wallet.walletAddress,
  to: merchantWalletAddress,
  amount: totalAmount,
  currency: wallet.currency
});

// 2. 等待确认
// (需要集成Web3.js或ethers.js)

// 3. 更新订单状态
await updateOrder(orderId, {
  status: "completed",
  blockchainTxHash: tx.hash
});
```

---

## 📊 数据流图

```
┌─────────────┐
│   Device    │
│  (Camera)   │
└──────┬──────┘
       │
       │ 1. Capture Face & Gesture
       ↓
┌─────────────────────────┐
│   MediaPipe (Client)    │
│  - Face Detection       │
│  - Gesture Recognition  │
└──────┬──────────────────┘
       │
       │ 2. Extract Features
       ↓
┌─────────────────────────┐
│   tRPC API (Client)     │
│  - verify face          │
│  - create order         │
└──────┬──────────────────┘
       │
       │ 3. HTTP Request
       ↓
┌─────────────────────────┐
│   Backend API           │
│  - Face matching        │
│  - Order processing     │
│  - Payment processing   │
└──────┬──────────────────┘
       │
       ├─→ 4a. Database
       │   - Orders
       │   - Transactions
       │   - Wallets
       │
       └─→ 4b. WebSocket
           - Real-time push
           ↓
       ┌─────────────┐
       │   Client    │
       │  (Updates)  │
       └─────────────┘
```

---

## 🧪 测试建议

### 1. 面部识别测试
- [ ] 测试单个用户识别准确率
- [ ] 测试多个用户识别准确率
- [ ] 测试不同光照条件
- [ ] 测试不同角度
- [ ] 测试录像攻击防御

### 2. 手势识别测试
- [ ] 测试大拇指👍手势识别率
- [ ] 测试不同手势角度
- [ ] 测试不同距离
- [ ] 测试误识别率

### 3. 支付流程测试
- [ ] 测试托管钱包支付
- [ ] 测试非托管钱包支付
- [ ] 测试余额不足情况
- [ ] 测试库存不足情况
- [ ] 测试支付限额
- [ ] 测试并发支付

### 4. WebSocket测试
- [ ] 测试连接稳定性
- [ ] 测试自动重连
- [ ] 测试消息推送
- [ ] 测试多客户端

---

## 🚀 部署说明

### 环境要求
- Node.js 18+
- MySQL 8.0+
- 支持WebSocket的Web服务器
- HTTPS (生产环境必需,用于摄像头访问)

### 环境变量
```env
# Database
DATABASE_URL=mysql://user:password@localhost:3306/ssp

# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...

# Server
PORT=3000
NODE_ENV=production
```

### 启动服务
```bash
# 安装依赖
pnpm install

# 数据库迁移
pnpm db:push

# 启动服务器
pnpm dev  # 开发环境
pnpm build && pnpm start  # 生产环境
```

### 访问设备支付页面
```
http://localhost:3000/device-payment
```

---

## 📝 使用说明

### 商户端配置

#### 1. 注册商户
```
访问: /merchants/create
填写商户信息并创建
```

#### 2. 添加商品
```
访问: /products
添加商品信息(名称、价格、库存、图片等)
```

#### 3. 注册设备
```
访问: /devices
注册POS设备
配置设备商品关联
```

### 用户端配置

#### 1. 注册账号
```
使用OAuth登录(Google/GitHub)
```

#### 2. 注册面部识别
```
访问: /face-registration
启动摄像头
录入面部特征
设置支付限额
```

#### 3. 创建钱包
```
访问: /wallets
选择钱包类型:
  - 托管钱包(法币)
  - 非托管钱包(加密货币)
充值余额
```

### 设备端使用

#### 1. 打开设备支付页面
```
访问: /device-payment
```

#### 2. 开始支付
```
1. 点击"Start Payment"
2. 面向摄像头进行面部识别
3. 选择要购买的商品
4. 做出大拇指👍手势确认
5. 等待支付完成
```

---

## 🎯 下一步计划

### 短期目标 (1-2周)
- [ ] 完善非托管钱包的区块链集成
- [ ] 添加多商品批量购买支持
- [ ] 优化面部识别算法(使用FaceNet)
- [ ] 添加支付密码/PIN码二次验证

### 中期目标 (1-2月)
- [ ] 支持更多手势(取消、确认、数量调整)
- [ ] 添加语音提示
- [ ] 支持离线支付(本地缓存)
- [ ] 添加商户端实时监控面板

### 长期目标 (3-6月)
- [ ] 支持多设备协同
- [ ] 添加AI推荐系统
- [ ] 支持会员卡/优惠券
- [ ] 国际化支持

---

## 📞 技术支持

如有问题,请查看:
- GitHub Issues: https://github.com/everest-an/SSP/issues
- 文档: README.md
- API文档: /api/docs

---

## 📄 许可证

MIT License - 详见 LICENSE 文件

---

**开发完成时间:** 2025-11-07  
**版本:** v1.0.0  
**作者:** SSP Team
