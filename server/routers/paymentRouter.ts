/**
 * Payment Router
 * 
 * tRPC routes for payment management
 */

import { publicProcedure, router } from '../_core/trpc';
import { z } from 'zod';
import {
  createPaymentMethod,
  getUserPaymentMethods,
  getDefaultPaymentMethod,
  setDefaultPaymentMethod,
  updatePaymentMethod,
  deletePaymentMethod,
  getPaymentMethodStatistics,
} from '../services/paymentMethodService';
import { TRPCError } from '@trpc/server';

export const paymentRouter = router({
  /**
   * Create payment method
   */
  createMethod: publicProcedure
    .input(z.object({
      type: z.enum(['credit_card', 'debit_card', 'digital_wallet', 'bank_transfer']),
      name: z.string(),
      cardLast4: z.string().optional(),
      cardBrand: z.string().optional(),
      cardExpiry: z.string().optional(),
      walletAddress: z.string().optional(),
      walletType: z.string().optional(),
      bankName: z.string().optional(),
      accountLast4: z.string().optional(),
      isDefault: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        if (!ctx.userId) {
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: 'Not authenticated',
          });
        }

        const method = await createPaymentMethod(ctx.userId, input.type, input);

        return {
          success: true,
          method,
        };
      } catch (error: any) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: error.message,
        });
      }
    }),

  /**
   * Get user payment methods
   */
  getMethods: publicProcedure
    .query(async ({ ctx }) => {
      try {
        if (!ctx.userId) {
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: 'Not authenticated',
          });
        }

        const methods = await getUserPaymentMethods(ctx.userId);

        return methods;
      } catch (error: any) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message,
        });
      }
    }),

  /**
   * Get default payment method
   */
  getDefault: publicProcedure
    .query(async ({ ctx }) => {
      try {
        if (!ctx.userId) {
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: 'Not authenticated',
          });
        }

        const method = await getDefaultPaymentMethod(ctx.userId);

        if (!method) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'No payment method found',
          });
        }

        return method;
      } catch (error: any) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message,
        });
      }
    }),

  /**
   * Set default payment method
   */
  setDefault: publicProcedure
    .input(z.object({
      methodId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        if (!ctx.userId) {
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: 'Not authenticated',
          });
        }

        const method = await setDefaultPaymentMethod(ctx.userId, input.methodId);

        if (!method) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Payment method not found',
          });
        }

        return {
          success: true,
          method,
        };
      } catch (error: any) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: error.message,
        });
      }
    }),

  /**
   * Update payment method
   */
  updateMethod: publicProcedure
    .input(z.object({
      methodId: z.string(),
      name: z.string().optional(),
      isActive: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        if (!ctx.userId) {
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: 'Not authenticated',
          });
        }

        const method = await updatePaymentMethod(input.methodId, input);

        if (!method) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Payment method not found',
          });
        }

        return {
          success: true,
          method,
        };
      } catch (error: any) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: error.message,
        });
      }
    }),

  /**
   * Delete payment method
   */
  deleteMethod: publicProcedure
    .input(z.object({
      methodId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        if (!ctx.userId) {
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: 'Not authenticated',
          });
        }

        const success = await deletePaymentMethod(input.methodId);

        if (!success) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Payment method not found',
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

  /**
   * Get payment method statistics
   */
  getStatistics: publicProcedure
    .query(async ({ ctx }) => {
      try {
        if (!ctx.userId) {
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: 'Not authenticated',
          });
        }

        const stats = await getPaymentMethodStatistics(ctx.userId);

        return stats;
      } catch (error: any) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message,
        });
      }
    }),
});
