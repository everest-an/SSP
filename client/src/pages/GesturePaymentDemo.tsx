/**
 * Gesture Payment Demo Page
 * Demonstrates the gesture recognition and payment state machine
 */

import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { GestureRecognitionService, PaymentStateMachine, type PaymentState } from "@/lib/mediapipe";
import { GestureIndicator, StateMachineIndicator, HandTrackingOverlay } from "@/components/GestureIndicator";
import { Camera, AlertCircle, Loader2, StopCircle } from "lucide-react";
import { toast } from "sonner";

export default function GesturePaymentDemo() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const [gestureService, setGestureService] = useState<GestureRecognitionService | null>(null);
  const [stateMachine] = useState(() => new PaymentStateMachine());
  
  const [cameraActive, setCameraActive] = useState(false);
  const [mediapipeLoading, setMediapipeLoading] = useState(true);
  const [mediapipeError, setMediapipeError] = useState<string | null>(null);
  
  const [thumbsUpDetected, setThumbsUpDetected] = useState(false);
  const [thumbsUpConfidence, setThumbsUpConfidence] = useState(0);
  const [pickUpDetected, setPickUpDetected] = useState(false);
  const [pickUpConfidence, setPickUpConfidence] = useState(0);
  
  const [handLandmarks, setHandLandmarks] = useState<Array<{ x: number; y: number; z: number }> | null>(null);
  const [currentState, setCurrentState] = useState<PaymentState>("S0_waiting");

  // Initialize MediaPipe
  useEffect(() => {
    const initMediaPipe = async () => {
      try {
        setMediapipeLoading(true);
        setMediapipeError(null);
        const service = new GestureRecognitionService();
        await service.initialize();
        setGestureService(service);
        setMediapipeLoading(false);
        toast.success("Gesture recognition initialized");
      } catch (error: any) {
        console.error("Failed to initialize MediaPipe:", error);
        setMediapipeError(error.message || "Failed to initialize gesture recognition");
        setMediapipeLoading(false);
        toast.error("Failed to initialize gesture recognition");
      }
    };

    initMediaPipe();

    return () => {
      if (gestureService) {
        gestureService.close();
      }
    };
  }, []);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720, facingMode: "user" },
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setCameraActive(true);
        startDetection();
        toast.success("Camera started");
      }
    } catch (error) {
      console.error("Failed to start camera:", error);
      toast.error("Failed to access camera");
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
      setCameraActive(false);
      toast.info("Camera stopped");
    }
  };

  const startDetection = () => {
    if (!gestureService || !videoRef.current || !canvasRef.current) return;

    const detectGestures = async () => {
      if (!videoRef.current || !canvasRef.current || !cameraActive) return;

      try {
        const results = await gestureService.recognizeGesture(videoRef.current);
        
        // Detect thumbs up
        const thumbsUp = gestureService.detectThumbsUpGesture(results);
        setThumbsUpDetected(thumbsUp.detected);
        setThumbsUpConfidence(thumbsUp.confidence * 100);

        // Detect pick up
        const pickUp = gestureService.detectPickUpGesture(results);
        setPickUpDetected(pickUp.detected);
        setPickUpConfidence(pickUp.confidence * 100);

        // Update hand landmarks for visualization
        if (results.landmarks && results.landmarks.length > 0) {
          setHandLandmarks(results.landmarks[0]);
        } else {
          setHandLandmarks(null);
        }

        // Update state machine (simplified demo)
        const stateUpdate = stateMachine.update({
          faceDetected: true, // Assume face is detected for demo
          userId: 1,
          handDetected: results.landmarks && results.landmarks.length > 0,
          handPosition: thumbsUp.handPosition || pickUp.handPosition || null,
          pickupGestureDetected: pickUp.detected,
          confidence: pickUp.confidence,
          productId: 1, // Demo product
          productBounds: { x: 0.3, y: 0.3, width: 0.4, height: 0.4 }, // Demo bounds
        });

        setCurrentState(stateMachine.getState().currentState);

        if (stateUpdate.shouldTriggerPayment) {
          toast.success("Payment triggered!");
        }

        // Draw on canvas
        const ctx = canvasRef.current.getContext("2d");
        if (ctx) {
          ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        }
      } catch (error) {
        console.error("Gesture detection error:", error);
      }

      if (cameraActive) {
        requestAnimationFrame(detectGestures);
      }
    };

    detectGestures();
  };

  const resetStateMachine = () => {
    stateMachine.reset();
    setCurrentState("S0_waiting");
    toast.info("State machine reset");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-100 dark:from-gray-900 dark:to-gray-800 p-4">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold">Gesture Payment Demo</h1>
          <p className="text-muted-foreground">Test hand gesture recognition and payment flow</p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Camera Section */}
          <Card>
            <CardHeader>
              <CardTitle>Camera Feed</CardTitle>
              <CardDescription>
                {cameraActive ? "Showing live camera feed with hand tracking" : "Start camera to begin"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative bg-black rounded-lg overflow-hidden aspect-video">
                <video
                  ref={videoRef}
                  className="w-full h-full object-cover"
                  playsInline
                  muted
                />
                <canvas
                  ref={canvasRef}
                  width={1280}
                  height={720}
                  className="absolute top-0 left-0 w-full h-full"
                />

                {/* Hand Tracking Overlay */}
                {handLandmarks && (
                  <HandTrackingOverlay
                    landmarks={handLandmarks}
                    width={1280}
                    height={720}
                    detected={thumbsUpDetected || pickUpDetected}
                  />
                )}

                {!cameraActive && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Camera className="h-24 w-24 text-muted-foreground" />
                  </div>
                )}
              </div>

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

              <div className="flex gap-2">
                {!cameraActive ? (
                  <Button 
                    onClick={startCamera} 
                    className="flex-1"
                    disabled={mediapipeLoading || !!mediapipeError}
                  >
                    {mediapipeLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Loading...
                      </>
                    ) : (
                      <>
                        <Camera className="mr-2 h-4 w-4" />
                        Start Camera
                      </>
                    )}
                  </Button>
                ) : (
                  <Button onClick={stopCamera} variant="outline" className="flex-1">
                    <StopCircle className="mr-2 h-4 w-4" />
                    Stop Camera
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Gesture Recognition Section */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Gesture Recognition</CardTitle>
                <CardDescription>Real-time gesture detection results</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <GestureIndicator
                  detected={thumbsUpDetected}
                  confidence={thumbsUpConfidence}
                  type="thumbs_up"
                />

                <GestureIndicator
                  detected={pickUpDetected}
                  confidence={pickUpConfidence}
                  type="pick_up"
                />

                <Alert>
                  <AlertDescription className="text-sm">
                    <strong>Tips:</strong>
                    <ul className="list-disc list-inside mt-2 space-y-1">
                      <li>Show 👍 thumbs up for confirmation</li>
                      <li>Make a fist ✊ for pick up gesture</li>
                      <li>Ensure good lighting and clear hand visibility</li>
                    </ul>
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Payment State Machine</CardTitle>
                <CardDescription>5-state payment flow visualization</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <StateMachineIndicator currentState={currentState} />

                <Button onClick={resetStateMachine} variant="outline" className="w-full">
                  Reset State Machine
                </Button>

                <Alert>
                  <AlertDescription className="text-xs">
                    <strong>States:</strong>
                    <ul className="list-disc list-inside mt-1 space-y-0.5">
                      <li><strong>S0:</strong> Waiting for user</li>
                      <li><strong>S1:</strong> Hand approaching product</li>
                      <li><strong>S2:</strong> Product picked up</li>
                      <li><strong>S3:</strong> Checking out</li>
                      <li><strong>S4:</strong> Payment completed</li>
                    </ul>
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
