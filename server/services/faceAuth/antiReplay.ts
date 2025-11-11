/**
 * Anti-Replay Detection Service
 * Prevents replay attacks using video/image hashes and metadata analysis
 * 
 * Sprint 3 Phase 4: Anti-Fraud Mechanisms
 */

import crypto from 'crypto';
import { db } from '../../db';
import { faceVerificationSessions } from '../../../drizzle/schema';
import { eq, and, gt, sql } from 'drizzle-orm';

export interface ReplayCheckResult {
  isReplay: boolean;
  reason?: string;
  riskScore: number;  // 0-1, higher = more suspicious
}

export interface VideoMetadata {
  hash: string;
  createdAt?: Date;
  modifiedAt?: Date;
  fileSize?: number;
  duration?: number;
  frameCount?: number;
}

/**
 * Anti-Replay Service
 * Detects and prevents replay attacks on facial authentication
 */
export class AntiReplayService {
  private static readonly HASH_ALGORITHM = 'sha256';
  private static readonly RECENT_WINDOW_HOURS = 1;
  private static readonly MAX_REUSE_COUNT = 3;

  /**
   * Calculate SHA-256 hash of video/image data
   */
  static calculateHash(data: Buffer | Blob): string {
    if (data instanceof Blob) {
      // For Blob, we need to convert to Buffer first (in Node.js environment)
      throw new Error('Blob hashing not supported in Node.js. Convert to Buffer first.');
    }
    
    const hash = crypto.createHash(this.HASH_ALGORITHM);
    hash.update(data);
    return hash.digest('hex');
  }

  /**
   * Check if a video/image is a replay attack
   */
  static async checkReplay(
    videoHash: string,
    userId?: number,
    metadata?: VideoMetadata
  ): Promise<ReplayCheckResult> {
    let riskScore = 0;
    const reasons: string[] = [];

    // 1. Check if hash was recently used
    const recentUseCheck = await this.checkRecentHashUse(videoHash, userId);
    if (recentUseCheck.isReplay) {
      riskScore += 0.8;
      reasons.push(recentUseCheck.reason!);
    }

    // 2. Check metadata anomalies
    if (metadata) {
      const metadataCheck = this.checkMetadataAnomalies(metadata);
      riskScore += metadataCheck.riskScore;
      if (metadataCheck.reason) {
        reasons.push(metadataCheck.reason);
      }
    }

    // 3. Check hash collision patterns
    const collisionCheck = await this.checkHashCollisions(videoHash);
    if (collisionCheck.isReplay) {
      riskScore += 0.5;
      reasons.push(collisionCheck.reason!);
    }

    // Normalize risk score to 0-1
    riskScore = Math.min(1.0, riskScore);

    return {
      isReplay: riskScore >= 0.7,
      reason: reasons.length > 0 ? reasons.join('; ') : undefined,
      riskScore
    };
  }

  /**
   * Check if video hash was recently used
   */
  private static async checkRecentHashUse(
    videoHash: string,
    userId?: number
  ): Promise<ReplayCheckResult> {
    try {
      const oneHourAgo = new Date(Date.now() - this.RECENT_WINDOW_HOURS * 60 * 60 * 1000);

      // Query recent sessions with this hash
      const recentSessions = await db
        .select()
        .from(faceVerificationSessions)
        .where(
          and(
            eq(faceVerificationSessions.videoHash, videoHash),
            gt(faceVerificationSessions.createdAt, oneHourAgo)
          )
        )
        .limit(10);

      if (recentSessions.length === 0) {
        return { isReplay: false, riskScore: 0 };
      }

      // Check if same hash used multiple times
      if (recentSessions.length >= this.MAX_REUSE_COUNT) {
        return {
          isReplay: true,
          reason: `Video hash used ${recentSessions.length} times in the past hour`,
          riskScore: 0.9
        };
      }

      // Check if used by different users
      if (userId) {
        const differentUsers = recentSessions.filter(s => s.userId !== userId);
        if (differentUsers.length > 0) {
          return {
            isReplay: true,
            reason: 'Video hash used by different user accounts',
            riskScore: 1.0
          };
        }
      }

      // Same user, but multiple recent uses
      return {
        isReplay: false,
        reason: `Video hash used ${recentSessions.length} time(s) recently`,
        riskScore: 0.3 * recentSessions.length
      };

    } catch (error) {
      console.error('[AntiReplay] Error checking recent hash use:', error);
      return { isReplay: false, riskScore: 0 };
    }
  }

  /**
   * Check for metadata anomalies
   */
  private static checkMetadataAnomalies(metadata: VideoMetadata): ReplayCheckResult {
    let riskScore = 0;
    const reasons: string[] = [];

    // Check if file creation/modification dates are suspicious
    if (metadata.createdAt && metadata.modifiedAt) {
      const timeDiff = Math.abs(metadata.modifiedAt.getTime() - metadata.createdAt.getTime());
      
      // File modified long after creation (possible editing)
      if (timeDiff > 60 * 60 * 1000) {  // 1 hour
        riskScore += 0.3;
        reasons.push('File modified significantly after creation');
      }

      // File created in the past (not live capture)
      const ageMinutes = (Date.now() - metadata.createdAt.getTime()) / (60 * 1000);
      if (ageMinutes > 5) {
        riskScore += 0.4;
        reasons.push(`File created ${Math.floor(ageMinutes)} minutes ago`);
      }
    }

    // Check video duration (too short or too long)
    if (metadata.duration !== undefined) {
      if (metadata.duration < 1000) {  // Less than 1 second
        riskScore += 0.3;
        reasons.push('Video duration too short');
      } else if (metadata.duration > 30000) {  // More than 30 seconds
        riskScore += 0.2;
        reasons.push('Video duration unusually long');
      }
    }

    // Check frame count vs duration consistency
    if (metadata.frameCount && metadata.duration) {
      const fps = (metadata.frameCount / metadata.duration) * 1000;
      if (fps < 15 || fps > 60) {
        riskScore += 0.2;
        reasons.push(`Unusual frame rate: ${fps.toFixed(1)} fps`);
      }
    }

    return {
      isReplay: riskScore >= 0.7,
      reason: reasons.length > 0 ? reasons.join('; ') : undefined,
      riskScore
    };
  }

  /**
   * Check for hash collision patterns
   * (Multiple different users with same hash = suspicious)
   */
  private static async checkHashCollisions(videoHash: string): Promise<ReplayCheckResult> {
    try {
      // Count distinct users who used this hash
      const result = await db
        .select({
          distinctUsers: sql<number>`COUNT(DISTINCT ${faceVerificationSessions.userId})`
        })
        .from(faceVerificationSessions)
        .where(eq(faceVerificationSessions.videoHash, videoHash));

      const distinctUsers = result[0]?.distinctUsers || 0;

      if (distinctUsers > 1) {
        return {
          isReplay: true,
          reason: `Video hash associated with ${distinctUsers} different users`,
          riskScore: 0.8
        };
      }

      return { isReplay: false, riskScore: 0 };

    } catch (error) {
      console.error('[AntiReplay] Error checking hash collisions:', error);
      return { isReplay: false, riskScore: 0 };
    }
  }

  /**
   * Store video hash for future replay detection
   */
  static async storeVideoHash(
    sessionId: string,
    videoHash: string,
    userId?: number
  ): Promise<void> {
    try {
      await db
        .update(faceVerificationSessions)
        .set({ videoHash })
        .where(eq(faceVerificationSessions.sessionToken, sessionId));

      console.log(`[AntiReplay] Stored video hash for session ${sessionId}`);
    } catch (error) {
      console.error('[AntiReplay] Error storing video hash:', error);
    }
  }

  /**
   * Analyze frame-to-frame micro-movements
   * Real faces have subtle micro-movements, static images/videos don't
   */
  static analyzeFrameMicroMovements(
    frames: Array<{ landmarks: any[]; timestamp: number }>
  ): { hasMicroMovements: boolean; confidence: number } {
    if (frames.length < 3) {
      return { hasMicroMovements: false, confidence: 0 };
    }

    let totalMovement = 0;
    let frameCount = 0;

    for (let i = 1; i < frames.length; i++) {
      const prev = frames[i - 1].landmarks;
      const curr = frames[i].landmarks;

      if (!prev || !curr || prev.length === 0 || curr.length === 0) {
        continue;
      }

      // Calculate average landmark movement
      let movement = 0;
      for (let j = 0; j < Math.min(prev.length, curr.length); j++) {
        const dx = curr[j].x - prev[j].x;
        const dy = curr[j].y - prev[j].y;
        movement += Math.sqrt(dx * dx + dy * dy);
      }
      movement /= Math.min(prev.length, curr.length);

      totalMovement += movement;
      frameCount++;
    }

    const avgMovement = totalMovement / frameCount;

    // Real faces have micro-movements in range 0.001-0.01
    // Static images/videos have very little movement (<0.0005)
    const hasMicroMovements = avgMovement > 0.0005 && avgMovement < 0.05;
    const confidence = hasMicroMovements ? Math.min(avgMovement * 100, 1.0) : 0;

    return { hasMicroMovements, confidence };
  }

  /**
   * Clean up old replay detection data
   * Should be run periodically (e.g., daily cron job)
   */
  static async cleanupOldData(daysToKeep: number = 30): Promise<number> {
    try {
      const cutoffDate = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000);

      const result = await db
        .delete(faceVerificationSessions)
        .where(
          and(
            gt(faceVerificationSessions.createdAt, cutoffDate),
            eq(faceVerificationSessions.status, 'completed')
          )
        );

      console.log(`[AntiReplay] Cleaned up old verification sessions`);
      return 0;  // Drizzle doesn't return affected rows count easily

    } catch (error) {
      console.error('[AntiReplay] Error cleaning up old data:', error);
      return 0;
    }
  }
}
