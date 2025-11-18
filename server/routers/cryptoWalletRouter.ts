/**
 * Cryptocurrency Wallet Router
 * 
 * Handles cryptocurrency wallet management and transactions
 * Integrates with BTCPay Server for Bitcoin/Lightning payments
 */

import { router, protectedProcedure } from "../_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "../db";
import { wallets, walletTransactions, merchants, paymentMethods } from "../../drizzle/schema";
import { eq, and, desc, sql } from "drizzle-orm";

// Supported cryptocurrencies
const CryptoType = z.enum(['BTC', 'ETH', 'USDT', 'USDC', 'LTC']);

export const cryptoWalletRouter = router({
  /**
   * Create a new crypto wallet
   */
  createCryptoWallet: protectedProcedure
    .input(z.object({
      walletType: CryptoType,
      walletAddress: z.string().min(1),
      walletName: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Check if wallet already exists
      const existingWallet = await db.query.wallets.findFirst({
        where: and(
          eq(wallets.userId, ctx.user.id),
          eq(wallets.walletAddress, input.walletAddress)
        ),
      });

      if (existingWallet) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Wallet with this address already exists',
        });
      }

      // Create wallet
      const [wallet] = await db.insert(wallets).values({
        userId: ctx.user.id,
        walletType: input.walletType,
        walletAddress: input.walletAddress,
        balance: 0, // Initial balance
        currency: input.walletType,
      }).returning();

      // Add as payment method
      await db.insert(paymentMethods).values({
        userId: ctx.user.id,
        methodType: 'wallet',
        methodData: JSON.stringify({
          walletId: wallet.id,
          walletType: input.walletType,
          walletAddress: input.walletAddress,
          walletName: input.walletName || `${input.walletType} Wallet`,
        }),
        isDefault: false,
      });

      return wallet;
    }),

  /**
   * Get all crypto wallets for current user
   */
  getMyCryptoWallets: protectedProcedure
    .query(async ({ ctx }) => {
      const userWallets = await db.query.wallets.findMany({
        where: eq(wallets.userId, ctx.user.id),
        orderBy: [desc(wallets.createdAt)],
      });

      return userWallets;
    }),

  /**
   * Get wallet by ID
   */
  getWalletById: protectedProcedure
    .input(z.object({
      walletId: z.number(),
    }))
    .query(async ({ ctx, input }) => {
      const wallet = await db.query.wallets.findFirst({
        where: eq(wallets.id, input.walletId),
      });

      if (!wallet) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Wallet not found',
        });
      }

      if (wallet.userId !== ctx.user.id && ctx.user.role !== 'admin') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You do not have permission to view this wallet',
        });
      }

      return wallet;
    }),

  /**
   * Get wallet balance
   */
  getWalletBalance: protectedProcedure
    .input(z.object({
      walletId: z.number(),
    }))
    .query(async ({ ctx, input }) => {
      const wallet = await db.query.wallets.findFirst({
        where: eq(wallets.id, input.walletId),
      });

      if (!wallet) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Wallet not found',
        });
      }

      if (wallet.userId !== ctx.user.id && ctx.user.role !== 'admin') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You do not have permission to view this wallet',
        });
      }

      return {
        balance: wallet.balance,
        currency: wallet.currency,
        walletType: wallet.walletType,
      };
    }),

  /**
   * Get wallet transactions
   */
  getWalletTransactions: protectedProcedure
    .input(z.object({
      walletId: z.number(),
      limit: z.number().min(1).max(100).default(50),
      offset: z.number().min(0).default(0),
    }))
    .query(async ({ ctx, input }) => {
      const wallet = await db.query.wallets.findFirst({
        where: eq(wallets.id, input.walletId),
      });

      if (!wallet) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Wallet not found',
        });
      }

      if (wallet.userId !== ctx.user.id && ctx.user.role !== 'admin') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You do not have permission to view these transactions',
        });
      }

      const transactions = await db.query.walletTransactions.findMany({
        where: eq(walletTransactions.walletId, input.walletId),
        orderBy: [desc(walletTransactions.createdAt)],
        limit: input.limit,
        offset: input.offset,
      });

      return transactions;
    }),

  /**
   * Create a crypto payment invoice (BTCPay Server integration)
   */
  createCryptoInvoice: protectedProcedure
    .input(z.object({
      amount: z.number().min(0),
      currency: z.string().default('USD'),
      cryptoType: CryptoType,
      orderId: z.number().optional(),
      description: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // TODO: Integrate with BTCPay Server API
      // This is a placeholder implementation
      
      const invoiceId = `INV-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const paymentAddress = `${input.cryptoType.toLowerCase()}_${Math.random().toString(36).substr(2, 20)}`;

      // In production, this would call BTCPay Server API:
      // const invoice = await btcpayClient.createInvoice({
      //   amount: input.amount,
      //   currency: input.currency,
      //   orderId: input.orderId?.toString(),
      //   notificationUrl: `${process.env.APP_URL}/api/btcpay/webhook`,
      //   redirectUrl: `${process.env.APP_URL}/orders/${input.orderId}`,
      // });

      return {
        invoiceId,
        paymentAddress,
        amount: input.amount,
        currency: input.currency,
        cryptoType: input.cryptoType,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes
        status: 'pending',
      };
    }),

  /**
   * Verify crypto payment
   */
  verifyCryptoPayment: protectedProcedure
    .input(z.object({
      invoiceId: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      // TODO: Integrate with BTCPay Server API to verify payment
      // This is a placeholder implementation

      // In production, this would call BTCPay Server API:
      // const invoice = await btcpayClient.getInvoice(input.invoiceId);
      // return {
      //   status: invoice.status,
      //   paid: invoice.status === 'complete',
      //   amount: invoice.amount,
      //   transactionId: invoice.transactionId,
      // };

      return {
        status: 'pending',
        paid: false,
        amount: 0,
        transactionId: null,
      };
    }),

  /**
   * Link merchant wallet address
   */
  linkMerchantWallet: protectedProcedure
    .input(z.object({
      merchantId: z.number(),
      walletAddress: z.string().min(1),
      cryptoType: CryptoType,
    }))
    .mutation(async ({ ctx, input }) => {
      // Verify merchant ownership
      const merchant = await db.query.merchants.findFirst({
        where: eq(merchants.id, input.merchantId),
      });

      if (!merchant) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Merchant not found',
        });
      }

      if (merchant.userId !== ctx.user.id && ctx.user.role !== 'admin') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You do not have permission to modify this merchant',
        });
      }

      // Update merchant wallet address
      await db.update(merchants)
        .set({ walletAddress: input.walletAddress })
        .where(eq(merchants.id, input.merchantId));

      return { success: true };
    }),

  /**
   * Get crypto wallet statistics
   */
  getCryptoWalletStats: protectedProcedure
    .query(async ({ ctx }) => {
      const userWallets = await db.query.wallets.findMany({
        where: eq(wallets.userId, ctx.user.id),
      });

      const totalBalance = userWallets.reduce((sum, wallet) => sum + wallet.balance, 0);

      const walletsByType = userWallets.reduce((acc, wallet) => {
        acc[wallet.walletType] = (acc[wallet.walletType] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      return {
        totalWallets: userWallets.length,
        totalBalance,
        walletsByType,
        hasWallets: userWallets.length > 0,
      };
    }),

  /**
   * Get supported cryptocurrencies
   */
  getSupportedCryptos: protectedProcedure
    .query(() => {
      return [
        {
          symbol: 'BTC',
          name: 'Bitcoin',
          network: 'Bitcoin',
          icon: '₿',
          enabled: true,
        },
        {
          symbol: 'ETH',
          name: 'Ethereum',
          network: 'Ethereum',
          icon: 'Ξ',
          enabled: true,
        },
        {
          symbol: 'USDT',
          name: 'Tether',
          network: 'Ethereum',
          icon: '₮',
          enabled: true,
        },
        {
          symbol: 'USDC',
          name: 'USD Coin',
          network: 'Ethereum',
          icon: '$',
          enabled: true,
        },
        {
          symbol: 'LTC',
          name: 'Litecoin',
          network: 'Litecoin',
          icon: 'Ł',
          enabled: true,
        },
      ];
    }),
});
