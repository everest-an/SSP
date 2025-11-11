/**
 * Face Authentication API Routes
 * 
 * Provides tRPC endpoints for:
 * - Face enrollment (registration)
 * - Face verification (login/payment)
 * - Liveness challenge generation
 * - Face profile management
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, publicProcedure } from "../trpc";
import { storeFaceEmbedding, getUserFaceEmbeddings, revokeFaceProfile, userHasFaceProfile } from "../services/faceEmbeddingStorage";
import { checkFaceUniqueness, findSimilarFaces } from "../services/faceUniquenessCheck";
import { 
  generateLivenessChallenge, 
  generateMultipleChallenges,
  validateActiveLiveness,
  validatePassiveLiveness,
  validateHybridLiveness,
  getRecommendedLivenessMethod,
  type LivenessMethod,
} from "../services/livenessDetection";
import { db } from "../db";
import { faceVerificationAttempts, userSecuritySettings } from "../../drizzle/schema";
import { eq } from "drizzle-orm";

// Validation schemas
const FaceEmbeddingSchema = z.array(z.number()).length(128).or(z.array(z.number()).length(512));

const LivenessChallengeSchema = z.object({
  type: z.enum(["blink", "turn_head", "smile", "nod"]),
  instruction: z.string(),
  expectedAction: z.string(),
});

const VideoFrameSchema = z.string(); // Base64 encoded frame

export const faceAuthRouter = router({
  /**
   * Generate liveness challenges for face enrollment/verification
   * 
   * Returns random challenges that the user must complete to prove liveness
   */
  generateLivenessChallenges: publicProcedure
    .input(z.object({
      count: z.number().min(1).max(5).default(2),
      method: z.enum(["active_challenge", "passive_detection", "hybrid"]).optional(),
    }))
    .mutation(async ({ input }) => {
      const challenges = generateMultipleChallenges(input.count);
      
      return {
        challenges,
        method: input.method || "active_challenge",
        expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes
      };
    }),

  /**
   * Enroll a new face for the authenticated user
   * 
   * Process:
   * 1. Validate liveness
   * 2. Check face uniqueness (prevent duplicate enrollment)
   * 3. Encrypt and store face embedding
   * 4. Enable face auth in user security settings
   */
  enrollFace: protectedProcedure
    .input(z.object({
      embedding: FaceEmbeddingSchema,
      videoFrames: z.array(VideoFrameSchema).min(10).max(100),
      challenges: z.array(LivenessChallengeSchema),
      enrollmentQuality: z.number().min(0).max(1).optional(),
      deviceFingerprint: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.user.id;

      // Step 1: Validate liveness
      const livenessResult = await validateActiveLiveness(input.videoFrames, input.challenges);
      
      if (!livenessResult.passed) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Liveness check failed: ${livenessResult.failureReason}`,
        });
      }

      // Step 2: Check face uniqueness
      const uniquenessResult = await checkFaceUniqueness(
        input.embedding,
        userId, // Exclude current user (allow re-enrollment)
        {
          ipAddress: ctx.req.ip,
          userAgent: ctx.req.headers["user-agent"],
        }
      );

      if (uniquenessResult.decision === "block") {
        throw new TRPCError({
          code: "CONFLICT",
          message: uniquenessResult.message,
        });
      }

      if (uniquenessResult.decision === "review") {
        // Log for manual review but allow enrollment
        console.warn(`Face enrollment requires review for user ${userId}:`, uniquenessResult.message);
      }

      // Step 3: Store encrypted face embedding
      const faceProfileId = await storeFaceEmbedding(
        userId,
        input.embedding,
        {
          enrollmentQuality: input.enrollmentQuality,
          deviceFingerprint: input.deviceFingerprint,
          ipAddress: ctx.req.ip,
          userAgent: ctx.req.headers["user-agent"],
        }
      );

      // Step 4: Enable face auth in user security settings
      const [existingSettings] = await db
        .select()
        .from(userSecuritySettings)
        .where(eq(userSecuritySettings.userId, userId))
        .limit(1);

      if (existingSettings) {
        await db
          .update(userSecuritySettings)
          .set({ faceAuthEnabled: true })
          .where(eq(userSecuritySettings.userId, userId));
      } else {
        await db.insert(userSecuritySettings).values({
          userId,
          faceAuthEnabled: true,
        });
      }

      // Step 5: Log the verification attempt
      await db.insert(faceVerificationAttempts).values({
        userId,
        faceProfileId,
        action: "enrollment",
        result: "success",
        confidenceScore: input.enrollmentQuality?.toFixed(4) || null,
        livenessScore: livenessResult.score.toFixed(4),
        livenessMethod: "active_challenge",
        ipAddress: ctx.req.ip || null,
        userAgent: ctx.req.headers["user-agent"] || null,
        deviceFingerprint: input.deviceFingerprint || null,
      });

      return {
        success: true,
        faceProfileId,
        livenessScore: livenessResult.score,
        uniquenessCheck: {
          decision: uniquenessResult.decision,
          message: uniquenessResult.message,
        },
      };
    }),

  /**
   * Verify a face for authentication (login/payment)
   * 
   * Process:
   * 1. Validate liveness
   * 2. Compare against user's enrolled faces
   * 3. Return verification result with confidence score
   */
  verifyFace: protectedProcedure
    .input(z.object({
      embedding: FaceEmbeddingSchema,
      videoFrames: z.array(VideoFrameSchema).min(5).max(100),
      challenges: z.array(LivenessChallengeSchema),
      action: z.enum(["login", "payment", "verification"]),
      deviceFingerprint: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.user.id;

      // Step 1: Validate liveness
      const livenessResult = await validateActiveLiveness(input.videoFrames, input.challenges);
      
      if (!livenessResult.passed) {
        await db.insert(faceVerificationAttempts).values({
          userId,
          action: input.action,
          result: "rejected",
          livenessScore: livenessResult.score.toFixed(4),
          livenessMethod: "active_challenge",
          failureReason: "liveness_failed",
          ipAddress: ctx.req.ip || null,
          userAgent: ctx.req.headers["user-agent"] || null,
          deviceFingerprint: input.deviceFingerprint || null,
        });

        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: `Liveness check failed: ${livenessResult.failureReason}`,
        });
      }

      // Step 2: Get user's enrolled faces
      const userFaces = await getUserFaceEmbeddings(userId);

      if (userFaces.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "No face enrolled for this user",
        });
      }

      // Step 3: Find best match among user's faces
      const similarities = await findSimilarFaces(input.embedding, userFaces.length);
      const userMatches = similarities.filter(s => s.userId === userId);

      if (userMatches.length === 0) {
        await db.insert(faceVerificationAttempts).values({
          userId,
          action: input.action,
          result: "failed",
          confidenceScore: "0.0000",
          livenessScore: livenessResult.score.toFixed(4),
          livenessMethod: "active_challenge",
          failureReason: "no_match",
          ipAddress: ctx.req.ip || null,
          userAgent: ctx.req.headers["user-agent"] || null,
          deviceFingerprint: input.deviceFingerprint || null,
        });

        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Face verification failed: No match found",
        });
      }

      const bestMatch = userMatches[0];
      const VERIFICATION_THRESHOLD = 0.75; // Configurable threshold

      const verified = bestMatch.similarity >= VERIFICATION_THRESHOLD;

      // Step 4: Log the verification attempt
      await db.insert(faceVerificationAttempts).values({
        userId,
        faceProfileId: bestMatch.faceProfileId,
        action: input.action,
        result: verified ? "success" : "failed",
        confidenceScore: bestMatch.similarity.toFixed(4),
        livenessScore: livenessResult.score.toFixed(4),
        livenessMethod: "active_challenge",
        failureReason: verified ? null : "low_confidence",
        ipAddress: ctx.req.ip || null,
        userAgent: ctx.req.headers["user-agent"] || null,
        deviceFingerprint: input.deviceFingerprint || null,
      });

      if (!verified) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: `Face verification failed: Confidence too low (${(bestMatch.similarity * 100).toFixed(1)}%)`,
        });
      }

      return {
        verified: true,
        confidence: bestMatch.similarity,
        livenessScore: livenessResult.score,
        faceProfileId: bestMatch.faceProfileId,
      };
    }),

  /**
   * Get user's face enrollment status
   */
  getFaceEnrollmentStatus: protectedProcedure
    .query(async ({ ctx }) => {
      const userId = ctx.user.id;

      const hasProfile = await userHasFaceProfile(userId);

      const [settings] = await db
        .select()
        .from(userSecuritySettings)
        .where(eq(userSecuritySettings.userId, userId))
        .limit(1);

      return {
        enrolled: hasProfile,
        enabled: settings?.faceAuthEnabled || false,
        profileCount: hasProfile ? (await getUserFaceEmbeddings(userId)).length : 0,
      };
    }),

  /**
   * List user's face profiles
   */
  listFaceProfiles: protectedProcedure
    .query(async ({ ctx }) => {
      const userId = ctx.user.id;

      const profiles = await getUserFaceEmbeddings(userId);

      return profiles.map(p => ({
        id: p.id,
        enrollmentQuality: p.enrollmentQuality,
        createdAt: p.createdAt,
        // Don't return the actual embedding for security
      }));
    }),

  /**
   * Revoke a face profile
   */
  revokeFaceProfile: protectedProcedure
    .input(z.object({
      faceProfileId: z.number(),
      reason: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.user.id;

      // Verify the face profile belongs to the user
      const profiles = await getUserFaceEmbeddings(userId);
      const profile = profiles.find(p => p.id === input.faceProfileId);

      if (!profile) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Face profile not found",
        });
      }

      await revokeFaceProfile(
        input.faceProfileId,
        input.reason || "user_request",
        "user"
      );

      // If no more active profiles, disable face auth
      const remainingProfiles = await getUserFaceEmbeddings(userId);
      if (remainingProfiles.length === 0) {
        await db
          .update(userSecuritySettings)
          .set({ faceAuthEnabled: false })
          .where(eq(userSecuritySettings.userId, userId));
      }

      return {
        success: true,
        message: "Face profile revoked successfully",
      };
    }),

  /**
   * Get face verification history
   */
  getVerificationHistory: protectedProcedure
    .input(z.object({
      limit: z.number().min(1).max(100).default(20),
      offset: z.number().min(0).default(0),
    }))
    .query(async ({ input, ctx }) => {
      const userId = ctx.user.id;

      const attempts = await db
        .select()
        .from(faceVerificationAttempts)
        .where(eq(faceVerificationAttempts.userId, userId))
        .orderBy(faceVerificationAttempts.createdAt)
        .limit(input.limit)
        .offset(input.offset);

      return attempts.map(a => ({
        id: a.id,
        action: a.action,
        result: a.result,
        confidenceScore: a.confidenceScore ? parseFloat(a.confidenceScore) : null,
        livenessScore: a.livenessScore ? parseFloat(a.livenessScore) : null,
        failureReason: a.failureReason,
        createdAt: a.createdAt,
        // Omit sensitive fields like IP address, user agent
      }));
    }),
});
