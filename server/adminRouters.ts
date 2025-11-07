import { router, protectedProcedure } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  getAllUsers,
  searchUsers,
  getUserWithDetails,
  updateUserStatus,
  getAllTransactions,
  getTransactionsByDateRange,
  getTransactionStats,
  searchTransactions,
  getAllMerchantsWithStats,
  getMerchantDetailedStats,
  getAllWalletsWithUsers,
  getWalletTransactionHistory,
  getDailyStats,
  getTopProducts,
  getUserGrowthStats,
} from "./adminDb";

// Admin-only procedure
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== 'admin') {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Admin access required' });
  }
  return next({ ctx });
});

export const adminRouter = router({
  // ============ User Management ============
  users: router({
    list: adminProcedure
      .input(z.object({ limit: z.number().default(100) }).optional())
      .query(async ({ input }) => {
        return getAllUsers(input?.limit);
      }),

    search: adminProcedure
      .input(z.object({
        query: z.string(),
        limit: z.number().default(50),
      }))
      .query(async ({ input }) => {
        return searchUsers(input.query, input.limit);
      }),

    getDetails: adminProcedure
      .input(z.object({ userId: z.number() }))
      .query(async ({ input }) => {
        const details = await getUserWithDetails(input.userId);
        if (!details) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'User not found' });
        }
        return details;
      }),

    updateStatus: adminProcedure
      .input(z.object({
        userId: z.number(),
        role: z.enum(["user", "merchant", "admin"]),
      }))
      .mutation(async ({ input }) => {
        await updateUserStatus(input.userId, input.role);
        return { success: true };
      }),
  }),

  // ============ Transaction Management ============
  transactions: router({
    list: adminProcedure
      .input(z.object({ limit: z.number().default(100) }).optional())
      .query(async ({ input }) => {
        return getAllTransactions(input?.limit);
      }),

    byDateRange: adminProcedure
      .input(z.object({
        startDate: z.date(),
        endDate: z.date(),
        limit: z.number().default(1000),
      }))
      .query(async ({ input }) => {
        return getTransactionsByDateRange(input.startDate, input.endDate, input.limit);
      }),

    stats: adminProcedure
      .input(z.object({ merchantId: z.number().optional() }).optional())
      .query(async ({ input }) => {
        return getTransactionStats(input?.merchantId);
      }),

    search: adminProcedure
      .input(z.object({
        status: z.string().optional(),
        minAmount: z.number().optional(),
        maxAmount: z.number().optional(),
        merchantId: z.number().optional(),
        startDate: z.date().optional(),
        endDate: z.date().optional(),
        limit: z.number().default(100),
      }))
      .query(async ({ input }) => {
        return searchTransactions(input);
      }),
  }),

  // ============ Merchant Management ============
  merchants: router({
    listWithStats: adminProcedure
      .query(async () => {
        return getAllMerchantsWithStats();
      }),

    getDetailedStats: adminProcedure
      .input(z.object({ merchantId: z.number() }))
      .query(async ({ input }) => {
        const stats = await getMerchantDetailedStats(input.merchantId);
        if (!stats) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Merchant not found' });
        }
        return stats;
      }),
  }),

  // ============ Wallet Management ============
  wallets: router({
    listWithUsers: adminProcedure
      .input(z.object({ limit: z.number().default(100) }).optional())
      .query(async ({ input }) => {
        return getAllWalletsWithUsers(input?.limit);
      }),

    transactionHistory: adminProcedure
      .input(z.object({
        walletId: z.number(),
        limit: z.number().default(50),
      }))
      .query(async ({ input }) => {
        return getWalletTransactionHistory(input.walletId, input.limit);
      }),
  }),

  // ============ Analytics ============
  analytics: router({
    dailyStats: adminProcedure
      .input(z.object({ days: z.number().default(30) }).optional())
      .query(async ({ input }) => {
        return getDailyStats(input?.days);
      }),

    topProducts: adminProcedure
      .input(z.object({ limit: z.number().default(10) }).optional())
      .query(async ({ input }) => {
        return getTopProducts(input?.limit);
      }),

    userGrowth: adminProcedure
      .input(z.object({ days: z.number().default(30) }).optional())
      .query(async ({ input }) => {
        return getUserGrowthStats(input?.days);
      }),
  }),
});
