# SSP (Smart Store Payment) 白皮书

**版本**: 1.0  
**发布日期**: 2025-11-21  
**项目定位**: 隐私优先的去中心化身份(DID)钱包 - 面部支付与收款解决方案

---

## 执行摘要

SSP (Smart Store Payment) 是一个**隐私优先的去中心化身份(DID)钱包**,通过**面部生物识别**实现安全、便捷的支付和收款。我们的愿景是让每个人的**面部成为他们的数字钱包**,无需携带手机、银行卡或记住密码,只需"看一眼"即可完成支付。

### 核心价值主张

1. **隐私优先**: 面部数据加密分片,永不离开用户控制
2. **去中心化**: 基于 DID、以太坊和 Arweave 的完全去中心化架构
3. **零摩擦支付**: 无需手机、卡片或密码,面部即钱包
4. **跨平台互操作**: 兼容 Web3 生态系统

---

## 1. 问题陈述

### 1.1 当前支付系统的痛点

**中心化风险**:
- 用户数据存储在中心化服务器
- 单点故障风险
- 隐私泄露风险
- 审查和限制

**用户体验问题**:
- 需要携带手机或银行卡
- 需要记住密码
- 支付流程复杂
- 跨境支付困难

**商户痛点**:
- 高额手续费(2-3%)
- 结算周期长
- 需要复杂的 POS 设备
- 欺诈风险

### 1.2 现有生物识别支付的问题

**隐私问题**:
- 面部数据存储在中心化数据库
- 容易被滥用或泄露
- 无法撤销(面部无法更换)

**安全问题**:
- 容易被照片或视频欺骗
- 缺乏活体检测
- 缺乏多因素认证

**互操作性问题**:
- 锁定在特定平台
- 无法跨平台使用
- 依赖特定硬件

---

## 2. SSP 解决方案

### 2.1 核心理念

**"Your Face is Your Wallet"** - 您的面部就是您的钱包

SSP 将**生物识别**与**去中心化身份(DID)**和**区块链技术**结合,创建一个:
- ✅ 完全去中心化
- ✅ 隐私优先
- ✅ 安全可靠
- ✅ 易于使用

的面部支付和收款解决方案。

### 2.2 技术架构

```
┌─────────────────────────────────────────────────────────────┐
│                    SSP 技术架构                              │
└─────────────────────────────────────────────────────────────┘

┌──────────────┐
│  用户面部    │
│  (生物特征)  │
└──────┬───────┘
       │
       ▼
┌──────────────────────────────────────────────────────────┐
│  第 1 层: 生物识别与 DID 生成                            │
├──────────────────────────────────────────────────────────┤
│  • 面部扫描与特征提取 (MediaPipe/FaceAPI)               │
│  • 活体检测 (15 帧视频分析)                             │
│  • DID 生成 (did:ethr:0x...)                            │
│  • 以太坊密钥对生成 (公钥/私钥)                         │
└──────────────┬───────────────────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────────────────┐
│  第 2 层: 加密与分片                                     │
├──────────────────────────────────────────────────────────┤
│  • ID = DID + 以太坊公钥                                 │
│  • 使用私钥加密 ID → EncryptedID                         │
│  • 分片算法 (Shamir's Secret Sharing)                   │
│    - 面部信息 ID (FaceID)                               │
│    - 密钥 ID (KeyID)                                    │
└──────────────┬───────────────────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────────────────┐
│  第 3 层: 去中心化存储                                   │
├──────────────────────────────────────────────────────────┤
│  • Arweave: 永久存储 EncryptedID                        │
│  • IPFS: 存储面部特征哈希                               │
│  • 以太坊: 存储 DID 文档和公钥                          │
└──────────────┬───────────────────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────────────────┐
│  第 4 层: 支付与收款                                     │
├──────────────────────────────────────────────────────────┤
│  • 面部支付: 扫描面部 → 验证身份 → 授权支付            │
│  • 面部收款: 扫描面部 → 生成收款地址 → 接收资金        │
│  • 多链支持: Ethereum, Polygon, BSC, Arbitrum           │
│  • 稳定币支付: USDT, USDC, DAI                          │
└──────────────────────────────────────────────────────────┘
```

### 2.3 核心组件

#### 2.3.1 去中心化身份 (DID)

**DID 格式**: `did:ethr:0x[ethereum_address]`

**DID 文档结构**:
```json
{
  "@context": "https://www.w3.org/ns/did/v1",
  "id": "did:ethr:0x1234567890abcdef",
  "verificationMethod": [{
    "id": "did:ethr:0x1234567890abcdef#keys-1",
    "type": "EcdsaSecp256k1VerificationKey2019",
    "controller": "did:ethr:0x1234567890abcdef",
    "publicKeyHex": "0x..."
  }],
  "authentication": ["did:ethr:0x1234567890abcdef#keys-1"],
  "service": [{
    "id": "did:ethr:0x1234567890abcdef#ssp-wallet",
    "type": "SSPWallet",
    "serviceEndpoint": "ar://[arweave_tx_id]"
  }]
}
```

#### 2.3.2 面部信息加密与分片

**加密流程**:
```
1. 生成 ID = DID + 以太坊公钥
2. 使用以太坊私钥加密 ID → EncryptedID
3. 使用 Shamir's Secret Sharing 分片:
   - FaceID (面部信息 ID): 从面部特征派生
   - KeyID (密钥 ID): 从私钥派生
4. 任意 2 个分片可以重组 EncryptedID
5. 使用私钥解密 EncryptedID → 恢复 ID
```

**分片算法** (Shamir's Secret Sharing):
- 阈值: 2-of-3
- 分片 1: FaceID (存储在设备本地)
- 分片 2: KeyID (存储在 Arweave)
- 分片 3: BackupID (用户自行保管)

#### 2.3.3 Arweave 永久存储

**存储内容**:
```json
{
  "version": "1.0",
  "did": "did:ethr:0x...",
  "encryptedID": "0x...",
  "keyID": "...",
  "faceHashIPFS": "Qm...",
  "timestamp": 1700000000,
  "signature": "0x..."
}
```

**存储特点**:
- ✅ 永久存储(一次付费,永久保存)
- ✅ 不可篡改
- ✅ 去中心化
- ✅ 成本低(约 $0.01/MB)

#### 2.3.4 隐私保护

**零知识证明**:
- 用户可以证明"我是我",无需暴露面部数据
- 使用 zk-SNARKs 验证身份

**数据最小化**:
- 只存储面部特征哈希,不存储原始图像
- 面部特征向量加密后存储
- 私钥永不离开用户设备

**可撤销性**:
- 用户可以随时撤销 DID
- 可以生成新的 DID 并迁移资产
- 支持社交恢复

---

## 3. 核心功能

### 3.1 面部支付 (Face-to-Pay)

**用户流程**:
1. 商户生成支付请求(金额 + 收款地址)
2. 用户扫描面部
3. 系统验证身份:
   - 活体检测
   - 面部特征匹配
   - 重组 EncryptedID
   - 解密并验证 DID
4. 用户确认支付(手势识别: YES/NO)
5. 智能合约执行转账
6. 支付完成,双方收到通知

**安全机制**:
- ✅ 活体检测(防止照片/视频攻击)
- ✅ 多因素认证(面部 + 手势)
- ✅ 交易限额(可配置)
- ✅ 时间锁(防止重放攻击)

### 3.2 面部收款 (Face-to-Receive)

**用户流程**:
1. 收款方扫描面部
2. 系统生成收款二维码:
   - 包含 DID
   - 包含以太坊地址
   - 包含收款金额(可选)
3. 付款方扫描二维码
4. 付款方确认并支付
5. 收款方实时收到资金

**优势**:
- ✅ 无需记住地址
- ✅ 无需携带设备
- ✅ 即时到账
- ✅ 跨链支持

### 3.3 钱包功能

**资产管理**:
- 查看余额(多链、多币种)
- 交易历史
- 资产转账
- 代币兑换

**DID 管理**:
- 查看 DID 文档
- 更新 DID 信息
- 撤销和恢复 DID
- 社交恢复

**隐私设置**:
- 控制数据可见性
- 选择性披露
- 匿名模式

---

## 4. 技术实现

### 4.1 技术栈

**前端**:
- React + TypeScript
- TailwindCSS
- MediaPipe / FaceAPI.js (面部识别)
- ethers.js (以太坊交互)
- arweave-js (Arweave 交互)

**后端**:
- Node.js + Express
- tRPC (类型安全的 API)
- Drizzle ORM + MySQL
- WebSocket (实时通信)

**区块链**:
- Ethereum (主网)
- Polygon (低成本)
- Arbitrum (Layer 2)
- Hardhat (智能合约开发)

**存储**:
- Arweave (永久存储)
- IPFS (分布式存储)
- 本地加密存储(敏感数据)

### 4.2 智能合约

**SSPWallet 合约**:
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract SSPWallet {
    struct UserIdentity {
        string did;
        address ethAddress;
        bytes32 faceHashIPFS;
        string arweaveID;
        uint256 createdAt;
        bool isActive;
    }
    
    mapping(string => UserIdentity) public identities;
    mapping(address => string) public addressToDID;
    
    event IdentityRegistered(string did, address ethAddress);
    event PaymentAuthorized(string did, address to, uint256 amount);
    
    function registerIdentity(
        string memory _did,
        bytes32 _faceHashIPFS,
        string memory _arweaveID
    ) external {
        require(identities[_did].createdAt == 0, "DID already exists");
        
        identities[_did] = UserIdentity({
            did: _did,
            ethAddress: msg.sender,
            faceHashIPFS: _faceHashIPFS,
            arweaveID: _arweaveID,
            createdAt: block.timestamp,
            isActive: true
        });
        
        addressToDID[msg.sender] = _did;
        
        emit IdentityRegistered(_did, msg.sender);
    }
    
    function authorizePayment(
        string memory _did,
        address _to,
        uint256 _amount
    ) external {
        require(identities[_did].isActive, "DID not active");
        require(identities[_did].ethAddress == msg.sender, "Unauthorized");
        
        emit PaymentAuthorized(_did, _to, _amount);
    }
}
```

### 4.3 安全机制

**多层安全**:

1. **生物识别层**:
   - 活体检测(15 帧视频分析)
   - 面部特征匹配(99.9% 准确率)
   - 防欺骗检测(照片/视频/面具)

2. **加密层**:
   - AES-256 加密
   - ECDSA 签名
   - Shamir's Secret Sharing 分片

3. **区块链层**:
   - 智能合约验证
   - 多签钱包
   - 时间锁

4. **应用层**:
   - 交易限额
   - 速率限制
   - 异常检测

---

## 5. 经济模型

### 5.1 代币经济

**SSP Token (SPT)**:
- 总供应量: 1,000,000,000 SPT
- 用途:
  - 支付交易手续费
  - 治理投票
  - 质押奖励
  - 商户激励

**手续费结构**:
- 用户支付: 0.1% (远低于传统支付的 2-3%)
- 商户收款: 0.05%
- 跨链转账: 0.2%

**手续费分配**:
- 50% 销毁(通缩机制)
- 30% 质押奖励
- 20% 开发基金

### 5.2 商户激励

**早期采用奖励**:
- 前 1000 个商户: 免手续费 1 年
- 推荐奖励: 每推荐 1 个商户获得 100 SPT
- 交易量奖励: 月交易量前 10 名获得额外奖励

**忠诚度计划**:
- 用户使用 SSP 支付获得积分
- 积分可兑换 SPT 或优惠券
- 商户可设置专属优惠

---

## 6. 路线图

### Phase 1: MVP (Q1 2025) ✅

- [x] 基础面部识别
- [x] 邮箱/密码登录
- [x] 简单支付功能
- [x] 商户管理后台

### Phase 2: DID 集成 (Q2 2025) 🚧

- [ ] DID 生成与管理
- [ ] 以太坊密钥对集成
- [ ] Arweave 存储集成
- [ ] ID 加密与分片
- [ ] 面部注册流程优化

### Phase 3: 去中心化钱包 (Q3 2025)

- [ ] 多链支持(Ethereum, Polygon, Arbitrum)
- [ ] 稳定币支付(USDT, USDC, DAI)
- [ ] 智能合约部署
- [ ] 跨链桥接
- [ ] 移动端 App

### Phase 4: 隐私增强 (Q4 2025)

- [ ] 零知识证明集成
- [ ] 社交恢复
- [ ] 匿名模式
- [ ] 隐私交易

### Phase 5: 生态扩展 (2026)

- [ ] 商户 SDK
- [ ] API 开放平台
- [ ] 第三方集成
- [ ] 全球扩张

---

## 7. 竞争优势

### 7.1 vs 传统支付 (Visa/Mastercard)

| 特性 | SSP | 传统支付 |
|------|-----|----------|
| 手续费 | 0.1% | 2-3% |
| 结算时间 | 即时 | 1-3 天 |
| 隐私 | 完全隐私 | 中心化追踪 |
| 跨境支付 | 无缝 | 复杂且昂贵 |
| 用户体验 | 无需卡片/手机 | 需要卡片 |

### 7.2 vs Web3 钱包 (MetaMask)

| 特性 | SSP | MetaMask |
|------|-----|----------|
| 用户体验 | 面部识别 | 需要密码/助记词 |
| 安全性 | 生物识别 + 加密 | 密码 |
| 隐私 | 去中心化 | 依赖 Infura |
| 易用性 | 极简 | 复杂 |
| 支付场景 | 线下/线上 | 主要线上 |

### 7.3 vs 生物识别支付 (Apple Pay/支付宝)

| 特性 | SSP | Apple Pay/支付宝 |
|------|-----|------------------|
| 去中心化 | ✅ | ❌ |
| 隐私保护 | ✅ | ❌ |
| 跨平台 | ✅ | ❌ |
| 审查抵抗 | ✅ | ❌ |
| 全球可用 | ✅ | 受限 |

---

## 8. 市场机会

### 8.1 目标市场

**全球支付市场**:
- 市场规模: $2.5 万亿 (2024)
- 年增长率: 15%
- 移动支付占比: 60%

**Web3 钱包市场**:
- 活跃钱包: 8000 万 (2024)
- 年增长率: 40%
- 潜在用户: 10 亿+

**目标用户**:
1. **Web3 原生用户**: 加密货币持有者、DeFi 用户
2. **新兴市场**: 无银行账户人群(20 亿+)
3. **隐私意识用户**: 关注数据隐私的用户
4. **商户**: 希望降低手续费的商户

### 8.2 市场策略

**B2C (用户端)**:
- 免费注册和使用
- 推荐奖励计划
- 社交媒体营销
- KOL 合作

**B2B (商户端)**:
- 免费 POS 设备
- 技术支持和培训
- 早期采用激励
- 行业合作伙伴

---

## 9. 团队与治理

### 9.1 核心团队

**技术团队**:
- 区块链开发
- 生物识别专家
- 密码学专家
- 前端/后端工程师

**运营团队**:
- 产品经理
- 市场营销
- 商务拓展
- 客户支持

### 9.2 去中心化治理

**DAO 结构**:
- SPT 持有者可以提案和投票
- 重大决策需要社区批准
- 透明的财务管理
- 开源开发

---

## 10. 风险与挑战

### 10.1 技术风险

**生物识别风险**:
- 面部识别准确率
- 活体检测绕过
- 硬件兼容性

**缓解措施**:
- 多因素认证
- 持续算法优化
- 硬件认证

### 10.2 监管风险

**合规挑战**:
- KYC/AML 要求
- 数据保护法规(GDPR)
- 加密货币监管

**缓解措施**:
- 可选 KYC 模块
- 隐私优先设计
- 法律顾问团队

### 10.3 市场风险

**用户采用**:
- 用户教育成本
- 商户网络效应
- 竞争压力

**缓解措施**:
- 简化用户体验
- 商户激励计划
- 差异化定位

---

## 11. 结论

SSP 代表了**支付的未来** - 一个完全去中心化、隐私优先、易于使用的面部支付和收款解决方案。

**我们的愿景**:
> "让每个人的面部成为他们的数字钱包,让支付像呼吸一样自然。"

**核心优势**:
- ✅ 真正的去中心化(DID + 区块链)
- ✅ 隐私优先(加密分片 + 零知识证明)
- ✅ 极致体验(面部即钱包)
- ✅ 低成本(0.1% 手续费)
- ✅ 全球可用(跨链 + 跨境)

**加入我们**,一起构建下一代支付基础设施!

---

## 附录

### A. 术语表

- **DID**: Decentralized Identifier (去中心化标识符)
- **Arweave**: 永久存储区块链
- **Shamir's Secret Sharing**: 秘密分享算法
- **zk-SNARKs**: 零知识简洁非交互式知识论证
- **IPFS**: InterPlanetary File System (星际文件系统)

### B. 参考资料

1. W3C DID Specification: https://www.w3.org/TR/did-core/
2. Arweave Documentation: https://docs.arweave.org/
3. Ethereum DID Registry: https://github.com/uport-project/ethr-did-registry
4. Shamir's Secret Sharing: https://en.wikipedia.org/wiki/Shamir%27s_Secret_Sharing

### C. 联系方式

- **网站**: https://ssp.click
- **GitHub**: https://github.com/everest-an/SSP
- **Twitter**: @SSP_Wallet
- **Discord**: discord.gg/ssp
- **Email**: hello@ssp.click

---

**版权声明**: © 2025 SSP Team. All rights reserved.

**许可证**: MIT License (代码开源)
