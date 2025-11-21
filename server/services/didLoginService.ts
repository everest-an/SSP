/**
 * DID Login Service (方案 A: 完整 Shamir 分片)
 * 
 * 整合面部识别、分片重组、ID 解密的完整登录流程
 * 
 * 登录流程:
 * 1. 扫描面部 → 提取特征向量
 * 2. 使用面部特征解密本地存储 → 获取 FaceID 分片
 * 3. 从 Arweave 读取 KeyID 分片
 * 4. 使用 2 个分片重组 EncryptedID
 * 5. 使用私钥解密 ID
 * 6. 验证身份
 */

import crypto from 'crypto';
import {
  extractAddressFromDID,
  decryptUserID,
  decryptData,
  type UserID,
} from './didService';

import {
  reconstructEncryptedID,
  combineShares,
  validateShare,
} from './shamirService';

import {
  readFromArweave,
  readFromArweaveFree,
  isArweaveConfigured,
  type ArweaveUserData,
} from './arweaveService';

import type { LocalStorageData } from './didRegistrationService';

export interface LoginInput {
  faceVector: number[];  // 面部特征向量
}

export interface LoginResult {
  success: boolean;
  did?: string;
  ethAddress?: string;
  userID?: UserID;
  sessionToken?: string;
  message?: string;
}

/**
 * 完整的 DID 登录流程
 */
export async function loginWithDID(
  input: LoginInput,
  encryptedLocalStorage: {
    encrypted: string;
    iv: string;
    tag: string;
  }
): Promise<LoginResult> {
  try {
    console.log('Starting DID login with Shamir reconstruction...');

    // 第 1 步: 使用面部特征解密本地存储
    console.log('Step 1: Decrypting local storage with face vector...');
    
    const vectorString = input.faceVector.map(v => v.toFixed(6)).join(',');
    const key = crypto.createHash('sha256').update(vectorString).digest('hex');
    
    let localData: LocalStorageData;
    try {
      const decrypted = decryptData(
        encryptedLocalStorage.encrypted,
        key,
        encryptedLocalStorage.iv,
        encryptedLocalStorage.tag
      );
      localData = JSON.parse(decrypted);
    } catch (error) {
      console.error('Failed to decrypt local storage:', error);
      return {
        success: false,
        message: 'Face verification failed. Please try again.',
      };
    }

    console.log('Local storage decrypted successfully');
    console.log('DID:', localData.did);

    // 第 2 步: 验证面部特征
    console.log('Step 2: Verifying face match...');
    const faceMatch = verifyFaceMatch(input.faceVector, localData.faceVector, 0.6);
    
    if (!faceMatch) {
      return {
        success: false,
        message: 'Face verification failed. Similarity too low.',
      };
    }

    console.log('Face match verified');

    // 第 3 步: 从 Arweave 读取 KeyID 分片
    console.log('Step 3: Reading KeyID shard from Arweave...');
    let arweaveData: ArweaveUserData | null;
    
    if (isArweaveConfigured()) {
      arweaveData = await readFromArweave(localData.arweaveID);
    } else {
      arweaveData = await readFromArweaveFree(localData.arweaveID);
    }

    if (!arweaveData) {
      return {
        success: false,
        message: 'Failed to read data from Arweave',
      };
    }

    const keyIDShard = arweaveData.keyID;
    console.log('KeyID shard retrieved from Arweave');

    // 第 4 步: 验证分片
    console.log('Step 4: Validating shards...');
    if (!validateShare(localData.faceIDShard)) {
      return {
        success: false,
        message: 'Invalid FaceID shard',
      };
    }
    if (!validateShare(keyIDShard)) {
      return {
        success: false,
        message: 'Invalid KeyID shard',
      };
    }

    // 第 5 步: 重组 EncryptedID
    console.log('Step 5: Reconstructing encrypted ID from shards...');
    const reconstructed = reconstructEncryptedID(
      localData.faceIDShard,
      keyIDShard
    );

    console.log('Encrypted ID reconstructed successfully');

    // 第 6 步: 验证重组的数据与本地存储的数据一致
    if (reconstructed.encryptedID !== localData.encryptedID) {
      console.warn('Reconstructed encryptedID does not match local storage');
      // 继续尝试,可能是数据更新了
    }

    // 第 7 步: 使用私钥解密 ID
    console.log('Step 6: Decrypting user ID...');
    const userID = decryptUserID(
      reconstructed.encryptedID,
      localData.privateKey,
      reconstructed.iv,
      reconstructed.tag
    );

    // 第 8 步: 验证 DID
    if (userID.did !== localData.did) {
      return {
        success: false,
        message: 'DID mismatch after decryption',
      };
    }

    // 第 9 步: 提取以太坊地址
    const ethAddress = extractAddressFromDID(userID.did);
    if (!ethAddress) {
      return {
        success: false,
        message: 'Invalid DID format',
      };
    }

    // 第 10 步: 生成会话令牌
    console.log('Step 7: Generating session token...');
    const sessionToken = generateSessionToken(userID);

    console.log('Login successful!');
    return {
      success: true,
      did: userID.did,
      ethAddress: userID.ethAddress,
      userID,
      sessionToken,
      message: 'Login successful',
    };
  } catch (error) {
    console.error('DID login failed:', error);
    return {
      success: false,
      message: `Login failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

/**
 * 使用 BackupID 恢复
 * 
 * 当用户丢失设备或无法使用面部识别时使用
 */
export async function recoverWithBackupID(
  did: string,
  backupIDShard: string,
  arweaveID: string
): Promise<{
  success: boolean;
  privateKey?: string;
  userID?: UserID;
  message?: string;
}> {
  try {
    console.log('Recovering with BackupID...');

    // 第 1 步: 从 Arweave 读取 KeyID 分片
    console.log('Step 1: Reading KeyID shard from Arweave...');
    let arweaveData: ArweaveUserData | null;
    
    if (isArweaveConfigured()) {
      arweaveData = await readFromArweave(arweaveID);
    } else {
      arweaveData = await readFromArweaveFree(arweaveID);
    }

    if (!arweaveData) {
      return {
        success: false,
        message: 'Failed to read data from Arweave',
      };
    }

    const keyIDShard = arweaveData.keyID;
    console.log('KeyID shard retrieved');

    // 第 2 步: 验证分片
    if (!validateShare(backupIDShard)) {
      return {
        success: false,
        message: 'Invalid BackupID shard',
      };
    }
    if (!validateShare(keyIDShard)) {
      return {
        success: false,
        message: 'Invalid KeyID shard',
      };
    }

    // 第 3 步: 使用 BackupID 和 KeyID 重组 EncryptedID
    console.log('Step 2: Reconstructing encrypted ID...');
    const reconstructed = reconstructEncryptedID(
      backupIDShard,
      keyIDShard
    );

    console.log('Encrypted ID reconstructed');

    // 第 4 步: 需要私钥来解密
    // 问题: 私钥存储在本地,如果设备丢失,无法恢复
    // 解决方案: 在注册时,让用户导出私钥并保管

    return {
      success: false,
      message: 'Recovery requires private key. Please import your private key backup.',
    };
  } catch (error) {
    console.error('Recovery with BackupID failed:', error);
    return {
      success: false,
      message: `Recovery failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

/**
 * 使用 BackupID + 私钥恢复 (完整恢复)
 */
export async function recoverWithBackupIDAndPrivateKey(
  did: string,
  backupIDShard: string,
  privateKey: string,
  arweaveID: string
): Promise<LoginResult> {
  try {
    console.log('Recovering with BackupID and private key...');

    // 第 1 步: 从 Arweave 读取 KeyID 分片
    let arweaveData: ArweaveUserData | null;
    
    if (isArweaveConfigured()) {
      arweaveData = await readFromArweave(arweaveID);
    } else {
      arweaveData = await readFromArweaveFree(arweaveID);
    }

    if (!arweaveData) {
      return {
        success: false,
        message: 'Failed to read data from Arweave',
      };
    }

    const keyIDShard = arweaveData.keyID;

    // 第 2 步: 重组 EncryptedID
    const reconstructed = reconstructEncryptedID(
      backupIDShard,
      keyIDShard
    );

    // 第 3 步: 使用私钥解密 ID
    const userID = decryptUserID(
      reconstructed.encryptedID,
      privateKey,
      reconstructed.iv,
      reconstructed.tag
    );

    // 第 4 步: 验证 DID
    if (userID.did !== did) {
      return {
        success: false,
        message: 'DID mismatch',
      };
    }

    // 第 5 步: 生成会话令牌
    const sessionToken = generateSessionToken(userID);

    console.log('Recovery successful!');
    return {
      success: true,
      did: userID.did,
      ethAddress: userID.ethAddress,
      userID,
      sessionToken,
      message: 'Recovery successful. Please re-register your face.',
    };
  } catch (error) {
    console.error('Recovery failed:', error);
    return {
      success: false,
      message: `Recovery failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

/**
 * 面部特征匹配
 * 
 * 计算两个面部特征向量的相似度
 */
export function compareFaceVectors(
  vector1: number[],
  vector2: number[]
): number {
  if (vector1.length !== vector2.length) {
    throw new Error('Vectors must have the same length');
  }

  // 计算余弦相似度
  let dotProduct = 0;
  let norm1 = 0;
  let norm2 = 0;

  for (let i = 0; i < vector1.length; i++) {
    dotProduct += vector1[i] * vector2[i];
    norm1 += vector1[i] * vector1[i];
    norm2 += vector2[i] * vector2[i];
  }

  const similarity = dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
  return similarity;
}

/**
 * 验证面部匹配
 */
export function verifyFaceMatch(
  currentVector: number[],
  storedVector: number[],
  threshold: number = 0.6
): boolean {
  const similarity = compareFaceVectors(currentVector, storedVector);
  console.log('Face similarity:', similarity);
  return similarity >= threshold;
}

/**
 * 生成会话令牌
 */
export function generateSessionToken(userID: UserID): string {
  const payload = {
    did: userID.did,
    ethAddress: userID.ethAddress,
    timestamp: Date.now(),
    exp: Date.now() + 24 * 60 * 60 * 1000, // 24 小时过期
  };

  // 简化实现: 使用 base64 编码
  // 实际应该使用 JWT
  return Buffer.from(JSON.stringify(payload)).toString('base64');
}

/**
 * 验证会话令牌
 */
export function verifySessionToken(token: string): {
  valid: boolean;
  userID?: UserID;
  message?: string;
} {
  try {
    const payload = JSON.parse(Buffer.from(token, 'base64').toString('utf8'));

    // 检查过期时间
    if (payload.exp < Date.now()) {
      return {
        valid: false,
        message: 'Session expired',
      };
    }

    return {
      valid: true,
      userID: {
        did: payload.did,
        ethAddress: payload.ethAddress,
        publicKey: '',
        timestamp: payload.timestamp,
      },
    };
  } catch (error) {
    return {
      valid: false,
      message: 'Invalid session token',
    };
  }
}

/**
 * 验证登录输入
 */
export function validateLoginInput(input: LoginInput): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // 验证面部特征向量
  if (!input.faceVector || !Array.isArray(input.faceVector)) {
    errors.push('Face vector is required and must be an array');
  } else if (input.faceVector.length !== 512) {
    errors.push(`Face vector must have 512 dimensions, got ${input.faceVector.length}`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
