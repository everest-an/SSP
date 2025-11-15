import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Progress } from "./ui/progress";
import { Alert, AlertDescription } from "./ui/alert";
import { Camera, CheckCircle, XCircle, AlertTriangle, Eye, Smile, RotateCw } from "lucide-react";

interface LivenessDetectionProps {
  onSuccess: (livenessData: LivenessResult) => void;
  onError?: (error: string) => void;
}

interface LivenessResult {
  isLive: boolean;
  score: number;
  method: string;
  timestamp: Date;
}

interface DetectionChallenge {
  type: 'blink' | 'smile' | 'turn_left' | 'turn_right' | 'nod';
  instruction: string;
  icon: any;
  detected: boolean;
}

export default function LivenessDetection({ onSuccess, onError }: LivenessDetectionProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isActive, setIsActive] = useState(false);
  const [currentChallenge, setCurrentChallenge] = useState<DetectionChallenge | null>(null);
  const [completedChallenges, setCompletedChallenges] = useState<string[]>([]);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<'idle' | 'initializing' | 'detecting' | 'success' | 'failed'>('idle');
  const [message, setMessage] = useState('');
  const [stream, setStream] = useState<MediaStream | null>(null);

  const challenges: DetectionChallenge[] = [
    { type: 'blink', instruction: 'Blink your eyes', icon: Eye, detected: false },
    { type: 'smile', instruction: 'Smile at the camera', icon: Smile, detected: false },
    { type: 'turn_left', instruction: 'Turn your head left', icon: RotateCw, detected: false },
  ];

  useEffect(() => {
    return () => {
      // Cleanup: stop camera when component unmounts
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [stream]);

  const startDetection = async () => {
    try {
      setStatus('initializing');
      setMessage('Initializing camera...');
      
      // Request camera access
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user',
        },
      });

      setStream(mediaStream);

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        await videoRef.current.play();
      }

      setIsActive(true);
      setStatus('detecting');
      setMessage('Please follow the instructions');
      
      // Start with first challenge
      setCurrentChallenge(challenges[0]);
      
      // Simulate detection process
      simulateDetection();
    } catch (error) {
      console.error('Failed to start camera:', error);
      setStatus('failed');
      setMessage('Failed to access camera. Please check permissions.');
      if (onError) {
        onError('Camera access denied');
      }
    }
  };

  const simulateDetection = () => {
    let challengeIndex = 0;
    
    const interval = setInterval(() => {
      if (challengeIndex >= challenges.length) {
        clearInterval(interval);
        handleSuccess();
        return;
      }

      // Simulate challenge completion after 3 seconds
      setCompletedChallenges(prev => [...prev, challenges[challengeIndex].type]);
      setProgress(((challengeIndex + 1) / challenges.length) * 100);
      
      challengeIndex++;
      
      if (challengeIndex < challenges.length) {
        setCurrentChallenge(challenges[challengeIndex]);
      }
    }, 3000);
  };

  const handleSuccess = () => {
    setStatus('success');
    setMessage('Liveness verification successful!');
    setProgress(100);

    // Stop camera
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }

    // Call success callback
    const result: LivenessResult = {
      isLive: true,
      score: 0.95,
      method: 'challenge-response',
      timestamp: new Date(),
    };

    setTimeout(() => {
      onSuccess(result);
    }, 1500);
  };

  const reset = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
    
    setIsActive(false);
    setStatus('idle');
    setMessage('');
    setProgress(0);
    setCurrentChallenge(null);
    setCompletedChallenges([]);
    setStream(null);
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Camera className="h-5 w-5" />
          Liveness Detection
        </CardTitle>
        <CardDescription>
          Complete the challenges to verify you're a real person
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Video Preview */}
        <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
          <video
            ref={videoRef}
            className="w-full h-full object-cover"
            playsInline
            muted
          />
          
          {!isActive && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50">
              <div className="text-center text-white">
                <Camera className="h-16 w-16 mx-auto mb-4 opacity-50" />
                <p className="text-lg">Camera Preview</p>
              </div>
            </div>
          )}

          {/* Challenge Overlay */}
          {currentChallenge && status === 'detecting' && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/30">
              <div className="bg-white/90 backdrop-blur-sm rounded-lg p-6 text-center">
                <currentChallenge.icon className="h-12 w-12 mx-auto mb-3 text-blue-600" />
                <p className="text-xl font-semibold text-gray-900">
                  {currentChallenge.instruction}
                </p>
              </div>
            </div>
          )}

          {/* Success Overlay */}
          {status === 'success' && (
            <div className="absolute inset-0 flex items-center justify-center bg-green-500/20">
              <div className="bg-white rounded-lg p-6 text-center">
                <CheckCircle className="h-16 w-16 mx-auto mb-3 text-green-600" />
                <p className="text-xl font-semibold text-gray-900">Verified!</p>
              </div>
            </div>
          )}

          {/* Failed Overlay */}
          {status === 'failed' && (
            <div className="absolute inset-0 flex items-center justify-center bg-red-500/20">
              <div className="bg-white rounded-lg p-6 text-center">
                <XCircle className="h-16 w-16 mx-auto mb-3 text-red-600" />
                <p className="text-xl font-semibold text-gray-900">Failed</p>
              </div>
            </div>
          )}
        </div>

        {/* Progress Bar */}
        {isActive && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Progress</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        )}

        {/* Status Message */}
        {message && (
          <Alert variant={status === 'failed' ? 'destructive' : 'default'}>
            {status === 'success' && <CheckCircle className="h-4 w-4" />}
            {status === 'failed' && <AlertTriangle className="h-4 w-4" />}
            <AlertDescription>{message}</AlertDescription>
          </Alert>
        )}

        {/* Challenge Checklist */}
        {isActive && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Challenges:</p>
            <div className="grid grid-cols-1 gap-2">
              {challenges.map((challenge, index) => (
                <div
                  key={challenge.type}
                  className={`flex items-center gap-3 p-3 rounded-lg border ${
                    completedChallenges.includes(challenge.type)
                      ? 'bg-green-50 border-green-200'
                      : currentChallenge?.type === challenge.type
                      ? 'bg-blue-50 border-blue-200'
                      : 'bg-gray-50 border-gray-200'
                  }`}
                >
                  {completedChallenges.includes(challenge.type) ? (
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  ) : currentChallenge?.type === challenge.type ? (
                    <RotateCw className="h-5 w-5 text-blue-600 animate-spin" />
                  ) : (
                    <div className="h-5 w-5 rounded-full border-2 border-gray-300" />
                  )}
                  <span className={`text-sm ${
                    completedChallenges.includes(challenge.type)
                      ? 'text-green-700 font-medium'
                      : 'text-gray-700'
                  }`}>
                    {challenge.instruction}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2">
          {!isActive && status !== 'success' && (
            <Button onClick={startDetection} className="flex-1">
              <Camera className="h-4 w-4 mr-2" />
              Start Verification
            </Button>
          )}
          
          {isActive && status === 'detecting' && (
            <Button onClick={reset} variant="outline" className="flex-1">
              Cancel
            </Button>
          )}

          {(status === 'success' || status === 'failed') && (
            <Button onClick={reset} className="flex-1">
              Try Again
            </Button>
          )}
        </div>

        {/* Instructions */}
        {!isActive && (
          <div className="text-sm text-muted-foreground space-y-1">
            <p className="font-medium">Instructions:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Ensure good lighting and face the camera</li>
              <li>Follow each instruction carefully</li>
              <li>Complete all challenges to verify</li>
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
