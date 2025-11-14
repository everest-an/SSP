# SSP - Smart Store Payment

智能零售支付系统 - 基于计算机视觉和生物识别技术的无接触支付解决方案

## 项目简介

SSP (Smart Store Payment) 是一个创新的智能零售支付系统,通过面部识别和手势识别技术,实现真正的无接触购物体验。用户只需拿起商品,系统自动识别面部并通过手势确认支付,无需掏出手机或钱包。

### 核心功能

#### 支付体验
- 🎭 **面部识别支付** - 通过面部特征识别用户身份并完成支付
- 👋 **手势识别确认** - 使用手势(拿起/放下/点赞)确认购买意图
- 💳 **多种支付方式** - 支持Stripe支付、托管钱包、非托管钱包、MetaMask
- ⚡ **实时订单处理** - WebSocket实时推送订单状态更新

#### 商户管理
- 🏪 **商户管理系统** - 完整的商户、商品、设备管理功能
- 📦 **设备商品配置** - 灵活配置每个设备可售商品
- 📊 **数据分析仪表板** - 实时销售数据、订单统计、收入分析
- 💰 **钱包管理** - 托管/非托管钱包、余额图表、交易历史

#### 安全与监控
- 🔐 **多层安全防护** - 多层权限控制、审计日志、支付限额保护
- 🚨 **异常交易告警** - 10种预设规则监测可疑交易(金额、地点、生物识别、行为、环境)
- 🔒 **多级处理机制** - 通知/提醒/警告/锁定,重大事项需APP解锁
- 📱 **实时通知中心** - WebSocket实时推送,分类管理所有通知

#### 用户体验
- 👤 **完整认证流程** - 面部识别登录、邮箱密码登录、钱包连接
- 📱 **用户资料管理** - 个人信息、头像、安全设置、2FA
- 🎨 **现代化UI** - 暗色主题、iOS磨砂风格、流畅动画

## 技术栈

### 后端
- **框架**: Express.js + tRPC
- **数据库**: MySQL + Drizzle ORM
- **认证**: JWT (jose)
- **支付**: Stripe
- **AI/ML**: MediaPipe (面部识别、手势识别)
- **存储**: AWS S3

### 前端
- **框架**: React 19
- **构建工具**: Vite
- **样式**: TailwindCSS
- **UI组件**: Radix UI + shadcn/ui
- **状态管理**: TanStack Query
- **路由**: Wouter
- **图表**: Recharts

## 快速开始

### 环境要求

- Node.js 22+
- MySQL 8.0+
- pnpm 10+

### 安装依赖

```bash
pnpm install
```

### 环境变量配置

创建 `.env` 文件并配置以下环境变量:

```env
# 数据库配置
DATABASE_URL=mysql://user:password@localhost:3306/ssp

# Stripe配置
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# AWS S3配置
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
S3_BUCKET_NAME=...
S3_REGION=us-east-1

# JWT密钥
JWT_SECRET=your-secret-key

# 管理员OpenID
OWNER_OPEN_ID=your-admin-openid
```

### 数据库迁移

```bash
pnpm run db:push
```

### 开发模式

```bash
pnpm run dev
```

访问 http://localhost:5000

### 生产构建

```bash
pnpm run build
pnpm run start
```

## 项目结构

```
ssp-web/
├── client/                 # 前端代码
│   ├── src/
│   │   ├── components/    # React组件
│   │   ├── pages/         # 页面组件
│   │   ├── lib/           # 工具函数
│   │   └── hooks/         # 自定义Hooks
│   └── public/            # 静态资源
├── server/                # 后端代码
│   ├── _core/            # 核心基础设施
│   ├── db.ts             # 数据库操作
│   ├── routers.ts        # API路由
│   ├── stripe.ts         # Stripe集成
│   ├── faceAndWalletDb.ts      # 面部识别和钱包
│   ├── faceAndWalletRouters.ts # 面部识别和钱包路由
│   ├── adminDb.ts        # 管理员数据库操作
│   └── adminRouters.ts   # 管理员路由
├── drizzle/              # 数据库Schema和迁移
│   ├── schema.ts         # 主Schema
│   └── face-recognition-schema.ts  # 面部识别Schema
├── shared/               # 前后端共享代码
│   ├── types.ts          # 类型定义
│   └── const.ts          # 常量
└── package.json
```

## 核心功能模块

### 1. 商户管理
- 商户注册和认证
- 商户信息管理
- 商户数据统计

### 2. 商品管理
- 商品CRUD操作
- 商品分类管理
- 库存管理
- 商品图片上传

### 3. 设备管理
- 设备注册和配置
- 设备状态监控
- 设备心跳机制
- 设备商品关联

### 4. 订单处理
- 订单创建和管理
- 订单状态追踪
- 订单项管理
- 订单历史查询

### 5. 支付集成
- Stripe支付网关
- 支付会话创建
- Webhook回调处理
- 支付方式管理

### 6. 面部识别
- 面部特征注册
- 面部识别验证
- 与支付方式绑定
- 安全设置管理

### 7. 钱包系统
- 托管钱包(平台管理)
- 非托管钱包(区块链)
- 钱包充值/提现
- 交易历史记录

### 8. 手势识别
- 手部追踪
- 手势识别(拿起/放下/确认)
- 状态机管理(5状态)
- 支付确认流程

### 9. 数据分析
- 销售数据统计
- 收入趋势分析
- 订单状态分布
- 商品销售排行

### 10. 管理员后台
- 用户管理
- 商户管理
- 交易监控
- 系统配置

## API文档

### 认证相关
- `POST /api/auth/login` - 用户登录
- `POST /api/auth/logout` - 用户登出
- `GET /api/auth/me` - 获取当前用户信息

### 商户相关
- `POST /api/merchants` - 创建商户
- `GET /api/merchants/:id` - 获取商户详情
- `PUT /api/merchants/:id` - 更新商户信息
- `GET /api/merchants` - 获取商户列表

### 商品相关
- `POST /api/products` - 创建商品
- `GET /api/products/:id` - 获取商品详情
- `PUT /api/products/:id` - 更新商品信息
- `DELETE /api/products/:id` - 删除商品
- `GET /api/products/merchant/:merchantId` - 获取商户商品列表

### 设备相关
- `POST /api/devices` - 注册设备
- `GET /api/devices/:id` - 获取设备详情
- `PUT /api/devices/:id` - 更新设备信息
- `POST /api/devices/heartbeat` - 设备心跳

### 订单相关
- `POST /api/orders` - 创建订单
- `GET /api/orders/:id` - 获取订单详情
- `PUT /api/orders/:id` - 更新订单状态
- `GET /api/orders/merchant/:merchantId` - 获取商户订单列表

### 面部识别相关
- `POST /api/face-recognition/register` - 注册面部特征
- `POST /api/face-recognition/verify` - 验证面部识别
- `GET /api/face-recognition/user/:userId` - 获取用户面部识别信息
- `DELETE /api/face-recognition/:id` - 删除面部识别数据

### 钱包相关
- `POST /api/wallet` - 创建钱包
- `GET /api/wallet/user/:userId` - 获取用户钱包
- `POST /api/wallet/deposit` - 充值
- `POST /api/wallet/withdraw` - 提现
- `GET /api/wallet/transactions` - 获取交易历史

## 数据库Schema

### 核心表
- `users` - 用户表
- `merchants` - 商户表
- `products` - 商品表
- `devices` - 设备表
- `orders` - 订单表
- `orderItems` - 订单项表
- `transactions` - 交易表
- `auditLogs` - 审计日志表

### 扩展表
- `faceRecognition` - 面部识别表
- `wallets` - 钱包表
- `walletTransactions` - 钱包交易表
- `gestureEvents` - 手势事件表
- `deviceProducts` - 设备商品关联表
- `detectionEvents` - 检测事件表
- `analytics` - 分析数据表

## 开发进度

### ✅ 已完成
- [x] 数据库Schema设计
- [x] 基础API实现
- [x] 商户管理功能
- [x] 商品管理功能
- [x] 设备管理功能
- [x] 订单处理功能
- [x] Stripe支付集成
- [x] 面部识别数据层
- [x] 钱包系统数据层
- [x] 手势识别数据层
- [x] 数据分析仪表板
- [x] 管理员后台基础功能

### 🚧 进行中
- [ ] 实时订单创建流程
- [ ] 面部识别前端界面
- [ ] 手势支付前端界面
- [ ] 客户端账户系统
- [ ] WebSocket实时推送

### 📋 待开发
- [ ] 设备商品配置页面
- [ ] 高级数据分析功能
- [ ] 异常交易告警
- [ ] 多因素认证(MFA)
- [ ] 移动端适配
- [ ] 国际化支持

## 安全性

- **角色权限控制**: 三级权限系统(user/merchant/admin)
- **数据加密**: 面部特征数据加密存储
- **支付限额**: 设置最大自动支付金额
- **审计追踪**: 完整的操作日志记录
- **设备认证**: 唯一设备ID验证
- **Webhook验证**: Stripe Webhook签名验证
- **HTTPS**: 生产环境强制HTTPS
- **CORS**: 配置跨域资源共享策略

## 性能优化

- **数据库索引**: 为常用查询字段添加索引
- **查询优化**: 使用limit限制返回数据量
- **连接池**: 配置数据库连接池
- **缓存策略**: 对静态数据添加缓存
- **CDN**: 静态资源使用CDN加速
- **代码分割**: 前端代码按需加载
- **图片优化**: 图片压缩和懒加载

## 部署

### Docker部署

```bash
docker build -t ssp-web .
docker run -p 5000:5000 --env-file .env ssp-web
```

### 云平台部署

支持部署到:
- AWS (EC2, ECS, Lambda)
- Google Cloud Platform
- Azure
- Vercel
- Railway
- Render

## 贡献指南

欢迎贡献代码!请遵循以下步骤:

1. Fork本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启Pull Request

## 代码规范

- 使用TypeScript编写代码
- 遵循ESLint和Prettier配置
- 编写单元测试
- 添加必要的注释
- 更新相关文档

## 测试

```bash
# 运行测试
pnpm run test

# 类型检查
pnpm run check

# 代码格式化
pnpm run format
```

## 许可证

本项目采用 MIT 许可证 - 详见 [LICENSE](LICENSE) 文件

## 联系方式

- 项目主页: https://github.com/everest-an/SSP
- 问题反馈: https://github.com/everest-an/SSP/issues
- 演示地址: https://ssppayweb-c5dj9eyx.manus.space/

## 致谢

- [MediaPipe](https://mediapipe.dev/) - 提供面部识别和手势识别能力
- [Stripe](https://stripe.com/) - 提供支付网关服务
- [Drizzle ORM](https://orm.drizzle.team/) - 提供类型安全的数据库操作
- [tRPC](https://trpc.io/) - 提供端到端类型安全的API
- [shadcn/ui](https://ui.shadcn.com/) - 提供优秀的UI组件

---

**注意**: 本项目仍在开发中,部分功能可能尚未完全实现。生产环境使用前请进行充分测试。
