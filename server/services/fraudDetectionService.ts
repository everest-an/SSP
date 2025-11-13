/**
 * Fraud Detection and Alert Service
 * 
 * Handles:
 * - Anomaly detection in transactions
 * - Risk scoring
 * - Fraud alerts
 * - Pattern analysis
 */

import { db } from '../_core/db';
import { orders, transactions } from '../_core/schema';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';

/**
 * Risk level
 */
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

/**
 * Fraud alert
 */
export interface FraudAlert {
  id: string;
  orderId: number;
  userId?: number;
  riskLevel: RiskLevel;
  riskScore: number; // 0-100
  reason: string[];
  timestamp: Date;
  status: 'pending' | 'reviewed' | 'confirmed' | 'dismissed';
  reviewedAt?: Date;
  reviewedBy?: string;
  notes?: string;
}

/**
 * Risk factors
 */
export interface RiskFactors {
  amountAnomaly: number; // 0-100
  frequencyAnomaly: number; // 0-100
  locationAnomaly: number; // 0-100
  deviceAnomaly: number; // 0-100
  paymentMethodAnomaly: number; // 0-100
  timeAnomaly: number; // 0-100
}

/**
 * In-memory storage for alerts (use database in production)
 */
const fraudAlerts = new Map<string, FraudAlert>();

/**
 * Calculate risk score for transaction
 */
export async function calculateRiskScore(orderId: number): Promise<{
  score: number;
  level: RiskLevel;
  factors: RiskFactors;
  reasons: string[];
}> {
  try {
    const order = await db.query.orders.findFirst({
      where: eq(orders.id, orderId),
    });

    if (!order) {
      throw new Error('Order not found');
    }

    const factors: RiskFactors = {
      amountAnomaly: 0,
      frequencyAnomaly: 0,
      locationAnomaly: 0,
      deviceAnomaly: 0,
      paymentMethodAnomaly: 0,
      timeAnomaly: 0,
    };

    const reasons: string[] = [];

    // 1. Amount anomaly
    const userOrders = await db.query.orders.findMany({
      where: eq(orders.customerId, order.customerId),
    });

    if (userOrders.length > 0) {
      const amounts = userOrders.map(o => o.totalAmount);
      const avgAmount = amounts.reduce((a, b) => a + b, 0) / amounts.length;
      const stdDev = Math.sqrt(
        amounts.reduce((sum, amt) => sum + Math.pow(amt - avgAmount, 2), 0) / amounts.length
      );

      // If amount is > 3 standard deviations from mean
      if (Math.abs(order.totalAmount - avgAmount) > 3 * stdDev) {
        factors.amountAnomaly = 80;
        reasons.push(`Unusual transaction amount: $${(order.totalAmount / 100).toFixed(2)}`);
      }

      // If amount is unusually high
      if (order.totalAmount > avgAmount * 5) {
        factors.amountAnomaly = Math.max(factors.amountAnomaly, 60);
        reasons.push('Transaction amount significantly higher than user average');
      }
    }

    // 2. Frequency anomaly
    const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentOrders = userOrders.filter(o => o.createdAt > last24Hours);

    if (recentOrders.length > 5) {
      factors.frequencyAnomaly = 70;
      reasons.push(`Unusual transaction frequency: ${recentOrders.length} orders in 24 hours`);
    }

    // 3. Device anomaly
    if (order.deviceId) {
      const deviceOrders = userOrders.filter(o => o.deviceId === order.deviceId);
      
      if (deviceOrders.length === 0 && userOrders.length > 0) {
        factors.deviceAnomaly = 50;
        reasons.push('Transaction from new device');
      }
    }

    // 4. Payment method anomaly
    const paymentMethods = new Set(userOrders.map(o => o.paymentMethod));
    
    if (!paymentMethods.has(order.paymentMethod) && paymentMethods.size > 0) {
      factors.paymentMethodAnomaly = 40;
      reasons.push(`New payment method: ${order.paymentMethod}`);
    }

    // 5. Time anomaly
    const hour = new Date(order.createdAt).getHours();
    
    if (hour >= 2 && hour <= 5) {
      factors.timeAnomaly = 30;
      reasons.push('Transaction at unusual time (2-5 AM)');
    }

    // 6. Location anomaly (if available)
    // This would require IP/location data
    factors.locationAnomaly = 0;

    // Calculate overall risk score
    const weights = {
      amountAnomaly: 0.25,
      frequencyAnomaly: 0.20,
      locationAnomaly: 0.15,
      deviceAnomaly: 0.15,
      paymentMethodAnomaly: 0.15,
      timeAnomaly: 0.10,
    };

    const score = Math.round(
      factors.amountAnomaly * weights.amountAnomaly +
      factors.frequencyAnomaly * weights.frequencyAnomaly +
      factors.locationAnomaly * weights.locationAnomaly +
      factors.deviceAnomaly * weights.deviceAnomaly +
      factors.paymentMethodAnomaly * weights.paymentMethodAnomaly +
      factors.timeAnomaly * weights.timeAnomaly
    );

    let level: RiskLevel = 'low';
    if (score >= 80) {
      level = 'critical';
    } else if (score >= 60) {
      level = 'high';
    } else if (score >= 40) {
      level = 'medium';
    }

    return {
      score,
      level,
      factors,
      reasons,
    };
  } catch (error) {
    console.error('[FraudDetection] Failed to calculate risk score:', error);
    throw error;
  }
}

/**
 * Create fraud alert
 */
export async function createFraudAlert(
  orderId: number,
  riskLevel: RiskLevel,
  riskScore: number,
  reasons: string[]
): Promise<FraudAlert> {
  try {
    const order = await db.query.orders.findFirst({
      where: eq(orders.id, orderId),
    });

    if (!order) {
      throw new Error('Order not found');
    }

    const id = nanoid();

    const alert: FraudAlert = {
      id,
      orderId,
      userId: order.customerId,
      riskLevel,
      riskScore,
      reason: reasons,
      timestamp: new Date(),
      status: 'pending',
    };

    fraudAlerts.set(id, alert);

    return alert;
  } catch (error) {
    console.error('[FraudDetection] Failed to create alert:', error);
    throw error;
  }
}

/**
 * Get fraud alert
 */
export async function getFraudAlert(alertId: string): Promise<FraudAlert | null> {
  try {
    return fraudAlerts.get(alertId) || null;
  } catch (error) {
    console.error('[FraudDetection] Failed to get alert:', error);
    throw error;
  }
}

/**
 * Get fraud alerts for order
 */
export async function getFraudAlertsForOrder(orderId: number): Promise<FraudAlert[]> {
  try {
    const alerts: FraudAlert[] = [];

    for (const [, alert] of fraudAlerts) {
      if (alert.orderId === orderId) {
        alerts.push(alert);
      }
    }

    return alerts;
  } catch (error) {
    console.error('[FraudDetection] Failed to get alerts:', error);
    throw error;
  }
}

/**
 * Get fraud alerts for user
 */
export async function getFraudAlertsForUser(userId: number): Promise<FraudAlert[]> {
  try {
    const alerts: FraudAlert[] = [];

    for (const [, alert] of fraudAlerts) {
      if (alert.userId === userId) {
        alerts.push(alert);
      }
    }

    return alerts.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  } catch (error) {
    console.error('[FraudDetection] Failed to get user alerts:', error);
    throw error;
  }
}

/**
 * Review fraud alert
 */
export async function reviewFraudAlert(
  alertId: string,
  status: 'confirmed' | 'dismissed',
  reviewedBy: string,
  notes?: string
): Promise<FraudAlert | null> {
  try {
    const alert = fraudAlerts.get(alertId);

    if (!alert) {
      return null;
    }

    alert.status = status;
    alert.reviewedAt = new Date();
    alert.reviewedBy = reviewedBy;
    alert.notes = notes;

    return alert;
  } catch (error) {
    console.error('[FraudDetection] Failed to review alert:', error);
    throw error;
  }
}

/**
 * Get pending fraud alerts
 */
export async function getPendingFraudAlerts(limit: number = 50): Promise<FraudAlert[]> {
  try {
    const alerts: FraudAlert[] = [];

    for (const [, alert] of fraudAlerts) {
      if (alert.status === 'pending') {
        alerts.push(alert);
      }
    }

    return alerts
      .sort((a, b) => b.riskScore - a.riskScore)
      .slice(0, limit);
  } catch (error) {
    console.error('[FraudDetection] Failed to get pending alerts:', error);
    throw error;
  }
}

/**
 * Get fraud statistics
 */
export async function getFraudStatistics(): Promise<{
  totalAlerts: number;
  pendingAlerts: number;
  confirmedFrauds: number;
  dismissedAlerts: number;
  averageRiskScore: number;
  criticalAlerts: number;
  highRiskAlerts: number;
}> {
  try {
    const allAlerts = Array.from(fraudAlerts.values());

    const pending = allAlerts.filter(a => a.status === 'pending').length;
    const confirmed = allAlerts.filter(a => a.status === 'confirmed').length;
    const dismissed = allAlerts.filter(a => a.status === 'dismissed').length;
    const critical = allAlerts.filter(a => a.riskLevel === 'critical').length;
    const highRisk = allAlerts.filter(a => a.riskLevel === 'high').length;

    const avgScore = allAlerts.length > 0
      ? allAlerts.reduce((sum, a) => sum + a.riskScore, 0) / allAlerts.length
      : 0;

    return {
      totalAlerts: allAlerts.length,
      pendingAlerts: pending,
      confirmedFrauds: confirmed,
      dismissedAlerts: dismissed,
      averageRiskScore: Math.round(avgScore),
      criticalAlerts: critical,
      highRiskAlerts: highRisk,
    };
  } catch (error) {
    console.error('[FraudDetection] Failed to get statistics:', error);
    throw error;
  }
}

/**
 * Block user (after confirmed fraud)
 */
export async function blockUser(userId: number, reason: string): Promise<boolean> {
  try {
    // In production, update user status in database
    console.log(`[FraudDetection] User ${userId} blocked: ${reason}`);
    return true;
  } catch (error) {
    console.error('[FraudDetection] Failed to block user:', error);
    return false;
  }
}

/**
 * Analyze transaction patterns
 */
export async function analyzeTransactionPatterns(userId: number): Promise<{
  averageAmount: number;
  medianAmount: number;
  standardDeviation: number;
  frequencyPerDay: number;
  mostCommonPaymentMethod: string;
  mostCommonTime: number;
  riskProfile: 'low' | 'medium' | 'high';
}> {
  try {
    const userOrders = await db.query.orders.findMany({
      where: eq(orders.customerId, userId),
    });

    if (userOrders.length === 0) {
      return {
        averageAmount: 0,
        medianAmount: 0,
        standardDeviation: 0,
        frequencyPerDay: 0,
        mostCommonPaymentMethod: 'unknown',
        mostCommonTime: 0,
        riskProfile: 'low',
      };
    }

    // Amount statistics
    const amounts = userOrders.map(o => o.totalAmount).sort((a, b) => a - b);
    const averageAmount = amounts.reduce((a, b) => a + b, 0) / amounts.length;
    const medianAmount = amounts[Math.floor(amounts.length / 2)];
    const standardDeviation = Math.sqrt(
      amounts.reduce((sum, amt) => sum + Math.pow(amt - averageAmount, 2), 0) / amounts.length
    );

    // Frequency
    const daySpan = (userOrders[userOrders.length - 1].createdAt.getTime() - 
                     userOrders[0].createdAt.getTime()) / (1000 * 60 * 60 * 24);
    const frequencyPerDay = userOrders.length / (daySpan || 1);

    // Most common payment method
    const paymentMethods = new Map<string, number>();
    for (const order of userOrders) {
      const method = order.paymentMethod || 'unknown';
      paymentMethods.set(method, (paymentMethods.get(method) || 0) + 1);
    }
    const mostCommonPaymentMethod = Array.from(paymentMethods.entries())
      .sort((a, b) => b[1] - a[1])[0]?.[0] || 'unknown';

    // Most common time
    const hours = new Map<number, number>();
    for (const order of userOrders) {
      const hour = new Date(order.createdAt).getHours();
      hours.set(hour, (hours.get(hour) || 0) + 1);
    }
    const mostCommonTime = Array.from(hours.entries())
      .sort((a, b) => b[1] - a[1])[0]?.[0] || 0;

    // Risk profile
    let riskProfile: 'low' | 'medium' | 'high' = 'low';
    if (frequencyPerDay > 10 || standardDeviation > averageAmount * 2) {
      riskProfile = 'high';
    } else if (frequencyPerDay > 5 || standardDeviation > averageAmount) {
      riskProfile = 'medium';
    }

    return {
      averageAmount,
      medianAmount,
      standardDeviation,
      frequencyPerDay,
      mostCommonPaymentMethod,
      mostCommonTime,
      riskProfile,
    };
  } catch (error) {
    console.error('[FraudDetection] Failed to analyze patterns:', error);
    throw error;
  }
}
