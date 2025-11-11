/**
 * Audit Logging Middleware
 * Automatically logs security-relevant actions to audit_logs table
 * 
 * Sprint 3 Phase 7: Audit & Monitoring System
 */

import { db } from '../db';
import { auditLogs } from '../../drizzle/schema';
import type { Request } from 'express';

export interface AuditLogEntry {
  userId?: number;
  action: string;
  actor?: string;
  resourceType?: string;
  resourceId?: string;
  ipAddress?: string;
  userAgent?: string;
  deviceFingerprint?: string;
  geoLocation?: {
    country?: string;
    city?: string;
    lat?: number;
    lon?: number;
  };
  detail?: Record<string, any>;
  riskScore?: number;
  status?: 'success' | 'failure' | 'pending';
  errorMessage?: string;
}

/**
 * Audit Logger Service
 * Provides methods to log security events
 */
export class AuditLogger {
  /**
   * Log an audit event
   */
  static async log(entry: AuditLogEntry): Promise<void> {
    try {
      await db.insert(auditLogs).values({
        userId: entry.userId || null,
        action: entry.action,
        actor: entry.actor || null,
        resourceType: entry.resourceType || null,
        resourceId: entry.resourceId || null,
        ipAddress: entry.ipAddress || null,
        userAgent: entry.userAgent || null,
        deviceFingerprint: entry.deviceFingerprint || null,
        geoLocation: entry.geoLocation ? JSON.stringify(entry.geoLocation) : null,
        detail: entry.detail ? JSON.stringify(entry.detail) : null,
        riskScore: entry.riskScore?.toString() || null,
        status: entry.status || 'success',
        errorMessage: entry.errorMessage || null
      });
    } catch (error) {
      console.error('[AuditLogger] Failed to log audit event:', error);
      // Don't throw - audit logging failures shouldn't break the main flow
    }
  }

  /**
   * Log a face authentication event
   */
  static async logFaceAuth(params: {
    userId?: number;
    action: 'face_enroll' | 'face_login' | 'face_payment' | 'face_verification';
    faceProfileId?: number;
    success: boolean;
    similarityScore?: number;
    livenessScore?: number;
    failureReason?: string;
    req?: Request;
    deviceFingerprint?: string;
    detail?: Record<string, any>;
  }): Promise<void> {
    await this.log({
      userId: params.userId,
      action: params.action,
      actor: 'user',
      resourceType: 'face_profile',
      resourceId: params.faceProfileId?.toString(),
      ipAddress: params.req?.ip,
      userAgent: params.req?.headers['user-agent'],
      deviceFingerprint: params.deviceFingerprint,
      detail: {
        similarity_score: params.similarityScore,
        liveness_score: params.livenessScore,
        ...params.detail
      },
      status: params.success ? 'success' : 'failure',
      errorMessage: params.failureReason,
      riskScore: params.success ? 0 : 0.5
    });
  }

  /**
   * Log a payment event
   */
  static async logPayment(params: {
    userId: number;
    action: 'payment_method_add' | 'payment_method_remove' | 'payment_charge' | 'payment_refund';
    paymentMethodId?: number;
    amount?: number;
    currency?: string;
    success: boolean;
    stripeChargeId?: string;
    failureReason?: string;
    req?: Request;
    deviceFingerprint?: string;
    detail?: Record<string, any>;
  }): Promise<void> {
    await this.log({
      userId: params.userId,
      action: params.action,
      actor: 'user',
      resourceType: 'payment',
      resourceId: params.stripeChargeId || params.paymentMethodId?.toString(),
      ipAddress: params.req?.ip,
      userAgent: params.req?.headers['user-agent'],
      deviceFingerprint: params.deviceFingerprint,
      detail: {
        amount: params.amount,
        currency: params.currency,
        payment_method_id: params.paymentMethodId,
        ...params.detail
      },
      status: params.success ? 'success' : 'failure',
      errorMessage: params.failureReason,
      riskScore: params.success ? 0 : 0.3
    });
  }

  /**
   * Log a user account event
   */
  static async logAccountEvent(params: {
    userId: number;
    action: 'account_created' | 'account_updated' | 'account_suspended' | 'account_deleted' | 'password_changed' | 'email_changed';
    success: boolean;
    performedBy?: 'user' | 'admin' | 'system';
    failureReason?: string;
    req?: Request;
    detail?: Record<string, any>;
  }): Promise<void> {
    await this.log({
      userId: params.userId,
      action: params.action,
      actor: params.performedBy || 'user',
      resourceType: 'user_account',
      resourceId: params.userId.toString(),
      ipAddress: params.req?.ip,
      userAgent: params.req?.headers['user-agent'],
      detail: params.detail,
      status: params.success ? 'success' : 'failure',
      errorMessage: params.failureReason,
      riskScore: params.action === 'account_suspended' ? 0.8 : 0
    });
  }

  /**
   * Log a security event
   */
  static async logSecurityEvent(params: {
    userId?: number;
    action: 'suspicious_activity' | 'brute_force_attempt' | 'replay_attack' | 'duplicate_face' | 'device_change' | 'location_change';
    riskScore: number;
    description: string;
    req?: Request;
    deviceFingerprint?: string;
    detail?: Record<string, any>;
  }): Promise<void> {
    await this.log({
      userId: params.userId,
      action: params.action,
      actor: 'system',
      resourceType: 'security_event',
      ipAddress: params.req?.ip,
      userAgent: params.req?.headers['user-agent'],
      deviceFingerprint: params.deviceFingerprint,
      detail: {
        description: params.description,
        ...params.detail
      },
      status: 'pending',
      riskScore: params.riskScore
    });
  }

  /**
   * Get audit logs for a user
   */
  static async getUserLogs(userId: number, limit: number = 50) {
    return await db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.userId, userId))
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit);
  }

  /**
   * Get high-risk audit logs for security review
   */
  static async getHighRiskLogs(minRiskScore: number = 0.7, limit: number = 100) {
    return await db
      .select()
      .from(auditLogs)
      .where(gte(auditLogs.riskScore, minRiskScore.toString()))
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit);
  }

  /**
   * Get recent failed authentication attempts
   */
  static async getFailedAuthAttempts(hours: number = 24, limit: number = 100) {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);
    
    return await db
      .select()
      .from(auditLogs)
      .where(
        and(
          or(
            eq(auditLogs.action, 'face_login'),
            eq(auditLogs.action, 'face_verification')
          ),
          eq(auditLogs.status, 'failure'),
          gte(auditLogs.createdAt, since)
        )
      )
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit);
  }
}

// Import necessary functions from drizzle-orm
import { eq, desc, gte, and, or } from 'drizzle-orm';

/**
 * Express middleware to automatically log API requests
 */
export function auditMiddleware(options: {
  logAllRequests?: boolean;
  logFailures?: boolean;
  sensitiveActions?: string[];
} = {}) {
  return async (req: Request, res: any, next: any) => {
    const startTime = Date.now();
    
    // Store original end function
    const originalEnd = res.end;
    
    // Override end function to log after response
    res.end = function(...args: any[]) {
      const duration = Date.now() - startTime;
      const statusCode = res.statusCode;
      const success = statusCode >= 200 && statusCode < 400;
      
      // Determine if we should log this request
      const shouldLog = 
        options.logAllRequests ||
        (options.logFailures && !success) ||
        (options.sensitiveActions && options.sensitiveActions.includes(req.path));
      
      if (shouldLog) {
        const userId = (req as any).user?.id;
        
        AuditLogger.log({
          userId,
          action: `api_${req.method.toLowerCase()}_${req.path.replace(/\//g, '_')}`,
          actor: userId ? 'user' : 'anonymous',
          resourceType: 'api_request',
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
          detail: {
            method: req.method,
            path: req.path,
            query: req.query,
            status_code: statusCode,
            duration_ms: duration
          },
          status: success ? 'success' : 'failure',
          riskScore: success ? 0 : 0.2
        }).catch(err => {
          console.error('[AuditMiddleware] Failed to log request:', err);
        });
      }
      
      // Call original end
      return originalEnd.apply(res, args);
    };
    
    next();
  };
}
