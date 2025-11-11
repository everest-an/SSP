/**
 * Test script for KMS encryption/decryption
 * 
 * Usage: ts-node server/services/test-kms.ts
 */

import { encryptFaceEmbedding, decryptFaceEmbedding } from './kmsEncryption';

async function testKMSEncryption() {
  console.log('🔐 Testing KMS Encryption...\n');

  // Create a mock face embedding (128 dimensions)
  const mockEmbedding: number[] = Array(128).fill(0).map(() => Math.random());
  console.log('Original embedding (first 10 values):');
  console.log(mockEmbedding.slice(0, 10));
  console.log('');

  try {
    // Test encryption
    console.log('Encrypting embedding...');
    const encrypted = await encryptFaceEmbedding(mockEmbedding);
    console.log('✅ Encryption successful!');
    console.log('Encrypted buffer length:', encrypted.length, 'bytes');
    console.log('');

    // Test decryption
    console.log('Decrypting embedding...');
    const decryptedFloat32 = await decryptFaceEmbedding(encrypted);
    const decrypted = Array.from(decryptedFloat32);
    console.log('✅ Decryption successful!');
    console.log('Decrypted embedding (first 10 values):');
    console.log(decrypted.slice(0, 10));
    console.log('');

    // Verify correctness
    const isCorrect = mockEmbedding.every((val, idx) => 
      Math.abs(val - decrypted[idx]) < 0.0001
    );

    if (isCorrect) {
      console.log('✅ Encryption/Decryption test PASSED!');
      console.log('Original and decrypted embeddings match perfectly.');
    } else {
      console.log('❌ Encryption/Decryption test FAILED!');
      console.log('Original and decrypted embeddings do not match.');
      process.exit(1);
    }

  } catch (error) {
    console.error('❌ Test failed with error:');
    console.error(error);
    process.exit(1);
  }
}

// Run the test
testKMSEncryption()
  .then(() => {
    console.log('\n🎉 All tests passed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test suite failed:');
    console.error(error);
    process.exit(1);
  });
