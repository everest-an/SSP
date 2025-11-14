/**
 * User Router
 * 
 * tRPC routes for user management
 */

import { publicProcedure, router } from '../_core/trpc';
import { z } from 'zod';
import {
  registerUser,
  authenticateUser,
  getUserById,
  getUserByEmail,
  updateUserProfile,
  changeUserRole,
  getUserStatistics,
} from '../services/userAccountService';
import { TRPCError } from '@trpc/server';

export const userRouter = router({
  /**
   * Register new user
   */
  register: publicProcedure
    .input(z.object({
      email: z.string().email(),
      password: z.string().min(8),
      name: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      try {
        const user = await registerUser({
          email: input.email,
          password: input.password,
          name: input.name,
        });

        return {
          success: true,
          user,
        };
      } catch (error: any) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: error.message,
        });
      }
    }),

  /**
   * Login user
   */
  login: publicProcedure
    .input(z.object({
      email: z.string().email(),
      password: z.string(),
    }))
    .mutation(async ({ input }) => {
      try {
        const user = await authenticateUser({
          email: input.email,
          password: input.password,
        });

        if (!user) {
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: 'Invalid email or password',
          });
        }

        return {
          success: true,
          user,
        };
      } catch (error: any) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: error.message,
        });
      }
    }),

  /**
   * Get current user profile
   */
  getProfile: publicProcedure
    .query(async ({ ctx }) => {
      try {
        if (!ctx.userId) {
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: 'Not authenticated',
          });
        }

        const user = await getUserById(ctx.userId);

        if (!user) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'User not found',
          });
        }

        return user;
      } catch (error: any) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message,
        });
      }
    }),

  /**
   * Update user profile
   */
  updateProfile: publicProcedure
    .input(z.object({
      name: z.string().optional(),
      email: z.string().email().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        if (!ctx.userId) {
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: 'Not authenticated',
          });
        }

        const user = await updateUserProfile(ctx.userId, input);

        if (!user) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'User not found',
          });
        }

        return {
          success: true,
          user,
        };
      } catch (error: any) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: error.message,
        });
      }
    }),

  /**
   * Get user by ID (admin only)
   */
  getById: publicProcedure
    .input(z.object({
      userId: z.number(),
    }))
    .query(async ({ input, ctx }) => {
      try {
        if (ctx.role !== 'admin') {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Admin access required',
          });
        }

        const user = await getUserById(input.userId);

        if (!user) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'User not found',
          });
        }

        return user;
      } catch (error: any) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message,
        });
      }
    }),

  /**
   * Get user statistics (admin only)
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

        const stats = await getUserStatistics();

        return stats;
      } catch (error: any) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message,
        });
      }
    }),
});
