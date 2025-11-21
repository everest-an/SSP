/**
 * DID Registration Page
 * 
 * Guides users through DID registration with face biometrics:
 * 1. Scan face
 * 2. Generate DID + Ethereum key pair
 * 3. Create Shamir shards
 * 4. Save encrypted local storage
 * 5. Display BackupID and QR code
 */

import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'wouter';
import { useCamera } from '@/hooks/useCamera';
import { extractFaceVector } from '@/services/faceDetection';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { trpc } from '@/lib/trpc';
import { 
  Camera, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Download,
  Copy,
  Shield,
  Key,
  Database
} from 'lucide-react';
import QRCode from 'qrcode';

type RegistrationStep = 
  | 'intro' 
  | 'email_input'
  | 'camera_setup' 
  | 'scanning' 
  | 'processing' 
  | 'backup_display'
  | 'success' 
  | 'error';

interface RegistrationResult {
  did: string;
  ethAddress: string;
  backupID: string;
  backupQR: string;
  arweaveID: string;
  encryptedLocalStorage: {
    encrypted: string;
    iv: string;
    tag: string;
  };
}

export function DIDRegistration() {
  const [, setLocation] = useLocation();
  const [step, setStep] = useState<RegistrationStep>('intro');
  const [email, setEmail] = useState<string>('');
  const [faceVector, setFaceVector] = useState<number[] | null>(null);
  const [registrationResult, setRegistrationResult] = useState<RegistrationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const { videoRef, isStreaming, error: cameraError, startCamera, stopCamera } = useCamera();
  const registerMutation = trpc.did.register.useMutation();

  // Start registration process
  const handleStart = () => {
    setStep('email_input');
  };

  // Handle email submission
  const handleEmailSubmit = () => {
    if (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setStep('camera_setup');
    } else {
      setError('Please enter a valid email address');
    }
  };

  // Start camera
  const handleStartCamera = async () => {
    try {
      setError(null);
      await startCamera();
      setStep('scanning');
    } catch (err) {
      setError(cameraError || 'Failed to start camera');
      setStep('error');
    }
  };

  // Capture face and extract vector
  const handleCaptureFace = async () => {
    if (!videoRef.current || !canvasRef.current) {
      setError('Camera not ready');
      return;
    }

    try {
      setStep('processing');
      setProgress(10);

      // Capture frame
      const canvas = canvasRef.current;
      const video = videoRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('Failed to get canvas context');
      }
      ctx.drawImage(video, 0, 0);

      setProgress(30);

      // Extract face vector
      const vector = await extractFaceVector(canvas);
      if (!vector || vector.length !== 512) {
        throw new Error('Failed to extract face vector');
      }

      setFaceVector(vector);
      setProgress(50);

      // Stop camera
      stopCamera();

      // Register DID
      await handleRegisterDID(vector);

    } catch (err: any) {
      console.error('Face capture error:', err);
      setError(err.message || 'Failed to capture face');
      setStep('error');
    }
  };

  // Register DID
  const handleRegisterDID = async (vector: number[]) => {
    try {
      setProgress(60);

      const result = await registerMutation.mutateAsync({
        email: email || undefined,
        faceVector: vector,
        deviceInfo: navigator.userAgent,
      });

      setProgress(80);

      if (!result.success) {
        throw new Error('Registration failed');
      }

      // Save encrypted local storage
      saveToLocalStorage(result);

      setProgress(90);

      // Generate QR code
      await generateQRCode(result.backupID);

      setProgress(100);

      setRegistrationResult(result as RegistrationResult);
      setStep('backup_display');

    } catch (err: any) {
      console.error('DID registration error:', err);
      setError(err.message || 'Failed to register DID');
      setStep('error');
    }
  };

  // Save encrypted local storage
  const saveToLocalStorage = (result: any) => {
    try {
      const data = {
        did: result.did,
        ethAddress: result.ethAddress,
        arweaveID: result.arweaveID,
        encrypted: result.encryptedLocalStorage.encrypted,
        iv: result.encryptedLocalStorage.iv,
        tag: result.encryptedLocalStorage.tag,
        createdAt: Date.now(),
      };

      localStorage.setItem('ssp_did_identity', JSON.stringify(data));
      console.log('DID identity saved to local storage');
    } catch (err) {
      console.error('Failed to save to local storage:', err);
    }
  };

  // Generate QR code
  const generateQRCode = async (backupID: string) => {
    try {
      const qrDataUrl = await QRCode.toDataURL(backupID, {
        width: 300,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF',
        },
      });
      setQrCodeUrl(qrDataUrl);
    } catch (err) {
      console.error('Failed to generate QR code:', err);
    }
  };

  // Copy BackupID to clipboard
  const handleCopyBackupID = () => {
    if (registrationResult) {
      navigator.clipboard.writeText(registrationResult.backupID);
      alert('BackupID copied to clipboard!');
    }
  };

  // Download BackupID as text file
  const handleDownloadBackupID = () => {
    if (registrationResult) {
      const content = `SSP DID Backup Information

DID: ${registrationResult.did}
Ethereum Address: ${registrationResult.ethAddress}
BackupID: ${registrationResult.backupID}
Arweave ID: ${registrationResult.arweaveID}

IMPORTANT: Keep this BackupID safe! You will need it to recover your account if you lose your device.

Created: ${new Date().toISOString()}
`;

      const blob = new Blob([content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ssp-backup-${registrationResult.ethAddress.slice(0, 8)}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  // Complete registration
  const handleComplete = () => {
    setLocation('/dashboard');
  };

  // Retry registration
  const handleRetry = () => {
    setStep('intro');
    setError(null);
    setProgress(0);
    setFaceVector(null);
    setRegistrationResult(null);
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-6 h-6" />
            DID Registration
          </CardTitle>
          <CardDescription>
            Create your decentralized identity with face biometrics
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Intro Step */}
          {step === 'intro' && (
            <div className="space-y-6">
              <Alert>
                <Shield className="w-4 h-4" />
                <AlertDescription>
                  <strong>What is DID?</strong>
                  <p className="mt-2">
                    A Decentralized Identifier (DID) gives you complete control over your digital identity.
                    Your identity is secured by blockchain technology and face biometrics.
                  </p>
                </AlertDescription>
              </Alert>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardHeader>
                    <Key className="w-8 h-8 mb-2 text-primary" />
                    <CardTitle className="text-lg">Self-Sovereign</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      You own and control your identity. No company can access or delete it.
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <Shield className="w-8 h-8 mb-2 text-primary" />
                    <CardTitle className="text-lg">Secure</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      Protected by face biometrics, encryption, and blockchain technology.
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <Database className="w-8 h-8 mb-2 text-primary" />
                    <CardTitle className="text-lg">Decentralized</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      Stored on Arweave permanent storage. No central server can be hacked.
                    </p>
                  </CardContent>
                </Card>
              </div>

              <Button onClick={handleStart} className="w-full" size="lg">
                Start Registration
              </Button>
            </div>
          )}

          {/* Email Input Step */}
          {step === 'email_input' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email Address (Optional)</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <p className="text-sm text-muted-foreground">
                  Email is optional but recommended for account recovery.
                </p>
              </div>

              <div className="flex gap-2">
                <Button onClick={() => setStep('intro')} variant="outline" className="flex-1">
                  Back
                </Button>
                <Button onClick={handleEmailSubmit} className="flex-1">
                  Continue
                </Button>
              </div>
            </div>
          )}

          {/* Camera Setup Step */}
          {step === 'camera_setup' && (
            <div className="space-y-4">
              <Alert>
                <Camera className="w-4 h-4" />
                <AlertDescription>
                  We need to scan your face to create your biometric identity.
                  Your face data will be encrypted and never uploaded to any server.
                </AlertDescription>
              </Alert>

              <Button onClick={handleStartCamera} className="w-full" size="lg">
                <Camera className="w-5 h-5 mr-2" />
                Start Camera
              </Button>
            </div>
          )}

          {/* Scanning Step */}
          {step === 'scanning' && (
            <div className="space-y-4">
              <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
                <canvas ref={canvasRef} className="hidden" />
              </div>

              <Alert>
                <Camera className="w-4 h-4" />
                <AlertDescription>
                  Position your face in the center of the frame and look directly at the camera.
                </AlertDescription>
              </Alert>

              <Button 
                onClick={handleCaptureFace} 
                className="w-full" 
                size="lg"
                disabled={!isStreaming}
              >
                Capture Face
              </Button>
            </div>
          )}

          {/* Processing Step */}
          {step === 'processing' && (
            <div className="space-y-4">
              <div className="flex flex-col items-center justify-center py-8">
                <Loader2 className="w-16 h-16 animate-spin text-primary mb-4" />
                <h3 className="text-lg font-semibold mb-2">Creating Your DID...</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  This may take a few moments
                </p>
                <Progress value={progress} className="w-full max-w-md" />
                <p className="text-xs text-muted-foreground mt-2">{progress}%</p>
              </div>

              <div className="space-y-2 text-sm text-muted-foreground">
                <p>✓ Extracting face features</p>
                <p>✓ Generating DID and Ethereum key pair</p>
                <p>✓ Creating Shamir shards</p>
                <p>✓ Uploading to Arweave</p>
                <p>✓ Encrypting local storage</p>
              </div>
            </div>
          )}

          {/* Backup Display Step */}
          {step === 'backup_display' && registrationResult && (
            <div className="space-y-6">
              <Alert className="border-yellow-500 bg-yellow-50">
                <AlertCircle className="w-4 h-4 text-yellow-600" />
                <AlertDescription className="text-yellow-800">
                  <strong>IMPORTANT: Save Your BackupID!</strong>
                  <p className="mt-1">
                    You will need this BackupID to recover your account if you lose your device.
                    Save it in a safe place!
                  </p>
                </AlertDescription>
              </Alert>

              <div className="space-y-4">
                <div>
                  <Label>Your DID</Label>
                  <div className="mt-1 p-3 bg-muted rounded-md font-mono text-sm break-all">
                    {registrationResult.did}
                  </div>
                </div>

                <div>
                  <Label>Ethereum Address</Label>
                  <div className="mt-1 p-3 bg-muted rounded-md font-mono text-sm break-all">
                    {registrationResult.ethAddress}
                  </div>
                </div>

                <div>
                  <Label>BackupID</Label>
                  <div className="mt-1 p-3 bg-yellow-50 border-2 border-yellow-500 rounded-md font-mono text-lg break-all">
                    {registrationResult.backupID}
                  </div>
                  <div className="flex gap-2 mt-2">
                    <Button onClick={handleCopyBackupID} variant="outline" size="sm" className="flex-1">
                      <Copy className="w-4 h-4 mr-2" />
                      Copy
                    </Button>
                    <Button onClick={handleDownloadBackupID} variant="outline" size="sm" className="flex-1">
                      <Download className="w-4 h-4 mr-2" />
                      Download
                    </Button>
                  </div>
                </div>

                {qrCodeUrl && (
                  <div className="flex flex-col items-center">
                    <Label className="mb-2">BackupID QR Code</Label>
                    <img src={qrCodeUrl} alt="BackupID QR Code" className="w-64 h-64" />
                    <p className="text-xs text-muted-foreground mt-2">
                      Scan this QR code to save your BackupID
                    </p>
                  </div>
                )}
              </div>

              <Button onClick={handleComplete} className="w-full" size="lg">
                <CheckCircle2 className="w-5 h-5 mr-2" />
                Complete Registration
              </Button>
            </div>
          )}

          {/* Success Step */}
          {step === 'success' && (
            <div className="flex flex-col items-center justify-center py-8">
              <CheckCircle2 className="w-16 h-16 text-green-500 mb-4" />
              <h3 className="text-lg font-semibold mb-2">Registration Successful!</h3>
              <p className="text-sm text-muted-foreground mb-4 text-center">
                Your DID has been created successfully. You can now use face login.
              </p>
              <Button onClick={handleComplete} className="w-full max-w-md">
                Go to Dashboard
              </Button>
            </div>
          )}

          {/* Error Step */}
          {step === 'error' && (
            <div className="space-y-4">
              <Alert variant="destructive">
                <AlertCircle className="w-4 h-4" />
                <AlertDescription>
                  {error || 'An error occurred during registration'}
                </AlertDescription>
              </Alert>

              <div className="flex gap-2">
                <Button onClick={handleRetry} variant="outline" className="flex-1">
                  Try Again
                </Button>
                <Button onClick={() => setLocation('/login')} variant="outline" className="flex-1">
                  Back to Login
                </Button>
              </div>
            </div>
          )}

          {/* Camera Error */}
          {cameraError && step !== 'error' && (
            <Alert variant="destructive">
              <AlertCircle className="w-4 h-4" />
              <AlertDescription>{cameraError}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
