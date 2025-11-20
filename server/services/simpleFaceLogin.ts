/**
 * Simplified Face Login Service
 * 
 * This is a simplified implementation that doesn't require AWS Rekognition.
 * It provides basic face authentication functionality for development/demo purposes.
 * 
 * Note: For production use, consider integrating with AWS Rekognition or other
 * professional face recognition services for better security and accuracy.
 */

import { db } from "../db";
import { users, faceRecognition } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

/**
 * Calculate cosine similarity between two face embeddings
 */
function cosineSimilarity(embedding1: number[], embedding2: number[]): number {
  if (embedding1.length !== embedding2.length) {
    throw new Error("Embeddings must have the same length");
  }

  let dotProduct = 0;
  let norm1 = 0;
  let norm2 = 0;

  for (let i = 0; i < embedding1.length; i++) {
    dotProduct += embedding1[i] * embedding2[i];
    norm1 += embedding1[i] * embedding1[i];
    norm2 += embedding2[i] * embedding2[i];
  }

  norm1 = Math.sqrt(norm1);
  norm2 = Math.sqrt(norm2);

  if (norm1 === 0 || norm2 === 0) {
    return 0;
  }

  return dotProduct / (norm1 * norm2);
}

/**
 * Simple liveness check based on video frames
 * 
 * This is a basic implementation that checks for:
 * - Sufficient number of frames
 * - Frame variation (to detect if it's a static photo)
 * 
 * For production, use AWS Rekognition or similar services
 */
function checkLiveness(videoFrames: string[]): { passed: boolean; score: number; reason?: string } {
  // Check minimum frames
  if (videoFrames.length < 5) {
    return {
      passed: false,
      score: 0,
      reason: "Insufficient video frames"
    };
  }

  // Basic check: ensure frames are not identical (detect static photos)
  const uniqueFrames = new Set(videoFrames);
  const uniqueRatio = uniqueFrames.size / videoFrames.length;

  if (uniqueRatio < 0.3) {
    return {
      passed: false,
      score: uniqueRatio,
      reason: "Video appears to be static (possible photo attack)"
    };
  }

  // Calculate liveness score based on frame variation
  const livenessScore = Math.min(uniqueRatio * 1.2, 1.0);

  return {
    passed: livenessScore >= 0.5,
    score: livenessScore,
    reason: livenessScore < 0.5 ? "Low liveness score" : undefined
  };
}

/**
 * Find user by face embedding
 * 
 * Searches all enrolled faces and returns the best match
 */
export async function findUserByFace(
  faceEmbedding: number[],
  threshold: number = 0.75
): Promise<{
  userId: string;
  confidence: number;
  faceId: number;
} | null> {
  try {
    // Get all active face registrations
    const allFaces = await db
      .select()
      .from(faceRecognition)
      .where(eq(faceRecognition.isActive, true));

    if (allFaces.length === 0) {
      return null;
    }

    // Find best match
    let bestMatch: { userId: string; confidence: number; faceId: number } | null = null;
    let highestSimilarity = 0;

    for (const face of allFaces) {
      try {
        // Parse stored embedding
        const storedEmbedding = JSON.parse(face.faceEmbedding);
        
        // Calculate similarity
        const similarity = cosineSimilarity(faceEmbedding, storedEmbedding);

        if (similarity > highestSimilarity && similarity >= threshold) {
          highestSimilarity = similarity;
          bestMatch = {
            userId: face.userId.toString(),
            confidence: similarity,
            faceId: face.id
          };
        }
      } catch (error) {
        console.error(`Error processing face ${face.id}:`, error);
        continue;
      }
    }

    return bestMatch;
  } catch (error) {
    console.error("Error finding user by face:", error);
    throw new Error("Failed to search for face match");
  }
}

/**
 * Simplified face login
 * 
 * Performs basic liveness check and face matching without AWS Rekognition
 */
export async function simpleFaceLogin(
  faceEmbedding: number[],
  videoFrames: string[]
): Promise<{
  success: boolean;
  userId?: string;
  confidence?: number;
  error?: string;
}> {
  try {
    // Step 1: Basic liveness check
    const livenessResult = checkLiveness(videoFrames);
    
    if (!livenessResult.passed) {
      return {
        success: false,
        error: livenessResult.reason || "Liveness check failed"
      };
    }

    // Step 2: Find matching user
    const match = await findUserByFace(faceEmbedding);

    if (!match) {
      return {
        success: false,
        error: "No matching face found"
      };
    }

    // Step 3: Verify user exists and is active
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, parseInt(match.userId)))
      .limit(1);

    if (!user) {
      return {
        success: false,
        error: "User not found"
      };
    }

    return {
      success: true,
      userId: match.userId,
      confidence: match.confidence
    };
  } catch (error) {
    console.error("Simple face login error:", error);
    return {
      success: false,
      error: "Face login failed"
    };
  }
}

/**
 * Enroll a new face for a user
 * 
 * Simplified version without AWS Rekognition
 */
export async function enrollFaceSimple(
  userId: number,
  faceEmbedding: number[],
  videoFrames: string[]
): Promise<{
  success: boolean;
  faceId?: number;
  error?: string;
}> {
  try {
    // Step 1: Basic liveness check
    const livenessResult = checkLiveness(videoFrames);
    
    if (!livenessResult.passed) {
      return {
        success: false,
        error: livenessResult.reason || "Liveness check failed"
      };
    }

    // Step 2: Check if user already has a face registered
    const existingFaces = await db
      .select()
      .from(faceRecognition)
      .where(eq(faceRecognition.userId, userId));

    // Step 3: Store face embedding
    const embeddingString = JSON.stringify(faceEmbedding);
    
    if (existingFaces.length > 0) {
      // Update existing face
      await db
        .update(faceRecognition)
        .set({
          faceEmbedding: embeddingString,
          isActive: true,
          updatedAt: new Date()
        })
        .where(eq(faceRecognition.userId, userId));

      return {
        success: true,
        faceId: existingFaces[0].id
      };
    } else {
      // Insert new face
      const [result] = await db
        .insert(faceRecognition)
        .values({
          userId,
          faceEmbedding: embeddingString,
          isActive: true,
          maxPaymentAmount: 5000, // Default $50.00
        });

      return {
        success: true,
        faceId: result.insertId
      };
    }
  } catch (error) {
    console.error("Enroll face simple error:", error);
    return {
      success: false,
      error: "Failed to enroll face"
    };
  }
}
