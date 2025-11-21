/**
 * DID (Decentralized Identifier) Service
 * 
 * 负责生成和管理去中心化身份
 */

import { ethers } from 'ethers';
import crypto from 'crypto';

export interface DIDDocument {
  '@context': string[];
  id: string;
  controller: string;
  verificationMethod: Array<{
    id: string;
    type: string;
    controller: string;
    publicKeyHex: string;
  }>;
  authentication: string[];
  service: Array<{
    id: string;
    type: string;
    serviceEndpoint: string;
  }>;
}

export interface UserIdentity {
  did: string;
  ethAddress: string;
  publicKey: string;
  privateKey: string; // 应该加密存储
  didDocument: DIDDocument;
}

/**
 * 生成以太坊密钥对
 */
export function generateEthereumKeyPair(): {
  privateKey: string;
  publicKey: string;
  address: string;
} {
  // 生成随机钱包
  const wallet = ethers.Wallet.createRandom();
  
  return {
    privateKey: wallet.privateKey,
    publicKey: wallet.publicKey,
    address: wallet.address,
  };
}

/**
 * 从私钥恢复钱包
 */
export function getWalletFromPrivateKey(privateKey: string): ethers.Wallet {
  return new ethers.Wallet(privateKey);
}

/**
 * 生成 DID
 * 格式: did:ethr:0x[ethereum_address]
 */
export function generateDID(ethAddress: string): string {
  // 确保地址格式正确
  const address = ethAddress.toLowerCase();
  return `did:ethr:${address}`;
}

/**
 * 创建 DID 文档
 */
export function createDIDDocument(
  did: string,
  ethAddress: string,
  publicKey: string,
  arweaveID?: string,
  faceHashIPFS?: string
): DIDDocument {
  const didDocument: DIDDocument = {
    '@context': [
      'https://www.w3.org/ns/did/v1',
      'https://w3id.org/security/suites/secp256k1-2019/v1',
    ],
    id: did,
    controller: did,
    verificationMethod: [
      {
        id: `${did}#controller`,
        type: 'EcdsaSecp256k1VerificationKey2019',
        controller: did,
        publicKeyHex: publicKey,
      },
    ],
    authentication: [`${did}#controller`],
    service: [],
  };

  // 添加 SSP 钱包服务端点
  if (arweaveID) {
    didDocument.service.push({
      id: `${did}#ssp-wallet`,
      type: 'SSPWallet',
      serviceEndpoint: `ar://${arweaveID}`,
    });
  }

  // 添加面部数据服务端点
  if (faceHashIPFS) {
    didDocument.service.push({
      id: `${did}#face-data`,
      type: 'FaceData',
      serviceEndpoint: `ipfs://${faceHashIPFS}`,
    });
  }

  return didDocument;
}

/**
 * 生成完整的用户身份
 */
export function generateUserIdentity(): UserIdentity {
  // 1. 生成以太坊密钥对
  const { privateKey, publicKey, address } = generateEthereumKeyPair();

  // 2. 生成 DID
  const did = generateDID(address);

  // 3. 创建 DID 文档
  const didDocument = createDIDDocument(did, address, publicKey);

  return {
    did,
    ethAddress: address,
    publicKey,
    privateKey,
    didDocument,
  };
}

/**
 * 验证 DID 格式
 */
export function validateDID(did: string): boolean {
  const didRegex = /^did:ethr:0x[a-fA-F0-9]{40}$/;
  return didRegex.test(did);
}

/**
 * 从 DID 提取以太坊地址
 */
export function extractAddressFromDID(did: string): string | null {
  if (!validateDID(did)) {
    return null;
  }
  return did.replace('did:ethr:', '');
}

/**
 * 使用私钥签名消息
 */
export function signMessage(message: string, privateKey: string): string {
  const wallet = new ethers.Wallet(privateKey);
  const messageHash = ethers.hashMessage(message);
  const signature = wallet.signMessageSync(message);
  return signature;
}

/**
 * 验证签名
 */
export function verifySignature(
  message: string,
  signature: string,
  expectedAddress: string
): boolean {
  try {
    const recoveredAddress = ethers.verifyMessage(message, signature);
    return recoveredAddress.toLowerCase() === expectedAddress.toLowerCase();
  } catch (error) {
    console.error('Signature verification failed:', error);
    return false;
  }
}

/**
 * 从面部特征生成确定性的种子
 * (用于派生 FaceID 分片)
 */
export function generateSeedFromFaceVector(faceVector: number[]): string {
  // 将面部特征向量转换为字符串
  const vectorString = faceVector.map(v => v.toFixed(6)).join(',');
  
  // 使用 SHA-256 生成确定性哈希
  const hash = crypto.createHash('sha256').update(vectorString).digest('hex');
  
  return hash;
}

/**
 * 加密数据
 */
export function encryptData(data: string, key: string): {
  encrypted: string;
  iv: string;
  tag: string;
} {
  // 从密钥派生加密密钥
  const derivedKey = crypto.pbkdf2Sync(key, 'ssp-salt', 100000, 32, 'sha256');
  
  // 生成随机 IV
  const iv = crypto.randomBytes(12);
  
  // 创建加密器
  const cipher = crypto.createCipheriv('aes-256-gcm', derivedKey, iv);
  
  // 加密数据
  let encrypted = cipher.update(data, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  // 获取认证标签
  const tag = cipher.getAuthTag();
  
  return {
    encrypted,
    iv: iv.toString('hex'),
    tag: tag.toString('hex'),
  };
}

/**
 * 解密数据
 */
export function decryptData(
  encrypted: string,
  key: string,
  iv: string,
  tag: string
): string {
  // 从密钥派生加密密钥
  const derivedKey = crypto.pbkdf2Sync(key, 'ssp-salt', 100000, 32, 'sha256');
  
  // 创建解密器
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    derivedKey,
    Buffer.from(iv, 'hex')
  );
  
  // 设置认证标签
  decipher.setAuthTag(Buffer.from(tag, 'hex'));
  
  // 解密数据
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

/**
 * 生成 ID 对象
 */
export interface UserID {
  did: string;
  ethAddress: string;
  publicKey: string;
  timestamp: number;
}

export function createUserID(identity: UserIdentity): UserID {
  return {
    did: identity.did,
    ethAddress: identity.ethAddress,
    publicKey: identity.publicKey,
    timestamp: Date.now(),
  };
}

/**
 * 加密 ID
 */
export function encryptUserID(
  userID: UserID,
  privateKey: string
): {
  encryptedID: string;
  iv: string;
  tag: string;
} {
  const idString = JSON.stringify(userID);
  return encryptData(idString, privateKey);
}

/**
 * 解密 ID
 */
export function decryptUserID(
  encryptedID: string,
  privateKey: string,
  iv: string,
  tag: string
): UserID {
  const decrypted = decryptData(encryptedID, privateKey, iv, tag);
  return JSON.parse(decrypted);
}
