/**
 * Liveness Challenge Service
 * Generates and verifies active liveness challenges (blink, turn, smile, nod)
 * 
 * Sprint 3 Phase 4: Enhanced Liveness Detection
 */

export type ChallengeType = 'blink' | 'turn_left' | 'turn_right' | 'smile' | 'nod' | 'open_mouth';

export interface LivenessChallenge {
  type: ChallengeType;
  instruction: string;
  instructionZh: string;  // Chinese instruction
  timeout: number;  // milliseconds
  icon: string;  // Emoji or icon
}

export interface ChallengeResponse {
  challenge: LivenessChallenge;
  completed: boolean;
  timestamp: number;
  confidence: number;  // 0-1
}

export interface LivenessChallengeResult {
  challenges: ChallengeResponse[];
  overallSuccess: boolean;
  averageConfidence: number;
  duration: number;  // milliseconds
}

/**
 * Liveness Challenge Service
 * Generates random challenges and verifies user responses
 */
export class LivenessChallengeService {
  private static readonly CHALLENGES: LivenessChallenge[] = [
    {
      type: 'blink',
      instruction: 'Please blink twice',
      instructionZh: '请眨眼两次',
      timeout: 5000,
      icon: '👁️'
    },
    {
      type: 'turn_left',
      instruction: 'Please turn your head left',
      instructionZh: '请向左转头',
      timeout: 3000,
      icon: '⬅️'
    },
    {
      type: 'turn_right',
      instruction: 'Please turn your head right',
      instructionZh: '请向右转头',
      timeout: 3000,
      icon: '➡️'
    },
    {
      type: 'smile',
      instruction: 'Please smile',
      instructionZh: '请微笑',
      timeout: 3000,
      icon: '😊'
    },
    {
      type: 'nod',
      instruction: 'Please nod your head',
      instructionZh: '请点头',
      timeout: 3000,
      icon: '⬇️'
    },
    {
      type: 'open_mouth',
      instruction: 'Please open your mouth',
      instructionZh: '请张开嘴巴',
      timeout: 3000,
      icon: '😮'
    }
  ];

  /**
   * Generate a random set of challenges
   * @param count Number of challenges to generate (default: 2)
   * @returns Array of challenges
   */
  generateChallenges(count: number = 2): LivenessChallenge[] {
    const shuffled = [...LivenessChallengeService.CHALLENGES].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, Math.min(count, shuffled.length));
  }

  /**
   * Verify challenge response using MediaPipe Face Mesh
   * @param challenge The challenge to verify
   * @param faceLandmarks MediaPipe face landmarks (468 points)
   * @param previousLandmarks Previous frame's landmarks for motion detection
   * @returns Confidence score (0-1)
   */
  verifyChallengeResponse(
    challenge: LivenessChallenge,
    faceLandmarks: any[],
    previousLandmarks?: any[]
  ): number {
    if (!faceLandmarks || faceLandmarks.length === 0) {
      return 0;
    }

    switch (challenge.type) {
      case 'blink':
        return this.detectBlink(faceLandmarks);
      
      case 'turn_left':
        return this.detectHeadTurn(faceLandmarks, 'left');
      
      case 'turn_right':
        return this.detectHeadTurn(faceLandmarks, 'right');
      
      case 'smile':
        return this.detectSmile(faceLandmarks);
      
      case 'nod':
        return this.detectNod(faceLandmarks, previousLandmarks);
      
      case 'open_mouth':
        return this.detectOpenMouth(faceLandmarks);
      
      default:
        return 0;
    }
  }

  /**
   * Detect blink using eye landmarks
   * Eye landmarks: left eye (362, 385, 387, 263, 373, 380)
   *                right eye (33, 160, 158, 133, 153, 144)
   */
  private detectBlink(landmarks: any[]): number {
    try {
      // Left eye
      const leftTop = landmarks[159];
      const leftBottom = landmarks[145];
      const leftLeft = landmarks[33];
      const leftRight = landmarks[133];
      
      // Right eye
      const rightTop = landmarks[386];
      const rightBottom = landmarks[374];
      const rightLeft = landmarks[362];
      const rightRight = landmarks[263];
      
      // Calculate Eye Aspect Ratio (EAR)
      const leftEAR = this.calculateEAR(leftTop, leftBottom, leftLeft, leftRight);
      const rightEAR = this.calculateEAR(rightTop, rightBottom, rightLeft, rightRight);
      
      const avgEAR = (leftEAR + rightEAR) / 2;
      
      // EAR < 0.2 indicates closed eyes
      if (avgEAR < 0.2) {
        return 0.9;  // High confidence for blink
      } else if (avgEAR < 0.25) {
        return 0.6;  // Medium confidence
      }
      
      return 0.1;  // Eyes open, no blink
    } catch (error) {
      console.error('Error detecting blink:', error);
      return 0;
    }
  }

  /**
   * Calculate Eye Aspect Ratio (EAR)
   */
  private calculateEAR(top: any, bottom: any, left: any, right: any): number {
    const vertical = Math.sqrt(
      Math.pow(top.x - bottom.x, 2) + Math.pow(top.y - bottom.y, 2)
    );
    const horizontal = Math.sqrt(
      Math.pow(left.x - right.x, 2) + Math.pow(left.y - right.y, 2)
    );
    return vertical / horizontal;
  }

  /**
   * Detect head turn using nose and face contour landmarks
   * Nose tip: 1, Face contours: left (234), right (454)
   */
  private detectHeadTurn(landmarks: any[], direction: 'left' | 'right'): number {
    try {
      const noseTip = landmarks[1];
      const leftContour = landmarks[234];
      const rightContour = landmarks[454];
      
      // Calculate horizontal position ratio
      const faceWidth = Math.abs(rightContour.x - leftContour.x);
      const noseOffset = noseTip.x - leftContour.x;
      const ratio = noseOffset / faceWidth;
      
      if (direction === 'left') {
        // Nose should be closer to left side (ratio < 0.4)
        if (ratio < 0.35) return 0.9;
        if (ratio < 0.4) return 0.7;
        if (ratio < 0.45) return 0.4;
      } else {
        // Nose should be closer to right side (ratio > 0.6)
        if (ratio > 0.65) return 0.9;
        if (ratio > 0.6) return 0.7;
        if (ratio > 0.55) return 0.4;
      }
      
      return 0.1;
    } catch (error) {
      console.error('Error detecting head turn:', error);
      return 0;
    }
  }

  /**
   * Detect smile using mouth landmarks
   * Mouth corners: left (61), right (291)
   * Mouth top: (13), bottom: (14)
   */
  private detectSmile(landmarks: any[]): number {
    try {
      const leftCorner = landmarks[61];
      const rightCorner = landmarks[291];
      const mouthTop = landmarks[13];
      const mouthBottom = landmarks[14];
      
      // Calculate mouth width and height
      const mouthWidth = Math.sqrt(
        Math.pow(rightCorner.x - leftCorner.x, 2) + 
        Math.pow(rightCorner.y - leftCorner.y, 2)
      );
      const mouthHeight = Math.abs(mouthBottom.y - mouthTop.y);
      
      // Smile ratio (wider mouth = smile)
      const ratio = mouthWidth / mouthHeight;
      
      // Also check if corners are raised
      const avgCornerY = (leftCorner.y + rightCorner.y) / 2;
      const mouthCenterY = (mouthTop.y + mouthBottom.y) / 2;
      const cornerRaise = mouthCenterY - avgCornerY;
      
      if (ratio > 3.5 && cornerRaise > 0.01) return 0.9;
      if (ratio > 3.0 && cornerRaise > 0.005) return 0.7;
      if (ratio > 2.5) return 0.4;
      
      return 0.1;
    } catch (error) {
      console.error('Error detecting smile:', error);
      return 0;
    }
  }

  /**
   * Detect nod using vertical head movement
   */
  private detectNod(landmarks: any[], previousLandmarks?: any[]): number {
    if (!previousLandmarks || previousLandmarks.length === 0) {
      return 0;
    }

    try {
      const noseTip = landmarks[1];
      const prevNoseTip = previousLandmarks[1];
      
      // Calculate vertical movement
      const verticalMovement = Math.abs(noseTip.y - prevNoseTip.y);
      
      // Significant downward movement indicates nod
      if (verticalMovement > 0.05) return 0.9;
      if (verticalMovement > 0.03) return 0.7;
      if (verticalMovement > 0.02) return 0.4;
      
      return 0.1;
    } catch (error) {
      console.error('Error detecting nod:', error);
      return 0;
    }
  }

  /**
   * Detect open mouth using mouth landmarks
   */
  private detectOpenMouth(landmarks: any[]): number {
    try {
      const mouthTop = landmarks[13];
      const mouthBottom = landmarks[14];
      const leftCorner = landmarks[61];
      const rightCorner = landmarks[291];
      
      // Calculate mouth opening
      const mouthHeight = Math.abs(mouthBottom.y - mouthTop.y);
      const mouthWidth = Math.sqrt(
        Math.pow(rightCorner.x - leftCorner.x, 2) + 
        Math.pow(rightCorner.y - leftCorner.y, 2)
      );
      
      // Open mouth ratio (height/width)
      const ratio = mouthHeight / mouthWidth;
      
      if (ratio > 0.6) return 0.9;
      if (ratio > 0.4) return 0.7;
      if (ratio > 0.3) return 0.4;
      
      return 0.1;
    } catch (error) {
      console.error('Error detecting open mouth:', error);
      return 0;
    }
  }

  /**
   * Calculate overall liveness score from challenge responses
   */
  calculateLivenessScore(responses: ChallengeResponse[]): number {
    if (responses.length === 0) return 0;
    
    const totalConfidence = responses.reduce((sum, r) => sum + r.confidence, 0);
    return totalConfidence / responses.length;
  }

  /**
   * Determine if liveness check passed
   * @param responses Challenge responses
   * @param threshold Minimum average confidence required (default: 0.7)
   */
  isLivenessPassed(responses: ChallengeResponse[], threshold: number = 0.7): boolean {
    const score = this.calculateLivenessScore(responses);
    const allCompleted = responses.every(r => r.completed);
    return allCompleted && score >= threshold;
  }
}

// Singleton instance
let livenessService: LivenessChallengeService | null = null;

export function getLivenessService(): LivenessChallengeService {
  if (!livenessService) {
    livenessService = new LivenessChallengeService();
  }
  return livenessService;
}
