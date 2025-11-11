/**
 * Face Embedding Storage Service
 * 
 * Handles storage and retrieval of face embeddings with encryption.
 * Integrates with KMS encryption and database storage.
 * 
 * Security:
 * - All embeddings are encrypted before storage
 * - Supports quality scoring
 * - Tracks device fingerprints
 * - Maintains audit trail
 */

import { db } from "../db";
import { faceProfiles, faceIndexMap, auditLogs } from "../../drizzle/schema";
import { encryptFaceEmbedding, decryptFaceEmbedding } from "./kmsEncryption";
import { eq, and } from "drizzle-orm";

const FACE_EMBEDDING_KEY_ID = process.env.KMS_FACE_EMBEDDING_KEY_ID || "alias/ssp-face-embeddings";
const CURRENT_MODEL_VERSION = "facenet-v1.0"; // Update this when model changes

/**
 * Store a new face embedding for a user
 * 
 * @param userId - The user ID
 * @param embedding - The face embedding vector (128 or 512 dimensions)
 * @param options - Additional options (quality, device fingerprint, etc.)
 * @returns The created face profile ID
 */
export async function storeFaceEmbedding(
  userId: number,
  embedding: Float32Array | number[],
  options: {
    enrollmentQuality?: number;
    deviceFingerprint?: string;
    ipAddress?: string;
    userAgent?: string;
  } = {}
): Promise<number> {
  try {
    // Validate embedding dimensions
    const embeddingArray = Array.isArray(embedding) ? embedding : Array.from(embedding);
    if (embeddingArray.length !== 128 && embeddingArray.length !== 512) {
      throw new Error(`Invalid embedding dimension: ${embeddingArray.length}. Expected 128 or 512.`);
    }

    // Encrypt the embedding
    const encryptedEmbedding = await encryptFaceEmbedding(embeddingArray);

    // Store in database
    const [faceProfile] = await db.insert(faceProfiles).values({
      userId,
      faceTemplateEncrypted: encryptedEmbedding,
      templateKmsKeyId: FACE_EMBEDDING_KEY_ID,
      modelVersion: CURRENT_MODEL_VERSION,
      enrollmentQuality: options.enrollmentQuality ? options.enrollmentQuality.toFixed(2) : null,
      deviceFingerprint: options.deviceFingerprint || null,
      status: "active",
    });

    // Log the enrollment
    await db.insert(auditLogs).values({
      userId,
      action: "face.enroll",
      actor: "user",
      entityType: "face_profile",
      entityId: faceProfile.insertId,
      changes: JSON.stringify({
        modelVersion: CURRENT_MODEL_VERSION,
        embeddingDimension: embeddingArray.length,
        quality: options.enrollmentQuality,
      }),
      ipAddress: options.ipAddress || null,
      userAgent: options.userAgent || null,
    });

    return faceProfile.insertId;
  } catch (error) {
    console.error("Failed to store face embedding:", error);
    throw new Error("Failed to store face embedding");
  }
}

/**
 * Retrieve and decrypt a face embedding
 * 
 * @param faceProfileId - The face profile ID
 * @returns The decrypted face embedding
 */
export async function retrieveFaceEmbedding(faceProfileId: number): Promise<Float32Array | null> {
  try {
    const [faceProfile] = await db
      .select()
      .from(faceProfiles)
      .where(and(
        eq(faceProfiles.id, faceProfileId),
        eq(faceProfiles.status, "active")
      ))
      .limit(1);

    if (!faceProfile) {
      return null;
    }

    // Decrypt the embedding
    const embedding = await decryptFaceEmbedding(faceProfile.faceTemplateEncrypted);

    // Update last used timestamp
    await db
      .update(faceProfiles)
      .set({ lastUsedAt: new Date() })
      .where(eq(faceProfiles.id, faceProfileId));

    return embedding;
  } catch (error) {
    console.error("Failed to retrieve face embedding:", error);
    throw new Error("Failed to retrieve face embedding");
  }
}

/**
 * Get all active face embeddings for a user
 * 
 * @param userId - The user ID
 * @returns Array of face profile IDs and their embeddings
 */
export async function getUserFaceEmbeddings(userId: number): Promise<Array<{
  id: number;
  embedding: Float32Array;
  enrollmentQuality: number | null;
  createdAt: Date;
}>> {
  try {
    const profiles = await db
      .select()
      .from(faceProfiles)
      .where(and(
        eq(faceProfiles.userId, userId),
        eq(faceProfiles.status, "active")
      ));

    const results = await Promise.all(
      profiles.map(async (profile) => {
        const embedding = await decryptFaceEmbedding(profile.faceTemplateEncrypted);
        return {
          id: profile.id,
          embedding,
          enrollmentQuality: profile.enrollmentQuality ? parseFloat(profile.enrollmentQuality) : null,
          createdAt: profile.createdAt,
        };
      })
    );

    return results;
  } catch (error) {
    console.error("Failed to get user face embeddings:", error);
    throw new Error("Failed to get user face embeddings");
  }
}

/**
 * Revoke a face profile (soft delete)
 * 
 * @param faceProfileId - The face profile ID
 * @param reason - Reason for revocation
 * @param actor - Who revoked it (user, admin, system)
 */
export async function revokeFaceProfile(
  faceProfileId: number,
  reason: string,
  actor: string = "user"
): Promise<void> {
  try {
    const [faceProfile] = await db
      .select()
      .from(faceProfiles)
      .where(eq(faceProfiles.id, faceProfileId))
      .limit(1);

    if (!faceProfile) {
      throw new Error("Face profile not found");
    }

    // Update status to revoked
    await db
      .update(faceProfiles)
      .set({
        status: "revoked",
        revokedAt: new Date(),
        revokedReason: reason,
      })
      .where(eq(faceProfiles.id, faceProfileId));

    // Log the revocation
    await db.insert(auditLogs).values({
      userId: faceProfile.userId,
      action: "face.revoke",
      actor,
      entityType: "face_profile",
      entityId: faceProfileId,
      changes: JSON.stringify({ reason }),
    });

    console.log(`Face profile ${faceProfileId} revoked by ${actor}: ${reason}`);
  } catch (error) {
    console.error("Failed to revoke face profile:", error);
    throw new Error("Failed to revoke face profile");
  }
}

/**
 * Delete all face profiles for a user (for GDPR compliance)
 * 
 * @param userId - The user ID
 * @param reason - Reason for deletion
 */
export async function deleteUserFaceData(userId: number, reason: string = "user_request"): Promise<void> {
  try {
    // Get all face profiles for the user
    const profiles = await db
      .select()
      .from(faceProfiles)
      .where(eq(faceProfiles.userId, userId));

    // Delete from vector database (if mapped)
    for (const profile of profiles) {
      const [mapping] = await db
        .select()
        .from(faceIndexMap)
        .where(eq(faceIndexMap.faceProfileId, profile.id))
        .limit(1);

      if (mapping) {
        // TODO: Delete from actual vector database (FAISS/Milvus/Pinecone)
        // For now, just delete the mapping
        await db.delete(faceIndexMap).where(eq(faceIndexMap.faceProfileId, profile.id));
      }
    }

    // Delete all face profiles
    await db.delete(faceProfiles).where(eq(faceProfiles.userId, userId));

    // Log the deletion
    await db.insert(auditLogs).values({
      userId,
      action: "face.delete_all",
      actor: "system",
      entityType: "user",
      entityId: userId,
      changes: JSON.stringify({
        reason,
        profilesDeleted: profiles.length,
      }),
    });

    console.log(`Deleted ${profiles.length} face profiles for user ${userId}: ${reason}`);
  } catch (error) {
    console.error("Failed to delete user face data:", error);
    throw new Error("Failed to delete user face data");
  }
}

/**
 * Check if a user has any active face profiles
 * 
 * @param userId - The user ID
 * @returns True if user has active face profiles
 */
export async function userHasFaceProfile(userId: number): Promise<boolean> {
  try {
    const [profile] = await db
      .select({ id: faceProfiles.id })
      .from(faceProfiles)
      .where(and(
        eq(faceProfiles.userId, userId),
        eq(faceProfiles.status, "active")
      ))
      .limit(1);

    return !!profile;
  } catch (error) {
    console.error("Failed to check user face profile:", error);
    return false;
  }
}
