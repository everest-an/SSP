/**
 * Security Monitoring Service
 * Detects anomalies and suspicious patterns in user behavior
 * 
 * Sprint 3 Phase 7: Monitoring System
 */

import { db } from '../../db';
import { 
  auditLogs, 
  faceMatchAttempts, 
  users,
  deviceBindings 
} from '../../../drizzle/schema';
import { eq, and, gte, desc, sql, count } from 'drizzle-orm';
import { AuditLogger } from '../../middleware/auditLogger';

export interface SecurityAlert {
  severity: 'low' | 'medium' | 'high' | 'critical';
  type: string;
  userId?: number;
  description: string;
  evidence: Record<string, any>;
  recommendedAction: string;
  timestamp: Date;
}

export interface UserSecurityProfile {
  userId: number;
  riskScore: number;
  failedLoginAttempts: number;
  suspiciousActivities: number;
  deviceCount: number;
  lastLogin: Date | null;
  accountStatus: string;
  alerts: SecurityAlert[];
}

/**
 * Security Monitor Service
 * Analyzes user behavior and detects security threats
 */
export class SecurityMonitor {
  /**
   * Check for brute force login attempts
   * Alert if >5 failed attempts in 15 minutes
   */
  static async checkBruteForce(userId?: number): Promise<SecurityAlert[]> {
    const alerts: SecurityAlert[] = [];
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);

    try {
      let query = db
        .select({
          userId: faceMatchAttempts.userId,
          count: count()
        })
        .from(faceMatchAttempts)
        .where(
          and(
            eq(faceMatchAttempts.success, false),
            gte(faceMatchAttempts.createdAt, fifteenMinutesAgo),
            eq(faceMatchAttempts.attemptType, 'login')
          )
        )
        .groupBy(faceMatchAttempts.userId);

      if (userId) {
        query = query.having(eq(faceMatchAttempts.userId, userId));
      }

      const results = await query;

      for (const result of results) {
        if (result.count >= 5) {
          alerts.push({
            severity: result.count >= 10 ? 'critical' : 'high',
            type: 'brute_force_attempt',
            userId: result.userId || undefined,
            description: `${result.count} failed login attempts in 15 minutes`,
            evidence: {
              failed_attempts: result.count,
              time_window: '15 minutes'
            },
            recommendedAction: result.count >= 10 
              ? 'Lock account immediately' 
              : 'Monitor and consider rate limiting',
            timestamp: new Date()
          });

          // Log security event
          await AuditLogger.logSecurityEvent({
            userId: result.userId || undefined,
            action: 'brute_force_attempt',
            riskScore: Math.min(1.0, result.count / 10),
            description: `${result.count} failed login attempts detected`,
            detail: { failed_attempts: result.count }
          });
        }
      }
    } catch (error) {
      console.error('[SecurityMonitor] Error checking brute force:', error);
    }

    return alerts;
  }

  /**
   * Check for suspicious device changes
   * Alert if user logs in from new device in different location
   */
  static async checkDeviceAnomalies(userId: number): Promise<SecurityAlert[]> {
    const alerts: SecurityAlert[] = [];

    try {
      // Get user's known devices
      const knownDevices = await db
        .select()
        .from(deviceBindings)
        .where(
          and(
            eq(deviceBindings.userId, userId),
            eq(deviceBindings.status, 'active')
          )
        );

      // Get recent login attempts
      const recentAttempts = await db
        .select()
        .from(faceMatchAttempts)
        .where(
          and(
            eq(faceMatchAttempts.userId, userId),
            eq(faceMatchAttempts.attemptType, 'login'),
            gte(faceMatchAttempts.createdAt, new Date(Date.now() - 24 * 60 * 60 * 1000))
          )
        )
        .orderBy(desc(faceMatchAttempts.createdAt))
        .limit(10);

      // Check for unknown devices
      for (const attempt of recentAttempts) {
        if (!attempt.deviceFingerprint) continue;

        const isKnownDevice = knownDevices.some(
          d => d.deviceFingerprint === attempt.deviceFingerprint
        );

        if (!isKnownDevice && attempt.success) {
          alerts.push({
            severity: 'medium',
            type: 'device_change',
            userId,
            description: 'Login from unknown device',
            evidence: {
              device_fingerprint: attempt.deviceFingerprint,
              ip_address: attempt.ipAddress,
              timestamp: attempt.createdAt
            },
            recommendedAction: 'Verify with user and add to trusted devices',
            timestamp: new Date()
          });

          await AuditLogger.logSecurityEvent({
            userId,
            action: 'device_change',
            riskScore: 0.5,
            description: 'Login from unknown device',
            deviceFingerprint: attempt.deviceFingerprint,
            detail: { ip_address: attempt.ipAddress }
          });
        }
      }
    } catch (error) {
      console.error('[SecurityMonitor] Error checking device anomalies:', error);
    }

    return alerts;
  }

  /**
   * Check for duplicate face enrollments
   * Alert if same face is used across multiple accounts
   */
  static async checkDuplicateFaces(): Promise<SecurityAlert[]> {
    const alerts: SecurityAlert[] = [];

    try {
      // This would query the FAISS index for high-similarity matches
      // across different users
      // For now, we'll check face_match_attempts for enrollment_check failures
      
      const duplicateAttempts = await db
        .select()
        .from(faceMatchAttempts)
        .where(
          and(
            eq(faceMatchAttempts.attemptType, 'enrollment_check'),
            eq(faceMatchAttempts.success, false),
            sql`${faceMatchAttempts.failureReason} LIKE '%duplicate%'`
          )
        )
        .orderBy(desc(faceMatchAttempts.createdAt))
        .limit(50);

      // Group by user
      const userDuplicates = new Map<number, number>();
      for (const attempt of duplicateAttempts) {
        if (attempt.userId) {
          userDuplicates.set(
            attempt.userId,
            (userDuplicates.get(attempt.userId) || 0) + 1
          );
        }
      }

      // Alert for users with multiple duplicate attempts
      for (const [userId, count] of userDuplicates) {
        if (count >= 3) {
          alerts.push({
            severity: 'high',
            type: 'duplicate_face',
            userId,
            description: `${count} attempts to enroll duplicate face`,
            evidence: {
              duplicate_attempts: count
            },
            recommendedAction: 'Investigate for fraud, consider account suspension',
            timestamp: new Date()
          });

          await AuditLogger.logSecurityEvent({
            userId,
            action: 'duplicate_face',
            riskScore: 0.8,
            description: `Multiple duplicate face enrollment attempts`,
            detail: { attempts: count }
          });
        }
      }
    } catch (error) {
      console.error('[SecurityMonitor] Error checking duplicate faces:', error);
    }

    return alerts;
  }

  /**
   * Check for replay attacks
   * Alert if same video hash is used multiple times
   */
  static async checkReplayAttacks(): Promise<SecurityAlert[]> {
    const alerts: SecurityAlert[] = [];

    try {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

      // Find video hashes used multiple times
      const replayAttempts = await db
        .select({
          sessionId: faceMatchAttempts.sessionId,
          count: count(),
          users: sql<string>`GROUP_CONCAT(DISTINCT ${faceMatchAttempts.userId})`
        })
        .from(faceMatchAttempts)
        .where(gte(faceMatchAttempts.createdAt, oneHourAgo))
        .groupBy(faceMatchAttempts.sessionId)
        .having(sql`COUNT(*) > 1`);

      for (const replay of replayAttempts) {
        const userIds = replay.users.split(',').map(Number);
        const uniqueUsers = new Set(userIds).size;

        if (uniqueUsers > 1 || replay.count > 3) {
          alerts.push({
            severity: uniqueUsers > 1 ? 'critical' : 'high',
            type: 'replay_attack',
            description: `Video hash reused ${replay.count} times${uniqueUsers > 1 ? ` across ${uniqueUsers} users` : ''}`,
            evidence: {
              session_id: replay.sessionId,
              reuse_count: replay.count,
              unique_users: uniqueUsers,
              user_ids: userIds
            },
            recommendedAction: 'Block video hash, investigate users involved',
            timestamp: new Date()
          });

          for (const userId of userIds) {
            await AuditLogger.logSecurityEvent({
              userId,
              action: 'replay_attack',
              riskScore: 0.9,
              description: 'Replay attack detected',
              detail: {
                session_id: replay.sessionId,
                reuse_count: replay.count
              }
            });
          }
        }
      }
    } catch (error) {
      console.error('[SecurityMonitor] Error checking replay attacks:', error);
    }

    return alerts;
  }

  /**
   * Get comprehensive security profile for a user
   */
  static async getUserSecurityProfile(userId: number): Promise<UserSecurityProfile> {
    try {
      // Get user info
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (!user) {
        throw new Error('User not found');
      }

      // Get failed login attempts (last 24 hours)
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const [failedAttempts] = await db
        .select({ count: count() })
        .from(faceMatchAttempts)
        .where(
          and(
            eq(faceMatchAttempts.userId, userId),
            eq(faceMatchAttempts.success, false),
            gte(faceMatchAttempts.createdAt, oneDayAgo)
          )
        );

      // Get suspicious activities (high risk audit logs)
      const [suspiciousCount] = await db
        .select({ count: count() })
        .from(auditLogs)
        .where(
          and(
            eq(auditLogs.userId, userId),
            gte(auditLogs.riskScore, '0.7')
          )
        );

      // Get device count
      const [deviceCount] = await db
        .select({ count: count() })
        .from(deviceBindings)
        .where(
          and(
            eq(deviceBindings.userId, userId),
            eq(deviceBindings.status, 'active')
          )
        );

      // Generate alerts
      const alerts: SecurityAlert[] = [];
      
      // Check brute force
      const bruteForceAlerts = await this.checkBruteForce(userId);
      alerts.push(...bruteForceAlerts);

      // Check device anomalies
      const deviceAlerts = await this.checkDeviceAnomalies(userId);
      alerts.push(...deviceAlerts);

      return {
        userId,
        riskScore: parseFloat(user.riskScore || '0'),
        failedLoginAttempts: failedAttempts.count,
        suspiciousActivities: suspiciousCount.count,
        deviceCount: deviceCount.count,
        lastLogin: user.lastLoginAt,
        accountStatus: user.accountStatus,
        alerts
      };
    } catch (error) {
      console.error('[SecurityMonitor] Error getting user profile:', error);
      throw error;
    }
  }

  /**
   * Run all security checks and return aggregated alerts
   */
  static async runSecurityScan(): Promise<SecurityAlert[]> {
    const alerts: SecurityAlert[] = [];

    try {
      console.log('[SecurityMonitor] Running security scan...');

      // Run all checks in parallel
      const [bruteForce, duplicates, replays] = await Promise.all([
        this.checkBruteForce(),
        this.checkDuplicateFaces(),
        this.checkReplayAttacks()
      ]);

      alerts.push(...bruteForce, ...duplicates, ...replays);

      console.log(`[SecurityMonitor] Scan complete: ${alerts.length} alerts generated`);

      // Log scan completion
      await AuditLogger.log({
        action: 'security_scan_completed',
        actor: 'system',
        resourceType: 'security_scan',
        detail: {
          alerts_count: alerts.length,
          critical: alerts.filter(a => a.severity === 'critical').length,
          high: alerts.filter(a => a.severity === 'high').length,
          medium: alerts.filter(a => a.severity === 'medium').length,
          low: alerts.filter(a => a.severity === 'low').length
        },
        status: 'success'
      });

      return alerts;
    } catch (error) {
      console.error('[SecurityMonitor] Error running security scan:', error);
      return alerts;
    }
  }

  /**
   * Update user risk score based on recent activity
   */
  static async updateUserRiskScore(userId: number): Promise<number> {
    try {
      const profile = await this.getUserSecurityProfile(userId);

      // Calculate risk score (0-1)
      let riskScore = 0;

      // Failed login attempts (max 0.3)
      riskScore += Math.min(0.3, profile.failedLoginAttempts * 0.05);

      // Suspicious activities (max 0.4)
      riskScore += Math.min(0.4, profile.suspiciousActivities * 0.1);

      // Alerts (max 0.3)
      const criticalAlerts = profile.alerts.filter(a => a.severity === 'critical').length;
      const highAlerts = profile.alerts.filter(a => a.severity === 'high').length;
      riskScore += Math.min(0.3, criticalAlerts * 0.15 + highAlerts * 0.05);

      // Cap at 1.0
      riskScore = Math.min(1.0, riskScore);

      // Update in database
      await db
        .update(users)
        .set({ riskScore: riskScore.toString() })
        .where(eq(users.id, userId));

      console.log(`[SecurityMonitor] Updated risk score for user ${userId}: ${riskScore.toFixed(2)}`);

      return riskScore;
    } catch (error) {
      console.error('[SecurityMonitor] Error updating risk score:', error);
      return 0;
    }
  }
}

/**
 * Schedule periodic security scans
 * Should be called from a cron job or scheduled task
 */
export async function runPeriodicSecurityScan(): Promise<void> {
  console.log('[SecurityMonitor] Starting periodic security scan...');
  
  try {
    const alerts = await SecurityMonitor.runSecurityScan();
    
    // Send critical alerts to admin (email, Slack, etc.)
    const criticalAlerts = alerts.filter(a => a.severity === 'critical');
    if (criticalAlerts.length > 0) {
      console.warn(`[SecurityMonitor] 🚨 ${criticalAlerts.length} CRITICAL alerts detected!`);
      // TODO: Send notification to admins
    }

    // Update risk scores for users with alerts
    const userIds = new Set(alerts.map(a => a.userId).filter(Boolean));
    for (const userId of userIds) {
      await SecurityMonitor.updateUserRiskScore(userId as number);
    }

    console.log('[SecurityMonitor] ✅ Periodic scan complete');
  } catch (error) {
    console.error('[SecurityMonitor] ❌ Periodic scan failed:', error);
  }
}
