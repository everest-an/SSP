/**
 * Liveness Detection Service
 * 
 * Implements multiple liveness detection methods:
 * 1. Blink detection - detect eye blinks
 * 2. Head movement detection - detect head motion
 * 3. Light reflection detection - detect light reflection in eyes
 * 
 * Based on DEVDOC-FaceRegulation requirements
 */

import { FaceMesh, Results } from '@mediapipe/face_mesh';

/**
 * Liveness detection result
 */
export interface LivenessDetectionResult {
  isLive: boolean;
  confidence: number; // 0-1
  method: 'blink' | 'headMovement' | 'lightReflection' | 'combined';
  details: {
    blinks: number;
    headMovement: number;
    lightReflection: boolean;
  };
}

/**
 * Eye state tracker for blink detection
 */
interface EyeState {
  leftEyeOpen: boolean;
  rightEyeOpen: boolean;
  blinkCount: number;
  lastBlinkTime: number;
}

/**
 * Head position tracker for movement detection
 */
interface HeadPosition {
  x: number;
  y: number;
  z: number;
  timestamp: number;
}

/**
 * Blink Detection Service
 * 
 * Detects eye blinks by monitoring eye aspect ratio (EAR)
 * Threshold: EAR < 0.2 indicates closed eye
 */
export class BlinkDetectionService {
  private eyeState: EyeState = {
    leftEyeOpen: true,
    rightEyeOpen: true,
    blinkCount: 0,
    lastBlinkTime: 0,
  };
  
  private minBlinkDuration = 50; // ms
  private maxBlinkDuration = 400; // ms
  private earThreshold = 0.2; // Eye Aspect Ratio threshold
  
  /**
   * Calculate Eye Aspect Ratio (EAR)
   * EAR = (||p2 - p6|| + ||p3 - p5||) / (2 * ||p1 - p4||)
   * 
   * Where p1-p6 are eye landmarks
   */
  private calculateEAR(landmarks: any[], isLeft: boolean): number {
    // Left eye: 33, 160, 158, 133, 153, 144
    // Right eye: 362, 385, 387, 362, 380, 373
    const eyeLandmarks = isLeft
      ? [33, 160, 158, 133, 153, 144]
      : [362, 385, 387, 362, 380, 373];
    
    const [p1, p2, p3, p4, p5, p6] = eyeLandmarks.map(idx => landmarks[idx]);
    
    if (!p1 || !p2 || !p3 || !p4 || !p5 || !p6) {
      return 1; // Default to open if landmarks missing
    }
    
    // Calculate distances
    const dist = (a: any, b: any) => {
      const dx = a.x - b.x;
      const dy = a.y - b.y;
      const dz = a.z - b.z;
      return Math.sqrt(dx * dx + dy * dy + dz * dz);
    };
    
    const d1 = dist(p2, p6);
    const d2 = dist(p3, p5);
    const d3 = dist(p1, p4);
    
    return (d1 + d2) / (2 * d3);
  }
  
  /**
   * Process landmarks and detect blinks
   */
  processBlinks(landmarks: any[]): number {
    const leftEAR = this.calculateEAR(landmarks, true);
    const rightEAR = this.calculateEAR(landmarks, false);
    
    const leftOpen = leftEAR > this.earThreshold;
    const rightOpen = rightEAR > this.earThreshold;
    
    // Detect blink transition (open -> closed -> open)
    if (
      this.eyeState.leftEyeOpen &&
      !leftOpen &&
      Date.now() - this.eyeState.lastBlinkTime > this.minBlinkDuration
    ) {
      this.eyeState.leftEyeOpen = false;
    } else if (!this.eyeState.leftEyeOpen && leftOpen) {
      this.eyeState.leftEyeOpen = true;
      this.eyeState.blinkCount++;
      this.eyeState.lastBlinkTime = Date.now();
    }
    
    if (
      this.eyeState.rightEyeOpen &&
      !rightOpen &&
      Date.now() - this.eyeState.lastBlinkTime > this.minBlinkDuration
    ) {
      this.eyeState.rightEyeOpen = false;
    } else if (!this.eyeState.rightEyeOpen && rightOpen) {
      this.eyeState.rightEyeOpen = true;
      this.eyeState.blinkCount++;
      this.eyeState.lastBlinkTime = Date.now();
    }
    
    return this.eyeState.blinkCount;
  }
  
  /**
   * Get blink count
   */
  getBlinkCount(): number {
    return this.eyeState.blinkCount;
  }
  
  /**
   * Reset blink counter
   */
  reset(): void {
    this.eyeState.blinkCount = 0;
    this.eyeState.lastBlinkTime = 0;
  }
}

/**
 * Head Movement Detection Service
 * 
 * Detects head movement by tracking head position changes
 */
export class HeadMovementDetectionService {
  private headPositions: HeadPosition[] = [];
  private maxHistorySize = 30; // Keep last 30 frames
  private movementThreshold = 0.02; // Minimum movement to detect
  
  /**
   * Calculate head position from landmarks
   * Uses nose tip and eye positions to estimate head center
   */
  private estimateHeadPosition(landmarks: any[]): HeadPosition {
    const noseTip = landmarks[1];
    const leftEye = landmarks[33];
    const rightEye = landmarks[263];
    
    const headX = (leftEye.x + rightEye.x) / 2;
    const headY = (noseTip.y + (leftEye.y + rightEye.y) / 2) / 2;
    const headZ = (leftEye.z + rightEye.z + noseTip.z) / 3;
    
    return {
      x: headX,
      y: headY,
      z: headZ,
      timestamp: Date.now(),
    };
  }
  
  /**
   * Calculate movement magnitude
   */
  private calculateMovement(pos1: HeadPosition, pos2: HeadPosition): number {
    const dx = pos2.x - pos1.x;
    const dy = pos2.y - pos1.y;
    const dz = pos2.z - pos1.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }
  
  /**
   * Process landmarks and detect head movement
   */
  processHeadMovement(landmarks: any[]): number {
    const position = this.estimateHeadPosition(landmarks);
    this.headPositions.push(position);
    
    // Keep only recent positions
    if (this.headPositions.length > this.maxHistorySize) {
      this.headPositions.shift();
    }
    
    // Calculate total movement
    let totalMovement = 0;
    for (let i = 1; i < this.headPositions.length; i++) {
      const movement = this.calculateMovement(
        this.headPositions[i - 1],
        this.headPositions[i]
      );
      if (movement > this.movementThreshold) {
        totalMovement += movement;
      }
    }
    
    return totalMovement;
  }
  
  /**
   * Get movement history
   */
  getMovementHistory(): HeadPosition[] {
    return [...this.headPositions];
  }
  
  /**
   * Reset movement history
   */
  reset(): void {
    this.headPositions = [];
  }
}

/**
 * Light Reflection Detection Service
 * 
 * Detects light reflection in eyes (corneal reflection)
 * Indicates genuine eye presence
 */
export class LightReflectionDetectionService {
  /**
   * Detect light reflection in eye region
   */
  detectLightReflection(
    landmarks: any[],
    imageData: ImageData | HTMLVideoElement | HTMLImageElement
  ): boolean {
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return false;
      
      // Get image dimensions
      let width: number, height: number;
      if (imageData instanceof HTMLVideoElement) {
        width = imageData.videoWidth;
        height = imageData.videoHeight;
      } else if (imageData instanceof HTMLImageElement) {
        width = imageData.width;
        height = imageData.height;
      } else {
        width = imageData.width;
        height = imageData.height;
      }
      
      canvas.width = width;
      canvas.height = height;
      
      // Draw image to canvas
      if (imageData instanceof HTMLVideoElement || imageData instanceof HTMLImageElement) {
        ctx.drawImage(imageData, 0, 0);
      } else {
        ctx.putImageData(imageData, 0, 0);
      }
      
      // Check both eyes for light reflection
      const leftEyeReflection = this.checkEyeReflection(landmarks, ctx, width, height, true);
      const rightEyeReflection = this.checkEyeReflection(landmarks, ctx, width, height, false);
      
      // Both eyes should have some light reflection
      return leftEyeReflection || rightEyeReflection;
    } catch (error) {
      console.warn('Light reflection detection failed:', error);
      return false;
    }
  }
  
  /**
   * Check for light reflection in a single eye
   */
  private checkEyeReflection(
    landmarks: any[],
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    isLeft: boolean
  ): boolean {
    // Eye center landmarks
    const eyeCenterIdx = isLeft ? 33 : 362;
    const eyeCenter = landmarks[eyeCenterIdx];
    
    if (!eyeCenter) return false;
    
    // Extract eye region (30x30 pixels around eye center)
    const eyeSize = 30;
    const x = Math.max(0, Math.min(width - eyeSize, eyeCenter.x * width - eyeSize / 2));
    const y = Math.max(0, Math.min(height - eyeSize, eyeCenter.y * height - eyeSize / 2));
    
    const imageData = ctx.getImageData(x, y, eyeSize, eyeSize);
    const data = imageData.data;
    
    // Count bright pixels (potential light reflection)
    let brightPixels = 0;
    const brightnessThreshold = 200; // 0-255 scale
    
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const brightness = 0.299 * r + 0.587 * g + 0.114 * b;
      
      if (brightness > brightnessThreshold) {
        brightPixels++;
      }
    }
    
    // At least 5% of pixels should be bright for light reflection
    const brightPixelRatio = brightPixels / (eyeSize * eyeSize);
    return brightPixelRatio > 0.05;
  }
}

/**
 * Combined Liveness Detection Service
 * 
 * Combines multiple detection methods for robust liveness verification
 */
export class CombinedLivenessDetectionService {
  private blinkDetector = new BlinkDetectionService();
  private headMovementDetector = new HeadMovementDetectionService();
  private lightReflectionDetector = new LightReflectionDetectionService();
  
  private requiredBlinks = 2;
  private requiredHeadMovement = 0.1;
  private detectionDuration = 5000; // 5 seconds
  private startTime: number | null = null;
  
  /**
   * Start liveness detection
   */
  start(): void {
    this.startTime = Date.now();
    this.blinkDetector.reset();
    this.headMovementDetector.reset();
  }
  
  /**
   * Process frame and update detection state
   */
  processFrame(
    landmarks: any[],
    imageData: ImageData | HTMLVideoElement | HTMLImageElement
  ): LivenessDetectionResult {
    if (!this.startTime) {
      this.start();
    }
    
    const blinkCount = this.blinkDetector.processBlinks(landmarks);
    const headMovement = this.headMovementDetector.processHeadMovement(landmarks);
    const lightReflection = this.lightReflectionDetector.detectLightReflection(
      landmarks,
      imageData
    );
    
    const elapsed = Date.now() - this.startTime;
    const isComplete = elapsed >= this.detectionDuration;
    
    // Determine liveness
    const blinkDetected = blinkCount >= this.requiredBlinks;
    const movementDetected = headMovement >= this.requiredHeadMovement;
    
    // Liveness is confirmed if we have blinks, head movement, and light reflection
    const isLive = blinkDetected && movementDetected && lightReflection;
    
    // Calculate confidence
    let confidence = 0;
    if (blinkDetected) confidence += 0.33;
    if (movementDetected) confidence += 0.33;
    if (lightReflection) confidence += 0.34;
    
    return {
      isLive: isLive && isComplete,
      confidence,
      method: 'combined',
      details: {
        blinks: blinkCount,
        headMovement,
        lightReflection,
      },
    };
  }
  
  /**
   * Get detection progress (0-1)
   */
  getProgress(): number {
    if (!this.startTime) return 0;
    const elapsed = Date.now() - this.startTime;
    return Math.min(1, elapsed / this.detectionDuration);
  }
  
  /**
   * Reset detection state
   */
  reset(): void {
    this.startTime = null;
    this.blinkDetector.reset();
    this.headMovementDetector.reset();
  }
}
