# SSP项目增量开发计划 (基于用户规则和项目现状)

**目标:** 遵循“增量修改”和“质量优先”原则，完成SSP项目核心安全增强（Sprint 3）的待办事项，并同步更新相关文档。

**用户开发规则摘要:**
*   **核心原则:** 增量修改，保留现有功能，不随意删除或重构。
*   **质量要求:** 确保每个功能完善且可用，进行充分测试，以“商用”标准交付。
*   **文档同步:** 每次升级后，同步更新需求文档、功能文档和技术文档。
*   **UI/UX:** 简洁、iOS磨砂风格、深色主题。
*   **开发模式:** 混合模式，需要后端服务支持。

## 1. 当前项目状态总结

| 方面 | 状态 | 关键技术 | 待办事项 (来自 `implementation_plan.md`) |
| :--- | :--- | :--- | :--- |
| **官网** | 宣传页已完成，功能入口可见 | React, TailwindCSS | 需测试 `Face Login` 和 `Sign In` 的实际功能。 |
| **GitHub** | 结构清晰，技术栈明确 | Express.js, tRPC, MySQL, Drizzle, MediaPipe | 核心功能模块已完成数据层和基础API，但前端和实时流程仍在进行中。 |
| **核心功能** | 面部识别支付 | MediaPipe, AWS Rekognition, FAISS (计划) | **Sprint 3 (核心安全增强)** 待完成。 |

## 2. Sprint 3 核心安全增强计划 (增量修改)

根据 `implementation_plan.md` (Sprint 3) 和用户“逐个功能完善”的指示，我们将专注于以下高优先级任务，并严格遵循“增量修改”原则。

### 阶段 1: 数据库Schema和向量索引基础 (Week 1)

**目标:** 完成核心安全增强所需的数据结构和向量搜索服务的基础搭建。

| 任务 | 描述 | 涉及文件/模块 | 规则遵循 |
| :--- | :--- | :--- | :--- |
| **1.1 数据库Schema完善** | 新增 `face_index_map`, `payment_methods`, `audit_logs`, `device_bindings`, `face_match_attempts` 5个表。 | `drizzle/schema_security.ts`, `drizzle/schema_payment.ts`, `drizzle/schema_privacy.ts` (需创建或修改) | **增量修改:** 只添加新表和字段，不修改现有核心表结构。 |
| **1.2 数据库迁移脚本** | 创建迁移脚本以应用新的Schema。 | `migrations/` | **文档同步:** 确保迁移脚本与Schema文件同步。 |
| **1.3 FAISS向量索引服务** | 实现FAISS索引服务的Python基础框架，用于面部向量的存储和搜索。 | `server/services/faceAuth/vectorIndex.py` | **增量修改:** 基于现有代码结构添加新服务。 |
| **1.4 全局唯一性检测API** | 实现一个API，用于在注册时检查面部向量是否已存在（唯一性检测）。 | `server/faceAndWalletRouters.ts`, `server/services/faceAuth/vectorIndexBridge.ts` | **功能完善:** 解决 `implementation_plan.md` 中提到的唯一性检测问题。 |
| **1.5 审计日志中间件** | 实现一个tRPC中间件，用于记录关键操作到 `audit_logs` 表。 | `server/middleware/auditLogger.ts` | **功能完善:** 解决 `implementation_plan.md` 中提到的审计日志问题。 |

### 阶段 2: 活体检测和设备安全 (Week 2)

**目标:** 增强活体检测机制，并实现设备绑定功能以提高安全性。

| 任务 | 描述 | 涉及文件/模块 | 规则遵循 |
| :--- | :--- | :--- | :--- |
| **2.1 活体检测增强** | 实现主动挑战检测的逻辑，例如眨眼、转头等。 | `client/src/services/livenessChallenge.ts`, `client/src/pages/FaceEnrollment.tsx` | **增量修改:** 在现有 `FaceEnrollment` 流程中插入挑战步骤。 |
| **2.2 反重放检测** | 实现后端服务，检查视频哈希以防止重放攻击。 | `server/services/faceAuth/antiReplay.ts` | **功能完善:** 解决 `implementation_plan.md` 中提到的反重放问题。 |
| **2.3 设备绑定功能** | 实现用户设备指纹采集和绑定到 `device_bindings` 表的逻辑。 | `client/src/hooks/useDeviceFingerprint.ts` (需创建), `server/routes/privacy.ts` | **功能完善:** 解决 `implementation_plan.md` 中提到的设备绑定问题。 |
| **2.4 部署测试** | 部署当前阶段的成果到测试环境，并进行功能测试。 | `scripts/deploy.sh` | **质量优先:** 确保功能可用。 |

## 3. 文档同步计划

每次完成一个阶段后，将执行以下文档同步操作：

1.  **更新 `implementation_plan.md`:** 标记已完成的任务，并更新当前状态。
2.  **更新 `README.md`:** 如果有核心功能或技术栈的重大更新，进行同步。
3.  **推送至 GitHub:** 确保所有代码和文档更改都推送到 `everest-an/SSP` 仓库。

## 4. 下一步行动

根据阶段 1 的计划，我将首先着手进行数据库Schema的完善和FAISS向量索引服务的实现。

**首要任务:** 完善数据库Schema (任务 1.1 和 1.2)。
