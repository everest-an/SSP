import { eq, desc, and, gte, lte, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser,
  users,
  merchants,
  products,
  devices,
  orders,
  orderItems,
  transactions,
  detectionEvents,
  analytics,
  auditLogs,
  type Merchant,
  type InsertMerchant,
  type Product,
  type InsertProduct,
  type Device,
  type InsertDevice,
  type Order,
  type InsertOrder,
  type OrderItem,
  type InsertOrderItem,
  type Transaction,
  type InsertTransaction,
  type DetectionEvent,
  type InsertDetectionEvent,
  type Analytics,
  type InsertAnalytics,
  type AuditLog,
  type InsertAuditLog,
} from "../drizzle/schema";
import { ENV } from './_core/env';

// Initialize database connection synchronously for imports
let _db: ReturnType<typeof drizzle> | null = null;

if (process.env.DATABASE_URL) {
  try {
    _db = drizzle(process.env.DATABASE_URL);
  } catch (error) {
    console.warn("[Database] Failed to connect:", error);
    _db = null;
  }
}

// Export db for synchronous imports (used by facial auth services)
export const db = _db!;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ==================== User Management ====================

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ==================== Merchant Management ====================

export async function createMerchant(merchant: InsertMerchant): Promise<Merchant> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(merchants).values(merchant);
  const insertedId = Number(result[0].insertId);
  
  const created = await db.select().from(merchants).where(eq(merchants.id, insertedId)).limit(1);
  return created[0];
}

export async function getMerchantById(id: number): Promise<Merchant | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(merchants).where(eq(merchants.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getMerchantsByUserId(userId: number): Promise<Merchant[]> {
  const db = await getDb();
  if (!db) return [];

  return db.select().from(merchants).where(eq(merchants.userId, userId));
}

export async function getAllMerchants(): Promise<Merchant[]> {
  const db = await getDb();
  if (!db) return [];

  return db.select().from(merchants).orderBy(desc(merchants.createdAt));
}

export async function updateMerchant(id: number, data: Partial<InsertMerchant>): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(merchants).set(data).where(eq(merchants.id, id));
}

// ==================== Product Management ====================

export async function createProduct(product: InsertProduct): Promise<Product> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(products).values(product);
  const insertedId = Number(result[0].insertId);
  
  const created = await db.select().from(products).where(eq(products.id, insertedId)).limit(1);
  return created[0];
}

export async function getProductById(id: number): Promise<Product | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(products).where(eq(products.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getProductsByMerchantId(merchantId: number): Promise<Product[]> {
  const db = await getDb();
  if (!db) return [];

  return db.select().from(products).where(eq(products.merchantId, merchantId)).orderBy(desc(products.createdAt));
}

export async function updateProduct(id: number, data: Partial<InsertProduct>): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(products).set(data).where(eq(products.id, id));
}

export async function deleteProduct(id: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.delete(products).where(eq(products.id, id));
}

// ==================== Device Management ====================

export async function createDevice(device: InsertDevice): Promise<Device> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(devices).values(device);
  const insertedId = Number(result[0].insertId);
  
  const created = await db.select().from(devices).where(eq(devices.id, insertedId)).limit(1);
  return created[0];
}

export async function getDeviceById(id: number): Promise<Device | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(devices).where(eq(devices.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getDevicesByMerchantId(merchantId: number): Promise<Device[]> {
  const db = await getDb();
  if (!db) return [];

  return db.select().from(devices).where(eq(devices.merchantId, merchantId)).orderBy(desc(devices.createdAt));
}

export async function updateDevice(id: number, data: Partial<InsertDevice>): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(devices).set(data).where(eq(devices.id, id));
}

export async function updateDeviceHeartbeat(deviceId: string): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(devices).set({
    lastHeartbeat: new Date(),
    status: "online"
  }).where(eq(devices.deviceId, deviceId));
}

// ==================== Order Management ====================

export async function createOrder(order: InsertOrder): Promise<Order> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(orders).values(order);
  const insertedId = Number(result[0].insertId);
  
  const created = await db.select().from(orders).where(eq(orders.id, insertedId)).limit(1);
  return created[0];
}

export async function getOrderById(id: number): Promise<Order | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getOrdersByMerchantId(merchantId: number, limit = 100): Promise<Order[]> {
  const db = await getDb();
  if (!db) return [];

  return db.select().from(orders)
    .where(eq(orders.merchantId, merchantId))
    .orderBy(desc(orders.createdAt))
    .limit(limit);
}

export async function updateOrder(id: number, data: Partial<InsertOrder>): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(orders).set(data).where(eq(orders.id, id));
}

// ==================== Order Items Management ====================

export async function createOrderItem(item: InsertOrderItem): Promise<OrderItem> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(orderItems).values(item);
  const insertedId = Number(result[0].insertId);
  
  const created = await db.select().from(orderItems).where(eq(orderItems.id, insertedId)).limit(1);
  return created[0];
}

export async function getOrderItemsByOrderId(orderId: number): Promise<OrderItem[]> {
  const db = await getDb();
  if (!db) return [];

  return db.select().from(orderItems).where(eq(orderItems.orderId, orderId));
}

// ==================== Transaction Management ====================

export async function createTransaction(transaction: InsertTransaction): Promise<Transaction> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(transactions).values(transaction);
  const insertedId = Number(result[0].insertId);
  
  const created = await db.select().from(transactions).where(eq(transactions.id, insertedId)).limit(1);
  return created[0];
}

export async function getTransactionsByOrderId(orderId: number): Promise<Transaction[]> {
  const db = await getDb();
  if (!db) return [];

  return db.select().from(transactions).where(eq(transactions.orderId, orderId));
}

export async function updateTransaction(id: number, data: Partial<InsertTransaction>): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(transactions).set(data).where(eq(transactions.id, id));
}

// ==================== Detection Events ====================

export async function createDetectionEvent(event: InsertDetectionEvent): Promise<DetectionEvent> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(detectionEvents).values(event);
  const insertedId = Number(result[0].insertId);
  
  const created = await db.select().from(detectionEvents).where(eq(detectionEvents.id, insertedId)).limit(1);
  return created[0];
}

export async function getDetectionEventsByDeviceId(deviceId: number, limit = 100): Promise<DetectionEvent[]> {
  const db = await getDb();
  if (!db) return [];

  return db.select().from(detectionEvents)
    .where(eq(detectionEvents.deviceId, deviceId))
    .orderBy(desc(detectionEvents.createdAt))
    .limit(limit);
}

// ==================== Analytics ====================

export async function createAnalytics(data: InsertAnalytics): Promise<Analytics> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(analytics).values(data);
  const insertedId = Number(result[0].insertId);
  
  const created = await db.select().from(analytics).where(eq(analytics.id, insertedId)).limit(1);
  return created[0];
}

export async function getAnalyticsByMerchantId(
  merchantId: number,
  startDate: Date,
  endDate: Date
): Promise<Analytics[]> {
  const db = await getDb();
  if (!db) return [];

  return db.select().from(analytics)
    .where(
      and(
        eq(analytics.merchantId, merchantId),
        gte(analytics.date, startDate),
        lte(analytics.date, endDate)
      )
    )
    .orderBy(desc(analytics.date));
}

// ==================== Audit Logs ====================

export async function createAuditLog(log: InsertAuditLog): Promise<AuditLog> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(auditLogs).values(log);
  const insertedId = Number(result[0].insertId);
  
  const created = await db.select().from(auditLogs).where(eq(auditLogs.id, insertedId)).limit(1);
  return created[0];
}

export async function getAuditLogsByUserId(userId: number, limit = 100): Promise<AuditLog[]> {
  const db = await getDb();
  if (!db) return [];

  return db.select().from(auditLogs)
    .where(eq(auditLogs.userId, userId))
    .orderBy(desc(auditLogs.createdAt))
    .limit(limit);
}

// ==================== Dashboard Statistics ====================

export async function getDashboardStats(merchantId: number) {
  const db = await getDb();
  if (!db) return null;

  // Get today's date range
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // Total orders
  const totalOrders = await db.select({ count: sql<number>`count(*)` })
    .from(orders)
    .where(eq(orders.merchantId, merchantId));

  // Today's orders
  const todayOrders = await db.select({ count: sql<number>`count(*)` })
    .from(orders)
    .where(
      and(
        eq(orders.merchantId, merchantId),
        gte(orders.createdAt, today),
        lte(orders.createdAt, tomorrow)
      )
    );

  // Total revenue (completed orders only)
  const totalRevenue = await db.select({ sum: sql<number>`COALESCE(sum(totalAmount), 0)` })
    .from(orders)
    .where(
      and(
        eq(orders.merchantId, merchantId),
        eq(orders.status, "completed")
      )
    );

  // Active devices
  const activeDevices = await db.select({ count: sql<number>`count(*)` })
    .from(devices)
    .where(
      and(
        eq(devices.merchantId, merchantId),
        eq(devices.status, "online")
      )
    );

  // Total products
  const totalProducts = await db.select({ count: sql<number>`count(*)` })
    .from(products)
    .where(eq(products.merchantId, merchantId));

  return {
    totalOrders: Number(totalOrders[0]?.count || 0),
    todayOrders: Number(todayOrders[0]?.count || 0),
    totalRevenue: Number(totalRevenue[0]?.sum || 0),
    activeDevices: Number(activeDevices[0]?.count || 0),
    totalProducts: Number(totalProducts[0]?.count || 0),
  };
}
