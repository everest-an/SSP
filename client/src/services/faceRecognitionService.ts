/**
 * Integrated Face Recognition Service
 * 
 * Provides face detection, embedding generation, and user matching
 * Uses face-api.js and TensorFlow.js for robust face recognition
 * 
 * Key Features:
 * - Generate 128-dimensional face embeddings
 * - Compare embeddings for user identification
 * - Support multiple face samples per user
 * - Confidence scoring for verification
 */

import * as faceapi from '@vladmandic/face-api';

/**
 * Face embedding result
 */
export interface FaceEmbedding {
  embedding: number[];
  descriptor: Float32Array;
  detection: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  confidence: number;
  timestamp: number;
}

/**
 * User face profile (stored in database)
 */
export interface UserFaceProfile {
  userId: number;
  embeddings: Float32Array[]; // Multiple samples for better accuracy
  averageEmbedding: Float32Array;
  sampleCount: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Face verification result
 */
export interface FaceVerificationResult {
  verified: boolean;
  userId?: number;
  confidence: number;
  distance: number;
  threshold: number;
}

/**
 * Initialize face-api models
 */
export async function initializeFaceAPI(): Promise<void> {
  try {
    const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/';
    
    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
      faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
      faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
      faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL),
      faceapi.nets.ageGenderNet.loadFromUri(MODEL_URL),
    ]);
    
    console.log('[FaceAPI] Models loaded successfully');
  } catch (error) {
    console.error('[FaceAPI] Failed to load models:', error);
    throw error;
  }
}

/**
 * Detect faces and extract embeddings from image/video
 */
export async function detectFacesWithEmbeddings(
  input: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement
): Promise<FaceEmbedding[]> {
  try {
    const detections = await faceapi
      .detectAllFaces(input, new faceapi.TinyFaceDetectorOptions())
      .withFaceLandmarks()
      .withFaceDescriptors();
    
    if (detections.length === 0) {
      return [];
    }
    
    const embeddings: FaceEmbedding[] = detections.map((detection, index) => {
      const { detection: box, descriptor } = detection;
      
      return {
        embedding: Array.from(descriptor),
        descriptor,
        detection: {
          x: box.box.x,
          y: box.box.y,
          width: box.box.width,
          height: box.box.height,
        },
        confidence: box.score,
        timestamp: Date.now(),
      };
    });
    
    return embeddings;
  } catch (error) {
    console.error('[FaceAPI] Face detection failed:', error);
    throw error;
  }
}

/**
 * Calculate Euclidean distance between two embeddings
 * Lower distance = more similar faces
 */
export function calculateEmbeddingDistance(
  embedding1: Float32Array | number[],
  embedding2: Float32Array | number[]
): number {
  let sumSquaredDiff = 0;
  
  for (let i = 0; i < embedding1.length; i++) {
    const diff = embedding1[i] - embedding2[i];
    sumSquaredDiff += diff * diff;
  }
  
  return Math.sqrt(sumSquaredDiff);
}

/**
 * Calculate similarity score (0-1, higher is more similar)
 */
export function calculateSimilarityScore(distance: number): number {
  // Distance typically ranges from 0 to ~1.5
  // Convert to similarity: 0 distance = 1.0 similarity, 1.5 distance = 0.0 similarity
  return Math.max(0, 1 - distance / 1.5);
}

/**
 * Generate average embedding from multiple samples
 * Improves accuracy by combining multiple face captures
 */
export function generateAverageEmbedding(
  embeddings: Float32Array[] | number[][]
): Float32Array {
  if (embeddings.length === 0) {
    throw new Error('No embeddings provided');
  }
  
  const embeddingLength = embeddings[0].length;
  const averageEmbedding = new Float32Array(embeddingLength);
  
  // Sum all embeddings
  for (let i = 0; i < embeddingLength; i++) {
    let sum = 0;
    for (let j = 0; j < embeddings.length; j++) {
      sum += embeddings[j][i];
    }
    averageEmbedding[i] = sum / embeddings.length;
  }
  
  // Normalize
  let magnitude = 0;
  for (let i = 0; i < embeddingLength; i++) {
    magnitude += averageEmbedding[i] * averageEmbedding[i];
  }
  magnitude = Math.sqrt(magnitude);
  
  for (let i = 0; i < embeddingLength; i++) {
    averageEmbedding[i] /= magnitude;
  }
  
  return averageEmbedding;
}

/**
 * Verify face against user profile
 * Returns whether the face matches the user
 */
export function verifyFaceAgainstProfile(
  faceEmbedding: Float32Array | number[],
  userProfile: UserFaceProfile,
  threshold: number = 0.6 // Default threshold for similarity
): FaceVerificationResult {
  const distance = calculateEmbeddingDistance(
    faceEmbedding,
    userProfile.averageEmbedding
  );
  
  const similarity = calculateSimilarityScore(distance);
  const verified = similarity >= threshold;
  
  return {
    verified,
    userId: userProfile.userId,
    confidence: similarity,
    distance,
    threshold,
  };
}

/**
 * Find best matching user from multiple profiles
 */
export function findBestMatchingUser(
  faceEmbedding: Float32Array | number[],
  userProfiles: UserFaceProfile[],
  threshold: number = 0.6
): FaceVerificationResult | null {
  let bestMatch: FaceVerificationResult | null = null;
  let bestConfidence = 0;
  
  for (const profile of userProfiles) {
    const result = verifyFaceAgainstProfile(faceEmbedding, profile, threshold);
    
    if (result.verified && result.confidence > bestConfidence) {
      bestMatch = result;
      bestConfidence = result.confidence;
    }
  }
  
  return bestMatch;
}

/**
 * Capture best face frame from video stream
 * Selects the frame with highest confidence
 */
export async function captureBestFaceFrame(
  videoElement: HTMLVideoElement,
  duration: number = 3000, // Capture for 3 seconds
  interval: number = 200 // Check every 200ms
): Promise<FaceEmbedding | null> {
  const startTime = Date.now();
  let bestEmbedding: FaceEmbedding | null = null;
  let bestConfidence = 0;
  
  return new Promise((resolve) => {
    const captureInterval = setInterval(async () => {
      try {
        const embeddings = await detectFacesWithEmbeddings(videoElement);
        
        if (embeddings.length > 0) {
          const embedding = embeddings[0]; // Use first face
          
          if (embedding.confidence > bestConfidence) {
            bestConfidence = embedding.confidence;
            bestEmbedding = embedding;
          }
        }
        
        // Check if duration exceeded
        if (Date.now() - startTime > duration) {
          clearInterval(captureInterval);
          resolve(bestEmbedding);
        }
      } catch (error) {
        console.warn('[FaceAPI] Frame capture error:', error);
      }
    }, interval);
  });
}

/**
 * Batch verify multiple face embeddings
 * Useful for enrollment with multiple samples
 */
export async function enrollUserFace(
  videoElement: HTMLVideoElement,
  sampleCount: number = 5,
  interval: number = 500
): Promise<FaceEmbedding[]> {
  const embeddings: FaceEmbedding[] = [];
  let capturedCount = 0;
  
  return new Promise((resolve) => {
    const captureInterval = setInterval(async () => {
      try {
        const detections = await detectFacesWithEmbeddings(videoElement);
        
        if (detections.length > 0) {
          embeddings.push(detections[0]);
          capturedCount++;
          
          console.log(`[FaceAPI] Captured ${capturedCount}/${sampleCount} samples`);
          
          if (capturedCount >= sampleCount) {
            clearInterval(captureInterval);
            resolve(embeddings);
          }
        }
      } catch (error) {
        console.warn('[FaceAPI] Enrollment capture error:', error);
      }
    }, interval);
  });
}

/**
 * Liveness detection using face expressions
 * Detects if face is real (not a photo/video)
 */
export async function detectLiveness(
  input: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement
): Promise<{
  isLive: boolean;
  expressions: any;
  confidence: number;
}> {
  try {
    const detections = await faceapi
      .detectAllFaces(input, new faceapi.TinyFaceDetectorOptions())
      .withFaceExpressions();
    
    if (detections.length === 0) {
      return {
        isLive: false,
        expressions: null,
        confidence: 0,
      };
    }
    
    const detection = detections[0];
    const expressions = detection.expressions;
    
    // Liveness heuristics:
    // - Real faces show varied expressions
    // - Neutral expression should not be too high
    // - Multiple expressions should be present
    const neutral = expressions.neutral;
    const hasVariedExpressions = Object.values(expressions).some(
      (val: any) => val > 0.3 && val !== neutral
    );
    
    const isLive = neutral < 0.8 && hasVariedExpressions;
    const confidence = hasVariedExpressions ? 0.8 : 0.3;
    
    return {
      isLive,
      expressions,
      confidence,
    };
  } catch (error) {
    console.error('[FaceAPI] Liveness detection failed:', error);
    return {
      isLive: false,
      expressions: null,
      confidence: 0,
    };
  }
}

/**
 * Extract face metadata (age, gender, expressions)
 */
export async function extractFaceMetadata(
  input: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement
): Promise<any> {
  try {
    const detections = await faceapi
      .detectAllFaces(input, new faceapi.TinyFaceDetectorOptions())
      .withFaceExpressions()
      .withAgeAndGender();
    
    if (detections.length === 0) {
      return null;
    }
    
    const detection = detections[0];
    
    return {
      age: detection.age,
      gender: detection.gender,
      genderProbability: detection.genderProbability,
      expressions: detection.expressions,
    };
  } catch (error) {
    console.error('[FaceAPI] Metadata extraction failed:', error);
    return null;
  }
}

/**
 * Cleanup resources
 */
export function cleanupFaceAPI(): void {
  // Models are cached in memory, no explicit cleanup needed
  // But you can unload if needed:
  // faceapi.nets.tinyFaceDetector.dispose();
  // etc.
}
