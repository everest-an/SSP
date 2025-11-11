/**
 * Payment Frequency Checker Service
 * Enforces transaction frequency limits and daily caps
 * 
 * Sprint 3.5: Payment Frequency Control
 */

import { db } from '../../db';
import { paymentMethods, paymentTransactions } from '../../../drizzle/schema';
import { eq, and, gte, sql } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { AuditLogger } from '../../middleware/auditLogger';

export interface FrequencyCheckResult {
  allowed: boolean;
  reason?: string;
  currentCount?: number;
  limit?: number;
  resetAt?: Date;
  dailyTotal?: number;
  dailyLimit?: number;
}

/**
 * Payment Frequency Checker
 * Validates payment requests against configured limits
 */
export class PaymentFrequencyChecker {
  /**
   * Check if a payment is allowed based on frequency limits
   * 
   * Checks:
   * 1. Transactions per period limit (e.g., 5 transactions in 10 minutes)
   * 2. Daily transaction amount limit (e.g., $500 per day)
   */
  static async checkPaymentAllowed(
    userId: number,
    paymentMethodId: number,
    amount: number
  ): Promise<FrequencyCheckResult> {
    try {
      // Step 1: Get payment method with limits
      const [paymentMethod] = await db
        .select()
        .from(paymentMethods)
        .where(
          and(
            eq(paymentMethods.id, paymentMethodId),
            eq(paymentMethods.userId, userId)
          )
        )
        .limit(1);

      if (!paymentMethod) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Payment method not found'
        });
      }

      // Get limits (with defaults if not set)
      const maxTransactionsPerPeriod = (paymentMethod as any).maxTransactionsPerPeriod || 10;
      const periodMinutes = (paymentMethod as any).periodMinutes || 10;
      const dailyLimit = parseFloat((paymentMethod as any).dailyTransactionLimit || '500.00');

      // Step 2: Check transaction frequency (transactions per period)
      const periodStart = new Date(Date.now() - periodMinutes * 60 * 1000);
      
      const recentTransactions = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(paymentTransactions)
        .where(
          and(
            eq(paymentTransactions.userId, userId),
            eq(paymentTransactions.paymentMethodId, paymentMethodId),
            gte(paymentTransactions.createdAt, periodStart),
            sql`${paymentTransactions.status} IN ('pending', 'succeeded')`
          )
        );

      const currentCount = recentTransactions[0]?.count || 0;

      if (currentCount >= maxTransactionsPerPeriod) {
        const resetAt = new Date(Date.now() + periodMinutes * 60 * 1000);
        
        // Log frequency limit violation
        await AuditLogger.logSecurityEvent({
          userId,
          action: 'suspicious_activity',
          riskScore: 0.6,
          description: `Payment frequency limit exceeded: ${currentCount}/${maxTransactionsPerPeriod} in ${periodMinutes} minutes`,
          detail: {
            payment_method_id: paymentMethodId,
            current_count: currentCount,
            limit: maxTransactionsPerPeriod,
            period_minutes: periodMinutes
          }
        });

        return {
          allowed: false,
          reason: `Transaction frequency limit exceeded. Maximum ${maxTransactionsPerPeriod} transactions per ${periodMinutes} minutes. Please wait ${periodMinutes} minutes.`,
          currentCount,
          limit: maxTransactionsPerPeriod,
          resetAt
        };
      }

      // Step 3: Check daily transaction amount limit
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const todayTransactions = await db
        .select({ total: sql<string>`COALESCE(SUM(${paymentTransactions.amount}), 0)` })
        .from(paymentTransactions)
        .where(
          and(
            eq(paymentTransactions.userId, userId),
            eq(paymentTransactions.paymentMethodId, paymentMethodId),
            gte(paymentTransactions.createdAt, todayStart),
            eq(paymentTransactions.status, 'succeeded')
          )
        );

      const dailyTotal = parseFloat(todayTransactions[0]?.total || '0');
      const newTotal = dailyTotal + amount;

      if (newTotal > dailyLimit) {
        // Log daily limit violation
        await AuditLogger.logSecurityEvent({
          userId,
          action: 'suspicious_activity',
          riskScore: 0.7,
          description: `Daily transaction limit exceeded: $${newTotal.toFixed(2)} > $${dailyLimit.toFixed(2)}`,
          detail: {
            payment_method_id: paymentMethodId,
            daily_total: dailyTotal,
            requested_amount: amount,
            daily_limit: dailyLimit
          }
        });

        return {
          allowed: false,
          reason: `Daily transaction limit exceeded. Current: $${dailyTotal.toFixed(2)}, Requested: $${amount.toFixed(2)}, Limit: $${dailyLimit.toFixed(2)}`,
          dailyTotal,
          dailyLimit
        };
      }

      // All checks passed
      return {
        allowed: true,
        currentCount,
        limit: maxTransactionsPerPeriod,
        dailyTotal,
        dailyLimit
      };

    } catch (error) {
      console.error('[FrequencyChecker] Error checking payment frequency:', error);
      
      if (error instanceof TRPCError) {
        throw error;
      }

      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to check payment frequency limits'
      });
    }
  }

  /**
   * Get current frequency status for a payment method
   */
  static async getFrequencyStatus(
    userId: number,
    paymentMethodId: number
  ): Promise<{
    transactionsInPeriod: number;
    maxTransactionsPerPeriod: number;
    periodMinutes: number;
    dailyTotal: number;
    dailyLimit: number;
    canPay: boolean;
  }> {
    // Get payment method
    const [paymentMethod] = await db
      .select()
      .from(paymentMethods)
      .where(
        and(
          eq(paymentMethods.id, paymentMethodId),
          eq(paymentMethods.userId, userId)
        )
      )
      .limit(1);

    if (!paymentMethod) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Payment method not found'
      });
    }

    const maxTransactionsPerPeriod = (paymentMethod as any).maxTransactionsPerPeriod || 10;
    const periodMinutes = (paymentMethod as any).periodMinutes || 10;
    const dailyLimit = parseFloat((paymentMethod as any).dailyTransactionLimit || '500.00');

    // Get transactions in period
    const periodStart = new Date(Date.now() - periodMinutes * 60 * 1000);
    const recentTransactions = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(paymentTransactions)
      .where(
        and(
          eq(paymentTransactions.userId, userId),
          eq(paymentTransactions.paymentMethodId, paymentMethodId),
          gte(paymentTransactions.createdAt, periodStart),
          sql`${paymentTransactions.status} IN ('pending', 'succeeded')`
        )
      );

    const transactionsInPeriod = recentTransactions[0]?.count || 0;

    // Get today's total
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayTransactions = await db
      .select({ total: sql<string>`COALESCE(SUM(${paymentTransactions.amount}), 0)` })
      .from(paymentTransactions)
      .where(
        and(
          eq(paymentTransactions.userId, userId),
          eq(paymentTransactions.paymentMethodId, paymentMethodId),
          gte(paymentTransactions.createdAt, todayStart),
          eq(paymentTransactions.status, 'succeeded')
        )
      );

    const dailyTotal = parseFloat(todayTransactions[0]?.total || '0');

    return {
      transactionsInPeriod,
      maxTransactionsPerPeriod,
      periodMinutes,
      dailyTotal,
      dailyLimit,
      canPay: transactionsInPeriod < maxTransactionsPerPeriod && dailyTotal < dailyLimit
    };
  }

  /**
   * Update payment method frequency limits
   */
  static async updateFrequencyLimits(
    userId: number,
    paymentMethodId: number,
    limits: {
      maxTransactionsPerPeriod?: number;
      periodMinutes?: number;
      dailyTransactionLimit?: number;
    }
  ): Promise<void> {
    // Verify ownership
    const [paymentMethod] = await db
      .select()
      .from(paymentMethods)
      .where(
        and(
          eq(paymentMethods.id, paymentMethodId),
          eq(paymentMethods.userId, userId)
        )
      )
      .limit(1);

    if (!paymentMethod) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Payment method not found'
      });
    }

    // Validate limits
    if (limits.maxTransactionsPerPeriod !== undefined && limits.maxTransactionsPerPeriod < 1) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'maxTransactionsPerPeriod must be at least 1'
      });
    }

    if (limits.periodMinutes !== undefined && limits.periodMinutes < 1) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'periodMinutes must be at least 1'
      });
    }

    if (limits.dailyTransactionLimit !== undefined && limits.dailyTransactionLimit < 0) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'dailyTransactionLimit must be non-negative'
      });
    }

    // Update payment method
    const updates: any = {};
    if (limits.maxTransactionsPerPeriod !== undefined) {
      updates.maxTransactionsPerPeriod = limits.maxTransactionsPerPeriod;
    }
    if (limits.periodMinutes !== undefined) {
      updates.periodMinutes = limits.periodMinutes;
    }
    if (limits.dailyTransactionLimit !== undefined) {
      updates.dailyTransactionLimit = limits.dailyTransactionLimit.toString();
    }

    await db
      .update(paymentMethods)
      .set(updates)
      .where(eq(paymentMethods.id, paymentMethodId));

    // Log the update
    await AuditLogger.logAccountEvent({
      userId,
      action: 'account_updated',
      success: true,
      detail: {
        payment_method_id: paymentMethodId,
        updated_limits: limits
      }
    });
  }
}
