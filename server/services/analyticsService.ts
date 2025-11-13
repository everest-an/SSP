/**
 * Advanced Analytics Service
 * 
 * Handles:
 * - User profile analysis
 * - Sales trend analysis
 * - Product popularity ranking
 * - Payment method analysis
 * - Revenue analytics
 */

import { db } from '../_core/db';
import { orders, orderItems, users, products, transactions } from '../_core/schema';
import { eq, and, gte, lte } from 'drizzle-orm';

/**
 * User profile data
 */
export interface UserProfile {
  userId: number;
  totalOrders: number;
  totalSpent: number;
  averageOrderValue: number;
  lastOrderDate?: Date;
  preferredProducts: Array<{ productId: number; count: number }>;
  preferredPaymentMethod?: string;
  customerLifetimeValue: number;
  segmentation: 'vip' | 'regular' | 'occasional' | 'inactive';
}

/**
 * Sales trend data
 */
export interface SalesTrend {
  date: string;
  totalSales: number;
  orderCount: number;
  averageOrderValue: number;
  revenue: number;
}

/**
 * Product popularity data
 */
export interface ProductPopularity {
  productId: number;
  productName: string;
  totalSold: number;
  totalRevenue: number;
  averagePrice: number;
  popularity: number; // 0-100 score
  trend: 'up' | 'stable' | 'down';
}

/**
 * Payment method analysis
 */
export interface PaymentMethodAnalysis {
  method: string;
  totalTransactions: number;
  totalAmount: number;
  averageAmount: number;
  successRate: number;
  usagePercentage: number;
}

/**
 * Revenue analytics
 */
export interface RevenueAnalytics {
  totalRevenue: number;
  totalOrders: number;
  averageOrderValue: number;
  revenueByPaymentMethod: Record<string, number>;
  revenueByProduct: Record<string, number>;
  dailyRevenue: SalesTrend[];
  weeklyRevenue: SalesTrend[];
  monthlyRevenue: SalesTrend[];
}

/**
 * Get user profile
 */
export async function getUserProfile(userId: number): Promise<UserProfile> {
  try {
    const userOrders = await db.query.orders.findMany({
      where: eq(orders.customerId, userId),
    });

    const totalOrders = userOrders.length;
    const totalSpent = userOrders.reduce((sum, o) => sum + o.totalAmount, 0);
    const averageOrderValue = totalOrders > 0 ? totalSpent / totalOrders : 0;

    // Get preferred products
    const items = await db.query.orderItems.findMany({
      where: eq(orderItems.orderId, userOrders[0]?.id || -1),
    });

    const productMap = new Map<number, number>();
    for (const order of userOrders) {
      const orderItems = await db.query.orderItems.findMany({
        where: eq(orderItems.orderId, order.id),
      });
      
      for (const item of orderItems) {
        productMap.set(item.productId, (productMap.get(item.productId) || 0) + item.quantity);
      }
    }

    const preferredProducts = Array.from(productMap.entries())
      .map(([productId, count]) => ({ productId, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Determine segmentation
    let segmentation: 'vip' | 'regular' | 'occasional' | 'inactive' = 'inactive';
    if (totalOrders >= 10) {
      segmentation = 'vip';
    } else if (totalOrders >= 5) {
      segmentation = 'regular';
    } else if (totalOrders >= 1) {
      segmentation = 'occasional';
    }

    return {
      userId,
      totalOrders,
      totalSpent,
      averageOrderValue,
      lastOrderDate: userOrders[0]?.createdAt,
      preferredProducts,
      customerLifetimeValue: totalSpent,
      segmentation,
    };
  } catch (error) {
    console.error('[Analytics] Failed to get user profile:', error);
    throw error;
  }
}

/**
 * Get sales trends
 */
export async function getSalesTrends(
  startDate: Date,
  endDate: Date,
  granularity: 'daily' | 'weekly' | 'monthly' = 'daily'
): Promise<SalesTrend[]> {
  try {
    const allOrders = await db.query.orders.findMany({
      where: and(
        gte(orders.createdAt, startDate),
        lte(orders.createdAt, endDate)
      ),
    });

    const trends = new Map<string, SalesTrend>();

    for (const order of allOrders) {
      let dateKey: string;

      if (granularity === 'daily') {
        dateKey = order.createdAt.toISOString().split('T')[0];
      } else if (granularity === 'weekly') {
        const date = new Date(order.createdAt);
        const weekStart = new Date(date.setDate(date.getDate() - date.getDay()));
        dateKey = weekStart.toISOString().split('T')[0];
      } else {
        dateKey = order.createdAt.toISOString().slice(0, 7);
      }

      if (!trends.has(dateKey)) {
        trends.set(dateKey, {
          date: dateKey,
          totalSales: 0,
          orderCount: 0,
          averageOrderValue: 0,
          revenue: 0,
        });
      }

      const trend = trends.get(dateKey)!;
      trend.orderCount++;
      trend.revenue += order.totalAmount;
    }

    // Calculate averages
    const result = Array.from(trends.values()).map(trend => ({
      ...trend,
      totalSales: trend.orderCount,
      averageOrderValue: trend.orderCount > 0 ? trend.revenue / trend.orderCount : 0,
    }));

    return result.sort((a, b) => a.date.localeCompare(b.date));
  } catch (error) {
    console.error('[Analytics] Failed to get sales trends:', error);
    throw error;
  }
}

/**
 * Get product popularity
 */
export async function getProductPopularity(limit: number = 10): Promise<ProductPopularity[]> {
  try {
    const allProducts = await db.query.products.findMany();
    const allOrderItems = await db.query.orderItems.findMany();

    const productStats = new Map<number, { sold: number; revenue: number }>();

    for (const item of allOrderItems) {
      if (!productStats.has(item.productId)) {
        productStats.set(item.productId, { sold: 0, revenue: 0 });
      }

      const stats = productStats.get(item.productId)!;
      stats.sold += item.quantity;
      stats.revenue += item.totalPrice;
    }

    const maxSold = Math.max(...Array.from(productStats.values()).map(s => s.sold), 1);

    const popularity = allProducts
      .map(product => {
        const stats = productStats.get(product.id) || { sold: 0, revenue: 0 };
        const popularityScore = (stats.sold / maxSold) * 100;

        return {
          productId: product.id,
          productName: product.name,
          totalSold: stats.sold,
          totalRevenue: stats.revenue,
          averagePrice: stats.sold > 0 ? stats.revenue / stats.sold : product.price,
          popularity: Math.round(popularityScore),
          trend: 'stable' as const, // Would need historical data for real trend
        };
      })
      .sort((a, b) => b.popularity - a.popularity)
      .slice(0, limit);

    return popularity;
  } catch (error) {
    console.error('[Analytics] Failed to get product popularity:', error);
    throw error;
  }
}

/**
 * Get payment method analysis
 */
export async function getPaymentMethodAnalysis(): Promise<PaymentMethodAnalysis[]> {
  try {
    const allOrders = await db.query.orders.findMany();
    const allTransactions = await db.query.transactions.findMany();

    const methodStats = new Map<string, {
      transactions: number;
      amount: number;
      successful: number;
    }>();

    for (const order of allOrders) {
      const method = order.paymentMethod || 'unknown';

      if (!methodStats.has(method)) {
        methodStats.set(method, { transactions: 0, amount: 0, successful: 0 });
      }

      const stats = methodStats.get(method)!;
      stats.transactions++;
      stats.amount += order.totalAmount;

      if (order.paymentStatus === 'captured') {
        stats.successful++;
      }
    }

    const totalTransactions = Array.from(methodStats.values()).reduce(
      (sum, s) => sum + s.transactions,
      0
    );

    const analysis = Array.from(methodStats.entries()).map(([method, stats]) => ({
      method,
      totalTransactions: stats.transactions,
      totalAmount: stats.amount,
      averageAmount: stats.transactions > 0 ? stats.amount / stats.transactions : 0,
      successRate: stats.transactions > 0 ? (stats.successful / stats.transactions) * 100 : 0,
      usagePercentage: totalTransactions > 0 ? (stats.transactions / totalTransactions) * 100 : 0,
    }));

    return analysis.sort((a, b) => b.totalTransactions - a.totalTransactions);
  } catch (error) {
    console.error('[Analytics] Failed to get payment method analysis:', error);
    throw error;
  }
}

/**
 * Get revenue analytics
 */
export async function getRevenueAnalytics(merchantId: number): Promise<RevenueAnalytics> {
  try {
    const merchantOrders = await db.query.orders.findMany({
      where: eq(orders.merchantId, merchantId),
    });

    const totalRevenue = merchantOrders.reduce((sum, o) => sum + o.totalAmount, 0);
    const totalOrders = merchantOrders.length;
    const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    // Revenue by payment method
    const revenueByPaymentMethod: Record<string, number> = {};
    for (const order of merchantOrders) {
      const method = order.paymentMethod || 'unknown';
      revenueByPaymentMethod[method] = (revenueByPaymentMethod[method] || 0) + order.totalAmount;
    }

    // Revenue by product
    const revenueByProduct: Record<string, number> = {};
    for (const order of merchantOrders) {
      const items = await db.query.orderItems.findMany({
        where: eq(orderItems.orderId, order.id),
      });

      for (const item of items) {
        revenueByProduct[item.productName] = (revenueByProduct[item.productName] || 0) + item.totalPrice;
      }
    }

    // Daily, weekly, monthly revenue
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const dailyRevenue = await getSalesTrends(thirtyDaysAgo, now, 'daily');
    const weeklyRevenue = await getSalesTrends(thirtyDaysAgo, now, 'weekly');
    const monthlyRevenue = await getSalesTrends(new Date(now.getFullYear(), 0, 1), now, 'monthly');

    return {
      totalRevenue,
      totalOrders,
      averageOrderValue,
      revenueByPaymentMethod,
      revenueByProduct,
      dailyRevenue,
      weeklyRevenue,
      monthlyRevenue,
    };
  } catch (error) {
    console.error('[Analytics] Failed to get revenue analytics:', error);
    throw error;
  }
}

/**
 * Get customer segmentation
 */
export async function getCustomerSegmentation(): Promise<{
  vip: number;
  regular: number;
  occasional: number;
  inactive: number;
}> {
  try {
    const allUsers = await db.query.users.findMany();

    const segmentation = {
      vip: 0,
      regular: 0,
      occasional: 0,
      inactive: 0,
    };

    for (const user of allUsers) {
      const profile = await getUserProfile(user.id);
      segmentation[profile.segmentation]++;
    }

    return segmentation;
  } catch (error) {
    console.error('[Analytics] Failed to get customer segmentation:', error);
    throw error;
  }
}

/**
 * Get top customers
 */
export async function getTopCustomers(limit: number = 10): Promise<UserProfile[]> {
  try {
    const allUsers = await db.query.users.findMany();

    const profiles = await Promise.all(
      allUsers.map(user => getUserProfile(user.id))
    );

    return profiles
      .sort((a, b) => b.customerLifetimeValue - a.customerLifetimeValue)
      .slice(0, limit);
  } catch (error) {
    console.error('[Analytics] Failed to get top customers:', error);
    throw error;
  }
}

/**
 * Get growth metrics
 */
export async function getGrowthMetrics(days: number = 30): Promise<{
  newUsers: number;
  newOrders: number;
  revenueGrowth: number;
  orderGrowth: number;
}> {
  try {
    const now = new Date();
    const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    const midDate = new Date(now.getTime() - (days / 2) * 24 * 60 * 60 * 1000);

    // New users in period
    const newUsers = (await db.query.users.findMany()).filter(
      u => u.createdAt >= startDate
    ).length;

    // Orders in period
    const allOrders = await db.query.orders.findMany();
    const ordersInPeriod = allOrders.filter(o => o.createdAt >= startDate);
    const ordersBeforeMid = ordersInPeriod.filter(o => o.createdAt < midDate);
    const ordersAfterMid = ordersInPeriod.filter(o => o.createdAt >= midDate);

    const revenueBeforeMid = ordersBeforeMid.reduce((sum, o) => sum + o.totalAmount, 0);
    const revenueAfterMid = ordersAfterMid.reduce((sum, o) => sum + o.totalAmount, 0);

    const revenueGrowth = revenueBeforeMid > 0
      ? ((revenueAfterMid - revenueBeforeMid) / revenueBeforeMid) * 100
      : 0;

    const orderGrowth = ordersBeforeMid.length > 0
      ? ((ordersAfterMid.length - ordersBeforeMid.length) / ordersBeforeMid.length) * 100
      : 0;

    return {
      newUsers,
      newOrders: ordersInPeriod.length,
      revenueGrowth,
      orderGrowth,
    };
  } catch (error) {
    console.error('[Analytics] Failed to get growth metrics:', error);
    throw error;
  }
}
