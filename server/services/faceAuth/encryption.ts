/**
 * Face Embedding Encryption Service
 * 
 * Provides encryption and decryption for sensitive face embedding data
 * using Node.js crypto module
 */

import crypto from 'crypto';

// Encryption configuration
const ALGORITHM = 'aes-256-gcm';
const ENCODING = 'hex';

/**
 * Generate encryption key from environment variable or create a default one
 */
function getEncryptionKey(): Buffer {
  const keyEnv = process.env.FACE_ENCRYPTION_KEY;
  if (!keyEnv) {
    // Use a default key for development (NOT for production)
    console.warn('[Encryption] Using default encryption key - NOT SECURE for production');
    return crypto.scryptSync('default-face-encryption-key', 'salt', 32);
  }
  return Buffer.from(keyEnv, 'hex');
}

/**
 * Encrypt face embedding data
 * 
 * @param embedding - Face embedding array to encrypt
 * @returns Encrypted data in format: iv:authTag:encryptedData
 */
export function encryptFaceEmbedding(embedding: number[]): string {
  try {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(16);
    
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    const data = JSON.stringify(embedding);
    
    let encrypted = cipher.update(data, 'utf8', ENCODING);
    encrypted += cipher.final(ENCODING);
    
    const authTag = cipher.getAuthTag();
    
    // Return format: iv:authTag:encryptedData
    return `${iv.toString(ENCODING)}:${authTag.toString(ENCODING)}:${encrypted}`;
  } catch (error) {
    console.error('[Encryption] Failed to encrypt embedding:', error);
    throw new Error('Failed to encrypt face embedding');
  }
}

/**
 * Decrypt face embedding data
 * 
 * @param encryptedData - Encrypted data in format: iv:authTag:encryptedData
 * @returns Decrypted face embedding array
 */
export function decryptFaceEmbedding(encryptedData: string): number[] {
  try {
    const key = getEncryptionKey();
    const [ivHex, authTagHex, encrypted] = encryptedData.split(':');
    
    if (!ivHex || !authTagHex || !encrypted) {
      throw new Error('Invalid encrypted data format');
    }
    
    const iv = Buffer.from(ivHex, ENCODING);
    const authTag = Buffer.from(authTagHex, ENCODING);
    
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted, ENCODING, 'utf8');
    decrypted += decipher.final('utf8');
    
    return JSON.parse(decrypted);
  } catch (error) {
    console.error('[Encryption] Failed to decrypt embedding:', error);
    throw new Error('Failed to decrypt face embedding');
  }
}

/**
 * Generate a random encryption key for initialization
 * 
 * @returns Hex-encoded encryption key
 */
export function generateEncryptionKey(): string {
  return crypto.randomBytes(32).toString('hex');
}
