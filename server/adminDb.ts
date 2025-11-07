import { eq, desc, and, gte, lte, like, sql } from "drizzle-orm";
import { getDb } from "./db";
import { users, faceRecognition, wallets, walletTransactions, orders, transactions, merchants, devices, products } from "../drizzle/schema";

/**
 * Admin database helper functions for backend management
 */

// ============ User Management ============

export async function getAllUsers(limit: number = 100) {
  const db = await getDb();
  if (!db) return [];
  
  return db
    .select()
    .from(users)
    .orderBy(desc(users.createdAt))
    .limit(limit);
}

export async function searchUsers(query: string, limit: number = 50) {
  const db = await getDb();
  if (!db) return [];
  
  return db
    .select()
    .from(users)
    .where(
      sql`${users.name} LIKE ${`%${query}%`} OR ${users.email} LIKE ${`%${query}%`}`
    )
    .orderBy(desc(users.createdAt))
    .limit(limit);
}

export async function getUserWithDetails(userId: number) {
  const db = await getDb();
  if (!db) return null;
  
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  
  if (!user) return null;
  
  // Get user's face recognition data
  const [faceRec] = await db
    .select()
    .from(faceRecognition)
    .where(eq(faceRecognition.userId, userId))
    .limit(1);
  
  // Get user's wallets
  const userWallets = await db
    .select()
    .from(wallets)
    .where(eq(wallets.userId, userId));
  
  // Get user's orders
  const userOrders = await db
    .select()
    .from(orders)
    .where(eq(orders.customerId, userId))
    .orderBy(desc(orders.createdAt))
    .limit(10);
  
  return {
    user,
    faceRecognition: faceRec || null,
    wallets: userWallets,
    recentOrders: userOrders,
  };
}

export async function updateUserStatus(userId: number, role: "user" | "merchant" | "admin") {
  const db = await getDb();
  if (!db) return;
  
  await db
    .update(users)
    .set({ role })
    .where(eq(users.id, userId));
}

// ============ Transaction Management ============

export async function getAllTransactions(limit: number = 100) {
  const db = await getDb();
  if (!db) return [];
  
  return db
    .select({
      transaction: transactions,
      order: orders,
      merchant: merchants,
    })
    .from(transactions)
    .leftJoin(orders, eq(transactions.orderId, orders.id))
    .leftJoin(merchants, eq(orders.merchantId, merchants.id))
    .orderBy(desc(transactions.createdAt))
    .limit(limit);
}

export async function getTransactionsByDateRange(startDate: Date, endDate: Date, limit: number = 1000) {
  const db = await getDb();
  if (!db) return [];
  
  return db
    .select({
      transaction: transactions,
      order: orders,
      merchant: merchants,
    })
    .from(transactions)
    .leftJoin(orders, eq(transactions.orderId, orders.id))
    .leftJoin(merchants, eq(orders.merchantId, merchants.id))
    .where(
      and(
        gte(transactions.createdAt, startDate),
        lte(transactions.createdAt, endDate)
      )
    )
    .orderBy(desc(transactions.createdAt))
    .limit(limit);
}

export async function getTransactionStats(merchantId?: number) {
  const db = await getDb();
  if (!db) return null;
  
  const whereClause = merchantId 
    ? eq(orders.merchantId, merchantId)
    : undefined;
  
  const [stats] = await db
    .select({
      totalTransactions: sql<number>`COUNT(${transactions.id})`,
      totalAmount: sql<number>`SUM(${transactions.amount})`,
      successfulTransactions: sql<number>`SUM(CASE WHEN ${transactions.status} = 'success' THEN 1 ELSE 0 END)`,
      failedTransactions: sql<number>`SUM(CASE WHEN ${transactions.status} = 'failed' THEN 1 ELSE 0 END)`,
      avgTransactionAmount: sql<number>`AVG(${transactions.amount})`,
    })
    .from(transactions)
    .leftJoin(orders, eq(transactions.orderId, orders.id))
    .where(whereClause);
  
  return stats;
}

export async function searchTransactions(params: {
  status?: string;
  minAmount?: number;
  maxAmount?: number;
  merchantId?: number;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
}) {
  const db = await getDb();
  if (!db) return [];
  
  const conditions = [];
  
  if (params.status) {
    conditions.push(eq(transactions.status, params.status as any));
  }
  
  if (params.minAmount !== undefined) {
    conditions.push(gte(transactions.amount, params.minAmount));
  }
  
  if (params.maxAmount !== undefined) {
    conditions.push(lte(transactions.amount, params.maxAmount));
  }
  
  if (params.merchantId) {
    conditions.push(eq(orders.merchantId, params.merchantId));
  }
  
  if (params.startDate) {
    conditions.push(gte(transactions.createdAt, params.startDate));
  }
  
  if (params.endDate) {
    conditions.push(lte(transactions.createdAt, params.endDate));
  }
  
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
  
  return db
    .select({
      transaction: transactions,
      order: orders,
      merchant: merchants,
    })
    .from(transactions)
    .leftJoin(orders, eq(transactions.orderId, orders.id))
    .leftJoin(merchants, eq(orders.merchantId, merchants.id))
    .where(whereClause)
    .orderBy(desc(transactions.createdAt))
    .limit(params.limit || 100);
}

// ============ Merchant Management ============

export async function getAllMerchantsWithStats() {
  const db = await getDb();
  if (!db) return [];
  
  const merchantsList = await db
    .select()
    .from(merchants)
    .orderBy(desc(merchants.createdAt));
  
  // Get stats for each merchant
  const merchantsWithStats = await Promise.all(
    merchantsList.map(async (merchant) => {
      const [orderStats] = await db
        .select({
          totalOrders: sql<number>`COUNT(${orders.id})`,
          totalRevenue: sql<number>`SUM(${orders.totalAmount})`,
          completedOrders: sql<number>`SUM(CASE WHEN ${orders.status} = 'completed' THEN 1 ELSE 0 END)`,
        })
        .from(orders)
        .where(eq(orders.merchantId, merchant.id));
      
      const deviceCount = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(devices)
        .where(eq(devices.merchantId, merchant.id));
      
      const productCount = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(products)
        .where(eq(products.merchantId, merchant.id));
      
      return {
        ...merchant,
        stats: {
          totalOrders: orderStats?.totalOrders || 0,
          totalRevenue: orderStats?.totalRevenue || 0,
          completedOrders: orderStats?.completedOrders || 0,
          deviceCount: deviceCount[0]?.count || 0,
          productCount: productCount[0]?.count || 0,
        },
      };
    })
  );
  
  return merchantsWithStats;
}

export async function getMerchantDetailedStats(merchantId: number) {
  const db = await getDb();
  if (!db) return null;
  
  const [merchant] = await db
    .select()
    .from(merchants)
    .where(eq(merchants.id, merchantId))
    .limit(1);
  
  if (!merchant) return null;
  
  // Get order stats
  const [orderStats] = await db
    .select({
      totalOrders: sql<number>`COUNT(${orders.id})`,
      totalRevenue: sql<number>`SUM(${orders.totalAmount})`,
      completedOrders: sql<number>`SUM(CASE WHEN ${orders.status} = 'completed' THEN 1 ELSE 0 END)`,
      pendingOrders: sql<number>`SUM(CASE WHEN ${orders.status} = 'pending' THEN 1 ELSE 0 END)`,
      avgOrderValue: sql<number>`AVG(${orders.totalAmount})`,
    })
    .from(orders)
    .where(eq(orders.merchantId, merchantId));
  
  // Get devices
  const merchantDevices = await db
    .select()
    .from(devices)
    .where(eq(devices.merchantId, merchantId));
  
  // Get products
  const merchantProducts = await db
    .select()
    .from(products)
    .where(eq(products.merchantId, merchantId));
  
  // Get recent orders
  const recentOrders = await db
    .select()
    .from(orders)
    .where(eq(orders.merchantId, merchantId))
    .orderBy(desc(orders.createdAt))
    .limit(10);
  
  return {
    merchant,
    stats: orderStats,
    devices: merchantDevices,
    products: merchantProducts,
    recentOrders,
  };
}

// ============ Wallet Management ============

export async function getAllWalletsWithUsers(limit: number = 100) {
  const db = await getDb();
  if (!db) return [];
  
  return db
    .select({
      wallet: wallets,
      user: users,
    })
    .from(wallets)
    .leftJoin(users, eq(wallets.userId, users.id))
    .orderBy(desc(wallets.createdAt))
    .limit(limit);
}

export async function getWalletTransactionHistory(walletId: number, limit: number = 50) {
  const db = await getDb();
  if (!db) return [];
  
  return db
    .select()
    .from(walletTransactions)
    .where(eq(walletTransactions.walletId, walletId))
    .orderBy(desc(walletTransactions.createdAt))
    .limit(limit);
}

// ============ Analytics ============

export async function getDailyStats(days: number = 30) {
  const db = await getDb();
  if (!db) return [];
  
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  return db
    .select({
      date: sql<string>`DATE(${orders.createdAt})`,
      orderCount: sql<number>`COUNT(${orders.id})`,
      revenue: sql<number>`SUM(${orders.totalAmount})`,
      avgOrderValue: sql<number>`AVG(${orders.totalAmount})`,
    })
    .from(orders)
    .where(gte(orders.createdAt, startDate))
    .groupBy(sql`DATE(${orders.createdAt})`)
    .orderBy(sql`DATE(${orders.createdAt})`);
}

export async function getTopProducts(limit: number = 10) {
  const db = await getDb();
  if (!db) return [];
  
  // This would require orderItems table join
  // For now, return top products by stock (placeholder)
  return db
    .select()
    .from(products)
    .where(eq(products.status, "active"))
    .orderBy(desc(products.stock))
    .limit(limit);
}

export async function getUserGrowthStats(days: number = 30) {
  const db = await getDb();
  if (!db) return [];
  
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  return db
    .select({
      date: sql<string>`DATE(${users.createdAt})`,
      newUsers: sql<number>`COUNT(${users.id})`,
    })
    .from(users)
    .where(gte(users.createdAt, startDate))
    .groupBy(sql`DATE(${users.createdAt})`)
    .orderBy(sql`DATE(${users.createdAt})`);
}
