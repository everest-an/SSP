/**
 * Face Recognition API Routes
 * 
 * Endpoints for:
 * - Enrolling user faces
 * - Verifying faces for payment
 * - Managing face data
 */

import { Router } from 'express';
import { z } from 'zod';
import * as faceService from '../services/faceRecognitionService';
import { validateEmbedding } from '../services/faceRecognitionService';
import { requireAuth } from '../middleware/auth';

const router = Router();

/**
 * POST /api/face/enroll
 * Enroll a new face for the user
 */
router.post('/enroll', requireAuth, async (req, res) => {
  try {
    const { embedding, confidence, metadata } = req.body;
    
    // Validate embedding
    if (!validateEmbedding(embedding)) {
      return res.status(400).json({
        error: 'Invalid embedding format',
        details: 'Embedding must be an array of 128 or 512 numbers',
      });
    }
    
    if (typeof confidence !== 'number' || confidence < 0 || confidence > 1) {
      return res.status(400).json({
        error: 'Invalid confidence score',
        details: 'Confidence must be a number between 0 and 1',
      });
    }
    
    // Store embedding
    const stored = await faceService.storeFaceEmbedding(
      req.user!.id,
      embedding,
      Math.round(confidence * 100),
      metadata
    );
    
    res.json({
      success: true,
      data: stored,
    });
  } catch (error) {
    console.error('[FaceAPI] Enrollment error:', error);
    res.status(500).json({
      error: 'Failed to enroll face',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/face/verify
 * Verify a face against user's enrolled faces
 */
router.post('/verify', requireAuth, async (req, res) => {
  try {
    const { embedding, threshold } = req.body;
    
    // Validate embedding
    if (!validateEmbedding(embedding)) {
      return res.status(400).json({
        error: 'Invalid embedding format',
      });
    }
    
    const verifyThreshold = threshold || 0.6;
    
    // Verify against user's profile
    const result = await faceService.verifyFaceAgainstUser(
      embedding,
      req.user!.id,
      verifyThreshold
    );
    
    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('[FaceAPI] Verification error:', error);
    res.status(500).json({
      error: 'Failed to verify face',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/face/identify
 * Identify user from face embedding (search all users)
 */
router.post('/identify', async (req, res) => {
  try {
    const { embedding, threshold } = req.body;
    
    // Validate embedding
    if (!validateEmbedding(embedding)) {
      return res.status(400).json({
        error: 'Invalid embedding format',
      });
    }
    
    const identifyThreshold = threshold || 0.6;
    
    // Find matching user
    const result = await faceService.findUserByFaceEmbedding(
      embedding,
      identifyThreshold
    );
    
    if (!result) {
      return res.status(404).json({
        success: false,
        error: 'No matching user found',
      });
    }
    
    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('[FaceAPI] Identification error:', error);
    res.status(500).json({
      error: 'Failed to identify user',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/face/profile
 * Get user's face profile
 */
router.get('/profile', requireAuth, async (req, res) => {
  try {
    const profile = await faceService.getUserFaceProfile(req.user!.id);
    
    if (!profile) {
      return res.status(404).json({
        error: 'No face profile found',
      });
    }
    
    res.json({
      success: true,
      data: profile,
    });
  } catch (error) {
    console.error('[FaceAPI] Profile fetch error:', error);
    res.status(500).json({
      error: 'Failed to fetch profile',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/face/statistics
 * Get face enrollment statistics
 */
router.get('/statistics', requireAuth, async (req, res) => {
  try {
    const stats = await faceService.getFaceStatistics(req.user!.id);
    
    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error('[FaceAPI] Statistics error:', error);
    res.status(500).json({
      error: 'Failed to fetch statistics',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * DELETE /api/face/embeddings
 * Delete all face embeddings for user
 */
router.delete('/embeddings', requireAuth, async (req, res) => {
  try {
    const deletedCount = await faceService.deleteFaceEmbeddings(req.user!.id);
    
    res.json({
      success: true,
      message: `Deleted ${deletedCount} face embeddings`,
      data: { deletedCount },
    });
  } catch (error) {
    console.error('[FaceAPI] Delete error:', error);
    res.status(500).json({
      error: 'Failed to delete embeddings',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/face/cleanup
 * Keep only recent embeddings
 */
router.post('/cleanup', requireAuth, async (req, res) => {
  try {
    const { keepCount } = req.body;
    const count = keepCount || 10;
    
    const deletedCount = await faceService.cleanupOldEmbeddings(
      req.user!.id,
      count
    );
    
    res.json({
      success: true,
      message: `Cleaned up ${deletedCount} old embeddings`,
      data: { deletedCount },
    });
  } catch (error) {
    console.error('[FaceAPI] Cleanup error:', error);
    res.status(500).json({
      error: 'Failed to cleanup embeddings',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
