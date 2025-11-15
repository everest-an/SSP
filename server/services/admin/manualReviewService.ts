/**
 * Manual Review Service
 * Handles face match review queue and admin review operations
 * 
 * Sprint 4: Manual Review Panel
 */

import { db } from '../../db';
import { 
  faceMatchAttempts,
  users,
} from '../../../drizzle/schema';
import { eq, and, desc, sql, inArray } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { AuditLogger } from '../../middleware/auditLogger';

// Define faceMatchReviews table inline if not in schema
const faceMatchReviews = null; // Placeholder - will be replaced with actual table

export interface ReviewQueueFilters {
  status?: 'pending' | 'approved' | 'rejected' | 'escalated';
  priority?: 'low' | 'medium' | 'high' | 'critical';
  matchType?: 'enrollment' | 'verification' | 'payment';
  limit?: number;
  offset?: number;
}

export interface ReviewDecision {
  reviewStatus: 'approved' | 'rejected' | 'escalated';
  decision: string;
  notes?: string;
}

/**
 * Manual Review Service
 * Manages the review queue for suspicious face matches
 */
export class ManualReviewService {
  /**
   * Auto-flag a face match for manual review
   * Called by enrollment/verification services when suspicious activity is detected
   */
  static async flagForReview(params: {
    matchAttemptId: number;
    userId: number;
    matchedUserId?: number;
    similarityScore: number;
    matchType: 'enrollment' | 'verification' | 'payment';
    reason: string;
    priority?: 'low' | 'medium' | 'high' | 'critical';
    metadata?: any;
  }): Promise<number> {
    try {
      // Determine priority based on reason and similarity score
      let priority = params.priority || 'medium';
      
      // Auto-escalate certain scenarios
      if (params.reason.includes('duplicate') && params.similarityScore > 0.90) {
        priority = 'high';
      }
      if (params.matchType === 'payment' && params.similarityScore < 0.75) {
        priority = 'critical';
      }
      if (params.reason.includes('liveness') || params.reason.includes('replay')) {
        priority = 'high';
      }

      const [review] = await db.insert(faceMatchReviews).values({
        matchAttemptId: params.matchAttemptId,
        userId: params.userId,
        matchedUserId: params.matchedUserId,
        similarityScore: params.similarityScore.toString(),
        matchType: params.matchType,
        reviewStatus: 'pending',
        reviewPriority: priority,
        autoFlaggedReason: params.reason,
        metadata: params.metadata,
      });

      console.log(`[ManualReview] Flagged match ${params.matchAttemptId} for review (priority: ${priority})`);

      // Log to audit
      await AuditLogger.logSecurityEvent({
        userId: params.userId,
        action: 'flagged_for_review',
        riskScore: params.similarityScore < 0.70 ? 0.8 : 0.5,
        description: `Face match flagged for manual review: ${params.reason}`,
        detail: {
          match_attempt_id: params.matchAttemptId,
          similarity_score: params.similarityScore,
          match_type: params.matchType,
          priority,
        },
      });

      return review.insertId;
    } catch (error) {
      console.error('[ManualReview] Error flagging for review:', error);
      throw error;
    }
  }

  /**
   * Get review queue with filters
   */
  static async getReviewQueue(
    filters: ReviewQueueFilters = {}
  ): Promise<Array<any>> {
    try {
      const {
        status = 'pending',
        priority,
        matchType,
        limit = 50,
        offset = 0,
      } = filters;

      let conditions = [eq(faceMatchReviews.reviewStatus, status)];

      if (priority) {
        conditions.push(eq(faceMatchReviews.reviewPriority, priority));
      }

      if (matchType) {
        conditions.push(eq(faceMatchReviews.matchType, matchType));
      }

      const reviews = await db
        .select({
          id: faceMatchReviews.id,
          matchAttemptId: faceMatchReviews.matchAttemptId,
          userId: faceMatchReviews.userId,
          userEmail: users.email,
          userName: users.name,
          matchedUserId: faceMatchReviews.matchedUserId,
          similarityScore: faceMatchReviews.similarityScore,
          matchType: faceMatchReviews.matchType,
          reviewStatus: faceMatchReviews.reviewStatus,
          reviewPriority: faceMatchReviews.reviewPriority,
          autoFlaggedReason: faceMatchReviews.autoFlaggedReason,
          metadata: faceMatchReviews.metadata,
          createdAt: faceMatchReviews.createdAt,
          reviewedAt: faceMatchReviews.reviewedAt,
        })
        .from(faceMatchReviews)
        .innerJoin(users, eq(faceMatchReviews.userId, users.id))
        .where(and(...conditions))
        .orderBy(
          desc(faceMatchReviews.reviewPriority),
          faceMatchReviews.createdAt
        )
        .limit(limit)
        .offset(offset);

      return reviews;
    } catch (error) {
      console.error('[ManualReview] Error getting review queue:', error);
      throw error;
    }
  }

  /**
   * Get review queue summary statistics
   */
  static async getQueueSummary(): Promise<{
    total: number;
    byPriority: Record<string, number>;
    byMatchType: Record<string, number>;
    oldestPending: Date | null;
  }> {
    try {
      const [stats] = await db
        .select({
          total: sql<number>`COUNT(*)`,
          critical: sql<number>`SUM(CASE WHEN ${faceMatchReviews.reviewPriority} = 'critical' THEN 1 ELSE 0 END)`,
          high: sql<number>`SUM(CASE WHEN ${faceMatchReviews.reviewPriority} = 'high' THEN 1 ELSE 0 END)`,
          medium: sql<number>`SUM(CASE WHEN ${faceMatchReviews.reviewPriority} = 'medium' THEN 1 ELSE 0 END)`,
          low: sql<number>`SUM(CASE WHEN ${faceMatchReviews.reviewPriority} = 'low' THEN 1 ELSE 0 END)`,
          enrollment: sql<number>`SUM(CASE WHEN ${faceMatchReviews.matchType} = 'enrollment' THEN 1 ELSE 0 END)`,
          verification: sql<number>`SUM(CASE WHEN ${faceMatchReviews.matchType} = 'verification' THEN 1 ELSE 0 END)`,
          payment: sql<number>`SUM(CASE WHEN ${faceMatchReviews.matchType} = 'payment' THEN 1 ELSE 0 END)`,
          oldestPending: sql<Date>`MIN(${faceMatchReviews.createdAt})`,
        })
        .from(faceMatchReviews)
        .where(eq(faceMatchReviews.reviewStatus, 'pending'));

      return {
        total: stats.total || 0,
        byPriority: {
          critical: stats.critical || 0,
          high: stats.high || 0,
          medium: stats.medium || 0,
          low: stats.low || 0,
        },
        byMatchType: {
          enrollment: stats.enrollment || 0,
          verification: stats.verification || 0,
          payment: stats.payment || 0,
        },
        oldestPending: stats.oldestPending,
      };
    } catch (error) {
      console.error('[ManualReview] Error getting queue summary:', error);
      throw error;
    }
  }

  /**
   * Submit a review decision
   */
  static async submitReview(
    reviewId: number,
    reviewerId: number,
    decision: ReviewDecision
  ): Promise<void> {
    try {
      // Verify reviewer is an admin
      const [admin] = await db
        .select()
        .from(adminUsers)
        .where(
          and(
            eq(adminUsers.userId, reviewerId),
            eq(adminUsers.active, true)
          )
        )
        .limit(1);

      if (!admin) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'User is not authorized to review',
        });
      }

      // Get the review
      const [review] = await db
        .select()
        .from(faceMatchReviews)
        .where(eq(faceMatchReviews.id, reviewId))
        .limit(1);

      if (!review) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Review not found',
        });
      }

      if (review.reviewStatus !== 'pending') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Review has already been processed',
        });
      }

      // Update the review
      await db
        .update(faceMatchReviews)
        .set({
          reviewStatus: decision.reviewStatus,
          reviewerId,
          reviewDecision: decision.decision,
          reviewedAt: new Date(),
        })
        .where(eq(faceMatchReviews.id, reviewId));

      // Take action based on decision
      if (decision.reviewStatus === 'rejected') {
        // If enrollment was rejected, delete the face profile
        if (review.matchType === 'enrollment') {
          // This would trigger face profile deletion
          // Implementation depends on your face profile service
          console.log(`[ManualReview] Enrollment rejected for user ${review.userId}`);
        }

        // If verification/payment was rejected, log security event
        await AuditLogger.logSecurityEvent({
          userId: review.userId,
          action: 'review_rejected',
          riskScore: 0.9,
          description: `Face match rejected by reviewer: ${decision.decision}`,
          detail: {
            review_id: reviewId,
            match_type: review.matchType,
            similarity_score: review.similarityScore,
          },
        });
      } else if (decision.reviewStatus === 'approved') {
        // Log approval
        await AuditLogger.logSecurityEvent({
          userId: review.userId,
          action: 'review_approved',
          riskScore: 0.2,
          description: `Face match approved by reviewer: ${decision.decision}`,
          detail: {
            review_id: reviewId,
            match_type: review.matchType,
          },
        });
      }

      console.log(`[ManualReview] Review ${reviewId} ${decision.reviewStatus} by admin ${reviewerId}`);
    } catch (error) {
      console.error('[ManualReview] Error submitting review:', error);
      throw error;
    }
  }

  /**
   * Get review details including match attempt data
   */
  static async getReviewDetails(reviewId: number): Promise<any> {
    try {
      const [review] = await db
        .select({
          review: faceMatchReviews,
          user: users,
          matchAttempt: faceMatchAttempts,
        })
        .from(faceMatchReviews)
        .innerJoin(users, eq(faceMatchReviews.userId, users.id))
        .leftJoin(
          faceMatchAttempts,
          eq(faceMatchReviews.matchAttemptId, faceMatchAttempts.id)
        )
        .where(eq(faceMatchReviews.id, reviewId))
        .limit(1);

      if (!review) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Review not found',
        });
      }

      return review;
    } catch (error) {
      console.error('[ManualReview] Error getting review details:', error);
      throw error;
    }
  }

  /**
   * Escalate a review to higher priority or another reviewer
   */
  static async escalateReview(
    reviewId: number,
    escalatedBy: number,
    reason: string
  ): Promise<void> {
    try {
      await db
        .update(faceMatchReviews)
        .set({
          reviewStatus: 'escalated',
          reviewPriority: 'critical',
          autoFlaggedReason: sql`CONCAT(${faceMatchReviews.autoFlaggedReason}, '\n[ESCALATED] ', ${reason})`,
        })
        .where(eq(faceMatchReviews.id, reviewId));

      console.log(`[ManualReview] Review ${reviewId} escalated by admin ${escalatedBy}`);
    } catch (error) {
      console.error('[ManualReview] Error escalating review:', error);
      throw error;
    }
  }

  /**
   * Get reviewer performance statistics
   */
  static async getReviewerStats(reviewerId: number, days: number = 30): Promise<any> {
    try {
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

      const [stats] = await db
        .select({
          totalReviews: sql<number>`COUNT(*)`,
          approved: sql<number>`SUM(CASE WHEN ${faceMatchReviews.reviewStatus} = 'approved' THEN 1 ELSE 0 END)`,
          rejected: sql<number>`SUM(CASE WHEN ${faceMatchReviews.reviewStatus} = 'rejected' THEN 1 ELSE 0 END)`,
          escalated: sql<number>`SUM(CASE WHEN ${faceMatchReviews.reviewStatus} = 'escalated' THEN 1 ELSE 0 END)`,
          avgReviewTimeMinutes: sql<number>`AVG(TIMESTAMPDIFF(MINUTE, ${faceMatchReviews.createdAt}, ${faceMatchReviews.reviewedAt}))`,
        })
        .from(faceMatchReviews)
        .where(
          and(
            eq(faceMatchReviews.reviewerId, reviewerId),
            sql`${faceMatchReviews.reviewedAt} >= ${since}`
          )
        );

      return stats;
    } catch (error) {
      console.error('[ManualReview] Error getting reviewer stats:', error);
      throw error;
    }
  }
}
