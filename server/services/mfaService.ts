/**
 * Multi-Factor Authentication (MFA) Service
 * 
 * Handles:
 * - TOTP (Time-based One-Time Password) setup and verification
 * - SMS verification
 * - Backup codes generation and validation
 * - MFA status management
 */

import { nanoid } from 'nanoid';

/**
 * MFA method types
 */
export type MFAMethod = 'totp' | 'sms' | 'email';

/**
 * MFA configuration
 */
export interface MFAConfig {
  userId: number;
  method: MFAMethod;
  isEnabled: boolean;
  secret?: string; // For TOTP
  phoneNumber?: string; // For SMS
  backupCodes: string[];
  createdAt: Date;
  updatedAt: Date;
  lastUsedAt?: Date;
}

/**
 * TOTP setup response
 */
export interface TOTPSetupResponse {
  secret: string;
  qrCode: string;
  backupCodes: string[];
}

/**
 * In-memory storage for demo (use database in production)
 */
const mfaConfigs = new Map<string, MFAConfig>();

/**
 * Generate random secret for TOTP
 */
function generateSecret(length: number = 32): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let secret = '';
  
  for (let i = 0; i < length; i++) {
    secret += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  
  return secret;
}

/**
 * Generate backup codes
 */
function generateBackupCodes(count: number = 10): string[] {
  const codes: string[] = [];
  
  for (let i = 0; i < count; i++) {
    const code = nanoid(8).toUpperCase();
    codes.push(code);
  }
  
  return codes;
}

/**
 * Calculate TOTP token
 */
function calculateTOTP(secret: string, timestamp?: number): string {
  // Simplified TOTP calculation
  // In production, use a library like 'speakeasy' or 'otpauth'
  
  const time = Math.floor((timestamp || Date.now()) / 30000);
  const hmac = require('crypto').createHmac('sha1', Buffer.from(secret, 'base32'));
  hmac.update(Buffer.from(time.toString(), 'utf8'));
  
  const digest = hmac.digest('hex');
  const offset = parseInt(digest.substring(digest.length - 1), 16);
  const code = (parseInt(digest.substring(offset * 2, offset * 2 + 8), 16) & 0x7fffffff) % 1000000;
  
  return code.toString().padStart(6, '0');
}

/**
 * Setup TOTP for user
 */
export async function setupTOTP(userId: number): Promise<TOTPSetupResponse> {
  try {
    const secret = generateSecret();
    const backupCodes = generateBackupCodes();
    
    // Generate QR code URL (in production, use a library)
    const qrCode = `otpauth://totp/SSP:user${userId}?secret=${secret}&issuer=SSP`;
    
    return {
      secret,
      qrCode,
      backupCodes,
    };
  } catch (error) {
    console.error('[MFA] TOTP setup failed:', error);
    throw error;
  }
}

/**
 * Verify TOTP token
 */
export async function verifyTOTP(secret: string, token: string): Promise<boolean> {
  try {
    // Check current time window
    const currentToken = calculateTOTP(secret);
    
    if (token === currentToken) {
      return true;
    }
    
    // Check previous time window (30 seconds ago)
    const previousToken = calculateTOTP(secret, Date.now() - 30000);
    
    if (token === previousToken) {
      return true;
    }
    
    // Check next time window (30 seconds ahead)
    const nextToken = calculateTOTP(secret, Date.now() + 30000);
    
    if (token === nextToken) {
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('[MFA] TOTP verification failed:', error);
    return false;
  }
}

/**
 * Enable TOTP for user
 */
export async function enableTOTP(
  userId: number,
  secret: string,
  backupCodes: string[]
): Promise<MFAConfig> {
  try {
    const id = `mfa_${userId}_totp`;
    
    const config: MFAConfig = {
      userId,
      method: 'totp',
      isEnabled: true,
      secret,
      backupCodes,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    mfaConfigs.set(id, config);
    
    return config;
  } catch (error) {
    console.error('[MFA] Failed to enable TOTP:', error);
    throw error;
  }
}

/**
 * Disable TOTP for user
 */
export async function disableTOTP(userId: number): Promise<boolean> {
  try {
    const id = `mfa_${userId}_totp`;
    return mfaConfigs.delete(id);
  } catch (error) {
    console.error('[MFA] Failed to disable TOTP:', error);
    throw error;
  }
}

/**
 * Setup SMS verification
 */
export async function setupSMS(userId: number, phoneNumber: string): Promise<string> {
  try {
    // Generate verification code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    
    // In production, send SMS using Twilio or similar
    console.log(`[MFA] SMS code for ${phoneNumber}: ${code}`);
    
    return code;
  } catch (error) {
    console.error('[MFA] SMS setup failed:', error);
    throw error;
  }
}

/**
 * Verify SMS code
 */
export async function verifySMSCode(userId: number, code: string): Promise<boolean> {
  try {
    // In production, verify against stored code
    // For demo, just check length
    return code.length === 6;
  } catch (error) {
    console.error('[MFA] SMS verification failed:', error);
    return false;
  }
}

/**
 * Enable SMS for user
 */
export async function enableSMS(userId: number, phoneNumber: string): Promise<MFAConfig> {
  try {
    const id = `mfa_${userId}_sms`;
    const backupCodes = generateBackupCodes();
    
    const config: MFAConfig = {
      userId,
      method: 'sms',
      isEnabled: true,
      phoneNumber,
      backupCodes,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    mfaConfigs.set(id, config);
    
    return config;
  } catch (error) {
    console.error('[MFA] Failed to enable SMS:', error);
    throw error;
  }
}

/**
 * Disable SMS for user
 */
export async function disableSMS(userId: number): Promise<boolean> {
  try {
    const id = `mfa_${userId}_sms`;
    return mfaConfigs.delete(id);
  } catch (error) {
    console.error('[MFA] Failed to disable SMS:', error);
    throw error;
  }
}

/**
 * Verify backup code
 */
export async function verifyBackupCode(userId: number, code: string): Promise<boolean> {
  try {
    // Check TOTP config
    let config = mfaConfigs.get(`mfa_${userId}_totp`);
    
    // Check SMS config
    if (!config) {
      config = mfaConfigs.get(`mfa_${userId}_sms`);
    }
    
    if (!config) {
      return false;
    }
    
    const index = config.backupCodes.indexOf(code);
    
    if (index === -1) {
      return false;
    }
    
    // Remove used code
    config.backupCodes.splice(index, 1);
    config.updatedAt = new Date();
    
    return true;
  } catch (error) {
    console.error('[MFA] Backup code verification failed:', error);
    return false;
  }
}

/**
 * Get MFA config for user
 */
export async function getMFAConfig(userId: number): Promise<MFAConfig | null> {
  try {
    // Check TOTP first
    let config = mfaConfigs.get(`mfa_${userId}_totp`);
    
    // Check SMS
    if (!config) {
      config = mfaConfigs.get(`mfa_${userId}_sms`);
    }
    
    return config || null;
  } catch (error) {
    console.error('[MFA] Failed to get MFA config:', error);
    throw error;
  }
}

/**
 * Get all MFA methods for user
 */
export async function getUserMFAMethods(userId: number): Promise<MFAConfig[]> {
  try {
    const methods: MFAConfig[] = [];
    
    for (const [, config] of mfaConfigs) {
      if (config.userId === userId) {
        methods.push(config);
      }
    }
    
    return methods;
  } catch (error) {
    console.error('[MFA] Failed to get user MFA methods:', error);
    throw error;
  }
}

/**
 * Check if user has MFA enabled
 */
export async function isMFAEnabled(userId: number): Promise<boolean> {
  try {
    const config = await getMFAConfig(userId);
    return config ? config.isEnabled : false;
  } catch (error) {
    console.error('[MFA] Failed to check MFA status:', error);
    return false;
  }
}

/**
 * Disable all MFA methods for user
 */
export async function disableAllMFA(userId: number): Promise<boolean> {
  try {
    let deleted = false;
    
    for (const [key, config] of mfaConfigs) {
      if (config.userId === userId) {
        mfaConfigs.delete(key);
        deleted = true;
      }
    }
    
    return deleted;
  } catch (error) {
    console.error('[MFA] Failed to disable all MFA:', error);
    throw error;
  }
}

/**
 * Regenerate backup codes
 */
export async function regenerateBackupCodes(userId: number): Promise<string[]> {
  try {
    const config = await getMFAConfig(userId);
    
    if (!config) {
      throw new Error('MFA not configured for user');
    }
    
    const newCodes = generateBackupCodes();
    config.backupCodes = newCodes;
    config.updatedAt = new Date();
    
    return newCodes;
  } catch (error) {
    console.error('[MFA] Failed to regenerate backup codes:', error);
    throw error;
  }
}

/**
 * Get remaining backup codes count
 */
export async function getBackupCodesCount(userId: number): Promise<number> {
  try {
    const config = await getMFAConfig(userId);
    
    if (!config) {
      return 0;
    }
    
    return config.backupCodes.length;
  } catch (error) {
    console.error('[MFA] Failed to get backup codes count:', error);
    return 0;
  }
}
