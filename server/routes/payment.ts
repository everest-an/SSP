/**
 * Payment API Routes
 * Routes for payment control and management
 * Sprint 4: Payment Pause Feature
 */

import { Router } from 'express';
import { PaymentPauseService } from '../services/payment/paymentPauseService';
import { PaymentFrequencyChecker } from '../services/payment/paymentFrequencyChecker';

const router = Router();

/**
 * Get payment status
 * GET /api/payment/status
 */
router.get('/status', async (req, res) => {
  try {
    const userId = (req as any).user?.id || 1;
    const status = await PaymentPauseService.getPaymentStatus(userId);
    res.json(status);
  } catch (error) {
    console.error('Error getting payment status:', error);
    res.status(500).json({ error: 'Failed to get payment status' });
  }
});

/**
 * Pause payments
 * POST /api/payment/pause
 */
router.post('/pause', async (req, res) => {
  try {
    const userId = (req as any).user?.id || 1;
    const { reason } = req.body;

    await PaymentPauseService.pausePayments(userId, reason);

    res.json({
      success: true,
      message: 'Payments paused successfully',
    });
  } catch (error) {
    console.error('Error pausing payments:', error);
    res.status(500).json({ error: error.message || 'Failed to pause payments' });
  }
});

/**
 * Resume payments
 * POST /api/payment/resume
 */
router.post('/resume', async (req, res) => {
  try {
    const userId = (req as any).user?.id || 1;

    await PaymentPauseService.resumePayments(userId);

    res.json({
      success: true,
      message: 'Payments resumed successfully',
    });
  } catch (error) {
    console.error('Error resuming payments:', error);
    res.status(500).json({ error: error.message || 'Failed to resume payments' });
  }
});

/**
 * Toggle payment status
 * POST /api/payment/toggle
 */
router.post('/toggle', async (req, res) => {
  try {
    const userId = (req as any).user?.id || 1;
    const { reason } = req.body;

    const status = await PaymentPauseService.togglePayments(userId, reason);

    res.json(status);
  } catch (error) {
    console.error('Error toggling payments:', error);
    res.status(500).json({ error: 'Failed to toggle payments' });
  }
});

/**
 * Check if payment is allowed
 * GET /api/payment/check-allowed
 */
router.get('/check-allowed', async (req, res) => {
  try {
    const userId = (req as any).user?.id || 1;
    const result = await PaymentPauseService.checkPaymentAllowed(userId);
    res.json(result);
  } catch (error) {
    console.error('Error checking payment allowed:', error);
    res.status(500).json({ error: 'Failed to check payment status' });
  }
});

/**
 * Get frequency status
 * GET /api/payment/frequency-status
 */
router.get('/frequency-status', async (req, res) => {
  try {
    const userId = (req as any).user?.id || 1;
    const paymentMethodId = parseInt(req.query.paymentMethodId as string);

    const status = await PaymentFrequencyChecker.getFrequencyStatus(
      userId,
      paymentMethodId
    );

    res.json(status);
  } catch (error) {
    console.error('Error getting frequency status:', error);
    res.status(500).json({ error: 'Failed to get frequency status' });
  }
});

/**
 * Update frequency limits
 * PUT /api/payment/frequency-limits
 */
router.put('/frequency-limits', async (req, res) => {
  try {
    const userId = (req as any).user?.id || 1;
    const { paymentMethodId, limits } = req.body;

    await PaymentFrequencyChecker.updateFrequencyLimits(
      userId,
      paymentMethodId,
      limits
    );

    res.json({
      success: true,
      message: 'Frequency limits updated successfully',
    });
  } catch (error) {
    console.error('Error updating frequency limits:', error);
    res.status(500).json({ error: 'Failed to update frequency limits' });
  }
});

/**
 * Get pause statistics (admin only)
 * GET /api/payment/pause-stats
 */
router.get('/pause-stats', async (req, res) => {
  try {
    // TODO: Add admin auth check
    const stats = await PaymentPauseService.getPauseStatistics();
    res.json(stats);
  } catch (error) {
    console.error('Error getting pause statistics:', error);
    res.status(500).json({ error: 'Failed to get pause statistics' });
  }
});

export default router;
