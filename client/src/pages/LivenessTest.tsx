import { useState } from "react";
import LivenessDetection from "../components/LivenessDetection";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { CheckCircle, Shield } from "lucide-react";

export default function LivenessTest() {
  const [result, setResult] = useState<any>(null);

  const handleSuccess = (livenessData: any) => {
    console.log('Liveness verification successful:', livenessData);
    setResult(livenessData);
  };

  const handleError = (error: string) => {
    console.error('Liveness verification failed:', error);
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold">Liveness Detection Test</h1>
        <p className="text-muted-foreground">
          Test the enhanced liveness detection system
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Detection Component */}
        <div>
          <LivenessDetection onSuccess={handleSuccess} onError={handleError} />
        </div>

        {/* Information Panel */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                About Liveness Detection
              </CardTitle>
              <CardDescription>
                Advanced security features to prevent spoofing
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">Detection Methods:</h3>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />
                    <span><strong>Challenge-Response:</strong> Interactive challenges like blinking and head movements</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />
                    <span><strong>Texture Analysis:</strong> Detects screen reflections and photo artifacts</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />
                    <span><strong>Depth Sensing:</strong> Analyzes 3D facial structure</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />
                    <span><strong>Motion Detection:</strong> Tracks natural facial movements</span>
                  </li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Security Benefits:</h3>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  <li>• Prevents photo-based attacks</li>
                  <li>• Detects video replay attacks</li>
                  <li>• Resists 3D mask spoofing</li>
                  <li>• Real-time verification</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* Result Display */}
          {result && (
            <Card className="border-green-200 bg-green-50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-green-700">
                  <CheckCircle className="h-5 w-5" />
                  Verification Result
                </CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <dt className="font-medium">Status:</dt>
                    <dd className="text-green-700 font-semibold">
                      {result.isLive ? 'Live Person Detected' : 'Verification Failed'}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="font-medium">Confidence Score:</dt>
                    <dd className="text-green-700 font-semibold">
                      {(result.score * 100).toFixed(1)}%
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="font-medium">Method:</dt>
                    <dd className="text-gray-700">{result.method}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="font-medium">Timestamp:</dt>
                    <dd className="text-gray-700">
                      {new Date(result.timestamp).toLocaleString()}
                    </dd>
                  </div>
                </dl>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
