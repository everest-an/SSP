# SSP 去中心化身份(DID)技术架构文档

**版本**: 1.0  
**更新日期**: 2025-11-21  
**状态**: 开发中

---

## 1. 架构概览

SSP 采用**去中心化身份(DID)** + **以太坊** + **Arweave** 的三层架构,实现完全去中心化的面部认证和支付系统。

### 1.1 核心原则

1. **隐私优先**: 用户数据加密分片,永不离开用户控制
2. **去中心化**: 无中心化服务器,无单点故障
3. **可验证**: 所有操作可在区块链上验证
4. **可撤销**: 用户可以随时撤销和恢复身份
5. **互操作**: 兼容 W3C DID 标准和 Web3 生态

### 1.2 技术栈

```
┌─────────────────────────────────────────────────────────┐
│                    应用层                                │
│  React + TypeScript + TailwindCSS                       │
│  MediaPipe (面部识别) + ethers.js + arweave-js         │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────┴────────────────────────────────────┐
│                    服务层                                │
│  Node.js + tRPC + WebSocket                             │
│  DID 生成 + 加密分片 + 区块链交互                       │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────┴────────────────────────────────────┐
│                    存储层                                │
│  Arweave (永久存储) + IPFS (分布式) + 本地加密         │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────┴────────────────────────────────────┐
│                    区块链层                              │
│  Ethereum (主网) + Polygon (L2) + Arbitrum              │
│  智能合约 + DID Registry + 支付合约                     │
└─────────────────────────────────────────────────────────┘
```

---

## 2. DID 生成与管理

### 2.1 DID 格式

SSP 使用 **did:ethr** 方法,符合 W3C DID 标准。

**DID 格式**:
```
did:ethr:0x[ethereum_address]
```

**示例**:
```
did:ethr:0x1234567890abcdef1234567890abcdef12345678
```

### 2.2 DID 生成流程

```
┌─────────────────┐
│  1. 扫描面部    │
│  (MediaPipe)    │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────┐
│  2. 提取面部特征向量            │
│  (512 维向量)                   │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│  3. 生成以太坊密钥对            │
│  - 私钥: 256 位随机数           │
│  - 公钥: secp256k1 椭圆曲线     │
│  - 地址: Keccak256(公钥)[12:]   │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│  4. 生成 DID                    │
│  DID = "did:ethr:" + 地址       │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│  5. 创建 DID 文档               │
│  (包含公钥、服务端点等)         │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│  6. 注册到 DID Registry         │
│  (以太坊智能合约)               │
└─────────────────────────────────┘
```

### 2.3 DID 文档结构

```json
{
  "@context": [
    "https://www.w3.org/ns/did/v1",
    "https://w3id.org/security/suites/secp256k1-2019/v1"
  ],
  "id": "did:ethr:0x1234567890abcdef1234567890abcdef12345678",
  "verificationMethod": [
    {
      "id": "did:ethr:0x1234567890abcdef1234567890abcdef12345678#controller",
      "type": "EcdsaSecp256k1VerificationKey2019",
      "controller": "did:ethr:0x1234567890abcdef1234567890abcdef12345678",
      "publicKeyHex": "0x04..."
    },
    {
      "id": "did:ethr:0x1234567890abcdef1234567890abcdef12345678#delegate-1",
      "type": "EcdsaSecp256k1VerificationKey2019",
      "controller": "did:ethr:0x1234567890abcdef1234567890abcdef12345678",
      "publicKeyHex": "0x04..."
    }
  ],
  "authentication": [
    "did:ethr:0x1234567890abcdef1234567890abcdef12345678#controller"
  ],
  "assertionMethod": [
    "did:ethr:0x1234567890abcdef1234567890abcdef12345678#controller"
  ],
  "service": [
    {
      "id": "did:ethr:0x1234567890abcdef1234567890abcdef12345678#ssp-wallet",
      "type": "SSPWallet",
      "serviceEndpoint": "ar://[arweave_tx_id]"
    },
    {
      "id": "did:ethr:0x1234567890abcdef1234567890abcdef12345678#face-data",
      "type": "FaceData",
      "serviceEndpoint": "ipfs://[ipfs_cid]"
    }
  ]
}
```

---

## 3. ID 加密与分片

### 3.1 加密流程

```
┌─────────────────────────────────────────────────────────┐
│  第 1 步: 生成 ID                                       │
├─────────────────────────────────────────────────────────┤
│  ID = {                                                 │
│    did: "did:ethr:0x...",                              │
│    ethAddress: "0x...",                                │
│    publicKey: "0x...",                                 │
│    timestamp: 1700000000                               │
│  }                                                      │
└────────┬────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────┐
│  第 2 步: 序列化 ID                                     │
├─────────────────────────────────────────────────────────┤
│  IDString = JSON.stringify(ID)                         │
└────────┬────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────┐
│  第 3 步: 使用私钥加密 ID                               │
├─────────────────────────────────────────────────────────┤
│  EncryptedID = AES-256-GCM(IDString, 私钥)             │
│  - 算法: AES-256-GCM                                    │
│  - 密钥: 从以太坊私钥派生(HKDF)                        │
│  - IV: 随机生成 (12 字节)                              │
│  - Tag: 认证标签 (16 字节)                             │
└────────┬────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────┐
│  第 4 步: Shamir's Secret Sharing 分片                  │
├─────────────────────────────────────────────────────────┤
│  使用 (2, 3) 阈值方案:                                  │
│  - 分片 1 (FaceID): 从面部特征派生                     │
│  - 分片 2 (KeyID): 从私钥派生                          │
│  - 分片 3 (BackupID): 用户自行保管                     │
│                                                         │
│  任意 2 个分片可以重组 EncryptedID                     │
└─────────────────────────────────────────────────────────┘
```

### 3.2 Shamir's Secret Sharing 实现

**算法原理**:
- 将秘密 S 分成 n 个分片
- 需要 k 个分片才能重组秘密
- 少于 k 个分片无法获得任何信息

**SSP 配置**:
- n = 3 (总分片数)
- k = 2 (阈值)

**分片生成**:
```typescript
import { split, combine } from 'shamirs-secret-sharing';

// 分片
const secret = Buffer.from(encryptedID, 'hex');
const shares = split(secret, { shares: 3, threshold: 2 });

const faceID = shares[0].toString('hex');
const keyID = shares[1].toString('hex');
const backupID = shares[2].toString('hex');

// 重组(任意 2 个分片)
const recovered = combine([
  Buffer.from(faceID, 'hex'),
  Buffer.from(keyID, 'hex')
]);
const encryptedID = recovered.toString('hex');
```

### 3.3 分片存储

| 分片 | 派生来源 | 存储位置 | 用途 |
|------|----------|----------|------|
| FaceID | 面部特征向量 | 设备本地(加密) | 面部登录时使用 |
| KeyID | 以太坊私钥 | Arweave (公开) | 恢复时使用 |
| BackupID | 随机生成 | 用户保管(纸质/硬件) | 紧急恢复 |

**安全性**:
- ✅ 任意 1 个分片泄露,无法恢复秘密
- ✅ 需要 2 个分片才能解密 ID
- ✅ 面部特征 + KeyID = 正常登录
- ✅ KeyID + BackupID = 紧急恢复(无需面部)

---

## 4. Arweave 存储集成

### 4.1 存储内容

**存储在 Arweave 的数据**:
```json
{
  "version": "1.0",
  "did": "did:ethr:0x...",
  "keyID": "...",  // Shamir 分片 2
  "faceHashIPFS": "Qm...",  // 面部特征哈希(IPFS)
  "metadata": {
    "createdAt": 1700000000,
    "updatedAt": 1700000000,
    "deviceInfo": "...",
    "appVersion": "1.0.0"
  },
  "signature": "0x..."  // 使用私钥签名
}
```

### 4.2 Arweave 交互流程

```
┌─────────────────┐
│  1. 准备数据    │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────┐
│  2. 创建 Arweave 交易           │
│  - 设置 Content-Type            │
│  - 添加标签(tags)               │
│  - 签名交易                     │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│  3. 上传到 Arweave              │
│  - 使用 arweave-js              │
│  - 获取交易 ID                  │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│  4. 等待确认                    │
│  - 通常 2-10 分钟               │
│  - 检查交易状态                 │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│  5. 更新 DID 文档               │
│  - 添加 Arweave TX ID           │
│  - 更新服务端点                 │
└─────────────────────────────────┘
```

### 4.3 代码实现

```typescript
import Arweave from 'arweave';

// 初始化 Arweave
const arweave = Arweave.init({
  host: 'arweave.net',
  port: 443,
  protocol: 'https'
});

// 上传数据
async function uploadToArweave(data: any, privateKey: any) {
  // 创建交易
  const transaction = await arweave.createTransaction({
    data: JSON.stringify(data)
  }, privateKey);

  // 添加标签
  transaction.addTag('Content-Type', 'application/json');
  transaction.addTag('App-Name', 'SSP');
  transaction.addTag('App-Version', '1.0.0');
  transaction.addTag('DID', data.did);

  // 签名交易
  await arweave.transactions.sign(transaction, privateKey);

  // 上传
  const response = await arweave.transactions.post(transaction);

  if (response.status === 200) {
    return transaction.id;
  } else {
    throw new Error('Failed to upload to Arweave');
  }
}

// 从 Arweave 读取数据
async function readFromArweave(txId: string) {
  const transaction = await arweave.transactions.get(txId);
  const data = transaction.get('data', { decode: true, string: true });
  return JSON.parse(data);
}
```

### 4.4 成本估算

**Arweave 存储成本**:
- 价格: ~$0.01/MB (一次性付费,永久存储)
- 每个用户数据: ~1 KB
- 成本: $0.00001/用户

**示例**:
- 100 万用户: $10
- 1000 万用户: $100

**优势**:
- ✅ 一次付费,永久存储
- ✅ 成本极低
- ✅ 去中心化
- ✅ 不可篡改

---

## 5. 以太坊智能合约

### 5.1 DID Registry 合约

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title SSP DID Registry
 * @dev 管理去中心化身份(DID)的注册和验证
 */
contract SSPDIDRegistry {
    struct DIDDocument {
        string did;
        address controller;
        bytes32 faceHashIPFS;
        string arweaveID;
        uint256 createdAt;
        uint256 updatedAt;
        bool isActive;
    }
    
    // DID => DID Document
    mapping(string => DIDDocument) public didDocuments;
    
    // Address => DID
    mapping(address => string) public addressToDID;
    
    // Events
    event DIDRegistered(string indexed did, address indexed controller);
    event DIDUpdated(string indexed did);
    event DIDDeactivated(string indexed did);
    event DIDReactivated(string indexed did);
    
    /**
     * @dev 注册新的 DID
     */
    function registerDID(
        string memory _did,
        bytes32 _faceHashIPFS,
        string memory _arweaveID
    ) external {
        require(bytes(didDocuments[_did].did).length == 0, "DID already exists");
        require(bytes(addressToDID[msg.sender]).length == 0, "Address already has DID");
        
        didDocuments[_did] = DIDDocument({
            did: _did,
            controller: msg.sender,
            faceHashIPFS: _faceHashIPFS,
            arweaveID: _arweaveID,
            createdAt: block.timestamp,
            updatedAt: block.timestamp,
            isActive: true
        });
        
        addressToDID[msg.sender] = _did;
        
        emit DIDRegistered(_did, msg.sender);
    }
    
    /**
     * @dev 更新 DID 文档
     */
    function updateDID(
        string memory _did,
        bytes32 _faceHashIPFS,
        string memory _arweaveID
    ) external {
        require(didDocuments[_did].controller == msg.sender, "Not controller");
        require(didDocuments[_did].isActive, "DID not active");
        
        didDocuments[_did].faceHashIPFS = _faceHashIPFS;
        didDocuments[_did].arweaveID = _arweaveID;
        didDocuments[_did].updatedAt = block.timestamp;
        
        emit DIDUpdated(_did);
    }
    
    /**
     * @dev 停用 DID
     */
    function deactivateDID(string memory _did) external {
        require(didDocuments[_did].controller == msg.sender, "Not controller");
        require(didDocuments[_did].isActive, "Already deactivated");
        
        didDocuments[_did].isActive = false;
        didDocuments[_did].updatedAt = block.timestamp;
        
        emit DIDDeactivated(_did);
    }
    
    /**
     * @dev 重新激活 DID
     */
    function reactivateDID(string memory _did) external {
        require(didDocuments[_did].controller == msg.sender, "Not controller");
        require(!didDocuments[_did].isActive, "Already active");
        
        didDocuments[_did].isActive = true;
        didDocuments[_did].updatedAt = block.timestamp;
        
        emit DIDReactivated(_did);
    }
    
    /**
     * @dev 验证 DID
     */
    function verifyDID(string memory _did) external view returns (bool) {
        return didDocuments[_did].isActive;
    }
    
    /**
     * @dev 获取 DID 文档
     */
    function getDIDDocument(string memory _did) external view returns (DIDDocument memory) {
        return didDocuments[_did];
    }
}
```

### 5.2 SSP Wallet 合约

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title SSP Wallet
 * @dev 面部支付和收款的智能合约
 */
contract SSPWallet is ReentrancyGuard {
    struct Payment {
        string fromDID;
        string toDID;
        address token;
        uint256 amount;
        uint256 timestamp;
        bool completed;
    }
    
    // Payment ID => Payment
    mapping(bytes32 => Payment) public payments;
    
    // DID => Balance (token => amount)
    mapping(string => mapping(address => uint256)) public balances;
    
    // Events
    event PaymentAuthorized(bytes32 indexed paymentId, string fromDID, string toDID, uint256 amount);
    event PaymentCompleted(bytes32 indexed paymentId);
    event Deposit(string indexed did, address token, uint256 amount);
    event Withdrawal(string indexed did, address token, uint256 amount);
    
    // DID Registry 合约地址
    address public didRegistry;
    
    constructor(address _didRegistry) {
        didRegistry = _didRegistry;
    }
    
    /**
     * @dev 授权支付
     */
    function authorizePayment(
        string memory _fromDID,
        string memory _toDID,
        address _token,
        uint256 _amount
    ) external nonReentrant returns (bytes32) {
        // 验证 DID
        require(verifyDID(_fromDID), "From DID not valid");
        require(verifyDID(_toDID), "To DID not valid");
        
        // 检查余额
        require(balances[_fromDID][_token] >= _amount, "Insufficient balance");
        
        // 生成 Payment ID
        bytes32 paymentId = keccak256(abi.encodePacked(
            _fromDID,
            _toDID,
            _token,
            _amount,
            block.timestamp
        ));
        
        // 创建支付记录
        payments[paymentId] = Payment({
            fromDID: _fromDID,
            toDID: _toDID,
            token: _token,
            amount: _amount,
            timestamp: block.timestamp,
            completed: false
        });
        
        emit PaymentAuthorized(paymentId, _fromDID, _toDID, _amount);
        
        return paymentId;
    }
    
    /**
     * @dev 完成支付
     */
    function completePayment(bytes32 _paymentId) external nonReentrant {
        Payment storage payment = payments[_paymentId];
        
        require(!payment.completed, "Payment already completed");
        require(payment.timestamp + 5 minutes > block.timestamp, "Payment expired");
        
        // 转账
        balances[payment.fromDID][payment.token] -= payment.amount;
        balances[payment.toDID][payment.token] += payment.amount;
        
        payment.completed = true;
        
        emit PaymentCompleted(_paymentId);
    }
    
    /**
     * @dev 存款
     */
    function deposit(string memory _did, address _token, uint256 _amount) external nonReentrant {
        require(verifyDID(_did), "DID not valid");
        
        // 转入代币
        IERC20(_token).transferFrom(msg.sender, address(this), _amount);
        
        // 更新余额
        balances[_did][_token] += _amount;
        
        emit Deposit(_did, _token, _amount);
    }
    
    /**
     * @dev 提款
     */
    function withdraw(string memory _did, address _token, uint256 _amount) external nonReentrant {
        require(verifyDID(_did), "DID not valid");
        require(balances[_did][_token] >= _amount, "Insufficient balance");
        
        // 更新余额
        balances[_did][_token] -= _amount;
        
        // 转出代币
        IERC20(_token).transfer(msg.sender, _amount);
        
        emit Withdrawal(_did, _token, _amount);
    }
    
    /**
     * @dev 验证 DID
     */
    function verifyDID(string memory _did) internal view returns (bool) {
        // 调用 DID Registry 合约验证
        (bool success, bytes memory data) = didRegistry.staticcall(
            abi.encodeWithSignature("verifyDID(string)", _did)
        );
        
        if (success && data.length > 0) {
            return abi.decode(data, (bool));
        }
        
        return false;
    }
}
```

---

## 6. 完整注册流程

### 6.1 用户注册流程

```
┌─────────────────────────────────────────────────────────┐
│  第 1 步: 用户访问注册页面                              │
│  - 输入邮箱(可选,用于恢复)                             │
│  - 点击"开始注册"                                       │
└────────┬────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────┐
│  第 2 步: 扫描面部                                      │
│  - 启动摄像头                                           │
│  - 检测面部                                             │
│  - 活体检测(15 帧视频)                                 │
│  - 提取面部特征向量(512 维)                            │
└────────┬────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────┐
│  第 3 步: 生成以太坊密钥对                              │
│  - 生成 256 位随机私钥                                  │
│  - 派生公钥(secp256k1)                                  │
│  - 计算以太坊地址                                       │
│  - 私钥加密存储在本地                                   │
└────────┬────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────┐
│  第 4 步: 生成 DID                                      │
│  - DID = "did:ethr:" + 以太坊地址                       │
│  - 创建 DID 文档                                        │
└────────┬────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────┐
│  第 5 步: 创建 ID 并加密                                │
│  - ID = { did, ethAddress, publicKey, timestamp }       │
│  - 使用私钥加密 ID → EncryptedID                        │
└────────┬────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────┐
│  第 6 步: Shamir 分片                                   │
│  - 分片 1 (FaceID): 从面部特征派生                     │
│  - 分片 2 (KeyID): 从私钥派生                          │
│  - 分片 3 (BackupID): 随机生成                         │
└────────┬────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────┐
│  第 7 步: 存储分片                                      │
│  - FaceID: 加密存储在设备本地                          │
│  - KeyID: 上传到 Arweave                               │
│  - BackupID: 显示给用户(纸质/硬件保管)                │
└────────┬────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────┐
│  第 8 步: 上传面部特征哈希到 IPFS                       │
│  - 计算面部特征向量的哈希                               │
│  - 上传到 IPFS                                          │
│  - 获取 IPFS CID                                        │
└────────┬────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────┐
│  第 9 步: 注册 DID 到区块链                             │
│  - 调用 DID Registry 合约                               │
│  - 传入: DID, faceHashIPFS, arweaveID                  │
│  - 等待交易确认                                         │
└────────┬────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────┐
│  第 10 步: 注册完成                                     │
│  - 显示成功消息                                         │
│  - 显示 BackupID(提示用户保管)                         │
│  - 跳转到钱包页面                                       │
└─────────────────────────────────────────────────────────┘
```

### 6.2 面部登录流程

```
┌─────────────────────────────────────────────────────────┐
│  第 1 步: 用户访问登录页面                              │
│  - 点击"面部登录"                                       │
└────────┬────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────┐
│  第 2 步: 扫描面部                                      │
│  - 启动摄像头                                           │
│  - 检测面部                                             │
│  - 活体检测(15 帧视频)                                 │
│  - 提取面部特征向量                                     │
└────────┬────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────┐
│  第 3 步: 获取 FaceID                                   │
│  - 从面部特征派生 FaceID                                │
│  - 从本地存储读取加密的 FaceID                         │
│  - 解密 FaceID                                          │
└────────┬────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────┐
│  第 4 步: 获取 KeyID                                    │
│  - 从面部特征哈希查询 Arweave                          │
│  - 下载 KeyID                                           │
└────────┬────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────┐
│  第 5 步: 重组 EncryptedID                              │
│  - 使用 Shamir 算法重组                                 │
│  - EncryptedID = combine(FaceID, KeyID)                │
└────────┬────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────┐
│  第 6 步: 解密 ID                                       │
│  - 从本地读取私钥                                       │
│  - 解密 EncryptedID → ID                                │
│  - 提取 DID 和以太坊地址                                │
└────────┬────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────┐
│  第 7 步: 验证 DID                                      │
│  - 调用 DID Registry 合约验证                           │
│  - 检查 DID 是否激活                                    │
│  - 验证面部特征哈希                                     │
└────────┬────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────┐
│  第 8 步: 登录成功                                      │
│  - 生成 JWT token                                       │
│  - 跳转到钱包页面                                       │
└─────────────────────────────────────────────────────────┘
```

---

## 7. 安全性分析

### 7.1 威胁模型

| 威胁 | 描述 | 缓解措施 |
|------|------|----------|
| 照片攻击 | 使用照片欺骗面部识别 | 活体检测(15 帧视频分析) |
| 视频攻击 | 使用视频欺骗面部识别 | 3D 深度检测,随机挑战 |
| 面具攻击 | 使用 3D 打印面具 | 红外检测,纹理分析 |
| 私钥泄露 | 私钥被窃取 | 私钥加密存储,硬件安全模块 |
| 分片泄露 | 单个分片被窃取 | Shamir 阈值(需要 2/3) |
| 中间人攻击 | 拦截通信 | HTTPS, 端到端加密 |
| 重放攻击 | 重放旧的认证请求 | 时间戳,nonce |
| 社会工程 | 欺骗用户泄露信息 | 用户教育,多因素认证 |

### 7.2 安全最佳实践

1. **私钥管理**:
   - 私钥永不离开设备
   - 使用硬件安全模块(HSM)
   - 支持硬件钱包(Ledger, Trezor)

2. **面部数据保护**:
   - 只存储特征向量哈希
   - 不存储原始图像
   - 加密传输和存储

3. **多因素认证**:
   - 面部识别 + 手势识别
   - 面部识别 + PIN 码
   - 面部识别 + 硬件密钥

4. **审计和监控**:
   - 所有操作记录在区块链
   - 异常行为检测
   - 定期安全审计

---

## 8. 性能优化

### 8.1 性能指标

| 操作 | 目标时间 | 当前时间 | 优化方案 |
|------|----------|----------|----------|
| 面部检测 | < 100ms | 150ms | 使用 WebAssembly |
| 特征提取 | < 200ms | 300ms | GPU 加速 |
| DID 生成 | < 500ms | 800ms | 缓存计算 |
| Arweave 上传 | < 5s | 10s | 批量上传 |
| 区块链确认 | < 30s | 60s | Layer 2 |

### 8.2 优化策略

1. **客户端优化**:
   - 使用 WebAssembly 加速计算
   - GPU 加速(WebGL)
   - 离线优先设计

2. **网络优化**:
   - CDN 加速
   - 数据压缩
   - 批量操作

3. **区块链优化**:
   - 使用 Layer 2(Polygon, Arbitrum)
   - 批量交易
   - Gas 优化

---

## 9. 开发路线图

### Phase 1: 基础设施 (当前)

- [ ] DID 生成和管理
- [ ] 以太坊密钥对集成
- [ ] Arweave 存储集成
- [ ] Shamir 分片实现

### Phase 2: 智能合约 (2 周)

- [ ] DID Registry 合约开发
- [ ] SSP Wallet 合约开发
- [ ] 合约测试和审计
- [ ] 部署到测试网

### Phase 3: 前端集成 (3 周)

- [ ] 注册流程重构
- [ ] 登录流程重构
- [ ] 钱包 UI
- [ ] 支付 UI

### Phase 4: 测试和优化 (2 周)

- [ ] 单元测试
- [ ] 集成测试
- [ ] 性能优化
- [ ] 安全审计

### Phase 5: 主网部署 (1 周)

- [ ] 部署到主网
- [ ] 监控和日志
- [ ] 用户文档
- [ ] 发布公告

---

## 10. 附录

### A. 依赖库

```json
{
  "dependencies": {
    "ethers": "^6.0.0",
    "arweave": "^1.14.0",
    "did-jwt": "^7.0.0",
    "ethr-did": "^3.0.0",
    "shamirs-secret-sharing": "^1.0.1",
    "ipfs-http-client": "^60.0.0",
    "@mediapipe/face_detection": "^0.4.0"
  }
}
```

### B. 环境变量

```env
# 以太坊
ETHEREUM_RPC_URL=https://mainnet.infura.io/v3/YOUR_KEY
POLYGON_RPC_URL=https://polygon-rpc.com
PRIVATE_KEY=0x...

# Arweave
ARWEAVE_KEY_FILE=./arweave-key.json

# IPFS
IPFS_API_URL=https://ipfs.infura.io:5001

# 合约地址
DID_REGISTRY_ADDRESS=0x...
SSP_WALLET_ADDRESS=0x...
```

### C. 参考资料

1. W3C DID Core: https://www.w3.org/TR/did-core/
2. Ethereum DID Method: https://github.com/decentralized-identity/ethr-did-resolver
3. Arweave: https://www.arweave.org/
4. Shamir's Secret Sharing: https://en.wikipedia.org/wiki/Shamir%27s_Secret_Sharing

---

**文档版本**: 1.0  
**最后更新**: 2025-11-21  
**维护者**: SSP Development Team
