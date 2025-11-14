/**
 * Fraud Detection Router
 * 
 * tRPC routes for fraud detection and alerts
 */

import { publicProcedure, router } from '../_core/trpc';
import { z } from 'zod';
import {
  calculateRiskScore,
  createFraudAlert,
  getFraudAlert,
  getFraudAlertsForOrder,
  getFraudAlertsForUser,
  reviewFraudAlert,
  getPendingFraudAlerts,
  getFraudStatistics,
  blockUser,
  analyzeTransactionPatterns,
} from '../services/fraudDetectionService';
import { TRPCError } from '@trpc/server';

export const fraudRouter = router({
  /**
   * Calculate risk score for transaction
   */
  calculateRiskScore: publicProcedure
    .input(z.object({
      orderId: z.number(),
    }))
    .query(async ({ input, ctx }) => {
      try {
        if (ctx.role !== 'admin') {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Admin access required',
          });
        }

        const result = await calculateRiskScore(input.orderId);

        return result;
      } catch (error: any) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message,
        });
      }
    }),

  /**
   * Get fraud alert
   */
  getAlert: publicProcedure
    .input(z.object({
      alertId: z.string(),
    }))
    .query(async ({ input, ctx }) => {
      try {
        if (ctx.role !== 'admin') {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Admin access required',
          });
        }

        const alert = await getFraudAlert(input.alertId);

        if (!alert) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Alert not found',
          });
        }

        return alert;
      } catch (error: any) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message,
        });
      }
    }),

  /**
   * Get fraud alerts for order
   */
  getAlertsForOrder: publicProcedure
    .input(z.object({
      orderId: z.number(),
    }))
    .query(async ({ input, ctx }) => {
      try {
        if (ctx.role !== 'admin') {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Admin access required',
          });
        }

        const alerts = await getFraudAlertsForOrder(input.orderId);

        return alerts;
      } catch (error: any) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message,
        });
      }
    }),

  /**
   * Get fraud alerts for user
   */
  getAlertsForUser: publicProcedure
    .input(z.object({
      userId: z.number(),
    }))
    .query(async ({ input, ctx }) => {
      try {
        if (ctx.role !== 'admin' && ctx.userId !== input.userId) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Access denied',
          });
        }

        const alerts = await getFraudAlertsForUser(input.userId);

        return alerts;
      } catch (error: any) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message,
        });
      }
    }),

  /**
   * Review fraud alert
   */
  reviewAlert: publicProcedure
    .input(z.object({
      alertId: z.string(),
      status: z.enum(['confirmed', 'dismissed']),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      try {
        if (ctx.role !== 'admin') {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Admin access required',
          });
        }

        const alert = await reviewFraudAlert(
          input.alertId,
          input.status,
          ctx.userId?.toString() || 'system',
          input.notes
        );

        if (!alert) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Alert not found',
          });
        }

        return {
          success: true,
          alert,
        };
      } catch (error: any) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: error.message,
        });
      }
    }),

  /**
   * Get pending fraud alerts
   */
  getPendingAlerts: publicProcedure
    .input(z.object({
      limit: z.number().optional(),
    }))
    .query(async ({ input, ctx }) => {
      try {
        if (ctx.role !== 'admin') {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Admin access required',
          });
        }

        const alerts = await getPendingFraudAlerts(input.limit);

        return alerts;
      } catch (error: any) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message,
        });
      }
    }),

  /**
   * Get fraud statistics
   */
  getStatistics: publicProcedure
    .query(async ({ ctx }) => {
      try {
        if (ctx.role !== 'admin') {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Admin access required',
          });
        }

        const stats = await getFraudStatistics();

        return stats;
      } catch (error: any) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message,
        });
      }
    }),

  /**
   * Analyze transaction patterns
   */
  analyzePatterns: publicProcedure
    .input(z.object({
      userId: z.number(),
    }))
    .query(async ({ input, ctx }) => {
      try {
        if (ctx.role !== 'admin' && ctx.userId !== input.userId) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Access denied',
          });
        }

        const patterns = await analyzeTransactionPatterns(input.userId);

        return patterns;
      } catch (error: any) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message,
        });
      }
    }),

  /**
   * Block user (after confirmed fraud)
   */
  blockUser: publicProcedure
    .input(z.object({
      userId: z.number(),
      reason: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      try {
        if (ctx.role !== 'admin') {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Admin access required',
          });
        }

        const success = await blockUser(input.userId, input.reason);

        if (!success) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to block user',
          });
        }

        return { success: true };
      } catch (error: any) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: error.message,
        });
      }
    }),
});
