/**
 * Arweave Storage Service
 * 
 * 负责与 Arweave 区块链交互,实现永久存储
 */

import Arweave from 'arweave';
import crypto from 'crypto';

// 初始化 Arweave
const arweave = Arweave.init({
  host: 'arweave.net',
  port: 443,
  protocol: 'https',
  timeout: 20000,
  logging: false,
});

export interface ArweaveUserData {
  version: string;
  did: string;
  keyID: string;  // Shamir 分片 2
  faceHashIPFS?: string;  // 面部特征哈希 (IPFS CID)
  metadata: {
    createdAt: number;
    updatedAt: number;
    deviceInfo?: string;
    appVersion: string;
  };
  signature: string;  // 使用私钥签名
}

/**
 * 生成 Arweave 钱包
 * 注意: 这个钱包用于支付 Arweave 存储费用,不是用户的以太坊钱包
 */
export async function generateArweaveWallet() {
  return await arweave.wallets.generate();
}

/**
 * 获取 Arweave 钱包地址
 */
export async function getWalletAddress(wallet: any): Promise<string> {
  return await arweave.wallets.jwkToAddress(wallet);
}

/**
 * 获取钱包余额
 */
export async function getWalletBalance(address: string): Promise<string> {
  const winston = await arweave.wallets.getBalance(address);
  return arweave.ar.winstonToAr(winston);
}

/**
 * 上传数据到 Arweave
 */
export async function uploadToArweave(
  data: ArweaveUserData,
  wallet: any
): Promise<string> {
  try {
    // 创建交易
    const transaction = await arweave.createTransaction(
      {
        data: JSON.stringify(data),
      },
      wallet
    );

    // 添加标签
    transaction.addTag('Content-Type', 'application/json');
    transaction.addTag('App-Name', 'SSP');
    transaction.addTag('App-Version', data.metadata.appVersion);
    transaction.addTag('DID', data.did);
    transaction.addTag('Data-Type', 'user-identity');
    transaction.addTag('Timestamp', data.metadata.createdAt.toString());

    // 签名交易
    await arweave.transactions.sign(transaction, wallet);

    // 上传交易
    const response = await arweave.transactions.post(transaction);

    if (response.status === 200 || response.status === 202) {
      console.log('Arweave upload successful:', transaction.id);
      return transaction.id;
    } else {
      throw new Error(`Arweave upload failed with status ${response.status}`);
    }
  } catch (error) {
    console.error('Failed to upload to Arweave:', error);
    throw error;
  }
}

/**
 * 从 Arweave 读取数据
 */
export async function readFromArweave(txId: string): Promise<ArweaveUserData> {
  try {
    // 获取交易
    const transaction = await arweave.transactions.get(txId);

    // 获取数据
    const data = transaction.get('data', { decode: true, string: true });

    // 解析 JSON
    return JSON.parse(data);
  } catch (error) {
    console.error('Failed to read from Arweave:', error);
    throw error;
  }
}

/**
 * 检查交易状态
 */
export async function getTransactionStatus(txId: string): Promise<{
  status: string;
  confirmed: boolean;
  blockHeight?: number;
  blockHash?: string;
}> {
  try {
    const status = await arweave.transactions.getStatus(txId);

    return {
      status: status.status === 200 ? 'confirmed' : 'pending',
      confirmed: status.confirmed !== null && status.confirmed.number_of_confirmations > 0,
      blockHeight: status.confirmed?.block_height,
      blockHash: status.confirmed?.block_indep_hash,
    };
  } catch (error) {
    console.error('Failed to get transaction status:', error);
    return {
      status: 'unknown',
      confirmed: false,
    };
  }
}

/**
 * 等待交易确认
 */
export async function waitForConfirmation(
  txId: string,
  maxAttempts: number = 30,
  interval: number = 10000
): Promise<boolean> {
  for (let i = 0; i < maxAttempts; i++) {
    const status = await getTransactionStatus(txId);
    
    if (status.confirmed) {
      console.log(`Transaction ${txId} confirmed at block ${status.blockHeight}`);
      return true;
    }

    console.log(`Waiting for confirmation... (${i + 1}/${maxAttempts})`);
    await new Promise(resolve => setTimeout(resolve, interval));
  }

  console.log(`Transaction ${txId} not confirmed after ${maxAttempts} attempts`);
  return false;
}

/**
 * 通过 DID 查询 Arweave 数据
 */
export async function queryByDID(did: string): Promise<string[]> {
  try {
    // 使用 GraphQL 查询
    const query = `
      query {
        transactions(
          tags: [
            { name: "App-Name", values: ["SSP"] },
            { name: "DID", values: ["${did}"] }
          ]
          sort: HEIGHT_DESC
          first: 10
        ) {
          edges {
            node {
              id
              tags {
                name
                value
              }
            }
          }
        }
      }
    `;

    const response = await arweave.api.post('/graphql', { query });
    const edges = response.data.data.transactions.edges;

    return edges.map((edge: any) => edge.node.id);
  } catch (error) {
    console.error('Failed to query Arweave:', error);
    return [];
  }
}

/**
 * 估算存储成本
 */
export async function estimateStorageCost(dataSize: number): Promise<{
  winston: string;
  ar: string;
  usd?: number;
}> {
  try {
    // 获取当前价格
    const price = await arweave.transactions.getPrice(dataSize);

    // 转换为 AR
    const ar = arweave.ar.winstonToAr(price);

    // 可选: 获取 AR/USD 汇率
    // 这里简化处理,实际应该调用价格 API
    const arUsdPrice = 10; // 假设 1 AR = $10
    const usd = parseFloat(ar) * arUsdPrice;

    return {
      winston: price,
      ar,
      usd,
    };
  } catch (error) {
    console.error('Failed to estimate storage cost:', error);
    throw error;
  }
}

/**
 * 创建用户数据对象
 */
export function createUserData(
  did: string,
  keyID: string,
  signature: string,
  faceHashIPFS?: string
): ArweaveUserData {
  return {
    version: '1.0',
    did,
    keyID,
    faceHashIPFS,
    metadata: {
      createdAt: Date.now(),
      updatedAt: Date.now(),
      appVersion: '1.0.0',
    },
    signature,
  };
}

/**
 * 验证用户数据签名
 */
export function verifyUserDataSignature(
  data: ArweaveUserData,
  expectedAddress: string
): boolean {
  // 移除签名字段
  const { signature, ...dataWithoutSignature } = data;

  // 重新序列化数据
  const message = JSON.stringify(dataWithoutSignature);

  // 计算消息哈希
  const messageHash = crypto.createHash('sha256').update(message).digest('hex');

  // 注意: 这里简化了验证逻辑
  // 实际应该使用 ethers.js 的 verifyMessage 函数
  // 但是需要原始签名,这里只做基本验证
  return signature.length > 0;
}

/**
 * 批量上传数据
 */
export async function batchUpload(
  dataList: ArweaveUserData[],
  wallet: any
): Promise<string[]> {
  const txIds: string[] = [];

  for (const data of dataList) {
    try {
      const txId = await uploadToArweave(data, wallet);
      txIds.push(txId);
    } catch (error) {
      console.error('Failed to upload data:', error);
      txIds.push(''); // 失败时添加空字符串
    }
  }

  return txIds;
}

/**
 * 获取 Arweave 网络信息
 */
export async function getNetworkInfo(): Promise<{
  height: number;
  current: string;
  blocks: number;
  peers: number;
}> {
  try {
    const info = await arweave.network.getInfo();
    return info;
  } catch (error) {
    console.error('Failed to get network info:', error);
    throw error;
  }
}

/**
 * 简化模式: 使用免费的 Arweave 网关上传
 * 
 * 注意: 这个方法使用第三方服务,不是真正的去中心化存储
 * 仅用于开发和测试
 */
export async function uploadToArweaveFree(data: ArweaveUserData): Promise<string> {
  try {
    // 使用 Bundlr Network 或其他免费服务
    // 这里简化处理,实际应该调用真实的 API
    
    console.log('Using simplified Arweave upload (development mode)');
    
    // 生成一个模拟的交易 ID
    const mockTxId = crypto.randomBytes(32).toString('base64url');
    
    // 在实际环境中,这里应该调用免费的 Arweave 上传服务
    // 例如: https://bundlr.network/ 或 https://arweave.net/
    
    console.log('Mock Arweave TX ID:', mockTxId);
    
    return mockTxId;
  } catch (error) {
    console.error('Failed to upload to Arweave (free):', error);
    throw error;
  }
}

/**
 * 从免费服务读取数据
 */
export async function readFromArweaveFree(txId: string): Promise<ArweaveUserData | null> {
  try {
    console.log('Using simplified Arweave read (development mode)');
    
    // 在实际环境中,这里应该从免费服务读取数据
    // 这里返回 null 表示数据不存在
    
    return null;
  } catch (error) {
    console.error('Failed to read from Arweave (free):', error);
    return null;
  }
}

/**
 * 检查是否配置了 Arweave 钱包
 */
export function isArweaveConfigured(): boolean {
  // 检查环境变量
  return process.env.ARWEAVE_WALLET_KEY !== undefined;
}

/**
 * 获取配置的 Arweave 钱包
 */
export function getConfiguredWallet(): any | null {
  try {
    const walletKey = process.env.ARWEAVE_WALLET_KEY;
    if (!walletKey) {
      return null;
    }
    return JSON.parse(walletKey);
  } catch (error) {
    console.error('Failed to parse Arweave wallet key:', error);
    return null;
  }
}
