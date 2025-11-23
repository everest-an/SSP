/**
 * Filecoin Storage Service
 * 
 * 使用 Synapse SDK 实现 Filecoin 去中心化存储
 * 用于存储用户账单、商品数据等
 */

import { Synapse, RPC_URLS, TIME_CONSTANTS } from '@filoz/synapse-sdk';
import { ethers } from 'ethers';
import crypto from 'crypto';

// Filecoin 网络配置
const FILECOIN_NETWORK = process.env.FILECOIN_NETWORK || 'mainnet';
const FILECOIN_PRIVATE_KEY = process.env.FILECOIN_PRIVATE_KEY;

// 存储类型枚举
export enum StorageType {
  INVOICE = 'invoice',           // 账单
  PRODUCT_IMAGE = 'product_image', // 商品图片
  PRODUCT_DATA = 'product_data',   // 商品数据
  KYC_DOCUMENT = 'kyc_document',   // KYC 文档
  RECEIPT = 'receipt',             // 收据
  MERCHANT_LOGO = 'merchant_logo', // 商户 Logo
}

// 存储元数据接口
export interface StorageMetadata {
  type: StorageType;
  userId?: string;
  merchantId?: string;
  productId?: string;
  orderId?: string;
  filename: string;
  mimeType: string;
  size: number;
  uploadedAt: number;
  description?: string;
}

// 存储结果接口
export interface StorageResult {
  pieceCid: string;      // Filecoin Piece CID
  size: number;          // 文件大小（字节）
  metadata: StorageMetadata;
  uploadedAt: number;
}

// Synapse SDK 实例（单例模式）
let synapseInstance: Synapse | null = null;

/**
 * 初始化 Synapse SDK
 */
async function getSynapseInstance(): Promise<Synapse> {
  if (synapseInstance) {
    return synapseInstance;
  }

  if (!FILECOIN_PRIVATE_KEY) {
    throw new Error('FILECOIN_PRIVATE_KEY is not configured in environment variables');
  }

  const rpcURL = FILECOIN_NETWORK === 'mainnet' 
    ? RPC_URLS.mainnet.http 
    : RPC_URLS.calibration.http;

  synapseInstance = await Synapse.create({
    privateKey: FILECOIN_PRIVATE_KEY,
    rpcURL,
  });

  console.log(`Synapse SDK initialized for ${FILECOIN_NETWORK} network`);
  return synapseInstance;
}

/**
 * 检查是否已配置 Filecoin
 */
export function isFilecoinConfigured(): boolean {
  return FILECOIN_PRIVATE_KEY !== undefined && FILECOIN_PRIVATE_KEY !== '';
}

/**
 * 上传数据到 Filecoin
 */
export async function uploadToFilecoin(
  data: Buffer | Uint8Array,
  metadata: StorageMetadata
): Promise<StorageResult> {
  try {
    const synapse = await getSynapseInstance();

    // 上传数据
    const { pieceCid, size } = await synapse.storage.upload(data);

    console.log(`File uploaded to Filecoin - CID: ${pieceCid}, Size: ${size} bytes`);

    return {
      pieceCid,
      size,
      metadata,
      uploadedAt: Date.now(),
    };
  } catch (error) {
    console.error('Failed to upload to Filecoin:', error);
    throw error;
  }
}

/**
 * 从 Filecoin 下载数据
 */
export async function downloadFromFilecoin(pieceCid: string): Promise<Buffer> {
  try {
    const synapse = await getSynapseInstance();

    // 下载数据
    const bytes = await synapse.storage.download(pieceCid);

    console.log(`File downloaded from Filecoin - CID: ${pieceCid}`);

    return Buffer.from(bytes);
  } catch (error) {
    console.error('Failed to download from Filecoin:', error);
    throw error;
  }
}

/**
 * 上传文本数据到 Filecoin
 */
export async function uploadTextToFilecoin(
  text: string,
  metadata: StorageMetadata
): Promise<StorageResult> {
  const data = new TextEncoder().encode(text);
  return uploadToFilecoin(data, metadata);
}

/**
 * 从 Filecoin 下载文本数据
 */
export async function downloadTextFromFilecoin(pieceCid: string): Promise<string> {
  const buffer = await downloadFromFilecoin(pieceCid);
  return new TextDecoder().decode(buffer);
}

/**
 * 上传 JSON 数据到 Filecoin
 */
export async function uploadJSONToFilecoin(
  jsonData: any,
  metadata: StorageMetadata
): Promise<StorageResult> {
  const text = JSON.stringify(jsonData, null, 2);
  return uploadTextToFilecoin(text, metadata);
}

/**
 * 从 Filecoin 下载 JSON 数据
 */
export async function downloadJSONFromFilecoin(pieceCid: string): Promise<any> {
  const text = await downloadTextFromFilecoin(pieceCid);
  return JSON.parse(text);
}

/**
 * 上传账单到 Filecoin
 */
export async function uploadInvoice(
  invoiceData: Buffer,
  userId: string,
  orderId: string,
  filename: string
): Promise<StorageResult> {
  const metadata: StorageMetadata = {
    type: StorageType.INVOICE,
    userId,
    orderId,
    filename,
    mimeType: 'application/pdf',
    size: invoiceData.length,
    uploadedAt: Date.now(),
    description: `Invoice for order ${orderId}`,
  };

  return uploadToFilecoin(invoiceData, metadata);
}

/**
 * 上传商品图片到 Filecoin
 */
export async function uploadProductImage(
  imageData: Buffer,
  productId: string,
  merchantId: string,
  filename: string,
  mimeType: string
): Promise<StorageResult> {
  const metadata: StorageMetadata = {
    type: StorageType.PRODUCT_IMAGE,
    productId,
    merchantId,
    filename,
    mimeType,
    size: imageData.length,
    uploadedAt: Date.now(),
    description: `Product image for ${productId}`,
  };

  return uploadToFilecoin(imageData, metadata);
}

/**
 * 上传商品数据到 Filecoin
 */
export async function uploadProductData(
  productData: any,
  productId: string,
  merchantId: string
): Promise<StorageResult> {
  const metadata: StorageMetadata = {
    type: StorageType.PRODUCT_DATA,
    productId,
    merchantId,
    filename: `product_${productId}.json`,
    mimeType: 'application/json',
    size: 0, // 将在上传后更新
    uploadedAt: Date.now(),
    description: `Product data for ${productId}`,
  };

  return uploadJSONToFilecoin(productData, metadata);
}

/**
 * 上传 KYC 文档到 Filecoin
 */
export async function uploadKYCDocument(
  documentData: Buffer,
  userId: string,
  filename: string,
  mimeType: string
): Promise<StorageResult> {
  const metadata: StorageMetadata = {
    type: StorageType.KYC_DOCUMENT,
    userId,
    filename,
    mimeType,
    size: documentData.length,
    uploadedAt: Date.now(),
    description: `KYC document for user ${userId}`,
  };

  return uploadToFilecoin(documentData, metadata);
}

/**
 * 存款到 Synapse 合约（用于支付存储费用）
 */
export async function depositToSynapse(amountUSDFC: string): Promise<string> {
  try {
    const synapse = await getSynapseInstance();

    // 将 USDFC 金额转换为 Wei（6 位小数）
    const depositAmount = ethers.parseUnits(amountUSDFC, 6);

    // 存款并批准操作员
    const tx = await synapse.payments.depositWithPermitAndApproveOperator(
      depositAmount,
      synapse.getWarmStorageAddress(),
      ethers.MaxUint256,
      ethers.MaxUint256,
      TIME_CONSTANTS.EPOCHS_PER_MONTH,
    );

    await tx.wait();

    console.log(`Deposited ${amountUSDFC} USDFC to Synapse`);
    return tx.hash;
  } catch (error) {
    console.error('Failed to deposit to Synapse:', error);
    throw error;
  }
}

/**
 * 获取账户余额信息
 */
export async function getAccountBalance(): Promise<{
  fil: string;
  usdfc: string;
  storageUsage: string;
}> {
  try {
    const synapse = await getSynapseInstance();
    const address = await synapse.getSigner().getAddress();

    // 获取 FIL 余额
    const filBalance = await synapse.getProvider().getBalance(address);
    const fil = ethers.formatEther(filBalance);

    // 获取 USDFC 余额
    const usdfcBalance = await synapse.payments.balance();
    const usdfc = ethers.formatUnits(usdfcBalance, 6);

    return {
      fil,
      usdfc,
      storageUsage: '0', // Storage usage tracking not available in current SDK version
    };
  } catch (error) {
    console.error('Failed to get account balance:', error);
    throw error;
  }
}

/**
 * 估算存储成本
 */
export async function estimateStorageCost(dataSize: number): Promise<{
  costUSDFC: string;
  duration: string;
}> {
  // 简化的成本估算
  // 实际成本应该从 Synapse 合约查询
  const costPerGB = 0.1; // 假设每 GB 0.1 USDFC
  const sizeGB = dataSize / (1024 * 1024 * 1024);
  const cost = sizeGB * costPerGB;

  return {
    costUSDFC: cost.toFixed(6),
    duration: '30 days',
  };
}

/**
 * 生成存储证明哈希
 */
export function generateStorageProof(pieceCid: string, metadata: StorageMetadata): string {
  const data = JSON.stringify({ pieceCid, metadata });
  return crypto.createHash('sha256').update(data).digest('hex');
}

/**
 * 验证存储证明
 */
export function verifyStorageProof(
  pieceCid: string,
  metadata: StorageMetadata,
  proof: string
): boolean {
  const expectedProof = generateStorageProof(pieceCid, metadata);
  return expectedProof === proof;
}

/**
 * 批量上传文件到 Filecoin
 */
export async function batchUploadToFilecoin(
  files: Array<{ data: Buffer; metadata: StorageMetadata }>
): Promise<StorageResult[]> {
  const results: StorageResult[] = [];

  for (const file of files) {
    try {
      const result = await uploadToFilecoin(file.data, file.metadata);
      results.push(result);
    } catch (error) {
      console.error('Failed to upload file:', error);
      // 继续上传其他文件
    }
  }

  return results;
}

/**
 * 获取 Filecoin 网络信息
 */
export async function getNetworkInfo(): Promise<{
  network: string;
  address: string;
  balance: {
    fil: string;
    usdfc: string;
  };
}> {
  try {
    const synapse = await getSynapseInstance();
    const address = await synapse.getSigner().getAddress();
    const balance = await getAccountBalance();

    return {
      network: FILECOIN_NETWORK,
      address,
      balance: {
        fil: balance.fil,
        usdfc: balance.usdfc,
      },
    };
  } catch (error) {
    console.error('Failed to get network info:', error);
    throw error;
  }
}
