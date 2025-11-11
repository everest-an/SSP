/**
 * Face Uniqueness Check Service
 * 
 * Prevents duplicate face enrollments by comparing new embeddings against all existing ones.
 * Uses cosine similarity for vector comparison.
 * 
 * In production, this should be replaced with a proper vector database (FAISS/Milvus/Pinecone)
 * for efficient ANN (Approximate Nearest Neighbor) search.
 * 
 * Current implementation: Brute-force comparison (suitable for < 10,000 users)
 * Future: Integrate with vector database for scalability
 */

import { db } from "../db";
import { faceProfiles, faceVerificationAttempts } from "../../drizzle/schema";
import { decryptFaceEmbedding } from "./kmsEncryption";
import { eq } from "drizzle-orm";

// Thresholds for similarity matching (based on DEVDOC-FR recommendations)
// Note: These should be calibrated with offline testing using your specific model
const SIMILARITY_THRESHOLDS = {
  HIGH_CONFIDENCE: 0.85,  // Definitely the same person - block enrollment
  MEDIUM_CONFIDENCE: 0.70, // Possibly the same person - require manual review
  LOW_CONFIDENCE: 0.50,    // Different person - allow enrollment
};

/**
 * Calculate cosine similarity between two vectors
 * 
 * Formula: similarity = (A · B) / (||A|| * ||B||)
 * Range: [-1, 1], where 1 means identical, 0 means orthogonal, -1 means opposite
 * 
 * @param vec1 - First embedding vector
 * @param vec2 - Second embedding vector
 * @returns Cosine similarity score
 */
function cosineSimilarity(vec1: Float32Array, vec2: Float32Array): number {
  if (vec1.length !== vec2.length) {
    throw new Error("Vectors must have the same dimension");
  }

  let dotProduct = 0;
  let norm1 = 0;
  let norm2 = 0;

  for (let i = 0; i < vec1.length; i++) {
    dotProduct += vec1[i] * vec2[i];
    norm1 += vec1[i] * vec1[i];
    norm2 += vec2[i] * vec2[i];
  }

  norm1 = Math.sqrt(norm1);
  norm2 = Math.sqrt(norm2);

  if (norm1 === 0 || norm2 === 0) {
    return 0;
  }

  return dotProduct / (norm1 * norm2);
}

/**
 * Calculate Euclidean (L2) distance between two vectors
 * 
 * Formula: distance = sqrt(sum((A[i] - B[i])^2))
 * Range: [0, ∞], where 0 means identical
 * 
 * @param vec1 - First embedding vector
 * @param vec2 - Second embedding vector
 * @returns L2 distance
 */
function euclideanDistance(vec1: Float32Array, vec2: Float32Array): number {
  if (vec1.length !== vec2.length) {
    throw new Error("Vectors must have the same dimension");
  }

  let sum = 0;
  for (let i = 0; i < vec1.length; i++) {
    const diff = vec1[i] - vec2[i];
    sum += diff * diff;
  }

  return Math.sqrt(sum);
}

export interface UniquenessCheckResult {
  isUnique: boolean;
  decision: "allow" | "block" | "review";
  matchedProfiles: Array<{
    faceProfileId: number;
    userId: number;
    similarity: number;
    distance: number;
  }>;
  topMatch: {
    faceProfileId: number;
    userId: number;
    similarity: number;
    distance: number;
  } | null;
  message: string;
}

/**
 * Check if a face embedding is unique (not already enrolled)
 * 
 * Process:
 * 1. Retrieve all active face embeddings from database
 * 2. Decrypt each embedding
 * 3. Calculate similarity with the new embedding
 * 4. Find top-K most similar embeddings
 * 5. Apply threshold-based decision logic
 * 
 * @param newEmbedding - The new face embedding to check
 * @param excludeUserId - Optional user ID to exclude from check (for re-enrollment)
 * @param options - Additional options (IP, user agent for logging)
 * @returns Uniqueness check result with decision and matched profiles
 */
export async function checkFaceUniqueness(
  newEmbedding: Float32Array | number[],
  excludeUserId?: number,
  options: {
    ipAddress?: string;
    userAgent?: string;
  } = {}
): Promise<UniquenessCheckResult> {
  try {
    const embeddingArray = Array.isArray(newEmbedding) ? new Float32Array(newEmbedding) : newEmbedding;

    // Retrieve all active face profiles
    const allProfiles = await db
      .select()
      .from(faceProfiles)
      .where(eq(faceProfiles.status, "active"));

    if (allProfiles.length === 0) {
      return {
        isUnique: true,
        decision: "allow",
        matchedProfiles: [],
        topMatch: null,
        message: "No existing face profiles to compare against",
      };
    }

    // Calculate similarity with all existing embeddings
    const similarities: Array<{
      faceProfileId: number;
      userId: number;
      similarity: number;
      distance: number;
    }> = [];

    for (const profile of allProfiles) {
      // Skip if this is the user's own profile (for re-enrollment scenarios)
      if (excludeUserId && profile.userId === excludeUserId) {
        continue;
      }

      try {
        const existingEmbedding = await decryptFaceEmbedding(profile.faceTemplateEncrypted);
        const similarity = cosineSimilarity(embeddingArray, existingEmbedding);
        const distance = euclideanDistance(embeddingArray, existingEmbedding);

        similarities.push({
          faceProfileId: profile.id,
          userId: profile.userId,
          similarity,
          distance,
        });
      } catch (error) {
        console.error(`Failed to decrypt face profile ${profile.id}:`, error);
        // Continue with other profiles
      }
    }

    if (similarities.length === 0) {
      return {
        isUnique: true,
        decision: "allow",
        matchedProfiles: [],
        topMatch: null,
        message: "No valid face profiles to compare against",
      };
    }

    // Sort by similarity (descending)
    similarities.sort((a, b) => b.similarity - a.similarity);

    // Get top match
    const topMatch = similarities[0];

    // Get all matches above low confidence threshold
    const matchedProfiles = similarities.filter(
      (s) => s.similarity >= SIMILARITY_THRESHOLDS.LOW_CONFIDENCE
    );

    // Decision logic based on top match similarity
    let decision: "allow" | "block" | "review";
    let isUnique: boolean;
    let message: string;

    if (topMatch.similarity >= SIMILARITY_THRESHOLDS.HIGH_CONFIDENCE) {
      decision = "block";
      isUnique = false;
      message = `Face already enrolled for user ${topMatch.userId} (confidence: ${(topMatch.similarity * 100).toFixed(1)}%)`;
    } else if (topMatch.similarity >= SIMILARITY_THRESHOLDS.MEDIUM_CONFIDENCE) {
      decision = "review";
      isUnique = false;
      message = `Possible duplicate face detected for user ${topMatch.userId} (confidence: ${(topMatch.similarity * 100).toFixed(1)}%). Manual review required.`;
    } else {
      decision = "allow";
      isUnique = true;
      message = "Face is unique, enrollment allowed";
    }

    // Log the uniqueness check attempt
    await db.insert(faceVerificationAttempts).values({
      userId: topMatch.userId,
      faceProfileId: topMatch.faceProfileId,
      action: "uniqueness_check",
      result: decision === "block" ? "rejected" : decision === "review" ? "failed" : "success",
      confidenceScore: topMatch.similarity.toFixed(4),
      failureReason: decision !== "allow" ? "duplicate_detected" : null,
      ipAddress: options.ipAddress || null,
      userAgent: options.userAgent || null,
    });

    return {
      isUnique,
      decision,
      matchedProfiles,
      topMatch,
      message,
    };
  } catch (error) {
    console.error("Face uniqueness check error:", error);
    throw new Error("Failed to check face uniqueness");
  }
}

/**
 * Find similar faces for a given embedding (for debugging/admin purposes)
 * 
 * @param embedding - The face embedding to search for
 * @param topK - Number of top matches to return
 * @returns Top K similar faces with their similarity scores
 */
export async function findSimilarFaces(
  embedding: Float32Array | number[],
  topK: number = 5
): Promise<Array<{
  faceProfileId: number;
  userId: number;
  similarity: number;
  distance: number;
  enrollmentQuality: number | null;
  createdAt: Date;
}>> {
  try {
    const embeddingArray = Array.isArray(embedding) ? new Float32Array(embedding) : embedding;

    const allProfiles = await db
      .select()
      .from(faceProfiles)
      .where(eq(faceProfiles.status, "active"));

    const similarities = [];

    for (const profile of allProfiles) {
      try {
        const existingEmbedding = await decryptFaceEmbedding(profile.faceTemplateEncrypted);
        const similarity = cosineSimilarity(embeddingArray, existingEmbedding);
        const distance = euclideanDistance(embeddingArray, existingEmbedding);

        similarities.push({
          faceProfileId: profile.id,
          userId: profile.userId,
          similarity,
          distance,
          enrollmentQuality: profile.enrollmentQuality ? parseFloat(profile.enrollmentQuality) : null,
          createdAt: profile.createdAt,
        });
      } catch (error) {
        console.error(`Failed to process face profile ${profile.id}:`, error);
      }
    }

    // Sort by similarity (descending) and return top K
    return similarities
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, topK);
  } catch (error) {
    console.error("Find similar faces error:", error);
    throw new Error("Failed to find similar faces");
  }
}

/**
 * Update similarity thresholds (for calibration)
 * 
 * Note: In production, these should be stored in a configuration table
 * and updated through an admin interface after offline ROC testing
 * 
 * @param thresholds - New threshold values
 */
export function updateSimilarityThresholds(thresholds: {
  highConfidence?: number;
  mediumConfidence?: number;
  lowConfidence?: number;
}): void {
  if (thresholds.highConfidence !== undefined) {
    SIMILARITY_THRESHOLDS.HIGH_CONFIDENCE = thresholds.highConfidence;
  }
  if (thresholds.mediumConfidence !== undefined) {
    SIMILARITY_THRESHOLDS.MEDIUM_CONFIDENCE = thresholds.mediumConfidence;
  }
  if (thresholds.lowConfidence !== undefined) {
    SIMILARITY_THRESHOLDS.LOW_CONFIDENCE = thresholds.lowConfidence;
  }

  console.log("Updated similarity thresholds:", SIMILARITY_THRESHOLDS);
}

/**
 * Get current similarity thresholds
 */
export function getSimilarityThresholds() {
  return { ...SIMILARITY_THRESHOLDS };
}
