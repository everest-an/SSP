/**
 * Login History Service
 * 
 * Tracks and manages user login activities for security and audit purposes
 */

import { db } from '../db';
import { loginHistory } from '../../drizzle/schema';
import { eq, desc, and, gte, lte } from 'drizzle-orm';
import { Request } from 'express';

/**
 * Record a login attempt
 */
export async function recordLoginAttempt(data: {
  userId: number;
  loginMethod: string;
  req: Request;
  status: 'success' | 'failed';
  failureReason?: string;
}) {
  const ipAddress = getClientIp(data.req);
  const userAgent = data.req.headers['user-agent'] || '';
  const deviceFingerprint = data.req.headers['x-device-fingerprint'] as string || '';
  
  // In production, use a geolocation service to get location from IP
  const location = await getLocationFromIp(ipAddress);

  await db.insert(loginHistory).values({
    userId: data.userId,
    loginMethod: data.loginMethod,
    ipAddress,
    userAgent,
    deviceFingerprint,
    location,
    status: data.status,
    failureReason: data.failureReason,
  });

  // Send login alert email for successful logins from new locations (async, don't wait)
  if (data.status === 'success') {
    const { users } = await import('@db/schema');
    const { eq } = await import('drizzle-orm');
    
    const [user] = await db.select().from(users).where(eq(users.id, data.userId)).limit(1);
    
    if (user && user.email) {
      const { sendLoginAlertEmail } = await import('./emailService');
      sendLoginAlertEmail(user.email, user.name || 'User', {
        time: new Date(),
        ip: ipAddress,
        location: location || 'Unknown',
        device: userAgent || 'Unknown',
      }).catch(err => {
        console.error('Failed to send login alert email:', err);
      });
    }
  }
}

/**
 * Get login history for a user
 */
export async function getUserLoginHistory(
  userId: number,
  options?: {
    limit?: number;
    offset?: number;
    startDate?: Date;
    endDate?: Date;
    status?: 'success' | 'failed';
  }
) {
  const { limit = 50, offset = 0, startDate, endDate, status } = options || {};

  let query = db
    .select()
    .from(loginHistory)
    .where(eq(loginHistory.userId, userId));

  // Apply filters
  const conditions = [eq(loginHistory.userId, userId)];
  
  if (startDate) {
    conditions.push(gte(loginHistory.createdAt, startDate));
  }
  
  if (endDate) {
    conditions.push(lte(loginHistory.createdAt, endDate));
  }
  
  if (status) {
    conditions.push(eq(loginHistory.status, status));
  }

  const results = await db
    .select()
    .from(loginHistory)
    .where(and(...conditions))
    .orderBy(desc(loginHistory.createdAt))
    .limit(limit)
    .offset(offset);

  // Get total count
  const [countResult] = await db
    .select({ count: db.$count(loginHistory.id) })
    .from(loginHistory)
    .where(and(...conditions));

  return {
    data: results,
    total: countResult?.count || 0,
    limit,
    offset,
  };
}

/**
 * Get recent failed login attempts for a user
 */
export async function getRecentFailedLogins(userId: number, hours: number = 24) {
  const since = new Date(Date.now() - hours * 60 * 60 * 1000);

  return db
    .select()
    .from(loginHistory)
    .where(
      and(
        eq(loginHistory.userId, userId),
        eq(loginHistory.status, 'failed'),
        gte(loginHistory.createdAt, since)
      )
    )
    .orderBy(desc(loginHistory.createdAt));
}

/**
 * Detect suspicious login activity
 */
export async function detectSuspiciousActivity(userId: number): Promise<{
  isSuspicious: boolean;
  reasons: string[];
}> {
  const reasons: string[] = [];
  
  // Check for multiple failed attempts in the last hour
  const recentFailed = await getRecentFailedLogins(userId, 1);
  if (recentFailed.length >= 5) {
    reasons.push(`${recentFailed.length} failed login attempts in the last hour`);
  }

  // Check for logins from multiple locations in a short time
  const recentLogins = await getUserLoginHistory(userId, {
    limit: 10,
    status: 'success',
  });
  
  const uniqueLocations = new Set(recentLogins.data.map(l => l.location).filter(Boolean));
  const uniqueIps = new Set(recentLogins.data.map(l => l.ipAddress).filter(Boolean));
  
  if (uniqueLocations.size >= 3 && recentLogins.data.length <= 10) {
    reasons.push(`Logins from ${uniqueLocations.size} different locations recently`);
  }
  
  if (uniqueIps.size >= 5 && recentLogins.data.length <= 10) {
    reasons.push(`Logins from ${uniqueIps.size} different IP addresses recently`);
  }

  return {
    isSuspicious: reasons.length > 0,
    reasons,
  };
}

/**
 * Get client IP address from request
 */
function getClientIp(req: Request): string {
  // Check various headers for the real IP (in case of proxies/load balancers)
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    const ips = (forwarded as string).split(',');
    return ips[0].trim();
  }
  
  return (
    (req.headers['x-real-ip'] as string) ||
    req.socket.remoteAddress ||
    'unknown'
  );
}

/**
 * Get approximate location from IP address
 * 
 * In production, use a geolocation service like:
 * - ipapi.co
 * - ip-api.com
 * - MaxMind GeoIP2
 */
async function getLocationFromIp(ip: string): Promise<string> {
  // Placeholder implementation
  // In production, make an API call to a geolocation service
  
  if (ip === 'unknown' || ip.startsWith('127.') || ip.startsWith('192.168.')) {
    return 'Local';
  }
  
  // For now, return a placeholder
  return 'Unknown Location';
  
  /* Example implementation with ip-api.com:
  try {
    const response = await fetch(`http://ip-api.com/json/${ip}`);
    const data = await response.json();
    
    if (data.status === 'success') {
      return `${data.city}, ${data.country}`;
    }
  } catch (error) {
    console.error('Failed to get location:', error);
  }
  
  return 'Unknown Location';
  */
}

/**
 * Get login statistics for a user
 */
export async function getLoginStatistics(userId: number, days: number = 30) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const allLogins = await db
    .select()
    .from(loginHistory)
    .where(
      and(
        eq(loginHistory.userId, userId),
        gte(loginHistory.createdAt, since)
      )
    );

  const successfulLogins = allLogins.filter(l => l.status === 'success');
  const failedLogins = allLogins.filter(l => l.status === 'failed');
  
  const uniqueDevices = new Set(allLogins.map(l => l.deviceFingerprint).filter(Boolean)).size;
  const uniqueLocations = new Set(allLogins.map(l => l.location).filter(Boolean)).size;
  const uniqueIps = new Set(allLogins.map(l => l.ipAddress).filter(Boolean)).size;

  // Group by login method
  const byMethod = allLogins.reduce((acc, login) => {
    const method = login.loginMethod || 'unknown';
    acc[method] = (acc[method] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return {
    totalLogins: allLogins.length,
    successfulLogins: successfulLogins.length,
    failedLogins: failedLogins.length,
    successRate: allLogins.length > 0 
      ? (successfulLogins.length / allLogins.length * 100).toFixed(2) 
      : '0',
    uniqueDevices,
    uniqueLocations,
    uniqueIps,
    byMethod,
    period: `Last ${days} days`,
  };
}
