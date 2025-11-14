import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { FaceDetectionService, GestureRecognitionService } from "@/lib/mediapipe";
import { trpc } from "@/lib/trpc";
import { Camera, CheckCircle, XCircle, Loader2, ThumbsUp, User, Wallet, CreditCard } from "lucide-react";
import { toast } from "sonner";
import { useWebSocket } from "@/hooks/useWebSocket";
import { useMetaMask } from "@/hooks/useMetaMask";
import { FacePaymentConfirm } from "@/components/FacePaymentConfirm";
import { PaymentMethodSelector } from "@/components/PaymentMethodSelector";

type PaymentStep = "idle" | "face_detection" | "product_selection" | "gesture_confirmation" | "processing" | "completed" | "failed";

interface DetectedUser {
  id: number;
  name: string;
  faceEmbedding: number[];
  walletType: "custodial" | "non_custodial";
  balance: number;
  currency: string;
}

interface SelectedProduct {
  id: number;
  name: string;
  price: number;
  currency: string;
  imageUrl?: string;
}

export default function DevicePayment() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const [faceService, setFaceService] = useState<FaceDetectionService | null>(null);
  const [gestureService, setGestureService] = useState<GestureRecognitionService | null>(null);
  
  const [cameraActive, setCameraActive] = useState(false);
  const [currentStep, setCurrentStep] = useState<PaymentStep>("idle");
  
  const [faceDetected, setFaceDetected] = useState(false);
  const [detectedUser, setDetectedUser] = useState<DetectedUser | null>(null);
  
  const [thumbsUpDetected, setThumbsUpDetected] = useState(false);
  const [gestureConfidence, setGestureConfidence] = useState(0);
  
  const [selectedProduct, setSelectedProduct] = useState<SelectedProduct | null>(null);
  const [showFacePaymentConfirm, setShowFacePaymentConfirm] = useState(false);
  const [showPaymentMethodSelector, setShowPaymentMethodSelector] = useState(false);
  const [selectedPaymentMethodId, setSelectedPaymentMethodId] = useState<number | null>(null);
  const [selectedPaymentType, setSelectedPaymentType] = useState<'card' | 'metamask' | null>(null);
  const [faceVerificationAttempted, setFaceVerificationAttempted] = useState(false);
  const [mediapipeLoading, setMediapipeLoading] = useState(true);
  const [mediapipeError, setMediapipeError] = useState<string | null>(null);
  
  // Get device and merchant ID from URL params or use defaults
  const [deviceId] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return Number(params.get('deviceId')) || 1;
  });
  const [merchantId] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return Number(params.get('merchantId')) || 1;
  });

  // WebSocket connection for real-time updates
  const { isConnected: wsConnected, lastMessage } = useWebSocket({
    deviceId,
    merchantId,
    onOrderUpdate: (data) => {
      console.log("[DevicePayment] Order update:", data);
      if (data.status === "completed") {
        setCurrentStep("completed");
      } else if (data.status === "failed") {
        setCurrentStep("failed");
      }
    },
    onPaymentStatus: (data) => {
      console.log("[DevicePayment] Payment status:", data);
    },
  });

  // Verify face recognition
  const verifyFaceMutation = trpc.faceRecognition.verify.useMutation({
    onSuccess: (data) => {
      if (data.verified && data.user) {
        setDetectedUser({
          id: data.user.id,
          name: data.user.name || "Unknown User",
          faceEmbedding: data.faceEmbedding,
          walletType: data.wallet?.walletType || "custodial",
          balance: data.wallet?.balance || 0,
          currency: data.wallet?.currency || "USD",
        });
        setCurrentStep("product_selection");
        toast.success(`Welcome, ${data.user.name}!`);
      } else {
        toast.error("Face not recognized. Please register first.");
        setCurrentStep("idle");
      }
    },
    onError: (error) => {
      toast.error(error.message);
      setCurrentStep("idle");
    },
  });

  // Get available products for this device
  const { data: availableProducts } = trpc.deviceProduct.getByDevice.useQuery(
    { deviceId },
    { enabled: currentStep === "product_selection" }
  );

  // MetaMask hook for crypto payments
  const metamask = useMetaMask();

  // Create realtime order
  const createOrderMutation = trpc.realtimeOrder.createRealtimeOrder.useMutation({
    onSuccess: (data) => {
      setCurrentStep("completed");
      toast.success(`Payment successful! Order ${data.order.orderNumber}`);
      
      // Reset after 3 seconds
      setTimeout(() => {
        resetPayment();
      }, 3000);
    },
    onError: (error) => {
      setCurrentStep("failed");
      toast.error(`Payment failed: ${error.message}`);
      
      // Reset after 3 seconds
      setTimeout(() => {
        resetPayment();
      }, 3000);
    },
  });

  // Initialize MediaPipe
  useEffect(() => {
    const initMediaPipe = async () => {
      try {
        setMediapipeLoading(true);
        setMediapipeError(null);
        
        const face = new FaceDetectionService();
        await face.initialize();
        setFaceService(face);

        const gesture = new GestureRecognitionService();
        await gesture.initialize();
        setGestureService(gesture);
        
        console.log("[DevicePayment] MediaPipe initialized");
        setMediapipeLoading(false);
      } catch (error: any) {
        console.error("[DevicePayment] Failed to initialize MediaPipe:", error);
        setMediapipeError(error.message || "Failed to initialize camera services");
        setMediapipeLoading(false);
        toast.error("Failed to initialize camera services. Please refresh the page.");
      }
    };

    initMediaPipe();

    return () => {
      if (faceService) faceService.close();
      if (gestureService) gestureService.close();
    };
  }, []);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720, facingMode: "user" },
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        setCameraActive(true);
        setCurrentStep("face_detection");
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
    if (!faceService || !gestureService || !videoRef.current || !canvasRef.current) return;

    const detect = async () => {
      if (!videoRef.current || !canvasRef.current || !cameraActive) return;

      try {
        const ctx = canvasRef.current.getContext("2d");
        if (!ctx) return;

        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);

        // Detect face
        const faceDetections = await faceService.detectFaces(videoRef.current);
        const hasFace = faceDetections.detections && faceDetections.detections.length > 0;
        setFaceDetected(hasFace);

        if (hasFace) {
          // Draw face bounding box
          const detection = faceDetections.detections[0];
          const bbox = detection.boundingBox;
          if (bbox) {
            ctx.strokeStyle = "#00ff00";
            ctx.lineWidth = 3;
            ctx.strokeRect(bbox.originX, bbox.originY, bbox.width, bbox.height);
          }

          // If in face detection step, verify the face (only once)
          if (currentStep === "face_detection" && !detectedUser && !faceVerificationAttempted && !verifyFaceMutation.isPending) {
            const embedding = faceService.extractFaceEmbedding(faceDetections);
            if (embedding) {
              setFaceVerificationAttempted(true);
              verifyFaceMutation.mutate({ faceEmbedding: embedding });
            }
          }
        }

        // Detect gesture (thumbs up for confirmation)
        if (currentStep === "gesture_confirmation") {
          const gestureResults = await gestureService.recognizeGesture(videoRef.current);
          const thumbsUp = gestureService.detectThumbsUpGesture(gestureResults);
          
          setThumbsUpDetected(thumbsUp.detected);
          setGestureConfidence(thumbsUp.confidence * 100);

          // Draw hand landmarks
          if (gestureResults.landmarks && gestureResults.landmarks.length > 0) {
            const landmarks = gestureResults.landmarks[0];
            ctx.fillStyle = thumbsUp.detected ? "#00ff00" : "#ffff00";
            landmarks.forEach((landmark: any) => {
              ctx.beginPath();
              ctx.arc(
                landmark.x * canvasRef.current!.width,
                landmark.y * canvasRef.current!.height,
                5,
                0,
                2 * Math.PI
              );
              ctx.fill();
            });
          }

          // If thumbs up detected, process payment
          if (thumbsUp.detected && thumbsUp.confidence > 0.75 && selectedProduct && detectedUser) {
            processPayment();
          }
        }
      } catch (error) {
        console.error("Detection error:", error);
      }

      if (cameraActive) {
        requestAnimationFrame(detect);
      }
    };

    detect();
  };

  const selectProduct = (product: any) => {
    setSelectedProduct({
      id: product.productId,
      name: product.productName,
      price: product.price,
      currency: product.currency,
      imageUrl: product.imageUrl,
    });
    setCurrentStep("gesture_confirmation");
    toast.info("Please show thumbs up 👍 to confirm payment");
  };

  const processPayment = () => {
    if (!detectedUser || !selectedProduct) return;

    // If using custodial wallet, skip payment method selector and go directly to face confirmation
    if (detectedUser.walletType === 'custodial') {
      setShowFacePaymentConfirm(true);
    } else {
      // Show payment method selector for other payment types
      setShowPaymentMethodSelector(true);
    }
  };

  const handlePaymentMethodSelected = (paymentMethodId: number, paymentType: 'card' | 'metamask') => {
    setSelectedPaymentMethodId(paymentMethodId);
    setSelectedPaymentType(paymentType);
    setShowPaymentMethodSelector(false);
    
    // Show face payment confirmation modal
    setShowFacePaymentConfirm(true);
  };

  const handlePaymentConfirmed = async () => {
    if (!detectedUser || !selectedProduct || !selectedPaymentMethodId) return;

    setCurrentStep("processing");
    setShowFacePaymentConfirm(false);
    
    // If MetaMask payment, handle blockchain transaction
    if (selectedPaymentType === 'metamask') {
      try {
        // Connect MetaMask if not connected
        if (!metamask.isConnected) {
          await metamask.connect();
        }

        // Get merchant wallet address from backend
        // This will be returned by processPayment API
        toast.info('Please confirm the transaction in MetaMask');
        
        // The actual transaction will be handled by the backend processPayment
        // which returns merchant wallet address
      } catch (error: any) {
        toast.error(error.message || 'MetaMask connection failed');
        setCurrentStep('failed');
        return;
      }
    }
    
    // Create order (backend will handle payment based on selected method)
    createOrderMutation.mutate({
      deviceId,
      userId: detectedUser.id,
      merchantId,
      items: [
        {
          productId: selectedProduct.id,
          quantity: 1,
        },
      ],
      gestureConfidence: gestureConfidence,
    });
  };

  const resetPayment = () => {
    setCurrentStep("idle");
    setDetectedUser(null);
    setSelectedProduct(null);
    setFaceDetected(false);
    setThumbsUpDetected(false);
    setGestureConfidence(0);
    setFaceVerificationAttempted(false);
    setSelectedPaymentMethodId(null);
    setSelectedPaymentType(null);
    stopCamera();
  };

  const getStepTitle = () => {
    switch (currentStep) {
      case "idle":
        return "Ready to Start";
      case "face_detection":
        return "Detecting Face...";
      case "product_selection":
        return "Select Product";
      case "gesture_confirmation":
        return "Confirm with Thumbs Up 👍";
      case "processing":
        return "Processing Payment...";
      case "completed":
        return "Payment Successful!";
      case "failed":
        return "Payment Failed";
      default:
        return "Device Payment";
    }
  };

  const getStepProgress = () => {
    switch (currentStep) {
      case "idle":
        return 0;
      case "face_detection":
        return 25;
      case "product_selection":
        return 50;
      case "gesture_confirmation":
        return 75;
      case "processing":
        return 90;
      case "completed":
      case "failed":
        return 100;
      default:
        return 0;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold">SSP Device Payment</h1>
          <p className="text-muted-foreground">Face Recognition + Gesture Confirmation</p>
          <Progress value={getStepProgress()} className="w-full max-w-md mx-auto" />
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Camera Section */}
          <Card>
            <CardHeader>
              <CardTitle>{getStepTitle()}</CardTitle>
              <CardDescription>
                {currentStep === "idle" && "Click Start to begin payment"}
                {currentStep === "face_detection" && "Look at the camera"}
                {currentStep === "product_selection" && "Choose your product"}
                {currentStep === "gesture_confirmation" && "Show thumbs up to confirm"}
                {currentStep === "processing" && "Please wait..."}
                {currentStep === "completed" && "Thank you for your purchase!"}
                {currentStep === "failed" && "Please try again"}
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

                {!cameraActive && currentStep === "idle" && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Camera className="h-24 w-24 text-muted-foreground" />
                  </div>
                )}

                {/* Status Indicators */}
                <div className="absolute top-4 right-4 space-y-2">
                  {currentStep === "face_detection" && (
                    <Badge variant={faceDetected ? "default" : "secondary"} className="flex items-center gap-2">
                      {faceDetected ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                      {faceDetected ? "Face Detected" : "No Face"}
                    </Badge>
                  )}

                  {currentStep === "gesture_confirmation" && (
                    <Badge variant={thumbsUpDetected ? "default" : "secondary"} className="flex items-center gap-2">
                      <ThumbsUp className="h-4 w-4" />
                      {thumbsUpDetected ? `Thumbs Up (${gestureConfidence.toFixed(0)}%)` : "Waiting for 👍"}
                    </Badge>
                  )}
                </div>

                {/* Success/Failure Overlay */}
                {currentStep === "completed" && (
                  <div className="absolute inset-0 bg-green-500/80 flex items-center justify-center">
                    <div className="text-center text-white">
                      <CheckCircle className="h-24 w-24 mx-auto mb-4" />
                      <h2 className="text-3xl font-bold">Payment Successful!</h2>
                    </div>
                  </div>
                )}

                {currentStep === "failed" && (
                  <div className="absolute inset-0 bg-red-500/80 flex items-center justify-center">
                    <div className="text-center text-white">
                      <XCircle className="h-24 w-24 mx-auto mb-4" />
                      <h2 className="text-3xl font-bold">Payment Failed</h2>
                      <p className="text-sm mt-2 opacity-90">Please try again</p>
                    </div>
                  </div>
                )}
              </div>

              {currentStep === "idle" && (
                <Button 
                  onClick={startCamera} 
                  className="w-full" 
                  size="lg"
                  disabled={mediapipeLoading || !!mediapipeError}
                >
                  <Camera className="mr-2 h-5 w-5" />
                  {mediapipeLoading ? "Loading Camera Services..." : mediapipeError ? "Camera Service Error" : "Start Payment"}
                </Button>
              )}
              
              {mediapipeError && currentStep === "idle" && (
                <Alert variant="destructive">
                  <AlertDescription>
                    {mediapipeError}
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="mt-2 w-full"
                      onClick={() => window.location.reload()}
                    >
                      Refresh Page
                    </Button>
                  </AlertDescription>
                </Alert>
              )}

              {currentStep !== "idle" && currentStep !== "completed" && currentStep !== "failed" && (
                <Button onClick={resetPayment} variant="outline" className="w-full">
                  Cancel
                </Button>
              )}
              
              {currentStep === "failed" && (
                <Button onClick={resetPayment} className="w-full" size="lg">
                  Try Again
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Info Section */}
          <div className="space-y-4">
            {/* User Info */}
            {detectedUser && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="h-5 w-5" />
                    User Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <p className="text-sm text-muted-foreground">Name</p>
                    <p className="font-medium">{detectedUser.name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Wallet Type</p>
                    <Badge variant={detectedUser.walletType === "custodial" ? "default" : "secondary"}>
                      {detectedUser.walletType === "custodial" ? "Fiat Wallet" : "Crypto Wallet"}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Balance</p>
                    <p className="font-medium flex items-center gap-2">
                      <Wallet className="h-4 w-4" />
                      {detectedUser.walletType === "custodial"
                        ? `$${(detectedUser.balance / 100).toFixed(2)}`
                        : `${(detectedUser.balance / 100).toFixed(4)} ${detectedUser.currency}`}
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Product Selection */}
            {currentStep === "product_selection" && availableProducts && (
              <Card>
                <CardHeader>
                  <CardTitle>Available Products</CardTitle>
                  <CardDescription>Select a product to purchase</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {availableProducts.map((product: any) => (
                    <Button
                      key={product.productId}
                      variant="outline"
                      className="w-full justify-between h-auto py-4"
                      onClick={() => selectProduct(product)}
                    >
                      <div className="text-left">
                        <p className="font-medium">{product.productName}</p>
                        <p className="text-sm text-muted-foreground">
                          ${(product.price / 100).toFixed(2)}
                        </p>
                      </div>
                      <CreditCard className="h-5 w-5" />
                    </Button>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Selected Product */}
            {selectedProduct && currentStep === "gesture_confirmation" && (
              <Card>
                <CardHeader>
                  <CardTitle>Selected Product</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <p className="text-sm text-muted-foreground">Product</p>
                    <p className="font-medium">{selectedProduct.name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Price</p>
                    <p className="text-2xl font-bold">
                      ${(selectedProduct.price / 100).toFixed(2)}
                    </p>
                  </div>
                  <Alert>
                    <ThumbsUp className="h-4 w-4" />
                    <AlertDescription>
                      Show thumbs up 👍 gesture to confirm payment
                    </AlertDescription>
                  </Alert>
                </CardContent>
              </Card>
            )}

            {/* Processing */}
            {currentStep === "processing" && (
              <Card>
                <CardContent className="py-12 text-center">
                  <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 text-primary" />
                  <p className="text-lg font-medium">Processing Payment...</p>
                  <p className="text-sm text-muted-foreground">Please wait</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* Payment Method Selector Modal */}
      <PaymentMethodSelector
        open={showPaymentMethodSelector}
        onOpenChange={setShowPaymentMethodSelector}
        amount={selectedProduct?.price || 0}
        currency={selectedProduct?.currency || "USD"}
        onSelect={handlePaymentMethodSelected}
        onCancel={() => {
          setShowPaymentMethodSelector(false);
          toast.info("Payment method selection cancelled");
        }}
      />

      {/* Face Payment Confirmation Modal */}
      <FacePaymentConfirm
        open={showFacePaymentConfirm}
        onOpenChange={setShowFacePaymentConfirm}
        amount={selectedProduct?.price || 0}
        currency={selectedProduct?.currency || "USD"}
        merchantName="SSP Store"
        onConfirm={handlePaymentConfirmed}
        onCancel={() => {
          setShowFacePaymentConfirm(false);
          toast.info("Payment cancelled");
        }}
      />
    </div>
  );
}
