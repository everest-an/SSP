/**
 * Privacy API Routes
 * Routes for user privacy settings and data rights
 * Sprint 4: User Privacy Controls
 */

import { Router } from 'express';
import { UserPrivacyService } from '../services/privacy/userPrivacyService';
import { PaymentPauseService } from '../services/payment/paymentPauseService';

const router = Router();

/**
 * Get privacy dashboard
 * GET /api/privacy/dashboard
 */
router.get('/dashboard', async (req, res) => {
  try {
    const userId = (req as any).user?.id || 1;
    const dashboard = await UserPrivacyService.getPrivacyDashboard(userId);
    res.json(dashboard);
  } catch (error) {
    console.error('Error getting privacy dashboard:', error);
    res.status(500).json({ error: 'Failed to get privacy dashboard' });
  }
});

/**
 * Get privacy settings
 * GET /api/privacy/settings
 */
router.get('/settings', async (req, res) => {
  try {
    const userId = (req as any).user?.id || 1;
    const settings = await UserPrivacyService.getPrivacySettings(userId);
    
    // Also get data stats
    const dashboard = await UserPrivacyService.getPrivacyDashboard(userId);
    
    res.json({
      settings,
      dataStats: dashboard.dataStats,
    });
  } catch (error) {
    console.error('Error getting privacy settings:', error);
    res.status(500).json({ error: 'Failed to get privacy settings' });
  }
});

/**
 * Update privacy settings
 * PUT /api/privacy/settings
 */
router.put('/settings', async (req, res) => {
  try {
    const userId = (req as any).user?.id || 1;
    const updates = req.body;
    
    const context = {
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    };

    await UserPrivacyService.updatePrivacySettings(userId, updates, context);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating privacy settings:', error);
    res.status(500).json({ error: 'Failed to update privacy settings' });
  }
});

/**
 * Get consent history
 * GET /api/privacy/consent-history
 */
router.get('/consent-history', async (req, res) => {
  try {
    const userId = (req as any).user?.id || 1;
    const history = await UserPrivacyService.getConsentHistory(userId);
    res.json({ history });
  } catch (error) {
    console.error('Error getting consent history:', error);
    res.status(500).json({ error: 'Failed to get consent history' });
  }
});

/**
 * Request data deletion
 * POST /api/privacy/delete-request
 */
router.post('/delete-request', async (req, res) => {
  try {
    const userId = (req as any).user?.id || 1;
    const { requestType, notes } = req.body;

    const token = await UserPrivacyService.requestDataDeletion(
      userId,
      requestType,
      notes
    );

    res.json({
      success: true,
      message: 'Deletion request submitted. Check your email for confirmation.',
      confirmationToken: token,
    });
  } catch (error) {
    console.error('Error requesting data deletion:', error);
    res.status(500).json({ error: 'Failed to request data deletion' });
  }
});

/**
 * Confirm data deletion
 * POST /api/privacy/confirm-deletion
 */
router.post('/confirm-deletion', async (req, res) => {
  try {
    const userId = (req as any).user?.id || 1;
    const { confirmationToken } = req.body;

    await UserPrivacyService.confirmDataDeletion(userId, confirmationToken);

    res.json({
      success: true,
      message: 'Data deletion completed successfully',
    });
  } catch (error) {
    console.error('Error confirming data deletion:', error);
    res.status(500).json({ error: 'Failed to confirm data deletion' });
  }
});

/**
 * Export user data
 * GET /api/privacy/export
 */
router.get('/export', async (req, res) => {
  try {
    const userId = (req as any).user?.id || 1;
    const data = await UserPrivacyService.exportUserData(userId);
    
    res.json(data);
  } catch (error) {
    console.error('Error exporting user data:', error);
    res.status(500).json({ error: 'Failed to export user data' });
  }
});

/**
 * Get deletion requests
 * GET /api/privacy/deletion-requests
 */
router.get('/deletion-requests', async (req, res) => {
  try {
    const userId = (req as any).user?.id || 1;
    const requests = await UserPrivacyService.getDeletionRequests(userId);
    res.json({ requests });
  } catch (error) {
    console.error('Error getting deletion requests:', error);
    res.status(500).json({ error: 'Failed to get deletion requests' });
  }
});

export default router;
