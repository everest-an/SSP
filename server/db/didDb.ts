/**
 * DID Database Operations
 * 
 * Functions for managing DID-related database operations
 */

import { eq, and, desc } from "drizzle-orm";
import { getDb } from "../db";
import {
  didIdentities,
  didRecovery,
  didSessions,
  didTransactions,
  didAuditLogs,
  type DIDIdentity,
  type InsertDIDIdentity,
  type DIDRecovery,
  type InsertDIDRecovery,
  type DIDSession,
  type InsertDIDSession,
  type DIDTransaction,
  type InsertDIDTransaction,
  type DIDAuditLog,
  type InsertDIDAuditLog,
} from "../../drizzle/did_schema";

// ==================== DID Identities ====================

/**
 * Create a new DID identity
 */
export async function createDIDIdentity(identity: InsertDIDIdentity): Promise<DIDIdentity | null> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot create DID identity: database not available");
    return null;
  }

  try {
    const result = await db.insert(didIdentities).values(identity);
    const insertedId = result[0].insertId;

    // Fetch and return the created identity
    const created = await db
      .select()
      .from(didIdentities)
      .where(eq(didIdentities.id, insertedId))
      .limit(1);

    return created[0] || null;
  } catch (error) {
    console.error("[Database] Error creating DID identity:", error);
    throw error;
  }
}

/**
 * Get DID identity by ID
 */
export async function getDIDIdentityById(id: number): Promise<DIDIdentity | null> {
  const db = await getDb();
  if (!db) return null;

  try {
    const result = await db
      .select()
      .from(didIdentities)
      .where(eq(didIdentities.id, id))
      .limit(1);

    return result[0] || null;
  } catch (error) {
    console.error("[Database] Error getting DID identity by ID:", error);
    return null;
  }
}

/**
 * Get DID identity by user ID
 */
export async function getDIDIdentityByUserId(userId: number): Promise<DIDIdentity | null> {
  const db = await getDb();
  if (!db) return null;

  try {
    const result = await db
      .select()
      .from(didIdentities)
      .where(eq(didIdentities.userId, userId))
      .limit(1);

    return result[0] || null;
  } catch (error) {
    console.error("[Database] Error getting DID identity by user ID:", error);
    return null;
  }
}

/**
 * Get DID identity by DID
 */
export async function getDIDIdentityByDID(did: string): Promise<DIDIdentity | null> {
  const db = await getDb();
  if (!db) return null;

  try {
    const result = await db
      .select()
      .from(didIdentities)
      .where(eq(didIdentities.did, did))
      .limit(1);

    return result[0] || null;
  } catch (error) {
    console.error("[Database] Error getting DID identity by DID:", error);
    return null;
  }
}

/**
 * Get DID identity by Ethereum address
 */
export async function getDIDIdentityByEthAddress(ethAddress: string): Promise<DIDIdentity | null> {
  const db = await getDb();
  if (!db) return null;

  try {
    const result = await db
      .select()
      .from(didIdentities)
      .where(eq(didIdentities.ethAddress, ethAddress))
      .limit(1);

    return result[0] || null;
  } catch (error) {
    console.error("[Database] Error getting DID identity by ETH address:", error);
    return null;
  }
}

/**
 * Update DID identity
 */
export async function updateDIDIdentity(
  id: number,
  updates: Partial<InsertDIDIdentity>
): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  try {
    await db
      .update(didIdentities)
      .set(updates)
      .where(eq(didIdentities.id, id));

    return true;
  } catch (error) {
    console.error("[Database] Error updating DID identity:", error);
    return false;
  }
}

// ==================== DID Recovery ====================

/**
 * Create a new recovery record
 */
export async function createDIDRecovery(recovery: InsertDIDRecovery): Promise<DIDRecovery | null> {
  const db = await getDb();
  if (!db) return null;

  try {
    const result = await db.insert(didRecovery).values(recovery);
    const insertedId = result[0].insertId;

    const created = await db
      .select()
      .from(didRecovery)
      .where(eq(didRecovery.id, insertedId))
      .limit(1);

    return created[0] || null;
  } catch (error) {
    console.error("[Database] Error creating DID recovery:", error);
    throw error;
  }
}

/**
 * Get recovery records by DID identity ID
 */
export async function getDIDRecoveryByIdentityId(didIdentityId: number): Promise<DIDRecovery[]> {
  const db = await getDb();
  if (!db) return [];

  try {
    const result = await db
      .select()
      .from(didRecovery)
      .where(eq(didRecovery.didIdentityId, didIdentityId))
      .orderBy(desc(didRecovery.createdAt));

    return result;
  } catch (error) {
    console.error("[Database] Error getting DID recovery records:", error);
    return [];
  }
}

/**
 * Mark recovery as used
 */
export async function markDIDRecoveryAsUsed(id: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  try {
    await db
      .update(didRecovery)
      .set({ usedAt: new Date() })
      .where(eq(didRecovery.id, id));

    return true;
  } catch (error) {
    console.error("[Database] Error marking recovery as used:", error);
    return false;
  }
}

// ==================== DID Sessions ====================

/**
 * Create a new session
 */
export async function createDIDSession(session: InsertDIDSession): Promise<DIDSession | null> {
  const db = await getDb();
  if (!db) return null;

  try {
    const result = await db.insert(didSessions).values(session);
    const insertedId = result[0].insertId;

    const created = await db
      .select()
      .from(didSessions)
      .where(eq(didSessions.id, insertedId))
      .limit(1);

    return created[0] || null;
  } catch (error) {
    console.error("[Database] Error creating DID session:", error);
    throw error;
  }
}

/**
 * Get session by token
 */
export async function getDIDSessionByToken(sessionToken: string): Promise<DIDSession | null> {
  const db = await getDb();
  if (!db) return null;

  try {
    const result = await db
      .select()
      .from(didSessions)
      .where(eq(didSessions.sessionToken, sessionToken))
      .limit(1);

    return result[0] || null;
  } catch (error) {
    console.error("[Database] Error getting DID session:", error);
    return null;
  }
}

/**
 * Update session last activity
 */
export async function updateDIDSessionActivity(sessionToken: string): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  try {
    await db
      .update(didSessions)
      .set({ lastActivityAt: new Date() })
      .where(eq(didSessions.sessionToken, sessionToken));

    return true;
  } catch (error) {
    console.error("[Database] Error updating session activity:", error);
    return false;
  }
}

/**
 * Delete expired sessions
 */
export async function deleteExpiredDIDSessions(): Promise<number> {
  const db = await getDb();
  if (!db) return 0;

  try {
    const now = new Date();
    const result = await db
      .delete(didSessions)
      .where(eq(didSessions.expiresAt, now));

    return result[0].affectedRows || 0;
  } catch (error) {
    console.error("[Database] Error deleting expired sessions:", error);
    return 0;
  }
}

// ==================== DID Transactions ====================

/**
 * Create a new transaction record
 */
export async function createDIDTransaction(
  transaction: InsertDIDTransaction
): Promise<DIDTransaction | null> {
  const db = await getDb();
  if (!db) return null;

  try {
    const result = await db.insert(didTransactions).values(transaction);
    const insertedId = result[0].insertId;

    const created = await db
      .select()
      .from(didTransactions)
      .where(eq(didTransactions.id, insertedId))
      .limit(1);

    return created[0] || null;
  } catch (error) {
    console.error("[Database] Error creating DID transaction:", error);
    throw error;
  }
}

/**
 * Get transactions by DID identity ID
 */
export async function getDIDTransactionsByIdentityId(
  didIdentityId: number,
  limit: number = 50
): Promise<DIDTransaction[]> {
  const db = await getDb();
  if (!db) return [];

  try {
    const result = await db
      .select()
      .from(didTransactions)
      .where(eq(didTransactions.didIdentityId, didIdentityId))
      .orderBy(desc(didTransactions.createdAt))
      .limit(limit);

    return result;
  } catch (error) {
    console.error("[Database] Error getting DID transactions:", error);
    return [];
  }
}

/**
 * Update transaction status
 */
export async function updateDIDTransactionStatus(
  id: number,
  status: "pending" | "confirmed" | "failed",
  confirmedAt?: Date
): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  try {
    const updates: any = { status };
    if (confirmedAt) {
      updates.confirmedAt = confirmedAt;
    }

    await db
      .update(didTransactions)
      .set(updates)
      .where(eq(didTransactions.id, id));

    return true;
  } catch (error) {
    console.error("[Database] Error updating transaction status:", error);
    return false;
  }
}

// ==================== DID Audit Logs ====================

/**
 * Create a new audit log
 */
export async function createDIDAuditLog(log: InsertDIDAuditLog): Promise<DIDAuditLog | null> {
  const db = await getDb();
  if (!db) return null;

  try {
    const result = await db.insert(didAuditLogs).values(log);
    const insertedId = result[0].insertId;

    const created = await db
      .select()
      .from(didAuditLogs)
      .where(eq(didAuditLogs.id, insertedId))
      .limit(1);

    return created[0] || null;
  } catch (error) {
    console.error("[Database] Error creating DID audit log:", error);
    throw error;
  }
}

/**
 * Get audit logs by DID identity ID
 */
export async function getDIDAuditLogsByIdentityId(
  didIdentityId: number,
  limit: number = 100
): Promise<DIDAuditLog[]> {
  const db = await getDb();
  if (!db) return [];

  try {
    const result = await db
      .select()
      .from(didAuditLogs)
      .where(eq(didAuditLogs.didIdentityId, didIdentityId))
      .orderBy(desc(didAuditLogs.createdAt))
      .limit(limit);

    return result;
  } catch (error) {
    console.error("[Database] Error getting DID audit logs:", error);
    return [];
  }
}
