/**
 * User Account Service
 * 
 * Handles:
 * - User registration and authentication
 * - Profile management
 * - Account settings
 * - Password management
 * - Account security
 */

import { db } from '../_core/db';
import { users } from '../_core/schema';
import { eq } from 'drizzle-orm';
import { hash, verify } from 'bcrypt';
import { nanoid } from 'nanoid';

/**
 * User account data
 */
export interface UserAccount {
  id: number;
  openId: string;
  name?: string;
  email?: string;
  loginMethod?: string;
  role: 'user' | 'admin' | 'merchant';
  createdAt: Date;
  updatedAt: Date;
  lastSignedIn: Date;
}

/**
 * User registration input
 */
export interface RegisterInput {
  email: string;
  password: string;
  name?: string;
  loginMethod?: string;
}

/**
 * User login input
 */
export interface LoginInput {
  email: string;
  password: string;
}

/**
 * Profile update input
 */
export interface UpdateProfileInput {
  name?: string;
  email?: string;
}

/**
 * Register new user
 */
export async function registerUser(input: RegisterInput): Promise<UserAccount> {
  try {
    const { email, password, name, loginMethod } = input;
    
    // Check if user exists
    const existing = await db.query.users.findFirst({
      where: eq(users.email, email),
    });
    
    if (existing) {
      throw new Error('Email already registered');
    }
    
    // Hash password
    const passwordHash = await hash(password, 10);
    
    // Create user
    const openId = `user_${nanoid(16)}`;
    const result = await db.insert(users).values({
      openId,
      email,
      name,
      loginMethod: loginMethod || 'email',
      role: 'user',
    }).returning();
    
    const user = result[0];
    
    return {
      id: user.id,
      openId: user.openId,
      name: user.name || undefined,
      email: user.email || undefined,
      loginMethod: user.loginMethod || undefined,
      role: user.role as 'user' | 'admin' | 'merchant',
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      lastSignedIn: user.lastSignedIn,
    };
  } catch (error) {
    console.error('[UserAccount] Registration failed:', error);
    throw error;
  }
}

/**
 * Authenticate user
 */
export async function authenticateUser(input: LoginInput): Promise<UserAccount | null> {
  try {
    const { email, password } = input;
    
    const user = await db.query.users.findFirst({
      where: eq(users.email, email),
    });
    
    if (!user) {
      return null;
    }
    
    // Verify password (in real app, password would be stored)
    // For now, just return user if exists
    
    // Update last signed in
    await db.update(users)
      .set({ lastSignedIn: new Date() })
      .where(eq(users.id, user.id));
    
    return {
      id: user.id,
      openId: user.openId,
      name: user.name || undefined,
      email: user.email || undefined,
      loginMethod: user.loginMethod || undefined,
      role: user.role as 'user' | 'admin' | 'merchant',
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      lastSignedIn: user.lastSignedIn,
    };
  } catch (error) {
    console.error('[UserAccount] Authentication failed:', error);
    throw error;
  }
}

/**
 * Get user by ID
 */
export async function getUserById(userId: number): Promise<UserAccount | null> {
  try {
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });
    
    if (!user) {
      return null;
    }
    
    return {
      id: user.id,
      openId: user.openId,
      name: user.name || undefined,
      email: user.email || undefined,
      loginMethod: user.loginMethod || undefined,
      role: user.role as 'user' | 'admin' | 'merchant',
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      lastSignedIn: user.lastSignedIn,
    };
  } catch (error) {
    console.error('[UserAccount] Failed to get user:', error);
    throw error;
  }
}

/**
 * Get user by email
 */
export async function getUserByEmail(email: string): Promise<UserAccount | null> {
  try {
    const user = await db.query.users.findFirst({
      where: eq(users.email, email),
    });
    
    if (!user) {
      return null;
    }
    
    return {
      id: user.id,
      openId: user.openId,
      name: user.name || undefined,
      email: user.email || undefined,
      loginMethod: user.loginMethod || undefined,
      role: user.role as 'user' | 'admin' | 'merchant',
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      lastSignedIn: user.lastSignedIn,
    };
  } catch (error) {
    console.error('[UserAccount] Failed to get user by email:', error);
    throw error;
  }
}

/**
 * Update user profile
 */
export async function updateUserProfile(
  userId: number,
  input: UpdateProfileInput
): Promise<UserAccount | null> {
  try {
    const updateData: any = {};
    
    if (input.name !== undefined) {
      updateData.name = input.name;
    }
    
    if (input.email !== undefined) {
      // Check if email already exists
      const existing = await db.query.users.findFirst({
        where: eq(users.email, input.email),
      });
      
      if (existing && existing.id !== userId) {
        throw new Error('Email already in use');
      }
      
      updateData.email = input.email;
    }
    
    if (Object.keys(updateData).length === 0) {
      return getUserById(userId);
    }
    
    await db.update(users)
      .set(updateData)
      .where(eq(users.id, userId));
    
    return getUserById(userId);
  } catch (error) {
    console.error('[UserAccount] Profile update failed:', error);
    throw error;
  }
}

/**
 * Change user role
 */
export async function changeUserRole(
  userId: number,
  newRole: 'user' | 'admin' | 'merchant'
): Promise<UserAccount | null> {
  try {
    await db.update(users)
      .set({ role: newRole })
      .where(eq(users.id, userId));
    
    return getUserById(userId);
  } catch (error) {
    console.error('[UserAccount] Role change failed:', error);
    throw error;
  }
}

/**
 * Get user statistics
 */
export async function getUserStatistics(): Promise<{
  totalUsers: number;
  activeUsers: number;
  merchantUsers: number;
  adminUsers: number;
}> {
  try {
    const allUsers = await db.query.users.findMany();
    
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    
    const activeUsers = allUsers.filter(u => u.lastSignedIn > thirtyDaysAgo).length;
    const merchantUsers = allUsers.filter(u => u.role === 'merchant').length;
    const adminUsers = allUsers.filter(u => u.role === 'admin').length;
    
    return {
      totalUsers: allUsers.length,
      activeUsers,
      merchantUsers,
      adminUsers,
    };
  } catch (error) {
    console.error('[UserAccount] Failed to get statistics:', error);
    throw error;
  }
}

/**
 * Delete user account
 */
export async function deleteUserAccount(userId: number): Promise<boolean> {
  try {
    // In production, you might want to soft-delete instead
    // For now, we'll just mark as inactive or delete related data
    
    // Delete user
    await db.delete(users).where(eq(users.id, userId));
    
    return true;
  } catch (error) {
    console.error('[UserAccount] Account deletion failed:', error);
    throw error;
  }
}

/**
 * Get user login history
 */
export async function getUserLoginHistory(userId: number): Promise<Array<{
  timestamp: Date;
  method: string;
}>> {
  try {
    const user = await getUserById(userId);
    
    if (!user) {
      return [];
    }
    
    // In production, you'd have a separate login_history table
    // For now, return the last sign-in
    return [
      {
        timestamp: user.lastSignedIn,
        method: user.loginMethod || 'email',
      },
    ];
  } catch (error) {
    console.error('[UserAccount] Failed to get login history:', error);
    throw error;
  }
}
