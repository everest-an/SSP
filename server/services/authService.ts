/**
 * Authentication Service
 * 
 * Handles user authentication including:
 * - Email/password registration and login
 * - Face recognition login
 * - Session management
 * - Password hashing and verification
 */

import bcrypt from 'bcryptjs';
import { db } from '../db';
import { users } from '../../drizzle/schema';
import { eq, and } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';

const SALT_ROUNDS = 10;

/**
 * Hash a password using bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Verify a password against a hash
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Register a new user with email and password
 */
export async function registerUser(data: {
  email: string;
  password: string;
  name: string;
  phone?: string;
  role?: 'user' | 'merchant' | 'admin';
}) {
  // Check if email already exists
  const [existingUser] = await db
    .select()
    .from(users)
    .where(eq(users.email, data.email))
    .limit(1);

  if (existingUser) {
    throw new TRPCError({
      code: 'CONFLICT',
      message: 'Email already registered',
    });
  }

  // Hash password
  const passwordHash = await hashPassword(data.password);

  // Create user
  const [newUser] = await db.insert(users).values({
    email: data.email,
    passwordHash,
    name: data.name,
    loginMethod: 'email',
    role: data.role || 'user',
    openId: `email_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, // Generate unique openId
  });

  // Return user without password hash
  const [createdUser] = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      role: users.role,
      loginMethod: users.loginMethod,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.id, newUser.insertId))
    .limit(1);

  return createdUser;
}

/**
 * Login user with email and password
 */
export async function loginWithEmail(email: string, password: string) {
  // Find user by email
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (!user) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'Invalid email or password',
    });
  }

  if (!user.passwordHash) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'This account uses a different login method. Please use face recognition or OAuth.',
    });
  }

  // Verify password
  const isValid = await verifyPassword(password, user.passwordHash);

  if (!isValid) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'Invalid email or password',
    });
  }

  // Update last signed in
  await db
    .update(users)
    .set({ lastSignedIn: new Date() })
    .where(eq(users.id, user.id));

  // Return user without password hash
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    loginMethod: user.loginMethod,
  };
}

/**
 * Login user with face recognition
 * 
 * This function is called after face verification succeeds
 */
export async function loginWithFace(userId: number) {
  // Get user
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: 'User not found',
    });
  }

  // Update last signed in
  await db
    .update(users)
    .set({ lastSignedIn: new Date() })
    .where(eq(users.id, user.id));

  // Return user without password hash
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    loginMethod: user.loginMethod,
  };
}

/**
 * Get user by email
 */
export async function getUserByEmail(email: string) {
  const [user] = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      role: users.role,
      loginMethod: users.loginMethod,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  return user || null;
}

/**
 * Update user password
 */
export async function updatePassword(userId: number, newPassword: string) {
  const passwordHash = await hashPassword(newPassword);

  await db
    .update(users)
    .set({ passwordHash })
    .where(eq(users.id, userId));

  return { success: true };
}

/**
 * Check if email is available
 */
export async function isEmailAvailable(email: string): Promise<boolean> {
  const [existingUser] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  return !existingUser;
}
