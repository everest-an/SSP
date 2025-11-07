import { eq, and, desc } from "drizzle-orm";
import { getDb } from "./db";
import {
  faceRecognition,
  FaceRecognition,
  InsertFaceRecognition,
  wallets,
  Wallet,
  InsertWallet,
  walletTransactions,
  WalletTransaction,
  InsertWalletTransaction,
  gestureEvents,
  GestureEvent,
  InsertGestureEvent,
  deviceProducts,
  DeviceProduct,
  InsertDeviceProduct,
} from "../drizzle/schema";

// ==================== Face Recognition ====================

export async function createFaceRecognition(data: InsertFaceRecognition): Promise<FaceRecognition> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(faceRecognition).values(data);
  const insertedId = Number(result[0].insertId);
  
  const created = await db.select().from(faceRecognition).where(eq(faceRecognition.id, insertedId)).limit(1);
  return created[0];
}

export async function getFaceRecognitionByUserId(userId: number): Promise<FaceRecognition | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(faceRecognition)
    .where(and(eq(faceRecognition.userId, userId), eq(faceRecognition.isActive, 1)))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateFaceRecognition(id: number, data: Partial<InsertFaceRecognition>): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(faceRecognition).set(data).where(eq(faceRecognition.id, id));
}

export async function deactivateFaceRecognition(userId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(faceRecognition).set({ isActive: 0 }).where(eq(faceRecognition.userId, userId));
}

// ==================== Wallet Management ====================

export async function createWallet(data: InsertWallet): Promise<Wallet> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(wallets).values(data);
  const insertedId = Number(result[0].insertId);
  
  const created = await db.select().from(wallets).where(eq(wallets.id, insertedId)).limit(1);
  return created[0];
}

export async function getWalletsByUserId(userId: number): Promise<Wallet[]> {
  const db = await getDb();
  if (!db) return [];

  return db.select().from(wallets)
    .where(eq(wallets.userId, userId))
    .orderBy(desc(wallets.isDefault), desc(wallets.createdAt));
}

export async function getWalletById(id: number): Promise<Wallet | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(wallets).where(eq(wallets.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getDefaultWallet(userId: number): Promise<Wallet | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(wallets)
    .where(and(eq(wallets.userId, userId), eq(wallets.isDefault, 1)))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateWallet(id: number, data: Partial<InsertWallet>): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(wallets).set(data).where(eq(wallets.id, id));
}

export async function updateWalletBalance(id: number, amount: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const wallet = await getWalletById(id);
  if (!wallet) throw new Error("Wallet not found");

  const newBalance = wallet.balance + amount;
  if (newBalance < 0) throw new Error("Insufficient balance");

  await db.update(wallets).set({ balance: newBalance }).where(eq(wallets.id, id));
}

// ==================== Wallet Transactions ====================

export async function createWalletTransaction(data: InsertWalletTransaction): Promise<WalletTransaction> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(walletTransactions).values(data);
  const insertedId = Number(result[0].insertId);
  
  const created = await db.select().from(walletTransactions).where(eq(walletTransactions.id, insertedId)).limit(1);
  return created[0];
}

export async function getWalletTransactions(walletId: number, limit = 50): Promise<WalletTransaction[]> {
  const db = await getDb();
  if (!db) return [];

  return db.select().from(walletTransactions)
    .where(eq(walletTransactions.walletId, walletId))
    .orderBy(desc(walletTransactions.createdAt))
    .limit(limit);
}

export async function updateWalletTransaction(id: number, data: Partial<InsertWalletTransaction>): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(walletTransactions).set(data).where(eq(walletTransactions.id, id));
}

// ==================== Gesture Events ====================

export async function createGestureEvent(data: InsertGestureEvent): Promise<GestureEvent> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(gestureEvents).values(data);
  const insertedId = Number(result[0].insertId);
  
  const created = await db.select().from(gestureEvents).where(eq(gestureEvents.id, insertedId)).limit(1);
  return created[0];
}

export async function getGestureEventsByDevice(deviceId: number, limit = 100): Promise<GestureEvent[]> {
  const db = await getDb();
  if (!db) return [];

  return db.select().from(gestureEvents)
    .where(eq(gestureEvents.deviceId, deviceId))
    .orderBy(desc(gestureEvents.createdAt))
    .limit(limit);
}

export async function getRecentGestureEvents(deviceId: number, minutes = 5): Promise<GestureEvent[]> {
  const db = await getDb();
  if (!db) return [];

  const cutoffTime = new Date(Date.now() - minutes * 60 * 1000);
  
  return db.select().from(gestureEvents)
    .where(eq(gestureEvents.deviceId, deviceId))
    .orderBy(desc(gestureEvents.createdAt));
}

// ==================== Device Products ====================

export async function addProductToDevice(data: InsertDeviceProduct): Promise<DeviceProduct> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(deviceProducts).values(data);
  const insertedId = Number(result[0].insertId);
  
  const created = await db.select().from(deviceProducts).where(eq(deviceProducts.id, insertedId)).limit(1);
  return created[0];
}

export async function getDeviceProducts(deviceId: number): Promise<DeviceProduct[]> {
  const db = await getDb();
  if (!db) return [];

  return db.select().from(deviceProducts)
    .where(and(eq(deviceProducts.deviceId, deviceId), eq(deviceProducts.isActive, 1)))
    .orderBy(desc(deviceProducts.displayOrder));
}

export async function removeProductFromDevice(deviceId: number, productId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(deviceProducts)
    .set({ isActive: 0 })
    .where(and(eq(deviceProducts.deviceId, deviceId), eq(deviceProducts.productId, productId)));
}

export async function isProductAvailableOnDevice(deviceId: number, productId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  const result = await db.select().from(deviceProducts)
    .where(and(
      eq(deviceProducts.deviceId, deviceId),
      eq(deviceProducts.productId, productId),
      eq(deviceProducts.isActive, 1)
    ))
    .limit(1);
  
  return result.length > 0;
}
