/**
 * Password Reset Service
 * 
 * Handles password reset token generation, validation, and password updates
 */

import { db } from '../db';
import { users } from '../../drizzle/schema';
import { eq, and, gt } from 'drizzle-orm';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';

interface PasswordResetToken {
  userId: number;
  token: string;
  expiresAt: Date;
}

// In-memory store for reset tokens (in production, use Redis or database)
const resetTokens = new Map<string, PasswordResetToken>();

/**
 * Generate a password reset token
 * 
 * @param email - User's email address
 * @returns Reset token and expiration time
 */
export async function generatePasswordResetToken(email: string): Promise<{
  token: string;
  expiresAt: Date;
  userId: number;
} | null> {
  // Find user by email
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (!user) {
    // Don't reveal if email exists
    return null;
  }

  // Generate secure random token
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  // Store token
  resetTokens.set(token, {
    userId: user.id,
    token,
    expiresAt,
  });

  // Clean up expired tokens
  cleanupExpiredTokens();

  return {
    token,
    expiresAt,
    userId: user.id,
  };
}

/**
 * Verify a password reset token
 * 
 * @param token - Reset token
 * @returns User ID if valid, null otherwise
 */
export async function verifyPasswordResetToken(token: string): Promise<number | null> {
  const resetToken = resetTokens.get(token);

  if (!resetToken) {
    return null;
  }

  // Check if expired
  if (resetToken.expiresAt < new Date()) {
    resetTokens.delete(token);
    return null;
  }

  return resetToken.userId;
}

/**
 * Reset password using token
 * 
 * @param token - Reset token
 * @param newPassword - New password
 * @returns Success status
 */
export async function resetPassword(
  token: string,
  newPassword: string
): Promise<boolean> {
  const userId = await verifyPasswordResetToken(token);

  if (!userId) {
    return false;
  }

  // Hash new password
  const passwordHash = await bcrypt.hash(newPassword, 10);

  // Update password
  await db
    .update(users)
    .set({ passwordHash })
    .where(eq(users.id, userId));

  // Invalidate token
  resetTokens.delete(token);

  return true;
}

/**
 * Clean up expired tokens
 */
function cleanupExpiredTokens(): void {
  const now = new Date();
  for (const [token, data] of resetTokens.entries()) {
    if (data.expiresAt < now) {
      resetTokens.delete(token);
    }
  }
}

/**
 * Get reset token info (for testing/debugging)
 */
export function getResetTokenInfo(token: string): PasswordResetToken | undefined {
  return resetTokens.get(token);
}

/**
 * Invalidate all tokens for a user (e.g., after successful password change)
 */
export function invalidateUserTokens(userId: number): void {
  for (const [token, data] of resetTokens.entries()) {
    if (data.userId === userId) {
      resetTokens.delete(token);
    }
  }
}
