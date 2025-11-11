/**
 * AWS Rekognition Face Liveness Service
 * 
 * Integrates with AWS Rekognition's Face Liveness detection to prevent spoofing attacks.
 * Provides production-grade liveness verification using AWS's ML models.
 * 
 * Features:
 * - Real-time liveness detection
 * - Spoof detection (photos, videos, masks)
 * - Confidence scoring
 * - Audit trail
 * 
 * Based on DEVDOC-FR requirements
 */

import { 
  RekognitionClient, 
  CreateFaceLivenessSessionCommand,
  GetFaceLivenessSessionResultsCommand,
  type CreateFaceLivenessSessionCommandOutput,
  type GetFaceLivenessSessionResultsCommandOutput,
} from "@aws-sdk/client-rekognition";

// Initialize Rekognition client
const rekognitionClient = new RekognitionClient({
  region: process.env.AWS_REGION || "ap-southeast-2",
});

/**
 * Liveness detection result
 */
export interface LivenessDetectionResult {
  isLive: boolean;
  confidence: number;
  status: 'SUCCEEDED' | 'FAILED' | 'PENDING';
  auditImages?: string[]; // S3 URLs of audit images
  referenceImage?: string; // S3 URL of reference image
  spoofDetected?: boolean;
  failureReason?: string;
}

/**
 * Create a new Face Liveness session
 * 
 * This generates a session token that can be used by the frontend
 * to perform liveness detection using AWS Amplify UI components.
 * 
 * @param userId - The user ID for audit purposes
 * @param settings - Optional session settings
 * @returns Session ID and token for frontend use
 */
export async function createLivenessSession(
  userId: string,
  settings?: {
    outputConfig?: {
      s3Bucket: string;
      s3KeyPrefix: string;
    };
  }
): Promise<{
  sessionId: string;
  token?: string;
}> {
  try {
    const command = new CreateFaceLivenessSessionCommand({
      Settings: {
        OutputConfig: settings?.outputConfig ? {
          S3Bucket: settings.outputConfig.s3Bucket,
          S3KeyPrefix: settings.outputConfig.s3KeyPrefix,
        } : undefined,
        AuditImagesLimit: 4, // Store up to 4 audit images
      },
      ClientRequestToken: `${userId}-${Date.now()}`, // Idempotency token
    });

    const response: CreateFaceLivenessSessionCommandOutput = await rekognitionClient.send(command);

    if (!response.SessionId) {
      throw new Error('Failed to create liveness session: No session ID returned');
    }

    return {
      sessionId: response.SessionId,
    };
  } catch (error) {
    console.error('Rekognition createLivenessSession error:', error);
    throw new Error('Failed to create Face Liveness session');
  }
}

/**
 * Get the results of a Face Liveness session
 * 
 * Call this after the user has completed the liveness check on the frontend.
 * 
 * @param sessionId - The session ID from createLivenessSession
 * @returns Liveness detection result
 */
export async function getLivenessSessionResults(
  sessionId: string
): Promise<LivenessDetectionResult> {
  try {
    const command = new GetFaceLivenessSessionResultsCommand({
      SessionId: sessionId,
    });

    const response: GetFaceLivenessSessionResultsCommandOutput = await rekognitionClient.send(command);

    // Check if session is complete
    if (response.Status !== 'SUCCEEDED' && response.Status !== 'FAILED') {
      return {
        isLive: false,
        confidence: 0,
        status: 'PENDING',
      };
    }

    // Session failed
    if (response.Status === 'FAILED') {
      return {
        isLive: false,
        confidence: 0,
        status: 'FAILED',
        failureReason: response.StatusMessage || 'Liveness check failed',
      };
    }

    // Session succeeded - check confidence
    const confidence = response.Confidence || 0;
    const isLive = confidence >= 90; // High confidence threshold (90%)

    // Extract audit images if available
    const auditImages = response.AuditImages?.map(img => img.S3Object?.Name).filter(Boolean) as string[] | undefined;
    const referenceImage = response.ReferenceImage?.S3Object?.Name;

    return {
      isLive,
      confidence,
      status: 'SUCCEEDED',
      auditImages,
      referenceImage,
      spoofDetected: !isLive && confidence < 50, // Low confidence indicates possible spoof
    };
  } catch (error) {
    console.error('Rekognition getLivenessSessionResults error:', error);
    throw new Error('Failed to get Face Liveness session results');
  }
}

/**
 * Verify liveness for enrollment
 * 
 * High-level function that creates a session and waits for results.
 * Use this for server-side enrollment flows.
 * 
 * @param userId - The user ID
 * @param timeoutMs - Maximum time to wait for results (default: 60s)
 * @returns Liveness detection result
 */
export async function verifyLivenessForEnrollment(
  userId: string,
  timeoutMs: number = 60000
): Promise<{
  sessionId: string;
  result: LivenessDetectionResult;
}> {
  // Create session
  const { sessionId } = await createLivenessSession(userId);

  // Poll for results (in production, use webhooks or event-driven approach)
  const startTime = Date.now();
  const pollInterval = 2000; // Poll every 2 seconds

  while (Date.now() - startTime < timeoutMs) {
    const result = await getLivenessSessionResults(sessionId);

    if (result.status !== 'PENDING') {
      return { sessionId, result };
    }

    // Wait before next poll
    await new Promise(resolve => setTimeout(resolve, pollInterval));
  }

  // Timeout
  throw new Error('Liveness verification timeout');
}

/**
 * Validate liveness result for enrollment
 * 
 * Checks if the liveness result meets the requirements for face enrollment.
 * 
 * @param result - The liveness detection result
 * @returns True if liveness check passed and meets enrollment requirements
 */
export function isLivenessResultValid(result: LivenessDetectionResult): boolean {
  return (
    result.status === 'SUCCEEDED' &&
    result.isLive &&
    result.confidence >= 90 &&
    !result.spoofDetected
  );
}

/**
 * Get recommended liveness method based on risk level
 * 
 * @param riskLevel - The risk level (low, medium, high)
 * @returns Recommended liveness detection method
 */
export function getRecommendedLivenessMethod(riskLevel: 'low' | 'medium' | 'high'): {
  method: 'rekognition' | 'active_challenge' | 'hybrid';
  minConfidence: number;
} {
  switch (riskLevel) {
    case 'high':
      return {
        method: 'hybrid', // Use both Rekognition + active challenges
        minConfidence: 95,
      };
    case 'medium':
      return {
        method: 'rekognition',
        minConfidence: 90,
      };
    case 'low':
      return {
        method: 'active_challenge',
        minConfidence: 80,
      };
  }
}
