/**
 * DID Login Page
 * 
 * Supports two login methods:
 * 1. Face scan login - scan face to decrypt local storage and login
 * 2. BackupID recovery - use BackupID to recover and login
 */

import React, { useState, useRef } from 'react';
import { useLocation } from 'wouter';
import { useCamera } from '@/hooks/useCamera';
import { extractFaceVector } from '@/services/faceDetection';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { trpc } from '@/lib/trpc';
import { 
  Camera, 
  CheckCircle2, 
  AlertCircle, 
  Loader2,
  Shield,
  Key,
  Scan
} from 'lucide-react';

type LoginStep = 
  | 'method_selection'
  | 'face_camera_setup' 
  | 'face_scanning' 
  | 'face_processing'
  | 'backup_input'
  | 'backup_processing'
  | 'success' 
  | 'error';

export function DIDLogin() {
  const [, setLocation] = useLocation();
  const [step, setStep] = useState<LoginStep>('method_selection');
  const [loginMethod, setLoginMethod] = useState<'face' | 'backup'>('face');
  const [backupID, setBackupID] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const { videoRef, isStreaming, error: cameraError, startCamera, stopCamera } = useCamera();
  const loginMutation = trpc.did.login.useMutation();
  const recoverMutation = trpc.did.recover.useMutation();

  // Select login method
  const handleSelectMethod = (method: 'face' | 'backup') => {
    setLoginMethod(method);
    if (method === 'face') {
      setStep('face_camera_setup');
    } else {
      setStep('backup_input');
    }
  };

  // Start camera for face login
  const handleStartCamera = async () => {
    try {
      setError(null);
      await startCamera();
      setStep('face_scanning');
    } catch (err) {
      setError(cameraError || 'Failed to start camera');
      setStep('error');
    }
  };

  // Capture face and login
  const handleCaptureFace = async () => {
    if (!videoRef.current || !canvasRef.current) {
      setError('Camera not ready');
      return;
    }

    try {
      setStep('face_processing');

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

      // Extract face vector
      const faceVector = await extractFaceVector(canvas);
      if (!faceVector || faceVector.length !== 512) {
        throw new Error('Failed to extract face vector');
      }

      // Stop camera
      stopCamera();

      // Get encrypted local storage
      const localStorageData = getFromLocalStorage();
      if (!localStorageData) {
        throw new Error('No DID identity found in local storage. Please register first.');
      }

      // Login with DID
      await handleDIDLogin(faceVector, localStorageData);

    } catch (err: any) {
      console.error('Face login error:', err);
      setError(err.message || 'Failed to login with face');
      setStep('error');
    }
  };

  // Login with DID
  const handleDIDLogin = async (faceVector: number[], localStorageData: any) => {
    try {
      const result = await loginMutation.mutateAsync({
        faceVector,
        encryptedLocalStorage: {
          encrypted: localStorageData.encrypted,
          iv: localStorageData.iv,
          tag: localStorageData.tag,
        },
        arweaveID: localStorageData.arweaveID,
        deviceInfo: navigator.userAgent,
      });

      if (!result.success) {
        throw new Error('Login failed');
      }

      // Save session token
      saveSessionToken(result.sessionToken);

      setStep('success');

      // Redirect to dashboard after 2 seconds
      setTimeout(() => {
        setLocation('/dashboard');
      }, 2000);

    } catch (err: any) {
      console.error('DID login error:', err);
      throw err;
    }
  };

  // Handle BackupID submission
  const handleBackupIDSubmit = async () => {
    if (!backupID || backupID.length < 20) {
      setError('Please enter a valid BackupID');
      return;
    }

    try {
      setStep('backup_processing');
      setError(null);

      // Recover with BackupID
      const result = await recoverMutation.mutateAsync({
        backupID,
        deviceInfo: navigator.userAgent,
      });

      if (!result.success) {
        throw new Error('Recovery failed');
      }

      // Save to local storage
      saveToLocalStorage(result);

      // Save session token
      saveSessionToken(result.sessionToken);

      setStep('success');

      // Redirect to dashboard after 2 seconds
      setTimeout(() => {
        setLocation('/dashboard');
      }, 2000);

    } catch (err: any) {
      console.error('BackupID recovery error:', err);
      setError(err.message || 'Failed to recover with BackupID');
      setStep('error');
    }
  };

  // Get from local storage
  const getFromLocalStorage = () => {
    try {
      const data = localStorage.getItem('ssp_did_identity');
      if (!data) {
        return null;
      }
      return JSON.parse(data);
    } catch (err) {
      console.error('Failed to read from local storage:', err);
      return null;
    }
  };

  // Save to local storage
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

  // Save session token
  const saveSessionToken = (token: string) => {
    try {
      localStorage.setItem('ssp_session_token', token);
      // Also save to cookie for server-side validation
      document.cookie = `ssp_session=${token}; path=/; max-age=86400; secure; samesite=strict`;
    } catch (err) {
      console.error('Failed to save session token:', err);
    }
  };

  // Retry login
  const handleRetry = () => {
    setStep('method_selection');
    setError(null);
    setBackupID('');
  };

  // Go to registration
  const handleGoToRegistration = () => {
    setLocation('/did-registration');
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-6 h-6" />
            DID Login
          </CardTitle>
          <CardDescription>
            Login with your decentralized identity
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Method Selection */}
          {step === 'method_selection' && (
            <div className="space-y-6">
              <Tabs defaultValue="face" onValueChange={(value) => setLoginMethod(value as 'face' | 'backup')}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="face">
                    <Scan className="w-4 h-4 mr-2" />
                    Face Scan
                  </TabsTrigger>
                  <TabsTrigger value="backup">
                    <Key className="w-4 h-4 mr-2" />
                    BackupID
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="face" className="space-y-4 mt-4">
                  <Alert>
                    <Camera className="w-4 h-4" />
                    <AlertDescription>
                      Scan your face to securely login. Your face data never leaves your device.
                    </AlertDescription>
                  </Alert>

                  <div className="space-y-2">
                    <h4 className="font-semibold">How it works:</h4>
                    <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
                      <li>Scan your face with the camera</li>
                      <li>Your face unlocks encrypted data stored locally</li>
                      <li>Your identity is verified on the blockchain</li>
                      <li>You're securely logged in</li>
                    </ol>
                  </div>

                  <Button onClick={() => handleSelectMethod('face')} className="w-full" size="lg">
                    <Camera className="w-5 h-5 mr-2" />
                    Login with Face
                  </Button>
                </TabsContent>

                <TabsContent value="backup" className="space-y-4 mt-4">
                  <Alert>
                    <Key className="w-4 h-4" />
                    <AlertDescription>
                      Use your BackupID to recover your account on a new device.
                    </AlertDescription>
                  </Alert>

                  <div className="space-y-2">
                    <h4 className="font-semibold">When to use BackupID:</h4>
                    <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                      <li>Lost or changed your device</li>
                      <li>Cleared browser data</li>
                      <li>First time login on a new device</li>
                    </ul>
                  </div>

                  <Button onClick={() => handleSelectMethod('backup')} className="w-full" size="lg">
                    <Key className="w-5 h-5 mr-2" />
                    Login with BackupID
                  </Button>
                </TabsContent>
              </Tabs>

              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-2">
                  Don't have a DID yet?
                </p>
                <Button onClick={handleGoToRegistration} variant="outline">
                  Create DID Account
                </Button>
              </div>
            </div>
          )}

          {/* Face Camera Setup */}
          {step === 'face_camera_setup' && (
            <div className="space-y-4">
              <Alert>
                <Camera className="w-4 h-4" />
                <AlertDescription>
                  We need to scan your face to verify your identity.
                  Your face data is processed locally and never uploaded.
                </AlertDescription>
              </Alert>

              <div className="flex gap-2">
                <Button onClick={() => setStep('method_selection')} variant="outline" className="flex-1">
                  Back
                </Button>
                <Button onClick={handleStartCamera} className="flex-1">
                  <Camera className="w-5 h-5 mr-2" />
                  Start Camera
                </Button>
              </div>
            </div>
          )}

          {/* Face Scanning */}
          {step === 'face_scanning' && (
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
                  Position your face in the center and look directly at the camera.
                </AlertDescription>
              </Alert>

              <div className="flex gap-2">
                <Button onClick={() => {
                  stopCamera();
                  setStep('method_selection');
                }} variant="outline" className="flex-1">
                  Cancel
                </Button>
                <Button 
                  onClick={handleCaptureFace} 
                  className="flex-1"
                  disabled={!isStreaming}
                >
                  Capture & Login
                </Button>
              </div>
            </div>
          )}

          {/* Face Processing */}
          {step === 'face_processing' && (
            <div className="flex flex-col items-center justify-center py-8">
              <Loader2 className="w-16 h-16 animate-spin text-primary mb-4" />
              <h3 className="text-lg font-semibold mb-2">Verifying Your Identity...</h3>
              <p className="text-sm text-muted-foreground">
                This may take a few moments
              </p>
            </div>
          )}

          {/* BackupID Input */}
          {step === 'backup_input' && (
            <div className="space-y-4">
              <Alert>
                <Key className="w-4 h-4" />
                <AlertDescription>
                  Enter your BackupID to recover your account.
                  This is the code you saved during registration.
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                <Label htmlFor="backupID">BackupID</Label>
                <Input
                  id="backupID"
                  type="text"
                  placeholder="SSP-BACKUP-XXXX-XXXX-XXXX"
                  value={backupID}
                  onChange={(e) => setBackupID(e.target.value)}
                  className="font-mono"
                />
                <p className="text-xs text-muted-foreground">
                  Format: SSP-BACKUP-XXXX-XXXX-XXXX
                </p>
              </div>

              <div className="flex gap-2">
                <Button onClick={() => setStep('method_selection')} variant="outline" className="flex-1">
                  Back
                </Button>
                <Button 
                  onClick={handleBackupIDSubmit} 
                  className="flex-1"
                  disabled={!backupID || backupID.length < 20}
                >
                  Recover & Login
                </Button>
              </div>
            </div>
          )}

          {/* Backup Processing */}
          {step === 'backup_processing' && (
            <div className="flex flex-col items-center justify-center py-8">
              <Loader2 className="w-16 h-16 animate-spin text-primary mb-4" />
              <h3 className="text-lg font-semibold mb-2">Recovering Your Account...</h3>
              <p className="text-sm text-muted-foreground">
                Fetching your identity from Arweave
              </p>
            </div>
          )}

          {/* Success */}
          {step === 'success' && (
            <div className="flex flex-col items-center justify-center py-8">
              <CheckCircle2 className="w-16 h-16 text-green-500 mb-4" />
              <h3 className="text-lg font-semibold mb-2">Login Successful!</h3>
              <p className="text-sm text-muted-foreground">
                Redirecting to dashboard...
              </p>
            </div>
          )}

          {/* Error */}
          {step === 'error' && (
            <div className="space-y-4">
              <Alert variant="destructive">
                <AlertCircle className="w-4 h-4" />
                <AlertDescription>
                  {error || 'An error occurred during login'}
                </AlertDescription>
              </Alert>

              <div className="flex gap-2">
                <Button onClick={handleRetry} variant="outline" className="flex-1">
                  Try Again
                </Button>
                <Button onClick={handleGoToRegistration} variant="outline" className="flex-1">
                  Create Account
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
