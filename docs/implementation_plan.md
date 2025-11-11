# SSP 用户认证与账户体系实施计划

**基于:** DEVDOC-FR 文档
**日期:** 2025-11-12
**当前状态:** Sprint 2 已完成基础人脸识别功能

---

## 1. 当前状态评估

### 已完成 (Sprint 2)
- ✅ MediaPipe Face Mesh 集成 (468个3D面部特征点)
- ✅ AWS KMS 加密 (face embeddings)
- ✅ AWS Rekognition Face Liveness 活体检测
- ✅ 基础人脸注册页面 (`FaceRegistration.tsx`)
- ✅ 基础人脸登录页面 (`FaceLogin.tsx`)
- ✅ 人脸支付确认组件 (`FacePaymentConfirm.tsx`)
- ✅ 基础数据库表结构 (6个facial auth相关表)

### 待完善功能 (根据DEVDOC-FR)
- ⚠️ **面部向量唯一性检测** - 需要实现ANN全局重复检测
- ⚠️ **向量数据库集成** - FAISS/Milvus/Pinecone用于近邻搜索
- ⚠️ **完整的活体检测** - 主动挑战(眨眼/转头) + 被动检测
- ⚠️ **审计日志系统** - 完整的操作审计和风控监控
- ⚠️ **设备绑定与证明** - Device attestation + 设备指纹
- ⚠️ **支付方式安全绑定** - Stripe tokenization + 多因子验证
- ⚠️ **用户隐私控制** - 数据查看/导出/删除功能
- ⚠️ **风控与监控面板** - 异常检测 + 人工复核

---

## 2. 数据库Schema完善计划

### 2.1 当前表结构
```sql
-- Sprint 2已创建的表
- user_identities (外部身份关联)
- face_profiles (人脸模板存储)
- face_embeddings (向量存储)
- face_verification_sessions (验证会话)
- face_liveness_sessions (活体检测会话)
- face_enrollment_history (注册历史)
```

### 2.2 需要新增的表

#### a) face_index_map (向量索引映射)
```sql
CREATE TABLE face_index_map (
  id INT PRIMARY KEY AUTO_INCREMENT,
  face_profile_id INT NOT NULL,
  vector_db_id VARCHAR(255) UNIQUE NOT NULL,
  vector_db_type ENUM('faiss', 'milvus', 'pinecone') NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (face_profile_id) REFERENCES face_profiles(id) ON DELETE CASCADE
);
```

#### b) payment_methods (支付方式)
```sql
CREATE TABLE payment_methods (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  stripe_payment_method_id VARCHAR(255) NOT NULL,
  type ENUM('card', 'wallet', 'bank_account') NOT NULL,
  last4 VARCHAR(4),
  brand VARCHAR(50),
  metadata JSON,
  is_default BOOLEAN DEFAULT FALSE,
  verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_payment (user_id, is_default)
);
```

#### c) audit_logs (审计日志)
```sql
CREATE TABLE audit_logs (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id INT,
  action VARCHAR(100) NOT NULL,
  actor VARCHAR(255),
  ip_address VARCHAR(45),
  user_agent TEXT,
  device_fingerprint VARCHAR(255),
  geo_location JSON,
  detail JSON,
  risk_score DECIMAL(3,2),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_action (user_id, action, created_at),
  INDEX idx_created_at (created_at)
);
```

#### d) device_bindings (设备绑定)
```sql
CREATE TABLE device_bindings (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  device_fingerprint VARCHAR(255) NOT NULL,
  device_name VARCHAR(255),
  device_type VARCHAR(50),
  public_key TEXT,
  last_used_at TIMESTAMP,
  trusted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY unique_user_device (user_id, device_fingerprint)
);
```

#### e) face_match_attempts (匹配尝试记录)
```sql
CREATE TABLE face_match_attempts (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id INT,
  face_profile_id INT,
  similarity_score DECIMAL(5,4),
  threshold_used DECIMAL(5,4),
  success BOOLEAN,
  failure_reason VARCHAR(255),
  ip_address VARCHAR(45),
  device_fingerprint VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_attempts (user_id, created_at),
  INDEX idx_failures (success, created_at)
);
```

---

## 3. 向量数据库选型与实施

### 3.1 技术选型对比

| 方案 | 优点 | 缺点 | 推荐度 |
|------|------|------|--------|
| **FAISS** | 开源免费,性能优秀,Meta维护 | 需要自己管理持久化 | ⭐⭐⭐⭐⭐ |
| **Milvus** | 云原生,易扩展,完整功能 | 部署复杂,资源占用大 | ⭐⭐⭐⭐ |
| **Pinecone** | 全托管,简单易用 | 收费,数据在第三方 | ⭐⭐⭐ |

**推荐方案:** FAISS + Redis持久化 (阶段1) → Milvus (阶段2扩展)

### 3.2 FAISS实施计划

#### Phase 1: 本地FAISS索引
```python
# server/services/faceAuth/vectorIndex.py
import faiss
import numpy as np
import pickle
import redis

class FaceVectorIndex:
    def __init__(self):
        self.dimension = 512  # MediaPipe embedding dimension
        self.index = faiss.IndexFlatL2(self.dimension)
        self.id_map = {}  # face_profile_id -> faiss_index
        
    def add_vector(self, face_profile_id: int, embedding: np.ndarray):
        """添加向量到索引"""
        faiss_id = self.index.ntotal
        self.index.add(embedding.reshape(1, -1))
        self.id_map[faiss_id] = face_profile_id
        
    def search_similar(self, embedding: np.ndarray, k: int = 5):
        """搜索最相似的k个向量"""
        distances, indices = self.index.search(embedding.reshape(1, -1), k)
        results = []
        for i, (dist, idx) in enumerate(zip(distances[0], indices[0])):
            if idx in self.id_map:
                similarity = 1 / (1 + dist)  # Convert L2 to similarity
                results.append({
                    'face_profile_id': self.id_map[idx],
                    'similarity': float(similarity),
                    'distance': float(dist)
                })
        return results
    
    def save_to_redis(self, redis_client):
        """持久化到Redis"""
        index_bytes = faiss.serialize_index(self.index)
        redis_client.set('faiss:index', index_bytes)
        redis_client.set('faiss:id_map', pickle.dumps(self.id_map))
    
    def load_from_redis(self, redis_client):
        """从Redis加载"""
        index_bytes = redis_client.get('faiss:index')
        if index_bytes:
            self.index = faiss.deserialize_index(index_bytes)
            self.id_map = pickle.loads(redis_client.get('faiss:id_map'))
```

---

## 4. 活体检测增强方案

### 4.1 当前实现
- ✅ AWS Rekognition Face Liveness (被动检测)

### 4.2 需要增强的功能

#### a) 主动挑战检测
```typescript
// client/src/services/livenessChallenge.ts
export interface LivenessChallenge {
  type: 'blink' | 'turn_left' | 'turn_right' | 'smile' | 'nod';
  instruction: string;
  timeout: number;
}

export class LivenessChallengeService {
  async generateChallenge(): Promise<LivenessChallenge[]> {
    // 随机生成2-3个挑战动作
    const challenges: LivenessChallenge[] = [
      { type: 'blink', instruction: '请眨眼两次', timeout: 5000 },
      { type: 'turn_left', instruction: '请向左转头', timeout: 3000 },
      { type: 'smile', instruction: '请微笑', timeout: 3000 }
    ];
    return this.shuffle(challenges).slice(0, 2);
  }
  
  async verifyChallengeResponse(
    video: Blob,
    challenges: LivenessChallenge[]
  ): Promise<boolean> {
    // 使用MediaPipe检测动作完成情况
    // 发送到后端进行AWS Rekognition二次验证
  }
}
```

#### b) 反重放检测
```typescript
// server/services/faceAuth/antiReplay.ts
export class AntiReplayService {
  async checkReplay(
    videoHash: string,
    userId: number
  ): Promise<{ isReplay: boolean; reason?: string }> {
    // 1. 检查视频哈希是否在最近使用过
    const recentHash = await db.query(
      'SELECT id FROM face_verification_sessions WHERE video_hash = ? AND created_at > DATE_SUB(NOW(), INTERVAL 1 HOUR)',
      [videoHash]
    );
    
    if (recentHash.length > 0) {
      return { isReplay: true, reason: 'Video hash recently used' };
    }
    
    // 2. 检查视频元数据(创建时间、修改时间)
    // 3. 检查帧间微动特征
    // 4. 检查光学一致性
    
    return { isReplay: false };
  }
}
```

---

## 5. 实施优先级与时间表

### Sprint 3: 核心安全增强 (2周)
**Week 1:**
- [ ] 完善数据库schema (新增5个表)
- [ ] 实现FAISS向量索引服务
- [ ] 实现全局唯一性检测
- [ ] 实现审计日志系统

**Week 2:**
- [ ] 增强活体检测(主动挑战)
- [ ] 实现反重放检测
- [ ] 实现设备绑定功能
- [ ] 部署测试

### Sprint 4: 支付集成与用户体验 (2周)
**Week 1:**
- [ ] 集成Stripe支付方式绑定
- [ ] 实现多因子支付验证
- [ ] 实现支付限额控制

**Week 2:**
- [ ] 实现用户隐私控制面板
- [ ] 实现数据导出/删除功能
- [ ] 完善错误提示和降级方案

### Sprint 5: 监控与合规 (1周)
- [ ] 实现风控监控面板
- [ ] 实现人工复核流程
- [ ] 完善合规文档和用户协议
- [ ] 性能优化和压力测试

---

## 6. 技术债务与风险

### 高优先级
1. **阈值调参** - 需要收集真实数据进行ROC测试
2. **性能优化** - FAISS索引在用户量增长后的性能
3. **数据迁移** - 现有用户的face_profiles需要建立向量索引

### 中优先级
4. **模型版本管理** - 支持多个embedding模型共存
5. **跨设备同步** - 用户在多设备上的人脸数据管理
6. **降级策略** - 向量数据库故障时的备用方案

### 低优先级
7. **国际化** - 多语言支持
8. **A/B测试** - 不同阈值和策略的效果对比

---

## 7. 下一步行动

### 立即开始 (今天)
1. ✅ 创建实施计划文档
2. 🔄 创建数据库迁移脚本 (5个新表)
3. 🔄 实现FAISS向量索引服务基础框架

### 本周完成
4. 实现全局唯一性检测API
5. 实现审计日志记录中间件
6. 编写单元测试

### 需要讨论
- FAISS vs Milvus 最终选型
- 阈值初始值设定 (建议: cosine > 0.85 为高置信)
- 支付多因子验证的具体策略
- 数据保留期限 (建议: 面部模板3年, 审计日志1年)

---

**文档版本:** 1.0
**最后更新:** 2025-11-12
**负责人:** Development Team
