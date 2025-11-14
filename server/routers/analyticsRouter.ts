/**
 * Analytics Router
 * 
 * tRPC routes for analytics and reporting
 */

import { publicProcedure, router } from '../_core/trpc';
import { z } from 'zod';
import {
  getUserProfile,
  getSalesTrends,
  getProductPopularity,
  getPaymentMethodAnalysis,
  getRevenueAnalytics,
  getCustomerSegmentation,
  getTopCustomers,
  getGrowthMetrics,
} from '../services/analyticsService';
import { TRPCError } from '@trpc/server';

export const analyticsRouter = router({
  /**
   * Get user profile analytics
   */
  getUserProfile: publicProcedure
    .input(z.object({
      userId: z.number().optional(),
    }))
    .query(async ({ ctx, input }) => {
      try {
        const userId = input.userId || ctx.userId;

        if (!userId) {
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: 'Not authenticated',
          });
        }

        const profile = await getUserProfile(userId);

        return profile;
      } catch (error: any) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message,
        });
      }
    }),

  /**
   * Get sales trends
   */
  getSalesTrends: publicProcedure
    .input(z.object({
      startDate: z.date(),
      endDate: z.date(),
      granularity: z.enum(['daily', 'weekly', 'monthly']).optional(),
    }))
    .query(async ({ ctx, input }) => {
      try {
        if (ctx.role !== 'admin' && ctx.role !== 'merchant') {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Access denied',
          });
        }

        const trends = await getSalesTrends(
          input.startDate,
          input.endDate,
          input.granularity
        );

        return trends;
      } catch (error: any) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message,
        });
      }
    }),

  /**
   * Get product popularity
   */
  getProductPopularity: publicProcedure
    .input(z.object({
      limit: z.number().optional(),
    }))
    .query(async ({ ctx, input }) => {
      try {
        if (ctx.role !== 'admin' && ctx.role !== 'merchant') {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Access denied',
          });
        }

        const products = await getProductPopularity(input.limit);

        return products;
      } catch (error: any) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message,
        });
      }
    }),

  /**
   * Get payment method analysis
   */
  getPaymentMethodAnalysis: publicProcedure
    .query(async ({ ctx }) => {
      try {
        if (ctx.role !== 'admin' && ctx.role !== 'merchant') {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Access denied',
          });
        }

        const analysis = await getPaymentMethodAnalysis();

        return analysis;
      } catch (error: any) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message,
        });
      }
    }),

  /**
   * Get revenue analytics
   */
  getRevenueAnalytics: publicProcedure
    .query(async ({ ctx }) => {
      try {
        if (!ctx.merchantId) {
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: 'Not authenticated as merchant',
          });
        }

        const analytics = await getRevenueAnalytics(ctx.merchantId);

        return analytics;
      } catch (error: any) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message,
        });
      }
    }),

  /**
   * Get customer segmentation
   */
  getCustomerSegmentation: publicProcedure
    .query(async ({ ctx }) => {
      try {
        if (ctx.role !== 'admin') {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Admin access required',
          });
        }

        const segmentation = await getCustomerSegmentation();

        return segmentation;
      } catch (error: any) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message,
        });
      }
    }),

  /**
   * Get top customers
   */
  getTopCustomers: publicProcedure
    .input(z.object({
      limit: z.number().optional(),
    }))
    .query(async ({ ctx, input }) => {
      try {
        if (ctx.role !== 'admin' && ctx.role !== 'merchant') {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Access denied',
          });
        }

        const customers = await getTopCustomers(input.limit);

        return customers;
      } catch (error: any) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message,
        });
      }
    }),

  /**
   * Get growth metrics
   */
  getGrowthMetrics: publicProcedure
    .input(z.object({
      days: z.number().optional(),
    }))
    .query(async ({ ctx, input }) => {
      try {
        if (ctx.role !== 'admin') {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Admin access required',
          });
        }

        const metrics = await getGrowthMetrics(input.days);

        return metrics;
      } catch (error: any) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message,
        });
      }
    }),
});
