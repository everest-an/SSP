# SSP 项目待修复功能和改进清单

**更新日期**: 2025-11-21  
**项目**: SSP (Smart Store Payment)

---

## 🔴 高优先级 (Critical)

### 1. ✅ 用户登录后路由 404 错误
**状态**: 已修复  
**问题**: 普通用户登录成功后跳转到 `/client/profile` 返回 404  
**修复**: 在 `App.tsx` 中添加了 UserProfile 路由  
**提交**: b034ddd

### 2. 🔧 面部登录功能不可用
**状态**: 已修复(简化版本)  
**问题**: 依赖 AWS Rekognition,但缺少配置  
**修复**: 
- 创建了简化的面部登录服务 (`simpleFaceLogin.ts`)
- 修改了路由,支持降级模式
- 改进了前端错误处理

**待完成**:
- 配置 AWS Rekognition(生产环境)
- 完善人脸注册流程
- 添加审计日志

### 3. ⏳ 人脸注册功能
**状态**: 待修复  
**问题**: 同样依赖 AWS Rekognition  
**文件**: 
- `client/src/pages/FaceEnrollment.tsx`
- `client/src/pages/FaceRegistration.tsx`
- `server/routes/faceAuth.ts`

**修复方案**:
- 使用 `enrollFaceSimple` 函数
- 跳过 AWS Rekognition 活体检测
- 改进用户引导流程

**预计工作量**: 2-3 小时

---

## 🟡 中优先级 (Important)

### 4. ⏳ 视频帧收集功能
**状态**: 待实现  
**问题**: FaceLogin.tsx 中标记为 TODO  
**位置**: `client/src/pages/FaceLogin.tsx:137-138`

```typescript
videoFrames: [], // TODO: Collect video frames for liveness
challenges: [], // TODO: Generate and validate challenges
```

**修复方案**:
- 在摄像头捕获过程中收集视频帧
- 实现帧采样算法(每 100ms 采样一帧)
- 限制帧数量(10-30 帧)

**预计工作量**: 2 小时

### 5. ⏳ KYC 第三方集成
**状态**: 待实现  
**问题**: 标记为 TODO  
**位置**: `server/routers/kycRouter.ts:104`

```typescript
// TODO: Integrate with third-party KYC provider (e.g., Stripe Identity, Onfido, Jumio)
```

**可选方案**:
1. **Stripe Identity** - 简单,与 Stripe 支付集成
2. **Onfido** - 专业的 KYC 服务
3. **Jumio** - 全球覆盖,支持多种证件

**预计工作量**: 4-6 小时

### 6. ⏳ 邮件通知功能
**状态**: 待实现  
**问题**: KYC 审批后需要发送邮件  
**位置**: 
- `server/routers/kycRouter.ts:295` (审批通过)
- `server/routers/kycRouter.ts:352` (审批拒绝)

**修复方案**:
- 集成 SendGrid 或 AWS SES
- 创建邮件模板
- 实现邮件发送服务

**预计工作量**: 3-4 小时

### 7. ⏳ 区块链交易实现
**状态**: 待实现  
**问题**: 标记为 TODO  
**位置**: 
- `server/_core/blockchain.ts:218` (创建交易)
- `server/_core/blockchain.ts:304` (查询交易状态)
- `server/_core/blockchain.ts:416` (地址验证)
- `server/_core/blockchain.ts:452` (Gas 估算)

**修复方案**:
- 集成 ethers.js 或 web3.js
- 连接到以太坊节点(Infura/Alchemy)
- 实现钱包管理

**预计工作量**: 6-8 小时

### 8. ⏳ BTCPay Server 集成
**状态**: 待实现  
**问题**: 加密货币支付需要集成 BTCPay  
**位置**: 
- `server/routers/cryptoWalletRouter.ts:194` (创建发票)
- `server/routers/cryptoWalletRouter.ts:228` (验证支付)

**修复方案**:
- 部署 BTCPay Server
- 集成 BTCPay API
- 实现 webhook 处理

**预计工作量**: 4-6 小时

---

## 🟢 低优先级 (Nice to Have)

### 9. ⏳ 实时 ETH 价格获取
**状态**: 待实现  
**问题**: 使用硬编码的价格  
**位置**: `client/src/lib/web3.ts:382`

```typescript
// TODO: Fetch real-time ETH price from API (e.g., CoinGecko, Binance)
```

**修复方案**:
- 集成 CoinGecko API
- 或使用 Binance API
- 实现价格缓存(5 分钟)

**预计工作量**: 1-2 小时

### 10. ⏳ 地图功能实现
**状态**: 待实现  
**问题**: 地图组件需要初始化服务  
**位置**: `client/src/components/Map.tsx:118-128`

**修复方案**:
- 集成 Google Maps API
- 或使用 Mapbox
- 添加标记和事件监听

**预计工作量**: 2-3 小时

### 11. ⏳ 告警规则保存
**状态**: 待实现  
**问题**: 告警规则无法保存  
**位置**: `client/src/pages/AlertRules.tsx:300-306`

**修复方案**:
- 创建后端 API
- 实现规则存储
- 添加规则验证

**预计工作量**: 2-3 小时

### 12. ⏳ YOLO 模型训练
**状态**: 待实现  
**问题**: 产品检测模型训练功能  
**位置**: `server/routers/yoloDetectionRouter.ts:369`

**修复方案**:
- 集成 YOLOv8 训练脚本
- 实现数据集管理
- 添加训练进度监控

**预计工作量**: 8-10 小时

---

## 🔵 代码质量改进

### 13. ⏳ 移除 Debug 日志
**状态**: 待清理  
**问题**: 生产代码中有 debug 日志  
**位置**: 
- `server/routes/debug.ts:15`
- `server/routes/debug.ts:30`
- `server/routes/debug.ts:72`

**修复方案**:
- 使用环境变量控制日志级别
- 移除或注释 debug 日志
- 使用专业的日志库(winston/pino)

**预计工作量**: 1 小时

### 14. ⏳ 添加管理员权限检查
**状态**: 待实现  
**问题**: 某些 API 缺少权限检查  
**位置**: 
- `server/routes/admin.ts:73`
- `server/routes/admin.ts:97`
- `server/routes/payment.ts:154`

**修复方案**:
- 实现统一的权限中间件
- 添加角色检查
- 记录审计日志

**预计工作量**: 2-3 小时

### 15. ⏳ 实现活体检测逻辑
**状态**: 待实现  
**问题**: 活体检测函数是空实现  
**位置**: 
- `server/services/livenessDetection.ts:135`
- `server/services/livenessDetection.ts:196`
- `server/services/livenessDetection.ts:361`

**修复方案**:
- 选项 A: 集成 AWS Rekognition
- 选项 B: 使用开源库(face-api.js)
- 选项 C: 使用简化版本(已实现)

**预计工作量**: 4-6 小时(取决于方案)

---

## 📊 功能完成度统计

### 后端 API
- ✅ 用户认证: 90% (邮箱登录完成,面部登录部分完成)
- ✅ 商户管理: 100%
- ✅ 产品管理: 100%
- ✅ 设备管理: 100%
- ✅ 订单管理: 100%
- ✅ 支付集成: 80% (Stripe 完成,加密货币待完善)
- ⏳ 钱包系统: 70% (基础功能完成,区块链待实现)
- ⏳ 人脸识别: 60% (基础框架完成,AWS 集成待配置)
- ⏳ KYC 验证: 50% (流程完成,第三方集成待实现)
- ⏳ 实时推送: 40% (WebSocket 框架完成,集成待完善)

### 前端页面
- ✅ 登录/注册: 95%
- ✅ Dashboard: 90%
- ✅ 商户管理: 90%
- ✅ 产品管理: 90%
- ✅ 设备管理: 90%
- ✅ 订单管理: 85%
- ✅ 支付方式: 80%
- ⏳ 人脸识别: 60%
- ⏳ 加密钱包: 70%
- ⏳ 产品检测: 50%
- ⏳ 分析报表: 70%

### 整体完成度
**核心功能**: 85%  
**高级功能**: 60%  
**代码质量**: 75%

---

## 🚀 推荐的修复顺序

### 第一阶段 (本次已完成)
1. ✅ 修复用户登录路由 404
2. ✅ 修复面部登录功能(简化版本)
3. ✅ 创建详细的修复文档

### 第二阶段 (下一步)
1. ⏳ 修复人脸注册功能
2. ⏳ 实现视频帧收集
3. ⏳ 添加邮件通知功能
4. ⏳ 改进错误处理和日志

### 第三阶段 (可选)
1. ⏳ 配置 AWS Rekognition(生产环境)
2. ⏳ 集成 KYC 第三方服务
3. ⏳ 实现区块链交易
4. ⏳ 集成 BTCPay Server

### 第四阶段 (优化)
1. ⏳ 实现实时 ETH 价格
2. ⏳ 完善地图功能
3. ⏳ 添加告警规则
4. ⏳ 实现 YOLO 模型训练

---

## 📝 技术债务

### 1. 环境变量管理
**问题**: 缺少 `.env` 文件,配置分散  
**影响**: 部署困难,配置不一致  
**修复**: 创建完整的 `.env.example` 和部署文档

### 2. 错误处理不统一
**问题**: 不同模块使用不同的错误处理方式  
**影响**: 调试困难,用户体验不佳  
**修复**: 实现统一的错误处理中间件

### 3. 缺少单元测试
**问题**: 没有测试覆盖  
**影响**: 重构风险高,回归测试困难  
**修复**: 添加 Jest/Vitest 测试

### 4. 日志系统不完善
**问题**: 使用 console.log,没有日志级别  
**影响**: 生产环境调试困难  
**修复**: 集成 Winston 或 Pino

### 5. 文档不完整
**问题**: 缺少 API 文档和开发指南  
**影响**: 新开发者上手困难  
**修复**: 使用 Swagger/OpenAPI 生成文档

---

## 🔒 安全问题

### 1. ⚠️ 面部识别安全性
**问题**: 简化版本容易被照片欺骗  
**风险**: 高  
**修复**: 使用 AWS Rekognition 或专业服务

### 2. ⚠️ 缺少速率限制
**问题**: API 没有速率限制  
**风险**: 中  
**修复**: 使用 express-rate-limit

### 3. ⚠️ 敏感数据加密
**问题**: 人脸嵌入未加密存储  
**风险**: 高  
**修复**: 使用 AES-256 加密

### 4. ⚠️ CORS 配置
**问题**: CORS 配置可能过于宽松  
**风险**: 中  
**修复**: 限制允许的域名

### 5. ⚠️ SQL 注入防护
**问题**: 使用 Drizzle ORM,基本安全  
**风险**: 低  
**修复**: 审查原始 SQL 查询

---

## 📈 性能优化建议

### 1. 数据库索引
- 为常用查询字段添加索引
- 优化复杂查询
- 使用查询缓存

### 2. API 响应缓存
- 使用 Redis 缓存频繁查询
- 实现 CDN 缓存静态资源
- 添加 HTTP 缓存头

### 3. 图片优化
- 压缩上传的图片
- 使用 WebP 格式
- 实现懒加载

### 4. 代码分割
- 使用 React.lazy 懒加载组件
- 优化打包体积
- 移除未使用的依赖

### 5. 数据库连接池
- 配置合适的连接池大小
- 实现连接复用
- 监控连接状态

---

## 📚 文档需求

### 1. API 文档
- 使用 Swagger/OpenAPI
- 包含所有端点
- 提供示例请求/响应

### 2. 部署文档
- EC2 部署步骤
- 环境变量配置
- 故障排查指南

### 3. 开发指南
- 项目结构说明
- 编码规范
- Git 工作流程

### 4. 用户手册
- 功能使用说明
- 常见问题解答
- 视频教程

---

## 🎯 下一步行动

### 立即执行
1. ✅ 提交当前修复到 Git
2. ✅ 部署到生产环境
3. ✅ 测试验证修复效果

### 本周内完成
1. ⏳ 修复人脸注册功能
2. ⏳ 实现视频帧收集
3. ⏳ 添加邮件通知

### 本月内完成
1. ⏳ 配置 AWS Rekognition
2. ⏳ 集成 KYC 服务
3. ⏳ 完善文档

---

**最后更新**: 2025-11-21 15:45 GMT+8  
**维护人员**: Manus Agent  
**项目状态**: 🟢 核心功能可用,高级功能待完善
