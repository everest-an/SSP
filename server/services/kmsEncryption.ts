/**
 * KMS Encryption Service
 * 
 * Handles encryption and decryption of sensitive data using AWS KMS.
 * Used primarily for encrypting face embeddings/templates.
 * 
 * Security:
 * - Uses AES-256-GCM encryption
 * - Keys are managed by AWS KMS
 * - Only authorized services can decrypt via IAM roles
 * - Supports key rotation
 */

import { KMSClient, EncryptCommand, DecryptCommand, GenerateDataKeyCommand } from "@aws-sdk/client-kms";
import crypto from "crypto";

// Initialize KMS client
const kmsClient = new KMSClient({
  region: process.env.AWS_REGION || "ap-southeast-2",
});

// KMS Key ID for face embeddings (should be set in environment variables)
const FACE_EMBEDDING_KEY_ID = process.env.KMS_FACE_EMBEDDING_KEY_ID || "alias/ssp-face-embeddings";

/**
 * Encrypt data using AWS KMS with envelope encryption
 * 
 * Process:
 * 1. Generate a data key from KMS
 * 2. Use the data key to encrypt the plaintext with AES-256-GCM
 * 3. Return both the encrypted data and the encrypted data key
 * 
 * @param plaintext - The data to encrypt (face embedding vector)
 * @returns Object containing encrypted data, encrypted key, IV, and auth tag
 */
export async function encryptWithKMS(plaintext: Buffer): Promise<{
  encryptedData: Buffer;
  encryptedKey: Buffer;
  iv: Buffer;
  authTag: Buffer;
  keyId: string;
}> {
  try {
    // Step 1: Generate a data encryption key from KMS
    const generateKeyCommand = new GenerateDataKeyCommand({
      KeyId: FACE_EMBEDDING_KEY_ID,
      KeySpec: "AES_256",
    });

    const { Plaintext: dataKey, CiphertextBlob: encryptedKey } = await kmsClient.send(generateKeyCommand);

    if (!dataKey || !encryptedKey) {
      throw new Error("Failed to generate data key from KMS");
    }

    // Step 2: Encrypt the plaintext using the data key with AES-256-GCM
    const iv = crypto.randomBytes(12); // 12 bytes IV for GCM
    const cipher = crypto.createCipheriv("aes-256-gcm", dataKey, iv);

    const encryptedData = Buffer.concat([
      cipher.update(plaintext),
      cipher.final(),
    ]);

    const authTag = cipher.getAuthTag();

    // Clear the plaintext data key from memory
    dataKey.fill(0);

    return {
      encryptedData,
      encryptedKey: Buffer.from(encryptedKey),
      iv,
      authTag,
      keyId: FACE_EMBEDDING_KEY_ID,
    };
  } catch (error) {
    console.error("KMS encryption error:", error);
    throw new Error("Failed to encrypt data with KMS");
  }
}

/**
 * Decrypt data that was encrypted with KMS envelope encryption
 * 
 * Process:
 * 1. Decrypt the data key using KMS
 * 2. Use the decrypted data key to decrypt the ciphertext with AES-256-GCM
 * 3. Return the plaintext
 * 
 * @param encryptedData - The encrypted data
 * @param encryptedKey - The encrypted data key (from KMS)
 * @param iv - The initialization vector
 * @param authTag - The authentication tag
 * @returns The decrypted plaintext
 */
export async function decryptWithKMS(
  encryptedData: Buffer,
  encryptedKey: Buffer,
  iv: Buffer,
  authTag: Buffer
): Promise<Buffer> {
  try {
    // Step 1: Decrypt the data key using KMS
    const decryptCommand = new DecryptCommand({
      CiphertextBlob: encryptedKey,
    });

    const { Plaintext: dataKey } = await kmsClient.send(decryptCommand);

    if (!dataKey) {
      throw new Error("Failed to decrypt data key from KMS");
    }

    // Step 2: Decrypt the data using the data key with AES-256-GCM
    const decipher = crypto.createDecipheriv("aes-256-gcm", dataKey, iv);
    decipher.setAuthTag(authTag);

    const decryptedData = Buffer.concat([
      decipher.update(encryptedData),
      decipher.final(),
    ]);

    // Clear the plaintext data key from memory
    dataKey.fill(0);

    return decryptedData;
  } catch (error) {
    console.error("KMS decryption error:", error);
    throw new Error("Failed to decrypt data with KMS");
  }
}

/**
 * Serialize encrypted data for storage in database
 * 
 * Format: [encryptedKey length (4 bytes)][encryptedKey][iv (12 bytes)][authTag (16 bytes)][encryptedData]
 * 
 * @param encrypted - The encrypted data object
 * @returns A single buffer ready for database storage
 */
export function serializeEncryptedData(encrypted: {
  encryptedData: Buffer;
  encryptedKey: Buffer;
  iv: Buffer;
  authTag: Buffer;
}): Buffer {
  const keyLength = Buffer.alloc(4);
  keyLength.writeUInt32BE(encrypted.encryptedKey.length, 0);

  return Buffer.concat([
    keyLength,
    encrypted.encryptedKey,
    encrypted.iv,
    encrypted.authTag,
    encrypted.encryptedData,
  ]);
}

/**
 * Deserialize encrypted data from database storage
 * 
 * @param serialized - The serialized buffer from database
 * @returns The encrypted data components
 */
export function deserializeEncryptedData(serialized: Buffer): {
  encryptedData: Buffer;
  encryptedKey: Buffer;
  iv: Buffer;
  authTag: Buffer;
} {
  let offset = 0;

  // Read encrypted key length
  const keyLength = serialized.readUInt32BE(offset);
  offset += 4;

  // Read encrypted key
  const encryptedKey = serialized.subarray(offset, offset + keyLength);
  offset += keyLength;

  // Read IV (12 bytes for GCM)
  const iv = serialized.subarray(offset, offset + 12);
  offset += 12;

  // Read auth tag (16 bytes for GCM)
  const authTag = serialized.subarray(offset, offset + 16);
  offset += 16;

  // Read encrypted data (rest of the buffer)
  const encryptedData = serialized.subarray(offset);

  return {
    encryptedData,
    encryptedKey,
    iv,
    authTag,
  };
}

/**
 * Encrypt a face embedding vector for storage
 * 
 * @param embedding - Float32Array or number array representing the face embedding
 * @returns Serialized encrypted data ready for database storage
 */
export async function encryptFaceEmbedding(embedding: Float32Array | number[]): Promise<Buffer> {
  // Convert embedding to Buffer
  const embeddingArray = Array.isArray(embedding) ? new Float32Array(embedding) : embedding;
  const embeddingBuffer = Buffer.from(embeddingArray.buffer);

  // Encrypt with KMS
  const encrypted = await encryptWithKMS(embeddingBuffer);

  // Serialize for storage
  return serializeEncryptedData(encrypted);
}

/**
 * Decrypt a face embedding vector from storage
 * 
 * @param encryptedBuffer - The encrypted buffer from database
 * @returns Float32Array representing the face embedding
 */
export async function decryptFaceEmbedding(encryptedBuffer: Buffer): Promise<Float32Array> {
  // Deserialize
  const { encryptedData, encryptedKey, iv, authTag } = deserializeEncryptedData(encryptedBuffer);

  // Decrypt with KMS
  const decryptedBuffer = await decryptWithKMS(encryptedData, encryptedKey, iv, authTag);

  // Convert back to Float32Array
  return new Float32Array(decryptedBuffer.buffer, decryptedBuffer.byteOffset, decryptedBuffer.byteLength / 4);
}
