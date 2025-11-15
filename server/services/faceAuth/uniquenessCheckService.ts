/**
 * Face Uniqueness Check Service
 * 
 * Provides global uniqueness detection for face embeddings to prevent duplicate registrations.
 * Uses FAISS vector index for efficient similarity search.
 * 
 * Sprint 3 - Phase 1: Global Uniqueness Detection
 */

import { db } from '../../db';
import { faceProfiles } from '../../../drizzle/schema';
import { getVectorIndexService } from './vectorIndexBridge';
import { AuditLogger } from '../../middleware/auditLogger';
import type { Request } from 'express';

export interface UniquenessCheckResult {
  is_unique: boolean;
  confidence: 'high' | 'medium' | 'low';
  best_match?: {
    face_profile_id: number;
    user_id: number;
    similarity: number;
    enrolled_at: Date;
  };
  message: string;
  risk_score: number;
}

/**
 * Check if a face embedding is unique (not a duplicate of existing faces)
 * 
 * @param embedding - Face embedding vector to check
 * @param excludeProfileId - Optional face profile ID to exclude from search (for re-enrollment)
 * @param userId - Optional user ID for audit logging
 * @param req - Optional Express request for audit logging
 * @returns UniquenessCheckResult with duplicate detection information
 */
export async function checkFaceUniqueness(
  embedding: number[],
  excludeProfileId?: number,
  userId?: number,
  req?: Request
): Promise<UniquenessCheckResult> {
  try {
    const vectorIndexService = getVectorIndexService();
    
    // Search for similar faces in the index
    const searchResults = await vectorIndexService.searchSimilar(
      embedding,
      { k: 5, excludeId: excludeProfileId }
    );
    
    if (searchResults.length === 0) {
      // No similar faces found
      const result: UniquenessCheckResult = {
        is_unique: true,
        confidence: 'high',
        message: 'Face is unique, no duplicates found',
        risk_score: 0,
      };
      
      // Log successful uniqueness check
      await AuditLogger.logSecurityEvent({
        userId,
        action: 'duplicate_face',
        riskScore: 0,
        description: 'Face uniqueness check passed',
        req,
        detail: {
          embedding_dimension: embedding.length,
          search_results_count: 0,
        },
      });
      
      return result;
    }
    
    // Get best match
    const bestMatch = searchResults[0];
    
    // Fetch face profile details from database
    const faceProfile = await db
      .select()
      .from(faceProfiles)
      .where((t) => t.id === bestMatch.face_profile_id)
      .limit(1)
      .then((results) => results[0]);
    
    if (!faceProfile) {
      console.error(`[UniquenessCheck] Face profile ${bestMatch.face_profile_id} not found in database`);
      return {
        is_unique: true,
        confidence: 'low',
        message: 'Unable to verify uniqueness due to database error',
        risk_score: 0.3,
      };
    }
    
    // Determine if it's a duplicate based on similarity threshold
    const DUPLICATE_THRESHOLD = 0.85;
    const is_duplicate = bestMatch.similarity >= DUPLICATE_THRESHOLD;
    
    const result: UniquenessCheckResult = {
      is_unique: !is_duplicate,
      confidence: bestMatch.confidence_level,
      best_match: {
        face_profile_id: bestMatch.face_profile_id,
        user_id: faceProfile.userId,
        similarity: bestMatch.similarity,
        enrolled_at: faceProfile.createdAt,
      },
      message: is_duplicate
        ? `Possible duplicate detected (similarity: ${bestMatch.similarity.toFixed(4)})`
        : `Similar face found but below duplicate threshold (similarity: ${bestMatch.similarity.toFixed(4)})`,
      risk_score: is_duplicate ? 0.8 : 0.2,
    };
    
    // Log the result
    if (is_duplicate) {
      await AuditLogger.logSecurityEvent({
        userId,
        action: 'duplicate_face',
        riskScore: 0.8,
        description: `Duplicate face detected with similarity ${bestMatch.similarity.toFixed(4)}`,
        req,
        detail: {
          existing_face_profile_id: bestMatch.face_profile_id,
          existing_user_id: faceProfile.userId,
          similarity: bestMatch.similarity,
          threshold: DUPLICATE_THRESHOLD,
        },
      });
    } else {
      await AuditLogger.logSecurityEvent({
        userId,
        action: 'duplicate_face',
        riskScore: 0.2,
        description: `Similar face found but below threshold (similarity: ${bestMatch.similarity.toFixed(4)})`,
        req,
        detail: {
          similar_face_profile_id: bestMatch.face_profile_id,
          similar_user_id: faceProfile.userId,
          similarity: bestMatch.similarity,
          threshold: DUPLICATE_THRESHOLD,
        },
      });
    }
    
    return result;
  } catch (error) {
    console.error('[UniquenessCheck] Error checking face uniqueness:', error);
    
    // Log error
    await AuditLogger.logSecurityEvent({
      userId,
      action: 'duplicate_face',
      riskScore: 0.5,
      description: `Error checking face uniqueness: ${error instanceof Error ? error.message : 'Unknown error'}`,
      req,
    });
    
    return {
      is_unique: false,
      confidence: 'low',
      message: `Error checking uniqueness: ${error instanceof Error ? error.message : 'Unknown error'}`,
      risk_score: 0.5,
    };
  }
}

/**
 * Check if a user already has an enrolled face profile
 * 
 * @param userId - User ID to check
 * @returns true if user has at least one active face profile
 */
export async function userHasEnrolledFace(userId: number): Promise<boolean> {
  try {
    const result = await db
      .select()
      .from(faceProfiles)
      .where((t) => t.userId === userId && t.status === 'active')
      .limit(1);
    
    return result.length > 0;
  } catch (error) {
    console.error('[UniquenessCheck] Error checking user enrolled face:', error);
    return false;
  }
}

/**
 * Get all active face profiles for a user
 * 
 * @param userId - User ID
 * @returns Array of active face profiles
 */
export async function getUserFaceProfiles(userId: number) {
  try {
    return await db
      .select()
      .from(faceProfiles)
      .where((t) => t.userId === userId && t.status === 'active');
  } catch (error) {
    console.error('[UniquenessCheck] Error fetching user face profiles:', error);
    return [];
  }
}

/**
 * Revoke a face profile (mark as inactive)
 * 
 * @param faceProfileId - Face profile ID to revoke
 * @param reason - Reason for revocation
 * @returns true if revoked successfully
 */
export async function revokeFaceProfile(
  faceProfileId: number,
  reason?: string
): Promise<boolean> {
  try {
    const vectorIndexService = getVectorIndexService();
    
    // Update face profile status
    await db
      .update(faceProfiles)
      .set({
        status: 'revoked',
        updatedAt: new Date(),
      })
      .where((t) => t.id === faceProfileId);
    
    // Remove from vector index
    await vectorIndexService.removeVector(faceProfileId);
    
    console.log(`[UniquenessCheck] Revoked face profile ${faceProfileId}${reason ? `: ${reason}` : ''}`);
    
    return true;
  } catch (error) {
    console.error('[UniquenessCheck] Error revoking face profile:', error);
    return false;
  }
}

/**
 * Get statistics about face profiles and potential duplicates
 * 
 * @returns Statistics object
 */
export async function getFaceProfileStats() {
  try {
    const vectorIndexService = getVectorIndexService();
    const indexStats = await vectorIndexService.getStats();
    
    // Get total face profiles
    const totalProfiles = await db
      .select()
      .from(faceProfiles)
      .then((results) => results.length);
    
    // Get active profiles
    const { eq } = await import('drizzle-orm');
    const activeProfiles = await db
      .select()
      .from(faceProfiles)
      .where(eq(faceProfiles.status, 'active'))
      .then((results) => results.length);
    
    // Get revoked profiles
    const revokedProfiles = await db
      .select()
      .from(faceProfiles)
      .where(eq(faceProfiles.status, 'revoked'))
      .then((results) => results.length);
    
    return {
      total_profiles: totalProfiles,
      active_profiles: activeProfiles,
      revoked_profiles: revokedProfiles,
      pending_review_profiles: totalProfiles - activeProfiles - revokedProfiles,
      vector_index: indexStats,
    };
  } catch (error) {
    console.error('[UniquenessCheck] Error getting face profile stats:', error);
    return {
      total_profiles: 0,
      active_profiles: 0,
      revoked_profiles: 0,
      pending_review_profiles: 0,
      vector_index: {},
    };
  }
}

export default {
  checkFaceUniqueness,
  userHasEnrolledFace,
  getUserFaceProfiles,
  revokeFaceProfile,
  getFaceProfileStats,
};
