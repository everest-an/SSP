import { useState, useRef, useEffect } from 'react';
import { trpc } from '../lib/trpc';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Alert, AlertDescription } from '../components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import {
  Camera,
  Scan,
  ShoppingCart,
  CheckCircle,
  XCircle,
  AlertCircle,
  Play,
  Pause,
  RotateCcw,
} from 'lucide-react';

export default function ProductDetection() {
  const utils = trpc.useContext();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const [selectedDevice, setSelectedDevice] = useState<number | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [detections, setDetections] = useState<any[]>([]);
  const [lastEventId, setLastEventId] = useState<number | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);

  const { data: merchantProfile } = trpc.merchant.getMyMerchantProfile.useQuery();
  const { data: devices } = trpc.device.getDevicesByMerchant.useQuery(
    { merchantId: merchantProfile?.id || 0 },
    { enabled: !!merchantProfile }
  );
  const { data: models } = trpc.yoloDetection.getSupportedModels.useQuery();
  const { data: stats } = trpc.yoloDetection.getDetectionStats.useQuery(
    { deviceId: selectedDevice || undefined },
    { enabled: !!selectedDevice }
  );

  const processDetectionMutation = trpc.yoloDetection.processDetectionEvent.useMutation({
    onSuccess: (data) => {
      setLastEventId(data.eventId);
      setDetections(data.products);
    },
  });

  const buildCartMutation = trpc.yoloDetection.buildCartFromDetection.useMutation({
    onSuccess: () => {
      utils.order.getMyOrders.invalidate();
    },
  });

  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [stream]);

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      
      setStream(mediaStream);
      setIsScanning(true);
    } catch (error) {
      console.error('Failed to start camera:', error);
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setIsScanning(false);
  };

  const captureAndDetect = async () => {
    if (!videoRef.current || !canvasRef.current || !selectedDevice) {
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    if (!context) return;

    // Set canvas dimensions to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw video frame to canvas
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Convert canvas to blob
    canvas.toBlob(async (blob) => {
      if (!blob) return;

      // In production, this would:
      // 1. Upload image to server
      // 2. Run YOLO detection
      // 3. Return detected products

      // For demo, simulate detection
      const mockDetections = [
        {
          productName: 'Coca Cola',
          confidence: 0.95,
          boundingBox: { x: 100, y: 100, width: 200, height: 300 },
          barcode: '049000042566',
        },
        {
          productName: 'Chips',
          confidence: 0.87,
          boundingBox: { x: 350, y: 150, width: 180, height: 250 },
        },
      ];

      processDetectionMutation.mutate({
        deviceId: selectedDevice,
        detections: mockDetections,
      });
    }, 'image/jpeg', 0.95);
  };

  const handleBuildCart = () => {
    if (lastEventId) {
      buildCartMutation.mutate({ eventId: lastEventId });
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
          <Scan className="h-8 w-8" />
          Product Detection
        </h1>
        <p className="text-muted-foreground">
          Automatically detect and add products to cart using AI
        </p>
      </div>

      {/* Statistics */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total Scans</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalEvents}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Products Detected</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalDetections}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Avg per Scan</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.avgDetectionsPerEvent}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats.totalEvents > 0
                  ? Math.round((stats.eventsWithDetections / stats.totalEvents) * 100)
                  : 0}%
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Camera Feed */}
        <Card>
          <CardHeader>
            <CardTitle>Camera Feed</CardTitle>
            <CardDescription>
              Point camera at products to detect them
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Select Device</label>
              <Select
                value={selectedDevice?.toString()}
                onValueChange={(value) => setSelectedDevice(parseInt(value))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose a device" />
                </SelectTrigger>
                <SelectContent>
                  {devices?.map((device) => (
                    <SelectItem key={device.id} value={device.id.toString()}>
                      {device.deviceName} - {device.location}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="relative bg-black rounded-lg overflow-hidden aspect-video">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                className="w-full h-full object-cover"
              />
              <canvas ref={canvasRef} className="hidden" />
              
              {!isScanning && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                  <Camera className="h-16 w-16 text-white/50" />
                </div>
              )}
            </div>

            <div className="flex gap-2">
              {!isScanning ? (
                <Button
                  onClick={startCamera}
                  disabled={!selectedDevice}
                  className="flex-1"
                >
                  <Play className="h-4 w-4 mr-2" />
                  Start Camera
                </Button>
              ) : (
                <>
                  <Button onClick={stopCamera} variant="outline" className="flex-1">
                    <Pause className="h-4 w-4 mr-2" />
                    Stop
                  </Button>
                  <Button
                    onClick={captureAndDetect}
                    disabled={processDetectionMutation.isPending}
                    className="flex-1"
                  >
                    <Scan className="h-4 w-4 mr-2" />
                    {processDetectionMutation.isPending ? 'Detecting...' : 'Detect Products'}
                  </Button>
                </>
              )}
            </div>

            {processDetectionMutation.isPending && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Processing image and detecting products...
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Detection Results */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Detection Results</CardTitle>
                <CardDescription>
                  {detections.length > 0
                    ? `${detections.filter(d => d.matched).length} products matched`
                    : 'No detections yet'}
                </CardDescription>
              </div>
              {detections.length > 0 && (
                <Button
                  size="sm"
                  onClick={handleBuildCart}
                  disabled={buildCartMutation.isPending || detections.filter(d => d.matched).length === 0}
                >
                  <ShoppingCart className="h-4 w-4 mr-2" />
                  Add to Cart
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {detections.length > 0 ? (
              <div className="space-y-3">
                {detections.map((item, index) => (
                  <div
                    key={index}
                    className={`border rounded-lg p-3 ${
                      item.matched ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {item.matched ? (
                          <CheckCircle className="h-5 w-5 text-green-600" />
                        ) : (
                          <XCircle className="h-5 w-5 text-red-600" />
                        )}
                        <div>
                          <h4 className="font-semibold">
                            {item.product?.name || item.detection.productName}
                          </h4>
                          <p className="text-sm text-muted-foreground">
                            Confidence: {(item.detection.confidence * 100).toFixed(1)}%
                          </p>
                        </div>
                      </div>
                      <Badge variant={item.matched ? 'default' : 'destructive'}>
                        {item.matched ? 'Matched' : 'Not Found'}
                      </Badge>
                    </div>

                    {item.product && (
                      <div className="text-sm space-y-1">
                        <p>
                          <span className="text-muted-foreground">Price:</span>{' '}
                          <span className="font-medium">
                            ${(item.product.price / 100).toFixed(2)}
                          </span>
                        </p>
                        {item.product.barcode && (
                          <p>
                            <span className="text-muted-foreground">Barcode:</span>{' '}
                            <code className="text-xs">{item.product.barcode}</code>
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <Scan className="h-16 w-16 mx-auto mb-4 opacity-50" />
                <p>No products detected yet</p>
                <p className="text-sm">Start camera and scan products</p>
              </div>
            )}

            {buildCartMutation.isSuccess && (
              <Alert className="mt-4 border-green-200 bg-green-50">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-800">
                  Products added to cart successfully!
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Detection Models */}
      {models && (
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Available Detection Models</CardTitle>
            <CardDescription>
              Choose the right model for your use case
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {models.map((model) => (
                <div
                  key={model.id}
                  className={`border rounded-lg p-4 ${
                    model.recommended ? 'border-primary bg-primary/5' : ''
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="font-semibold">{model.name}</h4>
                    {model.recommended && (
                      <Badge>Recommended</Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">
                    {model.description}
                  </p>
                  <div className="flex gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Accuracy:</span>{' '}
                      <span className="font-medium">{model.accuracy}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Speed:</span>{' '}
                      <span className="font-medium">{model.speed}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
