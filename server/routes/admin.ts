/**
 * Admin API Routes
 * Routes for manual review panel and admin operations
 * Sprint 4: Admin Review Panel
 */

import { Router } from 'express';
import { ManualReviewService } from '../services/admin/manualReviewService';

const router = Router();

/**
 * Get review queue with filters
 * GET /api/admin/reviews?status=pending&priority=high
 */
router.get('/reviews', async (req, res) => {
  try {
    const { status, priority, matchType, limit, offset } = req.query;

    const reviews = await ManualReviewService.getReviewQueue({
      status: status as any,
      priority: priority as any,
      matchType: matchType as any,
      limit: limit ? parseInt(limit as string) : undefined,
      offset: offset ? parseInt(offset as string) : undefined,
    });

    res.json({ reviews });
  } catch (error) {
    console.error('Error getting review queue:', error);
    res.status(500).json({ error: 'Failed to get review queue' });
  }
});

/**
 * Get review queue summary
 * GET /api/admin/reviews/summary
 */
router.get('/reviews/summary', async (req, res) => {
  try {
    const summary = await ManualReviewService.getQueueSummary();
    res.json(summary);
  } catch (error) {
    console.error('Error getting queue summary:', error);
    res.status(500).json({ error: 'Failed to get queue summary' });
  }
});

/**
 * Get review details
 * GET /api/admin/reviews/:id
 */
router.get('/reviews/:id', async (req, res) => {
  try {
    const reviewId = parseInt(req.params.id);
    const details = await ManualReviewService.getReviewDetails(reviewId);
    res.json(details);
  } catch (error) {
    console.error('Error getting review details:', error);
    res.status(500).json({ error: 'Failed to get review details' });
  }
});

/**
 * Submit review decision
 * POST /api/admin/reviews/:id/decision
 */
router.post('/reviews/:id/decision', async (req, res) => {
  try {
    const reviewId = parseInt(req.params.id);
    const { reviewStatus, decision } = req.body;
    
    // TODO: Get reviewer ID from session/auth
    const reviewerId = (req as any).user?.id || 1;

    await ManualReviewService.submitReview(reviewId, reviewerId, {
      reviewStatus,
      decision,
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error submitting review:', error);
    res.status(500).json({ error: 'Failed to submit review' });
  }
});

/**
 * Escalate review
 * POST /api/admin/reviews/:id/escalate
 */
router.post('/reviews/:id/escalate', async (req, res) => {
  try {
    const reviewId = parseInt(req.params.id);
    const { reason } = req.body;
    
    // TODO: Get admin ID from session/auth
    const adminId = (req as any).user?.id || 1;

    await ManualReviewService.escalateReview(reviewId, adminId, reason);

    res.json({ success: true });
  } catch (error) {
    console.error('Error escalating review:', error);
    res.status(500).json({ error: 'Failed to escalate review' });
  }
});

/**
 * Get reviewer statistics
 * GET /api/admin/reviewers/:id/stats
 */
router.get('/reviewers/:id/stats', async (req, res) => {
  try {
    const reviewerId = parseInt(req.params.id);
    const days = req.query.days ? parseInt(req.query.days as string) : 30;

    const stats = await ManualReviewService.getReviewerStats(reviewerId, days);
    res.json(stats);
  } catch (error) {
    console.error('Error getting reviewer stats:', error);
    res.status(500).json({ error: 'Failed to get reviewer stats' });
  }
});

export default router;
