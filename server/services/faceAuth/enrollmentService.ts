/**
 * Enhanced Face Enrollment Service
 * Integrates FAISS vector index, active liveness, and anti-replay detection
 * 
 * Sprint 3 Phase 5: Complete Registration Flow
 */

import { db } from '../../db';
import { 
  faceProfiles, 
  faceEmbeddings, 
  faceEnrollmentHistory,
  faceIndexMap,
  faceMatchAttempts,
  auditLogs,
  users
} from '../../../drizzle/schema';
import { eq, and } from 'drizzle-orm';
import { getVectorIndexService } from './vectorIndexBridge';
import { AntiReplayService } from './antiReplay';
import { encryptFaceEmbedding, decryptFaceEmbedding } from './encryption';
import { TRPCError } from '@trpc/server';

export interface EnrollmentInput {
  userId: number;
  embedding: number[];
  videoHash: string;
  videoMetadata?: {
    duration: number;
    frameCount: number;
    createdAt?: Date;
  };
  livenessScore: number;
  livenessMethod: 'active' | 'passive' | 'hybrid';
  challengeResults?: Array<{
    type: string;
    confidence: number;
    completed: boolean;
  }>;
  enrollmentQuality?: number;
  deviceFingerprint?: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface EnrollmentResult {
  success: boolean;
  faceProfileId?: number;
  vectorIndexId?: string;
  warnings?: string[];
  errors?: string[];
}

/**
 * Face Enrollment Service
 * Handles complete face enrollment workflow with security checks
 */
export class FaceEnrollmentService {
  /**
   * Enroll a new face for a user
   * 
   * Process:
   * 1. Anti-replay check (video hash)
   * 2. FAISS duplicate detection (global uniqueness)
   * 3. Encrypt and store embedding
   * 4. Add to FAISS index
   * 5. Create audit log
   */
  static async enrollFace(input: EnrollmentInput): Promise<EnrollmentResult> {
    const warnings: string[] = [];
    const errors: string[] = [];
    const startTime = Date.now();

    try {
      // Step 1: Anti-replay check
      console.log(`[Enrollment] Step 1: Anti-replay check for user ${input.userId}`);
      const replayCheck = await AntiReplayService.checkReplay(
        input.videoHash,
        input.userId,
        input.videoMetadata ? {
          hash: input.videoHash,
          duration: input.videoMetadata.duration,
          frameCount: input.videoMetadata.frameCount,
          createdAt: input.videoMetadata.createdAt
        } : undefined
      );

      if (replayCheck.isReplay) {
        await this.logEnrollmentAttempt(input, null, false, `Replay detected: ${replayCheck.reason}`);
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Security check failed: ${replayCheck.reason}`
        });
      }

      if (replayCheck.riskScore > 0.5) {
        warnings.push(`Medium risk detected (${(replayCheck.riskScore * 100).toFixed(0)}%): ${replayCheck.reason}`);
      }

      // Step 2: FAISS duplicate detection
      console.log(`[Enrollment] Step 2: FAISS duplicate detection`);
      const vectorService = getVectorIndexService();
      
      // Check if user already has a face profile (allow re-enrollment)
      const existingProfiles = await db
        .select()
        .from(faceProfiles)
        .where(eq(faceProfiles.userId, input.userId))
        .limit(1);

      const excludeId = existingProfiles.length > 0 ? existingProfiles[0].id : undefined;

      // Check for duplicates
      const duplicateCheck = await vectorService.checkDuplicate(
        input.embedding,
        excludeId
      );

      if (duplicateCheck.is_duplicate && duplicateCheck.best_match) {
        // Check if duplicate belongs to same user (re-enrollment) or different user
        const [duplicateProfile] = await db
          .select()
          .from(faceProfiles)
          .where(eq(faceProfiles.id, duplicateCheck.best_match.face_profile_id))
          .limit(1);

        if (duplicateProfile && duplicateProfile.userId !== input.userId) {
          // Duplicate belongs to different user - BLOCK
          await this.logEnrollmentAttempt(
            input, 
            null, 
            false, 
            `Duplicate face detected (user ${duplicateProfile.userId}, similarity ${(duplicateCheck.best_match.similarity * 100).toFixed(1)}%)`
          );

          throw new TRPCError({
            code: 'CONFLICT',
            message: 'This face is already registered to another account. Each face can only be used once.'
          });
        } else if (duplicateProfile && duplicateProfile.userId === input.userId) {
          // Same user re-enrolling - ALLOW but warn
          warnings.push(`Re-enrollment detected (similarity ${(duplicateCheck.best_match.similarity * 100).toFixed(1)}%)`);
        }
      }

      // Step 3: Check liveness score threshold
      console.log(`[Enrollment] Step 3: Liveness validation (score: ${input.livenessScore})`);
      const MIN_LIVENESS_SCORE = 0.7;
      if (input.livenessScore < MIN_LIVENESS_SCORE) {
        await this.logEnrollmentAttempt(input, null, false, `Low liveness score: ${input.livenessScore}`);
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Liveness check failed. Score: ${input.livenessScore.toFixed(2)}, required: ${MIN_LIVENESS_SCORE}`
        });
      }

      // Step 4: Encrypt and store embedding
      console.log(`[Enrollment] Step 4: Encrypt and store embedding`);
      const encrypted = await encryptFaceEmbedding(input.embedding);

      // Delete old face profile if re-enrolling
      if (existingProfiles.length > 0) {
        const oldProfileId = existingProfiles[0].id;
        
        // Remove from FAISS index
        await vectorService.removeVector(oldProfileId);
        
        // Delete from database
        await db.delete(faceProfiles).where(eq(faceProfiles.id, oldProfileId));
        
        warnings.push(`Replaced previous face profile (ID: ${oldProfileId})`);
      }

      // Insert new face profile
      const [faceProfile] = await db
        .insert(faceProfiles)
        .values({
          userId: input.userId,
          encryptedEmbedding: encrypted.ciphertext,
          kmsKeyId: encrypted.keyId,
          enrollmentQuality: input.enrollmentQuality || null,
          modelVersion: 'mediapipe-v1',
          status: 'active'
        })
        .$returningId();

      const faceProfileId = faceProfile.id;

      // Insert embedding record
      await db.insert(faceEmbeddings).values({
        faceProfileId,
        encryptedEmbedding: encrypted.ciphertext,
        embeddingVersion: 'v1',
        qualityScore: input.enrollmentQuality || null
      });

      // Step 5: Add to FAISS index
      console.log(`[Enrollment] Step 5: Add to FAISS index`);
      const addSuccess = await vectorService.addVector(faceProfileId, input.embedding);
      
      if (!addSuccess) {
        warnings.push('Failed to add to vector index. Face profile saved but search may not work.');
      }

      // Create index mapping
      const vectorDbId = `faiss_${faceProfileId}_${Date.now()}`;
      await db.insert(faceIndexMap).values({
        faceProfileId,
        vectorDbId,
        vectorDbType: 'faiss',
        indexVersion: 'v1'
      });

      // Step 6: Create enrollment history
      await db.insert(faceEnrollmentHistory).values({
        faceProfileId,
        action: 'enrolled',
        previousStatus: existingProfiles.length > 0 ? 'active' : null,
        newStatus: 'active',
        reason: 'User enrollment',
        performedBy: 'user',
        ipAddress: input.ipAddress || null,
        userAgent: input.userAgent || null,
        deviceFingerprint: input.deviceFingerprint || null
      });

      // Step 7: Log successful enrollment
      await this.logEnrollmentAttempt(input, faceProfileId, true, 'Enrollment successful');

      // Step 8: Create audit log
      await db.insert(auditLogs).values({
        userId: input.userId,
        action: 'face_enroll',
        actor: 'user',
        resourceType: 'face_profile',
        resourceId: faceProfileId.toString(),
        ipAddress: input.ipAddress || null,
        userAgent: input.userAgent || null,
        deviceFingerprint: input.deviceFingerprint || null,
        detail: {
          liveness_score: input.livenessScore,
          liveness_method: input.livenessMethod,
          enrollment_quality: input.enrollmentQuality,
          challenge_results: input.challengeResults,
          video_hash: input.videoHash,
          processing_time_ms: Date.now() - startTime
        },
        riskScore: replayCheck.riskScore.toString(),
        status: 'success'
      });

      // Step 9: Update user's last activity
      await db
        .update(users)
        .set({ lastSignedIn: new Date() })
        .where(eq(users.id, input.userId));

      console.log(`[Enrollment] ✅ Success for user ${input.userId}, face_profile_id=${faceProfileId}`);

      return {
        success: true,
        faceProfileId,
        vectorIndexId: vectorDbId,
        warnings: warnings.length > 0 ? warnings : undefined
      };

    } catch (error) {
      console.error('[Enrollment] ❌ Error:', error);

      // Log failed attempt
      await this.logEnrollmentAttempt(
        input, 
        null, 
        false, 
        error instanceof Error ? error.message : 'Unknown error'
      );

      if (error instanceof TRPCError) {
        throw error;
      }

      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Face enrollment failed. Please try again.'
      });
    }
  }

  /**
   * Log enrollment attempt for monitoring and fraud detection
   */
  private static async logEnrollmentAttempt(
    input: EnrollmentInput,
    faceProfileId: number | null,
    success: boolean,
    failureReason?: string
  ): Promise<void> {
    try {
      await db.insert(faceMatchAttempts).values({
        userId: input.userId,
        faceProfileId,
        sessionId: input.videoHash,
        attemptType: 'enrollment_check',
        similarityScore: null,
        thresholdUsed: '0.8500',
        success,
        failureReason: failureReason || null,
        livenessPassed: input.livenessScore >= 0.7,
        livenessConfidence: input.livenessScore.toString(),
        ipAddress: input.ipAddress || null,
        deviceFingerprint: input.deviceFingerprint || null,
        processingTimeMs: null
      });
    } catch (error) {
      console.error('[Enrollment] Failed to log attempt:', error);
    }
  }

  /**
   * Check if user can enroll a face
   */
  static async canEnroll(userId: number): Promise<{ allowed: boolean; reason?: string }> {
    // Check if user exists
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      return { allowed: false, reason: 'User not found' };
    }

    // Check account status
    if (user.accountStatus === 'suspended' || user.accountStatus === 'locked') {
      return { allowed: false, reason: `Account ${user.accountStatus}` };
    }

    // Check risk score
    if (user.riskScore && parseFloat(user.riskScore) > 0.8) {
      return { allowed: false, reason: 'Account flagged for security review' };
    }

    return { allowed: true };
  }
}
