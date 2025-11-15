import { useState } from "react";
import { trpc } from "../lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Alert, AlertDescription } from "../components/ui/alert";
import { Shield, CheckCircle, AlertTriangle, Key, Smartphone, Download } from "lucide-react";
import { toast } from "sonner";

export default function TwoFactorSettings() {
  const [step, setStep] = useState<'check' | 'setup' | 'verify' | 'enabled'>('check');
  const [qrCode, setQrCode] = useState('');
  const [secret, setSecret] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [verificationCode, setVerificationCode] = useState('');
  const [disablePassword, setDisablePassword] = useState('');

  // Check 2FA status
  const { data: status, refetch: refetchStatus } = trpc.auth.get2FAStatus.useQuery();

  // Generate 2FA secret
  const generateMutation = trpc.auth.generate2FASecret.useMutation({
    onSuccess: (data) => {
      setQrCode(data.qrCodeUrl);
      setSecret(data.secret);
      setBackupCodes(data.backupCodes);
      setStep('verify');
    },
    onError: (error) => {
      toast.error(`Failed to generate 2FA secret: ${error.message}`);
    },
  });

  // Enable 2FA
  const enableMutation = trpc.auth.enable2FA.useMutation({
    onSuccess: () => {
      toast.success('2FA enabled successfully!');
      setStep('enabled');
      refetchStatus();
    },
    onError: (error) => {
      toast.error(`Failed to enable 2FA: ${error.message}`);
    },
  });

  // Disable 2FA
  const disableMutation = trpc.auth.disable2FA.useMutation({
    onSuccess: () => {
      toast.success('2FA disabled successfully');
      setStep('check');
      setDisablePassword('');
      refetchStatus();
    },
    onError: (error) => {
      toast.error(`Failed to disable 2FA: ${error.message}`);
    },
  });

  const handleStartSetup = () => {
    setStep('setup');
    generateMutation.mutate();
  };

  const handleVerify = () => {
    if (verificationCode.length !== 6) {
      toast.error('Please enter a 6-digit code');
      return;
    }

    enableMutation.mutate({
      secret,
      verificationCode,
    });
  };

  const handleDisable = () => {
    if (!disablePassword) {
      toast.error('Please enter your password');
      return;
    }

    disableMutation.mutate({
      password: disablePassword,
    });
  };

  const downloadBackupCodes = () => {
    const text = backupCodes.join('\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ssp-backup-codes.txt';
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
    toast.success('Backup codes downloaded');
  };

  return (
    <div className="container mx-auto p-6 max-w-2xl space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold">Two-Factor Authentication</h1>
        <p className="text-muted-foreground">
          Add an extra layer of security to your account
        </p>
      </div>

      {/* Status Card */}
      {status?.enabled && step === 'check' && (
        <Card className="border-green-200 bg-green-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-700">
              <CheckCircle className="h-5 w-5" />
              2FA is Enabled
            </CardTitle>
            <CardDescription>
              Your account is protected with two-factor authentication
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <Shield className="h-4 w-4" />
              <AlertDescription>
                You'll need to enter a code from your authenticator app when signing in
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Label htmlFor="disable-password">Enter password to disable 2FA</Label>
              <Input
                id="disable-password"
                type="password"
                placeholder="Your password"
                value={disablePassword}
                onChange={(e) => setDisablePassword(e.target.value)}
              />
            </div>

            <Button
              variant="destructive"
              onClick={handleDisable}
              disabled={disableMutation.isPending}
              className="w-full"
            >
              Disable 2FA
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Setup Card */}
      {!status?.enabled && step === 'check' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Enable Two-Factor Authentication
            </CardTitle>
            <CardDescription>
              Protect your account with TOTP-based 2FA
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <Smartphone className="h-5 w-5 text-blue-600 mt-0.5" />
                <div>
                  <p className="font-medium">Install an authenticator app</p>
                  <p className="text-sm text-muted-foreground">
                    Google Authenticator, Authy, or Microsoft Authenticator
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Key className="h-5 w-5 text-blue-600 mt-0.5" />
                <div>
                  <p className="font-medium">Scan QR code</p>
                  <p className="text-sm text-muted-foreground">
                    Use your app to scan the QR code we'll provide
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <CheckCircle className="h-5 w-5 text-blue-600 mt-0.5" />
                <div>
                  <p className="font-medium">Verify setup</p>
                  <p className="text-sm text-muted-foreground">
                    Enter the 6-digit code from your app to complete setup
                  </p>
                </div>
              </div>
            </div>

            <Button
              onClick={handleStartSetup}
              disabled={generateMutation.isPending}
              className="w-full"
            >
              <Shield className="h-4 w-4 mr-2" />
              Start Setup
            </Button>
          </CardContent>
        </Card>
      )}

      {/* QR Code Card */}
      {step === 'setup' && generateMutation.isPending && (
        <Card>
          <CardContent className="py-8 text-center">
            <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4" />
            <p className="text-muted-foreground">Generating QR code...</p>
          </CardContent>
        </Card>
      )}

      {step === 'verify' && qrCode && (
        <Card>
          <CardHeader>
            <CardTitle>Scan QR Code</CardTitle>
            <CardDescription>
              Use your authenticator app to scan this QR code
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-center p-4 bg-white rounded-lg">
              <img src={qrCode} alt="QR Code" className="w-64 h-64" />
            </div>

            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>Manual entry:</strong> If you can't scan the QR code, enter this secret manually: <code className="bg-gray-100 px-2 py-1 rounded">{secret}</code>
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Label htmlFor="verification-code">Enter 6-digit code from your app</Label>
              <Input
                id="verification-code"
                type="text"
                placeholder="000000"
                maxLength={6}
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))}
                className="text-center text-2xl tracking-widest"
              />
            </div>

            <Button
              onClick={handleVerify}
              disabled={enableMutation.isPending || verificationCode.length !== 6}
              className="w-full"
            >
              Verify and Enable 2FA
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Backup Codes Card */}
      {step === 'enabled' && backupCodes.length > 0 && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-yellow-700">
              <AlertTriangle className="h-5 w-5" />
              Save Your Backup Codes
            </CardTitle>
            <CardDescription>
              Store these codes in a safe place. You can use them to access your account if you lose your authenticator device.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-2 p-4 bg-white rounded-lg font-mono text-sm">
              {backupCodes.map((code, index) => (
                <div key={index} className="p-2 border rounded text-center">
                  {code}
                </div>
              ))}
            </div>

            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>Important:</strong> Each backup code can only be used once. Download and store them securely.
              </AlertDescription>
            </Alert>

            <div className="flex gap-2">
              <Button onClick={downloadBackupCodes} variant="outline" className="flex-1">
                <Download className="h-4 w-4 mr-2" />
                Download Codes
              </Button>
              <Button onClick={() => setStep('check')} className="flex-1">
                Done
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
