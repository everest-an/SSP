/**
 * Enhanced Face Verification Service
 * Integrates FAISS vector search, active liveness, and anti-replay detection
 * 
 * Sprint 3 Phase 5: Complete Login Flow
 */

import { db } from '../../db';
import { 
  faceProfiles, 
  faceEmbeddings,
  faceMatchAttempts,
  faceVerificationSessions,
  auditLogs,
  users
} from '../../../drizzle/schema';
import { eq, and, desc } from 'drizzle-orm';
import { getVectorIndexService } from './vectorIndexBridge';
import { AntiReplayService } from './antiReplay';
import { decryptFaceEmbedding } from './encryption';
import { TRPCError } from '@trpc/server';

export interface VerificationInput {
  userId?: number;  // Optional for login (we'll find the user)
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
  action: 'login' | 'payment' | 'verification';
  deviceFingerprint?: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface VerificationResult {
  success: boolean;
  userId?: number;
  faceProfileId?: number;
  similarityScore?: number;
  confidence?: 'high' | 'medium' | 'low';
  sessionToken?: string;
  warnings?: string[];
  requiresAdditionalAuth?: boolean;
}

/**
 * Face Verification Service
 * Handles complete face verification workflow for login/payment
 */
export class FaceVerificationService {
  private static readonly HIGH_CONFIDENCE_THRESHOLD = 0.85;
  private static readonly MEDIUM_CONFIDENCE_THRESHOLD = 0.70;
  private static readonly MIN_LIVENESS_SCORE = 0.7;

  /**
   * Verify a face for authentication
   * 
   * Process:
   * 1. Anti-replay check
   * 2. Liveness validation
   * 3. FAISS vector search to find matching user
   * 4. Decrypt and compare embeddings
   * 5. Create verification session
   * 6. Update user login timestamp
   */
  static async verifyFace(input: VerificationInput): Promise<VerificationResult> {
    const warnings: string[] = [];
    const startTime = Date.now();
    const sessionToken = this.generateSessionToken();

    try {
      // Step 1: Anti-replay check
      console.log(`[Verification] Step 1: Anti-replay check`);
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
        await this.logVerificationAttempt(input, null, null, false, `Replay detected: ${replayCheck.reason}`, startTime);
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Security check failed: ${replayCheck.reason}`
        });
      }

      if (replayCheck.riskScore > 0.5) {
        warnings.push(`Medium risk detected (${(replayCheck.riskScore * 100).toFixed(0)}%)`);
      }

      // Step 2: Liveness validation
      console.log(`[Verification] Step 2: Liveness validation (score: ${input.livenessScore})`);
      if (input.livenessScore < this.MIN_LIVENESS_SCORE) {
        await this.logVerificationAttempt(input, null, null, false, `Low liveness score: ${input.livenessScore}`, startTime);
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Liveness check failed. Please try again with better lighting.`
        });
      }

      // Step 3: FAISS vector search
      console.log(`[Verification] Step 3: FAISS vector search`);
      const vectorService = getVectorIndexService();
      const searchResults = await vectorService.searchSimilar(input.embedding, 5);

      if (searchResults.length === 0) {
        await this.logVerificationAttempt(input, null, null, false, 'No matching face found', startTime);
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Face not recognized. Please enroll your face first.'
        });
      }

      // Get best match
      const bestMatch = searchResults[0];
      console.log(`[Verification] Best match: face_profile_id=${bestMatch.face_profile_id}, similarity=${bestMatch.similarity.toFixed(4)}`);

      // Check if similarity meets threshold
      if (bestMatch.similarity < this.MEDIUM_CONFIDENCE_THRESHOLD) {
        await this.logVerificationAttempt(
          input, 
          null, 
          bestMatch.face_profile_id, 
          false, 
          `Low similarity: ${bestMatch.similarity.toFixed(4)}`,
          startTime
        );
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Face verification failed. Similarity too low.'
        });
      }

      // Step 4: Get face profile and user info
      const [faceProfile] = await db
        .select()
        .from(faceProfiles)
        .where(eq(faceProfiles.id, bestMatch.face_profile_id))
        .limit(1);

      if (!faceProfile) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Face profile not found'
        });
      }

      // Check if user matches (if userId provided)
      if (input.userId && faceProfile.userId !== input.userId) {
        await this.logVerificationAttempt(
          input, 
          faceProfile.userId, 
          faceProfile.id, 
          false, 
          'User mismatch',
          startTime
        );
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Face does not match the expected user'
        });
      }

      const userId = faceProfile.userId;

      // Check user account status
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (!user) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'User not found'
        });
      }

      if (user.accountStatus === 'suspended' || user.accountStatus === 'locked') {
        await this.logVerificationAttempt(input, userId, faceProfile.id, false, `Account ${user.accountStatus}`, startTime);
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: `Account ${user.accountStatus}. Please contact support.`
        });
      }

      // Step 5: Determine confidence level and additional auth requirements
      let requiresAdditionalAuth = false;
      let confidence: 'high' | 'medium' | 'low';

      if (bestMatch.similarity >= this.HIGH_CONFIDENCE_THRESHOLD) {
        confidence = 'high';
      } else if (bestMatch.similarity >= this.MEDIUM_CONFIDENCE_THRESHOLD) {
        confidence = 'medium';
        
        // For payment actions with medium confidence, require additional auth
        if (input.action === 'payment') {
          requiresAdditionalAuth = true;
          warnings.push('Additional authentication required for payment (medium confidence)');
        }
      } else {
        confidence = 'low';
        requiresAdditionalAuth = true;
      }

      // Step 6: Create verification session
      await db.insert(faceVerificationSessions).values({
        userId,
        faceProfileId: faceProfile.id,
        sessionToken,
        videoHash: input.videoHash,
        status: 'completed',
        livenessScore: input.livenessScore.toString(),
        livenessMethod: input.livenessMethod,
        similarityScore: bestMatch.similarity.toString(),
        result: 'success',
        ipAddress: input.ipAddress || null,
        userAgent: input.userAgent || null,
        deviceFingerprint: input.deviceFingerprint || null
      });

      // Step 7: Log verification attempt
      await this.logVerificationAttempt(
        input, 
        userId, 
        faceProfile.id, 
        true, 
        null,
        startTime,
        bestMatch.similarity
      );

      // Step 8: Create audit log
      await db.insert(auditLogs).values({
        userId,
        action: `face_${input.action}`,
        actor: 'user',
        resourceType: 'face_verification',
        resourceId: sessionToken,
        ipAddress: input.ipAddress || null,
        userAgent: input.userAgent || null,
        deviceFingerprint: input.deviceFingerprint || null,
        detail: {
          face_profile_id: faceProfile.id,
          similarity_score: bestMatch.similarity,
          confidence,
          liveness_score: input.livenessScore,
          liveness_method: input.livenessMethod,
          challenge_results: input.challengeResults,
          video_hash: input.videoHash,
          processing_time_ms: Date.now() - startTime
        },
        riskScore: replayCheck.riskScore.toString(),
        status: 'success'
      });

      // Step 9: Update user's last login
      await db
        .update(users)
        .set({ 
          lastLoginAt: new Date(),
          lastSignedIn: new Date(),
          failedLoginAttempts: 0  // Reset failed attempts on success
        })
        .where(eq(users.id, userId));

      // Step 10: Update face profile last verified timestamp
      await db
        .update(faceProfiles)
        .set({ lastVerifiedAt: new Date() })
        .where(eq(faceProfiles.id, faceProfile.id));

      console.log(`[Verification] ✅ Success for user ${userId}, similarity=${bestMatch.similarity.toFixed(4)}, confidence=${confidence}`);

      return {
        success: true,
        userId,
        faceProfileId: faceProfile.id,
        similarityScore: bestMatch.similarity,
        confidence,
        sessionToken,
        warnings: warnings.length > 0 ? warnings : undefined,
        requiresAdditionalAuth
      };

    } catch (error) {
      console.error('[Verification] ❌ Error:', error);

      // Increment failed login attempts if user known
      if (input.userId) {
        await db
          .update(users)
          .set({ 
            failedLoginAttempts: db.$count(users.failedLoginAttempts) + 1
          })
          .where(eq(users.id, input.userId));
      }

      if (error instanceof TRPCError) {
        throw error;
      }

      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Face verification failed. Please try again.'
      });
    }
  }

  /**
   * Log verification attempt for monitoring and fraud detection
   */
  private static async logVerificationAttempt(
    input: VerificationInput,
    userId: number | null,
    faceProfileId: number | null,
    success: boolean,
    failureReason: string | null,
    startTime: number,
    similarityScore?: number
  ): Promise<void> {
    try {
      await db.insert(faceMatchAttempts).values({
        userId,
        faceProfileId,
        sessionId: input.videoHash,
        attemptType: input.action,
        similarityScore: similarityScore ? similarityScore.toString() : null,
        thresholdUsed: this.MEDIUM_CONFIDENCE_THRESHOLD.toString(),
        success,
        failureReason,
        livenessPassed: input.livenessScore >= this.MIN_LIVENESS_SCORE,
        livenessConfidence: input.livenessScore.toString(),
        ipAddress: input.ipAddress || null,
        deviceFingerprint: input.deviceFingerprint || null,
        processingTimeMs: Date.now() - startTime
      });
    } catch (error) {
      console.error('[Verification] Failed to log attempt:', error);
    }
  }

  /**
   * Generate a unique session token
   */
  private static generateSessionToken(): string {
    return `fv_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }

  /**
   * Get verification session by token
   */
  static async getSession(sessionToken: string) {
    const [session] = await db
      .select()
      .from(faceVerificationSessions)
      .where(eq(faceVerificationSessions.sessionToken, sessionToken))
      .limit(1);

    return session;
  }

  /**
   * Get recent verification attempts for a user
   */
  static async getRecentAttempts(userId: number, limit: number = 10) {
    return await db
      .select()
      .from(faceMatchAttempts)
      .where(eq(faceMatchAttempts.userId, userId))
      .orderBy(desc(faceMatchAttempts.createdAt))
      .limit(limit);
  }
}
