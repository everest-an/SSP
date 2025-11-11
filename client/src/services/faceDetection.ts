/**
 * Face Detection and Embedding Generation Service
 * 
 * Uses MediaPipe Face Mesh to detect faces and generate embeddings.
 * Provides both 128-dim and 512-dim embedding options.
 * 
 * Based on DEVDOC-FR requirements:
 * - Real-time face detection
 * - Quality assessment
 * - Embedding generation for storage
 */

import { FaceMesh, Results } from '@mediapipe/face_mesh';
import { Camera } from '@mediapipe/camera_utils';

// Face mesh configuration
const FACE_MESH_CONFIG = {
  maxNumFaces: 1,
  refineLandmarks: true,
  minDetectionConfidence: 0.5,
  minTrackingConfidence: 0.5,
};

// Embedding dimensions
export type EmbeddingDimension = 128 | 512;

/**
 * Face detection result
 */
export interface FaceDetectionResult {
  detected: boolean;
  landmarks?: number[][];
  boundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  quality: {
    score: number; // 0-1, higher is better
    frontal: boolean; // Is face frontal?
    wellLit: boolean; // Is face well-lit?
    sharp: boolean; // Is image sharp?
  };
}

/**
 * Face embedding result
 */
export interface FaceEmbeddingResult {
  embedding: number[];
  dimension: EmbeddingDimension;
  quality: number;
  timestamp: number;
}

/**
 * Initialize MediaPipe Face Mesh
 */
export function createFaceMesh(onResults: (results: Results) => void): FaceMesh {
  const faceMesh = new FaceMesh({
    locateFile: (file) => {
      return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`;
    },
  });

  faceMesh.setOptions(FACE_MESH_CONFIG);
  faceMesh.onResults(onResults);

  return faceMesh;
}

/**
 * Detect face in an image
 * 
 * @param imageData - The image data to process
 * @returns Face detection result
 */
export async function detectFace(
  faceMesh: FaceMesh,
  imageData: ImageData | HTMLVideoElement | HTMLImageElement
): Promise<FaceDetectionResult> {
  return new Promise((resolve) => {
    faceMesh.onResults((results: Results) => {
      if (!results.multiFaceLandmarks || results.multiFaceLandmarks.length === 0) {
        resolve({
          detected: false,
          quality: {
            score: 0,
            frontal: false,
            wellLit: false,
            sharp: false,
          },
        });
        return;
      }

      const landmarks = results.multiFaceLandmarks[0];
      const quality = assessFaceQuality(landmarks, imageData);
      const boundingBox = calculateBoundingBox(landmarks);

      resolve({
        detected: true,
        landmarks: landmarks.map(l => [l.x, l.y, l.z]),
        boundingBox,
        quality,
      });
    });

    faceMesh.send({ image: imageData as any });
  });
}

/**
 * Generate face embedding from landmarks
 * 
 * This is a simplified implementation. In production, you should:
 * 1. Use a pre-trained face recognition model (FaceNet, ArcFace, etc.)
 * 2. Extract features from the face region
 * 3. Normalize the embedding vector
 * 
 * Current implementation: Convert landmarks to fixed-size embedding
 * 
 * @param landmarks - Face landmarks from MediaPipe
 * @param dimension - Desired embedding dimension (128 or 512)
 * @returns Face embedding vector
 */
export function generateEmbedding(
  landmarks: number[][],
  dimension: EmbeddingDimension = 128
): number[] {
  // Flatten landmarks
  const flatLandmarks = landmarks.flat();
  
  // For 128-dim: Use PCA-like dimensionality reduction
  if (dimension === 128) {
    return reduceDimensions(flatLandmarks, 128);
  }
  
  // For 512-dim: Use more detailed features
  return reduceDimensions(flatLandmarks, 512);
}

/**
 * Reduce dimensions using a simple averaging technique
 * 
 * In production, replace this with:
 * - PCA (Principal Component Analysis)
 * - Autoencoder
 * - Pre-trained face recognition model
 */
function reduceDimensions(data: number[], targetDim: number): number[] {
  const embedding: number[] = [];
  const chunkSize = Math.ceil(data.length / targetDim);
  
  for (let i = 0; i < targetDim; i++) {
    const start = i * chunkSize;
    const end = Math.min(start + chunkSize, data.length);
    const chunk = data.slice(start, end);
    const avg = chunk.reduce((sum, val) => sum + val, 0) / chunk.length;
    embedding.push(avg);
  }
  
  // Normalize to unit vector
  const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
  return embedding.map(val => val / magnitude);
}

/**
 * Assess face quality for enrollment
 * 
 * Checks:
 * - Is face frontal? (yaw, pitch, roll within thresholds)
 * - Is face well-lit? (brightness analysis)
 * - Is image sharp? (edge detection)
 */
function assessFaceQuality(
  landmarks: any[],
  imageData: ImageData | HTMLVideoElement | HTMLImageElement
): {
  score: number;
  frontal: boolean;
  wellLit: boolean;
  sharp: boolean;
} {
  // Calculate face pose (yaw, pitch, roll)
  const pose = estimateFacePose(landmarks);
  const frontal = Math.abs(pose.yaw) < 15 && Math.abs(pose.pitch) < 15;
  
  // Estimate lighting (simplified - check average brightness)
  const wellLit = true; // TODO: Implement brightness analysis
  
  // Estimate sharpness (simplified)
  const sharp = true; // TODO: Implement edge detection
  
  // Calculate overall quality score
  let score = 0;
  if (frontal) score += 0.4;
  if (wellLit) score += 0.3;
  if (sharp) score += 0.3;
  
  return { score, frontal, wellLit, sharp };
}

/**
 * Estimate face pose (yaw, pitch, roll)
 * 
 * Uses key landmarks to estimate 3D head pose
 */
function estimateFacePose(landmarks: any[]): {
  yaw: number;
  pitch: number;
  roll: number;
} {
  // Simplified pose estimation using nose tip and eye positions
  // In production, use proper 3D pose estimation (solvePnP)
  
  const noseTip = landmarks[1]; // Nose tip
  const leftEye = landmarks[33]; // Left eye outer corner
  const rightEye = landmarks[263]; // Right eye outer corner
  
  // Calculate yaw (left-right rotation)
  const eyeCenter = {
    x: (leftEye.x + rightEye.x) / 2,
    y: (leftEye.y + rightEye.y) / 2,
  };
  const yaw = (noseTip.x - eyeCenter.x) * 100; // Simplified, in degrees
  
  // Calculate pitch (up-down rotation)
  const pitch = (noseTip.y - eyeCenter.y) * 100;
  
  // Calculate roll (tilt)
  const roll = Math.atan2(rightEye.y - leftEye.y, rightEye.x - leftEye.x) * (180 / Math.PI);
  
  return { yaw, pitch, roll };
}

/**
 * Calculate bounding box from landmarks
 */
function calculateBoundingBox(landmarks: any[]): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
  const xs = landmarks.map(l => l.x);
  const ys = landmarks.map(l => l.y);
  
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  
  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

/**
 * Process video frame and generate embedding
 * 
 * Complete pipeline: detect → assess quality → generate embedding
 */
export async function processFrameForEnrollment(
  faceMesh: FaceMesh,
  videoElement: HTMLVideoElement,
  dimension: EmbeddingDimension = 128
): Promise<FaceEmbeddingResult | null> {
  const detection = await detectFace(faceMesh, videoElement);
  
  if (!detection.detected || !detection.landmarks) {
    return null;
  }
  
  // Quality threshold for enrollment
  if (detection.quality.score < 0.7) {
    return null;
  }
  
  const embedding = generateEmbedding(detection.landmarks, dimension);
  
  return {
    embedding,
    dimension,
    quality: detection.quality.score,
    timestamp: Date.now(),
  };
}

/**
 * Capture multiple frames and select the best one
 * 
 * @param faceMesh - Initialized FaceMesh instance
 * @param videoElement - Video element to capture from
 * @param frameCount - Number of frames to capture
 * @param dimension - Embedding dimension
 * @returns Best quality embedding
 */
export async function captureBestFrame(
  faceMesh: FaceMesh,
  videoElement: HTMLVideoElement,
  frameCount: number = 5,
  dimension: EmbeddingDimension = 128
): Promise<FaceEmbeddingResult | null> {
  const results: FaceEmbeddingResult[] = [];
  
  for (let i = 0; i < frameCount; i++) {
    const result = await processFrameForEnrollment(faceMesh, videoElement, dimension);
    if (result) {
      results.push(result);
    }
    // Wait 200ms between captures
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  
  if (results.length === 0) {
    return null;
  }
  
  // Return the highest quality embedding
  return results.reduce((best, current) => 
    current.quality > best.quality ? current : best
  );
}
