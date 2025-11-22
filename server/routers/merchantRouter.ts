/**
 * Merchant Router
 * 
 * tRPC routes for merchant management, registration, and approval workflow
 */

import { publicProcedure, protectedProcedure, router } from '../_core/trpc';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import {
  createMerchant,
  getMerchantById,
  getMerchantsByUserId,
  getAllMerchants,
  updateMerchant,
} from '../db';
import { db } from '../db';
import { users, merchants } from '../../drizzle/schema';
import { eq, and, desc } from 'drizzle-orm';

// Admin-only procedure
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== 'admin') {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Admin access required' });
  }
  return next({ ctx });
});

// Merchant or admin procedure
const merchantProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== 'merchant' && ctx.user.role !== 'admin') {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Merchant or admin access required' });
  }
  return next({ ctx });
});

export const merchantRouter = router({
  /**
   * Apply to become a merchant
   * Regular users can apply to upgrade their account to merchant status
   */
  applyForMerchant: protectedProcedure
    .input(z.object({
      businessName: z.string().min(1, 'Business name is required'),
      businessType: z.string().optional(),
      address: z.string().optional(),
      phone: z.string().optional(),
      email: z.string().email().optional(),
      description: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Check if user already has a merchant account
      const existingMerchants = await getMerchantsByUserId(ctx.user.id);
      
      if (existingMerchants.length > 0) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'You already have a merchant account',
        });
      }

      // Create merchant with 'inactive' status (pending approval)
      // Note: kycVerified and kycVerifiedAt fields are omitted for backward compatibility
      // They will be set to default values by the database
      const merchant = await createMerchant({
        userId: ctx.user.id,
        businessName: input.businessName,
        businessType: input.businessType,
        address: input.address,
        phone: input.phone,
        email: input.email || ctx.user.email,
        status: 'inactive', // Requires admin approval
        // walletAddress, kycVerified, kycVerifiedAt are optional and will use database defaults
      });

      // Send notification to admins (async)
      const { sendMerchantApplicationNotification } = await import('../services/emailService');
      sendMerchantApplicationNotification(merchant.id, input.businessName).catch(err => {
        console.error('Failed to send merchant application notification:', err);
      });

      return {
        success: true,
        merchant,
        message: 'Your merchant application has been submitted. An administrator will review it shortly.',
      };
    }),

  /**
   * Get current user's merchant profile
   */
  getMyMerchantProfile: protectedProcedure
    .query(async ({ ctx }) => {
      const merchantAccounts = await getMerchantsByUserId(ctx.user.id);
      
      if (merchantAccounts.length === 0) {
        return null;
      }

      return merchantAccounts[0]; // Return the first merchant account
    }),

  /**
   * Get merchant by ID (merchant can only view their own, admin can view all)
   */
  getMerchantById: protectedProcedure
    .input(z.object({
      merchantId: z.number(),
    }))
    .query(async ({ ctx, input }) => {
      const merchant = await getMerchantById(input.merchantId);

      if (!merchant) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Merchant not found',
        });
      }

      // Check permissions
      if (ctx.user.role !== 'admin' && merchant.userId !== ctx.user.id) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You do not have permission to view this merchant',
        });
      }

      return merchant;
    }),

  /**
   * Update merchant profile (merchant can update their own, admin can update all)
   */
  updateMerchantProfile: protectedProcedure
    .input(z.object({
      merchantId: z.number(),
      businessName: z.string().optional(),
      businessType: z.string().optional(),
      address: z.string().optional(),
      phone: z.string().optional(),
      email: z.string().email().optional(),
      walletAddress: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const merchant = await getMerchantById(input.merchantId);

      if (!merchant) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Merchant not found',
        });
      }

      // Check permissions
      if (ctx.user.role !== 'admin' && merchant.userId !== ctx.user.id) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You do not have permission to update this merchant',
        });
      }

      const { merchantId, ...updateData } = input;
      const updatedMerchant = await updateMerchant(merchantId, updateData);

      return {
        success: true,
        merchant: updatedMerchant,
      };
    }),

  /**
   * Get all merchants (admin only)
   */
  getAllMerchants: adminProcedure
    .input(z.object({
      status: z.enum(['active', 'inactive', 'suspended']).optional(),
      limit: z.number().optional(),
      offset: z.number().optional(),
    }))
    .query(async ({ input }) => {
      let query = db.select().from(merchants);

      if (input.status) {
        query = query.where(eq(merchants.status, input.status)) as any;
      }

      query = query.orderBy(desc(merchants.createdAt)) as any;

      if (input.limit) {
        query = query.limit(input.limit) as any;
      }

      if (input.offset) {
        query = query.offset(input.offset) as any;
      }

      const merchantList = await query;

      return merchantList;
    }),

  /**
   * Approve merchant application (admin only)
   */
  approveMerchant: adminProcedure
    .input(z.object({
      merchantId: z.number(),
    }))
    .mutation(async ({ input }) => {
      const merchant = await getMerchantById(input.merchantId);

      if (!merchant) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Merchant not found',
        });
      }

      // Update merchant status to active
      const updatedMerchant = await updateMerchant(input.merchantId, {
        status: 'active',
      });

      // Upgrade user role to merchant
      await db.update(users)
        .set({ role: 'merchant' })
        .where(eq(users.id, merchant.userId));

      // Send approval notification
      const { sendMerchantApprovalEmail } = await import('../services/emailService');
      const user = await db.select().from(users).where(eq(users.id, merchant.userId)).limit(1);
      if (user[0]?.email) {
        sendMerchantApprovalEmail(user[0].email, merchant.businessName).catch(err => {
          console.error('Failed to send merchant approval email:', err);
        });
      }

      return {
        success: true,
        merchant: updatedMerchant,
        message: 'Merchant application approved successfully',
      };
    }),

  /**
   * Reject merchant application (admin only)
   */
  rejectMerchant: adminProcedure
    .input(z.object({
      merchantId: z.number(),
      reason: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const merchant = await getMerchantById(input.merchantId);

      if (!merchant) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Merchant not found',
        });
      }

      // Update merchant status to suspended
      const updatedMerchant = await updateMerchant(input.merchantId, {
        status: 'suspended',
      });

      // Send rejection notification
      const { sendMerchantRejectionEmail } = await import('../services/emailService');
      const user = await db.select().from(users).where(eq(users.id, merchant.userId)).limit(1);
      if (user[0]?.email) {
        sendMerchantRejectionEmail(
          user[0].email,
          merchant.businessName,
          input.reason || 'Your application did not meet our requirements.'
        ).catch(err => {
          console.error('Failed to send merchant rejection email:', err);
        });
      }

      return {
        success: true,
        merchant: updatedMerchant,
        message: 'Merchant application rejected',
      };
    }),

  /**
   * Suspend merchant (admin only)
   */
  suspendMerchant: adminProcedure
    .input(z.object({
      merchantId: z.number(),
      reason: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const merchant = await getMerchantById(input.merchantId);

      if (!merchant) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Merchant not found',
        });
      }

      const updatedMerchant = await updateMerchant(input.merchantId, {
        status: 'suspended',
      });

      // Downgrade user role to regular user
      await db.update(users)
        .set({ role: 'user' })
        .where(eq(users.id, merchant.userId));

      return {
        success: true,
        merchant: updatedMerchant,
        message: 'Merchant suspended successfully',
      };
    }),

  /**
   * Get merchant statistics (admin only)
   */
  getMerchantStatistics: adminProcedure
    .query(async () => {
      const allMerchants = await getAllMerchants();
      
      const stats = {
        total: allMerchants.length,
        active: allMerchants.filter(m => m.status === 'active').length,
        inactive: allMerchants.filter(m => m.status === 'inactive').length,
        suspended: allMerchants.filter(m => m.status === 'suspended').length,
      };

      return stats;
    }),

  /**
   * Switch user role between 'user' and 'merchant' (for users who are already approved merchants)
   */
  switchRole: protectedProcedure
    .input(z.object({
      targetRole: z.enum(['user', 'merchant']),
    }))
    .mutation(async ({ ctx, input }) => {
      // Check if user has a merchant account
      const merchantAccounts = await getMerchantsByUserId(ctx.user.id);
      
      if (merchantAccounts.length === 0 && input.targetRole === 'merchant') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'You do not have a merchant account. Please apply first.',
        });
      }

      // Check if merchant account is active
      if (input.targetRole === 'merchant' && merchantAccounts[0].status !== 'active') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Your merchant account is not active. Please wait for approval.',
        });
      }

      // Update user role
      await db.update(users)
        .set({ role: input.targetRole })
        .where(eq(users.id, ctx.user.id));

      const updatedUser = await db.select().from(users).where(eq(users.id, ctx.user.id)).limit(1);

      return {
        success: true,
        user: updatedUser[0],
        message: `Role switched to ${input.targetRole} successfully`,
      };
    }),
});
