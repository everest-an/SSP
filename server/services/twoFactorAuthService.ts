/**
 * Two-Factor Authentication (2FA) Service
 * 
 * Implements TOTP (Time-based One-Time Password) authentication
 */

import { authenticator } from 'otplib';
import QRCode from 'qrcode';
import { db } from '../db';
import { users } from '../../drizzle/schema';
import { eq } from 'drizzle-orm';

// Configure TOTP
authenticator.options = {
  window: 1, // Allow 1 step before/after current time
  step: 30, // 30 seconds per step
};

/**
 * Generate 2FA secret and QR code for a user
 */
export async function generate2FASecret(userId: number): Promise<{
  secret: string;
  qrCodeUrl: string;
  backupCodes: string[];
}> {
  // Get user info
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) {
    throw new Error('User not found');
  }

  // Generate secret
  const secret = authenticator.generateSecret();

  // Generate OTP Auth URL for QR code
  const otpauthUrl = authenticator.keyuri(
    user.email,
    'SSP (Smart Store Payment)',
    secret
  );

  // Generate QR code as data URL
  const qrCodeUrl = await QRCode.toDataURL(otpauthUrl);

  // Generate backup codes
  const backupCodes = generateBackupCodes(8);

  return {
    secret,
    qrCodeUrl,
    backupCodes,
  };
}

/**
 * Enable 2FA for a user
 */
export async function enable2FA(
  userId: number,
  secret: string,
  verificationCode: string
): Promise<boolean> {
  // Verify the code before enabling
  const isValid = authenticator.verify({
    token: verificationCode,
    secret,
  });

  if (!isValid) {
    return false;
  }

  // Store the secret in user record
  await db
    .update(users)
    .set({
      twoFactorSecret: secret,
      twoFactorEnabled: true,
    })
    .where(eq(users.id, userId));

  return true;
}

/**
 * Disable 2FA for a user
 */
export async function disable2FA(userId: number): Promise<void> {
  await db
    .update(users)
    .set({
      twoFactorSecret: null,
      twoFactorEnabled: false,
    })
    .where(eq(users.id, userId));
}

/**
 * Verify a 2FA code
 */
export async function verify2FACode(
  userId: number,
  code: string
): Promise<boolean> {
  // Get user's 2FA secret
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user || !user.twoFactorSecret || !user.twoFactorEnabled) {
    throw new Error('2FA not enabled for this user');
  }

  // Verify the code
  const isValid = authenticator.verify({
    token: code,
    secret: user.twoFactorSecret,
  });

  return isValid;
}

/**
 * Check if user has 2FA enabled
 */
export async function is2FAEnabled(userId: number): Promise<boolean> {
  const [user] = await db
    .select({ twoFactorEnabled: users.twoFactorEnabled })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  return user?.twoFactorEnabled || false;
}

/**
 * Generate backup codes for 2FA recovery
 */
function generateBackupCodes(count: number = 8): string[] {
  const codes: string[] = [];
  
  for (let i = 0; i < count; i++) {
    // Generate 8-character alphanumeric code
    const code = Array.from({ length: 8 }, () =>
      '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'[Math.floor(Math.random() * 36)]
    ).join('');
    
    // Format as XXXX-XXXX
    codes.push(`${code.slice(0, 4)}-${code.slice(4)}`);
  }
  
  return codes;
}

/**
 * Verify a backup code
 * 
 * Note: In production, backup codes should be stored hashed in the database
 * and marked as used after verification
 */
export async function verifyBackupCode(
  userId: number,
  backupCode: string
): Promise<boolean> {
  // This is a placeholder implementation
  // In production, check against stored backup codes in database
  
  console.log(`Backup code verification for user ${userId}: ${backupCode}`);
  
  // For now, return false (not implemented)
  return false;
}

/**
 * Generate a new TOTP token (for testing/debugging)
 */
export function generateTOTP(secret: string): string {
  return authenticator.generate(secret);
}
