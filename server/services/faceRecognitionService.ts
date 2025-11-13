/**
 * Backend Face Recognition Service
 * 
 * Handles:
 * - Storing face embeddings in database
 * - Verifying faces against stored profiles
 * - User identification from face data
 * - Similarity scoring and matching
 */

import { db } from '../_core/db';
import { faceEmbeddings, users } from '../_core/schema';
import { eq, and } from 'drizzle-orm';

/**
 * Face embedding stored in database
 */
export interface StoredFaceEmbedding {
  id: number;
  userId: number;
  embedding: number[]; // JSON array stored as string
  confidence: number;
  capturedAt: Date;
  metadata?: {
    age?: number;
    gender?: string;
    expressions?: Record<string, number>;
  };
}

/**
 * User face profile with multiple embeddings
 */
export interface UserFaceProfile {
  userId: number;
  userName: string;
  embeddings: number[][];
  averageEmbedding: number[];
  sampleCount: number;
  lastUpdated: Date;
}

/**
 * Face verification result
 */
export interface FaceVerificationResult {
  verified: boolean;
  userId?: number;
  userName?: string;
  confidence: number;
  distance: number;
  threshold: number;
}

/**
 * Calculate Euclidean distance between two embeddings
 */
function calculateEmbeddingDistance(
  embedding1: number[],
  embedding2: number[]
): number {
  let sumSquaredDiff = 0;
  
  for (let i = 0; i < embedding1.length; i++) {
    const diff = embedding1[i] - embedding2[i];
    sumSquaredDiff += diff * diff;
  }
  
  return Math.sqrt(sumSquaredDiff);
}

/**
 * Calculate similarity score (0-1)
 */
function calculateSimilarityScore(distance: number): number {
  return Math.max(0, 1 - distance / 1.5);
}

/**
 * Generate average embedding from multiple samples
 */
function generateAverageEmbedding(embeddings: number[][]): number[] {
  if (embeddings.length === 0) {
    throw new Error('No embeddings provided');
  }
  
  const embeddingLength = embeddings[0].length;
  const averageEmbedding = new Array(embeddingLength).fill(0);
  
  // Sum all embeddings
  for (let i = 0; i < embeddingLength; i++) {
    for (let j = 0; j < embeddings.length; j++) {
      averageEmbedding[i] += embeddings[j][i];
    }
    averageEmbedding[i] /= embeddings.length;
  }
  
  // Normalize
  let magnitude = 0;
  for (let i = 0; i < embeddingLength; i++) {
    magnitude += averageEmbedding[i] * averageEmbedding[i];
  }
  magnitude = Math.sqrt(magnitude);
  
  for (let i = 0; i < embeddingLength; i++) {
    averageEmbedding[i] /= magnitude;
  }
  
  return averageEmbedding;
}

/**
 * Store face embedding for user
 */
export async function storeFaceEmbedding(
  userId: number,
  embedding: number[],
  confidence: number,
  metadata?: Record<string, any>
): Promise<StoredFaceEmbedding> {
  try {
    // Check if faceEmbeddings table exists, if not create it
    // This is handled by migrations
    
    const result = await db.insert(faceEmbeddings).values({
      userId,
      embedding: JSON.stringify(embedding),
      confidence,
      metadata: metadata ? JSON.stringify(metadata) : null,
      capturedAt: new Date(),
    }).returning();
    
    const stored = result[0];
    
    return {
      id: stored.id,
      userId: stored.userId,
      embedding: JSON.parse(stored.embedding as string),
      confidence: stored.confidence,
      capturedAt: stored.capturedAt,
      metadata: stored.metadata ? JSON.parse(stored.metadata as string) : undefined,
    };
  } catch (error) {
    console.error('[FaceRecognition] Failed to store embedding:', error);
    throw error;
  }
}

/**
 * Get user face profile (all embeddings)
 */
export async function getUserFaceProfile(
  userId: number
): Promise<UserFaceProfile | null> {
  try {
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });
    
    if (!user) {
      return null;
    }
    
    const embeddings = await db.query.faceEmbeddings.findMany({
      where: eq(faceEmbeddings.userId, userId),
    });
    
    if (embeddings.length === 0) {
      return null;
    }
    
    const parsedEmbeddings = embeddings.map(e => 
      JSON.parse(e.embedding as string) as number[]
    );
    
    const averageEmbedding = generateAverageEmbedding(parsedEmbeddings);
    
    return {
      userId,
      userName: user.name || 'Unknown',
      embeddings: parsedEmbeddings,
      averageEmbedding,
      sampleCount: embeddings.length,
      lastUpdated: embeddings[embeddings.length - 1].capturedAt,
    };
  } catch (error) {
    console.error('[FaceRecognition] Failed to get user profile:', error);
    throw error;
  }
}

/**
 * Verify face against user profile
 */
export async function verifyFaceAgainstUser(
  faceEmbedding: number[],
  userId: number,
  threshold: number = 0.6
): Promise<FaceVerificationResult> {
  try {
    const profile = await getUserFaceProfile(userId);
    
    if (!profile) {
      return {
        verified: false,
        confidence: 0,
        distance: Infinity,
        threshold,
      };
    }
    
    const distance = calculateEmbeddingDistance(faceEmbedding, profile.averageEmbedding);
    const similarity = calculateSimilarityScore(distance);
    const verified = similarity >= threshold;
    
    return {
      verified,
      userId,
      userName: profile.userName,
      confidence: similarity,
      distance,
      threshold,
    };
  } catch (error) {
    console.error('[FaceRecognition] Face verification failed:', error);
    throw error;
  }
}

/**
 * Find user by face embedding
 * Searches all users to find best match
 */
export async function findUserByFaceEmbedding(
  faceEmbedding: number[],
  threshold: number = 0.6
): Promise<FaceVerificationResult | null> {
  try {
    // Get all users with face embeddings
    const allUsers = await db.query.users.findMany();
    
    let bestMatch: FaceVerificationResult | null = null;
    let bestConfidence = 0;
    
    for (const user of allUsers) {
      const profile = await getUserFaceProfile(user.id);
      
      if (!profile) {
        continue;
      }
      
      const distance = calculateEmbeddingDistance(faceEmbedding, profile.averageEmbedding);
      const similarity = calculateSimilarityScore(distance);
      
      if (similarity >= threshold && similarity > bestConfidence) {
        bestMatch = {
          verified: true,
          userId: user.id,
          userName: user.name || 'Unknown',
          confidence: similarity,
          distance,
          threshold,
        };
        bestConfidence = similarity;
      }
    }
    
    return bestMatch;
  } catch (error) {
    console.error('[FaceRecognition] User search failed:', error);
    throw error;
  }
}

/**
 * Get face statistics for user
 */
export async function getFaceStatistics(userId: number): Promise<{
  totalSamples: number;
  averageConfidence: number;
  firstCaptured: Date | null;
  lastCaptured: Date | null;
}> {
  try {
    const embeddings = await db.query.faceEmbeddings.findMany({
      where: eq(faceEmbeddings.userId, userId),
    });
    
    if (embeddings.length === 0) {
      return {
        totalSamples: 0,
        averageConfidence: 0,
        firstCaptured: null,
        lastCaptured: null,
      };
    }
    
    const avgConfidence = embeddings.reduce((sum, e) => sum + e.confidence, 0) / embeddings.length;
    const dates = embeddings.map(e => e.capturedAt).sort();
    
    return {
      totalSamples: embeddings.length,
      averageConfidence: avgConfidence,
      firstCaptured: dates[0],
      lastCaptured: dates[dates.length - 1],
    };
  } catch (error) {
    console.error('[FaceRecognition] Failed to get statistics:', error);
    throw error;
  }
}

/**
 * Delete face embeddings for user
 * Used when user wants to remove face data
 */
export async function deleteFaceEmbeddings(userId: number): Promise<number> {
  try {
    const result = await db.delete(faceEmbeddings)
      .where(eq(faceEmbeddings.userId, userId));
    
    return result.rowsAffected || 0;
  } catch (error) {
    console.error('[FaceRecognition] Failed to delete embeddings:', error);
    throw error;
  }
}

/**
 * Clean up old embeddings (keep only recent ones)
 * Useful for storage optimization
 */
export async function cleanupOldEmbeddings(
  userId: number,
  keepCount: number = 10
): Promise<number> {
  try {
    const embeddings = await db.query.faceEmbeddings.findMany({
      where: eq(faceEmbeddings.userId, userId),
    });
    
    if (embeddings.length <= keepCount) {
      return 0;
    }
    
    // Sort by date and keep only recent ones
    const sorted = embeddings.sort((a, b) => 
      b.capturedAt.getTime() - a.capturedAt.getTime()
    );
    
    const toDelete = sorted.slice(keepCount);
    const deleteIds = toDelete.map(e => e.id);
    
    // Delete old embeddings
    let deletedCount = 0;
    for (const id of deleteIds) {
      await db.delete(faceEmbeddings).where(eq(faceEmbeddings.id, id));
      deletedCount++;
    }
    
    return deletedCount;
  } catch (error) {
    console.error('[FaceRecognition] Failed to cleanup embeddings:', error);
    throw error;
  }
}

/**
 * Validate embedding format
 */
export function validateEmbedding(embedding: any): boolean {
  if (!Array.isArray(embedding)) {
    return false;
  }
  
  // Standard face embeddings are 128 or 512 dimensions
  if (embedding.length !== 128 && embedding.length !== 512) {
    return false;
  }
  
  // All values should be numbers
  return embedding.every(val => typeof val === 'number' && !isNaN(val));
}
