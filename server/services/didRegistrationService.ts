/**
 * DID Registration Service (方案 A: 完整 Shamir 分片)
 * 
 * 整合 DID 生成、加密分片、Arweave 存储的完整注册流程
 * 
 * 架构:
 * 1. 生成 3 个随机的 Shamir 分片
 * 2. FaceID 分片: 加密后存储在本地设备
 * 3. KeyID 分片: 存储在 Arweave (公开)
 * 4. BackupID 分片: 用户保管 (纸质/硬件)
 */

import crypto from 'crypto';
import {
  generateUserIdentity,
  createUserID,
  encryptUserID,
  signMessage,
  encryptData,
  type UserIdentity,
  type UserID,
} from './didService';

import {
  shardEncryptedID,
  formatBackupID,
  generateBackupIDQRData,
  type SecretShares,
} from './shamirService';

import {
  uploadToArweaveFree,
  createUserData,
  isArweaveConfigured,
  uploadToArweave,
  getConfiguredWallet,
  type ArweaveUserData,
} from './arweaveService';

export interface RegistrationInput {
  email?: string;  // 可选,用于恢复
  faceVector: number[];  // 面部特征向量 (512 维)
  deviceInfo?: string;
}

export interface RegistrationResult {
  success: boolean;
  did: string;
  ethAddress: string;
  privateKey: string;  // 返回给前端,由前端加密存储
  
  // Shamir 分片
  faceIDShard: string;  // 分片 1: 需要加密存储在本地
  keyIDShard: string;   // 分片 2: 已上传到 Arweave
  backupIDShard: string;  // 分片 3: 用户需要保管
  
  // 格式化的 BackupID
  backupIDFormatted: string;  // 例如: ABCD-EFGH-IJKL-MNOP
  backupQR: string;  // BackupID 的 QR 码数据
  
  // Arweave 信息
  arweaveID: string;  // Arweave 交易 ID
  
  // 加密数据 (用于验证)
  encryptedID: string;
  iv: string;
  tag: string;
  
  message?: string;
}

/**
 * 完整的 DID 注册流程
 */
export async function registerDID(
  input: RegistrationInput
): Promise<RegistrationResult> {
  try {
    console.log('Starting DID registration with Shamir sharding...');

    // 第 1 步: 生成用户身份
    console.log('Step 1: Generating user identity...');
    const identity: UserIdentity = generateUserIdentity();
    console.log('DID generated:', identity.did);
    console.log('Ethereum address:', identity.ethAddress);

    // 第 2 步: 创建 ID 对象
    console.log('Step 2: Creating user ID...');
    const userID: UserID = createUserID(identity);

    // 第 3 步: 加密 ID
    console.log('Step 3: Encrypting user ID...');
    const { encryptedID, iv, tag } = encryptUserID(userID, identity.privateKey);

    // 第 4 步: Shamir 分片 (3 个随机分片, 2-of-3 阈值)
    console.log('Step 4: Creating Shamir shards...');
    const shares: SecretShares = shardEncryptedID(encryptedID, iv, tag);
    
    console.log('Shamir shards created:');
    console.log('- FaceID shard length:', shares.faceID.length);
    console.log('- KeyID shard length:', shares.keyID.length);
    console.log('- BackupID shard length:', shares.backupID.length);

    // 第 5 步: 格式化 BackupID
    console.log('Step 5: Formatting BackupID...');
    const backupIDFormatted = formatBackupID(shares.backupID);
    const backupQR = generateBackupIDQRData(shares.backupID, identity.did);

    // 第 6 步: 签名数据
    console.log('Step 6: Signing data...');
    const dataToSign = JSON.stringify({
      did: identity.did,
      keyIDShard: shares.keyID,
      timestamp: Date.now(),
    });
    const signature = signMessage(dataToSign, identity.privateKey);

    // 第 7 步: 上传 KeyID 分片到 Arweave
    console.log('Step 7: Uploading KeyID shard to Arweave...');
    const arweaveData: ArweaveUserData = {
      ...createUserData(
        identity.did,
        shares.keyID,  // 存储 Shamir 分片 2 (KeyID)
        signature
      ),
      // 添加面部特征哈希 (用于验证,不是原始向量)
      faceHashIPFS: crypto.createHash('sha256')
        .update(JSON.stringify(input.faceVector))
        .digest('hex'),
    };

    let arweaveID: string;
    if (isArweaveConfigured()) {
      const wallet = getConfiguredWallet();
      if (wallet) {
        arweaveID = await uploadToArweave(arweaveData, wallet);
      } else {
        arweaveID = await uploadToArweaveFree(arweaveData);
      }
    } else {
      arweaveID = await uploadToArweaveFree(arweaveData);
    }

    console.log('Arweave TX ID:', arweaveID);

    // 第 8 步: 返回结果
    console.log('DID registration completed successfully!');
    
    return {
      success: true,
      did: identity.did,
      ethAddress: identity.ethAddress,
      privateKey: identity.privateKey,
      
      // Shamir 分片
      faceIDShard: shares.faceID,
      keyIDShard: shares.keyID,
      backupIDShard: shares.backupID,
      
      // 格式化的 BackupID
      backupIDFormatted,
      backupQR,
      
      // Arweave 信息
      arweaveID,
      
      // 加密数据
      encryptedID,
      iv,
      tag,
      
      message: 'DID registration successful. Please save your BackupID and private key in a safe place.',
    };
  } catch (error) {
    console.error('DID registration failed:', error);
    throw error;
  }
}

/**
 * 本地存储数据结构
 * 
 * 这些数据应该加密存储在用户设备上
 */
export interface LocalStorageData {
  did: string;
  ethAddress: string;
  privateKey: string;  // 加密存储
  faceIDShard: string;  // Shamir 分片 1 (加密存储)
  faceVector: number[];  // 面部特征向量 (加密存储,用于验证)
  arweaveID: string;
  encryptedID: string;
  iv: string;
  tag: string;
  createdAt: number;
}

/**
 * 创建本地存储数据
 */
export function createLocalStorageData(
  result: RegistrationResult,
  faceVector: number[]
): LocalStorageData {
  return {
    did: result.did,
    ethAddress: result.ethAddress,
    privateKey: result.privateKey,
    faceIDShard: result.faceIDShard,
    faceVector,
    arweaveID: result.arweaveID,
    encryptedID: result.encryptedID,
    iv: result.iv,
    tag: result.tag,
    createdAt: Date.now(),
  };
}

/**
 * 加密本地存储数据
 * 
 * 使用用户的面部特征作为加密密钥
 */
export function encryptLocalStorage(
  data: LocalStorageData,
  faceVector: number[]
): {
  encrypted: string;
  iv: string;
  tag: string;
} {
  // 从面部特征派生加密密钥
  const vectorString = faceVector.map(v => v.toFixed(6)).join(',');
  const key = crypto.createHash('sha256').update(vectorString).digest('hex');
  
  // 加密数据
  return encryptData(JSON.stringify(data), key);
}

/**
 * 解密本地存储数据
 */
export function decryptLocalStorage(
  encrypted: string,
  iv: string,
  tag: string,
  faceVector: number[]
): LocalStorageData {
  // 从面部特征派生解密密钥
  const vectorString = faceVector.map(v => v.toFixed(6)).join(',');
  const key = crypto.createHash('sha256').update(vectorString).digest('hex');
  
  // 解密数据
  const { decryptData } = require('./didService');
  const decrypted = decryptData(encrypted, key, iv, tag);
  
  return JSON.parse(decrypted);
}

/**
 * 数据库存储数据结构
 * 
 * 这些数据存储在服务器数据库中
 * 注意: 不存储私钥和分片
 */
export interface DatabaseRecord {
  did: string;
  ethAddress: string;
  publicKey: string;
  faceVectorHash: string;  // 面部特征向量的哈希
  arweaveID: string;
  email?: string;
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
}

/**
 * 创建数据库记录
 */
export function createDatabaseRecord(
  result: RegistrationResult,
  faceVector: number[],
  email?: string
): DatabaseRecord {
  // 计算面部特征向量的哈希
  const faceVectorHash = crypto.createHash('sha256')
    .update(JSON.stringify(faceVector))
    .digest('hex');

  return {
    did: result.did,
    ethAddress: result.ethAddress,
    publicKey: '', // 需要从 identity 获取
    faceVectorHash,
    arweaveID: result.arweaveID,
    email,
    createdAt: new Date(),
    updatedAt: new Date(),
    isActive: true,
  };
}

/**
 * 验证注册输入
 */
export function validateRegistrationInput(input: RegistrationInput): {
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

  // 验证邮箱 (可选)
  if (input.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) {
    errors.push('Invalid email format');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * 生成注册摘要 (用于日志和审计)
 */
export interface RegistrationSummary {
  did: string;
  ethAddress: string;
  arweaveID: string;
  timestamp: number;
  deviceInfo?: string;
  hasBackup: boolean;
}

export function createRegistrationSummary(
  result: RegistrationResult,
  deviceInfo?: string
): RegistrationSummary {
  return {
    did: result.did,
    ethAddress: result.ethAddress,
    arweaveID: result.arweaveID,
    timestamp: Date.now(),
    deviceInfo,
    hasBackup: result.backupIDShard.length > 0,
  };
}
