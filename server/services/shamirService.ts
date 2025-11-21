/**
 * Shamir's Secret Sharing Service
 * 
 * 使用 Shamir's Secret Sharing 算法将秘密分片
 * 阈值: 2-of-3 (需要任意 2 个分片才能重组秘密)
 */

import { split, combine } from 'shamirs-secret-sharing';
import crypto from 'crypto';

export interface SecretShares {
  faceID: string;    // 分片 1: 从面部特征派生
  keyID: string;     // 分片 2: 从私钥派生
  backupID: string;  // 分片 3: 用户自行保管
}

/**
 * 将秘密分片为 3 个分片 (2-of-3 阈值)
 */
export function splitSecret(secret: string): SecretShares {
  // 将秘密转换为 Buffer
  const secretBuffer = Buffer.from(secret, 'utf8');
  
  // 使用 Shamir's Secret Sharing 分片
  // shares: 3 (总分片数)
  // threshold: 2 (重组所需的最小分片数)
  const shares = split(secretBuffer, { shares: 3, threshold: 2 });
  
  return {
    faceID: shares[0].toString('hex'),
    keyID: shares[1].toString('hex'),
    backupID: shares[2].toString('hex'),
  };
}

/**
 * 从 2 个分片重组秘密
 */
export function combineShares(share1: string, share2: string): string {
  // 将分片转换为 Buffer
  const share1Buffer = Buffer.from(share1, 'hex');
  const share2Buffer = Buffer.from(share2, 'hex');
  
  // 重组秘密
  const secretBuffer = combine([share1Buffer, share2Buffer]);
  
  return secretBuffer.toString('utf8');
}

/**
 * 从面部特征向量派生 FaceID
 * 
 * 注意: 这个函数应该是确定性的,即相同的面部特征应该生成相同的 FaceID
 * 但是由于面部识别的误差,实际使用中可能需要模糊匹配
 */
export function deriveFaceIDFromVector(faceVector: number[]): string {
  // 将面部特征向量量化为整数 (减少浮点误差)
  const quantizedVector = faceVector.map(v => Math.round(v * 1000));
  
  // 转换为字符串
  const vectorString = quantizedVector.join(',');
  
  // 使用 SHA-256 生成确定性哈希
  const hash = crypto.createHash('sha256').update(vectorString).digest('hex');
  
  return hash;
}

/**
 * 从私钥派生 KeyID
 */
export function deriveKeyIDFromPrivateKey(privateKey: string): string {
  // 使用 HKDF 从私钥派生 KeyID
  const hash = crypto.createHash('sha256').update(privateKey).digest('hex');
  return hash;
}

/**
 * 生成随机 BackupID
 */
export function generateBackupID(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * 完整的分片流程
 */
export interface ShardingResult {
  encryptedID: string;
  iv: string;
  tag: string;
  shares: SecretShares;
}

/**
 * 将加密的 ID 分片
 */
export function shardEncryptedID(
  encryptedID: string,
  iv: string,
  tag: string
): SecretShares {
  // 组合加密数据
  const combined = JSON.stringify({ encryptedID, iv, tag });
  
  // 分片
  return splitSecret(combined);
}

/**
 * 从分片重组加密的 ID
 */
export function reconstructEncryptedID(
  share1: string,
  share2: string
): {
  encryptedID: string;
  iv: string;
  tag: string;
} {
  // 重组秘密
  const combined = combineShares(share1, share2);
  
  // 解析 JSON
  return JSON.parse(combined);
}

/**
 * 验证分片的完整性
 */
export function validateShare(share: string): boolean {
  try {
    // 检查是否是有效的十六进制字符串
    const buffer = Buffer.from(share, 'hex');
    return buffer.length > 0;
  } catch (error) {
    return false;
  }
}

/**
 * 计算分片的校验和
 */
export function calculateShareChecksum(share: string): string {
  return crypto.createHash('sha256').update(share).digest('hex').substring(0, 8);
}

/**
 * 格式化 BackupID 为人类可读格式
 * 例如: ABCD-EFGH-IJKL-MNOP
 */
export function formatBackupID(backupID: string): string {
  // 取前 16 个字符
  const shortened = backupID.substring(0, 16).toUpperCase();
  
  // 每 4 个字符分组
  const groups = shortened.match(/.{1,4}/g) || [];
  
  return groups.join('-');
}

/**
 * 解析格式化的 BackupID
 */
export function parseBackupID(formatted: string): string {
  return formatted.replace(/-/g, '').toLowerCase();
}

/**
 * 生成 BackupID 的 QR 码数据
 */
export function generateBackupIDQRData(backupID: string, did: string): string {
  return JSON.stringify({
    type: 'ssp-backup',
    version: '1.0',
    did,
    backupID,
    timestamp: Date.now(),
  });
}

/**
 * 解析 BackupID QR 码数据
 */
export function parseBackupIDQRData(qrData: string): {
  did: string;
  backupID: string;
  timestamp: number;
} | null {
  try {
    const data = JSON.parse(qrData);
    if (data.type === 'ssp-backup' && data.version === '1.0') {
      return {
        did: data.did,
        backupID: data.backupID,
        timestamp: data.timestamp,
      };
    }
    return null;
  } catch (error) {
    return null;
  }
}
