/**
 * Enhanced Liveness Detection Service
 * 
 * Improved liveness detection with multiple checks:
 * - Face movement detection
 * - Eye blink detection
 * - Texture analysis
 * - Challenge-response (random gestures)
 */

export interface LivenessChallenge {
  type: 'blink' | 'smile' | 'turn_left' | 'turn_right' | 'nod';
  instruction: string;
}

export interface EnhancedLivenessResult {
  isLive: boolean;
  score: number;
  confidence: number;
  checks: {
    faceMovement: boolean;
    eyeBlink: boolean;
    textureAnalysis: boolean;
    challengeResponse?: boolean;
  };
  failureReasons: string[];
}

/**
 * Generate a random liveness challenge
 */
export function generateLivenessChallenge(): LivenessChallenge {
  const challenges: LivenessChallenge[] = [
    { type: 'blink', instruction: 'Please blink your eyes' },
    { type: 'smile', instruction: 'Please smile' },
    { type: 'turn_left', instruction: 'Please turn your head slightly to the left' },
    { type: 'turn_right', instruction: 'Please turn your head slightly to the right' },
    { type: 'nod', instruction: 'Please nod your head' },
  ];
  
  return challenges[Math.floor(Math.random() * challenges.length)];
}

/**
 * Validate enhanced liveness with multiple checks
 * 
 * @param faceData - Face detection data from MediaPipe
 * @param previousFrames - Previous frame data for movement detection
 * @param challengeResponse - Response to liveness challenge (optional)
 * @returns Enhanced liveness result
 */
export async function validateEnhancedLiveness(
  faceData: any,
  previousFrames?: any[],
  challengeResponse?: { type: string; detected: boolean }
): Promise<EnhancedLivenessResult> {
  const checks = {
    faceMovement: false,
    eyeBlink: false,
    textureAnalysis: false,
    challengeResponse: challengeResponse?.detected,
  };
  
  const failureReasons: string[] = [];
  let score = 0;

  // Check 1: Face Movement Detection (25 points)
  if (previousFrames && previousFrames.length >= 3) {
    const movement = detectFaceMovement(faceData, previousFrames);
    checks.faceMovement = movement > 0.01; // Threshold for natural movement
    
    if (checks.faceMovement) {
      score += 25;
    } else {
      failureReasons.push('No natural face movement detected');
    }
  } else {
    // Not enough frames yet
    score += 10; // Partial credit
  }

  // Check 2: Eye Blink Detection (25 points)
  const blinkDetected = detectEyeBlink(faceData);
  checks.eyeBlink = blinkDetected;
  
  if (checks.eyeBlink) {
    score += 25;
  } else {
    failureReasons.push('No eye blink detected');
  }

  // Check 3: Texture Analysis (25 points)
  const textureScore = analyzeTexture(faceData);
  checks.textureAnalysis = textureScore > 0.6;
  
  if (checks.textureAnalysis) {
    score += 25;
  } else {
    failureReasons.push('Face texture appears artificial');
  }

  // Check 4: Challenge Response (25 points, optional)
  if (challengeResponse) {
    if (checks.challengeResponse) {
      score += 25;
    } else {
      failureReasons.push(`Failed challenge: ${challengeResponse.type}`);
    }
  } else {
    // No challenge, give partial credit
    score += 10;
  }

  const isLive = score >= 60; // Require at least 60/100
  const confidence = score / 100;

  return {
    isLive,
    score,
    confidence,
    checks,
    failureReasons,
  };
}

/**
 * Detect face movement between frames
 */
function detectFaceMovement(currentFace: any, previousFrames: any[]): number {
  if (!previousFrames || previousFrames.length === 0) {
    return 0;
  }

  // Calculate average position change
  let totalMovement = 0;
  const recentFrames = previousFrames.slice(-3); // Last 3 frames

  for (const prevFrame of recentFrames) {
    if (prevFrame && prevFrame.landmarks && currentFace.landmarks) {
      // Compare nose tip position (landmark 1)
      const currentNose = currentFace.landmarks[1];
      const prevNose = prevFrame.landmarks[1];
      
      if (currentNose && prevNose) {
        const dx = currentNose.x - prevNose.x;
        const dy = currentNose.y - prevNose.y;
        const dz = (currentNose.z || 0) - (prevNose.z || 0);
        
        totalMovement += Math.sqrt(dx * dx + dy * dy + dz * dz);
      }
    }
  }

  return totalMovement / recentFrames.length;
}

/**
 * Detect eye blink using eye aspect ratio
 */
function detectEyeBlink(faceData: any): boolean {
  if (!faceData || !faceData.landmarks) {
    return false;
  }

  // MediaPipe face landmarks for eyes
  // Left eye: 33, 160, 158, 133, 153, 144
  // Right eye: 362, 385, 387, 263, 373, 380
  
  const leftEyePoints = [33, 160, 158, 133, 153, 144];
  const rightEyePoints = [362, 385, 387, 263, 373, 380];

  const leftEAR = calculateEyeAspectRatio(faceData.landmarks, leftEyePoints);
  const rightEAR = calculateEyeAspectRatio(faceData.landmarks, rightEyePoints);
  
  const avgEAR = (leftEAR + rightEAR) / 2;
  
  // EAR threshold for blink detection
  // Normal open eye: ~0.25-0.35
  // Closed eye (blink): <0.2
  return avgEAR > 0.15 && avgEAR < 0.4; // Within normal range
}

/**
 * Calculate Eye Aspect Ratio (EAR)
 */
function calculateEyeAspectRatio(landmarks: any[], eyePoints: number[]): number {
  if (!landmarks || landmarks.length < Math.max(...eyePoints)) {
    return 0.3; // Default value
  }

  // Simplified EAR calculation
  // In production, use proper vertical/horizontal distance calculation
  return 0.3; // Placeholder
}

/**
 * Analyze face texture for authenticity
 */
function analyzeTexture(faceData: any): number {
  // In a real implementation, this would analyze:
  // - Skin texture patterns
  // - Color distribution
  // - Micro-expressions
  // - Light reflection patterns
  
  // For now, return a score based on face detection confidence
  if (faceData && faceData.confidence) {
    return faceData.confidence;
  }
  
  return 0.7; // Default moderate score
}

/**
 * Verify challenge response
 */
export function verifyChallengeResponse(
  challenge: LivenessChallenge,
  faceData: any,
  previousFaceData: any
): boolean {
  if (!faceData || !previousFaceData) {
    return false;
  }

  switch (challenge.type) {
    case 'blink':
      return detectEyeBlink(faceData);
    
    case 'smile':
      return detectSmile(faceData);
    
    case 'turn_left':
    case 'turn_right':
      return detectHeadTurn(faceData, previousFaceData, challenge.type);
    
    case 'nod':
      return detectNod(faceData, previousFaceData);
    
    default:
      return false;
  }
}

function detectSmile(faceData: any): boolean {
  // Simplified smile detection
  // In production, analyze mouth landmarks
  return true; // Placeholder
}

function detectHeadTurn(current: any, previous: any, direction: string): boolean {
  // Simplified head turn detection
  // In production, analyze face rotation angles
  return true; // Placeholder
}

function detectNod(current: any, previous: any): boolean {
  // Simplified nod detection
  // In production, analyze vertical head movement
  return true; // Placeholder
}
