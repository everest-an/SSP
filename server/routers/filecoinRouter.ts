/**
 * Filecoin Router
 * 
 * 处理 Filecoin 存储相关的 API 请求
 */

import { router, publicProcedure, protectedProcedure } from '../trpc';
import { z } from 'zod';
import * as filecoinService from '../services/filecoinService';
import { TRPCError } from '@trpc/server';

export const filecoinRouter = router({
  /**
   * 检查 Filecoin 是否已配置
   */
  isConfigured: publicProcedure
    .query(async () => {
      return {
        configured: filecoinService.isFilecoinConfigured(),
      };
    }),

  /**
   * 获取网络信息
   */
  getNetworkInfo: protectedProcedure
    .query(async () => {
      try {
        return await filecoinService.getNetworkInfo();
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to get network info',
          cause: error,
        });
      }
    }),

  /**
   * 获取账户余额
   */
  getBalance: protectedProcedure
    .query(async () => {
      try {
        return await filecoinService.getAccountBalance();
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to get balance',
          cause: error,
        });
      }
    }),

  /**
   * 上传文本数据
   */
  uploadText: protectedProcedure
    .input(z.object({
      text: z.string(),
      metadata: z.object({
        type: z.enum(['invoice', 'product_image', 'product_data', 'kyc_document', 'receipt', 'merchant_logo']),
        userId: z.string().optional(),
        merchantId: z.string().optional(),
        productId: z.string().optional(),
        orderId: z.string().optional(),
        filename: z.string(),
        mimeType: z.string(),
        description: z.string().optional(),
      }),
    }))
    .mutation(async ({ input }) => {
      try {
        const metadata = {
          ...input.metadata,
          size: Buffer.byteLength(input.text, 'utf8'),
          uploadedAt: Date.now(),
        };

        const result = await filecoinService.uploadTextToFilecoin(input.text, metadata);
        return result;
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to upload text',
          cause: error,
        });
      }
    }),

  /**
   * 上传 JSON 数据
   */
  uploadJSON: protectedProcedure
    .input(z.object({
      data: z.any(),
      metadata: z.object({
        type: z.enum(['invoice', 'product_image', 'product_data', 'kyc_document', 'receipt', 'merchant_logo']),
        userId: z.string().optional(),
        merchantId: z.string().optional(),
        productId: z.string().optional(),
        orderId: z.string().optional(),
        filename: z.string(),
        description: z.string().optional(),
      }),
    }))
    .mutation(async ({ input }) => {
      try {
        const metadata = {
          ...input.metadata,
          mimeType: 'application/json',
          size: 0, // 将在上传后更新
          uploadedAt: Date.now(),
        };

        const result = await filecoinService.uploadJSONToFilecoin(input.data, metadata);
        return result;
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to upload JSON',
          cause: error,
        });
      }
    }),

  /**
   * 下载文本数据
   */
  downloadText: protectedProcedure
    .input(z.object({
      pieceCid: z.string(),
    }))
    .query(async ({ input }) => {
      try {
        const text = await filecoinService.downloadTextFromFilecoin(input.pieceCid);
        return { text };
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to download text',
          cause: error,
        });
      }
    }),

  /**
   * 下载 JSON 数据
   */
  downloadJSON: protectedProcedure
    .input(z.object({
      pieceCid: z.string(),
    }))
    .query(async ({ input }) => {
      try {
        const data = await filecoinService.downloadJSONFromFilecoin(input.pieceCid);
        return { data };
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to download JSON',
          cause: error,
        });
      }
    }),

  /**
   * 上传产品数据
   */
  uploadProductData: protectedProcedure
    .input(z.object({
      productId: z.string(),
      merchantId: z.string(),
      productData: z.object({
        name: z.string(),
        description: z.string(),
        price: z.number(),
        category: z.string(),
        images: z.array(z.string()).optional(),
        attributes: z.record(z.any()).optional(),
      }),
    }))
    .mutation(async ({ input }) => {
      try {
        const result = await filecoinService.uploadProductData(
          input.productData,
          input.productId,
          input.merchantId
        );
        return result;
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to upload product data',
          cause: error,
        });
      }
    }),

  /**
   * 存款到 Synapse
   */
  deposit: protectedProcedure
    .input(z.object({
      amount: z.string(), // USDFC 金额
    }))
    .mutation(async ({ input }) => {
      try {
        const txHash = await filecoinService.depositToSynapse(input.amount);
        return { txHash };
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to deposit',
          cause: error,
        });
      }
    }),

  /**
   * 估算存储成本
   */
  estimateCost: protectedProcedure
    .input(z.object({
      dataSize: z.number(), // 字节
    }))
    .query(async ({ input }) => {
      try {
        return await filecoinService.estimateStorageCost(input.dataSize);
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to estimate cost',
          cause: error,
        });
      }
    }),

  /**
   * 生成存储证明
   */
  generateProof: protectedProcedure
    .input(z.object({
      pieceCid: z.string(),
      metadata: z.any(),
    }))
    .query(async ({ input }) => {
      try {
        const proof = filecoinService.generateStorageProof(input.pieceCid, input.metadata);
        return { proof };
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to generate proof',
          cause: error,
        });
      }
    }),

  /**
   * 验证存储证明
   */
  verifyProof: protectedProcedure
    .input(z.object({
      pieceCid: z.string(),
      metadata: z.any(),
      proof: z.string(),
    }))
    .query(async ({ input }) => {
      try {
        const isValid = filecoinService.verifyStorageProof(
          input.pieceCid,
          input.metadata,
          input.proof
        );
        return { isValid };
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to verify proof',
          cause: error,
        });
      }
    }),
});
