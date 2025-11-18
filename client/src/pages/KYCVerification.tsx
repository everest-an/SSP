import { useState } from 'react';
import { useLocation } from 'wouter';
import { trpc } from '../lib/trpc';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Badge } from '../components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { Shield, Upload, CheckCircle2, Clock, XCircle, FileText } from 'lucide-react';

export default function KYCVerification() {
  const [, setLocation] = useLocation();
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    dateOfBirth: '',
    nationality: '',
    address: '',
    city: '',
    postalCode: '',
    country: '',
    idNumber: '',
    taxId: '',
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const { data: merchantProfile } = trpc.merchant.getMyMerchantProfile.useQuery();
  const { data: kycVerification, isLoading: kycLoading } = trpc.kyc.getKYCVerification.useQuery(
    { merchantId: merchantProfile?.id || 0 },
    { enabled: !!merchantProfile?.id }
  );

  const submitMutation = trpc.kyc.submitKYCVerification.useMutation({
    onSuccess: () => {
      setSuccess(true);
    },
    onError: (error) => {
      setError(error.message);
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!merchantProfile) {
      setError('Merchant profile not found');
      return;
    }

    submitMutation.mutate({
      merchantId: merchantProfile.id,
      ...formData,
    });
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return (
          <Badge className="bg-green-100 text-green-800">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Approved
          </Badge>
        );
      case 'pending':
        return (
          <Badge className="bg-yellow-100 text-yellow-800">
            <Clock className="h-3 w-3 mr-1" />
            Pending Review
          </Badge>
        );
      case 'rejected':
        return (
          <Badge className="bg-red-100 text-red-800">
            <XCircle className="h-3 w-3 mr-1" />
            Rejected
          </Badge>
        );
      case 'expired':
        return (
          <Badge className="bg-gray-100 text-gray-800">
            <Clock className="h-3 w-3 mr-1" />
            Expired
          </Badge>
        );
      default:
        return null;
    }
  };

  if (kycLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  // Show existing verification status
  if (kycVerification) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
            <Shield className="h-8 w-8" />
            KYC Verification
          </h1>
          <p className="text-muted-foreground">
            Identity verification for merchant account
          </p>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Verification Status</CardTitle>
                <CardDescription>
                  Your KYC verification request
                </CardDescription>
              </div>
              {getStatusBadge(kycVerification.status)}
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-muted-foreground">Full Name</Label>
                <p className="font-medium">
                  {kycVerification.firstName} {kycVerification.lastName}
                </p>
              </div>
              <div>
                <Label className="text-muted-foreground">Date of Birth</Label>
                <p className="font-medium">
                  {new Date(kycVerification.dateOfBirth).toLocaleDateString()}
                </p>
              </div>
              <div>
                <Label className="text-muted-foreground">Nationality</Label>
                <p className="font-medium">{kycVerification.nationality}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Country</Label>
                <p className="font-medium">{kycVerification.country}</p>
              </div>
            </div>

            <div>
              <Label className="text-muted-foreground">Address</Label>
              <p className="font-medium">
                {kycVerification.address}, {kycVerification.city}, {kycVerification.postalCode}
              </p>
            </div>

            {kycVerification.status === 'pending' && (
              <Alert>
                <Clock className="h-4 w-4" />
                <AlertDescription>
                  Your verification is being reviewed by our team. You'll receive an email notification
                  once the review is complete.
                </AlertDescription>
              </Alert>
            )}

            {kycVerification.status === 'approved' && (
              <Alert className="border-green-200 bg-green-50">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-800">
                  Your identity has been verified! You can now access all merchant features.
                </AlertDescription>
              </Alert>
            )}

            {kycVerification.status === 'rejected' && (
              <Alert variant="destructive">
                <XCircle className="h-4 w-4" />
                <AlertDescription>
                  Your verification was not approved. {kycVerification.reviewNotes && `Reason: ${kycVerification.reviewNotes}`}
                  <br />
                  You can submit a new verification request.
                </AlertDescription>
              </Alert>
            )}

            {kycVerification.documents && kycVerification.documents.length > 0 && (
              <div>
                <Label className="mb-2 block">Uploaded Documents</Label>
                <div className="space-y-2">
                  {kycVerification.documents.map((doc) => (
                    <div
                      key={doc.id}
                      className="flex items-center gap-2 p-3 border rounded-lg"
                    >
                      <FileText className="h-5 w-5 text-muted-foreground" />
                      <div className="flex-1">
                        <p className="font-medium capitalize">
                          {doc.documentType.replace('_', ' ')}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Uploaded {new Date(doc.uploadedAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setLocation('/merchant/dashboard')}>
                Back to Dashboard
              </Button>
              {kycVerification.status === 'rejected' && (
                <Button onClick={() => window.location.reload()}>
                  Submit New Verification
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show verification form
  if (success) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <Card className="border-green-200 bg-green-50">
          <CardHeader>
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
              <div>
                <CardTitle className="text-green-900">Verification Submitted!</CardTitle>
                <CardDescription className="text-green-700">
                  Your KYC verification has been submitted for review
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-green-800 mb-4">
              Thank you for submitting your verification information. Our team will review your
              application and notify you via email once the review is complete.
            </p>
            <Button onClick={() => setLocation('/merchant/dashboard')}>
              Return to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
          <Shield className="h-8 w-8" />
          KYC Verification
        </h1>
        <p className="text-muted-foreground">
          Complete your identity verification to unlock all merchant features
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Personal Information</CardTitle>
          <CardDescription>
            Please provide accurate information as it appears on your government-issued ID
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name *</Label>
                <Input
                  id="firstName"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name *</Label>
                <Input
                  id="lastName"
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="dateOfBirth">Date of Birth *</Label>
                <Input
                  id="dateOfBirth"
                  name="dateOfBirth"
                  type="date"
                  value={formData.dateOfBirth}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="nationality">Nationality *</Label>
                <Input
                  id="nationality"
                  name="nationality"
                  placeholder="US"
                  maxLength={2}
                  value={formData.nationality}
                  onChange={handleChange}
                  required
                />
                <p className="text-xs text-muted-foreground">ISO country code (e.g., US, GB, CA)</p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Street Address *</Label>
              <Input
                id="address"
                name="address"
                value={formData.address}
                onChange={handleChange}
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="city">City *</Label>
                <Input
                  id="city"
                  name="city"
                  value={formData.city}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="postalCode">Postal Code *</Label>
                <Input
                  id="postalCode"
                  name="postalCode"
                  value={formData.postalCode}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="country">Country *</Label>
                <Input
                  id="country"
                  name="country"
                  placeholder="US"
                  maxLength={2}
                  value={formData.country}
                  onChange={handleChange}
                  required
                />
                <p className="text-xs text-muted-foreground">ISO code</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="idNumber">ID Number (Optional)</Label>
                <Input
                  id="idNumber"
                  name="idNumber"
                  value={formData.idNumber}
                  onChange={handleChange}
                />
                <p className="text-xs text-muted-foreground">Government-issued ID number</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="taxId">Tax ID (Optional)</Label>
                <Input
                  id="taxId"
                  name="taxId"
                  value={formData.taxId}
                  onChange={handleChange}
                />
                <p className="text-xs text-muted-foreground">Tax identification number</p>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="font-semibold text-blue-900 mb-2">Next Steps</h3>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• After submission, you'll need to upload verification documents</li>
                <li>• Our team will review your information within 1-2 business days</li>
                <li>• You'll receive an email notification with the decision</li>
                <li>• Once approved, you'll have full access to merchant features</li>
              </ul>
            </div>

            <div className="flex gap-3">
              <Button
                type="submit"
                disabled={submitKYCMutation.isPending}
                className="flex-1"
              >
                {submitKYCMutation.isPending ? 'Submitting...' : 'Submit Verification'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setLocation('/merchant/dashboard')}
              >
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
