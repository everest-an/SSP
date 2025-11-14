import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { FaceDetectionService } from "@/lib/mediapipe";
import { Camera, CheckCircle, XCircle, Loader2, AlertCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import DashboardLayout from "@/components/DashboardLayout";

export default function FaceRegistration() {
  const { user, isAuthenticated, loading } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [faceService, setFaceService] = useState<FaceDetectionService | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [faceDetected, setFaceDetected] = useState(false);
  const [faceEmbedding, setFaceEmbedding] = useState<number[] | null>(null);
  const [maxPaymentAmount, setMaxPaymentAmount] = useState(5000); // $50 default
  const [stripeCustomerId, setStripeCustomerId] = useState("");
  const [paymentMethodId, setPaymentMethodId] = useState("");
  const [mediapipeLoading, setMediapipeLoading] = useState(true);
  const [mediapipeError, setMediapipeError] = useState<string | null>(null);

  // Check if user already has face recognition
  const { data: existingFaceRec, isLoading: faceRecLoading } = trpc.faceRecognition.get.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  // Register face mutation
  const registerFaceMutation = trpc.faceRecognition.register.useMutation({
    onSuccess: () => {
      toast.success("Face registration successful! You can now use face payment.");
      stopCamera();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  // Initialize MediaPipe
  useEffect(() => {
    const initMediaPipe = async () => {
      try {
        setMediapipeLoading(true);
        setMediapipeError(null);
        const service = new FaceDetectionService();
        await service.initialize();
        setFaceService(service);
        setMediapipeLoading(false);
      } catch (error: any) {
        console.error("Failed to initialize MediaPipe:", error);
        setMediapipeError(error.message || "Failed to initialize face detection");
        setMediapipeLoading(false);
        toast.error("Failed to initialize face detection. Please refresh the page.");
      }
    };

    initMediaPipe();

    return () => {
      if (faceService) {
        faceService.close();
      }
    };
  }, []);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: "user" },
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        setCameraActive(true);
        startDetection();
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
    }
  };

  const startDetection = () => {
    if (!faceService || !videoRef.current || !canvasRef.current) return;

    const detectFace = async () => {
      if (!videoRef.current || !canvasRef.current || !cameraActive) return;

      try {
        const detections = await faceService.detectFaces(videoRef.current);
        
        // Draw on canvas
        const ctx = canvasRef.current.getContext("2d");
        if (ctx) {
          ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
          
          if (detections.detections && detections.detections.length > 0) {
            setFaceDetected(true);
            
            // Extract face embedding
            const embedding = faceService.extractFaceEmbedding(detections);
            if (embedding) {
              setFaceEmbedding(embedding);
            }

            // Draw bounding box
            const detection = detections.detections[0];
            const bbox = detection.boundingBox;
            if (bbox) {
              ctx.strokeStyle = "#00ff00";
              ctx.lineWidth = 3;
              ctx.strokeRect(
                bbox.originX,
                bbox.originY,
                bbox.width,
                bbox.height
              );
            }
          } else {
            setFaceDetected(false);
          }
        }
      } catch (error) {
        console.error("Face detection error:", error);
      }

      if (cameraActive) {
        requestAnimationFrame(detectFace);
      }
    };

    detectFace();
  };

  const handleRegister = () => {
    if (!faceEmbedding) {
      toast.error("Please capture your face first");
      return;
    }

    if (!faceDetected) {
      toast.error("No face detected. Please ensure your face is visible in the camera.");
      return;
    }

    registerFaceMutation.mutate({
      faceEmbedding,
      stripeCustomerId: stripeCustomerId || undefined,
      paymentMethodId: paymentMethodId || undefined,
      maxPaymentAmount,
    });
  };

  const retryMediaPipeInit = () => {
    window.location.reload();
  };

  if (loading || faceRecLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  if (!isAuthenticated) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-muted-foreground">Please log in to register your face</div>
        </div>
      </DashboardLayout>
    );
  }

  if (existingFaceRec) {
    return (
      <DashboardLayout>
        <div className="max-w-2xl mx-auto space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-6 w-6 text-green-500" />
                Face Recognition Already Registered
              </CardTitle>
              <CardDescription>
                Your face is already registered for payment authentication
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4">
                <div>
                  <Label>Stripe Customer ID</Label>
                  <p className="text-sm text-muted-foreground">{existingFaceRec.stripeCustomerId || "Not linked"}</p>
                </div>
                <div>
                  <Label>Max Auto-Payment Amount</Label>
                  <p className="text-sm text-muted-foreground">
                    ${(existingFaceRec.maxPaymentAmount / 100).toFixed(2)}
                  </p>
                </div>
                <div>
                  <Label>Status</Label>
                  <p className="text-sm text-muted-foreground">
                    {existingFaceRec.isActive ? "Active" : "Inactive"}
                  </p>
                </div>
                <div>
                  <Label>Last Used</Label>
                  <p className="text-sm text-muted-foreground">
                    {existingFaceRec.lastUsedAt
                      ? new Date(existingFaceRec.lastUsedAt).toLocaleString()
                      : "Never"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Face Registration</h1>
          <p className="text-muted-foreground">
            Register your face for seamless payment authentication
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Camera Section */}
          <Card>
            <CardHeader>
              <CardTitle>Capture Your Face</CardTitle>
              <CardDescription>
                Position your face in the frame and ensure good lighting
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative bg-black rounded-lg overflow-hidden aspect-video">
                <video
                  ref={videoRef}
                  className="w-full h-full object-cover"
                  playsInline
                />
                <canvas
                  ref={canvasRef}
                  width={640}
                  height={480}
                  className="absolute top-0 left-0 w-full h-full"
                />
                
                {!cameraActive && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Camera className="h-16 w-16 text-muted-foreground" />
                  </div>
                )}

                {cameraActive && (
                  <div className="absolute top-4 right-4">
                    {faceDetected ? (
                      <div className="flex items-center gap-2 bg-green-500 text-white px-3 py-1 rounded-full">
                        <CheckCircle className="h-4 w-4" />
                        <span className="text-sm">Face Detected</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 bg-yellow-500 text-white px-3 py-1 rounded-full">
                        <XCircle className="h-4 w-4" />
                        <span className="text-sm">No Face Detected</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                {!cameraActive ? (
                  <Button 
                    onClick={startCamera} 
                    className="flex-1"
                    disabled={mediapipeLoading || !!mediapipeError}
                  >
                    <Camera className="mr-2 h-4 w-4" />
                    {mediapipeLoading ? "Loading..." : "Start Camera"}
                  </Button>
                ) : (
                  <Button onClick={stopCamera} variant="outline" className="flex-1">
                    Stop Camera
                  </Button>
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
                      onClick={retryMediaPipeInit}
                    >
                      Retry
                    </Button>
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          {/* Configuration Section */}
          <Card>
            <CardHeader>
              <CardTitle>Payment Configuration</CardTitle>
              <CardDescription>
                Set up your payment preferences for face authentication
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="stripeCustomerId">Stripe Customer ID (Optional)</Label>
                <Input
                  id="stripeCustomerId"
                  value={stripeCustomerId}
                  onChange={(e) => setStripeCustomerId(e.target.value)}
                  placeholder="cus_..."
                />
                <p className="text-sm text-muted-foreground">
                  If you already have a Stripe customer ID, enter it here
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="paymentMethodId">Payment Method ID (Optional)</Label>
                <Input
                  id="paymentMethodId"
                  value={paymentMethodId}
                  onChange={(e) => setPaymentMethodId(e.target.value)}
                  placeholder="pm_..."
                />
                <p className="text-sm text-muted-foreground">
                  Default payment method for face payments
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="maxPaymentAmount">Max Auto-Payment Amount (USD)</Label>
                <Input
                  id="maxPaymentAmount"
                  type="number"
                  min="1"
                  step="1"
                  value={maxPaymentAmount / 100}
                  onChange={(e) => setMaxPaymentAmount(parseInt(e.target.value) * 100)}
                />
                <p className="text-sm text-muted-foreground">
                  Maximum amount that can be charged without additional confirmation
                </p>
              </div>

              <Button
                onClick={handleRegister}
                disabled={!faceEmbedding || registerFaceMutation.isPending}
                className="w-full"
              >
                {registerFaceMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Registering...
                  </>
                ) : (
                  "Register Face"
                )}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Instructions */}
        <Card>
          <CardHeader>
            <CardTitle>How It Works</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
              <li>Click "Start Camera" to activate your webcam</li>
              <li>Position your face in the frame until "Face Detected" appears</li>
              <li>Configure your payment preferences (optional)</li>
              <li>Click "Register Face" to save your facial data</li>
              <li>Your face will be linked to your Stripe account for seamless payments</li>
              <li>At checkout, simply look at the camera and make a YES gesture to pay</li>
            </ol>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
