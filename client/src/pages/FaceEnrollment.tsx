/**
 * Face Enrollment Page
 * 
 * Guides users through the face enrollment process:
 * 1. Camera permission request
 * 2. Liveness challenges
 * 3. Face capture
 * 4. Enrollment confirmation
 */

import React, { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useCamera } from '@/hooks/useCamera';
import { createFaceMesh, captureBestFrame, type FaceEmbeddingResult } from '@/services/faceDetection';
import { FaceMesh } from '@mediapipe/face_mesh';
import { LivenessChallenge as LivenessChallengeType } from '@/components/LivenessChallenge';
import { LivenessChallenge } from '@/components/LivenessChallenge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { trpc } from '@/lib/trpc';
import { Camera, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

type EnrollmentStep = 'intro' | 'camera_setup' | 'liveness_challenges' | 'capturing' | 'processing' | 'success' | 'error';

export function FaceEnrollment() {
  const [, setLocation] = useLocation();
  const [step, setStep] = useState<EnrollmentStep>('intro');
  const [challenges, setChallenges] = useState<LivenessChallengeType[]>([]);
  const [currentChallengeIndex, setCurrentChallengeIndex] = useState(0);
  const [capturedFrames, setCapturedFrames] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [mediapipeLoading, setMediapipeLoading] = useState(true);
  const [mediapipeError, setMediapipeError] = useState<string | null>(null);

  const { videoRef, isStreaming, error: cameraError, startCamera, stopCamera, captureFrames } = useCamera();
  const [faceMesh, setFaceMesh] = useState<FaceMesh | null>(null);

  const generateChallengesMutation = trpc.faceAuth.generateLivenessChallenges.useMutation();
  const enrollFaceMutation = trpc.faceAuth.enrollFace.useMutation();

  // Initialize MediaPipe Face Mesh
  useEffect(() => {
    const initFaceMesh = async () => {
      try {
        setMediapipeLoading(true);
        setMediapipeError(null);
        const mesh = createFaceMesh((results) => {
          // Results will be processed in captureBestFrame
        });
        setFaceMesh(mesh);
        setMediapipeLoading(false);
      } catch (error: any) {
        console.error('Failed to initialize MediaPipe:', error);
        setMediapipeError(error.message || 'Failed to initialize face detection');
        setMediapipeLoading(false);
      }
    };

    initFaceMesh();

    return () => {
      // Cleanup
      if (faceMesh) {
        faceMesh.close();
      }
    };
  }, []);

  // Generate liveness challenges
  const handleGenerateChallenges = async () => {
    try {
      const result = await generateChallengesMutation.mutateAsync({
        count: 2,
        method: 'active_challenge',
      });

      setChallenges(result.challenges);
      setStep('camera_setup');
    } catch (err) {
      setError('Failed to generate liveness challenges');
      setStep('error');
    }
  };

  // Start camera and begin challenges
  const handleStartCamera = async () => {
    try {
      await startCamera();
      setStep('liveness_challenges');
    } catch (err) {
      setError(cameraError || 'Failed to start camera');
      setStep('error');
    }
  };

  // Handle challenge completion
  const handleChallengeComplete = (index: number) => {
    if (index === challenges.length - 1) {
      // All challenges completed, start capturing
      handleStartCapture();
    } else {
      // Move to next challenge
      setCurrentChallengeIndex(index + 1);
    }
  };

  // Capture video frames
  const handleStartCapture = async () => {
    setStep('capturing');

    try {
      // Capture 30 frames over 3 seconds (10 FPS)
      const frames = await captureFrames(30, 100);
      setCapturedFrames(frames);
      setStep('processing');

      // Process enrollment
      await handleEnrollFace(frames);
    } catch (err) {
      setError('Failed to capture video frames');
      setStep('error');
    }
  };

  // Enroll face with backend
  const handleEnrollFace = async (frames: string[]) => {
    try {
      // Generate real face embedding using MediaPipe
      if (!faceMesh || !videoRef.current) {
        throw new Error('Face detection not initialized');
      }

      const embeddingResult = await captureBestFrame(faceMesh, videoRef.current, 5, 128);
      
      if (!embeddingResult) {
        throw new Error('Failed to generate face embedding. Please ensure your face is clearly visible.');
      }

      const embedding = embeddingResult.embedding;

      const result = await enrollFaceMutation.mutateAsync({
        embedding: embedding,
        videoFrames: frames,
        challenges: challenges,
        enrollmentQuality: embeddingResult.quality,
        deviceFingerprint: navigator.userAgent,
      });

      if (result.success) {
        setStep('success');
        stopCamera();

        // Redirect to dashboard after 3 seconds
        setTimeout(() => {
          setLocation('/dashboard');
        }, 3000);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to enroll face';
      setError(errorMessage);
      setStep('error');
    }
  };

  // Retry enrollment
  const handleRetry = () => {
    setError(null);
    setCapturedFrames([]);
    setCurrentChallengeIndex(0);
    setStep('intro');
    stopCamera();
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold">Face Enrollment</h1>
          <p className="text-muted-foreground">
            Set up face authentication for secure, password-free access
          </p>
        </div>

        {/* Content based on step */}
        <div className="flex flex-col items-center gap-6">
          {/* Intro Step */}
          {step === 'intro' && (
            <Card className="w-full max-w-md">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Camera className="h-5 w-5" />
                  Get Started
                </CardTitle>
                <CardDescription>
                  We'll guide you through a quick enrollment process
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <h3 className="font-medium">What to expect:</h3>
                  <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                    <li>Camera permission request</li>
                    <li>2-3 simple liveness challenges (blink, turn head, etc.)</li>
                    <li>Quick face capture (3 seconds)</li>
                    <li>Secure encryption and storage</li>
                  </ul>
                </div>

                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    <strong>Privacy:</strong> Your face data is encrypted and stored securely.
                    It's never shared with third parties.
                  </AlertDescription>
                </Alert>

                {mediapipeError && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      {mediapipeError}
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="mt-2 w-full"
                        onClick={() => window.location.reload()}
                      >
                        Retry
                      </Button>
                    </AlertDescription>
                  </Alert>
                )}

                <Button
                  onClick={handleGenerateChallenges}
                  disabled={generateChallengesMutation.isPending || mediapipeLoading || !!mediapipeError}
                  className="w-full"
                >
                  {generateChallengesMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Preparing...
                    </>
                  ) : mediapipeLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Loading Face Detection...
                    </>
                  ) : (
                    'Start Enrollment'
                  )}
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Camera Setup Step */}
          {step === 'camera_setup' && (
            <Card className="w-full max-w-md">
              <CardHeader>
                <CardTitle>Camera Access</CardTitle>
                <CardDescription>
                  We need access to your camera to capture your face
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Alert>
                  <Camera className="h-4 w-4" />
                  <AlertDescription className="text-sm">
                    Please allow camera access when prompted by your browser.
                    Make sure you're in a well-lit area.
                  </AlertDescription>
                </Alert>

                <Button
                  onClick={handleStartCamera}
                  className="w-full"
                >
                  Enable Camera
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Liveness Challenges Step */}
          {step === 'liveness_challenges' && (
            <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Video Preview */}
              <Card>
                <CardHeader>
                  <CardTitle>Camera Preview</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-cover mirror"
                      style={{ transform: 'scaleX(-1)' }}
                    />
                    {!isStreaming && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Loader2 className="h-8 w-8 animate-spin text-white" />
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Challenges */}
              <LivenessChallenge
                challenges={challenges}
                currentChallengeIndex={currentChallengeIndex}
                onChallengeComplete={handleChallengeComplete}
                autoAdvance={true}
                autoAdvanceDelay={3000}
              />
            </div>
          )}

          {/* Capturing Step */}
          {step === 'capturing' && (
            <Card className="w-full max-w-md">
              <CardHeader>
                <CardTitle>Capturing...</CardTitle>
                <CardDescription>
                  Please hold still while we capture your face
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col items-center gap-4">
                  <Loader2 className="h-12 w-12 animate-spin text-primary" />
                  <Progress value={66} className="w-full" />
                  <p className="text-sm text-muted-foreground">
                    Capturing video frames...
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Processing Step */}
          {step === 'processing' && (
            <Card className="w-full max-w-md">
              <CardHeader>
                <CardTitle>Processing...</CardTitle>
                <CardDescription>
                  Encrypting and storing your face data securely
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col items-center gap-4">
                  <Loader2 className="h-12 w-12 animate-spin text-primary" />
                  <Progress value={90} className="w-full" />
                  <p className="text-sm text-muted-foreground">
                    {enrollFaceMutation.isPending ? 'Enrolling face...' : 'Almost done...'}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Success Step */}
          {step === 'success' && (
            <Card className="w-full max-w-md">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-green-600">
                  <CheckCircle2 className="h-5 w-5" />
                  Enrollment Successful!
                </CardTitle>
                <CardDescription>
                  Your face has been enrolled successfully
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Alert className="border-green-500 bg-green-50">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <AlertDescription>
                    You can now use face authentication to log in and make payments.
                    Redirecting to dashboard...
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          )}

          {/* Error Step */}
          {step === 'error' && (
            <Card className="w-full max-w-md">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-red-600">
                  <AlertCircle className="h-5 w-5" />
                  Enrollment Failed
                </CardTitle>
                <CardDescription>
                  We encountered an error during enrollment
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    {error || 'An unknown error occurred'}
                  </AlertDescription>
                </Alert>

                <div className="flex gap-2">
                  <Button onClick={handleRetry} className="flex-1">
                    Try Again
                  </Button>
                  <Button onClick={() => setLocation('/dashboard')} variant="outline" className="flex-1">
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <style>{`
        .mirror {
          transform: scaleX(-1);
        }
      `}</style>
    </div>
  );
}
