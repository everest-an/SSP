/**
 * Payment Pause Service
 * Allows users to temporarily pause/resume payment functionality
 * 
 * Sprint 4: Payment Pause Switch
 */

import { db } from '../../db';
import { users } from '../../../drizzle/schema';
import { eq } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { AuditLogger } from '../../middleware/auditLogger';

export interface PaymentPauseStatus {
  paymentEnabled: boolean;
  pausedAt: Date | null;
  pauseReason: string | null;
}

/**
 * Payment Pause Service
 * Manages user's ability to pause and resume payments
 */
export class PaymentPauseService {
  /**
   * Get current payment pause status
   */
  static async getPaymentStatus(userId: number): Promise<PaymentPauseStatus> {
    try {
      const [user] = await db
        .select({
          paymentEnabled: users.paymentEnabled,
          paymentPausedAt: users.paymentPausedAt,
          paymentPauseReason: users.paymentPauseReason,
        })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (!user) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'User not found',
        });
      }

      return {
        paymentEnabled: user.paymentEnabled ?? true,
        pausedAt: user.paymentPausedAt,
        pauseReason: user.paymentPauseReason,
      };
    } catch (error) {
      console.error('[PaymentPause] Error getting payment status:', error);
      throw error;
    }
  }

  /**
   * Pause payments
   */
  static async pausePayments(
    userId: number,
    reason?: string
  ): Promise<void> {
    try {
      // Check current status
      const currentStatus = await this.getPaymentStatus(userId);

      if (!currentStatus.paymentEnabled) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Payments are already paused',
        });
      }

      // Update user record
      await db
        .update(users)
        .set({
          paymentEnabled: false,
          paymentPausedAt: new Date(),
          paymentPauseReason: reason || 'User requested pause',
        })
        .where(eq(users.id, userId));

      // Log to audit
      await AuditLogger.logAccountEvent({
        userId,
        action: 'payment_paused',
        success: true,
        detail: {
          reason,
          paused_at: new Date().toISOString(),
        },
      });

      console.log(`[PaymentPause] Payments paused for user ${userId}`);
    } catch (error) {
      console.error('[PaymentPause] Error pausing payments:', error);
      throw error;
    }
  }

  /**
   * Resume payments
   */
  static async resumePayments(userId: number): Promise<void> {
    try {
      // Check current status
      const currentStatus = await this.getPaymentStatus(userId);

      if (currentStatus.paymentEnabled) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Payments are already enabled',
        });
      }

      // Calculate pause duration
      const pauseDuration = currentStatus.pausedAt
        ? Math.floor((Date.now() - currentStatus.pausedAt.getTime()) / 1000)
        : 0;

      // Update user record
      await db
        .update(users)
        .set({
          paymentEnabled: true,
          paymentPausedAt: null,
          paymentPauseReason: null,
        })
        .where(eq(users.id, userId));

      // Log to audit
      await AuditLogger.logAccountEvent({
        userId,
        action: 'payment_resumed',
        success: true,
        detail: {
          pause_duration_seconds: pauseDuration,
          resumed_at: new Date().toISOString(),
        },
      });

      console.log(`[PaymentPause] Payments resumed for user ${userId} (paused for ${pauseDuration}s)`);
    } catch (error) {
      console.error('[PaymentPause] Error resuming payments:', error);
      throw error;
    }
  }

  /**
   * Toggle payment status (pause if enabled, resume if paused)
   */
  static async togglePayments(
    userId: number,
    reason?: string
  ): Promise<PaymentPauseStatus> {
    try {
      const currentStatus = await this.getPaymentStatus(userId);

      if (currentStatus.paymentEnabled) {
        await this.pausePayments(userId, reason);
      } else {
        await this.resumePayments(userId);
      }

      return await this.getPaymentStatus(userId);
    } catch (error) {
      console.error('[PaymentPause] Error toggling payments:', error);
      throw error;
    }
  }

  /**
   * Check if user can make a payment (called before processing payments)
   */
  static async checkPaymentAllowed(userId: number): Promise<{
    allowed: boolean;
    reason?: string;
  }> {
    try {
      const status = await this.getPaymentStatus(userId);

      if (!status.paymentEnabled) {
        return {
          allowed: false,
          reason: status.pauseReason || 'Payments are currently paused. Please resume payments in your settings.',
        };
      }

      return {
        allowed: true,
      };
    } catch (error) {
      console.error('[PaymentPause] Error checking payment allowed:', error);
      throw error;
    }
  }

  /**
   * Get payment pause statistics (for admin dashboard)
   */
  static async getPauseStatistics(): Promise<{
    totalUsers: number;
    pausedUsers: number;
    pauseRate: number;
    avgPauseDurationHours: number;
  }> {
    try {
      const [stats] = await db.execute(sql`
        SELECT 
          COUNT(*) as total_users,
          SUM(CASE WHEN payment_enabled = FALSE THEN 1 ELSE 0 END) as paused_users,
          AVG(
            CASE 
              WHEN payment_enabled = FALSE AND payment_paused_at IS NOT NULL 
              THEN TIMESTAMPDIFF(HOUR, payment_paused_at, NOW())
              ELSE NULL
            END
          ) as avg_pause_duration_hours
        FROM users
      `);

      const totalUsers = stats.total_users || 0;
      const pausedUsers = stats.paused_users || 0;
      const pauseRate = totalUsers > 0 ? (pausedUsers / totalUsers) * 100 : 0;

      return {
        totalUsers,
        pausedUsers,
        pauseRate,
        avgPauseDurationHours: stats.avg_pause_duration_hours || 0,
      };
    } catch (error) {
      console.error('[PaymentPause] Error getting pause statistics:', error);
      throw error;
    }
  }

  /**
   * Auto-resume payments after a certain period (can be called by cron job)
   */
  static async autoResumeExpiredPauses(maxPauseDays: number = 90): Promise<number> {
    try {
      const cutoffDate = new Date(Date.now() - maxPauseDays * 24 * 60 * 60 * 1000);

      const result = await db
        .update(users)
        .set({
          paymentEnabled: true,
          paymentPausedAt: null,
          paymentPauseReason: `Auto-resumed after ${maxPauseDays} days`,
        })
        .where(
          and(
            eq(users.paymentEnabled, false),
            sql`${users.paymentPausedAt} < ${cutoffDate}`
          )
        );

      const resumedCount = result.rowsAffected || 0;

      if (resumedCount > 0) {
        console.log(`[PaymentPause] Auto-resumed ${resumedCount} users after ${maxPauseDays} days`);
      }

      return resumedCount;
    } catch (error) {
      console.error('[PaymentPause] Error auto-resuming expired pauses:', error);
      throw error;
    }
  }
}

// Import sql and and from drizzle-orm
import { sql, and } from 'drizzle-orm';
